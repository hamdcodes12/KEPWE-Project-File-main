import { pool } from '../config/db.js';
import { assertLedgerLimit } from './ledger-subscription.service.js';

const query = (text, params) => pool.query(text, params);

/**
 * Helper: Round currency to 2 decimal places
 */
function roundMoney(val) {
  const num = Number(val) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate goal intelligence attributes (progress, required contribution, projected date, shortfall)
 */
function enrichGoal(goal) {
  const target = Number(goal.target_amount) || 0;
  const current = Number(goal.current_amount) || 0;
  const shortfall = Math.max(0, target - current);
  const progressPct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  let remainingMonths = null;
  let requiredMonthlyContribution = 0;
  let projectedCompletionDate = null;
  let isOnTrack = true;

  if (goal.target_date) {
    const now = new Date();
    const targetDate = new Date(goal.target_date);
    const diffMonths = (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth());
    remainingMonths = Math.max(1, diffMonths);

    if (shortfall > 0 && remainingMonths > 0) {
      requiredMonthlyContribution = roundMoney(shortfall / remainingMonths);
    }
  }

  const monthlyContribution = Number(goal.monthly_contribution) || 0;

  if (shortfall > 0 && monthlyContribution > 0) {
    const monthsToComplete = Math.ceil(shortfall / monthlyContribution);
    const projDate = new Date();
    projDate.setDate(projDate.getDate() + monthsToComplete * 30);
    projectedCompletionDate = projDate.toISOString().slice(0, 10);

    if (requiredMonthlyContribution > 0 && monthlyContribution < requiredMonthlyContribution * 0.9) {
      isOnTrack = false;
    }
  } else if (shortfall === 0) {
    isOnTrack = true;
    projectedCompletionDate = new Date().toISOString().slice(0, 10);
  }

  return {
    id: goal.id,
    userId: goal.user_id,
    name: goal.name,
    type: goal.type,
    category: goal.category || goal.type,
    targetAmount: target,
    currentAmount: current,
    shortfall,
    progressPct,
    targetDate: goal.target_date ? String(goal.target_date).slice(0, 10) : null,
    remainingMonths,
    monthlyContribution,
    requiredMonthlyContribution,
    projectedCompletionDate,
    isOnTrack,
    priority: goal.priority || 'medium',
    status: current >= target ? 'completed' : (goal.status || 'in_progress'),
    color: goal.color || '#214ECF',
    icon: goal.icon || 'Target',
    notes: goal.notes || '',
    createdAt: goal.created_at,
    updatedAt: goal.updated_at
  };
}

/**
 * 1. Get all goals for a user with overview metrics
 */
export async function getUserGoals(userId) {
  const res = await query(
    `SELECT * FROM ledger_goals WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  const goals = (res.rows || []).map(enrichGoal);

  const totalTargetAmount = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrentAmount = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalShortfall = goals.reduce((sum, g) => sum + g.shortfall, 0);
  const totalMonthlyCommitment = goals
    .filter(g => g.status !== 'completed')
    .reduce((sum, g) => sum + g.monthlyContribution, 0);

  const overallProgressPct = totalTargetAmount > 0
    ? Math.min(100, Math.round((totalCurrentAmount / totalTargetAmount) * 100))
    : 0;

  const completedGoalsCount = goals.filter(g => g.status === 'completed' || g.progressPct >= 100).length;
  const activeGoalsCount = goals.filter(g => g.status !== 'completed' && g.progressPct < 100).length;

  return {
    goals,
    metrics: {
      totalGoals: goals.length,
      activeGoalsCount,
      completedGoalsCount,
      totalTargetAmount,
      totalCurrentAmount,
      totalShortfall,
      overallProgressPct,
      totalMonthlyCommitment
    }
  };
}

/**
 * 2. Create a new savings goal
 */
export async function createGoal(userId, data) {
  const {
    name,
    type = 'Other',
    category,
    targetAmount,
    currentAmount = 0,
    targetDate = null,
    monthlyContribution = 0,
    priority = 'medium',
    color = '#214ECF',
    icon = 'Target',
    notes = ''
  } = data;

  const target = Number(targetAmount);
  if (!target || target <= 0) {
    throw new Error('Target amount must be a positive number greater than 0.');
  }

  const current = Number(currentAmount) || 0;
  if (current < 0) {
    throw new Error('Current amount cannot be negative.');
  }

  let finalMonthlyContribution = Number(monthlyContribution) || 0;
  if (finalMonthlyContribution === 0 && targetDate) {
    const now = new Date();
    const tDate = new Date(targetDate);
    const diffMonths = (tDate.getFullYear() - now.getFullYear()) * 12 + (tDate.getMonth() - now.getMonth());
    const months = Math.max(1, diffMonths);
    finalMonthlyContribution = roundMoney(Math.max(0, target - current) / months);
  }

  const status = current >= target ? 'completed' : 'in_progress';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const count = await client.query(
      'SELECT COUNT(*)::int AS count FROM ledger_goals WHERE user_id = $1',
      [userId]
    );
    await assertLedgerLimit(userId, 'savings_goals', count.rows[0].count, client);

    const res = await client.query(
      `INSERT INTO ledger_goals (
         user_id, name, type, category, target_amount, current_amount,
         target_date, monthly_contribution, priority, status, color, icon, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userId,
        name.trim(),
        type,
        category || type,
        target,
        current,
        targetDate || null,
        finalMonthlyContribution,
        priority,
        status,
        color,
        icon,
        notes
      ]
    );
    await client.query('COMMIT');
    return enrichGoal(res.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 3. Update an existing goal
 */
export async function updateGoal(userId, goalId, data) {
  // Check ownership
  const existing = await query(
    `SELECT * FROM ledger_goals WHERE id = $1 AND user_id = $2`,
    [goalId, userId]
  );

  if (!existing.rows.length) {
    throw new Error('Savings goal not found or unauthorized.');
  }

  const prev = existing.rows[0];

  const name = data.name !== undefined ? data.name.trim() : prev.name;
  const type = data.type !== undefined ? data.type : prev.type;
  const category = data.category !== undefined ? data.category : prev.category;
  const targetAmount = data.targetAmount !== undefined ? Number(data.targetAmount) : Number(prev.target_amount);
  const currentAmount = data.currentAmount !== undefined ? Number(data.currentAmount) : Number(prev.current_amount);
  const targetDate = data.targetDate !== undefined ? data.targetDate : prev.target_date;
  const monthlyContribution = data.monthlyContribution !== undefined ? Number(data.monthlyContribution) : Number(prev.monthly_contribution);
  const priority = data.priority !== undefined ? data.priority : prev.priority;
  const color = data.color !== undefined ? data.color : prev.color;
  const icon = data.icon !== undefined ? data.icon : prev.icon;
  const notes = data.notes !== undefined ? data.notes : prev.notes;

  const status = currentAmount >= targetAmount ? 'completed' : (data.status || prev.status || 'in_progress');

  const res = await query(
    `UPDATE ledger_goals SET
       name = $1,
       type = $2,
       category = $3,
       target_amount = $4,
       current_amount = $5,
       target_date = $6,
       monthly_contribution = $7,
       priority = $8,
       status = $9,
       color = $10,
       icon = $11,
       notes = $12,
       updated_at = NOW()
     WHERE id = $13 AND user_id = $14
     RETURNING *`,
    [
      name,
      type,
      category,
      targetAmount,
      currentAmount,
      targetDate || null,
      monthlyContribution,
      priority,
      status,
      color,
      icon,
      notes,
      goalId,
      userId
    ]
  );

  return enrichGoal(res.rows[0]);
}

/**
 * 4. Delete a goal
 */
export async function deleteGoal(userId, goalId) {
  const res = await query(
    `DELETE FROM ledger_goals WHERE id = $1 AND user_id = $2 RETURNING id`,
    [goalId, userId]
  );

  if (!res.rows.length) {
    throw new Error('Savings goal not found or unauthorized.');
  }

  return { success: true, deletedId: goalId };
}

/**
 * 5. Contribute amount to a goal
 */
export async function contributeToGoal(userId, goalId, contributionAmount) {
  const amt = Number(contributionAmount);
  if (!amt || amt <= 0) {
    throw new Error('Contribution amount must be greater than 0.');
  }

  const existing = await query(
    `SELECT * FROM ledger_goals WHERE id = $1 AND user_id = $2`,
    [goalId, userId]
  );

  if (!existing.rows.length) {
    throw new Error('Savings goal not found or unauthorized.');
  }

  const goal = existing.rows[0];
  const newCurrent = Number(goal.current_amount) + amt;
  const status = newCurrent >= Number(goal.target_amount) ? 'completed' : goal.status;

  const res = await query(
    `UPDATE ledger_goals 
     SET current_amount = $1, status = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
    [newCurrent, status, goalId, userId]
  );

  return enrichGoal(res.rows[0]);
}
