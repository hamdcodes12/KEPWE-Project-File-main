-- ============================================================================
-- KEPWE — Aadhaar KYC Verifications Schema
-- Server-side identity verification, document classification, OTP tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS aadhaar_kyc_verifications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              VARCHAR(100),
    user_id                 UUID REFERENCES users(id) ON DELETE SET NULL,
    client_ip               TEXT,
    applicant_name          VARCHAR(255) NOT NULL,
    pan_number              VARCHAR(10),
    aadhaar_number_masked   VARCHAR(20) NOT NULL,
    aadhaar_hash            VARCHAR(64) NOT NULL,
    dob                     DATE NOT NULL,
    gender                  VARCHAR(20) DEFAULT 'male',
    mobile_masked           VARCHAR(20) NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
    front_doc_status        VARCHAR(50) DEFAULT 'PENDING',
    front_doc_confidence    NUMERIC(5,2) DEFAULT 0,
    front_doc_error         TEXT,
    back_doc_status         VARCHAR(50) DEFAULT 'PENDING',
    back_doc_confidence     NUMERIC(5,2) DEFAULT 0,
    back_doc_error          TEXT,
    extracted_aadhaar_last4 VARCHAR(4),
    extracted_name          VARCHAR(255),
    extracted_dob           DATE,
    extracted_gender        VARCHAR(20),
    extracted_pincode       VARCHAR(10),
    name_match_score        NUMERIC(5,2) DEFAULT 0,
    dob_match               BOOLEAN DEFAULT FALSE,
    provider_name           VARCHAR(50) NOT NULL DEFAULT 'sandbox',
    provider_tx_id          VARCHAR(100),
    provider_ref_id         VARCHAR(100),
    otp_attempts            INTEGER NOT NULL DEFAULT 0,
    max_otp_attempts        INTEGER NOT NULL DEFAULT 3,
    otp_expires_at          TIMESTAMPTZ,
    resend_available_at     TIMESTAMPTZ,
    resend_count            INTEGER NOT NULL DEFAULT 0,
    failure_reason          TEXT,
    verification_token      TEXT,
    verified_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aadhaar_kyc_hash ON aadhaar_kyc_verifications (aadhaar_hash);
CREATE INDEX IF NOT EXISTS idx_aadhaar_kyc_session ON aadhaar_kyc_verifications (session_id);
CREATE INDEX IF NOT EXISTS idx_aadhaar_kyc_status ON aadhaar_kyc_verifications (status);
CREATE INDEX IF NOT EXISTS idx_aadhaar_kyc_user ON aadhaar_kyc_verifications (user_id);
CREATE INDEX IF NOT EXISTS idx_aadhaar_kyc_created ON aadhaar_kyc_verifications (created_at DESC);
