import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: new URL('../../.env', import.meta.url) });
dotenv.config();

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error('Supabase database URL is not configured');

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
const tables = [
  'users', 'user_sessions', 'companies', 'product_memberships', 'subscriptions',
  'user_subscriptions', 'algo_settings', 'algo_strategies', 'algo_orders',
  'algo_positions', 'algo_trades', 'execution_events', 'broker_accounts',
  'broker_oauth_tokens', 'risk_profiles', 'risk_events', 'notifications',
  'payments', 'support_tickets', 'crm_leads', 'ledger_accounts',
  'ledger_transactions', 'ledger_receivables', 'ledger_payables',
];

try {
  await client.connect();
  const counts = {};
  for (const table of tables) {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM public."${table}"`);
    counts[table] = result.rows[0].count;
  }
  console.log(JSON.stringify(counts));
} finally {
  await client.end().catch(() => {});
}