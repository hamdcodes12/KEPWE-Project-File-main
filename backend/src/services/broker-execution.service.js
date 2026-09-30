import { createHash, timingSafeEqual } from 'crypto';
import { applyExecutionUpdate } from '../algo/oms.js';
import { getBrokerAdapter } from '../algo/broker-adapters.js';
import { decryptBrokerSecret } from './broker-token.service.js';

const WEBHOOK_TOKEN_ENV = {
  DHAN: 'DHAN_WEBHOOK_TOKEN',
  ANGEL_ONE: 'ANGEL_ONE_WEBHOOK_TOKEN',
};

function text(value) {
  return String(value || '').trim();
}

export function verifyBrokerWebhookRequest(req, broker) {
  const envName = WEBHOOK_TOKEN_ENV[broker];
  const configured = text(process.env[envName]);
  // Dhan's postback is a plain POST to the registered URL (no custom headers),
  // so the shared secret may also arrive as ?token= on that URL.
  const supplied = text(req.get('x-kepwe-broker-webhook-token') || req.query?.token);
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function executionPayloadHash(payload) {
  return createHash('sha256').update(JSON.stringify(payload || {}), 'utf8').digest('hex');
}

export async function applyBrokerExecutionUpdate({
  pool,
  broker,
  brokerOrderId,
  correlationId = null,
  status,
  filledQuantity = 0,
  remainingQuantity = null,
  averagePrice = null,
  rejectionReason = null,
  payload = {},
}) {
  const orderId = text(correlationId);
  const providerOrderId = text(brokerOrderId);
  if (!providerOrderId && !orderId) return { ignored: true, reason: 'missing_order_identifier' };

  const result = await pool.query(
    `SELECT o.id, o.user_id, o.broker_account_id, o.broker_order_id,
            a.broker, a.user_id AS account_user_id, a.status AS account_status
     FROM algo_orders o
     JOIN broker_accounts a ON a.id = o.broker_account_id
     WHERE a.broker = $1
       AND a.user_id = o.user_id
       AND a.status IN ('CONNECTED', 'PARTIALLY_CONNECTED')
       AND (
         ($2::text IS NOT NULL AND o.broker_order_id = $2)
         OR ($3::uuid IS NOT NULL AND o.internal_order_id = $3::uuid)
         -- Dhan echoes correlationId, which KEPWE sets to the first 25 chars of internal_order_id.
         OR ($4::text IS NOT NULL AND length($4) >= 20 AND o.internal_order_id::text LIKE $4 || '%')
       )
     LIMIT 1`,
    [broker, providerOrderId || null, /^[0-9a-f-]{36}$/i.test(orderId) ? orderId : null, orderId || null],
  );
  const order = result.rows[0];
  if (!order || order.account_user_id !== order.user_id) {
    return { ignored: true, reason: 'order_account_mismatch' };
  }

  let effectiveStatus = status;
  let effectiveFilled = filledQuantity;
  let effectiveAverage = averagePrice;
  let effectiveRemaining = remainingQuantity;
  let effectiveRejection = rejectionReason;
  let source = 'WEBHOOK_PAYLOAD';
  if (broker === 'DHAN') {
    // Dhan postbacks carry no averageTradedPrice and are not signed. Treat them
    // only as a trigger and apply Dhan's authoritative order state instead.
    const authoritative = await fetchAuthoritativeDhanOrder(pool, order, providerOrderId || order.broker_order_id);
    if (!authoritative.ok) {
      return { ignored: true, deferred: true, reason: authoritative.reason, orderId: order.id };
    }
    ({ status: effectiveStatus, filledQuantity: effectiveFilled, averagePrice: effectiveAverage, remainingQuantity: effectiveRemaining, rejectionReason: effectiveRejection } = authoritative.execution);
    source = 'DHAN_ORDER_API';
  }
  const normalizedFilledQuantity = Math.max(0, Number(effectiveFilled) || 0);
  const normalizedAveragePrice = effectiveAverage === null || effectiveAverage === undefined
    ? null
    : Number(effectiveAverage);
  const payloadHash = executionPayloadHash(payload);
  const execution = await applyExecutionUpdate({
    pool,
    orderId: order.id,
    brokerOrderId: providerOrderId || order.broker_order_id,
    userId: order.user_id,
    brokerAccountId: order.broker_account_id,
    execution: {
      status: effectiveStatus,
      filledQuantity: normalizedFilledQuantity,
      remainingQuantity: effectiveRemaining,
      averagePrice: normalizedAveragePrice,
      exchangeOrderId: payload.exchangeOrderId || payload.exchange_order_id || payload.ExchOrderNo,
      correlationId: payload.correlationId || payload.correlation_id || payload.CorrelationId,
      charges: payload.charges || payload.totalCharges || payload.brokerage,
      rejectionReason: effectiveRejection,
    },
  });
  const event = await pool.query(
    `INSERT INTO execution_events
       (broker_account_id, broker_order_id, status, filled_quantity, average_price, payload_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (broker_account_id, broker_order_id, status, filled_quantity, average_price)
     DO NOTHING
     RETURNING id`,
    [
      order.broker_account_id,
      providerOrderId || order.broker_order_id || orderId,
      text(effectiveStatus).toUpperCase(),
      normalizedFilledQuantity,
      normalizedAveragePrice,
      payloadHash,
    ],
  );
  return { execution, orderId: order.id, duplicate: event.rows.length === 0, source };
}

/** Reads the order's current state from Dhan GET /v2/orders/{orderId} using the owner's stored session. */
export async function fetchAuthoritativeDhanOrder(pool, order, brokerOrderId) {
  if (!brokerOrderId) return { ok: false, reason: 'dhan_order_id_unknown' };
  try {
    const tokens = await pool.query(
      `SELECT a.client_id, t.access_token_ciphertext, t.token_expires_at
       FROM broker_accounts a
       JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [order.broker_account_id, order.user_id],
    );
    const row = tokens.rows[0];
    if (!row?.access_token_ciphertext) return { ok: false, reason: 'dhan_session_unavailable' };
    const adapter = getBrokerAdapter('DHAN', 'LIVE', {
      dhanClientId: row.client_id,
      accessToken: decryptBrokerSecret(row.access_token_ciphertext),
      tokenExpiresAt: row.token_expires_at,
    });
    const execution = await adapter.getOrderStatus({ brokerOrderId: String(brokerOrderId) });
    return { ok: true, execution };
  } catch (error) {
    return { ok: false, reason: `dhan_order_fetch_failed: ${error.message}` };
  }
}
