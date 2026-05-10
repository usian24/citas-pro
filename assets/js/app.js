'use strict';
//  app.js
/* ══════════════════════════
   SELECTOR DE PAÍS
══════════════════════════ */
function toggleCountryDropdown() {
  var dd = G('br-country-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function selectCountry(code, label) {
  var input = G('br-country');
  var display = G('br-country-label');
  var dd = G('br-country-dropdown');
  if (input) input.value = code;
  if (display) display.textContent = label;
  if (dd) dd.style.display = 'none';
}

window.toggleCountryDropdown = toggleCountryDropdown;
window.selectCountry = selectCountry;

/* ══════════════════════════
   QR
══════════════════════════ */
function generateQR(text, containerId) {
  var container = G(containerId);
  if (!container) return;
  var size = 180;
  var imgUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text) + '&bgcolor=ffffff&color=000000&margin=10';
  var img = document.createElement('img');
  img.src = imgUrl;
  img.width = size;
  img.height = size;
  img.alt = 'Código QR';
  img.style.borderRadius = '8px';
  img.style.display = 'block';
  img.onerror = function () {
    container.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px;text-align:center">Conecta a internet para ver el QR</div>';
  };
  container.innerHTML = '';
  container.appendChild(img);
}

function openQRModal() {
  if (!CUR) return;
  var link = 'https://citasproonline.com/#b/' + CUR.id;
  var el = G('qr-link-text');
  if (el) el.textContent = link;
  generateQR(link, 'qr-code');
  var wa = G('qr-wa-btn');
  if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent('Reserva tu cita en ' + CUR.name + ' → ' + link);
  openOv('ov-qr');
}

/* ══════════════════════════
   FIDELIZACIÓN (TARJETA DE SELLOS)
══════════════════════════ */
window.buildLoyaltyHtml = function (a, allAppts) {
  if (!a || !allAppts) return '';

  var bizId = a.business_id || (typeof CUR !== 'undefined' && CUR ? CUR.id : null) || (typeof CUR_WORKER !== 'undefined' && CUR_WORKER ? CUR_WORKER.business_id : null);
  var biz = typeof getBizById === 'function' ? getBizById(bizId) : null;
  if (!biz && typeof DB !== 'undefined' && DB.businesses) biz = DB.businesses.find(b => b.id === bizId);
  if (!biz && typeof CUR !== 'undefined' && CUR) biz = CUR;

  var isActive = biz && biz.loyalty && biz.loyalty.active !== undefined ? biz.loyalty.active : true;
  if (!isActive) return '';
  var MAX_STAMPS = (biz && biz.loyalty && biz.loyalty.stamps) ? biz.loyalty.stamps : 10;

  // Buscar cuántas citas completadas tuvo el cliente ANTES de esta cita
  var pastCompleted = allAppts.filter(function (x) {
    if (x.status !== 'completed' || String(x.id) === String(a.id)) return false;
    // Solo contar citas que sucedieron antes que la actual
    var dateX = new Date(x.date + 'T' + (x.time || '00:00'));
    var dateA = new Date(a.date + 'T' + (a.time || '00:00'));
    if (dateX >= dateA) return false;

    // Identificación EXACTA por Correo Electrónico (Login Automático)
    var e1 = String(a.email || '').toLowerCase().trim();
    var e2 = String(x.email || '').toLowerCase().trim();
    if (e1 && e2 && e1 === e2) return true;

    return false;
  }).length;

  // REGLA: Mostrar a los trabajadores o administradores SOLO a partir de la racha 3 (2 citas completadas en el pasado)
  if (pastCompleted < 2) return '';

  var stampsBefore = pastCompleted % MAX_STAMPS;
  var currentStamps = a.status === 'completed' ? (pastCompleted + 1) % MAX_STAMPS : stampsBefore;
  var displayStamps = (a.status === 'completed' && stampsBefore === (MAX_STAMPS - 1)) ? MAX_STAMPS : currentStamps;

  var circles = '';
  for (var i = 1; i <= MAX_STAMPS; i++) {
    var isOn = i <= displayStamps;
    if (i === MAX_STAMPS) {
      circles += '<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:' + (isOn ? 'var(--green)' : 'var(--bg3)') + ';border:1px solid ' + (isOn ? 'var(--green)' : 'var(--b)') + ';color:#fff;box-shadow:' + (isOn ? '0 0 10px rgba(34,197,94,.4)' : 'none') + ';transition:all .3s;flex-shrink:0">🎁</div>';
    } else {
      circles += '<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:' + (isOn ? 'var(--blue)' : 'var(--bg3)') + ';border:1px solid ' + (isOn ? 'var(--blue)' : 'var(--b)') + ';color:' + (isOn ? '#fff' : 'transparent') + ';transition:all .3s;flex-shrink:0">✓</div>';
    }
  }
  var circlesStyle = MAX_STAMPS > 10 ? 'display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin-bottom:12px' : 'display:flex;justify-content:space-between;gap:4px;margin-bottom:12px';

  var msg = '';
  if (displayStamps === MAX_STAMPS) msg = '<span style="color:var(--green);font-weight:800">¡Premio canjeado en esta asistencia! 🎉</span>';
  else if (stampsBefore === (MAX_STAMPS - 1) && a.status !== 'completed') msg = '<span style="color:var(--green);font-weight:800;font-size:12px">🎁 ¡Esta asistencia es el premio! (Gratis)</span>';
  else msg = 'Faltan ' + (MAX_STAMPS - displayStamps) + ' asistencias para el premio.';

  return '<div style="background:var(--card);border:1px solid var(--b);border-radius:16px;padding:16px;margin-bottom:14px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    + '<div style="font-size:13px;font-weight:800;color:var(--text)">Racha de Asistencias</div>'
    + '<div style="font-size:11px;font-weight:700;color:var(--blue);background:var(--bblue);padding:3px 8px;border-radius:8px">' + displayStamps + '/' + MAX_STAMPS + ' Rachas</div>'
    + '</div>'
    + '<div style="' + circlesStyle + '">' + circles + '</div>'
    + '<div style="text-align:center;font-size:11px;color:var(--muted)">' + msg + '</div>'
    + '</div>';
};

window.buildClientLoyaltyHtml = function (bizId, phone, email, name) {
  var biz = typeof getBizById === 'function' ? getBizById(bizId) : null;
  if (!biz && typeof DB !== 'undefined' && DB.businesses) biz = DB.businesses.find(b => b.id === bizId);
  if (!biz) return '';

  var isActive = biz.loyalty && biz.loyalty.active !== undefined ? biz.loyalty.active : true;
  if (!isActive) return '';
  var MAX_STAMPS = (biz.loyalty && biz.loyalty.stamps) ? biz.loyalty.stamps : 10;

  var allAppts = [];
  (biz.workers || []).forEach(function (w) { (w.appointments || []).forEach(function (ap) { allAppts.push(ap); }); });
  (biz.appointments || []).forEach(function (ap) { allAppts.push(ap); });

  var pastCompleted = allAppts.filter(function (x) {
    if (x.status !== 'completed') return false;
    // Identificación EXACTA por Correo Electrónico (Login Automático)
    var e1 = String(email || '').toLowerCase().trim();
    var e2 = String(x.email || '').toLowerCase().trim();
    if (e1 && e2 && e1 === e2) return true;
    return false;
  }).length;

  var currentStamps = pastCompleted % MAX_STAMPS;

  var circles = '';
  for (var i = 1; i <= MAX_STAMPS; i++) {
    var isOn = i <= currentStamps;
    if (i === MAX_STAMPS) {
      circles += '<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:' + (isOn ? 'var(--green)' : 'var(--bg3)') + ';border:1px solid ' + (isOn ? 'var(--green)' : 'var(--b)') + ';color:#fff;box-shadow:' + (isOn ? '0 0 10px rgba(34,197,94,.4)' : 'none') + ';transition:all .3s;flex-shrink:0">🎁</div>';
    } else {
      circles += '<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:' + (isOn ? 'var(--blue)' : 'var(--bg3)') + ';border:1px solid ' + (isOn ? 'var(--blue)' : 'var(--b)') + ';color:' + (isOn ? '#fff' : 'transparent') + ';transition:all .3s;flex-shrink:0">✓</div>';
    }
  }
  var circlesStyle = MAX_STAMPS > 10 ? 'display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin-bottom:12px' : 'display:flex;justify-content:space-between;gap:4px;margin-bottom:12px';

  var msg = '';
  if (currentStamps === (MAX_STAMPS - 1)) msg = '<span style="color:var(--green);font-weight:800">¡Tu próxima cita es el premio! 🎁 (Gratis)</span>';
  else msg = 'Faltan ' + (MAX_STAMPS - currentStamps) + ' asistencias para tu premio.';

  var firstName = name ? name.split(' ')[0] : 'Cliente';

  return '<div style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:16px;padding:16px;margin-bottom:20px;animation:fadeUp .4s ease">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    + '<div style="font-size:13px;font-weight:800;color:var(--text)">¡Hola, ' + san(firstName) + '! Tu Racha actual</div>'
    + '<div style="font-size:11px;font-weight:700;color:var(--blue);background:rgba(74,127,212,.15);padding:3px 8px;border-radius:8px">' + currentStamps + '/' + MAX_STAMPS + ' Rachas</div>'
    + '</div>'
    + '<div style="' + circlesStyle + '">' + circles + '</div>'
    + '<div style="text-align:center;font-size:12px;color:var(--blue3);font-weight:600">' + msg + '</div>'
    + '</div>';
};

window.checkLoyaltyReward = function (bizId, appt) {
  if (!appt || !appt.email) return;
  var biz = typeof getBizById === 'function' ? getBizById(bizId) : null;
  if (!biz && typeof DB !== 'undefined' && DB.businesses) biz = DB.businesses.find(b => b.id === bizId);
  if (!biz) return;

  var isActive = biz.loyalty && biz.loyalty.active !== undefined ? biz.loyalty.active : true;
  if (!isActive) return;
  var MAX_STAMPS = (biz.loyalty && biz.loyalty.stamps) ? biz.loyalty.stamps : 10;

  var allAppts = [];
  (biz.workers || []).forEach(function (w) { (w.appointments || []).forEach(function (a) { allAppts.push(a); }); });
  (biz.appointments || []).forEach(function (a) { allAppts.push(a); });

  var pastCompleted = allAppts.filter(function (x) {
    if (x.status !== 'completed' || String(x.id) === String(appt.id)) return false;
    if (x.date && appt.date && new Date(x.date) > new Date(appt.date)) return false;
    // Identificación EXACTA por Correo Electrónico
    var e1 = String(appt.email || '').toLowerCase().trim(); var e2 = String(x.email || '').toLowerCase().trim();
    if (e1 && e2 && e1 === e2) return true;
    return false;
  }).length;

  if (pastCompleted % MAX_STAMPS === (MAX_STAMPS - 1) && appt.status === 'completed') {
    fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'loyalty_reward', to: appt.email, data: { clientName: appt.client, bizName: biz.name } }) }).catch(function (e) { console.error(e); });
  }
};
function copyText(txt) {
  try { navigator.clipboard.writeText(txt); } catch (e) { }
  toast('Copiado', '#4A7FD4');
}

/* ══════════════════════════
   FUNCIONES DE NUBE
══════════════════════════ */
async function fetchBizFromCloud(bizId) {
  try {
    const response = await fetch('/api/get-biz?id=' + bizId + '&_t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (err) {
    console.error('Error obteniendo datos de la nube:', err);
  }
  return null;
}

function syncBizToLocal(cloudData) {
  if (typeof window.autoCompletePastAppointments === 'function') {
    if (window.autoCompletePastAppointments(cloudData)) {
      if (typeof syncAppointmentsToCloud === 'function') syncAppointmentsToCloud(cloudData);
    }
  }
  let index = DB.businesses.findIndex(b => b.id === cloudData.id);
  if (index >= 0) {
    DB.businesses[index] = cloudData;
  } else {
    DB.businesses.push(cloudData);
  }
  CUR = cloudData;
}

/* ══════════════════════════
   WINDOW.ONLOAD
══════════════════════════ */
window.onload = async function () {
  if (typeof bootComponents === 'function') {
    await bootComponents();
  }

  DB = loadDB();
  initREG();
  initCSEL();
  initTheme();

  // ¡MUY IMPORTANTE! Restaurar la sesión DESPUÉS de que bootComponents haya insertado el HTML de las vistas.
  if (typeof restaurarSesion === 'function') restaurarSesion();

  // Sincronizar visualmente los interruptores de idioma ahora que los componentes ya existen
  if (typeof window.syncLanguageToggles === 'function') window.syncLanguageToggles();

  /* Cerrar overlays al click en fondo */
  document.querySelectorAll('.ov').forEach(function (o) {
    o.addEventListener('click', function (e) { if (e.target === o) closeOv(o.id); });
  });

  /* Cerrar dropdown país al click fuera */
  document.addEventListener('click', function (e) {
    var wrapper = G('country-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      var dd = G('br-country-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });

  /* Toggle tema día/noche */
  on('theme-toggle', 'click', toggleTheme);

  on('btn-crear', 'click', function () { openRegModal(); });
  on('btn-login', 'click', function () { openLoginModal(); });

  /* Modal registro */
  on('rm-close1', 'click', function () { closeOv('ov-registro'); });
  on('rm-close2', 'click', function () { closeOv('ov-registro'); });
  on('rm-btn-next', 'click', rmGoStep2);
  on('rm-btn-verify', 'click', rmVerify);
  on('rm-btn-resend', 'click', rmResend);
  on('rm-btn-back', 'click', function () {
    var s1 = G('rm-step1'), s2 = G('rm-step2');
    if (s1) s1.style.display = 'block';
    if (s2) s2.style.display = 'none';
    hideErr('rm-err2');
  });
  on('rm-go-login', 'click', function () { closeOv('ov-registro'); openLoginModal(); });
  on('rm-pass', 'input', function () { updateRmPassStrength(this.value); });
  on('rm-pass', 'keydown', function (e) { if (e.key === 'Enter') rmGoStep2(); });

  [0, 1, 2, 3, 4, 5].forEach(function (i) {
    var box = G('rc' + i);
    if (!box) return;
    box.addEventListener('input', function () { codeInput(i); });
    box.addEventListener('keydown', function (e) { codeKey(e, i); });
  });

  document.addEventListener('paste', function (e) {
    var focused = document.activeElement;
    if (!focused || !focused.id || !focused.id.match(/^rc\d/)) return;
    var pasted = (e.clipboardData || window.clipboardData).getData('text');
    var digits = pasted.replace(/[^0-9]/g, '').slice(0, 6);
    if (digits.length >= 4) {
      e.preventDefault();
      [0, 1, 2, 3, 4, 5].forEach(function (i) {
        var b = G('rc' + i);
        if (b) b.value = digits[i] || '';
      });
      if (digits.length === 6) setTimeout(rmVerify, 300);
    }
  });

  /* Modal login */
  on('login-close', 'click', function () { closeOv('ov-login'); });
  on('li-btn-login', 'click', doLogin);
  on('li-pass', 'keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  on('li-email', 'keydown', function (e) { if (e.key === 'Enter') { var p = G('li-pass'); if (p) p.focus(); } });
  on('li-forgot', 'click', openForgotModal);
  on('li-go-register', 'click', function () { closeOv('ov-login'); openRegModal(); });

  /* Modal forgot */
  on('forgot-close', 'click', function () { closeOv('ov-forgot'); });
  on('fp-btn-send', 'click', doForgot);
  on('fp-email', 'keydown', function (e) { if (e.key === 'Enter') doForgot(); });
  on('fp-btn-back', 'click', function () { closeOv('ov-forgot'); openLoginModal(); });

  /* Admin panel */
  on('adm-login-btn', 'click', doAdminLogin);
  on('adm-pass', 'keydown', function (e) { if (e.key === 'Enter') doAdminLogin(); });
  on('adm-back-btn', 'click', function () { goTo('s-portal'); });
  on('adm-home-btn', 'click', function () { goTo('s-portal'); });

  on('adm-out-btn', 'click', function () {
    if (typeof doAdminLogout === 'function') doAdminLogout();
  });

  on('adm-notif-btn', 'click', function () { renderNotifications(); openOv('ov-notif'); });
  on('cfg-save-btn', 'click', function () { toast('Configuración guardada', '#4A7FD4'); });
  on('cfg-pass-btn', 'click', function () {
    var p1 = V('cfg-pass1'), p2 = V('cfg-pass2');
    if (!p1 || p1 !== p2) { showErr('cfg-pass-err', 'Las contraseñas no coinciden.'); return; }
    if (p1.length < 8) { showErr('cfg-pass-err', 'Mínimo 8 caracteres.'); return; }
    hideErr('cfg-pass-err'); toast('Contraseña actualizada', '#4A7FD4');
  });

  on('close-notif', 'click', function () { closeOv('ov-notif'); });
  on('close-biz-profile', 'click', function () { closeOv('ov-biz-profile'); });

  /* Biz registro */
  on('reg-start-btn', 'click', function () { bizRegStep(1); });
  on('login-toggle-btn', 'click', function () { goTo('s-portal'); openLoginModal(); });
  on('back-1', 'click', function () { bizRegStep(0); });
  on('back-2', 'click', function () { bizRegStep(1); });
  on('back-3', 'click', function () { bizRegStep(2); });
  on('back-4', 'click', function () { bizRegStep(3); });
  on('back-5', 'click', function () { bizRegStep(4); });
  on('back-6', 'click', function () { bizRegStep(5); });
  on('next-1', 'click', function () { bizRegStep(2); });
  on('next-2', 'click', function () { bizRegStep(3); });
  on('next-3', 'click', function () { bizRegStep(4); });
  on('next-4', 'click', function () { bizRegStep(5); });
  on('next-5', 'click', function () { bizRegStep(6); });
  on('skip-5', 'click', function () { bizRegStep(6); });
  on('next-6', 'click', function () { bizRegStep(7); });

  on('enter-panel-btn', 'click', function () {
    CUR = DB.businesses.filter(function (b) { return b.id === DB.currentBiz; })[0];
    if (typeof saveDB === 'function') saveDB();
    if (CUR) {
      if (typeof showBizPanel === 'function') showBizPanel();
    } else {
      showRegStep(0);
    }
  });

  on('copy-link-reg', 'click', copyLink);
  on('br-pass', 'input', function () { updatePassStrength(this.value); });

  [['barberia', 'Barbería'], ['peluqueria', 'Peluquería'], ['unias', 'Uñas'], ['salon', 'Salón'], ['spa', 'Spa'], ['estetica', 'Estética']].forEach(function (t) {
    on('type-' + t[0], 'click', function () { selType('type-' + t[0], t[1]); });
  });
  [['sz-1', '1'], ['sz-24', '2-4'], ['sz-59', '5-9'], ['sz-10', '10+']].forEach(function (s) {
    on(s[0], 'click', function () { selSize(s[0], s[1]); });
  });

  /* Biz panel — dueño */
  on('biz-out-btn', 'click', function () {
    if (typeof bizLogout === 'function') bizLogout();
  });

  on('copy-link-btn', 'click', copyLink);
  on('view-portal-btn', 'click', goClientFromBiz);

  on('new-appt-btn', 'click', function () {
    if (typeof openApptModal === 'function') openApptModal();
  });
  on('new-appt-btn2', 'click', function () {
    if (typeof openApptModal === 'function') openApptModal();
  });

  on('add-barber-btn', 'click', function () { openWorkerModal(null); });

  on('save-profile-btn', 'click', function () {
    if (typeof saveBizProfile === 'function') saveBizProfile();
  });

  on('add-gallery-btn', 'click', function () {
    var gi = G('gallery-input'); if (gi) gi.click();
  });

  /* Modales negocio */
  on('close-bar', 'click', function () { closeOv('ov-barber'); });
  on('save-bar-btn', 'click', function () {
    if (typeof saveBarber === 'function') saveBarber();
  });
  on('close-appt', 'click', function () { closeOv('ov-appt'); });
  on('save-appt-btn', 'click', function () {
    if (typeof saveAppt === 'function') saveAppt();
  });

  /* Modal confirmación genérico */
  on('confirm-ok-btn', 'click', function () {
    if (typeof confirmOk === 'function') confirmOk();
  });
  on('confirm-cancel-btn', 'click', function () {
    if (typeof confirmCancel === 'function') confirmCancel();
  });

  /* Modal gestión de cita (cliente) */
  on('close-manage', 'click', function () { closeOv('ov-manage'); window.location.hash = ''; });

  /* Panel trabajador */
  on('wk-out-btn', 'click', function () {
    if (typeof workerLogout === 'function') workerLogout();
  });

  on('wk-copy-link', 'click', function () {
    if (typeof copyWorkerLink === 'function') {
      copyWorkerLink();
    } else if (CUR) {
      try { navigator.clipboard.writeText('https://citasproonline.com/#b/' + CUR.id); } catch (e) { }
      toast('Enlace copiado', '#4A7FD4');
    }
  });

  on('wk-add-svc-btn', 'click', function () {
    if (typeof openWorkerSvcModal === 'function') openWorkerSvcModal(null);
  });
  on('wk-add-gallery-btn', 'click', function () {
    var gi = G('wk-gallery-input'); if (gi) gi.click();
  });
  on('save-wk-profile-btn', 'click', function () {
    if (typeof saveWorkerProfile === 'function') saveWorkerProfile();
  });
  on('save-wk-pass-btn', 'click', function () {
    if (typeof saveWorkerPassword === 'function') saveWorkerPassword();
  });
  on('save-wk-horario-btn', 'click', function () {
    if (typeof CUR_WORKER !== 'undefined' && CUR_WORKER) {
      syncWorkerToCloud();
      saveDB();
      toast('Horario guardado', '#4A7FD4');
    }
  });
  on('clear-notif-btn', 'click', function () {
    if (typeof clearWorkerNotifications === 'function') clearWorkerNotifications();
  });
  on('wk-profile-photo-btn', 'click', function () {
    var gi = G('wk-profile-photo-input'); if (gi) gi.click();
  });

  /* Modales trabajador */
  on('close-wk-svc', 'click', function () { closeOv('ov-wk-svc'); });
  on('save-wk-svc-btn', 'click', function () {
    if (typeof saveWorkerSvc === 'function') saveWorkerSvc();
  });
  on('close-wk-appt-detail', 'click', function () { closeOv('ov-wk-appt-detail'); });

  /* Portal cliente — nuevo flujo */
  on('cl-back-btn', 'click', function () { goTo('s-portal'); });
  on('cs1-next', 'click', clStep2);
  on('cs2-next', 'click', function () { clStep4(); });
  on('cs2-back', 'click', function () {
    var n = G('cl-name'), p = G('cl-phone'), e = G('cl-email');
    if (n && CSEL.clientName) n.value = CSEL.clientName;
    if (p && CSEL.clientPhone) p.value = CSEL.clientPhone;
    if (e && CSEL.clientEmail) e.value = CSEL.clientEmail;
    clGoStep(1);
  });
  on('cs3-next', 'click', clStep4);
  on('cs3-back', 'click', function () { clGoStep(2); });
  on('cs4-next', 'click', clStep5);
  on('cs4-back', 'click', function () { clGoStep(3); });
  on('cs5-confirm', 'click', confirmBooking);
  on('cs5-back', 'click', function () { clGoStep(4); });
  on('cl-reset-btn', 'click', resetBooking);

  /* Fotos */
  setupPhotoUpload();
  setupWorkerPhotoUpload();

  /* Eye toggles */
  if (typeof initAllEyeToggles === 'function') initAllEyeToggles();

  /* QR */
  on('qr-btn', 'click', openQRModal);
  on('qr-copy-btn', 'click', function () {
    if (!CUR) return;
    try { navigator.clipboard.writeText('https://citasproonline.com/#b/' + CUR.id); } catch (e) { }
    toast('Enlace copiado', '#4A7FD4');
  });
  on('qr-download-btn', 'click', function () {
    var img = G('qr-code') ? G('qr-code').querySelector('img') : null;
    if (!img) return;
    var a = document.createElement('a');
    a.href = img.src;
    a.download = 'QR-' + ((CUR && CUR.name) || 'citaspro') + '.png';
    a.click();
  });

  /* GLOBALS EXPORTADAS */
  window.admTab = admTab;
  window.bizTab = bizTab;
  window.workerTab = workerTab;
  window.openBizProfile = openBizProfile;
  window.extendTrial = extendTrial;
  window.activateBiz = activateBiz;
  window.suspendBiz = suspendBiz;
  window.deleteBiz = deleteBiz;
  window.copyText = copyText;
  window.filterClientBiz = filterClientBiz;
  window.openBizConfig = typeof openBizConfig === 'function' ? openBizConfig : function () { };
  window.openWorkerConfig = typeof openWorkerConfig === 'function' ? openWorkerConfig : function () { };
  window.openWorkerNotifs = typeof openWorkerNotifs === 'function' ? openWorkerNotifs : function () { };

  window.prevMonth = typeof prevMonth === 'function' ? prevMonth : function () { };
  window.nextMonth = typeof nextMonth === 'function' ? nextMonth : function () { };
  window.selectCalDay = typeof selectCalDay === 'function' ? selectCalDay : function () { };
  window.openApptDetail = typeof openApptDetail === 'function' ? openApptDetail : function () { };
  window.toggleHorarioDay = typeof toggleHorarioDay === 'function' ? toggleHorarioDay : function () { };
  window.openWorkerModal = typeof openWorkerModal === 'function' ? openWorkerModal : function () { };
  window.confirmDeleteWorker = typeof confirmDeleteWorker === 'function' ? confirmDeleteWorker : function () { };
  window.delService = typeof delService === 'function' ? delService : function () { };
  window.loadBizDirect = typeof loadBizDirect === 'function' ? loadBizDirect : function () { };
  window.openQRModal = typeof openQRModal === 'function' ? openQRModal : function () { };
  window.openWorkerSvcModal = typeof openWorkerSvcModal === 'function' ? openWorkerSvcModal : function () { };
  window.delWorkerService = typeof delWorkerService === 'function' ? delWorkerService : function () { };
  window.delWorkerGalleryPhoto = typeof delWorkerGalleryPhoto === 'function' ? delWorkerGalleryPhoto : function () { };
  window.prevWorkerMonth = typeof prevWorkerMonth === 'function' ? prevWorkerMonth : function () { };
  window.nextWorkerMonth = typeof nextWorkerMonth === 'function' ? nextWorkerMonth : function () { };
  window.selectWorkerCalDay = typeof selectWorkerCalDay === 'function' ? selectWorkerCalDay : function () { };
  window.openWorkerApptDetail = typeof openWorkerApptDetail === 'function' ? openWorkerApptDetail : function () { };
  window.toggleWorkerHorarioDay = typeof toggleWorkerHorarioDay === 'function' ? toggleWorkerHorarioDay : function () { };
  window.selectWorker = typeof selectWorker === 'function' ? selectWorker : function () { };
  window.cancelApptByToken = typeof cancelApptByToken === 'function' ? cancelApptByToken : function () { };
  window.confirmOk = typeof confirmOk === 'function' ? confirmOk : function () { };
  window.confirmCancel = typeof confirmCancel === 'function' ? confirmCancel : function () { };
  window.REG = REG;

  /* ══════════════════════════════════════════════════
     STICKY SPLIT HORARIO — activar al pulsar tab
  ══════════════════════════════════════════════════ */
  if (window.innerWidth >= 1024) {
    var horarioTabBtn = G('wn-horario');
    if (horarioTabBtn) {
      horarioTabBtn.addEventListener('click', function () {
        setTimeout(initHorarioSplit, 200);
      });
    }
  }

  /* ARRANQUE CONECTADO A LA NUBE */
  (async function startup() {
    const hash = window.location.hash;

    if (hash && hash.startsWith('#b/')) {
      goTo('s-barber-portal');
      const targetBizId = hash.split('/')[1];

      if (targetBizId) {
        try {
          const cloudBiz = await fetchBizFromCloud(targetBizId);
          if (cloudBiz) {
            syncBizToLocal(cloudBiz);
            DB.currentWorker = null;
            saveDB();
            loadBizDirect(targetBizId);
            return;
          } else {
            toast('La barbería no existe en la nube.', '#EF4444');
          }
        } catch (e) {
          if (getBizById(targetBizId)) {
            loadBizDirect(targetBizId);
            return;
          }
        }
      }
      window.location.hash = '';
      goTo('s-portal');
      return;
    }

    if (typeof checkLinkAccess === 'function') {
      const handled = await checkLinkAccess();
      if (handled) return;
    }

    if (DB.admin && DB.admin.auth) {
      goTo('s-admin');
      showAdminPanel();
      if (typeof connectRealtimeForCurrentUser === 'function') connectRealtimeForCurrentUser();
    } else if (DB.currentWorker) {
      if (typeof showWorkerPanel === 'function') showWorkerPanel();
      else goTo('s-portal');
      if (typeof connectRealtimeForCurrentUser === 'function') connectRealtimeForCurrentUser();
    } else if (DB.currentBiz) {
      if (typeof showBizPanel === 'function') showBizPanel();
      else goTo('s-portal');
      if (typeof connectRealtimeForCurrentUser === 'function') connectRealtimeForCurrentUser();
    } else {
      goTo('s-portal');
    }
  })();

  /* Escuchar cambios de hash */
  window.addEventListener('hashchange', async function () {
    let newHash = window.location.hash;
    if (newHash.startsWith('#b/')) {
      let id = newHash.split('/')[1];
      const freshData = await fetchBizFromCloud(id);
      if (freshData) syncBizToLocal(freshData);
    }
    if (typeof checkLinkAccess === 'function') checkLinkAccess();
  });

}; // <-- cierre del window.onload


/* ══════════════════════════════════════════════════
   STICKY SPLIT DEL HORARIO — función global
   Se llama desde workerTab() en workers.js y desde
   el listener del tab de horario en el onload.
══════════════════════════════════════════════════ */
function initHorarioSplit() {
  var daysContainer = G('wk-horario-days');
  if (!daysContainer || window.innerWidth < 1024) return;

  // Evitar doble inicialización
  if (daysContainer.querySelector('.horario-split-wrap')) return;

  var days = Array.from(daysContainer.children);
  if (days.length < 2) return;

  var half = Math.ceil(days.length / 2);
  var topDays = days.slice(0, half);
  var botDays = days.slice(half);

  // Crear wrapper principal
  var wrap = document.createElement('div');
  wrap.className = 'horario-split-wrap';

  // Mitad superior
  var topWrap = document.createElement('div');
  topWrap.className = 'horario-top-half';
  topDays.forEach(function (d) { topWrap.appendChild(d); });

  // Divisor visual
  var divider = document.createElement('div');
  divider.className = 'horario-divider';
  divider.innerHTML = '<span>Continúa el horario</span>';

  // Mitad inferior
  var botWrap = document.createElement('div');
  botWrap.className = 'horario-bottom-half';
  botDays.forEach(function (d) { botWrap.appendChild(d); });

  wrap.appendChild(topWrap);
  wrap.appendChild(divider);
  wrap.appendChild(botWrap);
  daysContainer.appendChild(wrap);

  // Estado inicial de la mitad inferior (ligeramente opaca)
  botWrap.style.opacity = '0.5';
  botWrap.style.transform = 'translateY(16px)';

  // Scroll handler
  var topHeight = 0;
  function onScroll() {
    if (!topHeight) topHeight = topWrap.offsetHeight;
    var rect = wrap.getBoundingClientRect();
    var topbarH = 74; // altura del topbar
    var progress = Math.max(0, Math.min(1,
      (-rect.top + topbarH + topHeight * 0.4) / (topHeight * 0.6)
    ));

    // Superior: sube y se desvanece
    topWrap.style.transform = 'translateY(' + (-progress * topHeight * 0.45) + 'px)';
    topWrap.style.opacity = String(1 - progress * 0.85);

    // Inferior: sube y aparece
    botWrap.style.transform = 'translateY(' + ((1 - progress) * 16) + 'px)';
    botWrap.style.opacity = String(0.5 + progress * 0.5);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // ejecutar una vez al iniciar
}

window.initHorarioSplit = initHorarioSplit;