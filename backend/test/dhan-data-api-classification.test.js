// Regression: a valid Dhan trading session must not be marked expired because
// the separately-subscribed Dhan Data API (market feed) rejects the token.
// Observed in production 2026-09-30: /v2/profile 200 (dataPlan "Deactive"),
// /v2/marketfeed/ltp 401 -> status endpoint wrote SESSION_EXPIRED.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DhanAdapter, parseDhanTokenValidity } from '../src/algo/broker-adapters.js';

const CLIENT_ID = '1000000001';
const FAKE_JWT_FREE_TOKEN = 'unit-test-token-not-real';

function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname.replace(/^\/v2/, '');
    calls.push({ path, headers: init.headers });
    const route = routes[path];
    if (!route) throw new Error(`unexpected path ${path}`);
    const { status = 200, body = {} } = typeof route === 'function' ? route() : route;
    return new Response(body === null ? '' : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

const profileOk = { status: 200, body: { dhanClientId: CLIENT_ID, tokenValidity: '01/10/2026 10:51', dataPlan: 'Deactive', dataValidity: 'NA' } };
const fundsOk = { status: 200, body: { availabelBalance: 0, utilizedAmount: 0, withdrawableBalance: 0, sodLimit: 0 } };

test('parses Dhan tokenValidity as IST', () => {
  assert.equal(parseDhanTokenValidity('01/10/2026 10:51').toISOString(), '2026-10-01T05:21:00.000Z');
  assert.equal(parseDhanTokenValidity('garbage'), null);
  assert.equal(parseDhanTokenValidity(null), null);
});

test('valid profile -> session valid, identity from Dhan, expiry from tokenValidity', async () => {
  mockFetch({ '/profile': profileOk, '/fundlimit': fundsOk });
  const adapter = new DhanAdapter({ dhanClientId: CLIENT_ID, accessToken: FAKE_JWT_FREE_TOKEN, tokenExpiresAt: '2099-01-01T00:00:00Z' });
  const result = await adapter.validateSession();
  assert.equal(result.valid, true);
  assert.equal(result.profile.clientId, CLIENT_ID);
  assert.equal(result.profile.dataPlan, 'Deactive');
  assert.equal(adapter.tokenExpiresAt.toISOString(), '2026-10-01T05:21:00.000Z');
});

test('market feed 401 is a Data API rejection, NOT a session expiry', async () => {
  mockFetch({ '/marketfeed/ltp': { status: 401, body: null } });
  const adapter = new DhanAdapter({ dhanClientId: CLIENT_ID, accessToken: FAKE_JWT_FREE_TOKEN, tokenExpiresAt: '2099-01-01T00:00:00Z' });
  await assert.rejects(adapter.getMarketData({ exchange: 'IDX_I', symbolToken: '13' }), (error) => {
    assert.equal(error.code, 'DHAN_DATA_API_UNAVAILABLE');
    assert.equal(error.dataApiRejected, true);
    assert.equal(error.httpStatus, 401);
    assert.notEqual(error.statusCode, 401);
    return true;
  });
});

test('profile 401 with Dhan errorCode is a real session rejection and keeps the Dhan code', async () => {
  mockFetch({ '/profile': { status: 401, body: { errorType: 'Invalid_Authentication', errorCode: 'DH-901', errorMessage: 'Client ID or user generated access token is invalid or expired.' } } });
  const adapter = new DhanAdapter({ dhanClientId: CLIENT_ID, accessToken: FAKE_JWT_FREE_TOKEN, tokenExpiresAt: '2099-01-01T00:00:00Z' });
  await assert.rejects(adapter.validateSession(), (error) => {
    assert.equal(error.code, 'BROKER_SESSION_EXPIRED');
    assert.equal(error.providerErrorCode, 'DH-901');
    assert.match(error.message, /DH-901/);
    assert.ok(!error.message.includes(FAKE_JWT_FREE_TOKEN));
    return true;
  });
});

test('profile for a different client ID is rejected as identity mismatch', async () => {
  mockFetch({ '/profile': { status: 200, body: { dhanClientId: '1000000002', tokenValidity: '01/10/2026 10:51' } }, '/fundlimit': fundsOk });
  const adapter = new DhanAdapter({ dhanClientId: CLIENT_ID, accessToken: FAKE_JWT_FREE_TOKEN, tokenExpiresAt: '2099-01-01T00:00:00Z' });
  await assert.rejects(adapter.validateSession(), (error) => error.code === 'BROKER_ACCOUNT_IDENTITY_MISMATCH');
});

test('profile without dhanClientId never falls back to the submitted client ID', async () => {
  mockFetch({ '/profile': { status: 200, body: { tokenValidity: '01/10/2026 10:51' } }, '/fundlimit': fundsOk });
  const adapter = new DhanAdapter({ dhanClientId: CLIENT_ID, accessToken: FAKE_JWT_FREE_TOKEN, tokenExpiresAt: '2099-01-01T00:00:00Z' });
  await assert.rejects(adapter.validateSession(), (error) => error.code === 'DHAN_PROFILE_INCOMPLETE');
});
