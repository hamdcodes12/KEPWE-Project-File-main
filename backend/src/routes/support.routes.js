import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, requireStaff, validateBody } from '../middleware/auth.js';
import { getPrimaryCompanyForUser } from '../services/companies.service.js';

const router = Router();

const TICKET_CATEGORIES = ['General', 'GST', 'Accounting', 'Payroll', 'Compliance', 'Technical', 'Billing'];
const TICKET_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const TICKET_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const createTicketSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(255),
  category: z.enum(TICKET_CATEGORIES).optional().default('General'),
  priority: z.enum(TICKET_PRIORITIES).optional().default('Normal'),
  description: z.string().trim().min(1, 'Description is required').max(5000),
});

const updateTicketSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
});

const messageSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(5000),
});

/**
 * GET /api/support/tickets
 * List support tickets for the current user (or all for staff).
 */
router.get('/support/tickets', requireAuth, async (req, res, next) => {
  try {
    const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
    const isStaff = staffRoles.includes(req.user.role);

    const { status = '' } = req.query;
    const params = [];
    let where = isStaff ? 'WHERE 1=1' : 'WHERE t.user_id = $1';
    if (!isStaff) params.push(req.userId);

    if (status && TICKET_STATUSES.includes(status)) {
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT t.id, t.subject, t.category, t.priority, t.status, t.description, t.created_at, t.updated_at,
              u.full_name AS user_name, u.email AS user_email
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT 100`,
      params
    );

    res.json({ tickets: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/support/tickets
 * Create a new support ticket.
 */
router.post('/support/tickets', requireAuth, validateBody(createTicketSchema), async (req, res, next) => {
  try {
    const company = await getPrimaryCompanyForUser(req.userId);
    const b = req.validatedBody;

    const result = await pool.query(
      `INSERT INTO support_tickets (user_id, company_id, subject, category, priority, status, description)
       VALUES ($1, $2, $3, $4, $5, 'Open', $6)
       RETURNING id, subject, category, priority, status, description, created_at`,
      [req.userId, company ? company.id : null, b.subject, b.category, b.priority, b.description]
    );

    res.status(201).json({ ticket: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/support/tickets/:ticketId
 * Get a single ticket with its messages.
 */
router.get('/support/tickets/:ticketId', requireAuth, async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
    const isStaff = staffRoles.includes(req.user.role);

    const ticketResult = await pool.query(
      `SELECT t.*, u.full_name AS user_name, u.email AS user_email
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
       WHERE t.id = $1`,
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];
    if (!isStaff && ticket.user_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const messages = await pool.query(
      `SELECT m.id, m.message, m.sender_type, m.created_at,
              COALESCE(u.full_name, 'System') AS sender_name
       FROM support_ticket_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
      [ticketId]
    );

    res.json({ ticket, messages: messages.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/support/tickets/:ticketId
 * Update ticket status/priority/category (staff or owner).
 */
router.patch('/support/tickets/:ticketId', requireAuth, validateBody(updateTicketSchema), async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
    const isStaff = staffRoles.includes(req.user.role);

    const existing = await pool.query('SELECT user_id FROM support_tickets WHERE id = $1', [ticketId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    if (!isStaff && existing.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const b = req.validatedBody;
    const updates = [];
    const params = [];
    if (b.status !== undefined) { params.push(b.status); updates.push(`status = $${params.length}`); }
    if (b.priority !== undefined) { params.push(b.priority); updates.push(`priority = $${params.length}`); }
    if (b.category !== undefined) { params.push(b.category); updates.push(`category = $${params.length}`); }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    params.push(ticketId);
    updates.push('updated_at = NOW()');

    const result = await pool.query(
      `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, subject, category, priority, status, description, updated_at`,
      params
    );

    res.json({ ticket: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/support/tickets/:ticketId/messages
 * Add a message to a ticket.
 */
router.post('/support/tickets/:ticketId/messages', requireAuth, validateBody(messageSchema), async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
    const isStaff = staffRoles.includes(req.user.role);

    const existing = await pool.query('SELECT user_id FROM support_tickets WHERE id = $1', [ticketId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    if (!isStaff && existing.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      `INSERT INTO support_ticket_messages (ticket_id, sender_id, sender_type, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, message, sender_type, created_at`,
      [ticketId, req.userId, isStaff ? 'admin' : 'user', req.validatedBody.message]
    );

    // Update ticket status to In Progress if it was Open
    await pool.query(
      `UPDATE support_tickets SET status = CASE WHEN status = 'Open' THEN 'In Progress' ELSE status END, updated_at = NOW()
       WHERE id = $1`,
      [ticketId]
    );

    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;