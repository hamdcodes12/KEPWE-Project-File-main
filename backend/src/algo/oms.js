import { randomUUID } from 'crypto';

const ORDER_STATUSES = new Set([
  'CREATED',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCELLED',
  'REJECTED',
]);

function serializeError(error) {
  return error?.message || 'Broker rejected the order';
}

export class DuplicateExecutionError extends Error {
  constructor(instrument) {
    super(`An open position already exists for ${instrument}`);
    this.name = 'DuplicateExecutionError';
    this.statusCode = 409;
  }
}

export class InvalidOrderStateError extends Error {
  constructor(status, requestedStatus) {
    super(`Order in ${status} state cannot transition to ${requestedStatus}`);
    this.name = 'InvalidOrderStateError';
    this.statusCode = 409;
  }
}

export function normalizeExecutionStatus(value) {
  const status = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (['COMPLETE', 'COMPLETED', 'EXECUTED', 'FILLED', 'TRADED'].includes(status)) return 'FILLED';
  if (['PARTIAL', 'PARTIALLY_FILLED', 'PARTIALLYFILLED'].includes(status)) return 'PARTIALLY_FILLED';
  if (['OPEN', 'PENDING', 'PENDING_NEW', 'TRIGGER_PENDING', 'PUT_ORDER_REQUEST_RECEIVED', 'SUBMITTED'].includes(status)) return 'SUBMITTED';
  if (['CANCELLED', 'CANCELED', 'CANCELLED_AFTER_MARKET_ORDER'].includes(status)) return 'CANCELLED';
  if (['REJECTED', 'ERROR', 'FAILED'].includes(status)) return 'REJECTED';
  return ORDER_STATUSES.has(status) ? status : null;
}

function executionValues(execution = {}, order) {
  const status = normalizeExecutionStatus(execution.status || execution.orderStatus) || 'SUBMITTED';
  const brokerOrderId = execution.brokerOrderId || execution.orderId || execution.order_id || null;
  const requestedFilled = execution.filledQuantity ?? execution.filled_quantity ?? execution.filledshares;
  const filledQuantity = status === 'FILLED'
    ? order.quantity
    : Math.max(0, Math.min(order.quantity, Number(requestedFilled || 0)));
  const averagePrice = Number(
    execution.averagePrice
      ?? execution.average_price
      ?? execution.avgPrice
      ?? order.average_fill_price
      ?? order.price
  );
  if (status === 'PARTIALLY_FILLED' && (filledQuantity <= 0 || filledQuantity >= order.quantity)) {
    throw new InvalidOrderStateError(order.status, status);
  }
  if (status === 'FILLED' && filledQuantity !== order.quantity) {
    throw new InvalidOrderStateError(order.status, status);
  }
  return {
    status,
    brokerOrderId,
    filledQuantity: Number.isFinite(filledQuantity) ? filledQuantity : 0,
    averagePrice: Number.isFinite(averagePrice) && averagePrice > 0 ? averagePrice : Number(order.price),
    rejectionReason: execution.rejectionReason || execution.rejection_reason || execution.error || null,
  };
}

async function recordFilledQuantity(client, order, filledQuantity, averagePrice) {
  if (filledQuantity <= 0) return null;

  const isPaper = order.execution_mode === 'PAPER';
  const existingTrade = isPaper
    ? await client.query(
      `SELECT * FROM paper_trades
       WHERE order_id = $1 AND status = 'OPEN'
       FOR UPDATE`,
      [order.id],
    )
    : { rows: [] };
  const openPosition = await client.query(
    `SELECT * FROM algo_positions
     WHERE user_id = $1 AND symbol = $2 AND status = 'OPEN'
     FOR UPDATE`,
    [order.user_id, order.instrument],
  );
  const metadata = order.metadata || {};
  const slippageBps = Number(metadata.slippageBps ?? 0);
  const chargesBps = Number(metadata.chargesBps ?? 0);
  const currentQuantity = Number(existingTrade.rows[0]?.quantity || openPosition.rows[0]?.quantity || 0);
  const incrementalQuantity = currentQuantity
    ? Math.max(0, filledQuantity - currentQuantity)
    : filledQuantity;
  if (incrementalQuantity <= 0) return existingTrade.rows[0] || openPosition.rows[0] || null;

  const executionSlippage = averagePrice * (slippageBps / 10000) * incrementalQuantity;
  const executionCharges = averagePrice * (chargesBps / 10000) * incrementalQuantity;
  let trade;
  if (!isPaper) {
    trade = null;
  } else if (existingTrade.rows[0]) {
    const current = existingTrade.rows[0];
    const currentQuantity = Number(current.quantity);
    const weightedEntry = (
      (Number(current.entry_price) * currentQuantity)
      + (averagePrice * incrementalQuantity)
    ) / filledQuantity;
    const updated = await client.query(
      `UPDATE paper_trades
       SET quantity = $2, entry_price = $3, slippage = slippage + $4, charges = charges + $5
       WHERE id = $1
       RETURNING *`,
      [current.id, filledQuantity, weightedEntry, executionSlippage, executionCharges]
    );
    trade = updated.rows[0];
  } else {
    const inserted = await client.query(
      `INSERT INTO paper_trades
       (user_id, order_id, strategy_id, instrument, side, quantity, entry_price,
        stop_loss, target, slippage, charges, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'OPEN')
       RETURNING *`,
      [
        order.user_id,
        order.id,
        order.strategy_id,
        order.instrument,
        order.side,
        filledQuantity,
        averagePrice,
        order.stop_loss,
        order.target,
        executionSlippage,
        executionCharges,
      ]
    );
    trade = inserted.rows[0];
  }

  if (openPosition.rows[0]) {
    const current = openPosition.rows[0];
    const currentQuantity = Number(current.quantity);
    const weightedEntry = (
      (Number(current.entry_price) * currentQuantity)
      + (averagePrice * incrementalQuantity)
    ) / (currentQuantity + incrementalQuantity);
    await client.query(
      `UPDATE algo_positions
       SET quantity = $2, entry_price = $3, current_price = $4,
           stop_loss = $5, target = $6
       WHERE id = $1`,
      [
        current.id,
         currentQuantity + incrementalQuantity,
        weightedEntry,
        averagePrice,
        order.stop_loss,
        order.target,
      ]
    );
  } else if (order.execution_mode === 'PAPER' || order.execution_mode === 'LIVE') {
    await client.query(
      `INSERT INTO algo_positions
       (user_id, symbol, side, quantity, entry_price, current_price,
        stop_loss, target, status)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'OPEN')`,
      [
        order.user_id,
        order.instrument,
        order.side,
        filledQuantity,
        averagePrice,
        order.stop_loss,
        order.target,
      ]
    );
  }
  return trade;
}

/**
 * Apply an execution update from either the paper venue or a live broker.
 * The order row and its resulting position/trade are changed in one transaction.
 */
const ALLOWED_TRANSITIONS = {
  CREATED: new Set(['SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED']),
  SUBMITTED: new Set(['SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED']),
  PARTIALLY_FILLED: new Set(['SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED']),
  FILLED: new Set(['FILLED']),
  CANCELLED: new Set(['CANCELLED']),
  REJECTED: new Set(['REJECTED']),
};

export async function applyExecutionUpdate({ pool, orderId, brokerOrderId, userId = null, execution }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `SELECT * FROM algo_orders
       WHERE (
         (($1::uuid IS NOT NULL AND id = $1)
           OR ($2::text IS NOT NULL AND broker_order_id = $2))
         AND ($3::uuid IS NULL OR user_id = $3)
       )
       FOR UPDATE`,
      [orderId || null, brokerOrderId || null, userId || null]
    );
    const order = found.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return null;
    }

    const update = executionValues({ ...execution, brokerOrderId }, order);
    if (!ALLOWED_TRANSITIONS[order.status]?.has(update.status)) {
      throw new InvalidOrderStateError(order.status, update.status);
    }
    const currentFilled = Number(order.filled_quantity || 0);
    if (update.filledQuantity < currentFilled) {
      throw new InvalidOrderStateError(order.status, update.status);
    }
    const nextFilled = Math.max(currentFilled, update.filledQuantity);
    const nextStatus = update.status === 'SUBMITTED' && nextFilled > 0
      ? 'PARTIALLY_FILLED'
      : update.status;
    const transitionedToFilled = nextStatus === 'FILLED' && order.status !== 'FILLED';

    const saved = await client.query(
      `UPDATE algo_orders
       SET broker_order_id = COALESCE($2, broker_order_id),
           status = $3,
           filled_quantity = $4,
           average_fill_price = CASE WHEN $4 > 0 THEN $5 ELSE average_fill_price END,
           rejection_reason = $6,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        order.id,
        update.brokerOrderId,
        nextStatus,
        nextFilled,
        update.averagePrice,
        update.rejectionReason,
      ]
    );

    let trade = null;
    const newlyFilled = nextFilled > currentFilled;
    if (nextFilled > 0 && (order.execution_mode === 'PAPER' || transitionedToFilled || nextStatus === 'PARTIALLY_FILLED' || newlyFilled)) {
      trade = await recordFilledQuantity(client, order, nextFilled, update.averagePrice);
    }
    await client.query('COMMIT');
    return { order: saved.rows[0], trade };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createAndSubmitOrder({
  pool,
  adapter,
  userId,
  strategyId = null,
  executionMode = 'PAPER',
  instrument,
  side,
  quantity,
  price,
  stopLoss,
  target,
  metadata = {},
}) {
  const internalOrderId = randomUUID();
  const client = await pool.connect();
  let order;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${userId}:${instrument}`]);
    const duplicate = await client.query(
      `SELECT 1
       FROM algo_orders
       WHERE user_id = $1 AND instrument = $2
         AND status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED')
       UNION ALL
       SELECT 1 FROM paper_trades
       WHERE user_id = $1 AND instrument = $2 AND status = 'OPEN'
       UNION ALL
       SELECT 1 FROM algo_positions
       WHERE user_id = $1 AND symbol = $2 AND status = 'OPEN'
       LIMIT 1`,
      [userId, instrument],
    );
    if (duplicate.rows.length > 0) throw new DuplicateExecutionError(instrument);
    const inserted = await client.query(
      `INSERT INTO algo_orders
        (internal_order_id, user_id, strategy_id, execution_mode, instrument, side, quantity, price, stop_loss, target, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CREATED', $11::jsonb)
       RETURNING *`,
      [internalOrderId, userId, strategyId, executionMode, instrument, side, quantity, price, stopLoss, target, JSON.stringify(metadata)]
    );
    order = inserted.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505' && error.constraint === 'idx_algo_pending_user_instrument') {
      throw new DuplicateExecutionError(instrument);
    }
    throw error;
  } finally {
    client.release();
  }

  try {
    const brokerResult = await adapter.placeOrder({
      internalOrderId,
      instrument,
      side,
      quantity,
      price,
      stopLoss,
      target,
      metadata,
    });
    const status = normalizeExecutionStatus(brokerResult?.status) || 'SUBMITTED';
    const updated = await pool.query(
      `UPDATE algo_orders
       SET broker_order_id = $2, status = $3, rejection_reason = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        order.id,
        brokerResult?.brokerOrderId || brokerResult?.orderId || null,
        status,
        brokerResult?.rejectionReason || null,
      ]
    );
    return updated.rows[0];
  } catch (error) {
    const rejected = await pool.query(
      `UPDATE algo_orders SET status = 'REJECTED', rejection_reason = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [order.id, serializeError(error)]
    );
    return rejected.rows[0];
  }
}

export async function cancelOrder({ pool, adapter, orderId, userId }) {
  const result = await pool.query(
    `SELECT * FROM algo_orders WHERE id = $1 AND user_id = $2
     AND status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED')`,
    [orderId, userId]
  );
  if (!result.rows[0]) return null;
  const current = result.rows[0];
  const brokerResult = await adapter.cancelOrder({
    ...current,
    brokerOrderId: current.broker_order_id,
  });
  const updated = await pool.query(
    `UPDATE algo_orders SET status = 'CANCELLED', updated_at = NOW()
     WHERE id = $1 AND status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED')
     RETURNING *`,
    [orderId]
  );
  if (!updated.rows[0]) return null;
  return { order: updated.rows[0], broker: brokerResult };
}

export async function modifyOrder({ pool, adapter, orderId, userId, changes }) {
  const result = await pool.query(
    `SELECT * FROM algo_orders WHERE id = $1 AND user_id = $2
     AND status IN ('SUBMITTED', 'PARTIALLY_FILLED')`,
    [orderId, userId]
  );
  if (!result.rows[0]) return null;
  const current = result.rows[0];
  const brokerResult = await adapter.modifyOrder({
    ...current,
    brokerOrderId: current.broker_order_id,
    price: changes.price ?? current.price,
    stopLoss: changes.stopLoss ?? current.stop_loss,
    target: changes.target ?? current.target,
  });
  const updated = await pool.query(
    `UPDATE algo_orders
     SET price = COALESCE($2, price), stop_loss = COALESCE($3, stop_loss),
         target = COALESCE($4, target), updated_at = NOW()
     WHERE id = $1 AND status IN ('SUBMITTED', 'PARTIALLY_FILLED')
     RETURNING *`,
    [orderId, changes.price ?? null, changes.stopLoss ?? null, changes.target ?? null]
  );
  if (!updated.rows[0]) return null;
  return { order: updated.rows[0], broker: brokerResult };
}