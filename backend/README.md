# KEPWE Backend Implementation Report

## 1. Backend Architecture

### Stack
- **Frontend (existing):** React 18 + Vite 5 + React Router 6 (SPA) — no backend code today
- **Database:** PostgreSQL (existing `DATABASE_URL` in `.env` — Railway-hosted instance)
- **Recommended backend:** Node.js + Express or Fastify, with:
  - `pg` (node-postgres) or `pg-pool` — PostgreSQL driver
  - `bcrypt` / `argon2` — password hashing
  - `jsonwebtoken` — JWT access tokens
  - `crypto` — refresh token generation
  - `multer` — file uploads (documents)
  - `helmet`, `cors`, `express-rate-limit` — security
  - `zod` or `joi` — request validation
  - `pino` — logging

### Folder Layout (planned)
```
backend/
├── db/
│   ├── schema.sql      ✔ created
│   ├── seed.sql        ✔ created
│   └── migrate.js      (apply schema + seed)
├── src/
│   ├── server.js
│   ├── app.js
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── rls.js          (sets app.current_user_id)
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── checklist.routes.js
│   │   ├── leads.routes.js
│   │   ├── compliance.routes.js
│   │   ├── contact.routes.js
│   │   ├── portal.routes.js
│   │   ├── onboarding.routes.js
│   │   ├── riskProfile.routes.js
│   │   ├── tradeJournal.routes.js
│   │   ├── alerts.routes.js
│   │   ├── paperTrade.routes.js
│   │   ├── subscription.routes.js
│   │   └── admin.routes.js
│   └── services/
│       ├── auth.service.js
│       ├── compliance.service.js (score engine)
│       └── market.service.js    (external market feed, later)
├── API.md            ✔ created
└── README.md         (this file)
```

### How RLS is enforced
Every backend request authenticates the user from the JWT, then executes `SET LOCAL app.current_user_id = '<uuid>'` on the connection (via `pg` transaction wrapper) before the query. PostgreSQL Row Level Security policies use this setting to filter rows. This guarantees — at the database layer — that one user can never read/write another user's private data, even if a bug exists in an API handler.

---

## 2. Database Tables Created (23 tables)

| Table | Purpose |
|---|---|
| `users` | Auth, profile, role, plan |
| `user_sessions` | Refresh-token sessions |
| `companies` | Business entities for portal/CRM |
| `company_members` | User ↔ company membership (owner flag) |
| `plans` | Subscription plan reference data |
| `subscriptions` | User's active subscription |
| `billing_history` | Invoice/charge history |
| `onboarding_checklist_items` | Checklist template (13 items) |
| `company_checklist_items` | Per-company item status |
| `customer_documents` | Document vault + uploads |
| `crm_leads` | Sales CRM leads |
| `lead_activities` | Per-lead activity log |
| `lead_followup_cadences` | Workflow steps (Day 0-30) |
| `compliance_checks` | Free Compliance Check submissions + scores |
| `contact_submissions` | Contact page submissions |
| `customer_tasks` | Compliance calendar/tasks |
| `risk_profiles` | IndexPilot user risk profile |
| `trade_journals` | Trade journal / override log |
| `alert_configs` | Notification preferences |
| `notifications` | In-app notifications |
| `data_deletion_requests` | DPDP deletion requests |
| `paper_trade_settings` | Paper/live trade mode |
| `business_onboardings` | Business onboarding wizard answers |

---

## 3. Table Relationships

```
users 1-N user_sessions
users 1-1 risk_profiles
users 1-N trade_journals
users 1-1 alert_configs
users 1-N notifications
users 1-1 paper_trade_settings
users 1-N data_deletion_requests
users 1-N business_onboardings
users 1-1 subscriptions 1-N billing_history
subscriptions N-1 plans

companies 1-N company_members N-1 users
companies 1-N company_checklist_items N-1 onboarding_checklist_items
companies 1-N customer_documents N-1 users (uploaded_by)
companies 1-N customer_tasks
companies 1-N compliance_checks
companies 1-N business_onboardings

crm_leads N-1 users (assigned_executive)
crm_leads N-1 companies
crm_leads 1-N lead_activities
crm_leads 1-N compliance_checks (lead_id)
contact_submissions N-1 crm_leads (lead_id)
```

---

## 4. Complete API Endpoint List (45 endpoints)

| # | Method | Endpoint | Auth | Purpose |
|---|---|---|---|---|
| 1 | POST | `/api/auth/register` | Public | Signup |
| 2 | POST | `/api/auth/login` | Public | Login |
| 3 | POST | `/api/auth/refresh` | Public | Refresh tokens |
| 4 | POST | `/api/auth/logout` | Auth | Logout |
| 5 | GET | `/api/auth/me` | Auth | Profile + subscription |
| 6 | GET | `/api/checklist` | Auth | Onboarding checklist |
| 7 | PATCH | `/api/checklist/:itemId` | Auth | Update checklist status |
| 8 | POST | `/api/checklist/:itemId/documents` | Auth | Upload checklist doc |
| 9 | GET | `/api/leads` | Staff | List CRM leads |
| 10 | POST | `/api/leads` | Public/Auth | Create lead |
| 11 | PATCH | `/api/leads/:leadId` | Staff | Update lead status/score |
| 12 | GET | `/api/leads/:leadId/activities` | Staff | Lead activity log |
| 13 | POST | `/api/leads/:leadId/activities` | Staff | Add activity |
| 14 | GET | `/api/workflow/cadence` | Auth | Follow-up steps |
| 15 | PATCH | `/api/workflow/cadence/:stepId` | Staff | Edit step |
| 16 | POST | `/api/workflow/cadence/:stepId/test` | Staff | Simulate trigger |
| 17 | POST | `/api/compliance-check` | Public | Submit compliance wizard |
| 18 | POST | `/api/contact` | Public | Contact form |
| 19 | GET | `/api/portal/snapshot` | Auth | Portal health snapshot |
| 20 | GET | `/api/portal/tasks` | Auth | Customer tasks |
| 21 | GET | `/api/portal/documents` | Auth | Document vault list |
| 22 | POST | `/api/portal/documents` | Auth | Upload document |
| 23 | GET | `/api/portal/profile` | Auth | Portal company/team |
| 24 | POST | `/api/business-onboarding` | Auth | Save onboarding answers |
| 25 | GET | `/api/risk-profile` | Auth | Get risk profile |
| 26 | PUT | `/api/risk-profile` | Auth | Update risk profile |
| 27 | GET | `/api/trade-journal` | Auth | Journal entries |
| 28 | POST | `/api/trade-journal` | Auth | Add journal entry |
| 29 | GET | `/api/alerts/config` | Auth | Get alert config |
| 30 | PUT | `/api/alerts/config` | Auth | Save alert config |
| 31 | GET | `/api/paper-trade` | Auth | Paper/live mode + capital |
| 32 | PATCH | `/api/paper-trade` | Auth | Toggle mode/capital |
| 33 | GET | `/api/subscription` | Auth | Subscription + billing history |
| 34 | PATCH | `/api/subscription` | Auth | Upgrade/downgrade |
| 35 | POST | `/api/subscription/delete-request` | Auth | DPDP delete request |
| 36 | GET | `/api/notifications` | Auth | List notifications |
| 37 | PATCH | `/api/notifications/:id/read` | Auth | Read notification |
| 38 | GET | `/api/reports` | Auth | List reports (plan-gated) |
| 39 | GET | `/api/admin/founder-dashboard/summary` | Staff | Founder KPI dashboard |
| 40 | GET | `/api/market/indices` | Public | Market index data (external feed) |
| 41 | GET | `/api/market/option-chain` | Public | Option chain (external feed) |
| 42 | GET | `/api/market/strategies` | Auth | Risk-filtered strategies (external) |
| 43 | GET | `/api/plans` | Public | Plan list (reference) |
| 44 | GET | `/api/checklist/template` | Auth | Checklist template only |
| 45 | GET | `/api/companies` | Auth | User's companies |

---

## 5. Authentication Strategy

- **Register:** `bcrypt` hashes password -> create `users` row -> auto-create `risk_profiles`, `alert_configs`, `paper_trade_settings`, and default `subscription` (Free Trial) rows -> issue short-lived JWT access token (15 min) + opaque refresh token (30 days, stored hashed in `user_sessions`).
- **Login:** verify email + bcrypt password -> issue tokens -> set `remember_me` (30-day vs 24-hour session expiry).
- **Refresh:** verify refresh token against `user_sessions` (not revoked, not expired) -> issue new token pair (rotation).
- **Logout:** revoke refresh session.
- **Session management:** `user_sessions` table tracks device/agent/IP/expiry for multi-device support and revocation.
- **`GET /api/auth/me`** is called on app boot to restore session state from a persisted refresh token.

---

## 6. Authorization Strategy

Two layers:

**Layer 1 - API middleware (`requireAuth`, `requireStaff`):**
- `requireAuth` validates JWT, loads user, sets `req.user`
- `requireStaff` checks `role IN ('admin','sales_agent','accountant','cfo')`
- `requireAdmin` checks `role = 'admin'`

**Layer 2 - PostgreSQL Row Level Security (schema.sql):**
| Scope | Policy |
|---|---|
| user-owned tables | `user_id = app.current_user_id` |
| company-scoped tables | `is_company_member(company_id) OR is_staff()` |
| compliance_checks | creator OR company member OR staff |
| crm_leads | staff OR creator; public insert allowed |
| contact_submissions | staff select; public insert allowed |
| reference tables | read for all authenticated |

RLS guarantees data isolation at the database layer even if API middleware is bypassed.