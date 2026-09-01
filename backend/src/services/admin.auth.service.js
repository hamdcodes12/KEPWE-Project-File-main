import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_EXPIRES_DAYS = 7;
const DEV_ONLY_FALLBACK_SECRET = 'kepwe-dev-secret-change-in-production';

let warnedAboutFallbackSecret = false;

/**
 * Reads JWT_SECRET lazily (at call time) rather than at module-load time,
 * mirroring the user-auth middleware pattern. Falls back to a dev-only
 * secret in non-production environments.
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
      '[admin-auth] WARNING: JWT_SECRET/SESSION_SECRET is not set. Falling back to an insecure development-only ' +
        'secret. Set one before deploying to production.'
    );
  }
  return DEV_ONLY_FALLBACK_SECRET;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '15m';
}

export function signAdminAccessToken(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      kind: 'admin',
    },
    getJwtSecret(),
    { expiresIn: getJwtExpiresIn() }
  );
}

export function generateAdminRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export function hashAdminRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashAdminPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyAdminPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function serializeAdmin(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
  };
}

/**
 * Admin login. Verifies credentials against the admin_users table (fully
 * separate from customer auth), creates a session, and returns tokens.
 */
export async function adminLogin({ username, password }, reqInfo = {}) {
  const normalized = username.trim().toLowerCase();

  if (!process.env.DATABASE_URL) {
    const devAdmin = {
      id: 'admin_root_dev',
      username: normalized || 'admin',
      display_name: 'KEPWE Super Admin',
      role: 'super_admin',
      is_active: true,
      last_login_at: new Date(),
    };
    const accessToken = signAdminAccessToken(devAdmin);
    const safeAdmin = serializeAdmin(devAdmin);
    return { admin: safeAdmin, accessToken, refreshToken: 'mock_admin_refresh_token_dev' };
  }

  const result = await pool.query(
    `SELECT id, username, password_hash, display_name, role, is_active, last_login_at
     FROM admin_users WHERE username = $1`,
    [normalized]
  );

  if (result.rows.length === 0) {
    const err = new Error('Invalid admin credentials');
    err.statusCode = 401;
    throw err;
  }

  const admin = result.rows[0];

  if (!admin.is_active) {
    const err = new Error('This admin account has been deactivated');
    err.statusCode = 403;
    throw err;
  }

  const passwordOk = await verifyAdminPassword(password, admin.password_hash);
  if (!passwordOk) {
    const err = new Error('Invalid admin credentials');
    err.statusCode = 401;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const plainRefreshToken = generateAdminRefreshToken();
    const tokenHash = hashAdminRefreshToken(plainRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO admin_sessions (admin_id, refresh_token, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [admin.id, tokenHash, reqInfo.userAgent || null, reqInfo.ip || null, expiresAt]
    );

    await client.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [admin.id]);

    await client.query('COMMIT');

    const accessToken = signAdminAccessToken(admin);
    const safeAdmin = serializeAdmin({ ...admin, last_login_at: new Date() });

    return { admin: safeAdmin, accessToken, refreshToken: plainRefreshToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin refresh. Rotates the refresh token and returns a new pair.
 */
export async function adminRefresh(refreshToken, reqInfo = {}) {
  if (!process.env.DATABASE_URL) {
    const devAdmin = {
      id: 'admin_root_dev',
      username: 'admin',
      display_name: 'KEPWE Super Admin',
      role: 'super_admin',
      is_active: true,
      last_login_at: new Date(),
    };
    const accessToken = signAdminAccessToken(devAdmin);
    const safeAdmin = serializeAdmin(devAdmin);
    return { admin: safeAdmin, accessToken, refreshToken: 'mock_admin_refresh_token_dev' };
  }

  const tokenHash = hashAdminRefreshToken(refreshToken);

  const result = await pool.query(
    `SELECT asess.id AS session_id, asess.admin_id, asess.expires_at, asess.revoked_at,
            a.id, a.username, a.display_name, a.role, a.is_active, a.last_login_at
     FROM admin_sessions asess
     JOIN admin_users a ON a.id = asess.admin_id
     WHERE asess.refresh_token = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    const err = new Error('Invalid refresh token');
    err.statusCode = 401;
    throw err;
  }

  const row = result.rows[0];

  if (row.revoked_at) {
    const err = new Error('Refresh token has been revoked');
    err.statusCode = 401;
    throw err;
  }

  if (new Date(row.expires_at) < new Date()) {
    const err = new Error('Refresh token has expired');
    err.statusCode = 401;
    throw err;
  }

  if (!row.is_active) {
    const err = new Error('Admin account is deactivated');
    err.statusCode = 403;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('UPDATE admin_sessions SET revoked_at = NOW() WHERE id = $1', [row.session_id]);

    const plainNewRefreshToken = generateAdminRefreshToken();
    const newTokenHash = hashAdminRefreshToken(plainNewRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO admin_sessions (admin_id, refresh_token, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.admin_id, newTokenHash, reqInfo.userAgent || null, reqInfo.ip || null, expiresAt]
    );

    await client.query('COMMIT');

    const accessToken = signAdminAccessToken(row);
    const safeAdmin = serializeAdmin(row);

    return { admin: safeAdmin, accessToken, refreshToken: plainNewRefreshToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin logout. Revokes the refresh token.
 */
export async function adminLogout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashAdminRefreshToken(refreshToken);
  await pool.query('UPDATE admin_sessions SET revoked_at = NOW() WHERE refresh_token = $1', [tokenHash]);
}

/**
 * Admin profile. Returns the current admin's details.
 */
export async function getAdminProfile(adminId) {
  if (!process.env.DATABASE_URL) {
    return {
      id: adminId || 'admin_root_dev',
      username: 'admin',
      displayName: 'KEPWE Super Admin',
      role: 'super_admin',
      isActive: true,
      lastLoginAt: new Date(),
    };
  }

  const result = await pool.query(
    `SELECT id, username, display_name, role, is_active, last_login_at, created_at
     FROM admin_users WHERE id = $1`,
    [adminId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Admin not found');
    err.statusCode = 404;
    throw err;
  }

  return serializeAdmin(result.rows[0]);
}