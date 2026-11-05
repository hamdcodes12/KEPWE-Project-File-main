import { pool } from '../config/db.js';

const query = (text, params) => pool.query(text, params);

/**
 * Helper: Format number to INR
 */
function formatInr(val) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val || 0);
}

/**
 * 1. Comprehensive AI CFO Insights & Intelligence
 * PRD Sections: 6, 13, 14, 18, 20, 21, 23, 28, 49, 52
 */
export async function getComprehensiveCfoInsights(userId, options = {}) {
  // Fetch user profile
  const profileRes = await query(
    `SELECT * FROM ledger_financial_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  const profile = profileRes.rows[0] || {};

  // Fetch accounts to check liquid reserves
  const accRes = await query(
    `SELECT id, name, type, current_balance AS balance FROM ledger_accounts WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );
  const accounts = accRes.rows || [];
  const totalLiquidCash = accounts
    .filter(a => ['bank', 'savings', 'checking', 'wallet'].includes(a.type))
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  // Fetch transactions of past 90 days
  const txRes = await query(
    `SELECT 
       id, 
       amount, 
       type, 
       category, 
       merchant, 
       classification, 
       is_recurring, 
       is_essential, 
       confidence,
       transaction_date,
       description
     FROM ledger_transactions 
     WHERE user_id = $1 
       AND status = 'posted'
       AND transaction_date >= (CURRENT_DATE - INTERVAL '90 days')
     ORDER BY transaction_date DESC`,
    [userId]
  );
  const transactions = txRes.rows || [];

  // Categorize transactions into Current Month (last 30 days) and Previous Month (31-60 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const currentTx = transactions.filter(t => new Date(t.transaction_date) >= thirtyDaysAgo);
  const previousTx = transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  });

  // Basic totals
  const currentIncome = currentTx
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const currentExpenses = currentTx
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const previousExpenses = previousTx
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  // Fallback to profile income if no income transactions recorded in period
  const baselineIncome = Number(profile.monthly_income || 0) > 0
    ? Number(profile.monthly_income)
    : (Number(profile.salary_income || 0) + Number(profile.business_income || 0) + Number(profile.freelance_income || 0));

  const effectiveMonthlyIncome = currentIncome > 0 ? currentIncome : baselineIncome;
  const emergencySavings = Number(profile.emergency_savings || 0) > 0 ? Number(profile.emergency_savings) : totalLiquidCash;
  const debtObligations = Number(profile.monthly_debt_obligations || 0);
  const savingsTarget = Number(profile.monthly_savings_target || 0);

  // 4-Way Classification in Current Period
  const classBreakdown = {
    Essential: 0,
    Lifestyle: 0,
    Financial: 0,
    Other: 0
  };

  const categoryTotals = {};
  const merchantTotals = {};

  currentTx.forEach(t => {
    if (t.type === 'expense') {
      const cls = t.classification || 'Other';
      const amt = Number(t.amount || 0);
      if (classBreakdown[cls] !== undefined) {
        classBreakdown[cls] += amt;
      } else {
        classBreakdown.Other += amt;
      }

      const cat = t.category || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;

      const merch = t.merchant || 'General Outflow';
      merchantTotals[merch] = (merchantTotals[merch] || 0) + amt;
    }
  });

  // Top Spends
  const topCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      pct: currentExpenses > 0 ? Math.round((amount / currentExpenses) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const topMerchants = Object.entries(merchantTotals)
    .map(([merchant, amount]) => ({
      merchant,
      amount,
      pct: currentExpenses > 0 ? Math.round((amount / currentExpenses) * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // Savings & Surplus
  const recordedSavings = Math.max(0, effectiveMonthlyIncome - currentExpenses);
  const savingsRate = effectiveMonthlyIncome > 0
    ? Math.round((recordedSavings / effectiveMonthlyIncome) * 100)
    : 0;

  // PRD Formula: Potential Investable Surplus = Income - Essential Expenses - Debt Obligations - Savings Target
  const essentialExpenses = classBreakdown.Essential;
  const potentialSurplus = Math.max(
    0,
    effectiveMonthlyIncome - essentialExpenses - debtObligations - savingsTarget
  );

  // MoM Spending Change
  const expenseGrowthPct = previousExpenses > 0
    ? Math.round(((currentExpenses - previousExpenses) / previousExpenses) * 100)
    : null;

  // Months of Essential Coverage (Emergency Fund)
  const monthlyEssentialRunRate = essentialExpenses > 0 ? essentialExpenses : (currentExpenses * 0.5 || 25000);
  const emergencyCoverageMonths = monthlyEssentialRunRate > 0
    ? Number((emergencySavings / monthlyEssentialRunRate).toFixed(1))
    : 0;

  // -------------------------------------------------------------
  // Data Confidence Rating
  // -------------------------------------------------------------
  let confidenceLevel = 'Needs Review';
  let confidenceScore = 40;
  if (transactions.length >= 15 && effectiveMonthlyIncome > 0) {
    confidenceLevel = 'High';
    confidenceScore = 95;
  } else if (transactions.length >= 5 || effectiveMonthlyIncome > 0) {
    confidenceLevel = 'Medium';
    confidenceScore = 75;
  }

  // -------------------------------------------------------------
  // Health Score Calculation (0-100)
  // -------------------------------------------------------------
  let healthScore = 50;
  if (effectiveMonthlyIncome > 0 || currentExpenses > 0) {
    let score = 0;
    // 1. Savings rate (up to 30 pts)
    if (savingsRate >= 30) score += 30;
    else if (savingsRate >= 20) score += 24;
    else if (savingsRate >= 10) score += 15;
    else if (savingsRate > 0) score += 8;

    // 2. Emergency buffer (up to 25 pts)
    if (emergencyCoverageMonths >= 6) score += 25;
    else if (emergencyCoverageMonths >= 3) score += 18;
    else if (emergencyCoverageMonths >= 1) score += 10;
    else score += 3;

    // 3. Discretionary ratio (up to 25 pts)
    const lifestylePct = currentExpenses > 0 ? (classBreakdown.Lifestyle / currentExpenses) * 100 : 0;
    if (lifestylePct <= 25) score += 25;
    else if (lifestylePct <= 35) score += 20;
    else if (lifestylePct <= 50) score += 12;
    else score += 5;

    // 4. Spending stability (up to 20 pts)
    if (expenseGrowthPct === null || expenseGrowthPct <= 0) score += 20;
    else if (expenseGrowthPct <= 10) score += 15;
    else if (expenseGrowthPct <= 25) score += 8;
    else score += 2;

    healthScore = Math.min(100, Math.max(10, score));
  }

  // -------------------------------------------------------------
  // Expense Reduction Engine (PRD Section 13, 20)
  // -------------------------------------------------------------
  const reductionOpportunities = [];

  // A. Recurring Subscriptions
  const subscriptionKeywords = ['netflix', 'spotify', 'prime', 'hotstar', 'youtube', 'gym', 'cult', 'apple', 'google one', 'cloud', 'subscription', 'membership'];
  const detectedSubscriptions = [];
  const recurringTx = transactions.filter(t => 
    subscriptionKeywords.some(k => (t.description || '').toLowerCase().includes(k) || (t.merchant || '').toLowerCase().includes(k)) ||
    (t.is_recurring && t.classification === 'Lifestyle')
  );

  const subMap = {};
  recurringTx.forEach(t => {
    const key = (t.merchant || t.description || 'Subscription').toLowerCase();
    if (!subMap[key]) {
      subMap[key] = { name: t.merchant || t.description, amount: Number(t.amount), count: 0 };
    }
    subMap[key].count += 1;
  });

  const subList = Object.values(subMap);
  if (subList.length >= 2) {
    const totalSubCost = subList.reduce((acc, s) => acc + s.amount, 0);
    reductionOpportunities.push({
      id: 'subscriptions_review',
      type: 'recurring_subscriptions',
      title: 'Review Active Recurring Subscriptions',
      summary: `${subList.length} recurring subscriptions detected totalling ${formatInr(totalSubCost)}/month.`,
      potentialMonthlySavings: Math.round(totalSubCost * 0.4),
      items: subList.map(s => `${s.name} (${formatInr(s.amount)}/mo)`),
      recommendation: 'Evaluate recurring streaming and software services. Users who conduct an audit typically identify at least one unused tier.',
      severity: 'medium'
    });
  }

  // B. Spending Leaks (frequent low-ticket discretionary spends < ₹600)
  const microSpends = currentTx.filter(t => t.type === 'expense' && Number(t.amount) > 0 && Number(t.amount) <= 600);
  const microMerchantFreq = {};
  microSpends.forEach(t => {
    const m = t.merchant || t.category || 'Other';
    if (!microMerchantFreq[m]) microMerchantFreq[m] = { name: m, count: 0, total: 0 };
    microMerchantFreq[m].count += 1;
    microMerchantFreq[m].total += Number(t.amount);
  });

  const leakCandidates = Object.values(microMerchantFreq).filter(item => item.count >= 4 && item.total >= 1500);
  if (leakCandidates.length > 0) {
    const leakTotal = leakCandidates.reduce((acc, c) => acc + c.total, 0);
    reductionOpportunities.push({
      id: 'spending_leaks',
      type: 'micro_spending_leak',
      title: 'Micro-Spending Leaks Detected',
      summary: `High frequency of sub-₹600 transactions at ${leakCandidates.map(c => c.name).join(', ')} totalling ${formatInr(leakTotal)}.`,
      potentialMonthlySavings: Math.round(leakTotal * 0.3),
      items: leakCandidates.map(c => `${c.name}: ${c.count} transactions (${formatInr(c.total)})`),
      recommendation: 'Batch delivery and snack purchases into scheduled weekly orders to curtail incidental surge and convenience fees.',
      severity: 'high'
    });
  }

  // C. Discretionary Lifestyle Trim
  if (classBreakdown.Lifestyle > 0) {
    const lifestylePct = currentExpenses > 0 ? Math.round((classBreakdown.Lifestyle / currentExpenses) * 100) : 0;
    if (lifestylePct >= 35) {
      const trimAmount = Math.round(classBreakdown.Lifestyle * 0.2);
      reductionOpportunities.push({
        id: 'lifestyle_trim',
        type: 'discretionary_trim',
        title: 'Lifestyle Spending Optimization',
        summary: `Lifestyle spending represents ${lifestylePct}% of total expenses (${formatInr(classBreakdown.Lifestyle)}).`,
        potentialMonthlySavings: trimAmount,
        items: topCategories.filter(c => ['Restaurants', 'Food Delivery', 'Shopping', 'Entertainment', 'Travel'].includes(c.category)).map(c => `${c.category}: ${formatInr(c.amount)} (${c.pct}%)`),
        recommendation: `A targeted 20% moderation in dining and entertainment would free up ${formatInr(trimAmount)} each month for high-yield savings or investments.`,
        severity: 'medium'
      });
    }
  }

  // -------------------------------------------------------------
  // Financial Surplus Engine & Allocation Roadmap (PRD Section 21)
  // -------------------------------------------------------------
  const surplusAllocation = {
    monthlyIncome: effectiveMonthlyIncome,
    essentialExpenses,
    debtObligations,
    savingsTarget,
    potentialInvestableSurplus: potentialSurplus,
    recommendations: []
  };

  if (potentialSurplus > 0) {
    // 1. Emergency fund boost if coverage is under 6 months
    if (emergencyCoverageMonths < 6) {
      const emergencyAllocation = Math.round(potentialSurplus * 0.4);
      surplusAllocation.recommendations.push({
        bucket: 'Emergency Reserve',
        amount: emergencyAllocation,
        pct: 40,
        rationale: `Current emergency buffer covers ${emergencyCoverageMonths} months. Directing ${formatInr(emergencyAllocation)} builds toward the recommended 6-month safety benchmark.`
      });
    }

    // 2. Systematic Wealth Building (SIP / Index Fund)
    const investmentPct = emergencyCoverageMonths >= 6 ? 70 : 40;
    const investmentAllocation = Math.round(potentialSurplus * (investmentPct / 100));
    surplusAllocation.recommendations.push({
      bucket: 'Systematic Investment (SIP / Equity)',
      amount: investmentAllocation,
      pct: investmentPct,
      rationale: `Directing ${formatInr(investmentAllocation)} into disciplined monthly investments compounds wealth without impacting your current standard of living.`
    });

    // 3. Goal / Cash Buffer
    const remaining = potentialSurplus - surplusAllocation.recommendations.reduce((s, r) => s + r.amount, 0);
    if (remaining > 0) {
      surplusAllocation.recommendations.push({
        bucket: 'Milestone Goals / Cash Buffer',
        amount: remaining,
        pct: Math.round((remaining / potentialSurplus) * 100),
        rationale: `Retain ${formatInr(remaining)} for active savings goals (vehicle, down payment, vacation) or liquid short-term needs.`
      });
    }
  }

  // -------------------------------------------------------------
  // Proactive Alerts (PRD Section 23)
  // -------------------------------------------------------------
  const alerts = [];

  if (emergencyCoverageMonths < 3 && monthlyEssentialRunRate > 0) {
    alerts.push({
      id: 'emergency_buffer_low',
      level: 'warning',
      category: 'Liquidity',
      headline: 'Emergency Buffer Under 3 Months',
      message: `Your estimated liquid cash (${formatInr(emergencySavings)}) covers only ${emergencyCoverageMonths} months of essential needs. Target: 6 months (${formatInr(monthlyEssentialRunRate * 6)}).`,
      action: 'Build Emergency Fund',
      tab: 'goals'
    });
  }

  if (expenseGrowthPct !== null && expenseGrowthPct >= 25) {
    alerts.push({
      id: 'spending_surge',
      level: 'warning',
      category: 'Spending Growth',
      headline: `Spending Rose by ${expenseGrowthPct}% vs Prior Period`,
      message: `Recorded outflows this period increased by ${formatInr(currentExpenses - previousExpenses)} compared to the prior 30 days.`,
      action: 'Inspect Outflows',
      tab: 'expenses'
    });
  }

  if (savingsTarget > 0 && recordedSavings < savingsTarget) {
    alerts.push({
      id: 'savings_target_shortfall',
      level: 'info',
      category: 'Savings Target',
      headline: 'Monthly Savings Target Shortfall',
      message: `Current recorded savings of ${formatInr(recordedSavings)} trails your target of ${formatInr(savingsTarget)} by ${formatInr(savingsTarget - recordedSavings)}.`,
      action: 'Review Discretionary Spending',
      tab: 'cfo'
    });
  }

  // Detect single large transactions (> 25% of monthly income)
  const largeTx = currentTx.filter(t => t.type === 'expense' && effectiveMonthlyIncome > 0 && Number(t.amount) >= (effectiveMonthlyIncome * 0.25));
  if (largeTx.length > 0) {
    alerts.push({
      id: 'large_transactions',
      level: 'info',
      category: 'Audit Notice',
      headline: `${largeTx.length} Large Transaction(s) Logged`,
      message: `High-value outflows detected, including ${largeTx[0].merchant || largeTx[0].category} for ${formatInr(largeTx[0].amount)}. Confirm categorization.`,
      action: 'Verify Transactions',
      tab: 'transactions'
    });
  }

  // General positive status if everything optimal
  if (alerts.length === 0 && effectiveMonthlyIncome > 0) {
    alerts.push({
      id: 'cfo_healthy_state',
      level: 'success',
      category: 'Financial Stability',
      headline: 'Cash Flow Within Optimal CFO Parameters',
      message: `Savings rate is healthy at ${savingsRate}% and essential coverage is stable. Continue maintaining disciplined allocations.`,
      action: 'Explore Wealth Goals',
      tab: 'goals'
    });
  }

  // Return the comprehensive payload
  return {
    healthScore: {
      score: healthScore,
      status: healthScore >= 75 ? 'Healthy' : healthScore >= 50 ? 'Moderate' : 'Needs Attention',
      statusClass: healthScore >= 75 ? 'healthy' : healthScore >= 50 ? 'moderate' : 'critical'
    },
    dataConfidence: {
      level: confidenceLevel,
      score: confidenceScore,
      transactionCount: transactions.length,
      periodDays: 90
    },
    metrics: {
      monthlyIncome: effectiveMonthlyIncome,
      recordedExpenses: currentExpenses,
      recordedSavings,
      savingsRate,
      essentialExpenses,
      lifestyleExpenses: classBreakdown.Lifestyle,
      financialExpenses: classBreakdown.Financial,
      otherExpenses: classBreakdown.Other,
      emergencySavings,
      emergencyCoverageMonths,
      expenseGrowthPct,
      potentialSurplus
    },
    topCategories,
    topMerchants,
    reductionOpportunities,
    surplusAllocation,
    alerts,
    disclaimer: 'All insights and calculations are derived from your authenticated recorded transactions and profile. No bank credentials, bank logins, or third-party banking APIs are used.'
  };
}

/**
 * 2. "Can I Afford This?" & "Before You Buy" Scenario Analysis Engine
 * PRD Sections: 19, 21, 52
 */
export async function evaluateAffordability(userId, params) {
  const {
    purchaseAmount,
    category = 'General Purchase',
    description = '',
    isEmi = false,
    tenureMonths = 6,
    annualInterestRate = 14
  } = params;

  const cost = Number(purchaseAmount);
  if (!cost || cost <= 0) {
    throw new Error('Please enter a valid purchase amount greater than 0.');
  }

  // Fetch user profile and recent 30-day cashflow
  const profileRes = await query(
    `SELECT * FROM ledger_financial_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  const profile = profileRes.rows[0] || {};

  const accRes = await query(
    `SELECT current_balance AS balance, type FROM ledger_accounts WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );
  const liquidCash = (accRes.rows || [])
    .filter(a => ['bank', 'savings', 'checking', 'wallet'].includes(a.type))
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  // Query 30-day outflows
  const txRes = await query(
    `SELECT 
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS monthly_income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS monthly_expenses,
       SUM(CASE WHEN type = 'expense' AND classification = 'Essential' THEN amount ELSE 0 END) AS essential_expenses
     FROM ledger_transactions 
     WHERE user_id = $1 
       AND status = 'posted'
       AND transaction_date >= (CURRENT_DATE - INTERVAL '30 days')`,
    [userId]
  );

  const txData = txRes.rows[0] || {};
  const recordedIncome = Number(txData.monthly_income || 0);
  const recordedExpenses = Number(txData.monthly_expenses || 0);
  const essentialExpenses = Number(txData.essential_expenses || 0);

  const baselineIncome = Number(profile.monthly_income || 0) > 0
    ? Number(profile.monthly_income)
    : (Number(profile.salary_income || 0) + Number(profile.business_income || 0) + Number(profile.freelance_income || 0));

  const monthlyIncome = recordedIncome > 0 ? recordedIncome : (baselineIncome > 0 ? baselineIncome : 50000);
  const monthlySavings = Math.max(0, monthlyIncome - recordedExpenses);
  const debtObligations = Number(profile.monthly_debt_obligations || 0);
  const emergencySavings = Number(profile.emergency_savings || 0) > 0 ? Number(profile.emergency_savings) : liquidCash;
  const monthlyBufferNeeded = essentialExpenses > 0 ? essentialExpenses : (monthlyIncome * 0.4);

  // Calculations for Cash vs EMI
  let monthlyPayment = cost;
  let totalInterest = 0;
  let emiPerMonth = 0;

  if (isEmi && tenureMonths > 1) {
    const monthlyRate = (annualInterestRate / 100) / 12;
    // Standard EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    emiPerMonth = Math.round((cost * monthlyRate * factor) / (factor - 1));
    const totalPayable = emiPerMonth * tenureMonths;
    totalInterest = Math.max(0, totalPayable - cost);
    monthlyPayment = emiPerMonth;
  }

  // PRD Free Disposable Surplus
  const monthlySurplus = Math.max(0, monthlyIncome - recordedExpenses - debtObligations);
  const surplusAfterPayment = monthlySurplus - monthlyPayment;

  // Opportunity Cost: FV = P * (1 + r)^t at 12% equity CAGR over 5 years
  const fiveYearGrowth = Math.round(cost * Math.pow(1 + 0.12, 5));
  const wealthOpportunityCost = fiveYearGrowth - cost;

  // Evaluation & Verdict
  let verdict = 'Comfortably Affordable';
  let verdictClass = 'affordable';
  let verdictReason = '';
  let recommendations = [];

  if (isEmi) {
    if (emiPerMonth <= monthlySurplus * 0.35) {
      verdict = 'Comfortably Affordable (EMI)';
      verdictClass = 'affordable';
      verdictReason = `Monthly EMI of ${formatInr(emiPerMonth)} represents only ${Math.round((emiPerMonth / (monthlySurplus || 1)) * 100)}% of your monthly surplus.`;
      recommendations.push(`Keep tenure at ${tenureMonths} months to limit total interest payout to ${formatInr(totalInterest)}.`);
    } else if (emiPerMonth <= monthlySurplus * 0.70) {
      verdict = 'Affordable with Caution (EMI)';
      verdictClass = 'caution';
      verdictReason = `EMI consumes ${Math.round((emiPerMonth / monthlySurplus) * 100)}% of your monthly surplus, leaving little room for unexpected spikes.`;
      recommendations.push('Temporarily scale back non-essential dining/shopping until this commitment completes.');
    } else {
      verdict = 'Not Recommended via EMI';
      verdictClass = 'unaffordable';
      verdictReason = `EMI of ${formatInr(emiPerMonth)} exceeds your sustainable monthly discretionary surplus.`;
      recommendations.push('Delaying this purchase by 2-3 months allows you to buy with cash without creating debt drag.');
    }
  } else {
    // One-time cash purchase
    if (cost <= monthlySurplus) {
      verdict = 'Comfortably Affordable (Cash)';
      verdictClass = 'affordable';
      verdictReason = `Purchase can be fully absorbed by this month's net cash surplus without touching savings or emergency reserves.`;
      recommendations.push('Pay in full to avoid any finance charges or credit card interest.');
    } else if (cost <= monthlySurplus + (emergencySavings - monthlyBufferNeeded * 3)) {
      verdict = 'Affordable with Planning';
      verdictClass = 'caution';
      verdictReason = `Exceeds single-month surplus (${formatInr(monthlySurplus)}), but liquid buffer remains sufficient above minimum safety threshold.`;
      recommendations.push(`Consider spreading over 2 months or waiting 30 days to fund ${Math.round((monthlySurplus / cost) * 100)}% from upcoming cashflow.`);
    } else {
      verdict = 'Stretches Financial Safety';
      verdictClass = 'unaffordable';
      verdictReason = `A ₹${cost.toLocaleString('en-IN')} outlay would deplete critical emergency reserves below the safe 3-month essential buffer (${formatInr(monthlyBufferNeeded * 3)}).`;
      recommendations.push('Building your core emergency fund first will protect you against high-interest debt emergencies.');
    }
  }

  return {
    scenario: {
      purchaseAmount: cost,
      category,
      description: description || category,
      isEmi,
      tenureMonths: isEmi ? tenureMonths : 1,
      monthlyPayment,
      totalInterest,
      annualInterestRate: isEmi ? annualInterestRate : 0
    },
    financialContext: {
      monthlyIncome,
      recordedExpenses,
      monthlySurplus,
      liquidEmergencyBuffer: emergencySavings,
      surplusAfterPayment: Math.max(0, surplusAfterPayment),
      isSurplusNegative: surplusAfterPayment < 0
    },
    opportunityCost: {
      fiveYearProjection: fiveYearGrowth,
      wealthOpportunityCost,
      explanation: `If invested in an index fund at an average 12% CAGR, ${formatInr(cost)} could grow to ${formatInr(fiveYearGrowth)} over 5 years.`
    },
    verdict: {
      status: verdict,
      statusClass: verdictClass,
      reason: verdictReason,
      recommendations
    }
  };
}

/**
 * 3. Conversational AI CFO Natural Language Engine
 * PRD Sections: 18, 52
 */
export async function processNaturalLanguageCfoQuery(userId, userQuestion) {
  const queryText = (userQuestion || '').trim();
  if (!queryText) {
    throw new Error('Please enter a question for your AI CFO.');
  }

  const q = queryText.toLowerCase();

  // Load user data for factual answering
  const insights = await getComprehensiveCfoInsights(userId);
  const { metrics, topCategories, topMerchants, reductionOpportunities, surplusAllocation } = insights;

  // Intent 1: Where did my money go? / Category spending
  if (q.includes('where') && (q.includes('money') || q.includes('go') || q.includes('spent'))) {
    const top3 = topCategories.slice(0, 3);
    const top3Text = top3.map(c => `**${c.category}**: ${formatInr(c.amount)} (${c.pct}%)`).join(', ');
    return {
      question: queryText,
      intent: 'spending_breakdown',
      headline: 'Where Your Money Went This Period',
      answer: `In the last 30 days, your recorded outflows total **${formatInr(metrics.recordedExpenses)}**. Your top spending categories are ${top3Text}. Essential expenses made up ${formatInr(metrics.essentialExpenses)}, while Lifestyle spending accounted for ${formatInr(metrics.lifestyleExpenses)}.`,
      data: {
        totalExpenses: metrics.recordedExpenses,
        essentialExpenses: metrics.essentialExpenses,
        lifestyleExpenses: metrics.lifestyleExpenses,
        topCategories: top3
      },
      actionSuggestion: 'Review Expenses Breakdown'
    };
  }

  // Intent 2: Specific category spending (food, dining, groceries, shopping, rent, travel)
  const categoryMatch = ['food', 'dining', 'restaurant', 'groceries', 'shopping', 'rent', 'travel', 'entertainment', 'bills', 'electricity', 'medical'].find(cat => q.includes(cat));
  if (categoryMatch) {
    const matchedCategory = topCategories.find(c => c.category.toLowerCase().includes(categoryMatch)) || { category: categoryMatch, amount: 0, pct: 0 };
    return {
      question: queryText,
      intent: 'category_inquiry',
      headline: `Spending on ${matchedCategory.category}`,
      answer: matchedCategory.amount > 0
        ? `You have spent **${formatInr(matchedCategory.amount)}** on **${matchedCategory.category}** this period (${matchedCategory.pct}% of total outflows).`
        : `No recorded spending found for "${categoryMatch}" in the current 30-day period.`,
      data: matchedCategory,
      actionSuggestion: 'Filter Transactions'
    };
  }

  // Intent 3: How much can I save? / Savings rate
  if (q.includes('how much') && (q.includes('save') || q.includes('saving'))) {
    return {
      question: queryText,
      intent: 'savings_potential',
      headline: 'Your Current Savings Capacity',
      answer: `Based on your recorded income (${formatInr(metrics.monthlyIncome)}) and outflows (${formatInr(metrics.recordedExpenses)}), you currently retain **${formatInr(metrics.recordedSavings)}/month** (${metrics.savingsRate}% savings rate). After essential bills and debt commitments, your potential investable surplus is **${formatInr(metrics.potentialSurplus)}**.`,
      data: {
        currentSavings: metrics.recordedSavings,
        savingsRate: metrics.savingsRate,
        potentialSurplus: metrics.potentialSurplus
      },
      actionSuggestion: 'View Surplus Allocation Roadmap'
    };
  }

  // Intent 4: What can I reduce? / Financial leaks
  if (q.includes('reduce') || q.includes('cut') || q.includes('leak') || q.includes('waste')) {
    if (reductionOpportunities.length > 0) {
      const topOp = reductionOpportunities[0];
      return {
        question: queryText,
        intent: 'expense_reduction',
        headline: topOp.title,
        answer: `${topOp.summary} **CFO Recommendation**: ${topOp.recommendation} Potential estimated savings: **${formatInr(topOp.potentialMonthlySavings)}/month**.`,
        data: reductionOpportunities,
        actionSuggestion: 'Execute Reduction Plan'
      };
    } else {
      return {
        question: queryText,
        intent: 'expense_reduction',
        headline: 'No Critical Spending Leaks Found',
        answer: `Your recorded transactions show disciplined allocations with no runaway recurring leaks. Maintaining your current lifestyle ratio of ${Math.round((metrics.lifestyleExpenses / (metrics.recordedExpenses || 1)) * 100)}% remains optimal.`,
        data: [],
        actionSuggestion: 'Explore Growth Goals'
      };
    }
  }

  // Intent 5: Show recurring expenses / subscriptions
  if (q.includes('recurring') || q.includes('subscription') || q.includes('emi') || q.includes('bills')) {
    const subOp = reductionOpportunities.find(o => o.type === 'recurring_subscriptions');
    if (subOp) {
      return {
        question: queryText,
        intent: 'recurring_overview',
        headline: 'Active Subscriptions & Recurring Commitments',
        answer: `You have recurring commitments identified: ${subOp.items.join(', ')}. Total recurring outflow is approximately **${formatInr(subOp.potentialMonthlySavings * 2.5)}/month**.`,
        data: subOp,
        actionSuggestion: 'Manage Recurring Commitments'
      };
    } else {
      return {
        question: queryText,
        intent: 'recurring_overview',
        headline: 'Committed Outflows Summary',
        answer: `Your recorded debt and scheduled commitments total **${formatInr(metrics.essentialExpenses)}** in essential outflows this period.`,
        data: { essentialExpenses: metrics.essentialExpenses },
        actionSuggestion: 'Add Recurring Entry'
      };
    }
  }

  // Intent 6: What changed this month? / Spending increase
  if (q.includes('change') || q.includes('different') || q.includes('increase') || q.includes('why')) {
    const growth = metrics.expenseGrowthPct;
    const growthText = growth !== null
      ? (growth > 0 ? `increased by **${growth}%**` : `decreased by **${Math.abs(growth)}%**`)
      : 'is consistent with initial records';

    return {
      question: queryText,
      intent: 'spending_shift',
      headline: 'Month-over-Month Spending Dynamics',
      answer: `Total outflows have ${growthText} compared to the preceding 30-day period. Your highest spending category remains **${topCategories[0]?.category || 'General Outflows'}** at ${formatInr(topCategories[0]?.amount || 0)}.`,
      data: {
        expenseGrowthPct: growth,
        topCategory: topCategories[0]
      },
      actionSuggestion: 'View Period Comparison'
    };
  }

  // Default Fallback
  return {
    question: queryText,
    intent: 'general_cfo_summary',
    headline: 'Executive Financial Summary',
    answer: `You have recorded **${formatInr(metrics.monthlyIncome)}** in income and **${formatInr(metrics.recordedExpenses)}** in outflows over the last 30 days. Your savings rate is **${metrics.savingsRate}%** with **${formatInr(metrics.potentialSurplus)}** in potential investable surplus. Feel free to ask about specific categories, affordability scenarios, or reduction tips.`,
    data: metrics,
    actionSuggestion: 'Run Purchase Scenario'
  };
}
