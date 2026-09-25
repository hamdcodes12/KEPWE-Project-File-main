import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;
const client = new Client({ 
  connectionString: process.env.SUPABASE_DB_URL, 
  ssl: { rejectUnauthorized: false }
});

await client.connect();

// Check algo_settings constraints
console.log('=== CHECKING ALGO_SETTINGS CONSTRAINTS ===');
try {
  const settings1 = await client.query(`SELECT * FROM algo_settings LIMIT 1`);
  console.log('Sample algo_settings:', settings1.rows[0]);
} catch (e) {
  console.log('No sample data in algo_settings');
}

// Try to find valid risk values
try {
  const validTest = await client.query(`
    INSERT INTO algo_settings (user_id, risk_per_trade) 
    VALUES ('00000000-0000-0000-0000-000000000000', 1.0) 
    RETURNING risk_per_trade
  `);
  console.log('Valid risk_per_trade: 1.0');
  await client.query(`DELETE FROM algo_settings WHERE user_id = '00000000-0000-0000-0000-000000000000'`);
} catch (e) {
  console.log('risk_per_trade=1.0 failed:', e.message);
}

// Check broker enum values
console.log('\n=== CHECKING BROKER TYPES ===');
try {
  const brokerTypes = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname LIKE '%broker%' 
    ORDER BY e.enumsortorder
  `);
  
  console.log('Available broker types:');
  brokerTypes.rows.forEach(row => {
    console.log(`  ${row.enumlabel}`);
  });
} catch (e) {
  console.log('Error getting broker types:', e.message);
}

await client.end();