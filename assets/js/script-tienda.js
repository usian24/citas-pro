let tempProdPhoto = null;
let editingProdId = null;

// Catálogo de Íconos Profesionales (SVG) para las categorías
const ICONOS_CAT = {
  todo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
  rostro: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
  locion: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><circle cx="12" cy="14" r="4"></circle><line x1="12" y1="6" x2="12.01" y2="6"></line></svg>`,
  corte: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>`,
  barba: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13c0 5 4 9 9 9s9-4 9-9"></path><path d="M12 22a8.5 8.5 0 0 0 7-5.5"></path><path d="M5 16.5A8.5 8.5 0 0 1 12 22"></path><path d="M9 9h6"></path><path d="M12 6v3"></path></svg>`,
  gel: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31"></path><path d="M14 9.3V1.99"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><path d="M5.52 16h12.96"></path></svg>`,
  equipo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
};

// --- FUNCIONES DE VENTANAS FLOTANTES PROFESIONALES ---
function mostrarAlertaTienda(mensaje, titulo = "Aviso", icono = "⚠️") {
  document.getElementById('ta-icon').innerText = icono;
  document.getElementById('ta-title').innerText = titulo;
  document.getElementById('ta-msg').innerText = mensaje;
  openOv('ov-tienda-alert');
}

function confirmarAccionTienda(titulo, mensaje, onConfirm) {
  document.getElementById('confirm-title').innerText = titulo;
  document.getElementById('confirm-msg').innerText = mensaje;
  
  let btnOk = document.getElementById('confirm-ok-btn');
  let btnCancel = document.getElementById('confirm-cancel-btn');
  
  let newBtnOk = btnOk.cloneNode(true);
  btnOk.parentNode.replaceChild(newBtnOk, btnOk);
  let newBtnCancel = btnCancel.cloneNode(true);
  btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
  
  newBtnOk.onclick = () => { closeOv('ov-confirm'); onConfirm(); };
  newBtnCancel.onclick = () => { closeOv('ov-confirm'); };
  
  openOv('ov-confirm');
}

// -----------------------------------------------------

// 1. DIBUJAR TODO (Admin)
async function renderTiendaAdmin() {
  if (!CUR) return;
  if (!CUR.categories) CUR.categories = [];

  // Pintar Categorías
  const catList = document.getElementById('biz-categorias-list');
  if (CUR.categories.length === 0) {
    catList.innerHTML = '<div style="width:100%;text-align:center;color:var(--muted);font-size:12px;padding:10px;">Crea tu primera categoría</div>';
  } else {
    catList.innerHTML = CUR.categories.map(c => {
      let sv = ICONOS_CAT[c.iconCode] || ICONOS_CAT['equipo'];
      return `
      <div style="background:var(--card);border:1px solid var(--b);border-radius:16px;padding:8px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
        <span style="color:var(--blue);display:flex;align-items:center;">${sv}</span>
        <span style="font-size:13px;font-weight:700">${c.name}</span>
        <button onclick="deleteCategory('${c.id}')" style="color:var(--red);font-size:16px;margin-left:6px;font-weight:bold;background:none;border:none;cursor:pointer;">×</button>
      </div>
    `}).join('');
  }

  // Buscar y Pintar Productos desde Supabase
  const prodList = document.getElementById('biz-productos-list');
  prodList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--blue);">Cargando productos... ⏳</div>';

  try {
    const { data: productosSupabase, error } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', CUR.id);

    if (error) throw error;

    if (!productosSupabase || productosSupabase.length === 0) {
      prodList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted);font-size:13px">Sin productos. ¡Añade el primero!</div>';
      return;
    }

    prodList.innerHTML = productosSupabase.map(p => {
      let cat = CUR.categories.find(c => c.id === p.category);
      let catName = cat ? cat.name : 'Sin categoría';
      let catIcon = cat ? (ICONOS_CAT[cat.iconCode] || ICONOS_CAT['equipo']) : '';
      
      let img = p.image ? `<img src="${p.image}" style="width:100%;height:100px;object-fit:contain;mix-blend-mode:multiply;">` : `<div style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--muted)">Sin foto</div>`;
      let finalPrice = p.discount > 0 ? (p.price - (p.price * p.discount / 100)).toFixed(2) : parseFloat(p.price).toFixed(2);
      let badge = p.discount > 0 ? `<span style="position:absolute;top:6px;left:6px;background:var(--red);color:#fff;font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;">-${p.discount}%</span>` : '';

      return `
      <div style="background:#fff;border:1px solid var(--b);border-radius:16px;padding:10px;position:relative;display:flex;flex-direction:column;box-shadow:0 4px 10px rgba(0,0,0,0.05);">
        ${badge}
        <button onclick="deleteProduct('${p.id}')" style="position:absolute;top:6px;right:6px;background:rgba(239,68,68,0.1);color:var(--red);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:bold;border:none;cursor:pointer;">×</button>
        <button onclick="editProduct('${p.id}')" style="position:absolute;top:6px;right:34px;background:rgba(74,127,212,0.1);color:var(--blue);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:2;font-size:12px;border:none;cursor:pointer;">✏️</button>
        <div style="width:100%;background:#F8FAFC;border-radius:12px;margin-bottom:10px;display:flex;justify-content:center;align-items:center;">
           ${img}
        </div>
        <div style="font-size:9px;color:var(--blue);font-weight:800;text-transform:uppercase;display:flex;align-items:center;gap:4px;">
           <span style="width:12px;height:12px;">${catIcon}</span> ${catName}
        </div>
        <div style="font-size:12px;font-weight:800;color:#0F172A;line-height:1.2;margin:4px 0;flex:1;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.name}</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:4px;">
          <span style="font-size:16px;font-weight:900;color:var(--green)">${finalPrice}€</span>
          ${p.discount > 0 ? `<span style="font-size:10px;color:var(--muted);text-decoration:line-through">${parseFloat(p.price).toFixed(2)}€</span>` : ''}
        </div>
      </div>
      `;
    }).join('');

  } catch (err) {
    console.error("Error cargando productos:", err);
    prodList.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--red);">Error al cargar productos.</div>';
  }
}

// 2. FUNCIONES CATEGORÍA
function openCatModal() {
  document.getElementById('cat-name').value = '';
  document.getElementById('cat-icon-sel').value = 'equipo';
  openOv('ov-tienda-cat');
}

function saveCategory() {
  let name = document.getElementById('cat-name').value.trim();
  let iconCode = document.getElementById('cat-icon-sel').value;
  
  if (!name) { 
    mostrarAlertaTienda('Por favor, ingresa un nombre para tu categoría.', 'Faltan datos', '✍️'); 
    return; 
  }
  if (!CUR.categories) CUR.categories = [];
  
  CUR.categories.push({ id: 'cat_' + Date.now(), name: name, iconCode: iconCode });
  saveDB(); renderTiendaAdmin(); closeOv('ov-tienda-cat');
}

function deleteCategory(id) {
  confirmarAccionTienda(
    'Eliminar Categoría', 
    '¿Estás seguro? Los productos que estén dentro de esta categoría quedarán marcados como "Sin categoría".', 
    () => {
      CUR.categories = CUR.categories.filter(c => c.id !== id);
      saveDB(); renderTiendaAdmin();
    }
  );
}

// 3. FUNCIONES PRODUCTO (CRUD)
function openProdModal() {
  if (!CUR.categories || CUR.categories.length === 0) {
    mostrarAlertaTienda('¡Primero debes crear al menos una categoría para poder subir productos!', 'Crea una categoría', '📂');
    return;
  }
  editingProdId = null;
  
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-disc').value = '';
  document.getElementById('prod-desc').value = '';
  
  let sel = document.getElementById('prod-cat');
  sel.innerHTML = CUR.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  
  tempProdPhoto = null;
  document.getElementById('prod-photo-preview').innerHTML = '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
  
  openOv('ov-tienda-prod');
}

async function editProduct(id) {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) throw error;
    if (!data) return;

    editingProdId = id; 
    
    document.getElementById('prod-name').value = data.name;
    document.getElementById('prod-price').value = data.price;
    document.getElementById('prod-disc').value = data.discount || 0; // Usar el descuento de la DB si lo metes luego
    document.getElementById('prod-desc').value = data.description || '';
    
    let sel = document.getElementById('prod-cat');
    sel.innerHTML = CUR.categories.map(c => `<option value="${c.id}" ${c.id === data.category ? 'selected' : ''}>${c.name}</option>`).join('');
    
    tempProdPhoto = data.image;
    if (data.image) {
      document.getElementById('prod-photo-preview').innerHTML = `<img src="${data.image}" style="width:100%;height:80px;object-fit:cover;border-radius:12px;">`;
    } else {
      document.getElementById('prod-photo-preview').innerHTML = '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
    }
    
    openOv('ov-tienda-prod');
  } catch (err) {
    console.error("Error al cargar producto para editar:", err);
    mostrarAlertaTienda('No pudimos cargar los datos del producto.', 'Error', '❌');
  }
}

document.getElementById('prod-photo-input').addEventListener('change', async function(e) {
  let f = e.target.files[0];
  if (!f) return;
  document.getElementById('prod-photo-preview').innerHTML = '<span style="color:var(--blue);font-weight:700;">Subiendo... ⏳</span>';
  
  if (typeof uploadToImgBB === 'function') {
    let url = await uploadToImgBB(f);
    if (url) {
      tempProdPhoto = url;
      document.getElementById('prod-photo-preview').innerHTML = `<img src="${url}" style="width:100%;height:80px;object-fit:cover;border-radius:12px;">`;
    }
  } else {
    tempProdPhoto = "https://placehold.co/300x300/ffffff/4A7FD4?text=Producto";
    document.getElementById('prod-photo-preview').innerHTML = `<img src="${tempProdPhoto}" style="width:100%;height:80px;object-fit:cover;border-radius:12px;">`;
  }
});

async function saveProduct() {
  let name = document.getElementById('prod-name').value.trim();
  let price = parseFloat(document.getElementById('prod-price').value);
  let cat = document.getElementById('prod-cat').value;
  let desc = document.getElementById('prod-desc').value.trim();
  // Nota: Guardamos el descuento en DB localmente por ahora si no agregaste la columna a Supabase
  // let disc = parseInt(document.getElementById('prod-disc').value) || 0; 
  
  if (!name || isNaN(price)) { 
    mostrarAlertaTienda('El nombre y el precio son obligatorios.', 'Faltan datos', '💰'); 
    return; 
  }

  const productoData = {
    business_id: CUR.id,
    name: name,
    description: desc,
    price: price,
    stock: 100, 
    image: tempProdPhoto || '',
    category: cat
  };

  try {
    if (editingProdId) {
      const { error } = await supabase.from('products').update(productoData).eq('id', editingProdId);
      if (error) throw error;
      mostrarAlertaTienda('El producto fue modificado correctamente.', '¡Actualizado!', '✏️');
    } else {
      productoData.id = 'prod_' + Date.now();
      productoData.rating = 0;
      productoData.reviews_count = 0;
      
      const { error } = await supabase.from('products').insert([productoData]);
      if (error) throw error;
      mostrarAlertaTienda('Tu producto se ha guardado exitosamente.', '¡Éxito!', '✅');
    }

    renderTiendaAdmin(); 
    closeOv('ov-tienda-prod');
  } catch (err) {
    console.error("Error guardando en Supabase:", err);
    mostrarAlertaTienda('Hubo un error al conectar con la base de datos.', 'Error', '❌');
  }
}

function deleteProduct(id) {
  confirmarAccionTienda(
    'Eliminar Producto', 
    '¿Estás seguro de que deseas eliminar este producto de la base de datos?', 
    async () => {
      try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        renderTiendaAdmin();
      } catch (err) {
        console.error("Error borrando:", err);
        mostrarAlertaTienda('No se pudo eliminar el producto.', 'Error', '❌');
      }
    }
  );
}

// 4. ENGANCHAR AL SISTEMA DE TABS
const fnOriginalBizTab = window.bizTab;
window.bizTab = function(tab) {
  if (fnOriginalBizTab) fnOriginalBizTab(tab); 
  if (tab === 'tienda') renderTiendaAdmin();   
}