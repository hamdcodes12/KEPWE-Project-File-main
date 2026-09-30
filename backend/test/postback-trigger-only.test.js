// A Dhan postback is a trigger only: the execution applied is Dhan's own
// order record (GET /v2/orders/{id}), never the postback's price field.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.BROKER_TOKEN_ENCRYPTION_KEY = process.env.BROKER_TOKEN_ENCRYPTION_KEY || 'c'.repeat(64);
const { encryptBrokerSecret } = await import('../src/services/broker-token.service.js');
const { fetchAuthoritativeDhanOrder } = await import('../src/services/broker-execution.service.js');

test('authoritative Dhan order fetch returns the broker fill, not the postback price', async () => {
  const pool = { query: async () => ({ rows: [{ client_id: '1000000001', access_token_ciphertext: encryptBrokerSecret('unit-token'), token_expires_at: new Date('2099-01-01') }] }) };
  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/v2\/orders\/112111182198$/);
    return new Response(JSON.stringify({ orderId: '112111182198', orderStatus: 'TRADED', filledQty: 65, averageTradedPrice: 98.35, price: 0 }), { status: 200 });
  };
  const result = await fetchAuthoritativeDhanOrder(pool, { broker_account_id: 'a', user_id: 'u' }, '112111182198');
  assert.equal(result.ok, true);
  assert.equal(result.execution.status, 'TRADED');
  assert.equal(result.execution.filledQuantity, 65);
  assert.equal(result.execution.averagePrice, 98.35);
});

test('when Dhan cannot be read, the postback is deferred (nothing applied)', async () => {
  const pool = { query: async () => ({ rows: [] }) };
  const result = await fetchAuthoritativeDhanOrder(pool, { broker_account_id: 'a', user_id: 'u' }, '1');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'dhan_session_unavailable');
});
