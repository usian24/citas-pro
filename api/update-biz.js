const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // En Vercel usamos req y res. Ya no hay que descifrar códigos raros ni usar JSON.parse.
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const data = req.body; // Vercel ya te entrega el objeto listo para usar. ¡Magia!

    if (!data || !data.id) {
      return res.status(400).json({ success: false, error: 'Falta el ID de la barbería' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const payload = {
      id: data.id,
      name: data.name || 'Sin nombre',
      owner: data.owner || '',
      email: data.email || '',
      password: data.pass || data.password || '', 
      phone: data.phone || '',
      addr: data.addr || '',
      city: data.city || '',
      country: data.country || '',
      type: data.type || '',
      plan: data.plan || 'trial',
      desc_text: data.desc || data.desc_text || '',
      logo: data.logo || '',
      cover: data.cover || '',
      insta: data.insta || '',
      joinDate: data.joinDate || new Date().toISOString().split('T')[0],
      horario: Array.isArray(data.horario) ? data.horario : [],
      photos: Array.isArray(data.photos) ? data.photos : []
    };

    const { error } = await supabase.from('businesses').upsert(payload);

    if (error) {
      return res.status(400).json({ success: false, error: 'Rechazo Supabase: ' + error.message });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false, error: 'Fallo interno: ' + err.message });
  }
};