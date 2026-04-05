// /api/get-appointment-by-token.js
const { createClient } = require('@supabase/supabase-js');

// URLs de ambos proyectos Supabase
const SUPABASE_APPOINTMENTS_URL = 'https://krbtoepzoorpdedtykug.supabase.co';
const SUPABASE_APPOINTMENTS_KEY = 'sb_publishable_IXquO0XEbEkFBmZgblzjVg_adtTWCW-';

module.exports = async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ error: 'Falta token' });
  }

  // Las citas viven en krbtoepzoorpdedtykug — siempre buscar ahí
  const supabase = createClient(
    SUPABASE_APPOINTMENTS_URL,
    SUPABASE_APPOINTMENTS_KEY
  );

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('token', token)
    .neq('status', 'cancelled')
    .limit(1);

  if (error || !data || data.length === 0) {
    return res.status(404).json({ appointment: null });
  }

  return res.status(200).json({ appointment: data[0] });
};