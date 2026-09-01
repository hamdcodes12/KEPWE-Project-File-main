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
