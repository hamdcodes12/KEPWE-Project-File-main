-- Angel One SmartAPI Integration Migration
-- Adds support for Angel One as a second real live broker alongside Dhan

-- Add feed_token_ciphertext column to broker_oauth_tokens table if it doesn't exist
ALTER TABLE broker_oauth_tokens 
ADD COLUMN IF NOT EXISTS feed_token_ciphertext TEXT;

-- Create index on broker column for faster broker-specific queries
CREATE INDEX IF NOT EXISTS idx_broker_accounts_broker 
ON broker_accounts(broker);

-- Create index on broker_oauth_tokens for Angel One lookups
CREATE INDEX IF NOT EXISTS idx_broker_oauth_tokens_broker_account_user 
ON broker_oauth_tokens(broker_account_id, user_id);

-- Update broker_accounts table to ensure it supports multiple brokers per user
-- (Already has UNIQUE constraint on (user_id, broker) from existing schema)

-- Add comments for documentation
COMMENT ON COLUMN broker_oauth_tokens.feed_token_ciphertext IS 'Encrypted feed token for real-time data (Angel One SmartAPI)';
COMMENT ON TABLE broker_accounts IS 'Stores broker connections - supports DHAN and ANGEL_ONE in LIVE mode only';

-- Verify no paper trading remnants
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM broker_accounts WHERE connection_mode = 'PAPER') THEN
    RAISE EXCEPTION 'Paper trading mode detected - only LIVE mode is supported';
  END IF;
END $$;

-- Log migration execution
INSERT INTO algo_activity_logs (user_id, event_type, message, metadata, created_at)
SELECT 
  id,
  'SYSTEM_MIGRATION',
  'Angel One SmartAPI integration enabled',
  '{"migration":"angel_one_integration","brokers":["DHAN","ANGEL_ONE"],"mode":"LIVE"}'::jsonb,
  NOW()
FROM users 
WHERE email = 'system@kepwe.in'
ON CONFLICT DO NOTHING;
