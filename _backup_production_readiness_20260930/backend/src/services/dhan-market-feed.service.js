// Single verified Dhan market-feed path used by /api/quant/live-market,
// /api/quant/live-health and the live NIFTY runner.
//
// Broker session status and market-data status are reported separately:
//   broker.status     CONNECTED | NOT_CONNECTED | SESSION_EXPIRED | SESSION_CHECK_FAILED | IDENTITY_MISMATCH
//   marketData.status LIVE | STALE | DATA_API_NOT_ACTIVE | DATA_API_ACCESS_DENIED | AUTH_FAILED |
//                     INVALID_CLIENT_ID | INVALID_SECURITY_ID | RATE_LIMITED | NETWORK_ERROR |
//                     INSTRUMENT_MASTER_UNAVAILABLE | NO_DATA | ERROR | NOT_CHECKED
// A market-data failure never changes the persisted broker session state.

import { getBrokerAdapter, parseDhanDateTime } from '../algo/broker-adapters.js';
import { decryptBrokerSecret } from './broker-token.service.js';
import { getNiftyIndexInstrument } from './dhan-instruments.service.js';

export const MARKET_FRESHNESS_MS = 90_000;

// Per-user result cache + in-flight de-duplication, so page polling never
// multiplies calls to Dhan (Quote API limit: 1 request/second).
const CACHE_TTL_MS = {
  LIVE: 3_000,
  STALE: 10_000,
  NO_DATA: 10_000,
  RATE_LIMITED: 10_000,
  NETWORK_ERROR: 10_000,
  ERROR: 15_000,
  DATA_API_NOT_ACTIVE: 60_000,
  DATA_API_ACCESS_DENIED: 60_000,
  default: 15_000,
};
const resultCache = new Map();
const inFlight = new Map();
const lastLoggedStatus = new Map();

/** "Active" → true; "Deactive"/"Inactive"/"Expired"/"Disabled" → false; anything else → null (unknown). */
export function isDhanDataPlanActive(dataPlan) {
  const value = String(dataPlan || '').trim().toLowerCase();
  if (value === 'active') return true;
  if (['deactive', 'inactive', 'deactivated', 'expired', 'disabled'].includes(value)) return false;
  return null;
}

function marketStatusFromError(error, dataPlanActive) {
  switch (error?.dhanCategory) {
    case 'DATA_API_NOT_ACTIVE': return 'DATA_API_NOT_ACTIVE';
    case 'DATA_API_ACCESS_DENIED': return dataPlanActive === false ? 'DATA_API_NOT_ACTIVE' : 'DATA_API_ACCESS_DENIED';
    case 'AUTH_FAILED': return 'AUTH_FAILED';
    case 'INVALID_CLIENT_ID': return 'INVALID_CLIENT_ID';
    case 'INVALID_SECURITY_ID': return 'INVALID_SECURITY_ID';
    case 'RATE_LIMITED': return 'RATE_LIMITED';
    case 'NETWORK_ERROR': return 'NETWORK_ERROR';
    default: return 'ERROR';
  }
}

const MARKET_MESSAGES = {
  LIVE: 'Live NIFTY 50 data received from Dhan.',
  STALE: 'Dhan returned a real NIFTY 50 quote, but its last-trade time is not recent (market closed or feed delayed).',
  DATA_API_NOT_ACTIVE: 'Dhan session is valid, but the Dhan Data API plan is not active for this account, so Dhan does not serve live market data.',
  DATA_API_ACCESS_DENIED: 'Dhan session is valid, but Dhan denied access to the market-data API.',
  AUTH_FAILED: 'Dhan rejected the credentials on the market-data API.',
  INVALID_CLIENT_ID: 'Dhan reports the client ID is invalid for market data.',
  INVALID_SECURITY_ID: 'Dhan reports the requested security ID is invalid.',
  RATE_LIMITED: 'Dhan rate limit reached for market data; retrying shortly.',
  NETWORK_ERROR: 'Could not reach Dhan market-data API (network error).',
  INSTRUMENT_MASTER_UNAVAILABLE: 'The official Dhan instrument master could not be loaded to resolve the NIFTY 50 security ID.',
  NO_DATA: 'Dhan returned no NIFTY 50 price.',
  ERROR: 'Dhan market-data request failed.',
};

export function readDhanQuote(payload, exchangeSegment, securityId) {
  const data = payload?.data || payload || {};
  const quote = data?.[exchangeSegment]?.[String(securityId)] || null;
  if (!quote) return null;
  const price = Number(quote.last_price ?? quote.ltp);
  const lttRaw = quote.last_trade_time ?? quote.ltt ?? null;
  const lttDate = parseDhanDateTime(lttRaw);
  return {
    price: Number.isFinite(price) && price > 0 ? price : null,
    lttRaw,
    ltt: lttDate ? lttDate.toISOString() : null,
    netChange: Number.isFinite(Number(quote.net_change)) ? Number(quote.net_change) : null,
    ohlc: quote.ohlc && typeof quote.ohlc === 'object'
      ? {
        open: Number(quote.ohlc.open) || null,
        high: Number(quote.ohlc.high) || null,
        low: Number(quote.ohlc.low) || null,
        close: Number(quote.ohlc.close) || null,
      }
      : null,
  };
}

/**
 * Fetches the NIFTY 50 quote for an already-verified adapter. Instrument comes
 * from the official Dhan master. Throws on Dhan errors (with dhanCategory).
 */
export async function fetchNiftyIndexQuote(adapter, { now = Date.now() } = {}) {
  const instrument = await getNiftyIndexInstrument();
  const payload = await adapter.getQuote({ exchangeSegment: instrument.exchangeSegment, securityIds: [instrument.securityId] });
  const quote = readDhanQuote(payload, instrument.exchangeSegment, instrument.securityId);
  const lttMs = quote?.ltt ? Date.parse(quote.ltt) : null;
  const fresh = lttMs !== null && lttMs <= now + 5_000 && now - lttMs <= MARKET_FRESHNESS_MS;
  return { instrument, quote, fresh };
}

async function loadBrokerRow(pool, userId) {
  const result = await pool.query(
    `SELECT ba.id, ba.client_id, ba.status, ba.connection_mode,
            bot.access_token_ciphertext, bot.token_expires_at
     FROM broker_accounts ba
     LEFT JOIN broker_oauth_tokens bot ON bot.broker_account_id = ba.id
     WHERE ba.user_id = $1 AND ba.broker = 'DHAN'
     ORDER BY bot.created_at DESC NULLS LAST LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

function legacyFields(result) {
  // Fields kept for existing consumers (dashboard tape, quant dashboard).
  const md = result.marketData;
  return {
    connected: md.status === 'LIVE',
    sessionConnected: result.broker.status === 'CONNECTED',
    status: md.status === 'LIVE' ? 'LIVE' : 'BLOCKED',
    code: md.status === 'LIVE' ? 'DHAN_MARKET_FEED_LIVE' : md.status,
    blocker: md.status === 'LIVE' ? null : md.message,
    source: 'DHAN',
    symbol: md.instrument?.name ? String(md.instrument.name).toUpperCase() : 'NIFTY 50',
    price: md.price ?? null,
    ltt: md.ltt ?? null,
    clientId: result.broker.clientId ?? null,
    availableMargin: result.broker.availableMargin ?? null,
    dataPlan: md.dataPlan ?? null,
    dataValidity: md.dataValidity ?? null,
    lastUpdated: md.checkedAt,
  };
}

function finalize(userId, result) {
  const full = { ...legacyFields(result), broker: result.broker, marketData: result.marketData };
  const key = `${full.broker.status}:${full.marketData.status}`;
  if (lastLoggedStatus.get(userId) !== key) {
    lastLoggedStatus.set(userId, key);
    console.info('[DHAN_MARKET_FEED]', JSON.stringify({
      userId,
      broker: full.broker.status,
      marketData: full.marketData.status,
      dataPlan: full.marketData.dataPlan ?? null,
      dhanHttpStatus: full.marketData.dhanHttpStatus ?? null,
      dhanErrorCode: full.marketData.dhanErrorCode ?? null,
    }));
  }
  return full;
}

async function computeFeed(pool, userId) {
  const checkedAt = new Date().toISOString();
  const notChecked = (message) => ({ status: 'NOT_CHECKED', message, checkedAt });
  let row;
  try {
    row = await loadBrokerRow(pool, userId);
  } catch (error) {
    return {
      broker: { status: 'SESSION_CHECK_FAILED', message: `Database unavailable while loading the Dhan session: ${error.message}` },
      marketData: notChecked('Dhan session could not be loaded.'),
    };
  }
  if (!row) return { broker: { status: 'NOT_CONNECTED', message: 'No Dhan account is connected.' }, marketData: notChecked('Connect Dhan first.') };
  if (row.status === 'SESSION_EXPIRED') {
    return { broker: { status: 'SESSION_EXPIRED', clientId: row.client_id, message: 'Dhan rejected the stored session. Reconnect with a fresh access token.' }, marketData: notChecked('Dhan session expired.') };
  }
  if (!['CONNECTED', 'PARTIALLY_CONNECTED'].includes(row.status) || row.connection_mode !== 'LIVE' || !row.access_token_ciphertext) {
    return { broker: { status: 'NOT_CONNECTED', clientId: row.client_id, message: 'Dhan is not connected in LIVE mode.' }, marketData: notChecked('Connect Dhan first.') };
  }

  let adapter;
  let profile;
  let funds = null;
  try {
    adapter = getBrokerAdapter('DHAN', 'LIVE', {
      dhanClientId: row.client_id,
      accessToken: decryptBrokerSecret(row.access_token_ciphertext),
      tokenExpiresAt: row.token_expires_at,
    });
    profile = await adapter.getProfile();
    try { funds = await adapter.getMargin(); } catch { funds = null; }
  } catch (error) {
    const expired = error?.code === 'BROKER_SESSION_EXPIRED';
    return {
      broker: {
        status: expired ? 'SESSION_EXPIRED' : 'SESSION_CHECK_FAILED',
        clientId: row.client_id,
        message: `Dhan /v2/profile failed: ${error.message}`,
        dhanHttpStatus: error?.httpStatus ?? null,
        dhanErrorCode: error?.providerErrorCode ?? null,
      },
      marketData: notChecked('Dhan session could not be verified.'),
    };
  }
  if (String(profile?.clientId || '') !== String(row.client_id)) {
    return { broker: { status: 'IDENTITY_MISMATCH', clientId: row.client_id, message: 'Dhan profile identity does not match the connected client ID.' }, marketData: notChecked('Identity mismatch.') };
  }

  const broker = {
    status: 'CONNECTED',
    clientId: row.client_id,
    sessionValid: true,
    tokenValidity: profile.tokenValidity || null,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at).toISOString() : null,
    activeSegment: profile.activeSegment || null,
    availableMargin: funds && Number.isFinite(Number(funds.available)) ? Number(funds.available) : null,
  };
  const planActive = isDhanDataPlanActive(profile.dataPlan);
  const base = {
    source: 'DHAN',
    endpoint: '/v2/marketfeed/quote',
    dataPlan: profile.dataPlan || null,
    dataValidity: profile.dataValidity || null,
    dataPlanActive: planActive,
    checkedAt,
  };

  // Dhan's own profile says the Data API plan is off: report it truthfully and
  // do not spend a Quote API call that Dhan will reject.
  if (planActive === false) {
    return { broker, marketData: { ...base, status: 'DATA_API_NOT_ACTIVE', message: MARKET_MESSAGES.DATA_API_NOT_ACTIVE } };
  }

  let feed;
  try {
    feed = await fetchNiftyIndexQuote(adapter);
  } catch (error) {
    if (error?.code === 'DHAN_INSTRUMENT_NOT_FOUND' || /instrument master/i.test(error?.message || '')) {
      return { broker, marketData: { ...base, status: 'INSTRUMENT_MASTER_UNAVAILABLE', message: `${MARKET_MESSAGES.INSTRUMENT_MASTER_UNAVAILABLE} (${error.message})` } };
    }
    const status = marketStatusFromError(error, planActive);
    return {
      broker,
      marketData: {
        ...base,
        status,
        message: MARKET_MESSAGES[status] || MARKET_MESSAGES.ERROR,
        dhanHttpStatus: error?.httpStatus ?? null,
        dhanErrorCode: error?.providerErrorCode ?? null,
        dhanErrorType: error?.providerErrorType ?? null,
        dhanErrorMessage: error?.providerMessage ?? null,
      },
    };
  }

  const { instrument, quote, fresh } = feed;
  if (!quote?.price) {
    return { broker, marketData: { ...base, status: 'NO_DATA', instrument, message: MARKET_MESSAGES.NO_DATA } };
  }
  const status = fresh ? 'LIVE' : 'STALE';
  return {
    broker,
    marketData: {
      ...base,
      status,
      message: MARKET_MESSAGES[status],
      instrument,
      price: quote.price,
      ltt: quote.ltt,
      lastTradeTimeRaw: quote.lttRaw,
      netChange: quote.netChange,
      ohlc: quote.ohlc,
    },
  };
}

/** Cached, de-duplicated market-feed status for a user. Never mutates broker state. */
export async function getDhanMarketFeed(pool, userId, { maxAgeMs } = {}) {
  const cached = resultCache.get(userId);
  if (cached) {
    const ttl = maxAgeMs ?? CACHE_TTL_MS[cached.value.marketData.status] ?? CACHE_TTL_MS.default;
    if (Date.now() - cached.at < ttl) return cached.value;
  }
  if (inFlight.has(userId)) return inFlight.get(userId);
  const promise = (async () => {
    try {
      const value = finalize(userId, await computeFeed(pool, userId));
      resultCache.set(userId, { at: Date.now(), value });
      return value;
    } finally {
      inFlight.delete(userId);
    }
  })();
  inFlight.set(userId, promise);
  return promise;
}

export function clearDhanMarketFeedCache(userId) {
  if (userId) resultCache.delete(userId);
  else resultCache.clear();
}
