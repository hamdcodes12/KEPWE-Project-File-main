import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;
const sourceUrl = process.env.SOURCE_DB_CONNECTION;

if (!sourceUrl) {
  console.error('[source-test] SOURCE_DB_CONNECTION not configured');
  process.exit(1);
}

console.log('[source-test] Testing connection to legacy database...');
console.log('[source-test] Attempting connection (15s timeout)...');

const client = new Client({ 
  connectionString: sourceUrl, 
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000
});

async function testConnection() {
  try {
    await client.connect();
    console.log('[source-test] ✓ CONNECTION SUCCESS');

    // Get table count
    const tableCount = await client.query(`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log(`[source-test] Legacy database has ${tableCount.rows[0].count} tables`);

    // Check for data in critical tables
    const criticalTables = [
      'users',
      'broker_accounts',
      'algo_orders',
      'algo_positions',
      'algo_trades',
      'notifications',
      'payments',
      'ledger_transactions'
    ];

    console.log('\n[source-test] Critical tables row counts:');
    for (const table of criticalTables) {
      try {
        const count = await client.query(`SELECT COUNT(*) AS count FROM "${table}"`);
        console.log(`  ${table}: ${count.rows[0].count} rows`);
      } catch (error) {
        console.log(`  ${table}: not found or error`);
      }
    }

    console.log('\n[source-test] ✓ DATABASE IS REACHABLE');
    console.log('[source-test] Data migration can proceed');

  } catch (error) {
    console.error('\n[source-test] ✗ CONNECTION FAILED');
    console.error(`[source-test] Error: ${error.message}`);
    console.error('[source-test] Code:', error.code);
    console.error('\n[source-test] SOURCE DATABASE UNREACHABLE');
    console.error('[source-test] DATA MIGRATION PENDING');
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

testConnection();
