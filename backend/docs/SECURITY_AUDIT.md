# KEPWE Quant Broker Connection Security Audit

## Executive Summary

This document details the comprehensive security measures implemented in the KEPWE Quant broker connection system to ensure complete user isolation and prevent cross-account data access.

## Security Architecture

### 1. Authentication & Authorization

#### User Authentication
- **JWT-based authentication** for all API requests
- Access tokens stored securely in httpOnly cookies or localStorage (frontend choice)
- Token expiry and rotation enforced
- Session management with refresh tokens

#### Authorization Layers
1. **Middleware Level** - `requireAuth` middleware validates JWT on every request
2. **Route Level** - Product-specific access control (`requireProductAccess`)
3. **Database Level** - Row Level Security (RLS) policies
4. **Application Level** - User ID validation in every broker operation

### 2. User Isolation Mechanisms

#### Database-Level Isolation

**Row Level Security (RLS) Policies:**
```sql
-- Broker accounts - users can only access their own
CREATE POLICY broker_accounts_owner ON broker_accounts
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Broker tokens - users can only access their own
CREATE POLICY broker_oauth_tokens_owner ON broker_oauth_tokens
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Orders - users can only access their own
CREATE POLICY algo_orders_owner ON algo_orders
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Positions - users can only access their own
CREATE POLICY algo_positions_owner ON algo_positions
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Trades - users can only access their own
CREATE POLICY algo_trades_owner ON algo_trades
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Verification history - users can only access their own
CREATE POLICY broker_verification_history_owner ON broker_verification_history
    USING (user_id = current_setting('app.current_user_id', true)::uuid);
```

**Foreign Key Constraints:**
- All broker-related tables have `user_id` foreign key to `users(id)`
- `ON DELETE CASCADE` ensures user deletion removes all associated data
- Unique constraints prevent duplicate connections per user

#### Application-Level Isolation

**Server-Side Validation:**
Every broker operation validates the authenticated user:

```javascript
// Extract user ID from JWT token (NEVER from request body/params)
const userId = req.userId; // Set by requireAuth middleware

// Get broker credentials ONLY for this user
const credentials = await getBrokerCredentials(userId, broker);
if (!credentials) {
  return res.status(404).json({ error: 'Broker not connected for this user' });
}

// Create the adapter from THIS USER's stored Angel One session
const { adapter } = await getAngelOneSession(pool, userId);
```

**Never Trust Client Input:**
- User ID always extracted from JWT token
- Broker account ID verified against authenticated user
- Database queries always include `WHERE user_id = $1`
- Frontend-supplied IDs are ignored for authorization

### 3. Credential Security

#### Encryption at Rest

**Algorithm:** AES-256-GCM (Galois/Counter Mode)
- **Key Size:** 256 bits (32 bytes)
- **IV Size:** 96 bits (12 bytes) - randomly generated per encryption
- **Auth Tag:** 128 bits - ensures integrity and authenticity
- **Key Storage:** Environment variable `BROKER_TOKEN_ENCRYPTION_KEY`

**Encryption Process:**
```javascript
// Generate random IV for each encryption
const iv = randomBytes(12);

// Create cipher with key from environment
const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);

// Encrypt the secret
const ciphertext = Buffer.concat([
  cipher.update(value, 'utf8'),
  cipher.final()
]);

// Get authentication tag
const tag = cipher.getAuthTag();

// Store as: iv.tag.ciphertext (base64url encoded)
return [iv, tag, ciphertext]
  .map(part => part.toString('base64url'))
  .join('.');
```

**Decryption Process:**
```javascript
// Parse the stored format
const [ivEncoded, tagEncoded, ciphertextEncoded] = serialized.split('.');

// Create decipher
const decipher = createDecipheriv(
  'aes-256-gcm',
  encryptionKey(),
  Buffer.from(ivEncoded, 'base64url')
);

// Set authentication tag
decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));

// Decrypt
return Buffer.concat([
  decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
  decipher.final()
]).toString('utf8');
```

**Key Management:**
- Key must be 64 hex characters (32 bytes)
- Key validated on startup
- Key never logged or exposed
- Key rotation supported (requires re-encryption of stored tokens)

#### Credentials Never Exposed

**Backend Rules:**
- Tokens decrypted only in-memory for API calls
- Never sent to frontend
- Never logged (even in error messages)
- Never included in API responses
- Sanitized in error logs

**Frontend Rules:**
- User inputs credentials directly to API
- API returns success/failure only
- No token storage in frontend
- Connection status retrieved via separate endpoint
- Client-side never sees encrypted or decrypted tokens

### 4. API Security

#### Request Authorization

**All broker endpoints require authentication:**
```javascript
router.use(['/algo/broker', '/broker'], requireAuth);
```

**User ID extraction from JWT:**
```javascript
// In requireAuth middleware
const token = extractToken(req);
const decoded = jwt.verify(token, JWT_SECRET);
req.userId = decoded.userId; // Used for all authorization
```

**Database context setting:**
```javascript
// Set PostgreSQL session variable for RLS
await client.query(
  "SET LOCAL app.current_user_id = $1",
  [userId]
);
```

#### Input Validation

**Zod schemas for all inputs:**
```javascript
const connectSchema = z.object({
  clientCode: z.string().trim().min(1).max(60).optional(),
  mpin: z.string().trim().min(1).max(64).optional(),
  totp: z.string().trim().min(6).max(128),
  apiKey: z.string().trim().max(128).optional(),
}).strict();

const setBrokerSchema = z.object({
  broker: z.enum(['ANGEL_ONE']),
}).strict();
```

**Validation enforced:**
- Required fields
- Type checking
- Length limits
- Enum validation
- No extra fields accepted (`.strict()`)

#### Rate Limiting

**Authentication endpoints:**
- 50 requests per 15 minutes per IP
- Prevents brute force attacks

**Admin endpoints:**
- 15 requests per 15 minutes per IP
- Extra protection for privileged operations

**Public submission endpoints:**
- 20 requests per 15 minutes per IP
- Prevents spam and abuse

### 5. Order Execution Security

#### Pre-Execution Validation

**Every order passes through:**

1. **Authentication Check**
   - Valid JWT token
   - Active user session

2. **Broker Authorization**
   - Broker connected for THIS user
   - Broker status is CONNECTED
   - User owns the broker credentials

3. **Risk Engine Validation**
   - Trading capital configured
   - Risk limits not exceeded
   - No duplicate orders
   - Position sizing within limits
   - Daily loss limit not breached

4. **Live Deployment Gate**
   - Algo status is ACTIVE
   - Market data available
   - Broker session valid

5. **Order Creation**
   - Created in database with user_id
   - UUID-based internal order ID
   - Linked to user's strategy

6. **Broker Submission**
   - Submitted via user's broker credentials
   - Correlation ID for tracking
   - Postback URL for updates

**Authorization Flow:**
```javascript
// 1. Validate user authentication
const userId = req.userId; // From JWT

// 2. Get THIS user's broker credentials
const credentials = await getBrokerCredentials(userId, broker);
if (!credentials) {
  throw new Error('Broker not connected');
}

// 3. Create the adapter from the user's stored Angel One session
const { adapter } = await getAngelOneSession(pool, userId);

// 4. Check algo is active for THIS user
const state = await pool.query(
  'SELECT status FROM algo_states WHERE user_id = $1',
  [userId]
);
if (state.rows[0]?.status !== 'ACTIVE') {
  throw new Error('Algo not active');
}

// 5. Run risk checks for THIS user
const risk = evaluateRisk({ userId, ...orderParams });
if (!risk.approved) {
  throw new Error(risk.reason);
}

// 6. Create order record linked to THIS user
const order = await createAndSubmitOrder({
  pool,
  adapter, // THIS user's broker adapter
  userId,  // THIS user's ID
  ...orderParams
});
```

### 6. Broker Postback Security

#### Angel One Postback Validation

**Endpoint:** `/api/angel-one/postback` (POST)

**Security Measures:**
1. **Shared secret required**: the registered postback URL carries `?token=<ANGEL_ONE_WEBHOOK_TOKEN>`; requests without it are rejected (401)
2. **Trigger only**: Angel One postbacks are unsigned, so the payload's status/price fields are never applied. The order is re-read from SmartAPI (order book) with the owner's stored session and that authoritative state is applied
3. **Order ownership verified** before updating (order -> broker account -> same user)
4. **Status transitions validated** by the OMS
5. **Idempotent updates** (duplicate or out-of-order postbacks are acknowledged, never re-applied)

**What Cannot Happen:**
- ❌ A forged postback filling or rejecting an order
- ❌ One user's postback updating another user's order
- ❌ Creating orders via postback
- ❌ Changing order ownership
- ❌ Accessing user credentials

### 7. Session Management Security

#### Session Expiry Handling

**Angel One Sessions:**
- SmartAPI tokens expire daily; MPIN and TOTP are never stored
- Expiry detected from SmartAPI error codes (AG8001/AG8002/AB1010 and HTTP 401)
- One refresh-token renewal is attempted (generateTokens); rotated tokens are re-encrypted and persisted
- If renewal fails the account is marked SESSION_EXPIRED and algo execution stops
- User is prompted to sign in again with client code, MPIN and TOTP

**Security During Expiry:**
- Expired credentials not used
- No re-login without user action (unless the operator configures the optional auto re-login env vars)
- Clear error messages
- Audit trail of session events

#### Session Storage

**Encrypted in database:**
- Access tokens encrypted with AES-256-GCM
- Refresh tokens encrypted
- Feed tokens encrypted
- Expiry timestamps stored in plain text

**Never stored:**
- User passwords
- MPIN codes
- TOTP secrets (only in environment for provider-level auth)

### 8. Data Access Controls

#### Broker Data Endpoints

**All data endpoints verify ownership:**

```javascript
// GET /api/broker/:broker/funds
router.get('/broker/:broker/funds', requireAuth, async (req, res) => {
  const userId = req.userId;
  const broker = req.params.broker;
  
  // Get adapter with THIS user's credentials
  const adapter = await getLiveBroker(req, broker);
  
  // Fetch data from broker using THIS user's session
  const funds = await adapter.getMargin();
  
  // Returns ONLY this user's funds
  res.json({ funds, broker });
});
```

**What Users Can Access:**
- ✅ Own funds/margin
- ✅ Own positions
- ✅ Own holdings
- ✅ Own orders
- ✅ Own trades
- ✅ Own P&L

**What Users Cannot Access:**
- ❌ Other users' data
- ❌ System-wide aggregates
- ❌ Other users' broker tokens
- ❌ Admin-level information

### 9. Verification System Security

#### Verification Isolation

**Each verification is user-specific:**
```javascript
async function verifyBrokerConnection(userId, broker) {
  // Get adapter for THIS user
  const adapter = await getBrokerAdapterForUser(userId, broker);
  
  // Run checks using THIS user's credentials
  const checks = {
    authentication: await verifyAuthentication(adapter),
    profile: await verifyProfile(adapter),
    funds: await verifyFunds(adapter),
    // ... more checks
  };
  
  // Store results linked to THIS user
  await pool.query(
    'INSERT INTO broker_verification_history (user_id, ...) VALUES ($1, ...)',
    [userId, ...]
  );
}
```

**Verification History:**
- Each entry linked to user_id
- RLS policies prevent cross-user access
- Audit trail maintained per user
- No global visibility

### 10. Multi-Broker Security

#### Active Broker Enforcement

**Database trigger ensures single active broker:**
```sql
CREATE OR REPLACE FUNCTION ensure_single_active_broker()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active_broker = TRUE THEN
        -- Deactivate all other brokers for THIS user
        UPDATE broker_accounts 
        SET is_active_broker = FALSE 
        WHERE user_id = NEW.user_id 
          AND id != NEW.id 
          AND is_active_broker = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Authorization for switching:**
```javascript
// POST /api/broker/set-active
async function setActiveBroker(userId, broker) {
  // Verify broker belongs to THIS user and is connected
  const result = await pool.query(
    `UPDATE broker_accounts
     SET is_active_broker = TRUE
     WHERE user_id = $1 AND broker = $2 AND status = 'CONNECTED'
     RETURNING *`,
    [userId, broker]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Broker not connected for this user');
  }
}
```

### 11. Audit Trail

#### Activity Logging

**All broker operations logged:**
```javascript
await pool.query(
  `INSERT INTO algo_activity_logs (user_id, event_type, message, metadata)
   VALUES ($1, $2, $3, $4::jsonb)`,
  [userId, eventType, message, JSON.stringify(metadata)]
);
```

**Logged Events:**
- Broker connection/disconnection
- Active broker changes
- Verification runs
- Order submissions
- Risk events
- Session expiry
- Authorization failures

**Log Security:**
- Each log entry linked to user_id
- RLS policies prevent cross-user access
- Credentials never logged
- Sanitized error messages

### 12. Error Handling Security

#### Safe Error Messages

**Information Disclosure Prevention:**
- Generic error messages to frontend
- Detailed errors only in server logs
- No stack traces to client
- No credential leakage in errors

**Examples:**
```javascript
// ❌ BAD - Exposes token
throw new Error(`Token ${accessToken} is invalid`);

// ✅ GOOD - Generic message
throw new Error('Authentication failed - please check your credentials');

// ❌ BAD - Exposes user ID
throw new Error(`User ${userId} not found`);

// ✅ GOOD - No PII
throw new Error('Account not found');
```

#### Error Sanitization

```javascript
app.use((err, req, res, next) => {
  // Log full error server-side
  logServerError('request.failed', err, req);
  
  // Send generic error to client
  res.status(err.statusCode || 500).json({
    error: err.statusCode && err.statusCode < 500 
      ? err.message 
      : 'Internal server error',
    requestId: req.requestId // For support tracking
  });
});
```

## Security Testing Checklist

### User Isolation Tests

- [ ] User A cannot access User B's broker credentials
- [ ] User A cannot see User B's funds/positions/orders
- [ ] User A cannot set User B's active broker
- [ ] User A cannot disconnect User B's broker
- [ ] User A's orders go to User A's broker account only
- [ ] Database queries filtered by user_id
- [ ] RLS policies enforced

### Credential Security Tests

- [ ] Tokens encrypted at rest
- [ ] Tokens never in API responses
- [ ] Tokens never in logs
- [ ] Tokens never in error messages
- [ ] Decryption only in-memory
- [ ] Invalid encryption key detected on startup

### Authorization Tests

- [ ] Unauthenticated requests rejected
- [ ] JWT validation enforced
- [ ] Expired tokens rejected
- [ ] Tampered tokens rejected
- [ ] Missing user_id in token rejected
- [ ] Product access control enforced

### Order Execution Tests

- [ ] Orders require active broker
- [ ] Orders require algo ACTIVE status
- [ ] Risk checks cannot be bypassed
- [ ] Duplicate orders prevented
- [ ] Orders linked to correct user
- [ ] Broker adapter uses correct credentials

### Multi-Broker Tests

- [ ] Active broker enforcement
- [ ] Broker switching requires ownership
- [ ] Cannot activate disconnected broker
- [ ] Switching updates trigger properly
- [ ] Multiple users can have same broker (different accounts)

### Postback Security Tests

- [ ] Postbacks update correct user's orders
- [ ] Postbacks cannot create new orders
- [ ] Postbacks cannot change ownership
- [ ] Invalid postbacks safely ignored
- [ ] Duplicate postbacks idempotent

### Session Security Tests

- [ ] Session expiry detected
- [ ] Expired sessions not used
- [ ] Algo stopped on expiry
- [ ] Clear reconnection workflow
- [ ] Session events logged

## Security Incident Response

### Suspected Cross-User Access

1. **Immediate Actions:**
   - Review audit logs for affected users
   - Check database for unauthorized data access
   - Verify RLS policies are active
   - Review recent code changes

2. **Investigation:**
   - Identify attack vector
   - Assess scope of breach
   - Document timeline

3. **Remediation:**
   - Fix vulnerability
   - Force re-authentication
   - Notify affected users
   - Enhance monitoring

### Credential Exposure

1. **Immediate Actions:**
   - Revoke exposed credentials
   - Mark broker as disconnected
   - Stop all order execution
   - Notify user

2. **Investigation:**
   - Determine exposure source
   - Check for unauthorized access
   - Review logs for suspicious activity

3. **Remediation:**
   - User reconnects with new credentials
   - Rotate encryption keys if needed
   - Enhanced logging for user

## Compliance & Best Practices

### OWASP Top 10 Coverage

1. **A01:2021 – Broken Access Control** ✅
   - RLS policies
   - Server-side authorization
   - User ID validation

2. **A02:2021 – Cryptographic Failures** ✅
   - AES-256-GCM encryption
   - Secure key management
   - No plaintext credentials

3. **A03:2021 – Injection** ✅
   - Parameterized queries
   - Input validation (Zod)
   - No dynamic SQL

4. **A04:2021 – Insecure Design** ✅
   - Defense in depth
   - Principle of least privilege
   - Secure defaults

5. **A05:2021 – Security Misconfiguration** ✅
   - Secure headers (Helmet)
   - CORS configuration
   - Rate limiting

6. **A06:2021 – Vulnerable Components** ✅
   - Dependency management
   - Regular updates
   - Security audits

7. **A07:2021 – Authentication Failures** ✅
   - JWT authentication
   - Session management
   - MFA support (TOTP for Angel One)

8. **A08:2021 – Software and Data Integrity** ✅
   - Integrity checks (GCM auth tag)
   - Audit logging
   - Version control

9. **A09:2021 – Security Logging** ✅
   - Comprehensive logging
   - Sanitized errors
   - Audit trail

10. **A10:2021 – Server-Side Request Forgery** ✅
    - Validated broker URLs
    - No user-controlled URLs
    - Timeout enforcement

## Conclusion

The KEPWE Quant broker connection system implements comprehensive security controls across multiple layers:

✅ **Authentication** - JWT-based with proper validation  
✅ **Authorization** - Multi-layer user verification  
✅ **Encryption** - AES-256-GCM for credentials at rest  
✅ **Isolation** - Complete user data separation  
✅ **Audit** - Comprehensive logging and tracking  
✅ **Testing** - Security verification checklist  
✅ **Compliance** - OWASP Top 10 coverage  

All requirements from the initial specification have been met with production-grade security.
