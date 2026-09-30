import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { DhanAdapter, AngelOneAdapter } from '../algo/broker-adapters.js';
import { storeBrokerTokens } from '../services/broker-token.service.js';
import { assertBrokerIdentity, verifyBrokerConnection } from '../services/broker-verification.service.js';
import { applyBrokerExecutionUpdate, verifyBrokerWebhookRequest } from '../services/broker-execution.service.js';
import { areBrokerFeaturesEnabled } from '../config/env.js';

const router = Router();

// Middleware to check if broker features are enabled
function requireBrokerFeatures(req, res, next) {
  if (!areBrokerFeaturesEnabled()) {
    return res.status(503).json({
      error: 'Broker features are not configured on this server',
      message: 'Live broker connectivity is currently unavailable. Please contact support.',
    });
  }
  next();
}

const DHAN = 'DHAN';
const ANGEL_ONE = 'ANGEL_ONE';
const DHAN_CALLBACK_URI = String(process.env.DHAN_REDIRECT_URL || 'https://kepwe.in/api/lemonn/callback').trim();
const ANGEL_ONE_CALLBACK_URI = String(process.env.ANGEL_ONE_REDIRECT_URL || 'https://kepwe.in/api/angel-one/callback').trim();
const OAUTH_STATE_TTL_MINUTES = 15;
const MAX_AUTH_CODE_LENGTH = 4096;
const OAUTH_COOKIE_NAME = 'dhan_oauth_state';
const ANGEL_ONE_OAUTH_COOKIE_NAME = 'angel_one_oauth_state';
const MAX_PENDING_OAUTH_STATES = 8;
const OAUTH_COOKIE_SECURE = /^https:/i.test(DHAN_CALLBACK_URI) && process.env.NODE_ENV === 'production';
const ANGEL_ONE_OAUTH_COOKIE_SECURE = /^https:/i.test(ANGEL_ONE_CALLBACK_URI) && process.env.NODE_ENV === 'production';
const OAUTH_COOKIE_SAMESITE = OAUTH_COOKIE_SECURE ? 'None' : 'Lax';
const ANGEL_ONE_OAUTH_COOKIE_SAMESITE = ANGEL_ONE_OAUTH_COOKIE_SECURE ? 'None' : 'Lax';
const OAUTH_COOKIE_ATTRIBUTES = `Max-Age=${OAUTH_STATE_TTL_MINUTES * 60}; Path=/; HttpOnly; SameSite=${OAUTH_COOKIE_SAMESITE}${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`;
const ANGEL_ONE_OAUTH_COOKIE_ATTRIBUTES = `Max-Age=${OAUTH_STATE_TTL_MINUTES * 60}; Path=/; HttpOnly; SameSite=${ANGEL_ONE_OAUTH_COOKIE_SAMESITE}${ANGEL_ONE_OAUTH_COOKIE_SECURE ? '; Secure' : ''}`;

const connectSchema = z.object({
  dhanClientId: z.string().trim().min(1, 'Dhan Client ID is required').max(60),
  accessToken: z.string().trim().min(1, 'Dhan Access Token is required').max(MAX_AUTH_CODE_LENGTH),
}).strict();

const angelOneConnectSchema = z.object({
  angelOneClientCode: z.string().trim().min(1, 'Angel One Client Code is required').max(60),
  password: z.string().trim().min(1, 'Password or MPIN is required').max(256),
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

function readOAuthStates(req, cookieName = OAUTH_COOKIE_NAME) {
  const encoded = readCookie(req, cookieName);
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

async function claimOAuthSession(states = [], broker = DHAN) {
  if (!Array.isArray(states) || states.length === 0) return null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateHashes = states.map(hashState);
    const result = await client.query(
      `SELECT id, user_id, broker, redirect_uri, expires_at
       FROM broker_oauth_sessions
       WHERE broker = $1 AND state_hash = ANY($2::text[]) AND status = 'PENDING' AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [broker, stateHashes]
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

async function createOAuthState(userId, broker = DHAN) {
  const state = randomBytes(32).toString('base64url');
  const redirectUri = broker === ANGEL_ONE ? ANGEL_ONE_CALLBACK_URI : DHAN_CALLBACK_URI;
  await pool.query(
    `INSERT INTO broker_oauth_sessions
       (user_id, broker, state_hash, redirect_uri, status, expires_at)
     VALUES ($1, $2, $3, $4, 'PENDING', NOW() + ($5::int * INTERVAL '1 minute'))`,
    [userId, broker, hashState(state), redirectUri, OAUTH_STATE_TTL_MINUTES]
  );
  return state;
}

async function handleBrokerExecutionWebhook(req, res, next, broker) {
  if (!verifyBrokerWebhookRequest(req, broker)) {
    return res.status(401).json({ error: 'Broker webhook authentication failed', code: 'BROKER_WEBHOOK_UNAUTHORIZED' });
  }
  try {
    const payload = req.body || {};
    const status = String(payload.orderStatus || payload.order_status || payload.status || '').trim();
    const result = await applyBrokerExecutionUpdate({
      pool,
      broker,
      brokerOrderId: payload.orderId || payload.order_id || payload.brokerOrderId,
      correlationId: payload.correlationId || payload.correlation_id,
      status,
      filledQuantity: payload.filledQty ?? payload.filledQuantity ?? payload.filledshares ?? 0,
      remainingQuantity: payload.remainingQuantity ?? payload.remainingQty ?? null,
      averagePrice: payload.averagePrice ?? payload.avgPrice ?? payload.price ?? null,
      rejectionReason: payload.rejectionReason || payload.reason || payload.remarks || null,
      payload,
    });
    if (result.ignored) return res.status(404).json({ status: 'ignored', reason: result.reason });
    return res.status(200).json({ status: result.duplicate ? 'duplicate' : 'success', received: true });
  } catch (error) {
    return next(error);
  }
}

/**
 * Direct Connection: A KEPWE user connects their personal Dhan trading account
 * by providing their Dhan Client ID and 24-hour Access Token.
 * The connection is validated immediately against Dhan's live API before storing.
 */
router.post('/broker/dhan/connect', requireAuth, requireBrokerFeatures, async (req, res, next) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' });
  }

  const { dhanClientId, accessToken } = parsed.data;

  try {
    // Create adapter with user's credentials 
    const adapter = new DhanAdapter({ dhanClientId, accessToken });
    
    // Step 1: Validate session and basic connectivity
    console.log(`[DHAN_CONNECT] Starting session validation for user ${req.userId} with client ID ${dhanClientId}`);
    const validation = await adapter.validateSession();
    
    if (!validation.valid) {
      console.log(`[DHAN_CONNECT] Session validation failed for user ${req.userId}`);
      return res.status(401).json({ 
        error: 'Dhan session validation failed. Please check your client ID and access token.',
        details: 'Invalid credentials or expired access token'
      });
    }
    await assertBrokerIdentity(adapter, DHAN, dhanClientId);

    console.log(`[DHAN_CONNECT] Session validation successful for user ${req.userId}`);

    // Step 2: Store connection in database
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

      // Step 3: Store encrypted access token (user-specific)
      await storeBrokerTokens({
        client,
        userId: req.userId,
        broker: DHAN,
        accessToken,
        expiresAt: adapter.tokenExpiresAt,
      });

      await client.query(
        `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
         VALUES ($1, 'BROKER_CONNECTED', $2, $3::jsonb)`,
        [
          req.userId,
          `Dhan trading account (${dhanClientId}) connected - starting verification`,
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

    console.log(`[DHAN_CONNECT] Starting comprehensive verification for user ${req.userId}`);

    // Step 4: Comprehensive verification (this is the critical part)
    const verification = await verifyBrokerConnection(req.userId, DHAN, {
      skipMarketData: false, // Verify all functionality
      timeout: 45000,
      logResults: true,
    });

    console.log(`[DHAN_CONNECT] Verification complete for user ${req.userId}: ${verification.status} (${verification.overallScore}%)`);

    // Step 5: Update connection status based on verification
    if (verification.status === 'CONNECTED') {
      return res.json({
        success: true,
        broker: DHAN,
        dhanClientId,
        status: 'CONNECTED',
        mode: 'LIVE',
        verification: {
          status: verification.status,
          score: verification.overallScore,
          checks: Object.keys(verification.checks).length,
          lastVerified: verification.timestamp,
        },
        accountData: verification.accountData,
        tokenExpiresAt: adapter.tokenExpiresAt ? adapter.tokenExpiresAt.toISOString() : null,
        marketData: verification.marketData || null,
        funds: validation.funds,
        message: verification.marketData?.available === false
          ? 'Dhan account connected. Live market data is unavailable from Dhan for this account (Data API).'
          : 'Dhan account connected and fully verified'
      });
    } else if (verification.status === 'PARTIALLY_CONNECTED') {
      await pool.query(
        `UPDATE broker_accounts SET status = 'PARTIALLY_CONNECTED', updated_at = NOW()
         WHERE user_id = $1 AND broker = $2`,
        [req.userId, DHAN],
      );
      return res.status(206).json({
        success: false,
        broker: DHAN,
        dhanClientId,
        status: 'PARTIALLY_CONNECTED',
        mode: 'LIVE',
        verification: {
          status: verification.status,
          score: verification.overallScore,
          checks: verification.checks,
          errors: verification.errors,
          warnings: verification.warnings,
          lastVerified: verification.timestamp,
        },
        funds: validation.funds,
        error: 'Some Dhan functionality is not available',
        message: 'Connection partially successful - some features may be limited'
      });
    } else {
      // Mark as failed in database
      await pool.query(
        `UPDATE broker_accounts SET status = 'VERIFICATION_FAILED', updated_at = NOW()
         WHERE user_id = $1 AND broker = $2`,
        [req.userId, DHAN]
      );

      return res.status(400).json({
        success: false,
        broker: DHAN,
        status: 'FAILED',
        verification: {
          status: verification.status,
          score: verification.overallScore,
          checks: verification.checks,
          errors: verification.errors,
          lastVerified: verification.timestamp,
        },
        error: 'Dhan connection verification failed',
        details: verification.errors[0] || 'Required broker functionality is not available'
      });
    }

  } catch (error) {
    console.error('[DHAN_CONNECT]', JSON.stringify({
      userId: req.userId,
      error: error.message,
      code: error.code || null,
      httpStatus: error.httpStatus ?? null,
      dhanErrorCode: error.providerErrorCode ?? null,
      dhanErrorType: error.providerErrorType ?? null,
    }));
    
    // Clean up failed connection
    try {
      await pool.query(
        `UPDATE broker_accounts SET status = 'CONNECTION_FAILED', updated_at = NOW()
         WHERE user_id = $1 AND broker = $2`,
        [req.userId, DHAN]
      );
    } catch (_) {}
    
    if (error.code === 'BROKER_ACCOUNT_IDENTITY_MISMATCH') {
      return res.status(409).json({
        error: 'The Dhan access token belongs to a different Dhan Client ID than the one entered.',
        code: error.code,
        broker: DHAN,
        status: 'FAILED',
      });
    }
    if (error.name === 'BrokerApiError' || error.name === 'BrokerCapabilityError') {
      return res.status(error.statusCode || 400).json({ 
        error: error.message,
        code: error.code || null,
        dhanErrorCode: error.providerErrorCode ?? null,
        dhanErrorMessage: error.providerMessage ?? null,
        dhanHttpStatus: error.httpStatus ?? null,
        broker: DHAN,
        status: 'FAILED'
      });
    }
    return next(error);
  }
});

/**
 * Direct Connection: A KEPWE user connects their personal Angel One trading account
 * by providing their Angel One Client Code and Password/MPIN.
 * The connection is validated immediately against Angel One's live API before storing.
 */
router.post('/broker/angel-one/connect', requireAuth, requireBrokerFeatures, async (req, res, next) => {
  const parsed = angelOneConnectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' });
  }

  const { angelOneClientCode, password } = parsed.data;

  try {
    // Create adapter with user's credentials (NOT environment variables)
    const adapter = new AngelOneAdapter({
      angelOneClientCode,
      password,
      // Use configured TOTP secret and API key from environment
      apiKey: process.env.ANGEL_ONE_API_KEY,
      totpSecret: process.env.ANGEL_ONE_TOTP_SECRET,
    });

    // Step 1: Authenticate with user's credentials
    console.log(`[ANGEL_ONE_CONNECT] Starting authentication for user ${req.userId} with client code ${angelOneClientCode}`);
    const authResult = await adapter.authenticate();
    
    if (!authResult.authenticated) {
      console.log(`[ANGEL_ONE_CONNECT] Authentication failed for user ${req.userId}`);
      return res.status(401).json({ 
        error: 'Angel One authentication failed. Please check your client code and password.',
        details: 'Invalid credentials or TOTP error'
      });
    }
    await assertBrokerIdentity(adapter, ANGEL_ONE, angelOneClientCode);

    console.log(`[ANGEL_ONE_CONNECT] Authentication successful for user ${req.userId}`);

    // Step 2: Store connection in database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const accountRes = await client.query(
        `INSERT INTO broker_accounts (user_id, broker, client_id, status, connection_mode, connected_at, updated_at)
         VALUES ($1, $2, $3, 'CONNECTED', 'LIVE', NOW(), NOW())
         ON CONFLICT (user_id, broker) DO UPDATE
         SET client_id = EXCLUDED.client_id, status = 'CONNECTED', connection_mode = 'LIVE', 
             connected_at = NOW(), updated_at = NOW()
         RETURNING id`,
        [req.userId, ANGEL_ONE, angelOneClientCode]
      );

      // Step 3: Store encrypted session tokens (user-specific)
      await storeBrokerTokens({
        client,
        userId: req.userId,
        broker: ANGEL_ONE,
        accessToken: adapter.session.jwtToken,
        refreshToken: adapter.session.refreshToken || null,
        feedToken: adapter.session.feedToken || null,
        expiresAt: adapter.session.tokenExpiresAt,
      });

      await client.query(
        `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
         VALUES ($1, 'BROKER_CONNECTED', $2, $3::jsonb)`,
        [
          req.userId,
          `Angel One trading account (${angelOneClientCode}) connected - starting verification`,
          JSON.stringify({ broker: ANGEL_ONE, clientCode: angelOneClientCode, mode: 'LIVE' }),
        ]
      );

      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    console.log(`[ANGEL_ONE_CONNECT] Starting comprehensive verification for user ${req.userId}`);

    // Step 4: Comprehensive verification (this is the critical part)
    const verification = await verifyBrokerConnection(req.userId, ANGEL_ONE, {
      skipMarketData: false, // Verify all functionality
      timeout: 45000,
      logResults: true,
    });

    console.log(`[ANGEL_ONE_CONNECT] Verification complete for user ${req.userId}: ${verification.status} (${verification.overallScore}%)`);

    // Step 5: Update connection status based on verification
    if (verification.status === 'CONNECTED') {
      return res.json({
        success: true,
        broker: ANGEL_ONE,
        clientCode: angelOneClientCode,
        status: 'CONNECTED',
        mode: 'LIVE',
        verification: {
          status: verification.status,
          score: verification.overallScore,
          checks: Object.keys(verification.checks).length,
          lastVerified: verification.timestamp,
        },
        accountData: verification.accountData,
        message: 'Angel One account connected and fully verified'
      });
    } else if (verification.status === 'PARTIALLY_CONNECTED') {
      return res.status(206).json({
        success: false,
        broker: ANGEL_ONE,
        clientCode: angelOneClientCode,
        status: 'PARTIALLY_CONNECTED',
        mode: 'LIVE',
        verification: {
          status: verification.status,
          score: verification.overallScore,
          checks: verification.checks,
          errors: verification.errors,
          warnings: verification.warnings,
          lastVerified: verification.timestamp,
        },
        error: 'Some Angel One functionality is not available',
        message: 'Connection partially successful - some features may be limited'
      });
    } else {
      // Mark as failed in database
      await pool.query(
        `UPDATE broker_accounts SET status = 'VERIFICATION_FAILED', updated_at = NOW()
         WHERE user_id = $1 AND broker = $2`,
        [req.userId, ANGEL_ONE]
      );

      return res.status(400).json({
        success: false,
        broker: ANGEL_ONE,
        status: 'FAILED',
        verification: {
          status: verification.status,
          score: verification.overallScore,
          checks: verification.checks,
          errors: verification.errors,
          lastVerified: verification.timestamp,
        },
        error: 'Angel One connection verification failed',
        details: verification.errors[0] || 'Required broker functionality is not available'
      });
    }

  } catch (error) {
    console.error(`[ANGEL_ONE_CONNECT] Error for user ${req.userId}:`, error.message);
    
    // Clean up failed connection
    try {
      await pool.query(
        `UPDATE broker_accounts SET status = 'CONNECTION_FAILED', updated_at = NOW()
         WHERE user_id = $1 AND broker = $2`,
        [req.userId, ANGEL_ONE]
      );
    } catch (_) {}
    
    if (error.name === 'BrokerApiError' || error.name === 'BrokerCapabilityError') {
      return res.status(error.statusCode || 400).json({ 
        error: error.message,
        broker: ANGEL_ONE,
        status: 'FAILED'
      });
    }
    return next(error);
  }
});

/**
 * Consent OAuth: Initiates a Dhan consent login session.
 */
router.post('/broker/dhan/oauth/start', requireAuth, requireBrokerFeatures, async (req, res, next) => {
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

    let claimedSession = null;
    try {
      const session = await claimOAuthSession(callbackStates);
      claimedSession = session;
      if (!session) {
        console.warn('[DHAN_OAUTH_CALLBACK]', JSON.stringify({
          broker: DHAN,
          timestamp: new Date().toISOString(),
          status: 'FAILED',
          reason: 'Invalid or expired OAuth state',
        }));
        return res.status(400).json({ error: 'Invalid or expired Dhan OAuth session' });
      }
      console.log('[DHAN_OAUTH_CALLBACK]', JSON.stringify({
        userId: session.user_id,
        broker: DHAN,
        oauthSessionId: session.id,
        timestamp: new Date().toISOString(),
        status: 'CLAIMED',
        sessionExpiry: session.expires_at || null,
        callbackResult: error ? 'PROVIDER_ERROR' : 'TOKEN_RECEIVED',
      }));

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
      await assertBrokerIdentity(adapter, DHAN, tokenResult.dhanClientId);

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
          expiresAt: tokenResult.tokenExpiresAt,
        });

        await client.query(
          `UPDATE broker_oauth_sessions SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
          [session.id]
        );
        await client.query('COMMIT');
        console.log('[DHAN_OAUTH_PERSISTENCE]', JSON.stringify({
          userId: session.user_id,
          broker: DHAN,
          oauthSessionId: session.id,
          timestamp: new Date().toISOString(),
          status: 'CONNECTED_PERSISTED',
          databasePersistence: 'PASS',
          sessionExpiry: tokenResult.tokenExpiresAt || null,
        }));
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const verification = await verifyBrokerConnection(session.user_id, DHAN, {
        skipMarketData: false,
        timeout: 45000,
        logResults: true,
      });
      if (verification.status !== 'CONNECTED') {
        await pool.query(
          `UPDATE broker_accounts SET status = $3, updated_at = NOW()
           WHERE user_id = $1 AND broker = $2`,
          [session.user_id, DHAN, verification.status === 'PARTIALLY_CONNECTED' ? 'PARTIALLY_CONNECTED' : 'VERIFICATION_FAILED'],
        );
        await failOAuthSession(session.id, `VERIFICATION_${verification.status}`);
        console.warn('[DHAN_OAUTH_CALLBACK]', JSON.stringify({
          userId: session.user_id,
          broker: DHAN,
          oauthSessionId: session.id,
          timestamp: new Date().toISOString(),
          status: verification.status,
          callbackResult: 'VERIFICATION_FAILED',
          databasePersistence: 'STATUS_REVERTED',
          failureReason: verification.errors[0] || 'Live broker verification failed',
        }));
        return res.status(503).json({
          error: 'Dhan OAuth succeeded but live verification did not pass',
          status: verification.status,
          blockers: verification.errors,
        });
      }

      res.setHeader('Set-Cookie', `${OAUTH_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=${OAUTH_COOKIE_SAMESITE}${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`);
      console.log('[DHAN_OAUTH_CALLBACK]', JSON.stringify({
        userId: session.user_id,
        broker: DHAN,
        oauthSessionId: session.id,
        timestamp: new Date().toISOString(),
        status: 'CONNECTED',
        callbackResult: 'SUCCESS',
        databasePersistence: 'PASS',
        verification: 'CONNECTED',
      }));
      return res.redirect(303, '/quant?dhan=connected');
    } catch (error) {
      if (claimedSession?.id) {
        await failOAuthSession(claimedSession.id, 'CALLBACK_PROCESSING_FAILED').catch(() => {});
      }
      console.error('[DHAN_OAUTH_CALLBACK]', JSON.stringify({
        userId: claimedSession?.user_id || null,
        broker: DHAN,
        oauthSessionId: claimedSession?.id || null,
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        callbackResult: 'PROCESSING_ERROR',
        failureReason: error.message || 'OAuth callback processing failed',
      }));
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
  (req, res, next) => handleBrokerExecutionWebhook(req, res, next, DHAN)
);

/**
 * Disconnect Dhan Account for authenticated user
 */
router.post('/broker/dhan/disconnect', requireAuth, requireBrokerFeatures, async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const accountRes = await client.query(
        `UPDATE broker_accounts
         SET status = 'NOT_CONNECTED', connection_mode = 'LIVE', updated_at = NOW()
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
        mode: 'LIVE',
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

/**
 * Angel One Callback / Redirect Handler:
 * Handles Angel One SmartAPI OAuth callback
 */
router.get(
  ['/broker/angel-one/callback', '/angel-one/callback'],
  async (req, res, next) => {
    const parsed = callbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid Angel One OAuth callback parameters' });
    }

    const { error } = parsed.data;
    const tokenId = parsed.data.tokenId || parsed.data.tokenid;
    const callbackStates = parsed.data.state ? [parsed.data.state] : readOAuthStates(req, ANGEL_ONE_OAUTH_COOKIE_NAME);

    if (!tokenId && !error) {
      return res.json({ status: 'ok', service: 'angel-one-callback-endpoint', timestamp: new Date().toISOString() });
    }

    try {
      const session = await claimOAuthSession(callbackStates, ANGEL_ONE);
      if (!session) {
        return res.status(400).json({ error: 'Invalid or expired Angel One OAuth session' });
      }

      if (error) {
        await failOAuthSession(session.id, 'PROVIDER_AUTHORIZATION_DENIED');
        return res.status(400).json({ error: 'Angel One authorization was not completed' });
      }

      if (!tokenId) {
        await failOAuthSession(session.id, 'INVALID_TOKEN_ID');
        return res.status(400).json({ error: 'Angel One tokenId is missing' });
      }

      const adapter = new AngelOneAdapter();
      const tokenResult = await adapter.consumeConsent({ tokenId });
      await assertBrokerIdentity(adapter, ANGEL_ONE, tokenResult.clientCode);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO broker_accounts (user_id, broker, client_id, status, connection_mode, connected_at, updated_at)
           VALUES ($1, $2, $3, 'CONNECTED', 'LIVE', NOW(), NOW())
           ON CONFLICT (user_id, broker) DO UPDATE
           SET client_id = COALESCE(EXCLUDED.client_id, broker_accounts.client_id), status = 'CONNECTED', connection_mode = 'LIVE', connected_at = NOW(), updated_at = NOW()`,
          [session.user_id, ANGEL_ONE, tokenResult.clientCode || null]
        );

        await storeBrokerTokens({
          client,
          userId: session.user_id,
          broker: ANGEL_ONE,
          accessToken: tokenResult.jwtToken,
          refreshToken: tokenResult.refreshToken || null,
          feedToken: tokenResult.feedToken || null,
          expiresAt: tokenResult.tokenExpiresAt,
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

      res.setHeader('Set-Cookie', `${ANGEL_ONE_OAUTH_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=${ANGEL_ONE_OAUTH_COOKIE_SAMESITE}${ANGEL_ONE_OAUTH_COOKIE_SECURE ? '; Secure' : ''}`);
      return res.redirect(303, '/quant?angelone=connected');
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * Angel One Postback (Webhook) endpoint:
 * Receives real-time order lifecycle updates pushed by Angel One servers.
 * Production URL: https://kepwe.in/api/angel-one/postback
 */
router.post(
  ['/broker/angel-one/callback', '/angel-one/callback', '/angel-one/postback'],
  (req, res, next) => handleBrokerExecutionWebhook(req, res, next, ANGEL_ONE)
);

/**
 * Disconnect Angel One Account for authenticated user
 */
router.post('/broker/angel-one/disconnect', requireAuth, requireBrokerFeatures, async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const accountRes = await client.query(
        `UPDATE broker_accounts
         SET status = 'NOT_CONNECTED', connection_mode = 'LIVE', updated_at = NOW()
         WHERE user_id = $1 AND broker = 'ANGEL_ONE'
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
         VALUES ($1, 'BROKER_DISCONNECTED', 'Angel One trading account disconnected', '{"broker":"ANGEL_ONE"}'::jsonb)`,
        [req.userId]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        broker: ANGEL_ONE,
        status: 'NOT_CONNECTED',
        mode: 'LIVE',
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

export { DHAN_CALLBACK_URI, ANGEL_ONE_CALLBACK_URI, createOAuthState, hashState };
export default router;