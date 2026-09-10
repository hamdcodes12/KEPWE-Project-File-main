import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { requireProductAccess } from '../middleware/product-auth.js';
import * as ledgerService from '../services/ledger.service.js';
import * as integrationService from '../services/ledger-integrations.service.js';

const router = Router();
router.use('/ledger', requireProductAccess('ledger'));

// ── Validation Schemas ──────────────────────────────────────────────────────
const accountSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required').max(100),
  type: z.enum(['Bank Account', 'Cash', 'UPI', 'Wallet', 'Other']).default('Bank Account'),
  accountNumber: z.string().trim().max(50).optional().nullable(),
  bankName: z.string().trim().max(100).optional().nullable(),
  ifscCode: z.string().trim().max(20).optional().nullable(),
  upiId: z.string().trim().max(100).optional().nullable(),
  openingBalance: z.number().nonnegative().optional().default(0),
  currency: z.string().trim().max(10).default('INR'),
  isDefault: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().nullable(),
});

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().positive('Amount must be positive'),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required').optional(),
  category: z.string().trim().min(1, 'Category is required').max(100),
  counterparty: z.string().trim().max(255).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  paymentMethod: z.string().trim().max(50).default('UPI'),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  status: z.enum(['completed', 'pending', 'cancelled']).default('completed'),
  receivableId: z.string().uuid().optional().nullable(),
  payableId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
});

const receivableSchema = z.object({
  invoiceNumber: z.string().trim().max(50).optional(),
  customerName: z.string().trim().min(1, 'Customer name is required').max(255),
  customerEmail: z.string().email().optional().nullable().or(z.literal('')),
  customerPhone: z.string().trim().max(50).optional().nullable(),
  customerGstin: z.string().trim().max(20).optional().nullable(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date is required'),
  subtotal: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional().default(0),
  totalAmount: z.number().positive('Total amount must be greater than zero'),
  status: z.enum(['Draft', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']).default('Pending'),
  items: z.array(z.any()).optional().default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  accountId: z.string().uuid().optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethod: z.string().trim().max(50).default('UPI'),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const payableSchema = z.object({
  billNumber: z.string().trim().max(50).optional(),
  vendorName: z.string().trim().min(1, 'Vendor name is required').max(255),
  vendorEmail: z.string().email().optional().nullable().or(z.literal('')),
  vendorPhone: z.string().trim().max(50).optional().nullable(),
  vendorGstin: z.string().trim().max(20).optional().nullable(),
  category: z.string().trim().max(100).default('Purchases'),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date is required'),
  subtotal: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional().default(0),
  totalAmount: z.number().positive('Total amount must be greater than zero'),
  status: z.enum(['Draft', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']).default('Pending'),
  items: z.array(z.any()).optional().default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const categorySchema = z.object({
  type: z.enum(['income', 'expense']),
  name: z.string().trim().min(1, 'Category name is required').max(100),
  color: z.string().trim().max(20).optional().default('#214ECF'),
  icon: z.string().trim().max(50).optional().default('Tag'),
});

const statementImportSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(['CSV', 'XLSX', 'XLS', 'PDF', 'JSON']).default('CSV'),
  accountId: z.string().uuid().optional().nullable(),
  rows: z.array(z.object({
    date: z.string().optional(), transactionDate: z.string().optional(), description: z.string().max(1000).default(''),
    debit: z.number().nonnegative().optional(), credit: z.number().nonnegative().optional(),
    withdrawalAmount: z.number().nonnegative().optional(), depositAmount: z.number().nonnegative().optional(),
    balance: z.number().optional().nullable(), runningBalance: z.number().optional().nullable(),
    reference: z.string().max(100).optional(), referenceNumber: z.string().max(100).optional(),
    transactionType: z.string().max(50).optional(), bank: z.string().max(100).optional(), category: z.string().max(100).optional(),
  })).min(1),
});

const paymentSchema = z.object({
  provider: z.enum(['razorpay', 'cashfree']), amount: z.number().positive(), currency: z.string().max(10).default('INR'),
  method: z.string().max(30).optional(), metadata: z.record(z.any()).optional(),
});

const providerPayloadSchema = z.record(z.any());
const idspayBankSchema = z.object({ accountNumber: z.string().trim().min(4).max(50), ifsc: z.string().trim().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/).optional(), ifscCode: z.string().trim().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/).optional(), name: z.string().trim().max(255).optional() }).passthrough();
const idspayIfscSchema = z.object({ ifsc: z.string().trim().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/) }).passthrough();
const idspayUpiSchema = z.object({ vpa: z.string().trim().regex(/^[^@\s]+@[^@\s]+$/), name: z.string().trim().max(255).optional() }).passthrough();
const idspayStatementSchema = z.object({ accountNumber: z.string().trim().min(4).max(50).optional(), accountId: z.string().uuid().optional(), dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).passthrough();
const statementFileSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  base64: z.string().min(20),
  accountId: z.string().uuid().optional().nullable(),
});
const aaConsentSchema = z.object({
  customerHandle: z.string().trim().min(1).max(255),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const aaAccountDiscoverySchema = z.object({ customerHandle: z.string().trim().min(1).max(255) });
const aaAccountLinkSchema = z.object({ accountId: z.string().trim().min(1).max(255), customerHandle: z.string().trim().min(1).max(255), otp: z.string().trim().min(1).max(20).optional() });
const aaNotificationSchema = z.object({ channel: z.string().max(50).optional(), callbackUrl: z.string().url().optional(), message: z.string().max(500).optional() });
const aaFiSchema = z.object({ dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const refundSchema = z.object({ provider: z.enum(['razorpay', 'cashfree']), amount: z.number().positive(), orderId: z.string().optional(), reason: z.string().max(500).optional(), refundId: z.string().max(100).optional() });
const providerQuerySchema = z.object({ provider: z.enum(['razorpay', 'cashfree']), paymentId: z.string().min(1), orderId: z.string().optional() });

// ============================================================================
// ROUTES
// ============================================================================

// 1. Dashboard
router.get('/ledger/dashboard', requireAuth, async (req, res, next) => {
  try {
    const data = await ledgerService.getDashboardData(req.userId, req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 2. Accounts
router.get('/ledger/accounts', requireAuth, async (req, res, next) => {
  try {
    const accounts = await ledgerService.getAccounts(req.userId);
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/accounts', requireAuth, validateBody(accountSchema), async (req, res, next) => {
  try {
    const account = await ledgerService.createAccount(req.userId, req.validatedBody);
    res.status(201).json({ account });
  } catch (err) {
    next(err);
  }
});

router.patch('/ledger/accounts/:id', requireAuth, validateBody(accountSchema.partial()), async (req, res, next) => {
  try {
    const updated = await ledgerService.updateAccount(req.userId, req.params.id, req.validatedBody);
    if (!updated) return res.status(404).json({ error: 'Account not found' });
    res.json({ account: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/ledger/accounts/:id', requireAuth, async (req, res, next) => {
  try {
    const ok = await ledgerService.deleteAccount(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Account not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 3. Transactions
router.get('/ledger/transactions/:id', requireAuth, async (req, res, next) => {
  try {
    const transaction = await integrationService.getTransaction(req.userId, req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction });
  } catch (err) { next(err); }
});

router.post('/ledger/transactions/import', requireAuth, validateBody(statementImportSchema), async (req, res, next) => {
  try {
    const result = await integrationService.importStatement(req.userId, req.validatedBody);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

router.post('/ledger/statements/import-file', requireAuth, validateBody(statementFileSchema), async (req, res, next) => {
  try { res.status(201).json(await integrationService.importStatementFile(req.userId, req.validatedBody)); }
  catch (err) { next(err); }
});
router.get('/ledger/statements/import-history', requireAuth, async (req, res, next) => {
  try { res.json({ imports: await integrationService.listStatementImports(req.userId) }); }
  catch (err) { next(err); }
});

router.post('/ledger/transactions/:id/reconcile', requireAuth, async (req, res, next) => {
  try {
    const result = await integrationService.reconcileTransaction(req.userId, req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ reconciliation: result });
  } catch (err) { next(err); }
});

router.get('/ledger/transactions', requireAuth, async (req, res, next) => {
  try {
    const result = await ledgerService.getTransactions(req.userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/transactions', requireAuth, validateBody(transactionSchema), async (req, res, next) => {
  try {
    const transaction = await ledgerService.createTransaction(req.userId, req.validatedBody);
    res.status(201).json({ transaction });
  } catch (err) {
    next(err);
  }
});

router.patch('/ledger/transactions/:id', requireAuth, validateBody(transactionSchema.partial()), async (req, res, next) => {
  try {
    const updated = await ledgerService.updateTransaction(req.userId, req.params.id, req.validatedBody);
    if (!updated) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/ledger/transactions/:id', requireAuth, async (req, res, next) => {
  try {
    const ok = await ledgerService.deleteTransaction(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 4. Receivables (Invoices)
router.get('/ledger/receivables', requireAuth, async (req, res, next) => {
  try {
    const result = await ledgerService.getReceivables(req.userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/receivables', requireAuth, validateBody(receivableSchema), async (req, res, next) => {
  try {
    const receivable = await ledgerService.createReceivable(req.userId, req.validatedBody);
    res.status(201).json({ receivable });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/receivables/:id/payments', requireAuth, validateBody(recordPaymentSchema), async (req, res, next) => {
  try {
    const result = await ledgerService.recordReceivablePayment(req.userId, req.params.id, req.validatedBody);
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('exceeds outstanding') || err.message.includes('not found')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.delete('/ledger/receivables/:id', requireAuth, async (req, res, next) => {
  try {
    const ok = await ledgerService.deleteReceivable(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 5. Payables (Vendor Bills)
router.get('/ledger/payables', requireAuth, async (req, res, next) => {
  try {
    const result = await ledgerService.getPayables(req.userId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/payables', requireAuth, validateBody(payableSchema), async (req, res, next) => {
  try {
    const payable = await ledgerService.createPayable(req.userId, req.validatedBody);
    res.status(201).json({ payable });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/payables/:id/payments', requireAuth, validateBody(recordPaymentSchema), async (req, res, next) => {
  try {
    const result = await ledgerService.recordPayablePayment(req.userId, req.params.id, req.validatedBody);
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('exceeds outstanding') || err.message.includes('not found')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.delete('/ledger/payables/:id', requireAuth, async (req, res, next) => {
  try {
    const ok = await ledgerService.deletePayable(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Bill not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 6. Reports
router.get('/ledger/reports', requireAuth, async (req, res, next) => {
  try {
    const reports = await ledgerService.getFinancialReports(req.userId, req.query);
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

// 7. Categories & Settings
router.get('/ledger/categories', requireAuth, async (req, res, next) => {
  try {
    const categories = await ledgerService.getCategories(req.userId);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/categories', requireAuth, validateBody(categorySchema), async (req, res, next) => {
  try {
    const category = await ledgerService.createCategory(req.userId, req.validatedBody);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

router.get('/ledger/settings', requireAuth, async (req, res, next) => {
  try {
    const settings = await ledgerService.getLedgerSettings(req.userId);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.patch('/ledger/settings', requireAuth, async (req, res, next) => {
  try {
    const settings = await ledgerService.updateLedgerSettings(req.userId, req.body);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.get('/ledger/integrations/status', requireAuth, (req, res) => {
  res.json({ integrations: integrationService.getIntegrationStatus() });
});

router.post('/ledger/payments', requireAuth, validateBody(paymentSchema), async (req, res, next) => {
  try { res.status(201).json({ payment: await integrationService.createPayment(req.userId, req.validatedBody) }); }
  catch (err) { next(err); }
});

router.post('/ledger/payments/links', requireAuth, validateBody(paymentSchema.extend({ description: z.string().max(500).optional(), customer: z.record(z.any()).optional(), customerDetails: z.record(z.any()).optional() })), async (req, res, next) => {
  try { res.status(201).json({ paymentLink: await integrationService.createPaymentLink(req.userId, req.validatedBody.provider, req.validatedBody) }); }
  catch (err) { next(err); }
});

router.get('/ledger/payments/status', requireAuth, async (req, res, next) => {
  try {
    const parsed = providerQuerySchema.parse(req.query);
    res.json({ payment: await integrationService.getPaymentStatusForUser(req.userId, parsed.provider, parsed.paymentId, parsed.orderId) });
  } catch (err) { next(err); }
});

router.post('/ledger/payments/:paymentId/refunds', requireAuth, validateBody(refundSchema.omit({ provider: true })), async (req, res, next) => {
  try {
    const provider = String(req.query.provider || '').toLowerCase();
    if (!['razorpay', 'cashfree'].includes(provider)) return res.status(400).json({ error: 'provider is required' });
    res.status(201).json({ refund: await integrationService.createRefundForUser(req.userId, provider, req.params.paymentId, req.validatedBody) });
  } catch (err) { next(err); }
});

router.get('/ledger/refunds/:refundId', requireAuth, async (req, res, next) => {
  try {
    const provider = String(req.query.provider || '').toLowerCase();
    if (!['razorpay', 'cashfree'].includes(provider)) return res.status(400).json({ error: 'provider is required' });
    res.json({ refund: await integrationService.getRefundStatusForUser(req.userId, provider, req.params.refundId) });
  } catch (err) { next(err); }
});

router.get('/ledger/settlements', requireAuth, async (req, res, next) => {
  try {
    const provider = String(req.query.provider || '').toLowerCase();
    if (!['razorpay', 'cashfree'].includes(provider)) return res.status(400).json({ error: 'provider is required' });
    res.json({ settlements: await integrationService.listSettlements(provider, req.query.from, req.query.to) });
  } catch (err) { next(err); }
});

router.post('/ledger/idspay/bank-account/verify', requireAuth, validateBody(idspayBankSchema), async (req, res, next) => { try { res.json(await integrationService.verifyBankAccount(req.validatedBody)); } catch (err) { next(err); } });
router.post('/ledger/idspay/bank-account/penny-drop', requireAuth, validateBody(idspayBankSchema), async (req, res, next) => { try { res.json(await integrationService.verifyPennyDrop(req.validatedBody)); } catch (err) { next(err); } });
router.post('/ledger/idspay/ifsc/verify', requireAuth, validateBody(idspayIfscSchema), async (req, res, next) => { try { res.json(await integrationService.verifyIfsc(req.validatedBody)); } catch (err) { next(err); } });
router.post('/ledger/idspay/upi/verify', requireAuth, validateBody(idspayUpiSchema), async (req, res, next) => { try { res.json(await integrationService.verifyUpi(req.validatedBody)); } catch (err) { next(err); } });
router.post('/ledger/idspay/statement', requireAuth, validateBody(idspayStatementSchema), async (req, res, next) => { try { res.json(await integrationService.fetchIdspayStatement(req.validatedBody)); } catch (err) { next(err); } });
router.post('/ledger/idspay/transactions', requireAuth, validateBody(idspayStatementSchema), async (req, res, next) => { try { res.json(await integrationService.fetchIdspayTransactions(req.validatedBody)); } catch (err) { next(err); } });
router.post('/ledger/idspay/balance', requireAuth, validateBody(idspayStatementSchema), async (req, res, next) => { try { res.json(await integrationService.fetchIdspayBalance(req.validatedBody)); } catch (err) { next(err); } });

router.get('/ledger/aa/consents', requireAuth, async (req, res, next) => { try { res.json({ consents: await integrationService.listAaConsents(req.userId) }); } catch (err) { next(err); } });
router.post('/ledger/aa/accounts/discover', requireAuth, validateBody(aaAccountDiscoverySchema), async (req, res, next) => { try { res.status(201).json(await integrationService.discoverAaAccounts(req.userId, req.validatedBody.customerHandle)); } catch (err) { next(err); } });
router.post('/ledger/aa/accounts/link', requireAuth, validateBody(aaAccountLinkSchema), async (req, res, next) => { try { res.status(201).json(await integrationService.linkAaAccount(req.userId, req.validatedBody)); } catch (err) { next(err); } });
router.get('/ledger/aa/accounts', requireAuth, async (req, res, next) => { try { res.json({ accounts: await integrationService.listAaAccounts(req.userId) }); } catch (err) { next(err); } });
router.post('/ledger/aa/accounts/:id/sync', requireAuth, async (req, res, next) => { try { const result = await integrationService.syncAaAccount(req.userId, req.params.id, req.body || {}); if (!result) return res.status(404).json({ error: 'Connected account not found' }); res.json(result); } catch (err) { next(err); } });
router.post('/ledger/aa/accounts/:id/disconnect', requireAuth, async (req, res, next) => { try { const result = await integrationService.disconnectAaAccount(req.userId, req.params.id); if (!result) return res.status(404).json({ error: 'Connected account not found' }); res.json({ account: result }); } catch (err) { next(err); } });
router.post('/ledger/aa/consents', requireAuth, validateBody(aaConsentSchema), async (req, res, next) => { try { res.status(201).json(await integrationService.createAaConsent(req.userId, req.validatedBody)); } catch (err) { next(err); } });
router.get('/ledger/aa/consents/:id', requireAuth, async (req, res, next) => { try { const result = await integrationService.aaConsentStatus(req.userId, req.params.id); if (!result) return res.status(404).json({ error: 'Consent not found' }); res.json(result); } catch (err) { next(err); } });
router.post('/ledger/aa/consents/:id/revoke', requireAuth, async (req, res, next) => { try { const result = await integrationService.revokeAaConsent(req.userId, req.params.id); if (!result) return res.status(404).json({ error: 'Consent not found' }); res.json(result); } catch (err) { next(err); } });
router.post('/ledger/aa/consents/:id/notify', requireAuth, validateBody(aaNotificationSchema), async (req, res, next) => { try { const result = await integrationService.notifyAaConsent(req.userId, req.params.id, req.validatedBody); if (!result) return res.status(404).json({ error: 'Consent not found' }); res.json(result); } catch (err) { next(err); } });
router.get('/ledger/aa/consents/:id/events', requireAuth, async (req, res, next) => { try { const result = await integrationService.listAaConsentEvents(req.userId, req.params.id); if (!result) return res.status(404).json({ error: 'Consent not found' }); res.json({ events: result }); } catch (err) { next(err); } });
router.get('/ledger/aa/consent-history', requireAuth, async (req, res, next) => { try { res.json(await integrationService.getAaConsentHistory(req.userId, String(req.query.customerHandle || ''))); } catch (err) { next(err); } });
router.post('/ledger/aa/consents/:id/fi-requests', requireAuth, validateBody(aaFiSchema), async (req, res, next) => { try { const result = await integrationService.requestAaFinancialInformation(req.userId, req.params.id, req.validatedBody); if (!result) return res.status(404).json({ error: 'Consent not found' }); res.status(201).json(result); } catch (err) { next(err); } });
router.get('/ledger/aa/fi-requests/:id/fetch', requireAuth, async (req, res, next) => { try { const result = await integrationService.fetchAaFinancialInformation(req.userId, req.params.id); if (!result) return res.status(404).json({ error: 'FI request not found' }); res.json(result); } catch (err) { next(err); } });
router.get('/ledger/aa/accounts/:id/:action', requireAuth, async (req, res, next) => { try { const allowed = ['balance', 'transactions', 'statements', 'details']; if (!allowed.includes(req.params.action)) return res.status(404).json({ error: 'Unsupported account operation' }); const result = await integrationService.getAaAccountData(req.userId, req.params.action, req.params.id, req.query); if (!result) return res.status(404).json({ error: 'AA account not found' }); res.json(result); } catch (err) { next(err); } });

export const ledgerWebhookRoutes = Router();
ledgerWebhookRoutes.post('/webhooks/:provider', async (req, res, next) => {
  try {
    const provider = String(req.params.provider).toUpperCase();
    if (!['RAZORPAY', 'CASHFREE', 'AA'].includes(provider)) return res.status(404).json({ error: 'Unsupported webhook provider' });
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const signature = req.get('x-razorpay-signature') || req.get('x-webhook-signature') || '';
    const timestamp = req.get('x-webhook-timestamp') || '';
    const signatureValid = integrationService.verifyWebhookSignature(provider, rawBody, signature, timestamp);
    if (!signatureValid) return res.status(401).json({ error: 'Invalid webhook signature' });
    const eventId = req.get('x-event-id') || req.body?.id || req.body?.event_id;
    if (!eventId) return res.status(400).json({ error: 'Webhook event id is required' });
    const result = await integrationService.recordWebhook(provider, eventId, req.body?.event || req.body?.type || 'unknown', req.body, signatureValid);
    res.status(result.duplicate ? 200 : 202).json({ received: true, duplicate: result.duplicate });
  } catch (err) { next(err); }
});

export default router;
