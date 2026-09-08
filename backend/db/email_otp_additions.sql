-- KEPWE email OTP authentication challenges
BEGIN;

CREATE TABLE IF NOT EXISTS email_otp_challenges (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 CITEXT NOT NULL,
    purpose               VARCHAR(20) NOT NULL CHECK (purpose IN ('login', 'signup')),
    otp_hash              CHAR(64) NOT NULL,
    payload               JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempts              INTEGER NOT NULL DEFAULT 0,
    max_attempts          INTEGER NOT NULL DEFAULT 5,
    expires_at            TIMESTAMPTZ NOT NULL,
    resend_available_at   TIMESTAMPTZ NOT NULL,
    consumed_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_otp_lookup
    ON email_otp_challenges (email, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_otp_expiry
    ON email_otp_challenges (expires_at)
    WHERE consumed_at IS NULL;

COMMIT;
