import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { setActiveBroker, getActiveBroker, revokeBrokerCredentials } from '../services/broker-token.service.js';
import { verifyBrokerConnection, getLatestVerification } from '../services/broker-verification.service.js';
import { ANGEL_ONE } from '../algo/broker-adapters.js';
import {
  adapterFromAngelOneAccount,
  getAngelOneSession,
  isAngelOneSessionError,
  loadAngelOneAccount,
  markAngelOneSessionExpired,
} from '../services/angel-one-session.service.js';
import { clearAngelOneMarketFeedCache } from '../services/angel-one-market-feed.service.js';

const router = Router();

const setActiveBrokerSchema = z.object({
  broker: z.enum(['ANGEL_ONE']),
}).strict();

const refreshBrokerDataSchema = z.object({
  broker: z.enum(['ANGEL_ONE']),
  dataTypes: z.array(z.enum(['funds', 'positions', 'holdings', 'orders', 'trades'])).optional(),
}).strict();

/**
 * Get all connected brokers for the authenticated user
 * Returns comprehensive broker connection information
 */
router.get('/broker/connections', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
         a.id,
         a.broker,
         a.client_id,
         a.status,
         a.connection_mode,
         a.is_active_broker,
         a.last_verified_at,
         a.verification_score,
         a.connected_at,
         a.updated_at,
         t.token_expires_at
       FROM broker_accounts a
       LEFT JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.user_id = $1 AND a.broker = 'ANGEL_ONE'
       ORDER BY a.is_active_broker DESC, a.broker`,
      [req.userId]
    );

    const brokers = result.rows.map(row => ({
      broker: row.broker,
      clientId: row.client_id,
      status: row.status,
      mode: row.connection_mode,
      isActive: row.is_active_broker,
      lastVerifiedAt: row.last_verified_at,
      verificationScore: row.verification_score,
      connectedAt: row.connected_at,
      tokenExpiresAt: row.token_expires_at,
      sessionValid: ['CONNECTED', 'PARTIALLY_CONNECTED'].includes(row.status),
    }));

    // Get active broker
    const activeBroker = brokers.find(b => b.isActive);

    res.json({
      brokers,
      activeBroker: activeBroker ? activeBroker.broker : null,
      totalConnected: brokers.filter(b => ['CONNECTED', 'PARTIALLY_CONNECTED'].includes(b.status)).length,
      supportedBrokers: [ANGEL_ONE],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Set active broker for the user
 * Only one broker can be active at a time
 */
router.post('/broker/set-active', requireAuth, async (req, res, next) => {
  const parsed = setActiveBrokerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ 
      error: parsed.error.issues[0]?.message || 'Invalid parameters' 
    });
  }

  const { broker } = parsed.data;

  try {
    const result = await setActiveBroker(req.userId, broker);
    
    await pool.query(
      `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
       VALUES ($1, 'ACTIVE_BROKER_CHANGED', $2, $3::jsonb)`,
      [
        req.userId,
        `Active broker set to ${broker}`,
        JSON.stringify({ broker, timestamp: new Date().toISOString() }),
      ]
    );

    res.json({
      success: true,
      activeBroker: result.broker,
      message: `${broker} is now your active broker`,
    });
  } catch (error) {
    if (error.message.includes('not connected')) {
      return res.status(409).json({ 
        error: error.message,
        broker,
      });
    }
    next(error);
  }
});

/**
 * Get active broker information
 */
router.get('/broker/active', requireAuth, async (req, res, next) => {
  try {
    const activeBroker = await getActiveBroker(req.userId);
    
    if (!activeBroker) {
      return res.json({
        hasActiveBroker: false,
        activeBroker: null,
        message: 'No active broker set',
      });
    }

    res.json({
      hasActiveBroker: true,
      activeBroker: activeBroker.broker,
      clientId: activeBroker.client_id,
      status: activeBroker.status,
      lastVerifiedAt: activeBroker.last_verified_at,
      verificationScore: activeBroker.verification_score,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Trigger manual broker verification
 */
router.post('/broker/:broker/verify', requireAuth, async (req, res, next) => {
  const broker = req.params.broker.toUpperCase();
  
  if (broker !== ANGEL_ONE) {
    return res.status(400).json({ error: `Unsupported broker: ${broker}. Angel One SmartAPI is the only supported broker.`, code: 'UNSUPPORTED_BROKER' });
  }

  try {
    console.log(`[BROKER_VERIFY] Starting manual verification for user ${req.userId}, broker ${broker}`);
    
    const verification = await verifyBrokerConnection(req.userId, broker, {
      skipMarketData: false,
      timeout: 45000,
      logResults: true,
    });

    res.json({
      broker,
      verification: {
        id: verification.verificationId,
        status: verification.status,
        score: verification.overallScore,
        checks: Object.keys(verification.checks).map(key => ({
          name: key,
          status: verification.checks[key].status,
          message: verification.checks[key].message,
        })),
        errors: verification.errors,
        warnings: verification.warnings,
        timestamp: verification.timestamp,
      },
    });
  } catch (error) {
    console.error(`[BROKER_VERIFY] Error for user ${req.userId}:`, error.message);
    next(error);
  }
});

/**
 * Get latest verification result for a broker
 */
router.get('/broker/:broker/verification/latest', requireAuth, async (req, res, next) => {
  const broker = req.params.broker.toUpperCase();
  
  if (broker !== ANGEL_ONE) {
    return res.status(400).json({ error: `Unsupported broker: ${broker}. Angel One SmartAPI is the only supported broker.`, code: 'UNSUPPORTED_BROKER' });
  }

  try {
    const verification = await getLatestVerification(req.userId, broker);
    
    if (!verification) {
      return res.json({
        broker,
        hasVerification: false,
        message: 'No verification history found',
      });
    }

    res.json({
      broker,
      hasVerification: true,
      verification,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get verification history for a broker
 */
router.get('/broker/:broker/verification/history', requireAuth, async (req, res, next) => {
  const broker = req.params.broker.toUpperCase();
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  
  if (broker !== ANGEL_ONE) {
    return res.status(400).json({ error: `Unsupported broker: ${broker}. Angel One SmartAPI is the only supported broker.`, code: 'UNSUPPORTED_BROKER' });
  }

  try {
    const result = await pool.query(
      `SELECT 
         verification_id,
         status,
         overall_score,
         checks_passed,
         checks_total,
         checks_detail,
         errors,
         warnings,
         verification_duration_ms,
         created_at
       FROM broker_verification_history
       WHERE user_id = $1 AND broker = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [req.userId, broker, limit]
    );

    res.json({
      broker,
      history: result.rows.map(row => ({
        verificationId: row.verification_id,
        status: row.status,
        score: row.overall_score,
        checksPassed: row.checks_passed,
        checksTotal: row.checks_total,
        errors: row.errors,
        warnings: row.warnings,
        durationMs: row.verification_duration_ms,
        timestamp: row.created_at,
      })),
      total: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Refresh broker data (funds, positions, holdings, etc.)
 */
router.post('/broker/refresh', requireAuth, async (req, res, next) => {
  const parsed = refreshBrokerDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ 
      error: parsed.error.issues[0]?.message || 'Invalid parameters' 
    });
  }

  const { broker, dataTypes = ['funds', 'positions', 'holdings', 'orders', 'trades'] } = parsed.data;

  try {
    const session = await getAngelOneSession(pool, req.userId);
    if (session.reason === 'SESSION_EXPIRED') {
      return res.status(401).json({
        error: 'Angel One session has expired. Please reconnect your Angel One account.',
        code: 'ANGEL_ONE_SESSION_EXPIRED',
        broker,
      });
    }
    if (!session.adapter) {
      return res.status(409).json({
        error: 'Angel One is not connected',
        broker,
      });
    }
    const { adapter } = session;

    const refreshedData = {};
    const errors = {};

    // Fetch requested data types
    for (const dataType of dataTypes) {
      try {
        switch (dataType) {
          case 'funds':
            refreshedData.funds = await adapter.getMargin();
            break;
          case 'positions':
            refreshedData.positions = await adapter.getPositions();
            break;
          case 'holdings':
            refreshedData.holdings = await adapter.getHoldings();
            break;
          case 'orders':
            refreshedData.orders = await adapter.getOrderBook();
            break;
          case 'trades':
            refreshedData.trades = await adapter.getTradeBook();
            break;
        }
      } catch (error) {
        if (isAngelOneSessionError(error)) {
          await markAngelOneSessionExpired(pool, session.row.id);
          clearAngelOneMarketFeedCache(req.userId);
          return res.status(401).json({
            error: 'Angel One session has expired. Please reconnect your Angel One account.',
            code: 'ANGEL_ONE_SESSION_EXPIRED',
            broker,
          });
        }
        errors[dataType] = error.message;
      }
    }

    res.json({
      broker,
      refreshedAt: new Date().toISOString(),
      data: refreshedData,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      success: Object.keys(refreshedData).length > 0,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Disconnect broker (revoke credentials)
 */
router.post('/broker/:broker/disconnect', requireAuth, async (req, res, next) => {
  const broker = req.params.broker.toUpperCase();
  
  if (broker !== ANGEL_ONE) {
    return res.status(400).json({ error: `Unsupported broker: ${broker}. Angel One SmartAPI is the only supported broker.`, code: 'UNSUPPORTED_BROKER' });
  }

  try {
    // End the SmartAPI session at Angel One before removing the stored tokens.
    const row = await loadAngelOneAccount(pool, req.userId);
    if (row?.access_token_ciphertext) {
      await adapterFromAngelOneAccount(pool, row).logout().catch(() => {});
    }
    await revokeBrokerCredentials(req.userId, broker);
    clearAngelOneMarketFeedCache(req.userId);

    // Stop any active algo state
    await pool.query(
      `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [req.userId]
    );

    await pool.query(
      `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
       VALUES ($1, 'BROKER_DISCONNECTED', $2, $3::jsonb)`,
      [
        req.userId,
        `${broker} trading account disconnected`,
        JSON.stringify({ broker, timestamp: new Date().toISOString() }),
      ]
    );

    res.json({
      success: true,
      broker,
      status: 'DISCONNECTED',
      message: 'Angel One has been disconnected',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
