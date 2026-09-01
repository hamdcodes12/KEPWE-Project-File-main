import assert from 'assert';
import * as ledgerService from '../src/services/ledger.service.js';

async function runLedgerVerification() {
  console.log('--- STARTING KEPWE LEDGER VERIFICATION ---');

  const testUserA = 'test-user-a-' + Date.now();
  const testUserB = 'test-user-b-' + Date.now();

  // 1. Create Accounts for User A
  console.log('1. Creating accounts for User A...');
  const bankAcc = await ledgerService.createAccount(testUserA, {
    name: 'HDFC Operating Current A/C',
    type: 'Bank Account',
    accountNumber: '50200099887766',
    bankName: 'HDFC Bank',
    ifscCode: 'HDFC0001234',
    openingBalance: 50000,
    isDefault: true,
  });
  assert(bankAcc.id, 'Account ID must exist');
  assert.strictEqual(bankAcc.currentBalance, 50000, 'Initial balance must be 50,000');

  const cashAcc = await ledgerService.createAccount(testUserA, {
    name: 'Petty Cash Drawer',
    type: 'Cash',
    openingBalance: 5000,
  });
  assert.strictEqual(cashAcc.currentBalance, 5000);

  // 2. Add ₹10,000 Income to Bank Account
  console.log('2. Recording ₹10,000 Income for User A...');
  const txIncome = await ledgerService.createTransaction(testUserA, {
    type: 'income',
    amount: 10000,
    category: 'Sales Revenue',
    counterparty: 'Apex Digital Media',
    description: 'Design consulting retainer',
    accountId: bankAcc.id,
    paymentMethod: 'UPI',
  });
  assert(txIncome.id);
  assert.strictEqual(txIncome.amount, 10000);

  // Check Account Balance: 50,000 + 10,000 = 60,000
  const accountsA1 = await ledgerService.getAccounts(testUserA);
  const updatedBank1 = accountsA1.find((a) => a.id === bankAcc.id);
  assert.strictEqual(updatedBank1.currentBalance, 60000, 'Bank balance must be 60,000 after 10,000 income');

  // Check Dashboard Overview
  const dashA1 = await ledgerService.getDashboardData(testUserA, { datePreset: 'all' });
  assert.strictEqual(dashA1.metrics.totalIncome, 10000);
  assert.strictEqual(dashA1.metrics.totalExpenses, 0);
  assert.strictEqual(dashA1.metrics.netPosition, 10000);

  // 3. Add ₹2,000 Expense from Bank Account
  console.log('3. Recording ₹2,000 Expense for User A...');
  const txExpense = await ledgerService.createTransaction(testUserA, {
    type: 'expense',
    amount: 2000,
    category: 'Office Rent & Utilities',
    counterparty: 'WeWork Hub',
    description: 'Co-working hot desk monthly fee',
    accountId: bankAcc.id,
    paymentMethod: 'Bank Transfer',
  });
  assert(txExpense.id);

  // Net position: 10,000 - 2,000 = 8,000
  const dashA2 = await ledgerService.getDashboardData(testUserA, { datePreset: 'all' });
  assert.strictEqual(dashA2.metrics.totalIncome, 10000);
  assert.strictEqual(dashA2.metrics.totalExpenses, 2000);
  assert.strictEqual(dashA2.metrics.netPosition, 8000);

  // Bank balance: 60,000 - 2,000 = 58,000
  const accountsA2 = await ledgerService.getAccounts(testUserA);
  const updatedBank2 = accountsA2.find((a) => a.id === bankAcc.id);
  assert.strictEqual(updatedBank2.currentBalance, 58000);

  // 4. Create ₹5,000 Receivable Invoice
  console.log('4. Creating ₹5,000 Receivable Invoice for User A...');
  const invoice = await ledgerService.createReceivable(testUserA, {
    customerName: 'Horizon Logistics',
    subtotal: 5000,
    taxAmount: 0,
    totalAmount: 5000,
    dueDate: '2026-09-30',
  });
  assert(invoice.id);
  assert.strictEqual(invoice.totalAmount, 5000);
  assert.strictEqual(invoice.outstandingAmount, 5000);
  assert.strictEqual(invoice.status, 'Pending');

  // Check Dashboard Receivables
  const dashA3 = await ledgerService.getDashboardData(testUserA, { datePreset: 'all' });
  assert.strictEqual(dashA3.metrics.totalReceivables, 5000);

  // 5. Record ₹2,000 Payment on Invoice
  console.log('5. Recording ₹2,000 Payment on Invoice...');
  const paymentResult = await ledgerService.recordReceivablePayment(testUserA, invoice.id, {
    amount: 2000,
    accountId: bankAcc.id,
    paymentMethod: 'UPI',
    referenceNumber: 'UPI-REC-112233',
  });
  assert.strictEqual(paymentResult.receivable.paidAmount, 2000);
  assert.strictEqual(paymentResult.receivable.outstandingAmount, 3000);
  assert.strictEqual(paymentResult.receivable.status, 'Partially Paid');

  // Dashboard Check after Receivable Payment:
  // Income increases by 2,000 -> Total Income = 12,000
  // Net Position = 12,000 - 2,000 = 10,000
  // Outstanding Receivables = 3,000
  // Bank Balance = 58,000 + 2,000 = 60,000
  const dashA4 = await ledgerService.getDashboardData(testUserA, { datePreset: 'all' });
  assert.strictEqual(dashA4.metrics.totalIncome, 12000);
  assert.strictEqual(dashA4.metrics.totalReceivables, 3000);
  assert.strictEqual(dashA4.metrics.netPosition, 10000);

  // 6. Create ₹4,000 Payable Bill
  console.log('6. Creating ₹4,000 Payable Bill for User A...');
  const bill = await ledgerService.createPayable(testUserA, {
    vendorName: 'AWS Cloud Services',
    category: 'Software & Cloud Tools',
    subtotal: 4000,
    taxAmount: 0,
    totalAmount: 4000,
    dueDate: '2026-09-25',
  });
  assert.strictEqual(bill.outstandingAmount, 4000);

  const dashA5 = await ledgerService.getDashboardData(testUserA, { datePreset: 'all' });
  assert.strictEqual(dashA5.metrics.totalPayables, 4000);

  // 7. Record ₹1,000 Payment on Bill
  console.log('7. Recording ₹1,000 Payout on Bill...');
  const billPaymentResult = await ledgerService.recordPayablePayment(testUserA, bill.id, {
    amount: 1000,
    accountId: bankAcc.id,
    paymentMethod: 'Bank Transfer',
    referenceNumber: 'NEFT-556677',
  });
  assert.strictEqual(billPaymentResult.payable.paidAmount, 1000);
  assert.strictEqual(billPaymentResult.payable.outstandingAmount, 3000);

  // Dashboard Check after Bill Payment:
  // Total Expenses = 2,000 + 1,000 = 3,000
  // Net Position = 12,000 - 3,000 = 9,000
  // Outstanding Payables = 3,000
  // Bank Balance = 60,000 - 1,000 = 59,000
  const dashA6 = await ledgerService.getDashboardData(testUserA, { datePreset: 'all' });
  assert.strictEqual(dashA6.metrics.totalIncome, 12000);
  assert.strictEqual(dashA6.metrics.totalExpenses, 3000);
  assert.strictEqual(dashA6.metrics.netPosition, 9000);
  assert.strictEqual(dashA6.metrics.totalPayables, 3000);

  const accountsA3 = await ledgerService.getAccounts(testUserA);
  const updatedBank3 = accountsA3.find((a) => a.id === bankAcc.id);
  assert.strictEqual(updatedBank3.currentBalance, 59000);

  // 8. Test Reports Generation
  console.log('8. Verifying Financial P&L & Aging Reports...');
  const reports = await ledgerService.getFinancialReports(testUserA, { datePreset: 'all' });
  assert.strictEqual(reports.summary.totalIncome, 12000);
  assert.strictEqual(reports.summary.totalExpenses, 3000);
  assert.strictEqual(reports.summary.netProfit, 9000);
  assert.strictEqual(reports.aging.receivables.total, 3000);
  assert.strictEqual(reports.aging.payables.total, 3000);

  // 9. Test Multi-Tenant User Isolation (User B must see 0 records)
  console.log('9. Verifying User Isolation (User B)...');
  const dashB = await ledgerService.getDashboardData(testUserB, { datePreset: 'all' });
  assert.strictEqual(dashB.metrics.totalIncome, 0, 'User B must have 0 income');
  assert.strictEqual(dashB.metrics.totalExpenses, 0, 'User B must have 0 expenses');
  assert.strictEqual(dashB.metrics.netPosition, 0, 'User B must have 0 net position');
  assert.strictEqual(dashB.metrics.totalReceivables, 0, 'User B must have 0 receivables');
  assert.strictEqual(dashB.metrics.totalPayables, 0, 'User B must have 0 payables');
  assert.strictEqual(dashB.recentTransactions.length, 0, 'User B must see 0 transactions');

  const txsB = await ledgerService.getTransactions(testUserB);
  assert.strictEqual(txsB.transactions.length, 0);

  const recsB = await ledgerService.getReceivables(testUserB);
  assert.strictEqual(recsB.receivables.length, 0);

  // 10. Delete a Transaction and Verify Balance Rollback
  console.log('10. Verifying Delete Transaction & Recalculation...');
  await ledgerService.deleteTransaction(testUserA, txExpense.id); // Delete the ₹2,000 expense

  const dashA7 = await ledgerService.getDashboardData(testUserA, { datePreset: 'all' });
  assert.strictEqual(dashA7.metrics.totalExpenses, 1000, 'Expenses must decrease to 1,000');
  assert.strictEqual(dashA7.metrics.netPosition, 11000, 'Net position must increase to 11,000');

  const accountsA4 = await ledgerService.getAccounts(testUserA);
  const updatedBank4 = accountsA4.find((a) => a.id === bankAcc.id);
  assert.strictEqual(updatedBank4.currentBalance, 61000, 'Bank balance must roll back to 61,000');

  console.log('✅ ALL 10 KEPWE LEDGER VERIFICATION CHECKS PASSED PERFECTLY!');
}

runLedgerVerification().catch((err) => {
  console.error('❌ LEDGER VERIFICATION FAILED:', err);
  process.exit(1);
});
