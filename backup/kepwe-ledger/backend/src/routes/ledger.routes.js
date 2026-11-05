import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { requireProductAccess } from '../middleware/product-auth.js';
import * as ledgerService from '../services/ledger.service.js';
import * as integrationService from '../services/ledger-integrations.service.js';
import * as parserService from '../services/statement-parser.service.js';
import * as cfoIntelligenceService from '../services/cfo-intelligence.service.js';
import * as goalsService from '../services/goals.service.js';
import * as financialReportsService from '../services/financial-reports.service.js';
import * as ledgerSubscriptionService from '../services/ledger-subscription.service.js';
import { limitLedgerHistory, requireLedgerAiInsight, requireLedgerFeature, trackLedgerDashboardInsight } from '../middleware/ledger-plan.middleware.js';

const router = Router();
router.get('/ledger/plans', async (_req, res, next) => {
  try {
    res.json({ plans: await ledgerSubscriptionService.listLedgerPlans() });
  } catch (err) {
    next(err);
  }
});
router.use('/ledger', requireProductAccess('ledger'));

router.get('/ledger/subscription', requireAuth, async (req, res, next) => {
  try {
    res.json({ subscription: await ledgerSubscriptionService.getLedgerSubscription(req.userId) });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/subscription/orders', requireAuth, validateBody(z.object({
  planCode: z.enum(['PRO', 'PRO_PLUS']),
  billingPeriod: z.enum(['monthly', 'yearly']),
}).strict()), async (req, res, next) => {
  try {
    const order = await ledgerSubscriptionService.createLedgerPaymentOrder(
      req.userId,
      req.validatedBody.planCode,
      req.validatedBody.billingPeriod
    );
    res.status(201).json({
      order: {
        orderId: order.razorpay_order_id,
        amount: Math.round(Number(order.amount_inr) * 100),
        currency: order.currency,
        planCode: order.planCode,
        planName: order.planName,
        billingPeriod: order.billingPeriod,
      },
      razorpayKeyId: order.keyId,
    });
  } catch (err) {
    res.status(err.statusCode || 502).json({ error: err.message || 'Unable to create Razorpay order.' });
  }
});

router.post('/ledger/subscription/verify', requireAuth, validateBody(z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
}).strict()), async (req, res) => {
  try {
    const subscription = await ledgerSubscriptionService.verifyLedgerPayment(
      req.userId,
      req.validatedBody.razorpay_order_id,
      req.validatedBody.razorpay_payment_id,
      req.validatedBody.razorpay_signature
    );
    res.json({ success: true, subscription });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || 'Payment verification failed.' });
  }
});

router.post('/ledger/subscription/failure', requireAuth, validateBody(z.object({
  orderId: z.string().min(1),
  reason: z.string().max(500).optional(),
}).strict()), async (req, res, next) => {
  try {
    const updated = await ledgerSubscriptionService.markLedgerPaymentFailed(
      req.userId,
      req.validatedBody.orderId,
      req.validatedBody.reason
    );
    res.json({ success: true, updated });
  } catch (err) {
    next(err);
  }
});

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
  type: z.enum(['income', 'expense', 'transfer', 'investment']),
  amount: z.number().positive('Amount must be positive'),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required').optional(),
  category: z.string().trim().min(1, 'Category is required').max(100),
  counterparty: z.string().trim().max(255).optional().nullable(),
  merchant: z.string().trim().max(255).optional().nullable(),
  subcategory: z.string().trim().max(100).optional().nullable(),
  classification: z.enum(['Essential', 'Lifestyle', 'Financial', 'Other']).optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  isEssential: z.boolean().optional().nullable(),
  confidence: z.number().min(0).max(1).optional().default(1.0),
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

const financialProfileSchema = z.object({
  monthlyIncome: z.number().nonnegative().optional(),
  salaryIncome: z.number().nonnegative().optional(),
  monthlySalary: z.number().nonnegative().optional(),
  businessIncome: z.number().nonnegative().optional(),
  freelanceIncome: z.number().nonnegative().optional(),
  rentalIncome: z.number().nonnegative().optional(),
  otherIncome: z.number().nonnegative().optional(),
  monthlyDebtObligations: z.number().nonnegative().optional(),
  emergencySavings: z.number().nonnegative().optional(),
  emergencyFundTarget: z.number().nonnegative().optional(),
  monthlySavingsTarget: z.number().nonnegative().optional(),
  occupation: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  age: z.number().int().min(18).max(120).optional().nullable(),
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

// ── Phase 6 Validation Schemas ──────────────────────────────────────────────
const parseDataSchema = z.object({
  fileName: z.string().trim().max(255).optional(),
  mimeType: z.string().trim().max(150).optional(),
  base64: z.string().optional(),
  textData: z.string().optional(),
  sourceType: z.enum([
    'BANK_STATEMENT',
    'UPI_STATEMENT',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'WALLET',
    'CSV_EXCEL',
    'SCREENSHOT',
    'MANUAL'
  ]).default('BANK_STATEMENT'),
  institution: z.string().trim().max(100).optional(),
  accountId: z.string().uuid().optional().nullable(),
});

const commitImportSchema = z.object({
  fileName: z.string().trim().min(1).max(255).default('Imported Statement'),
  fileType: z.enum(['CSV', 'XLSX', 'XLS', 'PDF', 'IMAGE', 'JSON']).default('CSV'),
  sourceType: z.string().max(50).default('BANK_STATEMENT'),
  institution: z.string().trim().max(100).optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  closingBalance: z.number().optional().nullable(),
  duplicateCount: z.number().int().nonnegative().optional().default(0),
  originalCount: z.number().int().nonnegative().optional(),
  transactions: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date YYYY-MM-DD required'),
    amount: z.number().positive('Amount must be positive'),
    type: z.enum(['income', 'expense', 'investment', 'transfer']).default('expense'),
    category: z.string().trim().min(1).max(100),
    subcategory: z.string().trim().max(100).optional().nullable(),
    merchant: z.string().trim().max(255).optional().nullable(),
    counterparty: z.string().trim().max(255).optional().nullable(),
    classification: z.enum(['Essential', 'Lifestyle', 'Financial', 'Other']).default('Essential'),
    isRecurring: z.boolean().optional().default(false),
    isEssential: z.boolean().optional().nullable(),
    confidence: z.number().min(0).max(1).optional().default(1.0),
    paymentMethod: z.string().trim().max(50).default('UPI'),
    referenceNumber: z.string().trim().max(100).optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
    balance: z.number().optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
  })).min(1, 'At least one transaction must be confirmed for import.'),
});

const monthlyIncomeEntrySchema = z.object({
  sourceType: z.enum(['salary', 'business', 'freelance', 'rental', 'other']).default('salary'),
  amount: z.number().positive('Income amount must be greater than zero'),
  employerOrClient: z.string().trim().max(255).optional().nullable(),
  depositDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  accountId: z.string().uuid().optional().nullable(),
  isRecurring: z.boolean().optional().default(true),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const recurringExpenseEntrySchema = z.object({
  expenseType: z.enum(['Rent', 'EMI', 'Insurance', 'Utility', 'Internet', 'Subscription', 'Other']).default('Utility'),
  amount: z.number().positive('Expense amount must be greater than zero'),
  payee: z.string().trim().min(1, 'Payee name is required').max(255),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  frequency: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
  classification: z.enum(['Essential', 'Lifestyle', 'Financial', 'Other']).optional(),
  accountId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

// ── Phase 7 Validation Schemas ──────────────────────────────────────────────
const affordabilitySchema = z.object({
  purchaseAmount: z.number().positive('Purchase amount must be positive'),
  category: z.string().trim().max(100).optional(),
  description: z.string().trim().max(255).optional(),
  isEmi: z.boolean().optional().default(false),
  tenureMonths: z.number().int().min(1).max(60).optional().default(6),
  annualInterestRate: z.number().min(0).max(100).optional().default(14),
});

const cfoQuestionSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(500),
});

// ── Phase 8 Validation Schemas (Savings Goals) ──────────────────────────────
const goalCreateSchema = z.object({
  name: z.string().trim().min(1, 'Goal name is required').max(150),
  type: z.enum([
    'Emergency Fund',
    'New Car',
    'House Down Payment',
    'Vacation',
    'Retirement',
    'Education',
    'Wealth Creation',
    'Other'
  ]).default('Other'),
  category: z.string().trim().max(100).optional(),
  targetAmount: z.number().positive('Target amount must be greater than 0'),
  currentAmount: z.number().nonnegative().optional().default(0),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be in YYYY-MM-DD format').optional().nullable(),
  monthlyContribution: z.number().nonnegative().optional().default(0),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  color: z.string().trim().max(30).optional(),
  icon: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const goalUpdateSchema = goalCreateSchema.partial().extend({
  status: z.enum(['in_progress', 'completed', 'paused']).optional(),
});

const goalContributeSchema = z.object({
  amount: z.number().positive('Contribution amount must be greater than 0'),
  notes: z.string().trim().max(500).optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

// 1. Dashboard
router.get('/ledger/dashboard', requireAuth, limitLedgerHistory, trackLedgerDashboardInsight, async (req, res, next) => {
  try {
    const data = await ledgerService.getDashboardData(req.userId, req.query);
    if (!req.includeLedgerAiInsight) data.cfoInsight = null;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 1.1 Financial Profile (PRD Section 11 & Section 68)
router.get('/ledger/profile', requireAuth, async (req, res, next) => {
  try {
    const profile = await ledgerService.getFinancialProfile(req.userId);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

router.patch('/ledger/profile', requireAuth, validateBody(financialProfileSchema), async (req, res, next) => {
  try {
    const profile = await ledgerService.updateFinancialProfile(req.userId, req.validatedBody);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/profile', requireAuth, validateBody(financialProfileSchema), async (req, res, next) => {
  try {
    const profile = await ledgerService.updateFinancialProfile(req.userId, req.validatedBody);
    res.json({ profile });
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
    if (err.code === 'LEDGER_PLAN_LIMIT_REACHED') {
      return res.status(403).json({ error: err.message, code: err.code, limit: err.limit, upgradeUrl: '/ledger/pricing' });
    }
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
router.get('/ledger/statements/import-history', requireAuth, limitLedgerHistory, async (req, res, next) => {
  try { res.json({ imports: await integrationService.listStatementImports(req.userId, req.ledgerHistoryCutoff) }); }
  catch (err) { next(err); }
});

router.post('/ledger/transactions/:id/reconcile', requireAuth, async (req, res, next) => {
  try {
    const result = await integrationService.reconcileTransaction(req.userId, req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ reconciliation: result });
  } catch (err) { next(err); }
});

router.get('/ledger/transactions', requireAuth, limitLedgerHistory, async (req, res, next) => {
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

// ── Phase 6: Add / Upload Financial Data Routes ─────────────────────────────

// 1. Parse Statement File or Screenshot
router.post('/ledger/data/parse', requireAuth, validateBody(parseDataSchema), async (req, res, next) => {
  try {
    const { fileName = 'statement', mimeType = '', base64, textData, sourceType } = req.validatedBody;

    let buffer = null;
    if (base64) {
      buffer = Buffer.from(base64, 'base64');
      if (buffer.length === 0) {
        return res.status(400).json({ error: 'The uploaded file is empty. Please select a valid statement.' });
      }
      if (buffer.length > 15 * 1024 * 1024) {
        return res.status(413).json({ error: 'File size exceeds the 15MB limit. Please upload a smaller file.' });
      }
    } else if (!textData) {
      return res.status(400).json({ error: 'Please provide a file or text content to process.' });
    }

    let rawTransactions = [];
    const lowerName = fileName.toLowerCase();

    // 1. Screenshot / Image OCR
    if (sourceType === 'SCREENSHOT' || mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp'].some((ext) => lowerName.endsWith(ext))) {
      rawTransactions = await parserService.parseImageOcr(buffer, mimeType);
    }
    // 2. PDF Bank / Card Statement
    else if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
      rawTransactions = await parserService.parsePdfStatement(buffer);
    }
    // 3. CSV / Excel Statement
    else if (
      mimeType.includes('sheet') ||
      mimeType.includes('excel') ||
      mimeType === 'text/csv' ||
      ['.csv', '.xlsx', '.xls'].some((ext) => lowerName.endsWith(ext)) ||
      textData
    ) {
      const dataBuffer = buffer || Buffer.from(textData, 'utf-8');
      rawTransactions = parserService.parseExcelOrCsv(dataBuffer, fileName);
    } else {
      return res.status(400).json({
        error: 'Unsupported file type. Supported inputs: Bank Statement PDF, CSV, Excel (.xlsx/.xls), and Screenshot (PNG/JPG).',
      });
    }

    // 4. Duplicate Detection & Confidence Flagging
    const analyzed = await parserService.detectDuplicates(req.userId, rawTransactions);
    const duplicatesCount = analyzed.filter((t) => t.isDuplicate).length;
    const uncertainCount = analyzed.filter((t) => t.needsReview).length;

    res.json({
      success: true,
      count: analyzed.length,
      duplicatesCount,
      uncertainCount,
      transactions: analyzed,
      fileSummary: {
        fileName,
        sourceType,
        institution: req.validatedBody.institution || 'Direct',
        sizeBytes: buffer ? buffer.length : textData ? textData.length : 0,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to process statement file.' });
  }
});

// 2. Commit Reviewed Transactions to PostgreSQL
router.post('/ledger/data/commit', requireAuth, validateBody(commitImportSchema), async (req, res, next) => {
  try {
    const result = await ledgerService.commitImportedTransactions(req.userId, req.validatedBody);
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to persist imported transactions.' });
  }
});

// 3. Dedicated Monthly Income Stream Entry
router.post('/ledger/data/monthly-income', requireAuth, validateBody(monthlyIncomeEntrySchema), async (req, res, next) => {
  try {
    const result = await ledgerService.recordMonthlyIncome(req.userId, req.validatedBody);
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to record monthly income.' });
  }
});

// 4. Dedicated Recurring Expense Entry
router.post('/ledger/data/recurring-expense', requireAuth, validateBody(recurringExpenseEntrySchema), async (req, res, next) => {
  try {
    const result = await ledgerService.recordRecurringExpense(req.userId, req.validatedBody);
    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to record recurring expense.' });
  }
});

// 5. Statement Import History
router.get('/ledger/data/import-history', requireAuth, limitLedgerHistory, async (req, res, next) => {
  try {
    const imports = await ledgerService.getImportHistory(req.userId, req.ledgerHistoryCutoff);
    res.json({ imports });
  } catch (err) {
    next(err);
  }
});

// ── Phase 7: AI CFO Insights & Intelligence ───────────────────────────
router.get('/ledger/cfo/insights', requireAuth, requireLedgerAiInsight, async (req, res, next) => {
  try {
    let insights = await cfoIntelligenceService.getComprehensiveCfoInsights(req.userId);
    const plan = await ledgerSubscriptionService.getLedgerEntitlements(req.userId);
    if (plan.features?.ai_personal_cfo !== true) {
      insights = {
        ...insights,
        metrics: Object.fromEntries(Object.entries(insights.metrics || {}).filter(([key]) => [
          'monthlyIncome', 'recordedExpenses', 'recordedSavings', 'savingsRate',
          'essentialExpenses', 'lifestyleExpenses', 'financialExpenses', 'otherExpenses',
        ].includes(key))),
        reductionOpportunities: (insights.reductionOpportunities || []).filter((item) => item.type !== 'recurring_subscriptions'),
        alerts: (insights.alerts || []).filter((item) => ['savings_target_shortfall', 'cfo_healthy_state'].includes(item.id)),
      };
      delete insights.surplusAllocation;
    }
    res.json({
      success: true,
      insights,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/cfo/affordability', requireAuth, requireLedgerFeature('affordability_analysis'), validateBody(affordabilitySchema), async (req, res, next) => {
  try {
    const evaluation = await cfoIntelligenceService.evaluateAffordability(req.userId, req.validatedBody);
    res.json({
      success: true,
      evaluation,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to evaluate affordability.' });
  }
});

router.post('/ledger/cfo/ask', requireAuth, requireLedgerFeature('ai_personal_cfo'), validateBody(cfoQuestionSchema), async (req, res, next) => {
  try {
    const response = await cfoIntelligenceService.processNaturalLanguageCfoQuery(req.userId, req.validatedBody.question);
    res.json({
      success: true,
      response,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to process CFO question.' });
  }
});

// ── Phase 8: Savings Goal Engine Routes ─────────────────────────────────────
router.get('/ledger/goals', requireAuth, async (req, res, next) => {
  try {
    const result = await goalsService.getUserGoals(req.userId);
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/ledger/goals', requireAuth, validateBody(goalCreateSchema), async (req, res, next) => {
  try {
    const goal = await goalsService.createGoal(req.userId, req.validatedBody);
    res.status(201).json({
      success: true,
      goal,
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message || 'Failed to create savings goal.', code: err.code, limit: err.limit, upgradeUrl: err.code === 'LEDGER_PLAN_LIMIT_REACHED' ? '/ledger/pricing' : undefined });
  }
});

router.patch('/ledger/goals/:id', requireAuth, validateBody(goalUpdateSchema), async (req, res, next) => {
  try {
    const goal = await goalsService.updateGoal(req.userId, req.params.id, req.validatedBody);
    res.json({
      success: true,
      goal,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update savings goal.' });
  }
});

router.delete('/ledger/goals/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await goalsService.deleteGoal(req.userId, req.params.id);
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to delete savings goal.' });
  }
});

router.post('/ledger/goals/:id/contribute', requireAuth, validateBody(goalContributeSchema), async (req, res, next) => {
  try {
    const goal = await goalsService.contributeToGoal(req.userId, req.params.id, req.validatedBody.amount);
    res.json({
      success: true,
      goal,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to contribute to savings goal.' });
  }
});

// 4. Receivables (Invoices)
router.get('/ledger/receivables', requireAuth, limitLedgerHistory, async (req, res, next) => {
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
router.get('/ledger/payables', requireAuth, limitLedgerHistory, async (req, res, next) => {
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

// 6. Reports & Export Engine
router.get('/ledger/reports', requireAuth, requireLedgerFeature('advanced_reports'), limitLedgerHistory, async (req, res, next) => {
  try {
    const reportType = req.query.reportType;
    if (['trial_balance', 'balance_sheet', 'pnl', 'receivables_aging', 'payables_aging', 'account_summary'].includes(reportType)) {
      // Enterprise double-entry accounting reports
      const reports = await ledgerService.getFinancialReports(req.userId, req.query);
      return res.json(reports);
    }
    // PRD Personal Finance Reports (Monthly AI Report, Weekly CFO Report, Daily, Quarterly, Annual)
    const comprehensive = await financialReportsService.getComprehensiveReport(req.userId, req.query);
    res.json(comprehensive);
  } catch (err) {
    next(err);
  }
});

router.get('/ledger/reports/export', requireAuth, requireLedgerFeature('report_export'), limitLedgerHistory, async (req, res, next) => {
  try {
    const format = (req.query.format || 'pdf').toLowerCase();
    const reportData = await financialReportsService.getComprehensiveReport(req.userId, req.query);

    const periodClean = (reportData.period || 'report').replace(/[^a-z0-9_-]/gi, '_');
    const dateClean = (reportData.dateRange?.start || new Date().toISOString().slice(0, 10)).replace(/[^a-z0-9_-]/gi, '_');

    if (format === 'pdf') {
      const pdfBuffer = await financialReportsService.exportReportToPdf(reportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Kepwe_Ledger_${periodClean}_${dateClean}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    }

    if (format === 'xlsx' || format === 'excel') {
      const xlsxBuffer = await financialReportsService.exportReportToExcel(reportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Kepwe_Ledger_${periodClean}_${dateClean}.xlsx"`);
      res.setHeader('Content-Length', xlsxBuffer.length);
      return res.send(xlsxBuffer);
    }

    if (format === 'csv') {
      const csvContent = financialReportsService.exportReportToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="Kepwe_Ledger_${periodClean}_${dateClean}.csv"`);
      return res.send(csvContent);
    }

    res.status(400).json({ error: 'Unsupported export format. Supported formats: pdf, xlsx, csv' });
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
    const eventId = req.get('x-razorpay-event-id') || req.get('x-event-id') || req.body?.id || req.body?.event_id;
    if (!eventId) return res.status(400).json({ error: 'Webhook event id is required' });
    if (provider === 'RAZORPAY' && await ledgerSubscriptionService.isLedgerSubscriptionOrder(
      req.body?.payload?.payment?.entity?.order_id
    )) {
      const result = await ledgerSubscriptionService.handleLedgerRazorpayWebhook(rawBody, req.body, signature, eventId);
      return res.status(result.duplicate ? 200 : 202).json({ received: true, ...result });
    }
    const result = await integrationService.recordWebhook(provider, eventId, req.body?.event || req.body?.type || 'unknown', req.body, signatureValid);
    res.status(result.duplicate ? 200 : 202).json({ received: true, duplicate: result.duplicate });
  } catch (err) { next(err); }
});

export default router;
