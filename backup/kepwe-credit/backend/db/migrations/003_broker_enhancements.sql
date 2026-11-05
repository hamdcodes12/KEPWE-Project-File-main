-- ============================================================================
-- KEPWE Quant Broker Connection Hardening Migration
-- Adds production-grade multi-broker support enhancements
-- ============================================================================

BEGIN;

-- Add new columns to broker_accounts if they don't exist
DO $$
BEGIN
    -- Add is_active_broker column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_accounts' AND column_name = 'is_active_broker'
    ) THEN
        ALTER TABLE broker_accounts ADD COLUMN is_active_broker BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- Add last_verified_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_accounts' AND column_name = 'last_verified_at'
    ) THEN
        ALTER TABLE broker_accounts ADD COLUMN last_verified_at TIMESTAMPTZ;
    END IF;

    -- Add verification_score column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_accounts' AND column_name = 'verification_score'
    ) THEN
        ALTER TABLE broker_accounts ADD COLUMN verification_score INTEGER CHECK (verification_score >= 0 AND verification_score <= 100);
    END IF;
END $$;

-- Add feed_token_ciphertext to broker_oauth_tokens if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'broker_oauth_tokens' AND column_name = 'feed_token_ciphertext'
    ) THEN
        ALTER TABLE broker_oauth_tokens ADD COLUMN feed_token_ciphertext TEXT;
    END IF;
END $$;

-- Normalize legacy non-live rows before enforcing the LIVE-only constraints.
UPDATE broker_accounts SET connection_mode = 'LIVE' WHERE connection_mode = 'SANDBOX';
UPDATE broker_accounts SET status = 'NOT_CONNECTED' WHERE status = 'SANDBOX_CONNECTED';

-- Update connection_mode constraint to remove SANDBOX (LIVE-only system)
DO $$
BEGIN
    -- Drop old constraint if exists
    ALTER TABLE broker_accounts DROP CONSTRAINT IF EXISTS broker_accounts_connection_mode_check;
    
    -- Add new constraint (LIVE only)
    ALTER TABLE broker_accounts ADD CONSTRAINT broker_accounts_connection_mode_check 
        CHECK (connection_mode IN ('LIVE'));
END $$;

-- Update status constraint to include new statuses
DO $$
BEGIN
    -- Drop old constraint if exists
    ALTER TABLE broker_accounts DROP CONSTRAINT IF EXISTS broker_accounts_status_check;
    
    -- Add new constraint with extended statuses
    ALTER TABLE broker_accounts ADD CONSTRAINT broker_accounts_status_check 
        CHECK (status IN ('NOT_CONNECTED', 'CONNECTED', 'SESSION_EXPIRED', 'VERIFICATION_FAILED', 'CONNECTION_FAILED', 'PARTIALLY_CONNECTED'));
END $$;

-- Create index for active broker lookup
CREATE INDEX IF NOT EXISTS idx_broker_accounts_active 
    ON broker_accounts (user_id, is_active_broker) 
    WHERE is_active_broker = TRUE;

-- Create index for verification status
CREATE INDEX IF NOT EXISTS idx_broker_accounts_verification 
    ON broker_accounts (user_id, status, last_verified_at DESC);

-- Function to ensure only one active broker per user
CREATE OR REPLACE FUNCTION ensure_single_active_broker()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active_broker = TRUE THEN
        -- Deactivate all other brokers for this user
        UPDATE broker_accounts 
        SET is_active_broker = FALSE 
        WHERE user_id = NEW.user_id 
          AND id != NEW.id 
          AND is_active_broker = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for active broker enforcement
DROP TRIGGER IF EXISTS trigger_ensure_single_active_broker ON broker_accounts;
CREATE TRIGGER trigger_ensure_single_active_broker
    BEFORE INSERT OR UPDATE ON broker_accounts
    FOR EACH ROW
    WHEN (NEW.is_active_broker = TRUE)
    EXECUTE FUNCTION ensure_single_active_broker();

-- Create broker_verification_history table for audit trail
CREATE TABLE IF NOT EXISTS broker_verification_history (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker_account_id          UUID NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
    broker                     VARCHAR(30) NOT NULL,
    verification_id            VARCHAR(32) NOT NULL,
    status                     VARCHAR(30) NOT NULL,
    overall_score              INTEGER NOT NULL,
    checks_passed              INTEGER NOT NULL,
    checks_total               INTEGER NOT NULL,
    checks_detail              JSONB NOT NULL DEFAULT '{}'::jsonb,
    errors                     TEXT[],
    warnings                   TEXT[],
    verification_duration_ms   INTEGER,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_verification_history_user 
    ON broker_verification_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broker_verification_history_broker 
    ON broker_verification_history (broker_account_id, created_at DESC);

-- Enable RLS on new table
ALTER TABLE broker_verification_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for verification history
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'broker_verification_history' 
        AND policyname = 'broker_verification_history_owner'
    ) THEN
        CREATE POLICY broker_verification_history_owner 
        ON broker_verification_history 
        USING (user_id = current_setting('app.current_user_id', true)::uuid) 
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Create function to automatically set last_verified_at
CREATE OR REPLACE FUNCTION update_broker_verification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the broker_accounts table with verification timestamp and score
    IF NEW.status = 'CONNECTED' OR NEW.status = 'PARTIALLY_CONNECTED' THEN
        UPDATE broker_accounts 
        SET 
            last_verified_at = NOW(),
            verification_score = NEW.overall_score,
            status = NEW.status
        WHERE id = NEW.broker_account_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic verification timestamp update
DROP TRIGGER IF EXISTS trigger_update_broker_verification_timestamp ON broker_verification_history;
CREATE TRIGGER trigger_update_broker_verification_timestamp
    AFTER INSERT ON broker_verification_history
    FOR EACH ROW
    EXECUTE FUNCTION update_broker_verification_timestamp();

COMMIT;
