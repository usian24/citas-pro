const express = require('express');
const supabase = require('../db');
const router = express.Router();

router.post('/save-worker', async (req, res) => {
  try {
    const { action, worker } = req.body;

    if (action === 'save-push') {
      const { worker_id, business_id, subscription } = req.body;
      if (!worker_id || !subscription) {
        return res.status(400).json({ success: false, error: 'Faltan datos' });
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

    if (action === 'delete') {
      const { error } = await supabase.from('workers').delete().eq('id', worker.id);
      if (error) return res.status(400).json({ success: false, error: error.message });
      return res.status(200).json({ success: true });
    }

    // 🛡️ ESCUDO: Buscar si el trabajador ya existe para rescatar su contraseña original
    let existingPass = '';
    const { data: existingWorker } = await supabase
      .from('workers')
      .select('password')
      .eq('id', worker.id)
      .single();
    if (existingWorker) existingPass = existingWorker.password;

    const payload = {
      id: worker.id, business_id: worker.business_id || '',
      name: worker.name || '', email: worker.email || '',
      password: worker.password ? worker.password : existingPass,
      phone: worker.phone || '',
      avatar: worker.avatar || '', cover: worker.cover || '',
      role: worker.role || 'barber',
      horario: Array.isArray(worker.horario) ? worker.horario : []
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
