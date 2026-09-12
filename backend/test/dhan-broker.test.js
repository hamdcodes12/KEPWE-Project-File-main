import assert from 'node:assert/strict';
import http from 'node:http';

process.env.DHAN_API_KEY = 'c0be378b';
process.env.DHAN_API_SECRET = '29c396c8-8ca0-4df2-a360-fa914e5d780b';
process.env.DHAN_STATIC_IP = '103.117.180.146';
process.env.BROKER_TOKEN_ENCRYPTION_KEY = '1111111111111111111111111111111111111111111111111111111111111111';

const { default: app } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');
const { signAccessToken } = await import('../src/middleware/auth.js');
const { grantProductMembership } = await import('../src/services/product-membership.service.js');
const { decryptBrokerSecret } = await import('../src/services/broker-token.service.js');

function request(server, { method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        method,
        path,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => { resBody += chunk; });
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: resBody,
          json: () => {
            try { return JSON.parse(resBody); } catch { return null; }
          },
        }));
      },
    );
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function createUser(email) {
  const mobile = `+91${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 10)}`;
  const result = await pool.query(
    `INSERT INTO users (email, full_name, mobile, password_hash, role, plan, is_active)
     VALUES ($1, 'Dhan User', $2, 'test-hash', 'customer', 'Pro', TRUE)
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
    // Create 2 test users to verify strict account and credential isolation
    const userA = await createUser(`dhan-user-a-${Date.now()}@test.local`);
    const userB = await createUser(`dhan-user-b-${Date.now()}@test.local`);
    userIds.push(userA, userB);

    const tokenA = signAccessToken({ id: userA, role: 'customer', plan: 'Pro' }, 'quant');
    const tokenB = signAccessToken({ id: userB, role: 'customer', plan: 'Pro' }, 'quant');
    const authA = { Authorization: `Bearer ${tokenA}` };
    const authB = { Authorization: `Bearer ${tokenB}` };

    console.log('[Test 1] Direct Dhan connection with live credential validation & AES-256-GCM encryption');
    global.fetch = async (url, options) => {
      if (String(url).endsWith('/fundlimit')) {
        const token = options.headers['access-token'];
        if (token === 'invalid-token') {
          return new Response(JSON.stringify({ status: 'failure', remarks: { error_code: 'DH-905', message: 'Unauthorized' } }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ availabelBalance: 250000, utilizedAmount: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ status: 'success' }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    // Attempt direct connect with invalid token -> should fail with 401
    const failConnect = await request(server, {
      method: 'POST',
      path: '/api/broker/dhan/connect',
      headers: authA,
      body: { dhanClientId: '1100000001', accessToken: 'invalid-token' },
    });
    assert.equal(failConnect.statusCode, 401);

    // Direct connect with valid credentials for User A
    const rawTokenA = 'jwt-live-token-for-user-a';
    const connectA = await request(server, {
      method: 'POST',
      path: '/api/broker/dhan/connect',
      headers: authA,
      body: { dhanClientId: '1100000001', accessToken: rawTokenA },
    });
    assert.equal(connectA.statusCode, 200);
    const bodyA = connectA.json();
    assert.equal(bodyA.status, 'CONNECTED');
    assert.equal(bodyA.broker, 'DHAN');
    assert.equal(bodyA.dhanClientId, '1100000001');

    // Direct connect with different credentials for User B
    const rawTokenB = 'jwt-live-token-for-user-b';
    const connectB = await request(server, {
      method: 'POST',
      path: '/api/broker/dhan/connect',
      headers: authB,
      body: { dhanClientId: '1100000002', accessToken: rawTokenB },
    });
    assert.equal(connectB.statusCode, 200);
    const bodyB = connectB.json();
    assert.equal(bodyB.status, 'CONNECTED');
    assert.equal(bodyB.broker, 'DHAN');
    assert.equal(bodyB.dhanClientId, '1100000002');

    console.log('[Test 2] Verify strict user isolation and encryption in database');
    const storedA = await pool.query(
      `SELECT a.client_id, a.status, a.connection_mode, t.access_token_ciphertext
       FROM broker_accounts a
       JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.user_id = $1 AND a.broker = 'DHAN'`,
      [userA],
    );
    const storedB = await pool.query(
      `SELECT a.client_id, a.status, a.connection_mode, t.access_token_ciphertext
       FROM broker_accounts a
       JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.user_id = $1 AND a.broker = 'DHAN'`,
      [userB],
    );
    assert.equal(storedA.rows[0].client_id, '1100000001');
    assert.equal(storedB.rows[0].client_id, '1100000002');
    assert.notEqual(storedA.rows[0].access_token_ciphertext, rawTokenA);
    assert.notEqual(storedB.rows[0].access_token_ciphertext, rawTokenB);
    assert.notEqual(storedA.rows[0].access_token_ciphertext, storedB.rows[0].access_token_ciphertext);

    // Decrypt and verify each user gets only their own token
    assert.equal(decryptBrokerSecret(storedA.rows[0].access_token_ciphertext), rawTokenA);
    assert.equal(decryptBrokerSecret(storedB.rows[0].access_token_ciphertext), rawTokenB);

    console.log('[Test 3] Session validation and status check via GET /api/broker/status');
    const statusResA = await request(server, { path: '/api/broker/status', headers: authA });
    assert.equal(statusResA.statusCode, 200);
    const statusDataA = statusResA.json();
    const dhanStatusA = statusDataA.brokers.find((b) => b.broker === 'DHAN');
    assert.equal(dhanStatusA.status, 'CONNECTED');
    assert.equal(dhanStatusA.clientId, '1100000001');

    console.log('[Test 4] Session expiry handling when Dhan returns 401');
    global.fetch = async (url) => {
      if (String(url).endsWith('/fundlimit')) {
        return new Response(JSON.stringify({ error: 'Token expired' }), { status: 401, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };
    const expiredResA = await request(server, { path: '/api/broker/status', headers: authA });
    assert.equal(expiredResA.statusCode, 200);
    const expiredDataA = expiredResA.json();
    const expiredDhanA = expiredDataA.brokers.find((b) => b.broker === 'DHAN');
    assert.equal(expiredDhanA.status, 'SESSION_EXPIRED');

    console.log('[Test 5] Dhan Consent OAuth flow (start -> consent -> callback consume)');
    global.fetch = async (url, options) => {
      if (String(url).includes('/app/generate-consent')) {
        return new Response(JSON.stringify({ consentAppId: 'consent-app-12345' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (String(url).includes('/app/consumeApp-consent')) {
        return new Response(JSON.stringify({ data: { accessToken: 'dhan-oauth-jwt-token', dhanClientId: '1100000003' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ availabelBalance: 100000 }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const oauthStart = await request(server, {
      method: 'POST',
      path: '/api/broker/dhan/oauth/start',
      headers: authA,
    });
    assert.equal(oauthStart.statusCode, 200);
    const oauthStartBody = oauthStart.json();
    assert.match(oauthStartBody.authorizationUrl, /consentApp-login\?consentAppId=consent-app-12345/);
    const oauthCookie = oauthStart.headers['set-cookie'][0].split(';')[0];
    assert.match(oauthStart.headers['set-cookie'][0], /HttpOnly/);

    // Test callback consumption via primary Dhan callback URL
    const oauthCallback = await request(server, {
      path: '/api/dhan/callback?tokenId=token-xyz-123',
      headers: { Cookie: oauthCookie },
    });
    assert.equal(oauthCallback.statusCode, 303);
    assert.match(oauthCallback.headers.location, /dhan=connected/);

    // Verify token was updated in database
    const updatedA = await pool.query(
      `SELECT a.client_id, a.status, t.access_token_ciphertext
       FROM broker_accounts a JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
       WHERE a.user_id = $1 AND a.broker = 'DHAN'`,
      [userA],
    );
    assert.equal(updatedA.rows[0].client_id, '1100000003');
    assert.equal(updatedA.rows[0].status, 'CONNECTED');
    assert.equal(decryptBrokerSecret(updatedA.rows[0].access_token_ciphertext), 'dhan-oauth-jwt-token');

    console.log('[Test 6] Verify callback alias /api/lemonn/callback also processes Dhan OAuth callback correctly');
    const oauthStart2 = await request(server, {
      method: 'POST',
      path: '/api/broker/dhan/oauth/start',
      headers: authB,
    });
    const oauthCookie2 = oauthStart2.headers['set-cookie'][0].split(';')[0];

    const aliasCallback = await request(server, {
      path: '/api/lemonn/callback?tokenId=token-alias-456',
      headers: { Cookie: oauthCookie2 },
    });
    assert.equal(aliasCallback.statusCode, 303);
    assert.match(aliasCallback.headers.location, /dhan=connected/);

    console.log('[Test 7] Webhook / Postback order update processing on both endpoints');
    // Create an active test order in algo_orders
    const orderRes = await pool.query(
      `INSERT INTO algo_orders (
         user_id, execution_mode, instrument, side, quantity, price, status, broker_order_id
       ) VALUES ($1, 'LIVE', 'INFY', 'BUY', 50, 1500.00, 'SUBMITTED', 'dhan-live-order-101')
       RETURNING id`,
      [userA],
    );
    const orderId = orderRes.rows[0].id;

    // Send Dhan postback webhook payload to /api/lemonn/callback (configured URL)
    const postbackRes1 = await request(server, {
      method: 'POST',
      path: '/api/lemonn/callback',
      body: {
        orderId: 'dhan-live-order-101',
        orderStatus: 'TRADED',
        filledQty: 50,
        averagePrice: 1502.50,
      },
    });
    assert.equal(postbackRes1.statusCode, 200);
    assert.equal(postbackRes1.json().status, 'success');

    // Verify order was transitioned to FILLED
    const orderCheck1 = await pool.query('SELECT status, filled_quantity, average_fill_price FROM algo_orders WHERE id = $1', [orderId]);
    assert.equal(orderCheck1.rows[0].status, 'FILLED');
    assert.equal(Number(orderCheck1.rows[0].filled_quantity), 50);
    assert.equal(Number(orderCheck1.rows[0].average_fill_price), 1502.5);

    // Also send postback to /api/dhan/callback
    const postbackRes2 = await request(server, {
      method: 'POST',
      path: '/api/dhan/callback',
      body: {
        orderId: 'dhan-live-order-101',
        orderStatus: 'CANCELLED',
      },
    });
    assert.equal(postbackRes2.statusCode, 200);
    const orderCheck2 = await pool.query('SELECT status FROM algo_orders WHERE id = $1', [orderId]);
    assert.equal(orderCheck2.rows[0].status, 'CANCELLED');

    console.log('[Test 8] Disconnect Dhan account');
    const disconnectRes = await request(server, {
      method: 'POST',
      path: '/api/broker/dhan/disconnect',
      headers: authA,
    });
    assert.equal(disconnectRes.statusCode, 200);
    const disconnectedRow = await pool.query('SELECT status, connection_mode FROM broker_accounts WHERE user_id = $1 AND broker = $2', [userA, 'DHAN']);
    assert.equal(disconnectedRow.rows[0].status, 'NOT_CONNECTED');
    const tokenCheck = await pool.query(
      `SELECT t.access_token_ciphertext
       FROM broker_oauth_tokens t
       JOIN broker_accounts a ON a.id = t.broker_account_id
       WHERE a.user_id = $1 AND a.broker = $2`,
      [userA, 'DHAN'],
    );
    assert.equal(tokenCheck.rows.length, 0);

    console.log('All Dhan broker integration tests passed successfully!');
  } finally {
    global.fetch = originalFetch;
    if (userIds.length) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failure:', err);
    process.exit(1);
  });
