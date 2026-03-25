'use strict';

/* ══════════════════════════════════════════════════
   REALTIME.JS — Supabase Realtime
   
   Funcionalidades:
   1. Notificaciones INSTANTÁNEAS al barbero cuando
      un cliente reserva, modifica o cancela.
   2. Actualización automática de la agenda/citas
      sin necesidad de recargar la página.
   
   Requiere: Supabase JS SDK cargado via CDN
══════════════════════════════════════════════════ */

/* ══════════════════════════
   CONFIGURACIÓN SUPABASE CLIENT
══════════════════════════ */
var SUPABASE_RT_URL  = 'https://fcbbquvuffpmudvwqgbg.supabase.co';   // ← Reemplazar con tu URL de Supabase
var SUPABASE_RT_KEY  = 'sb_publishable_T-vz8QfJf_BB6XiHDavtLg_KyQvhjOF'; // ← Reemplazar con tu anon key

var _supaRT = null;     // Cliente Supabase para Realtime
var _rtChannel = null;  // Canal activo de Realtime
var _rtBizChannel = null; // Canal del negocio (para el dueño)

/**
 * Inicializa el cliente Supabase para Realtime.
 * Se llama una sola vez al cargar la app.
 */
function initSupabaseRealtime() {
  if (_supaRT) return _supaRT;

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.warn('⚠️ Supabase SDK no cargado. Realtime desactivado.');
    return null;
  }

  try {
    _supaRT = supabase.createClient(SUPABASE_RT_URL, SUPABASE_RT_KEY, {
      realtime: {
        params: { eventsPerSecond: 10 }
      }
    });
    console.log('✅ Supabase Realtime inicializado');
    return _supaRT;
  } catch (e) {
    console.error('❌ Error inicializando Supabase Realtime:', e);
    return null;
  }
}

/* ══════════════════════════
   SUSCRIPCIÓN PARA TRABAJADORES
   Escucha cambios en la tabla "appointments"
   filtrado por worker_id
══════════════════════════ */
function subscribeWorkerRealtime(workerId, bizId) {
  if (!workerId || !bizId) return;

  var client = initSupabaseRealtime();
  if (!client) return;

  // Limpiar suscripción anterior si existe
  unsubscribeRealtime();

  var channelName = 'worker-appointments-' + workerId;

  _rtChannel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',           // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'appointments',
        filter: 'worker_id=eq.' + workerId
      },
      function (payload) {
        console.log('📡 Realtime appointment:', payload.eventType, payload);
        handleAppointmentChange(payload, workerId, bizId);
      }
    )
    .subscribe(function (status) {
      console.log('📡 Worker Realtime status:', status);
      if (status === 'SUBSCRIBED') {
        showRealtimeIndicator(true);
      }
    });
}

/**
 * Suscripción para DUEÑOS de negocio.
 * Escucha TODOS los cambios de appointments del negocio.
 */
function subscribeBizRealtime(bizId) {
  if (!bizId) return;

  var client = initSupabaseRealtime();
  if (!client) return;

  // Limpiar canal de negocio anterior
  if (_rtBizChannel) {
    _rtBizChannel.unsubscribe();
    _rtBizChannel = null;
  }

  var channelName = 'biz-appointments-' + bizId;

  _rtBizChannel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: 'business_id=eq.' + bizId
      },
      function (payload) {
        console.log('📡 Realtime biz appointment:', payload.eventType, payload);
        handleBizAppointmentChange(payload, bizId);
      }
    )
    .subscribe(function (status) {
      console.log('📡 Biz Realtime status:', status);
    });
}

/* ══════════════════════════
   HANDLER: Cambio en appointment (WORKER)
══════════════════════════ */
function handleAppointmentChange(payload, workerId, bizId) {
  var eventType = payload.eventType; // INSERT, UPDATE, DELETE
  var newData   = payload.new || {};
  var oldData   = payload.old || {};

  // Evitar procesar si la UI no pertenece a este worker
  if (!CUR_WORKER || CUR_WORKER.id !== workerId) return;

  // ─── 1. NOTIFICACIÓN INSTANTÁNEA ───
  if (eventType === 'INSERT') {
    createRealtimeNotification(workerId, bizId, {
      type: 'new_booking',
      title: '📅 Nueva cita: ' + (newData.client_name || 'Cliente'),
      detail: (newData.service_name || 'Servicio') + ' • ' 
            + (newData.date || '') + ' a las ' + (newData.time || '') 
            + ' • ' + money(newData.service_price || 0)
    });
  }

  if (eventType === 'UPDATE') {
    if (newData.status === 'cancelled' && oldData.status !== 'cancelled') {
      createRealtimeNotification(workerId, bizId, {
        type: 'booking_cancel',
        title: '❌ Cita cancelada: ' + (newData.client_name || oldData.client_name || 'Cliente'),
        detail: (newData.service_name || '') + ' • ' + (newData.date || '') + ' a las ' + (newData.time || '')
      });
    } else if (newData.date !== oldData.date || newData.time !== oldData.time) {
      createRealtimeNotification(workerId, bizId, {
        type: 'booking_modify',
        title: '✏️ Cita modificada: ' + (newData.client_name || 'Cliente'),
        detail: 'Nuevo horario: ' + (newData.date || '') + ' a las ' + (newData.time || '')
      });
    }
  }

  if (eventType === 'DELETE') {
    createRealtimeNotification(workerId, bizId, {
      type: 'booking_cancel',
      title: '🗑️ Cita eliminada: ' + (oldData.client_name || 'Cliente'),
      detail: (oldData.service_name || '') + ' • ' + (oldData.date || '')
    });
  }

  // ─── 2. ACTUALIZAR DATOS LOCALES Y UI ───
  // Descargamos de forma segura sin disparar saveDB() localmente
  safeRefreshWorkerUI(workerId, bizId);
}

/* ══════════════════════════
   HANDLER: Cambio en appointment (DUEÑO)
══════════════════════════ */
function handleBizAppointmentChange(payload, bizId) {
  var eventType = payload.eventType;
  var newData   = payload.new || {};

  if (!CUR || CUR.id !== bizId) return;

  // Toast informativo para el dueño
  if (eventType === 'INSERT') {
    toast('📅 Nueva cita: ' + (newData.client_name || 'Cliente'), '#22C55E');
  } else if (eventType === 'UPDATE' && newData.status === 'cancelled') {
    toast('❌ Cita cancelada: ' + (newData.client_name || ''), '#EF4444');
  }
  
  // Descargamos de forma segura sin disparar saveDB() localmente
  safeRefreshBizUI(bizId);
}

/* ══════════════════════════
   CREAR NOTIFICACIÓN REALTIME
   (Push visual + sonido + guardar en worker)
══════════════════════════ */
function createRealtimeNotification(workerId, bizId, notif) {
  // 1. Añadir a la memoria local sin disparar saveDB completo
  if (CUR_WORKER) {
      if (!CUR_WORKER.notifications) CUR_WORKER.notifications = [];
      var d = new Date();
      CUR_WORKER.notifications.unshift({
          title: notif.title,
          body: notif.detail,
          date: String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),
          read: false
      });
      // Solo mantenemos las últimas 50 para no saturar
      if(CUR_WORKER.notifications.length > 50) CUR_WORKER.notifications.pop();
      
      // Intentar guardar en local storage de forma silenciosa si existe la función
      if (typeof localStorage !== 'undefined') {
          try { localStorage.setItem('citaspro_db', JSON.stringify(DB)); } catch(e){}
      }
  }

  // 2. Actualizar badge visual
  if (typeof renderWorkerNotifBadge === 'function') renderWorkerNotifBadge();
  if (document.querySelector('#s-worker .pane.on').id === 'wp-notif' && typeof renderWorkerNotifications === 'function') {
      renderWorkerNotifications();
  }

  // 3. Push visual flotante (notificación que se desliza desde arriba)
  showFloatingNotification(notif);

  // 4. Sonido de notificación (si está habilitado)
  playNotificationSound(notif.type);

  // 5. Browser Notification API (si el usuario dio permiso)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(notif.title, {
        body: notif.detail || '',
        icon: 'assets/img/logocitas barber2.png',
        badge: 'assets/img/logocitas barber2.png',
        tag: 'citaspro-' + Date.now(),
        renotify: true
      });
    } catch (e) {}
  }
}

/* ══════════════════════════
   NOTIFICACIÓN FLOTANTE (BANNER)
══════════════════════════ */
function showFloatingNotification(notif) {
  // Eliminar anteriores
  var old = document.querySelectorAll('.rt-notif-banner');
  old.forEach(function(el) { el.remove(); });

  var colors = {
    new_booking:    { bg: 'rgba(34,197,94,.15)', border: 'rgba(34,197,94,.4)', icon: '📅' },
    booking_cancel: { bg: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.4)', icon: '❌' },
    booking_modify: { bg: 'rgba(245,158,11,.15)', border: 'rgba(245,158,11,.4)', icon: '✏️' }
  };
  var style = colors[notif.type] || colors.new_booking;

  var banner = document.createElement('div');
  banner.className = 'rt-notif-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100000;'
    + 'padding:16px 20px;display:flex;align-items:center;gap:14px;'
    + 'background:' + style.bg + ';backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);'
    + 'border-bottom:2px solid ' + style.border + ';'
    + 'transform:translateY(-100%);transition:transform .4s cubic-bezier(.22,1,.36,1);'
    + 'cursor:pointer;';

  banner.innerHTML = '<div style="font-size:28px;flex-shrink:0">' + style.icon + '</div>'
    + '<div style="flex:1">'
    + '<div style="font-size:14px;font-weight:800;color:var(--text,#fff);margin-bottom:3px">' + san(notif.title) + '</div>'
    + '<div style="font-size:12px;color:var(--t2,#999)">' + san(notif.detail || '') + '</div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--muted,#666);font-weight:600">AHORA</div>';

  // Al hacer click, ir a notificaciones
  banner.addEventListener('click', function () {
    banner.style.transform = 'translateY(-100%)';
    setTimeout(function () { banner.remove(); }, 400);
    if (typeof workerTab === 'function') workerTab('notif');
  });

  document.body.appendChild(banner);

  // Animación entrada
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      banner.style.transform = 'translateY(0)';
    });
  });

  // Auto-ocultar después de 6 segundos
  setTimeout(function () {
    if (banner.parentNode) {
      banner.style.transform = 'translateY(-100%)';
      setTimeout(function () { if (banner.parentNode) banner.remove(); }, 400);
    }
  }, 6000);
}

/* ══════════════════════════
   SONIDO DE NOTIFICACIÓN
══════════════════════════ */
function playNotificationSound(type) {
  try {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    var ctx = new AudioContext();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'new_booking') {
      // Sonido alegre: dos tonos ascendentes
      osc.frequency.setValueAtTime(523, ctx.currentTime);       // C5
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);  // G5
    } else if (type === 'booking_cancel') {
      // Sonido descendente
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.2);
    } else {
      // Sonido neutro
      osc.frequency.setValueAtTime(587, ctx.currentTime);
      osc.frequency.setValueAtTime(523, ctx.currentTime + 0.15);
    }

    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Silencioso si no hay soporte de audio
  }
}

/* ══════════════════════════
   BROWSER NOTIFICATION API
══════════════════════════ */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/* ══════════════════════════
   INDICADOR REALTIME (punto verde)
══════════════════════════ */
function showRealtimeIndicator(connected) {
  var existing = G('rt-indicator');
  if (existing) existing.remove();

  if (!connected) return;

  var topbar = document.querySelector('#s-worker .topbar') || document.querySelector('#s-biz .topbar');
  if (!topbar) return;

  var dot = document.createElement('div');
  dot.id = 'rt-indicator';
  dot.title = 'Conectado en tiempo real';
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#22C55E;'
    + 'box-shadow:0 0 6px rgba(34,197,94,.6);animation:pulse-rt 2s infinite;'
    + 'position:absolute;top:8px;right:8px;';
  topbar.style.position = 'relative';
  topbar.appendChild(dot);

  // Añadir animación CSS si no existe
  if (!document.getElementById('rt-anim-style')) {
    var style = document.createElement('style');
    style.id = 'rt-anim-style';
    style.textContent = '@keyframes pulse-rt{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}';
    document.head.appendChild(style);
  }
}

/* ══════════════════════════
   ACTUALIZACIÓN SEGURA DE UI (SIN BUCLE)
══════════════════════════ */
async function safeRefreshWorkerUI(workerId, bizId) {
    if (typeof fetchBizFromCloud !== 'function') return;
    
    // Descargar datos frescos de la base de datos de Supabase sin disparar guardado
    const freshData = await fetchBizFromCloud(bizId);
    if (!freshData) return;
    
    // Actualizar datos en memoria pero SIN llamar a saveDB()
    let index = DB.businesses.findIndex(b => b.id === bizId);
    if (index >= 0) DB.businesses[index] = freshData;
    CUR = freshData;
    
    let freshWorker = CUR.workers.find(w => w.id === workerId);
    if (freshWorker) {
        // Preservamos las notificaciones locales (ya que no se sincronizan arriba)
        var localNotifs = CUR_WORKER.notifications || [];
        freshWorker.notifications = localNotifs;
        CUR_WORKER = freshWorker;
    }
    
    // Actualizar solo las vistas necesarias dependiendo de qué pestaña está abierta
    var activePane = document.querySelector('#s-worker .pane.on');
    if (activePane) {
        var pid = activePane.id;
        if (pid === 'wp-home') {
            if (typeof renderWorkerTodayAppts === 'function') renderWorkerTodayAppts();
            if (typeof renderWorkerHomeStats === 'function') renderWorkerHomeStats();
        } else if (pid === 'wp-agenda') {
            if (typeof initWorkerAgenda === 'function') initWorkerAgenda();
            if (typeof renderWorkerCalendar === 'function') renderWorkerCalendar();
        } else if (pid === 'wp-finanzas') {
            if (typeof renderWorkerFinanzas === 'function') {
                renderWorkerFinanzas();
            } else if (typeof renderWorkerFinances === 'function') {
                renderWorkerFinances();
            }
        }
    }
}

async function safeRefreshBizUI(bizId) {
    if (typeof fetchBizFromCloud !== 'function') return;
    
    // Descargar datos frescos sin guardar localmente
    const freshData = await fetchBizFromCloud(bizId);
    if (!freshData) return;
    
    let index = DB.businesses.findIndex(b => b.id === bizId);
    if (index >= 0) DB.businesses[index] = freshData;
    CUR = freshData;
    
    // Actualizar interfaz del dueño visualmente
    var activePane = document.querySelector('#s-biz .pane.on');
    if (activePane) {
        var pid = activePane.id;
        if (pid === 'bp-home') {
            if (typeof renderTodayAppts === 'function') renderTodayAppts();
            if (typeof renderBizHomeStats === 'function') renderBizHomeStats();
        } else if (pid === 'bp-agenda') {
            if (typeof initAgenda === 'function') initAgenda();
            if (typeof renderCalendar === 'function') renderCalendar();
        } else if (pid === 'bp-finanzas') {
            if (typeof renderBizFinanzas === 'function') {
                renderBizFinanzas();
            } else if (typeof renderBizFinances === 'function') {
                renderBizFinances();
            }
        }
    }
}

/* ══════════════════════════
   DESUSCRIBIR (limpieza)
══════════════════════════ */
function unsubscribeRealtime() {
  if (_rtChannel) {
    _rtChannel.unsubscribe();
    _rtChannel = null;
  }
  if (_rtBizChannel) {
    _rtBizChannel.unsubscribe();
    _rtBizChannel = null;
  }
  showRealtimeIndicator(false);
  console.log('📡 Realtime desconectado');
}

/* ══════════════════════════
   AUTO-CONECTAR AL INICIAR SESIÓN
══════════════════════════ */
function connectRealtimeForCurrentUser() {
  // Para trabajadores
  if (typeof CUR_WORKER !== 'undefined' && CUR_WORKER && DB && DB.currentWorker) {
    subscribeWorkerRealtime(CUR_WORKER.id, DB.currentWorker.bizId);
    requestNotificationPermission();
    return;
  }

  // Para dueños de negocio
  if (typeof CUR !== 'undefined' && CUR && CUR.id && DB && DB.currentBiz) {
    subscribeBizRealtime(CUR.id);
    requestNotificationPermission();
    return;
  }
}

/* ══════════════════════════
   HOOK EN WINDOW LOAD
══════════════════════════ */
window.addEventListener('load', function () {
  // Esperar a que la sesión se restaure, luego conectar
  setTimeout(function () {
    connectRealtimeForCurrentUser();
  }, 1500);
});

// Desconectar al cerrar/recargar
window.addEventListener('beforeunload', function () {
  unsubscribeRealtime();
});

/* ══════════════════════════
   EXPORTACIONES GLOBALES
══════════════════════════ */
window.initSupabaseRealtime     = initSupabaseRealtime;
window.subscribeWorkerRealtime  = subscribeWorkerRealtime;
window.subscribeBizRealtime     = subscribeBizRealtime;
window.unsubscribeRealtime      = unsubscribeRealtime;
window.connectRealtimeForCurrentUser = connectRealtimeForCurrentUser;
window.requestNotificationPermission = requestNotificationPermission;