
  let tempProdPhoto = null;

  // 1. DIBUJAR TODO
  function renderTiendaAdmin() {
    if (!CUR) return;
    if (!CUR.categories) CUR.categories = [];
    if (!CUR.products) CUR.products = [];

    // Pintar Categorías
    const catList = document.getElementById('biz-categorias-list');
    if (CUR.categories.length === 0) {
      catList.innerHTML = '<div style="width:100%;text-align:center;color:var(--muted);font-size:12px;padding:10px;">Crea tu primera categoría</div>';
    } else {
      catList.innerHTML = CUR.categories.map(c => `
        <div style="background:var(--card);border:1px solid var(--b);border-radius:16px;padding:8px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <span style="font-size:22px">${c.icon}</span>
          <span style="font-size:13px;font-weight:700">${c.name}</sapan>
          <button onclick="deleteCategory('${c.id}')" style="color:var(--red);font-size:16px;margin-left:6px;font-weight:bold;">×</button>
        </div>
      `).join('');
    }

    // Pintar Productos
    const prodList = document.getElementById('biz-productos-list');
    if (CUR.products.length === 0) {
      prodList.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted);font-size:13px">Sin productos. ¡Añade el primero!</div>';
    } else {
      prodList.innerHTML = CUR.products.map(p => {
        let cat = CUR.categories.find(c => c.id === p.categoryId);
        let catName = cat ? cat.icon + ' ' + cat.name : 'Sin categoría';
        let img = p.image ? `<img src="${p.image}" style="width:100%;height:100px;object-fit:contain;mix-blend-mode:multiply;">` : `<div style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--muted)">Sin foto</div>`;
        let badge = p.discount > 0 ? `<span style="position:absolute;top:6px;left:6px;background:var(--red);color:#fff;font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;">-${p.discount}%</span>` : '';
        let finalPrice = p.discount > 0 ? (p.price - (p.price * p.discount / 100)).toFixed(2) : p.price.toFixed(2);

        return `
        <div style="background:#fff;border:1px solid var(--b);border-radius:16px;padding:10px;position:relative;display:flex;flex-direction:column;box-shadow:0 4px 10px rgba(0,0,0,0.05);">
          ${badge}
          <button onclick="deleteProduct('${p.id}')" style="position:absolute;top:6px;right:6px;background:rgba(239,68,68,0.1);color:var(--red);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:bold;">×</button>
          <div style="width:100%;background:#F8FAFC;border-radius:12px;margin-bottom:10px;display:flex;justify-content:center;align-items:center;">
             ${img}
          </div>
          <div style="font-size:9px;color:var(--blue);font-weight:800;text-transform:uppercase;">${catName}</div>
          <div style="font-size:12px;font-weight:800;color:#0F172A;line-height:1.2;margin:4px 0;flex:1;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.name}</div>
          <div style="display:flex;align-items:baseline;gap:6px;margin-top:4px;">
            <span style="font-size:16px;font-weight:900;color:var(--green)">${finalPrice}€</span>
            ${p.discount > 0 ? `<span style="font-size:10px;color:var(--muted);text-decoration:line-through">${p.price.toFixed(2)}€</span>` : ''}
          </div>
        </div>
        `;
      }).join('');
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
    if (!name || !icon) { alert('Ingresa un nombre y un emoji/ícono'); return; }
    if (!CUR.categories) CUR.categories = [];
    
    CUR.categories.push({ id: 'cat_' + Date.now(), name: name, icon: icon });
    saveDB(); renderTiendaAdmin(); closeOv('ov-tienda-cat');
  }

  function deleteCategory(id) {
    if (confirm('¿Eliminar categoría? Los productos asociados quedarán "Sin categoría".')) {
      CUR.categories = CUR.categories.filter(c => c.id !== id);
      saveDB(); renderTiendaAdmin();
    }
  }

  // 3. FUNCIONES PRODUCTO
  function openProdModal() {
    if (!CUR.categories || CUR.categories.length === 0) {
      alert('¡Primero debes crear al menos una categoría!'); return;
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

  // Subir la foto del producto (Usamos ImgBB si existe, si no, lo manejamos)
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
      // Fallback por si la función no carga rápido
      tempProdPhoto = "https://placehold.co/300x300/ffffff/4A7FD4?text=Producto";
      document.getElementById('prod-photo-preview').innerHTML = `<img src="${tempProdPhoto}" style="width:100%;height:80px;object-fit:cover;border-radius:12px;">`;
    }
  });

  function saveProduct() {
    let name = document.getElementById('prod-name').value.trim();
    let price = parseFloat(document.getElementById('prod-price').value);
    let disc = parseInt(document.getElementById('prod-disc').value) || 0;
    let cat = document.getElementById('prod-cat').value;
    let desc = document.getElementById('prod-desc').value.trim();
    
    if (!name || isNaN(price)) { alert('El nombre y el precio son obligatorios'); return; }
    if (!CUR.products) CUR.products = [];
    
    CUR.products.push({
      id: 'prod_' + Date.now(),
      name: name, price: price, discount: disc, desc: desc,
      categoryId: cat, image: tempProdPhoto || '', likes: 0
    });
    
    saveDB(); renderTiendaAdmin(); closeOv('ov-tienda-prod');
  }

  function deleteProduct(id) {
    if (confirm('¿Seguro que deseas eliminar este producto?')) {
      CUR.products = CUR.products.filter(p => p.id !== id);
      saveDB(); renderTiendaAdmin();
    }
  }

  // 4. ENGANCHAR AL SISTEMA DE TABS
  // Cada vez que le de clic a "Tienda", redibujamos sus productos.
  const fnOriginalBizTab = window.bizTab;
  window.bizTab = function(tab) {
    if (fnOriginalBizTab) fnOriginalBizTab(tab); // Hace lo original
    if (tab === 'tienda') renderTiendaAdmin();   // Añade la actualización de la tienda
  }
