import test from 'node:test';
import assert from 'node:assert/strict';
import { atr, calculateIndicators, ema, rsi } from '../src/algo/indicators.js';
import { runBacktest } from '../src/algo/backtest.js';
import { AngelOneAdapter, LemonnAdapter, PaperBrokerAdapter, getBrokerReadiness } from '../src/algo/broker-adapters.js';
import { calculatePaperPnl, resolvePaperExit } from '../src/algo/paper-engine.js';
import { comparePaperLedgers, killSwitchReasons } from '../src/algo/reconciliation.js';
import { evaluateRisk, sizePosition } from '../src/algo/risk-engine.js';
import { calculateTarget, evaluateSignal } from '../src/algo/strategy.js';

test('indicators produce stable values and preserve warmup nulls', () => {
  assert.deepEqual(ema([10, 12, 14], 2), [10, 11.333333333333334, 13.11111111111111]);
  assert.equal(rsi(Array.from({ length: 10 }, (_, index) => index + 1), 14).at(-1), null);
  assert.equal(atr([{ high: 10, low: 9, close: 9.5 }], 14)[0], null);
  const indicators = calculateIndicators(Array.from({ length: 30 }, (_, index) => ({
    timestamp: `2026-08-28T09:${String(index).padStart(2, '0')}:00+05:30`,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100 + index,
    volume: 1000,
  })));
  assert.equal(indicators.length, 30);
  assert.equal(indicators[0].ema9, 100);
});

test('strategy gates reject a flat market and expose the failed conditions', () => {
  const candles = Array.from({ length: 30 }, (_, index) => ({
    timestamp: `2026-08-28T09:${String(index).padStart(2, '0')}:00+05:30`,
    open: 100,
    high: 100,
    low: 100,
    close: 100,
    volume: 1000,
  }));
  const result = evaluateSignal(calculateIndicators(candles), 29);
  assert.equal(result.signal, 'NO_TRADE');
  assert.ok(result.reason.includes('volatility') || result.reason.includes('breakout'));
});

test('signals calculate a default target and reject an invalid stop direction', () => {
  assert.equal(calculateTarget({ side: 'BUY', entryPrice: 100, stopLoss: 95 }), 110);
  assert.equal(calculateTarget({ side: 'SELL', entryPrice: 100, stopLoss: 105 }), 90);
  assert.equal(calculateTarget({ side: 'BUY', entryPrice: 100, stopLoss: 105 }), null);
});

test('risk sizing and risk gates enforce configured capital', () => {
  const settings = { tradingCapital: 100000, riskPerTrade: 1, maxTradesPerDay: 3, maxConsecutiveLosses: 2, dailyLossLimit: 0 };
  const sizing = sizePosition({ entryPrice: 100, stopLoss: 95, settings, lotSize: 25, availableMargin: 100000 });
  assert.equal(sizing.quantity, 200);
  const blocked = evaluateRisk({
    candidate: { signal: 'BUY', price: 100, stopLoss: 95, target: 110 },
    settings,
    stats: { todayTrades: 3 },
  });
  assert.equal(blocked.approved, false);
  assert.equal(blocked.checks.maxTrades, false);
});

test('paper exit closes on stop first when both levels are touched', () => {
  const exit = resolvePaperExit({
    side: 'BUY',
    low: 90,
    high: 120,
    close: 105,
    stopLoss: 95,
    target: 110,
    timestamp: '2026-08-28T10:00:00+05:30',
  });
  assert.deepEqual(exit, { exitPrice: 95, reason: 'STOP_LOSS' });
  const pnl = calculatePaperPnl({
    side: 'BUY',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    entryCharges: 1,
    exitCharges: 1,
  });
  assert.equal(pnl.pnl, 98);
});

test('paper exit closes all positions at the configured IST end of day', () => {
  const exit = resolvePaperExit({
    side: 'SELL',
    low: 99,
    high: 101,
    close: 100,
    stopLoss: 105,
    target: 90,
    timestamp: '2026-08-28T15:16:00+05:30',
  });
  assert.deepEqual(exit, { exitPrice: 100, reason: 'END_OF_DAY' });
});

test('ledger reconciliation catches missing and quantity-mismatched positions', () => {
  const result = comparePaperLedgers(
    [{ instrument: 'NIFTY 50', side: 'BUY', quantity: 2, entry_price: 100 }],
    [{ instrument: 'NIFTY 50', side: 'BUY', quantity: 1, entry_price: 100 }],
  );
  assert.equal(result.matched, false);
  assert.equal(result.mismatches[0].reason, 'QUANTITY_MISMATCH');
  assert.deepEqual(killSwitchReasons({ positionMismatch: true, excessiveSlippage: true }), ['POSITION_MISMATCH', 'EXCESSIVE_SLIPPAGE']);
});

test('live broker adapters remain disabled without official configuration', () => {
  const angel = getBrokerReadiness('ANGEL_ONE', 'LIVE');
  const lemonn = getBrokerReadiness('LEMONN', 'LIVE');
  assert.equal(angel.enabled, false);
  assert.equal(lemonn.enabled, false);
  assert.equal(angel.capabilities.orderPlacement, false);
  assert.equal(lemonn.capabilities.positions, false);
  assert.equal(JSON.stringify(angel).includes('ACCESS_TOKEN'), false);
});

test('paper adapter preserves pending lifecycle state through modification and cancellation', async () => {
  const adapter = new PaperBrokerAdapter();
  const pending = await adapter.placeOrder({
    internalOrderId: 'paper-order-1',
    instrument: 'NIFTY 50',
    side: 'BUY',
    quantity: 10,
    price: 100,
    metadata: { paperLifecycleStatus: 'PENDING' },
  });
  assert.equal(pending.status, 'SUBMITTED');
  const modified = await adapter.modifyOrder({
    brokerOrderId: pending.brokerOrderId,
    price: 101,
    quantity: 10,
    stopLoss: 95,
    target: 113,
  });
  assert.equal(modified.status, 'SUBMITTED');
  assert.deepEqual(await adapter.getOrderStatus({ brokerOrderId: pending.brokerOrderId }), pending);
  const cancelled = await adapter.cancelOrder({ brokerOrderId: pending.brokerOrderId });
  assert.equal(cancelled.status, 'CANCELLED');
  await assert.rejects(
    () => adapter.modifyOrder({ brokerOrderId: pending.brokerOrderId, price: 102 }),
    /cannot modify order in CANCELLED state/,
  );
});

async function withEnvironment(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function jsonResponse(payload, ok = true, status = 200) {
  return { ok, status, async json() { return payload; } };
}

test('Angel One adapter covers authentication, orders, status, positions and execution polling', async () => {
  await withEnvironment({
    ANGEL_ONE_BASE_URL: 'https://angel.test',
    ANGEL_ONE_API_KEY: 'angel-key',
    ANGEL_ONE_CLIENT_CODE: 'client',
    ANGEL_ONE_PASSWORD: 'password',
    ANGEL_ONE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
  }, async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('loginByPassword')) return jsonResponse({ status: true, data: { jwtToken: 'jwt', refreshToken: 'refresh', feedToken: 'feed' } });
      if (String(url).includes('getOrderBook')) return jsonResponse({ status: true, data: [{ orderid: 'angel-1', orderstatus: 'complete', filledshares: '10', averageprice: '101' }] });
      if (String(url).includes('getTradeBook')) return jsonResponse({ status: true, data: [{ orderid: 'angel-1' }] });
      if (String(url).includes('getRMS')) return jsonResponse({ status: true, data: { availablecash: '100000' } });
      if (String(url).includes('position')) return jsonResponse({ status: true, data: [{ tradingsymbol: 'NIFTY', symboltoken: '1', netqty: '10', averageprice: '100', ltp: '101', pnl: '10' }] });
      if (String(url).includes('placeOrder')) return jsonResponse({ status: true, data: { orderid: 'angel-1' } });
      return jsonResponse({ status: true, data: { orderid: 'angel-1' } });
    };
    try {
      const adapter = new AngelOneAdapter();
      assert.equal((await adapter.authenticate()).authenticated, true);
      await adapter.getMarketData({ exchange: 'NFO', symbolToken: '1' });
      await adapter.getHistoricalData({ exchange: 'NFO', symbolToken: '1', interval: '5m', fromDate: '2026-08-28 09:15', toDate: '2026-08-28 15:15' });
      const order = await adapter.placeOrder({ instrument: 'NIFTY', side: 'BUY', quantity: 10, price: 100, metadata: { symbolToken: '1', tradingSymbol: 'NIFTY', exchange: 'NFO' } });
      await adapter.modifyOrder({ ...order, side: 'BUY', quantity: 10, price: 101, metadata: { symbolToken: '1', tradingSymbol: 'NIFTY', exchange: 'NFO' } });
      await adapter.cancelOrder(order);
      assert.equal((await adapter.getOrderStatus({ brokerOrderId: 'angel-1' })).status, 'complete');
      assert.equal((await adapter.getPositions())[0].quantity, 10);
      assert.equal((await adapter.getTradeBook())[0].orderid, 'angel-1');
      assert.equal((await adapter.getMargin()).availablecash, '100000');
      const updates = [];
      await adapter.subscribeExecutionUpdates({ brokerOrderIds: ['angel-1'], onUpdate: (update) => updates.push(update), signal: new AbortController().signal });
      assert.equal(updates.length, 1);
      assert.ok(calls.length >= 10);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('Lemonn adapter covers the configured broker contract', async () => {
  await withEnvironment({
    LEMONN_BASE_URL: 'https://lemonn.test',
    LEMONN_API_KEY: 'lemonn-key',
    LEMONN_ACCOUNT_ID: 'account-1',
    LEMONN_QUOTE_PATH: '/quote',
    LEMONN_CANDLES_PATH: '/candles',
    LEMONN_ORDER_PATH: '/orders',
    LEMONN_POSITIONS_PATH: '/positions',
    LEMONN_TRADES_PATH: '/trades',
    LEMONN_MARGIN_PATH: '/margin',
  }, async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/orders')) return jsonResponse({ data: { orderId: 'lemonn-1', status: 'SUBMITTED' } });
      if (String(url).includes('/orders/')) return jsonResponse({ data: { orderId: 'lemonn-1', status: 'FILLED', filledQuantity: 10, averagePrice: 101 } });
      if (String(url).endsWith('/positions')) return jsonResponse({ data: [{ instrument: 'NIFTY', side: 'BUY', quantity: 10, entryPrice: 100 }] });
      if (String(url).endsWith('/trades')) return jsonResponse({ data: [{ orderId: 'lemonn-1' }] });
      if (String(url).endsWith('/margin')) return jsonResponse({ data: { available: 100000 } });
      return jsonResponse({ data: [{ close: 100 }] });
    };
    try {
      const adapter = new LemonnAdapter();
      assert.equal((await adapter.authenticate()).authenticated, true);
      await adapter.getMarketData({ instrument: 'NIFTY' });
      await adapter.getHistoricalData({ instrument: 'NIFTY', fromDate: '2026-08-28', toDate: '2026-08-29' });
      const order = await adapter.placeOrder({ instrument: 'NIFTY', side: 'BUY', quantity: 10, price: 100, stopLoss: 95, target: 110 });
      await adapter.modifyOrder({ ...order, price: 101 });
      await adapter.cancelOrder(order);
      assert.equal((await adapter.getOrderStatus({ brokerOrderId: 'lemonn-1' })).status, 'FILLED');
      assert.equal((await adapter.getPositions())[0].quantity, 10);
      assert.equal((await adapter.getTradeBook())[0].orderId, 'lemonn-1');
      assert.equal((await adapter.getMargin()).available, 100000);
      const updates = [];
      await adapter.subscribeExecutionUpdates({ brokerOrderIds: ['lemonn-1'], onUpdate: (update) => updates.push(update), signal: new AbortController().signal });
      assert.equal(updates.length, 1);
      assert.ok(calls.every((call) => call.options.headers.Authorization === 'Bearer lemonn-key'));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('backtest returns complete metrics without fabricated trades', () => {
  const candles = Array.from({ length: 40 }, (_, index) => ({
    timestamp: `2026-08-28T09:${String(index % 60).padStart(2, '0')}:00+05:30`,
    open: 100,
    high: 100,
    low: 100,
    close: 100,
    volume: 1000,
  }));
  const result = runBacktest({ candles, capital: 100000, riskPerTrade: 1 });
  assert.equal(result.metrics.totalTrades, 0);
  assert.equal(result.metrics.endingCapital, 100000);
  assert.ok(Object.hasOwn(result.metrics, 'maximumDrawdown'));
});