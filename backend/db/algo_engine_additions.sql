-- IndexPilot Algo Engine persistence.
-- Additive and idempotent: safe to apply after algo_additions.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS algo_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_order_id   UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    broker_order_id     VARCHAR(120),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id         UUID REFERENCES algo_strategies(id) ON DELETE SET NULL,
    execution_mode      VARCHAR(10) NOT NULL DEFAULT 'PAPER' CHECK (execution_mode IN ('PAPER', 'LIVE')),
    instrument          VARCHAR(80) NOT NULL,
    side                VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity            INTEGER NOT NULL CHECK (quantity > 0),
    filled_quantity     INTEGER NOT NULL DEFAULT 0 CHECK (filled_quantity >= 0 AND filled_quantity <= quantity),
    price               NUMERIC(14,4) NOT NULL CHECK (price > 0),
    average_fill_price  NUMERIC(14,4),
    stop_loss           NUMERIC(14,4) CHECK (stop_loss IS NULL OR stop_loss > 0),
    target              NUMERIC(14,4) CHECK (target IS NULL OR target > 0),
    status              VARCHAR(24) NOT NULL DEFAULT 'CREATED'
                        CHECK (status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED')),
    rejection_reason    TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_trades (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id            UUID REFERENCES algo_orders(id) ON DELETE SET NULL,
    strategy_id         UUID REFERENCES algo_strategies(id) ON DELETE SET NULL,
    instrument          VARCHAR(80) NOT NULL,
    side                VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity            INTEGER NOT NULL CHECK (quantity > 0),
    entry_price         NUMERIC(14,4) NOT NULL,
    exit_price          NUMERIC(14,4),
    stop_loss           NUMERIC(14,4),
    target              NUMERIC(14,4),
    slippage            NUMERIC(14,4) NOT NULL DEFAULT 0,
    charges             NUMERIC(14,4) NOT NULL DEFAULT 0,
    pnl                 NUMERIC(14,4) NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    opened_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS risk_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type          VARCHAR(60) NOT NULL,
    reason              TEXT NOT NULL,
    severity            VARCHAR(12) NOT NULL DEFAULT 'HIGH' CHECK (severity IN ('INFO', 'WARN', 'HIGH', 'CRITICAL')),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS algo_backtest_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_slug       VARCHAR(80) NOT NULL,
    instrument          VARCHAR(80) NOT NULL,
    timeframe           VARCHAR(20) NOT NULL,
    from_date           DATE,
    to_date             DATE,
    parameters          JSONB NOT NULL DEFAULT '{}'::jsonb,
    results             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_algo_orders_user_created ON algo_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paper_trades_user_opened ON paper_trades(user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_events_user_created ON risk_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_user_created ON algo_backtest_runs(user_id, created_at DESC);

ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS filled_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE algo_orders ADD COLUMN IF NOT EXISTS average_fill_price NUMERIC(14,4);
ALTER TABLE algo_orders DROP CONSTRAINT IF EXISTS algo_orders_filled_quantity_check;
ALTER TABLE algo_orders ADD CONSTRAINT algo_orders_filled_quantity_check
    CHECK (filled_quantity >= 0 AND filled_quantity <= quantity);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paper_open_user_instrument
    ON paper_trades(user_id, instrument) WHERE status = 'OPEN';
CREATE UNIQUE INDEX IF NOT EXISTS idx_algo_open_user_symbol
    ON algo_positions(user_id, symbol) WHERE status = 'OPEN';
CREATE UNIQUE INDEX IF NOT EXISTS idx_algo_pending_user_instrument
    ON algo_orders(user_id, instrument)
    WHERE status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED');

ALTER TABLE algo_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE algo_backtest_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'algo_orders' AND policyname = 'algo_orders_owner') THEN
        CREATE POLICY algo_orders_owner ON algo_orders USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'paper_trades' AND policyname = 'paper_trades_owner') THEN
        CREATE POLICY paper_trades_owner ON paper_trades USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'risk_events' AND policyname = 'risk_events_owner') THEN
        CREATE POLICY risk_events_owner ON risk_events USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'algo_backtest_runs' AND policyname = 'algo_backtest_runs_owner') THEN
        CREATE POLICY algo_backtest_runs_owner ON algo_backtest_runs USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

ALTER TABLE algo_settings ALTER COLUMN max_consecutive_losses SET DEFAULT 2;

COMMIT;