import { apiFetch } from './client';

// 1. Dashboard
export async function fetchLedgerDashboard(params = {}) {
  const query = new URLSearchParams();
  if (params.datePreset) query.set('datePreset', params.datePreset);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.chartInterval) query.set('chartInterval', params.chartInterval);

  const qs = query.toString();
  return apiFetch(`/ledger/dashboard${qs ? `?${qs}` : ''}`);
}

// 2. Accounts
export async function fetchLedgerAccounts() {
  return apiFetch('/ledger/accounts');
}

export async function createLedgerAccount(data) {
  return apiFetch('/ledger/accounts', { method: 'POST', body: data });
}

export async function updateLedgerAccount(accountId, data) {
  return apiFetch(`/ledger/accounts/${accountId}`, { method: 'PATCH', body: data });
}

export async function deleteLedgerAccount(accountId) {
  return apiFetch(`/ledger/accounts/${accountId}`, { method: 'DELETE' });
}

// 3. Transactions
export async function fetchLedgerTransactions(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.type) query.set('type', params.type);
  if (params.category) query.set('category', params.category);
  if (params.accountId) query.set('accountId', params.accountId);
  if (params.datePreset) query.set('datePreset', params.datePreset);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.counterparty) query.set('counterparty', params.counterparty);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);

  const qs = query.toString();
  return apiFetch(`/ledger/transactions${qs ? `?${qs}` : ''}`);
}

export async function createLedgerTransaction(data) {
  return apiFetch('/ledger/transactions', { method: 'POST', body: data });
}

export async function updateLedgerTransaction(transactionId, data) {
  return apiFetch(`/ledger/transactions/${transactionId}`, { method: 'PATCH', body: data });
}

export async function deleteLedgerTransaction(transactionId) {
  return apiFetch(`/ledger/transactions/${transactionId}`, { method: 'DELETE' });
}

// 4. Receivables (Invoices)
export async function fetchLedgerReceivables(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);

  const qs = query.toString();
  return apiFetch(`/ledger/receivables${qs ? `?${qs}` : ''}`);
}

export async function createLedgerReceivable(data) {
  return apiFetch('/ledger/receivables', { method: 'POST', body: data });
}

export async function recordReceivablePayment(invoiceId, data) {
  return apiFetch(`/ledger/receivables/${invoiceId}/payments`, { method: 'POST', body: data });
}

export async function deleteLedgerReceivable(invoiceId) {
  return apiFetch(`/ledger/receivables/${invoiceId}`, { method: 'DELETE' });
}

// 5. Payables (Vendor Bills)
export async function fetchLedgerPayables(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);

  const qs = query.toString();
  return apiFetch(`/ledger/payables${qs ? `?${qs}` : ''}`);
}

export async function createLedgerPayable(data) {
  return apiFetch('/ledger/payables', { method: 'POST', body: data });
}

export async function recordPayablePayment(billId, data) {
  return apiFetch(`/ledger/payables/${billId}/payments`, { method: 'POST', body: data });
}

export async function deleteLedgerPayable(billId) {
  return apiFetch(`/ledger/payables/${billId}`, { method: 'DELETE' });
}

// 6. Reports
export async function fetchLedgerReports(params = {}) {
  const query = new URLSearchParams();
  if (params.reportType) query.set('reportType', params.reportType);
  if (params.datePreset) query.set('datePreset', params.datePreset);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);

  const qs = query.toString();
  return apiFetch(`/ledger/reports${qs ? `?${qs}` : ''}`);
}

// 7. Categories & Settings
export async function fetchLedgerCategories() {
  return apiFetch('/ledger/categories');
}

export async function createLedgerCategory(data) {
  return apiFetch('/ledger/categories', { method: 'POST', body: data });
}

export async function fetchLedgerSettings() {
  return apiFetch('/ledger/settings');
}

export async function updateLedgerSettings(data) {
  return apiFetch('/ledger/settings', { method: 'PATCH', body: data });
}

// ═════════════════════════════════════════════════════════════════════════════
// ── V1 PRODUCTION ACCOUNTING & COMPLIANCE API CLIENTS ────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// Company Profile & Chart of Accounts
export async function fetchCompanyProfile() {
  return apiFetch('/v1/companies/profile');
}

export async function updateCompanyProfile(data) {
  return apiFetch('/v1/companies/profile', { method: 'PATCH', body: data });
}

export async function fetchChartOfAccounts() {
  return apiFetch('/v1/accounts');
}

export async function createChartOfAccount(data) {
  return apiFetch('/v1/accounts', { method: 'POST', body: data });
}

// Double-Entry Journals
export async function fetchJournals(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.referenceType) query.set('referenceType', params.referenceType);
  if (params.search) query.set('search', params.search);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  const qs = query.toString();
  return apiFetch(`/v1/journals${qs ? `?${qs}` : ''}`);
}

export async function postJournalEntry(data) {
  return apiFetch('/v1/journals', { method: 'POST', body: data });
}

export async function voidJournalEntry(id, reason) {
  return apiFetch(`/v1/journals/${id}/void`, { method: 'POST', body: { reason } });
}

// Financial Reports
export async function fetchGeneralLedger(accountId, params = {}) {
  const query = new URLSearchParams();
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  const qs = query.toString();
  return apiFetch(`/v1/ledger/${accountId}${qs ? `?${qs}` : ''}`);
}

export async function fetchTrialBalance(asOfDate) {
  const qs = asOfDate ? `?asOfDate=${asOfDate}` : '';
  return apiFetch(`/v1/trial-balance${qs}`);
}

export async function fetchProfitLossStatement(params = {}) {
  const query = new URLSearchParams();
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  const qs = query.toString();
  return apiFetch(`/v1/reports/profit-loss${qs ? `?${qs}` : ''}`);
}

export async function fetchBalanceSheetStatement(asOfDate) {
  const qs = asOfDate ? `?asOfDate=${asOfDate}` : '';
  return apiFetch(`/v1/reports/balance-sheet${qs}`);
}

export async function fetchCashFlowStatement(params = {}) {
  const query = new URLSearchParams();
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  const qs = query.toString();
  return apiFetch(`/v1/reports/cash-flow${qs ? `?${qs}` : ''}`);
}

// GST Engine & Returns
export async function calculateGst(data) {
  return apiFetch('/v1/gst/calculate', { method: 'POST', body: data });
}

export async function fetchGstr1(taxPeriod) {
  return apiFetch(`/v1/gst/returns/gstr-1?taxPeriod=${taxPeriod}`);
}

export async function fetchGstr3b(taxPeriod) {
  return apiFetch(`/v1/gst/returns/gstr-3b?taxPeriod=${taxPeriod}`);
}

export async function runGstReconciliation(data) {
  return apiFetch('/v1/gst/reconciliation/run', { method: 'POST', body: data });
}

export async function fetchGstReconciliationRecords() {
  return apiFetch('/v1/gst/reconciliation/records');
}

export async function importGstr2bFeed(data) {
  return apiFetch('/v1/gst/reconciliation/import-2b', { method: 'POST', body: data });
}

// E-Invoice & E-Way Bill
export async function generateIrn(data) {
  return apiFetch('/v1/gst/einvoice/irn', { method: 'POST', body: data });
}

export async function cancelIrn(data) {
  return apiFetch('/v1/gst/einvoice/cancel', { method: 'POST', body: data });
}

export async function generateEWayBill(data) {
  return apiFetch('/v1/gst/ewaybill/generate', { method: 'POST', body: data });
}

export async function cancelEWayBill(data) {
  return apiFetch('/v1/gst/ewaybill/cancel', { method: 'POST', body: data });
}

// TDS Engine
export async function fetchTdsRules() {
  return apiFetch('/v1/tds/rules');
}

export async function calculateTds(data) {
  return apiFetch('/v1/tds/calculate', { method: 'POST', body: data });
}

export async function fetchTdsTransactions(params = {}) {
  const query = new URLSearchParams();
  if (params.sectionCode) query.set('sectionCode', params.sectionCode);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return apiFetch(`/v1/tds/transactions${qs ? `?${qs}` : ''}`);
}

export async function recordTdsChallan(data) {
  return apiFetch('/v1/tds/challans', { method: 'POST', body: data });
}

export async function fetchTdsChallans() {
  return apiFetch('/v1/tds/challans');
}

export async function fetchForm26q(quarter) {
  return apiFetch(`/v1/tds/returns/form-26q?quarter=${quarter}`);
}

// Payroll
export async function fetchPayrollEmployees() {
  return apiFetch('/v1/payroll/employees');
}

export async function createPayrollEmployee(data) {
  return apiFetch('/v1/payroll/employees', { method: 'POST', body: data });
}

export async function executePayrollRun(data) {
  return apiFetch('/v1/payroll/runs', { method: 'POST', body: data });
}

export async function fetchPayrollRuns() {
  return apiFetch('/v1/payroll/runs');
}

export async function fetchPayslips(runId) {
  return apiFetch(`/v1/payroll/runs/${runId}/payslips`);
}

export async function disburseSalaries(runId, data) {
  return apiFetch(`/v1/payroll/runs/${runId}/disburse`, { method: 'POST', body: data });
}

// Bank Reconciliation
export async function importBankStatement(data) {
  return apiFetch('/v1/banks/statements/import', { method: 'POST', body: data });
}

export async function fetchBankStatements() {
  return apiFetch('/v1/banks/statements');
}

export async function fetchBankStatementLines(statementId) {
  return apiFetch(`/v1/banks/statements/${statementId}/lines`);
}

export async function matchBankLine(data) {
  return apiFetch('/v1/banks/reconciliation/match', { method: 'POST', body: data });
}

// Fixed Assets
export async function fetchFixedAssets() {
  return apiFetch('/v1/fixed-assets');
}

export async function createFixedAsset(data) {
  return apiFetch('/v1/fixed-assets', { method: 'POST', body: data });
}

export async function executeDepreciationRun(data) {
  return apiFetch('/v1/fixed-assets/depreciation/run', { method: 'POST', body: data });
}

export async function fetchDepreciationRuns() {
  return apiFetch('/v1/fixed-assets/depreciation/runs');
}

// Compliance Calendar
export async function fetchComplianceTasks(params = {}) {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return apiFetch(`/v1/compliance/tasks${qs ? `?${qs}` : ''}`);
}

export async function completeComplianceTask(taskId, data = {}) {
  return apiFetch(`/v1/compliance/tasks/${taskId}/complete`, { method: 'POST', body: data });
}

// Filing Preparation & Approval
export async function fetchFilingPreparations() {
  return apiFetch('/v1/filing-prep');
}

export async function createFilingDraft(data) {
  return apiFetch('/v1/filing-prep/draft', { method: 'POST', body: data });
}

export async function approveFiling(filingId, data) {
  return apiFetch(`/v1/filing-prep/${filingId}/approve`, { method: 'POST', body: data });
}

export async function submitFiling(filingId) {
  return apiFetch(`/v1/filing-prep/${filingId}/submit`, { method: 'POST' });
}

// Integrations & Audit Trail
export async function fetchIntegrationsStatus() {
  return apiFetch('/v1/integrations/status');
}

export async function testIntegration(providerKey) {
  return apiFetch(`/v1/integrations/${providerKey}/test`, { method: 'POST' });
}

export async function fetchAuditTrail(params = {}) {
  const query = new URLSearchParams();
  if (params.entityType) query.set('entityType', params.entityType);
  if (params.action) query.set('action', params.action);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  const qs = query.toString();
  return apiFetch(`/v1/audit${qs ? `?${qs}` : ''}`);
}

