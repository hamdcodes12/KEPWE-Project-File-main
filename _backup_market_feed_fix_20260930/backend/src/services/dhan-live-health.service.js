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
  loadDhanInstrumentMaster,
  normalizeDhanCandles,
  resolveDhanOptionInstruments,
} from './live-quant-runner.service.js';

const NIFTY_SECURITY_ID = '13';

function check(passed, message, details = {}, status = null) {
  return {
    passed: Boolean(passed),
    status: status || (passed ? 'PASS' : 'FAIL'),
    message,
    details,
  };
}

function ltpFromPayload(payload, segment, securityId) {
  const data = payload?.data || payload || {};
  const quote = data?.[segment]?.[String(securityId)] || {};
  const ltp = Number(quote.last_price ?? quote.ltp);
  return Number.isFinite(ltp) && ltp > 0 ? ltp : null;
}

function lttFromPayload(payload, segment, securityId) {
  const data = payload?.data || payload || {};
  const quote = data?.[segment]?.[String(securityId)] || {};
  return quote.ltt ?? quote.last_trade_time ?? quote.lastTradeTime ?? quote.timestamp ?? null;
}

function freshTimestamp(value, now = Date.now(), maxAgeMs = 90_000) {
  const numeric = Number(value);
  const timestamp = Number.isFinite(numeric)
    ? (numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(value || '').getTime();
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= maxAgeMs;
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

export async function runDhanLiveHealthCheck(pool, userId) {
  const checks = {};
  const blockers = [];
  const add = (name, result) => {
    checks[name] = result;
    if (!result.passed) blockers.push({ check: name, blocker: result.message, details: result.details });
  };

  let adapter;
  let broker;
  let lookupFailed = false;
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
    add('dhanAuthentication', check(
      Boolean(broker?.access_token_ciphertext && broker.status === 'CONNECTED' && broker.connection_mode === 'LIVE'),
      'A connected LIVE Dhan account and token are required.',
      { brokerStatus: broker?.status || 'DISCONNECTED', connectionMode: broker?.connection_mode || null },
      lookupFailed ? 'FAIL' : 'BLOCKED',
    ));
    if (broker?.access_token_ciphertext) {
      adapter = getBrokerAdapter('DHAN', 'LIVE', {
        dhanClientId: broker.client_id,
        accessToken: decryptBrokerSecret(broker.access_token_ciphertext),
        tokenExpiresAt: broker.token_expires_at,
      });
    }
  } catch (error) {
    lookupFailed = true;
    add('dhanAuthentication', check(false, `Dhan account lookup failed: ${error.message}`, {}, 'FAIL'));
  }

  if (!adapter) {
    for (const name of ['dhanSession', 'clientIdentity', 'fundsMargin', 'liveNiftyLtp', 'liveNiftyLtt', 'liveNiftyMarketData', 'niftyCandleParsing', 'oneMinuteConfirmationCandle', 'strategyEnabled', 'deploymentGate', 'optionChainContractResolution', 'strategySignalPipeline', 'riskConfiguration', 'riskEngine', 'orderApi', 'omsSchema', 'orderRequestConstruction', 'brokerResponseParsing', 'orderStatusReconciliation', 'tradeFillReconciliation', 'positionSynchronization', 'realizedPnl', 'unrealizedPnl', 'notifications', 'emergencyStop']) {
      if (!checks[name]) add(name, check(false, 'Blocked by missing verified Dhan session.', {}, 'NOT_VERIFIED'));
    }
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

  try {
    const [profile, funds] = await Promise.all([adapter.getProfile(), adapter.getMargin()]);
    add('dhanSession', check(true, 'Dhan access token and margin session are valid.'));
    add('clientIdentity', check(String(profile?.clientId || '') === String(broker.client_id || ''), 'Dhan profile identity does not match the stored client ID.'));
    add('fundsMargin', check(Number.isFinite(Number(funds?.available)) && Number(funds.available) >= 0, 'Dhan fundlimit returned usable available margin.', { availableMargin: Number(funds?.available) }));

    const quote = await adapter.getMarketData({ exchange: 'IDX_I', symbolToken: NIFTY_SECURITY_ID });
    const niftyLtp = ltpFromPayload(quote, 'IDX_I', NIFTY_SECURITY_ID);
    const niftyLtt = lttFromPayload(quote, 'IDX_I', NIFTY_SECURITY_ID);
    add('liveNiftyLtp', check(niftyLtp !== null, 'Dhan returned a positive NIFTY LTP.', { ltp: niftyLtp, securityId: NIFTY_SECURITY_ID }));
    add('liveNiftyLtt', check(freshTimestamp(niftyLtt), 'Dhan returned a fresh NIFTY LTT.', { ltt: niftyLtt, securityId: NIFTY_SECURITY_ID }));
    add('liveNiftyMarketData', check(niftyLtp !== null, 'Dhan returned a real NIFTY 50 LTP.', { ltp: niftyLtp }));

    const stateResult = await pool.query('SELECT status FROM algo_states WHERE user_id = $1', [userId]);
    add('strategyEnabled', check(stateResult.rows[0]?.status === 'ACTIVE', 'KEPWE strategy runner is ACTIVE.', { status: stateResult.rows[0]?.status || 'MISSING' }));
    const deploymentResult = await pool.query(
      `SELECT event_type, gate_checks FROM quant_deployment_events
       WHERE user_id = $1 AND event_type = 'DEPLOYMENT_VALIDATED'
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const deploymentChecks = deploymentResult.rows[0]?.gate_checks;
    add('deploymentGate', check(Boolean(deploymentChecks && Object.values(deploymentChecks).every((item) => item?.passed === true)), 'Latest deployment validation passed.', { eventType: deploymentResult.rows[0]?.event_type || null }));
    const settingsResult = await pool.query('SELECT trading_capital, risk_per_trade, max_trades_per_day, max_consecutive_losses, daily_loss_limit FROM algo_settings WHERE user_id = $1', [userId]);
    const settings = settingsResult.rows[0];
    add('riskConfiguration', check(Boolean(settings && Number(settings.trading_capital) > 0 && Number(settings.risk_per_trade) > 0 && Number(settings.max_trades_per_day) > 0 && Number(settings.max_consecutive_losses) > 0 && Number(settings.daily_loss_limit) > 0), 'Authoritative algo_settings risk configuration is valid.'));
    const readiness = adapter.readiness();
    add('orderApi', check(readiness.orderExecutionReady === true, readiness.staticIp?.reason || readiness.reason, { staticIp: readiness.staticIp }));

    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const historical = await adapter.getHistoricalData({ securityId: NIFTY_SECURITY_ID, exchangeSegment: 'IDX_I', instrument: 'INDEX', interval: 5, fromDate: istDateOffset(-7), toDate: date });
    const candlesParsed = candlesFromPayload(historical);
    const candles = normalizeDhanCandles(historical, 5);
    add('niftyCandleParsing', check(candlesParsed && candles.length > 0, 'Dhan NIFTY 5-minute candle response parsed into completed candles.', { count: candles.length }));
    const confirmationPayload = await adapter.getHistoricalData({ securityId: NIFTY_SECURITY_ID, exchangeSegment: 'IDX_I', instrument: 'INDEX', interval: 1, fromDate: date, toDate: date });
    const confirmationCandles = normalizeDhanCandles(confirmationPayload, 1);
    add('oneMinuteConfirmationCandle', check(confirmationCandles.length > 0, 'Dhan NIFTY 1-minute confirmation response parsed into completed candles.', { count: confirmationCandles.length }));

    const expiryPayload = await adapter.getOptionExpiryList({ underlyingScrip: NIFTY_SECURITY_ID, underlyingSeg: 'IDX_I' });
    const expiryValues = Array.isArray(expiryPayload?.data) ? expiryPayload.data.map(String).sort() : [];
    const expiry = expiryValues[0];
    const master = await loadDhanInstrumentMaster();
    const chain = expiry ? await adapter.getOptionChain({ underlyingScrip: NIFTY_SECURITY_ID, underlyingSeg: 'IDX_I', expiry }) : null;
    const contracts = chain ? resolveDhanOptionInstruments(chain, Date.now(), master, expiry) : [];
    add('optionChainContractResolution', check(Boolean(expiry && contracts.length > 0 && contracts.some((contract) => contract.securityId && contract.lotSize > 0)), 'Dhan option chain resolved against the official instrument master.', { expiry, contracts: contracts.length }));

    const enriched = enrichNiftyScalpingCandles(candles);
    const signal = enriched.length > 0 ? evaluateNiftyScalpingSignal(enriched, enriched.length - 1) : { signal: 'NO_TRADE', reason: 'No candles' };
    add('strategySignalPipeline', check(enriched.length >= 55 && typeof signal.signal === 'string', 'Existing KEPWE 5m strategy pipeline evaluated real Dhan candles.', { signal: signal.signal, reason: signal.reason }));

    const selected = enriched.length > 0 && contracts.length > 0
      ? selectNiftyScalpingOption({ spotPrice: enriched.at(-1).close, optionType: signal.regime || 'CE', instruments: contracts, now: Date.now() })
      : { contract: null };
    const settingsRow = settingsResult.rows[0];
    const margin = Number(funds.available);
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
        availableMargin: margin,
      })
      : null;
    add('riskEngine', check(Boolean(risk && risk.sizing.quantity > 0), 'Risk Engine accepted a real contract using live Dhan margin.', { reason: risk?.reason || 'No real contract/settings available' }));

    const schema = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`, [['algo_orders', 'algo_positions', 'algo_trades', 'execution_events']]);
    add('omsSchema', check(schema.rows.length === 4, 'OMS tables are present.'));
    let orderRequest = null;
    try {
      orderRequest = selected.contract && risk?.sizing.quantity > 0
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
      add('orderRequestConstruction', check(Boolean(orderRequest), 'A validated Dhan order payload can be constructed without submission.', orderRequest || {}));
    } catch (error) {
      add('orderRequestConstruction', check(false, error.message));
    }

    const orderBook = await adapter.getOrderBook();
    const trades = await adapter.getTradeBook();
    add('brokerResponseParsing', check(Array.isArray(orderBook) && Array.isArray(trades), 'Dhan order and trade responses are arrays and accessible.', { orders: orderBook.length, trades: trades.length }));
    const normalizedOrders = orderBook.map((order) => normalizeBrokerExecution(order)).filter((order) => order.brokerOrderId || order.status);
    add('orderStatusReconciliation', check(normalizedOrders.every((order) => normalizeExecutionStatus(order.status) !== null), 'Dhan order statuses normalize to OMS states.', { orders: normalizedOrders.length }));
    add('tradeFillReconciliation', check(trades.every((trade) => trade && typeof trade === 'object'), 'Dhan trade-book response is readable without placing an order.', { trades: trades.length }));

    const positions = await adapter.getPositions();
    add('positionSynchronization', check(Array.isArray(positions) && positions.every((position) => position.securityId && Number.isFinite(position.quantity)), 'Dhan positions contain security IDs and numeric quantities.', { positions: positions.length }));
    add('realizedPnl', check(positions.every((position) => Number.isFinite(position.realizedPnl)), 'Realized P&L fields are available from Dhan positions.', { positions: positions.length }));
    add('unrealizedPnl', check(positions.every((position) => Number.isFinite(position.unrealizedPnl)), 'Unrealized P&L fields are available from Dhan positions.', { positions: positions.length }));

    const notificationSchema = await pool.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') AS exists`);
    add('notifications', check(notificationSchema.rows[0]?.exists === true, 'Notification persistence table is available.'));
    add('emergencyStop', check(typeof adapter.exitAllPositions === 'function', 'Dhan exit-all-positions capability is wired; it was not invoked by this health check.'));
  } catch (error) {
    const blocker = error?.dataApiRejected
      ? `Dhan session is valid, but Dhan rejected the market-data request (HTTP ${error.httpStatus}${error.providerErrorCode ? `, ${error.providerErrorCode}` : ''}). Check that the Dhan Data API plan is active for this account.`
      : error.message;
    blockers.push({ check: 'dhanLiveHealth', blocker, status: 'FAIL', code: error?.code || null, dhanErrorCode: error?.providerErrorCode ?? null });
  }

  const ready = Object.values(checks).every((result) => result.passed === true) && blockers.length === 0;
  return { ready, status: ready ? 'PASS' : 'FAIL', checks, blockers, orderPlaced: false, readOnly: true, timestamp: new Date().toISOString() };
}
