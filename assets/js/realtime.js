'use strict';

/* ══════════════════════════════════════════════════
   REALTIME.JS — Supabase Realtime (VERSIÓN FINAL Y PULIDA)
══════════════════════════════════════════════════ */

var SUPABASE_RT_URL  = 'https://fcbbquvuffpmudvwqgbg.supabase.co';   
var SUPABASE_RT_KEY  = 'sb_publishable_T-vz8QfJf_BB6XiHDavtLg_KyQvhjOF'; 

var _supaRT = null;     
var _rtChannel = null;  
var _rtBizChannel = null; 

// Timers para evitar bucles (Antirrebote)
var _refreshTimerWorker = null;
var _refreshTimerBiz = null;

function initSupabaseRealtime() {
  if (_supaRT) return _supaRT;
  if (typeof supabase === 'undefined' || !supabase.createClient) return null;

  try {
    _supaRT = supabase.createClient(SUPABASE_RT_URL, SUPABASE_RT_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    });
    return _supaRT;
  } catch (e) { return null; }
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

  if (!CUR_WORKER || CUR_WORKER.id !== workerId) return;

  var localAppt = (CUR_WORKER.appointments || []).find(function(a) { return String(a.id) === String(newData.id); });
  
  var isRealChange = false;
  var notifType = '';
  var notifTitle = '';
  var notifDetail = '';

  var clientName = newData.client_name || newData.client || 'Cliente';
  var serviceName = newData.service_name || newData.svc || 'Servicio';
  var servicePrice = newData.service_price !== undefined ? newData.service_price : (newData.price || 0);

  if (eventType === 'INSERT') {
    if (!localAppt) {
      isRealChange = true;
      notifType = 'new_booking';
      notifTitle = '📅 Nueva cita: ' + clientName;
      notifDetail = serviceName + ' • ' + (newData.date || '') + ' a las ' + (newData.time || '') + ' • ' + money(servicePrice);
    }
  } else if (eventType === 'UPDATE') {
    if (localAppt) {
      var changedStatus = (newData.status !== localAppt.status);
      var changedDateOrTime = (newData.date !== localAppt.date) || (newData.time !== localAppt.time);

      if (changedStatus && newData.status === 'cancelled' && localAppt.status !== 'cancelled') {
        isRealChange = true;
        notifType = 'booking_cancel';
        notifTitle = '❌ Cita cancelada: ' + clientName;
        notifDetail = serviceName + ' • ' + (newData.date || '') + ' a las ' + (newData.time || '');
      } else if (changedDateOrTime) {
        isRealChange = true;
        notifType = 'booking_modify';
        notifTitle = '✏️ Cita modificada: ' + clientName;
        notifDetail = 'Nuevo horario: ' + (newData.date || '') + ' a las ' + (newData.time || '');
      }
    }
  } else if (eventType === 'DELETE') {
    if (localAppt) {
      isRealChange = true;
      notifType = 'booking_cancel';
      notifTitle = '🗑️ Cita eliminada: ' + (localAppt.client || 'Cliente');
      notifDetail = (localAppt.svc || '') + ' • ' + (localAppt.date || '');
    }
  }

  if (isRealChange) {
      createRealtimeNotification(workerId, bizId, { type: notifType, title: notifTitle, detail: notifDetail });
  }

  if (_refreshTimerWorker) clearTimeout(_refreshTimerWorker);
  _refreshTimerWorker = setTimeout(function() {
      safeRefreshWorkerUI(workerId, bizId);
  }, 1000);
}

/* ══════════════════════════
   HANDLER: Cambio en appointment (DUEÑO)
══════════════════════════ */
function handleBizAppointmentChange(payload, bizId) {
  var eventType = payload.eventType;
  var newData   = payload.new || {};

  if (!CUR || CUR.id !== bizId) return;

  var localAppt = null;
  (CUR.workers || []).forEach(function(w){ 
      var found = (w.appointments || []).find(a => String(a.id) === String(newData.id));
      if (found) localAppt = found;
  });
  if (!localAppt) {
      var found = (CUR.appointments || []).find(a => String(a.id) === String(newData.id));
      if (found) localAppt = found;
  }
  
  var clientName = newData.client_name || newData.client || 'Cliente';

  if (eventType === 'INSERT') {
    if (!localAppt) toast('📅 Nueva cita: ' + clientName, '#22C55E');
  } else if (eventType === 'UPDATE') {
    if (localAppt) {
        var changedStatus = (newData.status !== localAppt.status);
        if (changedStatus && newData.status === 'cancelled' && localAppt.status !== 'cancelled') {
            toast('❌ Cita cancelada: ' + clientName, '#EF4444');
        }
    }
  }

  if (_refreshTimerBiz) clearTimeout(_refreshTimerBiz);
  _refreshTimerBiz = setTimeout(function() {
      safeRefreshBizUI(bizId);
  }, 1000);
}

/* ══════════════════════════
   CREAR NOTIFICACIÓN REALTIME
══════════════════════════ */
function createRealtimeNotification(workerId, bizId, notif) {
  
  var notifObj = {
      type: notif.type,
      msg: notif.title,               
      data: { detail: notif.detail }, 
      date: new Date().toISOString(), 
      read: false
  };

  if (typeof addNotificationToWorker === 'function') {
    addNotificationToWorker(bizId, workerId, notifObj);
  } else if (CUR_WORKER) {
      if (!CUR_WORKER.notifications) CUR_WORKER.notifications = [];
      CUR_WORKER.notifications.unshift(notifObj);
      if(CUR_WORKER.notifications.length > 50) CUR_WORKER.notifications.pop();
      if (typeof saveDB === 'function') saveDB();
  }

  if (typeof renderWorkerNotifBadge === 'function') renderWorkerNotifBadge();
  
  var activePane = document.querySelector('#s-worker .pane.on');
  if (activePane && activePane.id === 'wp-notif' && typeof renderWorkerNotifications === 'function') {
      renderWorkerNotifications();
  }

  var colors = { new_booking: '#22C55E', booking_cancel: '#EF4444', booking_modify: '#F59E0B' };
  toast(notif.title, colors[notif.type] || '#4A7FD4');
  showFloatingNotification(notif);
  playNotificationSound(notif.type);

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(notif.title, { body: notif.detail || '', icon: 'assets/img/logocitas barber2.png', tag: 'citaspro-' + Date.now(), renotify: true });
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
   SONIDO DE NOTIFICACIÓN Y PERMISOS (Corregido)
══════════════════════════ */
// Función restaurada para pedir permiso al navegador
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(function(){}); // Silencioso si falla
  }
}

var _lastSoundTime = 0;
var _audioCtx = null;

function playNotificationSound(type) {
  var now = Date.now();
  if (now - _lastSoundTime < 1000) return; 
  _lastSoundTime = now;

  try {
    if (!_audioCtx) {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      _audioCtx = new AudioContext();
    }

    // Intentamos reanudar el contexto de audio. Si Chrome lo bloquea, atrapamos el error en silencio (.catch)
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(function(){});
    }

    var osc = _audioCtx.createOscillator();
    var gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);

    if (type === 'new_booking') {
      osc.frequency.setValueAtTime(523, _audioCtx.currentTime);       
      osc.frequency.setValueAtTime(659, _audioCtx.currentTime + 0.15); 
      osc.frequency.setValueAtTime(784, _audioCtx.currentTime + 0.3);  
    } else if (type === 'booking_cancel') {
      osc.frequency.setValueAtTime(440, _audioCtx.currentTime);
      osc.frequency.setValueAtTime(330, _audioCtx.currentTime + 0.2);
    } else {
      osc.frequency.setValueAtTime(587, _audioCtx.currentTime);
      osc.frequency.setValueAtTime(523, _audioCtx.currentTime + 0.15);
    }

    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.5);
    osc.start(_audioCtx.currentTime);
    osc.stop(_audioCtx.currentTime + 0.5);
  } catch (e) {
    // Si algo sale mal con el audio, no rompemos el resto de la aplicación
  }
}

/* ══════════════════════════
   INDICADOR REALTIME
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
   DESUSCRIBIR
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