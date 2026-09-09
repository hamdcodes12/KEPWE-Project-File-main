import { createHmac, createPrivateKey, sign } from 'crypto';

const ANGEL_ONE_BASE_URL = 'https://apiconnect.angelone.in';
const LEMONN_BASE_URL = 'https://cs-prod.lemonn.co.in';
const LEMONN_LOGIN_URL = 'https://lemonn-pro.lemonn.co.in/login';
const LEMONN_API_PREFIX = '/api-trading/api/v2';

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

async function parseJsonResponse(broker, response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error || payload?.errorcode || `HTTP ${response.status}`;
    throw new BrokerApiError(broker, message, response.status >= 500 ? 502 : response.status);
  }
  if (payload && payload.status === false) {
    throw new BrokerApiError(broker, payload.message || payload.errorcode || 'Request rejected');
  }
  return payload;
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

function normalizeBrokerExecution(payload = {}, fallback = {}) {
  const data = payload?.data || payload?.order || payload;
  return {
    brokerOrderId: data?.brokerOrderId || data?.orderId || data?.orderID || data?.order_id || data?.orderid || fallback.brokerOrderId || null,
    status: data?.status || data?.orderStatus || data?.orderstatus || data?.order_status || fallback.status || 'SUBMITTED',
    averagePrice: numberOrNull(data?.averagePrice ?? data?.average_price ?? data?.avgPrice ?? data?.averageprice),
    filledQuantity: numberOrNull(data?.filledQuantity ?? data?.filled_quantity ?? data?.filledshares ?? data?.filled_quantity),
    rejectionReason: data?.rejectionReason || data?.rejection_reason || data?.rejectReason || data?.error || null,
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
  constructor() {
    super('Angel One');
    this.baseUrl = text('ANGEL_ONE_BASE_URL') || ANGEL_ONE_BASE_URL;
    this.session = null;
  }

  configFields() {
    return ['ANGEL_ONE_API_KEY', 'ANGEL_ONE_CLIENT_CODE', 'ANGEL_ONE_TOTP_SECRET'];
  }

  isConfigured() {
    return this.configFields().every((field) => Boolean(text(field)))
      && Boolean(text('ANGEL_ONE_PASSWORD') || text('ANGEL_ONE_MPIN'));
  }

  readiness() {
    const configured = this.isConfigured();
    return {
      broker: this.name,
      mode: 'LIVE',
      configured,
      enabled: configured,
      reason: configured ? null : `Missing required Angel One configuration: ${this.configFields().concat('ANGEL_ONE_PASSWORD or ANGEL_ONE_MPIN').join(', ')}`,
    };
  }

  capabilities() {
    return this.isConfigured() ? LIVE_CAPABILITIES : BROKER_CAPABILITIES;
  }

  async request(path, { method = 'GET', body, auth = true, signal } = {}) {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-PrivateKey': text('ANGEL_ONE_API_KEY'),
      'X-SourceID': 'WEB',
      'X-UserType': 'USER',
      'X-ClientLocalIP': text('ANGEL_ONE_CLIENT_LOCAL_IP') || '127.0.0.1',
      'X-ClientPublicIP': text('ANGEL_ONE_CLIENT_PUBLIC_IP') || '127.0.0.1',
      'X-MACAddress': text('ANGEL_ONE_MAC_ADDRESS') || '00:00:00:00:00:00',
    };
    if (auth) {
      const session = this.session || await this.authenticate();
      headers.Authorization = `Bearer ${session.jwtToken}`;
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
    requireFields(this.name, this.configFields());
    const password = text('ANGEL_ONE_PASSWORD') || text('ANGEL_ONE_MPIN');
    if (!password) throw new BrokerCapabilityError(this.name, 'configuration (ANGEL_ONE_PASSWORD or ANGEL_ONE_MPIN)');
    const payload = await this.request('/rest/auth/angelbroking/user/v1/loginByPassword', {
      method: 'POST',
      auth: false,
      body: {
        clientcode: text('ANGEL_ONE_CLIENT_CODE'),
        password,
        totp: generateTotp(text('ANGEL_ONE_TOTP_SECRET')),
      },
    });
    const data = payload?.data || {};
    if (!data.jwtToken) throw new BrokerApiError(this.name, 'authentication response did not include a session token', 502);
    this.session = {
      jwtToken: data.jwtToken,
      refreshToken: data.refreshToken || null,
      feedToken: data.feedToken || null,
    };
    return { authenticated: true, broker: this.name, feedTokenAvailable: Boolean(data.feedToken) };
  }

  async getMarketData({ exchange, symbolToken } = {}) {
    requireFields(this.name, this.configFields());
    if (!exchange || !symbolToken) throw new BrokerCapabilityError(this.name, 'market-data instrument mapping');
    return this.request('/rest/secure/angelbroking/market/v1/quote/', {
      method: 'POST',
      body: { mode: 'FULL', exchangeTokens: { [exchange]: [String(symbolToken)] } },
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

export class LemonnAdapter extends BrokerAdapter {
  constructor({ accessToken = null } = {}) {
    super('Lemonn');
    this.baseUrl = LEMONN_BASE_URL;
    this.accessToken = accessToken || text('LEMONN_ACCESS_TOKEN');
  }

  configFields() {
    return ['LEMONN_API_KEY', 'LEMONN_API_SECRET', 'LEMONN_CLIENT_ID'];
  }

  isConfigured() {
    return this.configFields().every((field) => Boolean(text(field)));
  }

  readiness() {
    const configured = this.isConfigured();
    return {
      broker: this.name,
      mode: 'LIVE',
      configured,
      enabled: configured,
      reason: configured ? 'Provider configuration is present. User authentication is required for live calls.' : `Missing required LemonN configuration: ${this.configFields().join(', ')}`,
    };
  }

  capabilities() {
    return this.isConfigured() ? LIVE_CAPABILITIES : BROKER_CAPABILITIES;
  }

  async request(path, { method = 'GET', body, query, signal, authenticated = true, headers: extraHeaders = {} } = {}) {
    if (!this.configFields().every((field) => Boolean(text(field)))) {
      throw new BrokerCapabilityError(this.name, `configuration (${this.configFields().join(', ')})`);
    }
    if (authenticated && !this.accessToken) {
      throw new BrokerCapabilityError(this.name, 'daily login session token');
    }
    const url = new URL(joinUrl(this.baseUrl, path));
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout('LEMONN'));
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          'x-api-key': text('LEMONN_API_KEY'),
          ...(authenticated ? { 'x-auth-key': this.accessToken, 'x-client-id': text('LEMONN_CLIENT_ID') } : {}),
          ...extraHeaders,
        },
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

  loginUrl() {
    requireFields(this.name, ['LEMONN_API_KEY']);
    return `${LEMONN_LOGIN_URL}?api_key=${encodeURIComponent(text('LEMONN_API_KEY'))}`;
  }

  async authenticate({ requestToken } = {}) {
    requireFields(this.name, this.configFields());
    if (!requestToken) {
      if (!this.accessToken) throw new BrokerCapabilityError(this.name, 'daily login request token');
      return { authenticated: true, broker: this.name, sessionTokenConfigured: true };
    }
    const privateKeyHex = text('LEMONN_API_SECRET');
    if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
      throw new BrokerCapabilityError(this.name, 'LEMONN_API_SECRET must be a 32-byte Ed25519 private key in hex');
    }
    const privateKey = createPrivateKey({
      key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(privateKeyHex, 'hex')]),
      format: 'der',
      type: 'pkcs8',
    });
    const signature = sign(null, Buffer.from(`${requestToken}${text('LEMONN_API_KEY')}`, 'utf8'), privateKey).toString('hex');
    const payload = await this.request('/api-trading/api/v1/generate_session_token', {
      method: 'POST',
      authenticated: false,
      headers: {
        'x-request-token': requestToken,
        'x-signature': signature,
      },
    });
    const data = payload?.data || payload || {};
    const accessToken = data.accessToken || data.access_token || data.authKey || data.auth_key;
    if (!accessToken) throw new BrokerApiError(this.name, 'session response did not include an access token', 502);
    this.accessToken = String(accessToken);
    return { authenticated: true, broker: this.name, sessionTokenConfigured: true };
  }

  async validateSession() {
    await this.getMargin();
    return { valid: true, broker: this.name };
  }

  async getMarketData(body = {}) {
    if (!Object.keys(body).length) throw new BrokerCapabilityError(this.name, 'market-data symbols or tokens');
    return this.request(`${LEMONN_API_PREFIX}/market-data/ltp`, { method: 'POST', body });
  }

  async getMarketDepth(body = {}) {
    if (!Object.keys(body).length) throw new BrokerCapabilityError(this.name, 'market-depth symbols or tokens');
    return this.request(`${LEMONN_API_PREFIX}/market-data/depth`, { method: 'POST', body });
  }

  async getChartData(body = {}) {
    return this.request(`${LEMONN_API_PREFIX}/market-data/chart`, { method: 'POST', body });
  }

  async getHistoricalData(body = {}) {
    return this.request(`${LEMONN_API_PREFIX}/market-data/historical-chart`, { method: 'POST', body });
  }

  async placeOrder(order = {}) {
    const metadata = order.metadata || {};
    if (!order.instrument || !Number.isInteger(Number(order.quantity)) || Number(order.quantity) <= 0) throw new BrokerCapabilityError(this.name, 'order instrument and quantity');
    const body = {
      clientId: text('LEMONN_CLIENT_ID'),
      ...(metadata.tag ? { tag: String(metadata.tag) } : {}),
      transactionType: order.side,
      exchangeSegment: metadata.exchangeSegment || metadata.exchange || 'NFO',
      productType: metadata.productType || 'INTRADAY',
      orderType: metadata.orderType || (order.price ? 'LIMIT' : 'MARKET'),
      validity: metadata.validity || 'DAY',
      symbol: String(metadata.symbol || order.instrument),
      ...(metadata.securityId ? { securityId: String(metadata.securityId) } : {}),
      quantity: String(order.quantity),
      ...(metadata.disclosedQuantity !== undefined ? { disclosedQuantity: String(metadata.disclosedQuantity) } : {}),
      ...(order.price !== undefined ? { price: String(order.price) } : {}),
      ...(metadata.triggerPrice !== undefined ? { triggerPrice: String(metadata.triggerPrice) } : {}),
      afterMarketOrder: Boolean(metadata.afterMarketOrder),
      ...(metadata.contractType ? { contractType: String(metadata.contractType) } : {}),
      ...(metadata.expiry ? { expiry: String(metadata.expiry) } : {}),
      ...(metadata.strikePrice ? { strikePrice: String(metadata.strikePrice) } : {}),
      ...(metadata.optionType ? { optionType: String(metadata.optionType) } : {}),
    };
    const payload = await this.request(`${LEMONN_API_PREFIX}/orders`, {
      method: 'POST',
      body,
    });
    const brokerOrderId = payload?.data?.orderId;
    if (!brokerOrderId) throw new BrokerApiError(this.name, 'order response did not include orderId', 502);
    return normalizeBrokerExecution(payload, { brokerOrderId, status: payload?.data?.orderStatus || 'SUBMITTED' });
  }

  async modifyOrder(order = {}) {
    if (!order.brokerOrderId) throw new BrokerCapabilityError(this.name, 'broker order id');
    const payload = await this.request(`${LEMONN_API_PREFIX}/orders/modify`, {
      method: 'POST',
      body: { orderId: order.brokerOrderId, ...(order.quantity !== undefined ? { quantity: String(order.quantity) } : {}), ...(order.price !== undefined ? { price: String(order.price) } : {}), ...(order.metadata?.triggerPrice !== undefined ? { triggerPrice: String(order.metadata.triggerPrice) } : {}), ...(order.metadata?.validity ? { validity: order.metadata.validity } : {}) },
    });
    return normalizeBrokerExecution(payload, { brokerOrderId: order.brokerOrderId, status: payload?.data?.orderStatus || 'SUBMITTED' });
  }

  async cancelOrder(order = {}) {
    if (!order.brokerOrderId) throw new BrokerCapabilityError(this.name, 'broker order id');
    const payload = await this.request(`${LEMONN_API_PREFIX}/orders/cancel`, { method: 'POST', body: { orderId: order.brokerOrderId } });
    return normalizeBrokerExecution(payload, { brokerOrderId: order.brokerOrderId, status: payload?.data?.orderStatus || 'CANCELLED' });
  }

  async getOrderStatus({ brokerOrderId } = {}) {
    const payload = await this.getOrderBook();
    const order = (payload?.data?.orders || []).find((item) => String(item.orderID) === String(brokerOrderId));
    if (!order) throw new BrokerApiError(this.name, 'order was not found', 404);
    return normalizeBrokerExecution(order, { brokerOrderId: order.orderID });
  }

  async getPositions() {
    const payload = await this.request(`${LEMONN_API_PREFIX}/positions`);
    return payload?.data?.positions || [];
  }

  async getHoldings() {
    const payload = await this.request(`${LEMONN_API_PREFIX}/holdings`);
    return payload?.data?.holdings || [];
  }

  async getMargin() {
    const payload = await this.request(`${LEMONN_API_PREFIX}/funds`);
    return payload?.data?.funds || {};
  }

  async getMarginInfo(body) {
    const payload = await this.request(`${LEMONN_API_PREFIX}/margin-info`, { method: 'POST', body });
    return payload?.data || payload;
  }

  async getOrderBook() {
    return this.request(`${LEMONN_API_PREFIX}/orderbook`);
  }

  async getOrderLog(orderId) {
    if (!orderId) throw new BrokerCapabilityError(this.name, 'order id');
    return this.request(`${LEMONN_API_PREFIX}/order_log/${encodeURIComponent(orderId)}`);
  }

  async getTradeBook({ orderId, limit, offset } = {}) {
    const payload = await this.request(`${LEMONN_API_PREFIX}/tradebook`, { query: { orderId, limit, offset } });
    return payload?.data?.trades || [];
  }

  async getTransactionHistory({ fromDate, toDate, status, isFno } = {}) {
    const payload = await this.request(`${LEMONN_API_PREFIX}/transaction_history`, { query: { from_date: fromDate, to_date: toDate, status, is_fno: isFno } });
    return payload?.data?.transactions || [];
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

export class PaperBrokerAdapter {
  constructor() {
    this.name = 'Paper Broker';
    this.orders = new Map();
  }

  capabilities() {
    return { ...LIVE_CAPABILITIES };
  }

  readiness() {
    return {
      broker: this.name,
      mode: 'PAPER',
      configured: true,
      enabled: true,
      reason: null,
    };
  }

  async authenticate() {
    return { authenticated: true, mode: 'PAPER' };
  }

  async placeOrder(order = {}) {
    const lifecycle = String(order.metadata?.paperLifecycleStatus || 'FILLED').toUpperCase();
    if (lifecycle === 'REJECTED') {
      this.orders.set(order.internalOrderId, {
        ...order,
        status: 'REJECTED',
        rejectionReason: 'Paper order rejected by the simulated execution venue',
      });
      return {
        status: 'REJECTED',
        rejectionReason: 'Paper order rejected by the simulated execution venue',
      };
    }
    if (lifecycle === 'PENDING') {
      this.orders.set(order.internalOrderId, {
        ...order,
        status: 'SUBMITTED',
        brokerOrderId: `PAPER-${order.internalOrderId}`,
      });
      return {
        brokerOrderId: `PAPER-${order.internalOrderId}`,
        status: 'SUBMITTED',
      };
    }
    this.orders.set(order.internalOrderId, {
      ...order,
      status: 'FILLED',
      brokerOrderId: `PAPER-${order.internalOrderId}`,
    });
    return {
      brokerOrderId: `PAPER-${order.internalOrderId}`,
      status: 'FILLED',
    };
  }

  findOrder(brokerOrderId) {
    return [...this.orders.values()].find((item) => item.brokerOrderId === brokerOrderId);
  }

  async fillOrder({ brokerOrderId, fillPrice, filledQuantity } = {}) {
    const current = this.findOrder(brokerOrderId);
    if (!current) throw new BrokerApiError(this.name, 'paper order was not found', 404);
    if (current.status !== 'SUBMITTED' && current.status !== 'PARTIALLY_FILLED') {
      throw new BrokerApiError(this.name, `cannot fill order in ${current.status} state`, 409);
    }
    const requested = Number(filledQuantity || current.quantity);
    if (!Number.isInteger(requested) || requested <= 0 || requested > Number(current.quantity)) {
      throw new BrokerApiError(this.name, 'filled quantity is invalid', 400);
    }
    current.filledQuantity = requested;
    current.averagePrice = Number(fillPrice || current.price);
    current.status = requested === Number(current.quantity) ? 'FILLED' : 'PARTIALLY_FILLED';
    return {
      brokerOrderId,
      status: current.status,
      filledQuantity: requested,
      averagePrice: current.averagePrice,
    };
  }

  async rejectOrder({ brokerOrderId, reason } = {}) {
    const current = this.findOrder(brokerOrderId);
    if (!current) throw new BrokerApiError(this.name, 'paper order was not found', 404);
    if (current.status !== 'SUBMITTED' && current.status !== 'PARTIALLY_FILLED') {
      throw new BrokerApiError(this.name, `cannot reject order in ${current.status} state`, 409);
    }
    current.status = 'REJECTED';
    current.rejectionReason = reason || 'Paper order rejected by simulated execution venue';
    return { brokerOrderId, status: 'REJECTED', rejectionReason: current.rejectionReason };
  }

  async modifyOrder(order) {
    const current = this.findOrder(order.brokerOrderId);
    if (!current) throw new BrokerApiError(this.name, 'paper order was not found', 404);
    if (current && current.status !== 'SUBMITTED' && current.status !== 'PARTIALLY_FILLED') {
      throw new BrokerApiError(this.name, `cannot modify order in ${current.status} state`, 409);
    }
    current.price = order.price;
    current.quantity = order.quantity;
    current.stopLoss = order.stopLoss;
    current.target = order.target;
    return { brokerOrderId: order.brokerOrderId, status: 'SUBMITTED' };
  }

  async cancelOrder(order) {
    const current = this.findOrder(order.brokerOrderId);
    if (!current) throw new BrokerApiError(this.name, 'paper order was not found', 404);
    if (current.status !== 'SUBMITTED' && current.status !== 'PARTIALLY_FILLED') {
      throw new BrokerApiError(this.name, `cannot cancel order in ${current.status} state`, 409);
    }
    current.status = 'CANCELLED';
    return { brokerOrderId: order.brokerOrderId, status: 'CANCELLED' };
  }

  async getOrderStatus(order) {
    const current = this.findOrder(order.brokerOrderId);
    if (!current) throw new BrokerApiError(this.name, 'paper order was not found', 404);
    const result = {
      brokerOrderId: order.brokerOrderId,
      status: current.status,
    };
    if (current.filledQuantity) result.filledQuantity = current.filledQuantity;
    if (current.averagePrice) result.averagePrice = current.averagePrice;
    if (current.rejectionReason) result.rejectionReason = current.rejectionReason;
    return result;
  }

  async getPositions() { return []; }
  async getTradeBook() { return []; }
  async getMargin() { return { available: Infinity }; }
  async getMarketData() { return { mode: 'PAPER' }; }
  async getHistoricalData() { return []; }
  async subscribeExecutionUpdates() { return { stopped: true }; }
}

const paperAdapter = new PaperBrokerAdapter();

export function getBrokerAdapter(broker, mode = 'PAPER', options = {}) {
  if (mode === 'PAPER') return paperAdapter;
  if (broker === 'ANGEL_ONE') return new AngelOneAdapter();
  if (broker === 'LEMONN') return new LemonnAdapter(options);
  throw new Error(`Unsupported broker: ${broker}`);
}

export function getBrokerReadiness(broker, mode = 'PAPER') {
  const adapter = getBrokerAdapter(broker, mode);
  return {
    ...adapter.readiness(),
    capabilities: adapter.capabilities(),
  };
}