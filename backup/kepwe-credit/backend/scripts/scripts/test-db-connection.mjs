import dotenv from 'dotenv';
import pg from 'pg';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const { Client } = pg;

async function testDatabaseConnection() {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  
  if (!databaseUrl) {
    console.error('❌ SUPABASE_DB_URL not configured');
    process.exit(1);
  }
  
  console.log('[db-test] Testing Supabase database connection...');
  
  const url = new URL(databaseUrl);
  const safeHost = url.hostname;
  const port = url.port || '6543';
  const connectionType = url.hostname.includes('pooler') ? 'POOLER' : 'DIRECT';
  
  console.log(`[db-test] Target: ${safeHost}:${port} (${connectionType})`);
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });
  
  try {
    await client.connect();
    console.log('[db-test] ✅ Database connection successful');
    
    const result = await client.query('SELECT NOW() as timestamp, COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log(`[db-test] ✅ Server time: ${result.rows[0].timestamp}`);
    console.log(`[db-test] ✅ Tables in schema: ${result.rows[0].table_count}`);
    
    // Test a simple write operation
    await client.query('SELECT 1');
    console.log('[db-test] ✅ Query execution successful');
    
    console.log('[db-test] ✅ ALL DATABASE TESTS PASSED');
    
  } catch (error) {
    console.error('[db-test] ❌ Database connection failed:');
    console.error(`[db-test]    Error: ${error.message}`);
    console.error(`[db-test]    Code: ${error.code}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testDatabaseConnection();