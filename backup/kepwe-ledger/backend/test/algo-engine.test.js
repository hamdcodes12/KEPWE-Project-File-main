import test from 'node:test';
import assert from 'node:assert/strict';
import { atr, calculateIndicators, ema, rsi } from '../src/algo/indicators.js';
import { runBacktest } from '../src/algo/backtest.js';
import { AngelOneAdapter, getBrokerReadiness } from '../src/algo/broker-adapters.js';
import { calculatePaperPnl, resolvePaperExit } from '../src/algo/paper-engine.js';
import { killSwitchReasons } from '../src/algo/reconciliation.js';
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

test('live reconciliation kill-switch reasons remain deterministic', () => {
  assert.deepEqual(killSwitchReasons({ positionMismatch: true, excessiveSlippage: true }), ['POSITION_MISMATCH', 'EXCESSIVE_SLIPPAGE']);
});

// Broker adapter behaviour (Angel One SmartAPI, the only supported broker) is
// covered in test/angel-one-broker.test.js.
test('Angel One is the only broker the adapter factory accepts', () => {
  assert.equal(new AngelOneAdapter().broker, 'ANGEL_ONE');
  assert.equal(getBrokerReadiness('ANGEL_ONE', 'LIVE').broker, 'ANGEL_ONE');
  assert.throws(() => getBrokerReadiness('DHAN', 'LIVE'), /Unsupported broker/);
  assert.throws(() => getBrokerReadiness('PAPER', 'LIVE'), /Unsupported broker/);
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