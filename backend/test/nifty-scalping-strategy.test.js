import assert from 'node:assert/strict';
import {
  NIFTY_SCALPING_STRATEGY,
  calculateNiftyScalpingPositionSize,
  confirmNiftyScalpingEntry,
  evaluateNiftyScalpingSignal,
  runNiftyScalpingBacktest,
  selectNiftyScalpingOption,
  validateNiftyScalpingDeploymentGate,
} from '../src/services/nifty-scalping-strategy.service.js';

console.log('KEPWE NIFTY 50 SCALPING STRATEGY TESTS');

assert.equal(NIFTY_SCALPING_STRATEGY.name, 'KEPWE NIFTY 50 Scalping');
assert.equal(NIFTY_SCALPING_STRATEGY.riskPerTradePct, 5);
assert.equal(NIFTY_SCALPING_STRATEGY.maxTradesPerDay, 3);
assert.equal(NIFTY_SCALPING_STRATEGY.maxConsecutiveLosses, 2);
assert.equal(NIFTY_SCALPING_STRATEGY.forcedExitTime, '15:10');

const unfinished = evaluateNiftyScalpingSignal([
  { timestamp: '2026-09-15T04:00:00.000Z', completed: false },
], 0);
assert.equal(unfinished.reason, 'UNFINISHED_5M_CANDLE');

const ceSignal = {
  signal: 'BUY_CE',
  breakoutCandle: { high: 100 },
};
assert.deepEqual(
  confirmNiftyScalpingEntry(ceSignal, { high: 100.01, completed: true }),
  { confirmed: true, entryReferencePrice: 100.01 },
);
assert.equal(confirmNiftyScalpingEntry(ceSignal, { high: 100, completed: true }).confirmed, false);
assert.equal(confirmNiftyScalpingEntry({ signal: 'BUY_PE', breakoutCandle: { low: 100 } }, { low: 99.99, completed: true }).confirmed, true);
assert.equal(confirmNiftyScalpingEntry(ceSignal, { high: 101, completed: false }).reason, 'UNFINISHED_1M_CANDLE');

const sizing = calculateNiftyScalpingPositionSize({
  startingDayCapital: 100000,
  entryPremium: 200,
  lotSize: 25,
  quantityFreeze: 175,
});
assert.equal(sizing.riskAmount, 5000);
assert.equal(sizing.quantity, 100);
assert.equal(sizing.quantity % 25, 0);
assert.equal(sizing.quantity * sizing.premiumRiskPerUnit <= sizing.riskAmount, true);

const optionResult = selectNiftyScalpingOption({
  spotPrice: 25000,
  optionType: 'CE',
  now: '2026-09-15T04:30:00.000Z',
  instruments: [
    {
      securityId: 'NIFTY-CE-25000', symbol: 'NIFTY', optionType: 'CE', strike: 25000,
      expiry: '2026-09-24T00:00:00.000Z', ltp: 200, bid: 199, ask: 201,
      delta: 0.52, lotSize: 25, quantityFreeze: 175, ltpTimestamp: Date.parse('2026-09-15T04:30:00.000Z'),
      isLiquid: true, halted: false, abnormallyVolatile: false,
    },
  ],
});
assert.equal(optionResult.contract.securityId, 'NIFTY-CE-25000');
assert.equal(optionResult.contract.lotSize, 25);
assert.equal(selectNiftyScalpingOption({
  spotPrice: 25000,
  optionType: 'CE',
  now: '2026-09-15T04:30:00.000Z',
  instruments: [{
    securityId: 'STALE', optionType: 'CE', strike: 25000, expiry: '2026-09-24T00:00:00.000Z',
    ltp: 200, bid: 190, ask: 210, lotSize: 25, quantityFreeze: 175,
    ltpTimestamp: Date.parse('2026-09-15T04:29:50.000Z'),
    isLiquid: true, halted: false, abnormallyVolatile: false,
  }],
}).contract, null);

assert.throws(
  () => runNiftyScalpingBacktest({ candles: [{ close: 1 }], optionCandles: [], startingDayCapital: 100000 }),
  /real completed NIFTY 5-minute candles and real 1-minute option observations are required/i,
);

const blockedGate = validateNiftyScalpingDeploymentGate({});
assert.equal(blockedGate.status, 'BLOCKED');
assert.equal(blockedGate.isDeployable, false);
const passingGate = validateNiftyScalpingDeploymentGate({
  outOfSampleWinRatePct: 70,
  riskReward: 2,
  profitFactor: 1.81,
  expectancyAfterCosts: 1,
  drawdownApproved: true,
  tradeCount: 500,
  walkForwardPassed: true,
  stressedSlippagePassed: true,
  topFiveOutlierTestPassed: true,
});
assert.equal(passingGate.status, 'READY');
assert.equal(passingGate.isDeployable, true);

console.log('PASS: exact risk rules, confirmation, contract filters, fail-closed backtest, and deployment gate');
