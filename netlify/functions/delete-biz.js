const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { id } = JSON.parse(event.body);
    
    if (!id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el ID de la barbería' }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Orden explícita de ELIMINAR en Supabase
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error de Supabase al eliminar:", error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};