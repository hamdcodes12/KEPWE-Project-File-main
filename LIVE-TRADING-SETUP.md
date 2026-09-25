# KEPWE NIFTY 50 STRATEGY - LIVE TRADING SETUP GUIDE

**CRITICAL**: This guide enables **REAL live trading with ACTUAL broker orders**. Do NOT proceed without understanding all prerequisites.

---

## Table of Contents

1. [Production Readiness Check](#production-readiness-check)
2. [Safety Prerequisites](#safety-prerequisites)
3. [Live Execution Requirements](#live-execution-requirements)
4. [Step-by-Step Activation](#step-by-step-activation)
5. [Monitoring & Controls](#monitoring--controls)
6. [Emergency Procedures](#emergency-procedures)

---

## Production Readiness Check

Before enabling live trading, you MUST pass the complete production readiness assessment:

```bash
cd backend
node production-readiness-check.js <your-user-id>
```

This check verifies:

✓ **Dhan Broker Session** - Valid authentication, account identity confirmed  
✓ **Static IP Whitelist** - Broker can accept orders from your IP  
✓ **Market Data Feed** - Real-time NIFTY 50 data accessible  
✓ **Risk Engine** - Configured with trading capital and risk limits  
✓ **Order Management System** - All OMS tables and fields present  
✓ **Order Execution API** - Broker adapter supports live order placement  
✓ **Position Synchronization** - Can fetch live positions from broker  
✓ **P&L Calculation** - Trades tracked with actual fills and charges  
✓ **Notifications** - Alerts for signals, orders, fills  
✓ **Live Deployment Gate** - Strategy validation passed  
✓ **Strategy Configuration** - NIFTY 50 parameters locked  
✓ **Execution Reconciliation** - Duplicate protection active  

**If ANY check FAILS**: Do NOT proceed. Resolve the failure and run the check again.

**If ALL checks PASS**: Proceed to Step-by-Step Activation.

---

## Safety Prerequisites

### 1. Dhan Broker Account Connected

The strategy ONLY executes through **DhanHQ** broker in LIVE mode.

**What you need:**
- Dhan trading account with Nifty 50 index options trading enabled
- API credentials (already configured in `.env`):
  ```
  DHAN_API_KEY=c0be378b
  DHAN_API_SECRET=29c396c8-8ca0-4df2-a360-fa914e5d780b
  DHAN_CLIENT_ID=<your-dhan-client-id>
  ```

**Verify in KEPWE dashboard:**
1. Go to "Broker Connections"
2. Click "Connect Dhan"
3. Complete OAuth flow
4. Confirm status shows "CONNECTED" with valid session

### 2. Static IP Whitelisted

Your outbound IP **must be whitelisted** in Dhan API settings.

**Current configured IP:**
```
DHAN_STATIC_IP=103.117.180.146
```

**Verify with Dhan:**
1. Log into Dhan API Dashboard
2. Go to Settings → IP Whitelist
3. Add IP: `103.117.180.146`
4. Save and test with production-readiness-check.js

### 3. Trading Capital Allocated

Set your trading capital and risk limits:

**In KEPWE Dashboard:**
1. Go to "Risk Settings"
2. Set "Trading Capital" (amount you allocate for this strategy)
3. Set "Risk Per Trade" (1-2% recommended for NIFTY scalping)
4. Set "Max Daily Loss Limit" (auto-calculated as 10% of capital)
5. Save

**Recommended settings:**
- Trading Capital: ₹50,000 - ₹200,000
- Risk Per Trade: 1.0% - 1.5%
- Max Trades/Day: 3 (locked by strategy)
- Max Consecutive Losses: 2 (locked by strategy)
- Forced Exit Time: 15:10 IST (locked by strategy)

### 4. Broker Account Margin Sufficient

The strategy requires sufficient margin for option position sizing.

**Minimum requirements:**
- Trading Capital ÷ 5 = Minimum margin needed (5% risk × 20 leverage)
- Example: ₹100,000 capital requires ₹20,000 margin minimum

**Check current margin:**
```
GET /api/broker/dhan/margin
```

### 5. Market Hours Awareness

Strategy ONLY trades during defined market hours:

```
Trading Window: 09:25 - 15:10 IST (Monday-Friday)
Forced Exit: 15:10 IST (all open positions closed)
Excluded: Saturdays, Sundays, market holidays
```

---

## Live Execution Requirements

### Strategy Rules (Fixed)

```
Strategy Name:           KEPWE NIFTY 50 Scalping
Version:                 v1.0
Underlying:              NIFTY 50 Index
Instrument:              NIFTY 50 Index Options (CE/PE)
Signal Timeframe:        5-minute candles (completed only)
Entry Confirmation:      1-minute candle confirmation
Position Direction:      Long CE (bullish) or Long PE (bearish)
Max Positions/Time:      1 (no scaling, no hedging)
Risk/Reward Target:      1:2 (25% stop loss, 50% target)
Risk Per Trade:          5% of trading capital
Max Trades Per Day:      3
Max Consecutive Losses:  2
Daily Drawdown Limit:    10% of trading capital
```

### Execution Flow (No Exceptions)

1. **Signal Generation** (5-min candle closes)
   - Technical analysis on 5-minute NIFTY 50 candles
   - EMA, ADX, VWAP, ATR calculations
   - Buy Signal (BUY_CE) if: bullish regime detected
   - Buy Signal (BUY_PE) if: bearish regime detected
   - Signal only generated if candle is COMPLETED (not live)

2. **Entry Confirmation** (1-min candle check)
   - Next 1-minute candle validates entry
   - Price movement check
   - Liquidity filter applied

3. **Option Contract Selection**
   - Current NIFTY spot price → nearest ATM or OTM option
   - Bid-ask spread < 1.5%
   - Reasonable liquidity required

4. **Risk Engine Evaluation**
   ```
   ✓ Entry price set
   ✓ Stop loss calculated (current price - 25%)
   ✓ Target calculated (entry + 50%)
   ✓ Position size: capital × risk% ÷ stop distance
   ✓ Checks daily risk budget remaining
   ✓ Checks consecutive loss count
   ✓ Checks max trades limit
   ✓ Checks broker margin available
   ```

5. **Live Deployment Gate**
   ```
   ✓ Dhan broker connected
   ✓ Market data feed active
   ✓ Account identity verified
   ✓ Static IP whitelisted
   ✓ Risk profile valid
   ✓ OMS ready
   ✓ No duplicate orders
   ```

6. **Order Submission** → Dhan API
   ```
   POST /broker/dhan/order
   {
     instrument: "NIFTY 50 CALL 24000",
     side: "BUY",
     quantity: <calculated>,
     price: <current LTP>,
     orderType: "MARKET" or "LIMIT",
     timeInForce: "DAY"
   }
   ```

7. **Execution Update** → OMS Records
   ```
   Status: SUBMITTED → FILLED
   Broker Order ID: tracked
   Average Fill Price: recorded
   Quantity Filled: confirmed
   Timestamp: broker timestamp used
   ```

8. **Position Monitoring** → Real-time P&L
   ```
   Entry: Actual fill price
   Current: Live LTP from broker
   Stop Loss: Price-based exit
   Target: Price-based exit
   Exit Reason: TARGET, STOP, FORCED_EXIT, TIME_STOP
   ```

9. **Exit Execution**
   ```
   IF price >= target:
     Sell at limit (target price)
     Exit Reason: TARGET (profit)
   
   IF price <= stop loss:
     Sell at limit (stop price)
     Exit Reason: STOP (loss-cut)
   
   IF time >= 15:10 IST:
     Sell at market (forced exit)
     Exit Reason: FORCED_EXIT (daily close)
   
   IF holding > 20 minutes:
     Sell at market (time-based exit)
     Exit Reason: TIME_STOP
   ```

10. **P&L Calculation** → From Broker Fills
    ```
    Entry Premium:  Actual fill price
    Exit Premium:   Actual fill price
    Quantity:       Actual filled quantity
    Gross P&L:      (Exit - Entry) × Quantity
    Charges:        Broker brokerage + STT + taxes
    Net P&L:        Gross P&L - Charges
    ```

11. **Notifications Sent**
    - Signal Generated: timestamp, signal type, regime
    - Order Submitted: order ID, contract, quantity, price
    - Order Filled: fill price, fill quantity, fill time
    - Position Opened: entry price, stop, target
    - Price Hit Target: exit price, profit
    - Price Hit Stop: exit price, loss
    - Position Closed: exit reason, P&L
    - Daily Report: trades, P&L, positions

---

## Step-by-Step Activation

### STEP 1: Verify All Prerequisites

```bash
# Run production readiness check
cd backend
node production-readiness-check.js <your-user-id>

# Expected output:
# ✅ ALL CHECKS PASSED - PRODUCTION READY
```

**If FAILED**: Do NOT proceed. Fix each failed check:
- Dhan session expired → Reconnect broker
- Static IP not whitelisted → Add IP to Dhan settings
- Market data unavailable → Check market hours or broker status
- Risk engine blocked → Review risk profile settings
- OMS issues → Run database migrations

---

### STEP 2: Verify Risk Settings in Dashboard

1. **Open KEPWE Dashboard**
2. **Navigate**: Settings → Risk Management
3. **Verify**:
   - [ ] Trading Capital: Set to allocated amount
   - [ ] Risk Per Trade: 1.0% - 1.5%
   - [ ] Max Trades Per Day: 3
   - [ ] Max Consecutive Losses: 2
   - [ ] Daily Loss Limit: 10% of capital
4. **Click**: Save Settings

---

### STEP 3: Start Backend Server

```bash
cd backend
npm run start

# Expected output:
# Server running on port 3000
# Database connected
# OMS initialized
# Risk engine ready
# Broker connections loaded
```

---

### STEP 4: Enable Strategy in Dashboard

1. **Open KEPWE Dashboard**
2. **Navigate**: Trading → Strategy Selection
3. **Select**: "KEPWE NIFTY 50 Scalping"
4. **Click**: "Enable Live Trading"
5. **Confirm**: "I understand this places REAL orders with real money"
6. **Status Check**: Dashboard shows "LIVE - READY TO TRADE"

---

### STEP 5: Monitor First Trade (CRITICAL)

Once enabled, strategy will start analyzing 5-minute candles.

**First Signal Expected In**: Next completed 5-minute candle (within 5 minutes)

**When first order is generated:**

1. **Verify Order Details**:
   ```
   ✓ Instrument: NIFTY XX CALL or PUT (actual contract name)
   ✓ Side: BUY
   ✓ Quantity: Matches position sizing calculation
   ✓ Price: Current market LTP
   ✓ Stop Loss: Visible in trade panel
   ✓ Target: Visible in trade panel
   ```

2. **Monitor Order Submission**:
   ```
   ✓ Order appears in "Orders" panel
   ✓ Status: SUBMITTED
   ✓ Notification sent: "Order submitted to Dhan"
   ✓ Order ID: Visible
   ✓ Broker Order ID: Visible
   ```

3. **Confirm Order Execution**:
   ```
   ✓ Status changes to: FILLED
   ✓ Fill price recorded
   ✓ Notification sent: "Order filled"
   ✓ Position appears in "Open Positions"
   ✓ Unrealized P&L shows live
   ```

4. **Monitor Position**:
   ```
   ✓ Entry Price: Actual fill price
   ✓ Current Price: Live LTP from Dhan
   ✓ Stop Loss: Price and P&L shown
   ✓ Target: Price and P&L shown
   ✓ Current P&L: Updates in real-time
   ```

5. **Verify Exit**:
   ```
   Once price hits target or stop:
   ✓ Exit order submitted automatically
   ✓ Notification: "Position closed - TARGET" or "Position closed - STOP"
   ✓ Realized P&L recorded
   ✓ Trade added to "Trade History"
   ```

**If something unexpected happens:**
- See [Emergency Procedures](#emergency-procedures)

---

## Monitoring & Controls

### Live Trading Dashboard

**Real-time displays:**

```
Status Bar:
  Strategy: KEPWE NIFTY 50 Scalping [LIVE]
  Broker: Dhan [CONNECTED]
  Session: Valid until [expiry time]
  Market: Open / Closed
  Time: [IST with market hours indicator]

Active Signals:
  Signal Generated: BUY_CE at [time]
  Regime: Bullish
  Entry Ready: Yes/No
  Next 1-min: Awaiting confirmation

Open Positions:
  Contract: NIFTY 24000 CE
  Entry: ₹250
  Current: ₹260
  Stop: ₹190 (Unrealized: -₹3,000)
  Target: ₹375 (Unrealized: +₹6,250)
  Current P&L: +₹500

Orders:
  [Order 1] NIFTY 24000 CE | BUY 50 | FILLED | ₹250 | 09:30
  [Order 2] NIFTY 24000 CE | SELL 50 | PENDING | ₹375 | 09:45

Trade History:
  [Trade 1] NIFTY 24000 CE | BUY@250 SELL@320 | +₹3,500 | 09:30-09:55
  [Trade 2] NIFTY 24100 PE | BUY@180 SELL@130 | -₹2,500 | 10:00-10:20

Today's P&L:
  Gross P&L: +₹1,000
  Charges: -₹150
  Net P&L: +₹850
```

### Critical Controls

#### LIVE MONITORING (Every Trade)

```
□ Entry confirmed by OMS
□ Broker order ID visible
□ Fill price matches market
□ Position size correct
□ Stop loss at correct level
□ Target at correct level
```

#### DAILY CHECKS (Market Open)

```
□ Dhan session validated
□ Market data feed active
□ Risk budget: 10% of capital still available
□ No stuck orders from previous day
□ Positions reconciled with broker
□ Notifications enabled
```

#### MARKET CLOSE (15:10 IST)

```
□ All positions force-closed
□ No open orders remaining
□ Daily P&L recorded
□ Session saved
□ Tomorrow: Check for any failed reconciliation
```

### Performance Metrics

**Track these daily:**

```
Metrics Dashboard:
├─ Today's Trades: N
├─ Wins: N (+₹XXXX)
├─ Losses: N (-₹XXXX)
├─ Win Rate: XX%
├─ Largest Win: +₹XXXX
├─ Largest Loss: -₹XXXX
├─ Today's Gross P&L: +/- ₹XXXX
├─ Total Charges: ₹XXX
├─ Today's Net P&L: +/- ₹XXXX
├─ Daily Risk Used: XX% of budget
└─ Consecutive Losses: N
```

---

## Emergency Procedures

### SITUATION 1: Broker Session Expired

**Symptom**: Orders rejected with "Session expired" or "Invalid token"

**Immediate Action**:
1. **STOP strategy immediately**:
   - Dashboard → Strategy Status → Click "STOP"
   - Wait for confirmation

2. **Reconnect Dhan**:
   - Dashboard → Broker Connections
   - Click Dhan → "Reconnect"
   - Complete OAuth flow
   - Confirm "CONNECTED" status

3. **Reconcile positions**:
   - Dashboard → Reconciliation
   - Click "Reconcile Now"
   - Wait for "All positions matched"

4. **Resume strategy**:
   - Once all reconciled and reconnected
   - Dashboard → Strategy → "Enable Live Trading"

**Prevention**: Sessions auto-refresh, but if away > 24 hours, reconnect manually.

---

### SITUATION 2: Position Mismatch (Broker vs Internal)

**Symptom**: Dashboard shows position, but broker says no position exists

**Immediate Action**:
1. **EMERGENCY STOP**:
   ```bash
   # From terminal:
   curl -X POST http://localhost:3000/api/algo/kill-switch
   ```
   - All open positions force-closed at market
   - No new orders allowed

2. **Manual reconciliation**:
   - Go to Dhan terminal
   - Check actual positions
   - Note exact quantity and price

3. **Contact KEPWE support** with:
   - Time mismatch occurred
   - Expected position vs actual position
   - Last order details

4. **Do NOT resume** until root cause identified

---

### SITUATION 3: Order Rejected by Broker

**Symptom**: Order status shows "REJECTED"

**Check rejection reason:**
```
Possible reasons:
✗ Insufficient margin: Add margin to broker account
✗ Invalid contract: Strike expired or delisted
✗ Market hours: Check IST market hours
✗ Order limit exceeded: Wait for pending orders to clear
✗ API key invalid: Reconnect broker
✗ Static IP not whitelisted: Whitelist IP in Dhan settings
```

**Resolution**:
1. **Do NOT retry manually** - Strategy will retry automatically
2. **Check reason** in order details
3. **Fix the issue** (margin, IP, contract, etc.)
4. **Resume trading** once fixed

---

### SITUATION 4: Market Data Unavailable

**Symptom**: Strategy says "No market data" or "Data feed stale"

**Immediate Action**:
1. **Strategy auto-stops** (safe design)
2. **Check market hours**:
   - Trading window: 09:25 - 15:30 IST
   - Weekdays only (Mon-Fri)
   - No market holidays
3. **Verify broker connection**:
   - Dashboard → Broker Status → Dhan
   - Should show "CONNECTED" with recent timestamp
4. **Restart market data feed**:
   - Backend: Ctrl+C then `npm run start`
   - Wait for "Feeds initialized" message
5. **Resume strategy** once data feed confirmed

---

### SITUATION 5: Stuck Order (No Fill, No Rejection)

**Symptom**: Order status "SUBMITTED" for > 10 minutes with no fill

**Immediate Action**:
1. **Check broker status**:
   - Dhan terminal: Search for order ID
   - Check if order is actually in broker system
   - Verify price hasn't changed dramatically

2. **If order is stuck in broker**:
   - Do NOT cancel from KEPWE yet
   - Go to Dhan terminal and manually check/cancel
   - Then reconcile in KEPWE

3. **If order not in broker** (lost order):
   - KEPWE: Cancel order from dashboard
   - KEPWE: Re-run reconciliation
   - Wait for next signal

4. **Check logs**:
   ```bash
   # From backend logs:
   tail -f logs/keepwe-*.log | grep "stuck\|timeout"
   ```

---

### SITUATION 6: Duplicate Trades (Same Signal Twice)

**Symptom**: Two orders placed for same signal simultaneously

**Immediate Action**:
1. **Cancel second order** immediately
2. **Dashboard → Reconciliation** → Reconcile
3. **Check logs** for duplicate protection failure
4. **Report to KEPWE** - should not happen

---

### PANIC BUTTON: Kill Switch

**If ANYTHING goes wrong**, execute emergency stop:

```bash
# Terminal 1: HTTP API
curl -X POST http://localhost:3000/api/algo/kill-switch

# OR Terminal 2: Direct database
psql $SUPABASE_DB_URL -c "UPDATE algo_states SET status = 'STOPPED' WHERE user_id = '<user-id>'"

# OR Dashboard
Dashboard → Emergency → STOP ALL TRADING
```

**Kill Switch does:**
```
✓ Cancels all pending orders immediately
✓ Force-closes all open positions at market
✓ Stops generating new signals
✓ Pauses strategy execution
✓ Logs all actions
✓ No new orders until manually resumed
```

---

## Compliance & Disclosures

### Important Disclaimers

- **No Profit Guarantee**: Past backtest performance does NOT guarantee future profits
- **Market Risk**: All trading involves risk, including loss of capital
- **Leverage Risk**: Options trading involves leverage and amplified losses
- **System Risk**: Broker disconnection, market volatility, or execution errors can result in losses
- **Strategy Risk**: The strategy may experience drawdowns exceeding stop loss on gap-down scenarios

### Trade Records

All trades are permanently recorded:
```
Database: algo_trades
├─ Entry: Timestamp, price, quantity
├─ Exit: Timestamp, price, quantity, reason
├─ P&L: Gross, charges, net
├─ Broker ID: Linked to actual broker execution
└─ Reconciliation: Verified against broker records
```

### Regulatory Compliance

- KEPWE Quant complies with SEBI regulations for trading software
- All orders use official broker APIs (no unauthorized trading)
- Position limits enforced by risk engine
- Daily loss limits prevent over-leveraging
- No market manipulation or insider information used

---

## Contact & Support

For issues or questions:

**Production Readiness Failure**:
- Run: `node production-readiness-check.js <user-id>`
- Review each FAILED check
- Follow ACTION REQUIRED instructions

**Live Trading Issues**:
- Check logs: `tail -f logs/keepwe-*.log`
- Check orders: Dashboard → Order History
- Check positions: Dashboard → Positions
- Check reconciliation: Dashboard → Reconciliation → Verify

**Emergency Support**:
- Stop strategy immediately (Kill Switch)
- Preserve logs and screenshots
- Document exact time and issue description
- Contact: help@kepwe.in

---

## Summary

You now have a **production-ready KEPWE NIFTY 50 strategy** with:

✅ All safety gates active  
✅ Real-time market data  
✅ Risk engine enforced  
✅ OMS with execution reconciliation  
✅ Live broker orders (Dhan API)  
✅ Position synchronization  
✅ P&L tracking from actual fills  
✅ Emergency controls  

**Trade with confidence, but trade carefully.**

Start small, monitor closely, and scale up once you're comfortable with system behavior.

Good luck! 📈

---

*Last Updated: September 2026*
*Version: KEPWE NIFTY 50 Scalping v1.0*
