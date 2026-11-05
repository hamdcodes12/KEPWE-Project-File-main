// TEST-ONLY local HTTP server that speaks the Angel One SmartAPI wire format
// (routes, headers, status/errorcode envelope) as documented by Angel One.
// It lets the real AngelOneAdapter run its real HTTP path in automated tests.
// It is never imported by application code and proves nothing about Angel
// One's live behaviour: live verification is scripts/angel-one-live-verify.mjs.

import http from 'http';

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeJwt(clientCode, ttlSeconds, serial) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: 'HS512' })}.${b64url({ username: clientCode, iat: now, exp: now + ttlSeconds, n: serial })}.sig`;
}

const ok = (data, message = 'SUCCESS') => ({ status: true, message, errorcode: '', data });
const fail = (errorcode, message) => ({ status: false, message, errorcode, data: null });

export async function startMockSmartApi(options = {}) {
  const state = {
    apiKey: options.apiKey || 'test-api-key',
    clientCode: options.clientCode || 'A123456',
    mpin: options.mpin || '4321',
    totp: options.totp || '123456',
    name: options.name || 'TEST CLIENT',
    jwtTtlSeconds: options.jwtTtlSeconds ?? 3600,
    serial: 0,
    validJwts: new Set(),
    validRefreshTokens: new Set(),
    orders: [],
    trades: [],
    positions: options.positions || [],
    holdings: options.holdings || [],
    rms: options.rms || { net: '150000.00', availablecash: '125000.50', availableintradaypayin: '0', availablelimitmargin: '0', collateral: '2500.00', m2munrealized: '120.00', m2mrealized: '-40.00', utiliseddebits: '25000.00', utilisedspan: '0', utilisedoptionpremium: '0', utilisedholdingsales: '0', utilisedexposure: '0', utilisedturnover: '0', utilisedpayout: '0' },
    quotes: options.quotes || {},
    candles: options.candles || [],
    greeks: options.greeks || [],
    scripMaster: options.scripMaster || null,
    rejectBelowPrice: options.rejectBelowPrice || null,
    requests: [],
    failures: [], // { route, times, http, body, text, hang, destroy }
    orderOutcome: 'open', // open | complete | rejected
    placeOrderError: null,
  };

  const control = {
    state,
    /** Next `times` calls to a route (substring match) fail as described. */
    failNext(route, failure) {
      state.failures.push({ route, times: 1, ...failure });
    },
    /** Invalidates every issued JWT (the refresh token stays valid unless asked). */
    expireJwts({ refreshTokensToo = false } = {}) {
      state.validJwts.clear();
      if (refreshTokensToo) state.validRefreshTokens.clear();
    },
    requestsTo(route) {
      return state.requests.filter((request) => request.path.includes(route));
    },
    issueSession() {
      return issueTokens();
    },
  };

  function issueTokens() {
    state.serial += 1;
    const jwtToken = makeJwt(state.clientCode, state.jwtTtlSeconds, state.serial);
    const refreshToken = `refresh-${state.serial}`;
    state.validJwts.add(jwtToken);
    state.validRefreshTokens.add(refreshToken);
    return { jwtToken, refreshToken, feedToken: `feed-${state.serial}` };
  }

  function orderRow(order) {
    return {
      variety: order.variety, ordertype: order.ordertype, producttype: order.producttype, duration: order.duration,
      price: Number(order.price), triggerprice: Number(order.triggerprice || 0), quantity: String(order.quantity),
      tradingsymbol: order.tradingsymbol, transactiontype: order.transactiontype, exchange: order.exchange,
      symboltoken: order.symboltoken, ordertag: order.ordertag || '',
      averageprice: order.averageprice || 0, filledshares: String(order.filledshares || 0),
      unfilledshares: String(Number(order.quantity) - Number(order.filledshares || 0)),
      orderid: order.orderid, uniqueorderid: order.uniqueorderid, text: order.text || '',
      status: order.status, orderstatus: order.status,
      updatetime: '07-Oct-2026 10:15:30', exchtime: '07-Oct-2026 10:15:30',
    };
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      let body = null;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
      } catch {
        body = null;
      }
      const path = req.url;
      state.requests.push({ method: req.method, path, headers: req.headers, body });
      const send = (status, payload, contentType = 'application/json') => {
        res.writeHead(status, { 'Content-Type': contentType });
        res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
      };

      const failure = state.failures.find((item) => path.includes(item.route) && item.times > 0);
      if (failure) {
        failure.times -= 1;
        if (failure.hang) return; // never answers: client-side timeout
        if (failure.destroy) return req.socket.destroy();
        if (failure.text !== undefined) return send(failure.http || 403, failure.text, 'text/plain');
        return send(failure.http || 200, failure.body);
      }

      // Public instrument master (served by Angel One without authentication).
      if (path === '/OpenAPIScripMaster.json') {
        return state.scripMaster ? send(200, state.scripMaster) : send(404, 'not found', 'text/plain');
      }

      if (req.headers['x-privatekey'] !== state.apiKey) {
        return send(200, fail('AG8004', 'Invalid API Key'));
      }
      for (const header of ['x-sourceid', 'x-usertype', 'x-clientlocalip', 'x-clientpublicip', 'x-macaddress']) {
        if (!req.headers[header]) return send(200, fail('AB2000', `Missing header ${header}`));
      }

      if (path.endsWith('/user/v1/loginByPassword')) {
        if (body?.clientcode !== state.clientCode || body?.password !== state.mpin) return send(200, fail('AB1000', 'Invalid Email Or Password'));
        if (body?.totp !== state.totp) return send(200, fail('AB1050', 'Invalid totp'));
        return send(200, ok(issueTokens()));
      }

      const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (path.endsWith('/jwt/v1/generateTokens')) {
        if (!state.validRefreshTokens.has(body?.refreshToken)) return send(200, fail('AB8050', 'Invalid Refresh Token'));
        state.validRefreshTokens.delete(body.refreshToken);
        return send(200, ok(issueTokens()));
      }
      if (!bearer) return send(401, fail('AG8003', 'Token missing'));
      if (!state.validJwts.has(bearer)) return send(401, fail('AG8002', 'Token Expired'));

      if (path.endsWith('/user/v1/logout')) {
        state.validJwts.delete(bearer);
        state.validRefreshTokens.clear();
        return send(200, ok('', 'SUCCESS'));
      }
      if (path.endsWith('/user/v1/getProfile')) {
        return send(200, ok({ clientcode: state.clientCode, name: state.name, email: '', mobileno: '', exchanges: ['NSE', 'BSE', 'NFO'], products: ['DELIVERY', 'INTRADAY', 'CARRYFORWARD'], lastlogintime: '', brokerid: 'B2C' }));
      }
      if (path.endsWith('/user/v1/getRMS')) return send(200, ok(state.rms));
      if (path.endsWith('/order/v1/getPosition')) return send(200, ok(state.positions.length ? state.positions : null));
      if (path.endsWith('/portfolio/v1/getHolding')) return send(200, ok(state.holdings.length ? state.holdings : null));
      if (path.endsWith('/portfolio/v1/getAllHolding')) {
        const totalholdingvalue = state.holdings.reduce((sum, h) => sum + Number(h.ltp) * Number(h.quantity), 0);
        const totalinvvalue = state.holdings.reduce((sum, h) => sum + Number(h.averageprice) * Number(h.quantity), 0);
        return send(200, ok({ holdings: state.holdings, totalholding: { totalholdingvalue, totalinvvalue, totalprofitandloss: totalholdingvalue - totalinvvalue, totalpnlpercentage: totalinvvalue ? ((totalholdingvalue - totalinvvalue) / totalinvvalue) * 100 : 0 } }));
      }
      if (path.endsWith('/order/v1/getOrderBook')) return send(200, ok(state.orders.length ? state.orders.map(orderRow) : null));
      if (path.endsWith('/order/v1/getTradeBook')) return send(200, ok(state.trades.length ? state.trades : null));
      if (path.includes('/order/v1/details/')) {
        const unique = decodeURIComponent(path.split('/order/v1/details/')[1]);
        const order = state.orders.find((item) => item.uniqueorderid === unique);
        return order ? send(200, ok(orderRow(order))) : send(200, fail('AB1013', 'Order not found'));
      }
      if (path.endsWith('/order/v1/placeOrder')) {
        if (state.placeOrderError) return send(200, fail(state.placeOrderError.errorcode, state.placeOrderError.message));
        for (const field of ['variety', 'tradingsymbol', 'symboltoken', 'transactiontype', 'exchange', 'ordertype', 'producttype', 'duration', 'quantity']) {
          if (!body?.[field]) return send(200, fail('AB2000', `Missing ${field}`));
        }
        const id = String(261007000000000 + state.orders.length + 1);
        const order = { ...body, orderid: id, uniqueorderid: `uniq-${id}`, status: state.orderOutcome, filledshares: 0, averageprice: 0, text: '' };
        if (state.orderOutcome === 'complete') {
          order.filledshares = Number(body.quantity);
          order.averageprice = options.fillPrice || 101.25;
          state.trades.push({ exchange: body.exchange, producttype: body.producttype, tradingsymbol: body.tradingsymbol, transactiontype: body.transactiontype, fillprice: order.averageprice, fillsize: Number(body.quantity), tradevalue: order.averageprice * Number(body.quantity), orderid: id, fillid: `fill-${id}`, filltime: '10:15:31' });
        }
        if (state.orderOutcome === 'rejected') order.text = 'RMS:Margin Exceeds,Required:50000, Available:100';
        if (state.rejectBelowPrice && body.ordertype === 'LIMIT' && Number(body.price) < state.rejectBelowPrice) {
          order.status = 'rejected';
          order.text = 'Order price is out of circuit limits';
        }
        state.orders.push(order);
        return send(200, ok({ script: body.tradingsymbol, orderid: id, uniqueorderid: order.uniqueorderid }));
      }
      if (path.endsWith('/order/v1/modifyOrder')) {
        const order = state.orders.find((item) => item.orderid === body?.orderid);
        if (!order) return send(200, fail('AB1013', 'Order not found'));
        Object.assign(order, { price: body.price, quantity: body.quantity, ordertype: body.ordertype, status: 'modified' });
        return send(200, ok({ orderid: order.orderid, uniqueorderid: order.uniqueorderid }));
      }
      if (path.endsWith('/order/v1/cancelOrder')) {
        const order = state.orders.find((item) => item.orderid === body?.orderid);
        if (!order) return send(200, fail('AB1013', 'Order not found'));
        order.status = 'cancelled';
        order.text = 'Cancelled by user';
        return send(200, ok({ orderid: order.orderid, uniqueorderid: order.uniqueorderid }));
      }
      if (path.endsWith('/market/v1/quote/')) {
        const fetched = [];
        const unfetched = [];
        for (const [exchange, tokens] of Object.entries(body?.exchangeTokens || {})) {
          for (const token of tokens) {
            const quote = state.quotes[`${exchange}:${token}`];
            if (quote) fetched.push({ exchange, symbolToken: String(token), ...quote });
            else unfetched.push({ exchange, symbolToken: String(token), message: 'Symbol token not found', errorCode: 'AB4006' });
          }
        }
        return send(200, ok({ fetched, unfetched }));
      }
      if (path.endsWith('/historical/v1/getCandleData')) {
        for (const field of ['exchange', 'symboltoken', 'interval', 'fromdate', 'todate']) {
          if (!body?.[field]) return send(200, fail('AB13000', `Missing ${field}`));
        }
        return send(200, ok(state.candles));
      }
      if (path.endsWith('/marketData/v1/optionGreek')) return send(200, ok(state.greeks));
      return send(404, fail('AB2000', `Unknown route ${path}`));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  control.baseUrl = `http://127.0.0.1:${server.address().port}`;
  control.close = () => new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
  return control;
}

/**
 * Routes the egress-IP detection calls (ipify / checkip) to a fixed answer and
 * passes every other request through to the real fetch. Returns a restore fn.
 */
export function stubEgressIp(ip) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.includes('api.ipify.org') || target.includes('checkip.amazonaws.com')) {
      if (ip === null) throw new Error('egress detection unavailable');
      return { ok: true, status: 200, text: async () => (target.includes('ipify') ? JSON.stringify({ ip }) : `${ip}\n`) };
    }
    return realFetch(url, init);
  };
  return () => {
    globalThis.fetch = realFetch;
  };
}
