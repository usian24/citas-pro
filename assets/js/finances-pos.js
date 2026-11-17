'use strict';

/* ══════════════════════════════════════════════════
   FINANCES-POS.JS — Finanzas Reales, Gastos, Impuestos, Liquidación y Gráficas
   Conectado a /api/pos/finance-summary, /api/pos/expense y /api/pos/config
   Estilo Apple limpio · Sin emojis · Sin cards anidadas · Moneda dinámica
══════════════════════════════════════════════════ */

window.FIN_STATE = {
  loading: false,
  subtab: 'resumen', // 'resumen' | 'gastos' | 'liquidacion' | 'graficas'
  period: 'm',       // 'd' | 's' | 'm' | 'r'
  liqPeriod: 'q',    // 'q' (quincena actual) | 'p' (quincena anterior) | 'm' | 'r'
  chartDays: 14,     // 14 | 30 | 60
  from: '',
  to: '',
  showTaxEditor: false,
  country: 'ES',
  posConfig: {},
  sales: [],
  expenses: [],
  products: [],
  workers: [],
  appointments: []
};

var FIN_TAX_DEFAULTS = {
  ES: { name: 'IVA', rate_services: 21, rate_products: 21, included: true },
  PE: { name: 'IGV', rate_services: 18, rate_products: 18, included: true },
  CO: { name: 'IVA', rate_services: 19, rate_products: 19, included: true },
  MX: { name: 'IVA', rate_services: 16, rate_products: 16, included: true },
  AR: { name: 'IVA', rate_services: 21, rate_products: 21, included: true },
  CL: { name: 'IVA', rate_services: 19, rate_products: 19, included: true },
  EC: { name: 'IVA', rate_services: 15, rate_products: 15, included: true },
  DO: { name: 'ITBIS', rate_services: 18, rate_products: 18, included: true },
  VE: { name: 'IVA', rate_services: 16, rate_products: 16, included: true },
  BR: { name: 'ICMS', rate_services: 17, rate_products: 17, included: true },
  US: { name: 'Sales tax', rate_services: 0, rate_products: 0, included: false },
  DE: { name: 'MwSt', rate_services: 19, rate_products: 19, included: true },
  FR: { name: 'TVA', rate_services: 20, rate_products: 20, included: true },
  NL: { name: 'BTW', rate_services: 21, rate_products: 21, included: true }
};

var FIN_EXPENSE_CATS = [
  'Alquiler',
  'Luz',
  'Agua',
  'Internet y teléfono',
  'Material y productos',
  'Sueldos',
  'Impuestos y gestoría',
  'Marketing',
  'Otros'
];

function _fSvg(name, size) {
  var s = size || 15;
  var icons = {
    chart: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    receipt: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>',
    wallet: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 14h.01"/><path d="M2 10h20"/></svg>',
    users: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    print: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    send: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    sliders: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
    trash: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'
  };
  return icons[name] || '';
}

function _fNow() {
  var ctry = (CUR && CUR.country) ? CUR.country : 'ES';
  return typeof ahoraEnNegocio === 'function' ? ahoraEnNegocio(ctry) : new Date();
}

function _fDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _fToday() {
  return _fDateStr(_fNow());
}

function _fFmtDate(iso) {
  if (!iso) return '—';
  var p = String(iso).split('-');
  return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : iso;
}

function _fDaysDiff(a, b) {
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

function _fActiveTax() {
  if (FIN_STATE.posConfig && FIN_STATE.posConfig.tax) {
    return FIN_STATE.posConfig.tax;
  }
  var ctry = (CUR && CUR.country) || FIN_STATE.country || 'ES';
  return FIN_TAX_DEFAULTS[ctry] || FIN_TAX_DEFAULTS.ES;
}

function _fTaxSplit(amount, rate, included) {
  if (!rate || rate <= 0) return { base: amount, tax: 0 };
  if (included) {
    var base = amount / (1 + rate / 100);
    return { base: base, tax: amount - base };
  }
  return { base: amount, tax: amount * (rate / 100) };
}

function _fActiveRange() {
  var n = _fNow();
  var y = n.getFullYear(), m = n.getMonth(), d = n.getDate();
  var today = _fDateStr(n);

  if (FIN_STATE.subtab === 'graficas') {
    var start = new Date(y, m, d - FIN_STATE.chartDays + 1);
    return [_fDateStr(start), today];
  }

  if (FIN_STATE.subtab === 'liquidacion') {
    var lp = FIN_STATE.liqPeriod;
    if (lp === 'q') {
      return d <= 15
        ? [_fDateStr(new Date(y, m, 1)), _fDateStr(new Date(y, m, 15))]
        : [_fDateStr(new Date(y, m, 16)), _fDateStr(new Date(y, m + 1, 0))];
    }
    if (lp === 'p') {
      return d <= 15
        ? [_fDateStr(new Date(y, m - 1, 16)), _fDateStr(new Date(y, m, 0))]
        : [_fDateStr(new Date(y, m, 1)), _fDateStr(new Date(y, m, 15))];
    }
    if (lp === 'm') {
      return [_fDateStr(new Date(y, m, 1)), _fDateStr(new Date(y, m + 1, 0))];
    }
    return [FIN_STATE.from || _fDateStr(new Date(y, m, 1)), FIN_STATE.to || today];
  }

  // Resumen y Gastos
  var p = FIN_STATE.period;
  if (p === 'd') return [today, today];
  if (p === 's') {
    var offset = (n.getDay() + 6) % 7;
    return [_fDateStr(new Date(y, m, d - offset)), today];
  }
  if (p === 'm') return [_fDateStr(new Date(y, m, 1)), today];
  return [FIN_STATE.from || _fDateStr(new Date(y, m, 1)), FIN_STATE.to || today];
}

function _fExpensesInRange(from, to) {
  if (!from || !to || from > to) return 0;
  var total = 0;
  (FIN_STATE.expenses || []).forEach(function (g) {
    var imp = parseFloat(g.amount) || 0;
    if (g.is_recurring) {
      var start = g.expense_date > from ? g.expense_date : from;
      if (start <= to) {
        total += (imp / 30.4) * (_fDaysDiff(start, to) + 1);
      }
    } else if (g.expense_date >= from && g.expense_date <= to) {
      total += imp;
    }
  });
  return Math.round(total * 100) / 100;
}

/* ── Carga desde Supabase (/api/pos/finance-summary) ── */
async function finLoadData() {
  if (!CUR || !CUR.id) return;
  FIN_STATE.loading = true;
  var range = _fActiveRange();
  try {
    var url = '/api/pos/finance-summary?business_id=' + encodeURIComponent(CUR.id)
      + '&from=' + encodeURIComponent(range[0])
      + '&to=' + encodeURIComponent(range[1]);
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error cargando finanzas');
    var data = await res.json();
    FIN_STATE.country = data.country || (CUR.country || 'ES');
    FIN_STATE.posConfig = data.posConfig || {};
    FIN_STATE.sales = data.sales || [];
    FIN_STATE.expenses = data.expenses || [];
    FIN_STATE.products = data.products || [];
    FIN_STATE.workers = data.workers || [];
    FIN_STATE.appointments = data.appointments || [];
  } catch (e) {
    console.error('[FIN] Error:', e);
    toast('No se pudieron cargar las finanzas', '#EF4444');
  } finally {
    FIN_STATE.loading = false;
  }
}

async function initBizFinancesPro() {
  if (!CUR || !CUR.id) return;
  var root = G('fin-pro-root');
  if (root && !FIN_STATE.sales.length && !FIN_STATE.expenses.length) {
    root.innerHTML = '<div class="pos-surface pos-surface-pad" style="text-align:center;color:var(--t2);font-size:13px">Cargando finanzas...</div>';
  }
  await finLoadData();
  finRender();
}

async function finSwitchTab(tab) {
  FIN_STATE.subtab = tab;
  await finLoadData();
  finRender();
}

async function finSetPeriod(p) {
  FIN_STATE.period = p;
  if (p === 'r') {
    var n = _fNow();
    if (!FIN_STATE.from) FIN_STATE.from = _fDateStr(new Date(n.getFullYear(), n.getMonth(), 1));
    if (!FIN_STATE.to) FIN_STATE.to = _fToday();
  }
  await finLoadData();
  finRender();
}

async function finSetLiqPeriod(p) {
  FIN_STATE.liqPeriod = p;
  if (p === 'r') {
    var n = _fNow();
    if (!FIN_STATE.from) FIN_STATE.from = _fDateStr(new Date(n.getFullYear(), n.getMonth(), 1));
    if (!FIN_STATE.to) FIN_STATE.to = _fToday();
  }
  await finLoadData();
  finRender();
}

async function finSetChartDays(days) {
  FIN_STATE.chartDays = days;
  await finLoadData();
  finRender();
}

async function finSetCustomRange(fromVal, toVal) {
  if (fromVal !== undefined) FIN_STATE.from = fromVal;
  if (toVal !== undefined) FIN_STATE.to = toVal;
  await finLoadData();
  finRender();
}

/* ══════════════════════════════════════════════════
   RENDER PRINCIPAL DE FINANZAS
══════════════════════════════════════════════════ */
function finRender() {
  var root = G('fin-pro-root');
  if (!root || !CUR) return;
  var range = _fActiveRange();

  var html = ''
    + '<div class="pos-header no-print">'
    + '  <div class="pos-title-group">'
    + '    <div class="pos-title">Finanzas</div>'
    + '    <div class="pos-subtitle">' + san(_fFmtDate(range[0])) + (range[0] !== range[1] ? ' – ' + san(_fFmtDate(range[1])) : '') + ' · Datos reales de Caja</div>'
    + '  </div>'
    + '  <div class="pos-header-actions">'
    + '    <button type="button" class="pos-btn secondary sm" onclick="finExportSalesCsv()">Exportar CSV</button>'
    + '  </div>'
    + '</div>';

  var tabs = [
    { id: 'resumen', label: 'Resumen', icon: 'receipt' },
    { id: 'gastos', label: 'Gastos', icon: 'wallet' },
    { id: 'liquidacion', label: 'Liquidación', icon: 'users' },
    { id: 'graficas', label: 'Gráficas', icon: 'chart' }
  ];

  html += '<div class="pos-seg no-print">';
  tabs.forEach(function (t) {
    html += '<button type="button" class="pos-seg-btn' + (FIN_STATE.subtab === t.id ? ' active' : '') + '" onclick="finSwitchTab(\'' + t.id + '\')">'
      + _fSvg(t.icon, 14) + '<span>' + t.label + '</span></button>';
  });
  html += '</div>';

  if (FIN_STATE.subtab === 'resumen') html += _fRenderResumen(range);
  else if (FIN_STATE.subtab === 'gastos') html += _fRenderGastos(range);
  else if (FIN_STATE.subtab === 'liquidacion') html += _fRenderLiquidacion(range);
  else html += _fRenderGraficas(range);

  root.innerHTML = html;
}

function _fRenderDateInputs() {
  return '<div class="pos-surface pos-surface-pad no-print" style="margin-bottom:14px">'
    + '<div style="display:flex;gap:10px">'
    + '  <div class="field" style="flex:1;margin-bottom:0"><label for="fin-from">Desde</label><input class="inp" id="fin-from" type="date" value="' + san(FIN_STATE.from) + '" onchange="finSetCustomRange(this.value, undefined)"/></div>'
    + '  <div class="field" style="flex:1;margin-bottom:0"><label for="fin-to">Hasta</label><input class="inp" id="fin-to" type="date" value="' + san(FIN_STATE.to) + '" onchange="finSetCustomRange(undefined, this.value)"/></div>'
    + '</div></div>';
}

/* ── SUBTAB 1: RESUMEN + IMPUESTOS + BENEFICIO REAL ── */
function _fRenderResumen(range) {
  var sales = FIN_STATE.sales || [];
  var tax = _fActiveTax();
  var prodMap = {};
  (FIN_STATE.products || []).forEach(function (p) { prodMap[p.id] = p; prodMap['n:' + p.name] = p; });

  var totalSales = 0, svcGross = 0, prodGross = 0, totalDisc = 0, totalTips = 0;
  var byMethod = {};
  var byWorker = {};
  var prodSold = {};
  var netSvcForTax = 0, netProdForTax = 0;
  var prodCostTotal = 0, unitsWithoutCost = 0;

  sales.forEach(function (s) {
    var tot = parseFloat(s.total) || 0;
    var svT = parseFloat(s.services_total) || 0;
    var prT = parseFloat(s.products_total) || 0;
    var disc = (parseFloat(s.discount_manual) || 0) + (parseFloat(s.discount_loyalty) || 0);
    var tip = parseFloat(s.tip) || 0;

    totalSales += tot;
    svcGross += svT;
    prodGross += prT;
    totalDisc += disc;
    totalTips += tip;
    byMethod[s.payment_method || 'Otro'] = (byMethod[s.payment_method || 'Otro'] || 0) + tot;

    // Reparto proporcional de descuentos para cálculo de impuestos
    var grossLine = svT + prT;
    if (grossLine > 0) {
      netSvcForTax += Math.max(0, svT - disc * (svT / grossLine));
      netProdForTax += Math.max(0, prT - disc * (prT / grossLine));
    }

    var wKey = s.worker_name || 'Sin asignar';
    if (!byWorker[wKey]) byWorker[wKey] = { svcs: 0, svcRev: 0, prodUnits: 0, prodRev: 0, tips: 0 };
    byWorker[wKey].tips += tip;
    byWorker[wKey].svcRev += svT;
    byWorker[wKey].prodRev += prT;

    (s.items_services || []).forEach(function (it) {
      byWorker[wKey].svcs += (parseInt(it.qty, 10) || 1);
    });

    (s.items_products || []).forEach(function (it) {
      var q = parseInt(it.qty, 10) || 0;
      var up = parseFloat(it.price) || 0;
      byWorker[wKey].prodUnits += q;

      if (!prodSold[it.name]) prodSold[it.name] = { qty: 0, rev: 0 };
      prodSold[it.name].qty += q;
      prodSold[it.name].rev += q * up;

      var dbP = prodMap[it.id] || prodMap['n:' + it.name];
      var unitCost = parseFloat(it.cost_price) || (dbP ? parseFloat(dbP.cost_price) || 0 : 0);
      if (unitCost > 0) prodCostTotal += q * unitCost;
      else if (q > 0) unitsWithoutCost += q;
    });
  });

  var spSvc = _fTaxSplit(netSvcForTax, tax.rate_services, tax.included);
  var spProd = _fTaxSplit(netProdForTax, tax.rate_products, tax.included);
  var totalTax = Math.round((spSvc.tax + spProd.tax) * 100) / 100;
  var totalBase = Math.round((spSvc.base + spProd.base) * 100) / 100;
  var expensesTotal = _fExpensesInRange(range[0], range[1]);
  var netProfit = Math.round((totalBase - prodCostTotal - expensesTotal) * 100) / 100;

  var html = '<div class="fin-period-row no-print">'
    + [['d', 'Hoy'], ['s', 'Semana'], ['m', 'Mes'], ['r', 'Fechas']].map(function (o) {
        return '<button type="button" class="pos-quick-chip' + (FIN_STATE.period === o[0] ? ' active' : '') + '" onclick="finSetPeriod(\'' + o[0] + '\')">' + o[1] + '</button>';
      }).join('')
    + '</div>';

  if (FIN_STATE.period === 'r') html += _fRenderDateInputs();

  // KPI strip plano de 3 columnas
  html += '<div class="pos-kpi-strip">'
    + '<div class="pos-kpi-cell"><div class="pos-kpi-lbl">Ventas cobradas</div><div class="pos-kpi-val">' + money(totalSales) + '</div></div>'
    + '<div class="pos-kpi-cell"><div class="pos-kpi-lbl">Beneficio estimado</div><div class="pos-kpi-val" style="color:' + (netProfit < 0 ? 'var(--red)' : 'var(--green)') + '">' + money(netProfit) + '</div></div>'
    + '<div class="pos-kpi-cell"><div class="pos-kpi-lbl">Cobros</div><div class="pos-kpi-val">' + sales.length + '</div></div>'
    + '</div>';

  // Venta general
  html += '<div class="pos-sec-label">Desglose de ventas</div><div class="pos-surface">'
    + '<div class="pos-row"><span class="pos-row-sub">Servicios</span><span class="pos-row-val">' + money(svcGross) + '</span></div>'
    + '<div class="pos-row"><span class="pos-row-sub">Productos</span><span class="pos-row-val">' + money(prodGross) + '</span></div>'
    + (totalDisc > 0 ? '<div class="pos-row"><span class="pos-row-sub">Descuentos</span><span class="pos-row-val" style="color:var(--red)">−' + money(totalDisc) + '</span></div>' : '');
  Object.keys(byMethod).forEach(function (m) {
    html += '<div class="pos-row"><span class="pos-row-sub">' + san(m) + '</span><span class="pos-row-val">' + money(byMethod[m]) + '</span></div>';
  });
  if (totalTips > 0) {
    html += '<div class="pos-row"><span class="pos-row-sub">Propinas (aparte)</span><span class="pos-row-val" style="color:var(--green)">' + money(totalTips) + '</span></div>';
  }
  html += '<div class="pos-row total-row"><span>Total cobrado</span><span style="color:var(--blue)">' + money(totalSales) + '</span></div></div>';

  // Beneficio real estimado
  html += '<div class="pos-sec-label">Beneficio real estimado</div><div class="pos-surface">'
    + '<div class="pos-row"><span class="pos-row-sub">Ventas cobradas</span><span class="pos-row-val">' + money(totalSales) + '</span></div>'
    + (tax.included ? '<div class="pos-row"><span class="pos-row-sub">− ' + san(tax.name) + ' estimado</span><span class="pos-row-val">−' + money(totalTax) + '</span></div>' : '')
    + '<div class="pos-row"><span class="pos-row-sub">Base imponible (sin ' + san(tax.name) + ')</span><span class="pos-row-val">' + money(totalBase) + '</span></div>'
    + '<div class="pos-row"><span class="pos-row-sub">− Coste de productos vendidos</span><span class="pos-row-val">−' + money(prodCostTotal) + '</span></div>'
    + '<div class="pos-row clickable" onclick="finSwitchTab(\'gastos\')"><span class="pos-row-sub">− Gastos del periodo (ver gastos)</span><span class="pos-row-val">−' + money(expensesTotal) + '</span></div>'
    + '<div class="pos-row total-row"><span>Beneficio neto estimado</span><span style="color:' + (netProfit < 0 ? 'var(--red)' : 'var(--green)') + '">' + money(netProfit) + '</span></div>'
    + '</div>';

  if (unitsWithoutCost > 0) {
    html += '<div style="font-size:12px;color:var(--t2);margin:-6px 4px 14px">' + unitsWithoutCost + ' unidad(es) vendida(s) sin coste de compra configurado en Tienda.</div>';
  }

  // Simulación de impuestos
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin:18px 4px 8px">'
    + '<div class="pos-sec-label" style="margin:0">Simulación de ' + san(tax.name) + '</div>'
    + '<button type="button" class="pos-btn secondary sm no-print" onclick="FIN_STATE.showTaxEditor=!FIN_STATE.showTaxEditor;finRender()">' + _fSvg('sliders', 13) + ' Configurar</button>'
    + '</div>';

  if (FIN_STATE.showTaxEditor) {
    html += '<div class="pos-surface pos-surface-pad no-print">'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
      + '  <div class="field" style="flex:1;min-width:120px"><label for="fin-tx-name">Nombre</label><input class="inp" id="fin-tx-name" value="' + san(tax.name) + '" maxlength="20"/></div>'
      + '  <div class="field" style="flex:1;min-width:100px"><label for="fin-tx-svc">% Servicios</label><input class="inp pos-num" id="fin-tx-svc" type="number" min="0" max="60" step="0.1" value="' + tax.rate_services + '"/></div>'
      + '  <div class="field" style="flex:1;min-width:100px"><label for="fin-tx-prod">% Productos</label><input class="inp pos-num" id="fin-tx-prod" type="number" min="0" max="60" step="0.1" value="' + tax.rate_products + '"/></div>'
      + '</div>'
      + '<div class="field"><label for="fin-tx-inc">Los precios ya incluyen el impuesto</label>'
      + '  <select class="inp" id="fin-tx-inc"><option value="1"' + (tax.included ? ' selected' : '') + '>Sí (incluido)</option><option value="0"' + (!tax.included ? ' selected' : '') + '>No (se suma aparte)</option></select>'
      + '</div>'
      + '<button type="button" class="pos-btn primary full" onclick="finSaveTaxConfig()">Guardar impuestos</button>'
      + '</div>';
  }

  html += '<div class="pos-surface">'
    + '<div class="pos-row"><span class="pos-row-sub">' + san(tax.name) + ' servicios (' + tax.rate_services + '%)</span><span class="pos-row-val">' + money(spSvc.tax) + '</span></div>'
    + '<div class="pos-row"><span class="pos-row-sub">' + san(tax.name) + ' productos (' + tax.rate_products + '%)</span><span class="pos-row-val">' + money(spProd.tax) + '</span></div>'
    + '<div class="pos-row total-row"><span>' + san(tax.name) + ' estimado a declarar</span><span>' + money(totalTax) + '</span></div>'
    + '</div>'
    + '<div style="font-size:11.5px;color:var(--muted);margin:-6px 4px 14px">Simulación orientativa para control interno; en tu declaración real se descuenta el impuesto de tus compras y gastos deducibles.</div>';

  // Por profesional
  var workerKeys = Object.keys(byWorker);
  html += '<div class="pos-sec-label">Rendimiento por profesional</div><div class="pos-surface">';
  if (!workerKeys.length) {
    html += '<div class="pos-row"><span class="pos-row-sub">Sin cobros registrados en este periodo.</span></div>';
  } else {
    workerKeys.forEach(function (wk) {
      var o = byWorker[wk];
      html += '<div class="pos-row">'
        + '<div class="pos-row-main"><div class="pos-row-title">' + san(wk) + '</div>'
        + '<div class="pos-row-sub">' + o.svcs + ' serv. (' + money(o.svcRev) + ') · ' + o.prodUnits + ' prod. (' + money(o.prodRev) + ')' + (o.tips > 0 ? ' · Propina ' + money(o.tips) : '') + '</div></div>'
        + '<div class="pos-row-val" style="color:var(--blue)">' + money(o.svcRev + o.prodRev) + '</div>'
        + '</div>';
    });
  }
  html += '</div>';

  // Cuadre automático: Citas en Agenda vs Servicios cobrados en Caja
  var workerNameById = {};
  (FIN_STATE.workers || []).forEach(function (w) { workerNameById[w.id] = w.name; });
  var cuadre = {};
  (FIN_STATE.appointments || []).forEach(function (a) {
    var wn = (a.worker_id && workerNameById[a.worker_id]) ? workerNameById[a.worker_id] : 'Servicios Generales';
    if (!cuadre[wn]) cuadre[wn] = { citas: 0, cobros: 0 };
    cuadre[wn].citas += 1;
  });
  Object.keys(byWorker).forEach(function (wn) {
    if (!cuadre[wn]) cuadre[wn] = { citas: 0, cobros: 0 };
    cuadre[wn].cobros += byWorker[wn].svcs;
  });
  var cuadreKeys = Object.keys(cuadre);
  if (cuadreKeys.length > 0) {
    html += '<div class="pos-sec-label">Cuadre: Citas vs Cobros en Caja</div><div class="pos-surface">';
    cuadreKeys.forEach(function (k) {
      var q = cuadre[k];
      var diff = q.citas - q.cobros;
      var badge = diff > 0
        ? '<span class="pos-stock-tag low">' + diff + ' sin cobrar</span>'
        : '<span class="pos-stock-tag" style="color:var(--green);border-color:rgba(34,197,94,.3)">Al día</span>';
      html += '<div class="pos-row">'
        + '<div class="pos-row-main"><div class="pos-row-title">' + san(k) + '</div><div class="pos-row-sub">' + q.citas + ' cita' + (q.citas === 1 ? '' : 's') + ' · ' + q.cobros + ' cobrado' + (q.cobros === 1 ? '' : 's') + '</div></div>'
        + badge
        + '</div>';
    });
    html += '</div>';
  }

  // Productos vendidos
  var pKeys = Object.keys(prodSold).sort(function (a, b) { return prodSold[b].qty - prodSold[a].qty; });
  html += '<div class="pos-sec-label">Productos vendidos</div><div class="pos-surface">';
  if (!pKeys.length) {
    html += '<div class="pos-row"><span class="pos-row-sub">No hay productos vendidos en este periodo.</span></div>';
  } else {
    pKeys.forEach(function (pn) {
      html += '<div class="pos-row"><div class="pos-row-main"><div class="pos-row-title">' + san(pn) + '</div><div class="pos-row-sub">' + prodSold[pn].qty + ' unidad' + (prodSold[pn].qty === 1 ? '' : 'es') + '</div></div><div class="pos-row-val">' + money(prodSold[pn].rev) + '</div></div>';
    });
  }
  html += '</div>';

  // Productos para reponer
  var lowAlert = (FIN_STATE.posConfig && FIN_STATE.posConfig.low_stock_alert != null) ? FIN_STATE.posConfig.low_stock_alert : 5;
  var lowStock = (FIN_STATE.products || []).filter(function (p) {
    var minS = p.min_stock != null ? p.min_stock : lowAlert;
    return p.active !== false && (parseInt(p.stock, 10) || 0) <= minS;
  }).sort(function (a, b) { return (a.stock || 0) - (b.stock || 0); });

  html += '<div class="pos-sec-label">Stock para reponer</div><div class="pos-surface">';
  if (!lowStock.length) {
    html += '<div class="pos-row"><span class="pos-row-sub">Todo el inventario está por encima del mínimo.</span></div>';
  } else {
    lowStock.forEach(function (p) {
      var st = parseInt(p.stock, 10) || 0;
      html += '<div class="pos-row"><span class="pos-row-title">' + san(p.name) + '</span><span class="pos-stock-tag ' + (st <= 0 ? 'out' : 'low') + '">' + (st <= 0 ? 'Agotado' : st + ' uds') + '</span></div>';
    });
  }
  html += '</div>';

  return html;
}

async function finSaveTaxConfig() {
  if (!CUR || !CUR.id) return;
  var name = V('fin-tx-name').trim() || 'IVA';
  var rs = parseFloat(V('fin-tx-svc')) || 0;
  var rp = parseFloat(V('fin-tx-prod')) || 0;
  var inc = V('fin-tx-inc') === '1';

  var nextCfg = Object.assign({}, FIN_STATE.posConfig || {}, {
    tax: { name: name, rate_services: rs, rate_products: rp, included: inc }
  });
  try {
    var res = await fetch('/api/pos/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: CUR.id, pos_config: nextCfg })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Error guardando impuestos');
    FIN_STATE.posConfig = data.posConfig || nextCfg;
    FIN_STATE.showTaxEditor = false;
    toast('Configuración de impuestos guardada', '#22C55E');
    finRender();
  } catch (e) {
    toast(e.message || 'No se pudo guardar', '#EF4444');
  }
}

/* ── SUBTAB 2: GASTOS ── */
function _fRenderGastos() {
  var n = _fNow();
  var mStart = _fDateStr(new Date(n.getFullYear(), n.getMonth(), 1));
  var today = _fToday();
  var monthTotal = _fExpensesInRange(mStart, today);
  var sym = typeof getSimboloMoneda === 'function' ? getSimboloMoneda() : '€';

  var catTotals = {};
  (FIN_STATE.expenses || []).forEach(function (g) {
    var imp = parseFloat(g.amount) || 0;
    if (g.is_recurring && g.expense_date <= today) {
      var st = g.expense_date > mStart ? g.expense_date : mStart;
      catTotals[g.category] = (catTotals[g.category] || 0) + (imp / 30.4) * (_fDaysDiff(st, today) + 1);
    } else if (!g.is_recurring && g.expense_date >= mStart && g.expense_date <= today) {
      catTotals[g.category] = (catTotals[g.category] || 0) + imp;
    }
  });

  var html = '<div class="pos-sec-label">Registrar gasto</div>'
    + '<div class="pos-surface pos-surface-pad">'
    + '  <div style="font-size:13px;color:var(--t2);margin-bottom:14px">Registra alquiler, suministros, material o sueldos para calcular el beneficio neto real. Los gastos mensuales se prorratean automáticamente por día.</div>'
    + '  <div style="display:flex;gap:10px;flex-wrap:wrap">'
    + '    <div class="field" style="flex:1;min-width:130px"><label for="fin-exp-date">Fecha</label><input class="inp" id="fin-exp-date" type="date" value="' + today + '"/></div>'
    + '    <div class="field" style="flex:1;min-width:140px"><label for="fin-exp-cat">Categoría</label><select class="inp" id="fin-exp-cat">'
    + FIN_EXPENSE_CATS.map(function (c) { return '<option value="' + san(c) + '">' + san(c) + '</option>'; }).join('')
    + '    </select></div>'
    + '  </div>'
    + '  <div class="field"><label for="fin-exp-concept">Concepto</label><input class="inp" id="fin-exp-concept" placeholder="Ej: Alquiler local, Reposición ceras..." maxlength="100"/></div>'
    + '  <div style="display:flex;gap:10px;flex-wrap:wrap">'
    + '    <div class="field" style="flex:1;min-width:130px"><label for="fin-exp-amt">Importe (' + san(sym) + ')</label><input class="inp pos-num" id="fin-exp-amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"/></div>'
    + '    <div class="field" style="flex:1;min-width:140px"><label for="fin-exp-rec">Frecuencia</label><select class="inp" id="fin-exp-rec"><option value="0">Una sola vez</option><option value="1">Cada mes (fijo)</option></select></div>'
    + '  </div>'
    + '  <button type="button" class="pos-btn primary full" id="fin-exp-save-btn" onclick="finAddExpense()">Guardar gasto</button>'
    + '</div>';

  html += '<div class="pos-sec-label">Gastos este mes · ' + money(monthTotal) + '</div><div class="pos-surface">';
  var catKeys = Object.keys(catTotals).sort(function (a, b) { return catTotals[b] - catTotals[a]; });
  if (!catKeys.length) {
    html += '<div class="pos-row"><span class="pos-row-sub">Sin gastos registrados este mes.</span></div>';
  } else {
    catKeys.forEach(function (ck) {
      html += '<div class="pos-row"><span class="pos-row-title">' + san(ck) + '</span><span class="pos-row-val">' + money(catTotals[ck]) + '</span></div>';
    });
  }
  html += '</div>';

  html += '<div class="pos-sec-label">Historial de gastos (' + (FIN_STATE.expenses || []).length + ')</div><div class="pos-surface">';
  if (!(FIN_STATE.expenses || []).length) {
    html += '<div class="pos-row"><span class="pos-row-sub">Aún no hay gastos registrados.</span></div>';
  } else {
    FIN_STATE.expenses.slice(0, 50).forEach(function (g) {
      html += '<div class="pos-row">'
        + '<div class="pos-row-main">'
        + '  <div class="pos-row-title">' + san(g.concept || g.category) + '</div>'
        + '  <div class="pos-row-sub">' + san(_fFmtDate(g.expense_date)) + ' · ' + san(g.category) + (g.is_recurring ? ' · Mensual recurrente' : '') + '</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:10px">'
        + '  <span class="pos-row-val">' + money(g.amount) + '</span>'
        + '  <button type="button" class="pos-btn danger-ghost" onclick="finDeleteExpense(\'' + san(g.id) + '\')" aria-label="Eliminar gasto">' + _fSvg('trash', 13) + '</button>'
        + '</div></div>';
    });
  }
  html += '</div>';
  return html;
}

async function finAddExpense() {
  if (!CUR || !CUR.id) return;
  var date = V('fin-exp-date');
  var category = V('fin-exp-cat');
  var concept = V('fin-exp-concept').trim();
  var amount = parseFloat(V('fin-exp-amt'));
  var isRec = V('fin-exp-rec') === '1';

  if (!date || isNaN(amount) || amount <= 0) {
    toast('Introduce una fecha y un importe mayor que 0', '#EF4444');
    return;
  }

  var btn = G('fin-exp-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    var res = await fetch('/api/pos/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: CUR.id,
        expense: {
          expense_date: date,
          category: category,
          concept: concept,
          amount: amount,
          is_recurring: isRec
        }
      })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Error guardando gasto');
    await finLoadData();
    toast('Gasto registrado', '#22C55E');
    finRender();
  } catch (e) {
    toast(e.message || 'No se pudo registrar el gasto', '#EF4444');
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar gasto'; }
  }
}

function finDeleteExpense(expId) {
  if (!CUR || !CUR.id) return;
  openConfirmModal('Eliminar gasto', 'Este gasto se eliminará del cálculo de beneficio.', async function () {
    try {
      var res = await fetch('/api/pos/expense-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: CUR.id, expense_id: expId })
      });
      var data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error eliminando');
      await finLoadData();
      toast('Gasto eliminado', '#475569');
      finRender();
    } catch (e) {
      toast(e.message || 'No se pudo eliminar', '#EF4444');
    }
  });
}

/* ── SUBTAB 3: LIQUIDACIÓN Y COMISIONES POR TRABAJADOR ── */
function _fRenderLiquidacion(range) {
  var sales = FIN_STATE.sales || [];
  var workers = FIN_STATE.workers || [];

  var map = {};
  workers.forEach(function (w) {
    map[w.id] = {
      id: w.id,
      name: w.name,
      phone: w.phone || '',
      commSvcPct: parseFloat(w.commission_services) || 0,
      commProdPct: parseFloat(w.commission_products) || 0,
      svcCount: 0,
      svcRev: 0,
      prodUnits: 0,
      prodRev: 0,
      tips: 0
    };
  });

  sales.forEach(function (s) {
    var key = (s.worker_id && map[s.worker_id]) ? s.worker_id : null;
    if (!key && s.worker_name) {
      var byName = workers.find(function (w) { return w.name === s.worker_name; });
      key = byName ? byName.id : ('name:' + s.worker_name);
    }
    if (!key) return;
    if (!map[key]) {
      map[key] = {
        id: key,
        name: s.worker_name || 'Profesional',
        phone: '',
        commSvcPct: 0,
        commProdPct: 0,
        svcCount: 0,
        svcRev: 0,
        prodUnits: 0,
        prodRev: 0,
        tips: 0
      };
    }
    var o = map[key];
    o.svcRev += parseFloat(s.services_total) || 0;
    o.prodRev += parseFloat(s.products_total) || 0;
    o.tips += parseFloat(s.tip) || 0;
    (s.items_services || []).forEach(function (it) { o.svcCount += (parseInt(it.qty, 10) || 1); });
    (s.items_products || []).forEach(function (it) { o.prodUnits += (parseInt(it.qty, 10) || 0); });
  });

  var rows = Object.keys(map).map(function (k) {
    var o = map[k];
    o.commSvc = Math.round((o.svcRev * o.commSvcPct / 100) * 100) / 100;
    o.commProd = Math.round((o.prodRev * o.commProdPct / 100) * 100) / 100;
    o.totalPay = Math.round((o.commSvc + o.commProd + o.tips) * 100) / 100;
    return o;
  });

  var grandTotal = rows.reduce(function (acc, r) { return acc + r.totalPay; }, 0);

  var html = '<div class="fin-period-row no-print">'
    + [['q', 'Esta quincena'], ['p', 'Quincena anterior'], ['m', 'Este mes'], ['r', 'Fechas']].map(function (o) {
        return '<button type="button" class="pos-quick-chip' + (FIN_STATE.liqPeriod === o[0] ? ' active' : '') + '" onclick="finSetLiqPeriod(\'' + o[0] + '\')">' + o[1] + '</button>';
      }).join('')
    + '</div>';

  if (FIN_STATE.liqPeriod === 'r') html += _fRenderDateInputs();

  html += '<div style="font-size:12.5px;color:var(--t2);margin:0 4px 14px" class="no-print">Los porcentajes de comisión de servicios y productos se configuran al editar cada trabajador en la pestaña <strong>Equipo</strong>.</div>';

  if (!rows.length) {
    html += '<div class="pos-surface pos-surface-pad" style="text-align:center;color:var(--t2);font-size:13px">No hay trabajadores registrados todavía.</div>';
    return html;
  }

  rows.forEach(function (r) {
    var tel = String(r.phone || '').replace(/\D/g, '');
    var waLines = [
      'Liquidación ' + (CUR.name || ''),
      r.name + ' · Del ' + _fFmtDate(range[0]) + ' al ' + _fFmtDate(range[1]),
      'Servicios: ' + r.svcCount + ' (' + money(r.svcRev) + ')',
      'Productos: ' + r.prodUnits + ' uds (' + money(r.prodRev) + ')',
      (r.commSvcPct ? 'Comisión servicios (' + r.commSvcPct + '%): ' + money(r.commSvc) : ''),
      (r.commProdPct ? 'Comisión productos (' + r.commProdPct + '%): ' + money(r.commProd) : ''),
      'Propinas: ' + money(r.tips),
      'TOTAL A PAGAR: ' + money(r.totalPay)
    ].filter(Boolean).join('\n');
    var waHref = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(waLines);

    html += '<div class="pos-surface fin-print-block">'
      + '<div class="pos-row"><div class="pos-row-title" style="font-size:15px">' + san(r.name) + '</div><span style="font-size:12px;color:var(--t2)">' + san(_fFmtDate(range[0])) + ' – ' + san(_fFmtDate(range[1])) + '</span></div>'
      + '<div class="pos-row"><span class="pos-row-sub">Servicios realizados (' + r.svcCount + ')</span><span class="pos-row-val">' + money(r.svcRev) + '</span></div>'
      + '<div class="pos-row"><span class="pos-row-sub">Productos vendidos (' + r.prodUnits + ' uds)</span><span class="pos-row-val">' + money(r.prodRev) + '</span></div>'
      + '<div class="pos-row"><span class="pos-row-sub">Comisión servicios (' + r.commSvcPct + '%)</span><span class="pos-row-val">' + money(r.commSvc) + '</span></div>'
      + '<div class="pos-row"><span class="pos-row-sub">Comisión productos (' + r.commProdPct + '%)</span><span class="pos-row-val">' + money(r.commProd) + '</span></div>'
      + '<div class="pos-row"><span class="pos-row-sub">Propinas</span><span class="pos-row-val">' + money(r.tips) + '</span></div>'
      + '<div class="pos-row total-row"><span>Total a pagar</span><span style="color:var(--green)">' + money(r.totalPay) + '</span></div>'
      + '<div class="pos-row no-print" style="justify-content:flex-end;gap:8px">'
      + '  <a class="pos-btn secondary sm" href="' + waHref + '" target="_blank" rel="noopener noreferrer">' + _fSvg('send', 13) + ' WhatsApp</a>'
      + '  <button type="button" class="pos-btn secondary sm" onclick="window.print()">' + _fSvg('print', 13) + ' Imprimir</button>'
      + '</div></div>';
  });

  html += '<div class="pos-surface"><div class="pos-row total-row"><span>Total a pagar al equipo</span><span style="color:var(--blue)">' + money(grandTotal) + '</span></div></div>';
  return html;
}

/* ── SUBTAB 4: GRÁFICAS OPERATIVAS ── */
function _fBarsHtml(rows, formatFn, barColor) {
  var maxVal = 0.0001;
  rows.forEach(function (r) { if (r[1] > maxVal) maxVal = r[1]; });
  return rows.map(function (r) {
    var pct = Math.round((r[1] / maxVal) * 100);
    return '<div class="fin-bar-row">'
      + '<span class="fin-bar-lbl">' + san(r[0]) + '</span>'
      + '<div class="fin-bar-track"><div class="fin-bar-fill" style="width:' + pct + '%;background:' + (barColor || 'var(--blue)') + '"></div></div>'
      + '<span class="fin-bar-val">' + (formatFn ? formatFn(r[1]) : r[1]) + '</span>'
      + '</div>';
  }).join('');
}

function _fRenderGraficas() {
  var sales = FIN_STATE.sales || [];
  var n = _fNow();
  var dayMap = {};
  for (var i = FIN_STATE.chartDays - 1; i >= 0; i--) {
    var dd = new Date(n.getFullYear(), n.getMonth(), n.getDate() - i);
    dayMap[_fDateStr(dd)] = 0;
  }

  var dow = [0, 0, 0, 0, 0, 0, 0];
  var hrs = {};
  var prods = {};
  var svcs = {};

  sales.forEach(function (s) {
    var tot = parseFloat(s.total) || 0;
    if (s.sale_date && dayMap[s.sale_date] !== undefined) {
      dayMap[s.sale_date] += tot;
    }
    if (s.sale_date) {
      var dObj = new Date(s.sale_date + 'T12:00:00');
      dow[(dObj.getDay() + 6) % 7] += 1;
    }
    if (s.created_at) {
      var h = new Date(s.created_at).getHours();
      hrs[h] = (hrs[h] || 0) + 1;
    }
    (s.items_products || []).forEach(function (p) {
      prods[p.name] = (prods[p.name] || 0) + (parseInt(p.qty, 10) || 0);
    });
    (s.items_services || []).forEach(function (sv) {
      svcs[sv.name] = (svcs[sv.name] || 0) + (parseInt(sv.qty, 10) || 1);
    });
  });

  var dayRows = Object.keys(dayMap).sort().map(function (k) {
    return [_fFmtDate(k).slice(0, 5), Math.round(dayMap[k] * 100) / 100];
  });
  var daySum = dayRows.reduce(function (a, r) { return a + r[1]; }, 0);
  var dowNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var hrRows = [];
  for (var h = 8; h <= 21; h++) hrRows.push([String(h).padStart(2, '0') + ':00', hrs[h] || 0]);

  function top5(obj) {
    return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, 5).map(function (k) { return [k, obj[k]]; });
  }
  var topProds = top5(prods);
  var topSvcs = top5(svcs);

  var html = '<div class="fin-period-row no-print">'
    + [14, 30, 60].map(function (d) {
        return '<button type="button" class="pos-quick-chip' + (FIN_STATE.chartDays === d ? ' active' : '') + '" onclick="finSetChartDays(' + d + ')">' + d + ' días</button>';
      }).join('')
    + '</div>';

  html += '<div class="pos-sec-label">Ventas por día · ' + money(daySum) + '</div>'
    + '<div class="pos-surface pos-surface-pad">' + _fBarsHtml(dayRows, money, 'var(--green)') + '</div>';

  html += '<div class="pos-sec-label">Días con más movimiento</div>'
    + '<div class="pos-surface pos-surface-pad">' + _fBarsHtml(dowNames.map(function (dn, idx) { return [dn, dow[idx]]; }), null, 'var(--blue)') + '</div>';

  html += '<div class="pos-sec-label">Horas con más cobros</div>'
    + '<div class="pos-surface pos-surface-pad">' + _fBarsHtml(hrRows, null, 'var(--green)') + '</div>';

  html += '<div class="pos-sec-label">Productos más vendidos</div>'
    + '<div class="pos-surface pos-surface-pad">' + (topProds.length ? _fBarsHtml(topProds, function (v) { return v + ' uds'; }, 'var(--gold)') : '<div style="font-size:13px;color:var(--t2)">Sin ventas de productos en este periodo.</div>') + '</div>';

  html += '<div class="pos-sec-label">Servicios más solicitados</div>'
    + '<div class="pos-surface pos-surface-pad">' + (topSvcs.length ? _fBarsHtml(topSvcs, function (v) { return v + ' veces'; }, 'var(--blue)') : '<div style="font-size:13px;color:var(--t2)">Sin servicios cobrados en este periodo.</div>') + '</div>';

  return html;
}

function finExportSalesCsv() {
  if (typeof window.posDownloadCsv !== 'function') return;
  var rows = [['Fecha', 'Hora', 'Profesional', 'Cliente', 'Teléfono', 'Servicios', 'Productos', 'Descuento', 'Propina', 'Total', 'Método de pago']];
  (FIN_STATE.sales || []).forEach(function (s) {
    var timeStr = s.created_at ? new Date(s.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
    var svcs = (s.items_services || []).map(function (x) { return x.name + (x.qty > 1 ? ' x' + x.qty : ''); }).join(' + ');
    var prods = (s.items_products || []).map(function (x) { return x.name + ' x' + x.qty; }).join(' + ');
    rows.push([
      s.sale_date || '',
      timeStr,
      s.worker_name || '',
      s.client_name || '',
      s.client_phone || '',
      svcs,
      prods,
      (parseFloat(s.discount_manual) || 0) + (parseFloat(s.discount_loyalty) || 0),
      parseFloat(s.tip) || 0,
      parseFloat(s.total) || 0,
      s.payment_method || ''
    ]);
  });
  var slug = String((CUR && CUR.name) || 'citaspro').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  var range = _fActiveRange();
  window.posDownloadCsv('cobros-' + slug + '-' + range[0] + '-a-' + range[1] + '.csv', rows);
  toast('CSV de cobros descargado (' + (FIN_STATE.sales || []).length + ' registros)', '#22C55E');
}

window.initBizFinancesPro = initBizFinancesPro;
window.finExportSalesCsv = finExportSalesCsv;
window.finSwitchTab = finSwitchTab;
window.finSetPeriod = finSetPeriod;
window.finSetLiqPeriod = finSetLiqPeriod;
window.finSetChartDays = finSetChartDays;
window.finSetCustomRange = finSetCustomRange;
window.finSaveTaxConfig = finSaveTaxConfig;
window.finAddExpense = finAddExpense;
window.finDeleteExpense = finDeleteExpense;

