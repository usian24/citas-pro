// assets/js/tienda-cliente.js

let SHOP_BIZ = null; // Guardará los datos de la barbería actual
let carrito = [];    // Guardará los productos que el cliente quiere comprar
let currentCategory = 'all';

document.addEventListener("DOMContentLoaded", function() {
  // 1. Cargamos la base de datos
  if (typeof loadDB === 'function') {
     window.DB = loadDB();
  }

  // 2. Extraer el ID del negocio desde la URL
  let bizId = '';
  const hash = window.location.hash;
  
  if (hash && hash.includes('#b/')) {
    bizId = hash.split('#b/')[1].split('/')[0];
  } else if (window.DB && window.DB.currentBiz) {
    bizId = window.DB.currentBiz;
  }
  
  // 3. Validar y arrancar la tienda
  if (bizId && window.DB && window.DB.businesses) {
    SHOP_BIZ = window.DB.businesses.find(b => b.id === bizId);
    
    if (SHOP_BIZ) {
      document.getElementById('shop-title').textContent = "Tienda de " + SHOP_BIZ.name;
      inicializarTienda(); // Arrancamos los motores
    } else {
      document.getElementById('shop-title').textContent = "Barbería no encontrada";
    }
  } else {
     document.getElementById('shop-title').textContent = "Enlace inválido";
  }
});

// --- FUNCIONES PRINCIPALES ---

function inicializarTienda() {
    renderCategorias();
    renderProductos('all');
    actualizarBadgeCarrito();
}

function renderCategorias() {
    const container = document.querySelector('.cat-scroll');
    if(!container) return;
    
    let cats = SHOP_BIZ.categories || [];
    
    // Botón de "Todo"
    let html = `
      <div class="cat-item ${currentCategory === 'all' ? 'active' : ''}" onclick="filtrarProductos('all')">
        <div class="cat-circle">🌟</div>
        <span class="cat-name">Todo</span>
      </div>
    `;
    
    // Dibujar las categorías reales creadas por el dueño
    cats.forEach(c => {
        html += `
          <div class="cat-item ${currentCategory === c.id ? 'active' : ''}" onclick="filtrarProductos('${c.id}')">
            <div class="cat-circle" style="background:#F8FAFC; border: 2px solid ${currentCategory === c.id ? 'var(--blue)' : 'transparent'}">${c.icon}</div>
            <span class="cat-name">${c.name}</span>
          </div>
        `;
    });
    
    container.innerHTML = html;
}

function filtrarProductos(catId) {
    currentCategory = catId;
    renderCategorias(); // Redibujar para marcar cuál está activa
    renderProductos(catId);
}

function renderProductos(catId) {
    const container = document.querySelector('.product-grid');
    if(!container) return;

    let prods = SHOP_BIZ.products || [];
    
    // Filtrar si eligió una categoría específica
    if(catId !== 'all') {
        prods = prods.filter(p => p.categoryId === catId);
    }

    // Mensaje si no hay productos
    if(prods.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--muted);">No hay productos disponibles en esta categoría.</div>`;
        return;
    }

    // Dibujar los productos reales
    let html = '';
    prods.forEach(p => {
        let finalPrice = p.discount > 0 ? (p.price - (p.price * p.discount / 100)).toFixed(2) : p.price.toFixed(2);
        let badge = p.discount > 0 ? `<span class="p-badge">-${p.discount}%</span>` : '';
        let oldPrice = p.discount > 0 ? `<span class="p-old">${p.price.toFixed(2)}€</span>` : '';
        let img = p.image ? p.image : 'https://placehold.co/300x300/ffffff/4A7FD4?text=Foto';

        html += `
        <div class="p-card">
          <div class="p-img-wrap">
            ${badge}
            <div class="p-like" onclick="darLike(this)">🤍</div>
            <img src="${img}" alt="${p.name}"/>
          </div>
          <div class="p-info">
            <div class="p-title">${p.name}</div>
            <div class="p-stars">★★★★★ <span style="color:var(--muted)">(${p.likes || 0})</span></div>
            <div class="p-price-row">
              ${oldPrice}
              <span class="p-new">${finalPrice}€</span>
            </div>
            <button class="btn btn-dark btn-sm" onclick="agregarAlCarrito('${p.id}')">Añadir al carrito</button>
          </div>
        </div>
        `;
    });
    
    container.innerHTML = html;
}

// --- LÓGICA DEL CARRITO ---

function agregarAlCarrito(id) {
    let prod = (SHOP_BIZ.products || []).find(p => p.id === id);
    if(!prod) return;
    
    let item = carrito.find(c => c.product.id === id);
    if(item) {
        item.cantidad++; // Si ya está, sumamos 1
    } else {
        carrito.push({ product: prod, cantidad: 1 }); // Si no, lo agregamos
    }
    
    actualizarBadgeCarrito();
    
    // Un pequeño feedback visual (Opcional, pero se ve pro)
    alert(`¡"${prod.name}" añadido al carrito!`);
}

function actualizarBadgeCarrito() {
    const badge = document.querySelector('.cart-badge');
    if(!badge) return;
    
    let total = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none'; // Ocultar si está vacío
}

function darLike(element) {
    // Cambia el corazón a rojo visualmente
    element.textContent = '❤️';
    element.style.color = 'var(--red)';
}