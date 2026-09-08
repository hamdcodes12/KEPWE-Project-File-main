const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizeCandle(candle) {
  return {
    timestamp: candle.timestamp || candle.time || candle.date,
    open: number(candle.open),
    high: number(candle.high),
    low: number(candle.low),
    close: number(candle.close),
    volume: number(candle.volume),
  };
}

export function ema(values, period) {
  const result = [];
  const multiplier = 2 / (period + 1);
  let previous = null;
  for (const value of values) {
    previous = previous === null ? value : ((value - previous) * multiplier) + previous;
    result.push(previous);
  }
  return result;
}

export function vwap(candles) {
  let cumulativeVolume = 0;
  let cumulativeValue = 0;
  return candles.map((candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3;
    cumulativeVolume += candle.volume;
    cumulativeValue += typical * candle.volume;
    return cumulativeVolume > 0 ? cumulativeValue / cumulativeVolume : typical;
  });
}

export function rsi(values, period = 14) {
  const result = values.map(() => null);
  let gains = 0;
  let losses = 0;
  for (let index = 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    if (index <= period) {
      gains += gain;
      losses += loss;
      if (index === period) {
        const averageGain = gains / period;
        const averageLoss = losses / period;
        result[index] = averageLoss === 0 ? 100 : 100 - (100 / (1 + averageGain / averageLoss));
      }
      continue;
    }
    gains = ((gains * (period - 1)) + gain) / period;
    losses = ((losses * (period - 1)) + loss) / period;
    result[index] = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
  }
  return result;
}

export function atr(candles, period = 14) {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  });
  const result = trueRanges.map(() => null);
  let total = 0;
  for (let index = 0; index < trueRanges.length; index += 1) {
    total += trueRanges[index];
    if (index === period - 1) result[index] = total / period;
    if (index >= period) {
      result[index] = ((result[index - 1] * (period - 1)) + trueRanges[index]) / period;
    }
  }
  return result;
}

export function rollingAverage(values, period) {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const slice = values.slice(index - period + 1, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

export function calculateIndicators(rawCandles) {
  const candles = rawCandles.map(normalizeCandle);
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const anchoredVwap = vwap(candles);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(candles, 14);
  const volumeAverage20 = rollingAverage(volumes, 20);
  return candles.map((candle, index) => ({
    ...candle,
    ema9: ema9[index],
    ema21: ema21[index],
    vwap: anchoredVwap[index],
    rsi14: rsi14[index],
    atr14: atr14[index],
    volumeAverage20: volumeAverage20[index],
  }));
}

export function recentSwing(candles, index, lookback = 5) {
  const start = Math.max(0, index - lookback);
  const history = candles.slice(start, index);
  return {
    high: history.length ? Math.max(...history.map((candle) => candle.high)) : null,
    low: history.length ? Math.min(...history.map((candle) => candle.low)) : null,
  };
}