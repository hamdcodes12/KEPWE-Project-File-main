import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';

const router = Router();

const LEMONN = 'LEMONN';
const LEMONN_CALLBACK_URI = 'https://kepwe.in/api/broker/lemonn/callback';
const OAUTH_STATE_TTL_MINUTES = 10;
const MAX_AUTH_CODE_LENGTH = 4096;

const callbackQuerySchema = z.object({
  code: z.string().trim().min(1).max(MAX_AUTH_CODE_LENGTH).optional(),
  state: z.string().trim().min(1).max(512).optional(),
  error: z.string().trim().min(1).max(120).optional(),
  error_description: z.string().trim().max(1000).optional(),
}).strict();

function hashState(state) {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

function officialLemonnOAuthContract() {
  // Deliberately empty until Lemonn supplies an authoritative contract.
  // Do not replace this with guessed URLs, scopes, or parameter names.
  return null;
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
    const contract = officialLemonnOAuthContract();
    if (!contract) {
      return res.status(503).json({
        error: 'Lemonn OAuth is unavailable until the official provider contract is configured.',
      });
    }

    const state = await createOAuthState(req.userId);
    // This branch remains unreachable until an official Lemonn contract is
    // installed. The adapter must construct the URL, scopes, and PKCE values.
    return res.json({
      authorizationUrl: contract.authorizationUrl({ state, redirectUri: LEMONN_CALLBACK_URI }),
    });
  } catch (error) {
    return next(error);
  }
});

/*
 * Public by design. The route is registered before algo.routes.js applies
 * requireAuth to /broker. It authenticates the browser redirect with the
 * single-use state record, not with a missing frontend Bearer token.
 */
router.get('/broker/lemonn/callback', async (req, res, next) => {
  const parsed = callbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid OAuth callback parameters' });
  }

  const { state, code, error, error_description: errorDescription } = parsed.data;
  if (!state) return res.status(400).json({ error: 'OAuth state is required' });

  try {
    const session = await claimOAuthState(state);
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired OAuth state' });
    }

    if (error) {
      await failOAuthSession(session.id, 'PROVIDER_AUTHORIZATION_DENIED');
      return res.status(400).json({
        error: 'Lemonn authorization was not completed',
        ...(errorDescription ? { detail: errorDescription } : {}),
      });
    }

    // This validates the callback input structurally. Only the provider token
    // endpoint can validate the code itself; no provider endpoint is guessed.
    if (!code || code.length > MAX_AUTH_CODE_LENGTH) {
      await failOAuthSession(session.id, 'INVALID_AUTHORIZATION_CODE');
      return res.status(400).json({ error: 'Authorization code is missing or invalid' });
    }

    const contract = officialLemonnOAuthContract();
    if (!contract) {
      await failOAuthSession(session.id, 'OFFICIAL_CONTRACT_UNAVAILABLE');
      return res.status(503).json({
        error: 'Lemonn OAuth is unavailable until the official provider contract is configured.',
      });
    }

    /*
     * Provider-specific exchange deliberately has no implementation yet.
     * Once official documentation is supplied, this server-only branch must:
     * 1. exchange `code` with the documented token endpoint;
     * 2. normalize the response; and
     * 3. call storeBrokerTokens({ client, userId: session.user_id, ... }).
     * No token may be returned from this route.
     */
    return res.status(503).json({
      error: 'Lemonn OAuth exchange is not implemented without the official provider contract.',
    });
  } catch (error) {
    return next(error);
  }
});

export { LEMONN_CALLBACK_URI, createOAuthState, hashState };
export default router;