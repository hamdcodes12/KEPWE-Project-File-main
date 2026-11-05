/**
 * seed-ledger-plans.mjs
 * Seeds / upserts the five Ledger plans into Supabase:
 *   FREE (monthly), PRO monthly & yearly, PRO_PLUS monthly & yearly
 * Prices and feature/limit matrix match the client-approved entitlement spec.
 *
 * Run: node backend/scripts/seed-ledger-plans.mjs
 */

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

/* ── Entitlement data ────────────────────────────────────────────────────── */

const FREE_FEATURES = {
  manual_upi: true,
  basic_ai_expense_analysis: true,
  monthly_budget: true,
  income_expense_tracking: true,
  basic_net_worth: true,
  monthly_dashboard: true,
  spending_trends: true,
  savings_rate: true,
  unnecessary_expense_identification: true,
  basic_alerts: true,
  // PRO features – off for FREE
  ai_personal_cfo: false,
  personalized_recommendations: false,
  affordability_analysis: false,
  cash_flow_forecasting: false,
  expense_forecasting: false,
  savings_forecasting: false,
  recurring_expense_detection: false,
  spending_spike_alerts: false,
  budget_breach_alerts: false,
  low_balance_alerts: false,
  unusual_transaction_alerts: false,
  emergency_fund_planning: false,
  debt_repayment_planning: false,
  financial_planning: false,
  advanced_reports: false,
  report_export: false,
  // PRO+ features – off for FREE
  advanced_ai_cfo: false,
  personalized_financial_strategy: false,
  monthly_cfo_reviews: false,
  quarterly_cfo_reviews: false,
  ai_financial_roadmap: false,
  scenario_planning: false,
  advanced_wealth_dashboard: false,
  asset_tracking: false,
  liability_tracking: false,
  investment_tracking: false,
  insurance_tracking: false,
  loan_tracking: false,
  retirement_planning: false,
  home_planning: false,
  education_planning: false,
  travel_planning: false,
  fire_planning: false,
  custom_dashboards: false,
  priority_support: false,
};

const FREE_LIMITS = {
  bank_accounts: 2,
  savings_goals: 3,
  ai_insights_monthly: 50,
  history_months: 6,
};

const PRO_FEATURES = {
  ...FREE_FEATURES,
  // PRO overrides
  ai_personal_cfo: true,
  personalized_recommendations: true,
  affordability_analysis: true,
  cash_flow_forecasting: true,
  expense_forecasting: true,
  savings_forecasting: true,
  recurring_expense_detection: true,
  spending_spike_alerts: true,
  budget_breach_alerts: true,
  low_balance_alerts: true,
  unusual_transaction_alerts: true,
  emergency_fund_planning: true,
  debt_repayment_planning: true,
  financial_planning: true,
  advanced_reports: true,
  report_export: true,
};

const PRO_LIMITS = {
  bank_accounts: -1,
  savings_goals: -1,
  ai_insights_monthly: -1,
  history_months: 24,
};

const PRO_PLUS_FEATURES = {
  ...PRO_FEATURES,
  // PRO+ overrides
  advanced_ai_cfo: true,
  personalized_financial_strategy: true,
  monthly_cfo_reviews: true,
  quarterly_cfo_reviews: true,
  ai_financial_roadmap: true,
  scenario_planning: true,
  advanced_wealth_dashboard: true,
  asset_tracking: true,
  liability_tracking: true,
  investment_tracking: true,
  insurance_tracking: true,
  loan_tracking: true,
  retirement_planning: true,
  home_planning: true,
  education_planning: true,
  travel_planning: true,
  fire_planning: true,
  custom_dashboards: true,
  priority_support: true,
};

const PRO_PLUS_LIMITS = {
  bank_accounts: -1,
  savings_goals: -1,
  ai_insights_monthly: -1,
  history_months: -1,
};

const PLANS = [
  {
    plan_code: 'FREE',
    billing_period: 'monthly',
    display_name: 'Free',
    price_inr: 0,
    features: FREE_FEATURES,
    limits: FREE_LIMITS,
    display_order: 0,
  },
  {
    plan_code: 'PRO',
    billing_period: 'monthly',
    display_name: 'Pro',
    price_inr: 149,
    features: PRO_FEATURES,
    limits: PRO_LIMITS,
    display_order: 1,
  },
  {
    plan_code: 'PRO',
    billing_period: 'yearly',
    display_name: 'Pro',
    price_inr: 1499,
    features: PRO_FEATURES,
    limits: PRO_LIMITS,
    display_order: 1,
  },
  {
    plan_code: 'PRO_PLUS',
    billing_period: 'monthly',
    display_name: 'Pro+',
    price_inr: 299,
    features: PRO_PLUS_FEATURES,
    limits: PRO_PLUS_LIMITS,
    display_order: 2,
  },
  {
    plan_code: 'PRO_PLUS',
    billing_period: 'yearly',
    display_name: 'Pro+',
    price_inr: 2999,
    features: PRO_PLUS_FEATURES,
    limits: PRO_PLUS_LIMITS,
    display_order: 2,
  },
];

/* ── Schema bootstrap (idempotent) ─────────────────────────────────────────── */

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ledger_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(20) NOT NULL,
  billing_period VARCHAR(10) NOT NULL CHECK (billing_period IN ('monthly','yearly')),
  display_name VARCHAR(40) NOT NULL,
  price_inr NUMERIC(10,2) NOT NULL CHECK (price_inr >= 0),
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_code, billing_period)
);

CREATE TABLE IF NOT EXISTS ledger_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES ledger_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  billing_period VARCHAR(10) NOT NULL CHECK (billing_period IN ('monthly','yearly')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES ledger_plans(id),
  subscription_id UUID REFERENCES ledger_subscriptions(id) ON DELETE SET NULL,
  razorpay_order_id VARCHAR(120) NOT NULL UNIQUE,
  razorpay_payment_id VARCHAR(120) UNIQUE,
  razorpay_signature TEXT,
  amount_inr NUMERIC(10,2) NOT NULL CHECK (amount_inr > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','refunded')),
  failure_reason TEXT,
  paid_at TIMESTAMPTZ,
  webhook_event_id VARCHAR(120) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_ai_usage (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, month_start)
);

CREATE TABLE IF NOT EXISTS ledger_subscription_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(120) NOT NULL UNIQUE,
  event_type VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/* ── Main ────────────────────────────────────────────────────────────────── */
async function main() {
  await client.connect();
  console.log('Connected to Supabase.');

  // Bootstrap tables (no-op if already exist)
  try {
    await client.query(SCHEMA_SQL);
    console.log('Tables ensured.');
  } catch (err) {
    console.warn('Schema bootstrap warning (continuing):', err.message);
  }

  // Upsert each plan
  for (const plan of PLANS) {
    const sql = `
      INSERT INTO ledger_plans
        (plan_code, billing_period, display_name, price_inr, features, limits, is_active, display_order)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, TRUE, $7)
      ON CONFLICT (plan_code, billing_period) DO UPDATE SET
        display_name  = EXCLUDED.display_name,
        price_inr     = EXCLUDED.price_inr,
        features      = EXCLUDED.features,
        limits        = EXCLUDED.limits,
        is_active     = TRUE,
        display_order = EXCLUDED.display_order,
        updated_at    = NOW()
    `;
    await client.query(sql, [
      plan.plan_code,
      plan.billing_period,
      plan.display_name,
      plan.price_inr,
      JSON.stringify(plan.features),
      JSON.stringify(plan.limits),
      plan.display_order,
    ]);
    console.log(`✓ Upserted ${plan.plan_code} (${plan.billing_period}) — ₹${plan.price_inr}`);
  }

  // Verify
  const result = await client.query(
    `SELECT plan_code, billing_period, display_name, price_inr,
            limits->>'bank_accounts' AS bank_accts,
            limits->>'history_months' AS history,
            limits->>'ai_insights_monthly' AS ai_insights
     FROM ledger_plans WHERE is_active = TRUE
     ORDER BY display_order, CASE billing_period WHEN 'monthly' THEN 0 ELSE 1 END`
  );
  console.log('\n── Seeded Ledger Plans ──────────────────────────────');
  console.table(result.rows);

  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
