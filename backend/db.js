const { createClient } = require('@supabase/supabase-js');

// Vercel inyectará automáticamente estas variables dependiendo del entorno
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
