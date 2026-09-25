import { createHash, timingSafeEqual } from 'crypto';
import { applyExecutionUpdate } from '../algo/oms.js';

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
  const supplied = text(req.get('x-kepwe-broker-webhook-token'));
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
       )
     LIMIT 1`,
    [broker, providerOrderId || null, /^[0-9a-f-]{36}$/i.test(orderId) ? orderId : null],
  );
  const order = result.rows[0];
  if (!order || order.account_user_id !== order.user_id) {
    return { ignored: true, reason: 'order_account_mismatch' };
  }

  const normalizedFilledQuantity = Math.max(0, Number(filledQuantity) || 0);
  const normalizedAveragePrice = averagePrice === null || averagePrice === undefined
    ? null
    : Number(averagePrice);
  const payloadHash = executionPayloadHash(payload);
  const execution = await applyExecutionUpdate({
    pool,
    orderId: order.id,
    brokerOrderId: providerOrderId || order.broker_order_id,
    userId: order.user_id,
    brokerAccountId: order.broker_account_id,
    execution: {
      status,
      filledQuantity: normalizedFilledQuantity,
      remainingQuantity,
      averagePrice: normalizedAveragePrice,
      exchangeOrderId: payload.exchangeOrderId || payload.exchange_order_id || payload.ExchOrderNo,
      correlationId: payload.correlationId || payload.correlation_id || payload.CorrelationId,
      charges: payload.charges || payload.totalCharges || payload.brokerage,
      rejectionReason,
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
      text(status).toUpperCase(),
      normalizedFilledQuantity,
      normalizedAveragePrice,
      payloadHash,
    ],
  );
  return { execution, orderId: order.id, duplicate: event.rows.length === 0 };
}
