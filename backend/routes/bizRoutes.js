const express = require('express');
const supabase = require('../db');
const { verifyToken } = require('../middlewares/auth');

const router = express.Router();

// ═══════════════════════════════════════
// RUTA 2: OBTENER DATOS DEL NEGOCIO (GET-BIZ)
// ═══════════════════════════════════════
router.get('/get-biz', async (req, res) => {
  try {
    const bizId = req.query.id;
    if (!bizId) {
      return res.status(400).json({ error: 'Falta el ID del negocio' });
    }

    // Traer el negocio
    const { data: biz, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', bizId)
      .single();

    if (error || !biz) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    // Traer workers (¡MAGIA DE SEGURIDAD! Sin password)
    const { data: workers } = await supabase
      .from('workers')
      .select('id, business_id, created_at, name, email, phone, avatar, cover, role, horario') 
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
});

// ═══════════════════════════════════════
// RUTA 3: OBTENER TODA LA BD (Solo Admin)
// ═══════════════════════════════════════
router.get('/get-db', verifyToken, async (req, res) => {
  try {
    const { data: businesses, error } = await supabase.from('businesses').select('*');
    if (error) { console.error('Error get-db:', error); return res.status(400).json([]); }

    for (let biz of (businesses || [])) {
      // MAGIA DE SEGURIDAD: NO traemos contraseñas de nadie
      const { data: workers } = await supabase
        .from('workers')
        .select('id, business_id, created_at, name, email, phone, avatar, cover, role, horario')
        .eq('business_id', biz.id);

      const { data: appointments } = await supabase
        .from('appointments').select('*').eq('business_id', biz.id);

      const { data: services } = await supabase
        .from('services').select('*').eq('business_id', biz.id);

      const { data: clients } = await supabase
        .from('clients').select('*').eq('business_id', biz.id);

      const { data: products } = await supabase
        .from('products').select('*').eq('business_id', biz.id);

      biz.workers = (workers || []).map(function(w) {
        var wAppts = (appointments || []).filter(function(a) { return a.worker_id === w.id; });
        var wSvcs  = (services    || []).filter(function(s) { return s.worker_id === w.id; });

        return {
          id:     w.id,
          name:   w.name  || '',
          email:  w.email || '',
          phone:  w.phone || '',
          spec:   w.role  || '',
          photo:  w.avatar || '',
          cover:  w.cover  || '',
          active: true,
          services: wSvcs.map(function(s) {
            return {
              id:    s.id,
              name:  s.name  || '',
              price: parseFloat(s.price)    || 0,
              dur:   parseInt(s.duration)   || 30,
              desc:  s.description || '',
              color: s.color || '',
              photo: s.image || ''
            };
          }),
          horario: (w.horario && Array.isArray(w.horario) && w.horario.length > 0)
            ? w.horario : (biz.horario || []),
          appointments: wAppts.map(function(a) {
            return {
              id:     a.id,
              client: a.client_name  || '',
              phone:  a.client_phone || '',
              email:  a.client_email || '',
              date:   a.date  || '',
              time:   a.time  || '',
              svc:    a.service_name || '',
              barber: w.name  || '',
              price:  parseFloat(a.service_price) || 0,
              status: a.status || 'confirmed',
              notes:  a.notes || '',
              token:  a.token || ''
            };
          }),
          photos: [], notifications: []
        };
      });

      var unassignedAppts = (appointments || []).filter(function(a) { return !a.worker_id; });
      biz.appointments = unassignedAppts.map(function(a) {
        return {
          id: a.id, client: a.client_name || '', phone: a.client_phone || '', email: '',
          date: a.date || '', time: a.time || '', svc: a.service_name || '', barber: '',
          price: parseFloat(a.service_price) || 0, status: a.status || 'confirmed', notes: '', token: a.token || ''
        };
      });

      biz.joinDate = biz.join_date; biz.desc = biz.desc_text || '';
      biz.services = biz.services || []; biz.photos = biz.photos || []; biz.horario = biz.horario || [];
    }

    return res.status(200).json(businesses || []);
  } catch (err) {
    console.error('Server error get-db:', err);
    return res.status(500).json([]);
  }
});

// ═══════════════════════════════════════
// RUTA 4: ELIMINAR NEGOCIO
// ═══════════════════════════════════════
router.post('/delete-biz', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Falta el ID del negocio' });
    }

    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error de Supabase al eliminar:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
    
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// RUTA 5: ACTUALIZAR NEGOCIO
// ═══════════════════════════════════════
router.post('/update-biz', async (req, res) => {
  try {
    const data = req.body;

    if (!data || !data.id) {
      return res.status(400).json({ success: false, error: 'Falta el ID de la barbería' });
    }

    const payload = {
      id: data.id,
      name: data.name || 'Sin nombre',
      owner: data.owner || '',
      email: data.email || '',
      password: data.pass || data.password || '', 
      phone: data.phone || '',
      addr: data.addr || '',
      city: data.city || '',
      country: data.country || '',
      type: data.type || '',
      plan: data.plan || 'trial',
      desc_text: data.desc || data.desc_text || '',
      logo: data.logo || '',
      cover: data.cover || '',
      insta: data.insta || '',
      joinDate: data.joinDate || new Date().toISOString().split('T')[0],
      horario: Array.isArray(data.horario) ? data.horario : [],
      photos: Array.isArray(data.photos) ? data.photos : []
    };

    const { error } = await supabase.from('businesses').upsert(payload);

    if (error) {
      return res.status(400).json({ success: false, error: 'Rechazo Supabase: ' + error.message });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false, error: 'Fallo interno: ' + err.message });
  }
});

module.exports = router;
