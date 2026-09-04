import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { signAccessToken, REFRESH_TOKEN_EXPIRES_DAYS, REFRESH_TOKEN_EXPIRES_HOURS } from '../middleware/auth.js';

const BCRYPT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenTtlMs(rememberMe) {
  return rememberMe
    ? REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    : REFRESH_TOKEN_EXPIRES_HOURS * 60 * 60 * 1000;
}

export async function createSession(client, userId, rememberMe, userAgent, ip) {
  const plainToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(plainToken);
  const expiresAt = new Date(Date.now() + refreshTokenTtlMs(rememberMe));

  await client.query(
    `INSERT INTO user_sessions (user_id, refresh_token, user_agent, ip_address, expires_at, remember_me)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, tokenHash, userAgent || null, ip || null, expiresAt, rememberMe]
  );

  return plainToken;
}

export function serializeUser(row) {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
    mobile: row.mobile || null,
    role: row.role,
    plan: row.plan,
    emailVerified: row.email_verified,
  };
}

export async function registerUser({ name, email, password, mobile, emailVerified = false }, reqInfo = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMobile = mobile?.replace(/[\s-]/g, '') || null;

  if (!process.env.DATABASE_URL) {
    const devUser = {
      id: 'dev_user_' + Date.now(),
      email: normalizedEmail,
      full_name: name.trim(),
      mobile: normalizedMobile,
      role: 'user',
      plan: 'Free Trial',
      email_verified: true,
      is_active: true,
    };
    const accessToken = signAccessToken(devUser);
    const safeUser = serializeUser(devUser);
    return { user: safeUser, accessToken, refreshToken: 'mock_refresh_token_dev' };
  }

  const existing = await pool.query('SELECT id, email, mobile FROM users WHERE email = $1 OR mobile = $2', [normalizedEmail, normalizedMobile]);
  if (existing.rows.length > 0) {
    const err = new Error(existing.rows[0].email === normalizedEmail ? 'An account with this email already exists' : 'An account with this mobile number already exists');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await hashPassword(password);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let insertUser;
    try {
      insertUser = await client.query(
        `INSERT INTO users (email, password_hash, full_name, mobile, email_verified, plan)
         VALUES ($1, $2, $3, $4, $5, 'Free Trial')
         RETURNING id, email, full_name, mobile, role, plan, email_verified, is_active, created_at`,
        [normalizedEmail, passwordHash, name.trim(), normalizedMobile, Boolean(emailVerified)]
      );
    } catch (insertErr) {
      // Handle the race condition where two requests for the same email are
      // both processed after the initial existence check passes. The unique
      // constraint on users.email is the final authority against duplicates.
      if (insertErr.code === '23505') {
        const err = new Error(insertErr.constraint?.includes('mobile') ? 'An account with this mobile number already exists' : 'An account with this email already exists');
        err.statusCode = 409;
        throw err;
      }
      throw insertErr;
    }

    const newUser = insertUser.rows[0];

    await client.query(
      `INSERT INTO admin_notifications (type, title, message, entity_type, entity_id)
       VALUES ('registration', 'New registration', $1, 'user', $2)`,
      [`${newUser.full_name} created an account`, newUser.id]
    );

    await client.query(
      `INSERT INTO risk_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id]
    );
    await client.query(
      `INSERT INTO alert_configs (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id]
    );
    await client.query(
      `INSERT INTO paper_trade_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id]
    );

    await client.query(
      `INSERT INTO subscriptions (user_id, plan_id, price_at_signup, status)
       SELECT $1, id, 0, 'active' FROM plans WHERE name = 'Free Trial'
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id]
    );

    const plainRefreshToken = await createSession(
      client,
      newUser.id,
      false,
      reqInfo.userAgent,
      reqInfo.ip
    );

    await client.query('COMMIT');

    const accessToken = signAccessToken(newUser);
    const safeUser = serializeUser(newUser);

    return { user: safeUser, accessToken, refreshToken: plainRefreshToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function loginUser({ identifier, password, rememberMe }, reqInfo = {}) {
  const normalizedIdentifier = identifier.trim();
  const normalizedEmail = normalizedIdentifier.toLowerCase();

  if (!process.env.DATABASE_URL) {
    const devUser = {
      id: 'dev_user_navi',
      email: normalizedEmail || 'navi@kepwe.com',
      full_name: 'Navin Chakraborty',
      role: 'user',
      plan: 'Pro Member',
      email_verified: true,
      is_active: true,
    };
    const accessToken = signAccessToken(devUser);
    const safeUser = serializeUser(devUser);
    return { user: safeUser, accessToken, refreshToken: 'mock_refresh_token_dev' };
  }

  const result = await pool.query(
    `SELECT id, email, password_hash, full_name, mobile, role, plan, email_verified, is_active
     FROM users WHERE email = $1 OR mobile = $2`,
    [normalizedEmail, normalizedIdentifier.replace(/[\s-]/g, '')]
  );

  if (result.rows.length === 0) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const user = result.rows[0];

  if (!user.is_active) {
    const err = new Error('This account has been deactivated');
    err.statusCode = 403;
    throw err;
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const plainRefreshToken = await createSession(
      client,
      user.id,
      !!rememberMe,
      reqInfo.userAgent,
      reqInfo.ip
    );

    await client.query('COMMIT');

    const accessToken = signAccessToken(user);
    const safeUser = serializeUser(user);

    return { user: safeUser, accessToken, refreshToken: plainRefreshToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function registerVerifiedEmailUser({ name, email, mobile }, reqInfo = {}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMobile = mobile?.replace(/[\s-]/g, '') || null;
  const password = crypto.randomBytes(32).toString('hex');
  return registerUser({ name, email: normalizedEmail, password, mobile: normalizedMobile, emailVerified: true }, reqInfo);
}

export async function loginWithVerifiedEmail(email, rememberMe = false, reqInfo = {}) {
  const result = await pool.query(
    `SELECT id, email, password_hash, full_name, mobile, role, plan, email_verified, is_active
     FROM users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  if (result.rows.length === 0) {
    const error = new Error('No KEPWE account exists for this email address.');
    error.statusCode = 404;
    throw error;
  }
  const user = result.rows[0];
  if (!user.is_active) {
    const error = new Error('This account has been deactivated');
    error.statusCode = 403;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const plainRefreshToken = await createSession(client, user.id, !!rememberMe, reqInfo.userAgent, reqInfo.ip);
    await client.query('UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1', [user.id]);
    await client.query('COMMIT');
    const accessToken = signAccessToken({ ...user, email_verified: true });
    return { user: serializeUser({ ...user, email_verified: true }), accessToken, refreshToken: plainRefreshToken };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}