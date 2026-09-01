import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, validateBody } from '../middleware/auth.js';

const router = Router();

const EXPERIENCE_TYPES = ['New', 'Intermediate', 'Experienced'];
const RISK_CATEGORY_TYPES = ['Conservative', 'Balanced', 'Aggressive'];

const updateRiskProfileSchema = z
  .object({
    experience: z.enum(EXPERIENCE_TYPES).optional(),
    capitalRange: z.string().trim().min(1).max(20).optional(),
    capitalAmount: z.number().min(0).optional(),
    maxAcceptableLoss: z.number().min(0).optional(),
    indices: z.array(z.string().trim().min(1)).optional(),
    riskCategory: z.enum(RISK_CATEGORY_TYPES).optional(),
    onboardingComplete: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

function serializeRiskProfile(row) {
  return {
    experience: row.experience,
    capitalRange: row.capital_range,
    capitalAmount: Number(row.capital_amount),
    maxAcceptableLoss: Number(row.max_acceptable_loss),
    indices: row.indices,
    riskCategory: row.risk_category,
    onboardingComplete: row.onboarding_complete,
  };
}

/**
 * GET /api/risk-profile
 * Returns the authenticated user's risk profile, creating a default row
 * on first access if one doesn't exist yet.
 */
router.get('/risk-profile', requireAuth, async (req, res, next) => {
  try {
    let result = await pool.query('SELECT * FROM risk_profiles WHERE user_id = $1', [req.userId]);

    if (result.rows.length === 0) {
      await pool.query(
        `INSERT INTO risk_profiles (user_id, experience, capital_range, capital_amount, max_acceptable_loss, indices, risk_category, onboarding_complete)
         VALUES ($1, 'New', '₹25k–1L', 0, 0, '["NIFTY"]'::jsonb, 'Balanced', FALSE)
         ON CONFLICT (user_id) DO NOTHING`,
        [req.userId]
      );
      result = await pool.query('SELECT * FROM risk_profiles WHERE user_id = $1', [req.userId]);
    }

    res.json(serializeRiskProfile(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/risk-profile
 * Upserts the authenticated user's risk profile. Only fields present in the
 * body are updated; user_id is always derived from req.userId, never the body.
 */
router.put('/risk-profile', requireAuth, validateBody(updateRiskProfileSchema), async (req, res, next) => {
  try {
    const { experience, capitalRange, capitalAmount, maxAcceptableLoss, indices, riskCategory, onboardingComplete } =
      req.validatedBody;

    const result = await pool.query(
      `INSERT INTO risk_profiles (user_id, experience, capital_range, capital_amount, max_acceptable_loss, indices, risk_category, onboarding_complete)
       VALUES ($1, COALESCE($2::experience_type, 'New'), COALESCE($3, '₹25k–1L'), COALESCE($4, 0), COALESCE($5, 0), COALESCE($6, '["NIFTY"]'::jsonb), COALESCE($7::risk_category_type, 'Balanced'), COALESCE($8, FALSE))
       ON CONFLICT (user_id) DO UPDATE SET
         experience = COALESCE($2::experience_type, risk_profiles.experience),
         capital_range = COALESCE($3, risk_profiles.capital_range),
         capital_amount = COALESCE($4, risk_profiles.capital_amount),
         max_acceptable_loss = COALESCE($5, risk_profiles.max_acceptable_loss),
         indices = COALESCE($6, risk_profiles.indices),
         risk_category = COALESCE($7::risk_category_type, risk_profiles.risk_category),
         onboarding_complete = COALESCE($8, risk_profiles.onboarding_complete),
         updated_at = NOW()
       RETURNING *`,
      [
        req.userId,
        experience || null,
        capitalRange || null,
        capitalAmount ?? null,
        maxAcceptableLoss ?? null,
        indices ? JSON.stringify(indices) : null,
        riskCategory || null,
        onboardingComplete ?? null,
      ]
    );

    // If onboarding is being marked complete, record the timestamp on the user
    if (onboardingComplete === true) {
      await pool.query(
        `UPDATE users SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()) WHERE id = $1`,
        [req.userId]
      );
    }

    res.json(serializeRiskProfile(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
