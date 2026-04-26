const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
const { JWT_SECRET } = require('../middlewares/auth');

const router = express.Router();

// ═══════════════════════════════════════
// RUTA 1: LOGIN DE SUPER ADMINISTRADOR
// ═══════════════════════════════════════
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data, error } = await supabase
      .from('super_admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const isPasswordValid = bcrypt.compareSync(password, data.password);
    if (!isPasswordValid) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // ¡MAGIA DE SEGURIDAD (JWT)! 
    const token = jwt.sign(
      { role: 'super_admin', username: data.username }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    return res.status(200).json({ success: true, admin: data.username, token: token });
    
  } catch (err) {
    return res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
});
// ═══════════════════════════════════════
// RUTA 2: LOGIN UNIFICADO (DUEÑOS Y TRABAJADORES)
// ═══════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const inputEmail = email.toLowerCase();

    // 1. Buscar en dueños de negocio (businesses)
    const { data: bizData, error: bizError } = await supabase
      .from('businesses')
      .select('id, name, email, password')
      .ilike('email', inputEmail)
      .eq('password', password) // En un futuro cambiar a bcrypt
      .single();

    if (bizData && !bizError) {
      return res.status(200).json({ success: true, type: 'business', biz: bizData });
    }

    // 2. Si no es dueño, buscar en trabajadores (workers)
    const { data: workerData, error: workerError } = await supabase
      .from('workers')
      .select('id, business_id, name, email, password, active')
      .ilike('email', inputEmail)
      .eq('password', password)
      .single();

    if (workerData && !workerError) {
      if (workerData.active === false) {
        return res.status(401).json({ error: 'Tu cuenta de trabajador está inactiva.' });
      }
      return res.status(200).json({ 
        success: true, 
        type: 'worker', 
        worker: workerData 
      });
    }

    // 3. Si no se encontró en ningún lado
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
});

module.exports = router;
