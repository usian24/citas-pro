const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db');

const router = express.Router();

const DEFAULT_PIN = '12345';
const DEFAULT_POS_CONFIG = {
  low_stock_alert: 5,
  close_reminder_time: '21:00',
  payment_methods: [
    { name: 'Efectivo', key: 'cash' },
    { name: 'Tarjeta', key: 'card' },
    { name: 'Transferencia', key: 'transfer' }
  ]
};

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function mergePosConfig(raw) {
  const cfg = (raw && typeof raw === 'object') ? raw : {};
  const taxRaw = (cfg.tax && typeof cfg.tax === 'object') ? cfg.tax : null;
  const crmRaw = (cfg.crm && typeof cfg.crm === 'object') ? cfg.crm : {};
  return {
    low_stock_alert: Number.isFinite(Number(cfg.low_stock_alert)) ? Math.max(0, parseInt(cfg.low_stock_alert, 10)) : DEFAULT_POS_CONFIG.low_stock_alert,
    close_reminder_time: typeof cfg.close_reminder_time === 'string' && /^\d{2}:\d{2}$/.test(cfg.close_reminder_time)
      ? cfg.close_reminder_time
      : DEFAULT_POS_CONFIG.close_reminder_time,
    payment_methods: Array.isArray(cfg.payment_methods) && cfg.payment_methods.length > 0
      ? cfg.payment_methods
      : DEFAULT_POS_CONFIG.payment_methods,
    tax: taxRaw ? {
      name: String(taxRaw.name || 'IVA').trim().slice(0, 20),
      rate_services: Math.min(60, Math.max(0, parseFloat(taxRaw.rate_services) || 0)),
      rate_products: Math.min(60, Math.max(0, parseFloat(taxRaw.rate_products) || 0)),
      included: taxRaw.included !== false
    } : null,
    crm: {
      review_url: String(crmRaw.review_url || '').trim(),
      msg_inactive: String(crmRaw.msg_inactive || 'Hola {nombre}, hace tiempo que no te vemos por {negocio}. Llevas {puntos}/{meta} {unidad} en tu tarjeta ({faltan} para tu premio). Te esperamos pronto.').trim(),
      msg_birthday: String(crmRaw.msg_birthday || 'Feliz cumpleaños {nombre}. Desde {negocio} te deseamos un gran día y te esperamos para celebrarlo.').trim(),
      msg_review: String(crmRaw.msg_review || 'Hola {nombre}, gracias por visitarnos en {negocio}. Si quedaste satisfecho, nos ayudaría mucho tu reseña aquí: {enlace}').trim(),
      msg_reward: String(crmRaw.msg_reward || 'Hola {nombre}, enhorabuena. Ya completaste tu tarjeta en {negocio} ({puntos}/{meta} {unidad}) y tienes listo tu premio: {premio}. Te esperamos para canjearlo.').trim()
    }
  };
}

function normalizeLoyaltyConfig(raw) {
  const cfg = (raw && typeof raw === 'object') ? raw : {};
  const mode = cfg.mode === 'points' ? 'points' : 'stamps';
  const stamps = Math.min(30, Math.max(2, parseInt(cfg.stamps, 10) || 10));
  const points_goal = Math.min(10000, Math.max(10, parseInt(cfg.points_goal, 10) || 100));
  const reward_type = ['free_service', 'discount_pct', 'free_product'].includes(cfg.reward_type)
    ? cfg.reward_type
    : 'free_service';
  const reward_pct = reward_type === 'free_service'
    ? 100
    : Math.min(100, Math.max(1, parseInt(cfg.reward_pct, 10) || 50));
  const reward_product_id = String(cfg.reward_product_id || '').trim();
  const reward_product_name = String(cfg.reward_product_name || '').trim();
  return {
    active: cfg.active !== undefined ? Boolean(cfg.active) : true,
    mode,
    stamps,
    points_goal,
    goal: mode === 'points' ? points_goal : stamps,
    unit: mode === 'points' ? 'puntos' : 'sellos',
    reward_type,
    reward_pct,
    reward_product_id,
    reward_product_name,
    reward_label: reward_type === 'free_product'
      ? ((reward_product_name || 'Producto') + ' gratis')
      : (reward_type === 'free_service' ? 'Servicio gratis (100% dto.)' : (reward_pct + '% dto. en servicio'))
  };
}

function isCashMethod(methodName) {
  return /efectivo|cash/i.test(String(methodName || ''));
}

function verifyBusinessPin(pinInput, storedHash) {
  const pin = String(pinInput || '').trim();
  if (!pin) return false;
  if (!storedHash) {
    return pin === DEFAULT_PIN;
  }
  try {
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      return bcrypt.compareSync(pin, storedHash);
    }
    return pin === storedHash;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════
// GET /api/pos/state — Carga consolidada de Caja y Tienda
// ═══════════════════════════════════════════════════
router.get('/pos/state', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const bizId = String(req.query.business_id || '').trim();
    const today = String(req.query.date || new Date().toISOString().split('T')[0]).trim();

    if (!bizId) {
      return res.status(400).json({ error: 'business_id es requerido' });
    }

    const [
      bizRes,
      regRes,
      salesRes,
      prodsRes,
      svcsRes,
      clientsRes,
      apptsClientsRes
    ] = await Promise.all([
      supabase.from('businesses').select('id, name, country, owner_pin, pos_config, loyalty').eq('id', bizId).single(),
      supabase.from('pos_cash_registers').select('*').eq('business_id', bizId).order('date', { ascending: false }).limit(20),
      supabase.from('pos_sales').select('*').eq('business_id', bizId).eq('sale_date', today).order('created_at', { ascending: false }).limit(300),
      supabase.from('products').select('*').eq('business_id', bizId).order('name', { ascending: true }),
      supabase.from('services').select('*').eq('business_id', bizId).eq('worker_id', '').order('name', { ascending: true }),
      supabase.from('clients').select('*').eq('business_id', bizId).order('name', { ascending: true }).limit(500),
      supabase.from('appointments').select('client_name, client_phone, client_email').eq('business_id', bizId).order('date', { ascending: false }).limit(500)
    ]);

    if (bizRes.error || !bizRes.data) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    // Combinar clientes de public.clients + clientes históricos de citas del MISMO negocio sin duplicar
    const mergedClients = (clientsRes.data || []).slice();
    const seenKeys = new Set();
    mergedClients.forEach(c => {
      const ph = String(c.phone || '').replace(/\D/g, '');
      const em = String(c.email || '').toLowerCase().trim();
      const nm = String(c.name || '').toLowerCase().trim();
      if (ph) seenKeys.add('p:' + ph);
      if (em) seenKeys.add('e:' + em);
      if (nm) seenKeys.add('n:' + nm);
    });
    (apptsClientsRes.data || []).forEach((a, idx) => {
      const name = String(a.client_name || '').trim();
      if (!name) return;
      const ph = String(a.client_phone || '').replace(/\D/g, '');
      const em = String(a.client_email || '').toLowerCase().trim();
      const nm = name.toLowerCase();
      if ((ph && seenKeys.has('p:' + ph)) || (em && seenKeys.has('e:' + em)) || seenKeys.has('n:' + nm)) return;
      if (ph) seenKeys.add('p:' + ph);
      if (em) seenKeys.add('e:' + em);
      seenKeys.add('n:' + nm);
      mergedClients.push({
        id: 'appt_cl_' + idx,
        business_id: bizId,
        name,
        phone: a.client_phone || '',
        email: a.client_email || '',
        points: 0,
        from_appointments: true
      });
    });
    mergedClients.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));

    const registers = regRes.data || [];
    const todayRegister = registers.find(r => r.date === today) || null;
    const pendingRegisters = registers.filter(r => r.date < today && r.status === 'open');

    return res.status(200).json({
      date: today,
      register: todayRegister,
      pendingRegisters,
      recentRegisters: registers.slice(0, 14),
      sales: salesRes.data || [],
      products: (prodsRes.data || []).map(p => ({
        id: p.id,
        business_id: p.business_id,
        name: p.name || '',
        description: p.description || '',
        price: parseFloat(p.price) || 0,
        cost_price: parseFloat(p.cost_price) || 0,
        internal_price: parseFloat(p.internal_price) || 0,
        stock: parseInt(p.stock, 10) || 0,
        min_stock: p.min_stock != null ? parseInt(p.min_stock, 10) : 5,
        barcode: p.barcode || '',
        supplier: p.supplier || '',
        tax_rate: p.tax_rate != null ? parseFloat(p.tax_rate) : null,
        category: p.category || 'General',
        discount_percent: parseFloat(p.discount_percent) || 0,
        rating: parseFloat(p.rating) || 5.0,
        image: p.image || '',
        active: p.active !== false
      })),
      generalServices: (svcsRes.data || []).map(s => ({
        id: s.id,
        business_id: s.business_id,
        worker_id: '',
        name: s.name || '',
        price: parseFloat(s.price) || 0,
        dur: parseInt(s.duration, 10) || 30,
        desc: s.description || '',
        color: s.color || '',
        photo: s.image || '',
        active: s.active !== false,
        points: s.points != null ? parseInt(s.points, 10) : 10
      })),
      clients: mergedClients,
      posConfig: mergePosConfig(bizRes.data.pos_config),
      loyalty: normalizeLoyaltyConfig(bizRes.data.loyalty),
      hasCustomPin: Boolean(bizRes.data.owner_pin)
    });
  } catch (err) {
    console.error('[POS] Error en /pos/state:', err);
    return res.status(500).json({ error: 'Error cargando estado de caja: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/pos/sales — Consultar ventas por fecha o rango
// ═══════════════════════════════════════════════════
router.get('/pos/sales', async (req, res) => {
  try {
    const bizId = String(req.query.business_id || '').trim();
    const date = req.query.date ? String(req.query.date).trim() : null;
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;

    if (!bizId) return res.status(400).json({ error: 'business_id requerido' });

    let query = supabase
      .from('pos_sales')
      .select('*')
      .eq('business_id', bizId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (date) {
      query = query.eq('sale_date', date);
    } else {
      if (from) query = query.gte('sale_date', from);
      if (to) query = query.lte('sale_date', to);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ sales: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/verify-pin — Validar PIN del dueño (default 12345)
// ═══════════════════════════════════════════════════
router.post('/pos/verify-pin', async (req, res) => {
  try {
    const { business_id, pin } = req.body || {};
    if (!business_id || !pin) {
      return res.status(400).json({ success: false, error: 'Faltan datos' });
    }

    const { data: biz, error } = await supabase
      .from('businesses')
      .select('owner_pin')
      .eq('id', business_id)
      .single();

    if (error || !biz) {
      return res.status(404).json({ success: false, error: 'Negocio no encontrado' });
    }

    if (!verifyBusinessPin(pin, biz.owner_pin)) {
      return res.status(401).json({ success: false, error: 'PIN incorrecto' });
    }

    return res.status(200).json({ success: true, isDefault: !biz.owner_pin });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/update-pin — Cambiar PIN del dueño
// ═══════════════════════════════════════════════════
router.post('/pos/update-pin', async (req, res) => {
  try {
    const { business_id, current_pin, new_pin } = req.body || {};
    if (!business_id || !current_pin || !new_pin) {
      return res.status(400).json({ success: false, error: 'Completa todos los campos' });
    }

    const cleanNew = String(new_pin).trim();
    if (!/^\d{4,8}$/.test(cleanNew)) {
      return res.status(400).json({ success: false, error: 'El PIN debe tener entre 4 y 8 dígitos numéricos' });
    }

    const { data: biz, error: findErr } = await supabase
      .from('businesses')
      .select('owner_pin')
      .eq('id', business_id)
      .single();

    if (findErr || !biz) {
      return res.status(404).json({ success: false, error: 'Negocio no encontrado' });
    }

    if (!verifyBusinessPin(current_pin, biz.owner_pin)) {
      return res.status(401).json({ success: false, error: 'El PIN actual no es correcto' });
    }

    const hash = bcrypt.hashSync(cleanNew, 10);
    const { error: updErr } = await supabase
      .from('businesses')
      .update({ owner_pin: hash })
      .eq('id', business_id);

    if (updErr) return res.status(500).json({ success: false, error: updErr.message });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/config — Guardar configuración de caja
// ═══════════════════════════════════════════════════
router.post('/pos/config', async (req, res) => {
  try {
    const { business_id, pos_config } = req.body || {};
    if (!business_id || !pos_config) {
      return res.status(400).json({ success: false, error: 'Datos incompletos' });
    }

    const clean = mergePosConfig(pos_config);
    const { error } = await supabase
      .from('businesses')
      .update({ pos_config: clean })
      .eq('id', business_id);

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.status(200).json({ success: true, posConfig: clean });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/cash-open — Aperturar caja del día
// ═══════════════════════════════════════════════════
router.post('/pos/cash-open', async (req, res) => {
  try {
    const { business_id, date, opened_by, opening_cash } = req.body || {};
    if (!business_id || !date) {
      return res.status(400).json({ success: false, error: 'Faltan business_id o date' });
    }

    const cashVal = Math.max(0, Math.round((parseFloat(opening_cash) || 0) * 100) / 100);
    const regId = `reg_${business_id}_${date}`;

    const { data, error } = await supabase
      .from('pos_cash_registers')
      .upsert({
        id: regId,
        business_id,
        date,
        opened_by: String(opened_by || 'Propietario').trim(),
        opened_at: new Date().toISOString(),
        opening_cash: cashVal,
        closed_by: null,
        closed_at: null,
        counted_cash: null,
        expected_cash: null,
        difference: null,
        status: 'open'
      }, { onConflict: 'business_id,date' })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.status(200).json({ success: true, register: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/cash-close — Cerrar caja y calcular cuadre
// ═══════════════════════════════════════════════════
router.post('/pos/cash-close', async (req, res) => {
  try {
    const { business_id, date, closed_by, counted_cash } = req.body || {};
    if (!business_id || !date || counted_cash === undefined || counted_cash === null) {
      return res.status(400).json({ success: false, error: 'Datos incompletos para cierre de caja' });
    }

    const counted = Math.max(0, Math.round((parseFloat(counted_cash) || 0) * 100) / 100);

    const [regRes, salesRes] = await Promise.all([
      supabase.from('pos_cash_registers').select('*').eq('business_id', business_id).eq('date', date).single(),
      supabase.from('pos_sales').select('*').eq('business_id', business_id).eq('sale_date', date).eq('status', 'completed')
    ]);

    const openingCash = regRes.data ? (parseFloat(regRes.data.opening_cash) || 0) : 0;
    const sales = salesRes.data || [];

    let totalSales = 0;
    let cashSales = 0;
    let cashTips = 0;

    sales.forEach(s => {
      const t = parseFloat(s.total) || 0;
      const tip = parseFloat(s.tip) || 0;
      totalSales += t;
      if (isCashMethod(s.payment_method)) {
        cashSales += t;
        cashTips += tip;
      }
    });

    const expectedCash = Math.round((openingCash + cashSales + cashTips) * 100) / 100;
    const difference = Math.round((counted - expectedCash) * 100) / 100;
    totalSales = Math.round(totalSales * 100) / 100;

    const regId = regRes.data ? regRes.data.id : `reg_${business_id}_${date}`;
    const { data, error } = await supabase
      .from('pos_cash_registers')
      .upsert({
        id: regId,
        business_id,
        date,
        opened_by: regRes.data ? regRes.data.opened_by : String(closed_by || 'Propietario'),
        opened_at: regRes.data ? regRes.data.opened_at : new Date().toISOString(),
        opening_cash: openingCash,
        closed_by: String(closed_by || 'Propietario').trim(),
        closed_at: new Date().toISOString(),
        counted_cash: counted,
        expected_cash: expectedCash,
        difference,
        total_sales: totalSales,
        status: 'closed'
      }, { onConflict: 'business_id,date' })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.status(200).json({ success: true, register: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/cash-reopen — Reabrir caja del día
// ═══════════════════════════════════════════════════
router.post('/pos/cash-reopen', async (req, res) => {
  try {
    const { business_id, date } = req.body || {};
    if (!business_id || !date) {
      return res.status(400).json({ success: false, error: 'Faltan datos' });
    }

    const { data, error } = await supabase
      .from('pos_cash_registers')
      .update({
        status: 'open',
        closed_at: null,
        closed_by: null
      })
      .eq('business_id', business_id)
      .eq('date', date)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.status(200).json({ success: true, register: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/sale — Registrar cobro y descontar stock
// ═══════════════════════════════════════════════════
router.post('/pos/sale', async (req, res) => {
  try {
    const body = req.body || {};
    const { business_id, sale_date, payment_method } = body;

    if (!business_id || !sale_date || !payment_method) {
      return res.status(400).json({ success: false, error: 'Faltan business_id, sale_date o payment_method' });
    }

    const itemsServices = Array.isArray(body.items_services) ? body.items_services : [];
    const itemsProductsInput = Array.isArray(body.items_products) ? body.items_products.slice() : [];
    const wantRedeem = Boolean(body.redeem_loyalty);

    // 0. Cargar configuración de fidelización del negocio
    const { data: bizRow } = await supabase
      .from('businesses')
      .select('loyalty')
      .eq('id', business_id)
      .single();
    const loyaltyCfg = normalizeLoyaltyConfig(bizRow ? bizRow.loyalty : null);

    // 0b. Resolver o crear cliente primero para consultar su saldo real de puntos/sellos
    let resolvedClientId = (body.client_id && !String(body.client_id).startsWith('appt_cl_')) ? body.client_id : null;
    const clientName = String(body.client_name || '').trim();
    const clientPhone = String(body.client_phone || '').trim();
    const clientEmail = String(body.client_email || '').trim().toLowerCase();
    let currentClientPoints = 0;

    if (resolvedClientId) {
      const { data: clRow } = await supabase
        .from('clients')
        .select('id, points')
        .eq('id', resolvedClientId)
        .eq('business_id', business_id)
        .single();
      if (clRow) {
        currentClientPoints = Math.max(0, parseInt(clRow.points, 10) || 0);
      } else {
        resolvedClientId = null;
      }
    }

    if (!resolvedClientId && clientName && (clientPhone || clientEmail)) {
      let existingCl = null;
      if (clientPhone) {
        const { data: byPh } = await supabase
          .from('clients')
          .select('id, points')
          .eq('business_id', business_id)
          .eq('phone', clientPhone)
          .limit(1);
        if (byPh && byPh.length > 0) existingCl = byPh[0];
      }
      if (!existingCl && clientEmail) {
        const { data: byEm } = await supabase
          .from('clients')
          .select('id, points')
          .eq('business_id', business_id)
          .eq('email', clientEmail)
          .limit(1);
        if (byEm && byEm.length > 0) existingCl = byEm[0];
      }

      if (existingCl) {
        resolvedClientId = existingCl.id;
        currentClientPoints = Math.max(0, parseInt(existingCl.points, 10) || 0);
      } else {
        resolvedClientId = genId('cl');
        await supabase.from('clients').insert({
          id: resolvedClientId,
          business_id,
          name: clientName,
          phone: clientPhone,
          email: clientEmail,
          points: 0,
          last_visit_at: new Date().toISOString()
        });
        currentClientPoints = 0;
      }
    }

    // 0c. Verificar si se canjea premio de producto gratis
    let redeemedGiftProduct = false;
    const itemsProducts = itemsProductsInput.filter(item => !item.is_gift);
    if (wantRedeem && loyaltyCfg.active && resolvedClientId && currentClientPoints >= loyaltyCfg.goal && loyaltyCfg.reward_type === 'free_product' && loyaltyCfg.reward_product_id) {
      itemsProducts.push({
        id: loyaltyCfg.reward_product_id,
        name: loyaltyCfg.reward_product_name || 'Regalo fidelización',
        qty: 1,
        is_gift: true
      });
      redeemedGiftProduct = true;
    }

    if (itemsServices.length === 0 && itemsProducts.length === 0) {
      return res.status(400).json({ success: false, error: 'Debes añadir al menos un servicio o producto' });
    }

    // 1. Verificar stock real de los productos solicitados (soportando mismo producto normal + regalo)
    const stockUpdatesMap = {};
    const normalizedProducts = [];
    let productsTotal = 0;

    if (itemsProducts.length > 0) {
      const prodIds = [...new Set(itemsProducts.map(p => String(p.id)).filter(Boolean))];
      const { data: dbProds, error: pErr } = await supabase
        .from('products')
        .select('id, name, price, cost_price, stock, discount_percent')
        .eq('business_id', business_id)
        .in('id', prodIds);

      if (pErr) return res.status(500).json({ success: false, error: pErr.message });

      const prodMap = {};
      const remainingStock = {};
      (dbProds || []).forEach(p => {
        prodMap[p.id] = p;
        remainingStock[p.id] = parseInt(p.stock, 10) || 0;
      });

      for (const item of itemsProducts) {
        const qty = Math.max(1, parseInt(item.qty, 10) || 1);
        const dbP = prodMap[item.id];
        if (!dbP) {
          return res.status(400).json({ success: false, error: `Producto no encontrado: ${item.name || item.id}` });
        }
        const avail = remainingStock[dbP.id];
        if (avail < qty) {
          return res.status(400).json({ success: false, error: `Stock insuficiente para "${dbP.name}" (disponible: ${avail})` });
        }
        remainingStock[dbP.id] = avail - qty;
        stockUpdatesMap[dbP.id] = remainingStock[dbP.id];

        const rawPrice = parseFloat(dbP.price) || 0;
        const disc = parseFloat(dbP.discount_percent) || 0;
        const unitPrice = item.is_gift ? 0 : Math.round((disc > 0 ? rawPrice * (1 - disc / 100) : rawPrice) * 100) / 100;

        productsTotal += unitPrice * qty;
        normalizedProducts.push({
          id: dbP.id,
          name: dbP.name,
          qty,
          price: unitPrice,
          cost_price: parseFloat(dbP.cost_price) || 0,
          is_gift: Boolean(item.is_gift)
        });
      }
    }
    const stockUpdates = Object.keys(stockUpdatesMap).map(id => ({ id, newStock: stockUpdatesMap[id] }));

    // 2. Calcular servicios, puntos ganados y canje de fidelización
    let servicesTotal = 0;
    const svcIds = [...new Set(itemsServices.map(s => String(s.id || '')).filter(Boolean))];
    const svcPointsMap = {};
    if (svcIds.length > 0 && loyaltyCfg.active && loyaltyCfg.mode === 'points') {
      const { data: dbSvcs } = await supabase
        .from('services')
        .select('id, points')
        .eq('business_id', business_id)
        .in('id', svcIds);
      (dbSvcs || []).forEach(s => {
        svcPointsMap[s.id] = s.points != null ? Math.max(0, parseInt(s.points, 10) || 0) : 10;
      });
    }

    let pointsFromServices = 0;
    const normalizedServices = itemsServices.map(s => {
      const qty = Math.max(1, parseInt(s.qty, 10) || 1);
      const price = Math.max(0, parseFloat(s.price) || 0);
      servicesTotal += price * qty;
      const ptsPerUnit = (s.id && svcPointsMap[s.id] !== undefined)
        ? svcPointsMap[s.id]
        : (s.points != null ? Math.max(0, parseInt(s.points, 10) || 0) : 10);
      pointsFromServices += ptsPerUnit * qty;
      return {
        id: s.id || '',
        name: String(s.name || 'Servicio').trim(),
        qty,
        price
      };
    });

    servicesTotal = Math.round(servicesTotal * 100) / 100;
    productsTotal = Math.round(productsTotal * 100) / 100;

    const gross = servicesTotal + productsTotal;
    let discountLoyalty = 0;
    let pointsRedeemed = 0;

    if (redeemedGiftProduct) {
      pointsRedeemed = loyaltyCfg.goal;
    } else if (wantRedeem && loyaltyCfg.active && resolvedClientId && currentClientPoints >= loyaltyCfg.goal && servicesTotal > 0 && loyaltyCfg.reward_type !== 'free_product') {
      discountLoyalty = Math.min(servicesTotal, Math.round(servicesTotal * (loyaltyCfg.reward_pct / 100) * 100) / 100);
      pointsRedeemed = loyaltyCfg.goal;
    } else if (!wantRedeem && body.discount_loyalty) {
      discountLoyalty = Math.min(gross, Math.max(0, parseFloat(body.discount_loyalty) || 0));
    }

    const discountManual = Math.min(Math.max(0, gross - discountLoyalty), Math.max(0, parseFloat(body.discount_manual) || 0));
    const tip = Math.max(0, Math.round((parseFloat(body.tip) || 0) * 100) / 100);
    const total = Math.max(0, Math.round((gross - discountLoyalty - discountManual) * 100) / 100);

    let pointsEarned = 0;
    if (loyaltyCfg.active && resolvedClientId && normalizedServices.length > 0) {
      pointsEarned = loyaltyCfg.mode === 'points' ? pointsFromServices : 1;
    }

    // 3. Actualizar saldo de puntos/sellos y última visita del cliente
    let newClientPoints = currentClientPoints;
    if (resolvedClientId) {
      newClientPoints = Math.max(0, currentClientPoints - pointsRedeemed + pointsEarned);
      await supabase
        .from('clients')
        .update({
          last_visit_at: new Date().toISOString(),
          points: newClientPoints
        })
        .eq('id', resolvedClientId)
        .eq('business_id', business_id);
    }

    // 4. Buscar caja abierta del día si no vino cash_register_id
    let cashRegisterId = body.cash_register_id || null;
    if (!cashRegisterId) {
      const { data: openReg } = await supabase
        .from('pos_cash_registers')
        .select('id')
        .eq('business_id', business_id)
        .eq('date', sale_date)
        .limit(1);
      if (openReg && openReg.length > 0) cashRegisterId = openReg[0].id;
    }

    // 5. Insertar cobro (con fallback si las columnas points_earned/points_redeemed aún no existen)
    const saleId = genId('sale');
    const saleRecord = {
      id: saleId,
      business_id,
      cash_register_id: cashRegisterId,
      appointment_id: body.appointment_id || null,
      worker_id: body.worker_id || null,
      worker_name: String(body.worker_name || '').trim(),
      client_id: resolvedClientId,
      client_name: clientName,
      client_phone: clientPhone,
      items_services: normalizedServices,
      items_products: normalizedProducts,
      services_total: servicesTotal,
      products_total: productsTotal,
      discount_manual: Math.round(discountManual * 100) / 100,
      discount_loyalty: Math.round(discountLoyalty * 100) / 100,
      points_earned: pointsEarned,
      points_redeemed: pointsRedeemed,
      tip,
      total,
      payment_method: String(payment_method).trim(),
      status: 'completed',
      sale_date
    };

    let { data: insertedSale, error: insErr } = await supabase
      .from('pos_sales')
      .insert(saleRecord)
      .select()
      .single();

    if (insErr && /points_earned|points_redeemed/i.test(insErr.message || '')) {
      delete saleRecord.points_earned;
      delete saleRecord.points_redeemed;
      const retry = await supabase.from('pos_sales').insert(saleRecord).select().single();
      insertedSale = retry.data;
      insErr = retry.error;
    }

    if (insErr) {
      return res.status(500).json({ success: false, error: insErr.message });
    }

    // 6. Descontar stock en Supabase
    for (const upd of stockUpdates) {
      await supabase
        .from('products')
        .update({ stock: upd.newStock })
        .eq('id', upd.id)
        .eq('business_id', business_id);
    }

    // 7. Si venía de una cita en Agenda, marcarla completada (y asignar trabajador si era Servicio General)
    if (body.appointment_id) {
      const apptUpdate = { status: 'completed' };
      if (body.worker_id) apptUpdate.worker_id = body.worker_id;
      await supabase
        .from('appointments')
        .update(apptUpdate)
        .eq('id', String(body.appointment_id))
        .eq('business_id', business_id);
    }

    return res.status(200).json({
      success: true,
      sale: Object.assign({}, insertedSale, { points_earned: pointsEarned, points_redeemed: pointsRedeemed }),
      stockUpdates,
      clientLoyalty: resolvedClientId ? {
        client_id: resolvedClientId,
        active: loyaltyCfg.active,
        mode: loyaltyCfg.mode,
        unit: loyaltyCfg.unit,
        goal: loyaltyCfg.goal,
        points: newClientPoints,
        points_earned: pointsEarned,
        points_redeemed: pointsRedeemed,
        reward_label: loyaltyCfg.reward_label
      } : null
    });
  } catch (err) {
    console.error('[POS] Error en /pos/sale:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/sale-void — Anular cobro y revertir stock
// ═══════════════════════════════════════════════════
router.post('/pos/sale-void', async (req, res) => {
  try {
    const { business_id, sale_id } = req.body || {};
    if (!business_id || !sale_id) {
      return res.status(400).json({ success: false, error: 'Faltan business_id o sale_id' });
    }

    const { data: sale, error: findErr } = await supabase
      .from('pos_sales')
      .select('*')
      .eq('id', sale_id)
      .eq('business_id', business_id)
      .single();

    if (findErr || !sale) {
      return res.status(404).json({ success: false, error: 'Cobro no encontrado' });
    }

    if (sale.status === 'voided') {
      return res.status(200).json({ success: true, alreadyVoided: true });
    }

    const { error: voidErr } = await supabase
      .from('pos_sales')
      .update({ status: 'voided', voided_at: new Date().toISOString() })
      .eq('id', sale_id)
      .eq('business_id', business_id);

    if (voidErr) return res.status(500).json({ success: false, error: voidErr.message });

    // Devolver stock de productos vendidos
    const soldProds = Array.isArray(sale.items_products) ? sale.items_products : [];
    for (const item of soldProds) {
      if (!item.id) continue;
      const qty = parseInt(item.qty, 10) || 0;
      if (qty <= 0) continue;
      const { data: prod } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.id)
        .eq('business_id', business_id)
        .single();
      if (prod) {
        await supabase
          .from('products')
          .update({ stock: (parseInt(prod.stock, 10) || 0) + qty })
          .eq('id', item.id)
          .eq('business_id', business_id);
      }
    }

    // Si estaba vinculada a una cita, devolverla a confirmed
    if (sale.appointment_id) {
      await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', sale.appointment_id)
        .eq('business_id', business_id);
    }

    // Revertir puntos/sellos de fidelización si aplica
    const earned = parseInt(sale.points_earned, 10) || 0;
    const redeemed = parseInt(sale.points_redeemed, 10) || 0;
    if (sale.client_id && (earned > 0 || redeemed > 0)) {
      const { data: clRow } = await supabase
        .from('clients')
        .select('points')
        .eq('id', sale.client_id)
        .eq('business_id', business_id)
        .single();
      if (clRow) {
        const curPts = parseInt(clRow.points, 10) || 0;
        const reverted = Math.max(0, curPts - earned + redeemed);
        await supabase
          .from('clients')
          .update({ points: reverted })
          .eq('id', sale.client_id)
          .eq('business_id', business_id);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/product — Crear / Editar producto (Tienda + Stock + Código barras)
// ═══════════════════════════════════════════════════
router.post('/pos/product', async (req, res) => {
  try {
    const { business_id, product } = req.body || {};
    if (!business_id || !product || !product.name) {
      return res.status(400).json({ success: false, error: 'Nombre de producto y business_id requeridos' });
    }

    const barcode = String(product.barcode || '').trim();
    const prodId = product.id ? String(product.id) : genId('prod');

    // Validar código de barras único en el mismo negocio
    if (barcode) {
      const { data: dup } = await supabase
        .from('products')
        .select('id, name')
        .eq('business_id', business_id)
        .eq('barcode', barcode)
        .neq('id', prodId)
        .limit(1);

      if (dup && dup.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Ese código de barras ya pertenece a "${dup[0].name}"`
        });
      }
    }

    const payload = {
      id: prodId,
      business_id,
      name: String(product.name).trim(),
      description: String(product.description || '').trim(),
      price: Math.max(0, parseFloat(product.price) || 0),
      cost_price: Math.max(0, parseFloat(product.cost_price) || 0),
      internal_price: Math.max(0, parseFloat(product.internal_price) || 0),
      stock: Math.max(0, parseInt(product.stock, 10) || 0),
      min_stock: Math.max(0, product.min_stock != null && product.min_stock !== '' ? parseInt(product.min_stock, 10) : 5),
      barcode: barcode || null,
      supplier: String(product.supplier || '').trim(),
      tax_rate: product.tax_rate !== undefined && product.tax_rate !== null && product.tax_rate !== '' ? parseFloat(product.tax_rate) : null,
      category: String(product.category || 'General').trim() || 'General',
      discount_percent: Math.min(90, Math.max(0, parseFloat(product.discount_percent) || 0)),
      image: String(product.image || '').trim(),
      active: product.active !== false
    };

    const { data, error } = await supabase
      .from('products')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'El código de barras ya está registrado en otro producto' });
      }
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, product: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/product-delete — Eliminar producto
// ═══════════════════════════════════════════════════
router.post('/pos/product-delete', async (req, res) => {
  try {
    const { business_id, product_id } = req.body || {};
    if (!business_id || !product_id) {
      return res.status(400).json({ success: false, error: 'Faltan business_id o product_id' });
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', String(product_id))
      .eq('business_id', business_id);

    if (error) return res.status(400).json({ success: false, error: error.message });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/category-discount — Descuento masivo por categoría
// ═══════════════════════════════════════════════════
router.post('/pos/category-discount', async (req, res) => {
  try {
    const { business_id, category, discount_percent } = req.body || {};
    if (!business_id || !category) {
      return res.status(400).json({ success: false, error: 'Faltan datos' });
    }
    const pct = Math.min(90, Math.max(0, parseFloat(discount_percent) || 0));
    const { error } = await supabase
      .from('products')
      .update({ discount_percent: pct })
      .eq('business_id', business_id)
      .eq('category', String(category).trim());

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/general-service — Crear / Editar Servicio General (worker_id = '')
// ═══════════════════════════════════════════════════
router.post('/pos/general-service', async (req, res) => {
  try {
    const { business_id, service } = req.body || {};
    if (!business_id || !service || !service.name) {
      return res.status(400).json({ success: false, error: 'Nombre del servicio y business_id requeridos' });
    }

    const svcId = service.id ? String(service.id) : genId('gsvc');
    const payload = {
      id: svcId,
      business_id,
      worker_id: '',
      name: String(service.name).trim(),
      price: Math.max(0, parseFloat(service.price) || 0),
      duration: Math.max(5, parseInt(service.dur || service.duration, 10) || 30),
      description: String(service.desc || service.description || '').trim(),
      color: String(service.color || '#4A7FD4').trim(),
      image: String(service.photo || service.image || '').trim(),
      active: service.active !== false,
      points: Math.max(0, service.points != null ? parseInt(service.points, 10) : 10)
    };

    const { data, error } = await supabase
      .from('services')
      .upsert(payload)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });

    return res.status(200).json({
      success: true,
      service: {
        id: data.id,
        name: data.name,
        price: parseFloat(data.price) || 0,
        dur: parseInt(data.duration, 10) || 30,
        desc: data.description || '',
        color: data.color || '#4A7FD4',
        photo: data.image || '',
        active: data.active !== false,
        points: data.points != null ? parseInt(data.points, 10) : 10
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/general-service-delete — Eliminar Servicio General
// ═══════════════════════════════════════════════════
router.post('/pos/general-service-delete', async (req, res) => {
  try {
    const { business_id, service_id } = req.body || {};
    if (!business_id || !service_id) {
      return res.status(400).json({ success: false, error: 'Faltan business_id o service_id' });
    }

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', String(service_id))
      .eq('business_id', business_id)
      .eq('worker_id', '');

    if (error) return res.status(400).json({ success: false, error: error.message });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/pos/finance-summary — Resumen contable, gastos, liquidación y gráficas
// ═══════════════════════════════════════════════════
router.get('/pos/finance-summary', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const bizId = String(req.query.business_id || '').trim();
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;

    if (!bizId) {
      return res.status(400).json({ error: 'business_id requerido' });
    }

    let salesQuery = supabase
      .from('pos_sales')
      .select('*')
      .eq('business_id', bizId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (from) salesQuery = salesQuery.gte('sale_date', from);
    if (to) salesQuery = salesQuery.lte('sale_date', to);

    let apptQuery = supabase
      .from('appointments')
      .select('id, worker_id, service_name, date, status')
      .eq('business_id', bizId)
      .neq('status', 'cancelled')
      .limit(2000);
    if (from) apptQuery = apptQuery.gte('date', from);
    if (to) apptQuery = apptQuery.lte('date', to);

    const [bizRes, salesRes, expRes, prodsRes, workersRes, apptsRes] = await Promise.all([
      supabase.from('businesses').select('id, name, country, pos_config').eq('id', bizId).single(),
      salesQuery,
      supabase.from('pos_expenses').select('*').eq('business_id', bizId).order('expense_date', { ascending: false }).limit(1000),
      supabase.from('products').select('id, name, price, cost_price, stock, min_stock, tax_rate, active').eq('business_id', bizId),
      supabase.from('workers').select('id, name, phone, avatar, role, commission_services, commission_products, active').eq('business_id', bizId),
      apptQuery
    ]);

    if (bizRes.error || !bizRes.data) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    return res.status(200).json({
      country: bizRes.data.country || 'ES',
      posConfig: mergePosConfig(bizRes.data.pos_config),
      sales: salesRes.data || [],
      expenses: expRes.data || [],
      products: prodsRes.data || [],
      appointments: apptsRes.data || [],
      workers: (workersRes.data || []).map(w => ({
        id: w.id,
        name: w.name || '',
        phone: w.phone || '',
        photo: w.avatar || '',
        role: w.role || '',
        commission_services: parseFloat(w.commission_services) || 0,
        commission_products: parseFloat(w.commission_products) || 0,
        active: w.active !== false
      }))
    });
  } catch (err) {
    console.error('[POS] Error en /pos/finance-summary:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/expense — Registrar gasto del negocio
// ═══════════════════════════════════════════════════
router.post('/pos/expense', async (req, res) => {
  try {
    const { business_id, expense } = req.body || {};
    if (!business_id || !expense || !expense.expense_date || !expense.category) {
      return res.status(400).json({ success: false, error: 'Fecha, categoría e importe son obligatorios' });
    }

    const amount = Math.round((parseFloat(expense.amount) || 0) * 100) / 100;
    if (amount <= 0) {
      return res.status(400).json({ success: false, error: 'El importe debe ser mayor que 0' });
    }

    const payload = {
      id: expense.id ? String(expense.id) : genId('exp'),
      business_id,
      expense_date: String(expense.expense_date).trim(),
      concept: String(expense.concept || '').trim(),
      category: String(expense.category).trim(),
      amount,
      is_recurring: Boolean(expense.is_recurring)
    };

    const { data, error } = await supabase
      .from('pos_expenses')
      .upsert(payload)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, expense: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/expense-delete — Eliminar gasto
// ═══════════════════════════════════════════════════
router.post('/pos/expense-delete', async (req, res) => {
  try {
    const { business_id, expense_id } = req.body || {};
    if (!business_id || !expense_id) {
      return res.status(400).json({ success: false, error: 'Faltan business_id o expense_id' });
    }

    const { error } = await supabase
      .from('pos_expenses')
      .delete()
      .eq('id', String(expense_id))
      .eq('business_id', business_id);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// GET /api/pos/clients — CRM de clientes del negocio con estadísticas
// ═══════════════════════════════════════════════════
router.get('/pos/clients', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const bizId = String(req.query.business_id || '').trim();
    if (!bizId) return res.status(400).json({ error: 'business_id requerido' });

    const [bizRes, clRes, salesRes, apptsRes] = await Promise.all([
      supabase.from('businesses').select('id, name, pos_config, loyalty').eq('id', bizId).single(),
      supabase.from('clients').select('*').eq('business_id', bizId).order('name', { ascending: true }).limit(1000),
      supabase.from('pos_sales').select('id, client_id, client_name, client_phone, total, sale_date, created_at, worker_name, items_services, items_products').eq('business_id', bizId).eq('status', 'completed').order('created_at', { ascending: false }).limit(2000),
      supabase.from('appointments').select('id, client_name, client_phone, client_email, service_name, service_price, date, status').eq('business_id', bizId).neq('status', 'cancelled').order('date', { ascending: false }).limit(2000)
    ]);

    if (bizRes.error || !bizRes.data) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const sales = salesRes.data || [];
    const appts = apptsRes.data || [];
    const rawClients = (clRes.data || []).slice();

    // Índice rápido por id y teléfono normalizado
    const byId = {};
    const byPhone = {};
    const enriched = rawClients.map(c => {
      const item = {
        id: c.id,
        name: c.name || '',
        phone: c.phone || '',
        email: c.email || '',
        birthday: c.birthday || '',
        points: parseInt(c.points, 10) || 0,
        last_visit_at: c.last_visit_at || null,
        last_reminder_at: c.last_reminder_at || null,
        created_at: c.created_at || null,
        visits: 0,
        total_spent: 0,
        last_worker: '',
        history: []
      };
      byId[item.id] = item;
      const cleanPh = String(item.phone).replace(/\D/g, '');
      if (cleanPh) byPhone[cleanPh] = item;
      return item;
    });

    // Incorporar clientes de citas históricas que aún no estén en public.clients
    appts.forEach((a, idx) => {
      const name = String(a.client_name || '').trim();
      const ph = String(a.client_phone || '').replace(/\D/g, '');
      if (!name) return;
      let target = ph ? byPhone[ph] : null;
      if (!target) {
        target = enriched.find(c => c.name.toLowerCase() === name.toLowerCase() && (!ph || !c.phone));
      }
      if (!target) {
        target = {
          id: 'appt_cl_' + idx,
          name,
          phone: a.client_phone || '',
          email: a.client_email || '',
          birthday: '',
          points: 0,
          last_visit_at: a.date ? (a.date + 'T12:00:00Z') : null,
          last_reminder_at: null,
          created_at: null,
          visits: 0,
          total_spent: 0,
          last_worker: '',
          history: [],
          from_appointments: true
        };
        enriched.push(target);
        if (ph) byPhone[ph] = target;
      }
      if (a.status === 'completed') {
        target.visits += 1;
        if (a.date && (!target.last_visit_at || a.date > String(target.last_visit_at).slice(0, 10))) {
          target.last_visit_at = a.date + 'T12:00:00Z';
        }
      }
    });

    // Sumar cobros reales de Caja
    sales.forEach(s => {
      const ph = String(s.client_phone || '').replace(/\D/g, '');
      const target = (s.client_id && byId[s.client_id]) || (ph && byPhone[ph]) || null;
      if (!target) return;
      target.visits += 1;
      target.total_spent = Math.round((target.total_spent + (parseFloat(s.total) || 0)) * 100) / 100;
      const dt = s.created_at || (s.sale_date ? s.sale_date + 'T12:00:00Z' : null);
      if (dt && (!target.last_visit_at || dt > target.last_visit_at)) {
        target.last_visit_at = dt;
        if (s.worker_name) target.last_worker = s.worker_name;
      }
      if (target.history.length < 30) {
        const svcNames = (s.items_services || []).map(x => x.name).join(', ');
        const prodNames = (s.items_products || []).map(x => x.name + ' x' + x.qty).join(', ');
        target.history.push({
          date: s.sale_date || (s.created_at ? s.created_at.slice(0, 10) : ''),
          desc: [svcNames, prodNames].filter(Boolean).join(' · ') || 'Compra',
          worker: s.worker_name || '',
          total: parseFloat(s.total) || 0
        });
      }
    });

    return res.status(200).json({
      clients: enriched,
      posConfig: mergePosConfig(bizRes.data.pos_config),
      loyalty: normalizeLoyaltyConfig(bizRes.data.loyalty)
    });
  } catch (err) {
    console.error('[POS] Error en /pos/clients:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/client — Crear o actualizar cliente CRM
// ═══════════════════════════════════════════════════
router.post('/pos/client', async (req, res) => {
  try {
    const { business_id, client } = req.body || {};
    if (!business_id || !client || !client.name) {
      return res.status(400).json({ success: false, error: 'Nombre del cliente y business_id requeridos' });
    }

    const rawId = client.id && !String(client.id).startsWith('appt_cl_') ? String(client.id) : genId('cl');
    const payload = {
      id: rawId,
      business_id,
      name: String(client.name).trim(),
      phone: String(client.phone || '').trim(),
      email: String(client.email || '').trim().toLowerCase(),
      birthday: client.birthday ? String(client.birthday).trim() : null,
      points: Math.max(0, parseInt(client.points, 10) || 0)
    };
    if (client.last_reminder_at !== undefined) {
      payload.last_reminder_at = client.last_reminder_at;
    }
    if (client.last_visit_at !== undefined && client.last_visit_at) {
      payload.last_visit_at = client.last_visit_at;
    }

    const { data, error } = await supabase
      .from('clients')
      .upsert(payload)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, client: data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/client-delete — Eliminar cliente CRM
// ═══════════════════════════════════════════════════
router.post('/pos/client-delete', async (req, res) => {
  try {
    const { business_id, client_id } = req.body || {};
    if (!business_id || !client_id) {
      return res.status(400).json({ success: false, error: 'Faltan business_id o client_id' });
    }
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', String(client_id))
      .eq('business_id', business_id);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// POST /api/pos/loyalty — Guardar Programa de Fidelización unificado
// ═══════════════════════════════════════════════════
router.post('/pos/loyalty', async (req, res) => {
  try {
    const { business_id, loyalty } = req.body || {};
    if (!business_id || !loyalty || typeof loyalty !== 'object') {
      return res.status(400).json({ success: false, error: 'Faltan business_id o loyalty' });
    }
    const clean = normalizeLoyaltyConfig(loyalty);
    const toStore = {
      active: clean.active,
      mode: clean.mode,
      stamps: clean.stamps,
      points_goal: clean.points_goal,
      reward_type: clean.reward_type,
      reward_pct: clean.reward_pct,
      reward_product_id: clean.reward_product_id,
      reward_product_name: clean.reward_product_name
    };

    const { error } = await supabase
      .from('businesses')
      .update({ loyalty: toStore })
      .eq('id', business_id);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, loyalty: clean });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

