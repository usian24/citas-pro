const express = require('express');
const path = require('path');

// Importar la aplicación de Express que creamos para Vercel
const apiApp = require('./api/index.js');

// Configurar el puerto
const PORT = process.env.PORT || 3000;

// Utilizar nuestra API
// apiApp ya es una instancia de express, podemos escuchar en ella directamente,
// pero necesitamos agregarle la capacidad de servir el HTML.

// Servir archivos estáticos de toda la carpeta (index.html, assets, frontend)
apiApp.use(express.static(__dirname));

// Si alguien entra a la raíz, devolver el index.html
apiApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar el servidor
apiApp.listen(PORT, () => {
    console.log('=============================================');
    console.log('🚀 SERVIDOR LOCAL DE CITAS PRO INICIADO 🚀');
    console.log('=============================================');
    console.log(`🌐 Frontend y Backend disponibles en: http://localhost:${PORT}`);
    console.log('=============================================');
    console.log('Presiona Ctrl + C en la terminal para detenerlo.');
});
