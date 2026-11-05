import { apiFetch } from './client';

export { apiFetch };

/**
 * KEPWE QUANT API Client
 * Connects the frontend UI to REAL Angel One SmartAPI production endpoints only.
 * No paper trading, no simulation, no mock data. Angel One is the only broker.
 */

export const BROKER = 'ANGEL_ONE';
export const BROKER_NAME = 'Angel One';

// 1. Quant Dashboard Overview
export async function fetchQuantDashboard(options = {}) {
  return apiFetch('/quant/dashboard', options);
}

export async function fetchQuantLiveMarket(options = {}) {
  return apiFetch('/quant/live-market', options);
}

export async function runLiveHealthCheck(options = {}) {
  return apiFetch('/quant/live-health', { method: 'POST', ...options });
}

// 2. Strategies Management
export async function fetchQuantStrategies(options = {}) {
  return apiFetch('/quant/strategies', options);
}

export async function fetchQuantAnalytics(options = {}) {
  return apiFetch('/quant/analytics', options);
}

export async function fetchAlgoBacktests(options = {}) {
  return apiFetch('/algo/backtests', options);
}

export async function saveQuantStrategy(strategyData) {
  return apiFetch('/quant/strategies', {
    method: 'POST',
    body: strategyData,
  });
}

// 3. Quantitative Backtesting Engine (Historical Analysis Only - NOT Execution)
export async function runQuantBacktest(params = {}) {
  return apiFetch('/quant/backtest', {
    method: 'POST',
    body: {
      strategySlug: params.strategySlug ?? 'nifty-pulse-5m',
      capital: params.capital ?? 100000,
      riskPct: params.riskPct ?? 1.0,
      optionType: params.optionType ?? 'ATM',
      lotSize: params.lotSize ?? 1,
      candles: params.candles,
      optionCandles: params.optionCandles,
      instrumentsByTimestamp: params.instrumentsByTimestamp,
      charges: params.charges ?? 0,
      slippagePct: params.slippagePct ?? 0,
    },
  });
}

// 4. Live Deployment Safety Gate
export async function validateLiveDeploymentGate(config = {}) {
  return apiFetch('/quant/deployment/validate', {
    method: 'POST',
    body: config,
  });
}

// 5. Daily Risk Controller Status
export async function fetchRiskStatus(options = {}) {
  return apiFetch('/quant/risk/status', options);
}

export async function fetchBrokerReadiness(options = {}) {
  return apiFetch('/broker/readiness', options);
}

export async function fetchBrokerStatus(options = {}) {
  return apiFetch('/broker/status', options);
}

export async function fetchAngelOneStatus(options = {}) {
  return apiFetch('/algo/broker/ANGEL_ONE/status', options);
}

/**
 * Connects the user's Angel One account. The MPIN and TOTP are sent once for
 * the SmartAPI login and are never stored. `apiKey` is only needed when the
 * server has no shared SmartAPI key.
 */
export async function connectAngelOneAccount({ clientCode, mpin, totp, apiKey }) {
  const body = { clientCode, mpin, totp };
  if (apiKey) body.apiKey = apiKey;
  return apiFetch('/broker/angel-one/connect', { method: 'POST', body });
}

/** Starts the SmartAPI redirect (publisher) login; returns { authorizationUrl }. */
export async function startAngelOneRedirectLogin() {
  return apiFetch('/broker/angel-one/oauth/start', { method: 'POST' });
}

/** Renews the stored Angel One session through SmartAPI generateTokens. */
export async function refreshAngelOneSession() {
  return apiFetch('/broker/angel-one/refresh', { method: 'POST' });
}

/** Logs out at Angel One, deletes the stored session and stops any running algo. */
export async function disconnectBroker() {
  return apiFetch('/broker/angel-one/disconnect', { method: 'POST' });
}

export async function fetchBrokerHoldings(options = {}) {
  return apiFetch('/broker/ANGEL_ONE/holdings', options);
}

export async function fetchBrokerPositions(options = {}) {
  return apiFetch('/broker/ANGEL_ONE/positions', options);
}

export async function fetchBrokerFunds(options = {}) {
  return apiFetch('/broker/ANGEL_ONE/funds', options);
}

export async function fetchBrokerPortfolio(options = {}) {
  return apiFetch('/broker/ANGEL_ONE/portfolio', options);
}

export async function fetchBrokerOrderBook(options = {}) {
  return apiFetch('/broker/ANGEL_ONE/orderbook', options);
}

export async function fetchBrokerTradeBook(options = {}) {
  return apiFetch('/broker/ANGEL_ONE/tradebook', options);
}

export async function fetchBrokerHistoricalCandles(request) {
  return apiFetch('/broker/ANGEL_ONE/market-data/historical-chart', { method: 'POST', body: request });
}

// 6. Notifications
export async function fetchNotifications(options = {}) {
  return apiFetch('/notifications', options);
}

export async function markNotificationAsRead(notificationId) {
  return apiFetch(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}

// 7. Algo Settings
export async function fetchAlgoSettings(options = {}) {
  return apiFetch('/algo/settings', options);
}

export async function updateAlgoSettings(settings) {
  return apiFetch('/algo/settings', {
    method: 'PUT',
    body: settings,
  });
}
