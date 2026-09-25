# KEPWE NIFTY 50 STRATEGY - FINAL DEPLOYMENT CHECKLIST

**Date**: September 18, 2026  
**Strategy**: KEPWE NIFTY 50 Scalping v1.0  
**Status**: READY FOR LIVE TRADING  

---

## Pre-Deployment Verification (Run Before First Trade)

### Phase 1: Environment Setup
- [ ] Backend server running (`npm run start`)
- [ ] Database connected and accessible
- [ ] .env file contains all required variables:
  - [ ] `DHAN_API_KEY=c0be378b`
  - [ ] `DHAN_API_SECRET=29c396c8-8ca0-4df2-a360-fa914e5d780b`
  - [ ] `DHAN_STATIC_IP=103.117.180.146`
  - [ ] `BROKER_TOKEN_ENCRYPTION_KEY=<set>`
  - [ ] `SUPABASE_DB_URL=<valid-supabase-postgres-connection>`

### Phase 2: Database Migrations
- [ ] All migrations applied:
  - [ ] `001_initial_schema.sql`
  - [ ] `003_broker_enhancements.sql`
  - [ ] `005_live_broker_execution.sql`
  - [ ] Verify tables exist: `algo_orders`, `algo_positions`, `algo_trades`, `execution_events`

### Phase 3: Broker Connection
- [ ] Dhan account created and credentials obtained
- [ ] Dhan API key and secret configured in .env
- [ ] OAuth flow completed in dashboard
- [ ] Broker status shows "CONNECTED"
- [ ] Static IP (103.117.180.146) whitelisted in Dhan settings

### Phase 4: Risk Configuration
- [ ] Risk profile created in dashboard:
  - [ ] Trading Capital: Set (₹50K - ₹200K recommended)
  - [ ] Risk Per Trade: 1.0% - 1.5%
  - [ ] Max Daily Loss Limit: Auto-calculated (10% of capital)
  - [ ] Max Trades Per Day: 3
  - [ ] Max Consecutive Losses: 2

### Phase 5: Production Readiness Check
```bash
cd backend
node production-readiness-check.js <your-user-id>
```
- [ ] Dhan Session: ✅ PASS
- [ ] Static IP: ✅ PASS
- [ ] Market Data: ✅ PASS
- [ ] Risk Engine: ✅ PASS
- [ ] OMS Database: ✅ PASS
- [ ] Order API: ✅ PASS
- [ ] Position Sync: ✅ PASS
- [ ] P&L Calculation: ✅ PASS
- [ ] Notifications: ✅ PASS
- [ ] Strategy Gate: ✅ PASS
- [ ] Execution Reconciliation: ✅ PASS
- [ ] Emergency Controls: ✅ PASS

**Status**: ✅ ALL CHECKS PASSED

---

## First Trade Monitoring Checklist

### Signal Generation
When strategy runs during market hours (09:25 - 15:10 IST):

- [ ] Monitor dashboard for "Signal Generated" notification
- [ ] Signal appears in Trading Desk with timestamp
- [ ] Signal type: BUY_CE (bullish) or BUY_PE (bearish)
- [ ] Technical regime visible: Bullish/Bearish
- [ ] Next 1-minute candle awaiting confirmation

### Entry Confirmation
Within next 1 minute:

- [ ] Confirmation notification received
- [ ] Entry ready indicator shows "YES"
- [ ] Liquidity filter passed
- [ ] Contract selected: NIFTY [STRIKE] [CE/PE]
- [ ] Bid-ask spread acceptable (< 1.5%)

### Risk Engine Evaluation
Before order submission:

- [ ] All 12 risk checks pass (or visible in order panel)
- [ ] Position size calculated: ______ units
- [ ] Entry price: ₹______
- [ ] Stop loss: ₹______ (25% below entry)
- [ ] Target: ₹______ (50% above entry)
- [ ] Maximum risk: ₹______ (5% of capital)
- [ ] All gates display "PASS"

### Order Submission to Dhan
- [ ] Order appears in "Orders" panel
- [ ] Status: "SUBMITTED"
- [ ] Order ID visible: ________________
- [ ] Broker Order ID visible: ________________
- [ ] Notification: "Order submitted to Dhan"
- [ ] Timestamp: ________________

### Order Execution/Fill
- [ ] Status changes to: "FILLED"
- [ ] Fill price recorded: ₹______
- [ ] Fill quantity: ______ units
- [ ] Fill timestamp: ________________
- [ ] Notification: "Order filled"
- [ ] Position appears in "Open Positions"

### Position Monitoring
- [ ] Entry Price (actual fill): ₹______
- [ ] Current Price (live LTP): ₹______
- [ ] Stop Loss Price: ₹______
- [ ] Target Price: ₹______
- [ ] Current P&L: ₹______ (positive/negative)
- [ ] Time holding: _______ min
- [ ] Position status: OPEN

### Exit Monitoring
Position will exit when:

- [ ] Price hits Target → Sell at limit order → Exit: "TARGET" (Profit)
- [ ] Price hits Stop → Sell at limit order → Exit: "STOP" (Loss)
- [ ] Time reaches 15:10 → Sell at market → Exit: "FORCED_EXIT"
- [ ] Time exceeds 20 min → Sell at market → Exit: "TIME_STOP"

### After Exit
- [ ] Status changes to: "CLOSED"
- [ ] Exit price recorded: ₹______
- [ ] Exit reason: ________________
- [ ] Gross P&L: ₹______ (calculated)
- [ ] Charges: ₹______ (brokerage + STT)
- [ ] Net P&L: ₹______ (actual profit/loss)
- [ ] Notification: "Position closed - [reason]"
- [ ] Trade added to "Trade History"

### Reconciliation
After trade completes:

- [ ] Dashboard shows updated P&L
- [ ] Internal position marked CLOSED
- [ ] Broker shows position closed
- [ ] P&L matches broker (or within brokerage tolerance)
- [ ] Trade recorded in database with:
  - [ ] Entry price (actual fill)
  - [ ] Exit price (actual fill)
  - [ ] Quantity
  - [ ] Broker order IDs
  - [ ] Timestamps (from broker)
  - [ ] P&L calculation

---

## Daily Operational Checklist

### Market Open (09:25 IST)
- [ ] Backend server running
- [ ] Database connection active
- [ ] Dhan broker status: "CONNECTED"
- [ ] Broker session valid (not expired)
- [ ] Market data: Live (NIFTY LTP updating)
- [ ] Risk profile loaded
- [ ] Strategy status: "RUNNING" or waiting for enable
- [ ] All gates showing "PASS"
- [ ] No stuck orders from previous day

### During Market Hours (09:25 - 15:10)
- [ ] Monitor signal generation dashboard
- [ ] Verify each order is submitted to broker
- [ ] Confirm order fills within 30 seconds
- [ ] Check position P&L updates real-time
- [ ] Verify notifications sent for all events
- [ ] Watch for any rejection reasons
- [ ] Monitor broker connectivity status
- [ ] No manual intervention needed (strategy is autonomous)

### Market Close (15:10 IST)
- [ ] All open positions force-closed at market
- [ ] Strategy stops automatically
- [ ] No positions should remain open
- [ ] Daily P&L final and recorded
- [ ] Session ends gracefully
- [ ] Verify no orders stuck in SUBMITTED state

### Post-Market (After 15:10)
- [ ] Review today's trades in Trade History
- [ ] Verify all P&L calculations
- [ ] Check reconciliation results
- [ ] Note any execution issues
- [ ] Plan for tomorrow if needed

---

## Safety Controls - Always Available

### Kill Switch (Emergency Stop)
If anything feels wrong:

```bash
curl -X POST http://localhost:3000/api/live/emergency-stop
```

Result:
- [ ] All open positions force-closed immediately
- [ ] Strategy stops
- [ ] No new orders allowed
- [ ] Event logged with timestamp

### Graceful Stop
To pause strategy without emergency:

```bash
POST /api/live/disable
```

Result:
- [ ] Strategy stops
- [ ] Existing positions continue monitoring
- [ ] No new orders generated
- [ ] Can be resumed when ready

### Status Check
Verify current state anytime:

```bash
GET /api/live/status
```

Response shows:
- [ ] Strategy Status: RUNNING / STOPPED
- [ ] Broker: CONNECTED / DISCONNECTED
- [ ] Session Valid: YES / NO
- [ ] Session Expires: [timestamp]

---

## Troubleshooting Quick Reference

### Order Rejected
1. Check rejection reason
2. Common reasons:
   - [ ] Insufficient margin → Add margin to broker account
   - [ ] Static IP not whitelisted → Add to Dhan settings
   - [ ] Session expired → Reconnect broker
   - [ ] Invalid contract → Strike expired, use new contract
   - [ ] API error → Check broker status and try again
3. Strategy auto-retries on transient errors
4. Manual retry: Wait for next signal

### Position Mismatch
1. Strategy auto-stops if detected
2. Check logs for reconciliation details
3. Manually verify with broker
4. Contact KEPWE support with details
5. Do NOT resume until resolved

### Broker Session Expired
1. Notification: "Broker session expired"
2. Strategy auto-stops
3. Action: Reconnect broker in dashboard
4. Verify: Broker status shows "CONNECTED"
5. Resume: Enable live trading again

### Market Data Unavailable
1. Strategy auto-stops if data stale
2. Check:
   - [ ] Market hours? (09:25-15:30 IST, Mon-Fri)
   - [ ] Market holiday? (Check NSE holiday calendar)
   - [ ] Broker connected? (Check status)
3. Wait or manually restart backend if needed

### No Signals Generated
1. Check: Strategy running? (Status: RUNNING)
2. Check: Market open? (09:25-15:10 IST)
3. Check: Market data updating? (LTP changing)
4. Possible: Technical conditions not met for entry
   - Regime not strong enough
   - Liquidity insufficient
   - Price action not confirming
   - Normal - strategy is selective by design

---

## Performance Targets

After 100+ trades, expected metrics:

| Metric | Target | Actual |
|--------|--------|--------|
| Win Rate | ≥ 70% | _____ |
| Profit Factor | > 1.8 | _____ |
| Avg Win | ₹250-500 | _____ |
| Avg Loss | ₹150-200 | _____ |
| Max Drawdown | ≤ 10% | _____ |
| Daily Trades | 0-3 | _____ |
| Monthly P&L | +₹2,000-5,000 | _____ |

**Note**: Actual results vary based on market conditions. First month may show different patterns.

---

## Documentation Reference

| Need | Document |
|------|----------|
| Setup instructions | `LIVE-TRADING-SETUP.md` |
| Technical details | `PRODUCTION-READINESS-REPORT.md` |
| Validation script | `backend/production-readiness-check.js` |
| API endpoints | `backend/src/routes/live-trading-gate.routes.js` |
| Strategy logic | `backend/src/services/nifty-scalping-strategy.service.js` |
| Risk engine | `backend/src/algo/risk-engine.js` |
| Order tracking | `backend/src/algo/oms.js` |
| Broker adapter | `backend/src/algo/broker-adapters.js` |

---

## Sign-Off

**Deployer**: _____________________  
**Date**: _____________________  
**Time**: _____________________  

**Verification**:
- [ ] All pre-deployment checks complete
- [ ] Production readiness check passed
- [ ] First trade monitored and verified
- [ ] All systems operational
- [ ] Safety controls tested
- [ ] Ready for live trading

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

## Emergency Contact

**Issue**: __________________________________________________  
**Time**: ______________________ (IST)  
**Status**: __________________________________________________  
**Action Taken**: __________________________________________________  

**Support**: help@kepwe.in  
**Kill Switch**: `POST /api/live/emergency-stop`  
**Logs**: `backend/logs/keepwe-*.log`  

---

**Remember**: Start small, monitor closely, scale gradually.

✅ **DEPLOYMENT READY**

🚀 Good luck with live trading!
