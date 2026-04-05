'use strict';
// config-pais.js — CitasPro v2
// ══════════════════════════════════════════════════════════════
// Solución definitiva al problema de moneda:
// 1. money() se sobreescribe ANTES de que db.js defina la suya
// 2. Cuando CUR carga, refreshMoney() repinta todos los precios
// 3. Si country es NULL en Supabase, lo lee del localStorage
// ══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// 1. DICCIONARIO CENTRAL
// ─────────────────────────────────────────
var PAIS_CONFIG = {
  ES: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Madrid',                     decimales:2 },
  CO: { simbolo:'$',   nombre:'Peso colombiano',   posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Bogota',                    decimales:0 },
  MX: { simbolo:'$',   nombre:'Peso mexicano',     posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Mexico_City',               decimales:2 },
  AR: { simbolo:'$',   nombre:'Peso argentino',    posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Argentina/Buenos_Aires',    decimales:2 },
  PE: { simbolo:'S/',  nombre:'Sol peruano',       posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Lima',                      decimales:2 },
  CL: { simbolo:'$',   nombre:'Peso chileno',      posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Santiago',                  decimales:0 },
  VE: { simbolo:'Bs.', nombre:'Bolívar',            posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Caracas',                  decimales:2 },
  EC: { simbolo:'$',   nombre:'Dólar (Ecuador)',   posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Guayaquil',                 decimales:2 },
  DO: { simbolo:'RD$', nombre:'Peso dominicano',   posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Santo_Domingo',             decimales:2 },
  US: { simbolo:'$',   nombre:'Dólar americano',   posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/New_York',                  decimales:2 },
  BR: { simbolo:'R$',  nombre:'Real brasileño',    posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Sao_Paulo',                 decimales:2 },
  DE: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Berlin',                     decimales:2 },
  NL: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Amsterdam',                  decimales:2 },
  FR: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Paris',                      decimales:2 }
};
var PAIS_DEFAULT = PAIS_CONFIG['ES'];

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
    var bizId = DB.currentWorker && DB.currentWorker.bizId;
    if (bizId) {
      var biz = DB.businesses.find(function(b) { return b.id === bizId; });
      if (biz && biz.country && biz.country !== 'null') return biz.country;
    }
  }
  // Fuente 3: localStorage — país guardado de la última sesión
  try {
    var cached = localStorage.getItem('cp_pais');
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
  var cfg = getConfigPais(codigoPais || getPaisActivo());
  var num = parseFloat(n) || 0;
  var factor  = Math.pow(10, cfg.decimales);
  var rounded = Math.round(num * factor) / factor;
  var parts   = rounded.toFixed(cfg.decimales).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, cfg.separadorMiles);
  var numStr = cfg.decimales > 0 ? parts.join(cfg.separadorDecimal) : parts[0];
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
// 7. PRECIO DE SUSCRIPCIÓN
// ─────────────────────────────────────────
var PRECIO_SUSCRIPCION = {
  PE:'S/ 30', ES:'10€', CO:'$ 40.000', MX:'$ 200',
  CL:'$ 10.000', AR:'$ 10.000', US:'$ 15',
  BR:'R$ 50', VE:'$10', EC:'$10', DO:'RD$ 600',
  DE:'10€', NL:'10€', FR:'10€'
};

function adaptarPrecioLocal(pais) {
  var precio = PRECIO_SUSCRIPCION[pais] || '10€';
  document.querySelectorAll('.precio-local-mes').forEach(function(el) {
    el.textContent = precio + '/mes';
  });
  document.querySelectorAll('.precio-local-solo').forEach(function(el) {
    el.textContent = precio;
  });
}

async function adaptarPrecioLocalPorIP() {
  // Si ya tenemos el país del negocio, usarlo
  var pais = getPaisActivo();
  if (pais && pais !== 'ES') {
    adaptarPrecioLocal(pais);
    return;
  }
  // Fallback por IP (solo para landing sin sesión)
  try {
    var res   = await fetch('https://api.country.is/');
    var datos = await res.json();
    var paisIP = datos.country || 'ES';
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
  var tz  = getTimezone(codigoPais || getPaisActivo());
  var now = new Date();
  try {
    var fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
    });
    var p = {};
    fmt.formatToParts(now).forEach(function(x) { p[x.type] = x.value; });
    return new Date(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second);
  } catch(e) { return now; }
}

function hoyEnNegocio(codigoPais) {
  var now = ahoraEnNegocio(codigoPais);
  return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
}

function formatHora(horaStr, codigoPais) {
  if ((codigoPais || getPaisActivo()) === 'US') {
    var parts = (horaStr||'').split(':');
    var h = parseInt(parts[0]||0), m = parts[1]||'00';
    return (h%12||12)+':'+m+(h>=12?' PM':' AM');
  }
  return horaStr;
}

// ─────────────────────────────────────────
// 9. HELPERS
// ─────────────────────────────────────────
function getSimboloMoneda(cod) { return getConfigPais(cod||getPaisActivo()).simbolo; }
function getLabelPrecio(cod)   { var c = getConfigPais(cod||getPaisActivo()); return 'Precio ('+c.simbolo+')'; }
function getNombreMoneda(cod)  { return getConfigPais(cod||getPaisActivo()).nombre; }

function actualizarLabelsPrecio() {
  var cfg = getConfigPais(getPaisActivo());
  var label = 'Precio (' + cfg.simbolo + ')';
  ['prod-price','wk-sv-price'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var lbl = el.previousElementSibling;
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