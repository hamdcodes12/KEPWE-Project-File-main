import crypto from 'crypto';
import { pool } from '../config/db.js';
import { AccountAggregatorAdapter } from '../integrations/account-aggregator-adapter.js';
import * as providerService from './ledger-provider.service.js';

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const dateOnly = (value) => String(value || new Date().toISOString()).slice(0, 10);

function fingerprint(userId, row) {
  return crypto.createHash('sha256').update([
    userId, row.transactionDate, row.description, row.debit, row.credit, row.referenceNumber, row.bank
  ].map((value) => String(value || '').trim().toLowerCase()).join('|')).digest('hex');
}

function mapTransaction(row) {
  return {
    id: row.id, transactionDate: dateOnly(row.transaction_date), description: row.description || '',
    debit: money(row.debit), credit: money(row.credit), amount: money(row.amount),
    balance: row.running_balance === null ? null : money(row.running_balance),
    referenceNumber: row.reference_number || '', transactionType: row.transaction_type || row.type,
    bank: row.bank || '', type: row.type, category: row.category, source: row.source,
    accountId: row.account_id, status: row.status, reconciledAt: row.reconciled_at,
  };
}

function providerConfig(provider) {
  const key = String(provider || '').toUpperCase();
  if (key === 'RAZORPAY') return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  if (key === 'CASHFREE') return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
  if (key === 'AA') return Boolean(process.env.AA_CLIENT_ID && process.env.AA_CLIENT_SECRET && process.env.AA_FIU_ID && process.env.AA_BASE_URL);
  return false;
}

export function getIntegrationStatus() {
  return ['IDSPAY', 'RAZORPAY', 'CASHFREE', 'AA'].map((provider) => {
    const status = provider === 'IDSPAY' ? providerService.idspayStatus() : { provider, configured: providerConfig(provider) };
    return { ...status, provider, configured: status.configured, message: status.configured ? 'Configured' : 'Integration not configured' };
  });
}

function normalizeRow(row) {
  const debit = money(row.debit ?? row.withdrawalAmount ?? row.withdrawal ?? 0);
  const credit = money(row.credit ?? row.depositAmount ?? row.deposit ?? 0);
  if (debit === 0 && credit === 0) throw new Error('Each statement row must contain a debit or credit amount.');
  if (debit > 0 && credit > 0) throw new Error('A statement row cannot contain both debit and credit.');
  return {
    transactionDate: dateOnly(row.transactionDate || row.date),
    description: String(row.description || '').trim(), debit, credit,
    amount: debit || credit, type: debit ? 'expense' : 'income',
    category: String(row.category || categorizeDescription(row.description, debit)).slice(0, 100),
    referenceNumber: String(row.referenceNumber || row.reference || '').slice(0, 100),
    transactionType: String(row.transactionType || (debit ? 'DEBIT' : 'CREDIT')).slice(0, 50),
    bank: String(row.bank || '').slice(0, 100), runningBalance: row.balance ?? row.runningBalance ?? null,
  };
}

function categorizeDescription(description, debit) {
  const text = String(description || '').toLowerCase();
  const rules = [
    [/salary|payroll|wages/, 'Payroll'],
    [/rent|lease/, 'Rent'],
    [/tax|gst|tds|income tax/, 'Taxes'],
    [/fee|charge|commission/, 'Bank Charges'],
    [/utility|electric|internet|mobile|telecom/, 'Utilities'],
    [/fuel|petrol|diesel|transport|cab/, 'Travel and Transport'],
    [/invoice|sales|receipt|payment received/, 'Sales Revenue'],
    [/purchase|vendor|supplier|invoice payment/, 'Purchases'],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] || (debit ? 'Uncategorized Expense' : 'Uncategorized Income');
}

export async function importStatement(userId, data) {
  const rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data.lines) ? data.lines : [];
  if (!rows.length) throw new Error('No transaction lines found in statement.');
  const normalized = [];
  const failedRows = [];
  rows.forEach((row, index) => {
    try {
      normalized.push(normalizeRow(row));
    } catch (error) {
      failedRows.push({ rowNumber: index + 1, error: error.message, row });
    }
  });
  if (!normalized.length) throw new Error('No valid transaction lines found in statement.');
  const client = await pool.connect();
  const importId = crypto.randomUUID();
  let importedCount = 0; let duplicateCount = 0;
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ledger_statement_imports (id, user_id, account_id, file_name, file_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [importId, userId, data.accountId || null, data.fileName || 'statement', data.fileType || 'CSV']
    );
    for (const row of normalized) {
      const id = crypto.randomUUID(); const rowFingerprint = fingerprint(userId, row);
      const result = await client.query(
        `INSERT INTO ledger_transactions
          (id, user_id, account_id, type, amount, transaction_date, category, description, reference_number, status,
           source, debit, credit, running_balance, bank, transaction_type, fingerprint)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'completed','BANK_STATEMENT',$10,$11,$12,$13,$14,$15)
         ON CONFLICT (user_id, fingerprint) WHERE fingerprint IS NOT NULL DO NOTHING RETURNING *`,
        [id, userId, data.accountId || null, row.type, row.amount, row.transactionDate, row.category, row.description,
          row.referenceNumber || null, row.debit, row.credit, row.runningBalance === null ? null : money(row.runningBalance),
          row.bank || null, row.transactionType, rowFingerprint]
      );
      if (result.rows.length) {
        importedCount += 1;
        const importedTransaction = result.rows[0];
        const match = await client.query(
          `SELECT id FROM ledger_transactions
           WHERE user_id = $1 AND source = 'MANUAL' AND status = 'completed'
             AND type = $2 AND amount = $3 AND transaction_date = $4
             AND NOT EXISTS (SELECT 1 FROM ledger_reconciliations r WHERE r.matched_transaction_id = ledger_transactions.id AND r.status = 'MATCHED')
             AND ($5 = '' OR reference_number = $5)
           ORDER BY CASE WHEN $5 <> '' AND reference_number = $5 THEN 0 ELSE 1 END, created_at
           LIMIT 1`,
          [userId, importedTransaction.type, importedTransaction.amount, importedTransaction.transaction_date, row.referenceNumber || '']
        );
        if (match.rows.length) {
          await client.query('UPDATE ledger_transactions SET reconciled_at = NOW() WHERE id IN ($1, $2)', [importedTransaction.id, match.rows[0].id]);
          await client.query(
            `INSERT INTO ledger_reconciliations (user_id, transaction_id, status, matched_transaction_id, notes, reconciled_by)
             VALUES ($1,$2,'MATCHED',$3,$4,$1)`,
            [userId, importedTransaction.id, match.rows[0].id, 'Automatically matched by amount, date, type, and reference']
          );
        }
      } else duplicateCount += 1;
    }
    await client.query(
      `UPDATE ledger_statement_imports
       SET imported_count = $1, duplicate_count = $2, failed_count = $3, failed_rows = $4::jsonb,
           status = CASE WHEN $3 > 0 THEN 'COMPLETED_WITH_ERRORS' ELSE 'COMPLETED' END
       WHERE id = $5`,
      [importedCount, duplicateCount, failedRows.length, JSON.stringify(failedRows), importId]
    );
    await client.query('COMMIT');
    return { importId, importedCount, duplicateCount, failedCount: failedRows.length, failedRows };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function importStatementFile(userId, data) {
  const parsed = await providerService.parseStatementFile(data);
  return importStatement(userId, { ...parsed, accountId: data.accountId });
}

export async function listStatementImports(userId) {
  const result = await pool.query(
    `SELECT id, account_id, file_name, file_type, status, imported_count, duplicate_count,
            failed_count, failed_rows, error_message, created_at
     FROM ledger_statement_imports WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

function aaAdapter() { return new AccountAggregatorAdapter({ baseUrl: process.env.AA_BASE_URL }); }

export async function createAaConsent(userId, data) {
  const result = await aaAdapter().initiateConsent(data.customerHandle, data.dateFrom, data.dateTo);
  if (!result.success) return result;
  const saved = await pool.query(
    `INSERT INTO ledger_aa_consents (user_id, provider, provider_consent_id, status, metadata)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, process.env.AA_PROVIDER || 'AA', result.consentId, result.status || 'PENDING', JSON.stringify({ dateFrom: data.dateFrom, dateTo: data.dateTo })]
  );
  return { ...result, consent: saved.rows[0] };
}

export async function aaConsentStatus(userId, consentId) {
  const stored = await pool.query('SELECT * FROM ledger_aa_consents WHERE id = $1 AND user_id = $2', [consentId, userId]);
  if (!stored.rows.length) return null;
  const result = await aaAdapter().checkConsentStatus(stored.rows[0].provider_consent_id);
  const status = result.status || result.ConsentStatus || stored.rows[0].status;
  await pool.query('UPDATE ledger_aa_consents SET status = $1, updated_at = NOW() WHERE id = $2', [status, consentId]);
  return { ...result, consentId, status };
}

export async function requestAaFinancialInformation(userId, consentId, data) {
  const stored = await pool.query('SELECT * FROM ledger_aa_consents WHERE id = $1 AND user_id = $2', [consentId, userId]);
  if (!stored.rows.length) return null;
  const result = await aaAdapter().requestFiDataSession(stored.rows[0].provider_consent_id, data.dateFrom, data.dateTo);
  const saved = await pool.query(
    `INSERT INTO ledger_fi_requests (consent_id, provider_request_id, status, metadata) VALUES ($1,$2,$3,$4) RETURNING *`,
    [consentId, result.sessionId, result.status || 'CREATED', JSON.stringify(result.rawResponse || {})]
  );
  return { ...result, request: saved.rows[0] };
}

export async function fetchAaFinancialInformation(userId, requestId) {
  const query = await pool.query(
    `SELECT r.*, c.user_id FROM ledger_fi_requests r JOIN ledger_aa_consents c ON c.id = r.consent_id WHERE r.id = $1 AND c.user_id = $2`,
    [requestId, userId]
  );
  if (!query.rows.length) return null;
  const result = await aaAdapter().fetchAndNormalizeTransactions(query.rows[0].provider_request_id);
  if (!result.success) return result;
  const imported = await importStatement(userId, {
    fileName: `aa-${requestId}.json`, fileType: 'JSON',
    rows: result.transactions.map((row) => ({
      transactionDate: row.transactionDate, description: row.narration, referenceNumber: row.referenceNumber,
      debit: row.withdrawalAmount, credit: row.depositAmount, runningBalance: row.runningBalance, bank: row.bankName,
    }))
  });
  await pool.query(`UPDATE ledger_fi_requests SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [requestId]);
  return { ...result, imported };
}

export async function revokeAaConsent(userId, consentId) {
  const stored = await pool.query('SELECT * FROM ledger_aa_consents WHERE id = $1 AND user_id = $2', [consentId, userId]);
  if (!stored.rows.length) return null;
  const adapter = aaAdapter();
  if (!adapter.hasCredentials()) return { success: false, status: 'CREDENTIALS_REQUIRED', message: 'Integration not configured' };
  await adapter.ensureAuthenticated();
  const result = await adapter.send(`/Consent/handle/${stored.rows[0].provider_consent_id}`, 'DELETE');
  await pool.query(`UPDATE ledger_aa_consents SET status = 'REVOKED', updated_at = NOW() WHERE id = $1`, [consentId]);
  return { success: true, result };
}

export async function listAaConsents(userId) {
  const result = await pool.query('SELECT * FROM ledger_aa_consents WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows;
}

export async function discoverAaAccounts(userId, customerHandle) {
  const result = await aaAdapter().discoverAccounts(customerHandle);
  if (!result.success) return result;
  const accounts = Array.isArray(result.accounts) ? result.accounts : [];
  for (const account of accounts) {
    const providerAccountId = account.id || account.accountId || account.AccountId;
    if (!providerAccountId) continue;
    await pool.query(
      `INSERT INTO ledger_aa_accounts (user_id, provider, provider_account_id, fip_id, masked_account_number, account_type, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id, provider, provider_account_id)
       DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = NOW()`,
      [userId, process.env.AA_PROVIDER || 'AA', providerAccountId, account.fipId || account.FIPId || null,
        account.maskedAccountNumber || account.maskedAccNumber || null, account.accountType || account.type || null, JSON.stringify(account)]
    );
  }
  return { ...result, accounts: (await pool.query('SELECT * FROM ledger_aa_accounts WHERE user_id = $1 ORDER BY created_at DESC', [userId])).rows };
}

export async function listAaAccounts(userId) {
  const result = await pool.query('SELECT * FROM ledger_aa_accounts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows;
}

export async function linkAaAccount(userId, data) {
  const result = await aaAdapter().linkAccount(data.accountId, data.customerHandle, data.otp);
  if (!result.success) return result;
  await pool.query(
    `UPDATE ledger_aa_accounts SET status = 'LINKED', connection_status = 'CONNECTED', disconnected_at = NULL,
       metadata = metadata || $1::jsonb, updated_at = NOW()
     WHERE user_id = $2 AND provider_account_id = $3`,
    [JSON.stringify(result.account || {}), userId, data.accountId]
  );
  return result;
}

export async function disconnectAaAccount(userId, accountId) {
  const result = await pool.query(
    `UPDATE ledger_aa_accounts SET status = 'DISCONNECTED', connection_status = 'DISCONNECTED', disconnected_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [accountId, userId]
  );
  return result.rows[0] || null;
}

export async function syncAaAccount(userId, accountId, query = {}) {
  const account = await pool.query('SELECT * FROM ledger_aa_accounts WHERE id = $1 AND user_id = $2 AND connection_status <> $3', [accountId, userId, 'DISCONNECTED']);
  if (!account.rows.length) return null;
  const stored = account.rows[0];
  const result = await aaAdapter().accountData('transactions', stored.provider_account_id, query);
  if (!result.success) return result;
  const transactions = result.data?.transactions || result.data?.Transactions || result.data?.data?.transactions || [];
  const imported = transactions.length ? await importStatement(userId, {
    fileName: `aa-${accountId}-${new Date().toISOString().slice(0, 10)}.json`, fileType: 'JSON', accountId: query.ledgerAccountId,
    rows: transactions.map((row) => ({
      transactionDate: row.transactionDate || row.date || row.valueDate || row.transactionTimestamp,
      description: row.description || row.narration || row.particulars,
      referenceNumber: row.referenceNumber || row.reference || row.utr || row.txnId,
      debit: row.debit || row.withdrawalAmount || (String(row.type || '').toUpperCase() === 'DEBIT' ? row.amount : 0),
      credit: row.credit || row.depositAmount || (String(row.type || '').toUpperCase() === 'CREDIT' ? row.amount : 0),
      runningBalance: row.runningBalance || row.balance || row.currentBalance,
      bank: row.bank || row.bankName || stored.fip_id,
    }))
  }) : { importedCount: 0, duplicateCount: 0, failedCount: 0, failedRows: [] };
  const updated = await pool.query(
    `UPDATE ledger_aa_accounts SET last_synced_at = NOW(), connection_status = 'CONNECTED', status = 'SYNCED', updated_at = NOW(), metadata = metadata || $1::jsonb
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [JSON.stringify({ lastSync: result.rawResponse || result.data }), accountId, userId]
  );
  return { account: updated.rows[0], imported, provider: result };
}

export async function notifyAaConsent(userId, consentId, data = {}) {
  const stored = await pool.query('SELECT * FROM ledger_aa_consents WHERE id = $1 AND user_id = $2', [consentId, userId]);
  if (!stored.rows.length) return null;
  const result = await aaAdapter().notifyConsent(stored.rows[0].provider_consent_id, data);
  if (result.success) {
    await pool.query('INSERT INTO ledger_aa_events (user_id, consent_id, provider, event_type, payload) VALUES ($1,$2,$3,$4,$5)',
      [userId, consentId, stored.rows[0].provider, 'CONSENT_NOTIFICATION_SENT', JSON.stringify(result.rawResponse || result)]);
  }
  return result;
}

export async function listAaConsentEvents(userId, consentId) {
  const consent = await pool.query('SELECT id FROM ledger_aa_consents WHERE id = $1 AND user_id = $2', [consentId, userId]);
  if (!consent.rows.length) return null;
  const events = await pool.query('SELECT * FROM ledger_aa_events WHERE consent_id = $1 ORDER BY created_at DESC', [consentId]);
  return events.rows;
}

export async function getAaConsentHistory(userId, customerHandle) {
  const result = await aaAdapter().listConsentHistory(customerHandle);
  if (!result.success) return result;
  return { ...result, localEvents: (await pool.query('SELECT * FROM ledger_aa_events WHERE user_id = $1 ORDER BY created_at DESC', [userId])).rows };
}

export async function getAaAccountData(userId, action, accountId, query = {}) {
  const account = await pool.query('SELECT * FROM ledger_aa_accounts WHERE id = $1 AND user_id = $2', [accountId, userId]);
  if (!account.rows.length) return null;
  return aaAdapter().accountData(action, account.rows[0].provider_account_id, query);
}

export async function reconcileTransaction(userId, transactionId, data = {}) {
  const tx = await pool.query('SELECT * FROM ledger_transactions WHERE id = $1 AND user_id = $2', [transactionId, userId]);
  if (!tx.rows.length) return null;
  const matchedId = data.matchedTransactionId || null;
  if (matchedId) {
    const match = await pool.query('SELECT id FROM ledger_transactions WHERE id = $1 AND user_id = $2', [matchedId, userId]);
    if (!match.rows.length) throw new Error('Matched transaction not found.');
  }
  await pool.query(`UPDATE ledger_transactions SET reconciled_at = NOW() WHERE id = $1 AND user_id = $2`, [transactionId, userId]);
  const result = await pool.query(
    `INSERT INTO ledger_reconciliations (user_id, transaction_id, status, matched_transaction_id, notes, reconciled_by)
     VALUES ($1, $2, $3, $4, $5, $1) RETURNING *`,
    [userId, transactionId, matchedId ? 'MATCHED' : 'UNMATCHED', matchedId, data.notes || null]
  );
  return result.rows[0];
}

export async function getTransaction(userId, transactionId) {
  const result = await pool.query(`SELECT * FROM ledger_transactions WHERE id = $1 AND user_id = $2`, [transactionId, userId]);
  return result.rows[0] ? mapTransaction(result.rows[0]) : null;
}

export async function createPayment(userId, data) {
  const provider = String(data.provider || '').toUpperCase();
  const providerResponse = await providerService.createProviderPayment(provider, data);
  const result = await pool.query(
    `INSERT INTO ledger_payments (user_id, provider, provider_order_id, amount, currency, method, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, provider, provider_order_id, amount, currency, status, metadata, created_at`,
    [userId, provider, providerResponse.id || providerResponse.order_id || providerResponse.orderId || null, money(data.amount), data.currency || 'INR', data.method || null, JSON.stringify(providerResponse)]
  );
  return result.rows[0];
}

export async function createPaymentLink(userId, provider, data) {
  const providerResponse = await providerService.createPaymentLink(provider, data);
  const providerOrderId = providerResponse.id || providerResponse.link_id || providerResponse.linkId || null;
  const saved = await pool.query(
    `INSERT INTO ledger_payments (user_id, provider, provider_order_id, amount, currency, status, metadata)
     VALUES ($1,$2,$3,$4,$5,'LINK_CREATED',$6) RETURNING id, provider, provider_order_id, amount, currency, status, metadata, created_at`,
    [userId, String(provider).toUpperCase(), providerOrderId, money(data.amount), data.currency || 'INR', JSON.stringify(providerResponse)]
  );
  return { ...providerResponse, ledgerPayment: saved.rows[0] };
}
export const getPaymentStatus = (provider, paymentId, orderId) => providerService.getPaymentStatus(provider, paymentId, orderId);
export const createRefund = (provider, paymentId, data) => providerService.createRefund(provider, paymentId, data);
export const getRefundStatus = (provider, refundId) => providerService.getRefundStatus(provider, refundId);
export const listSettlements = (provider, from, to) => providerService.listSettlements(provider, from, to);

export async function getPaymentStatusForUser(userId, provider, paymentId, orderId) {
  const response = await providerService.getPaymentStatus(provider, paymentId, orderId);
  const entity = response?.payment || response?.data || response;
  const providerPaymentId = entity?.id || entity?.cf_payment_id || paymentId;
  const status = entity?.status || entity?.payment_status || entity?.order_status || 'UNKNOWN';
  await pool.query(
    `UPDATE ledger_payments SET status = $1, provider_payment_id = COALESCE(provider_payment_id, $2),
       provider_order_id = COALESCE(provider_order_id, $3), metadata = metadata || $4::jsonb, updated_at = NOW()
     WHERE user_id = $5 AND provider = $6 AND (provider_payment_id = $7 OR provider_order_id = $8)`,
    [String(status).toUpperCase(), providerPaymentId, orderId || null, JSON.stringify(response), userId, String(provider).toUpperCase(), paymentId, orderId || paymentId]
  );
  return response;
}

export async function getRefundStatusForUser(userId, provider, refundId) {
  const response = await providerService.getRefundStatus(provider, refundId);
  const entity = response?.refund || response?.data || response;
  const status = entity?.status || entity?.refund_status || 'UNKNOWN';
  await pool.query(
    `UPDATE ledger_refunds r SET status = $1
     FROM ledger_payments p WHERE r.payment_id = p.id AND p.user_id = $2 AND r.provider_refund_id = $3`,
    [String(status).toUpperCase(), userId, refundId]
  );
  return response;
}

export async function createRefundForUser(userId, provider, paymentId, data) {
  const response = await providerService.createRefund(provider, paymentId, data);
  const entity = response?.refund || response?.data || response;
  const providerRefundId = entity?.id || entity?.refund_id || data.refundId || null;
  const payment = await pool.query(
    `SELECT id FROM ledger_payments WHERE user_id = $1 AND provider = $2
       AND (provider_payment_id = $3 OR provider_order_id = $3) LIMIT 1`,
    [userId, String(provider).toUpperCase(), paymentId]
  );
  if (payment.rows.length && providerRefundId) {
    await pool.query(
      `INSERT INTO ledger_refunds (payment_id, provider_refund_id, amount, status)
       VALUES ($1,$2,$3,$4) ON CONFLICT (provider_refund_id)
       DO UPDATE SET amount = EXCLUDED.amount, status = EXCLUDED.status`,
      [payment.rows[0].id, providerRefundId, money(data.amount), String(entity?.status || 'CREATED').toUpperCase()]
    );
  }
  return response;
}

function webhookEntity(payload, type) {
  const data = payload?.payload?.[type]?.entity || payload?.data?.[type] || payload?.[type] || payload?.data || payload;
  return data && typeof data === 'object' ? data : {};
}

function webhookMetadata(payload, entity) {
  return entity.notes || entity.metadata || payload?.metadata || payload?.data?.metadata || {};
}

export async function recordWebhook(provider, eventId, eventType, payload, signatureValid) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO ledger_webhooks (provider, event_id, event_type, signature_valid, payload)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (provider,event_id) DO NOTHING RETURNING id`,
      [provider, eventId, eventType, signatureValid, JSON.stringify(payload)]
    );
    if (!inserted.rows.length) {
      await client.query('ROLLBACK');
      return { duplicate: true, id: null, processed: false };
    }

    const paymentEntity = webhookEntity(payload, 'payment');
    const refundEntity = webhookEntity(payload, 'refund');
    const settlementEntity = webhookEntity(payload, 'settlement');
    const metadata = webhookMetadata(payload, paymentEntity);
    const userId = metadata.user_id || metadata.userId || payload?.user_id || payload?.data?.user_id;
    const paymentId = paymentEntity.id || paymentEntity.payment_id || payload?.payment_id || payload?.data?.payment_id;
    const orderId = paymentEntity.order_id || payload?.order_id || payload?.data?.order_id;
    const amount = paymentEntity.amount || paymentEntity.order_amount || payload?.amount || payload?.data?.amount;
    const successful = /payment.*success|payment.*captured|payment_success/i.test(eventType);
    const refundEvent = /refund/i.test(eventType);
    const settlementEvent = /settlement/i.test(eventType);
    let processed = false;

    if (refundEvent) {
      const refundId = refundEntity.id || refundEntity.refund_id || payload?.refund_id || payload?.data?.refund_id;
      const relatedPaymentId = refundEntity.payment_id || paymentId;
      if (refundId && relatedPaymentId) {
        const payment = await client.query(
          `SELECT * FROM ledger_payments WHERE provider = $1 AND (provider_payment_id = $2 OR provider_order_id = $2) LIMIT 1`,
          [provider, relatedPaymentId]
        );
        if (payment.rows.length) {
          const refundAmount = money(Number(refundEntity.amount || amount || 0) / (provider === 'RAZORPAY' ? 100 : 1));
          const refund = await client.query(
            `INSERT INTO ledger_refunds (payment_id, provider_refund_id, amount, status)
             VALUES ($1,$2,$3,'PROCESSED') ON CONFLICT (provider_refund_id)
             DO UPDATE SET amount = EXCLUDED.amount, status = 'PROCESSED' RETURNING id`,
            [payment.rows[0].id, refundId, refundAmount]
          );
          const fingerprint = crypto.createHash('sha256').update(`${provider}|refund|${refundId}`).digest('hex');
          const reversal = await client.query(
            `INSERT INTO ledger_transactions
             (id,user_id,type,amount,transaction_date,category,description,reference_number,status,source,debit,credit,transaction_type,fingerprint)
             VALUES ($1,$2,'expense',$3,CURRENT_DATE,'Payment Refund',$4,$5,'completed','REFUND',$3,0,'DEBIT',$6)
             ON CONFLICT (user_id, fingerprint) WHERE fingerprint IS NOT NULL DO UPDATE SET amount = EXCLUDED.amount
             RETURNING id`,
            [crypto.randomUUID(), payment.rows[0].user_id, refundAmount, `Refund issued via ${provider}`, refundId, fingerprint]
          );
          const totals = await client.query('SELECT COALESCE(SUM(amount), 0) AS refunded FROM ledger_refunds WHERE payment_id = $1 AND status IN (\'PROCESSED\', \'SUCCESS\')', [payment.rows[0].id]);
          const status = Number(totals.rows[0].refunded) >= Number(payment.rows[0].amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
          await client.query('UPDATE ledger_payments SET status = $1, transaction_id = COALESCE(transaction_id, $2), updated_at = NOW() WHERE id = $3', [status, reversal.rows[0].id, payment.rows[0].id]);
          processed = Boolean(refund.rows.length);
        }
      }
    }

    if (settlementEvent) {
      const settlementId = settlementEntity.id || settlementEntity.settlement_id || payload?.settlement_id || payload?.data?.settlement_id;
      const settlementUserId = userId || (await client.query('SELECT user_id FROM ledger_payments WHERE provider = $1 AND provider_order_id = $2 LIMIT 1', [provider, orderId])).rows[0]?.user_id;
      if (settlementId && settlementUserId) {
        const divisor = provider === 'RAZORPAY' ? 100 : 1;
        const gross = money(Number(settlementEntity.gross_amount || settlementEntity.gross || payload?.gross_amount || 0) / divisor);
        const fee = money(Number(settlementEntity.fee_amount || settlementEntity.fee || payload?.fee_amount || 0) / divisor);
        const net = money(Number(settlementEntity.net_amount || settlementEntity.net || payload?.net_amount || (gross - fee)) / divisor);
        const settlement = await client.query(
          `INSERT INTO ledger_settlements (user_id, provider, provider_settlement_id, amount, gross_amount, fee_amount, net_amount, status, settled_at, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'PROCESSED',COALESCE($8,NOW()),$9)
           ON CONFLICT (provider_settlement_id) DO UPDATE SET status = 'PROCESSED', amount = EXCLUDED.amount, gross_amount = EXCLUDED.gross_amount, fee_amount = EXCLUDED.fee_amount, net_amount = EXCLUDED.net_amount, metadata = EXCLUDED.metadata
           RETURNING id`,
          [settlementUserId, provider, settlementId, net, gross, fee, net, settlementEntity.settled_at || payload?.settled_at || null, JSON.stringify(payload)]
        );
        const netFingerprint = crypto.createHash('sha256').update(`${provider}|settlement|${settlementId}`).digest('hex');
        const settlementTx = await client.query(
          `INSERT INTO ledger_transactions (id,user_id,type,amount,transaction_date,category,description,reference_number,status,source,debit,credit,transaction_type,fingerprint)
           VALUES ($1,$2,'income',$3,CURRENT_DATE,'Payment Settlement',$4,$5,'completed','SETTLEMENT',0,$3,'CREDIT',$6)
           ON CONFLICT (user_id, fingerprint) WHERE fingerprint IS NOT NULL DO UPDATE SET amount = EXCLUDED.amount RETURNING id`,
          [crypto.randomUUID(), settlementUserId, net, `Settlement received via ${provider}`, settlementId, netFingerprint]
        );
        if (fee > 0) {
          const feeFingerprint = crypto.createHash('sha256').update(`${provider}|settlement-fee|${settlementId}`).digest('hex');
          await client.query(
            `INSERT INTO ledger_transactions (id,user_id,type,amount,transaction_date,category,description,reference_number,status,source,debit,credit,transaction_type,fingerprint)
             VALUES ($1,$2,'expense',$3,CURRENT_DATE,'Payment Gateway Fees',$4,$5,'completed','SETTLEMENT',$3,0,'DEBIT',$6)
             ON CONFLICT (user_id, fingerprint) WHERE fingerprint IS NOT NULL DO NOTHING`,
            [crypto.randomUUID(), settlementUserId, fee, `Settlement fees via ${provider}`, settlementId, feeFingerprint]
          );
        }
        await client.query('UPDATE ledger_settlements SET transaction_id = $1 WHERE id = $2', [settlementTx.rows[0].id, settlement.rows[0].id]);
        processed = true;
      }
    }

    if (userId && paymentId && successful && Number(amount) > 0) {
      const amountInMajorUnits = money(Number(amount) / (provider === 'RAZORPAY' ? 100 : 1));
      const receivableId = metadata.receivable_id || metadata.receivableId || null;
      const payment = await client.query(
        `INSERT INTO ledger_payments (user_id, provider, provider_payment_id, provider_order_id, amount, status, metadata, invoice_id, receivable_id)
         VALUES ($1,$2,$3,$4,$5,'SUCCESS',$6,$7,$7) ON CONFLICT (provider, provider_payment_id)
         DO UPDATE SET status = 'SUCCESS', provider_order_id = COALESCE(EXCLUDED.provider_order_id, ledger_payments.provider_order_id), metadata = EXCLUDED.metadata, updated_at = NOW() RETURNING id`,
        [userId, provider, paymentId, orderId, amountInMajorUnits, JSON.stringify(payload), receivableId]
      );
      const fingerprint = crypto.createHash('sha256').update(`${provider}|${paymentId}`).digest('hex');
      const transaction = await client.query(
        `INSERT INTO ledger_transactions
         (id,user_id,type,amount,transaction_date,category,description,reference_number,status,source,debit,credit,transaction_type,fingerprint)
         VALUES ($1,$2,'income',$3,CURRENT_DATE,'Payment Collection',$4,$5,'completed','PAYMENT',0,$3,'CREDIT',$6)
         ON CONFLICT (user_id, fingerprint) WHERE fingerprint IS NOT NULL DO UPDATE SET reference_number = EXCLUDED.reference_number
         RETURNING id`,
        [crypto.randomUUID(), userId, amountInMajorUnits, `Payment received via ${provider}`, paymentId, fingerprint]
      );
      await client.query('UPDATE ledger_payments SET transaction_id = $1, updated_at = NOW() WHERE id = $2', [transaction.rows[0].id, payment.rows[0].id]);
      if (receivableId) {
        await client.query(
          `UPDATE ledger_receivables SET paid_amount = LEAST(total_amount, paid_amount + $1),
            status = CASE WHEN paid_amount + $1 >= total_amount THEN 'Paid' ELSE 'Partially Paid' END, updated_at = NOW()
           WHERE id = $2 AND user_id = $3`,
          [amountInMajorUnits, receivableId, userId]
        );
      }
      processed = true;
    }

    if (provider === 'AA') {
      const consentId = payload?.consent_id || payload?.ConsentHandle || payload?.data?.consent_id || payload?.data?.ConsentHandle;
      const aaStatus = payload?.status || payload?.ConsentStatus || payload?.data?.status || payload?.data?.ConsentStatus;
      if (userId && consentId) {
        await client.query(
          `UPDATE ledger_aa_consents SET status = COALESCE($1, status), metadata = metadata || $2::jsonb, updated_at = NOW()
           WHERE user_id = $3 AND provider_consent_id = $4`,
          [aaStatus ? String(aaStatus).toUpperCase() : null, JSON.stringify(payload), userId, consentId]
        );
      }
      if (userId) {
        await client.query(
          `INSERT INTO ledger_aa_events (user_id, consent_id, provider, event_type, provider_event_id, payload)
           VALUES ($1, (SELECT id FROM ledger_aa_consents WHERE user_id = $1 AND provider_consent_id = $2 LIMIT 1), $3, $4, $5, $6)
           ON CONFLICT (provider, provider_event_id) DO NOTHING`,
          [userId, consentId || null, provider, eventType, eventId, JSON.stringify(payload)]
        );
        processed = true;
      }
    }

    await client.query(`UPDATE ledger_webhooks SET status = $1, processed_at = NOW() WHERE id = $2`, [processed ? 'PROCESSED' : 'RECEIVED', inserted.rows[0].id]);
    await client.query('COMMIT');
    return { duplicate: false, id: inserted.rows[0].id, processed };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function verifyWebhookSignature(provider, rawBody, signature, timestamp = '') {
  const secret = provider === 'RAZORPAY' ? process.env.RAZORPAY_WEBHOOK_SECRET : provider === 'CASHFREE' ? process.env.CASHFREE_WEBHOOK_SECRET : process.env.AA_WEBHOOK_SECRET || process.env.AA_CLIENT_SECRET;
  if (!secret || !signature) return false;
  const encoding = provider === 'CASHFREE' ? 'base64' : 'hex';
  const signedBody = provider === 'CASHFREE' ? Buffer.concat([Buffer.from(timestamp), Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)]) : rawBody;
  const expected = crypto.createHmac('sha256', secret).update(signedBody).digest(encoding);
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export const verifyBankAccount = providerService.verifyBankAccount;
export const verifyPennyDrop = providerService.verifyPennyDrop;
export const verifyIfsc = providerService.verifyIfsc;
export const verifyUpi = providerService.verifyUpi;
export const fetchIdspayStatement = providerService.fetchIdspayStatement;
export const fetchIdspayTransactions = providerService.fetchIdspayTransactions;
export const fetchIdspayBalance = providerService.fetchIdspayBalance;