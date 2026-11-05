/**
 * Probe every Supabase pooler variant to find what actually connects.
 * Reads password from SUPABASE_DB_URL - never prints it.
 */
import dotenv from 'dotenv';
import pg from 'pg';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const raw = process.env.SUPABASE_DB_URL;
if (!raw) { console.error('SUPABASE_DB_URL not set'); process.exit(1); }

// Extract password safely - handle special chars in password
const u = new URL(raw);
const password    = u.password;            // may contain @ encoded as %40
const rawPassword = decodeURIComponent(u.password); // actual chars
const PROJECT_REF = 'vzqjoncaupafwcdrktde';

// Build every candidate — URL-encode the password properly
function enc(s) { return encodeURIComponent(s); }

const candidates = [
  // ── Session pooler (port 5432) — IPv4, free tier accessible ──────────────
  `postgresql://postgres.${PROJECT_REF}:${enc(rawPassword)}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  // ── Transaction pooler (port 6543) ────────────────────────────────────────
  `postgresql://postgres.${PROJECT_REF}:${enc(rawPassword)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
  // ── Direct with pgbouncer=true (current .env value) ───────────────────────
  `postgresql://postgres:${enc(rawPassword)}@db.${PROJECT_REF}.supabase.co:5432/postgres?pgbouncer=true`,
  // ── Direct bare ───────────────────────────────────────────────────────────
  `postgresql://postgres:${enc(rawPassword)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
];

async function tryConnect(url) {
  const safe = url.replace(/:([^@]+)@/, ':***@');
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const r = await client.query(
      "SELECT COUNT(*)::int AS t FROM information_schema.tables WHERE table_schema='public'"
    );
    await client.end();
    return { ok: true, tables: r.rows[0].t, safe };
  } catch (err) {
    await client.end().catch(() => {});
    return { ok: false, error: err.message.split('\n')[0], safe };
  }
}

console.log('Probing Supabase connection candidates...\n');
let winner = null;
for (const url of candidates) {
  const result = await tryConnect(url);
  if (result.ok) {
    console.log(`✅ WORKS: ${result.safe} — ${result.tables} tables`);
    winner = url;
    break;
  } else {
    console.log(`❌ FAIL:  ${result.safe}`);
    console.log(`         ${result.error}`);
  }
}

if (winner) {
  const safe = winner.replace(/:([^@]+)@/, ':***@');
  console.log(`\n✅ USE THIS URL in Render SUPABASE_DB_URL:\n   ${safe}`);
  process.exit(0);
} else {
  console.error('\n❌ No working connection found.');
  process.exit(1);
}
