-- KEPWE Quant: Angel One SmartAPI is the only supported broker.
--
-- * Removes every stored connection, token and pending login session that
--   belongs to any broker other than ANGEL_ONE. Order and trade history is
--   kept (algo_orders.broker_account_id is ON DELETE SET NULL).
-- * Stops any algo that was running against a removed broker connection.
-- * Restricts broker_accounts / broker_oauth_sessions to ANGEL_ONE.
-- * Adds the encrypted per-user SmartAPI key and feed token columns.
-- Idempotent: safe to run on every deploy.

BEGIN;

ALTER TABLE broker_accounts ADD COLUMN IF NOT EXISTS client_id VARCHAR(60);
ALTER TABLE broker_oauth_tokens ADD COLUMN IF NOT EXISTS feed_token_ciphertext TEXT;
ALTER TABLE broker_oauth_tokens ADD COLUMN IF NOT EXISTS api_key_ciphertext TEXT;

-- algo_orders.correlation_id is first written with the 36-character internal
-- order id, which does not fit the original VARCHAR(30).
ALTER TABLE algo_orders ALTER COLUMN correlation_id TYPE VARCHAR(64);

-- Stop live algos that depended on a broker connection being removed and that
-- have no connected Angel One account to fall back to.
UPDATE algo_states s
SET status = 'STOPPED', updated_at = NOW()
WHERE s.status = 'ACTIVE'
  AND EXISTS (SELECT 1 FROM broker_accounts a WHERE a.user_id = s.user_id AND a.broker <> 'ANGEL_ONE')
  AND NOT EXISTS (
    SELECT 1 FROM broker_accounts a
    WHERE a.user_id = s.user_id AND a.broker = 'ANGEL_ONE' AND a.status = 'CONNECTED'
  );

DELETE FROM broker_oauth_tokens
WHERE broker_account_id IN (SELECT id FROM broker_accounts WHERE broker <> 'ANGEL_ONE');
DELETE FROM broker_oauth_sessions WHERE broker <> 'ANGEL_ONE';
DELETE FROM broker_accounts WHERE broker <> 'ANGEL_ONE';

-- Replace the broker CHECK constraints (whatever they are named) with ANGEL_ONE only.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_name = tc.table_name
        WHERE tc.constraint_type = 'CHECK'
          AND tc.table_name IN ('broker_accounts', 'broker_oauth_sessions')
          AND ccu.column_name = 'broker'
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE broker_accounts ADD CONSTRAINT broker_accounts_broker_check CHECK (broker IN ('ANGEL_ONE'));
ALTER TABLE broker_oauth_sessions ADD CONSTRAINT broker_oauth_sessions_broker_check CHECK (broker IN ('ANGEL_ONE'));

CREATE INDEX IF NOT EXISTS idx_broker_accounts_broker ON broker_accounts (broker);

COMMENT ON TABLE broker_accounts IS 'Broker connections. Angel One SmartAPI (ANGEL_ONE) in LIVE mode is the only supported broker.';
COMMENT ON COLUMN broker_oauth_tokens.api_key_ciphertext IS 'AES-256-GCM encrypted SmartAPI key supplied by the user (NULL when the server key is used).';
COMMENT ON COLUMN broker_oauth_tokens.feed_token_ciphertext IS 'AES-256-GCM encrypted Angel One SmartAPI feed token.';

COMMIT;
