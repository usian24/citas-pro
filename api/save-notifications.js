'use strict';
// api/save-notification.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ══════════════════════════
  // GET — Cargar notificaciones de un worker
  // ══════════════════════════
  if (req.method === 'GET') {
    var workerId = req.query.worker_id;
    if (!workerId) return res.status(400).json({ error: 'worker_id requerido' });

    try {
      var { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data || []);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ══════════════════════════
  // POST — Guardar notificación
  // ══════════════════════════
  if (req.method === 'POST') {
    var body = req.body;

    // Eliminar notificaciones de más de 30 días automáticamente
    var thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await supabase
      .from('notifications')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
      .catch(function() {});

    try {
      var { error } = await supabase
        .from('notifications')
        .insert({
          worker_id:   body.worker_id,
          business_id: body.business_id,
          type:        body.type || 'new_booking',
          msg:         body.msg || '',
          detail:      body.detail || '',
          read:        false
        });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};