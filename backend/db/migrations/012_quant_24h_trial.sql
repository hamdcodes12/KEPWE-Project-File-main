BEGIN;

ALTER TABLE user_subscriptions
  ALTER COLUMN status SET DEFAULT 'not_started'::quant_subscription_status;

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE user_subscriptions
  ALTER COLUMN trial_status SET DEFAULT 'NOT_STARTED';

DO $$ BEGIN
  ALTER TABLE user_subscriptions
    ADD CONSTRAINT user_subscriptions_trial_status_check
    CHECK (trial_status IN ('NOT_STARTED', 'ACTIVE', 'EXPIRED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE subscription_plans
SET display_name = '24-Hour Free Demo',
    description = 'Activate one free 24-hour KEPWE Quant demo at a time of your choosing.',
    trial_days = 1,
    updated_at = clock_timestamp()
WHERE plan_code = 'TRIAL';

UPDATE user_subscriptions
SET trial_start_at = trial_end_at - INTERVAL '24 hours',
    is_trial_used = TRUE,
    updated_at = clock_timestamp()
WHERE status = 'trial'
  AND trial_start_at IS NULL
  AND trial_end_at IS NOT NULL;

-- Existing trials were already activated under the previous system. Preserve
-- that history while shortening their unexpired window to 24 hours from the
-- recorded start. Previously expired trials remain used and cannot restart.
UPDATE user_subscriptions AS us
SET trial_end_at = us.trial_start_at + INTERVAL '24 hours',
    is_trial_used = TRUE,
    updated_at = clock_timestamp()
FROM subscription_plans AS plan
WHERE plan.id = us.plan_id
  AND plan.plan_code = 'TRIAL'
  AND us.status = 'trial'
  AND us.trial_start_at IS NOT NULL;

UPDATE user_subscriptions
SET status = 'expired'::quant_subscription_status,
    is_trial_used = TRUE,
    updated_at = clock_timestamp()
WHERE status = 'trial'
  AND (trial_end_at IS NULL OR trial_end_at <= clock_timestamp());

UPDATE user_subscriptions
SET trial_status = CASE
      WHEN status = 'trial' AND trial_end_at > clock_timestamp() THEN 'ACTIVE'
      WHEN status = 'not_started' AND NOT is_trial_used THEN 'NOT_STARTED'
      ELSE 'EXPIRED'
    END,
    updated_at = clock_timestamp();

CREATE OR REPLACE FUNCTION quant_subscription_is_active(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
VOLATILE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_subscriptions us
    WHERE us.user_id = p_user_id
      AND (
        (us.status = 'trial' AND us.trial_end_at > clock_timestamp())
        OR (us.status = 'active' AND (us.subscription_end_at IS NULL OR us.subscription_end_at > clock_timestamp()))
        OR (us.status = 'cancelled' AND us.subscription_end_at > clock_timestamp())
      )
  );
$$;

CREATE OR REPLACE FUNCTION has_feature_access(p_user_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
VOLATILE
AS $$
  SELECT COALESCE((sp.features ->> p_feature_key)::BOOLEAN, FALSE)
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND (
      (us.status = 'trial' AND us.trial_end_at > clock_timestamp())
      OR (us.status = 'active' AND (us.subscription_end_at IS NULL OR us.subscription_end_at > clock_timestamp()))
      OR (us.status = 'cancelled' AND us.subscription_end_at > clock_timestamp())
    );
$$;

CREATE OR REPLACE FUNCTION get_user_plan_features(p_user_id UUID)
RETURNS JSONB
LANGUAGE SQL
VOLATILE
AS $$
  SELECT CASE WHEN quant_subscription_is_active(p_user_id)
    THEN sp.features ELSE '{}'::JSONB END
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION get_user_plan_limits(p_user_id UUID)
RETURNS JSONB
LANGUAGE SQL
VOLATILE
AS $$
  SELECT CASE WHEN quant_subscription_is_active(p_user_id)
    THEN sp.limits ELSE '{}'::JSONB END
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_subscriptions
  SET status = CASE WHEN status = 'trial' THEN 'expired'::quant_subscription_status ELSE status END,
      trial_status = 'EXPIRED',
      updated_at = clock_timestamp()
  WHERE trial_status = 'ACTIVE'
    AND trial_end_at IS NOT NULL
    AND trial_end_at <= clock_timestamp();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
