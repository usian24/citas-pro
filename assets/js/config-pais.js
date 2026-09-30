'use strict';
// config-pais.js — CitasPro v2
// ══════════════════════════════════════════════════════════════
// Solución de Pricing Dinámico con PPP y Moneda Local
// 1. Manejo de USD internamente (SaaS PPP)
// 2. Muestra precios locales en Landing y Modal basados en la tasa de cambio
// ══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// 1. DICCIONARIO CENTRAL
// ─────────────────────────────────────────
const PAIS_CONFIG = {
  ES: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Madrid',                    decimales:2, tasaUSD: 0.90 },
  CO: { simbolo:'$',   nombre:'Peso colombiano',   posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Bogota',                   decimales:0, tasaUSD: 4150 },
  MX: { simbolo:'$',   nombre:'Peso mexicano',     posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Mexico_City',               decimales:2, tasaUSD: 19.50 },
  AR: { simbolo:'$',   nombre:'Peso argentino',    posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Argentina/Buenos_Aires',    decimales:2, tasaUSD: 980 },
  PE: { simbolo:'S/',  nombre:'Sol peruano',       posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Lima',                      decimales:2, tasaUSD: 3.75 },
  CL: { simbolo:'$',   nombre:'Peso chileno',      posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Santiago',                  decimales:0, tasaUSD: 920 },
  VE: { simbolo:'Bs.', nombre:'Bolívar',           posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Caracas',                   decimales:2, tasaUSD: 36.80 },
  EC: { simbolo:'$',   nombre:'Dólar (Ecuador)',   posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Guayaquil',                 decimales:2, tasaUSD: 1 },
  DO: { simbolo:'RD$', nombre:'Peso dominicano',   posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/Santo_Domingo',             decimales:2, tasaUSD: 60 },
  US: { simbolo:'$',   nombre:'Dólar americano',   posicion:'izquierda', separadorDecimal:'.', separadorMiles:',', timezone:'America/New_York',                  decimales:2, tasaUSD: 1 },
  BR: { simbolo:'R$',  nombre:'Real brasileño',    posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Sao_Paulo',                 decimales:2, tasaUSD: 5.50 },
  DE: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Berlin',                     decimales:2, tasaUSD: 0.90 },
  NL: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Amsterdam',                  decimales:2, tasaUSD: 0.90 },
  FR: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Paris',                      decimales:2, tasaUSD: 0.90 }
};
const PAIS_DEFAULT = PAIS_CONFIG['ES'];

// ─────────────────────────────────────────
// 2. DETECTAR PAÍS — con múltiples fuentes
// ─────────────────────────────────────────
function getPaisActivo() {
  if (typeof CUR !== 'undefined' && CUR && CUR.country && CUR.country !== 'null') {
    return CUR.country;
  }
  if (typeof CUR_WORKER !== 'undefined' && CUR_WORKER &&
      typeof DB !== 'undefined' && DB && DB.businesses) {
    const bizId = DB.currentWorker && DB.currentWorker.bizId;
    if (bizId) {
      const biz = DB.businesses.find(b => b.id === bizId);
      if (biz && biz.country && biz.country !== 'null') return biz.country;
    }
  }
  try {
    const cached = localStorage.getItem('cp_pais');
    if (cached && PAIS_CONFIG[cached]) return cached;
  } catch(e) {}
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
// 4. SOBRESCRIBIR money()
// ─────────────────────────────────────────
window.money = function(n) {
  return formatMoney(n, getPaisActivo());
};

// ─────────────────────────────────────────
// 5. GUARDAR PAÍS EN LOCALSTORAGE
// ─────────────────────────────────────────
function guardarPaisEnCache(pais) {
  if (!pais || pais === 'null') return;
  try { localStorage.setItem('cp_pais', pais); } catch(e) {}
}

// ─────────────────────────────────────────
// 6. REFRESCAR TODOS LOS PRECIOS EN PANTALLA
// ─────────────────────────────────────────
function refreshMoneyUI() {
  adaptarPrecioLocal(getPaisActivo());
}

// ─────────────────────────────────────────
// 7. PRECIO DE SUSCRIPCIÓN (Visuales Locales con Base USD)
// ─────────────────────────────────────────
const PRECIO_SUSCRIPCION_USD = {
  US: 11.50,
  ES: 10.00,
  MX: 7.00,
  CL: 6.50,
  PE: 6.00,
  CO: 5.00,
  AR: 4.00,
  EC: 6.00,
  DO: 6.00,
  VE: 6.00,
  BR: 6.00,
  DEFAULT: 10.00
};

function adaptarPrecioLocal(pais) {
  const precioUSD = PRECIO_SUSCRIPCION_USD[pais] || PRECIO_SUSCRIPCION_USD['DEFAULT'];

  // Formato estricto en Dólares (USD) para evitar confusiones en Checkout
  const strMes = "$" + precioUSD.toFixed(2) + " USD";
  const strTri = "$" + (precioUSD * 2.8).toFixed(2) + " USD";
  const strAnu = "$" + (precioUSD * 10).toFixed(2) + " USD";
  
  // Inyectamos en las tarjetas de la Landing Page
  const elMes = document.getElementById('precio-mensual-val');
  const elTri = document.getElementById('precio-trimestral-val');
  const elAnu = document.getElementById('precio-anual-val');
  
  if (elMes) elMes.textContent = strMes;
  if (elTri) elTri.textContent = strTri;
  if (elAnu) elAnu.textContent = strAnu;

  // Actualizamos el modal de Suscripción en el portal del negocio (biz.html)
  const txtMes = document.getElementById('txt-precio-mensual');
  const txtTri = document.getElementById('txt-precio-trimestral');
  const txtAnu = document.getElementById('txt-precio-anual');

  if (txtMes) txtMes.textContent = strMes + ' / mes';
  if (txtTri) txtTri.textContent = strTri + ' / 3 meses';
  if (txtAnu) txtAnu.textContent = strAnu + ' / año';

  document.querySelectorAll('.precio-local-mes').forEach(el => el.textContent = strMes + ' / mes');
  document.querySelectorAll('.precio-local-solo').forEach(el => el.textContent = strMes);
}

async function adaptarPrecioLocalPorIP() {
  const pais = getPaisActivo();
  // Si tenemos un país en caché y NO es el fallback de error, lo usamos directamente
  if (pais && pais !== 'ES' && pais !== 'DEFAULT') {
    adaptarPrecioLocal(pais);
    return;
  }
  
  let paisIP = null;
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/country.json');
    const datos = await res.json();
    paisIP = datos.country;
  } catch (e1) {
    try {
      const res = await fetch('https://api.country.is/');
      const datos = await res.json();
      paisIP = datos.country;
    } catch (e2) {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const datos = await res.json();
        paisIP = datos.country_code;
      } catch (e3) {
        paisIP = 'DEFAULT';
      }
    }
  }

  paisIP = paisIP || 'DEFAULT';
  adaptarPrecioLocal(paisIP);
  guardarPaisEnCache(paisIP);
}

// ─────────────────────────────────────────
// 8. ZONA HORARIA Y UTILIDADES (Conservadas intactas)
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
// 9. ENLACES DE DODOPAYMENTS POR PAÍS
// ─────────────────────────────────────────
const LINKS_DODO = {
  AR: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohPPyfHVTpaDxFwcxMn", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohPUyMKOQqHbuAasO2a", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohPa3e8gTRjgtyl0Yxr" },
  CO: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohP7bpTehnh1pxT81wJ", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohPBxdsogHguE3wwN2b", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohPFouJkKV2e4l4UEuK" },
  PE: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOVVbcUVAakFd14DHe", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohOqI8P5EZhJToHKAzd", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOzFyjPMXYPbxtWQZR" },
  EC: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOVVbcUVAakFd14DHe", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohOqI8P5EZhJToHKAzd", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOzFyjPMXYPbxtWQZR" },
  DO: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOVVbcUVAakFd14DHe", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohOqI8P5EZhJToHKAzd", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOzFyjPMXYPbxtWQZR" },
  VE: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOVVbcUVAakFd14DHe", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohOqI8P5EZhJToHKAzd", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOzFyjPMXYPbxtWQZR" },
  BR: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOVVbcUVAakFd14DHe", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohOqI8P5EZhJToHKAzd", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOzFyjPMXYPbxtWQZR" },
  CL: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohNoABnkIo8sdQG2lS6", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohNx2pVUetxlVJXRnRR", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohOHNQ1Oh9sndZUgwaH" },
  MX: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohNWH01gL8TLrCINV02", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohNci7U4Uma7IhbtO5k", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohNiF1xBhKwmALqqhSx" },
  ES: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohLnegsV9afjkpBkjFf", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohNCYrnpvbomICgbgxx", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohNJFAbxhb7m3lTuSF9" },
  US: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohGpuhbMIcE4DNHLDaj", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohLHRcyWTA69dsyfZ3B", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohLQ8gI1G3zuocXEeD6" },
  DE: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohLnegsV9afjkpBkjFf", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohNCYrnpvbomICgbgxx", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohNJFAbxhb7m3lTuSF9" },
  NL: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohLnegsV9afjkpBkjFf", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohNCYrnpvbomICgbgxx", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohNJFAbxhb7m3lTuSF9" },
  FR: { mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohLnegsV9afjkpBkjFf", trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohNCYrnpvbomICgbgxx", anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohNJFAbxhb7m3lTuSF9" },
  GLOBAL: { 
    mensual: "https://test.checkout.dodopayments.com/buy/pdt_0NohLnegsV9afjkpBkjFf",
    trimestral: "https://test.checkout.dodopayments.com/buy/pdt_0NohNCYrnpvbomICgbgxx",
    anual: "https://test.checkout.dodopayments.com/buy/pdt_0NohNJFAbxhb7m3lTuSF9"
  }
};

// ─────────────────────────────────────────
// 10. EXPORTAR TODO
// ─────────────────────────────────────────
window.PAIS_CONFIG             = PAIS_CONFIG;
window.PRECIO_SUSCRIPCION_USD  = PRECIO_SUSCRIPCION_USD;
window.LINKS_DODO             = LINKS_DODO;
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
// 11. ARRANQUE
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  adaptarPrecioLocalPorIP();
  actualizarLabelsPrecio();
});
