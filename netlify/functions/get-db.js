const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    // Descarga TODOS los negocios guardados en la base de datos de la nube
    const { data, error } = await supabase.from('businesses').select('*');
    
    if (error) throw error;

    return { statusCode: 200, headers, body: JSON.stringify(data || []) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};