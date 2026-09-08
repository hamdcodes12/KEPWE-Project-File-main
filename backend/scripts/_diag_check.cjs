const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString:
      'postgresql://postgres:PrpRClimcvmKCWeGOUZzFNyjjRYOeNQI@sakura.proxy.rlwy.net:50902/railway',
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const r1 = await c.query(
    "SELECT email, created_at FROM users WHERE email = 'testuser999888@example.com'"
  );
  console.log('user row:', JSON.stringify(r1.rows));

  const r2 = await c.query(
    "SELECT username, is_active, role, password_hash FROM admin_users WHERE username='admin'"
  );
  console.log('admin row:', JSON.stringify(r2.rows));

  const r3 = await c.query('SELECT count(*) AS n FROM user_sessions');
  console.log('sessions count:', JSON.stringify(r3.rows));

  const r4 = await c.query('SELECT count(*) AS n FROM admin_sessions');
  console.log('admin_sessions count:', JSON.stringify(r4.rows));

  const r5 = await c.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('tables:', JSON.stringify(r5.rows.map((r) => r.table_name)));

  const r6 = await c.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='admin_sessions' ORDER BY ordinal_position"
  );
  console.log('admin_sessions columns:', JSON.stringify(r6.rows));

  const r7 = await c.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='user_sessions' ORDER BY ordinal_position"
  );
  console.log('user_sessions columns:', JSON.stringify(r7.rows));

  await c.end();
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
