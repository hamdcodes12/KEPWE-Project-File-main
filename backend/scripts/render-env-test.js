// Simple environment variable test for Render
console.log('=== RENDER ENVIRONMENT TEST ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SUPABASE_DB_URL exists:', !!process.env.SUPABASE_DB_URL);
console.log('SUPABASE_DB_URL length:', process.env.SUPABASE_DB_URL?.length || 0);

if (process.env.SUPABASE_DB_URL) {
  try {
    const url = new URL(process.env.SUPABASE_DB_URL);
    console.log('Host:', url.hostname);
    console.log('Port:', url.port);
    console.log('Database:', url.pathname);
    console.log('Valid URL: YES');
  } catch (e) {
    console.log('Valid URL: NO -', e.message);
  }
} else {
  console.log('SUPABASE_DB_URL: NOT SET');
  console.log('All env vars containing SUPABASE or DATABASE:');
  Object.keys(process.env)
    .filter(k => k.includes('SUPABASE') || k.includes('DATABASE'))
    .forEach(k => console.log(`  ${k}: ${process.env[k] ? 'SET' : 'NOT SET'}`));
}