-- ============================================================================
-- Migration: Fix IndexPilot Plan Prices and Display Names
-- Corrects the price_inr and display_name for the four IndexPilot duration
-- plans to match the frontend (mockData.ts / IndexPilotPricingCards.jsx).
-- Idempotent (UPDATE is always safe to re-run).
-- ============================================================================

BEGIN;

UPDATE plans SET
    display_name = 'IndexPilot 1 Month',
    price_inr    = 999.00
WHERE ui_name = '1 MONTH' AND is_indexpilot = TRUE;

UPDATE plans SET
    display_name = 'IndexPilot 3 Months',
    price_inr    = 2499.00
WHERE ui_name = '3 MONTHS' AND is_indexpilot = TRUE;

UPDATE plans SET
    display_name = 'IndexPilot 6 Months',
    price_inr    = 4999.00
WHERE ui_name = '6 MONTHS' AND is_indexpilot = TRUE;

UPDATE plans SET
    display_name = 'IndexPilot 1 Year',
    price_inr    = 9999.00
WHERE ui_name = '1 YEAR' AND is_indexpilot = TRUE;

UPDATE plans SET
    display_name = 'IndexPilot Free Tier',
    price_inr    = 0.00
WHERE ui_name = 'Free Tier' AND is_indexpilot = TRUE;

COMMIT;
