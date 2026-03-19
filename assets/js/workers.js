'use strict';

/* ══════════════════════════════════════════════════
   WORKERS.JS — Panel del trabajador
   El trabajador ve sus propias citas, servicios,
   finanzas, horario, galería y perfil.
══════════════════════════════════════════════════ */

/* ══════════════════════════
   INIT PANEL TRABAJADOR
══════════════════════════ */
function showWorkerPanel() {
  if (!DB.currentWorker) { goTo('s-portal'); return; }
  var biz = getBizById(DB.currentWorker.bizId);
  var worker = getWorkerById(DB.currentWorker.bizId, DB.currentWorker.workerId);
  if (!biz || !worker) { goTo('s-portal'); return; }
  CUR_WORKER = worker;
  CUR = biz;
  goTo('s-worker');
  initWorkerPanel();
}

function initWorkerPanel() {
  if (!CUR_WORKER || !CUR) return;

  /* Topbar */
  var av = G('wk-hdr-av');
  if (av) {
    if (CUR_WORKER.photo) {
      av.innerHTML = '<img src="' + sanitizeImageDataURL(CUR_WORKER.photo) + '" style="width:100%;height:100%;object-fit:cover" alt="Foto"/>';
    } else {
      av.textContent = (CUR_WORKER.name || '?').charAt(0).toUpperCase();
    }
  }
  T('wk-hdr-nm', CUR_WORKER.name);
  T('wk-hdr-biz', CUR.name);

  /* Logo barbería */
  var bizAv = G('wk-biz-av');
  if (bizAv) {
    if (CUR.logo) {
      bizAv.innerHTML = '<img src="' + sanitizeImageDataURL(CUR.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo"/>';
    } else {
      bizAv.textContent = (CUR.name || '?').charAt(0).toUpperCase();
    }
  }
  T('wk-biz-nm', CUR.name);

  /* Stats home */
  var today = new Date().toISOString().split('T')[0];
  var appts = CUR_WORKER.appointments || [];
  var todayA = appts.filter(function(a) { return a.date === today && a.status !== 'cancelled'; });
  var thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  var thisMonthStart = new Date(); thisMonthStart.setDate(1);
  var weekA  = appts.filter(function(a) { return a.date >= thisWeekStart.toISOString().split('T')[0] && a.status !== 'cancelled'; });
  var monthA = appts.filter(function(a) { return a.date >= thisMonthStart.toISOString().split('T')[0] && a.status !== 'cancelled'; });

  T('wk-today',  todayA.length);
  T('wk-rev',    money(todayA.reduce(function(s,a){ return s+(a.price||0); }, 0)));
  T('wk-week',   weekA.length);
  T('wk-month',  money(monthA.reduce(function(s,a){ return s+(a.price||0); }, 0)));

  /* Link compartido (mismo que la barbería) */
  var link = 'citas-pro.netlify.app/b/' + CUR.id;
  T('wk-link-show', link);
  var waShare = G('wk-wa-share');
  if (waShare) waShare.href = 'https://wa.me/?text=' + encodeURIComponent('Reserva tu cita con ' + CUR_WORKER.name + ' en ' + CUR.name + ' → https://' + link);

  /* Notificaciones badge */
  renderWorkerNotifBadge();

  /* Render todas las tabs */
  renderWorkerTodayAppts(todayA);
  renderWorkerServices();
  renderWorkerGallery();
  renderWorkerFinances();
  renderWorkerHorario();
  renderWorkerCalendar();
  initWorkerAgenda();
  renderWorkerProfile();

  workerTab('home');
}

/* ══════════════════════════
   TABS TRABAJADOR
══════════════════════════ */
function workerTab(tab) {
  var tabs = ['home','agenda','servicios','galeria','finanzas','horario','perfil','notif'];
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    var pa = G('wp-' + t), bt = G('wn-' + t);
    if (pa) pa.classList[t === tab ? 'add' : 'remove']('on');
    if (bt) bt.classList[t === tab ? 'add' : 'remove']('on');
  }
  if (tab === 'agenda')   initWorkerAgenda();
  if (tab === 'notif')    renderWorkerNotifications();
  if (tab === 'finanzas') renderWorkerFinances();
}

/* ══════════════════════════
   CITAS HOY
══════════════════════════ */
function renderWorkerTodayAppts(appts) {
  if (!appts && CUR_WORKER) {
    var today = new Date().toISOString().split('T')[0];
    appts = (CUR_WORKER.appointments || []).filter(function(a) { return a.date === today; });
  }
  H('wk-appts', appts && appts.length
    ? appts.map(function(a) { return workerApptRowH(a); }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Sin citas para hoy</div></div>');
}

function workerApptRowH(a) {
  var sc = {
    confirmed: { c:'var(--blue)',  bg:'rgba(74,127,212,.1)',  l:'Conf.' },
    pending:   { c:'var(--gold)',  bg:'rgba(245,158,11,.1)',  l:'Pend.' },
    completed: { c:'var(--green)', bg:'rgba(34,197,94,.1)',   l:'Hecho' },
    cancelled: { c:'var(--red)',   bg:'rgba(239,68,68,.1)',   l:'Canc.' }
  }[a.status] || { c:'var(--blue)', bg:'rgba(74,127,212,.1)', l:'Conf.' };

  var initials = san((a.client||'?').split(' ').map(function(n){ return n[0]||''; }).slice(0,2).join('').toUpperCase());
  return '<div class="appt-row" onclick="openWorkerApptDetail(\'' + sanitizeText(a.id) + '\')">'
    + '<div class="appt-avatar">' + initials + '</div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + san(a.client) + '</div>'
    + '<div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(a.svc) + '</div>'
    + (a.notes ? '<div style="font-size:11px;color:var(--muted);margin-top:2px;font-style:italic">' + san(a.notes) + '</div>' : '')
    + '</div>'
    + '<div style="text-align:right;flex-shrink:0">'
    + '<div style="font-weight:800;font-size:15px;color:var(--blue)">' + money(a.price) + '</div>'
    + '<div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(a.time) + '</div>'
    + '<div style="margin-top:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:' + sc.bg + ';color:' + sc.c + '">' + sc.l + '</div>'
    + '</div></div>';
}

function openWorkerApptDetail(id) {
  if (!CUR_WORKER) return;
  var a = null;
  (CUR_WORKER.appointments || []).forEach(function(ap) { if (String(ap.id) === String(id)) a = ap; });
  if (!a) return;

  H('wk-appt-detail-content',
    '<div style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--r);padding:16px;margin-bottom:14px">'
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">'
    + '<div class="appt-avatar" style="width:52px;height:52px;font-size:20px">'
    + san((a.client||'?').split(' ').map(function(n){ return n[0]||''; }).slice(0,2).join('').toUpperCase())
    + '</div>'
    + '<div>'
    + '<div style="font-size:18px;font-weight:900">' + san(a.client) + '</div>'
    + (a.phone ? '<div style="font-size:14px;color:var(--blue3);margin-top:3px;font-weight:600">' + san(a.phone) + '</div>' : '')
    + (a.email ? '<div style="font-size:13px;color:var(--t2);margin-top:2px">' + san(a.email) + '</div>' : '')
    + '</div></div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    + '<div class="sbox"><div class="slbl">Fecha</div><div style="font-size:14px;font-weight:700">' + san(a.date) + '</div></div>'
    + '<div class="sbox"><div class="slbl">Hora</div><div style="font-size:18px;font-weight:900;color:var(--blue)">' + san(a.time) + '</div></div>'
    + '<div class="sbox"><div class="slbl">Servicio</div><div style="font-size:13px;font-weight:700">' + san(a.svc) + '</div></div>'
    + '<div class="sbox"><div class="slbl">Total</div><div style="font-size:18px;font-weight:900;color:var(--green)">' + money(a.price) + '</div></div>'
    + '</div>'
  );

  var waBtn = G('wk-appt-wa-btn');
  if (waBtn && a.phone) waBtn.href = 'https://wa.me/' + a.phone.replace(/\D/g,'') + '?text=' + encodeURIComponent('Hola ' + a.client + ', te recuerdo tu cita en ' + CUR.name + ' el ' + a.date + ' a las ' + a.time + '.');

  var cb = G('wk-appt-complete-btn'); if (cb) cb.onclick = function() { updateWorkerApptStatus(id,'completed'); };
  var ca = G('wk-appt-cancel-btn');   if (ca) ca.onclick = function() { updateWorkerApptStatus(id,'cancelled'); };
  openOv('ov-wk-appt-detail');
}

function updateWorkerApptStatus(id, status) {
  if (!CUR_WORKER) return;
  (CUR_WORKER.appointments || []).forEach(function(a) { if (String(a.id) === String(id)) a.status = status; });
  saveDB();
  closeOv('ov-wk-appt-detail');
  renderWorkerTodayAppts();
  initWorkerAgenda();
  renderWorkerFinances();
  toast(status === 'completed' ? 'Cita completada' : 'Cita cancelada', status === 'completed' ? '#22C55E' : '#EF4444');
}

/* ══════════════════════════
   AGENDA TRABAJADOR
══════════════════════════ */
var workerCalDate   = new Date();
var workerCalDay    = new Date().toISOString().split('T')[0];

function renderWorkerCalendar() {
  var now = workerCalDate, year = now.getFullYear(), month = now.getMonth();
  T('wk-cal-title', MONTHS[month] + ' ' + year);
  var firstDay = new Date(year,month,1).getDay(), daysInMonth = new Date(year,month+1,0).getDate();
  var today = new Date().toISOString().split('T')[0];
  var appts = CUR_WORKER ? (CUR_WORKER.appointments || []) : [];
  var apptDates = {};
  appts.forEach(function(a){ if(a.date && a.status!=='cancelled') apptDates[a.date]=true; });

  var html = '';
  for (var i = 0; i < firstDay; i++) html += '<div class="cal-day other-month"></div>';
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var cls = 'cal-day';
    if (ds === today) cls += ' today';
    if (ds === workerCalDay && ds !== today) cls += ' sel';
    if (apptDates[ds]) cls += ' has-appts';
    html += '<div class="' + cls + '" onclick="selectWorkerCalDay(\'' + ds + '\')">' + d + '</div>';
  }
  H('wk-cal-grid', html);
}

function selectWorkerCalDay(ds) { workerCalDay = ds; renderWorkerCalendar(); initWorkerAgenda(); }
function prevWorkerMonth() { workerCalDate.setMonth(workerCalDate.getMonth()-1); renderWorkerCalendar(); }
function nextWorkerMonth() { workerCalDate.setMonth(workerCalDate.getMonth()+1); renderWorkerCalendar(); }

function initWorkerAgenda() {
  if (!CUR_WORKER) return;
  var dayAppts = (CUR_WORKER.appointments || [])
    .filter(function(a){ return a.date === workerCalDay; })
    .sort(function(a,b){ return (a.time||'').localeCompare(b.time||''); });

  var parts = workerCalDay.split('-');
  var days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var d = new Date(workerCalDay + 'T12:00');
  T('wk-agenda-day-label', days[d.getDay()] + ' ' + parseInt(parts[2]) + ' de ' + MONTHS[parseInt(parts[1])-1] + ' de ' + parts[0]);
  H('wk-agenda-list', dayAppts.length
    ? dayAppts.map(function(a){ return workerApptRowH(a); }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Sin citas para este día</div></div>');
}

/* ══════════════════════════
   SERVICIOS TRABAJADOR (CRUD)
══════════════════════════ */
var editWorkerSvc = null;

function renderWorkerServices() {
  if (!CUR_WORKER) return;
  var svcs = CUR_WORKER.services || [];
  H('wk-svcs-list', svcs.length
    ? svcs.map(function(s) {
        var thumb = s.photo
          ? '<img src="' + sanitizeImageDataURL(s.photo) + '" style="width:46px;height:46px;border-radius:11px;object-fit:cover;flex-shrink:0" alt="Servicio">'
          : '<div style="width:46px;height:46px;border-radius:11px;background:var(--bblue);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">✂</div>';
        return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;display:flex;align-items:center;gap:12px;margin-bottom:10px">'
          + thumb
          + '<div style="flex:1"><div style="font-weight:700;font-size:14px">' + san(s.name) + '</div>'
          + '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + s.dur + 'min' + (s.desc ? ' · ' + san(s.desc) : '') + '</div></div>'
          + '<div style="text-align:right;flex-shrink:0">'
          + '<div style="font-weight:800;font-size:16px;color:var(--blue)">' + money(s.price) + '</div>'
          + '<div style="display:flex;gap:5px;margin-top:6px">'
          + '<button onclick="openWorkerSvcModal(\'' + sanitizeText(s.id) + '\')" style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:var(--rpill);padding:5px 10px;color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)">Editar</button>'
          + '<button onclick="delWorkerService(\'' + sanitizeText(s.id) + '\')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);border-radius:var(--rpill);padding:5px 8px;color:var(--red);font-size:12px;cursor:pointer">&#x2715;</button>'
          + '</div></div></div>';
      }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Sin servicios aún</div></div>');
}

function openWorkerSvcModal(id) {
  editWorkerSvc = id || null;
  window._wkSvcPhoto = null;
  T('wk-svc-ttl', id ? 'Editar servicio' : 'Añadir servicio');
  var reset = function() {
    var p = G('wk-sv-photo-preview');
    if (p) p.innerHTML = '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
  };
  if (id && CUR_WORKER) {
    var s = (CUR_WORKER.services||[]).filter(function(x){ return String(x.id)===String(id); })[0];
    if (s) {
      var n=G('wk-sv-name'), pr=G('wk-sv-price'), dr=G('wk-sv-dur'), ds=G('wk-sv-desc');
      if(n) n.value=s.name; if(pr) pr.value=s.price; if(dr) dr.value=s.dur; if(ds) ds.value=s.desc||'';
      var pv = G('wk-sv-photo-preview');
      if(pv && s.photo) pv.innerHTML='<img src="'+sanitizeImageDataURL(s.photo)+'" class="photo-preview" alt="Servicio"/>'; else reset();
    }
  } else {
    ['wk-sv-name','wk-sv-price','wk-sv-desc'].forEach(function(i){ var e=G(i); if(e) e.value=''; });
    var dv=G('wk-sv-dur'); if(dv) dv.value='30'; reset();
  }
  openOv('ov-wk-svc');
}

function saveWorkerSvc() {
  var name  = sanitizeText(V('wk-sv-name'));
  var price = safeNum(V('wk-sv-price'),0);
  var dur   = safeInt(V('wk-sv-dur'),30);
  var desc  = sanitizeText(V('wk-sv-desc'));
  var photo = window._wkSvcPhoto || null;
  if (!name) { toast('Nombre requerido','#EF4444'); return; }
  if (!CUR_WORKER) return;
  if (!CUR_WORKER.services) CUR_WORKER.services = [];
  if (editWorkerSvc) {
    var s = CUR_WORKER.services.filter(function(x){ return String(x.id)===String(editWorkerSvc); })[0];
    if (s) { s.name=name; s.price=price; s.dur=dur; s.desc=desc; if(photo) s.photo=photo; }
  } else {
    CUR_WORKER.services.push({ id:'ws_'+Date.now(), name:name, price:price, dur:dur, desc:desc, photo:photo||'' });
  }
  editWorkerSvc = null; window._wkSvcPhoto = null;
  saveDB(); renderWorkerServices(); closeOv('ov-wk-svc'); toast('Servicio guardado','#4A7FD4');
}

function delWorkerService(id) {
  if (!CUR_WORKER) return;
  CUR_WORKER.services = (CUR_WORKER.services||[]).filter(function(s){ return String(s.id)!==String(id); });
  saveDB(); renderWorkerServices(); toast('Servicio eliminado','#475569');
}

/* ══════════════════════════
   GALERÍA TRABAJADOR
══════════════════════════ */
function renderWorkerGallery() {
  if (!CUR_WORKER) return;
  var photos = CUR_WORKER.photos || [];
  var grid = G('wk-gallery');
  if (!grid) return;
  grid.innerHTML = photos.map(function(p,i) {
    return '<div class="img-thumb">'
      + '<img src="' + sanitizeImageDataURL(p) + '" alt="Foto ' + (i+1) + '">'
      + '<button onclick="delWorkerGalleryPhoto(' + i + ')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button>'
      + '</div>';
  }).join('');
}

function delWorkerGalleryPhoto(idx) {
  if (!CUR_WORKER) return;
  CUR_WORKER.photos = (CUR_WORKER.photos||[]).filter(function(_,i){ return i!==idx; });
  saveDB(); renderWorkerGallery(); toast('Foto eliminada','#475569');
}

/* ══════════════════════════
   FINANZAS TRABAJADOR
══════════════════════════ */
function renderWorkerFinances() {
  if (!CUR_WORKER) return;
  var now = new Date(), thisMonth = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var appts = CUR_WORKER.appointments || [];
  var monthAppts = appts.filter(function(a){ return a.date && a.date.slice(0,7)===thisMonth && a.status!=='cancelled'; });
  var monthRev = monthAppts.reduce(function(s,a){ return s+(a.price||0); },0);
  var clients = []; appts.forEach(function(a){ if(a.client && clients.indexOf(a.client)<0) clients.push(a.client); });
  var svcCount={}; appts.filter(function(a){ return a.status!=='cancelled'; }).forEach(function(a){ if(a.svc) svcCount[a.svc]=(svcCount[a.svc]||0)+1; });
  var topSvc='—',topCount=0; Object.keys(svcCount).forEach(function(k){ if(svcCount[k]>topCount){ topSvc=k; topCount=svcCount[k]; } });
  var paid = appts.filter(function(a){ return a.status!=='cancelled'&&a.price>0; });
  var ticket = paid.length ? paid.reduce(function(s,a){ return s+(a.price||0); },0)/paid.length : 0;

  T('wk-fin-ing',     money(monthRev));
  T('wk-fin-clients', clients.length);
  T('wk-fin-top-svc', topSvc.length>10 ? topSvc.slice(0,10)+'…' : topSvc);
  T('wk-fin-ticket',  money(ticket));

  var months=[];
  for(var i=5;i>=0;i--){ var d=new Date(now); d.setMonth(d.getMonth()-i); months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')); }
  var vals = months.map(function(m){ return appts.filter(function(a){ return a.date&&a.date.slice(0,7)===m&&a.status!=='cancelled'; }).reduce(function(s,a){ return s+(a.price||0); },0); });
  var max = Math.max.apply(null, vals.concat([10]));
  var ch = G('wk-fin-chart');
  if(ch) ch.innerHTML = vals.map(function(v,i){ return '<div class="bar'+(i===vals.length-1?' hi':'')+'" style="height:'+Math.max(4,Math.round(v/max*100))+'%" title="'+money(v)+'"></div>'; }).join('');
  var ml = G('wk-fin-months');
  if(ml) ml.innerHTML = months.map(function(m,i){ var parts=m.split('-'); return '<div style="flex:1;text-align:center;font-size:9px;color:'+(i===months.length-1?'var(--blue)':'var(--muted)')+';font-weight:700">'+MONTHS_SHORT[parseInt(parts[1])-1]+'</div>'; }).join('');
  H('wk-appts-fin', paid.slice().sort(function(a,b){ return b.date.localeCompare(a.date); }).slice(0,20).map(function(a){ return workerApptRowH(a); }).join(''));
}

/* ══════════════════════════
   HORARIO TRABAJADOR
══════════════════════════ */
function renderWorkerHorario() {
  if (!CUR_WORKER) return;
  var horario = CUR_WORKER.horario || DEFAULT_HORARIO.map(function(h){ return Object.assign({},h); });
  H('wk-horario-days', horario.map(function(day,i) {
    return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:'+(day.open?'12px':'0')+'">'
      + '<div style="font-weight:700;font-size:14px">'+san(day.day)+'</div>'
      + '<div class="toggle '+(day.open?'on':'')+'" onclick="toggleWorkerHorarioDay('+i+')"></div>'
      + '</div>'
      + (day.open
        ? '<div style="display:flex;gap:10px;align-items:center">'
          + '<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px">APERTURA</div><input class="inp" type="time" value="'+san(day.from)+'" data-wfrom="'+i+'" style="padding:9px 12px"/></div>'
          + '<div style="color:var(--muted);font-size:16px;padding-top:18px">—</div>'
          + '<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px">CIERRE</div><input class="inp" type="time" value="'+san(day.to)+'" data-wto="'+i+'" style="padding:9px 12px"/></div>'
          + '</div>'
        : '')
      + '</div>';
  }).join(''));
  document.querySelectorAll('[data-wfrom]').forEach(function(el){ el.addEventListener('change', function(){ var i=parseInt(el.getAttribute('data-wfrom')); if(CUR_WORKER.horario&&CUR_WORKER.horario[i]) CUR_WORKER.horario[i].from=el.value; }); });
  document.querySelectorAll('[data-wto]').forEach(function(el){   el.addEventListener('change', function(){ var i=parseInt(el.getAttribute('data-wto'));   if(CUR_WORKER.horario&&CUR_WORKER.horario[i]) CUR_WORKER.horario[i].to  =el.value; }); });
}

function toggleWorkerHorarioDay(i) {
  if (!CUR_WORKER) return;
  if (!CUR_WORKER.horario) CUR_WORKER.horario = DEFAULT_HORARIO.map(function(h){ return Object.assign({},h); });
  CUR_WORKER.horario[i].open = !CUR_WORKER.horario[i].open;
  renderWorkerHorario();
}

/* ══════════════════════════
   PERFIL TRABAJADOR
══════════════════════════ */
function renderWorkerProfile() {
  if (!CUR_WORKER) return;
  var nm=G('wk-pf-nm'), ph=G('wk-pf-phone'), sp=G('wk-pf-spec'), em=G('wk-pf-email');
  if(nm) nm.value = CUR_WORKER.name  || '';
  if(ph) ph.value = CUR_WORKER.phone || '';
  if(sp) sp.value = CUR_WORKER.spec  || '';
  if(em) em.value = CUR_WORKER.email || '';

  /* Foto de perfil */
  var pv = G('wk-profile-photo-preview');
  if (pv) {
    if (CUR_WORKER.photo) {
      pv.innerHTML = '<img src="' + sanitizeImageDataURL(CUR_WORKER.photo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="Foto"/>';
    } else {
      pv.innerHTML = '<span style="font-size:32px;font-weight:800;color:#fff">' + (CUR_WORKER.name||'?').charAt(0).toUpperCase() + '</span>';
    }
  }

  /* Info barbería */
  T('wk-pf-biz-name', CUR ? CUR.name : '');
  T('wk-pf-biz-addr', CUR ? ((CUR.addr||'') + ' ' + (CUR.city||'')) : '');
}

function saveWorkerProfile() {
  if (!CUR_WORKER) return;
  var nm = sanitizeText(V('wk-pf-nm'));
  if (!nm) { toast('El nombre no puede estar vacío','#EF4444'); return; }
  CUR_WORKER.name  = nm;
  CUR_WORKER.phone = sanitizeText(V('wk-pf-phone'));
  CUR_WORKER.spec  = sanitizeText(V('wk-pf-spec'));
  saveDB();
  initWorkerPanel();
  toast('Perfil guardado','#4A7FD4');
}

/* ══════════════════════════
   CAMBIAR CONTRASEÑA TRABAJADOR
══════════════════════════ */
function saveWorkerPassword() {
  var p1 = V('wk-pass-new'), p2 = V('wk-pass-confirm');
  hideErr('wk-pass-err');
  if (!p1 || p1.length < 6) { showErr('wk-pass-err','Mínimo 6 caracteres.'); return; }
  if (p1 !== p2)              { showErr('wk-pass-err','Las contraseñas no coinciden.'); return; }
  if (!CUR_WORKER) return;
  CUR_WORKER.pass = p1;
  saveDB();
  var f1=G('wk-pass-new'), f2=G('wk-pass-confirm');
  if(f1) f1.value=''; if(f2) f2.value='';
  toast('Contraseña actualizada','#22C55E');
}

/* ══════════════════════════
   FOTO DE PERFIL TRABAJADOR
══════════════════════════ */
function setupWorkerPhotoUpload() {
  var logoInp = G('wk-profile-photo-input');
  if (logoInp) {
    logoInp.addEventListener('change', function(e) {
      var f = e.target.files[0];
      if (!f || !validImageType(f)) { toast('Solo JPG/PNG/WebP (máx 5MB)','#EF4444'); return; }
      var r = new FileReader();
      r.onload = function(ev) {
        var d = sanitizeImageDataURL(ev.target.result);
        if (d && CUR_WORKER) { CUR_WORKER.photo = d; saveDB(); renderWorkerProfile(); initWorkerPanel(); }
      };
      r.readAsDataURL(f);
    });
  }

  var galInp = G('wk-gallery-input');
  if (galInp) {
    galInp.addEventListener('change', function(e) {
      Array.from(e.target.files).forEach(function(f) {
        if (!validImageType(f)) return;
        var r = new FileReader();
        r.onload = function(ev) {
          var d = sanitizeImageDataURL(ev.target.result);
          if (d && CUR_WORKER) {
            if (!CUR_WORKER.photos) CUR_WORKER.photos = [];
            if (CUR_WORKER.photos.length >= 20) { toast('Máximo 20 fotos','#EF4444'); return; }
            CUR_WORKER.photos.push(d); saveDB(); renderWorkerGallery();
          }
        };
        r.readAsDataURL(f);
      });
    });
  }

  var svcInp = G('wk-sv-photo-input');
  if (svcInp) {
    svcInp.addEventListener('change', function(e) {
      var f = e.target.files[0];
      if (!f || !validImageType(f)) return;
      var r = new FileReader();
      r.onload = function(ev) {
        var d = sanitizeImageDataURL(ev.target.result);
        if (d) {
          window._wkSvcPhoto = d;
          var pv = G('wk-sv-photo-preview');
          if (pv) pv.innerHTML = '<img src="' + d + '" class="photo-preview" alt="Servicio"/>';
        }
      };
      r.readAsDataURL(f);
    });
  }
}

/* ══════════════════════════
   COPIAR LINK BARBERÍA
══════════════════════════ */
function copyWorkerLink() {
  if (!CUR) return;
  var link = 'https://citas-pro.netlify.app/b/' + CUR.id;
  try { navigator.clipboard.writeText(link); } catch(e) {}
  toast('Enlace copiado','#4A7FD4');
}