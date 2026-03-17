'use strict';

/* ══════════════════════════
   MODAL: CREAR CUENTA (registro)
══════════════════════════ */
var _rmCode = null, _rmData = {}, _rmTimer = null;

function openRegModal() {
  ['rm-email','rm-phone','rm-pass','rm-pass2'].forEach(function(id) { var e = G(id); if (e) e.value = ''; });
  var cb = G('rm-terms'); if (cb) cb.checked = false;
  hideErr('rm-err1'); hideErr('rm-err2');
  var s1 = G('rm-step1'), s2 = G('rm-step2');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
  var bar = G('rm-pass-bar'), lbl = G('rm-pass-lbl');
  if (bar) { bar.style.width = '0'; bar.style.background = 'rgba(74,127,212,.1)'; }
  if (lbl) lbl.textContent = '';
  [0,1,2,3,4,5].forEach(function(i) { var b = G('rc' + i); if (b) b.value = ''; });
  _rmCode = null; _rmData = {};
  if (_rmTimer) clearInterval(_rmTimer);
  openOv('ov-registro');
  setTimeout(function() { var e = G('rm-email'); if (e) e.focus(); }, 250);
}

function rmGoStep2() {
  var email = V('rm-email').trim().toLowerCase();
  var phone = sanitizeText(V('rm-phone').trim());
  var pass  = V('rm-pass');
  var pass2 = V('rm-pass2');
  var terms = G('rm-terms');
  hideErr('rm-err1');
  if (!email || !validEmail(email))   { showErr('rm-err1', 'Introduce un correo electrónico válido.'); return; }
  if (!phone || !validPhone(phone))   { showErr('rm-err1', 'Introduce un teléfono válido (mínimo 7 dígitos).'); return; }
  if (!pass  || pass.length < 6)      { showErr('rm-err1', 'La contraseña debe tener al menos 6 caracteres.'); return; }
  if (pass !== pass2)                 { showErr('rm-err1', 'Las contraseñas no coinciden. Verifícalas.'); return; }
  if (!terms || !terms.checked)       { showErr('rm-err1', 'Debes aceptar los Términos y Condiciones para continuar.'); return; }
  if (DB.businesses.filter(function(b) { return (b.email||'').toLowerCase() === email; })[0]) { showErr('rm-err1', 'Este correo ya tiene una cuenta registrada. Inicia sesión.'); return; }
  _rmData = { email: email, phone: phone, pass: pass };
  _rmCode = String(Math.floor(100000 + Math.random() * 900000));
  // NUEVO — llama a la función de Netlify que usa Resend

  fetch('/.netlify/functions/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'verification',
    to: email,
    data: { code: _rmCode }
  })
}).catch(function(e) {
  console.error('Error enviando email:', e);
});

  toast('📧 Código enviado a ' + email, '#4A7FD4');
  var conf = G('rm-email-confirm');
  if (conf) conf.innerHTML = 'Enviamos un código de 6 dígitos a <strong style="color:var(--text)">' + san(email) + '</strong>.<br><span style="font-size:12px;color:var(--muted)">Revisa también la carpeta de spam.</span>';
  var s1 = G('rm-step1'), s2 = G('rm-step2');
  if (s1) s1.style.display = 'none';
  if (s2) s2.style.display = 'block';
  [0,1,2,3,4,5].forEach(function(i) { var b = G('rc' + i); if (b) b.value = ''; });
  hideErr('rm-err2');
  startResendTimer(60);
  setTimeout(function() { var b = G('rc0'); if (b) b.focus(); }, 200);
}

function rmVerify() {
  var code = '';
  [0,1,2,3,4,5].forEach(function(i) { var b = G('rc' + i); code += (b ? b.value : ''); });
  hideErr('rm-err2');
  if (code.length < 6) { showErr('rm-err2', 'Introduce los 6 dígitos del código enviado a tu correo.'); return; }
  if (code !== _rmCode) {
    showErr('rm-err2', 'Código incorrecto. Comprueba tu email e inténtalo de nuevo.');
    var row = G('rm-code-row');
    if (row) { row.style.animation = 'shake .4s ease'; setTimeout(function() { row.style.animation = ''; }, 400); }
    [0,1,2,3,4,5].forEach(function(i) { var b = G('rc' + i); if (b) { b.style.borderColor = 'var(--red)'; setTimeout(function() { b.style.borderColor = ''; }, 1500); } });
    return;
  }
  if (_rmTimer) clearInterval(_rmTimer);
  closeOv('ov-registro');
  toast('✅ Email verificado correctamente', '#22C55E');
  setTimeout(function() {
    goBiz();
    setTimeout(function() {
      bizRegStep(2);
      var em = G('br-email'); if (em) em.value = _rmData.email || '';
      var ph = G('br-phone'); if (ph) ph.value = _rmData.phone || '';
      var ps = G('br-pass');  if (ps) { ps.value = _rmData.pass || ''; updatePassStrength(_rmData.pass || ''); }
    }, 150);
  }, 300);
}

function rmResend() {
  if (!_rmData.email) return;
  _rmCode = String(Math.floor(100000 + Math.random() * 900000));
  console.log('%c📧 Citas Pro — Nuevo código: ' + _rmCode, 'background:#141824;color:#7EB8FF;font-size:15px;font-weight:bold;padding:8px 14px;border-radius:8px;border-left:4px solid #4A7FD4');
  toast('📧 Nuevo código enviado a ' + _rmData.email, '#4A7FD4');
  [0,1,2,3,4,5].forEach(function(i) { var b = G('rc' + i); if (b) b.value = ''; });
  hideErr('rm-err2');
  startResendTimer(60);
  setTimeout(function() { var b = G('rc0'); if (b) b.focus(); }, 100);
}

function startResendTimer(secs) {
  if (_rmTimer) clearInterval(_rmTimer);
  var btn = G('rm-btn-resend'), timer = G('rm-resend-timer');
  if (btn) btn.style.display = 'none';
  if (timer) timer.style.display = 'block';
  var r = secs;
  function tick() {
    r--;
    if (timer) timer.textContent = 'Puedes reenviar en ' + r + 's';
    if (r <= 0) { clearInterval(_rmTimer); if (btn) btn.style.display = 'block'; if (timer) timer.style.display = 'none'; }
  }
  tick(); _rmTimer = setInterval(tick, 1000);
}

function codeInput(idx) {
  var cur = G('rc' + idx); if (!cur) return;
  cur.value = cur.value.replace(/[^0-9]/g, '');
  if (cur.value && idx < 5) { var nx = G('rc' + (idx + 1)); if (nx) nx.focus(); }
  var all = true;
  [0,1,2,3,4,5].forEach(function(i) { var b = G('rc' + i); if (!b || !b.value) all = false; });
  if (all) setTimeout(rmVerify, 300);
}

function codeKey(e, idx) {
  if (e.key === 'Backspace' && !G('rc' + idx).value && idx > 0) { var p = G('rc' + (idx - 1)); if (p) { p.value = ''; p.focus(); } }
  if (e.key === 'ArrowLeft'  && idx > 0) { var prev = G('rc' + (idx - 1)); if (prev) prev.focus(); }
  if (e.key === 'ArrowRight' && idx < 5) { var next = G('rc' + (idx + 1)); if (next) next.focus(); }
}

/* ══════════════════════════
   MODAL: LOGIN
══════════════════════════ */
function openLoginModal() {
  var em = G('li-email'), ps = G('li-pass');
  if (em) em.value = ''; if (ps) ps.value = '';
  hideErr('li-err');
  closeOv('ov-registro');
  openOv('ov-login');
  setTimeout(function() { var e = G('li-email'); if (e) e.focus(); }, 250);
}

function doLogin() {
  var email = V('li-email').trim().toLowerCase();
  var pass  = V('li-pass');
  hideErr('li-err');
  if (!email || !validEmail(email)) { showErr('li-err', 'Introduce un correo electrónico válido.'); return; }
  if (!pass) { showErr('li-err', 'Introduce tu contraseña.'); return; }
  var key = 'login_' + email;
  if (!checkRateLimit(key)) { showErr('li-err', 'Demasiados intentos fallidos. Espera 5 minutos e inténtalo de nuevo.'); return; }
  var biz = DB.businesses.filter(function(b) { return (b.email||'').toLowerCase() === email && b.pass === pass; })[0];
  if (biz) {
    resetRateLimit(key);
    if (biz.plan === 'expired') { showErr('li-err', 'Tu suscripción ha vencido. Contacta con soporte por WhatsApp.'); return; }
    DB.currentBiz = biz.id; saveDB();
    closeOv('ov-login');
    toast('✅ Bienvenido/a ' + san(biz.owner || biz.name), '#22C55E');
    setTimeout(function() { goBiz(); }, 300);
  } else {
    showErr('li-err', 'Email o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.');
    var p = G('li-pass'); if (p) p.value = '';
  }
}

/* ══════════════════════════
   MODAL: RECUPERAR CONTRASEÑA
══════════════════════════ */
function openForgotModal() {
  var em = G('fp-email'); if (em) em.value = '';
  hideErr('fp-err');
  var suc = G('fp-success'); if (suc) suc.style.display = 'none';
  closeOv('ov-login');
  openOv('ov-forgot');
  setTimeout(function() { var e = G('fp-email'); if (e) e.focus(); }, 250);
}

function doForgot() {
  var email = V('fp-email').trim().toLowerCase();
  hideErr('fp-err');
  if (!email || !validEmail(email)) { showErr('fp-err', 'Introduce un correo electrónico válido.'); return; }
  var exists = DB.businesses.filter(function(b) { return (b.email||'').toLowerCase() === email; })[0];
  if (!exists) { showErr('fp-err', 'No encontramos una cuenta con ese correo. Verifica el email o crea una cuenta nueva.'); return; }
  var suc = G('fp-success'); if (suc) suc.style.display = 'block';
  var btn = G('fp-btn-send'); if (btn) btn.style.display = 'none';
  toast('📧 Instrucciones enviadas a ' + email, '#4A7FD4');
  console.log('%c🔑 Citas Pro — Recuperación contraseña para: ' + email, 'background:#141824;color:#7EB8FF;font-size:14px;padding:8px 14px;border-radius:8px');
}

/* ══════════════════════════
   BIZ PANEL
══════════════════════════ */
function showBizReg() {
  var r = G('biz-reg'), p = G('biz-panel');
  if (r) r.style.display = 'block';
  if (p) p.style.display = 'none';
  initREG(); showRegStep(0);
}

function showBizPanel() {
  var r = G('biz-reg'), p = G('biz-panel');
  if (r) r.style.display = 'none';
  if (p) p.style.display = 'block';
  DB = loadDB();
  CUR = DB.currentBiz ? DB.businesses.filter(function(b) { return b.id === DB.currentBiz; })[0] : null;
  if (CUR) initBizPanel();
}

function bizLogout() { DB.currentBiz = null; saveDB(); CUR = null; showBizReg(); }

function showRegStep(n) {
  var steps = document.querySelectorAll('.reg-step');
  for (var i = 0; i < steps.length; i++) steps[i].classList.remove('on');
  var s = G('rs-' + n); if (s) s.classList.add('on');
  regStep = n; window.scrollTo(0, 0);
}

function bizRegStep(n) {
  if (n > regStep) {
    if (regStep === 1 && !REG.type) { toast('Selecciona el tipo de negocio', '#EF4444'); return; }
    if (regStep === 2) {
      var bn = sanitizeText(V('br-bizname')), em = V('br-email').trim(), ps = V('br-pass');
      if (!bn) { toast('Escribe el nombre del negocio', '#EF4444'); return; }
      if (!validEmail(em)) { toast('Email inválido', '#EF4444'); return; }
      if (ps.length < 6) { toast('Contraseña mínimo 6 caracteres', '#EF4444'); return; }
      if (DB.businesses.filter(function(b) { return (b.email||'').toLowerCase() === em.toLowerCase(); })[0]) { toast('Email ya registrado', '#EF4444'); return; }
      REG.name = bn; REG.owner = sanitizeText(V('br-owner')); REG.email = em.toLowerCase(); REG.pass = ps; REG.phone = sanitizeText(V('br-phone'));
    }
    if (regStep === 3) { REG.addr = sanitizeText(V('br-addr')); REG.city = sanitizeText(V('br-city')); REG.country = sanitizeText(V('br-country')) || 'ES'; }
    if (regStep === 6 && !REG.services.length) { toast('Añade al menos un servicio', '#EF4444'); return; }
    if (n === 7) finalizeBizReg();
  }
  showRegStep(n);
}

function selType(id, type) { document.querySelectorAll('.typbtn').forEach(function(b) { b.classList.remove('sel'); }); var b = G(id); if (b) b.classList.add('sel'); REG.type = type; }
function selSize(id, size) { document.querySelectorAll('.szopt').forEach(function(b) { b.classList.remove('sel'); }); var o = G(id); if (o) o.classList.add('sel'); REG.teamSize = size; }

function updatePassStrength(pass) {
  var s = passStrength(pass);
  var bar = G('pass-strength'), lbl = G('pass-strength-lbl');
  var configs = [{ c:'#EF4444',t:'Muy débil',w:'20%' },{ c:'#EF4444',t:'Débil',w:'40%' },{ c:'#F59E0B',t:'Regular',w:'60%' },{ c:'#22C55E',t:'Buena',w:'80%' },{ c:'#22C55E',t:'Muy segura ✓',w:'100%' }];
  var cfg = configs[Math.min(s, 4)];
  if (bar) { bar.style.background = cfg.c; bar.style.width = pass.length ? cfg.w : '0%'; }
  if (lbl) { lbl.textContent = pass.length ? cfg.t : ''; lbl.style.color = cfg.c; }
}

function updateRmPassStrength(pass) {
  var s = passStrength(pass);
  var bar = G('rm-pass-bar'), lbl = G('rm-pass-lbl');
  var configs = [{ c:'#EF4444',t:'Muy débil',w:'20%' },{ c:'#EF4444',t:'Débil',w:'40%' },{ c:'#F59E0B',t:'Regular',w:'60%' },{ c:'#22C55E',t:'Buena',w:'80%' },{ c:'#22C55E',t:'Muy segura ✓',w:'100%' }];
  var cfg = configs[Math.min(s, 4)];
  if (bar) { bar.style.background = cfg.c; bar.style.width = pass.length ? cfg.w : '0%'; }
  if (lbl) { lbl.textContent = pass.length ? cfg.t : ''; lbl.style.color = cfg.c; }
}

function setupPhotoUpload() {
  function handleImg(inputId, onLoad) {
    var el = G(inputId); if (!el) return;
    el.addEventListener('change', function(e) {
      var f = e.target.files[0];
      if (!f || !validImageType(f)) { toast('Solo JPG/PNG/WebP (máx 5MB)', '#EF4444'); return; }
      var r = new FileReader();
      r.onload = function(ev) { var d = sanitizeImageDataURL(ev.target.result); if (d) onLoad(d); };
      r.readAsDataURL(f);
    });
  }
  function handleImgs(inputId, onLoad) {
    var el = G(inputId); if (!el) return;
    el.addEventListener('change', function(e) {
      Array.from(e.target.files).forEach(function(f) {
        if (!validImageType(f)) return;
        var r = new FileReader();
        r.onload = function(ev) { var d = sanitizeImageDataURL(ev.target.result); if (d) onLoad(d); };
        r.readAsDataURL(f);
      });
    });
  }
  handleImg('logo-input', function(d) { REG.logo = d; var p = G('logo-preview'); if (p) { p.style.backgroundImage = 'url(' + d + ')'; p.style.backgroundSize = 'cover'; p.style.backgroundPosition = 'center'; p.innerHTML = ''; } });
  handleImgs('svc-photo-input', function(d) { if (REG.photos.length >= 12) { toast('Máximo 12 fotos', '#EF4444'); return; } REG.photos.push(d); renderRegPhotos(); });
  handleImgs('gallery-input', function(d) { if (CUR) { if (!CUR.photos) CUR.photos = []; if (CUR.photos.length >= 20) { toast('Máximo 20 fotos', '#EF4444'); return; } CUR.photos.push(d); saveDB(); renderGallery(); } });
  handleImg('bar-photo-input', function(d) { window._barPhoto = d; var p = G('bar-photo-preview'); if (p) p.innerHTML = '<img src="' + d + '" class="photo-preview" alt="Foto"/>'; });
  handleImg('sv-photo-input',  function(d) { window._svcPhoto = d; var p = G('sv-photo-preview');  if (p) p.innerHTML = '<img src="' + d + '" class="photo-preview" alt="Foto"/>'; });
}

function renderRegPhotos() {
  var grid = G('service-photos-reg'); if (!grid) return;
  grid.innerHTML = REG.photos.map(function(p, i) {
    return '<div class="img-thumb"><img src="' + sanitizeImageDataURL(p) + '" alt="Foto ' + (i+1) + '"><button onclick="REG.photos.splice(' + i + ',1);renderRegPhotos();" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button></div>';
  }).join('') + '<div class="img-thumb add-btn" onclick="document.getElementById(\'svc-photo-input\').click()">＋</div>';
}

function renderGallery() {
  if (!CUR) return;
  var grid = G('biz-gallery'); if (!grid) return;
  var photos = CUR.photos || [];
  grid.innerHTML = photos.map(function(p, i) {
    return '<div class="img-thumb"><img src="' + sanitizeImageDataURL(p) + '" alt="Foto ' + (i+1) + '"><button onclick="delGalleryPhoto(' + i + ')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button></div>';
  }).join('');
}

function delGalleryPhoto(idx) {
  if (CUR) { CUR.photos = (CUR.photos || []).filter(function(_, i) { return i !== idx; }); saveDB(); renderGallery(); toast('Foto eliminada', '#475569'); }
}

function openSvcModal(id) {
  editSvc = id; window._svcPhoto = null;
  T('svc-ttl', id ? 'Editar servicio' : 'Añadir servicio');
  var reset = function() { var p = G('sv-photo-preview'); if (p) p.innerHTML = '<div style="font-size:28px;margin-bottom:6px">📷</div><div style="font-size:13px;color:var(--muted)">Añadir foto</div>'; };
  if (id && CUR) {
    var s = CUR.services.filter(function(x) { return x.id === id; })[0];
    if (s) { var n = G('sv-name'), p = G('sv-price'), d = G('sv-dur'), ds = G('sv-desc'); if (n) n.value = s.name; if (p) p.value = s.price; if (d) d.value = s.dur; if (ds) ds.value = s.desc || ''; var pv = G('sv-photo-preview'); if (pv && s.photo) pv.innerHTML = '<img src="' + sanitizeImageDataURL(s.photo) + '" class="photo-preview" alt="Servicio"/>'; else reset(); }
  } else {
    ['sv-name','sv-price','sv-desc'].forEach(function(i2) { var e = G(i2); if (e) e.value = ''; });
    var dv = G('sv-dur'); if (dv) dv.value = '30'; reset();
  }
  openOv('ov-svc');
}

function saveSvc() {
  var name = sanitizeText(V('sv-name')), price = safeNum(V('sv-price'), 0), dur = safeInt(V('sv-dur'), 30), desc = sanitizeText(V('sv-desc'));
  var photo = window._svcPhoto || null;
  if (!name) { toast('Nombre requerido', '#EF4444'); return; }
  if (CUR) {
    if (!CUR.services) CUR.services = [];
    if (editSvc) { var s = CUR.services.filter(function(x) { return x.id === editSvc; })[0]; if (s) { s.name = name; s.price = price; s.dur = dur; s.desc = desc; if (photo) s.photo = photo; } }
    else CUR.services.push({ id: Date.now(), name: name, price: price, dur: dur, desc: desc, photo: photo || '' });
    saveDB(); renderBizServices();
  } else {
    if (editSvc) { var sr = REG.services.filter(function(x) { return x.id === editSvc; })[0]; if (sr) { sr.name = name; sr.price = price; sr.dur = dur; sr.desc = desc; if (photo) sr.photo = photo; } }
    else REG.services.push({ id: Date.now(), name: name, price: price, dur: dur, desc: desc, photo: photo || '' });
    renderRegSvcs();
  }
  editSvc = null; window._svcPhoto = null; closeOv('ov-svc'); toast('✅ Servicio guardado', '#4A7FD4');
}

function renderRegSvcs() {
  H('reg-svc-list', (REG.services || []).map(function(s) {
    var thumb = s.photo ? '<img src="' + sanitizeImageDataURL(s.photo) + '" style="width:42px;height:42px;border-radius:11px;object-fit:cover;flex-shrink:0" alt="Servicio">' : '<div style="width:42px;height:42px;border-radius:11px;background:var(--bblue);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">✂️</div>';
    return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:12px;display:flex;align-items:center;gap:12px;margin-bottom:8px">' + thumb + '<div style="flex:1"><div style="font-weight:700;font-size:14px">' + san(s.name) + '</div><div style="font-size:12px;color:var(--muted);margin-top:2px">' + s.dur + 'min</div></div><span style="font-weight:700;color:var(--blue);font-size:14px">' + money(s.price) + '</span><button data-id="' + sanitizeText(s.id) + '" class="del-rs" style="font-size:15px;cursor:pointer;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:6px;color:var(--red)">🗑</button></div>';
  }).join(''));
  document.querySelectorAll('.del-rs').forEach(function(b) {
    b.addEventListener('click', function() { var id = b.getAttribute('data-id'); REG.services = REG.services.filter(function(s) { return String(s.id) !== id; }); renderRegSvcs(); });
  });
}

function finalizeBizReg() {
  if (DB.businesses.filter(function(b) { return (b.email||'').toLowerCase() === REG.email.toLowerCase(); })[0]) { toast('Email ya registrado', '#EF4444'); showRegStep(2); return; }
  var slug = (REG.name || 'negocio').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20) + '-' + Date.now().toString(36);
  var biz = { id: slug, name: REG.name, owner: REG.owner, email: REG.email, pass: REG.pass, phone: REG.phone, addr: REG.addr, city: REG.city, country: REG.country, type: REG.type, teamSize: REG.teamSize, joinDate: new Date().toISOString().split('T')[0], plan: 'trial', desc: '', logo: REG.logo || '', photos: REG.photos || [], insta: '', horario: DEFAULT_HORARIO.map(function(h) { return Object.assign({}, h); }), barbers: [{ id: 1, name: REG.owner || 'Yo', spec: REG.type || 'Profesional', photo: '' }], services: REG.services, appointments: [] };
  DB.businesses.push(biz); DB.currentBiz = slug; saveDB();
  T('biz-link-display', 'citas-pro.netlify.app/b/' + slug);
  T('neg-badge', DB.businesses.length);
  var waLink = G('wa-share-link'); if (waLink) waLink.href = 'https://wa.me/?text=' + encodeURIComponent('📅 Reserva tu cita en ' + REG.name + ' → citas-pro.netlify.app/b/' + slug);
  checkNotifications();
}

function completeBizReg() { CUR = DB.businesses.filter(function(b) { return b.id === DB.currentBiz; })[0]; if (CUR) showBizPanel(); else showRegStep(0); }
function copyLink() { var link = 'citas-pro.netlify.app/b/' + (CUR ? CUR.id : DB.currentBiz || 'mi-negocio'); try { navigator.clipboard.writeText('https://' + link); } catch(e) {} toast('📋 Link copiado', '#4A7FD4'); }

function initBizPanel() {
  if (!CUR) return;
  var hr = new Date().getHours(), g = hr < 12 ? 'Buenos días' : hr < 18 ? 'Buenas tardes' : 'Buenas noches';
  T('biz-greeting', g + ' ' + (CUR.owner || '').split(' ')[0] + ' 👋');
  T('biz-hdr-nm', CUR.name);
  var planEl = G('biz-hdr-plan');
  if (planEl) { planEl.textContent = CUR.plan === 'active' ? '✅ Plan activo' : CUR.plan === 'trial' ? '🎁 Prueba gratis' : '❌ Suscripción vencida'; planEl.style.color = CUR.plan === 'active' ? 'var(--green)' : CUR.plan === 'trial' ? 'var(--gold)' : 'var(--red)'; }
  var av = G('biz-hdr-av');
  if (av) { if (CUR.logo) { av.innerHTML = '<img src="' + sanitizeImageDataURL(CUR.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">'; } else { av.textContent = (CUR.name || '?').charAt(0).toUpperCase(); } }
  var today = new Date().toISOString().split('T')[0];
  var appts = CUR.appointments || [];
  var todayA = appts.filter(function(a) { return a.date === today && a.status !== 'cancelled'; });
  var thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  var thisMonthStart = new Date(); thisMonthStart.setDate(1);
  var weekA  = appts.filter(function(a) { return a.date >= thisWeekStart.toISOString().split('T')[0] && a.status !== 'cancelled'; });
  var monthA = appts.filter(function(a) { return a.date >= thisMonthStart.toISOString().split('T')[0] && a.status !== 'cancelled'; });
  T('bh-today', todayA.length);
  T('bh-rev',   money(todayA.reduce(function(s, a) { return s + (a.price || 0); }, 0)));
  T('bh-week',  weekA.length);
  T('bh-month', money(monthA.reduce(function(s, a) { return s + (a.price || 0); }, 0)));
  var link = 'citas-pro.netlify.app/b/' + CUR.id;
  T('biz-link-show', link);
  var wah = G('wa-share-home'); if (wah) wah.href = 'https://wa.me/?text=' + encodeURIComponent('📅 Reserva tu cita en ' + CUR.name + ' → https://' + link);
  renderTodayAppts(todayA); renderBizBarbers(); renderBizServices(); renderGallery(); renderBizFinances(); renderHorario(); renderCalendar(); initAgenda();
  var pf = G('pf-nm'); if (pf) pf.value = CUR.name || '';
  var pa = G('pf-addr'); if (pa) pa.value = CUR.addr || '';
  var pp = G('pf-phone'); if (pp) pp.value = CUR.phone || '';
  var pi = G('pf-insta'); if (pi) pi.value = CUR.insta || '';
  var pd = G('pf-desc'); if (pd) pd.value = CUR.desc || '';
  var ps = G('pf-plan-status'); if (ps) ps.textContent = CUR.plan === 'active' ? 'Plan activo · Próxima factura el día 1' : CUR.plan === 'trial' ? 'En período de prueba gratuito' : 'Suscripción vencida — contacta soporte';
  var pb = G('pf-plan-badge'); if (pb) pb.innerHTML = planTag(CUR.plan);
  bizTab('home');
}

function renderTodayAppts(appts) {
  if (!appts && CUR) { var today = new Date().toISOString().split('T')[0]; appts = (CUR.appointments || []).filter(function(a) { return a.date === today; }); }
  H('bh-appts', appts.length ? appts.map(function(a) { return apptRowH(a); }).join('') : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:28px;margin-bottom:8px">📅</div><div style="font-size:13px">Sin citas para hoy</div></div>');
}

function apptRowH(a) {
  var sc = { confirmed:{ c:'var(--blue)',bg:'rgba(74,127,212,.1)',l:'✓ Conf.' }, pending:{ c:'var(--gold)',bg:'rgba(245,158,11,.1)',l:'⏳ Pend.' }, completed:{ c:'var(--green)',bg:'rgba(34,197,94,.1)',l:'✓ Hecho' }, cancelled:{ c:'var(--red)',bg:'rgba(239,68,68,.1)',l:'✗ Canc.' } }[a.status] || { c:'var(--blue)',bg:'rgba(74,127,212,.1)',l:'✓ Conf.' };
  var initials = san((a.client || '?').split(' ').map(function(n) { return n[0] || ''; }).slice(0, 2).join('').toUpperCase());
  return '<div class="appt-row" onclick="openApptDetail(\'' + sanitizeText(a.id) + '\')"><div class="appt-avatar">' + initials + '</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + san(a.client) + '</div><div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(a.svc) + ' · ' + san(a.barber) + '</div>' + (a.notes ? '<div style="font-size:11px;color:var(--muted);margin-top:2px;font-style:italic">' + san(a.notes) + '</div>' : '') + '</div><div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:15px;color:var(--blue)">' + money(a.price) + '</div><div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(a.time) + '</div><div style="margin-top:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:' + sc.bg + ';color:' + sc.c + '">' + sc.l + '</div></div></div>';
}

function openApptDetail(id) {
  if (!CUR) return;
  var a = null; CUR.appointments.forEach(function(ap) { if (String(ap.id) === String(id)) a = ap; }); if (!a) return;
  H('appt-detail-content',
    '<div style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--r);padding:16px;margin-bottom:14px">'
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'
    + '<div class="appt-avatar" style="width:52px;height:52px;font-size:20px">' + san((a.client || '?').split(' ').map(function(n) { return n[0] || ''; }).slice(0, 2).join('').toUpperCase()) + '</div>'
    + '<div><div style="font-size:18px;font-weight:900">' + san(a.client) + '</div>'
    + (a.phone ? '<div style="font-size:14px;color:var(--blue3);margin-top:3px;font-weight:600">📱 ' + san(a.phone) + '</div>' : '')
    + (a.email ? '<div style="font-size:13px;color:var(--t2);margin-top:2px">📧 ' + san(a.email) + '</div>' : '')
    + '</div></div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    + '<div class="sbox"><div class="slbl">📅 Fecha</div><div style="font-size:14px;font-weight:700">' + san(a.date) + '</div></div>'
    + '<div class="sbox"><div class="slbl">⏰ Hora</div><div style="font-size:18px;font-weight:900;color:var(--blue)">' + san(a.time) + '</div></div>'
    + '<div class="sbox"><div class="slbl">✂️ Servicio</div><div style="font-size:13px;font-weight:700">' + san(a.svc) + '</div></div>'
    + '<div class="sbox"><div class="slbl">💰 Total</div><div style="font-size:18px;font-weight:900;color:var(--green)">' + money(a.price) + '</div></div>'
    + '</div>'
  );
  var waBtn = G('appt-wa-btn'); if (waBtn && a.phone) waBtn.href = 'https://wa.me/' + a.phone.replace(/\D/g, '') + '?text=' + encodeURIComponent('Hola ' + a.client + ', te recordamos tu cita en ' + CUR.name + ' el ' + a.date + ' a las ' + a.time + '. ✂️');
  var cb = G('appt-complete-btn'); if (cb) cb.onclick = function() { updateApptStatus(id, 'completed'); };
  var ca = G('appt-cancel-btn');   if (ca) ca.onclick = function() { updateApptStatus(id, 'cancelled'); };
  openOv('ov-appt-detail');
}

function updateApptStatus(id, status) {
  if (!CUR) return;
  CUR.appointments.forEach(function(a) { if (String(a.id) === String(id)) a.status = status; });
  saveDB(); closeOv('ov-appt-detail'); renderTodayAppts(); initAgenda(); renderBizFinances();
  toast(status === 'completed' ? '✅ Cita completada' : '✗ Cita cancelada', status === 'completed' ? '#22C55E' : '#EF4444');
}

function bizTab(tab) {
  var tabs = ['home','agenda','equipo','servicios','galeria','finanzas','horario','perfil'];
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    var pa = G('bp-' + t), bt = G('bn-' + t);
    if (pa) pa.classList[t === tab ? 'add' : 'remove']('on');
    if (bt) bt.classList[t === tab ? 'add' : 'remove']('on');
  }
  if (tab === 'agenda') { DB = loadDB(); CUR = DB.currentBiz ? DB.businesses.filter(function(b) { return b.id === DB.currentBiz; })[0] : CUR; initAgenda(); }
  if (tab === 'home')   { DB = loadDB(); CUR = DB.currentBiz ? DB.businesses.filter(function(b) { return b.id === DB.currentBiz; })[0] : CUR; renderTodayAppts(); }
}

function renderBizBarbers() {
  if (!CUR) return;
  H('biz-barbers-list', (CUR.barbers || []).length
    ? (CUR.barbers || []).map(function(b) {
        var av = b.photo ? '<img src="' + sanitizeImageDataURL(b.photo) + '" style="width:100%;height:100%;object-fit:cover" alt="Foto">' : san((b.name || '?').charAt(0).toUpperCase());
        return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px"><div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0">' + av + '</div><div style="flex:1"><div style="font-weight:700;font-size:15px">' + san(b.name) + '</div><div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(b.spec || '') + '</div>' + (b.phone ? '<div style="font-size:12px;color:var(--muted);margin-top:2px">📱 ' + san(b.phone) + '</div>' : '') + '</div><div style="display:flex;gap:6px"><button onclick="openBarberModal(' + b.id + ')" style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--rpill);padding:7px 12px;color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font)">Editar</button><button onclick="delBarber(' + b.id + ')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);border-radius:var(--rpill);padding:7px 10px;color:var(--red);font-size:13px;cursor:pointer">🗑</button></div></div>';
      }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:28px;margin-bottom:8px">👥</div><div>No hay profesionales aún</div></div>');
}

function renderBizServices() {
  if (!CUR) return;
  H('biz-svcs-list', (CUR.services || []).length
    ? (CUR.services || []).map(function(s) {
        var thumb = s.photo ? '<img src="' + sanitizeImageDataURL(s.photo) + '" style="width:46px;height:46px;border-radius:11px;object-fit:cover;flex-shrink:0" alt="Servicio">' : '<div style="width:46px;height:46px;border-radius:11px;background:var(--bblue);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">✂️</div>';
        return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px">' + thumb + '<div style="flex:1"><div style="font-weight:700;font-size:14px">' + san(s.name) + '</div><div style="font-size:12px;color:var(--muted);margin-top:2px">' + s.dur + 'min' + (s.desc ? ' · ' + san(s.desc) : '') + '</div></div><div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:16px;color:var(--blue)">' + money(s.price) + '</div><div style="display:flex;gap:5px;margin-top:6px"><button onclick="openSvcModal(' + s.id + ')" style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--rpill);padding:5px 10px;color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)">Editar</button><button onclick="delService(' + s.id + ')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);border-radius:var(--rpill);padding:5px 8px;color:var(--red);font-size:12px;cursor:pointer">🗑</button></div></div></div>';
      }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:28px;margin-bottom:8px">✂️</div><div>No hay servicios aún</div></div>');
}

function delService(id) { if (!CUR) return; CUR.services = CUR.services.filter(function(s) { return s.id !== id; }); saveDB(); renderBizServices(); toast('Servicio eliminado', '#475569'); }
function delBarber(id)  { if (!CUR) return; CUR.barbers  = CUR.barbers.filter(function(b)  { return b.id !== id; }); saveDB(); renderBizBarbers();  toast('Profesional eliminado', '#475569'); }

function renderBizFinances() {
  if (!CUR) return;
  var now = new Date(), thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var appts = CUR.appointments || [];
  var monthAppts = appts.filter(function(a) { return a.date && a.date.slice(0, 7) === thisMonth && a.status !== 'cancelled'; });
  var monthRev   = monthAppts.reduce(function(s, a) { return s + (a.price || 0); }, 0);
  var clients = []; appts.forEach(function(a) { if (a.client && clients.indexOf(a.client) < 0) clients.push(a.client); });
  var svcCount = {}; appts.filter(function(a) { return a.status !== 'cancelled'; }).forEach(function(a) { if (a.svc) svcCount[a.svc] = (svcCount[a.svc] || 0) + 1; });
  var topSvc = '—', topCount = 0; Object.keys(svcCount).forEach(function(k) { if (svcCount[k] > topCount) { topSvc = k; topCount = svcCount[k]; } });
  var paid   = appts.filter(function(a) { return a.status !== 'cancelled' && a.price > 0; });
  var ticket = paid.length ? paid.reduce(function(s, a) { return s + (a.price || 0); }, 0) / paid.length : 0;
  T('fin-ing', money(monthRev)); T('fin-clients', clients.length); T('fin-top-svc', topSvc.length > 10 ? topSvc.slice(0, 10) + '…' : topSvc); T('fin-ticket', money(ticket));
  var months = []; for (var i = 5; i >= 0; i--) { var d = new Date(now); d.setMonth(d.getMonth() - i); months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
  var vals = months.map(function(m) { return appts.filter(function(a) { return a.date && a.date.slice(0, 7) === m && a.status !== 'cancelled'; }).reduce(function(s, a) { return s + (a.price || 0); }, 0); });
  var max = Math.max.apply(null, vals.concat([10]));
  var ch = G('fin-chart'); if (ch) ch.innerHTML = vals.map(function(v, i) { return '<div class="bar' + (i === vals.length - 1 ? ' hi' : '') + '" style="height:' + Math.max(4, Math.round(v / max * 100)) + '%" title="' + money(v) + '"></div>'; }).join('');
  var ml = G('fin-months'); if (ml) ml.innerHTML = months.map(function(m, i) { var parts = m.split('-'); return '<div style="flex:1;text-align:center;font-size:9px;color:' + (i === months.length - 1 ? 'var(--blue)' : 'var(--muted)') + ';font-weight:700">' + MONTHS_SHORT[parseInt(parts[1]) - 1] + '</div>'; }).join('');
  H('biz-appts-fin', paid.slice().sort(function(a, b) { return b.date.localeCompare(a.date); }).slice(0, 20).map(function(a) { return apptRowH(a); }).join(''));
}

function renderCalendar() {
  var now = calendarDate, year = now.getFullYear(), month = now.getMonth();
  T('cal-title', MONTHS[month] + ' ' + year);
  var firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = new Date().toISOString().split('T')[0];
  var appts = CUR ? (CUR.appointments || []) : [];
  var apptDates = {}; appts.forEach(function(a) { if (a.date && a.status !== 'cancelled') apptDates[a.date] = true; });
  var html = '';
  for (var i = 0; i < firstDay; i++) html += '<div class="cal-day other-month"></div>';
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var cls = 'cal-day';
    if (dateStr === today) cls += ' today';
    if (dateStr === selectedCalDay && dateStr !== today) cls += ' sel';
    if (apptDates[dateStr]) cls += ' has-appts';
    html += '<div class="' + cls + '" onclick="selectCalDay(\'' + dateStr + '\')">' + d + '</div>';
  }
  H('cal-grid', html);
}

function selectCalDay(dateStr) { selectedCalDay = dateStr; renderCalendar(); initAgenda(); }
function prevMonth() { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); }

function initAgenda() {
  if (!CUR) return;
  var dayAppts = (CUR.appointments || []).filter(function(a) { return a.date === selectedCalDay; }).sort(function(a, b) { return (a.time || '').localeCompare(b.time || ''); });
  var parts = selectedCalDay.split('-'), days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var d = new Date(selectedCalDay + 'T12:00');
  T('agenda-day-label', days[d.getDay()] + ' ' + parseInt(parts[2]) + ' de ' + MONTHS[parseInt(parts[1]) - 1] + ' de ' + parts[0]);
  H('biz-agenda-list', dayAppts.length ? dayAppts.map(function(a) { return apptRowH(a); }).join('') : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:28px;margin-bottom:8px">📅</div><div style="font-size:13px">Sin citas para este día</div></div>');
}

function renderHorario() {
  if (!CUR) return;
  var horario = CUR.horario || DEFAULT_HORARIO.map(function(h) { return Object.assign({}, h); });
  H('horario-days', horario.map(function(day, i) {
    return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (day.open ? '12px' : '0') + '"><div style="font-weight:700;font-size:14px">' + san(day.day) + '</div><div class="toggle ' + (day.open ? 'on' : '') + '" data-hday="' + i + '" onclick="toggleHorarioDay(' + i + ')"></div></div>' + (day.open ? '<div style="display:flex;gap:10px;align-items:center"><div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px">APERTURA</div><input class="inp" type="time" value="' + san(day.from) + '" data-hfrom="' + i + '" style="padding:9px 12px"/></div><div style="color:var(--muted);font-size:16px;padding-top:18px">—</div><div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px">CIERRE</div><input class="inp" type="time" value="' + san(day.to) + '" data-hto="' + i + '" style="padding:9px 12px"/></div></div>' : '') + '</div>';
  }).join(''));
  document.querySelectorAll('[data-hfrom]').forEach(function(el) { el.addEventListener('change', function() { var i = parseInt(el.getAttribute('data-hfrom')); if (CUR.horario && CUR.horario[i]) CUR.horario[i].from = el.value; }); });
  document.querySelectorAll('[data-hto]').forEach(function(el)   { el.addEventListener('change', function() { var i = parseInt(el.getAttribute('data-hto'));   if (CUR.horario && CUR.horario[i]) CUR.horario[i].to   = el.value; }); });
}

function toggleHorarioDay(i) {
  if (!CUR) return;
  if (!CUR.horario) CUR.horario = DEFAULT_HORARIO.map(function(h) { return Object.assign({}, h); });
  CUR.horario[i].open = !CUR.horario[i].open;
  renderHorario();
}

function openBarberModal(id) {
  editBar = id; window._barPhoto = null;
  T('bar-ttl', id ? 'Editar profesional' : 'Añadir profesional');
  var reset = function() { var p = G('bar-photo-preview'); if (p) p.innerHTML = '<div style="font-size:28px;margin-bottom:6px">👤</div><div style="font-size:13px;color:var(--muted)">Añadir foto</div>'; };
  if (id && CUR) {
    var b = CUR.barbers.filter(function(x) { return x.id === id; })[0];
    if (b) { var n = G('bar-name'), sp = G('bar-spec'), ph = G('bar-phone'); if (n) n.value = b.name || ''; if (sp) sp.value = b.spec || ''; if (ph) ph.value = b.phone || ''; var pv = G('bar-photo-preview'); if (pv && b.photo) pv.innerHTML = '<img src="' + sanitizeImageDataURL(b.photo) + '" class="photo-preview" alt="Foto"/>'; else reset(); }
  } else {
    ['bar-name','bar-spec','bar-phone'].forEach(function(i2) { var e = G(i2); if (e) e.value = ''; }); reset();
  }
  openOv('ov-barber');
}

function saveBarber() {
  var name = sanitizeText(V('bar-name')), spec = sanitizeText(V('bar-spec')), phone = sanitizeText(V('bar-phone')), photo = window._barPhoto || null;
  if (!name) { toast('Nombre requerido', '#EF4444'); return; }
  if (!CUR) return;
  if (!CUR.barbers) CUR.barbers = [];
  if (editBar) { var b = CUR.barbers.filter(function(x) { return x.id === editBar; })[0]; if (b) { b.name = name; b.spec = spec; b.phone = phone; if (photo) b.photo = photo; } }
  else CUR.barbers.push({ id: Date.now(), name: name, spec: spec, phone: phone, photo: photo || '' });
  editBar = null; window._barPhoto = null; saveDB(); renderBizBarbers(); closeOv('ov-barber'); toast('✅ Profesional guardado', '#4A7FD4');
}

function openApptModal() {
  if (!CUR) return;
  var today = new Date().toISOString().split('T')[0];
  var nowTime = new Date().toTimeString().slice(0, 5);
  var dateEl = G('ap-date'), timeEl = G('ap-time'), nameEl = G('ap-name'), phoneEl = G('ap-phone'), notesEl = G('ap-notes');
  if (dateEl) dateEl.value = today; if (timeEl) timeEl.value = nowTime; if (nameEl) nameEl.value = ''; if (phoneEl) phoneEl.value = ''; if (notesEl) notesEl.value = '';
  var svcSel = G('ap-svc'); if (svcSel) svcSel.innerHTML = (CUR.services || []).map(function(s) { return '<option value="' + san(s.name) + ',' + s.price + '">' + san(s.name) + ' (' + money(s.price) + ')</option>'; }).join('');
  var barSel = G('ap-bar'); if (barSel) barSel.innerHTML = '<option value="Cualquiera">Cualquiera</option>' + (CUR.barbers || []).map(function(b) { return '<option value="' + san(b.name) + '">' + san(b.name) + '</option>'; }).join('');
  openOv('ov-appt');
}

function saveAppt() {
  var name = sanitizeText(V('ap-name')), phone = sanitizeText(V('ap-phone'));
  var date = V('ap-date'), time = V('ap-time'), svcRaw = V('ap-svc'), barber = sanitizeText(V('ap-bar')), status = V('ap-status') || 'confirmed', notes = sanitizeText(V('ap-notes'));
  if (!name) { toast('Nombre del cliente requerido', '#EF4444'); return; }
  if (!date || !time) { toast('Fecha y hora requeridas', '#EF4444'); return; }
  if (!svcRaw) { toast('Selecciona un servicio', '#EF4444'); return; }
  var parts = svcRaw.split(','); if (!CUR) return; if (!CUR.appointments) CUR.appointments = [];
  CUR.appointments.push({ id: Date.now(), client: name, phone: phone, email: '', svc: parts[0], barber: barber, date: date, time: time, price: safeNum(parts[1], 0), status: status, notes: notes });
  saveDB(); closeOv('ov-appt'); renderTodayAppts(); initAgenda(); renderBizFinances(); initBizPanel(); toast('✅ Cita guardada', '#22C55E');
}

function saveBizProfile() {
  if (!CUR) return;
  var nm = sanitizeText(V('pf-nm')), addr = sanitizeText(V('pf-addr')), phone = sanitizeText(V('pf-phone')), insta = sanitizeText(V('pf-insta')), desc = sanitizeText(V('pf-desc'));
  if (!nm) { toast('El nombre no puede estar vacío', '#EF4444'); return; }
  CUR.name = nm; CUR.addr = addr; CUR.phone = phone; CUR.insta = insta; CUR.desc = desc.slice(0, 300);
  saveDB(); initBizPanel(); toast('✅ Perfil guardado', '#4A7FD4');
}

function toggleEye(inputId, btnId) {
  var inp = G(inputId), btn = G(btnId); if (!inp || !btn) return;
  btn.addEventListener('click', function() {
    var isPass = inp.type === 'password';
    inp.type = isPass ? 'text' : 'password';
    btn.textContent = isPass ? '🙈' : '👁';
    inp.focus();
  });
}