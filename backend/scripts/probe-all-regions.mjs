/**
 * Try every AWS region Supabase operates in for the pooler.
 * Also try with plain 'postgres' user (some older projects use this).
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

const raw = process.env.SUPABASE_DB_URL;
if (!raw) { console.error('SUPABASE_DB_URL not set'); process.exit(1); }

const u = new URL(raw);
const rawPassword = decodeURIComponent(u.password);
const PROJECT_REF = 'vzqjoncaupafwcdrktde';
function enc(s) { return encodeURIComponent(s); }
const lookup = promisify(dns.lookup);

// All Supabase AWS regions
const regions = [
  'us-west-1', 'us-east-1', 'ap-south-1', 'ap-southeast-1',
  'ap-northeast-1', 'eu-west-1', 'eu-central-1', 'sa-east-1',
  'ca-central-1', 'ap-southeast-2'
];

// Build candidates: both postgres.REF and postgres user, both ports
const candidates = [];
for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  candidates.push({
    label: `${region} session (5432) user=postgres.ref`,
    url: `postgresql://postgres.${PROJECT_REF}:${enc(rawPassword)}@${host}:5432/postgres`,
    host, port: 5432
  });
  candidates.push({
    label: `${region} transaction (6543) user=postgres.ref`,
    url: `postgresql://postgres.${PROJECT_REF}:${enc(rawPassword)}@${host}:6543/postgres`,
    host, port: 6543
  });
}

async function resolve4(host) {
  try {
    const r = await lookup(host, { family: 4 });
    return r.address;
  } catch {
    return null;
  }
}

async function tryConnect(candidate) {
  const ip = await resolve4(candidate.host);
  if (!ip) {
    return { ok: false, error: 'DNS UNRESOLVABLE', safe: candidate.url.replace(/:([^@]+)@/, ':***@') };
  }

  const safe = candidate.url.replace(/:([^@]+)@/, ':***@');
  const client = new pg.Client({
    connectionString: candidate.url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    const r = await client.query(
      "SELECT COUNT(*)::int AS t FROM information_schema.tables WHERE table_schema='public'"
    );
    await client.end();
    return { ok: true, tables: r.rows[0].t, safe, label: candidate.label };
  } catch (err) {
    await client.end().catch(() => {});
    return { ok: false, error: err.message.split('\n')[0].slice(0, 80), safe };
  }
}

console.log(`Probing ${candidates.length} pooler endpoints across all Supabase regions...\n`);

for (const candidate of candidates) {
  const result = await tryConnect(candidate);
  if (result.ok) {
    console.log(`\n✅ WORKING POOLER FOUND!`);
    console.log(`   Label: ${result.label}`);
    console.log(`   URL:   ${result.safe}`);
    console.log(`   Tables: ${result.tables}`);
    process.exit(0);
  } else {
    // Only print non-DNS failures (DNS failures are expected for wrong regions)
    if (!result.error.includes('DNS')) {
      console.log(`${candidate.label}: ${result.error}`);
    }
  }
}

console.log('\n❌ No pooler endpoint found across all regions.');
console.log('The Supabase project may need the IPv4 add-on or the pooler is disabled.');
console.log('Check: https://supabase.com/dashboard/project/vzqjoncaupafwcdrktde/settings/database');
process.exit(1);
