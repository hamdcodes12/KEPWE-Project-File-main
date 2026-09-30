// Official Dhan instrument master (https://images.dhan.co/api-data/api-scrip-master-detailed.csv).
//
// Verified against the live file on 2026-09-30:
//   header: EXCH_ID,SEGMENT,SECURITY_ID,ISIN,INSTRUMENT,UNDERLYING_SECURITY_ID,UNDERLYING_SYMBOL,
//           SYMBOL_NAME,DISPLAY_NAME,INSTRUMENT_TYPE,SERIES,LOT_SIZE,SM_EXPIRY_DATE,STRIKE_PRICE,OPTION_TYPE,...
//   NIFTY 50 index row:  NSE,I,13,NA,INDEX,13,NIFTY,NIFTY,Nifty 50,INDEX,...
//   NIFTY option rows:   NSE,D,<id>,NA,OPTIDX,26000,NIFTY,NIFTY-Nov2026-18950-CE,...   (underlying id is 26000, NOT 13)
//
// SECURITY_ID is only unique within an exchange segment, so rows are keyed by
// "<DHAN_SEGMENT>:<SECURITY_ID>" (e.g. "IDX_I:13", "NSE_FNO:35070").

const DHAN_INSTRUMENT_MASTER_URL = 'https://images.dhan.co/api-data/api-scrip-master-detailed.csv';
const MASTER_TTL_MS = 6 * 60 * 60 * 1000;
const KEEP_SEGMENTS = new Set(['IDX_I', 'NSE_FNO']);

let cache = { loadedAt: 0, rows: null, loading: null };

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

/** Maps the master's EXCH_ID + SEGMENT to the Dhan API exchangeSegment enum. */
export function dhanSegmentFor(exchange, segment) {
  const exch = String(exchange || '').trim().toUpperCase();
  const seg = String(segment || '').trim().toUpperCase();
  if (seg === 'I') return 'IDX_I';
  const map = {
    'NSE:E': 'NSE_EQ', 'NSE:D': 'NSE_FNO', 'NSE:C': 'NSE_CURRENCY',
    'BSE:E': 'BSE_EQ', 'BSE:D': 'BSE_FNO', 'BSE:C': 'BSE_CURRENCY',
    'MCX:M': 'MCX_COMM',
  };
  return map[`${exch}:${seg}`] || (exch && seg ? `${exch}_${seg}` : null);
}

export function parseDhanInstrumentMaster(csvText) {
  const lines = String(csvText || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('Dhan instrument master is empty');
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const pick = (names) => names.find((name) => headers.includes(name));
  const fields = {
    exchange: pick(['EXCH_ID', 'SEM_EXM_EXCH_ID']),
    segment: pick(['SEGMENT', 'SEM_SEGMENT']),
    securityId: pick(['SECURITY_ID', 'SEM_SMST_SECURITY_ID']),
    instrument: pick(['INSTRUMENT', 'SEM_INSTRUMENT_NAME']),
    underlyingSecurityId: pick(['UNDERLYING_SECURITY_ID', 'SEM_UNDERLYING_SECURITY_ID']),
    underlyingSymbol: pick(['UNDERLYING_SYMBOL', 'SM_SYMBOL_NAME']),
    tradingSymbol: pick(['SYMBOL_NAME', 'SEM_TRADING_SYMBOL', 'TRADING_SYMBOL']),
    displayName: pick(['DISPLAY_NAME', 'SEM_CUSTOM_SYMBOL']),
    expiry: pick(['SM_EXPIRY_DATE', 'SEM_EXPIRY_DATE', 'EXPIRY_DATE']),
    strike: pick(['STRIKE_PRICE', 'SEM_STRIKE_PRICE']),
    optionType: pick(['OPTION_TYPE', 'SEM_OPTION_TYPE']),
    lotSize: pick(['LOT_SIZE', 'SEM_LOT_UNITS']),
  };
  const missing = ['exchange', 'segment', 'securityId', 'instrument', 'lotSize', 'expiry'].filter((key) => !fields[key]);
  if (missing.length > 0) {
    throw new Error(`Dhan instrument master is missing required columns: ${missing.join(', ')}`);
  }
  const index = Object.fromEntries(Object.entries(fields).map(([key, name]) => [key, name ? headers.indexOf(name) : -1]));
  const get = (values, key) => (index[key] >= 0 ? String(values[index[key]] ?? '').trim() : '');

  const rows = new Map();
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const exchangeSegment = dhanSegmentFor(get(values, 'exchange'), get(values, 'segment'));
    if (!KEEP_SEGMENTS.has(exchangeSegment)) continue;
    const securityId = get(values, 'securityId');
    if (!securityId) continue;
    const expiry = get(values, 'expiry');
    rows.set(`${exchangeSegment}:${securityId}`, {
      securityId,
      exchange: get(values, 'exchange') || null,
      exchangeSegment,
      instrument: get(values, 'instrument') || null,
      underlyingSecurityId: get(values, 'underlyingSecurityId') || null,
      underlyingSymbol: get(values, 'underlyingSymbol') || null,
      tradingSymbol: get(values, 'tradingSymbol') || null,
      displayName: get(values, 'displayName') || null,
      expiry: expiry && !expiry.startsWith('0001-') ? expiry : null,
      strike: number(get(values, 'strike')),
      optionType: ['CE', 'PE'].includes(get(values, 'optionType').toUpperCase()) ? get(values, 'optionType').toUpperCase() : null,
      lotSize: number(get(values, 'lotSize')),
      tradable: true,
    });
  }
  if (rows.size === 0) throw new Error('Dhan instrument master contained no index or NSE F&O rows');
  return rows;
}

export async function loadDhanInstrumentMaster({ force = false } = {}) {
  if (!force && cache.rows && Date.now() - cache.loadedAt < MASTER_TTL_MS) return cache.rows;
  if (cache.loading) return cache.loading;
  cache.loading = (async () => {
    try {
      const response = await fetch(DHAN_INSTRUMENT_MASTER_URL);
      if (!response.ok) throw new Error(`Dhan instrument master unavailable: HTTP ${response.status}`);
      const rows = parseDhanInstrumentMaster(await response.text());
      cache = { loadedAt: Date.now(), rows, loading: null };
      return rows;
    } finally {
      cache.loading = null;
    }
  })();
  return cache.loading;
}

/** Looks up an F&O contract by the security ID Dhan's option chain returns. */
export function findNseFnoContract(master, securityId) {
  if (!master || securityId === undefined || securityId === null) return null;
  return master.get(`NSE_FNO:${securityId}`) || master.get(String(securityId)) || null;
}

/**
 * Resolves an index (default NIFTY 50) from the official master. Never falls
 * back to a hardcoded ID: if the master cannot confirm the instrument, it throws.
 */
export function resolveDhanIndexInstrument(master, symbol = 'NIFTY') {
  const wanted = String(symbol).trim().toUpperCase();
  for (const row of master.values()) {
    if (row.exchangeSegment !== 'IDX_I' || row.exchange !== 'NSE') continue;
    if (String(row.instrument || '').toUpperCase() !== 'INDEX') continue;
    if (String(row.tradingSymbol || '').toUpperCase() === wanted || String(row.underlyingSymbol || '').toUpperCase() === wanted) {
      return {
        symbol: wanted,
        name: row.displayName || wanted,
        securityId: row.securityId,
        exchangeSegment: 'IDX_I',
        source: 'DHAN_INSTRUMENT_MASTER',
      };
    }
  }
  const error = new Error(`Dhan instrument master has no NSE INDEX row for ${wanted}`);
  error.code = 'DHAN_INSTRUMENT_NOT_FOUND';
  throw error;
}

export async function getNiftyIndexInstrument() {
  return resolveDhanIndexInstrument(await loadDhanInstrumentMaster(), 'NIFTY');
}
