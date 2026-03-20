const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // Obtenemos el ID de la barbería desde la URL
  const bizId = event.queryStringParameters.id;
  
  if (!bizId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta el ID' }) };
  }

  // Conectamos a Supabase usando tus variables de entorno seguras
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Buscamos la barbería en la tabla que acabamos de crear
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', bizId)
    .single();

  if (error || !data) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Barbería no encontrada' }) };
  }

  // Devolvemos los datos limpios al frontend
  return { 
    statusCode: 200, 
    body: JSON.stringify(data) 
  };
};