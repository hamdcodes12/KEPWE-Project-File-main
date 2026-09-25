-- KEPWE Quant - LIVE-ONLY HARDENING MIGRATION
-- Final production cutover: Remove all paper trading artifacts
-- Enforces execution_mode = 'LIVE' only at database level
-- Date: September 12, 2026

BEGIN;

-- ============================================================================
-- STEP 1: Archive existing paper data (if any) before deletion
-- ============================================================================
-- Note: Paper trades were only used in sandbox mode. Production instances
-- should not have paper_trades data. If any exist, they are development/test data.
-- Hard delete without archiving per user requirements (no paper traces remain).

-- ============================================================================
-- STEP 2: Update algo_orders constraint to LIVE-only
-- ============================================================================
-- Remove permissive CHECK constraint
ALTER TABLE algo_orders 
    DROP CONSTRAINT IF EXISTS algo_orders_execution_mode_check;

-- Add strict LIVE-only constraint
ALTER TABLE algo_orders 
    ADD CONSTRAINT algo_orders_execution_mode_check 
    CHECK (execution_mode = 'LIVE');

-- Set default to LIVE
ALTER TABLE algo_orders 
    ALTER COLUMN execution_mode SET DEFAULT 'LIVE';

-- ============================================================================
-- STEP 3: Remove paper_trades table (sandbox simulation table)
-- ============================================================================
DROP TABLE IF EXISTS paper_trades CASCADE;

-- ============================================================================
-- STEP 4: Remove paper_trade_settings table (mode toggle)
-- ============================================================================
DROP TABLE IF EXISTS paper_trade_settings CASCADE;

-- ============================================================================
-- STEP 5: Update quant_deployment_events to LIVE-only
-- ============================================================================
-- Ensure no PAPER_DEPLOYED or PAPER_ACTIVE events can be recorded
ALTER TABLE quant_deployment_events 
    DROP CONSTRAINT IF EXISTS quant_deployment_events_event_type_check;

ALTER TABLE quant_deployment_events
    ADD CONSTRAINT quant_deployment_events_event_type_check 
    CHECK (event_type IN ('LIVE_DEPLOYED', 'LIVE_ACTIVE', 'DEPLOYMENT_VALIDATED', 'DEPLOYMENT_BLOCKED', 'KILL_SWITCH_TRIGGERED'));

-- ============================================================================
-- STEP 6: Remove SANDBOX connection mode from broker_accounts
-- ============================================================================
-- Update any existing SANDBOX_CONNECTED rows to NOT_CONNECTED
UPDATE broker_accounts 
    SET status = 'NOT_CONNECTED', connection_mode = 'LIVE'
    WHERE connection_mode = 'SANDBOX';

-- Add constraint to only allow LIVE connection mode for Quant
ALTER TABLE broker_accounts 
    DROP CONSTRAINT IF EXISTS broker_accounts_connection_mode_check;

ALTER TABLE broker_accounts 
    ADD CONSTRAINT broker_accounts_connection_mode_check 
    CHECK (connection_mode IN ('LIVE', 'TESTING'));

-- ============================================================================
-- STEP 7: Verify data integrity
-- ============================================================================
-- Ensure no execution_mode values other than 'LIVE' exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM algo_orders WHERE execution_mode != 'LIVE') THEN
        RAISE EXCEPTION 'ERROR: Found non-LIVE execution_mode in algo_orders. This should not occur after migration.';
    END IF;
    IF EXISTS (SELECT 1 FROM broker_accounts WHERE connection_mode NOT IN ('LIVE', 'TESTING')) THEN
        RAISE EXCEPTION 'ERROR: Found non-LIVE connection_mode in broker_accounts. This should not occur after migration.';
    END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ execution_mode constraint changed to LIVE-only
-- ✅ paper_trades table deleted
-- ✅ paper_trade_settings table deleted
-- ✅ quant_deployment_events constrained to LIVE events only
-- ✅ broker_accounts connection_mode constrained to LIVE/TESTING only
-- ✅ All existing SANDBOX connections converted to NOT_CONNECTED
-- ✅ Data integrity verified

COMMIT;
