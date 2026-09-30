import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { requireProductAccess } from '../middleware/product-auth.js';
import { requireFeature, requireActiveSubscription, FEATURES } from '../middleware/feature-gate.js';
import { pool } from '../config/db.js';
import { getBrokerAdapter } from '../algo/broker-adapters.js';
import { decryptBrokerSecret } from '../services/broker-token.service.js';
import {
  NIFTY_QUANT_STRATEGY,
  enrichNiftyCandles,
  evaluateNiftyQuantSignal,
  calculateNiftyPositionSize,
  runNiftyQuantBacktest,
  validateLiveDeploymentGate,
} from '../services/quant-engine.service.js';
import {
  NIFTY_SCALPING_STRATEGY,
  runNiftyScalpingBacktest,
  validateNiftyScalpingDeploymentGate,
} from '../services/nifty-scalping-strategy.service.js';
import { runDhanLiveHealthCheck } from '../services/dhan-live-health.service.js';

const router = Router();

// ── Access control ─────────────────────────────────────────────────────────
// Layer 1: product membership (has the user activated Quant at all?)
router.use(requireProductAccess('quant'));
// Layer 2: subscription active (trial or paid — not expired/suspended)
router.use(requireActiveSubscription);

/**
 * Helper: Ensures default quant records exist for the user
 */
async function ensureQuantUserRows(userId) {
  await pool.query(
    `INSERT INTO algo_settings (user_id, trading_capital, risk_per_trade, risk_reward, max_trades_per_day, max_consecutive_losses, daily_loss_limit)
     VALUES ($1, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT, DEFAULT)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await pool.query(
    `INSERT INTO algo_states (user_id, status)
     VALUES ($1, 'STOPPED')
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveExecutionMode(status, latestEventType) {
  if (latestEventType === 'LIVE_DEPLOYED' || status === 'LIVE_ACTIVE') return 'LIVE / Dhan';
  return null;
}

function deriveDeploymentState(status, latestEventType) {
  if (latestEventType === 'LIVE_DEPLOYED' || status === 'LIVE_ACTIVE') return 'LIVE';
  if (status === 'LIVE_READY') return 'LIVE_READY';
  if (status === 'BACKTESTED') return 'BACKTESTED';
  if (status === 'STOPPED') return 'STOPPED';
  if (status === 'ARCHIVED') return 'COMPLETED';
  if (status === 'DRAFT') return 'DRAFT';
  return status || null;
}

function serializeQuantStrategy(row) {
  const parameters = row.parameters && typeof row.parameters === 'object' ? row.parameters : {};
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    version: row.version,
    instrument: row.instrument,
    strategyType: parameters.strategyType || parameters.type || null,
    direction: row.direction,
    cePeDirection: row.direction,
    optionType: row.option_type,
    timeframe: row.timeframe,
    confirmationTimeframe: row.confirmation_timeframe,
    lotSize: row.lot_size,
    orderType: row.order_type,
    productType: row.product_type,
    executionMode: deriveExecutionMode(row.status, row.latest_event_type),
    tradingWindowStart: row.trading_window_start,
    tradingWindowEnd: row.trading_window_end,
    riskPerTradePct: toNumberOrNull(row.risk_per_trade_pct),
    stopLossPct: toNumberOrNull(row.stop_loss_pct),
    targetPct: toNumberOrNull(row.target_pct),
    riskRewardRatio: toNumberOrNull(row.risk_reward_ratio),
    timeStopMinutes: row.time_stop_minutes,
    maxTradesPerDay: row.max_trades_per_day,
    maxConsecutiveLosses: row.max_consecutive_losses,
    dailyDrawdownLimitPct: toNumberOrNull(row.daily_drawdown_limit_pct),
    status: row.status,
    deploymentState: deriveDeploymentState(row.status, row.latest_event_type),
    deploymentEventType: row.latest_event_type || null,
    deploymentUpdatedAt: row.latest_event_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    capital: toNumberOrNull(parameters.capital ?? parameters.tradingCapital ?? null),
    risk: toNumberOrNull(row.risk_per_trade_pct),
    stopLoss: toNumberOrNull(row.stop_loss_pct),
    profitTarget: toNumberOrNull(row.target_pct),
    pnl: null,
    winRate: null,
    totalTrades: null,
    openPositions: null,
    lastExecution: null,
    parameters,
  };
}

function computeMaxDrawdownFromPnlSeries(pnls = []) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const value of pnls) {
    equity += Number(value) || 0;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  return Number(maxDrawdown.toFixed(2));
}

function extractDhanLtp(payload) {
  const visit = (value) => {
    if (!value || typeof value !== 'object') return null;
    for (const key of ['last_price', 'lastPrice', 'ltp', 'LTP']) {
      const price = Number(value[key]);
      if (Number.isFinite(price) && price > 0) return price;
    }
    for (const child of Object.values(value)) {
      const price = visit(child);
      if (price !== null) return price;
    }
    return null;
  };
  return visit(payload?.data || payload);
}

function extractDhanLtt(payload) {
  const visit = (value) => {
    if (!value || typeof value !== 'object') return null;
    for (const key of ['ltt', 'last_trade_time', 'lastTradeTime', 'timestamp']) {
      if (value[key] !== undefined && value[key] !== null) return value[key];
    }
    for (const child of Object.values(value)) {
      const timestamp = visit(child);
      if (timestamp !== null) return timestamp;
    }
    return null;
  };
  return visit(payload?.data || payload);
}

function isFreshDhanTimestamp(value, now = Date.now(), maxAgeMs = 90_000) {
  const numeric = Number(value);
  const timestamp = Number.isFinite(numeric)
    ? (numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(value || '').getTime();
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= maxAgeMs;
}

async function getDhanLiveSnapshot(userId) {
  let result;
  try {
    result = await pool.query(
      `SELECT ba.client_id, ba.status, ba.connection_mode,
              bot.access_token_ciphertext, bot.token_expires_at
       FROM broker_accounts ba
       LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
       WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
       ORDER BY bot.created_at DESC LIMIT 1`,
      [userId],
    );
  } catch (error) {
    return { connected: false, status: 'FAIL', code: 'SUPABASE_UNAVAILABLE', blocker: `Supabase connectivity failed while loading Dhan session: ${error.message}` };
  }
  const broker = result.rows[0];
  if (!broker) {
    return { connected: false, code: 'DHAN_NOT_CONNECTED', blocker: 'No Dhan account is connected for this user.' };
  }
  if (broker.status === 'SESSION_EXPIRED') {
    return { connected: false, code: 'DHAN_SESSION_EXPIRED', brokerStatus: broker.status, blocker: 'Dhan rejected the stored session. Reconnect with a fresh access token.' };
  }
  if (!['CONNECTED', 'PARTIALLY_CONNECTED'].includes(broker.status) || broker.connection_mode !== 'LIVE') {
    return { connected: false, code: 'DHAN_NOT_CONNECTED', brokerStatus: broker.status, blocker: 'Dhan is not connected in LIVE mode.' };
  }
  if (!broker.access_token_ciphertext) return { connected: false, code: 'DHAN_NOT_CONNECTED', blocker: 'Dhan access token is unavailable.' };

  let adapter;
  let profile;
  let funds;
  try {
    adapter = getBrokerAdapter('DHAN', 'LIVE', {
      dhanClientId: broker.client_id,
      accessToken: decryptBrokerSecret(broker.access_token_ciphertext),
      tokenExpiresAt: broker.token_expires_at,
    });
    // Same verified session the status endpoint uses: /v2/profile first.
    [profile, funds] = await Promise.all([adapter.getProfile(), adapter.getMargin()]);
  } catch (error) {
    const expired = error?.code === 'BROKER_SESSION_EXPIRED';
    return {
      connected: false,
      code: expired ? 'DHAN_SESSION_EXPIRED' : 'DHAN_SESSION_CHECK_FAILED',
      blocker: `Dhan session check failed: ${error.message}`,
      dhanErrorCode: error?.providerErrorCode ?? null,
    };
  }
  if (String(profile?.clientId || '') !== String(broker.client_id)) {
    return { connected: false, code: 'DHAN_IDENTITY_MISMATCH', blocker: 'Dhan account identity does not match the connected client ID.' };
  }

  const sessionInfo = {
    sessionConnected: true,
    clientId: broker.client_id,
    availableMargin: Number(funds?.available),
    dataPlan: profile?.dataPlan || null,
    dataValidity: profile?.dataValidity || null,
  };
  try {
    const quote = await adapter.getMarketData({ exchange: 'IDX_I', symbolToken: '13' });
    const price = extractDhanLtp(quote);
    const ltt = extractDhanLtt(quote);
    if (!Number.isFinite(price) || price <= 0) {
      return { connected: false, code: 'DHAN_NO_LIVE_PRICE', ...sessionInfo, blocker: 'Dhan returned no live NIFTY 50 price.' };
    }
    if (!isFreshDhanTimestamp(ltt)) {
      return { connected: false, code: 'DHAN_STALE_PRICE', ...sessionInfo, blocker: 'Dhan returned a stale or invalid NIFTY 50 last-trade time.' };
    }
    return {
      connected: true,
      source: 'DHAN',
      symbol: 'NIFTY 50',
      price,
      ltt,
      ...sessionInfo,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    if (error?.dataApiRejected) {
      return {
        connected: false,
        code: 'DHAN_DATA_API_UNAVAILABLE',
        ...sessionInfo,
        dhanHttpStatus: error.httpStatus ?? null,
        dhanErrorCode: error.providerErrorCode ?? null,
        blocker: `Dhan session is valid, but Dhan rejected the market-data request (HTTP ${error.httpStatus}). Dhan reports Data API plan: ${sessionInfo.dataPlan || 'unknown'}.`,
      };
    }
    return { connected: false, code: 'DHAN_MARKET_DATA_ERROR', ...sessionInfo, blocker: `Dhan live data unavailable: ${error.message}` };
  }
}

/**
 * GET /api/quant/dashboard
 * Quantitative trading workspace overview: capital, active strategy, live P&L, broker connections
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    await ensureQuantUserRows(req.userId);

    const [settingsRes, stateRes, brokersRes, openPositionsRes, todayTradesRes, overallTradesRes, unrealizedPnlRes, strategiesRes, liveSnapshot] = await Promise.all([
      pool.query('SELECT * FROM algo_settings WHERE user_id = $1', [req.userId]),
      pool.query('SELECT status FROM algo_states WHERE user_id = $1', [req.userId]),
      pool.query('SELECT broker, status, connection_mode FROM broker_accounts WHERE user_id = $1', [req.userId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM algo_positions WHERE user_id = $1 AND status = 'OPEN'`, [req.userId]),
      pool.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(net_pnl), 0)::numeric AS pnl
         FROM algo_trades
         WHERE user_id = $1 AND status = 'LIVE' AND traded_at::date = CURRENT_DATE`,
        [req.userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(net_pnl), 0)::numeric AS pnl
         FROM algo_trades WHERE user_id = $1 AND status = 'LIVE'`,
        [req.userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(unrealized_pnl), 0)::numeric AS pnl
         FROM algo_positions WHERE user_id = $1 AND status = 'OPEN'`,
        [req.userId]
      ),
      pool.query(
        `SELECT s.*, latest.event_type AS latest_event_type, latest.created_at AS latest_event_at
         FROM quant_strategies s
         LEFT JOIN LATERAL (
           SELECT event_type, created_at
           FROM quant_deployment_events
           WHERE user_id = $1 AND strategy_id = s.id
           ORDER BY created_at DESC
           LIMIT 1
         ) latest ON true
         WHERE s.user_id = $1
         ORDER BY s.updated_at DESC`,
        [req.userId]
      ),
      getDhanLiveSnapshot(req.userId),
    ]);

    const settings = settingsRes.rows[0];
    if (!settings) throw new Error('Quant settings are unavailable');
    const state = stateRes.rows[0] || { status: 'STOPPED' };
    const brokers = brokersRes.rows;
    const openPositionsCount = openPositionsRes.rows[0]?.count || 0;
    const todayTrades = todayTradesRes.rows[0]?.count || 0;
    const todayPnl = Number(todayTradesRes.rows[0]?.pnl || 0);
    const realizedPnl = Number(overallTradesRes.rows[0]?.pnl || 0);
    const unrealizedPnl = Number(unrealizedPnlRes.rows[0]?.pnl || 0);

    const userStrategies = strategiesRes.rows.map(serializeQuantStrategy);

    res.json({
      product: 'quant',
      workspace: 'Kepwe Quant Lab',
      user: {
        id: req.user.id,
        name: req.user.full_name,
        email: req.user.email,
        role: req.user.role,
      },
      algoStatus: state.status,
      capital: Number(settings.trading_capital),
      availableMargin: liveSnapshot.connected ? liveSnapshot.availableMargin : null,
      todayPnl,
      realizedPnl,
      unrealizedPnl,
      overallPnl: Number((realizedPnl + unrealizedPnl).toFixed(2)),
      todayTrades,
      openPositions: openPositionsCount,
      settings: {
        tradingCapital: Number(settings.trading_capital),
        riskPerTrade: Number(settings.risk_per_trade),
        riskReward: Number(settings.risk_reward),
        maxTradesPerDay: settings.max_trades_per_day,
        maxConsecutiveLosses: settings.max_consecutive_losses,
        dailyLossLimit: Number(settings.daily_loss_limit),
      },
      brokers: brokers.map((b) => ({
        broker: b.broker,
        status: b.status,
        mode: b.connection_mode,
        isConnected: ['CONNECTED', 'PARTIALLY_CONNECTED'].includes(b.status),
      })),
      feedStatus: {
        connected: liveSnapshot.connected,
        source: liveSnapshot.source || 'DHAN',
        symbol: liveSnapshot.symbol || 'NIFTY 50',
        price: liveSnapshot.price || null,
        clientId: liveSnapshot.clientId || null,
        lastUpdated: liveSnapshot.lastUpdated || null,
        blocker: liveSnapshot.blocker || null,
        label: liveSnapshot.connected ? 'Market Feed: Dhan LIVE' : 'Market Feed: Blocked',
      },
      strategies: userStrategies,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/live-market', async (req, res, next) => {
  try {
    const snapshot = await getDhanLiveSnapshot(req.userId);
    if (!snapshot.connected) return res.status(503).json({ status: snapshot.status || 'BLOCKED', code: snapshot.code || 'DHAN_NOT_CONNECTED', ...snapshot });
    return res.json(snapshot);
  } catch (error) {
    return next(error);
  }
});

router.post('/live-health', async (req, res, next) => {
  try {
    const health = await runDhanLiveHealthCheck(pool, req.userId);
    res.status(health.ready ? 200 : 503).json({
      status: health.ready ? 'PASS' : (health.status || 'BLOCKED'),
      code: health.code || (health.ready ? 'LIVE_EXECUTION_READY' : 'LIVE_EXECUTION_BLOCKED'),
      ...health,
    });
  } catch (error) {
    res.status(503).json({
      status: 'FAIL',
      code: 'QUANT_HEALTH_CHECK_FAILED',
      error: 'Live health check could not complete.',
      details: error.message,
      ready: false,
      orderPlaced: false,
      readOnly: true,
    });
  }
});

/**
 * GET /api/quant/strategies
 * List user's quant strategies and default templates
 * Requires ALGO_STRATEGIES feature (premium)
 */
router.get('/strategies', requireFeature(FEATURES.ALGO_STRATEGIES), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT s.*, latest.event_type AS latest_event_type, latest.created_at AS latest_event_at
       FROM quant_strategies s
       LEFT JOIN LATERAL (
         SELECT event_type, created_at
         FROM quant_deployment_events
         WHERE user_id = $1 AND strategy_id = s.id
         ORDER BY created_at DESC
         LIMIT 1
       ) latest ON true
       WHERE s.user_id = $1
       ORDER BY s.updated_at DESC`,
      [req.userId]
    );

    const saved = result.rows;
    res.json({
      strategies: saved.map(serializeQuantStrategy),
      defaultTemplate: NIFTY_QUANT_STRATEGY,
      templates: [NIFTY_QUANT_STRATEGY, NIFTY_SCALPING_STRATEGY],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quant/analytics
 * Real stored analytics derived from LIVE Dhan orders, trades, and backtest records only.
 * Requires PNL_ANALYTICS feature (available in trial)
 */
router.get('/analytics', requireFeature(FEATURES.PNL_ANALYTICS), async (req, res, next) => {
  try {
    await ensureQuantUserRows(req.userId);

    const [
      closedTradesRes,
      openPositionsRes,
      latestOrdersRes,
      backtestsRes,
      strategiesRes,
    ] = await Promise.all([
      pool.query(
        `SELECT id, symbol AS instrument, side, quantity, entry_price, exit_price,
          COALESCE(net_pnl, pnl) AS pnl, status, traded_at AS opened_at,
          traded_at AS closed_at
         FROM algo_trades
         WHERE user_id = $1 AND status IN ('FILLED', 'LIVE')
         ORDER BY traded_at DESC`,
        [req.userId]
      ),
      pool.query(
        `SELECT symbol AS instrument, side, quantity, entry_price, current_price,
          stop_loss, target, pnl, status, opened_at
         FROM algo_positions
         WHERE user_id = $1 AND status = 'OPEN'
         ORDER BY created_at DESC`,
        [req.userId]
      ),
      pool.query(
        `SELECT instrument, status, execution_mode, created_at
         FROM algo_orders
         WHERE user_id = $1 AND execution_mode = 'LIVE'
         ORDER BY created_at DESC
         LIMIT 50`,
        [req.userId]
      ),
      pool.query(
        `SELECT id, strategy_slug, instrument, timeframe, parameters, results, created_at
         FROM algo_backtest_runs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [req.userId]
      ),
      pool.query('SELECT COUNT(*)::int AS count FROM quant_strategies WHERE user_id = $1', [req.userId]),
    ]);

    // Handle empty positions gracefully
    const openPositions = (openPositionsRes.rows || []).map((position) => ({
      id: position.instrument,
      instrument: position.instrument,
      side: position.side,
      quantity: Number(position.quantity) || 0,
      entryPrice: toNumberOrNull(position.entry_price) ?? 0,
      currentPrice: toNumberOrNull(position.current_price) ?? 0,
      stopLoss: toNumberOrNull(position.stop_loss),
      target: toNumberOrNull(position.target),
      pnl: toNumberOrNull(position.pnl) ?? 0,
      status: position.status,
      openedAt: position.opened_at,
    }));

    const trades = (closedTradesRes.rows || []).map((trade) => ({
      id: trade.id,
      instrument: trade.instrument,
      side: trade.side,
      quantity: Number(trade.quantity) || 0,
      entryPrice: toNumberOrNull(trade.entry_price),
      exitPrice: toNumberOrNull(trade.exit_price),
      pnl: toNumberOrNull(trade.pnl) ?? 0,
      status: trade.status,
      openedAt: trade.opened_at,
      closedAt: trade.closed_at,
    }));

    const closedTrades = trades.filter((trade) => trade.status === 'FILLED');
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter((trade) => trade.pnl > 0);
    const losingTrades = closedTrades.filter((trade) => trade.pnl < 0);
    const realizedPnl = Number(closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0).toFixed(2));
    const unrealizedPnl = Number(openPositions.reduce((sum, position) => sum + (position.pnl || 0), 0).toFixed(2));
    const grossProfit = Number(winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0).toFixed(2));
    const grossLossAbs = Number(
      Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0)).toFixed(2)
    );
    const averageProfit = winningTrades.length
      ? Number((grossProfit / winningTrades.length).toFixed(2))
      : null;
    const averageLoss = losingTrades.length
      ? Number((losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / losingTrades.length).toFixed(2))
      : null;
    const winRate = totalTrades
      ? Number(((winningTrades.length / totalTrades) * 100).toFixed(2))
      : null;
    const todayRealizedPnl = Number(
      closedTrades
        .filter((trade) => trade.closedAt && new Date(trade.closedAt).toDateString() === new Date().toDateString())
        .reduce((sum, trade) => sum + (trade.pnl || 0), 0)
        .toFixed(2)
    );
    const todayUnrealizedPnl = Number(
      openPositions
        .filter((position) => position.openedAt && new Date(position.openedAt).toDateString() === new Date().toDateString())
        .reduce((sum, position) => sum + (position.pnl || 0), 0)
        .toFixed(2)
    );
    const pnlSeriesAscending = [...closedTrades]
      .sort((a, b) => new Date(a.closedAt || a.openedAt) - new Date(b.closedAt || b.openedAt))
      .map((trade) => trade.pnl || 0);
    const maxDrawdown = totalTrades ? computeMaxDrawdownFromPnlSeries(pnlSeriesAscending) : null;

    const lastExecutionCandidate = [
      ...trades.map((trade) => trade.closedAt || trade.openedAt).filter(Boolean),
      ...latestOrdersRes.rows.map((order) => order.created_at).filter(Boolean),
    ]
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const recentBacktests = backtestsRes.rows.map((run) => ({
      id: run.id,
      strategySlug: run.strategy_slug,
      instrument: run.instrument,
      timeframe: run.timeframe,
      createdAt: run.created_at,
      metrics: run.results?.metrics || {},
      parameters: run.parameters || {},
    }));

    res.json({
      summary: {
        hasTradingActivity: totalTrades > 0 || openPositions.length > 0,
        totalPnl: Number((realizedPnl + unrealizedPnl).toFixed(2)),
        todayPnl: Number((todayRealizedPnl + todayUnrealizedPnl).toFixed(2)),
        realizedPnl,
        unrealizedPnl,
        totalTrades,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate,
        averageProfit,
        averageLoss,
        profitFactor: grossLossAbs > 0 ? Number((grossProfit / grossLossAbs).toFixed(2)) : null,
        maxDrawdown,
        openPositions: openPositions.length,
        lastExecution: lastExecutionCandidate ? lastExecutionCandidate.toISOString() : null,
      },
      strategyCount: Number(strategiesRes.rows[0]?.count || 0),
      openPositions,
      trades: trades.slice(0, 100),
      recentBacktests,
      orderHistory: latestOrdersRes.rows.map((order) => ({
        instrument: order.instrument,
        status: order.status,
        executionMode: order.execution_mode,
        createdAt: order.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const strategySaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'Strategy name is required').max(150),
  instrument: z.string().trim().default('NIFTY 50'),
  direction: z.enum(['LONG_CE_PE', 'LONG_CE', 'LONG_PE']).default('LONG_CE_PE'),
  optionType: z.enum(['ATM', 'ITM_1']).default('ATM'),
  timeframe: z.string().default('5m'),
  confirmationTimeframe: z.string().default('1m'),
  lotSize: z.number().int().min(1).max(50).default(1),
  orderType: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
  productType: z.enum(['MIS', 'NRML']).default('MIS'),
  tradingWindowStart: z.string().default('09:25'),
  tradingWindowEnd: z.string().default('15:10'),
  riskPerTradePct: z.number().min(0.25).max(5.0).default(1.0),
  stopLossPct: z.number().positive().default(25.0),
  targetPct: z.number().positive().default(50.0),
  riskRewardRatio: z.number().positive().default(2.0),
  timeStopMinutes: z.number().int().positive().default(20),
  maxTradesPerDay: z.number().int().min(1).max(3).default(3),
  maxConsecutiveLosses: z.number().int().min(1).max(2).default(2),
  dailyDrawdownLimitPct: z.number().positive().max(15.0).default(10.0),
  status: z.enum(['DRAFT', 'BACKTESTED', 'LIVE_READY', 'STOPPED']).default('DRAFT'),
  parameters: z.record(z.any()).optional().default({}),
});

/**
 * POST /api/quant/strategies
 * Create or update a quant strategy with version increments
 * Requires STRATEGY_BUILDER feature
 */
router.post('/strategies', requireFeature(FEATURES.STRATEGY_BUILDER), validateBody(strategySaveSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const data = req.validatedBody;
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    let strategy;
    let newVersion = 'v1.0';

    if (data.id) {
      // Check existing version
      const existingRes = await client.query(
        'SELECT * FROM quant_strategies WHERE id = $1 AND user_id = $2',
        [data.id, req.userId]
      );
      if (existingRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Strategy not found' });
      }
      const existing = existingRes.rows[0];
      const prevVerNum = parseFloat(existing.version.replace('v', '')) || 1.0;
      newVersion = `v${(prevVerNum + 0.1).toFixed(1)}`;

      const updateRes = await client.query(
        `UPDATE quant_strategies SET
           name = $1, slug = $2, version = $3, instrument = $4, direction = $5,
           option_type = $6, timeframe = $7, confirmation_timeframe = $8, lot_size = $9,
           order_type = $10, product_type = $11, trading_window_start = $12, trading_window_end = $13,
           risk_per_trade_pct = $14, stop_loss_pct = $15, target_pct = $16, risk_reward_ratio = $17,
           time_stop_minutes = $18, max_trades_per_day = $19, max_consecutive_losses = $20,
           daily_drawdown_limit_pct = $21, status = $22, parameters = $23, updated_at = NOW()
         WHERE id = $24 AND user_id = $25
         RETURNING *`,
        [
          data.name, slug, newVersion, data.instrument, data.direction,
          data.optionType, data.timeframe, data.confirmationTimeframe, data.lotSize,
          data.orderType, data.productType, data.tradingWindowStart, data.tradingWindowEnd,
          data.riskPerTradePct, data.stopLossPct, data.targetPct, data.riskRewardRatio,
          data.timeStopMinutes, data.maxTradesPerDay, data.maxConsecutiveLosses,
          data.dailyDrawdownLimitPct, data.status, JSON.stringify(data.parameters || {}),
          data.id, req.userId
        ]
      );
      strategy = updateRes.rows[0];
    } else {
      const insertRes = await client.query(
        `INSERT INTO quant_strategies
           (user_id, name, slug, version, instrument, direction, option_type, timeframe,
            confirmation_timeframe, lot_size, order_type, product_type, trading_window_start,
            trading_window_end, risk_per_trade_pct, stop_loss_pct, target_pct, risk_reward_ratio,
            time_stop_minutes, max_trades_per_day, max_consecutive_losses, daily_drawdown_limit_pct,
            status, parameters)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
         RETURNING *`,
        [
          req.userId, data.name, slug, newVersion, data.instrument, data.direction,
          data.optionType, data.timeframe, data.confirmationTimeframe, data.lotSize,
          data.orderType, data.productType, data.tradingWindowStart, data.tradingWindowEnd,
          data.riskPerTradePct, data.stopLossPct, data.targetPct, data.riskRewardRatio,
          data.timeStopMinutes, data.maxTradesPerDay, data.maxConsecutiveLosses,
          data.dailyDrawdownLimitPct, data.status, JSON.stringify(data.parameters || {})
        ]
      );
      strategy = insertRes.rows[0];
    }

    // Record immutable version log
    await client.query(
      `INSERT INTO quant_strategy_versions (strategy_id, user_id, version, changelog, parameters)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        strategy.id,
        req.userId,
        newVersion,
        `Strategy updated to ${newVersion}`,
        JSON.stringify(strategy)
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      strategy: {
        id: strategy.id,
        name: strategy.name,
        slug: strategy.slug,
        version: strategy.version,
        instrument: strategy.instrument,
        status: strategy.status,
        riskPerTradePct: Number(strategy.risk_per_trade_pct),
        stopLossPct: Number(strategy.stop_loss_pct),
        targetPct: Number(strategy.target_pct),
        riskRewardRatio: Number(strategy.risk_reward_ratio),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

const backtestRunSchema = z.object({
  strategySlug: z.enum(['nifty-pulse-5m', 'kepwe-nifty-50-scalping']).default('nifty-pulse-5m'),
  capital: z.number().positive().default(100000),
  riskPct: z.number().min(0.25).max(5.0).default(1.0),
  optionType: z.enum(['ATM', 'ITM_1']).default('ATM'),
  lotSize: z.number().int().min(1).default(1),
  candles: z.array(z.object({
    timestamp: z.string().optional(),
    open: z.number().positive(),
    high: z.number().positive(),
    low: z.number().positive(),
    close: z.number().positive(),
    volume: z.number().nonnegative().optional(),
  })).min(30, 'At least 30 historical candles are required.'),
  optionCandles: z.array(z.object({
    timestamp: z.string(),
    ltp: z.number().positive(),
    high: z.number().positive(),
    low: z.number().positive(),
    completed: z.boolean(),
  })).optional(),
  instrumentsByTimestamp: z.record(z.array(z.object({
    securityId: z.string().min(1),
    symbol: z.string().optional(),
    optionType: z.enum(['CE', 'PE']),
    strike: z.number().positive(),
    expiry: z.string(),
    ltp: z.number().positive(),
    bid: z.number().positive(),
    ask: z.number().positive(),
    delta: z.number().optional(),
    lotSize: z.number().int().positive(),
    quantityFreeze: z.number().int().positive(),
    ltpTimestamp: z.number(),
    isLiquid: z.boolean(),
    halted: z.boolean(),
    abnormallyVolatile: z.boolean(),
  }))).optional(),
  charges: z.number().nonnegative().default(0),
  slippagePct: z.number().nonnegative().default(0),
});

/**
 * POST /api/quant/backtest
 * Execute real, truthful NIFTY 50 Option Buyer backtest with verified performance metrics
 * Requires BACKTESTING feature (basic tier), ADVANCED_BACKTESTING for unlimited runs
 */
router.post('/backtest', requireFeature(FEATURES.BACKTESTING), validateBody(backtestRunSchema), async (req, res, next) => {
  try {
    const {
      strategySlug,
      capital,
      riskPct,
      optionType,
      lotSize,
      candles,
      optionCandles,
      instrumentsByTimestamp,
      charges,
      slippagePct,
    } = req.validatedBody;
    if (strategySlug === NIFTY_SCALPING_STRATEGY.slug) {
      const backtestResult = runNiftyScalpingBacktest({
        candles,
        optionCandles,
        instrumentsByTimestamp,
        startingDayCapital: capital,
        charges,
        slippagePct,
      });
      try {
        await pool.query(
          `INSERT INTO algo_backtest_runs (user_id, strategy_slug, instrument, timeframe, parameters, results)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.userId,
            NIFTY_SCALPING_STRATEGY.slug,
            'NIFTY 50 index options',
            '5m + 1m',
            JSON.stringify({ capital, charges, slippagePct }),
            JSON.stringify(backtestResult.metrics),
          ]
        );
      } catch (_) {}
      return res.json({ success: true, ...backtestResult });
    }
    const backtestResult = runNiftyQuantBacktest({
      candles,
      capital,
      riskPct,
      optionType,
      lotSize: lotSize * NIFTY_QUANT_STRATEGY.lotSize,
    });

    // Save backtest run to database
    try {
      await pool.query(
        `INSERT INTO algo_backtest_runs (user_id, strategy_slug, instrument, timeframe, parameters, results)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.userId,
          strategySlug,
          'NIFTY 50',
          '5m',
          JSON.stringify({ capital, riskPct, optionType, lotSize }),
          JSON.stringify(backtestResult.metrics)
        ]
      );
    } catch (_) {}

    res.json({
      success: true,
      ...backtestResult,
    });
  } catch (err) {
    next(err);
  }
});



/**
 * POST /api/quant/deployment/validate
 * Live deployment gate validation — requires LIVE_EXECUTION (paid plans only)
 */
router.post('/deployment/validate', requireFeature(FEATURES.LIVE_EXECUTION), async (req, res, next) => {
  try {
    const config = req.body || { riskPerTradePct: 1.0, maxTradesPerDay: 3, maxConsecutiveLosses: 2 };
    const brokerGate = await validateLiveDeploymentGate(req.userId, config);
    const strategyGate = validateNiftyScalpingDeploymentGate(config.validation || config);
    const gateResult = {
        ...brokerGate,
        isDeployable: brokerGate.isDeployable && strategyGate.isDeployable,
        status: brokerGate.isDeployable && strategyGate.isDeployable ? 'READY_TO_DEPLOY' : 'DEPLOYMENT_BLOCKED',
        checks: [...brokerGate.checks, ...strategyGate.checks],
        reason: brokerGate.isDeployable && strategyGate.isDeployable
          ? 'Broker and independent strategy validation gates passed.'
          : 'Broker or independent strategy validation gate is blocked.',
      };

    await pool.query(
      `INSERT INTO quant_deployment_events (user_id, event_type, reason, gate_checks)
       VALUES ($1, $2, $3, $4)`,
      [
        req.userId,
        gateResult.isDeployable ? 'DEPLOYMENT_VALIDATED' : 'DEPLOYMENT_BLOCKED',
        gateResult.isDeployable ? 'Ready for live deployment' : 'Prerequisites not met',
        JSON.stringify(gateResult.checks)
      ]
    );

    res.json(gateResult);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quant/risk/status
 * Get real-time daily risk controller status from live Dhan account
 * Requires RISK_MANAGEMENT feature (available in trial)
 */
router.get('/risk/status', requireFeature(FEATURES.RISK_MANAGEMENT), async (req, res, next) => {
  try {
    const todayRes = await pool.query(
      `SELECT
         COUNT(*)::int AS trades_today,
         COUNT(*) FILTER (WHERE pnl < 0)::int AS losses_today,
         COALESCE(SUM(pnl), 0)::numeric AS day_pnl
       FROM algo_orders
       WHERE user_id = $1 AND execution_mode = 'LIVE' AND created_at::date = CURRENT_DATE`,
      [req.userId]
    );

    const tradesToday = todayRes.rows[0]?.trades_today || 0;
    const lossesToday = todayRes.rows[0]?.losses_today || 0;
    const dayPnl = Number(todayRes.rows[0]?.day_pnl || 0);

    res.json({
      tradesToday,
      maxTradesPerDay: 3,
      tradesRemaining: Math.max(0, 3 - tradesToday),
      consecutiveLosses: Math.min(2, lossesToday),
      maxConsecutiveLosses: 2,
      dayPnl,
      dailyDrawdownLimit: 10000,
      dailyHardDrawdownPct: 10.0,
      isHalted: tradesToday >= 3 || lossesToday >= 2,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
