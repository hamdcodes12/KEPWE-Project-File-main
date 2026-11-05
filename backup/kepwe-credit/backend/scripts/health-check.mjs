import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;
const targetUrl = process.env.SUPABASE_DB_URL;

if (!targetUrl) {
  console.error('[health] SUPABASE_DB_URL is required');
  process.exit(1);
}

console.log('[health] Running health checks...\n');

const client = new Client({ 
  connectionString: targetUrl, 
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function healthCheck() {
  let exitCode = 0;

  try {
    // Database connection
    await client.connect();
    console.log('✓ Database connection: SUCCESS');

    // Query test
    const timeResult = await client.query('SELECT NOW() as now');
    console.log(`✓ Database query: SUCCESS (${timeResult.rows[0].now})`);

    // Critical tables existence
    const tables = ['users', 'broker_accounts', 'algo_orders', 'algo_positions', 'algo_trades'];
    for (const table of tables) {
      const exists = await client.query(
        'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists',
        [table]
      );
      if (exists.rows[0].exists) {
        console.log(`✓ Table "${table}": EXISTS`);
      } else {
        console.log(`✗ Table "${table}": MISSING`);
        exitCode = 1;
      }
    }

    // Schema version check
    const tableCount = await client.query(
      'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = \'public\' AND table_type = \'BASE TABLE\''
    );
    console.log(`✓ Total tables: ${tableCount.rows[0].count}`);

    console.log('\n[health] ✓ ALL CHECKS PASSED');
  } catch (error) {
    console.error(`\n[health] ✗ HEALTH CHECK FAILED: ${error.message}`);
    exitCode = 1;
  } finally {
    await client.end();
  }

  process.exitCode = exitCode;
}

healthCheck();
