BEGIN;

CREATE TABLE IF NOT EXISTS ledger_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(20) NOT NULL,
  billing_period VARCHAR(10) NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
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
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  billing_period VARCHAR(10) NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_subscriptions_plan ON ledger_subscriptions(plan_id, status);

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
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  failure_reason TEXT,
  paid_at TIMESTAMPTZ,
  webhook_event_id VARCHAR(120) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_subscription_payments_user ON ledger_subscription_payments(user_id, created_at DESC);

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

ALTER TABLE ledger_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_ai_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY ledger_plans_read_active ON ledger_plans FOR SELECT USING (is_active = TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ledger_subscriptions_owner ON ledger_subscriptions FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ledger_subscription_payments_owner ON ledger_subscription_payments FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ledger_ai_usage_owner ON ledger_ai_usage FOR ALL
    USING (user_id = current_setting('app.current_user_id', true)::uuid)
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO ledger_plans (plan_code, billing_period, display_name, price_inr, features, limits, display_order)
VALUES
  ('FREE', 'monthly', 'Free', 0, '{
    "manual_upi": true, "basic_ai_expense_analysis": true, "monthly_budget": true,
    "income_expense_tracking": true, "basic_net_worth": true, "monthly_dashboard": true,
    "spending_trends": true, "savings_rate": true, "unnecessary_expense_identification": true,
    "basic_alerts": true, "ai_personal_cfo": false, "personalized_recommendations": false,
    "affordability_analysis": false, "cash_flow_forecasting": false, "expense_forecasting": false,
    "savings_forecasting": false, "recurring_expense_detection": false, "spending_spike_alerts": false,
    "budget_breach_alerts": false, "low_balance_alerts": false, "unusual_transaction_alerts": false,
    "emergency_fund_planning": false, "debt_repayment_planning": false, "financial_planning": false,
    "advanced_reports": false, "report_export": false, "advanced_ai_cfo": false,
    "personalized_financial_strategy": false, "monthly_cfo_reviews": false, "quarterly_cfo_reviews": false,
    "ai_financial_roadmap": false, "scenario_planning": false, "advanced_wealth_dashboard": false,
    "asset_tracking": false, "liability_tracking": false, "investment_tracking": false,
    "insurance_tracking": false, "loan_tracking": false, "retirement_planning": false,
    "home_planning": false, "education_planning": false, "travel_planning": false,
    "fire_planning": false, "custom_dashboards": false, "priority_support": false
  }'::jsonb, '{"bank_accounts": 2, "savings_goals": 3, "ai_insights_monthly": 50, "history_months": 6}'::jsonb, 0),
  ('PRO', 'monthly', 'Pro', 149, '{
    "manual_upi": true, "basic_ai_expense_analysis": true, "monthly_budget": true,
    "income_expense_tracking": true, "basic_net_worth": true, "monthly_dashboard": true,
    "spending_trends": true, "savings_rate": true, "unnecessary_expense_identification": true,
    "basic_alerts": true, "ai_personal_cfo": true, "personalized_recommendations": true,
    "affordability_analysis": true, "cash_flow_forecasting": true, "expense_forecasting": true,
    "savings_forecasting": true, "recurring_expense_detection": true, "spending_spike_alerts": true,
    "budget_breach_alerts": true, "low_balance_alerts": true, "unusual_transaction_alerts": true,
    "emergency_fund_planning": true, "debt_repayment_planning": true, "financial_planning": true,
    "advanced_reports": true, "report_export": true, "advanced_ai_cfo": false,
    "personalized_financial_strategy": false, "monthly_cfo_reviews": false, "quarterly_cfo_reviews": false,
    "ai_financial_roadmap": false, "scenario_planning": false, "advanced_wealth_dashboard": false,
    "asset_tracking": false, "liability_tracking": false, "investment_tracking": false,
    "insurance_tracking": false, "loan_tracking": false, "retirement_planning": false,
    "home_planning": false, "education_planning": false, "travel_planning": false,
    "fire_planning": false, "custom_dashboards": false, "priority_support": false
  }'::jsonb, '{"bank_accounts": -1, "savings_goals": -1, "ai_insights_monthly": -1, "history_months": 24}'::jsonb, 1),
  ('PRO_PLUS', 'monthly', 'Pro+', 299, '{
    "manual_upi": true, "basic_ai_expense_analysis": true, "monthly_budget": true,
    "income_expense_tracking": true, "basic_net_worth": true, "monthly_dashboard": true,
    "spending_trends": true, "savings_rate": true, "unnecessary_expense_identification": true,
    "basic_alerts": true, "ai_personal_cfo": true, "personalized_recommendations": true,
    "affordability_analysis": true, "cash_flow_forecasting": true, "expense_forecasting": true,
    "savings_forecasting": true, "recurring_expense_detection": true, "spending_spike_alerts": true,
    "budget_breach_alerts": true, "low_balance_alerts": true, "unusual_transaction_alerts": true,
    "emergency_fund_planning": true, "debt_repayment_planning": true, "financial_planning": true,
    "advanced_reports": true, "report_export": true, "advanced_ai_cfo": true,
    "personalized_financial_strategy": true, "monthly_cfo_reviews": true, "quarterly_cfo_reviews": true,
    "ai_financial_roadmap": true, "scenario_planning": true, "advanced_wealth_dashboard": true,
    "asset_tracking": true, "liability_tracking": true, "investment_tracking": true,
    "insurance_tracking": true, "loan_tracking": true, "retirement_planning": true,
    "home_planning": true, "education_planning": true, "travel_planning": true,
    "fire_planning": true, "custom_dashboards": true, "priority_support": true
  }'::jsonb, '{"bank_accounts": -1, "savings_goals": -1, "ai_insights_monthly": -1, "history_months": -1}'::jsonb, 2),
  ('PRO', 'yearly', 'Pro', 1499, '{}', '{}', 1),
  ('PRO_PLUS', 'yearly', 'Pro+', 2999, '{}', '{}', 2)
ON CONFLICT (plan_code, billing_period) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_inr = EXCLUDED.price_inr,
  features = CASE WHEN EXCLUDED.features = '{}'::jsonb THEN ledger_plans.features ELSE EXCLUDED.features END,
  limits = CASE WHEN EXCLUDED.limits = '{}'::jsonb THEN ledger_plans.limits ELSE EXCLUDED.limits END,
  is_active = TRUE,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

UPDATE ledger_plans yearly
SET features = monthly.features,
    limits = monthly.limits,
    updated_at = NOW()
FROM ledger_plans monthly
WHERE yearly.plan_code = monthly.plan_code
  AND yearly.billing_period = 'yearly'
  AND monthly.billing_period = 'monthly';

COMMIT;