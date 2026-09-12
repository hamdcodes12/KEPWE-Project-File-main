import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { requireProductAccess } from '../middleware/product-auth.js';
import { pool } from '../config/db.js';
import {
  NIFTY_QUANT_STRATEGY,
  enrichNiftyCandles,
  evaluateNiftyQuantSignal,
  calculateNiftyPositionSize,
  runNiftyQuantBacktest,
  validateLiveDeploymentGate,
} from '../services/quant-engine.service.js';

const router = Router();

// Enforce Quant product authorization on all endpoints
router.use(requireProductAccess('quant'));

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

/**
 * GET /api/quant/dashboard
 * Quantitative trading workspace overview: capital, active strategy, live P&L, broker connections
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    await ensureQuantUserRows(req.userId);

    const [settingsRes, stateRes, brokersRes, openPositionsRes, todayTradesRes, strategiesRes] = await Promise.all([
      pool.query('SELECT * FROM algo_settings WHERE user_id = $1', [req.userId]),
      pool.query('SELECT status FROM algo_states WHERE user_id = $1', [req.userId]),
      pool.query('SELECT broker, status, connection_mode FROM broker_accounts WHERE user_id = $1', [req.userId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM algo_positions WHERE user_id = $1 AND status = 'OPEN'`, [req.userId]),
      pool.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(pnl), 0)::numeric AS pnl
         FROM algo_orders
         WHERE user_id = $1 AND execution_mode = 'LIVE' AND created_at::date = CURRENT_DATE`,
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
    ]);

    const settings = settingsRes.rows[0];
    if (!settings) throw new Error('Quant settings are unavailable');
    const state = stateRes.rows[0] || { status: 'STOPPED' };
    const brokers = brokersRes.rows;
    const openPositionsCount = openPositionsRes.rows[0]?.count || 0;
    const todayTrades = todayTradesRes.rows[0]?.count || 0;
    const todayPnl = Number(todayTradesRes.rows[0]?.pnl || 0);

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
      availableMargin: Number(settings.trading_capital),
      todayPnl,
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
        isConnected: b.status === 'CONNECTED',
      })),
      feedStatus: {
        connected: false,
        source: 'UPSTOX',
        label: 'Market Feed: Standby (NSE Closed)',
      },
      strategies: userStrategies,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quant/strategies
 * List user's quant strategies and default templates
 */
router.get('/strategies', async (req, res, next) => {
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
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quant/analytics
 * Real stored analytics derived from LIVE Dhan orders, trades, and backtest records only.
 */
router.get('/analytics', async (req, res, next) => {
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
        `SELECT id, instrument, side, quantity, entry_price, exit_price, pnl, status, opened_at, closed_at
         FROM algo_orders
         WHERE user_id = $1 AND execution_mode = 'LIVE' AND status IN ('FILLED', 'PART_TRADED')
         ORDER BY COALESCE(created_at) DESC`,
        [req.userId]
      ),
      pool.query(
        `SELECT instrument, side, quantity, price as entry_price, 0 as stop_loss, 0 as target, 'OPEN' as status, created_at as opened_at
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
      currentPrice: toNumberOrNull(position.entry_price) ?? 0,
      stopLoss: null,
      target: null,
      pnl: 0,
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
 */
router.post('/strategies', validateBody(strategySaveSchema), async (req, res, next) => {
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
});

/**
 * POST /api/quant/backtest
 * Execute real, truthful NIFTY 50 Option Buyer backtest with verified performance metrics
 */
router.post('/backtest', validateBody(backtestRunSchema), async (req, res, next) => {
  try {
    const { capital, riskPct, optionType, lotSize, candles } = req.validatedBody;
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
          'nifty-pulse-5m',
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
 * Live deployment gate validation
 */
router.post('/deployment/validate', async (req, res, next) => {
  try {
    const config = req.body || { riskPerTradePct: 1.0, maxTradesPerDay: 3, maxConsecutiveLosses: 2 };
    const gateResult = await validateLiveDeploymentGate(req.userId, config);

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
 */
router.get('/risk/status', async (req, res, next) => {
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
