import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../../middleware/auth.js';

import * as accountingEngine from '../../services/accounting-engine.service.js';
import * as invoiceEngine from '../../services/invoice-engine.service.js';
import * as gstEngine from '../../services/gst-engine.service.js';
import * as tdsEngine from '../../services/tds-engine.service.js';
import * as payrollEngine from '../../services/payroll-engine.service.js';
import * as bankRecEngine from '../../services/bank-reconciliation.service.js';
import * as fixedAssetsEngine from '../../services/fixed-assets.service.js';
import * as complianceEngine from '../../services/compliance-engine.service.js';
import * as filingPrepEngine from '../../services/filing-prep.service.js';
import { integrationManager } from '../../integrations/integration-manager.js';
import { parseStatementFile } from '../../services/ledger-provider.service.js';

import { requireIdempotency } from '../../middleware/idempotency.js';
import { requireProductAccess } from '../../middleware/product-auth.js';

const router = Router();
router.use(requireIdempotency());
router.use(requireProductAccess('ledger'));

// Helper to determine active company ID (with strict tenant isolation enforcement)
function getActiveCompanyId(req) {
  const requestedCompanyId = req.headers['x-company-id'] || req.query.companyId || req.params?.companyId;
  const userCompanyId = req.user?.companyId;
  const userRole = req.user?.role;

  if (requestedCompanyId && userCompanyId && userRole !== 'admin' && requestedCompanyId !== userCompanyId) {
    const err = new Error('Access denied: Unauthorized cross-tenant company data access attempt.');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_TENANT_ACCESS';
    throw err;
  }

  return requestedCompanyId || userCompanyId || req.userId || 'COMP-DEFAULT';
}

// ── 1. COMPANY ONBOARDING & PROFILE ─────────────────────────────────────────
router.get('/companies/profile', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const profile = await accountingEngine.getCompanyProfile(companyId, req.userId);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

router.patch('/companies/profile', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const updated = await accountingEngine.updateCompanyProfile(companyId, req.userId, req.body);
    res.json({ profile: updated });
  } catch (err) {
    next(err);
  }
});

// ── 2. CHART OF ACCOUNTS ────────────────────────────────────────────────────
router.get('/accounts', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const accounts = await accountingEngine.getChartOfAccounts(companyId);
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

router.post('/accounts', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const account = await accountingEngine.createCustomAccount(companyId, req.body);
    res.status(201).json({ account });
  } catch (err) {
    next(err);
  }
});

// ── 3. DOUBLE-ENTRY JOURNALS ────────────────────────────────────────────────
router.get('/journals', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await accountingEngine.getJournalEntries(companyId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/journals', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await accountingEngine.postJournalEntry(companyId, req.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err.name === 'UnbalancedJournalError' || err.message.includes('Unbalanced')) {
      return res.status(400).json({ error: err.message, code: 'UNBALANCED_JOURNAL' });
    }
    next(err);
  }
});

router.post('/journals/:id/void', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const reason = req.body.reason || 'Voided by user request';
    const result = await accountingEngine.voidJournalEntry(companyId, req.params.id, req.userId, reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 4. GENERAL LEDGER & TRIAL BALANCE ────────────────────────────────────────
router.get('/ledger/:accountId', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await accountingEngine.getGeneralLedger(
      companyId,
      req.params.accountId,
      req.query.dateFrom,
      req.query.dateTo
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/trial-balance', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await accountingEngine.getTrialBalance(companyId, req.query.asOfDate);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 5. FINANCIAL REPORTS ────────────────────────────────────────────────────
router.get('/reports/profit-loss', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await accountingEngine.getProfitAndLoss(companyId, req.query.dateFrom, req.query.dateTo);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/reports/balance-sheet', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await accountingEngine.getBalanceSheet(companyId, req.query.asOfDate);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/reports/cash-flow', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await accountingEngine.getCashFlowStatement(companyId, req.query.dateFrom, req.query.dateTo);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 6. INVOICES ─────────────────────────────────────────────────────────────
router.get('/invoices', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await invoiceEngine.getGstInvoices(companyId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/invoices', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const invoice = await invoiceEngine.createGstInvoice(companyId, req.userId, req.body);
    res.status(201).json({ invoice });
  } catch (err) {
    next(err);
  }
});

router.post('/invoices/:id/payments', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await invoiceEngine.recordInvoicePayment(companyId, req.params.id, req.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('exceeds outstanding')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ── 7. PURCHASES / VENDOR BILLS ─────────────────────────────────────────────
router.get('/purchases', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await invoiceEngine.getVendorBills(companyId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/purchases', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const bill = await invoiceEngine.createVendorBill(companyId, req.userId, req.body);
    res.status(201).json({ bill });
  } catch (err) {
    next(err);
  }
});

router.post('/purchases/:id/payments', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await invoiceEngine.recordVendorBillPayment(companyId, req.params.id, req.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('exceeds outstanding')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// ── 8. CREDIT & DEBIT NOTES ──────────────────────────────────────────────────
router.get('/credit-debit-notes', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const notes = await invoiceEngine.getCreditDebitNotes(companyId);
    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

router.post('/credit-debit-notes', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const note = await invoiceEngine.createCreditDebitNote(companyId, req.userId, req.body);
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
});

// ── 9. GST ENGINE (CALCULATION, GSTR-1, GSTR-3B, RECONCILIATION) ─────────────
router.post('/gst/calculate', requireAuth, async (req, res, next) => {
  try {
    const breakdown = gstEngine.calculateGstBreakdown(req.body);
    res.json(breakdown);
  } catch (err) {
    next(err);
  }
});

router.get('/gst/returns/gstr-1', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const period = req.query.taxPeriod || '2026-09';
    const data = await gstEngine.prepareGstr1Data(companyId, period);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/gst/returns/gstr-3b', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const period = req.query.taxPeriod || '2026-09';
    const data = await gstEngine.calculateGstr3b(companyId, period);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/gst/reconciliation/run', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const period = req.body.taxPeriod || '2026-09';
    const result = await gstEngine.runGstReconciliation(companyId, period, req.body.external2bFeed);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/gst/reconciliation/import-2b', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const period = req.body.taxPeriod || '2026-09';
    const records = req.body.records || req.body.feed || [];
    const result = await gstEngine.importGstr2bFeed(companyId, period, records);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/gst/reconciliation/records', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const records = await gstEngine.getGstReconciliationRecords(companyId);
    res.json({ records });
  } catch (err) {
    next(err);
  }
});

// ── 10. E-INVOICE & E-WAY BILL INTEGRATIONS ──────────────────────────────────
router.post('/gst/einvoice/irn', requireAuth, async (req, res, next) => {
  try {
    const adapter = integrationManager.getAdapter('EINVOICE');
    const result = await adapter.generateIrn(req.body);
    if (!result.success) {
      return res.status(result.status === 'CREDENTIALS_REQUIRED' ? 412 : 400).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/gst/einvoice/cancel', requireAuth, async (req, res, next) => {
  try {
    const adapter = integrationManager.getAdapter('EINVOICE');
    const result = await adapter.cancelIrn(req.body.irn, req.body.reasonCode, req.body.remarks);
    if (!result.success) {
      return res.status(result.status === 'CREDENTIALS_REQUIRED' ? 412 : 400).json(result);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/gst/ewaybill/generate', requireAuth, async (req, res, next) => {
  try {
    const adapter = integrationManager.getAdapter('EWAYBILL');
    const result = await adapter.generateEWayBill(req.body);
    if (!result.success) {
      return res.status(result.status === 'CREDENTIALS_REQUIRED' ? 412 : 400).json(result);
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/gst/ewaybill/cancel', requireAuth, async (req, res, next) => {
  try {
    const adapter = integrationManager.getAdapter('EWAYBILL');
    const result = await adapter.cancelEWayBill(req.body.ewbNo, req.body.reasonCode, req.body.remarks);
    if (!result.success) {
      return res.status(result.status === 'CREDENTIALS_REQUIRED' ? 412 : 400).json(result);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 11. TDS ENGINE ──────────────────────────────────────────────────────────
router.get('/tds/rules', requireAuth, async (req, res, next) => {
  try {
    const rules = await tdsEngine.getTdsRules();
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

router.post('/tds/calculate', requireAuth, async (req, res, next) => {
  try {
    const result = await tdsEngine.calculateTds(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/tds/transactions', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await tdsEngine.getTdsTransactions(companyId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/tds/challans', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await tdsEngine.recordTdsChallanDeposit(companyId, req.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/tds/challans', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const challans = await tdsEngine.getTdsChallans(companyId);
    res.json({ challans });
  } catch (err) {
    next(err);
  }
});

router.get('/tds/returns/form-26q', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await tdsEngine.prepareForm26q(companyId, req.query.quarter);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 12. PAYROLL ENGINE ──────────────────────────────────────────────────────
router.get('/payroll/employees', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const employees = await payrollEngine.getEmployees(companyId);
    res.json({ employees });
  } catch (err) {
    next(err);
  }
});

router.post('/payroll/employees', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const employee = await payrollEngine.createEmployee(companyId, req.userId, req.body);
    res.status(201).json({ employee });
  } catch (err) {
    next(err);
  }
});

router.post('/payroll/runs', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await payrollEngine.executePayrollRun(companyId, req.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/payroll/runs', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const runs = await payrollEngine.getPayrollRuns(companyId);
    res.json({ runs });
  } catch (err) {
    next(err);
  }
});

router.get('/payroll/runs/:runId/payslips', requireAuth, async (req, res, next) => {
  try {
    const payslips = await payrollEngine.getPayslips(req.params.runId);
    res.json({ payslips });
  } catch (err) {
    next(err);
  }
});

router.post('/payroll/runs/:runId/disburse', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await payrollEngine.disburseSalaries(companyId, req.params.runId, req.userId, req.body.bankAccountId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 13. BANK RECONCILIATION ─────────────────────────────────────────────────
router.post('/banks/statements/import', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    let payload = req.body;
    if (req.body.fileBase64) {
      const parsed = await parseStatementFile({
        fileName: req.body.fileName,
        mimeType: req.body.mimeType || 'application/octet-stream',
        base64: req.body.fileBase64,
      });
      payload = { ...req.body, lines: parsed.rows, fileType: parsed.fileType };
      delete payload.fileBase64;
    }
    const result = await bankRecEngine.importBankStatement(companyId, req.userId, payload);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/banks/statements', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const statements = await bankRecEngine.getBankStatements(companyId);
    res.json({ statements });
  } catch (err) {
    next(err);
  }
});

router.get('/banks/statements/:id/lines', requireAuth, async (req, res, next) => {
  try {
    const lines = await bankRecEngine.getStatementLines(req.params.id);
    res.json({ lines });
  } catch (err) {
    next(err);
  }
});

router.post('/banks/reconciliation/match', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await bankRecEngine.manuallyMatchLine(companyId, req.body.statementId, req.body.lineId, req.body.journalEntryId, req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 14. FIXED ASSETS & DEPRECIATION ──────────────────────────────────────────
router.get('/fixed-assets', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const assets = await fixedAssetsEngine.getFixedAssets(companyId);
    res.json({ assets });
  } catch (err) {
    next(err);
  }
});

router.post('/fixed-assets', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const asset = await fixedAssetsEngine.createFixedAsset(companyId, req.userId, req.body);
    res.status(201).json({ asset });
  } catch (err) {
    next(err);
  }
});

router.post('/fixed-assets/depreciation/run', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await fixedAssetsEngine.executeDepreciationRun(companyId, req.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/fixed-assets/depreciation/runs', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const runs = await fixedAssetsEngine.getDepreciationRuns(companyId);
    res.json({ runs });
  } catch (err) {
    next(err);
  }
});

// ── 15. COMPLIANCE ENGINE & CALENDAR ────────────────────────────────────────
router.get('/compliance/tasks', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await complianceEngine.getComplianceTasks(companyId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/compliance/tasks/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await complianceEngine.completeComplianceTask(companyId, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 16. FILING PREPARATION & APPROVAL WORKFLOW ──────────────────────────────
router.get('/filing-prep', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const filings = await filingPrepEngine.getFilingPreparations(companyId);
    res.json({ filings });
  } catch (err) {
    next(err);
  }
});

router.post('/filing-prep/draft', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const filing = await filingPrepEngine.createFilingDraft(companyId, req.userId, req.body);
    res.status(201).json({ filing });
  } catch (err) {
    next(err);
  }
});

router.post('/filing-prep/:id/approve', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await filingPrepEngine.approveFiling(companyId, req.params.id, req.userId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/filing-prep/:id/submit', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await filingPrepEngine.submitFilingToProvider(companyId, req.params.id, req.userId);
    if (!result.success && result.status === 'CREDENTIALS_REQUIRED') {
      return res.status(412).json(result);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 17. INTEGRATIONS MANAGEMENT ─────────────────────────────────────────────
router.get('/integrations/status', requireAuth, async (req, res, next) => {
  try {
    const providers = await integrationManager.getAllProvidersStatus();
    res.json({ providers });
  } catch (err) {
    next(err);
  }
});

router.post('/integrations/:key/test', requireAuth, async (req, res, next) => {
  try {
    const result = await integrationManager.testConnection(req.params.key);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── 18. AUDIT TRAIL ─────────────────────────────────────────────────────────
router.get('/audit', requireAuth, async (req, res, next) => {
  try {
    const companyId = getActiveCompanyId(req);
    const result = await accountingEngine.getAuditTrail(companyId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
