'use strict';
//  app.js
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
  var container = G(containerId); 
  if (!container) return;
  var size   = 180;
  var imgUrl = 'https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+'&data='+encodeURIComponent(text)+'&bgcolor=ffffff&color=000000&margin=10';
  var img    = document.createElement('img');
  img.src    = imgUrl; 
  img.width  = size; 
  img.height = size; 
  img.alt    = 'Código QR';
  img.style.borderRadius = '8px'; 
  img.style.display = 'block';
  img.onerror = function() { 
      container.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px;text-align:center">Conecta a internet para ver el QR</div>'; 
  };
  container.innerHTML = ''; 
  container.appendChild(img);
}

function openQRModal() {
  if (!CUR) return;
  var link = 'https://citasproonline.com/#b/' + CUR.id;
  var el = G('qr-link-text'); 
  if (el) el.textContent = link;
  generateQR(link, 'qr-code');
  var wa = G('qr-wa-btn'); 
  if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent('Reserva tu cita en ' + CUR.name + ' → ' + link);
  openOv('ov-qr');
}

/* ══════════════════════════
   FIDELIZACIÓN (TARJETA DE SELLOS)
══════════════════════════ */
window.buildLoyaltyHtml = function(a, allAppts) {
  if (!a || !allAppts) return '';
  
  // Buscar cuántas citas completadas tuvo el cliente ANTES de esta cita
  var pastCompleted = allAppts.filter(function(x) {
     if (x.status !== 'completed' || String(x.id) === String(a.id)) return false;
     // Solo contar citas que sucedieron antes que la actual
     var dateX = new Date(x.date + 'T' + (x.time||'00:00'));
     var dateA = new Date(a.date + 'T' + (a.time||'00:00'));
     if (dateX >= dateA) return false;
     
     // Identificación EXACTA por Correo Electrónico (Login Automático)
     var e1 = String(a.email||'').toLowerCase().trim();
     var e2 = String(x.email||'').toLowerCase().trim();
     if (e1 && e2 && e1 === e2) return true;
     
     return false;
  }).length;

  // REGLA: Mostrar a los trabajadores o administradores SOLO a partir de la racha 3 (2 citas completadas en el pasado)
  if (pastCompleted < 2) return '';

  var stampsBefore = pastCompleted % 10;
  var currentStamps = a.status === 'completed' ? (pastCompleted + 1) % 10 : stampsBefore;
  var displayStamps = (a.status === 'completed' && stampsBefore === 9) ? 10 : currentStamps;

  var circles = '';
  for(var i=1; i<=10; i++) {
     var isOn = i <= displayStamps;
     if (i === 10) {
        circles += '<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:'+(isOn?'var(--green)':'var(--bg3)')+';border:1px solid '+(isOn?'var(--green)':'var(--b)')+';color:#fff;box-shadow:'+(isOn?'0 0 10px rgba(34,197,94,.4)':'none')+';transition:all .3s">🎁</div>';
     } else {
        circles += '<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:'+(isOn?'var(--blue)':'var(--bg3)')+';border:1px solid '+(isOn?'var(--blue)':'var(--b)')+';color:'+(isOn?'#fff':'transparent')+';transition:all .3s">✓</div>';
     }
  }

  var msg = '';
  if (displayStamps === 10) msg = '<span style="color:var(--green);font-weight:800">¡Premio canjeado en esta asistencia! 🎉</span>';
  else if (stampsBefore === 9 && a.status !== 'completed') msg = '<span style="color:var(--green);font-weight:800;font-size:12px">🎁 ¡Esta asistencia es el premio! (Gratis)</span>';
  else msg = 'Faltan ' + (10 - displayStamps) + ' asistencias para el premio.';

  return '<div style="background:var(--card);border:1px solid var(--b);border-radius:16px;padding:16px;margin-bottom:14px">'
       + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
       + '<div style="font-size:13px;font-weight:800;color:var(--text)">Racha de Asistencias</div>'
       + '<div style="font-size:11px;font-weight:700;color:var(--blue);background:var(--bblue);padding:3px 8px;border-radius:8px">'+displayStamps+'/10 Rachas</div>'
       + '</div>'
       + '<div style="display:flex;justify-content:space-between;gap:4px;margin-bottom:12px">' + circles + '</div>'
       + '<div style="text-align:center;font-size:11px;color:var(--muted)">' + msg + '</div>'
       + '</div>';
};

window.buildClientLoyaltyHtml = function(bizId, phone, email, name) {
  var biz = typeof getBizById === 'function' ? getBizById(bizId) : null;
  if (!biz && typeof DB !== 'undefined' && DB.businesses) biz = DB.businesses.find(b => b.id === bizId);
  if (!biz) return '';
  var allAppts = [];
  (biz.workers || []).forEach(function(w){ (w.appointments || []).forEach(function(ap){ allAppts.push(ap); }); });
  (biz.appointments || []).forEach(function(ap){ allAppts.push(ap); });
  
  var pastCompleted = allAppts.filter(function(x) {
     if (x.status !== 'completed') return false;
     // Identificación EXACTA por Correo Electrónico (Login Automático)
     var e1 = String(email||'').toLowerCase().trim();
     var e2 = String(x.email||'').toLowerCase().trim();
     if (e1 && e2 && e1 === e2) return true;
     return false;
  }).length;

  var currentStamps = pastCompleted % 10;
  
  var circles = '';
  for(var i=1; i<=10; i++) {
     var isOn = i <= currentStamps;
     if (i === 10) {
        circles += '<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:'+(isOn?'var(--green)':'var(--bg3)')+';border:1px solid '+(isOn?'var(--green)':'var(--b)')+';color:#fff;box-shadow:'+(isOn?'0 0 10px rgba(34,197,94,.4)':'none')+';transition:all .3s">🎁</div>';
     } else {
        circles += '<div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:'+(isOn?'var(--blue)':'var(--bg3)')+';border:1px solid '+(isOn?'var(--blue)':'var(--b)')+';color:'+(isOn?'#fff':'transparent')+';transition:all .3s">✓</div>';
     }
  }

  var msg = '';
  if (currentStamps === 9) msg = '<span style="color:var(--green);font-weight:800">¡Tu próxima cita es el premio! 🎁 (Gratis)</span>';
  else msg = 'Faltan ' + (10 - currentStamps) + ' asistencias para tu premio.';

  var firstName = name ? name.split(' ')[0] : 'Cliente';

  return '<div style="background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:16px;padding:16px;margin-bottom:20px;animation:fadeUp .4s ease">'
       + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
       + '<div style="font-size:13px;font-weight:800;color:var(--text)">¡Hola, '+san(firstName)+'! Tu Racha actual</div>'
       + '<div style="font-size:11px;font-weight:700;color:var(--blue);background:rgba(74,127,212,.15);padding:3px 8px;border-radius:8px">'+currentStamps+'/10 Rachas</div>'
       + '</div>'
       + '<div style="display:flex;justify-content:space-between;gap:4px;margin-bottom:12px">' + circles + '</div>'
       + '<div style="text-align:center;font-size:12px;color:var(--blue3);font-weight:600">' + msg + '</div>'
       + '</div>';
};

window.checkLoyaltyReward = function(bizId, appt) {
  if (!appt || !appt.email) return;
  var biz = typeof getBizById === 'function' ? getBizById(bizId) : null;
  if (!biz && typeof DB !== 'undefined' && DB.businesses) biz = DB.businesses.find(b => b.id === bizId);
  if (!biz) return;
  
  var allAppts = [];
  (biz.workers || []).forEach(function(w){ (w.appointments || []).forEach(function(a){ allAppts.push(a); }); });
  (biz.appointments || []).forEach(function(a){ allAppts.push(a); });
  
  var pastCompleted = allAppts.filter(function(x) {
     if (x.status !== 'completed' || String(x.id) === String(appt.id)) return false;
     if (x.date && appt.date && new Date(x.date) > new Date(appt.date)) return false;
     // Identificación EXACTA por Correo Electrónico
     var e1 = String(appt.email||'').toLowerCase().trim(); var e2 = String(x.email||'').toLowerCase().trim();
     if (e1 && e2 && e1 === e2) return true;
     return false;
  }).length;

  if (pastCompleted % 10 === 9 && appt.status === 'completed') {
     fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'loyalty_reward', to: appt.email, data: { clientName: appt.client, bizName: biz.name } }) }).catch(function(e){ console.error(e); });
  }
};
/* ══════════════════════════
   SUPER ADMIN — LOGIN (SEGURO CON SUPABASE)
══════════════════════════ */
async function dotsLogin() {
  var email = V('dots-email').trim().toLowerCase();
  var pass  = V('dots-pass');
  hideErr('dots-err');
  
  if (!email || !pass) { 
      showErr('dots-err', 'Completa todos los campos.'); 
      return; 
  }
  
  var key = 'dots_' + email;
  if (!checkRateLimit(key)) { 
      showErr('dots-err', 'Demasiados intentos. Espera 5 minutos.'); 
      return; 
  }

  try {
    let res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password: pass })
    });

    if (res.ok) {
      let data = await res.json();
      if (data.token) localStorage.setItem('citaspro_admin_token', data.token);
      resetRateLimit(key); 
      DB.admin.auth = true; 
      saveDB();
      hideErr('dots-err'); 
      closeOv('ov-admin');
      goTo('s-admin'); 
      showAdminPanel();
      if (typeof connectRealtimeForCurrentUser === 'function') connectRealtimeForCurrentUser();
      toast('Bienvenido/a, Admin', '#2855C8');
    } else {
      showErr('dots-err', 'Credenciales incorrectas.');
      var p = G('dots-pass'); 
      if (p) { p.value = ''; p.focus(); }
    }
  } catch (error) {
    showErr('dots-err', 'Error de conexión con el servidor.');
  }
}

async function doAdminLogin() {
  var email = V('adm-email').trim().toLowerCase();
  var pass  = V('adm-pass');
  hideErr('adm-err');
  
  if (!email || !pass) { 
      showErr('adm-err', 'Escribe email y contraseña.'); 
      return; 
  }
  
  var key = 'admin_' + email;
  if (!checkRateLimit(key)) { 
      showErr('adm-err', 'Demasiados intentos. Espera 5 minutos.'); 
      return; 
  }
  
  try {
    let res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password: pass })
    });

    if (res.ok) {
      let data = await res.json();
      if (data.token) localStorage.setItem('citaspro_admin_token', data.token);
      resetRateLimit(key); 
      DB.admin.auth = true; 
      saveDB(); 
      hideErr('adm-err'); 
      showAdminPanel();
      if (typeof connectRealtimeForCurrentUser === 'function') connectRealtimeForCurrentUser();
    } else {
      showErr('adm-err', 'Credenciales incorrectas.');
      var p = G('adm-pass'); 
      if (p) { p.value = ''; p.focus(); }
    }
  } catch (error) {
    showErr('adm-err', 'Error de conexión con el servidor.');
  }
}

function doAdminLogout() { 
    DB.admin.auth = false; 
    localStorage.removeItem('citaspro_admin_token');
    saveDB(); 
    var l = G('adm-login'), p = G('adm-panel'); 
    if (l) l.style.display = 'flex'; 
    if (p) p.style.display = 'none'; 
    if (typeof unsubscribeRealtime === 'function') unsubscribeRealtime();
}

function admTab(tab) {
  var tabs = ['dashboard','negocios','suscripciones','ingresos','notificaciones','config'];
  for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var pa = G('ap-' + t), bt = G('at-' + t);
      if (pa) pa.classList[t === tab ? 'add' : 'remove']('on');
      if (bt) bt.classList[t === tab ? 'add' : 'remove']('on');
  }
  if (tab === 'negocios')       renderBizListAdmin(filterBiz());
  if (tab === 'suscripciones')  renderSubs();
  if (tab === 'ingresos')       renderRevenue();
  if (tab === 'notificaciones') renderNotifications();
}

function filterBiz() {
  var q = (V('biz-search') || '').toLowerCase();
  var f = (V('biz-filter') || 'all');
  
  return DB.businesses.filter(function(b) {
    var mq = !q || (b.name || '').toLowerCase().indexOf(q) >= 0 || (b.city || '').toLowerCase().indexOf(q) >= 0 || (b.owner || '').toLowerCase().indexOf(q) >= 0;
    var mf = f === 'all' || (b.plan || '') == f;
    return mq && mf;
  });
}

function filterClientBiz() { 
    renderBizListAdmin(filterBiz()); 
}

function renderDash() {
  var bizs = DB.businesses, active = 0, trial = 0, appts = 0, ctry = {};
  
  for (var i = 0; i < bizs.length; i++) {
    var b = bizs[i];
    if (b.plan === 'active') active++;
    else if (b.plan === 'trial') trial++;
    
    (b.workers || []).forEach(function(w) { 
        appts += (w.appointments || []).length; 
    });
    appts += (b.appointments || []).length;
    
    if (b.country) ctry[b.country] = 1;
  }
  
  var mrr = active * 10, now = new Date();
  T('adm-date', MONTHS[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear());
  T('ds-total', bizs.length); 
  T('ds-sub', active + ' activos · ' + trial + ' en prueba');
  T('ds-mrr', money(mrr)); 
  T('ds-trial', trial); 
  T('ds-appts', appts); 
  T('ds-arr', money(mrr * 12));
  
  var cl = Object.keys(ctry); 
  T('ds-countries', cl.length);
  T('ds-flags', cl.map(function(c) { return FLAGS[c] || ''; }).join(' '));
  T('neg-badge', bizs.length);
  
  if (typeof renderAdminMRRChart === 'function') {
      renderAdminMRRChart();
  } else {
      var vals = [0, 0, 0, 0, mrr > 0 ? Math.round(mrr * .4) : 0, mrr];
      var max = Math.max.apply(null, vals.concat([10]));
      var mns = ['Oct','Nov','Dic','Ene','Feb',MONTHS_SHORT[now.getMonth()]];
      var ch = G('ds-chart');
      
      if (ch) {
          ch.innerHTML = vals.map(function(v, i) {
              return '<div class="bar' + (i === vals.length - 1 ? ' hi' : '') + '" style="height:' + Math.max(4, Math.round(v / max * 100)) + '%" title="' + money(v) + '"></div>';
          }).join('');
      }
      
      var ml = G('ds-months');
      if (ml) {
          ml.innerHTML = mns.map(function(m, i) {
              return '<div style="flex:1;text-align:center;font-size:9px;color:' + (i === mns.length - 1 ? 'var(--blue)' : 'var(--muted)') + ';font-weight:700">' + m + '</div>';
          }).join('');
      }
  }
  
  var recent = bizs.slice().sort(function(a, b) {
      return (b.joinDate || '').localeCompare(a.joinDate || '');
  }).slice(0, 5);
  
  H('ds-recent', recent.map(bizCardH).join(''));
}

function bizCardH(b) {
  var allAppts = [];
  (b.workers || []).forEach(function(w) {
      (w.appointments || []).forEach(function(a) { allAppts.push(a); });
  });
  (b.appointments || []).forEach(function(a) { allAppts.push(a); });
  
  var rev = allAppts.reduce(function(s, a) { return s + (a.price || 0); }, 0);
  var av = b.logo ? '<img src="' + sanitizeImageDataURL(b.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">' : '<span>' + san((b.name || '?').charAt(0)) + '</span>';
  var wCount = (b.workers || []).length;
  
  return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:10px;cursor:pointer;transition:all .15s" onclick="openBizProfile(\'' + sanitizeText(b.id) + '\')">'
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">'
    + '<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff;flex-shrink:0;overflow:hidden">' + av + '</div>'
    + '<div style="flex:1"><div style="font-size:14px;font-weight:800">' + san(b.name) + '</div><div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(b.owner) + ' · ' + (FLAGS[b.country] || '') + ' ' + san(b.city || '') + '</div></div>'
    + planTag(b.plan) + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    + '<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--blue)">' + wCount + '</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Trabajadores</div></div>'
    + '<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800">' + allAppts.length + '</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Citas</div></div>'
    + '<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--green)">' + money(rev) + '</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Facturado</div></div>'
    + '</div></div>';
}

function openBizProfile(bizId) {
  var b = DB.businesses.filter(function(x) { return x.id === bizId; })[0]; 
  if (!b) return;
  
  var allAppts = [];
  (b.workers || []).forEach(function(w) {
      (w.appointments || []).forEach(function(a) { allAppts.push(a); });
  });
  (b.appointments || []).forEach(function(a) { allAppts.push(a); });
  
  var rev = allAppts.reduce(function(s, a) { return s + (a.price || 0); }, 0);
  var todayA = allAppts.filter(function(a) { return a.date === new Date().toISOString().split('T')[0]; });
  var av = b.logo ? '<img src="' + sanitizeImageDataURL(b.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">' : san((b.name || '?').charAt(0));

  H('adm-biz-profile',
    '<div style="display:flex;align-items:center;gap:14px;background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:22px;padding:16px;margin-bottom:16px">'
    + '<div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0">' + av + '</div>'
    + '<div style="flex:1"><div style="font-size:18px;font-weight:800">' + san(b.name) + '</div>'
    + '<div style="font-size:12px;color:var(--t2);margin-top:4px;line-height:2">' + san(b.owner) + '<br>' + san(b.phone || '—') + '<br>' + san(b.email || '—') + '<br>' + san((b.addr || '') + ' ' + (b.city || '')) + '<br>' + san(b.type || '—') + '</div>'
    + '<div style="margin-top:8px">' + planTag(b.plan) + '</div></div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    + '<div class="sbox"><div class="slbl">Trabajadores</div><div class="snum" style="color:var(--blue)">' + (b.workers ? b.workers.length : 0) + '</div></div>'
    + '<div class="sbox"><div class="slbl">Citas totales</div><div class="snum">' + allAppts.length + '</div></div>'
    + '<div class="sbox"><div class="slbl">Facturado</div><div class="snum" style="color:var(--green)">' + money(rev) + '</div></div>'
    + '<div class="sbox"><div class="slbl">Citas hoy</div><div class="snum" style="color:var(--blue)">' + todayA.length + '</div></div></div>'
    + (b.desc ? '<div class="card" style="margin-bottom:12px;font-size:13px;color:var(--t2);line-height:1.6">' + san(b.desc) + '</div>' : '')
    + '<div style="background:var(--bg3);border-radius:11px;padding:12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">'
    + '<span style="font-size:13px;color:var(--blue3);font-weight:600;word-break:break-all;flex:1">citasproonline.com/#b/' + sanitizeText(b.id) + '</span>'
    + '<button onclick="copyText(\'https://citasproonline.com/#b/' + sanitizeText(b.id) + '\')" style="flex-shrink:0;padding:6px 12px;border-radius:8px;background:var(--bblue);color:var(--blue);font-size:12px;font-weight:700;border:1px solid rgba(74,127,212,.25);cursor:pointer;font-family:var(--font)">Copiar</button></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button onclick="extendTrial(\'' + sanitizeText(b.id) + '\')" class="btn btn-dark btn-sm" style="flex:1">Extender prueba</button>'
    + '<button onclick="activateBiz(\'' + sanitizeText(b.id) + '\')" class="btn btn-green btn-sm" style="flex:1">Activar</button>'
    + '<button onclick="suspendBiz(\'' + sanitizeText(b.id) + '\')" class="btn btn-red btn-sm" style="flex:1">Suspender</button>'
    + '<button type="button" onclick="event.preventDefault(); event.stopPropagation(); deleteBiz(\'' + sanitizeText(b.id) + '\')" class="btn btn-red btn-sm" style="flex:1">Eliminar</button></div>'
  );
  openOv('ov-biz-profile');
}

function renderBizListAdmin(bizs) { 
    H('adm-biz-list', bizs.length ? bizs.map(bizCardH).join('') : '<div style="text-align:center;color:var(--muted);padding:40px"><div style="font-size:13px">No se encontraron negocios</div></div>'); 
}

function renderSubs() { 
    H('adm-subs', DB.businesses.length ? DB.businesses.map(function(b) {
        return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px"><div style="flex:1"><div style="font-weight:700;font-size:14px">' + san(b.name) + '</div><div style="font-size:12px;color:var(--t2);margin-top:3px">' + san(b.email) + '</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Desde ' + san(b.joinDate || '—') + '</div></div>' + planTag(b.plan) + '</div>';
    }).join('') : '<div style="text-align:center;color:var(--muted);padding:40px">Sin negocios registrados</div>'); 
}

function renderRevenue() { 
    var active = DB.businesses.filter(function(b) { return b.plan === 'active'; }).length;
    var m = active * 10;
    
    T('rev-m', money(m));
    T('rev-y', money(m * 12));
    T('rev-p6', money(m * 1.8));
    T('rev-p12', money(m * 2.5));
    
    H('adm-proj', [
        { l: 'Mes actual (' + active + ' activos)', v: m, c: 'var(--green)' },
        { l: 'En 3 meses (estimado)', v: m * 1.3, c: 'var(--blue)' },
        { l: 'En 6 meses (estimado)', v: m * 1.8, c: 'var(--gold)' },
        { l: 'En 1 año (estimado)', v: m * 2.5, c: 'var(--green)' }
    ].map(function(r) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">' + r.l + '</span><span style="font-weight:800;font-size:17px;color:' + r.c + '">' + money(r.v) + '</span></div>';
    }).join('')); 
}

function checkNotifications() {
  var notifs = [];
  DB.businesses.forEach(function(b) {
    if (b.plan === 'trial')   notifs.push({ type: 'trial',   msg: b.name + ' está en período de prueba',   biz: b.id, color: '#F59E0B' });
    if (b.plan === 'expired') notifs.push({ type: 'expired', msg: b.name + ' tiene la suscripción vencida', biz: b.id, color: '#EF4444' });
  });
  
  var week = new Date(); 
  week.setDate(week.getDate() - 7);
  DB.businesses.forEach(function(b) { 
      if (b.joinDate && new Date(b.joinDate) >= week) {
          notifs.push({ type: 'new', msg: 'Nuevo: ' + b.name + ' de ' + (b.city || b.country || '—'), biz: b.id, color: '#22C55E' }); 
      }
  });
  
  var dot = G('notif-dot'); 
  if (dot) dot.classList[notifs.length > 0 ? 'add' : 'remove']('on');
  window._notifs = notifs;
}

function renderNotifications() {
  var notifs = window._notifs || [];
  H('notif-content', notifs.length ? notifs.map(function(n) {
    var icons = { trial: '&#9200;', expired: '&#10060;', new: '&#128293;' };
    return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openBizProfile(\'' + sanitizeText(n.biz) + '\')">'
      + '<div style="width:40px;height:40px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;background:' + n.color + '22">' + (icons[n.type] || '&#128276;') + '</div>'
      + '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + san(n.msg) + '</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Toca para ver detalles</div></div>'
      + '<span style="color:var(--muted);font-size:16px">&#8250;</span></div>';
  }).join('') : '<div style="text-align:center;color:var(--muted);padding:36px"><div style="font-size:13px">Sin notificaciones</div></div>');
}

/* ══════════════════════════
   ELIMINAR BARBERÍA (Super Admin)
══════════════════════════ */
function deleteBiz(id) {
  if (typeof closeOv === 'function') {
    closeOv('ov-biz-profile');
  }

  setTimeout(function() {
    openConfirmModal(
      'Eliminar negocio',
      '¿Estás seguro? Se eliminarán todos los datos, citas y trabajadores de este negocio de la base de datos.',
      function() {
        DB.businesses = DB.businesses.filter(function(b) { return b.id !== id; });
        saveDB(); 
        renderBizListAdmin(filterBiz()); 
        renderDash(); 
        checkNotifications();
        
        toast('Eliminando de la nube...', '#F59E0B');

        fetch('/api/delete-biz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id })
        })
        .then(function(res) {
          if (res.ok) {
            toast('Negocio eliminado por completo', '#EF4444');
          } else {
            toast('Error al borrar de la base de datos', '#EF4444');
          }
        })
        .catch(function(e) {
          console.error('Error de red al eliminar en Supabase:', e);
        });
      }
    );
    
  }, 300);
}

function copyText(txt) { 
    try { navigator.clipboard.writeText(txt); } catch(e) {} 
    toast('Copiado', '#4A7FD4'); 
}

/* ══════════════════════════
   FUNCIONES DE NUBE
══════════════════════════ */
async function fetchBizFromCloud(bizId) {
  try {
    const response = await fetch('/api/get-biz?id=' + bizId);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (err) {
    console.error('Error obteniendo datos de la nube:', err);
  }
  return null;
}

function syncBizToLocal(cloudData) {
  let index = DB.businesses.findIndex(b => b.id === cloudData.id);
  if (index >= 0) {
    DB.businesses[index] = cloudData;
  } else {
    DB.businesses.push(cloudData);
  }
  CUR = cloudData;
}

/* ══════════════════════════
   WINDOW.ONLOAD
══════════════════════════ */
window.onload = async function() {
  if (typeof bootComponents === 'function') {
    await bootComponents();
  }

  DB = loadDB(); 
  initREG(); 
  initCSEL();
  initTheme();
  
  // ¡MUY IMPORTANTE! Restaurar la sesión DESPUÉS de que bootComponents haya insertado el HTML de las vistas.
  if (typeof restaurarSesion === 'function') restaurarSesion();
  
  // Sincronizar visualmente los interruptores de idioma ahora que los componentes ya existen
  if (typeof window.syncLanguageToggles === 'function') window.syncLanguageToggles();

  /* Cerrar overlays al click en fondo */
  document.querySelectorAll('.ov').forEach(function(o) {
    o.addEventListener('click', function(e) { if (e.target === o) o.classList.remove('on'); });
  });

  /* Cerrar dropdown país al click fuera */
  document.addEventListener('click', function(e) {
    var wrapper = G('country-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      var dd = G('br-country-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });

  /* Toggle tema día/noche */
  on('theme-toggle', 'click', toggleTheme);
  
  on('btn-crear', 'click', function() { openRegModal(); });
  on('btn-login', 'click', function() { openLoginModal(); });

  /* Modal registro */
  on('rm-close1', 'click', function() { closeOv('ov-registro'); });
  on('rm-close2', 'click', function() { closeOv('ov-registro'); });
  on('rm-btn-next', 'click',  rmGoStep2);
  on('rm-btn-verify', 'click', rmVerify);
  on('rm-btn-resend', 'click', rmResend);
  on('rm-btn-back', 'click', function() { 
      var s1 = G('rm-step1'), s2 = G('rm-step2'); 
      if (s1) s1.style.display = 'block'; 
      if (s2) s2.style.display = 'none'; 
      hideErr('rm-err2'); 
  });
  on('rm-go-login', 'click', function() { closeOv('ov-registro'); openLoginModal(); });
  on('rm-pass', 'input', function() { updateRmPassStrength(this.value); });
  on('rm-pass', 'keydown', function(e) { if (e.key === 'Enter') rmGoStep2(); });
  
  [0, 1, 2, 3, 4, 5].forEach(function(i) {
    var box = G('rc' + i); 
    if (!box) return;
    box.addEventListener('input',  function() { codeInput(i); });
    box.addEventListener('keydown', function(e) { codeKey(e, i); });
  });
  
  document.addEventListener('paste', function(e) {
    var focused = document.activeElement;
    if (!focused || !focused.id || !focused.id.match(/^rc\d/)) return;
    var pasted = (e.clipboardData || window.clipboardData).getData('text');
    var digits = pasted.replace(/[^0-9]/g, '').slice(0, 6);
    if (digits.length >= 4) {
        e.preventDefault();
        [0, 1, 2, 3, 4, 5].forEach(function(i) {
            var b = G('rc' + i); 
            if (b) b.value = digits[i] || '';
        });
        if (digits.length === 6) setTimeout(rmVerify, 300);
    }
  });

  /* Modal login */
  on('login-close', 'click',   function() { closeOv('ov-login'); });
  on('li-btn-login', 'click',  doLogin);
  on('li-pass', 'keydown',     function(e) { if (e.key === 'Enter') doLogin(); });
  on('li-email', 'keydown',    function(e) { if (e.key === 'Enter') { var p = G('li-pass'); if(p) p.focus(); }});
  on('li-forgot', 'click',     openForgotModal);
  on('li-go-register', 'click', function() { closeOv('ov-login'); openRegModal(); });

  /* Modal forgot */
  on('forgot-close', 'click', function() { closeOv('ov-forgot'); });
  on('fp-btn-send', 'click',  doForgot);
  on('fp-email', 'keydown',   function(e) { if (e.key === 'Enter') doForgot(); });
  on('fp-btn-back', 'click',  function() { closeOv('ov-forgot'); openLoginModal(); });

  /* Admin panel */
  on('adm-login-btn', 'click', doAdminLogin);
  on('adm-pass', 'keydown',   function(e) { if (e.key === 'Enter') doAdminLogin(); });
  on('adm-back-btn', 'click', function() { goTo('s-portal'); });
  on('adm-home-btn', 'click', function() { goTo('s-portal'); });
  
  on('adm-out-btn', 'click',  function() { 
      if(typeof doAdminLogout === 'function') doAdminLogout(); 
  });
  
  on('adm-notif-btn', 'click', function() { renderNotifications(); openOv('ov-notif'); });
  on('cfg-save-btn', 'click', function() { toast('Configuración guardada', '#4A7FD4'); });
  on('cfg-pass-btn', 'click', function() {
    var p1 = V('cfg-pass1'), p2 = V('cfg-pass2');
    if (!p1 || p1 !== p2) { showErr('cfg-pass-err', 'Las contraseñas no coinciden.'); return; }
    if (p1.length < 8) { showErr('cfg-pass-err', 'Mínimo 8 caracteres.'); return; }
    hideErr('cfg-pass-err'); toast('Contraseña actualizada', '#4A7FD4');
  });
  
  on('close-notif', 'click',      function() { closeOv('ov-notif'); });
  on('close-biz-profile', 'click', function() { closeOv('ov-biz-profile'); });

  /* Biz registro */
  on('reg-start-btn', 'click',   function() { bizRegStep(1); });
  on('login-toggle-btn', 'click', function() { goTo('s-portal'); openLoginModal(); });
  on('back-1', 'click', function() { bizRegStep(0); }); 
  on('back-2', 'click', function() { bizRegStep(1); }); 
  on('back-3', 'click', function() { bizRegStep(2); });
  on('back-4', 'click', function() { bizRegStep(3); }); 
  on('back-5', 'click', function() { bizRegStep(4); }); 
  on('back-6', 'click', function() { bizRegStep(5); });
  on('next-1', 'click', function() { bizRegStep(2); }); 
  on('next-2', 'click', function() { bizRegStep(3); }); 
  on('next-3', 'click', function() { bizRegStep(4); });
  on('next-4', 'click', function() { bizRegStep(5); }); 
  on('next-5', 'click', function() { bizRegStep(6); }); 
  on('skip-5', 'click', function() { bizRegStep(6); }); 
  on('next-6', 'click', function() { bizRegStep(7); });
  
  on('enter-panel-btn', 'click', function() {
      CUR = DB.businesses.filter(function(b){ return b.id===DB.currentBiz; })[0];
      if (typeof saveDB === 'function') saveDB();
      if(CUR) {
          if (typeof showBizPanel === 'function') showBizPanel();
      } else {
          showRegStep(0);
      }
  });
  
  on('copy-link-reg', 'click',  copyLink);
  on('br-pass', 'input',        function() { updatePassStrength(this.value); });
  
  [['barberia', 'Barbería'], ['peluqueria', 'Peluquería'], ['unias', 'Uñas'], ['salon', 'Salón'], ['spa', 'Spa'], ['estetica', 'Estética']].forEach(function(t) { 
      on('type-' + t[0], 'click', function() { selType('type-' + t[0], t[1]); }); 
  });
  [['sz-1', '1'], ['sz-24', '2-4'], ['sz-59', '5-9'], ['sz-10', '10+']].forEach(function(s) { 
      on(s[0], 'click', function() { selSize(s[0], s[1]); }); 
  });

  /* Biz panel — dueño */
  on('biz-out-btn', 'click',    function() { 
      if (typeof bizLogout === 'function') bizLogout(); 
  });
  
  on('copy-link-btn', 'click',  copyLink);
  on('view-portal-btn', 'click', goClientFromBiz);
  
  on('new-appt-btn', 'click',   function() { 
      if(typeof openApptModal === 'function') openApptModal(); 
  });
  on('new-appt-btn2', 'click',  function() { 
      if(typeof openApptModal === 'function') openApptModal(); 
  });
  
  on('add-barber-btn', 'click', function() { openWorkerModal(null); });
  
  on('save-profile-btn', 'click', function() { 
      if(typeof saveBizProfile === 'function') saveBizProfile(); 
  });
  
  on('add-gallery-btn', 'click', function() { 
      var gi = G('gallery-input'); if(gi) gi.click(); 
  });

  /* Modales negocio */
  on('close-bar', 'click', function() { closeOv('ov-barber'); }); 
  on('save-bar-btn', 'click', function() { 
      if (typeof saveBarber === 'function') saveBarber(); 
  });
  on('close-appt', 'click', function() { closeOv('ov-appt'); }); 
  on('save-appt-btn', 'click', function() { 
      if (typeof saveAppt === 'function') saveAppt(); 
  });

  /* Modal confirmación genérico */
  on('confirm-ok-btn', 'click',    function() { 
      if (typeof confirmOk === 'function') confirmOk(); 
  });
  on('confirm-cancel-btn', 'click', function() { 
      if (typeof confirmCancel === 'function') confirmCancel(); 
  });

  /* Modal gestión de cita (cliente) */
  on('close-manage', 'click', function() { closeOv('ov-manage'); window.location.hash = ''; });

  /* Panel trabajador */
  on('wk-out-btn', 'click',       function() { 
      if (typeof workerLogout === 'function') workerLogout(); 
  });
  
  on('wk-copy-link', 'click',     function() {
    if (typeof copyWorkerLink === 'function') {
      copyWorkerLink();
    } else if (CUR) {
      try { navigator.clipboard.writeText('https://citasproonline.com/#b/' + CUR.id); } catch(e) {}
      toast('Enlace copiado', '#4A7FD4');
    }
  });
  
  on('wk-add-svc-btn', 'click',   function() { 
      if (typeof openWorkerSvcModal === 'function') openWorkerSvcModal(null); 
  });
  on('wk-add-gallery-btn', 'click', function() { 
      var gi = G('wk-gallery-input'); if (gi) gi.click(); 
  });
  on('save-wk-profile-btn', 'click', function() { 
      if (typeof saveWorkerProfile === 'function') saveWorkerProfile(); 
  });
  on('save-wk-pass-btn', 'click',   function() { 
      if (typeof saveWorkerPassword === 'function') saveWorkerPassword(); 
  });
  on('save-wk-horario-btn', 'click', function() { 
      if (typeof CUR_WORKER !== 'undefined' && CUR_WORKER) { 
          syncWorkerToCloud();
          saveDB(); 
          toast('Horario guardado', '#4A7FD4'); 
      } 
  });
  on('clear-notif-btn', 'click',    function() { 
      if (typeof clearWorkerNotifications === 'function') clearWorkerNotifications(); 
  });
  on('wk-profile-photo-btn', 'click', function() { 
      var gi = G('wk-profile-photo-input'); if(gi) gi.click(); 
  });

  /* Modales trabajador */
  on('close-wk-svc', 'click',      function() { closeOv('ov-wk-svc'); }); 
  on('save-wk-svc-btn', 'click',   function() { 
      if (typeof saveWorkerSvc === 'function') saveWorkerSvc(); 
  });
  on('close-wk-appt-detail', 'click', function() { closeOv('ov-wk-appt-detail'); });

  /* Portal cliente — nuevo flujo */
  on('cl-back-btn', 'click', function() { goTo('s-portal'); });
  on('cs1-next', 'click',  clStep2);
  on('cs2-next', 'click',  function() { clStep4(); });
  on('cs2-back', 'click',  function() { clGoStep(1); });
  on('cs3-next', 'click',  clStep4);
  on('cs3-back', 'click',  function() { clGoStep(2); });
  on('cs4-next', 'click',  clStep5);
  on('cs4-back', 'click',  function() { clGoStep(3); });
  on('cs5-confirm', 'click', confirmBooking);
  on('cs5-back', 'click',  function() { clGoStep(4); });
  on('cl-reset-btn', 'click', resetBooking);

  /* Fotos */
  setupPhotoUpload();
  setupWorkerPhotoUpload();

  /* Eye toggles */
  if (typeof initAllEyeToggles === 'function') initAllEyeToggles();

  /* QR */
  on('qr-btn', 'click',     openQRModal);
  on('qr-copy-btn', 'click', function() {
    if (!CUR) return;
    try { navigator.clipboard.writeText('https://citasproonline.com/#b/' + CUR.id); } catch(e) {}
    toast('Enlace copiado', '#4A7FD4');
  });
  on('qr-download-btn', 'click', function() {
    var img = G('qr-code') ? G('qr-code').querySelector('img') : null; 
    if (!img) return;
    var a = document.createElement('a'); 
    a.href = img.src; 
    a.download = 'QR-' + ((CUR && CUR.name) || 'citaspro') + '.png'; 
    a.click();
  });

  /* GLOBALS EXPORTADAS */
  window.admTab            = admTab;
  window.bizTab            = bizTab;
  window.workerTab         = workerTab;
  window.openBizProfile    = openBizProfile;
  window.extendTrial       = extendTrial;
  window.activateBiz       = activateBiz;
  window.suspendBiz        = suspendBiz;
  window.deleteBiz         = deleteBiz;
  window.copyText          = copyText;
  window.filterClientBiz   = filterClientBiz;
  window.openBizConfig     = typeof openBizConfig === 'function' ? openBizConfig : function(){};
  window.openWorkerConfig  = typeof openWorkerConfig === 'function' ? openWorkerConfig : function(){};
  window.openWorkerNotifs  = typeof openWorkerNotifs === 'function' ? openWorkerNotifs : function(){};
  
  window.prevMonth         = typeof prevMonth === 'function' ? prevMonth : function(){};
  window.nextMonth         = typeof nextMonth === 'function' ? nextMonth : function(){};
  window.selectCalDay      = typeof selectCalDay === 'function' ? selectCalDay : function(){};
  window.openApptDetail    = typeof openApptDetail === 'function' ? openApptDetail : function(){};
  window.toggleHorarioDay  = typeof toggleHorarioDay === 'function' ? toggleHorarioDay : function(){};
  window.openWorkerModal   = typeof openWorkerModal === 'function' ? openWorkerModal : function(){};
  window.confirmDeleteWorker = typeof confirmDeleteWorker === 'function' ? confirmDeleteWorker : function(){};
  window.delService        = typeof delService === 'function' ? delService : function(){};
  window.loadBizDirect     = typeof loadBizDirect === 'function' ? loadBizDirect : function(){};
  window.openQRModal       = typeof openQRModal === 'function' ? openQRModal : function(){};
  window.openWorkerSvcModal = typeof openWorkerSvcModal === 'function' ? openWorkerSvcModal : function(){};
  window.delWorkerService  = typeof delWorkerService === 'function' ? delWorkerService : function(){};
  window.delWorkerGalleryPhoto = typeof delWorkerGalleryPhoto === 'function' ? delWorkerGalleryPhoto : function(){};
  window.prevWorkerMonth   = typeof prevWorkerMonth === 'function' ? prevWorkerMonth : function(){};
  window.nextWorkerMonth   = typeof nextWorkerMonth === 'function' ? nextWorkerMonth : function(){};
  window.selectWorkerCalDay = typeof selectWorkerCalDay === 'function' ? selectWorkerCalDay : function(){};
  window.openWorkerApptDetail = typeof openWorkerApptDetail === 'function' ? openWorkerApptDetail : function(){};
  window.toggleWorkerHorarioDay = typeof toggleWorkerHorarioDay === 'function' ? toggleWorkerHorarioDay : function(){};
  window.selectWorker      = typeof selectWorker === 'function' ? selectWorker : function(){};
  window.cancelApptByToken = typeof cancelApptByToken === 'function' ? cancelApptByToken : function(){};
  window.confirmOk         = typeof confirmOk === 'function' ? confirmOk : function(){};
  window.confirmCancel     = typeof confirmCancel === 'function' ? confirmCancel : function(){};
  window.REG               = REG;

  /* ══════════════════════════════════════════════════
     STICKY SPLIT HORARIO — activar al pulsar tab
  ══════════════════════════════════════════════════ */
  if (window.innerWidth >= 1024) {
    var horarioTabBtn = G('wn-horario');
    if (horarioTabBtn) {
      horarioTabBtn.addEventListener('click', function() {
        setTimeout(initHorarioSplit, 200);
      });
    }
  }

  /* ARRANQUE CONECTADO A LA NUBE */
  (async function startup() {
    const hash = window.location.hash;

    if (hash && hash.startsWith('#b/')) {
      goTo('s-barber-portal'); 
      const targetBizId = hash.split('/')[1];
        
      if (targetBizId) {
        try {
          const cloudBiz = await fetchBizFromCloud(targetBizId);
          if (cloudBiz) {
            syncBizToLocal(cloudBiz);
            DB.currentWorker = null; 
            saveDB(); 
            loadBizDirect(targetBizId); 
            return; 
          } else {
            toast('La barbería no existe en la nube.', '#EF4444');
          }
        } catch (e) {
          if (getBizById(targetBizId)) {
            loadBizDirect(targetBizId);
            return;
          }
        }
      }
      window.location.hash = '';
      goTo('s-portal');
      return;
    }

    if (typeof checkLinkAccess === 'function') {
      const handled = await checkLinkAccess();
        if (handled) return;
    }

    if (DB.admin && DB.admin.auth) {
      goTo('s-admin');
      showAdminPanel();
      if (typeof connectRealtimeForCurrentUser === 'function') connectRealtimeForCurrentUser();
    } else if (DB.currentWorker) {
      if (typeof showWorkerPanel === 'function') showWorkerPanel();
      else goTo('s-portal'); 
      if (typeof connectRealtimeForCurrentUser === 'function') connectRealtimeForCurrentUser();
    } else if (DB.currentBiz) {
      if (typeof showBizPanel === 'function') showBizPanel();
      else goTo('s-portal'); 
      if (typeof connectRealtimeForCurrentUser === 'function') connectRealtimeForCurrentUser();
    } else {
      goTo('s-portal');
    }
  })();

  /* Escuchar cambios de hash */
  window.addEventListener('hashchange', async function() {
    let newHash = window.location.hash;
    if (newHash.startsWith('#b/')) {
      let id = newHash.split('/')[1];
      const freshData = await fetchBizFromCloud(id);
      if (freshData) syncBizToLocal(freshData);
    }
    if (typeof checkLinkAccess === 'function') checkLinkAccess();
  });

}; // <-- cierre del window.onload


/* ══════════════════════════════════════════════════
   STICKY SPLIT DEL HORARIO — función global
   Se llama desde workerTab() en workers.js y desde
   el listener del tab de horario en el onload.
══════════════════════════════════════════════════ */
function initHorarioSplit() {
  var daysContainer = G('wk-horario-days');
  if (!daysContainer || window.innerWidth < 1024) return;

  // Evitar doble inicialización
  if (daysContainer.querySelector('.horario-split-wrap')) return;

  var days = Array.from(daysContainer.children);
  if (days.length < 2) return;

  var half    = Math.ceil(days.length / 2);
  var topDays = days.slice(0, half);
  var botDays = days.slice(half);

  // Crear wrapper principal
  var wrap    = document.createElement('div');
  wrap.className = 'horario-split-wrap';

  // Mitad superior
  var topWrap = document.createElement('div');
  topWrap.className = 'horario-top-half';
  topDays.forEach(function(d) { topWrap.appendChild(d); });

  // Divisor visual
  var divider = document.createElement('div');
  divider.className = 'horario-divider';
  divider.innerHTML = '<span>Continúa el horario</span>';

  // Mitad inferior
  var botWrap = document.createElement('div');
  botWrap.className = 'horario-bottom-half';
  botDays.forEach(function(d) { botWrap.appendChild(d); });

  wrap.appendChild(topWrap);
  wrap.appendChild(divider);
  wrap.appendChild(botWrap);
  daysContainer.appendChild(wrap);

  // Estado inicial de la mitad inferior (ligeramente opaca)
  botWrap.style.opacity = '0.5';
  botWrap.style.transform = 'translateY(16px)';

  // Scroll handler
  var topHeight = 0;
  function onScroll() {
    if (!topHeight) topHeight = topWrap.offsetHeight;
    var rect     = wrap.getBoundingClientRect();
    var topbarH  = 74; // altura del topbar
    var progress = Math.max(0, Math.min(1,
      (-rect.top + topbarH + topHeight * 0.4) / (topHeight * 0.6)
    ));

    // Superior: sube y se desvanece
    topWrap.style.transform = 'translateY(' + (-progress * topHeight * 0.45) + 'px)';
    topWrap.style.opacity   = String(1 - progress * 0.85);

    // Inferior: sube y aparece
    botWrap.style.transform = 'translateY(' + ((1 - progress) * 16) + 'px)';
    botWrap.style.opacity   = String(0.5 + progress * 0.5);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // ejecutar una vez al iniciar
}

window.initHorarioSplit = initHorarioSplit;