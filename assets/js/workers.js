'use strict';

/* ══════════════════════════════════════════════════
   WORKERS.JS — Panel del trabajador
══════════════════════════════════════════════════ */

function showWorkerPanel() {
  if (!DB.currentWorker) { 
      goTo('s-portal'); 
      return; 
  }
  var biz = getBizById(DB.currentWorker.bizId);
  var worker = getWorkerById(DB.currentWorker.bizId, DB.currentWorker.workerId);
  
  if (!biz || !worker) { 
      goTo('s-portal'); 
      return; 
  }
  
  CUR_WORKER = worker;
  CUR = biz;
  goTo('s-worker');
  initWorkerPanel();
}
if (typeof registerFCMToken === 'function') registerFCMToken();

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
  var thisWeekStart = new Date(); 
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  var thisMonthStart = new Date(); 
  thisMonthStart.setDate(1);
  
  var weekA  = appts.filter(function(a) { return a.date >= thisWeekStart.toISOString().split('T')[0] && a.status !== 'cancelled'; });
  var monthA = appts.filter(function(a) { return a.date >= thisMonthStart.toISOString().split('T')[0] && a.status !== 'cancelled'; });

  T('wk-today',  todayA.length);
  T('wk-rev',    money(todayA.reduce(function(s,a){ return s + (a.price || 0); }, 0)));
  T('wk-week',   weekA.length);
  T('wk-month',  money(monthA.reduce(function(s,a){ return s + (a.price || 0); }, 0)));

  /* Link compartido */
  var link = 'citasproonline.com/#b/' + CUR.id;
  T('wk-link-show', link);
  var waShare = G('wk-wa-share');
  if (waShare) {
      waShare.href = 'https://wa.me/?text=' + encodeURIComponent('Reserva tu cita con ' + CUR_WORKER.name + ' en ' + CUR.name + ' → https://' + link);
  }

  /* Renderizar vistas */
  renderWorkerNotifBadge();
  renderWorkerTodayAppts(todayA);
  renderWorkerServices();
  renderWorkerGallery();
  renderWorkerFinances();
  renderWorkerHorario();
  renderWorkerCalendar();
  renderWorkerWeeklySchedule();
  initWorkerAgenda();
  renderWorkerProfile();

  if (typeof renderWorkerHomeStats === 'function') {
      renderWorkerHomeStats();
  }

  workerTab('home');
}

function workerTab(tab) {
  var tabs = ['home','agenda','semana','servicios','galeria','finanzas','horario','perfil','notif'];
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    var pa = G('wp-' + t);
    var bt = G('wn-' + t);
    if (pa) pa.classList[t === tab ? 'add' : 'remove']('on');
    if (bt) bt.classList[t === tab ? 'add' : 'remove']('on');
  }
  
  if (tab === 'agenda')   initWorkerAgenda();
  if (tab === 'semana')   renderWorkerWeeklySchedule();
  if (tab === 'notif')    renderWorkerNotifications();
  if (tab === 'horario')  renderWorkerHorario();
  
  if (tab === 'finanzas') {
      if (typeof renderWorkerFinanzas === 'function') {
          renderWorkerFinanzas();
      } else {
          renderWorkerFinances();
      }
  }
  
  if (tab === 'home') {
      if (typeof renderWorkerHomeStats === 'function') {
          renderWorkerHomeStats();
      }
  }
}

/* ══════════════════════════
   CITAS HOY TRABAJADOR
══════════════════════════ */
function renderWorkerTodayAppts(appts) {
  if (!appts && CUR_WORKER) {
    var today = new Date().toISOString().split('T')[0];
    appts = (CUR_WORKER.appointments || []).filter(function(a) { 
       return a.date === today && a.status !== 'cancelled'; 
    });
  }
  
  if (appts && appts.length) {
      H('wk-appts', appts.map(function(a) { return workerApptRowH(a); }).join(''));
  } else {
      H('wk-appts', '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Sin citas para hoy</div></div>');
  }
}

function workerApptRowH(a) {
  var sc = {
    confirmed:   { c:'var(--blue)',  bg:'rgba(74,127,212,.1)',  l:'Conf.' },
    rescheduled: { c:'#F59E0B',      bg:'rgba(245,158,11,.15)', l:'Reag.' },
    in_progress: { c:'#A855F7',      bg:'rgba(168,85,247,.15)', l:'En curso' },
    pending:     { c:'var(--gold)',  bg:'rgba(245,158,11,.1)',  l:'Pend.' },
    completed:   { c:'var(--green)', bg:'rgba(34,197,94,.1)',   l:'Hecho' },
    cancelled:   { c:'var(--red)',   bg:'rgba(239,68,68,.1)',   l:'Canc.' }
  }[a.status] || { c:'var(--blue)', bg:'rgba(74,127,212,.1)', l:'Conf.' };
 
  var initials = san((a.client || '?').split(' ').map(function(n){ return n[0]||''; }).slice(0,2).join('').toUpperCase());
  
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
  (CUR_WORKER.appointments || []).forEach(function(ap) { 
      if (String(ap.id) === String(id)) a = ap; 
  });
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
  if (waBtn && a.phone) {
      waBtn.href = 'https://wa.me/' + a.phone.replace(/\D/g,'') + '?text=' + encodeURIComponent('Hola ' + a.client + ', te recuerdo tu cita en ' + CUR.name + ' el ' + a.date + ' a las ' + a.time + '.');
  }

  var cb = G('wk-appt-complete-btn'); 
  if (cb) cb.onclick = function() { updateWorkerApptStatus(id, 'completed'); };
  
  var ca = G('wk-appt-cancel-btn');   
  if (ca) ca.onclick = function() { updateWorkerApptStatus(id, 'cancelled'); };
  
  openOv('ov-wk-appt-detail');
}

function updateWorkerApptStatus(id, status) {
  if (!CUR_WORKER) return;
  (CUR_WORKER.appointments || []).forEach(function(a) { 
      if (String(a.id) === String(id)) a.status = status; 
  });
  saveDB(); 
  closeOv('ov-wk-appt-detail'); 
  renderWorkerTodayAppts(); 
  initWorkerAgenda(); 
  renderWorkerFinances();
  if (typeof renderWorkerFinanzas === 'function') renderWorkerFinanzas();
  toast(status === 'completed' ? 'Cita completada' : 'Cita cancelada', status === 'completed' ? '#22C55E' : '#EF4444');
}

/* ══════════════════════════
   AGENDA TRABAJADOR
══════════════════════════ */
var workerCalDate = new Date();
var workerCalDay  = new Date().toISOString().split('T')[0];

function renderWorkerCalendar() {
  var now = workerCalDate, year = now.getFullYear(), month = now.getMonth();
  T('wk-cal-title', MONTHS[month] + ' ' + year);
  
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = new Date().toISOString().split('T')[0];
  
  var appts = CUR_WORKER ? (CUR_WORKER.appointments || []) : [];
  var apptDates = {};
  appts.forEach(function(a){ 
      if(a.date && a.status !== 'cancelled') apptDates[a.date] = true; 
  });

  var html = '';
  for (var i = 0; i < firstDay; i++) html += '<div class="cal-day other-month"></div>';
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var cls = 'cal-day';
    if (ds === today) cls += ' today';
    if (ds === workerCalDay) cls += ' sel'; 
    if (apptDates[ds]) cls += ' has-appts';
    html += '<div class="' + cls + '" onclick="selectWorkerCalDay(\'' + ds + '\')">' + d + '</div>';
  }
  H('wk-cal-grid', html);
}

function selectWorkerCalDay(ds) { 
  workerCalDay = ds; 
  renderWorkerCalendar(); 
  initWorkerAgenda(); 
}

function prevWorkerMonth() { 
  workerCalDate.setMonth(workerCalDate.getMonth() - 1); 
  renderWorkerCalendar(); 
}

function nextWorkerMonth() { 
  workerCalDate.setMonth(workerCalDate.getMonth() + 1); 
  renderWorkerCalendar(); 
}

function initWorkerAgenda() {
  if (!CUR_WORKER) return;
  var dayAppts = (CUR_WORKER.appointments || [])
      .filter(function(a){ return a.date === workerCalDay; })
      .sort(function(a, b){ return (a.time || '').localeCompare(b.time || ''); });
  
  var parts = workerCalDay.split('-');
  var days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var d = new Date(workerCalDay + 'T12:00');
  
  T('wk-agenda-day-label', days[d.getDay()] + ' ' + parseInt(parts[2]) + ' de ' + MONTHS[parseInt(parts[1])-1] + ' de ' + parts[0]);
  
  if (dayAppts.length) {
      H('wk-agenda-list', dayAppts.map(function(a){ return workerApptRowH(a); }).join(''));
  } else {
      H('wk-agenda-list', '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Sin citas para este día</div></div>');
  }
}

/* ══════════════════════════
   SERVICIOS TRABAJADOR
══════════════════════════ */
var editWorkerSvc = null;

function renderWorkerServices() {
  if (!CUR_WORKER) return;
  var svcs = CUR_WORKER.services || [];
  
  if (svcs.length) {
      H('wk-svcs-list', svcs.map(function(s) {
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
      }).join(''));
  } else {
      H('wk-svcs-list', '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Sin servicios aún</div></div>');
  }
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
    var s = (CUR_WORKER.services||[]).filter(function(x){ return String(x.id) === String(id); })[0];
    if (s) {
      var n = G('wk-sv-name'), pr = G('wk-sv-price'), dr = G('wk-sv-dur'), ds = G('wk-sv-desc');
      if (n) n.value = s.name; 
      if (pr) pr.value = s.price; 
      if (dr) dr.value = s.dur; 
      if (ds) ds.value = s.desc || '';
      var pv = G('wk-sv-photo-preview');
      if (pv && s.photo) {
          pv.innerHTML = '<img src="' + sanitizeImageDataURL(s.photo) + '" class="photo-preview" alt="Servicio"/>'; 
      } else {
          reset();
      }
    }
  } else {
    ['wk-sv-name','wk-sv-price','wk-sv-desc'].forEach(function(i) { 
        var e = G(i); if (e) e.value = ''; 
    });
    var dv = G('wk-sv-dur'); 
    if (dv) dv.value = '30'; 
    reset();
  }
  openOv('ov-wk-svc');
}

function saveWorkerSvc() {
  var name  = sanitizeText(V('wk-sv-name'));
  var price = safeNum(V('wk-sv-price'), 0);
  var dur   = safeInt(V('wk-sv-dur'), 30);
  var desc  = sanitizeText(V('wk-sv-desc'));
  var photo = window._wkSvcPhoto || null;
  
  if (!name) { toast('Nombre requerido', '#EF4444'); return; }
  if (!CUR_WORKER) return;
  if (!CUR_WORKER.services) CUR_WORKER.services = [];
  
  if (editWorkerSvc) {
    var s = CUR_WORKER.services.filter(function(x) { return String(x.id) === String(editWorkerSvc); })[0];
    if (s) { 
        s.name = name; s.price = price; s.dur = dur; s.desc = desc; 
        if (photo) s.photo = photo; 
    }
  } else {
    CUR_WORKER.services.push({ id: 'ws_' + Date.now(), name: name, price: price, dur: dur, desc: desc, photo: photo || '' });
  }
  
  editWorkerSvc = null; 
  window._wkSvcPhoto = null; 
  saveDB(); 
  renderWorkerServices(); 
  closeOv('ov-wk-svc'); 
  toast('Servicio guardado', '#4A7FD4');
}

function delWorkerService(id) {
  if (!CUR_WORKER) return;
  CUR_WORKER.services = (CUR_WORKER.services || []).filter(function(s) { return String(s.id) !== String(id); });
  saveDB(); 
  renderWorkerServices(); 
  toast('Servicio eliminado', '#475569');

  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'delete_service', service_id: id })
  }).catch(function(e) { console.error('Error borrando servicio en la nube:', e); });
}

/* ══════════════════════════
   GALERÍA TRABAJADOR
══════════════════════════ */
function renderWorkerGallery() {
  if (!CUR_WORKER) return;
  var photos = CUR_WORKER.photos || [];
  var grid = G('wk-gallery'); 
  if (!grid) return;
  
  grid.innerHTML = photos.map(function(p, i) {
    return '<div class="img-thumb"><img src="' + sanitizeImageDataURL(p) + '" alt="Foto ' + (i+1) + '">'
         + '<button onclick="delWorkerGalleryPhoto(' + i + ')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.65);border:none;border-radius:5px;color:#fff;font-size:11px;padding:2px 6px;cursor:pointer">×</button></div>';
  }).join('');
}

function delWorkerGalleryPhoto(idx) {
  if (!CUR_WORKER) return;
  CUR_WORKER.photos = (CUR_WORKER.photos || []).filter(function(_, i) { return i !== idx; }); 
  saveDB(); 
  renderWorkerGallery(); 
  toast('Foto eliminada', '#475569');
}

/* ══════════════════════════
   FINANZAS TRABAJADOR
══════════════════════════ */
function renderWorkerFinances() {
  if (!CUR_WORKER) return;
  var now = new Date();
  var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var appts = CUR_WORKER.appointments || [];
  
  var monthAppts = appts.filter(function(a) { return a.date && a.date.slice(0, 7) === thisMonth && a.status !== 'cancelled'; });
  var monthRev = monthAppts.reduce(function(s, a) { return s + (a.price || 0); }, 0);
  
  var clients = []; 
  appts.forEach(function(a) { if (a.client && clients.indexOf(a.client) < 0) clients.push(a.client); });
  
  var svcCount = {}; 
  appts.filter(function(a) { return a.status !== 'cancelled'; }).forEach(function(a) { 
      if (a.svc) svcCount[a.svc] = (svcCount[a.svc] || 0) + 1; 
  });
  
  var topSvc = '—', topCount = 0; 
  Object.keys(svcCount).forEach(function(k) { 
      if (svcCount[k] > topCount) { topSvc = k; topCount = svcCount[k]; } 
  });
  
  var paid = appts.filter(function(a) { return a.status !== 'cancelled' && a.price > 0; });
  var ticket = paid.length ? paid.reduce(function(s, a) { return s + (a.price || 0); }, 0) / paid.length : 0;

  T('wk-fin-ing',     money(monthRev)); 
  T('wk-fin-clients', clients.length);
  T('wk-fin-top-svc', topSvc.length > 10 ? topSvc.slice(0, 10) + '…' : topSvc); 
  T('wk-fin-ticket',  money(ticket));

  var months = [];
  for(var i = 5; i >= 0; i--) { 
      var d = new Date(now); 
      d.setMonth(d.getMonth() - i); 
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); 
  }
  
  var vals = months.map(function(m) { 
      return appts.filter(function(a) { return a.date && a.date.slice(0, 7) === m && a.status !== 'cancelled'; })
                  .reduce(function(s, a) { return s + (a.price || 0); }, 0); 
  });
  
  var max = Math.max.apply(null, vals.concat([10]));
  var ch = G('wk-fin-chart');
  if (ch) {
      ch.innerHTML = vals.map(function(v, i) { 
          return '<div class="bar' + (i === vals.length - 1 ? ' hi' : '') + '" style="height:' + Math.max(4, Math.round(v / max * 100)) + '%" title="' + money(v) + '"></div>'; 
      }).join('');
  }
  
  var ml = G('wk-fin-months');
  if (ml) {
      ml.innerHTML = months.map(function(m, i) { 
          var parts = m.split('-'); 
          return '<div style="flex:1;text-align:center;font-size:9px;color:' + (i === months.length - 1 ? 'var(--blue)' : 'var(--muted)') + ';font-weight:700">' + MONTHS_SHORT[parseInt(parts[1]) - 1] + '</div>'; 
      }).join('');
  }
  
  H('wk-appts-fin', paid.slice().sort(function(a, b) { return b.date.localeCompare(a.date); }).slice(0, 20).map(function(a) { return workerApptRowH(a); }).join(''));
}

/* ══════════════════════════════════════════════
   HORARIO TRABAJADOR  ← AQUÍ ESTABA EL BUG
   
   Problema: DEFAULT_HORARIO no tenía las props
   from1/to1/hasBreak/from2/to2, así que al hacer
   CUR_WORKER.horario || DEFAULT_HORARIO.map(...)
   el horario quedaba vacío o sin campos válidos.
   
   Fix: definimos un horario seguro DENTRO de esta
   función. Si el worker ya tiene horario guardado
   lo usamos tal cual. Si no, creamos uno completo
   con todos los campos necesarios y lo asignamos
   a CUR_WORKER.horario para que persista.
══════════════════════════════════════════════ */
function getHorarioSeguro() {
  var plantilla = [
    { day: 'Lunes',     open: true,  from1: '09:00', to1: '14:00', hasBreak: true,  from2: '16:00', to2: '20:00' },
    { day: 'Martes',    open: true,  from1: '09:00', to1: '14:00', hasBreak: true,  from2: '16:00', to2: '20:00' },
    { day: 'Miércoles', open: true,  from1: '09:00', to1: '14:00', hasBreak: true,  from2: '16:00', to2: '20:00' },
    { day: 'Jueves',    open: true,  from1: '09:00', to1: '14:00', hasBreak: true,  from2: '16:00', to2: '20:00' },
    { day: 'Viernes',   open: true,  from1: '09:00', to1: '14:00', hasBreak: true,  from2: '16:00', to2: '20:00' },
    { day: 'Sábado',    open: true,  from1: '09:00', to1: '14:00', hasBreak: false, from2: '',      to2: '' },
    { day: 'Domingo',   open: false, from1: '09:00', to1: '14:00', hasBreak: false, from2: '',      to2: '' }
  ];

  // Si el worker no tiene horario, asignarle la plantilla completa
  if (!CUR_WORKER.horario || !Array.isArray(CUR_WORKER.horario) || CUR_WORKER.horario.length === 0) {
    CUR_WORKER.horario = plantilla.map(function(h) { return Object.assign({}, h); });
    return CUR_WORKER.horario;
  }

  // Si tiene horario pero faltan propiedades en algún día, rellenarlas
  var diasPlantilla = plantilla.map(function(p) { return p.day; });
  diasPlantilla.forEach(function(dia, idx) {
    var existente = CUR_WORKER.horario.filter(function(h) { return h.day === dia; })[0];
    if (!existente) {
      // Día faltante: añadirlo
      CUR_WORKER.horario.push(Object.assign({}, plantilla[idx]));
    } else {
      // Rellenar props que falten sin machacar las que ya existen
      if (existente.from1  === undefined) existente.from1  = plantilla[idx].from1;
      if (existente.to1    === undefined) existente.to1    = plantilla[idx].to1;
      if (existente.from   === undefined) existente.from   = existente.from1;
      if (existente.to     === undefined) existente.to     = existente.to1;
      if (existente.hasBreak === undefined) existente.hasBreak = plantilla[idx].hasBreak;
      if (existente.from2  === undefined) existente.from2  = plantilla[idx].from2;
      if (existente.to2    === undefined) existente.to2    = plantilla[idx].to2;
    }
  });

  // Ordenar para que siempre salga en orden L-D
  CUR_WORKER.horario.sort(function(a, b) {
    return diasPlantilla.indexOf(a.day) - diasPlantilla.indexOf(b.day);
  });

  return CUR_WORKER.horario;
}

function renderWorkerHorario() {
  if (!CUR_WORKER) return;

  var horario = getHorarioSeguro();

  H('wk-horario-days', horario.map(function(day, i) {
    var f1 = day.from1 || day.from || '09:00';
    var t1 = day.to1   || day.to   || '14:00';
    var hb = !!day.hasBreak;
    var f2 = day.from2 || '16:00';
    var t2 = day.to2   || '20:00';

    var content = '';
    if (day.open) {
      content = '<div style="margin-top:12px">'

        // Turno principal
        + '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">'
        + '<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px;text-transform:uppercase">Inicio turno</div>'
        + '<input class="inp" type="time" value="' + san(f1) + '" data-wfrom1="' + i + '" onchange="window._wkHorarioChange(this)" style="padding:9px 12px"/></div>'
        + '<div style="color:var(--muted);font-size:16px;padding-top:22px">—</div>'
        + '<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px;text-transform:uppercase">Fin turno</div>'
        + '<input class="inp" type="time" value="' + san(t1) + '" data-wto1="' + i + '" onchange="window._wkHorarioChange(this)" style="padding:9px 12px"/></div>'
        + '</div>'

        // Toggle descanso
        + '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg3);padding:10px 14px;border-radius:12px;margin-bottom:12px">'
        + '<div style="font-size:12px;font-weight:700;color:var(--t2)">Descanso / Almuerzo</div>'
        + '<div class="toggle ' + (hb ? 'on' : '') + '" onclick="window.toggleWorkerBreak(' + i + ')"></div>'
        + '</div>'

        // Segundo turno (solo si hasBreak)
        + (hb
          ? '<div style="display:flex;gap:10px;align-items:center;animation:popIn .3s ease">'
          + '<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px;text-transform:uppercase">Reinicio turno</div>'
          + '<input class="inp" type="time" value="' + san(f2) + '" data-wfrom2="' + i + '" onchange="window._wkHorarioChange(this)" style="padding:9px 12px"/></div>'
          + '<div style="color:var(--muted);font-size:16px;padding-top:22px">—</div>'
          + '<div style="flex:1"><div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:5px;text-transform:uppercase">Fin jornada</div>'
          + '<input class="inp" type="time" value="' + san(t2) + '" data-wto2="' + i + '" onchange="window._wkHorarioChange(this)" style="padding:9px 12px"/></div>'
          + '</div>'
          : '')

        + '</div>';
    }

    return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between">'
      + '<div style="font-weight:700;font-size:14px">' + san(day.day) + '</div>'
      + '<div class="toggle ' + (day.open ? 'on' : '') + '" onclick="window.toggleWorkerHorarioDay(' + i + ')"></div>'
      + '</div>'
      + content
      + '</div>';
  }).join(''));
}

// Manejador centralizado de cambios en inputs de horario
window._wkHorarioChange = function(el) {
  if (!CUR_WORKER || !CUR_WORKER.horario) return;
  var val = el.value;

  if (el.hasAttribute('data-wfrom1')) {
    var i = parseInt(el.getAttribute('data-wfrom1'));
    CUR_WORKER.horario[i].from1 = val;
    CUR_WORKER.horario[i].from  = val;
  }
  if (el.hasAttribute('data-wto1')) {
    var i = parseInt(el.getAttribute('data-wto1'));
    CUR_WORKER.horario[i].to1 = val;
    CUR_WORKER.horario[i].to  = val;
  }
  if (el.hasAttribute('data-wfrom2')) {
    var i = parseInt(el.getAttribute('data-wfrom2'));
    CUR_WORKER.horario[i].from2 = val;
  }
  if (el.hasAttribute('data-wto2')) {
    var i = parseInt(el.getAttribute('data-wto2'));
    CUR_WORKER.horario[i].to2 = val;
  }
};

window.toggleWorkerBreak = function(i) {
  if (!CUR_WORKER || !CUR_WORKER.horario || !CUR_WORKER.horario[i]) return;
  var h = CUR_WORKER.horario[i];
  h.hasBreak = !h.hasBreak;
  if (h.hasBreak && !h.from2) { h.from2 = '16:00'; h.to2 = '20:00'; }
  if (!h.hasBreak) { h.from2 = ''; h.to2 = ''; }
  renderWorkerHorario();
};

window.toggleWorkerHorarioDay = function(i) {
  if (!CUR_WORKER || !CUR_WORKER.horario || !CUR_WORKER.horario[i]) return;
  CUR_WORKER.horario[i].open = !CUR_WORKER.horario[i].open;
  renderWorkerHorario();
};

/* ══════════════════════════
   PERFIL TRABAJADOR
══════════════════════════ */
function renderWorkerProfile() {
  if (!CUR_WORKER) return;
  var nm = G('wk-pf-nm'), ph = G('wk-pf-phone'), sp = G('wk-pf-spec'), em = G('wk-pf-email');
  
  if (nm) nm.value = CUR_WORKER.name  || '';
  if (ph) ph.value = CUR_WORKER.phone || '';
  if (sp) sp.value = CUR_WORKER.spec  || '';
  if (em) em.value = CUR_WORKER.email || '';

  var profileCover = G('wk-profile-cover');
  if (profileCover && CUR_WORKER.cover) {
      profileCover.style.backgroundImage = 'url(' + sanitizeImageDataURL(CUR_WORKER.cover) + ')';
  }

  var pv = G('wk-profile-photo-preview');
  if (pv) {
    if (CUR_WORKER.photo) {
        pv.innerHTML = '<img src="' + sanitizeImageDataURL(CUR_WORKER.photo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="Foto"/>';
    } else {
        pv.innerHTML = '<span style="font-size:32px;font-weight:800;color:#fff">' + (CUR_WORKER.name || '?').charAt(0).toUpperCase() + '</span>';
    }
  }
  T('wk-pf-biz-name', CUR ? CUR.name : '');
  T('wk-pf-biz-addr', CUR ? ((CUR.addr || '') + ' ' + (CUR.city || '')) : '');
}

function saveWorkerProfile() {
  if (!CUR_WORKER) return;
  var nm = sanitizeText(V('wk-pf-nm'));
  if (!nm) { toast('El nombre no puede estar vacío', '#EF4444'); return; }
  
  CUR_WORKER.name  = nm; 
  CUR_WORKER.phone = sanitizeText(V('wk-pf-phone')); 
  CUR_WORKER.spec  = sanitizeText(V('wk-pf-spec'));
  
  syncWorkerToCloud();
  saveDB(); 
  initWorkerPanel(); 
  toast('Perfil guardado', '#4A7FD4');
}

function saveWorkerPassword() {
  var p1 = V('wk-pass-new'), p2 = V('wk-pass-confirm');
  hideErr('wk-pass-err');
  
  if (!p1 || p1.length < 6) { showErr('wk-pass-err', 'Mínimo 6 caracteres.'); return; }
  if (p1 !== p2)              { showErr('wk-pass-err', 'Las contraseñas no coinciden.'); return; }
  if (!CUR_WORKER) return;
  
  CUR_WORKER.pass = p1; 
  syncWorkerToCloud();
  saveDB();
  
  var f1 = G('wk-pass-new'), f2 = G('wk-pass-confirm'); 
  if (f1) f1.value = ''; 
  if (f2) f2.value = '';
  
  toast('Contraseña actualizada', '#22C55E');
}

/* ══════════════════════════
   SYNC WORKER A SUPABASE
══════════════════════════ */
function syncWorkerToCloud() {
  if (!CUR_WORKER || !CUR) return;
  
  fetch('/api/save-worker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upsert',
      worker: {
        id:          CUR_WORKER.id,
        business_id: CUR.id,
        name:        CUR_WORKER.name || '',
        email:       CUR_WORKER.email || '',
        password:    CUR_WORKER.pass || CUR_WORKER.password || '',
        phone:       CUR_WORKER.phone || '',
        avatar:      CUR_WORKER.photo || '',
        cover:       CUR_WORKER.cover || '',
        role:        CUR_WORKER.spec || 'barber',
        horario:     CUR_WORKER.horario || []
      }
    })
  }).catch(function(e) { console.error('Error sync worker:', e); });
}

/* ══════════════════════════
   BOTÓN GUARDAR HORARIO
══════════════════════════ */
function saveWorkerHorario() {
  if (!CUR_WORKER) return;
  // Los inputs ya actualizan CUR_WORKER.horario en tiempo real
  // via _wkHorarioChange, así que solo guardamos
  syncWorkerToCloud();
  saveDB();
  toast('Horario guardado', '#22C55E');
}

/* ══════════════════════════
   ARCHIVOS FOTO
══════════════════════════ */
function setupWorkerPhotoUpload() {
  var coverInp = G('wk-profile-cover-input');
  if (coverInp) {
    coverInp.addEventListener('change', async function(e) {
      var f = e.target.files[0];
      if (!f || !validImageType(f)) { toast('Solo JPG/PNG/WebP (máx 5MB)', '#EF4444'); return; }
      toast('...', '#F59E0B');
      var url = await uploadToImgBB(f);
      if (url && CUR_WORKER) { 
        CUR_WORKER.cover = url; 
        syncWorkerToCloud();
        saveDB(); 
        renderWorkerProfile(); 
        toast('Portada actualizada', '#22C55E');
      }
    });
  }

  var logoInp = G('wk-profile-photo-input');
  if (logoInp) {
    logoInp.addEventListener('change', async function(e) {
      var f = e.target.files[0];
      if (!f || !validImageType(f)) { toast('Solo JPG/PNG/WebP (máx 5MB)', '#EF4444'); return; }
      toast('...', '#F59E0B');
      var url = await uploadToImgBB(f);
      if (url && CUR_WORKER) { 
        CUR_WORKER.photo = url; 
        syncWorkerToCloud();
        saveDB(); 
        renderWorkerProfile(); 
        initWorkerPanel(); 
        toast('Foto de perfil actualizada', '#22C55E');
      }
    });
  }

  var galInp = G('wk-gallery-input');
  if (galInp) {
    galInp.addEventListener('change', async function(e) {
      var files = Array.from(e.target.files);
      if (files.length === 0) return;
      toast('Subiendo ' + files.length + ' foto(s)...', '#F59E0B');
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!validImageType(f)) continue;
        var url = await uploadToImgBB(f);
        if (url && CUR_WORKER) {
          if (!CUR_WORKER.photos) CUR_WORKER.photos = [];
          if (CUR_WORKER.photos.length >= 20) { toast('Máximo 20 fotos', '#EF4444'); return; }
          CUR_WORKER.photos.push(url); 
          saveDB(); 
          renderWorkerGallery();
        }
      }
      toast('Fotos subidas', '#22C55E');
    });
  }

  var svcInp = G('wk-sv-photo-input');
  if (svcInp) {
    svcInp.addEventListener('change', async function(e) {
      var f = e.target.files[0];
      if (!f || !validImageType(f)) return;
      toast('...', '#F59E0B');
      var url = await uploadToImgBB(f);
      if (url) { 
        window._wkSvcPhoto = url; 
        var pv = G('wk-sv-photo-preview'); 
        if (pv) pv.innerHTML = '<img src="' + url + '" class="photo-preview" alt="Servicio"/>'; 
        toast('Foto lista', '#22C55E');
      }
    });
  }
}

/* ══════════════════════════
   NOTIFICACIONES Y LINKS
══════════════════════════ */
function copyWorkerLink() {
  if (!CUR) return;
  var link = 'https://citasproonline.com/#b/' + CUR.id;
  var tempInput = document.createElement('input');
  tempInput.value = link;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);
  toast('Link copiado', '#4A7FD4');
}
window.copyWorkerLink = copyWorkerLink;

function renderWorkerNotifBadge() {
  if (!CUR_WORKER) return;
  var unread = (CUR_WORKER.notifications || []).filter(function(n) { return !n.read; }).length;
  var badge1 = G('wn-notif-badge'), badge2 = G('wk-notif-badge');
  if (badge1) { badge1.style.display = unread > 0 ? 'flex' : 'none'; badge1.textContent = unread; }
  if (badge2) { badge2.style.display = unread > 0 ? 'inline-block' : 'none'; badge2.textContent = unread; }
}

function renderWorkerNotifications() {
  if (!CUR_WORKER) return;
  var notifs = CUR_WORKER.notifications || [];
  
  if (notifs.length) {
      H('wk-notif-list', notifs.map(function(n, i) {
        var bg = n.read ? 'transparent' : 'rgba(74,127,212,.08)';
        var border = n.read ? 'var(--b)' : 'var(--blue)';
        return '<div style="padding:16px;border-bottom:1px solid var(--b);background:' + bg + ';border-left:3px solid ' + border + ';margin-bottom:8px;border-radius:0 12px 12px 0">'
          + '<div style="display:flex;justify-content:space-between;margin-bottom:6px">'
          + '<span style="font-weight:800;font-size:14px;color:' + (n.read ? 'var(--text)' : 'var(--blue)') + '">' + san(n.title) + '</span>'
          + '<span style="font-size:11px;color:var(--muted)">' + san(n.date) + '</span>'
          + '</div>'
          + '<div style="font-size:13px;color:var(--t2);line-height:1.5">' + san(n.body) + '</div>'
          + (!n.read ? '<div style="text-align:right;margin-top:8px"><button onclick="markWorkerNotifRead(' + i + ')" style="background:var(--bblue);border:none;color:var(--blue);font-size:11px;font-weight:700;cursor:pointer;padding:6px 12px;border-radius:12px">Marcar como leída</button></div>' : '')
          + '</div>';
      }).join(''));
  } else {
      H('wk-notif-list', '<div style="text-align:center;padding:40px 20px;color:var(--muted)"><div style="font-size:32px;margin-bottom:10px">📭</div><div style="font-size:14px">No tienes notificaciones nuevas</div></div>');
  }
  
  var clearBtn = G('clear-notif-btn');
  if (clearBtn) {
     clearBtn.onclick = function() {
        openConfirmModal('Limpiar Notificaciones', '¿Borrar todas las notificaciones?', function() {
            CUR_WORKER.notifications = [];
            saveDB();
            renderWorkerNotifications();
            renderWorkerNotifBadge();
            toast('Notificaciones borradas', '#475569');
        });
     };
  }
}

function markWorkerNotifRead(index) {
  if (!CUR_WORKER || !CUR_WORKER.notifications || !CUR_WORKER.notifications[index]) return;
  CUR_WORKER.notifications[index].read = true; 
  saveDB(); 
  renderWorkerNotifications(); 
  renderWorkerNotifBadge();
}
/* ══════════════════════════════════════════════════
   MOTOR DEL HORARIO SEMANAL (VISTA MATRIZ)
══════════════════════════════════════════════════ */
function renderWorkerWeeklySchedule() {
  var gridContainer = G('wk-weekly-grid');
  if (!gridContainer || !CUR_WORKER) return;

  // 1. Obtener la fecha del Lunes de la semana actual
  var curr = new Date();
  var day = curr.getDay(); // 0 = Dom, 1 = Lun...
  var diff = curr.getDate() - day + (day === 0 ? -6 : 1);
  var monday = new Date(curr);
  monday.setDate(diff);

  var weekDates = [];
  var weekDatesStr = [];
  var dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Formato YYYY-MM-DD seguro (sin problemas de zona horaria)
  for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d);
      var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      weekDatesStr.push(ds);
  }

  // 2. Construir la cabecera (Días de la semana)
  var html = '<div class="wg-corner"></div>';
  var todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
  
  for (var i = 0; i < 7; i++) {
      var isToday = (weekDatesStr[i] === todayStr) ? ' wg-today' : '';
      var dateNum = weekDates[i].getDate();
      html += '<div class="wg-header' + isToday + '">' + dayNames[i] + '<br><span class="wg-date">' + dateNum + '</span></div>';
  }

  // 3. Preparar los datos
  var horario = getHorarioSeguro(); 
  var appts = CUR_WORKER.appointments || [];
  
  // Eje Y: Horas (de 08:00 a 22:00)
  var hoursGrid = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];
  var colors = ['w-blue', 'w-gold', 'w-green', 'w-purple'];

  function timeToMins(t) {
      if (!t) return 0;
      var p = t.split(':');
      return parseInt(p[0]) * 60 + parseInt(p[1]);
  }

  function isCellOpen(dayIndex, timeStr) {
      var h = horario[dayIndex];
      if (!h || !h.open) return false;
      
      var tMins = timeToMins(timeStr);
      var f1 = timeToMins(h.from1 || h.from || '09:00');
      var t1 = timeToMins(h.to1 || h.to || '14:00');
      
      if (tMins >= f1 && tMins < t1) return true; 
      
      if (h.hasBreak && h.from2 && h.to2) {
          var f2 = timeToMins(h.from2);
          var t2 = timeToMins(h.to2);
          if (tMins >= f2 && tMins < t2) return true; 
      }
      return false; 
  }

  // 4. Renderizar la cuadrícula
  for (var h = 0; h < hoursGrid.length; h++) {
      var timeStr = hoursGrid[h];
      var hourPrefix = timeStr.split(':')[0]; 
      
      html += '<div class="wg-time">' + timeStr + '</div>';

      for (var d = 0; d < 7; d++) {
          var dateStr = weekDatesStr[d];
          var cellOpen = isCellOpen(d, timeStr);
          var cellClass = cellOpen ? 'wg-cell' : 'wg-cell wg-out';
          
          html += '<div class="' + cellClass + '">';
          
          // Buscar citas de este día que correspondan a esta hora (Ej: 10:00 o 10:30)
          var cellAppts = appts.filter(function(a) {
              return a.date === dateStr && (a.time || '').startsWith(hourPrefix + ':') && a.status !== 'cancelled';
          });

          if (cellAppts.length > 0) {
              // Ordenar por minutos exactos para que las citas de 10:00 salgan antes que las de 10:30
              cellAppts.sort(function(a,b){ return (a.time||'').localeCompare(b.time||''); });

              cellAppts.forEach(function(a, idx) {
                  var cClass = colors[(d + h + idx) % colors.length]; 
                  var pClass = cClass.replace('w-', 'pill-');
                  
                  // Reutilizamos tu función openWorkerApptDetail que ya existe y abre tu modal!
                  html += '<div class="wg-appt ' + cClass + '" onclick="openWorkerApptDetail(\'' + sanitizeText(a.id) + '\')">'
                        + '<div style="display:flex; justify-content:space-between; width:100%; align-items:center;">'
                        + '<div class="wg-appt-name">' + san(a.client) + '</div>'
                        + '<div style="font-size:9px; font-weight:800; color:var(--blue);">' + san(a.time) + '</div>'
                        + '</div>'
                        + '<div class="wg-appt-phone">' + san(a.phone || '') + '</div>'
                        + '<div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-top:auto;">'
                        + '<span class="' + pClass + '" style="font-size:8px; padding:2px 6px;">' + san(a.svc) + '</span>'
                        + '<span style="font-size:10px; font-weight:800;">' + money(a.price) + '</span>'
                        + '</div>'
                        + '</div>';
              });
          }
          
          html += '</div>';
      }
  }

  gridContainer.innerHTML = html;
}
window.markWorkerNotifRead = markWorkerNotifRead;