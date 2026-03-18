(function(){
'use strict';

/* ══════════════════════════
   SECURITY
══════════════════════════ */
var loginAttempts={};
function checkRateLimit(k){var n=Date.now();if(!loginAttempts[k])loginAttempts[k]={count:0,resetAt:n+300000};if(n>loginAttempts[k].resetAt)loginAttempts[k]={count:0,resetAt:n+300000};loginAttempts[k].count++;return loginAttempts[k].count<=5;}
function resetRateLimit(k){delete loginAttempts[k];}
function san(s){if(s===null||s===undefined)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/\//g,'&#x2F;').replace(/`/g,'&#x60;').slice(0,300);}
function sanitizeText(s){if(s===null||s===undefined)return'';return String(s).replace(/[<>"'`\/\\]/g,'').trim().slice(0,300);}
function safeNum(v,def){var n=parseFloat(v);return isNaN(n)?(def||0):Math.min(Math.max(n,0),999999);}
function safeInt(v,def){var n=parseInt(v);return isNaN(n)?(def||0):Math.min(Math.max(n,0),99999);}
function validEmail(e){return/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(String(e).trim());}
function validPhone(p){return String(p).replace(/\D/g,'').length>=7;}
function passStrength(p){var s=0;if(p.length>=8)s++;if(p.length>=12)s++;if(/[A-Z]/.test(p))s++;if(/[0-9]/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;return s;}
function validImageType(f){return['image/jpeg','image/png','image/webp'].indexOf(f.type)>=0&&f.size<=5*1024*1024;}
function sanitizeImageDataURL(d){if(!d||typeof d!=='string')return'';if(!d.match(/^data:image\/(jpeg|png|webp);base64,/))return'';return d;}

/* ══════════════════════════
   DATABASE
══════════════════════════ */
var DBKEY='citaspro_v8';
var DB,CUR,REG,regStep,editSvc,editBar,CSEL;
var calendarDate=new Date();
var selectedCalDay=new Date().toISOString().split('T')[0];
var FLAGS={ES:'🇪🇸',CO:'🇨🇴',MX:'🇲🇽',AR:'🇦🇷',DE:'🇩🇪',NL:'🇳🇱',FR:'🇫🇷',CL:'🇨🇱',PE:'🇵🇪',US:'🇺🇸',BR:'🇧🇷',VE:'🇻🇪',EC:'🇪🇨',DO:'🇩🇴'};
var MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var MONTHS_SHORT=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
var DEFAULT_HORARIO=[{day:'Lunes',open:true,from:'09:00',to:'20:00'},{day:'Martes',open:true,from:'09:00',to:'20:00'},{day:'Miércoles',open:true,from:'09:00',to:'20:00'},{day:'Jueves',open:true,from:'09:00',to:'20:00'},{day:'Viernes',open:true,from:'09:00',to:'20:00'},{day:'Sábado',open:true,from:'09:00',to:'16:00'},{day:'Domingo',open:false,from:'09:00',to:'14:00'}];

function defDB(){
  var today=new Date().toISOString().split('T')[0];
  return{admin:{auth:false},businesses:[{id:'la40barber',name:'La 40 Barber Shop',owner:'Versa Aguilar',email:'versa@la40.com',pass:'la40',phone:'+34611200984',addr:'Carrer Sant Blai 32',city:'Tortosa',country:'ES',type:'Barbería',joinDate:'2025-01-15',plan:'trial',desc:'Barbería profesional en el corazón de Tortosa.',photos:[],logo:'',insta:'',horario:DEFAULT_HORARIO.map(function(h){return Object.assign({},h);}),barbers:[{id:1,name:'Versa',spec:'Cortes clásicos y modernos',photo:''},{id:2,name:'Carlos',spec:'Barba y perfilado',photo:''}],services:[{id:1,name:'Corte de cabello',price:12,dur:30,desc:'Corte personalizado',photo:''},{id:2,name:'Arreglo de barba',price:8,dur:20,desc:'Perfilado y arreglo',photo:''},{id:3,name:'Rapado completo',price:10,dur:25,desc:'Máquina completa',photo:''},{id:4,name:'Corte + Barba',price:18,dur:45,desc:'Servicio completo',photo:''}],appointments:[{id:101,client:'Miguel R.',phone:'+34612222222',email:'',svc:'Corte de cabello',barber:'Versa',date:today,time:'10:00',price:12,status:'confirmed',notes:''},{id:102,client:'Juan M.',phone:'+34613333333',email:'',svc:'Arreglo de barba',barber:'Carlos',date:today,time:'11:00',price:8,status:'completed',notes:''},{id:103,client:'Pedro L.',phone:'+34614444444',email:'',svc:'Corte + Barba',barber:'Versa',date:today,time:'12:00',price:18,status:'pending',notes:''}]}],currentBiz:null};
}
function loadDB(){try{var d=localStorage.getItem(DBKEY);if(!d)return defDB();var p=JSON.parse(d);if(!p||typeof p!=='object')return defDB();if(!Array.isArray(p.businesses))p.businesses=[];if(!p.admin||typeof p.admin!=='object')p.admin={auth:false};return p;}catch(e){return defDB();}}
function saveDB(){try{if(DB&&typeof DB==='object')localStorage.setItem(DBKEY,JSON.stringify(DB));}catch(e){toast('⚠️ Almacenamiento lleno','#EF4444');}}

/* ══════════════════════════
   HELPERS
══════════════════════════ */
function money(n){return parseFloat(n||0).toFixed(2)+'€';}
function G(id){return document.getElementById(id);}
function V(id){var e=G(id);return e?e.value:'';}
function T(id,t){var e=G(id);if(e)e.textContent=sanitizeText(t);}
function H(id,h){var e=G(id);if(e)e.innerHTML=h;}
function on(id,ev,fn){var e=G(id);if(e)e.addEventListener(ev,fn);}
function openOv(id){var e=G(id);if(e)e.classList.add('on');}
function closeOv(id){var e=G(id);if(e)e.classList.remove('on');}
function showErr(id,msg){var e=G(id);if(e){e.textContent=msg;e.style.display='block';}}
function hideErr(id){var e=G(id);if(e)e.style.display='none';}
function initREG(){REG={type:'',name:'',owner:'',email:'',pass:'',phone:'',addr:'',city:'',country:'ES',teamSize:'',services:[],photos:[],logo:''};regStep=0;editSvc=null;editBar=null;}
function initCSEL(){CSEL={bizId:null,svc:null,svcPrice:0,svcDur:30,barber:'Cualquiera',date:null,time:null,clientName:'',clientPhone:'',clientEmail:''};}
function toast(msg,color){var old=document.querySelectorAll('.cpt');for(var i=0;i<old.length;i++)old[i].remove();var t=document.createElement('div');t.className='cpt';t.textContent=msg;t.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:var(--rpill);font-weight:700;font-size:14px;z-index:99999;pointer-events:none;color:#fff;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.5);background:'+(color||'#1A2540');document.body.appendChild(t);setTimeout(function(){if(t.parentNode)t.remove();},2800);}

/* ══════════════════════════
   NAVIGATION
══════════════════════════ */
function goTo(id){var ss=document.querySelectorAll('.scr');for(var i=0;i<ss.length;i++)ss[i].classList.remove('on');var s=G(id);if(s)s.classList.add('on');window.scrollTo(0,0);}
function goBiz(){goTo('s-biz');if(DB.currentBiz)showBizPanel();else showBizReg();}
function goClient(){goTo('s-portal');}
function goClientFromBiz(){if(CUR)loadBizDirect(CUR.id);else goTo('s-portal');}

/* ══════════════════════════
   SELECTOR DE PAÍS
══════════════════════════ */
function toggleCountryDropdown(){
  var dd=G('br-country-dropdown');
  if(!dd)return;
  dd.style.display=dd.style.display==='none'?'block':'none';
}
function selectCountry(code,label){
  var input=G('br-country');
  var display=G('br-country-label');
  var dd=G('br-country-dropdown');
  if(input)input.value=code;
  if(display)display.textContent=label;
  if(dd)dd.style.display='none';
}
window.toggleCountryDropdown=toggleCountryDropdown;
window.selectCountry=selectCountry;

/* ══════════════════════════
   MODAL: CREAR CUENTA
══════════════════════════ */
var _rmCode=null,_rmData={},_rmTimer=null;

function openRegModal(){
  ['rm-email','rm-phone','rm-pass','rm-pass2'].forEach(function(id){var e=G(id);if(e)e.value='';});
  var cb=G('rm-terms');if(cb)cb.checked=false;
  hideErr('rm-err1');hideErr('rm-err2');
  var s1=G('rm-step1'),s2=G('rm-step2');
  if(s1)s1.style.display='block';
  if(s2)s2.style.display='none';
  var bar=G('rm-pass-bar'),lbl=G('rm-pass-lbl');
  if(bar){bar.style.width='0';bar.style.background='rgba(74,127,212,.1)';}
  if(lbl)lbl.textContent='';
  [0,1,2,3,4,5].forEach(function(i){var b=G('rc'+i);if(b)b.value='';});
  _rmCode=null;_rmData={};
  if(_rmTimer)clearInterval(_rmTimer);
  openOv('ov-registro');
  setTimeout(function(){var e=G('rm-email');if(e)e.focus();},250);
}

function rmGoStep2(){
  var email=V('rm-email').trim().toLowerCase();
  var phone=sanitizeText(V('rm-phone').trim());
  var pass=V('rm-pass');
  var pass2=V('rm-pass2');
  var terms=G('rm-terms');
  hideErr('rm-err1');
  if(!email||!validEmail(email)){showErr('rm-err1','Introduce un correo electrónico válido.');return;}
  if(!phone||!validPhone(phone)){showErr('rm-err1','Introduce un teléfono válido (mínimo 7 dígitos).');return;}
  if(!pass||pass.length<6){showErr('rm-err1','La contraseña debe tener al menos 6 caracteres.');return;}
  if(pass!==pass2){showErr('rm-err1','Las contraseñas no coinciden. Verifícalas.');return;}
  if(!terms||!terms.checked){showErr('rm-err1','Debes aceptar los Términos y Condiciones para continuar.');return;}
  if(DB.businesses.filter(function(b){return(b.email||'').toLowerCase()===email;})[0]){showErr('rm-err1','Este correo ya tiene una cuenta registrada. Inicia sesión.');return;}
  _rmData={email:email,phone:phone,pass:pass};
  _rmCode=String(Math.floor(100000+Math.random()*900000));

  /* Enviar email de verificación con Resend */
  fetch('/.netlify/functions/send-email',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({type:'verification',to:email,data:{code:_rmCode}})
  }).catch(function(e){console.error('Email verificación:',e);});

  console.log('%c📧 Código: '+_rmCode,'background:#141824;color:#7EB8FF;font-size:15px;font-weight:bold;padding:8px 14px;border-radius:8px;border-left:4px solid #4A7FD4');
  toast('📧 Código enviado a '+email,'#4A7FD4');
  var conf=G('rm-email-confirm');
  if(conf)conf.innerHTML='Enviamos un código de 6 dígitos a <strong style="color:var(--text)">'+san(email)+'</strong>.<br><span style="font-size:12px;color:var(--muted)">Revisa también la carpeta de spam.</span>';
  var s1=G('rm-step1'),s2=G('rm-step2');
  if(s1)s1.style.display='none';
  if(s2)s2.style.display='block';
  [0,1,2,3,4,5].forEach(function(i){var b=G('rc'+i);if(b)b.value='';});
  hideErr('rm-err2');
  startResendTimer(60);
  setTimeout(function(){var b=G('rc0');if(b)b.focus();},200);
}

function rmVerify(){
  var code='';
  [0,1,2,3,4,5].forEach(function(i){var b=G('rc'+i);code+=(b?b.value:'');});
  hideErr('rm-err2');
  if(code.length<6){showErr('rm-err2','Introduce los 6 dígitos del código enviado a tu correo.');return;}
  if(code!==_rmCode){
    showErr('rm-err2','Código incorrecto. Comprueba tu email e inténtalo de nuevo.');
    var row=G('rm-code-row');
    if(row){row.style.animation='shake .4s ease';setTimeout(function(){row.style.animation='';},400);}
    [0,1,2,3,4,5].forEach(function(i){var b=G('rc'+i);if(b){b.style.borderColor='var(--red)';setTimeout(function(){b.style.borderColor='';},1500);}});
    return;
  }
  if(_rmTimer)clearInterval(_rmTimer);
  closeOv('ov-registro');
  toast('✅ Email verificado correctamente','#22C55E');
  setTimeout(function(){
    goBiz();
    setTimeout(function(){
      bizRegStep(2);
      var em=G('br-email');if(em){em.value=_rmData.email||'';}
      var ph=G('br-phone');if(ph){ph.value=_rmData.phone||'';}
      var ps=G('br-pass');if(ps){ps.value=_rmData.pass||'';updatePassStrength(_rmData.pass||'');}
    },150);
  },300);
}

function rmResend(){
  if(!_rmData.email)return;
  _rmCode=String(Math.floor(100000+Math.random()*900000));
  fetch('/.netlify/functions/send-email',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({type:'verification',to:_rmData.email,data:{code:_rmCode}})
  }).catch(function(e){console.error('Email reenvío:',e);});
  console.log('%c📧 Nuevo código: '+_rmCode,'background:#141824;color:#7EB8FF;font-size:15px;font-weight:bold;padding:8px 14px;border-radius:8px;border-left:4px solid #4A7FD4');
  toast('📧 Nuevo código enviado a '+_rmData.email,'#4A7FD4');
  [0,1,2,3,4,5].forEach(function(i){var b=G('rc'+i);if(b)b.value='';});
  hideErr('rm-err2');
  startResendTimer(60);
  setTimeout(function(){var b=G('rc0');if(b)b.focus();},100);
}

function startResendTimer(secs){
  if(_rmTimer)clearInterval(_rmTimer);
  var btn=G('rm-btn-resend'),timer=G('rm-resend-timer');
  if(btn)btn.style.display='none';
  if(timer)timer.style.display='block';
  var r=secs;
  function tick(){r--;if(timer)timer.textContent='Puedes reenviar en '+r+'s';if(r<=0){clearInterval(_rmTimer);if(btn)btn.style.display='block';if(timer)timer.style.display='none';}}
  tick();_rmTimer=setInterval(tick,1000);
}

function codeInput(idx){
  var cur=G('rc'+idx);
  if(!cur)return;
  cur.value=cur.value.replace(/[^0-9]/g,'');
  if(cur.value&&idx<5){var nx=G('rc'+(idx+1));if(nx)nx.focus();}
  var all=true;
  [0,1,2,3,4,5].forEach(function(i){var b=G('rc'+i);if(!b||!b.value)all=false;});
  if(all)setTimeout(rmVerify,300);
}

function codeKey(e,idx){
  if(e.key==='Backspace'&&!G('rc'+idx).value&&idx>0){var p=G('rc'+(idx-1));if(p){p.value='';p.focus();}}
  if(e.key==='ArrowLeft'&&idx>0){var prev=G('rc'+(idx-1));if(prev)prev.focus();}
  if(e.key==='ArrowRight'&&idx<5){var next=G('rc'+(idx+1));if(next)next.focus();}
}

/* ══════════════════════════
   MODAL: LOGIN
══════════════════════════ */
function openLoginModal(){
  var em=G('li-email'),ps=G('li-pass');
  if(em)em.value='';if(ps)ps.value='';
  hideErr('li-err');
  closeOv('ov-registro');
  openOv('ov-login');
  setTimeout(function(){var e=G('li-email');if(e)e.focus();},250);
}

function doLogin(){
  var email=V('li-email').trim().toLowerCase();
  var pass=V('li-pass');
  hideErr('li-err');
  if(!email||!validEmail(email)){showErr('li-err','Introduce un correo electrónico válido.');return;}
  if(!pass){showErr('li-err','Introduce tu contraseña.');return;}
  var key='login_'+email;
  if(!checkRateLimit(key)){showErr('li-err','Demasiados intentos fallidos. Espera 5 minutos e inténtalo de nuevo.');return;}
  var biz=DB.businesses.filter(function(b){return(b.email||'').toLowerCase()===email&&b.pass===pass;})[0];
  if(biz){
    resetRateLimit(key);
    if(biz.plan==='expired'){showErr('li-err','Tu suscripción ha vencido. Contacta con soporte por WhatsApp.');return;}
    DB.currentBiz=biz.id;saveDB();
    closeOv('ov-login');
    toast('✅ Bienvenido/a '+san(biz.owner||biz.name),'#22C55E');
    setTimeout(function(){goBiz();},300);
  } else {
    showErr('li-err','Email o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.');
    var p=G('li-pass');if(p)p.value='';
  }
}

/* ══════════════════════════
   MODAL: RECUPERAR CONTRASEÑA
══════════════════════════ */
function openForgotModal(){
  var em=G('fp-email');if(em)em.value='';
  hideErr('fp-err');
  var suc=G('fp-success');if(suc)suc.style.display='none';
  closeOv('ov-login');
  openOv('ov-forgot');
  setTimeout(function(){var e=G('fp-email');if(e)e.focus();},250);
}

function doForgot(){
  var email=V('fp-email').trim().toLowerCase();
  hideErr('fp-err');
  if(!email||!validEmail(email)){showErr('fp-err','Introduce un correo electrónico válido.');return;}
  var exists=DB.businesses.filter(function(b){return(b.email||'').toLowerCase()===email;})[0];
  if(!exists){showErr('fp-err','No encontramos una cuenta con ese correo. Verifica el email o crea una cuenta nueva.');return;}
  var suc=G('fp-success');if(suc)suc.style.display='block';
  var btn=G('fp-btn-send');if(btn)btn.style.display='none';
  toast('📧 Instrucciones enviadas a '+email,'#4A7FD4');
  console.log('%c🔑 Recuperación para: '+email,'background:#141824;color:#7EB8FF;font-size:14px;padding:8px 14px;border-radius:8px');
}

/* ══════════════════════════
   SUPER ADMIN
══════════════════════════ */
function dotsLogin(){
  var email=V('dots-email').trim().toLowerCase();
  var pass=V('dots-pass');
  hideErr('dots-err');
  if(!email||!pass){showErr('dots-err','Completa todos los campos.');return;}
  var key='dots_'+email;
  if(!checkRateLimit(key)){showErr('dots-err','Demasiados intentos. Espera 5 minutos.');return;}
  if(email==='virche70021261@gmail.com'&&pass==='Versa70021261*#'){
    resetRateLimit(key);DB.admin.auth=true;saveDB();
    hideErr('dots-err');closeOv('ov-admin');
    goTo('s-admin');showAdminPanel();
    toast('✅ Bienvenida, Versa 👑','#2855C8');
  } else {
    showErr('dots-err','Credenciales incorrectas.');
    var p=G('dots-pass');if(p){p.value='';p.focus();}
  }
}

function doAdminLogin(){
  var email=V('adm-email').trim().toLowerCase();
  var pass=V('adm-pass');
  hideErr('adm-err');
  if(!email||!pass){showErr('adm-err','Escribe email y contraseña.');return;}
  var key='admin_'+email;
  if(!checkRateLimit(key)){showErr('adm-err','Demasiados intentos. Espera 5 minutos.');return;}
  if(email==='virche70021261@gmail.com'&&pass==='Versa70021261*#'){
    resetRateLimit(key);DB.admin.auth=true;saveDB();hideErr('adm-err');showAdminPanel();
  } else {
    showErr('adm-err','Credenciales incorrectas.');
    var p=G('adm-pass');if(p){p.value='';p.focus();}
  }
}
function doAdminLogout(){DB.admin.auth=false;saveDB();var l=G('adm-login'),p=G('adm-panel');if(l)l.style.display='flex';if(p)p.style.display='none';}
function showAdminPanel(){var l=G('adm-login'),p=G('adm-panel');if(l)l.style.display='none';if(p)p.style.display='block';renderDash();checkNotifications();}

function admTab(tab){
  var tabs=['dashboard','negocios','suscripciones','ingresos','notificaciones','config'];
  for(var i=0;i<tabs.length;i++){var t=tabs[i];var pa=G('ap-'+t),bt=G('at-'+t);if(pa)pa.classList[t===tab?'add':'remove']('on');if(bt)bt.classList[t===tab?'add':'remove']('on');}
  if(tab==='negocios')renderBizListAdmin(filterBiz());
  if(tab==='suscripciones')renderSubs();
  if(tab==='ingresos')renderRevenue();
  if(tab==='notificaciones')renderNotifications();
}

function filterBiz(){var q=(V('biz-search')||'').toLowerCase();var f=(V('biz-filter')||'all');return DB.businesses.filter(function(b){var mq=!q||(b.name||'').toLowerCase().indexOf(q)>=0||(b.city||'').toLowerCase().indexOf(q)>=0||(b.owner||'').toLowerCase().indexOf(q)>=0;var mf=f==='all'||(b.plan||'')==f;return mq&&mf;});}
function filterClientBiz(){renderBizListAdmin(filterBiz());}

function renderDash(){
  var bizs=DB.businesses,active=0,trial=0,appts=0,ctry={};
  for(var i=0;i<bizs.length;i++){var b=bizs[i];if(b.plan==='active')active++;else if(b.plan==='trial')trial++;appts+=(b.appointments||[]).length;if(b.country)ctry[b.country]=1;}
  var mrr=active*10,now=new Date();
  T('adm-date',MONTHS[now.getMonth()]+' '+now.getDate()+', '+now.getFullYear());
  T('ds-total',bizs.length);T('ds-sub',active+' activos · '+trial+' en prueba');
  T('ds-mrr',money(mrr));T('ds-trial',trial);T('ds-appts',appts);T('ds-arr',money(mrr*12));
  var cl=Object.keys(ctry);T('ds-countries',cl.length);
  T('ds-flags',cl.map(function(c){return FLAGS[c]||'🌍';}).join(' '));
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

function planTag(plan){var m={active:{c:'#22C55E',l:'✅ Activo'},trial:{c:'#F59E0B',l:'🎁 Prueba'},expired:{c:'#EF4444',l:'❌ Vencido'}};var x=m[plan]||{c:'#475569',l:'—'};return'<span style="background:'+x.c+'22;color:'+x.c+';border:1px solid '+x.c+'44;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">'+x.l+'</span>';}

function bizCardH(b){
  var rev=(b.appointments||[]).reduce(function(s,a){return s+(a.price||0);},0);
  var av=b.logo?'<img src="'+sanitizeImageDataURL(b.logo)+'" style="width:100%;height:100%;object-fit:cover" alt="Logo">':'<span>'+san((b.name||'?').charAt(0))+'</span>';
  return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:10px;cursor:pointer;transition:all .15s" onclick="openBizProfile(\''+sanitizeText(b.id)+'\')">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">'
    +'<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff;flex-shrink:0;overflow:hidden">'+av+'</div>'
    +'<div style="flex:1"><div style="font-size:14px;font-weight:800">'+san(b.name)+'</div><div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(b.owner)+' · '+(FLAGS[b.country]||'🌍')+' '+san(b.city||'')+'</div></div>'
    +planTag(b.plan)+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    +'<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--blue)">'+(b.barbers?b.barbers.length:0)+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Profesionales</div></div>'
    +'<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800">'+(b.appointments?b.appointments.length:0)+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Citas</div></div>'
    +'<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--green)">'+money(rev)+'</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Facturado</div></div>'
    +'</div></div>';
}

function openBizProfile(bizId){
  var b=DB.businesses.filter(function(x){return x.id===bizId;})[0];if(!b)return;
  var rev=(b.appointments||[]).reduce(function(s,a){return s+(a.price||0);},0);
  var todayA=(b.appointments||[]).filter(function(a){return a.date===new Date().toISOString().split('T')[0];});
  var av=b.logo?'<img src="'+sanitizeImageDataURL(b.logo)+'" style="width:100%;height:100%;object-fit:cover" alt="Logo">':san((b.name||'?').charAt(0));
  H('adm-biz-profile',
    '<div style="display:flex;align-items:center;gap:14px;background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:22px;padding:16px;margin-bottom:16px">'
    +'<div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0">'+av+'</div>'
    +'<div style="flex:1"><div style="font-size:18px;font-weight:800">'+san(b.name)+'</div>'
    +'<div style="font-size:12px;color:var(--t2);margin-top:4px;line-height:2">👤 '+san(b.owner)+'<br>📱 '+san(b.phone||'—')+'<br>📧 '+san(b.email||'—')+'<br>📍 '+san((b.addr||'')+' '+(b.city||''))+'<br>🏷️ '+san(b.type||'—')+'</div>'
    +'<div style="margin-top:8px">'+planTag(b.plan)+'</div></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    +'<div class="sbox"><div class="slbl">Profesionales</div><div class="snum" style="color:var(--blue)">'+(b.barbers?b.barbers.length:0)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Citas totales</div><div class="snum">'+(b.appointments?b.appointments.length:0)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Facturado</div><div class="snum" style="color:var(--green)">'+money(rev)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Citas hoy</div><div class="snum" style="color:var(--blue)">'+todayA.length+'</div></div></div>'
    +(b.desc?'<div class="card" style="margin-bottom:12px;font-size:13px;color:var(--t2);line-height:1.6">'+san(b.desc)+'</div>':'')
    +'<div style="background:var(--bg3);border-radius:11px;padding:12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">'
    +'<span style="font-size:13px;color:var(--blue3);font-weight:600;word-break:break-all;flex:1">🔗 citas-pro.netlify.app/b/'+sanitizeText(b.id)+'</span>'
    +'<button onclick="copyText(\'https://citas-pro.netlify.app/b/'+sanitizeText(b.id)+'\')" style="flex-shrink:0;padding:6px 12px;border-radius:8px;background:var(--bblue);color:var(--blue);font-size:12px;font-weight:700;border:1px solid rgba(74,127,212,.25);cursor:pointer;font-family:var(--font)">Copiar</button></div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
    +'<button onclick="extendTrial(\''+sanitizeText(b.id)+'\')" class="btn btn-dark btn-sm" style="flex:1">⏰ Extender prueba</button>'
    +'<button onclick="activateBiz(\''+sanitizeText(b.id)+'\')" class="btn btn-green btn-sm" style="flex:1">✅ Activar</button>'
    +'<button onclick="suspendBiz(\''+sanitizeText(b.id)+'\')" class="btn btn-red btn-sm" style="flex:1">❌ Suspender</button></div>'
  );
  openOv('ov-biz-profile');
}

function renderBizListAdmin(bizs){H('adm-biz-list',bizs.length?bizs.map(bizCardH).join(''):'<div style="text-align:center;color:var(--muted);padding:40px"><div style="font-size:36px;margin-bottom:12px">🔍</div><div>No se encontraron negocios</div></div>');}
function renderSubs(){H('adm-subs',DB.businesses.length?DB.businesses.map(function(b){return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px"><div style="flex:1"><div style="font-weight:700;font-size:14px">'+san(b.name)+'</div><div style="font-size:12px;color:var(--t2);margin-top:3px">'+san(b.email)+'</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Desde '+san(b.joinDate||'—')+'</div></div>'+planTag(b.plan)+'</div>';}).join(''):'<div style="text-align:center;color:var(--muted);padding:40px">Sin negocios registrados</div>');}
function renderRevenue(){var active=DB.businesses.filter(function(b){return b.plan==='active';}).length;var m=active*10;T('rev-m',money(m));T('rev-y',money(m*12));T('rev-p6',money(m*1.8));T('rev-p12',money(m*2.5));H('adm-proj',[{l:'Mes actual ('+active+' activos)',v:m,c:'var(--green)'},{l:'En 3 meses (estimado)',v:m*1.3,c:'var(--blue)'},{l:'En 6 meses (estimado)',v:m*1.8,c:'var(--gold)'},{l:'En 1 año (estimado)',v:m*2.5,c:'var(--green)'}].map(function(r){return'<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">'+r.l+'</span><span style="font-weight:800;font-size:17px;color:'+r.c+'">'+money(r.v)+'</span></div>';}).join(''));}
function checkNotifications(){var notifs=[];DB.businesses.forEach(function(b){if(b.plan==='trial')notifs.push({type:'trial',msg:b.name+' está en período de prueba',biz:b.id,color:'#F59E0B'});if(b.plan==='expired')notifs.push({type:'expired',msg:b.name+' tiene la suscripción vencida',biz:b.id,color:'#EF4444'});});var week=new Date();week.setDate(week.getDate()-7);DB.businesses.forEach(function(b){if(b.joinDate&&new Date(b.joinDate)>=week)notifs.push({type:'new',msg:'Nuevo: '+b.name+' de '+(b.city||b.country||'—'),biz:b.id,color:'#22C55E'});});var dot=G('notif-dot');if(dot)dot.classList[notifs.length>0?'add':'remove']('on');window._notifs=notifs;}
function renderNotifications(){var notifs=window._notifs||[];H('notif-content',notifs.length?notifs.map(function(n){return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openBizProfile(\''+sanitizeText(n.biz)+'\')">'+'<div style="width:40px;height:40px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;background:'+n.color+'22">'+({trial:'⏰',expired:'❌',new:'🆕'}[n.type]||'🔔')+'</div><div style="flex:1"><div style="font-size:13px;font-weight:600">'+san(n.msg)+'</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Toca para ver detalles</div></div><span style="color:var(--muted);font-size:16px">›</span></div>';}).join(''):'<div style="text-align:center;color:var(--muted);padding:36px"><div style="font-size:32px;margin-bottom:10px">🎉</div><div>Sin notificaciones</div></div>');}
function extendTrial(id){var b=DB.businesses.filter(function(x){return x.id===id;})[0];if(b){b.plan='trial';saveDB();toast('⏰ Prueba extendida','#F59E0B');checkNotifications();closeOv('ov-biz-profile');renderBizListAdmin(filterBiz());}}
function activateBiz(id){var b=DB.businesses.filter(function(x){return x.id===id;})[0];if(b){b.plan='active';saveDB();toast('✅ Negocio activado','#22C55E');checkNotifications();closeOv('ov-biz-profile');renderBizListAdmin(filterBiz());renderDash();}}
function suspendBiz(id){var b=DB.businesses.filter(function(x){return x.id===id;})[0];if(b){b.plan='expired';saveDB();toast('❌ Negocio suspendido','#EF4444');checkNotifications();closeOv('ov-biz-profile');renderBizListAdmin(filterBiz());renderDash();}}
function copyText(txt){try{navigator.clipboard.writeText(txt);}catch(e){}toast('📋 Copiado','#4A7FD4');}

/* ══════════════════════════
   BIZ PANEL
══════════════════════════ */
function showBizReg(){var r=G('biz-reg'),p=G('biz-panel');if(r)r.style.display='block';if(p)p.style.display='none';initREG();showRegStep(0);}
function showBizPanel(){var r=G('biz-reg'),p=G('biz-panel');if(r)r.style.display='none';if(p)p.style.display='block';DB=loadDB();CUR=DB.currentBiz?DB.businesses.filter(function(b){return b.id===DB.currentBiz;})[0]:null;if(CUR)initBizPanel();}
function bizLogout(){DB.currentBiz=null;saveDB();CUR=null;showBizReg();}

function showRegStep(n){var steps=document.querySelectorAll('.reg-step');for(var i=0;i<steps.length;i++)steps[i].classList.remove('on');var s=G('rs-'+n);if(s)s.classList.add('on');regStep=n;window.scrollTo(0,0);}

function bizRegStep(n){
  if(n>regStep){
    if(regStep===1&&!REG.type){toast('Selecciona el tipo de negocio','#EF4444');return;}
    if(regStep===2){
      var bn=sanitizeText(V('br-bizname')),em=V('br-email').trim(),ps=V('br-pass');
      if(!bn){toast('Escribe el nombre del negocio','#EF4444');return;}
      if(!validEmail(em)){toast('Email inválido','#EF4444');return;}
      if(ps.length<6){toast('Contraseña mínimo 6 caracteres','#EF4444');return;}
      if(DB.businesses.filter(function(b){return(b.email||'').toLowerCase()===em.toLowerCase();})[0]){toast('Email ya registrado','#EF4444');return;}
      REG.name=bn;REG.owner=sanitizeText(V('br-owner'));REG.email=em.toLowerCase();REG.pass=ps;REG.phone=sanitizeText(V('br-phone'));
    }
    if(regStep===3){REG.addr=sanitizeText(V('br-addr'));REG.city=sanitizeText(V('br-city'));REG.country=sanitizeText(V('br-country'))||'ES';}
    if(regStep===6&&!REG.services.length){toast('Añade al menos un servicio','#EF4444');return;}
    if(n===7)finalizeBizReg();
  }
  showRegStep(n);
}

function selType(id,type){document.querySelectorAll('.typbtn').forEach(function(b){b.classList.remove('sel');});var b=G(id);if(b)b.classList.add('sel');REG.type=type;}
function selSize(id,size){document.querySelectorAll('.szopt').forEach(function(b){b.classList.remove('sel');});var o=G(id);if(o)o.classList.add('sel');REG.teamSize=size;}

function updatePassStrength(pass){
  var s=passStrength(pass);
  var bar=G('pass-strength'),lbl=G('pass-strength-lbl');
  var configs=[{c:'#EF4444',t:'Muy débil',w:'20%'},{c:'#EF4444',t:'Débil',w:'40%'},{c:'#F59E0B',t:'Regular',w:'60%'},{c:'#22C55E',t:'Buena',w:'80%'},{c:'#22C55E',t:'Muy segura ✓',w:'100%'}];
  var cfg=configs[Math.min(s,4)];
  if(bar){bar.style.background=cfg.c;bar.style.width=pass.length?cfg.w:'0%';}
  if(lbl){lbl.textContent=pass.length?cfg.t:'';lbl.style.color=cfg.c;}
}

function updateRmPassStrength(pass){
  var s=passStrength(pass);
  var bar=G('rm-pass-bar'),lbl=G('rm-pass-lbl');
  var configs=[{c:'#EF4444',t:'Muy débil',w:'20%'},{c:'#EF4444',t:'Débil',w:'40%'},{c:'#F59E0B',t:'Regular',w:'60%'},{c:'#22C55E',t:'Buena',w:'80%'},{c:'#22C55E',t:'Muy segura ✓',w:'100%'}];
  var cfg=configs[Math.min(s,4)];
  if(bar){bar.style.background=cfg.c;bar.style.width=pass.length?cfg.w:'0%';}
  if(lbl){lbl.textContent=pass.length?cfg.t:'';lbl.style.color=cfg.c;}
}

function setupPhotoUpload(){
  function handleImg(inputId,onLoad){var el=G(inputId);if(!el)return;el.addEventListener('change',function(e){var f=e.target.files[0];if(!f||!validImageType(f)){toast('Solo JPG/PNG/WebP (máx 5MB)','#EF4444');return;}var r=new FileReader();r.onload=function(ev){var d=sanitizeImageDataURL(ev.target.result);if(d)onLoad(d);};r.readAsDataURL(f);});}
  function handleImgs(inputId,onLoad){var el=G(inputId);if(!el)return;el.addEventListener('change',function(e){Array.from(e.target.files).forEach(function(f){if(!validImageType(f))return;var r=new FileReader();r.onload=function(ev){var d=sanitizeImageDataURL(ev.target.result);if(d)onLoad(d);};r.readAsDataURL(f);});});}
  handleImg('logo-input',function(d){REG.logo=d;var p=G('logo-preview');if(p){p.style.backgroundImage='url('+d+')';p.style.backgroundSize='cover';p.style.backgroundPosition='center';p.innerHTML='';}});
  handleImgs('svc-photo-input',function(d){if(REG.photos.length>=12){toast('Máximo 12 fotos','#EF4444');return;}REG.photos.push(d);renderRegPhotos();});
  handleImgs('gallery-input',function(d){if(CUR){if(!CUR.photos)CUR.photos=[];if(CUR.photos.length>=20){toast('Máximo 20 fotos','#EF4444');return;}CUR.photos.push(d);saveDB();renderGallery();}});
  handleImg('bar-photo-input',function(d){window._barPhoto=d;var p=G('bar-photo-preview');if(p)p.innerHTML='<img src="'+d+'" class="photo-preview" alt="Foto"/>';});
  handleImg('sv-photo-input',function(d){window._svcPhoto=d;var p=G('sv-photo-preview');if(p)p.innerHTML='<img src="'+d+'" class="photo-preview" alt="Foto"/>';});
}

function renderRegPhotos(){var grid=G('service-photos-reg');if(!grid)return;grid.innerHTML=REG.photos.map(function(p,i){return'<div class="img-thumb"><img src="'+sanitizeImageDataURL(p)+'" alt="Foto '+(i+1)+'"><button onclick="REG.photos.splice('+i+',1);renderRegPhotos();" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button></div>';}).join('')+'<div class="img-thumb add-btn" onclick="document.getElementById(\'svc-photo-input\').click()">＋</div>';}
function renderGallery(){if(!CUR)return;var grid=G('biz-gallery');if(!grid)return;var photos=CUR.photos||[];grid.innerHTML=photos.map(function(p,i){return'<div class="img-thumb"><img src="'+sanitizeImageDataURL(p)+'" alt="Foto '+(i+1)+'"><button onclick="delGalleryPhoto('+i+')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button></div>';}).join('');}
function delGalleryPhoto(idx){if(CUR){CUR.photos=(CUR.photos||[]).filter(function(_,i){return i!==idx;});saveDB();renderGallery();toast('Foto eliminada','#475569');}}

function openSvcModal(id){
  editSvc=id;window._svcPhoto=null;
  T('svc-ttl',id?'Editar servicio':'Añadir servicio');
  var reset=function(){var p=G('sv-photo-preview');if(p)p.innerHTML='<div style="font-size:28px;margin-bottom:6px">📷</div><div style="font-size:13px;color:var(--muted)">Añadir foto</div>';};
  if(id&&CUR){var s=CUR.services.filter(function(x){return x.id===id;})[0];if(s){var n=G('sv-name'),p=G('sv-price'),d=G('sv-dur'),ds=G('sv-desc');if(n)n.value=s.name;if(p)p.value=s.price;if(d)d.value=s.dur;if(ds)ds.value=s.desc||'';var pv=G('sv-photo-preview');if(pv&&s.photo)pv.innerHTML='<img src="'+sanitizeImageDataURL(s.photo)+'" class="photo-preview" alt="Servicio"/>';else reset();}
  }else{['sv-name','sv-price','sv-desc'].forEach(function(i2){var e=G(i2);if(e)e.value='';});var dv=G('sv-dur');if(dv)dv.value='30';reset();}
  openOv('ov-svc');
}

function saveSvc(){
  var name=sanitizeText(V('sv-name')),price=safeNum(V('sv-price'),0),dur=safeInt(V('sv-dur'),30),desc=sanitizeText(V('sv-desc'));
  var photo=window._svcPhoto||null;
  if(!name){toast('Nombre requerido','#EF4444');return;}
  if(CUR){
    if(!CUR.services)CUR.services=[];
    if(editSvc){var s=CUR.services.filter(function(x){return x.id===editSvc;})[0];if(s){s.name=name;s.price=price;s.dur=dur;s.desc=desc;if(photo)s.photo=photo;}}
    else CUR.services.push({id:Date.now(),name:name,price:price,dur:dur,desc:desc,photo:photo||''});
    saveDB();renderBizServices();
  }else{
    if(editSvc){var sr=REG.services.filter(function(x){return x.id===editSvc;})[0];if(sr){sr.name=name;sr.price=price;sr.dur=dur;sr.desc=desc;if(photo)sr.photo=photo;}}
    else REG.services.push({id:Date.now(),name:name,price:price,dur:dur,desc:desc,photo:photo||''});
    renderRegSvcs();
  }
  editSvc=null;window._svcPhoto=null;closeOv('ov-svc');toast('✅ Servicio guardado','#4A7FD4');
}

function renderRegSvcs(){H('reg-svc-list',(REG.services||[]).map(function(s){var thumb=s.photo?'<img src="'+sanitizeImageDataURL(s.photo)+'" style="width:42px;height:42px;border-radius:11px;object-fit:cover;flex-shrink:0" alt="Servicio">':'<div style="width:42px;height:42px;border-radius:11px;background:var(--bblue);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">✂️</div>';return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:12px;display:flex;align-items:center;gap:12px;margin-bottom:8px">'+thumb+'<div style="flex:1"><div style="font-weight:700;font-size:14px">'+san(s.name)+'</div><div style="font-size:12px;color:var(--muted);margin-top:2px">'+s.dur+'min</div></div><span style="font-weight:700;color:var(--blue);font-size:14px">'+money(s.price)+'</span><button data-id="'+sanitizeText(s.id)+'" class="del-rs" style="font-size:15px;cursor:pointer;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:6px;color:var(--red)">🗑</button></div>';}).join(''));document.querySelectorAll('.del-rs').forEach(function(b){b.addEventListener('click',function(){var id=b.getAttribute('data-id');REG.services=REG.services.filter(function(s){return String(s.id)!==id;});renderRegSvcs();});});}

function finalizeBizReg(){
  if(DB.businesses.filter(function(b){return(b.email||'').toLowerCase()===REG.email.toLowerCase();})[0]){toast('Email ya registrado','#EF4444');showRegStep(2);return;}
  var slug=(REG.name||'negocio').toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').slice(0,20)+'-'+Date.now().toString(36);
  var biz={id:slug,name:REG.name,owner:REG.owner,email:REG.email,pass:REG.pass,phone:REG.phone,addr:REG.addr,city:REG.city,country:REG.country,type:REG.type,teamSize:REG.teamSize,joinDate:new Date().toISOString().split('T')[0],plan:'trial',desc:'',logo:REG.logo||'',photos:REG.photos||[],insta:'',horario:DEFAULT_HORARIO.map(function(h){return Object.assign({},h);}),barbers:[{id:1,name:REG.owner||'Yo',spec:REG.type||'Profesional',photo:''}],services:REG.services,appointments:[]};
  DB.businesses.push(biz);DB.currentBiz=slug;saveDB();
  T('biz-link-display','citas-pro.netlify.app/b/'+slug);
  T('neg-badge',DB.businesses.length);
  var waLink=G('wa-share-link');if(waLink)waLink.href='https://wa.me/?text='+encodeURIComponent('📅 Reserva tu cita en '+REG.name+' → https://citas-pro.netlify.app/b/'+slug);
  checkNotifications();
}
function completeBizReg(){CUR=DB.businesses.filter(function(b){return b.id===DB.currentBiz;})[0];if(CUR)showBizPanel();else showRegStep(0);}
function copyLink(){var link='citas-pro.netlify.app/b/'+(CUR?CUR.id:DB.currentBiz||'mi-negocio');try{navigator.clipboard.writeText('https://'+link);}catch(e){}toast('📋 Link copiado','#4A7FD4');}

function initBizPanel(){
  if(!CUR)return;
  var hr=new Date().getHours(),g=hr<12?'Buenos días':hr<18?'Buenas tardes':'Buenas noches';
  T('biz-greeting',g+' '+(CUR.owner||'').split(' ')[0]+' 👋');
  T('biz-hdr-nm',CUR.name);
  var planEl=G('biz-hdr-plan');if(planEl){planEl.textContent=CUR.plan==='active'?'✅ Plan activo':CUR.plan==='trial'?'🎁 Prueba gratis':'❌ Suscripción vencida';planEl.style.color=CUR.plan==='active'?'var(--green)':CUR.plan==='trial'?'var(--gold)':'var(--red)';}
  var av=G('biz-hdr-av');if(av){if(CUR.logo){av.innerHTML='<img src="'+sanitizeImageDataURL(CUR.logo)+'" style="width:100%;height:100%;object-fit:cover" alt="Logo">';}else{av.textContent=(CUR.name||'?').charAt(0).toUpperCase();}}
  var today=new Date().toISOString().split('T')[0];
  var appts=CUR.appointments||[];
  var todayA=appts.filter(function(a){return a.date===today&&a.status!=='cancelled';});
  var thisWeekStart=new Date();thisWeekStart.setDate(thisWeekStart.getDate()-thisWeekStart.getDay());
  var thisMonthStart=new Date();thisMonthStart.setDate(1);
  var weekA=appts.filter(function(a){return a.date>=thisWeekStart.toISOString().split('T')[0]&&a.status!=='cancelled';});
  var monthA=appts.filter(function(a){return a.date>=thisMonthStart.toISOString().split('T')[0]&&a.status!=='cancelled';});
  T('bh-today',todayA.length);T('bh-rev',money(todayA.reduce(function(s,a){return s+(a.price||0);},0)));
  T('bh-week',weekA.length);T('bh-month',money(monthA.reduce(function(s,a){return s+(a.price||0);},0)));
  var link='citas-pro.netlify.app/b/'+CUR.id;
  T('biz-link-show',link);
  var wah=G('wa-share-home');if(wah)wah.href='https://wa.me/?text='+encodeURIComponent('📅 Reserva tu cita en '+CUR.name+' → https://'+link);
  renderTodayAppts(todayA);renderBizBarbers();renderBizServices();renderGallery();renderBizFinances();renderHorario();renderCalendar();initAgenda();
  var pf=G('pf-nm');if(pf)pf.value=CUR.name||'';var pa=G('pf-addr');if(pa)pa.value=CUR.addr||'';var pp=G('pf-phone');if(pp)pp.value=CUR.phone||'';var pi=G('pf-insta');if(pi)pi.value=CUR.insta||'';var pd=G('pf-desc');if(pd)pd.value=CUR.desc||'';
  var ps=G('pf-plan-status');if(ps)ps.textContent=CUR.plan==='active'?'Plan activo · Próxima factura el día 1':CUR.plan==='trial'?'En período de prueba gratuito':'Suscripción vencida — contacta soporte';
  var pb=G('pf-plan-badge');if(pb)pb.innerHTML=planTag(CUR.plan);
  bizTab('home');
}

function renderTodayAppts(appts){if(!appts&&CUR){var today=new Date().toISOString().split('T')[0];appts=(CUR.appointments||[]).filter(function(a){return a.date===today;});}H('bh-appts',appts.length?appts.map(function(a){return apptRowH(a);}).join(''):'<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:28px;margin-bottom:8px">📅</div><div style="font-size:13px">Sin citas para hoy</div></div>');}

function apptRowH(a){
  var sc={confirmed:{c:'var(--blue)',bg:'rgba(74,127,212,.1)',l:'✓ Conf.'},pending:{c:'var(--gold)',bg:'rgba(245,158,11,.1)',l:'⏳ Pend.'},completed:{c:'var(--green)',bg:'rgba(34,197,94,.1)',l:'✓ Hecho'},cancelled:{c:'var(--red)',bg:'rgba(239,68,68,.1)',l:'✗ Canc.'}}[a.status]||{c:'var(--blue)',bg:'rgba(74,127,212,.1)',l:'✓ Conf.'};
  var initials=san((a.client||'?').split(' ').map(function(n){return n[0]||'';}).slice(0,2).join('').toUpperCase());
  return'<div class="appt-row" onclick="openApptDetail(\''+sanitizeText(a.id)+'\')"><div class="appt-avatar">'+initials+'</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+san(a.client)+'</div><div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(a.svc)+' · '+san(a.barber)+'</div>'+(a.notes?'<div style="font-size:11px;color:var(--muted);margin-top:2px;font-style:italic">'+san(a.notes)+'</div>':'')+'</div><div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:15px;color:var(--blue)">'+money(a.price)+'</div><div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(a.time)+'</div><div style="margin-top:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:'+sc.bg+';color:'+sc.c+'">'+sc.l+'</div></div></div>';
}

function openApptDetail(id){
  if(!CUR)return;
  var a=null;CUR.appointments.forEach(function(ap){if(String(ap.id)===String(id))a=ap;});if(!a)return;
  H('appt-detail-content',
    '<div style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--r);padding:16px;margin-bottom:14px">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'
    +'<div class="appt-avatar" style="width:52px;height:52px;font-size:20px">'+san((a.client||'?').split(' ').map(function(n){return n[0]||'';}).slice(0,2).join('').toUpperCase())+'</div>'
    +'<div><div style="font-size:18px;font-weight:900">'+san(a.client)+'</div>'
    +(a.phone?'<div style="font-size:14px;color:var(--blue3);margin-top:3px;font-weight:600">📱 '+san(a.phone)+'</div>':'')
    +(a.email?'<div style="font-size:13px;color:var(--t2);margin-top:2px">📧 '+san(a.email)+'</div>':'')
    +'</div></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    +'<div class="sbox"><div class="slbl">📅 Fecha</div><div style="font-size:14px;font-weight:700">'+san(a.date)+'</div></div>'
    +'<div class="sbox"><div class="slbl">⏰ Hora</div><div style="font-size:18px;font-weight:900;color:var(--blue)">'+san(a.time)+'</div></div>'
    +'<div class="sbox"><div class="slbl">✂️ Servicio</div><div style="font-size:13px;font-weight:700">'+san(a.svc)+'</div></div>'
    +'<div class="sbox"><div class="slbl">💰 Total</div><div style="font-size:18px;font-weight:900;color:var(--green)">'+money(a.price)+'</div></div>'
    +'</div>'
  );
  var waBtn=G('appt-wa-btn');if(waBtn&&a.phone)waBtn.href='https://wa.me/'+a.phone.replace(/\D/g,'')+'?text='+encodeURIComponent('Hola '+a.client+', te recordamos tu cita en '+CUR.name+' el '+a.date+' a las '+a.time+'. ✂️');
  var cb=G('appt-complete-btn');if(cb)cb.onclick=function(){updateApptStatus(id,'completed');};
  var ca=G('appt-cancel-btn');if(ca)ca.onclick=function(){updateApptStatus(id,'cancelled');};
  openOv('ov-appt-detail');
}

function updateApptStatus(id,status){if(!CUR)return;CUR.appointments.forEach(function(a){if(String(a.id)===String(id))a.status=status;});saveDB();closeOv('ov-appt-detail');renderTodayAppts();initAgenda();renderBizFinances();toast(status==='completed'?'✅ Cita completada':'✗ Cita cancelada',status==='completed'?'#22C55E':'#EF4444');}

function bizTab(tab){var tabs=['home','agenda','equipo','servicios','galeria','finanzas','horario','perfil'];for(var i=0;i<tabs.length;i++){var t=tabs[i];var pa=G('bp-'+t),bt=G('bn-'+t);if(pa)pa.classList[t===tab?'add':'remove']('on');if(bt)bt.classList[t===tab?'add':'remove']('on');}if(tab==='agenda'){DB=loadDB();CUR=DB.currentBiz?DB.businesses.filter(function(b){return b.id===DB.currentBiz;})[0]:CUR;initAgenda();}if(tab==='home'){DB=loadDB();CUR=DB.currentBiz?DB.businesses.filter(function(b){return b.id===DB.currentBiz;})[0]:CUR;renderTodayAppts();}}

function renderBizBarbers(){if(!CUR)return;H('biz-barbers-list',(CUR.barbers||[]).length?(CUR.barbers||[]).map(function(b){var av=b.photo?'<img src="'+sanitizeImageDataURL(b.photo)+'" style="width:100%;height:100%;object-fit:cover" alt="Foto">':san((b.name||'?').charAt(0).toUpperCase());return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px"><div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0">'+av+'</div><div style="flex:1"><div style="font-weight:700;font-size:15px">'+san(b.name)+'</div><div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(b.spec||'')+'</div>'+(b.phone?'<div style="font-size:12px;color:var(--muted);margin-top:2px">📱 '+san(b.phone)+'</div>':'')+'</div><div style="display:flex;gap:6px"><button onclick="openBarberModal('+b.id+')" style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--rpill);padding:7px 12px;color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font)">Editar</button><button onclick="delBarber('+b.id+')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);border-radius:var(--rpill);padding:7px 10px;color:var(--red);font-size:13px;cursor:pointer">🗑</button></div></div>';}).join(''):'<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:28px;margin-bottom:8px">👥</div><div>No hay profesionales aún</div></div>');}
function renderBizServices(){if(!CUR)return;H('biz-svcs-list',(CUR.services||[]).length?(CUR.services||[]).map(function(s){var thumb=s.photo?'<img src="'+sanitizeImageDataURL(s.photo)+'" style="width:46px;height:46px;border-radius:11px;object-fit:cover;flex-shrink:0" alt="Servicio">':'<div style="width:46px;height:46px;border-radius:11px;background:var(--bblue);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">✂️</div>';return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px">'+thumb+'<div style="flex:1"><div style="font-weight:700;font-size:14px">'+san(s.name)+'</div><div style="font-size:12px;color:var(--muted);margin-top:2px">'+s.dur+'min'+(s.desc?' · '+san(s.desc):'')+'</div></div><div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:16px;color:var(--blue)">'+money(s.price)+'</div><div style="display:flex;gap:5px;margin-top:6px"><button onclick="openSvcModal('+s.id+')" style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--rpill);padding:5px 10px;color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)">Editar</button><button onclick="delService('+s.id+')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);border-radius:var(--rpill);padding:5px 8px;color:var(--red);font-size:12px;cursor:pointer">🗑</button></div></div></div>';}).join(''):'<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:28px;margin-bottom:8px">✂️</div><div>No hay servicios aún</div></div>');}
function delService(id){if(!CUR)return;CUR.services=CUR.services.filter(function(s){return s.id!==id;});saveDB();renderBizServices();toast('Servicio eliminado','#475569');}
function delBarber(id){if(!CUR)return;CUR.barbers=CUR.barbers.filter(function(b){return b.id!==id;});saveDB();renderBizBarbers();toast('Profesional eliminado','#475569');}

function renderBizFinances(){
  if(!CUR)return;
  var now=new Date(),thisMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var appts=CUR.appointments||[];
  var monthAppts=appts.filter(function(a){return a.date&&a.date.slice(0,7)===thisMonth&&a.status!=='cancelled';});
  var monthRev=monthAppts.reduce(function(s,a){return s+(a.price||0);},0);
  var clients=[];appts.forEach(function(a){if(a.client&&clients.indexOf(a.client)<0)clients.push(a.client);});
  var svcCount={};appts.filter(function(a){return a.status!=='cancelled';}).forEach(function(a){if(a.svc)svcCount[a.svc]=(svcCount[a.svc]||0)+1;});
  var topSvc='—',topCount=0;Object.keys(svcCount).forEach(function(k){if(svcCount[k]>topCount){topSvc=k;topCount=svcCount[k];}});
  var paid=appts.filter(function(a){return a.status!=='cancelled'&&a.price>0;});
  var ticket=paid.length?paid.reduce(function(s,a){return s+(a.price||0);},0)/paid.length:0;
  T('fin-ing',money(monthRev));T('fin-clients',clients.length);T('fin-top-svc',topSvc.length>10?topSvc.slice(0,10)+'…':topSvc);T('fin-ticket',money(ticket));
  var months=[];for(var i=5;i>=0;i--){var d=new Date(now);d.setMonth(d.getMonth()-i);months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));}
  var vals=months.map(function(m){return appts.filter(function(a){return a.date&&a.date.slice(0,7)===m&&a.status!=='cancelled';}).reduce(function(s,a){return s+(a.price||0);},0);});
  var max=Math.max.apply(null,vals.concat([10]));
  var ch=G('fin-chart');if(ch)ch.innerHTML=vals.map(function(v,i){return'<div class="bar'+(i===vals.length-1?' hi':'')+'" style="height:'+Math.max(4,Math.round(v/max*100))+'%" title="'+money(v)+'"></div>';}).join('');
  var ml=G('fin-months');if(ml)ml.innerHTML=months.map(function(m,i){var parts=m.split('-');return'<div style="flex:1;text-align:center;font-size:9px;color:'+(i===months.length-1?'var(--blue)':'var(--muted)')+';font-weight:700">'+MONTHS_SHORT[parseInt(parts[1])-1]+'</div>';}).join('');
  H('biz-appts-fin',paid.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).slice(0,20).map(function(a){return apptRowH(a);}).join(''));
}

function renderCalendar(){
  var now=calendarDate,year=now.getFullYear(),month=now.getMonth();
  T('cal-title',MONTHS[month]+' '+year);
  var firstDay=new Date(year,month,1).getDay(),daysInMonth=new Date(year,month+1,0).getDate();
  var today=new Date().toISOString().split('T')[0];
  var appts=CUR?(CUR.appointments||[]):[];var apptDates={};appts.forEach(function(a){if(a.date&&a.status!=='cancelled')apptDates[a.date]=true;});
  var html='';for(var i=0;i<firstDay;i++)html+='<div class="cal-day other-month"></div>';
  for(var d=1;d<=daysInMonth;d++){var dateStr=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');var cls='cal-day';if(dateStr===today)cls+=' today';if(dateStr===selectedCalDay&&dateStr!==today)cls+=' sel';if(apptDates[dateStr])cls+=' has-appts';html+='<div class="'+cls+'" onclick="selectCalDay(\''+dateStr+'\')">'+d+'</div>';}
  H('cal-grid',html);
}
function selectCalDay(dateStr){selectedCalDay=dateStr;renderCalendar();initAgenda();}
function prevMonth(){calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar();}
function nextMonth(){calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar();}

function initAgenda(){
  if(!CUR)return;
  var dayAppts=(CUR.appointments||[]).filter(function(a){return a.date===selectedCalDay;}).sort(function(a,b){return(a.time||'').localeCompare(b.time||'');});
  var parts=selectedCalDay.split('-'),days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var d=new Date(selectedCalDay+'T12:00');T('agenda-day-label',days[d.getDay()]+' '+parseInt(parts[2])+' de '+MONTHS[parseInt(parts[1])-1]+' de '+parts[0]);
  H('biz-agenda-list',dayAppts.length?dayAppts.map(function(a){return apptRowH(a);}).join(''):'<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:28px;margin-bottom:8px">📅</div><div style="font-size:13px">Sin citas para este día</div></div>');
}

function renderHorario(){
  if(!CUR)return;
  var horario=CUR.horario||DEFAULT_HORARIO.map(function(h){return Object.assign({},h);});
  H('horario-days',horario.map(function(day,i){return'<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:'+(day.open?'12px':'0')+'"><div style="font-weight:700;font-size:14px">'+san(day.day)+'</div><div class="toggle '+(day.open?'on':'')+'" data-hday="'+i+'" onclick="toggleHorarioDay('+i+')"></div></div>'+(day.open?'<div style="display:flex;gap:10px;align-items:center"><div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px">APERTURA</div><input class="inp" type="time" value="'+san(day.from)+'" data-hfrom="'+i+'" style="padding:9px 12px"/></div><div style="color:var(--muted);font-size:16px;padding-top:18px">—</div><div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px">CIERRE</div><input class="inp" type="time" value="'+san(day.to)+'" data-hto="'+i+'" style="padding:9px 12px"/></div></div>':'')+'</div>';}).join(''));
  document.querySelectorAll('[data-hfrom]').forEach(function(el){el.addEventListener('change',function(){var i=parseInt(el.getAttribute('data-hfrom'));if(CUR.horario&&CUR.horario[i])CUR.horario[i].from=el.value;});});
  document.querySelectorAll('[data-hto]').forEach(function(el){el.addEventListener('change',function(){var i=parseInt(el.getAttribute('data-hto'));if(CUR.horario&&CUR.horario[i])CUR.horario[i].to=el.value;});});
}
function toggleHorarioDay(i){if(!CUR)return;if(!CUR.horario)CUR.horario=DEFAULT_HORARIO.map(function(h){return Object.assign({},h);});CUR.horario[i].open=!CUR.horario[i].open;renderHorario();}

function openBarberModal(id){
  editBar=id;window._barPhoto=null;T('bar-ttl',id?'Editar profesional':'Añadir profesional');
  var reset=function(){var p=G('bar-photo-preview');if(p)p.innerHTML='<div style="font-size:28px;margin-bottom:6px">👤</div><div style="font-size:13px;color:var(--muted)">Añadir foto</div>';};
  if(id&&CUR){var b=CUR.barbers.filter(function(x){return x.id===id;})[0];if(b){var n=G('bar-name'),sp=G('bar-spec'),ph=G('bar-phone');if(n)n.value=b.name||'';if(sp)sp.value=b.spec||'';if(ph)ph.value=b.phone||'';var pv=G('bar-photo-preview');if(pv&&b.photo)pv.innerHTML='<img src="'+sanitizeImageDataURL(b.photo)+'" class="photo-preview" alt="Foto"/>';else reset();}}
  else{['bar-name','bar-spec','bar-phone'].forEach(function(i2){var e=G(i2);if(e)e.value='';});reset();}
  openOv('ov-barber');
}
function saveBarber(){var name=sanitizeText(V('bar-name')),spec=sanitizeText(V('bar-spec')),phone=sanitizeText(V('bar-phone')),photo=window._barPhoto||null;if(!name){toast('Nombre requerido','#EF4444');return;}if(!CUR)return;if(!CUR.barbers)CUR.barbers=[];if(editBar){var b=CUR.barbers.filter(function(x){return x.id===editBar;})[0];if(b){b.name=name;b.spec=spec;b.phone=phone;if(photo)b.photo=photo;}}else CUR.barbers.push({id:Date.now(),name:name,spec:spec,phone:phone,photo:photo||''});editBar=null;window._barPhoto=null;saveDB();renderBizBarbers();closeOv('ov-barber');toast('✅ Profesional guardado','#4A7FD4');}

function openApptModal(){
  if(!CUR)return;
  var today=new Date().toISOString().split('T')[0];
  var nowTime=new Date().toTimeString().slice(0,5);
  var dateEl=G('ap-date'),timeEl=G('ap-time'),nameEl=G('ap-name'),phoneEl=G('ap-phone'),notesEl=G('ap-notes');
  if(dateEl)dateEl.value=today;if(timeEl)timeEl.value=nowTime;if(nameEl)nameEl.value='';if(phoneEl)phoneEl.value='';if(notesEl)notesEl.value='';
  var svcSel=G('ap-svc');if(svcSel)svcSel.innerHTML=(CUR.services||[]).map(function(s){return'<option value="'+san(s.name)+','+s.price+'">'+san(s.name)+' ('+money(s.price)+')</option>';}).join('');
  var barSel=G('ap-bar');if(barSel)barSel.innerHTML='<option value="Cualquiera">Cualquiera</option>'+(CUR.barbers||[]).map(function(b){return'<option value="'+san(b.name)+'">'+san(b.name)+'</option>';}).join('');
  openOv('ov-appt');
}
function saveAppt(){
  var name=sanitizeText(V('ap-name')),phone=sanitizeText(V('ap-phone'));
  var date=V('ap-date'),time=V('ap-time'),svcRaw=V('ap-svc'),barber=sanitizeText(V('ap-bar')),status=V('ap-status')||'confirmed',notes=sanitizeText(V('ap-notes'));
  if(!name){toast('Nombre del cliente requerido','#EF4444');return;}if(!date||!time){toast('Fecha y hora requeridas','#EF4444');return;}if(!svcRaw){toast('Selecciona un servicio','#EF4444');return;}
  var parts=svcRaw.split(',');if(!CUR)return;if(!CUR.appointments)CUR.appointments=[];
  CUR.appointments.push({id:Date.now(),client:name,phone:phone,email:'',svc:parts[0],barber:barber,date:date,time:time,price:safeNum(parts[1],0),status:status,notes:notes});
  saveDB();closeOv('ov-appt');renderTodayAppts();initAgenda();renderBizFinances();initBizPanel();toast('✅ Cita guardada','#22C55E');
}

function saveBizProfile(){if(!CUR)return;var nm=sanitizeText(V('pf-nm')),addr=sanitizeText(V('pf-addr')),phone=sanitizeText(V('pf-phone')),insta=sanitizeText(V('pf-insta')),desc=sanitizeText(V('pf-desc'));if(!nm){toast('El nombre no puede estar vacío','#EF4444');return;}CUR.name=nm;CUR.addr=addr;CUR.phone=phone;CUR.insta=insta;CUR.desc=desc.slice(0,300);saveDB();initBizPanel();toast('✅ Perfil guardado','#4A7FD4');}

/* ══════════════════════════
   PORTAL CLIENTES
══════════════════════════ */
function loadBizDirect(bizId){
  var b=DB.businesses.filter(function(x){return x.id===bizId;})[0];
  if(!b){toast('Negocio no encontrado','#EF4444');return;}
  initCSEL();CSEL.bizId=bizId;
  goTo('s-client');
  var av=G('ch-av');
  if(av){if(b.logo)av.innerHTML='<img src="'+sanitizeImageDataURL(b.logo)+'" style="width:100%;height:100%;object-fit:cover" alt="Logo">';else av.textContent=(b.name||'?').charAt(0);}
  T('ch-nm',b.name);
  T('ch-meta','📍 '+sanitizeText((b.addr||'')+' '+(b.city||''))+' · '+sanitizeText(b.type||'Negocio'));
  H('cl-svc-list',(b.services||[]).map(function(s){
    var thumb=s.photo?'<img src="'+sanitizeImageDataURL(s.photo)+'" style="width:50px;height:50px;border-radius:12px;object-fit:cover;flex-shrink:0" alt="Servicio">':'<div style="width:50px;height:50px;border-radius:12px;background:var(--bblue);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">✂️</div>';
    return'<div class="svcitem" data-sn="'+san(s.name)+'" data-sp="'+s.price+'" data-dur="'+s.dur+'">'
      +thumb
      +'<div style="flex:1"><div style="font-weight:700;font-size:15px;margin-bottom:2px">'+san(s.name)+'</div>'
      +'<div style="font-size:12px;color:var(--t2)">'+s.dur+' min'+(s.desc?' · '+san(s.desc):'')+'</div></div>'
      +'<div style="font-weight:800;font-size:17px;color:var(--blue)">'+money(s.price)+'</div></div>';
  }).join(''));
  document.querySelectorAll('.svcitem').forEach(function(item){
    item.addEventListener('click',function(){
      document.querySelectorAll('.svcitem').forEach(function(x){x.classList.remove('sel');});
      item.classList.add('sel');
      CSEL.svc=item.getAttribute('data-sn');
      CSEL.svcPrice=parseFloat(item.getAttribute('data-sp'));
      CSEL.svcDur=parseInt(item.getAttribute('data-dur'))||30;
    });
  });
  buildDates(bizId);
  clGoStep(1);
  window.scrollTo(0,0);
}

function clGoStep(n){
  document.querySelectorAll('.bstep').forEach(function(s){s.classList.remove('on');});
  var s=G('cs-'+n);if(s)s.classList.add('on');
  updateBookingProgress(n);
  window.scrollTo(0,0);
}

function updateBookingProgress(step){
  for(var i=1;i<=4;i++){
    var bar=G('bk-p'+i);
    var lbl=G('bk-lbl'+i);
    if(bar)bar.style.background=i<=step?'var(--blue)':'var(--b)';
    if(lbl)lbl.style.color=i<=step?'var(--blue)':'var(--muted)';
  }
}

function clStep(n){
  if(n===2){
    var name=sanitizeText(V('cl-name'));
    var phone=sanitizeText(V('cl-phone'));
    var err=G('cl-err1');
    if(!name||name.length<2){if(err){err.textContent='Por favor ingresa tu nombre completo.';err.style.display='block';}return;}
    if(!phone||!validPhone(phone)){if(err){err.textContent='Por favor ingresa un número de teléfono válido.';err.style.display='block';}return;}
    if(err)err.style.display='none';
    CSEL.clientName=name;CSEL.clientPhone=phone;CSEL.clientEmail=sanitizeText(V('cl-email'));
  }
  if(n===3){
    var err2=G('cl-err2');
    if(!CSEL.svc){if(err2){err2.textContent='Por favor selecciona un servicio.';err2.style.display='block';}return;}
    if(err2)err2.style.display='none';
  }
  if(n===4){
    var err3=G('cl-err3');
    if(!CSEL.date){if(err3){err3.textContent='Por favor selecciona una fecha.';err3.style.display='block';}return;}
    if(!CSEL.time){if(err3){err3.textContent='Por favor selecciona una hora disponible.';err3.style.display='block';}return;}
    if(err3)err3.style.display='none';
    buildSummary();
  }
  clGoStep(n);
}

function buildDates(bizId){
  var dates=[],now=new Date();
  var biz=DB.businesses.filter(function(b){return b.id===bizId;})[0];
  var horario=biz&&biz.horario?biz.horario:DEFAULT_HORARIO;
  var dayNames=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  for(var i=0;i<14;i++){
    var d=new Date(now);d.setDate(now.getDate()+i);
    var hn=dayNames[d.getDay()];
    var hd=horario.filter(function(h){return h.day===hn;})[0];
    if(!hd||hd.open)dates.push(d);
    if(dates.length>=7)break;
  }
  var days=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  H('cl-dates',dates.map(function(d,i){
    return'<div class="dateopt'+(i===0?' sel':'')+'" data-dt="'+d.toISOString().split('T')[0]+'">'
      +'<div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">'+days[d.getDay()]+'</div>'
      +'<div style="font-size:20px;font-weight:900">'+d.getDate()+'</div>'
      +'<div style="font-size:9px;color:var(--muted)">'+['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]+'</div>'
      +'</div>';
  }).join(''));
  CSEL.date=dates.length?dates[0].toISOString().split('T')[0]:now.toISOString().split('T')[0];
  document.querySelectorAll('.dateopt').forEach(function(o){
    o.addEventListener('click',function(){
      document.querySelectorAll('.dateopt').forEach(function(x){x.classList.remove('sel');});
      o.classList.add('sel');CSEL.date=o.getAttribute('data-dt');
      buildTimes(bizId);
    });
  });
  buildTimes(bizId);
}

function buildTimes(bizId){
  var biz=DB.businesses.filter(function(b){return b.id===bizId;})[0];
  var horario=biz&&biz.horario?biz.horario:DEFAULT_HORARIO;
  if(!CSEL.date)return;
  var d=new Date(CSEL.date+'T12:00');
  var dayNames=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var horDay=horario.filter(function(h){return h.day===dayNames[d.getDay()];})[0]||{open:true,from:'09:00',to:'20:00'};
  var times=[];
  if(horDay.open){
    var fp=horDay.from.split(':').map(Number),tp=horDay.to.split(':').map(Number);
    var fm=fp[0]*60+fp[1],tm=tp[0]*60+tp[1];
    var interval=CSEL.svcDur||30;
    for(var m=fm;m<=tm-interval;m+=30){
      var h=Math.floor(m/60),mn=m%60;
      times.push(String(h).padStart(2,'0')+':'+String(mn).padStart(2,'0'));
    }
  }
  var booked=biz?(biz.appointments||[]).filter(function(a){return a.date===CSEL.date&&a.status!=='cancelled';}).map(function(a){return a.time;}):[]; 
  var available=times.filter(function(t){return booked.indexOf(t)<0;}).length;
  var availEl=G('cl-time-available');
  if(availEl)availEl.textContent=times.length?(available>0?available+' horarios disponibles':'Sin horarios disponibles este día'):'';
  if(!times.length){
    H('cl-times','<div style="text-align:center;padding:24px;color:var(--muted);background:var(--card);border-radius:var(--r);border:1px solid var(--b)"><div style="font-size:24px;margin-bottom:8px">😴</div><div>Cerrado este día</div></div>');
    return;
  }
  H('cl-times',times.map(function(t){
    var busy=booked.indexOf(t)>=0;
    return'<div class="topt'+(busy?' busy':'')+'" data-tm="'+t+'">'+t+'</div>';
  }).join(''));
  document.querySelectorAll('.topt:not(.busy)').forEach(function(o){
    o.addEventListener('click',function(){
      document.querySelectorAll('.topt').forEach(function(x){x.classList.remove('sel');});
      o.classList.add('sel');CSEL.time=o.getAttribute('data-tm');
    });
  });
}

function buildSummary(){
  var biz=DB.businesses.filter(function(b){return b.id===CSEL.bizId;})[0];
  H('cl-summary',
    '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Resumen de tu reserva</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">👤 Cliente</span><span style="font-size:13px;font-weight:700">'+san(CSEL.clientName||'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">📱 Teléfono</span><span style="font-size:13px;font-weight:700">'+san(CSEL.clientPhone||'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">🏪 Negocio</span><span style="font-size:13px;font-weight:700">'+san(biz?biz.name:'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">✂️ Servicio</span><span style="font-size:13px;font-weight:700">'+san(CSEL.svc||'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">📅 Fecha</span><span style="font-size:13px;font-weight:700">'+sanitizeText(CSEL.date||'—')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">⏰ Hora</span><span style="font-size:13px;font-weight:700">'+sanitizeText(CSEL.time||'—')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0"><span style="font-size:15px;font-weight:800">💰 Total</span><span style="font-weight:900;font-size:22px;color:var(--blue)">'+money(CSEL.svcPrice)+'</span></div>'
  );
}

function confirmBooking(){
  var name=CSEL.clientName||sanitizeText(V('cl-name'));
  var phone=CSEL.clientPhone||sanitizeText(V('cl-phone'));
  var email=CSEL.clientEmail||sanitizeText(V('cl-email'));
  if(!name||!phone||!CSEL.svc||!CSEL.date||!CSEL.time){toast('Faltan datos. Vuelve atrás y completa todo.','#EF4444');return;}
  var biz=DB.businesses.filter(function(b){return b.id===CSEL.bizId;})[0];if(!biz)return;
  var dup=(biz.appointments||[]).filter(function(a){return a.date===CSEL.date&&a.time===CSEL.time&&a.status!=='cancelled';}).length>0;
  if(dup){toast('Esa hora ya está ocupada. Elige otra.','#EF4444');clGoStep(3);return;}
  if(!biz.appointments)biz.appointments=[];
  var appt={id:Date.now(),client:name,phone:phone,email:email,date:CSEL.date,time:CSEL.time,svc:CSEL.svc,barber:'Cualquiera',price:CSEL.svcPrice||0,status:'confirmed',notes:''};
  biz.appointments.push(appt);saveDB();
  if(CUR&&CUR.id===biz.id)initBizPanel();

  /* Email confirmación al cliente */
  if(email){
    fetch('/.netlify/functions/send-email',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'booking_confirmed',to:email,data:{bizName:biz.name,service:CSEL.svc,date:CSEL.date,time:CSEL.time,price:money(CSEL.svcPrice)}})
    }).catch(function(e){console.error('Email cliente:',e);});
  }

  /* Email aviso al negocio */
  if(biz.email){
    fetch('/.netlify/functions/send-email',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'new_booking_biz',to:biz.email,data:{clientName:name,clientPhone:phone,service:CSEL.svc,date:CSEL.date,time:CSEL.time}})
    }).catch(function(e){console.error('Email negocio:',e);});
  }

  T('cl-confirm-txt','¡Hola '+sanitizeText(name)+'! Tu cita en '+sanitizeText(biz.name)+' ha sido reservada con éxito. ¡Te esperamos!');
  H('cl-confirm-card',
    '<div style="display:flex;flex-direction:column;gap:10px">'
    +'<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Negocio</span><span style="font-weight:700;font-size:13px">'+san(biz.name)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Servicio</span><span style="font-weight:700;font-size:13px">'+san(CSEL.svc||'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Fecha</span><span style="font-weight:700;font-size:13px">'+sanitizeText(CSEL.date)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Hora</span><span style="font-weight:700;font-size:13px">'+sanitizeText(CSEL.time)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;border-top:1px solid var(--b);padding-top:10px;margin-top:4px"><span style="font-weight:800;font-size:14px">Total</span><span style="font-weight:900;color:var(--blue);font-size:20px">'+money(CSEL.svcPrice)+'</span></div>'
    +'</div>'
  );
  var wa=G('cl-wa-btn');
  if(wa)wa.href='https://wa.me/'+phone.replace(/\D/g,'')+'?text='+encodeURIComponent('📅 Cita confirmada en '+biz.name+'\n✂️ Servicio: '+CSEL.svc+'\n📆 Fecha: '+CSEL.date+' a las '+CSEL.time+'\n💰 Total: '+money(CSEL.svcPrice)+'\n\n¡Hasta pronto! 💈');
  clGoStep(5);
}

function resetBooking(){
  var savedBizId=CSEL.bizId;
  initCSEL();
  if(savedBizId){CSEL.bizId=savedBizId;loadBizDirect(savedBizId);}
  else{goTo('s-portal');}
}

/* ══════════════════════════
   EYE TOGGLE
══════════════════════════ */
function toggleEye(inputId,btnId){
  var inp=G(inputId),btn=G(btnId);if(!inp||!btn)return;
  btn.addEventListener('click',function(){var isPass=inp.type==='password';inp.type=isPass?'text':'password';btn.textContent=isPass?'🙈':'👁';inp.focus();});
}

/* ══════════════════════════
   QR
══════════════════════════ */
function generateQR(text,containerId){
  var container=G(containerId);if(!container)return;
  var size=180;
  var imgUrl='https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text)+'&bgcolor=ffffff&color=000000&margin=10';
  var img=document.createElement('img');
  img.src=imgUrl;img.width=size;img.height=size;img.alt='Código QR';
  img.style.borderRadius='8px';img.style.display='block';
  img.onerror=function(){container.innerHTML='<div style="padding:20px;color:var(--muted);font-size:13px;text-align:center">📱 Conecta a internet para ver el QR</div>';};
  container.innerHTML='';container.appendChild(img);
}

function openQRModal(){
  if(!CUR)return;
  var link='https://citas-pro.netlify.app/b/'+CUR.id;
  var el=G('qr-link-text');if(el)el.textContent=link;
  generateQR(link,'qr-code');
  var wa=G('qr-wa-btn');if(wa)wa.href='https://wa.me/?text='+encodeURIComponent('📅 Reserva tu cita en '+CUR.name+' → '+link);
  openOv('ov-qr');
}

/* ══════════════════════════
   HASH ROUTING
══════════════════════════ */
function checkLinkAccess(){
  var hash=window.location.hash;
  if(hash&&hash.indexOf('#b/')===0){
    var bizId=hash.slice(3);
    if(bizId){
      var biz=DB.businesses.filter(function(b){return b.id===bizId;})[0];
      if(biz){setTimeout(function(){loadBizDirect(bizId);},100);return true;}
    }
  }
  return false;
}

/* ══════════════════════════
   WINDOW.ONLOAD
══════════════════════════ */
window.onload=function(){
  DB=loadDB();initREG();initCSEL();

  document.querySelectorAll('.ov').forEach(function(o){
    o.addEventListener('click',function(e){if(e.target===o)o.classList.remove('on');});
  });

  /* Cerrar dropdown país al click fuera */
  document.addEventListener('click',function(e){
    var wrapper=G('country-wrapper');
    if(wrapper&&!wrapper.contains(e.target)){
      var dd=G('br-country-dropdown');
      if(dd)dd.style.display='none';
    }
  });

  on('dots-btn','click',function(){
    var em=G('dots-email'),ps=G('dots-pass');
    if(em)em.value='';if(ps)ps.value='';
    hideErr('dots-err');openOv('ov-admin');
    setTimeout(function(){var e=G('dots-email');if(e)e.focus();},250);
  });
  on('btn-crear','click',function(){openRegModal();});
  on('btn-login','click',function(){openLoginModal();});

  on('rm-close1','click',function(){closeOv('ov-registro');});
  on('rm-close2','click',function(){closeOv('ov-registro');});
  on('rm-btn-next','click',rmGoStep2);
  on('rm-btn-verify','click',rmVerify);
  on('rm-btn-resend','click',rmResend);
  on('rm-btn-back','click',function(){var s1=G('rm-step1'),s2=G('rm-step2');if(s1)s1.style.display='block';if(s2)s2.style.display='none';hideErr('rm-err2');});
  on('rm-go-login','click',function(){closeOv('ov-registro');openLoginModal();});
  on('rm-pass','input',function(){updateRmPassStrength(this.value);});
  on('rm-pass','keydown',function(e){if(e.key==='Enter')rmGoStep2();});
  [0,1,2,3,4,5].forEach(function(i){
    var box=G('rc'+i);if(!box)return;
    box.addEventListener('input',function(){codeInput(i);});
    box.addEventListener('keydown',function(e){codeKey(e,i);});
  });
  document.addEventListener('paste',function(e){
    var focused=document.activeElement;if(!focused||!focused.id||!focused.id.match(/^rc\d/))return;
    var pasted=(e.clipboardData||window.clipboardData).getData('text');
    var digits=pasted.replace(/[^0-9]/g,'').slice(0,6);
    if(digits.length>=4){e.preventDefault();[0,1,2,3,4,5].forEach(function(i){var b=G('rc'+i);if(b)b.value=digits[i]||'';});if(digits.length===6)setTimeout(rmVerify,300);}
  });

  on('login-close','click',function(){closeOv('ov-login');});
  on('li-btn-login','click',doLogin);
  on('li-pass','keydown',function(e){if(e.key==='Enter')doLogin();});
  on('li-email','keydown',function(e){if(e.key==='Enter'){var p=G('li-pass');if(p)p.focus();}});
  on('li-forgot','click',openForgotModal);
  on('li-go-register','click',function(){closeOv('ov-login');openRegModal();});

  on('forgot-close','click',function(){closeOv('ov-forgot');});
  on('fp-btn-send','click',doForgot);
  on('fp-email','keydown',function(e){if(e.key==='Enter')doForgot();});
  on('fp-btn-back','click',function(){closeOv('ov-forgot');openLoginModal();});

  on('dots-cancel-btn','click',function(){closeOv('ov-admin');});
  on('dots-login-btn','click',dotsLogin);
  on('dots-pass','keydown',function(e){if(e.key==='Enter')dotsLogin();});

  on('adm-login-btn','click',doAdminLogin);
  on('adm-pass','keydown',function(e){if(e.key==='Enter')doAdminLogin();});
  on('adm-back-btn','click',function(){goTo('s-portal');});
  on('adm-home-btn','click',function(){goTo('s-portal');});
  on('adm-out-btn','click',doAdminLogout);
  on('adm-notif-btn','click',function(){renderNotifications();openOv('ov-notif');});
  on('cfg-save-btn','click',function(){toast('✅ Configuración guardada','#4A7FD4');});
  on('cfg-pass-btn','click',function(){
    var p1=V('cfg-pass1'),p2=V('cfg-pass2');
    if(!p1||p1!==p2){showErr('cfg-pass-err','Las contraseñas no coinciden.');return;}
    if(p1.length<8){showErr('cfg-pass-err','Mínimo 8 caracteres.');return;}
    hideErr('cfg-pass-err');toast('✅ Contraseña actualizada','#4A7FD4');
  });
  on('close-notif','click',function(){closeOv('ov-notif');});
  on('close-biz-profile','click',function(){closeOv('ov-biz-profile');});

  on('reg-start-btn','click',function(){bizRegStep(1);});
  on('login-toggle-btn','click',function(){goTo('s-portal');openLoginModal();});
  on('back-1','click',function(){bizRegStep(0);});on('back-2','click',function(){bizRegStep(1);});on('back-3','click',function(){bizRegStep(2);});
  on('back-4','click',function(){bizRegStep(3);});on('back-5','click',function(){bizRegStep(4);});on('back-6','click',function(){bizRegStep(5);});
  on('next-1','click',function(){bizRegStep(2);});on('next-2','click',function(){bizRegStep(3);});on('next-3','click',function(){bizRegStep(4);});
  on('next-4','click',function(){bizRegStep(5);});on('next-5','click',function(){bizRegStep(6);});on('skip-5','click',function(){bizRegStep(6);});on('next-6','click',function(){bizRegStep(7);});
  on('enter-panel-btn','click',completeBizReg);
  on('copy-link-reg','click',copyLink);
  on('add-reg-svc','click',function(){openSvcModal(null);});
  on('br-pass','input',function(){updatePassStrength(this.value);});
  [['barberia','Barbería'],['peluqueria','Peluquería'],['unias','Uñas'],['salon','Salón'],['spa','Spa'],['estetica','Estética']].forEach(function(t){on('type-'+t[0],'click',function(){selType('type-'+t[0],t[1]);});});
  [['sz-1','1'],['sz-24','2-4'],['sz-59','5-9'],['sz-10','10+']].forEach(function(s){on(s[0],'click',function(){selSize(s[0],s[1]);});});

  on('biz-home-btn','click',function(){goTo('s-portal');});
  on('biz-out-btn','click',bizLogout);
  on('copy-link-btn','click',copyLink);
  on('view-portal-btn','click',goClientFromBiz);
  on('new-appt-btn','click',openApptModal);on('new-appt-btn2','click',openApptModal);
  on('add-barber-btn','click',function(){openBarberModal(null);});
  on('add-svc-btn','click',function(){openSvcModal(null);});
  on('save-profile-btn','click',saveBizProfile);
  on('save-horario-btn','click',function(){if(CUR){saveDB();toast('✅ Horario guardado','#4A7FD4');}});
  on('add-gallery-btn','click',function(){var gi=G('gallery-input');if(gi)gi.click();});

  on('close-svc','click',function(){closeOv('ov-svc');});on('save-svc-btn','click',saveSvc);
  on('close-bar','click',function(){closeOv('ov-barber');});on('save-bar-btn','click',saveBarber);
  on('close-appt','click',function(){closeOv('ov-appt');});on('save-appt-btn','click',saveAppt);

  on('cl-back-btn','click',function(){goTo('s-portal');});
  on('cs1-next','click',function(){clStep(2);});
  on('cs2-next','click',function(){clStep(3);});
  on('cs2-back','click',function(){clGoStep(1);});
  on('cs3-next','click',function(){clStep(4);});
  on('cs3-back','click',function(){clGoStep(2);});
  on('cs4-confirm','click',confirmBooking);
  on('cs4-back','click',function(){clGoStep(3);});
  on('cl-reset-btn','click',resetBooking);

  setupPhotoUpload();

  toggleEye('adm-pass','adm-pass-eye');
  toggleEye('dots-pass','dots-pass-eye');
  toggleEye('br-pass','br-pass-eye');
  toggleEye('rm-pass','rm-pass-eye');
  toggleEye('li-pass','li-pass-eye');

  on('qr-btn','click',openQRModal);
  on('qr-copy-btn','click',function(){
    if(!CUR)return;
    try{navigator.clipboard.writeText('https://citas-pro.netlify.app/b/'+CUR.id);}catch(e){}
    toast('📋 Enlace copiado','#4A7FD4');
  });
  on('qr-download-btn','click',function(){
    var img=G('qr-code')?G('qr-code').querySelector('img'):null;if(!img)return;
    var a=document.createElement('a');a.href=img.src;a.download='QR-'+((CUR&&CUR.name)||'citaspro')+'.png';a.click();
  });

  window.admTab=admTab;window.bizTab=bizTab;window.openBizProfile=openBizProfile;
  window.extendTrial=extendTrial;window.activateBiz=activateBiz;window.suspendBiz=suspendBiz;
  window.copyText=copyText;window.delGalleryPhoto=delGalleryPhoto;window.filterClientBiz=filterClientBiz;
  window.prevMonth=prevMonth;window.nextMonth=nextMonth;window.selectCalDay=selectCalDay;
  window.openApptDetail=openApptDetail;window.toggleHorarioDay=toggleHorarioDay;
  window.openSvcModal=openSvcModal;window.openBarberModal=openBarberModal;
  window.delService=delService;window.delBarber=delBarber;
  window.loadBizDirect=loadBizDirect;window.openQRModal=openQRModal;
  window.REG=REG;

  if(DB.admin&&DB.admin.auth){goTo('s-admin');showAdminPanel();}
  else if(DB.currentBiz){goBiz();}
  else if(!checkLinkAccess()){goTo('s-portal');}
};

})();