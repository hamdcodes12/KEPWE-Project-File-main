-- ============================================================================
-- Migration: Business Plan UI Names & Price Corrections
-- Maps the business plans by their display label so create-order can accept
-- plan names like 'Launch', 'Essential', 'Growth', 'Scale', 'Scale + CFO'.
-- Also sets billing_cycle and price to match PricingSection.jsx (annual rate).
-- Idempotent.
-- ============================================================================

BEGIN;

-- Ensure ui_name column exists (already added by indexpilot_plan_names.sql,
-- but this migration runs standalone-safely).
ALTER TABLE plans ADD COLUMN IF NOT EXISTS ui_name VARCHAR(50);

-- Business plans use their plan name directly as ui_name.
UPDATE plans SET ui_name = 'Launch',       price_inr = 1499,  display_name = 'Kepwe Launch'
    WHERE name = 'Launch'      AND is_indexpilot = FALSE;

UPDATE plans SET ui_name = 'Essential',    price_inr = 2999,  display_name = 'Kepwe Essential'
    WHERE name = 'Essential'   AND is_indexpilot = FALSE;

UPDATE plans SET ui_name = 'Growth',       price_inr = 5999,  display_name = 'Kepwe Growth'
    WHERE name = 'Growth'      AND is_indexpilot = FALSE;

UPDATE plans SET ui_name = 'Scale',        price_inr = 9999,  display_name = 'Kepwe Scale'
    WHERE name = 'Scale'       AND is_indexpilot = FALSE;

UPDATE plans SET ui_name = 'Scale + CFO',  price_inr = 14999, display_name = 'Kepwe Scale + CFO'
    WHERE name = 'Scale + CFO' AND is_indexpilot = FALSE;

-- Partial unique index (safe to re-run — IF NOT EXISTS).
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_ui_name
    ON plans (ui_name) WHERE ui_name IS NOT NULL;

COMMIT;
