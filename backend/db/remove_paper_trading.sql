-- Remove paper trading tables and columns (Production Cutover)
-- FINAL: Conversion to REAL PRODUCTION trading only - no paper sandbox
-- NOTE: This file is superseded by quant_live_only_hardening.sql
-- which properly handles execution_mode column retention with LIVE-only constraint
BEGIN;

-- Drop paper_trades table (all simulated trades/positions)
DROP TABLE IF EXISTS paper_trades CASCADE;

-- Drop paper_trade_settings table (IndexPilot paper/live mode toggle)
DROP TABLE IF EXISTS paper_trade_settings CASCADE;

-- NOTE: execution_mode column is retained but constrained to LIVE only
-- See quant_live_only_hardening.sql for constraint enforcement

-- Update quant_deployment_events to LIVE-only events
-- (only LIVE_DEPLOYED, LIVE_ACTIVE permitted from now on)
ALTER TABLE quant_deployment_events 
    DROP CONSTRAINT IF EXISTS quant_deployment_events_event_type_check;
ALTER TABLE quant_deployment_events
    ADD CONSTRAINT quant_deployment_events_event_type_check 
    CHECK (event_type IN ('LIVE_DEPLOYED', 'LIVE_ACTIVE', 'DEPLOYMENT_VALIDATED', 'DEPLOYMENT_BLOCKED', 'KILL_SWITCH_TRIGGERED'));

COMMIT;
