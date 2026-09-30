// Safeguards on the live order path: broker-verified static IP, no fabricated
// fill prices, lot-aligned sizing under the exchange freeze limit, and the
// Dhan postback being treated as a trigger only. No network, no DB, no orders.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.BROKER_TOKEN_ENCRYPTION_KEY = process.env.BROKER_TOKEN_ENCRYPTION_KEY || 'b'.repeat(64);

const { verifyDhanStaticIp, getStaticIpReadiness, clearStaticIpVerificationCache } = await import('../src/services/static-ip.service.js');
const { executionValues, MissingExecutionPriceError } = await import('../src/algo/oms.js');
const { sizePosition } = await import('../src/algo/risk-engine.js');
const { DhanAdapter, normalizeBrokerExecution } = await import('../src/algo/broker-adapters.js');

const egress = (ip) => async () => new Response(JSON.stringify({ ip }), { status: 200 });
const adapterWith = (registered) => ({ dhanClientId: '1000000001', getRegisteredStaticIps: async () => registered });

test('static IP: PASS only when Dhan whitelists it AND detected egress matches', async () => {
  process.env.DHAN_STATIC_IP = '203.0.113.10';
  clearStaticIpVerificationCache();
  const ok = await verifyDhanStaticIp(adapterWith({ primaryIP: '203.0.113.10' }), { force: true, fetchImpl: egress('203.0.113.10') });
  assert.equal(ok.ready, true);
  assert.equal(ok.status, 'PASS');

  const notWhitelisted = await verifyDhanStaticIp(adapterWith({ primaryIP: '198.51.100.1' }), { force: true, fetchImpl: egress('203.0.113.10') });
  assert.equal(notWhitelisted.ready, false);
  assert.equal(notWhitelisted.status, 'NOT_WHITELISTED_WITH_DHAN');

  const wrongEgress = await verifyDhanStaticIp(adapterWith({ primaryIP: '203.0.113.10' }), { force: true, fetchImpl: egress('192.0.2.55') });
  assert.equal(wrongEgress.ready, false);
  assert.equal(wrongEgress.status, 'EGRESS_IP_MISMATCH');
});

test('static IP: configured value alone is never treated as verified', () => {
  process.env.DHAN_STATIC_IP = '203.0.113.99';
  delete process.env.OUTBOUND_PUBLIC_IP;
  clearStaticIpVerificationCache();
  const readiness = getStaticIpReadiness('DHAN');
  assert.equal(readiness.ready, false);
  assert.equal(readiness.status, 'PENDING_EXTERNAL_CONFIGURATION');
});

test('Dhan order methods refuse locally when static IP is not verified (no order request sent)', async () => {
  process.env.DHAN_STATIC_IP = '203.0.113.10';
  clearStaticIpVerificationCache();
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    calls.push({ href, method: init.method || 'GET' });
    if (href.includes('/ip/getIP')) return new Response(JSON.stringify({ primaryIP: '198.51.100.1' }), { status: 200 });
    if (href.includes('ipify')) return new Response(JSON.stringify({ ip: '203.0.113.10' }), { status: 200 });
    throw new Error(`unexpected ${href}`);
  };
  const adapter = new DhanAdapter({ dhanClientId: '1000000001', accessToken: 'unit-token', tokenExpiresAt: '2099-01-01T00:00:00Z' });
  await assert.rejects(adapter.placeOrder({
    side: 'BUY', quantity: 65, price: 0,
    metadata: { securityId: '35070', exchangeSegment: 'NSE_FNO', tradingSymbol: 'NIFTY-Nov2026-18950-CE', expiry: '2026-11-23', optionType: 'CE', lotSize: 65 },
  }), (error) => error.code === 'STATIC_IP_NOT_READY');
  await assert.rejects(adapter.cancelOrder({ brokerOrderId: '1' }), (error) => error.code === 'STATIC_IP_NOT_READY');
  await assert.rejects(adapter.exitAllPositions(), (error) => error.code === 'STATIC_IP_NOT_READY');
  assert.equal(calls.some((call) => /\/orders|\/positions/.test(call.href)), false, 'no order/position mutation reached Dhan');
});

test('OMS never records a fill at an assumed price', () => {
  const order = { quantity: 65, price: 0, filled_quantity: 0, average_fill_price: null, status: 'SUBMITTED' };
  assert.throws(() => executionValues({ status: 'TRADED' }, order), MissingExecutionPriceError);
  assert.throws(() => executionValues({ status: 'PART_TRADED', filledQuantity: 30 }, order), MissingExecutionPriceError);
  const ok = executionValues({ status: 'TRADED', averageTradedPrice: 123.45 }, order);
  assert.equal(ok.averagePrice, 123.45);
  assert.equal(ok.filledQuantity, 65);
  const rejected = executionValues({ status: 'REJECTED', rejectionReason: 'RMS' }, order);
  assert.equal(rejected.averagePrice, null);
});

test('Dhan order-by-id (array or object) normalizes filledQty/averageTradedPrice/omsErrorDescription', () => {
  const fromArray = normalizeBrokerExecution([{ orderId: '9', orderStatus: 'TRADED', filledQty: 65, averageTradedPrice: 101.5 }]);
  assert.equal(fromArray.status, 'TRADED');
  assert.equal(fromArray.filledQuantity, 65);
  assert.equal(fromArray.averagePrice, 101.5);
  const rejected = normalizeBrokerExecution({ orderId: '9', orderStatus: 'REJECTED', omsErrorDescription: 'Insufficient funds' });
  assert.equal(rejected.rejectionReason, 'Insufficient funds');
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

test('Dhan order payload omits amoTime for regular orders', () => {
  const adapter = new DhanAdapter({ dhanClientId: '1000000001', accessToken: 'unit-token', tokenExpiresAt: '2099-01-01T00:00:00Z' });
  const payload = adapter.buildOrderPayload({
    side: 'BUY', quantity: 65, price: 0,
    metadata: { securityId: '35070', exchangeSegment: 'NSE_FNO', tradingSymbol: 'NIFTY-Nov2026-18950-CE', expiry: '2026-11-23', optionType: 'CE', lotSize: 65, orderType: 'MARKET' },
  });
  assert.equal('amoTime' in payload, false);
  for (const field of ['dhanClientId', 'correlationId', 'transactionType', 'exchangeSegment', 'productType', 'orderType', 'validity', 'securityId', 'quantity', 'price']) {
    assert.ok(field in payload, `${field} present`);
  }
});
