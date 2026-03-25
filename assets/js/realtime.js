'use strict';

/* ══════════════════════════════════════════════════
   REALTIME.JS — Supabase Realtime
══════════════════════════════════════════════════ */

/* ══════════════════════════
   CONFIGURACIÓN SUPABASE CLIENT
══════════════════════════ */
var SUPABASE_RT_URL  = 'https://fcbbquvuffpmudvwqgbg.supabase.co';   
var SUPABASE_RT_KEY  = 'sb_publishable_T-vz8QfJf_BB6XiHDavtLg_KyQvhjOF'; 

var _supaRT = null;     
var _rtChannel = null;  
var _rtBizChannel = null; 

// Timers para evitar bucles (Antirrebote / Debounce)
var _refreshTimerWorker = null;
var _refreshTimerBiz = null;

function initSupabaseRealtime() {
  if (_supaRT) return _supaRT;

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.warn('⚠️ Supabase SDK no cargado. Realtime desactivado.');
    return null;
  }

  try {
    _supaRT = supabase.createClient(SUPABASE_RT_URL, SUPABASE_RT_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    });
    return _supaRT;
  } catch (e) {
    return null;
  }
}

/* ══════════════════════════
   SUSCRIPCIÓN PARA TRABAJADORES
══════════════════════════ */
function subscribeWorkerRealtime(workerId, bizId) {
  if (!workerId || !bizId) return;
  var client = initSupabaseRealtime();
  if (!client) return;

  unsubscribeRealtime();
  var channelName = 'worker-appointments-' + workerId;

  _rtChannel = client
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: 'worker_id=eq.' + workerId },
      function (payload) {
        handleAppointmentChange(payload, workerId, bizId);
      }
    )
    .subscribe(function (status) {
      if (status === 'SUBSCRIBED') showRealtimeIndicator(true);
    });
}

/* ══════════════════════════
   SUSCRIPCIÓN PARA DUEÑOS
══════════════════════════ */
function subscribeBizRealtime(bizId) {
  if (!bizId) return;
  var client = initSupabaseRealtime();
  if (!client) return;

  if (_rtBizChannel) { _rtBizChannel.unsubscribe(); _rtBizChannel = null; }

  var channelName = 'biz-appointments-' + bizId;

  _rtBizChannel = client
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: 'business_id=eq.' + bizId },
      function (payload) {
        handleBizAppointmentChange(payload, bizId);
      }
    )
    .subscribe();
}

/* ══════════════════════════
   HANDLER: Cambio en appointment (WORKER)
══════════════════════════ */
function handleAppointmentChange(payload, workerId, bizId) {
  var eventType = payload.eventType;
  var newData   = payload.new || {};
  var oldData   = payload.old || {};

  if (!CUR_WORKER || CUR_WORKER.id !== workerId) return;

  var isRealChange = false;

  // 1. EVALUAR SI ES UN CAMBIO REAL
  if (eventType === 'INSERT') {
    isRealChange = true;
    createRealtimeNotification(workerId, bizId, {
      type: 'new_booking',
      title: '📅 Nueva cita: ' + (newData.client_name || 'Cliente'),
      detail: (newData.service_name || 'Servicio') + ' • ' + (newData.date || '') + ' a las ' + (newData.time || '') 
    });
  } else if (eventType === 'UPDATE') {
    var changedStatus = (newData.status !== oldData.status);
    var changedDateOrTime = (newData.date !== oldData.date) || (newData.time !== oldData.time);

    if (changedStatus && newData.status === 'cancelled' && oldData.status !== 'cancelled') {
      isRealChange = true;
      createRealtimeNotification(workerId, bizId, {
        type: 'booking_cancel',
        title: '❌ Cita cancelada: ' + (newData.client_name || oldData.client_name || 'Cliente'),
        detail: (newData.service_name || '') + ' • ' + (newData.date || '') + ' a las ' + (newData.time || '')
      });
    } else if (changedDateOrTime) {
      isRealChange = true;
      createRealtimeNotification(workerId, bizId, {
        type: 'booking_modify',
        title: '✏️ Cita modificada: ' + (newData.client_name || 'Cliente'),
        detail: 'Nuevo horario: ' + (newData.date || '') + ' a las ' + (newData.time || '')
      });
    }
  } else if (eventType === 'DELETE') {
    isRealChange = true;
    createRealtimeNotification(workerId, bizId, {
      type: 'booking_cancel',
      title: '🗑️ Cita eliminada: ' + (oldData.client_name || 'Cliente'),
      detail: (oldData.service_name || '') + ' • ' + (oldData.date || '')
    });
  }

  // Solo mostrar en consola si fue un cambio de verdad (silencia los falsos updates)
  if (isRealChange) {
      console.log('🔔 Cambio real detectado:', eventType, newData.id);
  }

  // 2. ACTUALIZAR UI CON ANTIRREBOTE (Freno de bucles)
  // Si llegan 50 avisos de golpe, el temporizador se reinicia y solo se ejecuta UNA vez al final.
  if (_refreshTimerWorker) clearTimeout(_refreshTimerWorker);
  _refreshTimerWorker = setTimeout(function() {
      safeRefreshWorkerUI(workerId, bizId);
  }, 800); // Espera 0.8 segundos a que pase el "ruido" antes de refrescar
}

/* ══════════════════════════
   HANDLER: Cambio en appointment (DUEÑO)
══════════════════════════ */
function handleBizAppointmentChange(payload, bizId) {
  var eventType = payload.eventType;
  var newData   = payload.new || {};
  var oldData   = payload.old || {};

  if (!CUR || CUR.id !== bizId) return;

  var isRealChange = false;

  if (eventType === 'INSERT') {
    isRealChange = true;
    toast('📅 Nueva cita: ' + (newData.client_name || 'Cliente'), '#22C55E');
  } else if (eventType === 'UPDATE') {
    if (newData.status === 'cancelled' && oldData.status !== 'cancelled') {
        isRealChange = true;
        toast('❌ Cita cancelada: ' + (newData.client_name || ''), '#EF4444');
    } else if (newData.date !== oldData.date || newData.time !== oldData.time) {
        isRealChange = true;
    }
  } else if (eventType === 'DELETE') {
      isRealChange = true;
  }

  if (isRealChange) {
      console.log('🔔 Cambio real detectado en negocio:', eventType, newData.id);
  }

  // ANTIRREBOTE (Freno de bucles)
  if (_refreshTimerBiz) clearTimeout(_refreshTimerBiz);
  _refreshTimerBiz = setTimeout(function() {
      safeRefreshBizUI(bizId);
  }, 800);
}

/* ══════════════════════════
   CREAR NOTIFICACIÓN REALTIME
══════════════════════════ */
function createRealtimeNotification(workerId, bizId, notif) {
  if (CUR_WORKER) {
      if (!CUR_WORKER.notifications) CUR_WORKER.notifications = [];
      var d = new Date();
      CUR_WORKER.notifications.unshift({
          title: notif.title,
          body: notif.detail,
          date: String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),
          read: false
      });
      if(CUR_WORKER.notifications.length > 50) CUR_WORKER.notifications.pop();
      
      if (typeof localStorage !== 'undefined') {
          try { localStorage.setItem('citaspro_db', JSON.stringify(DB)); } catch(e){}
      }
  }

  if (typeof renderWorkerNotifBadge === 'function') renderWorkerNotifBadge();
  if (document.querySelector('#s-worker .pane.on') && document.querySelector('#s-worker .pane.on').id === 'wp-notif' && typeof renderWorkerNotifications === 'function') {
      renderWorkerNotifications();
  }

  var colors = { new_booking: '#22C55E', booking_cancel: '#EF4444', booking_modify: '#F59E0B' };
  toast(notif.title, colors[notif.type] || '#4A7FD4');

  showFloatingNotification(notif);
  playNotificationSound(notif.type);

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(notif.title, {
        body: notif.detail || '',
        icon: 'assets/img/logocitas barber2.png',
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

  banner.addEventListener('click', function () {
    banner.style.transform = 'translateY(-100%)';
    setTimeout(function () { banner.remove(); }, 400);
    if (typeof workerTab === 'function') workerTab('notif');
  });

  document.body.appendChild(banner);

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      banner.style.transform = 'translateY(0)';
    });
  });

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
      osc.frequency.setValueAtTime(523, ctx.currentTime);       
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15); 
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);  
    } else if (type === 'booking_cancel') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.2);
    } else {
      osc.frequency.setValueAtTime(587, ctx.currentTime);
      osc.frequency.setValueAtTime(523, ctx.currentTime + 0.15);
    }

    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

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

  if (!document.getElementById('rt-anim-style')) {
    var style = document.createElement('style');
    style.id = 'rt-anim-style';
    style.textContent = '@keyframes pulse-rt{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}';
    document.head.appendChild(style);
  }
}

/* ══════════════════════════
   ACTUALIZACIÓN SEGURA DE UI
══════════════════════════ */
async function safeRefreshWorkerUI(workerId, bizId) {
    if (typeof fetchBizFromCloud !== 'function') return;
    
    const freshData = await fetchBizFromCloud(bizId);
    if (!freshData) return;
    
    let index = DB.businesses.findIndex(b => b.id === bizId);
    if (index >= 0) DB.businesses[index] = freshData;
    CUR = freshData;
    
    let freshWorker = CUR.workers.find(w => w.id === workerId);
    if (freshWorker) {
        var localNotifs = CUR_WORKER.notifications || [];
        freshWorker.notifications = localNotifs;
        CUR_WORKER = freshWorker;
    }
    
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
            if (typeof renderWorkerFinanzas === 'function') renderWorkerFinanzas();
            else if (typeof renderWorkerFinances === 'function') renderWorkerFinances();
        }
    }
}

async function safeRefreshBizUI(bizId) {
    if (typeof fetchBizFromCloud !== 'function') return;
    
    const freshData = await fetchBizFromCloud(bizId);
    if (!freshData) return;
    
    let index = DB.businesses.findIndex(b => b.id === bizId);
    if (index >= 0) DB.businesses[index] = freshData;
    CUR = freshData;
    
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
            if (typeof renderBizFinanzas === 'function') renderBizFinanzas();
            else if (typeof renderBizFinances === 'function') renderBizFinances();
        }
    }
}

/* ══════════════════════════
   DESUSCRIBIR (limpieza)
══════════════════════════ */
function unsubscribeRealtime() {
  if (_rtChannel) { _rtChannel.unsubscribe(); _rtChannel = null; }
  if (_rtBizChannel) { _rtBizChannel.unsubscribe(); _rtBizChannel = null; }
  showRealtimeIndicator(false);
}

function connectRealtimeForCurrentUser() {
  if (typeof CUR_WORKER !== 'undefined' && CUR_WORKER && DB && DB.currentWorker) {
    subscribeWorkerRealtime(CUR_WORKER.id, DB.currentWorker.bizId);
    requestNotificationPermission();
    return;
  }
  if (typeof CUR !== 'undefined' && CUR && CUR.id && DB && DB.currentBiz) {
    subscribeBizRealtime(CUR.id);
    requestNotificationPermission();
    return;
  }
}

window.addEventListener('load', function () { setTimeout(connectRealtimeForCurrentUser, 1500); });
window.addEventListener('beforeunload', function () { unsubscribeRealtime(); });

window.initSupabaseRealtime     = initSupabaseRealtime;
window.subscribeWorkerRealtime  = subscribeWorkerRealtime;
window.subscribeBizRealtime     = subscribeBizRealtime;
window.unsubscribeRealtime      = unsubscribeRealtime;
window.connectRealtimeForCurrentUser = connectRealtimeForCurrentUser;
window.requestNotificationPermission = requestNotificationPermission;