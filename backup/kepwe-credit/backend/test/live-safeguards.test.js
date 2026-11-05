// Safeguards on the live order path: verified static IP, no fabricated fill
// prices, lot-aligned sizing under the exchange freeze limit, and validated
// Angel One order payloads. No network, no DB, no orders.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.BROKER_TOKEN_ENCRYPTION_KEY = process.env.BROKER_TOKEN_ENCRYPTION_KEY || 'b'.repeat(64);
process.env.ANGEL_ONE_API_KEY = process.env.ANGEL_ONE_API_KEY || 'unit-api-key';

const { verifyAngelOneStaticIp, getStaticIpReadiness, clearStaticIpVerificationCache } = await import('../src/services/static-ip.service.js');
const { executionValues, MissingExecutionPriceError } = await import('../src/algo/oms.js');
const { sizePosition } = await import('../src/algo/risk-engine.js');
const { AngelOneAdapter, normalizeBrokerExecution } = await import('../src/algo/broker-adapters.js');

const egress = (ip) => async () => new Response(JSON.stringify({ ip }), { status: 200 });
const OPTION = { symbolToken: '43854', tradingSymbol: 'NIFTY24NOV2618950CE', exchange: 'NFO', lotSize: 65, orderType: 'MARKET', productType: 'INTRADAY' };

test('static IP: PASS only when the detected outbound IP equals the configured static IP', async () => {
  process.env.ANGEL_ONE_STATIC_IP = '203.0.113.10';
  clearStaticIpVerificationCache();
  const ok = await verifyAngelOneStaticIp({ force: true, fetchImpl: egress('203.0.113.10') });
  assert.equal(ok.ready, true);
  assert.equal(ok.status, 'PASS');
  assert.equal(ok.registrationVerifiable, false, 'registration with Angel One cannot be read back by API and is never claimed');

  const wrongEgress = await verifyAngelOneStaticIp({ force: true, fetchImpl: egress('192.0.2.55') });
  assert.equal(wrongEgress.ready, false);
  assert.equal(wrongEgress.status, 'EGRESS_IP_MISMATCH');

  const undetected = await verifyAngelOneStaticIp({ force: true, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(undetected.ready, false);
  assert.equal(undetected.status, 'EGRESS_UNVERIFIED');
});

test('static IP: a configured value alone is never treated as verified', () => {
  process.env.ANGEL_ONE_STATIC_IP = '203.0.113.99';
  clearStaticIpVerificationCache();
  const readiness = getStaticIpReadiness();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.status, 'PENDING_VERIFICATION');
  delete process.env.ANGEL_ONE_STATIC_IP;
  clearStaticIpVerificationCache();
  assert.equal(getStaticIpReadiness().status, 'NOT_CONFIGURED');
});

test('Angel One order methods refuse locally when the static IP is not verified (no order request sent)', async () => {
  process.env.ANGEL_ONE_STATIC_IP = '203.0.113.10';
  clearStaticIpVerificationCache();
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    calls.push({ href, method: init.method || 'GET' });
    if (href.includes('ipify') || href.includes('checkip')) return new Response(JSON.stringify({ ip: '198.51.100.1' }), { status: 200 });
    throw new Error(`unexpected ${href}`);
  };
  try {
    const adapter = new AngelOneAdapter({ clientCode: 'A123456', jwtToken: 'a.b.c', tokenExpiresAt: '2099-01-01T00:00:00Z' });
    await assert.rejects(adapter.placeOrder({ side: 'BUY', quantity: 65, price: 0, metadata: OPTION }), (error) => error.code === 'STATIC_IP_NOT_READY');
    await assert.rejects(adapter.modifyOrder({ brokerOrderId: '1', side: 'BUY', quantity: 65, price: 0, metadata: OPTION }), (error) => error.code === 'STATIC_IP_NOT_READY');
    await assert.rejects(adapter.cancelOrder({ brokerOrderId: '1' }), (error) => error.code === 'STATIC_IP_NOT_READY');
    await assert.rejects(adapter.exitAllPositions(), (error) => error.code === 'STATIC_IP_NOT_READY');
    assert.equal(calls.some((call) => /angelbroking/.test(call.href)), false, 'no order/position request reached Angel One');
  } finally {
    globalThis.fetch = realFetch;
    clearStaticIpVerificationCache();
  }
});

test('OMS never records a fill at an assumed price', () => {
  const order = { quantity: 65, price: 0, filled_quantity: 0, average_fill_price: null, status: 'SUBMITTED' };
  assert.throws(() => executionValues({ status: 'FILLED' }, order), MissingExecutionPriceError);
  assert.throws(() => executionValues({ status: 'PARTIALLY_FILLED', filledQuantity: 30 }, order), MissingExecutionPriceError);
  // Angel One reports averageprice 0 until an order trades; that is never a fill price.
  const complete = normalizeBrokerExecution({ orderid: '9', orderstatus: 'complete', quantity: '65', filledshares: '65', averageprice: 0 });
  assert.throws(() => executionValues(complete, order), MissingExecutionPriceError);
  const ok = executionValues(normalizeBrokerExecution({ orderid: '9', orderstatus: 'complete', quantity: '65', filledshares: '65', averageprice: 123.45 }), order);
  assert.equal(ok.averagePrice, 123.45);
  assert.equal(ok.filledQuantity, 65);
  const rejected = executionValues({ status: 'REJECTED', rejectionReason: 'RMS' }, order);
  assert.equal(rejected.averagePrice, null);
});

test('Angel One order-book rows normalize filledshares/averageprice/text', () => {
  const traded = normalizeBrokerExecution({ orderid: '9', uniqueorderid: 'u-9', ordertag: 'tag', orderstatus: 'complete', status: 'complete', quantity: '65', filledshares: '65', unfilledshares: '0', averageprice: 101.5 });
  assert.deepEqual(
    { id: traded.brokerOrderId, unique: traded.uniqueOrderId, tag: traded.correlationId, status: traded.status, brokerStatus: traded.brokerStatus, filled: traded.filledQuantity, remaining: traded.remainingQuantity, average: traded.averagePrice },
    { id: '9', unique: 'u-9', tag: 'tag', status: 'FILLED', brokerStatus: 'complete', filled: 65, remaining: 0, average: 101.5 },
  );
  const rejected = normalizeBrokerExecution({ orderid: '9', orderstatus: 'rejected', text: 'RMS:Margin Exceeds', quantity: '65', filledshares: '0' });
  assert.equal(rejected.status, 'REJECTED');
  assert.equal(rejected.rejectionReason, 'RMS:Margin Exceeds');
  const open = normalizeBrokerExecution({ orderid: '9', orderstatus: 'open', text: '', quantity: '65', filledshares: '0' });
  assert.equal(open.status, 'SUBMITTED');
  assert.equal(open.rejectionReason, null);
  // Already normalized objects pass through unchanged.
  assert.equal(normalizeBrokerExecution(traded).status, 'FILLED');
});

test('position sizing stays lot-aligned under the exchange freeze limit', () => {
  const settings = { tradingCapital: 10_000_000, riskPerTrade: 5 };
  const sizing = sizePosition({ entryPrice: 10, stopLoss: 5, settings, lotSize: 65, availableMargin: 10_000_000, brokerLimit: 1755 });
  assert.equal(sizing.quantity % 65, 0);
  assert.ok(sizing.quantity <= 1755);
  assert.equal(sizing.quantity, 1755); // 27 lots of 65, strictly below freeze 1756
  const unaligned = sizePosition({ entryPrice: 10, stopLoss: 5, settings, lotSize: 65, availableMargin: 10_000_000, brokerLimit: 1700 });
  assert.equal(unaligned.quantity, 1690); // capped at 1700 then rounded down to 26 lots
  const blocked = sizePosition({ entryPrice: 10, stopLoss: 5, settings, lotSize: 65, availableMargin: 10_000_000, brokerLimit: 0 });
  assert.equal(blocked.quantity, 0);
});

test('Angel One order payload carries every SmartAPI placeOrder field', () => {
  const adapter = new AngelOneAdapter({ clientCode: 'A123456', jwtToken: 'a.b.c', tokenExpiresAt: '2099-01-01T00:00:00Z' });
  const payload = adapter.buildOrderPayload({ internalOrderId: '3f2b8c1e-9a4d-4e7f-b1a2-0c9d8e7f6a5b', side: 'BUY', quantity: 65, price: 0, metadata: OPTION });
  for (const field of ['variety', 'tradingsymbol', 'symboltoken', 'transactiontype', 'exchange', 'ordertype', 'producttype', 'duration', 'price', 'triggerprice', 'squareoff', 'stoploss', 'quantity', 'ordertag']) {
    assert.ok(field in payload, `${field} present`);
  }
  assert.equal(payload.ordertag.length <= 20, true);
  assert.equal(payload.exchange, 'NFO');
  assert.equal(payload.price, '0');
  // Internal aliases are translated to SmartAPI constants.
  const aliased = adapter.buildOrderPayload({ side: 'sell', quantity: 10, price: 250.5, metadata: { securityId: '2885', tradingSymbol: 'RELIANCE-EQ', exchangeSegment: 'NSE_EQ', productType: 'CNC', orderType: 'LIMIT' } });
  assert.deepEqual({ exchange: aliased.exchange, product: aliased.producttype, type: aliased.ordertype, side: aliased.transactiontype, price: aliased.price, variety: aliased.variety }, { exchange: 'NSE', product: 'DELIVERY', type: 'LIMIT', side: 'SELL', price: '250.5', variety: 'NORMAL' });
  const stop = adapter.buildOrderPayload({ side: 'SELL', quantity: 65, price: 90, metadata: { ...OPTION, orderType: 'SL', triggerPrice: 92 } });
  assert.deepEqual({ variety: stop.variety, type: stop.ordertype, trigger: stop.triggerprice }, { variety: 'STOPLOSS', type: 'STOPLOSS_LIMIT', trigger: '92' });
});
