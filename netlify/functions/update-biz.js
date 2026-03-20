const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  const bizData = JSON.parse(event.body);
  
  if (!bizData || !bizData.id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos' }) };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // UPSERT: Si no existe, lo crea. Si ya existe, lo actualiza. ¡Magia!
  const { data, error } = await supabase
    .from('businesses')
    .upsert(bizData);

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};