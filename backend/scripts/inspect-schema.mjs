import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;
const client = new Client({ 
  connectionString: process.env.SUPABASE_DB_URL, 
  ssl: { rejectUnauthorized: false }
});

async function inspectTables() {
  await client.connect();
  
  const tables = ['users', 'user_sessions', 'algo_settings', 'notifications', 'admin_users', 'product_memberships', 'broker_accounts'];
  
  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    
    result.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const def = row.column_default ? ` DEFAULT ${row.column_default}` : '';
      console.log(`  ${row.column_name}: ${row.data_type} ${nullable}${def}`);
    });
  }
  
  await client.end();
}

inspectTables().catch(console.error);
