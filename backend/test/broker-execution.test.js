import assert from 'node:assert/strict';
import test from 'node:test';
import { applyExecutionUpdate, normalizeExecutionStatus } from '../src/algo/oms.js';
import { verifyBrokerWebhookRequest } from '../src/services/broker-execution.service.js';
import { getStaticIpReadiness } from '../src/services/static-ip.service.js';

function fakePool(initialOrder, initialPosition = null) {
  const state = {
    order: { ...initialOrder },
    position: initialPosition ? { ...initialPosition } : null,
    trades: [],
  };
  const client = {
    async query(sql, params = []) {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('SELECT * FROM algo_orders')) return { rows: [state.order] };
      if (sql.includes('SELECT * FROM algo_positions')) return { rows: state.position ? [state.position] : [] };
      if (sql.includes('UPDATE algo_orders')) {
        state.order = {
          ...state.order,
          broker_order_id: params[1] || state.order.broker_order_id,
          status: params[2],
          filled_quantity: params[3],
          average_fill_price: params[3] > 0 ? params[4] : state.order.average_fill_price,
          rejection_reason: params[5],
        };
        return { rows: [state.order] };
      }
      if (sql.includes('INSERT INTO algo_trades')) {
        state.trades.push({ quantity: params[6], pnl: params[7], status: 'LIVE' });
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO algo_positions')) {
        state.position = {
          id: 'position-1', user_id: params[0], symbol: params[1], side: params[2],
          quantity: params[3], entry_price: params[4], current_price: params[4], pnl: 0, status: 'OPEN',
        };
        return { rows: [state.position] };
      }
      if (sql.includes('UPDATE algo_positions')) {
        state.position.quantity = params[1];
        state.position.entry_price = params[2];
        state.position.current_price = params[3];
        return { rows: [] };
      }
      throw new Error(`Unhandled test SQL: ${sql}`);
    },
    release() {},
  };
  return {
    state,
    async connect() { return client; },
  };
}

test('OMS handles partial then complete live fills idempotently', async () => {
  assert.equal(normalizeExecutionStatus('PARTIALLY_TRADED'), 'PARTIALLY_FILLED');
  assert.equal(normalizeExecutionStatus('PART_TRADED'), 'PARTIALLY_FILLED');
  assert.equal(normalizeExecutionStatus('TRANSIT'), 'SUBMITTED');
  assert.equal(normalizeExecutionStatus('EXPIRED'), 'CANCELLED');
  const pool = fakePool({
    id: 'order-1', user_id: 'user-1', broker_account_id: 'account-1',
    instrument: 'NIFTY', side: 'BUY', quantity: 10, filled_quantity: 0,
    price: 100, status: 'SUBMITTED', stop_loss: 90, target: 120,
  });
  const partial = await applyExecutionUpdate({
    pool, orderId: 'order-1', userId: 'user-1', brokerAccountId: 'account-1',
    execution: { status: 'PARTIALLY_FILLED', filledQuantity: 5, averagePrice: 101 },
  });
  assert.equal(partial.order.status, 'PARTIALLY_FILLED');
  assert.equal(pool.state.trades.length, 1);
  assert.equal(pool.state.position.quantity, 5);

  pool.state.order.filled_quantity = 5;
  pool.state.order.status = 'PARTIALLY_FILLED';
  const complete = await applyExecutionUpdate({
    pool, orderId: 'order-1', userId: 'user-1', brokerAccountId: 'account-1',
    execution: { status: 'FILLED', filledQuantity: 10, averagePrice: 102 },
  });
  assert.equal(complete.order.status, 'FILLED');
  assert.equal(pool.state.trades.length, 2);
  assert.equal(pool.state.position.quantity, 10);

  pool.state.order.filled_quantity = 10;
  pool.state.order.status = 'FILLED';
  await applyExecutionUpdate({
    pool, orderId: 'order-1', userId: 'user-1', brokerAccountId: 'account-1',
    execution: { status: 'FILLED', filledQuantity: 10, averagePrice: 102 },
  });
  assert.equal(pool.state.trades.length, 2);
});

test('OMS preserves rejection and cancellation without creating trades', async () => {
  for (const status of ['REJECTED', 'CANCELLED']) {
    const pool = fakePool({
      id: `order-${status}`, user_id: 'user-1', broker_account_id: 'account-1',
      instrument: 'NIFTY', side: 'BUY', quantity: 1, filled_quantity: 0,
      price: 100, status: 'SUBMITTED',
    });
    const result = await applyExecutionUpdate({
      pool, orderId: pool.state.order.id, userId: 'user-1', brokerAccountId: 'account-1',
      execution: { status },
    });
    assert.equal(result.order.status, status);
    assert.equal(pool.state.trades.length, 0);
  }
});

test('webhooks fail closed without the configured ingress token', () => {
  process.env.DHAN_WEBHOOK_TOKEN = 'unit-secret';
  const request = { get: () => '' };
  assert.equal(verifyBrokerWebhookRequest(request, 'DHAN'), false);
  assert.equal(verifyBrokerWebhookRequest({ get: () => 'unit-secret' }, 'DHAN'), true);
});

test('static-IP readiness blocks when outbound infrastructure is unconfirmed', () => {
  const previous = { DHAN_STATIC_IP: process.env.DHAN_STATIC_IP, OUTBOUND_PUBLIC_IP: process.env.OUTBOUND_PUBLIC_IP };
  process.env.DHAN_STATIC_IP = '198.51.100.10';
  delete process.env.OUTBOUND_PUBLIC_IP;
  const readiness = getStaticIpReadiness('DHAN');
  assert.equal(readiness.ready, false);
  assert.equal(readiness.status, 'PENDING_EXTERNAL_CONFIGURATION');
  if (previous.DHAN_STATIC_IP === undefined) delete process.env.DHAN_STATIC_IP; else process.env.DHAN_STATIC_IP = previous.DHAN_STATIC_IP;
  if (previous.OUTBOUND_PUBLIC_IP === undefined) delete process.env.OUTBOUND_PUBLIC_IP; else process.env.OUTBOUND_PUBLIC_IP = previous.OUTBOUND_PUBLIC_IP;
});
