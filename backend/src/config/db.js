import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (3 levels up: src/config/db.js -> backend -> root)
dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === 'production') {
  console.error('FATAL: DATABASE_URL is not set in the environment/.env');
  process.exit(1);
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
      query: async () => ({ rows: [] }),
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => {},
      }),
      on: () => {},
    };

if (databaseUrl && pool.on) {
  // Test connection on startup
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
    if (process.env.NODE_ENV === 'production') process.exit(-1);
  });
}

export async function testConnection() {
  if (!databaseUrl) {
    console.log('[db] Running in dev mode without PostgreSQL DATABASE_URL. In-memory / fallback stores active.');
    return;
  }
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW() as now');
    console.log(`[db] Connected to PostgreSQL at ${res.rows[0].now}`);
  } finally {
    client.release();
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
