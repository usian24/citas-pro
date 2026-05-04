const { createClient } = require('@supabase/supabase-js');

// 🔴 FORZAR MODO DESARROLLO (DEV)
// Ignoramos las variables de Vercel (Producción) para que toda la API 
// trabaje con la misma base de datos de pruebas que el frontend.
const SUPABASE_URL = 'https://krbtoepzoorpdedtykug.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IXquO0XEbEkFBmZgblzjVg_adtTWCW-';

// 🟢 (Cuando vayamos a hacer el paso a Producción / main, 
// simplemente volveremos a activar estas dos líneas de abajo)
// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
