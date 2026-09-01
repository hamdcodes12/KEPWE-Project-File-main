import { pool } from '../config/db.js';

/**
 * Companies service — shared helpers for anything that is scoped to a
 * "company" record (customer portal, onboarding checklist, tasks,
 * documents, compliance checks, business onboarding).
 *
 * A user may belong to a company via `company_members`. For this product,
 * each user typically owns exactly one company, but the schema supports
 * multiple members per company for future team features.
 */

export async function listCompaniesForUser(userId) {
  const result = await pool.query(
    `SELECT c.id, c.name, c.cin, c.gstin, c.pan, c.business_type, c.industry,
            c.state, c.city, c.avg_monthly_turnover, c.employee_count,
            c.incorporation_date, c.gst_status, c.created_at,
            cm.is_owner, cm.role AS member_role
     FROM companies c
     JOIN company_members cm ON cm.company_id = c.id
     WHERE cm.user_id = $1
     ORDER BY cm.is_owner DESC, c.created_at ASC`,
    [userId]
  );
  return result.rows;
}

/**
 * Returns the user's primary company (the one they own, or the first they
 * belong to), or null if they have none yet.
 */
export async function getPrimaryCompanyForUser(userId) {
  const result = await pool.query(
    `SELECT c.*
     FROM companies c
     JOIN company_members cm ON cm.company_id = c.id
     WHERE cm.user_id = $1
     ORDER BY cm.is_owner DESC, c.created_at ASC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Seeds the full onboarding checklist template for a newly created company
 * so every company starts with the same 13-item checklist (all "Pending").
 */
async function seedChecklistForCompany(client, companyId) {
  await client.query(
    `INSERT INTO company_checklist_items (company_id, checklist_item_id, status)
     SELECT $1, id, 'Pending'
     FROM onboarding_checklist_items
     WHERE is_active = TRUE
     ON CONFLICT (company_id, checklist_item_id) DO NOTHING`,
    [companyId]
  );
}

/**
 * Creates a new company owned by the given user, and seeds its checklist.
 * Runs in a transaction so the company + membership + checklist are atomic.
 */
export async function createCompanyForUser(userId, companyData = {}) {
  const {
    name,
    cin = null,
    gstin = null,
    pan = null,
    businessType = null,
    industry = null,
    state = null,
    city = null,
    avgMonthlyTurnover = null,
    employeeCount = null,
    incorporationDate = null,
  } = companyData;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertCompany = await client.query(
      `INSERT INTO companies
         (name, cin, gstin, pan, business_type, industry, state, city,
          avg_monthly_turnover, employee_count, incorporation_date, created_by, gst_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Pending')
       RETURNING *`,
      [
        name,
        cin,
        gstin,
        pan,
        businessType,
        industry,
        state,
        city,
        avgMonthlyTurnover,
        employeeCount,
        incorporationDate,
        userId,
      ]
    );
    const company = insertCompany.rows[0];

    await client.query(
      `INSERT INTO company_members (company_id, user_id, role, is_owner)
       VALUES ($1, $2, 'customer', TRUE)`,
      [company.id, userId]
    );

    await seedChecklistForCompany(client, company.id);

    await client.query('COMMIT');
    return company;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Finds the user's existing company (if any), or creates a new one from the
 * supplied identity fields. Used by flows where a company might already
 * exist (compliance-check, business-onboarding) so we don't create
 * duplicate companies for the same authenticated user.
 */
export async function findOrCreateCompanyForUser(userId, companyData = {}) {
  const existing = await getPrimaryCompanyForUser(userId);
  if (existing) return existing;
  if (!companyData.name) return null;
  return createCompanyForUser(userId, companyData);
}

export function serializeCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    cin: row.cin,
    gstin: row.gstin,
    pan: row.pan,
    businessType: row.business_type,
    industry: row.industry,
    state: row.state,
    city: row.city,
    avgMonthlyTurnover: row.avg_monthly_turnover,
    employeeCount: row.employee_count,
    incorporationDate: row.incorporation_date,
    gstStatus: row.gst_status,
    createdAt: row.created_at,
  };
}
