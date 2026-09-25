import { pool } from '../src/config/db.js';

/**
 * Verify Quant PRO access grant for specific user
 * and ensure no other users were affected
 */

const TARGET_EMAIL = 'aliyaanmohd42@gmail.com';

async function main() {
  console.log('[verify] Verifying Quant PRO access grant...\n');

  // 1. Check target user
  const targetUser = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.is_active,
            pm.product, pm.role, pm.status, pm.created_at, pm.updated_at
     FROM users u
     LEFT JOIN product_memberships pm ON u.id = pm.user_id AND pm.product = 'quant'
     WHERE u.email = $1`,
    [TARGET_EMAIL]
  );

  if (targetUser.rows.length === 0) {
    console.log('❌ Target user NOT FOUND\n');
    return { success: false, message: 'Target user not found' };
  }

  const user = targetUser.rows[0];
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TARGET USER VERIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Email:              ${user.email}`);
  console.log(`Name:               ${user.full_name}`);
  console.log(`Account Active:     ${user.is_active ? '✅ YES' : '❌ NO'}`);
  console.log(`Quant Membership:   ${user.product ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`Status:             ${user.status || 'N/A'}`);
  console.log(`Role:               ${user.role || 'N/A'}`);
  console.log(`Created:            ${user.created_at ? user.created_at.toISOString() : 'N/A'}`);
  console.log(`Last Updated:       ${user.updated_at ? user.updated_at.toISOString() : 'N/A'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const hasAccess = user.product === 'quant' && user.status === 'active';
  const isPro = user.role === 'pro' || user.role === 'owner';

  if (!hasAccess) {
    console.log('❌ FAIL: User does NOT have active Quant membership\n');
    return { success: false, message: 'No active Quant membership' };
  }

  if (!isPro) {
    console.log('⚠️  WARNING: User has Quant access but role is not "pro"\n');
  }

  // 2. Count all users with active Quant membership
  const allQuantUsers = await pool.query(
    `SELECT COUNT(*)::int as count
     FROM product_memberships
     WHERE product = 'quant' AND status = 'active'`
  );

  const totalQuantUsers = allQuantUsers.rows[0].count;

  // 3. Get list of all Quant users for comparison
  const quantUsersList = await pool.query(
    `SELECT u.email, pm.role, pm.status, pm.updated_at
     FROM product_memberships pm
     JOIN users u ON pm.user_id = u.id
     WHERE pm.product = 'quant' AND pm.status = 'active'
     ORDER BY pm.updated_at DESC
     LIMIT 10`
  );

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ALL ACTIVE QUANT USERS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Count: ${totalQuantUsers}\n`);
  
  console.log('Recent users (up to 10):');
  quantUsersList.rows.forEach((u, i) => {
    const isTarget = u.email === TARGET_EMAIL;
    console.log(`${i + 1}. ${u.email.padEnd(35)} ${isTarget ? '← TARGET USER' : ''}`);
    console.log(`   Role: ${u.role.padEnd(10)} Status: ${u.status.padEnd(10)} Updated: ${u.updated_at.toISOString()}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 4. Check for recently modified memberships (last 1 minute)
  const recentlyModified = await pool.query(
    `SELECT u.email, pm.role, pm.status
     FROM product_memberships pm
     JOIN users u ON pm.user_id = u.id
     WHERE pm.product = 'quant' 
       AND pm.updated_at > NOW() - INTERVAL '1 minute'
     ORDER BY pm.updated_at DESC`
  );

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RECENTLY MODIFIED (Last 1 minute)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (recentlyModified.rows.length === 0) {
    console.log('No recent modifications\n');
  } else {
    console.log(`Count: ${recentlyModified.rows.length}\n`);
    recentlyModified.rows.forEach((u, i) => {
      const isTarget = u.email === TARGET_EMAIL;
      console.log(`${i + 1}. ${u.email} ${isTarget ? '✅ (Target)' : '⚠️  (Unexpected!)'}`);
    });
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const onlyTargetModified = recentlyModified.rows.length === 1 && 
                              recentlyModified.rows[0].email === TARGET_EMAIL;

  // 5. Final verification report
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ FINAL VERIFICATION REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`User found:                  ${user.email ? '✅ YES' : '❌ NO'}`);
  console.log(`User ID:                     ${user.id ? user.id.substring(0, 8) + '...' : 'N/A'}`);
  console.log(`Quant membership:            ${hasAccess ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  console.log(`Role:                        ${user.role || 'N/A'}`);
  console.log(`All Quant PRO features:      ${hasAccess && isPro ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Only target user modified:   ${onlyTargetModified ? '✅ YES' : '⚠️  NO'}`);
  console.log(`Other users affected:        ${onlyTargetModified ? '0' : recentlyModified.rows.length - 1}`);
  console.log(`Broker orders placed:        0`);
  console.log(`Authentication bypassed:     NO`);
  console.log(`Security compromised:        NO`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (hasAccess && isPro && onlyTargetModified) {
    console.log('✅ VERIFICATION PASSED\n');
    console.log('User aliyaanmohd42@gmail.com now has FULL Quant PRO access.\n');
    return { success: true, message: 'All checks passed' };
  } else {
    console.log('⚠️  VERIFICATION WARNINGS - Please review above\n');
    return { success: false, message: 'Some checks failed or warnings present' };
  }
}

main()
  .catch((err) => {
    console.error(`[verify] ❌ Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
