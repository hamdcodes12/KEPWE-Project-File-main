import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { buildPgConfig } from '../lib/resolve-db-url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (3 levels up: src/config/db.js -> backend -> root)
dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config();

const { Pool } = pg;

const isPgliteTest = process.env.KEPWE_PGLITE_TEST === 'true';
if (isPgliteTest && process.env.NODE_ENV === 'production') {
  throw new Error('PGlite test storage is forbidden in production');
}
const configuredDatabaseUrl = process.env.SUPABASE_DB_URL || null;
const databaseUrl = isPgliteTest ? null : configuredDatabaseUrl;
const isExternalPg = Boolean(databaseUrl && !isPgliteTest);

if (!databaseUrl && !isPgliteTest) {
  throw new Error('SUPABASE_DB_URL is required outside test mode');
}

const dataDir = process.env.PGLITE_DATA_DIR
  ? resolve(process.env.PGLITE_DATA_DIR)
  : resolve(__dirname, '../../data/pgdata');
let pgliteInstance = null;
let pgliteReadyPromise = null;

export async function getPglite() {
  if (!pgliteInstance) {
    fs.mkdirSync(dataDir, { recursive: true });
    const pidFile = join(dataDir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
        console.log('[db] Cleaned up stale postmaster.pid lock file.');
      } catch (_) {}
    }
    pgliteInstance = new PGlite(dataDir);
    pgliteReadyPromise = (async () => {
      await pgliteInstance.waitReady;
      await runAutoMigrations(pgliteInstance);
    })();
  }
  await pgliteReadyPromise;
  return pgliteInstance;
}

export async function runAutoMigrations(client) {
  const checkRes = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'chart_of_accounts'
    ) AS exists;
  `);

  if (!checkRes.rows[0]?.exists) {
    console.log('[db] Running automated database migrations...');
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
      'ledger_production_system.sql',
      'ledger_production_v2.sql',
      'ledger_integrations.sql',
      'ledger_subscriptions.sql',
      'profile_avatar_and_crm_seeds.sql',
      'product_memberships_schema.sql',
      'quant_additions.sql',
      'ledger_prd_dashboard.sql',
      'ledger_prd_phase6_upload.sql',
      'ledger_prd_phase8_goals.sql',
      'credit_report_analysis.sql'
    ];

    for (const file of files) {
      const filePath = resolve(__dirname, '../../db', file);
      if (!fs.existsSync(filePath)) continue;
      let sql = fs.readFileSync(filePath, 'utf-8');
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '-- pgcrypto built-in');
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, '-- pgcrypto built-in');
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "citext";/gi, '-- citext replaced');
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS citext;/gi, '-- citext replaced');
      sql = sql.replace(/\bcitext\b/gi, 'VARCHAR(255)');
      if (client.exec) {
        await client.exec(sql);
      } else {
        await client.query(sql);
      }
    }
    console.log('[db] Automated database migrations completed successfully.');
  } else {
    // Check if product_memberships table exists
    const pmCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'product_memberships'
      ) AS exists;
    `);
    if (!pmCheck.rows[0]?.exists) {
      console.log('[db] Applying product_memberships_schema migration...');
      const pmPath = resolve(__dirname, '../../db/product_memberships_schema.sql');
      if (fs.existsSync(pmPath)) {
        const sql = fs.readFileSync(pmPath, 'utf-8');
        if (client.exec) {
          await client.exec(sql);
        } else {
          await client.query(sql);
        }
        console.log('[db] product_memberships_schema migration applied successfully.');
      }
    }
    // Check if ledger_production_v2.sql has been applied
    const v2Check = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'gst_tax_period_locks'
      ) AS exists;
    `);
    if (!v2Check.rows[0]?.exists) {
      console.log('[db] Applying ledger_production_v2 migration...');
      const v2Path = resolve(__dirname, '../../db/ledger_production_v2.sql');
      if (fs.existsSync(v2Path)) {
        const sql = fs.readFileSync(v2Path, 'utf-8');
        if (client.exec) {
          await client.exec(sql);
        } else {
          await client.query(sql);
        }
        console.log('[db] ledger_production_v2 migration applied successfully.');
      }
    }
    const integrationsCheck = await client.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_webhooks') AS exists;
    `);
    if (!integrationsCheck.rows[0]?.exists) {
      const integrationsPath = resolve(__dirname, '../../db/ledger_integrations.sql');
      if (fs.existsSync(integrationsPath)) {
        const sql = fs.readFileSync(integrationsPath, 'utf-8');
        if (client.exec) await client.exec(sql); else await client.query(sql);
      }
    }
    const ledgerPlansCheck = await client.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_plans') AS exists;
    `);
    if (!ledgerPlansCheck.rows[0]?.exists) {
      const plansPath = resolve(__dirname, '../../db/ledger_subscriptions.sql');
      if (fs.existsSync(plansPath)) {
        const sql = fs.readFileSync(plansPath, 'utf-8');
        if (client.exec) await client.exec(sql); else await client.query(sql);
      }
    }
    // Check each profile avatar column so a partially applied migration is repaired.
    const avatarColCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'avatar_data'
      ) AS has_avatar_data,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'avatar_mime'
      ) AS has_avatar_mime,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'avatar_url'
      ) AS exists;
    `);
    const avatarColumns = avatarColCheck.rows[0];
    if (!avatarColumns?.has_avatar_data || !avatarColumns?.has_avatar_mime || !avatarColumns?.exists) {
      console.log('[db] Applying profile_avatar_and_crm_seeds migration...');
      const avatarPath = resolve(__dirname, '../../db/profile_avatar_and_crm_seeds.sql');
      if (fs.existsSync(avatarPath)) {
        const sql = fs.readFileSync(avatarPath, 'utf-8');
        if (client.exec) {
          await client.exec(sql);
        } else {
          await client.query(sql);
        }
        console.log('[db] profile_avatar_and_crm_seeds migration applied successfully.');
      }
    }
    // Check if quant_strategies table exists
    const quantCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'quant_strategies'
      ) AS exists;
    `);
    if (!quantCheck.rows[0]?.exists) {
      console.log('[db] Applying quant_additions migration...');
      const quantPath = resolve(__dirname, '../../db/quant_additions.sql');
      if (fs.existsSync(quantPath)) {
        const sql = fs.readFileSync(quantPath, 'utf-8');
        if (client.exec) {
          await client.exec(sql);
        } else {
          await client.query(sql);
        }
        console.log('[db] quant_additions migration applied successfully.');
      }
    }
    const brokerEnhancementsCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'broker_oauth_tokens'
          AND column_name = 'feed_token_ciphertext'
      ) AS has_feed_token,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'broker_verification_history'
      ) AS has_verification_history;
    `);
    const brokerEnhancements = brokerEnhancementsCheck.rows[0];
    if (!brokerEnhancements?.has_feed_token || !brokerEnhancements?.has_verification_history) {
      console.log('[db] Applying broker enhancements migration...');
      const brokerPath = resolve(__dirname, '../../db/migrations/003_broker_enhancements.sql');
      if (fs.existsSync(brokerPath)) {
        const sql = fs.readFileSync(brokerPath, 'utf-8');
        if (client.exec) {
          await client.exec(sql);
        } else {
          await client.query(sql);
        }
        console.log('[db] Broker enhancements migration applied successfully.');
      }
    }
    const liveExecutionCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'algo_orders'
          AND column_name = 'broker_account_id'
      ) AS has_broker_account_id,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'broker_execution_events'
      ) AS has_execution_events;
    `);
    const liveExecution = liveExecutionCheck.rows[0];
    if (!liveExecution?.has_broker_account_id || !liveExecution?.has_execution_events) {
      const liveExecutionPath = resolve(__dirname, '../../db/migrations/005_live_broker_execution.sql');
      if (fs.existsSync(liveExecutionPath)) {
        const sql = fs.readFileSync(liveExecutionPath, 'utf-8');
        if (client.exec) await client.exec(sql); else await client.query(sql);
      }
    }
    const readinessOmsPath = resolve(__dirname, '../../db/migrations/006_production_readiness_oms.sql');
    if (fs.existsSync(readinessOmsPath)) {
      const sql = fs.readFileSync(readinessOmsPath, 'utf-8');
      if (client.exec) await client.exec(sql); else await client.query(sql);
    }
    const liveFlowHardeningPath = resolve(__dirname, '../../db/migrations/007_live_flow_hardening.sql');
    if (fs.existsSync(liveFlowHardeningPath)) {
      const sql = fs.readFileSync(liveFlowHardeningPath, 'utf-8');
      if (client.exec) await client.exec(sql); else await client.query(sql);
    }
    // Angel One SmartAPI is the only supported broker (idempotent).
    const angelOneOnlyPath = resolve(__dirname, '../../db/migrations/009_angel_one_only.sql');
    if (fs.existsSync(angelOneOnlyPath)) {
      const sql = fs.readFileSync(angelOneOnlyPath, 'utf-8');
      if (client.exec) await client.exec(sql); else await client.query(sql);
    }
    // Ensure default on expires_at exists
    try {
      await client.query(`ALTER TABLE idempotency_records ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours')`);
    } catch (_) {}

    // Check if ledger_financial_profiles table exists
    const prdCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ledger_financial_profiles'
      ) AS exists;
    `);
    if (!prdCheck.rows[0]?.exists) {
      console.log('[db] Applying ledger_prd_dashboard.sql migration...');
      const prdPath = resolve(__dirname, '../../db/ledger_prd_dashboard.sql');
      if (fs.existsSync(prdPath)) {
        let sql = fs.readFileSync(prdPath, 'utf-8');
        if (client.exec) await client.exec(sql); else await client.query(sql);
        console.log('[db] ledger_prd_dashboard.sql migration applied successfully.');
      }
    }

    // Check if ledger_transactions has statement_import_id column
    const phase6Check = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ledger_transactions' AND column_name = 'statement_import_id'
      ) AS exists;
    `);
    if (!phase6Check.rows[0]?.exists) {
      console.log('[db] Applying ledger_prd_phase6_upload.sql migration...');
      const p6Path = resolve(__dirname, '../../db/ledger_prd_phase6_upload.sql');
      if (fs.existsSync(p6Path)) {
        let sql = fs.readFileSync(p6Path, 'utf-8');
        if (client.exec) await client.exec(sql); else await client.query(sql);
        console.log('[db] ledger_prd_phase6_upload.sql migration applied successfully.');
      }
    }

    // Check if ledger_goals table exists (Phase 8)
    const phase8Check = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ledger_goals'
      ) AS exists;
    `);
    if (!phase8Check.rows[0]?.exists) {
      console.log('[db] Applying ledger_prd_phase8_goals.sql migration...');
      const p8Path = resolve(__dirname, '../../db/ledger_prd_phase8_goals.sql');
      if (fs.existsSync(p8Path)) {
        let sql = fs.readFileSync(p8Path, 'utf-8');
        if (client.exec) await client.exec(sql); else await client.query(sql);
        console.log('[db] ledger_prd_phase8_goals.sql migration applied successfully.');
      }
    }

    // Check if user_subscriptions table exists
    const subCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'user_subscriptions'
      ) AS exists;
    `);
    if (!subCheck.rows[0]?.exists) {
      console.log('[db] Applying quant_subscription_system.sql migration...');
      const subPath = resolve(__dirname, '../../db/quant_subscription_system.sql');
      if (fs.existsSync(subPath)) {
        let sql = fs.readFileSync(subPath, 'utf-8');
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '-- pgcrypto built-in');
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, '-- pgcrypto built-in');
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "citext";/gi, '-- citext replaced');
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS citext;/gi, '-- citext replaced');
        sql = sql.replace(/\bcitext\b/gi, 'VARCHAR(255)');
        if (client.exec) await client.exec(sql); else await client.query(sql);
        console.log('[db] quant_subscription_system.sql migration applied successfully.');
      }
    }

    const creditReportCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'credit_report_analyses'
      ) AS exists;
    `);
    if (!creditReportCheck.rows[0]?.exists) {
      const creditReportPath = resolve(__dirname, '../../db/credit_report_analysis.sql');
      if (fs.existsSync(creditReportPath)) {
        const sql = fs.readFileSync(creditReportPath, 'utf-8');
        if (client.exec) await client.exec(sql); else await client.query(sql);
      }
    }

    // Check if QA user exists
    try {
      const qaCheck = await client.query(`SELECT id FROM users WHERE email = 'qa@kepwe.in'`);
      if (qaCheck.rows.length === 0) {
        console.log('[db] Bootstrapping QA user...');
        const bcrypt = (await import('bcryptjs')).default;
        const passHash = await bcrypt.hash('KepweQA@2026', 10);
        await client.query(`
          INSERT INTO users (id, email, password_hash, full_name, mobile, email_verified, is_active)
          VALUES ('11111111-1111-4111-8111-111111111111', 'qa@kepwe.in', $1, 'Harshad Mehta', '9876543210', TRUE, TRUE)
          ON CONFLICT (id) DO UPDATE SET password_hash = $1, is_active = TRUE, email_verified = TRUE, full_name = 'Harshad Mehta'
        `, [passHash]);
        await client.query(`
          INSERT INTO product_memberships (user_id, product, role, status)
          VALUES ('11111111-1111-4111-8111-111111111111', 'ledger', 'member', 'active')
          ON CONFLICT (user_id, product) DO UPDATE SET status = 'active'
        `);
        console.log('[db] QA user bootstrapped successfully.');
      }
    } catch (err) {
      console.warn('[db] Note: QA user bootstrap skipped:', err.message);
    }
  }
}

// --- Pool creation (lazy, so IPv4 resolution can complete first) -----------
// We export a proxy object that initialises the real pg.Pool on first use.
// This avoids a top-level await (which would require module-wide async) while
// still ensuring buildPgConfig (which does a DNS lookup) runs before any
// query is made.

let _pool = null;

async function getPool() {
  if (_pool) return _pool;
  if (!databaseUrl) return null; // embedded PGlite path

  const cfg = await buildPgConfig(databaseUrl, {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  _pool = new Pool(cfg);

  _pool.on('error', (err) => {
    console.error('[db] Unexpected error on idle PostgreSQL client:', err.message);
    if (process.env.NODE_ENV === 'production') process.exit(-1);
  });

  return _pool;
}

// pool proxy — all code that does `pool.query()` or `pool.connect()` works
// unchanged; the real pool is created on first call.
export const pool = databaseUrl
  ? {
      query: async (text, params) => {
        const p = await getPool();
        return p.query(text, params);
      },
      connect: async () => {
        const p = await getPool();
        return p.connect();
      },
      on: () => {}, // pool.on('error') wired up inside getPool
      end: async () => {
        if (_pool) await _pool.end();
      },
    }
  : {
      isEmbedded: true,
      query: async (text, params) => {
        const db = await getPglite();
        return db.query(text, params);
      },
      connect: async () => {
        const db = await getPglite();
        return {
          query: async (text, params) => db.query(text, params),
          release: () => {},
        };
      },
      on: () => {},
    };

if (databaseUrl && pool.on) {
  // error handler is wired inside getPool() — nothing to do here
}

export async function testConnection() {
  if (databaseUrl) {
    // getPool() resolves hostname to IPv4 and creates the real pool
    const p = await getPool();
    const client = await p.connect();
    try {
      const res = await client.query('SELECT NOW() as now');
      console.log(`[db] ✅ Connected to PostgreSQL at ${res.rows[0].now}`);
    } finally {
      client.release();
    }
  } else {
    const db = await getPglite();
    await runAutoMigrations(db);
    const res = await db.query('SELECT NOW() as now');
    console.log(`[db] Connected to Persistent Embedded PostgreSQL at ${res.rows[0].now}`);
  }
}

// Run a query in a transaction with RLS context (current_user_id)
// This is the key security primitive: every authed query sets the
// app.current_user_id so row-level security (RLS) policies apply.
export async function withRLSContext(userId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config(..., true) makes it transaction-local, and supports
    // parameter binding (unlike SET LOCAL which cannot take $1)
    if (userId) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    } else {
      // Pass NULL (not an empty string) so that `current_setting(...)::uuid`
      // evaluates to NULL instead of throwing "invalid input syntax for type uuid".
      // This lets anonymous-access RLS policies use `... IS NULL` checks safely.
      await client.query("SELECT set_config('app.current_user_id', NULL, true)");
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function hasDb() {
  return true;
}

export async function closeEmbeddedDatabase() {
  if (!pgliteInstance) return;
  await pgliteInstance.close();
  pgliteInstance = null;
  pgliteReadyPromise = null;
}

