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

// 🚨 LA VACUNA 🚨
// Le decimos a Vercel que lea todo como JSON, PERO que haga una copia exacta 
// del texto crudo (rawBody) SOLO si la ruta es el webhook.
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/webhook')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));

// ═══════════════════════════════════════
// REGISTRO DE RUTAS MODULARES
// ═══════════════════════════════════════
app.use('/api', paymentRoutes);
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