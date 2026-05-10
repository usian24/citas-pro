'use strict';

/* ══════════════════════════════════════════════════
   NOTIFICATIONS.JS
   Las notificaciones ahora se guardan en Supabase
   y se eliminan automáticamente después de 7 días.
══════════════════════════════════════════════════ */

/* ══════════════════════════
   CARGAR DESDE SUPABASE
══════════════════════════ */
async function loadWorkerNotificationsFromCloud(workerId) {
  if (!workerId) return [];
  try {
    var res = await fetch('/api/sync?worker_id=' + encodeURIComponent(workerId));
    if (!res.ok) return [];
    var data = await res.json();
    return (data || []).map(function (n) {
      return {
        id: n.id,
        type: n.type,
        msg: n.msg,
        data: { detail: n.detail || '' },
        read: n.read,
        date: n.created_at ? n.created_at : new Date().toISOString()
      };
    });
  } catch (e) {
    return [];
  }
}

/* ══════════════════════════
   GUARDAR EN SUPABASE
══════════════════════════ */
function saveNotificationToCloud(workerId, bizId, notif) {
  if (!workerId || !bizId) return;
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'notification',
      type_notif: notif.type || 'new_booking',
      worker_id: workerId,
      business_id: bizId,
      msg: notif.msg || notif.title || '',
      detail: (notif.data && notif.data.detail) ? notif.data.detail : (notif.detail || '')
    })
  }).catch(function (e) { console.error('Error guardando notif:', e); });
}

/* ══════════════════════════
   BADGE
══════════════════════════ */
function renderWorkerNotifBadge() {
  if (!CUR_WORKER) return;
  var notifs = (CUR_WORKER.notifications || []).filter(function (n) { return !n.read; });
  var badge = G('wk-notif-badge');
  if (badge) {
    badge.textContent = notifs.length > 0 ? (notifs.length > 9 ? '9+' : notifs.length) : '';
    badge.style.display = notifs.length > 0 ? 'flex' : 'none';
  }
  var tabBadge = G('wn-notif-badge');
  if (tabBadge) {
    tabBadge.style.display = notifs.length > 0 ? 'inline-flex' : 'none';
    tabBadge.textContent = notifs.length > 9 ? '9+' : notifs.length;
  }
}

/* ══════════════════════════
   RENDER — carga de Supabase si no hay locales
══════════════════════════ */
async function renderWorkerNotifications() {
  if (!CUR_WORKER) return;

  // Cargar desde Supabase siempre para tener las más recientes
  var cloud = await loadWorkerNotificationsFromCloud(CUR_WORKER.id);
  if (cloud.length > 0) {
    CUR_WORKER.notifications = cloud;
  }

  var notifs = CUR_WORKER.notifications || [];

  H('wk-notif-list', notifs.length
    ? notifs.map(function (n, i) { return notifCardH(n, i); }).join('')
    : '<div style="text-align:center;padding:40px;color:var(--muted)">'
    + '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:.4"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
    + '<div style="font-size:14px">Sin notificaciones</div></div>');
}

function notifCardH(n, i) {
  var iconMap = {
    new_booking: { icon: notifIconBooking(), color: '#22C55E' },
    booking_cancel: { icon: notifIconCancel(), color: '#EF4444' },
    booking_modify: { icon: notifIconEdit(), color: '#F59E0B' },
    system: { icon: notifIconInfo(), color: '#4A7FD4' }
  };
  var style = iconMap[n.type] || iconMap.system;
  var dateStr = '';
  try {
    var d = new Date(n.date);
    dateStr = d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  } catch (e) { }

  return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:12px' + (n.read ? '' : ';border-left:3px solid ' + style.color) + '">'
    + '<div style="width:40px;height:40px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + style.color + '18;color:' + style.color + '">'
    + style.icon + '</div>'
    + '<div style="flex:1">'
    + '<div style="font-size:13px;font-weight:' + (n.read ? '500' : '700') + ';margin-bottom:4px">' + san(n.msg) + '</div>'
    + (n.data && n.data.detail ? '<div style="font-size:12px;color:var(--t2);margin-bottom:4px">' + san(n.data.detail) + '</div>' : '')
    + '<div style="font-size:11px;color:var(--muted)">' + dateStr + '</div>'
    + (!n.read ? '<div style="text-align:right;margin-top:8px"><button onclick="markWorkerNotifRead(' + i + ')" style="background:var(--bblue);border:none;color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:12px">Marcar como leída</button></div>' : '')
    + '</div></div>';
}

function notifIconBooking() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>';
}
function notifIconCancel() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="14" x2="15" y2="20"/><line x1="15" y1="14" x2="9" y2="20"/></svg>';
}
function notifIconEdit() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
}
function notifIconInfo() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
}

/* ══════════════════════════
   NOTIFICACIÓN MANUAL
══════════════════════════ */
function notifyWorker(bizId, workerId, type, msg, data) {
  addNotificationToWorker(bizId, workerId, { type: type, msg: msg, data: data || {} });
  if (CUR_WORKER && CUR_WORKER.id === workerId) {
    renderWorkerNotifBadge();
  }
}

/* ══════════════════════════
   LIMPIAR
══════════════════════════ */
function clearWorkerNotifications() {
  if (!CUR_WORKER) return;
  openConfirmModal(
    'Limpiar notificaciones',
    '¿Eliminar todas las notificaciones?',
    function () {
      CUR_WORKER.notifications = [];
      saveDB();
      renderWorkerNotifications();
      renderWorkerNotifBadge();
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clear_notifications', worker_id: CUR_WORKER.id })
      }).catch(function (e) { });
      toast('Notificaciones eliminadas', '#475569');
    }
  );
}

function autoClearWorkerNotifications() {
  if (!CUR_WORKER || !CUR_WORKER.notifications || CUR_WORKER.notifications.length === 0) return;
  
  CUR_WORKER.notifications = [];
  saveDB();
  renderWorkerNotifBadge();
  
  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'clear_notifications', worker_id: CUR_WORKER.id })
  }).catch(function (e) { });
}

window.saveNotificationToCloud = saveNotificationToCloud;
window.loadWorkerNotificationsFromCloud = loadWorkerNotificationsFromCloud;
window.autoClearWorkerNotifications = autoClearWorkerNotifications;