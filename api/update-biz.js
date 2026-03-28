const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método no permitido' });

  try {
    const data = req.body;
    if (!data || !data.id) return res.status(400).json({ success: false, error: 'Falta el ID de la barbería' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // 1. Armamos un paquete SOLO con los datos que nos enviaron
    const payload = {};
    if (data.plan !== undefined) payload.plan = data.plan;
    if (data.expires_at !== undefined) payload.expires_at = data.expires_at;
    if (data.name !== undefined) payload.name = data.name;
    if (data.owner !== undefined) payload.owner = data.owner;
    if (data.email !== undefined) payload.email = data.email;
    if (data.pass || data.password) payload.password = data.pass || data.password;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.addr !== undefined) payload.addr = data.addr;
    if (data.city !== undefined) payload.city = data.city;
    if (data.country !== undefined) payload.country = data.country;
    if (data.type !== undefined) payload.type = data.type;
    if (data.join_date || data.joinDate) payload.join_date = data.join_date || data.joinDate;
    if (data.desc || data.desc_text) payload.desc_text = data.desc || data.desc_text;
    if (data.logo !== undefined) payload.logo = data.logo;
    if (data.cover !== undefined) payload.cover = data.cover;
    if (data.insta !== undefined) payload.insta = data.insta;
    if (data.facebook !== undefined) payload.facebook = data.facebook;
    if (data.x_url !== undefined) payload.x_url = data.x_url;

    // 2. Usamos UPDATE (Mucho más seguro que Upsert para editar datos)
    const { data: updatedData, error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', data.id)
      .select();

    if (error) {
      console.error('Error de Supabase:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }

    // 3. Si el negocio no existía (update devuelve vacío), entonces lo creamos (Insert)
    if (!updatedData || updatedData.length === 0) {
        const { error: insError } = await supabase.from('businesses').insert({ id: data.id, ...payload });
        if (insError) return res.status(400).json({ success: false, error: insError.message });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ success: false, error: 'Fallo interno: ' + err.message });
  }
};