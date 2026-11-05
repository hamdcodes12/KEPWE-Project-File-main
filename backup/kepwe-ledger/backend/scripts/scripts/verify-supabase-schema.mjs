import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });
dotenv.config();

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error('Supabase database URL is not configured');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  const result = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')::int AS tables,
      (SELECT COUNT(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e')::int AS enums,
      (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f')::int AS functions,
      (SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal)::int AS triggers,
      (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public')::int AS policies,
      (SELECT COUNT(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity)::int AS rls_tables,
      (SELECT COUNT(*) FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace)::int AS foreign_keys,
      (SELECT COUNT(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('i', 'I'))::int AS indexes
  `);
  console.log(JSON.stringify(result.rows[0]));
} finally {
  await client.end().catch(() => {});
}