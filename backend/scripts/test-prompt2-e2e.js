import assert from 'node:assert/strict';

const BASE_URL = process.env.PROMPT2_BASE_URL || 'http://127.0.0.1:3001/api';
const unique = Date.now();

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { response, data };
}

function expectStatus(result, expected, label) {
  assert.equal(result.response.status, expected, `${label}: expected ${expected}, received ${result.response.status}: ${JSON.stringify(result.data)}`);
}

async function readFirstSseSnapshot(token) {
  const controller = new AbortController();
  const response = await fetch(`${BASE_URL}/algo/stream`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  });
  assert.equal(response.status, 200, `SSE status: ${response.status}`);
  assert.ok(response.body, 'SSE response has a readable body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (const frame of buffer.split('\n\n')) {
        const line = frame.split('\n').find((item) => item.startsWith('data: '));
        if (line) {
          controller.abort();
          return JSON.parse(line.slice(6));
        }
      }
      buffer = buffer.slice(buffer.lastIndexOf('\n\n') + 2);
    }
  } finally {
    controller.abort();
    reader.releaseLock();
  }
  throw new Error('SSE stream ended before its initial database snapshot');
}

function makeCandles() {
  return Array.from({ length: 30 }, (_, index) => {
    const close = 100 + (index * 0.2) + (index % 2 ? 0.4 : 0);
    return {
      timestamp: `2026-08-28T10:${String(index).padStart(2, '0')}:00+05:30`,
      open: close - 0.2,
      high: close + 1.5,
      low: close - 1.5,
      close,
      volume: index === 29 ? 2000 : 1000,
    };
  });
}

async function createPaperOrder(token, instrument, lifecycleStatus) {
  return request('/algo/paper/orders', {
    token,
    method: 'POST',
    body: {
      instrument,
      side: 'BUY',
      quantity: 10,
      price: 100,
      stopLoss: 95,
      lifecycleStatus,
      marketTimestamp: '2026-08-28T10:00:00+05:30',
    },
  });
}

const registration = await request('/auth/register', {
  method: 'POST',
  body: {
    name: 'Prompt 2 Verification',
    email: `prompt2-${unique}@kepwe.test`,
    mobile: `9${String(unique).slice(-9)}`,
    password: 'Prompt2-test-password',
  },
});
expectStatus(registration, 201, 'registration');
const token = registration.data.accessToken;
assert.ok(token, 'registration returns an access token');

const settings = await request('/algo/settings', { token });
expectStatus(settings, 200, 'default settings');
const savedSettings = await request('/algo/settings', {
  token,
  method: 'PUT',
  body: {
    tradingCapital: 100000,
    riskPerTrade: 1,
    riskReward: 2,
    maxTradesPerDay: 3,
    maxConsecutiveLosses: 2,
    dailyLossLimit: 0,
  },
});
expectStatus(savedSettings, 200, 'risk settings');

const started = await request('/algo/start', {
  token,
  method: 'POST',
  body: { confirmRisk: true },
});
expectStatus(started, 200, 'algo activation');
assert.equal(started.data.status, 'ACTIVE');

const readiness = await request('/broker/readiness', { token });
expectStatus(readiness, 200, 'broker readiness');
assert.equal(readiness.data.paper.enabled, true);
assert.equal(readiness.data.brokers.find((broker) => broker.broker === 'ANGEL_ONE').enabled, false);
assert.equal(readiness.data.brokers.find((broker) => broker.broker === 'LEMONN').enabled, false);

const unconfiguredLiveConnect = await request('/broker/connect/live', {
  token,
  method: 'POST',
  body: { broker: 'ANGEL_ONE' },
});
expectStatus(unconfiguredLiveConnect, 503, 'unconfigured broker fails closed');

const signal = await request('/algo/signal', {
  token,
  method: 'POST',
  body: { candles: makeCandles() },
});
expectStatus(signal, 200, 'strategy signal');
assert.ok(['BUY', 'SELL', 'NO_TRADE'].includes(signal.data.signal.signal), 'signal has an explicit decision');
assert.ok(Object.hasOwn(signal.data.signal, 'sizing'), 'signal includes risk sizing');
if (signal.data.signal.signal !== 'NO_TRADE') {
  assert.ok(signal.data.signal.target > 0, 'trade signal has a positive default target');
}

const pending = await createPaperOrder(token, 'NIFTY 50', 'PENDING');
expectStatus(pending, 202, 'pending paper order');
assert.equal(pending.data.order.status, 'SUBMITTED');
const pendingId = pending.data.order.id;

const duplicate = await createPaperOrder(token, 'NIFTY 50', 'PENDING');
expectStatus(duplicate, 409, 'duplicate pending order protection');

const snapshot = await readFirstSseSnapshot(token);
assert.equal(snapshot.algoStatus, 'ACTIVE', 'SSE initial snapshot contains database algo status');
assert.ok(snapshot.orders.some((order) => order.id === pendingId), 'SSE initial snapshot contains the pending order');
assert.ok(Array.isArray(snapshot.activity), 'SSE snapshot includes activity');
assert.ok(snapshot.metrics && typeof snapshot.metrics.totalTrades === 'number', 'SSE snapshot includes measured metrics');

const modified = await request(`/algo/orders/${pendingId}`, {
  token,
  method: 'PATCH',
  body: { price: 101, stopLoss: 95, target: 111 },
});
expectStatus(modified, 200, 'pending paper order modification');
assert.equal(Number(modified.data.order.price), 101);
assert.equal(Number(modified.data.order.target), 111);

const filled = await request(`/algo/orders/${pendingId}/fill`, {
  token,
  method: 'POST',
  body: { fillPrice: 101 },
});
expectStatus(filled, 201, 'paper fill');
assert.equal(filled.data.order.status, 'FILLED');
assert.equal(filled.data.trade.status, 'OPEN');
assert.equal(filled.data.trade.target, 111);

const positionsAfterFill = await request('/algo/positions', { token });
expectStatus(positionsAfterFill, 200, 'position after fill');
assert.equal(positionsAfterFill.data.positions.length, 1);
assert.equal(positionsAfterFill.data.positions[0].quantity, 10);

const reconciliation = await request('/algo/reconciliation', { token });
expectStatus(reconciliation, 200, 'paper ledger reconciliation');
assert.equal(reconciliation.data.matched, true);

const marketUpdate = await request('/algo/paper/market-update', {
  token,
  method: 'POST',
  body: { price: 112, timestamp: '2026-08-28T10:05:00+05:30' },
});
expectStatus(marketUpdate, 200, 'target market update');
assert.equal(marketUpdate.data.closed.length, 1);
assert.equal(marketUpdate.data.closed[0].reason, 'TARGET');

const metrics = await request('/algo/metrics', { token });
expectStatus(metrics, 200, 'measured paper metrics');
assert.equal(metrics.data.totalTrades, 1);
assert.equal(metrics.data.winningTrades + metrics.data.losingTrades, 1);
assert.equal(metrics.data.winRate, 100);
assert.ok(metrics.data.netPnl > 0, 'P&L is calculated from the recorded execution');

const history = await request('/algo/trades', { token });
expectStatus(history, 200, 'trade history');
assert.ok(history.data.trades.some((trade) => trade.symbol === 'NIFTY 50' && trade.status === 'PAPER'));

const stopLossOrder = await createPaperOrder(token, 'SENSEX', 'PENDING');
expectStatus(stopLossOrder, 202, 'stop-loss test order');
const stopLossFill = await request(`/algo/orders/${stopLossOrder.data.order.id}/fill`, {
  token,
  method: 'POST',
  body: { fillPrice: 100 },
});
expectStatus(stopLossFill, 201, 'stop-loss test fill');
const stopLossUpdate = await request('/algo/paper/market-update', {
  token,
  method: 'POST',
  body: { price: 94, timestamp: '2026-08-28T10:10:00+05:30' },
});
expectStatus(stopLossUpdate, 200, 'stop-loss market update');
assert.equal(stopLossUpdate.data.closed[0].reason, 'STOP_LOSS');

const measuredMetrics = await request('/algo/metrics', { token });
expectStatus(measuredMetrics, 200, 'measured target and stop metrics');
assert.equal(measuredMetrics.data.totalTrades, 2);
assert.equal(measuredMetrics.data.winningTrades + measuredMetrics.data.losingTrades, 2);
assert.equal(measuredMetrics.data.winRate, 50);

const rejected = await createPaperOrder(token, 'BANKNIFTY', 'PENDING');
expectStatus(rejected, 202, 'second pending paper order');
const rejectedResult = await request(`/algo/orders/${rejected.data.order.id}/reject`, {
  token,
  method: 'POST',
  body: { reason: 'Verification rejection' },
});
expectStatus(rejectedResult, 200, 'paper reject');
assert.equal(rejectedResult.data.order.status, 'REJECTED');

const cancelled = await createPaperOrder(token, 'FINNIFTY', 'PENDING');
expectStatus(cancelled, 202, 'third pending paper order');
const cancelledResult = await request(`/algo/orders/${cancelled.data.order.id}/cancel`, {
  token,
  method: 'POST',
});
expectStatus(cancelledResult, 200, 'paper cancel');
assert.equal(cancelledResult.data.order.status, 'CANCELLED');

const limitedSettings = await request('/algo/settings', {
  token,
  method: 'PUT',
  body: {
    tradingCapital: 100000,
    riskPerTrade: 1,
    riskReward: 2,
    maxTradesPerDay: 2,
    maxConsecutiveLosses: 2,
    dailyLossLimit: 0,
  },
});
expectStatus(limitedSettings, 200, 'trade-count risk limit');
const tradeLimit = await createPaperOrder(token, 'MIDCAP', 'PENDING');
expectStatus(tradeLimit, 409, 'max trades risk control');

const killSwitchSettings = await request('/algo/settings', {
  token,
  method: 'PUT',
  body: {
    tradingCapital: 100000,
    riskPerTrade: 1,
    riskReward: 2,
    maxTradesPerDay: 3,
    maxConsecutiveLosses: 0,
    dailyLossLimit: 0,
  },
});
expectStatus(killSwitchSettings, 200, 'kill-switch settings');
const killSwitchUpdate = await request('/algo/paper/market-update', {
  token,
  method: 'POST',
  body: { price: 100, timestamp: '2026-08-28T10:15:00+05:30' },
});
expectStatus(killSwitchUpdate, 200, 'automatic kill-switch cycle');
const stopped = await request('/algo/dashboard', { token });
expectStatus(stopped, 200, 'stopped algo after kill switch');
assert.equal(stopped.data.algoStatus, 'STOPPED');
const events = await request('/algo/risk-events', { token });
expectStatus(events, 200, 'risk event history');
assert.ok(events.data.events.some((event) => event.type === 'KILL_SWITCH'));
const blockedAfterKillSwitch = await createPaperOrder(token, 'BANKEX', 'PENDING');
expectStatus(blockedAfterKillSwitch, 409, 'orders blocked after kill switch');

const finalSnapshot = await readFirstSseSnapshot(token);
assert.equal(finalSnapshot.algoStatus, 'STOPPED');
assert.equal(finalSnapshot.positions.length, 0);

console.log('PROMPT 2 E2E PASSED');
console.log('Market Data -> Signal -> Risk -> Size -> Order -> Execution -> Position -> SL/Target -> P&L -> Trade History');
console.log('Pending modify/fill/reject/cancel, duplicate protection, broker fail-closed, kill switch, SSE, and reconciliation passed.');