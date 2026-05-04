const express = require('express');
const supabase = require('../db');
const { verifyToken } = require('../middlewares/auth');

const router = express.Router();

// ═══════════════════════════════════════
// RUTA: NEGOCIOS PÚBLICOS (PARA BÚSQUEDA)
// ═══════════════════════════════════════
router.get('/public-businesses', async (req, res) => {
  try {
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, name, city, type, logo, cover, addr, insta, facebook, x_url');

    if (error) {
      return res.status(500).json({ error: 'Error obteniendo negocios públicos' });
    }

    return res.status(200).json(businesses);
  } catch (err) {
    console.error('Server error get-public-businesses:', err);
    return res.status(500).json({ error: err.message });
  }
});

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
    biz.workers = (workers || []).map(function (w) {
      var wAppts = (appointments || []).filter(function (a) { return a.worker_id === w.id; });
      var wSvcs = (services || []).filter(function (s) { return s.worker_id === w.id; });

      return {
        id: w.id,
        name: w.name || '',
        email: w.email || '',
        phone: w.phone || '',
        spec: w.role || '',
        photo: w.avatar || '',
        cover: w.cover || '',
        active: true,
        services: wSvcs.map(function (s) {
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
        appointments: wAppts.map(function (a) {
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
    var unassignedAppts = (appointments || []).filter(function (a) {
      return !a.worker_id;
    });
    biz.appointments = unassignedAppts.map(function (a) {
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
    var unassignedSvcs = (services || []).filter(function (s) {
      return !s.worker_id;
    });
    biz.services = unassignedSvcs.map(function (s) {
      return {
        id: s.id,
        name: s.name || '',
        price: parseFloat(s.price) || 0,
        dur: parseInt(s.duration) || 30,
        desc: s.description || '',
        color: s.color || '',
        photo: s.image || ''
      };
    });

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

      biz.workers = (workers || []).map(function (w) {
        var wAppts = (appointments || []).filter(function (a) { return a.worker_id === w.id; });
        var wSvcs = (services || []).filter(function (s) { return s.worker_id === w.id; });

        return {
          id: w.id,
          name: w.name || '',
          email: w.email || '',
          phone: w.phone || '',
          spec: w.role || '',
          photo: w.avatar || '',
          cover: w.cover || '',
          active: true,
          services: wSvcs.map(function (s) {
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
          horario: (w.horario && Array.isArray(w.horario) && w.horario.length > 0)
            ? w.horario : (biz.horario || []),
          appointments: wAppts.map(function (a) {
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
              notes: a.notes || '',
              token: a.token || ''
            };
          }),
          photos: [], notifications: []
        };
      });

      var unassignedAppts = (appointments || []).filter(function (a) { return !a.worker_id; });
      biz.appointments = unassignedAppts.map(function (a) {
        return {
          id: a.id, client: a.client_name || '', phone: a.client_phone || '', email: '',
          date: a.date || '', time: a.time || '', svc: a.service_name || '', barber: '',
          price: parseFloat(a.service_price) || 0, status: a.status || 'confirmed', notes: '', token: a.token || ''
        };
      });

      biz.joinDate = biz.join_date; biz.desc = biz.desc_text || '';
      var unassignedSvcs = (services || []).filter(function (s) { return !s.worker_id; });
      biz.services = unassignedSvcs.map(function (s) {
        return {
          id: s.id, name: s.name || '', price: parseFloat(s.price) || 0, dur: parseInt(s.duration) || 30,
          desc: s.description || '', color: s.color || '', photo: s.image || ''
        };
      });

      biz.photos = biz.photos || []; biz.horario = biz.horario || [];
      biz.loyalty = biz.loyalty || { active: true, stamps: 10 };
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

    // 1. 🧹 BARRIDO EN CASCADA MANUAL: Eliminar todos los registros dependientes primero para evitar el error 23503 de Supabase
    await supabase.from('appointments').delete().eq('business_id', id);
    await supabase.from('products').delete().eq('business_id', id);
    await supabase.from('services').delete().eq('business_id', id);
    await supabase.from('clients').delete().eq('business_id', id);
    await supabase.from('push_subscriptions').delete().eq('business_id', id);
    await supabase.from('notifications').delete().eq('business_id', id);
    await supabase.from('workers').delete().eq('business_id', id);

    // 2. 🔥 Finalmente, eliminar el negocio limpio
    const { error } = await supabase.from('businesses').delete().eq('id', id);

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

    // Construir el payload de forma dinámica (solo con las propiedades que vienen en la petición)
    const payload = { id: data.id };

    if (data.name !== undefined) payload.name = data.name;
    if (data.owner !== undefined) payload.owner = data.owner;
    if (data.email !== undefined) payload.email = data.email;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.addr !== undefined) payload.addr = data.addr;
    if (data.city !== undefined) payload.city = data.city;
    if (data.country !== undefined) payload.country = data.country;
    if (data.type !== undefined) payload.type = data.type;
    if (data.plan !== undefined) payload.plan = data.plan;
    if (data.desc !== undefined) payload.desc_text = data.desc;
    else if (data.desc_text !== undefined) payload.desc_text = data.desc_text;
    if (data.logo !== undefined) payload.logo = data.logo;
    if (data.cover !== undefined) payload.cover = data.cover;
    if (data.insta !== undefined) payload.insta = data.insta;
    if (data.facebook !== undefined) payload.facebook = data.facebook;
    if (data.x_url !== undefined) payload.x_url = data.x_url;
    if (data.tiktok !== undefined) payload.tiktok = data.tiktok;
    if (data.joinDate !== undefined) payload.join_date = data.joinDate;
    else if (data.join_date !== undefined) payload.join_date = data.join_date;
    if (data.expires_at !== undefined) payload.expires_at = data.expires_at;
    if (data.horario !== undefined) payload.horario = Array.isArray(data.horario) ? data.horario : [];
    if (data.photos !== undefined) payload.photos = Array.isArray(data.photos) ? data.photos : [];
    if (data.loyalty !== undefined) payload.loyalty = data.loyalty;

    if (data.pass || data.password) {
      payload.password = data.pass || data.password;
    }

    let error;
    // Si el payload no tiene 'name', es una actualización parcial (ej. activar o suspender).
    // Usamos .update() para evitar el error "not-null constraint" de Supabase en inserts.
    if (payload.name === undefined) {
      const resUpdate = await supabase.from('businesses').update(payload).eq('id', payload.id);
      error = resUpdate.error;
    } else {
      const resUpsert = await supabase.from('businesses').upsert(payload);
      error = resUpsert.error;
    }

    if (error) {
      return res.status(400).json({ success: false, error: 'Rechazo Supabase: ' + error.message });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false, error: 'Fallo interno: ' + err.message });
  }
});

module.exports = router;
