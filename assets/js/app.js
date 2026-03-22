'use strict';

/* ══════════════════════════
   SELECTOR DE PAÍS
══════════════════════════ */
function toggleCountryDropdown() {
  var dd = G('br-country-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
function selectCountry(code, label) {
  var input   = G('br-country');
  var display = G('br-country-label');
  var dd      = G('br-country-dropdown');
  if (input)   input.value         = code;
  if (display) display.textContent = label;
  if (dd)      dd.style.display    = 'none';
}
window.toggleCountryDropdown = toggleCountryDropdown;
window.selectCountry         = selectCountry;

/* ══════════════════════════
   QR
══════════════════════════ */
function generateQR(text, containerId) {
  var container = G(containerId); if (!container) return;
  var size   = 180;
  var imgUrl = 'https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text)+'&bgcolor=ffffff&color=000000&margin=10';
  var img    = document.createElement('img');
  img.src    = imgUrl; img.width=size; img.height=size; img.alt='Código QR';
  img.style.borderRadius='8px'; img.style.display='block';
  img.onerror = function(){ container.innerHTML='<div style="padding:20px;color:var(--muted);font-size:13px;text-align:center">Conecta a internet para ver el QR</div>'; };
  container.innerHTML=''; container.appendChild(img);
}

function openQRModal() {
  if (!CUR) return;
  var link = 'https://citasproonline.com/#b/' + CUR.id;
  var el = G('qr-link-text'); if (el) el.textContent = link;
  generateQR(link, 'qr-code');
  var wa = G('qr-wa-btn'); if (wa) wa.href = 'https://wa.me/?text='+encodeURIComponent('Reserva tu cita en '+CUR.name+' → '+link);
  openOv('ov-qr');
}

/* ══════════════════════════
   SUPER ADMIN LÓGICA
══════════════════════════ */
function dotsLogin() {
  var email = V('dots-email').trim().toLowerCase();
  var pass  = V('dots-pass');
  hideErr('dots-err');
  if (!email||!pass) { showErr('dots-err','Completa todos los campos.'); return; }
  var key = 'dots_'+email;
  if (!checkRateLimit(key)) { showErr('dots-err','Demasiados intentos. Espera 5 minutos.'); return; }
  if (email==='virche70021261@gmail.com' && pass==='Versa70021261*#') {
    resetRateLimit(key); DB.admin.auth=true; saveDB();
    hideErr('dots-err'); closeOv('ov-admin');
    goTo('s-admin'); showAdminPanel();
    toast('Bienvenida, Versa', '#2855C8');
  } else {
    showErr('dots-err','Credenciales incorrectas.');
    var p=G('dots-pass'); if(p){p.value='';p.focus();}
  }
}

function doAdminLogin() {
  var email = V('adm-email').trim().toLowerCase();
  var pass  = V('adm-pass');
  hideErr('adm-err');
  if (!email||!pass) { showErr('adm-err','Escribe email y contraseña.'); return; }
  var key = 'admin_'+email;
  if (!checkRateLimit(key)) { showErr('adm-err','Demasiados intentos. Espera 5 minutos.'); return; }
  if (email==='virche70021261@gmail.com' && pass==='Versa70021261*#') {
    resetRateLimit(key); DB.admin.auth=true; saveDB(); hideErr('adm-err'); showAdminPanel();
  } else {
    showErr('adm-err','Credenciales incorrectas.');
    var p=G('adm-pass'); if(p){p.value='';p.focus();}
  }
}
function doAdminLogout() { DB.admin.auth=false; saveDB(); var l=G('adm-login'),p=G('adm-panel'); if(l)l.style.display='flex'; if(p)p.style.display='none'; }
function showAdminPanel() { var l=G('adm-login'),p=G('adm-panel'); if(l)l.style.display='none'; if(p)p.style.display='block'; renderDash(); checkNotifications(); }

function admTab(tab) {
  var tabs=['dashboard','negocios','suscripciones','ingresos','notificaciones','config'];
  for(var i=0;i<tabs.length;i++){var t=tabs[i];var pa=G('ap-'+t),bt=G('at-'+t);if(pa)pa.classList[t===tab?'add':'remove']('on');if(bt)bt.classList[t===tab?'add':'remove']('on');}
  if(tab==='negocios')       renderBizListAdmin(filterBiz());
  if(tab==='suscripciones')  renderSubs();
  if(tab==='ingresos')       renderRevenue();
  if(tab==='notificaciones') renderNotifications();
}

function filterBiz() {
  var q=(V('biz-search')||'').toLowerCase();
  var f=(V('biz-filter')||'all');
  return DB.businesses.filter(function(b){
    var mq=!q||(b.name||'').toLowerCase().indexOf(q)>=0||(b.city||'').toLowerCase().indexOf(q)>=0||(b.owner||'').toLowerCase().indexOf(q)>=0;
    var mf=f==='all'||(b.plan||'')==f;
    return mq&&mf;
  });
}
function filterClientBiz(){ renderBizListAdmin(filterBiz()); }

function renderDash() {
  var bizs=DB.businesses,active=0,trial=0,appts=0,ctry={};
  for(var i=0;i<bizs.length;i++){
    var b=bizs[i];
    if(b.plan==='active')active++;
    else if(b.plan==='trial')trial++;
    (b.workers||[]).forEach(function(w){ appts+=(w.appointments||[]).length; });
    appts+=(b.appointments||[]).length;
    if(b.country)ctry[b.country]=1;
  }
  var mrr=active*10, now=new Date();
  T('adm-date', MONTHS[now.getMonth()]+' '+now.getDate()+', '+now.getFullYear());
  T('ds-total',bizs.length); T('ds-sub',active+' activos · '+trial+' en prueba');
  T('ds-mrr',money(mrr)); T('ds-trial',trial); T('ds-appts',appts); T('ds-arr',money(mrr*12));
  var cl=Object.keys(ctry); T('ds-countries',cl.length);
  T('ds-flags',cl.map(function(c){return FLAGS[c]||'';}).join(' '));
  T('neg-badge',bizs.length);
  var vals=[0,0,0,0,mrr>0?Math.round(mrr*.4):0,mrr];
  var max=Math.max.apply(null,vals.concat([10]));
  var mns=['Oct','Nov','Dic','Ene','Feb',MONTHS_SHORT[now.getMonth()]];
  var ch=G('ds-chart');
  if(ch)ch.innerHTML=vals.map(function(v,i){return'<div class="bar'+(i===vals.length-1?' hi':'')+'" style="height:'+Math.max(4,Math.round(v/max*100))+'%" title="'+money(v)+'"></div>';}).join('');
  var ml=G('ds-months');
  if(ml)ml.innerHTML=mns.map(function(m,i){return'<div style="flex:1;text-align:center;font-size:9px;color:'+(i===mns.length-1?'var(--blue)':'var(--muted)')+';font-weight:700">'+m+'</div>';}).join('');
  var recent=bizs.slice().sort(function(a,b){return(b.joinDate||'').localeCompare(a.joinDate||'');}).slice(0,5);
  H('ds-recent',recent.map(bizCardH).join(''));
}

function bizCardH(b) {
  var allAppts=[];
  (b.workers||[]).forEach(function(w){(w.appointments||[]).forEach(function(a){allAppts.push(a);});});
  (b.appointments||[]).forEach(function(a){allAppts.push(a);});
  var rev=allAppts.reduce(function(s,a){return s+(a.price||0);},0);
  var av=b.logo?'<img src="'+sanitizeImageDataURL(b.logo)+'" style="width:100%;height:100%;object-fit:cover" alt="Logo">':'<span>'+san((b.name||'?').charAt(0))+'</span>';
  var wCount=(b.workers||[]).length;
  return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:10px;cursor:pointer;transition:all .15s" onclick="openBizProfile(\''+sanitizeText(b.id)+'\')">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">'
    +'<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff;flex-shrink:0;overflow:hidden">'+av+'</div>'
    +'<div style="flex:1"><div style="font-size:14px;font-weight:800">'+san(b.name)+'</div><div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(b.owner)+' · '+(FLAGS[b.country]||'')+' '+san(b.city||'')+'</div></div>'
    +planTag(b.plan)+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    +'<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--blue)">'+wCount+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Trabajadores</div></div>'
    +'<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800">'+allAppts.length+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Citas</div></div>'
    +'<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--green)">'+money(rev)+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Facturado</div></div>'
    +'</div></div>';
}

function openBizProfile(bizId) {
  var b=DB.businesses.filter(function(x){return x.id===bizId;})[0]; if(!b)return;
  var allAppts=[];
  (b.workers||[]).forEach(function(w){(w.appointments||[]).forEach(function(a){allAppts.push(a);});});
  (b.appointments||[]).forEach(function(a){allAppts.push(a);});
  var rev=allAppts.reduce(function(s,a){return s+(a.price||0);},0);
  var todayA=allAppts.filter(function(a){return a.date===new Date().toISOString().split('T')[0];});
  var av=b.logo?'<img src="'+sanitizeImageDataURL(b.logo)+'" style="width:100%;height:100%;object-fit:cover" alt="Logo">':san((b.name||'?').charAt(0));
  H('adm-biz-profile',
    '<div style="display:flex;align-items:center;gap:14px;background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:22px;padding:16px;margin-bottom:16px">'
    +'<div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0">'+av+'</div>'
    +'<div style="flex:1"><div style="font-size:18px;font-weight:800">'+san(b.name)+'</div>'
    +'<div style="font-size:12px;color:var(--t2);margin-top:4px;line-height:2">'+san(b.owner)+'<br>'+san(b.phone||'—')+'<br>'+san(b.email||'—')+'<br>'+san((b.addr||'')+' '+(b.city||''))+'<br>'+san(b.type||'—')+'</div>'
    +'<div style="margin-top:8px">'+planTag(b.plan)+'</div></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    +'<div class="sbox"><div class="slbl">Trabajadores</div><div class="snum" style="color:var(--blue)">'+(b.workers?b.workers.length:0)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Citas totales</div><div class="snum">'+allAppts.length+'</div></div>'
    +'<div class="sbox"><div class="slbl">Facturado</div><div class="snum" style="color:var(--green)">'+money(rev)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Citas hoy</div><div class="snum" style="color:var(--blue)">'+todayA.length+'</div></div></div>'
    +(b.desc?'<div class="card" style="margin-bottom:12px;font-size:13px;color:var(--t2);line-height:1.6">'+san(b.desc)+'</div>':'')
    +'<div style="background:var(--bg3);border-radius:11px;padding:12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">'
    +'<span style="font-size:13px;color:var(--blue3);font-weight:600;word-break:break-all;flex:1">citasproonline.com/#b/'+sanitizeText(b.id)+'</span>'
    +'<button onclick="copyText(\'https://citasproonline.com/#b/'+sanitizeText(b.id)+'\')" style="flex-shrink:0;padding:6px 12px;border-radius:8px;background:var(--bblue);color:var(--blue);font-size:12px;font-weight:700;border:1px solid rgba(74,127,212,.25);cursor:pointer;font-family:var(--font)">Copiar</button></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button onclick="extendTrial(\''+sanitizeText(b.id)+'\')" class="btn btn-dark btn-sm" style="flex:1">Extender prueba</button>'
    +'<button onclick="activateBiz(\''+sanitizeText(b.id)+'\')" class="btn btn-green btn-sm" style="flex:1">Activar</button>'
    +'<button onclick="suspendBiz(\''+sanitizeText(b.id)+'\')" class="btn btn-red btn-sm" style="flex:1">Suspender</button>'
    +'<button onclick="deleteBiz(\''+sanitizeText(b.id)+'\')" class="btn btn-red btn-sm" style="flex:1">Eliminar</button></div>'
  );
  openOv('ov-biz-profile');
}

function renderBizListAdmin(bizs){ H('adm-biz-list',bizs.length?bizs.map(bizCardH).join(''):'<div style="text-align:center;color:var(--muted);padding:40px"><div style="font-size:13px">No se encontraron negocios</div></div>'); }
function renderSubs(){ H('adm-subs',DB.businesses.length?DB.businesses.map(function(b){return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px"><div style="flex:1"><div style="font-weight:700;font-size:14px">'+san(b.name)+'</div><div style="font-size:12px;color:var(--t2);margin-top:3px">'+san(b.email)+'</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Desde '+san(b.joinDate||'—')+'</div></div>'+planTag(b.plan)+'</div>';}).join(''):'<div style="text-align:center;color:var(--muted);padding:40px">Sin negocios registrados</div>'); }
function renderRevenue(){ var active=DB.businesses.filter(function(b){return b.plan==='active';}).length;var m=active*10;T('rev-m',money(m));T('rev-y',money(m*12));T('rev-p6',money(m*1.8));T('rev-p12',money(m*2.5));H('adm-proj',[{l:'Mes actual ('+active+' activos)',v:m,c:'var(--green)'},{l:'En 3 meses (estimado)',v:m*1.3,c:'var(--blue)'},{l:'En 6 meses (estimado)',v:m*1.8,c:'var(--gold)'},{l:'En 1 año (estimado)',v:m*2.5,c:'var(--green)'}].map(function(r){return'<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">'+r.l+'</span><span style="font-weight:800;font-size:17px;color:'+r.c+'">'+money(r.v)+'</span></div>';}).join('')); }

function checkNotifications() {
  var notifs=[];
  DB.businesses.forEach(function(b){
    if(b.plan==='trial')   notifs.push({type:'trial',   msg:b.name+' está en período de prueba',   biz:b.id,color:'#F59E0B'});
    if(b.plan==='expired') notifs.push({type:'expired',msg:b.name+' tiene la suscripción vencida', biz:b.id,color:'#EF4444'});
  });
  var week=new Date(); week.setDate(week.getDate()-7);
  DB.businesses.forEach(function(b){ if(b.joinDate&&new Date(b.joinDate)>=week) notifs.push({type:'new',msg:'Nuevo: '+b.name+' de '+(b.city||b.country||'—'),biz:b.id,color:'#22C55E'}); });
  var dot=G('notif-dot'); if(dot) dot.classList[notifs.length>0?'add':'remove']('on');
  window._notifs=notifs;
}

function renderNotifications() {
  var notifs=window._notifs||[];
  H('notif-content',notifs.length?notifs.map(function(n){
    var icons={trial:'&#9200;',expired:'&#10060;',new:'&#128293;'};
    return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openBizProfile(\''+sanitizeText(n.biz)+'\')">'
      +'<div style="width:40px;height:40px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;background:'+n.color+'22">'+(icons[n.type]||'&#128276;')+'</div>'
      +'<div style="flex:1"><div style="font-size:13px;font-weight:600">'+san(n.msg)+'</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Toca para ver detalles</div></div>'
      +'<span style="color:var(--muted);font-size:16px">&#8250;</span></div>';
  }).join(''):'<div style="text-align:center;color:var(--muted);padding:36px"><div style="font-size:13px">Sin notificaciones</div></div>');
}

function extendTrial(id){ var b=DB.businesses.filter(function(x){return x.id===id;})[0]; if(b){b.plan='trial';saveDB();toast('Prueba extendida','#F59E0B');checkNotifications();closeOv('ov-biz-profile');renderBizListAdmin(filterBiz());} }
function activateBiz(id){ var b=DB.businesses.filter(function(x){return x.id===id;})[0]; if(b){b.plan='active';saveDB();toast('Negocio activado','#22C55E');checkNotifications();closeOv('ov-biz-profile');renderBizListAdmin(filterBiz());renderDash();} }
function suspendBiz(id){ var b=DB.businesses.filter(function(x){return x.id===id;})[0]; if(b){b.plan='expired';saveDB();toast('Negocio suspendido','#EF4444');checkNotifications();closeOv('ov-biz-profile');renderBizListAdmin(filterBiz());renderDash();} }

function deleteBiz(id) {
  openConfirmModal(
    'Eliminar negocio',
    '¿Estás seguro? Se eliminarán todos los datos, citas y trabajadores de este negocio.',
    function() {
      DB.businesses = DB.businesses.filter(function(b){ return b.id !== id; });
      saveDB(); closeOv('ov-biz-profile'); renderBizListAdmin(filterBiz()); renderDash(); checkNotifications();
      toast('Negocio eliminado', '#EF4444');
    }
  );
}

function copyText(txt){ try{navigator.clipboard.writeText(txt);}catch(e){} toast('Copiado','#4A7FD4'); }

/* ══════════════════════════
   FUNCIONES DE NUBE
══════════════════════════ */
async function fetchBizFromCloud(bizId) {
  try {
    const response = await fetch('/.netlify/functions/get-biz?id=' + bizId);
    if (response.ok) return await response.json();
  } catch (err) { console.error('Error nube:', err); }
  return null;
}

function syncBizToLocal(cloudData) {
  let index = DB.businesses.findIndex(b => b.id === cloudData.id);
  if (index >= 0) DB.businesses[index] = cloudData;
  else DB.businesses.push(cloudData);
  CUR = cloudData;
}

/* ══════════════════════════
   LOGOUT / SALIR
══════════════════════════ */
function bizLogout() {
    openConfirmModal('Cerrar sesión', '¿Quieres salir de la cuenta de barbería?', function() {
        DB.currentBiz = null;
        saveDB();
        location.href = '/';
    });
}

function workerLogout() {
    openConfirmModal('Cerrar sesión', '¿Quieres salir de tu perfil de trabajador?', function() {
        DB.currentWorker = null;
        saveDB();
        location.href = '/';
    });
}

/* ══════════════════════════
   WINDOW.ONLOAD
══════════════════════════ */
window.onload = async function() {
  DB = loadDB(); initREG(); initCSEL(); initTheme();

  // Cerrar overlays al hacer click en el fondo
  document.querySelectorAll('.ov').forEach(function(o){
    o.addEventListener('click', function(e){ if(e.target===o) closeOv(o.id); });
  });

  // Cerrar dropdown país
  document.addEventListener('click', function(e){
    var wrapper = G('country-wrapper');
    if(wrapper && !wrapper.contains(e.target)){
      var dd = G('br-country-dropdown');
      if(dd) dd.style.display='none';
    }
  });

  /* Eventos principales */
  on('theme-toggle','click', toggleTheme);
  on('dots-btn','click',function(){
    var em=G('dots-email'),ps=G('dots-pass');
    if(em)em.value=''; if(ps)ps.value='';
    hideErr('dots-err'); openOv('ov-admin');
  });
  on('btn-crear','click', function(){ openRegModal(); });
  on('btn-login','click', function(){ openLoginModal(); });

  /* Modal registro */
  on('rm-close1','click',function(){closeOv('ov-registro');});
  on('rm-close2','click',function(){closeOv('ov-registro');});
  on('rm-btn-next','click',  rmGoStep2);
  on('rm-btn-verify','click',rmVerify);
  on('rm-btn-resend','click',rmResend);
  on('rm-btn-back','click',function(){var s1=G('rm-step1'),s2=G('rm-step2');if(s1)s1.style.display='block';if(s2)s2.style.display='none';});
  on('rm-go-login','click',function(){closeOv('ov-registro');openLoginModal();});
  on('rm-pass','input',function(){updateRmPassStrength(this.value);});

  [0,1,2,3,4,5].forEach(function(i){
    var box=G('rc'+i); if(!box)return;
    box.addEventListener('input',  function(){codeInput(i);});
    box.addEventListener('keydown',function(e){codeKey(e,i);});
  });

  /* Modal login */
  on('login-close','click',   function(){closeOv('ov-login');});
  on('li-btn-login','click',  doLogin);
  on('li-forgot','click',     openForgotModal);
  on('li-go-register','click',function(){closeOv('ov-login');openRegModal();});

  /* Super Admin Modals */
  on('dots-cancel-btn','click',function(){closeOv('ov-admin');});
  on('dots-login-btn','click', dotsLogin);
  on('adm-login-btn','click',  doAdminLogin);
  on('adm-out-btn','click',    doAdminLogout);

  /* Biz Panel */
  on('biz-out-btn','click',    bizLogout);
  on('view-portal-btn','click',goClientFromBiz);
  on('new-appt-btn','click',   openApptModal);
  on('new-appt-btn2','click',  openApptModal);
  on('add-barber-btn','click', function(){openWorkerModal(null);});
  on('save-profile-btn','click',saveBizProfile);
  on('add-gallery-btn','click', function(){var gi=G('gallery-input');if(gi)gi.click();});

  /* Guardar Worker */
  on('save-bar-btn','click', saveBarber);
  on('close-bar','click', function(){closeOv('ov-barber');});

  /* Modal Confirmación */
  on('confirm-ok-btn','click',     confirmOk);
  on('confirm-cancel-btn','click', confirmCancel);

  /* Worker Panel */
  on('wk-out-btn','click',         workerLogout);
  on('wk-add-svc-btn','click',     function(){openWorkerSvcModal(null);});
  on('save-wk-profile-btn','click',saveWorkerProfile);
  on('save-wk-svc-btn','click',    saveWorkerSvc);
  on('close-wk-svc','click',       function(){closeOv('ov-wk-svc');});

  /* Portal cliente */
  on('cl-back-btn','click',function(){location.href='/';});
  on('cs1-next','click',  clStep2);
  on('cs3-next','click',  clStep4);
  on('cs4-next','click',  clStep5);
  on('cs5-confirm','click',confirmBooking);
  on('cl-reset-btn','click',resetBooking);

  setupPhotoUpload();
  setupWorkerPhotoUpload();
  initAllEyeToggles();

  /* QR */
  on('qr-btn','click', openQRModal);
  on('qr-copy-btn','click',function(){
    if(!CUR)return;
    copyText('https://citasproonline.com/#b/'+CUR.id);
  });

  /* Exportar funciones globales */
  window.admTab = admTab;
  window.bizTab = bizTab;
  window.workerTab = workerTab;
  window.openWorkerProfile = openWorkerProfile;
  window.selectCalDay = selectCalDay;
  window.openApptDetail = openApptDetail;
  window.toggleHorarioDay = toggleHorarioDay;
  window.openWorkerModal = openWorkerModal;
  window.confirmDeleteWorker = confirmDeleteWorker;
  window.cancelApptByToken = cancelApptByToken;
  window.selectWorker = selectWorker;

  /* ARRANQUE CRÍTICO */
  (async function startup() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#b/')) {
        const id = hash.split('/')[1];
        const cloudBiz = await fetchBizFromCloud(id);
        if (cloudBiz) {
            syncBizToLocal(cloudBiz);
            DB.currentWorker = null; saveDB();
            loadBizDirect(id);
            return;
        }
    }
    
    if (checkLinkAccess()) return;

    if (DB.admin && DB.admin.auth) {
        goTo('s-admin'); showAdminPanel();
    } else if (DB.currentWorker) {
        showWorkerPanel();
    } else if (DB.currentBiz) {
        showBizPanel();
    } else {
        goTo('s-portal');
    }
  })();
};