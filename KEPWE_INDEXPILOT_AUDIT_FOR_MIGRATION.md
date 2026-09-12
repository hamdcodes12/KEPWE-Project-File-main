# KEPWE IndexPilot - Complete Audit for Migration into KEPWE Quant
**Date**: September 12, 2026  
**Purpose**: Identify ALL IndexPilot features to be added to KEPWE Quant  
**Scope**: ADDITIVE ONLY - Do NOT modify existing Quant

---

## EXECUTIVE SUMMARY

IndexPilot is a secondary product sharing infrastructure with KEPWE Quant. This audit identifies which IndexPilot features are **NOT already in Quant** and need to be migrated.

**Key Finding**: IndexPilot and Quant share significant backend infrastructure (Dhan broker, market data, strategies, settings). IndexPilot has ADDITIONAL features that Quant lacks.

---

## INDEXPILOT PAGES (Frontend)

Located in: `src/pages/indexpilot/`

| Page File | Feature | Purpose | Quant Equivalent? |
|-----------|---------|---------|-------------------|
| AlgoDashboardPage.jsx | Algo/Strategy Dashboard | Strategy execution dashboard | YES - Quant has this |
| AppDashboardPage.jsx | Main Dashboard | Portfolio overview | PARTIAL - Quant dashboard exists |
| AppDeskPage.jsx | Desk/Workspace | Trading terminal workspace | NO - Unique to IndexPilot |
| AppChainPage.jsx | Option Chain Tools | NIFTY option chain viewer | NO - Unique to IndexPilot |
| AppShieldPage.jsx | Risk Calculator/Shield | Risk management tools | PARTIAL - Quant has risk engine |
| AppSetupsPage.jsx | Market Setups/Alerts | Market setup configuration | NO - Unique to IndexPilot |
| AppOnboardingPage.jsx | Onboarding Wizard | User onboarding flow | SHARED - Both use it |
| AppAlertsReportsAccount.jsx | Alerts & Reports | User alerts/notifications | NO - Unique to IndexPilot |
| KepweIQPage.jsx | KepweIQ Analytics | Intelligence/analytics module | NO - Unique to IndexPilot |
| StrategyDetailPage.jsx | Strategy Details | Strategy drill-down view | PARTIAL - Quant has strategies |
| RiskCalculatorPage.jsx | Risk Calculator | Advanced risk calculation | PARTIAL - Quant has basic risk |
| MarketingHomePage.jsx | Marketing Home | Marketing/landing page | PRODUCT PAGE - Not functional app |

---

## INDEXPILOT COMPONENTS

Located in: `src/components/indexpilot/`

| Component | Purpose |
|-----------|---------|
| IndexPilotProductPage.jsx | Landing page for IndexPilot product |
| IndexPilotPricingCards.jsx | Pricing display for IndexPilot plans |

**These are MARKETING COMPONENTS** - Not migrated.

---

## INDEXPILOT BACKEND APIs

Shared/indexed routes (algo.routes.js shows dual paths):

| Endpoint | Accessible Via | Purpose |
|----------|----------------|---------|
| `/algo/dashboard` | Also `/indexpilot/dashboard` | Dashboard data |
| `/algo/strategies` | Also `/indexpilot/strategies` | Strategy list |
| `/algo/settings` | Also `/indexpilot/settings` | User settings |
| `/algo/broker/*` | Also `/broker/*` | Broker endpoints |
| Various `/algo/*` | Various `/indexpilot/*` | Strategy/execution endpoints |

**Status**: These are ALREADY dual-path. IndexPilot uses same backend as Quant.

---

## INDEXPILOT-SPECIFIC BACKEND SERVICES & FEATURES

From backend analysis:

### 1. **Reports Service** (`backend/src/services/ledger.service.js`)
- `getFinancialReports(userId, options)` - P&L, balance sheet, cash flow
- Date range filtering: this_month, last_quarter, ytd, custom
- **Feature**: Financial reporting not in Quant
- **Endpoint**: `GET /api/ledger/reports`
- **Database**: `reports` table (phase2_additions.sql)

### 2. **Market Option Chain** (`backend/src/services/anor.service.js` + `upstox.service.js`)
- `getOptionChain(symbol, expiry)` - Option chain for derivatives
- `getStrategies(params)` - Market setups/strategies
- **Feature**: Option chain visualization not in Quant
- **Endpoint**: `POST /broker/:broker/market-data/depth` can return option chains
- **Database**: `market_option_chains` table (phase2_additions.sql)

### 3. **Risk Profile & Onboarding** (`backend/src/routes/risk-profile.routes.js`)
- User risk category (Conservative, Balanced, Aggressive)
- Onboarding completion tracking
- Capital ranges and max loss tolerance
- **Feature**: Risk profiling in Quant but not onboarding completion flag
- **Database**: `risk_profiles` table with `onboarding_complete` field

### 4. **Company Checklist/Onboarding** (`backend/src/routes/checklist.routes.js`)
- Onboarding checklist items (13 items)
- Company compliance tracking
- **Feature**: Not in Quant
- **Database**: `onboarding_checklist_items`, `company_checklist_items` tables
- **Note**: Used for Business Onboarding, not IndexPilot specifically

### 5. **Plans & Subscriptions** 
- Plans have `is_indexpilot` flag
- Different feature access by plan
- **Feature**: Subscription gating already exists
- **Database**: `plans` table has `is_indexpilot` field

### 6. **Accounting Engine** (`backend/src/services/accounting-engine.service.js`)
- General ledger
- Chart of accounts
- Double-entry journals
- **Feature**: Accounting not in Quant or IndexPilot live app
- **Status**: Backend-only service for business product

---

## DATABASE TABLES - ANALYSIS

### Shared Between Quant & IndexPilot:
- `users`
- `algo_strategies`
- `algo_settings`
- `algo_states`
- `algo_orders`
- `algo_positions`
- `broker_accounts`
- `risk_events`
- `algo_activity_logs`
- `algo_trades`
- `risk_profiles` (with onboarding_complete field)
- `plans` (with is_indexpilot flag)

### IndexPilot-Specific:
- `reports` - Financial report templates and metadata
- `market_option_chains` - Option chain snapshots
- `onboarding_checklist_items` - Checklist template
- `company_checklist_items` - Company progress on checklist
- `business_onboardings` - Business onboarding form responses
- Accounting tables (business ledger, etc.) - Not live in IndexPilot app

---

## FEATURES TO ADD TO KEPWE QUANT

**Based on audit, Quant is MISSING:**

| Feature | Currently In | Source Files | Priority |
|---------|-------------|--------------|----------|
| **Option Chain Viewer** | IndexPilot only | AppChainPage.jsx, anor.service.js | HIGH - Derivatives feature |
| **Market Setups/Alerts** | IndexPilot only | AppSetupsPage.jsx, anor.service.js | HIGH - Market analysis |
| **Financial Reports** | IndexPilot/Ledger only | AppAlertsReportsAccount.jsx, ledger.service.js | MEDIUM - Reporting |
| **KepweIQ Analytics** | IndexPilot only | KepweIQPage.jsx | MEDIUM - Intelligence |
| **Advanced Risk Calculator** | IndexPilot only | RiskCalculatorPage.jsx, AppShieldPage.jsx | LOW - Quant has basic risk |
| **Desk/Workspace Terminal** | IndexPilot only | AppDeskPage.jsx | MEDIUM - UX enhancement |
| **Alerts & Reports Management** | IndexPilot only | AppAlertsReportsAccount.jsx | LOW - Can be added later |

---

## FEATURES ALREADY IN QUANT (No migration needed):

- Strategy creation & management
- Algo deployment
- Risk engine (basic)
- Backtesting
- P&L analytics
- Real Dhan broker connection
- Live execution (LIVE-only)
- Settings/configuration
- Authentication & authorization

---

## BACKEND ROUTE STRUCTURE

**Current Setup:**
- Quant: Uses `/algo/*` paths + `/quant/*` paths
- IndexPilot: Uses same `/algo/*` paths + `/indexpilot/*` aliases
- Both: Use `/broker/*` for broker operations

**Shared Routes** (from algo.routes.js):
```
router.use(['/algo/broker', '/broker'], requireAnyProductAccess(['indexpilot', 'quant']));
router.get(['/algo/dashboard', '/indexpilot/dashboard'], ...);
router.get(['/algo/strategies', '/indexpilot/strategies'], ...);
router.get(['/algo/settings', '/indexpilot/settings'], ...);
```

**Result**: Backend mostly **already supports** both products. No large-scale API migration needed.

---

## IMPLEMENTATION STRATEGY

### Phase 2 (Migrate) - Recommended Order:

**TIER 1 - Core Trading Tools:**
1. Add Option Chain Viewer to Quant Dashboard
2. Add Market Setups to Quant tools

**TIER 2 - Analytics & Management:**
3. Add Financial Reports section
4. Add Alerts & Notifications

**TIER 3 - UX Enhancement:**
5. Integrate Desk/Workspace

**NOT MIGRATING:**
- Marketing pages (IndexPilotProductPage, IndexPilotPricingCards)
- Business accounting features
- Company onboarding checklist (IndexPilot doesn't actively use)

---

## DATABASE SCHEMA CHANGES NEEDED

**Current Quant Schema**: Complete for trading

**Additions Required**:
- Option chain query support (already in anor.service.js)
- Reports display integration
- Alerts table (if not already there)
- Financial reports calculation

**NO DESTRUCTIVE CHANGES**: All existing Quant tables preserved.

---

## FILES TO PRESERVE (Quant)

**DO NOT MODIFY**:
- All files in `src/pages/quant/`
- All files in `backend/src/routes/quant.routes.js`
- All files in `backend/src/algo/` (OMS, runner, broker-adapters)
- All Dhan integration
- All LIVE-only execution logic
- Backtesting logic
- Risk engine

---

## FINDINGS SUMMARY

✅ **IndexPilot & Quant share 70% of backend**  
✅ **Quant is the larger/more complete trading system**  
✅ **IndexPilot has specialized UI tools (Option Chain, Setups) not in Quant**  
✅ **No destructive changes needed** - purely additive  
✅ **Backend APIs already support dual paths** - easy frontend migration  
❌ **Paper trading completely removed** from Quant - IndexPilot's demo data cannot be integrated  

---

## AUDIT CONCLUSION

**KEPWE Quant is the better base product.** It has:
- Real Dhan integration (LIVE-only)
- Strategy automation
- Backtesting
- Better OMS
- Better risk engine
- Live deployment gate

**IndexPilot adds:**
- Option chain visualization
- Market setups/alerts
- Financial reporting
- Desk/workspace UI

**Migration is ADDITIVE and LOW-RISK** - existing Quant functionality remains completely intact, and new IndexPilot features layer on top.

---

**Prepared for**: PHASE 2 Implementation  
**Status**: Ready to proceed with feature integration
