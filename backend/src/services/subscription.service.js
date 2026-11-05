/**
 * KEPWE Quant Subscription Service
 * Handles trial activation, subscription management, and feature entitlements.
 *
 * All entitlement decisions are server-side using user_subscriptions +
 * subscription_plans tables. The stored function has_feature_access() is the
 * single authority for feature gating — it evaluates plan features AND
 * subscription status (active/expired/trial) in one atomic DB call.
 */

import { pool } from '../config/db.js';

// ============================================================================
// TRIAL ACTIVATION
// ============================================================================

/**
 * Activate the user's one-time free demo after an explicit user action.
 */
export async function activateFreeTrial(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `WITH activation AS MATERIALIZED (SELECT clock_timestamp() AS activated_at)
       UPDATE user_subscriptions AS us
       SET status = 'trial'::quant_subscription_status,
           plan_id = plan.id,
           trial_status = 'ACTIVE',
           trial_start_at = activation.activated_at,
           trial_end_at = activation.activated_at + INTERVAL '24 hours',
           is_trial_used = TRUE,
           updated_at = activation.activated_at
       FROM activation
       JOIN subscription_plans AS plan ON plan.plan_code = 'TRIAL' AND plan.is_active = TRUE
       WHERE us.user_id = $1
         AND (
           us.status = 'not_started'::quant_subscription_status
           OR (us.status IN ('expired', 'cancelled') AND (us.subscription_end_at IS NULL OR us.subscription_end_at <= clock_timestamp()))
           OR (us.status = 'active' AND us.subscription_end_at IS NOT NULL AND us.subscription_end_at <= clock_timestamp())
         )
         AND us.trial_status = 'NOT_STARTED'
         AND us.is_trial_used = FALSE
         AND us.trial_start_at IS NULL
         AND us.trial_end_at IS NULL
       RETURNING us.*`,
      [userId]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return null;
    }

    const trial = result.rows[0];
    await client.query(
      `INSERT INTO subscription_audit_log (
         user_id, subscription_id, event_type, event_description,
         old_status, new_status, new_plan_code, performed_by, metadata
       ) VALUES (
         $1, $2, 'trial_activated', '24-hour free demo activated by the user',
         'not_started', 'trial', 'TRIAL', 'user',
         jsonb_build_object('activatedAt', $3::timestamptz, 'expiresAt', $4::timestamptz, 'durationSeconds', 86400)
       )`,
      [userId, trial.id, trial.trial_start_at, trial.trial_end_at]
    );
    await client.query('COMMIT');
    scheduleTrialExpirySweep();
    return trial;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// SUBSCRIPTION READ
// ============================================================================

/**
 * Get user's current subscription with full plan details.
 * Returns null if no record exists.
 */
export async function getUserSubscription(userId) {
  // Persist expiry on the first request at/after the exact DB deadline. The
  // feature gate also checks the deadline in SQL, so access never waits for UI refresh.
  await pool.query(
    `UPDATE user_subscriptions
     SET status = CASE WHEN status = 'trial' THEN 'expired'::quant_subscription_status ELSE status END,
         trial_status = 'EXPIRED',
         updated_at = clock_timestamp()
     WHERE user_id = $1 AND trial_status = 'ACTIVE' AND trial_end_at <= clock_timestamp()`,
    [userId]
  );
  const result = await pool.query(
    `SELECT
       us.*,
       sp.plan_code,
       sp.plan_name,
       sp.display_name,
       sp.price_inr,
       sp.billing_period,
       sp.features,
       sp.limits,
       sp.trial_days,
       db_clock.db_now AS server_now,
       CASE
         WHEN us.status = 'trial' THEN us.trial_end_at > db_clock.db_now
         WHEN us.status = 'active' THEN us.subscription_end_at IS NULL OR us.subscription_end_at > db_clock.db_now
         WHEN us.status = 'cancelled' THEN us.subscription_end_at IS NOT NULL AND us.subscription_end_at > db_clock.db_now
         ELSE FALSE
       END AS is_active,
       CASE
         WHEN us.status = 'trial' THEN GREATEST(0, EXTRACT(EPOCH FROM (us.trial_end_at - db_clock.db_now)) * 1000)
         WHEN us.status IN ('active', 'cancelled') AND us.subscription_end_at IS NOT NULL
           THEN GREATEST(0, EXTRACT(EPOCH FROM (us.subscription_end_at - db_clock.db_now)) * 1000)
         ELSE NULL
       END AS time_remaining_ms
     FROM user_subscriptions us
     JOIN subscription_plans sp ON us.plan_id = sp.id
     CROSS JOIN (SELECT clock_timestamp() AS db_now) AS db_clock
     WHERE us.user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const sub = result.rows[0];

  const timeRemaining = sub.time_remaining_ms == null ? null : Number(sub.time_remaining_ms);
  const daysRemaining = timeRemaining == null ? null : Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
  const hoursRemaining = timeRemaining == null ? null : Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  return {
    ...sub,
    timeRemaining,
    daysRemaining,
    hoursRemaining,
    serverNow: sub.server_now,
    isActive: sub.is_active === true,
  };
}

// ============================================================================
// FEATURE ENTITLEMENTS (server-side, DB-authoritative)
// ============================================================================

/**
 * Check if user has access to a specific feature.
 * Delegates to the has_feature_access() PG stored function which evaluates
 * BOTH subscription status and plan features atomically.
 */
export async function hasFeatureAccess(userId, featureKey) {
  try {
    const result = await pool.query(
      `SELECT has_feature_access($1::uuid, $2::text) AS has_access`,
      [userId, featureKey]
    );
    return result.rows[0]?.has_access === true;
  } catch (err) {
    // If the function doesn't exist yet (migration not run), fail safe
    console.error('[subscription] has_feature_access error:', err.message);
    return false;
  }
}

/**
 * Get user's full feature map from their current plan.
 */
export async function getUserFeatures(userId) {
  try {
    const result = await pool.query(
      `SELECT get_user_plan_features($1::uuid) AS features`,
      [userId]
    );
    return result.rows[0]?.features || {};
  } catch (err) {
    console.error('[subscription] get_user_plan_features error:', err.message);
    return {};
  }
}

/**
 * Get user's full limits map from their current plan.
 */
export async function getUserLimits(userId) {
  try {
    const result = await pool.query(
      `SELECT get_user_plan_limits($1::uuid) AS limits`,
      [userId]
    );
    return result.rows[0]?.limits || {};
  } catch (err) {
    console.error('[subscription] get_user_plan_limits error:', err.message);
    return {};
  }
}

/**
 * Check if user is within a specific usage limit.
 * Returns { allowed, limit, current, remaining }
 */
export async function checkLimit(userId, limitKey, currentCount) {
  const limits = await getUserLimits(userId);
  const limit = limits[limitKey];

  if (limit === -1 || limit === '-1') {
    return { allowed: true, limit: -1, current: currentCount };
  }

  if (limit === undefined || limit === null) {
    return { allowed: false, limit: 0, current: currentCount };
  }

  const numLimit = Number(limit);
  return {
    allowed: currentCount < numLimit,
    limit: numLimit,
    current: currentCount,
    remaining: Math.max(0, numLimit - currentCount),
  };
}

// ============================================================================
// PLAN CATALOG
// ============================================================================

/**
 * Get all active subscription plans ordered for display.
 */
export async function getAvailablePlans() {
  const result = await pool.query(
    `SELECT * FROM subscription_plans
     WHERE is_active = TRUE
     ORDER BY display_order ASC`
  );
  return result.rows;
}

/**
 * Get specific plan by code (case-insensitive).
 */
export async function getPlanByCode(planCode) {
  const result = await pool.query(
    `SELECT * FROM subscription_plans
     WHERE plan_code = $1 AND is_active = TRUE`,
    [planCode.toUpperCase()]
  );
  return result.rows[0] || null;
}

// ============================================================================
// SUBSCRIPTION UPGRADE (called after payment verification)
// ============================================================================

/**
 * Activate a paid plan for a user. Called only after Razorpay payment
 * verification succeeds — never based on frontend signals alone.
 */
export async function upgradeToPaidPlan(userId, planCode) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const planResult = await client.query(
      `SELECT * FROM subscription_plans
       WHERE plan_code = $1 AND is_active = TRUE`,
      [planCode.toUpperCase()]
    );

    if (planResult.rows.length === 0) {
      throw new Error(`Plan '${planCode}' not found`);
    }

    const plan = planResult.rows[0];
    const now = new Date();

    // Calculate subscription end date
    let subscriptionEndAt;
    if (plan.billing_period === 'monthly') {
      subscriptionEndAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (plan.billing_period === 'quarterly') {
      subscriptionEndAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    } else if (plan.billing_period === 'yearly') {
      subscriptionEndAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else {
      // Default 30 days
      subscriptionEndAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Get old status for audit
    const oldSub = await client.query(
      `SELECT status, plan_id FROM user_subscriptions WHERE user_id = $1`,
      [userId]
    );
    const oldStatus = oldSub.rows[0]?.status || 'none';
    const oldPlanId = oldSub.rows[0]?.plan_id;
    const oldPlanCode = oldPlanId
      ? (await client.query('SELECT plan_code FROM subscription_plans WHERE id = $1', [oldPlanId])).rows[0]?.plan_code
      : null;

    // Upsert subscription record
    const result = await client.query(
      `INSERT INTO user_subscriptions (
         user_id, plan_id, status,
         subscription_start_at, subscription_end_at,
         current_period_start, current_period_end,
         is_trial_used, trial_status, auto_renew,
         cancelled_at, cancellation_reason, suspended_at
       ) VALUES (
         $1, $2, 'active'::quant_subscription_status,
         NOW(), $3, NOW(), $3,
         FALSE, 'NOT_STARTED', TRUE,
         NULL, NULL, NULL
       )
       ON CONFLICT (user_id) DO UPDATE SET
         plan_id              = EXCLUDED.plan_id,
         status               = 'active'::quant_subscription_status,
         subscription_start_at = NOW(),
         subscription_end_at  = EXCLUDED.subscription_end_at,
         current_period_start = NOW(),
         current_period_end   = EXCLUDED.subscription_end_at,
         next_payment_at      = EXCLUDED.subscription_end_at,
         trial_status         = CASE WHEN trial_status = 'ACTIVE' THEN 'EXPIRED' ELSE trial_status END,
         is_trial_used        = CASE WHEN trial_status = 'ACTIVE' THEN TRUE ELSE user_subscriptions.is_trial_used END,
         auto_renew           = TRUE,
         cancelled_at         = NULL,
         cancellation_reason  = NULL,
         suspended_at         = NULL,
         suspended_reason     = NULL,
         updated_at           = NOW()
       RETURNING *`,
      [userId, plan.id, subscriptionEndAt]
    );

    // Audit trail
    await client.query(
      `INSERT INTO subscription_audit_log (
         user_id, subscription_id, event_type, event_description,
         old_status, new_status, old_plan_code, new_plan_code,
         performed_by, metadata
       ) VALUES (
         $1, $2, 'plan_upgraded',
         $3,
         $4, 'active', $5, $6,
         'system',
         jsonb_build_object(
           'planCode', $6,
           'subscriptionEndAt', $7,
           'billingPeriod', $8
         )
       )`,
      [
        userId,
        result.rows[0].id,
        `Subscription upgraded to ${plan.display_name}`,
        oldStatus,
        oldPlanCode,
        plan.plan_code,
        subscriptionEndAt,
        plan.billing_period,
      ]
    );

    await client.query('COMMIT');
    return {
      ...result.rows[0],
      plan_code: plan.plan_code,
      plan_name: plan.plan_name,
      display_name: plan.display_name,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[subscription] upgradeToPaidPlan error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// CANCEL / REACTIVATE
// ============================================================================

/**
 * Cancel a subscription at period end (access continues until subscription_end_at).
 */
export async function cancelSubscription(userId, reason = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT us.*, sp.plan_code FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = $1`,
      [userId]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const sub = existing.rows[0];

    const result = await client.query(
      `UPDATE user_subscriptions
       SET status = 'cancelled'::quant_subscription_status,
           trial_status = CASE WHEN status = 'trial' THEN 'EXPIRED' ELSE trial_status END,
           auto_renew = FALSE,
           cancellation_reason = $2,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1
         AND status IN ('active', 'trial')
       RETURNING *`,
      [userId, reason]
    );

    if (result.rows.length > 0) {
      await client.query(
        `INSERT INTO subscription_audit_log (
           user_id, subscription_id, event_type, event_description,
           old_status, new_status, old_plan_code, new_plan_code,
           performed_by, metadata
         ) VALUES ($1, $2, 'subscription_cancelled', $3, $4, 'cancelled', $5, $5, 'user',
           jsonb_build_object('reason', $6))`,
        [userId, sub.id, `Subscription cancelled: ${reason || 'No reason provided'}`,
          sub.status, sub.plan_code, reason]
      );
    }

    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reactivate a cancelled subscription (turn auto-renew back on).
 */
export async function reactivateSubscription(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE user_subscriptions
       SET status = 'active'::quant_subscription_status,
           auto_renew = TRUE,
           cancellation_reason = NULL,
           cancelled_at = NULL,
           updated_at = NOW()
       WHERE user_id = $1
         AND status = 'cancelled'
         AND (subscription_end_at IS NULL OR subscription_end_at > NOW())
         AND plan_id IN (SELECT id FROM subscription_plans WHERE plan_code <> 'TRIAL')
       RETURNING *`,
      [userId]
    );

    if (result.rows.length > 0) {
      await client.query(
        `INSERT INTO subscription_audit_log (
           user_id, event_type, event_description, new_status, performed_by
         ) VALUES ($1, 'subscription_reactivated', 'Subscription reactivated', 'active', 'user')`,
        [userId]
      );
    }

    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// EXPIRY (cron-safe)
// ============================================================================

export async function expireTrials() {
  const result = await pool.query('SELECT expire_trials() AS count');
  const count = result.rows[0]?.count || 0;
  if (count > 0) console.log(`[subscription] Expired ${count} trial subscriptions`);
  return count;
}

let trialExpiryTimer = null;
let trialExpiryGeneration = 0;
const MAX_TRIAL_SWEEP_IDLE_MS = 5 * 60 * 1000;

/** Schedule the next database-timed trial expiry rather than polling on the browser clock. */
export function scheduleTrialExpirySweep() {
  const generation = ++trialExpiryGeneration;
  if (trialExpiryTimer) clearTimeout(trialExpiryTimer);
  trialExpiryTimer = setTimeout(async () => {
    if (generation !== trialExpiryGeneration) return;
    try {
      await expireTrials();
      if (generation !== trialExpiryGeneration) return;
      const nextExpiry = await pool.query(
        `SELECT GREATEST(0, EXTRACT(EPOCH FROM (MIN(trial_end_at) - clock_timestamp())) * 1000)::bigint AS delay_ms
         FROM user_subscriptions
         WHERE status = 'trial' AND trial_end_at IS NOT NULL`
      );
      if (generation !== trialExpiryGeneration) return;
      const databaseDelay = nextExpiry.rows[0]?.delay_ms;
      const delay = databaseDelay == null ? MAX_TRIAL_SWEEP_IDLE_MS : Math.max(25, Number(databaseDelay));
      trialExpiryTimer = setTimeout(() => {
        if (generation === trialExpiryGeneration) scheduleTrialExpirySweep();
      }, delay);
      trialExpiryTimer.unref?.();
      return;
    } catch (error) {
      console.error('[subscription] Trial expiry scheduler error:', error.message);
    }
    trialExpiryTimer = setTimeout(() => {
      if (generation === trialExpiryGeneration) scheduleTrialExpirySweep();
    }, 5000);
    trialExpiryTimer.unref?.();
  }, 0);
  trialExpiryTimer.unref?.();
}

export function startTrialExpiryScheduler() {
  scheduleTrialExpirySweep();
}

export async function expireSubscriptions() {
  const result = await pool.query('SELECT expire_subscriptions() AS count');
  const count = result.rows[0]?.count || 0;
  if (count > 0) console.log(`[subscription] Expired ${count} paid subscriptions`);
  return count;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export async function logSubscriptionEvent(userId, eventType, description, metadata = {}) {
  try {
    await pool.query(
      `INSERT INTO subscription_audit_log (
         user_id, event_type, event_description, performed_by, metadata
       ) VALUES ($1, $2, $3, 'system', $4)`,
      [userId, eventType, description, JSON.stringify(metadata)]
    );
  } catch (err) {
    // Non-fatal: log but don't throw
    console.error('[subscription] logSubscriptionEvent error:', err.message);
  }
}

export async function getSubscriptionAuditLog(userId, limit = 50) {
  const result = await pool.query(
    `SELECT * FROM subscription_audit_log
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// ============================================================================
// ADMIN OPERATIONS
// ============================================================================

/**
 * Admin: Get all subscriptions with user info.
 */
export async function getAllSubscriptions(filters = {}) {
  const params = [];
  let where = 'WHERE 1=1';

  if (filters.status) {
    params.push(filters.status);
    where += ` AND us.status = $${params.length}`;
  }
  if (filters.planCode) {
    params.push(filters.planCode.toUpperCase());
    where += ` AND sp.plan_code = $${params.length}`;
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    where += ` AND (u.email ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
  }

  params.push(filters.limit || 100);
  params.push(filters.offset || 0);

  const result = await pool.query(
    `SELECT
       us.*,
       u.email, u.full_name,
       sp.plan_code, sp.plan_name, sp.display_name, sp.price_inr
     FROM user_subscriptions us
     JOIN users u ON us.user_id = u.id
     JOIN subscription_plans sp ON us.plan_id = sp.id
     ${where}
     ORDER BY us.updated_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

/**
 * Admin: Update subscription status or dates.
 */
export async function adminUpdateSubscription(userId, updates, adminId = 'admin') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get old state for audit
    const oldSub = await client.query(
      `SELECT us.status, us.trial_end_at, us.is_trial_used,
              us.trial_end_at > clock_timestamp() AS trial_window_open, sp.plan_code
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = $1`,
      [userId]
    );
    const old = oldSub.rows[0] || {};
    const targetPlanCode = (updates.planCode || old.plan_code || '').toUpperCase();
    if (updates.trialEndAt !== undefined) {
      const error = new Error('The free demo duration is fixed at 24 hours and cannot be extended.');
      error.statusCode = 409;
      throw error;
    }
    if (targetPlanCode === 'TRIAL' && updates.planCode && old.plan_code !== 'TRIAL') {
      const error = new Error('Administrative plan changes cannot grant a free demo.');
      error.statusCode = 409;
      throw error;
    }
    if (targetPlanCode === 'TRIAL' && updates.status === 'trial' && !(old.plan_code === 'TRIAL' && old.status === 'trial' && old.is_trial_used && old.trial_window_open)) {
      const error = new Error('A free demo can only be started by the account holder from the activation button.');
      error.statusCode = 409;
      throw error;
    }
    if (targetPlanCode === 'TRIAL' && updates.status === 'active' && !(old.plan_code === 'TRIAL' && old.status === 'suspended')) {
      const error = new Error('The free demo cannot be changed into an unrestricted active subscription.');
      error.statusCode = 409;
      throw error;
    }

    const setClauses = ['updated_at = NOW()'];
    const params = [userId];

    if (updates.status) {
      if (updates.status === 'active' && targetPlanCode === 'TRIAL' && old.status === 'suspended') {
        setClauses.push(`status = CASE WHEN trial_end_at > clock_timestamp() AND is_trial_used THEN 'trial'::quant_subscription_status ELSE 'expired'::quant_subscription_status END`);
        setClauses.push(`trial_status = CASE WHEN trial_end_at > clock_timestamp() AND is_trial_used THEN 'ACTIVE' ELSE 'EXPIRED' END`);
      } else {
        params.push(updates.status);
        setClauses.push(`status = $${params.length}::quant_subscription_status`);
      }
    }
    if (updates.planCode) {
      const planRes = await client.query(
        'SELECT id FROM subscription_plans WHERE plan_code = $1',
        [updates.planCode.toUpperCase()]
      );
      if (planRes.rows[0]) {
        params.push(planRes.rows[0].id);
        setClauses.push(`plan_id = $${params.length}`);
        if (updates.planCode.toUpperCase() !== 'TRIAL') setClauses.push(`trial_status = CASE WHEN trial_status = 'ACTIVE' THEN 'EXPIRED' ELSE trial_status END`);
      }
    }
    if (updates.subscriptionEndAt) {
      params.push(updates.subscriptionEndAt);
      setClauses.push(`subscription_end_at = $${params.length}, current_period_end = $${params.length}`);
    }
    if (updates.suspendedReason !== undefined) {
      if (updates.suspendedReason) {
        params.push(updates.suspendedReason);
        setClauses.push(`suspended_reason = $${params.length}, suspended_at = NOW()`);
      } else {
        setClauses.push(`suspended_reason = NULL, suspended_at = NULL`);
      }
    }

    const result = await client.query(
      `UPDATE user_subscriptions
       SET ${setClauses.join(', ')}
       WHERE user_id = $1
       RETURNING *`,
      params
    );

    // Audit
    await client.query(
      `INSERT INTO subscription_audit_log (
         user_id, event_type, event_description,
         old_status, new_status, old_plan_code, new_plan_code,
         performed_by, metadata
       ) VALUES (
         $1, 'admin_update', $2,
         $3, $4, $5, $6,
         'admin',
         jsonb_build_object('adminId', $7, 'updates', $8::jsonb)
       )`,
      [
        userId,
        `Admin updated subscription: ${JSON.stringify(updates)}`,
        old.status,
        updates.status || old.status,
        old.plan_code,
        updates.planCode || old.plan_code,
        adminId,
        JSON.stringify(updates),
      ]
    );

    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin: Get all subscriptions count (for dashboard stats).
 */
export async function getSubscriptionStats() {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'trial' AND trial_end_at > NOW())::int    AS active_trials,
       COUNT(*) FILTER (WHERE status = 'trial' AND trial_end_at <= NOW())::int   AS expired_trials,
       COUNT(*) FILTER (WHERE status = 'active')::int                            AS active_paid,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int                         AS cancelled,
       COUNT(*) FILTER (WHERE status = 'expired')::int                           AS expired,
       COUNT(*) FILTER (WHERE status = 'suspended')::int                         AS suspended,
       COUNT(*)::int                                                              AS total
     FROM user_subscriptions`
  );
  return result.rows[0];
}
