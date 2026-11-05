-- ============================================================================
-- KEPWE LEDGER PRD PHASE 6 — ADD / UPLOAD FINANCIAL DATA SCHEMA EXTENSION
-- ============================================================================

BEGIN;

-- 1. Extend ledger_statement_imports with source_type, institution, closing_balance, raw_metadata
ALTER TABLE ledger_statement_imports ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'BANK_STATEMENT';
ALTER TABLE ledger_statement_imports ADD COLUMN IF NOT EXISTS institution VARCHAR(100);
ALTER TABLE ledger_statement_imports ADD COLUMN IF NOT EXISTS closing_balance NUMERIC(15,2);
ALTER TABLE ledger_statement_imports ADD COLUMN IF NOT EXISTS raw_metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Extend ledger_transactions with statement_import_id and balance
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS statement_import_id UUID REFERENCES ledger_statement_imports(id) ON DELETE SET NULL;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS balance NUMERIC(15,2);

-- 3. Indexes for fast query, user isolation, and duplicate lookup
CREATE INDEX IF NOT EXISTS idx_ledger_tx_user_stmt ON ledger_transactions (user_id, statement_import_id);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_user_dt_amt ON ledger_transactions (user_id, transaction_date, amount);
CREATE INDEX IF NOT EXISTS idx_ledger_stmt_user_created ON ledger_statement_imports (user_id, created_at DESC);

COMMIT;
