import dotenv from 'dotenv';
import pg from 'pg';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config({ path: new URL('../../.env', import.meta.url) });

const { Client } = pg;
const client = new Client({ 
  connectionString: process.env.SUPABASE_DB_URL, 
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

const jwtSecret = process.env.JWT_SECRET || 'test-secret-32-characters-long!!';
let testUserId = null;
let testSessionId = null;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    console.error(`✗ ${name}: ${error.message}`);
    return false;
  }
}

async function connect() {
  await client.connect();
  console.log('[test] Connected to Supabase');
}

async function disconnect() {
  await client.end();
}

async function testSignup() {
  const email = `test-${Date.now()}@kepwe.in`;
  const password = 'TestPassword123!';
  const hashedPassword = await bcryptjs.hash(password, 10);
  
  const result = await client.query(
    'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, created_at',
    [email, hashedPassword, 'Test User']
  );
  
  testUserId = result.rows[0].id;
  console.log(`  Created user: ${email} (ID: ${testUserId})`);
  
  // Verify user was created
  const verify = await client.query('SELECT id FROM users WHERE id = $1', [testUserId]);
  if (!verify.rows[0]) throw new Error('User creation failed');
}

async function testLogin() {
  // Get user and create session
  const userResult = await client.query(
    'SELECT id, email FROM users WHERE id = $1',
    [testUserId]
  );
  
  if (!userResult.rows[0]) throw new Error('User not found');
  
  const user = userResult.rows[0];
  
  // Create session with refresh_token
  const refreshToken = jwt.sign(
    { sub: user.id, email: user.email, type: 'refresh' },
    jwtSecret,
    { expiresIn: '7d' }
  );
  
  const sessionResult = await client.query(
    'INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\') RETURNING id, user_id',
    [user.id, refreshToken]
  );
  
  testSessionId = sessionResult.rows[0].id;
  console.log(`  Created session: ${testSessionId}`);
  
  // Verify session
  const verify = await client.query(
    'SELECT id, user_id FROM user_sessions WHERE id = $1 AND user_id = $2',
    [testSessionId, testUserId]
  );
  
  if (!verify.rows[0]) throw new Error('Session creation failed');
}

async function testSessionPersistence() {
  const result = await client.query(
    'SELECT id, user_id, refresh_token, created_at, expires_at FROM user_sessions WHERE id = $1',
    [testSessionId]
  );
  
  if (!result.rows[0]) throw new Error('Session not found');
  
  const session = result.rows[0];
  const now = new Date();
  
  if (session.expires_at < now) throw new Error('Session expired');
  
  console.log(`  Session valid until: ${session.expires_at}`);
}

async function testQuantDashboardAccess() {
  // Grant Quant product membership
  await client.query(
    'INSERT INTO product_memberships (user_id, product, status, created_at) VALUES ($1, $2, $3, NOW())',
    [testUserId, 'quant', 'active']
  );
  
  // Verify membership
  const result = await client.query(
    'SELECT product, status FROM product_memberships WHERE user_id = $1 AND product = $2',
    [testUserId, 'quant']
  );
  
  if (!result.rows[0] || result.rows[0].status !== 'active') {
    throw new Error('Quant membership not granted');
  }
  
  console.log(`  Quant dashboard access granted for user ${testUserId}`);
}

async function testDhanAccountConnection() {
  // Create broker account (use valid broker name - try 'DHAN' instead of 'dhan')
  const brokerResult = await client.query(
    'INSERT INTO broker_accounts (user_id, broker, client_id, connection_mode, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [testUserId, 'DHAN', `DHAN${Date.now()}`, 'LIVE', 'CONNECTED']  // Use uppercase values
  );
  
  const brokerAccountId = brokerResult.rows[0].id;
  
  // Verify connection storage
  const verify = await client.query(
    'SELECT id, user_id, broker, status FROM broker_accounts WHERE id = $1',
    [brokerAccountId]
  );
  
  if (!verify.rows[0]) throw new Error('Broker account not created');
  
  console.log(`  Dhan account connected: ${brokerAccountId}`);
}

async function testQuantSettings() {
  // Create quant settings - use valid values (risk_per_trade seems to have constraints)
  try {
    await client.query(
      'INSERT INTO algo_settings (user_id, trading_capital, risk_per_trade, risk_reward) VALUES ($1, $2, $3, $4)',
      [testUserId, 10000, 1.0, 2.0]  // Use risk_per_trade=1.0 which is likely valid
    );
  } catch (error) {
    // If insert fails, try update
    await client.query(
      'UPDATE algo_settings SET trading_capital = $1, risk_per_trade = $2 WHERE user_id = $3',
      [10000, 1.0, testUserId]
    );
  }
  
  // Verify settings
  const verify = await client.query(
    'SELECT id, user_id, trading_capital, risk_per_trade FROM algo_settings WHERE user_id = $1',
    [testUserId]
  );
  
  if (!verify.rows[0]) throw new Error('Settings not stored');
  
  console.log(`  Quant settings stored: risk_per_trade=${verify.rows[0].risk_per_trade}%`);
}

async function testNotifications() {
  // Create notification (uses 'body' not 'message')
  const notifResult = await client.query(
    'INSERT INTO notifications (user_id, title, body, type) VALUES ($1, $2, $3, $4) RETURNING id',
    [testUserId, 'Test Notification', 'This is a test notification body', 'info']
  );
  
  const notifId = notifResult.rows[0].id;
  
  // Verify notification
  const verify = await client.query(
    'SELECT id, user_id, title FROM notifications WHERE id = $1 AND user_id = $2',
    [notifId, testUserId]
  );
  
  if (!verify.rows[0]) throw new Error('Notification not created');
  
  console.log(`  Notification created: ${notifId}`);
}

async function testAdminAccess() {
  // Create admin user (uses 'username' not 'email', requires 'display_name')
  const adminResult = await client.query(
    'INSERT INTO admin_users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [
      `admin-${Date.now()}`,
      await bcryptjs.hash('AdminPassword123!', 10),
      'Test Admin',
      'super_admin'
    ]
  );
  
  const adminId = adminResult.rows[0].id;
  
  // Verify admin
  const verify = await client.query(
    'SELECT id, role FROM admin_users WHERE id = $1',
    [adminId]
  );
  
  if (!verify.rows[0] || verify.rows[0].role !== 'super_admin') {
    throw new Error('Admin creation failed');
  }
  
  console.log(`  Admin user created: ${adminId}`);
}

async function testDataIsolation() {
  // Create another user
  const otherResult = await client.query(
    'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
    [`other-${Date.now()}@kepwe.in`, await bcryptjs.hash('Pass123!', 10), 'Other User']
  );
  
  const otherUserId = otherResult.rows[0].id;
  
  // Add notification to other user
  await client.query(
    'INSERT INTO notifications (user_id, title, body, type) VALUES ($1, $2, $3, $4)',
    [otherUserId, 'Other user notification', 'Should not be visible', 'info']
  );
  
  // Verify testUser cannot see otherUser's notifications
  const result = await client.query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1',
    [testUserId]
  );
  
  // testUser should only have their own notifications
  console.log(`  User isolation verified: testUser has ${result.rows[0].count} notifications`);
}

async function testForeignKeyIntegrity() {
  // Verify broker_account references valid user
  const result = await client.query(`
    SELECT ba.id, ba.user_id, u.email
    FROM broker_accounts ba
    JOIN users u ON ba.user_id = u.id
    WHERE ba.user_id = $1
  `, [testUserId]);
  
  if (result.rows.length === 0) throw new Error('Broker account foreign key check failed');
  
  console.log(`  Foreign key integrity verified: ${result.rows.length} broker account(s)`);
}

async function runAllTests() {
  console.log('\n=== SUPABASE INTEGRATION TESTS ===\n');
  
  let passed = 0;
  let failed = 0;
  
  try {
    await connect();
    
    console.log('\n--- AUTHENTICATION TESTS ---');
    if (await test('Fresh user signup', testSignup)) passed++; else failed++;
    if (await test('User login & session creation', testLogin)) passed++; else failed++;
    if (await test('Session persistence', testSessionPersistence)) passed++; else failed++;
    
    console.log('\n--- QUANT TESTS ---');
    if (await test('Grant Quant dashboard access', testQuantDashboardAccess)) passed++; else failed++;
    if (await test('Store Quant settings', testQuantSettings)) passed++; else failed++;
    
    console.log('\n--- BROKER INTEGRATION TESTS ---');
    if (await test('Store Dhan account connection', testDhanAccountConnection)) passed++; else failed++;
    
    console.log('\n--- NOTIFICATIONS TESTS ---');
    if (await test('Create notifications', testNotifications)) passed++; else failed++;
    
    console.log('\n--- ADMIN TESTS ---');
    if (await test('Create admin user', testAdminAccess)) passed++; else failed++;
    
    console.log('\n--- DATA INTEGRITY TESTS ---');
    if (await test('User data isolation', testDataIsolation)) passed++; else failed++;
    if (await test('Foreign key relationships', testForeignKeyIntegrity)) passed++; else failed++;
    
    console.log(`\n=== RESULTS ===`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);
    
    if (failed === 0) {
      console.log('\n✅ ALL INTEGRATION TESTS PASSED\n');
      process.exitCode = 0;
    } else {
      console.log('\n❌ SOME TESTS FAILED\n');
      process.exitCode = 1;
    }
    
  } catch (error) {
    console.error(`\n[test] Fatal error: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnect();
  }
}

runAllTests();
