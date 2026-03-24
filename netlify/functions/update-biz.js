const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // Siempre respondemos 200 para que Netlify NO lance Error 500
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Método no permitido' }) };
  }

  try {
    if (!event.body) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'No se enviaron datos' }) };
    }

    // 🔥 LA SOLUCIÓN AL ERROR 500: Decodificar si Netlify lo mandó en Base64
    const bodyText = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64').toString('utf8') 
      : event.body;
      
    const data = JSON.parse(bodyText);

    if (!data || !data.id) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Falta el ID de la barbería' }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // 🌟 FILTRO EXACTO: Mandamos solo las 19 columnas que existen en tu tabla de Supabase
    // Mapeamos "pass" a "password" y "desc" a "desc_text" para que encaje perfecto
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

    // Subimos los datos limpios a Supabase
    const { error } = await supabase.from('businesses').upsert(payload);

    if (error) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Rechazo de Supabase: ' + error.message }) };
    }

    // Registro perfecto al 100%
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    // Si algo falla, atrapamos el error y lo devolvemos como texto normal (Cero colapsos 500)
    return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Fallo del servidor: ' + err.message }) };
  }
};