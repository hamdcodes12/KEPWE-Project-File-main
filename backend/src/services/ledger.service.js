import { pool } from '../config/db.js';
import crypto from 'crypto';

// ── In-Memory Fallback Store (for Local Dev when DB URL is not set) ───────────
const inMemoryStore = {
  accounts: new Map(),
  transactions: new Map(),
  receivables: new Map(),
  receivablePayments: new Map(),
  payables: new Map(),
  payablePayments: new Map(),
  categories: new Map(),
  settings: new Map(),
  auditLogs: new Map(),
};

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

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
  if (hasDb()) {
    try {
      await pool.query(
        `INSERT INTO ledger_audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, action, entityType, entityId, JSON.stringify(details || {})]
      );
    } catch (err) {
      console.warn('[ledger:audit] DB audit write failed:', err.message);
    }
  } else {
    const list = inMemoryStore.auditLogs.get(userId) || [];
    list.unshift({
      id: crypto.randomUUID(),
      userId,
      action,
      entityType,
      entityId,
      details,
      createdAt: new Date().toISOString(),
    });
    inMemoryStore.auditLogs.set(userId, list.slice(0, 100));
  }
}

// ============================================================================
// 1. ACCOUNTS SERVICE
// ============================================================================
export async function getAccounts(userId) {
  if (hasDb()) {
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

  // Fallback
  const list = inMemoryStore.accounts.get(userId) || [];
  const txs = inMemoryStore.transactions.get(userId) || [];
  return list.map((a) => {
    const sum = txs
      .filter((t) => t.accountId === a.id && t.status === 'completed')
      .reduce((acc, t) => (t.type === 'income' ? acc + t.amount : t.type === 'expense' ? acc - t.amount : acc), 0);
    return {
      ...a,
      currentBalance: roundMoney(a.openingBalance + sum),
    };
  });
}

export async function createAccount(userId, data) {
  const openingBalance = roundMoney(data.openingBalance || 0);
  const accountId = crypto.randomUUID();

  if (hasDb()) {
    if (data.isDefault) {
      await pool.query(`UPDATE ledger_accounts SET is_default = FALSE WHERE user_id = $1`, [userId]);
    }
    const res = await pool.query(
      `INSERT INTO ledger_accounts
         (id, user_id, name, type, account_number, bank_name, ifsc_code, upi_id, opening_balance, current_balance, currency, is_default, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        accountId,
        userId,
        data.name,
        data.type || 'Bank Account',
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
    await recordAuditLog(userId, 'CREATE', 'ACCOUNT', accountId, { name: data.name });
    const row = res.rows[0];
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

  // Fallback
  const list = inMemoryStore.accounts.get(userId) || [];
  if (data.isDefault) {
    list.forEach((acc) => (acc.isDefault = false));
  }
  const newAcc = {
    id: accountId,
    name: data.name,
    type: data.type || 'Bank Account',
    accountNumber: data.accountNumber || null,
    bankName: data.bankName || null,
    ifscCode: data.ifscCode || null,
    upiId: data.upiId || null,
    openingBalance,
    currentBalance: openingBalance,
    currency: data.currency || 'INR',
    isDefault: Boolean(data.isDefault) || list.length === 0,
    isActive: true,
    notes: data.notes || null,
    createdAt: new Date().toISOString(),
  };
  list.push(newAcc);
  inMemoryStore.accounts.set(userId, list);
  await recordAuditLog(userId, 'CREATE', 'ACCOUNT', accountId, { name: data.name });
  return newAcc;
}

export async function updateAccount(userId, accountId, data) {
  if (hasDb()) {
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

  // Fallback
  const list = inMemoryStore.accounts.get(userId) || [];
  const idx = list.findIndex((a) => a.id === accountId);
  if (idx === -1) return null;
  if (data.isDefault) list.forEach((a) => (a.isDefault = false));
  list[idx] = { ...list[idx], ...data };
  inMemoryStore.accounts.set(userId, list);
  await recordAuditLog(userId, 'UPDATE', 'ACCOUNT', accountId, data);
  return list[idx];
}

export async function deleteAccount(userId, accountId) {
  if (hasDb()) {
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

  const list = inMemoryStore.accounts.get(userId) || [];
  const filtered = list.filter((a) => a.id !== accountId);
  inMemoryStore.accounts.set(userId, filtered);
  await recordAuditLog(userId, 'DELETE', 'ACCOUNT', accountId, {});
  return true;
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

  if (hasDb()) {
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

  // Fallback
  let list = inMemoryStore.transactions.get(userId) || [];
  const accounts = inMemoryStore.accounts.get(userId) || [];
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  if (startStr && datePreset !== 'all') list = list.filter((t) => t.transactionDate >= startStr);
  if (endStr && datePreset !== 'all') list = list.filter((t) => t.transactionDate <= endStr);
  if (type) list = list.filter((t) => t.type === type);
  if (category) list = list.filter((t) => t.category === category);
  if (accountId) list = list.filter((t) => t.accountId === accountId);
  if (counterparty) list = list.filter((t) => (t.counterparty || '').toLowerCase().includes(counterparty.toLowerCase()));
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(
      (t) =>
        (t.description || '').toLowerCase().includes(s) ||
        (t.counterparty || '').toLowerCase().includes(s) ||
        (t.referenceNumber || '').toLowerCase().includes(s) ||
        (t.category || '').toLowerCase().includes(s)
    );
  }

  list.sort((a, b) => {
    if (sortBy === 'amount') return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    return sortOrder === 'asc'
      ? new Date(a.transactionDate) - new Date(b.transactionDate)
      : new Date(b.transactionDate) - new Date(a.transactionDate);
  });

  const totalCount = list.length;
  const offset = (Math.max(1, page) - 1) * limit;
  const paginated = list.slice(offset, offset + limit).map((t) => ({
    ...t,
    accountName: accMap.get(t.accountId)?.name || 'Direct / Cash',
    accountType: accMap.get(t.accountId)?.type || 'Cash',
  }));

  return {
    transactions: paginated,
    totalCount,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(totalCount / limit) || 1,
  };
}

function mapTransactionRow(row) {
  return {
    id: row.id,
    type: row.type,
    amount: roundMoney(row.amount),
    transactionDate: row.transaction_date instanceof Date ? row.transaction_date.toISOString().split('T')[0] : String(row.transaction_date).split('T')[0],
    category: row.category,
    counterparty: row.counterparty || '',
    description: row.description || '',
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
    createdAt: row.created_at,
  };
}

export async function createTransaction(userId, data) {
  const amount = roundMoney(data.amount);
  if (amount <= 0) throw new Error('Transaction amount must be greater than zero.');
  const txId = crypto.randomUUID();
  const txDate = data.transactionDate || new Date().toISOString().split('T')[0];

  if (hasDb()) {
    const res = await pool.query(
      `INSERT INTO ledger_transactions
         (id, user_id, account_id, type, amount, transaction_date, category, counterparty, description, payment_method, reference_number, status, receivable_id, payable_id, notes, attachment_url, attachment_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        txId,
        userId,
        data.accountId || null,
        data.type,
        amount,
        txDate,
        data.category || 'General',
        data.counterparty || null,
        data.description || null,
        data.paymentMethod || 'UPI',
        data.referenceNumber || null,
        data.status || 'completed',
        data.receivableId || null,
        data.payableId || null,
        data.notes || null,
        data.attachmentUrl || null,
        data.attachmentName || null,
      ]
    );

    // Sync account balance
    if (data.accountId && data.status === 'completed') {
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

  // Fallback
  const list = inMemoryStore.transactions.get(userId) || [];
  const newTx = {
    id: txId,
    userId,
    accountId: data.accountId || null,
    type: data.type,
    amount,
    transactionDate: txDate,
    category: data.category || 'General',
    counterparty: data.counterparty || '',
    description: data.description || '',
    paymentMethod: data.paymentMethod || 'UPI',
    referenceNumber: data.referenceNumber || '',
    status: data.status || 'completed',
    receivableId: data.receivableId || null,
    payableId: data.payableId || null,
    notes: data.notes || '',
    attachmentUrl: data.attachmentUrl || null,
    attachmentName: data.attachmentName || null,
    createdAt: new Date().toISOString(),
  };
  list.unshift(newTx);
  inMemoryStore.transactions.set(userId, list);
  await recordAuditLog(userId, 'CREATE', 'TRANSACTION', txId, { amount, type: data.type });
  return newTx;
}

export async function updateTransaction(userId, txId, data) {
  if (hasDb()) {
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

  // Fallback
  const list = inMemoryStore.transactions.get(userId) || [];
  const idx = list.findIndex((t) => t.id === txId);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...data, amount: data.amount ? roundMoney(data.amount) : list[idx].amount };
  inMemoryStore.transactions.set(userId, list);
  await recordAuditLog(userId, 'UPDATE', 'TRANSACTION', txId, data);
  return list[idx];
}

export async function deleteTransaction(userId, txId) {
  if (hasDb()) {
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

  const list = inMemoryStore.transactions.get(userId) || [];
  const filtered = list.filter((t) => t.id !== txId);
  inMemoryStore.transactions.set(userId, filtered);
  await recordAuditLog(userId, 'DELETE', 'TRANSACTION', txId, {});
  return true;
}

// ============================================================================
// 3. RECEIVABLES (INVOICES) SERVICE
// ============================================================================
export async function getReceivables(userId, filters = {}) {
  const { search = '', status = '', dateFrom = '', dateTo = '', page = 1, limit = 50 } = filters;

  if (hasDb()) {
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

  // Fallback
  let list = inMemoryStore.receivables.get(userId) || [];
  if (status) list = list.filter((r) => r.status === status);
  if (dateFrom) list = list.filter((r) => r.dueDate >= dateFrom);
  if (dateTo) list = list.filter((r) => r.dueDate <= dateTo);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(
      (r) => (r.customerName || '').toLowerCase().includes(s) || (r.invoiceNumber || '').toLowerCase().includes(s)
    );
  }
  const totalCount = list.length;
  const offset = (Math.max(1, page) - 1) * limit;
  return {
    receivables: list.slice(offset, offset + limit),
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
    issueDate: row.issue_date instanceof Date ? row.issue_date.toISOString().split('T')[0] : String(row.issue_date).split('T')[0],
    dueDate: row.due_date instanceof Date ? row.due_date.toISOString().split('T')[0] : String(row.due_date).split('T')[0],
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

  if (hasDb()) {
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

  // Fallback
  const list = inMemoryStore.receivables.get(userId) || [];
  const newRec = {
    id: recId,
    userId,
    invoiceNumber,
    customerName: data.customerName,
    customerEmail: data.customerEmail || '',
    customerPhone: data.customerPhone || '',
    customerGstin: data.customerGstin || '',
    issueDate,
    dueDate,
    subtotal,
    taxAmount,
    totalAmount,
    paidAmount: 0,
    outstandingAmount: totalAmount,
    status: data.status || 'Pending',
    items: data.items || [],
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  };
  list.unshift(newRec);
  inMemoryStore.receivables.set(userId, list);
  await recordAuditLog(userId, 'CREATE', 'RECEIVABLE', recId, { invoiceNumber, totalAmount });
  return newRec;
}

export async function recordReceivablePayment(userId, invoiceId, data) {
  const payAmount = roundMoney(data.amount);
  if (payAmount <= 0) throw new Error('Payment amount must be greater than zero.');

  if (hasDb()) {
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

  // Fallback
  const list = inMemoryStore.receivables.get(userId) || [];
  const rec = list.find((r) => r.id === invoiceId);
  if (!rec) throw new Error('Invoice not found.');

  const remaining = roundMoney(rec.totalAmount - rec.paidAmount);
  if (payAmount > remaining + 0.01) {
    throw new Error(`Payment amount (₹${payAmount}) exceeds outstanding balance (₹${remaining}).`);
  }

  rec.paidAmount = roundMoney(rec.paidAmount + payAmount);
  rec.outstandingAmount = roundMoney(Math.max(0, rec.totalAmount - rec.paidAmount));
  rec.status = rec.paidAmount >= rec.totalAmount ? 'Paid' : 'Partially Paid';

  const tx = await createTransaction(userId, {
    type: 'income',
    amount: payAmount,
    transactionDate: data.paymentDate || new Date().toISOString().split('T')[0],
    category: 'Sales Revenue',
    counterparty: rec.customerName,
    description: `Payment for Invoice #${rec.invoiceNumber}`,
    accountId: data.accountId || null,
    paymentMethod: data.paymentMethod || 'UPI',
    referenceNumber: data.referenceNumber || null,
    receivableId: invoiceId,
  });

  const payHistory = inMemoryStore.receivablePayments.get(invoiceId) || [];
  payHistory.unshift({
    id: crypto.randomUUID(),
    receivableId: invoiceId,
    amount: payAmount,
    paymentDate: data.paymentDate || new Date().toISOString().split('T')[0],
    paymentMethod: data.paymentMethod || 'UPI',
    referenceNumber: data.referenceNumber || '',
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  });
  inMemoryStore.receivablePayments.set(invoiceId, payHistory);

  await recordAuditLog(userId, 'PAYMENT_RECORDED', 'RECEIVABLE', invoiceId, { amount: payAmount });
  return { receivable: rec, transaction: tx };
}

export async function deleteReceivable(userId, invoiceId) {
  if (hasDb()) {
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
  const list = inMemoryStore.receivables.get(userId) || [];
  inMemoryStore.receivables.set(userId, list.filter((r) => r.id !== invoiceId));
  await recordAuditLog(userId, 'DELETE', 'RECEIVABLE', invoiceId, {});
  return true;
}

// ============================================================================
// 4. PAYABLES (VENDOR BILLS) SERVICE
// ============================================================================
export async function getPayables(userId, filters = {}) {
  const { search = '', status = '', dateFrom = '', dateTo = '', page = 1, limit = 50 } = filters;

  if (hasDb()) {
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

  // Fallback
  let list = inMemoryStore.payables.get(userId) || [];
  if (status) list = list.filter((p) => p.status === status);
  if (dateFrom) list = list.filter((p) => p.dueDate >= dateFrom);
  if (dateTo) list = list.filter((p) => p.dueDate <= dateTo);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(
      (p) => (p.vendorName || '').toLowerCase().includes(s) || (p.billNumber || '').toLowerCase().includes(s)
    );
  }
  const totalCount = list.length;
  const offset = (Math.max(1, page) - 1) * limit;
  return {
    payables: list.slice(offset, offset + limit),
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
    billDate: row.bill_date instanceof Date ? row.bill_date.toISOString().split('T')[0] : String(row.bill_date).split('T')[0],
    dueDate: row.due_date instanceof Date ? row.due_date.toISOString().split('T')[0] : String(row.due_date).split('T')[0],
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

  if (hasDb()) {
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

  // Fallback
  const list = inMemoryStore.payables.get(userId) || [];
  const newBill = {
    id: billId,
    userId,
    billNumber,
    vendorName: data.vendorName,
    vendorEmail: data.vendorEmail || '',
    vendorPhone: data.vendorPhone || '',
    vendorGstin: data.vendorGstin || '',
    category: data.category || 'Purchases',
    billDate,
    dueDate,
    subtotal,
    taxAmount,
    totalAmount,
    paidAmount: 0,
    outstandingAmount: totalAmount,
    status: data.status || 'Pending',
    items: data.items || [],
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  };
  list.unshift(newBill);
  inMemoryStore.payables.set(userId, list);
  await recordAuditLog(userId, 'CREATE', 'PAYABLE', billId, { billNumber, totalAmount });
  return newBill;
}

export async function recordPayablePayment(userId, billId, data) {
  const payAmount = roundMoney(data.amount);
  if (payAmount <= 0) throw new Error('Payment amount must be greater than zero.');

  if (hasDb()) {
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

  // Fallback
  const list = inMemoryStore.payables.get(userId) || [];
  const bill = list.find((p) => p.id === billId);
  if (!bill) throw new Error('Bill not found.');

  const remaining = roundMoney(bill.totalAmount - bill.paidAmount);
  if (payAmount > remaining + 0.01) {
    throw new Error(`Payment amount (₹${payAmount}) exceeds outstanding balance (₹${remaining}).`);
  }

  bill.paidAmount = roundMoney(bill.paidAmount + payAmount);
  bill.outstandingAmount = roundMoney(Math.max(0, bill.totalAmount - bill.paidAmount));
  bill.status = bill.paidAmount >= bill.totalAmount ? 'Paid' : 'Partially Paid';

  const tx = await createTransaction(userId, {
    type: 'expense',
    amount: payAmount,
    transactionDate: data.paymentDate || new Date().toISOString().split('T')[0],
    category: bill.category || 'Purchases',
    counterparty: bill.vendorName,
    description: `Payment for Bill #${bill.billNumber}`,
    accountId: data.accountId || null,
    paymentMethod: data.paymentMethod || 'Bank Transfer',
    referenceNumber: data.referenceNumber || null,
    payableId: billId,
  });

  const payHistory = inMemoryStore.payablePayments.get(billId) || [];
  payHistory.unshift({
    id: crypto.randomUUID(),
    payableId: billId,
    amount: payAmount,
    paymentDate: data.paymentDate || new Date().toISOString().split('T')[0],
    paymentMethod: data.paymentMethod || 'Bank Transfer',
    referenceNumber: data.referenceNumber || '',
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  });
  inMemoryStore.payablePayments.set(billId, payHistory);

  await recordAuditLog(userId, 'PAYMENT_RECORDED', 'PAYABLE', billId, { amount: payAmount });
  return { payable: bill, transaction: tx };
}

export async function deletePayable(userId, billId) {
  if (hasDb()) {
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
  const list = inMemoryStore.payables.get(userId) || [];
  inMemoryStore.payables.set(userId, list.filter((p) => p.id !== billId));
  await recordAuditLog(userId, 'DELETE', 'PAYABLE', billId, {});
  return true;
}

// ============================================================================
// 5. DASHBOARD AGGREGATIONS SERVICE
// ============================================================================
export async function getDashboardData(userId, query = {}) {
  const { datePreset = 'this_month', dateFrom = '', dateTo = '', chartInterval = 'monthly' } = query;
  const { startStr, endStr, startDate, endDate } = getDateRangeBounds(datePreset, dateFrom, dateTo);

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalReceivables = 0;
  let totalPayables = 0;
  let recentTransactions = [];
  let accountsSummary = [];
  let cashFlowSeries = [];
  let overdueReceivablesCount = 0;
  let overduePayablesCount = 0;

  if (hasDb()) {
    // 1. Transactions Aggregation for Selected Date Range
    const txAgg = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
       FROM ledger_transactions
       WHERE user_id = $1 AND status = 'completed' AND transaction_date >= $2 AND transaction_date <= $3`,
      [userId, startStr, endStr]
    );
    totalIncome = roundMoney(txAgg.rows[0].total_income);
    totalExpenses = roundMoney(txAgg.rows[0].total_expense);

    // 2. Receivables & Payables (Outstanding Dues)
    const recAgg = await pool.query(
      `SELECT
         COALESCE(SUM(total_amount - paid_amount), 0) AS total_outstanding,
         COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('Paid', 'Cancelled')) AS overdue_count
       FROM ledger_receivables
       WHERE user_id = $1 AND status NOT IN ('Paid', 'Cancelled')`,
      [userId]
    );
    totalReceivables = roundMoney(recAgg.rows[0].total_outstanding);
    overdueReceivablesCount = parseInt(recAgg.rows[0].overdue_count, 10) || 0;

    const payAgg = await pool.query(
      `SELECT
         COALESCE(SUM(total_amount - paid_amount), 0) AS total_outstanding,
         COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('Paid', 'Cancelled')) AS overdue_count
       FROM ledger_payables
       WHERE user_id = $1 AND status NOT IN ('Paid', 'Cancelled')`,
      [userId]
    );
    totalPayables = roundMoney(payAgg.rows[0].total_outstanding);
    overduePayablesCount = parseInt(payAgg.rows[0].overdue_count, 10) || 0;

    // 3. Recent Transactions (Top 8)
    const recentRes = await pool.query(
      `SELECT t.*, a.name AS account_name, a.type AS account_type
       FROM ledger_transactions t
       LEFT JOIN ledger_accounts a ON a.id = t.account_id
       WHERE t.user_id = $1
       ORDER BY t.transaction_date DESC, t.created_at DESC
       LIMIT 8`,
      [userId]
    );
    recentTransactions = recentRes.rows.map(mapTransactionRow);

    // 4. Accounts Summary
    accountsSummary = await getAccounts(userId);

    // 5. Cash Flow Time Series
    cashFlowSeries = await calculateCashFlowSeriesDb(userId, chartInterval, startDate, endDate);
  } else {
    // Fallback in-memory aggregation
    const txs = (inMemoryStore.transactions.get(userId) || []).filter((t) => t.status === 'completed');
    const recs = inMemoryStore.receivables.get(userId) || [];
    const pays = inMemoryStore.payables.get(userId) || [];

    const inRangeTxs = txs.filter((t) => t.transactionDate >= startStr && t.transactionDate <= endStr);
    totalIncome = roundMoney(inRangeTxs.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0));
    totalExpenses = roundMoney(inRangeTxs.filter((t) => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0));

    const activeRecs = recs.filter((r) => r.status !== 'Paid' && r.status !== 'Cancelled');
    totalReceivables = roundMoney(activeRecs.reduce((acc, r) => acc + (r.totalAmount - r.paidAmount), 0));
    overdueReceivablesCount = activeRecs.filter((r) => new Date(r.dueDate) < new Date()).length;

    const activePays = pays.filter((p) => p.status !== 'Paid' && p.status !== 'Cancelled');
    totalPayables = roundMoney(activePays.reduce((acc, p) => acc + (p.totalAmount - p.paidAmount), 0));
    overduePayablesCount = activePays.filter((p) => new Date(p.dueDate) < new Date()).length;

    const accounts = inMemoryStore.accounts.get(userId) || [];
    const accMap = new Map(accounts.map((a) => [a.id, a]));
    recentTransactions = txs.slice(0, 8).map((t) => ({
      ...t,
      accountName: accMap.get(t.accountId)?.name || 'Direct',
      accountType: accMap.get(t.accountId)?.type || 'Cash',
    }));

    accountsSummary = await getAccounts(userId);
    cashFlowSeries = calculateCashFlowSeriesMem(inRangeTxs, chartInterval, startDate, endDate);
  }

  const netPosition = roundMoney(totalIncome - totalExpenses);

  return {
    datePreset,
    dateRange: { start: startStr, end: endStr },
    metrics: {
      totalIncome,
      totalExpenses,
      netPosition,
      totalReceivables,
      totalPayables,
      overdueReceivablesCount,
      overduePayablesCount,
    },
    cashFlow: {
      interval: chartInterval,
      series: cashFlowSeries,
    },
    recentTransactions,
    accounts: accountsSummary,
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

function calculateCashFlowSeriesMem(txs, interval, startDate, endDate) {
  const buckets = new Map();
  txs.forEach((t) => {
    const d = new Date(t.transactionDate);
    const key =
      interval === 'weekly'
        ? `Wk ${getWeekNumber(d)}`
        : d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!buckets.has(key)) {
      buckets.set(key, { label: key, date: t.transactionDate, income: 0, expense: 0 });
    }
    const b = buckets.get(key);
    if (t.type === 'income') b.income += t.amount;
    if (t.type === 'expense') b.expense += t.amount;
  });

  return Array.from(buckets.values()).map((b) => ({
    ...b,
    income: roundMoney(b.income),
    expense: roundMoney(b.expense),
    net: roundMoney(b.income - b.expense),
  }));
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
  if (hasDb()) {
    const res = await pool.query(
      `INSERT INTO ledger_categories (id, user_id, type, name, color, icon, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING *`,
      [catId, userId, data.type, data.name, data.color || '#214ECF', data.icon || 'Tag']
    );
    return res.rows[0];
  }
  const newCat = {
    id: catId,
    type: data.type,
    name: data.name,
    color: data.color || '#214ECF',
    icon: data.icon || 'Tag',
    isSystem: false,
  };
  const list = inMemoryStore.categories.get(userId) || [];
  list.push(newCat);
  inMemoryStore.categories.set(userId, list);
  return newCat;
}

export async function getLedgerSettings(userId) {
  if (hasDb()) {
    const res = await pool.query(`SELECT * FROM ledger_settings WHERE user_id = $1`, [userId]);
    if (res.rows.length > 0) return mapLedgerSettingsRow(res.rows[0]);
  }
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
  if (hasDb()) {
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
  const updated = { ...data, userId };
  inMemoryStore.settings.set(userId, updated);
  return updated;
}
