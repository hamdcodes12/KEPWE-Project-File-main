function normalizePosition(position) {
  return {
    instrument: position.instrument || position.symbol,
    side: position.side,
    quantity: Number(position.quantity || 0),
    entryPrice: Number(position.entryPrice ?? position.entry_price ?? 0),
  };
}

export function comparePositions(internalPositions = [], brokerPositions = []) {
  const internal = new Map(internalPositions.map((position) => {
    const normalized = normalizePosition(position);
    return [`${normalized.instrument}:${normalized.side}`, normalized];
  }));
  const broker = new Map(brokerPositions.map((position) => {
    const normalized = normalizePosition(position);
    return [`${normalized.instrument}:${normalized.side}`, normalized];
  }));
  const keys = new Set([...internal.keys(), ...broker.keys()]);
  const mismatches = [];

  for (const key of keys) {
    const expected = internal.get(key);
    const actual = broker.get(key);
    if (!expected || !actual) {
      mismatches.push({ key, expected: expected || null, actual: actual || null, reason: 'POSITION_MISSING_ON_ONE_SIDE' });
      continue;
    }
    if (expected.quantity !== actual.quantity) {
      mismatches.push({ key, expected, actual, reason: 'QUANTITY_MISMATCH' });
    }
  }

  return {
    matched: mismatches.length === 0,
    mismatches,
    checked: keys.size,
  };
}

export function comparePaperLedgers(paperTrades = [], algoPositions = []) {
  return comparePositions(
    paperTrades.map((trade) => ({
      instrument: trade.instrument,
      side: trade.side,
      quantity: trade.quantity,
      entryPrice: trade.entryPrice ?? trade.entry_price,
    })),
    algoPositions.map((position) => ({
      instrument: position.instrument || position.symbol,
      side: position.side,
      quantity: position.quantity,
      entryPrice: position.entryPrice ?? position.entry_price,
    }))
  );
}

export function killSwitchReasons({
  dailyLoss = 0,
  maxDailyLoss = Infinity,
  consecutiveLosses = 0,
  maxConsecutiveLosses = 2,
  marketDataConnected = true,
  brokerConnected = true,
  positionMismatch = false,
  duplicateOrder = false,
  excessiveSlippage = false,
  abnormalExecution = false,
  systemHealthy = true,
} = {}) {
  const reasons = [];
  if (Number(dailyLoss) >= Number(maxDailyLoss)) reasons.push('DAILY_LOSS_LIMIT');
  if (Number(consecutiveLosses) >= Number(maxConsecutiveLosses)) reasons.push('CONSECUTIVE_LOSS_LIMIT');
  if (!marketDataConnected) reasons.push('MARKET_DATA_DISCONNECT');
  if (!brokerConnected) reasons.push('BROKER_DISCONNECT');
  if (positionMismatch) reasons.push('POSITION_MISMATCH');
  if (duplicateOrder) reasons.push('DUPLICATE_ORDER');
  if (excessiveSlippage) reasons.push('EXCESSIVE_SLIPPAGE');
  if (abnormalExecution) reasons.push('ABNORMAL_EXECUTION');
  if (!systemHealthy) reasons.push('SYSTEM_HEALTH_FAILURE');
  return reasons;
}