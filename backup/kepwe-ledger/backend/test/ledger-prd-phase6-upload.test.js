import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { pool } from '../src/config/db.js';
import * as parserService from '../src/services/statement-parser.service.js';
import * as ledgerService from '../src/services/ledger.service.js';

const USER_A = '11111111-1111-4111-8111-111111111111'; // QA User 1
const USER_B = '22222222-2222-4222-8222-222222222222'; // QA User 2

test('Phase 6 — Comprehensive Statement Parsing, Intelligence & Persistence', async (t) => {

  await t.test('1. CSV Statement Parsing & Normalization', async () => {
    const csvContent = `Date,Description,Debit,Credit,Balance,RefNo
12/09/2026,UPI/SWIGGY/987654321/BLR,450.00,,15200.00,UPI987654321
13/09/2026,SALARY CREDIT ACME CORP,,85000.00,100200.00,SAL202609
14/09/2026,ZERODHA BROKING LTD,25000.00,,75200.00,ZER12345
15/09/2026,BESCOM ELECTRICITY BILL,1850.00,,73350.00,ELEC999`;

    const buffer = Buffer.from(csvContent, 'utf-8');
    const parsed = parserService.parseExcelOrCsv(buffer, 'bank_statement.csv');

    assert.equal(parsed.length, 4, 'Should parse all 4 transaction rows');

    // Row 1: Swiggy
    const r1 = parsed[0];
    assert.equal(r1.date, '2026-09-12');
    assert.equal(r1.amount, 450);
    assert.equal(r1.type, 'expense');
    assert.equal(r1.merchant, 'Swiggy');
    assert.equal(r1.category, 'Dining & Food Delivery');
    assert.equal(r1.classification, 'Lifestyle');
    assert.equal(r1.paymentMethod, 'UPI');

    // Row 2: Salary
    const r2 = parsed[1];
    assert.equal(r2.date, '2026-09-13');
    assert.equal(r2.amount, 85000);
    assert.equal(r2.type, 'income');
    assert.equal(r2.category, 'Salary');
    assert.equal(r2.classification, 'Essential');

    // Row 3: Zerodha
    const r3 = parsed[2];
    assert.equal(r3.date, '2026-09-14');
    assert.equal(r3.amount, 25000);
    assert.equal(r3.type, 'investment');
    assert.equal(r3.merchant, 'Zerodha Broking');
    assert.equal(r3.classification, 'Financial');

    // Row 4: BESCOM
    const r4 = parsed[3];
    assert.equal(r4.date, '2026-09-15');
    assert.equal(r4.amount, 1850);
    assert.equal(r4.type, 'expense');
    assert.equal(r4.merchant, 'Electricity Utility');
    assert.equal(r4.classification, 'Essential');
    assert.equal(r4.isRecurring, true);
  });

  await t.test('2. Excel (.xlsx) Statement Parsing', async () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Txn Date', 'Particulars', 'Withdrawal Amount', 'Deposit Amount', 'Running Balance'],
      ['10-09-2026', 'NETFLIX ENTERTAINMENT', 649, '', 25000],
      ['11-09-2026', 'BLINKIT QUICK COMMERCE', 780, '', 24220],
      ['12-09-2026', 'DIVIDEND CREDIT TCS', '', 1200, 25420],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = parserService.parseExcelOrCsv(xlsxBuffer, 'statement.xlsx');
    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].merchant, 'Netflix');
    assert.equal(parsed[0].classification, 'Lifestyle');
    assert.equal(parsed[0].isRecurring, true);
    assert.equal(parsed[1].merchant, 'Blinkit');
    assert.equal(parsed[1].classification, 'Essential');
    assert.equal(parsed[2].type, 'income');
    assert.equal(parsed[2].category, 'Investment Returns');
  });

  await t.test('3. UPI Statement & Pattern Normalization', async () => {
    const patterns = [
      { text: 'UPI/4567890123/rahul@okhdfcbank/PAYMENT', expectedMerchant: 'rahul' },
      { text: 'UPI-ZEPTO-998877', expectedMerchant: 'Zepto' },
      { text: 'Paid to Apollo Pharmacy', expectedMerchant: 'Apollo Pharmacy' },
    ];

    for (const p of patterns) {
      const cls = parserService.classifyTransaction(p.text, 500, 0);
      assert.ok(
        cls.merchant.toLowerCase().includes(p.expectedMerchant.toLowerCase()),
        `Should extract ${p.expectedMerchant} from '${p.text}', got '${cls.merchant}'`
      );
    }
  });

  await t.test('4. Credit Card Statement Intelligence (Bill Payment vs Spending)', async () => {
    const ccSpending = parserService.classifyTransaction('ZARA RETAIL BANGALORE POS', 4500, 0);
    assert.equal(ccSpending.category, 'Shopping');
    assert.equal(ccSpending.classification, 'Lifestyle');

    const ccBillPayment = parserService.classifyTransaction('CRED/HDFC CC BILL PAYMENT/AUTO', 15000, 0);
    assert.equal(ccBillPayment.category, 'Credit Card Payment');
    assert.equal(ccBillPayment.classification, 'Financial');

    const emi = parserService.classifyTransaction('BAJAJ FINANCE EMI DEBIT', 3500, 0);
    assert.equal(emi.category, 'Loan EMI');
    assert.equal(emi.classification, 'Essential');
  });

  await t.test('5. Duplicate Detection Engine (PostgreSQL DB + In-Batch)', async () => {
    // Clean up any test records for User A
    await pool.query('DELETE FROM ledger_transactions WHERE user_id = $1', [USER_A]);

    // Insert an existing baseline transaction in PostgreSQL
    await pool.query(
      `INSERT INTO ledger_transactions (id, user_id, type, amount, transaction_date, merchant, description, category, classification, source)
       VALUES (gen_random_uuid(), $1, 'expense', 1200.00, '2026-09-12', 'Swiggy', 'Dinner Swiggy', 'Dining & Food Delivery', 'Lifestyle', 'MANUAL')`,
      [USER_A]
    );

    // Staged batch containing:
    // 1. Exact duplicate of existing DB transaction (₹1,200 on 2026-09-12 from Swiggy)
    // 2. Fuzzy duplicate (within 1 day, same amount & merchant: ₹1,200 on 2026-09-13 from Swiggy)
    // 3. New unique transaction (₹850 Uber on 2026-09-14)
    // 4. Repeated internal batch transaction (same Uber ₹850 on 2026-09-14)
    const staged = [
      { date: '2026-09-12', amount: 1200, type: 'expense', merchant: 'Swiggy', description: 'Swiggy food order' },
      { date: '2026-09-13', amount: 1200, type: 'expense', merchant: 'Swiggy', description: 'Swiggy second order' },
      { date: '2026-09-14', amount: 850, type: 'expense', merchant: 'Uber', description: 'Ride to airport' },
      { date: '2026-09-14', amount: 850, type: 'expense', merchant: 'Uber', description: 'Ride to airport' },
    ];

    const analyzed = await parserService.detectDuplicates(USER_A, staged);

    // Row 1: exact duplicate
    assert.equal(analyzed[0].isDuplicate, true, 'Row 1 should be flagged as exact duplicate');
    assert.ok(analyzed[0].duplicateConfidence >= 0.85);

    // Row 2: likely fuzzy duplicate
    assert.equal(analyzed[1].isDuplicate, true, 'Row 2 should be flagged as likely fuzzy duplicate');

    // Row 3: unique
    assert.equal(analyzed[2].isDuplicate, false, 'Row 3 should not be a duplicate');

    // Row 4: internal batch duplicate of Row 3
    assert.equal(analyzed[3].isDuplicate, true, 'Row 4 should be flagged as batch duplicate');
  });

  await t.test('6. User Review & Full Database Persistence (PostgreSQL)', async () => {
    // Confirm and commit transactions to PostgreSQL
    const commitData = {
      fileName: 'qa_sept_statement.csv',
      fileType: 'CSV',
      sourceType: 'BANK_STATEMENT',
      institution: 'HDFC Bank',
      closingBalance: 88500,
      transactions: [
        {
          date: '2026-09-01',
          amount: 75000,
          type: 'income',
          category: 'Salary',
          merchant: 'Tech Innovations Ltd',
          classification: 'Essential',
          isRecurring: true,
          paymentMethod: 'NEFT',
          description: 'September Salary',
        },
        {
          date: '2026-09-05',
          amount: 22000,
          type: 'expense',
          category: 'Housing & Rent',
          merchant: 'Landlord Rent',
          classification: 'Essential',
          isRecurring: true,
          paymentMethod: 'UPI',
          description: 'Apartment Rent',
        },
        {
          date: '2026-09-08',
          amount: 15000,
          type: 'investment',
          category: 'Investments',
          merchant: 'Zerodha Broking',
          classification: 'Financial',
          isRecurring: true,
          paymentMethod: 'UPI',
          description: 'Nifty 50 Index Fund SIP',
        },
        {
          date: '2026-09-10',
          amount: 3200,
          type: 'expense',
          category: 'Dining & Food Delivery',
          merchant: 'Zomato',
          classification: 'Lifestyle',
          isRecurring: false,
          paymentMethod: 'UPI',
          description: 'Weekend Dining',
        },
      ],
    };

    const commitRes = await ledgerService.commitImportedTransactions(USER_A, commitData);
    assert.ok(commitRes.importId, 'Should return generated importId');
    assert.equal(commitRes.importedCount, 4, 'Should insert all 4 confirmed transactions');

    // Verify PostgreSQL records
    const checkRes = await pool.query(
      `SELECT id, type, amount, category, merchant, classification, is_recurring, statement_import_id
       FROM ledger_transactions
       WHERE user_id = $1 AND statement_import_id = $2
       ORDER BY amount DESC`,
      [USER_A, commitRes.importId]
    );

    assert.equal(checkRes.rows.length, 4, '4 rows must exist in PostgreSQL with statement_import_id');
    const salaryRow = checkRes.rows.find((r) => r.type === 'income');
    assert.equal(Number(salaryRow.amount), 75000);
    assert.equal(salaryRow.category, 'Salary');
    assert.equal(salaryRow.classification, 'Essential');

    const invRow = checkRes.rows.find((r) => r.type === 'investment');
    assert.equal(Number(invRow.amount), 15000);
    assert.equal(invRow.classification, 'Financial');

    // Verify ledger_statement_imports record
    const importMeta = await pool.query(
      'SELECT id, file_name, source_type, institution, imported_count, status FROM ledger_statement_imports WHERE id = $1',
      [commitRes.importId]
    );
    assert.equal(importMeta.rows[0].file_name, 'qa_sept_statement.csv');
    assert.equal(importMeta.rows[0].institution, 'HDFC Bank');
    assert.equal(importMeta.rows[0].status, 'COMPLETED');
  });

  await t.test('7. Dedicated Monthly Income Stream Entry', async () => {
    const incomeData = {
      sourceType: 'freelance',
      amount: 45000,
      employerOrClient: 'Global Design Studio',
      depositDate: '2026-09-18',
      isRecurring: true,
      notes: 'Consulting retainer fee',
    };

    const res = await ledgerService.recordMonthlyIncome(USER_A, incomeData);
    assert.ok(res.transaction.id);
    assert.equal(res.transaction.type, 'income');
    assert.equal(res.transaction.category, 'Freelance Income');
    assert.equal(res.transaction.amount, 45000);

    // Verify Financial Profile updated
    const prof = await pool.query('SELECT freelance_income FROM ledger_financial_profiles WHERE user_id = $1', [USER_A]);
    assert.equal(Number(prof.rows[0].freelance_income), 45000);
  });

  await t.test('8. Dedicated Recurring Expense Entry', async () => {
    const expenseData = {
      expenseType: 'EMI',
      amount: 14500,
      payee: 'HDFC Home Loan',
      dueDate: '2026-09-05',
      frequency: 'monthly',
      classification: 'Essential',
      notes: 'Home Loan monthly EMI',
    };

    const res = await ledgerService.recordRecurringExpense(USER_A, expenseData);
    assert.ok(res.transaction.id);
    assert.equal(res.transaction.type, 'expense');
    assert.equal(res.transaction.isRecurring, true);
    assert.equal(res.transaction.category, 'Loan EMI');
    assert.equal(res.transaction.classification, 'Essential');
  });

  await t.test('9. User Isolation Test (User A vs User B Security)', async () => {
    // User B should NOT see User A's transactions or statement imports
    const userBTxs = await pool.query('SELECT * FROM ledger_transactions WHERE user_id = $1', [USER_B]);
    const userBImports = await pool.query('SELECT * FROM ledger_statement_imports WHERE user_id = $1', [USER_B]);

    assert.equal(userBTxs.rows.length, 0, 'User B must have 0 transactions');
    assert.equal(userBImports.rows.length, 0, 'User B must have 0 statement imports');

    // Attempt to update User A's transaction using User B's credentials
    const userATx = (await pool.query('SELECT id FROM ledger_transactions WHERE user_id = $1 LIMIT 1', [USER_A])).rows[0];
    const unauthorizedUpdate = await ledgerService.updateTransaction(USER_B, userATx.id, { amount: 99999 });
    assert.equal(unauthorizedUpdate, null, 'User B cannot modify User A transaction');
  });

  await t.test('10. Live Dashboard Data Reflects Real Imported Financial Data', async () => {
    const dash = await ledgerService.getDashboardData(USER_A, { datePreset: 'this_month' });

    assert.ok(dash.metrics.income >= 75000, 'Total income must reflect imported salary & freelance');
    assert.ok(dash.metrics.expenses >= 25000, 'Total expenses must reflect rent and food');
    assert.ok(dash.metrics.investments >= 15000, 'Investments must reflect Zerodha SIP');
    assert.ok(dash.financialHealth?.score > 0, 'Health score must be calculated from real data');
    assert.ok(dash.spendingOverview.classifications.essential.amount > 0, 'Essential spending must be > 0');
    assert.ok(dash.spendingOverview.classifications.lifestyle.amount > 0, 'Lifestyle spending must be > 0');
    assert.ok(dash.recentTransactions.length > 0, 'Recent transactions must contain real persisted rows');
  });

  await t.test('11. Error Handling: Empty & Malformed Input Rejection', async () => {
    // Empty buffer
    assert.throws(() => {
      parserService.parseExcelOrCsv(Buffer.from('', 'utf-8'), 'empty.csv');
    }, /No readable data rows found/i);

    // Header without data
    assert.throws(() => {
      parserService.parseExcelOrCsv(Buffer.from('ColA,ColB,ColC\n', 'utf-8'), 'blank.csv');
    }, /(?:Could not identify any valid financial transaction rows|No readable data rows found)/i);

    // Empty commit array
    await assert.rejects(async () => {
      await ledgerService.commitImportedTransactions(USER_A, { transactions: [] });
    }, /No confirmed transactions provided/i);
  });
});
