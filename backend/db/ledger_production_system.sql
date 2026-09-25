-- ============================================================================
-- KEPWE LEDGER PRODUCTION SYSTEM — Complete Accounting & Compliance Schema
-- Idempotent, safe migration extending KEPWE with:
-- 1. Company Accounting Profiles & Isolation
-- 2. Chart of Accounts (COA)
-- 3. Double-Entry Accounting Engine (Journals & Lines)
-- 4. GST Invoices, Items, & Credit/Debit Notes
-- 5. GST Returns & Reconciliation Data
-- 6. TDS Engine (Rules, Deductions, ITNS 281 Challans, Form 26Q)
-- 7. Payroll Engine (Employees, Structures, Monthly Runs, Payslips)
-- 8. Bank Reconciliation Engine (Statements, Lines, Matching Engine)
-- 9. Fixed Assets Register & Depreciation
-- 10. Configurable Compliance Rules & Calendar Tasks
-- 11. Filing Preparation & CA Approval Workflow
-- 12. Integration Providers & API Logs (Credentials Abstraction)
-- 13. Comprehensive Immutable Audit Trail
-- ============================================================================

BEGIN;

-- ── 1. COMPANY ACCOUNTING PROFILES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_accounting_profiles (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID REFERENCES companies(id) ON DELETE CASCADE,
    legal_name             VARCHAR(255) NOT NULL,
    trade_name             VARCHAR(255),
    pan                    VARCHAR(10),
    tan                    VARCHAR(10),
    gstin                  VARCHAR(15),
    cin                    VARCHAR(21),
    entity_type            VARCHAR(50) NOT NULL DEFAULT 'Private Limited', -- 'Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited'
    registered_address     TEXT,
    state                  VARCHAR(100) NOT NULL DEFAULT 'Maharashtra',
    state_code             VARCHAR(2) NOT NULL DEFAULT '27',
    pincode                VARCHAR(10),
    financial_year_start   VARCHAR(10) NOT NULL DEFAULT '04-01',
    financial_year_end     VARCHAR(10) NOT NULL DEFAULT '03-31',
    gst_registration_type  VARCHAR(50) NOT NULL DEFAULT 'Regular', -- 'Regular', 'Composition', 'SEZ', 'Exempt'
    book_begin_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    lock_date              DATE, -- transactions on or before lock_date cannot be modified
    bank_accounts          JSONB NOT NULL DEFAULT '[]'::jsonb,
    directors              JSONB NOT NULL DEFAULT '[]'::jsonb,
    employees_count        INTEGER NOT NULL DEFAULT 0,
    accounting_settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
    unique_company_id      VARCHAR(50) UNIQUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_company ON company_accounting_profiles (company_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_gstin   ON company_accounting_profiles (gstin);
CREATE INDEX IF NOT EXISTS idx_company_profiles_pan     ON company_accounting_profiles (pan);

-- ── 2. CHART OF ACCOUNTS (COA) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    code               VARCHAR(20) NOT NULL,
    name               VARCHAR(100) NOT NULL,
    type               VARCHAR(20) NOT NULL, -- 'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'
    subtype            VARCHAR(50) NOT NULL, -- 'BANK', 'CASH', 'ACCOUNTS_RECEIVABLE', 'INVENTORY', 'FIXED_ASSET', 'ACCOUNTS_PAYABLE', 'GST_PAYABLE', 'TDS_PAYABLE', 'LOAN', 'EQUITY', 'SALES_REVENUE', 'OTHER_INCOME', 'OPERATING_EXPENSE', 'PAYROLL_EXPENSE', 'DEPRECIATION_EXPENSE'
    normal_balance     VARCHAR(10) NOT NULL, -- 'DEBIT', 'CREDIT'
    description        TEXT,
    is_system          BOOLEAN NOT NULL DEFAULT FALSE,
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    current_balance    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_coa_company_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coa_company ON chart_of_accounts (company_id);
CREATE INDEX IF NOT EXISTS idx_coa_type    ON chart_of_accounts (company_id, type);
CREATE INDEX IF NOT EXISTS idx_coa_subtype ON chart_of_accounts (company_id, subtype);

-- ── 3. DOUBLE-ENTRY ACCOUNTING ENGINE (JOURNALS & LINES) ─────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
    entry_number       VARCHAR(50) NOT NULL, -- 'JRN-2026-0001'
    entry_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    narration          TEXT NOT NULL,
    reference_type     VARCHAR(50) NOT NULL, -- 'INVOICE', 'BILL', 'PAYMENT', 'RECEIPT', 'PAYROLL', 'DEPRECIATION', 'MANUAL', 'REVERSAL', 'VOID'
    reference_id       UUID,
    reference_number   VARCHAR(100),
    status             VARCHAR(20) NOT NULL DEFAULT 'POSTED', -- 'DRAFT', 'POSTED', 'VOIDED', 'REVERSED'
    total_debit        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_credit       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    is_balanced        BOOLEAN NOT NULL DEFAULT TRUE,
    voided_at          TIMESTAMPTZ,
    voided_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    void_reason        TEXT,
    reversal_entry_id  UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_journal_company_num UNIQUE (company_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries (company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date    ON journal_entries (company_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_ref     ON journal_entries (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status  ON journal_entries (status);

CREATE TABLE IF NOT EXISTS journal_lines (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id   UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    account_id         UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    debit              NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    credit             NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    narration          TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_journal_line_positive CHECK (debit >= 0 AND credit >= 0 AND (debit > 0 OR credit > 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry   ON journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines (account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_company ON journal_lines (company_id);

-- ── 4. GST INVOICES & ITEMS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_invoices (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id                UUID REFERENCES users(id) ON DELETE SET NULL,
    invoice_number         VARCHAR(50) NOT NULL,
    customer_name          VARCHAR(255) NOT NULL,
    customer_gstin         VARCHAR(15),
    customer_pan           VARCHAR(10),
    customer_email         VARCHAR(255),
    customer_phone         VARCHAR(50),
    billing_address        TEXT,
    shipping_address       TEXT,
    place_of_supply        VARCHAR(100) NOT NULL DEFAULT 'Maharashtra',
    place_of_supply_code   VARCHAR(2) NOT NULL DEFAULT '27',
    supply_type            VARCHAR(30) NOT NULL DEFAULT 'B2B', -- 'B2B', 'B2C_LARGE', 'B2C_SMALL', 'EXPORT', 'EXEMPT', 'NIL_RATED'
    invoice_date           DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date               DATE NOT NULL,
    payment_terms          VARCHAR(50) DEFAULT 'Net 30',
    reverse_charge         BOOLEAN NOT NULL DEFAULT FALSE,
    taxable_amount         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    cgst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    sgst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    igst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    cess_amount            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_tax_amount       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    discount_amount        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_amount           NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    paid_amount            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    outstanding_amount     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status                 VARCHAR(30) NOT NULL DEFAULT 'Pending', -- 'Draft', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'
    journal_entry_id       UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    -- E-Invoice & E-Way Bill fields
    irn                    VARCHAR(64),
    irn_status             VARCHAR(20) NOT NULL DEFAULT 'NOT_GENERATED', -- 'NOT_GENERATED', 'GENERATED', 'CANCELLED', 'FAILED'
    signed_qr_code         TEXT,
    ack_number             VARCHAR(50),
    ack_date               TIMESTAMPTZ,
    eway_bill_number       VARCHAR(50),
    eway_bill_date         TIMESTAMPTZ,
    eway_bill_valid_until  TIMESTAMPTZ,
    notes                  TEXT,
    terms_conditions       TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gst_invoice_num UNIQUE (company_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_gst_invoices_company ON gst_invoices (company_id);
CREATE INDEX IF NOT EXISTS idx_gst_invoices_status  ON gst_invoices (status);
CREATE INDEX IF NOT EXISTS idx_gst_invoices_due     ON gst_invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_gst_invoices_irn     ON gst_invoices (irn);

CREATE TABLE IF NOT EXISTS gst_invoice_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id         UUID NOT NULL REFERENCES gst_invoices(id) ON DELETE CASCADE,
    item_description   VARCHAR(255) NOT NULL,
    hsn_sac            VARCHAR(20) NOT NULL,
    quantity           NUMERIC(12,3) NOT NULL DEFAULT 1.000,
    unit               VARCHAR(20) NOT NULL DEFAULT 'NOS',
    unit_price         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    discount_percent   NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    discount_amount    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    taxable_value      NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    gst_rate           NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    cgst_rate          NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    cgst_amount        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    sgst_rate          NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    sgst_amount        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    igst_rate          NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    igst_amount        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_item_amount  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    sort_order         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_gst_items_invoice ON gst_invoice_items (invoice_id);

-- ── 5. CREDIT & DEBIT NOTES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_debit_notes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID REFERENCES companies(id) ON DELETE CASCADE,
    note_number            VARCHAR(50) NOT NULL,
    note_type              VARCHAR(20) NOT NULL, -- 'CREDIT_NOTE', 'DEBIT_NOTE'
    original_invoice_id    UUID REFERENCES gst_invoices(id) ON DELETE SET NULL,
    original_invoice_number VARCHAR(50),
    original_invoice_date  DATE,
    party_name             VARCHAR(255) NOT NULL,
    party_gstin            VARCHAR(15),
    reason_code            VARCHAR(50) NOT NULL DEFAULT '01-Sales Return', -- '01-Sales Return', '02-Post Sale Discount', '03-Deficiency in Services', '04-Correction in Invoice', '05-Change in POS'
    note_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    taxable_amount         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    cgst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    sgst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    igst_amount            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_amount           NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    journal_entry_id       UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    status                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    notes                  TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cdn_company_num UNIQUE (company_id, note_number)
);

CREATE INDEX IF NOT EXISTS idx_cdn_company ON credit_debit_notes (company_id);
CREATE INDEX IF NOT EXISTS idx_cdn_type    ON credit_debit_notes (note_type);

-- ── 6. GST RECONCILIATION RECORDS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_reconciliation_records (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    tax_period         VARCHAR(10) NOT NULL, -- '2026-09'
    return_type        VARCHAR(20) NOT NULL DEFAULT 'GSTR-2B', -- 'GSTR-2B', 'GSTR-1'
    counterparty_gstin VARCHAR(15) NOT NULL,
    counterparty_name  VARCHAR(255),
    document_number    VARCHAR(50) NOT NULL,
    document_date      DATE NOT NULL,
    document_type      VARCHAR(20) NOT NULL DEFAULT 'INV', -- 'INV', 'CRN', 'DBN'
    -- Books Values
    book_taxable       NUMERIC(15,2) DEFAULT 0.00,
    book_tax           NUMERIC(15,2) DEFAULT 0.00,
    book_total         NUMERIC(15,2) DEFAULT 0.00,
    -- Portal / Provider Feed Values
    portal_taxable     NUMERIC(15,2) DEFAULT 0.00,
    portal_tax         NUMERIC(15,2) DEFAULT 0.00,
    portal_total       NUMERIC(15,2) DEFAULT 0.00,
    -- Comparison Status
    match_status       VARCHAR(30) NOT NULL, -- 'MATCHED', 'MISMATCHED', 'MISSING_IN_BOOKS', 'MISSING_IN_RETURNS', 'DUPLICATE'
    diff_amount        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    reason             TEXT,
    recommended_action TEXT,
    is_resolved        BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_notes   TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gst_rec_company ON gst_reconciliation_records (company_id, tax_period);
CREATE INDEX IF NOT EXISTS idx_gst_rec_status  ON gst_reconciliation_records (match_status);

-- ── 7. TDS RULES & TRANSACTIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tds_rules (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_code       VARCHAR(20) NOT NULL UNIQUE, -- '194C', '194J', '194I_LAND', '194I_PLANT', '194H', '194A', '194Q', '206AA'
    section_name       VARCHAR(100) NOT NULL,
    description        TEXT,
    rate_individual    NUMERIC(5,2) NOT NULL,
    rate_company       NUMERIC(5,2) NOT NULL,
    threshold_single   NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    threshold_annual   NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    effective_from     DATE NOT NULL DEFAULT '2024-04-01',
    is_active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tds_challans (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    challan_number     VARCHAR(50) NOT NULL,
    bsr_code           VARCHAR(10) NOT NULL,
    challan_date       DATE NOT NULL,
    challan_serial     VARCHAR(20) NOT NULL,
    minor_head         VARCHAR(10) NOT NULL DEFAULT '200', -- '200' (TDS payable by taxpayer), '400' (TDS regular assessment)
    section_code       VARCHAR(20) NOT NULL,
    tax_amount         NUMERIC(15,2) NOT NULL,
    surcharge          NUMERIC(15,2) DEFAULT 0.00,
    cess               NUMERIC(15,2) DEFAULT 0.00,
    interest           NUMERIC(15,2) DEFAULT 0.00,
    fee_penalty        NUMERIC(15,2) DEFAULT 0.00,
    total_paid         NUMERIC(15,2) NOT NULL,
    bank_account_id    UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    journal_entry_id   UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tds_transactions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    vendor_id          UUID,
    vendor_name        VARCHAR(255) NOT NULL,
    vendor_pan         VARCHAR(10),
    has_valid_pan      BOOLEAN NOT NULL DEFAULT TRUE,
    bill_id            UUID,
    bill_number        VARCHAR(50),
    section_code       VARCHAR(20) NOT NULL,
    gross_amount       NUMERIC(15,2) NOT NULL,
    tds_rate           NUMERIC(5,2) NOT NULL,
    tds_amount         NUMERIC(15,2) NOT NULL,
    net_payable        NUMERIC(15,2) NOT NULL,
    deduction_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    challan_id         UUID REFERENCES tds_challans(id) ON DELETE SET NULL,
    is_deposited       BOOLEAN NOT NULL DEFAULT FALSE,
    return_quarter     VARCHAR(10), -- 'Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026'
    journal_entry_id   UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tds_tx_company ON tds_transactions (company_id);
CREATE INDEX IF NOT EXISTS idx_tds_tx_section ON tds_transactions (section_code);
CREATE INDEX IF NOT EXISTS idx_tds_tx_status  ON tds_transactions (is_deposited);

-- ── 8. PAYROLL ENGINE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_employees (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    employee_code      VARCHAR(50) NOT NULL,
    name               VARCHAR(255) NOT NULL,
    email              VARCHAR(255),
    phone              VARCHAR(50),
    pan                VARCHAR(10),
    aadhaar            VARCHAR(12),
    uan                VARCHAR(20), -- EPF UAN
    esi_ip_number      VARCHAR(20),
    designation        VARCHAR(100),
    department         VARCHAR(100),
    joining_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    bank_name          VARCHAR(100),
    bank_account_num   VARCHAR(50),
    bank_ifsc          VARCHAR(20),
    is_pf_eligible     BOOLEAN NOT NULL DEFAULT TRUE,
    is_esi_eligible    BOOLEAN NOT NULL DEFAULT FALSE,
    is_pt_eligible     BOOLEAN NOT NULL DEFAULT TRUE,
    status             VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RESIGNED', 'TERMINATED'
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_emp_company_code UNIQUE (company_id, employee_code)
);

CREATE TABLE IF NOT EXISTS payroll_salary_structures (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id        UUID NOT NULL REFERENCES payroll_employees(id) ON DELETE CASCADE,
    monthly_basic      NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    monthly_hra        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    monthly_special    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    monthly_conveyance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    monthly_medical    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    other_allowances   NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    monthly_gross      NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    effective_from     DATE NOT NULL DEFAULT CURRENT_DATE,
    is_current         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    pay_period         VARCHAR(10) NOT NULL, -- '2026-09'
    run_date           DATE NOT NULL DEFAULT CURRENT_DATE,
    total_employees    INTEGER NOT NULL DEFAULT 0,
    total_gross        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_employee_pf  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_employer_pf  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_employee_esi NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_employer_esi NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_pt           NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_tds          NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_net_salary   NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    status             VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'CONFIRMED', 'PAID'
    journal_entry_id   UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_payslips (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id     UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employee_id        UUID NOT NULL REFERENCES payroll_employees(id) ON DELETE CASCADE,
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    working_days       INTEGER NOT NULL DEFAULT 30,
    present_days       INTEGER NOT NULL DEFAULT 30,
    leave_days         INTEGER NOT NULL DEFAULT 0,
    gross_earnings     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    basic_earned       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    hra_earned         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    allowances_earned  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    employee_pf        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    employer_pf        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    employee_esi       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    employer_esi       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    professional_tax   NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    tds_deducted       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_deductions   NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    net_salary         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    payment_status     VARCHAR(20) NOT NULL DEFAULT 'UNPAID', -- 'UNPAID', 'PAID'
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payslips_run ON payroll_payslips (payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payslips_emp ON payroll_payslips (employee_id);

-- ── 9. BANK RECONCILIATION ENGINE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_statements (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    account_id         UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    file_name          VARCHAR(255) NOT NULL,
    statement_start    DATE NOT NULL,
    statement_end      DATE NOT NULL,
    opening_balance    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    closing_balance    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_lines        INTEGER NOT NULL DEFAULT 0,
    reconciled_lines   INTEGER NOT NULL DEFAULT 0,
    status             VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'RECONCILED'
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id       UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    transaction_date   DATE NOT NULL,
    value_date         DATE,
    description        TEXT NOT NULL,
    reference_number   VARCHAR(100),
    withdrawal_amount  NUMERIC(15,2) DEFAULT 0.00,
    deposit_amount     NUMERIC(15,2) DEFAULT 0.00,
    running_balance    NUMERIC(15,2),
    match_status       VARCHAR(20) NOT NULL DEFAULT 'UNMATCHED', -- 'UNMATCHED', 'EXACT_MATCHED', 'AUTO_MATCHED', 'MANUALLY_MATCHED', 'IGNORED'
    matched_journal_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    matched_at         TIMESTAMPTZ,
    notes              TEXT
);

CREATE INDEX IF NOT EXISTS idx_stmt_lines_stmt   ON bank_statement_lines (statement_id);
CREATE INDEX IF NOT EXISTS idx_stmt_lines_status ON bank_statement_lines (match_status);

-- ── 10. FIXED ASSETS & DEPRECIATION ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_assets (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id             UUID REFERENCES companies(id) ON DELETE CASCADE,
    asset_code             VARCHAR(50) NOT NULL,
    name                   VARCHAR(255) NOT NULL,
    category               VARCHAR(100) NOT NULL, -- 'Plant & Machinery', 'Computers & IT', 'Furniture & Fixtures', 'Vehicles', 'Office Equipment', 'Buildings'
    purchase_date          DATE NOT NULL,
    purchase_cost          NUMERIC(15,2) NOT NULL,
    salvage_value          NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    useful_life_years      NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    depreciation_method    VARCHAR(20) NOT NULL DEFAULT 'SLM', -- 'SLM', 'WDV'
    depreciation_rate      NUMERIC(5,2) NOT NULL, -- Annual %
    accumulated_depr       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    net_book_value         NUMERIC(15,2) NOT NULL,
    asset_account_id       UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    accum_depr_account_id  UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    depr_expense_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    status                 VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'DISPOSED', 'SOLD'
    disposal_date          DATE,
    disposal_proceeds      NUMERIC(15,2) DEFAULT 0.00,
    gain_loss_on_disposal  NUMERIC(15,2) DEFAULT 0.00,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_asset_company_code UNIQUE (company_id, asset_code)
);

CREATE TABLE IF NOT EXISTS fixed_asset_depreciations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    period_start       DATE NOT NULL,
    period_end         DATE NOT NULL,
    depreciation_amount NUMERIC(15,2) NOT NULL,
    closing_book_value NUMERIC(15,2) NOT NULL,
    journal_entry_id   UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 11. COMPLIANCE RULES & CALENDAR TASKS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_rules (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code          VARCHAR(50) NOT NULL UNIQUE,
    act                VARCHAR(50) NOT NULL, -- 'GST', 'INCOME_TAX', 'COMPANIES_ACT', 'EPF', 'ESI', 'PROFESSIONAL_TAX'
    title              VARCHAR(255) NOT NULL,
    description        TEXT,
    applicable_entity  VARCHAR(50) NOT NULL DEFAULT 'ALL', -- 'ALL', 'PRIVATE_LIMITED', 'LLP', 'PROPRIETORSHIP'
    frequency          VARCHAR(20) NOT NULL, -- 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'EVENT_BASED'
    due_day_offset     INTEGER NOT NULL, -- e.g. 11 for 11th of next month (GSTR-1)
    effective_date     DATE NOT NULL DEFAULT '2024-04-01',
    is_active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS compliance_tasks (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    rule_code          VARCHAR(50) REFERENCES compliance_rules(rule_code) ON DELETE SET NULL,
    title              VARCHAR(255) NOT NULL,
    act                VARCHAR(50) NOT NULL,
    period             VARCHAR(20) NOT NULL, -- '2026-09', 'Q2-2026', 'FY-2026-27'
    due_date           DATE NOT NULL,
    completion_date    DATE,
    status             VARCHAR(30) NOT NULL DEFAULT 'UPCOMING', -- 'COMPLETED', 'UPCOMING', 'DUE_SOON', 'OVERDUE', 'BLOCKED', 'REQUIRES_ACTION'
    filing_reference   VARCHAR(100),
    assigned_to        VARCHAR(100),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_tasks_company ON compliance_tasks (company_id);
CREATE INDEX IF NOT EXISTS idx_comp_tasks_status  ON compliance_tasks (status);
CREATE INDEX IF NOT EXISTS idx_comp_tasks_due     ON compliance_tasks (due_date);

-- ── 12. FILING PREPARATION & CA APPROVAL WORKFLOW ────────────────────────────
CREATE TABLE IF NOT EXISTS filing_preparations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    return_type        VARCHAR(30) NOT NULL, -- 'GSTR-1', 'GSTR-3B', 'TDS-26Q', 'EPF-ECR', 'ESI-CHALLAN'
    tax_period         VARCHAR(20) NOT NULL,
    prepared_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation_status  VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'VALIDATED', 'VALIDATION_ERRORS'
    validation_errors  JSONB NOT NULL DEFAULT '[]'::jsonb,
    approval_status    VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED_BY_USER', 'APPROVED_BY_CA', 'REJECTED'
    approved_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at        TIMESTAMPTZ,
    approval_notes     TEXT,
    submission_status  VARCHAR(30) NOT NULL DEFAULT 'NOT_SUBMITTED', -- 'NOT_SUBMITTED', 'READY_FOR_PROVIDER', 'SUBMITTED', 'ACKNOWLEDGED', 'FAILED'
    submission_ref     VARCHAR(100), -- ARN or acknowledgment number
    submitted_at       TIMESTAMPTZ,
    provider_response  JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_filing_prep_company ON filing_preparations (company_id, return_type, tax_period);

-- ── 13. INTEGRATION PROVIDERS & API LOGS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_providers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    provider_key       VARCHAR(50) NOT NULL, -- 'NIC_EINVOICE', 'NIC_EWAYBILL', 'GST_PORTAL', 'TDS_PORTAL', 'BANK_AGGREGATOR'
    provider_name      VARCHAR(100) NOT NULL,
    environment        VARCHAR(20) NOT NULL DEFAULT 'sandbox', -- 'sandbox', 'production'
    is_active          BOOLEAN NOT NULL DEFAULT FALSE,
    credentials_status VARCHAR(30) NOT NULL DEFAULT 'CREDENTIALS_REQUIRED', -- 'CREDENTIALS_REQUIRED', 'CONFIGURED', 'CONNECTED', 'ERROR'
    config_metadata    JSONB NOT NULL DEFAULT '{}'::jsonb, -- Masked configuration (no secrets stored in plaintext)
    last_health_check  TIMESTAMPTZ,
    health_status      VARCHAR(20) DEFAULT 'UNKNOWN',
    health_message     TEXT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prov_company_key UNIQUE (company_id, provider_key)
);

CREATE TABLE IF NOT EXISTS api_request_logs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE SET NULL,
    provider_key       VARCHAR(50) NOT NULL,
    endpoint           VARCHAR(255) NOT NULL,
    http_method        VARCHAR(10) NOT NULL,
    request_id         VARCHAR(100) NOT NULL,
    status_code        INTEGER,
    latency_ms         INTEGER,
    is_success         BOOLEAN NOT NULL DEFAULT FALSE,
    error_message      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_company ON api_request_logs (company_id, created_at DESC);

-- ── 14. IMMUTABLE AUDIT TRAIL ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_audit_trail (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
    action             VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'POST', 'VOID', 'REVERSE', 'APPROVE', 'SUBMIT', 'RECONCILE'
    entity_type        VARCHAR(50) NOT NULL, -- 'JOURNAL_ENTRY', 'INVOICE', 'BILL', 'PAYMENT', 'PAYROLL', 'ASSET', 'GST_RETURN', 'TDS_CHALLAN', 'SETTINGS'
    entity_id          UUID,
    entity_number      VARCHAR(100),
    before_state       JSONB,
    after_state        JSONB,
    ip_address         VARCHAR(50),
    user_agent         TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_company ON ledger_audit_trail (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity  ON ledger_audit_trail (entity_type, entity_id);

-- ── 15. DEFAULT SEED DATA ────────────────────────────────────────────────────
-- Default TDS statutory rules
INSERT INTO tds_rules (section_code, section_name, description, rate_individual, rate_company, threshold_single, threshold_annual) VALUES
    ('194C', 'Contractor Payments', 'Payments to contractors and sub-contractors', 1.00, 2.00, 30000.00, 100000.00),
    ('194J', 'Professional/Technical Fees', 'Fees for professional or technical services', 10.00, 10.00, 30000.00, 30000.00),
    ('194J_TECH', 'Technical Services (B2B)', 'Fees for technical services under Sec 194J(1)', 2.00, 2.00, 30000.00, 30000.00),
    ('194I_LAND', 'Rent on Land/Building', 'Rent on land, building, or furniture', 10.00, 10.00, 240000.00, 240000.00),
    ('194I_PLANT', 'Rent on Plant/Machinery', 'Rent on plant, machinery, or equipment', 2.00, 2.00, 240000.00, 240000.00),
    ('194H', 'Commission/Brokerage', 'Commission or brokerage fees', 5.00, 5.00, 15000.00, 15000.00),
    ('194A', 'Interest Other than Securities', 'Interest paid by banks or non-banking entities', 10.00, 10.00, 5000.00, 40000.00),
    ('194Q', 'Purchase of Goods', 'TDS on high-volume purchases of goods exceeding ₹50 Lakhs', 0.10, 0.10, 5000000.00, 5000000.00),
    ('206AA', 'Higher Deduction (No PAN)', 'Mandatory 20% deduction where deductee lacks PAN', 20.00, 20.00, 0.00, 0.00)
ON CONFLICT (section_code) DO NOTHING;

-- Default Statutory Compliance Rules
INSERT INTO compliance_rules (rule_code, act, title, description, applicable_entity, frequency, due_day_offset) VALUES
    ('GST_GSTR1_M', 'GST', 'GSTR-1 Monthly Return', 'Details of outward supplies of goods or services', 'ALL', 'MONTHLY', 11),
    ('GST_GSTR3B_M', 'GST', 'GSTR-3B Monthly Return', 'Summary return of outward supplies, ITC claimed, and tax payable', 'ALL', 'MONTHLY', 20),
    ('GST_GSTR1_Q', 'GST', 'GSTR-1 Quarterly (QRMP)', 'Quarterly outward supplies return for QRMP taxpayers', 'ALL', 'QUARTERLY', 13),
    ('GST_GSTR3B_Q', 'GST', 'GSTR-3B Quarterly (QRMP)', 'Quarterly tax return for QRMP scheme', 'ALL', 'QUARTERLY', 22),
    ('TDS_CHALLAN_281', 'INCOME_TAX', 'TDS Monthly Deposit (Challan 281)', 'Deposit of TDS deducted in previous month', 'ALL', 'MONTHLY', 7),
    ('TDS_RETURN_26Q', 'INCOME_TAX', 'Quarterly TDS Return (Form 26Q)', 'Quarterly statement of tax deducted on payments other than salary', 'ALL', 'QUARTERLY', 31),
    ('EPF_ECR_DEPOSIT', 'EPF', 'EPF Monthly ECR Deposit', 'Payment of Provident Fund contributions and administrative charges', 'ALL', 'MONTHLY', 15),
    ('ESI_CHALLAN_DEPOSIT', 'ESI', 'ESI Monthly Contribution', 'Deposit of employee and employer ESI contributions', 'ALL', 'MONTHLY', 15),
    ('ADVANCE_TAX_Q1', 'INCOME_TAX', 'Advance Tax Installment 1', '15% of estimated total income tax liability', 'ALL', 'QUARTERLY', 15),
    ('ADVANCE_TAX_Q2', 'INCOME_TAX', 'Advance Tax Installment 2', '45% of estimated total income tax liability', 'ALL', 'QUARTERLY', 15),
    ('ADVANCE_TAX_Q3', 'INCOME_TAX', 'Advance Tax Installment 3', '75% of estimated total income tax liability', 'ALL', 'QUARTERLY', 15),
    ('ADVANCE_TAX_Q4', 'INCOME_TAX', 'Advance Tax Installment 4', '100% of estimated total income tax liability', 'ALL', 'QUARTERLY', 15),
    ('MCA_DIR3_KYC', 'COMPANIES_ACT', 'DIR-3 KYC Annual Filing', 'Annual KYC verification of Directors by September 30', 'PRIVATE_LIMITED', 'ANNUAL', 30),
    ('MCA_AOC4', 'COMPANIES_ACT', 'AOC-4 Financial Statement Filing', 'Filing of audited financial statements within 30 days of AGM', 'PRIVATE_LIMITED', 'ANNUAL', 30),
    ('MCA_MGT7', 'COMPANIES_ACT', 'MGT-7 Annual Return', 'Filing of annual return within 60 days of AGM', 'PRIVATE_LIMITED', 'ANNUAL', 60)
ON CONFLICT (rule_code) DO NOTHING;

COMMIT;
