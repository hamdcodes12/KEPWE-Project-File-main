-- ============================================================================
-- KEPWE Quant Subscription System Migration
-- Implements 7-day free trial + paid plan system with feature entitlements
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PLANS TABLE
-- Defines available subscription plans (TRIAL, BASIC, PRO, ELITE, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code               VARCHAR(50) NOT NULL UNIQUE,
    plan_name               VARCHAR(100) NOT NULL,
    display_name            VARCHAR(100) NOT NULL,
    description             TEXT,
    price_inr               DECIMAL(10, 2) NOT NULL DEFAULT 0,
    billing_period          VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('trial', 'monthly', 'quarterly', 'yearly')),
    trial_days              INTEGER NOT NULL DEFAULT 0,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    is_default_trial        BOOLEAN NOT NULL DEFAULT FALSE,
    display_order           INTEGER NOT NULL DEFAULT 0,
    features                JSONB NOT NULL DEFAULT '{}'::jsonb,
    limits                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_code 
    ON subscription_plans (plan_code) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active 
    ON subscription_plans (is_active, display_order);

-- Insert default plans
INSERT INTO subscription_plans (
    plan_code, plan_name, display_name, description, 
    price_inr, billing_period, trial_days, is_default_trial, display_order,
    features, limits
) VALUES 
(
    'TRIAL',
    'Free Trial',
    '7-Day Free Trial',
    'Full access to try out KEPWE Quant for 7 days',
    0,
    'trial',
    7,
    TRUE,
    1,
    '{
        "dashboard": true,
        "markets": true,
        "pulse": true,
        "watchlists": true,
        "option_chain": true,
        "advanced_option_chain": false,
        "strategy_builder": true,
        "algo_strategies": false,
        "backtesting": true,
        "advanced_backtesting": false,
        "pnl_analytics": true,
        "risk_management": true,
        "advanced_risk": false,
        "trading_desk": false,
        "alerts": true,
        "advanced_alerts": false,
        "reports": true,
        "advanced_reports": false,
        "live_execution": false,
        "broker_connections": true,
        "account_settings": true
    }'::jsonb,
    '{
        "strategies": 2,
        "backtests": 5,
        "alerts": 10,
        "watchlists": 3,
        "brokers": 1,
        "daily_trades": 10
    }'::jsonb
),
(
    'BASIC',
    'Basic',
    'Basic Plan',
    'Essential features for individual traders',
    999,
    'monthly',
    0,
    FALSE,
    2,
    '{
        "dashboard": true,
        "markets": true,
        "pulse": true,
        "watchlists": true,
        "option_chain": true,
        "advanced_option_chain": false,
        "strategy_builder": true,
        "algo_strategies": true,
        "backtesting": true,
        "advanced_backtesting": false,
        "pnl_analytics": true,
        "risk_management": true,
        "advanced_risk": false,
        "trading_desk": false,
        "alerts": true,
        "advanced_alerts": false,
        "reports": true,
        "advanced_reports": false,
        "live_execution": true,
        "broker_connections": true,
        "account_settings": true
    }'::jsonb,
    '{
        "strategies": 5,
        "backtests": 20,
        "alerts": 50,
        "watchlists": 10,
        "brokers": 2,
        "daily_trades": 50
    }'::jsonb
),
(
    'PRO',
    'Pro',
    'Pro Plan',
    'Advanced features for active traders',
    2999,
    'monthly',
    0,
    FALSE,
    3,
    '{
        "dashboard": true,
        "markets": true,
        "pulse": true,
        "watchlists": true,
        "option_chain": true,
        "advanced_option_chain": true,
        "strategy_builder": true,
        "algo_strategies": true,
        "backtesting": true,
        "advanced_backtesting": true,
        "pnl_analytics": true,
        "risk_management": true,
        "advanced_risk": true,
        "trading_desk": true,
        "alerts": true,
        "advanced_alerts": true,
        "reports": true,
        "advanced_reports": true,
        "live_execution": true,
        "broker_connections": true,
        "account_settings": true
    }'::jsonb,
    '{
        "strategies": 20,
        "backtests": 100,
        "alerts": 200,
        "watchlists": 50,
        "brokers": 5,
        "daily_trades": 200
    }'::jsonb
),
(
    'ELITE',
    'Elite',
    'Elite Plan',
    'Unlimited features for professional traders',
    9999,
    'monthly',
    0,
    FALSE,
    4,
    '{
        "dashboard": true,
        "markets": true,
        "pulse": true,
        "watchlists": true,
        "option_chain": true,
        "advanced_option_chain": true,
        "strategy_builder": true,
        "algo_strategies": true,
        "backtesting": true,
        "advanced_backtesting": true,
        "pnl_analytics": true,
        "risk_management": true,
        "advanced_risk": true,
        "trading_desk": true,
        "alerts": true,
        "advanced_alerts": true,
        "reports": true,
        "advanced_reports": true,
        "live_execution": true,
        "broker_connections": true,
        "account_settings": true
    }'::jsonb,
    '{
        "strategies": -1,
        "backtests": -1,
        "alerts": -1,
        "watchlists": -1,
        "brokers": -1,
        "daily_trades": -1
    }'::jsonb
)
ON CONFLICT (plan_code) DO NOTHING;

-- ============================================================================
-- 2. USER SUBSCRIPTIONS TABLE
-- Tracks each user's subscription status, plan, trial, and billing
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id                 UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    
    -- Subscription status
    status                  VARCHAR(30) NOT NULL DEFAULT 'trial' 
                            CHECK (status IN ('trial', 'active', 'expired', 'cancelled', 'suspended', 'pending')),
    
    -- Trial information
    trial_start_at          TIMESTAMPTZ,
    trial_end_at            TIMESTAMPTZ,
    is_trial_used           BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Subscription dates
    subscription_start_at   TIMESTAMPTZ,
    subscription_end_at     TIMESTAMPTZ,
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    
    -- Payment information
    last_payment_at         TIMESTAMPTZ,
    next_payment_at         TIMESTAMPTZ,
    
    -- Metadata
    auto_renew              BOOLEAN NOT NULL DEFAULT TRUE,
    cancellation_reason     TEXT,
    cancelled_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one active subscription per user
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user 
    ON user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status 
    ON user_subscriptions (status, subscription_end_at);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_expiry 
    ON user_subscriptions (trial_end_at) 
    WHERE status = 'trial' AND trial_end_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_renewal 
    ON user_subscriptions (next_payment_at) 
    WHERE status = 'active' AND auto_renew = TRUE;

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own subscription
CREATE POLICY user_subscriptions_owner 
    ON user_subscriptions 
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- ============================================================================
-- 3. PAYMENTS TABLE
-- Records all payment transactions for subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id         UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    plan_id                 UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    
    -- Payment gateway details
    payment_gateway         VARCHAR(30) NOT NULL DEFAULT 'razorpay',
    payment_id              VARCHAR(100) UNIQUE,
    order_id                VARCHAR(100),
    razorpay_order_id       VARCHAR(100),
    razorpay_payment_id     VARCHAR(100),
    razorpay_signature      VARCHAR(255),
    
    -- Amount information
    amount_inr              DECIMAL(10, 2) NOT NULL,
    currency                VARCHAR(10) NOT NULL DEFAULT 'INR',
    
    -- Payment status
    status                  VARCHAR(30) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
    
    -- Payment metadata
    payment_method          VARCHAR(50),
    payment_email           VARCHAR(255),
    payment_contact         VARCHAR(20),
    failure_reason          TEXT,
    
    -- Timestamps
    paid_at                 TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Webhook processing
    webhook_verified        BOOLEAN NOT NULL DEFAULT FALSE,
    webhook_verified_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_user 
    ON subscription_payments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription 
    ON subscription_payments (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_razorpay_order 
    ON subscription_payments (razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_razorpay_payment 
    ON subscription_payments (razorpay_payment_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_status 
    ON subscription_payments (status, created_at DESC);

-- Enable RLS
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own payments
CREATE POLICY subscription_payments_owner 
    ON subscription_payments 
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- ============================================================================
-- 4. SUBSCRIPTION AUDIT LOG
-- Tracks all subscription changes for compliance and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_audit_log (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id         UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    
    -- Event information
    event_type              VARCHAR(50) NOT NULL,
    event_description       TEXT NOT NULL,
    
    -- State changes
    old_status              VARCHAR(30),
    new_status              VARCHAR(30),
    old_plan_code           VARCHAR(50),
    new_plan_code           VARCHAR(50),
    
    -- Metadata
    metadata                JSONB,
    performed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address              VARCHAR(45),
    user_agent              TEXT,
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_audit_user 
    ON subscription_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_audit_subscription 
    ON subscription_audit_log (subscription_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_audit_event 
    ON subscription_audit_log (event_type, created_at DESC);

-- Enable RLS
ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own audit logs
CREATE POLICY subscription_audit_log_owner 
    ON subscription_audit_log 
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user subscription is active
CREATE OR REPLACE FUNCTION is_subscription_active(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_status VARCHAR(30);
    v_trial_end TIMESTAMPTZ;
    v_subscription_end TIMESTAMPTZ;
BEGIN
    SELECT status, trial_end_at, subscription_end_at
    INTO v_status, v_trial_end, v_subscription_end
    FROM user_subscriptions
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check trial
    IF v_status = 'trial' THEN
        RETURN v_trial_end IS NULL OR v_trial_end > NOW();
    END IF;
    
    -- Check active subscription
    IF v_status = 'active' THEN
        RETURN v_subscription_end IS NULL OR v_subscription_end > NOW();
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get user's current plan features
CREATE OR REPLACE FUNCTION get_user_plan_features(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_features JSONB;
BEGIN
    SELECT sp.features
    INTO v_features
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN '{}'::jsonb;
    END IF;
    
    RETURN COALESCE(v_features, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get user's plan limits
CREATE OR REPLACE FUNCTION get_user_plan_limits(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_limits JSONB;
BEGIN
    SELECT sp.limits
    INTO v_limits
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN '{}'::jsonb;
    END IF;
    
    RETURN COALESCE(v_limits, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check specific feature access
CREATE OR REPLACE FUNCTION has_feature_access(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_access BOOLEAN;
    v_is_active BOOLEAN;
BEGIN
    -- Check if subscription is active
    v_is_active := is_subscription_active(p_user_id);
    
    IF NOT v_is_active THEN
        RETURN FALSE;
    END IF;
    
    -- Check feature in plan
    SELECT (sp.features->p_feature_key)::boolean
    INTO v_has_access
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id;
    
    RETURN COALESCE(v_has_access, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to automatically expire trials
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INTEGER AS $$
DECLARE
    v_expired_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE user_subscriptions
        SET status = 'expired',
            updated_at = NOW()
        WHERE status = 'trial'
          AND trial_end_at IS NOT NULL
          AND trial_end_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO v_expired_count FROM expired;
    
    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically expire subscriptions
CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    v_expired_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE user_subscriptions
        SET status = 'expired',
            updated_at = NOW()
        WHERE status = 'active'
          AND subscription_end_at IS NOT NULL
          AND subscription_end_at < NOW()
          AND auto_renew = FALSE
        RETURNING id
    )
    SELECT COUNT(*) INTO v_expired_count FROM expired;
    
    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update subscription updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS trigger_update_subscription_timestamp ON user_subscriptions;
CREATE TRIGGER trigger_update_subscription_timestamp
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();

DROP TRIGGER IF EXISTS trigger_update_payment_timestamp ON subscription_payments;
CREATE TRIGGER trigger_update_payment_timestamp
    BEFORE UPDATE ON subscription_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();

-- Function to log subscription changes
CREATE OR REPLACE FUNCTION log_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO subscription_audit_log (
            user_id, subscription_id, event_type, event_description,
            new_status, new_plan_code
        )
        SELECT 
            NEW.user_id, 
            NEW.id, 
            'subscription_created',
            'Subscription created',
            NEW.status,
            sp.plan_code
        FROM subscription_plans sp
        WHERE sp.id = NEW.plan_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status OR OLD.plan_id != NEW.plan_id THEN
            INSERT INTO subscription_audit_log (
                user_id, subscription_id, event_type, event_description,
                old_status, new_status, old_plan_code, new_plan_code
            )
            SELECT 
                NEW.user_id,
                NEW.id,
                CASE
                    WHEN OLD.status != NEW.status THEN 'status_changed'
                    WHEN OLD.plan_id != NEW.plan_id THEN 'plan_changed'
                    ELSE 'subscription_updated'
                END,
                CASE
                    WHEN OLD.status != NEW.status THEN 'Status changed from ' || OLD.status || ' to ' || NEW.status
                    WHEN OLD.plan_id != NEW.plan_id THEN 'Plan changed'
                    ELSE 'Subscription updated'
                END,
                OLD.status,
                NEW.status,
                old_plan.plan_code,
                new_plan.plan_code
            FROM subscription_plans old_plan, subscription_plans new_plan
            WHERE old_plan.id = OLD.plan_id AND new_plan.id = NEW.plan_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log subscription changes
DROP TRIGGER IF EXISTS trigger_log_subscription_change ON user_subscriptions;
CREATE TRIGGER trigger_log_subscription_change
    AFTER INSERT OR UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION log_subscription_change();

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
--   - subscription_plans (plan definitions)
--   - user_subscriptions (user subscription tracking)
--   - subscription_payments (payment records)
--   - subscription_audit_log (audit trail)
--
-- Functions created:
--   - is_subscription_active(user_id) - Check if subscription active
--   - get_user_plan_features(user_id) - Get feature entitlements
--   - get_user_plan_limits(user_id) - Get plan limits
--   - has_feature_access(user_id, feature) - Check specific feature
--   - expire_trials() - Expire old trials (run via cron)
--   - expire_subscriptions() - Expire old subscriptions (run via cron)
--
-- Triggers created:
--   - Auto-update timestamps
--   - Auto-log subscription changes
--
-- Default plans created:
--   - TRIAL (7 days, ₹0)
--   - BASIC (monthly, ₹999)
--   - PRO (monthly, ₹2,999)
--   - ELITE (monthly, ₹9,999)
-- ============================================================================
