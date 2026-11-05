import { pool } from '../src/config/db.js';

async function seedQaData() {
  const userId = '11111111-1111-4111-8111-111111111111';

  // 1. Account
  const accRes = await pool.query(
    `INSERT INTO ledger_accounts (user_id, name, type, current_balance, opening_balance)
     VALUES ($1, 'HDFC Salary Account', 'Bank Account', 185400.00, 150000.00)
     ON CONFLICT DO NOTHING RETURNING id`,
    [userId]
  );
  let accountId = accRes.rows[0]?.id;
  if (!accountId) {
    const a = await pool.query(`SELECT id FROM ledger_accounts WHERE user_id = $1 LIMIT 1`, [userId]);
    accountId = a.rows[0]?.id;
  }

  // 2. Profile
  await pool.query(
    `INSERT INTO ledger_financial_profiles (user_id, monthly_income, salary_income, emergency_savings, monthly_debt_obligations, monthly_savings_target)
     VALUES ($1, 120000, 120000, 250000, 18000, 35000)
     ON CONFLICT (user_id) DO UPDATE SET 
       monthly_income = 120000, salary_income = 120000, emergency_savings = 250000,
       monthly_debt_obligations = 18000, monthly_savings_target = 35000`,
    [userId]
  );

  // 3. Goal
  await pool.query(
    `INSERT INTO ledger_goals (user_id, name, type, target_amount, current_amount, monthly_contribution, target_date, priority, status)
     VALUES ($1, 'Emergency Fund 6M', 'Emergency Fund', 300000, 120000, 20000, '2026-12-31', 'high', 'active')
     ON CONFLICT DO NOTHING`,
    [userId]
  );

  // Clean old transactions for clean reporting QA
  await pool.query(`DELETE FROM ledger_transactions WHERE user_id = $1`, [userId]);

  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const priorMo = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0');
  const priorYr = now.getMonth() === 0 ? yr - 1 : yr;

  const currentTxs = [
    { type: 'income', amount: 120000, date: `${yr}-${mo}-01`, cat: 'Salary', merch: 'Kepwe Technologies', desc: 'Monthly Salary Credit', cls: 'Essential', rec: true, ess: true },
    { type: 'expense', amount: 28000, date: `${yr}-${mo}-02`, cat: 'Rent', merch: 'Prime Apartments', desc: 'Flat Rent Payment', cls: 'Essential', rec: true, ess: true },
    { type: 'expense', amount: 18000, date: `${yr}-${mo}-05`, cat: 'EMI', merch: 'HDFC Home Loan', desc: 'Home Loan Monthly EMI', cls: 'Financial', rec: true, ess: true },
    { type: 'expense', amount: 4850, date: `${yr}-${mo}-08`, cat: 'Food Delivery', merch: 'Swiggy', desc: 'Weekend Family Dinner', cls: 'Lifestyle', rec: false, ess: false },
    { type: 'expense', amount: 350, date: `${yr}-${mo}-10`, cat: 'Food Delivery', merch: 'Zomato', desc: 'Lunch Roll', cls: 'Lifestyle', rec: false, ess: false },
    { type: 'expense', amount: 280, date: `${yr}-${mo}-11`, cat: 'Coffee & Snacks', merch: 'Blue Tokai', desc: 'Cold Brew Coffee', cls: 'Lifestyle', rec: false, ess: false },
    { type: 'expense', amount: 3200, date: `${yr}-${mo}-12`, cat: 'Groceries', merch: 'Blinkit', desc: 'Weekly Pantry Supplies', cls: 'Essential', rec: false, ess: true },
    { type: 'expense', amount: 1499, date: `${yr}-${mo}-14`, cat: 'Internet', merch: 'Airtel Broadband', desc: 'Fibre Gigabit Bill', cls: 'Essential', rec: true, ess: true },
    { type: 'expense', amount: 799, date: `${yr}-${mo}-15`, cat: 'Entertainment', merch: 'Netflix Premium', desc: '4K Ultra Streaming', cls: 'Lifestyle', rec: true, ess: false },
    { type: 'expense', amount: 6200, date: `${yr}-${mo}-18`, cat: 'Shopping', merch: 'Amazon India', desc: 'Office Ergonomic Chair', cls: 'Lifestyle', rec: false, ess: false },
    { type: 'investment', amount: 20000, date: `${yr}-${mo}-20`, cat: 'Investment', merch: 'Zerodha Coin', desc: 'Nifty 50 Index SIP', cls: 'Financial', rec: true, ess: true },
  ];

  const priorTxs = [
    { type: 'income', amount: 120000, date: `${priorYr}-${priorMo}-01`, cat: 'Salary', merch: 'Kepwe Technologies', desc: 'Monthly Salary Credit', cls: 'Essential', rec: true, ess: true },
    { type: 'expense', amount: 28000, date: `${priorYr}-${priorMo}-02`, cat: 'Rent', merch: 'Prime Apartments', desc: 'Flat Rent Payment', cls: 'Essential', rec: true, ess: true },
    { type: 'expense', amount: 18000, date: `${priorYr}-${priorMo}-05`, cat: 'EMI', merch: 'HDFC Home Loan', desc: 'Home Loan Monthly EMI', cls: 'Financial', rec: true, ess: true },
    { type: 'expense', amount: 3200, date: `${priorYr}-${priorMo}-08`, cat: 'Food Delivery', merch: 'Swiggy', desc: 'Weekend Food Delivery', cls: 'Lifestyle', rec: false, ess: false },
    { type: 'expense', amount: 9500, date: `${priorYr}-${priorMo}-18`, cat: 'Shopping', merch: 'Amazon India', desc: 'Electronics & Headphones', cls: 'Lifestyle', rec: false, ess: false },
  ];

  for (const t of [...currentTxs, ...priorTxs]) {
    await pool.query(
      `INSERT INTO ledger_transactions 
       (user_id, account_id, type, amount, transaction_date, category, merchant, description, classification, is_recurring, is_essential)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [userId, accountId, t.type, t.amount, t.date, t.cat, t.merch, t.desc, t.cls, t.rec, t.ess]
    );
  }

  console.log('[seed-qa-report-data] Successfully seeded QA financial report dataset.');
  process.exit(0);
}

seedQaData().catch(e => { console.error(e); process.exit(1); });
