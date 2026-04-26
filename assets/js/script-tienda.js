// script-tienda.js — CitasPro Tienda v3
// ─────────────────────────────────────────────────────
// • Layout tren 3×3 en panel admin
// • Stock real (el dueño lo define, no 100 por defecto)
// • Descuento % por producto
// • Descuento % por categoría (aplica a todos sus productos)
// • Buscador interno en el panel admin
// ─────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://fcbbquvuffpmudvwqgbg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_T-vz8QfJf_BB6XiHDavtLg_KyQvhjOF';
const tiendaSupa        = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let tempProdPhotos      = [];
let editingProdId      = null;
let categoriasActuales = [];
let todosLosProductos  = []; // cache para el buscador admin

// ══════════════════════════════════════════
// ALERTAS Y CONFIRMACIONES
// ══════════════════════════════════════════
function mostrarAlertaTienda(mensaje, titulo = 'Aviso', icono = '⚠️') {
  document.getElementById('ta-icon').innerText  = icono;
  document.getElementById('ta-title').innerText = titulo;
  document.getElementById('ta-msg').innerText   = mensaje;
  openOv('ov-tienda-alert');
}

function confirmarAccionTienda(titulo, mensaje, onConfirm) {
  document.getElementById('confirm-title').innerText = titulo;
  document.getElementById('confirm-msg').innerText   = mensaje;
  ['confirm-ok-btn','confirm-cancel-btn'].forEach(id => {
    const o = document.getElementById(id), n = o.cloneNode(true);
    o.parentNode.replaceChild(n, o);
  });
  document.getElementById('confirm-ok-btn').onclick     = () => { closeOv('ov-confirm'); onConfirm(); };
  document.getElementById('confirm-cancel-btn').onclick = () => closeOv('ov-confirm');
  openOv('ov-confirm');
}

// ══════════════════════════════════════════
// ESTILOS DEL TREN (se inyectan 1 vez)
// ══════════════════════════════════════════
(function inyectarEstilosTren() {
  if (document.getElementById('tienda-admin-styles')) return;
  const st = document.createElement('style');
  st.id = 'tienda-admin-styles';
  st.textContent = `
    .adm-search-wrap {
      display:flex; align-items:center; gap:10px;
      background:var(--card); border:1.5px solid var(--b);
      border-radius:14px; padding:10px 14px; margin-bottom:16px;
    }
    .adm-search-wrap input {
      flex:1; background:none; border:none; outline:none;
      color:var(--text); font-family:var(--font); font-size:13px;
    }
    .adm-seccion { margin-bottom:28px; }
    .adm-seccion-hdr {
      font-size:13px; font-weight:800; margin-bottom:10px;
      display:flex; align-items:center; gap:8px;
    }
    .adm-seccion-hdr .cnt {
      font-size:10px; font-weight:700; color:var(--blue);
      background:rgba(74,127,212,.12); padding:2px 7px; border-radius:8px;
    }
    .adm-seccion-hdr .btn-cat-desc {
      margin-left:auto; font-size:10px; font-weight:700;
      color:var(--gold,#F59E0B); background:rgba(245,158,11,.1);
      border:1px solid rgba(245,158,11,.3); border-radius:8px;
      padding:3px 8px; cursor:pointer; white-space:nowrap;
    }
    .adm-seccion-hdr .btn-cat-desc:hover { background:rgba(245,158,11,.2); }
    .adm-tren {
      display:flex; gap:10px;
      overflow-x:auto; scroll-snap-type:x mandatory;
      padding:2px 0 10px; scrollbar-width:none;
      -webkit-overflow-scrolling:touch;
    }
    .adm-tren::-webkit-scrollbar { display:none; }
    .adm-tren-col {
      display:flex; flex-direction:column; gap:10px;
      flex-shrink:0; scroll-snap-align:start;
      width:calc((100vw - 60px) / 3);
      min-width:100px; max-width:140px;
    }
    .adm-p-card {
      background:var(--card); border:1px solid var(--b);
      border-radius:14px; overflow:hidden; position:relative;
      display:flex; flex-direction:column;
      cursor:pointer; transition:transform .18s;
      box-shadow:0 3px 8px rgba(0,0,0,.06);
    }
    .adm-p-card:active { transform:scale(0.96); }
    .adm-p-img {
      width:100%; aspect-ratio:1/1; background:#F8FAFC;
      display:flex; align-items:center; justify-content:center;
      overflow:hidden; position:relative;
    }
    .adm-p-img img {
      max-width:100%; max-height:100%;
      object-fit:contain; mix-blend-mode:multiply;
    }
    .adm-p-img .no-img { font-size:22px; color:var(--muted); }
    .adm-p-desc-badge {
      position:absolute; top:5px; left:5px;
      background:#EF4444; color:#fff;
      font-size:8px; font-weight:900;
      padding:2px 5px; border-radius:5px; z-index:2;
    }
    .adm-p-actions {
      position:absolute; top:5px; right:5px;
      display:flex; flex-direction:column; gap:3px; z-index:2;
    }
    .adm-p-actions button {
      width:22px; height:22px; border-radius:50%;
      border:none; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      font-size:10px; font-weight:bold;
    }
    .adm-p-actions .btn-edit { background:rgba(74,127,212,.15); color:var(--blue); }
    .adm-p-actions .btn-del  { background:rgba(239,68,68,.15);  color:var(--red);  }
    .adm-p-info { padding:7px 8px 8px; }
    .adm-p-cat  {
      font-size:8px; color:var(--blue); font-weight:800;
      background:rgba(74,127,212,.1); padding:2px 5px;
      border-radius:5px; text-transform:uppercase;
      display:inline-block; margin-bottom:4px;
    }
    .adm-p-name {
      font-size:11px; font-weight:800; color:var(--text);
      line-height:1.25; margin-bottom:4px;
      display:-webkit-box; -webkit-line-clamp:2;
      -webkit-box-orient:vertical; overflow:hidden;
    }
    .adm-p-price-old { font-size:9px; color:var(--muted); text-decoration:line-through; line-height:1; }
    .adm-p-price { font-size:13px; font-weight:900; color:var(--green); }
    .adm-p-price.desc { color:#EF4444; }
    .adm-p-stock { font-size:9px; font-weight:700; margin-top:2px; }
    .adm-p-stock.ok  { color:var(--green); }
    .adm-p-stock.low { color:#F59E0B; }
    .adm-p-stock.out { color:var(--red); }
  `;
  document.head.appendChild(st);
})();

// ══════════════════════════════════════════
// RENDER PRINCIPAL ADMIN
// ══════════════════════════════════════════
async function renderTiendaAdmin() {
  if (!CUR) return;

  const prodList = document.getElementById('biz-productos-list');
  const catList  = document.getElementById('biz-categorias-list');
  const datalist = document.getElementById('cat-list');

  prodList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--blue);">Cargando... ⏳</div>';

  try {
    const { data: productos, error } = await tiendaSupa
      .from('products').select('*')
      .eq('business_id', CUR.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    todosLosProductos = productos || [];

    const deBD = [...new Set(todosLosProductos.map(p => (p.category||'').trim()).filter(Boolean))];
    categoriasActuales = [...new Set([...deBD, ...categoriasActuales])].sort();

    if (datalist) datalist.innerHTML = categoriasActuales.map(c => `<option value="${c}">`).join('');

    renderPillsCategorias(catList, todosLosProductos);
    renderProductosAdmin(todosLosProductos);

  } catch (err) {
    console.error('Error tienda:', err);
    prodList.innerHTML = '<div style="text-align:center;color:var(--red);">Error conectando con la base de datos.</div>';
  }
}

// ══════════════════════════════════════════
// RENDER PRODUCTOS ADMIN — tren 3×3
// ══════════════════════════════════════════
function renderProductosAdmin(productos) {
  const prodList = document.getElementById('biz-productos-list');
  if (!prodList) return;

  prodList.style.display = 'block';
  prodList.style.gridTemplateColumns = 'none';

  prodList.innerHTML = `
    <div class="adm-search-wrap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" placeholder="Buscar producto por nombre..."
             oninput="filtrarProductosAdmin(this.value)"/>
    </div>
    <div id="adm-secciones"></div>`;

  renderSeccionesAdmin(productos);
}

function filtrarProductosAdmin(termino) {
  const text = termino.toLowerCase().trim();
  const filtrados = text
    ? todosLosProductos.filter(p => (p.name||'').toLowerCase().includes(text))
    : todosLosProductos;
  renderSeccionesAdmin(filtrados);
}

function renderSeccionesAdmin(productos) {
  const root = document.getElementById('adm-secciones');
  if (!root) return;

  if (!productos.length) {
    root.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--muted);font-size:13px;
           background:var(--card);border-radius:16px;border:1px dashed var(--b);">
        <div style="font-size:32px;margin-bottom:10px;">🔍</div>
        Sin resultados.
      </div>`;
    return;
  }

  let html = renderAdmSeccion('📦 Todos los productos', productos, null);

  const cats = [...new Set(productos.map(p=>(p.category||'').trim()).filter(Boolean))].sort();
  cats.forEach(cat => {
    const prods = productos.filter(p => (p.category||'').trim() === cat);
    html += renderAdmSeccion(cat, prods, cat);
  });

  root.innerHTML = html;
}

const ROWS = 3;

function renderAdmSeccion(titulo, productos, catKey) {
  if (!productos.length) return '';

  const cols = [];
  for (let i = 0; i < productos.length; i += ROWS) {
    cols.push(productos.slice(i, i + ROWS));
  }

  const colsHtml = cols.map(col =>
    `<div class="adm-tren-col">${col.map(p => renderAdmCard(p)).join('')}</div>`
  ).join('');

  const btnCatDesc = catKey
    ? `<span class="btn-cat-desc" onclick="abrirDescuentoCategoria('${catKey.replace(/'/g,"\\'")}')">
         🏷️ Descuento a categoría
       </span>`
    : '';

  return `
    <div class="adm-seccion">
      <div class="adm-seccion-hdr">
        ${titulo}
        <span class="cnt">${productos.length}</span>
        ${btnCatDesc}
      </div>
      <div class="adm-tren">${colsHtml}</div>
    </div>`;
}

function renderAdmCard(p) {
  const precio    = parseFloat(p.price) || 0;
  const desc      = parseFloat(p.discount_percent) || 0;
  const precioFin = desc > 0 ? precio * (1 - desc/100) : precio;
  const stock     = p.stock != null ? parseInt(p.stock) : null;
  const img       = p.image
    ? `<img src="${p.image}" loading="lazy" style="max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply;">`
    : `<div class="no-img">🛍️</div>`;

  const badgeDesc = desc > 0 ? `<div class="adm-p-desc-badge">-${Math.round(desc)}%</div>` : '';

  let precioHtml = desc > 0
    ? `<div class="adm-p-price-old">${money(precio)}</div>
       <div class="adm-p-price desc">${money(precioFin)}</div>`
    : `<div class="adm-p-price">${money(precio)}</div>`;

  let stockHtml = '';
  if (stock !== null) {
    if (stock <= 0)   stockHtml = '<div class="adm-p-stock out">Sin stock</div>';
    else if (stock<=5)stockHtml = `<div class="adm-p-stock low">Stock: ${stock}</div>`;
    else              stockHtml = `<div class="adm-p-stock ok">Stock: ${stock}</div>`;
  }

  return `
    <div class="adm-p-card" onclick="editProduct('${p.id}')">
      <div class="adm-p-img">
        ${badgeDesc}
        <div class="adm-p-actions">
          <button class="btn-edit" onclick="editProduct('${p.id}')" title="Editar">✏️</button>
          <button class="btn-del"  onclick="deleteProduct('${p.id}',event)" title="Eliminar">×</button>
        </div>
        ${img}
      </div>
      <div class="adm-p-info">
        <div class="adm-p-cat">${(p.category||'General').trim()}</div>
        <div class="adm-p-name">${p.name}</div>
        ${precioHtml}
        ${stockHtml}
      </div>
    </div>`;
}

// ══════════════════════════════════════════
// PILLS DE CATEGORÍAS
// ══════════════════════════════════════════
function renderPillsCategorias(catList, productos) {
  if (!catList) return;
  if (!categoriasActuales.length) {
    catList.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:6px 4px;font-style:italic;">
      Sin categorías — usa <strong>"+ Categoría"</strong> para crear la primera.
    </div>`;
    return;
  }
  catList.innerHTML = categoriasActuales.map(cat => {
    const count   = productos.filter(p => (p.category||'').trim() === cat).length;
    const safecat = cat.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return `
      <div onclick="abrirGestionCategoria('${safecat}')"
           style="display:inline-flex;align-items:center;gap:7px;background:var(--card);
                  border:1.5px solid var(--b);color:var(--text);padding:7px 14px;
                  border-radius:20px;font-size:12px;font-weight:700;flex-shrink:0;
                  cursor:pointer;transition:all .2s;user-select:none;"
           onmouseover="this.style.borderColor='var(--blue)';this.style.color='var(--blue)';"
           onmouseout="this.style.borderColor='var(--b)';this.style.color='var(--text)';">
        ${cat}
        <span style="background:rgba(74,127,212,.12);color:var(--blue);font-size:10px;
                     font-weight:800;padding:2px 6px;border-radius:8px;">${count}</span>
        <span style="font-size:12px;opacity:.4;">✏️</span>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════
// DESCUENTO POR CATEGORÍA
// ══════════════════════════════════════════
function abrirDescuentoCategoria(catNombre) {
  const ovId = 'ov-cat-desc';
  let ov = document.getElementById(ovId);
  if (!ov) {
    ov = document.createElement('div');
    ov.id = ovId; ov.className = 'ov';
    ov.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:320px;text-align:center;">
        <div class="mhdr">
          <span class="mttl" id="catdesc-titulo">Descuento de categoría</span>
          <div class="xbtn" onclick="closeOv('ov-cat-desc')">×</div>
        </div>
        <div style="font-size:13px;color:var(--t2);margin-bottom:6px;line-height:1.5" id="catdesc-info"></div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:18px;">Pon 0 para quitar el descuento a todos.</div>
        <div class="field" style="text-align:left;">
          <label>% de descuento (0 - 90)</label>
          <input class="inp" id="catdesc-input" type="number" min="0" max="90" step="1" placeholder="Ej: 20"/>
        </div>
        <div id="catdesc-preview" style="font-size:12px;color:var(--t2);margin-bottom:16px;"></div>
        <button class="btn btn-blue" id="catdesc-btn" onclick="aplicarDescuentoCategoria()" style="margin-bottom:10px;">
          Aplicar a todos los productos
        </button>
        <button class="btn btn-ghost" onclick="closeOv('ov-cat-desc')" style="font-size:13px;">Cancelar</button>
      </div>`;
    document.body.appendChild(ov);
    document.getElementById('catdesc-input').addEventListener('input', function() {
      const v = parseFloat(this.value) || 0;
      const prev = document.getElementById('catdesc-preview');
      if (v > 0) {
        prev.innerHTML = `Los clientes verán <strong style="color:#EF4444">-${Math.round(v)}%</strong> en cada producto de esta categoría.`;
      } else {
        prev.innerHTML = 'Se quitará el descuento de todos los productos.';
      }
    });
  }

  ov.dataset.cat = catNombre;
  const prods = todosLosProductos.filter(p => (p.category||'').trim() === catNombre);
  document.getElementById('catdesc-titulo').textContent = `Descuento: ${catNombre}`;
  document.getElementById('catdesc-info').innerHTML =
    `Aplicará el descuento a <strong style="color:var(--blue)">${prods.length} producto${prods.length!==1?'s':''}</strong> de esta categoría.`;
  document.getElementById('catdesc-input').value = '';
  document.getElementById('catdesc-preview').textContent = '';
  openOv(ovId);
  setTimeout(() => document.getElementById('catdesc-input').focus(), 150);
}

async function aplicarDescuentoCategoria() {
  const ov      = document.getElementById('ov-cat-desc');
  const cat     = ov.dataset.cat;
  const valor   = parseFloat(document.getElementById('catdesc-input').value);
  const btn     = document.getElementById('catdesc-btn');

  if (isNaN(valor) || valor < 0 || valor > 90) {
    mostrarAlertaTienda('Introduce un número entre 0 y 90.', 'Valor inválido', '⚠️'); return;
  }

  btn.textContent = 'Aplicando...'; btn.disabled = true;

  try {
    const { error } = await tiendaSupa
      .from('products').update({ discount_percent: valor })
      .eq('business_id', CUR.id).eq('category', cat);
    if (error) throw error;
    closeOv('ov-cat-desc');
    mostrarAlertaTienda(
      valor > 0
        ? `Descuento de ${Math.round(valor)}% aplicado a todos los productos de "${cat}".`
        : `Descuento eliminado de todos los productos de "${cat}".`,
      '¡Listo!', '🏷️'
    );
    renderTiendaAdmin();
  } catch (err) {
    console.error('Error aplicando descuento:', err);
    mostrarAlertaTienda('No se pudo aplicar el descuento.', 'Error', '❌');
  } finally {
    btn.textContent = 'Aplicar a todos los productos'; btn.disabled = false;
  }
}

// ══════════════════════════════════════════
// NUEVA CATEGORÍA
// ══════════════════════════════════════════
function abrirModalNuevaCategoria() {
  const ovId = 'ov-nueva-cat';
  let ov = document.getElementById(ovId);
  if (!ov) {
    ov = document.createElement('div');
    ov.id = ovId; ov.className = 'ov';
    ov.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:320px;text-align:center;">
        <div class="mhdr">
          <span class="mttl">Nueva Categoría</span>
          <div class="xbtn" onclick="closeOv('ov-nueva-cat')">×</div>
        </div>
        <div style="font-size:13px;color:var(--t2);margin-bottom:18px;line-height:1.5;">
          Ej: <em>Ceras, Carteras, Accesorios…</em>
        </div>
        <div class="field" style="text-align:left;">
          <label>Nombre *</label>
          <input class="inp" id="nueva-cat-input" placeholder="Nombre de la categoría"
                 maxlength="40" onkeydown="if(event.key==='Enter') guardarNuevaCategoria()"/>
        </div>
        <div id="nueva-cat-err" style="display:none;color:var(--red);font-size:12px;
             margin-bottom:12px;padding:10px;background:rgba(239,68,68,.07);
             border-radius:10px;text-align:left;"></div>
        <button class="btn btn-blue" onclick="guardarNuevaCategoria()" style="margin-bottom:10px;">Crear categoría</button>
        <button class="btn btn-ghost" onclick="closeOv('ov-nueva-cat')" style="font-size:13px;">Cancelar</button>
      </div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('nueva-cat-input').value = '';
  const err = document.getElementById('nueva-cat-err');
  err.style.display = 'none'; err.textContent = '';
  openOv(ovId);
  setTimeout(() => document.getElementById('nueva-cat-input').focus(), 150);
}

function guardarNuevaCategoria() {
  const input  = document.getElementById('nueva-cat-input');
  const errEl  = document.getElementById('nueva-cat-err');
  const nombre = input.value.trim();
  errEl.style.display = 'none';
  if (!nombre) {
    errEl.textContent = 'Escribe un nombre.'; errEl.style.display = 'block'; input.focus(); return;
  }
  if (categoriasActuales.some(c => c.toLowerCase() === nombre.toLowerCase())) {
    errEl.textContent = `"${nombre}" ya existe.`; errEl.style.display = 'block'; input.focus(); return;
  }
  categoriasActuales.push(nombre); categoriasActuales.sort();
  const datalist = document.getElementById('cat-list');
  if (datalist) datalist.innerHTML = categoriasActuales.map(c => `<option value="${c}">`).join('');
  renderPillsCategorias(document.getElementById('biz-categorias-list'), []);
  closeOv('ov-nueva-cat');
  mostrarAlertaTienda(`Categoría "${nombre}" creada.`, '¡Lista!', '🏷️');
}

// ══════════════════════════════════════════
// GESTIÓN DE CATEGORÍA
// ══════════════════════════════════════════
function abrirGestionCategoria(catNombre) {
  const ovId = 'ov-cat-manager';
  let ov = document.getElementById(ovId);
  if (!ov) {
    ov = document.createElement('div');
    ov.id = ovId; ov.className = 'ov';
    ov.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:340px;">
        <div class="mhdr">
          <span class="mttl" id="catm-title">Gestionar categoría</span>
          <div class="xbtn" onclick="closeOv('ov-cat-manager')">×</div>
        </div>
        <div style="font-size:13px;color:var(--t2);margin-bottom:18px;line-height:1.5" id="catm-info">Cargando...</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Renombrar</div>
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <input class="inp" id="catm-new-name" placeholder="Nuevo nombre..."
                 style="flex:1;margin-bottom:0;" maxlength="40"
                 onkeydown="if(event.key==='Enter') renombrarCategoria()"/>
          <button class="btn btn-blue btn-sm" style="width:auto;white-space:nowrap;padding:0 16px;"
                  onclick="renombrarCategoria()">Guardar</button>
        </div>
        <button class="btn btn-dark btn-sm" style="width:100%;margin-bottom:16px;"
                onclick="closeOv('ov-cat-manager');abrirDescuentoCategoria(document.getElementById('ov-cat-manager').dataset.catActual)">
          🏷️ Aplicar descuento a esta categoría
        </button>
        <div style="border-top:1px solid var(--b);margin-bottom:16px;"></div>
        <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:14px;padding:14px;">
          <div style="font-size:12px;font-weight:800;color:var(--red);margin-bottom:6px;">⚠️ Zona de peligro</div>
          <div style="font-size:12px;color:var(--t2);margin-bottom:12px;line-height:1.5" id="catm-delete-info"></div>
          <button class="btn btn-red btn-sm" style="width:100%;" onclick="iniciarEliminarCategoria()">Eliminar esta categoría</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
  ov.dataset.catActual = catNombre;
  document.getElementById('catm-title').textContent  = `Categoría: ${catNombre}`;
  document.getElementById('catm-new-name').value     = catNombre;
  document.getElementById('catm-info').textContent   = 'Contando productos...';
  document.getElementById('catm-delete-info').innerHTML =
    `Quitará <strong>"${catNombre}"</strong> de todos sus productos. Los productos <strong>no se borran</strong>.`;
  openOv(ovId);
  tiendaSupa.from('products')
    .select('id', { count:'exact', head:true })
    .eq('business_id', CUR.id).eq('category', catNombre)
    .then(({ count }) => {
      const el = document.getElementById('catm-info');
      if (el) el.innerHTML =
        `<strong style="color:var(--blue)">${count||0} producto${count!==1?'s':''}</strong> en esta categoría.`;
    });
}

async function renombrarCategoria() {
  const ov = document.getElementById('ov-cat-manager');
  const catVieja = ov.dataset.catActual;
  const catNueva = document.getElementById('catm-new-name').value.trim();
  if (!catNueva) { mostrarAlertaTienda('Escribe el nuevo nombre.','Vacío','✏️'); return; }
  if (catNueva === catVieja) { closeOv('ov-cat-manager'); return; }
  if (categoriasActuales.some(c => c.toLowerCase()===catNueva.toLowerCase() && c!==catVieja)) {
    mostrarAlertaTienda(`Ya existe "${catNueva}".`,'Duplicado','⚠️'); return;
  }
  try {
    const { error } = await tiendaSupa.from('products')
      .update({ category: catNueva }).eq('business_id', CUR.id).eq('category', catVieja);
    if (error) throw error;
    const idx = categoriasActuales.indexOf(catVieja);
    if (idx !== -1) { categoriasActuales[idx] = catNueva; categoriasActuales.sort(); }
    closeOv('ov-cat-manager');
    mostrarAlertaTienda(`"${catVieja}" → "${catNueva}".`,'¡Hecho!','✅');
    renderTiendaAdmin();
  } catch(err) { mostrarAlertaTienda('No se pudo renombrar.','Error','❌'); }
}

function iniciarEliminarCategoria() {
  const catNombre = document.getElementById('ov-cat-manager').dataset.catActual;
  closeOv('ov-cat-manager');
  confirmarAccionTienda(
    '¿Eliminar categoría?',
    `Quitará "${catNombre}" de todos sus productos. Los productos NO se borran. ¿Continuar?`,
    () => confirmarAccionTienda(
      '⚠️ Última confirmación',
      `¿Eliminar definitivamente "${catNombre}"? Esta acción no se puede deshacer.`,
      () => eliminarCategoria(catNombre)
    )
  );
}

async function eliminarCategoria(catNombre) {
  try {
    const { error } = await tiendaSupa.from('products')
      .update({ category: null }).eq('business_id', CUR.id).eq('category', catNombre);
    if (error) throw error;
    categoriasActuales = categoriasActuales.filter(c => c !== catNombre);
    mostrarAlertaTienda(`"${catNombre}" eliminada.`,'Eliminada','🗑️');
    renderTiendaAdmin();
  } catch(err) { mostrarAlertaTienda('No se pudo eliminar.','Error','❌'); }
}

// ══════════════════════════════════════════
// CRUD PRODUCTOS
// ══════════════════════════════════════════
function openProdModal() {
  if (!categoriasActuales.length) {
    mostrarAlertaTienda('Primero crea una categoría con el botón "+ Categoría".','Sin categorías','🏷️');
    return;
  }
  editingProdId = null;
  document.getElementById('prod-name').value    = '';
  document.getElementById('prod-price').value   = '';
  document.getElementById('prod-desc').value    = '';
  document.getElementById('prod-cat').value     = '';
  const stockEl = document.getElementById('prod-stock');
  const descEl  = document.getElementById('prod-discount');
  if (stockEl) stockEl.value   = '';
  if (descEl)  descEl.value    = '0';
  tempProdPhotos = [];
  renderProdPhotoPreview();
  
  // Asignar el listener de forma segura aquí
  const fileInput = document.getElementById('prod-photo-input');
  if (fileInput && !fileInput.dataset.listener) {
    fileInput.dataset.listener = 'true';
    fileInput.addEventListener('change', async function(e) {
      if (tempProdPhotos.length >= 3) return;
      const f = e.target.files[0]; if (!f) return;
      document.getElementById('prod-photo-preview').innerHTML =
        '<span style="color:var(--blue);font-weight:700;">Subiendo... ⏳</span>';
      if (typeof uploadToImgBB === 'function') {
        const url = await uploadToImgBB(f);
        if (url) {
          tempProdPhotos.push(url);
          renderProdPhotoPreview();
        } else {
          document.getElementById('prod-photo-preview').innerHTML =
            '<span style="color:var(--red);font-size:12px;">Error al subir foto</span>';
        }
      }
      fileInput.value = ''; // Reset input
    });
  }

  openOv('ov-tienda-prod');
}

async function editProduct(id) {
  try {
    const { data, error } = await tiendaSupa.from('products').select('*').eq('id', id).single();
    if (error) throw error;
    if (!data) return;
    editingProdId = id;
    document.getElementById('prod-name').value  = data.name;
    document.getElementById('prod-price').value = data.price;
    document.getElementById('prod-desc').value  = data.description || '';
    document.getElementById('prod-cat').value   = (data.category||'').trim();
    const stockEl = document.getElementById('prod-stock');
    const descEl  = document.getElementById('prod-discount');
    if (stockEl) stockEl.value = data.stock != null ? data.stock : '';
    if (descEl)  descEl.value  = data.discount_percent || 0;
    tempProdPhotos = window.parseFotos ? window.parseFotos(data.image) : (data.image ? [data.image] : []);
    renderProdPhotoPreview();
    openOv('ov-tienda-prod');
  } catch(err) {
    mostrarAlertaTienda('No pudimos cargar el producto.','Error','❌');
  }
}

// Función para renderizar el preview de fotos
window.removeProdPhoto = function(index, event) {
  event.stopPropagation();
  tempProdPhotos.splice(index, 1);
  renderProdPhotoPreview();
};

function renderProdPhotoPreview() {
  const container = document.getElementById('prod-photo-preview');
  if (!tempProdPhotos.length) {
    container.innerHTML = '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
    container.onclick = () => document.getElementById('prod-photo-input').click();
    container.classList.add('photo-upload');
    container.style.padding = '';
    container.style.border = '';
    container.style.background = '';
    container.style.cursor = '';
    return;
  }
  
  container.onclick = null;
  container.classList.remove('photo-upload');
  container.style.cursor = 'default';
  container.style.padding = '12px';
  container.style.border = '1px solid var(--b)';
  container.style.background = 'transparent';

  let html = '<div style="display:flex;gap:8px;flex-wrap:wrap;width:100%;">';
  tempProdPhotos.forEach((url, i) => {
    html += `
      <div style="position:relative; width:60px; height:60px; border-radius:8px; overflow:hidden; border:1px solid var(--b);">
        <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
        <div onclick="removeProdPhoto(${i}, event)" style="position:absolute; top:2px; right:2px; background:rgba(239,68,68,0.9); color:#fff; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; font-weight:bold; z-index:10;">×</div>
      </div>
    `;
  });
  if (tempProdPhotos.length < 3) {
    html += `
      <div style="width:60px; height:60px; border-radius:8px; border:1px dashed var(--b); display:flex; align-items:center; justify-content:center; color:var(--muted); cursor:pointer; font-size:20px;" onclick="document.getElementById('prod-photo-input').click()">+</div>
    `;
  }
  html += '</div>';
  container.innerHTML = html;
}

// Asegurar parseFotos global
window.parseFotos = function(imgData) {
  if (!imgData) return [];
  try {
    const arr = JSON.parse(imgData);
    if (Array.isArray(arr)) return arr;
  } catch(e) {}
  return [imgData];
};

// (El listener se movió a openProdModal para evitar errores si el HTML no está cargado)

async function saveProduct() {
  const name     = document.getElementById('prod-name').value.trim();
  const price    = parseFloat(document.getElementById('prod-price').value);
  const desc     = document.getElementById('prod-desc').value.trim();
  const cat      = document.getElementById('prod-cat').value.trim() || 'General';
  const stockEl  = document.getElementById('prod-stock');
  const descEl   = document.getElementById('prod-discount');
  const stock    = stockEl ? (stockEl.value !== '' ? parseInt(stockEl.value) : 0) : 0;
  const discount = descEl  ? (parseFloat(descEl.value) || 0) : 0;

  if (!name || isNaN(price)) {
    mostrarAlertaTienda('El nombre y el precio son obligatorios.','Faltan datos','💰'); return;
  }

  const finalImageStr = tempProdPhotos.length > 0 ? JSON.stringify(tempProdPhotos) : '';

  const productoData = {
    business_id: CUR.id, name, description: desc, price,
    stock, discount_percent: discount,
    image: finalImageStr, category: cat
  };

  try {
    if (editingProdId) {
      const { error } = await tiendaSupa.from('products').update(productoData).eq('id', editingProdId);
      if (error) throw error;
      mostrarAlertaTienda('Producto actualizado.','¡Listo!','✏️');
    } else {
      productoData.id     = crypto.randomUUID ? crypto.randomUUID() : ('prod_'+Math.random().toString(36).slice(2));
      productoData.rating = 0;
      const { error } = await tiendaSupa.from('products').insert([productoData]);
      if (error) throw error;
      mostrarAlertaTienda('Producto publicado.','¡Éxito!','✅');
    }
    renderTiendaAdmin();
    closeOv('ov-tienda-prod');
  } catch(err) {
    console.error('Error guardando:', err);
    mostrarAlertaTienda('Error al guardar. Revisa tu conexión.','Error','❌');
  }
}

function deleteProduct(id, event) {
  event.stopPropagation();
  confirmarAccionTienda(
    'Eliminar Producto',
    '¿Seguro que quieres eliminar este producto permanentemente?',
    async () => {
      try {
        const { error } = await tiendaSupa.from('products').delete().eq('id', id);
        if (error) throw error;
        renderTiendaAdmin();
      } catch(err) { mostrarAlertaTienda('No se pudo eliminar.','Error','❌'); }
    }
  );
}

// ══════════════════════════════════════════
// ENGANCHE DE TABS
// ══════════════════════════════════════════
const fnOriginalBizTab = window.bizTab;
window.bizTab = function(tab) {
  if (fnOriginalBizTab) fnOriginalBizTab(tab);
  if (tab === 'tienda') renderTiendaAdmin();
};