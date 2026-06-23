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

// Middlewares: Filtro de entrada para CORS
app.use(cors());

// 🚨 LA MAGIA ESTÁ AQUÍ 🚨
// Colocamos las rutas de pago ANTES de que express.json() transforme el texto.
// Así Lemon Squeezy puede pasar su firma criptográfica intacta.
app.use('/api', paymentRoutes);

// Ahora sí, traducimos todo el resto a JSON para el resto de Citas Pro
app.use(express.json());

// ═══════════════════════════════════════
// REGISTRO DE RUTAS MODULARES
// ═══════════════════════════════════════
app.use('/api', authRoutes);
app.use('/api', bizRoutes);
app.use('/api', syncRoutes);
app.use('/api', workerRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', utilRoutes);

// Rutas "comodín" por si alguien pide algo que no existe
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada en el Cerebro' });
});

module.exports = app;