const supabase = require('./backend/db');
supabase.from('appointments').select('*').limit(5).then(res => {
  console.log(JSON.stringify(res.data, null, 2));
  process.exit(0);
});
