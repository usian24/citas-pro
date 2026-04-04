'use strict';
// paises-precios.js — CitasPro
// Ahora delega toda la lógica a config-pais.js
// Este archivo se mantiene por compatibilidad

document.addEventListener('DOMContentLoaded', function() {
  // config-pais.js ya maneja todo esto.
  // Solo llamamos a la función central con un pequeño delay
  // para asegurarnos de que CUR esté cargado.
  setTimeout(function() {
    if (typeof adaptarPrecioLocalPorIP === 'function') {
      adaptarPrecioLocalPorIP();
    }
  }, 1000);
});