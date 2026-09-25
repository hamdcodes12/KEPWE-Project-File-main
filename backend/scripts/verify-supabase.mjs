import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;
const targetUrl = process.env.SUPABASE_DB_URL;

if (!targetUrl) {
  console.error('[verify] SUPABASE_DB_URL is required');
  process.exit(1);
}

const client = new Client({ 
  connectionString: targetUrl, 
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000
});

async function verifySupabase() {
  try {
    await client.connect();
    console.log('[verify] ✓ Connected to Supabase');

    // Count total tables
    const tableCount = await client.query(`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log(`[verify] Total tables: ${tableCount.rows[0].count}`);

    // List all tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n[verify] Critical tables check:');
    const criticalTables = [
      'users',
      'user_sessions',
      'profiles',
      'broker_accounts',
      'strategies',
      'algo_orders',
      'algo_positions',
      'algo_trades',
      'execution_events',
      'broker_execution_events',
      'notifications',
      'payments',
      'ledger_transactions',
      'crm_customers',
      'crm_interactions'
    ];

    const tableNames = tables.rows.map(r => r.table_name);
    
    for (const table of criticalTables) {
      const exists = tableNames.includes(table);
      if (exists) {
        const count = await client.query(`SELECT COUNT(*) AS count FROM "${table}"`);
        console.log(`  ${table}: ✓ EXISTS (${count.rows[0].count} rows)`);
      } else {
        console.log(`  ${table}: ✗ MISSING`);
      }
    }

    console.log(`\n[verify] All tables (${tableNames.length}):`);
    tableNames.forEach(t => console.log(`  - ${t}`));

  } catch (error) {
    console.error(`[verify] ✗ Error: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

verifySupabase();
