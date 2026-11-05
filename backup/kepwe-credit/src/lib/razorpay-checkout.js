/**
 * razorpay-checkout.js
 * ---------------------
 * Shared helper that drives the complete Razorpay payment flow from any
 * page in the app.  All API calls go through the KEPWE backend — the
 * Razorpay KEY_SECRET never touches the browser.
 *
 * Usage:
 *   import { startRazorpayCheckout } from '../lib/razorpay-checkout';
 *   const result = await startRazorpayCheckout({ planName, user, apiFetch });
 *   if (result.success)  … subscription activated
 *   if (result.cancelled) … user closed modal, no charge
 *   if (!result.success)  … result.error has a message
 */

/** Idempotently injects the Razorpay checkout.js script into the page. */
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload  = resolve;
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout. Check your internet connection.'));
    document.body.appendChild(script);
  });
}

/**
 * @param {object}   opts
 * @param {string}   opts.planName   - UI plan name, e.g. 'Launch', '3 MONTHS'
 * @param {object}   [opts.user]     - { name, email } for prefill (optional)
 * @param {Function} opts.apiFetch   - the apiFetch helper from client.js
 * @returns {Promise<{ success, cancelled, error, subscription }>}
 */
export async function startRazorpayCheckout({ planName, user, apiFetch }) {
  // ── Step 1: Create Razorpay order on the backend ────────────────────────
  let orderData;
  try {
    const res = await apiFetch('/subscription/create-order', {
      method: 'POST',
      body: { plan: planName },
    });
    if (!res.ok) {
      return { success: false, error: res.data?.error || 'Could not create payment order. Please try again.' };
    }
    orderData = res.data;
  } catch {
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }

  // ── Step 2: Load Razorpay checkout script ───────────────────────────────
  try {
    await loadRazorpayScript();
  } catch (err) {
    return { success: false, error: err.message };
  }

  // ── Step 3: Open Razorpay checkout → verify on success ──────────────────
  return new Promise((resolve) => {
    const rzp = new window.Razorpay({
      key:         orderData.keyId,
      amount:      orderData.amount,
      currency:    orderData.currency,
      name:        'KEPWE',
      description: orderData.planDisplayName || planName,
      order_id:    orderData.orderId,
      prefill: {
        name:  user?.name  || '',
        email: user?.email || '',
      },
      theme: { color: '#214ECF' },

      // Payment success — verify signature server-side
      handler: async (response) => {
        try {
          const verifyRes = await apiFetch('/subscription/verify-payment', {
            method: 'POST',
            body: {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              plan:                planName,
            },
          });
          if (verifyRes.ok && verifyRes.data?.subscription) {
            resolve({ success: true, subscription: verifyRes.data.subscription });
          } else {
            resolve({ success: false, error: verifyRes.data?.error || 'Payment verification failed. Contact support.' });
          }
        } catch {
          resolve({ success: false, error: 'Network error during payment verification.' });
        }
      },

      modal: {
        ondismiss: async () => {
          // Best-effort cancel record on backend
          try {
            await apiFetch('/subscription/cancel-payment', {
              method: 'POST',
              body: { razorpay_order_id: orderData.orderId, reason: 'User dismissed checkout' },
            });
          } catch { /* ignore */ }
          resolve({ success: false, cancelled: true, error: 'Payment cancelled.' });
        },
      },
    });

    rzp.on('payment.failed', async (failResp) => {
      try {
        await apiFetch('/subscription/cancel-payment', {
          method: 'POST',
          body: {
            razorpay_order_id: orderData.orderId,
            reason: failResp?.error?.description || 'Payment failed',
          },
        });
      } catch { /* ignore */ }
      resolve({
        success: false,
        error: failResp?.error?.description || 'Payment failed. Please try another payment method.',
      });
    });

    rzp.open();
  });
}
