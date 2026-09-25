import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';

const query = (text, params) => pool.query(text, params);
import * as cfoIntelligenceService from '../src/services/cfo-intelligence.service.js';

test('Phase 7 — Comprehensive AI CFO Insights, Affordability & Natural Language Intelligence', async (t) => {
  // Test User IDs
  const userA = '22222222-2222-4222-8222-222222222222';
  const userB = '33333333-3333-4333-8333-333333333333';

  // Seed User A and B in database if not present
  await query(`
    INSERT INTO users (id, email, password_hash, full_name, role)
    VALUES 
      ('${userA}', 'cfo_user_a@kepwe.in', 'hash_test_cfo_a', 'CFO User A', 'customer'),
      ('${userB}', 'cfo_user_b@kepwe.in', 'hash_test_cfo_b', 'CFO User B', 'customer')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Clear existing test transactions & profile for clean deterministic state
  await query(`DELETE FROM ledger_transactions WHERE user_id IN ('${userA}', '${userB}')`);
  await query(`DELETE FROM ledger_financial_profiles WHERE user_id IN ('${userA}', '${userB}')`);

  // Setup Profile for User A: Monthly Income = ₹1,20,000, Debt = ₹15,000, Target Savings = ₹30,000, Emergency = ₹2,50,000
  await query(`
    INSERT INTO ledger_financial_profiles (
      user_id, monthly_income, salary_income, emergency_savings, monthly_debt_obligations, monthly_savings_target
    ) VALUES (
      '${userA}', 120000.00, 120000.00, 250000.00, 15000.00, 30000.00
    )
  `);

  // Seed Transactions for User A in current period (last 30 days):
  // Salary: ₹1,20,000
  // Essential: Rent ₹25,000, Groceries ₹8,000, BESCOM Electricity ₹2,500 = ₹35,500
  // Lifestyle: Swiggy ₹450, Swiggy ₹520, Swiggy ₹380, Swiggy ₹490, Zomato ₹510, Shopping ₹6,000 = ₹8,350
  // Subscriptions: Netflix ₹649, Spotify ₹119 = ₹768
  // Financial: EMI ₹15,000, SIP ₹10,000 = ₹25,000
  await query(`
    INSERT INTO ledger_transactions (
      user_id, amount, type, category, merchant, classification, is_recurring, status, transaction_date
    ) VALUES
      ('${userA}', 120000.00, 'income', 'Salary', 'KEPWE Tech Pvt Ltd', 'Income', TRUE, 'posted', CURRENT_DATE - 5),
      ('${userA}', 25000.00, 'expense', 'Rent', 'Landlord House', 'Essential', TRUE, 'posted', CURRENT_DATE - 3),
      ('${userA}', 8000.00, 'expense', 'Groceries', 'Blinkit', 'Essential', FALSE, 'posted', CURRENT_DATE - 4),
      ('${userA}', 2500.00, 'expense', 'Electricity', 'BESCOM', 'Essential', TRUE, 'posted', CURRENT_DATE - 6),
      ('${userA}', 450.00, 'expense', 'Food Delivery', 'Swiggy', 'Lifestyle', FALSE, 'posted', CURRENT_DATE - 2),
      ('${userA}', 520.00, 'expense', 'Food Delivery', 'Swiggy', 'Lifestyle', FALSE, 'posted', CURRENT_DATE - 7),
      ('${userA}', 380.00, 'expense', 'Food Delivery', 'Swiggy', 'Lifestyle', FALSE, 'posted', CURRENT_DATE - 11),
      ('${userA}', 490.00, 'expense', 'Food Delivery', 'Swiggy', 'Lifestyle', FALSE, 'posted', CURRENT_DATE - 15),
      ('${userA}', 510.00, 'expense', 'Food Delivery', 'Zomato', 'Lifestyle', FALSE, 'posted', CURRENT_DATE - 18),
      ('${userA}', 6000.00, 'expense', 'Shopping', 'Zara Apparel', 'Lifestyle', FALSE, 'posted', CURRENT_DATE - 12),
      ('${userA}', 649.00, 'expense', 'Entertainment', 'Netflix', 'Lifestyle', TRUE, 'posted', CURRENT_DATE - 8),
      ('${userA}', 119.00, 'expense', 'Entertainment', 'Spotify', 'Lifestyle', TRUE, 'posted', CURRENT_DATE - 9),
      ('${userA}', 15000.00, 'expense', 'EMI', 'HDFC Bank Loan', 'Financial', TRUE, 'posted', CURRENT_DATE - 5),
      ('${userA}', 10000.00, 'expense', 'Investment', 'Zerodha SIP', 'Financial', TRUE, 'posted', CURRENT_DATE - 10)
  `);

  await t.test('1. Comprehensive AI CFO Insights Generation & Financial Health Scoring', async () => {
    const insights = await cfoIntelligenceService.getComprehensiveCfoInsights(userA);

    assert.ok(insights.healthScore, 'Health score object should exist');
    assert.ok(insights.healthScore.score >= 50 && insights.healthScore.score <= 100, `Health score should be positive: ${insights.healthScore.score}`);
    assert.equal(insights.healthScore.status, 'Healthy');

    // Metrics verification
    assert.equal(insights.metrics.monthlyIncome, 120000);
    assert.ok(insights.metrics.recordedExpenses > 0, 'Recorded expenses should be calculated');
    assert.ok(insights.metrics.recordedSavings > 0, 'Recorded savings should be calculated');
    assert.ok(insights.metrics.savingsRate > 0, 'Savings rate should be calculated');
    assert.equal(insights.metrics.essentialExpenses, 35500);

    // PRD Potential Investable Surplus Formula:
    // Income (1,20,000) - Essential (35,500) - Debt (15,000) - Savings Target (30,000) = 39,500
    assert.equal(insights.metrics.potentialSurplus, 39500);

    // Data Confidence
    assert.equal(insights.dataConfidence.level, 'Medium');
    assert.ok(insights.dataConfidence.transactionCount >= 10);
  });

  await t.test('2. Expense Reduction Engine: Subscriptions & Micro-Spending Leaks', async () => {
    const insights = await cfoIntelligenceService.getComprehensiveCfoInsights(userA);

    assert.ok(Array.isArray(insights.reductionOpportunities), 'reductionOpportunities should be an array');
    
    // Check Subscriptions detection (Netflix + Spotify)
    const subOp = insights.reductionOpportunities.find(o => o.type === 'recurring_subscriptions');
    assert.ok(subOp, 'Recurring subscription reduction opportunity should be detected');
    assert.ok(subOp.summary.includes('2 recurring subscriptions'));

    // Check Micro-Spending Leak detection (Swiggy sub-600 repeated 4 times)
    const leakOp = insights.reductionOpportunities.find(o => o.type === 'micro_spending_leak');
    assert.ok(leakOp, 'Micro-spending leak should be detected for repeated Swiggy spends');
    assert.ok(leakOp.summary.includes('Swiggy'));
  });

  await t.test('3. PRD Surplus Engine & Wealth Allocation Roadmap', async () => {
    const insights = await cfoIntelligenceService.getComprehensiveCfoInsights(userA);

    assert.ok(insights.surplusAllocation, 'surplusAllocation should exist');
    assert.equal(insights.surplusAllocation.potentialInvestableSurplus, 39500);
    assert.ok(insights.surplusAllocation.recommendations.length >= 2, 'Should offer multi-bucket allocation recommendations');

    const totalAllocated = insights.surplusAllocation.recommendations.reduce((sum, r) => sum + r.amount, 0);
    assert.equal(totalAllocated, 39500, 'Sum of allocations should exactly match total potential surplus');
  });

  await t.test('4. Scenario Analysis: "Can I Afford This?" (One-time Cash Outlay)', async () => {
    // Evaluation of ₹15,000 purchase (Comfortably Affordable within ₹39,500 monthly surplus)
    const resAffordable = await cfoIntelligenceService.evaluateAffordability(userA, {
      purchaseAmount: 15000,
      category: 'Electronics',
      description: 'Noise Cancelling Headphones'
    });

    assert.equal(resAffordable.verdict.status, 'Comfortably Affordable (Cash)');
    assert.equal(resAffordable.verdict.statusClass, 'affordable');
    assert.ok(resAffordable.financialContext.surplusAfterPayment > 0);
    assert.ok(resAffordable.opportunityCost.fiveYearProjection > 15000);

    // Evaluation of ₹1,50,000 purchase (Stretches financial safety, exceeds monthly surplus and dips into emergency reserve)
    const resExpensive = await cfoIntelligenceService.evaluateAffordability(userA, {
      purchaseAmount: 150000,
      category: 'Luxury',
      description: 'International Vacation'
    });

    assert.ok(resExpensive.verdict.status.includes('Affordable with Planning') || resExpensive.verdict.status.includes('Stretches'));
  });

  await t.test('5. Scenario Analysis: "Can I Afford This?" (EMI Option)', async () => {
    const resEmi = await cfoIntelligenceService.evaluateAffordability(userA, {
      purchaseAmount: 60000,
      category: 'Appliances',
      description: 'Refrigerator',
      isEmi: true,
      tenureMonths: 6,
      annualInterestRate: 14
    });

    assert.equal(resEmi.scenario.isEmi, true);
    assert.equal(resEmi.scenario.tenureMonths, 6);
    assert.ok(resEmi.scenario.monthlyPayment > 10000 && resEmi.scenario.monthlyPayment < 11000);
    assert.ok(resEmi.verdict.status.includes('EMI'));
  });

  await t.test('6. Conversational AI CFO Natural Language Query Answering', async () => {
    // 1. Where did my money go?
    const q1 = await cfoIntelligenceService.processNaturalLanguageCfoQuery(userA, 'Where did my money go this month?');
    assert.equal(q1.intent, 'spending_breakdown');
    assert.ok(q1.answer.includes('recorded outflows'));
    assert.ok(q1.data.topCategories.length > 0);

    // 2. Specific category question
    const q2 = await cfoIntelligenceService.processNaturalLanguageCfoQuery(userA, 'How much did I spend on Food Delivery?');
    assert.equal(q2.intent, 'category_inquiry');
    assert.ok(q2.answer.includes('Food Delivery'));

    // 3. Savings potential question
    const q3 = await cfoIntelligenceService.processNaturalLanguageCfoQuery(userA, 'How much can I save every month?');
    assert.equal(q3.intent, 'savings_potential');
    assert.ok(q3.answer.includes('savings rate'));

    // 4. Expense reduction question
    const q4 = await cfoIntelligenceService.processNaturalLanguageCfoQuery(userA, 'What can I reduce to save money?');
    assert.equal(q4.intent, 'expense_reduction');
    assert.ok(q4.answer.includes('Recommendation') || q4.answer.includes('leak'));

    // 5. Recurring subscriptions question
    const q5 = await cfoIntelligenceService.processNaturalLanguageCfoQuery(userA, 'Show my recurring subscriptions and commitments');
    assert.equal(q5.intent, 'recurring_overview');
    assert.ok(q5.answer.includes('Netflix') || q5.answer.includes('commitments'));
  });

  await t.test('7. User Isolation & Security (User B with Empty Data)', async () => {
    // User B has no records
    const insightsB = await cfoIntelligenceService.getComprehensiveCfoInsights(userB);

    assert.equal(insightsB.metrics.monthlyIncome, 0);
    assert.equal(insightsB.metrics.recordedExpenses, 0);
    assert.equal(insightsB.metrics.potentialSurplus, 0);
    assert.equal(insightsB.topCategories.length, 0);
    assert.equal(insightsB.reductionOpportunities.length, 0);
    assert.equal(insightsB.dataConfidence.level, 'Needs Review');
  });

  await t.test('8. Error Handling & Input Validation', async () => {
    // Zero purchase amount
    await assert.rejects(
      async () => {
        await cfoIntelligenceService.evaluateAffordability(userA, { purchaseAmount: 0 });
      },
      /valid purchase amount/
    );

    // Negative purchase amount
    await assert.rejects(
      async () => {
        await cfoIntelligenceService.evaluateAffordability(userA, { purchaseAmount: -500 });
      },
      /valid purchase amount/
    );

    // Empty natural language question
    await assert.rejects(
      async () => {
        await cfoIntelligenceService.processNaturalLanguageCfoQuery(userA, '   ');
      },
      /enter a question/
    );
  });
});
