// Single verified Angel One market-feed path used by /api/quant/live-market,
// /api/quant/live-health, the deployment gate and the live NIFTY runner.
//
// Broker session status and market-data status are reported separately:
//   broker.status     CONNECTED | NOT_CONNECTED | SESSION_EXPIRED | SESSION_CHECK_FAILED | IDENTITY_MISMATCH
//   marketData.status LIVE | STALE | AUTH_FAILED | RATE_LIMITED | NETWORK_ERROR |
//                     INSTRUMENT_MASTER_UNAVAILABLE | NO_DATA | ERROR | NOT_CHECKED
// Only an explicit session rejection by Angel One changes the persisted broker
// state; a market-data failure never does.

import { getAngelOneSession, isAngelOneSessionError, markAngelOneSessionExpired } from './angel-one-session.service.js';
import { getNiftyIndexInstrument } from './angel-one-instruments.service.js';
import { tryCreateQuantNotificationOnce } from './quant-notification.service.js';

export const MARKET_FRESHNESS_MS = 90_000;
export const MARKET_SOURCE = 'ANGEL_ONE';

// Per-user result cache + in-flight de-duplication, so page polling never
// multiplies calls to SmartAPI.
const CACHE_TTL_MS = {
  LIVE: 3_000,
  STALE: 10_000,
  NO_DATA: 10_000,
  RATE_LIMITED: 10_000,
  NETWORK_ERROR: 10_000,
  ERROR: 15_000,
  default: 15_000,
};
const resultCache = new Map();
const inFlight = new Map();
const lastLoggedStatus = new Map();

export function marketStatusFromError(error) {
  switch (error?.angelCategory) {
    case 'SESSION_EXPIRED':
    case 'INVALID_CREDENTIALS':
    case 'INVALID_API_KEY':
    case 'ACCOUNT_BLOCKED':
      return 'AUTH_FAILED';
    case 'RATE_LIMITED': return 'RATE_LIMITED';
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
      return 'NETWORK_ERROR';
    case 'NOT_FOUND': return 'NO_DATA';
    default: return 'ERROR';
  }
}

const MARKET_MESSAGES = {
  LIVE: 'Live NIFTY 50 data received from Angel One.',
  STALE: 'Angel One returned a real NIFTY 50 quote, but its exchange timestamp is not recent (market closed or feed delayed).',
  AUTH_FAILED: 'Angel One rejected the session on the market-data API.',
  RATE_LIMITED: 'Angel One rate limit reached for market data; retrying shortly.',
  NETWORK_ERROR: 'Could not reach the Angel One market-data API (network error or timeout).',
  INSTRUMENT_MASTER_UNAVAILABLE: 'The official Angel One instrument master could not be loaded to resolve the NIFTY 50 token.',
  NO_DATA: 'Angel One returned no NIFTY 50 price.',
  ERROR: 'Angel One market-data request failed.',
};

/**
 * Fetches the NIFTY 50 quote for an already-built adapter. The instrument
 * comes from the official Angel One master. Throws on SmartAPI errors.
 */
export async function fetchNiftyIndexQuote(adapter, { now = Date.now() } = {}) {
  const instrument = await getNiftyIndexInstrument();
  const quote = await adapter.getQuote({ exchange: instrument.exchange, symbolToken: instrument.symbolToken, mode: 'FULL' });
  const ltt = quote?.lastUpdateTime || null;
  const lttMs = ltt ? Date.parse(ltt) : null;
  const fresh = lttMs !== null && lttMs <= now + 5_000 && now - lttMs <= MARKET_FRESHNESS_MS;
  return {
    instrument,
    quote: quote
      ? {
        price: quote.ltp,
        ltt,
        netChange: quote.netChange,
        percentChange: quote.percentChange,
        ohlc: { open: quote.open, high: quote.high, low: quote.low, close: quote.close },
      }
      : null,
    fresh,
  };
}

function legacyFields(result) {
  // Flat fields kept for the dashboard tape and status pills.
  const md = result.marketData;
  return {
    connected: md.status === 'LIVE',
    sessionConnected: result.broker.status === 'CONNECTED',
    status: md.status === 'LIVE' ? 'LIVE' : 'BLOCKED',
    code: md.status === 'LIVE' ? 'ANGEL_ONE_MARKET_FEED_LIVE' : md.status,
    blocker: md.status === 'LIVE' ? null : md.message,
    source: MARKET_SOURCE,
    symbol: md.instrument?.name ? String(md.instrument.name).toUpperCase() : 'NIFTY 50',
    price: md.price ?? null,
    ltt: md.ltt ?? null,
    clientId: result.broker.clientId ?? null,
    availableMargin: result.broker.availableMargin ?? null,
    lastUpdated: md.checkedAt,
  };
}

function notifyMarketDataState(pool, userId, full) {
  const status = full.marketData.status;
  if (full.broker.status !== 'CONNECTED' || ['LIVE', 'STALE', 'NOT_CHECKED'].includes(status)) return;
  tryCreateQuantNotificationOnce(pool, {
    userId,
    type: 'MARKET_DATA_UNAVAILABLE',
    title: 'Angel One market data unavailable',
    body: full.marketData.message,
    data: { marketDataStatus: status, brokerErrorCode: full.marketData.brokerErrorCode ?? null },
  }).catch(() => {});
}

function finalize(pool, userId, result) {
  const full = { ...legacyFields(result), broker: result.broker, marketData: result.marketData };
  const key = `${full.broker.status}:${full.marketData.status}`;
  if (lastLoggedStatus.get(userId) !== key) {
    lastLoggedStatus.set(userId, key);
    notifyMarketDataState(pool, userId, full);
    console.info('[ANGEL_ONE_MARKET_FEED]', JSON.stringify({
      userId,
      broker: full.broker.status,
      marketData: full.marketData.status,
      brokerHttpStatus: full.marketData.brokerHttpStatus ?? null,
      brokerErrorCode: full.marketData.brokerErrorCode ?? null,
    }));
  }
  return full;
}

async function computeFeed(pool, userId) {
  const checkedAt = new Date().toISOString();
  const notChecked = (message) => ({ status: 'NOT_CHECKED', source: MARKET_SOURCE, message, checkedAt });
  let session;
  try {
    session = await getAngelOneSession(pool, userId);
  } catch (error) {
    return {
      broker: { status: 'SESSION_CHECK_FAILED', message: `The Angel One session could not be loaded: ${error.message}` },
      marketData: notChecked('Angel One session could not be loaded.'),
    };
  }
  const { row, adapter } = session;
  if (!adapter) {
    if (session.reason === 'SESSION_EXPIRED') {
      return {
        broker: { status: 'SESSION_EXPIRED', clientId: row.client_id, message: 'Angel One rejected the stored session. Reconnect your Angel One account.' },
        marketData: notChecked('Angel One session expired.'),
      };
    }
    return {
      broker: { status: 'NOT_CONNECTED', clientId: row?.client_id ?? null, message: row ? 'Angel One is not connected in LIVE mode.' : 'No Angel One account is connected.' },
      marketData: notChecked('Connect Angel One first.'),
    };
  }

  let profile;
  let funds = null;
  try {
    profile = await adapter.getProfile();
    try {
      funds = await adapter.getMargin();
    } catch (error) {
      if (isAngelOneSessionError(error)) throw error;
      funds = null;
    }
  } catch (error) {
    const expired = isAngelOneSessionError(error);
    if (expired) await markAngelOneSessionExpired(pool, row.id);
    return {
      broker: {
        status: expired ? 'SESSION_EXPIRED' : 'SESSION_CHECK_FAILED',
        clientId: row.client_id,
        message: `Angel One getProfile failed: ${error.message}`,
        brokerHttpStatus: error?.httpStatus ?? null,
        brokerErrorCode: error?.providerErrorCode ?? null,
      },
      marketData: notChecked('Angel One session could not be verified.'),
    };
  }
  if (String(profile?.clientCode || '') !== String(row.client_id || '').toUpperCase()) {
    return {
      broker: { status: 'IDENTITY_MISMATCH', clientId: row.client_id, message: 'Angel One profile identity does not match the connected client code.' },
      marketData: notChecked('Identity mismatch.'),
    };
  }

  const broker = {
    status: 'CONNECTED',
    clientId: row.client_id,
    name: profile.name || null,
    sessionValid: true,
    tokenExpiresAt: adapter.tokenExpiresAt ? adapter.tokenExpiresAt.toISOString() : null,
    exchanges: profile.exchanges,
    availableMargin: funds && Number.isFinite(Number(funds.available)) ? Number(funds.available) : null,
  };
  const base = { source: MARKET_SOURCE, endpoint: 'market/v1/quote', checkedAt };

  let feed;
  try {
    feed = await fetchNiftyIndexQuote(adapter);
  } catch (error) {
    if (String(error?.code || '').startsWith('ANGEL_ONE_INSTRUMENT')) {
      return { broker, marketData: { ...base, status: 'INSTRUMENT_MASTER_UNAVAILABLE', message: `${MARKET_MESSAGES.INSTRUMENT_MASTER_UNAVAILABLE} (${error.message})` } };
    }
    const status = marketStatusFromError(error);
    return {
      broker,
      marketData: {
        ...base,
        status,
        message: MARKET_MESSAGES[status] || MARKET_MESSAGES.ERROR,
        brokerHttpStatus: error?.httpStatus ?? null,
        brokerErrorCode: error?.providerErrorCode ?? null,
        brokerErrorMessage: error?.providerMessage ?? null,
        category: error?.angelCategory ?? null,
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
      netChange: quote.netChange,
      percentChange: quote.percentChange,
      ohlc: quote.ohlc,
    },
  };
}

/** Cached, de-duplicated market-feed status for a user. */
export async function getAngelOneMarketFeed(pool, userId, { maxAgeMs } = {}) {
  const cached = resultCache.get(userId);
  if (cached) {
    const ttl = maxAgeMs ?? CACHE_TTL_MS[cached.value.marketData.status] ?? CACHE_TTL_MS.default;
    if (Date.now() - cached.at < ttl) return cached.value;
  }
  if (inFlight.has(userId)) return inFlight.get(userId);
  const promise = (async () => {
    try {
      const value = finalize(pool, userId, await computeFeed(pool, userId));
      resultCache.set(userId, { at: Date.now(), value });
      return value;
    } finally {
      inFlight.delete(userId);
    }
  })();
  inFlight.set(userId, promise);
  return promise;
}

export function clearAngelOneMarketFeedCache(userId) {
  if (userId) {
    resultCache.delete(userId);
    lastLoggedStatus.delete(userId);
  } else {
    resultCache.clear();
    lastLoggedStatus.clear();
  }
}
