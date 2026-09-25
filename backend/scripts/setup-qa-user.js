import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

async function setupQaUsers() {
  console.log('[setup-qa-user] Setting up QA users in PostgreSQL...');

  const passHash = await bcrypt.hash('KepweQA@2026', 10);

  // User 1: Primary QA User
  const u1 = await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active)
     VALUES ('11111111-1111-4111-8111-111111111111', 'qa@kepwe.in', $1, 'Harshad Mehta', TRUE, TRUE)
     ON CONFLICT (id) DO UPDATE SET password_hash = $1, is_active = TRUE, email_verified = TRUE, full_name = 'Harshad Mehta'
     RETURNING id, email, full_name`,
    [passHash]
  );
  console.log('[setup-qa-user] User 1 ready:', u1.rows[0]?.email);

  // User 2: Second User for Isolation Testing
  const u2 = await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active)
     VALUES ('22222222-2222-4222-8222-222222222222', 'qa2@kepwe.in', $1, 'Second QA User', TRUE, TRUE)
     ON CONFLICT (id) DO UPDATE SET password_hash = $1, is_active = TRUE, email_verified = TRUE, full_name = 'Second QA User'
     RETURNING id, email, full_name`,
    [passHash]
  );
  console.log('[setup-qa-user] User 2 ready:', u2.rows[0]?.email);

  // Ensure 'ledger' product membership exists for both
  await pool.query(
    `INSERT INTO product_memberships (user_id, product, role, status)
     VALUES ('11111111-1111-4111-8111-111111111111', 'ledger', 'member', 'active')
     ON CONFLICT (user_id, product) DO UPDATE SET status = 'active'`
  );
  await pool.query(
    `INSERT INTO product_memberships (user_id, product, role, status)
     VALUES ('22222222-2222-4222-8222-222222222222', 'ledger', 'member', 'active')
     ON CONFLICT (user_id, product) DO UPDATE SET status = 'active'`
  );

  console.log('[setup-qa-user] QA setup complete.');
}

setupQaUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[setup-qa-user] Error:', err);
    process.exit(1);
  });
