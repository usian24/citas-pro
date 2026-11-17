'use strict';

/* ══════════════════════════════════════════════════
   POS.JS — Caja, Apertura/Cierre, Escáner HID, Servicios Generales y PIN
   Estilo Apple limpio · Sin emojis · Sin cards anidadas · Supabase real (/api/pos/*)
══════════════════════════════════════════════════ */

window.POS_STATE = {
  loaded: false,
  loading: false,
  bizId: null,
  date: '',
  subtab: 'cobrar', // 'cobrar' | 'cierre' | 'servicios' | 'ajustes'
  pinUnlocked: false,
  pinPendingAction: null,
  hasCustomPin: false,
  register: null,
  pendingRegisters: [],
  recentRegisters: [],
  sales: [],
  products: [],
  generalServices: [],
  clients: [],
  posConfig: {
    low_stock_alert: 5,
    close_reminder_time: '21:00',
    payment_methods: [
      { name: 'Efectivo', key: 'cash' },
      { name: 'Tarjeta', key: 'card' },
      { name: 'Transferencia', key: 'transfer' }
    ]
  },
  // Estado del cobro actual
  cart: {
    step: 1, // 1: cliente, 2: productos, 3: servicios, 4: profesional, 5: pago, 6: exito
    appointmentId: null,
    client: null, // { id, name, phone, email }
    clientSearch: '',
    newClientName: '',
    newClientPhone: '',
    products: {}, // { prodId: qty }
    prodSearch: '',
    services: {}, // { key: { id, name, price, qty, isGeneral } }
    workerId: null,
    workerName: '',
    discountManual: 0,
    tip: 0,
    paymentMethod: 'Efectivo',
    lastSale: null
  },
  // Estado de cierre/apertura
  closingDate: null,
  closingBy: '',
  closingCounted: '',
  openingBy: '',
  openingCash: '',
  editingGeneralSvcId: null
};

/* ── Iconos SVG minimalistas (sin emojis) ── */
function _pSvg(name, size) {
  var s = size || 16;
  var icons = {
    card: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    cash: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
    transfer: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    lock: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    unlock: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
    search: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    barcode: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>',
    box: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    scissors: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
    user: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    check: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alert: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    back: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    plus: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    sliders: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    clock: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    send: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
  };
  return icons[name] || '';
}

function _pToday() {
  if (typeof hoyEnNegocio === 'function' && CUR && CUR.country) {
    return hoyEnNegocio(CUR.country);
  }
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _pNorm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function _pFormatDate(isoDate) {
  if (!isoDate) return '—';
  var parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function _pFirstImg(imgField) {
  if (!imgField) return '';
  var s = String(imgField).trim();
  if (s.startsWith('[')) {
    try {
      var arr = JSON.parse(s);
      if (Array.isArray(arr) && arr[0]) return sanitizeImageDataURL(arr[0]);
    } catch (e) {}
  }
  return sanitizeImageDataURL(s);
}

function _pBeep(ok) {
  try {
    var AC = window._posAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    window._posAudioCtx = AC;
    if (AC.state === 'suspended') AC.resume();
    var osc = AC.createOscillator();
    var gain = AC.createGain();
    osc.type = 'sine';
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(AC.destination);
    osc.start();
    osc.stop(AC.currentTime + (ok ? 0.08 : 0.2));
  } catch (e) {}
}

/* ── Reset de carrito ── */
function posResetCart() {
  var methods = (POS_STATE.posConfig && POS_STATE.posConfig.payment_methods) || [];
  POS_STATE.cart = {
    step: 1,
    appointmentId: null,
    client: null,
    clientSearch: '',
    newClientName: '',
    newClientPhone: '',
    products: {},
    prodSearch: '',
    services: {},
    workerId: null,
    workerName: '',
    discountManual: 0,
    tip: 0,
    paymentMethod: methods[0] ? methods[0].name : 'Efectivo',
    lastSale: null
  };
}

/* ── Carga de estado desde Supabase (/api/pos/state) ── */
async function posLoadState(force) {
  if (!CUR || !CUR.id) return;
  if (POS_STATE.loading && !force) return;
  POS_STATE.loading = true;
  POS_STATE.bizId = CUR.id;
  POS_STATE.date = _pToday();

  try {
    var res = await fetch('/api/pos/state?business_id=' + encodeURIComponent(CUR.id) + '&date=' + encodeURIComponent(POS_STATE.date), {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('Error al cargar Caja');
    var data = await res.json();

    POS_STATE.register = data.register || null;
    POS_STATE.pendingRegisters = data.pendingRegisters || [];
    POS_STATE.recentRegisters = data.recentRegisters || [];
    POS_STATE.sales = data.sales || [];
    POS_STATE.products = data.products || [];
    POS_STATE.generalServices = data.generalServices || [];
    POS_STATE.clients = data.clients || [];
    POS_STATE.posConfig = data.posConfig || POS_STATE.posConfig;
    POS_STATE.hasCustomPin = Boolean(data.hasCustomPin);
    POS_STATE.loaded = true;

    // Mantener sincronizados productos y servicios generales con el resto de la app
    window._tiendaProducts = POS_STATE.products;
    if (CUR) {
      CUR.services = POS_STATE.generalServices.slice();
    }
  } catch (err) {
    console.error('[POS] Load error:', err);
    toast('No se pudo cargar el estado de Caja', '#EF4444');
  } finally {
    POS_STATE.loading = false;
  }
}

async function initPosPanel(skipReset) {
  if (!CUR || !CUR.id) return;
  if (POS_STATE.bizId !== CUR.id) {
    POS_STATE.pinUnlocked = false;
    POS_STATE.subtab = 'cobrar';
    posResetCart();
  } else if (!skipReset && POS_STATE.cart.step === 6) {
    posResetCart();
  }

  var root = G('pos-root');
  if (root && !POS_STATE.loaded) {
    root.innerHTML = '<div class="pos-surface pos-surface-pad" style="text-align:center;color:var(--t2);font-size:13px">Cargando Caja...</div>';
  }
  await posLoadState(true);
  posRender();
}

/* ── PIN del propietario (por defecto 12345) ── */
function posRequirePin(actionFn, customHint) {
  if (POS_STATE.pinUnlocked) {
    actionFn();
    return;
  }
  POS_STATE.pinPendingAction = actionFn;
  var hintEl = G('pos-pin-hint');
  if (hintEl) {
    hintEl.textContent = customHint || (POS_STATE.hasCustomPin
      ? 'Introduce el PIN de propietario para continuar.'
      : 'Introduce el PIN de propietario (por defecto: 12345).');
  }
  var inp = G('pos-pin-input');
  var err = G('pos-pin-err');
  if (inp) inp.value = '';
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  openOv('ov-pos-pin');
  setTimeout(function () { if (inp) inp.focus(); }, 180);
}

async function submitPosPin() {
  if (!CUR || !CUR.id) return;
  var pin = V('pos-pin-input').trim();
  var err = G('pos-pin-err');
  var btn = G('pos-pin-submit');

  if (!pin) {
    if (err) { err.textContent = 'Introduce el PIN.'; err.style.display = 'block'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
  try {
    var res = await fetch('/api/pos/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: CUR.id, pin: pin })
    });
    var data = await res.json();
    if (!res.ok || !data.success) {
      if (err) { err.textContent = data.error || 'PIN incorrecto'; err.style.display = 'block'; }
      if (G('pos-pin-input')) { G('pos-pin-input').value = ''; G('pos-pin-input').focus(); }
      return;
    }
    POS_STATE.pinUnlocked = true;
    closeOv('ov-pos-pin');
    var cb = POS_STATE.pinPendingAction;
    POS_STATE.pinPendingAction = null;
    if (typeof cb === 'function') cb();
    else posRender();
  } catch (e) {
    if (err) { err.textContent = 'Error de conexión'; err.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Continuar'; }
  }
}

function posToggleLock() {
  if (POS_STATE.pinUnlocked) {
    POS_STATE.pinUnlocked = false;
    if (POS_STATE.subtab === 'servicios' || POS_STATE.subtab === 'ajustes') {
      POS_STATE.subtab = 'cobrar';
    }
    toast('Modo protegido activado', '#4A7FD4');
    posRender();
  } else {
    posRequirePin(function () {
      toast('Acceso de propietario desbloqueado', '#22C55E');
      posRender();
    });
  }
}

function posSwitchTab(tab) {
  if (tab === 'servicios' || tab === 'ajustes') {
    posRequirePin(function () {
      POS_STATE.subtab = tab;
      posRender();
    });
    return;
  }
  POS_STATE.subtab = tab;
  if (tab === 'cierre') {
    POS_STATE.closingDate = null;
  }
  posRender();
}

/* ── Totales del carrito ── */
function posCalcTotals() {
  var c = POS_STATE.cart;
  var prodTot = 0;
  var svcTot = 0;

  Object.keys(c.products).forEach(function (pid) {
    var qty = c.products[pid] || 0;
    var p = POS_STATE.products.find(function (x) { return x.id === pid; });
    if (p && qty > 0) {
      var disc = parseFloat(p.discount_percent) || 0;
      var unit = disc > 0 ? p.price * (1 - disc / 100) : p.price;
      prodTot += unit * qty;
    }
  });

  Object.keys(c.services).forEach(function (k) {
    var s = c.services[k];
    if (s && s.qty > 0) {
      svcTot += (parseFloat(s.price) || 0) * s.qty;
    }
  });

  prodTot = Math.round(prodTot * 100) / 100;
  svcTot = Math.round(svcTot * 100) / 100;
  var gross = Math.round((prodTot + svcTot) * 100) / 100;
  var dm = Math.min(gross, Math.max(0, parseFloat(c.discountManual) || 0));
  var tip = Math.max(0, parseFloat(c.tip) || 0);
  var net = Math.max(0, Math.round((gross - dm) * 100) / 100);
  return { prodTot: prodTot, svcTot: svcTot, gross: gross, dm: dm, tip: tip, net: net };
}

function _pIsRegisterOpen() {
  return Boolean(POS_STATE.register && POS_STATE.register.status === 'open');
}

function _pStaffOptions() {
  var list = [];
  if (CUR && CUR.owner) {
    list.push({ id: '', name: CUR.owner, role: 'Propietario', photo: CUR.logo || '' });
  } else {
    list.push({ id: '', name: 'Propietario', role: 'Titular', photo: (CUR && CUR.logo) || '' });
  }
  (CUR && CUR.workers || []).forEach(function (w) {
    if (w.active !== false) {
      list.push({ id: w.id, name: w.name, role: w.spec || 'Profesional', photo: w.photo || '' });
    }
  });
  return list;
}

/* ══════════════════════════════════════════════════
   RENDER PRINCIPAL DE CAJA
══════════════════════════════════════════════════ */
function posRender() {
  var root = G('pos-root');
  if (!root || !CUR) return;

  var reg = POS_STATE.register;
  var hasPending = POS_STATE.pendingRegisters.length > 0;
  var statusDot = hasPending ? 'danger' : (_pIsRegisterOpen() ? 'open' : 'closed');
  var statusTxt = hasPending
    ? 'Cierre pendiente'
    : (_pIsRegisterOpen() ? 'Caja abierta' : (reg && reg.status === 'closed' ? 'Caja cerrada' : 'Sin abrir'));

  var html = ''
    + '<div class="pos-header">'
    + '  <div class="pos-title-group">'
    + '    <div class="pos-title">Caja</div>'
    + '    <div class="pos-subtitle">' + san(_pFormatDate(POS_STATE.date)) + ' · ' + san(CUR.name || '') + '</div>'
    + '  </div>'
    + '  <div class="pos-header-actions">'
    + '    <button type="button" class="pos-status-pill" onclick="posSwitchTab(\'cierre\')">'
    + '      <span class="pos-dot ' + statusDot + '"></span>'
    + '      <span>' + statusTxt + '</span>'
    + '    </button>'
    + '    <button type="button" class="pos-icon-btn' + (POS_STATE.pinUnlocked ? ' unlocked' : '') + '" title="' + (POS_STATE.pinUnlocked ? 'Bloquear con PIN' : 'Desbloquear con PIN') + '" onclick="posToggleLock()">'
    + _pSvg(POS_STATE.pinUnlocked ? 'unlock' : 'lock', 16)
    + '    </button>'
    + '  </div>'
    + '</div>';

  // Segmented control estilo Apple
  var tabs = [
    { id: 'cobrar', label: 'Cobrar', icon: 'card' },
    { id: 'cierre', label: 'Caja del día', icon: 'clock' },
    { id: 'servicios', label: 'Servicios generales', icon: 'scissors', locked: !POS_STATE.pinUnlocked },
    { id: 'ajustes', label: 'Ajustes', icon: 'sliders', locked: !POS_STATE.pinUnlocked }
  ];

  html += '<div class="pos-seg">';
  tabs.forEach(function (t) {
    html += '<button type="button" class="pos-seg-btn' + (POS_STATE.subtab === t.id ? ' active' : '') + '" onclick="posSwitchTab(\'' + t.id + '\')">'
      + _pSvg(t.icon, 14)
      + '<span>' + t.label + '</span>'
      + (t.locked ? '<span style="opacity:.55;display:inline-flex">' + _pSvg('lock', 11) + '</span>' : '')
      + '</button>';
  });
  html += '</div>';

  // Aviso de caja pendiente de días anteriores
  if (hasPending) {
    var oldReg = POS_STATE.pendingRegisters[0];
    html += '<div class="pos-banner danger">'
      + '<div class="pos-banner-left"><span class="pos-banner-icon">' + _pSvg('alert', 16) + '</span>'
      + '<span>La caja del <strong>' + san(_pFormatDate(oldReg.date)) + '</strong> quedó sin cerrar.</span></div>'
      + '<button type="button" class="pos-btn secondary sm" onclick="posOpenCloseFlow(\'' + san(oldReg.date) + '\')">Cerrar</button>'
      + '</div>';
  }

  if (POS_STATE.subtab === 'cobrar') {
    html += _pRenderCobrar();
  } else if (POS_STATE.subtab === 'cierre') {
    html += _pRenderCierre();
  } else if (POS_STATE.subtab === 'servicios') {
    html += _pRenderGeneralServices();
  } else if (POS_STATE.subtab === 'ajustes') {
    html += _pRenderAjustes();
  }

  root.innerHTML = html;
}

/* ── SUBTAB 1: COBRAR (POS 5 PASOS + APERTURA) ── */
function _pRenderCobrar() {
  var reg = POS_STATE.register;

  // Si la caja no está abierta hoy, pantalla limpia de Apertura
  if (!_pIsRegisterOpen()) {
    if (reg && reg.status === 'closed') {
      var dif = parseFloat(reg.difference) || 0;
      var difLabel = dif === 0 ? 'Cuadra exacto' : (dif > 0 ? 'Sobrante ' + money(dif) : 'Faltante ' + money(Math.abs(dif)));
      var difColor = dif === 0 ? 'var(--green)' : (dif > 0 ? 'var(--gold)' : 'var(--red)');
      return '<div class="pos-surface">'
        + '<div class="pos-row"><div class="pos-row-main"><div class="pos-row-title">Caja cerrada hoy</div><div class="pos-row-sub">Cerrada por ' + san(reg.closed_by || 'Propietario') + '</div></div><div class="pos-row-val" style="color:' + difColor + '">' + difLabel + '</div></div>'
        + '<div class="pos-row"><div class="pos-row-main"><div class="pos-row-sub">Total ventas del día</div></div><div class="pos-row-val">' + money(reg.total_sales || 0) + '</div></div>'
        + '<div class="pos-row"><div class="pos-row-main"><div class="pos-row-sub">Efectivo contado</div></div><div class="pos-row-val">' + money(reg.counted_cash || 0) + '</div></div>'
        + '</div>'
        + '<div class="pos-actions">'
        + '<button type="button" class="pos-btn secondary full" onclick="posReopenRegister()">Reabrir caja de hoy</button>'
        + '</div>';
    }

    var staff = _pStaffOptions();
    if (!POS_STATE.openingBy && staff.length) POS_STATE.openingBy = staff[0].name;
    var sym = typeof getSimboloMoneda === 'function' ? getSimboloMoneda() : '€';

    return '<div class="pos-sec-label">Apertura de caja</div>'
      + '<div class="pos-surface pos-surface-pad">'
      + '  <div style="font-size:15px;font-weight:700;margin-bottom:4px">Abre la caja para comenzar a cobrar</div>'
      + '  <div style="font-size:13px;color:var(--t2);margin-bottom:16px">Registra quién abre la caja y el efectivo inicial disponible para dar cambio.</div>'
      + '  <div class="field"><label for="pos-open-by">Responsable de apertura</label>'
      + '    <input class="inp" id="pos-open-by" list="pos-open-staff-list" placeholder="Escribe un nombre o elige del equipo" maxlength="60" value="' + san(POS_STATE.openingBy) + '" oninput="POS_STATE.openingBy=this.value" autocomplete="off"/>'
      + '    <datalist id="pos-open-staff-list">'
      + staff.map(function (s) {
          return '<option value="' + san(s.name) + '"></option>';
        }).join('')
      + '    </datalist>'
      + (staff.length > 0 ? '<div class="pos-quick-chips">' + staff.map(function (s) {
          var act = POS_STATE.openingBy === s.name;
          return '<button type="button" class="pos-quick-chip' + (act ? ' active' : '') + '" onclick="POS_STATE.openingBy=\'' + san(s.name) + '\';var el=G(\'pos-open-by\');if(el)el.value=\'' + san(s.name) + '\';posRender()">' + san(s.name) + '</button>';
        }).join('') + '</div>' : '')
      + '  </div>'
      + '  <div class="field"><label for="pos-open-cash">Efectivo inicial en caja (' + san(sym) + ')</label>'
      + '    <input class="inp pos-num" id="pos-open-cash" type="number" inputmode="decimal" min="0" step="0.5" placeholder="0.00" value="' + san(POS_STATE.openingCash) + '" oninput="POS_STATE.openingCash=this.value"/>'
      + '  </div>'
      + '  <button type="button" class="pos-btn primary full" id="pos-btn-open-cash" onclick="posSubmitOpenRegister()">Abrir caja</button>'
      + '</div>';
  }

  var c = POS_STATE.cart;

  // Paso 6: Confirmación limpia
  if (c.step === 6 && c.lastSale) {
    var sl = c.lastSale;
    var waHtml = '';
    if (sl.client_phone) {
      var cleanTel = String(sl.client_phone).replace(/\D/g, '');
      var lines = [
        (CUR.name || 'Citas Pro'),
        'Recibo de compra · ' + _pFormatDate(sl.sale_date),
        ''
      ];
      (sl.items_services || []).forEach(function (s) {
        lines.push(s.name + (s.qty > 1 ? ' x' + s.qty : '') + ' — ' + money(s.price * s.qty));
      });
      (sl.items_products || []).forEach(function (p) {
        lines.push(p.name + ' x' + p.qty + ' — ' + money(p.price * p.qty));
      });
      if (sl.discount_manual > 0) lines.push('Descuento: -' + money(sl.discount_manual));
      if (sl.tip > 0) lines.push('Propina: ' + money(sl.tip));
      lines.push('', 'TOTAL: ' + money(sl.total) + ' (' + sl.payment_method + ')');
      var waUrl = 'https://wa.me/' + cleanTel + '?text=' + encodeURIComponent(lines.join('\n'));
      waHtml = '<a class="pos-btn secondary full" href="' + waUrl + '" target="_blank" rel="noopener noreferrer" style="margin-bottom:10px">' + _pSvg('send', 15) + ' Enviar recibo por WhatsApp</a>';
    }

    return '<div class="pos-surface pos-surface-pad pos-success">'
      + '<div class="pos-success-icon">' + _pSvg('check', 30) + '</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--t2)">Cobro registrado</div>'
      + '<div class="pos-success-amount">' + money(sl.total) + '</div>'
      + '<div class="pos-success-meta">' + san(sl.payment_method) + (sl.worker_name ? ' · ' + san(sl.worker_name) : '') + (sl.client_name ? ' · ' + san(sl.client_name) : '') + '</div>'
      + waHtml
      + '<button type="button" class="pos-btn primary full" onclick="posResetCart();posRender()">Nuevo cobro</button>'
      + '</div>';
  }

  // Barra de 5 pasos
  var stepsHtml = '<div class="pos-steps">';
  for (var i = 1; i <= 5; i++) {
    stepsHtml += '<span class="pos-step-bar' + (i <= c.step ? ' on' : '') + '"></span>';
  }
  stepsHtml += '</div>';

  // Banner de stock bajo en Paso 1
  var lowAlert = (POS_STATE.posConfig && POS_STATE.posConfig.low_stock_alert != null) ? POS_STATE.posConfig.low_stock_alert : 5;
  var lowBanner = '';
  if (c.step === 1) {
    var lows = POS_STATE.products.filter(function (p) {
      var minS = p.min_stock != null ? p.min_stock : lowAlert;
      return p.active !== false && (p.stock || 0) <= minS;
    });
    if (lows.length > 0) {
      lowBanner = '<div class="pos-banner warn">'
        + '<div class="pos-banner-left"><span class="pos-banner-icon">' + _pSvg('alert', 16) + '</span>'
        + '<span><strong>Stock bajo:</strong> ' + lows.slice(0, 3).map(function (x) { return san(x.name) + ' (' + (x.stock <= 0 ? '0' : x.stock) + ')'; }).join(', ') + (lows.length > 3 ? ' +' + (lows.length - 3) : '') + '</span></div>'
        + '<button type="button" class="pos-btn secondary sm" onclick="bizTab(\'tienda\')">Ver stock</button>'
        + '</div>';
    }
  }

  if (c.step === 1) return stepsHtml + lowBanner + _pStep1Client();
  if (c.step === 2) return stepsHtml + _pStep2Products();
  if (c.step === 3) return stepsHtml + _pStep3Services();
  if (c.step === 4) return stepsHtml + _pStep4Worker();
  return stepsHtml + _pStep5Payment();
}

function _pStep1Client() {
  var c = POS_STATE.cart;
  var html = '<div class="pos-sec-label">1. Cliente</div>';

  if (c.client) {
    html += '<div class="pos-surface">'
      + '<div class="pos-row">'
      + '  <div class="pos-row-main"><div class="pos-row-title">' + san(c.client.name) + '</div><div class="pos-row-sub">' + san(c.client.phone || c.client.email || 'Cliente seleccionado') + '</div></div>'
      + '  <button type="button" class="pos-btn danger-ghost" onclick="POS_STATE.cart.client=null;posRender()">Quitar</button>'
      + '</div></div>';
  } else {
    var q = _pNorm(c.clientSearch);
    var matches = q ? POS_STATE.clients.filter(function (cl) {
      return _pNorm(cl.name).indexOf(q) >= 0 || _pNorm(cl.phone).indexOf(q) >= 0;
    }).slice(0, 6) : POS_STATE.clients.slice(0, 5);

    html += '<div class="pos-input-bar"><div class="pos-input-wrap">'
      + _pSvg('search', 16)
      + '<input class="inp" id="pos-cli-search" type="search" placeholder="Buscar cliente por nombre o teléfono..." value="' + san(c.clientSearch) + '" oninput="POS_STATE.cart.clientSearch=this.value;posRenderClientMatches()" autocomplete="off"/>'
      + '</div></div>';

    html += '<div id="pos-cli-matches">' + _pBuildClientMatchesHtml(matches) + '</div>';

    html += '<div class="pos-sec-label">O registrar cliente rápido</div>'
      + '<div class="pos-surface pos-surface-pad">'
      + '  <div style="display:flex;gap:10px;flex-wrap:wrap">'
      + '    <div class="field" style="flex:1;min-width:150px;margin-bottom:0"><label for="pos-nc-name">Nombre</label><input class="inp" id="pos-nc-name" placeholder="Nombre del cliente" value="' + san(c.newClientName) + '" oninput="POS_STATE.cart.newClientName=this.value"/></div>'
      + '    <div class="field" style="flex:1;min-width:150px;margin-bottom:0"><label for="pos-nc-phone">Teléfono</label><input class="inp" id="pos-nc-phone" type="tel" placeholder="Teléfono / WhatsApp" value="' + san(c.newClientPhone) + '" oninput="POS_STATE.cart.newClientPhone=this.value"/></div>'
      + '  </div>'
      + '</div>';
  }

  html += '<div class="pos-actions">'
    + (!c.client ? '<button type="button" class="pos-btn secondary" style="flex:1" onclick="posGoStep(2)">Sin cliente</button>' : '')
    + '<button type="button" class="pos-btn primary" style="flex:1" onclick="posNextFromClient()">Siguiente</button>'
    + '</div>';

  return html;
}

function _pBuildClientMatchesHtml(matches) {
  if (!matches || !matches.length) {
    return POS_STATE.cart.clientSearch
      ? '<div class="pos-surface pos-surface-pad" style="font-size:13px;color:var(--t2)">Sin coincidencias. Puedes registrarlo abajo.</div>'
      : '';
  }
  return '<div class="pos-surface">' + matches.map(function (cl) {
    return '<div class="pos-row clickable" onclick="posSelectClient(\'' + san(cl.id) + '\')">'
      + '<div class="pos-row-main"><div class="pos-row-title">' + san(cl.name) + '</div><div class="pos-row-sub">' + san(cl.phone || cl.email || '') + '</div></div>'
      + '<span style="font-size:12px;color:var(--blue);font-weight:600">Elegir</span>'
      + '</div>';
  }).join('') + '</div>';
}

function posRenderClientMatches() {
  var el = G('pos-cli-matches');
  if (!el) return;
  var q = _pNorm(POS_STATE.cart.clientSearch);
  var matches = q ? POS_STATE.clients.filter(function (cl) {
    return _pNorm(cl.name).indexOf(q) >= 0 || _pNorm(cl.phone).indexOf(q) >= 0;
  }).slice(0, 6) : POS_STATE.clients.slice(0, 5);
  el.innerHTML = _pBuildClientMatchesHtml(matches);
}

function posSelectClient(clientId) {
  var cl = POS_STATE.clients.find(function (x) { return x.id === clientId; });
  if (!cl) return;
  POS_STATE.cart.client = { id: cl.id, name: cl.name, phone: cl.phone || '', email: cl.email || '' };
  POS_STATE.cart.clientSearch = '';
  posRender();
}

function posNextFromClient() {
  var c = POS_STATE.cart;
  if (!c.client && c.newClientName.trim()) {
    c.client = {
      id: null,
      name: c.newClientName.trim(),
      phone: c.newClientPhone.trim(),
      email: ''
    };
  }
  posGoStep(2);
}

function _pStep2Products() {
  var c = POS_STATE.cart;
  var totals = posCalcTotals();
  var html = '<button type="button" class="pos-back-btn" onclick="posGoStep(1)">' + _pSvg('back', 15) + ' Cliente</button>';
  html += '<div class="pos-sec-label">2. Productos y escáner (opcional)</div>';

  html += '<div class="pos-input-bar"><div class="pos-input-wrap">'
    + _pSvg('barcode', 16)
    + '<input class="inp" id="pos-prod-scan" type="search" placeholder="Escanear código de barras o buscar producto..." value="' + san(c.prodSearch) + '" oninput="POS_STATE.cart.prodSearch=this.value;posRenderProductGrid()" onkeydown="if(event.key===\'Enter\'){event.preventDefault();posManualBarcodeScan(this);}" autocomplete="off"/>'
    + '</div></div>';

  html += '<div id="pos-prod-grid" class="pos-grid">' + _pBuildProductTilesHtml() + '</div>';

  if (totals.prodTot > 0) {
    html += '<div class="pos-surface"><div class="pos-row">'
      + '<div class="pos-row-main"><div class="pos-row-title">Productos seleccionados</div></div>'
      + '<div style="display:flex;align-items:center;gap:10px"><span class="pos-row-val" style="color:var(--blue)">' + money(totals.prodTot) + '</span>'
      + '<button type="button" class="pos-btn danger-ghost" onclick="POS_STATE.cart.products={};posRender()">Vaciar</button></div>'
      + '</div></div>';
  }

  html += '<div class="pos-actions">'
    + '<button type="button" class="pos-btn secondary" style="flex:1" onclick="POS_STATE.cart.products={};posGoStep(3)">Omitir</button>'
    + '<button type="button" class="pos-btn primary" style="flex:1" onclick="posGoStep(3)">Siguiente</button>'
    + '</div>';
  return html;
}

function _pBuildProductTilesHtml() {
  var q = _pNorm(POS_STATE.cart.prodSearch);
  var lowAlert = (POS_STATE.posConfig && POS_STATE.posConfig.low_stock_alert != null) ? POS_STATE.posConfig.low_stock_alert : 5;
  var list = POS_STATE.products.filter(function (p) {
    if (p.active === false) return false;
    if (!q) return true;
    return _pNorm(p.name).indexOf(q) >= 0 || _pNorm(p.barcode).indexOf(q) >= 0 || _pNorm(p.category).indexOf(q) >= 0;
  });

  if (!list.length) {
    return '<div class="pos-surface pos-surface-pad" style="grid-column:1/-1;text-align:center;color:var(--t2);font-size:13px">'
      + (POS_STATE.products.length === 0 ? 'No hay productos en Tienda aún.' : 'Sin productos coincidentes.')
      + '</div>';
  }

  return list.map(function (p) {
    var qty = POS_STATE.cart.products[p.id] || 0;
    var stock = parseInt(p.stock, 10) || 0;
    var rem = stock - qty;
    var minS = p.min_stock != null ? p.min_stock : lowAlert;
    var stClass = stock <= 0 ? 'out' : (stock <= minS ? 'low' : '');
    var img = _pFirstImg(p.image);
    var disc = parseFloat(p.discount_percent) || 0;
    var unitPrice = disc > 0 ? p.price * (1 - disc / 100) : p.price;

    return '<div class="pos-tile' + (qty > 0 ? ' selected' : '') + (stock <= 0 ? ' disabled' : '') + '" onclick="posAddProd(\'' + san(p.id) + '\')">'
      + '<div class="pos-tile-head">'
      + '  <div class="pos-tile-media">' + (img ? '<img src="' + san(img) + '" alt=""/>' : _pSvg('box', 18)) + '</div>'
      + '  <span class="pos-stock-tag ' + stClass + '">' + (stock <= 0 ? 'Agotado' : rem + ' uds') + '</span>'
      + '</div>'
      + '<div class="pos-tile-name">' + san(p.name) + '</div>'
      + '<div class="pos-tile-meta">'
      + '  <span class="pos-tile-price">' + money(unitPrice) + '</span>'
      + (qty > 0
        ? '<div class="pos-stepper" onclick="event.stopPropagation()">'
          + '<button type="button" class="pos-step-btn" onclick="posSubProd(\'' + san(p.id) + '\')">−</button>'
          + '<span class="pos-step-qty">' + qty + '</span>'
          + '<button type="button" class="pos-step-btn" onclick="posAddProd(\'' + san(p.id) + '\')">+</button>'
          + '</div>'
        : '')
      + '</div></div>';
  }).join('');
}

function posRenderProductGrid() {
  var el = G('pos-prod-grid');
  if (el) el.innerHTML = _pBuildProductTilesHtml();
}

function posAddProd(prodId) {
  var p = POS_STATE.products.find(function (x) { return x.id === prodId; });
  if (!p) return;
  var curQty = POS_STATE.cart.products[prodId] || 0;
  if (curQty >= (p.stock || 0)) {
    toast('Sin más stock disponible de ' + p.name, '#F59E0B');
    return;
  }
  POS_STATE.cart.products[prodId] = curQty + 1;
  posRender();
}

function posSubProd(prodId) {
  var curQty = POS_STATE.cart.products[prodId] || 0;
  if (curQty > 1) POS_STATE.cart.products[prodId] = curQty - 1;
  else delete POS_STATE.cart.products[prodId];
  posRender();
}

function posManualBarcodeScan(inputEl) {
  var code = String(inputEl && inputEl.value || '').trim();
  if (!code) return;
  posHandleScannedBarcode(code);
  inputEl.value = '';
  POS_STATE.cart.prodSearch = '';
}

function posHandleScannedBarcode(code) {
  var clean = String(code || '').trim();
  if (!clean) return;
  var found = POS_STATE.products.find(function (p) {
    return p.barcode && String(p.barcode).trim() === clean;
  });

  // Si está abierto el modal de edición de producto, rellenar el campo barcode
  var modalProd = G('ov-tienda-prod');
  if (modalProd && modalProd.classList.contains('on')) {
    var bcInp = G('prod-barcode');
    if (bcInp) {
      bcInp.value = clean;
      if (typeof updateBarcodeHint === 'function') updateBarcodeHint();
      _pBeep(true);
      toast('Código escaneado: ' + clean, '#22C55E');
    }
    return;
  }

  // Si está en la pestaña Tienda
  var bpTienda = G('bp-tienda');
  if (bpTienda && bpTienda.classList.contains('on')) {
    _pBeep(true);
    if (found) {
      if (typeof openProdModal === 'function') openProdModal(found.id);
    } else if (typeof openProdModal === 'function') {
      openProdModal(null, clean);
      toast('Nuevo código detectado: ' + clean, '#4A7FD4');
    }
    return;
  }

  // Si está en Caja -> Cobrar
  var bpCaja = G('bp-caja');
  if (bpCaja && bpCaja.classList.contains('on') && POS_STATE.subtab === 'cobrar') {
    if (!_pIsRegisterOpen()) {
      _pBeep(false);
      toast('Abre la caja primero para escanear ventas', '#F59E0B');
      return;
    }
    if (!found) {
      _pBeep(false);
      toast('Código no registrado: ' + clean, '#EF4444');
      return;
    }
    if (found.active === false) {
      _pBeep(false);
      toast('El producto "' + found.name + '" está inactivo', '#F59E0B');
      return;
    }
    var curQty = POS_STATE.cart.products[found.id] || 0;
    if (curQty >= (found.stock || 0)) {
      _pBeep(false);
      toast('Sin stock disponible de "' + found.name + '"', '#EF4444');
      return;
    }
    POS_STATE.cart.products[found.id] = curQty + 1;
    _pBeep(true);
    toast('Añadido: ' + found.name + ' (x' + POS_STATE.cart.products[found.id] + ')', '#22C55E');
    posRender();
  }
}

/* ── Paso 3: Servicios (Generales + Equipo) ── */
function _pCollectAvailableServices() {
  var gen = POS_STATE.generalServices
    .filter(function (s) { return s.active !== false; })
    .map(function (s) {
      return { key: 'g_' + s.id, id: s.id, name: s.name, price: s.price, dur: s.dur || 30, group: 'Servicios generales', isGeneral: true };
    });

  var team = [];
  (CUR && CUR.workers || []).forEach(function (w) {
    (w.services || []).forEach(function (s) {
      team.push({ key: 'w_' + w.id + '_' + s.id, id: s.id, name: s.name, price: s.price, dur: s.dur || 30, group: w.name, workerId: w.id, isGeneral: false });
    });
  });

  return { gen: gen, team: team };
}

function _pStep3Services() {
  var totals = posCalcTotals();
  var groups = _pCollectAvailableServices();
  var html = '<button type="button" class="pos-back-btn" onclick="posGoStep(2)">' + _pSvg('back', 15) + ' Productos</button>';
  html += '<div class="pos-sec-label">3. Servicios</div>';

  if (groups.gen.length === 0 && groups.team.length === 0) {
    html += '<div class="pos-surface pos-surface-pad" style="text-align:center;color:var(--t2);font-size:13px">'
      + 'No hay servicios configurados todavía. Puedes crear Servicios Generales en la pestaña superior.'
      + '</div>';
  } else {
    if (groups.gen.length > 0) {
      html += '<div class="pos-sec-label" style="margin-top:8px">Servicios generales de la tienda</div>';
      html += '<div class="pos-grid">' + groups.gen.map(_pSvcTileHtml).join('') + '</div>';
    }
    if (groups.team.length > 0) {
      html += '<div class="pos-sec-label" style="margin-top:12px">Servicios por profesional</div>';
      html += '<div class="pos-grid">' + groups.team.map(_pSvcTileHtml).join('') + '</div>';
    }
  }

  var selKeys = Object.keys(POS_STATE.cart.services);
  if (selKeys.length > 0) {
    html += '<div class="pos-surface">';
    selKeys.forEach(function (k) {
      var s = POS_STATE.cart.services[k];
      html += '<div class="pos-row">'
        + '<div class="pos-row-main"><div class="pos-row-title">' + san(s.name) + '</div><div class="pos-row-sub">' + money(s.price) + ' c/u</div></div>'
        + '<div class="pos-stepper">'
        + '<button type="button" class="pos-step-btn" onclick="posAdjSvc(\'' + san(k) + '\', -1)">−</button>'
        + '<span class="pos-step-qty">' + s.qty + '</span>'
        + '<button type="button" class="pos-step-btn" onclick="posAdjSvc(\'' + san(k) + '\', 1)">+</button>'
        + '</div></div>';
    });
    html += '<div class="pos-row total-row"><span>Total servicios</span><span style="color:var(--blue)">' + money(totals.svcTot) + '</span></div></div>';
  }

  var canProceed = (totals.svcTot > 0 || totals.prodTot > 0);
  html += '<div class="pos-actions">'
    + '<button type="button" class="pos-btn primary full" ' + (canProceed ? '' : 'disabled') + ' onclick="posGoStep(4)">Siguiente</button>'
    + '</div>';
  return html;
}

function _pSvcTileHtml(s) {
  var sel = POS_STATE.cart.services[s.key];
  var qty = sel ? sel.qty : 0;
  return '<div class="pos-tile' + (qty > 0 ? ' selected' : '') + '" onclick="posToggleSvc(\'' + san(s.key) + '\')">'
    + '<div class="pos-tile-head">'
    + '  <div class="pos-tile-media">' + _pSvg('scissors', 17) + '</div>'
    + '  <span class="pos-stock-tag">' + (s.dur || 30) + ' min</span>'
    + '</div>'
    + '<div class="pos-tile-name">' + san(s.name) + '</div>'
    + '<div class="pos-tile-meta">'
    + '  <span class="pos-tile-price">' + money(s.price) + '</span>'
    + '  <span style="font-size:11px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:75px">' + san(s.isGeneral ? 'General' : s.group) + '</span>'
    + '</div></div>';
}

function posToggleSvc(key) {
  if (POS_STATE.cart.services[key]) {
    delete POS_STATE.cart.services[key];
  } else {
    var groups = _pCollectAvailableServices();
    var all = groups.gen.concat(groups.team);
    var found = all.find(function (x) { return x.key === key; });
    if (!found) return;
    POS_STATE.cart.services[key] = { id: found.id, name: found.name, price: found.price, qty: 1, isGeneral: found.isGeneral };
  }
  posRender();
}

function posAdjSvc(key, delta) {
  var s = POS_STATE.cart.services[key];
  if (!s) return;
  var next = (s.qty || 1) + delta;
  if (next <= 0) delete POS_STATE.cart.services[key];
  else s.qty = next;
  posRender();
}

/* ── Paso 4: Profesional ── */
function _pStep4Worker() {
  var staff = _pStaffOptions();
  var c = POS_STATE.cart;
  var html = '<button type="button" class="pos-back-btn" onclick="posGoStep(3)">' + _pSvg('back', 15) + ' Servicios</button>';
  html += '<div class="pos-sec-label">4. ¿Quién atendió?</div>';
  html += '<div class="pos-grid">';
  staff.forEach(function (st) {
    var isSel = (c.workerName === st.name && (c.workerId || '') === (st.id || ''));
    var img = _pFirstImg(st.photo);
    html += '<div class="pos-tile' + (isSel ? ' selected' : '') + '" onclick="posPickWorker(\'' + san(st.id) + '\',\'' + san(st.name) + '\')">'
      + '<div class="pos-tile-head"><div class="pos-tile-media round">' + (img ? '<img src="' + san(img) + '" alt=""/>' : _pSvg('user', 18)) + '</div></div>'
      + '<div class="pos-tile-name">' + san(st.name) + '</div>'
      + '<div style="font-size:12px;color:var(--t2)">' + san(st.role) + '</div>'
      + '</div>';
  });
  html += '</div>';
  html += '<div class="pos-actions">'
    + '<button type="button" class="pos-btn primary full" ' + (c.workerName ? '' : 'disabled') + ' onclick="posGoStep(5)">Continuar al pago</button>'
    + '</div>';
  return html;
}

function posPickWorker(id, name) {
  POS_STATE.cart.workerId = id || null;
  POS_STATE.cart.workerName = name;
  posGoStep(5);
}

/* ── Paso 5: Pago y Resumen ── */
function _pStep5Payment() {
  var c = POS_STATE.cart;
  var t = posCalcTotals();
  var sym = typeof getSimboloMoneda === 'function' ? getSimboloMoneda() : '€';
  var methods = (POS_STATE.posConfig && POS_STATE.posConfig.payment_methods) || [];

  var html = '<button type="button" class="pos-back-btn" onclick="posGoStep(4)">' + _pSvg('back', 15) + ' Profesional</button>';
  html += '<div class="pos-sec-label">5. Resumen y método de pago</div>';

  html += '<div class="pos-surface">'
    + (c.client ? '<div class="pos-row"><span class="pos-row-sub">Cliente</span><span class="pos-row-val">' + san(c.client.name) + '</span></div>' : '')
    + '<div class="pos-row"><span class="pos-row-sub">Atendido por</span><span class="pos-row-val">' + san(c.workerName || 'Propietario') + '</span></div>'
    + (t.svcTot > 0 ? '<div class="pos-row"><span class="pos-row-sub">Servicios</span><span class="pos-row-val">' + money(t.svcTot) + '</span></div>' : '')
    + (t.prodTot > 0 ? '<div class="pos-row"><span class="pos-row-sub">Productos</span><span class="pos-row-val">' + money(t.prodTot) + '</span></div>' : '')
    + (t.dm > 0 ? '<div class="pos-row"><span class="pos-row-sub">Descuento</span><span class="pos-row-val" style="color:var(--red)">−' + money(t.dm) + '</span></div>' : '')
    + (t.tip > 0 ? '<div class="pos-row"><span class="pos-row-sub">Propina (aparte)</span><span class="pos-row-val" style="color:var(--green)">+' + money(t.tip) + '</span></div>' : '')
    + '<div class="pos-row total-row"><span>Total a cobrar</span><span id="pos-pay-total-val" style="color:var(--blue)">' + money(t.net) + '</span></div>'
    + '</div>';

  html += '<div class="pos-surface pos-surface-pad">'
    + '<div style="display:flex;gap:10px">'
    + '  <div class="field" style="flex:1;margin-bottom:0"><label for="pos-disc-inp">Descuento (' + san(sym) + ')</label><input class="inp pos-num" id="pos-disc-inp" type="number" inputmode="decimal" min="0" step="0.5" placeholder="0" value="' + (c.discountManual || '') + '" oninput="POS_STATE.cart.discountManual=parseFloat(this.value)||0;posUpdatePayTotal()"/></div>'
    + '  <div class="field" style="flex:1;margin-bottom:0"><label for="pos-tip-inp">Propina (' + san(sym) + ')</label><input class="inp pos-num" id="pos-tip-inp" type="number" inputmode="decimal" min="0" step="0.5" placeholder="0" value="' + (c.tip || '') + '" oninput="POS_STATE.cart.tip=parseFloat(this.value)||0;posUpdatePayTotal()"/></div>'
    + '</div></div>';

  html += '<div class="pos-sec-label">Método de pago</div><div class="pos-grid">';
  methods.forEach(function (m) {
    var iconKey = m.key === 'cash' ? 'cash' : (m.key === 'transfer' ? 'transfer' : 'card');
    var active = c.paymentMethod === m.name;
    html += '<div class="pos-tile' + (active ? ' selected' : '') + '" style="min-height:84px" onclick="POS_STATE.cart.paymentMethod=\'' + san(m.name) + '\';posRender()">'
      + '<div class="pos-tile-media">' + _pSvg(iconKey, 18) + '</div>'
      + '<div class="pos-tile-name">' + san(m.name) + '</div>'
      + '</div>';
  });
  html += '</div>';

  html += '<div class="pos-actions">'
    + '<button type="button" class="pos-btn primary full" id="pos-confirm-sale-btn" onclick="posConfirmSale()">Confirmar cobro · ' + money(t.net) + '</button>'
    + '</div>';
  return html;
}

function posUpdatePayTotal() {
  var t = posCalcTotals();
  var el = G('pos-pay-total-val');
  if (el) el.textContent = money(t.net);
  var btn = G('pos-confirm-sale-btn');
  if (btn && !btn.disabled) btn.textContent = 'Confirmar cobro · ' + money(t.net);
}

function posGoStep(step) {
  POS_STATE.cart.step = step;
  posRender();
}

async function posConfirmSale() {
  if (!CUR || !CUR.id) return;
  var c = POS_STATE.cart;
  var btn = G('pos-confirm-sale-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Registrando...'; }

  var itemsServices = Object.keys(c.services).map(function (k) {
    var s = c.services[k];
    return { id: s.id, name: s.name, qty: s.qty, price: s.price };
  });
  var itemsProducts = Object.keys(c.products).map(function (pid) {
    var p = POS_STATE.products.find(function (x) { return x.id === pid; });
    return { id: pid, name: p ? p.name : '', qty: c.products[pid] };
  }).filter(function (x) { return x.qty > 0; });

  try {
    var res = await fetch('/api/pos/sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: CUR.id,
        sale_date: POS_STATE.date,
        cash_register_id: POS_STATE.register ? POS_STATE.register.id : null,
        appointment_id: c.appointmentId || null,
        worker_id: c.workerId || null,
        worker_name: c.workerName || 'Propietario',
        client_id: c.client ? c.client.id : null,
        client_name: c.client ? c.client.name : '',
        client_phone: c.client ? c.client.phone : '',
        client_email: c.client ? c.client.email : '',
        items_services: itemsServices,
        items_products: itemsProducts,
        discount_manual: parseFloat(c.discountManual) || 0,
        tip: parseFloat(c.tip) || 0,
        payment_method: c.paymentMethod || 'Efectivo'
      })
    });

    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo registrar el cobro');

    c.lastSale = data.sale;
    c.step = 6;
    _pBeep(true);
    await posLoadState(true);
    posRender();
  } catch (err) {
    toast(err.message || 'Error al cobrar', '#EF4444');
    if (btn) { btn.disabled = false; posUpdatePayTotal(); }
  }
}

/* ── SUBTAB 2: CAJA DEL DÍA (CIERRE, MOVIMIENTOS, HISTORIAL) ── */
function _pRenderCierre() {
  var targetDate = POS_STATE.closingDate || POS_STATE.date;
  var reg = POS_STATE.recentRegisters.find(function (r) { return r.date === targetDate; }) || (targetDate === POS_STATE.date ? POS_STATE.register : null);
  var completedSales = POS_STATE.sales.filter(function (s) { return s.status !== 'voided'; });

  var totalSales = 0, cashSales = 0, cashTips = 0, totalTips = 0;
  var byMethod = {};
  completedSales.forEach(function (s) {
    var tot = parseFloat(s.total) || 0;
    var tip = parseFloat(s.tip) || 0;
    totalSales += tot;
    totalTips += tip;
    byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + tot;
    if (/efectivo|cash/i.test(s.payment_method || '')) {
      cashSales += tot;
      cashTips += tip;
    }
  });
  var openingCash = reg ? (parseFloat(reg.opening_cash) || 0) : 0;
  var expectedCash = Math.round((openingCash + cashSales + cashTips) * 100) / 100;

  var html = '<div class="pos-kpi-strip">'
    + '<div class="pos-kpi-cell"><div class="pos-kpi-lbl">Ventas hoy</div><div class="pos-kpi-val">' + money(totalSales) + '</div></div>'
    + '<div class="pos-kpi-cell"><div class="pos-kpi-lbl">Cobros</div><div class="pos-kpi-val">' + completedSales.length + '</div></div>'
    + '<div class="pos-kpi-cell"><div class="pos-kpi-lbl">Efectivo esperado</div><div class="pos-kpi-val" style="color:var(--blue)">' + money(expectedCash) + '</div></div>'
    + '</div>';

  // Desglose por método
  html += '<div class="pos-sec-label">Desglose de hoy (' + san(_pFormatDate(POS_STATE.date)) + ')</div>'
    + '<div class="pos-surface">'
    + '<div class="pos-row"><span class="pos-row-sub">Efectivo inicial</span><span class="pos-row-val">' + money(openingCash) + '</span></div>';
  Object.keys(byMethod).forEach(function (m) {
    html += '<div class="pos-row"><span class="pos-row-sub">' + san(m) + '</span><span class="pos-row-val">' + money(byMethod[m]) + '</span></div>';
  });
  if (totalTips > 0) {
    html += '<div class="pos-row"><span class="pos-row-sub">Propinas (aparte)</span><span class="pos-row-val">' + money(totalTips) + '</span></div>';
  }
  html += '</div>';

  // Formulario de cierre si la caja objetivo está abierta
  if (reg && reg.status === 'open') {
    var staff = _pStaffOptions();
    if (!POS_STATE.closingBy && staff.length) POS_STATE.closingBy = staff[0].name;
    var sym = typeof getSimboloMoneda === 'function' ? getSimboloMoneda() : '€';
    var countedNum = parseFloat(POS_STATE.closingCounted);
    var difText = '—';
    var difColor = 'var(--t2)';
    if (!isNaN(countedNum)) {
      var d = Math.round((countedNum - expectedCash) * 100) / 100;
      if (d === 0) { difText = 'Cuadra exacto'; difColor = 'var(--green)'; }
      else if (d > 0) { difText = 'Sobrante ' + money(d); difColor = 'var(--gold)'; }
      else { difText = 'Faltante ' + money(Math.abs(d)); difColor = 'var(--red)'; }
    }

    html += '<div class="pos-sec-label">Cerrar caja del ' + san(_pFormatDate(targetDate)) + '</div>'
      + '<div class="pos-surface pos-surface-pad">'
      + '  <div class="field"><label for="pos-close-by">Responsable del cierre</label>'
      + '    <input class="inp" id="pos-close-by" list="pos-close-staff-list" placeholder="Escribe un nombre o elige del equipo" maxlength="60" value="' + san(POS_STATE.closingBy) + '" oninput="POS_STATE.closingBy=this.value" autocomplete="off"/>'
      + '    <datalist id="pos-close-staff-list">'
      + staff.map(function (s) {
          return '<option value="' + san(s.name) + '"></option>';
        }).join('')
      + '    </datalist>'
      + (staff.length > 0 ? '<div class="pos-quick-chips">' + staff.map(function (s) {
          var act = POS_STATE.closingBy === s.name;
          return '<button type="button" class="pos-quick-chip' + (act ? ' active' : '') + '" onclick="POS_STATE.closingBy=\'' + san(s.name) + '\';var el=G(\'pos-close-by\');if(el)el.value=\'' + san(s.name) + '\';posRender()">' + san(s.name) + '</button>';
        }).join('') + '</div>' : '')
      + '  </div>'
      + '  <div class="field"><label for="pos-close-cnt">Efectivo contado en caja (' + san(sym) + ')</label>'
      + '    <input class="inp pos-num" id="pos-close-cnt" type="number" inputmode="decimal" min="0" step="0.5" placeholder="Cuenta el efectivo físico" value="' + san(POS_STATE.closingCounted) + '" oninput="POS_STATE.closingCounted=this.value;posUpdateCloseDiff(' + expectedCash + ')"/>'
      + '  </div>'
      + '  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 14px;font-size:13px">'
      + '    <span style="color:var(--t2)">Diferencia contra esperado</span>'
      + '    <strong id="pos-close-diff" class="pos-num" style="color:' + difColor + '">' + difText + '</strong>'
      + '  </div>'
      + '  <button type="button" class="pos-btn primary full" id="pos-btn-close-cash" onclick="posSubmitCloseRegister(\'' + san(targetDate) + '\')">Cerrar caja</button>'
      + '</div>';
  }

  // Movimientos de hoy
  html += '<div class="pos-sec-label">Cobros de hoy (' + POS_STATE.sales.length + ')</div>'
    + '<div class="pos-surface">';
  if (!POS_STATE.sales.length) {
    html += '<div class="pos-row"><span class="pos-row-sub">Aún no hay cobros registrados hoy.</span></div>';
  } else {
    POS_STATE.sales.forEach(function (s) {
      var timeStr = s.created_at ? new Date(s.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
      var svcDesc = (s.items_services || []).map(function (x) { return x.name + (x.qty > 1 ? ' x' + x.qty : ''); }).join(', ');
      var prodDesc = (s.items_products || []).map(function (x) { return x.name + ' x' + x.qty; }).join(', ');
      var line = [svcDesc, prodDesc].filter(Boolean).join(' · ') || 'Venta';
      var isVoided = s.status === 'voided';
      html += '<div class="pos-row" style="' + (isVoided ? 'opacity:.5' : '') + '">'
        + '<div class="pos-row-main">'
        + '  <div class="pos-row-title">' + san(line) + '</div>'
        + '  <div class="pos-row-sub">' + san(timeStr) + ' · ' + san(s.payment_method) + (s.worker_name ? ' · ' + san(s.worker_name) : '') + (s.client_name ? ' · ' + san(s.client_name) : '') + (isVoided ? ' · Anulado' : '') + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '  <span class="pos-row-val" style="' + (isVoided ? 'text-decoration:line-through' : '') + '">' + money(s.total) + '</span>'
        + (!isVoided ? '<button type="button" class="pos-btn danger-ghost" onclick="posVoidSale(\'' + san(s.id) + '\')">Anular</button>' : '')
        + '</div></div>';
    });
  }
  html += '</div>';

  // Historial de últimos cierres
  if (POS_STATE.recentRegisters.length > 0) {
    html += '<div class="pos-sec-label">Historial reciente de cajas</div><div class="pos-surface">';
    POS_STATE.recentRegisters.forEach(function (r) {
      var stTxt = r.status === 'open' ? 'Abierta' : 'Cerrada';
      var stColor = r.status === 'open' ? 'var(--gold)' : 'var(--green)';
      var dif = parseFloat(r.difference) || 0;
      html += '<div class="pos-row">'
        + '<div class="pos-row-main"><div class="pos-row-title">' + san(_pFormatDate(r.date)) + '</div><div class="pos-row-sub">Apertura: ' + san(r.opened_by || '—') + (r.closed_by ? ' · Cierre: ' + san(r.closed_by) : '') + '</div></div>'
        + '<div style="text-align:right">'
        + '  <div class="pos-row-val" style="color:' + stColor + '">' + stTxt + (r.status === 'closed' ? ' · ' + money(r.total_sales || 0) : '') + '</div>'
        + (r.status === 'closed' && dif !== 0 ? '<div class="pos-row-sub" style="color:' + (dif > 0 ? 'var(--gold)' : 'var(--red)') + '">' + (dif > 0 ? '+' : '−') + money(Math.abs(dif)) + '</div>' : '')
        + '</div></div>';
    });
    html += '</div>';
  }

  return html;
}

function posOpenCloseFlow(dateStr) {
  POS_STATE.closingDate = dateStr;
  POS_STATE.subtab = 'cierre';
  posRender();
}

function posUpdateCloseDiff(expectedCash) {
  var el = G('pos-close-diff');
  if (!el) return;
  var v = parseFloat(POS_STATE.closingCounted);
  if (isNaN(v)) {
    el.textContent = '—';
    el.style.color = 'var(--t2)';
    return;
  }
  var d = Math.round((v - expectedCash) * 100) / 100;
  if (d === 0) { el.textContent = 'Cuadra exacto'; el.style.color = 'var(--green)'; }
  else if (d > 0) { el.textContent = 'Sobrante ' + money(d); el.style.color = 'var(--gold)'; }
  else { el.textContent = 'Faltante ' + money(Math.abs(d)); el.style.color = 'var(--red)'; }
}

async function posSubmitOpenRegister() {
  if (!CUR || !CUR.id) return;
  var openedBy = String(POS_STATE.openingBy || '').trim();
  if (!openedBy) {
    toast('Escribe el nombre de quien abre la caja', '#EF4444');
    return;
  }
  var btn = G('pos-btn-open-cash');
  var cash = parseFloat(POS_STATE.openingCash);
  if (isNaN(cash) || cash < 0) cash = 0;

  if (btn) { btn.disabled = true; btn.textContent = 'Abriendo...'; }
  try {
    var res = await fetch('/api/pos/cash-open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: CUR.id,
        date: POS_STATE.date,
        opened_by: openedBy,
        opening_cash: cash
      })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo abrir la caja');
    POS_STATE.openingCash = '';
    await posLoadState(true);
    toast('Caja abierta correctamente', '#22C55E');
    posRender();
  } catch (e) {
    toast(e.message || 'Error abriendo caja', '#EF4444');
    if (btn) { btn.disabled = false; btn.textContent = 'Abrir caja'; }
  }
}

async function posSubmitCloseRegister(targetDate) {
  if (!CUR || !CUR.id) return;
  var closedBy = String(POS_STATE.closingBy || '').trim();
  if (!closedBy) {
    toast('Escribe el nombre de quien cierra la caja', '#EF4444');
    return;
  }
  var v = parseFloat(POS_STATE.closingCounted);
  if (isNaN(v) || v < 0) {
    toast('Introduce el efectivo contado en caja', '#EF4444');
    return;
  }
  var btn = G('pos-btn-close-cash');
  if (btn) { btn.disabled = true; btn.textContent = 'Cerrando...'; }
  try {
    var res = await fetch('/api/pos/cash-close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: CUR.id,
        date: targetDate || POS_STATE.date,
        closed_by: closedBy,
        counted_cash: v
      })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo cerrar la caja');
    POS_STATE.closingCounted = '';
    POS_STATE.closingDate = null;
    await posLoadState(true);
    toast('Caja cerrada correctamente', '#22C55E');
    posRender();
  } catch (e) {
    toast(e.message || 'Error cerrando caja', '#EF4444');
    if (btn) { btn.disabled = false; btn.textContent = 'Cerrar caja'; }
  }
}

function posReopenRegister() {
  posRequirePin(async function () {
    try {
      var res = await fetch('/api/pos/cash-reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: CUR.id, date: POS_STATE.date })
      });
      var data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo reabrir');
      await posLoadState(true);
      toast('Caja reabierta', '#22C55E');
      posRender();
    } catch (e) {
      toast(e.message || 'Error reabriendo caja', '#EF4444');
    }
  });
}

function posVoidSale(saleId) {
  posRequirePin(function () {
    openConfirmModal('Anular cobro', 'Se anulará este ticket y se devolverá automáticamente el stock de los productos vendidos.', async function () {
      try {
        var res = await fetch('/api/pos/sale-void', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ business_id: CUR.id, sale_id: saleId })
        });
        var data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Error anulando');
        await posLoadState(true);
        toast('Cobro anulado y stock restaurado', '#475569');
        posRender();
      } catch (e) {
        toast(e.message || 'No se pudo anular', '#EF4444');
      }
    });
  }, 'Introduce el PIN de propietario para anular este cobro.');
}

/* ── SUBTAB 3: SERVICIOS GENERALES (PIN-PROTEGIDO) ── */
function _pRenderGeneralServices() {
  var list = POS_STATE.generalServices || [];
  var html = '<div class="pos-banner">'
    + '<div class="pos-banner-left"><span class="pos-banner-icon" style="color:var(--blue)">' + _pSvg('scissors', 16) + '</span>'
    + '<span>Los <strong>Servicios Generales</strong> aparecen en tu portal de reservas bajo el perfil de tu tienda y puede atenderlos cualquier profesional disponible.</span></div>'
    + '<button type="button" class="pos-btn primary sm" onclick="openGeneralServiceModal()">' + _pSvg('plus', 14) + ' Nuevo</button>'
    + '</div>';

  html += '<div class="pos-sec-label">Servicios generales (' + list.length + ')</div><div class="pos-surface">';
  if (!list.length) {
    html += '<div class="pos-row"><span class="pos-row-sub">Aún no has creado servicios generales. Pulsa "+ Nuevo" para añadir el primero.</span></div>';
  } else {
    list.forEach(function (s) {
      html += '<div class="pos-row clickable" style="' + (s.active === false ? 'opacity:.55' : '') + '" onclick="openGeneralServiceModal(\'' + san(s.id) + '\')">'
        + '<div class="pos-row-main">'
        + '  <div class="pos-row-title">' + san(s.name) + '</div>'
        + '  <div class="pos-row-sub">' + (s.dur || 30) + ' min · ' + (s.active === false ? 'Oculto' : 'Activo en portal y Caja') + (s.desc ? ' · ' + san(s.desc) : '') + '</div>'
        + '</div>'
        + '<div class="pos-row-val" style="color:var(--blue)">' + money(s.price) + '</div>'
        + '</div>';
    });
  }
  html += '</div>';
  return html;
}

function openGeneralServiceModal(svcId) {
  var sym = typeof getSimboloMoneda === 'function' ? getSimboloMoneda() : '€';
  if (G('gsvc-price-lbl')) G('gsvc-price-lbl').textContent = 'Precio (' + sym + ') *';

  var svc = svcId ? (POS_STATE.generalServices || []).find(function (s) { return s.id === svcId; }) : null;
  POS_STATE.editingGeneralSvcId = svc ? svc.id : null;

  if (G('gsvc-modal-title')) G('gsvc-modal-title').textContent = svc ? 'Editar servicio general' : 'Nuevo servicio general';
  if (G('gsvc-name')) G('gsvc-name').value = svc ? svc.name : '';
  if (G('gsvc-price')) G('gsvc-price').value = svc ? svc.price : '';
  if (G('gsvc-dur')) G('gsvc-dur').value = svc ? (svc.dur || 30) : 30;
  if (G('gsvc-desc')) G('gsvc-desc').value = svc ? (svc.desc || '') : '';

  var sw = G('gsvc-active-switch');
  if (sw) {
    if (!svc || svc.active !== false) sw.classList.add('on');
    else sw.classList.remove('on');
  }
  var del = G('gsvc-delete-btn');
  if (del) del.style.display = svc ? 'inline-flex' : 'none';

  openOv('ov-pos-gsvc');
}

async function saveGeneralService() {
  if (!CUR || !CUR.id) return;
  var name = V('gsvc-name').trim();
  var price = parseFloat(V('gsvc-price'));
  var dur = parseInt(V('gsvc-dur'), 10) || 30;
  var desc = V('gsvc-desc').trim();
  var sw = G('gsvc-active-switch');
  var isActive = sw ? sw.classList.contains('on') : true;

  if (!name) { toast('Escribe el nombre del servicio', '#EF4444'); return; }
  if (isNaN(price) || price < 0) { toast('Introduce un precio válido', '#EF4444'); return; }

  var btn = G('gsvc-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    var res = await fetch('/api/pos/general-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: CUR.id,
        service: {
          id: POS_STATE.editingGeneralSvcId || undefined,
          name: name,
          price: price,
          dur: dur,
          desc: desc,
          active: isActive
        }
      })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo guardar');

    closeOv('ov-pos-gsvc');
    await posLoadState(true);
    toast(POS_STATE.editingGeneralSvcId ? 'Servicio actualizado' : 'Servicio general creado', '#22C55E');
    posRender();
  } catch (e) {
    toast(e.message || 'Error guardando servicio', '#EF4444');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar servicio'; }
  }
}

function deleteCurrentGeneralService() {
  var id = POS_STATE.editingGeneralSvcId;
  if (!id || !CUR || !CUR.id) return;
  openConfirmModal('Eliminar servicio general', 'Se eliminará de Caja y del portal de reservas.', async function () {
    try {
      var res = await fetch('/api/pos/general-service-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: CUR.id, service_id: id })
      });
      var data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo eliminar');
      closeOv('ov-pos-gsvc');
      await posLoadState(true);
      toast('Servicio general eliminado', '#475569');
      posRender();
    } catch (e) {
      toast(e.message || 'Error eliminando servicio', '#EF4444');
    }
  });
}

/* ── SUBTAB 4: AJUSTES DE CAJA Y PIN (PIN-PROTEGIDO) ── */
function _pRenderAjustes() {
  var cfg = POS_STATE.posConfig || {};
  return '<div class="pos-sec-label">Seguridad · PIN del propietario</div>'
    + '<div class="pos-surface pos-surface-pad">'
    + '  <div style="font-size:13px;color:var(--t2);margin-bottom:14px">' + (POS_STATE.hasCustomPin ? 'Tu PIN personalizado está activo.' : 'Actualmente usas el PIN inicial por defecto (12345). Cámbialo cuando quieras.') + '</div>'
    + '  <div class="field"><label for="pos-pin-cur">PIN actual</label><input class="inp" id="pos-pin-cur" type="password" inputmode="numeric" maxlength="8" placeholder="•••••"/></div>'
    + '  <div style="display:flex;gap:10px">'
    + '    <div class="field" style="flex:1"><label for="pos-pin-new">Nuevo PIN (4-8 dígitos)</label><input class="inp" id="pos-pin-new" type="password" inputmode="numeric" maxlength="8" placeholder="•••••"/></div>'
    + '    <div class="field" style="flex:1"><label for="pos-pin-new2">Repetir nuevo PIN</label><input class="inp" id="pos-pin-new2" type="password" inputmode="numeric" maxlength="8" placeholder="•••••"/></div>'
    + '  </div>'
    + '  <button type="button" class="pos-btn primary full" id="pos-btn-save-pin" onclick="posSaveNewPin()">Actualizar PIN</button>'
    + '</div>'

    + '<div class="pos-sec-label">Preferencias operativas</div>'
    + '<div class="pos-surface pos-surface-pad">'
    + '  <div style="display:flex;gap:10px">'
    + '    <div class="field" style="flex:1"><label for="pos-cfg-stock">Aviso stock bajo (uds)</label><input class="inp pos-num" id="pos-cfg-stock" type="number" min="0" step="1" value="' + (cfg.low_stock_alert != null ? cfg.low_stock_alert : 5) + '"/></div>'
    + '    <div class="field" style="flex:1"><label for="pos-cfg-close">Recordatorio de cierre</label><input class="inp" id="pos-cfg-close" type="time" value="' + san(cfg.close_reminder_time || '21:00') + '"/></div>'
    + '  </div>'
    + '  <button type="button" class="pos-btn secondary full" id="pos-btn-save-cfg" onclick="posSaveConfig()">Guardar preferencias</button>'
    + '</div>'

    + '<div class="pos-sec-label">Inventario y códigos de barras</div>'
    + '<div class="pos-surface">'
    + '  <div class="pos-row clickable" onclick="bizTab(\'tienda\')">'
    + '    <div class="pos-row-main"><div class="pos-row-title">Gestionar productos y stock</div><div class="pos-row-sub">Edita precios, costes, códigos de barras y existencias desde tu pestaña Tienda</div></div>'
    + '    <span style="font-size:13px;color:var(--blue);font-weight:600">Abrir Tienda</span>'
    + '  </div>'
    + '</div>';
}

async function posSaveNewPin() {
  if (!CUR || !CUR.id) return;
  var curPin = V('pos-pin-cur').trim();
  var p1 = V('pos-pin-new').trim();
  var p2 = V('pos-pin-new2').trim();
  if (!curPin || !p1) { toast('Completa los campos del PIN', '#EF4444'); return; }
  if (!/^\d{4,8}$/.test(p1)) { toast('El nuevo PIN debe tener entre 4 y 8 números', '#EF4444'); return; }
  if (p1 !== p2) { toast('Los nuevos PIN no coinciden', '#EF4444'); return; }

  var btn = G('pos-btn-save-pin');
  if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }
  try {
    var res = await fetch('/api/pos/update-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: CUR.id, current_pin: curPin, new_pin: p1 })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo actualizar el PIN');
    POS_STATE.hasCustomPin = true;
    toast('PIN actualizado correctamente', '#22C55E');
    posRender();
  } catch (e) {
    toast(e.message || 'Error actualizando PIN', '#EF4444');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Actualizar PIN'; }
  }
}

async function posSaveConfig() {
  if (!CUR || !CUR.id) return;
  var low = parseInt(V('pos-cfg-stock'), 10);
  var closeTime = V('pos-cfg-close') || '21:00';
  var btn = G('pos-btn-save-cfg');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    var nextCfg = Object.assign({}, POS_STATE.posConfig, {
      low_stock_alert: isNaN(low) ? 5 : Math.max(0, low),
      close_reminder_time: closeTime
    });
    var res = await fetch('/api/pos/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: CUR.id, pos_config: nextCfg })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo guardar');
    POS_STATE.posConfig = data.posConfig || nextCfg;
    toast('Preferencias guardadas', '#22C55E');
    posRender();
  } catch (e) {
    toast(e.message || 'Error guardando preferencias', '#EF4444');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar preferencias'; }
  }
}

/* ── INTEGRACIÓN CON AGENDA: "Cobrar en Caja" desde una cita ── */
async function posChargeAppointment(apptId) {
  if (!CUR) return;
  var appt = null;
  var workerObj = null;
  (CUR.workers || []).forEach(function (w) {
    (w.appointments || []).forEach(function (a) {
      if (String(a.id) === String(apptId)) { appt = a; workerObj = w; }
    });
  });
  if (!appt) {
    (CUR.appointments || []).forEach(function (a) {
      if (String(a.id) === String(apptId)) appt = a;
    });
  }
  if (!appt) return;

  closeOv('ov-appt-detail');
  if (typeof bizTab === 'function') bizTab('caja');
  await posLoadState(true);
  posResetCart();
  POS_STATE.subtab = 'cobrar';

  POS_STATE.cart.appointmentId = appt.id;
  if (appt.client) {
    POS_STATE.cart.client = {
      id: null,
      name: appt.client,
      phone: appt.phone || '',
      email: appt.email || ''
    };
  }
  if (appt.svc) {
    var svcKey = 'appt_' + appt.id;
    POS_STATE.cart.services[svcKey] = {
      id: '',
      name: appt.svc,
      price: parseFloat(appt.price) || 0,
      qty: 1,
      isGeneral: !workerObj
    };
  }
  if (workerObj) {
    POS_STATE.cart.workerId = workerObj.id;
    POS_STATE.cart.workerName = workerObj.name;
  }

  POS_STATE.cart.step = 2; // Ir directo a Productos por si lleva algo extra
  posRender();
  toast('Cita cargada en Caja. Añade productos o continúa al cobro.', '#4A7FD4');
}

/* ── DETECTOR GLOBAL DE LECTOR DE CÓDIGOS DE BARRAS (USB / BLUETOOTH HID) ── */
(function initHidBarcodeScanner() {
  var buf = '';
  var lastTime = 0;
  var GAP_MS = 65;

  document.addEventListener('keydown', function (e) {
    // Solo escuchar cuando el panel de negocio (Caja, Tienda o Modal producto) está activo
    var bizScr = document.getElementById('s-biz');
    if (!bizScr || !bizScr.classList.contains('on')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) { buf = ''; return; }

    var now = performance.now();
    if (e.key === 'Enter') {
      if (buf.length >= 4 && (now - lastTime) <= GAP_MS * 2) {
        var activeEl = document.activeElement;
        var isOwnScanInput = activeEl && (activeEl.id === 'pos-prod-scan' || activeEl.id === 'tienda-search-input' || activeEl.id === 'prod-barcode');
        if (!isOwnScanInput) {
          e.preventDefault();
          e.stopPropagation();
          var scanned = buf;
          buf = '';
          posHandleScannedBarcode(scanned);
          return;
        }
      }
      buf = '';
      return;
    }

    if (e.key && e.key.length === 1) {
      if (buf && (now - lastTime) > GAP_MS) {
        buf = '';
      }
      buf += e.key;
      lastTime = now;
    } else if (e.key !== 'Shift' && e.key !== 'CapsLock') {
      buf = '';
    }
  }, true);
})();

/* ── Exportar globales ── */
window.initPosPanel = initPosPanel;
window.posRender = posRender;
window.posSwitchTab = posSwitchTab;
window.posToggleLock = posToggleLock;
window.submitPosPin = submitPosPin;
window.posResetCart = posResetCart;
window.posGoStep = posGoStep;
window.posRenderClientMatches = posRenderClientMatches;
window.posSelectClient = posSelectClient;
window.posNextFromClient = posNextFromClient;
window.posRenderProductGrid = posRenderProductGrid;
window.posAddProd = posAddProd;
window.posSubProd = posSubProd;
window.posManualBarcodeScan = posManualBarcodeScan;
window.posToggleSvc = posToggleSvc;
window.posAdjSvc = posAdjSvc;
window.posPickWorker = posPickWorker;
window.posUpdatePayTotal = posUpdatePayTotal;
window.posConfirmSale = posConfirmSale;
window.posOpenCloseFlow = posOpenCloseFlow;
window.posUpdateCloseDiff = posUpdateCloseDiff;
window.posSubmitOpenRegister = posSubmitOpenRegister;
window.posSubmitCloseRegister = posSubmitCloseRegister;
window.posReopenRegister = posReopenRegister;
window.posVoidSale = posVoidSale;
window.openGeneralServiceModal = openGeneralServiceModal;
window.saveGeneralService = saveGeneralService;
window.deleteCurrentGeneralService = deleteCurrentGeneralService;
window.posSaveNewPin = posSaveNewPin;
window.posSaveConfig = posSaveConfig;
window.posChargeAppointment = posChargeAppointment;

