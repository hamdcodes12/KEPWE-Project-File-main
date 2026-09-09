import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (3 levels up: src/config/db.js -> backend -> root)
dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config();

const { Pool } = pg;

const isExternalPg = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('pglite'));
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://pglite@localhost/kepwe';
}
const databaseUrl = isExternalPg ? process.env.DATABASE_URL : null;

const dataDir = resolve(__dirname, '../../data/pgdata');
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
      'profile_avatar_and_crm_seeds.sql',
      'product_memberships_schema.sql',
      'quant_additions.sql'
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
    // Ensure default on expires_at exists
    try {
      await client.query(`ALTER TABLE idempotency_records ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours')`);
    } catch (_) {}
  }
}

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
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
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    if (process.env.NODE_ENV === 'production') process.exit(-1);
  });
}

export async function testConnection() {
  if (databaseUrl) {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT NOW() as now');
      console.log(`[db] Connected to PostgreSQL at ${res.rows[0].now}`);
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

