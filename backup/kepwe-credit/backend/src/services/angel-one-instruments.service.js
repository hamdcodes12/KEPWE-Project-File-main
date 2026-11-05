// Official Angel One SmartAPI instrument master ("scrip master"):
//   https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json
//
// Row shape published by Angel One:
//   { "token": "99926000", "symbol": "Nifty 50", "name": "NIFTY", "expiry": "",
//     "strike": "0.000000", "lotsize": "1", "instrumenttype": "AMXIDX",
//     "exch_seg": "NSE", "tick_size": "0.000000" }
//   { "token": "43854", "symbol": "NIFTY28NOV2424000CE", "name": "NIFTY",
//     "expiry": "28NOV2024", "strike": "2400000.000000", "lotsize": "25",
//     "instrumenttype": "OPTIDX", "exch_seg": "NFO", "tick_size": "5.000000" }
// Strikes are published multiplied by 100. Tokens are only unique within an
// exchange segment, so rows are keyed by "<EXCHANGE>:<TOKEN>" (e.g. "NSE:99926000").
//
// Nothing here is hardcoded per instrument: tokens, lot sizes and expiries are
// always read from the downloaded master. If the master cannot confirm an
// instrument, the lookup throws.

const DEFAULT_MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';
const MASTER_TTL_MS = 6 * 60 * 60 * 1000;
const INDEX_TYPES = new Set(['AMXIDX']);
const DERIVATIVE_TYPES = new Set(['OPTIDX', 'FUTIDX']);
const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

let cache = { loadedAt: 0, master: null, loading: null };

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function masterUrl() {
  return String(process.env.ANGEL_ONE_SCRIP_MASTER_URL || '').trim() || DEFAULT_MASTER_URL;
}

/** "28NOV2024" -> "2024-11-28"; anything else -> null. */
export function parseAngelExpiry(value) {
  const match = /^(\d{2})([A-Za-z]{3})(\d{4})$/.exec(String(value || '').trim());
  if (!match) return null;
  const month = MONTHS[match[2].toUpperCase()];
  return month ? `${match[3]}-${month}-${match[1]}` : null;
}

function instrumentError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Builds the lookup structure from the scrip master rows. Keeps NSE indices,
 * NSE cash equities and NFO index derivatives (the segments KEPWE Quant trades
 * or charts); everything else is dropped to bound memory.
 */
export function parseAngelScripMaster(input) {
  const rows = typeof input === 'string' ? JSON.parse(input) : input;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw instrumentError('Angel One instrument master is empty', 'ANGEL_ONE_INSTRUMENT_MASTER_INVALID');
  }
  const sample = rows[0] || {};
  const missing = ['token', 'symbol', 'name', 'exch_seg', 'instrumenttype', 'lotsize'].filter((key) => !(key in sample));
  if (missing.length > 0) {
    throw instrumentError(`Angel One instrument master is missing required fields: ${missing.join(', ')}`, 'ANGEL_ONE_INSTRUMENT_MASTER_INVALID');
  }
  const byKey = new Map();
  const derivativesByUnderlying = new Map();
  for (const row of rows) {
    const exchange = String(row.exch_seg || '').trim().toUpperCase();
    const token = String(row.token || '').trim();
    const instrumentType = String(row.instrumenttype || '').trim().toUpperCase();
    const tradingSymbol = String(row.symbol || '').trim();
    if (!exchange || !token || !tradingSymbol) continue;
    const isIndex = exchange === 'NSE' && INDEX_TYPES.has(instrumentType);
    const isEquity = exchange === 'NSE' && instrumentType === '' && tradingSymbol.toUpperCase().endsWith('-EQ');
    const isDerivative = exchange === 'NFO' && DERIVATIVE_TYPES.has(instrumentType);
    if (!isIndex && !isEquity && !isDerivative) continue;
    const optionType = instrumentType === 'OPTIDX' && /(CE|PE)$/i.test(tradingSymbol) ? tradingSymbol.slice(-2).toUpperCase() : null;
    const rawStrike = number(row.strike);
    const entry = {
      symbolToken: token,
      securityId: token,
      exchange,
      exchangeSegment: exchange,
      instrument: isIndex ? 'INDEX' : (isEquity ? 'EQUITY' : instrumentType),
      underlyingSymbol: String(row.name || '').trim().toUpperCase() || null,
      tradingSymbol,
      displayName: tradingSymbol,
      expiryRaw: String(row.expiry || '').trim().toUpperCase() || null,
      expiry: parseAngelExpiry(row.expiry),
      strike: optionType && rawStrike !== null ? rawStrike / 100 : null,
      optionType,
      lotSize: number(row.lotsize),
      tickSize: number(row.tick_size) === null ? null : number(row.tick_size) / 100,
      tradable: true,
    };
    byKey.set(`${exchange}:${token}`, entry);
    if (isDerivative && entry.underlyingSymbol) {
      if (!derivativesByUnderlying.has(entry.underlyingSymbol)) derivativesByUnderlying.set(entry.underlyingSymbol, []);
      derivativesByUnderlying.get(entry.underlyingSymbol).push(entry);
    }
  }
  if (byKey.size === 0) {
    throw instrumentError('Angel One instrument master contained no NSE index, NSE equity or NFO index-derivative rows', 'ANGEL_ONE_INSTRUMENT_MASTER_INVALID');
  }
  return { byKey, derivativesByUnderlying, size: byKey.size };
}

export async function loadAngelInstrumentMaster({ force = false, fetchImpl = fetch } = {}) {
  if (!force && cache.master && Date.now() - cache.loadedAt < MASTER_TTL_MS) return cache.master;
  if (cache.loading) return cache.loading;
  cache.loading = (async () => {
    try {
      let response;
      try {
        response = await fetchImpl(masterUrl());
      } catch (error) {
        throw instrumentError(`Angel One instrument master unavailable: ${error.message}`, 'ANGEL_ONE_INSTRUMENT_MASTER_UNAVAILABLE');
      }
      if (!response.ok) {
        throw instrumentError(`Angel One instrument master unavailable: HTTP ${response.status}`, 'ANGEL_ONE_INSTRUMENT_MASTER_UNAVAILABLE');
      }
      const master = parseAngelScripMaster(await response.text());
      cache = { loadedAt: Date.now(), master, loading: null };
      return master;
    } finally {
      cache.loading = null;
    }
  })();
  return cache.loading;
}

export function clearAngelInstrumentMasterCache() {
  cache = { loadedAt: 0, master: null, loading: null };
}

/** Looks up a contract by exchange + symbol token. */
export function findAngelInstrument(master, exchange, symbolToken) {
  if (!master || symbolToken === undefined || symbolToken === null) return null;
  return master.byKey.get(`${String(exchange || '').toUpperCase()}:${symbolToken}`) || null;
}

/**
 * Resolves an NSE index (default NIFTY 50) from the official master. Never
 * falls back to a hardcoded token: if the master has no such row, it throws.
 */
export function resolveAngelIndexInstrument(master, symbol = 'NIFTY') {
  const wanted = String(symbol).trim().toUpperCase();
  for (const row of master.byKey.values()) {
    if (row.instrument !== 'INDEX' || row.exchange !== 'NSE') continue;
    if (row.underlyingSymbol === wanted || row.tradingSymbol.toUpperCase() === wanted) {
      return {
        symbol: row.underlyingSymbol || wanted,
        name: row.tradingSymbol,
        symbolToken: row.symbolToken,
        securityId: row.symbolToken,
        exchange: 'NSE',
        exchangeSegment: 'NSE',
        tradingSymbol: row.tradingSymbol,
        source: 'ANGEL_ONE_SCRIP_MASTER',
      };
    }
  }
  throw instrumentError(`Angel One instrument master has no NSE index row for ${wanted}`, 'ANGEL_ONE_INSTRUMENT_NOT_FOUND');
}

export async function getNiftyIndexInstrument() {
  return resolveAngelIndexInstrument(await loadAngelInstrumentMaster(), 'NIFTY');
}

/**
 * Resolves a user-supplied symbol ("NIFTY 50", "NIFTY", "RELIANCE", "RELIANCE-EQ")
 * on NSE to its token. Indices are tried first, then cash equities.
 */
export function resolveAngelSymbol(master, symbol, exchange = 'NSE') {
  const wanted = String(symbol || '').trim().toUpperCase();
  const exch = String(exchange || 'NSE').trim().toUpperCase();
  if (!wanted) throw instrumentError('A symbol is required', 'ANGEL_ONE_INSTRUMENT_NOT_FOUND');
  if (exch === 'NSE') {
    try {
      return resolveAngelIndexInstrument(master, wanted === 'NIFTY 50' ? 'NIFTY' : wanted);
    } catch { /* fall through to equities */ }
  }
  const equitySymbol = wanted.endsWith('-EQ') ? wanted : `${wanted}-EQ`;
  for (const row of master.byKey.values()) {
    if (row.exchange !== exch) continue;
    const tradingSymbol = row.tradingSymbol.toUpperCase();
    if (tradingSymbol === wanted || (row.instrument === 'EQUITY' && tradingSymbol === equitySymbol)) {
      return {
        symbol: row.underlyingSymbol || wanted,
        name: row.tradingSymbol,
        symbolToken: row.symbolToken,
        securityId: row.symbolToken,
        exchange: row.exchange,
        exchangeSegment: row.exchange,
        tradingSymbol: row.tradingSymbol,
        source: 'ANGEL_ONE_SCRIP_MASTER',
      };
    }
  }
  throw instrumentError(`Angel One instrument master has no ${exch} instrument for "${symbol}"`, 'ANGEL_ONE_INSTRUMENT_NOT_FOUND');
}

function istToday(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(now));
}

/**
 * Index option contracts for the nearest non-expired expiry of an underlying.
 * Returns { expiry: 'YYYY-MM-DD', expiryRaw: '28NOV2026', contracts: [...] } or
 * expiry null when the master lists none.
 */
export function nearestOptionExpiryContracts(master, underlying = 'NIFTY', now = Date.now()) {
  const today = istToday(now);
  const options = (master.derivativesByUnderlying.get(String(underlying).toUpperCase()) || [])
    .filter((row) => row.instrument === 'OPTIDX' && row.optionType && row.expiry && row.expiry >= today && row.strike !== null && row.lotSize > 0);
  if (options.length === 0) return { expiry: null, expiryRaw: null, contracts: [] };
  const expiry = options.reduce((earliest, row) => (row.expiry < earliest ? row.expiry : earliest), options[0].expiry);
  const contracts = options.filter((row) => row.expiry === expiry).sort((a, b) => a.strike - b.strike || a.optionType.localeCompare(b.optionType));
  return { expiry, expiryRaw: contracts[0].expiryRaw, contracts };
}

/**
 * NSE quantity-freeze limit for NIFTY index options. Angel One's master does
 * not publish it and NSE revises it by circular, so it is operator-configured
 * (ANGEL_ONE_NIFTY_FREEZE_QTY). Unknown => null, which blocks order sizing.
 */
export function niftyFreezeQuantity() {
  const value = Number(String(process.env.ANGEL_ONE_NIFTY_FREEZE_QTY || '').trim());
  return Number.isInteger(value) && value > 1 ? value : null;
}
