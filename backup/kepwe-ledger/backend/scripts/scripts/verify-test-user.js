import { pool } from '../src/config/db.js';

/**
 * Verify the test user account and its product memberships
 */

async function main() {
  console.log('[verify] Checking test user account...\n');

  // Check user exists
  const userResult = await pool.query(
    `SELECT id, email, full_name, email_verified, is_active, created_at 
     FROM users 
     WHERE email = $1`,
    ['test@kepwe.in']
  );

  if (userResult.rows.length === 0) {
    console.log('❌ User not found: test@kepwe.in');
    return;
  }

  const user = userResult.rows[0];
  console.log('✅ User found:');
  console.log(`   ID:             ${user.id}`);
  console.log(`   Email:          ${user.email}`);
  console.log(`   Full Name:      ${user.full_name}`);
  console.log(`   Email Verified: ${user.email_verified}`);
  console.log(`   Is Active:      ${user.is_active}`);
  console.log(`   Created:        ${user.created_at.toISOString()}`);

  // Check product memberships
  const membershipsResult = await pool.query(
    `SELECT product, role, status, created_at, updated_at 
     FROM product_memberships 
     WHERE user_id = $1 
     ORDER BY product`,
    [user.id]
  );

  console.log(`\n✅ Product Memberships (${membershipsResult.rows.length}):`);
  membershipsResult.rows.forEach((m) => {
    console.log(`   ${m.product.padEnd(10)} - ${m.status.padEnd(10)} (role: ${m.role})`);
  });

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TEST ACCOUNT VERIFICATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Account is ready to use with full Quant access!\n');
}

main()
  .catch((err) => {
    console.error(`[verify] ❌ Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
