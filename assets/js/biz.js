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
  fetch('/.netlify/functions/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'verification', to: email, data: { code: _rmCode } })
  }).catch(function(e) { console.error('Error enviando email:', e); });
  toast('Código enviado a ' + email, '#4A7FD4');
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
  toast('Email verificado correctamente', '#22C55E');
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
  fetch('/.netlify/functions/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'verification', to: _rmData.email, data: { code: _rmCode } })
  }).catch(function(e) { console.error(e); });
  toast('Nuevo código enviado a ' + _rmData.email, '#4A7FD4');
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
   BIZ PANEL — REGISTRO
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
    // Ya no requerimos servicios en el paso 6, porque ahora el paso 6 es el de éxito
    if (n === 6) finalizeBizReg();
  }
  showRegStep(n);
}

function selType(id, type) { document.querySelectorAll('.typbtn').forEach(function(b) { b.classList.remove('sel'); }); var b = G(id); if (b) b.classList.add('sel'); REG.type = type; }
function selSize(id, size) { document.querySelectorAll('.szopt').forEach(function(b) { b.classList.remove('sel'); }); var o = G(id); if (o) o.classList.add('sel'); REG.teamSize = size; }

function updatePassStrength(pass) {
  var s = passStrength(pass);
  var bar = G('pass-strength'), lbl = G('pass-strength-lbl');
  var configs = [{c:'#EF4444',t:'Muy débil',w:'20%'},{c:'#EF4444',t:'Débil',w:'40%'},{c:'#F59E0B',t:'Regular',w:'60%'},{c:'#22C55E',t:'Buena',w:'80%'},{c:'#22C55E',t:'Muy segura',w:'100%'}];
  var cfg = configs[Math.min(s, 4)];
  if (bar) { bar.style.background = cfg.c; bar.style.width = pass.length ? cfg.w : '0%'; }
  if (lbl) { lbl.textContent = pass.length ? cfg.t : ''; lbl.style.color = cfg.c; }
}

function updateRmPassStrength(pass) {
  var s = passStrength(pass);
  var bar = G('rm-pass-bar'), lbl = G('rm-pass-lbl');
  var configs = [{c:'#EF4444',t:'Muy débil',w:'20%'},{c:'#EF4444',t:'Débil',w:'40%'},{c:'#F59E0B',t:'Regular',w:'60%'},{c:'#22C55E',t:'Buena',w:'80%'},{c:'#22C55E',t:'Muy segura',w:'100%'}];
  var cfg = configs[Math.min(s, 4)];
  if (bar) { bar.style.background = cfg.c; bar.style.width = pass.length ? cfg.w : '0%'; }
  if (lbl) { lbl.textContent = pass.length ? cfg.t : ''; lbl.style.color = cfg.c; }
}

function setupPhotoUpload() {
  function handleImg(inputId, onLoad) {
    var el = G(inputId); if (!el) return;
    var fresh = el.cloneNode(true);
    el.parentNode.replaceChild(fresh, el);
    fresh.addEventListener('change', function(e) {
      var f = e.target.files[0];
      if (!f || !validImageType(f)) { toast('Solo JPG/PNG/WebP (máx 5MB)', '#EF4444'); return; }
      var r = new FileReader();
      r.onload = function(ev) { var d = sanitizeImageDataURL(ev.target.result); if (d) onLoad(d); };
      r.readAsDataURL(f);
    });
  }
  function handleImgs(inputId, onLoad) {
    var el = G(inputId); if (!el) return;
    var fresh = el.cloneNode(true);
    el.parentNode.replaceChild(fresh, el);
    fresh.addEventListener('change', function(e) {
      Array.from(e.target.files).forEach(function(f) {
        if (!validImageType(f)) return;
        var r = new FileReader();
        r.onload = function(ev) { var d = sanitizeImageDataURL(ev.target.result); if (d) onLoad(d); };
        r.readAsDataURL(f);
      });
    });
  }

  handleImg('logo-input', function(d) {
    if (!REG) return;
    REG.logo = d;
    var p = G('logo-preview');
    if (p) { p.style.backgroundImage='url('+d+')'; p.style.backgroundSize='cover'; p.style.backgroundPosition='center'; p.innerHTML=''; }
  });

  handleImgs('svc-photo-input', function(d) {
    if (!REG) return;
    if (REG.photos.length >= 12) { toast('Máximo 12 fotos', '#EF4444'); return; }
    REG.photos.push(d); renderRegPhotos();
  });

  handleImgs('gallery-input', function(d) {
    if (!CUR) return;
    if (!CUR.photos) CUR.photos = [];
    if (CUR.photos.length >= 20) { toast('Máximo 20 fotos', '#EF4444'); return; }
    CUR.photos.push(d); saveDB(); renderGallery();
  });

  handleImg('bar-photo-input', function(d) {
    window._barPhoto = d;
    var p = G('bar-photo-preview');
    if (p) p.innerHTML = '<img src="'+d+'" class="photo-preview" alt="Foto"/>';
  });
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
    return '<div class="img-thumb"><img src="' + sanitizeImageDataURL(p) + '" alt="Producto ' + (i+1) + '"><button onclick="delGalleryPhoto(' + i + ')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button></div>';
  }).join('');
}

function delGalleryPhoto(idx) {
  if (CUR) { CUR.photos = (CUR.photos || []).filter(function(_, i) { return i !== idx; }); saveDB(); renderGallery(); toast('Producto eliminado', '#475569'); }
}

function finalizeBizReg() {
  if (DB.businesses.filter(function(b){ return (b.email||'').toLowerCase()===REG.email.toLowerCase(); })[0]) { toast('Email ya registrado','#EF4444'); showRegStep(2); return; }
  var slug = (REG.name||'negocio').toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').slice(0,20)+'-'+Date.now().toString(36);
  var biz = {
    id:slug, name:REG.name, owner:REG.owner, email:REG.email, pass:REG.pass,
    phone:REG.phone, addr:REG.addr, city:REG.city, country:REG.country,
    type:REG.type, teamSize:REG.teamSize,
    joinDate:new Date().toISOString().split('T')[0],
    plan:'trial', desc:'', logo:REG.logo||'', photos:REG.photos||[], insta:'',
    horario:DEFAULT_HORARIO.map(function(h){ return Object.assign({},h); }),
    workers: [], 
    services: [], // Array vacío, los servicios los crearán los workers
    appointments: []
  };
  DB.businesses.push(biz); DB.currentBiz=slug; DB.currentWorker=null; saveDB();
  T('biz-link-display','citasproonline.com/#b/'+slug);
  T('neg-badge', DB.businesses.length);
  var waLink=G('wa-share-link');
  if (waLink) waLink.href='https://wa.me/?text='+encodeURIComponent('Reserva tu cita en '+REG.name+' → https://citasproonline.com/b/'+slug);
  checkNotifications();
}

function completeBizReg() { CUR=DB.businesses.filter(function(b){ return b.id===DB.currentBiz; })[0]; if(CUR) showBizPanel(); else showRegStep(0); }
function copyLink() {
  var link = 'https://citasproonline.com/#b/' + (CUR ? CUR.id : DB.currentBiz || 'mi-negocio');
  try { navigator.clipboard.writeText(link); } catch(e) {}
  toast('Enlace copiado', '#4A7FD4');
}


/* ══════════════════════════
   INIT PANEL DUEÑO
══════════════════════════ */
function initBizPanel() {
  if (!CUR) return;
  var hr=new Date().getHours(), g=hr<12?'Buenos días':hr<18?'Buenas tardes':'Buenas noches';
  T('biz-greeting', g+' '+(CUR.owner||'').split(' ')[0]);
  T('biz-hdr-nm', CUR.name);

  var planEl=G('biz-hdr-plan');
  if (planEl) {
    planEl.textContent = CUR.plan==='active'?'Plan activo':CUR.plan==='trial'?'Prueba gratis':'Suscripción vencida';
    planEl.style.color  = CUR.plan==='active'?'var(--green)':CUR.plan==='trial'?'var(--gold)':'var(--red)';
  }

  var av=G('biz-hdr-av');
  if (av) {
    if (CUR.logo) av.innerHTML='<img src="'+sanitizeImageDataURL(CUR.logo)+'" style="width:100%;height:100%;object-fit:cover" alt="Logo">';
    else av.textContent=(CUR.name||'?').charAt(0).toUpperCase();
  }

  var today=new Date().toISOString().split('T')[0];
  var allAppts=[];
  (CUR.workers||[]).forEach(function(w){ (w.appointments||[]).forEach(function(a){ allAppts.push(a); }); });
  (CUR.appointments||[]).forEach(function(a){ allAppts.push(a); });

  var todayA=allAppts.filter(function(a){ return a.date===today&&a.status!=='cancelled'; });
  var thisWeekStart=new Date(); thisWeekStart.setDate(thisWeekStart.getDate()-thisWeekStart.getDay());
  var thisMonthStart=new Date(); thisMonthStart.setDate(1);
  var weekA =allAppts.filter(function(a){ return a.date>=thisWeekStart.toISOString().split('T')[0]&&a.status!=='cancelled'; });
  var monthA=allAppts.filter(function(a){ return a.date>=thisMonthStart.toISOString().split('T')[0]&&a.status!=='cancelled'; });

  T('bh-today', todayA.length);
  T('bh-rev',   money(todayA.reduce(function(s,a){ return s+(a.price||0); },0)));
  T('bh-week',  weekA.length);
  T('bh-month', money(monthA.reduce(function(s,a){ return s+(a.price||0); },0)));

  var link = 'citasproonline.com/#b/' + CUR.id;
  T('biz-link-show', link);
  var wah = G('wa-share-home');
  if (wah) wah.href = 'https://wa.me/?text=' + encodeURIComponent('Reserva tu cita en ' + CUR.name + ' → https://' + link);

  renderTodayAppts(todayA);
  renderBizWorkers();
  renderGallery();
  renderBizFinances();
  renderHorario();
  renderCalendar();
  initAgenda();

  var pfNm=G('pf-nm'); if(pfNm) pfNm.value=CUR.name||'';
  var pfAd=G('pf-addr'); if(pfAd) pfAd.value=CUR.addr||'';
  var pfPh=G('pf-phone'); if(pfPh) pfPh.value=CUR.phone||'';
  var pfIn=G('pf-insta'); if(pfIn) pfIn.value=CUR.insta||'';
  var pfDs=G('pf-desc'); if(pfDs) pfDs.value=CUR.desc||'';
  var pfPs=G('pf-plan-status');
  if(pfPs) pfPs.textContent=CUR.plan==='active'?'Plan activo · Próxima factura el día 1':CUR.plan==='trial'?'En período de prueba gratuito':'Suscripción vencida — contacta soporte';
  var pfPb=G('pf-plan-badge'); if(pfPb) pfPb.innerHTML=planTag(CUR.plan);

  bizTab('home');
}

/* ══════════════════════════
   TABS DUEÑO
══════════════════════════ */
function bizTab(tab) {
  var tabs=['home','agenda','equipo','tienda','finanzas','horario','perfil']; 
  for (var i=0;i<tabs.length;i++) {
    var t=tabs[i];
    var pa=G('bp-'+t), bt=G('bn-'+t);
    if(pa) pa.classList[t===tab?'add':'remove']('on');
    if(bt) bt.classList[t===tab?'add':'remove']('on');
  }
  if(tab==='agenda'){ DB=loadDB(); CUR=DB.currentBiz?DB.businesses.filter(function(b){ return b.id===DB.currentBiz; })[0]:CUR; initAgenda(); }
  if(tab==='home'){   DB=loadDB(); CUR=DB.currentBiz?DB.businesses.filter(function(b){ return b.id===DB.currentBiz; })[0]:CUR; renderTodayAppts(); }
}

/* ══════════════════════════
   CITAS HOY (dueño ve todo)
══════════════════════════ */
function renderTodayAppts(appts) {
  if (!appts && CUR) {
    var today=new Date().toISOString().split('T')[0];
    appts=[];
    (CUR.workers||[]).forEach(function(w){ (w.appointments||[]).forEach(function(a){ if(a.date===today) appts.push(a); }); });
    (CUR.appointments||[]).forEach(function(a){ if(a.date===today) appts.push(a); });
  }
  H('bh-appts', appts&&appts.length ? appts.map(function(a){ return apptRowH(a); }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Sin citas para hoy</div></div>');
}

function apptRowH(a) {
  var sc={
    confirmed:{c:'var(--blue)', bg:'rgba(74,127,212,.1)', l:'Conf.'},
    pending:  {c:'var(--gold)', bg:'rgba(245,158,11,.1)', l:'Pend.'},
    completed:{c:'var(--green)',bg:'rgba(34,197,94,.1)',  l:'Hecho'},
    cancelled:{c:'var(--red)',  bg:'rgba(239,68,68,.1)',  l:'Canc.'}
  }[a.status]||{c:'var(--blue)',bg:'rgba(74,127,212,.1)',l:'Conf.'};
  var initials=san((a.client||'?').split(' ').map(function(n){ return n[0]||''; }).slice(0,2).join('').toUpperCase());
  return '<div class="appt-row" onclick="openApptDetail(\''+sanitizeText(a.id)+'\')">'
    +'<div class="appt-avatar">'+initials+'</div>'
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+san(a.client)+'</div>'
    +'<div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(a.svc)+(a.barber?' · '+san(a.barber):'')+'</div>'
    +(a.notes?'<div style="font-size:11px;color:var(--muted);margin-top:2px;font-style:italic">'+san(a.notes)+'</div>':'')
    +'</div>'
    +'<div style="text-align:right;flex-shrink:0">'
    +'<div style="font-weight:800;font-size:15px;color:var(--blue)">'+money(a.price)+'</div>'
    +'<div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(a.time)+'</div>'
    +'<div style="margin-top:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:'+sc.bg+';color:'+sc.c+'">'+sc.l+'</div>'
    +'</div></div>';
}

function openApptDetail(id) {
  if (!CUR) return;
  var a=null;
  (CUR.workers||[]).forEach(function(w){ (w.appointments||[]).forEach(function(ap){ if(String(ap.id)===String(id)) a=ap; }); });
  (CUR.appointments||[]).forEach(function(ap){ if(String(ap.id)===String(id)) a=ap; });
  if (!a) return;

  H('appt-detail-content',
    '<div style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--r);padding:16px;margin-bottom:14px">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'
    +'<div class="appt-avatar" style="width:52px;height:52px;font-size:20px">'
    +san((a.client||'?').split(' ').map(function(n){ return n[0]||''; }).slice(0,2).join('').toUpperCase())
    +'</div>'
    +'<div>'
    +'<div style="font-size:18px;font-weight:900">'+san(a.client)+'</div>'
    +(a.phone?'<div style="font-size:14px;color:var(--blue3);margin-top:3px;font-weight:600">'+san(a.phone)+'</div>':'')
    +(a.email?'<div style="font-size:13px;color:var(--t2);margin-top:2px">'+san(a.email)+'</div>':'')
    +'</div></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    +'<div class="sbox"><div class="slbl">Fecha</div><div style="font-size:14px;font-weight:700">'+san(a.date)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Hora</div><div style="font-size:18px;font-weight:900;color:var(--blue)">'+san(a.time)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Servicio</div><div style="font-size:13px;font-weight:700">'+san(a.svc)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Total</div><div style="font-size:18px;font-weight:900;color:var(--green)">'+money(a.price)+'</div></div>'
    +'</div>'
  );
  var waBtn=G('appt-wa-btn'); if(waBtn&&a.phone) waBtn.href='https://wa.me/'+a.phone.replace(/\D/g,'')+'?text='+encodeURIComponent('Hola '+a.client+', te recordamos tu cita en '+CUR.name+' el '+a.date+' a las '+a.time+'.');
  var cb=G('appt-complete-btn'); if(cb) cb.onclick=function(){ updateApptStatus(id,'completed'); };
  var ca=G('appt-cancel-btn');   if(ca) ca.onclick=function(){ updateApptStatus(id,'cancelled'); };
  openOv('ov-appt-detail');
}

function updateApptStatus(id, status) {
  if (!CUR) return;
  (CUR.workers||[]).forEach(function(w){ (w.appointments||[]).forEach(function(a){ if(String(a.id)===String(id)) a.status=status; }); });
  (CUR.appointments||[]).forEach(function(a){ if(String(a.id)===String(id)) a.status=status; });
  saveDB(); closeOv('ov-appt-detail'); renderTodayAppts(); initAgenda(); renderBizFinances();
  toast(status==='completed'?'Cita completada':'Cita cancelada', status==='completed'?'#22C55E':'#EF4444');
}

/* ══════════════════════════
   EQUIPO — renderiza workers y perfil trabajador (Dueño)
══════════════════════════ */
function renderBizWorkers() {
  if (!CUR) return;
  var workers = CUR.workers || [];
  H('biz-barbers-list', workers.length
    ? workers.map(function(w) {
        var av = w.photo
          ? '<img src="'+sanitizeImageDataURL(w.photo)+'" style="width:100%;height:100%;object-fit:cover" alt="Foto">'
          : '<span style="font-size:18px;font-weight:800;color:#fff">'+san((w.name||'?').charAt(0).toUpperCase())+'</span>';
        var apptCount = (w.appointments||[]).filter(function(a){ return a.status!=='cancelled'; }).length;
        
        return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px">'
          +'<div onclick="openWorkerProfile(\''+sanitizeText(w.id)+'\')" style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;cursor:pointer">'+av+'</div>'
          +'<div style="flex:1; cursor:pointer" onclick="openWorkerProfile(\''+sanitizeText(w.id)+'\')">'
          +'<div style="font-weight:700;font-size:15px;color:var(--blue)">'+san(w.name)+'</div>'
          +'<div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(w.spec||'')+'</div>'
          +'<div style="font-size:11px;color:var(--muted);margin-top:3px">'+apptCount+' citas · '+(w.services||[]).length+' servicios</div>'
          +'</div>'
          +'<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">'
          +'<div style="display:flex;gap:6px">'
          +'<button onclick="openWorkerModal(\''+sanitizeText(w.id)+'\')" style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--rpill);padding:6px 12px;color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font)">Editar</button>'
          +'<button onclick="confirmDeleteWorker(\''+sanitizeText(w.id)+'\')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);border-radius:var(--rpill);padding:6px 10px;color:var(--red);font-size:12px;cursor:pointer">&#x2715;</button>'
          +'</div>'
          +'<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:'+(w.active?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)')+';color:'+(w.active?'var(--green)':'var(--red)')+';">'+(w.active?'Activo':'Inactivo')+'</span>'
          +'</div></div>';
      }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">No hay trabajadores aún</div></div>');
}

// Perfil detallado del trabajador para el dueño
function openWorkerProfile(workerId) {
  if (!CUR) return;
  var worker = CUR.workers.find(function(w) { return w.id === workerId; });
  if(!worker) return;

  var totalIngresos = (worker.appointments || [])
    .filter(function(a) { return a.status === 'completed'; }) 
    .reduce(function(sum, a) { return sum + (a.price || 0); }, 0);

  var serviciosHtml = (worker.services && worker.services.length > 0) 
    ? worker.services.map(function(s) { 
        return '<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--b);">'
          +'<span style="font-size:13px">'+san(s.name)+' <small style="color:var(--muted)">('+s.dur+' min)</small></span>'
          +'<span style="font-weight:bold;font-size:14px;color:var(--blue)">'+money(s.price)+'</span>'
          +'</div>';
      }).join('') 
    : '<p style="color:var(--muted); font-size:12px; text-align:center;">Este trabajador no ha creado servicios aún.</p>';

  var av = worker.photo
    ? '<img src="'+sanitizeImageDataURL(worker.photo)+'" style="width:100%;height:100%;object-fit:cover" alt="Foto">'
    : worker.name.charAt(0).toUpperCase();

  H('worker-profile-content', 
    '<div style="text-align:center;padding:20px 20px 10px">'
    +'<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#4A7FD4,#2855C8);margin:0 auto 15px;display:flex;align-items:center;justify-content:center;font-size:30px;color:white;overflow:hidden;box-shadow:0 4px 15px rgba(74,127,212,.3)">'
    + av
    +'</div>'
    +'<h3 style="margin:0;font-size:20px;font-weight:900">'+san(worker.name)+'</h3>'
    +'<p style="color:var(--t2);font-size:13px;margin-top:4px">'+san(worker.email)+'</p>'
    +'</div>'
    
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 20px 20px">'
    +'<div style="background:var(--b);padding:15px;border-radius:16px;text-align:center">'
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px">CITAS REALIZADAS</div>'
    +'<div style="font-size:22px;font-weight:900">'+(worker.appointments || []).filter(function(a){ return a.status === 'completed'; }).length+'</div>'
    +'</div>'
    +'<div style="background:var(--b);padding:15px;border-radius:16px;text-align:center">'
    +'<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px">INGRESOS GENERADOS</div>'
    +'<div style="font-size:22px;font-weight:900;color:var(--green)">'+money(totalIngresos)+'</div>'
    +'</div>'
    +'</div>'

    +'<div style="padding:0 20px 20px">'
    +'<h4 style="font-size:12px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Catálogo del trabajador</h4>'
    +'<div style="background:var(--card); padding:10px 15px; border-radius:16px; border:1px solid var(--b);">'
    + serviciosHtml
    +'</div>'
    +'</div>'
  );
  openOv('ov-worker-profile'); 
}

/* ══════════════════════════
   MODAL TRABAJADOR (crear/editar) Y ENVIO DE CORREO
══════════════════════════ */
var editWorkerId = null;

function openWorkerModal(id) {
  editWorkerId = id || null;
  window._barPhoto = null;
  T('bar-ttl', id ? 'Editar trabajador' : 'Añadir trabajador');

  var pv = G('bar-photo-preview');
  if (pv) pv.innerHTML = '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';

  var credSection = G('bar-cred-section');
  if (credSection) credSection.style.display = id ? 'none' : 'block';

  if (id && CUR) {
    var w = (CUR.workers||[]).filter(function(x){ return x.id===id; })[0];
    if (w) {
      var n=G('bar-name'), sp=G('bar-spec'), ph=G('bar-phone'), em=G('bar-email');
      if(n) n.value=w.name||''; if(sp) sp.value=w.spec||''; if(ph) ph.value=w.phone||'';
      if(em) em.value=w.email||'';
      if(pv&&w.photo) pv.innerHTML='<img src="'+sanitizeImageDataURL(w.photo)+'" class="photo-preview" alt="Foto"/>';
    }
  } else {
    ['bar-name','bar-spec','bar-phone','bar-email','bar-pass'].forEach(function(fid){ var e=G(fid); if(e) e.value=''; });
  }
  openOv('ov-barber');
}

function saveBarber() {
  var name  = sanitizeText(V('bar-name'));
  var spec  = sanitizeText(V('bar-spec'));
  var phone = sanitizeText(V('bar-phone'));
  var email = V('bar-email').trim().toLowerCase();
  var pass  = V('bar-pass');
  var photo = window._barPhoto || null;

  if (!name) { toast('Nombre requerido','#EF4444'); return; }
  if (!CUR) return;
  if (!CUR.workers) CUR.workers=[];

  if (editWorkerId) {
    var w=(CUR.workers).filter(function(x){ return x.id===editWorkerId; })[0];
    if (w) { w.name=name; w.spec=spec; w.phone=phone; if(photo) w.photo=photo; }
    toast('Trabajador editado','#4A7FD4');
  } else {
    if (!validEmail(email)) { toast('Email inválido','#EF4444'); return; }
    if (!pass || pass.length<6) { toast('Contraseña mínimo 6 caracteres','#EF4444'); return; }
    var emailExists = false;
    DB.businesses.forEach(function(b){
      if((b.email||'').toLowerCase()===email) emailExists=true;
      (b.workers||[]).forEach(function(wk){ if((wk.email||'').toLowerCase()===email) emailExists=true; });
    });
    if (emailExists) { toast('Ese email ya está registrado','#EF4444'); return; }

    CUR.workers.push({
      id: 'w_'+Date.now(),
      name: name, email: email, pass: pass,
      phone: phone, spec: spec, photo: photo||'',
      active: true,
      services: [], horario: DEFAULT_HORARIO.map(function(h){ return Object.assign({},h); }),
      appointments: [], photos: [], notifications: []
    });

    /* Enviar Email de Bienvenida con Credenciales usando la función de Netlify */
    fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'worker_welcome', // Tendrás que asegurar que tu Netlify Function pueda leer este "type" o enviar el texto así:
        to: email,
        data: {
          workerName: name,
          bizName: CUR.name,
          email: email,
          pass: pass,
          link: 'https://citasproonline.com' // La url de login
        }
      })
    }).catch(function(e) { console.error('Error enviando email al trabajador:', e); });

    toast('Trabajador creado y email enviado', '#22C55E');
  }

  editWorkerId=null; window._barPhoto=null;
  saveDB(); renderBizWorkers(); closeOv('ov-barber');
}

function confirmDeleteWorker(id) {
  openConfirmModal(
    'Eliminar trabajador',
    '¿Estás seguro? Se eliminarán sus citas y datos.',
    function() {
      if (!CUR) return;
      CUR.workers=(CUR.workers||[]).filter(function(w){ return w.id!==id; });
      saveDB(); renderBizWorkers(); toast('Trabajador eliminado','#475569');
    }
  );
}

/* ══════════════════════════
   FINANZAS DUEÑO (suma todos los workers)
══════════════════════════ */
function renderBizFinances() {
  if (!CUR) return;
  var now=new Date(), thisMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');

  var allAppts=[];
  (CUR.workers||[]).forEach(function(w){ (w.appointments||[]).forEach(function(a){ allAppts.push(a); }); });
  (CUR.appointments||[]).forEach(function(a){ allAppts.push(a); });

  var monthAppts=allAppts.filter(function(a){ return a.date&&a.date.slice(0,7)===thisMonth&&a.status!=='cancelled'; });
  var monthRev=monthAppts.reduce(function(s,a){ return s+(a.price||0); },0);
  var clients=[]; allAppts.forEach(function(a){ if(a.client&&clients.indexOf(a.client)<0) clients.push(a.client); });
  var svcCount={}; allAppts.filter(function(a){ return a.status!=='cancelled'; }).forEach(function(a){ if(a.svc) svcCount[a.svc]=(svcCount[a.svc]||0)+1; });
  var topSvc='—',topCount=0; Object.keys(svcCount).forEach(function(k){ if(svcCount[k]>topCount){ topSvc=k; topCount=svcCount[k]; } });
  var paid=allAppts.filter(function(a){ return a.status!=='cancelled'&&a.price>0; });
  var ticket=paid.length?paid.reduce(function(s,a){ return s+(a.price||0); },0)/paid.length:0;

  T('fin-ing',money(monthRev)); T('fin-clients',clients.length);
  T('fin-top-svc',topSvc.length>10?topSvc.slice(0,10)+'…':topSvc); T('fin-ticket',money(ticket));

  var months=[];
  for(var i=5;i>=0;i--){ var d=new Date(now); d.setMonth(d.getMonth()-i); months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')); }
  var vals=months.map(function(m){ return allAppts.filter(function(a){ return a.date&&a.date.slice(0,7)===m&&a.status!=='cancelled'; }).reduce(function(s,a){ return s+(a.price||0); },0); });
  var max=Math.max.apply(null,vals.concat([10]));
  var ch=G('fin-chart'); if(ch) ch.innerHTML=vals.map(function(v,i){ return '<div class="bar'+(i===vals.length-1?' hi':'')+'" style="height:'+Math.max(4,Math.round(v/max*100))+'%" title="'+money(v)+'"></div>'; }).join('');
  var ml=G('fin-months'); if(ml) ml.innerHTML=months.map(function(m,i){ var parts=m.split('-'); return '<div style="flex:1;text-align:center;font-size:9px;color:'+(i===months.length-1?'var(--blue)':'var(--muted)')+';font-weight:700">'+MONTHS_SHORT[parseInt(parts[1])-1]+'</div>'; }).join('');
  H('biz-appts-fin', paid.slice().sort(function(a,b){ return b.date.localeCompare(a.date); }).slice(0,20).map(function(a){ return apptRowH(a); }).join(''));
}

/* ══════════════════════════
   CALENDARIO Y AGENDA DUEÑO
══════════════════════════ */
function renderCalendar() {
  var now=calendarDate, year=now.getFullYear(), month=now.getMonth();
  T('cal-title',MONTHS[month]+' '+year);
  var firstDay=new Date(year,month,1).getDay(), daysInMonth=new Date(year,month+1,0).getDate();
  var today=new Date().toISOString().split('T')[0];
  var apptDates={};
  (CUR ? (CUR.workers||[]) : []).forEach(function(w){ (w.appointments||[]).forEach(function(a){ if(a.date&&a.status!=='cancelled') apptDates[a.date]=true; }); });
  (CUR ? (CUR.appointments||[]) : []).forEach(function(a){ if(a.date&&a.status!=='cancelled') apptDates[a.date]=true; });

  var html='';
  for(var i=0;i<firstDay;i++) html+='<div class="cal-day other-month"></div>';
  for(var d=1;d<=daysInMonth;d++){
    var ds=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var cls='cal-day';
    if(ds===today) cls+=' today';
    if(ds===selectedCalDay&&ds!==today) cls+=' sel';
    if(apptDates[ds]) cls+=' has-appts';
    html+='<div class="'+cls+'" onclick="selectCalDay(\''+ds+'\')">'+d+'</div>';
  }
  H('cal-grid',html);
}

function selectCalDay(ds){ selectedCalDay=ds; renderCalendar(); initAgenda(); }
function prevMonth(){ calendarDate.setMonth(calendarDate.getMonth()-1); renderCalendar(); }
function nextMonth(){ calendarDate.setMonth(calendarDate.getMonth()+1); renderCalendar(); }

function initAgenda() {
  if (!CUR) return;
  var dayAppts=[];
  (CUR.workers||[]).forEach(function(w){ (w.appointments||[]).forEach(function(a){ if(a.date===selectedCalDay) dayAppts.push(a); }); });
  (CUR.appointments||[]).forEach(function(a){ if(a.date===selectedCalDay) dayAppts.push(a); });
  dayAppts.sort(function(a,b){ return (a.time||'').localeCompare(b.time||''); });

  var parts=selectedCalDay.split('-'), days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var d=new Date(selectedCalDay+'T12:00');
  T('agenda-day-label',days[d.getDay()]+' '+parseInt(parts[2])+' de '+MONTHS[parseInt(parts[1])-1]+' de '+parts[0]);
  H('biz-agenda-list',dayAppts.length?dayAppts.map(function(a){ return apptRowH(a); }).join('')
    :'<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Sin citas para este día</div></div>');
}

/* ══════════════════════════
   HORARIO BARBERÍA
══════════════════════════ */
function renderHorario() {
  if (!CUR) return;
  var horario=CUR.horario||DEFAULT_HORARIO.map(function(h){ return Object.assign({},h); });
  H('horario-days',horario.map(function(day,i){
    return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:'+(day.open?'12px':'0')+'">'
      +'<div style="font-weight:700;font-size:14px">'+san(day.day)+'</div>'
      +'<div class="toggle '+(day.open?'on':'')+'" data-hday="'+i+'" onclick="toggleHorarioDay('+i+')"></div>'
      +'</div>'
      +(day.open
        ?'<div style="display:flex;gap:10px;align-items:center">'
          +'<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px">APERTURA</div><input class="inp" type="time" value="'+san(day.from)+'" data-hfrom="'+i+'" style="padding:9px 12px"/></div>'
          +'<div style="color:var(--muted);font-size:16px;padding-top:18px">—</div>'
          +'<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px">CIERRE</div><input class="inp" type="time" value="'+san(day.to)+'" data-hto="'+i+'" style="padding:9px 12px"/></div>'
          +'</div>'
        :'')
      +'</div>';
  }).join(''));
  document.querySelectorAll('[data-hfrom]').forEach(function(el){ el.addEventListener('change',function(){ var i=parseInt(el.getAttribute('data-hfrom')); if(CUR.horario&&CUR.horario[i]) CUR.horario[i].from=el.value; }); });
  document.querySelectorAll('[data-hto]').forEach(function(el){   el.addEventListener('change',function(){ var i=parseInt(el.getAttribute('data-hto'));   if(CUR.horario&&CUR.horario[i]) CUR.horario[i].to  =el.value; }); });
}

function toggleHorarioDay(i) {
  if(!CUR) return;
  if(!CUR.horario) CUR.horario=DEFAULT_HORARIO.map(function(h){ return Object.assign({},h); });
  CUR.horario[i].open=!CUR.horario[i].open;
  renderHorario();
}

/* ══════════════════════════
   NUEVA CITA MANUAL (dueño)
══════════════════════════ */
function openApptModal() {
  if (!CUR) return;
  var today=new Date().toISOString().split('T')[0];
  var nowTime=new Date().toTimeString().slice(0,5);
  var dateEl=G('ap-date'), timeEl=G('ap-time'), nameEl=G('ap-name'), phoneEl=G('ap-phone'), notesEl=G('ap-notes');
  if(dateEl) dateEl.value=today; if(timeEl) timeEl.value=nowTime;
  if(nameEl) nameEl.value=''; if(phoneEl) phoneEl.value=''; if(notesEl) notesEl.value='';

  var svcSel=G('ap-svc');
  if(svcSel){
    var opts='';
    (CUR.workers||[]).forEach(function(w){
      (w.services||[]).forEach(function(s){ opts+='<option value="'+san(s.name)+','+s.price+','+sanitizeText(w.id)+'">'+san(w.name)+' — '+san(s.name)+' ('+money(s.price)+')</option>'; });
    });
    svcSel.innerHTML=opts;
  }

  var barSel=G('ap-bar');
  if(barSel) barSel.innerHTML='<option value="">Sin asignar</option>'+(CUR.workers||[]).map(function(w){ return '<option value="'+sanitizeText(w.id)+'">'+san(w.name)+'</option>'; }).join('');
  openOv('ov-appt');
}

function saveAppt() {
  var name=sanitizeText(V('ap-name')), phone=sanitizeText(V('ap-phone'));
  var date=V('ap-date'), time=V('ap-time'), svcRaw=V('ap-svc'), workerId=V('ap-bar'), status=V('ap-status')||'confirmed', notes=sanitizeText(V('ap-notes'));
  if(!name){ toast('Nombre del cliente requerido','#EF4444'); return; }
  if(!date||!time){ toast('Fecha y hora requeridas','#EF4444'); return; }
  if(!svcRaw){ toast('Selecciona un servicio','#EF4444'); return; }
  if(!CUR) return;

  var parts=svcRaw.split(',');
  var appt={ id:Date.now(), client:name, phone:phone, email:'', svc:parts[0], barber:workerId||'', date:date, time:time, price:safeNum(parts[1],0), status:status, notes:notes };

  if(workerId) {
    var w=(CUR.workers||[]).filter(function(x){ return x.id===workerId; })[0];
    if(w){ if(!w.appointments) w.appointments=[]; w.appointments.push(appt); }
  } else {
    if(!CUR.appointments) CUR.appointments=[];
    CUR.appointments.push(appt);
  }

  saveDB(); closeOv('ov-appt'); renderTodayAppts(); initAgenda(); renderBizFinances(); initBizPanel();
  toast('Cita guardada','#22C55E');
}

/* ══════════════════════════
   PERFIL BARBERÍA
══════════════════════════ */
function saveBizProfile() {
  if(!CUR) return;
  var nm=sanitizeText(V('pf-nm')), addr=sanitizeText(V('pf-addr')), phone=sanitizeText(V('pf-phone')), insta=sanitizeText(V('pf-insta')), desc=sanitizeText(V('pf-desc'));
  if(!nm){ toast('El nombre no puede estar vacío','#EF4444'); return; }
  CUR.name=nm; CUR.addr=addr; CUR.phone=phone; CUR.insta=insta; CUR.desc=desc.slice(0,300);
  saveDB(); initBizPanel(); toast('Perfil guardado','#4A7FD4');
}