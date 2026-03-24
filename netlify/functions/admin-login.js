const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { username, password } = JSON.parse(event.body);

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // 1. Buscamos SOLO el usuario
    const { data, error } = await supabase
      .from('super_admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Usuario no encontrado' }) };
    }

    // 2. Aquí está la magia: bcrypt compara tu contraseña escrita con el Hash de Supabase
    const isPasswordValid = bcrypt.compareSync(password, data.password);

    if (!isPasswordValid) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Contraseña incorrecta' }) };
    }

    // 3. ¡Aprobado!
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, admin: data.username }) };
    
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error del servidor: ' + err.message }) };
  }
};