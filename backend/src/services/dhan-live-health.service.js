import { getBrokerAdapter, normalizeBrokerExecution } from '../algo/broker-adapters.js';
import { normalizeExecutionStatus } from '../algo/oms.js';
import { decryptBrokerSecret } from './broker-token.service.js';
import { evaluateRisk } from '../algo/risk-engine.js';
import {
  enrichNiftyScalpingCandles,
  evaluateNiftyScalpingSignal,
  selectNiftyScalpingOption,
} from './nifty-scalping-strategy.service.js';
import {
  normalizeDhanCandles,
  resolveDhanOptionInstruments,
} from './live-quant-runner.service.js';
import { loadDhanInstrumentMaster } from './dhan-instruments.service.js';
import { getDhanMarketFeed } from './dhan-market-feed.service.js';

// Read-only: this health check never places, modifies or cancels an order.

function check(passed, message, details = {}, failStatus = null) {
  return {
    passed: Boolean(passed),
    status: passed ? 'PASS' : (failStatus || 'FAIL'),
    message,
    details,
  };
}

function candlesFromPayload(payload) {
  const data = payload?.data || payload || {};
  return Array.isArray(data.timestamp || data.timestamps)
    && Array.isArray(data.open)
    && Array.isArray(data.high)
    && Array.isArray(data.low)
    && Array.isArray(data.close);
}

function istDateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

function dhanErrorDetails(error) {
  return {
    category: error?.dhanCategory || null,
    dhanHttpStatus: error?.httpStatus ?? null,
    dhanErrorCode: error?.providerErrorCode ?? null,
  };
}

const DATA_DEPENDENT_CHECKS = [
  'niftyCandleParsing',
  'oneMinuteConfirmationCandle',
  'optionChainContractResolution',
  'strategySignalPipeline',
  'riskEngine',
  'orderRequestConstruction',
];

export async function runDhanLiveHealthCheck(pool, userId) {
  const checks = {};
  const blockers = [];
  const add = (name, result) => {
    checks[name] = result;
    if (!result.passed) blockers.push({ check: name, blocker: result.message, status: result.status, details: result.details });
  };
  const attempt = async (name, fn) => {
    try {
      await fn();
    } catch (error) {
      add(name, check(false, `${name} failed: ${error.message}`, dhanErrorDetails(error)));
    }
  };

  let adapter;
  let broker;
  try {
    const result = await pool.query(
      `SELECT ba.id, ba.client_id, ba.status, ba.connection_mode,
              bot.access_token_ciphertext, bot.token_expires_at
       FROM broker_accounts ba
       JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
       WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
       ORDER BY bot.created_at DESC LIMIT 1`,
      [userId],
    );
    broker = result.rows[0];
    const usable = Boolean(broker?.access_token_ciphertext && broker.status === 'CONNECTED' && broker.connection_mode === 'LIVE');
    add('dhanAuthentication', check(
      usable,
      usable ? 'A connected LIVE Dhan account and stored token are present.' : 'A connected LIVE Dhan account and token are required.',
      { brokerStatus: broker?.status || 'DISCONNECTED', connectionMode: broker?.connection_mode || null },
      'BLOCKED',
    ));
    if (usable) {
      adapter = getBrokerAdapter('DHAN', 'LIVE', {
        dhanClientId: broker.client_id,
        accessToken: decryptBrokerSecret(broker.access_token_ciphertext),
        tokenExpiresAt: broker.token_expires_at,
      });
    }
  } catch (error) {
    add('dhanAuthentication', check(false, `Dhan account lookup failed: ${error.message}`, {}, 'FAIL'));
  }

  if (!adapter) {
    return {
      ready: false,
      status: checks.dhanAuthentication?.status === 'FAIL' ? 'FAIL' : 'BLOCKED',
      code: checks.dhanAuthentication?.status === 'FAIL' ? 'QUANT_HEALTH_CHECK_FAILED' : 'DHAN_NOT_CONNECTED',
      checks,
      blockers,
      orderPlaced: false,
      readOnly: true,
      timestamp: new Date().toISOString(),
    };
  }

  // 1. Broker session (Dhan /v2/profile + fundlimit). Independent of market data.
  let funds = null;
  try {
    const [profile, margin] = await Promise.all([adapter.getProfile(), adapter.getMargin()]);
    funds = margin;
    add('dhanSession', check(true, 'Dhan /v2/profile and fundlimit accepted the stored session.'));
    const identityOk = String(profile?.clientId || '') === String(broker.client_id || '');
    add('clientIdentity', check(identityOk, identityOk ? 'Dhan profile client ID matches the stored client ID.' : 'Dhan profile identity does not match the stored client ID.'));
    const marginOk = Number.isFinite(Number(funds?.available)) && Number(funds.available) >= 0;
    add('fundsMargin', check(marginOk, marginOk ? 'Dhan fundlimit returned usable available margin.' : 'Dhan fundlimit did not return usable margin.', { availableMargin: Number(funds?.available) }));
  } catch (error) {
    add('dhanSession', check(false, `Dhan session check failed: ${error.message}`, dhanErrorDetails(error), error?.code === 'BROKER_SESSION_EXPIRED' ? 'SESSION_EXPIRED' : 'FAIL'));
    return {
      ready: false,
      status: 'FAIL',
      code: error?.code === 'BROKER_SESSION_EXPIRED' ? 'DHAN_SESSION_EXPIRED' : 'QUANT_HEALTH_CHECK_FAILED',
      checks,
      blockers,
      orderPlaced: false,
      readOnly: true,
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Market data through the same verified feed as /api/quant/live-market.
  const feed = await getDhanMarketFeed(pool, userId, { maxAgeMs: 0 });
  const md = feed.marketData;
  const mdDetails = {
    marketDataStatus: md.status,
    dataPlan: md.dataPlan ?? null,
    dataValidity: md.dataValidity ?? null,
    instrument: md.instrument || null,
    dhanHttpStatus: md.dhanHttpStatus ?? null,
    dhanErrorCode: md.dhanErrorCode ?? null,
  };
  add('dhanDataPlan', check(
    md.dataPlanActive !== false,
    md.dataPlanActive === false
      ? `Dhan reports Data API plan "${md.dataPlan}" (validity ${md.dataValidity ?? 'n/a'}); live market data requires an active Dhan Data API plan.`
      : `Dhan Data API plan: ${md.dataPlan ?? 'not reported'}.`,
    mdDetails,
    'DATA_API_NOT_ACTIVE',
  ));
  const priceOk = Number.isFinite(md.price) && md.price > 0;
  add('liveNiftyLtp', check(priceOk, priceOk ? `Dhan returned NIFTY 50 LTP ${md.price}.` : md.message, { ...mdDetails, ltp: md.price ?? null }, md.status));
  add('liveNiftyLtt', check(md.status === 'LIVE', md.status === 'LIVE' ? 'Dhan returned a fresh NIFTY 50 last-trade time.' : md.message, { ...mdDetails, ltt: md.ltt ?? null }, md.status));
  add('liveNiftyMarketData', check(md.status === 'LIVE', md.message, mdDetails, md.status));
  const dataAvailable = md.status === 'LIVE' || md.status === 'STALE';

  // 3. Checks that do not need market data always run.
  let settingsRow = null;
  await attempt('strategyEnabled', async () => {
    const stateResult = await pool.query('SELECT status FROM algo_states WHERE user_id = $1', [userId]);
    const status = stateResult.rows[0]?.status || 'MISSING';
    add('strategyEnabled', check(status === 'ACTIVE', status === 'ACTIVE' ? 'KEPWE strategy runner is ACTIVE.' : `KEPWE strategy runner is ${status}.`, { status }));
  });
  await attempt('deploymentGate', async () => {
    const deploymentResult = await pool.query(
      `SELECT event_type, gate_checks FROM quant_deployment_events
       WHERE user_id = $1 AND event_type = 'DEPLOYMENT_VALIDATED'
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const deploymentChecks = deploymentResult.rows[0]?.gate_checks;
    const passed = Boolean(deploymentChecks && Object.values(deploymentChecks).every((item) => item?.passed === true));
    add('deploymentGate', check(passed, passed ? 'Latest deployment validation passed.' : 'No passing deployment validation is recorded.', { eventType: deploymentResult.rows[0]?.event_type || null }));
  });
  await attempt('riskConfiguration', async () => {
    const settingsResult = await pool.query('SELECT trading_capital, risk_per_trade, max_trades_per_day, max_consecutive_losses, daily_loss_limit FROM algo_settings WHERE user_id = $1', [userId]);
    settingsRow = settingsResult.rows[0] || null;
    const s = settingsRow;
    const passed = Boolean(s && Number(s.trading_capital) > 0 && Number(s.risk_per_trade) > 0 && Number(s.max_trades_per_day) > 0 && Number(s.max_consecutive_losses) > 0 && Number(s.daily_loss_limit) > 0);
    add('riskConfiguration', check(passed, passed ? 'Authoritative algo_settings risk configuration is valid.' : 'algo_settings risk configuration is missing or invalid.'));
  });
  await attempt('orderApi', async () => {
    const readiness = adapter.readiness();
    add('orderApi', check(readiness.orderExecutionReady === true, readiness.staticIp?.reason || readiness.reason, { staticIp: readiness.staticIp }));
  });
  await attempt('omsSchema', async () => {
    const schema = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`, [['algo_orders', 'algo_positions', 'algo_trades', 'execution_events']]);
    add('omsSchema', check(schema.rows.length === 4, schema.rows.length === 4 ? 'OMS tables are present.' : 'OMS tables are missing.'));
  });
  await attempt('brokerResponseParsing', async () => {
    const orderBook = await adapter.getOrderBook();
    const trades = await adapter.getTradeBook();
    add('brokerResponseParsing', check(Array.isArray(orderBook) && Array.isArray(trades), 'Dhan order and trade responses are arrays and accessible.', { orders: orderBook.length, trades: trades.length }));
    const normalizedOrders = orderBook.map((order) => normalizeBrokerExecution(order)).filter((order) => order.brokerOrderId || order.status);
    add('orderStatusReconciliation', check(normalizedOrders.every((order) => normalizeExecutionStatus(order.status) !== null), 'Dhan order statuses normalize to OMS states.', { orders: normalizedOrders.length }));
    add('tradeFillReconciliation', check(trades.every((trade) => trade && typeof trade === 'object'), 'Dhan trade-book response is readable without placing an order.', { trades: trades.length }));
  });
  await attempt('positionSynchronization', async () => {
    const positions = await adapter.getPositions();
    add('positionSynchronization', check(Array.isArray(positions) && positions.every((position) => position.securityId && Number.isFinite(position.quantity)), 'Dhan positions contain security IDs and numeric quantities.', { positions: positions.length }));
    add('realizedPnl', check(positions.every((position) => Number.isFinite(position.realizedPnl)), 'Realized P&L fields are available from Dhan positions.', { positions: positions.length }));
    add('unrealizedPnl', check(positions.every((position) => Number.isFinite(position.unrealizedPnl)), 'Unrealized P&L fields are available from Dhan positions.', { positions: positions.length }));
  });
  await attempt('notifications', async () => {
    const notificationSchema = await pool.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') AS exists`);
    add('notifications', check(notificationSchema.rows[0]?.exists === true, 'Notification persistence table is available.'));
  });
  add('emergencyStop', check(typeof adapter.exitAllPositions === 'function', 'Dhan exit-all-positions capability is wired; it was not invoked by this health check.'));

  // 4. Checks that need Dhan market data: only attempted when Dhan actually serves it.
  if (!dataAvailable) {
    for (const name of DATA_DEPENDENT_CHECKS) {
      add(name, check(false, `Not verified: requires Dhan market data (market data status ${md.status}).`, { marketDataStatus: md.status }, 'NOT_VERIFIED'));
    }
  } else {
    const securityId = md.instrument.securityId;
    const segment = md.instrument.exchangeSegment;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    let candles = [];
    let contracts = [];
    await attempt('niftyCandleParsing', async () => {
      const historical = await adapter.getHistoricalData({ securityId, exchangeSegment: segment, instrument: 'INDEX', interval: 5, fromDate: istDateOffset(-7), toDate: date });
      candles = normalizeDhanCandles(historical, 5);
      add('niftyCandleParsing', check(candlesFromPayload(historical) && candles.length > 0, 'Dhan NIFTY 5-minute candle response parsed into completed candles.', { count: candles.length }));
    });
    await attempt('oneMinuteConfirmationCandle', async () => {
      const confirmationPayload = await adapter.getHistoricalData({ securityId, exchangeSegment: segment, instrument: 'INDEX', interval: 1, fromDate: date, toDate: date });
      const confirmationCandles = normalizeDhanCandles(confirmationPayload, 1);
      add('oneMinuteConfirmationCandle', check(confirmationCandles.length > 0, 'Dhan NIFTY 1-minute confirmation response parsed into completed candles.', { count: confirmationCandles.length }));
    });
    await attempt('optionChainContractResolution', async () => {
      const expiryPayload = await adapter.getOptionExpiryList({ underlyingScrip: securityId, underlyingSeg: segment });
      const expiryValues = Array.isArray(expiryPayload?.data) ? expiryPayload.data.map(String).sort() : [];
      const expiry = expiryValues[0];
      const master = await loadDhanInstrumentMaster();
      const chain = expiry ? await adapter.getOptionChain({ underlyingScrip: securityId, underlyingSeg: segment, expiry }) : null;
      contracts = chain ? resolveDhanOptionInstruments(chain, Date.now(), master, expiry) : [];
      add('optionChainContractResolution', check(Boolean(expiry && contracts.length > 0 && contracts.some((contract) => contract.securityId && contract.lotSize > 0)), 'Dhan option chain resolved against the official instrument master.', { expiry, contracts: contracts.length }));
    });
    const enriched = candles.length > 0 ? enrichNiftyScalpingCandles(candles) : [];
    const signal = enriched.length > 0 ? evaluateNiftyScalpingSignal(enriched, enriched.length - 1) : { signal: 'NO_TRADE', reason: 'No candles' };
    add('strategySignalPipeline', check(enriched.length >= 55 && typeof signal.signal === 'string', 'Existing KEPWE 5m strategy pipeline evaluated real Dhan candles.', { signal: signal.signal, reason: signal.reason, candles: enriched.length }));
    const selected = enriched.length > 0 && contracts.length > 0
      ? selectNiftyScalpingOption({ spotPrice: enriched.at(-1).close, optionType: signal.regime || 'CE', instruments: contracts, now: Date.now() })
      : { contract: null };
    const risk = selected.contract && settingsRow
      ? evaluateRisk({
        candidate: { signal: 'BUY_CE', price: selected.contract.premium, stopLoss: selected.contract.stop },
        settings: {
          tradingCapital: Number(settingsRow.trading_capital),
          riskPerTrade: Number(settingsRow.risk_per_trade),
          maxTradesPerDay: Number(settingsRow.max_trades_per_day),
          maxConsecutiveLosses: Number(settingsRow.max_consecutive_losses),
          dailyLossLimit: Number(settingsRow.daily_loss_limit),
        },
        stats: { dailyLoss: 0, todayTrades: 0, consecutiveLosses: 0 },
        brokerHealthy: true,
        systemHealthy: true,
        lotSize: selected.contract.lotSize,
        availableMargin: Number(funds?.available),
      })
      : null;
    add('riskEngine', check(Boolean(risk && risk.sizing.quantity > 0), 'Risk Engine accepted a real contract using live Dhan margin.', { reason: risk?.reason || 'No real contract/settings available' }));
    try {
      const orderRequest = selected.contract && risk?.sizing.quantity > 0
        ? adapter.buildOrderPayload({
          internalOrderId: `HEALTH-${Date.now()}`,
          side: 'BUY', quantity: risk.sizing.quantity, price: 0,
          metadata: {
            securityId: selected.contract.securityId,
            tradingSymbol: selected.contract.tradingSymbol,
            exchangeSegment: 'NSE_FNO', productType: 'INTRADAY', orderType: 'MARKET',
            expiry: selected.contract.expiry, optionType: selected.contract.optionType,
            strike: selected.contract.strike, lotSize: selected.contract.lotSize,
          },
        }) : null;
      // Payload is built only to validate it; it is never submitted.
      add('orderRequestConstruction', check(Boolean(orderRequest), 'A validated Dhan order payload can be constructed without submission.', orderRequest || {}));
    } catch (error) {
      add('orderRequestConstruction', check(false, error.message));
    }
  }

  // Market-data blockers first so the UI surfaces the most relevant one.
  const priority = ['liveNiftyMarketData', 'dhanDataPlan'];
  blockers.sort((a, b) => (priority.includes(b.check) ? 1 : 0) - (priority.includes(a.check) ? 1 : 0));

  const ready = Object.values(checks).every((result) => result.passed === true) && blockers.length === 0;
  return {
    ready,
    status: ready ? 'PASS' : 'FAIL',
    code: ready ? 'LIVE_EXECUTION_READY' : (md.status === 'DATA_API_NOT_ACTIVE' ? 'DATA_API_NOT_ACTIVE' : 'LIVE_EXECUTION_BLOCKED'),
    broker: feed.broker,
    marketData: md,
    checks,
    blockers,
    orderPlaced: false,
    readOnly: true,
    timestamp: new Date().toISOString(),
  };
}
