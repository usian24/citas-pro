const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'X' };

  try {
    const data = JSON.parse(event.body);
    
    // Si por algún error el código envía una barbería sin ID, detenemos el proceso sin colapsar
    if (!data || !data.id) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, msg: 'Sin ID' }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // ARMADURA: Rellenamos campos vacíos para no violar las reglas de Supabase
    const payload = {
      id: data.id,
      name: data.name || 'Sin nombre',
      owner: data.owner || '',
      email: data.email || '',
      password: data.password || data.pass || '',
      phone: data.phone || '',
      addr: data.addr || '',
      city: data.city || '',
      country: data.country || '',
      type: data.type || '',
      plan: data.plan || 'trial',
      desc_text: data.desc_text || data.desc || '',
      logo: data.logo || '',
      cover: data.cover || '',
      insta: data.insta || '',
      joinDate: data.joinDate || new Date().toISOString().split('T')[0],
      horario: Array.isArray(data.horario) ? data.horario : [],
      photos: Array.isArray(data.photos) ? data.photos : []
    };

    const { error } = await supabase.from('businesses').upsert(payload);

    // Si Supabase se queja, capturamos el error REAL y lo enviamos a la consola
    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Rechazo de Supabase", detalle: error.message }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Fallo interno", detalle: err.message }) };
  }
};