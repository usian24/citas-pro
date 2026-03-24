'use strict';

function doAdminLogout() {
  DB.admin.auth = false; saveDB();
  var l = G('adm-login'), p = G('adm-panel');
  if (l) l.style.display = 'flex';
  if (p) p.style.display = 'none';
}

function showAdminPanel() {
  var l = G('adm-login'), p = G('adm-panel');
  if (l) l.style.display = 'none';
  if (p) p.style.display = 'block';
  renderDash();
  checkNotifications();
}

/* ══════════════════════════
   ADMIN TABS
══════════════════════════ */
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
    var mq = !q || (b.name||'').toLowerCase().indexOf(q) >= 0 || (b.city||'').toLowerCase().indexOf(q) >= 0 || (b.owner||'').toLowerCase().indexOf(q) >= 0;
    var mf = f === 'all' || (b.plan || '') == f;
    return mq && mf;
  });
}

function filterClientBiz() { renderBizListAdmin(filterBiz()); }

/* ══════════════════════════
   DASHBOARD
══════════════════════════ */
function renderDash() {
  var bizs = DB.businesses, active = 0, trial = 0, appts = 0, ctry = {};
  for (var i = 0; i < bizs.length; i++) {
    var b = bizs[i];
    if (b.plan === 'active') active++;
    else if (b.plan === 'trial') trial++;
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
  T('ds-flags', cl.map(function(c) { return FLAGS[c] || '🌍'; }).join(' '));
  T('neg-badge', bizs.length);
  var vals = [0, 0, 0, 0, mrr > 0 ? Math.round(mrr * .4) : 0, mrr];
  var max  = Math.max.apply(null, vals.concat([10]));
  var mns  = ['Oct','Nov','Dic','Ene','Feb', MONTHS_SHORT[now.getMonth()]];
  var ch = G('ds-chart');
  if (ch) ch.innerHTML = vals.map(function(v, i) {
    return '<div class="bar' + (i === vals.length - 1 ? ' hi' : '') + '" style="height:' + Math.max(4, Math.round(v / max * 100)) + '%" title="' + money(v) + '"></div>';
  }).join('');
  var ml = G('ds-months');
  if (ml) ml.innerHTML = mns.map(function(m, i) {
    return '<div style="flex:1;text-align:center;font-size:9px;color:' + (i === mns.length - 1 ? 'var(--blue)' : 'var(--muted)') + ';font-weight:700">' + m + '</div>';
  }).join('');
  var recent = bizs.slice().sort(function(a, b) { return (b.joinDate||'').localeCompare(a.joinDate||''); }).slice(0, 5);
  H('ds-recent', recent.map(bizCardH).join(''));
}

function planTag(plan) {
  var m = { active:{ c:'#22C55E', l:' Activo' }, trial:{ c:'#F59E0B', l:' Prueba' }, expired:{ c:'#EF4444', l:' Vencido' } };
  var x = m[plan] || { c:'#475569', l:'—' };
  return '<span style="background:' + x.c + '22;color:' + x.c + ';border:1px solid ' + x.c + '44;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">' + x.l + '</span>';
}

function bizCardH(b) {
  var rev = (b.appointments || []).reduce(function(s, a) { return s + (a.price || 0); }, 0);
  var av  = b.logo ? '<img src="' + sanitizeImageDataURL(b.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">' : '<span>' + san((b.name || '?').charAt(0)) + '</span>';
  return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:10px;cursor:pointer;transition:all .15s" onclick="openBizProfile(\'' + sanitizeText(b.id) + '\')">'
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">'
    + '<div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff;flex-shrink:0;overflow:hidden">' + av + '</div>'
    + '<div style="flex:1"><div style="font-size:14px;font-weight:800">' + san(b.name) + '</div><div style="font-size:12px;color:var(--t2);margin-top:2px">' + san(b.owner) + ' · ' + (FLAGS[b.country] || '🌍') + ' ' + san(b.city || '') + '</div></div>'
    + planTag(b.plan) + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    + '<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--blue)">' + (b.barbers ? b.barbers.length : 0) + '</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Profesionales</div></div>'
    + '<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800">' + (b.appointments ? b.appointments.length : 0) + '</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Citas</div></div>'
    + '<div style="background:var(--bg3);border-radius:9px;padding:9px;text-align:center"><div style="font-size:16px;font-weight:800;color:var(--green)">' + money(rev) + '</div><div style="font-size:10px;color:var(--muted);margin-top:2px">Facturado</div></div>'
    + '</div></div>';
}

function openBizProfile(bizId) {
  var b = DB.businesses.filter(function(x) { return x.id === bizId; })[0]; if (!b) return;
  var rev    = (b.appointments || []).reduce(function(s, a) { return s + (a.price || 0); }, 0);
  var todayA = (b.appointments || []).filter(function(a) { return a.date === new Date().toISOString().split('T')[0]; });
  var av     = b.logo ? '<img src="' + sanitizeImageDataURL(b.logo) + '" style="width:100%;height:100%;object-fit:cover" alt="Logo">' : san((b.name || '?').charAt(0));
  H('adm-biz-profile',
    '<div style="display:flex;align-items:center;gap:14px;background:var(--bblue);border:1px solid rgba(74,127,212,.2);border-radius:22px;padding:16px;margin-bottom:16px">'
    + '<div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#4A7FD4,#2855C8);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0">' + av + '</div>'
    + '<div style="flex:1"><div style="font-size:18px;font-weight:800">' + san(b.name) + '</div>'
    + '<div style="font-size:12px;color:var(--t2);margin-top:4px;line-height:2"> ' + san(b.owner) + '<br> ' + san(b.phone || '—') + '<br> ' + san(b.email || '—') + '<br> ' + san((b.addr || '') + ' ' + (b.city || '')) + '<br> ' + san(b.type || '—') + '</div>'
    + '<div style="margin-top:8px">' + planTag(b.plan) + '</div></div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'
    + '<div class="sbox"><div class="slbl">Profesionales</div><div class="snum" style="color:var(--blue)">' + (b.barbers ? b.barbers.length : 0) + '</div></div>'
    + '<div class="sbox"><div class="slbl">Citas totales</div><div class="snum">' + (b.appointments ? b.appointments.length : 0) + '</div></div>'
    + '<div class="sbox"><div class="slbl">Facturado</div><div class="snum" style="color:var(--green)">' + money(rev) + '</div></div>'
    + '<div class="sbox"><div class="slbl">Citas hoy</div><div class="snum" style="color:var(--blue)">' + todayA.length + '</div></div></div>'
    + (b.desc ? '<div class="card" style="margin-bottom:12px;font-size:13px;color:var(--t2);line-height:1.6">' + san(b.desc) + '</div>' : '')
    + '<div style="background:var(--bg3);border-radius:11px;padding:12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">'
    + '<span style="font-size:13px;color:var(--blue3);font-weight:600;word-break:break-all;flex:1">🔗 citaspro.app/b/' + sanitizeText(b.id) + '</span>'
    + '<button onclick="copyText(\'citaspro.app/b/' + sanitizeText(b.id) + '\')" style="flex-shrink:0;padding:6px 12px;border-radius:8px;background:var(--bblue);color:var(--blue);font-size:12px;font-weight:700;border:1px solid rgba(74,127,212,.25);cursor:pointer;font-family:var(--font)">Copiar</button></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button onclick="extendTrial(\'' + sanitizeText(b.id) + '\')" class="btn btn-dark btn-sm" style="flex:1"> Extender prueba</button>'
    + '<button onclick="activateBiz(\'' + sanitizeText(b.id) + '\')" class="btn btn-green btn-sm" style="flex:1"> Activar</button>'
    + '<button onclick="suspendBiz(\'' + sanitizeText(b.id) + '\')" class="btn btn-red btn-sm" style="flex:1"> Suspender</button></div>'
  );
  openOv('ov-biz-profile');
}

function renderBizListAdmin(bizs) {
  H('adm-biz-list', bizs.length ? bizs.map(bizCardH).join('') : '<div style="text-align:center;color:var(--muted);padding:40px"><div style="font-size:36px;margin-bottom:12px">🔍</div><div>No se encontraron negocios</div></div>');
}

function renderSubs() {
  H('adm-subs', DB.businesses.length
    ? DB.businesses.map(function(b) {
        return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px"><div style="flex:1"><div style="font-weight:700;font-size:14px">' + san(b.name) + '</div><div style="font-size:12px;color:var(--t2);margin-top:3px">' + san(b.email) + '</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Desde ' + san(b.joinDate || '—') + '</div></div>' + planTag(b.plan) + '</div>';
      }).join('')
    : '<div style="text-align:center;color:var(--muted);padding:40px">Sin negocios registrados</div>');
}

function renderRevenue() {
  var active = DB.businesses.filter(function(b) { return b.plan === 'active'; }).length;
  var m = active * 10;
  T('rev-m', money(m)); T('rev-y', money(m * 12)); T('rev-p6', money(m * 1.8)); T('rev-p12', money(m * 2.5));
  H('adm-proj', [
    { l: 'Mes actual (' + active + ' activos)', v: m,       c: 'var(--green)' },
    { l: 'En 3 meses (estimado)',               v: m * 1.3, c: 'var(--blue)'  },
    { l: 'En 6 meses (estimado)',               v: m * 1.8, c: 'var(--gold)'  },
    { l: 'En 1 año (estimado)',                 v: m * 2.5, c: 'var(--green)' }
  ].map(function(r) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid var(--b)"><span style="font-size:13px;color:var(--t2)">' + r.l + '</span><span style="font-weight:800;font-size:17px;color:' + r.c + '">' + money(r.v) + '</span></div>';
  }).join(''));
}

function checkNotifications() {
  var notifs = [];
  DB.businesses.forEach(function(b) {
    if (b.plan === 'trial')   notifs.push({ type:'trial',   msg: b.name + ' está en período de prueba',          biz: b.id, color:'#F59E0B' });
    if (b.plan === 'expired') notifs.push({ type:'expired', msg: b.name + ' tiene la suscripción vencida',        biz: b.id, color:'#EF4444' });
  });
  var week = new Date(); week.setDate(week.getDate() - 7);
  DB.businesses.forEach(function(b) {
    if (b.joinDate && new Date(b.joinDate) >= week) notifs.push({ type:'new', msg: 'Nuevo: ' + b.name + ' de ' + (b.city || b.country || '—'), biz: b.id, color:'#22C55E' });
  });
  var dot = G('notif-dot');
  if (dot) dot.classList[notifs.length > 0 ? 'add' : 'remove']('on');
  window._notifs = notifs;
}

function renderNotifications() {
  var notifs = window._notifs || [];
  H('notif-content', notifs.length
    ? notifs.map(function(n) {
        return '<div style="background:var(--card);border:1px solid var(--b);border-radius:20px;padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openBizProfile(\'' + sanitizeText(n.biz) + '\')">'
          + '<div style="width:40px;height:40px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;background:' + n.color + '22">' + ({ trial:'', expired:'', new:'🆕' }[n.type] || '🔔') + '</div>'
          + '<div style="flex:1"><div style="font-size:13px;font-weight:600">' + san(n.msg) + '</div><div style="font-size:11px;color:var(--muted);margin-top:3px">Toca para ver detalles</div></div>'
          + '<span style="color:var(--muted);font-size:16px">›</span></div>';
      }).join('')
    : '<div style="text-align:center;color:var(--muted);padding:36px"><div style="font-size:32px;margin-bottom:10px">🎉</div><div>Sin notificaciones</div></div>');
}

function extendTrial(id) {
  var b = DB.businesses.filter(function(x) { return x.id === id; })[0];
  if (b) { b.plan = 'trial'; saveDB(); toast('Prueba extendida', '#F59E0B'); checkNotifications(); closeOv('ov-biz-profile'); renderBizListAdmin(filterBiz()); }
}

function activateBiz(id) {
  var b = DB.businesses.filter(function(x) { return x.id === id; })[0];
  if (b) { b.plan = 'active'; saveDB(); toast('Negocio activado', '#22C55E'); checkNotifications(); closeOv('ov-biz-profile'); renderBizListAdmin(filterBiz()); renderDash(); }
}

function suspendBiz(id) {
  var b = DB.businesses.filter(function(x) { return x.id === id; })[0];
  if (b) { b.plan = 'expired'; saveDB(); toast('Negocio suspendido', '#EF4444'); checkNotifications(); closeOv('ov-biz-profile'); renderBizListAdmin(filterBiz()); renderDash(); }
}

function copyText(txt) {
  try { navigator.clipboard.writeText(txt); } catch(e) {}
  toast('Copiado', '#4A7FD4');
}