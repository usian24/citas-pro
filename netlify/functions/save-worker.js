const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Método no permitido' };

  try {
    const { action, worker } = JSON.parse(event.body);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    if (action === 'delete') {
      // Si la orden es borrar, lo elimina de la tabla
      const { error } = await supabase.from('workers').delete().eq('id', worker.id);
      if (error) throw error;
    } else {
      // Si la orden es crear o actualizar, lo guarda
      const { error } = await supabase.from('workers').upsert(worker);
      if (error) throw error;
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};