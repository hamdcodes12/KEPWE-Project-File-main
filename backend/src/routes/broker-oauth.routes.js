import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';
import { LemonnAdapter } from '../algo/broker-adapters.js';
import { storeBrokerTokens } from '../services/broker-token.service.js';

const router = Router();

const LEMONN = 'LEMONN';
const LEMONN_CALLBACK_URI = String(process.env.LEMONN_REDIRECT_URL || 'https://kepwe.in/api/broker/lemonn/callback').trim();
const OAUTH_STATE_TTL_MINUTES = 10;
const MAX_AUTH_CODE_LENGTH = 4096;
const OAUTH_COOKIE_NAME = 'lemonn_oauth_state';
const MAX_PENDING_OAUTH_STATES = 8;
const OAUTH_COOKIE_SECURE = /^https:/i.test(LEMONN_CALLBACK_URI) && process.env.NODE_ENV === 'production';
const OAUTH_COOKIE_SAMESITE = OAUTH_COOKIE_SECURE ? 'None' : 'Lax';
const OAUTH_COOKIE_ATTRIBUTES = `Max-Age=${OAUTH_STATE_TTL_MINUTES * 60}; Path=/; HttpOnly; SameSite=${OAUTH_COOKIE_SAMESITE}${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`;

const callbackQuerySchema = z.object({
  client_id: z.string().trim().min(1).max(120).optional(),
  request_token: z.string().trim().min(1).max(MAX_AUTH_CODE_LENGTH).optional(),
  requestToken: z.string().trim().min(1).max(MAX_AUTH_CODE_LENGTH).optional(),
  state: z.string().trim().min(1).max(512).optional(),
  error: z.string().trim().min(1).max(120).optional(),
}).strict();

function hashState(state) {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

function readCookie(req, name) {
  const value = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
}

function readOAuthStates(req) {
  const encoded = readCookie(req, OAUTH_COOKIE_NAME);
  if (!encoded) return [];
  return encoded.split(',').map((state) => state.trim()).filter(Boolean).slice(-MAX_PENDING_OAUTH_STATES);
}

function serializeOAuthStates(states) {
  return states.slice(-MAX_PENDING_OAUTH_STATES).join(',');
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
    const stateHashes = states.map(hashState);
    const result = await client.query(
      `SELECT id, user_id, broker, redirect_uri
       FROM broker_oauth_sessions
       WHERE broker = $1 AND state_hash = ANY($2::text[]) AND status = 'PENDING' AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [LEMONN, stateHashes],
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
    [userId, LEMONN, hashState(state), LEMONN_CALLBACK_URI, OAUTH_STATE_TTL_MINUTES],
  );
  return state;
}

/*
 * This endpoint is intentionally protected: only an authenticated KEPWE user
 * may initiate an OAuth session. The provider callback below is intentionally
 * public because OAuth providers do not send the KEPWE Bearer token back.
 */
router.post('/broker/lemonn/oauth/start', requireAuth, async (req, res, next) => {
  try {
    const state = await createOAuthState(req.userId);
    const states = [...readOAuthStates(req), state];
    res.setHeader('Set-Cookie', `${OAUTH_COOKIE_NAME}=${encodeURIComponent(serializeOAuthStates(states))}; ${OAUTH_COOKIE_ATTRIBUTES}`);
    return res.json({ authorizationUrl: new LemonnAdapter().loginUrl() });
  } catch (error) {
    return next(error);
  }
});

/*
 * Public by design. The route is registered before algo.routes.js applies
 * requireAuth to /broker. It authenticates the browser redirect with the
 * single-use state record, not with a missing frontend Bearer token.
 */
router.get(['/broker/lemonn/callback', '/lemonn/callback'], async (req, res, next) => {
  const parsed = callbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid OAuth callback parameters' });
  }

  const { client_id: clientId, error } = parsed.data;
  const configuredClientId = String(process.env.LEMONN_CLIENT_ID || '').trim();
  if (!configuredClientId || !clientId || clientId !== configuredClientId) {
    return res.status(400).json({ error: 'Lemonn client ID does not match the configured application' });
  }
  const callbackStates = parsed.data.state ? [parsed.data.state] : readOAuthStates(req);
  const requestToken = parsed.data.request_token || parsed.data.requestToken;

  try {
    // LemonN does not return provider state. Correlate only against this
    // browser's DB-backed, single-use transactions; never use global latest.
    const session = await claimOAuthSession(callbackStates);
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired LemonN OAuth session' });
    }

    if (error) {
      await failOAuthSession(session.id, 'PROVIDER_AUTHORIZATION_DENIED');
      return res.status(400).json({ error: 'Lemonn authorization was not completed' });
    }
    if (!requestToken) {
      await failOAuthSession(session.id, 'INVALID_REQUEST_TOKEN');
      return res.status(400).json({ error: 'Lemonn request token is missing' });
    }

    const adapter = new LemonnAdapter();
    await adapter.authenticate({ requestToken });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await storeBrokerTokens({ client, userId: session.user_id, broker: LEMONN, accessToken: adapter.accessToken });
      await client.query(
        `UPDATE broker_oauth_sessions SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
        [session.id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.setHeader('Set-Cookie', `${OAUTH_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=${OAUTH_COOKIE_SAMESITE}${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`);
    return res.redirect(303, '/quant?lemonn=connected');
  } catch (error) {
    return next(error);
  }
});

export { LEMONN_CALLBACK_URI, createOAuthState, hashState };
export default router;