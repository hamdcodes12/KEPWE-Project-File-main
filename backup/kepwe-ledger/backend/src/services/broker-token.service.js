import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { pool } from '../config/db.js';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_ENV = 'BROKER_TOKEN_ENCRYPTION_KEY';

function encryptionKey() {
  const configured = String(process.env[ENCRYPTION_KEY_ENV] || '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(configured)) {
    const error = new Error(`${ENCRYPTION_KEY_ENV} must be a 32-byte hexadecimal key`);
    error.statusCode = 503;
    error.code = 'BROKER_TOKEN_ENCRYPTION_NOT_CONFIGURED';
    throw error;
  }
  return Buffer.from(configured, 'hex');
}
export function encryptBrokerSecret(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('A non-empty broker secret is required');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptBrokerSecret(serialized) {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = String(serialized || '').split('.');
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Encrypted broker secret has an invalid format');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivEncoded, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Persists already-normalized OAuth tokens. Provider response parsing and
 * authorization-code exchange belong in the provider adapter, never here.
 */
export async function storeBrokerTokens({
  client,
  userId,
  broker,
  accessToken,
  refreshToken = null,
  feedToken = null,
  apiKey = null,
  tokenType = null,
  scopes = [],
  expiresAt = null,
}) {
  if (!client) throw new TypeError('A database client is required');
  if (!userId || !broker) throw new TypeError('User and broker are required');
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new TypeError('A normalized access token is required');
  }
  if (!Array.isArray(scopes) || scopes.some((scope) => typeof scope !== 'string')) {
    throw new TypeError('Normalized scopes must be an array of strings');
  }

  const account = await client.query(
    `INSERT INTO broker_accounts (user_id, broker, status, connection_mode, connected_at, updated_at)
     VALUES ($1, $2, 'CONNECTED', 'LIVE', NOW(), NOW())
     ON CONFLICT (user_id, broker) DO UPDATE
     SET status = 'CONNECTED', connection_mode = 'LIVE', connected_at = NOW(), updated_at = NOW()
     RETURNING id`,
    [userId, broker],
  );
  const brokerAccountId = account.rows[0]?.id;
  if (!brokerAccountId) throw new Error('Broker account could not be created');

  await client.query(
    `INSERT INTO broker_oauth_tokens
       (broker_account_id, user_id, access_token_ciphertext, refresh_token_ciphertext,
        feed_token_ciphertext, api_key_ciphertext, token_type, scopes, token_expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, NOW())
     ON CONFLICT (broker_account_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       access_token_ciphertext = EXCLUDED.access_token_ciphertext,
       refresh_token_ciphertext = EXCLUDED.refresh_token_ciphertext,
       feed_token_ciphertext = EXCLUDED.feed_token_ciphertext,
       api_key_ciphertext = EXCLUDED.api_key_ciphertext,
       token_type = EXCLUDED.token_type,
       scopes = EXCLUDED.scopes,
       token_expires_at = EXCLUDED.token_expires_at,
       updated_at = NOW()`,
    [
      brokerAccountId,
      userId,
      encryptBrokerSecret(accessToken),
      refreshToken ? encryptBrokerSecret(refreshToken) : null,
      feedToken ? encryptBrokerSecret(feedToken) : null,
      apiKey ? encryptBrokerSecret(apiKey) : null,
      tokenType,
      scopes,
      expiresAt,
    ],
  );

  return { brokerAccountId };
}

/**
 * Get user's broker credentials securely
 * Only returns decrypted credentials for the authenticated user
 */
export async function getBrokerCredentials(userId, broker) {
  if (!userId || !broker) throw new TypeError('User and broker are required');

  const result = await pool.query(
    `SELECT a.id, a.client_id, a.status, a.connection_mode, a.is_active_broker,
            t.access_token_ciphertext, t.refresh_token_ciphertext, t.feed_token_ciphertext,
            t.api_key_ciphertext, t.token_expires_at
     FROM broker_accounts a
     LEFT JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
     WHERE a.user_id = $1 AND a.broker = $2`,
    [userId, broker]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  if (!row.access_token_ciphertext) {
    return null;
  }

  try {
    return {
      brokerAccountId: row.id,
      clientId: row.client_id,
      status: row.status,
      connectionMode: row.connection_mode,
      isActiveBroker: row.is_active_broker,
      accessToken: decryptBrokerSecret(row.access_token_ciphertext),
      refreshToken: row.refresh_token_ciphertext ? decryptBrokerSecret(row.refresh_token_ciphertext) : null,
      feedToken: row.feed_token_ciphertext ? decryptBrokerSecret(row.feed_token_ciphertext) : null,
      apiKey: row.api_key_ciphertext ? decryptBrokerSecret(row.api_key_ciphertext) : null,
      tokenExpiresAt: row.token_expires_at,
    };
  } catch (error) {
    throw new Error(`Failed to decrypt broker credentials: ${error.message}`);
  }
}
/**
 * Set active broker for user (only one broker can be active at a time)
 */
export async function setActiveBroker(userId, broker) {
  if (!userId || !broker) throw new TypeError('User and broker are required');

  const result = await pool.query(
    `UPDATE broker_accounts
     SET is_active_broker = TRUE, updated_at = NOW()
     WHERE user_id = $1 AND broker = $2 AND status = 'CONNECTED'
     RETURNING id, broker, is_active_broker`,
    [userId, broker]
  );

  if (result.rows.length === 0) {
    throw new Error(`${broker} is not connected for this user`);
  }

  return result.rows[0];
}

/**
 * Get active broker for user
 */
export async function getActiveBroker(userId) {
  if (!userId) throw new TypeError('User ID is required');

  const result = await pool.query(
    `SELECT broker, client_id, status, last_verified_at, verification_score
     FROM broker_accounts
     WHERE user_id = $1 AND is_active_broker = TRUE AND status = 'CONNECTED'
     LIMIT 1`,
    [userId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Revoke broker credentials (disconnect)
 */
export async function revokeBrokerCredentials(userId, broker) {
  if (!userId || !broker) throw new TypeError('User and broker are required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update broker account status
    await client.query(
      `UPDATE broker_accounts
       SET status = 'NOT_CONNECTED', 
           is_active_broker = FALSE, 
           connection_mode = 'LIVE',
           updated_at = NOW()
       WHERE user_id = $1 AND broker = $2`,
      [userId, broker]
    );

    // Delete encrypted tokens
    await client.query(
      `DELETE FROM broker_oauth_tokens
       WHERE user_id = $1 AND broker_account_id IN (
         SELECT id FROM broker_accounts WHERE user_id = $1 AND broker = $2
       )`,
      [userId, broker]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
