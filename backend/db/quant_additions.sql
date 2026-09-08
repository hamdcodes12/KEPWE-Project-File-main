-- KEPWE QUANT persistence schema.
-- Additive and idempotent: safe to apply without touching any existing tables.
BEGIN;

CREATE TABLE IF NOT EXISTS quant_strategies (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                       VARCHAR(150) NOT NULL,
    slug                       VARCHAR(100) NOT NULL,
    version                    VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    instrument                 VARCHAR(80) NOT NULL DEFAULT 'NIFTY 50',
    direction                  VARCHAR(30) NOT NULL DEFAULT 'LONG_CE_PE',
    option_type                VARCHAR(30) NOT NULL DEFAULT 'ATM',
    timeframe                  VARCHAR(20) NOT NULL DEFAULT '5m',
    confirmation_timeframe     VARCHAR(20) NOT NULL DEFAULT '1m',
    lot_size                   INTEGER NOT NULL DEFAULT 1 CHECK (lot_size > 0),
    order_type                 VARCHAR(20) NOT NULL DEFAULT 'MARKET',
    product_type               VARCHAR(20) NOT NULL DEFAULT 'MIS',
    trading_window_start       VARCHAR(10) NOT NULL DEFAULT '09:25',
    trading_window_end         VARCHAR(10) NOT NULL DEFAULT '15:10',
    risk_per_trade_pct         NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (risk_per_trade_pct > 0 AND risk_per_trade_pct <= 5.00),
    stop_loss_pct              NUMERIC(5,2) NOT NULL DEFAULT 25.00 CHECK (stop_loss_pct > 0),
    target_pct                 NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (target_pct > 0),
    risk_reward_ratio          NUMERIC(5,2) NOT NULL DEFAULT 2.00 CHECK (risk_reward_ratio > 0),
    time_stop_minutes          INTEGER NOT NULL DEFAULT 20 CHECK (time_stop_minutes > 0),
    max_trades_per_day         INTEGER NOT NULL DEFAULT 3 CHECK (max_trades_per_day > 0),
    max_consecutive_losses     INTEGER NOT NULL DEFAULT 2 CHECK (max_consecutive_losses > 0),
    daily_drawdown_limit_pct   NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (daily_drawdown_limit_pct > 0),
    max_open_positions         INTEGER NOT NULL DEFAULT 1 CHECK (max_open_positions > 0),
    status                     VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
                               CHECK (status IN ('DRAFT', 'BACKTESTED', 'PAPER_ACTIVE', 'LIVE_READY', 'LIVE_ACTIVE', 'STOPPED', 'ARCHIVED')),
    parameters                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quant_strategy_versions (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id                UUID NOT NULL REFERENCES quant_strategies(id) ON DELETE CASCADE,
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version                    VARCHAR(20) NOT NULL,
    changelog                  TEXT,
    parameters                 JSONB NOT NULL,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quant_deployment_events (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id                UUID REFERENCES quant_strategies(id) ON DELETE CASCADE,
    event_type                 VARCHAR(60) NOT NULL
                               CHECK (event_type IN ('DEPLOYMENT_VALIDATED', 'DEPLOYMENT_BLOCKED', 'PAPER_DEPLOYED', 'LIVE_DEPLOYED', 'KILL_SWITCH_TRIGGERED', 'STRATEGY_HALTED')),
    reason                     TEXT NOT NULL,
    gate_checks                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quant_strategies_user ON quant_strategies(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quant_strategy_versions ON quant_strategy_versions(strategy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quant_deployment_events ON quant_deployment_events(user_id, created_at DESC);

ALTER TABLE quant_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quant_strategy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quant_deployment_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quant_strategies' AND policyname = 'quant_strategies_owner') THEN
        CREATE POLICY quant_strategies_owner ON quant_strategies USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quant_strategy_versions' AND policyname = 'quant_strategy_versions_owner') THEN
        CREATE POLICY quant_strategy_versions_owner ON quant_strategy_versions USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quant_deployment_events' AND policyname = 'quant_deployment_events_owner') THEN
        CREATE POLICY quant_deployment_events_owner ON quant_deployment_events USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

COMMIT;
