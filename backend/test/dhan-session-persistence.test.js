import assert from 'assert';
import http from 'http';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { grantProductMembership } from '../src/services/product-membership.service.js';
import { storeBrokerTokens } from '../src/services/broker-token.service.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../src/middleware/auth.js';

async function runTest() {
  console.log('================================================================');
  console.log('   STARTING KEPWE DHAN SESSION PERSISTENCE & LIFECYCLE TESTS    ');
  console.log('================================================================');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Setup test user with Quant product access
    const email = 'quant-persistence-test@kepwe.internal';
    let userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    if (userRes.rows.length === 0) {
      const insert = await pool.query(
        "INSERT INTO users (id, email, password_hash, role, full_name) VALUES (gen_random_uuid(), $1, 'hashed_pw', 'customer', 'Quant Persistence Tester') RETURNING id",
        [email]
      );
      userId = insert.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    await grantProductMembership(userId, 'quant');
    const validToken = signAccessToken({ id: userId, email, role: 'customer' });
    const authHeaders = { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' };

    // 2. Setup connected Dhan broker account in database
    const testClientId = '1100987654';
    const testToken = 'valid-mock-dhan-access-token';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO broker_accounts (user_id, broker, client_id, status, connection_mode, connected_at, updated_at)
         VALUES ($1, 'DHAN', $2, 'CONNECTED', 'LIVE', NOW(), NOW())
         ON CONFLICT (user_id, broker) DO UPDATE
         SET client_id = EXCLUDED.client_id, status = 'CONNECTED', connection_mode = 'LIVE', connected_at = NOW(), updated_at = NOW()`,
        [userId, testClientId]
      );
      await storeBrokerTokens({
        client,
        userId,
        broker: 'DHAN',
        accessToken: testToken,
      });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Mock global fetch for DhanHQ API
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('dhan.co')) {
        if (urlStr.includes('/fundlimit')) {
          return new Response(JSON.stringify({
            availabelBalance: 500000,
            utilizedAmount: 12000,
            collateralAmount: 0,
            withdrawableBalance: 488000,
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (urlStr.includes('/positions')) {
          return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (urlStr.includes('/holdings')) {
          return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
        }
      }
      return originalFetch(url, options);
    };

    // [TEST 1] Standardized GET /api/algo/broker/DHAN/status
    console.log('[TEST 1] Testing standardized GET /api/algo/broker/DHAN/status...');
    const statusRes = await fetch(`${base}/api/algo/broker/DHAN/status`, { headers: authHeaders });
    assert.strictEqual(statusRes.status, 200, 'Endpoint must return HTTP 200');
    const statusData = await statusRes.json();
    console.log('  Response:', statusData);
    assert.strictEqual(statusData.connected, true, 'connected must be true');
    assert.strictEqual(statusData.broker, 'DHAN', 'broker must be DHAN');
    assert.strictEqual(statusData.status, 'CONNECTED', 'status must be CONNECTED');
    assert.strictEqual(statusData.executionMode, 'LIVE', 'executionMode must be LIVE');
    assert.strictEqual(statusData.clientId, testClientId, 'clientId must match configured client ID');
    assert.strictEqual(statusData.sessionValid, true, 'sessionValid must be true');
    assert.strictEqual(statusData.access_token, undefined, 'Access token must NEVER be leaked to client');
    assert.strictEqual(statusData.access_token_ciphertext, undefined, 'Ciphertext must NEVER be leaked to client');
    console.log('  ✔ Standardized status endpoint returned stable schema with zero token leakage.');

    // [TEST 2] Alias GET /api/broker/DHAN/status
    console.log('[TEST 2] Testing alias GET /api/broker/DHAN/status...');
    const aliasRes = await fetch(`${base}/api/broker/DHAN/status`, { headers: authHeaders });
    assert.strictEqual(aliasRes.status, 200);
    const aliasData = await aliasRes.json();
    assert.strictEqual(aliasData.connected, true);
    assert.strictEqual(aliasData.status, 'CONNECTED');
    console.log('  ✔ Alias route /api/broker/DHAN/status returned identical verified status.');

    // [TEST 3] Downstream Data Endpoint Failure Does NOT Affect Broker Connection
    console.log('[TEST 3] Testing downstream data endpoint failure isolation...');
    // Mock Dhan holdings returning 500 error
    global.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('dhan.co')) {
        if (urlStr.includes('/holdings')) {
          return new Response(JSON.stringify({ errorType: 'INTERNAL_ERROR', errorMessage: 'Dhan upstream gateway error' }), {
            status: 502,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (urlStr.includes('/fundlimit')) {
          return new Response(JSON.stringify({ availabelBalance: 100000 }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
      }
      return originalFetch(url, options);
    };

    const holdingsRes = await fetch(`${base}/api/broker/DHAN/holdings`, { headers: authHeaders });
    // Holdings might return 502 or handled error
    console.log('  Holdings failed with HTTP status:', holdingsRes.status);

    // Now re-check broker status: IT MUST REMAIN CONNECTED!
    const brokerCheckRes = await fetch(`${base}/api/algo/broker/DHAN/status`, { headers: authHeaders });
    assert.strictEqual(brokerCheckRes.status, 200);
    const brokerCheckData = await brokerCheckRes.json();
    assert.strictEqual(brokerCheckData.connected, true, 'Broker must remain CONNECTED despite downstream data failure');
    assert.strictEqual(brokerCheckData.status, 'CONNECTED');
    console.log('  ✔ Confirmed: Downstream API failure leaves broker connection strictly CONNECTED.');

    // [TEST 4] Differentiate USER_AUTH_EXPIRED vs DHAN_SESSION_EXPIRED
    console.log('[TEST 4] Testing differentiation between USER_AUTH_EXPIRED and DHAN_SESSION_EXPIRED...');
    // 4A: User Auth Expired
    const expiredUserToken = jwt.sign(
      { sub: userId, email, role: 'customer' },
      getJwtSecret(),
      { expiresIn: '-10s' } // already expired
    );
    const expiredUserRes = await fetch(`${base}/api/algo/broker/DHAN/status`, {
      headers: { Authorization: `Bearer ${expiredUserToken}`, 'Content-Type': 'application/json' },
    });
    assert.strictEqual(expiredUserRes.status, 401);
    const expiredUserData = await expiredUserRes.json();
    assert.strictEqual(expiredUserData.code, 'USER_AUTH_EXPIRED', 'Must return code USER_AUTH_EXPIRED for expired user token');
    console.log('  ✔ User auth expired returned HTTP 401 with code USER_AUTH_EXPIRED.');

    // 4B: Dhan Session Expired
    global.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('dhan.co')) {
        if (urlStr.includes('/positions') || urlStr.includes('/fundlimit')) {
          return new Response(JSON.stringify({ error: 'Token expired', remarks: { error_code: 'DH-901' } }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          });
        }
      }
      return originalFetch(url, options);
    };

    const dhanExpiredPositions = await fetch(`${base}/api/broker/DHAN/positions`, { headers: authHeaders });
    assert.strictEqual(dhanExpiredPositions.status, 401);
    const dhanExpiredPositionsData = await dhanExpiredPositions.json();
    assert.strictEqual(dhanExpiredPositionsData.code, 'DHAN_SESSION_EXPIRED', 'Must return code DHAN_SESSION_EXPIRED for expired Dhan token');
    assert.strictEqual(dhanExpiredPositionsData.broker, 'DHAN', 'Must identify broker as DHAN');
    console.log('  ✔ Dhan session expired returned HTTP 401 with code DHAN_SESSION_EXPIRED and broker DHAN.');
    assert.notStrictEqual(expiredUserData.code, dhanExpiredPositionsData.code, 'USER_AUTH_EXPIRED and DHAN_SESSION_EXPIRED are distinct states');

    // [TEST 5] Broker status reflects DHAN_SESSION_EXPIRED
    console.log('[TEST 5] Testing broker status reflects DHAN_SESSION_EXPIRED...');
    const statusExpiredRes = await fetch(`${base}/api/algo/broker/DHAN/status`, { headers: authHeaders });
    assert.strictEqual(statusExpiredRes.status, 200);
    const statusExpiredData = await statusExpiredRes.json();
    assert.strictEqual(statusExpiredData.connected, false, 'connected must be false when Dhan token is expired');
    assert.strictEqual(statusExpiredData.status, 'DHAN_SESSION_EXPIRED', 'status must be DHAN_SESSION_EXPIRED');
    assert.strictEqual(statusExpiredData.sessionValid, false, 'sessionValid must be false');
    console.log('  ✔ Status endpoint accurately reported DHAN_SESSION_EXPIRED without false disconnect.');

    // [TEST 6] Disconnect Dhan account
    console.log('[TEST 6] Testing manual broker disconnection...');
    const disconnectRes = await fetch(`${base}/api/broker/dhan/disconnect`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert.strictEqual(disconnectRes.status, 200);

    const postDisconnectStatus = await fetch(`${base}/api/algo/broker/DHAN/status`, { headers: authHeaders });
    assert.strictEqual(postDisconnectStatus.status, 200);
    const postDisconnectData = await postDisconnectStatus.json();
    assert.strictEqual(postDisconnectData.connected, false);
    assert.strictEqual(postDisconnectData.status, 'DISCONNECTED');
    assert.strictEqual(postDisconnectData.sessionValid, false);
    console.log('  ✔ Disconnection cleanly updated status to DISCONNECTED.');

    // [TEST 7] Unauthenticated Request Rejection
    console.log('[TEST 7] Testing unauthenticated request rejection...');
    const unauthRes = await fetch(`${base}/api/algo/broker/DHAN/status`);
    assert.strictEqual(unauthRes.status, 401);
    const unauthData = await unauthRes.json();
    assert.strictEqual(unauthData.code, 'USER_AUTH_REQUIRED');
    console.log('  ✔ Unauthenticated request rejected with HTTP 401 USER_AUTH_REQUIRED.');

    // Restore fetch
    global.fetch = originalFetch;

    // Cleanup test user
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    console.log('================================================================');
    console.log('  ✅ ALL 7 DHAN SESSION PERSISTENCE TESTS PASSED WITH 100% SUCCESS');
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
