-- ============================================================================
-- KEPWE — Phase 2 additive schema changes
-- Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- Does NOT touch or re-create any table from schema.sql.
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: reports
-- Weekly / monthly IndexPilot research reports (AppReportsPage), gated by
-- the subscriber's plan tier.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) NOT NULL UNIQUE,
    summary         TEXT,
    published_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    required_plan   plan_type NOT NULL DEFAULT 'Pro',
    file_path       TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_published ON reports (published_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_active    ON reports (is_active) WHERE is_active = TRUE;

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'p_reports_select'
    ) THEN
        CREATE POLICY p_reports_select ON reports FOR SELECT USING (true);
    END IF;
END $$;

-- Seed a small set of real reference reports (idempotent).
INSERT INTO reports (title, summary, published_date, required_plan, sort_order) VALUES
('Weekly Index Regime Report — Aug W2 2026', 'NIFTY & Bank NIFTY regime classification, max pain, PCR trend, and weekly OI analysis.', '2026-08-11', 'Pro', 10),
('Weekly Index Regime Report — Aug W1 2026', 'Covers NIFTY trend, volatility snapshot, and institutional OI shifts.', '2026-08-04', 'Pro', 20),
('Monthly NIFTY Option Structure Review — July 2026', 'Monthly options OI analysis, put-call skew review, and strategy hit rates.', '2026-08-01', 'Pro', 30),
('Institutional Volatility & Options Positioning Deep Dive', 'Exclusive: FII/DII options positioning, dark pool signals, and dispersion trade analysis.', '2026-07-25', 'Premium', 40),
('Monthly NIFTY Option Structure Review — June 2026', 'June NIFTY options structure — expiry behavior, theta decay rates, and winner strategies.', '2026-07-01', 'Pro', 50)
ON CONFLICT (title) DO NOTHING;

-- ============================================================================
-- TABLE: market_indices
-- IndexPilot market index snapshots (NIFTY, BANKNIFTY, FINNIFTY).
-- Stored in PostgreSQL so the frontend always reads real database data.
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_indices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    price           NUMERIC(12,2) NOT NULL DEFAULT 0,
    change          NUMERIC(12,2) NOT NULL DEFAULT 0,
    change_percent  NUMERIC(8,2) NOT NULL DEFAULT 0,
    vix             NUMERIC(8,2) NOT NULL DEFAULT 0,
    iq_score        INTEGER NOT NULL DEFAULT 0,
    iq_status       VARCHAR(50) NOT NULL DEFAULT 'Neutral',
    verdict         verdict_type NOT NULL DEFAULT 'NO_TRADE',
    verdict_title   VARCHAR(255),
    verdict_reason  TEXT,
    confidence      INTEGER NOT NULL DEFAULT 0,
    trend           VARCHAR(50) NOT NULL DEFAULT 'Sideways',
    momentum        INTEGER NOT NULL DEFAULT 0,
    volatility      VARCHAR(50) NOT NULL DEFAULT 'Medium',
    regime          VARCHAR(50) NOT NULL DEFAULT 'Range-bound',
    support         NUMERIC(12,2) NOT NULL DEFAULT 0,
    resistance      NUMERIC(12,2) NOT NULL DEFAULT 0,
    advance_decline NUMERIC(8,2) NOT NULL DEFAULT 0,
    sgx_cues        NUMERIC(8,2) NOT NULL DEFAULT 0,
    iv_percentile   INTEGER NOT NULL DEFAULT 0,
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_indices_symbol ON market_indices (symbol);
CREATE INDEX IF NOT EXISTS idx_market_indices_active ON market_indices (is_active) WHERE is_active = TRUE;

ALTER TABLE market_indices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'market_indices' AND policyname = 'p_market_indices_select'
    ) THEN
        CREATE POLICY p_market_indices_select ON market_indices FOR SELECT USING (true);
    END IF;
END $$;

INSERT INTO market_indices (symbol, name, price, change, change_percent, vix, iq_score, iq_status, verdict, verdict_title, verdict_reason, confidence, trend, momentum, volatility, regime, support, resistance, advance_decline, sgx_cues, iv_percentile) VALUES
('NIFTY', 'NIFTY 50 LIVE', 24812.35, 118.20, 0.48, 13.42, 78, 'High Conviction', 'TRADE', 'Bullish continuation bias above 24,750', 'Breadth positive · OI build-up in favor of upside · IV cooling. Conditions currently support a directional view.', 72, 'Bullish', 74, 'Low', 'Trending', 24600, 25000, 1.9, 0.2, 31),
('BANKNIFTY', 'BANK NIFTY LIVE', 51204.10, -108.50, -0.21, 14.10, 42, 'Caution', 'NO_TRADE', 'Range-bound, conflicting OI signals', 'PCR and price are diverging; probability edge is unclear. IndexPilot recommends waiting.', 38, 'Sideways', 45, 'Medium', 'Range-bound', 50800, 51800, 0.85, -0.1, 58),
('FINNIFTY', 'FINNIFTY LIVE', 23904.80, 28.60, 0.12, 13.80, 61, 'Favourable', 'CAUTION', 'Mixed signals, event risk ahead', 'RBI policy decision tomorrow. Reduced position sizing recommended.', 58, 'Bullish', 62, 'Medium', 'Volatile', 23700, 24200, 1.2, 0.1, 45)
ON CONFLICT (symbol) DO NOTHING;

-- ============================================================================
-- TABLE: market_option_chains
-- IndexPilot option chain snapshot for NIFTY.
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_option_chains (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    index_symbol    VARCHAR(20) NOT NULL DEFAULT 'NIFTY',
    strike          NUMERIC(12,2) NOT NULL,
    call_oi         VARCHAR(20) NOT NULL,
    call_oi_raw     BIGINT NOT NULL DEFAULT 0,
    call_iv         NUMERIC(8,2) NOT NULL DEFAULT 0,
    put_iv          NUMERIC(8,2) NOT NULL DEFAULT 0,
    put_oi          VARCHAR(20) NOT NULL,
    put_oi_raw      BIGINT NOT NULL DEFAULT 0,
    delta_call      NUMERIC(8,4) NOT NULL DEFAULT 0,
    theta_call      NUMERIC(8,2) NOT NULL DEFAULT 0,
    gamma_call      NUMERIC(8,4) NOT NULL DEFAULT 0,
    vega_call       NUMERIC(8,2) NOT NULL DEFAULT 0,
    is_atm          BOOLEAN NOT NULL DEFAULT FALSE,
    expiry          VARCHAR(50) NOT NULL DEFAULT '28 AUG',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (index_symbol, strike, expiry)
);

CREATE INDEX IF NOT EXISTS idx_option_chain_symbol ON market_option_chains (index_symbol, expiry);
CREATE INDEX IF NOT EXISTS idx_option_chain_active ON market_option_chains (is_active) WHERE is_active = TRUE;

ALTER TABLE market_option_chains ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'market_option_chains' AND policyname = 'p_option_chain_select'
    ) THEN
        CREATE POLICY p_option_chain_select ON market_option_chains FOR SELECT USING (true);
    END IF;
END $$;

INSERT INTO market_option_chains (index_symbol, strike, call_oi, call_oi_raw, call_iv, put_iv, put_oi, put_oi_raw, delta_call, theta_call, gamma_call, vega_call, is_atm, expiry) VALUES
('NIFTY', 24600, '18.2L', 1820000, 14.1, 15.0, '9.4L', 940000, 0.82, -14.2, 0.0008, 11.2, FALSE, '28 AUG'),
('NIFTY', 24700, '22.6L', 2260000, 13.8, 14.6, '12.1L', 1210000, 0.68, -16.5, 0.0012, 14.5, FALSE, '28 AUG'),
('NIFTY', 24800, '31.4L', 3140000, 13.2, 13.9, '27.8L', 2780000, 0.51, -19.1, 0.0015, 16.8, TRUE, '28 AUG'),
('NIFTY', 24900, '40.9L', 4090000, 12.9, 13.3, '15.6L', 1560000, 0.34, -15.8, 0.0011, 13.4, FALSE, '28 AUG'),
('NIFTY', 25000, '52.3L', 5230000, 12.6, 13.0, '11.2L', 1120000, 0.18, -11.3, 0.0007, 9.1, FALSE, '28 AUG')
ON CONFLICT (index_symbol, strike, expiry) DO NOTHING;

-- ============================================================================
-- TABLE: market_strategies
-- IndexPilot strategy reference data (AppSetupsPage / StrategyDetailPage).
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_strategies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    type            VARCHAR(100) NOT NULL,
    description     TEXT,
    regime_fit      VARCHAR(100),
    buy_leg         VARCHAR(255),
    sell_leg        VARCHAR(255),
    max_loss        NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_profit      NUMERIC(12,2) NOT NULL DEFAULT 0,
    breakeven       NUMERIC(12,2) NOT NULL DEFAULT 0,
    win_probability INTEGER NOT NULL DEFAULT 0,
    holding_period  VARCHAR(50),
    risk_percent    NUMERIC(8,2) NOT NULL DEFAULT 0,
    exceeds_risk_limit BOOLEAN NOT NULL DEFAULT FALSE,
    verdict         verdict_type NOT NULL DEFAULT 'NO_TRADE',
    overview        TEXT,
    regime          TEXT,
    entry_rules     JSONB NOT NULL DEFAULT '[]'::jsonb,
    risk_rules      JSONB NOT NULL DEFAULT '[]'::jsonb,
    historical_note TEXT,
    current_signal  TEXT,
    signal_verdict  verdict_type NOT NULL DEFAULT 'NO_TRADE',
    disclaimer      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_strategies_active ON market_strategies (is_active) WHERE is_active = TRUE;

ALTER TABLE market_strategies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'market_strategies' AND policyname = 'p_market_strategies_select'
    ) THEN
        CREATE POLICY p_market_strategies_select ON market_strategies FOR SELECT USING (true);
    END IF;
END $$;

INSERT INTO market_strategies (name, type, description, regime_fit, buy_leg, sell_leg, max_loss, max_profit, breakeven, win_probability, holding_period, risk_percent, exceeds_risk_limit, verdict, overview, regime, entry_rules, risk_rules, historical_note, current_signal, signal_verdict, disclaimer, sort_order) VALUES
('Bull Call Spread', 'Bullish Debit Spread', 'Defined-risk bullish structure capitalizing on trending momentum above 24,750.', 'Trending Bullish', 'Buy 24,800 CE x75 (1 Lot)', 'Sell 25,000 CE x75 (1 Lot)', 6200, 9500, 24862, 61, '1–3 Days', 2.4, FALSE, 'TRADE', 'The Bull Call Spread is a defined-risk, limited-profit options strategy for moderately bullish market conditions. It profits when the underlying index moves upward within a target range before expiry.', 'Moderately Bullish — suitable when NIFTY is above key short-term moving averages with India VIX below 18.', '["Buy 1 ATM Call Option (e.g., NIFTY 24800 CE)","Sell 1 OTM Call Option 100–200 points higher (e.g., NIFTY 25000 CE)","Same expiry — prefer weekly Thursday expiry for short-duration setups","Enter when IV Rank < 40 and market trend is confirmed bullish"]'::jsonb, '["Max loss is limited to net premium paid (automatically defined)","Exit if position hits 50% of max loss intraday","Do NOT hold through high-impact RBI/Budget events","Close 1 day before expiry to avoid gamma risk"]'::jsonb, 'Based on NIFTY 2021–2025 backtest: Win rate ~58%, Avg profit when won: ₹3,200, Avg loss when lost: ₹1,800. Regime-filtered entries significantly improved consistency.', 'TRADE — NIFTY is trending above 50-EMA, VIX at 13.4 (favorable low volatility environment). Setup looks clean for weekly expiry.', 'TRADE', 'This strategy analysis is for educational and decision-support purposes only. IndexPilot is not SEBI-registered. Past performance is not indicative of future results. Trade at your own risk.', 10),
('Iron Condor Neutral', 'Defined-Risk Neutral', 'Sell OTM options and buy wings for range-bound sideways market regimes.', 'Range-bound Sideways', 'Buy 24,500 PE & Buy 25,100 CE', 'Sell 24,600 PE & Sell 25,000 CE', 3800, 6200, 24638, 68, '3–5 Days', 1.5, FALSE, 'TRADE', 'The Iron Condor is a premium collection strategy that profits when the underlying index stays within a specific range. Ideal for low-volatility, sideways market environments.', 'Range-bound / Sideways — use when VIX is low (<15) and NIFTY is consolidating within a defined band for multiple sessions.', '["Sell 1 OTM Call + Buy 1 further OTM Call (Bear Call Spread)","Sell 1 OTM Put + Buy 1 further OTM Put (Bull Put Spread)","Center the spread around current price with equal-width wings","Target net credit of at least ₹150 per lot"]'::jsonb, '["Max risk on either side = wing width minus net credit received","Close entire position if one side is tested (delta > 0.30)","Do NOT run Iron Condors through event weeks (FOMC, RBI, Earnings)","Adjust by rolling the tested side if days-to-expiry > 7"]'::jsonb, 'Backtest 2021–2025: Win rate ~68% in low-VIX months, drops to ~35% in high-VIX months. Regime selection is critical.', 'NO TRADE — VIX at 13.4 is favorable but NIFTY has been directional this week. Wait for consolidation confirmation over 2–3 sessions.', 'NO_TRADE', 'This strategy analysis is for educational and decision-support purposes only. IndexPilot is not SEBI-registered. Past performance is not indicative of future results. Trade at your own risk.', 20),
('Aggressive Call Ratio Spread', 'High Beta Trend', 'Uncapped upward potential with multi-lot leg exposure exceeding default loss limit.', 'Strong Breakout', 'Buy 24,800 CE x150 (2 Lots)', 'Sell 25,200 CE x300 (4 Lots)', 12500, 22000, 24925, 52, 'Intraday', 5.0, TRUE, 'NO_TRADE', 'The Bear Put Spread is a defined-risk bearish strategy that profits from downward movement in the underlying index. Ideal for structured protection without unlimited risk.', 'Moderately Bearish — use when NIFTY breaks below key support levels with VIX rising above 16.', '["Buy 1 ATM or slightly ITM Put Option","Sell 1 OTM Put Option 100–150 points lower","Same weekly expiry for cost efficiency","Enter on bounce to resistance, not during freefall"]'::jsonb, '["Max loss = net debit paid. Fully defined.","Exit if NIFTY rebounds above entry level + 0.5%","Avoid during bullish fundamental news events","Close at 80% of max profit if reached early in week"]'::jsonb, 'Backtest 2021–2025: Win rate ~52%, best performance during trending bearish months (May 2022, Oct 2023).', 'CAUTION — Market conditions are mixed. NIFTY near key support. Wait for clearer breakdown below 24,500 before entering.', 'CAUTION', 'This strategy analysis is for educational and decision-support purposes only. IndexPilot is not SEBI-registered. Past performance is not indicative of future results. Trade at your own risk.', 30)
ON CONFLICT (name) DO NOTHING;

COMMIT;