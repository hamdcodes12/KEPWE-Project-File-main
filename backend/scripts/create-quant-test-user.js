import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

/**
 * Creates a test user account with full Quant product access
 * Email: test@kepwe.in
 * Password: Kepwe@2024
 */

async function main() {
  const email = 'test@kepwe.in';
  const password = 'Kepwe@2024';
  const fullName = 'Quant Test User';

  console.log('[quant-test-user] Creating test user with full Quant access...');

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Check if user exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  let userId;

  if (existingUser.rows.length === 0) {
    // Create new user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, email_verified, is_active)
       VALUES ($1, $2, $3, TRUE, TRUE)
       RETURNING id`,
      [email, passwordHash, fullName]
    );
    userId = result.rows[0].id;
    console.log(`[quant-test-user] ✓ Created user: ${email} (ID: ${userId})`);
  } else {
    userId = existingUser.rows[0].id;
    // Update password
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, full_name = $2, email_verified = TRUE, is_active = TRUE, updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, fullName, userId]
    );
    console.log(`[quant-test-user] ✓ Updated existing user: ${email} (ID: ${userId})`);
  }

  // Grant 'quant' product membership
  const quantCheck = await pool.query(
    'SELECT id FROM product_memberships WHERE user_id = $1 AND product = $2',
    [userId, 'quant']
  );

  if (quantCheck.rows.length === 0) {
    await pool.query(
      `INSERT INTO product_memberships (user_id, product, role, status, created_at)
       VALUES ($1, 'quant', 'member', 'active', NOW())
       ON CONFLICT (user_id, product) 
       DO UPDATE SET status = 'active', role = 'member', updated_at = NOW()`,
      [userId]
    );
    console.log('[quant-test-user] ✓ Granted quant product membership');
  } else {
    await pool.query(
      `UPDATE product_memberships 
       SET status = 'active', role = 'member', updated_at = NOW()
       WHERE user_id = $1 AND product = $2`,
      [userId, 'quant']
    );
    console.log('[quant-test-user] ✓ Activated quant product membership');
  }

  // Grant 'ledger' product membership (bonus access)
  await pool.query(
    `INSERT INTO product_memberships (user_id, product, role, status, created_at)
     VALUES ($1, 'ledger', 'member', 'active', NOW())
     ON CONFLICT (user_id, product) 
     DO UPDATE SET status = 'active', role = 'member', updated_at = NOW()`,
    [userId]
  );
  console.log('[quant-test-user] ✓ Granted ledger product membership');

  // Grant 'credit' product membership (bonus access)
  await pool.query(
    `INSERT INTO product_memberships (user_id, product, role, status, created_at)
     VALUES ($1, 'credit', 'member', 'active', NOW())
     ON CONFLICT (user_id, product) 
     DO UPDATE SET status = 'active', role = 'member', updated_at = NOW()`,
    [userId]
  );
  console.log('[quant-test-user] ✓ Granted credit product membership');

  console.log('\n[quant-test-user] ✅ Test account ready!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Email:    test@kepwe.in');
  console.log('  Password: Kepwe@2024');
  console.log('  Products: quant, ledger, credit (all active)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((err) => {
    console.error(`[quant-test-user] ❌ Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
