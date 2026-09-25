import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { signAccessToken, getJwtSecret } from '../src/middleware/auth.js';
import { grantProductMembership, hasProductAccess, getUserProductKeys } from '../src/services/product-membership.service.js';

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

async function runSeparateProductAuthSuite() {
  console.log('================================================================');
  console.log('  KEPWE PORTALS: SEPARATE PRODUCT AUTHENTICATION & ACCESS CONTROL  ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const runId = Date.now();

    // ──────────────────────────────────────────────────────────────────────────
    // 1. SETUP DISTINCT TEST USERS FOR DIFFERENT PRODUCTS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 1] Setting up distinct isolated users in database...');

    const dummyHash = '$2a$10$dummyHashForTestingSeparateAuth123456789012';

    // User A: Ledger Only
    const emailA = `user_ledger_${runId}@kepwe-test.com`;
    const resA = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, mobile, role, is_active, email_verified)
       VALUES ($1, $2, $3, $4, $5, true, true) RETURNING id`,
      [emailA, dummyHash, 'Ledger User A', `+9198000${runId.toString().slice(-5)}`, 'customer']
    );
    const userAId = resA.rows[0].id;
    await grantProductMembership(userAId, 'ledger');

    // User B: Quant Only
    const emailB = `user_quant_${runId}@kepwe-test.com`;
    const resB = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, mobile, role, is_active, email_verified)
       VALUES ($1, $2, $3, $4, $5, true, true) RETURNING id`,
      [emailB, dummyHash, 'Quant User B', `+9198001${runId.toString().slice(-5)}`, 'customer']
    );
    const userBId = resB.rows[0].id;
    await grantProductMembership(userBId, 'quant');

    // User C: CRM Only
    const emailC = `user_crm_${runId}@kepwe-test.com`;
    const resC = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, mobile, role, is_active, email_verified)
       VALUES ($1, $2, $3, $4, $5, true, true) RETURNING id`,
      [emailC, dummyHash, 'CRM User C', `+9198002${runId.toString().slice(-5)}`, 'customer']
    );
    const userCId = resC.rows[0].id;
    await grantProductMembership(userCId, 'crm');

    // User D: Common KEPWE Only (No product memberships)
    const emailD = `user_common_${runId}@kepwe-test.com`;
    const resD = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, mobile, role, is_active, email_verified)
       VALUES ($1, $2, $3, $4, $5, true, true) RETURNING id`,
      [emailD, dummyHash, 'Common User D', `+9198003${runId.toString().slice(-5)}`, 'customer']
    );
    const userDId = resD.rows[0].id;

    console.log('  ✓ User A (Ledger only) created:', userAId);
    console.log('  ✓ User B (Quant only) created:', userBId);
    console.log('  ✓ User C (CRM only) created:', userCId);
    console.log('  ✓ User D (Common KEPWE only) created:', userDId);

    // Verify DB product memberships
    const userAProducts = await getUserProductKeys(userAId);
    const userBProducts = await getUserProductKeys(userBId);
    const userCProducts = await getUserProductKeys(userCId);
    const userDProducts = await getUserProductKeys(userDId);

    assert.deepStrictEqual(userAProducts, ['ledger']);
    assert.deepStrictEqual(userBProducts, ['quant']);
    assert.deepStrictEqual(userCProducts, ['crm']);
    assert.deepStrictEqual(userDProducts, []);
    console.log('  ✓ Database product_memberships table verified: strict product isolation confirmed.');

    // ──────────────────────────────────────────────────────────────────────────
    // 2. SIGN ACCESS TOKENS SCOPED TO ACTIVE WORKSPACE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Generating workspace-scoped tokens...');

    const tokenA = signAccessToken({ id: userAId, email: emailA, role: 'customer' }, 'ledger');
    const tokenB = signAccessToken({ id: userBId, email: emailB, role: 'customer' }, 'quant');
    const tokenC = signAccessToken({ id: userCId, email: emailC, role: 'customer' }, 'crm');
    const tokenD = signAccessToken({ id: userDId, email: emailD, role: 'customer' }, null);


    assert(tokenA, 'tokenA generated');
    assert(tokenB, 'tokenB generated');
    assert(tokenC, 'tokenC generated');
    assert(tokenD, 'tokenD generated');
    console.log('  ✓ Generated valid cryptographic JWT access tokens.');

    // ──────────────────────────────────────────────────────────────────────────
    // 3. AUTHORIZED ACCESS TESTS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 3] Authorized workspace access tests...');

    // User A can access Ledger
    const ledgerRes = await request(server, {
      method: 'GET',
      path: '/api/ledger/dashboard',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    console.log('ledgerRes debug:', ledgerRes.statusCode, ledgerRes.data);
    assert.strictEqual(ledgerRes.statusCode, 200, `User A should access ledger (got ${ledgerRes.statusCode})`);
    console.log('  ✓ User A successfully accessed Ledger Workspace dashboard (HTTP 200).');

    // User B can access Quant
    const quantRes = await request(server, {
      method: 'GET',
      path: '/api/quant/dashboard',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(quantRes.statusCode, 200, `User B should access quant (got ${quantRes.statusCode})`);
    console.log('  ✓ User B successfully accessed Quant Workspace dashboard (HTTP 200).');

    // User C can access CRM
    const crmRes = await request(server, {
      method: 'GET',
      path: '/api/leads',
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert.strictEqual(crmRes.statusCode, 200, `User C should access CRM (got ${crmRes.statusCode})`);
    console.log('  ✓ User C successfully accessed Sales CRM leads (HTTP 200).');

    // ──────────────────────────────────────────────────────────────────────────
    // 4. CROSS-PRODUCT ATTACK TESTS (MUST FAIL WITH 403 PRODUCT_ACCESS_DENIED)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 4] Cross-Product Access Denial (Security Invariants)...');

    // Attack 1: User A (Ledger) attempts to access Quant API
    const aOnQuant = await request(server, {
      method: 'GET',
      path: '/api/quant/dashboard',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(aOnQuant.statusCode, 403, `Ledger user must NOT access Quant API (got ${aOnQuant.statusCode})`);
    assert.strictEqual(aOnQuant.data?.error, 'PRODUCT_ACCESS_DENIED');
    console.log('  ✓ ATTACK BLOCKED: User A (Ledger token) rejected from Quant API (HTTP 403 PRODUCT_ACCESS_DENIED).');

    // Attack 2: User B (Quant) attempts to access Ledger API
    const bOnLedger = await request(server, {
      method: 'GET',
      path: '/api/ledger/dashboard',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(bOnLedger.statusCode, 403, `Quant user must NOT access Ledger API (got ${bOnLedger.statusCode})`);
    assert.strictEqual(bOnLedger.data?.error, 'PRODUCT_ACCESS_DENIED');
    console.log('  ✓ ATTACK BLOCKED: User B (Quant token) rejected from Ledger API (HTTP 403 PRODUCT_ACCESS_DENIED).');

    // Attack 3: User C (CRM) attempts to access Customer Portal API
    const cOnPortal = await request(server, {
      method: 'GET',
      path: '/api/customer-portal/profile',
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert.strictEqual(cOnPortal.statusCode, 403, `CRM user must NOT access Customer Portal API (got ${cOnPortal.statusCode})`);
    assert.strictEqual(cOnPortal.data?.error, 'PRODUCT_ACCESS_DENIED');
    console.log('  ✓ ATTACK BLOCKED: User C (CRM token) rejected from Customer Portal API (HTTP 403 PRODUCT_ACCESS_DENIED).');

    // Attack 4: User A (Ledger) attempts to access Customer Portal API (Customer Portal ≠ Ledger)
    const aOnPortal = await request(server, {
      method: 'GET',
      path: '/api/customer-portal/profile',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(aOnPortal.statusCode, 403, `Customer Portal and Ledger must NOT be shared (got ${aOnPortal.statusCode})`);
    assert.strictEqual(aOnPortal.data?.error, 'PRODUCT_ACCESS_DENIED');
    console.log('  ✓ ATTACK BLOCKED: User A (Ledger token) rejected from Customer Portal API (HTTP 403 PRODUCT_ACCESS_DENIED).');

    // Attack 5: User B (Quant) attempts to access Credit API
    const bOnCredit = await request(server, {
      method: 'GET',
      path: '/api/credit/workspace',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(bOnCredit.statusCode, 403, `Quant user must NOT access Credit API (got ${bOnCredit.statusCode})`);
    assert.strictEqual(bOnCredit.data?.error, 'PRODUCT_ACCESS_DENIED');
    console.log('  ✓ ATTACK BLOCKED: User B (Quant token) rejected from Credit API (HTTP 403 PRODUCT_ACCESS_DENIED).');

    // Attack 6: User D (Common KEPWE) attempts to access any product API
    const dOnLedger = await request(server, {
      method: 'GET',
      path: '/api/ledger/dashboard',
      headers: { Authorization: `Bearer ${tokenD}` },
    });
    assert.strictEqual(dOnLedger.statusCode, 403, `Main KEPWE user must NOT automatically access Ledger (got ${dOnLedger.statusCode})`);
    assert.strictEqual(dOnLedger.data?.error, 'PRODUCT_ACCESS_DENIED');

    const dOnQuant = await request(server, {
      method: 'GET',
      path: '/api/quant/dashboard',
      headers: { Authorization: `Bearer ${tokenD}` },
    });
    assert.strictEqual(dOnQuant.statusCode, 403, `Main KEPWE user must NOT automatically access Quant (got ${dOnQuant.statusCode})`);
    assert.strictEqual(dOnQuant.data?.error, 'PRODUCT_ACCESS_DENIED');
    console.log('  ✓ Main KEPWE Login isolation verified: User D has no automatic product access.');

    // ──────────────────────────────────────────────────────────────────────────
    // 5. TAMPERING ATTACK: FAKED JWT OR QUERY PARAMETERS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 5] Tampering Defense: Spoofed JWT Product Claim & Query Params...');

    // Tamper 1: User A creates a signed token manually claiming product: 'quant'
    // but User A DOES NOT have a membership row in the database for 'quant'.
    const fakeQuantToken = jwt.sign(
      { sub: userAId, email: emailA, role: 'customer', product: 'quant', memberships: ['quant'] },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    const spoofAttempt = await request(server, {
      method: 'GET',
      path: '/api/quant/dashboard',
      headers: { Authorization: `Bearer ${fakeQuantToken}` },
    });
    assert.strictEqual(spoofAttempt.statusCode, 403, `Spoofed token must be rejected by DB membership check (got ${spoofAttempt.statusCode})`);
    assert.strictEqual(spoofAttempt.data?.error, 'PRODUCT_ACCESS_DENIED');
    console.log('  ✓ TAMPER BLOCKED: Manually forged JWT product claim rejected by backend DB verification (HTTP 403).');

    // Tamper 2: Query param manipulation ?product=ledger -> ?product=quant
    const queryTamper = await request(server, {
      method: 'GET',
      path: '/api/quant/dashboard?product=quant',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(queryTamper.statusCode, 403, `Query param manipulation must NOT grant Quant access`);
    console.log('  ✓ TAMPER BLOCKED: Query parameter manipulation ?product=quant rejected (HTTP 403).');

    // ──────────────────────────────────────────────────────────────────────────
    // 6. PRODUCT-SPECIFIC OTP CHALLENGE AND REGISTRATION FLOW
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 6] Product-Specific Email OTP Challenge & Signup...');

    // Request signup OTP for Quant
    const newQuantEmail = `new_quant_${runId}@kepwe-test.com`;
    const otpReq = await request(server, {
      method: 'POST',
      path: '/api/auth/email-otp/request',
      body: {
        email: newQuantEmail,
        purpose: 'signup',
        name: 'New Quant Trader',
        mobile: `+91987${runId.toString().slice(-7)}`,
        product: 'quant',
      },
    });
    assert.strictEqual(otpReq.statusCode, 200, `OTP request should succeed (got ${otpReq.statusCode})`);
    assert(otpReq.data?.challengeId, 'Must return challengeId');
    const devOtp = otpReq.data.devOtp;
    console.log('  ✓ Scoped Quant signup OTP requested successfully.');

    // Verify OTP to complete Quant account registration
    const otpVerify = await request(server, {
      method: 'POST',
      path: '/api/auth/email-otp/verify',
      body: {
        email: newQuantEmail,
        purpose: 'signup',
        challengeId: otpReq.data.challengeId,
        otp: devOtp,
        product: 'quant',
      },
    });
    assert.strictEqual(otpVerify.statusCode, 200, `OTP verify should succeed (got ${otpVerify.statusCode})`);
    assert(otpVerify.data?.accessToken, 'Must return accessToken');
    assert.deepStrictEqual(otpVerify.data?.user?.memberships, ['quant'], 'User must have ONLY quant membership');
    console.log('  ✓ Quant account created via product OTP. Verified user has ONLY quant membership.');

    // Now test if this newly registered Quant user can access Quant
    const newQuantAccess = await request(server, {
      method: 'GET',
      path: '/api/quant/dashboard',
      headers: { Authorization: `Bearer ${otpVerify.data.accessToken}` },
    });
    assert.strictEqual(newQuantAccess.statusCode, 200, 'New user must access Quant');

    // And test that this new user CANNOT access Ledger
    const newQuantOnLedger = await request(server, {
      method: 'GET',
      path: '/api/ledger/dashboard',
      headers: { Authorization: `Bearer ${otpVerify.data.accessToken}` },
    });
    assert.strictEqual(newQuantOnLedger.statusCode, 403, 'New Quant user must NOT access Ledger');
    console.log('  ✓ Verified: New user accesses Quant (HTTP 200), denied from Ledger (HTTP 403).');

    // ──────────────────────────────────────────────────────────────────────────
    // 7. UNAUTHENTICATED REQUESTS (MUST RETURN 401 AUTHENTICATION_REQUIRED)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 7] Unauthenticated Request Testing...');

    const unauthLedger = await request(server, { method: 'GET', path: '/api/ledger/dashboard' });
    assert.strictEqual(unauthLedger.statusCode, 401, 'Must return 401 for missing token');

    const unauthQuant = await request(server, { method: 'GET', path: '/api/quant/dashboard' });
    assert.strictEqual(unauthQuant.statusCode, 401, 'Must return 401 for missing token');

    const unauthCredit = await request(server, { method: 'GET', path: '/api/credit/workspace' });
    assert.strictEqual(unauthCredit.statusCode, 401, 'Must return 401 for missing token');

    console.log('  ✓ All protected product endpoints return HTTP 401 when unauthenticated.');

    console.log('\n================================================================');
    console.log('  ALL SEPARATE PRODUCT AUTH & ACCESS CONTROL TESTS PASSED!     ');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runSeparateProductAuthSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ SEPARATE PRODUCT AUTH TEST FAILED:', err);
    process.exit(1);
  });

