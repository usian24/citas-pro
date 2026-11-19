'use strict';

/* ══════════════════════════════════════════════════
   CLIENTS-CRM.JS — CRM de Clientes, Recordatorios WhatsApp,
   Cumpleaños, Reseñas Google y Exportación CSV
   Estilo Apple limpio · Sin emojis · Sin cards anidadas · Supabase real
══════════════════════════════════════════════════ */

window.CRM_STATE = {
  loading: false,
  subtab: 'lista', // 'lista' | 'cumples' | 'resenas' | 'plantillas'
  filterMode: 'all', // 'all' | 'reward' | '15' | '30' | '45'
  search: '',
  clients: [],
  posConfig: {},
  loyalty: null,
  editingClient: null,
  waQueue: [], // array of client ids
  waQueueIdx: 0,
  waQueueTemplate: ''
};

function _cSvg(name, size) {
  var s = size || 15;
  var icons = {
    users: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    gift: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
    star: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    sliders: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    search: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    send: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    download: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    plus: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
  };
  return icons[name] || '';
}

function _cNorm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function _cDaysSince(iso) {
  if (!iso) return null;
  var t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function _cHoursSince(iso) {
  if (!iso) return null;
  var t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 3600000));
}

function _cNextBirthday(bd) {
  if (!bd) return null;
  var p = String(bd).split('-');
  if (p.length < 3) return null;
  var mo = parseInt(p[1], 10) - 1;
  var da = parseInt(p[2], 10);
  if (isNaN(mo) || isNaN(da)) return null;
  var now = new Date();
  var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var next = new Date(now.getFullYear(), mo, da);
  if (next < today0) next = new Date(now.getFullYear() + 1, mo, da);
  return {
    days: Math.round((next - today0) / 86400000),
    day: da,
    month: mo + 1
  };
}

function _cLoyaltyCfg() {
  var raw = CRM_STATE.loyalty || (CUR && CUR.loyalty) || null;
  if (typeof normalizeLoyaltyConfig === 'function') return normalizeLoyaltyConfig(raw);
  return { active: false, mode: 'stamps', stamps: 10, points_goal: 100, goal: 10, unit: 'sellos', reward_type: 'free_service', reward_pct: 100, reward_label: 'Servicio gratis' };
}

function _cCrmCfg() {
  var c = (CRM_STATE.posConfig && CRM_STATE.posConfig.crm) || {};
  return {
    review_url: c.review_url || '',
    msg_inactive: c.msg_inactive || 'Hola {nombre}, hace tiempo que no te vemos por {negocio}. Llevas {puntos}/{meta} {unidad} en tu tarjeta ({faltan} para tu premio). Te esperamos pronto.',
    msg_birthday: c.msg_birthday || 'Feliz cumpleaños {nombre}. Desde {negocio} te deseamos un gran día y te esperamos para celebrarlo.',
    msg_review: c.msg_review || 'Hola {nombre}, gracias por visitarnos en {negocio}. Si quedaste satisfecho, nos ayudaría mucho tu reseña aquí: {enlace}',
    msg_reward: c.msg_reward || 'Hola {nombre}, enhorabuena. Ya completaste tu tarjeta en {negocio} ({puntos}/{meta} {unidad}) y tienes listo tu premio: {premio}. Te esperamos para canjearlo.'
  };
}

function _cBuildWaUrl(client, template) {
  var cfg = _cCrmCfg();
  var loy = _cLoyaltyCfg();
  var pts = Math.max(0, parseInt(client.points, 10) || 0);
  var faltan = Math.max(0, loy.goal - pts);
  var text = String(template || '')
    .replace(/\{nombre\}/g, client.name || '')
    .replace(/\{negocio\}/g, (CUR && CUR.name) || '')
    .replace(/\{puntos\}/g, String(pts))
    .replace(/\{meta\}/g, String(loy.goal))
    .replace(/\{faltan\}/g, String(faltan))
    .replace(/\{unidad\}/g, loy.unit)
    .replace(/\{premio\}/g, loy.reward_label)
    .replace(/\{enlace\}/g, cfg.review_url || '');
  if (typeof buildWhatsAppUrl === 'function') {
    return buildWhatsAppUrl(client.phone, text, CUR && CUR.country);
  }
  var tel = String(client.phone || '').replace(/\D/g, '');
  return 'https://wa.me/' + tel + '?text=' + encodeURIComponent(text);
}

/* ── Carga CRM desde Supabase ── */
async function crmLoadClients() {
  if (!CUR || !CUR.id) return;
  CRM_STATE.loading = true;
  try {
    var res = await fetch('/api/pos/clients?business_id=' + encodeURIComponent(CUR.id), { cache: 'no-store' });
    if (!res.ok) throw new Error('Error cargando clientes');
    var data = await res.json();
    CRM_STATE.clients = data.clients || [];
    CRM_STATE.posConfig = data.posConfig || {};
    CRM_STATE.loyalty = data.loyalty || (typeof normalizeLoyaltyConfig === 'function' ? normalizeLoyaltyConfig(CUR.loyalty) : null);
  } catch (e) {
    console.error('[CRM] Error:', e);
    toast('No se pudo cargar la cartera de clientes', '#EF4444');
  } finally {
    CRM_STATE.loading = false;
  }
}

async function initBizClientsCrm() {
  if (!CUR || !CUR.id) return;
  var root = G('crm-root');
  if (root && !CRM_STATE.clients.length) {
    root.innerHTML = '<div class="pos-surface pos-surface-pad" style="text-align:center;color:var(--t2);font-size:13px">Cargando clientes...</div>';
  }
  await crmLoadClients();
  crmRender();
}

function crmSwitchTab(tab) {
  CRM_STATE.subtab = tab;
  CRM_STATE.waQueue = [];
  CRM_STATE.waQueueIdx = 0;
  crmRender();
}

function crmRender() {
  var root = G('crm-root');
  if (!root || !CUR) return;
  var total = CRM_STATE.clients.length;

  var html = ''
    + '<div class="pos-header">'
    + '  <div class="pos-title-group">'
    + '    <div class="pos-title">Clientes</div>'
    + '    <div class="pos-subtitle">' + total + ' cliente' + (total === 1 ? '' : 's') + ' registrado' + (total === 1 ? '' : 's') + ' en ' + san(CUR.name || '') + '</div>'
    + '  </div>'
    + '  <div class="pos-header-actions">'
    + '    <button type="button" class="pos-btn secondary sm" onclick="crmExportCsv()">' + _cSvg('download', 14) + ' CSV</button>'
    + '    <button type="button" class="pos-btn primary sm" onclick="crmOpenClientModal()">' + _cSvg('plus', 14) + ' Cliente</button>'
    + '  </div>'
    + '</div>';

  var tabs = [
    { id: 'lista', label: 'Cartera e inactivos', icon: 'users' },
    { id: 'cumples', label: 'Cumpleaños', icon: 'gift' },
    { id: 'resenas', label: 'Reseñas Google', icon: 'star' },
    { id: 'plantillas', label: 'Plantillas', icon: 'sliders' }
  ];

  html += '<div class="pos-seg">';
  tabs.forEach(function (t) {
    html += '<button type="button" class="pos-seg-btn' + (CRM_STATE.subtab === t.id ? ' active' : '') + '" onclick="crmSwitchTab(\'' + t.id + '\')">'
      + _cSvg(t.icon, 14) + '<span>' + t.label + '</span></button>';
  });
  html += '</div>';

  if (CRM_STATE.subtab === 'lista') html += _cRenderLista();
  else if (CRM_STATE.subtab === 'cumples') html += _cRenderCumples();
  else if (CRM_STATE.subtab === 'resenas') html += _cRenderResenas();
  else html += _cRenderPlantillas();

  root.innerHTML = html;
}

/* ── SUBTAB 1: CARTERA E INACTIVOS + PREMIO LISTO + COLA WHATSAPP ── */
function _cGetFilteredList() {
  var q = _cNorm(CRM_STATE.search);
  var mode = CRM_STATE.filterMode || 'all';
  var loy = _cLoyaltyCfg();
  var minDays = (mode === '15' || mode === '30' || mode === '45') ? parseInt(mode, 10) : 0;

  return CRM_STATE.clients.filter(function (c) {
    if (q) {
      var hit = _cNorm(c.name).indexOf(q) >= 0 || _cNorm(c.phone).indexOf(q) >= 0 || _cNorm(c.email).indexOf(q) >= 0;
      if (!hit) return false;
    }
    if (mode === 'reward') {
      if (!loy.active || (parseInt(c.points, 10) || 0) < loy.goal) return false;
    } else if (minDays > 0) {
      var d = _cDaysSince(c.last_visit_at || c.created_at);
      if (d === null || d < minDays) return false;
      var remDays = _cDaysSince(c.last_reminder_at);
      if (remDays !== null && remDays < minDays) return false;
    }
    return true;
  }).sort(function (a, b) {
    if (mode === 'reward') return (b.points || 0) - (a.points || 0);
    if (minDays > 0) {
      var da = _cDaysSince(a.last_visit_at || a.created_at) || 0;
      var db = _cDaysSince(b.last_visit_at || b.created_at) || 0;
      return db - da;
    }
    return String(a.name || '').localeCompare(String(b.name || ''), 'es');
  });
}

function _cRenderLista() {
  var cfg = _cCrmCfg();
  var loy = _cLoyaltyCfg();
  var filtered = _cGetFilteredList();
  var rewardReadyCount = loy.active ? CRM_STATE.clients.filter(function (c) { return (parseInt(c.points, 10) || 0) >= loy.goal; }).length : 0;

  var html = '<div class="pos-input-bar"><div class="pos-input-wrap">'
    + _cSvg('search', 16)
    + '<input class="inp" type="search" placeholder="Buscar por nombre, teléfono o email..." value="' + san(CRM_STATE.search) + '" oninput="CRM_STATE.search=this.value;crmRenderListOnly()" autocomplete="off"/>'
    + '</div></div>';

  var chips = [['all', 'Todos']];
  if (loy.active) chips.push(['reward', 'Con premio listo' + (rewardReadyCount > 0 ? ' (' + rewardReadyCount + ')' : '')]);
  chips.push(['15', '+15 días'], ['30', '+30 días'], ['45', '+45 días']);

  html += '<div class="fin-period-row">'
    + chips.map(function (o) {
        return '<button type="button" class="pos-quick-chip' + (CRM_STATE.filterMode === o[0] ? ' active' : '') + '" onclick="CRM_STATE.filterMode=\'' + o[0] + '\';CRM_STATE.waQueue=[];crmRender()">' + o[1] + '</button>';
      }).join('')
    + '</div>';

  // Cola asistida de envío 1 a 1 por WhatsApp (cuando hay filtro activo de inactivos o premio listo)
  var withPhone = filtered.filter(function (c) { return Boolean(String(c.phone || '').replace(/\D/g, '')); });
  if (CRM_STATE.waQueue.length > 0 && CRM_STATE.waQueueIdx < CRM_STATE.waQueue.length) {
    var curId = CRM_STATE.waQueue[CRM_STATE.waQueueIdx];
    var curCl = CRM_STATE.clients.find(function (x) { return x.id === curId; });
    if (curCl) {
      var waHref = _cBuildWaUrl(curCl, CRM_STATE.waQueueTemplate);
      html += '<div class="pos-banner info" style="flex-wrap:wrap">'
        + '<div class="pos-banner-left" style="flex:1;min-width:180px">'
        + '  <span><strong>Envío asistido (' + (CRM_STATE.waQueueIdx + 1) + ' de ' + CRM_STATE.waQueue.length + '):</strong> ' + san(curCl.name) + ' · ' + san(curCl.phone) + '</span>'
        + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
        + '  <a class="pos-btn primary sm" href="' + waHref + '" target="_blank" rel="noopener noreferrer" onclick="crmAdvanceWaQueue(true)">' + _cSvg('send', 12) + ' Abrir WhatsApp</a>'
        + '  <button type="button" class="pos-btn secondary sm" onclick="crmAdvanceWaQueue(false)">Saltar</button>'
        + '  <button type="button" class="pos-btn danger-ghost" onclick="crmStopWaQueue()">Terminar</button>'
        + '</div></div>';
    }
  } else if (CRM_STATE.filterMode !== 'all' && withPhone.length > 0) {
    var qLabel = CRM_STATE.filterMode === 'reward'
      ? ('Avisar de premio listo uno a uno (' + withPhone.length + ')')
      : ('Enviar recordatorio uno a uno (' + withPhone.length + ')');
    html += '<div class="pos-banner info">'
      + '<div class="pos-banner-left"><span>' + withPhone.length + ' cliente' + (withPhone.length === 1 ? '' : 's') + ' con WhatsApp en este filtro.</span></div>'
      + '<button type="button" class="pos-btn primary sm" onclick="crmStartWaQueue()">' + _cSvg('send', 12) + ' ' + qLabel + '</button>'
      + '</div>';
  }

  html += '<div id="crm-list-container">' + _cBuildClientRowsHtml(filtered, cfg) + '</div>';
  return html;
}

function _cBuildClientRowsHtml(list, cfg) {
  var loy = _cLoyaltyCfg();
  var mode = CRM_STATE.filterMode || 'all';
  if (!list.length) {
    var emptyMsg = mode === 'reward'
      ? 'Todavía ningún cliente ha completado su tarjeta (' + loy.goal + ' ' + loy.unit + ').'
      : ((mode === '15' || mode === '30' || mode === '45')
        ? ('No hay clientes pendientes de recordar con +' + mode + ' días sin venir.')
        : 'No se encontraron clientes.');
    return '<div class="pos-surface pos-surface-pad" style="text-align:center;color:var(--t2);font-size:13px">' + emptyMsg + '</div>';
  }
  var tpl = mode === 'reward' ? cfg.msg_reward : cfg.msg_inactive;
  return '<div class="pos-surface">' + list.map(function (c) {
    var d = _cDaysSince(c.last_visit_at || c.created_at);
    var remD = _cDaysSince(c.last_reminder_at);
    var pts = Math.max(0, parseInt(c.points, 10) || 0);
    var hasReward = loy.active && pts >= loy.goal;
    var subParts = [];
    if (c.phone) subParts.push(san(c.phone));
    if (loy.active) subParts.push(pts + '/' + loy.goal + ' ' + san(loy.unit));
    if (d !== null) subParts.push(d === 0 ? 'Vino hoy' : ('Hace ' + d + ' día' + (d === 1 ? '' : 's')));
    if (c.visits > 0) subParts.push(c.visits + ' visita' + (c.visits === 1 ? '' : 's'));
    if (c.total_spent > 0) subParts.push(money(c.total_spent));
    if (remD !== null) subParts.push('Recordado hace ' + remD + ' d');

    var hasPhone = Boolean(String(c.phone || '').replace(/\D/g, ''));
    return '<div class="pos-row">'
      + '<div class="pos-row-main clickable" onclick="crmOpenClientModal(\'' + san(c.id) + '\')">'
      + '  <div class="pos-row-title">' + san(c.name) + (hasReward ? ' <span class="pos-badge open" style="margin-left:6px;vertical-align:middle">Premio listo</span>' : '') + '</div>'
      + '  <div class="pos-row-sub">' + (subParts.join(' · ') || 'Sin visitas registradas') + '</div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
      + '  <button type="button" class="pos-btn secondary sm" onclick="crmOpenClientModal(\'' + san(c.id) + '\')">Ficha</button>'
      + (hasPhone ? '<a class="pos-btn primary sm" href="' + _cBuildWaUrl(c, hasReward ? cfg.msg_reward : tpl) + '" target="_blank" rel="noopener noreferrer" onclick="crmMarkReminded(\'' + san(c.id) + '\')">' + _cSvg('send', 12) + ' WhatsApp</a>' : '')
      + '</div></div>';
  }).join('') + '</div>';
}

function crmRenderListOnly() {
  var el = G('crm-list-container');
  if (!el) return;
  el.innerHTML = _cBuildClientRowsHtml(_cGetFilteredList(), _cCrmCfg());
}

function crmStartWaQueue() {
  var cfg = _cCrmCfg();
  var list = _cGetFilteredList().filter(function (c) { return Boolean(String(c.phone || '').replace(/\D/g, '')); });
  if (!list.length) { toast('No hay clientes con teléfono en este filtro', '#F59E0B'); return; }
  CRM_STATE.waQueue = list.map(function (c) { return c.id; });
  CRM_STATE.waQueueIdx = 0;
  CRM_STATE.waQueueTemplate = CRM_STATE.filterMode === 'reward' ? cfg.msg_reward : cfg.msg_inactive;
  crmRender();
}

function crmAdvanceWaQueue(markSent) {
  var cid = CRM_STATE.waQueue[CRM_STATE.waQueueIdx];
  if (markSent && cid) {
    crmMarkReminded(cid, true);
  }
  CRM_STATE.waQueueIdx += 1;
  if (CRM_STATE.waQueueIdx >= CRM_STATE.waQueue.length) {
    var totalSent = CRM_STATE.waQueue.length;
    CRM_STATE.waQueue = [];
    CRM_STATE.waQueueIdx = 0;
    toast('Cola finalizada (' + totalSent + ' cliente' + (totalSent === 1 ? '' : 's') + ')', '#22C55E');
  }
  setTimeout(function () { crmRender(); }, 250);
}

function crmStopWaQueue() {
  CRM_STATE.waQueue = [];
  CRM_STATE.waQueueIdx = 0;
  crmRender();
}

/* ── SUBTAB 2: CUMPLEAÑOS (PRÓXIMOS 7 DÍAS) ── */
function _cRenderCumples() {
  var cfg = _cCrmCfg();
  var upcoming = CRM_STATE.clients.map(function (c) {
    return { client: c, bd: _cNextBirthday(c.birthday) };
  }).filter(function (x) {
    return x.bd && x.bd.days <= 7;
  }).sort(function (a, b) {
    return a.bd.days - b.bd.days;
  });

  var html = '<div class="pos-sec-label">Cumpleaños en los próximos 7 días (' + upcoming.length + ')</div><div class="pos-surface">';
  if (!upcoming.length) {
    html += '<div class="pos-row"><span class="pos-row-sub">Ningún cliente cumple años esta semana. Puedes añadir su fecha de cumpleaños al editar su ficha.</span></div>';
  } else {
    upcoming.forEach(function (x) {
      var c = x.client;
      var when = x.bd.days === 0 ? 'Hoy' : (x.bd.days === 1 ? 'Mañana' : 'En ' + x.bd.days + ' días');
      var hasPhone = Boolean(String(c.phone || '').replace(/\D/g, ''));
      html += '<div class="pos-row">'
        + '<div class="pos-row-main"><div class="pos-row-title">' + san(c.name) + '</div><div class="pos-row-sub">' + when + ' · ' + String(x.bd.day).padStart(2, '0') + '/' + String(x.bd.month).padStart(2, '0') + (c.phone ? ' · ' + san(c.phone) : '') + '</div></div>'
        + (hasPhone ? '<a class="pos-btn primary sm" href="' + _cBuildWaUrl(c, cfg.msg_birthday) + '" target="_blank" rel="noopener noreferrer">' + _cSvg('send', 12) + ' Felicitar</a>' : '<span class="pos-row-sub">Sin teléfono</span>')
        + '</div>';
    });
  }
  html += '</div>';
  return html;
}

/* ── SUBTAB 3: RESEÑAS EN GOOGLE (ÚLTIMAS 48H) ── */
function _cRenderResenas() {
  var cfg = _cCrmCfg();
  if (!cfg.review_url) {
    return '<div class="pos-surface pos-surface-pad">'
      + '<div style="font-size:14px;font-weight:700;margin-bottom:4px">Configura tu enlace de reseñas de Google</div>'
      + '<div style="font-size:13px;color:var(--t2);margin-bottom:14px">Añade el link directo de tu perfil de Google Business en Plantillas para pedir reseñas por WhatsApp a tus clientes recientes.</div>'
      + '<button type="button" class="pos-btn primary sm" onclick="crmSwitchTab(\'plantillas\')">Configurar enlace</button>'
      + '</div>';
  }

  var recent = CRM_STATE.clients.filter(function (c) {
    var hrs = _cHoursSince(c.last_visit_at);
    return hrs !== null && hrs <= 48 && Boolean(String(c.phone || '').replace(/\D/g, ''));
  });

  var html = '<div class="pos-sec-label">Clientes atendidos en las últimas 48 horas (' + recent.length + ')</div><div class="pos-surface">';
  if (!recent.length) {
    html += '<div class="pos-row"><span class="pos-row-sub">No hay clientes con visita registrada en las últimas 48 horas.</span></div>';
  } else {
    recent.forEach(function (c) {
      var hrs = _cHoursSince(c.last_visit_at);
      html += '<div class="pos-row">'
        + '<div class="pos-row-main"><div class="pos-row-title">' + san(c.name) + '</div><div class="pos-row-sub">Vino hace ' + (hrs === 0 ? 'menos de 1 h' : hrs + ' h') + ' · ' + san(c.phone) + '</div></div>'
        + '<a class="pos-btn primary sm" href="' + _cBuildWaUrl(c, cfg.msg_review) + '" target="_blank" rel="noopener noreferrer">' + _cSvg('star', 12) + ' Pedir reseña</a>'
        + '</div>';
    });
  }
  html += '</div>';
  return html;
}

/* ── SUBTAB 4: PLANTILLAS WHATSAPP Y GOOGLE ── */
function _cRenderPlantillas() {
  var cfg = _cCrmCfg();
  return '<div class="pos-sec-label">Enlace y mensajes de WhatsApp</div>'
    + '<div class="pos-surface pos-surface-pad">'
    + '  <div class="field"><label for="crm-tpl-url">Enlace de reseñas de Google</label><input class="inp" id="crm-tpl-url" type="url" placeholder="https://g.page/r/..." value="' + san(cfg.review_url) + '"/></div>'
    + '  <div class="field"><label for="crm-tpl-inact">Recordatorio a clientes inactivos</label><textarea class="inp" id="crm-tpl-inact" rows="3">' + san(cfg.msg_inactive) + '</textarea><div style="font-size:11px;color:var(--t2);margin-top:4px">Variables: {nombre}, {negocio}, {puntos}, {meta}, {faltan}, {unidad}, {premio}</div></div>'
    + '  <div class="field"><label for="crm-tpl-rew">Aviso de premio listo (tarjeta completada)</label><textarea class="inp" id="crm-tpl-rew" rows="3">' + san(cfg.msg_reward) + '</textarea><div style="font-size:11px;color:var(--t2);margin-top:4px">Variables: {nombre}, {negocio}, {puntos}, {meta}, {unidad}, {premio}</div></div>'
    + '  <div class="field"><label for="crm-tpl-bd">Mensaje de cumpleaños</label><textarea class="inp" id="crm-tpl-bd" rows="3">' + san(cfg.msg_birthday) + '</textarea></div>'
    + '  <div class="field"><label for="crm-tpl-rev">Mensaje para pedir reseña en Google</label><textarea class="inp" id="crm-tpl-rev" rows="3">' + san(cfg.msg_review) + '</textarea><div style="font-size:11px;color:var(--t2);margin-top:4px">Variables: {nombre}, {negocio}, {enlace}</div></div>'
    + '  <button type="button" class="pos-btn primary full" id="crm-tpl-save-btn" onclick="crmSaveTemplates()">Guardar plantillas</button>'
    + '</div>';
}

async function crmSaveTemplates() {
  if (!CUR || !CUR.id) return;
  var btn = G('crm-tpl-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    var nextCfg = Object.assign({}, CRM_STATE.posConfig || {}, {
      crm: {
        review_url: V('crm-tpl-url').trim(),
        msg_inactive: V('crm-tpl-inact').trim(),
        msg_reward: V('crm-tpl-rew').trim(),
        msg_birthday: V('crm-tpl-bd').trim(),
        msg_review: V('crm-tpl-rev').trim()
      }
    });
    var res = await fetch('/api/pos/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: CUR.id, pos_config: nextCfg })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Error guardando plantillas');
    CRM_STATE.posConfig = data.posConfig || nextCfg;
    toast('Plantillas guardadas', '#22C55E');
    crmRender();
  } catch (e) {
    toast(e.message || 'No se pudieron guardar', '#EF4444');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar plantillas'; }
  }
}

async function crmMarkReminded(clientId, skipRender) {
  if (!CUR || !CUR.id) return;
  var c = CRM_STATE.clients.find(function (x) { return x.id === clientId; });
  if (!c) return;
  c.last_reminder_at = new Date().toISOString();
  try {
    await fetch('/api/pos/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: CUR.id,
        client: {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          birthday: c.birthday,
          points: c.points,
          last_visit_at: c.last_visit_at,
          last_reminder_at: c.last_reminder_at
        }
      })
    });
  } catch (e) {}
  if (!skipRender) {
    setTimeout(function () { crmRender(); }, 600);
  }
}

/* ── MODAL CREAR / EDITAR CLIENTE + TARJETA + HISTORIAL ── */
function crmPreviewLoyaltyCard() {
  var box = G('crm-cl-loyalty-card');
  if (!box) return;
  var loy = _cLoyaltyCfg();
  if (!loy.active || typeof renderLoyaltyCardHtml !== 'function') {
    box.innerHTML = '';
    return;
  }
  var pts = Math.max(0, parseInt(V('crm-cl-pts'), 10) || 0);
  var name = V('crm-cl-name').trim() || (CRM_STATE.editingClient && CRM_STATE.editingClient.name) || 'Cliente';
  var phone = V('crm-cl-phone').trim() || (CRM_STATE.editingClient && CRM_STATE.editingClient.phone) || '';
  var cardHtml = renderLoyaltyCardHtml({
    loyalty: loy,
    points: pts,
    title: name + ' · ' + (loy.mode === 'points' ? 'Tarjeta de Puntos' : 'Tarjeta de Fidelidad')
  });
  var waBtn = '';
  if (phone && String(phone).replace(/\D/g, '')) {
    var cfg = _cCrmCfg();
    var mockCl = { name: name, phone: phone, points: pts };
    var tpl = pts >= loy.goal ? cfg.msg_reward : cfg.msg_inactive;
    waBtn = '<a class="pos-btn secondary sm full" href="' + _cBuildWaUrl(mockCl, tpl) + '" target="_blank" rel="noopener noreferrer" style="margin:-6px 0 14px">' + _cSvg('send', 13) + (pts >= loy.goal ? ' Avisar por WhatsApp que tiene premio listo' : ' Enviar estado de tarjeta por WhatsApp') + '</a>';
  }
  box.innerHTML = cardHtml + waBtn;
}

function crmOpenClientModal(clientId) {
  var cl = clientId ? CRM_STATE.clients.find(function (c) { return c.id === clientId; }) : null;
  CRM_STATE.editingClient = cl || null;
  var loy = _cLoyaltyCfg();

  if (G('crm-modal-title')) G('crm-modal-title').textContent = cl ? 'Ficha del cliente' : 'Nuevo cliente';
  if (G('crm-cl-name')) G('crm-cl-name').value = cl ? (cl.name || '') : '';
  if (G('crm-cl-phone')) G('crm-cl-phone').value = cl ? (cl.phone || '') : '';
  if (G('crm-cl-email')) G('crm-cl-email').value = cl ? (cl.email || '') : '';
  if (G('crm-cl-bd')) G('crm-cl-bd').value = cl ? (cl.birthday || '') : '';
  if (G('crm-cl-pts')) G('crm-cl-pts').value = cl ? (cl.points || 0) : 0;
  if (G('crm-cl-pts-lbl')) G('crm-cl-pts-lbl').textContent = loy.mode === 'points' ? 'Puntos' : 'Sellos';

  crmPreviewLoyaltyCard();

  var delBtn = G('crm-cl-delete-btn');
  if (delBtn) delBtn.style.display = (cl && !cl.from_appointments) ? 'inline-flex' : 'none';

  var histEl = G('crm-cl-history');
  if (histEl) {
    if (cl && cl.history && cl.history.length > 0) {
      histEl.innerHTML = '<div class="pos-sec-label" style="margin-top:16px">Historial de cobros (' + cl.history.length + ' · ' + money(cl.total_spent || 0) + ')</div>'
        + '<div class="pos-surface">'
        + cl.history.slice(0, 15).map(function (h) {
            return '<div class="pos-row"><div class="pos-row-main"><div class="pos-row-title">' + san(h.desc) + '</div><div class="pos-row-sub">' + san(h.date) + (h.worker ? ' · ' + san(h.worker) : '') + '</div></div><span class="pos-row-val">' + money(h.total) + '</span></div>';
          }).join('')
        + '</div>';
    } else {
      histEl.innerHTML = '';
    }
  }

  openOv('ov-crm-client');
}

async function crmSaveClient() {
  if (!CUR || !CUR.id) return;
  var name = V('crm-cl-name').trim();
  if (!name) { toast('Escribe el nombre del cliente', '#EF4444'); return; }

  var btn = G('crm-cl-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    var res = await fetch('/api/pos/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: CUR.id,
        client: {
          id: CRM_STATE.editingClient ? CRM_STATE.editingClient.id : undefined,
          name: name,
          phone: V('crm-cl-phone').trim(),
          email: V('crm-cl-email').trim(),
          birthday: V('crm-cl-bd') || null,
          points: parseInt(V('crm-cl-pts'), 10) || 0,
          last_visit_at: CRM_STATE.editingClient ? CRM_STATE.editingClient.last_visit_at : undefined
        }
      })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo guardar');
    closeOv('ov-crm-client');
    await crmLoadClients();
    toast('Cliente guardado', '#22C55E');
    crmRender();
  } catch (e) {
    toast(e.message || 'Error guardando cliente', '#EF4444');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cliente'; }
  }
}

function crmDeleteCurrentClient() {
  if (!CRM_STATE.editingClient || !CUR || !CUR.id) return;
  var cid = CRM_STATE.editingClient.id;
  openConfirmModal('Eliminar cliente', 'Se eliminará este cliente de la cartera (sus cobros históricos se conservan).', async function () {
    try {
      var res = await fetch('/api/pos/client-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: CUR.id, client_id: cid })
      });
      var data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error eliminando');
      closeOv('ov-crm-client');
      await crmLoadClients();
      toast('Cliente eliminado', '#475569');
      crmRender();
    } catch (e) {
      toast(e.message || 'No se pudo eliminar', '#EF4444');
    }
  });
}

/* ── EXPORTACIÓN CSV NATIVA (Excel UTF-8 BOM) ── */
function _csvCell(v) {
  var s = String(v == null ? '' : v);
  if (/^[=@]|^[+-][^0-9,.]/.test(s)) s = "'" + s;
  return /[";,\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function _downloadCsv(filename, rows) {
  var txt = '\uFEFF' + rows.map(function (r) { return r.map(_csvCell).join(';'); }).join('\r\n');
  var blob = new Blob([txt], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
window.posDownloadCsv = _downloadCsv;

function crmExportCsv() {
  var rows = [['Nombre', 'Teléfono', 'Email', 'Cumpleaños', 'Visitas', 'Total gastado', 'Puntos', 'Última visita']];
  CRM_STATE.clients.forEach(function (c) {
    rows.push([
      c.name || '',
      c.phone || '',
      c.email || '',
      c.birthday || '',
      c.visits || 0,
      c.total_spent || 0,
      c.points || 0,
      c.last_visit_at ? String(c.last_visit_at).slice(0, 10) : ''
    ]);
  });
  var slug = String((CUR && CUR.name) || 'citaspro').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  _downloadCsv('clientes-' + slug + '.csv', rows);
  toast('CSV de clientes descargado', '#22C55E');
}

window.initBizClientsCrm = initBizClientsCrm;
window.crmSwitchTab = crmSwitchTab;
window.crmRender = crmRender;
window.crmRenderListOnly = crmRenderListOnly;
window.crmStartWaQueue = crmStartWaQueue;
window.crmAdvanceWaQueue = crmAdvanceWaQueue;
window.crmStopWaQueue = crmStopWaQueue;
window.crmPreviewLoyaltyCard = crmPreviewLoyaltyCard;
window.crmOpenClientModal = crmOpenClientModal;
window.crmSaveClient = crmSaveClient;
window.crmDeleteCurrentClient = crmDeleteCurrentClient;
window.crmSaveTemplates = crmSaveTemplates;
window.crmMarkReminded = crmMarkReminded;
window.crmExportCsv = crmExportCsv;

