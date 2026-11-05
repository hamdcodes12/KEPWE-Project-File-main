import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { signAccessToken } from '../src/middleware/auth.js';
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

async function runRuntimeSmokeAndSecuritySuite() {
  console.log('================================================================');
  console.log('  KEPWE LEDGER: RUNTIME HTTP SMOKE & SECURITY TEST SUITE        ');
  console.log('================================================================\n');

  // Start HTTP server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  console.log(`[setup] Test server listening on http://127.0.0.1:${port}`);

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // 1. HEALTH CHECKS
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[TEST 1] Testing /api/health and /api/health/db...');
    const healthRes = await request(server, { path: '/api/health' });
    assert.strictEqual(healthRes.statusCode, 200);
    assert.strictEqual(healthRes.data.status, 'ok');
    assert.strictEqual(healthRes.data.service, 'kepwe-backend');

    const dbHealthRes = await request(server, { path: '/api/health/db' });
    assert.strictEqual(dbHealthRes.statusCode, 200);
    assert.strictEqual(dbHealthRes.data.database, 'reachable');
    console.log('  ✔ Health endpoints return 200 OK and database is verified reachable.');

    // ═════════════════════════════════════════════════════════════════════════
    // 2. AUTHENTICATION HARDENING & ZERO-BYPASS ENFORCEMENT
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[TEST 2] Testing Authentication Hardening & Zero-Bypass Enforcements...');
    const dummyCompanyId = crypto.randomUUID();

    // 2a. Request with no token
    const noTokenRes = await request(server, {
      path: `/api/v1/trial-balance`,
    });
    assert.strictEqual(noTokenRes.statusCode, 401, 'Unauthenticated request must return 401');

    // 2b. Request with malformed token
    const malformedRes = await request(server, {
      path: `/api/v1/trial-balance`,
      headers: { Authorization: 'Bearer this-is-not-a-valid-jwt' },
    });
    assert.strictEqual(malformedRes.statusCode, 401, 'Malformed token must return 401');

    // 2c. Request with mock dev bypass tokens
    const mockTokenRes1 = await request(server, {
      path: `/api/v1/trial-balance`,
      headers: { Authorization: 'Bearer mock_access_token_dev_user_navi' },
    });
    assert.strictEqual(mockTokenRes1.statusCode, 401, 'mock_access_token_ bypass must be rejected with 401');

    const mockTokenRes2 = await request(server, {
      path: `/api/v1/trial-balance`,
      headers: { Authorization: 'Bearer mock_token_customer' },
    });
    assert.strictEqual(mockTokenRes2.statusCode, 401, 'mock_token bypass must be rejected with 401');
    console.log('  ✔ Strict zero-bypass authentication confirmed: 401 on missing, malformed, and mock tokens.');

    // ═════════════════════════════════════════════════════════════════════════
    // 3. MULTI-TENANT ISOLATION AT HTTP BOUNDARY
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[TEST 3] Testing Multi-Tenant Company Isolation at HTTP Boundary...');
    const tenantA = crypto.randomUUID();
    const tenantB = crypto.randomUUID();
    const userA = crypto.randomUUID();

    // Insert userA and tenantA, tenantB
    await pool.query(`INSERT INTO companies (id, name, created_at, updated_at) VALUES ($1, 'Tenant Company A', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`, [tenantA]);
    await pool.query(`INSERT INTO companies (id, name, created_at, updated_at) VALUES ($1, 'Tenant Company B', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`, [tenantB]);
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, full_name, is_active, created_at, updated_at)
       VALUES ($1, $2, 'hash', 'customer', 'Smoke User A', TRUE, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userA, `smoke-user-${Date.now()}@kepwe.test`]
    );

    await grantProductMembership(userA, 'ledger');

    // Generate valid JWT for userA
    const validTokenA = signAccessToken({
      id: userA,
      email: `smoke-user-${Date.now()}@kepwe.test`,
      role: 'customer',
      plan: 'Enterprise',
      companyId: tenantA,
    }, 'ledger');

    // Access Company A's endpoint -> Should succeed (200)
    const accessARes = await request(server, {
      path: `/api/v1/trial-balance`,
      headers: { Authorization: `Bearer ${validTokenA}`, 'x-company-id': tenantA },
    });
    assert.strictEqual(accessARes.statusCode, 200, 'Authorized company query must return 200');

    // Attempt Cross-Tenant access to Company B's endpoint -> MUST be blocked (403)
    const accessBRes = await request(server, {
      path: `/api/v1/trial-balance`,
      headers: { Authorization: `Bearer ${validTokenA}`, 'x-company-id': tenantB },
    });
    assert.strictEqual(accessBRes.statusCode, 403, 'Cross-tenant data access must return 403 Forbidden');
    console.log('  ✔ Multi-tenant boundary isolation confirmed: Tenant A accessing Tenant B receives 403 Forbidden.');

    // ═════════════════════════════════════════════════════════════════════════
    // 4. PERSISTENT IDEMPOTENCY ENGINE VIA HTTP
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[TEST 4] Testing Persistent Idempotency Engine & Conflict Detection...');
    const idemKey = `idem-http-smoke-${Date.now()}`;

    // First request with Idempotency-Key (PATCH company profile)
    const idemReq1 = await request(server, {
      method: 'PATCH',
      path: `/api/v1/companies/profile`,
      headers: {
        Authorization: `Bearer ${validTokenA}`,
        'x-company-id': tenantA,
        'Idempotency-Key': idemKey,
      },
      body: { legalName: 'Alpha Unified Corp', state: 'Maharashtra', stateCode: '27' },
    });
    assert.strictEqual(idemReq1.statusCode, 200);

    // Second request with same Idempotency-Key -> MUST be served from PostgreSQL cache with X-Idempotent-Replay
    const idemReq2 = await request(server, {
      method: 'PATCH',
      path: `/api/v1/companies/profile`,
      headers: {
        Authorization: `Bearer ${validTokenA}`,
        'x-company-id': tenantA,
        'Idempotency-Key': idemKey,
      },
      body: { legalName: 'Alpha Unified Corp', state: 'Maharashtra', stateCode: '27' },
    });
    assert.strictEqual(idemReq2.statusCode, 200);
    assert.strictEqual(idemReq2.headers['x-idempotent-replay'], 'true', 'Replayed idempotent response must have X-Idempotent-Replay header');

    // Verify record in PostgreSQL idempotency_records table
    const idemDbCheck = await pool.query(
      `SELECT * FROM idempotency_records WHERE key = $1`,
      [idemKey]
    );
    assert.strictEqual(idemDbCheck.rows.length, 1);
    assert.strictEqual(idemDbCheck.rows[0].status, 'COMPLETED');
    console.log('  ✔ Idempotency confirmed: Replay detected and served from PostgreSQL record with X-Idempotent-Replay: true.');

    // ═════════════════════════════════════════════════════════════════════════
    // 5. SPA FALLBACK FOR FRONTEND CLIENT-SIDE ROUTES
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n[TEST 5] Testing SPA Fallback for Frontend Routes...');
    const spaRes = await request(server, { path: '/ledger' });
    assert.strictEqual(spaRes.statusCode, 200);
    assert(typeof spaRes.data === 'string' && spaRes.data.toLowerCase().includes('<!doctype html>') && spaRes.data.includes('id="root"'), 'SPA route must serve index.html');
    console.log('  ✔ Single-service SPA fallback serves production built HTML bundle with 200 OK.');

    console.log('\n================================================================');
    console.log('  ✅ ALL RUNTIME HTTP SMOKE & SECURITY TESTS PASSED 100%!       ');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runRuntimeSmokeAndSecuritySuite().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ RUNTIME SMOKE TEST FAILED:', err);
  process.exit(1);
});
