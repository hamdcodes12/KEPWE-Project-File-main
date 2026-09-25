import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

console.log('🔧 Testing Supabase connection with different SSL configurations...\n');

const baseUrl = process.env.SUPABASE_DB_URL;

if (!baseUrl) {
  console.error('❌ SUPABASE_DB_URL not found');
  process.exit(1);
}

const testConfigurations = [
  {
    name: 'Production Config (disable SSL verification)',
    config: {
      connectionString: baseUrl,
      ssl: { rejectUnauthorized: false }
    }
  },
  {
    name: 'Alternative Config (no SSL params in URL)',
    config: {
      connectionString: baseUrl.split('?')[0], // Remove any existing query params
      ssl: { rejectUnauthorized: false }
    }
  }
];

for (const test of testConfigurations) {
  console.log(`\n📋 Testing: ${test.name}`);
  
  const client = new pg.Client({
    ...test.config,
    connectionTimeoutMillis: 10000
  });
  
  try {
    await client.connect();
    console.log('✅ Connection successful!');
    
    const result = await client.query('SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log(`📊 Found ${result.rows[0].tables} tables in public schema`);
    
    console.log('🎉 This configuration WORKS for production');
    console.log('\n📝 Recommended SUPABASE_DB_URL for Render:');
    console.log(test.config.connectionString);
    
    await client.end();
    break;
    
  } catch (error) {
    console.log(`❌ Failed: ${error.message} (${error.code})`);
    await client.end().catch(() => {});
  }
}