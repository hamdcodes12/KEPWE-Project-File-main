import { angelOrderTag } from '../algo/broker-adapters.js';
import { applyBrokerExecutionUpdate } from './broker-execution.service.js';
import { tryCreateQuantNotification } from './quant-notification.service.js';
import { createAndSubmitOrder } from '../algo/oms.js';
import {
  adapterFromAngelOneAccount,
  isAngelOneSessionError,
  loadUsableAngelOneAccounts,
  markAngelOneSessionExpired,
} from './angel-one-session.service.js';
import { findAngelInstrument, loadAngelInstrumentMaster } from './angel-one-instruments.service.js';

const BROKER = 'ANGEL_ONE';
const DEFAULT_INTERVAL_MS = 5000;
let timer = null;
let running = false;

function istMinutes(timestamp = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return Number.isFinite(hour) && Number.isFinite(minute) ? (hour * 60) + minute : null;
}

async function reconcileTradeBook(pool, userId, broker, adapter) {
  const trades = await adapter.getTradeBook();
  if (!Array.isArray(trades)) throw new Error('Angel One trade book response is not an array');
  for (const trade of trades) {
    const brokerOrderId = trade.orderId;
    if (!brokerOrderId) continue;
    const brokerTradeId = trade.tradeId || null;
    const executionPrice = Number(trade.tradedPrice);
    const executionQuantity = Number(trade.tradedQuantity);
    // SmartAPI's trade book carries no charges; stored charges are left untouched.
    const charges = null;
    if (!Number.isFinite(executionPrice) || !Number.isFinite(executionQuantity)) continue;
    await pool.query(
      `UPDATE algo_trades t
       SET broker_trade_id = COALESCE($3, broker_trade_id),
           execution_price = $4, execution_quantity = $5,
           charges = COALESCE($6, charges),
           net_pnl = pnl - COALESCE($6, charges)
       FROM algo_orders o
       WHERE t.user_id = $1 AND o.user_id = t.user_id AND o.broker_order_id = $2
         AND t.broker_order_id = $2`,
      [userId, String(brokerOrderId), brokerTradeId, executionPrice, executionQuantity, Number.isFinite(charges) ? charges : null],
    );
  }
  return trades.length;
}

async function monitorProtectiveExits(pool, userId, adapter) {
  if (typeof adapter.assertOrderExecutionReady === 'function') {
    try {
      await adapter.assertOrderExecutionReady();
    } catch {
      return;
    }
  } else {
    const readiness = adapter.readiness?.();
    if (readiness && readiness.orderExecutionReady !== true) return;
  }
  const positions = await pool.query(
    `SELECT * FROM algo_positions WHERE user_id = $1 AND status = 'OPEN' AND security_id IS NOT NULL`,
    [userId],
  );
  for (const position of positions.rows) {
    const minutesHeld = position.opened_at
      ? (Date.now() - new Date(position.opened_at).getTime()) / 60000
      : null;
    const isTimeStop = Number.isFinite(minutesHeld) && minutesHeld >= 20;
    const isEodSquareOff = (istMinutes() || 0) >= (15 * 60 + 10);
    if (!Number.isFinite(Number(position.stop_loss)) && !Number.isFinite(Number(position.target)) && !isTimeStop && !isEodSquareOff) continue;
    const exchange = position.exchange_segment || 'NFO';
    const quote = await adapter.getMarketData({ exchange, symbolToken: position.security_id });
    const ltp = Number.isFinite(Number(quote?.ltp)) && Number(quote.ltp) > 0 ? Number(quote.ltp) : null;
    if (!ltp) continue;
    const isLong = position.side === 'BUY';
    const hitStop = Number.isFinite(Number(position.stop_loss)) && (isLong ? ltp <= Number(position.stop_loss) : ltp >= Number(position.stop_loss));
    const hitTarget = Number.isFinite(Number(position.target)) && (isLong ? ltp >= Number(position.target) : ltp <= Number(position.target));
    if (!hitStop && !hitTarget && !isTimeStop && !isEodSquareOff) continue;
    const pending = await pool.query(
      `SELECT 1 FROM algo_orders WHERE user_id = $1 AND instrument = $2 AND is_exit = TRUE
       AND status IN ('CREATED', 'RECOVERY_PENDING', 'SUBMITTED', 'PARTIALLY_FILLED') LIMIT 1`,
      [userId, position.security_id],
    );
    if (pending.rows.length > 0) continue;
    const exitReason = hitStop ? 'STOP_LOSS' : hitTarget ? 'TARGET' : isEodSquareOff ? 'EOD_SQUARE_OFF' : 'TIME_STOP';
    // Lot size comes from the official instrument master; without it the exit order cannot be validated.
    const contract = findAngelInstrument(await loadAngelInstrumentMaster(), exchange, position.security_id);
    if (!contract?.lotSize && exchange !== 'NSE' && exchange !== 'BSE') continue;
    await createAndSubmitOrder({
      pool,
      adapter,
      userId,
      executionMode: 'LIVE',
      instrument: position.security_id,
      side: isLong ? 'SELL' : 'BUY',
      quantity: Number(position.quantity),
      price: ltp,
      stopLoss: ltp,
      target: ltp,
      brokerAccountId: adapter.brokerAccountId,
      parentOrderId: null,
      isExit: true,
      metadata: {
        broker: BROKER,
        securityId: position.security_id,
        symbolToken: position.security_id,
        tradingSymbol: position.trading_symbol || contract?.tradingSymbol,
        exchange,
        exchangeSegment: exchange,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        lotSize: contract?.lotSize || 1,
        exitReason,
        isExit: true,
      },
    });
  }
}

async function synchronizePositions(pool, userId, broker, adapter) {
  const positions = await adapter.getPositions();
  const livePositions = positions.filter((position) => Number(position.quantity || 0) > 0);
  const internalResult = await pool.query(
    `SELECT * FROM algo_positions WHERE user_id = $1 AND status IN ('OPEN', 'EMERGENCY_PENDING')`,
    [userId],
  );
  const matchedIds = new Set();
  for (const position of livePositions) {
    const instrument = String(position.instrument || position.tradingSymbol || position.symbol || '').trim();
    const side = String(position.side || '').toUpperCase();
    if (!instrument || !['BUY', 'SELL'].includes(side)) continue;
    const quantity = Number(position.quantity || 0);
    const currentPrice = Number(position.currentPrice || position.ltp || position.entryPrice || 0);
    const pnl = Number(position.pnl);
    if (!Number.isFinite(quantity) || !Number.isFinite(currentPrice) || !Number.isFinite(pnl)) continue;
    const existing = internalResult.rows.find((row) => (
      (position.securityId && String(row.security_id || '') === String(position.securityId))
      || (position.brokerPositionKey && row.broker_position_key === position.brokerPositionKey)
      || (row.symbol === instrument && row.side === side)
    ));
    if (existing) {
      matchedIds.add(existing.id);
      await pool.query(
        `UPDATE algo_positions
         SET symbol = $2, security_id = $3, trading_symbol = $4, exchange_segment = $5,
             broker_position_key = $6, quantity = $7, current_price = $8, pnl = $9, status = 'OPEN',
             realized_pnl = $10, unrealized_pnl = $11, broker_updated_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [existing.id, instrument, position.securityId || instrument, position.tradingSymbol || instrument,
          position.exchangeSegment || null, position.brokerPositionKey || null, quantity, currentPrice, pnl,
          Number(position.realizedPnl || 0), Number(position.unrealizedPnl || 0)],
      );
    } else {
      const inserted = await pool.query(
        `INSERT INTO algo_positions
         (user_id, symbol, security_id, trading_symbol, exchange_segment, broker_position_key,
          side, quantity, entry_price, current_price, pnl, realized_pnl, unrealized_pnl, status, opened_at, broker_updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'OPEN', NOW(), NOW())
         RETURNING id`,
        [userId, instrument, position.securityId || instrument, position.tradingSymbol || instrument,
          position.exchangeSegment || null, position.brokerPositionKey || null, side, quantity,
          Number(position.entryPrice || currentPrice), currentPrice, pnl, Number(position.realizedPnl || 0), Number(position.unrealizedPnl || 0)],
      );
      matchedIds.add(inserted.rows[0]?.id);
    }
  }
  for (const row of internalResult.rows) {
    if (!matchedIds.has(row.id)) {
      await pool.query(
        `UPDATE algo_positions SET status = 'CLOSED', quantity = 0, unrealized_pnl = 0, broker_updated_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
      await tryCreateQuantNotification(pool, {
        userId,
        type: 'POSITION_CLOSED',
        title: 'Broker position closed',
        body: `${row.trading_symbol || row.symbol} is no longer open at Angel One.`,
        data: { positionId: row.id, securityId: row.security_id || row.symbol },
      });
    }
  }
}

async function pollPendingOrders(pool) {
  if (running) return;
  running = true;
  try {
    const accounts = await loadUsableAngelOneAccounts(pool);
    const adapters = new Map();
    for (const row of accounts) {
      try {
        const adapter = adapterFromAngelOneAccount(pool, row);
        adapters.set(row.id, { adapter, row });
        await synchronizePositions(pool, row.user_id, BROKER, adapter);
        await reconcileTradeBook(pool, row.user_id, BROKER, adapter);
        await monitorProtectiveExits(pool, row.user_id, adapter);
      } catch (error) {
        if (isAngelOneSessionError(error)) {
          await markAngelOneSessionExpired(pool, row.id);
          adapters.delete(row.id);
        }
        await pool.query(
          `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
           VALUES ($1, 'BROKER_POSITION_SYNC_FAILED', $2, $3::jsonb)`,
          [row.user_id, 'Broker position synchronization failed; existing values were retained', JSON.stringify({ broker: BROKER, error: error.message, code: error.code || null })],
        );
      }
    }

    const result = await pool.query(
      `SELECT o.id, o.user_id, o.internal_order_id, o.broker_order_id, a.id AS broker_account_id, a.broker
       FROM algo_orders o
       JOIN broker_accounts a ON a.id = o.broker_account_id AND a.user_id = o.user_id
       WHERE o.execution_mode = 'LIVE'
         AND o.status IN ('RECOVERY_PENDING', 'SUBMITTED', 'PARTIALLY_FILLED')
         AND a.broker = 'ANGEL_ONE'
         AND a.status IN ('CONNECTED', 'PARTIALLY_CONNECTED')
       ORDER BY o.updated_at ASC
       LIMIT 100`,
    );

    for (const row of result.rows) {
      try {
        const account = adapters.get(row.broker_account_id);
        if (!account) continue;
        const { adapter } = account;
        let update;
        if (row.broker_order_id) {
          update = await adapter.getOrderStatus({ brokerOrderId: row.broker_order_id });
        } else {
          // Submission outcome unknown: find the order by the KEPWE ordertag it was sent with.
          const orderbook = await adapter.getOrderBook();
          const tag = angelOrderTag(row.internal_order_id);
          const match = orderbook.find((item) => tag && String(item.orderTag || item.correlationId || '') === tag);
          if (!match) continue;
          update = match;
        }
        await applyBrokerExecutionUpdate({
          pool,
          broker: BROKER,
          brokerOrderId: update.brokerOrderId || row.broker_order_id,
          correlationId: row.internal_order_id,
          status: update.status,
          filledQuantity: update.filledQuantity,
          remainingQuantity: update.remainingQuantity,
          averagePrice: update.averagePrice,
          rejectionReason: update.rejectionReason,
          payload: update.raw || update,
          // `update` was just read from SmartAPI with the owner's session.
          authoritativeExecution: update,
        });
      } catch (error) {
        await pool.query(
          `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
           VALUES ($1, 'BROKER_EXECUTION_POLL_FAILED', $2, $3::jsonb)`,
          [row.user_id, 'Broker execution polling failed; order was not retried', JSON.stringify({ broker: BROKER, orderId: row.id, error: error.message, code: error.code || null })],
        );
      }
    }
  } finally {
    running = false;
  }
}

export function startBrokerExecutionWorker(pool, intervalMs = Number(process.env.BROKER_EXECUTION_POLL_INTERVAL_MS || DEFAULT_INTERVAL_MS)) {
  if (timer) return timer;
  const run = () => pollPendingOrders(pool).catch(() => {});
  run();
  timer = setInterval(run, Math.max(1000, intervalMs));
  timer.unref?.();
  return timer;
}

export function stopBrokerExecutionWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

export { pollPendingOrders };
