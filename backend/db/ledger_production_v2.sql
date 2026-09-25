-- ============================================================================
-- KEPWE LEDGER PRODUCTION V2 — Persistent Idempotency & GST Period Locks
-- ============================================================================

BEGIN;

-- ── 1. GST TAX-PERIOD LOCKS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_tax_period_locks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    tax_period  VARCHAR(20) NOT NULL,
    locked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tax_period_lock UNIQUE (company_id, tax_period)
);

CREATE INDEX IF NOT EXISTS idx_gst_period_locks_company ON gst_tax_period_locks (company_id, tax_period);

-- ── 2. IDEMPOTENCY RECORDS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS idempotency_records (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key                  VARCHAR(255) NOT NULL,
    request_fingerprint  VARCHAR(255),
    company_id           UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id              UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint             VARCHAR(255) NOT NULL,
    status               VARCHAR(50) NOT NULL DEFAULT 'IN_FLIGHT', -- 'IN_FLIGHT', 'COMPLETED', 'FAILED'
    response_status_code INTEGER,
    response_headers     JSONB DEFAULT '{}'::jsonb,
    response_body        JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    CONSTRAINT uq_idempotency_key UNIQUE (key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_records (key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_records (expires_at);

COMMIT;
