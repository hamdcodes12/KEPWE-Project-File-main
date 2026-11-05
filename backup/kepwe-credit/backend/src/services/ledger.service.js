import { pool, hasDb } from '../config/db.js';
import crypto from 'crypto';
import { formatDateOnly } from '../lib/date-utils.js';
import { assertLedgerLimit } from './ledger-subscription.service.js';

// ── Helper: Safe Currency Rounding ──────────────────────────────────────────
export function roundMoney(val) {
  const num = Number(val) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// ── Helper: Date Range Calculator ───────────────────────────────────────────
export function getDateRangeBounds(preset = 'this_month', customFrom = null, customTo = null) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'this_week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case 'this_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999);
      break;
    }
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case 'custom':
      if (customFrom) start = new Date(customFrom + 'T00:00:00');
      if (customTo) end = new Date(customTo + 'T23:59:59.999');
      break;
    case 'all':
    default:
      start = new Date(2000, 0, 1);
      end = new Date(2099, 11, 31, 23, 59, 59, 999);
      break;
  }

  return {
    startStr: start.toISOString().split('T')[0],
    endStr: end.toISOString().split('T')[0],
    startDate: start,
    endDate: end,
  };
}

// ── AUDIT LOG HELPER ────────────────────────────────────────────────────────
async function recordAuditLog(userId, action, entityType, entityId, details) {
  try {
    await pool.query(
      `INSERT INTO ledger_audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, entityType, entityId, JSON.stringify(details || {})]
    );
  } catch (err) {
    console.warn('[ledger:audit] DB audit write failed:', err.message);
  }
}

// ============================================================================
// 1. ACCOUNTS SERVICE
// ============================================================================
export async function getAccounts(userId) {
  const res = await pool.query(
    `SELECT a.*,
            COALESCE((
              SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount
                              WHEN t.type = 'expense' THEN -t.amount
                              ELSE 0 END)
              FROM ledger_transactions t
              WHERE t.account_id = a.id AND t.user_id = $1 AND t.status = 'completed'
            ), 0) + a.opening_balance AS computed_balance
     FROM ledger_accounts a
     WHERE a.user_id = $1 AND a.is_active = TRUE
     ORDER BY a.is_default DESC, a.created_at ASC`,
    [userId]
  );
  return res.rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    accountNumber: row.account_number,
    bankName: row.bank_name,
    ifscCode: row.ifsc_code,
    upiId: row.upi_id,
    openingBalance: roundMoney(row.opening_balance),
    currentBalance: roundMoney(row.computed_balance),
    currency: row.currency,
    isDefault: row.is_default,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

export async function createAccount(userId, data) {
  const openingBalance = roundMoney(data.openingBalance || 0);
  const accountId = crypto.randomUUID();
  const accountType = data.type || 'Bank Account';
  const client = await pool.connect();
  let row;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (accountType === 'Bank Account') {
      const count = await client.query(
        `SELECT COUNT(*)::int AS count FROM ledger_accounts
         WHERE user_id = $1 AND type = 'Bank Account' AND is_active = TRUE`,
        [userId]
      );
      await assertLedgerLimit(userId, 'bank_accounts', count.rows[0].count, client);
    }
    if (data.isDefault) {
      await client.query(`UPDATE ledger_accounts SET is_default = FALSE WHERE user_id = $1`, [userId]);
    }
    const res = await client.query(
      `INSERT INTO ledger_accounts
         (id, user_id, name, type, account_number, bank_name, ifsc_code, upi_id, opening_balance, current_balance, currency, is_default, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        accountId,
        userId,
        data.name,
        accountType,
        data.accountNumber || null,
        data.bankName || null,
        data.ifscCode || null,
        data.upiId || null,
        openingBalance,
        openingBalance,
        data.currency || 'INR',
        Boolean(data.isDefault),
        data.notes || null,
      ]
    );
    row = res.rows[0];
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await recordAuditLog(userId, 'CREATE', 'ACCOUNT', accountId, { name: data.name });
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    accountNumber: row.account_number,
    bankName: row.bank_name,
    ifscCode: row.ifsc_code,
    upiId: row.upi_id,
    openingBalance: roundMoney(row.opening_balance),
    currentBalance: roundMoney(row.current_balance),
    currency: row.currency,
    isDefault: row.is_default,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function updateAccount(userId, accountId, data) {
  if (data.isDefault) {
    await pool.query(`UPDATE ledger_accounts SET is_default = FALSE WHERE user_id = $1`, [userId]);
  }
  const updates = [];
  const params = [userId, accountId];
  let idx = 3;

  if (data.name !== undefined) { updates.push(`name = $${idx++}`); params.push(data.name); }
  if (data.type !== undefined) { updates.push(`type = $${idx++}`); params.push(data.type); }
  if (data.accountNumber !== undefined) { updates.push(`account_number = $${idx++}`); params.push(data.accountNumber); }
  if (data.bankName !== undefined) { updates.push(`bank_name = $${idx++}`); params.push(data.bankName); }
  if (data.ifscCode !== undefined) { updates.push(`ifsc_code = $${idx++}`); params.push(data.ifscCode); }
  if (data.upiId !== undefined) { updates.push(`upi_id = $${idx++}`); params.push(data.upiId); }
  if (data.openingBalance !== undefined) { updates.push(`opening_balance = $${idx++}`); params.push(roundMoney(data.openingBalance)); }
  if (data.isDefault !== undefined) { updates.push(`is_default = $${idx++}`); params.push(Boolean(data.isDefault)); }
  if (data.notes !== undefined) { updates.push(`notes = $${idx++}`); params.push(data.notes); }
  updates.push(`updated_at = NOW()`);

  const res = await pool.query(
    `UPDATE ledger_accounts SET ${updates.join(', ')} WHERE user_id = $1 AND id = $2 RETURNING *`,
    params
  );
  if (res.rows.length === 0) return null;
  await recordAuditLog(userId, 'UPDATE', 'ACCOUNT', accountId, data);
  return getAccounts(userId).then((list) => list.find((a) => a.id === accountId));
}

export async function deleteAccount(userId, accountId) {
  const res = await pool.query(
    `UPDATE ledger_accounts SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1 AND id = $2 RETURNING id`,
    [userId, accountId]
  );
  if (res.rows.length > 0) {
    await recordAuditLog(userId, 'DELETE', 'ACCOUNT', accountId, {});
    return true;
  }
  return false;
}

// ============================================================================
// 2. TRANSACTIONS SERVICE
// ============================================================================
export async function getTransactions(userId, filters = {}) {
  const {
    search = '',
    type = '',
    category = '',
    accountId = '',
    datePreset = 'all',
    dateFrom = '',
    dateTo = '',
    counterparty = '',
    page = 1,
    limit = 50,
    sortBy = 'date',
    sortOrder = 'desc',
  } = filters;

  const { startStr, endStr } = getDateRangeBounds(datePreset, dateFrom, dateTo);

  const params = [userId];
  const where = ['t.user_id = $1'];

  if (startStr && datePreset !== 'all') {
    params.push(startStr);
    where.push(`t.transaction_date >= $${params.length}`);
  }
  if (endStr && datePreset !== 'all') {
    params.push(endStr);
    where.push(`t.transaction_date <= $${params.length}`);
  }
  if (type && ['income', 'expense', 'transfer'].includes(type)) {
    params.push(type);
    where.push(`t.type = $${params.length}`);
  }
  if (category) {
    params.push(category);
    where.push(`t.category = $${params.length}`);
  }
  if (accountId) {
    params.push(accountId);
    where.push(`t.account_id = $${params.length}`);
  }
  if (counterparty) {
    params.push(`%${counterparty}%`);
    where.push(`t.counterparty ILIKE $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(t.description ILIKE $${params.length} OR t.counterparty ILIKE $${params.length} OR t.reference_number ILIKE $${params.length} OR t.category ILIKE $${params.length})`
    );
  }

  const whereClause = where.join(' AND ');
  const countRes = await pool.query(
    `SELECT COUNT(*) FROM ledger_transactions t WHERE ${whereClause}`,
    params
  );
  const totalCount = parseInt(countRes.rows[0].count, 10) || 0;

  const sortCol =
    sortBy === 'amount'
      ? 't.amount'
      : sortBy === 'category'
        ? 't.category'
        : sortBy === 'counterparty'
          ? 't.counterparty'
          : 't.transaction_date';
  const orderDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const offset = (Math.max(1, page) - 1) * limit;
  params.push(limit);
  params.push(offset);

  const res = await pool.query(
    `SELECT t.*, a.name AS account_name, a.type AS account_type
     FROM ledger_transactions t
     LEFT JOIN ledger_accounts a ON a.id = t.account_id
     WHERE ${whereClause}
     ORDER BY ${sortCol} ${orderDir}, t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    transactions: res.rows.map(mapTransactionRow),
    totalCount,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(totalCount / limit) || 1,
  };
}

// ── Helper: PRD Category Classification ─────────────────────────────────────
export function determineDefaultClassification(category = '', merchant = '') {
  const cat = (category || '').toLowerCase();
  const m = (merchant || '').toLowerCase();

  // 1. Essential (PRD Section 14)
  if (
    cat.includes('rent') ||
    cat.includes('electric') ||
    cat.includes('water') ||
    cat.includes('grocer') ||
    cat.includes('education') ||
    cat.includes('medical') ||
    cat.includes('health') ||
    cat.includes('insurance') ||
    cat.includes('transport') ||
    cat.includes('fuel') ||
    cat.includes('petrol') ||
    cat.includes('diesel') ||
    m.includes('blinkit') ||
    m.includes('zepto') ||
    m.includes('bigbasket') ||
    m.includes('dmart') ||
    m.includes('bescom') ||
    m.includes('uber') ||
    m.includes('ola')
  ) {
    return 'Essential';
  }

  // 2. Lifestyle (PRD Section 14)
  if (
    cat.includes('restaurant') ||
    cat.includes('food delivery') ||
    cat.includes('entertainment') ||
    cat.includes('shopping') ||
    cat.includes('travel') ||
    cat.includes('movie') ||
    cat.includes('gaming') ||
    cat.includes('subscription') ||
    m.includes('swiggy') ||
    m.includes('zomato') ||
    m.includes('netflix') ||
    m.includes('amazon') ||
    m.includes('flipkart') ||
    m.includes('myntra') ||
    m.includes('spotify') ||
    m.includes('prime') ||
    m.includes('pvr') ||
    m.includes('inox')
  ) {
    return 'Lifestyle';
  }

  // 3. Financial (PRD Section 14)
  if (
    cat.includes('emi') ||
    cat.includes('loan') ||
    cat.includes('credit card') ||
    cat.includes('invest') ||
    cat.includes('mutual fund') ||
    cat.includes('stock') ||
    cat.includes('sip') ||
    cat.includes('gold') ||
    cat.includes('deposit') ||
    cat.includes('ppf') ||
    cat.includes('nps') ||
    m.includes('zerodha') ||
    m.includes('groww') ||
    m.includes('bajaj finance')
  ) {
    return 'Financial';
  }

  return 'Other';
}

function mapTransactionRow(row) {
  const category = row.category || 'General';
  const merchant = row.merchant || row.counterparty || '';
  const classification = row.classification || determineDefaultClassification(category, merchant);
  const isRecurring = Boolean(row.is_recurring);
  const isEssential = row.is_essential !== null && row.is_essential !== undefined
    ? Boolean(row.is_essential)
    : (classification === 'Essential');

  return {
    id: row.id,
    type: row.type,
    amount: roundMoney(row.amount),
    transactionDate: formatDateOnly(row.transaction_date),
    category,
    merchant,
    counterparty: row.counterparty || merchant,
    description: row.description || '',
    subcategory: row.subcategory || '',
    classification,
    isRecurring,
    isEssential,
    confidence: row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : 1.0,
    paymentMethod: row.payment_method || 'UPI',
    referenceNumber: row.reference_number || '',
    status: row.status || 'completed',
    accountId: row.account_id,
    accountName: row.account_name || 'General Account',
    accountType: row.account_type || 'Bank Account',
    receivableId: row.receivable_id,
    payableId: row.payable_id,
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    notes: row.notes,
    debit: roundMoney(row.debit || (row.type === 'expense' ? row.amount : 0)),
    credit: roundMoney(row.credit || (row.type === 'income' ? row.amount : 0)),
    balance: row.running_balance === null || row.running_balance === undefined ? null : roundMoney(row.running_balance),
    source: row.source || 'MANUAL',
    bank: row.bank || '',
    transactionType: row.transaction_type || row.type,
    reconciledAt: row.reconciled_at,
    createdAt: row.created_at,
  };
}

export async function createTransaction(userId, data) {
  const amount = roundMoney(data.amount);
  if (amount <= 0) throw new Error('Transaction amount must be greater than zero.');
  const txId = crypto.randomUUID();
  const txDate = data.transactionDate || new Date().toISOString().split('T')[0];
  const txStatus = data.status || 'completed';
  const merchant = data.merchant || data.counterparty || null;
  const classification = data.classification || determineDefaultClassification(data.category, merchant);
  const isRecurring = Boolean(data.isRecurring);
  const isEssential = data.isEssential !== undefined && data.isEssential !== null
    ? Boolean(data.isEssential)
    : (classification === 'Essential');
  const confidence = data.confidence !== undefined ? Number(data.confidence) : 1.0;

  const res = await pool.query(
    `INSERT INTO ledger_transactions
       (id, user_id, account_id, type, amount, transaction_date, category, counterparty, description, payment_method, reference_number, status, receivable_id, payable_id, notes, attachment_url, attachment_name, source, debit, credit, transaction_type, merchant, subcategory, classification, is_recurring, is_essential, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'MANUAL', $18, $19, $20, $21, $22, $23, $24, $25, $26)
     RETURNING *`,
    [
      txId,
      userId,
      data.accountId || null,
      data.type,
      amount,
      txDate,
      data.category || 'General',
      data.counterparty || merchant,
      data.description || null,
      data.paymentMethod || 'UPI',
      data.referenceNumber || null,
      txStatus,
      data.receivableId || null,
      data.payableId || null,
      data.notes || null,
      data.attachmentUrl || null,
      data.attachmentName || null,
      data.type === 'expense' ? amount : 0,
      data.type === 'income' ? amount : 0,
      data.type.toUpperCase(),
      merchant,
      data.subcategory || null,
      classification,
      isRecurring,
      isEssential,
      confidence,
    ]
  );

  // Sync account balance
  if (data.accountId && txStatus === 'completed') {
    const delta = data.type === 'income' ? amount : data.type === 'expense' ? -amount : 0;
    if (delta !== 0) {
      await pool.query(
        `UPDATE ledger_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
        [delta, data.accountId, userId]
      );
    }
  }

  await recordAuditLog(userId, 'CREATE', 'TRANSACTION', txId, { amount, type: data.type, category: data.category });
  return mapTransactionRow(res.rows[0]);
}

export async function updateTransaction(userId, txId, data) {
  const currentRes = await pool.query(
    `SELECT * FROM ledger_transactions WHERE id = $1 AND user_id = $2`,
    [txId, userId]
  );
  if (currentRes.rows.length === 0) return null;
  const oldTx = currentRes.rows[0];

  const updates = [];
  const params = [userId, txId];
  let idx = 3;

  if (data.type !== undefined) { updates.push(`type = $${idx++}`); params.push(data.type); }
  if (data.amount !== undefined) { updates.push(`amount = $${idx++}`); params.push(roundMoney(data.amount)); }
  if (data.transactionDate !== undefined) { updates.push(`transaction_date = $${idx++}`); params.push(data.transactionDate); }
  if (data.category !== undefined) { updates.push(`category = $${idx++}`); params.push(data.category); }
  if (data.counterparty !== undefined) { updates.push(`counterparty = $${idx++}`); params.push(data.counterparty); }
  if (data.merchant !== undefined) { updates.push(`merchant = $${idx++}`); params.push(data.merchant); }
  if (data.subcategory !== undefined) { updates.push(`subcategory = $${idx++}`); params.push(data.subcategory); }
  if (data.classification !== undefined) { updates.push(`classification = $${idx++}`); params.push(data.classification); }
  if (data.isRecurring !== undefined) { updates.push(`is_recurring = $${idx++}`); params.push(Boolean(data.isRecurring)); }
  if (data.isEssential !== undefined) { updates.push(`is_essential = $${idx++}`); params.push(Boolean(data.isEssential)); }
  if (data.description !== undefined) { updates.push(`description = $${idx++}`); params.push(data.description); }
  if (data.paymentMethod !== undefined) { updates.push(`payment_method = $${idx++}`); params.push(data.paymentMethod); }
  if (data.referenceNumber !== undefined) { updates.push(`reference_number = $${idx++}`); params.push(data.referenceNumber); }
  if (data.accountId !== undefined) { updates.push(`account_id = $${idx++}`); params.push(data.accountId); }
  if (data.notes !== undefined) { updates.push(`notes = $${idx++}`); params.push(data.notes); }
  updates.push(`updated_at = NOW()`);

  const res = await pool.query(
    `UPDATE ledger_transactions SET ${updates.join(', ')} WHERE user_id = $1 AND id = $2 RETURNING *`,
    params
  );
  const updated = res.rows[0];

  // Reconcile account balances if amount, type or account changed
  if (oldTx.account_id) {
    const oldDelta = oldTx.type === 'income' ? -Number(oldTx.amount) : oldTx.type === 'expense' ? Number(oldTx.amount) : 0;
    await pool.query(`UPDATE ledger_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3`, [oldDelta, oldTx.account_id, userId]);
  }
  if (updated.account_id) {
    const newDelta = updated.type === 'income' ? Number(updated.amount) : updated.type === 'expense' ? -Number(updated.amount) : 0;
    await pool.query(`UPDATE ledger_accounts SET current_balance = current_balance + $1 WHERE id = $2 AND user_id = $3`, [newDelta, updated.account_id, userId]);
  }

  await recordAuditLog(userId, 'UPDATE', 'TRANSACTION', txId, data);
  return mapTransactionRow(updated);
}

export async function deleteTransaction(userId, txId) {
  const currentRes = await pool.query(
    `SELECT * FROM ledger_transactions WHERE id = $1 AND user_id = $2`,
    [txId, userId]
  );
  if (currentRes.rows.length === 0) return false;
  const oldTx = currentRes.rows[0];

  await pool.query(`DELETE FROM ledger_transactions WHERE id = $1 AND user_id = $2`, [txId, userId]);

  // Reverse balance effect
  if (oldTx.account_id && oldTx.status === 'completed') {
    const reverseDelta = oldTx.type === 'income' ? -Number(oldTx.amount) : oldTx.type === 'expense' ? Number(oldTx.amount) : 0;
    if (reverseDelta !== 0) {
      await pool.query(
        `UPDATE ledger_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
        [reverseDelta, oldTx.account_id, userId]
      );
    }
  }

  await recordAuditLog(userId, 'DELETE', 'TRANSACTION', txId, {});
  return true;
}

// ============================================================================
// 3. RECEIVABLES (INVOICES) SERVICE
// ============================================================================
export async function getReceivables(userId, filters = {}) {
  const { search = '', status = '', dateFrom = '', dateTo = '', page = 1, limit = 50 } = filters;

  const params = [userId];
  const where = ['r.user_id = $1'];

  if (status) {
    params.push(status);
    where.push(`r.status = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    where.push(`r.due_date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    where.push(`r.due_date <= $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(r.customer_name ILIKE $${params.length} OR r.invoice_number ILIKE $${params.length})`);
  }

  const whereClause = where.join(' AND ');
  const countRes = await pool.query(`SELECT COUNT(*) FROM ledger_receivables r WHERE ${whereClause}`, params);
  const totalCount = parseInt(countRes.rows[0].count, 10) || 0;

  const offset = (Math.max(1, page) - 1) * limit;
  params.push(limit);
  params.push(offset);

  const res = await pool.query(
    `SELECT r.*,
            (r.total_amount - r.paid_amount) AS outstanding_amount
     FROM ledger_receivables r
     WHERE ${whereClause}
     ORDER BY r.due_date ASC, r.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    receivables: res.rows.map(mapReceivableRow),
    totalCount,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(totalCount / limit) || 1,
  };
}

function mapReceivableRow(row) {
  const total = roundMoney(row.total_amount);
  const paid = roundMoney(row.paid_amount);
  const outstanding = roundMoney(Math.max(0, total - paid));
  const isOverdue = row.status !== 'Paid' && row.status !== 'Cancelled' && new Date(row.due_date) < new Date();

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email || '',
    customerPhone: row.customer_phone || '',
    customerGstin: row.customer_gstin || '',
    issueDate: formatDateOnly(row.issue_date),
    dueDate: formatDateOnly(row.due_date),
    subtotal: roundMoney(row.subtotal),
    taxAmount: roundMoney(row.tax_amount),
    totalAmount: total,
    paidAmount: paid,
    outstandingAmount: outstanding,
    status: isOverdue ? 'Overdue' : row.status,
    items: Array.isArray(row.items) ? row.items : [],
    notes: row.notes || '',
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    createdAt: row.created_at,
  };
}

export async function createReceivable(userId, data) {
  const recId = crypto.randomUUID();
  const subtotal = roundMoney(data.subtotal || data.totalAmount || 0);
  const taxAmount = roundMoney(data.taxAmount || 0);
  const totalAmount = roundMoney(data.totalAmount || subtotal + taxAmount);
  const invoiceNumber = data.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
  const issueDate = data.issueDate || new Date().toISOString().split('T')[0];
  const dueDate = data.dueDate || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

  const res = await pool.query(
    `INSERT INTO ledger_receivables
       (id, user_id, invoice_number, customer_name, customer_email, customer_phone, customer_gstin, issue_date, due_date, subtotal, tax_amount, total_amount, paid_amount, status, items, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      recId,
      userId,
      invoiceNumber,
      data.customerName,
      data.customerEmail || null,
      data.customerPhone || null,
      data.customerGstin || null,
      issueDate,
      dueDate,
      subtotal,
      taxAmount,
      totalAmount,
      0.0,
      data.status || 'Pending',
      JSON.stringify(data.items || []),
      data.notes || null,
    ]
  );
  await recordAuditLog(userId, 'CREATE', 'RECEIVABLE', recId, { invoiceNumber, totalAmount });
  return mapReceivableRow(res.rows[0]);
}

export async function recordReceivablePayment(userId, invoiceId, data) {
  const payAmount = roundMoney(data.amount);
  if (payAmount <= 0) throw new Error('Payment amount must be greater than zero.');

  const recRes = await pool.query(
    `SELECT * FROM ledger_receivables WHERE id = $1 AND user_id = $2`,
    [invoiceId, userId]
  );
  if (recRes.rows.length === 0) throw new Error('Invoice not found.');
  const invoice = recRes.rows[0];

  const currentPaid = roundMoney(invoice.paid_amount);
  const total = roundMoney(invoice.total_amount);
  const remaining = roundMoney(total - currentPaid);

  if (payAmount > remaining + 0.01) {
    throw new Error(`Payment amount (₹${payAmount}) exceeds outstanding balance (₹${remaining}).`);
  }

  const newPaid = roundMoney(currentPaid + payAmount);
  const newStatus = newPaid >= total ? 'Paid' : 'Partially Paid';
  const payDate = data.paymentDate || new Date().toISOString().split('T')[0];

  // 1. Create Income Transaction linked to Receivable
  const tx = await createTransaction(userId, {
    type: 'income',
    amount: payAmount,
    transactionDate: payDate,
    category: 'Sales Revenue',
    counterparty: invoice.customer_name,
    description: `Payment for Invoice #${invoice.invoice_number}`,
    accountId: data.accountId || null,
    paymentMethod: data.paymentMethod || 'UPI',
    referenceNumber: data.referenceNumber || null,
    receivableId: invoiceId,
    notes: data.notes || null,
  });

  // 2. Insert into ledger_receivable_payments
  const payId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO ledger_receivable_payments
       (id, receivable_id, user_id, account_id, transaction_id, amount, payment_date, payment_method, reference_number, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      payId,
      invoiceId,
      userId,
      data.accountId || null,
      tx.id,
      payAmount,
      payDate,
      data.paymentMethod || 'UPI',
      data.referenceNumber || null,
      data.notes || null,
    ]
  );

  // 3. Update Invoice Status and Paid Amount
  const updatedRecRes = await pool.query(
    `UPDATE ledger_receivables
     SET paid_amount = $1, status = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [newPaid, newStatus, invoiceId, userId]
  );

  await recordAuditLog(userId, 'PAYMENT_RECORDED', 'RECEIVABLE', invoiceId, { amount: payAmount, newPaid, newStatus });
  return {
    receivable: mapReceivableRow(updatedRecRes.rows[0]),
    transaction: tx,
  };
}

export async function deleteReceivable(userId, invoiceId) {
  const res = await pool.query(
    `DELETE FROM ledger_receivables WHERE id = $1 AND user_id = $2 RETURNING id`,
    [invoiceId, userId]
  );
  if (res.rows.length > 0) {
    await recordAuditLog(userId, 'DELETE', 'RECEIVABLE', invoiceId, {});
    return true;
  }
  return false;
}

// ============================================================================
// 4. PAYABLES (VENDOR BILLS) SERVICE
// ============================================================================
export async function getPayables(userId, filters = {}) {
  const { search = '', status = '', dateFrom = '', dateTo = '', page = 1, limit = 50 } = filters;

  const params = [userId];
  const where = ['p.user_id = $1'];

  if (status) {
    params.push(status);
    where.push(`p.status = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    where.push(`p.due_date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    where.push(`p.due_date <= $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(p.vendor_name ILIKE $${params.length} OR p.bill_number ILIKE $${params.length})`);
  }

  const whereClause = where.join(' AND ');
  const countRes = await pool.query(`SELECT COUNT(*) FROM ledger_payables p WHERE ${whereClause}`, params);
  const totalCount = parseInt(countRes.rows[0].count, 10) || 0;

  const offset = (Math.max(1, page) - 1) * limit;
  params.push(limit);
  params.push(offset);

  const res = await pool.query(
    `SELECT p.*,
            (p.total_amount - p.paid_amount) AS outstanding_amount
     FROM ledger_payables p
     WHERE ${whereClause}
     ORDER BY p.due_date ASC, p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    payables: res.rows.map(mapPayableRow),
    totalCount,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(totalCount / limit) || 1,
  };
}

function mapPayableRow(row) {
  const total = roundMoney(row.total_amount);
  const paid = roundMoney(row.paid_amount);
  const outstanding = roundMoney(Math.max(0, total - paid));
  const isOverdue = row.status !== 'Paid' && row.status !== 'Cancelled' && new Date(row.due_date) < new Date();

  return {
    id: row.id,
    billNumber: row.bill_number,
    vendorName: row.vendor_name,
    vendorEmail: row.vendor_email || '',
    vendorPhone: row.vendor_phone || '',
    vendorGstin: row.vendor_gstin || '',
    category: row.category || 'Purchases',
    billDate: formatDateOnly(row.bill_date),
    dueDate: formatDateOnly(row.due_date),
    subtotal: roundMoney(row.subtotal),
    taxAmount: roundMoney(row.tax_amount),
    totalAmount: total,
    paidAmount: paid,
    outstandingAmount: outstanding,
    status: isOverdue ? 'Overdue' : row.status,
    items: Array.isArray(row.items) ? row.items : [],
    notes: row.notes || '',
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    createdAt: row.created_at,
  };
}

export async function createPayable(userId, data) {
  const billId = crypto.randomUUID();
  const subtotal = roundMoney(data.subtotal || data.totalAmount || 0);
  const taxAmount = roundMoney(data.taxAmount || 0);
  const totalAmount = roundMoney(data.totalAmount || subtotal + taxAmount);
  const billNumber = data.billNumber || `BILL-${Date.now().toString().slice(-6)}`;
  const billDate = data.billDate || new Date().toISOString().split('T')[0];
  const dueDate = data.dueDate || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

  const res = await pool.query(
    `INSERT INTO ledger_payables
       (id, user_id, bill_number, vendor_name, vendor_email, vendor_phone, vendor_gstin, category, bill_date, due_date, subtotal, tax_amount, total_amount, paid_amount, status, items, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      billId,
      userId,
      billNumber,
      data.vendorName,
      data.vendorEmail || null,
      data.vendorPhone || null,
      data.vendorGstin || null,
      data.category || 'Purchases',
      billDate,
      dueDate,
      subtotal,
      taxAmount,
      totalAmount,
      0.0,
      data.status || 'Pending',
      JSON.stringify(data.items || []),
      data.notes || null,
    ]
  );
  await recordAuditLog(userId, 'CREATE', 'PAYABLE', billId, { billNumber, totalAmount });
  return mapPayableRow(res.rows[0]);
}

export async function recordPayablePayment(userId, billId, data) {
  const payAmount = roundMoney(data.amount);
  if (payAmount <= 0) throw new Error('Payment amount must be greater than zero.');

  const billRes = await pool.query(
    `SELECT * FROM ledger_payables WHERE id = $1 AND user_id = $2`,
    [billId, userId]
  );
  if (billRes.rows.length === 0) throw new Error('Bill not found.');
  const bill = billRes.rows[0];

  const currentPaid = roundMoney(bill.paid_amount);
  const total = roundMoney(bill.total_amount);
  const remaining = roundMoney(total - currentPaid);

  if (payAmount > remaining + 0.01) {
    throw new Error(`Payment amount (₹${payAmount}) exceeds outstanding balance (₹${remaining}).`);
  }

  const newPaid = roundMoney(currentPaid + payAmount);
  const newStatus = newPaid >= total ? 'Paid' : 'Partially Paid';
  const payDate = data.paymentDate || new Date().toISOString().split('T')[0];

  // 1. Create Expense Transaction linked to Payable
  const tx = await createTransaction(userId, {
    type: 'expense',
    amount: payAmount,
    transactionDate: payDate,
    category: bill.category || 'Purchases',
    counterparty: bill.vendor_name,
    description: `Payment for Bill #${bill.bill_number}`,
    accountId: data.accountId || null,
    paymentMethod: data.paymentMethod || 'Bank Transfer',
    referenceNumber: data.referenceNumber || null,
    payableId: billId,
    notes: data.notes || null,
  });

  // 2. Insert into ledger_payable_payments
  const payId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO ledger_payable_payments
       (id, payable_id, user_id, account_id, transaction_id, amount, payment_date, payment_method, reference_number, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      payId,
      billId,
      userId,
      data.accountId || null,
      tx.id,
      payAmount,
      payDate,
      data.paymentMethod || 'Bank Transfer',
      data.referenceNumber || null,
      data.notes || null,
    ]
  );

  // 3. Update Bill Status and Paid Amount
  const updatedBillRes = await pool.query(
    `UPDATE ledger_payables
     SET paid_amount = $1, status = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [newPaid, newStatus, billId, userId]
  );

  await recordAuditLog(userId, 'PAYMENT_RECORDED', 'PAYABLE', billId, { amount: payAmount, newPaid, newStatus });
  return {
    payable: mapPayableRow(updatedBillRes.rows[0]),
    transaction: tx,
  };
}

export async function deletePayable(userId, billId) {
  const res = await pool.query(
    `DELETE FROM ledger_payables WHERE id = $1 AND user_id = $2 RETURNING id`,
    [billId, userId]
  );
  if (res.rows.length > 0) {
    await recordAuditLog(userId, 'DELETE', 'PAYABLE', billId, {});
    return true;
  }
  return false;
}

// ============================================================================
// 5. FINANCIAL PROFILE & DASHBOARD AGGREGATIONS SERVICE (PRD PHASE 5)
// ============================================================================

export async function getFinancialProfile(userId) {
  try {
    const res = await pool.query(
      `SELECT * FROM ledger_financial_profiles WHERE user_id = $1`,
      [userId]
    );
    if (res.rows.length === 0) {
      return {
        monthlyIncome: 0,
        salaryIncome: 0,
        monthlySalary: 0,
        businessIncome: 0,
        freelanceIncome: 0,
        rentalIncome: 0,
        otherIncome: 0,
        monthlyDebtObligations: 0,
        emergencySavings: 0,
        emergencyFundTarget: 0,
        monthlySavingsTarget: 0,
        occupation: '',
        city: '',
        age: null,
        isConfigured: false,
      };
    }
    const r = res.rows[0];
    const sInc = roundMoney(r.salary_income);
    const mInc = roundMoney(r.monthly_income);
    return {
      id: r.id,
      monthlyIncome: mInc || sInc,
      salaryIncome: sInc,
      monthlySalary: sInc || mInc,
      businessIncome: roundMoney(r.business_income),
      freelanceIncome: roundMoney(r.freelance_income),
      rentalIncome: roundMoney(r.rental_income),
      otherIncome: roundMoney(r.other_income),
      monthlyDebtObligations: roundMoney(r.monthly_debt_obligations),
      emergencySavings: roundMoney(r.emergency_savings),
      emergencyFundTarget: roundMoney(r.emergency_fund_target),
      monthlySavingsTarget: roundMoney(r.monthly_savings_target),
      occupation: r.occupation || '',
      city: r.city || '',
      age: r.age || null,
      isConfigured: true,
    };
  } catch (err) {
    console.warn('[ledger:profile] Error fetching profile:', err.message);
    return {
      monthlyIncome: 0,
      salaryIncome: 0,
      monthlySalary: 0,
      businessIncome: 0,
      freelanceIncome: 0,
      rentalIncome: 0,
      otherIncome: 0,
      monthlyDebtObligations: 0,
      emergencySavings: 0,
      emergencyFundTarget: 0,
      monthlySavingsTarget: 0,
      occupation: '',
      city: '',
      age: null,
      isConfigured: false,
    };
  }
}

export async function updateFinancialProfile(userId, data) {
  const profileId = crypto.randomUUID();
  const salaryIncome = data.salaryIncome !== undefined 
    ? roundMoney(data.salaryIncome) 
    : (data.monthlySalary !== undefined ? roundMoney(data.monthlySalary) : 0);
  const monthlyIncome = data.monthlyIncome !== undefined 
    ? roundMoney(data.monthlyIncome) 
    : salaryIncome;
  const businessIncome = data.businessIncome !== undefined ? roundMoney(data.businessIncome) : 0;
  const freelanceIncome = data.freelanceIncome !== undefined ? roundMoney(data.freelanceIncome) : 0;
  const rentalIncome = data.rentalIncome !== undefined ? roundMoney(data.rentalIncome) : 0;
  const otherIncome = data.otherIncome !== undefined ? roundMoney(data.otherIncome) : 0;
  const debtObligations = data.monthlyDebtObligations !== undefined ? roundMoney(data.monthlyDebtObligations) : 0;
  const emergencySavings = data.emergencySavings !== undefined ? roundMoney(data.emergencySavings) : 0;
  const emergencyTarget = data.emergencyFundTarget !== undefined ? roundMoney(data.emergencyFundTarget) : 0;
  const savingsTarget = data.monthlySavingsTarget !== undefined ? roundMoney(data.monthlySavingsTarget) : 0;

  await pool.query(
    `INSERT INTO ledger_financial_profiles (
       id, user_id, monthly_income, salary_income, business_income, freelance_income, rental_income, other_income,
       monthly_debt_obligations, emergency_savings, emergency_fund_target, monthly_savings_target, occupation, city, age, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       monthly_income = EXCLUDED.monthly_income,
       salary_income = EXCLUDED.salary_income,
       business_income = EXCLUDED.business_income,
       freelance_income = EXCLUDED.freelance_income,
       rental_income = EXCLUDED.rental_income,
       other_income = EXCLUDED.other_income,
       monthly_debt_obligations = EXCLUDED.monthly_debt_obligations,
       emergency_savings = EXCLUDED.emergency_savings,
       emergency_fund_target = EXCLUDED.emergency_fund_target,
       monthly_savings_target = EXCLUDED.monthly_savings_target,
       occupation = COALESCE(EXCLUDED.occupation, ledger_financial_profiles.occupation),
       city = COALESCE(EXCLUDED.city, ledger_financial_profiles.city),
       age = COALESCE(EXCLUDED.age, ledger_financial_profiles.age),
       updated_at = NOW()`,
    [
      profileId,
      userId,
      monthlyIncome,
      salaryIncome,
      businessIncome,
      freelanceIncome,
      rentalIncome,
      otherIncome,
      debtObligations,
      emergencySavings,
      emergencyTarget,
      savingsTarget,
      data.occupation || null,
      data.city || null,
      data.age ? parseInt(data.age, 10) : null,
    ]
  );
  return getFinancialProfile(userId);
}

export async function getDashboardData(userId, query = {}) {
  const { datePreset = 'this_month', dateFrom = '', dateTo = '', chartInterval = 'monthly' } = query;
  const { startStr, endStr, startDate, endDate } = getDateRangeBounds(datePreset, dateFrom, dateTo);

  // Friendly period label (PRD Section 3 & 4)
  let periodLabel = 'This Month';
  if (datePreset === 'this_month' || datePreset === 'last_month') {
    periodLabel = startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } else if (datePreset === 'today') {
    periodLabel = `Today (${startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`;
  } else if (datePreset === 'this_week') {
    periodLabel = `This Week (${startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`;
  } else if (datePreset === 'this_quarter') {
    const q = Math.floor(startDate.getMonth() / 3) + 1;
    periodLabel = `Q${q} ${startDate.getFullYear()}`;
  } else if (datePreset === 'this_year') {
    periodLabel = `Fiscal Year ${startDate.getFullYear()}`;
  } else if (datePreset === 'all') {
    periodLabel = 'All Time Records';
  } else if (datePreset === 'custom') {
    periodLabel = `${startStr} to ${endStr}`;
  }

  // 1. Current Period Transactions Aggregation
  const txAgg = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS raw_total_expense,
       COALESCE(SUM(CASE WHEN type = 'expense' AND (classification != 'Financial' OR category NOT IN ('Investment', 'Mutual Funds', 'Stocks', 'SIP', 'FD', 'PPF', 'NPS')) THEN amount ELSE 0 END), 0) AS operating_expense,
       COALESCE(SUM(CASE WHEN type = 'investment' OR (type = 'expense' AND (category IN ('Investment', 'Mutual Funds', 'Stocks', 'SIP', 'FD', 'PPF', 'NPS') OR subcategory = 'Investment' OR classification = 'Financial')) AND category IN ('Investment', 'Mutual Funds', 'Stocks', 'SIP', 'FD', 'PPF', 'NPS') THEN amount ELSE 0 END), 0) AS total_investment,
       COUNT(*) AS total_tx_count
     FROM ledger_transactions
     WHERE user_id = $1 AND status = 'completed' AND transaction_date >= $2 AND transaction_date <= $3`,
    [userId, startStr, endStr]
  );

  const totalIncome = roundMoney(txAgg.rows[0].total_income);
  const rawTotalExpenses = roundMoney(txAgg.rows[0].raw_total_expense);
  const operatingExpenses = roundMoney(txAgg.rows[0].operating_expense);
  const totalInvestments = roundMoney(txAgg.rows[0].total_investment);
  const totalTxCount = parseInt(txAgg.rows[0].total_tx_count, 10) || 0;

  // PRD Monthly CFO Snapshot Formula:
  // Income - Expenses = Savings; Savings Rate = (Savings / Income) * 100;
  // Available Surplus = Savings - Investments
  const prdExpenses = rawTotalExpenses; // All recorded expenses in period
  const totalSavings = totalIncome > prdExpenses ? roundMoney(totalIncome - prdExpenses) : 0;
  const savingsRate = totalIncome > 0 ? roundMoney((totalSavings / totalIncome) * 100) : null;
  const investmentRate = totalIncome > 0 ? roundMoney((totalInvestments / totalIncome) * 100) : null;
  const availableSurplus = Math.max(0, roundMoney(totalSavings - totalInvestments));
  const netPosition = roundMoney(totalIncome - rawTotalExpenses);

  // 2. Receivables & Payables (preserved for backward compatibility)
  const recAgg = await pool.query(
    `SELECT
       COALESCE(SUM(total_amount - paid_amount), 0) AS total_outstanding,
       COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('Paid', 'Cancelled')) AS overdue_count
     FROM ledger_receivables
     WHERE user_id = $1 AND status NOT IN ('Paid', 'Cancelled')`,
    [userId]
  );
  const totalReceivables = roundMoney(recAgg.rows[0].total_outstanding);
  const overdueReceivablesCount = parseInt(recAgg.rows[0].overdue_count, 10) || 0;

  const payAgg = await pool.query(
    `SELECT
       COALESCE(SUM(total_amount - paid_amount), 0) AS total_outstanding,
       COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('Paid', 'Cancelled')) AS overdue_count
     FROM ledger_payables
     WHERE user_id = $1 AND status NOT IN ('Paid', 'Cancelled')`,
    [userId]
  );
  const totalPayables = roundMoney(payAgg.rows[0].total_outstanding);
  const overduePayablesCount = parseInt(payAgg.rows[0].overdue_count, 10) || 0;

  // 3. Previous Period Aggregation (for Expense Growth & CFO insight)
  let prevStartStr, prevEndStr;
  if (datePreset === 'this_month') {
    const pStart = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
    const pEnd = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
    prevStartStr = pStart.toISOString().split('T')[0];
    prevEndStr = pEnd.toISOString().split('T')[0];
  } else {
    const durationMs = Math.max(86400000, endDate.getTime() - startDate.getTime());
    const pEnd = new Date(startDate.getTime() - 86400000);
    const pStart = new Date(pEnd.getTime() - durationMs);
    prevStartStr = pStart.toISOString().split('T')[0];
    prevEndStr = pEnd.toISOString().split('T')[0];
  }

  const prevAgg = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS prev_income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS prev_expense
     FROM ledger_transactions
     WHERE user_id = $1 AND status = 'completed' AND transaction_date >= $2 AND transaction_date <= $3`,
    [userId, prevStartStr, prevEndStr]
  );
  const prevExpenses = roundMoney(prevAgg.rows[0].prev_expense);
  const prevIncome = roundMoney(prevAgg.rows[0].prev_income);
  const expenseGrowth = (prevExpenses > 0 && rawTotalExpenses > 0)
    ? roundMoney(((rawTotalExpenses - prevExpenses) / prevExpenses) * 100)
    : null;

  // 4. Category Breakdown & Classification (PRD Section 7 & 14)
  const catRowsRes = await pool.query(
    `SELECT
       category,
       COALESCE(classification, '') AS classification,
       COALESCE(merchant, counterparty, '') AS merchant,
       COALESCE(SUM(amount), 0) AS total_amount,
       COUNT(*) AS tx_count
     FROM ledger_transactions
     WHERE user_id = $1 AND type = 'expense' AND status = 'completed' AND transaction_date >= $2 AND transaction_date <= $3
     GROUP BY category, classification, merchant, counterparty
     ORDER BY total_amount DESC`,
    [userId, startStr, endStr]
  );

  let essentialAmount = 0;
  let lifestyleAmount = 0;
  let financialAmount = 0;
  let otherAmount = 0;
  let essentialCount = 0;
  let lifestyleCount = 0;
  let financialCount = 0;
  let otherCount = 0;

  const categoryMap = new Map();

  for (const row of catRowsRes.rows) {
    const amt = roundMoney(row.total_amount);
    const count = parseInt(row.tx_count, 10) || 1;
    const determinedClass = row.classification || determineDefaultClassification(row.category, row.merchant);

    if (determinedClass === 'Essential') {
      essentialAmount += amt;
      essentialCount += count;
    } else if (determinedClass === 'Lifestyle') {
      lifestyleAmount += amt;
      lifestyleCount += count;
    } else if (determinedClass === 'Financial') {
      financialAmount += amt;
      financialCount += count;
    } else {
      otherAmount += amt;
      otherCount += count;
    }

    const catKey = row.category || 'General';
    if (!categoryMap.has(catKey)) {
      categoryMap.set(catKey, {
        name: catKey,
        classification: determinedClass,
        amount: 0,
        count: 0,
      });
    }
    const catEntry = categoryMap.get(catKey);
    catEntry.amount = roundMoney(catEntry.amount + amt);
    catEntry.count += count;
  }

  essentialAmount = roundMoney(essentialAmount);
  lifestyleAmount = roundMoney(lifestyleAmount);
  financialAmount = roundMoney(financialAmount);
  otherAmount = roundMoney(otherAmount);

  const topCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((c) => {
      const p = rawTotalExpenses > 0 ? roundMoney((c.amount / rawTotalExpenses) * 100) : 0;
      return {
        ...c,
        pct: p,
        percentage: p,
      };
    });

  const classifications = {
    essential: {
      amount: essentialAmount,
      pct: rawTotalExpenses > 0 ? roundMoney((essentialAmount / rawTotalExpenses) * 100) : 0,
      percentage: rawTotalExpenses > 0 ? roundMoney((essentialAmount / rawTotalExpenses) * 100) : 0,
      count: essentialCount,
    },
    lifestyle: {
      amount: lifestyleAmount,
      pct: rawTotalExpenses > 0 ? roundMoney((lifestyleAmount / rawTotalExpenses) * 100) : 0,
      percentage: rawTotalExpenses > 0 ? roundMoney((lifestyleAmount / rawTotalExpenses) * 100) : 0,
      count: lifestyleCount,
    },
    financial: {
      amount: financialAmount,
      pct: rawTotalExpenses > 0 ? roundMoney((financialAmount / rawTotalExpenses) * 100) : 0,
      percentage: rawTotalExpenses > 0 ? roundMoney((financialAmount / rawTotalExpenses) * 100) : 0,
      count: financialCount,
    },
    other: {
      amount: otherAmount,
      pct: rawTotalExpenses > 0 ? roundMoney((otherAmount / rawTotalExpenses) * 100) : 0,
      percentage: rawTotalExpenses > 0 ? roundMoney((otherAmount / rawTotalExpenses) * 100) : 0,
      count: otherCount,
    },
  };

  // 5. Fixed vs Variable (PRD Section 8 & 28)
  const fixVarRes = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN (is_recurring = true OR category IN ('Rent', 'Electricity', 'Water', 'Insurance', 'EMI', 'Loan Repayment', 'Education', 'Internet', 'Broadband')) THEN amount ELSE 0 END), 0) AS fixed_amount,
       COALESCE(SUM(CASE WHEN (is_recurring = false OR is_recurring IS NULL) AND category NOT IN ('Rent', 'Electricity', 'Water', 'Insurance', 'EMI', 'Loan Repayment', 'Education', 'Internet', 'Broadband') THEN amount ELSE 0 END), 0) AS variable_amount
     FROM ledger_transactions
     WHERE user_id = $1 AND type = 'expense' AND status = 'completed' AND transaction_date >= $2 AND transaction_date <= $3`,
    [userId, startStr, endStr]
  );
  const fixedExpenses = roundMoney(fixVarRes.rows[0].fixed_amount);
  const variableExpenses = roundMoney(fixVarRes.rows[0].variable_amount);

  const fixedVsVariable = {
    hasData: rawTotalExpenses > 0 || totalIncome > 0,
    monthlyIncome: totalIncome,
    fixed: {
      amount: fixedExpenses,
      pct: rawTotalExpenses > 0 ? roundMoney((fixedExpenses / rawTotalExpenses) * 100) : 0,
      percentage: rawTotalExpenses > 0 ? roundMoney((fixedExpenses / rawTotalExpenses) * 100) : 0,
    },
    variable: {
      amount: variableExpenses,
      pct: rawTotalExpenses > 0 ? roundMoney((variableExpenses / rawTotalExpenses) * 100) : 0,
      percentage: rawTotalExpenses > 0 ? roundMoney((variableExpenses / rawTotalExpenses) * 100) : 0,
    },
    savings: {
      amount: totalSavings,
      pct: totalIncome > 0 ? roundMoney((totalSavings / totalIncome) * 100) : 0,
      percentage: totalIncome > 0 ? roundMoney((totalSavings / totalIncome) * 100) : 0,
    },
    investments: {
      amount: totalInvestments,
      pct: totalIncome > 0 ? roundMoney((totalInvestments / totalIncome) * 100) : 0,
      percentage: totalIncome > 0 ? roundMoney((totalInvestments / totalIncome) * 100) : 0,
    },
  };

  // 6. Accounts & Total Liquid Balances
  const accountsSummary = await getAccounts(userId);
  const totalLiquidBalance = accountsSummary.reduce((acc, a) => acc + (a.currentBalance || 0), 0);

  // 7. Recent Transactions (Top 8)
  const recentRes = await pool.query(
    `SELECT t.*, a.name AS account_name, a.type AS account_type
     FROM ledger_transactions t
     LEFT JOIN ledger_accounts a ON a.id = t.account_id
     WHERE t.user_id = $1
     ORDER BY t.transaction_date DESC, t.created_at DESC
     LIMIT 8`,
    [userId]
  );
  const recentTransactions = recentRes.rows.map(mapTransactionRow);

  // 8. User Financial Profile & Consistency Metrics
  const userProfile = await getFinancialProfile(userId);

  const consistencyRes = await pool.query(
    `SELECT COUNT(DISTINCT DATE_TRUNC('month', transaction_date)) AS active_months
     FROM ledger_transactions
     WHERE user_id = $1 AND status = 'completed'
       AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'`,
    [userId]
  );
  const activeMonths = parseInt(consistencyRes.rows[0].active_months, 10) || 0;

  // 9. Data Freshness Tracking (PRD Section 10 & 45)
  const freshnessTxRes = await pool.query(
    `SELECT MAX(transaction_date) AS max_tx_date FROM ledger_transactions WHERE user_id = $1`,
    [userId]
  );
  const freshnessImportRes = await pool.query(
    `SELECT MAX(created_at) AS max_import_date FROM ledger_statement_imports WHERE user_id = $1`,
    [userId]
  );

  const rawTxDate = freshnessTxRes.rows[0]?.max_tx_date;
  const rawImportDate = freshnessImportRes.rows[0]?.max_import_date;
  let latestActivityDate = null;

  if (rawTxDate && rawImportDate) {
    const d1 = new Date(rawTxDate);
    const d2 = new Date(rawImportDate);
    latestActivityDate = d1 > d2 ? d1 : d2;
  } else if (rawTxDate) {
    latestActivityDate = new Date(rawTxDate);
  } else if (rawImportDate) {
    latestActivityDate = new Date(rawImportDate);
  }

  let lastUpdatedFormatted = 'No statements or records yet';
  let daysSinceLastUpdate = null;
  if (latestActivityDate && !isNaN(latestActivityDate.getTime())) {
    lastUpdatedFormatted = latestActivityDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const diffMs = Date.now() - latestActivityDate.getTime();
    daysSinceLastUpdate = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  const dataFreshness = {
    lastUpdated: latestActivityDate ? latestActivityDate.toISOString() : null,
    lastUpdatedFormatted,
    daysSinceLastUpdate,
    guidance: latestActivityDate
      ? 'Upload your latest statement to refresh your financial dashboard.'
      : 'Upload a bank statement or add transactions to activate your AI CFO dashboard.',
    noDirectBankApi: true,
  };

  // 10. Financial Health Calculation (PRD Section 2, 5, 12, 38)
  const debtObligationsInPeriod = roundMoney(
    (financialAmount) + (userProfile.monthlyDebtObligations || 0)
  );

  // Component A: Savings
  let savingsScore = null;
  let savingsStatus = 'No Data';
  let savingsExplanation = 'Cannot be calculated without recorded income';
  let savingsAvailable = false;

  if (totalIncome > 0) {
    savingsAvailable = true;
    if (savingsRate >= 40) {
      savingsScore = 95;
      savingsStatus = 'Excellent';
    } else if (savingsRate >= 30) {
      savingsScore = 85;
      savingsStatus = 'Very Good';
    } else if (savingsRate >= 20) {
      savingsScore = 75;
      savingsStatus = 'Good';
    } else if (savingsRate >= 10) {
      savingsScore = 60;
      savingsStatus = 'Moderate';
    } else if (savingsRate >= 0) {
      savingsScore = 40;
      savingsStatus = 'Low';
    } else {
      savingsScore = 20;
      savingsStatus = 'Deficit';
    }
    savingsExplanation = `Savings rate of ${savingsRate}% (₹${totalSavings.toLocaleString('en-IN')} saved from ₹${totalIncome.toLocaleString('en-IN')} income)`;
  }

  // Component B: Spending Control / Expense Growth
  let spendingScore = null;
  let spendingStatus = 'No Data';
  let spendingExplanation = 'Cannot be calculated without expense records';
  let spendingAvailable = false;

  if (expenseGrowth !== null) {
    spendingAvailable = true;
    if (expenseGrowth <= -5) {
      spendingScore = 90;
      spendingStatus = 'Reduced';
      spendingExplanation = `Expenses decreased by ${Math.abs(expenseGrowth)}% compared to previous period`;
    } else if (expenseGrowth <= 5) {
      spendingScore = 80;
      spendingStatus = 'Stable';
      spendingExplanation = `Expenses remained stable (${expenseGrowth >= 0 ? '+' : ''}${expenseGrowth}% vs previous period)`;
    } else if (expenseGrowth <= 15) {
      spendingScore = 65;
      spendingStatus = 'Moderate Growth';
      spendingExplanation = `Expenses increased by ${expenseGrowth}% vs previous period`;
    } else {
      spendingScore = 45;
      spendingStatus = 'High Growth';
      spendingExplanation = `Expenses grew significantly by ${expenseGrowth}% vs previous period`;
    }
  } else if (rawTotalExpenses > 0 && totalIncome > 0) {
    spendingAvailable = true;
    const discRatio = roundMoney((lifestyleAmount / totalIncome) * 100);
    if (discRatio <= 20) {
      spendingScore = 85;
      spendingStatus = 'Controlled';
      spendingExplanation = `Discretionary lifestyle spending is well contained at ${discRatio}% of income`;
    } else if (discRatio <= 35) {
      spendingScore = 70;
      spendingStatus = 'Moderate';
      spendingExplanation = `Discretionary lifestyle spending is ${discRatio}% of income`;
    } else {
      spendingScore = 50;
      spendingStatus = 'High Discretionary';
      spendingExplanation = `Discretionary lifestyle spending represents ${discRatio}% of income`;
    }
  } else if (rawTotalExpenses > 0) {
    spendingExplanation = 'Requires income data or previous period records to calculate expense growth';
  }

  // Component C: Debt Burden
  let debtScore = null;
  let debtStatus = 'No Data';
  let debtExplanation = 'Requires recorded income to determine debt burden';
  let debtAvailable = false;

  if (totalIncome > 0) {
    debtAvailable = true;
    const debtBurden = roundMoney((debtObligationsInPeriod / totalIncome) * 100);
    if (debtBurden === 0) {
      debtScore = 95;
      debtStatus = 'Debt-Free';
      debtExplanation = '0% debt burden recorded for this period';
    } else if (debtBurden <= 15) {
      debtScore = 88;
      debtStatus = 'Low Burden';
      debtExplanation = `Debt obligations are ${debtBurden}% of income (healthy range < 15%)`;
    } else if (debtBurden <= 30) {
      debtScore = 72;
      debtStatus = 'Manageable';
      debtExplanation = `Debt obligations represent ${debtBurden}% of income`;
    } else if (debtBurden <= 45) {
      debtScore = 55;
      debtStatus = 'High Burden';
      debtExplanation = `Debt obligations are ${debtBurden}% of income (elevated)`;
    } else {
      debtScore = 35;
      debtStatus = 'Critical Burden';
      debtExplanation = `Heavy debt obligations consuming ${debtBurden}% of income`;
    }
  } else if (debtObligationsInPeriod === 0 && rawTotalExpenses === 0 && totalIncome === 0) {
    debtExplanation = 'No financial records or obligations logged yet';
  }

  // Component D: Emergency Coverage
  let emergencyScore = null;
  let emergencyStatus = 'No Data';
  let emergencyExplanation = 'Requires emergency savings balance and essential expense records';
  let emergencyAvailable = false;
  let emergencyCoverageMonths = null;

  const knownEmergencySavings = userProfile.emergencySavings > 0
    ? userProfile.emergencySavings
    : totalLiquidBalance > 0 ? totalLiquidBalance : 0;

  if (knownEmergencySavings > 0 && essentialAmount > 0) {
    emergencyAvailable = true;
    emergencyCoverageMonths = roundMoney(knownEmergencySavings / essentialAmount);
    if (emergencyCoverageMonths >= 6) {
      emergencyScore = 95;
      emergencyStatus = 'Optimal';
      emergencyExplanation = `${emergencyCoverageMonths} months of essential expenses covered (recommended: 6 months)`;
    } else if (emergencyCoverageMonths >= 3) {
      emergencyScore = 80;
      emergencyStatus = 'Adequate';
      emergencyExplanation = `${emergencyCoverageMonths} months of essential expenses covered`;
    } else if (emergencyCoverageMonths >= 1) {
      emergencyScore = 60;
      emergencyStatus = 'Minimal';
      emergencyExplanation = `${emergencyCoverageMonths} months of essential expenses covered`;
    } else {
      emergencyScore = 35;
      emergencyStatus = 'Under-covered';
      emergencyExplanation = `Less than 1 month of essential expenses covered`;
    }
  }

  // Component E: Investing
  let investingScore = null;
  let investingStatus = 'No Data';
  let investingExplanation = 'Requires recorded income and investment allocations';
  let investingAvailable = false;

  if (totalIncome > 0) {
    investingAvailable = true;
    if (investmentRate >= 25) {
      investingScore = 95;
      investingStatus = 'Aggressive';
      investingExplanation = `Investment rate is ${investmentRate}% of income (high wealth-builder)`;
    } else if (investmentRate >= 15) {
      investingScore = 85;
      investingStatus = 'Consistent';
      investingExplanation = `Investment rate is ${investmentRate}% of income`;
    } else if (investmentRate >= 5) {
      investingScore = 70;
      investingStatus = 'Active';
      investingExplanation = `Investment rate is ${investmentRate}% of income`;
    } else if (investmentRate > 0) {
      investingScore = 50;
      investingStatus = 'Starting';
      investingExplanation = `Investment rate is ${investmentRate}% of income`;
    } else {
      investingScore = 30;
      investingStatus = 'No Active Investments';
      investingExplanation = '0% of recorded income invested this period';
    }
  } else if (totalInvestments > 0) {
    investingAvailable = true;
    investingScore = 75;
    investingStatus = 'Investing Active';
    investingExplanation = `₹${totalInvestments.toLocaleString('en-IN')} invested (income data needed for rate calculation)`;
  }

  // Component F: Consistency
  let consistencyScore = null;
  let consistencyStatus = 'No Records';
  let consistencyExplanation = 'No financial records tracked yet';
  let consistencyAvailable = false;

  if (activeMonths >= 3) {
    consistencyAvailable = true;
    consistencyScore = 90;
    consistencyStatus = 'Highly Consistent';
    consistencyExplanation = `Consistent ledger activity across ${activeMonths} months`;
  } else if (activeMonths === 2) {
    consistencyAvailable = true;
    consistencyScore = 78;
    consistencyStatus = 'Consistent';
    consistencyExplanation = `Financial records tracked across 2 consecutive months`;
  } else if (activeMonths === 1) {
    consistencyAvailable = true;
    consistencyScore = 65;
    consistencyStatus = 'Starting Out';
    consistencyExplanation = `First month of financial record tracking`;
  }

  // Aggregate overall health score
  const availableScores = [
    savingsScore,
    spendingScore,
    debtScore,
    emergencyScore,
    investingScore,
    consistencyScore,
  ].filter((s) => s !== null);

  const hasSufficientData = availableScores.length >= 2;
  const overallScore = hasSufficientData
    ? Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length)
    : null;

  let overallStatus = 'Awaiting Data';
  let overallStatusClass = 'insufficient';
  if (hasSufficientData) {
    if (overallScore >= 80) { overallStatus = 'Excellent'; overallStatusClass = 'excellent'; }
    else if (overallScore >= 70) { overallStatus = 'Good'; overallStatusClass = 'good'; }
    else if (overallScore >= 55) { overallStatus = 'Fair'; overallStatusClass = 'fair'; }
    else { overallStatus = 'Needs Attention'; overallStatusClass = 'needs-attention'; }
  }

  const financialHealth = {
    hasSufficientData,
    score: overallScore,
    status: overallStatus,
    statusClass: overallStatusClass,
    breakdown: {
      savings: { score: savingsScore, rate: savingsRate, status: savingsStatus, value: savingsRate !== null ? `${savingsRate}%` : '—', desc: savingsExplanation, explanation: savingsExplanation, available: savingsAvailable },
      spending: { score: spendingScore, expenseGrowth, status: spendingStatus, value: expenseGrowth !== null ? `${expenseGrowth > 0 ? '+' : ''}${expenseGrowth}%` : '—', desc: spendingExplanation, explanation: spendingExplanation, available: spendingAvailable },
      debt: { score: debtScore, debtObligations: debtObligationsInPeriod, status: debtStatus, value: userProfile.monthlyDebtObligations > 0 && totalIncome > 0 ? `${roundMoney((debtObligationsInPeriod / totalIncome) * 100)}%` : debtObligationsInPeriod > 0 ? `₹${debtObligationsInPeriod}` : '0%', desc: debtExplanation, explanation: debtExplanation, available: debtAvailable },
      emergency: { score: emergencyScore, coverageMonths: emergencyCoverageMonths, status: emergencyStatus, value: emergencyCoverageMonths !== null ? `${emergencyCoverageMonths} months` : '—', desc: emergencyExplanation, explanation: emergencyExplanation, available: emergencyAvailable },
      investing: { score: investingScore, investmentRate, status: investingStatus, value: investmentRate > 0 ? `${investmentRate}%` : '0%', desc: investingExplanation, explanation: investingExplanation, available: investingAvailable },
      consistency: { score: consistencyScore, activeMonths, status: consistencyStatus, value: `${activeMonths} months`, desc: consistencyExplanation, explanation: consistencyExplanation, available: consistencyAvailable },
    },
    transparencyNotice: 'Product-generated financial indicator calculated transparently from your recorded transactions and financial profile. Not an official credit rating or universal standard.',
    explanation: 'Product-generated financial indicator calculated transparently from your recorded transactions and financial profile. Not an official credit rating or universal standard.',
  };

  // 11. AI CFO Insight (PRD Section 6, 13, 18, 49)
  const hasFinancialData = totalIncome > 0 || rawTotalExpenses > 0 || totalTxCount > 0;
  let cfoInsight = {
    hasData: false,
    headline: 'Welcome to your AI Personal CFO',
    message: 'No financial statements or transactions have been recorded for this period yet. Upload your bank or UPI statement to generate cash-flow analysis, spending leak detection, and surplus allocations.',
    findings: [
      'Kepwe does not require direct bank APIs or UPI credentials.',
      'Bring your own financial data via statement upload or manual logging.',
      'Personalized CFO insights activate as soon as financial data is present.',
    ],
    keyFindings: [
      'Kepwe does not require direct bank APIs or UPI credentials.',
      'Bring your own financial data via statement upload or manual logging.',
      'Personalized CFO insights activate as soon as financial data is present.',
    ],
    action: 'Upload Statement',
    actionObj: { label: 'Upload Statement', tab: 'upload' },
  };

  if (hasFinancialData) {
    const keyFindings = [];

    // Factual statement construction
    let messageText = '';
    let headlineText = 'Financial Position Update';

    if (totalIncome > 0 && rawTotalExpenses > 0) {
      if (prevExpenses > 0 && expenseGrowth !== null) {
        if (expenseGrowth > 0) {
          headlineText = `Spending increased ${expenseGrowth}% vs previous period`;
          const topIncrCat = topCategories[0]?.name || 'discretionary items';
          messageText = `You earned ₹${totalIncome.toLocaleString('en-IN')} this period and spent ₹${rawTotalExpenses.toLocaleString('en-IN')}. Your spending increased ${expenseGrowth}% compared with the previous period, primarily concentrated in ${topIncrCat}.`;
        } else {
          headlineText = `Spending reduced by ${Math.abs(expenseGrowth)}%`;
          messageText = `You earned ₹${totalIncome.toLocaleString('en-IN')} this period and spent ₹${rawTotalExpenses.toLocaleString('en-IN')}. Your spending decreased ${Math.abs(expenseGrowth)}% compared with the previous period, improving your financial buffer.`;
        }
      } else {
        headlineText = `Recorded ₹${totalIncome.toLocaleString('en-IN')} Income & ₹${rawTotalExpenses.toLocaleString('en-IN')} Expenses`;
        messageText = `You earned ₹${totalIncome.toLocaleString('en-IN')} and spent ₹${rawTotalExpenses.toLocaleString('en-IN')} during ${periodLabel}. Your current recorded savings rate is ${savingsRate !== null ? `${savingsRate}%` : 'N/A'}.`;
      }
    } else if (rawTotalExpenses > 0) {
      headlineText = `Recorded Expenses: ₹${rawTotalExpenses.toLocaleString('en-IN')}`;
      messageText = `You recorded ₹${rawTotalExpenses.toLocaleString('en-IN')} across ${totalTxCount} transactions in ${periodLabel}. Record income to compute your personal savings rate and surplus.`;
    } else {
      headlineText = `Recorded Inflows: ₹${totalIncome.toLocaleString('en-IN')}`;
      messageText = `You recorded ₹${totalIncome.toLocaleString('en-IN')} in income for ${periodLabel}. Record or upload your outflows to evaluate expense distribution and savings.`;
    }

    if (savingsRate !== null) {
      keyFindings.push(`Recorded savings rate: ${savingsRate}% (₹${totalSavings.toLocaleString('en-IN')} surplus).`);
    }
    if (fixedExpenses > 0) {
      const fixedPct = rawTotalExpenses > 0 ? roundMoney((fixedExpenses / rawTotalExpenses) * 100) : 0;
      keyFindings.push(`Fixed financial commitments: ₹${fixedExpenses.toLocaleString('en-IN')} (${fixedPct}% of spending).`);
    }
    if (lifestyleAmount > 0) {
      const lifePct = rawTotalExpenses > 0 ? roundMoney((lifestyleAmount / rawTotalExpenses) * 100) : 0;
      keyFindings.push(`Discretionary lifestyle spending: ₹${lifestyleAmount.toLocaleString('en-IN')} (${lifePct}% of spending).`);
    }
    if (totalInvestments > 0) {
      keyFindings.push(`Recorded investments: ₹${totalInvestments.toLocaleString('en-IN')} in wealth allocations.`);
    }

    cfoInsight = {
      hasData: true,
      headline: headlineText,
      message: messageText,
      findings: keyFindings,
      keyFindings,
      action: lifestyleAmount > 0 ? 'Review Spending' : 'View Transactions',
      actionObj: lifestyleAmount > 0 ? { label: 'Review Spending', tab: 'spending' } : { label: 'View Transactions', tab: 'transactions' },
    };
  }

  // 12. Cash Flow Series (DB time series)
  const cashFlowSeries = await calculateCashFlowSeriesDb(userId, chartInterval, startDate, endDate);

  return {
    datePreset,
    period: {
      preset: datePreset,
      start: startStr,
      end: endStr,
      label: periodLabel,
    },
    metrics: {
      // Backward compatibility keys
      totalIncome,
      totalExpenses: rawTotalExpenses,
      netPosition,
      totalReceivables,
      totalPayables,
      overdueReceivablesCount,
      overduePayablesCount,
      // PRD Monthly CFO Snapshot keys
      income: totalIncome,
      expenses: rawTotalExpenses,
      operatingExpenses,
      savings: totalSavings,
      savingsRate,
      investments: totalInvestments,
      investmentRate,
      available: availableSurplus,
    },
    financialHealth,
    cfoInsight,
    spendingOverview: {
      hasData: rawTotalExpenses > 0,
      total: rawTotalExpenses,
      totalExpenses: rawTotalExpenses,
      classifications,
      topCategories,
    },
    fixedVsVariable,
    cashFlow: {
      interval: chartInterval,
      series: cashFlowSeries,
    },
    recentTransactions,
    accounts: accountsSummary,
    dataFreshness,
    financialProfile: userProfile,
    hasFinancialData,
  };
}

async function calculateCashFlowSeriesDb(userId, interval, startDate, endDate) {
  const trunc = interval === 'weekly' ? 'week' : 'month';
  const res = await pool.query(
    `SELECT
       DATE_TRUNC('${trunc}', transaction_date) AS bucket,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
     FROM ledger_transactions
     WHERE user_id = $1 AND status = 'completed' AND transaction_date >= $2 AND transaction_date <= $3
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
  );

  return res.rows.map((row) => {
    const d = new Date(row.bucket);
    const label =
      interval === 'weekly'
        ? `Wk ${getWeekNumber(d)} (${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`
        : d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const inc = roundMoney(row.income);
    const exp = roundMoney(row.expense);
    return {
      label,
      date: d.toISOString().split('T')[0],
      income: inc,
      expense: exp,
      net: roundMoney(inc - exp),
    };
  });
}



function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

// ============================================================================
// 6. REPORTS SERVICE
// ============================================================================
export async function getFinancialReports(userId, options = {}) {
  const { reportType = 'pnl', datePreset = 'this_month', dateFrom = '', dateTo = '' } = options;
  const { startStr, endStr } = getDateRangeBounds(datePreset, dateFrom, dateTo);

  const txRes = await getTransactions(userId, { dateFrom: startStr, dateTo: endStr, datePreset: 'custom', limit: 10000 });
  const txs = txRes.transactions;
  const accounts = await getAccounts(userId);

  const incomeTxs = txs.filter((t) => t.type === 'income');
  const expenseTxs = txs.filter((t) => t.type === 'expense');

  // 1. Group By Category
  const incomeByCategory = {};
  incomeTxs.forEach((t) => {
    incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
  });

  const expenseByCategory = {};
  expenseTxs.forEach((t) => {
    expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
  });

  const totalIncome = roundMoney(incomeTxs.reduce((a, t) => a + t.amount, 0));
  const totalExpenses = roundMoney(expenseTxs.reduce((a, t) => a + t.amount, 0));
  const netProfit = roundMoney(totalIncome - totalExpenses);
  const operatingMargin = totalIncome > 0 ? roundMoney((netProfit / totalIncome) * 100) : 0;

  // 2. Receivables & Payables Aging
  const recRes = await getReceivables(userId, { limit: 1000 });
  const payRes = await getPayables(userId, { limit: 1000 });

  const now = new Date();
  const agingReceivables = { current: 0, overdue1_30: 0, overdue31_60: 0, overdue60Plus: 0, total: 0 };
  recRes.receivables.filter((r) => r.status !== 'Paid' && r.status !== 'Cancelled').forEach((r) => {
    const due = new Date(r.dueDate);
    const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));
    const amt = r.outstandingAmount;
    agingReceivables.total += amt;
    if (diffDays <= 0) agingReceivables.current += amt;
    else if (diffDays <= 30) agingReceivables.overdue1_30 += amt;
    else if (diffDays <= 60) agingReceivables.overdue31_60 += amt;
    else agingReceivables.overdue60Plus += amt;
  });

  const agingPayables = { current: 0, overdue1_30: 0, overdue31_60: 0, overdue60Plus: 0, total: 0 };
  payRes.payables.filter((p) => p.status !== 'Paid' && p.status !== 'Cancelled').forEach((p) => {
    const due = new Date(p.dueDate);
    const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));
    const amt = p.outstandingAmount;
    agingPayables.total += amt;
    if (diffDays <= 0) agingPayables.current += amt;
    else if (diffDays <= 30) agingPayables.overdue1_30 += amt;
    else if (diffDays <= 60) agingPayables.overdue31_60 += amt;
    else agingPayables.overdue60Plus += amt;
  });

  return {
    reportType,
    dateRange: { start: startStr, end: endStr, preset: datePreset },
    summary: {
      totalIncome,
      totalExpenses,
      netProfit,
      operatingMargin,
    },
    pnl: {
      incomeBreakdown: Object.entries(incomeByCategory).map(([cat, amt]) => ({ category: cat, amount: roundMoney(amt) })),
      expenseBreakdown: Object.entries(expenseByCategory).map(([cat, amt]) => ({ category: cat, amount: roundMoney(amt) })),
      totalIncome,
      totalExpenses,
      netProfit,
    },
    aging: {
      receivables: {
        current: roundMoney(agingReceivables.current),
        overdue1_30: roundMoney(agingReceivables.overdue1_30),
        overdue31_60: roundMoney(agingReceivables.overdue31_60),
        overdue60Plus: roundMoney(agingReceivables.overdue60Plus),
        total: roundMoney(agingReceivables.total),
      },
      payables: {
        current: roundMoney(agingPayables.current),
        overdue1_30: roundMoney(agingPayables.overdue1_30),
        overdue31_60: roundMoney(agingPayables.overdue31_60),
        overdue60Plus: roundMoney(agingPayables.overdue60Plus),
        total: roundMoney(agingPayables.total),
      },
    },
    accounts,
    recentTransactions: txs.slice(0, 100),
  };
}

// ============================================================================
// 7. CATEGORIES & SETTINGS
// ============================================================================
export async function getCategories(userId) {
  if (hasDb()) {
    const res = await pool.query(
      `SELECT * FROM ledger_categories WHERE user_id IS NULL OR user_id = $1 ORDER BY is_system DESC, name ASC`,
      [userId]
    );
    return res.rows;
  }
  return [
    { id: '1', type: 'income', name: 'Sales Revenue', color: '#10B981', isSystem: true },
    { id: '2', type: 'income', name: 'Consulting & Services', color: '#059669', isSystem: true },
    { id: '3', type: 'income', name: 'Interest & Investment', color: '#3B82F6', isSystem: true },
    { id: '4', type: 'income', name: 'Rental Income', color: '#6366F1', isSystem: true },
    { id: '5', type: 'income', name: 'Other Income', color: '#8B5CF6', isSystem: true },
    { id: '6', type: 'expense', name: 'Office Rent & Utilities', color: '#EF4444', isSystem: true },
    { id: '7', type: 'expense', name: 'Salaries & Contractor Fees', color: '#F59E0B', isSystem: true },
    { id: '8', type: 'expense', name: 'Software & Cloud Tools', color: '#3B82F6', isSystem: true },
    { id: '9', type: 'expense', name: 'Marketing & Advertising', color: '#EC4899', isSystem: true },
    { id: '10', type: 'expense', name: 'Inventory & Supplies', color: '#8B5CF6', isSystem: true },
    { id: '11', type: 'expense', name: 'Travel & Transport', color: '#14B8A6', isSystem: true },
    { id: '12', type: 'expense', name: 'Legal & Professional Fees', color: '#64748B', isSystem: true },
    { id: '13', type: 'expense', name: 'Taxes & Statutory Fees', color: '#DC2626', isSystem: true },
    { id: '14', type: 'expense', name: 'General & Administrative', color: '#6B7280', isSystem: true },
  ];
}

export async function createCategory(userId, data) {
  const catId = crypto.randomUUID();
  const res = await pool.query(
    `INSERT INTO ledger_categories (id, user_id, type, name, color, icon, is_system)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE)
     RETURNING *`,
    [catId, userId, data.type, data.name, data.color || '#214ECF', data.icon || 'Tag']
  );
  return res.rows[0];
}

export async function getLedgerSettings(userId) {
  const res = await pool.query(`SELECT * FROM ledger_settings WHERE user_id = $1`, [userId]);
  if (res.rows.length > 0) return mapLedgerSettingsRow(res.rows[0]);
  return {
    userId,
    businessName: '',
    gstin: '',
    pan: '',
    currency: 'INR',
    currencySymbol: '₹',
    fiscalYearStart: '04-01',
    notifyOverdue: true,
    notifyPayments: true,
  };
}

function mapLedgerSettingsRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    businessName: row.business_name || '',
    gstin: row.gstin || '',
    pan: row.pan || '',
    currency: row.currency || 'INR',
    currencySymbol: row.currency_symbol || '₹',
    fiscalYearStart: row.fiscal_year_start || '04-01',
    defaultAccountId: row.default_account_id || '',
    notifyOverdue: row.notify_overdue ?? true,
    notifyPayments: row.notify_payments ?? true,
    preferences: row.preferences || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateLedgerSettings(userId, data) {
  const res = await pool.query(
    `INSERT INTO ledger_settings
       (user_id, business_name, gstin, pan, currency, currency_symbol, fiscal_year_start, default_account_id, notify_overdue, notify_payments)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id) DO UPDATE
     SET business_name = COALESCE($2, ledger_settings.business_name),
         gstin = COALESCE($3, ledger_settings.gstin),
         pan = COALESCE($4, ledger_settings.pan),
         currency = COALESCE($5, ledger_settings.currency),
         currency_symbol = COALESCE($6, ledger_settings.currency_symbol),
         fiscal_year_start = COALESCE($7, ledger_settings.fiscal_year_start),
         default_account_id = COALESCE($8, ledger_settings.default_account_id),
         notify_overdue = COALESCE($9, ledger_settings.notify_overdue),
         notify_payments = COALESCE($10, ledger_settings.notify_payments),
         updated_at = NOW()
     RETURNING *`,
    [
      userId,
      data.businessName || null,
      data.gstin || null,
      data.pan || null,
      data.currency || 'INR',
      data.currencySymbol || '₹',
      data.fiscalYearStart || '04-01',
      data.defaultAccountId || null,
      data.notifyOverdue ?? true,
      data.notifyPayments ?? true,
    ]
  );
  return mapLedgerSettingsRow(res.rows[0]);
}

// ============================================================================
// PHASE 6: ADD / UPLOAD FINANCIAL DATA PERSISTENCE & SERVICES
// ============================================================================

export async function commitImportedTransactions(userId, data) {
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  if (transactions.length === 0) {
    throw new Error('No confirmed transactions provided for import.');
  }

  const client = await pool.connect();
  const importId = crypto.randomUUID();
  let importedCount = 0;
  let netDelta = 0;

  try {
    await client.query('BEGIN');

    // 1. Create statement import record
    await client.query(
      `INSERT INTO ledger_statement_imports 
         (id, user_id, account_id, file_name, file_type, source_type, institution, closing_balance, imported_count, duplicate_count, status, raw_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMPLETED', $11)`,
      [
        importId,
        userId,
        data.accountId || null,
        data.fileName || 'Imported Statement',
        data.fileType || 'CSV',
        data.sourceType || 'BANK_STATEMENT',
        data.institution || null,
        data.closingBalance !== undefined && data.closingBalance !== null ? roundMoney(data.closingBalance) : null,
        transactions.length,
        data.duplicateCount || 0,
        JSON.stringify({ originalCount: data.originalCount || transactions.length }),
      ]
    );

    // 2. Insert each confirmed transaction
    for (const tx of transactions) {
      const txId = crypto.randomUUID();
      const amount = roundMoney(tx.amount);
      const txDate = tx.date || new Date().toISOString().slice(0, 10);
      const txType = tx.type || 'expense';
      const category = tx.category || (txType === 'income' ? 'Other Income' : 'Uncategorized Expense');
      const merchant = tx.merchant || tx.counterparty || null;
      const counterparty = tx.counterparty || merchant;
      const classification = tx.classification || determineDefaultClassification(category, merchant);
      const isRecurring = Boolean(tx.isRecurring);
      const isEssential = tx.isEssential !== undefined && tx.isEssential !== null ? Boolean(tx.isEssential) : (classification === 'Essential');
      const confidence = tx.confidence !== undefined ? Number(tx.confidence) : 1.0;
      const paymentMethod = tx.paymentMethod || 'UPI';
      const referenceNumber = tx.referenceNumber || null;
      const description = tx.description || `${txType.toUpperCase()} - ${merchant || category}`;
      const notes = tx.notes || null;
      const debit = txType === 'expense' ? amount : 0;
      const credit = txType === 'income' ? amount : 0;

      // Fingerprint for deduplication
      const txFingerprint = crypto.createHash('sha256').update([
        userId, txDate, description, debit, credit, referenceNumber, merchant
      ].map((v) => String(v || '').trim().toLowerCase()).join('|')).digest('hex');

      await client.query(
        `INSERT INTO ledger_transactions
           (id, user_id, account_id, statement_import_id, type, amount, transaction_date, category, counterparty, merchant, subcategory, classification, is_recurring, is_essential, confidence, description, payment_method, reference_number, status, source, debit, credit, transaction_type, fingerprint, balance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'completed', 'STATEMENT_IMPORT', $19, $20, $21, $22, $23)`,
        [
          txId,
          userId,
          data.accountId || null,
          importId,
          txType,
          amount,
          txDate,
          category,
          counterparty,
          merchant,
          tx.subcategory || null,
          classification,
          isRecurring,
          isEssential,
          confidence,
          description,
          paymentMethod,
          referenceNumber,
          debit,
          credit,
          txType.toUpperCase(),
          txFingerprint,
          tx.balance !== undefined && tx.balance !== null ? roundMoney(tx.balance) : null,
        ]
      );

      importedCount++;
      if (txType === 'income') netDelta += amount;
      else if (txType === 'expense') netDelta -= amount;
    }

    // 3. Update account balance if accountId provided
    if (data.accountId) {
      if (data.closingBalance !== undefined && data.closingBalance !== null) {
        await client.query(
          `UPDATE ledger_accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
          [roundMoney(data.closingBalance), data.accountId, userId]
        );
      } else if (netDelta !== 0) {
        await client.query(
          `UPDATE ledger_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
          [netDelta, data.accountId, userId]
        );
      }
    }

    await client.query('COMMIT');
    await recordAuditLog(userId, 'IMPORT', 'STATEMENT', importId, { importedCount, sourceType: data.sourceType });
    return {
      importId,
      importedCount,
      duplicateCount: data.duplicateCount || 0,
      accountId: data.accountId || null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function recordMonthlyIncome(userId, data) {
  const amount = roundMoney(data.amount);
  if (!(amount > 0)) throw new Error('Income amount must be greater than zero.');

  const incomeType = data.sourceType || 'salary';
  const categoryMap = {
    salary: 'Salary',
    business: 'Business Income',
    freelance: 'Freelance Income',
    rental: 'Rental Income',
    other: 'Other Income',
  };
  const category = categoryMap[incomeType] || 'Salary';
  const merchant = data.employerOrClient || category;
  const txDate = data.depositDate || new Date().toISOString().slice(0, 10);
  const isRecurring = data.isRecurring !== false;

  // 1. Update Financial Profile
  const profileFields = {
    salary: 'salary_income = $2::numeric, monthly_income = $2::numeric',
    business: 'business_income = $2::numeric',
    freelance: 'freelance_income = $2::numeric',
    rental: 'rental_income = $2::numeric',
    other: 'other_income = $2::numeric',
  };
  const fieldUpdate = profileFields[incomeType] || 'salary_income = $2::numeric, monthly_income = $2::numeric';

  await pool.query(
    `INSERT INTO ledger_financial_profiles (user_id, monthly_income, salary_income, business_income, freelance_income, rental_income, other_income)
     VALUES ($1, $2::numeric, CASE WHEN $3 = 'salary' THEN $2::numeric ELSE 0.00 END, CASE WHEN $3 = 'business' THEN $2::numeric ELSE 0.00 END, CASE WHEN $3 = 'freelance' THEN $2::numeric ELSE 0.00 END, CASE WHEN $3 = 'rental' THEN $2::numeric ELSE 0.00 END, CASE WHEN $3 = 'other' THEN $2::numeric ELSE 0.00 END)
     ON CONFLICT (user_id) DO UPDATE
     SET ${fieldUpdate}, updated_at = NOW()`,
    [userId, amount, incomeType]
  );

  // 2. Insert Transaction Record
  const txId = crypto.randomUUID();
  const res = await pool.query(
    `INSERT INTO ledger_transactions
       (id, user_id, account_id, type, amount, transaction_date, category, counterparty, merchant, classification, is_recurring, is_essential, confidence, description, payment_method, status, source, debit, credit, transaction_type)
     VALUES ($1, $2, $3, 'income', $4, $5, $6, $7, $7, 'Essential', $8, TRUE, 1.0, $9, 'Bank Transfer', 'completed', 'MANUAL', 0, $4, 'INCOME')
     RETURNING *`,
    [
      txId,
      userId,
      data.accountId || null,
      amount,
      txDate,
      category,
      merchant,
      isRecurring,
      data.notes || `Monthly ${category} credit`,
    ]
  );

  // 3. Update account balance if provided
  if (data.accountId) {
    await pool.query(
      `UPDATE ledger_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [amount, data.accountId, userId]
    );
  }

  await recordAuditLog(userId, 'CREATE', 'MONTHLY_INCOME', txId, { amount, incomeType, category });
  const profile = await getFinancialProfile(userId);
  return {
    transaction: mapTransactionRow(res.rows[0]),
    profile,
  };
}

export async function recordRecurringExpense(userId, data) {
  const amount = roundMoney(data.amount);
  if (!(amount > 0)) throw new Error('Expense amount must be greater than zero.');

  const expenseType = data.expenseType || 'Utility';
  const categoryMap = {
    Rent: { category: 'Housing & Rent', classification: 'Essential', subcategory: 'Rent' },
    EMI: { category: 'Loan EMI', classification: 'Essential', subcategory: 'Debt Repayment' },
    Insurance: { category: 'Insurance', classification: 'Essential', subcategory: 'Insurance' },
    Utility: { category: 'Utilities', classification: 'Essential', subcategory: 'Electricity' },
    Internet: { category: 'Utilities', classification: 'Essential', subcategory: 'Internet' },
    Subscription: { category: 'Entertainment & Subscriptions', classification: 'Lifestyle', subcategory: 'Streaming' },
  };

  const meta = categoryMap[expenseType] || { category: 'General & Administrative', classification: 'Essential', subcategory: null };
  const classification = data.classification || meta.classification;
  const merchant = data.payee || expenseType;
  const txDate = data.dueDate || new Date().toISOString().slice(0, 10);

  if (expenseType === 'EMI') {
    await pool.query(
      `INSERT INTO ledger_financial_profiles (user_id, monthly_debt_obligations)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET monthly_debt_obligations = GREATEST(ledger_financial_profiles.monthly_debt_obligations, $2), updated_at = NOW()`,
      [userId, amount]
    );
  }

  const txId = crypto.randomUUID();
  const res = await pool.query(
    `INSERT INTO ledger_transactions
       (id, user_id, account_id, type, amount, transaction_date, category, counterparty, merchant, subcategory, classification, is_recurring, is_essential, confidence, description, payment_method, status, source, debit, credit, transaction_type, notes)
     VALUES ($1, $2, $3, 'expense', $4, $5, $6, $7, $7, $8, $9, TRUE, $10, 1.0, $11, $12, 'completed', 'MANUAL', $4, 0, 'EXPENSE', $13)
     RETURNING *`,
    [
      txId,
      userId,
      data.accountId || null,
      amount,
      txDate,
      meta.category,
      merchant,
      meta.subcategory,
      classification,
      classification === 'Essential',
      data.description || `Recurring ${expenseType}: ${merchant}`,
      data.paymentMethod || 'UPI',
      data.notes || `Recurring ${data.frequency || 'monthly'} obligation`,
    ]
  );

  if (data.accountId) {
    await pool.query(
      `UPDATE ledger_accounts SET current_balance = current_balance - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [amount, data.accountId, userId]
    );
  }

  await recordAuditLog(userId, 'CREATE', 'RECURRING_EXPENSE', txId, { amount, expenseType, merchant });
  return {
    transaction: mapTransactionRow(res.rows[0]),
  };
}

export async function getImportHistory(userId, historyStart = null) {
  const res = await pool.query(
    `SELECT i.id, i.file_name, i.file_type, i.source_type, i.institution, i.closing_balance,
            i.imported_count, i.duplicate_count, i.failed_count, i.status, i.created_at,
            a.name AS account_name
     FROM ledger_statement_imports i
     LEFT JOIN ledger_accounts a ON a.id = i.account_id
    WHERE i.user_id = $1 AND ($2::date IS NULL OR i.created_at >= $2::date)
     ORDER BY i.created_at DESC
     LIMIT 50`,
      [userId, historyStart]
  );
  return res.rows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    fileType: r.file_type,
    sourceType: r.source_type || 'BANK_STATEMENT',
    institution: r.institution || 'Direct Statement',
    closingBalance: r.closing_balance !== null ? Number(r.closing_balance) : null,
    importedCount: r.imported_count,
    duplicateCount: r.duplicate_count,
    failedCount: r.failed_count,
    status: r.status,
    accountName: r.account_name || 'Unassigned Account',
    createdAt: r.created_at,
  }));
}

