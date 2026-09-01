/**
 * Razorpay payment flow integration test.
 * Run: node scripts/test-razorpay.mjs
 *
 * Tests (in order):
 *  1. Login to get a fresh JWT
 *  2. GET /subscription  (baseline)
 *  3. POST /subscription/create-order  × 2
 *  4. Verify DB: payments row status=pending
 *  5. POST /subscription/verify-payment  × 2  (valid + invalid sig)
 *  6. Verify DB: payments row status=paid, subscription active, billing_history written
 *  7. POST /subscription/cancel-payment  (simulate dismiss)
 *  8. Secret-exposure check: keyId in response must NOT contain RAZORPAY_KEY_SECRET
 */

import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const BASE = 'http://localhost:3001/api';
const { Client } = pg;

let passed = 0;
let failed = 0;
const results = [];

function pass(label) {
  console.log(`  ✅ PASS  ${label}`);
  results.push({ label, result: 'PASS' });
  passed++;
}
function fail(label, detail = '') {
  console.log(`  ❌ FAIL  ${label}${detail ? '  →  ' + detail : ''}`);
  results.push({ label, result: 'FAIL', detail });
  failed++;
}

async function api(method, path, body = null, jwt = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

// ── DB helper ────────────────────────────────────────────────────────────────
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await dbClient.connect();

// ── Test user credentials ─────────────────────────────────────────────────────
const TEST_EMAIL    = `rzptest_${Date.now()}@kepwe.test`;
const TEST_MOBILE   = `98771${String(Date.now()).slice(-5)}`;
const TEST_PASSWORD = 'Test@12345Rzp';
let jwt = null;
let userId = null;

if (!process.env.RAZORPAY_KEY_SECRET?.trim()) {
  console.log('SKIP: Razorpay integration requires the backend-only RAZORPAY_KEY_SECRET secret.');
  process.exit(0);
}

// ── 0. Register test user ─────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('SETUP: Register test user');
console.log('══════════════════════════════════════════════');
{
  const r = await api('POST', '/auth/register', {
    name: 'Razorpay Test User',
    email: TEST_EMAIL,
    mobile: TEST_MOBILE,
    password: TEST_PASSWORD,
  });
  if (r.status === 201 && r.data?.accessToken) {
    jwt    = r.data.accessToken;
    userId = r.data.user?.id;
    console.log(`  Registered ${TEST_EMAIL}  id=${userId}`);
  } else {
    console.error('  FATAL: Could not register test user', r.status, r.data);
    process.exit(1);
  }
}

// ── 1. GET /subscription — baseline ──────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 1: GET /subscription (baseline)');
console.log('══════════════════════════════════════════════');
{
  const r = await api('GET', '/subscription', null, jwt);
  console.log(`  HTTP ${r.status}  plan=${r.data?.plan}  billing=${r.data?.billingHistory?.length}`);
  if (r.status === 200) pass('GET /subscription returns 200');
  else fail('GET /subscription', `HTTP ${r.status}`);
  if (r.data?.plan === null || r.data?.plan === 'Free Trial' || r.data?.plan === 'Free Tier' || r.data?.plan === null)
    pass('New user has no paid subscription');
  else
    fail('New user subscription check', `plan=${r.data?.plan}`);
}

// ── 2. POST create-order — invalid plan ───────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 2: create-order — invalid plan name');
console.log('══════════════════════════════════════════════');
{
  const r = await api('POST', '/subscription/create-order', { plan: 'FAKE_PLAN' }, jwt);
  console.log(`  HTTP ${r.status}  error=${r.data?.error}`);
  if (r.status === 404) pass('Invalid plan rejected with 404');
  else fail('Invalid plan should 404', `HTTP ${r.status}`);
}

// ── 3. POST create-order — valid plan RUN 1 ───────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 3a: POST create-order — 3 MONTHS [RUN 1]');
console.log('══════════════════════════════════════════════');
let orderId1 = null;
{
  const r = await api('POST', '/subscription/create-order', { plan: '3 MONTHS' }, jwt);
  console.log(`  HTTP ${r.status}`);
  console.log(`  orderId   = ${r.data?.orderId}`);
  console.log(`  amount    = ${r.data?.amount} paise (₹${(r.data?.amount||0)/100})`);
  console.log(`  currency  = ${r.data?.currency}`);
  console.log(`  keyId     = ${r.data?.keyId}`);

  if (r.status === 201) pass('create-order returns HTTP 201');
  else fail('create-order HTTP', `got ${r.status}`);

  if (r.data?.orderId?.startsWith('order_')) pass('orderId starts with order_');
  else fail('orderId format', r.data?.orderId);

  if (r.data?.amount === 249900) pass('amount=249900 paise (₹2499) correct');
  else fail('amount check', `got ${r.data?.amount}`);

  if (r.data?.currency === 'INR') pass('currency=INR');
  else fail('currency', r.data?.currency);

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (r.data?.keyId && !JSON.stringify(r.data).includes(secret)) {
    pass('RAZORPAY_KEY_SECRET not in create-order response');
  } else {
    fail('SECRET LEAK in create-order response!');
  }

  orderId1 = r.data?.orderId;
}

// ── 4. POST create-order — valid plan RUN 2 ───────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 3b: POST create-order — 1 MONTH [RUN 2]');
console.log('══════════════════════════════════════════════');
let orderId2 = null;
{
  const r = await api('POST', '/subscription/create-order', { plan: '1 MONTH' }, jwt);
  console.log(`  HTTP ${r.status}  orderId=${r.data?.orderId}  amount=${r.data?.amount}`);

  if (r.status === 201) pass('create-order RUN 2 returns HTTP 201');
  else fail('create-order RUN 2', `HTTP ${r.status}`);

  if (r.data?.amount === 99900) pass('1 MONTH amount=99900 paise (₹999) correct');
  else fail('1 MONTH amount', `got ${r.data?.amount}`);

  orderId2 = r.data?.orderId;
}

// ── 5. Verify DB: payments rows are pending ───────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 4: DB — payments rows have status=pending');
console.log('══════════════════════════════════════════════');
{
  const dbRes = await dbClient.query(
    `SELECT razorpay_order_id, status, plan_name, amount_paise FROM payments
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [userId]
  );
  console.log(`  Found ${dbRes.rows.length} payment row(s) for test user`);
  for (const row of dbRes.rows) {
    console.log(`    ${row.razorpay_order_id}  status=${row.status}  plan=${row.plan_name}  amount=${row.amount_paise}`);
  }

  if (dbRes.rows.length >= 2) pass('2+ payment rows created in DB');
  else fail('Expected 2+ payment rows', `got ${dbRes.rows.length}`);

  const allPending = dbRes.rows.every(r => r.status === 'pending');
  if (allPending) pass('All new payment rows have status=pending');
  else fail('Expected status=pending', JSON.stringify(dbRes.rows.map(r => r.status)));
}

// ── 6. POST verify-payment — invalid signature ────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 5: verify-payment — INVALID signature');
console.log('══════════════════════════════════════════════');
{
  const fakePaymentId = `pay_fake${Date.now()}`;
  const fakeSig       = 'aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd';
  const r = await api('POST', '/subscription/verify-payment', {
    razorpay_order_id:   orderId1,
    razorpay_payment_id: fakePaymentId,
    razorpay_signature:  fakeSig,
    plan: '3 MONTHS',
  }, jwt);
  console.log(`  HTTP ${r.status}  error=${r.data?.error}`);

  if (r.status === 400) pass('Invalid signature rejected with HTTP 400');
  else fail('Invalid signature should 400', `HTTP ${r.status}`);

  if (r.data?.error?.toLowerCase().includes('verification')) {
    pass('Error message mentions verification');
  } else {
    fail('Error message clarity', r.data?.error);
  }

  // Verify subscription was NOT changed to a paid plan after bad sig
  const sub = await dbClient.query(
    `SELECT s.status, p.ui_name AS plan FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id WHERE s.user_id = $1`, [userId]
  );
  const subPlan = sub.rows[0]?.plan;
  const paidPlans = ['1 MONTH', '3 MONTHS', '6 MONTHS', '1 YEAR'];
  if (!paidPlans.includes(subPlan)) {
    pass('Subscription NOT upgraded after invalid signature');
  } else {
    fail('CRITICAL: Subscription was activated with invalid sig!');
  }

  // Check payments row marked failed
  const pay = await dbClient.query(
    `SELECT status FROM payments WHERE razorpay_order_id = $1`, [orderId1]
  );
  if (pay.rows[0]?.status === 'failed') pass('Payment row marked failed after bad sig');
  else fail('Payment row status after bad sig', pay.rows[0]?.status);
}

// ── 7. POST verify-payment — VALID signature (simulate Razorpay) ─────────────
// We can't run a real Razorpay payment in a test, so we simulate what Razorpay
// would return: compute the correct HMAC ourselves using the same secret.
console.log('\n══════════════════════════════════════════════');
console.log('TEST 6a: verify-payment — VALID HMAC signature [RUN 1]');
console.log('══════════════════════════════════════════════');
let validOrderId = null;
{
  // Create a fresh order (orderId1 is now failed-status)
  const or = await api('POST', '/subscription/create-order', { plan: '3 MONTHS' }, jwt);
  validOrderId = or.data?.orderId;
  console.log(`  New orderId for valid sig test: ${validOrderId}`);

  const simulatedPaymentId = `pay_sim${Date.now()}`;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const validSig = crypto
    .createHmac('sha256', secret)
    .update(`${validOrderId}|${simulatedPaymentId}`)
    .digest('hex');

  const r = await api('POST', '/subscription/verify-payment', {
    razorpay_order_id:   validOrderId,
    razorpay_payment_id: simulatedPaymentId,
    razorpay_signature:  validSig,
    plan: '3 MONTHS',
  }, jwt);
  console.log(`  HTTP ${r.status}  success=${r.data?.success}`);
  console.log(`  plan=${r.data?.subscription?.plan}  renewsOn=${r.data?.subscription?.renewsOn}`);

  if (r.status === 200 && r.data?.success === true) pass('Valid signature accepted — HTTP 200');
  else fail('Valid sig verify', `HTTP ${r.status} success=${r.data?.success}`);

  if (r.data?.subscription?.plan === '3 MONTHS') pass('Subscription plan=3 MONTHS activated');
  else fail('Subscription plan', r.data?.subscription?.plan);
  if (r.data?.subscription?.renewsOn) pass('Subscription renewsOn is set');
  else fail('renewsOn missing');

  if (r.data?.subscription?.billingHistory?.length >= 1) {
    pass('billing_history entry created');
  } else {
    fail('billing_history missing');
  }

  const secret2 = process.env.RAZORPAY_KEY_SECRET;
  if (!JSON.stringify(r.data).includes(secret2)) {
    pass('RAZORPAY_KEY_SECRET not in verify-payment response');
  } else {
    fail('SECRET LEAK in verify-payment response!');
  }
}

// ── 8. verify-payment — VALID sig RUN 2 (idempotency) ────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 6b: verify-payment — idempotency (already paid) [RUN 2]');
console.log('══════════════════════════════════════════════');
{
  const simulatedPaymentId2 = `pay_sim2_${Date.now()}`;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const validSig2 = crypto
    .createHmac('sha256', secret)
    .update(`${validOrderId}|${simulatedPaymentId2}`)
    .digest('hex');

  const r = await api('POST', '/subscription/verify-payment', {
    razorpay_order_id:   validOrderId,
    razorpay_payment_id: simulatedPaymentId2,
    razorpay_signature:  validSig2,
    plan: '3 MONTHS',
  }, jwt);
  console.log(`  HTTP ${r.status}  alreadyVerified=${r.data?.alreadyVerified}`);

  if (r.status === 200) pass('Idempotent re-verify returns HTTP 200');
  else fail('Idempotent re-verify', `HTTP ${r.status}`);

  if (r.data?.alreadyVerified === true) pass('alreadyVerified=true on repeat call');
  else fail('alreadyVerified flag', r.data?.alreadyVerified);
}

// ── 9. DB verification ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 7: DB — verify all records after successful payment');
console.log('══════════════════════════════════════════════');
{
  // Check payments table
  const payRows = await dbClient.query(
    `SELECT razorpay_order_id, status, plan_name, amount_paise, verified_at
     FROM payments WHERE user_id = $1 ORDER BY created_at DESC`, [userId]
  );
  console.log(`  payments rows: ${payRows.rows.length}`);
  for (const row of payRows.rows) {
    console.log(`    ${row.razorpay_order_id}  status=${row.status}  plan=${row.plan_name}  verified_at=${row.verified_at}`);
  }
  const paidRow = payRows.rows.find(r => r.status === 'paid');
  if (paidRow) pass('payments table has a paid row');
  else fail('No paid row in payments table');
  if (paidRow?.verified_at) pass('verified_at timestamp set on paid row');
  else fail('verified_at not set');

  // Check subscriptions table
  const sub = await dbClient.query(
    `SELECT s.status, p.ui_name AS plan, s.renews_on, s.payment_method
     FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = $1`, [userId]
  );
  console.log(`  subscription: ${JSON.stringify(sub.rows[0])}`);
  if (sub.rows[0]?.status === 'active') pass('subscription.status=active');
  else fail('subscription.status', sub.rows[0]?.status);
  if (sub.rows[0]?.plan === '3 MONTHS') pass('subscription.plan=3 MONTHS');
  else fail('subscription.plan', sub.rows[0]?.plan);
  if (sub.rows[0]?.renews_on) pass('subscription.renews_on is set');
  else fail('renews_on missing');

  // Check billing_history
  const billing = await dbClient.query(
    `SELECT amount, status, plan_name, invoice_number FROM billing_history WHERE user_id = $1`, [userId]
  );
  console.log(`  billing_history rows: ${billing.rows.length}`);
  for (const row of billing.rows) {
    console.log(`    ₹${row.amount}  status=${row.status}  plan=${row.plan_name}  invoice=${row.invoice_number}`);
  }
  if (billing.rows.length >= 1) pass('billing_history has at least 1 entry');
  else fail('billing_history empty');
  const paidBilling = billing.rows.find(r => r.status === 'Paid');
  if (paidBilling) pass('billing_history entry has status=Paid');
  else fail('billing_history status', billing.rows[0]?.status);
  if (billing.rows[0]?.invoice_number) pass('invoice_number generated');
  else fail('invoice_number missing');
}

// ── 10. cancel-payment test ───────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 8: cancel-payment (simulate dismiss)');
console.log('══════════════════════════════════════════════');
{
  // Create a new pending order to cancel
  const or = await api('POST', '/subscription/create-order', { plan: '1 YEAR' }, jwt);
  const cancelOrderId = or.data?.orderId;
  console.log(`  Created pending order for cancel test: ${cancelOrderId}`);

  const r = await api('POST', '/subscription/cancel-payment', {
    razorpay_order_id: cancelOrderId,
    reason: 'User dismissed checkout',
  }, jwt);
  console.log(`  HTTP ${r.status}  success=${r.data?.success}`);

  if (r.status === 200 && r.data?.success === true) pass('cancel-payment returns 200');
  else fail('cancel-payment', `HTTP ${r.status}`);

  const pay = await dbClient.query(
    `SELECT status FROM payments WHERE razorpay_order_id = $1`, [cancelOrderId]
  );
  if (pay.rows[0]?.status === 'cancelled') pass('Payment row marked cancelled in DB');
  else fail('Payment status after cancel', pay.rows[0]?.status);
}

// ── 11. Unauthenticated request ───────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('TEST 9: create-order without auth → 401');
console.log('══════════════════════════════════════════════');
{
  const r = await api('POST', '/subscription/create-order', { plan: '1 MONTH' });
  console.log(`  HTTP ${r.status}`);
  if (r.status === 401) pass('Unauthenticated create-order → 401');
  else fail('Expected 401 without auth', `HTTP ${r.status}`);
}

// ── Cleanup test user ─────────────────────────────────────────────────────────
await dbClient.query(`DELETE FROM users WHERE id = $1`, [userId]);
console.log(`\n  Cleaned up test user ${TEST_EMAIL}`);
await dbClient.end();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('SUMMARY');
console.log('══════════════════════════════════════════════');
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);

if (failed > 0) {
  console.log('\nFAILED tests:');
  for (const r of results.filter(r => r.result === 'FAIL')) {
    console.log(`  ❌ ${r.label}${r.detail ? '  →  ' + r.detail : ''}`);
  }
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED');
  process.exit(0);
}
