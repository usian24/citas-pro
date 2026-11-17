'use strict';

/* ══════════════════════════════════════════════════
   SCRIPT-TIENDA.JS — Gestión de Tienda, Stock y Código de Barras
   Conectado a /api/pos/* (Supabase real) · Sin emojis · Sin cards anidadas
══════════════════════════════════════════════════ */

window._tiendaProducts = window._tiendaProducts || [];
window._tiendaSelectedCat = 'ALL';
window._tiendaSearch = '';
window._editingProdId = null;
window._prodPhotos = [];

function _tSvg(name, size) {
  var s = size || 18;
  var icons = {
    box: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    alert: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    barcode: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>',
    plus: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    close: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
  };
  return icons[name] || '';
}

function _tNorm(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function _tParseImages(imgField) {
  if (!imgField) return [];
  if (Array.isArray(imgField)) return imgField.filter(Boolean);
  var str = String(imgField).trim();
  if (str.startsWith('[')) {
    try {
      var arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr.filter(Boolean);
    } catch (e) {}
  }
  return str ? [str] : [];
}

function _tBarcodeCheckDigit(code) {
  var sum = 0;
  for (var i = 0; i < code.length - 1; i++) {
    sum += Number(code[code.length - 2 - i]) * (i % 2 === 0 ? 3 : 1);
  }
  return ((10 - (sum % 10)) % 10) === Number(code[code.length - 1]);
}

function analyzeBarcode(raw) {
  var c = String(raw || '').trim();
  if (!c) return { type: '', valid: true };
  if (/^\d+$/.test(c)) {
    if (c.length === 13) return { type: 'EAN-13', valid: _tBarcodeCheckDigit(c) };
    if (c.length === 12) return { type: 'UPC-A', valid: _tBarcodeCheckDigit(c) };
    if (c.length === 14) return { type: 'GTIN-14', valid: _tBarcodeCheckDigit(c) };
    if (c.length === 8) return { type: 'EAN-8', valid: _tBarcodeCheckDigit(c) };
    return { type: 'Code 128', valid: true };
  }
  return { type: 'Alfanumérico', valid: true };
}
window.analyzeBarcode = analyzeBarcode;

function _tSyncSharedProducts(products) {
  window._tiendaProducts = Array.isArray(products) ? products : [];
  if (window.POS_STATE) {
    window.POS_STATE.products = window._tiendaProducts;
  }
}

async function fetchTiendaProducts() {
  if (!CUR || !CUR.id) return [];
  try {
    var today = typeof hoyEnNegocio === 'function' ? hoyEnNegocio(CUR.country || 'ES') : new Date().toISOString().split('T')[0];
    var res = await fetch('/api/pos/state?business_id=' + encodeURIComponent(CUR.id) + '&date=' + encodeURIComponent(today), {
      cache: 'no-store'
    });
    if (!res.ok) return window._tiendaProducts || [];
    var data = await res.json();
    _tSyncSharedProducts(data.products || []);
    if (window.POS_STATE) {
      window.POS_STATE.posConfig = data.posConfig || window.POS_STATE.posConfig;
      window.POS_STATE.generalServices = data.generalServices || [];
    }
    return window._tiendaProducts;
  } catch (e) {
    console.error('Error cargando productos de tienda:', e);
    return window._tiendaProducts || [];
  }
}

async function renderTiendaAdmin(skipFetch) {
  if (!CUR || !CUR.id) return;
  if (!skipFetch) {
    await fetchTiendaProducts();
  }
  var prods = window._tiendaProducts || [];
  var alertThreshold = (window.POS_STATE && window.POS_STATE.posConfig) ? window.POS_STATE.posConfig.low_stock_alert : 5;

  // Resumen en cabecera
  var activeCount = prods.filter(function (p) { return p.active !== false; }).length;
  var lowProds = prods.filter(function (p) {
    var minS = p.min_stock != null ? p.min_stock : alertThreshold;
    return p.active !== false && (p.stock || 0) <= minS;
  });
  var sumEl = G('tienda-stock-summary');
  if (sumEl) {
    sumEl.textContent = activeCount + ' activo' + (activeCount === 1 ? '' : 's') + ' · ' + prods.length + ' en catálogo' + (lowProds.length ? ' · ' + lowProds.length + ' por reponer' : '');
  }

  // Banner de stock bajo (plano, sin cards anidadas)
  var bannerEl = G('tienda-low-stock-banner');
  if (bannerEl) {
    if (lowProds.length > 0) {
      var names = lowProds.slice(0, 4).map(function (p) {
        return san(p.name) + ' (' + (p.stock <= 0 ? 'agotado' : p.stock + ' uds') + ')';
      }).join(', ');
      var extra = lowProds.length > 4 ? ' y ' + (lowProds.length - 4) + ' más' : '';
      bannerEl.innerHTML = '<div class="pos-banner warn">'
        + '<div class="pos-banner-left"><span class="pos-banner-icon">' + _tSvg('alert', 16) + '</span>'
        + '<span><strong>Stock bajo:</strong> ' + names + extra + '</span></div></div>';
    } else {
      bannerEl.innerHTML = '';
    }
  }

  // Categorías dinámicas + datalist
  var catSet = {};
  prods.forEach(function (p) {
    var c = (p.category || 'General').trim() || 'General';
    catSet[c] = (catSet[c] || 0) + 1;
  });
  var cats = Object.keys(catSet).sort();

  var datalist = G('cat-list');
  if (datalist) {
    datalist.innerHTML = cats.map(function (c) {
      return '<option value="' + san(c) + '">';
    }).join('');
  }

  if (window._tiendaSelectedCat !== 'ALL' && !catSet[window._tiendaSelectedCat]) {
    window._tiendaSelectedCat = 'ALL';
  }

  var catContainer = G('biz-categorias-list');
  if (catContainer) {
    var catHtml = '<button type="button" class="tienda-cat-pill' + (window._tiendaSelectedCat === 'ALL' ? ' active' : '') + '" data-cat="ALL">Todos (' + prods.length + ')</button>';
    cats.forEach(function (c) {
      catHtml += '<button type="button" class="tienda-cat-pill' + (window._tiendaSelectedCat === c ? ' active' : '') + '" data-cat="' + san(c) + '">' + san(c) + ' (' + catSet[c] + ')</button>';
    });
    catContainer.innerHTML = catHtml;
    catContainer.querySelectorAll('.tienda-cat-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window._tiendaSelectedCat = btn.getAttribute('data-cat') || 'ALL';
        renderTiendaAdmin(true);
      });
    });
  }

  // Filtrado de productos
  var q = _tNorm(window._tiendaSearch);
  var filtered = prods.filter(function (p) {
    if (window._tiendaSelectedCat !== 'ALL' && ((p.category || 'General').trim() !== window._tiendaSelectedCat)) {
      return false;
    }
    if (!q) return true;
    return _tNorm(p.name).indexOf(q) >= 0 ||
      _tNorm(p.category).indexOf(q) >= 0 ||
      _tNorm(p.barcode).indexOf(q) >= 0 ||
      _tNorm(p.supplier).indexOf(q) >= 0;
  });

  var grid = G('biz-productos-list');
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="pos-surface pos-surface-pad" style="grid-column:1/-1;text-align:center;color:var(--t2);font-size:13px">'
      + (prods.length === 0
        ? 'Aún no tienes productos registrados. Pulsa "+ Producto" o escanea un código de barras para añadir el primero.'
        : 'No se encontraron productos con ese filtro.')
      + '</div>';
    return;
  }

  grid.innerHTML = filtered.map(function (p) {
    var imgs = _tParseImages(p.image);
    var firstImg = imgs.length ? sanitizeImageDataURL(imgs[0]) : '';
    var minS = p.min_stock != null ? p.min_stock : alertThreshold;
    var st = parseInt(p.stock, 10) || 0;
    var stockClass = st <= 0 ? 'out' : (st <= minS ? 'low' : '');
    var stockLabel = st <= 0 ? 'Agotado' : (st + ' uds');
    var disc = parseFloat(p.discount_percent) || 0;
    var finalPrice = disc > 0 ? (p.price * (1 - disc / 100)) : p.price;

    return '<div class="tienda-prod-item' + (p.active === false ? ' inactive' : '') + '" data-prod-id="' + san(p.id) + '">'
      + '<div class="tienda-prod-thumb">'
      + (firstImg ? '<img src="' + san(firstImg) + '" alt="' + san(p.name) + '"/>' : _tSvg('box', 30))
      + '</div>'
      + '<div class="tienda-prod-body">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">'
      + '<span style="font-size:11px;color:var(--t2);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + san(p.category || 'General') + '</span>'
      + '<span class="pos-stock-tag ' + stockClass + '">' + stockLabel + '</span>'
      + '</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--text);line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + san(p.name) + '</div>'
      + (p.barcode ? '<div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums">' + _tSvg('barcode', 12) + '<span>' + san(p.barcode) + '</span></div>' : '')
      + '<div class="tienda-prod-footer">'
      + '<div class="pos-num" style="font-size:15px;font-weight:800;color:var(--blue)">' + money(finalPrice)
      + (disc > 0 ? ' <span style="font-size:11px;color:var(--muted);text-decoration:line-through;font-weight:500">' + money(p.price) + '</span>' : '')
      + '</div>'
      + (p.active === false ? '<span style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Oculto</span>' : '')
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  grid.querySelectorAll('.tienda-prod-item').forEach(function (card) {
    card.addEventListener('click', function () {
      openProdModal(card.getAttribute('data-prod-id'));
    });
  });
}

function filterTiendaAdmin(val) {
  window._tiendaSearch = String(val || '');
  renderTiendaAdmin(true);
}

function handleTiendaBarcodeInput(inputEl) {
  var code = String(inputEl && inputEl.value || '').trim();
  if (!code) return;
  var prods = window._tiendaProducts || [];
  var found = prods.find(function (p) { return p.barcode && String(p.barcode).trim() === code; });
  if (found) {
    inputEl.value = '';
    window._tiendaSearch = '';
    openProdModal(found.id);
    return;
  }
  // Si parece un código de barras (>= 6 dígitos) y no existe, abrir creación con código prellenado
  if (/^\d{6,18}$/.test(code)) {
    inputEl.value = '';
    window._tiendaSearch = '';
    openProdModal(null, code);
    toast('Código no registrado. Completa los datos del producto.', '#4A7FD4');
  }
}

function updateBarcodeHint() {
  var inp = G('prod-barcode');
  var hint = G('prod-barcode-hint');
  if (!inp || !hint) return;
  var val = inp.value.trim();
  if (!val) {
    hint.textContent = 'Escanea con lector USB o Bluetooth para rellenar automáticamente.';
    hint.style.color = 'var(--t2)';
    return;
  }
  var info = analyzeBarcode(val);
  var dup = (window._tiendaProducts || []).find(function (p) {
    return p.barcode && String(p.barcode).trim() === val && p.id !== window._editingProdId;
  });
  if (dup) {
    hint.textContent = 'Este código ya pertenece a "' + dup.name + '".';
    hint.style.color = 'var(--red)';
  } else if (!info.valid) {
    hint.textContent = info.type + ' · El dígito de control no coincide.';
    hint.style.color = 'var(--gold)';
  } else {
    hint.textContent = info.type + ' válido.';
    hint.style.color = 'var(--green)';
  }
}

function renderProdPhotoPreviews() {
  var cont = G('prod-photo-previews');
  if (!cont) return;
  var html = (window._prodPhotos || []).map(function (url, idx) {
    var safe = sanitizeImageDataURL(url);
    return '<div style="position:relative;width:68px;height:68px;border-radius:12px;overflow:hidden;border:1px solid var(--b);flex-shrink:0">'
      + '<img src="' + san(safe) + '" style="width:100%;height:100%;object-fit:cover" alt="Foto producto"/>'
      + '<button type="button" data-idx="' + idx + '" class="prod-rm-photo" style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.72);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer">' + _tSvg('close', 11) + '</button>'
      + '</div>';
  }).join('');

  html += '<button type="button" id="prod-add-photo-btn" style="width:68px;height:68px;border-radius:12px;border:1.5px dashed var(--b);background:var(--bg3);color:var(--t2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">' + _tSvg('plus', 20) + '</button>';

  cont.innerHTML = html;
  cont.style.display = 'flex';
  cont.style.flexWrap = 'wrap';
  cont.style.gap = '8px';

  var addBtn = G('prod-add-photo-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      var fi = G('prod-photo-input');
      if (fi) fi.click();
    });
  }
  cont.querySelectorAll('.prod-rm-photo').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var i = parseInt(btn.getAttribute('data-idx'), 10);
      if (!isNaN(i)) {
        window._prodPhotos.splice(i, 1);
        renderProdPhotoPreviews();
      }
    });
  });
}

function bindProdPhotoInput() {
  var fi = G('prod-photo-input');
  if (!fi || fi.dataset.bound === '1') return;
  fi.dataset.bound = '1';
  fi.addEventListener('change', async function () {
    var files = Array.from(fi.files || []);
    if (!files.length) return;
    toast('Subiendo imagen...', '#4A7FD4');
    for (var i = 0; i < files.length; i++) {
      try {
        var f = files[i];
        if (typeof processImageForUpload === 'function') {
          f = await processImageForUpload(f);
        }
        if (typeof uploadToImgBB === 'function') {
          var url = await uploadToImgBB(f);
          if (url) window._prodPhotos.push(url);
        }
      } catch (e) {
        console.error('Error subiendo foto de producto:', e);
      }
    }
    fi.value = '';
    renderProdPhotoPreviews();
    toast('Imagen lista', '#22C55E');
  });
}

function openProdModal(prodId, prefillBarcode) {
  bindProdPhotoInput();
  var sym = typeof getSimboloMoneda === 'function' ? getSimboloMoneda() : '€';
  var lblPrice = G('prod-price-lbl');
  var lblCost = G('prod-cost-lbl');
  if (lblPrice) lblPrice.textContent = 'Precio de venta (' + sym + ') *';
  if (lblCost) lblCost.textContent = 'Coste de compra (' + sym + ')';

  var prod = prodId ? (window._tiendaProducts || []).find(function (p) { return p.id === prodId; }) : null;
  window._editingProdId = prod ? prod.id : null;
  window._prodPhotos = prod ? _tParseImages(prod.image) : [];

  var titleEl = G('prod-modal-title');
  if (titleEl) titleEl.textContent = prod ? 'Editar producto' : 'Añadir producto';

  if (G('prod-barcode')) G('prod-barcode').value = prod ? (prod.barcode || '') : (prefillBarcode || '');
  if (G('prod-name')) G('prod-name').value = prod ? (prod.name || '') : '';
  if (G('prod-cat')) G('prod-cat').value = prod ? (prod.category || 'General') : '';
  if (G('prod-price')) G('prod-price').value = prod ? prod.price : '';
  if (G('prod-cost')) G('prod-cost').value = prod && prod.cost_price ? prod.cost_price : '';
  if (G('prod-stock')) G('prod-stock').value = prod ? (prod.stock != null ? prod.stock : 0) : 10;
  if (G('prod-min-stock')) G('prod-min-stock').value = prod ? (prod.min_stock != null ? prod.min_stock : 5) : 5;
  if (G('prod-discount')) G('prod-discount').value = prod ? (prod.discount_percent || 0) : 0;
  if (G('prod-supplier')) G('prod-supplier').value = prod ? (prod.supplier || '') : '';
  if (G('prod-desc')) G('prod-desc').value = prod ? (prod.description || '') : '';

  var activeSw = G('prod-active-switch');
  if (activeSw) {
    if (!prod || prod.active !== false) activeSw.classList.add('on');
    else activeSw.classList.remove('on');
  }

  var delBtn = G('prod-delete-btn');
  if (delBtn) delBtn.style.display = prod ? 'inline-flex' : 'none';

  renderProdPhotoPreviews();
  updateBarcodeHint();
  if (typeof actualizarPreviewDescuento === 'function') actualizarPreviewDescuento();
  openOv('ov-tienda-prod');
}

async function saveProduct() {
  if (!CUR || !CUR.id) return;
  var name = V('prod-name').trim();
  var cat = V('prod-cat').trim() || 'General';
  var price = parseFloat(V('prod-price'));
  var cost = parseFloat(V('prod-cost')) || 0;
  var stock = parseInt(V('prod-stock'), 10);
  var minStock = parseInt(V('prod-min-stock'), 10);
  var discount = Math.min(90, Math.max(0, parseFloat(V('prod-discount')) || 0));
  var barcode = V('prod-barcode').trim();
  var supplier = V('prod-supplier').trim();
  var desc = V('prod-desc').trim();
  var activeSw = G('prod-active-switch');
  var isActive = activeSw ? activeSw.classList.contains('on') : true;

  if (!name) { toast('Escribe el nombre del producto', '#EF4444'); return; }
  if (isNaN(price) || price < 0) { toast('Introduce un precio válido', '#EF4444'); return; }

  var btn = G('prod-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    var imgValue = window._prodPhotos.length > 1
      ? JSON.stringify(window._prodPhotos)
      : (window._prodPhotos[0] || '');

    var res = await fetch('/api/pos/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: CUR.id,
        product: {
          id: window._editingProdId || undefined,
          name: name,
          category: cat,
          price: price,
          cost_price: cost,
          stock: isNaN(stock) ? 0 : Math.max(0, stock),
          min_stock: isNaN(minStock) ? 5 : Math.max(0, minStock),
          discount_percent: discount,
          barcode: barcode,
          supplier: supplier,
          description: desc,
          image: imgValue,
          active: isActive
        }
      })
    });

    var data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'No se pudo guardar el producto');
    }

    closeOv('ov-tienda-prod');
    toast(window._editingProdId ? 'Producto actualizado' : 'Producto guardado', '#22C55E');
    await renderTiendaAdmin(false);
    if (typeof window.posRender === 'function' && G('bp-caja') && G('bp-caja').classList.contains('on')) {
      window.posRender();
    }
  } catch (err) {
    toast(err.message || 'Error al guardar producto', '#EF4444');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar producto'; }
  }
}

function confirmDeleteCurrentProduct() {
  var id = window._editingProdId;
  if (!id || !CUR || !CUR.id) return;
  openConfirmModal('Eliminar producto', 'Esta acción eliminará el producto del catálogo de Tienda y Caja.', async function () {
    try {
      var res = await fetch('/api/pos/product-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: CUR.id, product_id: id })
      });
      var data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error eliminando');
      closeOv('ov-tienda-prod');
      toast('Producto eliminado', '#475569');
      await renderTiendaAdmin(false);
      if (typeof window.posRender === 'function' && G('bp-caja') && G('bp-caja').classList.contains('on')) {
        window.posRender();
      }
    } catch (e) {
      toast(e.message || 'No se pudo eliminar', '#EF4444');
    }
  });
}

function openTiendaDiscountModal() {
  var sel = G('tcd-cat');
  if (!sel) return;
  var cats = {};
  (window._tiendaProducts || []).forEach(function (p) {
    var c = (p.category || 'General').trim() || 'General';
    cats[c] = true;
  });
  var list = Object.keys(cats).sort();
  if (!list.length) {
    toast('Primero añade productos con categoría', '#F59E0B');
    return;
  }
  sel.innerHTML = list.map(function (c) {
    return '<option value="' + san(c) + '">' + san(c) + '</option>';
  }).join('');
  if (G('tcd-pct')) G('tcd-pct').value = '0';
  openOv('ov-tienda-cat-disc');
}

async function applyCategoryDiscount() {
  if (!CUR || !CUR.id) return;
  var cat = V('tcd-cat');
  var pct = Math.min(90, Math.max(0, parseFloat(V('tcd-pct')) || 0));
  if (!cat) return;

  try {
    var res = await fetch('/api/pos/category-discount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: CUR.id, category: cat, discount_percent: pct })
    });
    var data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Error aplicando descuento');
    closeOv('ov-tienda-cat-disc');
    toast('Descuento aplicado a ' + cat, '#22C55E');
    await renderTiendaAdmin(false);
  } catch (e) {
    toast(e.message || 'No se pudo aplicar el descuento', '#EF4444');
  }
}

window.renderTiendaAdmin = renderTiendaAdmin;
window.filterTiendaAdmin = filterTiendaAdmin;
window.handleTiendaBarcodeInput = handleTiendaBarcodeInput;
window.updateBarcodeHint = updateBarcodeHint;
window.openProdModal = openProdModal;
window.openProductModal = openProdModal;
window.saveProduct = saveProduct;
window.confirmDeleteCurrentProduct = confirmDeleteCurrentProduct;
window.openTiendaDiscountModal = openTiendaDiscountModal;
window.applyCategoryDiscount = applyCategoryDiscount;
