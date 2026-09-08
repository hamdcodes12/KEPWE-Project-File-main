-- ============================================================================
-- Migration: IndexPilot UI Plan Name Column
-- Adds a `ui_name` column to the plans table so the backend can look up
-- plans by the frontend label ('1 MONTH', '3 MONTHS', etc.) without
-- needing to add those labels to the plan_type enum.
-- Idempotent.
-- ============================================================================

BEGIN;

-- Add ui_name column (nullable, unique where set).
ALTER TABLE plans ADD COLUMN IF NOT EXISTS ui_name VARCHAR(50);

-- Populate ui_name for the four IndexPilot duration-based plans.
UPDATE plans SET ui_name = '1 MONTH'  WHERE name = 'Basic'   AND is_indexpilot = TRUE;
UPDATE plans SET ui_name = '3 MONTHS' WHERE name = 'Pro'     AND is_indexpilot = TRUE;
UPDATE plans SET ui_name = '6 MONTHS' WHERE name = 'Pro+'    AND is_indexpilot = TRUE;
UPDATE plans SET ui_name = '1 YEAR'   WHERE name = 'Premium' AND is_indexpilot = TRUE;
UPDATE plans SET ui_name = 'Free Tier' WHERE name = 'Free Trial' AND is_indexpilot = TRUE;

-- Partial unique index: ui_name is unique among rows that have one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_ui_name
    ON plans (ui_name) WHERE ui_name IS NOT NULL;

COMMIT;
