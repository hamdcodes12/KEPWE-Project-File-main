-- ============================================================================
-- KEPWE Quant Subscription System — Full Migration
-- Tables: subscription_plans, user_subscriptions, subscription_payments,
--         subscription_audit_log
-- Stored Functions: has_feature_access, get_user_plan_features,
--                   get_user_plan_limits, expire_trials, expire_subscriptions
-- Seed: TRIAL / BASIC / PRO / ELITE plans with feature entitlements
--
-- Idempotent: uses IF NOT EXISTS / DO-EXCEPTION guards throughout.
-- Safe to re-run on an already-migrated database.
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE quant_subscription_status AS ENUM (
    'trial',       -- free 7-day trial active
    'active',      -- paid subscription active
    'expired',     -- trial expired, no paid plan
    'cancelled',   -- user cancelled paid subscription
    'suspended'    -- admin-suspended
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quant_payment_status AS ENUM (
    'pending',    -- order created, awaiting payment
    'succeeded',  -- payment verified and subscription activated
    'failed',     -- payment attempt failed
    'cancelled',  -- user closed checkout
    'refunded'    -- refund issued
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLE: subscription_plans
-- Single source of truth for plan config, features, limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code       VARCHAR(20) NOT NULL UNIQUE,   -- 'TRIAL', 'BASIC', 'PRO', 'ELITE'
  plan_name       VARCHAR(100) NOT NULL,
  display_name    VARCHAR(150) NOT NULL,
  description     TEXT,
  price_inr       NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_period  VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'trial','monthly','quarterly','yearly'
  trial_days      INTEGER NOT NULL DEFAULT 0,
  -- Feature flags JSONB: key = feature_key, value = true/false
  features        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Limits JSONB: key = limit_key, value = integer (-1 = unlimited)
  limits          JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_plans_code   ON subscription_plans (plan_code);
CREATE INDEX IF NOT EXISTS idx_sub_plans_active ON subscription_plans (is_active, display_order);

-- ============================================================================
-- TABLE: user_subscriptions
-- One row per user — the authoritative subscription record
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id                 UUID NOT NULL REFERENCES subscription_plans(id),
  status                  quant_subscription_status NOT NULL DEFAULT 'trial',

  -- Trial window (populated for every new user)
  trial_start_at          TIMESTAMPTZ,
  trial_end_at            TIMESTAMPTZ,
  is_trial_used           BOOLEAN NOT NULL DEFAULT FALSE,

  -- Paid subscription window
  subscription_start_at   TIMESTAMPTZ,
  subscription_end_at     TIMESTAMPTZ,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,

  -- Billing
  next_payment_at         TIMESTAMPTZ,
  auto_renew              BOOLEAN NOT NULL DEFAULT TRUE,
  cancellation_reason     TEXT,
  cancelled_at            TIMESTAMPTZ,

  -- Admin
  suspended_at            TIMESTAMPTZ,
  suspended_reason        TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sub_user    ON user_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sub_status  ON user_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_user_sub_trial_end ON user_subscriptions (trial_end_at)
  WHERE status = 'trial';
CREATE INDEX IF NOT EXISTS idx_user_sub_sub_end  ON user_subscriptions (subscription_end_at)
  WHERE status = 'active';

-- RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS user_subscriptions_owner ON user_subscriptions;
  CREATE POLICY user_subscriptions_owner ON user_subscriptions
    FOR ALL USING (
      user_id = current_setting('app.current_user_id', true)::uuid
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLE: subscription_payments
-- Every Razorpay order attempt (idempotent — deduped by razorpay_order_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id       UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  plan_id               UUID NOT NULL REFERENCES subscription_plans(id),
  payment_gateway       VARCHAR(30) NOT NULL DEFAULT 'razorpay',
  order_id              VARCHAR(120),
  razorpay_order_id     VARCHAR(120) UNIQUE,
  razorpay_payment_id   VARCHAR(120),
  razorpay_signature    TEXT,
  amount_inr            NUMERIC(10,2) NOT NULL,
  currency              VARCHAR(10) NOT NULL DEFAULT 'INR',
  status                quant_payment_status NOT NULL DEFAULT 'pending',
  payment_method        VARCHAR(50),
  payment_email         VARCHAR(255),
  payment_contact       VARCHAR(30),
  failure_reason        TEXT,
  paid_at               TIMESTAMPTZ,
  webhook_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_verified_at   TIMESTAMPTZ,
  -- Idempotency: prevent duplicate webhook processing
  idempotency_key       VARCHAR(200) UNIQUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_user     ON subscription_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_order    ON subscription_payments (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status   ON subscription_payments (status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_created  ON subscription_payments (created_at DESC);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  DROP POLICY IF EXISTS subscription_payments_owner ON subscription_payments;
  CREATE POLICY subscription_payments_owner ON subscription_payments
    FOR ALL USING (
      user_id = current_setting('app.current_user_id', true)::uuid
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLE: subscription_audit_log
-- Immutable trail of every subscription state change
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  event_type        VARCHAR(60) NOT NULL,     -- 'trial_activated','plan_upgraded', etc.
  event_description TEXT,
  old_status        VARCHAR(30),
  new_status        VARCHAR(30),
  old_plan_code     VARCHAR(20),
  new_plan_code     VARCHAR(20),
  performed_by      VARCHAR(40) DEFAULT 'system',  -- 'system','user','admin'
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_audit_user    ON subscription_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_audit_event   ON subscription_audit_log (event_type);

-- ============================================================================
-- STORED FUNCTION: has_feature_access(user_id, feature_key)
-- Returns TRUE if user's current plan grants access to the feature
-- ============================================================================

CREATE OR REPLACE FUNCTION has_feature_access(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_features JSONB;
  v_status   TEXT;
  v_trial_end TIMESTAMPTZ;
  v_sub_end   TIMESTAMPTZ;
BEGIN
  -- Get user subscription + plan features in one query
  SELECT
    sp.features,
    us.status,
    us.trial_end_at,
    us.subscription_end_at
  INTO v_features, v_status, v_trial_end, v_sub_end
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id;

  -- No subscription = no access
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Expired trial = no access
  IF v_status = 'trial' AND (v_trial_end IS NULL OR v_trial_end < NOW()) THEN
    RETURN FALSE;
  END IF;

  -- Expired/cancelled/suspended = no access
  IF v_status IN ('expired', 'suspended') THEN
    RETURN FALSE;
  END IF;

  -- Cancelled paid subscription after end date = no access to premium
  IF v_status = 'cancelled' AND v_sub_end IS NOT NULL AND v_sub_end < NOW() THEN
    RETURN FALSE;
  END IF;

  -- Check feature flag in plan's JSONB
  RETURN COALESCE((v_features ->> p_feature_key)::BOOLEAN, FALSE);
END;
$$;

-- ============================================================================
-- STORED FUNCTION: get_user_plan_features(user_id)
-- Returns full JSONB features map for user's current plan
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_plan_features(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_features JSONB;
  v_status   TEXT;
  v_trial_end TIMESTAMPTZ;
  v_sub_end   TIMESTAMPTZ;
BEGIN
  SELECT
    sp.features,
    us.status,
    us.trial_end_at,
    us.subscription_end_at
  INTO v_features, v_status, v_trial_end, v_sub_end
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  -- If subscription not active, return empty
  IF v_status = 'trial' AND (v_trial_end IS NULL OR v_trial_end < NOW()) THEN
    RETURN '{}'::jsonb;
  END IF;

  IF v_status IN ('expired', 'suspended') THEN
    RETURN '{}'::jsonb;
  END IF;

  IF v_status = 'cancelled' AND v_sub_end IS NOT NULL AND v_sub_end < NOW() THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN COALESCE(v_features, '{}'::jsonb);
END;
$$;

-- ============================================================================
-- STORED FUNCTION: get_user_plan_limits(user_id)
-- Returns full JSONB limits map for user's current plan
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_plan_limits(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_limits    JSONB;
  v_status    TEXT;
  v_trial_end TIMESTAMPTZ;
  v_sub_end   TIMESTAMPTZ;
BEGIN
  SELECT
    sp.limits,
    us.status,
    us.trial_end_at,
    us.subscription_end_at
  INTO v_limits, v_status, v_trial_end, v_sub_end
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  IF v_status = 'trial' AND (v_trial_end IS NULL OR v_trial_end < NOW()) THEN
    RETURN '{}'::jsonb;
  END IF;

  IF v_status IN ('expired', 'suspended') THEN
    RETURN '{}'::jsonb;
  END IF;

  IF v_status = 'cancelled' AND v_sub_end IS NOT NULL AND v_sub_end < NOW() THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN COALESCE(v_limits, '{}'::jsonb);
END;
$$;

-- ============================================================================
-- STORED FUNCTION: expire_trials()
-- Marks all overdue trial subscriptions as 'expired'. Cron-safe.
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'trial'
    AND trial_end_at IS NOT NULL
    AND trial_end_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- STORED FUNCTION: expire_subscriptions()
-- Marks overdue active paid subscriptions as 'expired'. Cron-safe.
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND subscription_end_at IS NOT NULL
    AND subscription_end_at < NOW()
    AND auto_renew = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- SEED: subscription_plans
-- Upsert so re-runs don't fail. Prices in INR.
-- Feature keys match FEATURES constants in feature-gate.js
-- ============================================================================

INSERT INTO subscription_plans
  (plan_code, plan_name, display_name, description, price_inr, billing_period,
   trial_days, features, limits, is_active, display_order)
VALUES

-- ── FREE TRIAL ──────────────────────────────────────────────────────────────
(
  'TRIAL',
  'Free Trial',
  '7-Day Free Trial',
  'Get started with KEPWE Quant — no credit card required. Full access to core features for 7 days.',
  0,
  'trial',
  7,
  '{
    "dashboard": true,
    "markets": true,
    "pulse": true,
    "watchlists": true,
    "option_chain": true,
    "pnl_analytics": true,
    "risk_management": true,
    "alerts": true,
    "reports": true,
    "broker_connections": true,
    "account_settings": true,
    "strategy_builder": true,
    "backtesting": true,
    "advanced_option_chain": false,
    "algo_strategies": false,
    "advanced_backtesting": false,
    "advanced_risk": false,
    "trading_desk": false,
    "advanced_alerts": false,
    "advanced_reports": false,
    "live_execution": false
  }'::jsonb,
  '{
    "strategies": 1,
    "backtests_per_day": 3,
    "alerts": 5,
    "watchlist_symbols": 10,
    "brokers": 1,
    "reports_history_days": 7
  }'::jsonb,
  true,
  0
),

-- ── BASIC ───────────────────────────────────────────────────────────────────
(
  'BASIC',
  'Basic',
  'Basic Plan',
  'Essential tools for individual traders getting started with systematic strategies.',
  2999,
  'monthly',
  0,
  '{
    "dashboard": true,
    "markets": true,
    "pulse": true,
    "watchlists": true,
    "option_chain": true,
    "pnl_analytics": true,
    "risk_management": true,
    "alerts": true,
    "reports": true,
    "broker_connections": true,
    "account_settings": true,
    "strategy_builder": true,
    "backtesting": true,
    "advanced_option_chain": false,
    "algo_strategies": true,
    "advanced_backtesting": false,
    "advanced_risk": false,
    "trading_desk": false,
    "advanced_alerts": false,
    "advanced_reports": false,
    "live_execution": true
  }'::jsonb,
  '{
    "strategies": 3,
    "backtests_per_day": 10,
    "alerts": 20,
    "watchlist_symbols": 50,
    "brokers": 2,
    "reports_history_days": 30
  }'::jsonb,
  true,
  1
),

-- ── PRO ─────────────────────────────────────────────────────────────────────
(
  'PRO',
  'Pro',
  'Pro Plan',
  'Advanced quantitative tools for serious traders. Full backtesting, advanced analytics, and live execution.',
  6999,
  'monthly',
  0,
  '{
    "dashboard": true,
    "markets": true,
    "pulse": true,
    "watchlists": true,
    "option_chain": true,
    "pnl_analytics": true,
    "risk_management": true,
    "alerts": true,
    "reports": true,
    "broker_connections": true,
    "account_settings": true,
    "strategy_builder": true,
    "backtesting": true,
    "advanced_option_chain": true,
    "algo_strategies": true,
    "advanced_backtesting": true,
    "advanced_risk": true,
    "trading_desk": true,
    "advanced_alerts": true,
    "advanced_reports": true,
    "live_execution": true
  }'::jsonb,
  '{
    "strategies": 10,
    "backtests_per_day": -1,
    "alerts": 100,
    "watchlist_symbols": 200,
    "brokers": 2,
    "reports_history_days": 180
  }'::jsonb,
  true,
  2
),

-- ── ELITE ───────────────────────────────────────────────────────────────────
(
  'ELITE',
  'Elite',
  'Elite / Advanced Plan',
  'Unlimited access for professional quant traders and institutions. Priority support included.',
  14999,
  'monthly',
  0,
  '{
    "dashboard": true,
    "markets": true,
    "pulse": true,
    "watchlists": true,
    "option_chain": true,
    "pnl_analytics": true,
    "risk_management": true,
    "alerts": true,
    "reports": true,
    "broker_connections": true,
    "account_settings": true,
    "strategy_builder": true,
    "backtesting": true,
    "advanced_option_chain": true,
    "algo_strategies": true,
    "advanced_backtesting": true,
    "advanced_risk": true,
    "trading_desk": true,
    "advanced_alerts": true,
    "advanced_reports": true,
    "live_execution": true
  }'::jsonb,
  '{
    "strategies": -1,
    "backtests_per_day": -1,
    "alerts": -1,
    "watchlist_symbols": -1,
    "brokers": 5,
    "reports_history_days": -1
  }'::jsonb,
  true,
  3
)

ON CONFLICT (plan_code) DO UPDATE SET
  plan_name      = EXCLUDED.plan_name,
  display_name   = EXCLUDED.display_name,
  description    = EXCLUDED.description,
  price_inr      = EXCLUDED.price_inr,
  billing_period = EXCLUDED.billing_period,
  trial_days     = EXCLUDED.trial_days,
  features       = EXCLUDED.features,
  limits         = EXCLUDED.limits,
  is_active      = EXCLUDED.is_active,
  display_order  = EXCLUDED.display_order,
  updated_at     = NOW();

-- ============================================================================
-- MIGRATE EXISTING USERS: give them a subscription record
-- New eligible users → trial
-- Users with existing paid plan record → active
-- This is additive and only touches users with no user_subscriptions row yet.
-- ============================================================================

-- Step 1: Insert TRIAL subscription for users who have no subscription yet
-- and were created recently (within 7 days) — they get a fresh trial.
-- Existing older users without a subscription also get trial but their
-- trial_end_at is set based on account creation date + 7 days,
-- which may already be in the past (expired), protecting against abuse.
INSERT INTO user_subscriptions (
  user_id, plan_id, status,
  trial_start_at, trial_end_at, is_trial_used
)
SELECT
  u.id,
  sp.id,
  CASE
    WHEN u.created_at + INTERVAL '7 days' > NOW() THEN 'trial'::quant_subscription_status
    ELSE 'expired'::quant_subscription_status
  END,
  u.created_at,
  u.created_at + INTERVAL '7 days',
  TRUE
FROM users u
CROSS JOIN subscription_plans sp
WHERE sp.plan_code = 'TRIAL'
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions us WHERE us.user_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM subscriptions s
    JOIN plans old_plan ON old_plan.id = s.plan_id
    WHERE s.user_id = u.id
      AND s.status = 'active'
      AND old_plan.name NOT IN ('Free Trial')
  )
  -- Do not migrate admin/staff roles with a trial
  AND u.role = 'customer'
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Existing users with a paid subscription in the old 'subscriptions' table
-- → give them a PRO active subscription
INSERT INTO user_subscriptions (
  user_id, plan_id, status,
  subscription_start_at, subscription_end_at,
  current_period_start, current_period_end,
  is_trial_used, auto_renew
)
SELECT
  s.user_id,
  sp.id,
  'active'::quant_subscription_status,
  s.created_at,
  COALESCE(s.renews_on::TIMESTAMPTZ, NOW() + INTERVAL '30 days'),
  s.created_at,
  COALESCE(s.renews_on::TIMESTAMPTZ, NOW() + INTERVAL '30 days'),
  TRUE,
  s.auto_renew
FROM subscriptions s
JOIN subscription_plans sp ON sp.plan_code = 'PRO'
WHERE s.status = 'active'
  AND s.plan_id IN (
    SELECT id FROM plans WHERE name NOT IN ('Free Trial')
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions us WHERE us.user_id = s.user_id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Admin/staff users get ELITE active (no expiry) so they are never blocked
INSERT INTO user_subscriptions (
  user_id, plan_id, status,
  subscription_start_at, is_trial_used, auto_renew
)
SELECT
  u.id,
  sp.id,
  'active'::quant_subscription_status,
  u.created_at,
  TRUE,
  FALSE
FROM users u
CROSS JOIN subscription_plans sp
WHERE sp.plan_code = 'ELITE'
  AND u.role IN ('admin', 'sales_agent', 'accountant', 'cfo')
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions us WHERE us.user_id = u.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- AUDIT LOG SEED: record the migration event for traceability
-- ============================================================================

INSERT INTO subscription_audit_log (
  user_id, event_type, event_description, new_status, performed_by, metadata
)
SELECT
  us.user_id,
  'migration_applied',
  'Subscription record created during quant_subscription_system migration',
  us.status::text,
  'system',
  jsonb_build_object('migration', 'quant_subscription_system.sql', 'applied_at', NOW())
FROM user_subscriptions us
WHERE NOT EXISTS (
  SELECT 1 FROM subscription_audit_log sal
  WHERE sal.user_id = us.user_id
    AND sal.event_type = 'migration_applied'
);

COMMIT;
