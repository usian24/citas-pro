'use strict';
// config-pais.js — CitasPro v2 (Adaptado a 3 Planes)
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
  ES: { simbolo:'€',   nombre:'Euro',              posicion:'derecha',   separadorDecimal:',', separadorMiles:'.', timezone:'Europe/Madrid',                    decimales:2 },
  CO: { simbolo:'$',   nombre:'Peso colombiano',   posicion:'izquierda', separadorDecimal:',', separadorMiles:'.', timezone:'America/Bogota',                   decimales:0 },
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
// 7. PRECIO DE SUSCRIPCIÓN (Visuales + USD) -> ADAPTADO A 3 PLANES
//    La estructura ahora guarda el mes, trimestre y año.
// ─────────────────────────────────────────
const PRECIO_SUSCRIPCION = {
  PE: { mes: 'S/ 25',      tri: 'S/ 75',      anu: 'S/ 300' },
  EC: { mes: '$10',        tri: '$30',        anu: '$120' },
  CO: { mes: '$25,248',    tri: '$75,744',    anu: '$302,976' },
  US: { mes: '$15',        tri: '$45',        anu: '$180' },
  MX: { mes: '$227.58',    tri: '$682.74',    anu: '$2,730.96' },
  ES: { mes: '10€',        tri: '30€',        anu: '120€' },
  CL: { mes: '$10',        tri: '$30',        anu: '$120' },
  AR: { mes: '$10,830',    tri: '$32,490',    anu: '$129,960' },
  BR: { mes: 'R$ 80',      tri: 'R$ 240',     anu: 'R$ 960' },
  VE: { mes: 'Bs. 540',    tri: 'Bs. 1620',   anu: 'Bs. 6480' },
  DO: { mes: 'RD$ 890',    tri: 'RD$ 2670',   anu: 'RD$ 10680' },
  DE: { mes: '14€',        tri: '42€',        anu: '168€' },
  NL: { mes: '14€',        tri: '42€',        anu: '168€' },
  FR: { mes: '14€',        tri: '42€',        anu: '168€' },
  DEFAULT: { mes: '$15',   tri: '$45',        anu: '$180' } // Precios base de Lemon Squeezy
};

function adaptarPrecioLocal(pais) {
  // Buscamos el país o asignamos el default de Lemon Squeezy
  const precios = PRECIO_SUSCRIPCION[pais] || PRECIO_SUSCRIPCION['DEFAULT'];
  
  // Inyectamos en las tarjetas de la Landing Page
  const elMes = document.getElementById('precio-mensual-val');
  const elTri = document.getElementById('precio-trimestral-val');
  const elAnu = document.getElementById('precio-anual-val');
  
  if (elMes) elMes.textContent = precios.mes;
  if (elTri) elTri.textContent = precios.tri;
  if (elAnu) elAnu.textContent = precios.anu;

  // Mantenemos compatibilidad con tu código app.js anterior por si acaso
  document.querySelectorAll('.precio-local-mes').forEach(el => el.textContent = precios.mes + '/mes');
  document.querySelectorAll('.precio-local-solo').forEach(el => el.textContent = precios.mes);
}

async function adaptarPrecioLocalPorIP() {
  const pais = getPaisActivo();
  if (pais && pais !== 'ES') {
    adaptarPrecioLocal(pais);
    return;
  }
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
// 11. ARRANQUE
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  adaptarPrecioLocalPorIP();
  actualizarLabelsPrecio();
});