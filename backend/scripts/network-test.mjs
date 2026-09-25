/**
 * network-test.mjs — Production database pre-flight check.
 *
 * Tests the exact endpoint configured in SUPABASE_DB_URL using a real
 * PostgreSQL connection (not just DNS / TCP ping).  Resolves the hostname
 * to IPv4 first so the test mirrors exactly what the application does at
 * runtime on Render.
 *
 * Exits 0 on success, 1 on failure.  Never prints credentials.
 */
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { buildPgConfig } from '../src/lib/resolve-db-url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

async function main() {
  const databaseUrl = process.env.SUPABASE_DB_URL;

  if (!databaseUrl) {
    console.error('[network-test] ❌ SUPABASE_DB_URL is not configured');
    process.exit(1);
  }

  // Log the endpoint without credentials
  try {
    const u = new URL(databaseUrl);
    const connType = u.hostname.includes('pooler') ? 'POOLER' : 'DIRECT';
    console.log(`[network-test] Supabase endpoint: ${u.hostname}:${u.port || 5432} (${connType})`);
  } catch {
    console.log('[network-test] Testing configured SUPABASE_DB_URL...');
  }

  let pgConfig;
  try {
    pgConfig = await buildPgConfig(databaseUrl, { connectionTimeoutMillis: 15000 });
  } catch (err) {
    console.error(`[network-test] ❌ Failed to build connection config: ${err.message}`);
    process.exit(1);
  }

  const client = new pg.Client(pgConfig);

  try {
    await client.connect();
    const result = await client.query(
      "SELECT COUNT(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableCount = result.rows[0].tables;
    await client.end();

    console.log(`[network-test] ✅ Connected successfully`);
    console.log(`[network-test] ✅ Schema has ${tableCount} tables`);
    console.log('[network-test] ✅ Network pre-flight PASSED');
    process.exit(0);

  } catch (err) {
    await client.end().catch(() => {});
    console.error(`[network-test] ❌ Cannot reach database: ${err.message}`);
    console.error(`[network-test] ❌ Network pre-flight FAILED — aborting startup`);

    // Actionable guidance for the most common failure modes
    if (err.message.includes('ENETUNREACH') || err.message.includes('ENOTFOUND')) {
      console.error('[network-test] HINT: The configured SUPABASE_DB_URL resolves to IPv6 only.');
      console.error('[network-test] HINT: Render free tier has no outbound IPv6. Use the Supabase');
      console.error('[network-test] HINT: Connection Pooler URL from your Supabase Dashboard:');
      console.error('[network-test] HINT:   Dashboard → Settings → Database → Connection Pooling');
      console.error('[network-test] HINT:   Copy the "Transaction pooler" connection string and');
      console.error('[network-test] HINT:   set it as SUPABASE_DB_URL in your Render environment.');
    }
    process.exit(1);
  }
}

main();
