# KEPWE Ledger — Government & Provider Integration Setup Guide

This guide explains how to connect and configure external government and financial provider APIs for **KEPWE Ledger** (NIC E-Invoice, NIC E-Way Bill, GST Portal / GSP, TRACES / NSDL TDS, and Bank Account Aggregators).

---

## 1. Integration Architecture Overview

KEPWE Ledger is built with an **adapter-based, provider-agnostic integration layer**.
All business logic (double-entry journals, GST calculations, GSTR-3B tax offset rules, TDS deductions, payroll, bank matching) operates independently of external credentials.

```
KEPWE Accounting Engine
       │
  Filing & Tax Preparation (Draft -> Validation -> CA/User Approval)
       │
  IntegrationManager
  ├── EInvoiceProviderAdapter   ──> NIC E-Invoice Portal / GSP
  ├── EWayBillProviderAdapter   ──> NIC E-Way Bill Portal
  ├── GSTProviderAdapter        ──> GSTN Common Portal (GSP API)
  ├── TDSProviderAdapter        ──> NSDL / TRACES System
  └── BankProviderAdapter       ──> Account Aggregator / Bank API
```

Until credentials are provided, all adapters remain in the **`CREDENTIALS_REQUIRED`** state.
**No dummy or fabricated success responses are ever returned.**

---

## 2. Required Environment Variables

To configure any provider, simply add the corresponding environment variables to your `.env` file in the project root (or set them in your Render / deployment environment secrets). **You do not need to modify any application source code.**

### A. E-Invoice Provider (NIC / GSP API v1.03)

| Environment Variable | Description | Sandbox Example | Production Example |
|---|---|---|---|
| `EINVOICE_ENV` | Environment mode | `sandbox` | `production` |
| `EINVOICE_BASE_URL` | Base API Endpoint | `https://einv-apisandbox.nic.in/eivp/v1.03` | `https://einvoice1.gst.gov.in/api` |
| `EINVOICE_CLIENT_ID` | GSP Client ID / App Key | `gsp_sandbox_client_id` | `gsp_live_client_id` |
| `EINVOICE_CLIENT_SECRET` | GSP Client Secret | `gsp_sandbox_secret` | `gsp_live_secret` |
| `EINVOICE_USERNAME` | Taxpayer Portal Username | `taxpayer_test_user` | `taxpayer_prod_user` |
| `EINVOICE_PASSWORD` | Taxpayer Portal Password | `taxpayer_test_pass` | `taxpayer_prod_pass` |
| `EINVOICE_TIMEOUT_MS` | Request timeout in milliseconds | `10000` | `10000` |

### B. E-Way Bill Provider (NIC E-Way Bill API v1.03)

| Environment Variable | Description | Sandbox Example | Production Example |
|---|---|---|---|
| `EWAYBILL_ENV` | Environment mode | `sandbox` | `production` |
| `EWAYBILL_BASE_URL` | Base API Endpoint | `https://ewb.nic.in/api/sandbox` | `https://ewaybillgst.gov.in/api` |
| `EWAYBILL_CLIENT_ID` | GSP Client ID / App Key | `ewb_sandbox_client_id` | `ewb_live_client_id` |
| `EWAYBILL_CLIENT_SECRET`| GSP Client Secret | `ewb_sandbox_secret` | `ewb_live_secret` |
| `EWAYBILL_USERNAME` | Transporter / Taxpayer User | `ewb_test_user` | `ewb_prod_user` |
| `EWAYBILL_PASSWORD` | Transporter / Taxpayer Pass | `ewb_test_pass` | `ewb_prod_pass` |

### C. GST Returns & GSP Provider (GSTN API v0.3)

| Environment Variable | Description | Sandbox Example | Production Example |
|---|---|---|---|
| `GST_ENV` | Environment mode | `sandbox` | `production` |
| `GST_BASE_URL` | GSP Endpoint | `https://api.gsp.nic.in/taxpayerapi/v0.3` | `https://api.gst.gov.in/taxpayerapi/v0.3` |
| `GST_CLIENT_ID` | GSP Client ID | `gsp_client_key` | `gsp_client_key_prod` |
| `GST_CLIENT_SECRET` | GSP Client Secret | `gsp_client_secret` | `gsp_client_secret_prod` |
| `GST_USERNAME` | GSTN Authorized Signatory User | `gstn_user` | `gstn_user` |
| `GST_STATE_CODE` | 2-Digit State Code | `27` | `27` |

### D. TDS & TRACES Portal (NSDL / Income Tax Form 26Q)

| Environment Variable | Description | Sandbox Example | Production Example |
|---|---|---|---|
| `TDS_ENV` | Environment mode | `sandbox` | `production` |
| `TDS_BASE_URL` | Base API Endpoint | `https://traces.gov.in/api/sandbox` | `https://traces.gov.in/api` |
| `TDS_CLIENT_ID` | API Client ID | `traces_client_id` | `traces_client_id` |
| `TDS_CLIENT_SECRET` | API Client Secret | `traces_secret` | `traces_secret` |
| `TDS_TAN` | 10-Character Tax Deduction Account Number | `MUMB12345D` | `MUMB12345D` |

### E. Bank Account Aggregator & Statements

| Environment Variable | Description | Sandbox Example | Production Example |
|---|---|---|---|
| `BANK_AGGREGATOR_ENV` | Environment mode | `sandbox` | `production` |
| `BANK_AGGREGATOR_BASE_URL` | Account Aggregator Endpoint | `https://api.accountaggregator.in/sandbox` | `https://api.accountaggregator.in/v1` |
| `BANK_AGGREGATOR_CLIENT_ID`| AA Client ID | `aa_client_id` | `aa_client_id` |
| `BANK_AGGREGATOR_SECRET` | AA Secret | `aa_secret` | `aa_secret` |

---

## 3. Step-by-Step Connection Process

When you obtain your real credentials from NIC, your chosen GSP (ClearTax, Masters India, Adaequare, Cygnet, etc.), or your bank:

### Step 1: Add Credentials to `.env`
Open your `.env` file and paste the credentials under the respective section. For example:
```bash
EINVOICE_ENV=sandbox
EINVOICE_CLIENT_ID=your_real_client_id
EINVOICE_CLIENT_SECRET=your_real_secret
EINVOICE_USERNAME=your_real_username
EINVOICE_PASSWORD=your_real_password
```

### Step 2: Test Provider Connection
You can test the connection via the UI or by calling the health check API:
```bash
# Test E-Invoice connection
curl -X POST http://localhost:3001/api/v1/integrations/EINVOICE/test \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```
Or via the frontend:
1. Navigate to **Integrations** in the Ledger Command Center.
2. Locate the **NIC E-Invoice System** card.
3. Click **"Test Connection"**.
4. The system validates credentials with the provider and displays **"Connected (Sandbox)"** or the exact provider error.

### Step 3: Test IRN & E-Way Bill Generation in Sandbox
Create a test invoice in the **Invoices** view and click **"Generate IRN"**.
The adapter will:
1. Normalize the invoice into NIC JSON Schema v1.03.
2. Sign and transmit to the sandbox IRP.
3. Save the returned 64-character IRN, Ack No, and Signed QR Code to the database.

### Step 4: Switch to Production
Once sandbox validation succeeds:
1. Update `EINVOICE_ENV=production` in `.env`.
2. Replace sandbox credentials with your production GSP credentials.
3. Restart the backend service.
4. Run the connection test once to verify production authorization.

---

## 4. Responsible Modules in Codebase

| Component | File Path |
|---|---|
| Base Adapter Interface | `backend/src/integrations/base-provider-adapter.js` |
| E-Invoice Adapter | `backend/src/integrations/einvoice-adapter.js` |
| E-Way Bill Adapter | `backend/src/integrations/ewaybill-adapter.js` |
| Integration Registry | `backend/src/integrations/integration-manager.js` |
| Integration API Endpoints | `backend/src/routes/v1/ledger-v1.routes.js` |
| Frontend Integrations UI | `src/components/ledger/IntegrationsView.jsx` |
