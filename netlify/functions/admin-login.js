const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { username, password } = JSON.parse(event.body);

    if (!username || !password) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan credenciales' }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // 1. Va a tu nueva tabla secreta y busca si existe ese usuario y contraseña
    const { data, error } = await supabase
      .from('super_admins')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single(); // single() asegura que solo traiga un resultado exacto

    // 2. Si hay un error o no encuentra nada, rebota el login
    if (error || !data) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Credenciales incorrectas' }) };
    }

    // 3. Si todo coincide, te da luz verde para entrar
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, admin: data.username }) };
    
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};