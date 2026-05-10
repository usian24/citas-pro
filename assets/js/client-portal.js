'use strict';
// client-portal.js — bugs corregidos:
// 1. COUNTRY_TIMEZONES definido aquí (no depende de config-pais.js)
// 2. getNowInBizTimezone usa el diccionario local como fallback seguro
// 3. Botón "Registrar cita" — un solo click

window._cloudApptCache = window._cloudApptCache || null;
var _cloudApptCache = null;

// ─── Diccionario local de timezones (independiente de config-pais.js) ───
var COUNTRY_TIMEZONES = {
  ES: 'Europe/Madrid', CO: 'America/Bogota',
  MX: 'America/Mexico_City', AR: 'America/Argentina/Buenos_Aires',
  PE: 'America/Lima', CL: 'America/Santiago',
  VE: 'America/Caracas', EC: 'America/Guayaquil',
  DO: 'America/Santo_Domingo', US: 'America/New_York',
  BR: 'America/Sao_Paulo', DE: 'Europe/Berlin',
  NL: 'Europe/Amsterdam', FR: 'Europe/Paris'
};

function getNowInBizTimezone(country) {
  // Usar ahoraEnNegocio de config-pais.js si está disponible
  if (typeof ahoraEnNegocio === 'function') return ahoraEnNegocio(country);
  // Fallback propio (no depende de ningún otro archivo)
  var tz = COUNTRY_TIMEZONES[country] || 'Europe/Madrid';
  try {
    var now = new Date();
    var formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    var parts = formatter.formatToParts(now);
    var p = {};
    parts.forEach(function (x) { p[x.type] = x.value; });
    return new Date(p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':00');
  } catch (e) { return new Date(); }
}

function loadBizDirect(bizId) {
  var biz = getBizById(bizId);
  if (!biz) { toast('Negocio no encontrado', '#EF4444'); return; }

  // 🛡️ ESCUDO: Si la barbería está suspendida o expirada, bloquear la entrada a los clientes
  if (biz.plan === 'expired' || biz.plan === 'suspended') {
    var bp = G('s-barber-portal');
    if (bp) bp.innerHTML = '<div style="padding:60px 20px;text-align:center;margin-top:10vh;animation:popIn .4s ease"><div style="font-size:50px;margin-bottom:16px">🔒</div><h2 style="color:var(--text);font-size:22px;margin-bottom:10px;font-weight:900">Negocio Inactivo</h2><p style="color:var(--t2);font-size:14px;line-height:1.6">Esta barbería no puede recibir reservas en este momento.</p><button onclick="goTo(\'s-portal\')" class="btn btn-dark" style="margin-top:24px;display:inline-flex;width:auto">Volver al inicio</button></div>';
    goTo('s-barber-portal');
    return;
  }

  DB.currentBiz = null;
  DB.currentWorker = null;
  initCSEL();
  CSEL.bizId = bizId;

  var bpCover = G('bp-cover');
  if (bpCover) {
    if (biz.cover) bpCover.style.backgroundImage = 'url(' + sanitizeImageDataURL(biz.cover) + ')';
    else bpCover.style.backgroundImage = 'none';
  }
  var bpLogo = G('bp-logo');
  if (bpLogo) {
    if (biz.logo) bpLogo.innerHTML = '<img src="' + sanitizeImageDataURL(biz.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo"/>';
    else bpLogo.textContent = (biz.name || '?').charAt(0).toUpperCase();
  }
  T('bp-name', biz.name);
  T('bp-desc', (biz.addr || '') + (biz.city ? ', ' + biz.city : '') + (biz.type ? ' · ' + biz.type : ''));

  var coverBg = G('cl-cover-bg');
  if (coverBg) {
    if (biz.cover) coverBg.style.backgroundImage = 'url(' + sanitizeImageDataURL(biz.cover) + ')';
    else coverBg.style.backgroundImage = 'none';
  }
  var av = G('ch-av');
  if (av) {
    if (biz.logo) av.innerHTML = '<img src="' + sanitizeImageDataURL(biz.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo"/>';
    else av.textContent = (biz.name || '?').charAt(0).toUpperCase();
  }
  T('ch-nm', biz.name);
  T('ch-meta', (biz.addr || '') + (biz.city ? ', ' + biz.city : '') + (biz.type ? ' · ' + biz.type : ''));

  var socialsHtml = '';

  if (biz.insta) {
    var rawInsta = biz.insta.split('?')[0];
    var cleanInsta = rawInsta.replace(/(https?:)?(\/\/)?(www\.)?instagram\.com\/?/i, '').replace(/[@/]/g, '').trim();
    var igUrl = 'https://www.instagram.com/' + cleanInsta;

    socialsHtml += '<a href="' + igUrl + '" target="_blank" style="color:var(--blue);transition:opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></a>';
  }

  if (biz.facebook) {
    var rawFb = biz.facebook.split('?')[0];
    var cleanFb = rawFb.replace(/(https?:)?(\/\/)?(www\.)?facebook\.com\/?/i, '').replace(/^\//, '').trim();
    var fbUrl = 'https://www.facebook.com/' + cleanFb;

    socialsHtml += '<a href="' + fbUrl + '" target="_blank" style="color:var(--blue);transition:opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>';
  }

  if (biz.x_url) {
    var rawX = biz.x_url.split('?')[0];
    var cleanX = rawX.replace(/(https?:)?(\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i, '').replace(/[@/]/g, '').trim();
    var xUrl = 'https://x.com/' + cleanX;

    socialsHtml += '<a href="' + xUrl + '" target="_blank" style="color:var(--blue);transition:opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l11.733 16h4.267l-11.733-16z"></path><path d="M4 20l6.768-6.768m2.46-2.46l6.772-6.772"></path></svg></a>';
  }

  if (biz.tiktok) {
    var rawTk = biz.tiktok.split('?')[0];
    var cleanTk = rawTk.replace(/(https?:)?(\/\/)?(www\.)?tiktok\.com\/?@?/i, '').replace(/[@/]/g, '').trim();
    var tkUrl = 'https://www.tiktok.com/@' + cleanTk;

    socialsHtml += '<a href="' + tkUrl + '" target="_blank" style="color:var(--blue);transition:opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.79 1.52V6.76a4.84 4.84 0 0 1-1.02-.07z"/></svg></a>';
  }

  var bpSocials = G('bp-socials');
  if (bpSocials) bpSocials.innerHTML = socialsHtml;
  var chSocials = G('ch-socials');
  if (chSocials) chSocials.innerHTML = socialsHtml;

  // ── Botón "Registrar cita" — un solo click, sin doble pulsación ──
  var btnBook = G('bp-btn-book');
  if (btnBook) {
    // Clonar para eliminar listeners anteriores acumulados
    var newBtnBook = btnBook.cloneNode(true);
    btnBook.parentNode.replaceChild(newBtnBook, btnBook);
    newBtnBook.addEventListener('click', function () {
      clGoStep(1);
      goTo('s-client');
      window.scrollTo(0, 0);
    });
  }

  var btnShop = G('bp-btn-shop');
  if (btnShop) {
    btnShop.onclick = function () {
      T('bs-name', biz.name);
      goTo('s-barber-shop');
    };
  }

  if (typeof subscribeClientRealtime === 'function') subscribeClientRealtime(bizId);

  goTo('s-barber-portal');
  window.scrollTo(0, 0);
}

function clGoStep(n) {
  document.querySelectorAll('.bstep').forEach(function (s) { s.classList.remove('on'); });
  var s = G('cs-' + n); if (s) s.classList.add('on');
  updateBookingProgress(n);
  window.scrollTo(0, 0);
}

function updateBookingProgress(step) {
  for (var i = 1; i <= 5; i++) {
    var bar = G('bk-p' + i), lbl = G('bk-lbl' + i);
    if (bar) bar.style.background = i <= step ? 'var(--blue)' : 'var(--b)';
    if (lbl) lbl.style.color = i <= step ? 'var(--blue)' : 'var(--muted)';
  }
}

function clStep2() {
  var name = sanitizeText(V('cl-name'));
  var phone = sanitizeText(V('cl-phone'));
  var email = V('cl-email').trim().toLowerCase();
  var err = G('cl-err1');
  if (!name || name.length < 2) { if (err) { err.textContent = 'Introduce tu nombre completo.'; err.style.display = 'block'; } return; }
  if (!phone || !validPhone(phone)) { if (err) { err.textContent = 'Introduce un número de teléfono válido.'; err.style.display = 'block'; } return; }
  if (!email || !validEmail(email)) { if (err) { err.textContent = 'Introduce un correo electrónico válido para registrar tu Racha.'; err.style.display = 'block'; } return; }
  if (err) err.style.display = 'none';
  CSEL.clientName = name; CSEL.clientPhone = phone; CSEL.clientEmail = email;
  buildWorkerCards(); clGoStep(2);
}

function buildWorkerCards() {
  var biz = getBizById(CSEL.bizId); if (!biz) return;

  var loyaltyHtml = '';
  if (typeof buildClientLoyaltyHtml === 'function') {
    loyaltyHtml = buildClientLoyaltyHtml(CSEL.bizId, CSEL.clientPhone, CSEL.clientEmail, CSEL.clientName);
  }

  var loyaltyContainer = G('cl-loyalty-container');
  if (!loyaltyContainer) {
    loyaltyContainer = document.createElement('div');
    loyaltyContainer.id = 'cl-loyalty-container';
    var wl = G('cl-workers-list');
    if (wl && wl.parentNode) wl.parentNode.insertBefore(loyaltyContainer, wl);
  }
  if (loyaltyContainer) loyaltyContainer.innerHTML = loyaltyHtml;

  var workers = (biz.workers || []).filter(function (w) { return w.active; });
  H('cl-workers-list', workers.length
    ? workers.map(function (w) {
      var av = w.photo
        ? '<img src="' + sanitizeImageDataURL(w.photo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="Foto"/>'
        : '<span style="font-size:28px;font-weight:900;color:#fff">' + (w.name || '?').charAt(0).toUpperCase() + '</span>';
      var svcCount = (w.services || []).length;
      return '<div class="worker-card" data-wid="' + sanitizeText(w.id) + '" onclick="selectWorker(\'' + sanitizeText(w.id) + '\')">'
        + '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;overflow:hidden;box-shadow:0 4px 16px rgba(74,127,212,.3)">' + av + '</div>'
        + '<div style="font-weight:700;font-size:15px;margin-bottom:4px;text-align:center">' + san(w.name) + '</div>'
        + '<div style="font-size:12px;color:var(--t2);text-align:center;margin-bottom:6px">' + san(w.spec || '') + '</div>'
        + '<div style="font-size:11px;color:var(--muted);text-align:center">' + svcCount + ' servicio' + (svcCount !== 1 ? 's' : '') + '</div>'
        + '</div>';
    }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">No hay trabajadores disponibles</div></div>');
}

function selectWorker(workerId) {
  CSEL.workerId = workerId;
  document.querySelectorAll('.worker-card').forEach(function (c) { c.classList.remove('sel'); });
  var card = document.querySelector('.worker-card[data-wid="' + workerId + '"]');
  if (card) card.classList.add('sel');
  buildServicesList(workerId); clGoStep(3);
}

function buildServicesList(workerId) {
  var biz = getBizById(CSEL.bizId); if (!biz) return;
  var worker = (biz.workers || []).filter(function (w) { return w.id === workerId; })[0]; if (!worker) return;
  T('cl-worker-name', worker.name);
  var svcs = worker.services || [];
  H('cl-svc-list', svcs.length
    ? svcs.map(function (s) {
      var thumb = s.photo
        ? '<img src="' + sanitizeImageDataURL(s.photo) + '" style="width:50px;height:50px;border-radius:12px;object-fit:cover;flex-shrink:0" alt="Servicio">'
        : '<div style="width:50px;height:50px;border-radius:12px;background:var(--bblue);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">&#9986;</div>';
      return '<div class="svcitem" data-sn="' + san(s.name) + '" data-sp="' + s.price + '" data-dur="' + s.dur + '">'
        + thumb
        + '<div style="flex:1"><div style="font-weight:700;font-size:15px;margin-bottom:2px">' + san(s.name) + '</div>'
        + '<div style="font-size:12px;color:var(--t2)">' + s.dur + ' min' + (s.desc ? ' · ' + san(s.desc) : '') + '</div></div>'
        + '<div style="font-weight:800;font-size:17px;color:var(--blue)">' + money(s.price) + '</div>'
        + '</div>';
    }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Este trabajador no tiene servicios aún</div></div>');
  document.querySelectorAll('.svcitem').forEach(function (item) {
    item.addEventListener('click', function () {
      document.querySelectorAll('.svcitem').forEach(function (x) { x.classList.remove('sel'); });
      item.classList.add('sel');
      CSEL.svc = item.getAttribute('data-sn');
      CSEL.svcPrice = parseFloat(item.getAttribute('data-sp'));
      CSEL.svcDur = parseInt(item.getAttribute('data-dur')) || 30;
    });
  });
}

function clStep4() {
  var err = G('cl-err2');
  if (!CSEL.svc) { if (err) { err.textContent = 'Selecciona un servicio.'; err.style.display = 'block'; } return; }
  if (err) err.style.display = 'none';
  buildDates(CSEL.bizId, CSEL.workerId); clGoStep(4);
}

function buildDates(bizId, workerId) {
  var biz = getBizById(bizId); if (!biz) return;
  var worker = (biz.workers || []).filter(function (w) { return w.id === workerId; })[0];
  var horario = (worker && worker.horario) ? worker.horario : (biz.horario || DEFAULT_HORARIO);
  var now = getNowInBizTimezone(biz.country || 'ES');
  var dates = [], dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  for (var i = 0; i < 14; i++) {
    var d = new Date(now); d.setDate(now.getDate() + i);
    var hn = dayNames[d.getDay()], hd = horario.filter(function (h) { return h.day === hn; })[0];
    if (!hd || hd.open) dates.push(d);
    if (dates.length >= 7) break;
  }
  var days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  H('cl-dates', dates.map(function (d, i) {
    var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return '<div class="dateopt' + (i === 0 ? ' sel' : '') + '" data-dt="' + ds + '">'
      + '<div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">' + days[d.getDay()] + '</div>'
      + '<div style="font-size:20px;font-weight:900">' + d.getDate() + '</div>'
      + '<div style="font-size:9px;color:var(--muted)">' + MONTHS_SHORT[d.getMonth()] + '</div>'
      + '</div>';
  }).join(''));
  var firstDs = dates.length
    ? dates[0].getFullYear() + '-' + String(dates[0].getMonth() + 1).padStart(2, '0') + '-' + String(dates[0].getDate()).padStart(2, '0')
    : now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  CSEL.date = firstDs; CSEL.bizCountry = biz.country || 'ES';
  document.querySelectorAll('.dateopt').forEach(function (o) {
    o.addEventListener('click', function () {
      document.querySelectorAll('.dateopt').forEach(function (x) { x.classList.remove('sel'); });
      o.classList.add('sel'); CSEL.date = o.getAttribute('data-dt'); buildTimes(bizId, workerId);
    });
  });
  buildTimes(bizId, workerId);
}

function buildTimes(bizId, workerId) {
  var biz = getBizById(bizId); if (!biz || !CSEL.date) return;
  var worker = (biz.workers || []).filter(function (w) { return w.id === workerId; })[0];
  var horario = (worker && worker.horario) ? worker.horario : (biz.horario || DEFAULT_HORARIO);
  var d = new Date(CSEL.date + 'T12:00');
  var dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var horDay = horario.filter(function (h) { return h.day === dayNames[d.getDay()]; })[0] || { open: true, from1: '09:00', to1: '20:00' };
  var times = [];
  function addInterval(startStr, endStr) {
    if (!startStr || !endStr) return;
    var fp = startStr.split(':').map(Number), tp = endStr.split(':').map(Number);
    var fm = fp[0] * 60 + fp[1], tm = tp[0] * 60 + tp[1];
    for (var m = fm; m < tm; m += 30) {
      var h = Math.floor(m / 60), mn = m % 60;
      times.push(String(h).padStart(2, '0') + ':' + String(mn).padStart(2, '0'));
    }
  }
  if (horDay.open) {
    addInterval(horDay.from1 || horDay.from || '09:00', horDay.to1 || horDay.to || '20:00');
    if (horDay.hasBreak && horDay.from2 && horDay.to2) addInterval(horDay.from2, horDay.to2);
  }
  var svcDur = CSEL.svcDur || 30, slotsNeeded = Math.ceil(svcDur / 30);
  var blockedMinutes = {};
  if (worker && worker.appointments) {
    worker.appointments.forEach(function (a) {
      if (a.date === CSEL.date && a.status !== 'cancelled') {
        if (CSEL.editingToken && a.token === CSEL.editingToken) return;
        var existingDur = 30;
        if (worker.services) {
          var existingSvc = worker.services.find(function (s) { return s.name === a.svc; });
          if (existingSvc) existingDur = existingSvc.dur || 30;
        }
        var existingSlots = Math.ceil(existingDur / 30);
        var pts = a.time.split(':').map(Number), startMin = pts[0] * 60 + pts[1];
        for (var i = 0; i < existingSlots; i++) blockedMinutes[startMin + (i * 30)] = true;
      }
    });
  }
  function isSlotAvailable(timeStr) {
    var pts = timeStr.split(':').map(Number), startMin = pts[0] * 60 + pts[1];
    for (var i = 0; i < slotsNeeded; i++) {
      var checkMin = startMin + (i * 30);
      if (blockedMinutes[checkMin]) return false;
      if (i > 0) {
        var checkH = Math.floor(checkMin / 60), checkM = checkMin % 60;
        var checkStr = String(checkH).padStart(2, '0') + ':' + String(checkM).padStart(2, '0');
        if (times.indexOf(checkStr) < 0) return false;
      }
    }
    return true;
  }
  var currentNow = getNowInBizTimezone(biz.country || 'ES');
  var isToday = (CSEL.date === currentNow.toISOString().split('T')[0]);
  var currentMinutes = currentNow.getHours() * 60 + currentNow.getMinutes();
  var validTimes = times.filter(function (t) {
    var pts = t.split(':').map(Number), startMin = pts[0] * 60 + pts[1], endMin = startMin + svcDur;
    if (isToday && startMin <= currentMinutes) return false;
    var turnoEnd = 0;
    if (horDay.open) {
      var tp1 = (horDay.to1 || horDay.to || '20:00').split(':').map(Number); turnoEnd = tp1[0] * 60 + tp1[1];
      if (horDay.hasBreak && horDay.from2 && horDay.to2) {
        var fp2 = horDay.from2.split(':').map(Number), tp2 = horDay.to2.split(':').map(Number);
        var from2Min = fp2[0] * 60 + fp2[1], to2Min = tp2[0] * 60 + tp2[1];
        if (startMin >= from2Min) turnoEnd = to2Min;
      }
    }
    return endMin <= turnoEnd;
  });
  var available = validTimes.filter(function (t) { return isSlotAvailable(t); }).length;
  var availEl = G('cl-time-available');
  if (availEl) availEl.textContent = validTimes.length ? (available > 0 ? available + ' horarios disponibles' : 'Sin horarios disponibles') : '';
  if (!validTimes.length) {
    H('cl-times', '<div style="text-align:center;padding:24px;color:var(--muted);background:var(--card);border-radius:var(--r);border:1px solid var(--b)"><div style="font-size:13px">Cerrado este día</div></div>');
    return;
  }
  H('cl-times', validTimes.map(function (t) {
    var busy = !isSlotAvailable(t);
    return '<div class="topt' + (busy ? ' busy' : '') + '" data-tm="' + t + '">' + t + '</div>';
  }).join(''));
  document.querySelectorAll('.topt:not(.busy)').forEach(function (o) {
    o.addEventListener('click', function () {
      document.querySelectorAll('.topt').forEach(function (x) { x.classList.remove('sel'); });
      o.classList.add('sel'); CSEL.time = o.getAttribute('data-tm');
    });
  });
}

function clStep5() {
  var err = G('cl-err3');
  if (!CSEL.date) { if (err) { err.textContent = 'Selecciona una fecha.'; err.style.display = 'block'; } return; }
  if (!CSEL.time) { if (err) { err.textContent = 'Selecciona una hora disponible.'; err.style.display = 'block'; } return; }
  if (err) err.style.display = 'none';
  buildSummary(); clGoStep(5);
}

function buildSummary() {
  var biz = getBizById(CSEL.bizId);
  var worker = biz ? (biz.workers || []).filter(function (w) { return w.id === CSEL.workerId; })[0] : null;
  H('cl-summary',
    '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Resumen de tu reserva</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Negocio</span><span style="font-size:13px;font-weight:700">' + san(biz ? biz.name : '') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Profesional</span><span style="font-size:13px;font-weight:700">' + san(worker ? worker.name : '') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Cliente</span><span style="font-size:13px;font-weight:700">' + san(CSEL.clientName || '') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Servicio</span><span style="font-size:13px;font-weight:700">' + san(CSEL.svc || '') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Fecha</span><span style="font-size:13px;font-weight:700">' + sanitizeText(CSEL.date || '—') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Hora</span><span style="font-size:13px;font-weight:700">' + sanitizeText(CSEL.time || '—') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0"><span style="font-size:15px;font-weight:800">Total</span><span style="font-weight:900;font-size:22px;color:var(--blue)">' + money(CSEL.svcPrice) + '</span></div>'
  );
}

window._isBookingProcessing = false;

function confirmBooking() {
  if (window._isBookingProcessing) return;
  window._isBookingProcessing = true;
  setTimeout(function() { window._isBookingProcessing = false; }, 4000);

  var name = CSEL.clientName || sanitizeText(V('cl-name'));
  var phone = CSEL.clientPhone || sanitizeText(V('cl-phone'));
  var email = CSEL.clientEmail || sanitizeText(V('cl-email'));
  if (!name || !phone || !email || !CSEL.svc || !CSEL.date || !CSEL.time || !CSEL.workerId) {
    toast('Faltan datos. Vuelve atrás y completa todo.', '#EF4444'); return;
  }
  var biz = getBizById(CSEL.bizId); if (!biz) return;
  var worker = (biz.workers || []).filter(function (w) { return w.id === CSEL.workerId; })[0]; if (!worker) return;
  var isModifying = !!CSEL.editingToken;
  var dup = false;
  (worker.appointments || []).forEach(function (a) {
    if (a.date === CSEL.date && a.time === CSEL.time && a.status !== 'cancelled') {
      if (isModifying && a.token === CSEL.editingToken) return;
      dup = true;
    }
  });
  if (dup) { toast('Esa hora ya está ocupada. Elige otra.', '#EF4444'); clGoStep(4); return; }

  var token = isModifying ? CSEL.editingToken : 'tk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  var apptId = String(Date.now());
  var apptStatus = isModifying ? 'rescheduled' : 'confirmed';

  var appt = {
    id: apptId, client: name, phone: phone, email: email,
    date: CSEL.date, time: CSEL.time, svc: CSEL.svc, barber: worker.name,
    price: CSEL.svcPrice || 0, status: apptStatus, notes: '', token: token
  };

  if (!worker.appointments) worker.appointments = [];
  if (isModifying) {
    worker.appointments = worker.appointments.filter(function (a) { return a.token !== token; });
    worker.appointments.push(appt);
    CSEL.editingToken = null;
  } else {
    worker.appointments.push(appt);
  }


  fetch('/api/sync', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'appointments', business_id: biz.id,
      appointments: [{
        id: apptId, business_id: biz.id, worker_id: worker.id,
        client_id: '', client_name: name, client_phone: phone, client_email: email,
        token: token, notes: '', service_name: CSEL.svc,
        service_price: CSEL.svcPrice || 0, date: CSEL.date, time: CSEL.time,
        status: apptStatus
      }]
    })
  }).catch(function (e) { console.error('Error sync appointment:', e); });

  if (typeof syncClientToCloud === 'function') syncClientToCloud(CSEL.bizId, { name: name, phone: phone, email: email });

  try { localStorage.setItem(DBKEY, JSON.stringify(DB)); } catch (e) { }

  if (worker.email) {
    fetch('/api/send-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_booking_biz', to: worker.email,
        data: { clientName: name, clientPhone: phone, service: CSEL.svc, date: CSEL.date, time: CSEL.time, workerName: worker.name }
      })
    }).catch(function (e) { console.error(e); });
  }
  if (email) {
    fetch('/api/send-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'booking_confirmed', to: email,
        data: { bizName: biz.name, workerName: worker.name, service: CSEL.svc, date: CSEL.date, time: CSEL.time, price: money(CSEL.svcPrice) }
      })
    }).catch(function (e) { console.error(e); });
  }

  var exitoTexto = isModifying ? 'ha sido modificada' : 'ha sido confirmada';
  T('cl-confirm-txt', '¡Hola ' + sanitizeText(name) + '! Tu cita en ' + sanitizeText(biz.name) + ' con ' + sanitizeText(worker.name) + ' ' + exitoTexto + '.');
  H('cl-confirm-card',
    '<div style="display:flex;flex-direction:column;gap:10px">'
    + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Negocio</span><span style="font-weight:700;font-size:13px">' + san(biz.name) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Profesional</span><span style="font-weight:700;font-size:13px">' + san(worker.name) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Servicio</span><span style="font-weight:700;font-size:13px">' + san(CSEL.svc || '') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Fecha</span><span style="font-weight:700;font-size:13px">' + sanitizeText(CSEL.date) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Hora</span><span style="font-weight:700;font-size:13px">' + sanitizeText(CSEL.time) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;border-top:1px solid var(--b);padding-top:10px;margin-top:4px"><span style="font-weight:800;font-size:14px">Total</span><span style="font-weight:900;color:var(--blue);font-size:20px">' + money(CSEL.svcPrice) + '</span></div>'
    + '</div>'
  );
  var wa = G('cl-wa-btn');
  if (wa) {
    var waMsg = isModifying ? '¡Mi cita fue modificada en ' + biz.name + '!\n' : '¡Cita confirmada en ' + biz.name + '!\n';
    waMsg += 'Profesional: ' + worker.name + '\nServicio: ' + CSEL.svc + '\nFecha: ' + CSEL.date + ' a las ' + CSEL.time
      + '\nTotal: ' + money(CSEL.svcPrice) + '\n\nPara gestionar o cancelar tu cita visita:\n' + window.location.origin + '/#manage/' + biz.id + '/' + token;
    wa.href = 'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(waMsg);
  }
  CSEL.bookingToken = token;
  clGoStep(6);
}

/* ══════════════════════════
   GESTIÓN DE CITA
══════════════════════════ */
async function checkManageAccess() {
  var hash = window.location.hash;
  if (!(hash && hash.indexOf('#manage/') === 0)) return false;
  var parts = hash.split('/');
  var token = parts.length === 3 ? parts[2] : parts[1];
  var found = null;
  if (token) {
    found = findApptByToken(token);
    if (!found && window._cloudApptCache && window._cloudApptCache.appt && window._cloudApptCache.appt.token === token) {
      found = window._cloudApptCache;
    }
  }
  if (!found && token) {
    try {
      var resp = await fetch('/api/get-appointment-by-token?token=' + encodeURIComponent(token));
      var data = await resp.json();
      if (data && data.already_cancelled) {
        toast('Esta cita ya fue cancelada', '#F59E0B');
        setTimeout(function () { window.location.hash = ''; }, 2500);
        return true;
      }
      if (data && data.appointment) {
        var a = data.appointment;

        var biz = getBizById(a.business_id);
        if (!biz && typeof fetchBizFromCloud === 'function') {
          biz = await fetchBizFromCloud(a.business_id);
          if (biz && typeof syncBizToLocal === 'function') syncBizToLocal(biz);
        }
        if (!biz) biz = { id: a.business_id, name: 'Tu barbería', workers: [] };

        var worker = (biz.workers || []).find(function (w) { return w.id === a.worker_id; }) || null;
        var normalizedAppt = {
          id: a.id, token: a.token, client: a.client_name, phone: a.client_phone,
          email: a.client_email || '', svc: a.service_name,
          price: parseFloat(a.service_price) || 0, date: a.date, time: a.time,
          status: a.status, notes: a.notes || ''
        };
        found = { biz: biz, worker: worker, appt: normalizedAppt };
        window._cloudApptCache = found;
        _cloudApptCache = found;
      }
    } catch (e) { console.error('Error buscando cita por token:', e); }
  }
  if (found) { openManageModal(found.biz, found.worker, found.appt); return true; }
  toast('Cita no encontrada o ya expirada', '#EF4444');
  return false;
}

function findApptByToken(token) {
  var result = null;
  DB.businesses.forEach(function (biz) {
    (biz.workers || []).forEach(function (w) {
      (w.appointments || []).forEach(function (a) {
        if (a.token === token && a.status !== 'cancelled') result = { biz: biz, worker: w, appt: a };
      });
    });
    (biz.appointments || []).forEach(function (a) {
      if (a.token === token && a.status !== 'cancelled') result = { biz: biz, worker: null, appt: a };
    });
  });
  return result;
}

window._manageToken = null;

function openManageModal(biz, worker, appt) {
  window._manageToken = appt.token;
  H('manage-content',
    '<div style="text-align:center;margin-bottom:20px">'
    + '<div style="font-size:18px;font-weight:800;margin-bottom:6px">Gestionar tu cita</div>'
    + '<div style="font-size:13px;color:var(--t2)">en ' + san(biz.name) + '</div>'
    + '</div>'
    + '<div style="background:var(--card);border:1px solid var(--b);border-radius:16px;padding:16px;margin-bottom:20px">'
    + '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b)"><span style="color:var(--t2);font-size:13px">Servicio</span><span style="font-weight:700;font-size:13px">' + san(appt.svc) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b)"><span style="color:var(--t2);font-size:13px">Fecha</span><span style="font-weight:700;font-size:13px">' + san(appt.date) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 0"><span style="color:var(--t2);font-size:13px">Hora</span><span style="font-weight:700;font-size:13px">' + san(appt.time) + '</span></div>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:10px">'
    + '<button onclick="reprogramarCita(window._manageToken)" style="width:100%;padding:14px;border-radius:var(--rpill);background:var(--bblue);border:1px solid rgba(74,127,212,.2);color:var(--blue);font-weight:700;cursor:pointer;font-family:var(--font)">Modificar fecha/hora</button>'
    + '<button onclick="cancelApptByToken(window._manageToken)" style="width:100%;padding:14px;border-radius:var(--rpill);background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:var(--red);font-weight:700;cursor:pointer;font-family:var(--font)">Cancelar cita</button>'
    + '</div>'
  );
  openOv('ov-manage');
}

function reprogramarCita(token) {
  var found = findApptByToken(token);
  if (!found && window._cloudApptCache && window._cloudApptCache.appt && window._cloudApptCache.appt.token === token) {
    found = window._cloudApptCache;
  }
  if (!found) { toast('No se pudo cargar la cita', '#EF4444'); return; }
  var savedToken = token, savedBizId = found.biz.id;
  var savedWorker = found.worker ? found.worker.id : null;
  var savedName = found.appt.client, savedPhone = found.appt.phone, savedEmail = found.appt.email;
  var savedSvc = found.appt.svc, savedPrice = found.appt.price, savedDur = 30;
  if (found.worker && found.worker.services) {
    var sObj = found.worker.services.find(function (s) { return s.name === found.appt.svc; });
    if (sObj) savedDur = sObj.dur || 30;
  }
  var savedFoundBiz = found.biz, savedFoundWorker = found.worker;
  window._cloudApptCache = null; _cloudApptCache = null;
  closeOv('ov-manage');
  var localBiz = getBizById(savedBizId);
  if (!localBiz) { DB.businesses.push(savedFoundBiz); localBiz = savedFoundBiz; }
  var coverBg = G('cl-cover-bg');
  if (coverBg) {
    if (localBiz.cover) coverBg.style.backgroundImage = 'url(' + sanitizeImageDataURL(localBiz.cover) + ')';
    else coverBg.style.backgroundImage = 'none';
  }
  var av = G('ch-av');
  if (av) {
    if (localBiz.logo) av.innerHTML = '<img src="' + sanitizeImageDataURL(localBiz.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo"/>';
    else av.textContent = (localBiz.name || '?').charAt(0).toUpperCase();
  }
  T('ch-nm', localBiz.name);
  T('ch-meta', (localBiz.addr || '') + (localBiz.city ? ', ' + localBiz.city : '') + (localBiz.type ? ' · ' + localBiz.type : ''));
  goTo('s-client');
  CSEL.editingToken = savedToken; CSEL.bizId = savedBizId; CSEL.workerId = savedWorker;
  CSEL.clientName = savedName; CSEL.clientPhone = savedPhone; CSEL.clientEmail = savedEmail;
  CSEL.svc = savedSvc; CSEL.svcPrice = savedPrice; CSEL.svcDur = savedDur;
  if (savedFoundWorker) buildDates(savedBizId, savedFoundWorker.id);
  clGoStep(4);
}

function cancelApptByToken(token) {
  // 1. Buscar en local (puede no existir si es otro dispositivo)
  var found = findApptByToken(token);
  if (!found && window._cloudApptCache &&
    window._cloudApptCache.appt &&
    window._cloudApptCache.appt.token === token) {
    found = window._cloudApptCache;
  }

  // 2. Actualizar localStorage SI tenemos los datos locales
  if (found) {
    found.appt.status = 'cancelled';
    DB.businesses.forEach(function (biz) {
      (biz.workers || []).forEach(function (w) {
        (w.appointments || []).forEach(function (a) {
          if (a.token === token) a.status = 'cancelled';
        });
      });
      (biz.appointments || []).forEach(function (a) {
        if (a.token === token) a.status = 'cancelled';
      });
    });
    try { localStorage.setItem(DBKEY, JSON.stringify(DB)); } catch (e) { }
  }

  // 3. Cancelar en Supabase — SIEMPRE, aunque found sea null
  //    El token es suficiente para que el servidor encuentre la cita
  var bizId = found ? found.biz.id : '';

  fetch('/api/cancel-appointment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token, business_id: bizId })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.already_cancelled) {
        toast('Esta cita ya fue cancelada anteriormente', '#F59E0B');
        window._cloudApptCache = null; _cloudApptCache = null;
        closeOv('ov-manage');
        setTimeout(function () { window.location.hash = ''; }, 1500);
        return;
      }
      if (!d.success) {
        console.error('Error cancelando en servidor:', d.error);
        toast('Error al cancelar. Intenta de nuevo.', '#EF4444');
        return;
      }

      // 4. Cerrar y confirmar
      window._cloudApptCache = null;
      _cloudApptCache = null;
      closeOv('ov-manage');
      toast('Tu cita ha sido cancelada', '#22C55E');
      setTimeout(function () { window.location.hash = ''; }, 1500);
    })
    .catch(function (e) {
      console.error('Error de red al cancelar:', e);
      toast('Error de conexión. Intenta de nuevo.', '#EF4444');
    });
}

async function checkLinkAccess() {
  var hash = window.location.hash;
  if (hash && hash.indexOf('#manage/') === 0) return await checkManageAccess();
  if (hash && hash.indexOf('#b/') === 0) {
    goTo('s-barber-portal');
    var bizId = hash.slice(3);
    if (bizId) {
      DB = loadDB();
      var biz = getBizById(bizId);
      if ((!biz || !biz.workers) && typeof fetchBizFromCloud === 'function') {
        biz = await fetchBizFromCloud(bizId);
        if (biz && typeof syncBizToLocal === 'function') syncBizToLocal(biz);
      }
      if (biz) { loadBizDirect(bizId); return true; }
      else { toast('Negocio no encontrado', '#EF4444'); }
    }
  }
  return false;
}

function resetBooking() {
  var savedBizId = CSEL.bizId; initCSEL();
  if (savedBizId) { CSEL.bizId = savedBizId; loadBizDirect(savedBizId); } else goTo('s-portal');
}

function goClientFromBiz() {
  if (CUR) loadBizDirect(CUR.id); else goTo('s-portal');
}

window.checkLinkAccess = checkLinkAccess;
window.checkManageAccess = checkManageAccess;
window.findApptByToken = findApptByToken;
window.openManageModal = openManageModal;
window.reprogramarCita = reprogramarCita;
window.cancelApptByToken = cancelApptByToken;