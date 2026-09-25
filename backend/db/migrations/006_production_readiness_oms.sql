BEGIN;

CREATE TABLE IF NOT EXISTS execution_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_account_id   UUID NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
    broker_order_id     VARCHAR(120) NOT NULL,
    status              VARCHAR(40) NOT NULL,
    filled_quantity     INTEGER NOT NULL DEFAULT 0 CHECK (filled_quantity >= 0),
    average_price       NUMERIC(14,4),
    payload_hash        CHAR(64) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (broker_account_id, broker_order_id, status, filled_quantity, average_price)
);

ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS broker_account_id UUID REFERENCES broker_accounts(id) ON DELETE SET NULL;
ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS filled_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS average_fill_price NUMERIC(14,4);
ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE algo_positions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE algo_trades ADD COLUMN IF NOT EXISTS charges NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE algo_trades ADD COLUMN IF NOT EXISTS net_pnl NUMERIC(14,2);
UPDATE algo_trades SET net_pnl = pnl - charges WHERE net_pnl IS NULL;

CREATE INDEX IF NOT EXISTS idx_algo_orders_user_created ON algo_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_algo_orders_broker_order ON algo_orders(broker_account_id, broker_order_id);
CREATE INDEX IF NOT EXISTS idx_algo_positions_user_status ON algo_positions(user_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_algo_trades_user_traded ON algo_trades(user_id, traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_events_broker_order ON execution_events(broker_account_id, broker_order_id, created_at DESC);

ALTER TABLE algo_orders DROP CONSTRAINT IF EXISTS algo_orders_filled_quantity_check;
ALTER TABLE algo_orders ADD CONSTRAINT algo_orders_filled_quantity_check
    CHECK (filled_quantity >= 0 AND filled_quantity <= quantity);
ALTER TABLE algo_positions DROP CONSTRAINT IF EXISTS algo_positions_status_check;
ALTER TABLE algo_positions ADD CONSTRAINT algo_positions_status_check
    CHECK (status IN ('OPEN', 'CLOSED'));
ALTER TABLE algo_trades DROP CONSTRAINT IF EXISTS algo_trades_status_check;
ALTER TABLE algo_trades ADD CONSTRAINT algo_trades_status_check
    CHECK (status IN ('LIVE', 'CLOSED', 'CANCELLED', 'REJECTED'));

INSERT INTO execution_events (id, broker_account_id, broker_order_id, status, filled_quantity, average_price, payload_hash, created_at)
SELECT id, broker_account_id, broker_order_id, status, filled_quantity, average_price, payload_hash, created_at
FROM broker_execution_events
ON CONFLICT (id) DO NOTHING;

ALTER TABLE execution_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'execution_events' AND policyname = 'execution_events_owner') THEN
        CREATE POLICY execution_events_owner ON execution_events
            USING (broker_account_id IN (
                SELECT id FROM broker_accounts
                WHERE user_id = current_setting('app.current_user_id', true)::uuid
            ));
    END IF;
END $$;

COMMIT;
