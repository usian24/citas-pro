const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    // Descarga TODOS los negocios guardados en la base de datos de la nube
    const { data, error } = await supabase.from('businesses').select('*');
    
    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};