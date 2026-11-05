import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;
const targetUrl = process.env.SUPABASE_DB_URL;

if (!targetUrl) {
  console.error('[smoke-test] SUPABASE_DB_URL is required');
  process.exit(1);
}

console.log('[smoke-test] Running smoke tests...\n');

const client = new Client({ 
  connectionString: targetUrl, 
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function smokeTest() {
  let exitCode = 0;

  try {
    await client.connect();
    console.log('=== AUTHENTICATION SMOKE TEST ===');
    
    // Check users table structure
    const usersColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    const requiredUserColumns = ['id', 'email', 'password_hash', 'created_at'];
    const userColumnNames = usersColumns.rows.map(r => r.column_name);
    
    let authPass = true;
    for (const col of requiredUserColumns) {
      if (userColumnNames.includes(col)) {
        console.log(`✓ users.${col}: EXISTS`);
      } else {
        console.log(`✗ users.${col}: MISSING`);
        authPass = false;
        exitCode = 1;
      }
    }

    // Check user_sessions table
    const sessionsExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_sessions'
      ) AS exists
    `);
    
    if (sessionsExists.rows[0].exists) {
      console.log('✓ user_sessions table: EXISTS');
    } else {
      console.log('✗ user_sessions table: MISSING');
      authPass = false;
      exitCode = 1;
    }

    console.log(`\n[smoke-test] Authentication: ${authPass ? 'PASS' : 'FAIL'}`);

    console.log('\n=== QUANT DASHBOARD SMOKE TEST ===');
    
    // Check Quant-related tables
    const quantTables = [
      'algo_strategies',
      'algo_settings',
      'algo_orders',
      'algo_positions',
      'algo_trades',
      'broker_accounts',
      'execution_events'
    ];

    let quantPass = true;
    for (const table of quantTables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1
        ) AS exists
      `, [table]);
      
      if (exists.rows[0].exists) {
        const count = await client.query(`SELECT COUNT(*) AS count FROM "${table}"`);
        console.log(`✓ ${table}: EXISTS (${count.rows[0].count} rows)`);
      } else {
        console.log(`✗ ${table}: MISSING`);
        quantPass = false;
        exitCode = 1;
      }
    }

    // Check quant_strategies table (new Quant system)
    const quantStrategiesExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'quant_strategies'
      ) AS exists
    `);
    
    if (quantStrategiesExists.rows[0].exists) {
      const count = await client.query('SELECT COUNT(*) AS count FROM quant_strategies');
      console.log(`✓ quant_strategies: EXISTS (${count.rows[0].count} rows)`);
    } else {
      console.log('✗ quant_strategies: MISSING');
      quantPass = false;
      exitCode = 1;
    }

    console.log(`\n[smoke-test] Quant Dashboard: ${quantPass ? 'PASS' : 'FAIL'}`);

    console.log('\n=== BROKER INTEGRATION SMOKE TEST ===');
    
    // Check broker_accounts structure
    const brokerCols = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'broker_accounts'
      ORDER BY ordinal_position
    `);
    
    const brokerColNames = brokerCols.rows.map(r => r.column_name);
    const requiredBrokerCols = ['id', 'user_id', 'broker', 'status'];
    
    let brokerPass = true;
    for (const col of requiredBrokerCols) {
      if (brokerColNames.includes(col)) {
        console.log(`✓ broker_accounts.${col}: EXISTS`);
      } else {
        console.log(`✗ broker_accounts.${col}: MISSING`);
        brokerPass = false;
        exitCode = 1;
      }
    }

    console.log(`\n[smoke-test] Broker Integration: ${brokerPass ? 'PASS' : 'FAIL'}`);

    if (exitCode === 0) {
      console.log('\n[smoke-test] ✓ ALL SMOKE TESTS PASSED');
    } else {
      console.log('\n[smoke-test] ✗ SOME SMOKE TESTS FAILED');
    }

  } catch (error) {
    console.error(`\n[smoke-test] ✗ ERROR: ${error.message}`);
    exitCode = 1;
  } finally {
    await client.end();
  }

  process.exitCode = exitCode;
}

smokeTest();
