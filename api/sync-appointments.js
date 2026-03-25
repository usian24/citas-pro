const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { business_id, appointments } = req.body;
    if (!business_id || !Array.isArray(appointments)) {
      return res.status(400).json({ success: false, error: 'Datos incompletos' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Upsert cada appointment
    for (const appt of appointments) {
      const payload = {
        id:            String(appt.id),
        business_id:   business_id,
        worker_id:     appt.worker_id || '',
        client_id:     appt.client_id || '',
        client_name:   appt.client_name || '',
        client_phone:  appt.client_phone || '',
        service_name:  appt.service_name || '',
        service_price: parseFloat(appt.service_price) || 0,
        date:          appt.date || '',
        time:          appt.time || '',
        status:        appt.status || 'confirmed'
      };

      const { error } = await supabase.from('appointments').upsert(payload);
      if (error) {
        console.error('Error upsert appointment:', error.message);
      }
    }

    return res.status(200).json({ success: true, synced: appointments.length });

  } catch (err) {
    console.error('Server error sync-appointments:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};