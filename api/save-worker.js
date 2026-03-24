const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { action, worker } = req.body;
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

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};