import { createHmac } from 'crypto';
import { getStaticIpReadiness } from '../services/static-ip.service.js';

const ANGEL_ONE_BASE_URL = 'https://apiconnect.angelone.in';
const DHAN_BASE_URL = 'https://api.dhan.co/v2';
const DHAN_AUTH_URL = 'https://auth.dhan.co';
const DHAN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const LIVE_CAPABILITIES = {
  authentication: true,
  marketData: true,
  historicalData: true,
  orderPlacement: true,
  orderModification: true,
  orderCancellation: true,
  orderStatus: true,
  positions: true,
  tradeBook: true,
  margin: true,
  executionUpdates: true,
};

const BROKER_CAPABILITIES = Object.fromEntries(
  Object.keys(LIVE_CAPABILITIES).map((key) => [key, false])
);

const text = (name) => String(process.env[name] || '').trim();

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = String(value || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Angel One TOTP secret is not valid base32');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

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

function normalizeAngelInterval(interval) {
  const intervals = {
    '1m': 'ONE_MINUTE',
    '3m': 'THREE_MINUTE',
    '5m': 'FIVE_MINUTE',
    '10m': 'TEN_MINUTE',
    '15m': 'FIFTEEN_MINUTE',
    '30m': 'THIRTY_MINUTE',
    '1h': 'ONE_HOUR',
    '1d': 'ONE_DAY',
  };
  return intervals[String(interval || '').toLowerCase()] || interval;
}

export class BrokerCapabilityError extends Error {
  constructor(broker, capability) {
    super(`${broker} ${capability} is not configured for live execution`);
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

class BrokerAdapter {
  constructor(name) {
    this.name = name;
  }

  readiness() {
    return {
      broker: this.name,
      mode: 'LIVE',
      configured: false,
      enabled: false,
      reason: 'This adapter is not configured with official broker credentials.',
    };
  }

  capabilities() {
    return BROKER_CAPABILITIES;
  }

  async authenticate() { throw new BrokerCapabilityError(this.name, 'authentication'); }
  async getMarketData() { throw new BrokerCapabilityError(this.name, 'market data'); }
  async getHistoricalData() { throw new BrokerCapabilityError(this.name, 'historical data'); }
  async placeOrder() { throw new BrokerCapabilityError(this.name, 'order placement'); }
  async modifyOrder() { throw new BrokerCapabilityError(this.name, 'order modification'); }
  async cancelOrder() { throw new BrokerCapabilityError(this.name, 'order cancellation'); }
  async getOrderStatus() { throw new BrokerCapabilityError(this.name, 'order status'); }
  async getPositions() { throw new BrokerCapabilityError(this.name, 'positions'); }
  async getTradeBook() { throw new BrokerCapabilityError(this.name, 'trade book'); }
  async getMargin() { throw new BrokerCapabilityError(this.name, 'margin'); }
  async subscribeExecutionUpdates() { throw new BrokerCapabilityError(this.name, 'execution updates'); }
}

function requireFields(broker, fields) {
  const missing = fields.filter((field) => !text(field));
  if (missing.length > 0) {
    throw new BrokerCapabilityError(broker, `configuration (${missing.join(', ')})`);
  }
}

/**
 * Dhan Data APIs report numeric 8xx codes (documented: 800, 804-814) rather
 * than errorCode/errorMessage fields. Accept either `{ errorCode: 806 }` or a
 * map keyed by the code, e.g. `{ data: { "806": "Data APIs not subscribed" } }`.
 */
function extractNumericDataApiError(payload) {
  for (const candidate of [payload?.data, payload]) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const key = Object.keys(candidate).find((name) => /^8\d\d$/.test(name));
    if (key) return { code: key, message: typeof candidate[key] === 'string' ? candidate[key] : null };
  }
  return null;
}

function providerErrorFields(payload) {
  const numeric = extractNumericDataApiError(payload);
  const code = payload?.errorCode ?? payload?.errorcode ?? payload?.remarks?.error_code ?? numeric?.code ?? null;
  const message = payload?.remarks?.message
    || payload?.errorMessage
    || payload?.message
    || (typeof payload?.error === 'string' ? payload.error : null)
    || numeric?.message
    || null;
  return { code: code === null || code === undefined ? null : String(code), message, type: payload?.errorType || null };
}

async function parseJsonResponse(broker, response) {
  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    rawText = '';
  }
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const provider = providerErrorFields(payload);
    const message = [provider.code, provider.message].filter(Boolean).join(': ') || `HTTP ${response.status}`;
    const err = new BrokerApiError(broker, message, response.status >= 500 ? 502 : response.status);
    err.httpStatus = response.status;
    err.providerErrorCode = provider.code;
    err.providerErrorType = provider.type;
    err.providerMessage = provider.message;
    // Non-JSON bodies are kept (truncated) so the real upstream reply is visible in logs.
    err.providerBodySnippet = payload === null && rawText ? rawText.slice(0, 200) : null;
    if (response.status === 429) {
      err.code = 'BROKER_RATE_LIMITED';
      err.statusCode = 429;
    } else if (response.status === 401 || response.status === 403 || /expired|invalid token|unauthorized/i.test(String(message))) {
      err.code = 'BROKER_SESSION_EXPIRED';
      err.statusCode = 401;
    }
    err.raw = payload;
    throw err;
  }
  if (payload && (payload.status === false || payload.status === 'failure' || payload.status === 'failed')) {
    const provider = providerErrorFields(payload);
    const message = [provider.code, provider.message].filter(Boolean).join(': ') || 'Request rejected by broker';
    const err = new BrokerApiError(broker, message);
    err.httpStatus = response.status;
    err.providerErrorCode = provider.code;
    err.providerErrorType = provider.type;
    err.providerMessage = provider.message;
    if (/expired|invalid token|unauthorized/i.test(String(message))) {
      err.code = 'BROKER_SESSION_EXPIRED';
      err.statusCode = 401;
    }
    err.raw = payload;
    throw err;
  }
  return payload;
}

/**
 * Classifies a Dhan failure using the documented codes (dhanhq.co/docs/v2/annexure):
 *   DH-901 auth, DH-902 Data API not subscribed / no access, DH-903 account, DH-904 rate limit,
 *   DH-905 input, DH-906 order, DH-907 data error, DH-908 internal, DH-909 network, DH-910 other;
 *   Data API: 800 internal, 804 too many instruments, 805 too many requests, 806 Data APIs not
 *   subscribed, 807 token expired, 808 auth failed, 809 token invalid, 810 client ID invalid,
 *   811 invalid expiry, 812 invalid date format, 813 invalid SecurityId, 814 invalid request.
 */
export function classifyDhanError(error, { dataApi = false } = {}) {
  const code = String(error?.providerErrorCode || '').toUpperCase();
  const http = Number(error?.httpStatus) || null;
  if (error?.code === 'NETWORK_ERROR' || error?.code === 'BROKER_TIMEOUT' || code === 'DH-909') return 'NETWORK_ERROR';
  if (code === 'DH-904' || code === '805' || http === 429) return 'RATE_LIMITED';
  if (code === 'DH-902' || code === '806') return 'DATA_API_NOT_ACTIVE';
  if (code === '810') return 'INVALID_CLIENT_ID';
  if (code === '813') return 'INVALID_SECURITY_ID';
  if (code === 'DH-901' || code === '807' || code === '808' || code === '809') return 'AUTH_FAILED';
  if (code === 'DH-903') return 'ACCOUNT_ERROR';
  if (['DH-905', 'DH-907', '804', '811', '812', '814'].includes(code)) return dataApi ? 'MARKET_DATA_ERROR' : 'REQUEST_ERROR';
  if (code === 'DH-908' || code === 'DH-910' || code === '800' || (http && http >= 500)) return 'UPSTREAM_ERROR';
  // 401/403 with no documented code: on a Data API this cannot be told apart
  // from a missing subscription without the profile's dataPlan; report as such.
  if (http === 401 || http === 403) return dataApi ? 'DATA_API_ACCESS_DENIED' : 'AUTH_FAILED';
  return dataApi ? 'MARKET_DATA_ERROR' : 'UPSTREAM_ERROR';
}

/**
 * Parses Dhan's "DD/MM/YYYY HH:mm[:ss]" timestamps, which are IST (UTC+05:30).
 * Returns a UTC Date, or null when absent/unparseable/placeholder (01/01/1980).
 */
export function parseDhanDateTime(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || '').trim());
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min, ss = '0'] = match;
  if (Number(yyyy) < 2000) return null;
  const utcMs = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss)) - (330 * 60 * 1000);
  const parsed = new Date(utcMs);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Documented Dhan limits (dhanhq.co/docs/v2): Quote APIs 1 req/s, Data APIs 5 req/s.
const DHAN_RATE_GATES = new Map();
const QUOTE_API_INTERVAL_MS = 1100;
const DATA_API_INTERVAL_MS = 250;

async function acquireDhanRateSlot(key, intervalMs) {
  const now = Date.now();
  const nextAllowed = DHAN_RATE_GATES.get(key) || 0;
  const slot = Math.max(now, nextAllowed);
  DHAN_RATE_GATES.set(key, slot + intervalMs);
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
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
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return Number.isFinite(Number(payload.exp)) ? new Date(Number(payload.exp) * 1000) : null;
  } catch {
    return null;
  }
}

function normalizeTokenExpiry(value, fallbackMs = null) {
  if (value !== undefined && value !== null && value !== '') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallbackMs ? new Date(Date.now() + fallbackMs) : null;
}

/** Dhan /v2/profile tokenValidity ("DD/MM/YYYY HH:mm", IST). */
export function parseDhanTokenValidity(value) {
  return parseDhanDateTime(value);
}

function assertTokenNotExpired(broker, expiresAt) {
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    const error = new BrokerApiError(broker, 'Broker session expired; a new production session is required', 401);
    error.code = 'BROKER_SESSION_EXPIRED';
    throw error;
  }
}

function responseTokenExpiry(data, fallbackMs = null) {
  return normalizeTokenExpiry(
    data?.expiresAt || data?.expires_at || data?.expiresOn || data?.expiry
      || (data?.expiresIn !== undefined ? Date.now() + Number(data.expiresIn) * 1000 : null),
    fallbackMs,
  );
}

function requestTimeout(name) {
  const value = Number(process.env[`${name}_TIMEOUT_MS`] || process.env.BROKER_TIMEOUT_MS || 10_000);
  return Number.isFinite(value) && value > 0 ? value : 10_000;
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeBrokerExecution(payload = {}, fallback = {}) {
  const data = payload?.data || payload?.order || payload;
  return {
    brokerOrderId: data?.brokerOrderId || data?.orderId || data?.orderID || data?.order_id || data?.orderid || data?.OrderNo || fallback.brokerOrderId || null,
    exchangeOrderId: data?.exchangeOrderId || data?.exchange_order_id || data?.ExchOrderNo || data?.exchangeOrderNo || fallback.exchangeOrderId || null,
    correlationId: data?.correlationId || data?.correlation_id || data?.CorrelationId || fallback.correlationId || null,
    status: data?.status || data?.orderStatus || data?.orderstatus || data?.order_status || data?.Status || fallback.status || 'SUBMITTED',
    averagePrice: numberOrNull(data?.averagePrice ?? data?.average_price ?? data?.avgPrice ?? data?.averageprice ?? data?.avgTradedPrice ?? data?.AvgTradedPrice ?? data?.averageTradedPrice),
    filledQuantity: numberOrNull(data?.filledQuantity ?? data?.filled_quantity ?? data?.filledshares ?? data?.tradedQuantity ?? data?.TradedQty ?? data?.filledQty),
    remainingQuantity: numberOrNull(data?.remainingQuantity ?? data?.remaining_quantity ?? data?.remainingQty ?? data?.RemainingQty),
    charges: numberOrNull(data?.charges ?? data?.totalCharges ?? data?.brokerage),
    rejectionReason: data?.rejectionReason || data?.rejection_reason || data?.rejectReason || data?.error || data?.ReasonDescription || data?.reasonDescription || null,
    raw: data,
  };
}

function isTerminalExecutionStatus(status) {
  return [
    'FILLED',
    'COMPLETE',
    'COMPLETED',
    'EXECUTED',
    'TRADED',
    'CANCELLED',
    'CANCELED',
    'EXPIRED',
    'REJECTED',
    'ERROR',
    'FAILED',
  ].includes(String(status || '').toUpperCase());
}

function brokerInstrument(order = {}) {
  const metadata = order.metadata || {};
  const symbolToken = metadata.symbolToken || metadata.symboltoken;
  const tradingSymbol = metadata.tradingSymbol || metadata.tradingsymbol;
  const exchange = metadata.exchange || 'NFO';
  if (!symbolToken || !tradingSymbol) {
    throw new BrokerCapabilityError(
      order.broker || 'Broker',
      'instrument mapping (symbolToken and tradingSymbol are required)'
    );
  }
  return { symbolToken: String(symbolToken), tradingSymbol: String(tradingSymbol), exchange };
}

export class AngelOneAdapter extends BrokerAdapter {
  constructor(options = {}) {
    super('Angel One');
    this.baseUrl = text('ANGEL_ONE_BASE_URL') || ANGEL_ONE_BASE_URL;
    this.session = null;
    this.options = options;
    
    // User-specific credentials (prioritize over environment variables)
    this.angelOneClientCode = options.angelOneClientCode || text('ANGEL_ONE_CLIENT_CODE');
    this.password = options.password || text('ANGEL_ONE_PASSWORD') || text('ANGEL_ONE_MPIN');
    this.apiKey = options.apiKey || text('ANGEL_ONE_API_KEY');
    this.totpSecret = options.totpSecret || text('ANGEL_ONE_TOTP_SECRET');
    
    // If session tokens provided (from database), use them directly
    if (options.jwtToken) {
      this.session = {
        jwtToken: options.jwtToken,
        refreshToken: options.refreshToken || null,
        feedToken: options.feedToken || null,
        tokenExpiresAt: normalizeTokenExpiry(options.tokenExpiresAt) || tokenExpiryFromJwt(options.jwtToken),
      };
    }
  }

  configFields() {
    return ['ANGEL_ONE_API_KEY', 'ANGEL_ONE_TOTP_SECRET'];
  }

  isConfigured() {
    // For user-specific connections, check if we have the required fields
    if (this.angelOneClientCode && this.password && this.apiKey && this.totpSecret) {
      return true;
    }
    // Fallback to environment variables
    return this.configFields().every((field) => Boolean(text(field)))
      && Boolean(text('ANGEL_ONE_CLIENT_CODE'))
      && Boolean(text('ANGEL_ONE_PASSWORD') || text('ANGEL_ONE_MPIN'));
  }

  readiness() {
    const configured = this.isConfigured();
    const staticIp = getStaticIpReadiness('ANGEL_ONE');
    const missingFields = [];
    
    if (!this.apiKey && !text('ANGEL_ONE_API_KEY')) missingFields.push('ANGEL_ONE_API_KEY');
    if (!this.totpSecret && !text('ANGEL_ONE_TOTP_SECRET')) missingFields.push('ANGEL_ONE_TOTP_SECRET');
    if (!this.angelOneClientCode && !text('ANGEL_ONE_CLIENT_CODE')) missingFields.push('ANGEL_ONE_CLIENT_CODE');
    if (!this.password && !text('ANGEL_ONE_PASSWORD') && !text('ANGEL_ONE_MPIN')) {
      missingFields.push('ANGEL_ONE_PASSWORD or ANGEL_ONE_MPIN');
    }
    
    return {
      broker: this.name,
      mode: 'LIVE',
      configured,
      enabled: configured,
      staticIp,
      orderExecutionReady: configured && staticIp.ready,
      reason: configured 
        ? 'Angel One configured for live trading' 
        : `Missing required Angel One configuration: ${missingFields.join(', ')}`,
    };
  }

  capabilities() {
    return this.isConfigured() ? LIVE_CAPABILITIES : BROKER_CAPABILITIES;
  }

  async request(path, { method = 'GET', body, auth = true, signal } = {}) {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-PrivateKey': this.apiKey || text('ANGEL_ONE_API_KEY'),
      'X-SourceID': 'WEB',
      'X-UserType': 'USER',
      'X-ClientLocalIP': text('ANGEL_ONE_CLIENT_LOCAL_IP') || '127.0.0.1',
      'X-ClientPublicIP': text('ANGEL_ONE_CLIENT_PUBLIC_IP') || '127.0.0.1',
      'X-MACAddress': text('ANGEL_ONE_MAC_ADDRESS') || '00:00:00:00:00:00',
    };
    if (auth) {
      if (!this.session) {
        await this.authenticate();
      }
      assertTokenNotExpired(this.name, this.session?.tokenExpiresAt);
      if (!this.session?.jwtToken) {
        throw new BrokerApiError(this.name, 'No valid session token available', 401);
      }
      headers.Authorization = `Bearer ${this.session.jwtToken}`;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout('ANGEL_ONE'));
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await fetch(joinUrl(this.baseUrl, path), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      return await parseJsonResponse(this.name, response);
    } catch (error) {
      if (error.name === 'AbortError') throw new BrokerApiError(this.name, 'request timed out', 504);
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  async authenticate() {
    if (this.session?.jwtToken) {
      assertTokenNotExpired(this.name, this.session.tokenExpiresAt);
      if (!this.session.tokenExpiresAt) {
        await this.getProfile();
      }
      return {
        authenticated: true,
        broker: this.name,
        feedTokenAvailable: Boolean(this.session.feedToken),
        clientCode: this.angelOneClientCode,
      };
    }

    // Use user-provided credentials or fallback to environment
    const clientCode = this.angelOneClientCode || text('ANGEL_ONE_CLIENT_CODE');
    const password = this.password || text('ANGEL_ONE_PASSWORD') || text('ANGEL_ONE_MPIN');
    const apiKey = this.apiKey || text('ANGEL_ONE_API_KEY');
    const totpSecret = this.totpSecret || text('ANGEL_ONE_TOTP_SECRET');
    
    if (!clientCode) throw new BrokerApiError(this.name, 'Angel One Client Code is required', 400);
    if (!password) throw new BrokerApiError(this.name, 'Angel One Password/MPIN is required', 400);
    if (!apiKey) throw new BrokerApiError(this.name, 'Angel One API Key is required', 400);
    if (!totpSecret) throw new BrokerApiError(this.name, 'Angel One TOTP Secret is required', 400);
    
    try {
      const payload = await this.request('/rest/auth/angelbroking/user/v1/loginByPassword', {
        method: 'POST',
        auth: false,
        body: {
          clientcode: clientCode,
          password,
          totp: generateTotp(totpSecret),
        },
      });
      
      const data = payload?.data || {};
      if (!data.jwtToken) {
        throw new BrokerApiError(this.name, 'Authentication failed - no session token received', 401);
      }
      
      this.session = {
        jwtToken: data.jwtToken,
        refreshToken: data.refreshToken || null,
        feedToken: data.feedToken || null,
        tokenExpiresAt: responseTokenExpiry(data) || tokenExpiryFromJwt(data.jwtToken),
      };
      
      return { 
        authenticated: true, 
        broker: this.name, 
        feedTokenAvailable: Boolean(data.feedToken),
        clientCode: clientCode
      };
    } catch (error) {
      if (error.name === 'BrokerApiError') {
        throw error;
      }
      throw new BrokerApiError(this.name, `Authentication failed: ${error.message}`, 401);
    }
  }

  async validateSession() {
    // Validate current session and get account info
    await this.authenticate();
    const margin = await this.getMargin();
    return {
      valid: true,
      funds: margin,
      broker: this.name,
    };
  }

  async getProfile() {
    const payload = await this.request('/rest/secure/angelbroking/user/v1/getProfile');
    return payload?.data || payload;
  }

  async generateConsentSession() {
    // Angel One SmartAPI OAuth consent flow placeholder
    const apiKey = this.apiKey || text('ANGEL_ONE_API_KEY');
    if (!apiKey) throw new BrokerApiError(this.name, 'Angel One API Key is required', 400);
    
    return {
      authorizationUrl: `https://smartapi.angelbroking.com/publisher-login?api_key=${apiKey}`,
      consentAppId: apiKey,
    };
  }

  async consumeConsent({ tokenId }) {
    // Angel One SmartAPI OAuth token consumption
    // Falls back to direct authentication
    const authResult = await this.authenticate();
    const clientCode = this.angelOneClientCode || text('ANGEL_ONE_CLIENT_CODE');
    
    return {
      jwtToken: this.session.jwtToken,
      refreshToken: this.session.refreshToken,
      feedToken: this.session.feedToken,
      tokenExpiresAt: this.session.tokenExpiresAt,
      clientCode: clientCode,
    };
  }

  async getMarketData({ exchange, symbolToken } = {}) {
    requireFields(this.name, this.configFields());
    if (!exchange || !symbolToken) throw new BrokerCapabilityError(this.name, 'market-data instrument mapping');
    return this.request('/rest/secure/angelbroking/market/v1/quote/', {
      method: 'POST',
      body: { mode: 'FULL', exchangeTokens: { [exchange]: [String(symbolToken)] } },
    });
  }

  async getMarketDepth({ exchange, symbolToken } = {}) {
    if (!exchange || !symbolToken) throw new BrokerCapabilityError(this.name, 'market-depth instrument mapping');
    const segment = {
      NSE: 'NSE_EQ',
      BSE: 'BSE_EQ',
      NFO: 'NSE_FNO',
      BFO: 'BSE_FNO',
      MCX: 'MCX_COMM',
      IDX_I: 'IDX_I',
    }[String(exchange).toUpperCase()] || String(exchange).toUpperCase();
    return this.request('/marketfeed/quote', {
      method: 'POST',
      body: { [segment]: [String(symbolToken)] },
    });
  }

  async getHistoricalData({ exchange, symbolToken, interval, fromDate, toDate } = {}) {
    requireFields(this.name, this.configFields());
    if (!exchange || !symbolToken || !interval || !fromDate || !toDate) {
      throw new BrokerCapabilityError(this.name, 'historical-data parameters');
    }
    return this.request('/rest/secure/angelbroking/historical/v1/getCandleData', {
      method: 'POST',
      body: {
        exchange,
        symboltoken: String(symbolToken),
        interval: normalizeAngelInterval(interval),
        fromdate: fromDate,
        todate: toDate,
      },
    });
  }

  async placeOrder(order = {}) {
    const instrument = brokerInstrument(order);
    if (!Number.isInteger(Number(order.quantity)) || Number(order.quantity) <= 0) {
      throw new BrokerCapabilityError(this.name, 'order quantity');
    }
    const payload = await this.request('/rest/secure/angelbroking/order/v1/placeOrder', {
      method: 'POST',
      body: {
        variety: 'NORMAL',
        tradingsymbol: instrument.tradingSymbol,
        symboltoken: instrument.symbolToken,
        transactiontype: order.side,
        exchange: instrument.exchange,
        ordertype: order.orderType || (order.price ? 'LIMIT' : 'MARKET'),
        producttype: order.productType || 'INTRADAY',
        duration: order.duration || 'DAY',
        ordertag: String(order.internalOrderId || '').slice(0, 20) || undefined,
        price: Number(order.price || 0),
        squareoff: '0',
        stoploss: '0',
        quantity: Number(order.quantity),
      },
    });
    const brokerOrderId = payload?.data?.orderid;
    if (!brokerOrderId) throw new BrokerApiError(this.name, 'order response did not include orderid', 502);
    return { brokerOrderId, status: 'SUBMITTED' };
  }

  async modifyOrder(order = {}) {
    const instrument = brokerInstrument(order);
    if (!order.brokerOrderId) throw new BrokerCapabilityError(this.name, 'broker order id');
    await this.request('/rest/secure/angelbroking/order/v1/modifyOrder', {
      method: 'POST',
      body: {
        variety: 'NORMAL',
        orderid: order.brokerOrderId,
        tradingsymbol: instrument.tradingSymbol,
        symboltoken: instrument.symbolToken,
        transactiontype: order.side,
        exchange: instrument.exchange,
        ordertype: order.orderType || (order.price ? 'LIMIT' : 'MARKET'),
        producttype: order.productType || 'INTRADAY',
        duration: order.duration || 'DAY',
        price: Number(order.price || 0),
        quantity: Number(order.quantity),
      },
    });
    return { brokerOrderId: order.brokerOrderId, status: 'SUBMITTED' };
  }

  async cancelOrder(order = {}) {
    if (!order.brokerOrderId) throw new BrokerCapabilityError(this.name, 'broker order id');
    await this.request('/rest/secure/angelbroking/order/v1/cancelOrder', {
      method: 'POST',
      body: { variety: 'NORMAL', orderid: order.brokerOrderId },
    });
    return { brokerOrderId: order.brokerOrderId, status: 'CANCELLED' };
  }

  async getOrderStatus({ brokerOrderId } = {}) {
    if (!brokerOrderId) throw new BrokerCapabilityError(this.name, 'broker order id');
    const payload = await this.request('/rest/secure/angelbroking/order/v1/getOrderBook');
    const order = (payload?.data || []).find((item) => String(item.orderid) === String(brokerOrderId));
    if (!order) throw new BrokerApiError(this.name, 'order was not found', 404);
    return normalizeBrokerExecution(order, { brokerOrderId: order.orderid });
  }

  async getOrderBook() {
    const payload = await this.request('/rest/secure/angelbroking/order/v1/getOrderBook');
    return payload?.data || [];
  }

  async getPositions() {
    const payload = await this.request('/rest/secure/angelbroking/market/v1/position');
    return (payload?.data || []).map((position) => ({
      instrument: position.tradingsymbol,
      symbolToken: position.symboltoken,
      side: Number(position.netqty || 0) >= 0 ? 'BUY' : 'SELL',
      quantity: Math.abs(Number(position.netqty || 0)),
      entryPrice: Number(position.averageprice || 0),
      currentPrice: Number(position.ltp || 0),
      pnl: Number(position.pnl || 0),
      raw: position,
    }));
  }

  async getHoldings() {
    const payload = await this.request('/rest/secure/angelbroking/portfolio/v1/getHolding');
    return payload?.data || [];
  }

  async getTradeBook() {
    const payload = await this.request('/rest/secure/angelbroking/order/v1/getTradeBook');
    return payload?.data || [];
  }

  async getMargin() {
    const payload = await this.request('/rest/secure/angelbroking/user/v1/getRMS');
    return payload?.data || payload;
  }

  async subscribeExecutionUpdates({ brokerOrderIds = [], onUpdate, signal, intervalMs = 5000 } = {}) {
    if (typeof onUpdate !== 'function') throw new TypeError('onUpdate callback is required');
    if (!Array.isArray(brokerOrderIds) || brokerOrderIds.length === 0) {
      throw new TypeError('brokerOrderIds are required');
    }
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

export class DhanAdapter extends BrokerAdapter {
  constructor(modeOrOptions = {}, maybeOptions = {}) {
    super('Dhan');
    const options = typeof modeOrOptions === 'string' ? maybeOptions : modeOrOptions;
    const { dhanClientId = null, accessToken = null, tokenExpiresAt = null } = options || {};
    this.baseUrl = text('DHAN_BASE_URL') || DHAN_BASE_URL;
    this.authUrl = text('DHAN_AUTH_URL') || DHAN_AUTH_URL;
    this.staticIp = text('DHAN_STATIC_IP');
    this.dhanClientId = dhanClientId ? String(dhanClientId).trim() : text('DHAN_CLIENT_ID');
    this.accessToken = accessToken ? String(accessToken).trim() : text('DHAN_ACCESS_TOKEN');
    this.tokenExpiresAt = normalizeTokenExpiry(tokenExpiresAt)
      || tokenExpiryFromJwt(this.accessToken)
      || (this.accessToken ? new Date(Date.now() + DHAN_TOKEN_TTL_MS) : null);
  }

  configFields() {
    return ['DHAN_API_KEY', 'DHAN_API_SECRET'];
  }

  isConfigured() {
    return this.configFields().every((field) => Boolean(text(field)));
  }

  readiness() {
    const configured = this.isConfigured();
    const staticIp = getStaticIpReadiness('DHAN');
    return {
      broker: this.name,
      mode: 'LIVE',
      configured,
      enabled: configured,
      staticIp: staticIp,
      orderExecutionReady: configured && staticIp.ready,
      reason: configured
        ? 'DhanHQ provider configuration is present. Individual user authentication is required for live trading.'
        : `Missing required DhanHQ configuration: ${this.configFields().join(', ')}`,
    };
  }

  capabilities() {
    return this.isConfigured() ? LIVE_CAPABILITIES : BROKER_CAPABILITIES;
  }

  async request(path, { method = 'GET', body, query, signal, authenticated = true, authHost = false, dataApi = false, headers: extraHeaders = {} } = {}) {
    if (authHost && !this.configFields().every((field) => Boolean(text(field)))) {
      throw new BrokerCapabilityError(this.name, `configuration (${this.configFields().join(', ')})`);
    }
    if (authenticated && !this.accessToken) {
      throw new BrokerCapabilityError(this.name, 'user access token');
    }
    if (authenticated) assertTokenNotExpired(this.name, this.tokenExpiresAt);

    const host = authHost ? this.authUrl : this.baseUrl;
    const url = new URL(joinUrl(host, path));
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    const headers = {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(authenticated && this.accessToken ? { 'access-token': this.accessToken } : {}),
      ...(this.dhanClientId ? { 'client-id': this.dhanClientId } : {}),
      ...extraHeaders,
    };

    if (dataApi) {
      const gateKey = `${this.dhanClientId || 'anon'}:${path.startsWith('/marketfeed') ? 'quote' : 'data'}`;
      await acquireDhanRateSlot(gateKey, path.startsWith('/marketfeed') ? QUOTE_API_INTERVAL_MS : DATA_API_INTERVAL_MS);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout('DHAN'));
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      return await parseJsonResponse(this.name, response);
    } catch (caught) {
      let error = caught;
      if (error.name === 'AbortError') {
        error = new BrokerApiError(this.name, 'request timed out', 504);
        error.code = 'BROKER_TIMEOUT';
      } else if (error.name !== 'BrokerApiError') {
        // fetch() network failure (DNS, TLS, connection reset): never a session problem.
        const networkError = new BrokerApiError(this.name, `network error: ${error.message}`, 503);
        networkError.code = 'NETWORK_ERROR';
        networkError.cause = error;
        error = networkError;
      }
      if (error.providerBodySnippet && this.accessToken) {
        error.providerBodySnippet = error.providerBodySnippet.split(this.accessToken).join('[REDACTED]');
      }
      error.dhanCategory = classifyDhanError(error, { dataApi });
      // Dhan Data APIs (market feed, charts, option chain) are a separately
      // subscribed product. A subscription/access rejection there, with a
      // token that /v2/profile accepts, is NOT an expired trading session.
      if (dataApi && ['DATA_API_NOT_ACTIVE', 'DATA_API_ACCESS_DENIED'].includes(error.dhanCategory)) {
        error.code = 'DHAN_DATA_API_UNAVAILABLE';
        error.statusCode = 403;
        error.dataApiRejected = true;
      } else if (dataApi && error.code === 'BROKER_SESSION_EXPIRED' && error.dhanCategory !== 'AUTH_FAILED') {
        error.code = `DHAN_${error.dhanCategory}`;
        error.statusCode = error.dhanCategory === 'RATE_LIMITED' ? 429 : 502;
      }
      // Never includes the access token: only endpoint and provider error fields.
      console.warn('[DHAN_API]', JSON.stringify({
        path, method, httpStatus: error.httpStatus ?? null,
        errorCode: error.providerErrorCode ?? null, errorType: error.providerErrorType ?? null,
        errorMessage: error.providerMessage ?? null, body: error.providerBodySnippet ?? null,
        category: error.dhanCategory, classifiedAs: error.code || null,
      }));
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  async generateConsentSession() {
    requireFields(this.name, this.configFields());
    const payload = await this.request('/app/generate-consent', {
      method: 'POST',
      authHost: true,
      authenticated: false,
      headers: {
        app_id: text('DHAN_API_KEY'),
        app_secret: text('DHAN_API_SECRET'),
      },
    });
    const consentAppId = payload?.consentAppId || payload?.consentId || payload?.data?.consentAppId || payload?.data?.consentId;
    if (!consentAppId) {
      throw new BrokerApiError(this.name, 'Consent generation failed to return a consentAppId', 502);
    }
    return {
      consentAppId,
      authorizationUrl: `${this.authUrl}/login/consentApp-login?consentAppId=${encodeURIComponent(consentAppId)}`,
    };
  }

  async getProfile() {
    const payload = await this.request('/profile');
    const data = payload?.data || payload || {};
    // Identity comes ONLY from Dhan's response; never fall back to the submitted
    // client ID, otherwise the identity check compares the input with itself.
    const clientId = data.dhanClientId || data.clientId || data.client_id || null;
    if (clientId && !this.dhanClientId) {
      this.dhanClientId = String(clientId).trim();
    }
    return {
      clientId: clientId ? String(clientId).trim() : null,
      name: data.dhanClientName || data.clientName || data.name || null,
      email: data.email || null,
      tokenValidity: data.tokenValidity || null,
      dataPlan: data.dataPlan || null,
      dataValidity: data.dataValidity || null,
      activeSegment: data.activeSegment || null,
      raw: data,
    };
  }

  async getMarketData({ exchange, symbolToken } = {}) {
    if (!exchange || !symbolToken) {
      throw new BrokerCapabilityError(this.name, 'market-data instrument mapping');
    }
    const segment = {
      NSE: 'NSE_EQ',
      BSE: 'BSE_EQ',
      NFO: 'NSE_FNO',
      BFO: 'BSE_FNO',
      MCX: 'MCX_COMM',
    }[String(exchange).toUpperCase()] || String(exchange).toUpperCase();
    return this.request('/marketfeed/ltp', {
      dataApi: true,
      method: 'POST',
      body: { [segment]: [String(symbolToken)] },
    });
  }

  async getMarketDepth({ exchange, symbolToken } = {}) {
    if (!exchange || !symbolToken) throw new BrokerCapabilityError(this.name, 'market-depth instrument mapping');
    const segment = {
      NSE: 'NSE_EQ',
      BSE: 'BSE_EQ',
      NFO: 'NSE_FNO',
      BFO: 'BSE_FNO',
      MCX: 'MCX_COMM',
      IDX_I: 'IDX_I',
    }[String(exchange).toUpperCase()] || String(exchange).toUpperCase();
    return this.request('/marketfeed/quote', {
      dataApi: true,
      method: 'POST',
      body: { [segment]: [String(symbolToken)] },
    });
  }

  /**
   * POST /v2/marketfeed/quote (Quote API, 1 req/s). Unlike /marketfeed/ltp it
   * returns last_trade_time, which is required to prove the price is fresh.
   */
  async getQuote({ exchangeSegment, securityIds } = {}) {
    const ids = (Array.isArray(securityIds) ? securityIds : [securityIds]).filter((id) => id !== undefined && id !== null && id !== '');
    if (!exchangeSegment || ids.length === 0) throw new BrokerCapabilityError(this.name, 'quote instrument mapping');
    return this.request('/marketfeed/quote', {
      dataApi: true,
      method: 'POST',
      body: { [String(exchangeSegment).toUpperCase()]: ids.map((id) => Number(id)) },
    });
  }

  async getHistoricalData({ securityId, exchangeSegment = 'IDX_I', instrument = 'INDEX', interval = 5, fromDate, toDate } = {}) {
    if (!securityId || !fromDate || !toDate) {
      throw new BrokerCapabilityError(this.name, 'historical-data parameters');
    }
    return this.request('/charts/intraday', {
      dataApi: true,
      method: 'POST',
      body: {
        securityId: String(securityId),
        exchangeSegment: String(exchangeSegment).toUpperCase(),
        instrument: String(instrument).toUpperCase(),
        interval: Number(interval),
        fromDate,
        toDate,
      },
    });
  }

  async getOptionExpiryList({ underlyingScrip = '13', underlyingSeg = 'IDX_I' } = {}) {
    return this.request('/optionchain/expirylist', {
      dataApi: true,
      method: 'POST',
      body: { UnderlyingScrip: Number(underlyingScrip), UnderlyingSeg: String(underlyingSeg).toUpperCase() },
    });
  }

  async getOptionChain({ underlyingScrip = '13', underlyingSeg = 'IDX_I', expiry } = {}) {
    if (!expiry) throw new BrokerCapabilityError(this.name, 'option-chain expiry');
    return this.request('/optionchain', {
      dataApi: true,
      method: 'POST',
      body: {
        UnderlyingScrip: Number(underlyingScrip),
        UnderlyingSeg: String(underlyingSeg).toUpperCase(),
        Expiry: expiry,
      },
    });
  }

  async consumeConsent({ tokenId } = {}) {
    requireFields(this.name, this.configFields());
    if (!tokenId) {
      throw new BrokerCapabilityError(this.name, 'tokenId for consent consumption');
    }
    const payload = await this.request('/app/consumeApp-consent', {
      method: 'POST',
      authHost: true,
      authenticated: false,
      query: { tokenId },
      headers: {
        app_id: text('DHAN_API_KEY'),
        app_secret: text('DHAN_API_SECRET'),
      },
    });
    const data = payload?.data || payload || {};
    const accessToken = data.accessToken || data.access_token || data.token;
    if (!accessToken) {
      throw new BrokerApiError(this.name, 'Consume consent did not return an access token', 502);
    }
    this.accessToken = String(accessToken);
    this.tokenExpiresAt = responseTokenExpiry(data, DHAN_TOKEN_TTL_MS);
    if (data.dhanClientId || data.client_id) {
      this.dhanClientId = String(data.dhanClientId || data.client_id);
    }
    return {
      accessToken: this.accessToken,
      dhanClientId: this.dhanClientId,
      tokenExpiresAt: this.tokenExpiresAt,
      authenticated: true,
      broker: this.name,
    };
  }

  async authenticate({ tokenId } = {}) {
    if (tokenId) {
      return this.consumeConsent({ tokenId });
    }
    if (!this.accessToken) {
      throw new BrokerCapabilityError(this.name, 'user access token or tokenId');
    }
    await this.validateSession();
    return { authenticated: true, broker: this.name, dhanClientId: this.dhanClientId };
  }

  async validateSession() {
    if (!this.accessToken) {
      throw new BrokerCapabilityError(this.name, 'access token is required for validation');
    }
    assertTokenNotExpired(this.name, this.tokenExpiresAt);
    const profile = await this.getProfile();
    const resolvedClientId = profile?.clientId || null;
    if (!resolvedClientId) {
      const err = new BrokerApiError(this.name, 'Dhan /v2/profile did not return dhanClientId', 502);
      err.code = 'DHAN_PROFILE_INCOMPLETE';
      throw err;
    }
    if (this.dhanClientId && String(resolvedClientId).trim() !== String(this.dhanClientId).trim()) {
      const err = new Error('Dhan account identity does not match the provided client ID');
      err.statusCode = 409;
      err.code = 'BROKER_ACCOUNT_IDENTITY_MISMATCH';
      throw err;
    }
    // Dhan's own tokenValidity is authoritative for the session expiry.
    const providerExpiry = parseDhanTokenValidity(profile?.tokenValidity);
    if (providerExpiry) this.tokenExpiresAt = providerExpiry;
    if (resolvedClientId && !this.dhanClientId) {
      this.dhanClientId = String(resolvedClientId).trim();
    }
    let funds = null;
    try {
      funds = await this.getMargin();
    } catch {
      // funds check is optional/non-fatal during session validation
    }
    return { valid: true, broker: this.name, dhanClientId: this.dhanClientId, profile, funds };
  }

  buildOrderPayload(order = {}) {
    const metadata = order.metadata || {};
    const quantity = Number(order.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BrokerCapabilityError(this.name, 'order quantity must be a positive integer');
    }

    const clientId = this.dhanClientId || metadata.dhanClientId || order.dhanClientId;
    if (!clientId) {
      throw new BrokerCapabilityError(this.name, 'Dhan Client ID is required to place orders');
    }

    const securityId = String(metadata.securityId || '');
    const exchangeSegment = String(metadata.exchangeSegment || metadata.exchange || 'NSE_FNO').toUpperCase();
    if (!securityId) throw new BrokerCapabilityError(this.name, 'verified Dhan security ID');
    if (exchangeSegment === 'NSE_FNO') {
      if (!metadata.tradingSymbol || !metadata.expiry || !metadata.optionType || !Number.isFinite(Number(metadata.lotSize))) {
        throw new BrokerCapabilityError(this.name, 'verified Dhan option contract metadata');
      }
      const lotSize = Number(metadata.lotSize);
      if (lotSize <= 0 || quantity % lotSize !== 0) {
        throw new BrokerCapabilityError(this.name, 'order quantity must be a multiple of the verified lot size');
      }
    }
    const correlationId = String(order.internalOrderId || order.correlationId || metadata.correlationId || `KP${Date.now().toString(36)}`).slice(0, 25);
    const orderType = String(metadata.orderType || order.orderType || (order.price ? 'LIMIT' : 'MARKET')).toUpperCase();

    return {
      dhanClientId: clientId,
      correlationId,
      transactionType: String(order.side).toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      exchangeSegment,
      productType: String(metadata.productType || order.productType || 'INTRADAY').toUpperCase(),
      orderType,
      validity: String(metadata.validity || order.validity || 'DAY').toUpperCase(),
      securityId,
      quantity,
      disclosedQuantity: Number(metadata.disclosedQuantity || 0),
      price: orderType === 'MARKET' ? 0 : Number(order.price || 0),
      triggerPrice: Number(metadata.triggerPrice || order.triggerPrice || 0),
      afterMarketOrder: Boolean(metadata.afterMarketOrder || order.afterMarketOrder),
      amoTime: metadata.amoTime || 'OPEN',
    };
  }

  async placeOrder(order = {}) {
    const body = this.buildOrderPayload(order);

    const payload = await this.request('/orders', {
      method: 'POST',
      body,
    });

    const brokerOrderId = payload?.orderId || payload?.data?.orderId || payload?.order_id || payload?.OrderNo;
    if (!brokerOrderId) {
      throw new BrokerApiError(this.name, 'Dhan order placement response did not include orderId', 502);
    }

    return normalizeBrokerExecution(payload, {
      brokerOrderId,
      exchangeOrderId: payload?.exchangeOrderId || payload?.data?.exchangeOrderId || payload?.ExchOrderNo,
      correlationId: body.correlationId,
      status: payload?.orderStatus || payload?.data?.orderStatus || 'SUBMITTED',
    });
  }

  async modifyOrder(order = {}) {
    const brokerOrderId = order.brokerOrderId || order.orderId;
    if (!brokerOrderId) throw new BrokerCapabilityError(this.name, 'broker order id');

    const clientId = this.dhanClientId || order.metadata?.dhanClientId;
    const body = {
      dhanClientId: clientId,
      orderId: String(brokerOrderId),
      orderType: String(order.metadata?.orderType || order.orderType || (order.price ? 'LIMIT' : 'MARKET')).toUpperCase(),
      legName: order.metadata?.legName || 'ENTRY_LEG',
      quantity: Number(order.quantity),
      price: Number(order.price || 0),
      triggerPrice: Number(order.metadata?.triggerPrice || order.triggerPrice || 0),
      disclosedQuantity: Number(order.metadata?.disclosedQuantity || 0),
      validity: String(order.metadata?.validity || order.validity || 'DAY').toUpperCase(),
    };

    const payload = await this.request(`/orders/${encodeURIComponent(brokerOrderId)}`, {
      method: 'PUT',
      body,
    });

    return normalizeBrokerExecution(payload, {
      brokerOrderId,
      status: payload?.orderStatus || payload?.data?.orderStatus || 'SUBMITTED',
    });
  }

  async cancelOrder(order = {}) {
    const brokerOrderId = order.brokerOrderId || order.orderId;
    if (!brokerOrderId) throw new BrokerCapabilityError(this.name, 'broker order id');

    const payload = await this.request(`/orders/${encodeURIComponent(brokerOrderId)}`, {
      method: 'DELETE',
    });

    return normalizeBrokerExecution(payload, {
      brokerOrderId,
      status: payload?.orderStatus || payload?.data?.orderStatus || 'CANCELLED',
    });
  }

  async getOrderStatus({ brokerOrderId } = {}) {
    if (!brokerOrderId) throw new BrokerCapabilityError(this.name, 'broker order id');
    const payload = await this.request(`/orders/${encodeURIComponent(brokerOrderId)}`);
    return normalizeBrokerExecution(payload, { brokerOrderId });
  }

  async getOrderBook() {
    const payload = await this.request('/orders');
    return Array.isArray(payload) ? payload : (payload?.data || []);
  }

  async getTradeBook() {
    const payload = await this.request('/trades');
    return Array.isArray(payload) ? payload : (payload?.data || []);
  }

  async getPositions() {
    try {
      const payload = await this.request('/positions');
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      return list.map((pos) => ({
        instrument: pos.tradingSymbol || pos.customSymbol || String(pos.securityId),
        tradingSymbol: pos.tradingSymbol || null,
        customSymbol: pos.customSymbol || null,
        symbolToken: String(pos.securityId),
        securityId: String(pos.securityId),
        exchangeSegment: pos.exchangeSegment || null,
        brokerPositionKey: `${pos.exchangeSegment || ''}:${pos.securityId || ''}:${pos.productType || ''}`,
        side: pos.positionType === 'LONG' || Number(pos.netQty || 0) >= 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(Number(pos.netQty || 0)),
        entryPrice: Number(pos.buyAvg || pos.costPrice || 0),
        currentPrice: Number(pos.lastPrice || pos.ltp || pos.rbiReferenceRate || pos.costPrice || 0),
        realizedPnl: Number(pos.realizedProfit || 0),
        unrealizedPnl: Number(pos.unrealizedProfit || 0),
        pnl: Number((Number(pos.realizedProfit || 0) + Number(pos.unrealizedProfit || 0)).toFixed(2)),
        raw: pos,
      }));
    } catch (error) {
      if (
        error.message?.includes('No positions') ||
        error.raw?.errorCode === 'DH-1111' ||
        error.raw?.errorType === 'POSITION_ERROR'
      ) {
        return [];
      }
      throw error;
    }
  }

  async getHoldings() {
    try {
      const payload = await this.request('/holdings');
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      return list.map((h) => ({
        tradingSymbol: h.tradingSymbol || h.customSymbol || String(h.securityId || ''),
        securityId: String(h.securityId || ''),
        exchange: h.exchange || 'NSE',
        totalQty: Number(h.totalQty || 0),
        availableQty: Number(h.dpQty ?? h.availableQty ?? 0),
        avgCostPrice: Number(h.avgCostPrice || 0),
        currentPrice: Number(h.currentPrice || h.lastTradedPrice || h.avgCostPrice || 0),
        pnl: Number(h.pnl || 0),
      }));
    } catch (error) {
      if (
        error.message?.includes('No holdings available') ||
        error.raw?.errorCode === 'DH-1111' ||
        error.raw?.errorType === 'HOLDING_ERROR'
      ) {
        return [];
      }
      throw error;
    }
  }

  async getMargin() {
    const payload = await this.request('/fundlimit');
    const data = payload?.data || payload || {};
    return {
      available: Number(data.availabelBalance ?? data.withdrawableBalance ?? 0),
      utilized: Number(data.utilizedAmount ?? 0),
      collateral: Number(data.collateralAmount ?? 0),
      withdrawable: Number(data.withdrawableBalance ?? 0),
      sodLimit: Number(data.sodLimit ?? 0),
    };
  }

  async exitAllPositions() {
    const payload = await this.request('/positions', { method: 'DELETE' });
    const data = payload?.data || payload || {};
    if (String(data.status || payload?.status || '').toUpperCase() !== 'SUCCESS') {
      throw new BrokerApiError(this.name, data.message || 'Dhan did not confirm exit-all-positions', 502);
    }
    return data;
  }

  async subscribeExecutionUpdates({ brokerOrderIds = [], onUpdate, signal, intervalMs = 5000 } = {}) {
    if (typeof onUpdate !== 'function') throw new TypeError('onUpdate callback is required');
    if (!Array.isArray(brokerOrderIds) || brokerOrderIds.length === 0) {
      throw new TypeError('brokerOrderIds are required');
    }
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

export function getBrokerAdapter(broker, mode, options = {}) {
  // LIVE-only: no PAPER mode supported
  if (broker === 'DHAN') return new DhanAdapter(options);
  if (broker === 'ANGEL_ONE') return new AngelOneAdapter(options);
  throw new Error(`Unsupported broker: ${broker}`);
}

export function getBrokerReadiness(broker, mode) {
  // LIVE-only: only real brokers supported
  if (!broker || broker === 'PAPER') {
    throw new Error('Paper broker mode is not supported. Only LIVE trading is allowed.');
  }
  const adapter = getBrokerAdapter(broker, mode);
  return {
    ...adapter.readiness(),
    capabilities: adapter.capabilities(),
  };
}