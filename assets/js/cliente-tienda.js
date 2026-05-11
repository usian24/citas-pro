const TIENDA_PAIS_CONFIG = {
  ES: { simbolo: '€', posicion: 'derecha', sepDec: ',', sepMiles: '.', decimales: 2 },
  CO: { simbolo: '$', posicion: 'izquierda', sepDec: ',', sepMiles: '.', decimales: 0 },
  MX: { simbolo: '$', posicion: 'izquierda', sepDec: '.', sepMiles: ',', decimales: 2 },
  AR: { simbolo: '$', posicion: 'izquierda', sepDec: ',', sepMiles: '.', decimales: 2 },
  PE: { simbolo: 'S/', posicion: 'izquierda', sepDec: '.', sepMiles: ',', decimales: 2 },
  CL: { simbolo: '$', posicion: 'izquierda', sepDec: ',', sepMiles: '.', decimales: 0 },
  US: { simbolo: '$', posicion: 'izquierda', sepDec: '.', sepMiles: ',', decimales: 2 },
  BR: { simbolo: 'R$', posicion: 'izquierda', sepDec: ',', sepMiles: '.', decimales: 2 },
  DO: { simbolo: 'RD$', posicion: 'izquierda', sepDec: '.', sepMiles: ',', decimales: 2 },
  VE: { simbolo: 'Bs.', posicion: 'izquierda', sepDec: ',', sepMiles: '.', decimales: 2 },
  EC: { simbolo: '$', posicion: 'izquierda', sepDec: '.', sepMiles: ',', decimales: 2 },
};
let paisNegocio = 'ES';
function moneda(n) {
  const cfg = TIENDA_PAIS_CONFIG[paisNegocio] || TIENDA_PAIS_CONFIG['ES'];
  const num = parseFloat(n) || 0;
  const factor = Math.pow(10, cfg.decimales);
  const rounded = Math.round(num * factor) / factor;
  const parts = rounded.toFixed(cfg.decimales).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, cfg.sepMiles);
  const numStr = cfg.decimales > 0 ? parts.join(cfg.sepDec) : parts[0];
  return cfg.posicion === 'izquierda' ? cfg.simbolo + numStr : numStr + ' ' + cfg.simbolo;
}
const SUPABASE_URL = window.AppEnv.SUPABASE_URL;
const SUPABASE_KEY = window.AppEnv.SUPABASE_ANON_KEY;
const tiendaSupa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════
let productosDB = [];
let carrito = []; // [{ product, cantidad }]
let currentCategory = 'all';
let maxRating = 1;
let toastTimeout;
let bizIdGlobal = '';
let bizWAPhone = ''; // teléfono del negocio para WhatsApp

function getLikes() {
  try { return JSON.parse(localStorage.getItem('cp_likes') || '{}'); } catch { return {}; }
}
function setLike(prodId, val) {
  const l = getLikes(); l[prodId] = val;
  localStorage.setItem('cp_likes', JSON.stringify(l));
}

// ════════════════════════════════════════════
// EMOJI POR CATEGORÍA
// ════════════════════════════════════════════
function emojiParaCategoria(cat) {
  const map = {
    'ceras': '🪙', 'cera': '🪙', 'carteras': '👜', 'cartera': '👜',
    'ropa': '👕', 'complementos': '🎩', 'accesorios': '⌚',
    'perfumes': '🌸', 'perfume': '🌸', 'cremas': '🧴', 'crema': '🧴',
    'champu': '🚿', 'champú': '🚿', 'aceites': '💧', 'aceite': '💧',
    'navajas': '🪒', 'maquinillas': '🪒', 'tonicos': '✨', 'tonico': '✨',
    'geles': '💎', 'gel': '💎', 'barberia': '💈', 'barbería': '💈',
    'peluqueria': '✂️', 'peluquería': '✂️', 'todo': '⭐',
    'botas': '👢', 'bota': '👢', 'toros': '🐂', 'toro': '🐂',
    'pestanas': '👁️', 'pestañas': '👁️',
  };
  const lower = (cat || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return map[lower] || '🛍️';
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof loadDB === 'function') window.DB = loadDB();

  const hash = window.location.hash;
  if (hash && hash.includes('#b/')) {
    bizIdGlobal = hash.split('#b/')[1].split('/')[0];
  } else if (window.DB?.currentBiz) {
    bizIdGlobal = window.DB.currentBiz;
  }
  localStorage.removeItem('cp_pais');
  try {
    const { data: bizData } = await tiendaSupa
      .from('businesses').select('name,phone,country').eq('id', bizIdGlobal).single();
    if (bizData) {
      document.getElementById('shop-title').textContent = bizData.name || 'Nuestra Tienda';
      if (bizData.phone) bizWAPhone = bizData.phone.replace(/\D/g, '');
      if (bizData.country && TIENDA_PAIS_CONFIG[bizData.country]) {
        paisNegocio = bizData.country;
        localStorage.setItem('cp_pais', bizData.country);
      }
    }
  } catch (e) {
    const biz = window.DB?.businesses?.find(b => b.id === bizIdGlobal);
    if (biz) {
      document.getElementById('shop-title').textContent = biz.name || 'Nuestra Tienda';
      if (biz.phone) bizWAPhone = biz.phone.replace(/\D/g, '');
      if (biz.country && TIENDA_PAIS_CONFIG[biz.country]) paisNegocio = biz.country;
    }
  }

  if (bizIdGlobal) {
    const biz = window.DB?.businesses?.find(b => b.id === bizIdGlobal);
    document.getElementById('shop-title').textContent = biz ? biz.name : 'Nuestra Tienda';
    if (biz?.phone) bizWAPhone = biz.phone.replace(/\D/g, '');
    await fetchProductos(bizIdGlobal);
  } else {
    document.getElementById('shop-title').textContent = 'Enlace inválido';
  }
});

async function fetchProductos(bizId) {
  try {
    const { data, error } = await tiendaSupa
      .from('products').select('*').eq('business_id', bizId);
    if (error) throw error;
    productosDB = data || [];
    maxRating = Math.max(1, ...productosDB.map(p => p.rating || 0));
    inicializarTienda();
  } catch (err) {
    console.error('Error tienda:', err);
    document.getElementById('catalogo-root').innerHTML =
      '<div class="empty-state"><div>❌</div>Error al cargar productos.</div>';
  }
}

// ════════════════════════════════════════════
// CATEGORÍAS + CATÁLOGO
// ════════════════════════════════════════════
function inicializarTienda() {
  renderCategorias();
  renderCatalogo('all');
}

function renderCategorias() {
  const container = document.getElementById('client-cats');
  if (!container) return;
  const cats = [...new Set(productosDB.map(p => (p.category || '').trim()).filter(Boolean))].sort();
  let html = `
    <div class="cat-pill-client ${currentCategory === 'all' ? 'active' : ''}" onclick="filtrarProductos('all')">
      <div class="cat-circle">${emojiParaCategoria('todo')}</div>
      <div class="cat-label">Todo</div>
    </div>`;
  cats.forEach(cat => {
    html += `
      <div class="cat-pill-client ${currentCategory === cat ? 'active' : ''}"
           onclick="filtrarProductos('${cat.replace(/'/g, "\\'")}')">
        <div class="cat-circle">${emojiParaCategoria(cat)}</div>
        <div class="cat-label">${cat}</div>
      </div>`;
  });
  container.innerHTML = html;
}

function filtrarProductos(catId) {
  currentCategory = catId;
  document.getElementById('shop-search-input').value = '';
  renderCategorias();
  renderCatalogo(catId);
}

function buscarProductos(termino) {
  const text = termino.toLowerCase().trim();
  if (!text) { currentCategory = 'all'; renderCategorias(); renderCatalogo('all'); return; }
  currentCategory = '';
  renderCategorias();
  const filtrados = productosDB.filter(p => (p.name || '').toLowerCase().includes(text));
  const root = document.getElementById('catalogo-root');
  root.innerHTML = filtrados.length
    ? renderSeccion('🔍 Resultados', filtrados, 'search')
    : '<div class="empty-state"><div>🔍</div>Sin resultados.</div>';
}

function renderCatalogo(catId) {
  const root = document.getElementById('catalogo-root');
  if (!root) return;
  if (catId === 'all') {
    const todos = [...productosDB];
    let html = renderSeccion('🛍️ Catálogo', todos, 'all');
    const cats = [...new Set(todos.map(p => (p.category || '').trim()).filter(Boolean))].sort();
    cats.forEach(cat => {
      const prods = todos.filter(p => (p.category || '').trim() === cat);
      html += renderSeccion(`${emojiParaCategoria(cat)} ${cat}`, prods, cat);
    });
    root.innerHTML = html || '<div class="empty-state"><div>📦</div>Sin productos aún.</div>';
  } else {
    const prods = productosDB.filter(p => (p.category || '').trim() === catId);
    root.innerHTML = prods.length
      ? renderSeccion(`${emojiParaCategoria(catId)} ${catId}`, prods, catId)
      : '<div class="empty-state"><div>😔</div>No hay productos en esta categoría.</div>';
  }
}

function renderSeccion(titulo, prods, catKey) {
  if (!prods.length) return '';
  const likes = getLikes();
  const ROWS = 3;
  const cols = [];
  for (let i = 0; i < prods.length; i += ROWS) cols.push(prods.slice(i, i + ROWS));
  const colsHtml = cols.map(col =>
    `<div class="tren-col">${col.map((p, idx) => renderCard(p, likes, idx)).join('')}</div>`
  ).join('');
  return `
    <div class="catalogo-seccion">
      <div class="catalogo-seccion-titulo">
        ${titulo} <span class="cnt">${prods.length}</span>
      </div>
      <div class="tren-scroll">${colsHtml}</div>
    </div>`;
}

// ════════════════════════════════════════════
// PARSE FOTOS
// ════════════════════════════════════════════
window.parseFotos = function (imgData) {
  if (!imgData) return [];
  try {
    const arr = JSON.parse(imgData);
    if (Array.isArray(arr)) return arr;
  } catch (e) { }
  return [imgData];
};

// ════════════════════════════════════════════
// TARJETA
// ════════════════════════════════════════════
function renderCard(p, likes, animIdx) {
  const liked = !!likes[p.id];
  const estrellas = calcularEstrellas(p.rating || 0);
  const precio = parseFloat(p.price) || 0;
  const descuento = parseFloat(p.discount_percent) || 0;
  const precioFinal = descuento > 0 ? precio * (1 - descuento / 100) : precio;
  const stock = p.stock != null ? parseInt(p.stock) : null;
  const fotos = parseFotos(p.image);
  const firstImg = fotos.length > 0 ? fotos[0] : 'https://placehold.co/300x300/ffffff/4A7FD4?text=Producto';
  const catName = (p.category || 'General').trim();

  let stockHtml = '';
  if (stock !== null) {
    if (stock <= 0) stockHtml = '<div class="p-stock out">Sin stock</div>';
    else if (stock <= 5) stockHtml = `<div class="p-stock low">Últimas ${stock} uds</div>`;
    else stockHtml = '<div class="p-stock ok">En stock</div>';
  }

  const precioHtml = descuento > 0
    ? `<div class="p-price-wrap">
         <div class="p-price-old">${moneda(precio)}</div>
         <div class="p-price-new discounted">${moneda(precioFinal)}</div>
       </div>`
    : `<div class="p-price-wrap">
         <div class="p-price-new">${moneda(precio)}</div>
       </div>`;

  const starsHtml = `
    <div class="p-stars">
      ${[1, 2, 3, 4, 5].map(i => `<span class="star${i <= estrellas ? ' on' : ''}">★</span>`).join('')}
      <span class="p-stars-count">${p.rating || 0}</span>
    </div>`;

  const badgeHtml = descuento > 0 ? `<div class="p-discount-badge">-${Math.round(descuento)}%</div>` : '';
  const btnDisabled = stock !== null && stock <= 0;

  // Renderizar Slider o Imagen simple
  let imgHtml = '';
  if (fotos.length > 1) {
    // Generar animación auto rotativa
    imgHtml = `
      <div class="p-img-slider-wrap" onclick="abrirModalProducto('${p.id}')">
        <div class="p-img-slider slider-count-${fotos.length}">
          ${fotos.map(f => `<img src="${f}" alt="${p.name}" loading="lazy"/>`).join('')}
        </div>
      </div>
    `;
  } else {
    imgHtml = `<img src="${firstImg}" alt="${p.name}" loading="lazy" onclick="abrirModalProducto('${p.id}')" style="cursor:pointer;" />`;
  }

  return `
    <div class="p-card" style="animation-delay:${animIdx * 0.06}s">
      <div class="p-img-wrap">
        ${badgeHtml}
        <div class="p-like ${liked ? 'active' : ''}" onclick="toggleLike(this,'${p.id}')" title="Me gusta">
          <svg width="13" height="13" viewBox="0 0 24 24"
               fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        ${imgHtml}
      </div>
      <div class="p-info">
        <div class="p-tag">${catName}</div>
        <div class="p-title">${p.name}</div>
        ${starsHtml}
        ${stockHtml}
        ${precioHtml}
        <button class="p-add-btn" ${btnDisabled ? 'disabled' : ''} onclick="agregarAlCarrito('${p.id}')">
          ${btnDisabled ? 'Sin stock' : '+ Añadir'}
        </button>
      </div>
    </div>`;
}

function calcularEstrellas(rating) {
  if (!rating || maxRating === 0) return 0;
  return Math.round((rating / maxRating) * 5);
}

// ════════════════════════════════════════════
// CORAZÓN + RATING
// ════════════════════════════════════════════
async function toggleLike(btn, prodId) {
  const likes = getLikes();
  const yaLike = !!likes[prodId];
  const svg = btn.querySelector('svg');
  const prod = productosDB.find(p => p.id === prodId);
  if (!prod) return;

  if (yaLike) {
    btn.classList.remove('active'); svg.setAttribute('fill', 'none');
    setLike(prodId, false);
    const newRating = Math.max(0, (prod.rating || 0) - 1);
    prod.rating = newRating;
    await tiendaSupa.from('products').update({ rating: newRating }).eq('id', prodId);
  } else {
    btn.classList.add('active'); svg.setAttribute('fill', 'currentColor');
    setLike(prodId, true);
    const newRating = (prod.rating || 0) + 1;
    prod.rating = newRating;
    maxRating = Math.max(maxRating, newRating);
    btn.style.transform = 'scale(1.4)';
    setTimeout(() => btn.style.transform = 'scale(1)', 200);
    mostrarToast('❤️ ¡Añadido a favoritos!');
    await tiendaSupa.from('products').update({ rating: newRating }).eq('id', prodId);
  }

  document.querySelectorAll('.p-card').forEach(card => {
    const likeBtn = card.querySelector('.p-like');
    if (!likeBtn) return;
    const pid = likeBtn.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (!pid) return;
    const p = productosDB.find(x => x.id === pid);
    if (!p) return;
    const est = calcularEstrellas(p.rating || 0);
    card.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('on', i < est));
    const countEl = card.querySelector('.p-stars-count');
    if (countEl) countEl.textContent = p.rating || 0;
  });
}

// ════════════════════════════════════════════
// CARRITO — lógica completa
// ════════════════════════════════════════════
function precioFinalProducto(p) {
  const precio = parseFloat(p.price) || 0;
  const desc = parseFloat(p.discount_percent) || 0;
  return desc > 0 ? precio * (1 - desc / 100) : precio;
}

function agregarAlCarrito(id) {
  const prod = productosDB.find(p => p.id === id);
  if (!prod) return;
  if (prod.stock != null && prod.stock <= 0) { mostrarToast('❌ Producto sin stock'); return; }

  const item = carrito.find(c => c.product.id === id);
  if (item) { item.cantidad++; }
  else { carrito.push({ product: prod, cantidad: 1 }); }

  actualizarBadgeCarrito();

  const btn = document.querySelector('.cart-float');
  btn.style.transform = 'scale(1.18)';
  setTimeout(() => btn.style.transform = 'scale(1)', 200);

  mostrarToast(`🛒 Añadido: ${prod.name}`);
}

function cambiarCantidad(id, delta) {
  const item = carrito.find(c => c.product.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) carrito = carrito.filter(c => c.product.id !== id);
  actualizarBadgeCarrito();
  renderCartItems();
}

function eliminarDelCarrito(id) {
  carrito = carrito.filter(c => c.product.id !== id);
  actualizarBadgeCarrito();
  renderCartItems();
}

function vaciarCarrito() {
  carrito = [];
  actualizarBadgeCarrito();
  renderCartItems();
}

function actualizarBadgeCarrito() {
  const badge = document.getElementById('cart-count');
  if (!badge) return;
  const total = carrito.reduce((s, i) => s + i.cantidad, 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}

function abrirCarrito() {
  document.getElementById('cart-overlay').classList.add('on');
  document.getElementById('cart-drawer').classList.add('on');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function cerrarCarrito() {
  document.getElementById('cart-overlay').classList.remove('on');
  document.getElementById('cart-drawer').classList.remove('on');
  document.body.style.overflow = '';
}

function renderCartItems() {
  const listEl = document.getElementById('cart-items-list');
  const summaryEl = document.getElementById('cart-summary');
  const countEl = document.getElementById('cart-items-count');
  const footerEl = document.getElementById('cart-footer');

  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);
  countEl.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;

  if (!carrito.length) {
    listEl.innerHTML = `
      <div class="cart-empty">
        <div>🛒</div>
        <p>Tu carrito está vacío.<br>Añade productos para empezar.</p>
      </div>`;
    summaryEl.innerHTML = '';
    footerEl.querySelector('.cart-btn-wa').style.display = 'none';
    footerEl.querySelector('.cart-btn-clear').style.display = 'none';
    return;
  }

  footerEl.querySelector('.cart-btn-wa').style.display = 'flex';
  footerEl.querySelector('.cart-btn-clear').style.display = 'block';

  listEl.innerHTML = carrito.map(item => {
    const p = item.product;
    const precio = parseFloat(p.price) || 0;
    const desc = parseFloat(p.discount_percent) || 0;
    const precioUnit = precioFinalProducto(p);
    const subtotal = precioUnit * item.cantidad;
    const fotos = parseFotos(p.image);
    const img = fotos.length > 0 ? fotos[0] : 'https://placehold.co/300x300/ffffff/4A7FD4?text=Producto';
    const catName = (p.category || 'General').trim();

    const precioHtml = desc > 0
      ? `<span class="old">${moneda(precio)}</span>${moneda(precioUnit)}`
      : `${moneda(precioUnit)}`;

    return `
      <div class="cart-item">
        <div class="cart-item-img">
          <img src="${img}" alt="${p.name}" loading="lazy"/>
        </div>
        <div class="cart-item-info">
          <div class="cart-item-cat">${catName}</div>
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-price ${desc > 0 ? 'disc' : ''}">${precioHtml}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">
            Subtotal: <strong style="color:var(--text)">${moneda(subtotal)}</strong>
          </div>
        </div>
        <div class="cart-qty">
          <div class="cart-qty-btn minus" onclick="cambiarCantidad('${p.id}',-1)">
            ${item.cantidad === 1 ? 'X' : '−'}
          </div>
          <div class="cart-qty-num">${item.cantidad}</div>
          <div class="cart-qty-btn" onclick="cambiarCantidad('${p.id}',1)">+</div>
        </div>
      </div>`;
  }).join('');

  let subtotalSinDesc = 0;
  let totalDescuento = 0;
  let totalFinal = 0;

  carrito.forEach(item => {
    const precio = parseFloat(item.product.price) || 0;
    const desc = parseFloat(item.product.discount_percent) || 0;
    const precioUnit = precioFinalProducto(item.product);
    subtotalSinDesc += precio * item.cantidad;
    totalDescuento += (precio - precioUnit) * item.cantidad;
    totalFinal += precioUnit * item.cantidad;
  });

  const hayDescuento = totalDescuento > 0;

  summaryEl.innerHTML = `
    <div class="cart-summary-row">
      <span>Subtotal (${totalItems} items)</span>
      <span>${moneda(subtotalSinDesc)}</span>
    </div>
    ${hayDescuento ? `
    <div class="cart-summary-row">
      <span class="discount-line">🏷️ Descuentos aplicados</span>
      <span class="discount-line">-${moneda(totalDescuento)}</span>
    </div>` : ''}
    <div class="cart-summary-row total">
      <span>Total</span>
      <span>${moneda(totalFinal)}</span>
    </div>`;
}

function pedirPorWhatsApp() {
  if (!carrito.length) return;

  const nombreTienda = document.getElementById('shop-title').textContent;
  let totalFinal = 0;

  const lineas = carrito.map(item => {
    const precioUnit = precioFinalProducto(item.product);
    const subtotal = precioUnit * item.cantidad;
    totalFinal += subtotal;
    const desc = parseFloat(item.product.discount_percent) || 0;
    const descTxt = desc > 0 ? ` (-${Math.round(desc)}%)` : '';
    return `• ${item.product.name}${descTxt} x${item.cantidad} = ${moneda(subtotal)}`;
  }).join('\n');

  const mensaje = `Hola, me gustaría hacer el siguiente pedido en *${nombreTienda}*:\n\n${lineas}\n\n*Total: ${moneda(totalFinal)}*\n\n¿Está disponible?`;

  const phone = bizWAPhone || '34611200984';
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function mostrarAlertaCustom(titulo, mensaje, icono = '🛍️') {
  document.getElementById('sa-icon').innerText = icono;
  document.getElementById('sa-title').innerText = titulo;
  document.getElementById('sa-msg').innerText = mensaje;
  document.getElementById('ov-shop-alert').classList.add('on');
}

function mostrarToast(msg) {
  const t = document.getElementById('toast-msg');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2200);
}

(function initSwipeCarrito() {
  let startY = 0;
  const drawer = document.getElementById('cart-drawer');
  drawer.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
  drawer.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientY - startY;
    if (diff > 80) cerrarCarrito();
  }, { passive: true });
})();

// ════════════════════════════════════════════
// MODAL DETALLE DE PRODUCTO
// ════════════════════════════════════════════
function abrirModalProducto(id) {
  const prod = productosDB.find(p => p.id === id);
  if (!prod) return;

  const fotos = parseFotos(prod.image);
  const firstImg = fotos.length > 0 ? fotos[0] : 'https://placehold.co/300x300/ffffff/4A7FD4?text=Producto';

  let galeriaHtml = '';
  if (fotos.length > 1) {
    galeriaHtml = `
      <div class="pm-gallery">
        <div class="pm-gallery-track">
          ${fotos.map(f => `<div class="pm-gallery-item"><img src="${f}" alt="${prod.name}"></div>`).join('')}
        </div>
        <div class="pm-gallery-dots">
          ${fotos.map((_, i) => `<div class="pm-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
        </div>
      </div>
    `;
  } else {
    galeriaHtml = `
      <div class="pm-gallery">
        <img src="${firstImg}" alt="${prod.name}" class="pm-single-img">
      </div>
    `;
  }

  const precio = parseFloat(prod.price) || 0;
  const desc = parseFloat(prod.discount_percent) || 0;
  const precioFinal = desc > 0 ? precio * (1 - desc / 100) : precio;
  const precioHtml = desc > 0
    ? `<div class="pm-price-wrap"><div class="pm-price-old">${moneda(precio)}</div><div class="pm-price-new discounted">${moneda(precioFinal)}</div></div>`
    : `<div class="pm-price-wrap"><div class="pm-price-new">${moneda(precio)}</div></div>`;

  const btnDisabled = prod.stock != null && prod.stock <= 0;
  const likes = getLikes();
  const liked = !!likes[prod.id];
  const estrellas = calcularEstrellas(prod.rating || 0);

  const modalHtml = `
    <div class="prod-modal-overlay" id="prod-modal-overlay" onclick="cerrarModalProducto(event)">
      <div class="prod-modal-content" onclick="event.stopPropagation()">
        <button class="pm-close" onclick="cerrarModalProducto(null, true)">×</button>
        ${galeriaHtml}
        <div class="pm-info">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div class="pm-cat">${(prod.category || 'General').trim()}</div>
              <h2 class="pm-title">${prod.name}</h2>
              <div class="pm-stars">
                ${[1, 2, 3, 4, 5].map(i => `<span class="star${i <= estrellas ? ' on' : ''}">★</span>`).join('')}
                <span class="p-stars-count">${prod.rating || 0}</span>
              </div>
            </div>
            <div class="p-like ${liked ? 'active' : ''}" onclick="toggleLike(this,'${prod.id}')" style="position:static; margin-top:5px; border-color:var(--b);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
          </div>
          ${precioHtml}
          ${prod.description ? `<p class="pm-desc">${prod.description}</p>` : ''}
        </div>
        <div class="pm-footer">
          <button class="pm-add-btn" ${btnDisabled ? 'disabled' : ''} onclick="agregarAlCarritoDesdeModal('${prod.id}')">
            ${btnDisabled ? 'Sin stock' : 'Añadir al carrito'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.body.style.overflow = 'hidden';

  // Lógica de dots para la galería (Scroll snapping tracker)
  if (fotos.length > 1) {
    const track = document.querySelector('.pm-gallery-track');
    const dots = document.querySelectorAll('.pm-dot');
    track.addEventListener('scroll', () => {
      const scrollRatio = track.scrollLeft / track.clientWidth;
      const index = Math.round(scrollRatio);
      dots.forEach((d, i) => d.classList.toggle('active', i === index));
    });
  }
}

function cerrarModalProducto(event, force = false) {
  if (force || event.target.id === 'prod-modal-overlay') {
    const modal = document.getElementById('prod-modal-overlay');
    if (modal) {
      modal.remove();
      document.body.style.overflow = '';
    }
  }
}

function agregarAlCarritoDesdeModal(id) {
  agregarAlCarrito(id);
  cerrarModalProducto(null, true);
}