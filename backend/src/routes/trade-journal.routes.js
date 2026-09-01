import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, validateBody } from '../middleware/auth.js';

const router = Router();

const VERDICT_TYPES = ['TRADE', 'CAUTION', 'NO_TRADE'];
const TRADE_STATUS_TYPES = ['Executed', 'Skipped', 'Paper Trade', 'Overridden'];

const createEntrySchema = z.object({
  index: z.string().trim().min(1, 'Index is required').max(20),
  strategy: z.string().trim().min(1, 'Strategy is required').max(100),
  verdict: z.enum(VERDICT_TYPES),
  isOverride: z.boolean().optional().default(false),
  overrideReason: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(TRADE_STATUS_TYPES).optional().default('Paper Trade'),
  pnl: z.number().optional().default(0),
});

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function serializeEntry(row) {
  return {
    id: row.id,
    date: formatDate(row.trade_date),
    index: row.index_symbol,
    strategy: row.strategy,
    verdict: row.verdict,
    override: row.is_override,
    overrideReason: row.override_reason,
    status: row.status,
    pnl: Number(row.pnl),
  };
}

/**
 * GET /api/trade-journal
 * Returns the authenticated user's own trade journal entries.
 */
router.get('/trade-journal', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM trade_journals WHERE user_id = $1 ORDER BY trade_date DESC, created_at DESC`,
      [req.userId]
    );

    res.json({ entries: result.rows.map(serializeEntry) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trade-journal
 * Creates a new trade journal entry for the authenticated user. user_id is
 * always derived from req.userId, never trusted from the request body.
 */
router.post('/trade-journal', requireAuth, validateBody(createEntrySchema), async (req, res, next) => {
  try {
    const { index, strategy, verdict, isOverride, overrideReason, status, pnl } = req.validatedBody;

    const result = await pool.query(
      `INSERT INTO trade_journals (user_id, index_symbol, strategy, verdict, is_override, override_reason, status, pnl)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.userId, index, strategy, verdict, isOverride, overrideReason || null, status, pnl]
    );

    res.status(201).json(serializeEntry(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
