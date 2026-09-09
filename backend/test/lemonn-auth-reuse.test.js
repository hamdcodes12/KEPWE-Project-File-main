import assert from 'node:assert/strict';
import http from 'node:http';

process.env.LEMONN_API_KEY = 'test-lemonn-api-key';
process.env.LEMONN_API_SECRET = '0000000000000000000000000000000000000000000000000000000000000000';
process.env.LEMONN_CLIENT_ID = 'test-lemonn-client-id';
process.env.BROKER_TOKEN_ENCRYPTION_KEY = '1111111111111111111111111111111111111111111111111111111111111111';

const { default: app } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');
const { signAccessToken } = await import('../src/middleware/auth.js');
const { grantProductMembership } = await import('../src/services/product-membership.service.js');
const { storeBrokerTokens } = await import('../src/services/broker-token.service.js');

function request(server, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({ host: '127.0.0.1', port: address.port, path, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function seedConnectedLemonnAccount(userId, accessToken) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await storeBrokerTokens({ client, userId, broker: 'LEMONN', accessToken });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const accessToken = 'encrypted-session-token-test';
  let userId;
  const calls = [];
  const originalFetch = global.fetch;
  try {
    const user = await pool.query(
      `INSERT INTO users (email, full_name, mobile, password_hash, role, plan, is_active)
       VALUES ($1, 'LemonN Reuse Test', '+910000000001', 'test-hash', 'customer', 'Pro', TRUE)
       RETURNING id`,
      [`lemonn-reuse-${Date.now()}@kepwe.test`],
    );
    userId = user.rows[0].id;
    await grantProductMembership(userId, 'quant');
    await seedConnectedLemonnAccount(userId, accessToken);
    const authHeader = { Authorization: `Bearer ${signAccessToken({ id: userId, role: 'customer', plan: 'Pro' }, 'quant')}` };

    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      assert.ok(String(url).endsWith('/funds'), 'session validation must use the read-only funds endpoint');
      assert.equal(options.method, 'GET');
      return { ok: true, status: 200, json: async () => ({ data: { funds: { netAvailableFunds: '100000' } } }) };
    };

    const first = await request(server, '/api/broker/status', authHeader);
    const second = await request(server, '/api/broker/status', authHeader);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(JSON.parse(first.body).brokers[0].status, 'CONNECTED');
    assert.equal(JSON.parse(second.body).brokers[0].status, 'CONNECTED');
    assert.equal(calls.length, 2, 'reload should validate and reuse the stored session without OAuth');
    assert.doesNotMatch(first.body, /encrypted-session-token-test|test-lemonn-api-key|0000000000/);
    assert.ok(calls.every(({ url }) => !url.endsWith('/orders')));

    const stored = await pool.query(
      `SELECT t.access_token_ciphertext
       FROM broker_oauth_tokens t
       WHERE t.user_id = $1`,
      [userId],
    );
    assert.notEqual(stored.rows[0].access_token_ciphertext, accessToken);

    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      assert.ok(String(url).endsWith('/funds'));
      return { ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) };
    };
    const expired = await request(server, '/api/broker/status', authHeader);
    assert.equal(expired.statusCode, 200);
    assert.equal(JSON.parse(expired.body).brokers[0].status, 'SESSION_EXPIRED');
    assert.match(expired.body, /SESSION_EXPIRED/);
    assert.doesNotMatch(expired.body, /encrypted-session-token-test|test-lemonn-api-key|0000000000/);
    assert.ok(calls.every(({ url }) => !url.endsWith('/orders')));
  } finally {
    global.fetch = originalFetch;
    if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await new Promise((resolve) => server.close(resolve));
  }
}

run()
  .then(() => {
    console.log('LemonN auth reuse tests passed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
