// ============================================================================
// Upstox Market-Data Service
// ----------------------------------------------------------------------------
// This is the ONLY place in the KEPWE backend that communicates with Upstox.
// The frontend NEVER calls Upstox directly — all requests flow:
//   Frontend → KEPWE Backend → Upstox → KEPWE Backend → Frontend
//
// Security:
//   - Reads UPSTOX_ACCESS_TOKEN from process.env only (never logs/exposes it).
//   - Never returns the token or any credentials in any response.
//
// Reliability:
//   - AbortController timeout (default 8 s, configurable via UPSTOX_TIMEOUT_MS).
//   - Sanitised error messages: Upstox response bodies are never forwarded to
//     clients because they may contain account diagnostics.
//
// Important: This service does NOT invent, fabricate, or fall back to mock
// market data. If Upstox is unavailable or the token is invalid, the service
// throws a MarketProviderError and the route layer returns a 503.
// ============================================================================

const API_BASE_URL = 'https://api.upstox.com/v2';
const DEFAULT_TIMEOUT_MS = 8_000;

// ── Instrument key constants ─────────────────────────────────────────────────
// These are the keys Upstox expects in the *request* query string.
// Upstox returns quotes keyed by the colon form (NSE_INDEX:Nifty 50) even
// though the request uses the pipe form (NSE_INDEX|Nifty 50).
// RESPONSE_KEY_MAP converts the request key → response key for the lookup.

const INSTRUMENT_KEYS = {
  NIFTY:     'NSE_INDEX|Nifty 50',
  BANKNIFTY: 'NSE_INDEX|Nifty Bank',
  FINNIFTY:  'NSE_INDEX|Nifty Fin Service',
};

// Display names for each symbol (Upstox does not return instrument_name for indices).
const DISPLAY_NAMES = {
  NIFTY:     'NIFTY 50',
  BANKNIFTY: 'BANK NIFTY',
  FINNIFTY:  'FINNIFTY',
};

// Upstox response keys use ':' instead of '|' as separator.
// Pre-build the lookup map: 'NSE_INDEX|Nifty 50' → 'NSE_INDEX:Nifty 50'
function toResponseKey(requestKey) {
  return requestKey.replace('|', ':');
}

// ── Custom error class ───────────────────────────────────────────────────────
class MarketProviderError extends Error {
  constructor(message, statusCode = 503) {
    super(message);
    this.name = 'MarketProviderError';
    this.statusCode = statusCode;
  }
}

// ── Token accessor ───────────────────────────────────────────────────────────
function getAccessToken() {
  const token = process.env.UPSTOX_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new MarketProviderError('UPSTOX_ACCESS_TOKEN is not configured');
  }
  return token;
}

// ── HTTP helper ──────────────────────────────────────────────────────────────
async function request(path, query = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.UPSTOX_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  );

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      // Do NOT forward the Upstox response body — it may contain account/token
      // diagnostics that must not be exposed to API consumers.
      const hint =
        response.status === 401 || response.status === 403
          ? 'Upstox access token was rejected or has expired'
          : `Upstox request failed with HTTP ${response.status}`;
      throw new MarketProviderError(hint);
    }
    return response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new MarketProviderError('Upstox request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Symbol validation ────────────────────────────────────────────────────────
function symbolKey(symbol) {
  const key = INSTRUMENT_KEYS[String(symbol).toUpperCase()];
  if (!key) throw new MarketProviderError(`Unsupported market symbol: ${symbol}`, 400);
  return key;
}

// ── Public: Index Quotes ─────────────────────────────────────────────────────
/**
 * Fetch live index quotes from Upstox for the given symbols.
 *
 * @param {string[]} symbols  e.g. ['NIFTY', 'BANKNIFTY', 'FINNIFTY']
 * @returns {Promise<Array>}  Normalised quote objects; data:null on failure.
 */
export async function getIndexQuotes(symbols) {
  const requestKeys = symbols.map(symbolKey);
  const payload = await request('/market-quote/quotes', {
    instrument_key: requestKeys.join(','),
  });
  const quoteData = payload.data || {};

  return symbols.map((symbol) => {
    const requestKey = symbolKey(symbol);
    // Upstox returns the quote keyed by the colon form, not the pipe form.
    const responseKey = toResponseKey(requestKey);
    const quote = quoteData[responseKey];

    if (!quote) {
      return {
        symbol,
        data: null,
        source: 'UPSTOX',
        limitation: `Upstox returned no quote for ${symbol}.`,
      };
    }

    const price = Number(quote.last_price) || 0;
    const change = Number(quote.net_change) || 0;
    // Compute changePercent from net_change and previous close (last_price - net_change).
    const prevClose = price - change;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    return {
      symbol,
      source: 'UPSTOX',
      data: {
        name:          DISPLAY_NAMES[symbol.toUpperCase()] || symbol,
        price,
        change:        Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        // Upstox does not provide VIX, IQ Score, or KEPWE analytics in this endpoint.
        // Those fields are intentionally omitted — the route layer sets them to null.
        lastTradeTime: quote.timestamp || null,
      },
    };
  });
}

// ── Public: Option Chain ─────────────────────────────────────────────────────
/**
 * Auto-resolve the nearest active expiry date for a given instrument.
 */
async function resolveExpiryDate(instrumentKey) {
  const payload = await request('/option/contract', { instrument_key: instrumentKey });
  const today = new Date().toISOString().slice(0, 10);
  const expiries = [
    ...new Set(
      (payload.data || []).map((item) => item.expiry).filter(Boolean)
    ),
  ]
    .filter((expiry) => expiry >= today)
    .sort();

  if (expiries.length === 0) {
    throw new MarketProviderError('Upstox returned no active option expiry for this symbol');
  }
  return expiries[0];
}

/**
 * Fetch the option chain from Upstox for a given symbol and optional expiry.
 *
 * @param {string} symbol           e.g. 'NIFTY'
 * @param {string} [requestedExpiry] ISO date string e.g. '2026-09-25'
 * @returns {Promise<Object>}       { source, expiryDate, data: [...] }
 */
export async function getOptionChain(symbol, requestedExpiry) {
  const instrumentKey = symbolKey(symbol);
  const expiryDate = requestedExpiry || (await resolveExpiryDate(instrumentKey));

  const payload = await request('/option/chain', {
    instrument_key: instrumentKey,
    expiry_date: expiryDate,
  });

  const rows = payload.data || [];

  // Determine the ATM strike: the strike closest to the current spot price.
  // Upstox includes underlying_spot_price in each row.
  const spotPrice =
    rows.length > 0 ? Number(rows[0].underlying_spot_price || 0) : 0;
  const atmStrike = spotPrice > 0
    ? rows.reduce((closest, row) => {
        const diff = Math.abs(Number(row.strike_price) - spotPrice);
        return diff < Math.abs(Number(closest.strike_price) - spotPrice) ? row : closest;
      }, rows[0])?.strike_price
    : null;

  // Format large OI numbers to a human-readable string (e.g. 1820000 → '18.2L').
  function formatOi(raw) {
    if (raw === null || raw === undefined) return null;
    const n = Number(raw);
    if (n === 0) return '0';
    if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000)    return `${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000)      return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  return {
    source: 'UPSTOX',
    expiryDate,
    spotPrice: spotPrice || null,
    data: rows.map((row) => {
      const callOiRaw = row.call_options?.market_data?.oi ?? 0;
      const putOiRaw  = row.put_options?.market_data?.oi ?? 0;
      return {
        strike:      Number(row.strike_price),
        callOi:      formatOi(callOiRaw),
        callOiRaw:   Number(callOiRaw),
        callIv:      Number(row.call_options?.option_greeks?.iv    ?? 0),
        putIv:       Number(row.put_options?.option_greeks?.iv     ?? 0),
        putOi:       formatOi(putOiRaw),
        putOiRaw:    Number(putOiRaw),
        deltaCall:   Number(row.call_options?.option_greeks?.delta ?? 0),
        thetaCall:   Number(row.call_options?.option_greeks?.theta ?? 0),
        gammaCall:   Number(row.call_options?.option_greeks?.gamma ?? 0),
        vegaCall:    Number(row.call_options?.option_greeks?.vega  ?? 0),
        isAtm:       atmStrike !== null && Number(row.strike_price) === Number(atmStrike),
      };
    }),
  };
}

export default { getIndexQuotes, getOptionChain };
