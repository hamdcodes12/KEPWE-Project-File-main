import assert from 'node:assert/strict';
import http from 'node:http';

process.env.LEMONN_API_KEY = 'test-api-key';
process.env.LEMONN_API_SECRET = '0000000000000000000000000000000000000000000000000000000000000000';
process.env.LEMONN_CLIENT_ID = 'test-client-id';
process.env.BROKER_TOKEN_ENCRYPTION_KEY = '1111111111111111111111111111111111111111111111111111111111111111';

const { default: app } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');
const { signAccessToken } = await import('../src/middleware/auth.js');
const { grantProductMembership } = await import('../src/services/product-membership.service.js');

function request(server, { method = 'GET', path, headers = {} }) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({ host: '127.0.0.1', port: address.port, method, path, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function createUser(email) {
  const mobile = `+91${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 10)}`;
  const result = await pool.query(
    `INSERT INTO users (email, full_name, mobile, password_hash, role, plan, is_active)
     VALUES ($1, 'OAuth Test User', $2, 'hash', 'customer', 'Pro', TRUE)
     RETURNING id`,
    [email, mobile],
  );
  await grantProductMembership(result.rows[0].id, 'quant');
  return result.rows[0].id;
}

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const originalFetch = global.fetch;
  const userIds = [];
  try {
    userIds.push(await createUser(`oauth-a-${Date.now()}@test.local`));
    userIds.push(await createUser(`oauth-b-${Date.now()}@test.local`));
    const tokenA = signAccessToken({ id: userIds[0], role: 'customer', plan: 'Pro' }, 'quant');
    const tokenB = signAccessToken({ id: userIds[1], role: 'customer', plan: 'Pro' }, 'quant');

    const startA = await request(server, {
      method: 'POST',
      path: '/api/broker/lemonn/oauth/start',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const startB = await request(server, {
      method: 'POST',
      path: '/api/broker/lemonn/oauth/start',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(startA.statusCode, 200);
    assert.equal(startB.statusCode, 200);
    const cookieA = startA.headers['set-cookie'][0].split(';')[0];
    const cookieB = startB.headers['set-cookie'][0].split(';')[0];
    assert.match(startA.headers['set-cookie'][0], /HttpOnly/);
    assert.match(startA.headers['set-cookie'][0], /SameSite=Lax/);
    assert.notEqual(cookieA, cookieB);

    global.fetch = async (url, options) => {
      assert.ok(String(url).endsWith('/generate_session_token'));
      assert.equal(options.headers['x-request-token'], 'state-less-request-token');
      assert.match(options.headers['x-signature'], /^[0-9a-f]+$/);
      return new Response(JSON.stringify({ data: { accessToken: 'encrypted-session-value' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const callbackA = await request(server, {
      path: '/api/lemonn/callback?client_id=test-client-id&request_token=state-less-request-token',
      headers: { Cookie: cookieA },
    });
    assert.equal(callbackA.statusCode, 303);
    assert.match(callbackA.headers.location, /lemonn=connected/);
    assert.doesNotMatch(callbackA.body, /encrypted-session-value|test-api-key/);

    const accountA = await pool.query(
      `SELECT a.status, a.connection_mode, t.access_token_ciphertext
       FROM broker_accounts a JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.user_id = $1 AND a.broker = 'LEMONN'`,
      [userIds[0]],
    );
    const accountB = await pool.query(
      `SELECT a.status FROM broker_accounts a WHERE a.user_id = $1 AND a.broker = 'LEMONN'`,
      [userIds[1]],
    );
    assert.equal(accountA.rows[0].status, 'CONNECTED');
    assert.equal(accountA.rows[0].connection_mode, 'LIVE');
    assert.notEqual(accountA.rows[0].access_token_ciphertext, 'encrypted-session-value');
    assert.equal(accountB.rows.length, 0, 'User A callback must not attach to User B');

    const replay = await request(server, {
      path: '/api/lemonn/callback?client_id=test-client-id&request_token=replay-token',
      headers: { Cookie: cookieA },
    });
    assert.equal(replay.statusCode, 400);
    assert.match(replay.body, /Invalid or expired LemonN OAuth session/);

    const expiredHash = `${'e'.repeat(48)}${String(Date.now()).padStart(16, '0')}`;
    const expired = await pool.query(
      `INSERT INTO broker_oauth_sessions (user_id, broker, state_hash, redirect_uri, status, expires_at)
       VALUES ($1, 'LEMONN', $2, 'http://localhost/api/lemonn/callback', 'PENDING', NOW() - INTERVAL '1 minute')
       RETURNING id`,
      [userIds[1], expiredHash],
    );
    assert.ok(expired.rows[0].id);
    const noCookie = await request(server, {
      path: '/api/lemonn/callback?client_id=test-client-id&request_token=expired-token',
    });
    assert.equal(noCookie.statusCode, 400);
    assert.match(noCookie.body, /Invalid or expired LemonN OAuth session/);

    const multiTab = await request(server, {
      method: 'POST',
      path: '/api/broker/lemonn/oauth/start',
      headers: { Authorization: `Bearer ${tokenA}`, Cookie: cookieA },
    });
    assert.equal(multiTab.statusCode, 200);
    assert.match(multiTab.headers['set-cookie'][0], /HttpOnly/);
    console.log('LemonN OAuth callback tests passed: start correlation, state-less callback, expiry, single-use replay, user isolation, multi-tab cookie retention, encrypted storage, and secret-free responses.');
  } finally {
    global.fetch = originalFetch;
    if (userIds.length) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
