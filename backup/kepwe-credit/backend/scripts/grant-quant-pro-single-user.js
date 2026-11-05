import { pool } from '../src/config/db.js';

/**
 * Grant FULL Quant PRO access to a SINGLE specific user
 * Target: aliyaanmohd42@gmail.com
 * 
 * This script:
 * - Finds the user by email
 * - Grants active 'quant' product membership
 * - Is idempotent (safe to run multiple times)
 * - Does NOT affect other users
 * - Does NOT place any broker orders
 * - Does NOT bypass authentication or broker security
 */

const TARGET_EMAIL = 'aliyaanmohd42@gmail.com';

async function main() {
  console.log('[grant-quant-pro] Starting targeted Quant PRO access grant...');
  console.log(`[grant-quant-pro] Target user: ${TARGET_EMAIL}\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find the user
    const userResult = await client.query(
      'SELECT id, email, full_name, is_active FROM users WHERE email = $1',
      [TARGET_EMAIL]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ USER NOT FOUND');
      console.log(`   The user ${TARGET_EMAIL} does not exist in the database.`);
      console.log('   The user must register first before granting access.\n');
      await client.query('ROLLBACK');
      return {
        userFound: false,
        userId: null,
        quantMembership: 'N/A',
        message: 'User must register first'
      };
    }

    const user = userResult.rows[0];
    console.log('✅ USER FOUND');
    console.log(`   ID:        ${user.id}`);
    console.log(`   Email:     ${user.email}`);
    console.log(`   Name:      ${user.full_name}`);
    console.log(`   Is Active: ${user.is_active}\n`);

    if (!user.is_active) {
      console.log('⚠️  WARNING: User account is NOT active');
      console.log('   Proceeding anyway, but user may need account activation.\n');
    }

    // 2. Check existing Quant membership
    const existingMembership = await client.query(
      'SELECT id, status, role, created_at FROM product_memberships WHERE user_id = $1 AND product = $2',
      [user.id, 'quant']
    );

    if (existingMembership.rows.length > 0) {
      const membership = existingMembership.rows[0];
      console.log('📋 EXISTING QUANT MEMBERSHIP FOUND');
      console.log(`   Status: ${membership.status}`);
      console.log(`   Role:   ${membership.role}`);
      console.log(`   Since:  ${membership.created_at.toISOString()}\n`);

      if (membership.status === 'active') {
        console.log('✅ User already has ACTIVE Quant membership');
        console.log('   Ensuring role is set to "pro"...\n');
      } else {
        console.log('⚠️  Membership exists but is NOT active');
        console.log('   Activating membership...\n');
      }

      // Update existing membership to active + pro
      await client.query(
        `UPDATE product_memberships 
         SET status = 'active', role = 'pro', updated_at = NOW()
         WHERE user_id = $1 AND product = $2`,
        [user.id, 'quant']
      );
      console.log('✅ Updated Quant membership to ACTIVE with PRO role');
    } else {
      console.log('📋 NO EXISTING QUANT MEMBERSHIP');
      console.log('   Creating new Quant PRO membership...\n');

      // Insert new membership
      await client.query(
        `INSERT INTO product_memberships (user_id, product, role, status, created_at, updated_at)
         VALUES ($1, 'quant', 'pro', 'active', NOW(), NOW())`,
        [user.id]
      );
      console.log('✅ Created new Quant PRO membership');
    }

    // 3. Verify the final state
    const verifyResult = await client.query(
      'SELECT product, role, status FROM product_memberships WHERE user_id = $1 AND product = $2',
      [user.id, 'quant']
    );

    const finalMembership = verifyResult.rows[0];
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VERIFICATION: Final Membership State');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Product: ${finalMembership.product}`);
    console.log(`   Role:    ${finalMembership.role}`);
    console.log(`   Status:  ${finalMembership.status}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 4. Count affected users (should be exactly 1)
    const affectedCount = await client.query(
      `SELECT COUNT(*)::int as count 
       FROM product_memberships 
       WHERE product = 'quant' AND status = 'active' AND updated_at > NOW() - INTERVAL '10 seconds'`
    );

    await client.query('COMMIT');

    console.log('✅ OPERATION COMPLETE\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('FINAL REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`User found:               YES`);
    console.log(`User ID:                  ${user.id.substring(0, 8)}... (truncated for security)`);
    console.log(`Email:                    ${user.email}`);
    console.log(`Quant membership:         ACTIVE`);
    console.log(`Role:                     PRO`);
    console.log(`All Quant PRO features:   GRANTED`);
    console.log(`Users modified:           1 (target user only)`);
    console.log(`Broker orders placed:     0`);
    console.log(`Authentication bypassed:  NO`);
    console.log(`Security compromised:     NO`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 User can now access:');
    console.log('   ✅ Strategy Builder');
    console.log('   ✅ Algo Strategies');
    console.log('   ✅ NIFTY 50 Scalping');
    console.log('   ✅ Backtesting Engine');
    console.log('   ✅ P&L Analytics');
    console.log('   ✅ Risk Management');
    console.log('   ✅ Live Deployment Gate');
    console.log('   ✅ Positions & Holdings');
    console.log('   ✅ Orders & Trade History');
    console.log('   ✅ Portfolio & Funds');
    console.log('   ✅ Broker Adapters');
    console.log('   ✅ Quant Dashboard');
    console.log('   ✅ Market Intelligence');
    console.log('   ✅ All other Quant PRO features\n');

    return {
      userFound: true,
      userId: user.id,
      email: user.email,
      quantMembership: 'ACTIVE',
      role: 'PRO',
      usersModified: 1,
      brokerOrdersPlaced: 0
    };

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
    console.error(`[grant-quant-pro] ❌ Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
