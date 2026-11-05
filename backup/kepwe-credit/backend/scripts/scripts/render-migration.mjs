import dotenv from 'dotenv';
import pg from 'pg';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const { Client } = pg;

console.log('[render-migration] Render-specific migration script starting...');

async function runMigration() {
  const databaseUrl = process.env.SUPABASE_DB_URL;
  
  if (!databaseUrl) {
    console.error('[render-migration] SUPABASE_DB_URL not found');
    process.exit(1);
  }
  
  console.log('[render-migration] Parsing database URL...');
  const url = new URL(databaseUrl);
  
  // Try multiple connection strategies
  const strategies = [
    {
      name: 'Connection String',
      config: {
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Explicit Parameters',
      config: {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1) || 'postgres',
        user: url.username,
        password: url.password,
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Connection String with IPv4 preference',
      config: {
        connectionString: databaseUrl + '?family=4',
        ssl: { rejectUnauthorized: false }
      }
    }
  ];
  
  for (const strategy of strategies) {
    console.log(`\n[render-migration] Trying: ${strategy.name}`);
    
    const client = new Client({
      ...strategy.config,
      connectionTimeoutMillis: 10000
    });
    
    try {
      await client.connect();
      console.log(`[render-migration] ✅ Connected successfully with ${strategy.name}`);
      
      // Run a simple test query
      const result = await client.query('SELECT NOW() as time');
      console.log(`[render-migration] ✅ Test query successful: ${result.rows[0].time}`);
      
      // Check if already migrated
      const tableCheck = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      const tableCount = parseInt(tableCheck.rows[0].count);
      console.log(`[render-migration] Found ${tableCount} tables in database`);
      
      if (tableCount > 10) {
        console.log('[render-migration] ✅ Database appears to be already migrated');
      } else {
        console.log('[render-migration] ⚠️ Database needs migration (manual migration required)');
      }
      
      await client.end();
      
      console.log('\n[render-migration] ✅ DATABASE CONNECTION SUCCESSFUL');
      console.log(`[render-migration] Working strategy: ${strategy.name}`);
      
      // Connection works, now we need to update the migration script to use this strategy
      if (strategy.name === 'Explicit Parameters') {
        console.log('[render-migration] 📝 Recommendation: Use explicit parameters for pg connections');
      }
      
      process.exit(0);
      
    } catch (error) {
      console.log(`[render-migration] ❌ ${strategy.name} failed: ${error.message}`);
      await client.end().catch(() => {});
    }
  }
  
  console.error('\n[render-migration] ❌ ALL CONNECTION STRATEGIES FAILED');
  process.exit(1);
}

runMigration();