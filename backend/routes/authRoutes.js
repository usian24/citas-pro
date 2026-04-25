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

module.exports = router;
