 import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, requireStaff, optionalAuth, validateBody } from '../middleware/auth.js';

const router = Router();

const LEAD_SCORES = ['HOT', 'WARM', 'COLD'];
const LEAD_STATUSES = ['New', 'Called', 'Connected', 'Interested', 'Converted', 'Lost'];

const createLeadSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(255),
  contactName: z.string().trim().min(1, 'Contact name is required').max(255),
  mobile: z.string().trim().min(6, 'A valid mobile number is required').max(20),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')).nullable(),
  cin: z.string().trim().max(21).optional().nullable(),
  gstin: z.string().trim().max(15).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  gstStatus: z.string().trim().max(20).optional().nullable(),
  leadScore: z.enum(LEAD_SCORES).optional().default('WARM'),
  leadSource: z.string().trim().max(100).optional().default('Other'),
  incorporationDate: z.string().trim().optional().nullable(),
  initialActivity: z.string().trim().max(500).optional().nullable(),
});

const updateLeadSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  leadScore: z.enum(LEAD_SCORES).optional(),
  assignedExecutive: z.string().uuid().optional().nullable(),
  companyName: z.string().trim().min(1).max(255).optional(),
  contactName: z.string().trim().min(1).max(255).optional(),
  mobile: z.string().trim().min(6).max(20).optional(),
  email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  cin: z.string().trim().max(21).optional().nullable(),
  gstin: z.string().trim().max(15).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  gstStatus: z.string().trim().max(20).optional().nullable(),
  incorporationDate: z.string().trim().optional().nullable(),
  leadSource: z.string().trim().max(100).optional(),
  notes: z.string().optional().nullable(),
  nextFollowupDate: z.string().optional().nullable(),
});

const noteSchema = z.object({
  note: z.string().trim().min(1, 'Note is required').max(2000),
});

const followupSchema = z.object({
  followupDate: z.string().min(1, 'Follow-up date is required'),
  followupType: z.string().trim().max(50).optional().default('Call'),
  notes: z.string().trim().max(2000).optional().nullable(),
  completed: z.boolean().optional().default(false),
});

const activitySchema = z.object({
  activity: z.string().trim().min(1, 'Activity text is required').max(500),
});

function serializeLead(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    mobile: row.mobile,
    email: row.email,
    cin: row.cin,
    gstin: row.gstin,
    incorporationDate: row.incorporation_date,
    industry: row.industry,
    state: row.state,
    gstStatus: row.gst_status,
    leadScore: row.lead_score,
    leadSource: row.lead_source,
    salesActivity: row.sales_activity || [],
    assignedExecutive: row.assigned_executive_name || 'Unassigned',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LEAD_SELECT = `
  SELECT
    cl.*,
    u.full_name AS assigned_executive_name,
    COALESCE(
      (SELECT array_agg(la.activity ORDER BY la.created_at ASC)
       FROM lead_activities la WHERE la.lead_id = cl.id),
      ARRAY[]::text[]
    ) AS sales_activity
  FROM crm_leads cl
  LEFT JOIN users u ON u.id = cl.assigned_executive
`;

/**
 * GET /api/leads
 * Staff-only. Supports filtering (score, status, search), sorting, pagination.
 */
router.get('/leads', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const { score, status, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
    const offset = (page - 1) * pageSize;

    const conditions = [];
    const params = [];

    if (score && LEAD_SCORES.includes(score)) {
      params.push(score);
      conditions.push(`cl.lead_score = $${params.length}`);
    }
    if (status && LEAD_STATUSES.includes(status)) {
      params.push(status);
      conditions.push(`cl.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(cl.company_name ILIKE $${params.length} OR cl.contact_name ILIKE $${params.length})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const listParams = [...params, pageSize, offset];
    const listResult = await pool.query(
      `${LEAD_SELECT} ${whereClause} ORDER BY cl.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM crm_leads cl ${whereClause}`,
      params
    );

    const kpiResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'New') AS new,
         COUNT(*) FILTER (WHERE status IN ('Called','Connected','Interested','Converted')) AS called,
         COUNT(*) FILTER (WHERE status IN ('Connected','Interested','Converted')) AS connected,
         COUNT(*) FILTER (WHERE status IN ('Interested','Converted')) AS interested,
         COUNT(*) FILTER (WHERE status = 'Converted') AS converted
       FROM crm_leads`
    );
    const kpiRow = kpiResult.rows[0];

    res.json({
      leads: listResult.rows.map(serializeLead),
      pagination: {
        page,
        pageSize,
        total: Number(countResult.rows[0].total),
        totalPages: Math.ceil(Number(countResult.rows[0].total) / pageSize),
      },
      kpis: {
        new: Number(kpiRow.new),
        called: Number(kpiRow.called),
        connected: Number(kpiRow.connected),
        interested: Number(kpiRow.interested),
        converted: Number(kpiRow.converted),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/leads
 * Public or authenticated (Contact Page, Free Compliance Check, manual add
 * from the Sales CRM). If a Bearer token is present it is verified and the
 * lead is attributed to that user; otherwise the lead is recorded as an
 * anonymous inbound submission.
 */
router.post('/leads', optionalAuth, validateBody(createLeadSchema), async (req, res, next) => {
  try {
    const createdBy = req.userId || null;
    const b = req.validatedBody;
    const insert = await pool.query(
      `INSERT INTO crm_leads
         (company_name, contact_name, mobile, email, cin, gstin, industry, state,
          gst_status, lead_score, lead_source, incorporation_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        b.companyName,
        b.contactName,
        b.mobile,
        b.email || null,
        b.cin || null,
        b.gstin || null,
        b.industry || null,
        b.state || null,
        b.gstStatus || 'Pending',
        b.leadScore,
        b.leadSource,
        b.incorporationDate || null,
        createdBy,
      ]
    );
    const leadId = insert.rows[0].id;

    if (b.initialActivity) {
      await pool.query(
        `INSERT INTO lead_activities (lead_id, activity, performed_by) VALUES ($1, $2, $3)`,
        [leadId, b.initialActivity, createdBy]
      );
    }

    const full = await pool.query(`${LEAD_SELECT} WHERE cl.id = $1`, [leadId]);
    res.status(201).json({ lead: serializeLead(full.rows[0]) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/leads/:leadId
 * Staff, or the user who created the lead, may update status/score/assignment.
 */
router.patch('/leads/:leadId', requireAuth, validateBody(updateLeadSchema), async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const existing = await pool.query('SELECT created_by FROM crm_leads WHERE id = $1', [leadId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
    const isStaff = staffRoles.includes(req.user.role);
    const isCreator = existing.rows[0].created_by === req.userId;
    if (!isStaff && !isCreator) {
      return res.status(403).json({ error: 'Forbidden: you do not have access to this lead' });
    }

    const b = req.validatedBody;
    const updates = [];
    const params = [];
    if (b.status !== undefined) {
      params.push(b.status);
      updates.push(`status = $${params.length}`);
    }
    if (b.leadScore !== undefined) {
      params.push(b.leadScore);
      updates.push(`lead_score = $${params.length}`);
    }
    if (b.assignedExecutive !== undefined && isStaff) {
      params.push(b.assignedExecutive);
      updates.push(`assigned_executive = $${params.length}`);
    }
    // Editable lead fields (staff or creator)
    if (b.companyName !== undefined) { params.push(b.companyName); updates.push(`company_name = $${params.length}`); }
    if (b.contactName !== undefined) { params.push(b.contactName); updates.push(`contact_name = $${params.length}`); }
    if (b.mobile !== undefined) { params.push(b.mobile); updates.push(`mobile = $${params.length}`); }
    if (b.email !== undefined) { params.push(b.email || null); updates.push(`email = $${params.length}`); }
    if (b.cin !== undefined) { params.push(b.cin || null); updates.push(`cin = $${params.length}`); }
    if (b.gstin !== undefined) { params.push(b.gstin || null); updates.push(`gstin = $${params.length}`); }
    if (b.industry !== undefined) { params.push(b.industry || null); updates.push(`industry = $${params.length}`); }
    if (b.state !== undefined) { params.push(b.state || null); updates.push(`state = $${params.length}`); }
    if (b.gstStatus !== undefined) { params.push(b.gstStatus); updates.push(`gst_status = $${params.length}`); }
    if (b.incorporationDate !== undefined) { params.push(b.incorporationDate || null); updates.push(`incorporation_date = $${params.length}`); }
    if (b.leadSource !== undefined) { params.push(b.leadSource); updates.push(`lead_source = $${params.length}`); }
    if (b.notes !== undefined) { params.push(b.notes || null); updates.push(`notes = $${params.length}`); }
    if (b.nextFollowupDate !== undefined) { params.push(b.nextFollowupDate || null); updates.push(`next_followup_date = $${params.length}`); }
    if (b.status !== undefined || b.leadScore !== undefined) {
      params.push(new Date());
      updates.push(`last_activity_at = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(leadId);
    await pool.query(
      `UPDATE crm_leads SET ${updates.join(', ')} WHERE id = $${params.length}`,
      params
    );

    if (b.status) {
      await pool.query(
        `INSERT INTO lead_activities (lead_id, activity, performed_by) VALUES ($1, $2, $3)`,
        [leadId, `Status updated to ${b.status}`, req.userId]
      );
    }

    const full = await pool.query(`${LEAD_SELECT} WHERE cl.id = $1`, [leadId]);
    res.json({ lead: serializeLead(full.rows[0]) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/leads/:leadId/activities
 */
router.get('/leads/:leadId/activities', requireAuth, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const lead = await pool.query('SELECT created_by FROM crm_leads WHERE id = $1', [leadId]);
    if (lead.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
    if (!staffRoles.includes(req.user.role) && lead.rows[0].created_by !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      `SELECT id, activity, created_at FROM lead_activities WHERE lead_id = $1 ORDER BY created_at ASC`,
      [leadId]
    );
    res.json({ activities: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/leads/:leadId/activities
 */
router.post('/leads/:leadId/activities', requireAuth, requireStaff, validateBody(activitySchema), async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const lead = await pool.query('SELECT id FROM crm_leads WHERE id = $1', [leadId]);
    if (lead.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const insert = await pool.query(
      `INSERT INTO lead_activities (lead_id, activity, performed_by)
       VALUES ($1, $2, $3) RETURNING id, activity, created_at`,
      [leadId, req.validatedBody.activity, req.userId]
    );
    res.status(201).json({ activity: insert.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/leads/:leadId
 * Get a single lead with full details (activities, notes, followups).
 */
router.get('/leads/:leadId', requireAuth, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
    const isStaff = staffRoles.includes(req.user.role);

    const leadResult = await pool.query(`SELECT created_by FROM crm_leads WHERE id = $1`, [leadId]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!isStaff && leadResult.rows[0].created_by !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const full = await pool.query(`${LEAD_SELECT} WHERE cl.id = $1`, [leadId]);

    const notes = await pool.query(
      `SELECT n.id, n.note, n.created_at, u.full_name AS created_by_name
       FROM crm_lead_notes n
       LEFT JOIN users u ON u.id = n.created_by
       WHERE n.lead_id = $1 ORDER BY n.created_at DESC`,
      [leadId]
    );

    const followups = await pool.query(
      `SELECT id, followup_date, followup_type, notes, completed, created_at
       FROM crm_lead_followups WHERE lead_id = $1 ORDER BY followup_date ASC`,
      [leadId]
    );

    const activities = await pool.query(
      `SELECT id, activity, created_at FROM lead_activities WHERE lead_id = $1 ORDER BY created_at DESC`,
      [leadId]
    );

    res.json({
      lead: serializeLead(full.rows[0]),
      notes: notes.rows,
      followups: followups.rows,
      activities: activities.rows,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/leads/:leadId
 * Delete a lead (staff only).
 */
router.delete('/leads/:leadId', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const result = await pool.query('DELETE FROM crm_leads WHERE id = $1 RETURNING id', [leadId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/leads/:leadId/notes
 * Add a note to a lead (staff or creator).
 */
router.post('/leads/:leadId/notes', requireAuth, validateBody(noteSchema), async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
    const isStaff = staffRoles.includes(req.user.role);

    const lead = await pool.query('SELECT created_by FROM crm_leads WHERE id = $1', [leadId]);
    if (lead.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!isStaff && lead.rows[0].created_by !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const insert = await pool.query(
      `INSERT INTO crm_lead_notes (lead_id, note, created_by)
       VALUES ($1, $2, $3) RETURNING id, note, created_at`,
      [leadId, req.validatedBody.note, req.userId]
    );
    res.status(201).json({ note: insert.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/leads/:leadId/followups
 * Add a follow-up to a lead (staff or creator).
 */
router.post('/leads/:leadId/followups', requireAuth, validateBody(followupSchema), async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
    const isStaff = staffRoles.includes(req.user.role);

    const lead = await pool.query('SELECT created_by FROM crm_leads WHERE id = $1', [leadId]);
    if (lead.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!isStaff && lead.rows[0].created_by !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const b = req.validatedBody;
    const insert = await pool.query(
      `INSERT INTO crm_lead_followups (lead_id, followup_date, followup_type, notes, completed, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, followup_date, followup_type, notes, completed, created_at`,
      [leadId, b.followupDate, b.followupType, b.notes || null, b.completed, req.userId]
    );
    res.status(201).json({ followup: insert.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/leads/:leadId/followups/:followupId
 * Update a follow-up (mark complete, edit notes/date).
 */
router.patch('/leads/:leadId/followups/:followupId', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const { leadId, followupId } = req.params;
    const schema = z.object({
      completed: z.boolean().optional(),
      followupDate: z.string().optional(),
      followupType: z.string().trim().max(50).optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const fields = [];
    const params = [];
    const d = parsed.data;
    if (d.completed !== undefined) { params.push(d.completed); fields.push(`completed = $${params.length}`); }
    if (d.followupDate !== undefined) { params.push(d.followupDate); fields.push(`followup_date = $${params.length}`); }
    if (d.followupType !== undefined) { params.push(d.followupType); fields.push(`followup_type = $${params.length}`); }
    if (d.notes !== undefined) { params.push(d.notes || null); fields.push(`notes = $${params.length}`); }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    params.push(followupId, leadId);

    const result = await pool.query(
      `UPDATE crm_lead_followups SET ${fields.join(', ')} WHERE id = $${params.length - 1} AND lead_id = $${params.length}
       RETURNING id, followup_date, followup_type, notes, completed`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }
    res.json({ followup: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
