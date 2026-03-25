'use strict';

/* ══════════════════════════════════════════════════
   FINANZAS-REALDATA.JS
   
   Reemplaza los gráficos hardcodeados con datos
   REALES calculados desde las citas (appointments).
   
   Funciona tanto para el dueño (bp-finanzas) como
   para el trabajador (wp-finanzas).
══════════════════════════════════════════════════ */

/* ══════════════════════════
   UTILIDADES DE FECHA
══════════════════════════ */
function getMonthKey(dateStr) {
  // "2025-03-15" → "2025-03"
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.substring(0, 7);
}

function getLast6Months() {
  var months = [];
  var now = new Date();
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      label: MONTHS_SHORT[d.getMonth()],
      year: d.getFullYear(),
      month: d.getMonth()
    });
  }
  return months;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  var now = new Date();
  var key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  return dateStr.substring(0, 7) === key;
}

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  var now = new Date();
  var d = new Date(dateStr + 'T12:00');
  var day = now.getDay();
  var startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  startOfWeek.setHours(0, 0, 0, 0);
  var endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
}

function isToday(dateStr) {
  if (!dateStr) return false;
  return dateStr === new Date().toISOString().split('T')[0];
}

/* ══════════════════════════
   RECOPILAR TODAS LAS CITAS
   (para dueño = todas las del negocio)
══════════════════════════ */
function getAllBizAppointments(biz) {
  if (!biz) return [];
  var all = [];

  // Citas de workers
  (biz.workers || []).forEach(function (w) {
    (w.appointments || []).forEach(function (a) {
      all.push({
        id: a.id,
        client: a.client || '',
        phone: a.phone || '',
        date: a.date || '',
        time: a.time || '',
        svc: a.svc || '',
        price: parseFloat(a.price) || 0,
        status: a.status || 'confirmed',
        barber: a.barber || w.name || '',
        workerId: w.id
      });
    });
  });

  // Citas sin worker asignado
  (biz.appointments || []).forEach(function (a) {
    all.push({
      id: a.id,
      client: a.client || '',
      phone: a.phone || '',
      date: a.date || '',
      time: a.time || '',
      svc: a.svc || '',
      price: parseFloat(a.price) || 0,
      status: a.status || 'confirmed',
      barber: a.barber || '',
      workerId: ''
    });
  });

  return all;
}

/* ══════════════════════════
   CALCULAR ESTADÍSTICAS
══════════════════════════ */
function calcFinanceStats(appointments) {
  var now = new Date().toISOString().split('T')[0];
  var completed = appointments.filter(function (a) {
    return a.status === 'completed' || a.status === 'confirmed';
  });

  // Ingresos este mes
  var monthRevenue = 0;
  var monthClients = {};
  var svcCounts = {};

  completed.forEach(function (a) {
    if (isThisMonth(a.date)) {
      monthRevenue += a.price;
      if (a.client) monthClients[a.client.toLowerCase()] = true;
      if (a.svc) svcCounts[a.svc] = (svcCounts[a.svc] || 0) + 1;
    }
  });

  // Servicio más popular
  var topSvc = '—';
  var topCount = 0;
  for (var svc in svcCounts) {
    if (svcCounts[svc] > topCount) {
      topCount = svcCounts[svc];
      topSvc = svc;
    }
  }

  // Ticket medio
  var monthAppts = completed.filter(function (a) { return isThisMonth(a.date); });
  var avgTicket = monthAppts.length > 0 ? monthRevenue / monthAppts.length : 0;

  // Ingresos por mes (últimos 6 meses)
  var months = getLast6Months();
  var monthlyRevenue = months.map(function (m) {
    var total = 0;
    completed.forEach(function (a) {
      if (getMonthKey(a.date) === m.key) {
        total += a.price;
      }
    });
    return { label: m.label, value: total, key: m.key };
  });

  return {
    monthRevenue: monthRevenue,
    uniqueClients: Object.keys(monthClients).length,
    topService: topSvc,
    avgTicket: avgTicket,
    monthlyRevenue: monthlyRevenue,
    completedAppts: completed
  };
}

/* ══════════════════════════
   RENDER GRÁFICO DE BARRAS
══════════════════════════ */
function renderFinanceChart(chartId, monthsId, monthlyData) {
  var ch = G(chartId);
  var ml = G(monthsId);
  if (!ch) return;

  var max = 10; // mínimo para que se vea algo
  monthlyData.forEach(function (m) { if (m.value > max) max = m.value; });

  ch.innerHTML = monthlyData.map(function (m, i) {
    var isLast = i === monthlyData.length - 1;
    var pct = Math.max(4, Math.round(m.value / max * 100));
    var barColor = isLast ? 'var(--blue)' : 'var(--blue3)';

    return '<div class="bar' + (isLast ? ' hi' : '') + '" '
      + 'style="height:' + pct + '%;position:relative;cursor:pointer" '
      + 'title="' + m.label + ': ' + money(m.value) + '">'
      + (m.value > 0 ? '<div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;color:' + (isLast ? 'var(--blue)' : 'var(--muted)') + ';white-space:nowrap">' + money(m.value) + '</div>' : '')
      + '</div>';
  }).join('');

  if (ml) {
    ml.innerHTML = monthlyData.map(function (m, i) {
      var isLast = i === monthlyData.length - 1;
      return '<div style="flex:1;text-align:center;font-size:9px;color:' + (isLast ? 'var(--blue)' : 'var(--muted)') + ';font-weight:700">' + m.label + '</div>';
    }).join('');
  }
}

/* ══════════════════════════
   RENDER HISTORIAL DE CITAS (FINANZAS)
══════════════════════════ */
function renderFinanceHistory(containerId, appointments, limit) {
  var el = G(containerId);
  if (!el) return;

  // Ordenar por fecha desc, luego hora desc
  var sorted = appointments.slice().sort(function (a, b) {
    var dComp = (b.date || '').localeCompare(a.date || '');
    if (dComp !== 0) return dComp;
    return (b.time || '').localeCompare(a.time || '');
  });

  if (limit) sorted = sorted.slice(0, limit);

  if (!sorted.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)"><div style="font-size:13px">Sin historial de citas</div></div>';
    return;
  }

  var statusColors = {
    confirmed: { bg: 'rgba(34,197,94,.1)', color: '#22C55E', label: 'Confirmada' },
    completed: { bg: 'rgba(74,127,212,.1)', color: '#4A7FD4', label: 'Completada' },
    cancelled: { bg: 'rgba(239,68,68,.1)', color: '#EF4444', label: 'Cancelada' },
    pending:   { bg: 'rgba(245,158,11,.1)', color: '#F59E0B', label: 'Pendiente' }
  };

  el.innerHTML = sorted.map(function (a) {
    var st = statusColors[a.status] || statusColors.confirmed;
    var isCancelled = a.status === 'cancelled';

    return '<div style="background:var(--card);border:1px solid var(--b);border-radius:16px;padding:14px;margin-bottom:8px;'
      + (isCancelled ? 'opacity:.5;' : '') + '">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      + '<div style="font-weight:700;font-size:14px">' + san(a.client) + '</div>'
      + '<span style="background:' + st.bg + ';color:' + st.color + ';padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700">' + st.label + '</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--t2)">'
      + '<span>' + san(a.svc) + (a.barber ? ' · ' + san(a.barber) : '') + '</span>'
      + '<span style="font-weight:800;color:' + (isCancelled ? 'var(--muted)' : 'var(--green)') + '">' + money(a.price) + '</span>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:6px">'
      + san(a.date) + ' a las ' + san(a.time)
      + '</div>'
      + '</div>';
  }).join('');
}

/* ══════════════════════════
   RENDER FINANZAS — DUEÑO DE NEGOCIO
══════════════════════════ */
function renderBizFinanzas() {
  if (!CUR) return;

  var allAppts = getAllBizAppointments(CUR);
  var stats = calcFinanceStats(allAppts);

  // Actualizar tarjetas
  T('fin-ing', money(stats.monthRevenue));
  T('fin-clients', stats.uniqueClients);
  T('fin-top-svc', stats.topService);
  T('fin-ticket', money(stats.avgTicket));

  // Gráfico
  renderFinanceChart('fin-chart', 'fin-months', stats.monthlyRevenue);

  // Historial
  renderFinanceHistory('biz-appts-fin', allAppts, 30);
}

/* ══════════════════════════
   RENDER FINANZAS — TRABAJADOR
══════════════════════════ */
function renderWorkerFinanzas() {
  if (!CUR_WORKER) return;

  var appts = (CUR_WORKER.appointments || []).map(function (a) {
    return {
      id: a.id,
      client: a.client || '',
      phone: a.phone || '',
      date: a.date || '',
      time: a.time || '',
      svc: a.svc || '',
      price: parseFloat(a.price) || 0,
      status: a.status || 'confirmed',
      barber: CUR_WORKER.name || ''
    };
  });

  var stats = calcFinanceStats(appts);

  // Actualizar tarjetas del worker
  T('wk-fin-ing', money(stats.monthRevenue));
  T('wk-fin-clients', stats.uniqueClients);
  T('wk-fin-top-svc', stats.topService);
  T('wk-fin-ticket', money(stats.avgTicket));

  // Gráfico
  renderFinanceChart('wk-fin-chart', 'wk-fin-months', stats.monthlyRevenue);

  // Historial
  renderFinanceHistory('wk-appts-fin', appts, 30);
}

/* ══════════════════════════
   RENDER DASHBOARD HOME (datos reales)
══════════════════════════ */
function renderBizHomeStats() {
  if (!CUR) return;

  var allAppts = getAllBizAppointments(CUR);
  var confirmed = allAppts.filter(function (a) {
    return a.status === 'completed' || a.status === 'confirmed';
  });

  var todayAppts = confirmed.filter(function (a) { return isToday(a.date); });
  var weekAppts = confirmed.filter(function (a) { return isThisWeek(a.date); });
  var monthAppts = confirmed.filter(function (a) { return isThisMonth(a.date); });

  var todayRev = todayAppts.reduce(function (s, a) { return s + a.price; }, 0);

  T('bh-today', todayAppts.length);
  T('bh-rev', money(todayRev));
  T('bh-week', weekAppts.length);
  T('bh-month', monthAppts.length);
}

function renderWorkerHomeStats() {
  if (!CUR_WORKER) return;

  var appts = (CUR_WORKER.appointments || []).filter(function (a) {
    return a.status === 'completed' || a.status === 'confirmed';
  });

  var todayAppts = appts.filter(function (a) { return isToday(a.date); });
  var weekAppts = appts.filter(function (a) { return isThisWeek(a.date); });
  var monthAppts = appts.filter(function (a) { return isThisMonth(a.date); });

  var todayRev = todayAppts.reduce(function (s, a) { return s + (parseFloat(a.price) || 0); }, 0);

  T('wk-today', todayAppts.length);
  T('wk-rev', money(todayRev));
  T('wk-week', weekAppts.length);
  T('wk-month', monthAppts.length);
}

/* ══════════════════════════
   RENDER ADMIN MRR CON DATOS REALES
══════════════════════════ */
function renderAdminMRRChart() {
  var months = getLast6Months();
  var bizs = DB.businesses || [];

  var monthlyData = months.map(function (m) {
    var totalRevenue = 0;
    bizs.forEach(function (biz) {
      var allAppts = getAllBizAppointments(biz);
      allAppts.forEach(function (a) {
        if ((a.status === 'completed' || a.status === 'confirmed') && getMonthKey(a.date) === m.key) {
          totalRevenue += a.price;
        }
      });
    });
    return { label: m.label, value: totalRevenue, key: m.key };
  });

  renderFinanceChart('ds-chart', 'ds-months', monthlyData);
}

/* ══════════════════════════
   EXPORTACIONES
══════════════════════════ */
window.renderBizFinanzas     = renderBizFinanzas;
window.renderWorkerFinanzas  = renderWorkerFinanzas;
window.renderBizHomeStats    = renderBizHomeStats;
window.renderWorkerHomeStats = renderWorkerHomeStats;
window.renderAdminMRRChart   = renderAdminMRRChart;
window.getAllBizAppointments = getAllBizAppointments;