#!/usr/bin/env node
// KEPWE Quant - LIVE verification of the Angel One SmartAPI integration.
//
// Runs the real AngelOneAdapter against Angel One's production API with YOUR
// credentials and checks every endpoint KEPWE Quant uses. Nothing is mocked.
// It needs no npm install (Node 18+ only) and prints no secrets.
//
// Usage (from the backend folder):
//   node scripts/angel-one-live-verify.mjs                 read-only checks
//   node scripts/angel-one-live-verify.mjs --negative      + invalid TOTP / invalid token checks
//   node scripts/angel-one-live-verify.mjs --order-test    + REAL order: place, status, modify, cancel
//   node scripts/angel-one-live-verify.mjs --keep-session  do not log out at the end
//
// Configuration (environment variables, or backend/.env, or <repo>/.env):
//   ANGEL_ONE_API_KEY        SmartAPI key of your app (smartapi.angelone.in)
//   ANGEL_ONE_CLIENT_CODE    Angel One client code
//   ANGEL_ONE_MPIN           Angel One MPIN
//   ANGEL_ONE_TOTP           current 6-digit TOTP   (or)
//   ANGEL_ONE_TOTP_SECRET    base32 TOTP secret shown when you enabled TOTP
//   ANGEL_ONE_STATIC_IP      static IP registered for the SmartAPI key (needed for --order-test)
//   ANGEL_ONE_TEST_SYMBOL    NSE cash symbol used by --order-test (default IDEA)
//
// --order-test places REAL orders in your account:
//   1. a 1-share LIMIT BUY priced below the lower circuit (Angel One / the exchange must reject it), and
//   2. a 1-share LIMIT BUY at the lower-circuit price (rests unfilled), which is modified and then cancelled.
//   If the stock is locked at its lower circuit, order 2 could trade (1 share). Run it only if you accept that.

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [resolve(here, '../.env'), resolve(here, '../../.env')]) {
  if (existsSync(candidate) && typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(candidate); } catch { /* unreadable .env: rely on the real environment */ }
  }
}

const { AngelOneAdapter, generateTotp } = await import('../src/algo/broker-adapters.js');
const { detectEgressIp, verifyAngelOneStaticIp } = await import('../src/services/static-ip.service.js');
const instruments = await import('../src/services/angel-one-instruments.service.js');
const { selectStrikesAroundSpot } = await import('../src/services/angel-one-option-chain.service.js');

const flags = new Set(process.argv.slice(2));
const env = (name) => String(process.env[name] || '').trim();
// Identifiers are never printed or written to the report in full.
function maskId(value) { const text = String(value || ''); return text.length > 3 ? `${text[0]}${'*'.repeat(text.length - 3)}${text.slice(-2)}` : '***'; }
const results = [];
const quietWarn = console.warn;
console.warn = () => {}; // adapter failure logs are summarised below instead

function record(step, endpoint, status, detail) {
  results.push({ step, endpoint, status, detail });
  const mark = { PASS: '✓', FAIL: '✗', SKIPPED: '-' }[status];
  console.log(`  ${mark} ${step.padEnd(34)} ${status.padEnd(7)} ${detail || ''}`);
}

async function check(step, endpoint, fn) {
  try {
    const detail = await fn();
    record(step, endpoint, 'PASS', detail);
    return true;
  } catch (error) {
    const code = [error.providerErrorCode, error.angelCategory, error.httpStatus && `HTTP ${error.httpStatus}`].filter(Boolean).join(' / ');
    record(step, endpoint, 'FAIL', `${error.message}${code ? ` [${code}]` : ''}`);
    return false;
  }
}

function expectRejection(step, endpoint, promise, expectedCategories) {
  return promise.then(
    () => record(step, endpoint, 'FAIL', 'Angel One accepted a request that must be rejected'),
    (error) => {
      const okCategory = expectedCategories.includes(error.angelCategory);
      record(step, endpoint, okCategory ? 'PASS' : 'FAIL', `rejected as ${error.angelCategory || error.code} (${error.providerErrorCode || 'no code'}: ${error.providerMessage || error.message})`);
    },
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function istNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return { minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday: get('weekday') };
}

function istDate(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offsetDays * 86400000));
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

console.log('\nKEPWE Quant - Angel One SmartAPI LIVE verification');
console.log('==================================================\n');

// ── 0. Configuration ─────────────────────────────────────────────────────────
console.log('[Configuration]');
const config = {
  apiKey: env('ANGEL_ONE_API_KEY'),
  clientCode: env('ANGEL_ONE_CLIENT_CODE').toUpperCase(),
  mpin: env('ANGEL_ONE_MPIN'),
  totp: env('ANGEL_ONE_TOTP') || env('ANGEL_ONE_TOTP_SECRET'),
};
const missing = Object.entries({ ANGEL_ONE_API_KEY: config.apiKey, ANGEL_ONE_CLIENT_CODE: config.clientCode, ANGEL_ONE_MPIN: config.mpin, 'ANGEL_ONE_TOTP or ANGEL_ONE_TOTP_SECRET': config.totp }).filter(([, value]) => !value).map(([name]) => name);
if (missing.length > 0) {
  record('Credentials present', 'environment', 'FAIL', `missing: ${missing.join(', ')}`);
  console.log('\nSet the missing values (see the header of this script) and run again.\n');
  process.exit(2);
}
record('Credentials present', 'environment', 'PASS', `client ${maskId(config.clientCode)}; TOTP source: ${env('ANGEL_ONE_TOTP') ? '6-digit code' : 'secret'}`);

let egressIp = null;
await check('Outbound IP detected', 'api.ipify.org', async () => {
  egressIp = (await detectEgressIp()).ip;
  return `this machine reaches the internet as ${egressIp}`;
});
const staticIp = await verifyAngelOneStaticIp({ force: true });
record('Static IP matches', 'ANGEL_ONE_STATIC_IP', staticIp.ready ? 'PASS' : (flags.has('--order-test') ? 'FAIL' : 'SKIPPED'), staticIp.reason);

// ── 1. Instruments ───────────────────────────────────────────────────────────
console.log('\n[Instruments]');
let master = null;
let nifty = null;
let chain = null;
await check('Instrument master download', 'OpenAPIScripMaster.json', async () => {
  master = await instruments.loadAngelInstrumentMaster({ force: true });
  return `${master.size} NSE/NFO instruments kept`;
});
if (master) {
  await check('NIFTY 50 index token', 'scrip master', async () => {
    nifty = instruments.resolveAngelIndexInstrument(master, 'NIFTY');
    return `${nifty.name} -> ${nifty.exchange}:${nifty.symbolToken}`;
  });
  await check('NIFTY option contracts', 'scrip master', async () => {
    chain = instruments.nearestOptionExpiryContracts(master, 'NIFTY');
    assert(chain.expiry && chain.contracts.length > 0, 'no current NIFTY option expiry in the master');
    return `expiry ${chain.expiry}, ${chain.contracts.length} contracts, lot size ${chain.contracts[0].lotSize}`;
  });
}

// ── 2. Authentication ────────────────────────────────────────────────────────
console.log('\n[Authentication / session]');
if (flags.has('--negative')) {
  const real = generateTotp(config.totp);
  const wrongTotp = String((Number(real) + 1) % 1000000).padStart(6, '0');
  await expectRejection('Invalid TOTP is rejected', 'loginByPassword', new AngelOneAdapter({ clientCode: config.clientCode, apiKey: config.apiKey }).login({ mpin: config.mpin, totp: wrongTotp }), ['INVALID_CREDENTIALS']);
  await sleep(1100);
}
const adapter = new AngelOneAdapter({ clientCode: config.clientCode, apiKey: config.apiKey });
const loggedIn = await check('Login (client code + MPIN + TOTP)', 'loginByPassword', async () => {
  const result = await adapter.login({ mpin: config.mpin, totp: config.totp });
  assert(adapter.session.jwtToken && adapter.session.refreshToken, 'login did not return jwtToken + refreshToken');
  return `session issued; JWT expiry ${result.tokenExpiresAt ? result.tokenExpiresAt.toISOString() : 'not present in token'}; feed token ${result.feedTokenAvailable ? 'present' : 'absent'}`;
});
if (!loggedIn) {
  console.log('\nLogin failed, so no authenticated endpoint can be verified. Fix the credentials and run again.\n');
  finish();
}

// ── 3. Account ───────────────────────────────────────────────────────────────
console.log('\n[Account]');
await check('Profile + identity', 'getProfile', async () => {
  const profile = await adapter.getProfile();
  assert(profile.clientCode === config.clientCode, 'the profile client code does not match ANGEL_ONE_CLIENT_CODE');
  return `${profile.name || 'name not returned'}; exchanges ${profile.exchanges.join(',') || 'none'}`;
});
await check('Funds / margin', 'getRMS', async () => {
  const funds = await adapter.getMargin();
  assert(Number.isFinite(funds.available), 'availablecash missing');
  return `available ${funds.available}, net ${funds.net}, utilised ${funds.utilized}`;
});
await check('Holdings', 'getHolding', async () => `${(await adapter.getHoldings()).length} holding(s)`);
await check('Portfolio totals', 'getAllHolding', async () => {
  const portfolio = await adapter.getPortfolio();
  return `holding value ${portfolio.totalHoldingValue}, invested ${portfolio.totalInvestedValue}, P&L ${portfolio.totalPnl}`;
});
await check('Positions', 'getPosition', async () => {
  const positions = await adapter.getPositions();
  return `${positions.length} position row(s), ${positions.filter((position) => position.quantity > 0).length} open`;
});
await check('Order history (order book)', 'getOrderBook', async () => `${(await adapter.getOrderBook({ fresh: true })).length} order(s) today`);
await check('Trade book', 'getTradeBook', async () => `${(await adapter.getTradeBook()).length} trade(s) today`);

// ── 4. Market data ───────────────────────────────────────────────────────────
console.log('\n[Market data]');
let niftyQuote = null;
if (nifty) {
  await check('NIFTY 50 quote', 'market/v1/quote', async () => {
    niftyQuote = await adapter.getQuote({ exchange: nifty.exchange, symbolToken: nifty.symbolToken, mode: 'FULL' });
    assert(niftyQuote?.ltp > 0, 'no LTP returned');
    const ageSeconds = niftyQuote.lastUpdateTime ? Math.round((Date.now() - Date.parse(niftyQuote.lastUpdateTime)) / 1000) : null;
    return `LTP ${niftyQuote.ltp}; exchange time ${niftyQuote.lastUpdateTime || 'not returned'}${ageSeconds === null ? '' : ` (${ageSeconds}s old${ageSeconds > 90 ? ' - market closed or delayed, feed would show STALE' : ''})`}`;
  });
  await check('NIFTY 5-minute candles', 'getCandleData', async () => {
    const candles = await adapter.getHistoricalData({ exchange: nifty.exchange, symbolToken: nifty.symbolToken, interval: '5m', fromDate: `${istDate(-7)} 09:15`, toDate: new Date() });
    assert(candles.length > 0, 'no candles returned');
    return `${candles.length} candles, last ${candles.at(-1).timestamp} close ${candles.at(-1).close}, volume ${candles.at(-1).volume}`;
  });
  await check('NIFTY 1-minute candles', 'getCandleData', async () => {
    const candles = await adapter.getHistoricalData({ exchange: nifty.exchange, symbolToken: nifty.symbolToken, interval: '1m', fromDate: `${istDate(-4)} 09:15`, toDate: new Date() });
    assert(candles.length > 0, 'no candles returned');
    return `${candles.length} candles, last ${candles.at(-1).timestamp}`;
  });
}
if (chain?.contracts?.length && niftyQuote?.ltp) {
  const nearby = selectStrikesAroundSpot(chain.contracts, niftyQuote.ltp, 12);
  await check('Option chain quotes (50 tokens)', 'market/v1/quote', async () => {
    const { fetched, unfetched } = await adapter.getQuotes({ mode: 'FULL', exchangeTokens: { NFO: nearby.map((contract) => contract.symbolToken) } });
    assert(fetched.length > 0, `no option quote returned (${unfetched.length} unfetched)`);
    const twoSided = fetched.filter((quote) => quote.bid > 0 && quote.ask > 0).length;
    return `${fetched.length}/${nearby.length} quotes, ${twoSided} with bid and ask, ${unfetched.length} unfetched`;
  });
  await check('Option greeks (delta)', 'optionGreek', async () => {
    const greeks = await adapter.getOptionGreeks({ name: 'NIFTY', expiry: chain.expiryRaw });
    assert(greeks.length > 0, 'no greeks returned (Angel One serves them during market hours)');
    return `${greeks.length} rows for ${chain.expiryRaw}`;
  });
}

// ── 5. Session refresh ───────────────────────────────────────────────────────
console.log('\n[Refresh / session handling]');
await check('Token refresh', 'generateTokens', async () => {
  const before = adapter.session.jwtToken;
  await adapter.refreshSession();
  assert(adapter.session.jwtToken && adapter.session.jwtToken !== before, 'generateTokens did not return a new JWT');
  const profile = await adapter.getProfile();
  assert(profile.clientCode === config.clientCode, 'the renewed session is not accepted');
  return `new JWT accepted by getProfile; refresh token ${adapter.session.refreshToken ? 'rotated/kept' : 'missing'}`;
});
if (flags.has('--negative')) {
  await expectRejection('Invalid token is rejected', 'getProfile', new AngelOneAdapter({ clientCode: config.clientCode, apiKey: config.apiKey, jwtToken: `${adapter.session.jwtToken.slice(0, -6)}AAAAAA` }).getProfile(), ['SESSION_EXPIRED']);
  await expectRejection('Invalid API key is rejected', 'getProfile', new AngelOneAdapter({ clientCode: config.clientCode, apiKey: 'invalid-key', jwtToken: adapter.session.jwtToken }).getProfile(), ['INVALID_API_KEY', 'SESSION_EXPIRED']);
}

// ── 6. Orders (opt-in, REAL) ─────────────────────────────────────────────────
console.log('\n[Orders]');
if (!flags.has('--order-test')) {
  record('Order place / modify / cancel', 'placeOrder', 'SKIPPED', 'run with --order-test to place and cancel a real 1-share order');
} else if (!staticIp.ready) {
  record('Order place / modify / cancel', 'placeOrder', 'FAIL', `blocked before sending: ${staticIp.reason}`);
} else if (master) {
  const symbol = env('ANGEL_ONE_TEST_SYMBOL') || 'IDEA';
  let target = null;
  let quote = null;
  await check('Test instrument resolved', 'scrip master + quote', async () => {
    target = instruments.resolveAngelSymbol(master, symbol, 'NSE');
    quote = await adapter.getQuote({ exchange: 'NSE', symbolToken: target.symbolToken, mode: 'FULL' });
    assert(quote?.lowerCircuit > 0, 'quote has no lower circuit price');
    return `${target.tradingSymbol} LTP ${quote.ltp}, lower circuit ${quote.lowerCircuit}`;
  });
  if (target && quote) {
    const { minutes, weekday } = istNowMinutes();
    const marketOpen = !['Sat', 'Sun'].includes(weekday) && minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 30;
    const metadata = { symbolToken: target.symbolToken, tradingSymbol: target.tradingSymbol, exchange: 'NSE', productType: 'DELIVERY', orderType: 'LIMIT', variety: marketOpen ? 'NORMAL' : 'AMO' };
    const tick = 0.05;
    const round = (price) => Number((Math.round(price / tick) * tick).toFixed(2));

    // 6a. An order Angel One / the exchange must refuse (price below the lower circuit).
    await check('Order failure is reported', 'placeOrder', async () => {
      const badPrice = round(Math.max(tick, quote.lowerCircuit * 0.5));
      try {
        const placed = await adapter.placeOrder({ internalOrderId: `KPBAD${Date.now()}`, side: 'BUY', quantity: 1, price: badPrice, metadata });
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await sleep(1200);
          const status = await adapter.getOrderStatus({ brokerOrderId: placed.brokerOrderId });
          if (status.status === 'REJECTED') return `order ${placed.brokerOrderId} rejected by Angel One: ${status.rejectionReason || status.brokerStatus}`;
          if (status.status === 'FILLED') throw new Error(`order ${placed.brokerOrderId} unexpectedly FILLED`);
        }
        await adapter.cancelOrder({ brokerOrderId: placed.brokerOrderId, metadata }).catch(() => {});
        throw new Error(`order ${placed.brokerOrderId} at ${badPrice} was not rejected (cancelled it)`);
      } catch (error) {
        if (error.name === 'BrokerApiError' && ['ORDER_REJECTED', 'REQUEST_ERROR'].includes(error.angelCategory)) {
          return `refused synchronously: ${error.providerErrorCode || ''} ${error.providerMessage || error.message}`;
        }
        throw error;
      }
    });

    // 6b. A resting order: place -> status -> modify -> cancel.
    let placed = null;
    const restingPrice = round(quote.lowerCircuit);
    await check('Order placement', 'placeOrder', async () => {
      placed = await adapter.placeOrder({ internalOrderId: `KPTEST${Date.now()}`, side: 'BUY', quantity: 1, price: restingPrice, metadata });
      return `order ${placed.brokerOrderId} (${metadata.variety}) BUY 1 ${target.tradingSymbol} @ ${restingPrice}`;
    });
    if (placed) {
      await sleep(1200);
      await check('Order status', 'getOrderBook', async () => {
        const status = await adapter.getOrderStatus({ brokerOrderId: placed.brokerOrderId });
        assert(['SUBMITTED', 'PARTIALLY_FILLED', 'FILLED'].includes(status.status), `unexpected status ${status.status}: ${status.rejectionReason || status.brokerStatus}`);
        return `${status.status} (Angel One: "${status.brokerStatus}")`;
      });
      if (placed.uniqueOrderId) {
        await check('Order details', 'order/v1/details', async () => `status ${(await adapter.getOrderLog(placed.uniqueOrderId)).status}`);
      }
      await check('Order modification', 'modifyOrder', async () => {
        const newPrice = round(restingPrice + tick);
        await adapter.modifyOrder({ brokerOrderId: placed.brokerOrderId, side: 'BUY', quantity: 1, price: newPrice, metadata });
        return `price changed to ${newPrice}`;
      });
      await sleep(1200);
      await check('Order cancellation', 'cancelOrder', async () => {
        await adapter.cancelOrder({ brokerOrderId: placed.brokerOrderId, metadata });
        await sleep(1500);
        const status = await adapter.getOrderStatus({ brokerOrderId: placed.brokerOrderId });
        assert(status.status === 'CANCELLED', `order is ${status.status} ("${status.brokerStatus}") after cancel - CHECK YOUR ANGEL ONE ORDER BOOK`);
        return `order ${placed.brokerOrderId} is CANCELLED`;
      });
    }
  }
}

// ── 7. Logout ────────────────────────────────────────────────────────────────
console.log('\n[Logout / disconnect]');
if (flags.has('--keep-session')) {
  record('Logout', 'logout', 'SKIPPED', '--keep-session');
} else {
  const jwt = adapter.session?.jwtToken;
  await check('Logout', 'logout', async () => {
    const result = await adapter.logout();
    assert(result.loggedOut, 'logout was not confirmed');
    return 'session terminated at Angel One';
  });
  if (jwt) {
    await expectRejection('Old token no longer works', 'getProfile', new AngelOneAdapter({ clientCode: config.clientCode, apiKey: config.apiKey, jwtToken: jwt }).getProfile(), ['SESSION_EXPIRED']);
  }
}

finish();

function finish() {
  console.warn = quietWarn;
  const count = (status) => results.filter((result) => result.status === status).length;
  console.log('\n==================================================');
  console.log(`PASS ${count('PASS')}   FAIL ${count('FAIL')}   SKIPPED ${count('SKIPPED')}`);
  const reportPath = resolve(here, '../angel-one-live-verify-report.json');
  try {
    writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), clientCode: maskId(env('ANGEL_ONE_CLIENT_CODE').toUpperCase()), flags: [...flags], summary: { pass: count('PASS'), fail: count('FAIL'), skipped: count('SKIPPED') }, results }, null, 2));
    console.log(`Report written to ${reportPath} (contains no MPIN, TOTP, API key or tokens).`);
  } catch (error) {
    console.log(`Could not write the report file: ${error.message}`);
  }
  console.log(count('FAIL') === 0 ? '\nAll executed checks passed against the live Angel One API.\n' : '\nSome checks FAILED. The integration is NOT verified until they pass.\n');
  process.exit(count('FAIL') === 0 ? 0 : 1);
}
