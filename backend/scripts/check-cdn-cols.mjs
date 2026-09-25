import { pool } from '../src/config/db.js';

async function main() {
  const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'credit_debit_notes' ORDER BY ordinal_position");
  console.log('Columns:', r.rows);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
