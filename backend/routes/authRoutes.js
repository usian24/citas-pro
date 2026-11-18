const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
const { JWT_RESET_SECRET, signSessionToken } = require('../middlewares/auth');

const router = express.Router();

function safeComparePassword(plain, stored) {
  if (!plain || !stored) return false;
  try {
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      return bcrypt.compareSync(plain, stored);
    }
  } catch (e) {}
  return plain === stored;
}

function resolveSafeResetBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '') + '/app';
  const origin = String(req.get('origin') || '').trim();
  if (
    /^https:\/\/([a-z0-9-]+\.)?citasproonline\.com$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/i.test(origin)
  ) {
    return origin + '/app';
  }
  return 'https://citasproonline.com/app';
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════
// RUTA 1: LOGIN DE SUPER ADMINISTRADOR
// ═══════════════════════════════════════
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const { data, error } = await supabase
      .from('super_admins')
      .select('id, username, password')
      .eq('username', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const isPasswordValid = safeComparePassword(password, data.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const token = signSessionToken(
      { role: 'super_admin', username: data.username },
      '24h'
    );

    return res.status(200).json({ success: true, admin: data.username, token });
  } catch (err) {
    return res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
});

// ═══════════════════════════════════════
// RUTA 2: LOGIN UNIFICADO (DUEÑOS Y TRABAJADORES)
// ═══════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const inputEmail = String(email).trim().toLowerCase();

    // 1. Buscar en dueños de negocio (businesses)
    const { data: bizData, error: bizError } = await supabase
      .from('businesses')
      .select('id, name, email, password, owner')
      .ilike('email', inputEmail)
      .single();

    if (bizData && !bizError && safeComparePassword(password, bizData.password)) {
      const safeBiz = {
        id: bizData.id,
        name: bizData.name,
        email: bizData.email,
        owner: bizData.owner
      };
      const token = signSessionToken({
        role: 'business',
        bizId: bizData.id,
        email: bizData.email
      });
      return res.status(200).json({ success: true, type: 'business', biz: safeBiz, token });
    }

    // 2. Si no es dueño, buscar en trabajadores (workers)
    const { data: workerData, error: workerError } = await supabase
      .from('workers')
      .select('id, business_id, name, email, password')
      .ilike('email', inputEmail)
      .single();

    if (workerData && !workerError && safeComparePassword(password, workerData.password)) {
      const safeWorker = {
        id: workerData.id,
        business_id: workerData.business_id,
        name: workerData.name,
        email: workerData.email
      };
      const token = signSessionToken({
        role: 'worker',
        bizId: workerData.business_id,
        workerId: workerData.id,
        email: workerData.email
      });
      return res.status(200).json({
        success: true,
        type: 'worker',
        worker: safeWorker,
        token
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
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  const inputEmail = String(email).trim().toLowerCase();
  let user = null;
  let userType = null;

  const { data: biz } = await supabase.from('businesses').select('id, email, name').ilike('email', inputEmail).single();
  if (biz) {
    user = { id: biz.id, email: biz.email, name: biz.name };
    userType = 'business';
  } else {
    const { data: worker } = await supabase.from('workers').select('id, email, name, business_id').ilike('email', inputEmail).single();
    if (worker) {
      user = { id: worker.id, email: worker.email, name: worker.name, bizId: worker.business_id };
      userType = 'worker';
    }
  }

  if (!user) {
    return res.status(200).json({ success: true });
  }

  // Secreto y claim dedicados para evitar reuso con tokens de sesión
  const resetToken = jwt.sign(
    { userId: user.id, email: user.email, type: userType, purpose: 'password_reset' },
    JWT_RESET_SECRET,
    { expiresIn: '15m' }
  );

  const resetBaseUrl = resolveSafeResetBaseUrl(req);
  const resetLink = `${resetBaseUrl}#reset-password/${resetToken}`;

  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: 'Citas Pro <soporte@citasproonline.com>',
      to: [user.email],
      subject: 'Restablece tu contraseña de Citas Pro',
      html: `<p>Hola ${escapeHtml(user.name)}, haz clic en el siguiente enlace para restablecer tu contraseña. Este enlace es válido por 15 minutos:</p><p><a href="${resetLink}">Restablecer mi contraseña</a></p>`
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
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'Faltan datos' });
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_RESET_SECRET);
    if (decoded.purpose !== 'password_reset' || !decoded.userId) {
      return res.status(401).json({ error: 'Enlace inválido o corrupto.' });
    }
    const { userId, type } = decoded;
    const tableName = type === 'business' ? 'businesses' : 'workers';

    const { error } = await supabase
      .from(tableName)
      .update({ password: bcrypt.hashSync(String(newPassword), 10) })
      .eq('id', userId);

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Enlace inválido o corrupto.' });
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ═══════════════════════════════════════
// RUTA 5: GOOGLE LOGIN (Verificación criptográfica del access_token de Supabase Auth)
// ═══════════════════════════════════════
router.post('/google-login', async (req, res) => {
  try {
    const body = req.body || {};
    const authHdr = req.headers['authorization'] || '';
    const sbToken = body.access_token || (authHdr.startsWith('Bearer ') ? authHdr.slice(7).trim() : '');

    if (!sbToken) {
      return res.status(401).json({ error: 'Token de Google/Supabase requerido' });
    }

    const { data: userData, error: authErr } = await supabase.auth.getUser(sbToken);
    if (authErr || !userData || !userData.user || !userData.user.email) {
      return res.status(401).json({ error: 'Sesión de Google inválida o expirada' });
    }

    const emailLower = String(userData.user.email).trim().toLowerCase();
    const verifiedName = (userData.user.user_metadata && userData.user.user_metadata.full_name) || body.name || '';
    const verifiedAvatar = (userData.user.user_metadata && userData.user.user_metadata.avatar_url) || body.avatar || '';

    // 1. ¿Es Dueño de negocio?
    const { data: bizData, error: bizError } = await supabase
      .from('businesses')
      .select('id, name, owner, email, phone, addr, city, country, type, plan, desc_text, logo, cover, insta, facebook, x_url, tiktok, join_date, expires_at, horario, photos, loyalty')
      .ilike('email', emailLower)
      .single();

    if (bizData && !bizError) {
      const token = signSessionToken({
        role: 'business',
        bizId: bizData.id,
        email: bizData.email
      });
      return res.status(200).json({
        type: 'business',
        biz: bizData,
        token
      });
    }

    // 2. ¿Es Trabajador?
    const { data: workerData, error: workerError } = await supabase
      .from('workers')
      .select('id, business_id, name, email, phone, avatar, cover, role, horario')
      .ilike('email', emailLower)
      .single();

    if (workerData && !workerError) {
      const token = signSessionToken({
        role: 'worker',
        bizId: workerData.business_id,
        workerId: workerData.id,
        email: workerData.email
      });
      return res.status(200).json({
        type: 'worker',
        worker: workerData,
        token
      });
    }

    // 3. Es usuario Nuevo
    return res.status(200).json({
      type: 'new',
      email: emailLower,
      name: verifiedName,
      avatar: verifiedAvatar
    });
  } catch (error) {
    console.error('Error en /google-login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
