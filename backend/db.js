const { createClient } = require('@supabase/supabase-js');

// Vercel/Node inyecta las variables según el entorno (DEV o PROD).
// En producción de Vercel (VERCEL_ENV === 'production'), prioriza SUPABASE_PROD_* si existen,
// o usa SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY configuradas para Production.
const isVercelProd = process.env.VERCEL_ENV === 'production';
const SUPABASE_URL = (isVercelProd && process.env.SUPABASE_PROD_URL)
  ? process.env.SUPABASE_PROD_URL
  : process.env.SUPABASE_URL;

const serviceKey = (isVercelProd && process.env.SUPABASE_PROD_SERVICE_ROLE_KEY)
  ? process.env.SUPABASE_PROD_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonKey = (isVercelProd && process.env.SUPABASE_PROD_ANON_KEY)
  ? process.env.SUPABASE_PROD_ANON_KEY
  : process.env.SUPABASE_ANON_KEY;

const SUPABASE_KEY = serviceKey || anonKey;

if (!serviceKey) {
  console.warn('[SECURITY] SUPABASE_SERVICE_ROLE_KEY no configurada en este entorno (' + (process.env.VERCEL_ENV || 'local') + '); usando ANON_KEY como respaldo (RLS bloqueará consultas sin política pública).');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = supabase;
