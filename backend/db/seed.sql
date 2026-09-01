-- ============================================================================
-- KEPWE — Seed / Reference Data
-- Data pulled directly from the existing frontend (AppContext + mockData.ts)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PLANS (PricingPage / AppAccountPage PLANS + BusinessOnboardingPage PACKAGES)
-- ============================================================================
INSERT INTO plans (name, display_name, price_inr, billing_cycle, is_indexpilot, features, sort_order) VALUES
-- `name` is the plan_type enum identifier. Durations and "Free Tier" are UI labels,
-- so they belong in display_name rather than this enum-backed column.
('Free Trial',    'IndexPilot Free Tier',       0,     'free',        TRUE,  '["Delayed/basic Index Dashboard", "Basic market signals", "Market education content", "Daily market view"]'::jsonb, 10),
('Basic',         'IndexPilot 1 Month',         999,   'monthly',     TRUE,  '["Live Index Dashboard", "Kepwe IQ", "Should I Trade? verdict", "Risk-first strategy filtering", "Defined-risk setups", "Risk Calculator", "Market Alerts"]'::jsonb, 20),
('Pro',           'IndexPilot 3 Months',        2499,  'quarterly',   TRUE,  '["Everything in 1 Month", "3 months continuous access", "Live Index Dashboard", "Kepwe IQ", "Strategy Engine", "Risk-first setups", "Risk Calculator", "Alerts & notifications"]'::jsonb, 30),
('Pro+',          'IndexPilot 6 Months',        4999,  'half-yearly', TRUE,  '["Everything in 3 Months", "6 months continuous access", "Live market intelligence", "Kepwe IQ", "Should I Trade?", "Risk-filtered strategy setups", "Option-chain intelligence", "Risk tools", "Alerts & notifications"]'::jsonb, 40),
('Premium',       'IndexPilot 1 Year',          9999,  'annual',      TRUE,  '["Everything in 6 Months", "12 months continuous access", "Live Index Dashboard", "Kepwe IQ", "Strategy Engine", "Risk-first filtering", "Defined-risk setups", "Option-chain intelligence", "Risk Calculator", "Alerts & notifications"]'::jsonb, 50),
('Launch',         'Kepwe Launch',               1499,  'monthly', FALSE, '["GST registration", "Basic accounting", "Email support"]'::jsonb,           60),
('Essential',      'Kepwe Essential',            2999,  'monthly', FALSE, '["GST + TDS filing", "Bookkeeping", "Payroll basics"]'::jsonb,              70),
('Growth',         'Kepwe Growth',               5999,  'monthly', FALSE, '["Full compliance", "Accounting + Payroll", "Priority support"]'::jsonb,    80),
('Scale',          'Kepwe Scale',                9999,  'monthly', FALSE, '["All Growth features", "Dedicated CA", "Virtual CFO lite"]'::jsonb,         90),
('Scale + CFO',    'Kepwe Scale + CFO',          14999, 'monthly', FALSE, '["All Scale features", "Full Virtual CFO", "Board reporting"]'::jsonb,      100)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ONBOARDING CHECKLIST TEMPLATE
-- Derived from AppContext.onboardingChecklist (13 items, 3 categories)
-- ============================================================================
INSERT INTO onboarding_checklist_items (category, title, description, is_required, sort_order) VALUES
('Company Information', 'Incorporation documents (COI/MOA/AOA)', 'Certificate of Incorporation, MOA, and AOA', TRUE, 10),
('Company Information', 'PAN & TAN certificates',               'Company PAN and TAN registration certificates', TRUE, 20),
('Company Information', 'GST Registration Certificate',         'GST registration certificate with GSTIN', TRUE, 30),
('Company Information', 'Bank Account details & Cancelled Cheque', 'Bank account details and cancelled cheque leaf', TRUE, 40),
('Company Information', 'Director / Partner KYC (Aadhaar & PAN)', 'KYC documents for all directors/partners', TRUE, 50),
('Accounting', 'Previous Financial Year Books / Tally Backup', 'Prior year financial books or Tally backup', TRUE, 60),
('Accounting', 'Bank Statements (Last 12 Months)', 'Last 12 months bank statements for all accounts', TRUE, 70),
('Accounting', 'Sales Invoices Register', 'Register of all sales invoices', TRUE, 80),
('Accounting', 'Purchase Invoices Register', 'Register of all purchase invoices', TRUE, 90),
('Accounting', 'Expense Vouchers & Receipts', 'Monthly expense vouchers and receipts', TRUE, 100),
('Payroll', 'Employee Master List (PAN, UAN, Bank details)', 'Master list of employees with PAN, UAN, bank details', TRUE, 110),
('Payroll', 'Salary Structure Breakdown (CTC Component)', 'Salary breakdown with CTC components', TRUE, 120),
('Payroll', 'EPF & ESI Registration Details', 'EPF and ESI registration numbers and details', TRUE, 130)
ON CONFLICT (category, title) DO NOTHING;

-- ============================================================================
-- LEAD FOLLOW-UP CADENCE WORKFLOW
-- Derived from MOCK_FOLLOWUPS in mockData.ts (Day 0 → Day 30)
-- ============================================================================
INSERT INTO lead_followup_cadences (day_label, day_offset, channel, message, sort_order) VALUES
('Day 0',  0,  'WhatsApp/SMS', 'Your free compliance assessment is ready.', 10),
('Day 1',  1,  'Email',        '5 things your newly incorporated company should complete.', 20),
('Day 3',  3,  'WhatsApp',     'Would you like us to handle your monthly GST and accounting?', 30),
('Day 7',  7,  'Offer',        'Start your compliance plan this month with 10% onboarding discount.', 40),
('Day 15', 15, 'Follow-up',    'Standard re-engagement touch for MCA annual filing deadlines.', 50),
('Day 30', 30, 'Campaign',     'Reactivation campaign: Virtual CFO & payroll audit offer.', 60)
ON CONFLICT (day_offset, channel) DO NOTHING;

COMMIT;
