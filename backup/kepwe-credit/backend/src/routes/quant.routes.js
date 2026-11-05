import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { requireProductAccess } from '../middleware/product-auth.js';
import { requireFeature, requireActiveSubscription, FEATURES } from '../middleware/feature-gate.js';
import { pool } from '../config/db.js';
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
import { runAngelOneLiveHealthCheck } from '../services/angel-one-live-health.service.js';
import { getAngelOneMarketFeed } from '../services/angel-one-market-feed.service.js';
import { getAngelOneSession, isAngelOneSessionError, markAngelOneSessionExpired } from '../services/angel-one-session.service.js';
import { tryCreateQuantNotification } from '../services/quant-notification.service.js';

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
  if (latestEventType === 'LIVE_DEPLOYED' || status === 'LIVE_ACTIVE') return 'LIVE / Angel One';
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

async function getLiveMarketSnapshot(userId) {
  // One verified Angel One feed shared with /live-health and the live runner.
  return getAngelOneMarketFeed(pool, userId);
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
      getLiveMarketSnapshot(req.userId),
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
      availableMargin: liveSnapshot.sessionConnected ? liveSnapshot.availableMargin : null,
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
        source: liveSnapshot.source || 'ANGEL_ONE',
        symbol: liveSnapshot.symbol || 'NIFTY 50',
        price: liveSnapshot.price || null,
        clientId: liveSnapshot.clientId || null,
        lastUpdated: liveSnapshot.lastUpdated || null,
        blocker: liveSnapshot.blocker || null,
        brokerStatus: liveSnapshot.broker?.status || null,
        marketDataStatus: liveSnapshot.marketData?.status || null,
        label: liveSnapshot.connected
          ? 'Market Feed: Live (Angel One)'
          : (liveSnapshot.marketData?.status === 'STALE' ? 'Market Feed: Angel One (last update not recent)' : 'Market Feed: Blocked'),
      },
      strategies: userStrategies,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/live-market', async (req, res, next) => {
  try {
    // Always a structured 200: broker.status and marketData.status carry the
    // truthful state (LIVE, STALE, AUTH_FAILED, RATE_LIMITED, NETWORK_ERROR, ...).
    const snapshot = await getLiveMarketSnapshot(req.userId);
    return res.json(snapshot);
  } catch (error) {
    return next(error);
  }
});

router.post('/live-health', async (req, res, next) => {
  try {
    const health = await runAngelOneLiveHealthCheck(pool, req.userId);
    // Structured 200 for every determinable outcome; `ready` and `code` carry the verdict.
    res.json({
      ...health,
      status: health.ready ? 'PASS' : (health.status || 'BLOCKED'),
      code: health.code || (health.ready ? 'LIVE_EXECUTION_READY' : 'LIVE_EXECUTION_BLOCKED'),
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
 * Real stored analytics derived from LIVE Angel One orders, trades, and backtest records only.
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
    // Gate inputs are derived server-side only; the request body is ignored so
    // clients cannot assert their own validation evidence.
    const brokerGate = await validateLiveDeploymentGate(req.userId);
    const strategyGate = validateNiftyScalpingDeploymentGate({});
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

    if (!gateResult.isDeployable) {
      await tryCreateQuantNotification(pool, {
        userId: req.userId,
        type: 'DEPLOYMENT_BLOCKED',
        title: 'Live deployment blocked',
        body: brokerGate.firstFailedPrerequisite
          ? `${brokerGate.firstFailedPrerequisite.label}: ${brokerGate.firstFailedPrerequisite.reason}`
          : 'One or more live prerequisites failed.',
        data: { firstFailedPrerequisite: brokerGate.firstFailedPrerequisite || null },
      });
    }
    res.json({ ...gateResult, firstFailedPrerequisite: brokerGate.firstFailedPrerequisite || null });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/quant/emergency-stop   body: { flattenPositions?: boolean }
 * Halts the live runner immediately (always) and records a KILL_SWITCH for the
 * IST day, which blocks restarting. Only when flattenPositions === true does it
 * place a MARKET exit order for every open Angel One position; those orders are
 * subject to Angel One's order-API prerequisites (static IP) and the real
 * outcome of each is returned.
 */
router.post('/emergency-stop', async (req, res, next) => {
  try {
    const userId = req.userId;
    const flatten = req.body?.flattenPositions === true;
    await pool.query(`UPDATE algo_states SET status = 'STOPPED', updated_at = NOW() WHERE user_id = $1`, [userId]);
    await pool.query(
      `INSERT INTO risk_events (user_id, event_type, reason, severity, metadata)
       VALUES ($1, 'KILL_SWITCH', 'Emergency stop triggered by user', 'CRITICAL', $2::jsonb)`,
      [userId, JSON.stringify({ flattenPositions: flatten })],
    );
    try {
      await pool.query(
        `INSERT INTO quant_deployment_events (user_id, event_type, reason) VALUES ($1, 'KILL_SWITCH_TRIGGERED', $2)`,
        [userId, flatten ? 'Emergency stop with exit-all-positions request' : 'Emergency stop (halt only)'],
      );
    } catch (_) { /* audit row is best-effort; the halt above is authoritative */ }

    let flattenResult = { requested: false };
    if (flatten) {
      const session = await getAngelOneSession(pool, userId);
      if (!session.adapter || session.row.status !== 'CONNECTED') {
        flattenResult = { requested: true, accepted: false, code: 'BROKER_UNAVAILABLE', reason: 'No verified LIVE Angel One session; positions were not exited.' };
      } else {
        try {
          const exit = await session.adapter.exitAllPositions();
          const pending = exit.placed.length > 0
            ? await pool.query(
              `UPDATE algo_positions SET status = 'EMERGENCY_PENDING', updated_at = NOW()
               WHERE user_id = $1 AND status = 'OPEN' RETURNING id`,
              [userId],
            )
            : { rows: [] };
          flattenResult = {
            requested: true,
            accepted: exit.failed.length === 0,
            code: exit.failed.length === 0 ? null : 'PARTIAL_EXIT',
            reason: exit.failed.length === 0 ? null : `${exit.failed.length} of ${exit.openPositions} exit order(s) were refused by Angel One: ${exit.failed[0].reason}`,
            openPositions: exit.openPositions,
            exitOrdersPlaced: exit.placed.length,
            exitOrdersFailed: exit.failed,
            positionsPendingConfirmation: pending.rows.length,
          };
        } catch (error) {
          if (isAngelOneSessionError(error)) await markAngelOneSessionExpired(pool, session.row.id);
          flattenResult = {
            requested: true,
            accepted: false,
            code: error?.code === 'STATIC_IP_NOT_READY' ? 'STATIC_IP_NOT_READY' : 'BROKER_REJECTED',
            reason: error.message,
            brokerErrorCode: error?.providerErrorCode ?? null,
          };
        }
      }
    }
    await tryCreateQuantNotification(pool, {
      userId,
      type: 'EMERGENCY_STOP',
      title: 'Emergency stop activated',
      body: flattenResult.requested
        ? (flattenResult.accepted ? 'Live trading halted and Angel One accepted an exit order for every open position.' : `Live trading halted. Exit-all was NOT completed: ${flattenResult.reason}`)
        : 'Live trading halted. Open positions were not changed.',
      data: flattenResult,
    });
    res.json({ halted: true, status: 'STOPPED', killSwitchForToday: true, flatten: flattenResult, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quant/risk/status
 * Get real-time daily risk controller status from live Angel One account
 * Requires RISK_MANAGEMENT feature (available in trial)
 */
router.get('/risk/status', requireFeature(FEATURES.RISK_MANAGEMENT), async (req, res, next) => {
  try {
    // Limits come from the user's stored algo_settings; counts from executed LIVE trades (IST trading day).
    const [settingsRes, tradesRes, haltRes] = await Promise.all([
      pool.query('SELECT max_trades_per_day, max_consecutive_losses, daily_loss_limit, trading_capital FROM algo_settings WHERE user_id = $1', [req.userId]),
      pool.query(
        `SELECT pnl, traded_at FROM algo_trades
         WHERE user_id = $1 AND status = 'LIVE'
           AND (traded_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         ORDER BY traded_at DESC`,
        [req.userId],
      ),
      pool.query(
        `SELECT 1 FROM risk_events WHERE user_id = $1 AND event_type = 'KILL_SWITCH'
           AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date LIMIT 1`,
        [req.userId],
      ),
    ]);
    const settings = settingsRes.rows[0] || null;
    const trades = tradesRes.rows;
    let consecutiveLosses = 0;
    for (const trade of trades) {
      if (Number(trade.pnl) < 0) consecutiveLosses += 1;
      else if (Number(trade.pnl) > 0) break;
    }
    const dayPnl = Number(trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0).toFixed(2));
    const maxTradesPerDay = settings ? Number(settings.max_trades_per_day) : null;
    const maxConsecutiveLosses = settings ? Number(settings.max_consecutive_losses) : null;
    const dailyLossLimit = settings ? Number(settings.daily_loss_limit) : null;
    const halted = haltRes.rows.length > 0
      || (maxTradesPerDay !== null && trades.length >= maxTradesPerDay)
      || (maxConsecutiveLosses !== null && consecutiveLosses >= maxConsecutiveLosses)
      || (dailyLossLimit !== null && dailyLossLimit > 0 && -dayPnl >= dailyLossLimit);
    res.json({
      configured: Boolean(settings),
      tradesToday: trades.length,
      maxTradesPerDay,
      tradesRemaining: maxTradesPerDay === null ? null : Math.max(0, maxTradesPerDay - trades.length),
      consecutiveLosses,
      maxConsecutiveLosses,
      dayPnl,
      dailyDrawdownLimit: dailyLossLimit,
      isHalted: halted,
      killSwitchToday: haltRes.rows.length > 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
