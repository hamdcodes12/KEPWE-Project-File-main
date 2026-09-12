import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { requireAnyProductAccess, requireProductAccess } from '../middleware/product-auth.js';
import { pool, withRLSContext } from '../config/db.js';
import { calculateTarget, evaluateSignal, generateSignal, isTradingWindowActive, DEFAULT_STRATEGY_CONFIG, STRATEGY_NAME, STRATEGY_SLUG } from '../algo/strategy.js';
import { evaluateRisk, sizePosition } from '../algo/risk-engine.js';
import { getBrokerAdapter, getBrokerReadiness } from '../algo/broker-adapters.js';
import { runBacktest } from '../algo/backtest.js';
import { applyExecutionUpdate, createAndSubmitOrder, cancelOrder, modifyOrder } from '../algo/oms.js';
import { comparePositions } from '../algo/reconciliation.js';
import { stopActiveAlgosForMarketDisconnect } from '../algo/runner.js';
import upstoxService from '../services/upstox.service.js';
import { decryptBrokerSecret } from '../services/broker-token.service.js';

const router = Router();
router.use(['/algo/broker', '/broker'], requireAnyProductAccess(['indexpilot', 'quant']));
router.use((req, res, next) => {
  if (req.path.startsWith('/broker') || req.path.startsWith('/algo/broker')) {
    return next();
  }
  if (req.path.startsWith('/algo') || req.path.startsWith('/indexpilot')) {
    return requireProductAccess('indexpilot')(req, res, next);
  }
  next();
});

const settingsSchema = z.object({
  tradingCapital: z.number().min(0).max(100000000),
  riskPerTrade: z.union([z.literal(0.5), z.literal(1), z.literal(2), z.literal(5)]),
  riskReward: z.number().positive().max(100),
  maxTradesPerDay: z.number().int().min(0).max(100),
  maxConsecutiveLosses: z.number().int().min(0).max(100),
  dailyLossLimit: z.number().min(0).max(100000000),
});

const brokerSchema = z.object({ broker: z.enum(['DHAN', 'ANGEL_ONE']) });
const candlesSchema = z.array(z.object({
  timestamp: z.union([z.string(), z.number()]),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
})).min(30).max(20000);
const backtestSchema = z.object({
  candles: candlesSchema,
  instrument: z.string().trim().min(1).max(80).default('NIFTY 50'),
  timeframe: z.enum(['5m', '15m']).default('5m'),
  capital: z.number().positive().max(100000000),
  riskPerTrade: z.union([z.literal(0.5), z.literal(1), z.literal(2), z.literal(5)]),
  riskReward: z.number().positive().max(10).default(2),
  chargesBps: z.number().min(0).max(100).default(5),
  slippageBps: z.number().min(0).max(100).default(2),
  lotSize: z.number().int().positive().max(100000).default(1),
});
const signalSchema = z.object({
  candles: candlesSchema,
  index: z.number().int().min(0).optional(),
  riskReward: z.number().positive().max(10).optional(),
});
const paperOrderSchema = z.object({
  strategyId: z.string().uuid().nullable().optional(),
  instrument: z.string().trim().min(1).max(80),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().int().positive().max(1000000),
  price: z.number().positive(),
  stopLoss: z.number().positive(),
  target: z.number().positive().optional(),
  slippageBps: z.number().min(0).max(100).default(2),
  chargesBps: z.number().min(0).max(100).default(5),
  lifecycleStatus: z.enum(['PENDING', 'FILLED', 'REJECTED']).default('FILLED'),
  marketTimestamp: z.union([z.string(), z.number()]).optional(),
});
const marketUpdateSchema = z.object({
  price: z.number().positive(),
  timestamp: z.union([z.string(), z.number()]).optional(),
});
const orderChangesSchema = z.object({
  price: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  target: z.number().positive().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one order field is required');
const executionUpdateSchema = z.object({
  orderId: z.string().uuid().optional(),
  brokerOrderId: z.string().trim().min(1).max(120).optional(),
  status: z.string().trim().min(1).max(60),
  filledQuantity: z.number().int().nonnegative().optional(),
  averagePrice: z.number().positive().optional(),
  rejectionReason: z.string().trim().max(500).optional(),
}).refine((value) => value.orderId || value.brokerOrderId, 'orderId or brokerOrderId is required');
const liveOrderSchema = z.object({
  broker: z.enum(['DHAN', 'ANGEL_ONE']),
  strategyId: z.string().uuid().nullable().optional(),
  instrument: z.string().trim().min(1).max(80),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().int().positive().max(1000000),
  price: z.number().positive().optional(),
  stopLoss: z.number().positive(),
  target: z.number().positive().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

async function ensureAlgoRows(userId) {
  await pool.query(
    `INSERT INTO algo_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await pool.query(
    `INSERT INTO algo_states (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

function serializeSettings(row) {
  return {
    tradingCapital: Number(row.trading_capital),
    riskPerTrade: Number(row.risk_per_trade),
    riskReward: Number(row.risk_reward),
    maxTradesPerDay: row.max_trades_per_day,
    maxConsecutiveLosses: row.max_consecutive_losses,
    dailyLossLimit: Number(row.daily_loss_limit),
  };
}

function serializeStrategy(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    instrument: row.instrument,
    style: row.style,
    timeframe: row.timeframe,
    riskReward: row.risk_reward,
    maxTradesPerDay: row.max_trades_per_day,
    description: row.description,
  };
}

function serializeOrder(row) {
  return {
    id: row.id,
    internalOrderId: row.internal_order_id,
    brokerOrderId: row.broker_order_id,
    strategyId: row.strategy_id,
    executionMode: row.execution_mode,
    instrument: row.instrument,
    side: row.side,
    quantity: row.quantity,
    filledQuantity: row.filled_quantity ?? 0,
    price: Number(row.price),
    averageFillPrice: row.average_fill_price == null ? null : Number(row.average_fill_price),
    stopLoss: row.stop_loss == null ? null : Number(row.stop_loss),
    target: row.target == null ? null : Number(row.target),
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}



async function recordActivity(userId, eventType, message, metadata = {}) {
  await pool.query(
    `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [userId, eventType, message, JSON.stringify(metadata)]
  );
}

async function recordRiskEvent(userId, eventType, reason, metadata = {}, severity = 'HIGH') {
  await pool.query(
    `INSERT INTO risk_events (user_id, event_type, reason, severity, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, eventType, reason, severity, JSON.stringify(metadata)]
  );
  await recordActivity(userId, 'RISK_EVENT', reason, { eventType, ...metadata });
}

async function stopForMarketDisconnect(userId, reason = 'Verified market data is unavailable; new orders stopped') {
  await pool.query(
    `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
     WHERE user_id = $1 AND status = 'ACTIVE'`,
    [userId]
  );
  await recordRiskEvent(userId, 'MARKET_DATA_DISCONNECT', reason, {}, 'HIGH');
}

async function stopForBrokerDisconnect(userId, broker, reason) {
  await pool.query(
    `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
     WHERE user_id = $1 AND status = 'ACTIVE'`,
    [userId],
  );
  await recordRiskEvent(userId, 'BROKER_DISCONNECT', reason, { broker }, 'HIGH');
}

async function assertMarketDataAvailable() {
  const quotes = await upstoxService.getIndexQuotes(['NIFTY']);
  const price = Number(quotes[0]?.data?.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Verified market data is unavailable');
  }
  return price;
}

async function getLiveBroker(req, broker) {
  const readiness = getBrokerReadiness(broker, 'LIVE');
  if (!readiness.enabled) {
    const error = new Error(readiness.reason || `${broker} is not configured for live execution`);
    error.statusCode = 503;
    throw error;
  }
  const account = await pool.query(
    `SELECT broker, status, connection_mode, client_id
     FROM broker_accounts
     WHERE user_id = $1 AND broker = $2`,
    [req.userId, broker],
  );
  if (account.rows[0]?.status !== 'CONNECTED' || account.rows[0]?.connection_mode !== 'LIVE') {
    const error = new Error(`${broker} is not connected in LIVE mode for this user`);
    error.statusCode = 409;
    throw error;
  }
  if (broker === 'DHAN') {
    const token = await pool.query(
      `SELECT access_token_ciphertext
       FROM broker_oauth_tokens t
       JOIN broker_accounts a ON a.id = t.broker_account_id
       WHERE t.user_id = $1 AND a.broker = 'DHAN' AND a.status = 'CONNECTED'`,
      [req.userId],
    );
    const encrypted = token.rows[0]?.access_token_ciphertext;
    if (!encrypted) {
      const error = new Error('DHAN authentication is required before live execution');
      error.statusCode = 409;
      throw error;
    }
    return getBrokerAdapter(broker, 'LIVE', {
      dhanClientId: account.rows[0]?.client_id,
      accessToken: decryptBrokerSecret(encrypted),
    });
  }
  return getBrokerAdapter(broker, 'LIVE');
}

async function adapterForOrder(req, order) {
  return getLiveBroker(req, order.metadata?.broker);
}

router.use(['/algo/broker', '/broker', '/algo', '/indexpilot'], requireAuth);

router.get(['/algo/dashboard', '/indexpilot/dashboard'], async (req, res, next) => {
  try {
    await ensureAlgoRows(req.userId);
    const result = await withRLSContext(req.userId, async (client) => {
      const [state, settings, broker, counts] = await Promise.all([
        client.query('SELECT status FROM algo_states WHERE user_id = $1', [req.userId]),
        client.query('SELECT * FROM algo_settings WHERE user_id = $1', [req.userId]),
        client.query(`SELECT broker, status, connection_mode, connected_at FROM broker_accounts WHERE user_id = $1 ORDER BY broker`, [req.userId]),
        client.query(
          `SELECT
             (SELECT COUNT(*) FROM algo_positions WHERE user_id = $1 AND status = 'OPEN')::int AS open_positions,
             (SELECT COUNT(*) FROM algo_orders WHERE user_id = $1 AND status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED'))::int AS today_trades,
             COALESCE(0, 0) AS today_pnl`,
          [req.userId]
        ),
      ]);
      return { state: state.rows[0], settings: settings.rows[0], brokers: broker.rows, counts: counts.rows[0] };
    });
    res.json({
      balance: Number(result.settings.trading_capital),
      todayPnl: Number(result.counts.today_pnl),
      openPositions: result.counts.open_positions,
      todayTrades: result.counts.today_trades,
      algoStatus: result.state.status,
      settings: serializeSettings(result.settings),
      brokers: result.brokers.map((row) => ({
        broker: row.broker,
        status: row.status,
        mode: row.connection_mode,
        connectedAt: row.connected_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get(['/algo/strategies', '/indexpilot/strategies'], async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM algo_strategies WHERE is_active = TRUE ORDER BY created_at');
    res.json({ strategies: result.rows.map(serializeStrategy) });
  } catch (err) {
    next(err);
  }
});

router.get(['/algo/settings', '/indexpilot/settings'], async (req, res, next) => {
  try {
    await ensureAlgoRows(req.userId);
    const result = await pool.query('SELECT * FROM algo_settings WHERE user_id = $1', [req.userId]);
    res.json(serializeSettings(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put(['/algo/settings', '/indexpilot/settings'], validateBody(settingsSchema), async (req, res, next) => {
  try {
    const settings = req.validatedBody;
    await ensureAlgoRows(req.userId);
    const result = await pool.query(
      `UPDATE algo_settings SET trading_capital = $2, risk_per_trade = $3, risk_reward = $4,
       max_trades_per_day = $5, max_consecutive_losses = $6, daily_loss_limit = $7, updated_at = NOW()
       WHERE user_id = $1 RETURNING *`,
      [req.userId, settings.tradingCapital, settings.riskPerTrade, settings.riskReward, settings.maxTradesPerDay, settings.maxConsecutiveLosses, settings.dailyLossLimit]
    );
    await recordActivity(req.userId, 'SETTINGS_CHANGED', 'Risk settings changed');
    res.json(serializeSettings(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

async function setAlgoStatus(req, res, next, status) {
  try {
    await ensureAlgoRows(req.userId);
    if (status === 'ACTIVE') {
      if (req.body?.confirmRisk !== true) {
        return res.status(400).json({ error: 'Explicit risk confirmation is required before activation.' });
      }
      // LIVE-only: no paper mode check needed
      const settings = await pool.query('SELECT trading_capital, risk_per_trade FROM algo_settings WHERE user_id = $1', [req.userId]);
      if (!settings.rows[0] || Number(settings.rows[0].trading_capital) <= 0) {
        return res.status(409).json({ error: 'Configure trading capital greater than zero before activation.' });
      }
      try {
        await assertMarketDataAvailable();
      } catch {
        await stopForMarketDisconnect(req.userId);
        return res.status(503).json({ error: 'Verified market data is unavailable; the algo remains stopped.' });
      }
      const halted = await pool.query(
        `SELECT 1 FROM risk_events
         WHERE user_id = $1 AND event_type = 'KILL_SWITCH' AND created_at::date = CURRENT_DATE
         LIMIT 1`,
        [req.userId]
      );
      if (halted.rows.length > 0) {
        return res.status(409).json({ error: 'A daily kill switch has stopped this session. Review risk events before restarting.' });
      }
    }
    await pool.query('UPDATE algo_states SET status = $2, updated_at = NOW() WHERE user_id = $1', [req.userId, status]);
    await recordActivity(req.userId, status === 'ACTIVE' ? 'ALGO_STARTED' : 'ALGO_STOPPED', `Algo ${status === 'ACTIVE' ? 'started' : 'stopped'}`);
    res.json({ status });
  } catch (err) {
    next(err);
  }
}

router.post('/algo/start', (req, res, next) => setAlgoStatus(req, res, next, 'ACTIVE'));
router.post('/algo/stop', (req, res, next) => setAlgoStatus(req, res, next, 'STOPPED'));

router.get('/algo/positions', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT symbol, side, quantity, entry_price, current_price, stop_loss, target, pnl, status FROM algo_positions WHERE user_id = $1 AND status = 'OPEN' ORDER BY opened_at DESC`, [req.userId]);
    res.json({ positions: result.rows.map((row) => ({ symbol: row.symbol, side: row.side, quantity: row.quantity, entry: Number(row.entry_price), current: Number(row.current_price), stopLoss: row.stop_loss == null ? null : Number(row.stop_loss), target: row.target == null ? null : Number(row.target), pnl: Number(row.pnl), status: row.status })) });
  } catch (err) {
    next(err);
  }
});

router.get('/algo/trades', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT t.traded_at, t.symbol, COALESCE(s.name, 'Unassigned') AS strategy, t.side, t.entry_price, t.exit_price, t.quantity, t.pnl, t.status
       FROM algo_trades t LEFT JOIN algo_strategies s ON s.id = t.strategy_id WHERE t.user_id = $1 ORDER BY t.traded_at DESC LIMIT 100`,
      [req.userId]
    );
    res.json({ trades: result.rows.map((row) => ({ date: row.traded_at, symbol: row.symbol, strategy: row.strategy, side: row.side, entry: row.entry_price == null ? null : Number(row.entry_price), exit: row.exit_price == null ? null : Number(row.exit_price), quantity: row.quantity, pnl: Number(row.pnl), status: row.status })) });
  } catch (err) {
    next(err);
  }
});

router.get('/algo/activity', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT event_type, message, created_at FROM algo_activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25`, [req.userId]);
    res.json({ activity: result.rows.map((row) => ({ type: row.event_type, message: row.message, createdAt: row.created_at })) });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/connect', validateBody(brokerSchema), async (req, res, next) => {
  try {
    const { broker } = req.validatedBody;
    // KEPWE Quant LIVE-ONLY: SANDBOX connections are not allowed
    return res.status(403).json({ 
      error: 'KEPWE Quant requires real broker authentication. Sandbox connections are not supported. Please connect your real Dhan account.' 
    });
  } catch (err) {
    next(err);
  }
});

function isDhanSessionRejected(error) {
  const code = Number(error?.statusCode || error?.status || error?.response?.status);
  return [401, 403].includes(code) || /unauthorized|token expired|invalid token/i.test(error?.message || '');
}

async function validateStoredDhanSession(row) {
  if (!row.access_token_ciphertext) {
    // No token stored - session is invalid
    await pool.query(
      `UPDATE broker_accounts
       SET status = 'NOT_CONNECTED', connection_mode = 'LIVE', updated_at = NOW()
       WHERE id = $1`,
      [row.id],
    );
    return { ...row, status: 'NOT_CONNECTED', mode: 'LIVE' };
  }

  let accessToken;
  try {
    accessToken = decryptBrokerSecret(row.access_token_ciphertext);
  } catch {
    await pool.query(
      `UPDATE broker_accounts
       SET status = 'NOT_CONNECTED', connection_mode = 'LIVE', updated_at = NOW()
       WHERE id = $1`,
      [row.id],
    );
    return { ...row, status: 'SESSION_EXPIRED', mode: 'LIVE' };
  }

  try {
    const adapter = getBrokerAdapter('DHAN', 'LIVE', { dhanClientId: row.client_id, accessToken });
    await adapter.validateSession();
    if (row.status !== 'CONNECTED' || row.connection_mode !== 'LIVE') {
      await pool.query(
        `UPDATE broker_accounts
         SET status = 'CONNECTED', connection_mode = 'LIVE', connected_at = COALESCE(connected_at, NOW()), updated_at = NOW()
         WHERE id = $1`,
        [row.id],
      );
    }
    return { ...row, status: 'CONNECTED', mode: 'LIVE' };
  } catch (error) {
    if (!isDhanSessionRejected(error)) {
      console.warn('[BROKER_STATUS] Dhan validation transient error, preserving active session:', error.message);
      return { ...row, status: row.status || 'CONNECTED', mode: row.connection_mode || 'LIVE' };
    }
    await pool.query(
      `UPDATE broker_accounts
       SET status = 'NOT_CONNECTED', connection_mode = 'LIVE', updated_at = NOW()
       WHERE id = $1`,
      [row.id],
    );
    console.log('[BROKER_STATUS]', JSON.stringify({
      userId: row.user_id,
      broker: 'DHAN',
      timestamp: new Date().toISOString(),
      status: 'DHAN_SESSION_EXPIRED',
      reason: 'Dhan validation rejected token with status ' + error.statusCode,
    }));
    return { ...row, status: 'SESSION_EXPIRED', mode: 'LIVE' };
  }
}

/**
 * Standardized single-broker status endpoint:
 * GET /api/algo/broker/DHAN/status and GET /api/broker/DHAN/status
 * Returns stable { connected, broker, status, executionMode, clientId, sessionValid }
 * Strictly never returns tokens.
 */
router.get(['/algo/broker/:broker/status', '/broker/:broker/status'], async (req, res, next) => {
  try {
    const broker = req.params.broker.toUpperCase();
    if (broker !== 'DHAN') {
      return res.status(400).json({ error: `Unsupported broker: ${broker}` });
    }

    const result = await pool.query(
      `SELECT a.id, a.user_id, a.broker, a.client_id, a.status, a.connection_mode, a.connected_at,
              t.access_token_ciphertext
       FROM broker_accounts a
       LEFT JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.user_id = $1 AND a.broker = 'DHAN'`,
      [req.userId]
    );

    if (result.rows.length === 0 || result.rows[0].status !== 'CONNECTED' || !result.rows[0].access_token_ciphertext) {
      const row = result.rows[0];
      const statusStr = (row?.status === 'SESSION_EXPIRED' || (row?.access_token_ciphertext && row?.status === 'NOT_CONNECTED'))
        ? 'DHAN_SESSION_EXPIRED'
        : 'DISCONNECTED';
      console.log('[BROKER_STATUS]', JSON.stringify({
        userId: req.userId,
        broker: 'DHAN',
        timestamp: new Date().toISOString(),
        status: statusStr,
        reason: 'No active Dhan connection in database',
      }));
      return res.json({
        connected: false,
        broker: 'DHAN',
        status: statusStr,
        executionMode: row?.connection_mode || 'LIVE',
        clientId: row?.client_id || null,
        sessionValid: false,
      });
    }

    const row = result.rows[0];
    const validated = await validateStoredDhanSession(row);

    const isConnected = validated.status === 'CONNECTED';
    const isExpired = validated.status === 'SESSION_EXPIRED' || validated.status === 'DHAN_SESSION_EXPIRED';
    const finalStatus = isConnected ? 'CONNECTED' : (isExpired ? 'DHAN_SESSION_EXPIRED' : 'DISCONNECTED');

    console.log('[BROKER_STATUS]', JSON.stringify({
      userId: req.userId,
      broker: 'DHAN',
      timestamp: new Date().toISOString(),
      status: finalStatus,
      reason: isConnected ? 'Active live Dhan session confirmed' : (isExpired ? 'Dhan session expired on provider' : 'Dhan not connected'),
    }));

    return res.json({
      connected: isConnected,
      broker: 'DHAN',
      status: finalStatus,
      executionMode: validated.mode || validated.connection_mode || 'LIVE',
      clientId: validated.client_id || null,
      sessionValid: isConnected,
      connectedAt: validated.connected_at || null,
    });
  } catch (err) {
    console.log('[BROKER_STATUS]', JSON.stringify({
      userId: req.userId,
      broker: req.params.broker?.toUpperCase() || 'DHAN',
      timestamp: new Date().toISOString(),
      status: 'ERROR',
      reason: err.message || 'Error checking broker status',
    }));
    next(err);
  }
});

router.get(['/algo/broker/status', '/broker/status'], async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.user_id, a.broker, a.client_id, a.status, a.connection_mode, a.connected_at,
              t.access_token_ciphertext
       FROM broker_accounts a
       LEFT JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.user_id = $1
       ORDER BY a.broker`,
      [req.userId],
    );
    const brokers = [];
    let dhanPayload = null;
    for (const row of result.rows) {
      const validated = row.broker === 'DHAN' ? await validateStoredDhanSession(row) : row;
      const entry = {
        broker: validated.broker,
        clientId: validated.client_id || null,
        status: validated.status,
        mode: validated.mode || validated.connection_mode,
        connectedAt: validated.connected_at,
      };
      brokers.push(entry);
      if (row.broker === 'DHAN') {
        const isConn = validated.status === 'CONNECTED';
        dhanPayload = {
          connected: isConn,
          broker: 'DHAN',
          status: isConn ? 'CONNECTED' : (validated.status === 'SESSION_EXPIRED' ? 'DHAN_SESSION_EXPIRED' : 'DISCONNECTED'),
          executionMode: entry.mode || 'LIVE',
          clientId: entry.clientId,
          sessionValid: isConn,
          connectedAt: entry.connectedAt,
        };
      }
    }
    res.json({ brokers, dhan: dhanPayload });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/disconnect', validateBody(brokerSchema), async (req, res, next) => {
  try {
    const { broker } = req.validatedBody;
    const result = await pool.query(
      `UPDATE broker_accounts
       SET status = 'NOT_CONNECTED', connection_mode = 'LIVE', updated_at = NOW()
       WHERE user_id = $1 AND broker = $2
       RETURNING broker, status, connection_mode, connected_at`,
      [req.userId, broker],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `${broker} is not connected for this account.` });
    }
    if (broker === 'DHAN') {
      await pool.query(
        `DELETE FROM broker_oauth_tokens
         WHERE broker_account_id = (SELECT id FROM broker_accounts WHERE user_id = $1 AND broker = $2)`,
        [req.userId, broker],
      );
    }
    await pool.query(
      `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [req.userId],
    );
    await recordActivity(req.userId, 'BROKER_DISCONNECTED', `${broker} disconnected`, { mode: 'LIVE' });
    return res.json({
      broker: result.rows[0].broker,
      status: result.rows[0].status,
      mode: result.rows[0].connection_mode,
      connectedAt: result.rows[0].connected_at,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/broker/readiness', async (req, res, next) => {
  try {
    res.json({
      brokers: ['DHAN'].map((broker) => ({
        ...getBrokerReadiness(broker, 'LIVE'),
        broker,
      })),
      paper: getBrokerReadiness(null, 'PAPER'),
    });
  } catch (err) {
    next(err);
  }
});

router.get(['/algo/broker/:broker/positions', '/broker/:broker/positions'], async (req, res, next) => {
  try {
    const broker = req.params.broker.toUpperCase();
    const adapter = await getLiveBroker(req, broker);
    const positions = await adapter.getPositions();
    res.json({ positions, broker });
  } catch (err) {
    if (isDhanSessionRejected(err)) {
      console.log('[BROKER_STATUS]', JSON.stringify({
        userId: req.userId,
        broker: req.params.broker?.toUpperCase(),
        timestamp: new Date().toISOString(),
        status: 'DHAN_SESSION_EXPIRED',
        reason: 'Positions query detected expired broker session: ' + (err.message || 'Unauthorized'),
      }));
      return res.status(401).json({
        error: 'Dhan session has expired. Please reconnect your Dhan account.',
        code: 'DHAN_SESSION_EXPIRED',
        broker: req.params.broker?.toUpperCase(),
      });
    }
    next(err);
  }
});

router.get(['/algo/broker/:broker/holdings', '/broker/:broker/holdings'], async (req, res, next) => {
  try {
    const broker = req.params.broker.toUpperCase();
    const adapter = await getLiveBroker(req, broker);
    const holdings = await adapter.getHoldings();
    res.json({ holdings, broker });
  } catch (err) {
    if (isDhanSessionRejected(err)) {
      console.log('[BROKER_STATUS]', JSON.stringify({
        userId: req.userId,
        broker: req.params.broker?.toUpperCase(),
        timestamp: new Date().toISOString(),
        status: 'DHAN_SESSION_EXPIRED',
        reason: 'Holdings query detected expired broker session: ' + (err.message || 'Unauthorized'),
      }));
      return res.status(401).json({
        error: 'Dhan session has expired. Please reconnect your Dhan account.',
        code: 'DHAN_SESSION_EXPIRED',
        broker: req.params.broker?.toUpperCase(),
      });
    }
    next(err);
  }
});

router.get(['/algo/broker/:broker/funds', '/broker/:broker/funds'], async (req, res, next) => {
  try {
    const broker = req.params.broker.toUpperCase();
    const adapter = await getLiveBroker(req, broker);
    const funds = await adapter.getMargin();
    res.json({ funds, broker });
  } catch (err) {
    if (isDhanSessionRejected(err)) {
      console.log('[BROKER_STATUS]', JSON.stringify({
        userId: req.userId,
        broker: req.params.broker?.toUpperCase(),
        timestamp: new Date().toISOString(),
        status: 'DHAN_SESSION_EXPIRED',
        reason: 'Funds query detected expired broker session: ' + (err.message || 'Unauthorized'),
      }));
      return res.status(401).json({
        error: 'Dhan session has expired. Please reconnect your Dhan account.',
        code: 'DHAN_SESSION_EXPIRED',
        broker: req.params.broker?.toUpperCase(),
      });
    }
    next(err);
  }
});

router.get(['/algo/broker/:broker/orderbook', '/broker/:broker/orderbook'], async (req, res, next) => {
  try {
    const broker = req.params.broker.toUpperCase();
    const adapter = await getLiveBroker(req, broker);
    const orderbook = await adapter.getOrderBook();
    res.json({ orderbook, broker });
  } catch (err) {
    if (isDhanSessionRejected(err)) {
      console.log('[BROKER_STATUS]', JSON.stringify({
        userId: req.userId,
        broker: req.params.broker?.toUpperCase(),
        timestamp: new Date().toISOString(),
        status: 'DHAN_SESSION_EXPIRED',
        reason: 'Orderbook query detected expired broker session: ' + (err.message || 'Unauthorized'),
      }));
      return res.status(401).json({
        error: 'Dhan session has expired. Please reconnect your Dhan account.',
        code: 'DHAN_SESSION_EXPIRED',
        broker: req.params.broker?.toUpperCase(),
      });
    }
    next(err);
  }
});

router.get(['/algo/broker/:broker/tradebook', '/broker/:broker/tradebook'], async (req, res, next) => {
  try {
    const broker = req.params.broker.toUpperCase();
    const adapter = await getLiveBroker(req, broker);
    const trades = await adapter.getTradeBook();
    res.json({ trades, broker });
  } catch (err) {
    if (isDhanSessionRejected(err)) {
      console.log('[BROKER_STATUS]', JSON.stringify({
        userId: req.userId,
        broker: req.params.broker?.toUpperCase(),
        timestamp: new Date().toISOString(),
        status: 'DHAN_SESSION_EXPIRED',
        reason: 'Tradebook query detected expired broker session: ' + (err.message || 'Unauthorized'),
      }));
      return res.status(401).json({
        error: 'Dhan session has expired. Please reconnect your Dhan account.',
        code: 'DHAN_SESSION_EXPIRED',
        broker: req.params.broker?.toUpperCase(),
      });
    }
    next(err);
  }
});

router.post('/broker/connect/live', validateBody(brokerSchema), async (req, res, next) => {
  try {
    const { broker } = req.validatedBody;
    const adapter = getBrokerAdapter(broker, 'LIVE');
    await adapter.authenticate();
    const result = await pool.query(
      `INSERT INTO broker_accounts (user_id, broker, status, connection_mode, connected_at, updated_at)
       VALUES ($1, $2, 'CONNECTED', 'LIVE', NOW(), NOW())
       ON CONFLICT (user_id, broker) DO UPDATE
       SET status = 'CONNECTED', connection_mode = 'LIVE', connected_at = NOW(), updated_at = NOW()
       RETURNING broker, status, connection_mode, connected_at`,
      [req.userId, broker],
    );
    await recordActivity(req.userId, 'BROKER_CONNECTED', `${broker} live adapter authenticated`, { mode: 'LIVE' });
    res.json({ broker: result.rows[0].broker, status: result.rows[0].status, mode: result.rows[0].connection_mode, connectedAt: result.rows[0].connected_at });
  } catch (err) {
    next(err);
  }
});

async function getPaperRiskStats(userId) {
  // Stub: paper trading removed - returns empty stats
  return {
    todayTrades: 0,
    dailyLoss: 0,
    consecutiveLosses: 0,
  };
}

router.post('/algo/signal', validateBody(signalSchema), async (req, res, next) => {
  try {
    await ensureAlgoRows(req.userId);
    const { candles, index, riskReward } = req.validatedBody;
    const result = generateSignal(
      candles,
      index,
      riskReward === undefined ? DEFAULT_STRATEGY_CONFIG : { ...DEFAULT_STRATEGY_CONFIG, riskReward }
    );
    const settings = serializeSettings(
      (await pool.query('SELECT * FROM algo_settings WHERE user_id = $1', [req.userId])).rows[0]
    );
    const sizing = result.signal === 'NO_TRADE'
      ? { quantity: 0, riskAmount: 0, riskPerUnit: 0, reason: 'No trade candidate to size' }
      : sizePosition({
        settings,
        entryPrice: result.price,
        stopLoss: result.stopLoss,
        lotSize: 1,
        availableMargin: settings.tradingCapital,
      });
    res.json({
      strategy: { slug: STRATEGY_SLUG, name: STRATEGY_NAME, instrument: 'NIFTY 50', timeframe: '5m' },
      signal: { ...result, sizing, indicators: result.indicators?.at(-1) ? [result.indicators.at(-1)] : [] },
      disclaimer: 'Signal research only. A signal is not an order and does not guarantee a result.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/algo/backtest', validateBody(backtestSchema), async (req, res, next) => {
  try {
    const input = req.validatedBody;
    const results = runBacktest(input);
    const saved = await pool.query(
      `INSERT INTO algo_backtest_runs
        (user_id, strategy_slug, instrument, timeframe, from_date, to_date, parameters, results)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       RETURNING id, created_at`,
      [
        req.userId, STRATEGY_SLUG, input.instrument, input.timeframe,
        input.candles[0].timestamp, input.candles[input.candles.length - 1].timestamp,
        JSON.stringify({ capital: input.capital, riskPerTrade: input.riskPerTrade, riskReward: input.riskReward, chargesBps: input.chargesBps, slippageBps: input.slippageBps, lotSize: input.lotSize }),
        JSON.stringify(results),
      ]
    );
    await recordActivity(req.userId, 'BACKTEST_COMPLETED', `${STRATEGY_NAME} backtest completed`, { runId: saved.rows[0].id, metrics: results.metrics });
    res.status(201).json({ runId: saved.rows[0].id, ...results, simulatedOnly: true });
  } catch (err) {
    next(err);
  }
});

router.get('/algo/backtests', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, strategy_slug, instrument, timeframe, from_date, to_date, parameters, results, created_at
       FROM algo_backtest_runs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.userId]
    );
    res.json({ runs: result.rows.map((row) => ({ id: row.id, strategySlug: row.strategy_slug, instrument: row.instrument, timeframe: row.timeframe, fromDate: row.from_date, toDate: row.to_date, parameters: row.parameters, metrics: row.results?.metrics || {}, createdAt: row.created_at })) });
  } catch (err) {
    next(err);
  }
});

router.get('/algo/orders', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM algo_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.userId]
    );
    res.json({ orders: result.rows.map(serializeOrder) });
  } catch (err) {
    next(err);
  }
});

router.get('/algo/risk-events', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT event_type, reason, severity, metadata, created_at
       FROM risk_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json({ events: result.rows.map((row) => ({ type: row.event_type, reason: row.reason, severity: row.severity, metadata: row.metadata, createdAt: row.created_at })) });
  } catch (err) {
    next(err);
  }
});

router.get('/algo/metrics', async (req, res, next) => {
  try {
    // LIVE-only: paper metrics removed
    res.json({
      mode: 'LIVE',
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      netPnl: 0,
      averageWin: 0,
      averageLoss: 0,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/orders', validateBody(liveOrderSchema), async (req, res, next) => {
  try {
    await ensureAlgoRows(req.userId);
    const order = req.validatedBody;
    const state = await pool.query('SELECT status FROM algo_states WHERE user_id = $1', [req.userId]);
    if (state.rows[0]?.status !== 'ACTIVE') {
      const reason = 'Start the algo before submitting a live broker order';
      await recordRiskEvent(req.userId, 'ORDER_BLOCKED', reason, {}, 'WARN');
      return res.status(409).json({ error: reason });
    }
    const adapter = await getLiveBroker(req, order.broker);
    const settings = serializeSettings((await pool.query('SELECT * FROM algo_settings WHERE user_id = $1', [req.userId])).rows[0]);
    if (order.price === undefined) {
      return res.status(400).json({ error: 'A verified market price is required before submitting a live order.' });
    }
    const effectivePrice = order.price;
    let availableMargin = settings.tradingCapital;
    try {
      const margin = await adapter.getMargin();
      const brokerAvailable = Number(margin?.available ?? margin?.availableMargin ?? margin?.availablecash ?? margin?.net);
      if (Number.isFinite(brokerAvailable) && brokerAvailable >= 0) availableMargin = brokerAvailable;
    } catch (error) {
      await stopForBrokerDisconnect(req.userId, order.broker, 'Broker margin check failed; live orders stopped');
      return res.status(error.statusCode || 503).json({ error: 'Broker margin could not be verified; live orders are blocked.' });
    }
    const target = order.target ?? calculateTarget({ side: order.side, entryPrice: effectivePrice, stopLoss: order.stopLoss, riskReward: settings.riskReward });
    if (!target) return res.status(400).json({ error: 'A positive stop-loss distance is required to calculate the default target.' });
    const stats = await getPaperRiskStats(req.userId);
    const existing = await pool.query(
      `SELECT 1 FROM algo_positions WHERE user_id = $1 AND symbol = $2 AND status = 'OPEN' LIMIT 1`,
      [req.userId, order.instrument],
    );
    const duplicate = await pool.query(
      `SELECT 1 FROM algo_orders
       WHERE user_id = $1 AND instrument = $2
         AND status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED')
       LIMIT 1`,
      [req.userId, order.instrument],
    );
    const candidate = { signal: order.side, price: effectivePrice, stopLoss: order.stopLoss, target };
    const risk = evaluateRisk({
      candidate,
      settings,
      stats,
      existingPosition: existing.rows.length > 0,
      brokerHealthy: true,
      systemHealthy: true,
      duplicateOrder: duplicate.rows.length > 0,
      slippage: Number(order.metadata?.slippageBps || 0),
      maxSlippage: 50,
      availableMargin,
    });
    if (!risk.approved || order.quantity > risk.sizing.quantity) {
      const reason = !risk.approved ? risk.reason : 'Requested quantity exceeds configured risk size';
      await recordRiskEvent(req.userId, 'ORDER_BLOCKED', reason, { checks: risk.checks, requestedQuantity: order.quantity, sizing: risk.sizing });
      return res.status(409).json({ error: `Order blocked by risk engine: ${reason}`, risk });
    }
    const submitted = await createAndSubmitOrder({
      pool,
      adapter,
      userId: req.userId,
      strategyId: order.strategyId || null,
      executionMode: 'LIVE',
      instrument: order.instrument,
      side: order.side,
      quantity: order.quantity,
      price: effectivePrice,
      stopLoss: order.stopLoss,
      target,
      metadata: { ...(order.metadata || {}), broker: order.broker },
    });
    if (submitted.status === 'REJECTED') {
      await recordRiskEvent(req.userId, 'ORDER_REJECTED', submitted.rejection_reason || 'Broker rejected the order', { orderId: submitted.id, broker: order.broker });
      if (/API error|timed out|timeout|connection|unavailable/i.test(submitted.rejection_reason || '')) {
        await stopForBrokerDisconnect(req.userId, order.broker, 'Broker order request failed; live orders stopped');
      }
      return res.status(409).json({ error: submitted.rejection_reason || 'Broker rejected the order', order: serializeOrder(submitted) });
    }
    let execution = null;
    if (submitted.status === 'FILLED') {
      execution = await applyExecutionUpdate({
        pool,
        orderId: submitted.id,
        userId: req.userId,
        execution: { status: 'FILLED', brokerOrderId: submitted.broker_order_id, filledQuantity: submitted.quantity, averagePrice: submitted.price },
      });
    }
    await recordActivity(req.userId, 'LIVE_ORDER_SUBMITTED', `Live ${order.side} order submitted through ${order.broker}`, { orderId: submitted.id });
    return res.status(submitted.status === 'FILLED' ? 201 : 202).json({
      order: serializeOrder(execution?.order || submitted),
      risk,
      message: submitted.status === 'FILLED' ? 'Broker execution confirmed.' : 'Order submitted; awaiting broker execution updates.',
    });
  } catch (err) {
    if (err.statusCode >= 500 || err.name === 'BrokerApiError') {
      await stopForBrokerDisconnect(req.userId, req.validatedBody?.broker, 'Broker API error; live orders stopped');
    }
    next(err);
  }
});

router.get('/algo/reconciliation', async (req, res, next) => {
  try {
    const [positions, orders] = await Promise.all([
      pool.query(`SELECT symbol AS instrument, side, quantity, entry_price FROM algo_positions WHERE user_id = $1 AND status = 'OPEN'`, [req.userId]),
      pool.query(`SELECT instrument, side, quantity, price as entry_price FROM algo_orders WHERE user_id = $1 AND status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED')`, [req.userId]),
    ]);
    res.json(comparePositions(orders.rows, positions.rows));
  } catch (err) {
    next(err);
  }
});

router.get('/broker/:broker/pnl', async (req, res, next) => {
  try {
    const adapter = await getLiveBroker(req, req.params.broker.toUpperCase());
    const positions = await adapter.getPositions();
    const supportedUnrealized = positions
      .map((position) => position?.unrealizedPnl ?? position?.unrealisedPnl ?? position?.pnl)
      .filter((value) => value !== undefined && value !== null && Number.isFinite(Number(value)));
    return res.json({
      broker: req.params.broker,
      realizedPnl: null,
      unrealizedPnl: supportedUnrealized.length > 0
        ? Number(supportedUnrealized.reduce((total, value) => total + Number(value), 0).toFixed(2))
        : null,
      realizedSupported: false,
      unrealizedSupported: supportedUnrealized.length > 0,
      message: supportedUnrealized.length > 0
        ? 'Unrealized P&L is aggregated from provider position fields.'
        : 'The broker did not provide a documented P&L field for the current positions.',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/broker/:broker/order-log/:orderId', async (req, res, next) => {
  try {
    const adapter = await getLiveBroker(req, req.params.broker.toUpperCase());
    res.json({ broker: req.params.broker, orderLog: await adapter.getOrderLog(req.params.orderId) });
  } catch (err) {
    next(err);
  }
});

router.get('/broker/:broker/transactions', async (req, res, next) => {
  try {
    const adapter = await getLiveBroker(req, req.params.broker);
    res.json({ broker: req.params.broker, transactions: await adapter.getTransactionHistory({ fromDate: req.query.from_date, toDate: req.query.to_date, status: req.query.status, isFno: req.query.is_fno }) });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/:broker/market-data/ltp', async (req, res, next) => {
  try {
    const adapter = await getLiveBroker(req, req.params.broker);
    res.json({ broker: req.params.broker, data: await adapter.getMarketData(req.body) });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/:broker/market-data/depth', async (req, res, next) => {
  try {
    const adapter = await getLiveBroker(req, req.params.broker);
    res.json({ broker: req.params.broker, data: await adapter.getMarketDepth(req.body) });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/:broker/market-data/chart', async (req, res, next) => {
  try {
    const adapter = await getLiveBroker(req, req.params.broker);
    res.json({ broker: req.params.broker, data: await adapter.getChartData(req.body) });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/:broker/market-data/historical-chart', async (req, res, next) => {
  try {
    const adapter = await getLiveBroker(req, req.params.broker);
    res.json({ broker: req.params.broker, data: await adapter.getHistoricalData(req.body) });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/:broker/reconcile', async (req, res, next) => {
  try {
    const broker = req.params.broker;
    const adapter = await getLiveBroker(req, broker);
    const [internal, brokerPositions] = await Promise.all([
      pool.query(`SELECT symbol AS instrument, side, quantity, entry_price FROM algo_positions WHERE user_id = $1 AND status = 'OPEN'`, [req.userId]),
      adapter.getPositions(),
    ]);
    const result = comparePositions(internal.rows, brokerPositions);
    if (!result.matched) {
      await pool.query(`UPDATE algo_states SET status = 'STOPPED', updated_at = NOW() WHERE user_id = $1`, [req.userId]);
      await recordRiskEvent(req.userId, 'POSITION_MISMATCH', 'Broker and internal positions do not reconcile; new orders stopped', { broker, ...result });
    }
    res.json({ broker, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/algo/orders/:id/cancel', async (req, res, next) => {
  try {
    const found = await pool.query('SELECT * FROM algo_orders WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!found.rows[0]) return res.status(404).json({ error: 'Order not found' });
    const result = await cancelOrder({ pool, adapter: await adapterForOrder(req, found.rows[0]), orderId: req.params.id, userId: req.userId });
    if (!result) return res.status(404).json({ error: 'Cancellable order not found' });
    await recordActivity(req.userId, 'ORDER_CANCELLED', 'Paper order cancelled', { orderId: req.params.id });
    res.json({ order: serializeOrder(result.order), broker: result.broker });
  } catch (err) {
    next(err);
  }
});

router.patch('/algo/orders/:id', validateBody(orderChangesSchema), async (req, res, next) => {
  try {
    const found = await pool.query('SELECT * FROM algo_orders WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!found.rows[0]) return res.status(404).json({ error: 'Order not found' });
    const result = await modifyOrder({
      pool,
      adapter: await adapterForOrder(req, found.rows[0]),
      orderId: req.params.id,
      userId: req.userId,
      changes: req.validatedBody,
    });
    if (!result) return res.status(404).json({ error: 'Modifiable order not found' });
    await recordActivity(req.userId, 'ORDER_MODIFIED', 'Paper order modified', { orderId: req.params.id });
    res.json({ order: serializeOrder(result.order), broker: result.broker });
  } catch (err) {
    next(err);
  }
});

router.post('/algo/orders/:id/reject', async (req, res, next) => {
  try {
    const found = await pool.query(
      `SELECT * FROM algo_orders
       WHERE id = $1 AND user_id = $2 AND status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED')`,
      [req.params.id, req.userId],
    );
    if (!found.rows[0]) return res.status(404).json({ error: 'Rejectable order not found' });
    if (found.rows[0].execution_mode !== 'PAPER') {
      return res.status(409).json({ error: 'Manual rejects are only available for paper orders.' });
    }
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim().slice(0, 500)
      : 'Paper order rejected by simulated execution venue';
    const updated = await pool.query(
      `UPDATE algo_orders
       SET status = 'REJECTED', rejection_reason = $3, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED')
       RETURNING *`,
      [req.params.id, req.userId, reason]
    );
    await recordActivity(req.userId, 'ORDER_REJECTED', 'Paper order rejected', { orderId: req.params.id, reason });
    res.json({ order: serializeOrder(updated.rows[0]) });
  } catch (err) {
    next(err);
  }
});

 router.post('/algo/orders/:id/fill', validateBody(z.object({
   fillPrice: z.number().positive().optional(),
   filledQuantity: z.number().int().positive().optional(),
 })), async (req, res, next) => {
  try {
    const found = await pool.query(
      `SELECT * FROM algo_orders
       WHERE id = $1 AND user_id = $2 AND status IN ('CREATED', 'SUBMITTED', 'PARTIALLY_FILLED')`,
      [req.params.id, req.userId]
    );
     const order = found.rows[0];
    if (!order) return res.status(404).json({ error: 'Fillable order not found' });
     if (order.execution_mode !== 'PAPER') {
       return res.status(409).json({ error: 'Manual fills are only available for paper orders.' });
     }
     const filledQuantity = req.validatedBody.filledQuantity || order.quantity;
     if (filledQuantity > order.quantity) {
       return res.status(400).json({ error: 'Filled quantity cannot exceed the order quantity.' });
     }
     const execution = await applyExecutionUpdate({
       pool,
       orderId: order.id,
        userId: req.userId,
       execution: {
         status: filledQuantity === order.quantity ? 'FILLED' : 'PARTIALLY_FILLED',
         filledQuantity,
         averagePrice: req.validatedBody.fillPrice || Number(order.price),
       },
     });
     if (!execution) return res.status(409).json({ error: 'Order was already transitioned' });
     await recordActivity(req.userId, 'ORDER_EXECUTION_UPDATED', `Order execution updated`, { orderId: order.id, filledQuantity });
     return res.status(filledQuantity === order.quantity ? 201 : 202).json({
       order: serializeOrder(execution.order),
     });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/execution', validateBody(executionUpdateSchema), async (req, res, next) => {
  try {
    const execution = await applyExecutionUpdate({
      pool,
      orderId: req.validatedBody.orderId,
      brokerOrderId: req.validatedBody.brokerOrderId,
      userId: req.userId,
      execution: req.validatedBody,
    });
    if (!execution) return res.status(404).json({ error: 'Order not found for execution update' });
    await recordActivity(
      req.userId,
      'BROKER_EXECUTION_UPDATE',
      `Broker execution status updated to ${execution.order.status}`,
      { orderId: execution.order.id, brokerOrderId: execution.order.broker_order_id }
    );
    return res.json({
      order: serializeOrder(execution.order),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/algo/stream', async (req, res, next) => {
  try {
    await ensureAlgoRows(req.userId);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');
    res.flush?.();
    const sendSnapshot = async () => {
      if (res.writableEnded || res.destroyed) return;
      const [dashboard, positions, orders, activity, metrics] = await Promise.all([
        pool.query(`SELECT s.status, 0 AS today_pnl FROM algo_states s WHERE s.user_id = $1`, [req.userId]),
        pool.query(`SELECT symbol AS instrument, side, quantity, entry_price, current_price, stop_loss, target, pnl, status FROM algo_positions WHERE user_id = $1 AND status = 'OPEN'`, [req.userId]),
        pool.query(`SELECT * FROM algo_orders WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 10`, [req.userId]),
        pool.query(`SELECT event_type, message, created_at FROM algo_activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`, [req.userId]),
        pool.query(
          `SELECT
             0::int AS total_trades,
             0::int AS winning_trades,
             0::int AS losing_trades,
             0 AS net_pnl,
             0 AS average_win,
             0 AS average_loss`,
        ),
      ]);
      const totalTrades = Number(metrics.rows[0]?.total_trades || 0);
      const winningTrades = Number(metrics.rows[0]?.winning_trades || 0);
      const payload = {
        algoStatus: dashboard.rows[0]?.status || 'STOPPED',
        todayPnl: Number(dashboard.rows[0]?.today_pnl || 0),
        positions: positions.rows,
        orders: orders.rows.map(serializeOrder),
        activity: activity.rows,
        metrics: {
          totalTrades,
          winningTrades,
          losingTrades: Number(metrics.rows[0]?.losing_trades || 0),
          winRate: totalTrades ? Number(((winningTrades / totalTrades) * 100).toFixed(2)) : 0,
          netPnl: Number(metrics.rows[0]?.net_pnl || 0),
          averageWin: Number(metrics.rows[0]?.average_win || 0),
          averageLoss: Number(metrics.rows[0]?.average_loss || 0),
        },
        updatedAt: new Date().toISOString(),
      };
      res.write(`event: snapshot\ndata: ${JSON.stringify(payload)}\n\n`);
      res.flush?.();
    };
    await sendSnapshot();
    const interval = setInterval(() => sendSnapshot().catch(() => {}), 2000);
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': heartbeat\n\n');
    }, 15000);
    req.on('close', () => {
      clearInterval(interval);
      clearInterval(heartbeat);
    });
  } catch (err) {
    next(err);
  }
});

export default router; 

