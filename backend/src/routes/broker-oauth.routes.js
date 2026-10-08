// Angel One SmartAPI account connection, session and postback routes.
// Angel One is the only supported broker.

import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { ANGEL_ONE, ANGEL_ONE_PUBLISHER_LOGIN_URL, AngelOneAdapter } from '../algo/broker-adapters.js';
import { storeBrokerTokens } from '../services/broker-token.service.js';
import { verifyBrokerConnection } from '../services/broker-verification.service.js';
import { applyBrokerExecutionUpdate, verifyBrokerWebhookRequest } from '../services/broker-execution.service.js';
import { areBrokerFeaturesEnabled } from '../config/env.js';
import { clearAngelOneMarketFeedCache } from '../services/angel-one-market-feed.service.js';
import { tryCreateQuantNotification } from '../services/quant-notification.service.js';
import {
  adapterFromAngelOneAccount,
  isAngelOneSessionError,
  loadAngelOneAccount,
  markAngelOneSessionExpired,
} from '../services/angel-one-session.service.js';

const router = Router();

function requireBrokerFeatures(req, res, next) {
  if (!areBrokerFeaturesEnabled()) {
    return res.status(503).json({
      error: 'Broker features are not configured on this server',
      message: 'Live broker connectivity is currently unavailable. Please contact support.',
      code: 'BROKER_FEATURES_DISABLED',
    });
  }
  next();
}

const ANGEL_ONE_CALLBACK_URI = String(process.env.ANGEL_ONE_REDIRECT_URL || 'https://kepwe.in/api/angel-one/callback').trim();
const OAUTH_STATE_TTL_MINUTES = 15;
const MAX_TOKEN_LENGTH = 4096;
const OAUTH_COOKIE_NAME = 'angel_one_oauth_state';
const MAX_PENDING_OAUTH_STATES = 8;
const OAUTH_COOKIE_SECURE = /^https:/i.test(ANGEL_ONE_CALLBACK_URI) && process.env.NODE_ENV === 'production';
const OAUTH_COOKIE_SAMESITE = OAUTH_COOKIE_SECURE ? 'None' : 'Lax';
const OAUTH_COOKIE_ATTRIBUTES = `Max-Age=${OAUTH_STATE_TTL_MINUTES * 60}; Path=/; HttpOnly; SameSite=${OAUTH_COOKIE_SAMESITE}${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`;

// `angelOneClientCode` / `password` are accepted as aliases of `clientCode` / `mpin`.
const connectSchema = z.object({
  clientCode: z.string().trim().min(1).max(60).optional(),
  angelOneClientCode: z.string().trim().min(1).max(60).optional(),
  mpin: z.string().trim().min(1).max(64).optional(),
  password: z.string().trim().min(1).max(64).optional(),
  totp: z.string().trim().min(6, 'Enter the 6-digit TOTP from your authenticator app').max(128),
  apiKey: z.string().trim().max(128).optional(),
}).strict();

const callbackQuerySchema = z.object({
  auth_token: z.string().trim().min(1).max(MAX_TOKEN_LENGTH).optional(),
  refresh_token: z.string().trim().min(1).max(MAX_TOKEN_LENGTH).optional(),
  feed_token: z.string().trim().min(1).max(MAX_TOKEN_LENGTH).optional(),
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
  return encoded.split(',').map((state) => state.trim()).filter(Boolean).slice(-MAX_PENDING_OAUTH_STATES);
}

async function failOAuthSession(sessionId, failureCode) {
  await pool.query(
    `UPDATE broker_oauth_sessions
     SET status = 'FAILED', failure_code = $2, updated_at = NOW()
     WHERE id = $1 AND status = 'PROCESSING'`,
    [sessionId, failureCode],
  );
}

async function claimOAuthSession(states = []) {
  if (!Array.isArray(states) || states.length === 0) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, user_id, broker, redirect_uri, expires_at
       FROM broker_oauth_sessions
       WHERE broker = $1 AND state_hash = ANY($2::text[]) AND status = 'PENDING' AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [ANGEL_ONE, states.map(hashState)],
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
      [session.id],
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
    [userId, ANGEL_ONE, hashState(state), ANGEL_ONE_CALLBACK_URI, OAUTH_STATE_TTL_MINUTES],
  );
  return state;
}

/** Public, non-secret fields of a SmartAPI failure for API responses. */
function brokerErrorBody(error, fallbackMessage) {
  return {
    success: false,
    broker: ANGEL_ONE,
    status: 'FAILED',
    error: error.message || fallbackMessage,
    code: error.code || 'BROKER_ERROR',
    category: error.angelCategory || null,
    brokerErrorCode: error.providerErrorCode ?? null,
    brokerErrorMessage: error.providerMessage ?? null,
    brokerHttpStatus: error.httpStatus ?? null,
  };
}

const CONNECT_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Angel One rejected the client code, MPIN or TOTP. Check them and try again with a fresh TOTP.',
  INVALID_API_KEY: 'Angel One rejected the SmartAPI key. Check the API key from your SmartAPI app (and that this server\'s static IP is registered for it).',
  ACCOUNT_BLOCKED: 'Angel One reports this account is blocked for trading or API access.',
  RATE_LIMITED: 'Angel One rate limit reached. Wait a few seconds and try again.',
  NETWORK_ERROR: 'Could not reach Angel One SmartAPI. Try again shortly.',
  TIMEOUT: 'Angel One SmartAPI did not respond in time. Try again shortly.',
};

/**
 * Stores a freshly authenticated session (inside one transaction), then runs
 * the full live verification. Shared by direct login and publisher login.
 */
async function persistAndVerifyConnection({ userId, adapter, clientCode, userApiKey, loginMethod }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO broker_accounts (user_id, broker, client_id, status, connection_mode, connected_at, updated_at)
       VALUES ($1, $2, $3, 'CONNECTED', 'LIVE', NOW(), NOW())
       ON CONFLICT (user_id, broker) DO UPDATE
       SET client_id = EXCLUDED.client_id, status = 'CONNECTED', connection_mode = 'LIVE',
           connected_at = NOW(), updated_at = NOW()`,
      [userId, ANGEL_ONE, clientCode],
    );
    await storeBrokerTokens({
      client,
      userId,
      broker: ANGEL_ONE,
      accessToken: adapter.session.jwtToken,
      refreshToken: adapter.session.refreshToken || null,
      feedToken: adapter.session.feedToken || null,
      apiKey: userApiKey || null,
      expiresAt: adapter.session.tokenExpiresAt,
    });
    await client.query(
      `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
       VALUES ($1, 'BROKER_CONNECTED', $2, $3::jsonb)`,
      [
        userId,
        `Angel One trading account (${clientCode}) authenticated - starting verification`,
        JSON.stringify({ broker: ANGEL_ONE, clientCode, mode: 'LIVE', loginMethod }),
      ],
    );
    await client.query('COMMIT');
  } catch (dbError) {
    await client.query('ROLLBACK');
    throw dbError;
  } finally {
    client.release();
  }
  // The stored session changed: drop any cached market-feed result for this user.
  clearAngelOneMarketFeedCache(userId);

  const verification = await verifyBrokerConnection(userId, ANGEL_ONE, {
    skipMarketData: false,
    timeout: 45000,
    logResults: true,
  });
  const nextStatus = verification.status === 'CONNECTED'
    ? 'CONNECTED'
    : (verification.status === 'PARTIALLY_CONNECTED' ? 'PARTIALLY_CONNECTED' : 'VERIFICATION_FAILED');
  await pool.query(
    `UPDATE broker_accounts
     SET status = $3, last_verified_at = NOW(), verification_score = $4, updated_at = NOW()
     WHERE user_id = $1 AND broker = $2`,
    [userId, ANGEL_ONE, nextStatus, verification.overallScore],
  );
  if (nextStatus === 'CONNECTED') {
    await tryCreateQuantNotification(pool, {
      userId,
      type: 'BROKER_CONNECTED',
      title: 'Angel One connected',
      body: `Angel One client ${clientCode} verified with SmartAPI.`,
      data: { broker: ANGEL_ONE, clientCode, marketDataAvailable: verification.marketData?.available ?? null },
    });
  }
  return { verification, status: nextStatus };
}

/**
 * Direct connection: the user supplies their Angel One client code, MPIN and
 * current TOTP (and their SmartAPI key when the server has none). The login is
 * performed against SmartAPI immediately; the MPIN and TOTP are never stored.
 */
router.post('/broker/angel-one/connect', requireAuth, requireBrokerFeatures, async (req, res, next) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parameters', code: 'INVALID_PARAMETERS' });
  }
  const clientCode = String(parsed.data.clientCode || parsed.data.angelOneClientCode || '').trim().toUpperCase();
  const mpin = String(parsed.data.mpin || parsed.data.password || '').trim();
  const { totp } = parsed.data;
  const userApiKey = String(parsed.data.apiKey || '').trim();
  if (!clientCode) return res.status(400).json({ error: 'Angel One Client Code is required', code: 'INVALID_PARAMETERS' });
  if (!mpin) return res.status(400).json({ error: 'Angel One MPIN is required', code: 'INVALID_PARAMETERS' });

  const adapter = new AngelOneAdapter({ clientCode, apiKey: userApiKey || null });
  if (!adapter.isConfigured()) {
    return res.status(400).json({
      error: 'A SmartAPI key is required. Create an app at smartapi.angelone.in and enter its API key.',
      code: 'BROKER_API_KEY_MISSING',
      broker: ANGEL_ONE,
    });
  }

  try {
    await adapter.login({ clientCode, mpin, totp });
    // Identity comes only from Angel One's own profile response.
    const profile = await adapter.getProfile();
    if (!profile.clientCode || profile.clientCode !== clientCode) {
      await adapter.logout().catch(() => {});
      return res.status(409).json({
        error: 'The Angel One session belongs to a different client code than the one entered.',
        code: 'BROKER_ACCOUNT_IDENTITY_MISMATCH',
        broker: ANGEL_ONE,
        status: 'FAILED',
      });
    }

    const { verification, status } = await persistAndVerifyConnection({
      userId: req.userId,
      adapter,
      clientCode,
      userApiKey: adapter.apiKeySource === 'USER' ? userApiKey : null,
      loginMethod: 'MPIN_TOTP',
    });
    const body = {
      broker: ANGEL_ONE,
      clientCode,
      clientName: profile.name || null,
      status,
      mode: 'LIVE',
      tokenExpiresAt: adapter.tokenExpiresAt ? adapter.tokenExpiresAt.toISOString() : null,
      marketData: verification.marketData || null,
      verification: {
        status: verification.status,
        score: verification.overallScore,
        checks: Object.fromEntries(Object.entries(verification.checks).map(([name, check]) => [name, { status: check.status, message: check.message }])),
        errors: verification.errors,
        warnings: verification.warnings,
        lastVerified: verification.timestamp,
      },
    };
    if (status === 'CONNECTED') {
      return res.json({
        success: true,
        ...body,
        message: verification.marketData?.available === false
          ? `Angel One account connected. Live market data check did not pass: ${verification.marketData.reason}`
          : 'Angel One account connected and fully verified',
      });
    }
    if (status === 'PARTIALLY_CONNECTED') {
      return res.status(206).json({
        success: false,
        ...body,
        error: 'Some Angel One functionality is not available',
        message: 'Connection partially successful - some features may be limited',
      });
    }
    return res.status(400).json({
      success: false,
      ...body,
      status: 'FAILED',
      error: 'Angel One connection verification failed',
      details: verification.errors[0] || 'Required broker functionality is not available',
    });
  } catch (error) {
    console.error('[ANGEL_ONE_CONNECT]', JSON.stringify({
      userId: req.userId,
      clientCode,
      error: error.message,
      code: error.code || null,
      category: error.angelCategory || null,
      httpStatus: error.httpStatus ?? null,
      brokerErrorCode: error.providerErrorCode ?? null,
    }));
    if (error.name === 'BrokerApiError' || error.name === 'BrokerCapabilityError') {
      // A rejected login changes nothing at Angel One, so any existing stored
      // connection is left exactly as it was.
      const status = error.statusCode === 401 ? 422 : (error.statusCode || 400);
      return res.status(status).json({
        ...brokerErrorBody(error),
        error: CONNECT_ERROR_MESSAGES[error.angelCategory] || error.message,
      });
    }
    return next(error);
  }
});

/**
 * SmartAPI publisher login (redirect flow): the user signs in on Angel One's
 * own page and Angel One redirects back with session tokens. Requires the
 * server SmartAPI key and its registered redirect URL.
 */
router.post('/broker/angel-one/oauth/start', requireAuth, requireBrokerFeatures, async (req, res, next) => {
  try {
    const apiKey = String(process.env.ANGEL_ONE_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(409).json({
        error: 'Angel One redirect login is not available: no server SmartAPI key is configured. Connect with client code, MPIN and TOTP instead.',
        code: 'BROKER_API_KEY_MISSING',
        broker: ANGEL_ONE,
      });
    }
    const state = await createOAuthState(req.userId);
    const states = [...readOAuthStates(req), state].slice(-MAX_PENDING_OAUTH_STATES);
    res.setHeader('Set-Cookie', `${OAUTH_COOKIE_NAME}=${encodeURIComponent(states.join(','))}; ${OAUTH_COOKIE_ATTRIBUTES}`);
    const url = new URL(ANGEL_ONE_PUBLISHER_LOGIN_URL);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('state', state);
    return res.json({ authorizationUrl: url.toString(), redirectUri: ANGEL_ONE_CALLBACK_URI });
  } catch (error) {
    return next(error);
  }
});

/**
 * Publisher-login redirect target. Public by design: the caller is identified
 * by the single-use state created in /oauth/start, never by the query tokens.
 */
router.get(['/broker/angel-one/callback', '/angel-one/callback'], async (req, res, next) => {
  const parsed = callbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid Angel One callback parameters' });
  }
  const { auth_token: authToken, refresh_token: refreshToken, feed_token: feedToken, error } = parsed.data;
  if (!authToken && !error) {
    return res.json({ status: 'ok', service: 'angel-one-callback-endpoint', timestamp: new Date().toISOString() });
  }
  const callbackStates = parsed.data.state ? [parsed.data.state] : readOAuthStates(req);

  let session = null;
  try {
    session = await claimOAuthSession(callbackStates);
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired Angel One login session. Start the connection again from KEPWE Quant.' });
    }
    if (error || !authToken) {
      await failOAuthSession(session.id, 'PROVIDER_AUTHORIZATION_DENIED');
      return res.status(400).json({ error: 'Angel One authorization was not completed' });
    }

    const adapter = new AngelOneAdapter();
    await adapter.adoptSession({ jwtToken: authToken, refreshToken: refreshToken || null, feedToken: feedToken || null });
    // The tokens are only trusted once Angel One's own profile API accepts them.
    const profile = await adapter.getProfile();
    if (!profile.clientCode) {
      await failOAuthSession(session.id, 'PROFILE_INCOMPLETE');
      return res.status(502).json({ error: 'Angel One did not return a client code for this session' });
    }
    adapter.clientCode = profile.clientCode;

    const { verification, status } = await persistAndVerifyConnection({
      userId: session.user_id,
      adapter,
      clientCode: profile.clientCode,
      userApiKey: null,
      loginMethod: 'PUBLISHER_LOGIN',
    });
    if (status === 'VERIFICATION_FAILED') {
      await failOAuthSession(session.id, `VERIFICATION_${verification.status}`);
      return res.status(503).json({
        error: 'Angel One login succeeded but live verification did not pass',
        status: verification.status,
        blockers: verification.errors,
      });
    }
    await pool.query(`UPDATE broker_oauth_sessions SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [session.id]);
    res.setHeader('Set-Cookie', `${OAUTH_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=${OAUTH_COOKIE_SAMESITE}${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`);
    return res.redirect(303, '/quant/dashboard/broker?angelone=connected');
  } catch (caught) {
    if (session?.id) await failOAuthSession(session.id, 'CALLBACK_PROCESSING_FAILED').catch(() => {});
    console.error('[ANGEL_ONE_CALLBACK]', JSON.stringify({
      userId: session?.user_id || null,
      oauthSessionId: session?.id || null,
      error: caught.message,
      code: caught.code || null,
      brokerErrorCode: caught.providerErrorCode ?? null,
    }));
    if (caught.name === 'BrokerApiError') {
      return res.status(caught.statusCode === 401 ? 422 : (caught.statusCode || 502)).json(brokerErrorBody(caught));
    }
    return next(caught);
  }
});

/**
 * Angel One order postback (webhook). Register this URL in the SmartAPI app as
 *   https://<host>/api/angel-one/postback?token=<ANGEL_ONE_WEBHOOK_TOKEN>
 * The payload is unsigned, so it is used only as a trigger: the order's state
 * is read back from SmartAPI before anything is applied.
 */
router.post(['/broker/angel-one/callback', '/angel-one/callback', '/angel-one/postback'], async (req, res, next) => {
  if (!verifyBrokerWebhookRequest(req, ANGEL_ONE)) {
    return res.status(401).json({ error: 'Broker webhook authentication failed', code: 'BROKER_WEBHOOK_UNAUTHORIZED', broker: ANGEL_ONE });
  }
  try {
    const payload = req.body || {};
    const result = await applyBrokerExecutionUpdate({
      pool,
      broker: ANGEL_ONE,
      brokerOrderId: payload.orderid || payload.orderId || payload.brokerOrderId,
      correlationId: payload.ordertag || payload.correlationId,
      status: String(payload.orderstatus || payload.status || '').trim(),
      filledQuantity: payload.filledshares ?? payload.filledQuantity ?? 0,
      remainingQuantity: payload.unfilledshares ?? payload.remainingQuantity ?? null,
      averagePrice: payload.averageprice ?? payload.averagePrice ?? null,
      rejectionReason: payload.text || payload.rejectionReason || null,
      payload,
    });
    if (result.deferred) return res.status(202).json({ status: 'deferred', reason: result.reason, received: true });
    if (result.ignored) return res.status(404).json({ status: 'ignored', reason: result.reason });
    return res.status(200).json({ status: result.duplicate ? 'duplicate' : 'success', received: true, source: result.source || null });
  } catch (error) {
    // Out-of-order or repeated events are acknowledged, never re-applied.
    if (error?.name === 'InvalidOrderStateError') {
      return res.status(200).json({ status: 'stale_or_duplicate', received: true });
    }
    if (error?.code === 'EXECUTION_PRICE_MISSING') {
      return res.status(202).json({ status: 'deferred', reason: 'broker did not report a traded price yet', received: true });
    }
    return next(error);
  }
});

/**
 * Renews the stored session through SmartAPI generateTokens and reports the
 * outcome. Sessions are also renewed automatically whenever SmartAPI reports
 * an expired token.
 */
router.post('/broker/angel-one/refresh', requireAuth, requireBrokerFeatures, async (req, res, next) => {
  try {
    const row = await loadAngelOneAccount(pool, req.userId);
    if (!row?.access_token_ciphertext) {
      return res.status(409).json({ error: 'Angel One is not connected for this account.', code: 'ANGEL_ONE_NOT_CONNECTED', broker: ANGEL_ONE });
    }
    const adapter = adapterFromAngelOneAccount(pool, row);
    try {
      await adapter.renewSession();
      const profile = await adapter.getProfile();
      await pool.query(
        `UPDATE broker_accounts SET status = 'CONNECTED', connection_mode = 'LIVE', updated_at = NOW()
         WHERE id = $1 AND status IN ('CONNECTED', 'PARTIALLY_CONNECTED', 'SESSION_EXPIRED')`,
        [row.id],
      );
      clearAngelOneMarketFeedCache(req.userId);
      return res.json({
        success: true,
        broker: ANGEL_ONE,
        status: 'CONNECTED',
        clientId: profile.clientCode,
        tokenExpiresAt: adapter.tokenExpiresAt ? adapter.tokenExpiresAt.toISOString() : null,
      });
    } catch (error) {
      if (isAngelOneSessionError(error)) {
        await markAngelOneSessionExpired(pool, row.id);
        clearAngelOneMarketFeedCache(req.userId);
        return res.status(401).json({
          ...brokerErrorBody(error),
          status: 'ANGEL_ONE_SESSION_EXPIRED',
          code: 'ANGEL_ONE_SESSION_EXPIRED',
          error: 'Angel One session has expired and could not be renewed. Please reconnect your Angel One account.',
        });
      }
      if (error.name === 'BrokerApiError') return res.status(error.statusCode || 502).json(brokerErrorBody(error));
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * Disconnect: ends the SmartAPI session at Angel One (logout), deletes the
 * stored tokens and stops any running algo.
 */
router.post('/broker/angel-one/disconnect', requireAuth, requireBrokerFeatures, async (req, res, next) => {
  try {
    const row = await loadAngelOneAccount(pool, req.userId);
    let brokerLogout = { attempted: false, loggedOut: false, reason: 'no stored session' };
    if (row?.access_token_ciphertext) {
      try {
        const result = await adapterFromAngelOneAccount(pool, row).logout();
        brokerLogout = { attempted: true, loggedOut: result.loggedOut === true, reason: result.reason || null };
      } catch (error) {
        // An already expired session cannot be logged out; local removal still proceeds.
        brokerLogout = { attempted: true, loggedOut: false, reason: error.message, brokerErrorCode: error.providerErrorCode ?? null };
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const accountRes = await client.query(
        `UPDATE broker_accounts
         SET status = 'NOT_CONNECTED', connection_mode = 'LIVE', is_active_broker = FALSE, updated_at = NOW()
         WHERE user_id = $1 AND broker = $2
         RETURNING id`,
        [req.userId, ANGEL_ONE],
      );
      if (accountRes.rows.length > 0) {
        await client.query('DELETE FROM broker_oauth_tokens WHERE broker_account_id = $1', [accountRes.rows[0].id]);
      }
      await client.query(
        `UPDATE algo_states SET status = 'STOPPED', updated_at = NOW()
         WHERE user_id = $1 AND status = 'ACTIVE'`,
        [req.userId],
      );
      await client.query(
        `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
         VALUES ($1, 'BROKER_DISCONNECTED', 'Angel One trading account disconnected', $2::jsonb)`,
        [req.userId, JSON.stringify({ broker: ANGEL_ONE, brokerLogout: { attempted: brokerLogout.attempted, loggedOut: brokerLogout.loggedOut } })],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    clearAngelOneMarketFeedCache(req.userId);
    return res.json({
      success: true,
      broker: ANGEL_ONE,
      status: 'NOT_CONNECTED',
      mode: 'LIVE',
      brokerLogout,
    });
  } catch (error) {
    return next(error);
  }
});

export { ANGEL_ONE_CALLBACK_URI, createOAuthState, hashState };
export default router;
