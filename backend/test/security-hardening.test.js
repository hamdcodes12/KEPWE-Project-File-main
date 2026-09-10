import assert from 'assert';
import http from 'http';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { requestEmailOtp } from '../src/services/email-otp.service.js';
import { grantProductMembership } from '../src/services/product-membership.service.js';

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
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsedData = null;
          try {
            parsedData = JSON.parse(rawData);
          } catch (_) {
            parsedData = rawData;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData,
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting KEPWE Platform Security Hardening Tests ---');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    // 1. Setup test users
    const resA = await pool.query(
      `INSERT INTO users (email, full_name, mobile, password_hash, role, plan, is_active)
       VALUES ($1, $2, $3, $4, 'customer', 'Pro', TRUE)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id, email, full_name, mobile, role, plan`,
      ['security_tester_a@kepwe-sec.test', 'Security Tester A', '+919999900001', 'hashed_sec_pass']
    );
    const userA = resA.rows[0];

    const resB = await pool.query(
      `INSERT INTO users (email, full_name, mobile, password_hash, role, plan, is_active)
       VALUES ($1, $2, $3, $4, 'customer', 'Free Trial', TRUE)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id, email, full_name, mobile, role, plan`,
      ['security_tester_b@kepwe-sec.test', 'Security Tester B', '+919999900002', 'hashed_sec_pass']
    );
    const userB = resB.rows[0];

    // Grant userA quant access only
    await grantProductMembership(userA.id, 'quant', { role: 'owner' });

    const tokenUserA = signAccessToken(userA, 'quant');
    const tokenUserB = signAccessToken(userB, null);

    // TEST 1: Security Headers
    console.log('Test 1: Security response headers & anti-caching verification');
    const healthRes = await request(server, { method: 'GET', path: '/api/health' });
    assert.strictEqual(healthRes.statusCode, 200);
    assert.strictEqual(healthRes.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(healthRes.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.ok(healthRes.headers['cache-control'].includes('no-store'), 'cache-control must contain no-store');
    assert.ok(healthRes.headers['cache-control'].includes('no-cache'), 'cache-control must contain no-cache');
    assert.strictEqual(healthRes.headers['pragma'], 'no-cache');
    assert.ok(healthRes.headers['content-security-policy'].includes("default-src 'self'"));
    assert.ok(healthRes.headers['content-security-policy'].includes("frame-ancestors 'self'"));
    console.log('✓ Security response headers verified');

    // TEST 2: Query Parameter Token Defense
    console.log('Test 2: Query parameter token rejection on sensitive APIs');
    const queryAttempt = await request(server, {
      method: 'GET',
      path: `/api/auth/me?token=${tokenUserA}`,
    });
    assert.strictEqual(queryAttempt.statusCode, 401, 'Query parameter token must be rejected on /api/auth/me');

    const headerAttempt = await request(server, {
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(headerAttempt.statusCode, 200, 'Bearer header token must succeed');
    assert.strictEqual(headerAttempt.data.user.id, userA.id);
    console.log('✓ Query parameter token correctly blocked on sensitive APIs');

    // TEST 3: Query Parameter Token Compatibility for Avatars
    console.log('Test 3: Query parameter token compatibility for avatar image loading');
    const avatarRes = await request(server, {
      method: 'GET',
      path: `/api/auth/profile/avatar/${userA.id}?token=${tokenUserA}`,
    });
    assert.notStrictEqual(avatarRes.statusCode, 401, 'Avatar endpoint must process query token without 401');
    assert.strictEqual(avatarRes.statusCode, 404, 'Returns 404 cleanly when no image uploaded yet');
    console.log('✓ Avatar image query token compatibility verified');

    // TEST 4: Production OTP Secrecy
    console.log('Test 4: Production OTP secrecy (devOtp is never exposed in production)');
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.RESEND_API_KEY;
    const originalFetch = globalThis.fetch;
    try {
      process.env.NODE_ENV = 'production';
      process.env.RESEND_API_KEY = 'test-only-email-provider-key';
      globalThis.fetch = async () => new Response(JSON.stringify({ id: 'test-email-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const challenge = await requestEmailOtp({
        email: `prod_sec_check_${Date.now()}@kepwe-sec.test`,
        purpose: 'login',
        payload: {},
      });

      assert.ok(challenge.challengeId);
      assert.strictEqual(challenge.devOtp, undefined, 'devOtp must NEVER be present in production');
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey) process.env.RESEND_API_KEY = originalKey;
      else delete process.env.RESEND_API_KEY;
      globalThis.fetch = originalFetch;
    }
    console.log('✓ Production OTP secrecy verified');

    // TEST 5: Product Isolation
    console.log('Test 5: Product workspace isolation (Quant ≠ Ledger ≠ CRM ≠ Credit)');
    const quantRes = await request(server, {
      method: 'GET',
      path: '/api/quant/dashboard',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(quantRes.statusCode, 200, 'Quant member must access Quant');

    const ledgerRes = await request(server, {
      method: 'GET',
      path: '/api/ledger/dashboard',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(ledgerRes.statusCode, 403, 'Quant user must NOT access Ledger');
    assert.strictEqual(ledgerRes.data.code, 'PRODUCT_ACCESS_DENIED');

    const crmRes = await request(server, {
      method: 'GET',
      path: '/api/crm/leads',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(crmRes.statusCode, 403, 'Quant user must NOT access CRM');
    assert.strictEqual(crmRes.data.code, 'PRODUCT_ACCESS_DENIED');

    const creditRes = await request(server, {
      method: 'GET',
      path: '/api/credit/workspace',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(creditRes.statusCode, 403, 'Quant user must NOT access Credit');
    assert.strictEqual(creditRes.data.code, 'PRODUCT_ACCESS_DENIED');
    console.log('✓ Product workspace isolation verified');

    // TEST 6: IDOR Protection
    console.log('Test 6: Cross-user IDOR protection');
    const crossAvatarRes = await request(server, {
      method: 'GET',
      path: `/api/auth/profile/avatar/${userB.id}`,
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(crossAvatarRes.statusCode, 403, 'User A cannot access User B profile photo');
    assert.ok(/Forbidden/.test(crossAvatarRes.data.error));
    console.log('✓ Cross-user IDOR protection verified');

    // TEST 7: Admin Isolation
    console.log('Test 7: Admin API authorization isolation');
    const adminRes = await request(server, {
      method: 'GET',
      path: '/api/admin/founder-dashboard/summary',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(adminRes.statusCode, 403, 'Customer token cannot access Admin APIs');
    console.log('✓ Admin API authorization isolation verified');

    // TEST 8: Admin Login
    console.log('Test 8: Admin login credential validation');
    const invalidAdmin = await request(server, {
      method: 'POST',
      path: '/api/admin/auth/login',
      body: { username: 'attacker', password: 'wrongpassword' },
    });
    assert.strictEqual(invalidAdmin.statusCode, 401, 'Invalid admin login rejected with 401');
    console.log('✓ Admin login credential validation verified');

    // TEST 9: Public Form Validation
    console.log('Test 9: Public lead & contact form validation');
    const validContact = await request(server, {
      method: 'POST',
      path: '/api/contact',
      body: {
        name: 'Sec Form Tester',
        company: 'Safe Enterprise',
        email: 'safetest@kepwe-sec.test',
        phone: '9876543210',
        requirement: 'Accounting & GST',
      },
    });
    assert.strictEqual(validContact.statusCode, 201);
    assert.ok(validContact.data.submission.id);

    const invalidContact = await request(server, {
      method: 'POST',
      path: '/api/contact',
      body: {
        name: 'Bad Form Tester',
        email: 'not-an-email',
        phone: '123',
      },
    });
    assert.strictEqual(invalidContact.statusCode, 400);
    console.log('✓ Public form validation & sanitization verified');

    console.log('\n======================================================');
    console.log('ALL 9 SECURITY HARDENING CONTROLS VERIFIED & PASSED!');
    console.log('======================================================\n');
    process.exit(0);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Security test failed:', err);
  process.exit(1);
});
