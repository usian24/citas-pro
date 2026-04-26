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
  var inputUser = V('li-email').trim();
  var pass      = V('li-pass');
  hideErr('li-err');

  // Quitamos la validación estricta de email para que acepte "lucian@admin" sin problemas
  if(!inputUser) { showErr('li-err','Introduce tu usuario o correo.'); return; }
  if(!pass)      { showErr('li-err','Introduce tu contraseña.'); return; }

  var inputLower = inputUser.toLowerCase(); 
  var key = 'login_' + inputLower;
  if(!checkRateLimit(key)) { showErr('li-err','Demasiados intentos. Espera 5 minutos.'); return; }

  try {
    var btn = G('li-btn-login');
    var originalText = btn ? btn.textContent : 'Acceder';
    if(btn) btn.textContent = 'Verificando...';

    // 1 — Intentar Login como Dueño o Trabajador a través de la API
    let res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inputLower, password: pass })
    });

    if (res.ok) {
      if(btn) btn.textContent = originalText;
      let data = await res.json();
      resetRateLimit(key);

      if (data.type === 'business') {
        var biz = data.biz;
        DB.currentBiz    = biz.id;
        DB.currentWorker = null;
        saveDB();
        closeOv('ov-login');
        toast('Bienvenido/a ' + san(biz.name || biz.owner || ''), '#22C55E');
        // Obligamos a descargar los datos privados del negocio antes de redirigir
        if (typeof forceCloudSync === 'function') await forceCloudSync();
        setTimeout(function(){ goBiz(); }, 300);
        return;
      } 
      else if (data.type === 'worker') {
        var worker = data.worker;
        DB.currentWorker = { bizId: worker.business_id, workerId: worker.id };
        DB.currentBiz    = null;
        saveDB();
        closeOv('ov-login');
        toast('Bienvenido/a ' + san(worker.name), '#22C55E');
        if (typeof forceCloudSync === 'function') await forceCloudSync();
        setTimeout(function(){ goWorker(); }, 300);
        return;
      }
    }

    // 2 — Si falló, intentar Login como SUPER ADMIN a través de la API
    let adminRes = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: inputLower, password: pass })
    });
    
    if(btn) btn.textContent = originalText;

    if (adminRes.ok) {
       let data = await adminRes.json();
       if (data.token) localStorage.setItem('citaspro_admin_token', data.token);
       resetRateLimit(key); 
       DB.admin.auth = true; 
       saveDB(); 
       closeOv('ov-login');
       toast('Bienvenido, Super Admin', '#4A7FD4');
       if (typeof forceCloudSync === 'function') await forceCloudSync();
       setTimeout(function(){
           showAdminPanel();
           if (typeof connectRealtimeForCurrentUser === 'function') connectRealtimeForCurrentUser();
       }, 300);
       return;
    }

    // 3 — Si ninguno funcionó
    showErr('li-err','Email o contraseña incorrectos.');
    var p = G('li-pass'); if(p) p.value='';

  } catch (error) {
     console.error('Error al intentar login:', error);
     var btn = G('li-btn-login');
     if(btn) btn.textContent = 'Acceder';
     showErr('li-err','Error de red. Inténtalo de nuevo.');
  }
}

/* ══════════════════════════
   REDIRECCIÓN SUPER ADMIN
══════════════════════════ */
window.showAdminPanel = function() {
  // 1. Cambiamos la pantalla a s-admin
  if (typeof goTo === 'function') goTo('s-admin');
  
  // 2. Ocultamos el viejo login negro y mostramos el panel real
  var l = G('adm-login'), p = G('adm-panel');
  if (l) l.style.display = 'none';
  if (p) p.style.display = 'block';
  
  // 3. Renderizamos datos (con validación por si admin.js carga un milisegundo después)
  if (typeof renderDash === 'function') renderDash();
  if (typeof checkNotifications === 'function') checkNotifications();
};

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
/* ══════════════════════════
   SISTEMA DE PAGOS Y BLOQUEO
══════════════════════════ */
function isBizExpired(biz) {
   if (biz.plan === 'expired') return true; // Bloqueado manualmente
   if (biz.expires_at) {
       var exp = new Date(biz.expires_at + 'T23:59:59');
       var now = new Date();
       if (now > exp) return true; // El tiempo se agotó
   }
   return false;
}

function showPaywall(bizName) {
    closeOv('ov-login');
    var div = document.createElement('div');
    div.id = 'dynamic-paywall';
    div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
    
    // AQUÍ CAMBIA EL NÚMERO DE WHATSAPP POR EL TUYO
    var tuNumeroWhatsApp = "953767924"; 
    
    div.innerHTML = `
        <div style="background:#07090F;border:1px solid rgba(74,127,212,.3);border-radius:24px;padding:30px;max-width:400px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.5)">
            <div style="font-size:40px;margin-bottom:15px">⏳</div>
            <div style="font-size:20px;font-weight:900;margin-bottom:10px;color:white;">Suscripción Vencida</div>
            <div style="color:var(--t2);font-size:14px;line-height:1.6;margin-bottom:24px">
                El plan de <b>${san(bizName)}</b> ha expirado o está suspendido. Para seguir gestionando tus citas, profesionales y clientes sin interrupciones, comunícate con nosotros para activar tu plan.
            </div>
            <a href="https://wa.me/${tuNumeroWhatsApp}?text=Hola,%20quiero%20renovar%20el%20plan%20de%20mi%20barbería:%20${encodeURIComponent(bizName)}" target="_blank" style="display:block;text-decoration:none">
                <button style="width:100%;background:#22C55E;color:white;border:none;padding:16px;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Renovar por WhatsApp
                </button>
            </a>
            <button onclick="document.getElementById('dynamic-paywall').remove()" style="margin-top:16px;background:none;border:none;color:var(--muted);font-size:13px;cursor:pointer">Volver al inicio</button>
        </div>
    `;
    document.body.appendChild(div);
}