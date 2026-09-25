import { apiFetch } from './client';

export { apiFetch };

/**
 * KEPWE QUANT API Client
 * Connects frontend UI to REAL DHAN PRODUCTION trading endpoints only
 * No paper trading, no simulation, no mock data - LIVE DHAN ONLY
 */

// 1. Quant Dashboard Overview
export async function fetchQuantDashboard(options = {}) {
  return apiFetch('/quant/dashboard', options);
}

export async function fetchQuantLiveMarket(options = {}) {
  return apiFetch('/quant/live-market', options);
}

export async function runDhanLiveHealthCheck(options = {}) {
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

export async function fetchDhanBrokerStatus(options = {}) {
  return apiFetch('/algo/broker/DHAN/status', options);
}

export async function connectDhanAccount({ dhanClientId, accessToken }) {
  return apiFetch('/broker/dhan/connect', {
    method: 'POST',
    body: { dhanClientId, accessToken },
  });
}

export async function startDhanOAuth() {
  return apiFetch('/broker/dhan/oauth/start', { method: 'POST' });
}

export async function disconnectBroker(broker = 'DHAN') {
  return apiFetch('/broker/dhan/disconnect', { method: 'POST' });
}

export async function fetchDhanHoldings(options = {}) {
  return apiFetch('/broker/DHAN/holdings', options);
}

export async function fetchDhanPositions(options = {}) {
  return apiFetch('/broker/DHAN/positions', options);
}

export async function fetchDhanFunds(options = {}) {
  return apiFetch('/broker/DHAN/funds', options);
}

export async function fetchDhanOrderBook(options = {}) {
  return apiFetch('/broker/DHAN/orderbook', options);
}

export async function fetchDhanTradeBook(options = {}) {
  return apiFetch('/broker/DHAN/tradebook', options);
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
