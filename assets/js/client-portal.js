'use strict';

/* ══════════════════════════════════════════════════
   CLIENT-PORTAL.JS
   Flujo de reserva del cliente:
   1. Bienvenida de la barbería
   2. Nombre + teléfono
   3. Seleccionar trabajador (tarjetas)
   4. Seleccionar servicio del trabajador
   5. Seleccionar fecha y hora
   6. Confirmar → WhatsApp + notificación al worker
══════════════════════════════════════════════════ */

/* ══════════════════════════
   CARGAR BARBERÍA POR ID
══════════════════════════ */
function loadBizDirect(bizId) {
  var biz = getBizById(bizId);
  if (!biz) { toast('Negocio no encontrado', '#EF4444'); return; }
   /* Limpiar sesiones activas para modo cliente */
  DB.currentBiz    = null;
  DB.currentWorker = null;

  initCSEL();
  CSEL.bizId = bizId;
  goTo('s-client');

  /* Logo y nombre */
  var av = G('ch-av');
  if (av) {
    if (biz.logo) av.innerHTML = '<img src="' + sanitizeImageDataURL(biz.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo"/>';
    else av.textContent = (biz.name || '?').charAt(0).toUpperCase();
  }
  T('ch-nm', biz.name);
  T('ch-meta', (biz.addr || '') + (biz.city ? ', ' + biz.city : '') + (biz.type ? ' · ' + biz.type : ''));

  clGoStep(1);
  window.scrollTo(0, 0);
}

/* ══════════════════════════
   NAVEGACIÓN POR PASOS
══════════════════════════ */
function clGoStep(n) {
  document.querySelectorAll('.bstep').forEach(function(s) { s.classList.remove('on'); });
  var s = G('cs-' + n); if (s) s.classList.add('on');
  updateBookingProgress(n);
  window.scrollTo(0, 0);
}

function updateBookingProgress(step) {
  for (var i = 1; i <= 5; i++) {
    var bar = G('bk-p' + i), lbl = G('bk-lbl' + i);
    if (bar) bar.style.background = i <= step ? 'var(--blue)' : 'var(--b)';
    if (lbl) lbl.style.color      = i <= step ? 'var(--blue)' : 'var(--muted)';
  }
}

/* ══════════════════════════
   PASO 1 — Datos del cliente
══════════════════════════ */
function clStep2() {
  var name  = sanitizeText(V('cl-name'));
  var phone = sanitizeText(V('cl-phone'));
  var err   = G('cl-err1');
  if (!name || name.length < 2)    { if(err){ err.textContent='Introduce tu nombre completo.'; err.style.display='block'; } return; }
  if (!phone || !validPhone(phone)) { if(err){ err.textContent='Introduce un número de teléfono válido.'; err.style.display='block'; } return; }
  if (err) err.style.display = 'none';
  CSEL.clientName  = name;
  CSEL.clientPhone = phone;
  CSEL.clientEmail = sanitizeText(V('cl-email'));
  /* Mostrar tarjetas de trabajadores */
  buildWorkerCards();
  clGoStep(2);
}

/* ══════════════════════════
   PASO 2 — Seleccionar trabajador
══════════════════════════ */
function buildWorkerCards() {
  var biz = getBizById(CSEL.bizId);
  if (!biz) return;
  var workers = (biz.workers || []).filter(function(w) { return w.active; });

  H('cl-workers-list', workers.length
    ? workers.map(function(w) {
        var av = w.photo
          ? '<img src="' + sanitizeImageDataURL(w.photo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="Foto"/>'
          : '<span style="font-size:28px;font-weight:900;color:#fff">' + (w.name||'?').charAt(0).toUpperCase() + '</span>';
        var svcCount = (w.services||[]).length;
        return '<div class="worker-card" data-wid="' + sanitizeText(w.id) + '" onclick="selectWorker(\'' + sanitizeText(w.id) + '\')">'
          + '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;overflow:hidden;box-shadow:0 4px 16px rgba(74,127,212,.3)">' + av + '</div>'
          + '<div style="font-weight:700;font-size:15px;margin-bottom:4px;text-align:center">' + san(w.name) + '</div>'
          + '<div style="font-size:12px;color:var(--t2);text-align:center;margin-bottom:6px">' + san(w.spec || '') + '</div>'
          + '<div style="font-size:11px;color:var(--muted);text-align:center">' + svcCount + ' servicio' + (svcCount !== 1 ? 's' : '') + '</div>'
          + '</div>';
      }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">No hay trabajadores disponibles</div></div>');
}

function selectWorker(workerId) {
  CSEL.workerId = workerId;
  /* Resaltar tarjeta seleccionada */
  document.querySelectorAll('.worker-card').forEach(function(c) { c.classList.remove('sel'); });
  var card = document.querySelector('.worker-card[data-wid="' + workerId + '"]');
  if (card) card.classList.add('sel');

  /* Cargar servicios del trabajador */
  buildServicesList(workerId);
  clGoStep(3);
}

/* ══════════════════════════
   PASO 3 — Seleccionar servicio
══════════════════════════ */
function buildServicesList(workerId) {
  var biz = getBizById(CSEL.bizId);
  if (!biz) return;
  var worker = (biz.workers||[]).filter(function(w) { return w.id === workerId; })[0];
  if (!worker) return;

  /* Nombre del trabajador en el título */
  T('cl-worker-name', worker.name);

  var svcs = worker.services || [];
  H('cl-svc-list', svcs.length
    ? svcs.map(function(s) {
        var thumb = s.photo
          ? '<img src="' + sanitizeImageDataURL(s.photo) + '" style="width:50px;height:50px;border-radius:12px;object-fit:cover;flex-shrink:0" alt="Servicio">'
          : '<div style="width:50px;height:50px;border-radius:12px;background:var(--bblue);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">&#9986;</div>';
        return '<div class="svcitem" data-sn="' + san(s.name) + '" data-sp="' + s.price + '" data-dur="' + s.dur + '">'
          + thumb
          + '<div style="flex:1">'
          + '<div style="font-weight:700;font-size:15px;margin-bottom:2px">' + san(s.name) + '</div>'
          + '<div style="font-size:12px;color:var(--t2)">' + s.dur + ' min' + (s.desc ? ' · ' + san(s.desc) : '') + '</div>'
          + '</div>'
          + '<div style="font-weight:800;font-size:17px;color:var(--blue)">' + money(s.price) + '</div>'
          + '</div>';
      }).join('')
    : '<div style="text-align:center;padding:28px;color:var(--muted)"><div style="font-size:13px">Este trabajador no tiene servicios aún</div></div>');

  document.querySelectorAll('.svcitem').forEach(function(item) {
    item.addEventListener('click', function() {
      document.querySelectorAll('.svcitem').forEach(function(x) { x.classList.remove('sel'); });
      item.classList.add('sel');
      CSEL.svc      = item.getAttribute('data-sn');
      CSEL.svcPrice = parseFloat(item.getAttribute('data-sp'));
      CSEL.svcDur   = parseInt(item.getAttribute('data-dur')) || 30;
    });
  });
}

function clStep4() {
  var err = G('cl-err2');
  if (!CSEL.svc) { if(err){ err.textContent='Selecciona un servicio.'; err.style.display='block'; } return; }
  if (err) err.style.display = 'none';
  buildDates(CSEL.bizId, CSEL.workerId);
  clGoStep(4);
}

/* ══════════════════════════
   PASO 4 — Fecha y hora
══════════════════════════ */
function buildDates(bizId, workerId) {
  var biz = getBizById(bizId);
  if (!biz) return;
  var worker = (biz.workers||[]).filter(function(w){ return w.id===workerId; })[0];
  var horario = (worker && worker.horario) ? worker.horario : (biz.horario || DEFAULT_HORARIO);

  var dates=[], now=new Date();
  var dayNames=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  for (var i=0;i<14;i++) {
    var d=new Date(now); d.setDate(now.getDate()+i);
    var hn=dayNames[d.getDay()];
    var hd=horario.filter(function(h){ return h.day===hn; })[0];
    if (!hd||hd.open) dates.push(d);
    if (dates.length>=7) break;
  }

  var days=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  H('cl-dates', dates.map(function(d,i){
    return '<div class="dateopt'+(i===0?' sel':'')+'" data-dt="'+d.toISOString().split('T')[0]+'">'
      +'<div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">'+days[d.getDay()]+'</div>'
      +'<div style="font-size:20px;font-weight:900">'+d.getDate()+'</div>'
      +'<div style="font-size:9px;color:var(--muted)">'+MONTHS_SHORT[d.getMonth()]+'</div>'
      +'</div>';
  }).join(''));

  CSEL.date = dates.length ? dates[0].toISOString().split('T')[0] : now.toISOString().split('T')[0];
  document.querySelectorAll('.dateopt').forEach(function(o) {
    o.addEventListener('click', function() {
      document.querySelectorAll('.dateopt').forEach(function(x){ x.classList.remove('sel'); });
      o.classList.add('sel'); CSEL.date=o.getAttribute('data-dt');
      buildTimes(bizId, workerId);
    });
  });
  buildTimes(bizId, workerId);
}

function buildTimes(bizId, workerId) {
  var biz = getBizById(bizId);
  if (!biz || !CSEL.date) return;
  var worker = (biz.workers||[]).filter(function(w){ return w.id===workerId; })[0];
  var horario = (worker && worker.horario) ? worker.horario : (biz.horario || DEFAULT_HORARIO);

  var d = new Date(CSEL.date+'T12:00');
  var dayNames=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var horDay = horario.filter(function(h){ return h.day===dayNames[d.getDay()]; })[0] || {open:true,from:'09:00',to:'20:00'};

  var times=[];
  if (horDay.open) {
    var fp=horDay.from.split(':').map(Number), tp=horDay.to.split(':').map(Number);
    var fm=fp[0]*60+fp[1], tm=tp[0]*60+tp[1];
    var interval=CSEL.svcDur||30;
    for(var m=fm;m<=tm-interval;m+=30){
      var h=Math.floor(m/60), mn=m%60;
      times.push(String(h).padStart(2,'0')+':'+String(mn).padStart(2,'0'));
    }
  }

  /* Horas ya ocupadas del worker */
  var booked = worker ? (worker.appointments||[]).filter(function(a){ return a.date===CSEL.date&&a.status!=='cancelled'; }).map(function(a){ return a.time; }) : [];
  var available = times.filter(function(t){ return booked.indexOf(t)<0; }).length;

  var availEl=G('cl-time-available');
  if(availEl) availEl.textContent = times.length ? (available>0 ? available+' horarios disponibles' : 'Sin horarios disponibles') : '';

  if (!times.length) {
    H('cl-times','<div style="text-align:center;padding:24px;color:var(--muted);background:var(--card);border-radius:var(--r);border:1px solid var(--b)"><div style="font-size:13px">Cerrado este día</div></div>');
    return;
  }

  H('cl-times', times.map(function(t){
    var busy = booked.indexOf(t) >= 0;
    return '<div class="topt'+(busy?' busy':'')+'" data-tm="'+t+'">'+t+'</div>';
  }).join(''));

  document.querySelectorAll('.topt:not(.busy)').forEach(function(o){
    o.addEventListener('click', function(){
      document.querySelectorAll('.topt').forEach(function(x){ x.classList.remove('sel'); });
      o.classList.add('sel'); CSEL.time=o.getAttribute('data-tm');
    });
  });
}

function clStep5() {
  var err = G('cl-err3');
  if (!CSEL.date) { if(err){ err.textContent='Selecciona una fecha.'; err.style.display='block'; } return; }
  if (!CSEL.time) { if(err){ err.textContent='Selecciona una hora disponible.'; err.style.display='block'; } return; }
  if (err) err.style.display = 'none';
  buildSummary();
  clGoStep(5);
}

/* ══════════════════════════
   PASO 5 — Resumen y confirmar
══════════════════════════ */
function buildSummary() {
  var biz = getBizById(CSEL.bizId);
  var worker = biz ? (biz.workers||[]).filter(function(w){ return w.id===CSEL.workerId; })[0] : null;
  H('cl-summary',
    '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Resumen de tu reserva</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Negocio</span><span style="font-size:13px;font-weight:700">'+san(biz?biz.name:'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Profesional</span><span style="font-size:13px;font-weight:700">'+san(worker?worker.name:'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Cliente</span><span style="font-size:13px;font-weight:700">'+san(CSEL.clientName||'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Servicio</span><span style="font-size:13px;font-weight:700">'+san(CSEL.svc||'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Fecha</span><span style="font-size:13px;font-weight:700">'+sanitizeText(CSEL.date||'—')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">Hora</span><span style="font-size:13px;font-weight:700">'+sanitizeText(CSEL.time||'—')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0"><span style="font-size:15px;font-weight:800">Total</span><span style="font-weight:900;font-size:22px;color:var(--blue)">'+money(CSEL.svcPrice)+'</span></div>'
  );
}

/* ══════════════════════════
   CONFIRMAR RESERVA
══════════════════════════ */
function confirmBooking() {
  var name  = CSEL.clientName  || sanitizeText(V('cl-name'));
  var phone = CSEL.clientPhone || sanitizeText(V('cl-phone'));
  var email = CSEL.clientEmail || sanitizeText(V('cl-email'));

  if (!name||!phone||!CSEL.svc||!CSEL.date||!CSEL.time||!CSEL.workerId) {
    toast('Faltan datos. Vuelve atrás y completa todo.','#EF4444'); return;
  }

  var biz = getBizById(CSEL.bizId); if (!biz) return;
  var worker = (biz.workers||[]).filter(function(w){ return w.id===CSEL.workerId; })[0]; if (!worker) return;

  /* Verificar que la hora sigue libre */
  var dup = (worker.appointments||[]).filter(function(a){ return a.date===CSEL.date&&a.time===CSEL.time&&a.status!=='cancelled'; }).length>0;
  if (dup) { toast('Esa hora ya está ocupada. Elige otra.','#EF4444'); clGoStep(4); return; }

  /* Generar token único para modificar/cancelar */
  var token = 'tk_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);

  var appt = {
    id: Date.now(),
    client: name, phone: phone, email: email,
    date: CSEL.date, time: CSEL.time,
    svc: CSEL.svc, barber: worker.name,
    price: CSEL.svcPrice||0,
    status: 'confirmed', notes: '',
    token: token
  };

  if (!worker.appointments) worker.appointments=[];
  worker.appointments.push(appt);
  saveDB(); // Guarda localmente

  /* NUEVO: Guardado forzado en Supabase para el cliente */
  fetch('/.netlify/functions/update-biz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(biz)
  }).catch(function(e){ console.error('Error sincronizando cita en la nube:', e); });

  /* Notificación interna al trabajador */
  notifyWorker(biz.id, worker.id, 'new_booking',
    name + ' reservó una cita',
    { detail: CSEL.svc + ' · ' + CSEL.date + ' ' + CSEL.time }
  );

  /* Email al trabajador */
  if (worker.email) {
    fetch('/.netlify/functions/send-email', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        type: 'new_booking_biz',
        to: worker.email,
        data: { clientName:name, clientPhone:phone, service:CSEL.svc, date:CSEL.date, time:CSEL.time, workerName:worker.name }
      })
    }).catch(function(e){ console.error(e); });
  }

  /* Email de confirmación al cliente */
  if (email) {
    fetch('/.netlify/functions/send-email', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        type: 'booking_confirmed',
        to: email,
        data: { bizName:biz.name, workerName:worker.name, service:CSEL.svc, date:CSEL.date, time:CSEL.time, price:money(CSEL.svcPrice) }
      })
    }).catch(function(e){ console.error(e); });
  }

  /* Pantalla de éxito */
  T('cl-confirm-txt', '¡Hola ' + sanitizeText(name) + '! Tu cita en ' + sanitizeText(biz.name) + ' con ' + sanitizeText(worker.name) + ' ha sido confirmada.');

  H('cl-confirm-card',
    '<div style="display:flex;flex-direction:column;gap:10px">'
    +'<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Negocio</span><span style="font-weight:700;font-size:13px">'+san(biz.name)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Profesional</span><span style="font-weight:700;font-size:13px">'+san(worker.name)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Servicio</span><span style="font-weight:700;font-size:13px">'+san(CSEL.svc||'')+'</span></div>'
    +'<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Fecha</span><span style="font-weight:700;font-size:13px">'+sanitizeText(CSEL.date)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between"><span style="color:var(--t2);font-size:13px">Hora</span><span style="font-weight:700;font-size:13px">'+sanitizeText(CSEL.time)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;border-top:1px solid var(--b);padding-top:10px;margin-top:4px"><span style="font-weight:800;font-size:14px">Total</span><span style="font-weight:900;color:var(--blue);font-size:20px">'+money(CSEL.svcPrice)+'</span></div>'
    +'</div>'
  );

  /* Botón WhatsApp al cliente */
  var wa = G('cl-wa-btn');
  if (wa) {
    var waMsg = '¡Cita confirmada en ' + biz.name + '!\n'
        + 'Profesional: ' + worker.name + '\n'
        + 'Servicio: ' + CSEL.svc + '\n'
        + 'Fecha: ' + CSEL.date + ' a las ' + CSEL.time + '\n'
        + 'Total: ' + money(CSEL.svcPrice) + '\n\n'
        + 'Para gestionar o cancelar tu cita visita:\n'
        + 'https://incomparable-choux-301c3b.netlify.app/#manage/' + token; // Actualizado a tu URL real
    
    wa.href = 'https://wa.me/' + phone.replace(/\D/g,'') + '?text=' + encodeURIComponent(waMsg);
  }

  CSEL.bookingToken = token;
  clGoStep(6);
}

/* ══════════════════════════
   GESTIÓN DE CITA EXISTENTE
   (modificar / cancelar desde link de WhatsApp)
══════════════════════════ */
function checkManageAccess() {
  var hash = window.location.hash;
  /* Formato: #manage/TOKEN */
  if (hash && hash.indexOf('#manage/') === 0) {
    var token = hash.slice(8);
    if (token) {
      var found = findApptByToken(token);
      if (found) {
        openManageModal(found.biz, found.worker, found.appt);
        return true;
      }
    }
  }
  return false;
}

function findApptByToken(token) {
  var result = null;
  DB.businesses.forEach(function(biz) {
    (biz.workers||[]).forEach(function(w) {
      (w.appointments||[]).forEach(function(a) {
        if (a.token === token && a.status !== 'cancelled') {
          result = { biz:biz, worker:w, appt:a };
        }
      });
    });
  });
  return result;
}

function openManageModal(biz, worker, appt) {
  H('manage-content',
    '<div style="text-align:center;margin-bottom:20px">'
    +'<div style="font-size:18px;font-weight:800;margin-bottom:6px">Tu cita en '+san(biz.name)+'</div>'
    +'<div style="font-size:13px;color:var(--t2)">con '+san(worker.name)+'</div>'
    +'</div>'
    +'<div style="background:var(--card);border:1px solid var(--b);border-radius:16px;padding:16px;margin-bottom:20px">'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b)"><span style="color:var(--t2);font-size:13px">Servicio</span><span style="font-weight:700;font-size:13px">'+san(appt.svc)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b)"><span style="color:var(--t2);font-size:13px">Fecha</span><span style="font-weight:700;font-size:13px">'+san(appt.date)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0"><span style="color:var(--t2);font-size:13px">Hora</span><span style="font-weight:700;font-size:13px">'+san(appt.time)+'</span></div>'
    +'</div>'
    +'<div style="display:flex;gap:10px">'
    +'<button onclick="cancelApptByToken(\''+sanitizeText(appt.token)+'\')" style="flex:1;padding:14px;border-radius:var(--rpill);background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:var(--red);font-weight:700;font-size:14px;cursor:pointer;font-family:var(--font)">Cancelar cita</button>'
    +'</div>'
  );
  openOv('ov-manage');
}

function cancelApptByToken(token) {
  var found = findApptByToken(token);
  if (!found) { toast('Cita no encontrada','#EF4444'); return; }

  found.appt.status = 'cancelled';
  saveDB();

  /* NUEVO: Guardar cancelación en Supabase directamente */
  fetch('/.netlify/functions/update-biz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(found.biz)
  }).catch(function(e){ console.error('Error cancelando cita en la nube:', e); });

  /* Notificar al trabajador */
  notifyWorker(found.biz.id, found.worker.id, 'booking_cancel',
    found.appt.client + ' canceló su cita',
    { detail: found.appt.svc + ' · ' + found.appt.date + ' ' + found.appt.time }
  );

  /* Email al trabajador */
  if (found.worker.email) {
    fetch('/.netlify/functions/send-email', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        type: 'booking_cancel',
        to: found.worker.email,
        data: { clientName:found.appt.client, service:found.appt.svc, date:found.appt.date, time:found.appt.time }
      })
    }).catch(function(e){ console.error(e); });
  }

  closeOv('ov-manage');
  toast('Tu cita ha sido cancelada','#22C55E');
  window.location.hash = '';
}

/* ══════════════════════════
   HASH ROUTING
══════════════════════════ */
function checkLinkAccess() {
  var hash = window.location.hash;

  /* Gestión de cita: #manage/TOKEN */
  if (hash && hash.indexOf('#manage/') === 0) {
    return checkManageAccess();
  }

  /* Reserva normal: #b/BIZ_ID */
  if (hash && hash.indexOf('#b/') === 0) {
    var bizId = hash.slice(3);
    if (bizId) {
      DB = loadDB(); /* Recargar DB por si acaso */
      var biz = getBizById(bizId);
      if (biz) {
        loadBizDirect(bizId);
        return true;
      } else {
        toast('Negocio no encontrado', '#EF4444');
      }
    }
  }
  return false;
}

/* ══════════════════════════
   RESET BOOKING
══════════════════════════ */
function resetBooking() {
  var savedBizId = CSEL.bizId;
  initCSEL();
  if (savedBizId) { CSEL.bizId=savedBizId; loadBizDirect(savedBizId); }
  else goTo('s-portal');
}

function goClientFromBiz() {
  if (CUR) loadBizDirect(CUR.id);
  else goTo('s-portal');
}