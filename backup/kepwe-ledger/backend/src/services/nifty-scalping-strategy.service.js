const IST_TIME_ZONE = 'Asia/Kolkata';
const MINUTES_09_25 = (9 * 60) + 25;
const MINUTES_15_10 = (15 * 60) + 10;

export const NIFTY_SCALPING_STRATEGY = Object.freeze({
  name: 'KEPWE NIFTY 50 Scalping',
  slug: 'kepwe-nifty-50-scalping',
  version: 'v1.0',
  instrument: 'NIFTY 50 index options',
  underlying: 'NIFTY 50',
  direction: 'LONG_CE_PE',
  signalTimeframe: '5m',
  executionTimeframe: '1m',
  riskReward: 2,
  riskPerTradePct: 5,
  stopLossPct: 25,
  targetPct: 50,
  dailyDrawdownLimitPct: 10,
  maxTradesPerDay: 3,
  maxConsecutiveLosses: 2,
  maxOpenPositions: 1,
  forcedExitTime: '15:10',
  tradingWindowStart: '09:25',
  swingLookback: null,
  validation: Object.freeze({
    outOfSampleWinRatePct: 70,
    profitFactor: 1.8,
    minimumTrades: 500,
    riskReward: 2,
  }),
});

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function istMinutes(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return Number.isFinite(hour) && Number.isFinite(minute) ? (hour * 60) + minute : null;
}

function tradingDay(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE }).format(date);
}

function isCompletedCandle(candle, allowHistorical = false) {
  if (candle?.completed === true || candle?.isClosed === true || candle?.closed === true) return true;
  return allowHistorical === true;
}

function ema(values, period) {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const result = Array(period - 1).fill(null);
  result.push(current);
  for (let index = period; index < values.length; index += 1) {
    current = ((values[index] - current) * multiplier) + current;
    result.push(current);
  }
  return result;
}

function trueRanges(candles) {
  return candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - candles[index - 1].close),
      Math.abs(candle.low - candles[index - 1].close),
    );
  });
}

function atr(candles, period) {
  const ranges = trueRanges(candles);
  if (ranges.length < period) return null;
  let current = ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const result = Array(period - 1).fill(null);
  result.push(current);
  for (let index = period; index < ranges.length; index += 1) {
    current = ((current * (period - 1)) + ranges[index]) / period;
    result.push(current);
  }
  return result;
}

function adx(candles, period) {
  if (candles.length < (period * 2) + 1) return null;
  const ranges = [];
  const plusDm = [];
  const minusDm = [];
  for (let index = 1; index < candles.length; index += 1) {
    const upMove = candles[index].high - candles[index - 1].high;
    const downMove = candles[index - 1].low - candles[index].low;
    ranges.push(Math.max(
      candles[index].high - candles[index].low,
      Math.abs(candles[index].high - candles[index - 1].close),
      Math.abs(candles[index].low - candles[index - 1].close),
    ));
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  let tr = ranges.slice(0, period).reduce((sum, value) => sum + value, 0);
  let plus = plusDm.slice(0, period).reduce((sum, value) => sum + value, 0);
  let minus = minusDm.slice(0, period).reduce((sum, value) => sum + value, 0);
  const dx = [];
  for (let index = period; index <= ranges.length; index += 1) {
    if (index > period) {
      tr = tr - (tr / period) + ranges[index - 1];
      plus = plus - (plus / period) + plusDm[index - 1];
      minus = minus - (minus / period) + minusDm[index - 1];
    }
    const plusDi = tr ? (plus / tr) * 100 : 0;
    const minusDi = tr ? (minus / tr) * 100 : 0;
    const denominator = plusDi + minusDi;
    dx.push(denominator ? (Math.abs(plusDi - minusDi) / denominator) * 100 : 0);
  }
  if (dx.length < period) return null;
  let current = dx.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let index = period; index < dx.length; index += 1) {
    current = ((current * (period - 1)) + dx[index]) / period;
  }
  return current;
}

function cumulativeVwap(candles, index) {
  const day = tradingDay(candles[index].timestamp);
  let value = 0;
  let volume = 0;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (tradingDay(candles[cursor].timestamp) !== day) break;
    const candleVolume = finite(candles[cursor].volume) || 0;
    value += ((candles[cursor].high + candles[cursor].low + candles[cursor].close) / 3) * candleVolume;
    volume += candleVolume;
  }
  return volume > 0 ? value / volume : null;
}

function rollingMedian(values) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function openingRange(candles, index) {
  const day = tradingDay(candles[index].timestamp);
  const first15 = candles.filter((candle) => {
    return tradingDay(candle.timestamp) === day && (istMinutes(candle.timestamp) ?? Infinity) >= 555 && (istMinutes(candle.timestamp) ?? -Infinity) < 570;
  });
  if (first15.length < 3) return null;
  return {
    high: Math.max(...first15.map((candle) => candle.high)),
    low: Math.min(...first15.map((candle) => candle.low)),
  };
}

function recentSwing(candles, index, side, lookback) {
  if (!Number.isInteger(lookback) || lookback < 1) return null;
  const start = Math.max(0, index - lookback);
  const history = candles.slice(start, index).filter((candle) => tradingDay(candle.timestamp) === tradingDay(candles[index].timestamp));
  if (history.length < lookback) return null;
  return side === 'CE' ? Math.max(...history.map((candle) => candle.high)) : Math.min(...history.map((candle) => candle.low));
}

export function enrichNiftyScalpingCandles(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const normalized = candles.map((candle) => ({
    ...candle,
    open: finite(candle.open),
    high: finite(candle.high),
    low: finite(candle.low),
    close: finite(candle.close),
    volume: finite(candle.volume) || 0,
  }));
  const closes = normalized.map((candle) => candle.close);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const atr14 = atr(normalized, 14);
  return normalized.map((candle, index) => {
    const atrValue = atr14?.[index] ?? null;
    const previousEma20 = ema20?.[index - 1] ?? null;
    return {
      ...candle,
      vwap: cumulativeVwap(normalized, index),
      ema20: ema20?.[index] ?? null,
      ema50: ema50?.[index] ?? null,
      ema20Slope: ema20?.[index] !== null && previousEma20 !== null ? ema20[index] - previousEma20 : null,
      adx14: adx(normalized.slice(0, index + 1), 14),
      atr14: atrValue,
      atrMedian20: index >= 19 ? rollingMedian((atr14 || []).slice(index - 19, index + 1)) : null,
      bodyAtrRatio: atrValue ? Math.abs(candle.close - candle.open) / atrValue : null,
      openingRange: openingRange(normalized, index),
    };
  });
}

export function evaluateNiftyScalpingSignal(candles, index, options = {}) {
  if (!Array.isArray(candles) || index < 0 || index >= candles.length) return { signal: 'NO_TRADE', reason: 'INSUFFICIENT_HISTORY' };
  const current = candles[index];
  if (!isCompletedCandle(current, options.allowHistorical)) return { signal: 'NO_TRADE', reason: 'UNFINISHED_5M_CANDLE' };
  const minutes = istMinutes(current.timestamp);
  if (minutes === null || minutes < MINUTES_09_25 || minutes >= MINUTES_15_10) return { signal: 'NO_TRADE', reason: 'OUTSIDE_TRADING_WINDOW' };
  const required = ['close', 'vwap', 'ema20', 'ema50', 'ema20Slope', 'adx14', 'atr14', 'atrMedian20', 'bodyAtrRatio'];
  if (required.some((key) => !Number.isFinite(current[key]))) return { signal: 'NO_TRADE', reason: 'INDICATORS_UNAVAILABLE' };
  const regime = current.close > current.vwap && current.ema20 > current.ema50 && current.ema20Slope > 0 && current.adx14 >= 18 && current.atr14 > current.atrMedian20 ? 'CE'
    : current.close < current.vwap && current.ema20 < current.ema50 && current.ema20Slope < 0 && current.adx14 >= 18 && current.atr14 > current.atrMedian20 ? 'PE' : null;
  if (!regime) return { signal: 'NO_TRADE', reason: 'REGIME_CONDITIONS_NOT_MET' };
  const opening = current.openingRange;
  const swing = recentSwing(candles, index, regime, options.swingLookback);
  const breakout = regime === 'CE'
    ? (opening && current.close > opening.high) || (swing !== null && current.close > swing)
    : (opening && current.close < opening.low) || (swing !== null && current.close < swing);
  const directionChecks = regime === 'CE'
    ? current.close > current.vwap && current.close > current.ema20 && current.ema20 > current.ema50
    : current.close < current.vwap && current.close < current.ema20 && current.ema20 < current.ema50;
  if (!breakout || !directionChecks || current.bodyAtrRatio > 1.8) {
    return { signal: 'NO_TRADE', reason: 'ENTRY_CONDITIONS_NOT_MET', regime, openingRange: opening };
  }
  return {
    signal: regime === 'CE' ? 'BUY_CE' : 'BUY_PE',
    direction: `LONG_${regime}`,
    breakoutCandle: current,
    breakoutCandleIndex: index,
    regime,
    openingRange: opening,
    indicators: {
      vwap: current.vwap,
      ema20: current.ema20,
      ema50: current.ema50,
      adx14: current.adx14,
      atr14: current.atr14,
      atrMedian20: current.atrMedian20,
    },
  };
}

export function confirmNiftyScalpingEntry(signal, oneMinuteCandle) {
  if (!signal || !['BUY_CE', 'BUY_PE'].includes(signal.signal)) return { confirmed: false, reason: 'NO_BREAKOUT_SIGNAL' };
  if (!isCompletedCandle(oneMinuteCandle)) return { confirmed: false, reason: 'UNFINISHED_1M_CANDLE' };
  const breakout = signal.breakoutCandle;
  const confirmed = signal.signal === 'BUY_CE'
    ? oneMinuteCandle.high > breakout.high
    : oneMinuteCandle.low < breakout.low;
  return confirmed
    ? { confirmed: true, entryReferencePrice: signal.signal === 'BUY_CE' ? oneMinuteCandle.high : oneMinuteCandle.low }
    : { confirmed: false, reason: 'ONE_MINUTE_CONFIRMATION_NOT_MET' };
}

export function selectNiftyScalpingOption({ spotPrice, optionType, instruments, now, maxSpreadPct = 1.5 }) {
  if (!Array.isArray(instruments) || instruments.length === 0) return { contract: null, reason: 'REAL_CONTRACT_MASTER_UNAVAILABLE' };
  const timestamp = now ? new Date(now).getTime() : Date.now();
  const candidates = instruments.filter((instrument) => {
    const ltp = finite(instrument.ltp);
    const bid = finite(instrument.bid);
    const ask = finite(instrument.ask);
    const expiry = new Date(instrument.expiry).getTime();
    const spreadPct = bid > 0 && ask >= bid ? ((ask - bid) / ((ask + bid) / 2)) * 100 : null;
    const ageSeconds = finite(instrument.ltpTimestamp) === null ? null : (timestamp - Number(instrument.ltpTimestamp)) / 1000;
    return String(instrument.optionType || '').toUpperCase() === optionType
      && finite(instrument.strike) !== null
      && ltp !== null
      && instrument.securityId
      && Number.isFinite(expiry)
      && expiry >= timestamp
      && instrument.isLiquid === true
      && spreadPct !== null
      && spreadPct <= maxSpreadPct
      && ageSeconds !== null
      && ageSeconds <= 3
      && instrument.halted === false
      && instrument.abnormallyVolatile === false;
  });
  if (!candidates.length) return { contract: null, reason: 'NO_ELIGIBLE_LIQUID_CURRENT_CONTRACT' };
  const strikes = [...new Set(candidates.map((instrument) => Number(instrument.strike)))].sort((a, b) => a - b);
  const atm = strikes.reduce((closest, strike) => Math.abs(strike - spotPrice) < Math.abs(closest - spotPrice) ? strike : closest, strikes[0]);
  const oneItm = optionType === 'CE' ? strikes.filter((strike) => strike < atm).at(-1) : strikes.find((strike) => strike > atm);
  const allowedStrikes = new Set([atm, oneItm].filter((strike) => strike !== undefined));
  const preferred = candidates.filter((instrument) => {
    const delta = finite(instrument.delta);
    const absoluteDelta = delta === null ? null : Math.abs(delta);
    return allowedStrikes.has(Number(instrument.strike)) && absoluteDelta !== null && absoluteDelta >= 0.45 && absoluteDelta <= 0.60;
  });
  const selected = (preferred.length ? preferred : candidates.filter((instrument) => allowedStrikes.has(Number(instrument.strike))))
    .sort((left, right) => new Date(left.expiry) - new Date(right.expiry) || Math.abs(Number(left.strike) - atm) - Math.abs(Number(right.strike) - atm))[0];
  if (!selected) return { contract: null, reason: 'ATM_OR_ONE_ITM_CONTRACT_UNAVAILABLE' };
  return {
    contract: {
      ...selected,
      premium: Number(selected.ltp),
      stop: Number((selected.ltp * 0.75).toFixed(2)),
      target: Number((selected.ltp * 1.5).toFixed(2)),
      lotSize: Number(selected.lotSize),
      quantityFreeze: Number(selected.quantityFreeze),
    },
    reason: null,
  };
}

export function calculateNiftyScalpingPositionSize({ startingDayCapital, entryPremium, lotSize, quantityFreeze }) {
  const capital = finite(startingDayCapital);
  const premium = finite(entryPremium);
  const lot = finite(lotSize);
  const freeze = finite(quantityFreeze);
  if (!capital || !premium || !lot || !freeze || capital <= 0 || premium <= 0 || lot <= 0 || freeze <= 0) {
    throw new Error('Starting-day capital, premium, lot size, and quantity freeze are required from live data.');
  }
  const riskAmount = capital * 0.05;
  const premiumRiskPerUnit = premium * 0.25;
  const rawQuantity = Math.floor(riskAmount / premiumRiskPerUnit);
  const quantity = Math.min(Math.floor(rawQuantity / lot) * lot, Math.floor(freeze / lot) * lot);
  return {
    accountEquity: capital,
    riskAmount: Number(riskAmount.toFixed(2)),
    premiumRiskPerUnit: Number(premiumRiskPerUnit.toFixed(2)),
    quantity,
    lots: quantity / lot,
    lotSize: lot,
    quantityFreeze: freeze,
    withinRiskBudget: quantity * premiumRiskPerUnit <= riskAmount,
  };
}

export function validateNiftyScalpingDeploymentGate(validation = {}) {
  const checks = [
    { key: 'OUT_OF_SAMPLE_WIN_RATE', passed: Number(validation.outOfSampleWinRatePct) >= 70, required: '>= 70%' },
    { key: 'RISK_REWARD', passed: Number(validation.riskReward) === 2, required: 'Exactly 1:2 before costs' },
    { key: 'PROFIT_FACTOR', passed: Number(validation.profitFactor) > 1.8, required: '> 1.8' },
    { key: 'POSITIVE_EXPECTANCY_AFTER_COSTS', passed: Number(validation.expectancyAfterCosts) > 0, required: '> 0' },
    { key: 'DRAWDOWN_APPROVED', passed: validation.drawdownApproved === true, required: 'Approved drawdown' },
    { key: 'MINIMUM_TRADES', passed: Number(validation.tradeCount) >= 500, required: '>= 500 trades' },
    { key: 'WALK_FORWARD', passed: validation.walkForwardPassed === true, required: 'Walk-forward passed' },
    { key: 'STRESSED_SLIPPAGE', passed: validation.stressedSlippagePassed === true, required: 'Conservative/stressed slippage passed' },
    { key: 'OUTLIER_TEST', passed: validation.topFiveOutlierTestPassed === true, required: 'Top-5 winner outlier test passed' },
  ];
  const passed = checks.every((check) => check.passed);
  return {
    strategy: NIFTY_SCALPING_STRATEGY.slug,
    status: passed ? 'READY' : 'BLOCKED',
    isDeployable: passed,
    checks,
    reason: passed ? 'All independent validation requirements passed.' : 'Live deployment is blocked until every independent validation requirement passes.',
  };
}

export function runNiftyScalpingBacktest({ candles, optionCandles, instrumentsByTimestamp, startingDayCapital, charges = 0, slippagePct = 0 }) {
  if (!Array.isArray(candles) || candles.length === 0 || !Array.isArray(optionCandles) || optionCandles.length === 0) {
    throw new Error('Real completed NIFTY 5-minute candles and real 1-minute option observations are required.');
  }
  if (!Number.isFinite(Number(startingDayCapital)) || Number(startingDayCapital) <= 0) throw new Error('Starting-day trading capital is required.');
  const enriched = enrichNiftyScalpingCandles(candles);
  const trades = [];
  let active = null;
  let equity = Number(startingDayCapital);
  let peak = equity;
  let maxDrawdown = 0;
  let dailyTrades = 0;
  let dailyLoss = 0;
  let consecutiveLosses = 0;
  let currentDay = null;
  for (let index = 0; index < enriched.length; index += 1) {
    const candle = enriched[index];
    const day = tradingDay(candle.timestamp);
    if (day !== currentDay) { currentDay = day; dailyTrades = 0; dailyLoss = 0; consecutiveLosses = 0; }
    if (active) {
      const minutesHeld = (new Date(candle.timestamp).getTime() - new Date(active.entryTime).getTime()) / 60000;
      const optionObservation = optionCandles.find((item) => new Date(item.timestamp).getTime() >= new Date(active.entryTime).getTime() && new Date(item.timestamp).getTime() <= new Date(candle.timestamp).getTime());
      const ltp = finite(optionObservation?.ltp);
      if (ltp === null) continue;
      const hitTarget = ltp >= active.target;
      const hitStop = ltp <= active.stop;
      const forcedExit = (istMinutes(candle.timestamp) ?? 0) >= MINUTES_15_10;
      if (!hitTarget && !hitStop && !forcedExit && minutesHeld < 20) continue;
      const exitPrice = hitTarget ? active.target : hitStop ? active.stop : ltp;
      const executedExit = exitPrice * (1 - (Number(slippagePct) / 100));
      const pnlGross = (executedExit - active.entryPremium) * active.quantity;
      const totalCharges = Number(charges) * active.lots;
      const pnlNet = pnlGross - totalCharges;
      equity += pnlNet;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      if (pnlNet < 0) { dailyLoss += Math.abs(pnlNet); consecutiveLosses += 1; } else consecutiveLosses = 0;
      trades.push({ ...active, exitPrice: Number(executedExit.toFixed(2)), pnlGross: Number(pnlGross.toFixed(2)), charges: Number(totalCharges.toFixed(2)), pnlNet: Number(pnlNet.toFixed(2)), exitReason: hitTarget ? 'TARGET' : hitStop ? 'STOP' : forcedExit ? 'FORCED_EXIT' : 'TIME_STOP' });
      active = null;
      continue;
    }
    if (dailyTrades >= 3 || consecutiveLosses >= 2 || dailyLoss >= Number(startingDayCapital) * 0.1) continue;
    const signal = evaluateNiftyScalpingSignal(enriched, index, { allowHistorical: true, swingLookback: NIFTY_SCALPING_STRATEGY.swingLookback });
    if (!['BUY_CE', 'BUY_PE'].includes(signal.signal)) continue;
    const nextMinute = optionCandles.find((item) => new Date(item.timestamp).getTime() > new Date(candle.timestamp).getTime());
    const confirmation = confirmNiftyScalpingEntry(signal, nextMinute);
    if (!confirmation.confirmed) continue;
    const instruments = instrumentsByTimestamp?.[nextMinute.timestamp] || instrumentsByTimestamp?.default;
    const selected = selectNiftyScalpingOption({ spotPrice: candle.close, optionType: signal.regime, instruments, now: nextMinute.timestamp });
    if (!selected.contract) continue;
    const sizing = calculateNiftyScalpingPositionSize({ startingDayCapital, entryPremium: selected.contract.premium, lotSize: selected.contract.lotSize, quantityFreeze: selected.contract.quantityFreeze });
    if (sizing.quantity <= 0) continue;
    active = { side: signal.signal, entryTime: nextMinute.timestamp, entryPremium: selected.contract.premium, stop: selected.contract.stop, target: selected.contract.target, quantity: sizing.quantity, lots: sizing.lots, contract: selected.contract };
    dailyTrades += 1;
  }
  const winners = trades.filter((trade) => trade.pnlNet > 0);
  const losers = trades.filter((trade) => trade.pnlNet <= 0);
  const grossProfit = winners.reduce((sum, trade) => sum + trade.pnlNet, 0);
  const grossLoss = Math.abs(losers.reduce((sum, trade) => sum + trade.pnlNet, 0));
  const netPnl = equity - Number(startingDayCapital);
  return {
    strategy: NIFTY_SCALPING_STRATEGY,
    metrics: {
      tradeCount: trades.length,
      winRate: trades.length ? (winners.length / trades.length) * 100 : 0,
      lossRate: trades.length ? (losers.length / trades.length) * 100 : 0,
      profitFactor: grossLoss ? grossProfit / grossLoss : 0,
      expectancy: trades.length ? netPnl / trades.length : 0,
      netPnl,
      maxDrawdown,
      averageWin: winners.length ? grossProfit / winners.length : 0,
      averageLoss: losers.length ? grossLoss / losers.length : 0,
      slippageImpact: Number(slippagePct),
      brokerageCharges: trades.reduce((sum, trade) => sum + trade.charges, 0),
    },
    trades,
    endingCapital: equity,
  };
}
