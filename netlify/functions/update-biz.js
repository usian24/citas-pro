const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // Solo aceptamos peticiones para guardar (POST)
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  const bizData = JSON.parse(event.body);
  
  if (!bizData || !bizData.id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos del negocio' }) };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Actualizamos toda la fila del negocio en Supabase
  const { data, error } = await supabase
    .from('businesses')
    .update(bizData)
    .eq('id', bizData.id);

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};