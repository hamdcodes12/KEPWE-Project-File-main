# KEPWE NIFTY 50 Scalping Strategy Implementation Audit

## Scope

Implemented the exact `KEPWE NIFTY 50 Scalping` specification as a separate strategy. Existing `nifty-pulse-5m`, broker adapters, OMS, risk engine, live deployment gate, authentication, subscriptions, trial, and dashboards were preserved.

## Implementation

- Backend strategy module: `backend/src/services/nifty-scalping-strategy.service.js`
- API integration: `backend/src/routes/quant.routes.js`
- Frontend strategy view: `src/pages/quant/QuantDashboardPage.jsx`
- API client support: `src/api/quantClient.js`
- Strategy-specific tests: `backend/test/nifty-scalping-strategy.test.js`

The implementation enforces:

- 5-minute completed NIFTY underlying candle signals only
- VWAP, EMA20/EMA50 relationship and EMA20 slope
- ADX(14) >= 18
- ATR(14) > rolling 20-bar ATR median
- Opening-range or supplied recent-swing breakout
- Body <= 1.8 x ATR
- Next completed 1-minute confirmation above/below breakout candle
- Long CE / Long PE only
- Current contract-master input, nearest eligible expiry, ATM or one-strike ITM, delta preference 0.45-0.60
- Spread, liquidity, stale-LTP, halted, and abnormal-volatility rejection
- 5% starting-day capital risk, 25% premium stop, 50% premium target
- Dynamic exchange lot size and quantity freeze; quantity always rounds down
- One position, three trades/day, two consecutive full-risk losses, 10% daily drawdown, 20-minute time stop, 15:10 IST forced exit
- Real option observations required for backtest; no generated market data or simulated option prices
- Independent validation gate requiring all specified deployment criteria, including 500 trades and walk-forward/stressed-slippage/outlier checks

## Verification

- Strategy-specific test command: `node backend/test/nifty-scalping-strategy.test.js`
- The test covers unfinished-candle rejection, 1-minute confirmation, exact sizing, dynamic contract filters, fail-closed backtest input requirements, and deployment-gate blocking/passing.
- Existing strategy behavior was not redirected to the new strategy.
- No real order was placed during implementation or testing.
- Frontend build: `npm run build` passed.
- Backend syntax checks passed for the new strategy service and Quant routes.
- `git diff --check` passed.
- Runtime HTTP/security regression suite passed.
- The existing Quant regression test remains blocked by a separate HTTP 403 product-membership setup failure.
- The complete backend test command remains blocked before execution by an existing `PaperBrokerAdapter` export mismatch in `backend/test/algo-engine.test.js`.
- Real backtest validation remains blocked because no real completed historical candles, 1-minute option observations, or current exchange contract master were supplied.

## Required status

| Area | Result |
|---|---|
| NIFTY 50 STRATEGY | IMPLEMENTED |
| BACKTEST | BLOCKED until real completed 5-minute candles, real 1-minute option observations, and current exchange contract-master data are supplied |
| DEPLOYMENT GATE | BLOCKED until broker gate plus independent validation requirements pass |
| LIVE READY | NO |

## Final verdict

The strategy is implemented, but it is not live-ready. No profitability, win-rate, or production-readiness claim is made. Live deployment must remain blocked until the independent validation gate passes and the existing real-broker deployment gate verifies the selected live account and feed.
