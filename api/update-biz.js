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
    // ══════════════════════════════════════════════════════════════

    // Solo preparamos las cosas que SÍ nos enviaron, sin sobreescribir con espacios en blanco.
    const payload = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.owner !== undefined) payload.owner = data.owner;
    if (data.email !== undefined) payload.email = data.email;
    if (data.pass || data.password !== undefined) payload.password = data.pass || data.password;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.addr !== undefined) payload.addr = data.addr;
    if (data.city !== undefined) payload.city = data.city;
    if (data.country !== undefined) payload.country = data.country;
    if (data.type !== undefined) payload.type = data.type;
    if (data.plan !== undefined) payload.plan = data.plan;
    if (data.join_date || data.joinDate !== undefined) payload.join_date = data.join_date || data.joinDate;
    if (data.expires_at !== undefined) payload.expires_at = data.expires_at;
    if (data.desc_text || data.desc !== undefined) payload.desc_text = data.desc_text || data.desc;
    if (data.logo !== undefined) payload.logo = data.logo;
    if (data.cover !== undefined) payload.cover = data.cover;
    if (data.insta !== undefined) payload.insta = data.insta;
    if (data.facebook !== undefined) payload.facebook = data.facebook;
    if (data.x_url !== undefined) payload.x_url = data.x_url;

    let error = null;
    
    // 1. Verificamos si el negocio ya existe
    const { data: checkExist } = await supabase.from('businesses').select('id').eq('id', data.id).single();
    
    if (checkExist) {
      // 2. Si existe, lo ACTUALIZAMOS
      const resUpdate = await supabase.from('businesses').update(payload).eq('id', data.id);
      error = resUpdate.error;
    } else {
      // 3. Si no existe, lo CREAMOS
      const resInsert = await supabase.from('businesses').insert({ id: data.id, ...payload });
      error = resInsert.error;
    }

    if (error) {
      console.error('Supabase update/insert error:', JSON.stringify(error));
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