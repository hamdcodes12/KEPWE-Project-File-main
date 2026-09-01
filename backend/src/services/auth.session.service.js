import { pool } from '../config/db.js';
import { signAccessToken } from '../middleware/auth.js';
import { hashRefreshToken, createSession, serializeUser } from './auth.service.js';

export async function refreshSession(refreshToken, reqInfo = {}) {
  const tokenHash = hashRefreshToken(refreshToken);

  const result = await pool.query(
    `SELECT us.id AS session_id, us.user_id, us.expires_at, us.revoked_at, us.remember_me,
            u.id, u.email, u.full_name, u.mobile, u.role, u.plan, u.email_verified, u.is_active
     FROM user_sessions us
     JOIN users u ON u.id = us.user_id
     WHERE us.refresh_token = $1`,
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
    const err = new Error('Account is deactivated');
    err.statusCode = 403;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1', [
      row.session_id,
    ]);

    const plainNewRefreshToken = await createSession(
      client,
      row.user_id,
      row.remember_me,
      reqInfo.userAgent,
      reqInfo.ip
    );

    await client.query('COMMIT');

    const user = {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      mobile: row.mobile,
      role: row.role,
      plan: row.plan,
      email_verified: row.email_verified,
      is_active: row.is_active,
    };

    const accessToken = signAccessToken(user);
    const safeUser = serializeUser(user);

    return { user: safeUser, accessToken, refreshToken: plainNewRefreshToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashRefreshToken(refreshToken);
  await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE refresh_token = $1', [
    tokenHash,
  ]);
}

export async function getAuthUserProfile(userId) {
  if (!process.env.DATABASE_URL) {
    return {
      id: userId || 'dev_user_navi',
      name: 'Navin Chakraborty',
      email: 'navi@kepwe.com',
      mobile: '9876543210',
      role: 'user',
      plan: 'Pro Member',
      emailVerified: true,
      subscription: {
        id: 'sub_pro_dev',
        plan: 'Pro Member',
        displayName: 'Pro Plan',
        price: 4999,
        renewsOn: '2027-01-01',
        paymentMethod: 'UPI',
        status: 'active',
      },
    };
  }

  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.mobile, u.role, u.plan, u.email_verified, u.is_active,
            s.id AS subscription_id, s.status AS subscription_status, s.renews_on,
            p.name AS plan_name, p.display_name, p.price_inr, s.payment_method
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const row = result.rows[0];
  const user = serializeUser(row);

  user.subscription = row.subscription_id
    ? {
        id: row.subscription_id,
        plan: row.plan_name,
        displayName: row.display_name,
        price: Number(row.price_inr),
        renewsOn: row.renews_on,
        paymentMethod: row.payment_method,
        status: row.subscription_status,
      }
    : null;

  return user;
}