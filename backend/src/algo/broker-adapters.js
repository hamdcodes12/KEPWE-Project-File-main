// KEPWE Quant broker adapter: Angel One SmartAPI is the only supported broker.
//
// Endpoints follow the official SmartAPI REST routes (the same paths the
// angel-one/smartapi-python SDK uses). There are no simulated or mock
// responses in this module: every method performs a real HTTPS request.

import { createHmac } from 'crypto';
import { getStaticIpReadiness, verifyAngelOneStaticIp } from '../services/static-ip.service.js';

export const ANGEL_ONE = 'ANGEL_ONE';
export const SUPPORTED_BROKERS = Object.freeze([ANGEL_ONE]);
export const ANGEL_ONE_DISPLAY_NAME = 'Angel One';

const ANGEL_ONE_BASE_URL = 'https://apiconnect.angelone.in';
export const ANGEL_ONE_PUBLISHER_LOGIN_URL = 'https://smartapi.angelone.in/publisher-login';

export const ANGEL_ONE_ROUTES = Object.freeze({
  login: '/rest/auth/angelbroking/user/v1/loginByPassword',
  generateTokens: '/rest/auth/angelbroking/jwt/v1/generateTokens',
  logout: '/rest/secure/angelbroking/user/v1/logout',
  profile: '/rest/secure/angelbroking/user/v1/getProfile',
  rms: '/rest/secure/angelbroking/user/v1/getRMS',
  placeOrder: '/rest/secure/angelbroking/order/v1/placeOrder',
  modifyOrder: '/rest/secure/angelbroking/order/v1/modifyOrder',
  cancelOrder: '/rest/secure/angelbroking/order/v1/cancelOrder',
  orderBook: '/rest/secure/angelbroking/order/v1/getOrderBook',
  tradeBook: '/rest/secure/angelbroking/order/v1/getTradeBook',
  orderDetails: '/rest/secure/angelbroking/order/v1/details/',
  ltp: '/rest/secure/angelbroking/order/v1/getLtpData',
  positions: '/rest/secure/angelbroking/order/v1/getPosition',
  holdings: '/rest/secure/angelbroking/portfolio/v1/getHolding',
  allHoldings: '/rest/secure/angelbroking/portfolio/v1/getAllHolding',
  quote: '/rest/secure/angelbroking/market/v1/quote/',
  candles: '/rest/secure/angelbroking/historical/v1/getCandleData',
  optionGreek: '/rest/secure/angelbroking/marketData/v1/optionGreek',
});

// Minimum spacing between calls, per client and route group. Derived from the
// published SmartAPI rate limits (orders: 10/s combined across place/modify/
// cancel; order book, trade book, positions, holdings: 1/s; candles: 3/s).
const RATE_INTERVAL_MS = {
  login: 1000,
  generateTokens: 1000,
  logout: 1000,
  profile: 350,
  rms: 500,
  orderWrite: 110,
  orderBook: 1000,
  tradeBook: 1000,
  orderDetails: 110,
  ltp: 110,
  positions: 1000,
  holdings: 1000,
  quote: 110,
  candles: 350,
  optionGreek: 1000,
};
const RATE_GROUP = {
  placeOrder: 'orderWrite',
  modifyOrder: 'orderWrite',
  cancelOrder: 'orderWrite',
  allHoldings: 'holdings',
};
const QUOTE_BATCH_SIZE = 50;
const ORDER_BOOK_CACHE_MS = 1000;
const DEFAULT_READ_RETRY_DELAYS_MS = [400, 1200];

function readRetryDelays() {
  const configured = String(process.env.ANGEL_ONE_READ_RETRY_DELAYS_MS || '').trim();
  if (!configured) return DEFAULT_READ_RETRY_DELAYS_MS;
  return configured.split(',').map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value >= 0);
}

const LIVE_CAPABILITIES = Object.freeze({
  authentication: true,
  sessionRefresh: true,
  logout: true,
  profile: true,
  marketData: true,
  historicalData: true,
  orderPlacement: true,
  orderModification: true,
  orderCancellation: true,
  orderStatus: true,
  positions: true,
  holdings: true,
  tradeBook: true,
  margin: true,
  executionUpdates: true,
});

const text = (name) => String(process.env[name] || '').trim();

export class BrokerCapabilityError extends Error {
  constructor(broker, capability) {
    super(`${broker} ${capability} is not available`);
    this.name = 'BrokerCapabilityError';
    this.statusCode = 503;
    this.broker = broker;
    this.capability = capability;
  }
}

export class BrokerApiError extends Error {
  constructor(broker, message, statusCode = 502) {
    super(`${broker} API error: ${message}`);
    this.name = 'BrokerApiError';
    this.statusCode = statusCode;
    this.broker = broker;
  }
}

function validationError(message) {
  const error = new BrokerApiError(ANGEL_ONE_DISPLAY_NAME, message, 400);
  error.code = 'BROKER_REQUEST_INVALID';
  error.angelCategory = 'REQUEST_ERROR';
  return error;
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = String(value || '').toUpperCase().replace(/=+$/, '').replace(/[\s-]+/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw validationError('TOTP must be the current 6-digit code or a valid base32 TOTP secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  if (bytes.length === 0) throw validationError('TOTP must be the current 6-digit code or a valid base32 TOTP secret');
  return Buffer.from(bytes);
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits). A 6-digit input is treated as an already generated code. */
export function generateTotp(secret, timestamp = Date.now()) {
  if (/^\d{6}$/.test(String(secret || '').trim())) return String(secret).trim();
  const counter = Math.floor(Number(timestamp) / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

// ── SmartAPI error classification ────────────────────────────────────────────
// Codes as published in the SmartAPI "Exceptions" documentation.
const SESSION_CODES = new Set(['AG8001', 'AG8002', 'AG8003', 'AB1010', 'AB1011', 'AB8050', 'AB8051']);
const CREDENTIAL_CODES = new Set(['AB1000', 'AB1001', 'AB1002', 'AB1005', 'AB1031', 'AB1032', 'AB1050', 'AB7001']);
const API_KEY_CODES = new Set(['AG8004', 'AB1053']);
const ACCOUNT_CODES = new Set(['AB1003', 'AB1006']);
const NOT_FOUND_CODES = new Set(['AB1009', 'AB1013', 'AB1014', 'AB1015', 'AB1016', 'AB1018']);
const ORDER_CODES = new Set(['AB1008', 'AB1012', 'AB1017', 'AB2002', 'AB4008']);
const UPSTREAM_CODES = new Set(['AB1004', 'AB1007', 'AB2000', 'AB2001']);

/**
 * Maps a failed SmartAPI call to one category:
 *   SESSION_EXPIRED | INVALID_CREDENTIALS | INVALID_API_KEY | ACCOUNT_BLOCKED |
 *   RATE_LIMITED | NETWORK_ERROR | TIMEOUT | ORDER_REJECTED | NOT_FOUND |
 *   REQUEST_ERROR | UPSTREAM_ERROR
 * `login` marks a call made without a session (login), where a token-style
 * rejection means the credentials were refused, not that a stored session
 * expired.
 */
export function classifyAngelOneError(error, { login = false } = {}) {
  const code = String(error?.providerErrorCode || '').toUpperCase();
  const http = Number(error?.httpStatus) || null;
  const message = String(error?.providerMessage || error?.message || '');
  if (error?.code === 'NETWORK_ERROR') return 'NETWORK_ERROR';
  if (error?.code === 'BROKER_TIMEOUT') return 'TIMEOUT';
  if (http === 429 || /exceeding access rate|rate limit|too many requests/i.test(message)) return 'RATE_LIMITED';
  if (API_KEY_CODES.has(code) || /invalid api ?key/i.test(message)) return 'INVALID_API_KEY';
  if (CREDENTIAL_CODES.has(code)) return 'INVALID_CREDENTIALS';
  if (ACCOUNT_CODES.has(code)) return 'ACCOUNT_BLOCKED';
  if (SESSION_CODES.has(code)) return login ? 'INVALID_CREDENTIALS' : 'SESSION_EXPIRED';
  if (NOT_FOUND_CODES.has(code)) return 'NOT_FOUND';
  if (ORDER_CODES.has(code)) return 'ORDER_REJECTED';
  if (UPSTREAM_CODES.has(code) || (http && http >= 500)) return 'UPSTREAM_ERROR';
  if (/invalid token|token (is )?expired|session expired|token missing|not login|unauthori[sz]ed/i.test(message) || http === 401) {
    return login ? 'INVALID_CREDENTIALS' : 'SESSION_EXPIRED';
  }
  if (login && /invalid|incorrect|wrong|totp|mpin|password/i.test(message)) return 'INVALID_CREDENTIALS';
  if (http === 403) return login ? 'INVALID_CREDENTIALS' : 'SESSION_EXPIRED';
  if (http && http >= 400) return 'REQUEST_ERROR';
  // HTTP 200 with status:false and an undocumented code: SmartAPI refused the request.
  return error?.providerErrorCode || error?.providerMessage ? 'REQUEST_ERROR' : 'UPSTREAM_ERROR';
}

const CATEGORY_HTTP_STATUS = {
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 422,
  INVALID_API_KEY: 400,
  ACCOUNT_BLOCKED: 403,
  RATE_LIMITED: 429,
  NETWORK_ERROR: 503,
  TIMEOUT: 504,
  ORDER_REJECTED: 422,
  NOT_FOUND: 404,
  REQUEST_ERROR: 400,
  UPSTREAM_ERROR: 502,
};
const CATEGORY_CODE = {
  SESSION_EXPIRED: 'BROKER_SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'BROKER_INVALID_CREDENTIALS',
  INVALID_API_KEY: 'BROKER_INVALID_API_KEY',
  ACCOUNT_BLOCKED: 'BROKER_ACCOUNT_BLOCKED',
  RATE_LIMITED: 'BROKER_RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'BROKER_TIMEOUT',
  ORDER_REJECTED: 'BROKER_ORDER_REJECTED',
  NOT_FOUND: 'BROKER_NOT_FOUND',
  REQUEST_ERROR: 'BROKER_REQUEST_REJECTED',
  UPSTREAM_ERROR: 'BROKER_UPSTREAM_ERROR',
};

export function isAngelOneSessionError(error) {
  return error?.code === 'BROKER_SESSION_EXPIRED' || error?.angelCategory === 'SESSION_EXPIRED';
}

// ── Small helpers ────────────────────────────────────────────────────────────
const RATE_GATES = new Map();

async function acquireRateSlot(key, intervalMs) {
  if (!intervalMs || process.env.ANGEL_ONE_DISABLE_RATE_GATE === 'true') return;
  const now = Date.now();
  const slot = Math.max(now, RATE_GATES.get(key) || 0);
  RATE_GATES.set(key, slot + intervalMs);
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

export function resetAngelOneRateGates() {
  RATE_GATES.clear();
}

function delay(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function tokenExpiryFromJwt(token) {
  const parts = String(token || '').replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return Number.isFinite(Number(payload.exp)) ? new Date(Number(payload.exp) * 1000) : null;
  } catch {
    return null;
  }
}

function normalizeTokenExpiry(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function requestTimeout() {
  const value = Number(process.env.ANGEL_ONE_TIMEOUT_MS || process.env.BROKER_TIMEOUT_MS || 10_000);
  return Number.isFinite(value) && value > 0 ? value : 10_000;
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value) {
  return numberOrNull(value) ?? 0;
}

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const IST_OFFSET_MS = 330 * 60 * 1000;

/**
 * Parses SmartAPI timestamps, which are IST (UTC+05:30):
 *   "21-Jun-2023 10:46:10" (quote/order times) and ISO strings with an offset.
 * Returns a UTC Date, or null when absent/unparseable/placeholder (pre-2000).
 */
export function parseAngelDateTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (match) {
    const [, dd, mon, yyyy, hh, min, ss = '0'] = match;
    const month = MONTHS[mon.toUpperCase()];
    if (month === undefined || Number(yyyy) < 2000) return null;
    const parsed = new Date(Date.UTC(Number(yyyy), month, Number(dd), Number(hh), Number(min), Number(ss)) - IST_OFFSET_MS);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)) {
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(raw);
    const parsed = new Date(hasZone ? raw.replace(' ', 'T') : `${raw.replace(' ', 'T')}+05:30`);
    return Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() < 2000 ? null : parsed;
  }
  return null;
}

/** Formats a Date / ISO string / "YYYY-MM-DD[ HH:mm]" as SmartAPI's IST "YYYY-MM-DD HH:mm". */
export function formatAngelCandleTime(value, fallbackTime) {
  if (value === undefined || value === null || value === '') return null;
  if (!(value instanceof Date)) {
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw} ${fallbackTime}`;
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(raw)) return raw.replace('T', ' ');
  }
  const date = value instanceof Date ? value : new Date(String(value).trim());
  if (Number.isNaN(date.getTime())) return null;
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

const INTERVALS = {
  1: 'ONE_MINUTE', '1m': 'ONE_MINUTE', one_minute: 'ONE_MINUTE',
  3: 'THREE_MINUTE', '3m': 'THREE_MINUTE', three_minute: 'THREE_MINUTE',
  5: 'FIVE_MINUTE', '5m': 'FIVE_MINUTE', five_minute: 'FIVE_MINUTE',
  10: 'TEN_MINUTE', '10m': 'TEN_MINUTE', ten_minute: 'TEN_MINUTE',
  15: 'FIFTEEN_MINUTE', '15m': 'FIFTEEN_MINUTE', fifteen_minute: 'FIFTEEN_MINUTE',
  30: 'THIRTY_MINUTE', '30m': 'THIRTY_MINUTE', thirty_minute: 'THIRTY_MINUTE',
  60: 'ONE_HOUR', '1h': 'ONE_HOUR', '60m': 'ONE_HOUR', one_hour: 'ONE_HOUR',
  '1d': 'ONE_DAY', d: 'ONE_DAY', day: 'ONE_DAY', one_day: 'ONE_DAY',
};

export function normalizeAngelInterval(interval) {
  return INTERVALS[String(interval ?? '').trim().toLowerCase()] || null;
}

const EXCHANGE_ALIASES = {
  NSE: 'NSE', NSE_EQ: 'NSE', IDX_I: 'NSE', NSE_INDEX: 'NSE',
  BSE: 'BSE', BSE_EQ: 'BSE',
  NFO: 'NFO', NSE_FNO: 'NFO',
  BFO: 'BFO', BSE_FNO: 'BFO',
  MCX: 'MCX', MCX_COMM: 'MCX',
  CDS: 'CDS', NSE_CURRENCY: 'CDS',
};
const PRODUCT_ALIASES = {
  INTRADAY: 'INTRADAY', MIS: 'INTRADAY',
  DELIVERY: 'DELIVERY', CNC: 'DELIVERY',
  CARRYFORWARD: 'CARRYFORWARD', NRML: 'CARRYFORWARD',
  MARGIN: 'MARGIN', BO: 'BO',
};
const ORDER_TYPE_ALIASES = {
  MARKET: 'MARKET', LIMIT: 'LIMIT',
  STOPLOSS_LIMIT: 'STOPLOSS_LIMIT', SL: 'STOPLOSS_LIMIT', STOP_LOSS: 'STOPLOSS_LIMIT',
  STOPLOSS_MARKET: 'STOPLOSS_MARKET', 'SL-M': 'STOPLOSS_MARKET', SL_M: 'STOPLOSS_MARKET', SLM: 'STOPLOSS_MARKET', STOP_LOSS_MARKET: 'STOPLOSS_MARKET',
};

export function normalizeAngelExchange(value) {
  return EXCHANGE_ALIASES[String(value || '').trim().toUpperCase()] || null;
}

/** SmartAPI order-book status text -> KEPWE OMS status. */
export function mapAngelOrderStatus(status, { filledQuantity = 0, quantity = 0 } = {}) {
  const value = String(status || '').trim().toLowerCase();
  if (!value) return null;
  if (['complete', 'completed', 'traded', 'filled'].includes(value)) return 'FILLED';
  if (value === 'rejected') return 'REJECTED';
  if (['cancelled', 'canceled', 'expired'].includes(value)) return 'CANCELLED';
  const filled = Number(filledQuantity) || 0;
  const total = Number(quantity) || 0;
  if (filled > 0 && (total === 0 || filled < total)) return 'PARTIALLY_FILLED';
  return 'SUBMITTED';
}

/** KEPWE correlation tag: SmartAPI `ordertag` allows at most 20 characters. */
export function angelOrderTag(internalOrderId) {
  const tag = String(internalOrderId || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 20);
  return tag || null;
}

/**
 * Normalizes one SmartAPI order record (order book / order details) into the
 * shape the OMS consumes. Also accepts already normalized execution objects.
 */
export function normalizeBrokerExecution(payload = {}, fallback = {}) {
  const unwrapped = payload?.data && !Array.isArray(payload.data) && typeof payload.data === 'object' ? payload.data : payload;
  const data = (Array.isArray(unwrapped) ? unwrapped[0] : unwrapped) || {};
  const quantity = numberOrNull(data.quantity);
  const filledQuantity = numberOrNull(data.filledQuantity ?? data.filledshares ?? data.filled_quantity);
  const unfilled = numberOrNull(data.remainingQuantity ?? data.unfilledshares ?? data.remaining_quantity);
  const isRawAngel = data.orderid !== undefined || data.orderstatus !== undefined || data.filledshares !== undefined;
  const brokerStatus = data.brokerStatus ?? (isRawAngel ? (data.orderstatus || data.status) : null) ?? null;
  const status = isRawAngel
    ? mapAngelOrderStatus(data.orderstatus || data.status, { filledQuantity, quantity })
    : (data.status || fallback.status || null);
  const averagePrice = numberOrNull(data.averagePrice ?? data.averageprice ?? data.average_price ?? data.averageTradedPrice);
  const rejectionText = data.rejectionReason ?? data.text ?? data.rejection_reason ?? null;
  return {
    brokerOrderId: String(data.brokerOrderId || data.orderId || data.orderid || data.order_id || fallback.brokerOrderId || '') || null,
    uniqueOrderId: data.uniqueOrderId || data.uniqueorderid || fallback.uniqueOrderId || null,
    exchangeOrderId: data.exchangeOrderId || data.exchorderid || data.exchangeorderid || data.exchange_order_id || fallback.exchangeOrderId || null,
    correlationId: data.correlationId || data.ordertag || data.correlation_id || fallback.correlationId || null,
    status: status || 'SUBMITTED',
    brokerStatus: brokerStatus === null ? null : String(brokerStatus),
    averagePrice: averagePrice !== null && averagePrice > 0 ? averagePrice : null,
    filledQuantity,
    remainingQuantity: unfilled,
    charges: numberOrNull(data.charges),
    rejectionReason: ['REJECTED', 'CANCELLED'].includes(status) && rejectionText ? String(rejectionText) : null,
    raw: data.raw || data,
  };
}

function isTerminalExecutionStatus(status) {
  return ['FILLED', 'CANCELLED', 'REJECTED'].includes(String(status || '').toUpperCase());
}

function normalizeOrderRecord(order = {}) {
  const execution = normalizeBrokerExecution(order);
  return {
    orderId: execution.brokerOrderId,
    tradingSymbol: order.tradingsymbol || null,
    side: order.transactiontype || null,
    quantity: numberOrNull(order.quantity),
    orderType: order.ordertype || null,
    productType: order.producttype || null,
    price: numberOrNull(order.price),
    status: execution.status,
    filledQuantity: execution.filledQuantity,
    averagePrice: execution.averagePrice,
    remainingQuantity: execution.remainingQuantity,
    brokerStatus: execution.brokerStatus,
    rejectionReason: execution.rejectionReason,
    triggerPrice: numberOrNull(order.triggerprice),
    exchange: order.exchange || null,
    exchangeSegment: order.exchange || null,
    symbolToken: order.symboltoken ? String(order.symboltoken) : null,
    securityId: order.symboltoken ? String(order.symboltoken) : null,
    variety: order.variety || null,
    duration: order.duration || null,
    brokerOrderId: execution.brokerOrderId,
    uniqueOrderId: execution.uniqueOrderId,
    exchangeOrderId: execution.exchangeOrderId,
    correlationId: execution.correlationId,
    orderTag: order.ordertag || null,
    updatedAt: parseAngelDateTime(order.updatetime)?.toISOString() || order.updatetime || null,
    exchangeTime: parseAngelDateTime(order.exchtime)?.toISOString() || order.exchtime || null,
    raw: order,
  };
}

function normalizeQuote(quote = {}) {
  const feedTime = parseAngelDateTime(quote.exchFeedTime);
  const tradeTime = parseAngelDateTime(quote.exchTradeTime);
  const bestBid = Array.isArray(quote.depth?.buy) ? quote.depth.buy[0] : null;
  const bestAsk = Array.isArray(quote.depth?.sell) ? quote.depth.sell[0] : null;
  const ltp = numberOrNull(quote.ltp);
  const latest = Math.max(feedTime?.getTime() || 0, tradeTime?.getTime() || 0);
  return {
    exchange: quote.exchange || null,
    symbolToken: quote.symbolToken !== undefined && quote.symbolToken !== null ? String(quote.symbolToken) : null,
    tradingSymbol: quote.tradingSymbol || null,
    ltp: ltp !== null && ltp > 0 ? ltp : null,
    open: numberOrNull(quote.open),
    high: numberOrNull(quote.high),
    low: numberOrNull(quote.low),
    close: numberOrNull(quote.close),
    netChange: numberOrNull(quote.netChange),
    percentChange: numberOrNull(quote.percentChange),
    volume: numberOrNull(quote.tradeVolume),
    openInterest: numberOrNull(quote.opnInterest),
    bid: numberOrNull(bestBid?.price),
    ask: numberOrNull(bestAsk?.price),
    bidQuantity: numberOrNull(bestBid?.quantity),
    askQuantity: numberOrNull(bestAsk?.quantity),
    upperCircuit: numberOrNull(quote.upperCircuit),
    lowerCircuit: numberOrNull(quote.lowerCircuit),
    exchFeedTime: feedTime ? feedTime.toISOString() : null,
    exchTradeTime: tradeTime ? tradeTime.toISOString() : null,
    // Latest exchange timestamp SmartAPI reports for this instrument.
    lastUpdateTime: latest > 0 ? new Date(latest).toISOString() : null,
    depth: quote.depth || null,
    raw: quote,
  };
}

async function readResponse(response) {
  let rawText = '';
  let payload = null;
  try {
    rawText = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json());
  } catch {
    rawText = '';
  }
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }
  return { payload, rawText };
}

export class AngelOneAdapter {
  /**
   * @param {object} options
   *   clientCode      Angel One client code (login id)
   *   apiKey          SmartAPI key (X-PrivateKey); falls back to ANGEL_ONE_API_KEY
   *   jwtToken / refreshToken / feedToken / tokenExpiresAt   stored session
   *   onSessionUpdate async (session) => void, called after login/refresh so the
   *                   caller can persist rotated tokens
   *   autoLogin       optional async (clientCode) => ({ mpin, totp }) | null, used
   *                   only when the session can no longer be renewed
   */
  constructor(options = {}) {
    this.name = ANGEL_ONE_DISPLAY_NAME;
    this.broker = ANGEL_ONE;
    this.baseUrl = text('ANGEL_ONE_BASE_URL') || ANGEL_ONE_BASE_URL;
    this.clientCode = String(options.clientCode || options.angelOneClientCode || '').trim().toUpperCase() || null;
    const userApiKey = String(options.apiKey || '').trim();
    this.apiKey = userApiKey || text('ANGEL_ONE_API_KEY') || null;
    this.apiKeySource = userApiKey ? 'USER' : (this.apiKey ? 'SERVER' : null);
    this.onSessionUpdate = typeof options.onSessionUpdate === 'function' ? options.onSessionUpdate : null;
    this.autoLogin = typeof options.autoLogin === 'function' ? options.autoLogin : null;
    this.session = null;
    this.refreshing = null;
    this.orderBookCache = null;
    if (options.jwtToken) {
      const jwtToken = String(options.jwtToken).replace(/^Bearer\s+/i, '').trim();
      this.session = {
        jwtToken,
        refreshToken: options.refreshToken ? String(options.refreshToken).trim() : null,
        feedToken: options.feedToken ? String(options.feedToken).trim() : null,
        tokenExpiresAt: normalizeTokenExpiry(options.tokenExpiresAt) || tokenExpiryFromJwt(jwtToken),
      };
    }
  }

  get tokenExpiresAt() {
    return this.session?.tokenExpiresAt || null;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  readiness() {
    const staticIp = getStaticIpReadiness();
    const configured = this.isConfigured();
    return {
      broker: ANGEL_ONE,
      name: this.name,
      mode: 'LIVE',
      configured,
      // Users may supply their own SmartAPI key, so the integration itself is
      // always available; `configured` reports whether a key is present now.
      enabled: true,
      apiKeySource: this.apiKeySource,
      serverApiKeyConfigured: Boolean(text('ANGEL_ONE_API_KEY')),
      staticIp,
      orderExecutionReady: configured && staticIp.ready === true,
      reason: configured
        ? 'Angel One SmartAPI key is available. Each user authenticates their own Angel One account.'
        : 'No SmartAPI key is configured on the server (ANGEL_ONE_API_KEY); each user must supply their own SmartAPI key when connecting.',
    };
  }

  capabilities() {
    return LIVE_CAPABILITIES;
  }

  headers(auth) {
    if (!this.apiKey) {
      const error = new BrokerApiError(this.name, 'a SmartAPI key is required (X-PrivateKey)', 400);
      error.code = 'BROKER_API_KEY_MISSING';
      error.angelCategory = 'INVALID_API_KEY';
      throw error;
    }
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-PrivateKey': this.apiKey,
      'X-SourceID': 'WEB',
      'X-UserType': 'USER',
      'X-ClientLocalIP': text('ANGEL_ONE_CLIENT_LOCAL_IP') || '127.0.0.1',
      'X-ClientPublicIP': text('ANGEL_ONE_CLIENT_PUBLIC_IP') || text('ANGEL_ONE_STATIC_IP') || '127.0.0.1',
      'X-MACAddress': text('ANGEL_ONE_MAC_ADDRESS') || '00:00:00:00:00:00',
    };
    if (auth) headers.Authorization = `Bearer ${this.session.jwtToken}`;
    return headers;
  }

  sessionExpiredError(message) {
    const error = new BrokerApiError(this.name, message || 'session expired; reconnect the Angel One account', 401);
    error.code = 'BROKER_SESSION_EXPIRED';
    error.angelCategory = 'SESSION_EXPIRED';
    return error;
  }

  buildError({ route, httpStatus, payload, rawText, login }) {
    const code = payload?.errorcode ?? payload?.errorCode ?? payload?.error_code ?? null;
    const providerMessage = payload?.message || (typeof payload?.error === 'string' ? payload.error : null) || null;
    const snippet = payload === null && rawText ? rawText.slice(0, 200) : null;
    const label = [code, providerMessage].filter(Boolean).join(': ') || snippet || `HTTP ${httpStatus}`;
    const error = new BrokerApiError(this.name, label);
    error.httpStatus = httpStatus;
    error.providerErrorCode = code ? String(code) : null;
    error.providerMessage = providerMessage || snippet;
    error.providerErrorType = payload?.error_type || null;
    error.route = route;
    error.raw = payload;
    const category = classifyAngelOneError(error, { login });
    error.angelCategory = category;
    error.code = CATEGORY_CODE[category];
    error.statusCode = CATEGORY_HTTP_STATUS[category];
    return error;
  }

  /** One HTTP exchange with SmartAPI. Throws a classified BrokerApiError on any failure. */
  async send(route, { method, body, auth, signal, pathSuffix = '' }) {
    const headers = this.headers(auth);
    const group = RATE_GROUP[route] || route;
    await acquireRateSlot(`${this.clientCode || 'anon'}:${group}`, RATE_INTERVAL_MS[group]);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout());
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    let response;
    let parsed;
    try {
      response = await fetch(`${joinUrl(this.baseUrl, ANGEL_ONE_ROUTES[route])}${pathSuffix}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      parsed = await readResponse(response);
    } catch (caught) {
      const timedOut = caught?.name === 'AbortError' || caught?.name === 'TimeoutError';
      const error = new BrokerApiError(this.name, timedOut ? 'request timed out' : `network error: ${caught?.cause?.code || caught?.message || 'request failed'}`, timedOut ? 504 : 503);
      error.code = timedOut ? 'BROKER_TIMEOUT' : 'NETWORK_ERROR';
      error.angelCategory = timedOut ? 'TIMEOUT' : 'NETWORK_ERROR';
      error.route = route;
      error.cause = caught;
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
    const { payload, rawText } = parsed;
    const rejected = payload && (payload.status === false || payload.success === false || payload.status === 'failure' || payload.error_type);
    if (!response.ok || rejected || payload === null) {
      throw this.buildError({ route, httpStatus: response.status, payload, rawText, login: !auth });
    }
    return payload;
  }

  /**
   * SmartAPI request with session handling and bounded retries:
   *  - an expired/rejected JWT is renewed once through generateTokens, then the
   *    call is repeated once;
   *  - read-only calls are retried on rate-limit, timeout, network and 5xx
   *    failures. Order placement/modification/cancellation and login are never
   *    retried automatically (their outcome would be unknown).
   */
  async request(route, { method = 'GET', body, auth = true, signal, retryable = method === 'GET', pathSuffix } = {}) {
    if (auth) {
      if (!this.session?.jwtToken) throw this.sessionExpiredError('no active session; connect the Angel One account');
      if (this.session.tokenExpiresAt && this.session.tokenExpiresAt.getTime() <= Date.now()) {
        await this.renewSession();
      }
    }
    const retryDelays = readRetryDelays();
    let refreshed = false;
    let attempt = 0;
    for (;;) {
      const tokenUsed = auth ? this.session?.jwtToken : null;
      try {
        return await this.send(route, { method, body, auth, signal, pathSuffix });
      } catch (error) {
        this.logFailure(error, { route, method });
        if (auth && error.angelCategory === 'SESSION_EXPIRED' && !refreshed) {
          refreshed = true;
          // Another in-flight call may already have renewed the session while
          // this one was travelling with the old token: just repeat with the new one.
          if (!this.session?.jwtToken || this.session.jwtToken === tokenUsed) {
            try {
              await this.renewSession();
            } catch (renewError) {
              // Keep Angel One's own rejection details when renewal was not possible.
              if (isAngelOneSessionError(renewError) && !renewError.providerErrorCode) {
                renewError.providerErrorCode = error.providerErrorCode ?? null;
                renewError.providerMessage = error.providerMessage ?? null;
                renewError.httpStatus = error.httpStatus ?? null;
              }
              throw renewError;
            }
          }
          continue;
        }
        const transient = ['RATE_LIMITED', 'TIMEOUT', 'NETWORK_ERROR', 'UPSTREAM_ERROR'].includes(error.angelCategory);
        if (retryable && transient && attempt < retryDelays.length && !signal?.aborted) {
          await delay(retryDelays[attempt], signal);
          attempt += 1;
          continue;
        }
        throw error;
      }
    }
  }

  logFailure(error, { route, method }) {
    // Never logs tokens, MPIN, TOTP or the API key: only route and provider error fields.
    console.warn('[ANGEL_ONE_API]', JSON.stringify({
      route,
      method,
      clientCode: this.clientCode,
      httpStatus: error.httpStatus ?? null,
      errorCode: error.providerErrorCode ?? null,
      errorMessage: error.providerMessage ?? null,
      category: error.angelCategory ?? null,
    }));
  }

  async applySession(data, { keepRefreshToken = false } = {}) {
    const jwtToken = String(data?.jwtToken || '').replace(/^Bearer\s+/i, '').trim();
    if (!jwtToken) {
      const error = new BrokerApiError(this.name, 'SmartAPI did not return a session token', 502);
      error.code = 'BROKER_UPSTREAM_ERROR';
      error.angelCategory = 'UPSTREAM_ERROR';
      throw error;
    }
    this.session = {
      jwtToken,
      refreshToken: data.refreshToken || (keepRefreshToken ? this.session?.refreshToken : null) || null,
      feedToken: data.feedToken || (keepRefreshToken ? this.session?.feedToken : null) || null,
      tokenExpiresAt: tokenExpiryFromJwt(jwtToken),
    };
    this.orderBookCache = null;
    if (this.onSessionUpdate) await this.onSessionUpdate({ ...this.session, clientCode: this.clientCode });
    return this.session;
  }

  /**
   * Logs in with client code + MPIN + TOTP (SmartAPI loginByPassword; Angel One
   * requires the MPIN in the `password` field). `totp` may be the current
   * 6-digit code or the base32 TOTP secret. Nothing passed here is stored.
   */
  async login({ clientCode, mpin, totp } = {}) {
    const code = String(clientCode || this.clientCode || '').trim().toUpperCase();
    const pin = String(mpin || '').trim();
    const otp = String(totp || '').trim();
    if (!code) throw validationError('Angel One client code is required');
    if (!pin) throw validationError('Angel One MPIN is required');
    if (!otp) throw validationError('Angel One TOTP is required');
    this.clientCode = code;
    const payload = await this.request('login', {
      method: 'POST',
      auth: false,
      retryable: false,
      body: { clientcode: code, password: pin, totp: generateTotp(otp) },
    });
    await this.applySession(payload?.data || {});
    return {
      authenticated: true,
      broker: this.name,
      clientCode: this.clientCode,
      tokenExpiresAt: this.session.tokenExpiresAt,
      feedTokenAvailable: Boolean(this.session.feedToken),
    };
  }

  /** Adopts tokens issued by the SmartAPI publisher (redirect) login. */
  async adoptSession({ jwtToken, refreshToken = null, feedToken = null } = {}) {
    return this.applySession({ jwtToken, refreshToken, feedToken });
  }

  /** Renews the JWT with the stored refresh token (SmartAPI generateTokens). */
  async refreshSession() {
    if (this.refreshing) return this.refreshing;
    if (!this.session?.refreshToken) {
      throw this.sessionExpiredError('session expired and no refresh token is stored; reconnect the Angel One account');
    }
    this.refreshing = (async () => {
      try {
        const payload = await this.send('generateTokens', {
          method: 'POST',
          auth: true,
          body: { refreshToken: this.session.refreshToken },
        });
        return await this.applySession(payload?.data || {}, { keepRefreshToken: true });
      } catch (error) {
        this.logFailure(error, { route: 'generateTokens', method: 'POST' });
        if (['SESSION_EXPIRED', 'INVALID_CREDENTIALS', 'REQUEST_ERROR'].includes(error.angelCategory)) {
          const expired = this.sessionExpiredError('session expired and could not be renewed; reconnect the Angel One account');
          expired.providerErrorCode = error.providerErrorCode ?? null;
          expired.providerMessage = error.providerMessage ?? null;
          expired.httpStatus = error.httpStatus ?? null;
          expired.refreshRejected = true;
          throw expired;
        }
        throw error;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /**
   * Keeps the session alive: refresh token first; if SmartAPI no longer accepts
   * it and the operator configured login credentials for this client code, a
   * fresh login is performed. Otherwise the session-expired error propagates.
   */
  async renewSession() {
    try {
      return await this.refreshSession();
    } catch (error) {
      if (!isAngelOneSessionError(error) || !this.autoLogin) throw error;
      const credentials = await this.autoLogin(this.clientCode);
      if (!credentials?.mpin || !credentials?.totp) throw error;
      try {
        await this.login({ clientCode: this.clientCode, mpin: credentials.mpin, totp: credentials.totp });
      } catch (loginError) {
        error.reloginError = loginError.message;
        throw error;
      }
      return this.session;
    }
  }

  /** Confirms the stored session with SmartAPI (profile call). */
  async authenticate() {
    const profile = await this.getProfile();
    return {
      authenticated: true,
      broker: this.name,
      clientCode: profile.clientCode,
      feedTokenAvailable: Boolean(this.session?.feedToken),
    };
  }

  /** Profile + funds. A session rejection from either call takes precedence. */
  async validateSession() {
    const profile = await this.getProfile();
    if (!profile.clientCode) {
      const error = new BrokerApiError(this.name, 'getProfile did not return a client code', 502);
      error.code = 'BROKER_PROFILE_INCOMPLETE';
      throw error;
    }
    if (this.clientCode && profile.clientCode !== this.clientCode) {
      const error = new Error('Angel One account identity does not match the connected client code');
      error.statusCode = 409;
      error.code = 'BROKER_ACCOUNT_IDENTITY_MISMATCH';
      throw error;
    }
    if (!this.clientCode) this.clientCode = profile.clientCode;
    let funds = null;
    let fundsError = null;
    try {
      funds = await this.getMargin();
    } catch (error) {
      if (isAngelOneSessionError(error)) throw error;
      fundsError = error;
    }
    return { valid: true, broker: this.name, clientCode: this.clientCode, profile, funds, fundsError: fundsError?.message || null };
  }

  /** Terminates the SmartAPI session. */
  async logout() {
    if (!this.session?.jwtToken) return { loggedOut: false, reason: 'no active session' };
    const payload = await this.request('logout', {
      method: 'POST',
      retryable: false,
      body: { clientcode: this.clientCode },
    });
    this.session = null;
    this.orderBookCache = null;
    return { loggedOut: true, message: payload?.message || null };
  }

  async getProfile() {
    const payload = await this.request('profile');
    const data = payload?.data || {};
    const clientCode = data.clientcode ? String(data.clientcode).trim().toUpperCase() : null;
    return {
      clientId: clientCode,
      clientCode,
      name: data.name ? String(data.name).trim() : null,
      email: data.email || null,
      mobile: data.mobileno || null,
      exchanges: Array.isArray(data.exchanges) ? data.exchanges : [],
      products: Array.isArray(data.products) ? data.products : [],
      lastLoginTime: data.lastlogintime || null,
      brokerId: data.brokerid || null,
      raw: data,
    };
  }

  /** Funds and margin (SmartAPI getRMS). */
  async getMargin() {
    const payload = await this.request('rms');
    const data = payload?.data || {};
    return {
      available: numberOrZero(data.availablecash),
      utilized: numberOrZero(data.utiliseddebits),
      collateral: numberOrZero(data.collateral),
      withdrawable: numberOrZero(data.net),
      net: numberOrZero(data.net),
      availableIntradayPayin: numberOrZero(data.availableintradaypayin),
      availableLimitMargin: numberOrZero(data.availablelimitmargin),
      m2mUnrealized: numberOrZero(data.m2munrealized),
      m2mRealized: numberOrZero(data.m2mrealized),
      utilizedSpan: numberOrZero(data.utilisedspan),
      utilizedExposure: numberOrZero(data.utilisedexposure),
      utilizedOptionPremium: numberOrZero(data.utilisedoptionpremium),
      raw: data,
    };
  }

  async getPositions() {
    const payload = await this.request('positions');
    const list = Array.isArray(payload?.data) ? payload.data : [];
    return list.map((position) => {
      const netQuantity = numberOrZero(position.netqty);
      const realizedPnl = numberOrZero(position.realised);
      const unrealizedPnl = numberOrZero(position.unrealised);
      const reportedPnl = numberOrNull(position.pnl);
      const entryPrice = netQuantity >= 0
        ? numberOrNull(position.buyavgprice) ?? numberOrNull(position.totalbuyavgprice)
        : numberOrNull(position.sellavgprice) ?? numberOrNull(position.totalsellavgprice);
      return {
        instrument: position.tradingsymbol || String(position.symboltoken || ''),
        tradingSymbol: position.tradingsymbol || null,
        side: netQuantity >= 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(netQuantity),
        entryPrice: entryPrice ?? numberOrZero(position.avgnetprice ?? position.netprice),
        currentPrice: numberOrZero(position.ltp),
        pnl: Number((reportedPnl ?? (realizedPnl + unrealizedPnl)).toFixed(2)),
        realizedPnl,
        unrealizedPnl,
        productType: position.producttype || null,
        exchange: position.exchange || null,
        exchangeSegment: position.exchange || null,
        symbolToken: position.symboltoken ? String(position.symboltoken) : null,
        securityId: position.symboltoken ? String(position.symboltoken) : null,
        lotSize: numberOrNull(position.lotsize),
        brokerPositionKey: `${position.exchange || ''}:${position.symboltoken || ''}:${position.producttype || ''}`,
        raw: position,
      };
    });
  }

  async getHoldings() {
    const payload = await this.request('holdings');
    const list = Array.isArray(payload?.data) ? payload.data : [];
    return list.map((holding) => ({
      tradingSymbol: holding.tradingsymbol || null,
      exchange: holding.exchange || null,
      totalQty: numberOrZero(holding.quantity),
      availableQty: numberOrZero(holding.realisedquantity ?? holding.quantity),
      t1Qty: numberOrZero(holding.t1quantity),
      avgCostPrice: numberOrZero(holding.averageprice),
      currentPrice: numberOrZero(holding.ltp),
      pnl: numberOrZero(holding.profitandloss),
      pnlPercentage: numberOrNull(holding.pnlpercentage),
      isin: holding.isin || null,
      securityId: holding.symboltoken ? String(holding.symboltoken) : null,
      symbolToken: holding.symboltoken ? String(holding.symboltoken) : null,
      product: holding.product || null,
      raw: holding,
    }));
  }

  /** Holdings totals for the account (SmartAPI getAllHolding). */
  async getPortfolio() {
    const payload = await this.request('allHoldings');
    const data = payload?.data || {};
    const totals = data.totalholding || {};
    return {
      holdingsCount: Array.isArray(data.holdings) ? data.holdings.length : 0,
      totalHoldingValue: numberOrZero(totals.totalholdingvalue),
      totalInvestedValue: numberOrZero(totals.totalinvvalue),
      totalPnl: numberOrZero(totals.totalprofitandloss),
      totalPnlPercentage: numberOrNull(totals.totalpnlpercentage),
      raw: data,
    };
  }

  async fetchOrderBook({ fresh = false } = {}) {
    if (!fresh && this.orderBookCache && Date.now() - this.orderBookCache.at < ORDER_BOOK_CACHE_MS) {
      return this.orderBookCache.orders;
    }
    const payload = await this.request('orderBook');
    const orders = Array.isArray(payload?.data) ? payload.data : [];
    this.orderBookCache = { at: Date.now(), orders };
    return orders;
  }

  /** Today's orders (SmartAPI order book = order history for the trading day). */
  async getOrderBook(options = {}) {
    return (await this.fetchOrderBook(options)).map(normalizeOrderRecord);
  }

  async getTradeBook() {
    const payload = await this.request('tradeBook');
    const list = Array.isArray(payload?.data) ? payload.data : [];
    return list.map((trade) => ({
      tradeId: trade.fillid ? String(trade.fillid) : null,
      orderId: trade.orderid ? String(trade.orderid) : null,
      tradingSymbol: trade.tradingsymbol || null,
      side: trade.transactiontype || null,
      tradedQuantity: numberOrNull(trade.fillsize),
      tradedPrice: numberOrNull(trade.fillprice),
      tradeValue: numberOrNull(trade.tradevalue),
      productType: trade.producttype || null,
      exchange: trade.exchange || null,
      tradeTime: trade.filltime || null,
      raw: trade,
    }));
  }

  async getOrderStatus({ brokerOrderId, uniqueOrderId } = {}) {
    if (!brokerOrderId && !uniqueOrderId) throw validationError('broker order id is required');
    if (uniqueOrderId) {
      const payload = await this.request('orderDetails', { pathSuffix: encodeURIComponent(String(uniqueOrderId)) });
      return normalizeBrokerExecution(payload?.data || {}, { brokerOrderId, uniqueOrderId });
    }
    const orders = await this.fetchOrderBook();
    const order = orders.find((item) => String(item.orderid) === String(brokerOrderId));
    if (!order) {
      const error = new BrokerApiError(this.name, `order ${brokerOrderId} was not found in today's order book`, 404);
      error.code = 'BROKER_NOT_FOUND';
      error.angelCategory = 'NOT_FOUND';
      throw error;
    }
    return normalizeBrokerExecution(order, { brokerOrderId: String(order.orderid) });
  }

  /** Order details by SmartAPI unique order id. */
  async getOrderLog(uniqueOrderId) {
    if (!uniqueOrderId) throw validationError('unique order id is required');
    const payload = await this.request('orderDetails', { pathSuffix: encodeURIComponent(String(uniqueOrderId)) });
    return normalizeOrderRecord(payload?.data || {});
  }

  /** Market quotes (SmartAPI quote API, up to 50 tokens per call). */
  async getQuotes({ mode = 'FULL', exchangeTokens } = {}) {
    const entries = Object.entries(exchangeTokens || {})
      .map(([exchange, tokens]) => [
        normalizeAngelExchange(exchange),
        [...new Set((Array.isArray(tokens) ? tokens : [tokens]).filter((token) => token !== undefined && token !== null && token !== '').map(String))],
      ])
      .filter(([exchange, tokens]) => exchange && tokens.length > 0);
    if (entries.length === 0) throw validationError('exchange and symbol token are required for market data');
    const fetched = [];
    const unfetched = [];
    for (const [exchange, tokens] of entries) {
      for (let index = 0; index < tokens.length; index += QUOTE_BATCH_SIZE) {
        const payload = await this.request('quote', {
          method: 'POST',
          retryable: true,
          body: { mode: String(mode).toUpperCase(), exchangeTokens: { [exchange]: tokens.slice(index, index + QUOTE_BATCH_SIZE) } },
        });
        for (const quote of payload?.data?.fetched || []) fetched.push(normalizeQuote(quote));
        for (const item of payload?.data?.unfetched || []) unfetched.push(item);
      }
    }
    return { fetched, unfetched, receivedAt: Date.now() };
  }

  async getQuote({ exchange, symbolToken, mode = 'FULL' } = {}) {
    const normalizedExchange = normalizeAngelExchange(exchange);
    if (!normalizedExchange || !symbolToken) throw validationError('exchange and symbol token are required for market data');
    const { fetched, unfetched } = await this.getQuotes({ mode, exchangeTokens: { [normalizedExchange]: [String(symbolToken)] } });
    const quote = fetched.find((item) => item.symbolToken === String(symbolToken)) || fetched[0] || null;
    if (!quote && unfetched.length > 0) {
      const failure = unfetched[0];
      const error = new BrokerApiError(this.name, `${failure.errorCode || ''} ${failure.message || 'quote not available for the requested token'}`.trim(), 404);
      error.code = 'BROKER_NOT_FOUND';
      error.angelCategory = 'NOT_FOUND';
      error.providerErrorCode = failure.errorCode || null;
      error.providerMessage = failure.message || null;
      throw error;
    }
    return quote;
  }

  /** Quote (LTP, OHLC, exchange times) for one instrument. */
  async getMarketData({ exchange, symbolToken, securityId, mode = 'FULL' } = {}) {
    return this.getQuote({ exchange, symbolToken: symbolToken || securityId, mode });
  }

  /** Full quote including 5-level market depth. */
  async getMarketDepth({ exchange, symbolToken, securityId } = {}) {
    return this.getQuote({ exchange, symbolToken: symbolToken || securityId, mode: 'FULL' });
  }

  /**
   * Historical candles (SmartAPI getCandleData). Returns
   * [{ timestamp (ISO), open, high, low, close, volume }] oldest first.
   */
  async getHistoricalData({ exchange, symbolToken, securityId, interval, fromDate, toDate } = {}) {
    const normalizedExchange = normalizeAngelExchange(exchange);
    const token = symbolToken || securityId;
    const angelInterval = normalizeAngelInterval(interval);
    const from = formatAngelCandleTime(fromDate, '09:15');
    const to = formatAngelCandleTime(toDate, '15:30');
    if (!normalizedExchange || !token) throw validationError('exchange and symbol token are required for historical data');
    if (!angelInterval) throw validationError(`unsupported candle interval "${interval}"`);
    if (!from || !to) throw validationError('fromDate and toDate are required for historical data');
    const payload = await this.request('candles', {
      method: 'POST',
      retryable: true,
      body: { exchange: normalizedExchange, symboltoken: String(token), interval: angelInterval, fromdate: from, todate: to },
    });
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return rows
      .map((row) => {
        const time = parseAngelDateTime(row?.[0]);
        return {
          timestamp: time ? time.toISOString() : null,
          open: numberOrNull(row?.[1]),
          high: numberOrNull(row?.[2]),
          low: numberOrNull(row?.[3]),
          close: numberOrNull(row?.[4]),
          volume: numberOrZero(row?.[5]),
        };
      })
      .filter((candle) => candle.timestamp && [candle.open, candle.high, candle.low, candle.close].every((value) => value !== null))
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  }

  async getChartData(params = {}) {
    return this.getHistoricalData(params);
  }

  /** Option greeks for an underlying + expiry ("28NOV2026"). */
  async getOptionGreeks({ name, expiry } = {}) {
    if (!name || !expiry) throw validationError('underlying name and expiry are required for option greeks');
    const payload = await this.request('optionGreek', {
      method: 'POST',
      retryable: true,
      body: { name: String(name).toUpperCase(), expirydate: String(expiry).toUpperCase() },
    });
    return (Array.isArray(payload?.data) ? payload.data : []).map((row) => ({
      strike: numberOrNull(row.strikePrice),
      optionType: String(row.optionType || '').toUpperCase(),
      delta: numberOrNull(row.delta),
      gamma: numberOrNull(row.gamma),
      theta: numberOrNull(row.theta),
      vega: numberOrNull(row.vega),
      impliedVolatility: numberOrNull(row.impliedVolatility),
      tradeVolume: numberOrNull(row.tradeVolume),
    }));
  }

  /** Transaction/ledger history is not offered by SmartAPI. */
  async getTransactionHistory() {
    const error = new BrokerCapabilityError(this.name, 'transaction history (SmartAPI does not provide it; use the order and trade books)');
    error.statusCode = 501;
    throw error;
  }

  /** Builds and validates the SmartAPI placeOrder body. Performs no network call. */
  buildOrderPayload(order = {}) {
    const metadata = order.metadata || {};
    const quantity = Number(order.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw validationError('order quantity must be a positive integer');
    const symbolToken = String(metadata.symbolToken || metadata.symboltoken || metadata.securityId || '').trim();
    const tradingSymbol = String(metadata.tradingSymbol || metadata.tradingsymbol || '').trim();
    const requestedExchange = metadata.exchange || metadata.exchangeSegment || 'NFO';
    const exchange = normalizeAngelExchange(requestedExchange);
    if (!symbolToken || !tradingSymbol) throw validationError('verified Angel One symbol token and trading symbol are required');
    if (!exchange) throw validationError(`unsupported exchange "${requestedExchange}"`);
    const side = String(order.side || '').toUpperCase();
    if (!['BUY', 'SELL'].includes(side)) throw validationError('order side must be BUY or SELL');
    const requestedType = metadata.orderType || order.orderType || (Number(order.price) > 0 ? 'LIMIT' : 'MARKET');
    const orderType = ORDER_TYPE_ALIASES[String(requestedType).toUpperCase()];
    if (!orderType) throw validationError(`unsupported order type "${requestedType}"`);
    const requestedProduct = metadata.productType || order.productType || 'INTRADAY';
    const productType = PRODUCT_ALIASES[String(requestedProduct).toUpperCase()];
    if (!productType) throw validationError(`unsupported product type "${requestedProduct}"`);
    if (['NFO', 'BFO', 'MCX', 'CDS'].includes(exchange)) {
      const lotSize = Number(metadata.lotSize);
      if (!Number.isFinite(lotSize) || lotSize <= 0) throw validationError('verified lot size is required for derivative orders');
      if (quantity % lotSize !== 0) throw validationError('order quantity must be a multiple of the verified lot size');
    }
    const priced = orderType === 'LIMIT' || orderType === 'STOPLOSS_LIMIT';
    const price = priced ? Number(order.price || 0) : 0;
    if (priced && !(price > 0)) throw validationError('a positive price is required for limit orders');
    const isStopLoss = orderType.startsWith('STOPLOSS');
    const triggerPrice = Number(metadata.triggerPrice || order.triggerPrice || 0);
    if (isStopLoss && !(triggerPrice > 0)) throw validationError('a positive trigger price is required for stop-loss orders');
    const ordertag = angelOrderTag(order.internalOrderId || order.correlationId || metadata.correlationId);
    return {
      variety: String(metadata.variety || (isStopLoss ? 'STOPLOSS' : 'NORMAL')).toUpperCase(),
      tradingsymbol: tradingSymbol,
      symboltoken: symbolToken,
      transactiontype: side,
      exchange,
      ordertype: orderType,
      producttype: productType,
      duration: String(metadata.validity || metadata.duration || order.duration || 'DAY').toUpperCase(),
      price: String(price),
      triggerprice: String(isStopLoss ? triggerPrice : 0),
      squareoff: '0',
      stoploss: '0',
      quantity: String(quantity),
      ...(ordertag ? { ordertag } : {}),
    };
  }

  /**
   * Hard gate for every order-mutating call: this server's outbound IP must
   * equal the configured static IP that is registered with Angel One.
   */
  async assertOrderExecutionReady() {
    const staticIp = await verifyAngelOneStaticIp();
    if (!staticIp.ready) {
      const error = new BrokerApiError(this.name, `order API blocked: ${staticIp.reason}`, 412);
      error.code = 'STATIC_IP_NOT_READY';
      error.staticIp = staticIp;
      throw error;
    }
    return staticIp;
  }

  async placeOrder(order = {}) {
    const body = this.buildOrderPayload(order);
    await this.assertOrderExecutionReady();
    const payload = await this.request('placeOrder', { method: 'POST', retryable: false, body });
    const brokerOrderId = payload?.data?.orderid;
    if (!brokerOrderId) {
      const error = new BrokerApiError(this.name, 'placeOrder response did not include an order id', 502);
      error.code = 'BROKER_UPSTREAM_ERROR';
      error.angelCategory = 'UPSTREAM_ERROR';
      throw error;
    }
    this.orderBookCache = null;
    return {
      brokerOrderId: String(brokerOrderId),
      uniqueOrderId: payload.data.uniqueorderid || null,
      exchangeOrderId: null,
      correlationId: body.ordertag || null,
      status: 'SUBMITTED',
      rejectionReason: null,
    };
  }

  async modifyOrder(order = {}) {
    const brokerOrderId = order.brokerOrderId || order.broker_order_id || order.orderId;
    if (!brokerOrderId) throw validationError('broker order id is required');
    const body = this.buildOrderPayload({ ...order, internalOrderId: null, correlationId: null, metadata: { ...(order.metadata || {}), correlationId: null } });
    delete body.ordertag;
    delete body.squareoff;
    delete body.stoploss;
    await this.assertOrderExecutionReady();
    await this.request('modifyOrder', { method: 'POST', retryable: false, body: { ...body, orderid: String(brokerOrderId) } });
    this.orderBookCache = null;
    return { brokerOrderId: String(brokerOrderId), status: 'SUBMITTED' };
  }

  async cancelOrder(order = {}) {
    const brokerOrderId = order.brokerOrderId || order.broker_order_id || order.orderId;
    if (!brokerOrderId) throw validationError('broker order id is required');
    await this.assertOrderExecutionReady();
    await this.request('cancelOrder', {
      method: 'POST',
      retryable: false,
      body: { variety: String(order.metadata?.variety || 'NORMAL').toUpperCase(), orderid: String(brokerOrderId) },
    });
    this.orderBookCache = null;
    return { brokerOrderId: String(brokerOrderId), status: 'CANCELLED' };
  }

  /**
   * SmartAPI has no exit-all endpoint: each open position is closed with an
   * opposite MARKET order. Returns which exit orders Angel One accepted and
   * which it refused; throws only when no exit order could be placed.
   */
  async exitAllPositions() {
    await this.assertOrderExecutionReady();
    const open = (await this.getPositions()).filter((position) => position.quantity > 0 && position.symbolToken);
    const placed = [];
    const failed = [];
    for (const position of open) {
      try {
        const result = await this.placeOrder({
          side: position.side === 'BUY' ? 'SELL' : 'BUY',
          quantity: position.quantity,
          price: 0,
          metadata: {
            symbolToken: position.symbolToken,
            tradingSymbol: position.tradingSymbol,
            exchange: position.exchange,
            productType: position.productType || 'INTRADAY',
            orderType: 'MARKET',
            lotSize: position.lotSize || 1,
          },
        });
        placed.push({ tradingSymbol: position.tradingSymbol, quantity: position.quantity, brokerOrderId: result.brokerOrderId });
      } catch (error) {
        failed.push({ tradingSymbol: position.tradingSymbol, quantity: position.quantity, reason: error.message, errorCode: error.providerErrorCode ?? null });
      }
    }
    if (open.length > 0 && placed.length === 0) {
      const error = new BrokerApiError(this.name, `no exit order was accepted: ${failed[0]?.reason || 'unknown reason'}`, 502);
      error.code = 'BROKER_EXIT_ALL_FAILED';
      error.failed = failed;
      throw error;
    }
    return { status: failed.length === 0 ? 'SUCCESS' : 'PARTIAL', openPositions: open.length, placed, failed };
  }

  async subscribeExecutionUpdates({ brokerOrderIds = [], onUpdate, signal, intervalMs = 5000 } = {}) {
    if (typeof onUpdate !== 'function') throw new TypeError('onUpdate callback is required');
    if (!Array.isArray(brokerOrderIds) || brokerOrderIds.length === 0) throw new TypeError('brokerOrderIds are required');
    const pendingIds = new Set(brokerOrderIds.map(String));
    while (!signal?.aborted && pendingIds.size > 0) {
      for (const brokerOrderId of [...pendingIds]) {
        try {
          const update = await this.getOrderStatus({ brokerOrderId });
          await onUpdate(update);
          if (isTerminalExecutionStatus(update.status)) pendingIds.delete(String(brokerOrderId));
        } catch (error) {
          await onUpdate({ brokerOrderId, status: 'ERROR', error: error.message });
        }
      }
      if (pendingIds.size > 0) await delay(intervalMs, signal);
    }
    return { stopped: true };
  }
}

function assertSupportedBroker(broker) {
  if (broker !== ANGEL_ONE) {
    const error = new Error(`Unsupported broker: ${broker}. Angel One SmartAPI is the only supported broker.`);
    error.statusCode = 400;
    error.code = 'UNSUPPORTED_BROKER';
    throw error;
  }
}

/** LIVE-only factory. `mode` is accepted for call-site compatibility and must be LIVE. */
export function getBrokerAdapter(broker = ANGEL_ONE, mode = 'LIVE', options = {}) {
  assertSupportedBroker(broker);
  if (mode && mode !== 'LIVE') throw new Error('Only LIVE trading is supported.');
  return new AngelOneAdapter(options);
}

export function getBrokerReadiness(broker = ANGEL_ONE, mode = 'LIVE') {
  const adapter = getBrokerAdapter(broker, mode);
  return { ...adapter.readiness(), capabilities: adapter.capabilities() };
}
