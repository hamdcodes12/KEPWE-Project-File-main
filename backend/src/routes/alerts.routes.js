import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, validateBody } from '../middleware/auth.js';

const router = Router();

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const updateAlertConfigSchema = z
  .object({
    verdictChanges: z.boolean().optional(),
    riskLimitBreach: z.boolean().optional(),
    eventRisk: z.boolean().optional(),
    newMatchingSetup: z.boolean().optional(),
    volatilitySpike: z.boolean().optional(),
    minuteByMinutePrice: z.boolean().optional(),
    promotional: z.boolean().optional(),
    channels: z
      .object({
        push: z.boolean().optional(),
        email: z.boolean().optional(),
        sms: z.boolean().optional(),
      })
      .optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z.string().regex(TIME_REGEX, 'Expected HH:MM').optional(),
    quietHoursEnd: z.string().regex(TIME_REGEX, 'Expected HH:MM').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

function serializeAlertConfig(row) {
  return {
    verdictChanges: row.verdict_changes,
    riskLimitBreach: row.risk_limit_breach,
    eventRisk: row.event_risk,
    newMatchingSetup: row.new_matching_setup,
    volatilitySpike: row.volatility_spike,
    minuteByMinutePrice: row.minute_by_minute_price,
    promotional: row.promotional,
    channels: {
      push: row.channel_push,
      email: row.channel_email,
      sms: row.channel_sms,
    },
    quietHoursEnabled: row.quiet_hours_enabled,
    quietHoursStart: row.quiet_hours_start?.slice(0, 5),
    quietHoursEnd: row.quiet_hours_end?.slice(0, 5),
  };
}

/**
 * GET /api/alerts/config
 * Returns the authenticated user's alert preferences, creating a default
 * row on first access if one doesn't exist yet.
 */
router.get('/alerts/config', requireAuth, async (req, res, next) => {
  try {
    let result = await pool.query('SELECT * FROM alert_configs WHERE user_id = $1', [req.userId]);

    if (result.rows.length === 0) {
      await pool.query(`INSERT INTO alert_configs (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [
        req.userId,
      ]);
      result = await pool.query('SELECT * FROM alert_configs WHERE user_id = $1', [req.userId]);
    }

    res.json(serializeAlertConfig(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/alerts/config
 * Upserts the authenticated user's alert preferences. Only fields present
 * in the body are updated; user_id always comes from req.userId.
 */
router.put('/alerts/config', requireAuth, validateBody(updateAlertConfigSchema), async (req, res, next) => {
  try {
    const {
      verdictChanges,
      riskLimitBreach,
      eventRisk,
      newMatchingSetup,
      volatilitySpike,
      minuteByMinutePrice,
      promotional,
      channels,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
    } = req.validatedBody;

    const channelPush = channels?.push;
    const channelEmail = channels?.email;
    const channelSms = channels?.sms;

    const result = await pool.query(
      `INSERT INTO alert_configs (
         user_id, verdict_changes, risk_limit_breach, event_risk, new_matching_setup,
         volatility_spike, minute_by_minute_price, promotional,
         channel_push, channel_email, channel_sms,
         quiet_hours_enabled, quiet_hours_start, quiet_hours_end
       )
       VALUES (
         $1, COALESCE($2, TRUE), COALESCE($3, TRUE), COALESCE($4, TRUE), COALESCE($5, TRUE),
         COALESCE($6, TRUE), COALESCE($7, FALSE), COALESCE($8, FALSE),
         COALESCE($9, TRUE), COALESCE($10, TRUE), COALESCE($11, FALSE),
         COALESCE($12, TRUE), COALESCE($13::time, '22:00'), COALESCE($14::time, '08:00')
       )
       ON CONFLICT (user_id) DO UPDATE SET
         verdict_changes = COALESCE($2, alert_configs.verdict_changes),
         risk_limit_breach = COALESCE($3, alert_configs.risk_limit_breach),
         event_risk = COALESCE($4, alert_configs.event_risk),
         new_matching_setup = COALESCE($5, alert_configs.new_matching_setup),
         volatility_spike = COALESCE($6, alert_configs.volatility_spike),
         minute_by_minute_price = COALESCE($7, alert_configs.minute_by_minute_price),
         promotional = COALESCE($8, alert_configs.promotional),
         channel_push = COALESCE($9, alert_configs.channel_push),
         channel_email = COALESCE($10, alert_configs.channel_email),
         channel_sms = COALESCE($11, alert_configs.channel_sms),
         quiet_hours_enabled = COALESCE($12, alert_configs.quiet_hours_enabled),
         quiet_hours_start = COALESCE($13::time, alert_configs.quiet_hours_start),
         quiet_hours_end = COALESCE($14::time, alert_configs.quiet_hours_end),
         updated_at = NOW()
       RETURNING *`,
      [
        req.userId,
        verdictChanges ?? null,
        riskLimitBreach ?? null,
        eventRisk ?? null,
        newMatchingSetup ?? null,
        volatilitySpike ?? null,
        minuteByMinutePrice ?? null,
        promotional ?? null,
        channelPush ?? null,
        channelEmail ?? null,
        channelSms ?? null,
        quietHoursEnabled ?? null,
        quietHoursStart || null,
        quietHoursEnd || null,
      ]
    );

    res.json(serializeAlertConfig(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
