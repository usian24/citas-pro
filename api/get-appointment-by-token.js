// /api/get-appointment-by-token.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).json({ error: 'Falta token' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
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