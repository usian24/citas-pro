'use strict';
// config-pais.js — CitasPro v2
// ══════════════════════════════════════════════════════════════
// Solución definitiva al problema de moneda:
// 1. money() se sobreescribe ANTES de que db.js defina la suya
// 2. Cuando CUR carga, refreshMoney() repinta todos los precios
// 3. Si country es NULL en Supabase, lo lee del localStorage
// 4. Precios adaptados con equivalencia en USD para mayor confianza
// ══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// 1. DICCIONARIO CENTRAL
// ─────────────────────────────────────────
const PAIS_CONFIG = {
  ES: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Madrid',                     decimales:2 },
  CO: { simbolo:'$',   nombre:'Peso colombiano',   posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Bogota',                    decimales:0 },
  MX: { simbolo:'$',   nombre:'Peso mexicano',     posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Mexico_City',               decimales:2 },
  AR: { simbolo:'$',   nombre:'Peso argentino',    posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Argentina/Buenos_Aires',    decimales:2 },
  PE: { simbolo:'S/',  nombre:'Sol peruano',       posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Lima',                      decimales:2 },
  CL: { simbolo:'$',   nombre:'Peso chileno',      posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Santiago',                  decimales:0 },
  VE: { simbolo:'Bs.', nombre:'Bolívar',           posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Caracas',                   decimales:2 },
  EC: { simbolo:'$',   nombre:'Dólar (Ecuador)',   posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Guayaquil',                 decimales:2 },
  DO: { simbolo:'RD$', nombre:'Peso dominicano',   posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Santo_Domingo',             decimales:2 },
  US: { simbolo:'$',   nombre:'Dólar americano',   posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/New_York',                  decimales:2 },
  BR: { simbolo:'R$',  nombre:'Real brasileño',    posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Sao_Paulo',                 decimales:2 },
  DE: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Berlin',                     decimales:2 },
  NL: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Amsterdam',                  decimales:2 },
  FR: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Paris',                      decimales:2 }
};
const PAIS_DEFAULT = PAIS_CONFIG['ES'];

// ─────────────────────────────────────────
// 2. DETECTAR PAÍS — con múltiples fuentes
// ─────────────────────────────────────────
function getPaisActivo() {
  // Fuente 1: CUR activo (dueño logueado)
  if (typeof CUR !== 'undefined' && CUR && CUR.country && CUR.country !== 'null') {
    return CUR.country;
  }
  // Fuente 2: trabajador logueado → busca su negocio
  if (typeof CUR_WORKER !== 'undefined' && CUR_WORKER &&
      typeof DB !== 'undefined' && DB && DB.businesses) {
    const bizId = DB.currentWorker && DB.currentWorker.bizId;
    if (bizId) {
      const biz = DB.businesses.find(b => b.id === bizId);
      if (biz && biz.country && biz.country !== 'null') return biz.country;
    }
  }
  // Fuente 3: localStorage — país guardado de la última sesión
  try {
    const cached = localStorage.getItem('cp_pais');
    if (cached && PAIS_CONFIG[cached]) return cached;
  } catch(e) {}
  // Fuente 4: fallback España
  return 'ES';
}

function getConfigPais(cod) {
  return PAIS_CONFIG[cod] || PAIS_DEFAULT;
}

// ─────────────────────────────────────────
// 3. FORMATEAR DINERO
// ─────────────────────────────────────────
function formatMoney(n, codigoPais) {
  const cfg = getConfigPais(codigoPais || getPaisActivo());
  const num = parseFloat(n) || 0;
  const factor  = Math.pow(10, cfg.decimales);
  const rounded = Math.round(num * factor) / factor;
  const parts   = rounded.toFixed(cfg.decimales).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, cfg.separadorMiles);
  const numStr = cfg.decimales > 0 ? parts.join(cfg.separadorDecimal) : parts[0];
  return cfg.posicion === 'izquierda' ? cfg.simbolo + numStr : numStr + ' ' + cfg.simbolo;
}

// ─────────────────────────────────────────
// 4. SOBRESCRIBIR money() — se ejecuta AHORA
//    antes de que db.js defina la suya
// ─────────────────────────────────────────
window.money = function(n) {
  return formatMoney(n, getPaisActivo());
};

// ─────────────────────────────────────────
// 5. GUARDAR PAÍS EN LOCALSTORAGE
//    Se llama cuando CUR se carga para que
//    la próxima vez esté disponible de inmediato
// ─────────────────────────────────────────
function guardarPaisEnCache(pais) {
  if (!pais || pais === 'null') return;
  try { localStorage.setItem('cp_pais', pais); } catch(e) {}
}

// ─────────────────────────────────────────
// 6. REFRESCAR TODOS LOS PRECIOS EN PANTALLA
//    Se llama después de que CUR carga
//    para repintar cualquier € que ya se mostró
// ─────────────────────────────────────────
function refreshMoneyUI() {
  // Repintar elementos que usan money() directamente como texto
  // Precio de suscripción
  adaptarPrecioLocal(getPaisActivo());
}

// ─────────────────────────────────────────
// 7. PRECIO DE SUSCRIPCIÓN (Visuales + USD)
// ─────────────────────────────────────────
const PRECIO_SUSCRIPCION = {
  PE: 'S/ 25 / $6.60 USD',
  EC: '$10 USD',
  CO: '$ 25,248.62 / $6.50 USD',
  US: '$15 USD',
  MX: '$ 227.58 / $13 USD',
  ES: '10€ / $11 USD',
  CL: '$10 USD',
  AR: '$ 10,830.13 / $12 USD',
  // Los demás pasan al estándar global equivalente a $15 USD
  BR: 'R$ 80 / $15 USD',
  VE: 'Bs. 540 / $15 USD',
  DO: 'RD$ 890 / $15 USD',
  DE: '14€ / $15 USD',
  NL: '14€ / $15 USD',
  FR: '14€ / $15 USD'
};

function adaptarPrecioLocal(pais) {
  const precio = PRECIO_SUSCRIPCION[pais] || '$15 USD'; // Nuevo fallback global en 15 USD
  document.querySelectorAll('.precio-local-mes').forEach(function(el) {
    el.textContent = precio + '/mes';
  });
  document.querySelectorAll('.precio-local-solo').forEach(function(el) {
    el.textContent = precio;
  });
}

async function adaptarPrecioLocalPorIP() {
  // Si ya tenemos el país del negocio, usarlo
  const pais = getPaisActivo();
  if (pais && pais !== 'ES') {
    adaptarPrecioLocal(pais);
    return;
  }
  // Fallback por IP (solo para landing sin sesión)
  try {
    const res   = await fetch('https://api.country.is/');
    const datos = await res.json();
    const paisIP = datos.country || 'ES';
    adaptarPrecioLocal(paisIP);
    guardarPaisEnCache(paisIP);
  } catch(e) {
    adaptarPrecioLocal('ES'); 
  }
}

// ─────────────────────────────────────────
// 8. ZONA HORARIA
// ─────────────────────────────────────────
function getTimezone(cod) {
  return getConfigPais(cod || getPaisActivo()).timezone;
}

function ahoraEnNegocio(codigoPais) {
  const tz  = getTimezone(codigoPais || getPaisActivo());
  const now = new Date();
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
    });
    const p = {};
    fmt.formatToParts(now).forEach(x => { p[x.type] = x.value; });
    return new Date(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second);
  } catch(e) { return now; }
}

function hoyEnNegocio(codigoPais) {
  var now = ahoraEnNegocio(codigoPais);
  return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
}

function formatHora(horaStr, codigoPais) {
  if ((codigoPais || getPaisActivo()) === 'US') {
    const parts = (horaStr||'').split(':');
    const h = parseInt(parts[0]||0), m = parts[1]||'00';
    return (h%12||12)+':'+m+(h>=12?' PM':' AM');
  }
  return horaStr;
}

// ─────────────────────────────────────────
// 9. HELPERS
// ─────────────────────────────────────────
function getSimboloMoneda(cod) { return getConfigPais(cod||getPaisActivo()).simbolo; }
function getLabelPrecio(cod)   { const c = getConfigPais(cod||getPaisActivo()); return 'Precio ('+c.simbolo+')'; }
function getNombreMoneda(cod)  { return getConfigPais(cod||getPaisActivo()).nombre; }

function actualizarLabelsPrecio() {
  const cfg = getConfigPais(getPaisActivo());
  const label = 'Precio (' + cfg.simbolo + ')';
  ['prod-price','wk-sv-price'].forEach(function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const lbl = el.previousElementSibling;
    if (lbl && lbl.tagName === 'LABEL') lbl.textContent = label;
  });
}

// ─────────────────────────────────────────
// 10. EXPORTAR TODO
// ─────────────────────────────────────────
window.PAIS_CONFIG             = PAIS_CONFIG;
window.PRECIO_SUSCRIPCION      = PRECIO_SUSCRIPCION;
window.getPaisActivo           = getPaisActivo;
window.getConfigPais           = getConfigPais;
window.formatMoney             = formatMoney;
window.getSimboloMoneda        = getSimboloMoneda;
window.getLabelPrecio          = getLabelPrecio;
window.getNombreMoneda         = getNombreMoneda;
window.getTimezone             = getTimezone;
window.ahoraEnNegocio          = ahoraEnNegocio;
window.hoyEnNegocio            = hoyEnNegocio;
window.formatHora              = formatHora;
window.actualizarLabelsPrecio  = actualizarLabelsPrecio;
window.adaptarPrecioLocal      = adaptarPrecioLocal;
window.adaptarPrecioLocalPorIP = adaptarPrecioLocalPorIP;
window.guardarPaisEnCache      = guardarPaisEnCache;
window.refreshMoneyUI          = refreshMoneyUI;

// ─────────────────────────────────────────
// 11. ARRANQUE — sin delay, inmediato
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  adaptarPrecioLocalPorIP();
  actualizarLabelsPrecio();
});