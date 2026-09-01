import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const PLAN_RANKS = {
  'Free Trial': 0,
  'Free Tier': 0,
  '1 Month': 1,
  '1 MONTH': 1,
  '3 Months': 2,
  '3 MONTHS': 2,
  '6 Months': 3,
  '6 MONTHS': 3,
  '1 Year': 4,
  '1 YEAR': 4,
  Basic: 1,
  Pro: 2,
  'Pro+': 3,
  Premium: 4,
};

function planRank(planName) {
  return PLAN_RANKS[planName] ?? 0;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * GET /api/reports
 * Returns all active reports, with a lock status computed from the
 * authenticated user's real IndexPilot subscription plan (never trusted
 * from the client). Users with no subscription are treated as 'Free Trial'.
 */
router.get('/reports', requireAuth, async (req, res, next) => {
  try {
    const planResult = await pool.query(
      `SELECT p.name AS plan_name
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1`,
      [req.userId]
    );

    const userPlan = planResult.rows.length > 0 ? planResult.rows[0].plan_name : 'Free Trial';
    const userRank = planRank(userPlan);

    const reportsResult = await pool.query(
      `SELECT * FROM reports WHERE is_active = TRUE ORDER BY sort_order ASC, published_date DESC`
    );

    const reports = reportsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      date: formatDate(row.published_date),
      plan: row.required_plan,
      status: userRank >= planRank(row.required_plan) ? 'Unlocked' : 'Locked',
      desc: row.summary,
    }));

    res.json({ reports });
  } catch (err) {
    next(err);
  }
});

export default router;
