import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });
dotenv.config();

const configuredUrl = process.env.SUPABASE_DB_URL;

if (!configuredUrl) {
  console.error('[supabase-check] No Supabase database URL configured.');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(configuredUrl);
} catch (error) {
  console.error(`[supabase-check] Invalid Supabase database URL: ${error.message}`);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: configuredUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  await client.connect();
  const result = await client.query(`
    SELECT current_database() AS database,
           current_user AS user,
           current_setting('server_version') AS server_version
  `);
  console.log(JSON.stringify({
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.slice(1),
    connected: result.rows[0],
  }));
} catch (error) {
  console.error(JSON.stringify({
    host: parsed.hostname,
    code: error.code,
    message: error.message,
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}