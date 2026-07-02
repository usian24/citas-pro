'use strict';

/* ══════════════════════════════════════════════════
   IMAGE-ENGINE.JS — Motor de Optimización de Imágenes
   Convierte las imágenes a WebP antes de subirlas.
   Utiliza la librería browser-image-compression.
══════════════════════════════════════════════════ */

/**
 * Procesa un archivo de imagen, lo comprime y lo convierte a WebP.
 * @param {File} file El archivo de imagen original (JPG, PNG, etc.).
 * @returns {Promise<File>} Una promesa que resuelve al nuevo archivo optimizado en formato WebP.
 */
async function processImageForUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    console.error('Archivo no válido para procesar:', file);
    return file; // Devuelve el archivo original si no es una imagen
  }

  const options = {
    maxSizeMB: 1,           // Límite de tamaño de 1MB
    maxWidthOrHeight: 1280,   // Redimensiona si es más grande de 1280px, manteniendo el aspect ratio
    useWebWorker: true,     // Usa un Web Worker para no bloquear la interfaz
    fileType: 'image/webp', // ¡La magia! Convierte a WebP
    initialQuality: 0.8     // Calidad del 80%, un excelente balance
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error al optimizar la imagen, se usará la original:', error);
    return file; // Si algo falla, subimos el archivo original para no interrumpir al usuario.
  }
}