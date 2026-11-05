async function seedViaApi() {
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'qa@kepwe.in', password: 'KepweQA@2026' })
  });
  const auth = await loginRes.json();
  if (!auth.accessToken) {
    console.error('Failed to log in:', auth);
    process.exit(1);
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.accessToken}`
  };

  // 1. Profile
  await fetch('http://localhost:3001/api/ledger/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      monthlySalary: 120000,
      salaryIncome: 120000,
      emergencySavings: 250000,
      monthlyDebtObligations: 18000,
      monthlySavingsTarget: 35000,
    })
  });
  console.log('✓ Profile updated');

  // 2. Goal
  await fetch('http://localhost:3001/api/ledger/goals', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Emergency Fund 6M',
      type: 'Emergency Fund',
      targetAmount: 300000,
      currentAmount: 120000,
      monthlyContribution: 20000,
      targetDate: '2026-12-31',
      priority: 'high',
      notes: '6 Months reserve goal'
    })
  });
  console.log('✓ Goal created');

  // 3. Transactions
  const txs = [
    { type: 'expense', amount: 28000, transactionDate: '2026-09-02', category: 'Rent', merchant: 'Prime Apartments', description: 'Apartment Rent', classification: 'Essential', isRecurring: true, isEssential: true },
    { type: 'expense', amount: 18000, transactionDate: '2026-09-05', category: 'EMI', merchant: 'HDFC Home Loan', description: 'Home Loan EMI', classification: 'Financial', isRecurring: true, isEssential: true },
    { type: 'expense', amount: 4850, transactionDate: '2026-09-08', category: 'Food Delivery', merchant: 'Swiggy', description: 'Weekend Family Dinner', classification: 'Lifestyle', isRecurring: false, isEssential: false },
    { type: 'expense', amount: 350, transactionDate: '2026-09-10', category: 'Food Delivery', merchant: 'Zomato', description: 'Lunch Biryani', classification: 'Lifestyle', isRecurring: false, isEssential: false },
    { type: 'expense', amount: 280, transactionDate: '2026-09-11', category: 'Coffee & Snacks', merchant: 'Blue Tokai', description: 'Cold Brew Coffee', classification: 'Lifestyle', isRecurring: false, isEssential: false },
    { type: 'expense', amount: 3200, transactionDate: '2026-09-12', category: 'Groceries', merchant: 'Blinkit', description: 'Weekly Pantry Supplies', classification: 'Essential', isRecurring: false, isEssential: true },
    { type: 'expense', amount: 1499, transactionDate: '2026-09-14', category: 'Internet', merchant: 'Airtel Broadband', description: 'Fibre Gigabit Bill', classification: 'Essential', isRecurring: true, isEssential: true },
    { type: 'expense', amount: 799, transactionDate: '2026-09-15', category: 'Entertainment', merchant: 'Netflix Premium', description: '4K Ultra Streaming', classification: 'Lifestyle', isRecurring: true, isEssential: false },
    { type: 'expense', amount: 6200, transactionDate: '2026-09-18', category: 'Shopping', merchant: 'Amazon India', description: 'Office Ergonomic Chair', classification: 'Lifestyle', isRecurring: false, isEssential: false },
    { type: 'investment', amount: 20000, transactionDate: '2026-09-20', category: 'Investment', merchant: 'Zerodha Coin', description: 'Nifty 50 Index SIP', classification: 'Financial', isRecurring: true, isEssential: true },
    // Prior month for spending change comparison
    { type: 'expense', amount: 28000, transactionDate: '2026-08-02', category: 'Rent', merchant: 'Prime Apartments', description: 'Apartment Rent', classification: 'Essential', isRecurring: true, isEssential: true },
    { type: 'expense', amount: 18000, transactionDate: '2026-08-05', category: 'EMI', merchant: 'HDFC Home Loan', description: 'Home Loan EMI', classification: 'Financial', isRecurring: true, isEssential: true },
    { type: 'expense', amount: 3200, transactionDate: '2026-08-08', category: 'Food Delivery', merchant: 'Swiggy', description: 'Weekend Food Delivery', classification: 'Lifestyle', isRecurring: false, isEssential: false },
    { type: 'expense', amount: 9500, transactionDate: '2026-08-18', category: 'Shopping', merchant: 'Amazon India', description: 'Electronics & Headphones', classification: 'Lifestyle', isRecurring: false, isEssential: false },
  ];

  for (const t of txs) {
    await fetch('http://localhost:3001/api/ledger/transactions', {
      method: 'POST',
      headers,
      body: JSON.stringify(t)
    });
  }
  console.log(`✓ Seeded ${txs.length} transactions via API`);

  // Verify reports endpoint
  const repRes = await fetch('http://localhost:3001/api/ledger/reports?period=monthly', { headers });
  const rep = await repRes.json();
  console.log('✓ Reports API verified:', {
    totalIncome: rep.summary.totalIncome,
    totalExpenses: rep.summary.totalExpenses,
    totalSavings: rep.summary.totalSavings,
    savingsRate: rep.summary.savingsRate,
    leaksCount: rep.leaks.count,
    goalsCount: rep.goals.length,
    spendingDiff: rep.summary.spendingDiff,
  });
}

seedViaApi().catch(console.error);
