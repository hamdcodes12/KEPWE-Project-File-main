import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { requireAnyProductAccess, requireProductAccess } from '../middleware/product-auth.js';
import { pool, withRLSContext } from '../config/db.js';
import { calculateTarget, evaluateSignal, generateSignal, isTradingWindowActive, DEFAULT_STRATEGY_CONFIG, STRATEGY_NAME, STRATEGY_SLUG } from '../algo/strategy.js';
import { evaluateRisk, sizePosition } from '../algo/risk-engine.js';
import { ANGEL_ONE, getBrokerReadiness } from '../algo/broker-adapters.js';
import { runBacktest } from '../algo/backtest.js';
import { applyExecutionUpdate, createAndSubmitOrder, cancelOrder, modifyOrder } from '../algo/oms.js';
import { comparePositions } from '../algo/reconciliation.js';
import { stopActiveAlgosForMarketDisconnect } from '../algo/runner.js';
import upstoxService from '../services/upstox.service.js';
import {
  adapterFromAngelOneAccount,
  getAngelOneSession,
  isAngelOneSessionError,
  loadAngelOneAccount,
  markAngelOneSessionExpired,
} from '../services/angel-one-session.service.js';
import { clearAngelOneMarketFeedCache, fetchNiftyIndexQuote } from '../services/angel-one-market-feed.service.js';
import { loadAngelInstrumentMaster, resolveAngelSymbol } from '../services/angel-one-instruments.service.js';
import { tryCreateQuantNotification } from '../services/quant-notification.service.js';

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

const brokerSchema = z.object({ broker: z.enum(['ANGEL_ONE']) });
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
  status: z.string().trim().min(1).max(60).optional(),
  filledQuantity: z.number().int().nonnegative().optional(),
  averagePrice: z.number().positive().optional(),
  rejectionReason: z.string().trim().max(500).optional(),
}).refine((value) => value.orderId || value.brokerOrderId, 'orderId or brokerOrderId is required');
const liveOrderSchema = z.object({
  broker: z.enum(['ANGEL_ONE']),
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
  await tryCreateQuantNotification(pool, {
    userId,
    type: 'RISK_REJECTION',
    title: 'Live order blocked by risk controls',
    body: reason,
    data: { eventType, ...metadata },
  });
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

async function hasPassingLiveDeploymentGate(userId) {
  const result = await pool.query(
    `SELECT event_type, gate_checks FROM quant_deployment_events
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  const checks = result.rows[0]?.gate_checks;
  return result.rows[0]?.event_type === 'DEPLOYMENT_VALIDATED'
    && checks && Object.keys(checks).length > 0
    && Object.values(checks).every((check) => check?.passed === true);
}

async function assertMarketDataAvailable() {
  const quotes = await upstoxService.getIndexQuotes(['NIFTY']);
  const price = Number(quotes[0]?.data?.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Verified market data is unavailable');
  }
  return price;
}

function assertSupportedBroker(broker) {
  const code = String(broker || '').toUpperCase();
  if (code !== ANGEL_ONE) {
    const error = new Error(`Unsupported broker: ${code || 'UNKNOWN'}. Angel One SmartAPI is the only supported broker.`);
    error.statusCode = 400;
    error.code = 'UNSUPPORTED_BROKER';
    throw error;
  }
  return code;
}

/** The caller's live Angel One adapter (tokens decrypted, rotation persisted). */
async function getLiveBroker(req, broker = ANGEL_ONE) {
  assertSupportedBroker(broker);
  const session = await getAngelOneSession(pool, req.userId);
  if (session.reason === 'SESSION_EXPIRED') {
    const error = new Error('Angel One session has expired. Please reconnect your account.');
    error.statusCode = 401;
    error.code = 'ANGEL_ONE_SESSION_EXPIRED';
    error.broker = ANGEL_ONE;
    throw error;
  }
  if (!session.adapter) {
    const error = new Error('Angel One is not connected in LIVE mode for this user');
    error.statusCode = 409;
    error.code = 'ANGEL_ONE_NOT_CONNECTED';
    error.broker = ANGEL_ONE;
    throw error;
  }
  return session.adapter;
}

function isBrokerSessionRejected(error) {
  return isAngelOneSessionError(error) || error?.code === 'ANGEL_ONE_SESSION_EXPIRED';
}

/** Records an explicit session rejection by Angel One and answers 401. */
async function respondSessionExpired(req, res, error, context) {
  try {
    const row = await loadAngelOneAccount(pool, req.userId);
    if (row?.id && isAngelOneSessionError(error)) await markAngelOneSessionExpired(pool, row.id);
  } catch (_) { /* the status endpoint re-checks */ }
  clearAngelOneMarketFeedCache(req.userId);
  console.log('[BROKER_STATUS]', JSON.stringify({
    userId: req.userId,
    broker: ANGEL_ONE,
    timestamp: new Date().toISOString(),
    status: 'ANGEL_ONE_SESSION_EXPIRED',
    reason: `${context} detected an expired broker session: ${error.message || 'Unauthorized'}`,
  }));
  return res.status(401).json({
    error: 'Angel One session has expired. Please reconnect your Angel One account.',
    code: 'ANGEL_ONE_SESSION_EXPIRED',
    broker: ANGEL_ONE,
    brokerErrorCode: error.providerErrorCode ?? null,
  });
}

/**
 * Wraps a read-only broker route: resolves the adapter, maps an expired
 * session to 401 (ANGEL_ONE_SESSION_EXPIRED) and "not connected" to 409.
 */
function brokerRoute(context, handler) {
  return async (req, res, next) => {
    try {
      const broker = assertSupportedBroker(req.params.broker);
      const adapter = await getLiveBroker(req, broker);
      return await handler(req, res, adapter, broker);
    } catch (err) {
      if (isBrokerSessionRejected(err)) return respondSessionExpired(req, res, err, context);
      if (err.statusCode === 409 || err.code === 'UNSUPPORTED_BROKER') {
        return res.status(err.statusCode).json({
          status: 'BLOCKED',
          error: err.message,
          code: err.code || 'ANGEL_ONE_NOT_CONNECTED',
          broker: ANGEL_ONE,
          sessionValid: false,
        });
      }
      return next(err);
    }
  };
}

async function adapterForOrder(req, order) {
  // Orders placed before Angel One became the only broker cannot be managed here.
  return getLiveBroker(req, order.metadata?.broker || ANGEL_ONE);
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
             (SELECT COALESCE(SUM(net_pnl), 0) FROM algo_trades WHERE user_id = $1 AND status = 'LIVE' AND traded_at::date = CURRENT_DATE) AS today_pnl`,
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
        const brokerAdapter = await getLiveBroker(req, ANGEL_ONE);
        await brokerAdapter.validateSession();
        const feed = await fetchNiftyIndexQuote(brokerAdapter);
        if (!feed.quote?.price) throw new Error('Angel One returned no live NIFTY 50 quote');
      } catch (error) {
        if (isBrokerSessionRejected(error)) return respondSessionExpired(req, res, error, 'Algo activation');
        await stopForMarketDisconnect(req.userId, `Angel One live market data unavailable: ${error.message}`);
        return res.status(503).json({ error: `Angel One live market data unavailable: ${error.message}`, broker: ANGEL_ONE });
      }
      const deployment = await pool.query(
        `SELECT event_type, gate_checks FROM quant_deployment_events
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.userId],
      );
      const gateChecks = deployment.rows[0]?.gate_checks;
      const gatePassed = deployment.rows[0]?.event_type === 'DEPLOYMENT_VALIDATED'
        && gateChecks && Object.keys(gateChecks).length > 0
        && Object.values(gateChecks).every((check) => check?.passed === true);
      if (!gatePassed) {
        return res.status(409).json({ error: 'Live deployment gate has not passed; resolve every readiness blocker before activation.' });
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
    await tryCreateQuantNotification(pool, {
      userId: req.userId,
      type: status === 'ACTIVE' ? 'STRATEGY_ACTIVATED' : 'LIVE_TRADING_STOPPED',
      title: status === 'ACTIVE' ? 'Live strategy activated' : 'Live strategy stopped',
      body: status === 'ACTIVE' ? 'The live strategy runner was activated after the deployment gate passed.' : 'The live strategy runner was stopped.',
      data: { status },
    });
    res.json({ status });
  } catch (err) {
    next(err);
  }
}

router.post('/algo/start', (req, res, next) => setAlgoStatus(req, res, next, 'ACTIVE'));
router.post('/algo/stop', (req, res, next) => setAlgoStatus(req, res, next, 'STOPPED'));

/**
 * Session validity is decided ONLY by Angel One (getProfile + identity match).
 * A transient/network failure never rewrites the persisted state.
 */
async function validateStoredSession(row) {
  try {
    const adapter = adapterFromAngelOneAccount(pool, row);
    const profile = await adapter.getProfile();
    if (!profile?.clientCode || profile.clientCode !== String(row.client_id || '').toUpperCase()) {
      const mismatch = new Error('Angel One profile identity does not match the stored client code');
      mismatch.code = 'BROKER_ACCOUNT_IDENTITY_MISMATCH';
      throw mismatch;
    }
    return {
      ...row,
      status: 'CONNECTED',
      mode: 'LIVE',
      clientName: profile.name || null,
      token_expires_at: adapter.tokenExpiresAt || row.token_expires_at,
    };
  } catch (error) {
    const sessionRejected = isAngelOneSessionError(error);
    const identityMismatch = error?.code === 'BROKER_ACCOUNT_IDENTITY_MISMATCH';
    console.warn('[ANGEL_ONE_SESSION_CHECK]', JSON.stringify({
      brokerAccountId: row.id,
      error: error?.message || String(error),
      code: error?.code || null,
      httpStatus: error?.httpStatus ?? null,
      brokerErrorCode: error?.providerErrorCode ?? null,
      outcome: sessionRejected ? 'SESSION_EXPIRED' : (identityMismatch ? 'VERIFICATION_FAILED' : 'UNCHANGED'),
    }));
    if (sessionRejected || identityMismatch) {
      const nextStatus = sessionRejected ? 'SESSION_EXPIRED' : 'VERIFICATION_FAILED';
      await pool.query(
        `UPDATE broker_accounts
         SET status = $2, connection_mode = 'LIVE', updated_at = NOW()
         WHERE id = $1`,
        [row.id, nextStatus],
      );
      return { ...row, status: nextStatus, mode: 'LIVE', lastError: error?.message || null };
    }
    // Transient/network/5xx: do not rewrite the persisted state; report it as-is.
    return { ...row, mode: row.connection_mode || 'LIVE', lastError: error?.message || null, transientError: true };
  }
}

function statusPayload(row, validated) {
  const state = validated || row;
  const isConnected = Boolean(validated) && ['CONNECTED', 'PARTIALLY_CONNECTED'].includes(validated.status);
  const isExpired = state?.status === 'SESSION_EXPIRED';
  return {
    connected: isConnected,
    broker: ANGEL_ONE,
    brokerName: 'Angel One',
    status: isConnected ? 'CONNECTED' : (isExpired ? 'ANGEL_ONE_SESSION_EXPIRED' : 'DISCONNECTED'),
    executionMode: state?.mode || state?.connection_mode || 'LIVE',
    clientId: state?.client_id || null,
    clientName: validated?.clientName || null,
    sessionValid: isConnected,
    connectedAt: isConnected ? (state.connected_at || null) : null,
    tokenExpiresAt: isConnected ? (state.token_expires_at || null) : null,
    lastError: isConnected ? null : (state?.lastError || null),
  };
}

/** Loads the stored connection and, when one is usable, confirms it with Angel One. */
async function currentBrokerStatus(userId) {
  const row = await loadAngelOneAccount(pool, userId);
  if (!row || !['CONNECTED', 'PARTIALLY_CONNECTED'].includes(row.status) || !row.access_token_ciphertext) {
    return statusPayload(row, null);
  }
  return statusPayload(row, await validateStoredSession(row));
}

router.get('/algo/positions', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT symbol, side, quantity, entry_price, current_price, stop_loss, target, pnl, status FROM algo_positions WHERE user_id = $1 AND status = 'OPEN' ORDER BY opened_at DESC`, [req.userId]);
    res.json({ positions: result.rows.map((row) => ({ symbol: row.symbol, side: row.side, quantity: row.quantity, entry: Number(row.entry_price), current: Number(row.current_price), stopLoss: row.stop_loss == null ? null : Number(row.stop_loss), target: row.target == null ? null : Number(row.target), pnl: Number(row.pnl), status: row.status })) });
  } catch (err) {
    next(err);
  }
});

/**
 * Standardized broker status endpoint:
 * GET /api/algo/broker/ANGEL_ONE/status and GET /api/broker/ANGEL_ONE/status
 * Returns stable { connected, broker, status, executionMode, clientId, sessionValid }
 * Strictly never returns tokens.
 */
router.get(['/algo/broker/:broker/status', '/broker/:broker/status'], async (req, res, next) => {
  try {
    const broker = String(req.params.broker || '').toUpperCase();
    if (broker !== ANGEL_ONE) {
      return res.status(400).json({ error: `Unsupported broker: ${broker}. Angel One SmartAPI is the only supported broker.`, code: 'UNSUPPORTED_BROKER' });
    }
    const payload = await currentBrokerStatus(req.userId);
    console.log('[BROKER_STATUS]', JSON.stringify({
      userId: req.userId,
      broker: ANGEL_ONE,
      timestamp: new Date().toISOString(),
      status: payload.status,
      reason: payload.connected ? 'Active live Angel One session confirmed' : (payload.lastError || 'No active Angel One connection'),
    }));
    return res.json(payload);
  } catch (err) {
    console.log('[BROKER_STATUS]', JSON.stringify({
      userId: req.userId,
      broker: ANGEL_ONE,
      timestamp: new Date().toISOString(),
      status: 'ERROR',
      reason: err.message || 'Error checking broker status',
    }));
    next(err);
  }
});

router.get(['/algo/broker/status', '/broker/status'], async (req, res, next) => {
  try {
    const payload = await currentBrokerStatus(req.userId);
    const hasAccount = payload.clientId !== null;
    res.json({
      brokers: hasAccount
        ? [{ broker: ANGEL_ONE, clientId: payload.clientId, status: payload.status, mode: payload.executionMode, connectedAt: payload.connectedAt }]
        : [],
      angelOne: payload,
      supportedBrokers: [ANGEL_ONE],
    });
  } catch (err) {
    next(err);
  }
});

router.post('/broker/disconnect', validateBody(brokerSchema), async (req, res, next) => {
  try {
    const row = await loadAngelOneAccount(pool, req.userId);
    if (!row) {
      return res.status(404).json({ error: 'Angel One is not connected for this account.' });
    }
    if (row.access_token_ciphertext) {
      // End the session at Angel One as well; an already expired session cannot be logged out.
      await adapterFromAngelOneAccount(pool, row).logout().catch(() => {});
    }
    const result = await pool.query(
      `UPDATE broker_accounts
       SET status = 'NOT_CONNECTED', connection_mode = 'LIVE', is_active_broker = FALSE, updated_at = NOW()
       WHERE id = $1
       RETURNING broker, status, connection_mode, connected_at`,
      [row.id],
    );
    await pool.query('DELETE FROM broker_oauth_tokens WHERE broker_account_id = $1', [row.id]);
    await pool.query(
      `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [req.userId],
    );
    clearAngelOneMarketFeedCache(req.userId);
    await recordActivity(req.userId, 'BROKER_DISCONNECTED', 'Angel One disconnected', { broker: ANGEL_ONE, mode: 'LIVE' });
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
      brokers: [{ ...getBrokerReadiness(ANGEL_ONE, 'LIVE'), broker: ANGEL_ONE }],
      supportedBrokers: [ANGEL_ONE],
      liveOnly: true,
    });
  } catch (err) {
    next(err);
  }
});

router.get(['/algo/broker/:broker/profile', '/broker/:broker/profile'], brokerRoute('Profile query', async (req, res, adapter, broker) => {
  const { raw, ...profile } = await adapter.getProfile();
  res.json({ profile, broker });
}));

router.get(['/algo/broker/:broker/positions', '/broker/:broker/positions'], brokerRoute('Positions query', async (req, res, adapter, broker) => {
  res.json({ positions: await adapter.getPositions(), broker });
}));

router.get(['/algo/broker/:broker/holdings', '/broker/:broker/holdings'], brokerRoute('Holdings query', async (req, res, adapter, broker) => {
  res.json({ holdings: await adapter.getHoldings(), broker });
}));

router.get(['/algo/broker/:broker/funds', '/broker/:broker/funds'], brokerRoute('Funds query', async (req, res, adapter, broker) => {
  const { raw, ...funds } = await adapter.getMargin();
  res.json({ funds, broker });
}));

/** Funds, holdings totals and open-position P&L in one call (all from SmartAPI). */
router.get(['/algo/broker/:broker/portfolio', '/broker/:broker/portfolio'], brokerRoute('Portfolio query', async (req, res, adapter, broker) => {
  const { raw: fundsRaw, ...funds } = await adapter.getMargin();
  const errors = {};
  let holdings = null;
  let positions = null;
  try {
    const { raw, ...totals } = await adapter.getPortfolio();
    holdings = totals;
  } catch (error) {
    if (isBrokerSessionRejected(error)) throw error;
    errors.holdings = error.message;
  }
  try {
    const list = await adapter.getPositions();
    positions = {
      count: list.filter((position) => position.quantity > 0).length,
      realizedPnl: Number(list.reduce((total, position) => total + position.realizedPnl, 0).toFixed(2)),
      unrealizedPnl: Number(list.reduce((total, position) => total + position.unrealizedPnl, 0).toFixed(2)),
    };
  } catch (error) {
    if (isBrokerSessionRejected(error)) throw error;
    errors.positions = error.message;
  }
  res.json({ funds, holdings, positions, errors: Object.keys(errors).length > 0 ? errors : undefined, broker });
}));

router.get(['/algo/broker/:broker/orderbook', '/broker/:broker/orderbook'], brokerRoute('Order book query', async (req, res, adapter, broker) => {
  res.json({ orderbook: await adapter.getOrderBook({ fresh: true }), broker });
}));

router.get(['/algo/broker/:broker/tradebook', '/broker/:broker/tradebook'], brokerRoute('Trade book query', async (req, res, adapter, broker) => {
  res.json({ trades: await adapter.getTradeBook(), broker });
}));

// Connecting requires the user's own Angel One login; see POST /api/broker/angel-one/connect.
router.post('/broker/connect/live', (req, res) => {
  res.status(410).json({
    error: 'Use POST /api/broker/angel-one/connect with your Angel One client code, MPIN and TOTP.',
    code: 'USE_ANGEL_ONE_CONNECT',
    broker: ANGEL_ONE,
  });
});

async function getLiveRiskStats(userId) {
  // Live broker execution statistics are derived from broker updates.
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
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total_trades,
              COUNT(*) FILTER (WHERE pnl > 0)::int AS winning_trades,
              COUNT(*) FILTER (WHERE pnl < 0)::int AS losing_trades,
              COALESCE(SUM(net_pnl), 0)::numeric AS net_pnl,
              COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0)::numeric AS average_win,
              COALESCE(AVG(pnl) FILTER (WHERE pnl < 0), 0)::numeric AS average_loss
       FROM algo_trades WHERE user_id = $1 AND status = 'LIVE'`,
      [req.userId],
    );
    const metrics = result.rows[0];
    res.json({
      mode: 'LIVE',
      totalTrades: Number(metrics.total_trades),
      winningTrades: Number(metrics.winning_trades),
      losingTrades: Number(metrics.losing_trades),
      winRate: Number(metrics.total_trades) ? Number(((Number(metrics.winning_trades) / Number(metrics.total_trades)) * 100).toFixed(2)) : 0,
      netPnl: Number(metrics.net_pnl),
      averageWin: Number(metrics.average_win),
      averageLoss: Number(metrics.average_loss),
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
    if (!(await hasPassingLiveDeploymentGate(req.userId))) {
      const reason = 'Live deployment gate has not passed; live order submission is blocked.';
      await recordRiskEvent(req.userId, 'ORDER_BLOCKED', reason, {}, 'WARN');
      return res.status(409).json({ error: reason });
    }
    const adapter = await getLiveBroker(req, order.broker);
    if (typeof adapter.assertOrderExecutionReady === 'function') {
      try {
        await adapter.assertOrderExecutionReady();
      } catch (error) {
        return res.status(412).json({ error: error.message, code: 'STATIC_IP_NOT_READY', staticIp: error.staticIp || null });
      }
    } else if (!getBrokerReadiness(order.broker, 'LIVE').orderExecutionReady) {
      return res.status(412).json({
        error: 'Live order execution is blocked until static IP readiness is confirmed.',
        code: 'STATIC_IP_NOT_READY',
      });
    }
    const settings = serializeSettings((await pool.query('SELECT * FROM algo_settings WHERE user_id = $1', [req.userId])).rows[0]);
    if (order.price === undefined) {
      return res.status(400).json({ error: 'A verified market price is required before submitting a live order.' });
    }
    const effectivePrice = order.price;
    let availableMargin = settings.tradingCapital;
    try {
      const margin = await adapter.getMargin();
      const brokerAvailable = Number(margin?.available);
      if (Number.isFinite(brokerAvailable) && brokerAvailable >= 0) availableMargin = brokerAvailable;
    } catch (error) {
      await stopForBrokerDisconnect(req.userId, order.broker, 'Broker margin check failed; live orders stopped');
      return res.status(error.statusCode || 503).json({ error: 'Broker margin could not be verified; live orders are blocked.' });
    }
    const target = order.target ?? calculateTarget({ side: order.side, entryPrice: effectivePrice, stopLoss: order.stopLoss, riskReward: settings.riskReward });
    if (!target) return res.status(400).json({ error: 'A positive stop-loss distance is required to calculate the default target.' });
    const stats = await getLiveRiskStats(req.userId);
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
      brokerAccountId: adapter.brokerAccountId,
    });
    if (submitted.status === 'REJECTED') {
      await recordRiskEvent(req.userId, 'ORDER_REJECTED', submitted.rejection_reason || 'Broker rejected the order', { orderId: submitted.id, broker: order.broker });
      if (/API error|timed out|timeout|connection|unavailable/i.test(submitted.rejection_reason || '')) {
        await stopForBrokerDisconnect(req.userId, order.broker, 'Broker order request failed; live orders stopped');
      }
      return res.status(409).json({ error: submitted.rejection_reason || 'Broker rejected the order', order: serializeOrder(submitted) });
    }
    let execution = null;
    if (submitted.status === 'FILLED' && submitted.broker_order_id) {
      // Fill price/quantity come from the broker's order record, never the request.
      try {
        const brokerState = await adapter.getOrderStatus({ brokerOrderId: submitted.broker_order_id });
        execution = await applyExecutionUpdate({
          pool,
          orderId: submitted.id,
          brokerOrderId: submitted.broker_order_id,
          userId: req.userId,
          execution: brokerState,
        });
      } catch (syncError) {
        console.warn('[LIVE_ORDER] Fill sync deferred to reconciliation:', syncError.message);
      }
    }
    await recordActivity(req.userId, 'LIVE_ORDER_SUBMITTED', `Live ${order.side} order submitted through ${order.broker}`, { orderId: submitted.id });
    return res.status(submitted.status === 'FILLED' ? 201 : 202).json({
      order: serializeOrder(execution?.order || submitted),
      risk,
      message: submitted.status === 'FILLED' ? 'Broker execution confirmed.' : 'Order submitted; awaiting broker execution updates.',
    });
  } catch (err) {
    if (err?.code === 'STATIC_IP_NOT_READY') {
      return res.status(412).json({ error: err.message, code: 'STATIC_IP_NOT_READY', staticIp: err.staticIp || null });
    }
    if (isBrokerSessionRejected(err)) {
      await stopForBrokerDisconnect(req.userId, ANGEL_ONE, 'Angel One session expired; live orders stopped');
      return respondSessionExpired(req, res, err, 'Live order submission');
    }
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

router.get('/broker/:broker/pnl', brokerRoute('P&L query', async (req, res, adapter, broker) => {
  const positions = await adapter.getPositions();
  const sum = (key) => Number(positions.reduce((total, position) => total + (Number(position[key]) || 0), 0).toFixed(2));
  res.json({
    broker,
    realizedPnl: positions.length > 0 ? sum('realizedPnl') : 0,
    unrealizedPnl: positions.length > 0 ? sum('unrealizedPnl') : 0,
    realizedSupported: true,
    unrealizedSupported: true,
    positions: positions.length,
    message: 'Realized and unrealized P&L are aggregated from Angel One position fields (today\'s positions).',
  });
}));

router.get('/broker/:broker/order-log/:orderId', brokerRoute('Order details query', async (req, res, adapter, broker) => {
  // :orderId is the SmartAPI unique order id returned when the order was placed.
  res.json({ broker, orderLog: await adapter.getOrderLog(req.params.orderId) });
}));

router.get('/broker/:broker/transactions', brokerRoute('Transactions query', async (req, res, adapter, broker) => {
  res.json({ broker, transactions: await adapter.getTransactionHistory() });
}));

/** Resolves { symbolToken | securityId | symbol, exchange } to an Angel One token via the official master. */
async function resolveInstrumentRequest(body = {}) {
  const exchange = String(body.exchange || body.exchangeSegment || 'NSE').toUpperCase();
  const token = body.symbolToken || body.securityId || body.symboltoken;
  if (token) return { exchange, symbolToken: String(token) };
  const instrument = resolveAngelSymbol(await loadAngelInstrumentMaster(), body.symbol, exchange);
  return { exchange: instrument.exchange, symbolToken: instrument.symbolToken, instrument };
}

function instrumentErrorStatus(error) {
  if (error?.code === 'ANGEL_ONE_INSTRUMENT_NOT_FOUND') return 404;
  if (String(error?.code || '').startsWith('ANGEL_ONE_INSTRUMENT_MASTER')) return 503;
  return null;
}

function marketDataRoute(context, handler) {
  return brokerRoute(context, async (req, res, adapter, broker) => {
    let target;
    try {
      target = await resolveInstrumentRequest(req.body);
    } catch (error) {
      const status = instrumentErrorStatus(error);
      if (!status) throw error;
      return res.status(status).json({ error: error.message, code: error.code, broker });
    }
    return handler(req, res, adapter, broker, target);
  });
}

router.post('/broker/:broker/market-data/ltp', marketDataRoute('LTP query', async (req, res, adapter, broker, target) => {
  const { raw, depth, ...quote } = (await adapter.getMarketData(target)) || {};
  res.json({ broker, data: quote });
}));

router.post('/broker/:broker/market-data/depth', marketDataRoute('Market depth query', async (req, res, adapter, broker, target) => {
  const { raw, ...quote } = (await adapter.getMarketDepth(target)) || {};
  res.json({ broker, data: quote });
}));

async function historicalCandles(req, res, adapter, broker, target) {
  const candles = await adapter.getHistoricalData({
    ...target,
    interval: req.body?.interval || '5m',
    fromDate: req.body?.fromDate || req.body?.start_time,
    toDate: req.body?.toDate || req.body?.end_time,
  });
  res.json({
    broker,
    data: {
      candles,
      count: candles.length,
      instrument: target.instrument || { exchange: target.exchange, symbolToken: target.symbolToken },
      source: 'ANGEL_ONE_GET_CANDLE_DATA',
    },
  });
}

router.post('/broker/:broker/market-data/chart', marketDataRoute('Chart query', historicalCandles));
router.post('/broker/:broker/market-data/historical-chart', marketDataRoute('Historical chart query', historicalCandles));

router.post('/broker/:broker/reconcile', async (req, res, next) => {
  try {
    const broker = assertSupportedBroker(req.params.broker);
    const adapter = await getLiveBroker(req, broker);
    const [internal, brokerPositions] = await Promise.all([
      pool.query(`SELECT symbol AS instrument, side, quantity, entry_price FROM algo_positions WHERE user_id = $1 AND status = 'OPEN'`, [req.userId]),
      adapter.getPositions(),
    ]);
    const result = comparePositions(internal.rows, brokerPositions);
    if (!result.matched) {
      await pool.query(`UPDATE algo_states SET status = 'STOPPED', updated_at = NOW() WHERE user_id = $1`, [req.userId]);
      await recordRiskEvent(req.userId, 'POSITION_MISMATCH', 'Broker and internal positions do not reconcile; new orders stopped', { broker, ...result });
      await tryCreateQuantNotification(pool, {
        userId: req.userId,
        type: 'RECONCILIATION_MISMATCH',
        title: 'Broker positions do not match KEPWE',
        body: 'Broker and internal positions do not reconcile; new orders were stopped until this is resolved.',
        data: { broker },
      });
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
    await recordActivity(req.userId, 'ORDER_CANCELLED', 'Order cancellation sent to broker', { orderId: req.params.id });
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
    await recordActivity(req.userId, 'ORDER_MODIFIED', 'Order modification sent to broker', { orderId: req.params.id });
    res.json({ order: serializeOrder(result.order), broker: result.broker });
  } catch (err) {
    next(err);
  }
});

// KEPWE Quant is LIVE-only. Manual/simulated fills and rejects are not
// supported: order state changes only come from the broker (see /broker/execution).
router.post(['/algo/orders/:id/reject', '/algo/orders/:id/fill'], (req, res) => {
  res.status(410).json({
    error: 'Manual order fills/rejects are not supported. Order state is synchronized from the broker only.',
    code: 'LIVE_ONLY_BROKER_STATE',
  });
});

/**
 * POST /api/broker/execution
 * Re-synchronizes one of the caller's orders from the broker. Client-supplied
 * status/quantity/price fields are ignored: the broker's own order record
 * (Angel One SmartAPI order book) is the only source of execution state.
 */
router.post('/broker/execution', validateBody(executionUpdateSchema), async (req, res, next) => {
  try {
    const found = await pool.query(
      `SELECT * FROM algo_orders
       WHERE user_id = $1 AND (($2::uuid IS NOT NULL AND id = $2) OR ($3::text IS NOT NULL AND broker_order_id = $3))
       LIMIT 1`,
      [req.userId, req.validatedBody.orderId || null, req.validatedBody.brokerOrderId || null],
    );
    const order = found.rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found for execution update' });
    if (!order.broker_order_id) {
      return res.status(409).json({ error: 'Order has no broker order id yet; nothing to synchronize.', code: 'BROKER_ORDER_ID_UNKNOWN' });
    }
    const adapter = await adapterForOrder(req, order);
    const brokerState = await adapter.getOrderStatus({ brokerOrderId: order.broker_order_id });
    const execution = await applyExecutionUpdate({
      pool,
      orderId: order.id,
      brokerOrderId: order.broker_order_id,
      userId: req.userId,
      execution: brokerState,
    });
    if (!execution) return res.status(404).json({ error: 'Order not found for execution update' });
    await recordActivity(
      req.userId,
      'BROKER_EXECUTION_UPDATE',
      `Broker execution status synchronized: ${execution.order.status}`,
      { orderId: execution.order.id, brokerOrderId: execution.order.broker_order_id, source: 'BROKER_ORDER_API' }
    );
    return res.json({ order: serializeOrder(execution.order), source: 'BROKER_ORDER_API' });
  } catch (err) {
    if (err?.name === 'InvalidOrderStateError' || err?.code === 'EXECUTION_PRICE_MISSING') {
      return res.status(409).json({ error: err.message, code: err.code || 'INVALID_ORDER_TRANSITION' });
    }
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
        pool.query(`SELECT s.status, COALESCE((SELECT SUM(pnl) FROM algo_trades WHERE user_id = $1 AND status = 'LIVE' AND traded_at::date = CURRENT_DATE), 0) AS today_pnl FROM algo_states s WHERE s.user_id = $1`, [req.userId]),
        pool.query(`SELECT symbol AS instrument, side, quantity, entry_price, current_price, stop_loss, target, pnl, status FROM algo_positions WHERE user_id = $1 AND status = 'OPEN'`, [req.userId]),
        pool.query(`SELECT * FROM algo_orders WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 10`, [req.userId]),
        pool.query(`SELECT event_type, message, created_at FROM algo_activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`, [req.userId]),
        pool.query(
          `SELECT COUNT(*)::int AS total_trades,
             COUNT(*) FILTER (WHERE pnl > 0)::int AS winning_trades,
             COUNT(*) FILTER (WHERE pnl < 0)::int AS losing_trades,
             COALESCE(SUM(pnl), 0)::numeric AS net_pnl,
             COALESCE(AVG(pnl) FILTER (WHERE pnl > 0), 0)::numeric AS average_win,
             COALESCE(AVG(pnl) FILTER (WHERE pnl < 0), 0)::numeric AS average_loss
           FROM algo_trades WHERE user_id = $1 AND status = 'LIVE'`,
          [req.userId],
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
