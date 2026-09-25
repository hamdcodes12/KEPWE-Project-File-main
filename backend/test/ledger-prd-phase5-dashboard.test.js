import assert from 'assert';
import crypto from 'crypto';
import * as ledgerService from '../src/services/ledger.service.js';
import { pool } from '../src/config/db.js';

async function runPrdPhase5DashboardVerification() {
  console.log('=== STARTING KEPWE LEDGER PRD PHASE 5 DASHBOARD VERIFICATION ===');

  const testUserA = crypto.randomUUID();
  const testUserB = crypto.randomUUID();

  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, full_name) VALUES ($1, $2, 'hash', 'customer', 'Personal CFO User A') ON CONFLICT (id) DO NOTHING`,
    [testUserA, `cfo-a-${Date.now()}@test.com`]
  );
  await pool.query(
    `INSERT INTO users (id, email, password_hash, role, full_name) VALUES ($1, $2, 'hash', 'customer', 'Personal CFO User B') ON CONFLICT (id) DO NOTHING`,
    [testUserB, `cfo-b-${Date.now()}@test.com`]
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: New / Empty User Experience (PRD Section 11, 71)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Verifying Honest Empty State for New User (Zero fake data)...');
  const emptyDash = await ledgerService.getDashboardData(testUserA, { datePreset: 'this_month' });

  assert.strictEqual(emptyDash.metrics.income, 0, 'Empty user income must be 0, never fake');
  assert.strictEqual(emptyDash.metrics.expenses, 0, 'Empty user expenses must be 0, never fake');
  assert.strictEqual(emptyDash.metrics.savings, 0, 'Empty user savings must be 0, never fake');
  assert.strictEqual(emptyDash.metrics.savingsRate, null, 'Empty user savings rate must be null, not fake zero');
  assert.strictEqual(emptyDash.metrics.investments, 0, 'Empty user investments must be 0');
  assert.strictEqual(emptyDash.metrics.available, 0, 'Empty user available surplus must be 0');
  assert.strictEqual(emptyDash.financialHealth.score, null, 'Financial Health score must be null without data');
  assert.strictEqual(emptyDash.financialHealth.status, 'Awaiting Data', 'Financial health status must honestly be Awaiting Data');
  assert.strictEqual(emptyDash.dataFreshness.lastUpdated, null, 'Data freshness date must be null');
  assert.strictEqual(emptyDash.recentTransactions.length, 0, 'Recent transactions must be empty');
  assert(emptyDash.cfoInsight.headline.includes('Welcome'), 'Honest onboarding insight shown');
  console.log('   ✓ Honest empty state verified: No fake numbers, no fake health score.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Financial Profile Management (PRD Section 11, 38)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('2. Verifying Financial Profile Creation & Persistence...');
  const initialProfile = await ledgerService.getFinancialProfile(testUserA);
  assert.strictEqual(initialProfile.monthlySalary, 0, 'Initial salary is 0');

  const updatedProfile = await ledgerService.updateFinancialProfile(testUserA, {
    monthlySalary: 100000,
    freelanceIncome: 20000,
    businessIncome: 0,
    otherIncome: 5000,
    emergencySavings: 200000,
    monthlyDebtObligations: 15000,
    monthlySavingsTarget: 35000,
    occupation: 'Lead AI Engineer',
    city: 'Bengaluru',
  });

  assert.strictEqual(updatedProfile.monthlySalary, 100000);
  assert.strictEqual(updatedProfile.emergencySavings, 200000);
  assert.strictEqual(updatedProfile.monthlyDebtObligations, 15000);
  assert.strictEqual(updatedProfile.monthlySavingsTarget, 35000);
  assert.strictEqual(updatedProfile.city, 'Bengaluru');

  const retrievedProfile = await ledgerService.getFinancialProfile(testUserA);
  assert.strictEqual(retrievedProfile.monthlySalary, 100000);
  assert.strictEqual(retrievedProfile.emergencySavings, 200000);
  console.log('   ✓ Financial profile created, persisted in PostgreSQL, and retrieved.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Create User Accounts & PRD Transactions
  // ──────────────────────────────────────────────────────────────────────────
  console.log('3. Recording PRD Classified Transactions...');
  const primaryAccount = await ledgerService.createAccount(testUserA, {
    name: 'HDFC Savings Account',
    type: 'Bank Account',
    institution: 'HDFC Bank',
    openingBalance: 75000,
    isDefault: true,
  });

  // Income: ₹1,00,000 Salary (Essential Inflow)
  const txSalary = await ledgerService.createTransaction(testUserA, {
    type: 'income',
    amount: 100000,
    category: 'Salary',
    merchant: 'Tech Innovations Pvt Ltd',
    classification: 'Essential',
    isRecurring: true,
    isEssential: true,
    accountId: primaryAccount.id,
    paymentMethod: 'Bank Transfer',
    description: 'September Monthly Salary',
  });
  assert.strictEqual(txSalary.merchant, 'Tech Innovations Pvt Ltd');
  assert.strictEqual(txSalary.classification, 'Essential');
  assert.strictEqual(txSalary.isRecurring, true);

  // Essential Fixed Expense: ₹25,000 Rent
  const txRent = await ledgerService.createTransaction(testUserA, {
    type: 'expense',
    amount: 25000,
    category: 'Rent',
    merchant: 'Apartment Landlord',
    classification: 'Essential',
    isRecurring: true,
    isEssential: true,
    accountId: primaryAccount.id,
    paymentMethod: 'UPI',
    description: 'Monthly flat rent',
  });
  assert.strictEqual(txRent.amount, 25000);
  assert.strictEqual(txRent.classification, 'Essential');

  // Essential Expense: ₹5,000 Groceries
  const txGroceries = await ledgerService.createTransaction(testUserA, {
    type: 'expense',
    amount: 5000,
    category: 'Groceries',
    merchant: 'Reliance Fresh',
    classification: 'Essential',
    isRecurring: false,
    isEssential: true,
    accountId: primaryAccount.id,
    paymentMethod: 'UPI',
    description: 'Weekly grocery basket',
  });

  // Lifestyle Expense: ₹4,200 Food Delivery
  const txSwiggy = await ledgerService.createTransaction(testUserA, {
    type: 'expense',
    amount: 4200,
    category: 'Food Delivery',
    merchant: 'Swiggy',
    classification: 'Lifestyle',
    isRecurring: false,
    isEssential: false,
    accountId: primaryAccount.id,
    paymentMethod: 'UPI',
    description: 'Weekend food orders',
  });

  // Lifestyle Expense: ₹5,800 Shopping
  const txAmazon = await ledgerService.createTransaction(testUserA, {
    type: 'expense',
    amount: 5800,
    category: 'Shopping',
    merchant: 'Amazon India',
    classification: 'Lifestyle',
    isRecurring: false,
    isEssential: false,
    accountId: primaryAccount.id,
    paymentMethod: 'Credit Card',
    description: 'Books & electronics',
  });

  // Systematic Investment: ₹20,000 Mutual Funds
  const txInvestment = await ledgerService.createTransaction(testUserA, {
    type: 'investment',
    amount: 20000,
    category: 'Mutual Funds',
    merchant: 'Zerodha Coin Nifty 50 Index',
    classification: 'Financial',
    isRecurring: true,
    isEssential: false,
    accountId: primaryAccount.id,
    paymentMethod: 'UPI',
    description: 'Monthly Index Fund SIP',
  });
  assert.strictEqual(txInvestment.type, 'investment');
  console.log('   ✓ Transactions recorded across Essential, Lifestyle, and Investment types.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Monthly CFO Snapshot Calculations (PRD Section 3, 4, 13)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('4. Verifying Monthly CFO Dashboard Snapshot Calculations...');
  const dashA = await ledgerService.getDashboardData(testUserA, { datePreset: 'this_month' });

  // Total Expenses = 25,000 (Rent) + 5,000 (Groceries) + 4,200 (Food) + 5,800 (Shopping) = ₹40,000
  assert.strictEqual(dashA.metrics.income, 100000, 'Income must be ₹1,00,000');
  assert.strictEqual(dashA.metrics.expenses, 40000, 'Expenses must be ₹40,000');
  
  // Savings = Income (1,00,000) - Expenses (40,000) = ₹60,000
  assert.strictEqual(dashA.metrics.savings, 60000, 'Savings must be ₹60,000');
  
  // Savings Rate = (60,000 / 1,00,000) * 100 = 60.0%
  assert.strictEqual(dashA.metrics.savingsRate, 60.0, 'Savings rate must be 60.0%');
  
  // Investments = ₹20,000
  assert.strictEqual(dashA.metrics.investments, 20000, 'Investments must be ₹20,000');
  assert.strictEqual(dashA.metrics.investmentRate, 20.0, 'Investment rate must be 20.0%');
  
  // Available Surplus = Savings (60,000) - Investments (20,000) = ₹40,000
  assert.strictEqual(dashA.metrics.available, 40000, 'Available surplus must be ₹40,000');
  console.log('   ✓ Monthly CFO Snapshot calculations match PRD formulas exactly.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: 4-Way Spending Classification & Top Categories (PRD Section 14, 15)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('5. Verifying 4-Way Spending Classification & Top Categories...');
  const spending = dashA.spendingOverview;
  assert.strictEqual(spending.total, 40000, 'Total spending must be ₹40,000');

  // Essential: Rent (25,000) + Groceries (5,000) = 30,000 (75%)
  assert.strictEqual(spending.classifications.essential.amount, 30000);
  assert.strictEqual(spending.classifications.essential.pct, 75.0);
  assert.strictEqual(spending.classifications.essential.count, 2);

  // Lifestyle: Food Delivery (4,200) + Shopping (5,800) = 10,000 (25%)
  assert.strictEqual(spending.classifications.lifestyle.amount, 10000);
  assert.strictEqual(spending.classifications.lifestyle.pct, 25.0);
  assert.strictEqual(spending.classifications.lifestyle.count, 2);

  // Top Categories should be sorted desc by amount
  assert(spending.topCategories.length >= 4);
  assert.strictEqual(spending.topCategories[0].name, 'Rent');
  assert.strictEqual(spending.topCategories[0].amount, 25000);
  assert.strictEqual(spending.topCategories[0].pct, 62.5); // 25k/40k
  assert.strictEqual(spending.topCategories[1].name, 'Shopping');
  assert.strictEqual(spending.topCategories[1].amount, 5800);
  console.log('   ✓ 4-Way spending classification and top category ranking verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Fixed vs Variable Financial View (PRD Section 28)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('6. Verifying Fixed vs Variable Proportional Calculations...');
  const fv = dashA.fixedVsVariable;
  // Total in view = Fixed (30,000) + Variable (10,000) + Savings (60,000) + Investments (20,000) = 120,000
  assert.strictEqual(fv.fixed.amount, 25000, 'Fixed expenses includes recurring rent (₹25,000)');
  assert.strictEqual(fv.variable.amount, 15000, 'Variable spending is ₹15,000 (Groceries ₹5,000 + Lifestyle ₹10,000)');
  assert.strictEqual(fv.savings.amount, 60000, 'Savings in view is ₹60,000');
  assert.strictEqual(fv.investments.amount, 20000, 'Investments in view is ₹20,000');
  assert(fv.fixed.pct > 0 && fv.variable.pct > 0 && fv.savings.pct > 0);
  console.log('   ✓ Fixed vs Variable financial proportions verified.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Transparent Financial Health Indicators (PRD Section 2, 12, 38)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('7. Verifying Transparent Financial Health Score & 6 Breakdown Indicators...');
  const health = dashA.financialHealth;
  assert(typeof health.score === 'number', 'Overall score is a calculated number');
  assert(health.score >= 0 && health.score <= 100, 'Score is between 0 and 100');
  assert(['Excellent', 'Good', 'Fair', 'Needs Attention'].includes(health.status));

  // 6 Transparent Breakdown Indicators:
  // 1. Savings Score (Savings rate = 60%, cap score ~ 90-100)
  assert(health.breakdown.savings.score >= 80, 'High savings rate gives strong score');
  assert.strictEqual(health.breakdown.savings.value, '60%');

  // 3. Debt Burden (Monthly debt obligations ₹15,000 on ₹1,00,000 income = 15%)
  assert.strictEqual(health.breakdown.debt.value, '15%');
  assert(health.breakdown.debt.score >= 80, '15% debt burden is healthy (< 20%)');

  // 4. Emergency Coverage (₹2,00,000 savings / ₹30,000 essentials = ~6.7 months)
  assert(health.breakdown.emergency.value.includes('months'), 'Emergency coverage formatted in months');
  assert(health.breakdown.emergency.score >= 80, '6+ months emergency coverage gives strong score');

  // 5. Investing Rate (20% investment rate)
  assert.strictEqual(health.breakdown.investing.value, '20%');

  // Transparent explanation footnote
  assert(health.explanation.includes('Product-generated financial indicator'), 'Mandatory transparency disclaimer present');
  console.log(`   ✓ Financial Health score: ${health.score}/100 (${health.status}) with transparent 6-component breakdown.`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: AI CFO Insight Generation (PRD Section 6, 13, 18, 49)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('8. Verifying Data-Backed AI CFO Insight Generation...');
  const insight = dashA.cfoInsight;
  assert(insight.headline, 'Insight headline exists');
  assert(insight.message, 'Insight message exists');
  assert(insight.message.includes('60%'), 'Insight accurately cites the 60% savings rate');
  assert(insight.findings.length > 0, 'Data-backed findings present');
  console.log(`   ✓ AI CFO Insight generated: "${insight.headline}"`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9: Data Freshness Tracking (PRD Section 10, 45)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('9. Verifying Data Freshness Tracking (No fake live-sync)...');
  const freshness = dashA.dataFreshness;
  assert(freshness.lastUpdated !== null, 'Last updated timestamp is populated');
  assert(freshness.lastUpdatedFormatted !== 'Never', 'Formatted date is available');
  assert(typeof freshness.daysSinceLastUpdate === 'number', 'Days since update is numeric');
  console.log(`   ✓ Data Freshness: "${freshness.lastUpdatedFormatted}" (${freshness.daysSinceLastUpdate} days ago).`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 10: Strict User Isolation (PRD Section 12, 48)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('10. Verifying Strict User Isolation (User B cannot see User A data)...');
  const dashB = await ledgerService.getDashboardData(testUserB, { datePreset: 'this_month' });
  assert.strictEqual(dashB.metrics.income, 0, 'User B income must be 0');
  assert.strictEqual(dashB.metrics.expenses, 0, 'User B expenses must be 0');
  assert.strictEqual(dashB.metrics.savings, 0, 'User B savings must be 0');
  assert.strictEqual(dashB.metrics.investments, 0, 'User B investments must be 0');
  assert.strictEqual(dashB.recentTransactions.length, 0, 'User B must see 0 transactions');
  assert.strictEqual(dashB.financialHealth.score, null, 'User B financial health is null');

  const profileB = await ledgerService.getFinancialProfile(testUserB);
  assert.strictEqual(profileB.monthlySalary, 0, 'User B profile is isolated and unconfigured');
  console.log('   ✓ Complete user isolation confirmed: Zero cross-tenant data leakage.');

  console.log('=== ALL 10 KEPWE LEDGER PRD PHASE 5 DASHBOARD VERIFICATIONS PASSED! ===');
}

runPrdPhase5DashboardVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
