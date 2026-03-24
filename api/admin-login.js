const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { username, password } = req.body;

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // 1. Buscamos SOLO el usuario
    const { data, error } = await supabase
      .from('super_admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // 2. Aquí está la magia: bcrypt compara tu contraseña escrita con el Hash de Supabase
    const isPasswordValid = bcrypt.compareSync(password, data.password);

    if (!isPasswordValid) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // 3. ¡Aprobado!
    return res.status(200).json({ success: true, admin: data.username });
    
  } catch (err) {
    return res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
};