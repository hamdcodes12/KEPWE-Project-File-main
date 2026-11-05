import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { getPrimaryCompanyForUser } from '../services/companies.service.js';

const router = Router();

const CHECKLIST_STATUSES = ['Pending', 'Uploaded', 'Verified', 'Action Required'];
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const updateItemSchema = z.object({
  status: z.enum(CHECKLIST_STATUSES),
  note: z.string().trim().max(1000).optional().nullable(),
});

const uploadDocSchema = z.object({
  name: z.string().trim().min(1, 'Document name is required').max(255),
  fileData: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, 'File data is invalid'),
  mimeType: z.string().trim().max(100).default('application/octet-stream'),
  fileSizeBytes: z.number().int().min(1).max(MAX_DOCUMENT_BYTES),
}).superRefine((value, ctx) => {
  const decodedSize = Buffer.from(value.fileData, 'base64').length;
  if (decodedSize === 0 || decodedSize > MAX_DOCUMENT_BYTES || decodedSize !== value.fileSizeBytes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fileSizeBytes'], message: 'File must be between 1 byte and 5 MB' });
  }
});

function serializeItem(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    status: row.status,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/checklist
 * Returns the authenticated user's company checklist (creating the
 * company's checklist rows on first access if the company exists but has
 * none yet). If the user has no company, returns an empty list rather than
 * fabricating data.
 */
router.get('/checklist', requireAuth, async (req, res, next) => {
  try {
    const company = await getPrimaryCompanyForUser(req.userId);
    if (!company) {
      return res.json({ items: [], progress: { total: 0, verified: 0, uploaded: 0 }, company: null });
    }

    const result = await pool.query(
      `SELECT cci.id, oci.category, oci.title, cci.status, cci.note, cci.updated_at
       FROM company_checklist_items cci
       JOIN onboarding_checklist_items oci ON oci.id = cci.checklist_item_id
       WHERE cci.company_id = $1
       ORDER BY oci.sort_order ASC`,
      [company.id]
    );

    const items = result.rows.map(serializeItem);
    const total = items.length;
    const verified = items.filter((i) => i.status === 'Verified').length;
    const uploaded = items.filter((i) => i.status === 'Uploaded').length;

    res.json({
      items,
      progress: { total, verified, uploaded },
      company: { id: company.id, name: company.name },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/checklist/:itemId
 * Updates the status/note of a single checklist item. Ownership is
 * enforced by joining through company_members for the verified req.userId
 * — a user can only ever update items belonging to their own company.
 */
router.patch('/checklist/:itemId', requireAuth, validateBody(updateItemSchema), async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { status, note } = req.validatedBody;

    const ownerCheck = await pool.query(
      `SELECT cci.id
       FROM company_checklist_items cci
       JOIN company_members cm ON cm.company_id = cci.company_id
       WHERE cci.id = $1 AND cm.user_id = $2`,
      [itemId, req.userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    const completedAt = status === 'Verified' ? 'NOW()' : 'NULL';
    const result = await pool.query(
      `UPDATE company_checklist_items
       SET status = $1,
           note = COALESCE($2, note),
           updated_by = $3,
           completed_at = ${completedAt},
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, status, note, updated_at`,
      [status, note || null, req.userId, itemId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/checklist/:itemId/documents
 * Stores a document against a checklist item and marks it Uploaded.
 */
router.post('/checklist/:itemId/documents', requireAuth, validateBody(uploadDocSchema), async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { name, fileData, mimeType, fileSizeBytes } = req.validatedBody;

    const item = await pool.query(
      `SELECT cci.id, cci.company_id, oci.category
       FROM company_checklist_items cci
       JOIN onboarding_checklist_items oci ON oci.id = cci.checklist_item_id
       JOIN company_members cm ON cm.company_id = cci.company_id
       WHERE cci.id = $1 AND cm.user_id = $2`,
      [itemId, req.userId]
    );

    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    const { company_id: companyId } = item.rows[0];
    const fileContent = Buffer.from(fileData, 'base64');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const doc = await client.query(
        `INSERT INTO customer_documents
           (company_id, uploaded_by, name, category, file_content, file_size_bytes, mime_type, status, checklist_item_id)
         VALUES ($1, $2, $3, 'Company Documents', $4, $5, $6, 'Uploaded', $7)
         RETURNING id, name, category, file_size_bytes, status, created_at`,
        [companyId, req.userId, name, fileContent, fileSizeBytes, mimeType, itemId]
      );

      const updatedItem = await client.query(
        `UPDATE company_checklist_items
         SET status = 'Uploaded', updated_by = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, status, note, updated_at`,
        [req.userId, itemId]
      );

      await client.query('COMMIT');
      res.status(201).json({ document: doc.rows[0], item: updatedItem.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
