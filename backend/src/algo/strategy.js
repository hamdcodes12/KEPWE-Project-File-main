import { calculateIndicators, recentSwing } from './indicators.js';

export const STRATEGY_SLUG = 'nifty-pulse-5m';
export const STRATEGY_NAME = 'Kepwe NIFTY Pulse 5M';
export const DEFAULT_SIGNAL_TARGET_RISK_REWARD = 2;
export const DEFAULT_STRATEGY_CONFIG = {
  instrument: 'NIFTY 50',
  timeframe: '5m',
  riskReward: DEFAULT_SIGNAL_TARGET_RISK_REWARD,
  atrMultiplier: 1.5,
  swingLookback: 5,
  volumeMultiplier: 1,
  minAtrPercent: 0.001,
  rsiLongMin: 55,
  rsiLongMax: 75,
  rsiShortMin: 25,
  rsiShortMax: 45,
  windows: [{ start: '09:30', end: '11:30' }, { start: '13:30', end: '14:45' }],
};

function minutesInTimeZone(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return (hour * 60) + minute;
}

export function isTradingWindowActive(timestamp, windows = DEFAULT_STRATEGY_CONFIG.windows) {
  const current = minutesInTimeZone(timestamp);
  if (current === null) return false;
  return windows.some(({ start, end }) => {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    return current >= (startHour * 60) + startMinute && current <= (endHour * 60) + endMinute;
  });
}

function baseConditions(row, previous, config) {
  const swing = previous;
  const volumeOk = row.volumeAverage20 !== null && row.volume > row.volumeAverage20 * config.volumeMultiplier;
  const atrOk = row.atr14 !== null && row.atr14 > row.close * config.minAtrPercent;
  return {
    trendLong: row.ema9 > row.ema21,
    trendShort: row.ema9 < row.ema21,
    aboveVwap: row.close > row.vwap,
    belowVwap: row.close < row.vwap,
    momentumLong: row.rsi14 !== null && row.rsi14 >= config.rsiLongMin && row.rsi14 <= config.rsiLongMax,
    momentumShort: row.rsi14 !== null && row.rsi14 >= config.rsiShortMin && row.rsi14 <= config.rsiShortMax,
    breakout: swing.high !== null && row.close > swing.high,
    breakdown: swing.low !== null && row.close < swing.low,
    volume: volumeOk,
    volatility: atrOk,
    tradingWindow: isTradingWindowActive(row.timestamp, config.windows),
  };
}

function candidateFromSide(side, row, swing, conditions, config) {
  const atrStop = row.atr14 ? row.atr14 * config.atrMultiplier : 0;
  const swingStop = side === 'BUY' ? swing.low : swing.high;
  const stopLoss = side === 'BUY'
    ? Math.min(swingStop || row.close - atrStop, row.close - atrStop)
    : Math.max(swingStop || row.close + atrStop, row.close + atrStop);
  const distance = Math.abs(row.close - stopLoss);
  const target = calculateTarget({
    side,
    entryPrice: row.close,
    stopLoss,
    riskReward: config.riskReward,
  });
  return {
    signal: side,
    price: row.close,
    stopLoss: Number(stopLoss.toFixed(2)),
    target,
    riskDistance: Number(distance.toFixed(2)),
    conditions,
    generatedAt: row.timestamp,
  };
}

export function calculateTarget({ side, entryPrice, stopLoss, riskReward = DEFAULT_SIGNAL_TARGET_RISK_REWARD }) {
  const entry = Number(entryPrice);
  const stop = Number(stopLoss);
  const rewardMultiple = Number(riskReward);
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(rewardMultiple) || rewardMultiple <= 0) {
    return null;
  }
  const distance = Math.abs(entry - stop);
  if (distance <= 0) return null;
  if ((side === 'BUY' && stop >= entry) || (side === 'SELL' && stop <= entry)) return null;
  const target = side === 'SELL'
    ? entry - (distance * rewardMultiple)
    : entry + (distance * rewardMultiple);
  return Number(target.toFixed(2));
}

export function evaluateSignal(indicators, index = indicators.length - 1, inputConfig = {}) {
  const requestedRiskReward = Number(inputConfig.riskReward);
  const config = {
    ...DEFAULT_STRATEGY_CONFIG,
    ...inputConfig,
    riskReward: Number.isFinite(requestedRiskReward) && requestedRiskReward > 0
      ? requestedRiskReward
      : DEFAULT_STRATEGY_CONFIG.riskReward,
  };
  const row = indicators[index];
  if (!row || index < 1) return { signal: 'NO_TRADE', reason: 'Insufficient candle history', conditions: {} };
  const swing = recentSwing(indicators, index, config.swingLookback);
  const conditions = baseConditions(row, swing, config);
  const longPass = conditions.trendLong && conditions.aboveVwap && conditions.momentumLong
    && conditions.breakout && conditions.volume && conditions.volatility && conditions.tradingWindow;
  const shortPass = conditions.trendShort && conditions.belowVwap && conditions.momentumShort
    && conditions.breakdown && conditions.volume && conditions.volatility && conditions.tradingWindow;
  if (longPass) return candidateFromSide('BUY', row, swing, conditions, config);
  if (shortPass) return candidateFromSide('SELL', row, swing, conditions, config);
  const failed = Object.entries(conditions).filter(([, value]) => !value).map(([key]) => key);
  return {
    signal: 'NO_TRADE',
    price: row.close,
    generatedAt: row.timestamp,
    conditions,
    reason: failed.length ? `Conditions not met: ${failed.join(', ')}` : 'No directional setup',
  };
}

export function generateSignal(rawCandles, index, config) {
  const indicators = calculateIndicators(rawCandles);
  return { ...evaluateSignal(indicators, index ?? indicators.length - 1, config), indicators };
}