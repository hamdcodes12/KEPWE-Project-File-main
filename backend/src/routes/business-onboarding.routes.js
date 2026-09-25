import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { getPrimaryCompanyForUser } from '../services/companies.service.js';

const router = Router();

const BUSINESS_TYPES = ['Private Limited', 'LLP', 'Partnership', 'Proprietorship', 'Other'];

const onboardingSchema = z.object({
  businessType: z.enum(BUSINESS_TYPES),
  businessAge: z.string().trim().min(1).max(30),
  turnover: z.string().trim().min(1).max(20),
  needs: z.array(z.string().trim().max(100)).max(20).default([]),
});

// Mirrors the plan-recommendation rules previously hardcoded on the frontend,
// now resolved against the real `plans` table so price/name changes in the
// database are reflected automatically.
const RECOMMENDATION_RULES = {
  'Pre-revenue + Proprietorship': 'Launch',
  'Pre-revenue + Private Limited': 'Essential',
  '<₹5L + Proprietorship': 'Essential',
  '<₹5L + Private Limited': 'Growth',
  '₹5–25L + Private Limited': 'Growth',
  '₹25–50L + Private Limited': 'Scale',
  '₹50L+ + Private Limited': 'Scale + CFO',
};
const DEFAULT_PLAN_NAME = 'Essential';

/**
 * POST /api/business-onboarding
 * Persists the BusinessOnboardingPage wizard answers and returns the
 * recommended plan resolved against the live `plans` table.
 */
router.post('/business-onboarding', requireAuth, validateBody(onboardingSchema), async (req, res, next) => {
  try {
    const { businessType, businessAge, turnover, needs } = req.validatedBody;

    const key = `${turnover} + ${businessType}`;
    const planName = RECOMMENDATION_RULES[key] || DEFAULT_PLAN_NAME;

    const planResult = await pool.query(
      `SELECT id, name, display_name, price_inr FROM plans WHERE name = $1 AND is_indexpilot = FALSE LIMIT 1`,
      [planName]
    );
    const plan = planResult.rows[0] || null;

    const company = await getPrimaryCompanyForUser(req.userId);

    const insert = await pool.query(
      `INSERT INTO business_onboardings
         (user_id, company_id, business_type, business_age, avg_monthly_turnover, needs, recommended_plan_id, completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING id, created_at`,
      [
        req.userId,
        company ? company.id : null,
        businessType,
        businessAge,
        turnover,
        JSON.stringify(needs),
        plan ? plan.id : null,
      ]
    );

    res.status(201).json({
      id: insert.rows[0].id,
      recommendedPlan: plan
        ? { name: plan.name, displayName: plan.display_name, price: Number(plan.price_inr) }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
