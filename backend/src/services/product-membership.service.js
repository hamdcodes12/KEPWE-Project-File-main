import { pool } from '../config/db.js';

export const VALID_PRODUCTS = [
  'customer-portal',
  'crm',
  'indexpilot',
  'ledger',
  'credit',
  'quant',
];

export function canonicalizeProduct(product) {
  if (!product) return null;
  const p = String(product).toLowerCase().trim();
  if (['customer-portal', 'customer', 'portal', 'client-portal'].includes(p)) return 'customer-portal';
  if (['crm', 'sales-crm'].includes(p)) return 'crm';
  if (['indexpilot', 'algo', 'terminal'].includes(p)) return 'indexpilot';
  if (['ledger', 'kepwe-ledger', 'accounting'].includes(p)) return 'ledger';
  if (['credit', 'loans', 'capital'].includes(p)) return 'credit';
  if (['quant', 'kepwe-quant'].includes(p)) return 'quant';
  return null;
}

/**
 * Fetch all active product memberships for a user
 */
export async function getUserMemberships(userId) {
  if (!userId) return [];
  const result = await pool.query(
    `SELECT id, product, role, status, company_id, created_at, last_login_at
     FROM product_memberships
     WHERE user_id = $1 AND status = 'active'
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows;
}

/**
 * Fetch active product keys (array of strings, e.g. ['ledger', 'crm'])
 */
export async function getUserProductKeys(userId) {
  const rows = await getUserMemberships(userId);
  return rows.map((r) => r.product);
}

/**
 * Check if a user has active membership for a specific product
 */
export async function hasProductAccess(userId, product) {
  const canonical = canonicalizeProduct(product);
  if (!userId || !canonical) return false;

  const result = await pool.query(
    `SELECT id, role, status FROM product_memberships
     WHERE user_id = $1 AND product = $2 AND status = 'active'
     LIMIT 1`,
    [userId, canonical]
  );
  return result.rows.length > 0;
}

/**
 * Grant or upsert a user's membership in a product
 */
export async function grantProductMembership(userId, product, { role = 'member', companyId = null } = {}) {
  const canonical = canonicalizeProduct(product);
  if (!userId || !canonical) {
    throw new Error(`Invalid user (${userId}) or product (${product})`);
  }

  const result = await pool.query(
    `INSERT INTO product_memberships (user_id, product, role, status, company_id, updated_at, last_login_at)
     VALUES ($1, $2, $3, 'active', $4, NOW(), NOW())
     ON CONFLICT (user_id, product)
     DO UPDATE SET status = 'active', role = EXCLUDED.role, company_id = COALESCE(EXCLUDED.company_id, product_memberships.company_id), updated_at = NOW(), last_login_at = NOW()
     RETURNING id, user_id, product, role, status, company_id, created_at, last_login_at`,
    [userId, canonical, role, companyId]
  );
  return result.rows[0];
}

/**
 * Update the last_login_at timestamp for a user in a product
 */
export async function recordProductLogin(userId, product) {
  const canonical = canonicalizeProduct(product);
  if (!userId || !canonical) return;

  await pool.query(
    `UPDATE product_memberships 
     SET last_login_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND product = $2`,
    [userId, canonical]
  );
}

/**
 * Revoke or suspend a user's membership in a product
 */
export async function revokeProductMembership(userId, product) {
  const canonical = canonicalizeProduct(product);
  if (!userId || !canonical) return;

  await pool.query(
    `UPDATE product_memberships 
     SET status = 'suspended', updated_at = NOW()
     WHERE user_id = $1 AND product = $2`,
    [userId, canonical]
  );
}
