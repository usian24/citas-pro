'use strict';

/* ══════════════════════════
   QR
══════════════════════════ */
function generateQR(text, containerId) {
  var container = G(containerId); if (!container) return;
  var size   = 180;
  var imgUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text) + '&bgcolor=ffffff&color=000000&margin=10';
  var img    = document.createElement('img');
  img.src    = imgUrl; img.width = size; img.height = size; img.alt = 'Código QR';
  img.style.borderRadius = '8px'; img.style.display = 'block';
  img.onerror = function() { container.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px;text-align:center">📱 Conecta a internet para ver el QR</div>'; };
  container.innerHTML = ''; container.appendChild(img);
}

function openQRModal() {
  if (!CUR) return;
  var link = 'https://citaspro.app/b/' + CUR.id;
  var el = G('qr-link-text'); if (el) el.textContent = link;
  generateQR(link, 'qr-code');
  var wa = G('qr-wa-btn'); if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent('📅 Reserva tu cita en ' + CUR.name + ' → ' + link);
  openOv('ov-qr');
}

/* ══════════════════════════
   HASH ROUTING
══════════════════════════ */
function checkLinkAccess() {
  var hash = window.location.hash;
  if (hash && hash.indexOf('#b/') === 0) {
    var bizId = hash.slice(3);
    if (bizId) {
      var biz = DB.businesses.filter(function(b) { return b.id === bizId; })[0];
      if (biz) { setTimeout(function() { loadBizDirect(bizId); }, 100); return true; }
    }
  }
  return false;
}

/* ══════════════════════════
   INIT — window.onload
══════════════════════════ */
window.onload = function() {
  DB = loadDB(); initREG(); initCSEL();

  /* Cerrar overlays al click en fondo */
  document.querySelectorAll('.ov').forEach(function(o) {
    o.addEventListener('click', function(e) { if (e.target === o) o.classList.remove('on'); });
  });

  /* Portal principal */
  on('dots-btn', 'click', function() {
    var em = G('dots-email'), ps = G('dots-pass');
    if (em) em.value = ''; if (ps) ps.value = '';
    hideErr('dots-err'); openOv('ov-admin');
    setTimeout(function() { var e = G('dots-email'); if (e) e.focus(); }, 250);
  });
  on('btn-crear', 'click', function() { openRegModal(); });
  on('btn-login', 'click', function() { openLoginModal(); });

  /* Modal registro */
  on('rm-close1',    'click', function() { closeOv('ov-registro'); });
  on('rm-close2',    'click', function() { closeOv('ov-registro'); });
  on('rm-btn-next',  'click', rmGoStep2);
  on('rm-btn-verify','click', rmVerify);
  on('rm-btn-resend','click', rmResend);
  on('rm-btn-back',  'click', function() { var s1 = G('rm-step1'), s2 = G('rm-step2'); if (s1) s1.style.display = 'block'; if (s2) s2.style.display = 'none'; hideErr('rm-err2'); });
  on('rm-go-login',  'click', function() { closeOv('ov-registro'); openLoginModal(); });
  on('rm-pass', 'input',   function() { updateRmPassStrength(this.value); });
  on('rm-pass', 'keydown', function(e) { if (e.key === 'Enter') rmGoStep2(); });
  [0,1,2,3,4,5].forEach(function(i) {
    var box = G('rc' + i); if (!box) return;
    box.addEventListener('input',   function()  { codeInput(i); });
    box.addEventListener('keydown', function(e) { codeKey(e, i); });
  });
  document.addEventListener('paste', function(e) {
    var focused = document.activeElement;
    if (!focused || !focused.id || !focused.id.match(/^rc\d/)) return;
    var pasted = (e.clipboardData || window.clipboardData).getData('text');
    var digits = pasted.replace(/[^0-9]/g, '').slice(0, 6);
    if (digits.length >= 4) { e.preventDefault(); [0,1,2,3,4,5].forEach(function(i) { var b = G('rc' + i); if (b) b.value = digits[i] || ''; }); if (digits.length === 6) setTimeout(rmVerify, 300); }
  });

  /* Modal login */
  on('login-close',    'click', function() { closeOv('ov-login'); });
  on('li-btn-login',   'click', doLogin);
  on('li-pass',  'keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  on('li-email', 'keydown', function(e) { if (e.key === 'Enter') { var p = G('li-pass'); if (p) p.focus(); } });
  on('li-forgot',      'click', openForgotModal);
  on('li-go-register', 'click', function() { closeOv('ov-login'); openRegModal(); });

  /* Modal forgot */
  on('forgot-close', 'click', function() { closeOv('ov-forgot'); });
  on('fp-btn-send',  'click', doForgot);
  on('fp-email', 'keydown', function(e) { if (e.key === 'Enter') doForgot(); });
  on('fp-btn-back',  'click', function() { closeOv('ov-forgot'); openLoginModal(); });

  /* Modal admin 3 puntitos */
  on('dots-cancel-btn', 'click', function() { closeOv('ov-admin'); });
  on('dots-login-btn',  'click', dotsLogin);
  on('dots-pass', 'keydown', function(e) { if (e.key === 'Enter') dotsLogin(); });

  /* Admin panel */
  on('adm-login-btn', 'click', doAdminLogin);
  on('adm-pass', 'keydown', function(e) { if (e.key === 'Enter') doAdminLogin(); });
  on('adm-back-btn',  'click', function() { goTo('s-portal'); });
  on('adm-home-btn',  'click', function() { goTo('s-portal'); });
  on('adm-out-btn',   'click', doAdminLogout);
  on('adm-notif-btn', 'click', function() { renderNotifications(); openOv('ov-notif'); });
  on('cfg-save-btn',  'click', function() { toast('✅ Configuración guardada', '#4A7FD4'); });
  on('cfg-pass-btn',  'click', function() {
    var p1 = V('cfg-pass1'), p2 = V('cfg-pass2');
    if (!p1 || p1 !== p2) { showErr('cfg-pass-err', 'Las contraseñas no coinciden.'); return; }
    if (p1.length < 8)    { showErr('cfg-pass-err', 'Mínimo 8 caracteres.'); return; }
    hideErr('cfg-pass-err'); toast('✅ Contraseña actualizada', '#4A7FD4');
  });
  on('close-notif',       'click', function() { closeOv('ov-notif'); });
  on('close-biz-profile', 'click', function() { closeOv('ov-biz-profile'); });

  /* Biz registro */
  on('reg-start-btn',    'click', function() { bizRegStep(1); });
  on('login-toggle-btn', 'click', function() { goTo('s-portal'); openLoginModal(); });
  on('back-1','click',function(){bizRegStep(0);}); on('back-2','click',function(){bizRegStep(1);}); on('back-3','click',function(){bizRegStep(2);});
  on('back-4','click',function(){bizRegStep(3);}); on('back-5','click',function(){bizRegStep(4);}); on('back-6','click',function(){bizRegStep(5);});
  on('next-1','click',function(){bizRegStep(2);}); on('next-2','click',function(){bizRegStep(3);}); on('next-3','click',function(){bizRegStep(4);});
  on('next-4','click',function(){bizRegStep(5);}); on('next-5','click',function(){bizRegStep(6);}); on('skip-5','click',function(){bizRegStep(6);}); on('next-6','click',function(){bizRegStep(7);});
  on('enter-panel-btn', 'click', completeBizReg);
  on('copy-link-reg',   'click', copyLink);
  on('add-reg-svc',     'click', function() { openSvcModal(null); });
  on('br-pass', 'input', function() { updatePassStrength(this.value); });
  [['barberia','Barbería'],['peluqueria','Peluquería'],['unias','Uñas'],['salon','Salón'],['spa','Spa'],['estetica','Estética']].forEach(function(t) { on('type-' + t[0], 'click', function() { selType('type-' + t[0], t[1]); }); });
  [['sz-1','1'],['sz-24','2-4'],['sz-59','5-9'],['sz-10','10+']].forEach(function(s) { on(s[0], 'click', function() { selSize(s[0], s[1]); }); });

  /* Biz panel */
  on('biz-home-btn',  'click', function() { goTo('s-portal'); });
  on('biz-out-btn',   'click', bizLogout);
  on('copy-link-btn', 'click', copyLink);
  on('view-portal-btn','click', goClientFromBiz);
  on('new-appt-btn',  'click', openApptModal); on('new-appt-btn2','click', openApptModal);
  on('add-barber-btn','click', function() { openBarberModal(null); });
  on('add-svc-btn',   'click', function() { openSvcModal(null); });
  on('save-profile-btn','click', saveBizProfile);
  on('save-horario-btn','click', function() { if (CUR) { saveDB(); toast('✅ Horario guardado', '#4A7FD4'); } });
  on('add-gallery-btn', 'click', function() { var gi = G('gallery-input'); if (gi) gi.click(); });

  /* Modales negocio */
  on('close-svc',  'click', function() { closeOv('ov-svc'); });    on('save-svc-btn', 'click', saveSvc);
  on('close-bar',  'click', function() { closeOv('ov-barber'); }); on('save-bar-btn', 'click', saveBarber);
  on('close-appt', 'click', function() { closeOv('ov-appt'); });   on('save-appt-btn','click', saveAppt);

  /* Cliente */
  on('cl-back-btn', 'click', function() { goTo('s-portal'); });
  on('cs1-next',    'click', function() { clStep(2); });
  on('cs2-next',    'click', function() { clStep(3); });
  on('cs2-back',    'click', function() { clGoStep(1); });
  on('cs3-next',    'click', function() { clStep(4); });
  on('cs3-back',    'click', function() { clGoStep(2); });
  on('cs4-confirm', 'click', confirmBooking);
  on('cs4-back',    'click', function() { clGoStep(3); });
  on('cl-reset-btn','click', resetBooking);

  /* Fotos */
  setupPhotoUpload();

  /* Eye toggles */
  toggleEye('adm-pass',  'adm-pass-eye');
  toggleEye('dots-pass', 'dots-pass-eye');
  toggleEye('br-pass',   'br-pass-eye');
  toggleEye('rm-pass',   'rm-pass-eye');
  toggleEye('li-pass',   'li-pass-eye');

  /* QR */
  on('qr-btn',      'click', openQRModal);
  on('qr-copy-btn', 'click', function() {
    if (!CUR) return;
    try { navigator.clipboard.writeText('https://citaspro.app/b/' + CUR.id); } catch(e) {}
    toast('📋 Enlace copiado', '#4A7FD4');
  });
  on('qr-download-btn', 'click', function() {
    var img = G('qr-code') ? G('qr-code').querySelector('img') : null; if (!img) return;
    var a = document.createElement('a'); a.href = img.src; a.download = 'QR-' + ((CUR && CUR.name) || 'citaspro') + '.png'; a.click();
  });

  /* Globals para inline HTML */
  window.admTab         = admTab;
  window.bizTab         = bizTab;
  window.openBizProfile = openBizProfile;
  window.extendTrial    = extendTrial;
  window.activateBiz    = activateBiz;
  window.suspendBiz     = suspendBiz;
  window.copyText       = copyText;
  window.delGalleryPhoto= delGalleryPhoto;
  window.filterClientBiz= filterClientBiz;
  window.prevMonth      = prevMonth;
  window.nextMonth      = nextMonth;
  window.selectCalDay   = selectCalDay;
  window.openApptDetail = openApptDetail;
  window.toggleHorarioDay = toggleHorarioDay;
  window.openSvcModal   = openSvcModal;
  window.openBarberModal= openBarberModal;
  window.delService     = delService;
  window.delBarber      = delBarber;
  window.loadBizDirect  = loadBizDirect;
  window.openQRModal    = openQRModal;
  window.REG            = REG;

  /* Arranque */
  if (DB.admin && DB.admin.auth) { goTo('s-admin'); showAdminPanel(); }
  else if (DB.currentBiz) { goBiz(); }
  else if (!checkLinkAccess()) { goTo('s-portal'); }
};