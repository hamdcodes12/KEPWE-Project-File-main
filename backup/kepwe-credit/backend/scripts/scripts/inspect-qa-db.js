import { pool } from '../src/config/db.js';

async function main() {
  const userId = '11111111-1111-4111-8111-111111111111';
  console.log('--- INSPECTING PERSISTENT DB RECORDS FOR QA USER ---');
  
  const txs = await pool.query(
    'SELECT type, amount, category, merchant, classification, is_recurring FROM ledger_transactions WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  console.log(`Found ${txs.rows.length} transactions persisted in PostgreSQL:`);
  txs.rows.forEach((r, i) => {
    console.log(`  ${i+1}. [${r.type.toUpperCase()}] ₹${r.amount} | ${r.category} | ${r.merchant} | Class: ${r.classification} | Recurring: ${r.is_recurring}`);
  });

  const prof = await pool.query(
    'SELECT salary_income, emergency_savings, monthly_debt_obligations, monthly_savings_target, city, occupation FROM ledger_financial_profiles WHERE user_id = $1',
    [userId]
  );
  console.log('\nPersisted Financial Profile:');
  console.log(prof.rows[0]);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
