-- ============================================================================
-- Migration: Razorpay Payments Table
-- Run this once against the live database to add payment tracking.
-- Idempotent: all statements are wrapped in DO blocks or use IF NOT EXISTS.
-- ============================================================================

BEGIN;

-- ── ENUM: payment_status_type ────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM (
        'pending',      -- Razorpay order created, user has not yet paid
        'paid',         -- Razorpay signature verified, subscription activated
        'failed',       -- Payment attempt failed (user declined / network error)
        'cancelled'     -- User dismissed the checkout without paying
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ── TABLE: payments ──────────────────────────────────────────────────────────
-- Stores every Razorpay payment attempt. One row per Razorpay order.
-- A subscription is only activated once status = 'paid'.
-- This table is the audit trail — billing_history is only written after
-- successful verification.
CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_name           VARCHAR(100) NOT NULL,   -- e.g. '3 MONTHS'
    amount_paise        INTEGER NOT NULL,         -- Razorpay amounts are in paise (₹1 = 100 paise)
    currency            VARCHAR(10) NOT NULL DEFAULT 'INR',
    razorpay_order_id   VARCHAR(100) NOT NULL UNIQUE, -- rp order_id from orders.create()
    razorpay_payment_id VARCHAR(100),            -- set after checkout handler fires
    razorpay_signature  VARCHAR(500),            -- HMAC-SHA256 from Razorpay; verified server-side
    status              payment_status_type NOT NULL DEFAULT 'pending',
    failure_reason      TEXT,                    -- human-readable reason for failed/cancelled
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at         TIMESTAMPTZ              -- set when signature is verified and subscription activated
);

CREATE INDEX IF NOT EXISTS idx_payments_user        ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order       ON payments (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created     ON payments (created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own payment records.
DO $$ BEGIN
    CREATE POLICY p_payments_owner ON payments
        FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
