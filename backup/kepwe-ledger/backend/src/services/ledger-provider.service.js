import crypto from 'crypto';
import XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';

const timeoutMs = Number(process.env.LEDGER_PROVIDER_TIMEOUT_MS || 15000);

function configured(...values) { return values.every((value) => String(value || '').trim()); }
function notConfigured(provider) {
  const error = new Error('Integration not configured');
  error.statusCode = 412;
  error.code = `${provider}_NOT_CONFIGURED`;
  return error;
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Provider request failed (${response.status})`);
      error.statusCode = response.status >= 500 ? 503 : 400;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') { error.statusCode = 504; error.message = 'Provider request timed out'; }
    throw error;
  } finally { clearTimeout(timer); }
}

function baseUrl(name, fallback) { return String(process.env[`${name}_BASE_URL`] || fallback).replace(/\/$/, ''); }

function idspayHeaders() {
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'x-api-key': process.env.IDSPAY_API_KEY, Authorization: `Bearer ${process.env.IDSPAY_API_KEY}` };
}

export function idspayStatus() {
  return { provider: 'IDSPAY', configured: configured(process.env.IDSPAY_API_KEY, process.env.IDSPAY_BASE_URL), message: configured(process.env.IDSPAY_API_KEY, process.env.IDSPAY_BASE_URL) ? 'Configured' : 'Integration not configured' };
}

async function idspayAction(action, payload) {
  if (!configured(process.env.IDSPAY_API_KEY, process.env.IDSPAY_BASE_URL)) throw notConfigured('IDSPAY');
  const paths = {
    bankAccountVerification: '/bank-account/verify', pennyDrop: '/bank-account/penny-drop',
    ifscVerification: '/ifsc/verify', upiVerification: '/upi/verify', statement: '/bank-statement/fetch',
    transactions: '/bank-account/transactions', balance: '/bank-account/balance'
  };
  return request(`${baseUrl('IDSPAY', '')}${process.env[`IDSPAY_${action.toUpperCase()}_PATH`] || paths[action]}`, { method: 'POST', headers: idspayHeaders(), body: JSON.stringify(payload) });
}

export const verifyBankAccount = (payload) => idspayAction('bankAccountVerification', payload);
export const verifyPennyDrop = (payload) => idspayAction('pennyDrop', payload);
export const verifyIfsc = (payload) => idspayAction('ifscVerification', payload);
export const verifyUpi = (payload) => idspayAction('upiVerification', payload);
export const fetchIdspayStatement = (payload) => idspayAction('statement', payload);
export const fetchIdspayTransactions = (payload) => idspayAction('transactions', payload);
export const fetchIdspayBalance = (payload) => idspayAction('balance', payload);

function razorpayAuth() { return `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`; }
function cashfreeHeaders() { return { 'Content-Type': 'application/json', Accept: 'application/json', 'x-client-id': process.env.CASHFREE_APP_ID, 'x-client-secret': process.env.CASHFREE_SECRET_KEY, 'x-api-version': process.env.CASHFREE_API_VERSION || '2023-08-01' }; }
function paymentConfig(provider) {
  if (provider === 'RAZORPAY' && configured(process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET)) return { base: baseUrl('RAZORPAY', 'https://api.razorpay.com/v1'), headers: { Authorization: razorpayAuth(), 'Content-Type': 'application/json' } };
  if (provider === 'CASHFREE' && configured(process.env.CASHFREE_APP_ID, process.env.CASHFREE_SECRET_KEY)) return { base: baseUrl('CASHFREE', 'https://api.cashfree.com/pg'), headers: cashfreeHeaders() };
  throw notConfigured(provider);
}

export async function createProviderPayment(provider, payload) {
  const key = provider.toUpperCase(); const config = paymentConfig(key);
  const amount = Number(payload.amount);
  if (!(amount > 0)) throw new Error('Payment amount must be greater than zero.');
  if (key === 'RAZORPAY') return request(`${config.base}/orders`, { method: 'POST', headers: config.headers, body: JSON.stringify({ amount: Math.round(amount * 100), currency: payload.currency || 'INR', receipt: payload.receipt, notes: payload.metadata || {} }) });
  return request(`${config.base}/orders`, { method: 'POST', headers: config.headers, body: JSON.stringify({ order_amount: amount, order_currency: payload.currency || 'INR', order_id: payload.orderId || `kepwe_${crypto.randomUUID()}`, customer_details: payload.customerDetails, order_meta: payload.orderMeta, order_note: payload.note }) });
}

export async function createPaymentLink(provider, payload) {
  const key = provider.toUpperCase(); const config = paymentConfig(key);
  if (key === 'RAZORPAY') return request(`${config.base}/payment_links`, { method: 'POST', headers: config.headers, body: JSON.stringify({ amount: Math.round(Number(payload.amount) * 100), currency: payload.currency || 'INR', description: payload.description, customer: payload.customer, notify: payload.notify || { sms: false, email: false }, notes: payload.metadata || {} }) });
  return request(`${config.base}/links`, { method: 'POST', headers: config.headers, body: JSON.stringify({ link_id: payload.linkId || `kepwe_${crypto.randomUUID()}`, link_amount: Number(payload.amount), link_currency: payload.currency || 'INR', link_purpose: payload.description || 'KEPWE Ledger payment', customer_details: payload.customerDetails }) });
}

export async function getPaymentStatus(provider, paymentId, orderId) {
  const key = provider.toUpperCase(); const config = paymentConfig(key);
  const path = key === 'RAZORPAY' ? `/payments/${encodeURIComponent(paymentId)}` : `/orders/${encodeURIComponent(orderId || paymentId)}`;
  return request(`${config.base}${path}`, { headers: config.headers });
}

export async function createRefund(provider, paymentId, payload) {
  const key = provider.toUpperCase(); const config = paymentConfig(key);
  const body = key === 'RAZORPAY' ? { amount: Math.round(Number(payload.amount) * 100), notes: payload.notes || {} } : { refund_amount: Number(payload.amount), refund_id: payload.refundId || `refund_${crypto.randomUUID()}`, refund_note: payload.reason || 'Ledger refund' };
  const path = key === 'RAZORPAY' ? `/payments/${encodeURIComponent(paymentId)}/refund` : `/orders/${encodeURIComponent(payload.orderId)}/refunds`;
  return request(`${config.base}${path}`, { method: 'POST', headers: config.headers, body: JSON.stringify(body) });
}

export async function getRefundStatus(provider, refundId) {
  const key = provider.toUpperCase(); const config = paymentConfig(key);
  const path = key === 'RAZORPAY' ? `/refunds/${encodeURIComponent(refundId)}` : `/refunds/${encodeURIComponent(refundId)}`;
  return request(`${config.base}${path}`, { headers: config.headers });
}

export async function listSettlements(provider, from, to) {
  const key = provider.toUpperCase(); const config = paymentConfig(key);
  const query = from || to ? `?from=${encodeURIComponent(from || '')}&to=${encodeURIComponent(to || '')}` : '';
  return request(`${config.base}${key === 'RAZORPAY' ? '/settlements' : '/settlements'}${query}`, { headers: config.headers });
}

function parseDelimited(text) {
  const rows = []; let current = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { field += '"'; index += 1; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { current.push(field.trim()); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; current.push(field.trim()); rows.push(current); current = []; field = ''; }
    else field += char;
  }
  if (field || current.length) { current.push(field.trim()); rows.push(current); }
  if (rows.length < 2) return [];
  const headers = rows.shift().map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return rows.filter((row) => row.some(Boolean)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

function numberValue(value) { const parsed = Number(String(value || '').replace(/[,₹\s]/g, '')); return Number.isFinite(parsed) ? parsed : 0; }
function normalizeParsedRow(row) {
  const value = (names) => names.map((name) => row[name]).find((item) => item !== undefined && item !== '');
  const debit = numberValue(value(['debit', 'withdrawal', 'withdrawalamount', 'debitamount']));
  const credit = numberValue(value(['credit', 'deposit', 'depositamount', 'creditamount']));
  const amount = numberValue(value(['amount', 'transactionamount']));
  const finalDebit = debit || (String(value(['type', 'transactiontype']) || '').toLowerCase().includes('debit') ? amount : 0);
  const finalCredit = credit || (String(value(['type', 'transactiontype']) || '').toLowerCase().includes('credit') ? amount : 0);
  return { transactionDate: value(['date', 'transactiondate', 'valuedate']), description: value(['description', 'narration', 'particulars']) || '', referenceNumber: value(['reference', 'referencenumber', 'refno', 'utr']) || '', debit: finalDebit, credit: finalCredit, runningBalance: numberValue(value(['balance', 'runningbalance'])) || null, bank: value(['bank', 'bankname']) || '' };
}

export async function parseStatementFile({ fileName, mimeType, base64 }) {
  const buffer = Buffer.from(base64, 'base64'); const lower = fileName.toLowerCase();
  let rawRows;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } else if (mimeType === 'text/csv' || lower.endsWith('.csv')) {
    rawRows = parseDelimited(buffer.toString('utf8'));
  } else if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    const parsed = await new PDFParse({ data: buffer }).getText();
    rawRows = parseDelimited(parsed.text.replace(/\t/g, ','));
  } else throw new Error('Unsupported statement file type. Upload CSV, XLSX, XLS, or PDF.');
  const rows = rawRows.map(normalizeParsedRow).filter((row) => row.transactionDate && (row.debit > 0 || row.credit > 0));
  if (!rows.length) throw new Error('No transaction rows could be extracted from the statement.');
  return { fileName, fileType: lower.endsWith('.pdf') ? 'PDF' : lower.endsWith('.csv') ? 'CSV' : 'XLSX', rows };
}