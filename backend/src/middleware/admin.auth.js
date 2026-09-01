import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const DEV_ONLY_FALLBACK_SECRET = 'kepwe-dev-secret-change-in-production';

let warnedAboutFallbackSecret = false;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET or SESSION_SECRET is not set in the environment/.env (required in production)');
  }

  if (!warnedAboutFallbackSecret) {
    warnedAboutFallbackSecret = true;
    console.warn(
      '[admin-auth] WARNING: JWT_SECRET/SESSION_SECRET is not set. Falling back to an insecure development-only ' +
        'secret. Set one before deploying to production.'
    );
  }
  return DEV_ONLY_FALLBACK_SECRET;
}

/**
 * Admin authentication middleware.
 * Verifies the Bearer token, ensures it is an admin token (kind === 'admin'),
 * loads the admin from PostgreSQL, and attaches req.admin + req.adminId.
 *
 * This is fully separate from the customer `requireAuth` middleware — a
 * customer JWT can never pass here because the token payload must have
 * kind === 'admin' and the admin must exist in admin_users.
 */
export async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Admin token expired' });
      }
      return res.status(401).json({ error: 'Invalid admin token' });
    }

    // Must be an admin token (never a customer token)
    if (payload.kind !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin access required' });
    }

    if (!process.env.DATABASE_URL) {
      req.admin = {
        id: payload.sub || 'admin_root_dev',
        username: payload.username || 'admin',
        display_name: 'KEPWE Super Admin',
        role: payload.role || 'super_admin',
        is_active: true,
      };
      req.adminId = req.admin.id;
      return next();
    }

    const result = await pool.query(
      `SELECT id, username, display_name, role, is_active
       FROM admin_users WHERE id = $1`,
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Admin no longer exists' });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      return res.status(401).json({ error: 'Admin account is deactivated' });
    }

    req.admin = admin;
    req.adminId = admin.id;

    next();
  } catch (err) {
    console.error('[admin-auth] requireAdminAuth error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Super-admin only middleware. Use after requireAdminAuth.
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden: super admin access required' });
  }
  next();
}