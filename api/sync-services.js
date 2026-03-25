const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { business_id, services } = req.body;
    if (!business_id || !Array.isArray(services)) {
      return res.status(400).json({ success: false, error: 'Datos incompletos' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    for (const svc of services) {
      const payload = {
        id:          String(svc.id),
        business_id: business_id,
        name:        svc.name || '',
        price:       parseFloat(svc.price) || 0,
        duration:    parseInt(svc.duration) || 30,
        color:       svc.color || ''
      };

      const { error } = await supabase.from('services').upsert(payload);
      if (error) {
        console.error('Error upsert service:', error.message);
      }
    }

    return res.status(200).json({ success: true, synced: services.length });

  } catch (err) {
    console.error('Server error sync-services:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};