// script-tienda.js — CitasPro Tienda
// Categorías viven en el campo category de la tabla products.
// NO requiere tabla adicional en Supabase.

const SUPABASE_URL      = 'https://krbtoepzoorpdedtykug.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IXquO0XEbEkFBmZgblzjVg_adtTWCW-';
const tiendaSupa        = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let tempProdPhoto      = null;
let editingProdId      = null;
let categoriasActuales = []; // strings planos ["Ceras","Carteras"...]

// ─────────────────────────────────────────
// ALERTAS
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────
async function renderTiendaAdmin() {
  if (!CUR) return;

  const prodList = document.getElementById('biz-productos-list');
  const catList  = document.getElementById('biz-categorias-list');
  const datalist = document.getElementById('cat-list');

  prodList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--blue);">Cargando... ⏳</div>';

  try {
    const { data: productos, error } = await tiendaSupa
      .from('products')
      .select('*')
      .eq('business_id', CUR.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Extraer categorías únicas de los productos existentes
    // + las que estén en el cache local (creadas pero sin productos aún)
    const deBD = [...new Set(
      (productos || []).map(p => (p.category || '').trim()).filter(Boolean)
    )];
    // Merge con cache local (puede tener categorías nuevas sin productos aún)
    categoriasActuales = [...new Set([...deBD, ...categoriasActuales])].sort();

    // Datalist para el input de producto
    if (datalist) {
      datalist.innerHTML = categoriasActuales.map(c => `<option value="${c}">`).join('');
    }

    // Pills de categorías
    renderPillsCategorias(catList, productos || []);

    // Sin productos
    if (!productos || productos.length === 0) {
      prodList.innerHTML = categoriasActuales.length === 0
        ? `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);
               font-size:13px;background:var(--card);border-radius:16px;border:1px dashed var(--b);">
             <div style="font-size:36px;margin-bottom:12px;">🏷️</div>
             Primero crea una categoría con <strong>"+ Categoría"</strong><br>
             y luego añade tus productos.
           </div>`
        : `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);
               font-size:13px;background:var(--card);border-radius:16px;border:1px dashed var(--b);">
             <div style="font-size:36px;margin-bottom:12px;">📦</div>
             Aún no tienes productos. ¡Añade el primero!
           </div>`;
      return;
    }

    // Tarjetas de producto
    prodList.innerHTML = productos.map(p => {
      const img = p.image
        ? `<img src="${p.image}" style="max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply;border-radius:8px;">`
        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:28px;">🛍️</div>`;
      const precio  = parseFloat(p.price).toFixed(2);
      const catName = (p.category || 'Sin categoría').trim();
      return `
        <div onclick="editProduct('${p.id}')"
             style="background:#fff;border:1px solid var(--b);border-radius:16px;padding:10px;
                    position:relative;display:flex;flex-direction:column;
                    box-shadow:0 4px 10px rgba(0,0,0,.04);cursor:pointer;transition:transform .2s;">
          <button onclick="deleteProduct('${p.id}',event)"
                  style="position:absolute;top:6px;right:6px;background:rgba(239,68,68,.1);
                         color:var(--red);width:26px;height:26px;border-radius:50%;
                         display:flex;align-items:center;justify-content:center;
                         z-index:2;font-weight:bold;border:none;cursor:pointer;">×</button>
          <button onclick="editProduct('${p.id}')"
                  style="position:absolute;top:6px;right:36px;background:rgba(74,127,212,.1);
                         color:var(--blue);width:26px;height:26px;border-radius:50%;
                         display:flex;align-items:center;justify-content:center;
                         z-index:2;font-size:13px;border:none;cursor:pointer;">✏️</button>
          <div style="width:100%;height:100px;background:#F8FAFC;border-radius:12px;
                      margin-bottom:10px;display:flex;justify-content:center;
                      align-items:center;overflow:hidden;">${img}</div>
          <div style="align-self:flex-start;font-size:9px;color:var(--blue);font-weight:800;
                      background:rgba(74,127,212,.1);padding:4px 8px;border-radius:8px;
                      text-transform:uppercase;margin-bottom:6px;">${catName}</div>
          <div style="font-size:13px;font-weight:800;color:#0F172A;line-height:1.25;flex:1;
                      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
                      overflow:hidden;margin-bottom:6px;">${p.name}</div>
          <div style="font-size:16px;font-weight:900;color:var(--green);margin-top:auto;">${precio}€</div>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('Error tienda:', err);
    prodList.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--red);">Error conectando con la base de datos.</div>';
  }
}

function renderPillsCategorias(catList, productos) {
  if (!catList) return;
  if (categoriasActuales.length === 0) {
    catList.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:6px 4px;font-style:italic;">
      Sin categorías — usa <strong>"+ Categoría"</strong> para crear la primera.
    </div>`;
    return;
  }
  catList.innerHTML = categoriasActuales.map(cat => {
    const count   = productos.filter(p => (p.category || '').trim() === cat).length;
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

// ─────────────────────────────────────────
// NUEVA CATEGORÍA — solo cache local + datalist
// Se persiste en BD automáticamente al crear el primer producto con esa categoría
// ─────────────────────────────────────────
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
          Ej: <em>Ceras, Carteras, Accesorios, Ropa…</em>
        </div>
        <div class="field" style="text-align:left;">
          <label>Nombre *</label>
          <input class="inp" id="nueva-cat-input" placeholder="Nombre de la categoría"
                 maxlength="40" onkeydown="if(event.key==='Enter') guardarNuevaCategoria()"/>
        </div>
        <div id="nueva-cat-err" style="display:none;color:var(--red);font-size:12px;
             margin-bottom:12px;padding:10px;background:rgba(239,68,68,.07);
             border-radius:10px;text-align:left;"></div>
        <button class="btn btn-blue" id="nueva-cat-btn" onclick="guardarNuevaCategoria()"
                style="margin-bottom:10px;">Crear categoría</button>
        <button class="btn btn-ghost" onclick="closeOv('ov-nueva-cat')"
                style="font-size:13px;">Cancelar</button>
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
    errEl.textContent = 'Escribe un nombre para la categoría.';
    errEl.style.display = 'block'; input.focus(); return;
  }
  if (categoriasActuales.some(c => c.toLowerCase() === nombre.toLowerCase())) {
    errEl.textContent = `La categoría "${nombre}" ya existe.`;
    errEl.style.display = 'block'; input.focus(); return;
  }

  // Añadir al cache local y refrescar UI
  categoriasActuales.push(nombre);
  categoriasActuales.sort();

  // Actualizar datalist
  const datalist = document.getElementById('cat-list');
  if (datalist) datalist.innerHTML = categoriasActuales.map(c => `<option value="${c}">`).join('');

  // Refrescar pills (sin productos aún, count = 0)
  const catList = document.getElementById('biz-categorias-list');
  renderPillsCategorias(catList, []);

  closeOv('ov-nueva-cat');
  mostrarAlertaTienda(
    `Categoría "${nombre}" creada. Ahora añade productos con esta categoría y se guardará en la base de datos.`,
    '¡Lista!', '🏷️'
  );
}

// ─────────────────────────────────────────
// GESTIÓN DE CATEGORÍA — click en pill
// ─────────────────────────────────────────
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
        <div style="font-size:13px;color:var(--t2);margin-bottom:18px;line-height:1.5"
             id="catm-info">Cargando...</div>
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:8px;">Renombrar</div>
        <div style="display:flex;gap:8px;margin-bottom:20px;">
          <input class="inp" id="catm-new-name" placeholder="Nuevo nombre..."
                 style="flex:1;margin-bottom:0;" maxlength="40"
                 onkeydown="if(event.key==='Enter') renombrarCategoria()"/>
          <button class="btn btn-blue btn-sm"
                  style="width:auto;white-space:nowrap;padding:0 16px;"
                  onclick="renombrarCategoria()">Guardar</button>
        </div>
        <div style="border-top:1px solid var(--b);margin-bottom:16px;"></div>
        <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);
                    border-radius:14px;padding:14px;">
          <div style="font-size:12px;font-weight:800;color:var(--red);margin-bottom:6px;">⚠️ Zona de peligro</div>
          <div style="font-size:12px;color:var(--t2);margin-bottom:12px;line-height:1.5"
               id="catm-delete-info"></div>
          <button class="btn btn-red btn-sm" style="width:100%;"
                  onclick="iniciarEliminarCategoria()">Eliminar esta categoría</button>
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

  // Contar productos en Supabase
  tiendaSupa.from('products')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', CUR.id)
    .eq('category', catNombre)
    .then(({ count }) => {
      const el = document.getElementById('catm-info');
      if (el) el.innerHTML =
        `Esta categoría tiene <strong style="color:var(--blue)">${count || 0} producto${count !== 1 ? 's' : ''}</strong>.`;
    });
}

async function renombrarCategoria() {
  const ov       = document.getElementById('ov-cat-manager');
  const catVieja = ov.dataset.catActual;
  const catNueva = document.getElementById('catm-new-name').value.trim();

  if (!catNueva) { mostrarAlertaTienda('Escribe el nuevo nombre.', 'Vacío', '✏️'); return; }
  if (catNueva === catVieja) { closeOv('ov-cat-manager'); return; }
  if (categoriasActuales.some(c => c.toLowerCase() === catNueva.toLowerCase() && c !== catVieja)) {
    mostrarAlertaTienda(`Ya existe "${catNueva}".`, 'Duplicado', '⚠️'); return;
  }

  try {
    // Actualizar campo category en todos los productos afectados
    const { error } = await tiendaSupa
      .from('products')
      .update({ category: catNueva })
      .eq('business_id', CUR.id)
      .eq('category', catVieja);
    if (error) throw error;

    // Actualizar cache local
    const idx = categoriasActuales.indexOf(catVieja);
    if (idx !== -1) { categoriasActuales[idx] = catNueva; categoriasActuales.sort(); }

    closeOv('ov-cat-manager');
    mostrarAlertaTienda(`"${catVieja}" renombrada a "${catNueva}".`, '¡Hecho!', '✅');
    renderTiendaAdmin();
  } catch (err) {
    console.error('Error renombrando:', err);
    mostrarAlertaTienda('No se pudo renombrar.', 'Error', '❌');
  }
}

function iniciarEliminarCategoria() {
  const ov        = document.getElementById('ov-cat-manager');
  const catNombre = ov.dataset.catActual;
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
    const { error } = await tiendaSupa
      .from('products')
      .update({ category: null })
      .eq('business_id', CUR.id)
      .eq('category', catNombre);
    if (error) throw error;

    // Quitar del cache local
    categoriasActuales = categoriasActuales.filter(c => c !== catNombre);

    mostrarAlertaTienda(`Categoría "${catNombre}" eliminada.`, 'Eliminada', '🗑️');
    renderTiendaAdmin();
  } catch (err) {
    console.error('Error eliminando:', err);
    mostrarAlertaTienda('No se pudo eliminar.', 'Error', '❌');
  }
}

// ─────────────────────────────────────────
// CRUD PRODUCTOS
// ─────────────────────────────────────────
function openProdModal() {
  if (categoriasActuales.length === 0) {
    mostrarAlertaTienda(
      'Primero crea al menos una categoría con el botón "+ Categoría".',
      'Sin categorías', '🏷️'
    );
    return;
  }
  editingProdId = null;
  document.getElementById('prod-name').value  = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-desc').value  = '';
  document.getElementById('prod-cat').value   = '';
  tempProdPhoto = null;
  document.getElementById('prod-photo-preview').innerHTML =
    '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
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
    document.getElementById('prod-cat').value   = (data.category || '').trim();
    tempProdPhoto = data.image;
    document.getElementById('prod-photo-preview').innerHTML = data.image
      ? `<img src="${data.image}" style="width:100%;height:80px;object-fit:cover;border-radius:12px;">`
      : '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
    openOv('ov-tienda-prod');
  } catch (err) {
    console.error('Error cargando producto:', err);
    mostrarAlertaTienda('No pudimos cargar el producto.', 'Error', '❌');
  }
}

document.getElementById('prod-photo-input').addEventListener('change', async function(e) {
  const f = e.target.files[0]; if (!f) return;
  document.getElementById('prod-photo-preview').innerHTML =
    '<span style="color:var(--blue);font-weight:700;">Subiendo... ⏳</span>';
  if (typeof uploadToImgBB === 'function') {
    const url = await uploadToImgBB(f);
    if (url) {
      tempProdPhoto = url;
      document.getElementById('prod-photo-preview').innerHTML =
        `<img src="${url}" style="width:100%;height:80px;object-fit:cover;border-radius:12px;">`;
    } else {
      document.getElementById('prod-photo-preview').innerHTML =
        '<span style="color:var(--red);font-size:12px;">Error al subir foto</span>';
    }
  }
});

async function saveProduct() {
  const name  = document.getElementById('prod-name').value.trim();
  const price = parseFloat(document.getElementById('prod-price').value);
  const desc  = document.getElementById('prod-desc').value.trim();
  const cat   = document.getElementById('prod-cat').value.trim() || 'General';

  if (!name || isNaN(price)) {
    mostrarAlertaTienda('El nombre y el precio son obligatorios.', 'Faltan datos', '💰'); return;
  }

  const productoData = {
    business_id: CUR.id, name, description: desc, price, stock: 100,
    image: tempProdPhoto || '', category: cat
  };

  try {
    if (editingProdId) {
      const { error } = await tiendaSupa.from('products').update(productoData).eq('id', editingProdId);
      if (error) throw error;
      mostrarAlertaTienda('Producto actualizado.', '¡Listo!', '✏️');
    } else {
      productoData.id = crypto.randomUUID ? crypto.randomUUID() : ('prod_' + Math.random().toString(36).slice(2));
      productoData.rating = 0; productoData.reviews_count = 0;
      const { error } = await tiendaSupa.from('products').insert([productoData]);
      if (error) throw error;
      mostrarAlertaTienda('Producto publicado.', '¡Éxito!', '✅');
    }
    renderTiendaAdmin();
    closeOv('ov-tienda-prod');
  } catch (err) {
    console.error('Error guardando:', err);
    mostrarAlertaTienda('Error al guardar. Revisa tu conexión.', 'Error', '❌');
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
      } catch (err) {
        console.error('Error borrando:', err);
        mostrarAlertaTienda('No se pudo eliminar.', 'Error', '❌');
      }
    }
  );
}

// ─────────────────────────────────────────
// ENGANCHE DE TABS
// ─────────────────────────────────────────
const fnOriginalBizTab = window.bizTab;
window.bizTab = function(tab) {
  if (fnOriginalBizTab) fnOriginalBizTab(tab);
  if (tab === 'tienda') renderTiendaAdmin();
};