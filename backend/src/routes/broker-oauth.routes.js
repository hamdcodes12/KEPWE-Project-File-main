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
const OAUTH_COOKIE_SECURE = /^https:/i.test(LEMONN_CALLBACK_URI) && process.env.NODE_ENV === 'production';
const OAUTH_COOKIE_ATTRIBUTES = `Max-Age=${OAUTH_STATE_TTL_MINUTES * 60}; Path=/; HttpOnly; SameSite=Lax${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`;

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

async function failOAuthSession(sessionId, failureCode) {
  await pool.query(
    `UPDATE broker_oauth_sessions
     SET status = 'FAILED', failure_code = $2, updated_at = NOW()
     WHERE id = $1 AND status = 'PROCESSING'`,
    [sessionId, failureCode],
  );
}

async function claimOAuthState(state) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, user_id, broker, redirect_uri
       FROM broker_oauth_sessions
       WHERE broker = $1
         AND state_hash = $2
         AND status = 'PENDING'
         AND expires_at > NOW()
       FOR UPDATE`,
      [LEMONN, hashState(state)],
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
    res.setHeader('Set-Cookie', `lemonn_oauth_state=${encodeURIComponent(state)}; ${OAUTH_COOKIE_ATTRIBUTES}`);
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
  if (clientId && configuredClientId && clientId !== configuredClientId) {
    return res.status(400).json({ error: 'Lemonn client ID does not match the configured application' });
  }
  const state = parsed.data.state || readCookie(req, 'lemonn_oauth_state');
  const requestToken = parsed.data.request_token || parsed.data.requestToken;
  if (!state) return res.status(400).json({ error: 'OAuth state is required' });

  try {
    const session = await claimOAuthState(state);
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired OAuth state' });
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
    res.setHeader('Set-Cookie', `lemonn_oauth_state=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${OAUTH_COOKIE_SECURE ? '; Secure' : ''}`);
    return res.redirect(303, '/quant?lemonn=connected');
  } catch (error) {
    return next(error);
  }
});

export { LEMONN_CALLBACK_URI, createOAuthState, hashState };
export default router;