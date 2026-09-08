const IST_TIME_ZONE = 'Asia/Kolkata';
const DEFAULT_END_OF_DAY = '15:15';

function minutesInIst(timestamp) {
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
  return (hour * 60) + minute;
}

function parseTime(value) {
  const [hour, minute] = String(value || DEFAULT_END_OF_DAY).split(':').map(Number);
  return (hour * 60) + minute;
}

export function isEndOfDay(timestamp, endOfDay = DEFAULT_END_OF_DAY) {
  const current = minutesInIst(timestamp);
  return current !== null && current >= parseTime(endOfDay);
}

/**
 * Resolve a paper exit from candle extremes. When a candle touches both
 * protective levels, the stop wins because assuming the target would make
 * historical results unrealistically optimistic.
 */
export function resolvePaperExit({
  side,
  low,
  high,
  close,
  stopLoss,
  target,
  timestamp,
  endOfDay = DEFAULT_END_OF_DAY,
  forceClose = false,
}) {
  const isLong = side === 'BUY';
  const hitStop = stopLoss != null && (isLong ? Number(low) <= Number(stopLoss) : Number(high) >= Number(stopLoss));
  const hitTarget = target != null && (isLong ? Number(high) >= Number(target) : Number(low) <= Number(target));

  if (hitStop) return { exitPrice: Number(stopLoss), reason: 'STOP_LOSS' };
  if (hitTarget) return { exitPrice: Number(target), reason: 'TARGET' };
  if (forceClose || isEndOfDay(timestamp, endOfDay)) {
    return { exitPrice: Number(close), reason: 'END_OF_DAY' };
  }
  return null;
}

export function calculatePaperPnl({
  side,
  entryPrice,
  exitPrice,
  quantity,
  entrySlippage = 0,
  entryCharges = 0,
  exitSlippage = 0,
  exitCharges = 0,
}) {
  const direction = side === 'BUY' ? 1 : -1;
  const grossPnl = (Number(exitPrice) - Number(entryPrice)) * Number(quantity) * direction;
  const slippage = Number(entrySlippage) + Number(exitSlippage);
  const charges = Number(entryCharges) + Number(exitCharges);
  return {
    grossPnl,
    slippage,
    charges,
    pnl: grossPnl - slippage - charges,
  };
}

export function exitCosts({ exitPrice, quantity, slippageBps = 2, chargesBps = 5 }) {
  const notional = Number(exitPrice) * Number(quantity);
  return {
    slippage: notional * (Number(slippageBps) / 10000),
    charges: notional * (Number(chargesBps) / 10000),
  };
}

export function positionKey(position) {
  return `${position.instrument || position.symbol}:${position.side}`;
}

export const PAPER_END_OF_DAY = DEFAULT_END_OF_DAY;