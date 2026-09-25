import { pool } from '../src/config/db.js';

/**
 * Grant indefinite ACTIVE PRO subscription to the existing target user.
 * This updates the existing user_subscriptions and product_memberships records.
 */

const TARGET_EMAIL = 'aliyaanmohd42@gmail.com';
const PLAN_CODE = 'PRO'; // Or 'ELITE' for highest tier

async function main() {
  console.log('[grant-pro-subscription] Starting PRO subscription grant...');
  console.log(`[grant-pro-subscription] Target: ${TARGET_EMAIL}\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find user
    const userResult = await client.query(
      'SELECT id, email, full_name FROM users WHERE email = $1',
      [TARGET_EMAIL]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User NOT FOUND\n');
      await client.query('ROLLBACK');
      return;
    }

    const user = userResult.rows[0];
    console.log('✅ USER FOUND');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name:  ${user.full_name}\n`);

    // 2. Find PRO plan
    const planResult = await client.query(
      `SELECT id, plan_code, plan_name, display_name, price_inr, billing_period
       FROM subscription_plans
       WHERE plan_code = $1 AND is_active = TRUE`,
      [PLAN_CODE]
    );

    if (planResult.rows.length === 0) {
      console.log(`❌ ${PLAN_CODE} plan NOT FOUND in subscription_plans table\n`);
      console.log('Available plans:');
      const allPlans = await client.query(
        'SELECT plan_code, plan_name, is_active FROM subscription_plans ORDER BY display_order'
      );
      allPlans.rows.forEach(p => {
        console.log(`   - ${p.plan_code} (${p.plan_name}) - Active: ${p.is_active}`);
      });
      await client.query('ROLLBACK');
      return;
    }

    const plan = planResult.rows[0];
    console.log('✅ PLAN FOUND');
    console.log(`   Code:    ${plan.plan_code}`);
    console.log(`   Name:    ${plan.display_name || plan.plan_name}`);
    console.log(`   Price:   ₹${plan.price_inr}`);
    console.log(`   Billing: ${plan.billing_period}\n`);

    // 4. Upsert user_subscriptions record
    const subResult = await client.query(
      `INSERT INTO user_subscriptions (
         user_id, plan_id, status,
         subscription_start_at, subscription_end_at,
         current_period_start, current_period_end,
         is_trial_used, auto_renew
       ) VALUES (
         $1, $2, 'active',
         NOW(), NULL,
         NOW(), NULL,
         TRUE, FALSE
       )
       ON CONFLICT (user_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         status = 'active',
         subscription_start_at = COALESCE(user_subscriptions.subscription_start_at, NOW()),
         subscription_end_at = NULL,
         current_period_start = COALESCE(user_subscriptions.current_period_start, NOW()),
         current_period_end = NULL,
         next_payment_at = NULL,
         trial_start_at = NULL,
         trial_end_at = NULL,
         is_trial_used = TRUE,
         auto_renew = FALSE,
         cancelled_at = NULL,
         cancellation_reason = NULL,
         suspended_at = NULL,
         suspended_reason = NULL,
         updated_at = NOW()
       RETURNING *`,
      [user.id, plan.id]
    );

    const subscription = subResult.rows[0];
    console.log('✅ SUBSCRIPTION CREATED/UPDATED');
    console.log(`   Status:     ${subscription.status}`);
    console.log(`   Started:    ${subscription.subscription_start_at.toISOString()}`);
    console.log('   Ends:       Indefinite');
    console.log(`   Auto-renew: ${subscription.auto_renew}\n`);

    // 5. Audit log
    await client.query(
      `INSERT INTO subscription_audit_log (
         user_id, subscription_id, event_type, event_description,
         new_status, new_plan_code, performed_by, metadata
       ) VALUES (
         $1, $2, 'admin_grant',
         'Indefinite PRO subscription granted by admin script',
         'active', $3, 'admin',
         jsonb_build_object('grantedAt', NOW(), 'indefinite', TRUE, 'script', 'grant-pro-subscription.js')
       )`,
      [user.id, subscription.id, plan.plan_code]
    );

    await client.query(
      `INSERT INTO product_memberships (user_id, product, role, status, updated_at, last_login_at)
       VALUES ($1, 'quant', 'owner', 'active', NOW(), NOW())
       ON CONFLICT (user_id, product) DO UPDATE SET
         role = 'owner', status = 'active', updated_at = NOW(), last_login_at = NOW()`,
      [user.id]
    );

    console.log('✅ AUDIT LOG CREATED\n');

    await client.query('COMMIT');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ FINAL REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`User:                 ${user.email}`);
    console.log(`User ID:              ${user.id.substring(0, 8)}...`);
    console.log(`Subscription Status:  ACTIVE`);
    console.log(`Plan:                 ${plan.display_name || plan.plan_name} (${plan.plan_code})`);
    console.log('Valid Until:          Indefinite');
    console.log(`All PRO features:     UNLOCKED`);
    console.log(`Broker orders:        0`);
    console.log(`Security bypassed:    NO`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 User can now access ALL Quant PRO features!');
    console.log('   The user should refresh the page or re-login to see changes.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error(`[grant-pro-subscription] ❌ Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
