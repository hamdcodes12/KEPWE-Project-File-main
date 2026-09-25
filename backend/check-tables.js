import { pool } from './src/config/db.js';

async function checkTables() {
  const tables = ['algo_orders', 'algo_positions', 'algo_trades', 'execution_events', 'broker_execution_events'];
  
  console.log('Checking required OMS tables:');
  
  for (const table of tables) {
    try {
      const result = await pool.query(
        'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists',
        [table]
      );
      console.log(`  ${table}: ${result.rows[0].exists ? '✓ EXISTS' : '✗ MISSING'}`);
    } catch (error) {
      console.log(`  ${table}: ✗ ERROR - ${error.message}`);
    }
  }
  
  await pool.end();
}

checkTables().catch(console.error);