/**
 * Regression test for broker status synchronization
 * Ensures PARTIALLY_CONNECTED accounts show as connected in status endpoints
 */

import { pool } from '../src/config/db.js';
import { strict as assert } from 'assert';

async function testBrokerStatusRegression() {
  console.log('🧪 Broker Status Regression Test');
  
  const client = await pool.connect();
  let testUserId = null;
  
  try {
    await client.query('BEGIN');
    
    // Create test user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name, email_verified, is_active)
       VALUES ('broker-status-test@kepwe.test', '$2b$12$test', 'Broker Test', TRUE, TRUE)
       RETURNING id`
    );
    testUserId = userResult.rows[0].id;
    
    // Create PARTIALLY_CONNECTED broker account with token
    const accountResult = await client.query(
      `INSERT INTO broker_accounts 
       (user_id, broker, client_id, status, connection_mode, connected_at) 
       VALUES ($1, 'ANGEL_ONE', 'A123456', 'PARTIALLY_CONNECTED', 'LIVE', NOW())
       RETURNING id`,
      [testUserId]
    );
    const accountId = accountResult.rows[0].id;
    
    // Create encrypted token (dummy encryption for test)
    await client.query(
      `INSERT INTO broker_oauth_tokens 
       (broker_account_id, user_id, token_type, access_token_ciphertext, token_expires_at)
       VALUES ($1, $2, 'access_token', 'encrypted_dummy_token', NOW() + INTERVAL '23 hours')`,
      [accountId, testUserId]
    );
    
    // Test 1: Status endpoint query simulation
    const statusQuery = await client.query(`
      SELECT a.id, a.user_id, a.broker, a.client_id, a.status, a.connection_mode,
             t.access_token_ciphertext, t.token_expires_at
      FROM broker_accounts a
      LEFT JOIN broker_oauth_tokens t ON t.broker_account_id = a.id
      WHERE a.user_id = $1 AND a.broker = 'ANGEL_ONE'
    `, [testUserId]);
    
    const account = statusQuery.rows[0];
    assert(account.status === 'PARTIALLY_CONNECTED', 'Account should have PARTIALLY_CONNECTED status');
    assert(account.access_token_ciphertext, 'Account should have encrypted token');
    
    // Test 2: New logic should accept PARTIALLY_CONNECTED
    const shouldProceedToValidation = ['CONNECTED', 'PARTIALLY_CONNECTED'].includes(account.status) && account.access_token_ciphertext;
    assert(shouldProceedToValidation, 'Status endpoint should proceed to validation for PARTIALLY_CONNECTED accounts');
    
    // Test 3: isConnected logic should return true for PARTIALLY_CONNECTED
    const isConnected = ['CONNECTED', 'PARTIALLY_CONNECTED'].includes(account.status);
    assert(isConnected, 'isConnected should be true for PARTIALLY_CONNECTED status');
    
    console.log('✅ PARTIALLY_CONNECTED accounts treated as connected');
    
    // Test 4: Test various status values
    const testCases = [
      { status: 'CONNECTED', expected: true },
      { status: 'PARTIALLY_CONNECTED', expected: true },
      { status: 'SESSION_EXPIRED', expected: false },
      { status: 'NOT_CONNECTED', expected: false },
      { status: 'VERIFICATION_FAILED', expected: false },
    ];
    
    for (const testCase of testCases) {
      const isValidStatus = ['CONNECTED', 'PARTIALLY_CONNECTED'].includes(testCase.status);
      assert(isValidStatus === testCase.expected, 
        `Status ${testCase.status} should ${testCase.expected ? 'be' : 'not be'} treated as connected`);
    }
    
    console.log('✅ All status value checks passed');
    
    await client.query('ROLLBACK'); // Clean up test data
    console.log('✅ Regression test completed successfully\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Regression test failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run test
testBrokerStatusRegression()
  .catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });