import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isFreshMarketTimestamp,
  normalizeDhanCandles,
  resolveDhanOptionInstruments,
} from '../src/services/live-quant-runner.service.js';

test('live NIFTY timestamps reject stale and future quotes', () => {
  const now = Date.parse('2026-09-21T10:00:00.000Z');
  assert.equal(isFreshMarketTimestamp('2026-09-21T09:59:30.000Z', now), true);
  assert.equal(isFreshMarketTimestamp('2026-09-21T09:57:00.000Z', now), false);
  assert.equal(isFreshMarketTimestamp('2026-09-21T10:00:30.000Z', now), false);
});

test('Dhan candles exclude the incomplete current candle', () => {
  const now = Date.parse('2026-09-21T10:09:59.999Z');
  const candles = normalizeDhanCandles({
    data: {
      timestamp: [Date.parse('2026-09-21T10:00:00.000Z'), Date.parse('2026-09-21T10:05:00.000Z')],
      open: [100, 101], high: [102, 103], low: [99, 100], close: [101, 102], volume: [10, 20],
    },
  }, 5, now);
  assert.equal(candles.length, 1);
  assert.equal(candles[0].completed, true);
  assert.equal(candles[0].close, 101);
});

test('option-chain contracts require the NIFTY official instrument master mapping', () => {
  const requestedAt = Date.parse('2026-09-21T10:00:00.000Z');
  const master = new Map([
    ['501', { securityId: '501', underlyingSecurityId: '13', exchangeSegment: 'NSE_FNO', optionType: 'PE', expiry: '2026-09-24', tradingSymbol: 'NIFTY26SEP25000PE', lotSize: 75, tradable: true }],
    ['502', { securityId: '502', underlyingSecurityId: '99', exchangeSegment: 'NSE_FNO', optionType: 'PE', expiry: '2026-09-24', tradingSymbol: 'OTHER26SEP25000PE', lotSize: 75, tradable: true }],
  ]);
  const contracts = resolveDhanOptionInstruments({ data: { oc: { '25000': {
    pe: { security_id: '501', last_price: 100, top_bid_price: 99, top_ask_price: 101, volume: 100, greeks: { delta: -0.5 } },
  } } } }, requestedAt, master, '2026-09-24');
  assert.equal(contracts.length, 1);
  assert.equal(contracts[0].optionType, 'PE');
  assert.equal(contracts[0].delta, -0.5);
  assert.equal(contracts[0].securityId, '501');
});