// Single place that turns a stored Angel One connection into a ready adapter.
//
// Every route, worker and health check obtains its adapter here so that:
//  - tokens are decrypted in one place,
//  - tokens rotated by SmartAPI (generateTokens) are persisted immediately,
//  - a session Angel One no longer accepts is recorded as SESSION_EXPIRED.

import { ANGEL_ONE, getBrokerAdapter, isAngelOneSessionError } from '../algo/broker-adapters.js';
import { decryptBrokerSecret, encryptBrokerSecret } from './broker-token.service.js';

export { ANGEL_ONE, isAngelOneSessionError };

export const USABLE_STATUSES = ['CONNECTED', 'PARTIALLY_CONNECTED'];

const ACCOUNT_SQL = `
  SELECT ba.id, ba.user_id, ba.broker, ba.client_id, ba.status, ba.connection_mode, ba.connected_at,
         bot.access_token_ciphertext, bot.refresh_token_ciphertext, bot.feed_token_ciphertext,
         bot.api_key_ciphertext, bot.token_expires_at
  FROM broker_accounts ba
  LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id`;

/** The user's Angel One connection row (with encrypted tokens), or null. */
export async function loadAngelOneAccount(db, userId) {
  const result = await db.query(`${ACCOUNT_SQL}\n  WHERE ba.user_id = $1 AND ba.broker = 'ANGEL_ONE'\n  LIMIT 1`, [userId]);
  return result.rows[0] || null;
}

/** All Angel One connections that are usable for live trading. */
export async function loadUsableAngelOneAccounts(db) {
  const result = await db.query(
    `${ACCOUNT_SQL}\n  WHERE ba.broker = 'ANGEL_ONE' AND ba.status IN ('CONNECTED', 'PARTIALLY_CONNECTED')\n    AND ba.connection_mode = 'LIVE' AND bot.access_token_ciphertext IS NOT NULL`,
  );
  return result.rows;
}

export function isUsableAngelOneAccount(row) {
  return Boolean(row && USABLE_STATUSES.includes(row.status) && row.connection_mode === 'LIVE' && row.access_token_ciphertext);
}

/** Persists tokens rotated by SmartAPI. Never logs or returns them. */
export async function persistAngelOneSession(db, brokerAccountId, session) {
  await db.query(
    `UPDATE broker_oauth_tokens
     SET access_token_ciphertext = $2,
         refresh_token_ciphertext = COALESCE($3, refresh_token_ciphertext),
         feed_token_ciphertext = COALESCE($4, feed_token_ciphertext),
         token_expires_at = $5,
         updated_at = NOW()
     WHERE broker_account_id = $1`,
    [
      brokerAccountId,
      encryptBrokerSecret(session.jwtToken),
      session.refreshToken ? encryptBrokerSecret(session.refreshToken) : null,
      session.feedToken ? encryptBrokerSecret(session.feedToken) : null,
      session.tokenExpiresAt || null,
    ],
  );
}

/** Records that Angel One rejected the stored session. */
export async function markAngelOneSessionExpired(db, brokerAccountId) {
  try {
    await db.query(
      `UPDATE broker_accounts SET status = 'SESSION_EXPIRED', updated_at = NOW()
       WHERE id = $1 AND status IN ('CONNECTED', 'PARTIALLY_CONNECTED')`,
      [brokerAccountId],
    );
  } catch (_) { /* the next status check re-evaluates the session */ }
}

/**
 * Optional operator credentials (ANGEL_ONE_CLIENT_CODE + ANGEL_ONE_MPIN +
 * ANGEL_ONE_TOTP_SECRET). When set, the account with that client code is
 * logged in again automatically after Angel One's daily session expiry. Users'
 * own MPIN/TOTP are never stored, so other accounts reconnect manually.
 */
function serverAutoLogin(clientCode) {
  const configuredCode = String(process.env.ANGEL_ONE_CLIENT_CODE || '').trim().toUpperCase();
  const mpin = String(process.env.ANGEL_ONE_MPIN || '').trim();
  const totp = String(process.env.ANGEL_ONE_TOTP_SECRET || '').trim();
  if (!configuredCode || !mpin || !totp) return null;
  if (configuredCode !== String(clientCode || '').trim().toUpperCase()) return null;
  return { mpin, totp };
}

/** Builds an adapter from a connection row. Throws if the row has no stored session. */
export function adapterFromAngelOneAccount(db, row) {
  if (!row?.access_token_ciphertext) {
    const error = new Error('Angel One authentication is required before live execution');
    error.statusCode = 409;
    error.code = 'ANGEL_ONE_NOT_CONNECTED';
    throw error;
  }
  const adapter = getBrokerAdapter(ANGEL_ONE, 'LIVE', {
    clientCode: row.client_id,
    apiKey: row.api_key_ciphertext ? decryptBrokerSecret(row.api_key_ciphertext) : null,
    jwtToken: decryptBrokerSecret(row.access_token_ciphertext),
    refreshToken: row.refresh_token_ciphertext ? decryptBrokerSecret(row.refresh_token_ciphertext) : null,
    feedToken: row.feed_token_ciphertext ? decryptBrokerSecret(row.feed_token_ciphertext) : null,
    tokenExpiresAt: row.token_expires_at,
    onSessionUpdate: (session) => persistAngelOneSession(db, row.id, session),
    autoLogin: (clientCode) => serverAutoLogin(clientCode),
  });
  adapter.brokerAccountId = row.id;
  adapter.expectedClientId = row.client_id;
  return adapter;
}

/**
 * Loads the user's connection and returns { row, adapter }.
 * adapter is null when there is no usable LIVE session; `reason` says why:
 *   NOT_CONNECTED | SESSION_EXPIRED
 */
export async function getAngelOneSession(db, userId) {
  const row = await loadAngelOneAccount(db, userId);
  if (!row) return { row: null, adapter: null, reason: 'NOT_CONNECTED' };
  if (row.status === 'SESSION_EXPIRED') return { row, adapter: null, reason: 'SESSION_EXPIRED' };
  if (!isUsableAngelOneAccount(row)) return { row, adapter: null, reason: 'NOT_CONNECTED' };
  return { row, adapter: adapterFromAngelOneAccount(db, row), reason: null };
}

/** Runs `fn(adapter)`; a session rejection is persisted before it is rethrown. */
export async function withAngelOneSession(db, session, fn) {
  try {
    return await fn(session.adapter);
  } catch (error) {
    if (isAngelOneSessionError(error) && session.row?.id) await markAngelOneSessionExpired(db, session.row.id);
    throw error;
  }
}
