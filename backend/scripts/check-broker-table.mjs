import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;
const client = new Client({ 
  connectionString: process.env.SUPABASE_DB_URL, 
  ssl: { rejectUnauthorized: false }
});

await client.connect();
const result = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name='broker_accounts' 
  ORDER BY ordinal_position
`);
console.log('broker_accounts columns:');
result.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));
await client.end();
