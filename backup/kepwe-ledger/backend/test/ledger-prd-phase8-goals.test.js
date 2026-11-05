import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import * as goalsService from '../src/services/goals.service.js';

const query = (text, params) => pool.query(text, params);

test('Phase 8 — Comprehensive Savings Goal Engine, Progress Calculations & Isolation', async (t) => {
  const userA = '44444444-4444-4444-8444-444444444444';
  const userB = '55555555-5555-4555-8555-555555555555';

  // Seed users in database
  await query(`
    INSERT INTO users (id, email, password_hash, full_name, role)
    VALUES 
      ('${userA}', 'goal_user_a@kepwe.in', 'hash_test_goal_a', 'Goal User A', 'customer'),
      ('${userB}', 'goal_user_b@kepwe.in', 'hash_test_goal_b', 'Goal User B', 'customer')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Clean existing goals for clean test state
  await query(`DELETE FROM ledger_goals WHERE user_id IN ('${userA}', '${userB}')`);

  let createdGoalId = null;

  await t.test('1. Create Savings Goal with Target Date & Auto-calculated Contribution', async () => {
    // 6 months in future
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 6);
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    const goal = await goalsService.createGoal(userA, {
      name: 'Emergency Fund 6 Months',
      type: 'Emergency Fund',
      targetAmount: 300000.00,
      currentAmount: 60000.00,
      targetDate: targetDateStr,
      priority: 'high',
      notes: '6 months of living expenses reserve'
    });

    try {
      assert.ok(goal.id, 'Goal should have generated UUID');
      createdGoalId = goal.id;
      assert.equal(goal.name, 'Emergency Fund 6 Months');
      assert.equal(goal.targetAmount, 300000);
      assert.equal(goal.currentAmount, 60000);
      assert.equal(goal.shortfall, 240000);
      assert.equal(goal.progressPct, 20); // 60,000 / 300,000 = 20%
      assert.equal(goal.priority, 'high');
      assert.equal(goal.status, 'in_progress');
      assert.ok(goal.requiredMonthlyContribution > 35000 && goal.requiredMonthlyContribution < 45000, `Monthly contribution should be ~40,000: ${goal.requiredMonthlyContribution}`);
    } catch (err) {
      console.error('=== TEST 1 FAILURE DETAILS ===', err);
      throw err;
    }
  });

  await t.test('2. Get User Goals & Overview Metrics Calculation', async () => {
    // Add second goal for User A: Vacation Goal
    await goalsService.createGoal(userA, {
      name: 'Japan Vacation',
      type: 'Vacation',
      targetAmount: 200000.00,
      currentAmount: 100000.00,
      monthlyContribution: 20000.00,
      priority: 'medium'
    });

    const res = await goalsService.getUserGoals(userA);

    assert.equal(res.metrics.totalGoals, 2);
    assert.equal(res.metrics.activeGoalsCount, 2);
    assert.equal(res.metrics.completedGoalsCount, 0);
    assert.equal(res.metrics.totalTargetAmount, 500000); // 300,000 + 200,000
    assert.equal(res.metrics.totalCurrentAmount, 160000); // 60,000 + 100,000
    assert.equal(res.metrics.totalShortfall, 340000); // 500,000 - 160,000
    assert.equal(res.metrics.overallProgressPct, 32); // 160,000 / 500,000 = 32%
  });

  await t.test('3. Contribute to Goal & Verify Progress Recalculation', async () => {
    // Contribute ₹40,000 to Emergency Fund
    const updated = await goalsService.contributeToGoal(userA, createdGoalId, 40000);

    assert.equal(updated.currentAmount, 100000); // 60,000 + 40,000
    assert.equal(updated.shortfall, 200000);
    assert.equal(updated.progressPct, 33); // 100,000 / 300,000 = 33%
    assert.equal(updated.status, 'in_progress');
  });

  await t.test('4. Update Goal & Verify Auto-completion when Target Met', async () => {
    // Update goal current amount to meet target
    const completedGoal = await goalsService.updateGoal(userA, createdGoalId, {
      currentAmount: 300000
    });

    assert.equal(completedGoal.currentAmount, 300000);
    assert.equal(completedGoal.shortfall, 0);
    assert.equal(completedGoal.progressPct, 100);
    assert.equal(completedGoal.status, 'completed');
  });

  await t.test('5. Delete Goal & Confirm PostgreSQL Deletion', async () => {
    const deleteRes = await goalsService.deleteGoal(userA, createdGoalId);
    assert.equal(deleteRes.success, true);

    const check = await query('SELECT * FROM ledger_goals WHERE id = $1', [createdGoalId]);
    assert.equal(check.rows.length, 0, 'Goal row must be deleted from PostgreSQL');
  });

  await t.test('6. User Isolation & Security (User B cannot see or alter User A goals)', async () => {
    // Create goal for User A
    const aGoal = await goalsService.createGoal(userA, {
      name: 'User A Secret Goal',
      targetAmount: 50000,
      currentAmount: 10000
    });

    // User B fetches goals: should not see User A's goal
    const bGoals = await goalsService.getUserGoals(userB);
    assert.equal(bGoals.goals.length, 0);
    assert.equal(bGoals.metrics.totalGoals, 0);

    // User B tries to update User A's goal: must fail
    await assert.rejects(
      async () => {
        await goalsService.updateGoal(userB, aGoal.id, { name: 'Hacked Goal' });
      },
      /not found or unauthorized/
    );

    // User B tries to delete User A's goal: must fail
    await assert.rejects(
      async () => {
        await goalsService.deleteGoal(userB, aGoal.id);
      },
      /not found or unauthorized/
    );
  });

  await t.test('7. Validation & Error Handling', async () => {
    // Zero target amount
    await assert.rejects(
      async () => {
        await goalsService.createGoal(userA, { name: 'Invalid', targetAmount: 0 });
      },
      /Target amount must be a positive number/
    );

    // Negative target amount
    await assert.rejects(
      async () => {
        await goalsService.createGoal(userA, { name: 'Invalid', targetAmount: -1000 });
      },
      /Target amount must be a positive number/
    );

    // Negative current amount
    await assert.rejects(
      async () => {
        await goalsService.createGoal(userA, { name: 'Invalid', targetAmount: 5000, currentAmount: -100 });
      },
      /Current amount cannot be negative/
    );

    // Zero contribution amount
    await assert.rejects(
      async () => {
        await goalsService.contributeToGoal(userA, '00000000-0000-0000-0000-000000000000', 0);
      },
      /Contribution amount must be greater than 0/
    );
  });
});
