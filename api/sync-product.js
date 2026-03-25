const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const data = req.body;
    if (!data || !data.business_id) {
      return res.status(400).json({ success: false, error: 'Falta business_id' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const payload = {
      id:            data.id || ('prod_' + Date.now()),
      business_id:   data.business_id,
      name:          data.name || '',
      description:   data.description || '',
      price:         parseFloat(data.price) || 0,
      stock:         parseInt(data.stock) || 0,
      image:         data.image || '',
      category:      data.category || '',
      rating:        parseFloat(data.rating) || 0,
      reviews_count: parseInt(data.reviews_count) || 0
    };

    const { error } = await supabase.from('products').upsert(payload);
    if (error) {
      console.error('Error upsert product:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error sync-product:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};