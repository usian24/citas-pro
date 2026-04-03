let tempProdPhoto = null;

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
  
  // Clonar botones para limpiar eventos anteriores
  let newBtnOk = btnOk.cloneNode(true);
  btnOk.parentNode.replaceChild(newBtnOk, btnOk);
  let newBtnCancel = btnCancel.cloneNode(true);
  btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
  
  newBtnOk.onclick = () => { closeOv('ov-confirm'); onConfirm(); };
  newBtnCancel.onclick = () => { closeOv('ov-confirm'); };
  
  openOv('ov-confirm');
}

// -----------------------------------------------------

// 1. DIBUJAR TODO
// En tu archivo script-tienda.js

async function renderTiendaAdmin() {
  if (!CUR) return;
  if (!CUR.categories) CUR.categories = []; // Mantenemos las categorías en el perfil por simplicidad

  // 1. Pintar Categorías (esto se queda igual)
  const catList = document.getElementById('biz-categorias-list');
  if (CUR.categories.length === 0) {
    catList.innerHTML = '<div style="width:100%;text-align:center;color:var(--muted);font-size:12px;padding:10px;">Crea tu primera categoría</div>';
  } else {
    catList.innerHTML = CUR.categories.map(c => `
      <div style="background:var(--card);border:1px solid var(--b);border-radius:16px;padding:8px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
        <span style="font-size:22px">${c.icon}</span>
        <span style="font-size:13px;font-weight:700">${c.name}</span>
        <button onclick="deleteCategory('${c.id}')" style="color:var(--red);font-size:16px;margin-left:6px;font-weight:bold;background:none;border:none;cursor:pointer;">×</button>
      </div>
    `).join('');
  }

  // 2. BUSCAR PRODUCTOS EN SUPABASE
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

    // Pintar los productos traídos de Supabase
    prodList.innerHTML = productosSupabase.map(p => {
      let cat = CUR.categories.find(c => c.id === p.category);
      let catName = cat ? cat.icon + ' ' + cat.name : 'Sin categoría';
      let img = p.image ? `<img src="${p.image}" style="width:100%;height:100px;object-fit:contain;mix-blend-mode:multiply;">` : `<div style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--muted)">Sin foto</div>`;
      
      return `
      <div style="background:#fff;border:1px solid var(--b);border-radius:16px;padding:10px;position:relative;display:flex;flex-direction:column;box-shadow:0 4px 10px rgba(0,0,0,0.05);">
        <button onclick="deleteProduct('${p.id}')" style="position:absolute;top:6px;right:6px;background:rgba(239,68,68,0.1);color:var(--red);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:bold;border:none;cursor:pointer;">×</button>
        <div style="width:100%;background:#F8FAFC;border-radius:12px;margin-bottom:10px;display:flex;justify-content:center;align-items:center;">
           ${img}
        </div>
        <div style="font-size:9px;color:var(--blue);font-weight:800;text-transform:uppercase;">${catName}</div>
        <div style="font-size:12px;font-weight:800;color:#0F172A;line-height:1.2;margin:4px 0;flex:1;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.name}</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:4px;">
          <span style="font-size:16px;font-weight:900;color:var(--green)">${parseFloat(p.price).toFixed(2)}€</span>
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
  document.getElementById('cat-icon').value = '';
  openOv('ov-tienda-cat');
}

function saveCategory() {
  let name = document.getElementById('cat-name').value.trim();
  let icon = document.getElementById('cat-icon').value.trim();
  if (!name || !icon) { 
    mostrarAlertaTienda('Por favor, ingresa un nombre y un emoji/ícono para tu categoría.', 'Faltan datos', '✍️'); 
    return; 
  }
  if (!CUR.categories) CUR.categories = [];
  
  CUR.categories.push({ id: 'cat_' + Date.now(), name: name, icon: icon });
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

// 3. FUNCIONES PRODUCTO
function openProdModal() {
  if (!CUR.categories || CUR.categories.length === 0) {
    mostrarAlertaTienda('¡Primero debes crear al menos una categoría para poder subir productos!', 'Crea una categoría', '📂');
    return;
  }
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-disc').value = '';
  document.getElementById('prod-desc').value = '';
  
  let sel = document.getElementById('prod-cat');
  sel.innerHTML = CUR.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  
  tempProdPhoto = null;
  document.getElementById('prod-photo-preview').innerHTML = '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
  
  openOv('ov-tienda-prod');
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
  
  if (!name || isNaN(price)) { 
    mostrarAlertaTienda('El nombre y el precio son obligatorios para guardar el producto.', 'Faltan datos', '💰'); 
    return; 
  }

  // Preparamos el objeto EXACTAMENTE como está tu tabla en Supabase
  const nuevoProducto = {
    id: 'prod_' + Date.now(), // o puedes dejar que Supabase cree el UUID automático si lo configuraste así
    business_id: CUR.id,
    name: name,
    description: desc,
    price: price,
    stock: 100, // Por defecto
    image: tempProdPhoto || '',
    category: cat,
    rating: 0,
    reviews_count: 0
  };

  try {
    // Insertamos en Supabase
    const { error } = await supabase.from('products').insert([nuevoProducto]);
    if (error) throw error;

    mostrarAlertaTienda('Tu producto se ha guardado exitosamente en la tienda.', '¡Éxito!', '✅');
    renderTiendaAdmin(); // Recargar la lista
    closeOv('ov-tienda-prod');
  } catch (err) {
    console.error("Error guardando:", err);
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
        renderTiendaAdmin(); // Recargar la lista tras borrar
      } catch (err) {
        console.error("Error borrando:", err);
        alert("No se pudo eliminar el producto.");
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

