import fs from 'fs';
const { pool } = await import(process.cwd() + '/src/config/db.js');
await pool.query('SELECT 1'); // triggers auto-migrations on the PGlite test DB
const { PGlite } = await import('@electric-sql/pglite');
const client = await pool.connect();
for (const f of ['006_production_readiness_oms.sql', '007_dhan_live_flow_hardening.sql', '008_order_remaining_quantity.sql']) {
  const sql = fs.readFileSync(`db/migrations/${f}`, 'utf8');
  const stmts = sql.split(/;\s*\n/).map((s) => s.trim()).filter((s) => s && !/^--/.test(s.split('\n').filter((l) => !l.trim().startsWith('--')).join('').trim() === '' ? '--' : s));
  for (const stmt of stmts) {
    try { await client.query(stmt); } catch (e) { console.log('FAILED', f, '->', e.message, '| stmt:', stmt.replace(/\s+/g, ' ').slice(0, 140)); break; }
  }
  console.log('DONE', f);
}
const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='algo_orders' AND column_name IN ('correlation_id','exchange_order_id','remaining_quantity')`);
console.log('COLUMNS NOW', r.rows.map((x) => x.column_name).sort().join(','));
process.exit(0);
