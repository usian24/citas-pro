const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Falta el ID de la barbería' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Orden explícita de ELIMINAR en Supabase
    const { error } = await supabase
      .from('businesses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error de Supabase al eliminar:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
    
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};