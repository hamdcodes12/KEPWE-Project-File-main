# KEPWE Backend API Specification

Base URL (dev): `http://localhost:5173/api` (via Vite proxy to backend running on `http://localhost:3001`)
Base URL (production): `/api` relative to whatever domain the single Render service is deployed on (e.g. `https://kepwe-app.onrender.com/api`) — frontend and backend are served from the same origin, so no absolute URL is ever needed in application code.

Auth: `Authorization: Bearer <access_token>` for all protected routes.

---

## 1. AUTH

### POST /api/auth/register
Creates a new user account.

**Request:**
```json
{
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "password": "password123"
}
```

**Response 201:**
```json
{
  "success": true,
  "user": { "id": "uuid", "name": "Rahul Sharma", "email": "rahul@example.com", "plan": "Free Trial" },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

**Validation:** name ≥ 2 chars, valid email, password ≥ 8 chars.

---

### POST /api/auth/login
Authenticates an existing user.

**Request:**
```json
{
  "email": "rahul@example.com",
  "password": "password123",
  "rememberMe": true
}
```

**Response 200:**
```json
{
  "success": true,
  "user": { "id": "uuid", "name": "Rahul Sharma", "email": "rahul@example.com", "plan": "Pro" },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

**Errors:** 401 invalid credentials.

---

### POST /api/auth/refresh
Exchange an unexpired refresh token for new access/refresh tokens.

**Request:**
```json
{ "refreshToken": "jwt..." }
```

**Response 200:**
```json
{ "accessToken": "jwt...", "refreshToken": "jwt..." }
```

---

### POST /api/auth/logout
Revokes the current refresh session.

**Request:**
```json
{ "refreshToken": "jwt..." }
```

---

### GET /api/auth/me
Returns the authenticated user's profile + subscription.

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Rahul Sharma",
  "email": "rahul@example.com",
  "plan": "Pro",
  "role": "customer",
  "subscription": {
    "id": "uuid",
    "plan": "Pro",
    "displayName": "IndexPilot Pro",
    "price": 999,
    "renewsOn": "2026-09-10",
    "paymentMethod": "UPI"
  }
}
```

---

## 2. ONBOARDING CHECKLIST

### GET /api/checklist
Returns the onboarding checklist template + the current user's company items.

**Response 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "category": "Company Information",
      "title": "Incorporation documents (COI/MOA/AOA)",
      "status": "Verified",
      "note": "COI-2024-88492 verified on 02 Aug"
    }
  ],
  "progress": { "total": 13, "verified": 7, "uploaded": 4 }
}
```

---

### PATCH /api/checklist/:itemId
Updates the status of a checklist item for the current user's company.

**Path params:** `itemId` — the `company_checklist_items.id` (UUID)

**Request:**
```json
{ "status": "Uploaded", "note": "GST certificate uploaded" }
```

**Allowed statuses:** `Pending` | `Uploaded` | `Verified` | `Action Required`

**Response 200:**
```json
{
  "id": "uuid",
  "status": "Uploaded",
  "note": "GST certificate uploaded",
  "updatedAt": "2026-08-19T02:00:00Z"
}
```

---

### POST /api/checklist/:itemId/documents
Uploads a document and marks the checklist item as Uploaded (multipart/form-data).

**Request (multipart):**
- `file` — the document file
- `name` — display filename

---

## 3. CRM LEADS

### GET /api/leads
Returns all CRM leads (staff only).

**Query params:** `score=HOT|WARM|COLD`, `status=New|Called|Connected|Interested|Converted`

**Response 200:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "companyName": "ABC Technologies Pvt Ltd",
      "contactName": "Rahul Sharma",
      "mobile": "+91 98765 43210",
      "email": "rahul@abctech.in",
      "cin": "U72200MH2026PTC384920",
      "gstin": "27AABCA1234H1Z5",
      "incorporationDate": "2026-08-05",
      "industry": "IT Services",
      "state": "Maharashtra",
      "gstStatus": "Active",
      "leadScore": "HOT",
      "leadSource": "New Incorporation Database",
      "salesActivity": ["Call 1 — No Answer", "Call 2 — Interested"],
      "assignedExecutive": "Agent 1 (Vikram)",
      "status": "Interested"
    }
  ],
  "kpis": { "new": 6000, "called": 1850, "connected": 420, "interested": 120, "converted": 21 }
}
```

---

### POST /api/leads
Creates a new CRM lead (from Contact Page, Free Compliance Check, or manual).

**Request:**
```json
{
  "companyName": "Apex Global Logistics LLP",
  "contactName": "Priya Mehta",
  "mobile": "+91 98111 22334",
  "email": "priya@apexlogistics.com",
  "cin": "AAB-9821",
  "gstin": "07AAFFA9988G1Z2",
  "industry": "Exporters / Freight",
  "state": "Delhi",
  "leadScore": "HOT",
  "leadSource": "Free Compliance Check Form"
}
```

**Response 201:** The created lead object.

---

### PATCH /api/leads/:leadId
Updates lead status/score (Advance Lead button, staff only).

**Request:**
```json
{ "status": "Interested", "leadScore": "HOT" }
```

---

### GET /api/leads/:leadId/activities
Returns the sales activity log.

---

### POST /api/leads/:leadId/activities
Adds an activity entry.

**Request:**
```json
{ "activity": "Call 3 — Demo Scheduled" }
```

---

## 4. FOLLOW-UP CADENCE WORKFLOW

### GET /api/workflow/cadence
Returns the automated follow-up steps (Day 0 → Day 30).

**Response 200:**
```json
{
  "steps": [
    { "day": "Day 0", "channel": "WhatsApp/SMS", "message": "Your free compliance assessment is ready." }
  ]
}
```

---

### PATCH /api/workflow/cadence/:stepId
Updates a workflow step (staff only).

---

### POST /api/workflow/cadence/:stepId/test
Simulates a workflow step trigger (demo).

---

## 5. FREE COMPLIANCE CHECK

### POST /api/compliance-check
Submits the full Free Compliance Check wizard and creates:
1. A `compliance_checks` record with the generated health score
2. (Optionally) a linked `crm_leads` record

**Request:**
```json
{
  "companyName": "Apex Innovators Pvt Ltd",
  "cin": "U72900MH2026PTC99881",
  "gstin": "27AAACB9988F1Z2",
  "businessType": "Private Limited",
  "industry": "Technology / Software",
  "state": "Maharashtra",
  "avgMonthlyTurnover": "₹5–25L",
  "contactName": "Rahul Sharma",
  "contactMobile": "+91 98765 43210",
  "contactEmail": "rahul@example.com"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "overallScore": 78,
  "gstStatus": "Good",
  "tdsStatus": "Attention",
  "mcaStatus": "Good",
  "payrollStatus": "Action Required",
  "issuesFound": 4,
  "recommendations": ["..."]
}
```

---

## 6. CONTACT PAGE

### POST /api/contact
Submits the "Request Free CA Callback" form.

**Request:**
```json
{
  "name": "Rahul Sharma",
  "company": "Apex Technologies",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "requirement": "GST & Accounting"
}
```

**Response 201:** `{ "id": "uuid", "status": "New" }`

---

## 7. CUSTOMER PORTAL

### GET /api/portal/snapshot
Returns the Business Health Snapshot (GST/TDS/MCA/Accounting/Payroll/Support).

**Response 200:**
```json
{
  "metrics": [
    { "label": "GST", "status": "On Track", "subtext": "Next: 12 Aug" },
    { "label": "TDS", "status": "On Track", "subtext": "Next: 07 Sep" }
  ],
  "company": { "name": "Apex Technologies Pvt Ltd" }
}
```

---

### GET /api/portal/tasks
Returns the compliance calendar tasks for the user's company.

**Response 200:**
```json
{
  "tasks": [
    { "id": "uuid", "category": "GST", "title": "GSTR-1 Sales Return Filing", "dueDate": "2026-08-12", "status": "Upcoming" }
  ]
}
```

---

### GET /api/portal/documents
Returns the document vault contents.

---

### POST /api/portal/documents
Uploads a document (multipart/form-data).

---

### GET /api/portal/profile
Returns company + team + contact info for the customer portal header.

---

## 8. BUSINESS ONBOARDING

### POST /api/business-onboarding
Saves the BusinessOnboardingPage wizard answers and recommended plan.

**Request:**
```json
{
  "businessType": "Private Limited",
  "businessAge": "< 3 months",
  "avgMonthlyTurnover": "Pre-revenue",
  "needs": ["GST & Tax", "Accounting"]
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "recommendedPlan": { "name": "Essential", "price": 2999 }
}
```

---

## 9. INDEXPILOT — RISK PROFILE

### GET /api/risk-profile
Returns the current user's risk profile.

**Response 200:**
```json
{
  "experience": "Intermediate",
  "capitalRange": "₹1L–5L",
  "capitalAmount": 150000,
  "maxAcceptableLoss": 2500,
  "indices": ["NIFTY", "BANKNIFTY"],
  "riskCategory": "Balanced",
  "onboardingComplete": false
}
```

---

### PUT /api/risk-profile
Updates the risk profile (AppOnboardingPage final step, AppAccountPage edit).

---

## 10. INDEXPILOT — TRADE JOURNAL

### GET /api/trade-journal
Returns the user's trade journal entries.

---

### POST /api/trade-journal
Adds a trade journal entry (Override logged from AppSetupsPage).

**Request:**
```json
{
  "index": "NIFTY",
  "strategy": "Aggressive Call Ratio Spread",
  "verdict": "NO_TRADE",
  "isOverride": true,
  "overrideReason": "User overridden risk limit cap of ₹2500",
  "status": "Overridden"
}
```

---

## 11. INDEXPILOT — ALERTS

### GET /api/alerts/config
Returns the user's alert configuration.

---

### PUT /api/alerts/config
Saves alert preferences.

**Request:**
```json
{
  "verdictChanges": true,
  "riskLimitBreach": true,
  "eventRisk": true,
  "newMatchingSetup": true,
  "volatilitySpike": true,
  "minuteByMinutePrice": false,
  "promotional": false,
  "channels": { "push": true, "email": true, "sms": false },
  "quietHoursEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00"
}
```

---

## 12. INDEXPILOT — PAPER TRADE / DESK

### GET /api/paper-trade
Returns paper trade mode + simulated capital.

---

### PATCH /api/paper-trade
Toggles paper trade mode / updates simulated capital.

---

## 13. SUBSCRIPTION & BILLING

### GET /api/subscription
Returns the user's active subscription + billing history.

**Response 200:**
```json
{
  "plan": "Pro",
  "displayName": "IndexPilot Pro",
  "price": 999,
  "renewsOn": "2026-09-10",
  "paymentMethod": "UPI",
  "billingHistory": [
    { "id": "inv-001", "date": "2026-08-10", "amount": 999, "status": "Paid", "plan": "Pro" }
  ]
}
```

---

### PATCH /api/subscription
Upgrades/downgrades plan.

**Request:**
```json
{ "plan": "Pro+", "price": 2499 }
```

---

### POST /api/subscription/delete-request
Requests account data deletion per DPDP Act.

---

## 14. NOTIFICATIONS

### GET /api/notifications
Returns the current user's notifications.

---

### PATCH /api/notifications/:id/read
Marks a notification as read.

---

## 15. REPORTS (IndexPilot)

### GET /api/reports
Returns the available weekly/monthly strategy reports (with plan-gating).

**Response 200:**
```json
{
  "reports": [
    {
      "id": "uuid",
      "title": "Weekly Index Regime Report — Aug W2 2026",
      "date": "2026-08-11",
      "plan": "Pro",
      "status": "Unlocked",
      "url": "/api/reports/uuid/file.pdf"
    }
  ]
}
```

---

## 16. ADMIN / STAFF — FOUNDER DASHBOARD

### GET /api/admin/founder-dashboard/summary
Returns the 12-stage journey KPIs, acquisition funnel, and sales team performance.

**Response 200:**
```json
{
  "journeyStages": [
    { "stage": "New Company", "count": 10000, "conv": "100%", "status": "Moat Data Feed" }
  ],
  "funnel": { "leads": 6000, "calls": 2500, "connected": 600, "interested": 180, "customers": 35 },
  "salesTeam": [
    { "name": "Amit V.", "calls": 180, "connected": 45, "converted": 5 }
  ],
  "productMix": [
    { "name": "Launch Plan (₹1,499/mo)", "pct": 40 }
  ]
}
```

**Authorization:** `admin` / `sales_agent` role only.

---

## 17. MARKET DATA (IndexPilot — optional external integration)

### GET /api/market/indices
Returns live/delayed index data (NIFTY, BANKNIFTY, FINNIFTY).

### GET /api/market/option-chain?symbol=NIFTY&expiry=28AUG2026
Returns the option chain for a symbol/expiry.

### GET /api/market/strategies?symbol=NIFTY&maxLoss=2500&view=Bullish
Returns risk-filtered strategy setups.

These endpoints would be backed by a market-data provider (e.g., broker API / NSE feed) and are **not** backed by PostgreSQL `market_*` tables — they are external data integrations to be implemented in a later phase.