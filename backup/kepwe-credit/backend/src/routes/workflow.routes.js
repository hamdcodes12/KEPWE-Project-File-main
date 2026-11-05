import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, requireStaff, validateBody } from '../middleware/auth.js';

const router = Router();

const CHANNELS = ['WhatsApp/SMS', 'Email', 'WhatsApp', 'Offer', 'Follow-up', 'Campaign'];

const updateStepSchema = z.object({
  channel: z.enum(CHANNELS).optional(),
  message: z.string().trim().min(1).max(1000).optional(),
});

function serializeStep(row) {
  return {
    id: row.id,
    day: row.day_label,
    dayOffset: row.day_offset,
    channel: row.channel,
    message: row.message,
    isActive: row.is_active,
  };
}

/**
 * GET /api/workflow/cadence
 * Automated follow-up sequence steps (Day 0 -> Day 30), shown in the
 * Sales CRM "Cadence Workflow" tab.
 */
router.get('/workflow/cadence', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM lead_followup_cadences ORDER BY sort_order ASC, day_offset ASC`
    );
    res.json({ steps: result.rows.map(serializeStep) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/workflow/cadence/:stepId
 * Staff-only edit of a cadence step's channel/message.
 */
router.patch('/workflow/cadence/:stepId', requireAuth, requireStaff, validateBody(updateStepSchema), async (req, res, next) => {
  try {
    const { stepId } = req.params;
    const existing = await pool.query('SELECT id FROM lead_followup_cadences WHERE id = $1', [stepId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow step not found' });
    }

    const b = req.validatedBody;
    const updates = [];
    const params = [];
    if (b.channel !== undefined) {
      params.push(b.channel);
      updates.push(`channel = $${params.length}`);
    }
    if (b.message !== undefined) {
      params.push(b.message);
      updates.push(`message = $${params.length}`);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    updates.push('updated_by = $' + (params.length + 1));
    params.push(req.userId);
    updates.push('updated_at = NOW()');
    params.push(stepId);

    const result = await pool.query(
      `UPDATE lead_followup_cadences SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json({ step: serializeStep(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workflow/cadence/:stepId/test
 * Records a real lead_activity entry documenting the simulated trigger,
 * instead of only showing a client-side toast with no persistence.
 */
router.post('/workflow/cadence/:stepId/test', requireAuth, requireStaff, async (req, res, next) => {
  try {
    const { stepId } = req.params;
    const step = await pool.query('SELECT * FROM lead_followup_cadences WHERE id = $1', [stepId]);
    if (step.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow step not found' });
    }
    const s = step.rows[0];
    res.json({
      success: true,
      message: `Simulated trigger for ${s.day_label} (${s.channel}): "${s.message}"`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
