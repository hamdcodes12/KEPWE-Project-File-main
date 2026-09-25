import { pool } from '../src/config/db.js';

async function testBrokerStatusFix() {
  console.log('=== TESTING BROKER STATUS FIX ===\n');

  // Find user with PARTIALLY_CONNECTED status
  const result = await pool.query(`
    SELECT u.id as user_id, u.email, ba.broker, ba.status, ba.client_id
    FROM users u
    JOIN broker_accounts ba ON u.id = ba.user_id 
    WHERE ba.status = 'PARTIALLY_CONNECTED' 
    AND ba.broker = 'DHAN'
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('❌ No PARTIALLY_CONNECTED Dhan accounts found for testing');
    await pool.end();
    return;
  }

  const user = result.rows[0];
  console.log(`✅ Found test user: ${user.email}`);
  console.log(`   Broker: ${user.broker}`);
  console.log(`   Status: ${user.status}`);
  console.log(`   Client ID: ${user.client_id}`);
  console.log();

  // Simulate the status endpoint logic
  const statusQuery = await pool.query(`
    SELECT a.id, a.user_id, a.broker, a.client_id, a.status, a.connection_mode, a.connected_at,
           t.access_token_ciphertext, t.token_expires_at
    FROM broker_accounts a
    LEFT JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
    WHERE a.user_id = $1 AND a.broker = $2
  `, [user.user_id, 'DHAN']);

  const account = statusQuery.rows[0];
  
  console.log('STATUS ENDPOINT SIMULATION:');
  console.log(`  Database Status: ${account.status}`);
  console.log(`  Has Token: ${!!account.access_token_ciphertext}`);
  console.log();

  // Test the new logic
  const isValidForConnection = !['CONNECTED', 'PARTIALLY_CONNECTED'].includes(account.status) || !account.access_token_ciphertext;
  
  if (isValidForConnection) {
    console.log('❌ NEW LOGIC: Would still return DISCONNECTED');
    console.log('   This means the fix is incomplete or there\'s another issue');
  } else {
    console.log('✅ NEW LOGIC: Would proceed to validate session');
    console.log('   Status endpoint should now return CONNECTED/PARTIALLY_CONNECTED');
  }
  console.log();

  // Test what the frontend gets
  console.log('EXPECTED FRONTEND RESULT:');
  if (!isValidForConnection) {
    console.log('  connected: true');
    console.log('  status: CONNECTED (after validation)');
    console.log('  broker: DHAN');
    console.log('  sessionValid: true');
  } else {
    console.log('  connected: false');  
    console.log('  status: DISCONNECTED');
  }
  console.log();

  await pool.end();
}

testBrokerStatusFix().catch(console.error);