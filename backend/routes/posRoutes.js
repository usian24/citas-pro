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
  return {
    low_stock_alert: Number.isFinite(Number(cfg.low_stock_alert)) ? Math.max(0, parseInt(cfg.low_stock_alert, 10)) : DEFAULT_POS_CONFIG.low_stock_alert,
    close_reminder_time: typeof cfg.close_reminder_time === 'string' && /^\d{2}:\d{2}$/.test(cfg.close_reminder_time)
      ? cfg.close_reminder_time
      : DEFAULT_POS_CONFIG.close_reminder_time,
    payment_methods: Array.isArray(cfg.payment_methods) && cfg.payment_methods.length > 0
      ? cfg.payment_methods
      : DEFAULT_POS_CONFIG.payment_methods
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
      supabase.from('businesses').select('id, name, country, owner_pin, pos_config').eq('id', bizId).single(),
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
    const itemsProducts = Array.isArray(body.items_products) ? body.items_products : [];

    if (itemsServices.length === 0 && itemsProducts.length === 0) {
      return res.status(400).json({ success: false, error: 'Debes añadir al menos un servicio o producto' });
    }

    // 1. Verificar stock real de los productos solicitados
    const stockUpdates = [];
    const normalizedProducts = [];
    let productsTotal = 0;

    if (itemsProducts.length > 0) {
      const prodIds = itemsProducts.map(p => String(p.id)).filter(Boolean);
      const { data: dbProds, error: pErr } = await supabase
        .from('products')
        .select('id, name, price, cost_price, stock, discount_percent')
        .eq('business_id', business_id)
        .in('id', prodIds);

      if (pErr) return res.status(500).json({ success: false, error: pErr.message });

      const prodMap = {};
      (dbProds || []).forEach(p => { prodMap[p.id] = p; });

      for (const item of itemsProducts) {
        const qty = Math.max(1, parseInt(item.qty, 10) || 1);
        const dbP = prodMap[item.id];
        if (!dbP) {
          return res.status(400).json({ success: false, error: `Producto no encontrado: ${item.name || item.id}` });
        }
        const currentStock = parseInt(dbP.stock, 10) || 0;
        if (currentStock < qty) {
          return res.status(400).json({ success: false, error: `Stock insuficiente para "${dbP.name}" (disponible: ${currentStock})` });
        }
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
        stockUpdates.push({ id: dbP.id, newStock: Math.max(0, currentStock - qty) });
      }
    }

    // 2. Calcular servicios y totales
    let servicesTotal = 0;
    const normalizedServices = itemsServices.map(s => {
      const qty = Math.max(1, parseInt(s.qty, 10) || 1);
      const price = Math.max(0, parseFloat(s.price) || 0);
      servicesTotal += price * qty;
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
    const discountLoyalty = Math.min(gross, Math.max(0, parseFloat(body.discount_loyalty) || 0));
    const discountManual = Math.min(Math.max(0, gross - discountLoyalty), Math.max(0, parseFloat(body.discount_manual) || 0));
    const tip = Math.max(0, Math.round((parseFloat(body.tip) || 0) * 100) / 100);
    const total = Math.max(0, Math.round((gross - discountLoyalty - discountManual) * 100) / 100);

    // 3. Resolver o crear cliente si viene teléfono/nombre
    let resolvedClientId = (body.client_id && !String(body.client_id).startsWith('appt_cl_')) ? body.client_id : null;
    const clientName = String(body.client_name || '').trim();
    const clientPhone = String(body.client_phone || '').trim();

    if (!resolvedClientId && clientName && clientPhone) {
      const { data: existingCl } = await supabase
        .from('clients')
        .select('id')
        .eq('business_id', business_id)
        .eq('phone', clientPhone)
        .limit(1);

      if (existingCl && existingCl.length > 0) {
        resolvedClientId = existingCl[0].id;
      } else {
        resolvedClientId = genId('cl');
        await supabase.from('clients').insert({
          id: resolvedClientId,
          business_id,
          name: clientName,
          phone: clientPhone,
          email: String(body.client_email || '').trim(),
          last_visit_at: new Date().toISOString()
        });
      }
    } else if (resolvedClientId) {
      await supabase
        .from('clients')
        .update({ last_visit_at: new Date().toISOString() })
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

    // 5. Insertar cobro
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
      tip,
      total,
      payment_method: String(payment_method).trim(),
      status: 'completed',
      sale_date
    };

    const { data: insertedSale, error: insErr } = await supabase
      .from('pos_sales')
      .insert(saleRecord)
      .select()
      .single();

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
      sale: insertedSale,
      stockUpdates
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

module.exports = router;

