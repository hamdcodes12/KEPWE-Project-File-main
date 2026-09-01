import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, validateBody } from '../middleware/auth.js';

const router = Router();

const updatePaperTradeSchema = z
  .object({
    paperTradeMode: z.boolean().optional(),
    simulatedCapital: z.number().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

function serializePaperTradeSettings(row) {
  return {
    paperTradeMode: row.paper_trade_mode,
    simulatedCapital: Number(row.simulated_capital),
    sessionsCompleted: row.sessions_completed,
  };
}

/**
 * GET /api/paper-trade
 * Returns the authenticated user's paper trade settings, creating a
 * default row on first access if one doesn't exist yet.
 */
router.get('/paper-trade', requireAuth, async (req, res, next) => {
  try {
    let result = await pool.query('SELECT * FROM paper_trade_settings WHERE user_id = $1', [req.userId]);

    if (result.rows.length === 0) {
      await pool.query(
        `INSERT INTO paper_trade_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [req.userId]
      );
      result = await pool.query('SELECT * FROM paper_trade_settings WHERE user_id = $1', [req.userId]);
    }

    res.json(serializePaperTradeSettings(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/paper-trade
 * Upserts the authenticated user's paper trade settings. Only fields
 * present in the body are updated; user_id always comes from req.userId.
 */
router.patch('/paper-trade', requireAuth, validateBody(updatePaperTradeSchema), async (req, res, next) => {
  try {
    const paperTradeMode = req.validatedBody.paperTradeMode === undefined ? null : req.validatedBody.paperTradeMode;
    const simulatedCapital = req.validatedBody.simulatedCapital === undefined ? null : req.validatedBody.simulatedCapital;

    const result = await pool.query(
      `INSERT INTO paper_trade_settings (user_id, paper_trade_mode, simulated_capital)
       VALUES ($1, COALESCE($2, TRUE), COALESCE($3, 100000))
       ON CONFLICT (user_id) DO UPDATE SET
         paper_trade_mode = COALESCE($2, paper_trade_settings.paper_trade_mode),
         simulated_capital = COALESCE($3, paper_trade_settings.simulated_capital),
         updated_at = NOW()
       RETURNING *`,
      [req.userId, paperTradeMode, simulatedCapital]
    );

    res.json(serializePaperTradeSettings(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
