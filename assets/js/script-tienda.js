// ==========================================
// 1. CONEXIÓN DIRECTA A SUPABASE (ENTORNO DEV)
// ==========================================
// Lucian: Cuando pases a producción, cambia estas dos variables por tus llaves oficiales.
const SUPABASE_URL = 'https://krbtoepzoorpdedtykug.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IXquO0XEbEkFBmZgblzjVg_adtTWCW-'; 

// Inicializamos el cliente de Supabase para la tienda
const tiendaSupa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let tempProdPhoto = null;
let editingProdId = null;

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

// ==========================================
// 2. DIBUJAR TODO (Admin) - SISTEMA DINÁMICO
// ==========================================
async function renderTiendaAdmin() {
  if (!CUR) return;

  const prodList = document.getElementById('biz-productos-list');
  const catList = document.getElementById('biz-categorias-list');
  const datalist = document.getElementById('cat-list');

  prodList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--blue);">Cargando tienda... ⏳</div>';

  try {
    // Buscar Productos directos desde Supabase
    const { data: productos, error } = await tiendaSupa
      .from('products')
      .select('*')
      .eq('business_id', CUR.id)
      .order('created_at', { ascending: false }); // Opcional: ordenar por los más nuevos

    if (error) throw error;

    if (!productos || productos.length === 0) {
      prodList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);font-size:13px;background:var(--card);border-radius:16px;border:1px dashed var(--b);">Aún no tienes productos en tu tienda.<br><br>Dale al botón azul "Añadir Producto +" para empezar.</div>';
      if(catList) catList.innerHTML = '';
      if(datalist) datalist.innerHTML = '';
      return;
    }

    // EXTRAER ETIQUETAS ÚNICAS (Categorías Dinámicas Automáticas)
    let categoriasUnicas = [...new Set(productos.map(p => p.category).filter(Boolean))];
    
    // Pintar los botones de filtro (Pills visuales)
    if(catList) {
        catList.innerHTML = '<div style="background:var(--blue);color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:800;flex-shrink:0;box-shadow:0 4px 10px rgba(74,127,212,0.3);">Todo</div>' + 
          categoriasUnicas.map(cat => `
          <div style="background:var(--card);border:1px solid var(--b);color:var(--text);padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;flex-shrink:0;">${cat}</div>
        `).join('');
    }

    // Llenar el autocompletado del modal para facilitar la vida al dueño
    if(datalist) {
        datalist.innerHTML = categoriasUnicas.map(cat => `<option value="${cat}">`).join('');
    }

    // Pintar Productos (Tarjetas Pequeñas y Elegantes)
    prodList.innerHTML = productos.map(p => {
      let img = p.image ? `<img src="${p.image}" style="max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply;border-radius:8px;">` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:28px;">🛍️</div>`;
      let finalPrice = parseFloat(p.price).toFixed(2);
      let catName = p.category || 'General';

      return `
      <div onclick="editProduct('${p.id}')" style="background:#fff;border:1px solid var(--b);border-radius:16px;padding:10px;position:relative;display:flex;flex-direction:column;box-shadow:0 4px 10px rgba(0,0,0,0.04);cursor:pointer;transition:transform 0.2s;">
        
        <button onclick="deleteProduct('${p.id}', event)" style="position:absolute;top:6px;right:6px;background:rgba(239,68,68,0.1);color:var(--red);width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:bold;border:none;cursor:pointer;transition:background 0.2s;">×</button>
        <button onclick="editProduct('${p.id}')" style="position:absolute;top:6px;right:36px;background:rgba(74,127,212,0.1);color:var(--blue);width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:2;font-size:13px;border:none;cursor:pointer;">✏️</button>
        
        <div style="width:100%;height:100px;background:#F8FAFC;border-radius:12px;margin-bottom:10px;display:flex;justify-content:center;align-items:center;overflow:hidden;">
           ${img}
        </div>
        
        <div style="align-self:flex-start;font-size:9px;color:var(--blue);font-weight:800;background:rgba(74,127,212,0.1);padding:4px 8px;border-radius:8px;text-transform:uppercase;margin-bottom:6px;letter-spacing:0.5px;">
           ${catName}
        </div>
        
        <div style="font-size:13px;font-weight:800;color:#0F172A;line-height:1.25;flex:1;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px;">${p.name}</div>
        <div style="font-size:16px;font-weight:900;color:var(--green);margin-top:auto;">${finalPrice}€</div>
        
      </div>
      `;
    }).join('');

  } catch (err) {
    console.error("Error cargando productos:", err);
    prodList.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--red);">Hubo un error conectando con la Base de Datos DEV.</div>';
  }
}

// ==========================================
// 3. CRUD DE PRODUCTOS (Directo a SUPABASE DEV)
// ==========================================

function openProdModal() {
  editingProdId = null; // Reiniciamos la variable porque es un producto nuevo
  
  // Limpiamos todos los campos del modal
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-desc').value = '';
  document.getElementById('prod-cat').value = ''; // Input libre de etiquetas
  
  tempProdPhoto = null;
  document.getElementById('prod-photo-preview').innerHTML = '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
  
  openOv('ov-tienda-prod');
}

async function editProduct(id) {
  try {
    // Buscamos los datos exactos en Supabase
    const { data, error } = await tiendaSupa.from('products').select('*').eq('id', id).single();
    if (error) throw error;
    if (!data) return;

    editingProdId = id; // Marcamos el ID para saber que vamos a Actualizar, no a Crear
    
    // Llenamos los inputs con la info traída
    document.getElementById('prod-name').value = data.name;
    document.getElementById('prod-price').value = data.price;
    document.getElementById('prod-desc').value = data.description || '';
    document.getElementById('prod-cat').value = data.category || '';
    
    // Mostramos la foto si la tiene
    tempProdPhoto = data.image;
    if (data.image) {
      document.getElementById('prod-photo-preview').innerHTML = `<img src="${data.image}" style="width:100%;height:80px;object-fit:cover;border-radius:12px;">`;
    } else {
      document.getElementById('prod-photo-preview').innerHTML = '<div style="font-size:13px;color:var(--muted)">Añadir foto</div>';
    }
    
    openOv('ov-tienda-prod');
  } catch (err) {
    console.error("Error al cargar producto para editar:", err);
    mostrarAlertaTienda('No pudimos cargar los datos del producto desde Supabase.', 'Error', '❌');
  }
}

// 📸 Manejo de Imágenes con ImgBB (Súper optimizado)
document.getElementById('prod-photo-input').addEventListener('change', async function(e) {
  let f = e.target.files[0];
  if (!f) return;
  
  document.getElementById('prod-photo-preview').innerHTML = '<span style="color:var(--blue);font-weight:700;">Subiendo... ⏳</span>';
  
  // Usamos tu función global de app.js para subir a ImgBB
  if (typeof uploadToImgBB === 'function') {
    let url = await uploadToImgBB(f);
    if (url) {
      tempProdPhoto = url;
      document.getElementById('prod-photo-preview').innerHTML = `<img src="${url}" style="width:100%;height:80px;object-fit:cover;border-radius:12px;">`;
    } else {
      document.getElementById('prod-photo-preview').innerHTML = '<span style="color:var(--red);font-size:12px;">Error al subir foto</span>';
    }
  }
});

async function saveProduct() {
  let name = document.getElementById('prod-name').value.trim();
  let price = parseFloat(document.getElementById('prod-price').value);
  let cat = document.getElementById('prod-cat').value.trim() || 'General'; // Si lo deja vacío, le ponemos General
  let desc = document.getElementById('prod-desc').value.trim();
  
  if (!name || isNaN(price)) { 
    mostrarAlertaTienda('El nombre y el precio son obligatorios para poder venderlo.', 'Faltan datos', '💰'); 
    return; 
  }

  // Preparamos los datos EXACTAMENTE como los espera Supabase
  const productoData = {
    business_id: CUR.id,
    name: name,
    description: desc,
    price: price,
    stock: 100, // Stock por defecto si no lo manejas en UI aún
    image: tempProdPhoto || '',
    category: cat
  };

  try {
    if (editingProdId) {
      // ✏️ MODO ACTUALIZAR (UPDATE)
      const { error } = await tiendaSupa.from('products').update(productoData).eq('id', editingProdId);
      if (error) throw error;
      mostrarAlertaTienda('El producto se actualizó correctamente.', '¡Listo!', '✏️');
    } else {
      // ➕ MODO CREAR NUEVO (INSERT)
      productoData.id = 'prod_' + Date.now();
      productoData.rating = 0;
      productoData.reviews_count = 0;
      
      const { error } = await tiendaSupa.from('products').insert([productoData]);
      if (error) throw error;
      mostrarAlertaTienda('Producto publicado exitosamente en tu tienda.', '¡Éxito!', '✅');
    }

    // Recargamos el panel para ver los cambios y cerramos la ventana
    renderTiendaAdmin(); 
    closeOv('ov-tienda-prod');
    
  } catch (err) {
    console.error("Error guardando en Supabase DEV:", err);
    mostrarAlertaTienda('Error al guardar en la Base de Datos. Revisa tu conexión.', 'Error de Red', '❌');
  }
}

function deleteProduct(id, event) {
  event.stopPropagation(); // Evitamos que al presionar la X se abra el modal de editar
  
  confirmarAccionTienda(
    'Eliminar Producto', 
    '¿Estás seguro de que deseas eliminar este producto permanentemente de tu tienda?', 
    async () => {
      try {
        const { error } = await tiendaSupa.from('products').delete().eq('id', id);
        if (error) throw error;
        renderTiendaAdmin(); // Recargamos para que desaparezca
      } catch (err) {
        console.error("Error borrando:", err);
        mostrarAlertaTienda('No se pudo eliminar el producto.', 'Error', '❌');
      }
    }
  );
}

// ==========================================
// 4. ENGANCHAR AL SISTEMA DE TABS DE CITAS PRO
// ==========================================
// Esto garantiza que cada vez que el dueño haga clic en "Tienda", se refresquen los productos.
const fnOriginalBizTab = window.bizTab;
window.bizTab = function(tab) {
  if (fnOriginalBizTab) fnOriginalBizTab(tab); 
  if (tab === 'tienda') renderTiendaAdmin();   
}