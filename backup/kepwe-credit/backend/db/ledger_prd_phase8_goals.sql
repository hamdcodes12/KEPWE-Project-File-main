-- ============================================================================
-- KEPWE LEDGER PRD PHASE 8: SAVINGS GOAL ENGINE SCHEMA
-- Adds:
-- 1. ledger_goals table (user goals, target amounts, current progress, target dates, priorities, contributions)
-- 2. Indexes for user isolation and fast query retrieval
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ledger_goals (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                 VARCHAR(150) NOT NULL,
    type                 VARCHAR(50) NOT NULL DEFAULT 'Other',
    category             VARCHAR(100),
    target_amount        NUMERIC(15,2) NOT NULL,
    current_amount       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    target_date          DATE,
    monthly_contribution NUMERIC(15,2) DEFAULT 0.00,
    priority             VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
    status               VARCHAR(30) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'paused'
    color                VARCHAR(30) DEFAULT '#214ECF',
    icon                 VARCHAR(50) DEFAULT 'Target',
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_goals_user ON ledger_goals (user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_goals_status ON ledger_goals (user_id, status);

COMMIT;
