import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

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
        token_type, scopes, token_expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::text[], $7, NOW())
     ON CONFLICT (broker_account_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       access_token_ciphertext = EXCLUDED.access_token_ciphertext,
       refresh_token_ciphertext = EXCLUDED.refresh_token_ciphertext,
       token_type = EXCLUDED.token_type,
       scopes = EXCLUDED.scopes,
       token_expires_at = EXCLUDED.token_expires_at,
       updated_at = NOW()`,
    [
      brokerAccountId,
      userId,
      encryptBrokerSecret(accessToken),
      refreshToken ? encryptBrokerSecret(refreshToken) : null,
      tokenType,
      scopes,
      expiresAt,
    ],
  );

  return { brokerAccountId };
}