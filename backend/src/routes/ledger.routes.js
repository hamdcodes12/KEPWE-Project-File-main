import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import * as ledgerService from '../services/ledger.service.js';

const router = Router();

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

export default router;
