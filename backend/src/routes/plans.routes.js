import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

function serializePlan(row) {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    price: Number(row.price_inr),
    billingCycle: row.billing_cycle,
    isIndexpilot: row.is_indexpilot,
    features: row.features,
    sortOrder: row.sort_order,
  };
}

/**
 * GET /api/plans
 * Public reference data — every subscription plan available on the platform.
 * Optional ?scope=indexpilot|business filter.
 */
router.get('/plans', async (req, res, next) => {
  try {
    const { scope } = req.query;
    let where = 'WHERE is_active = TRUE';
    if (scope === 'indexpilot') where += ' AND is_indexpilot = TRUE';
    if (scope === 'business') where += ' AND is_indexpilot = FALSE';

    const result = await pool.query(
      `SELECT * FROM plans ${where} ORDER BY sort_order ASC`
    );
    res.json({ plans: result.rows.map(serializePlan) });
  } catch (err) {
    next(err);
  }
});

export default router;
