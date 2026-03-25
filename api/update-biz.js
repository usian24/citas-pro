const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const data = req.body;

    if (!data || !data.id) {
      return res.status(400).json({ success: false, error: 'Falta el ID de la barbería' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // ══════════════════════════════════════════════════════════════
    // REGLA DE ORO: Los nombres aquí DEBEN coincidir EXACTAMENTE
    // con los nombres de las columnas en tu tabla de Supabase.
    // PostgreSQL usa snake_case (guiones bajos), NO camelCase.
    //
    // Si en Supabase tu columna se llama "join_date" → aquí pones "join_date"
    // Si en Supabase tu columna se llama "desc_text" → aquí pones "desc_text"
    // ══════════════════════════════════════════════════════════════

    const payload = {
      id:        data.id,
      name:      data.name || 'Sin nombre',
      owner:     data.owner || '',
      email:     data.email || '',
      password:  data.pass || data.password || '',
      phone:     data.phone || '',
      addr:      data.addr || '',
      city:      data.city || '',
      country:   data.country || '',
      type:      data.type || '',
      plan:      data.plan || 'trial',
      desc_text: data.desc || data.desc_text || '',
      logo:      data.logo || '',
      cover:     data.cover || '',
      insta:     data.insta || '',
      // ✅ CORRECCIÓN PRINCIPAL: era "joinDate", ahora es "join_date"
      join_date: data.joinDate || data.join_date || new Date().toISOString().split('T')[0],
      // ✅ Los campos JSON/JSONB se envían como arrays, Supabase los acepta directo
      horario:   Array.isArray(data.horario) ? data.horario : [],
      photos:    Array.isArray(data.photos)  ? data.photos  : []
    };

    const { error } = await supabase.from('businesses').upsert(payload);

    if (error) {
      // Log detallado para debugging (solo visible en Vercel logs)
      console.error('Supabase upsert error:', JSON.stringify(error));
      return res.status(400).json({
        success: false,
        error: 'Rechazo Supabase: ' + error.message,
        detalle: error.message,
        hint: error.hint || ''
      });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ success: false, error: 'Fallo interno: ' + err.message });
  }
};