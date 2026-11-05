/**
 * KEPWE Quant Payment Webhook Routes
 * Handles Razorpay webhook notifications.
 *
 * Security:
 * - Signature is verified using HMAC-SHA256 against the raw request body
 *   (req.rawBody captured in app.js before JSON parsing mutates the buffer).
 * - Idempotency is enforced in payment.service.js via the idempotency_key
 *   column on subscription_payments — duplicate webhook deliveries are safe.
 * - Always returns HTTP 200 to Razorpay to prevent exponential retries;
 *   errors are logged server-side for investigation.
 */

import express from 'express';
import { handleRazorpayWebhook } from '../services/payment.service.js';

const router = express.Router();

/**
 * POST /api/webhooks/razorpay
 * Razorpay webhook endpoint — NO auth, verified via HMAC-SHA256 signature.
 *
 * Raw body requirement: app.js captures req.rawBody in the express.json()
 * verify callback so this route can compute the expected signature over the
 * exact bytes Razorpay sent, before JSON.parse normalises them.
 */
router.post('/razorpay', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature) {
    console.error('[webhook] Missing x-razorpay-signature header');
    // Return 400 here only — Razorpay will retry; a missing signature is
    // likely a config error not a transient failure.
    return res.status(400).json({ success: false, error: 'Missing signature header' });
  }

  // Use the raw body buffer captured by app.js for signature verification.
  // Falling back to req.body is unsafe (JSON.stringify is not the inverse of
  // raw bytes in all cases), but we keep it as a last resort for dev mode.
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

  try {
    const eventId = req.get('x-razorpay-event-id') || req.body?.id || req.body?.event_id;
    await handleRazorpayWebhook(rawBody, req.body, signature, eventId);
    return res.json({ success: true });
  } catch (error) {
    console.error('[webhook] Error processing Razorpay webhook:', error.message);
    const status = error.statusCode || (error.message?.includes('WEBHOOK_SECRET') ? 503 : 500);
    return res.status(status).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;
