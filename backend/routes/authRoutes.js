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
      .select('id, business_id, name, email, password')
      .ilike('email', inputEmail)
      .eq('password', password)
      .single();

    if (workerData && !workerError) {
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

// ═══════════════════════════════════════
// RUTA 3: SOLICITAR RESETEO DE CONTRASEÑA
// ═══════════════════════════════════════
router.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  const inputEmail = email.toLowerCase();
  let user = null;
  let userType = null;

  // Buscar en dueños
  const { data: biz } = await supabase.from('businesses').select('id, email, name').ilike('email', inputEmail).single();
  if (biz) {
    user = { id: biz.id, email: biz.email, name: biz.name };
    userType = 'business';
  } else {
    // Buscar en trabajadores
    const { data: worker } = await supabase.from('workers').select('id, email, name, business_id').ilike('email', inputEmail).single();
    if (worker) {
      user = { id: worker.id, email: worker.email, name: worker.name, bizId: worker.business_id };
      userType = 'worker';
    }
  }

  if (!user) {
    // Respondemos OK para no revelar si un email existe o no (medida de seguridad)
    return res.status(200).json({ success: true });
  }

  // Generar token de reseteo (expira en 1 hora)
  const resetToken = jwt.sign(
    { userId: user.id, email: user.email, type: userType },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const origin = req.get('origin') || 'https://citasproonline.com'; // Fallback a producción por seguridad
  const resetLink = `${origin}/#reset-password/${resetToken}`;

  // Enviar email con el link (usando tu util/send-email)
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'Citas Pro <soporte@citasproonline.com>',
      to: [user.email],
      subject: '🔑 Restablece tu contraseña de Citas Pro',
      html: `<p>Hola ${user.name}, haz clic en el siguiente enlace para restablecer tu contraseña. Este enlace es válido por 1 hora:</p><a href="${resetLink}">Restablecer mi contraseña</a>`
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error enviando email de reseteo:", error);
    res.status(500).json({ error: 'No se pudo enviar el correo.' });
  }
});

// ═══════════════════════════════════════
// RUTA 4: CONFIRMAR Y CAMBIAR LA CONTRASEÑA
// ═══════════════════════════════════════
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { userId, type } = decoded;

    const tableName = type === 'business' ? 'businesses' : 'workers';

    const { error } = await supabase
      .from(tableName)
      .update({ password: newPassword }) // En un futuro, aquí iría el hash de bcrypt
      .eq('id', userId);

    if (error) throw error;

    res.status(200).json({ success: true });

  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Enlace inválido o corrupto.' });
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
