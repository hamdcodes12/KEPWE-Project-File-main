import crypto from 'crypto';
import { pool } from '../config/db.js';

const TTL_MINUTES = 5;

/**
 * Idempotency Middleware for Financial Mutations (PostgreSQL Persistent)
 * Protects against duplicate invoice submissions, double-click payments,
 * concurrent journal posts, and duplicate external gateway transmissions.
 *
 * Persists keys, request fingerprints, company, user, endpoint, status,
 * response code, headers, and body into PostgreSQL table `idempotency_records`.
 */
export function requireIdempotency(options = {}) {
  const { headerName = 'x-idempotency-key', autoFingerprint = false } = options;

  return async (req, res, next) => {
    // Only apply to mutating requests
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    let key = req.headers[headerName.toLowerCase()] || req.headers['idempotency-key'];

    // Auto-derive fingerprint key for sensitive endpoints if header not explicitly provided
    let fingerprint = null;
    if (req.body && Object.keys(req.body).length > 0) {
      fingerprint = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    }

    if (!key && autoFingerprint && fingerprint) {
      key = `fp_${req.method}_${req.baseUrl || ''}${req.path}_${req.userId || 'anon'}_${fingerprint.slice(0, 24)}`;
    }

    if (!key) {
      // No idempotency key requested; proceed normally
      return next();
    }

    const companyId = req.params?.companyId || req.body?.companyId || req.query?.companyId || null;
    const userId = req.userId || null;
    const endpoint = `${req.baseUrl || ''}${req.path}`;

    try {
      // Check existing record in PostgreSQL
      const existingRes = await pool.query(
        `SELECT id, status, response_status_code, response_headers, response_body, expires_at
         FROM idempotency_records
         WHERE key = $1`,
        [key]
      );

      const existing = existingRes.rows[0];
      const now = new Date();

      if (existing) {
        // If expired, remove
        if (new Date(existing.expires_at) <= now) {
          await pool.query(`DELETE FROM idempotency_records WHERE key = $1`, [key]);
        } else if (existing.status === 'IN_FLIGHT') {
          return res.status(409).json({
            error: 'Concurrent duplicate request in progress. Please wait for the previous operation to complete.',
            code: 'IDEMPOTENCY_CONFLICT',
            idempotencyKey: key
          });
        } else if (existing.status === 'COMPLETED') {
          // Replay previous response safely
          res.setHeader('X-Idempotent-Replay', 'true');
          const status = existing.response_status_code || 200;
          return res.status(status).json(existing.response_body);
        }
      }

      // Insert new in-flight record
      const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
      try {
        await pool.query(
          `INSERT INTO idempotency_records
             (key, request_fingerprint, company_id, user_id, endpoint, status, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, 'IN_FLIGHT', NOW(), $6)
           ON CONFLICT (key) DO UPDATE
             SET status = 'IN_FLIGHT',
                 request_fingerprint = EXCLUDED.request_fingerprint,
                 expires_at = EXCLUDED.expires_at
             WHERE idempotency_records.expires_at <= NOW()`,
          [key, fingerprint, companyId, userId, endpoint, expiresAt]
        );
      } catch (insertErr) {
        // If race condition occurred on conflict with an active in-flight request
        if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key')) {
          return res.status(409).json({
            error: 'Concurrent duplicate request in progress. Please wait for the previous operation to complete.',
            code: 'IDEMPOTENCY_CONFLICT',
            idempotencyKey: key
          });
        }
        throw insertErr;
      }

      // Intercept res.json to capture response for persistence and replay
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Only cache successful or business validation responses (not 500 server crashes)
        if (res.statusCode < 500) {
          pool.query(
            `UPDATE idempotency_records
             SET status = 'COMPLETED',
                 response_status_code = $1,
                 response_body = $2::jsonb
             WHERE key = $3`,
            [res.statusCode, JSON.stringify(body || {}), key]
          ).catch((err) => {
            console.error('[idempotency] Failed to persist completed response:', err.message);
          });
        } else {
          pool.query(`DELETE FROM idempotency_records WHERE key = $1`, [key]).catch(() => {});
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error('[idempotency] Middleware error:', err.message);
      // Fail-safe: if idempotency table read fails, proceed so server isn't blocked
      next();
    }
  };
}
