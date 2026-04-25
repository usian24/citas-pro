const jwt = require('jsonwebtoken');

// Llave maestra para fabricar Gafetes (Tokens JWT)
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_citas_pro_12345';

// ═══════════════════════════════════════
// MIDDLEWARE DE SEGURIDAD (El Cadenero)
// ═══════════════════════════════════════
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'Acceso denegado: Falta token' });

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
    req.user = decoded; 
    next(); 
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = { verifyToken, JWT_SECRET };
