const express = require('express');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno locales (.env) antes de importar la API
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  } else {
    try { require('dotenv').config({ path: envPath }); } catch (e) {}
  }
}

// Importar la aplicación de Express que creamos para Vercel
const apiApp = require('./api/index.js');

// Configurar el puerto
const PORT = process.env.PORT || 3000;

// Bloquear acceso HTTP a archivos sensibles del servidor/configuración
apiApp.use((req, res, next) => {
  const p = (req.path || '').toLowerCase();
  if (
    p === '/.env' ||
    p.startsWith('/.env.') ||
    p === '/credenciales.txt' ||
    p === '/server.js' ||
    p === '/package.json' ||
    p === '/package-lock.json' ||
    p.startsWith('/backend/') ||
    p.startsWith('/.git')
  ) {
    return res.status(404).end();
  }
  next();
});

// Rutas limpias (equivalentes a Vercel cleanUrls)
apiApp.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.html'));
});
apiApp.get('/tienda', (req, res) => {
  res.sendFile(path.join(__dirname, 'tienda.html'));
});

// Servir archivos estáticos de la carpeta (index.html, assets, frontend)
apiApp.use(express.static(__dirname));

// Si alguien entra a la raíz, devolver el index.html
apiApp.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar el servidor
apiApp.listen(PORT, () => {
  console.log('=============================================');
  console.log('SERVIDOR LOCAL DE CITAS PRO INICIADO');
  console.log('=============================================');
  console.log(`Frontend y Backend disponibles en: http://localhost:${PORT}`);
  console.log('=============================================');
});
