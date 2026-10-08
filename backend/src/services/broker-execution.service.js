import { createHash, timingSafeEqual } from 'crypto';
import { applyExecutionUpdate } from '../algo/oms.js';
import { adapterFromAngelOneAccount, isAngelOneSessionError, markAngelOneSessionExpired } from './angel-one-session.service.js';

const WEBHOOK_TOKEN_ENV = {
  ANGEL_ONE: 'ANGEL_ONE_WEBHOOK_TOKEN',
};

function text(value) {
  return String(value || '').trim();
}

export function verifyBrokerWebhookRequest(req, broker) {
  const envName = WEBHOOK_TOKEN_ENV[broker];
  const configured = text(process.env[envName]);
  // Angel One's postback is a plain POST to the registered URL (no custom
  // headers, no signature), so the shared secret arrives as ?token= on that URL.
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
  // Set only by callers that have just read this order from SmartAPI themselves.
  authoritativeExecution = null,
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
         -- Angel One echoes ordertag, which KEPWE sets to the first 20 alphanumeric
         -- characters of internal_order_id (dashes removed).
         OR ($4::text IS NOT NULL AND length($4) >= 20 AND replace(o.internal_order_id::text, '-', '') LIKE $4 || '%')
       )
     LIMIT 1`,
    [broker, providerOrderId || null, /^[0-9a-f-]{36}$/i.test(orderId) ? orderId : null, /^[0-9A-Za-z]{20,32}$/.test(orderId) ? orderId : null],
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
  // Angel One postbacks are unsigned. They are treated only as a trigger: the
  // order's state is always read back from SmartAPI with the owner's session.
  const authoritative = authoritativeExecution
    ? { ok: true, execution: authoritativeExecution }
    : await fetchAuthoritativeOrder(pool, order, providerOrderId || order.broker_order_id);
  if (!authoritative.ok) {
    return { ignored: true, deferred: true, reason: authoritative.reason, orderId: order.id };
  }
  ({ status: effectiveStatus, filledQuantity: effectiveFilled, averagePrice: effectiveAverage, remainingQuantity: effectiveRemaining, rejectionReason: effectiveRejection } = authoritative.execution);
  const source = 'ANGEL_ONE_ORDER_API';
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
      exchangeOrderId: authoritative.execution.exchangeOrderId || payload.exchorderid || payload.exchangeOrderId || null,
      correlationId: authoritative.execution.correlationId || payload.ordertag || payload.correlationId || null,
      charges: authoritative.execution.charges ?? null,
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

/** Reads the order's current state from SmartAPI (order book) using the owner's stored session. */
export async function fetchAuthoritativeOrder(pool, order, brokerOrderId) {
  if (!brokerOrderId) return { ok: false, reason: 'broker_order_id_unknown' };
  let row = null;
  try {
    const accounts = await pool.query(
      `SELECT a.id, a.user_id, a.client_id, a.status, a.connection_mode,
              t.access_token_ciphertext, t.refresh_token_ciphertext, t.feed_token_ciphertext,
              t.api_key_ciphertext, t.token_expires_at
       FROM broker_accounts a
       JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.id = $1 AND a.user_id = $2 AND a.broker = 'ANGEL_ONE'`,
      [order.broker_account_id, order.user_id],
    );
    row = accounts.rows[0];
    if (!row?.access_token_ciphertext) return { ok: false, reason: 'broker_session_unavailable' };
    const adapter = adapterFromAngelOneAccount(pool, row);
    const execution = await adapter.getOrderStatus({ brokerOrderId: String(brokerOrderId) });
    return { ok: true, execution };
  } catch (error) {
    if (row?.id && isAngelOneSessionError(error)) await markAngelOneSessionExpired(pool, row.id);
    return { ok: false, reason: `broker_order_fetch_failed: ${error.message}` };
  }
}
