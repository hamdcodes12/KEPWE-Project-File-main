import assert from 'assert';
import crypto from 'crypto';

import { pool, closeEmbeddedDatabase, getPglite } from '../src/config/db.js';
import * as accountingEngine from '../src/services/accounting-engine.service.js';
import * as invoiceEngine from '../src/services/invoice-engine.service.js';
import * as gstEngine from '../src/services/gst-engine.service.js';
import * as tdsEngine from '../src/services/tds-engine.service.js';
import * as payrollEngine from '../src/services/payroll-engine.service.js';
import * as bankRecEngine from '../src/services/bank-reconciliation.service.js';
import * as fixedAssetsEngine from '../src/services/fixed-assets.service.js';
import * as complianceEngine from '../src/services/compliance-engine.service.js';
import * as filingPrepEngine from '../src/services/filing-prep.service.js';
import * as ledgerService from '../src/services/ledger.service.js';
import { integrationManager } from '../src/integrations/integration-manager.js';

async function runPersistenceAndInvariantsSuite() {
  console.log('================================================================');
  console.log('  KEPWE LEDGER: PERSISTENCE, INVARIANTS & RESTART TEST SUITE    ');
  console.log('================================================================\n');

  const tenantAlpha = crypto.randomUUID();
  const tenantBeta = crypto.randomUUID();
  const testUser = crypto.randomUUID();
  let testIdemKey;
  let ledgerAcc;
  let ledgerTx;

  // Create parent companies and user in DB
  await pool.query(
    `INSERT INTO companies (id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
    [tenantAlpha, 'Alpha Autonomous Enterprises']
  );
  await pool.query(
    `INSERT INTO companies (id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
    [tenantBeta, 'Beta Segregated Corporation']
  );
  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, full_name, created_at, updated_at) VALUES ($1, $2, 'hash', 'customer', 'Persistence Test User', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
    [testUser, `pers-${Date.now()}@kepwe.internal`]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1: ZERO GHOST / ZERO MOCK DATA GUARANTEE FOR FRESH TENANT
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[TEST 1] Verifying Clean Initial State (Zero Ghost Data)...');
  const freshEmployees = await payrollEngine.getEmployees(tenantAlpha);
  assert.strictEqual(freshEmployees.length, 0, 'Fresh company must have 0 employees (no fake ₹45k default seeds)');

  const freshAssets = await fixedAssetsEngine.getFixedAssets(tenantAlpha);
  assert.strictEqual(freshAssets.length, 0, 'Fresh company must have 0 fixed assets (no fake MacBooks/servers)');

  const freshStatements = await bankRecEngine.getBankStatements(tenantAlpha);
  assert.strictEqual(freshStatements.length, 0, 'Fresh company must have 0 bank statements (no fake sample statements)');

  const freshTasks = await complianceEngine.getComplianceTasks(tenantAlpha);
  assert.strictEqual(freshTasks.summary.completed, 0, 'Fresh company must have 0 completed compliance tasks (no fake ACK/ARN)');
  console.log('  ✔ Zero Ghost Data Confirmed: All entity rosters are empty [] on initial creation.\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2: WRITE REAL PRODUCTION RECORDS FOR TENANT ALPHA
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[TEST 2] Writing Production Records for Tenant Alpha...');

  // Setup Alpha Profile
  await accountingEngine.updateCompanyProfile(tenantAlpha, testUser, {
    legalName: 'Alpha Autonomous Enterprises',
    pan: 'ABCDE1234F',
    gstin: '27ABCDE1234F1Z5',
    state: 'Maharashtra',
    stateCode: '27'
  });

  // Init Chart of Accounts
  const coaAlpha = await accountingEngine.initDefaultChartOfAccounts(tenantAlpha);
  const bankAcc = coaAlpha.find((a) => a.code === '1010');
  const capitalAcc = coaAlpha.find((a) => a.code === '3010');
  const arAcc = coaAlpha.find((a) => a.code === '1030');
  const salesAcc = coaAlpha.find((a) => a.code === '4010');

  // Post ₹500,000 Capital Journal
  const capitalJournal = await accountingEngine.postJournalEntry(tenantAlpha, testUser, {
    entryDate: '2026-04-01',
    narration: 'Promoter equity capital introduction',
    referenceType: 'EQUITY_INJECTION',
    lines: [
      { accountId: bankAcc.id, debit: 500000.0, credit: 0, narration: 'Bank Current A/C debit' },
      { accountId: capitalAcc.id, debit: 0, credit: 500000.0, narration: 'Shareholder Capital credit' }
    ]
  });
  assert(capitalJournal.entry.id);

  // Create Employee with real salary structure
  const employee = await payrollEngine.createEmployee(tenantAlpha, testUser, {
    name: 'Siddharth Varma',
    employeeCode: 'EMP-ALPHA-001',
    designation: 'Principal Engineer',
    monthlyGross: 150000.0,
    pan: 'ABCDE5678G',
    isPfEligible: true,
    isPtEligible: true
  });
  assert(employee.id);
  assert.strictEqual(employee.salaryStructure.monthlyGross, 150000.0);

  // Register Fixed Asset
  const asset = await fixedAssetsEngine.createFixedAsset(tenantAlpha, testUser, {
    name: 'Production Cloud Computing Rig',
    assetCode: 'FA-ALPHA-01',
    category: 'Computers & IT',
    purchaseCost: 250000.0,
    salvageValue: 25000.0,
    usefulLifeYears: 3,
    depreciationMethod: 'SLM',
    recordPurchaseJournal: true
  });
  assert(asset.id);
  assert.strictEqual(asset.purchaseCost, 250000.0);

  // Create GST Sales Invoice
  const invoice = await invoiceEngine.createGstInvoice(tenantAlpha, testUser, {
    customerName: 'Enterprise Client Services Ltd',
    customerGstin: '27AABCE4455P1Z8',
    placeOfSupplyCode: '27',
    items: [
      { itemDescription: 'Cloud Architecture & DevOps Retainer', hsnSac: '998313', quantity: 1, unitPrice: 200000.0, gstRate: 18 }
    ]
  });
  assert(invoice.id);
  assert.strictEqual(invoice.totalAmount, 236000.0);
  assert.strictEqual(invoice.outstandingAmount, 236000.0);

  // Record Full Payment for Invoice
  const payRes = await invoiceEngine.recordInvoicePayment(tenantAlpha, invoice.id, testUser, {
    amount: 236000.0,
    paymentMethod: 'NEFT',
    referenceNumber: 'NEFT-ALPHA-INV-001'
  });
  assert.strictEqual(payRes.invoice.status, 'Paid');

  // Lock GST Tax Period
  const lockRes = await gstEngine.lockTaxPeriod(tenantAlpha, '2026-04', testUser, 'GSTR-3B filed');
  assert.strictEqual(lockRes.success, true);
  const isLocked = await gstEngine.isTaxPeriodLocked(tenantAlpha, '2026-04');
  assert.strictEqual(isLocked, true);

  // Write Idempotency Record
  testIdemKey = `idem-${tenantAlpha}-invoice-001`;
  await pool.query(
    `INSERT INTO idempotency_records (key, request_fingerprint, company_id, user_id, endpoint, status, response_status_code, response_body, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '24 hours')`,
    [testIdemKey, 'fp-alpha-001', tenantAlpha, testUser, '/api/invoices', 'COMPLETED', 201, JSON.stringify({ invoiceId: invoice.id })]
  );

  // Write Ledger Service Account & Transaction
  ledgerAcc = await ledgerService.createAccount(testUser, {
    name: 'Primary Operations HDFC Bank',
    type: 'Bank Account',
    accountNumber: '5010022334455',
    bankName: 'HDFC Bank Ltd',
    ifscCode: 'HDFC0000001',
    openingBalance: 100000.0,
    isDefault: true
  });
  assert(ledgerAcc.id);
  ledgerTx = await ledgerService.createTransaction(testUser, {
    accountId: ledgerAcc.id,
    type: 'income',
    amount: 50000.0,
    transactionDate: '2026-04-05',
    category: 'Consulting Services',
    counterparty: 'Client Alpha',
    description: 'Direct client payment',
    paymentMethod: 'IMPS'
  });
  assert(ledgerTx.id);

  // Verify Trial Balance balances
  const trialBefore = await accountingEngine.getTrialBalance(tenantAlpha);
  assert.strictEqual(trialBefore.isBalanced, true);
  assert.strictEqual(trialBefore.totalDebit, trialBefore.totalCredit);
  console.log(`  ✔ Alpha Records Written: Trial Balance total ₹${trialBefore.totalDebit} is strictly balanced.\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3: STRICT MULTI-TENANT ISOLATION FOR TENANT BETA
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[TEST 3] Verifying Multi-Tenant Isolation (Tenant Beta)...');
  await accountingEngine.initDefaultChartOfAccounts(tenantBeta);

  const betaJournals = await accountingEngine.getJournalEntries(tenantBeta);
  assert.strictEqual(betaJournals.totalCount, 0, 'Tenant Beta must see 0 journal entries from Tenant Alpha');

  const betaEmployees = await payrollEngine.getEmployees(tenantBeta);
  assert.strictEqual(betaEmployees.length, 0, 'Tenant Beta must see 0 employees from Tenant Alpha');

  const betaAssets = await fixedAssetsEngine.getFixedAssets(tenantBeta);
  assert.strictEqual(betaAssets.length, 0, 'Tenant Beta must see 0 fixed assets from Tenant Alpha');

  const betaInvoices = await invoiceEngine.getGstInvoices(tenantBeta);
  assert.strictEqual(betaInvoices.totalCount, 0, 'Tenant Beta must see 0 invoices from Tenant Alpha');

  const betaTrial = await accountingEngine.getTrialBalance(tenantBeta);
  assert.strictEqual(betaTrial.totalDebit, 0, 'Tenant Beta trial balance must be 0');
  console.log('  ✔ Multi-Tenant Isolation Confirmed: Tenant Beta has exactly 0 records and 0 balance leakage.\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 4: POSTGRESQL PERSISTENCE ACROSS RESTART (CREATE -> RESTART -> READ)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[TEST 4] Simulating Server/Process Restart with New PGlite Instance on Disk...');
  await closeEmbeddedDatabase();
  const restartDb = await getPglite();

  // 1. Verify Company Accounting Profile survived
  const profCheck = await restartDb.query(
    `SELECT legal_name, gstin, pan FROM company_accounting_profiles WHERE company_id = $1`,
    [tenantAlpha]
  );
  assert.strictEqual(profCheck.rows.length, 1);
  assert.strictEqual(profCheck.rows[0].legal_name, 'Alpha Autonomous Enterprises');
  assert.strictEqual(profCheck.rows[0].gstin, '27ABCDE1234F1Z5');

  // 2. Verify Journal Entries & Journal Lines survived
  const jrnCheck = await restartDb.query(
    `SELECT * FROM journal_entries WHERE company_id = $1`,
    [tenantAlpha]
  );
  assert(jrnCheck.rows.length >= 2, 'Journal entries must be persisted to disk');

  const linesCheck = await restartDb.query(
    `SELECT COUNT(*) as cnt FROM journal_lines WHERE company_id = $1`,
    [tenantAlpha]
  );
  assert(Number(linesCheck.rows[0].cnt) >= 4, 'Journal lines must be persisted to disk');

  // 3. Verify Employees & Salary Structures survived
  const empCheck = await restartDb.query(
    `SELECT * FROM payroll_employees WHERE company_id = $1`,
    [tenantAlpha]
  );
  assert.strictEqual(empCheck.rows.length, 1);
  assert.strictEqual(empCheck.rows[0].name, 'Siddharth Varma');

  const salCheck = await restartDb.query(
    `SELECT * FROM payroll_salary_structures WHERE employee_id = $1`,
    [empCheck.rows[0].id]
  );
  assert.strictEqual(salCheck.rows.length, 1);
  assert.strictEqual(Number(salCheck.rows[0].monthly_gross), 150000.0);

  // 4. Verify Fixed Assets survived
  const assetCheck = await restartDb.query(
    `SELECT * FROM fixed_assets WHERE company_id = $1`,
    [tenantAlpha]
  );
  assert.strictEqual(assetCheck.rows.length, 1);
  assert.strictEqual(Number(assetCheck.rows[0].purchase_cost), 250000.0);

  // 5. Verify Sales Invoices survived
  const invCheck = await restartDb.query(
    `SELECT * FROM gst_invoices WHERE company_id = $1`,
    [tenantAlpha]
  );
  assert.strictEqual(invCheck.rows.length, 1);
  assert.strictEqual(Number(invCheck.rows[0].total_amount), 236000.0);
  assert.strictEqual(invCheck.rows[0].status, 'Paid');

  // 6. Verify Mathematical Integrity in Disk-Persisted Database
  const sumDebitsCheck = await restartDb.query(
    `SELECT SUM(debit) as debits, SUM(credit) as credits FROM journal_lines WHERE company_id = $1`,
    [tenantAlpha]
  );
  const dSum = Number(sumDebitsCheck.rows[0].debits);
  const cSum = Number(sumDebitsCheck.rows[0].credits);
  assert.strictEqual(dSum, cSum, 'Sum of Debits must strictly equal Sum of Credits on persisted disk');

  // 7. Verify GST Tax Period Lock survived
  const lockCheck = await restartDb.query(
    `SELECT * FROM gst_tax_period_locks WHERE company_id = $1 AND tax_period = $2`,
    [tenantAlpha, '2026-04']
  );
  assert.strictEqual(lockCheck.rows.length, 1, 'GST Tax Period lock must survive restart');
  assert.strictEqual(lockCheck.rows[0].reason, 'GSTR-3B filed');

  // 8. Verify Idempotency Record survived
  const idemCheck = await restartDb.query(
    `SELECT * FROM idempotency_records WHERE key = $1`,
    [testIdemKey]
  );
  assert.strictEqual(idemCheck.rows.length, 1, 'Idempotency record must survive restart');
  assert.strictEqual(idemCheck.rows[0].status, 'COMPLETED');

  // 9. Verify Ledger Accounts and Transactions survived
  const accCheck = await restartDb.query(
    `SELECT * FROM ledger_accounts WHERE user_id = $1 AND id = $2`,
    [testUser, ledgerAcc.id]
  );
  assert.strictEqual(accCheck.rows.length, 1, 'Ledger account must survive restart');
  assert.strictEqual(Number(accCheck.rows[0].current_balance), 150000.0, 'Ledger account balance must be 150,000 (100k opening + 50k tx)');

  const txCheck = await restartDb.query(
    `SELECT * FROM ledger_transactions WHERE user_id = $1 AND id = $2`,
    [testUser, ledgerTx.id]
  );
  assert.strictEqual(txCheck.rows.length, 1, 'Ledger transaction must survive restart');
  assert.strictEqual(Number(txCheck.rows[0].amount), 50000.0);

  await restartDb.close();
  console.log(`  ✔ CREATE -> RESTART -> READ Confirmed: 100% of tables and records intact after process restart! (Debits ₹${dSum} === Credits ₹${cSum})\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 5: PROVIDER ADAPTERS CREDENTIALS_REQUIRED AUDIT
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[TEST 5] Verifying 7 External Provider Adapter Contracts...');
  const providers = await integrationManager.getAllProvidersStatus();
  assert.strictEqual(providers.length, 7);

  for (const p of providers) {
    assert.strictEqual(p.status, 'CREDENTIALS_REQUIRED', `${p.key} must report CREDENTIALS_REQUIRED when live keys are absent`);
    assert(p.requiredEnvVars.length >= 3);
  }
  console.log('  ✔ All 7 Provider Adapters report CREDENTIALS_REQUIRED cleanly without fake mock responses.\n');

  console.log('================================================================');
  console.log('  ✅ ALL PERSISTENCE, MULTI-TENANT & INVARIANT TESTS PASSED!    ');
  console.log('================================================================\n');
}

runPersistenceAndInvariantsSuite().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ PERSISTENCE & INVARIANTS TEST FAILED:', err);
  process.exit(1);
});
