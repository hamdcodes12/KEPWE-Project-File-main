// An Angel One postback is a trigger only: the execution applied is Angel One's
// own order record (SmartAPI order book), never the postback's own fields.
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { startMockSmartApi } from './support/mock-smartapi-server.js';

process.env.BROKER_TOKEN_ENCRYPTION_KEY = process.env.BROKER_TOKEN_ENCRYPTION_KEY || 'c'.repeat(64);
process.env.ANGEL_ONE_API_KEY = 'test-api-key';
process.env.ANGEL_ONE_DISABLE_RATE_GATE = 'true';
process.env.ANGEL_ONE_READ_RETRY_DELAYS_MS = '';
const { encryptBrokerSecret } = await import('../src/services/broker-token.service.js');
const { fetchAuthoritativeOrder } = await import('../src/services/broker-execution.service.js');

let api;
before(async () => {
  api = await startMockSmartApi();
  process.env.ANGEL_ONE_BASE_URL = api.baseUrl;
  console.warn = () => {};
});
after(async () => {
  await api.close();
  delete process.env.ANGEL_ONE_BASE_URL;
});

function poolFor(session) {
  const statements = [];
  return {
    statements,
    query: async (sql) => {
      statements.push(sql.replace(/\s+/g, ' ').trim());
      if (/^SELECT a\.id/.test(sql.trim())) {
        return { rows: session ? [{ id: 'acct-1', user_id: 'u', client_id: 'A123456', status: 'CONNECTED', connection_mode: 'LIVE', access_token_ciphertext: encryptBrokerSecret(session.jwtToken), refresh_token_ciphertext: null, feed_token_ciphertext: null, api_key_ciphertext: null, token_expires_at: new Date('2099-01-01') }] : [] };
      }
      return { rows: [] };
    },
  };
}

test('authoritative order fetch returns the broker fill, not the postback fields', async () => {
  const session = api.issueSession();
  api.state.orders.push({ variety: 'NORMAL', ordertype: 'MARKET', producttype: 'INTRADAY', duration: 'DAY', price: 0, quantity: '65', tradingsymbol: 'NIFTY24NOV2618950CE', transactiontype: 'BUY', exchange: 'NFO', symboltoken: '43854', orderid: '261007000012345', uniqueorderid: 'u-1', status: 'complete', filledshares: 65, averageprice: 98.35 });
  const result = await fetchAuthoritativeOrder(poolFor(session), { broker_account_id: 'acct-1', user_id: 'u' }, '261007000012345');
  assert.equal(result.ok, true);
  assert.equal(result.execution.status, 'FILLED');
  assert.equal(result.execution.filledQuantity, 65);
  assert.equal(result.execution.averagePrice, 98.35);
  assert.equal(api.requestsTo('getOrderBook').length, 1);
});

test('when Angel One cannot be read, the postback is deferred (nothing applied)', async () => {
  const noSession = await fetchAuthoritativeOrder(poolFor(null), { broker_account_id: 'a', user_id: 'u' }, '1');
  assert.deepEqual(noSession, { ok: false, reason: 'broker_session_unavailable' });
  assert.deepEqual(await fetchAuthoritativeOrder(poolFor(null), { broker_account_id: 'a', user_id: 'u' }, ''), { ok: false, reason: 'broker_order_id_unknown' });

  const session = api.issueSession();
  const unknownOrder = await fetchAuthoritativeOrder(poolFor(session), { broker_account_id: 'acct-1', user_id: 'u' }, '999');
  assert.equal(unknownOrder.ok, false);
  assert.match(unknownOrder.reason, /^broker_order_fetch_failed/);

  // An expired session defers the update and is recorded as SESSION_EXPIRED.
  api.expireJwts({ refreshTokensToo: true });
  const pool = poolFor(session);
  const expired = await fetchAuthoritativeOrder(pool, { broker_account_id: 'acct-1', user_id: 'u' }, '261007000012345');
  assert.equal(expired.ok, false);
  assert.ok(pool.statements.some((sql) => sql.startsWith("UPDATE broker_accounts SET status = 'SESSION_EXPIRED'")));
});
