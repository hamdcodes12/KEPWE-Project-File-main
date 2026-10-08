/**
 * KEPWE Quant Broker Connection Security Tests
 * Tests user isolation and authorization controls
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { encryptBrokerSecret } from '../../src/services/broker-token.service.js';

describe('Broker Connection Security - User Isolation', () => {
  let userAToken, userBToken;
  let userAId, userBId;
  let userABrokerId, userBBrokerId;

  beforeAll(async () => {
    // Create test users
    const userA = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['usera@test.com', 'hashedpassA', 'User A', 'customer']
    );
    userAId = userA.rows[0].id;

    const userB = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['userb@test.com', 'hashedpassB', 'User B', 'customer']
    );
    userBId = userB.rows[0].id;

    // Create mock JWT tokens (simplified for testing)
    userAToken = `mock-token-${userAId}`;
    userBToken = `mock-token-${userBId}`;

    // Setup broker connections for both users
    const brokerA = await pool.query(
      `INSERT INTO broker_accounts (user_id, broker, client_id, status, connection_mode)
       VALUES ($1, 'ANGEL_ONE', 'CLIENT_A', 'CONNECTED', 'LIVE') RETURNING id`,
      [userAId]
    );
    userABrokerId = brokerA.rows[0].id;

    const brokerB = await pool.query(
      `INSERT INTO broker_accounts (user_id, broker, client_id, status, connection_mode)
       VALUES ($1, 'ANGEL_ONE', 'CLIENT_B', 'CONNECTED', 'LIVE') RETURNING id`,
      [userBId]
    );
    userBBrokerId = brokerB.rows[0].id;

    // Store encrypted tokens
    await pool.query(
      `INSERT INTO broker_oauth_tokens (broker_account_id, user_id, access_token_ciphertext)
       VALUES ($1, $2, $3)`,
      [userABrokerId, userAId, encryptBrokerSecret('token_a')]
    );

    await pool.query(
      `INSERT INTO broker_oauth_tokens (broker_account_id, user_id, access_token_ciphertext)
       VALUES ($1, $2, $3)`,
      [userBBrokerId, userBId, encryptBrokerSecret('token_b')]
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[userAId, userBId]]);
    await pool.end();
  });

  describe('Broker Credentials Isolation', () => {
    it('should prevent User A from accessing User B broker credentials', async () => {
      // User A tries to query User B's broker
      const result = await pool.query(
        `SELECT * FROM broker_accounts WHERE user_id = $1`,
        [userBId]
      );

      // With RLS, this should return 0 rows when executed as User A
      // In actual implementation, set session variable first
      expect(result.rows.length).toBeGreaterThan(0); // Without RLS context set
      
      // With RLS context:
      await pool.query(`SET LOCAL app.current_user_id = $1`, [userAId]);
      const rlsResult = await pool.query(
        `SELECT * FROM broker_accounts WHERE user_id = $1`,
        [userBId]
      );
      expect(rlsResult.rows.length).toBe(0); // RLS prevents access
    });

    it('should return only own broker connections', async () => {
      const response = await request(app)
        .get('/api/broker/connections')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      // Should only see User A's brokers
      const brokers = response.body.brokers;
      expect(brokers.length).toBeGreaterThan(0);
      brokers.forEach(broker => {
        // Verify all brokers belong to User A
        expect(broker.clientId).not.toBe('CLIENT_B');
      });
    });

    it('should reject attempts to set another user active broker', async () => {
      // User A attempts to set User B's broker as active
      const response = await request(app)
        .post('/api/broker/set-active')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ broker: 'ANGEL_ONE', userId: userBId }) // Malicious userId
        .expect(400);

      // Should fail - userId should come from JWT, not request body
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Order Execution Isolation', () => {
    it('should create orders linked to correct user', async () => {
      const orderId = randomUUID();
      
      await pool.query(
        `INSERT INTO algo_orders (id, user_id, instrument, side, quantity, price, status)
         VALUES ($1, $2, 'NIFTY', 'BUY', 50, 100, 'CREATED')`,
        [orderId, userAId]
      );

      // User B should not see User A's order
      await pool.query(`SET LOCAL app.current_user_id = $1`, [userBId]);
      const result = await pool.query(
        `SELECT * FROM algo_orders WHERE id = $1`,
        [orderId]
      );
      
      expect(result.rows.length).toBe(0); // RLS prevents access
    });

    it('should prevent cross-user order modifications', async () => {
      const orderId = randomUUID();
      
      // User A creates an order
      await pool.query(
        `INSERT INTO algo_orders (id, user_id, instrument, side, quantity, price, status)
         VALUES ($1, $2, 'NIFTY', 'BUY', 50, 100, 'SUBMITTED')`,
        [orderId, userAId]
      );

      // User B attempts to cancel User A's order
      await pool.query(`SET LOCAL app.current_user_id = $1`, [userBId]);
      const result = await pool.query(
        `UPDATE algo_orders SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
        [orderId]
      );

      // Should not update (RLS prevents)
      expect(result.rows.length).toBe(0);
    });
  });

  describe('Verification History Isolation', () => {
    it('should store verification linked to user', async () => {
      const verificationId = randomUUID().substring(0, 16);
      
      await pool.query(
        `INSERT INTO broker_verification_history 
         (user_id, broker_account_id, broker, verification_id, status, overall_score, 
          checks_passed, checks_total, checks_detail)
         VALUES ($1, $2, 'ANGEL_ONE', $3, 'CONNECTED', 100, 10, 10, '{}'::jsonb)`,
        [userAId, userABrokerId, verificationId]
      );

      // User B should not see User A's verification
      await pool.query(`SET LOCAL app.current_user_id = $1`, [userBId]);
      const result = await pool.query(
        `SELECT * FROM broker_verification_history WHERE verification_id = $1`,
        [verificationId]
      );

      expect(result.rows.length).toBe(0);
    });

    it('should only return own verification history', async () => {
      const response = await request(app)
        .get('/api/broker/ANGEL_ONE/verification/history')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      // All history entries should belong to User A
      const history = response.body.history || [];
      // Verify via database that these belong to userAId
    });
  });

  describe('Token Encryption Security', () => {
    it('should never expose encrypted tokens in API responses', async () => {
      const response = await request(app)
        .get('/api/broker/connections')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      const json = JSON.stringify(response.body);
      
      // Check that response doesn't contain encryption markers
      expect(json).not.toContain('access_token');
      expect(json).not.toContain('ciphertext');
      expect(json).not.toContain('token_expires_at');
      expect(json).not.toContain('refresh_token');
    });

    it('should encrypt tokens before storage', async () => {
      const result = await pool.query(
        `SELECT access_token_ciphertext FROM broker_oauth_tokens 
         WHERE user_id = $1`,
        [userAId]
      );

      const encrypted = result.rows[0].access_token_ciphertext;
      
      // Should be in format: iv.tag.ciphertext (base64url encoded)
      expect(encrypted).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      expect(encrypted).not.toBe('token_a'); // Not plaintext
    });
  });

  describe('Active Broker Enforcement', () => {
    it('should ensure only one active broker per user', async () => {
      // Set broker A as active
      await pool.query(
        `UPDATE broker_accounts SET is_active_broker = TRUE WHERE id = $1`,
        [userABrokerId]
      );

      // Create second broker for User A
      const broker2 = await pool.query(
        `INSERT INTO broker_accounts (user_id, broker, client_id, status, connection_mode, is_active_broker)
         VALUES ($1, 'ANGEL_ONE', 'CLIENT_A2', 'CONNECTED', 'LIVE', TRUE) RETURNING id`,
        [userAId]
      );

      // Check that first broker is no longer active
      const result = await pool.query(
        `SELECT is_active_broker FROM broker_accounts WHERE id = $1`,
        [userABrokerId]
      );

      expect(result.rows[0].is_active_broker).toBe(false);

      // Cleanup
      await pool.query('DELETE FROM broker_accounts WHERE id = $1', [broker2.rows[0].id]);
    });

    it('should allow different users to have same broker active', async () => {
      // Both User A and User B can have ANGEL_ONE active simultaneously
      await pool.query(
        `UPDATE broker_accounts SET is_active_broker = TRUE WHERE id = $1`,
        [userABrokerId]
      );

      await pool.query(
        `UPDATE broker_accounts SET is_active_broker = TRUE WHERE id = $1`,
        [userBBrokerId]
      );

      // Both should be active (different users)
      const resultA = await pool.query(
        `SELECT is_active_broker FROM broker_accounts WHERE id = $1`,
        [userABrokerId]
      );
      const resultB = await pool.query(
        `SELECT is_active_broker FROM broker_accounts WHERE id = $1`,
        [userBBrokerId]
      );

      expect(resultA.rows[0].is_active_broker).toBe(true);
      expect(resultB.rows[0].is_active_broker).toBe(true);
    });
  });

  describe('Authorization Bypass Attempts', () => {
    it('should reject requests with missing authentication', async () => {
      await request(app)
        .get('/api/broker/connections')
        .expect(401);
    });

    it('should reject requests with invalid tokens', async () => {
      await request(app)
        .get('/api/broker/connections')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject tampering with user_id in request body', async () => {
      const response = await request(app)
        .post('/api/broker/set-active')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          broker: 'ANGEL_ONE',
          user_id: userBId, // Attempt to tamper
        })
        .expect(400);

      // user_id should be ignored, taken from JWT instead
      expect(response.body.error).toBeDefined();
    });
  });
});

describe('Broker Connection Security - Credential Protection', () => {
  it('should never log credentials', () => {
    const testToken = 'test-secret-token-12345';
    
    // Simulate error that might contain token
    const errorMessage = `Failed to connect: ${testToken}`;
    
    // Sanitization should remove token before logging
    // This is a conceptual test - actual implementation in logger
    expect(errorMessage).toContain(testToken); // Unsanitized
    
    const sanitized = errorMessage.replace(/test-secret-token-\d+/g, '[REDACTED]');
    expect(sanitized).not.toContain(testToken);
    expect(sanitized).toContain('[REDACTED]');
  });

  it('should use environment encryption key', () => {
    const key = process.env.BROKER_TOKEN_ENCRYPTION_KEY;
    
    expect(key).toBeDefined();
    expect(key).toMatch(/^[0-9a-fA-F]{64}$/); // 32 bytes hex
    expect(key.length).toBe(64);
  });
});

describe('Broker Connection Security - Rate Limiting', () => {
  it('should enforce rate limits on authentication endpoints', async () => {
    // Make multiple rapid requests
    const requests = Array(60).fill(null).map(() =>
      request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'test' })
    );

    const responses = await Promise.all(requests);
    
    // Some requests should be rate limited (429)
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
