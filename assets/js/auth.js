'use strict';

/* ══════════════════════════════════════════════════
   AUTH.JS — Login unificado: dueño + trabajadores
   Orden de búsqueda:
   1. Super Admin
   2. Dueño de negocio
   3. Trabajador dentro de un negocio
══════════════════════════════════════════════════ */

/* ── Abrir modal login ── */
function openLoginModal() {
  var em = G('li-email'), ps = G('li-pass');
  if(em) em.value=''; if(ps) ps.value='';
  hideErr('li-err');
  closeOv('ov-registro');
  openOv('ov-login');
  setTimeout(function(){ var e=G('li-email'); if(e) e.focus(); }, 250);
}

/* ── Login principal (Unificado) ── */
async function doLogin() {
  var email = V('li-email').trim().toLowerCase();
  var pass  = V('li-pass');
  hideErr('li-err');

  if(!email || !validEmail(email)) { showErr('li-err','Introduce un correo electrónico válido.'); return; }
  if(!pass)                        { showErr('li-err','Introduce tu contraseña.'); return; }

  var key = 'login_' + email;
  if(!checkRateLimit(key)) { showErr('li-err','Demasiados intentos. Espera 5 minutos.'); return; }

  /* 1 — Buscar como dueño de negocio (Local) */
  var biz = DB.businesses.filter(function(b){
    return (b.email||'').toLowerCase() === email && ((b.pass || b.password || '') === pass);
  })[0];

  if(biz) {
    resetRateLimit(key);
    if(biz.plan === 'expired') { showErr('li-err','Tu suscripción ha vencido. Contacta soporte.'); return; }
    DB.currentBiz    = biz.id;
    DB.currentWorker = null;
    saveDB();
    closeOv('ov-login');
    toast('Bienvenido/a ' + san(biz.owner || biz.name), '#22C55E');
    setTimeout(function(){ goBiz(); }, 300);
    return;
  }

  /* 2 — Buscar como trabajador (Local) */
  var foundWorker = null, foundBiz = null;
  DB.businesses.forEach(function(b) {
    (b.workers||[]).forEach(function(w) {
      if((w.email||'').toLowerCase() === email && ((w.pass || w.password || '') === pass) && w.active) {
        foundWorker = w;
        foundBiz    = b;
      }
    });
  });

  if(foundWorker) {
    resetRateLimit(key);
    if(foundBiz.plan === 'expired') { showErr('li-err','La barbería tiene suscripción vencida.'); return; }
    DB.currentWorker = { bizId: foundBiz.id, workerId: foundWorker.id };
    DB.currentBiz    = null;
    saveDB();
    closeOv('ov-login');
    toast('Bienvenido/a ' + san(foundWorker.name), '#22C55E');
    setTimeout(function(){ goWorker(); }, 300);
    return;
  }

  /* 3 — Buscar como SUPER ADMIN en Supabase (API) */
  try {
    var btn = G('li-btn-login');
    var originalText = btn ? btn.textContent : 'Acceder';
    if(btn) btn.textContent = 'Verificando...';

    // Llamamos a tu endpoint de login de admin (ajusta la ruta si se llama diferente)
    var resp = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password: pass }) 
    });
    
    var data = await resp.json();
    if(btn) btn.textContent = originalText;

    if (data.success) {
       resetRateLimit(key);
       closeOv('ov-login');
       toast('Bienvenido, Super Admin', '#4A7FD4');
       
       // Aquí redirigimos a la pantalla de admin. 
       // Ajusta "goTo('s-admin')" según cómo llamabas a tu panel de admin antes.
       setTimeout(function(){
           goTo('s-admin'); // <-- Cambia esto si tu función para abrir el panel maestro se llama distinto (ej. initAdmin())
       }, 300);
       return;
    }
  } catch (e) {
     console.error('Error al intentar login de admin:', e);
     var btn = G('li-btn-login');
     if(btn) btn.textContent = 'Acceder';
  }

  /* 4 — Si nada funcionó: Credenciales incorrectas */
  showErr('li-err','Email o contraseña incorrectos.');
  var p = G('li-pass'); if(p) p.value='';
}

/* ── Logout dueño ── */
function bizLogout() {
  openConfirmModal(
    'Cerrar sesión',
    '¿Estás seguro de que quieres cerrar sesión?',
    function() {
      DB.currentBiz = null;
      DB.currentWorker = null;
      saveDB();
      CUR = null;
      goTo('s-portal');
    }
  );
}

/* ── Logout trabajador ── */
function workerLogout() {
  openConfirmModal(
    'Cerrar sesión',
    '¿Estás seguro de que quieres cerrar sesión?',
    function() {
      DB.currentWorker = null;
      saveDB();
      CUR_WORKER = null;
      goTo('s-portal');
    }
  );
}

/* ══════════════════════════
   MODAL CONFIRMACIÓN GENÉRICO
══════════════════════════ */
var _confirmCallback = null;

function openConfirmModal(title, msg, onConfirm) {
  _confirmCallback = onConfirm;
  var t = G('confirm-title'), m = G('confirm-msg');
  if(t) t.textContent = title;
  if(m) m.textContent = msg;
  openOv('ov-confirm');
}

function confirmOk() {
  closeOv('ov-confirm');
  if(typeof _confirmCallback === 'function') _confirmCallback();
  _confirmCallback = null;
}

function confirmCancel() {
  closeOv('ov-confirm');
  _confirmCallback = null;
}

/* ══════════════════════════
   MODAL: RECUPERAR CONTRASEÑA
══════════════════════════ */
function openForgotModal() {
  var em = G('fp-email'); if(em) em.value='';
  hideErr('fp-err');
  var suc = G('fp-success'); if(suc) suc.style.display='none';
  var btn = G('fp-btn-send'); if(btn) btn.style.display='block';
  closeOv('ov-login');
  openOv('ov-forgot');
  setTimeout(function(){ var e=G('fp-email'); if(e) e.focus(); }, 250);
}

function doForgot() {
  var email = V('fp-email').trim().toLowerCase();
  hideErr('fp-err');
  if(!email || !validEmail(email)) { showErr('fp-err','Introduce un correo electrónico válido.'); return; }

  /* Buscar en dueños y en trabajadores */
  var found = DB.businesses.filter(function(b){ return (b.email||'').toLowerCase()===email; })[0];
  if(!found) {
    DB.businesses.forEach(function(b){
      (b.workers||[]).forEach(function(w){ if((w.email||'').toLowerCase()===email) found=w; });
    });
  }
  if(!found) { showErr('fp-err','No encontramos ninguna cuenta con ese correo.'); return; }

  /* ✅ CORREGIDO: busca la contraseña en "pass" O en "password" (evita "undefined") */
  var actualPassword = found.pass || found.password || '(no disponible)';

  fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'password_reset',
      to: email,
      data: { password: actualPassword }
    })
  }).catch(function(e) { console.error('Error enviando correo de recuperación:', e); });

  var suc = G('fp-success'); if(suc) suc.style.display='block';
  var btn = G('fp-btn-send'); if(btn) btn.style.display='none';
  toast('Instrucciones enviadas a ' + email, '#4A7FD4');
}

/* ══════════════════════════
   PASSWORD EYE TOGGLE (SVG profesional)
══════════════════════════ */
var EYE_OPEN  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
var EYE_CLOSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function toggleEye(inputId, btnId) {
  var inp = G(inputId), btn = G(btnId);
  if(!inp || !btn) return;
  btn.innerHTML = EYE_OPEN;
  btn.addEventListener('click', function() {
    var isPass = inp.type === 'password';
    inp.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass ? EYE_CLOSE : EYE_OPEN;
    inp.focus();
  });
}

function initAllEyeToggles() {
  var pairs = [
    ['adm-pass',   'adm-pass-eye'],
    ['dots-pass',  'dots-pass-eye'],
    ['br-pass',    'br-pass-eye'],
    ['rm-pass',    'rm-pass-eye'],
    ['li-pass',    'li-pass-eye'],
    ['wk-pass-new','wk-pass-eye'],
    ['wf-pass',    'wf-pass-eye']
  ];
  pairs.forEach(function(p){ toggleEye(p[0],p[1]); });
}