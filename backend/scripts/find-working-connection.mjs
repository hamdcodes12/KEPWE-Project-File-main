/**
 * Systematically tests all Supabase connection formats to find which one
 * works from this environment. Output is safe - never logs passwords.
 */
import dotenv from 'dotenv';
import pg from 'pg';
import dns from 'dns';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const { Client } = pg;
const lookup = promisify(dns.lookup);

// Extract components from the current env var WITHOUT printing the password
const rawUrl = process.env.SUPABASE_DB_URL;
if (!rawUrl) {
  console.error('SUPABASE_DB_URL not set');
  process.exit(1);
}

let password;
try {
  const u = new URL(rawUrl);
  password = u.password;
} catch (e) {
  console.error('Cannot parse SUPABASE_DB_URL:', e.message);
  process.exit(1);
}

// Project ref is always in the direct hostname: db.PROJECT_REF.supabase.co
const PROJECT_REF = 'vzqjoncaupafwcdrktde';

// Build candidate connection strings without printing the password
const candidates = [
  {
    label: 'Transaction pooler (port 6543, user = postgres.ref)',
    url: `postgresql://postgres.${PROJECT_REF}:${password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
  },
  {
    label: 'Session pooler (port 5432, user = postgres.ref)',
    url: `postgresql://postgres.${PROJECT_REF}:${password}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  },
  {
    label: 'Direct host (port 5432)',
    url: `postgresql://postgres:${password}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  },
];

async function tryResolve(hostname) {
  try {
    const r = await lookup(hostname, { family: 4 });
    return r.address;
  } catch {
    return null;
  }
}

async function tryConnect(label, url) {
  const u = new URL(url);
  const ip = await tryResolve(u.hostname);
  console.log(`\n[test] Candidate: ${label}`);
  console.log(`[test]   host: ${u.hostname}:${u.port}`);
  console.log(`[test]   user: ${u.username}`);
  console.log(`[test]   dns:  ${ip || 'UNRESOLVABLE'}`);

  if (!ip) {
    console.log(`[test]   result: SKIP (DNS failed)`);
    return false;
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();
    const r = await client.query(
      "SELECT NOW() as t, COUNT(*)::int AS tables FROM information_schema.tables WHERE table_schema='public'"
    );
    console.log(`[test]   result: ✅ CONNECTED — ${r.rows[0].tables} tables`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`[test]   result: ❌ FAILED — ${err.message}`);
    await client.end().catch(() => {});
    return false;
  }
}

console.log('[find-connection] Searching for a working Supabase connection...');
let winningUrl = null;
let winningLabel = null;

for (const c of candidates) {
  const ok = await tryConnect(c.label, c.url);
  if (ok) {
    winningUrl = c.url;
    winningLabel = c.label;
    break;
  }
}

if (winningUrl) {
  // Print a safe version (mask the password)
  const safe = winningUrl.replace(/:([^@]+)@/, ':***@');
  console.log(`\n[find-connection] ✅ WORKING CONNECTION FOUND`);
  console.log(`[find-connection]   Strategy: ${winningLabel}`);
  console.log(`[find-connection]   Safe URL: ${safe}`);
  console.log(`\n[find-connection] Set SUPABASE_DB_URL in Render to the value above (with real password).`);
  process.exit(0);
} else {
  console.error('\n[find-connection] ❌ NO WORKING CONNECTION FOUND');
  console.error('[find-connection] Check Supabase project connectivity and credentials.');
  process.exit(1);
}
