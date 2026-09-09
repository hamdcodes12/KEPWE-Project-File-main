import { apiFetch } from './client';

/**
 * KEPWE QUANT API Client
 * Connects frontend UI to Quant Lab backend endpoints
 */

// 1. Quant Dashboard Overview
export async function fetchQuantDashboard() {
  return apiFetch('/quant/dashboard');
}

// 2. Strategies Management
export async function fetchQuantStrategies() {
  return apiFetch('/quant/strategies');
}

export async function saveQuantStrategy(strategyData) {
  return apiFetch('/quant/strategies', {
    method: 'POST',
    body: strategyData,
  });
}

// 3. Quantitative Backtesting Engine
export async function runQuantBacktest(params = {}) {
  return apiFetch('/quant/backtest', {
    method: 'POST',
    body: {
      capital: params.capital ?? 100000,
      riskPct: params.riskPct ?? 1.0,
      optionType: params.optionType ?? 'ATM',
      lotSize: params.lotSize ?? 1,
      candles: params.candles,
    },
  });
}

// 4. Paper Trading Engine
export async function fetchPaperStatus() {
  return apiFetch('/quant/paper/status');
}

export async function startPaperTrading() {
  return apiFetch('/quant/paper/start', {
    method: 'POST',
  });
}

export async function stopPaperTrading() {
  return apiFetch('/quant/paper/stop', {
    method: 'POST',
  });
}

export async function placePaperOrder(orderData) {
  return apiFetch('/quant/paper/order', {
    method: 'POST',
    body: orderData,
  });
}

// 5. Emergency Kill Switch
export async function triggerKillSwitch() {
  return apiFetch('/quant/kill-switch', {
    method: 'POST',
  });
}

// 6. Live Deployment Safety Gate
export async function validateLiveDeploymentGate(config = {}) {
  return apiFetch('/quant/deployment/validate', {
    method: 'POST',
    body: config,
  });
}

// 7. Daily Risk Controller Status
export async function fetchRiskStatus() {
  return apiFetch('/quant/risk/status');
}

export async function fetchBrokerReadiness() {
  return apiFetch('/broker/readiness');
}

export async function fetchBrokerStatus() {
  return apiFetch('/broker/status');
}

export async function startLemonnOAuth() {
  return apiFetch('/broker/lemonn/oauth/start', { method: 'POST' });
}

export async function disconnectBroker(broker) {
  return apiFetch('/broker/disconnect', {
    method: 'POST',
    body: { broker },
  });
}

export async function fetchLemonnHoldings() {
  return apiFetch('/broker/LEMONN/holdings');
}

export async function fetchLemonnPositions() {
  return apiFetch('/broker/LEMONN/positions');
}

export async function fetchLemonnFunds() {
  return apiFetch('/broker/LEMONN/funds');
}

export async function fetchLemonnOrderBook() {
  return apiFetch('/broker/LEMONN/orderbook');
}

export async function fetchLemonnOrderLog(orderId) {
  return apiFetch(`/broker/LEMONN/order-log/${encodeURIComponent(orderId)}`);
}

export async function fetchLemonnTradeBook(params = {}) {
  return apiFetch(`/broker/LEMONN/tradebook?${new URLSearchParams(params).toString()}`);
}

export async function fetchLemonnTransactions(params = {}) {
  return apiFetch(`/broker/LEMONN/transactions?${new URLSearchParams(params).toString()}`);
}

export async function fetchLemonnLtp(request) {
  return apiFetch('/broker/LEMONN/market-data/ltp', { method: 'POST', body: request });
}

export async function fetchLemonnDepth(request) {
  return apiFetch('/broker/LEMONN/market-data/depth', { method: 'POST', body: request });
}

export async function fetchLemonnChart(request) {
  return apiFetch('/broker/LEMONN/market-data/chart', { method: 'POST', body: request });
}

export async function fetchLemonnHistoricalChart(request) {
  return apiFetch('/broker/LEMONN/market-data/historical-chart', { method: 'POST', body: request });
}
