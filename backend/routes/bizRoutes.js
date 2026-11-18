const express = require('express');
const supabase = require('../db');
const {
  verifyToken,
  optionalAuth,
  requireRole,
  canAccessBusiness,
  isBusinessOwnerOrAdmin,
  signSessionToken
} = require('../middlewares/auth');

const router = express.Router();

// ═══════════════════════════════════════
// RUTA: NEGOCIOS PÚBLICOS (PARA BÚSQUEDA)
// ═══════════════════════════════════════
router.get('/public-businesses', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
// RUTA: TIENDA PÚBLICA DE UN NEGOCIO (SIN DATOS INTERNOS NI COSTES)
// ═══════════════════════════════════════
router.get('/public-shop', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const bizId = String(req.query.id || '').trim();
    if (!bizId) return res.status(400).json({ error: 'Falta el ID del negocio' });

    const [bizRes, prodRes] = await Promise.all([
      supabase.from('businesses').select('id, name, phone, country, logo').eq('id', bizId).single(),
      supabase.from('products')
        .select('id, business_id, name, description, price, stock, image, category, rating, discount_percent, active')
        .eq('business_id', bizId)
        .order('name', { ascending: true })
    ]);

    if (bizRes.error || !bizRes.data) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const activeProducts = (prodRes.data || []).filter(p => p.active !== false);
    return res.status(200).json({
      business: bizRes.data,
      products: activeProducts
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// RUTA: LIKE PÚBLICO EN PRODUCTO DE TIENDA (+1 / -1)
// ═══════════════════════════════════════
router.post('/public-shop-like', async (req, res) => {
  try {
    const { product_id, delta } = req.body || {};
    if (!product_id) return res.status(400).json({ success: false });
    const step = delta === -1 ? -1 : 1;
    const { data: p } = await supabase.from('products').select('rating').eq('id', String(product_id)).single();
    if (!p) return res.status(404).json({ success: false });
    const nextRating = Math.max(0, (parseFloat(p.rating) || 0) + step);
    await supabase.from('products').update({ rating: nextRating }).eq('id', String(product_id));
    return res.status(200).json({ success: true, rating: nextRating });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
});

// ═══════════════════════════════════════
// RUTA: SALDO DE FIDELIZACIÓN DE UN CLIENTE INDIVIDUAL (PÚBLICO SIN PII AJENA)
// ═══════════════════════════════════════
router.get('/public-client-loyalty', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const bizId = String(req.query.business_id || '').trim();
    const email = String(req.query.email || '').trim().toLowerCase();
    const phone = String(req.query.phone || '').replace(/\D/g, '');
    if (!bizId || (!email && !phone)) {
      return res.status(200).json({ found: false, points: 0, last_visit_at: null });
    }

    let match = null;
    if (email) {
      const { data } = await supabase
        .from('clients')
        .select('points, last_visit_at')
        .eq('business_id', bizId)
        .ilike('email', email)
        .limit(1);
      if (data && data.length > 0) match = data[0];
    }
    if (!match && phone && phone.length >= 7) {
      const tail = phone.slice(-8);
      const { data } = await supabase
        .from('clients')
        .select('phone, points, last_visit_at')
        .eq('business_id', bizId)
        .ilike('phone', '%' + tail)
        .limit(5);
      if (data && data.length > 0) {
        match = data.find(c => String(c.phone || '').replace(/\D/g, '').endsWith(tail)) || data[0];
      }
    }

    if (!match) return res.status(200).json({ found: false, points: 0, last_visit_at: null });
    return res.status(200).json({
      found: true,
      points: parseInt(match.points, 10) || 0,
      last_visit_at: match.last_visit_at || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// HELPER: Traer TODAS las citas sin el tope de 1.000 filas de Supabase
// ═══════════════════════════════════════════════════════════════════
async function fetchAllAppointments(businessId) {
  let allAppointments = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', businessId)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('Error fetching appointments batch for ' + businessId + ':', error.message);
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    allAppointments = allAppointments.concat(data);

    if (data.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  return allAppointments;
}

// ═══════════════════════════════════════
// RUTA 2: OBTENER DATOS DEL NEGOCIO (GET-BIZ)
// Si el caller está autenticado (dueño, trabajador o admin) devuelve datos completos.
// Si es un visitante público (#b/id), devuelve proyección segura SIN PII de clientes ni tokens.
// ═══════════════════════════════════════
router.get('/get-biz', optionalAuth, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const bizId = req.query.id;
    if (!bizId) {
      return res.status(400).json({ error: 'Falta el ID del negocio' });
    }

    const isPriv = canAccessBusiness(req.user, bizId);

    // Traer el negocio
    const { data: biz, error } = await supabase
      .from('businesses')
      .select('id, name, owner, email, phone, addr, city, country, type, plan, desc_text, logo, cover, insta, facebook, x_url, tiktok, join_date, expires_at, horario, photos, loyalty, referred_by_code, created_at')
      .eq('id', bizId)
      .single();

    if (error || !biz) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    // 🛡️ CORTE AUTOMÁTICO POR FECHA: Si expires_at ya venció, marcar inmediatamente como expired
    if (biz.expires_at && biz.plan !== 'expired' && biz.plan !== 'suspended' && biz.plan !== 'lifetime') {
      const expDate = new Date(biz.expires_at + 'T23:59:59');
      const now = new Date();
      if (now > expDate) {
        biz.plan = 'expired';
        supabase
          .from('businesses')
          .update({ plan: 'expired' })
          .eq('id', biz.id)
          .then(() => {
            console.log(`[AUTO-EXPIRE] Negocio ${biz.id} (${biz.name}) venció el ${biz.expires_at}. Plan cambiado a 'expired'.`);
          })
          .catch(err => {
            console.error('[AUTO-EXPIRE] Error actualizando plan expired:', err.message);
          });
      }
    }

    // Traer workers (sin password)
    const { data: workers } = await supabase
      .from('workers')
      .select('id, business_id, created_at, name, email, phone, avatar, cover, role, horario, commission_services, commission_products, active')
      .eq('business_id', bizId);

    // Traer appointments (paginadas)
    const appointments = await fetchAllAppointments(bizId);

    // Traer services
    const { data: services } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', bizId);

    // Solo traer saldos globales de fidelización para usuarios autenticados del negocio
    let loyaltyClients = [];
    if (isPriv) {
      const { data: lcData } = await supabase
        .from('clients')
        .select('id, email, phone, points, last_visit_at')
        .eq('business_id', bizId)
        .limit(1000);
      loyaltyClients = lcData || [];
    }

    // Mapear workers con sus citas y servicios (filtrando PII si es visitante público)
    biz.workers = (workers || []).map(function (w) {
      var wAppts = (appointments || []).filter(function (a) {
        return String(a.worker_id || '').trim() === String(w.id || '').trim();
      });
      var wSvcs = (services || []).filter(function (s) {
        return String(s.worker_id || '').trim() === String(w.id || '').trim();
      });

      return {
        id: w.id,
        name: w.name || '',
        email: isPriv ? (w.email || '') : '',
        phone: isPriv ? (w.phone || '') : '',
        spec: w.role || '',
        photo: w.avatar || '',
        cover: w.cover || '',
        active: w.active !== false,
        commission_services: isPriv ? (parseFloat(w.commission_services) || 0) : 0,
        commission_products: isPriv ? (parseFloat(w.commission_products) || 0) : 0,
        services: wSvcs.map(function (s) {
          return {
            id: s.id,
            name: s.name || '',
            price: parseFloat(s.price) || 0,
            dur: parseInt(s.duration) || 30,
            desc: s.description || '',
            color: s.color || '',
            photo: s.image || '',
            points: s.points != null ? parseInt(s.points, 10) : 10
          };
        }),
        horario: (w.horario && Array.isArray(w.horario) && w.horario.length > 0) ? w.horario : (biz.horario || []),
        appointments: wAppts.map(function (a) {
          if (!isPriv) {
            return {
              id: a.id,
              workerId: a.worker_id,
              date: a.date || '',
              time: a.time || '',
              svc: a.service_name || '',
              status: a.status || 'confirmed'
            };
          }
          return {
            id: a.id,
            workerId: a.worker_id,
            client: a.client_name || '',
            phone: a.client_phone || '',
            email: a.client_email || '',
            date: a.date || '',
            time: a.time || '',
            svc: a.service_name || '',
            workerName: w.name || '',
            price: parseFloat(a.service_price) || 0,
            status: a.status || 'confirmed',
            notes: a.notes || '',
            token: a.token || a.id
          };
        }),
        photos: [],
        notifications: [],
      };
    });

    // Appointments sin worker (Servicios Generales)
    var unassignedAppts = (appointments || []).filter(function (a) {
      return !a.worker_id || String(a.worker_id).trim() === '';
    });
    biz.appointments = unassignedAppts.map(function (a) {
      if (!isPriv) {
        return {
          id: a.id,
          workerId: '',
          date: a.date || '',
          time: a.time || '',
          svc: a.service_name || '',
          status: a.status || 'confirmed'
        };
      }
      return {
        id: a.id,
        workerId: '',
        client: a.client_name || '',
        phone: a.client_phone || '',
        email: a.client_email || '',
        date: a.date || '',
        time: a.time || '',
        svc: a.service_name || '',
        workerName: 'Servicios Generales',
        price: parseFloat(a.service_price) || 0,
        status: a.status || 'confirmed',
        notes: a.notes || '',
        token: a.token || a.id
      };
    });

    // Ocultar email privado del propietario a visitantes públicos
    if (!isPriv) {
      biz.email = '';
      delete biz.referred_by_code;
    }

    // Mapear campos snake_case
    biz.joinDate = biz.join_date;
    biz.desc = biz.desc_text || '';
    var unassignedSvcs = (services || []).filter(function (s) {
      return !s.worker_id || String(s.worker_id).trim() === '';
    });
    biz.services = unassignedSvcs.map(function (s) {
      return {
        id: s.id,
        name: s.name || '',
        price: parseFloat(s.price) || 0,
        dur: parseInt(s.duration) || 30,
        desc: s.description || '',
        color: s.color || '#4A7FD4',
        photo: s.image || '',
        active: s.active !== false,
        points: s.points != null ? parseInt(s.points, 10) : 10
      };
    });

    biz.photos = biz.photos || [];
    biz.horario = biz.horario || [];
    biz.loyalty = biz.loyalty || { active: true, mode: 'stamps', stamps: 10, points_goal: 100, reward_type: 'free_service', reward_pct: 100 };
    biz.clientLoyalty = isPriv ? loyaltyClients.map(function (c) {
      return {
        id: c.id,
        email: c.email || '',
        phone: c.phone || '',
        points: parseInt(c.points, 10) || 0,
        last_visit_at: c.last_visit_at || null
      };
    }) : [];

    return res.status(200).json(biz);

  } catch (err) {
    console.error('Server error get-biz:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// RUTA 3: OBTENER TODA LA BD (Solo Super Admin)
// ═══════════════════════════════════════
router.get('/get-db', verifyToken, requireRole('super_admin'), async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, name, owner, email, phone, addr, city, country, type, plan, desc_text, logo, cover, insta, facebook, x_url, tiktok, join_date, expires_at, horario, photos, loyalty, referred_by_code, created_at');
    if (error) { console.error('Error get-db:', error); return res.status(400).json([]); }

    for (let biz of (businesses || [])) {
      // MAGIA DE SEGURIDAD: NO traemos contraseñas de nadie
      const { data: workers } = await supabase
        .from('workers')
        .select('id, business_id, created_at, name, email, phone, avatar, cover, role, horario')
        .eq('business_id', biz.id);

      const appointments = await fetchAllAppointments(biz.id);

      const { data: services } = await supabase
        .from('services').select('*').eq('business_id', biz.id);

      const { data: clients } = await supabase
        .from('clients').select('*').eq('business_id', biz.id);

      const { data: products } = await supabase
        .from('products').select('*').eq('business_id', biz.id);

      biz.workers = (workers || []).map(function (w) {
        var wAppts = (appointments || []).filter(function (a) { return String(a.worker_id || '').trim() === String(w.id || '').trim(); });
        var wSvcs = (services || []).filter(function (s) { return String(s.worker_id || '').trim() === String(w.id || '').trim(); });

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
              workerId: a.worker_id,
              client: a.client_name || '',
              phone: a.client_phone || '',
              email: a.client_email || '',
              date: a.date || '',
              time: a.time || '',
              svc: a.service_name || '',
              workerName: w.name || '',
              price: parseFloat(a.service_price) || 0,
              status: a.status || 'confirmed',
              notes: a.notes || '',
              token: a.token || ''
            };
          }),
          photos: [], notifications: []
        };
      });

      var unassignedAppts = (appointments || []).filter(function (a) { return !a.worker_id || String(a.worker_id).trim() === ''; });
      biz.appointments = unassignedAppts.map(function (a) {
        return {
          id: a.id, client: a.client_name || '', phone: a.client_phone || '', email: '',
          date: a.date || '', time: a.time || '', svc: a.service_name || '', workerName: '',
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
// RUTA 4: ELIMINAR NEGOCIO (Solo Super Admin)
// ═══════════════════════════════════════
router.post('/delete-biz', verifyToken, requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: 'Falta el ID del negocio' });
    }

    // 1. Barrido en cascada
    await supabase.from('pos_sales').delete().eq('business_id', id);
    await supabase.from('pos_expenses').delete().eq('business_id', id);
    await supabase.from('pos_cash_registers').delete().eq('business_id', id);
    await supabase.from('appointments').delete().eq('business_id', id);
    await supabase.from('products').delete().eq('business_id', id);
    await supabase.from('services').delete().eq('business_id', id);
    await supabase.from('clients').delete().eq('business_id', id);
    await supabase.from('push_subscriptions').delete().eq('business_id', id);
    await supabase.from('notifications').delete().eq('business_id', id);
    await supabase.from('workers').delete().eq('business_id', id);

    // 2. Eliminar negocio
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
// RUTA 5: ACTUALIZAR O REGISTRAR NEGOCIO
// ═══════════════════════════════════════
router.post('/update-biz', optionalAuth, async (req, res) => {
  try {
    const data = req.body;

    if (!data || !data.id) {
      return res.status(400).json({ success: false, error: 'Falta el ID del negocio' });
    }

    const isSuperAdmin = Boolean(req.user && req.user.role === 'super_admin');
    const isOwner = Boolean(req.user && req.user.role === 'business' && String(req.user.bizId) === String(data.id));
    let isBrandNewSignup = false;

    if (!isSuperAdmin && !isOwner) {
      // Si viene un worker u otro negocio autenticado, denegar
      if (req.user) {
        return res.status(403).json({ success: false, error: 'Permisos insuficientes para editar este negocio' });
      }
      // Sin sesión: solo permitir alta de negocio NUEVO que no exista todavía
      const { data: existingById } = await supabase.from('businesses').select('id').eq('id', data.id).limit(1);
      if (existingById && existingById.length > 0) {
        return res.status(401).json({ success: false, error: 'Sesión requerida para actualizar este negocio', code: 'AUTH_REQUIRED' });
      }
      if (!data.name || !data.email) {
        return res.status(401).json({ success: false, error: 'Sesión requerida', code: 'AUTH_REQUIRED' });
      }
      const { data: existingByEmail } = await supabase.from('businesses').select('id').ilike('email', String(data.email).trim()).limit(1);
      if (existingByEmail && existingByEmail.length > 0) {
        return res.status(409).json({ success: false, error: 'Ya existe un negocio con ese correo electrónico' });
      }
      isBrandNewSignup = true;
    }

    // Construir el payload de forma dinámica
    const payload = { id: data.id };

    if (data.name !== undefined) payload.name = data.name;
    if (data.owner !== undefined) payload.owner = data.owner;
    if (data.email !== undefined) payload.email = String(data.email).trim().toLowerCase();
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.addr !== undefined) payload.addr = data.addr;
    if (data.city !== undefined) payload.city = data.city;
    if (data.country !== undefined) payload.country = data.country;
    if (data.type !== undefined) payload.type = data.type;
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
    if (data.horario !== undefined) payload.horario = Array.isArray(data.horario) ? data.horario : [];
    if (data.photos !== undefined) payload.photos = Array.isArray(data.photos) ? data.photos : [];
    if (data.loyalty !== undefined) payload.loyalty = data.loyalty;
    if (data.referred_by_code !== undefined) payload.referred_by_code = data.referred_by_code;

    // Solo Super Admin puede cambiar plan/expires_at; un alta nueva siempre nace como trial (15 días)
    if (isSuperAdmin) {
      if (data.plan !== undefined) payload.plan = data.plan;
      if (data.expires_at !== undefined) payload.expires_at = data.expires_at;
    } else if (isBrandNewSignup) {
      payload.plan = 'trial';
      const exp = new Date();
      exp.setDate(exp.getDate() + 15);
      payload.expires_at = exp.toISOString().split('T')[0];
    }

    if (data.pass) {
      const bcrypt = require('bcryptjs');
      payload.password = bcrypt.hashSync(String(data.pass), 10);
    }

    let error;
    if (payload.name === undefined) {
      const updatePayload = { ...payload };
      delete updatePayload.id;
      const resUpdate = await supabase.from('businesses').update(updatePayload).eq('id', payload.id);
      error = resUpdate.error;
    } else {
      const resUpsert = await supabase.from('businesses').upsert(payload);
      error = resUpsert.error;
    }

    if (error) {
      return res.status(400).json({ success: false, error: 'Rechazo Supabase: ' + error.message });
    }

    const resp = { success: true };
    if (isBrandNewSignup) {
      resp.token = signSessionToken({
        role: 'business',
        bizId: payload.id,
        email: payload.email || ''
      });
    }
    return res.status(200).json(resp);

  } catch (err) {
    return res.status(500).json({ success: false, error: 'Fallo interno: ' + err.message });
  }
});

// ═══════════════════════════════════════
// RUTA 6: OBTENER AFILIADOS (Solo Super Admin)
// ═══════════════════════════════════════
router.get('/admin-affiliates', verifyToken, requireRole('super_admin'), async (req, res) => {
  try {
    const { data: affiliates, error } = await supabase
      .from('affiliates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(affiliates);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// RUTA 7: CREAR AFILIADO (Solo Super Admin)
// ═══════════════════════════════════════
router.post('/admin-create-affiliate', verifyToken, requireRole('super_admin'), async (req, res) => {
  try {
    const { code, name, email } = req.body;
    if (!code || !name) {
      return res.status(400).json({ success: false, error: 'Falta nombre o código.' });
    }

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      email: email ? email.trim().toLowerCase() : null
    };

    const { error } = await supabase.from('affiliates').insert([payload]);

    if (error) {
      // Verificar si el código ya existe
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'El código de referido ya existe.' });
      }
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
