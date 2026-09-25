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
 * Activate 7-day free trial for a new user.
 * Called automatically inside registerUser() transaction.
 * Exposed here for use by registerVerifiedEmailUser as well.
 */
export async function activateFreeTrial(client, userId) {
  // Check if trial row already exists (idempotent)
  const existing = await client.query(
    'SELECT id FROM user_subscriptions WHERE user_id = $1',
    [userId]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const planResult = await client.query(
    `SELECT id, trial_days FROM subscription_plans
     WHERE plan_code = 'TRIAL' AND is_active = TRUE`,
    []
  );

  if (planResult.rows.length === 0) {
    console.warn('[subscription] TRIAL plan not found — skipping trial activation');
    return null;
  }

  const plan = planResult.rows[0];

  const result = await client.query(
    `INSERT INTO user_subscriptions (
       user_id, plan_id, status,
       trial_start_at, trial_end_at, is_trial_used
     ) VALUES (
       $1, $2, 'trial'::quant_subscription_status,
       NOW(), NOW() + ($3 * INTERVAL '1 day'), TRUE
     )
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId, plan.id, plan.trial_days]
  );

  if (result.rows.length > 0) {
    await client.query(
      `INSERT INTO subscription_audit_log (
         user_id, event_type, event_description, new_status, new_plan_code,
         performed_by, metadata
       ) VALUES (
         $1, 'trial_activated',
         '7-day free trial automatically activated on registration',
         'trial', 'TRIAL', 'system',
         jsonb_build_object('trialDays', $2::int, 'activatedAt', NOW())
       )`,
      [userId, plan.trial_days]
    );
  }

  return result.rows[0] || null;
}

// ============================================================================
// SUBSCRIPTION READ
// ============================================================================

/**
 * Get user's current subscription with full plan details.
 * Returns null if no record exists.
 */
export async function getUserSubscription(userId) {
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
       sp.trial_days
     FROM user_subscriptions us
     JOIN subscription_plans sp ON us.plan_id = sp.id
     WHERE us.user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const sub = result.rows[0];

  // ── Calculate time remaining ─────────────────────────────────────────────
  const now = new Date();
  let timeRemaining = null;
  let daysRemaining = null;
  let hoursRemaining = null;

  const endDate =
    sub.status === 'trial'
      ? sub.trial_end_at
      : sub.subscription_end_at;

  if (endDate) {
    const ms = Math.max(0, new Date(endDate).getTime() - now.getTime());
    timeRemaining = ms;
    daysRemaining = Math.floor(ms / (24 * 60 * 60 * 1000));
    hoursRemaining = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  }

  return {
    ...sub,
    timeRemaining,
    daysRemaining,
    hoursRemaining,
    isActive: _isSubscriptionActive(sub),
  };
}

/**
 * Internal: determine if a subscription record is currently active.
 */
function _isSubscriptionActive(sub) {
  const now = new Date();

  if (sub.status === 'suspended' || sub.status === 'expired') {
    return false;
  }

  if (sub.status === 'trial') {
    return sub.trial_end_at != null && new Date(sub.trial_end_at) > now;
  }

  if (sub.status === 'active') {
    // Subscription with no end date = indefinite (admin-granted)
    if (!sub.subscription_end_at) return true;
    return new Date(sub.subscription_end_at) > now;
  }

  if (sub.status === 'cancelled') {
    // Access through end of paid period
    if (!sub.subscription_end_at) return false;
    return new Date(sub.subscription_end_at) > now;
  }

  return false;
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
         is_trial_used, auto_renew,
         cancelled_at, cancellation_reason, suspended_at
       ) VALUES (
         $1, $2, 'active'::quant_subscription_status,
         NOW(), $3, NOW(), $3,
         TRUE, TRUE,
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
      `SELECT us.status, sp.plan_code
       FROM user_subscriptions us
       JOIN subscription_plans sp ON sp.id = us.plan_id
       WHERE us.user_id = $1`,
      [userId]
    );
    const old = oldSub.rows[0] || {};

    const setClauses = ['updated_at = NOW()'];
    const params = [userId];

    if (updates.status) {
      params.push(updates.status);
      setClauses.push(`status = $${params.length}::quant_subscription_status`);
    }
    if (updates.planCode) {
      const planRes = await client.query(
        'SELECT id FROM subscription_plans WHERE plan_code = $1',
        [updates.planCode.toUpperCase()]
      );
      if (planRes.rows[0]) {
        params.push(planRes.rows[0].id);
        setClauses.push(`plan_id = $${params.length}`);
      }
    }
    if (updates.trialEndAt) {
      params.push(updates.trialEndAt);
      setClauses.push(`trial_end_at = $${params.length}`);
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
 * Admin: Extend trial by N days.
 */
export async function adminExtendTrial(userId, extraDays, adminId = 'admin') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE user_subscriptions
       SET trial_end_at = GREATEST(trial_end_at, NOW()) + ($2 * INTERVAL '1 day'),
           status = 'trial'::quant_subscription_status,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [userId, extraDays]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Subscription not found for user');
    }

    await client.query(
      `INSERT INTO subscription_audit_log (
         user_id, event_type, event_description,
         new_status, performed_by, metadata
       ) VALUES (
         $1, 'trial_extended', $2, 'trial', 'admin',
         jsonb_build_object('extraDays', $3, 'adminId', $4, 'newTrialEnd', $5)
       )`,
      [
        userId,
        `Trial extended by ${extraDays} days by admin`,
        extraDays,
        adminId,
        result.rows[0].trial_end_at,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
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
