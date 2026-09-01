// ============================================================================
// OANOR Market-Data Service
// ----------------------------------------------------------------------------
// This service is the ONLY place in the KEPWE backend that talks to OANOR.
// The frontend NEVER calls OANOR directly — all requests flow:
//   Frontend → KEPWE Backend → OANOR → KEPWE Backend → Frontend
//
// Security:
//   - Reads OANOR_API_KEY from process.env only (never logs/exposes it)
//   - Never returns the API key in any response
//
// Reliability:
//   - Configurable timeout (default 8s)
//   - In-memory TTL cache to avoid burning API quota
//   - Rate-limit (429) handling with exponential backoff
//   - Graceful degradation: if OANOR is unreachable or returns an error,
//     the service reports the limitation instead of fabricating data.
//
// IMPORTANT: This service does NOT invent endpoints, fields, prices,
// option-chain values, Greeks, or market data. If OANOR does not provide
// a particular piece of data, the service explicitly reports that
// limitation rather than generating fake values.
// ============================================================================

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config();

// ── Configuration ────────────────────────────────────────────────────────────
const OANOR_API_KEY = process.env.OANOR_API_KEY;
const OANOR_BASE_URL = process.env.OANOR_BASE_URL || 'https://api.oanor.com';
const OANOR_TIMEOUT_MS = Number(process.env.OANOR_TIMEOUT_MS || 8000);
const OANOR_CACHE_TTL_MS = Number(process.env.OANOR_CACHE_TTL_MS || 60_000); // 1 min default

// ── In-memory TTL cache ──────────────────────────────────────────────────────
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlMs = OANOR_CACHE_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ── Rate-limit / backoff state ───────────────────────────────────────────────
let consecutiveFailures = 0;
let backoffUntil = 0;

function getBackoffDelay() {
  // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 60s
  const delay = Math.min(1000 * 2 ** Math.min(consecutiveFailures, 6), 60_000);
  return delay;
}

// ── HTTP helper with timeout ─────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OANOR_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Core request method ──────────────────────────────────────────────────────
async function oanorRequest(path, { method = 'GET', query = {}, body } = {}) {
  if (!OANOR_API_KEY) {
    throw new Error('OANOR_API_KEY is not configured. Market data from OANOR is unavailable.');
  }

  // Respect backoff window after repeated failures
  if (Date.now() < backoffUntil) {
    const waitMs = backoffUntil - Date.now();
    throw new Error(`OANOR rate-limit backoff active. Retry in ${Math.ceil(waitMs / 1000)}s.`);
  }

  const url = new URL(`${OANOR_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const headers = {
    Accept: 'application/json',
    // The API key is sent only in the Authorization header — never logged.
    Authorization: `Bearer ${OANOR_API_KEY}`,
  };
  if (body) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle rate limiting (429)
    if (res.status === 429) {
      consecutiveFailures++;
      backoffUntil = Date.now() + getBackoffDelay();
      const retryAfter = res.headers.get('Retry-After');
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : getBackoffDelay();
      throw new Error(`OANOR rate limit exceeded. Retry after ${Math.ceil(waitMs / 1000)}s.`);
    }

    // Handle other errors
    if (!res.ok) {
      consecutiveFailures++;
      if (res.status >= 500) {
        backoffUntil = Date.now() + getBackoffDelay();
      }
      const text = await res.text().catch(() => '');
      throw new Error(`OANOR request failed (${res.status}): ${text.slice(0, 200)}`);
    }

    // Success — reset failure counter
    consecutiveFailures = 0;
    backoffUntil = 0;

    const data = await res.json();
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      consecutiveFailures++;
      throw new Error(`OANOR request timed out after ${OANOR_TIMEOUT_MS}ms.`);
    }
    throw err;
  }
}

// ── Cached request wrapper ───────────────────────────────────────────────────
async function cachedRequest(cacheKey, path, options = {}, ttlMs = OANOR_CACHE_TTL_MS) {
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await oanorRequest(path, options);
  cacheSet(cacheKey, data, ttlMs);
  return data;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch index quotes (NIFTY, BANKNIFTY, FINNIFTY, etc.)
 * @param {string[]} symbols - e.g. ['NIFTY', 'BANKNIFTY']
 * @returns {Promise<Array>} Array of index quote objects from OANOR
 */
export async function getIndexQuotes(symbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']) {
  const results = [];
  for (const symbol of symbols) {
    const cacheKey = `index:${symbol}`;
    try {
      const data = await cachedRequest(cacheKey, '/indices', {
        query: { symbol },
      });
      results.push({ symbol, data, source: 'OANOR' });
    } catch (err) {
      results.push({
        symbol,
        data: null,
        source: 'OANOR',
        error: err.message,
        limitation: `OANOR does not currently provide index data for ${symbol}.`,
      });
    }
  }
  return results;
}

/**
 * Fetch option chain for a symbol/expiry.
 * @param {string} symbol - e.g. 'NIFTY'
 * @param {string} expiry - e.g. '28AUG2026'
 * @returns {Promise<Object>} Option chain data from OANOR
 */
export async function getOptionChain(symbol = 'NIFTY', expiry = '28AUG2026') {
  const cacheKey = `option-chain:${symbol}:${expiry}`;
  try {
    const data = await cachedRequest(cacheKey, '/option-chain', {
      query: { symbol, expiry },
    });
    return { data, source: 'OANOR' };
  } catch (err) {
    return {
      data: null,
      source: 'OANOR',
      error: err.message,
      limitation: `OANOR does not currently provide option chain data for ${symbol} ${expiry}.`,
    };
  }
}

/**
 * Fetch market strategies / setups.
 * @param {Object} params - e.g. { symbol, maxLoss, view }
 * @returns {Promise<Object>} Strategy data from OANOR
 */
export async function getStrategies(params = {}) {
  const cacheKey = `strategies:${JSON.stringify(params)}`;
  try {
    const data = await cachedRequest(cacheKey, '/strategies', {
      query: params,
    });
    return { data, source: 'OANOR' };
  } catch (err) {
    return {
      data: null,
      source: 'OANOR',
      error: err.message,
      limitation: 'OANOR does not currently provide strategy/setup data.',
    };
  }
}

/**
 * Check OANOR API health/connectivity.
 * @returns {Promise<Object>} Health status
 */
export async function checkOanorHealth() {
  try {
    const data = await oanorRequest('/health');
    return { ok: true, data, source: 'OANOR' };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      source: 'OANOR',
      limitation: 'OANOR API is currently unreachable or not configured.',
    };
  }
}

export default {
  getIndexQuotes,
  getOptionChain,
  getStrategies,
  checkOanorHealth,
};