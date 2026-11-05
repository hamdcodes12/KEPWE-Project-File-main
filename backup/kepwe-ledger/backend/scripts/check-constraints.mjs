import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;
const client = new Client({ 
  connectionString: process.env.SUPABASE_DB_URL, 
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  
  // Check algo_settings constraints
  const settings = await client.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.constraint_column_usage ccu
    JOIN information_schema.table_constraints tc 
      ON tc.constraint_name = ccu.constraint_name 
      AND tc.table_name = ccu.table_name
    WHERE ccu.table_name = 'algo_settings'
  `);
  
  console.log('algo_settings constraints:');
  settings.rows.forEach(r => console.log(`  ${r.constraint_name} (${r.constraint_type})`));
  
  // Check broker_accounts constraints
  const broker = await client.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.constraint_column_usage ccu
    JOIN information_schema.table_constraints tc 
      ON tc.constraint_name = ccu.constraint_name 
      AND tc.table_name = ccu.table_name
    WHERE ccu.table_name = 'broker_accounts'
  `);
  
  console.log('\nbroker_accounts constraints:');
  broker.rows.forEach(r => console.log(`  ${r.constraint_name} (${r.constraint_type})`));
  
  // Get check constraints for algo_settings
  const settingsChecks = await client.query(`
    SELECT con.conname, pg_get_constraintdef(con.oid) as constraint_def
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'algo_settings' AND con.contype = 'c'
  `);
  
  console.log('\nalgo_settings CHECK constraints:');
  settingsChecks.rows.forEach(r => console.log(`  ${r.conname}: ${r.constraint_def}`));
  
  // Get check constraints for broker_accounts
  const brokerChecks = await client.query(`
    SELECT con.conname, pg_get_constraintdef(con.oid) as constraint_def
    FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'broker_accounts' AND con.contype = 'c'
  `);
  
  console.log('\nbroker_accounts CHECK constraints:');
  brokerChecks.rows.forEach(r => console.log(`  ${r.conname}: ${r.constraint_def}`));
  
  // Check allowed broker values
  const brokerEnum = await client.query(`
    SELECT unnest(enum_range(NULL::broker_type)) as broker
  `);
  
  console.log('\nBroker types allowed:');
  brokerEnum.rows.forEach(r => console.log(`  ${r.broker}`));
  
  await client.end();
}

check().catch(console.error);
