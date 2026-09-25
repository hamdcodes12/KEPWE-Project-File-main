import dotenv from 'dotenv';
import pg from 'pg';
import dns from 'dns';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const lookup = promisify(dns.lookup);

// Extract password from current SUPABASE_DB_URL without printing it
const raw = process.env.SUPABASE_DB_URL;
if (!raw) { console.error('SUPABASE_DB_URL not set'); process.exit(1); }
const rawPassword = decodeURIComponent(new URL(raw).password);

const ref  = 'vzqjoncaupafwcdrktde';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';

async function run() {
  // 1. IPv4 DNS
  const ipv4 = await lookup(host, { family: 4 }).then(r => r.address).catch(() => null);
  console.log(`[test] Host:  ${host}`);
  console.log(`[test] IPv4:  ${ipv4 || 'UNRESOLVABLE'}`);

  if (!ipv4) {
    console.error('[test] ❌ No IPv4 address for this pooler endpoint');
    process.exit(1);
  }

  // 2. Session pooler port 5432
  const url5432 = `postgresql://postgres.${ref}:${encodeURIComponent(rawPassword)}@${host}:5432/postgres`;
  const safe5432 = url5432.replace(/:([^@]+)@/, ':***@');
  console.log(`\n[test] Trying session pooler (port 5432): ${safe5432}`);

  const c5 = new pg.Client({ connectionString: url5432, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await c5.connect();
    const r = await c5.query("SELECT COUNT(*)::int AS t FROM information_schema.tables WHERE table_schema='public'");
    console.log(`[test] ✅ PORT 5432 CONNECTED — ${r.rows[0].t} tables`);
    await c5.end();
  } catch (e) {
    console.log(`[test] ❌ Port 5432 failed: ${e.message.split('\n')[0]}`);
    await c5.end().catch(() => {});
  }

  // 3. Transaction pooler port 6543
  const url6543 = `postgresql://postgres.${ref}:${encodeURIComponent(rawPassword)}@${host}:6543/postgres`;
  const safe6543 = url6543.replace(/:([^@]+)@/, ':***@');
  console.log(`\n[test] Trying transaction pooler (port 6543): ${safe6543}`);

  const c6 = new pg.Client({ connectionString: url6543, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    await c6.connect();
    const r = await c6.query("SELECT COUNT(*)::int AS t FROM information_schema.tables WHERE table_schema='public'");
    console.log(`[test] ✅ PORT 6543 CONNECTED — ${r.rows[0].t} tables`);
    await c6.end();
  } catch (e) {
    console.log(`[test] ❌ Port 6543 failed: ${e.message.split('\n')[0]}`);
    await c6.end().catch(() => {});
  }
}

run();
