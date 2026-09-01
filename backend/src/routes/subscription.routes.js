// ============================================================================
// Subscription & Razorpay Payment Routes
// ============================================================================
//
// Payment flow (end-to-end):
//   1. POST /api/subscription/create-order
//      - Frontend calls this when the user clicks Buy.
//      - Looks up plan price from the DB (never trusts the client price).
//      - Creates a Razorpay order via the Razorpay Orders API.
//      - Stores a `payments` row with status='pending'.
//      - Returns { orderId, amount, currency, keyId } — NO secret.
//
//   2. (Browser) Razorpay Checkout opens with orderId from step 1.
//      - User completes/cancels/fails payment on the Razorpay-hosted page.
//      - On success, Razorpay calls the frontend handler with
//        { razorpay_order_id, razorpay_payment_id, razorpay_signature }.
//
//   3. POST /api/subscription/verify-payment
//      - Frontend calls this with the three fields from Razorpay.
//      - Server verifies the HMAC-SHA256 signature using KEY_SECRET.
//      - On valid signature: activates the subscription, writes billing_history,
//        marks the payment row as 'paid'.
//      - On invalid signature: marks payment row as 'failed', returns 400.
//      - Idempotent: if the payment is already 'paid', returns 200 immediately.
//
//   4. POST /api/subscription/cancel-payment   (optional — frontend calls on dismiss)
//      - Marks the `payments` row as 'cancelled'.
//
// Security:
//   - RAZORPAY_KEY_SECRET is read from process.env; NEVER returned to clients.
//   - Subscription is ONLY activated after server-side signature verification.
//   - Direct plan activation via PATCH /subscription requires verified payment;
//     the insecure "free upgrade" path has been removed.
// ============================================================================

import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requireAuth, validateBody } from '../middleware/auth.js';

const router = Router();

// ── Razorpay client (lazy singleton) ────────────────────────────────────────
// Lazily initialised so the module doesn't crash at import time if the env
// vars are not yet set (e.g. during test runs or a cold start before dotenv).
let _razorpay = null;

async function razorpay() {
  const keyId     = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing).');
  }

  if (_razorpay) return _razorpay;
  const { default: Razorpay } = await import('razorpay');
  _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return _razorpay;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(date) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function serializeBillingEntry(row) {
  return {
    id:     row.id,
    date:   formatDate(row.billing_date),
    amount: Number(row.amount),
    status: row.status,
    plan:   row.plan_name,
    invoiceNumber: row.invoice_number,
  };
}

async function getBillingHistory(userId) {
  const result = await pool.query(
    `SELECT * FROM billing_history WHERE user_id = $1 ORDER BY billing_date DESC`,
    [userId]
  );
  return result.rows.map(serializeBillingEntry);
}

/** Returns the plan duration in months so renews_on can be computed. */
function planDurationMonths(planName) {
  switch ((planName || '').toUpperCase()) {
    case '1 MONTH':  return 1;
    case '3 MONTHS': return 3;
    case '6 MONTHS': return 6;
    case '1 YEAR':   return 12;
    default:         return 1;
  }
}

// ── Input schemas ─────────────────────────────────────────────────────────────
const createOrderSchema = z.object({
  plan: z.string().trim().min(1).max(100),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id:   z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature:  z.string().trim().min(1),
  plan:                z.string().trim().min(1).max(100),
});

const cancelPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  reason:            z.string().trim().max(500).optional(),
});

// ── GET /api/subscription ─────────────────────────────────────────────────────
router.get('/subscription', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT s.*, p.name AS plan_name, p.display_name AS plan_display_name, p.price_inr,
              COALESCE(p.ui_name, p.name::text) AS plan_ui_name
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        plan: null,
        displayName: null,
        price: 0,
        renewsOn: null,
        paymentMethod: null,
        billingHistory: [],
      });
    }

    const row = result.rows[0];
    const billingHistory = await getBillingHistory(req.userId);

    return res.json({
      plan:          row.plan_ui_name,
      displayName:   row.plan_display_name,
      price:         Number(row.price_inr),
      renewsOn:      row.renews_on,
      paymentMethod: row.payment_method,
      billingHistory,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/subscription/create-order ──────────────────────────────────────
/**
 * Step 1 of the payment flow.
 * Creates a Razorpay order and a pending payments row.
 * Returns only the data required by the frontend checkout: orderId, amount,
 * currency, and the public keyId.  NEVER returns KEY_SECRET.
 */
router.post(
  '/subscription/create-order',
  requireAuth,
  validateBody(createOrderSchema),
  async (req, res, next) => {
    try {
      const { plan } = req.validatedBody;

      // Always look up price server-side — never trust client-supplied price.
      // Plans are looked up by ui_name (e.g. '3 MONTHS', 'Launch', 'Growth')
      // which works for both IndexPilot and Business plans.
      const planResult = await pool.query(
        `SELECT id, name, display_name, price_inr, ui_name, is_indexpilot FROM plans
         WHERE ui_name = $1 AND is_active = TRUE`,
        [plan]
      );
      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: `Plan "${plan}" not found.` });
      }
      const planRow = planResult.rows[0];
      const amountPaise = Math.round(Number(planRow.price_inr) * 100); // ₹ → paise

      const rzp = await razorpay();

      // Create the Razorpay order.
      const order = await rzp.orders.create({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  `kepwe_${req.userId.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id:   req.userId,
          plan_name: planRow.name,
        },
      });

      // Persist a pending payment record for audit + idempotency.
      await pool.query(
        `INSERT INTO payments
           (user_id, plan_name, amount_paise, currency, razorpay_order_id, status)
         VALUES ($1, $2, $3, 'INR', $4, 'pending')
         ON CONFLICT (razorpay_order_id) DO NOTHING`,
        [req.userId, planRow.name, amountPaise, order.id]
      );

      // Return only safe data. KEY_SECRET is NEVER included.
      return res.status(201).json({
        orderId:  order.id,
        amount:   amountPaise,
        currency: 'INR',
        keyId:    process.env.RAZORPAY_KEY_ID?.trim(),
        planName: planRow.name,
        planDisplayName: planRow.display_name,
      });
    } catch (err) {
      // Surface a clean error if Razorpay credentials are missing.
      if (err.message?.includes('credentials are not configured')) {
        return res.status(503).json({ error: 'Payment gateway is not configured. Please try again later.' });
      }
      next(err);
    }
  }
);

// ── POST /api/subscription/verify-payment ────────────────────────────────────
/**
 * Step 3 of the payment flow.
 * Verifies the Razorpay signature using HMAC-SHA256 and KEY_SECRET (server-side only).
 * On valid signature: activates the subscription + writes billing_history.
 * On invalid signature: marks payment failed, returns 400.
 * Idempotent: repeated calls for an already-paid order return 200.
 */
router.post(
  '/subscription/verify-payment',
  requireAuth,
  validateBody(verifyPaymentSchema),
  async (req, res, next) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.validatedBody;

    try {
      // ── 1. Load the pending payment row ──────────────────────────────────
      const paymentResult = await pool.query(
        `SELECT * FROM payments
         WHERE razorpay_order_id = $1 AND user_id = $2`,
        [razorpay_order_id, req.userId]
      );

      if (paymentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payment order not found.' });
      }

      const payment = paymentResult.rows[0];

      // ── 2. Idempotency guard: already verified ────────────────────────────
      if (payment.status === 'paid') {
        const sub = await pool.query(
          `SELECT s.*, p.name AS plan_name, p.display_name AS plan_display_name, p.price_inr,
                  COALESCE(p.ui_name, p.name::text) AS plan_ui_name
           FROM subscriptions s JOIN plans p ON p.id = s.plan_id
           WHERE s.user_id = $1`,
          [req.userId]
        );
        if (sub.rows.length > 0) {
          const row = sub.rows[0];
          return res.json({
            success: true,
            alreadyVerified: true,
            subscription: {
              plan:          row.plan_ui_name,
              displayName:   row.plan_display_name,
              price:         Number(row.price_inr),
              renewsOn:      row.renews_on,
              paymentMethod: row.payment_method,
              billingHistory: await getBillingHistory(req.userId),
            },
          });
        }
      }

      // ── 3. Verify Razorpay signature ──────────────────────────────────────
      // Signature = HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
      const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
      if (!keySecret) {
        return res.status(503).json({ error: 'Payment gateway is not configured.' });
      }

      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      const receivedSignature = Buffer.from(razorpay_signature, 'hex');
      const signaturesMatch = receivedSignature.length === 32 && crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        receivedSignature
      );

      if (!signaturesMatch) {
        // Mark payment as failed — do NOT activate the subscription.
        await pool.query(
          `UPDATE payments
           SET status = 'failed',
               razorpay_payment_id = $1,
               razorpay_signature  = $2,
               failure_reason      = 'Signature verification failed'
           WHERE razorpay_order_id = $3 AND user_id = $4`,
          [razorpay_payment_id, razorpay_signature, razorpay_order_id, req.userId]
        );
        return res.status(400).json({ error: 'Payment verification failed. Please contact support.' });
      }

      // ── 4. Signature valid — activate subscription in a transaction ───────
      const planResult = await pool.query(
        `SELECT * FROM plans WHERE ui_name = $1 AND is_active = TRUE`,
        [plan]
      );
      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: `Plan "${plan}" not found.` });
      }
      const planRow = planResult.rows[0];
      if (payment.plan_name !== planRow.name) {
        return res.status(400).json({ error: 'Payment plan does not match the order.' });
      }
      const durationMonths = planDurationMonths(planRow.name);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 4a. Upsert subscription (activated only after verified payment).
        await client.query(
          `INSERT INTO subscriptions
             (user_id, plan_id, price_at_signup, renews_on, status, payment_method)
           VALUES ($1, $2, $3,
                   CURRENT_DATE + ($4 * INTERVAL '1 month'),
                   'active', 'UPI')
           ON CONFLICT (user_id) DO UPDATE SET
             plan_id         = $2,
             price_at_signup = $3,
             renews_on       = CURRENT_DATE + ($4 * INTERVAL '1 month'),
             status          = 'active',
             payment_method  = 'UPI',
             updated_at      = NOW()`,
          [req.userId, planRow.id, planRow.price_inr, durationMonths]
        );

        // 4b. Fetch subscription id for billing_history FK.
        const subRow = await client.query(
          `SELECT id FROM subscriptions WHERE user_id = $1`,
          [req.userId]
        );

        // 4c. Insert billing_history (only on successful payment).
        await client.query(
          `INSERT INTO billing_history
             (subscription_id, user_id, amount, status, plan_name, invoice_number, billing_date)
           VALUES ($1, $2, $3, 'Paid', $4,
                   UPPER('INV-' || substr(gen_random_uuid()::text, 1, 8)),
                   CURRENT_DATE)`,
          [subRow.rows[0].id, req.userId, planRow.price_inr, planRow.display_name]
        );

        // 4d. Mark the payment row as paid with all IDs stored.
        await client.query(
          `UPDATE payments SET
             status              = 'paid',
             razorpay_payment_id = $1,
             razorpay_signature  = $2,
             verified_at         = NOW()
           WHERE razorpay_order_id = $3 AND user_id = $4`,
          [razorpay_payment_id, razorpay_signature, razorpay_order_id, req.userId]
        );

        // 4e. Admin notification.
        await client.query(
          `INSERT INTO admin_notifications (type, title, message, entity_type, entity_id)
           VALUES ('payment', 'Payment verified', $1, 'subscription', $2)`,
          [`${planRow.display_name} payment verified via Razorpay`, subRow.rows[0].id]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // ── 5. Return the updated subscription ───────────────────────────────
      const updated = await pool.query(
        `SELECT s.*, p.name AS plan_name, p.display_name AS plan_display_name, p.price_inr,
                COALESCE(p.ui_name, p.name::text) AS plan_ui_name
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
         WHERE s.user_id = $1`,
        [req.userId]
      );
      const row = updated.rows[0];
      const billingHistory = await getBillingHistory(req.userId);

      return res.json({
        success: true,
        subscription: {
          plan:          row.plan_ui_name,
          displayName:   row.plan_display_name,
          price:         Number(row.price_inr),
          renewsOn:      row.renews_on,
          paymentMethod: row.payment_method,
          billingHistory,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/subscription/cancel-payment ─────────────────────────────────────
/**
 * Called by the frontend when the user dismisses the Razorpay checkout modal
 * without completing payment.  Marks the pending payment row as 'cancelled'.
 */
router.post(
  '/subscription/cancel-payment',
  requireAuth,
  validateBody(cancelPaymentSchema),
  async (req, res, next) => {
    try {
      const { razorpay_order_id, reason } = req.validatedBody;

      await pool.query(
        `UPDATE payments SET
           status         = 'cancelled',
           failure_reason = $1
         WHERE razorpay_order_id = $2
           AND user_id           = $3
           AND status            = 'pending'`,
        [reason || 'User dismissed checkout', razorpay_order_id, req.userId]
      );

      return res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/subscription/delete-request ─────────────────────────────────────
router.post('/subscription/delete-request', requireAuth, async (req, res, next) => {
  try {
    const existing = await pool.query(
      `SELECT id, status, requested_at FROM data_deletion_requests
       WHERE user_id = $1 AND status IN ('Requested', 'Processing')
       ORDER BY requested_at DESC LIMIT 1`,
      [req.userId]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return res.json({ id: row.id, status: row.status, requestedAt: row.requested_at });
    }

    const result = await pool.query(
      `INSERT INTO data_deletion_requests (user_id, status)
       VALUES ($1, 'Requested')
       RETURNING id, status, requested_at`,
      [req.userId]
    );

    const row = result.rows[0];
    return res.status(201).json({ id: row.id, status: row.status, requestedAt: row.requested_at });
  } catch (err) {
    next(err);
  }
});

export default router;
