-- Migration: Update broker constraints for DhanHQ integration
BEGIN;

-- Add client_id column to broker_accounts if it does not exist
ALTER TABLE broker_accounts ADD COLUMN IF NOT EXISTS client_id VARCHAR(60);

-- Drop old check constraint on broker_accounts.broker
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'broker_accounts' AND column_name = 'broker'
    ) LOOP
        -- Only drop CHECK constraints (skip NOT NULL or PRIMARY/FOREIGN keys)
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'broker_accounts' AND constraint_name = r.constraint_name AND constraint_type = 'CHECK'
        ) THEN
            EXECUTE 'ALTER TABLE broker_accounts DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END IF;
    END LOOP;
END $$;

-- Drop old check constraint on broker_oauth_sessions.broker
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'broker_oauth_sessions' AND column_name = 'broker'
    ) LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'broker_oauth_sessions' AND constraint_name = r.constraint_name AND constraint_type = 'CHECK'
        ) THEN
            EXECUTE 'ALTER TABLE broker_oauth_sessions DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        END IF;
    END LOOP;
END $$;

-- Remove legacy LemonN data
DELETE FROM broker_oauth_tokens WHERE broker_account_id IN (SELECT id FROM broker_accounts WHERE broker = 'LEMONN');
DELETE FROM broker_oauth_sessions WHERE broker = 'LEMONN';
DELETE FROM broker_accounts WHERE broker = 'LEMONN';

-- Add updated CHECK constraints allowing DHAN
ALTER TABLE broker_accounts ADD CONSTRAINT broker_accounts_broker_check CHECK (broker IN ('DHAN', 'ANGEL_ONE'));
ALTER TABLE broker_oauth_sessions ADD CONSTRAINT broker_oauth_sessions_broker_check CHECK (broker IN ('DHAN', 'ANGEL_ONE'));

COMMIT;
