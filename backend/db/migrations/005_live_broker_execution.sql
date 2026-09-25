BEGIN;

ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS broker_account_id UUID REFERENCES broker_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_algo_orders_broker_order ON algo_orders(broker_account_id, broker_order_id);
ALTER TABLE algo_orders DROP CONSTRAINT IF EXISTS algo_orders_status_check;
ALTER TABLE algo_orders ADD CONSTRAINT algo_orders_status_check
    CHECK (status IN ('CREATED', 'RECOVERY_PENDING', 'SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED'));
DROP INDEX IF EXISTS idx_algo_pending_user_instrument;
CREATE UNIQUE INDEX IF NOT EXISTS idx_algo_pending_user_instrument
    ON algo_orders(user_id, instrument)
    WHERE status IN ('CREATED', 'RECOVERY_PENDING', 'SUBMITTED', 'PARTIALLY_FILLED');

UPDATE algo_trades SET status = 'LIVE' WHERE status = 'PAPER';
ALTER TABLE algo_trades ALTER COLUMN status SET DEFAULT 'LIVE';

UPDATE quant_strategies SET status = 'STOPPED' WHERE status = 'PAPER_ACTIVE';
ALTER TABLE quant_strategies DROP CONSTRAINT IF EXISTS quant_strategies_status_check;
ALTER TABLE quant_strategies ADD CONSTRAINT quant_strategies_status_check
    CHECK (status IN ('DRAFT', 'BACKTESTED', 'LIVE_READY', 'LIVE_ACTIVE', 'STOPPED', 'ARCHIVED'));
ALTER TABLE quant_deployment_events DROP CONSTRAINT IF EXISTS quant_deployment_events_event_type_check;
ALTER TABLE quant_deployment_events ADD CONSTRAINT quant_deployment_events_event_type_check
    CHECK (event_type IN ('DEPLOYMENT_VALIDATED', 'DEPLOYMENT_BLOCKED', 'LIVE_DEPLOYED', 'KILL_SWITCH_TRIGGERED', 'STRATEGY_HALTED'));

CREATE TABLE IF NOT EXISTS broker_execution_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_account_id   UUID NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
    broker_order_id     VARCHAR(120) NOT NULL,
    status              VARCHAR(40) NOT NULL,
    filled_quantity     INTEGER NOT NULL DEFAULT 0,
    average_price       NUMERIC(14,4),
    payload_hash        CHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (broker_account_id, broker_order_id, status, filled_quantity, average_price)
);

ALTER TABLE broker_execution_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broker_execution_events' AND policyname = 'broker_execution_events_owner') THEN
                CREATE POLICY broker_execution_events_owner ON broker_execution_events
                    USING (broker_account_id IN (
                        SELECT id FROM broker_accounts
                        WHERE user_id = current_setting('app.current_user_id', true)::uuid
                    ));
        END IF;
END $$;

COMMIT;