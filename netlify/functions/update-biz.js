const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const bizData = JSON.parse(event.body);
    
    if (!bizData || !bizData.id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos' }) };
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Faltan las variables de entorno' }) };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // LA MAGIA DEL FILTRO: Extraemos SOLO lo que pertenece a la tabla businesses
    // Dejamos fuera los arrays de workers, services y appointments para no causar errores
    const cleanBizData = {
      id: bizData.id,
      name: bizData.name || '',
      owner: bizData.owner || '',
      email: bizData.email || '',
      password: bizData.pass || bizData.password || '', // Mapeamos "pass" a "password"
      phone: bizData.phone || '',
      addr: bizData.addr || '',
      city: bizData.city || '',
      country: bizData.country || '',
      type: bizData.type || '',
      plan: bizData.plan || 'trial',
      desc_text: bizData.desc || '', // Mapeamos "desc" a "desc_text"
      logo: bizData.logo || '',
      cover: bizData.cover || '',
      insta: bizData.insta || '',
      joinDate: bizData.joinDate || new Date().toISOString(),
      horario: bizData.horario || null,
      photos: bizData.photos || []
    };

    // UPSERT: Si no existe lo crea, si existe lo actualiza de forma súper limpia
    const { data, error } = await supabase
      .from('businesses')
      .upsert(cleanBizData);

    if (error) {
      console.error("Error de Supabase:", error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, details: error.details }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    
  } catch (err) {
    console.error("Error en la función:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};