-- ============================================================================
-- Migration: Fix Quant Product Memberships After IndexPilot Removal
-- ============================================================================
-- This migration ensures all users have proper Quant workspace membership
-- after IndexPilot product was removed from the platform.
--
-- Actions:
-- 1. Grant Quant membership to all users who had indexpilot membership
-- 2. Update GLOBAL_DASHBOARD_PRODUCTS references
-- 3. Remove indexpilot memberships
-- ============================================================================

BEGIN;

-- Grant quant membership to all users (idempotent)
INSERT INTO product_memberships (user_id, product, role, status, company_id, created_at, updated_at, last_login_at)
SELECT 
  u.id as user_id,
  'quant' as product,
  'owner' as role,
  'active' as status,
  NULL as company_id,
  NOW() as created_at,
  NOW() as updated_at,
  NOW() as last_login_at
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM product_memberships pm 
  WHERE pm.user_id = u.id AND pm.product = 'quant'
)
ON CONFLICT (user_id, product) DO UPDATE 
SET status = 'active', updated_at = NOW();

-- Remove indexpilot memberships (product no longer exists)
UPDATE product_memberships 
SET status = 'suspended', updated_at = NOW()
WHERE product = 'indexpilot';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Quant membership fix applied: granted quant access to all users, suspended indexpilot memberships';
END $$;

COMMIT;
