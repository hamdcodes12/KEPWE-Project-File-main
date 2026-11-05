import test from 'node:test';
import assert from 'node:assert/strict';

const API_BASE = 'http://localhost:3001/api';

async function loginUser(identifier, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.accessToken) {
    throw new Error(`Login failed for ${identifier}: ${JSON.stringify(data)}`);
  }
  return data.accessToken;
}

test('Phase 9 — PRD Financial Reports & Exports E2E Integration Suite', async (t) => {
  let tokenA;
  let tokenB;

  await t.test('Setup: Authenticate QA User A and Isolation User B', async () => {
    tokenA = await loginUser('qa@kepwe.in', 'KepweQA@2026');
    assert.ok(tokenA, 'User A should receive access token');

    // Register or login User B
    try {
      tokenB = await loginUser('qa2@kepwe.in', 'KepweQA@2026');
    } catch {
      // Register if not already present
      const reg = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'qa2@kepwe.in',
          password: 'KepweQA@2026',
          name: 'QA Isolation User',
          mobile: '9876543211',
        }),
      });
      const regData = await reg.json();
      tokenB = regData.accessToken;
    }
    assert.ok(tokenB, 'User B should receive access token');
  });

  await t.test('1. Monthly AI Report conforms to 10 PRD-defined sections', async () => {
    const res = await fetch(`${API_BASE}/ledger/reports?period=monthly&reportType=monthly_ai`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.period, 'monthly');
    assert.ok(data.summary.totalIncome >= 100000);
    assert.ok(data.summary.totalExpenses > 0);
    assert.ok(data.summary.totalSavings > 0);
    assert.ok(data.summary.savingsRate > 0);

    const m = data.monthlyAiReport;
    assert.ok(m.section1_income, 'Section 1 Income must exist');
    assert.ok(m.section2_expenses, 'Section 2 Expenses must exist');
    assert.ok(m.section3_savings, 'Section 3 Savings must exist');
    assert.ok(m.section4_investments, 'Section 4 Investments must exist');
    assert.ok(m.section5_debt, 'Section 5 Debt must exist');
    assert.ok(m.section6_recurring, 'Section 6 Recurring must exist');
    assert.ok(m.section7_spending_changes, 'Section 7 Spending Changes must exist');
    assert.ok(m.section8_financial_leaks, 'Section 8 Financial Leaks must exist');
    assert.ok(m.section9_goals, 'Section 9 Goals must exist');
    assert.ok(m.section10_focus, 'Section 10 Focus must exist');

    // Section 1 Income verification
    assert.equal(m.section1_income.total, data.summary.totalIncome);
    // Section 3 Savings verification
    assert.equal(m.section3_savings.savingsRate, data.summary.savingsRate);
    // Section 8 Leaks verification
    assert.ok(m.section8_financial_leaks.count >= 1);
    // Section 9 Goals verification
    assert.ok(m.section9_goals.activeGoalsCount >= 1);
  });

  await t.test('2. Weekly CFO Report conforms to 7 PRD-defined pulse metrics', async () => {
    const res = await fetch(`${API_BASE}/ledger/reports?period=weekly&reportType=weekly_cfo`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    const w = data.weeklyCfoReport;
    assert.ok('income' in w, 'Must contain income');
    assert.ok('expenses' in w, 'Must contain expenses');
    assert.ok('savings' in w, 'Must contain savings');
    assert.ok('investment' in w, 'Must contain investment');
    assert.ok('biggestExpense' in w, 'Must contain biggestExpense');
    assert.ok('moneyLeak' in w, 'Must contain moneyLeak');
    assert.ok('positiveBehaviour' in w, 'Must contain positiveBehaviour');
  });

  await t.test('3. Reporting Period boundaries work (Daily, Weekly, Monthly, Quarterly, Annual, Custom)', async () => {
    const periods = ['daily', 'weekly', 'monthly', 'quarterly', 'annual'];
    for (const p of periods) {
      const res = await fetch(`${API_BASE}/ledger/reports?period=${p}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.period, p);
      assert.ok(data.dateRange.start, `Period ${p} must have start date`);
      assert.ok(data.dateRange.end, `Period ${p} must have end date`);
    }

    // Custom Date Range
    const customRes = await fetch(`${API_BASE}/ledger/reports?period=custom&dateFrom=2026-09-05&dateTo=2026-09-15`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(customRes.status, 200);
    const customData = await customRes.json();
    assert.equal(customData.period, 'custom');
    assert.equal(customData.dateRange.start, '2026-09-05');
    assert.equal(customData.dateRange.end, '2026-09-15');
  });

  await t.test('4. Backend category and type filters execute on server', async () => {
    const res = await fetch(`${API_BASE}/ledger/reports?period=monthly&category=Food%20Delivery`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.summary.totalExpenses > 0);
    assert.ok(data.allTransactions.every((t) => t.category === 'Food Delivery'), 'All returned transactions must belong to Food Delivery');
  });

  await t.test('5. PDF export endpoint streams valid PDF document', async () => {
    const res = await fetch(`${API_BASE}/ledger/reports/export?format=pdf&period=monthly`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    const disposition = res.headers.get('content-disposition');
    assert.ok(disposition.includes('attachment; filename='), 'Must have attachment disposition');
    assert.ok(disposition.includes('.pdf'), 'Filename must end with .pdf');

    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 1000, 'PDF buffer should be substantial');
    assert.equal(buf.slice(0, 4).toString(), '%PDF', 'Must start with %PDF magic header');
  });

  await t.test('6. Excel export endpoint streams valid multi-sheet XLSX workbook', async () => {
    const res = await fetch(`${API_BASE}/ledger/reports/export?format=xlsx&period=monthly`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const disposition = res.headers.get('content-disposition');
    assert.ok(disposition.includes('.xlsx'), 'Filename must end with .xlsx');

    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 5000, 'XLSX buffer should be substantial');
    assert.equal(buf.slice(0, 2).toString(), 'PK', 'Must start with PK zip header');
  });

  await t.test('7. CSV export endpoint streams UTF-8 CSV with BOM and transaction line items', async () => {
    const res = await fetch(`${API_BASE}/ledger/reports/export?format=csv&period=monthly`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/csv'));
    const csv = await res.text();

    assert.ok(csv.startsWith('# KEPWE LEDGER FINANCIAL REPORT') || csv.startsWith('\uFEFF# KEPWE LEDGER FINANCIAL REPORT'), 'Must start with title');
    assert.ok(csv.includes('Date,Description,Merchant,Type,Category'), 'Must contain header columns');
    assert.ok(csv.includes('Swiggy'), 'Must contain line item transactions');
    assert.ok(csv.includes('Total Income'), 'Must contain financial summary block');
  });

  await t.test('8. Strict User Isolation: User B cannot access User A financial data or exports', async () => {
    const resB = await fetch(`${API_BASE}/ledger/reports?period=monthly`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(resB.status, 200);
    const dataB = await resB.json();

    // User B must NOT have User A's transactions or salary
    assert.equal(dataB.summary.totalExpenses, 0);
    assert.equal(dataB.allTransactions.length, 0);

    const csvResB = await fetch(`${API_BASE}/ledger/reports/export?format=csv&period=monthly`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const csvB = await csvResB.text();
    assert.equal(csvB.includes('Swiggy'), false);
    assert.equal(csvB.includes('Amazon India'), false);
  });

  await t.test('9. Unauthorized access is blocked with 401', async () => {
    const unauth = await fetch(`${API_BASE}/ledger/reports?period=monthly`);
    assert.equal(unauth.status, 401);

    const unauthExport = await fetch(`${API_BASE}/ledger/reports/export?format=pdf`);
    assert.equal(unauthExport.status, 401);
  });
});
