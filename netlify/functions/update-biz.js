const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // Siempre devolvemos JSON para que el navegador lo entienda
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const bizData = JSON.parse(event.body);
    
    if (!bizData || !bizData.id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos' }) };
    }

    // Verificamos que Netlify sí esté leyendo tus claves
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Faltan las variables de entorno en Netlify' }) };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // UPSERT: Si no existe lo crea, si existe lo actualiza
    const { data, error } = await supabase
      .from('businesses')
      .upsert(bizData);

    // Si Supabase rechaza los datos (ej: falta una columna), capturamos el error exacto
    if (error) {
      console.error("Error de Supabase:", error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, details: error.details }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    
  } catch (err) {
    // Si la función colapsa, capturamos el motivo
    console.error("Error en la función:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};