const express = require('express');
const cors = require('cors');

const authRoutes = require('../backend/routes/authRoutes');
const bizRoutes = require('../backend/routes/bizRoutes');
const syncRoutes = require('../backend/routes/syncRoutes');
const workerRoutes = require('../backend/routes/workerRoutes');
const appointmentRoutes = require('../backend/routes/appointmentRoutes');
const utilRoutes = require('../backend/routes/utilRoutes');
const paymentRoutes = require('../backend/routes/paymentRoutes');

const app = express();

// Middlewares: Filtros de entrada
app.use(cors()); // Permite que tu frontend se comunique con este backend sin bloqueos
app.use(express.json()); // Traduce los datos que manda tu frontend a formato JSON entendible

// ═══════════════════════════════════════
// REGISTRO DE RUTAS MODULARES
// ═══════════════════════════════════════
app.use('/api', authRoutes);
app.use('/api', bizRoutes);
app.use('/api', syncRoutes);
app.use('/api', workerRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', utilRoutes);
app.use('/api', paymentRoutes);

// Rutas "comodín" por si alguien pide algo que no existe
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada en el Cerebro' });
});

// Exportamos la aplicación para que Vercel la ejecute
module.exports = app;
