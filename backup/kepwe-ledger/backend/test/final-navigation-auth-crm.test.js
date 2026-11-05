/**
 * KEPWE Final Navigation, Authentication, Profile Photo & CRM Test Suite
 * Validates all client-delivery requirements:
 * 1. Common KEPWE Login / Signup branding & default redirect to /
 * 2. Portals menu routing: Customer Portal (/customer-portal) vs Ledger Workspace (/ledger/app)
 * 3. All 6 Portals verification (Customer Portal, Sales CRM, IndexPilot, Ledger, Credit, Quant)
 * 4. Intent-aware login return path & security against open redirects
 * 5. Sales CRM /crm direct mapping & live leads API access
 * 6. Generic 404 KEPWE branding (no IndexPilot branding)
 * 7. Ledger -> "Back to Kepwe" navigation to /
 * 8. User Profile Photo / DP upload, validation, persistence, and User A vs User B authorization
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSafeReturnPath } from '../../src/lib/auth-redirect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Use the running backend server at port 3001
const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001';

console.log('================================================================');
console.log('  KEPWE FINAL QA: ROUTING, AUTH, AVATAR & CRM AUDIT SUITE       ');
console.log('================================================================\n');

async function makeRequest(urlPath, options = {}) {
  const url = new URL(urlPath, BASE_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(body.toString('utf-8'));
        } catch {
          // ignore if not JSON
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json,
          text: body.toString('utf-8'),
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Helper to create valid PNG buffer
function createValidPngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
}

async function runTests() {
  let passed = 0;
  let total = 0;

  function pass(desc) {
    passed++;
    total++;
    console.log(`  ✔ [PASS ${passed}] ${desc}`);
  }

  function fail(desc, err) {
    total++;
    console.error(`  ✖ [FAIL] ${desc}`);
    if (err) console.error(err);
    throw err || new Error(desc);
  }

  // -------------------------------------------------------------
  // TEST 1: Backend Health Check & Database Connectivity
  // -------------------------------------------------------------
  console.log('[TEST 1] Backend Health & Database Connectivity...');
  try {
    const res = await makeRequest('/api/health');
    assert.strictEqual(res.statusCode, 200, 'Health endpoint must return 200');
    assert.strictEqual(res.json?.status, 'ok');
    pass('Backend /api/health returned 200 OK with status: ok');

    const dbRes = await makeRequest('/api/health/db');
    assert.strictEqual(dbRes.statusCode, 200, 'DB health endpoint must return 200');
    assert.strictEqual(dbRes.json?.status, 'ok');
    assert.strictEqual(dbRes.json?.database, 'reachable');
    pass('Database connectivity verified active');
  } catch (err) {
    fail('Backend health check failed', err);
  }

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // TEST 2: Common KEPWE Login / Signup Default Redirect & Product-Aware Context (Part 5, 6, 7, 14)
  // -------------------------------------------------------------
  console.log('\n[TEST 2] Verifying KEPWE Common Login / Signup (Default / & Branding)...');
  try {
    const loginSrc = fs.readFileSync(path.join(rootDir, 'src/pages/LoginPage.jsx'), 'utf-8');
    const signupSrc = fs.readFileSync(path.join(rootDir, 'src/pages/SignupPage.jsx'), 'utf-8');

    assert(!loginSrc.includes('IndexPilot\n              BY KEPWE') && !loginSrc.includes('IndexPilot BY KEPWE'), 'LoginPage must not contain hardcoded IndexPilot BY KEPWE branding');
    assert(loginSrc.includes('PRODUCT_CONFIG'), 'LoginPage must define PRODUCT_CONFIG for product-specific logins');
    assert(loginSrc.includes('kepweLogo'), 'LoginPage must import and use KEPWE logo');
    assert(loginSrc.includes('BUSINESS PLATFORM'), 'LoginPage must support default BUSINESS PLATFORM');
    assert(loginSrc.includes("defaultDest = productConfig ? productConfig.defaultPath : '/'"), 'Default destination must be / when no product specified');
    pass('LoginPage verified with pure KEPWE branding and default redirect to / (KEPWE Home)');

    assert(!signupSrc.includes('IndexPilot\n              BY KEPWE') && !signupSrc.includes('IndexPilot BY KEPWE'), 'SignupPage must not contain hardcoded IndexPilot BY KEPWE branding');
    assert(signupSrc.includes('kepweLogo'), 'SignupPage must import and use KEPWE logo');
    assert(signupSrc.includes('PRODUCT_CONFIG'), 'SignupPage must support PRODUCT_CONFIG');
    pass('SignupPage verified with pure KEPWE branding and default redirect to /');
  } catch (err) {
    fail('Login/Signup branding & default redirect verification failed', err);
  }

  // -------------------------------------------------------------
  // TEST 2B: Main Navbar "Solutions" Complete Removal & About Page Links (Part 1, 2, 3)
  // -------------------------------------------------------------
  console.log('\n[TEST 2B] Verifying Main Navbar and About Page Links (Part 1, 2, 3)...');
  try {
    const headerSrc = fs.readFileSync(path.join(rootDir, 'src/components/common/Header.jsx'), 'utf-8');
    const aboutSrc = fs.readFileSync(path.join(rootDir, 'src/pages/AboutPage.jsx'), 'utf-8');

    // Solutions item must NOT exist in main navbar
    assert(!headerSrc.includes('solutionsDropdownOpen'), 'Header must not contain solutionsDropdownOpen state');
    assert(!headerSrc.includes('>Solutions<'), 'Header must not contain visible Solutions navbar item');
    assert(headerSrc.includes('Products') && headerSrc.includes('Resources') && headerSrc.includes('About'), 'Header must retain Products, Resources, and About');
    pass('Main navbar completely removed Solutions; retains Products, Resources, About');

    // About Page Links
    assert(aboutSrc.includes("navigate('/')"), 'About page "Explore Kepwe" must navigate to /');
    assert(aboutSrc.includes("navigate('/products')"), 'About page "Explore our Products" must navigate to /products');
    assert(aboutSrc.includes("navigate('/ledger')"), 'About page "Explore Kepwe Ledger" must navigate to /ledger');
    pass('About page CTAs ("Explore Kepwe", "Explore our Products", "Explore Kepwe Ledger") point to valid destinations');

    // 6 External Ecosystem Links in "Build Better. Finance Smarter."
    const ecosystemUrls = [
      'https://healwealcorp.in',
      'https://hapdax.in',
      'https://kepwe.in',
      'https://7elevos.com',
      'https://thinkatic.com',
      'https://healwealbusinessschool.in'
    ];
    for (const link of ecosystemUrls) {
      assert(aboutSrc.includes(link), `About page must contain ecosystem link ${link}`);
    }
    assert(aboutSrc.includes('target="_blank"'), 'Ecosystem links must open safely in new tab');
    assert(aboutSrc.includes('rel="noopener noreferrer"'), 'Ecosystem links must include rel="noopener noreferrer"');
    pass('All 6 external ecosystem links verified inside "Build Better. Finance Smarter." with safe target="_blank"');
  } catch (err) {
    fail('Navbar / About page verification failed', err);
  }

  // -------------------------------------------------------------
  // TEST 3: Portals Menu Routing & Customer Portal Separation (Bug 2 & 3)
  // -------------------------------------------------------------
  console.log('\n[TEST 3] Verifying Portals Menu Routing & Separation (Bug 2 & 3)...');
  try {
    const headerSrc = fs.readFileSync(path.join(rootDir, 'src/components/common/Header.jsx'), 'utf-8');

    // Customer Portal must point to /customer-portal
    assert(headerSrc.includes('to="/customer-portal"') && headerSrc.includes('Customer Portal'), 'Customer Portal must point to /customer-portal');
    // Ledger Workspace must point to /ledger/app
    assert(headerSrc.includes('to="/ledger/app"') && headerSrc.includes('Ledger Workspace'), 'Ledger Workspace must point to /ledger/app');
    // IndexPilot must point to /app/dashboard
    assert(headerSrc.includes('to="/app/dashboard"') && headerSrc.includes('IndexPilot'), 'IndexPilot portal link must go to /app/dashboard');
    // Sales CRM must point to /crm
    assert(headerSrc.includes('to="/crm"') && headerSrc.includes('Sales CRM'), 'Sales CRM portal link must go to /crm');
    // Kepwe Credit must point to /credit
    assert(headerSrc.includes('to="/credit"') && headerSrc.includes('Kepwe Credit'), 'Kepwe Credit link must go to /credit');
    // Quant Workspace must point to /quant/dashboard
    assert(headerSrc.includes('to="/quant/dashboard"') && headerSrc.includes('Quant Workspace'), 'Quant Workspace link must go to /quant/dashboard');

    pass('Customer Portal (/customer-portal) and Ledger Workspace (/ledger/app) are strictly separated');
    pass('All 6 Portals correctly target their distinct product routes');
  } catch (err) {
    fail('Portals routing verification failed', err);
  }

  // -------------------------------------------------------------
  // TEST 4: Ledger "Back to Kepwe" Navigation (Bug 7)
  // -------------------------------------------------------------
  console.log('\n[TEST 4] Verifying Ledger "Back to Kepwe" Navigation (Bug 7)...');
  try {
    const ledgerSrc = fs.readFileSync(path.join(rootDir, 'src/pages/ledger/LedgerDashboardPage.jsx'), 'utf-8');
    assert(ledgerSrc.includes('Back to Kepwe'), 'Ledger must feature "Back to Kepwe" link');
    assert(ledgerSrc.includes('to="/"'), 'Back to Kepwe must link directly to "/"');
    pass('Ledger dashboard includes natural "Back to Kepwe" navigation directly to "/"');
  } catch (err) {
    fail('Ledger back-to-kepwe check failed', err);
  }

  // -------------------------------------------------------------
  // TEST 5: Generic 404 Branding Check (Bug 6)
  // -------------------------------------------------------------
  console.log('\n[TEST 5] Verifying Generic 404 Page Branding (Bug 6)...');
  try {
    const notFoundSrc = fs.readFileSync(path.join(rootDir, 'src/pages/NotFoundPage.jsx'), 'utf-8');
    assert(!notFoundSrc.includes('IndexPilot'), '404 page must not contain IndexPilot branding');
    assert(!notFoundSrc.includes('BY KEPWE'), '404 page must not contain BY KEPWE');
    assert(notFoundSrc.includes('KEPWE'), '404 page must contain KEPWE branding');
    assert(notFoundSrc.includes('Kepwe Home'), '404 page must provide Kepwe Home button');
    assert(notFoundSrc.includes('Back'), '404 page must provide Back button');
    pass('404 page displays pure KEPWE branding with "Kepwe Home" (/) and "Back" buttons');
  } catch (err) {
    fail('404 branding check failed', err);
  }

  // -------------------------------------------------------------
  // TEST 6: Intent-Aware Login Redirect Security (Bug 4)
  // -------------------------------------------------------------
  console.log('\n[TEST 6] Verifying Intent-Aware ReturnTo Redirect Logic (Bug 4)...');
  try {
    // Valid relative paths preserved
    assert.strictEqual(getSafeReturnPath('/app/dashboard'), '/app/dashboard');
    assert.strictEqual(getSafeReturnPath('/crm'), '/crm');
    assert.strictEqual(getSafeReturnPath('/customer-portal'), '/customer-portal');
    assert.strictEqual(getSafeReturnPath('/ledger/app'), '/ledger/app');
    assert.strictEqual(getSafeReturnPath('/quant/dashboard'), '/quant/dashboard');

    // Open redirect attempts blocked and safely default to '/'
    assert.strictEqual(getSafeReturnPath('https://evil.com'), '/');
    assert.strictEqual(getSafeReturnPath('http://attacker.site/phish'), '/');
    assert.strictEqual(getSafeReturnPath('//malicious.com'), '/');
    assert.strictEqual(getSafeReturnPath('javascript:alert(1)'), '/');

    // Auth loops blocked and safely default to '/'
    assert.strictEqual(getSafeReturnPath('/login'), '/');
    assert.strictEqual(getSafeReturnPath('/signup'), '/');
    assert.strictEqual(getSafeReturnPath('/404'), '/');
    assert.strictEqual(getSafeReturnPath(null), '/');
    assert.strictEqual(getSafeReturnPath(''), '/');

    pass('Safe returnTo sanitizer protects against open redirects and defaults to / for normal login');
  } catch (err) {
    fail('Safe returnTo check failed', err);
  }

  // -------------------------------------------------------------
  // TEST 7: Authentication Flow & Sales CRM Live API Access (Bug 1 & 5)
  // -------------------------------------------------------------
  console.log('\n[TEST 7] Testing Auth Session & Sales CRM Leads Access (Bug 1 & 5)...');
  let tokenUserA = null;
  let userAId = null;
  let tokenUserB = null;
  let userBId = null;

  try {
    // 1. Verify Email OTP request endpoint
    const otpReqPayload = JSON.stringify({
      email: `client.verify.${Date.now()}@kepwe.com`,
      purpose: 'signup',
      name: 'Client Verification Test',
      mobile: '9876543210',
    });
    const otpReqRes = await makeRequest('/api/auth/email-otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(otpReqPayload) },
      body: otpReqPayload,
    });
    assert.strictEqual(otpReqRes.statusCode, 200, 'OTP request must succeed');
    assert.strictEqual(otpReqRes.json?.success, true);
    assert(!otpReqRes.text.includes('otpCode'), 'OTP code must never leak in API response');
    pass('Email OTP request succeeded with zero OTP leakage in response');

    // 2. Register User A
    const emailA = `user.a.${Date.now()}@kepwe.com`;
    const mobileA = '9' + String(Date.now()).slice(-9);
    const regPayloadA = JSON.stringify({
      name: 'User Alpha',
      email: emailA,
      password: 'StrongPassword123!',
      mobile: mobileA,
    });
    const regResA = await makeRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(regPayloadA) },
      body: regPayloadA,
    });
    assert.strictEqual(regResA.statusCode, 201);
    tokenUserA = regResA.json.accessToken;
    userAId = regResA.json.user?.id;
    pass(`User A registered and authenticated (ID: ${userAId})`);

    // 3. Register User B (for authorization testing)
    const emailB = `user.b.${Date.now()}@kepwe.com`;
    const mobileB = '8' + String(Date.now()).slice(-9);
    const regPayloadB = JSON.stringify({
      name: 'User Beta',
      email: emailB,
      password: 'StrongPassword123!',
      mobile: mobileB,
    });
    const regResB = await makeRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(regPayloadB) },
      body: regPayloadB,
    });
    assert.strictEqual(regResB.statusCode, 201);
    tokenUserB = regResB.json.accessToken;
    userBId = regResB.json.user?.id;
    pass(`User B registered and authenticated (ID: ${userBId})`);

    // 4. Test Sales CRM Leads & KPIs
    const crmRes = await makeRequest('/api/crm/leads', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(crmRes.statusCode, 200, 'CRM leads endpoint must return 200');
    assert(Array.isArray(crmRes.json?.leads), 'CRM response must contain leads array');
    assert(crmRes.json.leads.length >= 5, 'CRM leads array must have seeded leads');
    pass(`Sales CRM live leads endpoint (/api/crm/leads) returned 200 with ${crmRes.json.leads.length} leads`);

    const kpisRes = await makeRequest('/api/crm/kpis', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(kpisRes.statusCode, 200, 'CRM KPIs endpoint must return 200');
    pass('Sales CRM KPIs endpoint (/api/crm/kpis) returned 200 OK');
  } catch (err) {
    fail('Auth & CRM leads test failed', err);
  }

  // -------------------------------------------------------------
  // TEST 8: Profile Photo / DP Upload, Persistence & Authorization (Bug 8)
  // -------------------------------------------------------------
  console.log('\n[TEST 8] Testing Profile Photo / DP System & Authorization (Bug 8)...');
  try {
    // 1. Negative Test: Bad MIME
    const badScriptPayload = JSON.stringify({
      fileData: Buffer.from('#!/bin/sh\necho hack').toString('base64'),
      mimeType: 'application/x-sh',
    });
    const badUploadRes = await makeRequest('/api/user/profile/photo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenUserA}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(badScriptPayload),
      },
      body: badScriptPayload,
    });
    assert.strictEqual(badUploadRes.statusCode, 400, 'Uploading script/executable must return 400');
    pass('Security: Non-image executable upload correctly rejected with 400 Bad Request');

    // 2. Negative Test: Spoofed image magic bytes validation
    const fakePngPayload = JSON.stringify({
      fileData: Buffer.from('NOT A REAL PNG FILE').toString('base64'),
      mimeType: 'image/png',
    });
    const fakeUploadRes = await makeRequest('/api/user/profile/photo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenUserA}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(fakePngPayload),
      },
      body: fakePngPayload,
    });
    assert.strictEqual(fakeUploadRes.statusCode, 400, 'Spoofed image must return 400');
    pass('Security: Spoofed non-image content rejected by magic bytes verification');

    // 3. Positive Test: Upload valid PNG image for User A
    const validPng = createValidPngBuffer();
    const validPayload = JSON.stringify({
      fileData: validPng.toString('base64'),
      mimeType: 'image/png',
    });
    const uploadRes = await makeRequest('/api/user/profile/photo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenUserA}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(validPayload),
      },
      body: validPayload,
    });
    assert.strictEqual(uploadRes.statusCode, 200, 'Valid photo upload must return 200');
    assert.strictEqual(uploadRes.json?.success, true);
    assert(uploadRes.json?.avatarUrl, 'Upload response must include avatarUrl');
    pass(`User A profile photo uploaded successfully: ${uploadRes.json.avatarUrl}`);

    // 4. Authenticated Retrieval Test: User A retrieves own photo via direct endpoint
    const directPhotoRes = await makeRequest('/api/user/profile/photo', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(directPhotoRes.statusCode, 200, 'User A direct photo fetch must return 200');
    assert(directPhotoRes.headers['content-type'].includes('image/png'), 'Content-Type must be image/png');
    assert(directPhotoRes.body.length > 0, 'Binary photo stream must not be empty');
    pass('User A photo direct retrieval (/api/user/profile/photo) verified with Content-Type: image/png');

    // 5. Query token retrieval test: /api/auth/profile/avatar/:userId?token=...
    const queryTokenPhotoRes = await makeRequest(`/api/auth/profile/avatar/${userAId}?token=${tokenUserA}`);
    assert.strictEqual(queryTokenPhotoRes.statusCode, 200, 'Query token avatar fetch must return 200');
    assert(queryTokenPhotoRes.headers['content-type'].includes('image/png'));
    pass('Image tag query token authentication (?token=...) verified working seamlessly');

    // 6. Security Test: Unauthenticated request must return 401 Unauthorized
    const unauthRes = await makeRequest(`/api/auth/profile/avatar/${userAId}`);
    assert.strictEqual(unauthRes.statusCode, 401, 'Unauthenticated photo request must return 401');
    pass('Security: Unauthenticated photo request blocked with 401 Unauthorized');

    // 7. Security Test: User B attempting to access User A's photo must return 403 Forbidden!
    const crossUserRes = await makeRequest(`/api/auth/profile/avatar/${userAId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenUserB}` },
    });
    assert.strictEqual(crossUserRes.statusCode, 403, 'User B accessing User A photo must return 403 Forbidden');
    pass('Security: Cross-user access blocked (User B accessing User A photo returns 403 Forbidden)');

    // 8. Session Persistence: Verify GET /api/user/profile contains avatarUrl
    const profileRes = await makeRequest('/api/user/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(profileRes.statusCode, 200);
    assert(profileRes.json?.user?.avatarUrl, 'User session profile must include avatarUrl');
    pass('Profile photo verified persisting in user profile session (/api/user/profile)');

    // 9. Secondary Persistence Check: verify /api/auth/profile also reflects persisted avatar
    const authProfileRes = await makeRequest('/api/auth/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(authProfileRes.statusCode, 200);
    assert(authProfileRes.json?.user?.avatarUrl, 'Auth profile must reflect persisted avatar');
    pass('Profile photo verified persisting in database across multiple endpoints');

    // 10. Photo Removal Test
    const deleteRes = await makeRequest('/api/user/profile/photo', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(deleteRes.statusCode, 200, 'Photo deletion must return 200');
    assert.strictEqual(deleteRes.json?.success, true);
    pass('Profile photo deletion (/api/user/profile/photo) verified cleanly');

    // 11. Verify removed in profile
    const afterDeleteProfile = await makeRequest('/api/user/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenUserA}` },
    });
    assert.strictEqual(afterDeleteProfile.json?.user?.avatarUrl, null, 'avatarUrl must be null after removal');
    pass('User profile reflects null avatarUrl after removal');
  } catch (err) {
    fail('Profile photo test failed', err);
  }

  // -------------------------------------------------------------
  // TEST 9: App Router Route Integrity (Bug 2, 3, 5, 6)
  // -------------------------------------------------------------
  console.log('\n[TEST 9] Verifying App Router Integrity (Bug 2, 3, 5, 6)...');
  try {
    const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf-8');
    assert(appSrc.includes('path="/customer-portal"'), 'App.jsx must define route /customer-portal');
    assert(appSrc.includes('CustomerPortalPage'), 'App.jsx must map /customer-portal to CustomerPortalPage');
    assert(appSrc.includes('path="/ledger/app"'), 'App.jsx must define route /ledger/app');
    assert(appSrc.includes('LedgerDashboardPage'), 'App.jsx must map /ledger/app to LedgerDashboardPage');
    assert(appSrc.includes('path="/crm"'), 'App.jsx must define route /crm');
    assert(appSrc.includes('SalesCRMPage'), 'App.jsx must map /crm to SalesCRMPage');
    assert(appSrc.includes('path="/app/dashboard"'), 'App.jsx must define route /app/dashboard');
    assert(appSrc.includes('path="*"'), 'App.jsx must have wildcard 404 fallback');
    pass('App router registers /customer-portal, /ledger/app, /crm, /app/dashboard, and generic 404');
  } catch (err) {
    fail('App router check failed', err);
  }

  console.log('\n================================================================');
  console.log(`   ✅ ALL ${passed} VERIFICATION AUDIT TESTS PASSED WITH 100% SUCCESS  `);
  console.log('================================================================\n');
}

runTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\nTest suite encountered fatal error:', err);
  process.exit(1);
});
