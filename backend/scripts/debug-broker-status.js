import { pool } from '../src/config/db.js';

async function main() {
  console.log('=== BROKER CONNECTION DATABASE STATE ===\n');

  // First check table structure
  const columns = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'broker_accounts' 
    ORDER BY ordinal_position
  `);

  console.log('BROKER_ACCOUNTS TABLE COLUMNS:');
  columns.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
  console.log();

  // Check broker_accounts table
  const accounts = await pool.query(`
    SELECT ba.id, ba.user_id, ba.broker, ba.status, ba.connection_mode, 
           ba.created_at, ba.updated_at,
           u.email
    FROM broker_accounts ba
    JOIN users u ON ba.user_id = u.id
    WHERE ba.broker = 'DHAN'
    ORDER BY ba.updated_at DESC
    LIMIT 5
  `);

  console.log('BROKER_ACCOUNTS (Recent DHAN connections):');
  accounts.rows.forEach((row, i) => {
    console.log(`${i+1}. ${row.email} - Status: ${row.status} - Mode: ${row.connection_mode}`);
    console.log(`   Updated: ${row.updated_at?.toISOString()}`);
    console.log();
  });

  // Check what status values exist
  const statusValues = await pool.query(`
    SELECT DISTINCT status, COUNT(*) as count
    FROM broker_accounts 
    WHERE broker = 'DHAN'
    GROUP BY status
    ORDER BY count DESC
  `);

  console.log('STATUS VALUES IN DATABASE:');
  statusValues.rows.forEach(row => {
    console.log(`  "${row.status}": ${row.count} accounts`);
  });
  console.log();

  await pool.end();
}

main().catch(console.error);