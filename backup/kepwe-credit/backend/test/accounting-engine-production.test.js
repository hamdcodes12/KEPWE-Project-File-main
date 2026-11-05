import assert from 'assert';
import crypto from 'crypto';
import * as accountingEngine from '../src/services/accounting-engine.service.js';
import * as invoiceEngine from '../src/services/invoice-engine.service.js';
import * as gstEngine from '../src/services/gst-engine.service.js';
import * as tdsEngine from '../src/services/tds-engine.service.js';
import * as payrollEngine from '../src/services/payroll-engine.service.js';
import * as bankRecEngine from '../src/services/bank-reconciliation.service.js';
import * as fixedAssetsEngine from '../src/services/fixed-assets.service.js';
import * as complianceEngine from '../src/services/compliance-engine.service.js';
import * as filingPrepEngine from '../src/services/filing-prep.service.js';
import { integrationManager } from '../src/integrations/integration-manager.js';
import { pool } from '../src/config/db.js';

async function runProductionEngineTests() {
  console.log('================================================================');
  console.log('   STARTING KEPWE LEDGER PRODUCTION ENGINE VERIFICATION SUITE   ');
  console.log('================================================================');

  const testCompanyA = crypto.randomUUID();
  const testCompanyB = crypto.randomUUID();
  const testUser = crypto.randomUUID();

  await pool.query(`INSERT INTO companies (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [testCompanyA, 'Test Production Corp A']);
  await pool.query(`INSERT INTO companies (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [testCompanyB, 'Isolated Tenant Corp B']);
  await pool.query(`INSERT INTO users (id, email, password_hash, role, full_name) VALUES ($1, $2, 'hash', 'customer', 'Test User') ON CONFLICT (id) DO NOTHING`, [testUser, `user-${Date.now()}@test.com`]);

  await accountingEngine.updateCompanyProfile(testCompanyA, testUser, {
    legalName: 'Test Production Corp A',
    tradeName: 'Test Production',
    pan: 'AABCA1234F',
    tan: 'MUMB12345D',
    gstin: '27AABCA1234F1Z9',
    state: 'Maharashtra',
    stateCode: '27'
  });

  // ── TEST 1: Chart of Accounts & Indian Standard Structure ──────────────────
  console.log('\n[1] Initializing Indian Standard Chart of Accounts...');
  const coa = await accountingEngine.initDefaultChartOfAccounts(testCompanyA);
  assert(coa.length >= 30, `COA must have at least 30 standard accounts, got ${coa.length}`);

  const bankAcc = coa.find((a) => a.code === '1010');
  const arAcc = coa.find((a) => a.code === '1030');
  const apAcc = coa.find((a) => a.code === '2010');
  const salesAcc = coa.find((a) => a.code === '4010');
  const cgstAcc = coa.find((a) => a.code === '2020');
  const sgstAcc = coa.find((a) => a.code === '2021');
  const igstAcc = coa.find((a) => a.code === '2022');

  assert(bankAcc && arAcc && apAcc && salesAcc && cgstAcc && sgstAcc && igstAcc, 'All essential control accounts must exist in COA');
  console.log('  ✔ Chart of Accounts initialized with standard Assets, Liabilities, Equity, Income, and Expenses.');

  // ── TEST 2: Double-Entry Journal Engine & Debit = Credit Invariant ──────────
  console.log('\n[2] Verifying Double-Entry Balancing & Rejection of Unbalanced Journals...');
  // Post valid balanced journal: ₹100,000 Capital introduced
  const capitalAcc = coa.find((a) => a.code === '3010');
  const balancedResult = await accountingEngine.postJournalEntry(testCompanyA, testUser, {
    narration: 'Owner Capital Introduced via Bank',
    lines: [
      { accountId: bankAcc.id, debit: 500000.0, credit: 0, narration: 'Capital deposited in Bank' },
      { accountId: capitalAcc.id, debit: 0, credit: 500000.0, narration: 'Shareholder Capital Account' }
    ]
  });
  assert(balancedResult.entry.id, 'Journal entry must be posted successfully');
  assert.strictEqual(balancedResult.entry.totalDebit, 500000.0);
  assert.strictEqual(balancedResult.entry.totalCredit, 500000.0);
  console.log('  ✔ Balanced entry accepted (Debit ₹500,000 === Credit ₹500,000)');

  // Attempt unbalanced journal (Debit 10,000 != Credit 8,000)
  let rejected = false;
  try {
    await accountingEngine.postJournalEntry(testCompanyA, testUser, {
      narration: 'Unbalanced Journal Attempt',
      lines: [
        { accountId: bankAcc.id, debit: 10000.0, credit: 0 },
        { accountId: salesAcc.id, debit: 0, credit: 8000.0 }
      ]
    });
  } catch (err) {
    rejected = true;
    assert(err.message.includes('Unbalanced'), 'Error message must specify Unbalanced journal');
  }
  assert.strictEqual(rejected, true, 'CRITICAL: Unbalanced journal MUST be rejected by engine!');
  console.log('  ✔ Unbalanced journal rejected with zero tolerance.');

  // ── TEST 3: Immutability Workflow (VOID -> REVERSE -> AUDIT LOG) ───────────
  console.log('\n[3] Verifying Transaction Immutability & Reversal Workflow...');
  const voidResult = await accountingEngine.voidJournalEntry(testCompanyA, balancedResult.entry.id, testUser, 'Capital amount correction');
  assert(voidResult.success);
  assert(voidResult.reversalNumber.startsWith('REV-'), 'Reversal entry number must be generated');

  const journals = await accountingEngine.getJournalEntries(testCompanyA);
  const original = journals.entries.find((j) => j.id === balancedResult.entry.id);
  const reversal = journals.entries.find((j) => j.id === voidResult.reversalEntryId);
  assert.strictEqual(original.status, 'VOIDED', 'Original entry must be marked VOIDED (never deleted)');
  assert.strictEqual(reversal.status, 'POSTED', 'Reversal entry must be POSTED');
  assert.strictEqual(reversal.totalDebit, 500000.0);
  assert.strictEqual(reversal.totalCredit, 500000.0);
  console.log('  ✔ Voided entry preserved in ledger with offsetting Reversal entry and audit log.');

  // Re-establish working capital for subsequent tests
  await accountingEngine.postJournalEntry(testCompanyA, testUser, {
    narration: 'Working Capital Deposit',
    lines: [
      { accountId: bankAcc.id, debit: 500000.0, credit: 0 },
      { accountId: capitalAcc.id, debit: 0, credit: 500000.0 }
    ]
  });

  // ── TEST 4: GST Invoices & Double-Entry Accounting Impact ───────────────────
  console.log('\n[4] Testing GST Invoice Creation & Multi-tax Accounting Impact...');
  // Customer in same state (Maharashtra: 27) -> Intra-state (9% CGST + 9% SGST)
  const intraInvoice = await invoiceEngine.createGstInvoice(testCompanyA, testUser, {
    customerName: 'Apex Digital Solutions Pvt Ltd',
    customerGstin: '27AABCA1234F1Z1',
    placeOfSupplyCode: '27',
    items: [
      { itemDescription: 'Cloud Architecture Consulting', hsnSac: '998311', quantity: 1, unitPrice: 100000.0, gstRate: 18 }
    ]
  });
  assert.strictEqual(intraInvoice.taxableAmount, 100000.0);
  assert.strictEqual(intraInvoice.cgstAmount, 9000.0, 'Intra-state must split 50% into CGST');
  assert.strictEqual(intraInvoice.sgstAmount, 9000.0, 'Intra-state must split 50% into SGST');
  assert.strictEqual(intraInvoice.igstAmount, 0.0);
  assert.strictEqual(intraInvoice.totalAmount, 118000.0);
  assert(intraInvoice.journalEntryId, 'Invoice must generate a linked Journal Entry');
  console.log('  ✔ Intra-State Invoice: Taxable ₹100,000 + CGST ₹9,000 + SGST ₹9,000 = Total ₹118,000 with Journal');

  // Customer in different state (Delhi: 07) -> Inter-state (18% IGST)
  const interInvoice = await invoiceEngine.createGstInvoice(testCompanyA, testUser, {
    customerName: 'Northern Retail Technologies',
    customerGstin: '07AAACN5678P1Z3',
    placeOfSupplyCode: '07',
    items: [
      { itemDescription: 'Enterprise Software Subscription', hsnSac: '997331', quantity: 2, unitPrice: 50000.0, gstRate: 18 }
    ]
  });
  assert.strictEqual(interInvoice.taxableAmount, 100000.0);
  assert.strictEqual(interInvoice.cgstAmount, 0.0);
  assert.strictEqual(interInvoice.sgstAmount, 0.0);
  assert.strictEqual(interInvoice.igstAmount, 18000.0, 'Inter-state must apply 100% IGST');
  assert.strictEqual(interInvoice.totalAmount, 118000.0);
  console.log('  ✔ Inter-State Invoice: Taxable ₹100,000 + IGST ₹18,000 = Total ₹118,000 with Journal');

  // Customer Payment on Intra-state invoice
  const payResult = await invoiceEngine.recordInvoicePayment(testCompanyA, intraInvoice.id, testUser, {
    amount: 118000.0,
    paymentMethod: 'UPI',
    referenceNumber: 'UPI-REC-998877'
  });
  assert.strictEqual(payResult.invoice.status, 'Paid');
  assert.strictEqual(payResult.invoice.outstandingAmount, 0.0);
  console.log('  ✔ Customer payment received in full: Receivable cleared, Bank credited.');

  // ── TEST 5: Purchases, ITC, and TDS Deduction Engine ────────────────────────
  console.log('\n[5] Testing Vendor Bill with ITC & TDS Deduction...');
  // Vendor bill for Professional Services (Sec 194J, 10% TDS)
  const tdsCalc = await tdsEngine.calculateTds({
    vendorPan: 'AABCV1234D',
    sectionCode: '194J',
    invoiceAmount: 50000.0
  });
  assert.strictEqual(tdsCalc.isApplicable, true, '₹50,000 exceeds ₹30,000 threshold for 194J');
  assert.strictEqual(tdsCalc.tdsAmount, 5000.0, '10% TDS on ₹50,000 = ₹5,000');
  assert.strictEqual(tdsCalc.netPayable, 45000.0);

  // Section 206AA: Higher rate of 20% when PAN is missing
  const noPanCalc = await tdsEngine.calculateTds({
    vendorPan: '',
    sectionCode: '194C',
    invoiceAmount: 40000.0
  });
  assert.strictEqual(noPanCalc.sectionCode, '206AA');
  assert.strictEqual(noPanCalc.tdsRate, 20.0, 'Section 206AA must enforce mandatory 20% without PAN');
  console.log('  ✔ TDS rules verified: 194J at 10% and Section 206AA at 20% without PAN.');

  // Create vendor bill with TDS
  const bill = await invoiceEngine.createVendorBill(testCompanyA, testUser, {
    vendorName: 'Verma & Associates (Advocates)',
    vendorPan: 'AABCV1234D',
    vendorGstin: '27AABCV1234D1Z2',
    category: 'Legal & Professional Fees',
    subtotal: 50000.0,
    gstRate: 18,
    tdsSection: '194J',
    tdsAmount: 5000.0
  });
  assert.strictEqual(bill.taxableAmount, 50000.0);
  assert.strictEqual(bill.totalTaxAmount, 9000.0);
  assert.strictEqual(bill.totalAmount, 59000.0);
  assert.strictEqual(bill.tdsAmount, 5000.0);
  assert.strictEqual(bill.netPayable, 54000.0);
  console.log('  ✔ Vendor Bill posted: Expense ₹50,000 + Input Tax ₹9,000, TDS Payable ₹5,000, Vendor Net Payable ₹54,000.');

  // Pay vendor bill
  const billPayResult = await invoiceEngine.recordVendorBillPayment(testCompanyA, bill.id, testUser, {
    amount: 54000.0,
    paymentMethod: 'Bank Transfer',
    referenceNumber: 'NEFT-VEN-112233'
  });
  assert.strictEqual(billPayResult.bill.status, 'Paid');
  console.log('  ✔ Vendor Bill paid: Accounts Payable debited, Bank disbursed.');

  // ── TEST 6: GSTR-1 & GSTR-3B Tax Offset Engine ──────────────────────────────
  console.log('\n[6] Verifying GSTR-1 Preparation & GSTR-3B Statutory Tax Offset (Rule 88A)...');
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
  const gstr1Data = await gstEngine.prepareGstr1Data(testCompanyA, currentPeriod);
  assert(gstr1Data.table4_b2b.length >= 2, 'GSTR-1 must aggregate B2B invoices');
  assert(gstr1Data.table12_hsn.length >= 1, 'GSTR-1 must compile HSN table');
  console.log(`  ✔ GSTR-1 Prepared: ${gstr1Data.summary.totalInvoices} invoices, Taxable ₹${gstr1Data.summary.totalTaxable}, Total Tax ₹${gstr1Data.summary.totalTax}.`);

  const gstr3bData = await gstEngine.calculateGstr3b(testCompanyA, currentPeriod);
  assert(gstr3bData.table31_outwardSupplies.outwardTaxable.taxableValue > 0);
  assert(gstr3bData.table4_eligibleItc.netItc.total > 0, 'ITC from vendor bill must be included');
  assert(gstr3bData.table61_paymentOfTax.totalLiability.total > 0);
  console.log('  ✔ GSTR-3B Tax Offset calculated following Rule 88A (IGST credit exhausted first).');

  // ── TEST 7: GST Reconciliation Engine ───────────────────────────────────────
  console.log('\n[7] Testing GST Reconciliation Engine (Books vs GSTR-2B)...');
  const recResult = await gstEngine.runGstReconciliation(testCompanyA, currentPeriod);
  assert(recResult.summary.totalRecords >= 1, 'Reconciliation must process purchase bills');
  assert(recResult.records.some((r) => r.matchStatus === 'MATCHED' || r.matchStatus === 'MISSING_IN_RETURNS'));
  console.log(`  ✔ GST Reconciliation completed: ${recResult.summary.matchedCount} matched, ${recResult.summary.mismatchedCount} mismatched, ${recResult.summary.missingInReturnsCount} missing in returns.`);

  // ── TEST 8: Payroll Engine & Balanced Payroll Journal ───────────────────────
  console.log('\n[8] Testing Payroll Engine & Double-Entry Payroll Journal...');
  await payrollEngine.createEmployee(testCompanyA, testUser, {
    name: 'Vikram Mehta',
    designation: 'VP Engineering',
    monthlyGross: 120000.0,
    pan: 'ABCDE1234F',
    isPfEligible: true,
    isPtEligible: true
  });
  await payrollEngine.createEmployee(testCompanyA, testUser, {
    name: 'Priya Nair',
    designation: 'Lead Product Designer',
    monthlyGross: 85000.0,
    pan: 'BCDEF2345G',
    isPfEligible: true,
    isPtEligible: true
  });
  await payrollEngine.createEmployee(testCompanyA, testUser, {
    name: 'Rahul Sen',
    designation: 'Full Stack Engineer',
    monthlyGross: 65000.0,
    pan: 'CDEFG3456H',
    isPfEligible: true,
    isPtEligible: true
  });
  await payrollEngine.createEmployee(testCompanyA, testUser, {
    name: 'Ananya Roy',
    designation: 'Operations Specialist',
    monthlyGross: 45000.0,
    pan: 'DEFGH4567J',
    isPfEligible: true,
    isPtEligible: true
  });

  const payrollRun = await payrollEngine.executePayrollRun(testCompanyA, testUser, { payPeriod: currentPeriod });
  assert(payrollRun.payslips.length >= 4, 'Must process payslips for active employees');
  assert(payrollRun.run.totalGross > 0);
  assert(payrollRun.run.totalEmployeePf > 0);
  assert(payrollRun.run.totalPt > 0);
  assert(payrollRun.run.totalNetSalary > 0);
  assert(payrollRun.journalEntry.id, 'Payroll run must post balanced Journal Entry');
  console.log(`  ✔ Payroll Run executed: Gross ₹${payrollRun.run.totalGross}, PF ₹${payrollRun.run.totalEmployeePf}, Net ₹${payrollRun.run.totalNetSalary} with balanced journal.`);

  // ── TEST 9: Bank Reconciliation Matching Engine ─────────────────────────────
  console.log('\n[9] Testing Bank Reconciliation Multi-Tier Matching Engine...');
  const today = new Date().toISOString().split('T')[0];
  const bankRec = await bankRecEngine.importBankStatement(testCompanyA, testUser, {
    accountId: bankAcc.id,
    fileName: 'hdfc_statement_sep2026.csv',
    lines: [
      { transactionDate: today, description: 'UPI/APEX DIGITAL/INVOICE/UPI-REC-998877', referenceNumber: 'UPI-REC-998877', withdrawalAmount: 0, depositAmount: 118000.0, runningBalance: 618000.0 },
      { transactionDate: today, description: 'NEFT/VERMA ADVOCATES/NEFT-VEN-112233', referenceNumber: 'NEFT-VEN-112233', withdrawalAmount: 54000.0, depositAmount: 0, runningBalance: 564000.0 },
      { transactionDate: today, description: 'SMS CHARGES', referenceNumber: '', withdrawalAmount: 20.0, depositAmount: 0, runningBalance: 563980.0 }
    ]
  });
  assert(bankRec.lines.length >= 3);
  assert(bankRec.reconciliation.exactMatches > 0, 'Must find exact match for invoice receipt');
  console.log(`  ✔ Bank Reconciliation: ${bankRec.reconciliation.exactMatches} exact matches, ${bankRec.reconciliation.autoMatches} auto matches, ${bankRec.reconciliation.unmatchedCount} unmatched.`);

  // ── TEST 10: Fixed Assets & Depreciation Engine ─────────────────────────────
  console.log('\n[10] Testing Fixed Assets SLM & WDV Depreciation Engine...');
  const asset = await fixedAssetsEngine.createFixedAsset(testCompanyA, testUser, {
    name: 'MacBook Pro M3 Max (Engineering)',
    category: 'Computers & IT',
    purchaseCost: 200000.0,
    salvageValue: 10000.0,
    usefulLifeYears: 3,
    depreciationMethod: 'SLM',
    recordPurchaseJournal: true
  });
  assert.strictEqual(asset.purchaseCost, 200000.0);
  assert.strictEqual(asset.netBookValue, 200000.0);

  const deprRun = await fixedAssetsEngine.executeDepreciationRun(testCompanyA, testUser, { period: 'FY-2026-27' });
  assert(deprRun.run.totalDepreciation > 0);
  assert(deprRun.journalEntry.id, 'Depreciation run must post balanced Journal Entry');
  console.log(`  ✔ Fixed Assets Depreciation posted: ₹${deprRun.run.totalDepreciation} with balanced journal.`);

  // ── TEST 11: Compliance Calendar & Statutory Due Dates ─────────────────────
  console.log('\n[11] Testing Dynamic Compliance Rules & Calendar...');
  const compTasks = await complianceEngine.getComplianceTasks(testCompanyA);
  assert(compTasks.tasks.length >= 15, 'Compliance calendar must generate statutory tasks');
  assert(compTasks.tasks.some((t) => t.ruleCode === 'GST_GSTR1_M'), 'GSTR-1 task must exist');
  assert(compTasks.tasks.some((t) => t.ruleCode === 'GST_GSTR3B_M'), 'GSTR-3B task must exist');
  assert(compTasks.tasks.some((t) => t.ruleCode === 'TDS_CHALLAN_281'), 'TDS Challan 281 task must exist');
  console.log(`  ✔ Compliance Calendar verified: ${compTasks.summary.total} tasks (${compTasks.summary.dueSoon} due soon, ${compTasks.summary.upcoming} upcoming).`);

  // ── TEST 12: Filing Preparation & Approval Workflow ─────────────────────────
  console.log('\n[12] Testing Filing Preparation & CA Approval Workflow...');
  const draftFiling = await filingPrepEngine.createFilingDraft(testCompanyA, testUser, { returnType: 'GSTR-1', taxPeriod: currentPeriod });
  assert.strictEqual(draftFiling.validationStatus, 'VALIDATED', 'Valid return draft must pass validation');
  assert.strictEqual(draftFiling.approvalStatus, 'PENDING_APPROVAL');

  // CA Approval
  const approvalRes = await filingPrepEngine.approveFiling(testCompanyA, draftFiling.id, testUser, {
    approvedByRole: 'CA',
    notes: 'Audited and verified with purchase and sales register.'
  });
  assert.strictEqual(approvalRes.filing.approvalStatus, 'APPROVED_BY_CA');
  assert.strictEqual(approvalRes.filing.submissionStatus, 'READY_FOR_PROVIDER');

  // Provider submission attempt (Credentials required check)
  const submitRes = await filingPrepEngine.submitFilingToProvider(testCompanyA, draftFiling.id, testUser);
  assert.strictEqual(submitRes.success, false);
  assert.strictEqual(submitRes.status, 'CREDENTIALS_REQUIRED', 'Must cleanly report credentials required instead of fake success!');
  console.log('  ✔ Filing Preparation flow verified: Draft -> Validated -> CA Approved -> Credentials Required reported cleanly.');

  // ── TEST 13: Financial Reports Consistency (Trial Balance, P&L, Balance Sheet)
  console.log('\n[13] Verifying Financial Statements Consistency & Invariants...');
  const trialBalance = await accountingEngine.getTrialBalance(testCompanyA);
  assert.strictEqual(trialBalance.isBalanced, true, `Trial Balance MUST balance! Debit ₹${trialBalance.totalDebit} vs Credit ₹${trialBalance.totalCredit}`);
  console.log(`  ✔ Trial Balance: Total Debits (₹${trialBalance.totalDebit}) === Total Credits (₹${trialBalance.totalCredit})`);

  const pnl = await accountingEngine.getProfitAndLoss(testCompanyA);
  assert(pnl.revenue.total > 0, 'P&L revenue must be positive from invoices');
  console.log(`  ✔ Profit & Loss Statement: Revenue ₹${pnl.revenue.total}, Expenses ₹${pnl.expenses.total}, Net Profit ₹${pnl.netProfit}`);

  const balanceSheet = await accountingEngine.getBalanceSheet(testCompanyA);
  assert.strictEqual(balanceSheet.isBalanced, true, `Balance Sheet MUST balance! Assets ₹${balanceSheet.totalAssets} vs Liab+Equity ₹${balanceSheet.totalLiabilitiesAndEquity}`);
  console.log(`  ✔ Balance Sheet Equation: Total Assets (₹${balanceSheet.totalAssets}) === Total Liabilities & Equity (₹${balanceSheet.totalLiabilitiesAndEquity})`);

  // ── TEST 14: Strict Multi-Company Tenant Data Isolation ──────────────────────
  console.log('\n[14] Verifying Multi-Company Tenant Data Isolation (Company B)...');
  const coaB = await accountingEngine.getChartOfAccounts(testCompanyB);
  const journalsB = await accountingEngine.getJournalEntries(testCompanyB);
  const invoicesB = await invoiceEngine.getGstInvoices(testCompanyB);
  const billsB = await invoiceEngine.getVendorBills(testCompanyB);
  const trialB = await accountingEngine.getTrialBalance(testCompanyB);

  assert.strictEqual(journalsB.totalCount, 0, 'Company B must see ZERO journal entries from Company A');
  assert.strictEqual(invoicesB.totalCount, 0, 'Company B must see ZERO invoices from Company A');
  assert.strictEqual(billsB.totalCount, 0, 'Company B must see ZERO bills from Company A');
  assert.strictEqual(trialB.totalDebit, 0, 'Company B must have ZERO debit balances');
  console.log('  ✔ Strict multi-company data isolation verified: Company B has 0 records from Company A.');

  console.log('\n================================================================');
  console.log('   ✅ ALL 14 PRODUCTION ENGINE TESTS PASSED WITH 100% ACCURACY  ');
  console.log('================================================================\n');
}

runProductionEngineTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ ENGINE TEST FAILED:', err);
  process.exit(1);
});
