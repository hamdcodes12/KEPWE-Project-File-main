// Market-data layer: official instrument master, Dhan error classification,
// quote parsing, and the broker/market-data status split. No network, no DB.
import assert from 'node:assert/strict';
import test from 'node:test';

process.env.BROKER_TOKEN_ENCRYPTION_KEY = process.env.BROKER_TOKEN_ENCRYPTION_KEY || 'a'.repeat(64);

const { classifyDhanError, parseDhanDateTime, DhanAdapter } = await import('../src/algo/broker-adapters.js');
const { parseDhanInstrumentMaster, resolveDhanIndexInstrument, findNseFnoContract } = await import('../src/services/dhan-instruments.service.js');
const { getDhanMarketFeed, clearDhanMarketFeedCache, readDhanQuote, isDhanDataPlanActive } = await import('../src/services/dhan-market-feed.service.js');
const { encryptBrokerSecret } = await import('../src/services/broker-token.service.js');

// Header and rows copied from the official file (images.dhan.co/api-data/api-scrip-master-detailed.csv, 2026-09-30).
const MASTER_CSV = [
  'EXCH_ID,SEGMENT,SECURITY_ID,ISIN,INSTRUMENT,UNDERLYING_SECURITY_ID,UNDERLYING_SYMBOL,SYMBOL_NAME,DISPLAY_NAME,INSTRUMENT_TYPE,SERIES,LOT_SIZE,SM_EXPIRY_DATE,STRIKE_PRICE,OPTION_TYPE,TICK_SIZE,EXPIRY_FLAG,BRACKET_FLAG,COVER_FLAG,ASM_GSM_FLAG,ASM_GSM_CATEGORY,BUY_SELL_INDICATOR,BUY_CO_MIN_MARGIN_PER,BUY_CO_SL_RANGE_MAX_PERC,BUY_CO_SL_RANGE_MIN_PERC,BUY_BO_MIN_MARGIN_PER,BUY_BO_PROFIT_RANGE_MAX_PERC,BUY_BO_PROFIT_RANGE_MIN_PERC,MTF_LEVERAGE,SM_UPPER_LIMIT,SM_LOWER_LIMIT,SM_FREEZE_QTY,',
  'NSE,I,13,NA,INDEX,13,NIFTY,NIFTY,Nifty 50,INDEX,NA,1.0,0001-01-01,,XX,0.0500,N,N,N,N,NA,A,0,0,0,0,0,0,0,0.0000,0.0000,0,',
  'NSE,D,35070,NA,OPTIDX,26000,NIFTY,NIFTY-Nov2026-18950-CE,NIFTY 23 NOV 18950 CALL,OP,NA,65.0,2026-11-23,18950.00000,CE,5.0000,M,N,N,N,NA,A,0,0,0,0,0,0,0,4500.4000,3369.3000,1756,',
  'NSE,E,13,INE000000000,EQUITY,,,SOMESTOCK,Some Stock,ES,EQ,1.0,0001-01-01,,XX,0.0500,N,N,N,N,NA,A,0,0,0,0,0,0,0,0.0000,0.0000,0,',
].join('\n');

test('instrument master: NIFTY 50 resolves to IDX_I 13 from the official row; segments do not collide', () => {
  const master = parseDhanInstrumentMaster(MASTER_CSV);
  const nifty = resolveDhanIndexInstrument(master, 'NIFTY');
  assert.deepEqual({ id: nifty.securityId, seg: nifty.exchangeSegment, src: nifty.source }, { id: '13', seg: 'IDX_I', src: 'DHAN_INSTRUMENT_MASTER' });
  const option = findNseFnoContract(master, '35070');
  assert.equal(option.tradingSymbol, 'NIFTY-Nov2026-18950-CE');
  assert.equal(option.underlyingSymbol, 'NIFTY');
  assert.equal(option.lotSize, 65);
  assert.equal(option.optionType, 'CE');
  assert.equal(master.has('NSE_EQ:13'), false, 'equity rows are not kept and cannot overwrite IDX_I:13');
});

test('instrument master: missing index row is an error, never a hardcoded fallback', () => {
  const master = parseDhanInstrumentMaster(MASTER_CSV.split('\n').filter((line) => !line.startsWith('NSE,I,')).join('\n'));
  assert.throws(() => resolveDhanIndexInstrument(master, 'NIFTY'), (error) => error.code === 'DHAN_INSTRUMENT_NOT_FOUND');
});

test('Dhan documented error codes classify distinctly', () => {
  const c = (providerErrorCode, httpStatus, dataApi = true) => classifyDhanError({ providerErrorCode, httpStatus }, { dataApi });
  assert.equal(c('DH-901', 401), 'AUTH_FAILED');
  assert.equal(c('DH-902', 403), 'DATA_API_NOT_ACTIVE');
  assert.equal(c('806', 401), 'DATA_API_NOT_ACTIVE');
  assert.equal(c('810', 400), 'INVALID_CLIENT_ID');
  assert.equal(c('813', 400), 'INVALID_SECURITY_ID');
  assert.equal(c('DH-904', 429), 'RATE_LIMITED');
  assert.equal(c('805', 429), 'RATE_LIMITED');
  assert.equal(c('DH-907', 400), 'MARKET_DATA_ERROR');
  assert.equal(c('DH-908', 500), 'UPSTREAM_ERROR');
  assert.equal(c(null, 401), 'DATA_API_ACCESS_DENIED');
  assert.equal(c(null, 401, false), 'AUTH_FAILED');
  assert.equal(classifyDhanError({ code: 'NETWORK_ERROR' }), 'NETWORK_ERROR');
});

test('Dhan IST timestamps: DD/MM/YYYY and placeholder handling', () => {
  assert.equal(parseDhanDateTime('30/09/2026 11:20:05').toISOString(), '2026-09-30T05:50:05.000Z');
  assert.equal(parseDhanDateTime('01/01/1980 00:00:00'), null);
  assert.equal(isDhanDataPlanActive('Active'), true);
  assert.equal(isDhanDataPlanActive('Deactive'), false);
  assert.equal(isDhanDataPlanActive(undefined), null);
});

test('quote parsing follows the documented /marketfeed/quote shape', () => {
  const quote = readDhanQuote({ data: { IDX_I: { 13: { last_price: 22681.5, last_trade_time: '30/09/2026 11:20:05', net_change: -35.2, ohlc: { open: 22700, high: 22750, low: 22650, close: 22716.7 } } } }, status: 'success' }, 'IDX_I', '13');
  assert.equal(quote.price, 22681.5);
  assert.equal(quote.ltt, '2026-09-30T05:50:05.000Z');
  assert.equal(quote.netChange, -35.2);
});

test('numeric Data-API error body {data:{"806":...}} is surfaced with its code', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { 806: 'Data APIs not subscribed' }, status: 'failed' }), { status: 401 });
  const adapter = new DhanAdapter({ dhanClientId: '1000000001', accessToken: 'unit-token', tokenExpiresAt: '2099-01-01T00:00:00Z' });
  await assert.rejects(adapter.getQuote({ exchangeSegment: 'IDX_I', securityIds: ['13'] }), (error) => {
    assert.equal(error.providerErrorCode, '806');
    assert.equal(error.dhanCategory, 'DATA_API_NOT_ACTIVE');
    assert.equal(error.code, 'DHAN_DATA_API_UNAVAILABLE');
    return true;
  });
});

function feedHarness({ profile, quote }) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes('images.dhan.co')) return new Response(MASTER_CSV, { status: 200 });
    const path = new URL(href).pathname.replace(/^\/v2/, '');
    calls.push({ path, body: init.body || null });
    if (path === '/profile') return new Response(JSON.stringify(profile), { status: 200 });
    if (path === '/fundlimit') return new Response(JSON.stringify({ availabelBalance: 0 }), { status: 200 });
    if (path === '/marketfeed/quote') return typeof quote === 'function' ? quote() : new Response(JSON.stringify(quote), { status: 200 });
    throw new Error(`unexpected ${path}`);
  };
  const pool = {
    query: async () => ({ rows: [{ id: 'acct-1', client_id: '1000000001', status: 'CONNECTED', connection_mode: 'LIVE', access_token_ciphertext: encryptBrokerSecret('unit-token'), token_expires_at: new Date('2099-01-01T00:00:00Z') }] }),
  };
  return { calls, pool };
}

test('dataPlan Deactive -> DATA_API_NOT_ACTIVE, broker stays CONNECTED, no quote call spent', async () => {
  clearDhanMarketFeedCache();
  const { calls, pool } = feedHarness({ profile: { dhanClientId: '1000000001', tokenValidity: '01/10/2026 10:51', dataPlan: 'Deactive', dataValidity: 'NA' }, quote: {} });
  const feed = await getDhanMarketFeed(pool, 'user-a');
  assert.equal(feed.broker.status, 'CONNECTED');
  assert.equal(feed.marketData.status, 'DATA_API_NOT_ACTIVE');
  assert.equal(feed.code, 'DATA_API_NOT_ACTIVE');
  assert.equal(feed.connected, false);
  assert.equal(feed.sessionConnected, true);
  assert.equal(calls.some((call) => call.path === '/marketfeed/quote'), false);
});

test('active plan + real quote -> LIVE via master-resolved IDX_I 13, cached across rapid polls', async () => {
  clearDhanMarketFeedCache();
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const ltt = `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)}/${ist.getUTCFullYear()} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
  const { calls, pool } = feedHarness({
    profile: { dhanClientId: '1000000001', dataPlan: 'Active', dataValidity: '2026-12-31 00:00:00.0' },
    quote: { data: { IDX_I: { 13: { last_price: 22681.5, last_trade_time: ltt, net_change: -35.2 } } }, status: 'success' },
  });
  const first = await getDhanMarketFeed(pool, 'user-b');
  const second = await getDhanMarketFeed(pool, 'user-b');
  assert.equal(first.marketData.status, 'LIVE');
  assert.equal(first.connected, true);
  assert.equal(first.price, 22681.5);
  assert.equal(first.marketData.instrument.securityId, '13');
  assert.equal(first.marketData.instrument.source, 'DHAN_INSTRUMENT_MASTER');
  assert.deepEqual(JSON.parse(calls.find((call) => call.path === '/marketfeed/quote').body), { IDX_I: [13] });
  assert.equal(calls.filter((call) => call.path === '/marketfeed/quote').length, 1, 'second poll served from cache');
  assert.equal(second, first);
});

test('active plan but quote rejected with 806 -> DATA_API_NOT_ACTIVE with Dhan code; broker unaffected', async () => {
  clearDhanMarketFeedCache();
  const { pool } = feedHarness({
    profile: { dhanClientId: '1000000001', dataPlan: 'Active' },
    quote: () => new Response(JSON.stringify({ data: { 806: 'Data APIs not subscribed' }, status: 'failed' }), { status: 401 }),
  });
  const feed = await getDhanMarketFeed(pool, 'user-c');
  assert.equal(feed.broker.status, 'CONNECTED');
  assert.equal(feed.marketData.status, 'DATA_API_NOT_ACTIVE');
  assert.equal(feed.marketData.dhanErrorCode, '806');
});

test('rate limit and invalid security id are reported as such', async () => {
  for (const [body, status, expected] of [
    [{ errorType: 'Rate_Limit', errorCode: 'DH-904', errorMessage: 'Too many requests' }, 429, 'RATE_LIMITED'],
    [{ data: { 813: 'Invalid SecurityId' }, status: 'failed' }, 400, 'INVALID_SECURITY_ID'],
  ]) {
    clearDhanMarketFeedCache();
    const { pool } = feedHarness({ profile: { dhanClientId: '1000000001', dataPlan: 'Active' }, quote: () => new Response(JSON.stringify(body), { status }) });
    const feed = await getDhanMarketFeed(pool, `user-${expected}`);
    assert.equal(feed.broker.status, 'CONNECTED');
    assert.equal(feed.marketData.status, expected);
  }
});
