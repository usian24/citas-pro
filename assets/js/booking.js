'use strict';

/* ══════════════════════════
   PORTAL CLIENTES
══════════════════════════ */
function loadBizDirect(bizId) {
  var b = DB.businesses.filter(function(x) { return x.id === bizId; })[0];
  if (!b) { toast('Negocio no encontrado', '#EF4444'); return; }
  initCSEL(); CSEL.bizId = bizId;
  goTo('s-client');
  var av = G('ch-av');
  if (av) { if (b.logo) av.innerHTML = '<img src="' + sanitizeImageDataURL(b.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">'; else av.textContent = (b.name || '?').charAt(0); }
  T('ch-nm', b.name);
  T('ch-meta', '📍 ' + sanitizeText((b.addr || '') + ' ' + (b.city || '')) + ' · ' + sanitizeText(b.type || 'Negocio'));
  H('cl-svc-list', (b.services || []).map(function(s) {
    var thumb = s.photo ? '<img src="' + sanitizeImageDataURL(s.photo) + '" style="width:50px;height:50px;border-radius:12px;object-fit:cover;flex-shrink:0" alt="Servicio">' : '<div style="width:50px;height:50px;border-radius:12px;background:var(--bblue);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">✂️</div>';
    return '<div class="svcitem" data-sn="' + san(s.name) + '" data-sp="' + s.price + '" data-dur="' + s.dur + '">'
      + thumb
      + '<div style="flex:1"><div style="font-weight:700;font-size:15px;margin-bottom:2px">' + san(s.name) + '</div>'
      + '<div style="font-size:12px;color:var(--t2)">' + s.dur + ' min' + (s.desc ? ' · ' + san(s.desc) : '') + '</div></div>'
      + '<div style="font-weight:800;font-size:17px;color:var(--blue)">' + money(s.price) + '</div></div>';
  }).join(''));
  document.querySelectorAll('.svcitem').forEach(function(item) {
    item.addEventListener('click', function() {
      document.querySelectorAll('.svcitem').forEach(function(x) { x.classList.remove('sel'); });
      item.classList.add('sel');
      CSEL.svc      = item.getAttribute('data-sn');
      CSEL.svcPrice = parseFloat(item.getAttribute('data-sp'));
      CSEL.svcDur   = parseInt(item.getAttribute('data-dur')) || 30;
    });
  });
  buildDates(bizId);
  clGoStep(1);
  window.scrollTo(0, 0);
}

function clGoStep(n) {
  document.querySelectorAll('.bstep').forEach(function(s) { s.classList.remove('on'); });
  var s = G('cs-' + n); if (s) s.classList.add('on');
  updateBookingProgress(n);
  window.scrollTo(0, 0);
}

function updateBookingProgress(step) {
  for (var i = 1; i <= 4; i++) {
    var bar = G('bk-p' + i), lbl = G('bk-lbl' + i);
    if (bar) bar.style.background = i <= step ? 'var(--blue)' : 'var(--b)';
    if (lbl) lbl.style.color      = i <= step ? 'var(--blue)' : 'var(--muted)';
  }
}

function clStep(n) {
  if (n === 2) {
    var name  = sanitizeText(V('cl-name'));
    var phone = sanitizeText(V('cl-phone'));
    var err   = G('cl-err1');
    if (!name || name.length < 2)   { if (err) { err.textContent = 'Por favor ingresa tu nombre completo.';           err.style.display = 'block'; } return; }
    if (!phone || !validPhone(phone)) { if (err) { err.textContent = 'Por favor ingresa un número de teléfono válido.'; err.style.display = 'block'; } return; }
    if (err) err.style.display = 'none';
    CSEL.clientName  = name;
    CSEL.clientPhone = phone;
    CSEL.clientEmail = sanitizeText(V('cl-email'));
  }
  if (n === 3) {
    var err2 = G('cl-err2');
    if (!CSEL.svc) { if (err2) { err2.textContent = 'Por favor selecciona un servicio.'; err2.style.display = 'block'; } return; }
    if (err2) err2.style.display = 'none';
  }
  if (n === 4) {
    var err3 = G('cl-err3');
    if (!CSEL.date) { if (err3) { err3.textContent = 'Por favor selecciona una fecha.';          err3.style.display = 'block'; } return; }
    if (!CSEL.time) { if (err3) { err3.textContent = 'Por favor selecciona una hora disponible.'; err3.style.display = 'block'; } return; }
    if (err3) err3.style.display = 'none';
    buildSummary();
  }
  clGoStep(n);
}

function buildDates(bizId) {
  var dates = [], now = new Date();
  var biz     = DB.businesses.filter(function(b) { return b.id === bizId; })[0];
  var horario = biz && biz.horario ? biz.horario : DEFAULT_HORARIO;
  var dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  for (var i = 0; i < 14; i++) {
    var d  = new Date(now); d.setDate(now.getDate() + i);
    var hn = dayNames[d.getDay()];
    var hd = horario.filter(function(h) { return h.day === hn; })[0];
    if (!hd || hd.open) dates.push(d);
    if (dates.length >= 7) break;
  }
  var days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  H('cl-dates', dates.map(function(d, i) {
    return '<div class="dateopt' + (i === 0 ? ' sel' : '') + '" data-dt="' + d.toISOString().split('T')[0] + '">'
      + '<div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">' + days[d.getDay()] + '</div>'
      + '<div style="font-size:20px;font-weight:900">' + d.getDate() + '</div>'
      + '<div style="font-size:9px;color:var(--muted)">' + ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()] + '</div>'
      + '</div>';
  }).join(''));
  CSEL.date = dates.length ? dates[0].toISOString().split('T')[0] : now.toISOString().split('T')[0];
  document.querySelectorAll('.dateopt').forEach(function(o) {
    o.addEventListener('click', function() {
      document.querySelectorAll('.dateopt').forEach(function(x) { x.classList.remove('sel'); });
      o.classList.add('sel'); CSEL.date = o.getAttribute('data-dt');
      buildTimes(bizId);
    });
  });
  buildTimes(bizId);
}

function buildTimes(bizId) {
  var biz     = DB.businesses.filter(function(b) { return b.id === bizId; })[0];
  var horario = biz && biz.horario ? biz.horario : DEFAULT_HORARIO;
  if (!CSEL.date) return;
  var d        = new Date(CSEL.date + 'T12:00');
  var dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var horDay   = horario.filter(function(h) { return h.day === dayNames[d.getDay()]; })[0] || { open:true, from:'09:00', to:'20:00' };
  var times = [];
  if (horDay.open) {
    var fp = horDay.from.split(':').map(Number), tp = horDay.to.split(':').map(Number);
    var fm = fp[0] * 60 + fp[1], tm = tp[0] * 60 + tp[1];
    var interval = CSEL.svcDur || 30;
    for (var m = fm; m <= tm - interval; m += 30) {
      var h = Math.floor(m / 60), mn = m % 60;
      times.push(String(h).padStart(2, '0') + ':' + String(mn).padStart(2, '0'));
    }
  }
  var booked    = biz ? (biz.appointments || []).filter(function(a) { return a.date === CSEL.date && a.status !== 'cancelled'; }).map(function(a) { return a.time; }) : [];
  var available = times.filter(function(t) { return booked.indexOf(t) < 0; }).length;
  var availEl   = G('cl-time-available');
  if (availEl) availEl.textContent = times.length ? (available > 0 ? available + ' horarios disponibles' : 'Sin horarios disponibles este día') : '';
  if (!times.length) {
    H('cl-times', '<div style="text-align:center;padding:24px;color:var(--muted);background:var(--card);border-radius:var(--r);border:1px solid var(--b)"><div style="font-size:24px;margin-bottom:8px">😴</div><div>Cerrado este día</div></div>');
    return;
  }
  H('cl-times', times.map(function(t) {
    var busy = booked.indexOf(t) >= 0;
    return '<div class="topt' + (busy ? ' busy' : '') + '" data-tm="' + t + '">' + t + '</div>';
  }).join(''));
  document.querySelectorAll('.topt:not(.busy)').forEach(function(o) {
    o.addEventListener('click', function() {
      document.querySelectorAll('.topt').forEach(function(x) { x.classList.remove('sel'); });
      o.classList.add('sel'); CSEL.time = o.getAttribute('data-tm');
    });
  });
}

function buildSummary() {
  var biz = DB.businesses.filter(function(b) { return b.id === CSEL.bizId; })[0];
  H('cl-summary',
    '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Resumen de tu reserva</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">👤 Cliente</span><span style="font-size:13px;font-weight:700">'  + san(CSEL.clientName  || '') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">📱 Teléfono</span><span style="font-size:13px;font-weight:700">' + san(CSEL.clientPhone || '') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">🏪 Negocio</span><span style="font-size:13px;font-weight:700">'   + san(biz ? biz.name : '') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">✂️ Servicio</span><span style="font-size:13px;font-weight:700">'  + san(CSEL.svc || '')         + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">📅 Fecha</span><span style="font-size:13px;font-weight:700">'    + sanitizeText(CSEL.date || '—') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">⏰ Hora</span><span style="font-size:13px;font-weight:700">'     + sanitizeText(CSEL.time || '—') + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0"><span style="font-size:15px;font-weight:800">💰 Total</span><span style="font-weight:900;font-size:22px;color:var(--blue)">' + money(CSEL.svcPrice) + '</span></div>'
  );
}

// Email de confirmación al cliente
function confirmBooking() {
  var name  = CSEL.clientName  || sanitizeText(V('cl-name'));
  var phone = CSEL.clientPhone || sanitizeText(V('cl-phone'));
  var email = CSEL.clientEmail || sanitizeText(V('cl-email'));

  if (!name || !phone || !CSEL.svc || !CSEL.date || !CSEL.time) {
    toast('Faltan datos. Vuelve atrás y completa todo.', '#EF4444');
    return;
  }

  var biz = DB.businesses.filter(function(b) { return b.id === CSEL.bizId; })[0];
  if (!biz) return;

  var dup = (biz.appointments || []).filter(function(a) {
    return a.date === CSEL.date && a.time === CSEL.time && a.status !== 'cancelled';
  }).length > 0;
  if (dup) { toast('Esa hora ya está ocupada. Elige otra.', '#EF4444'); clGoStep(3); return; }

  if (!biz.appointments) biz.appointments = [];
  var appt = {
    id: Date.now(),
    client: name,
    phone: phone,
    email: email,
    date: CSEL.date,
    time: CSEL.time,
    svc: CSEL.svc,
    barber: 'Cualquiera',
    price: CSEL.svcPrice || 0,
    status: 'confirmed',
    notes: ''
  };
  biz.appointments.push(appt);
  saveDB();
  if (CUR && CUR.id === biz.id) initBizPanel();

  /* ── Emails ──────────────────────────────────────── */

  // Email de confirmación al cliente
  if (email) {
    fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'booking_confirmed',
        to: email,
        data: {
          bizName: biz.name,
          service: CSEL.svc,
          date:    CSEL.date,
          time:    CSEL.time,
          price:   money(CSEL.svcPrice)
        }
      })
    }).catch(function(e) { console.error('Email cliente:', e); });
  }

  // Email de aviso al negocio
  if (biz.email) {
    fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new_booking_biz',
        to: biz.email,
        data: {
          clientName:  name,
          clientPhone: phone,
          service: CSEL.svc,
          date:    CSEL.date,
          time:    CSEL.time
        }
      })
    }).catch(function(e) { console.error('Email negocio:', e); });
  }

  /* ── Pantalla de confirmación ────────────────────── */

  T('cl-confirm-txt', '¡Hola ' + sanitizeText(name) + '! Tu cita en ' + sanitizeText(biz.name) + ' ha sido reservada con éxito. ¡Te esperamos!');
  H('cl-confirm-card',
    '<div style="display:flex;flex-direction:column;gap:10px">'
    + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Negocio</span><span style="font-weight:700;font-size:13px">'  + san(biz.name)           + '</span></div>'
    + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Servicio</span><span style="font-weight:700;font-size:13px">' + san(CSEL.svc || '')     + '</span></div>'
    + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Fecha</span><span style="font-weight:700;font-size:13px">'    + sanitizeText(CSEL.date) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Hora</span><span style="font-weight:700;font-size:13px">'     + sanitizeText(CSEL.time) + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;border-top:1px solid var(--b);padding-top:10px;margin-top:4px"><span style="font-weight:800;font-size:14px">Total</span><span style="font-weight:900;color:var(--blue);font-size:20px">' + money(CSEL.svcPrice) + '</span></div>'
    + '</div>'
  );

  var wa = G('cl-wa-btn');
  if (wa) wa.href = 'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(
    '📅 Cita confirmada en ' + biz.name +
    '\n✂️ Servicio: ' + CSEL.svc +
    '\n📆 Fecha: ' + CSEL.date + ' a las ' + CSEL.time +
    '\n💰 Total: ' + money(CSEL.svcPrice) +
    '\n\n¡Hasta pronto! 💈'
  );

  clGoStep(5);
}

function resetBooking() {
  var savedBizId = CSEL.bizId;
  initCSEL();
  if (savedBizId) { CSEL.bizId = savedBizId; loadBizDirect(savedBizId); }
  else goTo('s-portal');
}