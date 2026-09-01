-- IndexPilot Algo persistence. Provider client secrets stay outside this
-- database; user OAuth tokens are encrypted at rest in broker_oauth_tokens.
BEGIN;

CREATE TABLE IF NOT EXISTS algo_settings (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    trading_capital            NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (trading_capital >= 0),
    risk_per_trade             NUMERIC(5,2) NOT NULL DEFAULT 1 CHECK (risk_per_trade IN (0.5, 1, 2, 5)),
    risk_reward                NUMERIC(5,2) NOT NULL DEFAULT 2 CHECK (risk_reward > 0),
    max_trades_per_day         INTEGER NOT NULL DEFAULT 3 CHECK (max_trades_per_day >= 0),
    max_consecutive_losses     INTEGER NOT NULL DEFAULT 3 CHECK (max_consecutive_losses >= 0),
    daily_loss_limit           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (daily_loss_limit >= 0),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS algo_states (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status                     VARCHAR(20) NOT NULL DEFAULT 'STOPPED' CHECK (status IN ('STOPPED', 'ACTIVE', 'PAUSED')),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broker_accounts (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker                     VARCHAR(30) NOT NULL CHECK (broker IN ('ANGEL_ONE', 'LEMONN')),
    connection_mode            VARCHAR(20) NOT NULL DEFAULT 'SANDBOX' CHECK (connection_mode IN ('SANDBOX', 'LIVE')),
    status                     VARCHAR(30) NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (status IN ('NOT_CONNECTED', 'SANDBOX_CONNECTED', 'CONNECTED')),
    connected_at               TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, broker)
);

CREATE TABLE IF NOT EXISTS broker_oauth_sessions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker             VARCHAR(30) NOT NULL CHECK (broker IN ('ANGEL_ONE', 'LEMONN')),
    state_hash         CHAR(64) NOT NULL UNIQUE,
    redirect_uri       TEXT NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    failure_code       VARCHAR(80),
    expires_at         TIMESTAMPTZ NOT NULL,
    consumed_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_oauth_sessions_lookup
    ON broker_oauth_sessions (broker, state_hash, status, expires_at);

CREATE TABLE IF NOT EXISTS broker_oauth_tokens (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_account_id          UUID NOT NULL UNIQUE REFERENCES broker_accounts(id) ON DELETE CASCADE,
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token_ciphertext    TEXT NOT NULL,
    refresh_token_ciphertext   TEXT,
    token_type                 VARCHAR(40),
    scopes                     TEXT[] NOT NULL DEFAULT '{}',
    token_expires_at           TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_oauth_tokens_user
    ON broker_oauth_tokens (user_id);

CREATE TABLE IF NOT EXISTS algo_strategies (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                       VARCHAR(80) NOT NULL UNIQUE,
    name                       VARCHAR(120) NOT NULL,
    instrument                 VARCHAR(80) NOT NULL,
    style                      VARCHAR(80) NOT NULL,
    timeframe                  VARCHAR(30) NOT NULL,
    risk_reward                VARCHAR(20) NOT NULL,
    max_trades_per_day         INTEGER NOT NULL DEFAULT 3,
    description                TEXT,
    is_active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS algo_positions (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol                     VARCHAR(40) NOT NULL,
    side                       VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity                   INTEGER NOT NULL CHECK (quantity > 0),
    entry_price                NUMERIC(14,2) NOT NULL,
    current_price              NUMERIC(14,2) NOT NULL,
    stop_loss                  NUMERIC(14,2),
    target                     NUMERIC(14,2),
    pnl                        NUMERIC(14,2) NOT NULL DEFAULT 0,
    status                     VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    opened_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS algo_trades (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id                UUID REFERENCES algo_strategies(id) ON DELETE SET NULL,
    symbol                     VARCHAR(40) NOT NULL,
    side                       VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    entry_price                NUMERIC(14,2),
    exit_price                 NUMERIC(14,2),
    quantity                   INTEGER NOT NULL DEFAULT 0,
    pnl                        NUMERIC(14,2) NOT NULL DEFAULT 0,
    status                     VARCHAR(20) NOT NULL DEFAULT 'PAPER',
    traded_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS algo_activity_logs (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type                 VARCHAR(60) NOT NULL,
    message                    TEXT NOT NULL,
    metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_algo_positions_user ON algo_positions(user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_algo_trades_user ON algo_trades(user_id, traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_algo_activity_user ON algo_activity_logs(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mobile_unique ON users(mobile) WHERE mobile IS NOT NULL;

INSERT INTO algo_strategies (slug, name, instrument, style, timeframe, risk_reward, max_trades_per_day, description)
VALUES (
    'nifty-pulse-5m',
    'Kepwe NIFTY Pulse 5M',
    'NIFTY 50',
    'Intraday Scalping',
    '5 Minute',
    '1:2',
    3,
    'A rules-based intraday setup designed for disciplined, limited-frequency NIFTY participation.'
)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE algo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE algo_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE algo_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE algo_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE algo_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'algo_settings' AND policyname = 'algo_settings_owner') THEN
        CREATE POLICY algo_settings_owner ON algo_settings USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'algo_states' AND policyname = 'algo_states_owner') THEN
        CREATE POLICY algo_states_owner ON algo_states USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broker_accounts' AND policyname = 'broker_accounts_owner') THEN
        CREATE POLICY broker_accounts_owner ON broker_accounts USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broker_oauth_sessions' AND policyname = 'broker_oauth_sessions_owner') THEN
        CREATE POLICY broker_oauth_sessions_owner ON broker_oauth_sessions USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broker_oauth_tokens' AND policyname = 'broker_oauth_tokens_owner') THEN
        CREATE POLICY broker_oauth_tokens_owner ON broker_oauth_tokens USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'algo_positions' AND policyname = 'algo_positions_owner') THEN
        CREATE POLICY algo_positions_owner ON algo_positions USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'algo_trades' AND policyname = 'algo_trades_owner') THEN
        CREATE POLICY algo_trades_owner ON algo_trades USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'algo_activity_logs' AND policyname = 'algo_activity_owner') THEN
        CREATE POLICY algo_activity_owner ON algo_activity_logs USING (user_id = current_setting('app.current_user_id', true)::uuid) WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

COMMIT;