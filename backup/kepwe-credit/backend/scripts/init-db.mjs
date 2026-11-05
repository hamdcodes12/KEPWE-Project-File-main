import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve('./data/pgdata');
fs.mkdirSync(dataDir, { recursive: true });

console.log('[init-db] Initializing persistent PGlite at:', dataDir);
const db = new PGlite(dataDir);
await db.waitReady;

// Check if already migrated
const checkRes = await db.query(`
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'chart_of_accounts'
  ) AS exists;
`);

if (checkRes.rows[0]?.exists) {
  console.log('[init-db] Tables already exist in persistent storage.');
} else {
  console.log('[init-db] Fresh database detected. Applying migrations...');
  const files = [
    'schema.sql',
    'seed.sql',
    'phase2_additions.sql',
    'admin_additions.sql',
    'production_additions.sql',
    'admin_operations_additions.sql',
    'razorpay_payments.sql',
    'indexpilot_plan_names.sql',
    'indexpilot_plan_prices.sql',
    'business_plan_ui_names.sql',
    'algo_additions.sql',
    'algo_engine_additions.sql',
    'aadhaar_kyc_schema.sql',
    'email_otp_additions.sql',
    'ledger_schema.sql',
    'ledger_production_system.sql'
  ];

  for (const file of files) {
    const filePath = path.resolve('./db', file);
    if (!fs.existsSync(filePath)) continue;
    let sql = fs.readFileSync(filePath, 'utf-8');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '-- pgcrypto built-in');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, '-- pgcrypto built-in');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "citext";/gi, '-- citext replaced');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS citext;/gi, '-- citext replaced');
    sql = sql.replace(/\bcitext\b/gi, 'VARCHAR(255)');

    await db.exec(sql);
    console.log(`[init-db] Applied ${file}`);
  }
}

const countRes = await db.query(`
  SELECT COUNT(*) as count 
  FROM information_schema.tables 
  WHERE table_schema = 'public';
`);
console.log('[init-db] Persistent PostgreSQL is ready with total tables:', countRes.rows[0].count);

await db.close();
