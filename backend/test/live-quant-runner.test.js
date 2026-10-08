import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completedCandles,
  isFreshMarketTimestamp,
} from '../src/services/live-quant-runner.service.js';
import {
  findAngelInstrument,
  nearestOptionExpiryContracts,
  niftyFreezeQuantity,
  parseAngelExpiry,
  parseAngelScripMaster,
  resolveAngelIndexInstrument,
  resolveAngelSymbol,
} from '../src/services/angel-one-instruments.service.js';
import { buildOptionInstruments, selectStrikesAroundSpot } from '../src/services/angel-one-option-chain.service.js';
import { marketStatusFromError } from '../src/services/angel-one-market-feed.service.js';
import { selectNiftyScalpingOption } from '../src/services/nifty-scalping-strategy.service.js';

// Row shapes match the official Angel One scrip master (strikes are x100).
const MASTER_ROWS = [
  { token: '99926000', symbol: 'Nifty 50', name: 'NIFTY', expiry: '', strike: '0.000000', lotsize: '1', instrumenttype: 'AMXIDX', exch_seg: 'NSE', tick_size: '0.000000' },
  { token: '99926009', symbol: 'Nifty Bank', name: 'BANKNIFTY', expiry: '', strike: '0.000000', lotsize: '1', instrumenttype: 'AMXIDX', exch_seg: 'NSE', tick_size: '0.000000' },
  { token: '2885', symbol: 'RELIANCE-EQ', name: 'RELIANCE', expiry: '', strike: '-1.000000', lotsize: '1', instrumenttype: '', exch_seg: 'NSE', tick_size: '5.000000' },
  { token: '501', symbol: 'NIFTY24SEP2625000PE', name: 'NIFTY', expiry: '24SEP2026', strike: '2500000.000000', lotsize: '65', instrumenttype: 'OPTIDX', exch_seg: 'NFO', tick_size: '5.000000' },
  { token: '502', symbol: 'NIFTY24SEP2625000CE', name: 'NIFTY', expiry: '24SEP2026', strike: '2500000.000000', lotsize: '65', instrumenttype: 'OPTIDX', exch_seg: 'NFO', tick_size: '5.000000' },
  { token: '503', symbol: 'NIFTY24SEP2625050CE', name: 'NIFTY', expiry: '24SEP2026', strike: '2505000.000000', lotsize: '65', instrumenttype: 'OPTIDX', exch_seg: 'NFO', tick_size: '5.000000' },
  { token: '601', symbol: 'NIFTY01OCT2625000CE', name: 'NIFTY', expiry: '01OCT2026', strike: '2500000.000000', lotsize: '65', instrumenttype: 'OPTIDX', exch_seg: 'NFO', tick_size: '5.000000' },
  { token: '401', symbol: 'NIFTY17SEP2625000CE', name: 'NIFTY', expiry: '17SEP2026', strike: '2500000.000000', lotsize: '65', instrumenttype: 'OPTIDX', exch_seg: 'NFO', tick_size: '5.000000' },
  { token: '701', symbol: 'BANKNIFTY24SEP2650000PE', name: 'BANKNIFTY', expiry: '24SEP2026', strike: '5000000.000000', lotsize: '30', instrumenttype: 'OPTIDX', exch_seg: 'NFO', tick_size: '5.000000' },
  { token: '801', symbol: 'GOLD05OCT26FUT', name: 'GOLD', expiry: '05OCT2026', strike: '-1.000000', lotsize: '100', instrumenttype: 'FUTCOM', exch_seg: 'MCX', tick_size: '100.000000' },
];

test('live NIFTY timestamps reject stale and future quotes', () => {
  const now = Date.parse('2026-09-21T10:00:00.000Z');
  assert.equal(isFreshMarketTimestamp('2026-09-21T09:59:30.000Z', now), true);
  assert.equal(isFreshMarketTimestamp('2026-09-21T09:57:00.000Z', now), false);
  assert.equal(isFreshMarketTimestamp('2026-09-21T10:00:30.000Z', now), false);
});

test('Angel One candles exclude the incomplete current candle', () => {
  const now = Date.parse('2026-09-21T10:09:59.999Z');
  const candles = completedCandles([
    { timestamp: '2026-09-21T10:00:00.000Z', open: 100, high: 102, low: 99, close: 101, volume: 10 },
    { timestamp: '2026-09-21T10:05:00.000Z', open: 101, high: 103, low: 100, close: 102, volume: 20 },
    { timestamp: '2026-09-21T10:10:00.000Z', open: null, high: 103, low: 100, close: 102, volume: 20 },
  ], 5, now);
  assert.equal(candles.length, 1);
  assert.equal(candles[0].completed, true);
  assert.equal(candles[0].close, 101);
  assert.deepEqual(completedCandles(null, 5, now), []);
});

test('the official instrument master resolves indices, equities and option contracts', () => {
  const master = parseAngelScripMaster(JSON.stringify(MASTER_ROWS));
  assert.equal(master.byKey.has('MCX:801'), false, 'segments KEPWE does not use are dropped');
  const nifty = resolveAngelIndexInstrument(master, 'NIFTY');
  assert.deepEqual({ token: nifty.symbolToken, exchange: nifty.exchange, name: nifty.name, source: nifty.source }, { token: '99926000', exchange: 'NSE', name: 'Nifty 50', source: 'ANGEL_ONE_SCRIP_MASTER' });
  assert.equal(resolveAngelSymbol(master, 'nifty 50').symbolToken, '99926000');
  assert.equal(resolveAngelSymbol(master, 'RELIANCE').symbolToken, '2885');
  assert.throws(() => resolveAngelIndexInstrument(master, 'SENSEX'), (error) => error.code === 'ANGEL_ONE_INSTRUMENT_NOT_FOUND');
  const contract = findAngelInstrument(master, 'NFO', '501');
  assert.deepEqual({ strike: contract.strike, type: contract.optionType, expiry: contract.expiry, lot: contract.lotSize, underlying: contract.underlyingSymbol }, { strike: 25000, type: 'PE', expiry: '2026-09-24', lot: 65, underlying: 'NIFTY' });
  assert.equal(parseAngelExpiry('24SEP2026'), '2026-09-24');
  assert.equal(parseAngelExpiry(''), null);
  assert.throws(() => parseAngelScripMaster('[]'), /empty/);
  assert.throws(() => parseAngelScripMaster([{ foo: 1 }]), /missing required fields/);
});

test('nearest non-expired NIFTY expiry is chosen from the master (never hardcoded)', () => {
  const master = parseAngelScripMaster(MASTER_ROWS);
  const now = Date.parse('2026-09-21T04:30:00.000Z'); // 21 Sep 2026, 10:00 IST
  const chain = nearestOptionExpiryContracts(master, 'NIFTY', now);
  assert.equal(chain.expiry, '2026-09-24', 'the 17 Sep expiry is in the past, 24 Sep is next');
  assert.equal(chain.expiryRaw, '24SEP2026');
  assert.deepEqual(chain.contracts.map((c) => c.symbolToken).sort(), ['501', '502', '503']);
  // On expiry day itself the expiring contracts are still current.
  assert.equal(nearestOptionExpiryContracts(master, 'NIFTY', Date.parse('2026-09-24T04:30:00.000Z')).expiry, '2026-09-24');
  assert.equal(nearestOptionExpiryContracts(master, 'NIFTY', Date.parse('2027-01-01T04:30:00.000Z')).expiry, null);
  assert.deepEqual(selectStrikesAroundSpot(chain.contracts, 25010, 0).map((c) => c.strike), [25000, 25000]);
});

test('option chain keeps only contracts with a real two-sided quote and is selectable by the strategy', () => {
  const master = parseAngelScripMaster(MASTER_ROWS);
  const { contracts } = nearestOptionExpiryContracts(master, 'NIFTY', Date.parse('2026-09-21T04:30:00.000Z'));
  const receivedAt = Date.parse('2026-09-21T04:30:00.000Z');
  const instruments = buildOptionInstruments({
    contracts,
    receivedAt,
    freezeQuantity: 1800,
    greeks: [{ strike: 25000, optionType: 'PE', delta: -0.5 }],
    quotes: [
      { symbolToken: '501', ltp: 100, bid: 99.5, ask: 100.5, volume: 100 },
      { symbolToken: '502', ltp: 95, bid: null, ask: 96, volume: 100 }, // one-sided: dropped
      // 503 has no quote at all: dropped
    ],
  });
  assert.equal(instruments.length, 1);
  const [pe] = instruments;
  assert.deepEqual(
    { type: pe.optionType, delta: pe.delta, token: pe.securityId, symbol: pe.tradingSymbol, lot: pe.lotSize, freeze: pe.quantityFreeze, liquid: pe.isLiquid, expiry: pe.expiry },
    { type: 'PE', delta: -0.5, token: '501', symbol: 'NIFTY24SEP2625000PE', lot: 65, freeze: 1800, liquid: true, expiry: '2026-09-24T15:30:00+05:30' },
  );
  const selected = selectNiftyScalpingOption({ spotPrice: 25010, optionType: 'PE', instruments, now: receivedAt + 1000 });
  assert.equal(selected.contract.securityId, '501');
  assert.equal(selected.contract.premium, 100);
  // Quotes older than 3 seconds are not tradable.
  assert.equal(selectNiftyScalpingOption({ spotPrice: 25010, optionType: 'PE', instruments, now: receivedAt + 10_000 }).contract, null);
});

test('quantity freeze is operator-configured and unknown blocks sizing', () => {
  const previous = process.env.ANGEL_ONE_NIFTY_FREEZE_QTY;
  try {
    delete process.env.ANGEL_ONE_NIFTY_FREEZE_QTY;
    assert.equal(niftyFreezeQuantity(), null);
    process.env.ANGEL_ONE_NIFTY_FREEZE_QTY = '1800';
    assert.equal(niftyFreezeQuantity(), 1800);
    process.env.ANGEL_ONE_NIFTY_FREEZE_QTY = 'abc';
    assert.equal(niftyFreezeQuantity(), null);
  } finally {
    if (previous === undefined) delete process.env.ANGEL_ONE_NIFTY_FREEZE_QTY; else process.env.ANGEL_ONE_NIFTY_FREEZE_QTY = previous;
  }
});

test('market-data failures map to truthful feed statuses', () => {
  assert.equal(marketStatusFromError({ angelCategory: 'SESSION_EXPIRED' }), 'AUTH_FAILED');
  assert.equal(marketStatusFromError({ angelCategory: 'RATE_LIMITED' }), 'RATE_LIMITED');
  assert.equal(marketStatusFromError({ angelCategory: 'TIMEOUT' }), 'NETWORK_ERROR');
  assert.equal(marketStatusFromError({ angelCategory: 'NETWORK_ERROR' }), 'NETWORK_ERROR');
  assert.equal(marketStatusFromError({ angelCategory: 'NOT_FOUND' }), 'NO_DATA');
  assert.equal(marketStatusFromError(new Error('boom')), 'ERROR');
});
