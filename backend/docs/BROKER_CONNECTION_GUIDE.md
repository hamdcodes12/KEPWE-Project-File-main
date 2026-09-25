# KEPWE Quant Broker Connection Guide

## Production-Grade Multi-Broker Support

This guide documents the production-grade broker connection system for KEPWE Quant with complete user isolation and verification.

## Supported Brokers

### 1. Dhan
- **Connection Methods:**
  - Direct Connection: User provides Dhan Client ID + 24-hour Access Token
  - OAuth Consent Flow: User authenticates via Dhan consent page
- **Authentication:** 24-hour JWT access tokens
- **API Documentation:** [Dhan HQ API v2](https://api.dhan.co)
- **Static IP:** 103.117.180.146 (whitelisted)

### 2. Angel One
- **Connection Method:** Direct Connection with Client Code + Password/MPIN
- **Authentication:** TOTP-based (requires ANGEL_ONE_API_KEY and ANGEL_ONE_TOTP_SECRET in environment)
- **API Documentation:** [Angel One SmartAPI](https://smartapi.angelbroking.com)
- **Session Tokens:** JWT (jwtToken), Refresh Token, Feed Token

### Webhook security

The broker postback endpoints fail closed unless the deployment supplies the
managed `DHAN_WEBHOOK_TOKEN` and `ANGEL_ONE_WEBHOOK_TOKEN` secrets. The ingress
must send the matching `X-KEPWE-Broker-Webhook-Token` header. The application
then resolves the order only through its stored LIVE broker account and applies
the update through the OMS; duplicate event keys are ignored. These tokens are
an ingress control, not a claim that the broker provides a native signature.
If the broker deployment provides a documented native signature, it must be
validated at the ingress before forwarding the request.

## Architecture Overview

### User Isolation

**Database Level:**
- Row Level Security (RLS) enforced on all broker tables
- Each user's broker credentials encrypted separately
- Foreign key constraints ensure data belongs to authenticated user
- PostgreSQL RLS policies prevent cross-user data access

**Application Level:**
- Server-side validation on every broker API request
- User ID verified from JWT token (never trusted from frontend)
- Broker adapter instances created per-user, per-request
- No credential sharing between users

### Security Model

**Encryption:**
- Algorithm: AES-256-GCM
- Key: 32-byte hex key from `BROKER_TOKEN_ENCRYPTION_KEY` environment variable
- Storage: Encrypted ciphertexts in `broker_oauth_tokens` table
- Decryption: Only occurs server-side, never exposed to frontend

**Token Management:**
- Access tokens: Encrypted at rest, decrypted only for API calls
- Refresh tokens: Stored encrypted for session renewal
- Feed tokens: Encrypted for real-time market data access
- Expiry tracking: `token_expires_at` field for proactive refresh

### Connection Status Values

| Status | Meaning |
|--------|---------|
| `NOT_CONNECTED` | No active connection |
| `CONNECTED` | Fully verified and operational |
| `PARTIALLY_CONNECTED` | Some functionality limited |
| `SESSION_EXPIRED` | Session expired, reconnection required |
| `VERIFICATION_FAILED` | Verification checks failed |
| `CONNECTION_FAILED` | Connection attempt failed |

## Connection Flow

### Dhan Direct Connection

```javascript
POST /api/broker/dhan/connect
Content-Type: application/json

{
  "dhanClientId": "1234567890",
  "accessToken": "eyJhbGc..."
}
```

**Steps:**
1. User submits Dhan Client ID + Access Token
2. System creates DhanAdapter with user credentials
3. Session validation (calls Dhan API to verify token)
4. Store connection in `broker_accounts` table
5. Encrypt and store token in `broker_oauth_tokens` table
6. **Comprehensive Verification** (10 checks):
   - Authentication
   - Profile/Account
   - Funds/Margin
   - Holdings
   - Positions
   - Orders
   - Trades
   - Market Data
   - Session Validity
   - Permissions
7. Calculate verification score (0-100%)
8. Return connection status + verification results

**Success Response (100% verification):**
```json
{
  "success": true,
  "broker": "DHAN",
  "dhanClientId": "1234567890",
  "status": "CONNECTED",
  "mode": "LIVE",
  "verification": {
    "status": "CONNECTED",
    "score": 100,
    "checks": 10,
    "lastVerified": "2024-01-15T10:30:00Z"
  },
  "funds": {
    "available": 50000.00,
    "utilized": 10000.00
  },
  "message": "Dhan account connected and fully verified"
}
```

**Partial Success Response (70-99% verification):**
```json
{
  "success": false,
  "broker": "DHAN",
  "status": "PARTIALLY_CONNECTED",
  "verification": {
    "status": "PARTIALLY_CONNECTED",
    "score": 80,
    "checks": {...},
    "errors": ["Market data unavailable"],
    "warnings": ["Some features may be limited"]
  },
  "message": "Connection partially successful - some features may be limited"
}
```

### Angel One Direct Connection

```javascript
POST /api/broker/angel-one/connect
Content-Type: application/json

{
  "angelOneClientCode": "A12345",
  "password": "your_mpin_or_password"
}
```

**Steps:**
1. User submits Angel One Client Code + Password/MPIN
2. System generates TOTP using configured ANGEL_ONE_TOTP_SECRET
3. Authenticate with Angel One SmartAPI
4. Receive JWT token, refresh token, feed token
5. Store connection in database with encrypted tokens
6. **Comprehensive Verification** (same 10 checks)
7. Return connection status + verification results

**Success Response:**
```json
{
  "success": true,
  "broker": "ANGEL_ONE",
  "clientCode": "A12345",
  "status": "CONNECTED",
  "mode": "LIVE",
  "verification": {
    "status": "CONNECTED",
    "score": 100,
    "checks": 10,
    "lastVerified": "2024-01-15T10:35:00Z"
  },
  "message": "Angel One account connected and fully verified"
}
```

## Verification System

### Verification Checks

Each broker connection undergoes 10 comprehensive checks:

1. **Authentication** - Session creation and token validity
2. **Profile** - Account information retrieval
3. **Funds** - Margin and balance access
4. **Holdings** - Equity holdings access
5. **Positions** - Open positions access
6. **Orders** - Order book access
7. **Trades** - Trade book access
8. **Market Data** - Real-time quotes (optional)
9. **Session Validity** - Token expiry and session health
10. **Permissions** - Required API permissions

### Verification Scoring

- **100% (10/10)** → `CONNECTED` - Fully operational
- **70-99% (7-9/10)** → `PARTIALLY_CONNECTED` - Limited functionality
- **<70% (<7/10)** → `FAILED` - Cannot proceed

### Verification History

All verifications are stored in `broker_verification_history` table with:
- Verification ID (unique identifier)
- Overall score and status
- Detailed check results
- Errors and warnings
- Verification duration

**Query verification history:**
```javascript
GET /api/broker/DHAN/verification/history?limit=10
```

## Multi-Broker Management

### Active Broker Concept

Only one broker can be "active" at a time for order execution:

```javascript
// Set active broker
POST /api/broker/set-active
{
  "broker": "ANGEL_ONE"
}

// Get active broker
GET /api/broker/active
```

**Active Broker Rules:**
- Only `CONNECTED` brokers can be set as active
- Setting a broker as active deactivates all others (enforced by database trigger)
- All order placement uses the active broker
- Users can view data from all connected brokers
- Users can switch active broker at any time

### List All Connections

```javascript
GET /api/broker/connections

Response:
{
  "brokers": [
    {
      "broker": "DHAN",
      "clientId": "1234567890",
      "status": "CONNECTED",
      "mode": "LIVE",
      "isActive": true,
      "lastVerifiedAt": "2024-01-15T10:30:00Z",
      "verificationScore": 100,
      "connectedAt": "2024-01-15T09:00:00Z",
      "sessionValid": true
    },
    {
      "broker": "ANGEL_ONE",
      "clientId": "A12345",
      "status": "CONNECTED",
      "mode": "LIVE",
      "isActive": false,
      "lastVerifiedAt": "2024-01-15T10:35:00Z",
      "verificationScore": 90,
      "connectedAt": "2024-01-15T10:30:00Z",
      "sessionValid": true
    }
  ],
  "activeBroker": "DHAN",
  "totalConnected": 2
}
```

## Data Synchronization

### Manual Refresh

```javascript
POST /api/broker/refresh
{
  "broker": "DHAN",
  "dataTypes": ["funds", "positions", "holdings", "orders", "trades"]
}

Response:
{
  "broker": "DHAN",
  "refreshedAt": "2024-01-15T11:00:00Z",
  "data": {
    "funds": {...},
    "positions": [...],
    "holdings": [...],
    "orders": [...],
    "trades": [...]
  },
  "success": true
}
```

### Automatic Refresh

- Session validation on every broker API call
- Expired sessions detected automatically
- User prompted to reconnect
- OMS stops placing orders if broker disconnected

## Session Management

### Session Expiry Handling

**Dhan:**
- 24-hour access token validity
- System detects expiry via 401 responses
- Status updated to `SESSION_EXPIRED`
- User must reconnect with new token

**Angel One:**
- JWT token validity varies
- Refresh token can extend session
- System attempts automatic refresh
- Falls back to reconnection if refresh fails

### Reconnection Flow

1. System detects expired session (401/403 from broker API)
2. Updates `broker_accounts.status` to `SESSION_EXPIRED`
3. Stops algo execution if running
4. Logs session expiry event
5. Frontend displays reconnection prompt
6. User reconnects via same flow as initial connection
7. New tokens encrypted and stored
8. Verification performed again
9. Status updated to `CONNECTED`

## Order Execution with Multi-Broker

### Broker Selection for Orders

```javascript
POST /api/broker/orders
{
  "broker": "DHAN",  // Explicit broker selection
  "instrument": "NIFTY24JAN18000CE",
  "side": "BUY",
  "quantity": 50,
  "price": 150.50,
  "stopLoss": 140.00,
  "target": 165.00,
  "metadata": {
    "symbolToken": "12345",
    "tradingSymbol": "NIFTY24JAN18000CE",
    "exchange": "NFO"
  }
}
```

**Execution Flow:**
1. Verify user is authenticated
2. Check broker is `CONNECTED` for this user
3. Retrieve user's encrypted broker credentials
4. Create broker adapter with user's credentials
5. Perform risk checks
6. Create order in `algo_orders` table (user_id linked)
7. Submit order to broker via user's account
8. Track order lifecycle
9. Store execution updates (user-specific)

### Cross-User Isolation Verification

**Server-Side Checks:**
```javascript
// Every broker operation includes:
const credentials = await getBrokerCredentials(req.userId, broker);
// Returns null if no credentials for THIS user

const adapter = await getLiveBroker(req, broker);
// Creates adapter ONLY with authenticated user's credentials

// Database queries always filter by user_id:
WHERE user_id = $1 AND broker = $2
```

**Database Policies:**
```sql
CREATE POLICY broker_accounts_owner ON broker_accounts
    USING (user_id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY broker_oauth_tokens_owner ON broker_oauth_tokens
    USING (user_id = current_setting('app.current_user_id', true)::uuid);
```

## API Endpoints Reference

### Connection Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/broker/dhan/connect` | POST | Direct Dhan connection |
| `/api/broker/dhan/oauth/start` | POST | Dhan OAuth flow start |
| `/api/broker/dhan/callback` | GET | Dhan OAuth callback |
| `/api/broker/angel-one/connect` | POST | Angel One connection |
| `/api/broker/connections` | GET | List all connections |
| `/api/broker/set-active` | POST | Set active broker |
| `/api/broker/active` | GET | Get active broker |
| `/api/broker/:broker/disconnect` | POST | Disconnect broker |

### Data Access

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/broker/:broker/status` | GET | Connection status |
| `/api/broker/:broker/funds` | GET | Funds/margin |
| `/api/broker/:broker/positions` | GET | Open positions |
| `/api/broker/:broker/holdings` | GET | Holdings |
| `/api/broker/:broker/orderbook` | GET | Order book |
| `/api/broker/:broker/tradebook` | GET | Trade book |
| `/api/broker/refresh` | POST | Refresh broker data |

### Verification

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/broker/:broker/verify` | POST | Manual verification |
| `/api/broker/:broker/verification/latest` | GET | Latest verification |
| `/api/broker/:broker/verification/history` | GET | Verification history |

### Order Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/broker/orders` | POST | Place live order |
| `/api/algo/orders/:id/cancel` | POST | Cancel order |
| `/api/algo/orders/:id` | PATCH | Modify order |
| `/api/broker/execution` | POST | Execution update |

## Testing Checklist

### Pre-Production Verification

For each broker (Dhan and Angel One):

- [ ] **Authentication**
  - [ ] User connects with own credentials
  - [ ] System creates encrypted token storage
  - [ ] Session validated successfully

- [ ] **Profile Access**
  - [ ] User's profile retrieved correctly
  - [ ] Client ID matches connected account

- [ ] **Funds Access**
  - [ ] User's actual funds displayed
  - [ ] Available/utilized margin correct
  - [ ] No cross-user fund visibility

- [ ] **Holdings Access**
  - [ ] User's holdings loaded
  - [ ] Quantities and prices correct

- [ ] **Positions Access**
  - [ ] User's open positions shown
  - [ ] P&L calculated correctly

- [ ] **Orders Access**
  - [ ] User's order history visible
  - [ ] Order statuses accurate

- [ ] **Trades Access**
  - [ ] User's trade history loaded
  - [ ] Trade execution details correct

- [ ] **Market Data**
  - [ ] Real-time quotes accessible
  - [ ] Symbol mapping works

- [ ] **Session Management**
  - [ ] Session expiry detected
  - [ ] Reconnection workflow works
  - [ ] Old sessions properly invalidated

- [ ] **Permissions**
  - [ ] All required APIs accessible
  - [ ] No permission errors

- [ ] **User Isolation**
  - [ ] User A cannot see User B's data
  - [ ] Orders placed to correct user account
  - [ ] Broker credentials not leaked

- [ ] **Multi-Broker Switching**
  - [ ] Can connect multiple brokers
  - [ ] Active broker switching works
  - [ ] Data correctly routed to active broker

- [ ] **Security**
  - [ ] Tokens never exposed in logs
  - [ ] Tokens never sent to frontend
  - [ ] Credentials encrypted at rest
  - [ ] Server-side authorization enforced

## Environment Variables

### Required for Dhan

```env
DHAN_API_KEY=your_dhan_api_key
DHAN_API_SECRET=your_dhan_api_secret
DHAN_BASE_URL=https://api.dhan.co/v2
DHAN_AUTH_URL=https://auth.dhan.co
DHAN_STATIC_IP=103.117.180.146
DHAN_REDIRECT_URL=https://yourdomain.com/api/broker/dhan/callback
```

### Required for Angel One

```env
ANGEL_ONE_API_KEY=your_angel_one_api_key
ANGEL_ONE_TOTP_SECRET=your_totp_secret_base32
ANGEL_ONE_BASE_URL=https://apiconnect.angelone.in
ANGEL_ONE_REDIRECT_URL=https://yourdomain.com/api/broker/angel-one/callback
ANGEL_ONE_CLIENT_LOCAL_IP=127.0.0.1
ANGEL_ONE_CLIENT_PUBLIC_IP=your_public_ip
ANGEL_ONE_MAC_ADDRESS=00:00:00:00:00:00
```

### Required for Encryption

```env
BROKER_TOKEN_ENCRYPTION_KEY=64_character_hex_string_32_bytes
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Error Handling

### Common Error Codes

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| `DHAN_SESSION_EXPIRED` | 401 | Session expired | Reconnect |
| `ANGEL_ONE_SESSION_EXPIRED` | 401 | Session expired | Reconnect |
| `BROKER_NOT_CONNECTED` | 409 | No connection | Connect first |
| `VERIFICATION_FAILED` | 400 | Verification failed | Check credentials |
| `BROKER_API_ERROR` | 502 | Broker API issue | Retry later |
| `PERMISSION_DENIED` | 403 | Insufficient permissions | Check broker permissions |

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "broker": "DHAN",
  "details": "Additional context if available"
}
```

## Database Schema

### broker_accounts

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to users)
- broker: VARCHAR(30) ('DHAN' | 'ANGEL_ONE')
- client_id: VARCHAR(60) (broker client identifier)
- connection_mode: VARCHAR(20) ('LIVE')
- status: VARCHAR(30) (connection status)
- is_active_broker: BOOLEAN (only one per user)
- last_verified_at: TIMESTAMPTZ
- verification_score: INTEGER (0-100)
- connected_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
- UNIQUE(user_id, broker)
```

### broker_oauth_tokens

```sql
- id: UUID (primary key)
- broker_account_id: UUID (foreign key, unique)
- user_id: UUID (foreign key to users)
- access_token_ciphertext: TEXT (encrypted)
- refresh_token_ciphertext: TEXT (encrypted, nullable)
- feed_token_ciphertext: TEXT (encrypted, nullable)
- token_type: VARCHAR(40)
- scopes: TEXT[] (array of permission scopes)
- token_expires_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### broker_verification_history

```sql
- id: UUID (primary key)
- user_id: UUID (foreign key to users)
- broker_account_id: UUID (foreign key)
- broker: VARCHAR(30)
- verification_id: VARCHAR(32) (unique per verification)
- status: VARCHAR(30) (verification outcome)
- overall_score: INTEGER (0-100)
- checks_passed: INTEGER
- checks_total: INTEGER
- checks_detail: JSONB (detailed check results)
- errors: TEXT[] (array of error messages)
- warnings: TEXT[] (array of warnings)
- verification_duration_ms: INTEGER
- created_at: TIMESTAMPTZ
```

## Migration

To apply the broker enhancements to an existing installation:

```bash
# Run migration
psql $SUPABASE_DB_URL -f backend/db/migrations/003_broker_enhancements.sql

# Verify migration
psql $SUPABASE_DB_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'broker_accounts';"
```

Migration performs:
- Adds new columns to existing tables
- Updates constraints
- Creates new verification history table
- Adds indexes for performance
- Creates triggers for active broker enforcement
- Preserves existing connection data

## Support & Troubleshooting

### Connection Issues

**Problem:** "DHAN session expired" error
**Solution:** Dhan tokens expire after 24 hours. Reconnect with a fresh token.

**Problem:** "Angel One authentication failed"
**Solution:** Verify TOTP secret is correctly configured in environment variables.

**Problem:** "Verification failed" status
**Solution:** Check that all required broker APIs are accessible. Review verification history for specific failed checks.

### Data Issues

**Problem:** "No data visible after connection"
**Solution:** Trigger manual refresh via `/api/broker/refresh` endpoint.

**Problem:** "Seeing other user's data"
**Solution:** This should NEVER happen. If it does, it's a critical security bug. Report immediately.

### Order Execution Issues

**Problem:** "Order not submitted to broker"
**Solution:** Check active broker is set and CONNECTED status.

**Problem:** "Orders going to wrong account"
**Solution:** Verify the correct broker is active. Check logs for user_id and broker correlation.

## Conclusion

This production-grade broker connection system ensures:
- ✅ Complete user isolation
- ✅ Encrypted credential storage
- ✅ Comprehensive verification
- ✅ Multi-broker support
- ✅ Real-time session management
- ✅ Secure order execution
- ✅ Audit trail for all operations
- ✅ No cross-user data leakage
- ✅ No paper trading fallback
- ✅ LIVE-only operation

All requirements from the initial specification have been met.
