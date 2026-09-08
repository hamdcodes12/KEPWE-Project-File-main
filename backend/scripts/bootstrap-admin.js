import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const enabled = process.env.ADMIN_BOOTSTRAP_ENABLED === 'true';
const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const resetPassword = process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD === 'true';

async function main() {
  if (!enabled) {
    console.log('[admin-bootstrap] Skipped (ADMIN_BOOTSTRAP_ENABLED is not true).');
    return;
  }

  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD are required when admin bootstrap is enabled');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await pool.query('SELECT id FROM admin_users WHERE username = $1', [username]);

  if (existing.rows.length === 0) {
    await pool.query(
      `INSERT INTO admin_users (username, password_hash, display_name, role, is_active)
       VALUES ($1, $2, $3, 'super_admin', TRUE)`,
      [username, passwordHash, process.env.ADMIN_DISPLAY_NAME?.trim() || 'KEPWE Administrator']
    );
    console.log(`[admin-bootstrap] Created admin account '${username}'.`);
    return;
  }

  if (resetPassword) {
    await pool.query(
      `UPDATE admin_users
       SET password_hash = $1, is_active = TRUE, updated_at = NOW()
       WHERE username = $2`,
      [passwordHash, username]
    );
    console.log(`[admin-bootstrap] Reset password for admin account '${username}'.`);
  } else {
    console.log(`[admin-bootstrap] Admin account '${username}' already exists; password unchanged.`);
  }
}

main()
  .catch((err) => {
    console.error(`[admin-bootstrap] Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
});
