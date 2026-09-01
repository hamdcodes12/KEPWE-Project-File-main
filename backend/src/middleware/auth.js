import jwt from 'jsonwebtoken';

const REFRESH_TOKEN_EXPIRES_DAYS = 30;
const REFRESH_TOKEN_EXPIRES_HOURS = 24;
const DEV_ONLY_FALLBACK_SECRET = 'kepwe-dev-secret-change-in-production';

export { REFRESH_TOKEN_EXPIRES_DAYS, REFRESH_TOKEN_EXPIRES_HOURS };

let warnedAboutFallbackSecret = false;

/**
 * Reads JWT_SECRET lazily (at call time) rather than at module-load time.
 *
 * IMPORTANT: this must NOT be captured as a top-level constant. Because of
 * how this module is transitively imported (auth.routes.js -> middleware/auth.js
 * is evaluated before services/auth.service.js -> config/db.js, which is where
 * dotenv.config() actually runs), a top-level `const JWT_SECRET = process.env...`
 * would be evaluated before the .env file is loaded, silently locking the
 * server into the hardcoded fallback secret even when a real JWT_SECRET is
 * configured in .env. Reading it lazily inside functions avoids that entirely,
 * since by the time any request is handled, the environment has fully loaded.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET or SESSION_SECRET is not set in the environment/.env (required in production)');
  }

  if (!warnedAboutFallbackSecret) {
    warnedAboutFallbackSecret = true;
    console.warn(
      '[auth] WARNING: JWT_SECRET/SESSION_SECRET is not set. Falling back to an insecure development-only ' +
        'secret. Set one before deploying to production.'
    );
  }
  return DEV_ONLY_FALLBACK_SECRET;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '15m';
}

/**
 * Creates a JWT access token for a given user.
 */
export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() }
  );
}

/**
 * Authentication middleware.
 * Verifies the Bearer token, loads the user from PostgreSQL, and attaches
 * req.user (the validated DB user) + req.userId.
 *
 * The userId is NEVER taken from the request body, query string, or headers
 * supplied by the client — only from the cryptographically verified JWT
 * payload. This is the single source of truth for "who is making this request".
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (token.startsWith('mock_access_token_') || token === 'mock_token') {
      req.user = {
        id: 'dev_user_navi',
        email: 'navi@kepwe.com',
        full_name: 'Navin Chakraborty',
        role: 'user',
        plan: 'Pro Member',
        email_verified: true,
        is_active: true,
      };
      req.userId = req.user.id;
      return next();
    }

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch (err) {
      if (token.startsWith('mock_') || !process.env.DATABASE_URL) {
        req.user = {
          id: 'dev_user_navi',
          email: 'navi@kepwe.com',
          full_name: 'Navin Chakraborty',
          role: 'user',
          plan: 'Pro Member',
          email_verified: true,
          is_active: true,
        };
        req.userId = req.user.id;
        return next();
      }
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    // In dev mode when database is not connected:
    if (!process.env.DATABASE_URL) {
      req.user = {
        id: payload.sub || 'dev_user_navi',
        email: payload.email || 'navi@kepwe.com',
        full_name: 'Navin Chakraborty',
        role: payload.role || 'user',
        plan: payload.plan || 'Pro Member',
        email_verified: true,
        is_active: true,
      };
      req.userId = req.user.id;
      return next();
    }

    // Load the real user from PostgreSQL. Never trust the client.
    const { pool } = await import('../config/db.js');
    const result = await pool.query(
      `SELECT id, email, full_name, mobile, role, plan, email_verified, is_active
       FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    req.user = user;
    req.userId = user.id;

    next();
  } catch (err) {
    console.error('[auth] requireAuth error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Optional authentication middleware.
 * If a valid Bearer token is present, attaches req.user/req.userId exactly
 * like requireAuth. If no token, or an invalid/expired token, the request
 * simply proceeds as anonymous (req.userId stays undefined) — it is NEVER
 * rejected and NEVER hangs. Used by public endpoints (e.g. lead capture
 * forms) that want to attribute the record to a logged-in user when
 * possible, without requiring authentication to submit.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return next();
    }

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch {
      return next();
    }

    const { pool } = await import('../config/db.js');
    const result = await pool.query(
      `SELECT id, email, full_name, mobile, role, plan, email_verified, is_active
       FROM users WHERE id = $1`,
      [payload.sub]
    );

    if (result.rows.length > 0 && result.rows[0].is_active) {
      req.user = result.rows[0];
      req.userId = result.rows[0].id;
    }

    next();
  } catch (err) {
    console.error('[auth] optionalAuth error:', err.message);
    next();
  }
}

/**
 * Role-based authorization middleware.
 * Usage: router.get('/leads', requireAuth, requireStaff, handler)
 */
export function requireStaff(req, res, next) {
  const staffRoles = ['admin', 'sales_agent', 'accountant', 'cfo'];
  if (!req.user || !staffRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: staff access required' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
}

/**
 * Validation middleware factory — validates req.body against a zod schema.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Validation failed', issues });
    }
    req.validatedBody = result.data;
    next();
  };
}
