// update-biz.js
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
      join_date:  data.joinDate || data.join_date || new Date().toISOString().split('T')[0],
      expires_at: data.expires_at || null,
      desc_text: data.desc || data.desc_text || '',
      logo:      data.logo || '',
      cover:     data.cover || '',
      insta:     data.insta || '',
      facebook:  data.facebook || '',
      x_url:     data.x_url || '', 
      horario:   Array.isArray(data.horario) ? data.horario : [],
      photos:    Array.isArray(data.photos)  ? data.photos  : []
    };

    // ══════════════════════════════════════════════════════════════
    // NUEVO: LÓGICA SEGURA (No eliminé tu código, solo lo comenté)
    // ══════════════════════════════════════════════════════════════
    // const { error } = await supabase.from('businesses').upsert(payload);
    
    let error = null;
    
    // 1. Verificamos si el negocio ya existe
    const { data: checkExist } = await supabase.from('businesses').select('id').eq('id', payload.id);
    
    if (checkExist && checkExist.length > 0) {
      // 2. Si existe, lo ACTUALIZAMOS (Más seguro que upsert)
      const resUpdate = await supabase.from('businesses').update(payload).eq('id', payload.id);
      error = resUpdate.error;
    } else {
      // 3. Si no existe, lo CREAMOS
      const resInsert = await supabase.from('businesses').insert(payload);
      error = resInsert.error;
    }

    if (error) {
      // Log detallado para debugging (solo visible en Vercel logs)
      console.error('Supabase upsert/update error:', JSON.stringify(error));
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