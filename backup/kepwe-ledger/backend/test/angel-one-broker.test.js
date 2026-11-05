// Angel One SmartAPI adapter tests.
//
// The real AngelOneAdapter is exercised over real HTTP against a local server
// that implements the documented SmartAPI wire format (test/support). These
// tests verify KEPWE's request building, response normalization, session
// handling, retries and error classification. They do NOT prove behaviour of
// Angel One's production API; use scripts/angel-one-live-verify.mjs for that.

import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import {
  AngelOneAdapter,
  ANGEL_ONE,
  SUPPORTED_BROKERS,
  angelOrderTag,
  classifyAngelOneError,
  formatAngelCandleTime,
  generateTotp,
  getBrokerAdapter,
  getBrokerReadiness,
  mapAngelOrderStatus,
  normalizeAngelInterval,
  normalizeBrokerExecution,
  parseAngelDateTime,
  resetAngelOneRateGates,
} from '../src/algo/broker-adapters.js';
import { clearStaticIpVerificationCache, getStaticIpReadiness, verifyAngelOneStaticIp } from '../src/services/static-ip.service.js';
import { startMockSmartApi, stubEgressIp } from './support/mock-smartapi-server.js';

const STATIC_IP = '203.0.113.10';
let api;
let restoreFetch;
const savedEnv = {};
const ENV = {
  ANGEL_ONE_API_KEY: 'test-api-key',
  ANGEL_ONE_STATIC_IP: STATIC_IP,
  ANGEL_ONE_DISABLE_RATE_GATE: 'true',
  ANGEL_ONE_READ_RETRY_DELAYS_MS: '5,5',
  ANGEL_ONE_TIMEOUT_MS: '400',
};

const NIFTY_OPTION = { symbolToken: '43854', tradingSymbol: 'NIFTY08OCT2625000CE', exchange: 'NFO', lotSize: 75, productType: 'INTRADAY', orderType: 'MARKET' };

before(async () => {
  for (const [key, value] of Object.entries(ENV)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
  // Keep adapter failure logs out of the test output.
  console.warn = () => {};
});

beforeEach(async () => {
  if (restoreFetch) restoreFetch();
  if (api) await api.close();
  api = await startMockSmartApi({
    quotes: {
      'NSE:99926000': { tradingSymbol: 'Nifty 50', ltp: 25012.35, open: 24950, high: 25040, low: 24920, close: 24980.1, netChange: 32.25, percentChange: 0.13, tradeVolume: 0, exchFeedTime: '07-Oct-2026 10:15:30', exchTradeTime: '07-Oct-2026 10:15:29', depth: { buy: [], sell: [] } },
      'NFO:43854': { tradingSymbol: 'NIFTY08OCT2625000CE', ltp: 120.5, open: 110, high: 130, low: 105, close: 112, netChange: 8.5, percentChange: 7.6, tradeVolume: 912000, opnInterest: 5400000, exchFeedTime: '07-Oct-2026 10:15:30', exchTradeTime: '07-Oct-2026 10:15:30', depth: { buy: [{ price: 120.4, quantity: 750, orders: 4 }], sell: [{ price: 120.6, quantity: 900, orders: 5 }] } },
    },
    candles: [
      ['2026-10-07T09:15:00+05:30', 24950, 24990, 24940, 24985, 0],
      ['2026-10-07T09:20:00+05:30', 24985, 25010, 24980, 25005, 0],
    ],
    greeks: [{ name: 'NIFTY', expiry: '08OCT2026', strikePrice: '25000.000000', optionType: 'CE', delta: '0.5210', gamma: '0.0009', theta: '-14.2', vega: '9.1', impliedVolatility: '11.9', tradeVolume: '912000' }],
    positions: [{ exchange: 'NFO', symboltoken: '43854', producttype: 'INTRADAY', tradingsymbol: 'NIFTY08OCT2625000CE', lotsize: '75', buyqty: '150', sellqty: '0', netqty: '150', buyavgprice: '118.00', sellavgprice: '0', avgnetprice: '118.00', ltp: '120.50', realised: '0.00', unrealised: '375.00', pnl: '375.00' }],
    holdings: [{ tradingsymbol: 'RELIANCE-EQ', exchange: 'NSE', isin: 'INE002A01018', t1quantity: 0, realisedquantity: 10, quantity: 10, product: 'DELIVERY', averageprice: 1400, ltp: 1450.5, symboltoken: '2885', profitandloss: 505, pnlpercentage: 3.61 }],
  });
  process.env.ANGEL_ONE_BASE_URL = api.baseUrl;
  restoreFetch = stubEgressIp(STATIC_IP);
  clearStaticIpVerificationCache();
  resetAngelOneRateGates();
});

after(async () => {
  if (restoreFetch) restoreFetch();
  if (api) await api.close();
  delete process.env.ANGEL_ONE_BASE_URL;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function loggedIn(options = {}) {
  const adapter = new AngelOneAdapter({ clientCode: 'A123456', ...options });
  await adapter.login({ mpin: '4321', totp: '123456' });
  return adapter;
}

// ── Broker registry ──────────────────────────────────────────────────────────
test('Angel One is the only supported broker', () => {
  assert.deepEqual([...SUPPORTED_BROKERS], ['ANGEL_ONE']);
  assert.equal(getBrokerAdapter('ANGEL_ONE', 'LIVE') instanceof AngelOneAdapter, true);
  for (const removed of ['DHAN', 'PAPER', 'ZERODHA', 'angel_one', '']) {
    assert.throws(() => getBrokerAdapter(removed, 'LIVE'), /Unsupported broker/);
  }
  assert.throws(() => getBrokerAdapter('ANGEL_ONE', 'PAPER'), /Only LIVE/);
  const readiness = getBrokerReadiness('ANGEL_ONE', 'LIVE');
  assert.equal(readiness.broker, ANGEL_ONE);
  assert.equal(readiness.capabilities.orderPlacement, true);
  assert.equal(JSON.stringify(readiness).includes('test-api-key'), false, 'readiness must not leak the API key');
});

// ── Pure helpers ─────────────────────────────────────────────────────────────
test('TOTP matches the RFC 6238 SHA-1 test vector and passes 6-digit codes through', () => {
  // RFC 6238 Appendix B: secret "12345678901234567890", T = 59 s -> 94287082 (6 digits: 287082)
  assert.equal(generateTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000), '287082');
  assert.equal(generateTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 1111111109_000), '081804');
  assert.equal(generateTotp('654321'), '654321');
  assert.throws(() => generateTotp('not base32 !!'), /TOTP must be/);
});

test('SmartAPI timestamps, intervals, order status and tags are normalized', () => {
  assert.equal(parseAngelDateTime('07-Oct-2026 10:15:30').toISOString(), '2026-10-07T04:45:30.000Z');
  assert.equal(parseAngelDateTime('2026-10-07T09:15:00+05:30').toISOString(), '2026-10-07T03:45:00.000Z');
  assert.equal(parseAngelDateTime('01-Jan-1980 00:00:00'), null);
  assert.equal(parseAngelDateTime(''), null);
  assert.equal(formatAngelCandleTime('2026-10-07', '09:15'), '2026-10-07 09:15');
  assert.equal(formatAngelCandleTime(new Date('2026-10-07T04:45:00.000Z')), '2026-10-07 10:15');
  assert.equal(normalizeAngelInterval('5m'), 'FIVE_MINUTE');
  assert.equal(normalizeAngelInterval(1), 'ONE_MINUTE');
  assert.equal(normalizeAngelInterval('2m'), null);
  assert.equal(mapAngelOrderStatus('complete'), 'FILLED');
  assert.equal(mapAngelOrderStatus('rejected'), 'REJECTED');
  assert.equal(mapAngelOrderStatus('cancelled'), 'CANCELLED');
  assert.equal(mapAngelOrderStatus('open'), 'SUBMITTED');
  assert.equal(mapAngelOrderStatus('trigger pending'), 'SUBMITTED');
  assert.equal(mapAngelOrderStatus('open', { filledQuantity: 75, quantity: 150 }), 'PARTIALLY_FILLED');
  assert.equal(angelOrderTag('3f2b8c1e-9a4d-4e7f-b1a2-0c9d8e7f6a5b'), '3f2b8c1e9a4d4e7fb1a2');
  const execution = normalizeBrokerExecution({ orderid: '1', orderstatus: 'rejected', status: 'rejected', text: 'RMS:Margin Exceeds', quantity: '75', filledshares: '0', unfilledshares: '75', averageprice: 0 });
  assert.equal(execution.status, 'REJECTED');
  assert.equal(execution.rejectionReason, 'RMS:Margin Exceeds');
  assert.equal(execution.averagePrice, null, 'a zero average price is never reported as a fill price');
});

test('SmartAPI error codes are classified', () => {
  const classify = (providerErrorCode, extra = {}, options) => classifyAngelOneError({ providerErrorCode, ...extra }, options);
  assert.equal(classify('AG8002'), 'SESSION_EXPIRED');
  assert.equal(classify('AG8001'), 'SESSION_EXPIRED');
  assert.equal(classify('AB1010'), 'SESSION_EXPIRED');
  assert.equal(classify('AB8050'), 'SESSION_EXPIRED');
  assert.equal(classify('AG8001', {}, { login: true }), 'INVALID_CREDENTIALS');
  assert.equal(classify('AB1050'), 'INVALID_CREDENTIALS');
  assert.equal(classify('AB7001'), 'INVALID_CREDENTIALS');
  assert.equal(classify('AG8004'), 'INVALID_API_KEY');
  assert.equal(classify('AB1053'), 'INVALID_API_KEY');
  assert.equal(classify('AB1006'), 'ACCOUNT_BLOCKED');
  assert.equal(classify('AB1013'), 'NOT_FOUND');
  assert.equal(classify('AB1012'), 'ORDER_REJECTED');
  assert.equal(classify('AB2001'), 'UPSTREAM_ERROR');
  assert.equal(classify(null, { httpStatus: 403, providerMessage: 'Access denied because of exceeding access rate' }), 'RATE_LIMITED');
  assert.equal(classify(null, { httpStatus: 502 }), 'UPSTREAM_ERROR');
  assert.equal(classify(null, { code: 'NETWORK_ERROR' }), 'NETWORK_ERROR');
  assert.equal(classify(null, { code: 'BROKER_TIMEOUT' }), 'TIMEOUT');
  assert.equal(classify('AB9999', { httpStatus: 200, providerMessage: 'Something new' }), 'REQUEST_ERROR');
});

// ── Authentication / session ─────────────────────────────────────────────────
test('login sends the documented request and stores the session', async () => {
  const adapter = new AngelOneAdapter({ clientCode: 'a123456' });
  const result = await adapter.login({ mpin: '4321', totp: '123456' });
  assert.equal(result.authenticated, true);
  assert.equal(result.clientCode, 'A123456');
  assert.ok(adapter.session.jwtToken && adapter.session.refreshToken && adapter.session.feedToken);
  assert.ok(adapter.tokenExpiresAt instanceof Date && adapter.tokenExpiresAt > new Date());
  const [request] = api.requestsTo('loginByPassword');
  assert.equal(request.method, 'POST');
  assert.deepEqual(request.body, { clientcode: 'A123456', password: '4321', totp: '123456' });
  assert.equal(request.headers['x-privatekey'], 'test-api-key');
  assert.equal(request.headers['x-usertype'], 'USER');
  assert.equal(request.headers['x-sourceid'], 'WEB');
  assert.equal(request.headers['x-clientpublicip'], STATIC_IP);
  assert.equal(request.headers.authorization, undefined, 'login is unauthenticated');
});

test('login accepts a base32 TOTP secret and generates the code', async () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  api.state.totp = generateTotp(secret);
  const adapter = new AngelOneAdapter({ clientCode: 'A123456' });
  await adapter.login({ mpin: '4321', totp: secret });
  assert.match(api.requestsTo('loginByPassword')[0].body.totp, /^\d{6}$/);
});

test('invalid credentials are rejected without creating a session and without retries', async () => {
  for (const [credentials, code] of [[{ mpin: '0000', totp: '123456' }, 'AB1000'], [{ mpin: '4321', totp: '000000' }, 'AB1050']]) {
    const adapter = new AngelOneAdapter({ clientCode: 'A123456' });
    await assert.rejects(adapter.login(credentials), (error) => {
      assert.equal(error.name, 'BrokerApiError');
      assert.equal(error.code, 'BROKER_INVALID_CREDENTIALS');
      assert.equal(error.angelCategory, 'INVALID_CREDENTIALS');
      assert.equal(error.providerErrorCode, code);
      assert.equal(error.statusCode, 422, 'must not be 401: that would look like a KEPWE login failure to the web client');
      return true;
    });
    assert.equal(adapter.session, null);
  }
  assert.equal(api.requestsTo('loginByPassword').length, 2, 'a rejected login is never retried');
});

test('missing fields and a missing/invalid API key are reported before or by SmartAPI', async () => {
  const adapter = new AngelOneAdapter({ clientCode: 'A123456' });
  await assert.rejects(adapter.login({ mpin: '', totp: '123456' }), /MPIN is required/);
  await assert.rejects(adapter.login({ mpin: '4321', totp: '' }), /TOTP is required/);
  await assert.rejects(new AngelOneAdapter().login({ mpin: '4321', totp: '123456' }), /client code is required/);
  assert.equal(api.state.requests.length, 0, 'validation failures never reach SmartAPI');

  const wrongKey = new AngelOneAdapter({ clientCode: 'A123456', apiKey: 'wrong-key' });
  assert.equal(wrongKey.apiKeySource, 'USER');
  await assert.rejects(wrongKey.login({ mpin: '4321', totp: '123456' }), (error) => {
    assert.equal(error.code, 'BROKER_INVALID_API_KEY');
    assert.equal(error.providerErrorCode, 'AG8004');
    return true;
  });

  const previous = process.env.ANGEL_ONE_API_KEY;
  delete process.env.ANGEL_ONE_API_KEY;
  try {
    const noKey = new AngelOneAdapter({ clientCode: 'A123456' });
    assert.equal(noKey.isConfigured(), false);
    await assert.rejects(noKey.login({ mpin: '4321', totp: '123456' }), (error) => error.code === 'BROKER_API_KEY_MISSING');
  } finally {
    process.env.ANGEL_ONE_API_KEY = previous;
  }
});

test('calls without a session fail as session-expired before any request', async () => {
  const adapter = new AngelOneAdapter({ clientCode: 'A123456' });
  await assert.rejects(adapter.getProfile(), (error) => error.code === 'BROKER_SESSION_EXPIRED' && error.statusCode === 401);
  assert.equal(api.state.requests.length, 0);
});

// ── Account data ─────────────────────────────────────────────────────────────
test('profile, funds, positions, holdings and portfolio are read and normalized', async () => {
  const adapter = await loggedIn();
  const profile = await adapter.getProfile();
  assert.equal(profile.clientCode, 'A123456');
  assert.equal(profile.name, 'TEST CLIENT');
  assert.deepEqual(profile.exchanges, ['NSE', 'BSE', 'NFO']);
  assert.match(api.requestsTo('getProfile')[0].headers.authorization, /^Bearer /);

  const funds = await adapter.getMargin();
  assert.equal(funds.available, 125000.5);
  assert.equal(funds.net, 150000);
  assert.equal(funds.utilized, 25000);
  assert.equal(funds.collateral, 2500);

  const [position] = await adapter.getPositions();
  assert.deepEqual(
    { instrument: position.instrument, side: position.side, quantity: position.quantity, entryPrice: position.entryPrice, currentPrice: position.currentPrice, pnl: position.pnl, realizedPnl: position.realizedPnl, unrealizedPnl: position.unrealizedPnl, securityId: position.securityId, exchangeSegment: position.exchangeSegment, lotSize: position.lotSize, key: position.brokerPositionKey },
    { instrument: 'NIFTY08OCT2625000CE', side: 'BUY', quantity: 150, entryPrice: 118, currentPrice: 120.5, pnl: 375, realizedPnl: 0, unrealizedPnl: 375, securityId: '43854', exchangeSegment: 'NFO', lotSize: 75, key: 'NFO:43854:INTRADAY' },
  );

  const [holding] = await adapter.getHoldings();
  assert.equal(holding.tradingSymbol, 'RELIANCE-EQ');
  assert.equal(holding.totalQty, 10);
  assert.equal(holding.avgCostPrice, 1400);
  assert.equal(holding.pnl, 505);

  const portfolio = await adapter.getPortfolio();
  assert.equal(portfolio.totalHoldingValue, 14505);
  assert.equal(portfolio.totalInvestedValue, 14000);
  assert.equal(portfolio.totalPnl, 505);

  const validation = await adapter.validateSession();
  assert.equal(validation.valid, true);
  assert.equal(validation.funds.available, 125000.5);
});

test('SmartAPI null data (no positions/holdings/orders/trades) becomes empty arrays', async () => {
  api.state.positions = [];
  api.state.holdings = [];
  const adapter = await loggedIn();
  assert.deepEqual(await adapter.getPositions(), []);
  assert.deepEqual(await adapter.getHoldings(), []);
  assert.deepEqual(await adapter.getOrderBook(), []);
  assert.deepEqual(await adapter.getTradeBook(), []);
});

test('validateSession rejects a session that belongs to another client code', async () => {
  const adapter = await loggedIn();
  adapter.clientCode = 'B999999';
  await assert.rejects(adapter.validateSession(), (error) => error.code === 'BROKER_ACCOUNT_IDENTITY_MISMATCH' && error.statusCode === 409);
});

// ── Market data ──────────────────────────────────────────────────────────────
test('quotes, candles and option greeks are requested and normalized', async () => {
  const adapter = await loggedIn();
  const index = await adapter.getMarketData({ exchange: 'NSE', symbolToken: '99926000' });
  assert.equal(index.ltp, 25012.35);
  assert.equal(index.lastUpdateTime, '2026-10-07T04:45:30.000Z');
  assert.deepEqual(api.requestsTo('/market/v1/quote/')[0].body, { mode: 'FULL', exchangeTokens: { NSE: ['99926000'] } });

  const option = await adapter.getMarketDepth({ exchange: 'NSE_FNO', securityId: '43854' });
  assert.equal(option.bid, 120.4);
  assert.equal(option.ask, 120.6);
  assert.equal(option.volume, 912000);
  assert.deepEqual(api.requestsTo('/market/v1/quote/')[1].body.exchangeTokens, { NFO: ['43854'] }, 'exchange aliases map to Angel One codes');

  await assert.rejects(adapter.getQuote({ exchange: 'NSE', symbolToken: '1' }), (error) => error.code === 'BROKER_NOT_FOUND');
  await assert.rejects(adapter.getQuote({ exchange: 'NSE' }), /symbol token are required/);

  const many = await adapter.getQuotes({ exchangeTokens: { NFO: Array.from({ length: 120 }, (_, i) => String(50000 + i)) } });
  assert.equal(many.fetched.length, 0);
  assert.equal(many.unfetched.length, 120);
  assert.equal(api.requestsTo('/market/v1/quote/').filter((request) => request.body.exchangeTokens.NFO?.length <= 50 && request.body.exchangeTokens.NFO?.[0] >= '50000').length, 3, '120 tokens are split into batches of 50');

  const candles = await adapter.getHistoricalData({ exchange: 'NSE', symbolToken: '99926000', interval: '5m', fromDate: '2026-10-07', toDate: '2026-10-07' });
  assert.deepEqual(candles[0], { timestamp: '2026-10-07T03:45:00.000Z', open: 24950, high: 24990, low: 24940, close: 24985, volume: 0 });
  assert.deepEqual(api.requestsTo('getCandleData')[0].body, { exchange: 'NSE', symboltoken: '99926000', interval: 'FIVE_MINUTE', fromdate: '2026-10-07 09:15', todate: '2026-10-07 15:30' });
  await assert.rejects(adapter.getHistoricalData({ exchange: 'NSE', symbolToken: '1', interval: '7m', fromDate: '2026-10-07', toDate: '2026-10-07' }), /unsupported candle interval/);

  const [greek] = await adapter.getOptionGreeks({ name: 'nifty', expiry: '08oct2026' });
  assert.deepEqual({ strike: greek.strike, optionType: greek.optionType, delta: greek.delta }, { strike: 25000, optionType: 'CE', delta: 0.521 });
  assert.deepEqual(api.requestsTo('optionGreek')[0].body, { name: 'NIFTY', expirydate: '08OCT2026' });
});

// ── Orders ───────────────────────────────────────────────────────────────────
test('order placement sends the SmartAPI payload and returns the broker order id', async () => {
  const adapter = await loggedIn();
  const result = await adapter.placeOrder({ internalOrderId: '3f2b8c1e-9a4d-4e7f-b1a2-0c9d8e7f6a5b', side: 'BUY', quantity: 150, price: 0, metadata: NIFTY_OPTION });
  assert.match(result.brokerOrderId, /^\d+$/);
  assert.equal(result.status, 'SUBMITTED');
  assert.equal(result.correlationId, '3f2b8c1e9a4d4e7fb1a2');
  assert.deepEqual(api.requestsTo('placeOrder')[0].body, {
    variety: 'NORMAL', tradingsymbol: 'NIFTY08OCT2625000CE', symboltoken: '43854', transactiontype: 'BUY', exchange: 'NFO',
    ordertype: 'MARKET', producttype: 'INTRADAY', duration: 'DAY', price: '0', triggerprice: '0', squareoff: '0', stoploss: '0',
    quantity: '150', ordertag: '3f2b8c1e9a4d4e7fb1a2',
  });
});

test('order payload validation rejects bad orders locally (nothing is sent)', async () => {
  const adapter = await loggedIn();
  const before = api.state.requests.length;
  const place = (order) => adapter.placeOrder({ side: 'BUY', quantity: 150, price: 0, metadata: NIFTY_OPTION, ...order });
  await assert.rejects(place({ quantity: 0 }), /positive integer/);
  await assert.rejects(place({ quantity: 100 }), /multiple of the verified lot size/);
  await assert.rejects(place({ side: 'HOLD' }), /BUY or SELL/);
  await assert.rejects(place({ metadata: { ...NIFTY_OPTION, symbolToken: '' } }), /symbol token and trading symbol/);
  await assert.rejects(place({ metadata: { ...NIFTY_OPTION, lotSize: undefined } }), /lot size is required/);
  await assert.rejects(place({ metadata: { ...NIFTY_OPTION, exchange: 'NYSE' } }), /unsupported exchange/);
  await assert.rejects(place({ metadata: { ...NIFTY_OPTION, orderType: 'LIMIT' } }), /positive price/);
  await assert.rejects(place({ metadata: { ...NIFTY_OPTION, orderType: 'SL' }, price: 100 }), /trigger price/);
  assert.equal(api.state.requests.length, before);
  assert.equal(api.state.orders.length, 0);
});

test('order status follows the order book: open, partial, complete, rejected', async () => {
  const adapter = await loggedIn();
  const { brokerOrderId } = await adapter.placeOrder({ side: 'BUY', quantity: 150, price: 0, metadata: NIFTY_OPTION });
  let status = await adapter.getOrderStatus({ brokerOrderId });
  assert.equal(status.status, 'SUBMITTED');
  assert.equal(status.brokerStatus, 'open');
  assert.equal(status.averagePrice, null);

  Object.assign(api.state.orders[0], { filledshares: 75, averageprice: 120.4 });
  adapter.orderBookCache = null;
  status = await adapter.getOrderStatus({ brokerOrderId });
  assert.deepEqual({ status: status.status, filled: status.filledQuantity, remaining: status.remainingQuantity, average: status.averagePrice }, { status: 'PARTIALLY_FILLED', filled: 75, remaining: 75, average: 120.4 });

  Object.assign(api.state.orders[0], { status: 'complete', filledshares: 150, averageprice: 120.5 });
  adapter.orderBookCache = null;
  status = await adapter.getOrderStatus({ brokerOrderId });
  assert.deepEqual({ status: status.status, filled: status.filledQuantity, average: status.averagePrice }, { status: 'FILLED', filled: 150, average: 120.5 });

  api.state.orderOutcome = 'rejected';
  const rejected = await adapter.placeOrder({ side: 'BUY', quantity: 75, price: 0, metadata: NIFTY_OPTION });
  status = await adapter.getOrderStatus({ brokerOrderId: rejected.brokerOrderId });
  assert.equal(status.status, 'REJECTED');
  assert.match(status.rejectionReason, /Margin Exceeds/);

  const byUniqueId = await adapter.getOrderStatus({ uniqueOrderId: rejected.uniqueOrderId });
  assert.equal(byUniqueId.status, 'REJECTED');
  await assert.rejects(adapter.getOrderStatus({ brokerOrderId: '999' }), (error) => error.code === 'BROKER_NOT_FOUND' && error.statusCode === 404);
});

test('a synchronous SmartAPI order rejection is surfaced and never retried', async () => {
  const adapter = await loggedIn();
  api.state.placeOrderError = { errorcode: 'AB1012', message: 'Invalid Product Type' };
  await assert.rejects(adapter.placeOrder({ side: 'BUY', quantity: 150, price: 0, metadata: NIFTY_OPTION }), (error) => {
    assert.equal(error.code, 'BROKER_ORDER_REJECTED');
    assert.equal(error.providerErrorCode, 'AB1012');
    assert.equal(error.statusCode, 422);
    return true;
  });
  assert.equal(api.requestsTo('placeOrder').length, 1);
});

test('modify and cancel send the broker order id; order and trade history are normalized', async () => {
  const adapter = await loggedIn();
  const placed = await adapter.placeOrder({ side: 'BUY', quantity: 150, price: 118.5, metadata: { ...NIFTY_OPTION, orderType: 'LIMIT' } });
  assert.equal(api.requestsTo('placeOrder')[0].body.price, '118.5');
  await adapter.modifyOrder({ brokerOrderId: placed.brokerOrderId, side: 'BUY', quantity: 150, price: 119, metadata: { ...NIFTY_OPTION, orderType: 'LIMIT' } });
  const modify = api.requestsTo('modifyOrder')[0].body;
  assert.equal(modify.orderid, placed.brokerOrderId);
  assert.equal(modify.price, '119');
  assert.equal(modify.ordertag, undefined);
  const cancelled = await adapter.cancelOrder({ brokerOrderId: placed.brokerOrderId });
  assert.equal(cancelled.status, 'CANCELLED');
  assert.deepEqual(api.requestsTo('cancelOrder')[0].body, { variety: 'NORMAL', orderid: placed.brokerOrderId });
  assert.equal((await adapter.getOrderStatus({ brokerOrderId: placed.brokerOrderId })).status, 'CANCELLED');
  await assert.rejects(adapter.cancelOrder({ brokerOrderId: '404' }), (error) => error.code === 'BROKER_NOT_FOUND');

  api.state.orderOutcome = 'complete';
  const filled = await adapter.placeOrder({ side: 'BUY', quantity: 75, price: 0, metadata: NIFTY_OPTION });
  const book = await adapter.getOrderBook({ fresh: true });
  assert.equal(book.length, 2);
  const order = book.find((item) => item.orderId === filled.brokerOrderId);
  assert.deepEqual({ status: order.status, side: order.side, quantity: order.quantity, filled: order.filledQuantity, symbol: order.tradingSymbol }, { status: 'FILLED', side: 'BUY', quantity: 75, filled: 75, symbol: 'NIFTY08OCT2625000CE' });
  const [trade] = await adapter.getTradeBook();
  assert.deepEqual({ orderId: trade.orderId, qty: trade.tradedQuantity, price: trade.tradedPrice }, { orderId: filled.brokerOrderId, qty: 75, price: 101.25 });

  const updates = [];
  await adapter.subscribeExecutionUpdates({ brokerOrderIds: [filled.brokerOrderId], onUpdate: (update) => updates.push(update), signal: new AbortController().signal });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, 'FILLED');
});

test('exit-all places one opposite MARKET order per open position and reports refusals', async () => {
  const adapter = await loggedIn();
  const result = await adapter.exitAllPositions();
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.placed.length, 1);
  const exit = api.requestsTo('placeOrder')[0].body;
  assert.deepEqual({ side: exit.transactiontype, qty: exit.quantity, type: exit.ordertype, token: exit.symboltoken, product: exit.producttype }, { side: 'SELL', qty: '150', type: 'MARKET', token: '43854', product: 'INTRADAY' });

  api.state.placeOrderError = { errorcode: 'AB1006', message: 'Client Is Block For Trading' };
  await assert.rejects(adapter.exitAllPositions(), (error) => error.code === 'BROKER_EXIT_ALL_FAILED' && error.failed.length === 1);

  api.state.positions = [];
  api.state.placeOrderError = null;
  const none = await adapter.exitAllPositions();
  assert.deepEqual({ status: none.status, open: none.openPositions, placed: none.placed.length }, { status: 'SUCCESS', open: 0, placed: 0 });
});

// ── Static IP gate ───────────────────────────────────────────────────────────
test('order APIs are blocked locally unless the outbound IP equals the configured static IP', async () => {
  const adapter = await loggedIn();
  const order = { side: 'BUY', quantity: 150, price: 0, metadata: NIFTY_OPTION };

  restoreFetch();
  restoreFetch = stubEgressIp('198.51.100.7');
  clearStaticIpVerificationCache();
  await assert.rejects(adapter.placeOrder(order), (error) => {
    assert.equal(error.code, 'STATIC_IP_NOT_READY');
    assert.equal(error.statusCode, 412);
    assert.equal(error.staticIp.status, 'EGRESS_IP_MISMATCH');
    return true;
  });
  await assert.rejects(adapter.cancelOrder({ brokerOrderId: '1' }), (error) => error.code === 'STATIC_IP_NOT_READY');
  await assert.rejects(adapter.exitAllPositions(), (error) => error.code === 'STATIC_IP_NOT_READY');

  restoreFetch();
  restoreFetch = stubEgressIp(null);
  clearStaticIpVerificationCache();
  assert.equal((await verifyAngelOneStaticIp({ force: true })).status, 'EGRESS_UNVERIFIED');
  await assert.rejects(adapter.placeOrder(order), (error) => error.code === 'STATIC_IP_NOT_READY');

  const configured = process.env.ANGEL_ONE_STATIC_IP;
  delete process.env.ANGEL_ONE_STATIC_IP;
  clearStaticIpVerificationCache();
  try {
    assert.equal(getStaticIpReadiness().status, 'NOT_CONFIGURED');
    await assert.rejects(adapter.placeOrder(order), (error) => error.code === 'STATIC_IP_NOT_READY' && error.staticIp.status === 'NOT_CONFIGURED');
  } finally {
    process.env.ANGEL_ONE_STATIC_IP = configured;
  }
  assert.equal(api.requestsTo('placeOrder').length, 0, 'a blocked order never reaches SmartAPI');

  restoreFetch();
  restoreFetch = stubEgressIp(STATIC_IP);
  clearStaticIpVerificationCache();
  const ready = await verifyAngelOneStaticIp({ force: true });
  assert.deepEqual({ status: ready.status, ready: ready.ready, registrationVerifiable: ready.registrationVerifiable }, { status: 'PASS', ready: true, registrationVerifiable: false });
  assert.match((await adapter.placeOrder(order)).brokerOrderId, /^\d+$/);
});

// ── Session expiry / refresh ─────────────────────────────────────────────────
test('an expired JWT is renewed with the refresh token and the call is repeated once', async () => {
  const sessions = [];
  const adapter = await loggedIn({ onSessionUpdate: async (session) => sessions.push(session) });
  const firstJwt = adapter.session.jwtToken;
  api.expireJwts();
  const profile = await adapter.getProfile();
  assert.equal(profile.clientCode, 'A123456');
  assert.notEqual(adapter.session.jwtToken, firstJwt);
  assert.equal(api.requestsTo('generateTokens').length, 1);
  assert.deepEqual(Object.keys(api.requestsTo('generateTokens')[0].body), ['refreshToken']);
  assert.equal(api.requestsTo('getProfile').length, 2, 'original call + one repeat after refresh');
  assert.equal(sessions.length, 2, 'login and refresh are both persisted');
  assert.equal(sessions[1].jwtToken, adapter.session.jwtToken);
  assert.ok(sessions[1].refreshToken, 'the rotated refresh token is persisted');
});

test('a locally expired token is refreshed before the request is sent', async () => {
  const issued = api.issueSession();
  const adapter = new AngelOneAdapter({ clientCode: 'A123456', ...issued, tokenExpiresAt: new Date(Date.now() - 60_000) });
  await adapter.getMargin();
  assert.equal(api.requestsTo('generateTokens').length, 1);
  assert.equal(api.requestsTo('getRMS').length, 1, 'no wasted call with the expired token');
});

test('when the refresh token is rejected the session is reported expired', async () => {
  const adapter = await loggedIn();
  api.expireJwts({ refreshTokensToo: true });
  await assert.rejects(adapter.getPositions(), (error) => {
    assert.equal(error.code, 'BROKER_SESSION_EXPIRED');
    assert.equal(error.statusCode, 401);
    assert.equal(error.refreshRejected, true);
    assert.equal(error.providerErrorCode, 'AB8050');
    return true;
  });
  assert.equal(api.requestsTo('generateTokens').length, 1, 'refresh is attempted exactly once');

  const noRefresh = new AngelOneAdapter({ clientCode: 'A123456', jwtToken: 'x.y.z' });
  await assert.rejects(noRefresh.getProfile(), (error) => error.code === 'BROKER_SESSION_EXPIRED' && /no refresh token/.test(error.message));
});

test('operator auto-login is used only after the session cannot be renewed', async () => {
  const adapter = await loggedIn({ autoLogin: async (clientCode) => (clientCode === 'A123456' ? { mpin: '4321', totp: '123456' } : null) });
  api.expireJwts({ refreshTokensToo: true });
  assert.equal((await adapter.getProfile()).clientCode, 'A123456');
  assert.equal(api.requestsTo('loginByPassword').length, 2);

  const wrong = await loggedIn({ autoLogin: async () => ({ mpin: 'bad', totp: '123456' }) });
  api.expireJwts({ refreshTokensToo: true });
  await assert.rejects(wrong.getProfile(), (error) => error.code === 'BROKER_SESSION_EXPIRED' && /Invalid Email Or Password/.test(error.reloginError));
});

test('concurrent calls share a single token refresh', async () => {
  const adapter = await loggedIn();
  api.expireJwts();
  const results = await Promise.all([adapter.getProfile(), adapter.getMargin(), adapter.getPositions()]);
  assert.equal(results.length, 3);
  assert.equal(api.requestsTo('generateTokens').length, 1);
});

test('logout ends the session at SmartAPI and locally', async () => {
  const adapter = await loggedIn();
  const jwt = adapter.session.jwtToken;
  const result = await adapter.logout();
  assert.equal(result.loggedOut, true);
  assert.deepEqual(api.requestsTo('/user/v1/logout')[0].body, { clientcode: 'A123456' });
  assert.equal(adapter.session, null);
  await assert.rejects(adapter.getProfile(), (error) => error.code === 'BROKER_SESSION_EXPIRED');
  // The token itself is dead at the provider too.
  const reused = new AngelOneAdapter({ clientCode: 'A123456', jwtToken: jwt });
  await assert.rejects(reused.getProfile(), (error) => error.code === 'BROKER_SESSION_EXPIRED');
  assert.deepEqual(await adapter.logout(), { loggedOut: false, reason: 'no active session' });
});

// ── API errors / retries ─────────────────────────────────────────────────────
test('rate limiting: read calls are retried, order placement is not', async () => {
  const adapter = await loggedIn();
  const rateLimited = { http: 403, text: 'Access denied because of exceeding access rate' };
  api.failNext('getRMS', rateLimited);
  assert.equal((await adapter.getMargin()).available, 125000.5);
  assert.equal(api.requestsTo('getRMS').length, 2);

  api.failNext('getPosition', rateLimited);
  api.failNext('getPosition', rateLimited);
  api.failNext('getPosition', rateLimited);
  await assert.rejects(adapter.getPositions(), (error) => {
    assert.equal(error.code, 'BROKER_RATE_LIMITED');
    assert.equal(error.statusCode, 429);
    return true;
  });
  assert.equal(api.requestsTo('getPosition').length, 3, 'initial call + 2 bounded retries');

  api.failNext('placeOrder', rateLimited);
  await assert.rejects(adapter.placeOrder({ side: 'BUY', quantity: 150, price: 0, metadata: NIFTY_OPTION }), (error) => error.code === 'BROKER_RATE_LIMITED');
  assert.equal(api.requestsTo('placeOrder').length, 1, 'an order is never re-sent automatically');
  assert.equal(api.state.orders.length, 0);
});

test('upstream 5xx, malformed bodies and SmartAPI internal errors', async () => {
  const adapter = await loggedIn();
  api.failNext('getHolding', { http: 502, text: '<html>Bad Gateway</html>' });
  assert.equal((await adapter.getHoldings()).length, 1, 'a transient 5xx on a read is retried');

  for (let i = 0; i < 3; i += 1) api.failNext('getTradeBook', { http: 500, body: { status: false, message: 'Internal Error', errorcode: 'AB2001', data: null } });
  await assert.rejects(adapter.getTradeBook(), (error) => {
    assert.equal(error.code, 'BROKER_UPSTREAM_ERROR');
    assert.equal(error.providerErrorCode, 'AB2001');
    assert.equal(error.statusCode, 502);
    return true;
  });

  for (let i = 0; i < 3; i += 1) api.failNext('getRMS', { http: 200, text: 'not json' });
  await assert.rejects(adapter.getMargin(), (error) => error.name === 'BrokerApiError' && /not json/.test(error.message));

  api.failNext('getProfile', { http: 200, body: { status: false, message: 'Client Is Block For Trading', errorcode: 'AB1006', data: null } });
  await assert.rejects(adapter.getProfile(), (error) => error.code === 'BROKER_ACCOUNT_BLOCKED' && error.statusCode === 403);
  assert.equal(api.requestsTo('getProfile').length, 1, 'a definitive rejection is not retried');
});

test('timeouts and dropped connections are classified; an order with unknown outcome is not re-sent', async () => {
  const adapter = await loggedIn();
  for (let i = 0; i < 3; i += 1) api.failNext('getOrderBook', { hang: true });
  await assert.rejects(adapter.getOrderBook(), (error) => {
    assert.equal(error.code, 'BROKER_TIMEOUT');
    assert.equal(error.statusCode, 504);
    assert.match(error.message, /timed out/);
    return true;
  });

  api.failNext('getPosition', { destroy: true });
  assert.equal((await adapter.getPositions()).length, 1, 'a dropped connection on a read is retried');

  api.failNext('placeOrder', { destroy: true });
  await assert.rejects(adapter.placeOrder({ side: 'BUY', quantity: 150, price: 0, metadata: NIFTY_OPTION }), (error) => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.match(error.message, /network error/, 'the OMS keys RECOVERY_PENDING off this wording');
    return true;
  });
  assert.equal(api.requestsTo('placeOrder').length, 1);

  await api.close();
  for (const call of [() => adapter.getProfile(), () => new AngelOneAdapter({ clientCode: 'A123456' }).login({ mpin: '4321', totp: '123456' })]) {
    await assert.rejects(call(), (error) => error.code === 'NETWORK_ERROR' && error.statusCode === 503);
  }
  api = null;
});
