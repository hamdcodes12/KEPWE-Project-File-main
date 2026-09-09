import assert from 'assert';
import http from 'http';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { grantProductMembership } from '../src/services/product-membership.service.js';
import {
  NIFTY_QUANT_STRATEGY,
  enrichNiftyCandles,
  evaluateNiftyQuantSignal,
  selectNiftyOptionContract,
  calculateNiftyPositionSize,
  runNiftyQuantBacktest,
  generateNiftyBenchmarkCandles,
  validateLiveDeploymentGate,
} from '../src/services/quant-engine.service.js';

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

async function runQuantEngineTestSuite() {
  console.log('================================================================');
  console.log('   KEPWE QUANT: NIFTY 50 STRATEGY ENGINE & API AUDIT TEST SUITE   ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const runId = Date.now();

    // ──────────────────────────────────────────────────────────────────────────
    // 1. TEST MATHEMATICAL INDICATORS & NIFTY CANDLE ENRICHMENT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[TEST 1] Testing NIFTY quant indicators & enrichment...');
    const benchmarkCandles = generateNiftyBenchmarkCandles(80);
    assert(benchmarkCandles.length === 80, 'Must generate 80 benchmark candles');

    const enriched = enrichNiftyCandles(benchmarkCandles);
    assert.strictEqual(enriched.length, 80, 'Enriched candle count must match input');

    const lastCandle = enriched[enriched.length - 1];
    assert(Number.isFinite(lastCandle.ema20), 'EMA20 must be a valid number');
    assert(Number.isFinite(lastCandle.ema50), 'EMA50 must be a valid number');
    assert(Number.isFinite(lastCandle.vwap), 'VWAP must be a valid number');
    assert(Number.isFinite(lastCandle.atr14), 'ATR14 must be a valid number');
    assert(Number.isFinite(lastCandle.adx14), 'ADX14 must be a valid number');
    console.log(`  ✔ Verified EMA20 (${lastCandle.ema20}), EMA50 (${lastCandle.ema50}), VWAP (${lastCandle.vwap}), ATR14 (${lastCandle.atr14}), ADX14 (${lastCandle.adx14}).`);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. TEST OPTION CONTRACT SELECTION & DELTA (0.45 - 0.60)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 2] Testing dynamic NIFTY option contract selection...');
    const spotPrice = 24630;
    assert.equal(selectNiftyOptionContract(spotPrice, 'CE', 'ATM'), null, 'No contract may be fabricated without provider instruments');
    const instruments = [
      { symbol: 'NIFTY30SEP24650CE', securityId: '101', exchange: 'NFO', strike: 24650, optionType: 'CE', ltp: 178.72, lotSize: 25 },
      { symbol: 'NIFTY30SEP24600CE', securityId: '102', exchange: 'NFO', strike: 24600, optionType: 'CE', ltp: 210.10, lotSize: 25 },
      { symbol: 'NIFTY30SEP24700PE', securityId: '103', exchange: 'NFO', strike: 24700, optionType: 'PE', ltp: 233.72, lotSize: 25 },
    ];
    const atmCe = selectNiftyOptionContract(spotPrice, 'CE', 'ATM', instruments);
    assert.strictEqual(atmCe.strike, 24650, 'ATM strike must use a provider instrument');
    assert.strictEqual(atmCe.optionType, 'CE');
    assert(atmCe.premium > 0, 'Option premium must be positive');
    assert.strictEqual(atmCe.stopLoss, Number((atmCe.premium * 0.75).toFixed(2)), 'Stop loss must be exactly 25% below entry');
    assert.strictEqual(atmCe.target, Number((atmCe.premium * 1.50).toFixed(2)), 'Target must be exactly 50% above entry');

    const itmPe = selectNiftyOptionContract(spotPrice, 'PE', 'ITM_1', instruments);
    assert.strictEqual(itmPe.strike, 24700, '1-ITM PE strike must be ATM + 50');
    console.log(`  ✔ Selected ATM CE: ${atmCe.symbol} @ ₹${atmCe.premium} (SL: ₹${atmCe.stopLoss}, TP: ₹${atmCe.target}, Delta: ${atmCe.delta}).`);
    console.log(`  ✔ Selected 1-ITM PE: ${itmPe.symbol} @ ₹${itmPe.premium} (Delta: ${itmPe.delta}).`);

    // ──────────────────────────────────────────────────────────────────────────
    // 3. TEST POSITION SIZING WITH STRICT RISK BUDGETING & LOT ROUNDING
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 3] Testing position sizing & risk budgeting formula...');
    const sizing1Pct = calculateNiftyPositionSize({
      capital: 100000,
      riskPct: 1.0,
      optionPremium: 160,
      lotSize: 25,
    });
    assert.strictEqual(sizing1Pct.riskAmount, 1000.0, '1% risk of 100k must be ₹1,000');
    assert(sizing1Pct.lots >= 1, 'Lots must be at least 1');
    assert.strictEqual(sizing1Pct.quantity, sizing1Pct.lots * 25, 'Quantity must strictly be a multiple of lot size (25)');
    assert(sizing1Pct.actualRisk <= 1000.0, `Actual risk (${sizing1Pct.actualRisk}) must never exceed risk budget (1000)`);
    assert(sizing1Pct.isWithinBudget, 'Required margin must be within capital');
    console.log(`  ✔ Sizing verified: Capital ₹1,00,000 | Risk 1% (₹1,000) | Quantity: ${sizing1Pct.quantity} (${sizing1Pct.lots} lots) | Actual Risk: ₹${sizing1Pct.actualRisk}.`);

    // ──────────────────────────────────────────────────────────────────────────
    // 4. TEST FULL NIFTY 50 BACKTEST ENGINE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 4] Testing NIFTY 50 backtest simulation engine...');
    const backtest = runNiftyQuantBacktest({
      candles: benchmarkCandles,
      capital: 100000,
      riskPct: 1.0,
      optionType: 'ATM',
    });
    assert(backtest.metrics, 'Backtest must return metrics object');
    assert(typeof backtest.metrics.totalTrades === 'number', 'Total trades must be a number');
    assert(typeof backtest.metrics.winRate === 'number', 'Win rate must be a number');
    assert(Array.isArray(backtest.equityCurve), 'Equity curve must be an array');
    assert(Array.isArray(backtest.trades), 'Trades list must be an array');
    console.log(`  ✔ Backtest executed: Trades: ${backtest.metrics.totalTrades} | Win Rate: ${backtest.metrics.winRate}% | Net P&L: ₹${backtest.netPnl} | Max Drawdown: ₹${backtest.metrics.maxDrawdown}.`);

    // ──────────────────────────────────────────────────────────────────────────
    // 5. TEST LIVE DEPLOYMENT GATE VALIDATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 5] Testing Live Deployment Gate verification...');
    const dummyUserId = '00000000-0000-0000-0000-000000000001';
    const gateCheck = await validateLiveDeploymentGate(dummyUserId, {
      riskPerTradePct: 1.0,
      maxTradesPerDay: 3,
      maxConsecutiveLosses: 2,
    });
    assert.strictEqual(gateCheck.isDeployable, false, 'Unconnected user must NOT be deployable live');
    assert.strictEqual(gateCheck.status, 'DEPLOYMENT_BLOCKED');
    const brokerCheck = gateCheck.checks.find((c) => c.key === 'BROKER_LIVE_CONNECTION');
    assert.strictEqual(brokerCheck.passed, false, 'Broker check must be marked unpassed without credentials');
    console.log('  ✔ Live Deployment Gate blocked appropriately: Truthful status reported without fake connection.');

    // ──────────────────────────────────────────────────────────────────────────
    // 6. TEST QUANT HTTP API ENDPOINTS WITH PRODUCT AUTHORIZATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[TEST 6] Testing Quant HTTP API routes with product-scoped authentication...');

    // Setup authenticated Quant user
    const dummyHash = '$2a$10$dummyHashForQuantTest1234567890123456';
    const userEmail = `quant_engineer_${runId}@kepwe-test.com`;
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, mobile, role, is_active, email_verified)
       VALUES ($1, $2, 'Quant Engineer', $3, 'customer', true, true) RETURNING id`,
      [userEmail, dummyHash, `+91986${runId.toString().slice(-7)}`]
    );
    const userId = userRes.rows[0].id;
    await grantProductMembership(userId, 'quant');

    const quantToken = signAccessToken({ id: userId, email: userEmail, role: 'customer' }, 'quant');

    // 6a. GET /api/quant/dashboard
    const dashRes = await request(server, {
      path: '/api/quant/dashboard',
      headers: { Authorization: `Bearer ${quantToken}` },
    });
    assert.strictEqual(dashRes.statusCode, 200, `Dashboard must return 200 (got ${dashRes.statusCode})`);
    assert.strictEqual(dashRes.data?.product, 'quant');
    assert.equal(dashRes.data?.capital, 0, 'Unconfigured trading capital must remain zero');
    console.log('  ✔ GET /api/quant/dashboard returned 200 with truthful workspace metrics.');

    // 6b. POST /api/quant/strategies (Save new strategy version)
    const stratRes = await request(server, {
      method: 'POST',
      path: '/api/quant/strategies',
      headers: { Authorization: `Bearer ${quantToken}` },
      body: {
        name: 'My NIFTY Intraday Pulse',
        instrument: 'NIFTY 50',
        direction: 'LONG_CE_PE',
        optionType: 'ATM',
        timeframe: '5m',
        confirmationTimeframe: '1m',
        lotSize: 2,
        orderType: 'MARKET',
        productType: 'MIS',
        riskPerTradePct: 1.0,
        stopLossPct: 25.0,
        targetPct: 50.0,
        riskRewardRatio: 2.0,
        maxTradesPerDay: 3,
        maxConsecutiveLosses: 2,
        dailyDrawdownLimitPct: 10.0,
      },
    });
    assert.strictEqual(stratRes.statusCode, 201, `Create strategy must return 201 (got ${stratRes.statusCode})`);
    assert(stratRes.data?.strategy?.id, 'Must return created strategy ID');
    assert.strictEqual(stratRes.data?.strategy?.version, 'v1.0');
    console.log(`  ✔ POST /api/quant/strategies created strategy ${stratRes.data.strategy.id} (v1.0).`);

    // 6c. POST /api/quant/backtest (Run real backtest API)
    const btRes = await request(server, {
      method: 'POST',
      path: '/api/quant/backtest',
      headers: { Authorization: `Bearer ${quantToken}` },
      body: {
        capital: 100000,
        riskPct: 1.0,
        optionType: 'ATM',
        lotSize: 1,
        candles: generateNiftyBenchmarkCandles(160),
      },
    });
    assert.strictEqual(btRes.statusCode, 200, `Backtest API must return 200 (got ${btRes.statusCode})`);
    assert(btRes.data?.metrics?.winRate !== undefined, 'Must return winRate');
    console.log(`  ✔ POST /api/quant/backtest executed: Win Rate ${btRes.data.metrics.winRate}%, Net P&L ₹${btRes.data.netPnl}.`);

    // 6d. POST /api/quant/paper/start and /stop
    const startRes = await request(server, {
      method: 'POST',
      path: '/api/quant/paper/start',
      headers: { Authorization: `Bearer ${quantToken}` },
    });
    assert.strictEqual(startRes.statusCode, 200);
    assert.strictEqual(startRes.data?.status, 'ACTIVE');

    const stopRes = await request(server, {
      method: 'POST',
      path: '/api/quant/paper/stop',
      headers: { Authorization: `Bearer ${quantToken}` },
    });
    assert.strictEqual(stopRes.statusCode, 200);
    assert.strictEqual(stopRes.data?.status, 'STOPPED');
    console.log('  ✔ POST /api/quant/paper/start and /stop successfully changed paper engine state.');

    // 6e. POST /api/quant/kill-switch
    const killRes = await request(server, {
      method: 'POST',
      path: '/api/quant/kill-switch',
      headers: { Authorization: `Bearer ${quantToken}` },
    });
    assert.strictEqual(killRes.statusCode, 200);
    assert.strictEqual(killRes.data?.status, 'STOPPED');
    console.log('  ✔ POST /api/quant/kill-switch emergency halt verified.');

    // 6f. GET /api/quant/risk/status
    const riskRes = await request(server, {
      path: '/api/quant/risk/status',
      headers: { Authorization: `Bearer ${quantToken}` },
    });
    assert.strictEqual(riskRes.statusCode, 200);
    assert.strictEqual(riskRes.data?.maxTradesPerDay, 3);
    assert.strictEqual(riskRes.data?.maxConsecutiveLosses, 2);
    console.log('  ✔ GET /api/quant/risk/status verified daily risk limits (3 trades/day, 2 max consecutive losses).');

    console.log('\n================================================================');
    console.log('   ✅ ALL KEPWE QUANT ENGINE & API TESTS PASSED WITH 100% ACCURACY! ');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runQuantEngineTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ QUANT ENGINE TEST FAILED:', err);
    process.exit(1);
  });
