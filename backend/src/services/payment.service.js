/**
 * KEPWE Quant Payment Service
 * Handles Razorpay payment creation, verification, and webhook processing.
 *
 * Security guarantees:
 * - Webhook signature is verified against the raw request body buffer (not
 *   re-serialised JSON) to prevent normalisation attacks.
 * - Every payment record carries an idempotency_key so duplicate webhook
 *   deliveries of the same event are silently skipped.
 * - Subscription activation happens ONLY after HMAC verification succeeds —
 *   never based on frontend-supplied data alone.
 * - Duplicate-order detection: if a payment order already has status
 *   'succeeded' we return the cached result without re-activating.
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { upgradeToPaidPlan, logSubscriptionEvent } from './subscription.service.js';

// ── Razorpay SDK instance ──────────────────────────────────────────────────
// key_id / key_secret are read lazily (at call time) to survive the dotenv
// load-order in test environments.
function getRazorpay() {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID     || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });
}

// ============================================================================
// CREATE ORDER
// ============================================================================

/**
 * Create a Razorpay order for a subscription plan upgrade.
 * Returns the saved subscription_payments row (contains razorpay_order_id).
 */
export async function createPaymentOrder(userId, planId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Fetch plan
    const planResult = await client.query(
      'SELECT * FROM subscription_plans WHERE id = $1 AND is_active = TRUE',
      [planId]
    );
    if (planResult.rows.length === 0) throw new Error('Plan not found');
    const plan = planResult.rows[0];

    const amount = Math.round(parseFloat(plan.price_inr) * 100); // paise

    // Fetch subscription id for notes
    const subResult = await client.query(
      'SELECT id FROM user_subscriptions WHERE user_id = $1',
      [userId]
    );
    const subscriptionId = subResult.rows[0]?.id || null;

    // Create Razorpay order
    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `sub_${userId.slice(0, 8)}_${Date.now()}`,
      notes: {
        user_id:         userId,
        plan_id:         planId,
        plan_code:       plan.plan_code,
        subscription_id: subscriptionId,
      },
    });

    // Persist payment record
    const paymentResult = await client.query(
      `INSERT INTO subscription_payments (
         user_id, subscription_id, plan_id, payment_gateway,
         order_id, razorpay_order_id, amount_inr, currency, status
       ) VALUES ($1, $2, $3, 'razorpay', $4, $5, $6, 'INR', 'pending')
       RETURNING *`,
      [userId, subscriptionId, planId, rzpOrder.id, rzpOrder.id, plan.price_inr]
    );

    await client.query('COMMIT');

    await logSubscriptionEvent(
      userId,
      'payment_order_created',
      `Payment order created for ${plan.plan_name}`,
      { orderId: rzpOrder.id, amount: plan.price_inr, planCode: plan.plan_code }
    );

    return paymentResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[payment] createPaymentOrder error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// VERIFY & ACTIVATE (client-side callback)
// ============================================================================

/**
 * Verify Razorpay HMAC signature from the checkout callback and activate the
 * subscription. This is the primary activation path for non-webhook flows.
 *
 * Idempotent: if the payment was already succeeded (e.g. webhook beat the
 * callback) we return the existing state without re-processing.
 */
export async function verifyPaymentAndActivate(userId, razorpayOrderId, razorpayPaymentId, razorpaySignature) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Signature verification
    const isValid = _verifyCheckoutSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) throw new Error('Invalid payment signature');

    // Fetch our payment record
    const paymentResult = await client.query(
      `SELECT sp.*, spl.plan_code, spl.plan_name
       FROM subscription_payments sp
       JOIN subscription_plans spl ON sp.plan_id = spl.id
       WHERE sp.razorpay_order_id = $1 AND sp.user_id = $2`,
      [razorpayOrderId, userId]
    );
    if (paymentResult.rows.length === 0) throw new Error('Payment record not found');

    const payment = paymentResult.rows[0];

    // Idempotency: already processed?
    if (payment.status === 'succeeded') {
      console.log('[payment] Payment already processed (callback):', razorpayPaymentId);
      await client.query('ROLLBACK');
      return {
        planCode:         payment.plan_code,
        planName:         payment.plan_name,
        status:           'active',
        alreadyProcessed: true,
      };
    }

    // Fetch payment details from Razorpay to confirm capture
    const razorpay = getRazorpay();
    let rzpPayment = null;
    try {
      rzpPayment = await razorpay.payments.fetch(razorpayPaymentId);
    } catch (fetchErr) {
      console.error('[payment] Could not verify payment with Razorpay:', fetchErr.message);
      throw new Error('Payment could not be verified with the payment gateway');
    }

    if (rzpPayment.order_id !== razorpayOrderId || rzpPayment.status !== 'captured') {
      throw new Error('Payment is not captured for this order');
    }

    // Mark payment succeeded
    await client.query(
      `UPDATE subscription_payments
       SET status              = 'succeeded',
           razorpay_payment_id = $1,
           razorpay_signature  = $2,
           payment_method      = $3,
           payment_email       = $4,
           payment_contact     = $5,
           paid_at             = NOW(),
           webhook_verified    = TRUE,
           webhook_verified_at = NOW(),
           updated_at          = NOW()
       WHERE id = $6`,
      [
        razorpayPaymentId,
        razorpaySignature,
        rzpPayment?.method   || null,
        rzpPayment?.email    || null,
        rzpPayment?.contact  || null,
        payment.id,
      ]
    );

    // Activate subscription
    const subscription = await upgradeToPaidPlan(userId, payment.plan_code);

    await client.query('COMMIT');

    await logSubscriptionEvent(
      userId,
      'payment_succeeded',
      `Payment verified and subscription upgraded to ${payment.plan_name}`,
      { paymentId: razorpayPaymentId, orderId: razorpayOrderId, amount: payment.amount_inr, planCode: payment.plan_code }
    );

    return {
      planCode:           payment.plan_code,
      planName:           payment.plan_name,
      status:             subscription.status,
      subscriptionEndAt:  subscription.subscription_end_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[payment] verifyPaymentAndActivate error:', err.message);

    // Log failure (non-fatal)
    try {
      await logSubscriptionEvent(
        userId,
        'payment_verification_failed',
        `Payment verification failed: ${err.message}`,
        { orderId: razorpayOrderId, paymentId: razorpayPaymentId }
      );
    } catch (_) {}

    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

/**
 * Process a Razorpay webhook event.
 *
 * @param {Buffer} rawBody   - Exact bytes received from Razorpay (for signature)
 * @param {object} parsedBody - Already-parsed JSON body (from express middleware)
 * @param {string} signature  - x-razorpay-signature header value
 */
export async function handleRazorpayWebhook(rawBody, parsedBody, signature) {
  // ── 1. Verify webhook signature against raw bytes ──────────────────────
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
    throw new Error('Webhook secret not configured');
  }

  const bodyToVerify = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(bodyToVerify)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(signature, 'hex'))) {
    throw new Error('Invalid webhook signature');
  }

  const event   = parsedBody?.event;
  const payment = parsedBody?.payload?.payment?.entity;

  console.log('[webhook] Received event:', event, payment?.id || '(no payment)');

  // ── 2. Route to event handler ──────────────────────────────────────────
  switch (event) {
    case 'payment.captured':
      await _handlePaymentCaptured(payment);
      break;
    case 'payment.failed':
      await _handlePaymentFailed(payment);
      break;
    case 'payment.authorized':
      // Intentionally no-op; we activate on captured/verified only
      console.log('[webhook] payment.authorized — awaiting capture:', payment?.id);
      break;
    case 'refund.created':
      await _handleRefundCreated(parsedBody?.payload?.refund?.entity);
      break;
    default:
      console.log('[webhook] Unhandled event type:', event);
  }
}

// ============================================================================
// PRIVATE WEBHOOK EVENT HANDLERS
// ============================================================================

/**
 * payment.captured — verify idempotency, mark succeeded, activate subscription.
 */
async function _handlePaymentCaptured(payment) {
  if (!payment?.order_id) {
    console.warn('[webhook] payment.captured missing order_id');
    return;
  }

  const idempotencyKey = `captured:${payment.order_id}:${payment.id}`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Idempotency check: skip if already processed ──────────────────────
    const existing = await client.query(
      `SELECT id, status, webhook_verified FROM subscription_payments
       WHERE razorpay_order_id = $1`,
      [payment.order_id]
    );

    if (existing.rows.length === 0) {
      console.warn('[webhook] No payment record for order:', payment.order_id);
      await client.query('ROLLBACK');
      return;
    }

    const record = existing.rows[0];

    if (record.status === 'succeeded' && record.webhook_verified) {
      console.log('[webhook] Duplicate delivery — already processed:', idempotencyKey);
      await client.query('ROLLBACK');
      return;
    }

    // ── Mark payment succeeded ────────────────────────────────────────────
    await client.query(
      `UPDATE subscription_payments
       SET status              = 'succeeded',
           razorpay_payment_id = $1,
           payment_method      = $2,
           payment_email       = $3,
           payment_contact     = $4,
           paid_at             = $5,
           webhook_verified    = TRUE,
           webhook_verified_at = NOW(),
           idempotency_key     = $6,
           updated_at          = NOW()
       WHERE id = $7`,
      [
        payment.id,
        payment.method  || null,
        payment.email   || null,
        payment.contact || null,
        payment.created_at ? new Date(payment.created_at * 1000) : new Date(),
        idempotencyKey,
        record.id,
      ]
    );

    // ── Fetch plan code for this payment record ───────────────────────────
    const planRes = await client.query(
      `SELECT sp.user_id, spl.plan_code
       FROM subscription_payments sp
       JOIN subscription_plans spl ON spl.id = sp.plan_id
       WHERE sp.id = $1`,
      [record.id]
    );
    if (planRes.rows.length === 0) {
      console.warn('[webhook] Could not resolve plan for payment:', record.id);
      await client.query('ROLLBACK');
      return;
    }

    const { user_id: userId, plan_code: planCode } = planRes.rows[0];

    // ── Activate subscription (only if not already active on this plan) ───
    const subCheck = await client.query(
      `SELECT status FROM user_subscriptions WHERE user_id = $1`,
      [userId]
    );
    if (!subCheck.rows[0] || subCheck.rows[0].status !== 'active') {
      await upgradeToPaidPlan(userId, planCode);
    }

    await client.query('COMMIT');
    console.log('[webhook] Payment captured + subscription activated:', payment.id);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[webhook] _handlePaymentCaptured error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * payment.failed — record failure, log for support.
 */
async function _handlePaymentFailed(payment) {
  if (!payment?.order_id) return;

  const idempotencyKey = `failed:${payment.order_id}:${payment.id}`;

  try {
    const result = await pool.query(
      `UPDATE subscription_payments
       SET status          = 'failed',
           razorpay_payment_id = $1,
           failure_reason  = $2,
           idempotency_key = $3,
           updated_at      = NOW()
       WHERE razorpay_order_id = $4
         AND status = 'pending'
       RETURNING user_id`,
      [
        payment.id,
        payment.error_description || payment.error_reason || 'Payment failed',
        idempotencyKey,
        payment.order_id,
      ]
    );

    if (result.rows.length > 0) {
      await logSubscriptionEvent(
        result.rows[0].user_id,
        'payment_failed',
        `Payment failed: ${payment.error_description || 'Unknown error'}`,
        { paymentId: payment.id, orderId: payment.order_id, errorCode: payment.error_code }
      );
    }

    console.log('[webhook] Payment failed recorded:', payment.id);
  } catch (err) {
    console.error('[webhook] _handlePaymentFailed error:', err.message);
    throw err;
  }
}

/**
 * refund.created — mark payment as refunded.
 */
async function _handleRefundCreated(refund) {
  if (!refund?.payment_id) return;

  try {
    const result = await pool.query(
      `UPDATE subscription_payments
       SET status     = 'refunded',
           updated_at = NOW()
       WHERE razorpay_payment_id = $1
       RETURNING user_id`,
      [refund.payment_id]
    );

    if (result.rows.length > 0) {
      await logSubscriptionEvent(
        result.rows[0].user_id,
        'payment_refunded',
        `Refund created: ${refund.id}`,
        { refundId: refund.id, paymentId: refund.payment_id, amount: refund.amount / 100 }
      );
    }

    console.log('[webhook] Refund recorded:', refund.id);
  } catch (err) {
    console.error('[webhook] _handleRefundCreated error:', err.message);
    throw err;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Verify the HMAC-SHA256 signature from the Razorpay checkout callback.
 * format: orderId + '|' + paymentId
 */
function _verifyCheckoutSignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const body   = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get payment history for a user.
 */
export async function getPaymentHistory(userId, limit = 20) {
  const result = await pool.query(
    `SELECT * FROM subscription_payments
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * Admin: Get all payments with filters.
 */
export async function getAllPayments(filters = {}) {
  const params  = [];
  let   query   = `
    SELECT
      sp.*,
      u.email, u.full_name,
      spl.plan_code, spl.plan_name
    FROM subscription_payments sp
    JOIN users u   ON sp.user_id  = u.id
    JOIN subscription_plans spl ON sp.plan_id = spl.id
    WHERE 1=1
  `;

  if (filters.status) {
    params.push(filters.status);
    query += ` AND sp.status = $${params.length}`;
  }
  if (filters.userId) {
    params.push(filters.userId);
    query += ` AND sp.user_id = $${params.length}`;
  }

  params.push(filters.limit || 100);
  query += ` ORDER BY sp.created_at DESC LIMIT $${params.length}`;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Admin: Issue a Razorpay refund for a succeeded payment.
 */
export async function refundPayment(paymentId, amount = null, reason = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT * FROM subscription_payments WHERE id = $1',
      [paymentId]
    );
    if (result.rows.length === 0) throw new Error('Payment not found');

    const payment = result.rows[0];
    if (payment.status !== 'succeeded') throw new Error('Can only refund succeeded payments');

    const razorpay    = getRazorpay();
    const refundAmount = amount ? Math.round(parseFloat(amount) * 100) : undefined;

    const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
      ...(refundAmount && { amount: refundAmount }),
      notes: { reason: reason || 'Subscription refund' },
    });

    await client.query(
      `UPDATE subscription_payments
       SET status = 'refunded', updated_at = NOW()
       WHERE id = $1`,
      [paymentId]
    );

    await client.query('COMMIT');

    await logSubscriptionEvent(
      payment.user_id,
      'payment_refunded',
      `Payment refunded: ${reason || 'No reason provided'}`,
      { paymentId: payment.razorpay_payment_id, refundId: refund.id, amount: (refundAmount || payment.amount_inr * 100) / 100 }
    );

    return refund;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[payment] refundPayment error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
