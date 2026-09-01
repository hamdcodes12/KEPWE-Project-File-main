import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { getPrimaryCompanyForUser, serializeCompany } from '../services/companies.service.js';

const router = Router();

const DOCUMENT_CATEGORIES = ['Company Documents', 'GST', 'Bank Statements', 'Sales', 'Purchases', 'Payroll', 'Tax', 'Other'];

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const uploadDocSchema = z.object({
  name: z.string().trim().min(1, 'Document name is required').max(255),
  category: z.enum(DOCUMENT_CATEGORIES).optional().default('Company Documents'),
  fileData: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, 'File data is invalid'),
  mimeType: z.string().trim().max(100).default('application/octet-stream'),
  fileSizeBytes: z.number().int().min(1).max(MAX_DOCUMENT_BYTES),
}).superRefine((value, ctx) => {
  const decodedSize = Buffer.from(value.fileData, 'base64').length;
  if (decodedSize === 0 || decodedSize > MAX_DOCUMENT_BYTES || decodedSize !== value.fileSizeBytes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fileSizeBytes'], message: 'File must be between 1 byte and 5 MB' });
  }
});

/**
 * GET /api/portal/profile
 * Company + signed-in user info for the Customer Portal header.
 */
router.get('/portal/profile', requireAuth, async (req, res, next) => {
  try {
    const company = await getPrimaryCompanyForUser(req.userId);
    res.json({
      user: { id: req.user.id, name: req.user.full_name, email: req.user.email },
      company: serializeCompany(company),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/snapshot
 * Business Health Snapshot cards — every value derived from the user's
 * real company data (customer_tasks status, checklist completion,
 * employee count). Returns empty/neutral values if no company exists yet.
 */
router.get('/portal/snapshot', requireAuth, async (req, res, next) => {
  try {
    const company = await getPrimaryCompanyForUser(req.userId);
    if (!company) {
      return res.json({ metrics: [], company: null });
    }

    const taskAgg = await pool.query(
      `SELECT category,
              MIN(due_date) FILTER (WHERE status != 'Completed') AS next_due,
              bool_or(status = 'Action Required') AS has_action_required,
              bool_or(status = 'In Progress') AS has_in_progress
       FROM customer_tasks
       WHERE company_id = $1
       GROUP BY category`,
      [company.id]
    );
    const byCategory = {};
    for (const row of taskAgg.rows) byCategory[row.category] = row;

    const checklistAgg = await pool.query(
      `SELECT oci.category,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE cci.status = 'Verified') AS verified,
              COUNT(*) FILTER (WHERE cci.status = 'Uploaded') AS uploaded
       FROM company_checklist_items cci
       JOIN onboarding_checklist_items oci ON oci.id = cci.checklist_item_id
       WHERE cci.company_id = $1
       GROUP BY oci.category`,
      [company.id]
    );
    const accountingRow = checklistAgg.rows.find((r) => r.category === 'Accounting');
    const accountingPct = accountingRow && Number(accountingRow.total) > 0
      ? Math.round(((Number(accountingRow.verified) + Number(accountingRow.uploaded) * 0.5) / Number(accountingRow.total)) * 100)
      : 0;

    const formatNext = (row) => {
      if (!row || !row.next_due) return null;
      return new Date(row.next_due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };
    const statusFor = (row) => {
      if (!row) return 'On Track';
      if (row.has_action_required) return 'Action Required';
      if (row.has_in_progress) return 'Pending';
      return 'On Track';
    };

    const gst = byCategory['GST'];
    const tds = byCategory['TDS'];
    const mca = byCategory['MCA'];

    const employeeCount = company.employee_count || 0;

    res.json({
      metrics: [
        { label: 'GST', status: statusFor(gst), subtext: formatNext(gst) ? `Next: ${formatNext(gst)}` : 'No upcoming filings' },
        { label: 'TDS', status: statusFor(tds), subtext: formatNext(tds) ? `Next: ${formatNext(tds)}` : 'No upcoming filings' },
        { label: 'MCA', status: statusFor(mca), subtext: formatNext(mca) ? `Next: ${formatNext(mca)}` : 'No upcoming filings' },
        { label: 'ACCOUNTING', status: `${accountingPct}%`, subtext: accountingPct > 0 ? 'Books updated' : 'Not started' },
        { label: 'PAYROLL', status: `${employeeCount} Emp`, subtext: employeeCount > 0 ? 'Employees on record' : 'No employees on record' },
      ],
      company: serializeCompany(company),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/tasks
 * Compliance calendar tasks for the user's company.
 */
router.get('/portal/tasks', requireAuth, async (req, res, next) => {
  try {
    const company = await getPrimaryCompanyForUser(req.userId);
    if (!company) return res.json({ tasks: [] });

    const result = await pool.query(
      `SELECT id, category, title, due_date, status
       FROM customer_tasks
       WHERE company_id = $1
       ORDER BY due_date ASC`,
      [company.id]
    );
    res.json({
      tasks: result.rows.map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        dueDate: new Date(r.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: r.status,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/documents
 */
router.get('/portal/documents', requireAuth, async (req, res, next) => {
  try {
    const company = await getPrimaryCompanyForUser(req.userId);
    if (!company) return res.json({ documents: [] });

    const result = await pool.query(
      `SELECT id, name, category, file_size_bytes, status, created_at
       FROM customer_documents
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [company.id]
    );
    res.json({
      documents: result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        uploadDate: new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        size: r.file_size_bytes ? `${(Number(r.file_size_bytes) / (1024 * 1024)).toFixed(1)} MB` : '—',
        status: r.status,
        hasFile: Boolean(r.file_size_bytes),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/documents/:documentId/download
 * Streams only a file belonging to a company the authenticated user owns.
 */
router.get('/portal/documents/:documentId/download', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT d.name, d.mime_type, d.file_content
       FROM customer_documents d
       JOIN company_members cm ON cm.company_id = d.company_id
       WHERE d.id = $1 AND cm.user_id = $2 AND d.file_content IS NOT NULL
       LIMIT 1`,
      [req.params.documentId, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Document file not found' });

    const doc = result.rows[0];
    const safeName = doc.name.replace(/[\r\n"]/g, '_');
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(doc.file_content);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/portal/documents
 * Stores a document upload for the user's company. Requires an existing
 * company (created via Business Onboarding or the Free Compliance Check).
 */
router.post('/portal/documents', requireAuth, validateBody(uploadDocSchema), async (req, res, next) => {
  try {
    const company = await getPrimaryCompanyForUser(req.userId);
    if (!company) {
      return res.status(400).json({ error: 'Complete business onboarding before uploading documents.' });
    }

    const { name, category, fileData, mimeType, fileSizeBytes } = req.validatedBody;
    const fileContent = Buffer.from(fileData, 'base64');

    const result = await pool.query(
      `INSERT INTO customer_documents
         (company_id, uploaded_by, name, category, file_content, file_size_bytes, mime_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Uploaded')
       RETURNING id, name, category, file_size_bytes, status, created_at`,
      [company.id, req.userId, name, category, fileContent, fileSizeBytes, mimeType]
    );

    const doc = result.rows[0];
    res.status(201).json({
      document: {
        id: doc.id,
        name: doc.name,
        category: doc.category,
        uploadDate: new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        size: `${(Number(doc.file_size_bytes) / (1024 * 1024)).toFixed(1)} MB`,
        status: doc.status,
        hasFile: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
