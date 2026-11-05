BEGIN;

ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS exchange_order_id VARCHAR(120);
ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(30);
ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS broker_status VARCHAR(60);
ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS broker_updated_at TIMESTAMPTZ;
ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS is_exit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES algo_orders(id) ON DELETE SET NULL;

ALTER TABLE algo_positions ADD COLUMN IF NOT EXISTS security_id VARCHAR(80);
ALTER TABLE algo_positions ADD COLUMN IF NOT EXISTS trading_symbol VARCHAR(120);
ALTER TABLE algo_positions ADD COLUMN IF NOT EXISTS exchange_segment VARCHAR(30);
ALTER TABLE algo_positions ADD COLUMN IF NOT EXISTS broker_position_key VARCHAR(180);
ALTER TABLE algo_positions ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE algo_positions ADD COLUMN IF NOT EXISTS unrealized_pnl NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE algo_positions ADD COLUMN IF NOT EXISTS broker_updated_at TIMESTAMPTZ;

ALTER TABLE algo_trades ADD COLUMN IF NOT EXISTS broker_order_id VARCHAR(120);
ALTER TABLE algo_trades ADD COLUMN IF NOT EXISTS exchange_order_id VARCHAR(120);
ALTER TABLE algo_trades ADD COLUMN IF NOT EXISTS broker_trade_id VARCHAR(120);
ALTER TABLE algo_trades ADD COLUMN IF NOT EXISTS execution_price NUMERIC(14,4);
ALTER TABLE algo_trades ADD COLUMN IF NOT EXISTS execution_quantity INTEGER;
ALTER TABLE algo_trades ADD COLUMN IF NOT EXISTS exit_reason VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_algo_orders_correlation ON algo_orders(correlation_id);
CREATE INDEX IF NOT EXISTS idx_algo_orders_exchange_order ON algo_orders(exchange_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_algo_positions_broker_key ON algo_positions(user_id, broker_position_key)
    WHERE broker_position_key IS NOT NULL AND status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_algo_trades_broker_order ON algo_trades(broker_order_id);
CREATE INDEX IF NOT EXISTS idx_algo_trades_broker_trade ON algo_trades(broker_trade_id);

ALTER TABLE algo_positions DROP CONSTRAINT IF EXISTS algo_positions_status_check;
ALTER TABLE algo_positions ADD CONSTRAINT algo_positions_status_check
    CHECK (status IN ('OPEN', 'CLOSED', 'EMERGENCY_PENDING'));

COMMIT;
