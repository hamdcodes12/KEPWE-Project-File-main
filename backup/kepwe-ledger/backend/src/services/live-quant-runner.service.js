import { randomUUID } from 'crypto';
import { createAndSubmitOrder } from '../algo/oms.js';
import { evaluateRisk } from '../algo/risk-engine.js';
import {
  NIFTY_SCALPING_STRATEGY,
  confirmNiftyScalpingEntry,
  enrichNiftyScalpingCandles,
  evaluateNiftyScalpingSignal,
  selectNiftyScalpingOption,
} from './nifty-scalping-strategy.service.js';
import { tryCreateQuantNotification } from './quant-notification.service.js';
import { getAngelOneSession, isAngelOneSessionError, markAngelOneSessionExpired } from './angel-one-session.service.js';
import { fetchNiftyIndexQuote } from './angel-one-market-feed.service.js';
import { fetchNiftyOptionChain } from './angel-one-option-chain.service.js';

const BROKER = 'ANGEL_ONE';
let running = false;

function istDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

function timestampMs(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function isFreshMarketTimestamp(value, now = Date.now(), maxAgeMs = 90_000) {
  const timestamp = timestampMs(value);
  return timestamp !== null && timestamp <= now && now - timestamp <= maxAgeMs;
}

/**
 * Keeps only candles whose interval has fully elapsed. Angel One includes the
 * still-forming candle in getCandleData; the strategy must never see it.
 */
export function completedCandles(candles, intervalMinutes, now = Date.now()) {
  if (!Array.isArray(candles)) return [];
  return candles
    .filter((candle) => candle && [candle.open, candle.high, candle.low, candle.close].every((value) => Number.isFinite(Number(value))))
    .map((candle) => ({ ...candle, volume: Number(candle.volume) || 0 }))
    .filter((candle) => new Date(candle.timestamp).getTime() + (intervalMinutes * 60 * 1000) <= now)
    .map((candle) => ({ ...candle, completed: true }));
}

/** NIFTY index candles (completed only) from SmartAPI getCandleData. */
export async function fetchNiftyCandles(adapter, instrument, intervalMinutes, lookbackDays, now = Date.now()) {
  const raw = await adapter.getHistoricalData({
    exchange: instrument.exchange,
    symbolToken: instrument.symbolToken,
    interval: `${intervalMinutes}m`,
    fromDate: `${istDate(-lookbackDays)} 09:15`,
    toDate: new Date(now),
  });
  return { received: raw.length, candles: completedCandles(raw, intervalMinutes, now) };
}

async function deploymentGatePassed(pool, userId) {
  const result = await pool.query(
    `SELECT event_type, gate_checks FROM quant_deployment_events
     WHERE user_id = $1
       AND event_type = 'DEPLOYMENT_VALIDATED'
     ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  const checks = result.rows[0]?.gate_checks;
  return checks && Object.keys(checks).length > 0 && Object.values(checks).every((check) => check?.passed === true);
}

async function riskStats(pool, userId) {
  const result = await pool.query(
    `SELECT traded_at, pnl FROM algo_trades
     WHERE user_id = $1 AND status = 'LIVE'
     ORDER BY traded_at DESC LIMIT 100`,
    [userId],
  );
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = result.rows.filter((row) => new Date(row.traded_at).toISOString().slice(0, 10) === today);
  let consecutiveLosses = 0;
  for (const row of result.rows) {
    if (Number(row.pnl) < 0) consecutiveLosses += 1;
    else if (Number(row.pnl) > 0) break;
  }
  return {
    todayTrades: todayRows.length,
    dailyLoss: Math.max(0, -todayRows.reduce((sum, row) => sum + Number(row.pnl || 0), 0)),
    consecutiveLosses,
  };
}

function brokerErrorDetails(error) {
  return {
    category: error?.angelCategory || null,
    brokerHttpStatus: error?.httpStatus ?? null,
    brokerErrorCode: error?.providerErrorCode ?? null,
  };
}

async function processUser(pool, userId) {
  const correlationId = randomUUID();
  const strategyResult = await pool.query(
    `SELECT id FROM quant_strategies
     WHERE user_id = $1 AND slug = $2
     ORDER BY updated_at DESC LIMIT 1`,
    [userId, NIFTY_SCALPING_STRATEGY.slug],
  );
  const strategyId = strategyResult.rows[0]?.id || null;
  const logStage = (stage, status, reason, metadata = {}) => recordLiveStage(pool, userId, stage, status, reason, {
    ...metadata,
    strategyId,
    correlationId,
  });

  if (!(await deploymentGatePassed(pool, userId))) {
    await logStage('DEPLOYMENT_GATE', 'FAIL', 'Latest deployment validation is missing or has a failed check.');
    await pool.query(`UPDATE algo_states SET status = 'STOPPED', updated_at = NOW() WHERE user_id = $1 AND status = 'ACTIVE'`, [userId]);
    await tryCreateQuantNotification(pool, {
      userId,
      type: 'LIVE_TRADING_STOPPED',
      title: 'Live Quant trading stopped',
      body: 'Live deployment validation is not currently passing. Resolve the reported gate blockers before restarting.',
      data: { reason: 'DEPLOYMENT_GATE_NOT_PASSED' },
    });
    return;
  }

  const session = await getAngelOneSession(pool, userId);
  if (!session.adapter || session.row.status !== 'CONNECTED') {
    await logStage('BROKER_SESSION', 'FAIL', session.reason === 'SESSION_EXPIRED'
      ? 'The Angel One session has expired; reconnect the account.'
      : 'No verified LIVE Angel One account is available.');
    return;
  }
  const { adapter, row } = session;
  try {
    await adapter.validateSession();
  } catch (error) {
    if (isAngelOneSessionError(error)) await markAngelOneSessionExpired(pool, row.id);
    await logStage('BROKER_SESSION', 'FAIL', `Angel One session validation failed: ${error.message}`, brokerErrorDetails(error));
    throw error;
  }
  await logStage('BROKER_SESSION', 'PASS', 'Angel One session validated.');

  let niftyInstrument;
  let liveQuote;
  try {
    const feed = await fetchNiftyIndexQuote(adapter);
    niftyInstrument = feed.instrument;
    liveQuote = { ltp: feed.quote?.price ?? null, ltt: feed.quote?.ltt ?? null, fresh: feed.fresh };
  } catch (error) {
    await logStage('LIVE_DATA', 'FAIL', `Angel One market data unavailable: ${error.message}`, brokerErrorDetails(error));
    return;
  }
  const niftyToken = niftyInstrument.symbolToken;
  if (!liveQuote.ltp || !liveQuote.fresh) {
    await logStage('LIVE_DATA', 'FAIL', 'Angel One NIFTY quote is missing LTP or has a stale/future exchange timestamp.', { symbolToken: niftyToken, ltp: liveQuote.ltp, ltt: liveQuote.ltt });
    return;
  }
  await logStage('NIFTY_LTP_RECEIVED', 'PASS', 'Fresh NIFTY LTP received from Angel One.', { symbolToken: niftyToken, ltp: liveQuote.ltp });
  await logStage('NIFTY_LTT_RECEIVED', 'PASS', 'Fresh NIFTY exchange timestamp received from Angel One.', { symbolToken: niftyToken, ltt: liveQuote.ltt });

  const fiveMinute = await fetchNiftyCandles(adapter, niftyInstrument, 5, 7);
  const indexCandles = fiveMinute.candles;
  await logStage('CANDLE_5M_RECEIVED', 'PASS', 'Angel One returned NIFTY 5-minute candle data.', { symbolToken: niftyToken, count: fiveMinute.received });
  if (indexCandles.length < 55) {
    await logStage('CANDLE_5M_COMPLETED', 'FAIL', 'Fewer than 55 completed NIFTY 5-minute candles are available.', { count: indexCandles.length });
    return;
  }
  const last5m = indexCandles.at(-1);
  await logStage('CANDLE_5M_COMPLETED', 'PASS', 'Completed NIFTY 5-minute candle is ready.', { ...last5m, count: indexCandles.length });

  const enriched = enrichNiftyScalpingCandles(indexCandles);
  const index = enriched.length - 1;
  const signal = evaluateNiftyScalpingSignal(enriched, index);
  await logStage('STRATEGY_EVALUATION', 'PASS', signal.reason || signal.signal, { signal: signal.signal, regime: signal.regime || null, candleAt: indexCandles[index].timestamp });
  if (!['BUY_CE', 'BUY_PE'].includes(signal.signal)) {
    await logStage('SIGNAL_NOT_GENERATED', 'WAITING', `NO SIGNAL - STRATEGY CONDITIONS NOT MET: ${signal.reason}`, { candleAt: indexCandles[index].timestamp });
    return;
  }
  await logStage('SIGNAL_GENERATED', 'PASS', `${signal.signal} generated by the existing KEPWE strategy.`, { signal: signal.signal, candleAt: indexCandles[index].timestamp });

  const oneMinute = await fetchNiftyCandles(adapter, niftyInstrument, 1, 0);
  await logStage('CANDLE_1M_RECEIVED', 'PASS', 'Angel One returned NIFTY 1-minute confirmation data.', { symbolToken: niftyToken, count: oneMinute.received });
  const last1m = oneMinute.candles.at(-1);
  if (!last1m) {
    await logStage('CANDLE_1M_COMPLETED', 'FAIL', 'No completed NIFTY 1-minute confirmation candle is available.');
    return;
  }
  await logStage('CANDLE_1M_COMPLETED', 'PASS', 'Completed NIFTY 1-minute confirmation candle is ready.', last1m);
  const confirmation = confirmNiftyScalpingEntry(signal, last1m);
  if (!confirmation.confirmed) {
    await logStage('SIGNAL_NOT_GENERATED', 'WAITING', `1-minute confirmation not met: ${confirmation.reason}`);
    return;
  }

  // The option chain is fetched last so the chosen contract's quote is current.
  let chain;
  try {
    chain = await fetchNiftyOptionChain(adapter, { spotPrice: liveQuote.ltp });
  } catch (error) {
    if (isAngelOneSessionError(error)) throw error;
    await logStage('OPTION_CONTRACT', 'FAIL', `Angel One option chain unavailable: ${error.message}`, brokerErrorDetails(error));
    return;
  }
  if (!chain.expiry) {
    await logStage('OPTION_CONTRACT', 'FAIL', 'The Angel One instrument master lists no current NIFTY option expiry.');
    return;
  }
  const instruments = chain.instruments;
  await logStage('OPTION_CONTRACT', instruments.length > 0 ? 'PASS' : 'FAIL', instruments.length > 0 ? 'Angel One option contracts resolved from the official instrument master with live quotes.' : 'No option contract had a live two-sided quote.', { expiry: chain.expiry, contracts: instruments.length, greeksAvailable: chain.greeksAvailable });

  const selected = selectNiftyScalpingOption({
    spotPrice: indexCandles[index].close,
    optionType: signal.regime,
    instruments,
    now: Date.now(),
  });
  if (!selected.contract || !Number.isFinite(selected.contract.lotSize) || selected.contract.lotSize <= 0) {
    await logStage('OPTION_CONTRACT', 'FAIL', selected.reason || 'Selected contract failed strict validation.');
    return;
  }
  const contract = selected.contract;
  await logStage('OPTION_CONTRACT', 'PASS', 'Selected contract passed strict F&O validation.', { symbolToken: contract.securityId, tradingSymbol: contract.tradingSymbol, expiry: contract.expiryDate, strike: contract.strike, optionType: contract.optionType, lotSize: contract.lotSize });

  const signalKey = `${userId}:${indexCandles[index].timestamp}:${contract.securityId}`;
  const existingSignal = await pool.query(
    'SELECT 1 FROM algo_orders WHERE user_id = $1 AND signal_key = $2 LIMIT 1',
    [userId, signalKey],
  );
  if (existingSignal.rows.length > 0) {
    await logStage('OMS', 'BLOCKED', 'Durable signal idempotency blocked a repeat submission.', { symbolToken: contract.securityId, signalKey });
    return;
  }
  await tryCreateQuantNotification(pool, {
    userId,
    type: 'STRATEGY_SIGNAL',
    title: 'NIFTY 50 strategy signal',
    body: `${signal.signal} signal confirmed by the live strategy engine.`,
    data: { instrument: contract.tradingSymbol, symbolToken: contract.securityId, candleAt: indexCandles[index].timestamp },
  });

  const settingsResult = await pool.query('SELECT * FROM algo_settings WHERE user_id = $1', [userId]);
  const settingsRow = settingsResult.rows[0];
  if (!settingsRow) {
    await logStage('RISK_GATE', 'FAIL', 'Authoritative algo_settings row is missing.');
    return;
  }
  const settings = {
    tradingCapital: Number(settingsRow.trading_capital),
    riskPerTrade: Number(settingsRow.risk_per_trade),
    maxTradesPerDay: Number(settingsRow.max_trades_per_day),
    maxConsecutiveLosses: Number(settingsRow.max_consecutive_losses),
    dailyLossLimit: Number(settingsRow.daily_loss_limit),
  };
  const margin = await adapter.getMargin();
  const availableMargin = Number(margin.available);
  const stats = await riskStats(pool, userId);
  const existing = await pool.query(
    `SELECT 1 FROM algo_positions WHERE user_id = $1 AND symbol = $2 AND status = 'OPEN' LIMIT 1`,
    [userId, contract.securityId],
  );
  const duplicate = await pool.query(
    `SELECT 1 FROM algo_orders WHERE user_id = $1 AND instrument = $2
     AND status IN ('CREATED', 'RECOVERY_PENDING', 'SUBMITTED', 'PARTIALLY_FILLED') LIMIT 1`,
    [userId, contract.securityId],
  );
  const risk = evaluateRisk({
    candidate: { signal: signal.signal, price: contract.premium, stopLoss: contract.stop },
    settings,
    stats,
    existingPosition: existing.rows.length > 0,
    brokerHealthy: true,
    systemHealthy: true,
    duplicateOrder: duplicate.rows.length > 0,
    slippage: 0,
    maxSlippage: 2,
    lotSize: contract.lotSize,
    availableMargin,
    // NSE quantity freeze (ANGEL_ONE_NIFTY_FREEZE_QTY); unknown => 0, which blocks the order.
    brokerLimit: Number(contract.quantityFreeze) > 1 ? Number(contract.quantityFreeze) - 1 : 0,
    exposureLimit: Number.MAX_SAFE_INTEGER,
  });
  await logStage('RISK_GATE', risk.approved ? 'PASS' : 'FAIL', risk.reason || (risk.approved ? 'Risk checks passed.' : 'Risk checks rejected the order.'), { checks: risk.checks, quantity: risk.sizing?.quantity || 0 });
  if (!risk.approved) {
    await tryCreateQuantNotification(pool, {
      userId,
      type: 'RISK_REJECTION',
      title: 'NIFTY 50 signal rejected by risk engine',
      body: risk.reason,
      data: { checks: risk.checks },
    });
    return;
  }
  await logStage('OMS', 'PASS', 'Creating and submitting a LIVE OMS order through the Angel One adapter.', { symbolToken: contract.securityId, quantity: risk.sizing.quantity });
  await createAndSubmitOrder({
    pool,
    adapter,
    userId,
    executionMode: 'LIVE',
    instrument: contract.securityId,
    side: 'BUY',
    quantity: risk.sizing.quantity,
    price: 0,
    stopLoss: contract.stop,
    target: contract.target,
    brokerAccountId: row.id,
    metadata: {
      broker: BROKER,
      securityId: contract.securityId,
      symbolToken: contract.securityId,
      tradingSymbol: contract.tradingSymbol,
      exchange: 'NFO',
      exchangeSegment: 'NFO',
      productType: 'INTRADAY',
      orderType: 'MARKET',
      strategy: NIFTY_SCALPING_STRATEGY.slug,
      signalKey,
      expiry: contract.expiryDate,
      optionType: contract.optionType,
      strike: contract.strike,
      lotSize: contract.lotSize,
    },
  });
}

async function recordLiveStage(pool, userId, stage, status, reason, metadata = {}) {
  const timestamp = new Date().toISOString();
  const structured = { userId, timestamp, stage, status, reason, ...metadata };
  await pool.query(
    `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [userId, stage, reason, JSON.stringify(structured)],
  );
  console.log(`[${stage}] ${JSON.stringify(structured)}`);
}

export async function runLiveQuantCycle(pool) {
  if (running) return;
  running = true;
  try {
    const users = await pool.query(`SELECT user_id FROM algo_states WHERE status = 'ACTIVE'`);
    for (const row of users.rows) {
      try {
        await processUser(pool, row.user_id);
      } catch (error) {
        await tryCreateQuantNotification(pool, {
          userId: row.user_id,
          type: isAngelOneSessionError(error) || /expired|unauthorized|session/i.test(error.message) ? 'SESSION_EXPIRED' : 'LIVE_TRADING_STOPPED',
          title: 'Live Quant trading blocked',
          body: error.message,
          data: { strategy: NIFTY_SCALPING_STRATEGY.slug, broker: BROKER },
        });
      }
    }
  } finally {
    running = false;
  }
}
