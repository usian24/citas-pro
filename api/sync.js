const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { type } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, error: 'Falta el campo "type"' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // ═══════════════════════════════════════
    // APPOINTMENTS — type: "appointments"
    // ═══════════════════════════════════════
    if (type === 'appointments') {
      const { business_id, appointments } = req.body;
      if (!business_id || !Array.isArray(appointments)) {
        return res.status(400).json({ success: false, error: 'Datos incompletos' });
      }

      for (const appt of appointments) {
        const { error } = await supabase.from('appointments').upsert({
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
        });
        if (error) console.error('Error upsert appointment:', error.message);
      }

      return res.status(200).json({ success: true, synced: appointments.length });
    }

    // ═══════════════════════════════════════
    // SERVICES — type: "services"
    // ═══════════════════════════════════════
    if (type === 'services') {
      const { business_id, services } = req.body;
      if (!business_id || !Array.isArray(services)) {
        return res.status(400).json({ success: false, error: 'Datos incompletos' });
      }

      for (const svc of services) {
        const { error } = await supabase.from('services').upsert({
          id:          String(svc.id),
          business_id: business_id,
          name:        svc.name || '',
          description: svc.description || '',
          price:       parseFloat(svc.price) || 0,
          duration:    parseInt(svc.duration) || 30,
          color:       svc.color || '',
          image:       svc.image || ''
        });
        if (error) console.error('Error upsert service:', error.message);
      }

      return res.status(200).json({ success: true, synced: services.length });
    }

    // ═══════════════════════════════════════
    // CLIENT — type: "client"
    // ═══════════════════════════════════════
    if (type === 'client') {
      const data = req.body;
      if (!data.business_id) {
        return res.status(400).json({ success: false, error: 'Falta business_id' });
      }

      const payload = {
        id:            data.id || ('cl_' + Date.now()),
        business_id:   data.business_id,
        name:          data.name || '',
        email:         data.email || '',
        phone:         data.phone || '',
        worker_id:     data.worker_id || '',
        worker_name:   data.worker_name || '',
        service_name:  data.service_name || '',
        service_price: parseFloat(data.service_price) || 0,
        date:          data.date || '',
        time:          data.time || ''
      };

      // Evitar duplicados por teléfono + fecha + hora
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('business_id', data.business_id)
        .eq('phone', data.phone)
        .eq('date', data.date)
        .eq('time', data.time)
        .limit(1);

      if (existing && existing.length > 0) {
        payload.id = existing[0].id;
      }

      const { error } = await supabase.from('clients').upsert(payload);
      if (error) {
        console.error('Error upsert client:', error.message);
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    // ═══════════════════════════════════════
    // PRODUCT — type: "product"
    // ═══════════════════════════════════════
    if (type === 'product') {
      const data = req.body;
      if (!data.business_id) {
        return res.status(400).json({ success: false, error: 'Falta business_id' });
      }

      const { error } = await supabase.from('products').upsert({
        id:            data.id || ('prod_' + Date.now()),
        business_id:   data.business_id,
        name:          data.name || '',
        description:   data.description || '',
        price:         parseFloat(data.price) || 0,
        stock:         parseInt(data.stock) || 0,
        image:         data.image || '',
        category:      data.category || '',
        rating:        parseFloat(data.rating) || 0,
        reviews_count: parseInt(data.reviews_count) || 0
      });

      if (error) {
        console.error('Error upsert product:', error.message);
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Tipo desconocido: ' + type });

  } catch (err) {
    console.error('Server error sync:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};