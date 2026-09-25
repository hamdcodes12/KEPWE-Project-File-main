import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { optionalAuth, validateBody } from '../middleware/auth.js';

const router = Router();

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(255),
  company: z.string().trim().max(255).optional().nullable(),
  email: z.string().trim().email('Please enter a valid email.').max(255),
  phone: z.string().trim().min(10, 'Please enter a 10-digit mobile number.').max(20),
  requirement: z.string().trim().max(100).optional().default('GST & Accounting'),
});

/**
 * POST /api/contact
 * "Request Free CA Callback" form on the Contact page.
 * Persists a contact_submissions row AND creates a linked CRM lead so the
 * inbound request enters the real sales pipeline, mirroring the previous
 * (fake, client-only) addCRMLead() behaviour with real PostgreSQL data.
 */
router.post('/contact', optionalAuth, validateBody(contactSchema), async (req, res, next) => {
  try {
    const b = req.validatedBody;
    const createdBy = req.userId || null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const leadInsert = await client.query(
        `INSERT INTO crm_leads
           (company_name, contact_name, mobile, email, industry, lead_score, lead_source, created_by, status)
         VALUES ($1, $2, $3, $4, $5, 'WARM', 'Contact Page', $6, 'New')
         RETURNING id`,
        [
          b.company && b.company.trim() ? b.company.trim() : `${b.name} Enterprise`,
          b.name,
          b.phone,
          b.email,
          b.requirement,
          createdBy,
        ]
      );
      const leadId = leadInsert.rows[0].id;

      await client.query(
        `INSERT INTO lead_activities (lead_id, activity, performed_by)
         VALUES ($1, $2, $3)`,
        [leadId, `Inbound contact request submitted for ${b.requirement}`, createdBy]
      );

      const contactInsert = await client.query(
        `INSERT INTO contact_submissions (name, company, email, phone, requirement, lead_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, status, created_at`,
        [b.name, b.company || null, b.email, b.phone, b.requirement, leadId]
      );

      await client.query('COMMIT');

      res.status(201).json({
        submission: {
          id: contactInsert.rows[0].id,
          status: contactInsert.rows[0].status,
          createdAt: contactInsert.rows[0].created_at,
        },
        leadId,
      });
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
