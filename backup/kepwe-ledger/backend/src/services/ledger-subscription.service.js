import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { pool } from '../config/db.js';

let razorpayClient;

function razorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured.');
  if (!razorpayClient) razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return razorpayClient;
}

function safeHexEqual(expected, actual) {
  if (!/^[a-f\d]{64}$/i.test(actual || '')) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(actual, 'hex');
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function checkoutSignatureValid(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeHexEqual(expected, signature);
}

function webhookSignatureValid(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured.');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeHexEqual(expected, signature);
}

function addBillingPeriod(start, billingPeriod) {
  const end = new Date(start);
  if (billingPeriod === 'yearly') {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    const originalDay = end.getUTCDate();
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const daysInMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
    end.setUTCDate(Math.min(originalDay, daysInMonth));
  }
  return end;
}

function paymentError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function listLedgerPlans() {
  const result = await pool.query(
    `SELECT plan_code, billing_period, display_name, price_inr, features, limits
     FROM ledger_plans WHERE is_active = TRUE
     ORDER BY display_order, CASE billing_period WHEN 'monthly' THEN 0 ELSE 1 END`
  );
  return result.rows;
}

export async function getLedgerSubscription(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const freePlan = await client.query(
      `SELECT id FROM ledger_plans WHERE plan_code = 'FREE' AND billing_period = 'monthly' AND is_active = TRUE`
    );
    if (!freePlan.rows.length) throw new Error('Ledger Free plan is not configured.');

    await client.query(
      `INSERT INTO ledger_subscriptions (user_id, plan_id, billing_period)
       VALUES ($1, $2, 'monthly') ON CONFLICT (user_id) DO NOTHING`,
      [userId, freePlan.rows[0].id]
    );
    await client.query(
      `UPDATE ledger_subscriptions
       SET plan_id = $2, status = 'active', billing_period = 'monthly',
           current_period_start = NOW(), current_period_end = NULL, updated_at = NOW()
       WHERE user_id = $1 AND (status <> 'active' OR
         (current_period_end IS NOT NULL AND current_period_end <= NOW()))`,
      [userId, freePlan.rows[0].id]
    );

    const result = await client.query(
      `SELECT s.id AS subscription_id, s.status, s.billing_period,
              s.current_period_start, s.current_period_end,
              p.plan_code, p.display_name, p.price_inr, p.features, p.limits
       FROM ledger_subscriptions s JOIN ledger_plans p ON p.id = s.plan_id
       WHERE s.user_id = $1`,
      [userId]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getLedgerEntitlements(userId, executor = pool) {
  const result = await executor.query(
    `SELECT p.plan_code, p.features, p.limits
     FROM ledger_subscriptions s JOIN ledger_plans p ON p.id = s.plan_id
     WHERE s.user_id = $1 AND s.status = 'active'
       AND (s.current_period_end IS NULL OR s.current_period_end > NOW())`,
    [userId]
  );
  if (result.rows.length) return result.rows[0];
  const freePlan = await executor.query(
    `SELECT plan_code, features, limits FROM ledger_plans
     WHERE plan_code = 'FREE' AND billing_period = 'monthly' AND is_active = TRUE`
  );
  if (!freePlan.rows.length) throw new Error('Ledger Free plan is not configured.');
  return freePlan.rows[0];
}

export async function assertLedgerLimit(userId, limitKey, currentCount, executor = pool) {
  const plan = await getLedgerEntitlements(userId, executor);
  const limit = Number(plan.limits?.[limitKey]);
  if (Number.isFinite(limit) && limit !== -1 && currentCount >= limit) {
    const error = paymentError(`Your ${plan.plan_code === 'FREE' ? 'Free' : plan.plan_code} plan allows ${limit} ${limitKey.replaceAll('_', ' ')}. Upgrade to add more.`, 403);
    error.code = 'LEDGER_PLAN_LIMIT_REACHED';
    error.limitKey = limitKey;
    error.limit = limit;
    error.currentPlan = plan.plan_code;
    throw error;
  }
  return plan;
}

export async function getLedgerHistoryStart(userId, executor = pool) {
  const plan = await getLedgerEntitlements(userId, executor);
  const months = Number(plan.limits?.history_months);
  if (months === -1 || !Number.isFinite(months)) return null;

  const cutoff = new Date();
  const originalDay = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(originalDay, lastDay));
  return cutoff.toISOString().slice(0, 10);
}

export async function createLedgerPaymentOrder(userId, planCode, billingPeriod) {
  const code = String(planCode || '').toUpperCase();
  const period = String(billingPeriod || '').toLowerCase();
  if (!['PRO', 'PRO_PLUS'].includes(code) || !['monthly', 'yearly'].includes(period)) {
    throw paymentError('Choose a valid paid Ledger plan and billing period.');
  }

  const planResult = await pool.query(
    `SELECT id, plan_code, display_name, billing_period, price_inr
     FROM ledger_plans WHERE plan_code = $1 AND billing_period = $2 AND is_active = TRUE`,
    [code, period]
  );
  if (!planResult.rows.length) throw paymentError('The selected Ledger plan is unavailable.', 404);
  const plan = planResult.rows[0];
  const amount = Math.round(Number(plan.price_inr) * 100);
  const order = await razorpay().orders.create({
    amount,
    currency: 'INR',
    receipt: `ledger_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
    notes: {
      product: 'ledger',
      user_id: userId,
      plan_code: plan.plan_code,
      billing_period: plan.billing_period,
      ledger_plan_id: plan.id,
    },
  });

  try {
    const saved = await pool.query(
      `INSERT INTO ledger_subscription_payments
         (user_id, plan_id, razorpay_order_id, amount_inr, currency)
       VALUES ($1, $2, $3, $4, 'INR') RETURNING id, razorpay_order_id, amount_inr, currency`,
      [userId, plan.id, order.id, plan.price_inr]
    );
    return {
      ...saved.rows[0],
      planCode: plan.plan_code,
      planName: plan.display_name,
      billingPeriod: plan.billing_period,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  } catch (error) {
    console.error('[ledger-subscription] Order created but local persistence failed:', error.message);
    throw new Error('Unable to save the payment order. Please contact support before retrying.');
  }
}

async function activateCapturedPayment(client, paymentRow, paymentDetails, signature, webhookEventId = null) {
  const amountPaise = Math.round(Number(paymentRow.amount_inr) * 100);
  if (paymentDetails.order_id !== paymentRow.razorpay_order_id ||
      paymentDetails.currency !== paymentRow.currency ||
      Number(paymentDetails.amount) !== amountPaise ||
      paymentDetails.status !== 'captured') {
    throw paymentError('Razorpay payment does not match the pending Ledger order.');
  }

  if (paymentRow.status === 'succeeded') {
    const existing = await client.query(
      `SELECT s.current_period_end FROM ledger_subscriptions s WHERE s.user_id = $1`,
      [paymentRow.user_id]
    );
    return { alreadyProcessed: true, currentPeriodEnd: existing.rows[0]?.current_period_end || null };
  }

  const start = new Date();
  const end = addBillingPeriod(start, paymentRow.billing_period);
  const subscription = await client.query(
    `INSERT INTO ledger_subscriptions
       (user_id, plan_id, status, billing_period, current_period_start, current_period_end)
     VALUES ($1, $2, 'active', $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id, status = 'active', billing_period = EXCLUDED.billing_period,
       current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
       updated_at = NOW()
     RETURNING current_period_end`,
    [paymentRow.user_id, paymentRow.plan_id, paymentRow.billing_period, start, end]
  );
  await client.query(
    `UPDATE ledger_subscription_payments
     SET status = 'succeeded', razorpay_payment_id = $1, razorpay_signature = $2,
         paid_at = NOW(), webhook_event_id = COALESCE($3, webhook_event_id),
         subscription_id = (SELECT id FROM ledger_subscriptions WHERE user_id = $4), updated_at = NOW()
     WHERE id = $5`,
    [paymentDetails.id, signature || null, webhookEventId, paymentRow.user_id, paymentRow.id]
  );
  return { alreadyProcessed: false, currentPeriodEnd: subscription.rows[0].current_period_end };
}

export async function verifyLedgerPayment(userId, orderId, paymentId, signature) {
  if (!checkoutSignatureValid(orderId, paymentId, signature)) {
    throw paymentError('Invalid Razorpay payment signature.');
  }

  let paymentDetails;
  try {
    paymentDetails = await razorpay().payments.fetch(paymentId);
  } catch (error) {
    console.error('[ledger-subscription] Razorpay payment fetch failed:', error.message);
    throw paymentError('Razorpay could not verify this payment.', 502);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const paymentResult = await client.query(
      `SELECT lp.*, p.plan_code, p.display_name, p.billing_period
       FROM ledger_subscription_payments lp JOIN ledger_plans p ON p.id = lp.plan_id
       WHERE lp.razorpay_order_id = $1 AND lp.user_id = $2 FOR UPDATE OF lp`,
      [orderId, userId]
    );
    if (!paymentResult.rows.length) throw paymentError('Ledger payment order was not found.');

    const result = await activateCapturedPayment(client, paymentResult.rows[0], paymentDetails, signature);
    await client.query('COMMIT');
    return {
      planCode: paymentResult.rows[0].plan_code,
      planName: paymentResult.rows[0].display_name,
      billingPeriod: paymentResult.rows[0].billing_period,
      alreadyProcessed: result.alreadyProcessed,
      currentPeriodEnd: result.currentPeriodEnd,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markLedgerPaymentFailed(userId, orderId, reason) {
  const result = await pool.query(
    `UPDATE ledger_subscription_payments SET status = 'failed', failure_reason = $3, updated_at = NOW()
     WHERE user_id = $1 AND razorpay_order_id = $2 AND status = 'pending'
     RETURNING id`,
    [userId, orderId, String(reason || 'Payment failed').slice(0, 500)]
  );
  return result.rowCount > 0;
}

export async function isLedgerSubscriptionOrder(orderId) {
  const result = await pool.query(
    'SELECT 1 FROM ledger_subscription_payments WHERE razorpay_order_id = $1',
    [orderId]
  );
  return result.rows.length > 0;
}

export async function consumeLedgerAiInsight(userId) {
  const client = await pool.connect();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  try {
    await client.query('BEGIN');
    const entitlement = await getLedgerEntitlements(userId, client);
    const limit = Number(entitlement.limits.ai_insights_monthly);
    if (limit === -1) {
      await client.query('COMMIT');
      return { allowed: true, remaining: -1 };
    }

    const usage = await client.query(
      `INSERT INTO ledger_ai_usage (user_id, month_start, request_count)
       VALUES ($1, $2::date, 1)
       ON CONFLICT (user_id, month_start) DO UPDATE SET
         request_count = ledger_ai_usage.request_count + 1, updated_at = NOW()
       WHERE ledger_ai_usage.request_count < $3
       RETURNING request_count`,
      [userId, monthStart.toISOString().slice(0, 10), limit]
    );
    if (!usage.rows.length) {
      await client.query('ROLLBACK');
      return { allowed: false, remaining: 0 };
    }
    await client.query('COMMIT');
    return { allowed: true, remaining: Math.max(0, limit - Number(usage.rows[0].request_count)) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function handleLedgerRazorpayWebhook(rawBody, payload, signature, eventId) {
  if (!webhookSignatureValid(rawBody, signature)) throw paymentError('Invalid Razorpay webhook signature.', 401);
  if (!eventId) throw paymentError('Razorpay webhook event id is required.');

  const eventType = payload?.event;
  const paymentDetails = payload?.payload?.payment?.entity;
  if (!['payment.captured', 'payment.failed'].includes(eventType) || !paymentDetails?.order_id) {
    return { processed: false, ignored: true };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const event = await client.query(
      `INSERT INTO ledger_subscription_webhook_events (event_id, event_type, payload)
       VALUES ($1, $2, $3::jsonb) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
      [eventId, eventType, JSON.stringify(payload)]
    );
    if (!event.rows.length) {
      await client.query('ROLLBACK');
      return { processed: false, duplicate: true };
    }

    const paymentResult = await client.query(
      `SELECT sp.*, p.plan_code, p.display_name, p.billing_period
       FROM ledger_subscription_payments sp JOIN ledger_plans p ON p.id = sp.plan_id
       WHERE sp.razorpay_order_id = $1 FOR UPDATE OF sp`,
      [paymentDetails.order_id]
    );
    if (!paymentResult.rows.length) {
      await client.query('COMMIT');
      return { processed: false, unrelatedOrder: true };
    }

    const savedPayment = paymentResult.rows[0];
    if (eventType === 'payment.failed') {
      if (savedPayment.status === 'pending') {
        await client.query(
          `UPDATE ledger_subscription_payments SET status = 'failed', failure_reason = $1,
             updated_at = NOW() WHERE id = $2`,
          [String(paymentDetails.error_description || paymentDetails.error_reason || 'Payment failed').slice(0, 500), savedPayment.id]
        );
      }
      await client.query('COMMIT');
      return { processed: true, failed: true };
    }

    const result = await activateCapturedPayment(client, savedPayment, paymentDetails, null, eventId);
    await client.query('COMMIT');
    return { processed: true, ...result };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export const ledgerSubscriptionInternals = { addBillingPeriod, checkoutSignatureValid, safeHexEqual };