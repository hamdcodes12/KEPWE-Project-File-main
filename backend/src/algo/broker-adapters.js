import { createHmac } from 'crypto';

const ANGEL_ONE_BASE_URL = 'https://apiconnect.angelone.in';
const DHAN_BASE_URL = 'https://api.dhan.co/v2';
const DHAN_AUTH_URL = 'https://auth.dhan.co';
const DHAN_STATIC_IP = '103.117.180.146';

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
    const message = payload?.remarks?.message
      || payload?.errorMessage
      || payload?.message
      || payload?.error
      || payload?.errorcode
      || `HTTP ${response.status}`;
    const err = new BrokerApiError(broker, message, response.status >= 500 ? 502 : response.status);
    err.raw = payload;
    throw err;
  }
  if (payload && (payload.status === false || payload.status === 'failure')) {
    const message = payload?.remarks?.message
      || payload?.errorMessage
      || payload?.message
      || payload?.errorcode
      || 'Request rejected by broker';
    throw new BrokerApiError(broker, message);
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

export class DhanAdapter extends BrokerAdapter {
  constructor(modeOrOptions = {}, maybeOptions = {}) {
    super('Dhan');
    const options = typeof modeOrOptions === 'string' ? maybeOptions : modeOrOptions;
    const { dhanClientId = null, accessToken = null } = options || {};
    this.baseUrl = text('DHAN_BASE_URL') || DHAN_BASE_URL;
    this.authUrl = text('DHAN_AUTH_URL') || DHAN_AUTH_URL;
    this.staticIp = text('DHAN_STATIC_IP') || DHAN_STATIC_IP;
    this.dhanClientId = dhanClientId ? String(dhanClientId).trim() : text('DHAN_CLIENT_ID');
    this.accessToken = accessToken ? String(accessToken).trim() : text('DHAN_ACCESS_TOKEN');
  }

  configFields() {
    return ['DHAN_API_KEY', 'DHAN_API_SECRET'];
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
      staticIp: this.staticIp,
      reason: configured
        ? 'DhanHQ provider configuration is present. Individual user authentication is required for live trading.'
        : `Missing required DhanHQ configuration: ${this.configFields().join(', ')}`,
    };
  }

  capabilities() {
    return this.isConfigured() ? LIVE_CAPABILITIES : BROKER_CAPABILITIES;
  }

  async request(path, { method = 'GET', body, query, signal, authenticated = true, authHost = false, headers: extraHeaders = {} } = {}) {
    if (!this.configFields().every((field) => Boolean(text(field)))) {
      throw new BrokerCapabilityError(this.name, `configuration (${this.configFields().join(', ')})`);
    }
    if (authenticated && !this.accessToken) {
      throw new BrokerCapabilityError(this.name, 'user access token');
    }

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
    } catch (error) {
      if (error.name === 'AbortError') throw new BrokerApiError(this.name, 'request timed out', 504);
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
    if (data.dhanClientId || data.client_id) {
      this.dhanClientId = String(data.dhanClientId || data.client_id);
    }
    return {
      accessToken: this.accessToken,
      dhanClientId: this.dhanClientId,
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
    const funds = await this.getMargin();
    return { valid: true, broker: this.name, dhanClientId: this.dhanClientId, funds };
  }

  async placeOrder(order = {}) {
    const metadata = order.metadata || {};
    const quantity = Number(order.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BrokerCapabilityError(this.name, 'order quantity must be a positive integer');
    }

    const clientId = this.dhanClientId || metadata.dhanClientId || order.dhanClientId;
    if (!clientId) {
      throw new BrokerCapabilityError(this.name, 'Dhan Client ID is required to place orders');
    }

    const securityId = String(metadata.securityId || metadata.symbolToken || order.instrumentToken || order.instrument);
    const correlationId = String(order.internalOrderId || order.correlationId || metadata.correlationId || `KP${Date.now().toString(36)}`).slice(0, 25);

    const body = {
      dhanClientId: clientId,
      correlationId,
      transactionType: String(order.side).toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      exchangeSegment: String(metadata.exchangeSegment || metadata.exchange || 'NSE_FNO').toUpperCase(),
      productType: String(metadata.productType || order.productType || 'INTRADAY').toUpperCase(),
      orderType: String(metadata.orderType || order.orderType || (order.price ? 'LIMIT' : 'MARKET')).toUpperCase(),
      validity: String(metadata.validity || order.validity || 'DAY').toUpperCase(),
      securityId,
      quantity,
      disclosedQuantity: Number(metadata.disclosedQuantity || 0),
      price: Number(order.price || 0),
      triggerPrice: Number(metadata.triggerPrice || order.triggerPrice || 0),
      afterMarketOrder: Boolean(metadata.afterMarketOrder || order.afterMarketOrder),
      amoTime: metadata.amoTime || 'OPEN',
    };

    const payload = await this.request('/orders', {
      method: 'POST',
      body,
    });

    const brokerOrderId = payload?.orderId || payload?.data?.orderId || payload?.order_id;
    if (!brokerOrderId) {
      throw new BrokerApiError(this.name, 'Dhan order placement response did not include orderId', 502);
    }

    return normalizeBrokerExecution(payload, {
      brokerOrderId,
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
        symbolToken: String(pos.securityId),
        side: pos.positionType === 'LONG' || Number(pos.netQty || 0) >= 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(Number(pos.netQty || 0)),
        entryPrice: Number(pos.buyAvg || pos.costPrice || 0),
        currentPrice: Number(pos.rbiReferenceRate || pos.costPrice || 0),
        pnl: Number((Number(pos.realizedProfit || 0) + Number(pos.unrealizedProfit || 0)).toFixed(2)),
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
  if (broker === 'ANGEL_ONE') return new AngelOneAdapter();
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