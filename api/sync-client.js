const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const data = req.body;
    if (!data || !data.business_id) {
      return res.status(400).json({ success: false, error: 'Falta business_id' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const payload = {
      id:          data.id || ('cl_' + Date.now()),
      business_id: data.business_id,
      name:        data.name || '',
      email:       data.email || '',
      phone:       data.phone || '',
      avatar:      data.avatar || ''
    };

    // Verificar si el cliente ya existe por teléfono para no duplicar
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('business_id', data.business_id)
      .eq('phone', data.phone)
      .limit(1);

    if (existing && existing.length > 0) {
      // Actualizar el existente
      payload.id = existing[0].id;
    }

    const { error } = await supabase.from('clients').upsert(payload);
    if (error) {
      console.error('Error upsert client:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error sync-client:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};