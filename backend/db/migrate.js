import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up from backend/db/migrate.js)
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config();

const { Client } = pg;

async function applySqlFile(client, filePath, label) {
  console.log(`[migrate] Applying ${label}...`);
  const sql = readFileSync(filePath, 'utf8');
  await client.query(sql);
  console.log(`[migrate] ${label} applied.`);
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return result.rows[0].exists;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('FATAL: DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('[migrate] Connected to PostgreSQL');

    // schema.sql is NOT idempotent (plain CREATE TABLE statements), so only
    // run it on a fresh database. Detect this by checking for the `users`
    // table, which schema.sql always creates first.
    const alreadyMigrated = await tableExists(client, 'users');
    if (alreadyMigrated) {
      console.log('[migrate] Core schema already present — skipping schema.sql.');
    } else {
      await applySqlFile(client, join(__dirname, 'schema.sql'), 'schema.sql');
    }

    // seed.sql, phase2_additions.sql and admin_additions.sql are all
    // idempotent (ON CONFLICT DO NOTHING / CREATE TABLE IF NOT EXISTS), so it
    // is always safe to re-run them — this lets phase2_additions.sql and
    // admin_additions.sql pick up new tables on a database that already went
    // through the Phase 1 migration.
    await applySqlFile(client, join(__dirname, 'seed.sql'), 'seed.sql');
    await applySqlFile(client, join(__dirname, 'phase2_additions.sql'), 'phase2_additions.sql');
    await applySqlFile(client, join(__dirname, 'admin_additions.sql'), 'admin_additions.sql');
    await applySqlFile(client, join(__dirname, 'production_additions.sql'), 'production_additions.sql');
    await applySqlFile(client, join(__dirname, 'admin_operations_additions.sql'), 'admin_operations_additions.sql');
    await applySqlFile(client, join(__dirname, 'razorpay_payments.sql'), 'razorpay_payments.sql');
    await applySqlFile(client, join(__dirname, 'indexpilot_plan_names.sql'), 'indexpilot_plan_names.sql');
    await applySqlFile(client, join(__dirname, 'indexpilot_plan_prices.sql'), 'indexpilot_plan_prices.sql');
    await applySqlFile(client, join(__dirname, 'business_plan_ui_names.sql'), 'business_plan_ui_names.sql');
    await applySqlFile(client, join(__dirname, 'algo_additions.sql'), 'algo_additions.sql');
    await applySqlFile(client, join(__dirname, 'algo_engine_additions.sql'), 'algo_engine_additions.sql');
    await applySqlFile(client, join(__dirname, 'aadhaar_kyc_schema.sql'), 'aadhaar_kyc_schema.sql');
    await applySqlFile(client, join(__dirname, 'ledger_schema.sql'), 'ledger_schema.sql');

    console.log('[migrate] Migration completed successfully.');
  } catch (err) {
    console.error('[migrate] Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
