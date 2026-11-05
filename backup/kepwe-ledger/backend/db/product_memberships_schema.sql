-- ============================================================
-- PRODUCT MEMBERSHIPS & WORKSPACE ACCESS CONTROL SCHEMA
-- Enforces true separate product-level authorization:
-- Ledger, CRM, IndexPilot, Customer Portal, Credit, Quant
-- ============================================================

CREATE TABLE IF NOT EXISTS product_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product VARCHAR(50) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  company_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT uq_user_product UNIQUE (user_id, product)
);

CREATE INDEX IF NOT EXISTS idx_product_memberships_user ON product_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_product_memberships_product ON product_memberships(product);
CREATE INDEX IF NOT EXISTS idx_product_memberships_status ON product_memberships(user_id, product, status);
