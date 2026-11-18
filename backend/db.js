const { createClient } = require('@supabase/supabase-js');

// Vercel/Node inyecta las variables según el entorno (DEV o PROD).
// En el servidor usamos SUPABASE_SERVICE_ROLE_KEY (llave secreta) para operar con RLS estricto activo.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[SECURITY] SUPABASE_SERVICE_ROLE_KEY no configurada; usando SUPABASE_ANON_KEY como respaldo.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = supabase;
