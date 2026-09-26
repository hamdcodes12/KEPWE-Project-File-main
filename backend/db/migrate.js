import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import { buildPgConfig } from '../src/lib/resolve-db-url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up from backend/db/migrate.js)
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config();

const { Client } = pg;

const MIGRATION_CONNECT_ATTEMPTS = Number.parseInt(process.env.MIGRATION_CONNECT_ATTEMPTS || '5', 10);
const MIGRATION_CONNECT_DELAY_MS = Number.parseInt(process.env.MIGRATION_CONNECT_DELAY_MS || '3000', 10);

function isTransientConnectionError(err) {
  return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', '57P03'].includes(err?.code);
}

async function connectWithRetry(clientOptions) {
  const attempts = Number.isFinite(MIGRATION_CONNECT_ATTEMPTS) && MIGRATION_CONNECT_ATTEMPTS > 0
    ? MIGRATION_CONNECT_ATTEMPTS
    : 6;
  const delayMs = Number.isFinite(MIGRATION_CONNECT_DELAY_MS) && MIGRATION_CONNECT_DELAY_MS > 0
    ? MIGRATION_CONNECT_DELAY_MS
    : 3000;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const client = new Client(clientOptions);
    try {
      await client.connect();
      return client;
    } catch (err) {
      await client.end().catch(() => {});
      const canRetry = isTransientConnectionError(err) && attempt < attempts;
      if (!canRetry) throw err;

      const waitMs = delayMs * attempt;
      console.warn(
        `[migrate] PostgreSQL connection attempt ${attempt}/${attempts} failed (${err.code || err.message}). ` +
        `Retrying in ${waitMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

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
  console.log('[migrate] Starting database migration...');
  console.log(`[migrate] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`[migrate] SUPABASE_DB_URL: ${process.env.SUPABASE_DB_URL ? `SET (length ${process.env.SUPABASE_DB_URL.length})` : 'NOT SET'}`);

  const configuredDatabaseUrl = process.env.SUPABASE_DB_URL;

  if (!configuredDatabaseUrl) {
    console.error('[migrate] FATAL: SUPABASE_DB_URL is not set');
    process.exit(1);
  }

  // buildPgConfig resolves hostname to IPv4 (fixes ENETUNREACH on Render)
  // and sets SSL servername to original hostname for TLS cert validation.
  const clientOptions = await buildPgConfig(configuredDatabaseUrl, {
    connectionTimeoutMillis: 15000,
    keepAlive: true,
  });

  let client;

  try {
    client = await connectWithRetry(clientOptions);
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
    await applySqlFile(client, join(__dirname, 'email_otp_additions.sql'), 'email_otp_additions.sql');
    await applySqlFile(client, join(__dirname, 'ledger_schema.sql'), 'ledger_schema.sql');
    await applySqlFile(client, join(__dirname, 'ledger_production_system.sql'), 'ledger_production_system.sql');
    await applySqlFile(client, join(__dirname, 'ledger_production_v2.sql'), 'ledger_production_v2.sql');
    await applySqlFile(client, join(__dirname, 'ledger_integrations.sql'), 'ledger_integrations.sql');
    await applySqlFile(client, join(__dirname, 'ledger_subscriptions.sql'), 'ledger_subscriptions.sql');
    await applySqlFile(client, join(__dirname, 'profile_avatar_and_crm_seeds.sql'), 'profile_avatar_and_crm_seeds.sql');
    await applySqlFile(client, join(__dirname, 'product_memberships_schema.sql'), 'product_memberships_schema.sql');
    await applySqlFile(client, join(__dirname, 'quant_additions.sql'), 'quant_additions.sql');
    await applySqlFile(client, join(__dirname, 'migrations/003_broker_enhancements.sql'), '003_broker_enhancements.sql');
    await applySqlFile(client, join(__dirname, 'migrations/005_live_broker_execution.sql'), '005_live_broker_execution.sql');
    await applySqlFile(client, join(__dirname, 'migrations/006_production_readiness_oms.sql'), '006_production_readiness_oms.sql');
    await applySqlFile(client, join(__dirname, 'migrations/007_dhan_live_flow_hardening.sql'), '007_dhan_live_flow_hardening.sql');
    await applySqlFile(client, join(__dirname, 'migrations/008_order_remaining_quantity.sql'), '008_order_remaining_quantity.sql');
    await applySqlFile(client, join(__dirname, 'dhan_integration.sql'), 'dhan_integration.sql');
    await applySqlFile(client, join(__dirname, 'quant_subscription_system.sql'), 'quant_subscription_system.sql');
    await applySqlFile(client, join(__dirname, 'fix_quant_memberships.sql'), 'fix_quant_memberships.sql');
    // Deduplicate ledger_categories before applying the PRD dashboard migration
    // which adds a UNIQUE INDEX that would fail if duplicate (user_id, type, name) rows exist.
    await client.query(`
      DELETE FROM ledger_categories a
      USING ledger_categories b
      WHERE a.ctid < b.ctid
        AND COALESCE(a.user_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.user_id, '00000000-0000-0000-0000-000000000000')
        AND a.type = b.type
        AND a.name = b.name
    `);
    await applySqlFile(client, join(__dirname, 'ledger_prd_dashboard.sql'), 'ledger_prd_dashboard.sql');
    await applySqlFile(client, join(__dirname, 'ledger_prd_phase6_upload.sql'), 'ledger_prd_phase6_upload.sql');
    await applySqlFile(client, join(__dirname, 'ledger_prd_phase8_goals.sql'), 'ledger_prd_phase8_goals.sql');
    await applySqlFile(client, join(__dirname, 'credit_report_analysis.sql'), 'credit_report_analysis.sql');

    console.log('[migrate] Migration completed successfully.');
  } catch (err) {
    console.error('[migrate] Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (client) await client.end();
  }
}

main();
