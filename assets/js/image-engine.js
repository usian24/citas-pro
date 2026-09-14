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
function processImageForUpload(file) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) return resolve(file);

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const MAX_SIZE = 1280;
        let width = img.width;
        let height = img.height;

        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
          else { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(function (blob) {
          if (!blob) return resolve(file);
          const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
            type: 'image/webp',
            lastModified: Date.now()
          });
          resolve(newFile);
        }, 'image/webp', 0.8);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}