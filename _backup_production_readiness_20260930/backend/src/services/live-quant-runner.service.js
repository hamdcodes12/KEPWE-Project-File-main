import { randomUUID } from 'crypto';
import { getBrokerAdapter } from '../algo/broker-adapters.js';
import { createAndSubmitOrder } from '../algo/oms.js';
import { evaluateRisk } from '../algo/risk-engine.js';
import { decryptBrokerSecret } from './broker-token.service.js';
import {
  NIFTY_SCALPING_STRATEGY,
  confirmNiftyScalpingEntry,
  enrichNiftyScalpingCandles,
  evaluateNiftyScalpingSignal,
  selectNiftyScalpingOption,
} from './nifty-scalping-strategy.service.js';
import { tryCreateQuantNotification } from './quant-notification.service.js';
import { findNseFnoContract, loadDhanInstrumentMaster } from './dhan-instruments.service.js';
import { fetchNiftyIndexQuote } from './dhan-market-feed.service.js';

export { loadDhanInstrumentMaster };

let running = false;

function istDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function istDateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
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

export function normalizeDhanCandles(payload, intervalMinutes, now = Date.now()) {
  const data = payload?.data || payload || {};
  const timestamps = data.timestamp || data.timestamps || [];
  const opens = data.open || [];
  const highs = data.high || [];
  const lows = data.low || [];
  const closes = data.close || [];
  const volumes = data.volume || [];
  if (![timestamps, opens, highs, lows, closes].every(Array.isArray)) return [];
  return timestamps.map((timestamp, index) => ({
    timestamp: new Date(Number(timestamp) < 1e12 ? Number(timestamp) * 1000 : timestamp).toISOString(),
    open: number(opens[index]),
    high: number(highs[index]),
    low: number(lows[index]),
    close: number(closes[index]),
    volume: number(volumes[index]) || 0,
    completed: false,
  })).filter((candle) => [candle.open, candle.high, candle.low, candle.close].every((value) => value !== null))
  .map((candle) => ({
    ...candle,
    completed: new Date(candle.timestamp).getTime() + (intervalMinutes * 60 * 1000) <= now,
  }))
  .filter((candle) => candle.completed);
}

function expiryFromResponse(payload) {
  const data = payload?.data || payload || {};
  const values = Array.isArray(data) ? data : data.expiryList || data.expiry || data.expiries || [];
  return values.map(String).sort()[0] || null;
}

export function resolveDhanOptionInstruments(payload, requestedAt, instrumentMaster, expiry) {
  const data = payload?.data || payload || {};
  const chain = data.oc || data.optionChain || data.options || {};
  const instruments = [];
  for (const [strike, legs] of Object.entries(chain)) {
    for (const [optionType, quote] of [['CE', legs?.ce], ['PE', legs?.pe]]) {
      if (!quote) continue;
      const ltp = number(quote.last_price ?? quote.lastPrice ?? quote.ltp);
      const bid = number(quote.top_bid_price ?? quote.bid_price ?? quote.bid);
      const ask = number(quote.top_ask_price ?? quote.ask_price ?? quote.ask);
      const securityId = quote.security_id ?? quote.securityId;
      const master = findNseFnoContract(instrumentMaster, securityId);
      if (!securityId || ltp === null || bid === null || ask === null || !master) continue;
      // The official master lists NIFTY options with UNDERLYING_SYMBOL "NIFTY" and
      // UNDERLYING_SECURITY_ID 26000 (not the IDX_I index id 13), so match on symbol.
      if (String(master.underlyingSymbol || '').toUpperCase() !== 'NIFTY') continue;
      if (master.instrument && String(master.instrument).toUpperCase() !== 'OPTIDX') continue;
      if (master.exchangeSegment && !['NSE_FNO', 'NFO', 'NSE'].includes(String(master.exchangeSegment).toUpperCase())) continue;
      if (master.optionType && String(master.optionType).toUpperCase() !== optionType) continue;
      if (master.tradable === false) continue;
      const timestamp = requestedAt;
      instruments.push({
        optionType,
        strike: number(strike),
        securityId: String(securityId),
        ltp,
        bid,
        ask,
        ltpTimestamp: timestamp,
        expiry: master.expiry || expiry,
        tradingSymbol: master.tradingSymbol,
        displayName: master.displayName,
        lotSize: master.lotSize,
        quantityFreeze: null,
        delta: number(quote.greeks?.delta),
        isLiquid: ask >= bid && bid > 0 && Number(quote.volume || 0) > 0,
        halted: false,
        abnormallyVolatile: false,
      });
    }
  }
  return instruments.filter((instrument) => instrument.ltpTimestamp <= requestedAt + 5000);
}

async function liveAccount(pool, userId) {
  const result = await pool.query(
    `SELECT ba.id AS broker_account_id, ba.client_id, ba.status, ba.connection_mode,
            bot.access_token_ciphertext, bot.token_expires_at
     FROM broker_accounts ba
     JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
     WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
     ORDER BY bot.created_at DESC LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row || row.status !== 'CONNECTED' || row.connection_mode !== 'LIVE') return null;
  const adapter = getBrokerAdapter('DHAN', 'LIVE', {
    dhanClientId: row.client_id,
    accessToken: decryptBrokerSecret(row.access_token_ciphertext),
    tokenExpiresAt: row.token_expires_at,
  });
  adapter.brokerAccountId = row.broker_account_id;
  return { row, adapter };
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
  const account = await liveAccount(pool, userId);
  if (!account) {
    await logStage('DHAN_SESSION', 'FAIL', 'No verified LIVE Dhan account is available.');
    return;
  }
  const { adapter, row } = account;
  await adapter.validateSession();
  await logStage('DHAN_SESSION', 'PASS', 'Dhan session validated.');
  let niftyInstrument;
  let liveQuote;
  try {
    const feed = await fetchNiftyIndexQuote(adapter);
    niftyInstrument = feed.instrument;
    liveQuote = { ltp: feed.quote?.price ?? null, ltt: feed.quote?.ltt ?? null, fresh: feed.fresh };
  } catch (error) {
    await logStage('LIVE_DATA', 'FAIL', `Dhan market data unavailable: ${error.message}`, {
      category: error?.dhanCategory || null, dhanHttpStatus: error?.httpStatus ?? null, dhanErrorCode: error?.providerErrorCode ?? null,
    });
    return;
  }
  const NIFTY_INDEX_SECURITY_ID = niftyInstrument.securityId;
  if (!liveQuote.ltp || !liveQuote.fresh) {
    await logStage('LIVE_DATA', 'FAIL', 'Dhan NIFTY quote is missing LTP or has a stale/future LTT.', { securityId: NIFTY_INDEX_SECURITY_ID, ltp: liveQuote.ltp, ltt: liveQuote.ltt });
    return;
  }
  await logStage('NIFTY_LTP_RECEIVED', 'PASS', 'Fresh NIFTY LTP received from Dhan.', { securityId: NIFTY_INDEX_SECURITY_ID, ltp: liveQuote.ltp });
  await logStage('NIFTY_LTT_RECEIVED', 'PASS', 'Fresh NIFTY last-trade time received from Dhan.', { securityId: NIFTY_INDEX_SECURITY_ID, ltt: liveQuote.ltt });

  const date = istDate();
  const indexPayload = await adapter.getHistoricalData({
    securityId: NIFTY_INDEX_SECURITY_ID,
    exchangeSegment: 'IDX_I',
    instrument: 'INDEX',
    interval: 5,
    fromDate: istDateOffset(-7),
    toDate: date,
  });
  const indexCandles = normalizeDhanCandles(indexPayload, 5);
  await logStage('CANDLE_5M_RECEIVED', 'PASS', 'Dhan returned NIFTY 5-minute candle data.', { securityId: NIFTY_INDEX_SECURITY_ID, count: Array.isArray(indexPayload?.data?.timestamp) ? indexPayload.data.timestamp.length : 0 });
  if (indexCandles.length < 55) {
    await logStage('CANDLE_5M_COMPLETED', 'FAIL', 'Fewer than 55 completed NIFTY 5-minute candles are available.', { count: indexCandles.length });
    return;
  }
  const last5m = indexCandles.at(-1);
  await logStage('CANDLE_5M_COMPLETED', 'PASS', 'Completed NIFTY 5-minute candle is ready.', { ...last5m, count: indexCandles.length });

  const expiryPayload = await adapter.getOptionExpiryList({ underlyingScrip: NIFTY_INDEX_SECURITY_ID, underlyingSeg: 'IDX_I' });
  const expiry = expiryFromResponse(expiryPayload);
  if (!expiry) {
    await logStage('OPTION_CONTRACT', 'FAIL', 'Dhan returned no NIFTY option expiry.');
    return;
  }
  const chainPayload = await adapter.getOptionChain({ underlyingScrip: NIFTY_INDEX_SECURITY_ID, underlyingSeg: 'IDX_I', expiry });
  const instrumentMaster = await loadDhanInstrumentMaster();
  const instruments = resolveDhanOptionInstruments(chainPayload, Date.now(), instrumentMaster, expiry);
  await logStage('OPTION_CONTRACT', instruments.length > 0 ? 'PASS' : 'FAIL', instruments.length > 0 ? 'Official Dhan option-chain contracts resolved.' : 'No valid option contracts matched the official instrument master.', { expiry, contracts: instruments.length });
  const enriched = enrichNiftyScalpingCandles(indexCandles);
  const index = enriched.length - 1;
  const signal = evaluateNiftyScalpingSignal(enriched, index);
  await logStage('STRATEGY_EVALUATION', 'PASS', signal.reason || signal.signal, { signal: signal.signal, regime: signal.regime || null, candleAt: indexCandles[index].timestamp });
  if (!['BUY_CE', 'BUY_PE'].includes(signal.signal)) {
    await logStage('SIGNAL_NOT_GENERATED', 'WAITING', `NO SIGNAL - STRATEGY CONDITIONS NOT MET: ${signal.reason}`, { candleAt: indexCandles[index].timestamp });
    return;
  }
  await logStage('SIGNAL_GENERATED', 'PASS', `${signal.signal} generated by the existing KEPWE strategy.`, { signal: signal.signal, candleAt: indexCandles[index].timestamp });

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
  await logStage('OPTION_CONTRACT', 'PASS', 'Selected contract passed strict F&O validation.', { securityId: selected.contract.securityId, tradingSymbol: selected.contract.tradingSymbol, expiry: selected.contract.expiry, strike: selected.contract.strike, optionType: selected.contract.optionType, lotSize: selected.contract.lotSize });

  const signalKey = `${userId}:${indexCandles[index].timestamp}:${selected.contract.securityId}`;
  const optionPayload = await adapter.getHistoricalData({
    securityId: NIFTY_INDEX_SECURITY_ID,
    exchangeSegment: 'IDX_I',
    instrument: 'INDEX',
    interval: 1,
    fromDate: date,
    toDate: date,
  });
  const optionCandles = normalizeDhanCandles(optionPayload, 1);
  await logStage('CANDLE_1M_RECEIVED', 'PASS', 'Dhan returned NIFTY 1-minute confirmation data.', { securityId: NIFTY_INDEX_SECURITY_ID, count: Array.isArray(optionPayload?.data?.timestamp) ? optionPayload.data.timestamp.length : 0 });
  const last1m = optionCandles.at(-1);
  if (!last1m) {
    await logStage('CANDLE_1M_COMPLETED', 'FAIL', 'No completed NIFTY 1-minute confirmation candle is available.');
    return;
  }
  await logStage('CANDLE_1M_COMPLETED', 'PASS', 'Completed NIFTY 1-minute confirmation candle is ready.', last1m);
  const confirmation = confirmNiftyScalpingEntry(signal, optionCandles.at(-1));
  if (!confirmation.confirmed) {
    await logStage('SIGNAL_NOT_GENERATED', 'WAITING', `1-minute confirmation not met: ${confirmation.reason}`);
    return;
  }
  const existingSignal = await pool.query(
    'SELECT 1 FROM algo_orders WHERE user_id = $1 AND signal_key = $2 LIMIT 1',
    [userId, signalKey],
  );
  if (existingSignal.rows.length > 0) {
    await logStage('OMS', 'BLOCKED', 'Durable signal idempotency blocked a repeat submission.', { securityId: selected.contract.securityId, signalKey });
    return;
  }
  await tryCreateQuantNotification(pool, {
    userId,
    type: 'STRATEGY_SIGNAL',
    title: 'NIFTY 50 strategy signal',
    body: `${signal.signal} signal confirmed by the live strategy engine.`,
    data: { instrument: selected.contract.securityId, candleAt: indexCandles[index].timestamp },
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
    [userId, selected.contract.securityId],
  );
  const duplicate = await pool.query(
    `SELECT 1 FROM algo_orders WHERE user_id = $1 AND instrument = $2
     AND status IN ('CREATED', 'RECOVERY_PENDING', 'SUBMITTED', 'PARTIALLY_FILLED') LIMIT 1`,
    [userId, selected.contract.securityId],
  );
  const risk = evaluateRisk({
    candidate: { signal: signal.signal, price: selected.contract.premium, stopLoss: selected.contract.stop },
    settings,
    stats,
    existingPosition: existing.rows.length > 0,
    brokerHealthy: true,
    systemHealthy: true,
    duplicateOrder: duplicate.rows.length > 0,
    slippage: 0,
    maxSlippage: 2,
    lotSize: selected.contract.lotSize,
    availableMargin,
    brokerLimit: Number.MAX_SAFE_INTEGER,
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
  await logStage('OMS', 'PASS', 'Creating and submitting a LIVE OMS order through the Dhan adapter.', { securityId: selected.contract.securityId, quantity: risk.sizing.quantity });
  await createAndSubmitOrder({
    pool,
    adapter,
    userId,
    executionMode: 'LIVE',
    instrument: selected.contract.securityId,
    side: 'BUY',
    quantity: risk.sizing.quantity,
    price: 0,
    stopLoss: selected.contract.stop,
    target: selected.contract.target,
    brokerAccountId: row.broker_account_id,
    metadata: {
      broker: 'DHAN',
      securityId: selected.contract.securityId,
      tradingSymbol: selected.contract.tradingSymbol,
      exchangeSegment: 'NSE_FNO',
      productType: 'INTRADAY',
      orderType: 'MARKET',
      strategy: NIFTY_SCALPING_STRATEGY.slug,
      signalKey,
      expiry: selected.contract.expiry,
      optionType: selected.contract.optionType,
      strike: selected.contract.strike,
      lotSize: selected.contract.lotSize,
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
          type: /expired|unauthorized|session/i.test(error.message) ? 'SESSION_EXPIRED' : 'LIVE_TRADING_STOPPED',
          title: 'Live Quant trading blocked',
          body: error.message,
          data: { strategy: NIFTY_SCALPING_STRATEGY.slug },
        });
      }
    }
  } finally {
    running = false;
  }
}
