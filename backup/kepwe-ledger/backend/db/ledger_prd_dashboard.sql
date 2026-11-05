-- ============================================================================
-- KEPWE LEDGER PRD DASHBOARD SCHEMA EXTENSION
-- Adds:
-- 1. PRD transaction intelligence attributes (merchant, subcategory, classification, is_recurring, is_essential, confidence)
-- 2. User financial profile (income breakdown, obligations, emergency savings, targets)
-- 3. PRD category classifications (Essential, Lifestyle, Financial, Other)
-- 4. Seed system PRD categories
-- ============================================================================

BEGIN;

-- 1. Extend ledger_transactions with PRD transaction intelligence fields
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS merchant VARCHAR(255);
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS classification VARCHAR(50); -- 'Essential', 'Lifestyle', 'Financial', 'Other'
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS is_essential BOOLEAN;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,2) DEFAULT 1.0;

CREATE INDEX IF NOT EXISTS idx_ledger_tx_user_class ON ledger_transactions (user_id, classification);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_user_recurring ON ledger_transactions (user_id, is_recurring);

-- 2. User Financial Profile Table (PRD Section 11 & Section 68)
CREATE TABLE IF NOT EXISTS ledger_financial_profiles (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    monthly_income           NUMERIC(15,2) DEFAULT 0.00,
    salary_income            NUMERIC(15,2) DEFAULT 0.00,
    business_income          NUMERIC(15,2) DEFAULT 0.00,
    freelance_income         NUMERIC(15,2) DEFAULT 0.00,
    rental_income            NUMERIC(15,2) DEFAULT 0.00,
    other_income             NUMERIC(15,2) DEFAULT 0.00,
    monthly_debt_obligations NUMERIC(15,2) DEFAULT 0.00,
    emergency_savings        NUMERIC(15,2) DEFAULT 0.00,
    emergency_fund_target    NUMERIC(15,2) DEFAULT 0.00,
    monthly_savings_target   NUMERIC(15,2) DEFAULT 0.00,
    occupation               VARCHAR(100),
    city                     VARCHAR(100),
    age                      INTEGER,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_fin_profiles_user ON ledger_financial_profiles (user_id);

-- 3. Extend ledger_categories with classification
ALTER TABLE ledger_categories ADD COLUMN IF NOT EXISTS classification VARCHAR(50);

-- Deduplicate existing category rows before creating unique index
DELETE FROM ledger_categories a
USING ledger_categories b
WHERE a.ctid < b.ctid
  AND COALESCE(a.user_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.user_id, '00000000-0000-0000-0000-000000000000')
  AND a.type = b.type
  AND a.name = b.name;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_categories_name_user 
    ON ledger_categories (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), type, name);

-- 4. Seed PRD Categories (PRD Section 14)
INSERT INTO ledger_categories (user_id, type, name, color, icon, classification, is_system) VALUES
    -- Income Sources
    (NULL, 'income', 'Salary', '#10B981', 'Briefcase', 'Income', TRUE),
    (NULL, 'income', 'Business Income', '#059669', 'Building2', 'Income', TRUE),
    (NULL, 'income', 'Freelance Income', '#0D9488', 'Laptop', 'Income', TRUE),
    (NULL, 'income', 'Rental Income', '#6366F1', 'Home', 'Income', TRUE),
    (NULL, 'income', 'Investment Returns', '#3B82F6', 'TrendingUp', 'Income', TRUE),
    (NULL, 'income', 'Other Income', '#8B5CF6', 'PlusCircle', 'Income', TRUE),

    -- Essential Expenses (PRD Section 14)
    (NULL, 'expense', 'Rent', '#EF4444', 'Home', 'Essential', TRUE),
    (NULL, 'expense', 'Electricity', '#F59E0B', 'Zap', 'Essential', TRUE),
    (NULL, 'expense', 'Water', '#06B6D4', 'Droplets', 'Essential', TRUE),
    (NULL, 'expense', 'Groceries', '#10B981', 'ShoppingCart', 'Essential', TRUE),
    (NULL, 'expense', 'Education', '#8B5CF6', 'GraduationCap', 'Essential', TRUE),
    (NULL, 'expense', 'Medical', '#EC4899', 'HeartPulse', 'Essential', TRUE),
    (NULL, 'expense', 'Insurance', '#3B82F6', 'Shield', 'Essential', TRUE),
    (NULL, 'expense', 'Transportation', '#64748B', 'Car', 'Essential', TRUE),

    -- Lifestyle Expenses (PRD Section 14)
    (NULL, 'expense', 'Restaurants', '#F97316', 'Utensils', 'Lifestyle', TRUE),
    (NULL, 'expense', 'Food Delivery', '#EA580C', 'Bike', 'Lifestyle', TRUE),
    (NULL, 'expense', 'Entertainment', '#A855F7', 'Film', 'Lifestyle', TRUE),
    (NULL, 'expense', 'Shopping', '#EC4899', 'ShoppingBag', 'Lifestyle', TRUE),
    (NULL, 'expense', 'Travel', '#0284C7', 'Plane', 'Lifestyle', TRUE),
    (NULL, 'expense', 'Movies', '#8B5CF6', 'Clapperboard', 'Lifestyle', TRUE),
    (NULL, 'expense', 'Gaming', '#6366F1', 'Gamepad2', 'Lifestyle', TRUE),

    -- Financial Allocations / Obligations (PRD Section 14)
    (NULL, 'expense', 'EMI', '#DC2626', 'CreditCard', 'Financial', TRUE),
    (NULL, 'expense', 'Loan Repayment', '#B91C1C', 'Landmark', 'Financial', TRUE),
    (NULL, 'expense', 'Credit Card Payment', '#E11D48', 'CreditCard', 'Financial', TRUE),
    (NULL, 'expense', 'Investment', '#2563EB', 'PiggyBank', 'Financial', TRUE),

    -- Other Expenses (PRD Section 14)
    (NULL, 'expense', 'Transfers', '#64748B', 'ArrowRightLeft', 'Other', TRUE),
    (NULL, 'expense', 'Cash Withdrawal', '#475569', 'Banknote', 'Other', TRUE),
    (NULL, 'expense', 'Bank Charges', '#94A3B8', 'AlertCircle', 'Other', TRUE),
    (NULL, 'expense', 'Taxes', '#DC2626', 'Receipt', 'Other', TRUE),
    (NULL, 'expense', 'Miscellaneous', '#6B7280', 'MoreHorizontal', 'Other', TRUE)
ON CONFLICT (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), type, name) DO NOTHING;

COMMIT;
