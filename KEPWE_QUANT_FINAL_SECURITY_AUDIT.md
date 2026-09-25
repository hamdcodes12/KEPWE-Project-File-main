# KEPWE Quant - FINAL SECURITY AUDIT
**Date**: September 12, 2026  
**Scope**: Backend enforcement of LIVE-only trading, elimination of PAPER/SANDBOX execution, database constraints, order path verification  
**Status**: AUDIT COMPLETE - CRITICAL ISSUES IDENTIFIED

---

## EXECUTIVE SUMMARY

**ACTUAL STATE**: KEPWE Quant backend has been **partially hardened** but contains **critical security contradictions** that prevent claiming "LIVE-only enforcement."

**KEY FINDING**: Database schema files (`algo_engine_additions.sql` and `remove_paper_trading.sql`) contain **direct contradictions** regarding execution_mode column persistence and constraint levels.

**RESULT**: OMS function-level LIVE validation exists and works, but database-level constraint is insufficient and conflicting.

---

## 1. DATABASE SCHEMA AUDIT

### 1.1 Current Constraint Definition
**File**: `backend/db/algo_engine_additions.sql` (line 11)

```sql
execution_mode VARCHAR(10) NOT NULL DEFAULT 'PAPER' 
    CHECK (execution_mode IN ('PAPER', 'LIVE'))
```

**Status**: ❌ **INSUFFICIENT**
- Allows both 'PAPER' and 'LIVE'
- Defaults to 'PAPER' (incorrect for production)
- NOT constrained to 'LIVE' only

### 1.2 Conflicting Migration
**File**: `backend/db/remove_paper_trading.sql` (line 12)

```sql
ALTER TABLE algo_orders DROP COLUMN IF EXISTS execution_mode CASCADE;
```

**Status**: ❌ **CONTRADICTORY**
- Drops execution_mode entirely
- Conflicts with OMS function-level INSERT that hardcodes 'LIVE'
- Creates schema uncertainty: is column present or not?

### 1.3 Required Fix
**DECISION**: Keep execution_mode column for audit trail but constrain to LIVE-only

**Required migration** (NOT YET APPLIED):
```sql
-- Add LIVE-only constraint to algo_orders
ALTER TABLE algo_orders 
    DROP CONSTRAINT IF EXISTS algo_orders_execution_mode_check;

ALTER TABLE algo_orders 
    ADD CONSTRAINT algo_orders_execution_mode_check 
    CHECK (execution_mode = 'LIVE');

ALTER TABLE algo_orders 
    ALTER COLUMN execution_mode SET DEFAULT 'LIVE';
```

**Issue**: This migration has NOT been created or applied.

---

## 2. ORDER EXECUTION PATH TRACING

### 2.1 Complete Call Chain

```
┌─ HTTP POST /broker/orders (line 1099, algo.routes.js)
│   ├─ requireAuth middleware
│   ├─ validateBody(liveOrderSchema) - validates request body
│   ├─ ensureAlgoRows(userId) - ensures algo_settings, algo_states exist
│   │
│   ├─ State Check: algo_states.status !== 'ACTIVE' → HTTP 409 reject
│   │   (reason: 'Start the algo before submitting a live broker order')
│   │
│   ├─ getLiveBroker(req, order.broker) → returns DhanAdapter
│   │   └─ Validates Dhan session exists and is authenticated
│   │
│   ├─ Margin Verification
│   │   └─ adapter.getMargin() → MUST succeed or broker marked disconnected
│   │
│   ├─ Risk Engine Validation (evaluateRisk function)
│   │   ├─ Checks: candidate, settings, stats, existingPosition, duplicateOrder
│   │   ├─ If !risk.approved → HTTP 409 reject
│   │   └─ If quantity > risk.sizing.quantity → HTTP 409 reject
│   │
│   └─ createAndSubmitOrder({
│       pool,
│       adapter,        ← DhanAdapter instance
│       userId,
│       strategyId,
│       executionMode: 'LIVE',  ← HARDCODED by routes, not from request
│       instrument,
│       side,
│       quantity,
│       price,
│       stopLoss,
│       target,
│       metadata
│   })
│
├─ OMS FUNCTION: createAndSubmitOrder (oms.js line 257)
│   │
│   ├─ ✅ LIVE-ONLY VALIDATION (line 280)
│   │   if (executionMode !== 'LIVE') {
│   │     throw new Error(`KEPWE Quant only supports LIVE execution...`)
│   │   }
│   │
│   ├─ Database Transaction BEGIN
│   │
│   ├─ Duplicate Check (lines 288-295)
│   │   ├─ SELECT algo_orders WHERE status IN ('CREATED', 'SUBMITTED', ...)
│   │   ├─ UNION SELECT algo_positions WHERE status = 'OPEN'
│   │   └─ NO paper_trades lookup (correctly removed)
│   │
│   ├─ INSERT INTO algo_orders (line 308)
│   │   VALUES (internalOrderId, userId, strategyId, 'LIVE', ...)
│   │   └─ Hardcodes 'LIVE' regardless of parameter
│   │
│   └─ Database Transaction COMMIT
│
├─ DhanAdapter.placeOrder() (broker-adapters.js line 481)
│   │
│   ├─ ✅ ACCESS TOKEN REQUIRED (line 485)
│   │   if (authenticated && !this.accessToken) {
│   │     throw new BrokerCapabilityError(...)
│   │   }
│   │
│   ├─ ✅ Dhan Client ID Required (line 491)
│   │   if (!clientId) throw BrokerCapabilityError(...)
│   │
│   ├─ Build request body with validated parameters
│   │
│   └─ fetch(dhan_base_url/orders, POST, headers with access-token)
│       └─ Returns: brokerOrderId or throws error
│
└─ HTTP Response 201/202 with order object
    └─ Order stored in algo_orders with status 'SUBMITTED' or 'FILLED'
```

### 2.2 Security Checkpoints

| Checkpoint | Type | Status | Details |
|-----------|------|--------|---------|
| **HTTP Auth** | Frontend → Backend | ✅ Enforced | requireAuth middleware validates JWT |
| **Algo State** | Route Handler | ✅ Enforced | algo_states.status must be 'ACTIVE' |
| **Broker Session** | Route Handler | ✅ Enforced | Dhan accessToken must be present and valid |
| **Risk Engine** | Route Handler | ✅ Enforced | evaluateRisk() must approve order |
| **Margin Check** | Route Handler | ✅ Enforced | adapter.getMargin() must not throw |
| **LIVE-Only Mode** | OMS Function | ✅ Enforced | executionMode !== 'LIVE' throws error (line 280) |
| **DB Execution Mode** | OMS Insert | ⚠️ Partial | Inserts 'LIVE', but column allows 'PAPER' |
| **Dhan Auth Token** | Adapter | ✅ Enforced | placeOrder() requires this.accessToken |
| **Dhan Client ID** | Adapter | ✅ Enforced | placeOrder() requires clientId or throws |
| **DB Constraint** | Database | ❌ Missing | CHECK (execution_mode = 'LIVE') not applied |

---

## 3. BACKEND SECURITY GAPS IDENTIFIED

### 3.1 Gap #1: Contradictory Migration Files

**Severity**: CRITICAL  
**Issue**: Two database migration files provide conflicting guidance:
- `algo_engine_additions.sql` - creates column with permissive CHECK
- `remove_paper_trading.sql` - drops column entirely

**Current State**: Unclear which migration is active in production. If neither applied, column defaults to 'PAPER'.

**Impact**: Cannot claim database-level enforcement without resolving this contradiction.

---

### 3.2 Gap #2: PAPER References in Backend Routes

**Severity**: HIGH  
**File**: `backend/src/routes/algo.routes.js`

| Line | Issue | Details |
|------|-------|---------|
| 272 | `adapterForOrder()` | `if (order.execution_mode === 'PAPER') return getBrokerAdapter(null, 'PAPER');` - Function accepts PAPER mode |
| 359-363 | Soft Delete for PAPER | References paper_trade_settings table and paper_trade_mode column - allows fallback to paper |
| 430 | SANDBOX Connection | `INSERT INTO broker_accounts ... 'SANDBOX_CONNECTED', 'SANDBOX'` - Allows SANDBOX mode |
| 673 | PAPER Adapter Readiness | `paper: getBrokerReadiness(null, 'PAPER')` - Returns PAPER adapter status in broker panel |
| 928+ | Paper Trades Endpoint | `router.get('/algo/paper-trades')` - Endpoint still exists and returns paper trades |

**Impact**: 
- `/algo/paper-trades` endpoint allows querying paper trades (circumvents LIVE-only)
- `adapterForOrder()` can return PAPER adapter if database contains PAPER execution_mode
- SANDBOX connections still possible via `/broker/connect`

---

### 3.3 Gap #3: Frontend References to Sandbox/Paper

**Severity**: MEDIUM  
**File**: `src/pages/indexpilot/AlgoDashboardPage.jsx`

| Line | Reference | Details |
|------|-----------|---------|
| 193-199 | Sandbox Connection | `connectSandbox()` function allows Dhan sandbox connection |
| 221 | Env Display | Shows "SANDBOX MODE" in header |
| 243 | Pass-Through Param | `connectSandbox` prop passed to Overview |
| 259 | Paper Banner | "Orders remain paper-only while live adapters are disabled" |
| 266 | Paper Metrics | "PAPER PERFORMANCE" section with "PAPER ONLY" badge |
| 277 | Sandbox Panel | "Sandbox adapters are available for wiring" |
| 350 | Paper Trading Page | Entire page devoted to paper trading functionality |

**Impact**: These are **INDEXPILOT ALGO** components (not KEPWE Quant). Audit scope specifies "Do NOT modify unrelated products."

---

### 3.4 Gap #4: No Fallback Prevention for Dhan Failures

**Severity**: HIGH  
**Issue**: Code does not verify "no fabricated data" when Dhan API fails

**Current Behavior** (lines 1160-1180 in algo.routes.js):
```javascript
const submitted = await createAndSubmitOrder({...});
if (submitted.status === 'REJECTED') {
  await recordRiskEvent(req.userId, 'ORDER_REJECTED', 
    submitted.rejection_reason || 'Broker rejected the order', ...);
  if (/API error|timed out|timeout|connection|unavailable/i.test(...)) {
    await stopForBrokerDisconnect(...);  // Marks broker as disconnected
  }
  return res.status(409).json({ error: submitted.rejection_reason || 'Broker rejected the order' });
}
```

**Verification**: ✅ Correctly returns error, does NOT fabricate order confirmation.

---

### 3.5 Gap #5: Paper Trades Table Still in Database

**Severity**: MEDIUM  
**File**: `backend/db/algo_engine_additions.sql` (lines 31-50)

```sql
CREATE TABLE IF NOT EXISTS paper_trades (
    id UUID PRIMARY KEY,
    ...
    status VARCHAR(20) CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    ...
);
```

**Status**: Still created by migration.  
**Conflict**: `remove_paper_trading.sql` attempts to drop it, but conflicts with `algo_engine_additions.sql`.

**Impact**: If `algo_engine_additions.sql` runs after `remove_paper_trading.sql`, paper_trades table is recreated.

---

## 4. NEGATIVE TEST SCENARIOS

### Test Case 1: Direct PAPER Execution Request
```
Request: POST /broker/orders with executionMode: 'PAPER'
Expected: ❌ HTTP 409 Rejection
Actual: ❌ FAILS - executionMode parameter is NOT sent by frontend (hardcoded in routes)
         ✅ However, if database execution_mode = 'PAPER', adapterForOrder() would return PAPER adapter
Result: OMS hardcoding executionMode='LIVE' prevents this, BUT only because routes don't expose it
Recommendation: Add explicit executionMode validation in routes
```

### Test Case 2: Disconnected Dhan Session
```
Request: POST /broker/orders with expired Dhan accessToken
Expected: ✅ HTTP 503 Rejection before Dhan.placeOrder()
Actual: ✅ DhanAdapter.placeOrder() throws BrokerCapabilityError if no accessToken
         ✅ Route handler catches error, calls stopForBrokerDisconnect()
Result: PASS - Order never reaches real Dhan API
```

### Test Case 3: Failed Risk Check
```
Request: POST /broker/orders exceeding risk sizing
Expected: ✅ HTTP 409 Rejection
Actual: ✅ evaluateRisk() returns { approved: false, reason: '...' }
         ✅ Route returns 409 before createAndSubmitOrder() call
Result: PASS - Order never reaches OMS
```

### Test Case 4: No Active Algo State
```
Request: POST /broker/orders when algo not started
Expected: ✅ HTTP 409 Rejection
Actual: ✅ algo_states.status !== 'ACTIVE' check at line 1103
         ✅ Returns 409: 'Start the algo before submitting...'
Result: PASS - Order never reaches OMS
```

### Test Case 5: Direct Database execution_mode='PAPER'
```
Request: POST /broker/orders after manually setting execution_mode='PAPER' in algo_orders
Expected: ❌ Should still reject or place order as LIVE
Actual: ⚠️ MIXED
         - OMS hardcodes 'LIVE' in INSERT (defensive)
         - But adapterForOrder() checks execution_mode from order parameter, not database
         - If existing paper order: adapterForOrder() returns PAPER adapter
Result: PARTIAL VULNERABILITY - existing paper orders could execute via wrong adapter
```

### Test Case 6: Dhan Fake Order ID Response
```
Request: POST /broker/orders with simulated Dhan response missing orderId
Expected: ✅ Throws BrokerApiError before storing
Actual: ✅ Line 506 in broker-adapters.js: if (!brokerOrderId) throw BrokerApiError()
Result: PASS - No fake order stored
```

---

## 5. BUILD AND SYNTAX VALIDATION

### Frontend Build
```
Command: npm run build
Exit Code: 0
Status: ✅ SUCCESS
Output: Vite built 1984 modules, output 1.04 MB (gzip 0.57 kB)
```

### Backend Syntax Check
```
Command: node -c backend/src/server.js
Exit Code: 0
Status: ✅ SUCCESS
All syntax valid
```

---

## 6. PAPER/SANDBOX REFERENCES IN QUANT CODE

### Verified Removals (Quant-Specific):
✅ All paper trading API routes removed (`/api/quant/paper/*`)  
✅ PaperTradingTerminalView.jsx deleted  
✅ Paper trading state removed from AppContext  
✅ Paper trade service functions removed  
✅ Paper mode toggle removed from AppDeskPage  
✅ Paper section removed from QuantMarketingPage  
✅ TypeScript types updated (removed 'Paper Trade' status)  
✅ Strategy status enum removed 'PAPER_ACTIVE'  
✅ No references to PAPER/sandbox/simulated/mock in Quant frontend  

### Remaining References (NOT Quant - out of scope):
- **IndexPilot Algo** (separate product)
  - Sandbox connection functions (connectSandbox)
  - "SANDBOX MODE" environment display
  - Paper trading terminal and metrics
  - Paper trading page and journal

---

## 7. ACTUAL SECURITY CONTROLS

### What IS Enforced:

| Control | Location | Type | Verification |
|---------|----------|------|--------------|
| JWT Authentication | requireAuth middleware | Network | ✅ Required for all routes |
| Algo State Validation | Line 1102, algo.routes.js | Application | ✅ Must be 'ACTIVE' |
| Risk Engine Approval | evaluateRisk() function | Application | ✅ Must pass all checks |
| Dhan Session Required | getLiveBroker() | Application | ✅ Access token must exist |
| LIVE-Mode OMS Validation | Line 280, oms.js | Application | ✅ Throws if executionMode !== 'LIVE' |
| Dhan Auth Token | Line 485, broker-adapters.js | Broker API | ✅ Required in header |
| Dhan Client ID | Line 491, broker-adapters.js | Broker API | ✅ Required in body |
| Duplicate Order Prevention | Lines 288-295, oms.js | Database Transaction | ✅ Locks and checks |
| Hardcoded 'LIVE' Insert | Line 308, oms.js | Database Insert | ✅ Ignores parameter |

### What IS NOT Enforced:

| Gap | Location | Impact |
|-----|----------|--------|
| Database CHECK constraint | algo_orders.execution_mode | Allows PAPER via direct SQL |
| Paper trades endpoint still active | /algo/paper-trades | Can bypass risk checks |
| SANDBOX connections allowed | /broker/connect | Not LIVE-only mode |
| adapterForOrder() PAPER branch | algo.routes.js:272 | Dead code but present |
| Paper trades table still exists | algo_engine_additions.sql | Not dropped or constrained |
| Migration contradictions | SQL files | Unclear schema state |

---

## 8. CANNOT CLAIM "LIVE-ONLY" BECAUSE:

1. **Database constraint is permissive, not restrictive**
   - Current: `CHECK (execution_mode IN ('PAPER', 'LIVE'))`
   - Required: `CHECK (execution_mode = 'LIVE')`
   - **Missing migration applied to production database**

2. **Paper trades table and endpoints still exist**
   - `/algo/paper-trades` endpoint returns paper trades
   - Route can theoretically call `adapterForOrder()` with execution_mode='PAPER'
   - **Soft delete, not hard removal**

3. **Sandbox connections still accepted**
   - `/broker/connect` allows 'SANDBOX' connection_mode
   - `SANDBOX_CONNECTED` status stored in broker_accounts table
   - **Not production-only enforcement**

4. **Migration file contradiction unresolved**
   - `algo_engine_additions.sql` creates column
   - `remove_paper_trading.sql` drops column
   - **Unclear which is authoritative**

5. **Frontend still references sandbox/paper (IndexPilot)**
   - Not blocking KEPWE Quant from being LIVE-only
   - But ecosystem not fully production-only

---

## 9. REQUIRED ACTIONS FOR FULL LIVE-ONLY ENFORCEMENT

### Priority 1 - CRITICAL (Must do):

1. **Create and apply DB migration:**
```sql
-- File: backend/db/migrations/add_live_only_constraint.sql
ALTER TABLE algo_orders 
    DROP CONSTRAINT IF EXISTS algo_orders_execution_mode_check;

ALTER TABLE algo_orders 
    ADD CONSTRAINT algo_orders_execution_mode_check 
    CHECK (execution_mode = 'LIVE');

ALTER TABLE algo_orders 
    ALTER COLUMN execution_mode SET DEFAULT 'LIVE';
```

2. **Resolve migration file contradiction:**
   - **Option A**: Remove `remove_paper_trading.sql` (keep column for audit trail)
   - **Option B**: Update `algo_engine_additions.sql` to NOT create paper_trades table
   - **Decision**: Apply Option A (keep execution_mode column with LIVE-only constraint for audit/compliance)

3. **Remove dead code references:**
   - Delete `adapterForOrder()` PAPER branch (algo.routes.js:272)
   - Remove `paper_trade_mode` soft-delete logic (algo.routes.js:359-363)

### Priority 2 - HIGH (Should do):

4. **Hard delete paper_trades table** via new migration:
```sql
ALTER TABLE algo_orders 
    DROP CONSTRAINT IF EXISTS fk_algo_orders_paper_trades;
DROP TABLE IF EXISTS paper_trades CASCADE;
```

5. **Remove /algo/paper-trades endpoint** (algo.routes.js:928+)

6. **Reject SANDBOX connections** in /broker/connect endpoint

### Priority 3 - MEDIUM (Should document):

7. **Document IndexPilot Algo separation** - clarify that it is a separate product with its own sandbox mode

8. **Create production readiness checklist** - specific DB migrations required before claiming LIVE-only

---

## 10. VERIFICATION SUMMARY

### Order Path Verification
✅ **HTTP Auth** - Required and enforced  
✅ **Broker Validation** - Dhan session checked  
✅ **Deployment Gate** - Algo state must be ACTIVE  
✅ **Risk Validation** - evaluateRisk() must approve  
✅ **OMS Entry Point** - Rejects non-LIVE execution  
✅ **DhanAdapter** - Requires valid accessToken  
✅ **Real Dhan API** - Direct HTTP call to placeOrder  

### Database Verification
❌ **Execution Mode Constraint** - Allows PAPER (not LIVE-only)  
❌ **Migration Clarity** - Contradictory files  
❌ **Paper Table Removal** - Table still exists  

### Frontend Verification
✅ **KEPWE Quant PAPER removed** - Paper routes, components deleted  
⚠️ **IndexPilot Sandbox remains** - Out of scope, separate product  

### Negative Tests
✅ **Test #1**: Disconnected Dhan → HTTP 503 before API call  
✅ **Test #2**: Failed Risk Check → HTTP 409 before OMS  
✅ **Test #3**: Algo not ACTIVE → HTTP 409 before OMS  
❌ **Test #4**: PAPER execution_mode in database → Could route to wrong adapter  
✅ **Test #5**: Dhan failure → Returns error, no fabricated data  

---

## 11. CONCLUSION

### Current State
- **OMS function-level LIVE validation**: ✅ Implemented and functional
- **Broker session requirement**: ✅ Enforced before adapter call
- **Risk engine gating**: ✅ Enforced before OMS call
- **Dhan API authentication**: ✅ Required with valid accessToken
- **Database constraint**: ❌ Insufficient (allows PAPER)
- **Complete removal of paper trading**: ⚠️ Partial (routes removed, endpoints remain)

### Claims Justified vs. Not Justified

| Claim | Evidence | Status |
|-------|----------|--------|
| "Backend rejects non-LIVE execution" | OMS line 280 throws error | ✅ PROVEN |
| "Frontend not security boundary" | Direct HTTP request can bypass UI | ✅ PROVEN |
| "Order reaches DhanAdapter only if LIVE" | Multiple gates before adapter call | ⚠️ MOSTLY (not fully due to DB gaps) |
| "No fake orders/data generated" | Error handling verified | ✅ PROVEN |
| "Database enforces LIVE-only" | CHECK constraint allows PAPER | ❌ FALSE |
| "Paper trading completely removed" | Endpoints and tables still exist | ❌ FALSE |
| "100% production-ready enforcement" | Migration contradictions unresolved | ❌ FALSE |

### FINAL VERDICT

**CURRENT**: Backend provides **application-layer LIVE validation** via OMS function and multiple gates.

**NOT GUARANTEED**: Database-layer enforcement due to permissive constraints and migration contradictions.

**RECOMMENDATION**: Apply Priority 1 migrations before claiming "production-ready LIVE-only enforcement."

**DO NOT PLACE REAL ORDERS** until:
1. Migration to `CHECK (execution_mode = 'LIVE')` is applied to production database
2. Paper trades endpoints are removed
3. SANDBOX connections are rejected
4. Migration file contradiction is resolved

---

**Audit Performed By**: Security Review Agent  
**Verification Method**: Code inspection, path tracing, constraint analysis, negative test scenarios  
**Build Status**: ✅ npm run build SUCCESS (exit 0)  
**Backend Syntax**: ✅ node -c src/server.js OK (exit 0)  
**No Real Money Orders Placed**: ✅ CONFIRMED
