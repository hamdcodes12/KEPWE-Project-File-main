export const RISK_OPTIONS = [0.5, 1, 2, 5];

const roundDownToLot = (quantity, lotSize = 1) => Math.floor(quantity / lotSize) * lotSize;

export function riskAmount(settings) {
  return Number(settings.tradingCapital || 0) * (Number(settings.riskPerTrade || 1) / 100);
}

export function maxDailyLoss(settings) {
  const configured = Number(settings.dailyLossLimit || 0);
  return configured > 0 ? configured : riskAmount(settings) * 2;
}

export function sizePosition({ entryPrice, stopLoss, settings, lotSize = 1, availableMargin = Infinity, brokerLimit = Infinity, exposureLimit = Infinity }) {
  const entry = Number(entryPrice);
  const stop = Number(stopLoss);
  const distance = Math.abs(Number(entryPrice) - Number(stopLoss));
  const amount = riskAmount(settings);
  if (!Number.isFinite(entry) || entry <= 0) return { quantity: 0, riskAmount: amount, distance, reason: 'Entry price must be positive' };
  if (!Number.isFinite(stop) || stop <= 0 || !Number.isFinite(distance) || distance <= 0) {
    return { quantity: 0, riskAmount: amount, distance, reason: 'Stop-loss distance must be positive' };
  }
  if (!Number.isFinite(Number(lotSize)) || Number(lotSize) <= 0) {
    return { quantity: 0, riskAmount: amount, distance, reason: 'Lot size must be positive' };
  }
  const rawQuantity = amount / distance;
  const quantity = Math.min(roundDownToLot(rawQuantity, lotSize), brokerLimit, exposureLimit, Math.floor(Number(availableMargin) / entry));
  if (quantity < lotSize) return { quantity: 0, riskAmount: amount, distance, reason: 'Capital or margin is insufficient for the minimum lot size' };
  return { quantity, riskAmount: amount, distance, reason: null };
}

export function evaluateRisk({ candidate, settings, stats = {}, existingPosition = false, brokerHealthy = true, systemHealthy = true, duplicateOrder = false, slippage = 0, maxSlippage = Infinity, lotSize = 1, availableMargin = Infinity, brokerLimit = Infinity, exposureLimit = Infinity }) {
  const checks = {
    riskConfigured: riskAmount(settings) > 0,
    noDailyRiskLimit: Number(stats.dailyLoss || 0) < maxDailyLoss(settings),
    maxTrades: Number(stats.todayTrades || 0) < Number(settings.maxTradesPerDay ?? 3),
    consecutiveLosses: Number(stats.consecutiveLosses || 0) < Number(settings.maxConsecutiveLosses ?? 2),
    noExistingPosition: !existingPosition,
    brokerHealthy,
    systemHealthy,
    noDuplicateOrder: !duplicateOrder,
    slippageWithinLimit: Number(slippage) <= Number(maxSlippage),
  };
  const sizing = candidate?.signal && candidate.signal !== 'NO_TRADE'
     ? sizePosition({ entryPrice: candidate.price, stopLoss: candidate.stopLoss, settings, lotSize, availableMargin, brokerLimit, exposureLimit })
    : { quantity: 0, reason: 'No trade candidate' };
  checks.positionSize = sizing.quantity > 0;
  const approved = candidate?.signal !== 'NO_TRADE' && Object.values(checks).every(Boolean);
  return {
    approved,
    checks,
    sizing,
    maxDailyLoss: maxDailyLoss(settings),
    riskAmount: riskAmount(settings),
    reason: approved ? null : Object.entries(checks).filter(([, pass]) => !pass).map(([key]) => key).join(', ') || sizing.reason,
  };
}