import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;

async function testConnection() {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  
  if (!databaseUrl) {
    console.error('❌ SUPABASE_DB_URL not found in environment');
    process.exit(1);
  }
  
  console.log('🔍 Testing Supabase connection for Render deployment...');
  console.log(`📡 Host: ${new URL(databaseUrl).hostname}`);
  
  // Test with explicit SSL settings
  const url = new URL(databaseUrl);
  url.searchParams.set('sslmode', 'require');
  const connectionString = url.toString();
  
  console.log('🔧 Using SSL mode: require');
  
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15000,
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined
    }
  });
  
  try {
    console.log('⏳ Connecting...');
    await client.connect();
    console.log('✅ Connection successful!');
    
    const result = await client.query('SELECT NOW() as timestamp, version() as version');
    console.log(`⏰ Server time: ${result.rows[0].timestamp}`);
    console.log(`🐘 PostgreSQL: ${result.rows[0].version.split(' ')[1]}`);
    
    // Test a simple query
    const tableCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`📊 Tables in public schema: ${tableCount.rows[0].count}`);
    
    console.log('🎉 Connection test PASSED - ready for Render deployment');
    
  } catch (error) {
    console.error('❌ Connection test FAILED:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    
    if (error.code === 'ENETUNREACH') {
      console.error('\n💡 ENETUNREACH suggests network connectivity issues.');
      console.error('   This often happens when:');
      console.error('   1. The database URL is not set in Render environment variables');
      console.error('   2. IPv6/IPv4 connectivity issues on Render');
      console.error('   3. Firewall or network restrictions');
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

testConnection();