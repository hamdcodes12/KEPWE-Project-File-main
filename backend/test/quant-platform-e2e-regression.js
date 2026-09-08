import http from 'http';
import https from 'https';
import assert from 'assert';

console.log('================================================================');
console.log('   KEPWE QUANT & FULL PLATFORM COMPREHENSIVE E2E REGRESSION    ');
console.log('================================================================\n');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json || data,
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${url}`));
    });
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runRegressionSuite() {
  const backendBase = 'http://127.0.0.1:3001';
  const frontendBase = 'http://127.0.0.1:5173';

  // 1. Health & Database Check
  console.log('[STEP 1] Testing Backend Health & Persistent DB Connection...');
  const healthRes = await request(`${backendBase}/api/health`);
  assert.strictEqual(healthRes.statusCode, 200, 'Health endpoint must return 200');
  assert.strictEqual(healthRes.data?.status, 'ok');

  const dbRes = await request(`${backendBase}/api/health/db`);
  assert.strictEqual(dbRes.statusCode, 200, 'DB health endpoint must return 200');
  assert.strictEqual(dbRes.data?.database, 'reachable');
  console.log('  ✔ Backend and PostgreSQL database verified reachable.');

  // 2. Frontend HTML Route Serving
  console.log('\n[STEP 2] Testing Frontend Route Delivery (Vite Dev Server)...');
  const routesToTest = [
    '/',
    '/login',
    '/signup',
    '/quant',
    '/quant/login',
    '/quant/dashboard',
    '/quant/dashboard/builder',
    '/quant/dashboard/backtest',
    '/quant/dashboard/paper-trading',
    '/quant/dashboard/live',
    '/quant/dashboard/risk',
    '/quant/dashboard/broker',
    '/ledger/login',
    '/ledger/app',
    '/crm/login',
    '/customer-portal/login',
    '/credit/login',
    '/indexpilot/login',
    '/admin-login',
  ];

  for (const route of routesToTest) {
    const res = await request(`${frontendBase}${route}`);
    assert.strictEqual(
      res.statusCode,
      200,
      `Frontend route ${route} must return HTTP 200 (got ${res.statusCode})`
    );
    assert(
      typeof res.data === 'string' && res.data.includes('<html') || res.data.includes('<!DOCTYPE html>'),
      `Route ${route} must serve valid HTML bundle`
    );
  }
  console.log(`  ✔ All ${routesToTest.length} critical frontend routes served with HTTP 200 OK.`);

  // 3. Dedicated Product Authentication & Access Token Generation
  console.log('\n[STEP 3] Testing Scoped Product Authentication for Quant...');
  const testEmail = `quant_e2e_${Date.now()}@kepwe-test.com`;
  const otpReq = await request(`${backendBase}/api/auth/email-otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      email: testEmail,
      purpose: 'signup',
      name: 'E2E Quant Tester',
      mobile: `+91987${Date.now().toString().slice(-7)}`,
      product: 'quant',
    },
  });
  assert.strictEqual(otpReq.statusCode, 200, `OTP request must succeed (got ${otpReq.statusCode})`);
  assert(otpReq.data?.challengeId, 'Must return challengeId');

  const otpVerify = await request(`${backendBase}/api/auth/email-otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      email: testEmail,
      purpose: 'signup',
      challengeId: otpReq.data.challengeId,
      otp: otpReq.data.devOtp,
      product: 'quant',
    },
  });
  assert.strictEqual(otpVerify.statusCode, 200, 'OTP verify must succeed');
  const token = otpVerify.data?.accessToken;
  assert(token, 'Must return JWT accessToken');
  assert.deepStrictEqual(otpVerify.data?.user?.memberships, ['quant'], 'User must have ONLY quant product membership');
  console.log('  ✔ Quant user authenticated with scoped JWT access token.');

  // 4. Product-Level Isolation: Access Quant vs Rejection on Ledger
  console.log('\n[STEP 4] Verifying Product Authorization & Cross-Product Denial...');
  const quantAuthHeader = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const quantDash = await request(`${backendBase}/api/quant/dashboard`, { headers: quantAuthHeader });
  assert.strictEqual(quantDash.statusCode, 200, 'Quant user must access /api/quant/dashboard');
  assert.strictEqual(quantDash.data?.product, 'quant');

  const ledgerDenial = await request(`${backendBase}/api/ledger/dashboard`, { headers: quantAuthHeader });
  assert.strictEqual(ledgerDenial.statusCode, 403, 'Quant user must be DENIED from /api/ledger/dashboard');
  assert.strictEqual(ledgerDenial.data?.error, 'PRODUCT_ACCESS_DENIED');
  console.log('  ✔ Strict product isolation confirmed: Quant user accessed Quant (200) and was rejected from Ledger (403).');

  // 5. Quant Strategy Management API
  console.log('\n[STEP 5] Testing Strategy Creation & Versioning API...');
  const createStrat = await request(`${backendBase}/api/quant/strategies`, {
    method: 'POST',
    headers: quantAuthHeader,
    body: {
      name: 'NIFTY Pulse Trend Pro',
      instrument: 'NIFTY 50',
      direction: 'LONG_CE_PE',
      optionType: 'ATM',
      timeframe: '5m',
      confirmationTimeframe: '1m',
      lotSize: 2,
      orderType: 'MARKET',
      productType: 'MIS',
      tradingWindowStart: '09:25',
      tradingWindowEnd: '15:10',
      riskPerTradePct: 1.5,
      stopLossPct: 25.0,
      targetPct: 50.0,
      riskRewardRatio: 2.0,
      timeStopMinutes: 20,
      maxTradesPerDay: 3,
      maxConsecutiveLosses: 2,
      dailyDrawdownLimitPct: 10.0,
      status: 'DRAFT',
    },
  });
  assert.strictEqual(createStrat.statusCode, 201, `Strategy create must return 201 (got ${createStrat.statusCode})`);
  assert.strictEqual(createStrat.data?.strategy?.version, 'v1.0');
  const stratId = createStrat.data?.strategy?.id;
  assert(stratId, 'Must return created strategy ID');

  const listStrats = await request(`${backendBase}/api/quant/strategies`, { headers: quantAuthHeader });
  assert.strictEqual(listStrats.statusCode, 200);
  assert(listStrats.data?.strategies?.some((s) => s.id === stratId), 'Created strategy must be in list');
  console.log(`  ✔ Strategy created and versioned (ID: ${stratId}, v1.0).`);

  // 6. Quantitative Backtesting Engine Execution
  console.log('\n[STEP 6] Testing Truthful Backtesting Engine API...');
  const backtestRes = await request(`${backendBase}/api/quant/backtest`, {
    method: 'POST',
    headers: quantAuthHeader,
    body: {
      capital: 100000,
      riskPct: 1.0,
      optionType: 'ATM',
      lotSize: 1,
    },
  });
  assert.strictEqual(backtestRes.statusCode, 200, `Backtest must return 200 (got ${backtestRes.statusCode})`);
  assert(backtestRes.data?.metrics, 'Must return performance metrics');
  assert(typeof backtestRes.data?.metrics?.winRatePct === 'number', 'Win rate must be a number');
  assert(typeof backtestRes.data?.metrics?.netPnl === 'number', 'Net PnL must be a number');
  assert(Array.isArray(backtestRes.data?.equityCurve), 'Equity curve must be an array');
  console.log(`  ✔ Backtest executed truthfully: Net PnL ₹${backtestRes.data.metrics.netPnl}, Win Rate: ${backtestRes.data.metrics.winRatePct}%, Total Trades: ${backtestRes.data.metrics.totalTrades}.`);

  // 7. Paper Trading Sandbox API & Kill Switch
  console.log('\n[STEP 7] Testing Paper Trading Sandbox & Emergency Kill Switch...');
  const paperStart = await request(`${backendBase}/api/quant/paper/start`, {
    method: 'POST',
    headers: quantAuthHeader,
  });
  assert.strictEqual(paperStart.statusCode, 200);
  assert.strictEqual(paperStart.data?.status, 'ACTIVE');

  // Place paper simulated order
  const orderRes = await request(`${backendBase}/api/quant/paper/order`, {
    method: 'POST',
    headers: quantAuthHeader,
    body: {
      instrument: 'NIFTY 50 ATM CE',
      side: 'BUY',
      quantity: 25,
      price: 180,
      stopLoss: 135,
      target: 270,
    },
  });
  assert.strictEqual(orderRes.statusCode, 201, 'Paper order must be accepted and filled');

  // Check paper status has open position
  const paperStatus = await request(`${backendBase}/api/quant/paper/status`, { headers: quantAuthHeader });
  assert.strictEqual(paperStatus.statusCode, 200);
  assert.strictEqual(paperStatus.data?.status, 'ACTIVE');
  assert(paperStatus.data?.openPositions?.length >= 1, 'Must have at least 1 open paper position');

  // Trigger Kill Switch
  const killRes = await request(`${backendBase}/api/quant/kill-switch`, {
    method: 'POST',
    headers: quantAuthHeader,
  });
  assert.strictEqual(killRes.statusCode, 200);
  assert.strictEqual(killRes.data?.status, 'STOPPED');
  assert(killRes.data?.positionsFlattened >= 1, 'Positions must be flattened');
  console.log(`  ✔ Paper trading started, simulated order filled, and Kill Switch successfully flattened ${killRes.data.positionsFlattened} positions and halted execution.`);

  // 8. Live Deployment Gate Check
  console.log('\n[STEP 8] Testing Live Deployment Safety Gate Prerequisites...');
  const gateRes = await request(`${backendBase}/api/quant/deployment/validate`, {
    method: 'POST',
    headers: quantAuthHeader,
    body: {
      riskPerTradePct: 1.0,
      maxTradesPerDay: 3,
      maxConsecutiveLosses: 2,
    },
  });
  assert.strictEqual(gateRes.statusCode, 200);
  assert.strictEqual(gateRes.data?.isDeployable, false, 'Live execution MUST be blocked when real broker is not connected');
  assert(gateRes.data?.checks?.some((c) => c.key === 'BROKER_LIVE_CONNECTION' && !c.passed), 'Broker check must be blocked');
  console.log('  ✔ Live Execution Gate verified: Safely blocked without live broker connection.');

  // 9. Daily Risk Controller Status
  console.log('\n[STEP 9] Testing Daily Risk Controller Status...');
  const riskStatus = await request(`${backendBase}/api/quant/risk/status`, { headers: quantAuthHeader });
  assert.strictEqual(riskStatus.statusCode, 200);
  assert.strictEqual(riskStatus.data?.maxTradesPerDay, 3, 'Max trades per day must be 3');
  assert.strictEqual(riskStatus.data?.maxConsecutiveLosses, 2, 'Max consecutive losses must be 2');
  assert.strictEqual(riskStatus.data?.dailyHardDrawdownPct, 10.0, 'Daily hard drawdown limit must be 10%');
  console.log('  ✔ Daily Risk Controller limits verified: 3 trades/day cap, 2 consecutive loss halt, 10% drawdown hard stop.');

  console.log('\n================================================================');
  console.log('  ✅ ALL E2E REGRESSION & QUANT TESTS PASSED WITH 100% SUCCESS! ');
  console.log('================================================================\n');
}

runRegressionSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ E2E REGRESSION TEST FAILED:', err);
    process.exit(1);
  });
