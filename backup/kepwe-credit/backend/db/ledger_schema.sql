-- ============================================================================
-- KEPWE LEDGER — Persistent Financial Management Schema
-- Handles: Accounts, Transactions, Receivables (Invoices), Receivable Payments,
--          Payables (Bills), Payable Payments, Categories, Settings, Audit Logs
-- ============================================================================

BEGIN;

-- 1. LEDGER ACCOUNTS
CREATE TABLE IF NOT EXISTS ledger_accounts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id         UUID REFERENCES companies(id) ON DELETE SET NULL,
    name               VARCHAR(100) NOT NULL,
    type               VARCHAR(50) NOT NULL DEFAULT 'Bank Account', -- 'Bank Account', 'Cash', 'UPI', 'Wallet', 'Other'
    account_number     VARCHAR(50),
    bank_name          VARCHAR(100),
    ifsc_code          VARCHAR(20),
    upi_id             VARCHAR(100),
    opening_balance    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    current_balance    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    currency           VARCHAR(10) NOT NULL DEFAULT 'INR',
    is_default         BOOLEAN NOT NULL DEFAULT FALSE,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_user ON ledger_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_company ON ledger_accounts (company_id);

-- 2. LEDGER CATEGORIES
CREATE TABLE IF NOT EXISTS ledger_categories (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for system-wide defaults
    type               VARCHAR(20) NOT NULL, -- 'income', 'expense'
    name               VARCHAR(100) NOT NULL,
    color              VARCHAR(20) DEFAULT '#214ECF',
    icon               VARCHAR(50) DEFAULT 'Tag',
    is_system          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_categories_user ON ledger_categories (user_id, type);

-- 3. LEDGER RECEIVABLES (Customer Invoices)
CREATE TABLE IF NOT EXISTS ledger_receivables (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id         UUID REFERENCES companies(id) ON DELETE SET NULL,
    invoice_number     VARCHAR(50) NOT NULL,
    customer_name      VARCHAR(255) NOT NULL,
    customer_email     VARCHAR(255),
    customer_phone     VARCHAR(50),
    customer_gstin     VARCHAR(20),
    issue_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date           DATE NOT NULL,
    subtotal           NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    tax_amount         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_amount       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    paid_amount        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status             VARCHAR(30) NOT NULL DEFAULT 'Pending', -- 'Draft', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'
    items              JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes              TEXT,
    attachment_url     TEXT,
    attachment_name    TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_receivables_user ON ledger_receivables (user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_receivables_status ON ledger_receivables (status);
CREATE INDEX IF NOT EXISTS idx_ledger_receivables_due ON ledger_receivables (due_date);

-- 4. LEDGER PAYABLES (Vendor Bills)
CREATE TABLE IF NOT EXISTS ledger_payables (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id         UUID REFERENCES companies(id) ON DELETE SET NULL,
    bill_number        VARCHAR(50) NOT NULL,
    vendor_name        VARCHAR(255) NOT NULL,
    vendor_email       VARCHAR(255),
    vendor_phone       VARCHAR(50),
    vendor_gstin       VARCHAR(20),
    bill_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date           DATE NOT NULL,
    category           VARCHAR(100) DEFAULT 'Purchases',
    subtotal           NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    tax_amount         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_amount       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    paid_amount        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status             VARCHAR(30) NOT NULL DEFAULT 'Pending', -- 'Draft', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'
    items              JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes              TEXT,
    attachment_url     TEXT,
    attachment_name    TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_payables_user ON ledger_payables (user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_payables_status ON ledger_payables (status);
CREATE INDEX IF NOT EXISTS idx_ledger_payables_due ON ledger_payables (due_date);

-- 5. LEDGER TRANSACTIONS
CREATE TABLE IF NOT EXISTS ledger_transactions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id         UUID REFERENCES companies(id) ON DELETE SET NULL,
    account_id         UUID REFERENCES ledger_accounts(id) ON DELETE SET NULL,
    type               VARCHAR(20) NOT NULL, -- 'income', 'expense', 'transfer'
    amount             NUMERIC(15,2) NOT NULL,
    transaction_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    category           VARCHAR(100) NOT NULL,
    counterparty       VARCHAR(255), -- Customer or Vendor name
    description        TEXT,
    payment_method     VARCHAR(50) DEFAULT 'UPI', -- 'UPI', 'Bank Transfer', 'Cash', 'Card', 'Cheque', 'Other'
    reference_number   VARCHAR(100),
    status             VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'completed', 'pending', 'cancelled'
    receivable_id      UUID REFERENCES ledger_receivables(id) ON DELETE SET NULL,
    payable_id         UUID REFERENCES ledger_payables(id) ON DELETE SET NULL,
    attachment_url     TEXT,
    attachment_name    TEXT,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_transactions_user ON ledger_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_date ON ledger_transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_account ON ledger_transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_type ON ledger_transactions (type);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_category ON ledger_transactions (category);

-- 6. LEDGER RECEIVABLE PAYMENTS
CREATE TABLE IF NOT EXISTS ledger_receivable_payments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receivable_id      UUID NOT NULL REFERENCES ledger_receivables(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id         UUID REFERENCES ledger_accounts(id) ON DELETE SET NULL,
    transaction_id     UUID REFERENCES ledger_transactions(id) ON DELETE SET NULL,
    amount             NUMERIC(15,2) NOT NULL,
    payment_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method     VARCHAR(50) DEFAULT 'UPI',
    reference_number   VARCHAR(100),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_rec_payments_rec ON ledger_receivable_payments (receivable_id);
CREATE INDEX IF NOT EXISTS idx_ledger_rec_payments_user ON ledger_receivable_payments (user_id);

-- 7. LEDGER PAYABLE PAYMENTS
CREATE TABLE IF NOT EXISTS ledger_payable_payments (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payable_id         UUID NOT NULL REFERENCES ledger_payables(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id         UUID REFERENCES ledger_accounts(id) ON DELETE SET NULL,
    transaction_id     UUID REFERENCES ledger_transactions(id) ON DELETE SET NULL,
    amount             NUMERIC(15,2) NOT NULL,
    payment_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method     VARCHAR(50) DEFAULT 'Bank Transfer',
    reference_number   VARCHAR(100),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_pay_payments_pay ON ledger_payable_payments (payable_id);
CREATE INDEX IF NOT EXISTS idx_ledger_pay_payments_user ON ledger_payable_payments (user_id);

-- 8. LEDGER SETTINGS
CREATE TABLE IF NOT EXISTS ledger_settings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    company_id         UUID REFERENCES companies(id) ON DELETE SET NULL,
    business_name      VARCHAR(255),
    gstin              VARCHAR(20),
    pan                VARCHAR(20),
    currency           VARCHAR(10) NOT NULL DEFAULT 'INR',
    currency_symbol    VARCHAR(5) NOT NULL DEFAULT '₹',
    fiscal_year_start  VARCHAR(10) NOT NULL DEFAULT '04-01',
    default_account_id UUID REFERENCES ledger_accounts(id) ON DELETE SET NULL,
    notify_overdue     BOOLEAN NOT NULL DEFAULT TRUE,
    notify_payments    BOOLEAN NOT NULL DEFAULT TRUE,
    preferences        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_settings_user ON ledger_settings (user_id);

-- 9. LEDGER AUDIT LOGS
CREATE TABLE IF NOT EXISTS ledger_audit_logs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action             VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'PAYMENT_RECORDED'
    entity_type        VARCHAR(50) NOT NULL, -- 'TRANSACTION', 'RECEIVABLE', 'PAYABLE', 'ACCOUNT'
    entity_id          UUID,
    details            JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_audit_user ON ledger_audit_logs (user_id, created_at DESC);

-- 10. ROW-LEVEL SECURITY
ALTER TABLE ledger_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_receivables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_payables            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_receivable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_payable_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_audit_logs          ENABLE ROW LEVEL SECURITY;

-- Accounts
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p_ledger_accounts_user') THEN
        CREATE POLICY p_ledger_accounts_user ON ledger_accounts FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Categories
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p_ledger_categories_user') THEN
        CREATE POLICY p_ledger_categories_user ON ledger_categories FOR ALL USING (user_id IS NULL OR user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Receivables
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p_ledger_receivables_user') THEN
        CREATE POLICY p_ledger_receivables_user ON ledger_receivables FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Payables
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p_ledger_payables_user') THEN
        CREATE POLICY p_ledger_payables_user ON ledger_payables FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Transactions
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p_ledger_transactions_user') THEN
        CREATE POLICY p_ledger_transactions_user ON ledger_transactions FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Receivable Payments
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p_ledger_rec_payments_user') THEN
        CREATE POLICY p_ledger_rec_payments_user ON ledger_receivable_payments FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Payable Payments
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p_ledger_pay_payments_user') THEN
        CREATE POLICY p_ledger_pay_payments_user ON ledger_payable_payments FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Settings
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p_ledger_settings_user') THEN
        CREATE POLICY p_ledger_settings_user ON ledger_settings FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- Audit Logs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'p_ledger_audit_user') THEN
        CREATE POLICY p_ledger_audit_user ON ledger_audit_logs FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid);
    END IF;
END $$;

-- 11. DEFAULT SYSTEM CATEGORIES
INSERT INTO ledger_categories (user_id, type, name, color, icon, is_system) VALUES
    (NULL, 'income', 'Sales Revenue', '#10B981', 'TrendingUp', TRUE),
    (NULL, 'income', 'Consulting & Services', '#059669', 'Briefcase', TRUE),
    (NULL, 'income', 'Interest & Investment', '#3B82F6', 'PieChart', TRUE),
    (NULL, 'income', 'Rental Income', '#6366F1', 'Building', TRUE),
    (NULL, 'income', 'Other Income', '#8B5CF6', 'PlusCircle', TRUE),
    (NULL, 'expense', 'Office Rent & Utilities', '#EF4444', 'Building2', TRUE),
    (NULL, 'expense', 'Salaries & Contractor Fees', '#F59E0B', 'Users', TRUE),
    (NULL, 'expense', 'Software & Cloud Tools', '#3B82F6', 'Laptop', TRUE),
    (NULL, 'expense', 'Marketing & Advertising', '#EC4899', 'Megaphone', TRUE),
    (NULL, 'expense', 'Inventory & Supplies', '#8B5CF6', 'Package', TRUE),
    (NULL, 'expense', 'Travel & Transport', '#14B8A6', 'Car', TRUE),
    (NULL, 'expense', 'Legal & Professional Fees', '#64748B', 'Scale', TRUE),
    (NULL, 'expense', 'Taxes & Statutory Fees', '#DC2626', 'Receipt', TRUE),
    (NULL, 'expense', 'General & Administrative', '#6B7280', 'MoreHorizontal', TRUE)
ON CONFLICT DO NOTHING;

COMMIT;
