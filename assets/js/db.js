'use strict';
//db.js 
/* ══════════════════════════
   SECURITY
══════════════════════════ */
var loginAttempts = {};

function checkRateLimit(k) {
  var n = Date.now();
  if (!loginAttempts[k]) {
      loginAttempts[k] = { count: 0, resetAt: n + 300000 };
  }
  if (n > loginAttempts[k].resetAt) {
      loginAttempts[k] = { count: 0, resetAt: n + 300000 };
  }
  loginAttempts[k].count++;
  return loginAttempts[k].count <= 5;
}

function resetRateLimit(k) { 
    delete loginAttempts[k]; 
}

function san(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .slice(0, 300);
}

function sanitizeText(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[<>"'`\/\\]/g, '').trim().slice(0, 300);
}

function safeNum(v, def) { 
    var n = parseFloat(v); 
    return isNaN(n) ? (def || 0) : Math.min(Math.max(n, 0), 999999); 
}

function safeInt(v, def) { 
    var n = parseInt(v);   
    return isNaN(n) ? (def || 0) : Math.min(Math.max(n, 0), 99999); 
}

function validEmail(e) { 
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(String(e).trim()); 
}

function validPhone(p) { 
    return String(p).replace(/\D/g, '').length >= 7; 
}

function passStrength(p) {
  var s = 0;
  if (p.length >= 8) s++; 
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p)) s++; 
  if (/[0-9]/.test(p)) s++; 
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

function validImageType(f) { 
    return ['image/jpeg', 'image/png', 'image/webp'].indexOf(f.type) >= 0 && f.size <= 5 * 1024 * 1024; 
}

/* ══════════════════════════
   GUARDIA DE IMÁGENES GLOBAL
══════════════════════════ */
function sanitizeImageDataURL(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:image/')) return url;
  return '';
}

/* ══════════════════════════
   VARIABLES GLOBALES
══════════════════════════ */
var DBKEY = 'citaspro_v9';
var DB, CUR, CUR_WORKER, REG, regStep, editSvc, editBar, CSEL;
var calendarDate   = new Date();
var selectedCalDay = new Date().toISOString().split('T')[0];

var FLAGS = { ES:'🇪🇸',CO:'🇨🇴',MX:'🇲🇽',AR:'🇦🇷',DE:'🇩🇪',NL:'🇳🇱',FR:'🇫🇷',CL:'🇨🇱',PE:'🇵🇪',US:'🇺🇸',BR:'🇧🇷',VE:'🇻🇪',EC:'🇪🇨',DO:'🇩🇴' };
var MONTHS       = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

var DEFAULT_HORARIO = [
  {day:'Lunes',    open:true,  from1:'09:00', to1:'14:00', hasBreak:true,  from2:'15:00', to2:'20:00'},
  {day:'Martes',   open:true,  from1:'09:00', to1:'14:00', hasBreak:true,  from2:'15:00', to2:'20:00'},
  {day:'Miércoles',open:true,  from1:'09:00', to1:'14:00', hasBreak:true,  from2:'15:00', to2:'20:00'},
  {day:'Jueves',   open:true,  from1:'09:00', to1:'14:00', hasBreak:true,  from2:'15:00', to2:'20:00'},
  {day:'Viernes',  open:true,  from1:'09:00', to1:'14:00', hasBreak:true,  from2:'15:00', to2:'20:00'},
  {day:'Sábado',   open:true,  from1:'09:00', to1:'16:00', hasBreak:false, from2:'',      to2:''},
  {day:'Domingo',  open:false, from1:'09:00', to1:'14:00', hasBreak:false, from2:'',      to2:''}
];

/* ══════════════════════════
   BASE DE DATOS
══════════════════════════ */
function defDB() {
  return {
    admin: { auth: false },
    businesses: [],
    currentBiz: null,
    currentWorker: null
  };
}

function loadDB() {
  try {
    var d = localStorage.getItem(DBKEY);
    if (!d) return defDB();
    var p = JSON.parse(d);
    if (!p || typeof p !== 'object') return defDB();
    if (!Array.isArray(p.businesses)) p.businesses = [];
    if (!p.admin || typeof p.admin !== 'object') p.admin = { auth: false };
    
    p.businesses.forEach(function(b) {
      if (!Array.isArray(b.workers)) b.workers = [];
      if (!Array.isArray(b.appointments)) b.appointments = [];
    });
    
    if (!p.currentWorker) p.currentWorker = null;
    return p;
  } catch(e) { 
      return defDB(); 
  }
}

function saveDB() {
  try {
    if (DB && typeof DB === 'object') {
      localStorage.setItem(DBKEY, JSON.stringify(DB));

      if (CUR && CUR.id) {
        // ✅ Sincronizar negocio a Supabase
        fetch('/api/update-biz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(CUR)
        }).then(async function(res) {
          if (!res.ok) {
            var err = await res.json();
            console.error("🔥 ERROR SUPABASE (update-biz):", err.detalle || err.error);
          }
        }).catch(function(e) {});

        // ✅ Sincronizar appointments de cada worker a Supabase
        syncAppointmentsToCloud(CUR);

        // ✅ Sincronizar services de cada worker a Supabase
        syncServicesToCloud(CUR);
      }
    }
  } catch(e) { 
    toast('Almacenamiento lleno', '#EF4444'); 
  }
}

/* ══════════════════════════
   SINCRONIZACIÓN GRANULAR CON SUPABASE
   Cada tabla se sincroniza por separado
══════════════════════════ */

// Sincroniza TODAS las citas del negocio a la tabla "appointments"
function syncAppointmentsToCloud(biz) {
  if (!biz || !biz.id) return;
  var allAppts = [];

  // Citas de workers
  (biz.workers || []).forEach(function(w) {
    (w.appointments || []).forEach(function(a) {
      allAppts.push({
        id:            String(a.id),
        business_id:   biz.id,
        worker_id:     w.id,
        client_id:     '',
        client_name:   a.client || '',
        client_phone:  a.phone || '',
        service_name:  a.svc || '',
        service_price: parseFloat(a.price) || 0,
        date:          a.date || '',
        time:          a.time || '',
        status:        a.status || 'confirmed'
      });
    });
  });

  // Citas sin worker asignado
  (biz.appointments || []).forEach(function(a) {
    allAppts.push({
      id:            String(a.id),
      business_id:   biz.id,
      worker_id:     '',
      client_id:     '',
      client_name:   a.client || '',
      client_phone:  a.phone || '',
      service_name:  a.svc || '',
      service_price: parseFloat(a.price) || 0,
      date:          a.date || '',
      time:          a.time || '',
      status:        a.status || 'confirmed'
    });
  });

  if (allAppts.length === 0) return;

  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'appointments', business_id: biz.id, appointments: allAppts })
  }).catch(function(e) {
    console.error('Error sync appointments:', e);
  });
}

// Sincroniza TODOS los servicios del negocio a la tabla "services"
function syncServicesToCloud(biz) {
  if (!biz || !biz.id) return;
  var allSvcs = [];

  (biz.workers || []).forEach(function(w) {
    (w.services || []).forEach(function(s) {
      allSvcs.push({
        id:          String(s.id),
        business_id: biz.id,
        name:        s.name || '',
        description: s.desc || '',
        price:       parseFloat(s.price) || 0,
        duration:    parseInt(s.dur) || 30,
        color:       s.color || '',
        image:       s.photo || ''
      });
    });
  });

  if (allSvcs.length === 0) return;

  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'services', business_id: biz.id, services: allSvcs })
  }).catch(function(e) {
    console.error('Error sync services:', e);
  });
}

// Sincroniza un cliente nuevo a la tabla "clients" con todos los datos de su reserva
function syncClientToCloud(bizId, client) {
  if (!bizId || !client) return;

  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type:          'client',
      id:            'cl_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      business_id:   bizId,
      name:          client.name || '',
      email:         client.email || '',
      phone:         client.phone || '',
      worker_id:     client.worker_id || '',
      worker_name:   client.worker_name || '',
      service_name:  client.service_name || '',
      service_price: client.service_price || 0,
      date:          client.date || '',
      time:          client.time || ''
    })
  }).catch(function(e) {
    console.error('Error sync client:', e);
  });
}

// Sincroniza un producto a la tabla "products"
function syncProductToCloud(bizId, product) {
  if (!bizId || !product) return;

  fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type:          'product',
      id:            product.id || ('prod_' + Date.now()),
      business_id:   bizId,
      name:          product.name || '',
      description:   product.description || '',
      price:         parseFloat(product.price) || 0,
      stock:         parseInt(product.stock) || 0,
      image:         product.image || '',
      category:      product.category || '',
      rating:        parseFloat(product.rating) || 0,
      reviews_count: parseInt(product.reviews_count) || 0
    })
  }).catch(function(e) {
    console.error('Error sync product:', e);
  });
}

/* ══════════════════════════
   HELPERS UI
══════════════════════════ */
function money(n) { return parseFloat(n || 0).toFixed(2) + '€'; }
function G(id)    { return document.getElementById(id); }
function V(id)    { var e = G(id); return e ? e.value : ''; }
function T(id, t) { var e = G(id); if (e) e.textContent = sanitizeText(t); }
function H(id, h) { var e = G(id); if (e) e.innerHTML = h; }
function on(id, ev, fn) { var e = G(id); if (e) e.addEventListener(ev, fn); }
function openOv(id)   { var e = G(id); if (e) e.classList.add('on'); }
function closeOv(id)  { var e = G(id); if (e) e.classList.remove('on'); }

function showErr(id, msg) { 
    var e = G(id); 
    if (e) { 
        e.textContent = msg; 
        e.style.display = 'block'; 
    } 
}

function hideErr(id) { 
    var e = G(id); 
    if (e) e.style.display = 'none'; 
}

function initREG() {
  REG = { type:'', name:'', owner:'', email:'', pass:'', phone:'', addr:'', city:'', country:'ES', teamSize:'', services:[], photos:[], logo:'', cover:'' };
  regStep = 0; editSvc = null; editBar = null;
}

function initCSEL() {
  CSEL = { 
      bizId: null, workerId: null, svc: null, svcPrice: 0, svcDur: 30,
      date: null, time: null, clientName: '', clientPhone: '', clientEmail: '',
      bookingToken: null, editingToken: null 
  };
}

function toast(msg, color) {
  var old = document.querySelectorAll('.cpt');
  for (var i = 0; i < old.length; i++) old[i].remove();
  var t = document.createElement('div');
  t.className = 'cpt';
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:var(--rpill);font-weight:700;font-size:14px;z-index:99999;pointer-events:none;color:#fff;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.5);background:' + (color || '#1A2540');
  document.body.appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.remove(); }, 2800);
}

/* ══════════════════════════
   THEME
══════════════════════════ */
function initTheme() {
  var saved = localStorage.getItem('citaspro_theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('citaspro_theme', theme);
  var btn = G('theme-toggle');
  if (btn) {
    btn.innerHTML = theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ══════════════════════════
   NAVEGACIÓN
══════════════════════════ */
function goTo(id) {
  var ss = document.querySelectorAll('.scr');
  for (var i = 0; i < ss.length; i++) ss[i].classList.remove('on');
  var s = G(id);
  if (s) s.classList.add('on');
  window.scrollTo(0, 0);
}

function goBiz() {
  goTo('s-biz');
  if (DB.currentBiz) {
    if (typeof showBizPanel === 'function') showBizPanel();
  } else {
    if (typeof showBizReg === 'function') showBizReg();
  }
}

function goWorker() {
  goTo('s-worker');
  if (DB.currentWorker) {
      if (typeof showWorkerPanel === 'function') showWorkerPanel();
  }
}

function goClientFromBiz() {
  if (CUR) {
      if (typeof loadBizDirect === 'function') loadBizDirect(CUR.id);
  } else {
      goTo('s-portal');
  }
}

/* ══════════════════════════
   HELPERS DE DATOS Y NOTIFICACIONES
══════════════════════════ */
function getBizById(id) {
  return DB.businesses.filter(function(b){ return b.id === id; })[0] || null;
}

function getWorkerById(bizId, workerId) {
  var biz = getBizById(bizId);
  if (!biz) return null;
  return (biz.workers || []).filter(function(w){ return w.id === workerId; })[0] || null;
}

function addNotificationToWorker(bizId, workerId, notif) {
  var w = getWorkerById(bizId, workerId);
  if (!w) return;
  if (!w.notifications) w.notifications = [];
  
  w.notifications.unshift({
    id: Date.now(),
    type: notif.type,
    msg: notif.msg || notif.title, 
    title: notif.title || notif.msg,
    body: notif.body || (notif.data ? notif.data.detail : ''),
    data: notif.data || {},
    read: false,
    date: new Date().toISOString().split('T')[0]
  });
  
  if (w.notifications.length > 50) w.notifications = w.notifications.slice(0, 50);
  saveDB();
}

function notifyWorker(bizId, workerId, type, title, data) {
  addNotificationToWorker(bizId, workerId, {
      type: type,
      title: title,
      body: data.detail || '',
      data: data
  });
}

function planTag(plan) {
  var m = { 
      active:  { c:'#22C55E', l:'Activo' }, 
      trial:   { c:'#F59E0B', l:'Prueba' }, 
      expired: { c:'#EF4444', l:'Vencido' } 
  };
  var x = m[plan] || { c:'#475569', l:'—' };
  return '<span style="background:' + x.c + '22;color:' + x.c + ';border:1px solid ' + x.c + '44;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">' + x.l + '</span>';
}

/* ══════════════════════════
   SINCRONIZACIÓN CON LA NUBE
══════════════════════════ */
async function forceCloudSync() {
  try {
    var res = await fetch('/api/get-db');
    if (res.ok) {
      var cloudBusinesses = await res.json();
      var local = loadDB(); 
      local.businesses = cloudBusinesses; 
      localStorage.setItem(DBKEY, JSON.stringify(local)); 
      DB = local; 

      if (typeof CUR !== 'undefined' && CUR && typeof initBizPanel === 'function') {
         CUR = DB.businesses.find(function(b) { return b.id === CUR.id; }) || CUR;
         initBizPanel();
      }

      // ✅ Actualizar CUR_WORKER si el barbero tiene sesión activa
      if (typeof CUR_WORKER !== 'undefined' && CUR_WORKER && DB.currentWorker) {
         var freshBiz = getBizById(DB.currentWorker.bizId);
         if (freshBiz) {
           CUR = freshBiz;
           var freshWorker = (freshBiz.workers || []).find(function(w) { return w.id === DB.currentWorker.workerId; });
           if (freshWorker) {
             CUR_WORKER = freshWorker;
             if (typeof initWorkerPanel === 'function') initWorkerPanel();
           }
         }
      }
    }
  } catch(e) {
    // Silencioso — si no hay red, usamos datos locales
  }
}

// Esperar a que la página cargue antes de sincronizar
window.addEventListener('load', function() {
  setTimeout(forceCloudSync, 500);
});

/* ══════════════════════════
   AUTO-LOGIN
══════════════════════════ */
function restaurarSesion() {
  DB = loadDB();

  if (DB && DB.currentWorker && DB.currentBiz) {
    CUR = getBizById(DB.currentBiz);
    if (CUR) {
       if (typeof goWorker === 'function') goWorker();
       return; 
    }
  }

  if (DB && DB.currentBiz && !DB.currentWorker) {
    CUR = getBizById(DB.currentBiz);
    if (CUR) {
       if (typeof goBiz === 'function') goBiz();
       return;
    }
  }

  if (typeof goTo === 'function') goTo('s-portal');
}

window.addEventListener('DOMContentLoaded', restaurarSesion);