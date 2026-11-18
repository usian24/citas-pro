const jwt = require('jsonwebtoken');

// Llave maestra para firmar JWT de sesión (en producción debe venir de process.env.JWT_SECRET)
const JWT_SECRET = process.env.JWT_SECRET || 'dev_local_citas_pro_change_me_please';
// Secreto separado para tokens de reseteo de contraseña (evita reusar tokens entre flujos)
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || (JWT_SECRET + '::password_reset_v1');

if (!process.env.JWT_SECRET && (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production')) {
  console.error('[CRITICAL] JWT_SECRET no está configurado en producción.');
}

function extractBearer(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!header || typeof header !== 'string') return '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
}

function signSessionToken(payload, expiresIn = '30d') {
  return jwt.sign(
    Object.assign({}, payload, { purpose: 'session' }),
    JWT_SECRET,
    { expiresIn }
  );
}

function verifySessionToken(rawToken) {
  if (!rawToken) return null;
  try {
    const decoded = jwt.verify(rawToken, JWT_SECRET);
    if (decoded.purpose && decoded.purpose !== 'session') return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

// Adjunta req.user si viene un JWT válido, sin rechazar peticiones públicas
const optionalAuth = (req, res, next) => {
  const token = extractBearer(req);
  if (token) {
    const decoded = verifySessionToken(token);
    if (decoded) req.user = decoded;
  }
  next();
};

// Exige un JWT de sesión válido
const verifyToken = (req, res, next) => {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Sesión requerida. Inicia sesión para continuar.', code: 'AUTH_REQUIRED' });
  }
  const decoded = verifySessionToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Sesión expirada o inválida. Inicia sesión nuevamente.', code: 'AUTH_REQUIRED' });
  }
  req.user = decoded;
  next();
};

// Exige uno de los roles permitidos ('super_admin', 'business', 'worker')
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Sesión requerida', code: 'AUTH_REQUIRED' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Permisos insuficientes para esta operación' });
  }
  next();
};

// Comprueba si req.user pertenece a un negocio (super_admin, dueño o trabajador del negocio)
function canAccessBusiness(user, bizId) {
  if (!user || !bizId) return false;
  if (user.role === 'super_admin') return true;
  if ((user.role === 'business' || user.role === 'worker') && String(user.bizId || '') === String(bizId)) {
    return true;
  }
  return false;
}

// Comprueba si req.user es dueño del negocio o super_admin
function isBusinessOwnerOrAdmin(user, bizId) {
  if (!user || !bizId) return false;
  if (user.role === 'super_admin') return true;
  return user.role === 'business' && String(user.bizId || '') === String(bizId);
}

module.exports = {
  JWT_SECRET,
  JWT_RESET_SECRET,
  signSessionToken,
  verifySessionToken,
  optionalAuth,
  verifyToken,
  requireRole,
  canAccessBusiness,
  isBusinessOwnerOrAdmin
};
