BEGIN;

ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS debit NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS credit NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS running_balance NUMERIC(15,2);
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS bank VARCHAR(100);
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64);
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_transaction_fingerprint ON ledger_transactions (user_id, fingerprint) WHERE fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS ledger_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES ledger_accounts(id) ON DELETE SET NULL, file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
  imported_count INTEGER NOT NULL DEFAULT 0, duplicate_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0, failed_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ledger_statement_imports ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ledger_statement_imports ADD COLUMN IF NOT EXISTS failed_rows JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_ledger_statement_imports_user ON ledger_statement_imports(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ledger_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'MATCHED', matched_transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE SET NULL,
  notes TEXT, reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_reconciliations_user ON ledger_reconciliations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ledger_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL, provider_payment_id VARCHAR(255), provider_order_id VARCHAR(255),
  amount NUMERIC(15,2) NOT NULL, currency VARCHAR(10) NOT NULL DEFAULT 'INR', status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
  method VARCHAR(30), metadata JSONB NOT NULL DEFAULT '{}'::jsonb, transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_ledger_payments_user ON ledger_payments(user_id, created_at DESC);
ALTER TABLE ledger_payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES ledger_receivables(id) ON DELETE SET NULL;
ALTER TABLE ledger_payments ADD COLUMN IF NOT EXISTS receivable_id UUID REFERENCES ledger_receivables(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS ledger_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payment_id UUID NOT NULL REFERENCES ledger_payments(id) ON DELETE CASCADE,
  provider_refund_id VARCHAR(255) UNIQUE, amount NUMERIC(15,2) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ledger_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL, provider_settlement_id VARCHAR(255) UNIQUE, amount NUMERIC(15,2), status VARCHAR(30),
  settled_at TIMESTAMPTZ, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ledger_settlements ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(15,2);
ALTER TABLE ledger_settlements ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE ledger_settlements ADD COLUMN IF NOT EXISTS net_amount NUMERIC(15,2);
ALTER TABLE ledger_settlements ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS ledger_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider VARCHAR(30) NOT NULL, event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL, signature_valid BOOLEAN NOT NULL, payload JSONB NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED', error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), processed_at TIMESTAMPTZ,
  UNIQUE(provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_ledger_webhooks_created ON ledger_webhooks(created_at DESC);

CREATE TABLE IF NOT EXISTS ledger_aa_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL, provider_consent_id VARCHAR(255), status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
  accounts JSONB NOT NULL DEFAULT '[]'::jsonb, expires_at TIMESTAMPTZ, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ledger_fi_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), consent_id UUID NOT NULL REFERENCES ledger_aa_consents(id) ON DELETE CASCADE,
  provider_request_id VARCHAR(255), status VARCHAR(30) NOT NULL DEFAULT 'CREATED', requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ, metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ledger_aa_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL, provider_account_id VARCHAR(255) NOT NULL,
  consent_id UUID REFERENCES ledger_aa_consents(id) ON DELETE SET NULL,
  fip_id VARCHAR(255), masked_account_number VARCHAR(100), account_type VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'DISCOVERED', metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  connection_status VARCHAR(30) NOT NULL DEFAULT 'DISCOVERED', last_synced_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider, provider_account_id)
);
ALTER TABLE ledger_aa_accounts ADD COLUMN IF NOT EXISTS connection_status VARCHAR(30) NOT NULL DEFAULT 'DISCOVERED';
ALTER TABLE ledger_aa_accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE ledger_aa_accounts ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_ledger_aa_accounts_user ON ledger_aa_accounts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ledger_aa_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  consent_id UUID REFERENCES ledger_aa_consents(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL, event_type VARCHAR(80) NOT NULL,
  provider_event_id VARCHAR(255), payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_ledger_aa_events_consent ON ledger_aa_events(consent_id, created_at DESC);

COMMIT;