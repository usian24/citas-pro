
//save-woeker.js:
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { action, worker } = req.body;
    if (!worker || !worker.id) {
      return res.status(400).json({ success: false, error: 'Falta el ID del trabajador' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    if (action === 'delete') {
      const { error } = await supabase.from('workers').delete().eq('id', worker.id);
      if (error) return res.status(400).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // upsert (crear o actualizar)
    const payload = {
      id:          worker.id,
      business_id: worker.business_id || '',
      name:        worker.name || '',
      email:       worker.email || '',
      password:    worker.password || '',
      phone:       worker.phone || '',
      avatar:      worker.avatar || '',
      cover:       worker.cover || '',
      role:        worker.role || 'barber',
      horario:     Array.isArray(worker.horario) ? worker.horario : []
    };

    const { error } = await supabase.from('workers').upsert(payload);
    if (error) {
      console.error('Supabase workers error:', JSON.stringify(error));
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};