'use strict';
//biz.js

function safeImg(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (typeof sanitizeImageDataURL !== 'undefined') return sanitizeImageDataURL(url);
  return url;
}

/* ══════════════════════════
   HELPERS DE CÁLCULO FINANCIERO (DUEÑO)
   Solo operan sobre los datos de CUR (barbería completa)
══════════════════════════ */
function _getAllAppts() {
  if (!CUR) return [];
  const all = [];
  (CUR.workers || []).forEach(function (w) { (w.appointments || []).forEach(function (a) { all.push(a); }); });
  (CUR.appointments || []).forEach(function (a) { all.push(a); });
  return all;
}

function _getWeekStr(dateStr) {
  const d = new Date(dateStr + 'T12:00');
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // lunes=0
  const monday = new Date(d); monday.setDate(d.getDate() - day);
  return monday.getFullYear() + '-' + String(monday.getMonth() + 1).padStart(2, '0') + '-' + String(monday.getDate()).padStart(2, '0');
}

/* ══════════════════════════
   MODAL REGISTRO
══════════════════════════ */
let _rmCode = null, _rmData = {}, _rmTimer = null;

function openRegModal() {
  ['rm-email', 'rm-phone', 'rm-pass', 'rm-pass2'].forEach(function (id) { const e = G(id); if (e) e.value = ''; });
  const cb = G('rm-terms'); if (cb) cb.checked = false;
  hideErr('rm-err1'); hideErr('rm-err2');
  const s1 = G('rm-step1'), s2 = G('rm-step2');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
  const bar = G('rm-pass-bar'), lbl = G('rm-pass-lbl');
  if (bar) { bar.style.width = '0'; bar.style.background = 'rgba(74,127,212,.1)'; }
  if (lbl) lbl.textContent = '';
  [0, 1, 2, 3, 4, 5].forEach(function (i) { const b = G('rc' + i); if (b) b.value = ''; });
  _rmCode = null; _rmData = {};
  if (_rmTimer) clearInterval(_rmTimer);
  openOv('ov-registro');
  setTimeout(function () { const e = G('rm-email'); if (e) e.focus(); }, 250);
}

function rmGoStep2() {
  const email = V('rm-email').trim().toLowerCase();
  const phone = sanitizeText(V('rm-phone').trim());
  const pass = V('rm-pass');
  const pass2 = V('rm-pass2');
  const terms = G('rm-terms');
  hideErr('rm-err1');
  if (!email || !validEmail(email)) { showErr('rm-err1', 'Introduce un correo electrónico válido.'); return; }
  if (!phone || !validPhone(phone)) { showErr('rm-err1', 'Introduce un teléfono válido (mínimo 7 dígitos).'); return; }
  
  // Validar contraseña solo si NO es registro por Google
  if (!window.isGoogleReg) {
    if (!pass || pass.length < 6) { showErr('rm-err1', 'La contraseña debe tener al menos 6 caracteres.'); return; }
    if (pass !== pass2) { showErr('rm-err1', 'Las contraseñas no coinciden. Verifícalas.'); return; }
  }

  if (!terms || !terms.checked) { showErr('rm-err1', 'Debes aceptar los Términos y Condiciones para continuar.'); return; }
  if (DB.businesses.filter(function (b) { return (b.email || '').toLowerCase() === email; })[0]) { showErr('rm-err1', 'Este correo ya tiene una cuenta registrada. Inicia sesión.'); return; }
  
  let emailEnWorker = false;
  DB.businesses.forEach(function (b) {
    (b.workers || []).forEach(function (w) {
      if ((w.email || '').toLowerCase() === email) emailEnWorker = true;
    });
  });
  if (emailEnWorker) { showErr('rm-err1', 'Este correo ya está registrado como trabajador. Usa otro correo.'); return; }
  
  const refCode = V('rm-referral') ? V('rm-referral').trim().toUpperCase() : null;
  
  // Si es Google, bypass correo de OTP
  if (window.isGoogleReg) {
    const randomPass = 'G' + Math.floor(1000000000 + Math.random() * 9000000000) + 'xyz'; // Contraseña segura aleatoria
    _rmData = { email: email, phone: phone, pass: randomPass, referred_by_code: refCode };
    
    closeOv('ov-registro');
    toast('Autenticado con Google', '#22C55E');
    setTimeout(function () {
      goBiz();
      setTimeout(function () {
        bizRegStep(2);
        const em = G('br-email'); if (em) em.value = _rmData.email || '';
        const ph = G('br-phone'); if (ph) ph.value = _rmData.phone || '';
        const pf = G('br-pass-field'); if (pf) pf.style.display = 'none';
        const ps = G('br-pass'); if (ps) { ps.value = _rmData.pass || ''; updatePassStrength(_rmData.pass || ''); }
      }, 300);
    }, 100);
    return;
  }

  _rmData = { email: email, phone: phone, pass: pass, referred_by_code: refCode };
  _rmCode = String(Math.floor(100000 + Math.random() * 900000));
  fetch('/api/send-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'verification', to: email, data: { code: _rmCode } })
  }).catch(function (e) { console.error('Error enviando email:', e); });
  toast('Código enviado a ' + email, '#4A7FD4');
  const conf = G('rm-email-confirm');
  if (conf) conf.innerHTML = 'Enviamos un código de 6 dígitos a <strong style="color:var(--text)">' + san(email) + '</strong>.<br><span style="font-size:12px;color:var(--muted)">Revisa también la carpeta de spam.</span>';
  const s1 = G('rm-step1'), s2 = G('rm-step2');
  if (s1) s1.style.display = 'none';
  if (s2) s2.style.display = 'block';
  [0, 1, 2, 3, 4, 5].forEach(function (i) { const b = G('rc' + i); if (b) b.value = ''; });
  hideErr('rm-err2');
  startResendTimer(60);
  setTimeout(function () { const b = G('rc0'); if (b) b.focus(); }, 200);
}

function rmVerify() {
  let code = '';
  [0, 1, 2, 3, 4, 5].forEach(function (i) { const b = G('rc' + i); code += (b ? b.value : ''); });
  hideErr('rm-err2');
  if (code.length < 6) { showErr('rm-err2', 'Introduce los 6 dígitos del código enviado a tu correo.'); return; }
  if (code !== _rmCode) {
    showErr('rm-err2', 'Código incorrecto. Comprueba tu email e inténtalo de nuevo.');
    const row = G('rm-code-row');
    if (row) { row.style.animation = 'shake .4s ease'; setTimeout(function () { row.style.animation = ''; }, 400); }
    [0, 1, 2, 3, 4, 5].forEach(function (i) { const b = G('rc' + i); if (b) { b.style.borderColor = 'var(--red)'; setTimeout(function () { b.style.borderColor = ''; }, 1500); } });
    return;
  }
  if (_rmTimer) clearInterval(_rmTimer);
  closeOv('ov-registro');
  toast('Email verificado correctamente', '#22C55E');
  setTimeout(function () {
    goBiz();
    setTimeout(function () {
      bizRegStep(2);
      const em = G('br-email'); if (em) em.value = _rmData.email || '';
      const ph = G('br-phone'); if (ph) ph.value = _rmData.phone || '';
      const ps = G('br-pass'); if (ps) { ps.value = _rmData.pass || ''; updatePassStrength(_rmData.pass || ''); }
    }, 150);
  }, 300);
}

function rmResend() {
  if (!_rmData.email) return;
  _rmCode = String(Math.floor(100000 + Math.random() * 900000));
  fetch('/api/send-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'verification', to: _rmData.email, data: { code: _rmCode } })
  }).catch(function (e) { console.error(e); });
  toast('Nuevo código enviado a ' + _rmData.email, '#4A7FD4');
  [0, 1, 2, 3, 4, 5].forEach(function (i) { const b = G('rc' + i); if (b) b.value = ''; });
  hideErr('rm-err2');
  startResendTimer(60);
  setTimeout(function () { const b = G('rc0'); if (b) b.focus(); }, 100);
}

function startResendTimer(secs) {
  if (_rmTimer) clearInterval(_rmTimer);
  const btn = G('rm-btn-resend'), timer = G('rm-resend-timer');
  if (btn) btn.style.display = 'none';
  if (timer) timer.style.display = 'block';
  let r = secs;
  function tick() {
    r--;
    if (timer) timer.textContent = 'Puedes reenviar en ' + r + 's';
    if (r <= 0) { clearInterval(_rmTimer); if (btn) btn.style.display = 'block'; if (timer) timer.style.display = 'none'; }
  }
  tick(); _rmTimer = setInterval(tick, 1000);
}

function codeInput(idx) {
  const cur = G('rc' + idx); if (!cur) return;
  cur.value = cur.value.replace(/[^0-9]/g, '');
  if (cur.value && idx < 5) { const nx = G('rc' + (idx + 1)); if (nx) nx.focus(); }
  let all = true;
  [0, 1, 2, 3, 4, 5].forEach(function (i) { const b = G('rc' + i); if (!b || !b.value) all = false; });
  if (all) setTimeout(rmVerify, 300);
}

function codeKey(e, idx) {
  if (e.key === 'Backspace' && !G('rc' + idx).value && idx > 0) { const p = G('rc' + (idx - 1)); if (p) { p.value = ''; p.focus(); } }
  if (e.key === 'ArrowLeft' && idx > 0) { const prev = G('rc' + (idx - 1)); if (prev) prev.focus(); }
  if (e.key === 'ArrowRight' && idx < 5) { const next = G('rc' + (idx + 1)); if (next) next.focus(); }
}

/* ══════════════════════════
   BIZ PANEL — REGISTRO
══════════════════════════ */
function showBizReg() {
  const r = G('biz-reg'), p = G('biz-panel');
  if (r) r.style.display = 'block';
  if (p) p.style.display = 'none';
  initREG(); showRegStep(0);
}

function showBizPanel() {
  const r = G('biz-reg'), p = G('biz-panel');
  if (r) r.style.display = 'none';
  if (p) p.style.display = 'block';
  DB = loadDB();
  CUR = DB.currentBiz ? DB.businesses.filter(function (b) { return b.id === DB.currentBiz; })[0] : null;

  if (CUR && typeof isBizExpired === 'function' && isBizExpired(CUR)) {
      if (typeof showPaywall === 'function') {
          showPaywall(CUR.name || CUR.owner);
      }
  }
  if (CUR) initBizPanel();
}

function showRegStep(n) {
  const steps = document.querySelectorAll('.reg-step');
  for (let i = 0; i < steps.length; i++) steps[i].classList.remove('on');
  const s = G('rs-' + n); if (s) s.classList.add('on');
  regStep = n; window.scrollTo(0, 0);
}

function bizRegStep(targetStep) {
  // --- Validaciones al avanzar ---
  if (targetStep > regStep) {
    if (window.isUploadingPhoto) {
      toast('Espera a que termine de subir la foto ⏳', '#F59E0B');
      return;
    }
    if (regStep === 1 && !REG.type) {
      toast('Selecciona el tipo de negocio', '#EF4444'); return;
    }
    if (regStep === 2) {
      const bn = sanitizeText(V('br-bizname')), on = sanitizeText(V('br-owner')), em = V('br-email').trim(), ps = V('br-pass');
      if (!bn) { toast('Escribe el nombre de tu negocio', '#EF4444'); return; }
      if (!on) { toast('Escribe tu nombre', '#EF4444'); return; }
      if (!validEmail(em)) { toast('Email inválido', '#EF4444'); return; }
      if (ps.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', '#EF4444'); return; }
      
      // Validar si el email ya existe
      if (DB.businesses.some(b => (b.email || '').toLowerCase() === em.toLowerCase())) {
        toast('Este correo ya tiene una cuenta registrada. Inicia sesión.', '#EF4444'); return;
      }
      if (DB.businesses.some(b => (b.workers || []).some(w => (w.email || '').toLowerCase() === em.toLowerCase()))) {
        toast('Este correo ya está registrado como trabajador. Usa otro.', '#EF4444'); return;
      }
      
      REG.name = bn; REG.owner = on; REG.email = em.toLowerCase(); REG.pass = ps;
      REG.phone = sanitizeText(V('br-phone')) || _rmData.phone;
      REG.referred_by_code = _rmData.referred_by_code || null;
    }
    if (regStep === 3) {
      const country = V('br-country');
      if (!country) { toast('Selecciona el país de tu negocio', '#EF4444'); return; }
      REG.addr = sanitizeText(V('br-addr')); 
      REG.city = sanitizeText(V('br-city')); 
      REG.country = country;
    }
    // Al pasar del paso de fotos (4) al final (5), se finaliza el registro.
    if (regStep === 4 && targetStep === 5) {
      finalizeBizReg();
    }
  }

  // --- Mostrar el paso correspondiente ---
  showRegStep(targetStep);
}

function selType(id, type) { document.querySelectorAll('.typbtn').forEach(function (b) { b.classList.remove('sel'); }); const b = G(id); if (b) b.classList.add('sel'); REG.type = type; }
function selSize(id, size) { document.querySelectorAll('.szopt').forEach(function (b) { b.classList.remove('sel'); }); const o = G(id); if (o) o.classList.add('sel'); REG.teamSize = size; }

function updatePassStrength(pass) {
  const s = passStrength(pass);
  const bar = G('pass-strength'), lbl = G('pass-strength-lbl');
  const configs = [{ c: '#EF4444', t: 'Muy débil', w: '20%' }, { c: '#EF4444', t: 'Débil', w: '40%' }, { c: '#F59E0B', t: 'Regular', w: '60%' }, { c: '#22C55E', t: 'Buena', w: '80%' }, { c: '#22C55E', t: 'Muy segura', w: '100%' }];
  const cfg = configs[Math.min(s, 4)];
  if (bar) { bar.style.background = cfg.c; bar.style.width = pass.length ? cfg.w : '0%'; }
  if (lbl) { lbl.textContent = pass.length ? cfg.t : ''; lbl.style.color = cfg.c; }
}

function updateRmPassStrength(pass) {
  const s = passStrength(pass);
  const bar = G('rm-pass-bar'), lbl = G('rm-pass-lbl');
  const configs = [{ c: '#EF4444', t: 'Muy débil', w: '20%' }, { c: '#EF4444', t: 'Débil', w: '40%' }, { c: '#F59E0B', t: 'Regular', w: '60%' }, { c: '#22C55E', t: 'Buena', w: '80%' }, { c: '#22C55E', t: 'Muy segura', w: '100%' }];
  const cfg = configs[Math.min(s, 4)];
  if (bar) { bar.style.background = cfg.c; bar.style.width = pass.length ? cfg.w : '0%'; }
  if (lbl) { lbl.textContent = pass.length ? cfg.t : ''; lbl.style.color = cfg.c; }
}

/* ══════════════════════════
   IMGBB
══════════════════════════ */
function showGlobalLoader() {
  let loader = document.getElementById('global-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.innerHTML = '<div class="loader-spinner"></div><div id="global-loader-text">Procesando imagen...</div>';
    document.body.appendChild(loader);
  }
  loader.classList.add('on');
}

function hideGlobalLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.remove('on');
}

async function uploadToImgBB(file) {
  if (!file) return null;
  const formData = new FormData();
  formData.append('image', file);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(function () { controller.abort(); }, 12000);
    const res = await fetch('https://api.imgbb.com/1/upload?key=6d7ef48cb26db3e0279b772ff3efeed5', { method: 'POST', body: formData, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data.success) return data.data.url;
    throw new Error('Error ImgBB');
  } catch (e) { toast('Error al subir la imagen', '#EF4444'); return null; }
}

function setupPhotoUpload() {
  function handleImg(inputId, onLoad, uploadImmediately = true) {
    const el = G(inputId); if (!el) return;
    const fresh = el.cloneNode(true); el.parentNode.replaceChild(fresh, el);
    fresh.addEventListener('change', async function (e) {
      const f = e.target.files[0];
      if (!f || !validImageType(f)) { toast('Solo JPG/PNG/WebP (máx 5MB)', '#EF4444'); return; }
      const localUrl = URL.createObjectURL(f);
      onLoad(localUrl, true, f);
      
      if (!uploadImmediately) return; // Si no subimos de inmediato, terminamos aquí.

      // Permitir al navegador renderizar la imagen local antes de bloquear el hilo principal con la compresión
      await new Promise(resolve => setTimeout(resolve, 50));
      
      window.isUploadingPhoto = true;
      const optimizedFile = await processImageForUpload(f);
      const url = await uploadToImgBB(optimizedFile);
      if (url) onLoad(url, false);
      window.isUploadingPhoto = false;
    });
  }
  function handleImgs(inputId, onLoad) {
    const el = G(inputId); if (!el) return;
    const fresh = el.cloneNode(true); el.parentNode.replaceChild(fresh, el);
    fresh.addEventListener('change', async function (e) {
      const files = Array.from(e.target.files); if (!files.length) return;
      window.isUploadingPhoto = true;
      toast('Guardando ' + files.length + ' foto(s)...', '#F59E0B');
      for (let i = 0; i < files.length; i++) {
        if (!validImageType(files[i])) continue;
        
        // No mostramos preview local de múltiples imágenes para evitar saturar el DOM rápido,
        // pero sí permitimos que se pinte el toast de "Guardando..."
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const optimizedFile = await processImageForUpload(files[i]);
        const url = await uploadToImgBB(optimizedFile);
        if (url) onLoad(url, false);
      }
      window.isUploadingPhoto = false;
    });
  }
  handleImg('biz-cover-input', function (d, isPreview) {
    const p = G('reg-cover-preview');
    if (isPreview && p) {
      p.style.backgroundImage = 'url(' + d + ')';
      p.style.backgroundSize = 'cover';
      p.style.backgroundPosition = 'center';
      const hint = G('reg-cover-hint'); if (hint) hint.style.display = 'none';
    }
    if (!isPreview) {
      if (typeof REG !== 'undefined' && REG) REG.cover = d;
      if (typeof CUR !== 'undefined' && CUR) { CUR.cover = d; saveDB(); if (typeof renderHeader === 'function') renderHeader(); if (typeof initProfile === 'function') initProfile(); }
      toast('Portada guardada', '#22C55E');
    }
  });
  handleImg('logo-input', function (d, isPreview) {
    const p = G('logo-preview');
    if (isPreview && p) { p.style.backgroundImage = 'url(' + d + ')'; p.style.backgroundSize = 'cover'; p.style.backgroundPosition = 'center'; p.innerHTML = ''; }
    if (!isPreview) {
      if (typeof REG !== 'undefined' && REG) REG.logo = d;
      if (typeof CUR !== 'undefined' && CUR) { CUR.logo = d; saveDB(); if (typeof renderHeader === 'function') renderHeader(); if (typeof initProfile === 'function') initProfile(); }
      toast('Logo guardado', '#22C55E');
    }
  });
  handleImg('biz-profile-cover-input', function (d, isPreview, file) {
    var p = G('biz-profile-cover'); if (p) p.style.backgroundImage = 'url(' + d + ')'; 
    if (isPreview) {
      window._pendingBizCover = file;
      toast('Portada cargada. Pulsa Guardar cambios.', '#F59E0B');
    }
  }, false);
  handleImg('biz-profile-logo-input', function (d, isPreview, file) {
    var p = G('biz-profile-logo'); if (p) p.innerHTML = '<img src="' + d + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">'; 
    if (isPreview) {
      window._pendingBizLogo = file;
      toast('Logo cargado. Pulsa Guardar cambios.', '#F59E0B');
    }
  }, false);
  handleImgs('svc-photo-input', function (d, isPreview) { if (isPreview) return; if (!REG || REG.photos.length >= 12) { toast('Máximo 12 fotos', '#EF4444'); return; } REG.photos.push(d); renderRegPhotos(); });
  handleImgs('gallery-input', function (d, isPreview) { if (isPreview) return; if (!CUR) return; if (!CUR.photos) CUR.photos = []; if (CUR.photos.length >= 20) { toast('Máximo 20 fotos', '#EF4444'); return; } CUR.photos.push(d); saveDB(); renderGallery(); toast('Foto añadida', '#22C55E'); });
  handleImg('bar-photo-input', function (d, isPreview) {
    const p = G('bar-photo-preview'); if (p) p.innerHTML = '<img src="' + d + '" class="photo-preview" alt="Foto"/>';
    if (!isPreview) window._barPhoto = d;
  });
}

function renderRegPhotos() {
  const grid = G('service-photos-reg'); if (!grid) return;
  grid.innerHTML = REG.photos.map(function (p, i) {
    return '<div class="img-thumb"><img src="' + safeImg(p) + '" alt="Foto ' + (i + 1) + '"><button onclick="REG.photos.splice(' + i + ',1);renderRegPhotos();" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button></div>';
  }).join('') + '<div class="img-thumb add-btn" onclick="document.getElementById(\'svc-photo-input\').click()">＋</div>';
}

function renderGallery() {
  if (!CUR) return;
  const grid = G('biz-gallery'); if (!grid) return;
  grid.innerHTML = (CUR.photos || []).map(function (p, i) {
    return '<div class="img-thumb"><img src="' + safeImg(p) + '" alt="Producto ' + (i + 1) + '"><button onclick="delGalleryPhoto(' + i + ')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button></div>';
  }).join('');
}

function delGalleryPhoto(idx) {
  if (!CUR) return;
  CUR.photos = (CUR.photos || []).filter(function (_, i) { return i !== idx; });
  saveDB(); renderGallery(); toast('Producto eliminado', '#475569');
}

function finalizeBizReg() {
  if (DB.businesses.filter(function (b) { return (b.email || '').toLowerCase() === REG.email.toLowerCase(); })[0]) { toast('Email ya registrado', '#EF4444'); showRegStep(2); return; }
  const slug = (REG.name || 'negocio').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20) + '-' + Date.now().toString(36);
  const hoy = new Date(), trialEnd = new Date(hoy); trialEnd.setDate(trialEnd.getDate() + 7); // Periodo de prueba de 7 días
  const biz = { id: slug, name: REG.name, owner: REG.owner, email: REG.email, pass: REG.pass, phone: REG.phone, addr: REG.addr, city: REG.city, country: REG.country, type: REG.type, teamSize: REG.teamSize, join_date: hoy.toISOString().split('T')[0], expires_at: trialEnd.toISOString().split('T')[0], plan: 'trial', desc: '', logo: REG.logo || '', photos: REG.photos || [], insta: '', facebook: '', x_url: '', cover: REG.cover || '', horario: DEFAULT_HORARIO.map(function (h) { return Object.assign({}, h); }), workers: [], services: [], appointments: [], referred_by_code: REG.referred_by_code || null };
  DB.businesses.push(biz); DB.currentBiz = slug; DB.currentWorker = null; CUR = biz; saveDB();

  // Interceptar flujo si el usuario viene directo a comprar (Landing Page -> Checkout)
  const urlParams = new URLSearchParams(window.location.search);
  const planToBuy = urlParams.get('plan');
  if (planToBuy && (planToBuy === 'mensual' || planToBuy === 'trimestral' || planToBuy === 'anual')) {
    const pais = window.getPaisActivo ? window.getPaisActivo() : 'DEFAULT';
    const linksDodo = window.LINKS_DODO || {};
    const links = linksDodo[pais] || linksDodo['GLOBAL'];
    if (links) {
      let finalLink = links[planToBuy];
      if (finalLink && finalLink.includes("LINK_")) finalLink = linksDodo['GLOBAL'][planToBuy];
      if (finalLink) {
        window.location.href = finalLink + "?metadata_bizId=" + biz.id + "&redirect_url=" + encodeURIComponent(window.location.href);
        return; // Detener flujo para ir directo al pago
      }
    }
  }

  T('biz-link-display', window.location.host + '/#b/' + slug); T('neg-badge', DB.businesses.length);
  const waLink = G('wa-share-link'); if (waLink) waLink.href = 'https://wa.me/?text=' + encodeURIComponent('Reserva tu cita en ' + REG.name + ' → ' + window.location.origin + '/#b/' + slug);
  checkNotifications();
}

function completeBizReg() { CUR = DB.businesses.filter(function (b) { return b.id === DB.currentBiz; })[0]; if (CUR) showBizPanel(); else showRegStep(0); }

function copyLink() {
  const link = window.location.origin + '/#b/' + (CUR ? CUR.id : DB.currentBiz || 'mi-negocio');
  try { navigator.clipboard.writeText(link); } catch (e) { }
  toast('Enlace copiado', '#4A7FD4');
}

/* ══════════════════════════
   INIT PANEL DUEÑO
══════════════════════════ */
function initBizPanel() {
  if (!CUR) return;

  if (typeof window.autoCompletePastAppointments === 'function') {
    if (window.autoCompletePastAppointments(CUR)) saveDB();
  }

  // ── Moneda y precio según país del negocio ──
  if (CUR.country && typeof guardarPaisEnCache === 'function') {
    guardarPaisEnCache(CUR.country);
    if (typeof adaptarPrecioLocal === 'function') adaptarPrecioLocal(CUR.country);
  }

  const hr = new Date().getHours(), g = hr < 12 ? 'Buenos días' : hr < 18 ? 'Buenas tardes' : 'Buenas noches';
  T('biz-greeting', g + ' ' + (CUR.owner || '').split(' ')[0]);
  T('biz-hdr-nm', CUR.name);

  const planEl = G('biz-hdr-plan');
  if (planEl) {
    planEl.textContent = (CUR.plan === 'active' || CUR.plan === 'pro') ? 'Plan activo' : CUR.plan === 'trial' ? 'Prueba gratis' : 'Suscripción vencida';
    planEl.style.color = (CUR.plan === 'active' || CUR.plan === 'pro') ? 'var(--green)' : CUR.plan === 'trial' ? 'var(--gold)' : 'var(--red)';
  }

  const av = G('biz-hdr-av');
  if (av) {
    if (CUR.logo) av.innerHTML = '<img src="' + safeImg(CUR.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">';
    else av.textContent = (CUR.name || '?').charAt(0).toUpperCase();
  }

  const today = new Date().toISOString().split('T')[0];
  const allAppts = _getAllAppts();
  const todayA = allAppts.filter(function (a) { return a.date === today && a.status !== 'cancelled'; });
  const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  const weekA = allAppts.filter(function (a) { return a.date >= thisWeekStart.toISOString().split('T')[0] && a.status !== 'cancelled'; });
  const thisMonthStart = new Date(); thisMonthStart.setDate(1);
  const monthA = allAppts.filter(function (a) { return a.date >= thisMonthStart.toISOString().split('T')[0] && a.status !== 'cancelled'; });

  T('bh-today', todayA.length);
  T('bh-rev', money(todayA.reduce(function (s, a) { return s + (a.price || 0); }, 0)));
  T('bh-week', weekA.length);
  T('bh-month', money(monthA.reduce(function (s, a) { return s + (a.price || 0); }, 0)));

  const link = window.location.host + '/#b/' + CUR.id;
  T('biz-link-show', link);
  const wah = G('wa-share-home'); if (wah) wah.href = 'https://wa.me/?text=' + encodeURIComponent('Reserva tu cita en ' + CUR.name + ' → https://' + link);

  renderBizWorkers();
  renderGallery();
  renderBizFinances();
  renderCalendar();
  initAgenda();

  if (typeof renderBizHomeStats === 'function') renderBizHomeStats();

  const profileCover = G('biz-profile-cover'); if (profileCover && CUR.cover) profileCover.style.backgroundImage = 'url(' + safeImg(CUR.cover) + ')';
  const profileLogo = G('biz-profile-logo');
  if (profileLogo) {
    if (CUR.logo) profileLogo.innerHTML = '<img src="' + safeImg(CUR.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">';
    else profileLogo.textContent = (CUR.name || '?').charAt(0).toUpperCase();
  }

  var pfNm = G('pf-nm'); if (pfNm) pfNm.value = CUR.name || '';
  var pfAd = G('pf-addr'); if (pfAd) pfAd.value = CUR.addr || '';
  var pfPh = G('pf-phone'); if (pfPh) pfPh.value = CUR.phone || '';
  var pfIn = G('pf-insta'); if (pfIn) pfIn.value = CUR.insta || '';
  var pfFb = G('pf-facebook'); if (pfFb) pfFb.value = CUR.facebook || '';
  var pfX = G('pf-xurl'); if (pfX) pfX.value = CUR.x_url || '';
  var pfTk = G('pf-tiktok'); if (pfTk) pfTk.value = CUR.tiktok || '';
  var pfDs = G('pf-desc'); if (pfDs) pfDs.value = CUR.desc || '';
  const pfPs = G('pf-plan-status');

  const loyCfg = typeof normalizeLoyaltyConfig === 'function'
    ? normalizeLoyaltyConfig(CUR.loyalty)
    : Object.assign({ active: true, mode: 'stamps', stamps: 10, points_goal: 100, reward_type: 'free_service', reward_pct: 50, reward_product_id: '', reward_product_name: '' }, CUR.loyalty || {});

  const pfLoyaltyToggle = G('toggle-loyalty');
  if (pfLoyaltyToggle) {
    if (loyCfg.active) pfLoyaltyToggle.classList.add('on');
    else pfLoyaltyToggle.classList.remove('on');
  }
  if (G('pf-loyalty-mode')) G('pf-loyalty-mode').value = loyCfg.mode;
  if (G('pf-loyalty-stamps')) G('pf-loyalty-stamps').value = loyCfg.stamps;
  if (G('pf-loyalty-pts')) G('pf-loyalty-pts').value = loyCfg.points_goal;
  if (G('pf-loyalty-reward')) G('pf-loyalty-reward').value = loyCfg.reward_type;
  if (G('pf-loyalty-pct')) G('pf-loyalty-pct').value = loyCfg.reward_pct;
  if (typeof populateProfileLoyaltyProducts === 'function') {
    populateProfileLoyaltyProducts(loyCfg.reward_product_id, loyCfg.reward_product_name);
  }
  if (typeof syncProfileLoyaltyFields === 'function') syncProfileLoyaltyFields();

  if (pfPs) pfPs.textContent = (CUR.plan === 'active' || CUR.plan === 'pro') ? 'Plan activo · Próxima factura el día 1' : CUR.plan === 'trial' ? 'En período de prueba gratuito' : 'Suscripción vencida — contacta soporte';
  const pfPb = G('pf-plan-badge'); if (pfPb) pfPb.innerHTML = planTag(CUR.plan);

  // 🚀 INYECTAMOS LA LÓGICA DE PAGOS AQUÍ (Justo antes de abrir el tab)
  configurarBotonesDePago();

  bizTab('home');
}

/* ══════════════════════════
   TABS DUEÑO
══════════════════════════ */
function navigateToBizState(state, replace = false) {
  // 1. Actualizar la URL sin recargar la página
  const newUrl = `/app#${state}`;
  if (replace) {
    history.replaceState({ tab: state }, '', newUrl);
  } else {
    // Solo empuja un nuevo estado si es diferente al actual
    if (window.location.hash !== `#${state}`) {
      history.pushState({ tab: state }, '', newUrl);
    }
  }

  // 2. Lógica para mostrar la vista correcta (tu código original)
  const tabs = ['home', 'agenda', 'caja', 'equipo', 'clientes', 'tienda', 'finanzas', 'historial', 'perfil'];
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i]; const pa = G('bp-' + t), bt = G('bn-' + t);
    if (pa) pa.classList[t === state ? 'add' : 'remove']('on');
    if (bt) bt.classList[t === state ? 'add' : 'remove']('on');
  }

  // 3. Cargar datos específicos de la pestaña
  if (state === 'agenda') { DB = loadDB(); CUR = DB.currentBiz ? DB.businesses.filter(function (b) { return b.id === DB.currentBiz; })[0] : CUR; initAgenda(); }
  if (state === 'caja' && typeof initPosPanel === 'function') { initPosPanel(); }
  if (state === 'clientes' && typeof initBizClientsCrm === 'function') { initBizClientsCrm(); }
  if (state === 'tienda' && typeof renderTiendaAdmin === 'function') { renderTiendaAdmin(); }
  if (state === 'finanzas') {
    if (typeof initBizFinancesPro === 'function') initBizFinancesPro();
    else renderBizFinances();
  }
  if (state === 'historial') renderBizFinances();
  if (state === 'home') {
    DB = loadDB(); CUR = DB.currentBiz ? DB.businesses.filter(function (b) { return b.id === DB.currentBiz; })[0] : CUR;
    if (typeof renderBizHomeStats === 'function') renderBizHomeStats();
  }
}

function bizTab(tab) {
  navigateToBizState(tab);
}

// Escuchador del botón "Atrás" del navegador/celular
window.addEventListener('popstate', function(event) {
  if (event.state && event.state.tab && G('s-biz').classList.contains('on')) {
    navigateToBizState(event.state.tab, true); // El 'true' evita crear más historial
  }
});

function openBizConfig() {
  openOv('ov-config-biz');
  const tgl = G('toggle-dark-mode-biz');
  if (tgl) {
    if (!document.documentElement.classList.contains('dark')) tgl.classList.add('on');
    else tgl.classList.remove('on');
  }
}

/* ══════════════════════════
   CITAS HOY (dueño ve todo)
══════════════════════════ */

function apptRowH(a) {
  const sc = { confirmed: { c: 'var(--blue)', bg: 'rgba(74,127,212,.1)', l: 'Conf.' }, pending: { c: 'var(--gold)', bg: 'rgba(245,158,11,.1)', l: 'Pend.' }, completed: { c: 'var(--green)', bg: 'rgba(34,197,94,.1)', l: 'Hecho' }, cancelled: { c: 'var(--red)', bg: 'rgba(239,68,68,.1)', l: 'Canc.' }, in_progress: { c: '#A855F7', bg: 'rgba(168,85,247,.1)', l: 'En curso' }, rescheduled: { c: 'var(--gold)', bg: 'rgba(245,158,11,.1)', l: 'Reagend.' } }[a.status] || { c: 'var(--blue)', bg: 'rgba(74,127,212,.1)', l: 'Conf.' };
  const initials = san((a.client || '?').split(' ').map(function (n) { return n[0] || ''; }).slice(0, 2).join('').toUpperCase());
  return '<div class="appt-row" onclick="openApptDetail(\'' + sanitizeText(a.id) + '\')"><div class="appt-avatar">' + initials + '</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + san(a.client) + '</div><div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(a.svc) + ((a.workerName || a.barber) ? ' · ' + san(a.workerName || a.barber) : '') + '</div>' + (a.notes ? '<div style="font-size:11px;color:var(--muted);margin-top:2px;font-style:italic">' + san(a.notes) + '</div>' : '') + '</div><div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:15px;color:var(--blue)">' + money(a.price) + '</div><div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(a.time) + '</div><div style="margin-top:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:' + sc.bg + ';color:' + sc.c + '">' + sc.l + '</div></div></div>';
}

function openApptDetail(id) {
  if (!CUR) return;
  let a = null;
  (CUR.workers || []).forEach(function (w) { (w.appointments || []).forEach(function (ap) { if (String(ap.id) === String(id)) a = ap; }); });
  (CUR.appointments || []).forEach(function (ap) { if (String(ap.id) === String(id)) a = ap; });
  if (!a) return;

  const loyaltyHtml = typeof buildLoyaltyHtml === 'function' ? buildLoyaltyHtml(a, _getAllAppts()) : '';
  const waMsg = 'Hola ' + a.client + ', te recordamos tu cita en ' + CUR.name + ' el ' + a.date + ' a las ' + a.time + '.';
  const waLink = a.phone
    ? (typeof buildWhatsAppUrl === 'function' ? buildWhatsAppUrl(a.phone, waMsg, CUR.country) : ('https://wa.me/' + a.phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(waMsg)))
    : '#';

  // 🧹 LIMPIEZA DE BOTONES ANTIGUOS (HARDCODEADOS EN HTML)
  ['appt-wa-btn', 'appt-complete-btn', 'appt-cancel-btn'].forEach(function(b) {
    const el = document.getElementById(b);
    if (el) el.remove(); // Eliminamos los antiguos (con emoji) para evitar duplicados
  });

  H('appt-detail-content', '<div style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--r);padding:16px;margin-bottom:14px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div class="appt-avatar" style="width:52px;height:52px;font-size:20px">' + san((a.client || '?').split(' ').map(function (n) { return n[0] || ''; }).slice(0, 2).join('').toUpperCase()) + '</div><div><div style="font-size:18px;font-weight:900">' + san(a.client) + '</div>' + (a.phone ? '<div style="font-size:14px;color:var(--blue3);margin-top:3px;font-weight:600">' + san(a.phone) + '</div>' : '') + (a.email ? '<div style="font-size:13px;color:var(--t2);margin-top:2px">' + san(a.email) + '</div>' : '') + '</div></div></div>' + loyaltyHtml + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px"><div class="sbox"><div class="slbl">Fecha</div><div style="font-size:14px;font-weight:700">' + san(a.date) + '</div></div><div class="sbox"><div class="slbl">Hora</div><div style="font-size:18px;font-weight:900;color:var(--blue)">' + san(a.time) + '</div></div><div class="sbox"><div class="slbl">Servicio</div><div style="font-size:13px;font-weight:700">' + san(a.svc) + '</div></div><div class="sbox"><div class="slbl">Total</div><div style="font-size:18px;font-weight:900;color:var(--green)">' + money(a.price) + '</div></div></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + (a.phone ? '<a href="' + waLink + '" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:#fff;text-decoration:none;padding:12px;border-radius:12px;font-weight:800;font-size:15px;box-shadow:0 4px 12px rgba(37,211,102,0.3);"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Contactar por WhatsApp</a>' : '')
    + (a.status !== 'completed' && a.status !== 'cancelled' ? '<button onclick="posChargeAppointment(\'' + sanitizeText(id) + '\')" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--blue);color:#fff;border:none;padding:12px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:4px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>Cobrar en Caja</button>' : '')
    + '<button onclick="openRescheduleModal(\'' + sanitizeText(id) + '\')" style="width:100%;background:rgba(245,158,11,.15);color:#F59E0B;border:1px solid rgba(245,158,11,.3);padding:12px;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;transition:all 0.2s;margin-bottom:8px">Reagendar Cita</button>'
    + '<div style="display:flex;gap:10px;">'
    + '<button onclick="updateApptStatus(\'' + id + '\', \'completed\')" style="flex:1;background:rgba(34,197,94,.15);color:#22C55E;border:1px solid rgba(34,197,94,.3);padding:12px;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;transition:all 0.2s;">✓ Completar</button>'
    + '<button onclick="updateApptStatus(\'' + id + '\', \'cancelled\')" style="flex:1;background:rgba(239,68,68,.15);color:#EF4444;border:1px solid rgba(239,68,68,.3);padding:12px;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;transition:all 0.2s;">× Cancelar</button>'
    + '</div>'
    + '</div>'
  );
  openOv('ov-appt-detail');
}

async function updateApptStatus(id, status) {
  if (!CUR) return;
  let targetAppt = null;
  let targetWorkerId = '';
  (CUR.workers || []).forEach(function (w) { (w.appointments || []).forEach(function (a) { if (String(a.id) === String(id)) { a.status = status; targetAppt = a; targetWorkerId = w.id; } }); });
  (CUR.appointments || []).forEach(function (a) { if (String(a.id) === String(id)) { a.status = status; targetAppt = a; } });
  if (!targetAppt) return;

  closeOv('ov-appt-detail');
  initAgenda();
  renderBizFinances();
  toast('Procesando...', '#F59E0B');

  try {
    const payload = {
      type: 'appointments',
      business_id: CUR.id,
      appointments: [{
        id: String(targetAppt.id),
        business_id: CUR.id,
        worker_id: targetWorkerId,
        client_id: '',
        client_name: targetAppt.client || '',
        client_phone: targetAppt.phone || '',
        client_email: targetAppt.email || '',
        token: targetAppt.token || '',
        service_name: targetAppt.svc || '',
        service_price: parseFloat(targetAppt.price) || 0,
        date: targetAppt.date || '',
        time: targetAppt.time || '',
        status: targetAppt.status,
        notes: targetAppt.notes || ''
      }]
    };

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Error DB');

    saveDB();
    toast(status === 'completed' ? 'Cita completada con éxito' : 'Cita cancelada con éxito', status === 'completed' ? '#22C55E' : '#EF4444');

  if (status === 'completed' && targetAppt && typeof checkLoyaltyReward === 'function') {
    checkLoyaltyReward(CUR.id, targetAppt);
  }
  } catch (err) {
    console.error(err);
    toast('Error al sincronizar con la nube', '#EF4444');
  }
}

/* ══════════════════════════════════════════════
   REAGENDAR CITA (MODAL INTERNO DEL DUEÑO)
══════════════════════════════════════════════ */
window._bizRescheduleApptId = null;
window._bizRescheduleSelectedTime = null;

window.openRescheduleModal = function(id) {
  closeOv('ov-appt-detail');
  let appt = null;
  let worker = null;
  (CUR.workers || []).forEach(function(w) {
    const found = (w.appointments || []).find(function(a) { return String(a.id) === String(id); });
    if (found) { appt = found; worker = w; }
  });
  if (!appt) {
    appt = (CUR.appointments || []).find(function(a) { return String(a.id) === String(id); });
  }
  if (!appt) return;

  window._bizRescheduleApptId = id;
  window._bizRescheduleSelectedTime = null;

  let ov = document.getElementById('ov-biz-reschedule');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ov-biz-reschedule';
    ov.className = 'ov';
    document.body.appendChild(ov);
  }

  ov.innerHTML = '<div class="modal" onclick="event.stopPropagation()">'
    + '<div class="mhdr">'
    + '<span class="mttl">Reagendar Cita</span>'
    + '<div class="xbtn" onclick="closeOv(\'ov-biz-reschedule\')">×</div>'
    + '</div>'
    + '<div style="font-size:14px;font-weight:700;margin-bottom:14px;color:var(--text);">' + san(appt.client) + ' — <span style="color:var(--blue);">' + san(appt.svc) + '</span></div>'
    + '<div class="field">'
    + '<label>Selecciona la nueva fecha</label>'
    + '<input type="date" id="biz-resched-date" class="inp" value="' + appt.date + '" onchange="renderBizRescheduleTimes()">'
    + '</div>'
    + '<div class="field">'
    + '<label>Horarios disponibles</label>'
    + '<div id="biz-resched-times" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"></div>'
    + '</div>'
    + '<button class="btn btn-blue" onclick="confirmBizReschedule()" style="width:100%;margin-top:14px;">Confirmar Horario</button>'
    + '</div>';

  openOv('ov-biz-reschedule');
  renderBizRescheduleTimes();
};

window.renderBizRescheduleTimes = function() {
  const apptId = window._bizRescheduleApptId;
  let appt = null;
  let worker = null;
  (CUR.workers || []).forEach(function(w) {
    const found = (w.appointments || []).find(function(a) { return String(a.id) === String(apptId); });
    if (found) { appt = found; worker = w; }
  });
  if (!appt) {
    appt = (CUR.appointments || []).find(function(a) { return String(a.id) === String(apptId); });
  }
  if (!appt) return;

  const dateStr = document.getElementById('biz-resched-date').value;
  const timesEl = document.getElementById('biz-resched-times');
  if (!dateStr) {
    timesEl.innerHTML = '<div style="font-size:13px;color:var(--muted);">Selecciona una fecha</div>';
    return;
  }

  let dur = 30;
  const svcList = worker ? worker.services : CUR.services;
  if (svcList) {
    const sObj = svcList.find(function(s) { return s.name === appt.svc; });
    if (sObj) dur = parseInt(sObj.dur) || 30;
  }

  const d = new Date(dateStr + 'T12:00');
  const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d.getDay()];
  const horario = worker ? worker.horario : CUR.horario;
  const hDay = (horario || []).find(function(h) { return h.day === dayName; }) || {open:true, from1:'09:00', to1:'14:00'};

  if (!hDay.open) {
    timesEl.innerHTML = '<div style="font-size:13px;padding:10px;background:rgba(239,68,68,.1);color:var(--red);border-radius:8px;width:100%;text-align:center;font-weight:700;">Día no laborable</div>';
    return;
  }

  const times = [];
  function addInterval(startStr, endStr) {
    if (!startStr || !endStr) return;
    const p1 = startStr.split(':').map(Number), p2 = endStr.split(':').map(Number);
    const fM = p1[0]*60 + p1[1], tM = p2[0]*60 + p2[1];
    for (let m = fM; m <= tM - dur; m += 30) {
      const h = Math.floor(m/60), mn = m%60;
      times.push(String(h).padStart(2,'0') + ':' + String(mn).padStart(2,'0'));
    }
  }
  addInterval(hDay.from1 || hDay.from, hDay.to1 || hDay.to);
  if (hDay.hasBreak) addInterval(hDay.from2, hDay.to2);

  const blocked = {};
  const allAppts = worker ? worker.appointments : CUR.appointments;
  (allAppts || []).forEach(function(a) {
    if (a.date === dateStr && a.status !== 'cancelled' && String(a.id) !== String(appt.id)) {
      let sDur = 30;
      const sList = worker ? worker.services : CUR.services;
      if (sList) {
        const sObj = sList.find(function(s) { return s.name === a.svc; });
        if (sObj) sDur = parseInt(sObj.dur)||30;
      }
      const pts = a.time.split(':').map(Number);
      const st = pts[0]*60 + pts[1];
      for(let i=0; i<sDur; i+=30) blocked[st+i] = true;
    }
  });

  const validTimes = times.filter(function(t) {
    const pts = t.split(':').map(Number);
    const st = pts[0]*60 + pts[1];
    for(let i=0; i<dur; i+=30) {
      if (blocked[st+i]) return false;
    }
    return true;
  });

  if (validTimes.length === 0) {
    timesEl.innerHTML = '<div style="font-size:13px;padding:10px;background:rgba(245,158,11,.1);color:var(--gold);border-radius:8px;width:100%;text-align:center;font-weight:700;">Sin horarios disponibles para la duración ('+dur+' min)</div>';
    return;
  }

  window._bizRescheduleSelectedTime = null;
  timesEl.innerHTML = validTimes.map(function(t) {
    return '<div class="topt-resched" data-tm="'+t+'" onclick="window._selectBizRescheduleTime(this, \''+t+'\')" style="padding:8px 14px;background:var(--card);border:1px solid var(--b);border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.2s;">'+t+'</div>';
  }).join('');
};

window._selectBizRescheduleTime = function(el, time) {
  document.querySelectorAll('#ov-biz-reschedule .topt-resched').forEach(function(e) {
    e.style.background = 'var(--card)';
    e.style.color = 'var(--text)';
    e.style.borderColor = 'var(--b)';
  });
  el.style.background = 'rgba(74,127,212,.15)';
  el.style.color = 'var(--blue)';
  el.style.borderColor = 'var(--blue)';
  window._bizRescheduleSelectedTime = time;
};

window.confirmBizReschedule = async function() {
  if (!window._bizRescheduleSelectedTime) {
    toast('Selecciona un horario de la lista', '#EF4444');
    return;
  }
  const newDate = document.getElementById('biz-resched-date').value;
  const newTime = window._bizRescheduleSelectedTime;
  const apptId = window._bizRescheduleApptId;

  let appt = null;
  let workerId = '';
  (CUR.workers || []).forEach(function(w) {
    const found = (w.appointments || []).find(function(a) { return String(a.id) === String(apptId); });
    if (found) { appt = found; workerId = w.id; }
  });
  if (!appt) {
    appt = (CUR.appointments || []).find(function(a) { return String(a.id) === String(apptId); });
  }
  if (!appt) return;

  const oldDate = appt.date;
  const oldTime = appt.time;

  appt.date = newDate;
  appt.time = newTime;
  appt.status = 'confirmed';

  closeOv('ov-biz-reschedule');
  initAgenda();
  renderCalendar();
  toast('Procesando reagendamiento...', '#F59E0B');

  try {
    const payload = {
      type: 'appointments',
      business_id: CUR.id,
      appointments: [{
        id: String(appt.id),
        business_id: CUR.id,
        worker_id: workerId,
        client_name: appt.client || '',
        client_phone: appt.phone || '',
        client_email: appt.email || '',
        token: appt.token || '',
        service_name: appt.svc || '',
        service_price: parseFloat(appt.price) || 0,
        date: appt.date,
        time: appt.time,
        status: appt.status,
        notes: appt.notes || ''
      }]
    };

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Error DB');

    saveDB();
    toast('Cita reagendada con éxito', '#22C55E');
    
    if (appt.email) {
        fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'booking_confirmed',
                to: appt.email,
                data: {
                    bizName: CUR.name,
                    service: appt.svc,
                    date: appt.date,
                    time: appt.time,
                    price: money(appt.price)
                }
            })
        }).catch(function(e){});
    }
  } catch (err) {
    console.error(err);
    appt.date = oldDate;
    appt.time = oldTime;
    initAgenda();
    renderCalendar();
    toast('Error al reagendar en la nube', '#EF4444');
  }
};

/* ══════════════════════════
   EQUIPO — con ingresos del día y del mes por trabajador
══════════════════════════ */
function renderBizWorkers() {
  if (!CUR) return;
  const workers = CUR.workers || [];
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');

  H('biz-workers-list', workers.length
    ? workers.map(function (w) {
      const av = w.photo
        ? '<img src="' + safeImg(w.photo) + '" style="width:100%;height:100%;object-fit:cover" alt="Foto">'
        : '<span style="font-size:18px;font-weight:800;color:#fff">' + san((w.name || '?').charAt(0).toUpperCase()) + '</span>';

      const appts = w.appointments || [];
      const todayAppts = appts.filter(function (a) { return a.date === today && a.status !== 'cancelled'; });
      const monthAppts = appts.filter(function (a) { return a.date && a.date.slice(0, 7) === thisMonth && a.status !== 'cancelled'; });
      const totalAppts = appts.filter(function (a) { return a.status !== 'cancelled'; }).length;
      const revHoy = todayAppts.reduce(function (s, a) { return s + (a.price || 0); }, 0);
      const revMes = monthAppts.reduce(function (s, a) { return s + (a.price || 0); }, 0);

      return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:10px">'
        + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'
        + '<div onclick="openWorkerProfile(\'' + sanitizeText(w.id) + '\')" style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;cursor:pointer">' + av + '</div>'
        + '<div style="flex:1;cursor:pointer" onclick="openWorkerProfile(\'' + sanitizeText(w.id) + '\')">'
        + '<div style="font-weight:700;font-size:15px;color:var(--blue)">' + san(w.name) + '</div>'
        + '<div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(w.spec || '') + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + totalAppts + ' citas · ' + (w.services || []).length + ' servicios</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">'
        + '<div style="display:flex;gap:6px">'
        + '<button onclick="openWorkerModal(\'' + sanitizeText(w.id) + '\')" style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--rpill);padding:6px 12px;color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font)">Editar</button>'
        + '<button onclick="confirmDeleteWorker(\'' + sanitizeText(w.id) + '\')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);border-radius:var(--rpill);padding:6px 10px;color:var(--red);font-size:12px;cursor:pointer">&#x2715;</button>'
        + '</div>'
        + '<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:' + (w.active ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)') + ';color:' + (w.active ? 'var(--green)' : 'var(--red)') + ';">' + (w.active ? 'Activo' : 'Inactivo') + '</span>'
        + '</div></div>'
        /* Mini stats financieras del trabajador */
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:var(--bg3);border-radius:14px;padding:10px">'
        + '<div style="text-align:center"><div style="font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:3px">Hoy</div><div style="font-size:14px;font-weight:900;color:var(--green)">' + money(revHoy) + '</div><div style="font-size:10px;color:var(--muted)">' + todayAppts.length + ' cita' + (todayAppts.length !== 1 ? 's' : '') + '</div></div>'
        + '<div style="text-align:center;border-left:1px solid var(--b);border-right:1px solid var(--b)"><div style="font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:3px">Este mes</div><div style="font-size:14px;font-weight:900;color:var(--blue)">' + money(revMes) + '</div><div style="font-size:10px;color:var(--muted)">' + monthAppts.length + ' cita' + (monthAppts.length !== 1 ? 's' : '') + '</div></div>'
        + '<div style="text-align:center"><div style="font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:3px">Total citas</div><div style="font-size:14px;font-weight:900;color:var(--gold)">' + totalAppts + '</div><div style="font-size:10px;color:var(--muted)">' + (w.services || []).length + ' servicios</div></div>'
        + '</div>'
        + '</div>';
    }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">No hay trabajadores aún</div></div>');
}

function openWorkerProfile(workerId) {
  if (!CUR) return;
  const worker = CUR.workers.find(function (w) { return w.id === workerId; }); if (!worker) return;
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
  const appts = worker.appointments || [];
  const totalIngresos = appts.filter(function (a) { return a.status === 'completed'; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
  const todayRev = appts.filter(function (a) { return a.date === today && a.status !== 'cancelled'; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
  const mesRev = appts.filter(function (a) { return a.date && a.date.slice(0, 7) === thisMonth && a.status !== 'cancelled'; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
  const completadas = appts.filter(function (a) { return a.status === 'completed'; }).length;
  const svcCount = {}; appts.forEach(function (a) { if (a.svc) svcCount[a.svc] = (svcCount[a.svc] || 0) + 1; });
  let topSvc = '—', topC = 0; Object.keys(svcCount).forEach(function (k) { if (svcCount[k] > topC) { topSvc = k; topC = svcCount[k]; } });
  const serviciosHtml = (worker.services && worker.services.length > 0) ? worker.services.map(function (s) { return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px">' + san(s.name) + ' <small style="color:var(--muted)">(' + s.dur + ' min)</small></span><span style="font-weight:bold;font-size:14px;color:var(--blue)">' + money(s.price) + '</span></div>'; }).join('') : '<p style="color:var(--muted);font-size:12px;text-align:center;">Sin servicios aún.</p>';
  const av = worker.photo ? '<img src="' + safeImg(worker.photo) + '" style="width:100%;height:100%;object-fit:cover" alt="Foto">' : worker.name.charAt(0).toUpperCase();
  H('worker-profile-content',
    '<div style="text-align:center;padding:20px 20px 10px">'
    + '<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#4A7FD4,#2855C8);margin:0 auto 15px;display:flex;align-items:center;justify-content:center;font-size:30px;color:white;overflow:hidden;box-shadow:0 4px 15px rgba(74,127,212,.3)">' + av + '</div>'
    + '<h3 style="margin:0;font-size:20px;font-weight:900">' + san(worker.name) + '</h3>'
    + '<p style="color:var(--t2);font-size:13px;margin-top:4px">' + san(worker.spec || worker.email || '') + '</p>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 20px 12px">'
    + '<div style="background:var(--bblue);padding:14px;border-radius:16px;text-align:center"><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:3px">HOY</div><div style="font-size:20px;font-weight:900;color:var(--green)">' + money(todayRev) + '</div></div>'
    + '<div style="background:var(--bblue);padding:14px;border-radius:16px;text-align:center"><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:3px">ESTE MES</div><div style="font-size:20px;font-weight:900;color:var(--blue)">' + money(mesRev) + '</div></div>'
    + '<div style="background:var(--bblue);padding:14px;border-radius:16px;text-align:center"><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:3px">COMPLETADAS</div><div style="font-size:20px;font-weight:900">' + completadas + '</div></div>'
    + '<div style="background:var(--bblue);padding:14px;border-radius:16px;text-align:center"><div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:3px">TOTAL GANADO</div><div style="font-size:20px;font-weight:900;color:var(--gold)">' + money(totalIngresos) + '</div></div>'
    + '</div>'
    + '<div style="padding:0 20px 8px"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Servicio top: <span style="color:var(--blue3)">' + san(topSvc) + '</span></div></div>'
    + '<div style="padding:0 20px 20px"><h4 style="font-size:12px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Catálogo</h4><div style="background:var(--card);padding:10px 15px;border-radius:16px;border:1px solid var(--b);">' + serviciosHtml + '</div></div>'
  );
  openOv('ov-worker-profile');
}

/* ══════════════════════════
   MODAL TRABAJADOR
══════════════════════════ */
let editWorkerId = null;

function openWorkerModal(id) {
  editWorkerId = id || null; window._barPhoto = null;
  T('bar-ttl', id ? 'Editar trabajador' : 'Añadir trabajador');
  const pv = G('bar-photo-preview'); if (pv) pv.innerHTML = '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
  const credSection = G('bar-cred-section'); if (credSection) credSection.style.display = id ? 'none' : 'block';
  if (id && CUR) {
    const w = (CUR.workers || []).filter(function (x) { return x.id === id; })[0];
    if (w) {
      const n = G('bar-name'), sp = G('bar-spec'), ph = G('bar-phone'), em = G('bar-email');
      const cs = G('bar-comm-svc'), cp = G('bar-comm-prod');
      if (n) n.value = w.name || ''; if (sp) sp.value = w.spec || ''; if (ph) ph.value = w.phone || ''; if (em) em.value = w.email || '';
      if (cs) cs.value = w.commission_services || ''; if (cp) cp.value = w.commission_products || '';
      if (pv && w.photo) pv.innerHTML = '<img src="' + safeImg(w.photo) + '" class="photo-preview" alt="Foto"/>';
    }
  } else { ['bar-name', 'bar-spec', 'bar-phone', 'bar-email', 'bar-pass', 'bar-comm-svc', 'bar-comm-prod'].forEach(function (fid) { const e = G(fid); if (e) e.value = ''; }); }
  openOv('ov-worker');
}

function saveBizWorkerProfile() {
  const name = sanitizeText(V('bar-name')), spec = sanitizeText(V('bar-spec')), phone = sanitizeText(V('bar-phone')), email = V('bar-email').trim().toLowerCase(), pass = V('bar-pass'), photo = window._barPhoto || null;
  const commSvc = Math.min(100, Math.max(0, parseFloat(V('bar-comm-svc')) || 0));
  const commProd = Math.min(100, Math.max(0, parseFloat(V('bar-comm-prod')) || 0));
  if (!name) { toast('Nombre requerido', '#EF4444'); return; } if (!CUR) return; if (!CUR.workers) CUR.workers = [];
  const workerId = editWorkerId || 'w_' + Date.now();
  let existingPhoto = '', existingCover = '', existingHorario = [];
  if (editWorkerId) { const existing = (CUR.workers || []).filter(function (x) { return x.id === editWorkerId; })[0]; if (existing) { existingPhoto = existing.photo || ''; existingCover = existing.cover || ''; existingHorario = existing.horario || []; } }
  const finalPhoto = photo || existingPhoto;
  const workerDbObj = { id: workerId, business_id: CUR.id, name: name, email: email, password: pass || (editWorkerId && (CUR.workers || []).filter(function (x) { return x.id === editWorkerId; })[0] ? ((CUR.workers || []).filter(function (x) { return x.id === editWorkerId; })[0].pass || '') : ''), phone: phone, avatar: finalPhoto, cover: existingCover, role: spec || 'worker', horario: existingHorario, commission_services: commSvc, commission_products: commProd };
  if (editWorkerId) { const w = (CUR.workers || []).filter(function (x) { return x.id === editWorkerId; })[0]; if (w) { w.name = name; w.spec = spec; w.phone = phone; w.photo = finalPhoto; w.commission_services = commSvc; w.commission_products = commProd; } toast('Trabajador editado', '#4A7FD4'); }
  else { if (!validEmail(email)) { toast('Email inválido', '#EF4444'); return; } if (!pass || pass.length < 6) { toast('Contraseña mínimo 6 caracteres', '#EF4444'); return; } CUR.workers.push({ id: workerId, name: name, email: email, pass: pass, phone: phone, spec: spec, photo: photo || '', active: true, commission_services: commSvc, commission_products: commProd, services: [], horario: DEFAULT_HORARIO.map(function (h) { return Object.assign({}, h); }), appointments: [], photos: [], notifications: [], cover: '' }); toast('Trabajador creado', '#22C55E'); }
  fetch('/api/save-worker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upsert', worker: workerDbObj }) }).catch(function (err) { });
  editWorkerId = null; window._barPhoto = null; saveDB(); renderBizWorkers(); closeOv('ov-worker');
  if (typeof posRender === 'function' && G('bp-caja') && G('bp-caja').classList.contains('on')) { posRender(); }
}

function confirmDeleteWorker(id) {
  openConfirmModal('Eliminar trabajador', '¿Estás seguro? Se eliminarán sus citas y datos.', function () {
    if (!CUR) return;
    CUR.workers = (CUR.workers || []).filter(function (w) { return w.id !== id; });
    saveDB(); renderBizWorkers(); toast('Trabajador eliminado', '#475569');
    fetch('/api/save-worker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', worker: { id: id } }) }).catch(function () { });
  });
}

/* ══════════════════════════
   FINANZAS DUEÑO — RENOVADA COMPLETAMENTE
══════════════════════════ */
function renderBizFinances() {
  if (!CUR) return;

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const allAppts = _getAllAppts();
  const active = allAppts.filter(function (a) { return a.status !== 'cancelled'; });
  const paid = allAppts.filter(function (a) { return a.status !== 'cancelled' && a.price > 0; });

  const revHoy = active.filter(function (a) { return a.date === today; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
  const revSem = active.filter(function (a) { return a.date >= weekStartStr; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
  const revMes = active.filter(function (a) { return a.date && a.date.slice(0, 7) === thisMonth; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
  const citHoy = active.filter(function (a) { return a.date === today; }).length;
  const citSem = active.filter(function (a) { return a.date >= weekStartStr; }).length;
  const citMes = active.filter(function (a) { return a.date && a.date.slice(0, 7) === thisMonth; }).length;
  const completadas = allAppts.filter(function (a) { return a.status === 'completed'; }).length;
  const pendientes = allAppts.filter(function (a) { return a.status === 'confirmed' || a.status === 'pending'; }).length;
  const ticket = paid.length ? paid.reduce(function (s, a) { return s + (a.price || 0); }, 0) / paid.length : 0;

  const months = [];
  for (let i = 5; i >= 0; i--) { const dm = new Date(now); dm.setMonth(dm.getMonth() - i); months.push(dm.getFullYear() + '-' + String(dm.getMonth() + 1).padStart(2, '0')); }
  const mVals = months.map(function (m) { return active.filter(function (a) { return a.date && a.date.slice(0, 7) === m; }).reduce(function (s, a) { return s + (a.price || 0); }, 0); });
  const mMax = Math.max.apply(null, mVals.concat([10]));

  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const dw = new Date(now); dw.setDate(now.getDate() - (dayOfWeek + i * 7));
    const wd = new Date(dw); wd.setDate(dw.getDate() - (wd.getDay() === 0 ? 6 : wd.getDay() - 1));
    weeks.push(wd.toISOString().split('T')[0]);
  }
  const wVals = weeks.map(function (ws) {
    const we = new Date(ws); we.setDate(we.getDate() + 6); const weStr = we.toISOString().split('T')[0];
    return active.filter(function (a) { return a.date && a.date >= ws && a.date <= weStr; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
  });
  const wMax = Math.max.apply(null, wVals.concat([10]));

  const workerRows = (CUR.workers || []).map(function (w) {
    const wa = w.appointments || [];
    const wHoy = wa.filter(function (a) { return a.date === today && a.status !== 'cancelled'; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
    const wMes = wa.filter(function (a) { return a.date && a.date.slice(0, 7) === thisMonth && a.status !== 'cancelled'; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
    const wTotal = wa.filter(function (a) { return a.status !== 'cancelled'; }).reduce(function (s, a) { return s + (a.price || 0); }, 0);
    const wCitas = wa.filter(function (a) { return a.status !== 'cancelled'; }).length;
    return { name: w.name, photo: w.photo, hoy: wHoy, mes: wMes, total: wTotal, citas: wCitas };
  });
  workerRows.sort(function (a, b) { return b.mes - a.mes; });

  const svcCount = {}; active.forEach(function (a) { if (a.svc) svcCount[a.svc] = (svcCount[a.svc] || 0) + 1; });
  let topSvc = '—', topC = 0; Object.keys(svcCount).forEach(function (k) { if (svcCount[k] > topC) { topSvc = k; topC = svcCount[k]; } });

  let html = '';

  html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Resumen de hoy</div>';
  html += '<div class="stats2" style="margin-bottom:20px">';
  html += _kpi('Ingresos hoy', money(revHoy), 'var(--green)', citHoy + ' cita' + (citHoy !== 1 ? 's' : ''));
  html += _kpi('Ingresos semana', money(revSem), 'var(--blue)', citSem + ' cita' + (citSem !== 1 ? 's' : ''));
  html += _kpi('Ingresos mes', money(revMes), 'var(--gold)', citMes + ' cita' + (citMes !== 1 ? 's' : ''));
  html += _kpi('Ticket medio', money(ticket), 'var(--purple)', 'por servicio');
  html += '</div>';

  html += '<div class="stats2" style="margin-bottom:20px">';
  html += _kpi('Completadas', completadas, 'var(--green)', 'históricas');
  html += _kpi('Pendientes', pendientes, 'var(--gold)', 'confirmadas o pend.');
  html += _kpi('Servicio top', topSvc.length > 10 ? topSvc.slice(0, 10) + '…' : topSvc, 'var(--blue3)', topC + ' veces');
  html += _kpi('Trabajadores', (CUR.workers || []).length, 'var(--blue)', (CUR.workers || []).filter(function (w) { return w.active; }).length + ' activos');
  html += '</div>';

  html += '<div class="card" style="margin-bottom:16px">';
  html += '<div class="sec-hdr"><span class="sec-ttl">Ingresos por mes</span><span style="font-size:11px;color:var(--muted)">Últimos 6 meses</span></div>';
  html += '<div style="display:flex;align-items:flex-end;gap:5px;height:80px;margin-bottom:6px">';

  let mBarsHTML = '';
  mVals.forEach(function (v, i) {
    const h = Math.max(4, Math.round(v / mMax * 100));
    const isLast = i === mVals.length - 1;
    // ✅ AQUÍ ESTÁ LA CORRECCIÓN: height:100% y justify-content:flex-end
    mBarsHTML += '<div style="flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:3px">';
    if (v > 0) mBarsHTML += '<div style="font-size:8px;color:var(--muted)">' + money(v) + '</div>';
    mBarsHTML += '<div style="width:100%; height:' + h + '%; border-radius:5px 5px 0 0; background:' + (isLast ? 'linear-gradient(to top,var(--blue2),var(--blue3))' : 'linear-gradient(to top,rgba(74,127,212,.3),rgba(74,127,212,.5))') + '" title="' + money(v) + '"></div>';
    mBarsHTML += '</div>';
  });
  html += mBarsHTML;
  html += '</div>';

  html += '<div style="display:flex;gap:5px">';
  let mLabelsHTML = '';
  months.forEach(function (m, i) {
    const p = m.split('-');
    mLabelsHTML += '<div style="flex:1;text-align:center;font-size:9px;color:' + (i === months.length - 1 ? 'var(--blue)' : 'var(--muted)') + ';font-weight:700">' + MONTHS_SHORT[parseInt(p[1]) - 1] + '</div>';
  });
  html += mLabelsHTML;
  html += '</div></div>';

  html += '<div class="card" style="margin-bottom:16px">';
  html += '<div class="sec-hdr"><span class="sec-ttl">Ingresos por semana</span><span style="font-size:11px;color:var(--muted)">Últimas 8 semanas</span></div>';
  html += '<div style="display:flex;align-items:flex-end;gap:5px;height:80px;margin-bottom:6px">';

  let wBarsHTML = '';
  wVals.forEach(function (v, i) {
    const h = Math.max(4, Math.round(v / wMax * 100));
    const isLast = i === wVals.length - 1;
    // ✅ AQUÍ ESTÁ LA CORRECCIÓN
    wBarsHTML += '<div style="flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:3px">';
    if (v > 0) wBarsHTML += '<div style="font-size:8px;color:var(--muted)">' + money(v) + '</div>';
    wBarsHTML += '<div style="width:100%; height:' + h + '%; border-radius:5px 5px 0 0; background:' + (isLast ? 'linear-gradient(to top,#16A34A,#4ADE80)' : 'linear-gradient(to top,rgba(34,197,94,.25),rgba(34,197,94,.5))') + '" title="' + money(v) + '"></div>';
    wBarsHTML += '</div>';
  });
  html += wBarsHTML;
  html += '</div>';

  html += '<div style="display:flex;gap:5px">';
  let wLabelsHTML = '';
  weeks.forEach(function (ws, i) {
    const d = new Date(ws + 'T12:00');
    const lbl = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    wLabelsHTML += '<div style="flex:1;text-align:center;font-size:9px;color:' + (i === weeks.length - 1 ? 'var(--green)' : 'var(--muted)') + ';font-weight:700">' + lbl + '</div>';
  });
  html += wLabelsHTML;
  html += '</div></div>';

  if (workerRows.length) {
    html += '<div class="card" style="margin-bottom:16px">';
    html += '<div class="sec-hdr"><span class="sec-ttl">Rendimiento por trabajador</span></div>';
    html += '<div style="overflow-x:auto">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<thead><tr style="border-bottom:1px solid var(--b)">';
    html += '<th style="text-align:left;padding:8px 6px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">Trabajador</th>';
    html += '<th style="text-align:right;padding:8px 6px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">Hoy</th>';
    html += '<th style="text-align:right;padding:8px 6px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">Este mes</th>';
    html += '<th style="text-align:right;padding:8px 6px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">Total</th>';
    html += '</tr></thead><tbody>';
    workerRows.forEach(function (wr) {
      const av = wr.photo
        ? '<img src="' + safeImg(wr.photo) + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px" alt="Foto">'
        : '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;vertical-align:middle;margin-right:8px">' + san((wr.name || '?').charAt(0).toUpperCase()) + '</div>';
      html += '<tr style="border-bottom:1px solid var(--b)">';
      html += '<td style="padding:10px 6px"><div style="display:flex;align-items:center">' + av + '<span style="font-weight:700">' + san(wr.name) + '</span></div><div style="font-size:10px;color:var(--muted);margin-left:36px">' + wr.citas + ' citas</div></td>';
      html += '<td style="text-align:right;padding:10px 6px;font-weight:700;color:var(--green)">' + money(wr.hoy) + '</td>';
      html += '<td style="text-align:right;padding:10px 6px;font-weight:700;color:var(--blue)">' + money(wr.mes) + '</td>';
      html += '<td style="text-align:right;padding:10px 6px;font-weight:900;color:var(--gold)">' + money(wr.total) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
  }

  if (typeof initBizFinancesPro !== 'function') {
    const el = G('bp-finanzas'); if (el) el.innerHTML = html;
  }

  // Generar historial exclusivamente en su propia pestaña
  const historial = paid.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 100);
  const histHtml = historial.length ? historial.map(function (a) { return apptRowH(a); }).join('') : '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">Sin registros</div>';
  const histEl = G('biz-appts-fin'); if (histEl) histEl.innerHTML = histHtml;
}

/* Helper para crear tarjeta KPI */
function _kpi(label, value, color, sub) {
  return '<div class="sbox">'
    + '<div class="slbl">' + label + '</div>'
    + '<div class="snum" style="color:' + color + ';font-size:20px">' + value + '</div>'
    + (sub ? '<div style="font-size:11px;color:var(--muted);margin-top:4px">' + sub + '</div>' : '')
    + '</div>';
}

/* ══════════════════════════
   CALENDARIO Y AGENDA DUEÑO (Apple-Clean + Zona Horaria Real + Click en Hueco Vacío)
══════════════════════════ */
var AG_PASTEL_PALETTE = ['#9FD8F5', '#F9BD68', '#F59CC3', '#6FD6C8', '#B9B8FF', '#A7F0C0', '#F7E07A', '#F7A59A', '#D6B4F7', '#B8E1FF'];
var _agLastRenderedDate = null;
var _agNowInterval = null;

function _agBizNow() {
  var ctry = (CUR && CUR.country) ? CUR.country : 'ES';
  return typeof ahoraEnNegocio === 'function' ? ahoraEnNegocio(ctry) : new Date();
}

function _agBizTodayStr() {
  var n = _agBizNow();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
}

function _agServiceColor(svcName) {
  var allSvcs = (CUR && CUR.services ? CUR.services : []).slice();
  (CUR && CUR.workers || []).forEach(function (w) {
    (w.services || []).forEach(function (s) { allSvcs.push(s); });
  });
  var match = allSvcs.find(function (s) { return s.name === svcName && s.color && s.color !== '#4A7FD4'; });
  if (match && match.color) return match.color;
  var hash = 0;
  String(svcName || 'Servicio').split('').forEach(function (ch) { hash = ((hash * 31) + ch.charCodeAt(0)) | 0; });
  return AG_PASTEL_PALETTE[Math.abs(hash) % AG_PASTEL_PALETTE.length];
}

function _agMinutesToHM(mins) {
  var h = Math.floor(mins / 60) % 24;
  var m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function _agFormatTime(hm) {
  if (typeof formatHora === 'function' && CUR && CUR.country === 'US') {
    return formatHora(hm, 'US');
  }
  return hm;
}

function renderCalendar() {
  const now = calendarDate, year = now.getFullYear(), month = now.getMonth();
  T('cal-title', MONTHS[month] + ' ' + year);
  const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = _agBizTodayStr();
  const apptDates = {};
  (CUR ? (CUR.workers || []) : []).forEach(function (w) { (w.appointments || []).forEach(function (a) { if (a.date && a.status !== 'cancelled') apptDates[a.date] = true; }); });
  (CUR ? (CUR.appointments || []) : []).forEach(function (a) { if (a.date && a.status !== 'cancelled') apptDates[a.date] = true; });
  let html = '';
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day other-month"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    let cls = 'cal-day';
    if (ds === today) cls += ' today';
    if (ds === selectedCalDay && ds !== today) cls += ' sel';
    if (apptDates[ds]) cls += ' has-appts';
    html += '<div class="' + cls + '" onclick="selectCalDay(\'' + ds + '\')">' + d + '</div>';
  }
  H('cal-grid', html);
}

function toggleAgCalendar() {
  var panel = G('ag-cal-panel');
  var btn = G('ag-cal-toggle-btn');
  if (!panel) return;
  var isOpen = panel.classList.toggle('open');
  if (btn) btn.classList.toggle('active', isOpen);
  if (isOpen) renderCalendar();
}

function agGoToday() {
  var t = _agBizTodayStr();
  selectedCalDay = t;
  calendarDate = new Date(t + 'T12:00:00');
  renderCalendar();
  initAgenda();
}

function agShiftDay(delta) {
  var base = new Date((selectedCalDay || _agBizTodayStr()) + 'T12:00:00');
  base.setDate(base.getDate() + delta);
  var ds = base.getFullYear() + '-' + String(base.getMonth() + 1).padStart(2, '0') + '-' + String(base.getDate()).padStart(2, '0');
  selectCalDay(ds);
}

function selectCalDay(ds) {
  selectedCalDay = ds;
  calendarDate = new Date(ds + 'T12:00:00');
  renderCalendar();
  initAgenda();
}
function prevMonth() { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); }

function _renderAgWeekStrip(dateStr) {
  var strip = G('ag-week-strip');
  if (!strip) return;
  var todayStr = _agBizTodayStr();
  var d0 = new Date(dateStr + 'T12:00:00');
  var offset = (d0.getDay() + 6) % 7; // Lunes = 0
  var dayLetters = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  var apptDates = {};
  (CUR ? (CUR.workers || []) : []).forEach(function (w) {
    (w.appointments || []).forEach(function (a) {
      if (a.date && a.status !== 'cancelled' && (window._currentBizWorkerFilter === 'all' || window._currentBizWorkerFilter === w.id)) {
        apptDates[a.date] = true;
      }
    });
  });
  if (window._currentBizWorkerFilter === 'all') {
    (CUR ? (CUR.appointments || []) : []).forEach(function (a) {
      if (a.date && a.status !== 'cancelled') apptDates[a.date] = true;
    });
  }

  var html = '';
  for (var i = 0; i < 7; i++) {
    var dd = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - offset + i);
    var ds = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
    var cls = 'ag-week-btn' + (ds === dateStr ? ' ag-active' : '') + (ds === todayStr ? ' today' : '');
    html += '<button type="button" class="' + cls + '" onclick="selectCalDay(\'' + ds + '\')">'
      + '<small>' + dayLetters[dd.getDay()] + '</small>'
      + '<strong>' + dd.getDate() + '</strong>'
      + (apptDates[ds] ? '<span class="ag-week-dot"></span>' : '')
      + '</button>';
  }
  strip.innerHTML = html;
}

function _renderAgLegend() {
  var legEl = G('ag-service-legend');
  if (!legEl || !CUR) return;
  var seen = {};
  var items = [];
  (CUR.services || []).forEach(function (s) {
    if (s.active !== false && s.name && !seen[s.name]) { seen[s.name] = true; items.push(s.name); }
  });
  (CUR.workers || []).forEach(function (w) {
    (w.services || []).forEach(function (s) {
      if (s.name && !seen[s.name]) { seen[s.name] = true; items.push(s.name); }
    });
  });
  legEl.innerHTML = items.slice(0, 12).map(function (name) {
    return '<span class="ag-leg-item"><span class="ag-leg-dot" style="background:' + _agServiceColor(name) + '"></span>' + san(name) + '</span>';
  }).join('');
}

function initAgenda() {
  if (!CUR) return;
  if (!selectedCalDay) selectedCalDay = _agBizTodayStr();

  var d = new Date(selectedCalDay + 'T12:00:00');
  var lbl = G('agenda-day-label');
  if (lbl) {
    lbl.textContent = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  }
  var picker = G('ag-date-picker');
  if (picker) picker.value = selectedCalDay;

  var sel = G('ag-worker-filter');
  if (sel) {
    var allW = CUR.workers || [];
    var opts = '<option value="all"' + (window._currentBizWorkerFilter === 'all' ? ' selected' : '') + '>Todo el equipo</option>';
    allW.forEach(function (w) {
      opts += '<option value="' + san(w.id) + '"' + (window._currentBizWorkerFilter === w.id ? ' selected' : '') + '>' + san(w.name) + '</option>';
    });
    sel.innerHTML = opts;
  }

  _renderAgWeekStrip(selectedCalDay);
  _renderAgLegend();
  const listEl = G('biz-agenda-list'); if (listEl) listEl.innerHTML = '';
  renderBizDailyTimeline(selectedCalDay);

  if (!_agNowInterval) {
    _agNowInterval = setInterval(function () {
      var pane = G('bp-agenda');
      if (pane && pane.classList.contains('on') && selectedCalDay === _agBizTodayStr()) {
        renderBizDailyTimeline(selectedCalDay);
      }
    }, 60000);
  }
}

window._currentBizWorkerFilter = 'all';

/* ══════════════════════════════════════════════════
   TIMELINE DE EQUIPO (Estilo Apple/Booksy + Línea Roja en Vivo + Click para Crear Cita)
══════════════════════════════════════════════════ */
function generateBlockedTimeHTML(worker, dateStr, startHour, endHour, pxPerMin) {
  const d = new Date(dateStr + 'T12:00');
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayName = dayNames[d.getDay()];
  const horario = (worker && worker.horario && worker.horario.length) ? worker.horario : (CUR && CUR.horario && CUR.horario.length ? CUR.horario : DEFAULT_HORARIO);
  const hDay = horario.find(function (h) { return h.day === dayName; }) || { open: true, from1: '09:00', to1: '20:00' };
  let html = '', startMinTotal = startHour * 60, endMinTotal = endHour * 60;
  function timeToMins(t) { if (!t) return 0; const p = t.split(':').map(Number); return p[0] * 60 + p[1]; }
  function drawBlock(startM, endM) {
    const ds = Math.max(startM, startMinTotal), de = Math.min(endM, endMinTotal);
    if (ds >= de) return '';
    return '<div class="ag-hatch" style="top:' + ((ds - startMinTotal) * pxPerMin) + 'px;height:' + ((de - ds) * pxPerMin) + 'px;"></div>';
  }
  if (!hDay.open) return drawBlock(startMinTotal, endMinTotal);
  const f1 = timeToMins(hDay.from1 || hDay.from || '09:00'), t1 = timeToMins(hDay.to1 || hDay.to || '20:00');
  html += drawBlock(startMinTotal, f1);
  if (hDay.hasBreak && hDay.from2 && hDay.to2) {
    const f2 = timeToMins(hDay.from2), t2 = timeToMins(hDay.to2);
    html += drawBlock(t1, f2);
    html += drawBlock(t2, endMinTotal);
  } else {
    html += drawBlock(t1, endMinTotal);
  }
  return html;
}

function generateTimelineApptHTML(a, worker, startHour, pxPerMin, idx, clickFn) {
  if (!a.time) return '';
  const pts = a.time.split(':').map(Number);
  const startMin = pts[0] * 60 + pts[1];
  const minsFromStart = startMin - (startHour * 60);
  if (minsFromStart < 0) return '';

  let dur = 30;
  const svcPool = (worker && worker.services ? worker.services : []).concat(CUR && CUR.services ? CUR.services : []);
  const sObj = svcPool.find(function (s) { return s.name === a.svc; });
  if (sObj && sObj.dur) dur = parseInt(sObj.dur, 10) || 30;

  const top = Math.round(minsFromStart * pxPerMin);
  const height = Math.max(Math.round(dur * pxPerMin) - 3, 28);
  const endHM = _agMinutesToHM(startMin + dur);
  const bgColor = _agServiceColor(a.svc);
  const precio = parseFloat(a.price || 0);
  const priceStr = precio > 0 ? money(precio) : '';
  const doneBadge = a.status === 'completed'
    ? '<span class="ag-ev-done" title="Completada"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>'
    : '';

  let inner = '';
  if (height >= 48) {
    inner = '<div class="ag-ev-time">' + san(_agFormatTime(a.time)) + ' – ' + san(_agFormatTime(endHM)) + '</div>'
      + '<div class="ag-ev-client">' + san(a.client || 'Cliente') + '</div>'
      + '<div class="ag-ev-svc">' + san(a.svc || '') + (priceStr ? ' · ' + priceStr : '') + '</div>';
  } else {
    inner = '<div class="ag-ev-client">' + san(_agFormatTime(a.time)) + ' · ' + san(a.client || 'Cliente') + '</div>'
      + '<div class="ag-ev-svc">' + san(a.svc || '') + (priceStr ? ' · ' + priceStr : '') + '</div>';
  }

  return '<div class="ag-ev" onclick="event.stopPropagation();' + clickFn + '(\'' + sanitizeText(a.id) + '\')" style="top:' + (top + 1) + 'px;height:' + height + 'px;background:' + bgColor + ';">'
    + doneBadge + inner + '</div>';
}

function agClickEmptySlot(event, workerId, dateStr) {
  if (!CUR) return;
  var col = event.currentTarget;
  if (!col) return;
  var rect = col.getBoundingClientRect();
  var startHour = 7, endHour = 23, pxPerHour = 84;
  var relY = Math.max(0, event.clientY - rect.top);
  var rawMins = startHour * 60 + Math.floor((relY / pxPerHour) * 60 / 15) * 15;
  var clamped = Math.min(Math.max(rawMins, startHour * 60), endHour * 60 - 15);
  var slotHM = _agMinutesToHM(clamped);

  // Abrir modal de nueva cita pre-llenado con la fecha, hora exacta y profesional
  openApptModal({
    date: dateStr,
    time: slotHM,
    workerId: workerId === '__GENERAL__' ? '' : workerId
  });
}

function renderBizDailyTimeline(dateStr) {
  const container = G('biz-daily-timeline'); if (!container || !CUR) return;

  var prevWrap = container.querySelector('.ag-grid-wrap');
  var keepScroll = (prevWrap && _agLastRenderedDate === dateStr) ? [prevWrap.scrollTop, prevWrap.scrollLeft] : null;

  const startHour = 7, endHour = 23, pxPerHour = 84, pxPerMin = pxPerHour / 60;
  const totalHeight = (endHour - startHour) * pxPerHour;

  const allWorkers = CUR.workers || [];
  let cols = allWorkers.filter(function (w) {
    return window._currentBizWorkerFilter === 'all' || w.id === window._currentBizWorkerFilter;
  }).map(function (w) {
    return {
      id: w.id,
      name: w.name,
      photo: w.photo || '',
      worker: w,
      appts: (w.appointments || []).filter(function (a) { return a.date === dateStr && a.status !== 'cancelled'; })
    };
  });

  // Incluir columna "Servicios Generales" si hay citas sin asignar ese día o si aún no hay trabajadores
  var genAppts = (CUR.appointments || []).filter(function (a) { return a.date === dateStr && a.status !== 'cancelled'; });
  if ((window._currentBizWorkerFilter === 'all' && genAppts.length > 0) || cols.length === 0) {
    cols.push({
      id: '__GENERAL__',
      name: 'Servicios Generales',
      photo: CUR.logo || '',
      worker: null,
      appts: genAppts
    });
  }

  // Hora actual en la zona horaria real del negocio
  var bizNow = _agBizNow();
  var todayStr = _agBizTodayStr();
  var nowMins = (dateStr === todayStr) ? (bizNow.getHours() * 60 + bizNow.getMinutes()) : -1;
  var showNowLine = nowMins >= startHour * 60 && nowMins <= endHour * 60;
  var nowTop = showNowLine ? Math.round((nowMins - startHour * 60) * pxPerMin) : 0;

  var colMinW = cols.length === 1 ? '220px' : '155px';
  var html = '<div class="ag-grid-wrap"><div class="ag-grid" style="grid-template-columns:56px repeat(' + cols.length + ', minmax(' + colMinW + ', 1fr));">';

  // Esquina superior izquierda + cabeceras de trabajadores
  html += '<div class="ag-head-corner"></div>';
  cols.forEach(function (col) {
    var avHtml = col.photo
      ? '<div class="ag-head-av"><img src="' + san(sanitizeImageDataURL(col.photo)) + '" alt=""/></div>'
      : '<div class="ag-head-av">' + san((col.name || '?').charAt(0).toUpperCase()) + '</div>';
    html += '<div class="ag-head">' + avHtml + '<div class="ag-head-name">' + san(col.name) + '</div></div>';
  });

  // Columna de horas sticky izquierda
  html += '<div class="ag-time-col" style="height:' + totalHeight + 'px;">';
  for (let h = startHour + 1; h < endHour; h++) {
    html += '<span class="ag-time-lbl" style="top:' + ((h - startHour) * pxPerHour) + 'px">' + san(_agFormatTime(String(h).padStart(2, '0') + ':00')) + '</span>';
  }
  if (showNowLine) {
    html += '<span class="ag-now-dot" style="top:' + nowTop + 'px"></span>';
  }
  html += '</div>';

  // Columnas de profesionales
  cols.forEach(function (col) {
    html += '<div class="ag-col" style="height:' + totalHeight + 'px;background-size:100% ' + pxPerHour + 'px, 100% ' + (pxPerHour / 4) + 'px;" onclick="agClickEmptySlot(event, \'' + sanitizeText(col.id) + '\', \'' + sanitizeText(dateStr) + '\')">';
    html += generateBlockedTimeHTML(col.worker, dateStr, startHour, endHour, pxPerMin);
    if (showNowLine) {
      html += '<div class="ag-now" style="top:' + nowTop + 'px"></div>';
    }
    col.appts.forEach(function (a, i) {
      html += generateTimelineApptHTML(a, col.worker, startHour, pxPerMin, i, 'openApptDetail');
    });
    html += '</div>';
  });

  html += '</div></div>';
  container.innerHTML = html;

  var wrap = container.querySelector('.ag-grid-wrap');
  if (wrap) {
    if (keepScroll) {
      wrap.scrollTop = keepScroll[0];
      wrap.scrollLeft = keepScroll[1];
    } else {
      var targetMins = showNowLine ? Math.max(startHour * 60, nowMins - 60) : (9 * 60 - 30);
      wrap.scrollTop = Math.max(0, Math.round((targetMins - startHour * 60) * pxPerMin));
    }
  }
  _agLastRenderedDate = dateStr;
}

window.toggleAgCalendar = toggleAgCalendar;
window.agGoToday = agGoToday;
window.agShiftDay = agShiftDay;
window.agClickEmptySlot = agClickEmptySlot;

/* ══════════════════════════
   NUEVA CITA MANUAL (Desde botón o click directo en horario vacío)
══════════════════════════ */
function openApptModal(prefill) {
  if (!CUR) return;
  const bizNow = _agBizNow();
  const defaultDate = (prefill && prefill.date) || selectedCalDay || _agBizTodayStr();
  const defaultTime = (prefill && prefill.time) || (String(bizNow.getHours()).padStart(2, '0') + ':' + String(Math.floor(bizNow.getMinutes() / 15) * 15).padStart(2, '0'));
  const prefillWorkerId = (prefill && prefill.workerId !== undefined) ? prefill.workerId : '';

  const dateEl = G('ap-date'), timeEl = G('ap-time'), nameEl = G('ap-name'), phoneEl = G('ap-phone'), notesEl = G('ap-notes');
  if (dateEl) dateEl.value = defaultDate;
  if (timeEl) timeEl.value = defaultTime;
  if (nameEl) nameEl.value = '';
  if (phoneEl) phoneEl.value = '';
  if (notesEl) notesEl.value = '';

  const svcSel = G('ap-svc');
  if (svcSel) {
    let opts = '';
    const genSvcs = (CUR.services || []).filter(function (s) { return s.active !== false; });
    if (genSvcs.length > 0) {
      opts += '<optgroup label="Servicios generales">';
      genSvcs.forEach(function (s) {
        opts += '<option value="' + san(s.name) + '|||' + (parseFloat(s.price) || 0) + '|||">' + san(s.name) + ' (' + money(s.price) + ')</option>';
      });
      opts += '</optgroup>';
    }
    (CUR.workers || []).forEach(function (w) {
      if ((w.services || []).length > 0) {
        opts += '<optgroup label="' + san(w.name) + '">';
        w.services.forEach(function (s) {
          opts += '<option value="' + san(s.name) + '|||' + (parseFloat(s.price) || 0) + '|||' + sanitizeText(w.id) + '">' + san(s.name) + ' (' + money(s.price) + ')</option>';
        });
        opts += '</optgroup>';
      }
    });
    svcSel.innerHTML = opts || '<option value="">Añade servicios en Caja o Equipo</option>';
  }

  const barSel = G('ap-bar');
  if (barSel) {
    barSel.innerHTML = '<option value="">Servicios Generales (sin asignar)</option>'
      + (CUR.workers || []).map(function (w) {
        return '<option value="' + sanitizeText(w.id) + '"' + (w.id === prefillWorkerId ? ' selected' : '') + '>' + san(w.name) + '</option>';
      }).join('');
  }
  openOv('ov-appt');
  setTimeout(function () { if (nameEl) nameEl.focus(); }, 180);
}

async function saveAppt() {
  const name = sanitizeText(V('ap-name')), phone = sanitizeText(V('ap-phone'));
  const date = V('ap-date'), time = V('ap-time'), svcRaw = V('ap-svc'), workerId = V('ap-bar'), status = V('ap-status') || 'confirmed', notes = sanitizeText(V('ap-notes'));
  if (!name) { toast('Nombre del cliente requerido', '#EF4444'); return; }
  if (!date || !time) { toast('Fecha y hora requeridas', '#EF4444'); return; }
  if (!svcRaw) { toast('Selecciona un servicio', '#EF4444'); return; }
  if (!CUR) return;

  const parts = svcRaw.indexOf('|||') >= 0 ? svcRaw.split('|||') : svcRaw.split(',');
  const svcName = parts[0];
  const svcPrice = safeNum(parts[1], 0);
  const w = workerId ? (CUR.workers || []).filter(function (x) { return x.id === workerId; })[0] : null;
  const apptId = String(Date.now());
  const token = 'tk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  const appt = {
    id: apptId,
    client: name,
    phone: phone,
    email: '',
    svc: svcName,
    workerName: w ? w.name : 'Servicios Generales',
    workerId: w ? w.id : '',
    date: date,
    time: time,
    price: svcPrice,
    status: status,
    notes: notes,
    token: token
  };

  try {
    const syncRes = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'appointments',
        business_id: CUR.id,
        appointments: [{
          id: apptId,
          business_id: CUR.id,
          worker_id: w ? w.id : null,
          client_id: '',
          client_name: name,
          client_phone: phone,
          client_email: '',
          token: token,
          notes: notes,
          service_name: svcName,
          service_price: svcPrice,
          date: date,
          time: time,
          status: status
        }]
      })
    });
    if (!syncRes.ok) {
      const errData = await syncRes.json().catch(function () { return {}; });
      const msg = (errData.errors && errData.errors[0] && errData.errors[0].msg) || errData.error || 'Ese horario ya está ocupado';
      toast(msg, '#EF4444');
      return;
    }
  } catch (e) {
    console.error('Error sincronizando nueva cita:', e);
  }

  if (w) {
    if (!w.appointments) w.appointments = [];
    w.appointments.push(appt);
  } else {
    if (!CUR.appointments) CUR.appointments = [];
    CUR.appointments.push(appt);
  }

  if (phone && typeof syncClientToCloud === 'function') {
    syncClientToCloud(CUR.id, { name: name, phone: phone, email: '' });
  }

  try { localStorage.setItem(DBKEY, JSON.stringify(DB)); } catch (e) {}
  selectedCalDay = date;
  calendarDate = new Date(date + 'T12:00:00');
  closeOv('ov-appt');
  renderCalendar();
  initAgenda();
  renderBizFinances();
  toast('Cita guardada', '#22C55E');
}

/* ══════════════════════════
   PERFIL BARBERÍA
══════════════════════════ */
function saveBizProfile() {
  saveBizProfileAsync();
}
async function saveBizProfileAsync() {
  if (!CUR) return;
  const nm = sanitizeText(V('pf-nm')), addr = sanitizeText(V('pf-addr')), phone = sanitizeText(V('pf-phone')), desc = sanitizeText(V('pf-desc'));
  const insta = sanitizeText(V('pf-insta')), facebook = sanitizeText(V('pf-facebook')), x_url = sanitizeText(V('pf-xurl')), tiktok = sanitizeText(V('pf-tiktok'));
  if (!nm) { toast('El nombre no puede estar vacío', '#EF4444'); return; }

  // 1. Guardado Inmediato de Textos (Cero esperas)
  CUR.name = nm; CUR.addr = addr; CUR.phone = phone; CUR.desc = desc.slice(0, 300);
  CUR.insta = insta; CUR.facebook = facebook; CUR.x_url = x_url; CUR.tiktok = tiktok;

  const tglLoyalty = G('toggle-loyalty');
  const loyMode = (G('pf-loyalty-mode') && G('pf-loyalty-mode').value === 'points') ? 'points' : 'stamps';
  const stmps = safeInt(V('pf-loyalty-stamps'), 10);
  const ptsGoal = safeInt(V('pf-loyalty-pts'), 100);
  const rewType = (G('pf-loyalty-reward') && G('pf-loyalty-reward').value) || 'free_service';
  const rewPct = rewType === 'free_service' ? 100 : Math.min(100, Math.max(1, safeInt(V('pf-loyalty-pct'), 50)));
  const prodSel = G('pf-loyalty-prod');
  const rewProdId = prodSel ? String(prodSel.value || '').trim() : '';
  const rewProdName = (prodSel && prodSel.selectedIndex >= 0 && prodSel.options[prodSel.selectedIndex])
    ? String(prodSel.options[prodSel.selectedIndex].getAttribute('data-name') || '').trim()
    : '';

  CUR.loyalty = {
    active: Boolean(tglLoyalty && tglLoyalty.classList.contains('on')),
    mode: loyMode,
    stamps: stmps > 1 ? stmps : 10,
    points_goal: ptsGoal >= 10 ? ptsGoal : 100,
    reward_type: rewType,
    reward_pct: rewPct,
    reward_product_id: rewProdId,
    reward_product_name: rewProdName
  };
  if (typeof POS_STATE !== 'undefined' && POS_STATE && typeof normalizeLoyaltyConfig === 'function') {
    POS_STATE.loyalty = normalizeLoyaltyConfig(CUR.loyalty);
  }
  if (CUR.id) {
    fetch('/api/pos/loyalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: CUR.id, loyalty: CUR.loyalty })
    }).catch(function () {});
  }

  saveDB(); 
  toast('Perfil guardado', '#4A7FD4');

  // 2. Subida en Segundo Plano (Upload silencioso)
  if (window._pendingBizLogo || window._pendingBizCover) {

    if (window._pendingBizLogo) {
      const av = G('biz-hdr-av');
      const p = G('biz-profile-logo');
      const fileToUpload = window._pendingBizLogo;
      window._pendingBizLogo = null; 
      
      processImageForUpload(fileToUpload)
        .then(opt => uploadToImgBB(opt))
        .then(url => { 
          if (url) { 
            CUR.logo = url; 
            saveDB(); 
            // Actualizar visualmente por si acaso
            if (av) av.innerHTML = '<img src="' + safeImg(url) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">';
            if (p) p.innerHTML = '<img src="' + safeImg(url) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">';
            toast('Logo guardado en la nube', '#10B981');
          }
        });
    }
    
    if (window._pendingBizCover) {
      const fileToUpload = window._pendingBizCover;
      window._pendingBizCover = null;
      
      processImageForUpload(fileToUpload)
        .then(opt => uploadToImgBB(opt))
        .then(url => { 
          if (url) { 
            CUR.cover = url; 
            saveDB(); 
            toast('Portada guardada en la nube', '#10B981');
          }
        });
    }
  }
}
// ══════════════════════════════════════════════════════════════
  //  INTEGRACIÓN DE PAGOS - DODOPAYMENTS (PLAY STORE FRIENDLY)

function configurarBotonesDePago() {
  // Asegurarnos de que el negocio está cargado
  if (!CUR || !CUR.id) return;

  // 1. Obtenemos el país exacto usando tu función global (o el guardado en base de datos)
  const pais = typeof getPaisActivo === 'function' ? getPaisActivo() : (CUR.country || 'GLOBAL');

  

  // 4. Elegimos el set de links y textos correctos
  
  const linksDodo = window.LINKS_DODO || {};
  var linksActuales = linksDodo[pais] || linksDodo['GLOBAL'];

  // 5. Actualizamos los textos visuales en el HTML
  var txtM = document.getElementById('txt-precio-mensual');
  var txtT = document.getElementById('txt-precio-trimestral');
  var txtA = document.getElementById('txt-precio-anual');

  // (Removido: config-pais.js ya lo hace)
  // (Removido: config-pais.js ya lo hace)
  // (Removido: config-pais.js ya lo hace)

  // 6. El truco maestro: Le pegamos el ID de tu base de datos al final del link
  var returnUrlObj = new URL(window.location.href);
  returnUrlObj.searchParams.set('payment_success', '1');
  var parametroMagico = "?metadata_bizId=" + CUR.id + "&redirect_url=" + encodeURIComponent(returnUrlObj.toString());

  // 7. Seleccionamos los botones del HTML e inyectamos los links (Con inteligencia de Fallback)
  var btnM = document.getElementById('btn-mensual');
  var btnT = document.getElementById('btn-trimestral');
  var btnA = document.getElementById('btn-anual');

  if (btnM) { 
    // Si el link tiene la palabra "LINK_", usa el global. Si no, usa el del país.
    var finalLinkM = linksActuales.mensual.includes("LINK_") ? linksDodo['GLOBAL'].mensual : linksActuales.mensual;
    btnM.href = finalLinkM + parametroMagico; 
    btnM.target = "_blank"; 
  }
  if (btnT) { 
    var finalLinkT = linksActuales.trimestral.includes("LINK_") ? linksDodo['GLOBAL'].trimestral : linksActuales.trimestral;
    btnT.href = finalLinkT + parametroMagico; 
    btnT.target = "_blank"; 
  }
  if (btnA) { 
    var finalLinkA = linksActuales.anual.includes("LINK_") ? linksDodo['GLOBAL'].anual : linksActuales.anual;
    btnA.href = finalLinkA + parametroMagico; 
    btnA.target = "_blank"; 
  }

  // 8. Lógica de UI: Inteligencia de Fechas y Planes
  var upgradeBox = document.getElementById('upgrade-options');
  var planStatus = document.getElementById('pf-plan-status');
  var planBadge = document.getElementById('pf-plan-badge');

  if (CUR.plan === 'active' || CUR.plan === 'pro') {
    if (upgradeBox) upgradeBox.style.display = 'none';
    var inicio = CUR.join_date ? CUR.join_date : 'Inicio';
    var fin = CUR.expires_at ? CUR.expires_at : 'Renovación automática';
    if (planStatus) planStatus.innerHTML = '<span style="color:var(--text);font-weight:bold;">SaaS Pro</span> <span style="font-size:12px;color:var(--muted)">(' + inicio + ' al ' + fin + ')</span>';
    if (planBadge) {
      planBadge.textContent = 'ACTIVO';
      planBadge.style.background = 'rgba(34,197,94,0.1)';
      planBadge.style.color = 'var(--green)';
    }
  } else if (CUR.plan === 'expired') {
    if (upgradeBox) upgradeBox.style.display = 'block'; 
    if (planStatus) planStatus.innerHTML = '<span style="color:var(--text);font-weight:bold;">SaaS Free</span> <span style="font-size:12px;color:var(--red)">(Suscripción Vencida. Por favor, renueva tu plan.)</span>';
    if (planBadge) {
      planBadge.textContent = 'VENCIDO';
      planBadge.style.background = 'rgba(239,68,68,0.1)';
      planBadge.style.color = 'var(--red)';
    }
  } else if (CUR.plan === 'trial') {
    if (upgradeBox) upgradeBox.style.display = 'block'; 
    const finPrueba = CUR.expires_at ? CUR.expires_at : 'Pronto';
    if (planStatus) planStatus.innerHTML = '<span style="color:var(--text);font-weight:bold;">SaaS Free</span> <span style="font-size:12px;color:var(--gold)">(Prueba gratuita hasta el ' + finPrueba + ')</span>';
    if (planBadge) {
      planBadge.textContent = 'TRIAL';
      planBadge.style.background = 'rgba(245,158,11,0.1)';
      planBadge.style.color = 'var(--gold)';
    }
  }

/* ══════════════════════════
   INICIO DE SESIÓN CON GOOGLE (Registro)
══════════════════════════ */
window.startGoogleRegistration = function(email, name) {
  _rmData = { email: email, pass: 'GoogleOauth123!', phone: '', referred_by_code: null };
  closeOv('ov-login');
  closeOv('ov-registro');
  if (typeof toast === 'function') toast('¡Bienvenido! Completa tu perfil para continuar', '#4A7FD4');
  
  goBiz();
  setTimeout(function() {
    bizRegStep(2);
    const em = G('br-email'); if (em) em.value = email || '';
    const nm = G('br-name'); if (nm && name) nm.value = name;
  }, 400);
};}

window.syncProfileLoyaltyFields = function () {
  var mode = G('pf-loyalty-mode') ? G('pf-loyalty-mode').value : 'stamps';
  var rew = G('pf-loyalty-reward') ? G('pf-loyalty-reward').value : 'free_service';
  if (G('pf-loyalty-stamps-wrap')) G('pf-loyalty-stamps-wrap').style.display = mode === 'stamps' ? '' : 'none';
  if (G('pf-loyalty-pts-wrap')) G('pf-loyalty-pts-wrap').style.display = mode === 'points' ? '' : 'none';
  if (G('pf-loyalty-pct-wrap')) G('pf-loyalty-pct-wrap').style.display = rew === 'discount_pct' ? '' : 'none';
  if (G('pf-loyalty-prod-wrap')) G('pf-loyalty-prod-wrap').style.display = rew === 'free_product' ? '' : 'none';
};

window.populateProfileLoyaltyProducts = function (selectedId, fallbackName) {
  var sel = G('pf-loyalty-prod');
  if (!sel) return;
  var prods = (typeof POS_STATE !== 'undefined' && POS_STATE && Array.isArray(POS_STATE.products) && POS_STATE.products.length)
    ? POS_STATE.products
    : [];
  if (!prods.length && CUR && CUR.id) {
    fetch('/api/pos/state?business_id=' + encodeURIComponent(CUR.id) + '&date=' + encodeURIComponent(typeof hoyEnNegocio === 'function' ? hoyEnNegocio() : new Date().toISOString().slice(0, 10)), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !Array.isArray(d.products)) return;
        if (typeof POS_STATE !== 'undefined' && POS_STATE) POS_STATE.products = d.products;
        window.populateProfileLoyaltyProducts(selectedId, fallbackName);
      }).catch(function () {});
  }
  var activeProds = prods.filter(function (p) { return p.active !== false; });
  if (!activeProds.length) {
    sel.innerHTML = selectedId
      ? '<option value="' + san(selectedId) + '" data-name="' + san(fallbackName || 'Producto') + '">' + san(fallbackName || 'Producto seleccionado') + '</option>'
      : '<option value="" data-name="">Añade productos en Tienda primero</option>';
    return;
  }
  sel.innerHTML = '<option value="" data-name="">Selecciona un producto...</option>' + activeProds.map(function (p) {
    var isSel = String(p.id) === String(selectedId || '');
    return '<option value="' + san(p.id) + '" data-name="' + san(p.name) + '"' + (isSel ? ' selected' : '') + '>' + san(p.name) + ' (stock: ' + (p.stock || 0) + ')</option>';
  }).join('');
};
