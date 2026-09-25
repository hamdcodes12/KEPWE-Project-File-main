// Diagnostic: reproduce the production 500 by calling registerUser() with
// NODE_ENV=production and NO JWT_SECRET set, exactly as the deployed Render
// service currently is (per user report). Confirms whether the failure is
// in the DB layer (would throw before any row is written) or in the
// JWT-signing step (row already committed, then throws).
process.env.NODE_ENV = 'production';
delete process.env.JWT_SECRET;

import { pool } from '../src/config/db.js';
import { registerUser } from '../src/services/auth.service.js';

const testEmail = `diag-${Date.now()}@example.com`;

try {
  const result = await registerUser(
    { name: 'Diag User', email: testEmail, password: 'DiagPass123' },
    {}
  );
  console.log('UNEXPECTED SUCCESS:', JSON.stringify(result).slice(0, 200));
} catch (err) {
  console.log('registerUser THREW (this is what causes the 500):', err.message);
}

// Check whether the user row was committed to the DB despite the throw.
const check = await pool.query('SELECT id, email FROM users WHERE email = $1', [testEmail]);
console.log('Row exists in DB after throw:', check.rows.length > 0, JSON.stringify(check.rows));

// Clean up the diagnostic row so it doesn't pollute the production DB.
if (check.rows.length > 0) {
  await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);
  console.log('Diagnostic row cleaned up.');
}

await pool.end();
