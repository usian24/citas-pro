// get-biz.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    const bizId = req.query.id;
    if (!bizId) {
      return res.status(400).json({ error: 'Falta el ID del negocio' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Traer el negocio
    const { data: biz, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', bizId)
      .single();

    if (error || !biz) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    // Traer workers
    const { data: workers } = await supabase
      .from('workers')
      .select('id, business_id, created_at, name, email, password, phone, avatar, cover, role, horario')
      .eq('business_id', bizId);

    // Traer appointments
    const { data: appointments } = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', bizId);

    // Traer services
    const { data: services } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', bizId);

    // Mapear workers con sus citas y servicios
    biz.workers = (workers || []).map(function(w) {
      var wAppts = (appointments || []).filter(function(a) { return a.worker_id === w.id; });
      var wSvcs = (services || []).filter(function(s) { return s.worker_id === w.id; });

      return {
        id: w.id,
        name: w.name || '',
        email: w.email || '',
        pass: w.password || '',
        phone: w.phone || '',
        spec: w.role || '',
        photo: w.avatar || '',
        cover: w.cover || '',
        active: true,
        services: wSvcs.map(function(s) {
          return {
            id: s.id,
            name: s.name || '',
            price: parseFloat(s.price) || 0,
            dur: parseInt(s.duration) || 30,
            desc: s.description || '',
            color: s.color || '',
            photo: s.image || ''
          };
        }),
        horario: (w.horario && Array.isArray(w.horario) && w.horario.length > 0) ? w.horario : (biz.horario || []),
        appointments: wAppts.map(function(a) {
          return {
            id: a.id,
            client: a.client_name || '',
            phone: a.client_phone || '',
            email: a.client_email || '',
            date: a.date || '',
            time: a.time || '',
            svc: a.service_name || '',
            barber: w.name || '',
            price: parseFloat(a.service_price) || 0,
            status: a.status || 'confirmed',
            notes: '',
            token: a.token || a.id
          };
        }),
        photos: [],
        notifications: [],
      };
    });

    // Appointments sin worker
    var unassignedAppts = (appointments || []).filter(function(a) {
      return !a.worker_id;
    });
    biz.appointments = unassignedAppts.map(function(a) {
      return {
        id: a.id,
        client: a.client_name || '',
        phone: a.client_phone || '',
        email: '',
        date: a.date || '',
        time: a.time || '',
        svc: a.service_name || '',
        barber: '',
        price: parseFloat(a.service_price) || 0,
        status: a.status || 'confirmed',
        notes: ''
      };
    });

    // Mapear campos snake_case
    biz.joinDate = biz.join_date;
    biz.desc = biz.desc_text || '';
    biz.services = biz.services || [];
    biz.photos = biz.photos || [];
    biz.horario = biz.horario || [];

    return res.status(200).json(biz);

  } catch (err) {
    console.error('Server error get-biz:', err);
    return res.status(500).json({ error: err.message });
  }
};