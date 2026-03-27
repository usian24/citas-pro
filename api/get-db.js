const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Traer todos los negocios
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('*');

    if (error) {
      console.error('Error get-db:', error);
      return res.status(400).json([]);
    }

    // Para cada negocio, traer sus workers de la tabla workers
    for (let biz of (businesses || [])) {
      const { data: workers } = await supabase
        .from('workers')
        .select('id, business_id, created_at, name, email, password, phone, avatar, cover, role')
        .eq('business_id', biz.id);

      // Traer appointments de la tabla appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('business_id', biz.id);

      // Traer services de la tabla services
      const { data: services } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', biz.id);

      // Traer clients de la tabla clients
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('business_id', biz.id);

      // Traer products de la tabla products
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', biz.id);

      // Mapear datos de Supabase al formato que espera el frontend
      biz.workers = (workers || []).map(function(w) {
        // Buscar las citas y servicios de este worker
        var wAppts = (appointments || []).filter(function(a) { return a.worker_id === w.id; });
        // AHORA filtramos por worker_id para que cada quien tenga sus servicios
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
          horario: biz.horario || [],
          appointments: wAppts.map(function(a) {
            return {
              id: a.id,
              client: a.client_name || '',
              phone: a.client_phone || '',
              email: '',
              date: a.date || '',
              time: a.time || '',
              svc: a.service_name || '',
              barber: w.name || '',
              price: parseFloat(a.service_price) || 0,
              status: a.status || 'confirmed',
              notes: '',
              token: a.id
            };
          }),
          photos: [],
          notifications: []
        };
      });

      // Appointments sin worker asignado
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

      // Mapear campos de Supabase snake_case al frontend
      biz.joinDate = biz.join_date;
      biz.desc = biz.desc_text || '';
      biz.services = biz.services || [];
      biz.photos = biz.photos || [];
      biz.horario = biz.horario || [];
    }

    return res.status(200).json(businesses || []);

  } catch (err) {
    console.error('Server error get-db:', err);
    return res.status(500).json([]);
  }
};