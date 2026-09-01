# KEPWE Findings — Fake Data, Integration Points, and Blockers

## 1. Fake / Mock / Hardcoded Data Locations Found

| Location | Data | Must be replaced by |
|---|---|---|
| `src/data/mockData.ts` | `MOCK_INDICES`, `MOCK_OPTION_CHAIN`, `MOCK_STRATEGIES`, `MOCK_CRM_LEADS`, `MOCK_FOLLOWUPS`, `MOCK_CUSTOMER_TASKS`, `MOCK_CUSTOMER_DOCUMENTS` | API responses |
| `src/context/AppContext.jsx` L46-49 | `tradeJournal` hardcoded entries | `GET /api/trade-journal` |
| `src/context/AppContext.jsx` L73-90 | `onboardingChecklist` 13 hardcoded items | `GET /api/checklist` |
| `src/context/AppContext.jsx` L99-109 | `subscription` + `billingHistory` | `GET /api/subscription` |
| `src/context/AppContext.jsx` L36-44 | `userRiskProfile` defaults | `GET /api/risk-profile` |
| `src/context/AppContext.jsx` L54-66 | `alertsConfig` | `GET /api/alerts/config` |
| `src/context/AppContext.jsx` L14-19 | `login()` accepts any email/password | `POST /api/auth/login` |
| `src/context/AppContext.jsx` L21-25 | `signup()` no real account | `POST /api/auth/register` |
| `src/pages/LoginPage.jsx` L228 | "DEMO - any email + password works" bar | Remove |
| `src/pages/SignupPage.jsx` L150 | "DEMO MODE - No real data collected" bar | Remove |
| `src/pages/business/FounderDashboardPage.jsx` L5-18 | `JOURNEY_STAGES` 12 hardcoded stages | `GET /api/admin/founder-dashboard/summary` |
| `src/pages/business/FounderDashboardPage.jsx` L20-25 | `PRODUCT_MIX` hardcoded | API |
| `src/pages/business/FounderDashboardPage.jsx` L169-181 | Sales team performance hardcoded | API |
| `src/pages/business/SalesCRMPage.jsx` L92-114 | KPI cards 6000/1850/420/120/21 hardcoded | API `kpis` |
| `src/pages/business/SalesCRMPage.jsx` L33 | `cadenceSteps = MOCK_FOLLOWUPS` | `GET /api/workflow/cadence` |
| `src/pages/business/CustomerPortalPage.jsx` L81 | "Good Morning, Harshad" + company hardcoded | `GET /api/portal/profile` |
| `src/pages/business/CustomerPortalPage.jsx` L108-144 | Health snapshot hardcoded | `GET /api/portal/snapshot` |
| `src/pages/business/FreeComplianceCheckPage.jsx` L46 | `actualScore = 78` hardcoded | `POST /api/compliance-check` |
| `src/pages/business/FreeComplianceCheckPage.jsx` L464-492 | GST/TDS/MCA/Payroll status cards hardcoded | API response |
| `src/pages/business/FreeComplianceCheckPage.jsx` L149-167 | Lead created in AppContext | `POST /api/compliance-check` |
| `src/pages/business/CustomerOnboardingChecklistPage.jsx` L36-48 | status cycling demo | `PATCH /api/checklist/:itemId` |
| `src/pages/business/CustomerOnboardingChecklistPage.jsx` L191 | "Cycle demo status" button | Remove |
| `src/pages/ContactPage.jsx` L35-48 | Lead added to AppContext | `POST /api/contact` |
| `src/pages/business/BusinessOnboardingPage.jsx` L5-13 | `PACKAGES` hardcoded | `GET /api/plans` |
| `src/pages/indexpilot/AppDashboardPage.jsx` L33 | "DEMO - DELAYED 15 MIN" | `GET /api/market/indices` |
| `src/pages/indexpilot/AppChainPage.jsx` L61-75 | DEMO badge, hardcoded spot/MAX PAIN/PCR | `GET /api/market/option-chain` |
| `src/pages/indexpilot/AppSetupsPage.jsx` L75 | DEMO badge | `GET /api/market/strategies` |
| `src/pages/indexpilot/AppShieldPage.jsx` L53 | "Simulate Circuit Breaker" | Portfolio API (later) |
| `src/pages/indexpilot/AppShieldPage.jsx` L112-177 | Rs 18,600 / Rs 4,82,000 / -4.1% hardcoded | Portfolio API (later) |
| `src/pages/indexpilot/AppDeskPage.jsx` L86-146 | Pre-trade checklist hardcoded | Contract/market API |
| `src/pages/indexpilot/AppAlertsReportsAccount.jsx` L360-366 | `REPORTS` hardcoded | `GET /api/reports` |
| `src/pages/indexpilot/AppAlertsReportsAccount.jsx` L589-594 | `PLANS` hardcoded | `GET /api/plans` |
| `src/pages/indexpilot/AppAlertsReportsAccount.jsx` L905 | risk profile hardcoded display | `GET /api/risk-profile` |
| `src/pages/indexpilot/AppAlertsReportsAccount.jsx` L1001 | plan upgrade grid | `GET /api/plans` |
| `src/pages/indexpilot/StrategyDetailPage.jsx` L10-190 | `STRATEGY_DETAIL_DATA` hardcoded | Strategy API |
| `src/components/layout/AppNav.jsx` | nav links | static (no change) |
| `src/pages/indexpilot/MarketingHomePage.jsx` | marketing content | static (no change) |

---

## 2. Frontend Files Requiring API Integration

| File | API Endpoints Needed |
|---|---|
| `src/context/AppContext.jsx` | `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/checklist`, `PATCH /api/checklist/:itemId`, `GET /api/leads`, `POST /api/leads`, `PATCH /api/leads/:leadId`, `GET /api/risk-profile`, `PUT /api/risk-profile`, `GET /api/trade-journal`, `POST /api/trade-journal`, `GET /api/alerts/config`, `PUT /api/alerts/config`, `GET /api/paper-trade`, `PATCH /api/paper-trade`, `GET /api/subscription`, `PATCH /api/subscription`, `POST /api/subscription/delete-request`, `GET /api/portal/tasks`, `GET /api/portal/documents`, `POST /api/portal/documents`, `GET /api/workflow/cadence` |
| `src/pages/LoginPage.jsx` | `POST /api/auth/login` - replace demo login |
| `src/pages/SignupPage.jsx` | `POST /api/auth/register` - replace demo signup |
| `src/pages/business/FreeComplianceCheckPage.jsx` | `POST /api/compliance-check` |
| `src/pages/business/SalesCRMPage.jsx` | `GET /api/leads`, `PATCH /api/leads/:leadId`, `GET /api/workflow/cadence`, `PATCH /api/workflow/cadence/:stepId`, `POST /api/workflow/cadence/:stepId/test` |
| `src/pages/business/CustomerPortalPage.jsx` | `GET /api/portal/profile`, `GET /api/portal/snapshot`, `GET /api/portal/tasks`, `GET /api/portal/documents`, `POST /api/portal/documents` |
| `src/pages/business/CustomerOnboardingChecklistPage.jsx` | `GET /api/checklist`, `PATCH /api/checklist/:itemId`, `POST /api/checklist/:itemId/documents` |
| `src/pages/business/FounderDashboardPage.jsx` | `GET /api/admin/founder-dashboard/summary` |
| `src/pages/business/BusinessOnboardingPage.jsx` | `GET /api/plans`, `POST /api/business-onboarding` |
| `src/pages/ContactPage.jsx` | `POST /api/contact` |
| `src/pages/indexpilot/AppOnboardingPage.jsx` | `PUT /api/risk-profile` |
| `src/pages/indexpilot/AppDashboardPage.jsx` | `GET /api/market/indices` |
| `src/pages/indexpilot/AppChainPage.jsx` | `GET /api/market/option-chain` |
| `src/pages/indexpilot/AppSetupsPage.jsx` | `GET /api/market/strategies`, `POST /api/trade-journal` |
| `src/pages/indexpilot/AppDeskPage.jsx` | `GET /api/trade-journal`, `GET /api/paper-trade`, `PATCH /api/paper-trade` |
| `src/pages/indexpilot/AppAlertsReportsAccount.jsx` | `GET/PUT /api/alerts/config`, `GET /api/subscription`, `PATCH /api/subscription`, `POST /api/subscription/delete-request`, `GET /api/reports`, `GET /api/plans`, `GET /api/risk-profile`, `PUT /api/risk-profile` |
| `src/pages/indexpilot/AppShieldPage.jsx` | Portfolio data API (future) |
| `src/pages/indexpilot/StrategyDetailPage.jsx` | Strategy detail API |
| `src/pages/indexpilot/KepweIQPage.jsx` | `GET /api/market/indices` |

---

## 3. Blockers / Ambiguities Discovered

1. **Backend integration document not found as a file** — the document the user referenced is not present in the working directory as a standalone file. Requirements were followed from the task description (auth login/register, checklist PATCH, CRM POST leads, contact, free compliance check).

2. **IndexPilot market data is external** — `MOCK_INDICES`, `MOCK_OPTION_CHAIN`, `MOCK_STRATEGIES` are market-data-derived and cannot live in PostgreSQL. They require a market data provider (broker API / NSE feed) or a data ingestion job. The schema therefore does **not** create market tables; these are external integration endpoints (`/api/market/*`) marked for a later phase.

3. **Founder Dashboard aggregates** — the 12-stage journey, funnel KPIs, sales team table, and product mix are analytical rollups. They can be computed via SQL `GROUP BY` over `crm_leads` + `subscriptions` + `billing_history`, but some stages map to externally imported incorporation feeds.

4. **Portfolio/Shield module** — `AppShieldPage` shows portfolio values, positions, and hedging that are not in the current backend scope. This requires a broker-API integration and is deferred.

5. **`VITE_API_BASE_URL` mismatch** — `.env` sets the Vite dev server URL. Backend proxy should serve `/api` on the same origin (Vite `server.proxy`) so no CORS setup is needed in dev.

6. **File storage for documents** — `customer_documents.file_path` is stored in PostgreSQL. Actual binary files go to local disk / S3-compatible storage; only metadata lives in the DB.

7. **`Login.jsx` and `LoginPage.jsx` duplication** — two login files exist. Only `LoginPage.jsx` is routed. `Login.jsx` + `Login.css` appear orphaned and should be removed.

8. **Report PDFs** — `GET /api/reports` plan-gating requires actual PDF storage. Files belong in object storage; DB stores paths.

9. **Public inserts** — RLS policies allow anonymous inserts into `contact_submissions`, `crm_leads`, and `compliance_checks`. Must be paired with rate limiting + CAPTCHA in the API layer.

10. **No backend dependency in root `package.json`** — the project only defines the frontend. A `backend/package.json` is needed and must NOT share the Vite build.

---

## 4. Next Steps (Implementation Phase 2)

1. Create `backend/package.json` with Express/Fastify + deps
2. Implement `db/migrate.js` to apply `schema.sql` + `seed.sql` against `DATABASE_URL`
3. Implement auth routes (register/login/refresh/logout/me)
4. Implement RLS middleware helper `setRLSContext`
5. Implement checklist, leads, contact, compliance endpoints
6. Implement portal endpoints (tasks, documents, snapshot)
7. Implement IndexPilot endpoints (risk profile, journal, alerts, paper-trade, subscription)
8. Implement admin founder-dashboard aggregate endpoint
9. Add Vite proxy `/api` -> backend in `vite.config.js`
10. Replace AppContext demo functions with `fetch` calls to the backend