import { normalizeBrokerExecution } from '../algo/broker-adapters.js';
import { normalizeExecutionStatus } from '../algo/oms.js';
import { evaluateRisk } from '../algo/risk-engine.js';
import {
  enrichNiftyScalpingCandles,
  evaluateNiftyScalpingSignal,
  selectNiftyScalpingOption,
} from './nifty-scalping-strategy.service.js';
import { fetchNiftyCandles } from './live-quant-runner.service.js';
import { getNiftyIndexInstrument, niftyFreezeQuantity } from './angel-one-instruments.service.js';
import { verifyAngelOneStaticIp } from './static-ip.service.js';
import { getAngelOneMarketFeed } from './angel-one-market-feed.service.js';
import { fetchNiftyOptionChain } from './angel-one-option-chain.service.js';
import { getAngelOneSession, isAngelOneSessionError, markAngelOneSessionExpired } from './angel-one-session.service.js';

// Read-only: this health check never places, modifies or cancels an order.

function check(passed, message, details = {}, failStatus = null) {
  return {
    passed: Boolean(passed),
    status: passed ? 'PASS' : (failStatus || 'FAIL'),
    message,
    details,
  };
}

function brokerErrorDetails(error) {
  return {
    category: error?.angelCategory || null,
    brokerHttpStatus: error?.httpStatus ?? null,
    brokerErrorCode: error?.providerErrorCode ?? null,
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

export async function runAngelOneLiveHealthCheck(pool, userId) {
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
      add(name, check(false, `${name} failed: ${error.message}`, brokerErrorDetails(error)));
    }
  };
  const finish = (extra) => ({
    ready: false,
    checks,
    blockers,
    orderPlaced: false,
    readOnly: true,
    timestamp: new Date().toISOString(),
    ...extra,
  });

  let adapter;
  let broker;
  try {
    const session = await getAngelOneSession(pool, userId);
    broker = session.row;
    adapter = session.row?.status === 'CONNECTED' ? session.adapter : null;
    add('brokerAuthentication', check(
      Boolean(adapter),
      adapter ? 'A connected LIVE Angel One account and stored session are present.' : 'A connected LIVE Angel One account and session are required.',
      { brokerStatus: broker?.status || 'DISCONNECTED', connectionMode: broker?.connection_mode || null },
      session.reason === 'SESSION_EXPIRED' ? 'SESSION_EXPIRED' : 'BLOCKED',
    ));
  } catch (error) {
    add('brokerAuthentication', check(false, `Angel One account lookup failed: ${error.message}`, {}, 'FAIL'));
  }

  if (!adapter) {
    const status = checks.brokerAuthentication?.status;
    return finish({
      status: status === 'FAIL' ? 'FAIL' : 'BLOCKED',
      code: status === 'FAIL' ? 'QUANT_HEALTH_CHECK_FAILED' : (status === 'SESSION_EXPIRED' ? 'ANGEL_ONE_SESSION_EXPIRED' : 'ANGEL_ONE_NOT_CONNECTED'),
    });
  }

  // 1. Broker session (SmartAPI getProfile + getRMS). Independent of market data.
  let funds = null;
  try {
    const profile = await adapter.getProfile();
    funds = await adapter.getMargin();
    add('brokerSession', check(true, 'Angel One getProfile and getRMS accepted the stored session.'));
    const identityOk = String(profile?.clientCode || '') === String(broker.client_id || '').toUpperCase();
    add('clientIdentity', check(identityOk, identityOk ? 'Angel One profile client code matches the stored client code.' : 'Angel One profile identity does not match the stored client code.'));
    const marginOk = Number.isFinite(Number(funds?.available)) && Number(funds.available) >= 0;
    add('fundsMargin', check(marginOk, marginOk ? 'Angel One getRMS returned usable available margin.' : 'Angel One getRMS did not return usable margin.', { availableMargin: Number(funds?.available) }));
  } catch (error) {
    const expired = isAngelOneSessionError(error);
    if (expired) await markAngelOneSessionExpired(pool, broker.id);
    add('brokerSession', check(false, `Angel One session check failed: ${error.message}`, brokerErrorDetails(error), expired ? 'SESSION_EXPIRED' : 'FAIL'));
    return finish({ status: 'FAIL', code: expired ? 'ANGEL_ONE_SESSION_EXPIRED' : 'QUANT_HEALTH_CHECK_FAILED' });
  }

  // 2. Market data through the same verified feed as /api/quant/live-market.
  const feed = await getAngelOneMarketFeed(pool, userId, { maxAgeMs: 0 });
  const md = feed.marketData;
  const mdDetails = {
    marketDataStatus: md.status,
    instrument: md.instrument || null,
    brokerHttpStatus: md.brokerHttpStatus ?? null,
    brokerErrorCode: md.brokerErrorCode ?? null,
  };
  const priceOk = Number.isFinite(md.price) && md.price > 0;
  add('liveNiftyLtp', check(priceOk, priceOk ? `Angel One returned NIFTY 50 LTP ${md.price}.` : md.message, { ...mdDetails, ltp: md.price ?? null }, md.status));
  add('liveNiftyLtt', check(md.status === 'LIVE', md.status === 'LIVE' ? 'Angel One returned a fresh NIFTY 50 exchange timestamp.' : md.message, { ...mdDetails, ltt: md.ltt ?? null }, md.status));
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
    const passed = Boolean(deploymentChecks && Object.keys(deploymentChecks).length > 0 && Object.values(deploymentChecks).every((item) => item?.passed === true));
    add('deploymentGate', check(passed, passed ? 'Latest deployment validation passed.' : 'No passing deployment validation is recorded.', { eventType: deploymentResult.rows[0]?.event_type || null }));
  });
  await attempt('riskConfiguration', async () => {
    const settingsResult = await pool.query('SELECT trading_capital, risk_per_trade, max_trades_per_day, max_consecutive_losses, daily_loss_limit FROM algo_settings WHERE user_id = $1', [userId]);
    settingsRow = settingsResult.rows[0] || null;
    const s = settingsRow;
    const passed = Boolean(s && Number(s.trading_capital) > 0 && Number(s.risk_per_trade) > 0 && Number(s.max_trades_per_day) > 0 && Number(s.max_consecutive_losses) > 0 && Number(s.daily_loss_limit) > 0);
    add('riskConfiguration', check(passed, passed ? 'Authoritative algo_settings risk configuration is valid.' : 'algo_settings risk configuration is missing or invalid.'));
  });
  await attempt('instrumentMaster', async () => {
    // Public Angel One file: verifiable without a session.
    const instrument = await getNiftyIndexInstrument();
    add('instrumentMaster', check(true, `Official Angel One instrument master resolves NIFTY 50 to ${instrument.exchange}:${instrument.symbolToken}.`, instrument));
  });
  const freezeQuantity = niftyFreezeQuantity();
  add('freezeQuantity', check(
    freezeQuantity !== null,
    freezeQuantity !== null
      ? `NSE quantity freeze for NIFTY options is configured as ${freezeQuantity}.`
      : 'ANGEL_ONE_NIFTY_FREEZE_QTY is not configured; order sizing is blocked until the current NSE quantity freeze for NIFTY options is set.',
    { freezeQuantity },
    'NOT_CONFIGURED',
  ));
  await attempt('orderApi', async () => {
    // This server's detected outbound IP must equal the configured static IP.
    const staticIp = await verifyAngelOneStaticIp({ force: true });
    add('orderApi', check(staticIp.ready === true, staticIp.reason, {
      status: staticIp.status,
      configuredIp: staticIp.configuredIp,
      detectedIp: staticIp.detectedIp,
      registrationVerifiable: false,
    }, staticIp.status === 'PASS' ? null : 'STATIC_IP_NOT_READY'));
  });
  await attempt('omsSchema', async () => {
    const schema = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`, [['algo_orders', 'algo_positions', 'algo_trades', 'execution_events']]);
    // Columns the live order path writes (migrations 006-008); a missing one would fail every order.
    const requiredColumns = ['internal_order_id', 'broker_order_id', 'correlation_id', 'remaining_quantity', 'signal_key', 'broker_account_id'];
    const columns = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'algo_orders' AND column_name = ANY($1)`,
      [requiredColumns],
    );
    const present = new Set(columns.rows.map((row) => row.column_name));
    const missing = requiredColumns.filter((name) => !present.has(name));
    const ok = schema.rows.length === 4 && missing.length === 0;
    add('omsSchema', check(ok, ok ? 'OMS tables and live-order columns are present.' : `OMS schema incomplete${missing.length ? `: algo_orders missing ${missing.join(', ')}` : ': OMS tables missing'}.`, { missingColumns: missing }));
  });
  await attempt('brokerResponseParsing', async () => {
    const orderBook = await adapter.getOrderBook();
    const trades = await adapter.getTradeBook();
    add('brokerResponseParsing', check(Array.isArray(orderBook) && Array.isArray(trades), 'Angel One order-book and trade-book responses are arrays and accessible.', { orders: orderBook.length, trades: trades.length }));
    const normalizedOrders = orderBook.map((order) => normalizeBrokerExecution(order)).filter((order) => order.brokerOrderId || order.status);
    add('orderStatusReconciliation', check(normalizedOrders.every((order) => normalizeExecutionStatus(order.status) !== null), 'Angel One order statuses normalize to OMS states.', { orders: normalizedOrders.length }));
    add('tradeFillReconciliation', check(trades.every((trade) => trade && typeof trade === 'object'), 'Angel One trade-book response is readable without placing an order.', { trades: trades.length }));
  });
  await attempt('positionSynchronization', async () => {
    const positions = await adapter.getPositions();
    add('positionSynchronization', check(Array.isArray(positions) && positions.every((position) => position.securityId && Number.isFinite(position.quantity)), 'Angel One positions contain symbol tokens and numeric quantities.', { positions: positions.length }));
    add('realizedPnl', check(positions.every((position) => Number.isFinite(position.realizedPnl)), 'Realized P&L fields are available from Angel One positions.', { positions: positions.length }));
    add('unrealizedPnl', check(positions.every((position) => Number.isFinite(position.unrealizedPnl)), 'Unrealized P&L fields are available from Angel One positions.', { positions: positions.length }));
  });
  await attempt('holdingsSynchronization', async () => {
    const holdings = await adapter.getHoldings();
    add('holdingsSynchronization', check(Array.isArray(holdings), 'Angel One holdings are readable.', { holdings: holdings.length }));
  });
  await attempt('notifications', async () => {
    const notificationSchema = await pool.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') AS exists`);
    add('notifications', check(notificationSchema.rows[0]?.exists === true, 'Notification persistence table is available.'));
  });
  add('emergencyStop', check(typeof adapter.exitAllPositions === 'function', 'Exit-all-positions (one MARKET exit order per open Angel One position) is wired; it was not invoked by this health check.'));

  // 4. Checks that need market data: only attempted when Angel One actually serves it.
  if (!dataAvailable) {
    for (const name of DATA_DEPENDENT_CHECKS) {
      add(name, check(false, `Not verified: requires Angel One market data (market data status ${md.status}).`, { marketDataStatus: md.status }, 'NOT_VERIFIED'));
    }
  } else {
    const instrument = md.instrument;
    let candles = [];
    let contracts = [];
    await attempt('niftyCandleParsing', async () => {
      const result = await fetchNiftyCandles(adapter, instrument, 5, 7);
      candles = result.candles;
      add('niftyCandleParsing', check(candles.length > 0, candles.length > 0 ? 'Angel One NIFTY 5-minute candles parsed into completed candles.' : 'Angel One returned no completed NIFTY 5-minute candles.', { received: result.received, count: candles.length }));
    });
    await attempt('oneMinuteConfirmationCandle', async () => {
      const result = await fetchNiftyCandles(adapter, instrument, 1, 0);
      add('oneMinuteConfirmationCandle', check(result.candles.length > 0, result.candles.length > 0 ? 'Angel One NIFTY 1-minute confirmation candles parsed into completed candles.' : 'Angel One returned no completed NIFTY 1-minute candles for today.', { received: result.received, count: result.candles.length }));
    });
    const enriched = candles.length > 0 ? enrichNiftyScalpingCandles(candles) : [];
    const signal = enriched.length > 0 ? evaluateNiftyScalpingSignal(enriched, enriched.length - 1) : { signal: 'NO_TRADE', reason: 'No candles' };
    add('strategySignalPipeline', check(enriched.length >= 55 && typeof signal.signal === 'string', enriched.length >= 55 ? 'Existing KEPWE 5m strategy pipeline evaluated real Angel One candles.' : 'Fewer than 55 completed 5-minute candles are available for the strategy.', { signal: signal.signal, reason: signal.reason, candles: enriched.length }));

    // Chain and contract selection are done back-to-back: selection requires quotes at most 3 s old.
    let chainExpiry = null;
    let selected = { contract: null };
    await attempt('optionChainContractResolution', async () => {
      const chain = await fetchNiftyOptionChain(adapter, { spotPrice: md.price });
      chainExpiry = chain.expiry;
      contracts = chain.instruments;
      if (enriched.length > 0 && contracts.length > 0) {
        selected = selectNiftyScalpingOption({ spotPrice: enriched.at(-1).close, optionType: signal.regime || 'CE', instruments: contracts, now: Date.now() });
      }
      const ok = Boolean(chain.expiry && contracts.length > 0 && contracts.some((contract) => contract.securityId && contract.lotSize > 0));
      add('optionChainContractResolution', check(ok, ok ? 'Angel One NIFTY option contracts resolved from the official instrument master with live quotes.' : 'No NIFTY option contract with a live two-sided quote could be resolved.', { expiry: chain.expiry, contracts: contracts.length, greeksAvailable: chain.greeksAvailable, greeksError: chain.greeksError }));
    });
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
    add('riskEngine', check(Boolean(risk && risk.sizing.quantity > 0), risk && risk.sizing.quantity > 0 ? 'Risk Engine accepted a real contract using live Angel One margin.' : `Risk Engine could not size a real contract: ${risk?.reason || selected.reason || 'no eligible contract or risk settings'}.`, { reason: risk?.reason || selected.reason || null, expiry: chainExpiry }));
    try {
      const orderRequest = selected.contract && risk?.sizing.quantity > 0
        ? adapter.buildOrderPayload({
          internalOrderId: `HEALTH-${Date.now()}`,
          side: 'BUY', quantity: risk.sizing.quantity, price: 0,
          metadata: {
            symbolToken: selected.contract.securityId,
            tradingSymbol: selected.contract.tradingSymbol,
            exchange: 'NFO', productType: 'INTRADAY', orderType: 'MARKET',
            lotSize: selected.contract.lotSize,
          },
        }) : null;
      // The payload is built only to validate it; it is never submitted.
      add('orderRequestConstruction', check(Boolean(orderRequest), orderRequest ? 'A validated Angel One order payload can be constructed without submission.' : 'No order payload could be constructed (no eligible contract or zero risk-sized quantity).', orderRequest || {}));
    } catch (error) {
      add('orderRequestConstruction', check(false, error.message));
    }
  }

  // Market-data blockers first so the UI surfaces the most relevant one.
  const priority = ['liveNiftyMarketData'];
  blockers.sort((a, b) => (priority.includes(b.check) ? 1 : 0) - (priority.includes(a.check) ? 1 : 0));

  const ready = Object.values(checks).every((result) => result.passed === true) && blockers.length === 0;
  return {
    ready,
    status: ready ? 'PASS' : 'FAIL',
    code: ready ? 'LIVE_EXECUTION_READY' : 'LIVE_EXECUTION_BLOCKED',
    broker: feed.broker,
    marketData: md,
    checks,
    blockers,
    orderPlaced: false,
    readOnly: true,
    timestamp: new Date().toISOString(),
  };
}
