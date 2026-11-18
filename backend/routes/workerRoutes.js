const express = require('express');
const supabase = require('../db');
const { verifyToken, isBusinessOwnerOrAdmin } = require('../middlewares/auth');
const router = express.Router();

router.post('/save-worker', verifyToken, async (req, res) => {
  try {
    const { action, worker } = req.body || {};

    if (action === 'save-push') {
      const { worker_id, business_id, subscription } = req.body;
      if (!worker_id || !subscription) {
        return res.status(400).json({ success: false, error: 'Faltan datos' });
      }
      const isSelfWorker = req.user.role === 'worker' && String(req.user.workerId) === String(worker_id);
      if (!isSelfWorker && !isBusinessOwnerOrAdmin(req.user, business_id)) {
        return res.status(403).json({ success: false, error: 'Sin permisos para guardar suscripción push' });
      }
      await supabase.from('push_subscriptions').delete().eq('worker_id', worker_id);
      const { error } = await supabase.from('push_subscriptions').insert({
        worker_id, business_id: business_id || '', subscription
      });
      if (error) return res.status(500).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    if (!worker || !worker.id) {
      return res.status(400).json({ success: false, error: 'Falta el ID del trabajador' });
    }

    // Buscar trabajador existente para validar pertenencia y preservar contraseña/comisiones
    let existingPass = '';
    let existingHorario = [];
    let existingCommSvc = 0;
    let existingCommProd = 0;
    let existingBizId = '';
    const { data: existingWorker } = await supabase
      .from('workers')
      .select('business_id, password, horario, commission_services, commission_products')
      .eq('id', worker.id)
      .single();
    if (existingWorker) {
      existingBizId = existingWorker.business_id || '';
      existingPass = existingWorker.password;
      existingHorario = existingWorker.horario || [];
      existingCommSvc = parseFloat(existingWorker.commission_services) || 0;
      existingCommProd = parseFloat(existingWorker.commission_products) || 0;
    }

    const targetBizId = existingBizId || worker.business_id || '';

    if (action === 'delete') {
      if (!isBusinessOwnerOrAdmin(req.user, targetBizId)) {
        return res.status(403).json({ success: false, error: 'Solo el propietario puede eliminar trabajadores' });
      }
      const { error } = await supabase.from('workers').delete().eq('id', worker.id).eq('business_id', targetBizId);
      if (error) return res.status(400).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    const isOwner = isBusinessOwnerOrAdmin(req.user, targetBizId);
    const isSelfWorker = req.user.role === 'worker' && String(req.user.workerId) === String(worker.id) && String(req.user.bizId) === String(targetBizId);

    if (!isOwner && !isSelfWorker) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para editar este trabajador' });
    }

    const payload = {
      id: worker.id,
      business_id: targetBizId,
      name: worker.name || '',
      email: worker.email || '',
      password: worker.password ? require('bcryptjs').hashSync(worker.password, 10) : existingPass,
      phone: worker.phone || '',
      avatar: worker.avatar || '',
      cover: worker.cover || '',
      role: worker.role || 'worker',
      horario: worker.horario !== undefined ? (Array.isArray(worker.horario) ? worker.horario : []) : (existingHorario.length ? existingHorario : []),
      // Solo el propietario/admin puede modificar porcentajes de comisión
      commission_services: (isOwner && worker.commission_services !== undefined) ? Math.min(100, Math.max(0, parseFloat(worker.commission_services) || 0)) : existingCommSvc,
      commission_products: (isOwner && worker.commission_products !== undefined) ? Math.min(100, Math.max(0, parseFloat(worker.commission_products) || 0)) : existingCommProd
    };
    const { error } = await supabase.from('workers').upsert(payload);
    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error save-worker:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
