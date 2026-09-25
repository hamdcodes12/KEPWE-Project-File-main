import { pool } from '../src/config/db.js';

async function main() {
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('Total tables:', r.rows.length);
  console.log('Tables:', r.rows.map(x => x.table_name).join(', '));
  process.exit(0);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
