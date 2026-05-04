'use strict';

/* ══════════════════════════════════════════════════
   WORKERS.JS — Panel del trabajador
   REGLA: CUR_WORKER solo ve SUS propios datos.
   Nunca se accede a CUR.workers ni datos de otros.
══════════════════════════════════════════════════ */

function showWorkerPanel() {
  if (!DB.currentWorker) { goTo('s-portal'); return; }
  var biz = getBizById(DB.currentWorker.bizId);
  var worker = getWorkerById(DB.currentWorker.bizId, DB.currentWorker.workerId);
  if (!biz || !worker) { goTo('s-portal'); return; }
  CUR_WORKER = worker; CUR = biz;
  goTo('s-worker'); initWorkerPanel();
}
if (typeof registerFCMToken === 'function') registerFCMToken();

function initWorkerPanel() {
  if (!CUR_WORKER || !CUR) return;
 
  // ── Auto-completar citas pasadas (usando timezone del negocio) ──
  var _ahora = (typeof ahoraEnNegocio === 'function') ? ahoraEnNegocio(CUR.country || 'PE') : new Date();
  var ahoraMins = _ahora.getHours() * 60 + _ahora.getMinutes();
  var hoyStr = _ahora.getFullYear() + '-' + String(_ahora.getMonth()+1).padStart(2,'0') + '-' + String(_ahora.getDate()).padStart(2,'0');
  var cambios = false;
  (CUR_WORKER.appointments || []).forEach(function(a) {
    if (a.status !== 'confirmed' && a.status !== 'rescheduled') return;
    if (a.date > hoyStr) return;
    if (a.date === hoyStr) {
      var pts = (a.time || '00:00').split(':').map(Number);
      var minCita = pts[0] * 60 + pts[1];
      var dur = 30;
      if (CUR_WORKER.services) {
        var svc = CUR_WORKER.services.find(function(s) { return s.name === a.svc; });
        if (svc) dur = parseInt(svc.dur) || 30;
      }
      if (ahoraMins < minCita + dur) return;
    }
    a.status = 'completed';
    cambios = true;
  });
  if (cambios) saveDB();
 
  var av = G('wk-hdr-av');
  if (av) {
    if (CUR_WORKER.photo) av.innerHTML = '<img src="'+sanitizeImageDataURL(CUR_WORKER.photo)+'" style="width:100%;height:100%;object-fit:cover" alt="Foto"/>';
    else av.textContent = (CUR_WORKER.name||'?').charAt(0).toUpperCase();
  }
  T('wk-hdr-nm', CUR_WORKER.name);
 
  var bizName = CUR ? (CUR.name || 'Mi Negocio') : 'Mi Negocio';
  var bizAv = G('wk-biz-av');
  if (bizAv) {
    if (CUR && CUR.logo) bizAv.innerHTML = '<img src="'+sanitizeImageDataURL(CUR.logo)+'" style="width:100%;height:100%;object-fit:cover" alt="Logo"/>';
    else bizAv.textContent = bizName.charAt(0).toUpperCase();
  }
  T('wk-biz-nm', bizName);
 
  var firstName = (CUR_WORKER.name || 'Trabajador').split(' ')[0];
  T('wk-greeting', 'Bienvenido, ' + firstName);
 
  /* Stats home — usando timezone del negocio */
  var _hoyDate = (typeof ahoraEnNegocio === 'function') ? ahoraEnNegocio(CUR.country || 'PE') : new Date();
  var today = _hoyDate.getFullYear() + '-' + String(_hoyDate.getMonth()+1).padStart(2,'0') + '-' + String(_hoyDate.getDate()).padStart(2,'0');
  var appts = CUR_WORKER.appointments || [];
  var todayA = appts.filter(function(a){ return a.date===today && a.status!=='cancelled'; });
 
  var thisWeekStart = new Date(_hoyDate); thisWeekStart.setDate(_hoyDate.getDate()-_hoyDate.getDay());
  var thisWeekStartStr = thisWeekStart.getFullYear() + '-' + String(thisWeekStart.getMonth()+1).padStart(2,'0') + '-' + String(thisWeekStart.getDate()).padStart(2,'0');
  var thisMonthStart = new Date(_hoyDate); thisMonthStart.setDate(1);
  var thisMonthStartStr = thisMonthStart.getFullYear() + '-' + String(thisMonthStart.getMonth()+1).padStart(2,'0') + '-01';
 
  var weekA  = appts.filter(function(a){ return a.date>=thisWeekStartStr && a.status!=='cancelled'; });
  var monthA = appts.filter(function(a){ return a.date>=thisMonthStartStr && a.status!=='cancelled'; });
 
  T('wk-today', todayA.length);
  T('wk-rev',   money(todayA.reduce(function(s,a){ return s+(a.price||0); },0)));
  T('wk-week',  weekA.length);
  T('wk-month', money(monthA.reduce(function(s,a){ return s+(a.price||0); },0)));
 
  var link = 'citasproonline.com/#b/'+CUR.id;
  T('wk-link-show', link);
  var waShare = G('wk-wa-share');
  if (waShare) waShare.href = 'https://wa.me/?text='+encodeURIComponent('Reserva tu cita con '+CUR_WORKER.name+' en '+CUR.name+' → https://'+link);
 
  renderWorkerNotifBadge();
  renderWorkerServices();
  renderWorkerGallery();
  renderWorkerFinances();
  renderWorkerHorario();
  renderWorkerCalendar();
  initWorkerAgenda();
  renderWorkerProfile();
 
  if (typeof renderWorkerHomeStats === 'function') renderWorkerHomeStats();
 
  workerTab('home');
 
  // ── Si ya tiene permiso, suscribir automáticamente ──
  if ('serviceWorker' in navigator && 'PushManager' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(function(reg) {
      reg.pushManager.getSubscription().then(function(sub) {
        if (sub) return;
        function urlBase64ToUint8Array(b) {
          var pad = '='.repeat((4 - b.length % 4) % 4);
          var base64 = (b + pad).replace(/-/g, '+').replace(/_/g, '/');
          var raw = window.atob(base64);
          var arr = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
          return arr;
        }
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array('BMNw_CvifvPTl5K4BO9Re0kCixw6HUqbkrgO2XRatqrDuEzuko2evKp9zamwkBOgq02xOvAWMUWcHWWTPRXFOAQ')
        }).then(function(newSub) {
          fetch('/api/save-worker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save-push',
              worker_id: CUR_WORKER.id,
              business_id: CUR.id,
              subscription: newSub.toJSON()
            })
          });
        }).catch(function(e) { console.log('Push no disponible:', e); });
      });
    });
  }
 
  // ── Banner de notificaciones (solo primera vez, si nunca dio permiso) ──
  if ('Notification' in window && Notification.permission === 'default') {
    var bannerKey = 'cp_push_banner_' + CUR_WORKER.id;
    if (!localStorage.getItem(bannerKey)) {
      var banner = document.createElement('div');
      banner.id = 'push-banner';
      banner.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);width:calc(100% - 40px);max-width:400px;background:var(--card);border:1px solid var(--blue);border-radius:20px;padding:16px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.4);display:flex;gap:12px;align-items:center';
      banner.innerHTML = ''
        + '<div style="font-size:28px">🔔</div>'
        + '<div style="flex:1">'
        + '<div style="font-weight:800;font-size:14px;margin-bottom:3px">Activa las notificaciones</div>'
        + '<div style="font-size:12px;color:var(--t2)">Recibe alertas de nuevas citas y cancelaciones al instante</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
        + '<button id="push-allow" style="background:var(--blue);color:#fff;border:none;border-radius:var(--rpill);padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font)">Permitir</button>'
        + '<button id="push-deny" style="background:var(--b);color:var(--muted);border:none;border-radius:var(--rpill);padding:8px 14px;font-size:12px;cursor:pointer;font-family:var(--font)">Ahora no</button>'
        + '</div>';
      document.body.appendChild(banner);
 
      document.getElementById('push-allow').onclick = function() {
        localStorage.setItem(bannerKey, '1');
        banner.remove();
        navigator.serviceWorker.ready.then(function(reg) {
          function urlBase64ToUint8Array(b) {
            var pad = '='.repeat((4 - b.length % 4) % 4);
            var base64 = (b + pad).replace(/-/g, '+').replace(/_/g, '/');
            var raw = window.atob(base64);
            var arr = new Uint8Array(raw.length);
            for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
            return arr;
          }
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('BMNw_CvifvPTl5K4BO9Re0kCixw6HUqbkrgO2XRatqrDuEzuko2evKp9zamwkBOgq02xOvAWMUWcHWWTPRXFOAQ')
          }).then(function(newSub) {
            fetch('/api/save-worker', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'save-push',
                worker_id: CUR_WORKER.id,
                business_id: CUR.id,
                subscription: newSub.toJSON()
              })
            });
            toast('¡Notificaciones activadas!', '#22C55E');
          }).catch(function(e) { console.log('Push no disponible:', e); });
        });
      };
 
      document.getElementById('push-deny').onclick = function() {
        localStorage.setItem(bannerKey, '1');
        banner.remove();
      };
    }
  }
}


function workerTab(tab) {
  var tabs = ['home','agenda','semana','servicios','galeria','finanzas','historial','horario','perfil'];
  for (var i=0;i<tabs.length;i++) {
    var t=tabs[i]; var pa=G('wp-'+t), bt=G('wn-'+t);
    if(pa) pa.classList[t===tab?'add':'remove']('on');
    if(bt) bt.classList[t===tab?'add':'remove']('on');
  }
  if(tab==='agenda')  initWorkerAgenda();
  if(tab==='horario'){
    renderWorkerHorario();
    if(window.innerWidth>=1024) setTimeout(function(){ if(typeof initHorarioSplit==='function') initHorarioSplit(); },200);
  }
  if(tab==='finanzas' || tab==='historial') renderWorkerFinances();
  if(tab==='home' && typeof renderWorkerHomeStats==='function') renderWorkerHomeStats();
}

/* ══════════════════════════
   MODALES DE TRABAJADOR
══════════════════════════ */
function openWorkerConfig() {
  openOv('ov-config');
  var tgl = G('toggle-push-notifs');
  if (tgl) {
    if (Notification.permission === 'granted') tgl.classList.add('on');
    else tgl.classList.remove('on');
  }
}

function openWorkerNotifs() {
  renderWorkerNotifications();
  openOv('ov-notifications');
}

window.toggleWorkerPush = function() {
  var tgl = G('toggle-push-notifs');
  if (!tgl) return;
  if (tgl.classList.contains('on')) {
    toast('Debes desactivar las notificaciones desde la configuración de tu navegador', '#F59E0B');
  } else {
    if ('Notification' in window) {
      Notification.requestPermission().then(function(p) {
        if (p === 'granted') {
          tgl.classList.add('on');
          initWorkerPanel(); // Se encarga de suscribir
          toast('Notificaciones activadas', '#22C55E');
        } else {
          toast('Permiso denegado', '#EF4444');
        }
      });
    }
  }
};

/* ══════════════════════════
   CITAS HOY — solo las del trabajador
══════════════════════════ */
function workerApptRowH(a) {
  var sc={ confirmed:{c:'var(--blue)',bg:'rgba(74,127,212,.1)',l:'Conf.'}, rescheduled:{c:'#F59E0B',bg:'rgba(245,158,11,.15)',l:'Reag.'}, in_progress:{c:'#A855F7',bg:'rgba(168,85,247,.15)',l:'En curso'}, pending:{c:'var(--gold)',bg:'rgba(245,158,11,.1)',l:'Pend.'}, completed:{c:'var(--green)',bg:'rgba(34,197,94,.1)',l:'Hecho'}, cancelled:{c:'var(--red)',bg:'rgba(239,68,68,.1)',l:'Canc.'} }[a.status]||{c:'var(--blue)',bg:'rgba(74,127,212,.1)',l:'Conf.'};
  var initials=san((a.client||'?').split(' ').map(function(n){ return n[0]||''; }).slice(0,2).join('').toUpperCase());
  return '<div class="appt-row" onclick="openWorkerApptDetail(\''+sanitizeText(a.id)+'\')">'
    +'<div class="appt-avatar">'+initials+'</div>'
    +'<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+san(a.client)+'</div>'
    +'<div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(a.svc)+'</div>'
    +(a.notes?'<div style="font-size:11px;color:var(--muted);margin-top:2px;font-style:italic">'+san(a.notes)+'</div>':'')+'</div>'
    +'<div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:15px;color:var(--blue)">'+money(a.price)+'</div>'
    +'<div style="font-size:12px;color:var(--t2);margin-top:2px">'+san(a.time)+'</div>'
    +'<div style="margin-top:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:'+sc.bg+';color:'+sc.c+'">'+sc.l+'</div></div></div>';
}

function openWorkerApptDetail(id) {
  if (!CUR_WORKER) return;
  var a=null;
  (CUR_WORKER.appointments||[]).forEach(function(ap){ if(String(ap.id)===String(id)) a=ap; });
  if (!a) return;
  H('wk-appt-detail-content',
    '<div style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--r);padding:16px;margin-bottom:14px">'
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'
    +'<div class="appt-avatar" style="width:52px;height:52px;font-size:20px">'+san((a.client||'?').split(' ').map(function(n){ return n[0]||''; }).slice(0,2).join('').toUpperCase())+'</div>'
    +'<div><div style="font-size:18px;font-weight:900">'+san(a.client)+'</div>'
    +(a.phone?'<div style="font-size:14px;color:var(--blue3);margin-top:3px;font-weight:600">'+san(a.phone)+'</div>':'')
    +(a.email?'<div style="font-size:13px;color:var(--t2);margin-top:2px">'+san(a.email)+'</div>':'')
    +'</div></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    +'<div class="sbox"><div class="slbl">Fecha</div><div style="font-size:14px;font-weight:700">'+san(a.date)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Hora</div><div style="font-size:18px;font-weight:900;color:var(--blue)">'+san(a.time)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Servicio</div><div style="font-size:13px;font-weight:700">'+san(a.svc)+'</div></div>'
    +'<div class="sbox"><div class="slbl">Total</div><div style="font-size:18px;font-weight:900;color:var(--green)">'+money(a.price)+'</div></div>'
    +'</div>');
  var waBtn=G('wk-appt-wa-btn'); if(waBtn&&a.phone) waBtn.href='https://wa.me/'+a.phone.replace(/\D/g,'')+'?text='+encodeURIComponent('Hola '+a.client+', te recuerdo tu cita en '+CUR.name+' el '+a.date+' a las '+a.time+'.');
  var cb=G('wk-appt-complete-btn'); if(cb) cb.onclick=function(){ updateWorkerApptStatus(id,'completed'); };
  var ca=G('wk-appt-cancel-btn');   if(ca) ca.onclick=function(){ updateWorkerApptStatus(id,'cancelled'); };
  openOv('ov-wk-appt-detail');
}

function updateWorkerApptStatus(id, status) {
  if (!CUR_WORKER) return;
  (CUR_WORKER.appointments||[]).forEach(function(a){ if(String(a.id)===String(id)) a.status=status; });
  saveDB(); closeOv('ov-wk-appt-detail'); initWorkerAgenda(); renderWorkerFinances();
  toast(status==='completed'?'Cita completada':'Cita cancelada', status==='completed'?'#22C55E':'#EF4444');
}

/* ══════════════════════════
   AGENDA TRABAJADOR
══════════════════════════ */
var workerCalDate = new Date();
var workerCalDay  = new Date().toISOString().split('T')[0];

function renderWorkerCalendar() {
  var now = workerCalDate, year = now.getFullYear(), month = now.getMonth();
  T('wk-cal-title', MONTHS[month]+' '+year);
  var firstDay = new Date(year,month,1).getDay(), daysInMonth = new Date(year,month+1,0).getDate();
 
  // Usar timezone del negocio
  var _hoy = (typeof ahoraEnNegocio === 'function' && CUR) ? ahoraEnNegocio(CUR.country || 'PE') : new Date();
  var today = _hoy.getFullYear() + '-' + String(_hoy.getMonth()+1).padStart(2,'0') + '-' + String(_hoy.getDate()).padStart(2,'0');
 
  var appts = CUR_WORKER ? (CUR_WORKER.appointments||[]) : [], apptDates = {};
  appts.forEach(function(a){ if(a.date&&a.status!=='cancelled') apptDates[a.date]=true; });
  var html = '';
  for(var i=0;i<firstDay;i++) html+='<div class="cal-day other-month"></div>';
  for(var d=1;d<=daysInMonth;d++){
    var ds = year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var cls = 'cal-day';
    if(ds===today) cls+=' today';
    if(ds===workerCalDay) cls+=' sel';
    if(apptDates[ds]) cls+=' has-appts';
    html+='<div class="'+cls+'" onclick="selectWorkerCalDay(\''+ds+'\')">'+d+'</div>';
  }
  H('wk-cal-grid', html);
}

function selectWorkerCalDay(ds){ workerCalDay=ds; renderWorkerCalendar(); initWorkerAgenda(); }
function prevWorkerMonth(){ workerCalDate.setMonth(workerCalDate.getMonth()-1); renderWorkerCalendar(); }
function nextWorkerMonth(){ workerCalDate.setMonth(workerCalDate.getMonth()+1); renderWorkerCalendar(); }

/* ══════════════════════════
   SERVICIOS TRABAJADOR
══════════════════════════ */
var editWorkerSvc = null;

function renderWorkerServices() {
  if (!CUR_WORKER) return;
  var svcs=CUR_WORKER.services||[];
  if(svcs.length){
    H('wk-svcs-list', svcs.map(function(s){
      var thumb=s.photo?'<img src="'+sanitizeImageDataURL(s.photo)+'" style="width:46px;height:46px;border-radius:11px;object-fit:cover;flex-shrink:0" alt="Servicio">'
        :'<div style="width:46px;height:46px;border-radius:11px;background:var(--bblue);color:var(--blue);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg></div>';
      return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px">'
        +thumb+'<div style="flex:1"><div style="font-weight:700;font-size:14px">'+san(s.name)+'</div>'
        +'<div style="font-size:12px;color:var(--muted);margin-top:2px">'+s.dur+'min'+(s.desc?' · '+san(s.desc):'')+'</div></div>'
        +'<div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:16px;color:var(--blue)">'+money(s.price)+'</div>'
        +'<div style="display:flex;gap:5px;margin-top:6px">'
        +'<button onclick="openWorkerSvcModal(\''+sanitizeText(s.id)+'\')" style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--rpill);padding:5px 10px;color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)">Editar</button>'
        +'<button onclick="delWorkerService(\''+sanitizeText(s.id)+'\')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);border-radius:var(--rpill);padding:5px 8px;color:var(--red);font-size:12px;cursor:pointer">&#x2715;</button>'
        +'</div></div></div>';
    }).join(''));
  } else { H('wk-svcs-list','<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Sin servicios aún</div></div>'); }
}

function openWorkerSvcModal(id) {
  editWorkerSvc=id||null; window._wkSvcPhoto=null;
  T('wk-svc-ttl', id?'Editar servicio':'Añadir servicio');
  var reset=function(){ var p=G('wk-sv-photo-preview'); if(p) p.innerHTML='<div style="font-size:13px;color:var(--muted)">Añadir foto</div>'; };
  if(id&&CUR_WORKER){
    var s=(CUR_WORKER.services||[]).filter(function(x){ return String(x.id)===String(id); })[0];
    if(s){
      var n=G('wk-sv-name'),pr=G('wk-sv-price'),dr=G('wk-sv-dur'),ds=G('wk-sv-desc');
      if(n) n.value=s.name; if(pr) pr.value=s.price; if(dr) dr.value=s.dur; if(ds) ds.value=s.desc||'';
      var pv=G('wk-sv-photo-preview'); if(pv&&s.photo) pv.innerHTML='<img src="'+sanitizeImageDataURL(s.photo)+'" class="photo-preview" alt="Servicio"/>'; else reset();
    }
  } else {
    ['wk-sv-name','wk-sv-price','wk-sv-desc'].forEach(function(i){ var e=G(i); if(e) e.value=''; });
    var dv=G('wk-sv-dur'); if(dv) dv.value='30'; reset();
  }
  openOv('ov-wk-svc');
}

function saveWorkerSvc() {
  var name=sanitizeText(V('wk-sv-name')), price=safeNum(V('wk-sv-price'),0), dur=safeInt(V('wk-sv-dur'),30), desc=sanitizeText(V('wk-sv-desc')), photo=window._wkSvcPhoto||null;
  if(!name){ toast('Nombre requerido','#EF4444'); return; }
  if(!CUR_WORKER) return; if(!CUR_WORKER.services) CUR_WORKER.services=[];
  if(editWorkerSvc){ var s=CUR_WORKER.services.filter(function(x){ return String(x.id)===String(editWorkerSvc); })[0]; if(s){ s.name=name; s.price=price; s.dur=dur; s.desc=desc; if(photo) s.photo=photo; } }
  else CUR_WORKER.services.push({id:'ws_'+Date.now(),name:name,price:price,dur:dur,desc:desc,photo:photo||''});
  editWorkerSvc=null; window._wkSvcPhoto=null; saveDB(); renderWorkerServices(); closeOv('ov-wk-svc'); toast('Servicio guardado','#4A7FD4');
}

function delWorkerService(id) {
  if(!CUR_WORKER) return;
  CUR_WORKER.services=(CUR_WORKER.services||[]).filter(function(s){ return String(s.id)!==String(id); });
  saveDB(); renderWorkerServices(); toast('Servicio eliminado','#475569');
  fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'delete_service',service_id:id})}).catch(function(){});
}

/* ══════════════════════════
   GALERÍA TRABAJADOR
══════════════════════════ */
function renderWorkerGallery() {
  if(!CUR_WORKER) return;
  var grid=G('wk-gallery'); if(!grid) return;
  grid.innerHTML=(CUR_WORKER.photos||[]).map(function(p,i){
    return '<div class="img-thumb"><img src="'+sanitizeImageDataURL(p)+'" alt="Foto '+(i+1)+'"><button onclick="delWorkerGalleryPhoto('+i+')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button></div>';
  }).join('');
}

function delWorkerGalleryPhoto(idx) {
  if(!CUR_WORKER) return;
  CUR_WORKER.photos=(CUR_WORKER.photos||[]).filter(function(_,i){ return i!==idx; });
  saveDB(); renderWorkerGallery(); toast('Foto eliminada','#475569');
}

/* ══════════════════════════════════════════════════
   FINANZAS TRABAJADOR — RENOVADA
══════════════════════════════════════════════════ */
function renderWorkerFinances() {
  if (!CUR_WORKER) return;

  var now       = new Date();
  var today     = now.toISOString().split('T')[0];
  var thisMonth = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');

  var dayOfWeek = now.getDay()===0 ? 6 : now.getDay()-1;
  var weekStart = new Date(now); weekStart.setDate(now.getDate()-dayOfWeek);
  var weekStartStr = weekStart.toISOString().split('T')[0];

  var appts  = CUR_WORKER.appointments || [];
  var active = appts.filter(function(a){ return a.status!=='cancelled'; });
  var paid   = appts.filter(function(a){ return a.status!=='cancelled' && a.price>0; });

  var revHoy  = active.filter(function(a){ return a.date===today; }).reduce(function(s,a){ return s+(a.price||0); },0);
  var revSem  = active.filter(function(a){ return a.date>=weekStartStr; }).reduce(function(s,a){ return s+(a.price||0); },0);
  var revMes  = active.filter(function(a){ return a.date&&a.date.slice(0,7)===thisMonth; }).reduce(function(s,a){ return s+(a.price||0); },0);
  var citHoy  = active.filter(function(a){ return a.date===today; }).length;
  var citSem  = active.filter(function(a){ return a.date>=weekStartStr; }).length;
  var citMes  = active.filter(function(a){ return a.date&&a.date.slice(0,7)===thisMonth; }).length;
  var completadas = appts.filter(function(a){ return a.status==='completed'; }).length;
  var ticket  = paid.length ? paid.reduce(function(s,a){ return s+(a.price||0); },0)/paid.length : 0;

  var svcCount={}; active.forEach(function(a){ if(a.svc) svcCount[a.svc]=(svcCount[a.svc]||0)+1; });
  var topSvc='—',topC=0; Object.keys(svcCount).forEach(function(k){ if(svcCount[k]>topC){topSvc=k;topC=svcCount[k];} });

  var cliCount={}; active.forEach(function(a){ if(a.client) cliCount[a.client]=(cliCount[a.client]||0)+1; });
  var topCli='—',topCC=0; Object.keys(cliCount).forEach(function(k){ if(cliCount[k]>topCC){topCli=k;topCC=cliCount[k];} });

  var months=[];
  for(var i=5;i>=0;i--){ var dm=new Date(now); dm.setMonth(dm.getMonth()-i); months.push(dm.getFullYear()+'-'+String(dm.getMonth()+1).padStart(2,'0')); }
  var mVals=months.map(function(m){ return active.filter(function(a){ return a.date&&a.date.slice(0,7)===m; }).reduce(function(s,a){ return s+(a.price||0); },0); });
  var mMax=Math.max.apply(null,mVals.concat([10]));

  var weeks=[];
  for(var i=7;i>=0;i--){
    var dw=new Date(now); dw.setDate(now.getDate()-(dayOfWeek+i*7));
    var wd=new Date(dw); wd.setDate(dw.getDate()-(wd.getDay()===0?6:wd.getDay()-1));
    weeks.push(wd.toISOString().split('T')[0]);
  }
  var wVals=weeks.map(function(ws){
    var we=new Date(ws+'T12:00'); we.setDate(we.getDate()+6); var weStr=we.toISOString().split('T')[0];
    return active.filter(function(a){ return a.date&&a.date>=ws&&a.date<=weStr; }).reduce(function(s,a){ return s+(a.price||0); },0);
  });
  var wMax=Math.max.apply(null,wVals.concat([10]));

  var html = '';

  html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Mi resumen de hoy</div>';
  html += '<div class="stats2" style="margin-bottom:20px">';
  html += _wkKpi('Ingresos hoy',    money(revHoy), 'var(--green)',  citHoy+' cita'+(citHoy!==1?'s':''));
  html += _wkKpi('Ingresos semana', money(revSem), 'var(--blue)',   citSem+' cita'+(citSem!==1?'s':''));
  html += _wkKpi('Ingresos mes',    money(revMes), 'var(--gold)',   citMes+' cita'+(citMes!==1?'s':''));
  html += _wkKpi('Ticket medio',    money(ticket), 'var(--purple)', 'por servicio');
  html += '</div>';

  html += '<div class="stats2" style="margin-bottom:20px">';
  html += _wkKpi('Completadas', completadas,  'var(--green)',  'históricas');
  html += _wkKpi('Servicio top', topSvc.length>10?topSvc.slice(0,10)+'…':topSvc, 'var(--blue3)', topC+' veces');
  html += _wkKpi('Cliente fiel', topCli.length>10?topCli.slice(0,10)+'…':topCli, 'var(--gold)',  topCC+' visitas');
  html += _wkKpi('Mis servicios', (CUR_WORKER.services||[]).length, 'var(--blue)', 'en catálogo');
  html += '</div>';

  html += '<div class="card" style="margin-bottom:16px">';
  html += '<div class="sec-hdr"><span class="sec-ttl">Mis ingresos por mes</span><span style="font-size:11px;color:var(--muted)">Últimos 6 meses</span></div>';
  html += '<div style="display:flex;align-items:flex-end;gap:5px;height:80px;margin-bottom:6px">';
  
  mVals.forEach(function(v,i){
    var h=Math.max(4,Math.round(v/mMax*100)), isLast=i===mVals.length-1;
    // ✅ AQUÍ ESTÁ LA CORRECCIÓN
    html+='<div style="flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:3px">';
    if(v>0) html+='<div style="font-size:8px;color:var(--muted)">'+money(v)+'</div>';
    html+='<div style="width:100%;height:'+h+'%;border-radius:5px 5px 0 0;background:'+(isLast?'linear-gradient(to top,var(--blue2),var(--blue3))':'linear-gradient(to top,rgba(74,127,212,.3),rgba(74,127,212,.5))')+'" title="'+money(v)+'"></div>';
    html+='</div>';
  });
  
  html+='</div><div style="display:flex;gap:5px">';
  months.forEach(function(m,i){ var p=m.split('-'); html+='<div style="flex:1;text-align:center;font-size:9px;color:'+(i===months.length-1?'var(--blue)':'var(--muted)')+';font-weight:700">'+MONTHS_SHORT[parseInt(p[1])-1]+'</div>'; });
  html+='</div></div>';

  html += '<div class="card" style="margin-bottom:16px">';
  html += '<div class="sec-hdr"><span class="sec-ttl">Mis ingresos por semana</span><span style="font-size:11px;color:var(--muted)">Últimas 8 semanas</span></div>';
  html += '<div style="display:flex;align-items:flex-end;gap:5px;height:80px;margin-bottom:6px">';
  
  wVals.forEach(function(v,i){
    var h=Math.max(4,Math.round(v/wMax*100)), isLast=i===wVals.length-1;
    // ✅ AQUÍ ESTÁ LA CORRECCIÓN
    html+='<div style="flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:3px">';
    if(v>0) html+='<div style="font-size:8px;color:var(--muted)">'+money(v)+'</div>';
    html+='<div style="width:100%;height:'+h+'%;border-radius:5px 5px 0 0;background:'+(isLast?'linear-gradient(to top,#16A34A,#4ADE80)':'linear-gradient(to top,rgba(34,197,94,.25),rgba(34,197,94,.5))')+'" title="'+money(v)+'"></div>';
    html+='</div>';
  });
  
  html+='</div><div style="display:flex;gap:5px">';
  weeks.forEach(function(ws,i){
    var d=new Date(ws+'T12:00');
    var lbl=String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
    html+='<div style="flex:1;text-align:center;font-size:9px;color:'+(i===weeks.length-1?'var(--green)':'var(--muted)')+';font-weight:700">'+lbl+'</div>';
  });
  html+='</div></div>';

  html += '<div class="sec-hdr"><span class="sec-ttl">Mi historial completo</span></div>';

// Mostrar TODAS las citas — confirmadas, completadas, canceladas, reagendadas
var historial = appts.slice().sort(function(a,b){ 
  return (b.date||'').localeCompare(a.date||''); 
}).slice(0, 50);

html += historial.length ? historial.map(function(a){ 
  return workerApptRowH(a); 
}).join('') : '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">Sin registros</div>';
  var el=G('wp-finanzas'); if(el) el.innerHTML=html;
}

/* Helper KPI trabajador */
function _wkKpi(label, value, color, sub) {
  return '<div class="sbox"><div class="slbl">'+label+'</div><div class="snum" style="color:'+color+';font-size:20px">'+value+'</div>'+(sub?'<div style="font-size:11px;color:var(--muted);margin-top:4px">'+sub+'</div>':'')+'</div>';
}

/* ══════════════════════════════════════════════
   HORARIO TRABAJADOR
══════════════════════════════════════════════ */
function getHorarioSeguro() {
  var plantilla=[
    {day:'Lunes',    open:true, from1:'09:00',to1:'14:00',hasBreak:true, from2:'16:00',to2:'20:00'},
    {day:'Martes',   open:true, from1:'09:00',to1:'14:00',hasBreak:true, from2:'16:00',to2:'20:00'},
    {day:'Miércoles',open:true, from1:'09:00',to1:'14:00',hasBreak:true, from2:'16:00',to2:'20:00'},
    {day:'Jueves',   open:true, from1:'09:00',to1:'14:00',hasBreak:true, from2:'16:00',to2:'20:00'},
    {day:'Viernes',  open:true, from1:'09:00',to1:'14:00',hasBreak:true, from2:'16:00',to2:'20:00'},
    {day:'Sábado',   open:true, from1:'09:00',to1:'14:00',hasBreak:false,from2:'',    to2:''},
    {day:'Domingo',  open:false,from1:'09:00',to1:'14:00',hasBreak:false,from2:'',    to2:''}
  ];
  if(!CUR_WORKER.horario||!Array.isArray(CUR_WORKER.horario)||CUR_WORKER.horario.length===0){
    CUR_WORKER.horario=plantilla.map(function(h){ return Object.assign({},h); });
    return CUR_WORKER.horario;
  }
  var diasPlantilla=plantilla.map(function(p){ return p.day; });
  diasPlantilla.forEach(function(dia,idx){
    var existente=CUR_WORKER.horario.filter(function(h){ return h.day===dia; })[0];
    if(!existente){ CUR_WORKER.horario.push(Object.assign({},plantilla[idx])); }
    else {
      if(existente.from1===undefined) existente.from1=plantilla[idx].from1;
      if(existente.to1===undefined)   existente.to1=plantilla[idx].to1;
      if(existente.from===undefined)  existente.from=existente.from1;
      if(existente.to===undefined)    existente.to=existente.to1;
      if(existente.hasBreak===undefined) existente.hasBreak=plantilla[idx].hasBreak;
      if(existente.from2===undefined) existente.from2=plantilla[idx].from2;
      if(existente.to2===undefined)   existente.to2=plantilla[idx].to2;
    }
  });
  CUR_WORKER.horario.sort(function(a,b){ return diasPlantilla.indexOf(a.day)-diasPlantilla.indexOf(b.day); });
  return CUR_WORKER.horario;
}

function renderWorkerHorario() {
  if(!CUR_WORKER) return;
  var horario=getHorarioSeguro();
  H('wk-horario-days', horario.map(function(day,i){
    var f1=day.from1||day.from||'09:00', t1=day.to1||day.to||'14:00', hb=!!day.hasBreak, f2=day.from2||'16:00', t2=day.to2||'20:00';
    var content='';
    if(day.open){
      content='<div style="margin-top:12px">'
        +'<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">'
        +'<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px;text-transform:uppercase">Inicio turno</div><input class="inp" type="time" value="'+san(f1)+'" data-wfrom1="'+i+'" onchange="window._wkHorarioChange(this)" style="padding:9px 12px"/></div>'
        +'<div style="color:var(--muted);font-size:16px;padding-top:22px">—</div>'
        +'<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px;text-transform:uppercase">Fin turno</div><input class="inp" type="time" value="'+san(t1)+'" data-wto1="'+i+'" onchange="window._wkHorarioChange(this)" style="padding:9px 12px"/></div>'
        +'</div>'
        +'<div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg3);padding:10px 14px;border-radius:12px;margin-bottom:12px">'
        +'<div style="font-size:12px;font-weight:700;color:var(--t2)">Descanso / Almuerzo</div>'
        +'<div class="toggle '+(hb?'on':'')+'" onclick="window.toggleWorkerBreak('+i+')"></div>'
        +'</div>'
        +(hb?'<div style="display:flex;gap:10px;align-items:center;animation:popIn .3s ease">'
          +'<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px;text-transform:uppercase">Reinicio turno</div><input class="inp" type="time" value="'+san(f2)+'" data-wfrom2="'+i+'" onchange="window._wkHorarioChange(this)" style="padding:9px 12px"/></div>'
          +'<div style="color:var(--muted);font-size:16px;padding-top:22px">—</div>'
          +'<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px;text-transform:uppercase">Fin jornada</div><input class="inp" type="time" value="'+san(t2)+'" data-wto2="'+i+'" onchange="window._wkHorarioChange(this)" style="padding:9px 12px"/></div>'
          +'</div>':'')
        +'</div>';
    }
    return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between"><div style="font-weight:700;font-size:14px">'+san(day.day)+'</div>'
      +'<div class="toggle '+(day.open?'on':'')+'" onclick="window.toggleWorkerHorarioDay('+i+')"></div></div>'
      +content+'</div>';
  }).join(''));
}

window._wkHorarioChange = function(el) {
  if(!CUR_WORKER||!CUR_WORKER.horario) return;
  var val=el.value, i;
  if(el.hasAttribute('data-wfrom1')){ i=parseInt(el.getAttribute('data-wfrom1')); CUR_WORKER.horario[i].from1=val; CUR_WORKER.horario[i].from=val; }
  if(el.hasAttribute('data-wto1')){   i=parseInt(el.getAttribute('data-wto1'));   CUR_WORKER.horario[i].to1=val;   CUR_WORKER.horario[i].to=val;   }
  if(el.hasAttribute('data-wfrom2')){ i=parseInt(el.getAttribute('data-wfrom2')); CUR_WORKER.horario[i].from2=val; }
  if(el.hasAttribute('data-wto2')){   i=parseInt(el.getAttribute('data-wto2'));   CUR_WORKER.horario[i].to2=val;   }
};

window.toggleWorkerBreak = function(i) {
  if(!CUR_WORKER||!CUR_WORKER.horario||!CUR_WORKER.horario[i]) return;
  var h=CUR_WORKER.horario[i]; h.hasBreak=!h.hasBreak;
  if(h.hasBreak&&!h.from2){ h.from2='16:00'; h.to2='20:00'; } if(!h.hasBreak){ h.from2=''; h.to2=''; }
  renderWorkerHorario();
  if(window.innerWidth>=1024) setTimeout(function(){ if(typeof initHorarioSplit==='function') initHorarioSplit(); },100);
};

window.toggleWorkerHorarioDay = function(i) {
  if(!CUR_WORKER||!CUR_WORKER.horario||!CUR_WORKER.horario[i]) return;
  CUR_WORKER.horario[i].open=!CUR_WORKER.horario[i].open;
  renderWorkerHorario();
  if(window.innerWidth>=1024) setTimeout(function(){ if(typeof initHorarioSplit==='function') initHorarioSplit(); },100);
};

/* ══════════════════════════
   PERFIL TRABAJADOR
══════════════════════════ */
function renderWorkerProfile() {
  if(!CUR_WORKER) return;
  var nm=G('wk-pf-nm'),ph=G('wk-pf-phone'),sp=G('wk-pf-spec'),em=G('wk-pf-email');
  if(nm) nm.value=CUR_WORKER.name||''; if(ph) ph.value=CUR_WORKER.phone||''; if(sp) sp.value=CUR_WORKER.spec||''; if(em) em.value=CUR_WORKER.email||'';
  var profileCover=G('wk-profile-cover'); if(profileCover&&CUR_WORKER.cover) profileCover.style.backgroundImage='url('+sanitizeImageDataURL(CUR_WORKER.cover)+')';
  var pv=G('wk-profile-photo-preview');
  if(pv){ if(CUR_WORKER.photo) pv.innerHTML='<img src="'+sanitizeImageDataURL(CUR_WORKER.photo)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="Foto"/>'; else pv.innerHTML='<span style="font-size:32px;font-weight:800;color:#fff">'+(CUR_WORKER.name||'?').charAt(0).toUpperCase()+'</span>'; }
  T('wk-pf-biz-name', CUR?CUR.name:'');
  T('wk-pf-biz-addr', CUR?((CUR.addr||'')+' '+(CUR.city||'')):'');
}

function saveWorkerProfile() {
  if(!CUR_WORKER) return;
  var nm=sanitizeText(V('wk-pf-nm'));
  if(!nm){ toast('El nombre no puede estar vacío','#EF4444'); return; }
  CUR_WORKER.name=nm; CUR_WORKER.phone=sanitizeText(V('wk-pf-phone')); CUR_WORKER.spec=sanitizeText(V('wk-pf-spec'));
  syncWorkerToCloud(); saveDB(); initWorkerPanel(); toast('Perfil guardado','#4A7FD4');
}

function saveWorkerPassword() {
  var p1=V('wk-pass-new'),p2=V('wk-pass-confirm'); hideErr('wk-pass-err');
  if(!p1||p1.length<6){ showErr('wk-pass-err','Mínimo 6 caracteres.'); return; }
  if(p1!==p2){ showErr('wk-pass-err','Las contraseñas no coinciden.'); return; }
  if(!CUR_WORKER) return;
  CUR_WORKER.pass=p1; syncWorkerToCloud(); saveDB();
  var f1=G('wk-pass-new'),f2=G('wk-pass-confirm'); if(f1) f1.value=''; if(f2) f2.value='';
  toast('Contraseña actualizada','#22C55E');
}

/* ══════════════════════════
   SYNC WORKER
══════════════════════════ */
function syncWorkerToCloud() {
  if(!CUR_WORKER||!CUR) return;
  return fetch('/api/save-worker',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      action:'upsert',
      worker:{
        id:CUR_WORKER.id,
        business_id:CUR.id,
        name:CUR_WORKER.name||'',
        email:CUR_WORKER.email||'',
        password:CUR_WORKER.pass||CUR_WORKER.password||'',
        phone:CUR_WORKER.phone||'',
        avatar:CUR_WORKER.photo||'',
        cover:CUR_WORKER.cover||'',
        role:CUR_WORKER.spec||'barber',
        horario:CUR_WORKER.horario||[]
      }
    })
  }).then(function(res){
    if(!res.ok) throw new Error('No se pudo guardar en la nube');
    return res.json().catch(function(){ return { success:true }; });
  });
}

function commitWorkerHorarioFromDOM() {
  if(!CUR_WORKER||!Array.isArray(CUR_WORKER.horario)) return;
  var root = G('wk-horario-days');
  if(!root) return;
  var inputs = root.querySelectorAll('input[type="time"]');
  for (var i=0; i<inputs.length; i++) {
    var el = inputs[i];
    if (typeof window._wkHorarioChange === 'function') window._wkHorarioChange(el);
  }
}

async function saveWorkerHorario() {
  if(!CUR_WORKER) return;
  commitWorkerHorarioFromDOM();
  saveDB();

  var btn = G('save-wk-horario-btn');
  var prevTxt = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    btn.style.opacity = '.85';
  }

  try {
    await syncWorkerToCloud();
    toast('Horario guardado','#22C55E');
  } catch (e) {
    toast('No se pudo guardar. Intenta de nuevo','#EF4444');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevTxt || 'Guardar horario';
      btn.style.opacity = '1';
    }
  }
}

/* ══════════════════════════
   FOTOS TRABAJADOR
══════════════════════════ */
function setupWorkerPhotoUpload() {
  var coverInp=G('wk-profile-cover-input');
  if(coverInp){ coverInp.addEventListener('change',async function(e){ var f=e.target.files[0]; if(!f||!validImageType(f)){ toast('Solo JPG/PNG/WebP (máx 5MB)','#EF4444'); return; } toast('...','#F59E0B'); var url=await uploadToImgBB(f); if(url&&CUR_WORKER){ CUR_WORKER.cover=url; renderWorkerProfile(); toast('Portada subida, presiona Guardar','#22C55E'); } }); }
  var logoInp=G('wk-profile-photo-input');
  if(logoInp){ logoInp.addEventListener('change',async function(e){ var f=e.target.files[0]; if(!f||!validImageType(f)){ toast('Solo JPG/PNG/WebP (máx 5MB)','#EF4444'); return; } toast('...','#F59E0B'); var url=await uploadToImgBB(f); if(url&&CUR_WORKER){ CUR_WORKER.photo=url; renderWorkerProfile(); toast('Foto subida, presiona Guardar','#22C55E'); } }); }
  var galInp=G('wk-gallery-input');
  if(galInp){ galInp.addEventListener('change',async function(e){ var files=Array.from(e.target.files); if(!files.length) return; toast('Subiendo '+files.length+' foto(s)...','#F59E0B'); for(var i=0;i<files.length;i++){ var f=files[i]; if(!validImageType(f)) continue; var url=await uploadToImgBB(f); if(url&&CUR_WORKER){ if(!CUR_WORKER.photos) CUR_WORKER.photos=[]; if(CUR_WORKER.photos.length>=20){ toast('Máximo 20 fotos','#EF4444'); return; } CUR_WORKER.photos.push(url); saveDB(); renderWorkerGallery(); } } toast('Fotos subidas','#22C55E'); }); }
  var svcInp=G('wk-sv-photo-input');
  if(svcInp){ svcInp.addEventListener('change',async function(e){ var f=e.target.files[0]; if(!f||!validImageType(f)) return; toast('...','#F59E0B'); var url=await uploadToImgBB(f); if(url){ window._wkSvcPhoto=url; var pv=G('wk-sv-photo-preview'); if(pv) pv.innerHTML='<img src="'+url+'" class="photo-preview" alt="Servicio"/>'; toast('Foto lista','#22C55E'); } }); }
}

/* ══════════════════════════
   NOTIFICACIONES
══════════════════════════ */
function copyWorkerLink() {
  if(!CUR) return;
  var link='https://citasproonline.com/#b/'+CUR.id;
  var t=document.createElement('input'); t.value=link; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
  toast('Link copiado','#4A7FD4');
}
window.copyWorkerLink=copyWorkerLink;

function renderWorkerNotifBadge() {
  if(!CUR_WORKER) return;
  var unread=(CUR_WORKER.notifications||[]).filter(function(n){ return !n.read; }).length;
  var b1=G('wn-notif-badge'),b2=G('wk-notif-badge');
  if(b1){ b1.style.display=unread>0?'flex':'none'; b1.textContent=unread; }
  if(b2){ b2.style.display=unread>0?'inline-block':'none'; b2.textContent=unread; }
}

function renderWorkerNotifications() {
  if(!CUR_WORKER) return;
  var notifs=CUR_WORKER.notifications||[];
  if(notifs.length){
    H('wk-notif-list', notifs.map(function(n,i){
      var bg=n.read?'transparent':'rgba(74,127,212,.08)', border=n.read?'var(--b)':'var(--blue)';
      return '<div style="padding:16px;border-bottom:1px solid var(--b);background:'+bg+';border-left:3px solid '+border+';margin-bottom:8px;border-radius:0 12px 12px 0">'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-weight:800;font-size:14px;color:'+(n.read?'var(--text)':'var(--blue)')+'">'+san(n.title)+'</span><span style="font-size:11px;color:var(--muted)">'+san(n.date)+'</span></div>'
        +'<div style="font-size:13px;color:var(--t2);line-height:1.5">'+san(n.body)+'</div>'
        +(!n.read?'<div style="text-align:right;margin-top:8px"><button onclick="markWorkerNotifRead('+i+')" style="background:var(--bblue);border:none;color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:12px">Marcar como leída</button></div>':'')
        +'</div>';
    }).join(''));
  } else { H('wk-notif-list','<div style="text-align:center;padding:40px 20px;color:var(--muted)"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;opacity:0.4"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg><div style="font-size:14px">No tienes notificaciones nuevas</div></div>'); }
  var clearBtn=G('clear-notif-btn');
  if(clearBtn){ clearBtn.onclick=function(){ openConfirmModal('Limpiar Notificaciones','¿Borrar todas las notificaciones?',function(){ CUR_WORKER.notifications=[]; saveDB(); renderWorkerNotifications(); renderWorkerNotifBadge(); toast('Notificaciones borradas','#475569'); }); }; }
}

function markWorkerNotifRead(index) {
  if(!CUR_WORKER||!CUR_WORKER.notifications||!CUR_WORKER.notifications[index]) return;
  CUR_WORKER.notifications[index].read=true; saveDB(); renderWorkerNotifications(); renderWorkerNotifBadge();
}
window.markWorkerNotifRead=markWorkerNotifRead;

/* ══════════════════════════════════════════════
   AGENDA TRABAJADOR
══════════════════════════════════════════════ */
function initWorkerAgenda() {
  if(!CUR_WORKER) return;
  var parts=workerCalDay.split('-'), days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'], d=new Date(workerCalDay+'T12:00');
  var lbl=G('wk-agenda-day-label');
  if(lbl){ lbl.textContent=days[d.getDay()]+' '+parseInt(parts[2])+' de '+MONTHS[parseInt(parts[1])-1]+' de '+parts[0]; lbl.style.textAlign='center'; lbl.style.fontSize='14px'; }
  var listEl=G('wk-agenda-list'); if(listEl) listEl.innerHTML='';
  renderWorkerDailyTimeline(workerCalDay);
}

function renderWorkerDailyTimeline(dateStr) {
  var container=G('wk-daily-timeline'); if(!container||!CUR_WORKER) return;
  var pxPerMin=1.5;
  var startHour=8, endHour=20;
  var minHour=23, maxHour=0;

  // 1) Ajustar por horario real del trabajador para ese día
  try {
    var d = new Date(dateStr + 'T12:00');
    var dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    var dayName = dayNames[d.getDay()];
    var wh = (CUR_WORKER.horario || []).find(function(h){ return h.day === dayName; });
    if (wh && wh.open) {
      var dayStarts = [];
      var dayEnds = [];
      var f1 = wh.from1 || wh.from;
      var t1 = wh.to1 || wh.to;
      if (f1 && t1) {
        dayStarts.push(parseInt(String(f1).split(':')[0], 10));
        dayEnds.push(parseInt(String(t1).split(':')[0], 10));
      }
      if (wh.hasBreak && wh.from2 && wh.to2) {
        dayStarts.push(parseInt(String(wh.from2).split(':')[0], 10));
        dayEnds.push(parseInt(String(wh.to2).split(':')[0], 10));
      }
      if (dayStarts.length && dayEnds.length) {
        minHour = Math.min(minHour, Math.min.apply(null, dayStarts));
        maxHour = Math.max(maxHour, Math.max.apply(null, dayEnds));
      }
    }
  } catch(e) {}

  // 2) Ajustar por citas del día (si existen)
  var wAppts=(CUR_WORKER.appointments||[]).filter(function(a){ return a.date===dateStr&&a.status!=='cancelled'; });
  wAppts.forEach(function(a){
    var parts = String(a.time || '00:00').split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) || 0;
    if (isNaN(h)) return;

    var dur = 30;
    if (CUR_WORKER.services && CUR_WORKER.services.length) {
      var svc = CUR_WORKER.services.find(function(s){ return s.name === a.svc; });
      if (svc) dur = parseInt(svc.dur, 10) || 30;
    }
    var endMins = (h * 60 + m) + dur;
    var endHourAppt = Math.ceil(endMins / 60);

    minHour = Math.min(minHour, h);
    maxHour = Math.max(maxHour, endHourAppt);
  });

  // 3) Rango final compacto (con margen) y límites seguros
  if (minHour <= maxHour) {
    startHour = Math.max(6, minHour - 1);
    endHour = Math.min(23, maxHour + 1);
  }
  if (endHour - startHour < 8) {
    var targetEnd = Math.min(23, startHour + 8);
    endHour = Math.max(endHour, targetEnd);
  }

  function buildTimelineSegment(segStartHour, segEndHour, title, apptsOffsetIndex) {
    var totalHeight=(segEndHour-segStartHour)*60*pxPerMin;
    var segAppts = wAppts.filter(function(a){
      var parts = String(a.time || '00:00').split(':');
      var h = parseInt(parts[0], 10);
      return !isNaN(h) && h >= segStartHour && h < segEndHour;
    });

    var segHtml='<div class="tl-wrap"><div class="tl-grid"><div class="tl-times"><div class="tl-header"></div><div class="tl-body" style="height:'+totalHeight+'px;background:none;">';
    for(var hh=segStartHour;hh<=segEndHour;hh++) segHtml+='<div class="tl-time-lbl" style="top:'+((hh-segStartHour)*60*pxPerMin)+'px">'+String(hh).padStart(2,'0')+':00</div>';
    segHtml+='</div></div><div class="tl-col"><div class="tl-header"><div style="font-size:12px;font-weight:800;color:var(--blue)">'+title+'</div></div><div class="tl-body" style="height:'+totalHeight+'px;background-size:100% '+(60*pxPerMin)+'px;">';
    if(typeof generateBlockedTimeHTML==='function') segHtml+=generateBlockedTimeHTML(CUR_WORKER,dateStr,segStartHour,segEndHour,pxPerMin);
    segAppts.forEach(function(a,i){
      if(typeof generateTimelineApptHTML==='function') segHtml+=generateTimelineApptHTML(a,CUR_WORKER,segStartHour,pxPerMin,(apptsOffsetIndex||0)+i,'openWorkerApptDetail');
    });
    segHtml+='</div></div></div></div>';
    return segHtml;
  }

  container.classList.remove('wk-split-timeline');
  container.innerHTML = buildTimelineSegment(startHour, endHour, 'Mi Agenda', 0);
}