import { pool } from '../src/config/db.js';

async function main() {
  const r = await pool.query('SELECT id, email, full_name, role, plan, is_active FROM users');
  console.log('Total users in DB:', r.rows.length);
  console.log('Users:', r.rows);
  process.exit(0);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
