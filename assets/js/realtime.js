
'use strict';

/* ══════════════════════════════════════════════════
   REALTIME.JS — Supabase Realtime (VERSIÓN DEFINITIVA)
══════════════════════════════════════════════════ */

var SUPABASE_RT_URL = 'https://krbtoepzoorpdedtykug.supabase.co';
var SUPABASE_RT_KEY = 'sb_publishable_IXquO0XEbEkFBmZgblzjVg_adtTWCW-';

var _supaRT = null;
var _rtChannel = null;
var _rtBizChannel = null;
var _rtClientChannel = null;

var _refreshTimerWorker = null;
var _refreshTimerBiz = null;
var _smartPollTimer = null;

var _handledRealtimeEvents = {};
function markEventHandled(apptId, type) {
  _handledRealtimeEvents[apptId + '_' + type] = true;
}
function isEventHandled(apptId, type) {
  return !!_handledRealtimeEvents[apptId + '_' + type];
}

async function loadSupabaseCDN() {
  return new Promise(function (resolve) {
    if (typeof supabase !== 'undefined') return resolve(true);
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = function () { resolve(true); };
    script.onerror = function () { resolve(false); };
    document.head.appendChild(script);
  });
}

async function initSupabaseRealtime() {
  if (_supaRT) return _supaRT;
  await loadSupabaseCDN();
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
async function subscribeWorkerRealtime(workerId, bizId) {
  if (!workerId || !bizId) return;
  var client = await initSupabaseRealtime();
  if (!client) return;

  unsubscribeRealtime();
  var channelName = 'worker-appointments-' + workerId;

  _rtChannel = client
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: 'worker_id=eq.' + workerId },
      function (payload) { handleAppointmentChange(payload, workerId, bizId); }
    )
    .subscribe(function (status) {
      console.log('Worker Realtime Status:', status);
      if (status === 'SUBSCRIBED') showRealtimeIndicator(true);
    });
}

/* ══════════════════════════
   SUSCRIPCIÓN PARA DUEÑOS
══════════════════════════ */
async function subscribeBizRealtime(bizId) {
  if (!bizId) return;
  var client = await initSupabaseRealtime();
  if (!client) return;

  if (_rtBizChannel) { _rtBizChannel.unsubscribe(); _rtBizChannel = null; }
  var channelName = 'biz-appointments-' + bizId;

  _rtBizChannel = client
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: 'business_id=eq.' + bizId },
      function (payload) { handleBizAppointmentChange(payload, bizId); }
    )
    .subscribe(function (status) {
      console.log('Biz Realtime Status:', status);
      if (status === 'SUBSCRIBED') showRealtimeIndicator(true);
    });
}

/* ══════════════════════════
   SUSCRIPCIÓN PARA CLIENTES (PORTAL)
══════════════════════════ */
async function subscribeClientRealtime(bizId) {
  if (!bizId) return;
  var client = await initSupabaseRealtime();
  if (!client) return;

  if (_rtClientChannel) { _rtClientChannel.unsubscribe(); _rtClientChannel = null; }
  var channelName = 'client-appointments-' + bizId;

  _rtClientChannel = client
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: 'business_id=eq.' + bizId },
      function (payload) {
        safeRefreshClientUI(bizId);
      }
    )
    .subscribe();
}

async function safeRefreshClientUI(bizId) {
  if (typeof fetchBizFromCloud !== 'function') return;
  const freshData = await fetchBizFromCloud(bizId);
  if (!freshData) return;

  let index = DB.businesses.findIndex(function (b) { return b.id === bizId; });
  if (index >= 0) DB.businesses[index] = freshData;
  else DB.businesses.push(freshData);

  if (typeof CSEL !== 'undefined' && CSEL && CSEL.bizId === bizId) {
    var s4 = document.getElementById('cs-4');
    if (s4 && s4.classList.contains('on')) {
      if (typeof buildTimes === 'function') buildTimes(CSEL.bizId, CSEL.workerId);
    }
  }
}

/* ══════════════════════════
   HANDLER WORKER
══════════════════════════ */
function handleAppointmentChange(payload, workerId, bizId) {
  var eventType = payload.eventType;
  var newData = payload.new || {};

  if (!CUR_WORKER || CUR_WORKER.id !== workerId) return;

  var localAppt = (CUR_WORKER.appointments || []).find(function (a) { return String(a.id) === String(newData.id); });

  var isRealChange = false;
  var notifType = '', notifTitle = '', notifDetail = '';

  var clientName = newData.client_name || newData.client || 'Cliente';
  var serviceName = newData.service_name || newData.svc || 'Servicio';
  var servicePrice = newData.service_price !== undefined ? newData.service_price : (newData.price || 0);

  if (eventType === 'INSERT') {
    if (!localAppt) {
      if (!isEventHandled(newData.id, 'new_booking')) {
        markEventHandled(newData.id, 'new_booking');
        isRealChange = true;
        notifType = 'new_booking';
        notifTitle = 'Nueva cita: ' + clientName;
        notifDetail = serviceName + ' • ' + (newData.date || '') + ' a las ' + (newData.time || '') + ' • ' + money(servicePrice);
      }
    }
  } else if (eventType === 'UPDATE') {
    if (localAppt) {
      var changedStatus = (newData.status !== localAppt.status);
      var changedDateOrTime = (newData.date !== localAppt.date) || (newData.time !== localAppt.time);
      if (changedStatus && newData.status === 'cancelled' && localAppt.status !== 'cancelled') {
        if (!isEventHandled(newData.id, 'booking_cancel')) {
          markEventHandled(newData.id, 'booking_cancel');
          isRealChange = true;
          notifType = 'booking_cancel';
          notifTitle = 'Cita cancelada: ' + clientName;
          notifDetail = serviceName + ' • ' + (newData.date || '') + ' a las ' + (newData.time || '');
        }
      } else if (changedDateOrTime) {
        if (!isEventHandled(newData.id, 'booking_modify')) {
          markEventHandled(newData.id, 'booking_modify');
          isRealChange = true;
          notifType = 'booking_modify';
          notifTitle = 'Cita modificada: ' + clientName;
          notifDetail = 'Nuevo horario: ' + (newData.date || '') + ' a las ' + (newData.time || '');
        }
      }
    }
  } else if (eventType === 'DELETE') {
    if (localAppt) {
      if (!isEventHandled(localAppt.id, 'booking_cancel')) {
        markEventHandled(localAppt.id, 'booking_cancel');
        isRealChange = true;
        notifType = 'booking_cancel';
        notifTitle = '🗑️ Cita eliminada: ' + (localAppt.client || 'Cliente');
        notifDetail = (localAppt.svc || '') + ' • ' + (localAppt.date || '');
      }
    }
  }

  if (isRealChange) {
    createRealtimeNotification(workerId, bizId, { type: notifType, title: notifTitle, detail: notifDetail });
  }

  if (_refreshTimerWorker) clearTimeout(_refreshTimerWorker);
  _refreshTimerWorker = setTimeout(function () { safeRefreshWorkerUI(workerId, bizId); }, 400);
}

/* ══════════════════════════
   HANDLER DUEÑO
══════════════════════════ */
function handleBizAppointmentChange(payload, bizId) {
  var eventType = payload.eventType;
  var newData = payload.new || {};

  if (!CUR || CUR.id !== bizId) return;

  var localAppt = null;
  (CUR.workers || []).forEach(function (w) {
    var found = (w.appointments || []).find(function (a) { return String(a.id) === String(newData.id); });
    if (found) localAppt = found;
  });
  if (!localAppt) {
    var found = (CUR.appointments || []).find(function (a) { return String(a.id) === String(newData.id); });
    if (found) localAppt = found;
  }

  var clientName = newData.client_name || newData.client || 'Cliente';
  if (eventType === 'INSERT' && !localAppt) {
    if (!isEventHandled(newData.id, 'new_booking_biz')) {
      markEventHandled(newData.id, 'new_booking_biz');
      toast('📅 Nueva cita: ' + clientName, '#22C55E');
    }
  } else if (eventType === 'UPDATE' && localAppt) {
    if (newData.status === 'cancelled' && localAppt.status !== 'cancelled') {
      if (!isEventHandled(newData.id, 'booking_cancel_biz')) {
        markEventHandled(newData.id, 'booking_cancel_biz');
        toast('Cita cancelada: ' + clientName, '#EF4444');
      }
    }
  }

  if (_refreshTimerBiz) clearTimeout(_refreshTimerBiz);
  _refreshTimerBiz = setTimeout(function () { safeRefreshBizUI(bizId); }, 400);
}

/* ══════════════════════════
   CREAR NOTIFICACIÓN REALTIME
   ✅ Guarda en Supabase para que persista 7 días
══════════════════════════ */
function createRealtimeNotification(workerId, bizId, notif) {

  var notifObj = {
    type: notif.type,
    msg: notif.title,
    data: { detail: notif.detail },
    date: new Date().toISOString(),
    read: false
  };

  // 1. Guardar en memoria local
  if (typeof addNotificationToWorker === 'function') {
    addNotificationToWorker(bizId, workerId, notifObj);
  } else if (CUR_WORKER) {
    if (!CUR_WORKER.notifications) CUR_WORKER.notifications = [];
    CUR_WORKER.notifications.unshift(notifObj);
    if (CUR_WORKER.notifications.length > 50) CUR_WORKER.notifications.pop();
  }

  // 2. ✅ Guardar en Supabase — COMENTADO
  // El backend (syncRoutes.js) ya guarda la notificación en la base de datos 
  // al insertar la cita. Si lo hacemos aquí también, se triplican los mensajes.
  // if (typeof saveNotificationToCloud === 'function') {
  //   saveNotificationToCloud(workerId, bizId, notifObj);
  // }

  // 3. Guardar localStorage
  if (typeof saveDB === 'function') saveDB();

  // 4. Refrescar UI
  if (typeof renderWorkerNotifBadge === 'function') renderWorkerNotifBadge();
  var activePane = document.querySelector('#s-worker .pane.on');
  if (activePane && activePane.id === 'wp-notif' && typeof renderWorkerNotifications === 'function') {
    renderWorkerNotifications();
  }

  // 5. Banner + sonido + notificación del sistema
  var colors = { new_booking: '#22C55E', booking_cancel: '#EF4444', booking_modify: '#F59E0B' };
  toast(notif.title, colors[notif.type] || '#4A7FD4');
  showFloatingNotification(notif);
  playNotificationSound(notif.type);

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(notif.title, {
        body: notif.detail || '', icon: '/assets/img/image.png',
        tag: 'citaspro-' + notif.type, renotify: true
      });
    } catch (e) { }
  }
}

/* ══════════════════════════
   BANNER FLOTANTE
══════════════════════════ */
function showFloatingNotification(notif) {
  var old = document.querySelectorAll('.rt-notif-banner');
  old.forEach(function (el) { el.remove(); });

  var colors = {
    new_booking: { bg: 'rgba(34,197,94,.15)', border: 'rgba(34,197,94,.4)', icon: '📅' },
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
    + 'transform:translateY(-100%);transition:transform .4s cubic-bezier(.22,1,.36,1);cursor:pointer;';

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
    requestAnimationFrame(function () { banner.style.transform = 'translateY(0)'; });
  });
  setTimeout(function () {
    if (banner.parentNode) {
      banner.style.transform = 'translateY(-100%)';
      setTimeout(function () { if (banner.parentNode) banner.remove(); }, 400);
    }
  }, 6000);
}

/* ══════════════════════════
   SONIDO
══════════════════════════ */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(function () { });
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
    if (_audioCtx.state === 'suspended') return;
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
  } catch (e) { }
}

document.addEventListener('click', function () {
  if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume().catch(function () { });
}, { once: false });

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

function startSmartPolling(workerId, bizId) {
  if (_smartPollTimer) clearInterval(_smartPollTimer);
  _smartPollTimer = setInterval(function () {
    if (document.hidden) return; // Pausa si el usuario no está viendo la pantalla
    if (workerId && typeof CUR_WORKER !== 'undefined' && CUR_WORKER) {
      safeRefreshWorkerUI(workerId, bizId);
    } else if (bizId && typeof CUR !== 'undefined' && CUR) {
      safeRefreshBizUI(bizId);
    }
  }, 4000); // Se actualiza solo y en silencio cada 4 segundos
}

/* ══════════════════════════
   REFRESH UI SEGURO
══════════════════════════ */
async function safeRefreshWorkerUI(workerId, bizId) {
  if (typeof fetchBizFromCloud !== 'function') return;
  const freshData = await fetchBizFromCloud(bizId);
  if (!freshData) return;
  let index = DB.businesses.findIndex(function (b) { return b.id === bizId; });
  if (index >= 0) {
    let oldBiz = DB.businesses[index];
    if (oldBiz.notifications) freshData.notifications = oldBiz.notifications;
    (freshData.workers || []).forEach(function (fw) {
      let oldW = (oldBiz.workers || []).find(function (ow) { return ow.id === fw.id; });
      if (oldW && oldW.notifications) fw.notifications = oldW.notifications;
    });
    DB.businesses[index] = freshData;
  }
  CUR = freshData;
  let freshWorker = CUR.workers.find(function (w) { return w.id === workerId; });
  if (freshWorker) CUR_WORKER = freshWorker;
  try { localStorage.setItem(DBKEY, JSON.stringify(DB)); } catch (e) { }
  var activePane = document.querySelector('#s-worker .pane.on');
  if (activePane) {
    var pid = activePane.id;
    if (pid === 'wp-home') {
      if (typeof renderWorkerHomeStats === 'function') renderWorkerHomeStats();
    } else if (pid === 'wp-agenda') {
      if (typeof initWorkerAgenda === 'function') initWorkerAgenda();
      if (typeof renderWorkerCalendar === 'function') renderWorkerCalendar();
    } else if (pid === 'wp-finanzas' || pid === 'wp-historial') {
      if (typeof renderWorkerFinanzas === 'function') renderWorkerFinanzas();
      else if (typeof renderWorkerFinances === 'function') renderWorkerFinances();
    }
  }
}

async function safeRefreshBizUI(bizId) {
  if (typeof fetchBizFromCloud !== 'function') return;
  const freshData = await fetchBizFromCloud(bizId);
  if (!freshData) return;
  let index = DB.businesses.findIndex(function (b) { return b.id === bizId; });
  if (index >= 0) {
    let oldBiz = DB.businesses[index];
    if (oldBiz.notifications) freshData.notifications = oldBiz.notifications;
    (freshData.workers || []).forEach(function (fw) {
      let oldW = (oldBiz.workers || []).find(function (ow) { return ow.id === fw.id; });
      if (oldW && oldW.notifications) fw.notifications = oldW.notifications;
    });
    DB.businesses[index] = freshData;
  }
  CUR = freshData;
  try { localStorage.setItem(DBKEY, JSON.stringify(DB)); } catch (e) { }
  var activePane = document.querySelector('#s-biz .pane.on');
  if (activePane) {
    var pid = activePane.id;
    if (pid === 'bp-home') {
      if (typeof renderBizHomeStats === 'function') renderBizHomeStats();
    } else if (pid === 'bp-agenda') {
      if (typeof initAgenda === 'function') initAgenda();
      if (typeof renderCalendar === 'function') renderCalendar();
    } else if (pid === 'bp-finanzas' || pid === 'bp-historial') {
      if (typeof renderBizFinanzas === 'function') renderBizFinanzas();
      else if (typeof renderBizFinances === 'function') renderBizFinances();
    }
  }
}

/* ══════════════════════════
   DESUSCRIBIR Y CONECTAR
══════════════════════════ */
function unsubscribeRealtime() {
  if (_rtChannel) { _rtChannel.unsubscribe(); _rtChannel = null; }
  if (_rtBizChannel) { _rtBizChannel.unsubscribe(); _rtBizChannel = null; }
  if (_rtClientChannel) { _rtClientChannel.unsubscribe(); _rtClientChannel = null; }
  if (_smartPollTimer) { clearInterval(_smartPollTimer); _smartPollTimer = null; }
  showRealtimeIndicator(false);
}

document.addEventListener("visibilitychange", function () {
  if (!document.hidden) {
    // Forzar actualización instantánea al volver a mirar la pantalla
    if (typeof CUR_WORKER !== 'undefined' && CUR_WORKER && typeof DB !== 'undefined' && DB && DB.currentWorker) {
      safeRefreshWorkerUI(CUR_WORKER.id, DB.currentWorker.bizId);
    } else if (typeof CUR !== 'undefined' && CUR && CUR.id && typeof DB !== 'undefined' && DB && DB.currentBiz) {
      safeRefreshBizUI(CUR.id);
    }
  }
});

function connectRealtimeForCurrentUser() {
  if (typeof CUR_WORKER !== 'undefined' && CUR_WORKER && DB && DB.currentWorker) {
    subscribeWorkerRealtime(CUR_WORKER.id, DB.currentWorker.bizId);
    startSmartPolling(CUR_WORKER.id, DB.currentWorker.bizId);
    requestNotificationPermission();
    return;
  }
  if (typeof CUR !== 'undefined' && CUR && CUR.id && DB && DB.currentBiz) {
    subscribeBizRealtime(CUR.id);
    startSmartPolling(null, CUR.id);
    requestNotificationPermission();
    return;
  }
}

window.addEventListener('load', function () { setTimeout(connectRealtimeForCurrentUser, 1500); });
window.addEventListener('beforeunload', function () { unsubscribeRealtime(); });

window.initSupabaseRealtime = initSupabaseRealtime;
window.subscribeWorkerRealtime = subscribeWorkerRealtime;
window.subscribeBizRealtime = subscribeBizRealtime;
window.unsubscribeRealtime = unsubscribeRealtime;
window.connectRealtimeForCurrentUser = connectRealtimeForCurrentUser;
window.requestNotificationPermission = requestNotificationPermission;
window.subscribeClientRealtime = subscribeClientRealtime;
window.safeRefreshClientUI = safeRefreshClientUI;