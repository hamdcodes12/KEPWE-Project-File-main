import crypto from 'crypto';
import { pool } from '../config/db.js';

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 5;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashOtp(challengeId, otp) {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'kepwe-email-otp-development-secret';
  return crypto.createHmac('sha256', secret).update(`${challengeId}:${otp}`).digest('hex');
}

function createOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function fromAddress() {
  return process.env.OTP_FROM_EMAIL || 'KEPWE <help@kepwe.in>';
}

async function sendViaResend({ email, otp }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('Email OTP is not configured. RESEND_API_KEY is required.');
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [email],
      subject: 'Your KEPWE verification code',
      text: `Your KEPWE verification code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your KEPWE verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    let detail = 'Resend rejected the email request.';
    try {
      const data = await response.json();
      detail = data?.message || data?.error || detail;
    } catch {
      // Keep the safe generic error.
    }
    const error = new Error(detail);
    error.statusCode = response.status >= 500 ? 502 : 400;
    throw error;
  }
}

export async function requestEmailOtp({ email, purpose, payload = {} }) {
  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error('Enter a valid email address.');
    error.statusCode = 400;
    throw error;
  }
  if (!['login', 'signup'].includes(purpose)) {
    const error = new Error('Invalid email OTP purpose.');
    error.statusCode = 400;
    throw error;
  }

  const latest = await pool.query(
    `SELECT resend_available_at
     FROM email_otp_challenges
     WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedEmail, purpose],
  );
  const previousResendAvailableAt = latest.rows[0]?.resend_available_at;
  if (previousResendAvailableAt && new Date(previousResendAvailableAt).getTime() > Date.now()) {
    const retryAfterSeconds = Math.ceil((new Date(previousResendAvailableAt).getTime() - Date.now()) / 1000);
    const error = new Error(`Please wait ${retryAfterSeconds} seconds before requesting another code.`);
    error.statusCode = 429;
    error.retryAfterSeconds = retryAfterSeconds;
    throw error;
  }

  const recent = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM email_otp_challenges
     WHERE email = $1 AND purpose = $2 AND created_at > NOW() - INTERVAL '1 hour'`,
    [normalizedEmail, purpose],
  );
  if (recent.rows[0].count >= MAX_REQUESTS_PER_HOUR) {
    const error = new Error('Too many verification emails. Please try again later.');
    error.statusCode = 429;
    throw error;
  }

  const challengeId = crypto.randomUUID();
  const otp = createOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const nextResendAvailableAt = new Date(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);

  await sendViaResend({ email: normalizedEmail, otp });
  await pool.query(
    `INSERT INTO email_otp_challenges
       (id, email, purpose, otp_hash, payload, max_attempts, expires_at, resend_available_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
    [challengeId, normalizedEmail, purpose, hashOtp(challengeId, otp), JSON.stringify(payload), MAX_ATTEMPTS, expiresAt, nextResendAvailableAt],
  );
  await pool.query(
    `UPDATE email_otp_challenges
     SET consumed_at = NOW()
     WHERE email = $1 AND purpose = $2 AND id <> $3 AND consumed_at IS NULL`,
    [normalizedEmail, purpose, challengeId],
  );

  return {
    challengeId,
    expiresInSeconds: OTP_TTL_MINUTES * 60,
    resendAvailableInSeconds: RESEND_COOLDOWN_SECONDS,
  };
}

export async function consumeEmailOtp({ challengeId, email, purpose, otp }) {
  const normalizedEmail = normalizeEmail(email);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT * FROM email_otp_challenges
       WHERE id = $1 AND email = $2 AND purpose = $3
         AND consumed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [challengeId, normalizedEmail, purpose],
    );
    const challenge = result.rows[0];
    if (!challenge) {
      await client.query('ROLLBACK');
      const error = new Error('This verification code is invalid or expired.');
      error.statusCode = 400;
      throw error;
    }
    if (challenge.attempts >= challenge.max_attempts) {
      await client.query('UPDATE email_otp_challenges SET consumed_at = NOW() WHERE id = $1', [challengeId]);
      await client.query('COMMIT');
      const error = new Error('Too many incorrect codes. Please request a new code.');
      error.statusCode = 400;
      throw error;
    }

    const submittedHash = hashOtp(challengeId, otp);
    const valid = /^[0-9]{6}$/.test(String(otp || ''))
      && crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(challenge.otp_hash));
    if (!valid) {
      await client.query('UPDATE email_otp_challenges SET attempts = attempts + 1 WHERE id = $1', [challengeId]);
      await client.query('COMMIT');
      const remaining = Math.max(0, challenge.max_attempts - challenge.attempts - 1);
      const error = new Error(remaining ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Too many incorrect codes. Please request a new code.');
      error.statusCode = 400;
      throw error;
    }

    await client.query('UPDATE email_otp_challenges SET consumed_at = NOW() WHERE id = $1', [challengeId]);
    await client.query('COMMIT');
    return { ...challenge, payload: challenge.payload || {} };
  } catch (error) {
    if (error.statusCode) throw error;
    try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    throw error;
  } finally {
    client.release();
  }
}
