import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { DhanAdapter } from '../algo/broker-adapters.js';
import { storeBrokerTokens } from '../services/broker-token.service.js';

const router = Router();

const DHAN = 'DHAN';
const DHAN_CALLBACK_URI = String(process.env.DHAN_REDIRECT_URL || 'https://kepwe.in/api/lemonn/callback').trim();
const OAUTH_STATE_TTL_MINUTES = 15;
const MAX_AUTH_CODE_LENGTH = 4096;
const OAUTH_COOKIE_NAME = 'dhan_oauth_state';
const MAX_PENDING_OAUTH_STATES = 8;
const OAUTH_COOKIE_SECURE = /^https:/i.test(DHAN_CALLBACK_URI) && process.env.NODE_ENV === 'production';
const OAUTH_COOKIE_SAMESITE = OAUTH_COOKIE_SECURE ? 'None' : 'Lax';
const OAUTH_COOKIE_ATTRIBUTES = `Max-Age=${OAUTH_STATE_TTL_MINUTES * 60}; Path=/; HttpOnly; SameSite=${OAUTH_COOKIE_SAMESITE}${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`;

const connectSchema = z.object({
  dhanClientId: z.string().trim().min(1, 'Dhan Client ID is required').max(60),
  accessToken: z.string().trim().min(1, 'Dhan Access Token is required').max(MAX_AUTH_CODE_LENGTH),
}).strict();

const callbackQuerySchema = z.object({
  tokenId: z.string().trim().min(1).max(MAX_AUTH_CODE_LENGTH).optional(),
  tokenid: z.string().trim().min(1).max(MAX_AUTH_CODE_LENGTH).optional(),
  consentAppId: z.string().trim().min(1).max(256).optional(),
  state: z.string().trim().min(1).max(512).optional(),
  error: z.string().trim().min(1).max(256).optional(),
}).passthrough();

function hashState(state) {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

function readCookie(req, name) {
  const value = String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
}

function readOAuthStates(req) {
  const encoded = readCookie(req, OAUTH_COOKIE_NAME);
  if (!encoded) return [];
  return encoded
    .split(',')
    .map((state) => state.trim())
    .filter(Boolean)
    .slice(-MAX_PENDING_OAUTH_STATES);
}

function serializeOAuthStates(states) {
  return states.slice(-MAX_PENDING_OAUTH_STATES).join(',');
}

async function failOAuthSession(sessionId, failureCode) {
  await pool.query(
    `UPDATE broker_oauth_sessions
     SET status = 'FAILED', failure_code = $2, updated_at = NOW()
     WHERE id = $1 AND status = 'PROCESSING'`,
    [sessionId, failureCode]
  );
}

async function claimOAuthSession(states = []) {
  if (!Array.isArray(states) || states.length === 0) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateHashes = states.map(hashState);
    const result = await client.query(
      `SELECT id, user_id, broker, redirect_uri
       FROM broker_oauth_sessions
       WHERE broker = $1 AND state_hash = ANY($2::text[]) AND status = 'PENDING' AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [DHAN, stateHashes]
    );
    const session = result.rows[0];
    if (!session) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      `UPDATE broker_oauth_sessions
       SET status = 'PROCESSING', consumed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [session.id]
    );
    await client.query('COMMIT');
    return session;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createOAuthState(userId) {
  const state = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO broker_oauth_sessions
       (user_id, broker, state_hash, redirect_uri, status, expires_at)
     VALUES ($1, $2, $3, $4, 'PENDING', NOW() + ($5::int * INTERVAL '1 minute'))`,
    [userId, DHAN, hashState(state), DHAN_CALLBACK_URI, OAUTH_STATE_TTL_MINUTES]
  );
  return state;
}

/**
 * Direct Connection: A KEPWE user connects their personal Dhan trading account
 * by providing their Dhan Client ID and 24-hour Access Token.
 * The connection is validated immediately against Dhan's live API before storing.
 */
router.post('/broker/dhan/connect', requireAuth, async (req, res, next) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' });
  }

  const { dhanClientId, accessToken } = parsed.data;

  try {
    const adapter = new DhanAdapter({ dhanClientId, accessToken });
    const validation = await adapter.validateSession();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const accountRes = await client.query(
        `INSERT INTO broker_accounts (user_id, broker, client_id, status, connection_mode, connected_at, updated_at)
         VALUES ($1, $2, $3, 'CONNECTED', 'LIVE', NOW(), NOW())
         ON CONFLICT (user_id, broker) DO UPDATE
         SET client_id = EXCLUDED.client_id, status = 'CONNECTED', connection_mode = 'LIVE', connected_at = NOW(), updated_at = NOW()
         RETURNING id`,
        [req.userId, DHAN, dhanClientId]
      );

      await storeBrokerTokens({
        client,
        userId: req.userId,
        broker: DHAN,
        accessToken,
      });

      await client.query(
        `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
         VALUES ($1, 'BROKER_CONNECTED', $2, $3::jsonb)`,
        [
          req.userId,
          `Dhan trading account (${dhanClientId}) successfully connected`,
          JSON.stringify({ broker: DHAN, dhanClientId, mode: 'LIVE' }),
        ]
      );

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    return res.json({
      success: true,
      broker: DHAN,
      dhanClientId,
      status: 'CONNECTED',
      mode: 'LIVE',
      funds: validation.funds,
    });
  } catch (error) {
    if (error.name === 'BrokerApiError' || error.name === 'BrokerCapabilityError') {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }
    return next(error);
  }
});

/**
 * Consent OAuth: Initiates a Dhan consent login session.
 */
router.post('/broker/dhan/oauth/start', requireAuth, async (req, res, next) => {
  try {
    const state = await createOAuthState(req.userId);
    const states = [...readOAuthStates(req), state];
    res.setHeader('Set-Cookie', `${OAUTH_COOKIE_NAME}=${encodeURIComponent(serializeOAuthStates(states))}; ${OAUTH_COOKIE_ATTRIBUTES}`);

    const adapter = new DhanAdapter();
    const consent = await adapter.generateConsentSession();
    return res.json({ authorizationUrl: consent.authorizationUrl, consentAppId: consent.consentAppId });
  } catch (error) {
    return next(error);
  }
});

/**
 * Public Callback / Redirect Handler:
 * Preserves the confirmed Dhan postback / callback URL: https://kepwe.in/api/lemonn/callback
 * Also handles canonical /api/dhan/callback.
 */
router.get(
  ['/broker/dhan/callback', '/dhan/callback', '/broker/lemonn/callback', '/lemonn/callback'],
  async (req, res, next) => {
    const parsed = callbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid OAuth callback parameters' });
    }

    const { error } = parsed.data;
    const tokenId = parsed.data.tokenId || parsed.data.tokenid;
    const callbackStates = parsed.data.state ? [parsed.data.state] : readOAuthStates(req);

    if (!tokenId && !error) {
      return res.json({ status: 'ok', service: 'dhan-postback-endpoint', timestamp: new Date().toISOString() });
    }

    try {
      const session = await claimOAuthSession(callbackStates);
      if (!session) {
        return res.status(400).json({ error: 'Invalid or expired Dhan OAuth session' });
      }

      if (error) {
        await failOAuthSession(session.id, 'PROVIDER_AUTHORIZATION_DENIED');
        return res.status(400).json({ error: 'Dhan authorization was not completed' });
      }

      if (!tokenId) {
        await failOAuthSession(session.id, 'INVALID_TOKEN_ID');
        return res.status(400).json({ error: 'Dhan tokenId is missing' });
      }

      const adapter = new DhanAdapter();
      const tokenResult = await adapter.consumeConsent({ tokenId });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO broker_accounts (user_id, broker, client_id, status, connection_mode, connected_at, updated_at)
           VALUES ($1, $2, $3, 'CONNECTED', 'LIVE', NOW(), NOW())
           ON CONFLICT (user_id, broker) DO UPDATE
           SET client_id = COALESCE(EXCLUDED.client_id, broker_accounts.client_id), status = 'CONNECTED', connection_mode = 'LIVE', connected_at = NOW(), updated_at = NOW()`,
          [session.user_id, DHAN, tokenResult.dhanClientId || null]
        );

        await storeBrokerTokens({
          client,
          userId: session.user_id,
          broker: DHAN,
          accessToken: tokenResult.accessToken,
        });

        await client.query(
          `UPDATE broker_oauth_sessions SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
          [session.id]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      res.setHeader('Set-Cookie', `${OAUTH_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=${OAUTH_COOKIE_SAMESITE}${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`);
      return res.redirect(303, '/quant?dhan=connected');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * Dhan Postback (Webhook) endpoint:
 * Receives real-time order lifecycle updates pushed by Dhan servers.
 * Confirmed production URL: https://kepwe.in/api/lemonn/callback
 * Also accepts /api/dhan/callback and /api/dhan/postback.
 */
router.post(
  ['/broker/dhan/callback', '/dhan/callback', '/dhan/postback', '/broker/lemonn/callback', '/lemonn/callback'],
  async (req, res, next) => {
    try {
      const payload = req.body || {};
      const orderId = String(payload.orderId || payload.order_id || payload.brokerOrderId || '').trim();
      const correlationId = String(payload.correlationId || payload.correlation_id || '').trim();
      const rawStatus = String(payload.orderStatus || payload.order_status || payload.status || '').toUpperCase();

      if (!orderId && !correlationId) {
        return res.status(200).json({ status: 'ignored', reason: 'No order identifier provided' });
      }

      // Map Dhan order status to internal status
      let internalStatus = 'SUBMITTED';
      if (['TRADED', 'COMPLETE', 'COMPLETED', 'FILLED'].includes(rawStatus)) {
        internalStatus = 'FILLED';
      } else if (['REJECTED', 'FAILED'].includes(rawStatus)) {
        internalStatus = 'REJECTED';
      } else if (['CANCELLED', 'CANCELED'].includes(rawStatus)) {
        internalStatus = 'CANCELLED';
      } else if (['PARTIALLY_TRADED', 'PARTIALLY_FILLED'].includes(rawStatus)) {
        internalStatus = 'PARTIALLY_FILLED';
      }

      const filledQty = Number(payload.filledQty ?? payload.filledQuantity ?? 0);
      const avgPrice = Number(payload.averagePrice ?? payload.avgPrice ?? payload.price ?? 0);
      const rejectionReason = payload.rejectionReason || payload.reason || payload.remarks || null;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Look up matching order safely handling UUID type on internal_order_id
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(correlationId);
        const existingRes = await client.query(
          `SELECT id, user_id, status FROM algo_orders
           WHERE broker_order_id = $1
              OR ($2::uuid IS NOT NULL AND internal_order_id = $2::uuid)
           LIMIT 1`,
          [orderId || null, isUuid ? correlationId : null]
        );

        if (existingRes.rows.length > 0) {
          const order = existingRes.rows[0];
          await client.query(
            `UPDATE algo_orders SET
               broker_order_id = COALESCE(broker_order_id, $1),
               status = $2,
               filled_quantity = CASE WHEN $3::integer > 0 THEN $3::integer ELSE filled_quantity END,
               average_fill_price = CASE WHEN $4::numeric > 0 THEN $4::numeric ELSE average_fill_price END,
               rejection_reason = COALESCE($5, rejection_reason),
               updated_at = NOW()
             WHERE id = $6::uuid`,
            [orderId || null, internalStatus, filledQty, avgPrice, rejectionReason, order.id]
          );

          await client.query(
            `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
             VALUES ($1, 'POSTBACK_RECEIVED', $2, $3::jsonb)`,
            [
              order.user_id,
              `Dhan postback: Order ${orderId || correlationId} updated to ${internalStatus}`,
              JSON.stringify({ broker: DHAN, orderId, correlationId, rawStatus, internalStatus }),
            ]
          );
        }

        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }

      return res.status(200).json({ status: 'success', received: true, orderId });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * Disconnect Dhan Account for authenticated user
 */
router.post('/broker/dhan/disconnect', requireAuth, async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const accountRes = await client.query(
        `UPDATE broker_accounts
         SET status = 'NOT_CONNECTED', connection_mode = 'SANDBOX', updated_at = NOW()
         WHERE user_id = $1 AND broker = 'DHAN'
         RETURNING id, broker, status, connection_mode`,
        [req.userId]
      );

      if (accountRes.rows.length > 0) {
        await client.query(
          `DELETE FROM broker_oauth_tokens WHERE broker_account_id = $1`,
          [accountRes.rows[0].id]
        );
      }

      // Stop any active algo state
      await client.query(
        `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
         WHERE user_id = $1 AND status = 'ACTIVE'`,
        [req.userId]
      );

      await client.query(
        `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
         VALUES ($1, 'BROKER_DISCONNECTED', 'Dhan trading account disconnected', '{"broker":"DHAN"}'::jsonb)`,
        [req.userId]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        broker: DHAN,
        status: 'NOT_CONNECTED',
        mode: 'SANDBOX',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return next(error);
  }
});

export { DHAN_CALLBACK_URI, createOAuthState, hashState };
export default router;