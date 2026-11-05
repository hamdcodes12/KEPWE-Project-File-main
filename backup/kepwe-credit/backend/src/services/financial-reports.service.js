import { pool } from '../config/db.js';
import PDFDocument from 'pdfkit';
import xlsx from 'xlsx';

function roundMoney(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function formatDateIso(d) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatInr(val) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val || 0);
}

/**
 * Calculates start, end, and matching prior period bounds.
 */
export function calculatePeriodBounds(period = 'monthly', dateFrom = '', dateTo = '', datePreset = '') {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  // If datePreset is provided from legacy/compat controls
  if (datePreset === 'today') {
    period = 'daily';
  } else if (datePreset === 'this_week') {
    period = 'weekly';
  } else if (datePreset === 'this_month') {
    period = 'monthly';
  } else if (datePreset === 'last_month') {
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const days = Math.round((lastDayLastMonth - firstDayLastMonth) / (1000 * 60 * 60 * 24)) + 1;
    const priorFirst = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const priorLast = new Date(now.getFullYear(), now.getMonth() - 1, 0);

    return {
      period: 'monthly',
      startStr: formatDateIso(firstDayLastMonth),
      endStr: formatDateIso(lastDayLastMonth),
      priorStartStr: formatDateIso(priorFirst),
      priorEndStr: formatDateIso(priorLast),
      periodLabel: `Last Month (${firstDayLastMonth.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})`,
      daysCount: days,
    };
  } else if (datePreset === 'this_quarter') {
    period = 'quarterly';
  } else if (datePreset === 'this_year') {
    period = 'annual';
  } else if (datePreset === 'custom' && dateFrom && dateTo) {
    period = 'custom';
  }

  if (period === 'daily') {
    if (dateFrom) {
      start = new Date(dateFrom);
      end = new Date(dateFrom);
    }
    const prior = new Date(start);
    prior.setDate(prior.getDate() - 1);

    return {
      period: 'daily',
      startStr: formatDateIso(start),
      endStr: formatDateIso(end),
      priorStartStr: formatDateIso(prior),
      priorEndStr: formatDateIso(prior),
      periodLabel: `Daily (${formatDateIso(start)})`,
      daysCount: 1,
    };
  }

  if (period === 'weekly') {
    // Current 7-day rolling window
    start.setDate(now.getDate() - 6);
    const priorEnd = new Date(start);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorStart.getDate() - 6);

    return {
      period: 'weekly',
      startStr: formatDateIso(start),
      endStr: formatDateIso(end),
      priorStartStr: formatDateIso(priorStart),
      priorEndStr: formatDateIso(priorEnd),
      periodLabel: `Weekly (${formatDateIso(start)} to ${formatDateIso(end)})`,
      daysCount: 7,
    };
  }

  if (period === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const priorEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

    return {
      period: 'monthly',
      startStr: formatDateIso(start),
      endStr: formatDateIso(end),
      priorStartStr: formatDateIso(priorStart),
      priorEndStr: formatDateIso(priorEnd),
      periodLabel: `Monthly (${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })})`,
      daysCount: days,
    };
  }

  if (period === 'quarterly') {
    const currentQ = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), currentQ * 3, 1);
    end = new Date(now.getFullYear(), (currentQ + 1) * 3, 0);
    const priorStart = new Date(now.getFullYear(), (currentQ - 1) * 3, 1);
    const priorEnd = new Date(now.getFullYear(), currentQ * 3, 0);
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

    return {
      period: 'quarterly',
      startStr: formatDateIso(start),
      endStr: formatDateIso(end),
      priorStartStr: formatDateIso(priorStart),
      priorEndStr: formatDateIso(priorEnd),
      periodLabel: `Quarterly (Q${currentQ + 1} ${now.getFullYear()})`,
      daysCount: days,
    };
  }

  if (period === 'annual') {
    // Indian FY: Apr 1 to Mar 31
    const currentYear = now.getFullYear();
    const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
    start = new Date(fyStartYear, 3, 1); // Apr 1
    end = new Date(fyStartYear + 1, 2, 31); // Mar 31 next year
    const priorStart = new Date(fyStartYear - 1, 3, 1);
    const priorEnd = new Date(fyStartYear, 2, 31);

    return {
      period: 'annual',
      startStr: formatDateIso(start),
      endStr: formatDateIso(end),
      priorStartStr: formatDateIso(priorStart),
      priorEndStr: formatDateIso(priorEnd),
      periodLabel: `Financial Year FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
      daysCount: 365,
    };
  }

  if (period === 'custom' && dateFrom && dateTo) {
    start = new Date(dateFrom);
    end = new Date(dateTo);
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const priorEnd = new Date(start.getTime() - (24 * 60 * 60 * 1000));
    const priorStart = new Date(priorEnd.getTime() - diffMs);

    return {
      period: 'custom',
      startStr: formatDateIso(start),
      endStr: formatDateIso(end),
      priorStartStr: formatDateIso(priorStart),
      priorEndStr: formatDateIso(priorEnd),
      periodLabel: `Custom (${formatDateIso(start)} to ${formatDateIso(end)})`,
      daysCount: days,
    };
  }

  // Default fallback to monthly
  start = new Date(now.getFullYear(), now.getMonth(), 1);
  end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const priorEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    period: 'monthly',
    startStr: formatDateIso(start),
    endStr: formatDateIso(end),
    priorStartStr: formatDateIso(priorStart),
    priorEndStr: formatDateIso(priorEnd),
    periodLabel: `Monthly (${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })})`,
    daysCount: 30,
  };
}

/**
 * Fetches and generates the comprehensive Financial Report for the user.
 */
export async function getComprehensiveReport(userId, options = {}) {
  const {
    period = 'monthly',
    reportType = 'monthly_ai',
    datePreset = '',
    dateFrom = '',
    dateTo = '',
    category = '',
    accountId = '',
    type = 'all',
  } = options;

  const bounds = calculatePeriodBounds(period, dateFrom, dateTo, datePreset);
  const { startStr, endStr, priorStartStr, priorEndStr, periodLabel, daysCount } = bounds;

  // 1. Fetch User Info
  const userRes = await pool.query(
    `SELECT id, full_name AS name, email FROM users WHERE id = $1`,
    [userId]
  );
  const user = userRes.rows[0] || { id: userId, name: 'Valued Client', email: '' };

  // 2. Build Query Filters for current period
  const whereClauses = [
    `t.user_id = $1`,
    `t.transaction_date >= $2`,
    `t.transaction_date <= $3`,
  ];
  const queryParams = [userId, startStr, endStr];
  let pIdx = 4;

  if (category && category !== 'all') {
    whereClauses.push(`t.category = $${pIdx++}`);
    queryParams.push(category);
  }
  if (accountId && accountId !== 'all') {
    whereClauses.push(`t.account_id = $${pIdx++}`);
    queryParams.push(accountId);
  }
  if (type && type !== 'all') {
    whereClauses.push(`t.type = $${pIdx++}`);
    queryParams.push(type);
  }

  const txQuery = `
    SELECT t.*, a.name AS account_name, a.type AS account_type
    FROM ledger_transactions t
    LEFT JOIN ledger_accounts a ON t.account_id = a.id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY t.transaction_date DESC, t.created_at DESC
  `;
  const currentTxRes = await pool.query(txQuery, queryParams);
  const transactions = currentTxRes.rows.map((r) => ({
    id: r.id,
    date: formatDateIso(r.transaction_date),
    description: r.description || r.merchant || 'Transaction',
    merchant: r.merchant || '',
    amount: roundMoney(r.amount),
    type: r.type,
    category: r.category || 'General',
    subcategory: r.subcategory || '',
    classification: r.classification || 'Essential',
    isRecurring: Boolean(r.is_recurring),
    isEssential: Boolean(r.is_essential),
    paymentMethod: r.payment_method || 'UPI',
    referenceNumber: r.reference_number || '',
    accountName: r.account_name || 'Primary Bank Account',
    confidence: Number(r.confidence) || 100,
  }));

  // 3. Query matching prior period for Spending Changes (MoM/WoW)
  const priorWhereClauses = [
    `t.user_id = $1`,
    `t.transaction_date >= $2`,
    `t.transaction_date <= $3`,
  ];
  const priorQueryParams = [userId, priorStartStr, priorEndStr];
  let prIdx = 4;
  if (category && category !== 'all') {
    priorWhereClauses.push(`t.category = $${prIdx++}`);
    priorQueryParams.push(category);
  }
  if (accountId && accountId !== 'all') {
    priorWhereClauses.push(`t.account_id = $${prIdx++}`);
    priorQueryParams.push(accountId);
  }
  if (type && type !== 'all') {
    priorWhereClauses.push(`t.type = $${prIdx++}`);
    priorQueryParams.push(type);
  }

  const priorTxRes = await pool.query(
    `SELECT t.* FROM ledger_transactions t WHERE ${priorWhereClauses.join(' AND ')}`,
    priorQueryParams
  );
  const priorTransactions = priorTxRes.rows;

  // 4. Fetch User Financial Profile
  const profileRes = await pool.query(
    `SELECT * FROM ledger_financial_profiles WHERE user_id = $1`,
    [userId]
  );
  const profile = profileRes.rows[0] || {};
  const profileSalary = Number(profile.salary_income || profile.monthly_income || 0);
  const profileDebtObligations = Number(profile.monthly_debt_obligations || 0);
  const monthlySavingsTarget = Number(profile.monthly_savings_target || 0);

  // 5. Fetch User Accounts
  const accountsRes = await pool.query(
    `SELECT id, name, type, current_balance, opening_balance, account_number, upi_id 
     FROM ledger_accounts WHERE user_id = $1 ORDER BY name ASC`,
    [userId]
  );
  const accounts = accountsRes.rows.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currentBalance: roundMoney(a.current_balance),
    openingBalance: roundMoney(a.opening_balance),
    accountNumber: a.account_number,
    upiId: a.upi_id,
  }));

  // 6. Fetch User Goals
  let goals = [];
  try {
    const goalsRes = await pool.query(
      `SELECT * FROM ledger_goals WHERE user_id = $1 ORDER BY priority ASC, created_at ASC`,
      [userId]
    );
    goals = goalsRes.rows.map((g) => {
      const target = Number(g.target_amount) || 0;
      const current = Number(g.current_amount) || 0;
      const progressPct = target > 0 ? Math.min(100, roundMoney((current / target) * 100)) : 0;
      const shortfall = roundMoney(Math.max(0, target - current));
      return {
        id: g.id,
        name: g.name,
        type: g.type,
        targetAmount: target,
        currentAmount: current,
        targetDate: g.target_date ? formatDateIso(g.target_date) : null,
        monthlyContribution: Number(g.monthly_contribution) || 0,
        progressPct,
        shortfall,
        status: g.status,
      };
    });
  } catch (err) {
    goals = [];
  }

  // 7. Aggregate Current Period
  const incomeTxs = transactions.filter((t) => t.type === 'income');
  const expenseTxs = transactions.filter((t) => t.type === 'expense');
  const investmentTxs = transactions.filter((t) => t.type === 'investment' || t.category === 'Investment');

  const totalIncomeTx = roundMoney(incomeTxs.reduce((sum, t) => sum + t.amount, 0));
  // Total income combines recorded transaction income or prorated profile salary if no transaction income exists
  const totalIncome = totalIncomeTx > 0 ? totalIncomeTx : roundMoney((profileSalary / 30) * Math.min(30, daysCount));

  const totalExpenses = roundMoney(expenseTxs.reduce((sum, t) => sum + t.amount, 0));

  // Essential vs Lifestyle
  const essentialExpenses = roundMoney(
    expenseTxs
      .filter((t) => t.isEssential || t.classification === 'Essential')
      .reduce((sum, t) => sum + t.amount, 0)
  );
  const lifestyleExpenses = roundMoney(
    expenseTxs
      .filter((t) => !t.isEssential && (t.classification === 'Lifestyle' || !t.classification))
      .reduce((sum, t) => sum + t.amount, 0)
  );

  // Total Savings = Max(0, Income - Expenses) + any designated savings transactions
  const netSavings = roundMoney(totalIncome - totalExpenses);
  const totalSavings = Math.max(0, netSavings);
  const savingsRate = totalIncome > 0 ? roundMoney((totalSavings / totalIncome) * 100) : 0;

  // Total Investments
  const totalInvestments = roundMoney(
    investmentTxs.reduce((sum, t) => sum + t.amount, 0)
  );

  // Total Debt Obligations
  const debtTxs = expenseTxs.filter((t) =>
    ['EMI', 'Loan Repayment', 'Debt', 'Credit Card'].includes(t.category) ||
    t.classification === 'Financial'
  );
  const txDebtAmount = roundMoney(debtTxs.reduce((sum, t) => sum + t.amount, 0));
  const totalDebt = txDebtAmount > 0 ? txDebtAmount : roundMoney((profileDebtObligations / 30) * Math.min(30, daysCount));

  // Investable Surplus (PRD Formula): Income - Essential - Debt - Savings Requirement
  const proratedSavingsTarget = roundMoney((monthlySavingsTarget / 30) * Math.min(30, daysCount));
  const potentialSurplus = roundMoney(
    Math.max(0, totalIncome - essentialExpenses - totalDebt - proratedSavingsTarget)
  );

  // Category Breakdowns
  const incomeByCategory = {};
  incomeTxs.forEach((t) => {
    incomeByCategory[t.category] = roundMoney((incomeByCategory[t.category] || 0) + t.amount);
  });
  if (Object.keys(incomeByCategory).length === 0 && totalIncome > 0) {
    incomeByCategory['Salary / Professional Income'] = totalIncome;
  }

  const expenseByCategory = {};
  expenseTxs.forEach((t) => {
    expenseByCategory[t.category] = roundMoney((expenseByCategory[t.category] || 0) + t.amount);
  });

  const incomeBreakdown = Object.entries(incomeByCategory)
    .map(([cat, amt]) => ({ category: cat, amount: amt, pct: totalIncome > 0 ? roundMoney((amt / totalIncome) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const expenseBreakdown = Object.entries(expenseByCategory)
    .map(([cat, amt]) => ({ category: cat, amount: amt, pct: totalExpenses > 0 ? roundMoney((amt / totalExpenses) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // 8. Recurring Expenses
  const recurringTxs = expenseTxs.filter((t) => t.isRecurring);
  const recurringTotal = roundMoney(recurringTxs.reduce((sum, t) => sum + t.amount, 0));

  // 9. Prior Period Aggregations & Spending Changes
  const priorExpenseTxs = priorTransactions.filter((t) => t.type === 'expense');
  const priorTotalExpenses = roundMoney(priorExpenseTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0));
  const priorIncomeTxs = priorTransactions.filter((t) => t.type === 'income');
  const priorTotalIncome = roundMoney(priorIncomeTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0));

  const spendingDiff = roundMoney(totalExpenses - priorTotalExpenses);
  const spendingDiffPct = priorTotalExpenses > 0 ? roundMoney((spendingDiff / priorTotalExpenses) * 100) : 0;

  // Category Level Changes
  const priorExpenseByCat = {};
  priorExpenseTxs.forEach((t) => {
    priorExpenseByCat[t.category] = roundMoney((priorExpenseByCat[t.category] || 0) + Number(t.amount || 0));
  });

  const categoryChanges = expenseBreakdown.map((curr) => {
    const priorAmt = priorExpenseByCat[curr.category] || 0;
    const diff = roundMoney(curr.amount - priorAmt);
    const diffPct = priorAmt > 0 ? roundMoney((diff / priorAmt) * 100) : 0;
    return {
      category: curr.category,
      currentAmount: curr.amount,
      priorAmount: priorAmt,
      diff,
      diffPct,
      trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    };
  });

  // 10. Financial Leaks / Money Leaks (small repeated discretionary purchases < 1000)
  const leakTxs = expenseTxs.filter((t) =>
    t.amount <= 1000 &&
    (t.classification === 'Lifestyle' || ['Food Delivery', 'Shopping', 'Dining', 'Entertainment', 'Coffee', 'Snacks'].includes(t.category))
  );
  const leakTotal = roundMoney(leakTxs.reduce((sum, t) => sum + t.amount, 0));
  const leakCount = leakTxs.length;

  // 11. Biggest Expense
  const sortedExpenses = [...expenseTxs].sort((a, b) => b.amount - a.amount);
  const biggestExpense = sortedExpenses.length > 0 ? sortedExpenses[0] : null;

  // 12. Positive Behaviour Detection
  let positiveBehaviour = 'Maintained consistent tracking with clean categorization across all payment sources.';
  const reducedCategory = categoryChanges.find((c) => c.diff < 0);
  if (reducedCategory) {
    positiveBehaviour = `Successfully reduced ${reducedCategory.category} expenditure by ${formatInr(Math.abs(reducedCategory.diff))} (${Math.abs(reducedCategory.diffPct)}%) compared to the previous period.`;
  } else if (savingsRate >= 30) {
    positiveBehaviour = `Outstanding financial discipline: maintained a robust ${savingsRate}% savings rate during this period.`;
  } else if (leakCount === 0 && expenseTxs.length > 0) {
    positiveBehaviour = `Zero small discretionary money leaks detected this period. Highly disciplined spending control.`;
  }

  // 13. Next Period Focus
  let nextPeriodFocus = 'Continue monitoring recurring commitments and allocate potential surplus to financial goals.';
  if (leakTotal > 3000) {
    nextPeriodFocus = `Focus on controlling frequent micro-expenses (${leakCount} transactions totaling ${formatInr(leakTotal)}) in food delivery and discretionary shopping.`;
  } else if (savingsRate < 20 && totalIncome > 0) {
    nextPeriodFocus = `Target increasing monthly savings rate from ${savingsRate}% toward the recommended 25% by trimming non-essential lifestyle outlays.`;
  } else if (goals.some((g) => g.shortfall > 0)) {
    const priorityGoal = goals.find((g) => g.shortfall > 0);
    nextPeriodFocus = `Direct investable surplus toward ${priorityGoal.name} to close remaining shortfall of ${formatInr(priorityGoal.shortfall)}.`;
  }

  // 14. Monthly AI Report Structure (Section 60 of PRD)
  const monthlyAiReport = {
    section1_income: {
      title: '1. Income',
      total: totalIncome,
      sources: incomeBreakdown,
      narrative: `Total recorded income for ${periodLabel} stands at ${formatInr(totalIncome)}${incomeBreakdown.length > 0 ? ` across ${incomeBreakdown.length} income stream(s)` : ''}.`,
    },
    section2_expenses: {
      title: '2. Expenses',
      total: totalExpenses,
      essential: essentialExpenses,
      discretionary: lifestyleExpenses,
      categories: expenseBreakdown,
      narrative: `Total expenditure reached ${formatInr(totalExpenses)}, with essential living costs comprising ${formatInr(essentialExpenses)} and discretionary lifestyle spending at ${formatInr(lifestyleExpenses)}.`,
    },
    section3_savings: {
      title: '3. Savings',
      total: totalSavings,
      savingsRate,
      target: proratedSavingsTarget,
      narrative: `Recorded savings reached ${formatInr(totalSavings)}, reflecting a ${savingsRate}% savings rate${proratedSavingsTarget > 0 ? ` against a planned target of ${formatInr(proratedSavingsTarget)}` : ''}.`,
    },
    section4_investments: {
      title: '4. Investments',
      total: totalInvestments,
      count: investmentTxs.length,
      items: investmentTxs.slice(0, 10),
      narrative: totalInvestments > 0
        ? `Dedicated capital of ${formatInr(totalInvestments)} directed toward wealth creation and investment assets.`
        : `No explicit investment allocations recorded for this reporting window. Review surplus deployment.`,
    },
    section5_debt: {
      title: '5. Debt & Obligations',
      total: totalDebt,
      narrative: totalDebt > 0
        ? `Debt obligations and fixed credit commitments total ${formatInr(totalDebt)}.`
        : `No outstanding debt obligations or loan repayments detected.`,
    },
    section6_recurring: {
      title: '6. Recurring Expenses',
      count: recurringTxs.length,
      total: recurringTotal,
      items: recurringTxs.slice(0, 10),
      narrative: recurringTxs.length > 0
        ? `Identified ${recurringTxs.length} active recurring commitments totaling ${formatInr(recurringTotal)}.`
        : `Zero recurring subscription or utility commitments flagged.`,
    },
    section7_spending_changes: {
      title: '7. Spending Changes',
      priorTotalExpenses,
      spendingDiff,
      spendingDiffPct,
      categoryChanges,
      narrative: priorTotalExpenses > 0
        ? `Overall outlays ${spendingDiff >= 0 ? 'increased' : 'decreased'} by ${formatInr(Math.abs(spendingDiff))} (${Math.abs(spendingDiffPct)}%) compared to the prior period.`
        : `Baseline established. Subsequent reports will detail comparative period-over-period variance.`,
    },
    section8_financial_leaks: {
      title: '8. Financial Leaks',
      count: leakCount,
      total: leakTotal,
      items: leakTxs.slice(0, 10),
      narrative: leakCount > 0
        ? `Detected ${leakCount} micro-transactions totaling ${formatInr(leakTotal)} that represent avoidable discretionary money leaks.`
        : `Clean spending profile: no repetitive micro-spending leaks detected.`,
    },
    section9_goals: {
      title: '9. Goal Progress',
      activeGoalsCount: goals.length,
      goals,
      narrative: goals.length > 0
        ? `Tracking ${goals.length} active personal financial goal(s). Aggregate progress monitored against target horizons.`
        : `No financial goals configured. Creating savings goals aligns monthly surplus with structured outcomes.`,
    },
    section10_focus: {
      title: '10. Next Period Focus',
      focus: nextPeriodFocus,
      investableSurplus: potentialSurplus,
      narrative: `Strategic Focus: ${nextPeriodFocus} Estimated investable surplus available for allocation: ${formatInr(potentialSurplus)}.`,
    },
  };

  // 15. Weekly CFO Report Structure (Section 59 of PRD)
  const weeklyCfoReport = {
    periodLabel,
    income: totalIncome,
    expenses: totalExpenses,
    savings: totalSavings,
    investment: totalInvestments,
    biggestExpense: biggestExpense
      ? {
          merchant: biggestExpense.merchant || biggestExpense.description,
          category: biggestExpense.category,
          amount: biggestExpense.amount,
          date: biggestExpense.date,
        }
      : null,
    moneyLeak: {
      count: leakCount,
      total: leakTotal,
      topCategory: leakTxs.length > 0 ? leakTxs[0].category : 'None',
    },
    positiveBehaviour,
  };

  return {
    reportType,
    period,
    periodLabel,
    dateRange: {
      start: startStr,
      end: endStr,
      priorStart: priorStartStr,
      priorEnd: priorEndStr,
      daysCount,
      preset: datePreset || period,
    },
    user: {
      name: user.name,
      email: user.email,
    },
    summary: {
      totalIncome,
      totalExpenses,
      essentialExpenses,
      lifestyleExpenses,
      totalSavings,
      savingsRate,
      totalInvestments,
      totalDebt,
      investableSurplus: potentialSurplus,
      netProfit: roundMoney(totalIncome - totalExpenses),
      operatingMargin: totalIncome > 0 ? roundMoney(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
      spendingDiff,
      spendingDiffPct,
      hasFinancialData: transactions.length > 0 || totalIncome > 0,
    },
    monthlyAiReport,
    weeklyCfoReport,
    breakdown: {
      income: incomeBreakdown,
      expenses: expenseBreakdown,
      categoryChanges,
    },
    leaks: {
      count: leakCount,
      total: leakTotal,
      transactions: leakTxs,
    },
    recurring: {
      count: recurringTxs.length,
      total: recurringTotal,
      transactions: recurringTxs,
    },
    goals,
    accounts,
    recentTransactions: transactions.slice(0, 100),
    allTransactions: transactions,
  };
}

/**
 * Generates genuine PDF report buffer using PDFKit.
 */
export async function exportReportToPdf(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Kepwe Ledger Financial Report - ${reportData.periodLabel}`,
          Author: 'Kepwe Financial Intelligence',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header Banner
      doc.rect(0, 0, 595.28, 70).fill('#0F172A'); // Deep Navy
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('KEPWE LEDGER', 40, 20);
      doc.fontSize(10).font('Helvetica').fillColor('#94A3B8').text('PERSONAL CFO FINANCIAL REPORT', 40, 45);

      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(`Client: ${reportData.user?.name || 'Valued Client'}`, 360, 22, { align: 'right' });
      doc.fillColor('#94A3B8').fontSize(9).font('Helvetica').text(`Period: ${reportData.periodLabel}`, 360, 38, { align: 'right' });
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 360, 52, { align: 'right' });

      doc.y = 85;

      // Executive Summary Metrics Card
      doc.rect(40, doc.y, 515, 75).fillAndStroke('#F8FAFC', '#E2E8F0');
      const cardY = doc.y + 12;

      const metrics = [
        { label: 'TOTAL INCOME', val: formatInr(reportData.summary.totalIncome), color: '#16A34A' },
        { label: 'TOTAL EXPENSES', val: formatInr(reportData.summary.totalExpenses), color: '#DC2626' },
        { label: 'NET SAVINGS', val: formatInr(reportData.summary.totalSavings), color: '#2563EB' },
        { label: 'SAVINGS RATE', val: `${reportData.summary.savingsRate}%`, color: '#0F172A' },
      ];

      metrics.forEach((m, idx) => {
        const colX = 55 + (idx * 125);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748B').text(m.label, colX, cardY);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(m.color).text(m.val, colX, cardY + 16);
      });

      doc.y = cardY + 80;

      // AI CFO Narrative & Intelligence
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text('AI Personal CFO Analysis');
      doc.rect(40, doc.y + 4, 515, 1).fill('#E2E8F0');
      doc.y += 12;

      doc.fontSize(9).font('Helvetica').fillColor('#334155');
      if (reportData.reportType === 'weekly_cfo') {
        doc.text(`• Weekly Pulse: Income of ${formatInr(reportData.summary.totalIncome)} vs Expenses of ${formatInr(reportData.summary.totalExpenses)}.`);
        if (reportData.weeklyCfoReport.biggestExpense) {
          doc.text(`• Largest Expense: ${reportData.weeklyCfoReport.biggestExpense.merchant} (${formatInr(reportData.weeklyCfoReport.biggestExpense.amount)}) in ${reportData.weeklyCfoReport.biggestExpense.category}.`);
        }
        doc.text(`• Money Leaks: ${reportData.weeklyCfoReport.moneyLeak.count} micro-transactions totaling ${formatInr(reportData.weeklyCfoReport.moneyLeak.total)}.`);
        doc.text(`• Positive Behavior: ${reportData.weeklyCfoReport.positiveBehaviour}`);
      } else {
        doc.text(`• ${reportData.monthlyAiReport.section1_income.narrative}`);
        doc.text(`• ${reportData.monthlyAiReport.section2_expenses.narrative}`);
        doc.text(`• ${reportData.monthlyAiReport.section3_savings.narrative}`);
        doc.text(`• ${reportData.monthlyAiReport.section7_spending_changes.narrative}`);
        doc.text(`• ${reportData.monthlyAiReport.section8_financial_leaks.narrative}`);
        doc.text(`• Strategic Recommendation: ${reportData.monthlyAiReport.section10_focus.focus}`);
      }

      doc.y += 18;

      // Expenses by Category Table
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text('Expenditure Breakdown by Category');
      doc.rect(40, doc.y + 4, 515, 1).fill('#E2E8F0');
      doc.y += 10;

      // Table Header
      doc.rect(40, doc.y, 515, 20).fill('#F1F5F9');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
      doc.text('CATEGORY', 50, doc.y + 5);
      doc.text('SHARE', 260, doc.y + 5);
      doc.text('AMOUNT (INR)', 430, doc.y + 5, { align: 'right' });
      doc.y += 20;

      const topCats = (reportData.breakdown.expenses || []).slice(0, 8);
      topCats.forEach((c) => {
        doc.rect(40, doc.y, 515, 18).stroke('#F1F5F9');
        doc.fontSize(9).font('Helvetica').fillColor('#1E293B').text(c.category, 50, doc.y + 4);
        doc.text(`${c.pct}%`, 260, doc.y + 4);
        doc.font('Helvetica-Bold').text(formatInr(c.amount), 430, doc.y + 4, { align: 'right' });
        doc.y += 18;
      });

      doc.y += 15;

      // Goals Status
      if (reportData.goals && reportData.goals.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A').text('Financial Goals Status');
        doc.rect(40, doc.y + 4, 515, 1).fill('#E2E8F0');
        doc.y += 10;

        reportData.goals.slice(0, 3).forEach((g) => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#0F172A').text(g.name, 50, doc.y);
          doc.font('Helvetica').fillColor('#64748B').text(
            `Target: ${formatInr(g.targetAmount)} | Accumulated: ${formatInr(g.currentAmount)} (${g.progressPct}%) | Shortfall: ${formatInr(g.shortfall)}`,
            50,
            doc.y + 12
          );
          doc.y += 28;
        });
      }

      // Footer
      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8').text(
        'Kepwe Private Limited • Generated from authoritative user financial records • No direct banking integration required',
        40,
        780,
        { align: 'center', width: 515 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates genuine multi-sheet Excel (.xlsx) workbook buffer using xlsx.
 */
export async function exportReportToExcel(reportData) {
  const wb = xlsx.utils.book_new();

  // Sheet 1: Executive Summary
  const summaryRows = [
    ['KEPWE LEDGER — FINANCIAL REPORT'],
    ['Client Name', reportData.user?.name || 'Valued Client'],
    ['Client Email', reportData.user?.email || ''],
    ['Reporting Period', reportData.periodLabel],
    ['Date From', reportData.dateRange.start],
    ['Date To', reportData.dateRange.end],
    ['Generated On', new Date().toISOString().slice(0, 10)],
    [],
    ['KEY FINANCIAL METRICS', 'AMOUNT (INR)'],
    ['Total Income', reportData.summary.totalIncome],
    ['Total Expenses', reportData.summary.totalExpenses],
    ['Essential Expenses', reportData.summary.essentialExpenses],
    ['Discretionary Lifestyle Expenses', reportData.summary.lifestyleExpenses],
    ['Net Savings', reportData.summary.totalSavings],
    ['Savings Rate (%)', reportData.summary.savingsRate],
    ['Total Investments', reportData.summary.totalInvestments],
    ['Total Debt Obligations', reportData.summary.totalDebt],
    ['Potential Investable Surplus', reportData.summary.investableSurplus],
    ['Spending Variance vs Prior Period', reportData.summary.spendingDiff],
    ['Spending Variance %', reportData.summary.spendingDiffPct],
    [],
    ['AI CFO STRATEGIC OBSERVATION'],
    [reportData.monthlyAiReport.section10_focus.narrative],
  ];
  const wsSummary = xlsx.utils.aoa_to_sheet(summaryRows);
  xlsx.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: Category Breakdown
  const catRows = [
    ['Category', 'Type', 'Amount (INR)', 'Share (%)'],
    ...reportData.breakdown.expenses.map((c) => [c.category, 'Expense', c.amount, c.pct]),
    ...reportData.breakdown.income.map((c) => [c.category, 'Income', c.amount, c.pct]),
  ];
  const wsCats = xlsx.utils.aoa_to_sheet(catRows);
  xlsx.utils.book_append_sheet(wb, wsCats, 'Categories');

  // Sheet 3: Spending Changes (MoM/WoW)
  const changeRows = [
    ['Category', 'Current Period (INR)', 'Prior Period (INR)', 'Variance (INR)', 'Variance (%)', 'Trend'],
    ...(reportData.breakdown.categoryChanges || []).map((c) => [
      c.category,
      c.currentAmount,
      c.priorAmount,
      c.diff,
      c.diffPct,
      c.trend,
    ]),
  ];
  const wsChanges = xlsx.utils.aoa_to_sheet(changeRows);
  xlsx.utils.book_append_sheet(wb, wsChanges, 'Spending Changes');

  // Sheet 4: Goal Progress
  const goalRows = [
    ['Goal Name', 'Type', 'Target Amount', 'Current Amount', 'Progress (%)', 'Shortfall', 'Target Date'],
    ...(reportData.goals || []).map((g) => [
      g.name,
      g.type,
      g.targetAmount,
      g.currentAmount,
      g.progressPct,
      g.shortfall,
      g.targetDate || 'N/A',
    ]),
  ];
  const wsGoals = xlsx.utils.aoa_to_sheet(goalRows);
  xlsx.utils.book_append_sheet(wb, wsGoals, 'Goals');

  // Sheet 5: Transactions Ledger
  const txRows = [
    ['Date', 'Description', 'Merchant', 'Type', 'Category', 'Classification', 'Amount (INR)', 'Payment Method', 'Account'],
    ...(reportData.allTransactions || []).map((t) => [
      t.date,
      t.description,
      t.merchant,
      t.type,
      t.category,
      t.classification,
      t.amount,
      t.paymentMethod,
      t.accountName,
    ]),
  ];
  const wsTxs = xlsx.utils.aoa_to_sheet(txRows);
  xlsx.utils.book_append_sheet(wb, wsTxs, 'Transactions');

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates genuine CSV export with UTF-8 BOM for spreadsheet compatibility.
 */
export function exportReportToCsv(reportData) {
  const lines = [
    `# KEPWE LEDGER FINANCIAL REPORT`,
    `# Client: "${reportData.user?.name || 'Valued Client'}"`,
    `# Period: "${reportData.periodLabel}" (${reportData.dateRange.start} to ${reportData.dateRange.end})`,
    `# Generated: ${new Date().toISOString()}`,
    ``,
    `Date,Description,Merchant,Type,Category,Classification,Amount,PaymentMethod,Account,Reference`,
  ];

  (reportData.allTransactions || []).forEach((t) => {
    const desc = `"${String(t.description || '').replace(/"/g, '""')}"`;
    const merch = `"${String(t.merchant || '').replace(/"/g, '""')}"`;
    const cat = `"${String(t.category || '').replace(/"/g, '""')}"`;
    const cls = `"${String(t.classification || '').replace(/"/g, '""')}"`;
    const meth = `"${String(t.paymentMethod || '').replace(/"/g, '""')}"`;
    const acc = `"${String(t.accountName || '').replace(/"/g, '""')}"`;
    const ref = `"${String(t.referenceNumber || '').replace(/"/g, '""')}"`;

    lines.push(`${t.date},${desc},${merch},${t.type},${cat},${cls},${t.amount},${meth},${acc},${ref}`);
  });

  lines.push(``);
  lines.push(`# FINANCIAL SUMMARY`);
  lines.push(`Total Income,${reportData.summary.totalIncome}`);
  lines.push(`Total Expenses,${reportData.summary.totalExpenses}`);
  lines.push(`Essential Expenses,${reportData.summary.essentialExpenses}`);
  lines.push(`Lifestyle Expenses,${reportData.summary.lifestyleExpenses}`);
  lines.push(`Net Savings,${reportData.summary.totalSavings}`);
  lines.push(`Savings Rate %,${reportData.summary.savingsRate}`);
  lines.push(`Total Investments,${reportData.summary.totalInvestments}`);
  lines.push(`Total Debt,${reportData.summary.totalDebt}`);
  lines.push(`Investable Surplus,${reportData.summary.investableSurplus}`);

  return '\uFEFF' + lines.join('\r\n');
}
