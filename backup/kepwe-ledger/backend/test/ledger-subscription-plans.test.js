import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.KEPWE_PGLITE_TEST = 'true';
process.env.PGLITE_DATA_DIR = join(tmpdir(), `kepwe-ledger-plans-${Date.now()}`);

const { getPglite } = await import('../src/config/db.js');
const db = await getPglite();
const ledgerService = await import('../src/services/ledger.service.js');
const goalsService = await import('../src/services/goals.service.js');
const subscriptionService = await import('../src/services/ledger-subscription.service.js');

try {
  const result = await db.query(
    `SELECT plan_code, billing_period, price_inr, features, limits
     FROM ledger_plans ORDER BY display_order, billing_period`
  );
  const plans = result.rows;

  assert.deepEqual(
    plans.map(({ plan_code, billing_period, price_inr }) => [plan_code, billing_period, Number(price_inr)]),
    [
      ['FREE', 'monthly', 0],
      ['PRO', 'monthly', 149],
      ['PRO', 'yearly', 1499],
      ['PRO_PLUS', 'monthly', 299],
      ['PRO_PLUS', 'yearly', 2999],
    ]
  );

  const free = plans.find((plan) => plan.plan_code === 'FREE');
  assert.equal(free.limits.bank_accounts, 2);
  assert.equal(free.limits.savings_goals, 3);
  assert.equal(free.limits.ai_insights_monthly, 50);
  assert.equal(free.limits.history_months, 6);
  assert.equal(free.features.basic_ai_expense_analysis, true);
  assert.equal(free.features.ai_personal_cfo, false);

  const pro = plans.find((plan) => plan.plan_code === 'PRO');
  assert.equal(pro.limits.bank_accounts, -1);
  assert.equal(pro.limits.ai_insights_monthly, -1);
  assert.equal(pro.limits.history_months, 24);
  assert.equal(pro.features.report_export, true);
  assert.equal(pro.features.advanced_ai_cfo, false);

  const proPlus = plans.find((plan) => plan.plan_code === 'PRO_PLUS');
  assert.equal(proPlus.limits.history_months, -1);
  assert.equal(proPlus.features.advanced_ai_cfo, true);
  assert.equal(proPlus.features.priority_support, true);
  assert.deepEqual(
    plans.find((plan) => plan.plan_code === 'PRO' && plan.billing_period === 'yearly').features,
    pro.features
  );
  assert.deepEqual(
    plans.find((plan) => plan.plan_code === 'PRO_PLUS' && plan.billing_period === 'yearly').limits,
    proPlus.limits
  );

  const userResult = await db.query(
    `INSERT INTO users (email, password_hash, role, full_name)
     VALUES ($1, 'test-hash', 'customer', 'Ledger Plan Test') RETURNING id`,
    [`ledger-plan-${Date.now()}@test.invalid`]
  );
  const userId = userResult.rows[0].id;
  const subscription = await subscriptionService.getLedgerSubscription(userId);
  assert.equal(subscription.plan_code, 'FREE');
  assert.equal(subscription.status, 'active');

  await ledgerService.createAccount(userId, { name: 'Bank 1', type: 'Bank Account' });
  await ledgerService.createAccount(userId, { name: 'Bank 2', type: 'Bank Account' });
  await assert.rejects(
    ledgerService.createAccount(userId, { name: 'Bank 3', type: 'Bank Account' }),
    (error) => error.code === 'LEDGER_PLAN_LIMIT_REACHED' && error.statusCode === 403
  );
  await ledgerService.createAccount(userId, { name: 'Cash', type: 'Cash' });

  for (let index = 0; index < 3; index += 1) {
    await goalsService.createGoal(userId, { name: `Goal ${index + 1}`, targetAmount: 1000 });
  }
  await assert.rejects(
    goalsService.createGoal(userId, { name: 'Goal 4', targetAmount: 1000 }),
    (error) => error.code === 'LEDGER_PLAN_LIMIT_REACHED' && error.statusCode === 403
  );

  let finalUsage;
  for (let index = 0; index < 50; index += 1) {
    finalUsage = await subscriptionService.consumeLedgerAiInsight(userId);
    assert.equal(finalUsage.allowed, true);
  }
  assert.equal(finalUsage.remaining, 0);
  assert.deepEqual(await subscriptionService.consumeLedgerAiInsight(userId), { allowed: false, remaining: 0 });

  assert.equal(
    subscriptionService.ledgerSubscriptionInternals.checkoutSignatureValid('order_test', 'payment_test', 'invalid'),
    false
  );
  const configuredWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  await assert.rejects(
    subscriptionService.handleLedgerRazorpayWebhook(Buffer.from('{}'), {}, 'invalid', 'event_test'),
    /RAZORPAY_WEBHOOK_SECRET is not configured/
  );
  if (configuredWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = configuredWebhookSecret;

  console.log('Ledger catalog, Free-plan enforcement, and payment rejection checks passed.');
} finally {
  await db.close();
}