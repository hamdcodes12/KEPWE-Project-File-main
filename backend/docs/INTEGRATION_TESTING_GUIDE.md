# KEPWE Quant Integration Testing Guide

## Application Status

✅ **Backend running:** http://localhost:3001  
✅ **Frontend running:** http://localhost:5173  
✅ **API base:** http://localhost:3001/api

## Pre-Testing Setup

### 1. Apply Database Migration

Run the broker enhancements migration:

```powershell
# Load the Supabase database connection from .env
$env:SUPABASE_DB_URL = (Get-Content .env | Select-String -Pattern "^SUPABASE_DB_URL=" | ForEach-Object { $_ -replace "SUPABASE_DB_URL=", "" })

# Run migration
psql $env:SUPABASE_DB_URL -f backend/db/migrations/003_broker_enhancements.sql
```

### 2. Verify Encryption Key

Check that `BROKER_TOKEN_ENCRYPTION_KEY` is set in `.env`:

```powershell
Get-Content .env | Select-String -Pattern "^BROKER_TOKEN_ENCRYPTION_KEY="
```

If not set, generate one:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```
BROKER_TOKEN_ENCRYPTION_KEY=<generated-64-hex-chars>
```

Restart backend after adding:
```powershell
# Stop and restart backend process
npm run dev:backend
```

### 3. Create Test Users

You need at least 2 real user accounts to test user isolation.

**Option A: Register via UI**
1. Go to http://localhost:5173
2. Register two accounts (e.g., user1@test.com, user2@test.com)

**Option B: Create via SQL**
```sql
INSERT INTO users (email, password_hash, full_name, role)
VALUES 
  ('user1@test.com', '$2b$10$YourHashHere', 'Test User 1', 'customer'),
  ('user2@test.com', '$2b$10$YourHashHere', 'Test User 2', 'customer');
```

## Task #9: Integration Testing with Real Broker Accounts

### Test Scenario 1: Dhan Broker Connection (User 1)

#### Prerequisites
- Real Dhan trading account with API access
- Dhan Client ID
- Dhan 24-hour Access Token

#### Steps

1. **Login as User 1**
   - Navigate to http://localhost:5173/login
   - Login with user1@test.com credentials

2. **Navigate to Quant Dashboard**
   - Go to http://localhost:5173/indexpilot or navigate via menu

3. **Connect Dhan Broker**
   - Click "Connect Broker" or "Add Broker"
   - Select Dhan
   - Enter your real Dhan credentials:
     - Client ID: Your Dhan client ID
     - Access Token: Your 24-hour access token from Dhan
   - Click Connect

4. **Verify Connection Process**
   
   Expected sequence:
   ```
   ✅ Authentication (credentials accepted by Dhan API)
   ✅ Profile verification (name, email, client ID retrieved)
   ✅ Funds verification (margin/balance retrieved)
   ✅ Holdings verification (portfolio retrieved or empty)
   ✅ Positions verification (positions retrieved or empty)
   ✅ Orders verification (order history retrieved)
   ✅ Trades verification (trade history retrieved)
   ✅ Market data access (able to fetch quotes)
   ✅ Session validity (token works)
   ✅ Permissions check (trading enabled)
   ```

   Status should show: **CONNECTED** (not PARTIALLY_CONNECTED)

5. **Verify Data Display**
   
   Check that real data appears:
   - **Funds/Margin:** Real balance from your Dhan account
   - **Holdings:** Your actual holdings (stocks you own)
   - **Positions:** Current open positions (if any)
   - **Orders:** Order history from Dhan
   - **Trades:** Trade history from Dhan
   - **P&L:** Real profit/loss calculations

   ❌ Should NOT show:
   - Mock data
   - Demo balances
   - Fake orders
   - Hardcoded values
   - Paper trading indicators

6. **Test Active Broker**
   - Broker should be automatically set as active (green banner)
   - Check "Active Broker" badge appears

7. **Test Verification**
   - Click "Verify Connection" button
   - All 10 checks should pass
   - Verification score should be 100%
   - "Last Verified" timestamp should update

8. **Test Data Refresh**
   - Click "Refresh Data" button
   - Loading spinner should appear
   - Data should update with latest from Dhan
   - Timestamp should update

### Test Scenario 2: Angel One Broker Connection (User 1)

#### Prerequisites
- Real Angel One trading account
- Angel One API key
- Angel One Client ID
- Angel One Password
- Angel One TOTP secret (from Angel One mobile app)

#### Steps

1. **Still logged in as User 1**

2. **Add Angel One Broker**
   - Click "Add Broker" or "Connect Another Broker"
   - Select Angel One
   - Enter credentials:
     - API Key: Your Angel One API key
     - Client ID: Your Angel One client code
     - Password: Your Angel One password
     - TOTP: Current TOTP code from your authenticator app
   - Click Connect

3. **Verify Connection**
   
   Expected sequence (same 10 checks as Dhan):
   ```
   ✅ Authentication (TOTP + credentials accepted)
   ✅ JWT token obtained
   ✅ Profile verification
   ✅ Funds verification
   ✅ Holdings verification
   ✅ Positions verification
   ✅ Orders verification
   ✅ Trades verification
   ✅ Market data access
   ✅ Session validity
   ```

   Status: **CONNECTED**

4. **Test Multi-Broker View**
   
   You should now see TWO broker cards:
   - Dhan (your first broker)
   - Angel One (your second broker)
   
   One should have "Active" badge

5. **Test Broker Switching**
   - Click "Set Active" on Angel One card
   - Green banner should switch to Angel One
   - Dhan should no longer have "Active" badge
   - Data displayed should switch to Angel One data
   - Click "Set Active" on Dhan
   - Banner should switch back

6. **Verify Broker Switcher Dropdown**
   - Look for broker switcher in header/nav
   - Should show current active broker with logo
   - Click dropdown
   - Should list both brokers with client IDs
   - Active broker should have checkmark
   - Click to switch
   - Data should update immediately

### Test Scenario 3: User Isolation (User 2)

#### Critical Security Test

1. **Logout from User 1**

2. **Login as User 2**
   - Login with user2@test.com

3. **Navigate to Quant Dashboard**

4. **Verify Isolation**
   
   Expected: **NO BROKERS SHOWN**
   - Should see "No brokers connected" message
   - Should NOT see User 1's Dhan connection
   - Should NOT see User 1's Angel One connection
   - Should NOT see any of User 1's data

5. **Connect User 2's Own Broker**
   - Connect User 2's own Dhan or Angel One account
   - Use User 2's personal credentials (different from User 1)

6. **Verify Separate Data**
   
   User 2 should see:
   - ✅ User 2's own funds
   - ✅ User 2's own holdings
   - ✅ User 2's own positions
   - ✅ User 2's own orders
   - ✅ User 2's own trades
   
   User 2 should NOT see:
   - ❌ User 1's funds
   - ❌ User 1's holdings
   - ❌ User 1's positions
   - ❌ User 1's orders
   - ❌ User 1's trades

7. **Login as User 1 Again**
   - Verify User 1 still sees their 2 brokers
   - Verify data hasn't changed
   - Verify User 2's broker is NOT visible

### Test Scenario 4: Session Expiry & Reconnection

#### For Dhan (24-hour token)

1. **Simulate Session Expiry**
   
   Option A: Wait 24 hours (not practical for testing)
   
   Option B: Manually expire in database:
   ```sql
   UPDATE broker_oauth_tokens 
   SET token_expires_at = NOW() - INTERVAL '1 hour'
   WHERE user_id = '<user1_id>' AND broker_account_id IN (
     SELECT id FROM broker_accounts WHERE broker = 'DHAN'
   );
   ```

2. **Trigger API Call**
   - Click "Refresh Data"
   - Or wait for automatic refresh

3. **Verify Expiry Detection**
   - Status should change to: **SESSION_EXPIRED**
   - Error message: "Session expired - please reconnect"
   - Data should not update
   - Algo execution should stop (if running)

4. **Reconnect**
   - Click "Reconnect" button
   - Enter new 24-hour access token
   - Verification should run
   - Status should return to: **CONNECTED**

#### For Angel One (JWT with refresh)

1. **Simulate Token Expiry**
   - Angel One tokens typically expire in 5-10 minutes
   - Wait for natural expiry or manually expire in DB

2. **Test Automatic Refresh**
   - System should automatically use refresh_token
   - New access_token should be obtained
   - User should not notice (seamless)

3. **Test Refresh Failure**
   - If refresh fails → SESSION_EXPIRED
   - User prompted to reconnect

### Test Scenario 5: Order Execution Security

#### Test Setup

1. **Login as User 1**
2. **Ensure Dhan is active broker**
3. **Create a test strategy**

#### Test Order Submission

1. **Submit a Test Order**
   
   Example: Buy 1 lot NIFTY Future
   - Navigate to strategy execution
   - Configure order parameters
   - Submit order

2. **Verify Authorization Flow**
   
   Expected sequence:
   ```
   ✅ JWT authentication validated
   ✅ Broker ownership verified (User 1 owns Dhan account)
   ✅ Active broker confirmed
   ✅ Risk checks passed
   ✅ Order created in database with user_id = User 1
   ✅ Order submitted to Dhan via User 1's credentials
   ✅ Dhan order ID received
   ✅ Order status updated
   ```

3. **Verify Order Record**
   
   Check database:
   ```sql
   SELECT id, user_id, instrument, side, quantity, status, broker_order_id
   FROM algo_orders
   WHERE user_id = '<user1_id>'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   
   Confirm:
   - user_id matches User 1
   - broker_order_id from Dhan
   - status updated correctly

4. **Check Dhan Platform**
   - Login to Dhan web/mobile
   - Verify order appears in Dhan order book
   - Verify it's under YOUR Dhan account

5. **Test Postback**
   
   When Dhan sends order update:
   - KEPWE receives postback
   - Finds order by broker_order_id
   - Verifies it belongs to User 1 (from DB, not request)
   - Updates status
   - Does NOT allow ownership change

#### Security Tests

1. **Attempt Cross-User Order** (should fail)
   
   Manually test authorization:
   ```javascript
   // This should be rejected by backend
   fetch('/api/broker/dhan/orders', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer <user1_token>',
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       user_id: '<user2_id>', // Malicious attempt
       instrument: 'NIFTY',
       side: 'BUY',
       quantity: 50
     })
   });
   ```
   
   Expected: 400 or 403 error, user_id ignored, taken from JWT instead

2. **Verify Order Belongs to Correct User**
   
   All orders should have:
   - user_id = authenticated user from JWT
   - Never taken from request body
   - Never modifiable by another user

### Test Scenario 6: Verification History & Audit Trail

1. **View Verification History**
   - Click "View History" or navigate to verification logs
   - Should see list of all verification runs

2. **Verify History Details**
   
   Each entry should show:
   - Timestamp
   - Broker name
   - Status (CONNECTED/FAILED)
   - Score (0-100)
   - Checks passed / total
   - Duration (ms)
   - Error messages (if any)

3. **Check Audit Logs**
   
   Query database:
   ```sql
   SELECT event_type, message, metadata, created_at
   FROM algo_activity_logs
   WHERE user_id = '<user1_id>'
   ORDER BY created_at DESC
   LIMIT 20;
   ```
   
   Should see logs for:
   - Broker connections
   - Broker disconnections
   - Active broker changes
   - Verification runs
   - Order submissions
   - Session events

4. **Verify User Isolation in Logs**
   
   User 1 should only see User 1's logs:
   ```sql
   SELECT COUNT(*) FROM algo_activity_logs WHERE user_id = '<user2_id>';
   ```
   Should return 0 when executed in User 1's session

## Task #10: Production Verification Checklist

### Security Verification

- [ ] **User Isolation**
  - [ ] User A cannot see User B's broker connections
  - [ ] User A cannot see User B's funds/positions/orders
  - [ ] User A cannot set User B's active broker
  - [ ] User A cannot submit orders for User B
  - [ ] Database queries filtered by user_id from JWT

- [ ] **Credential Security**
  - [ ] Tokens encrypted in database (check format: iv.tag.ciphertext)
  - [ ] Tokens never in API responses
  - [ ] Tokens never in server logs
  - [ ] Tokens never in error messages
  - [ ] Encryption key is 64 hex characters

- [ ] **Authorization**
  - [ ] All broker endpoints require authentication
  - [ ] JWT validation enforced
  - [ ] Expired tokens rejected
  - [ ] user_id from JWT, not request body
  - [ ] RLS policies active on all tables

### Broker Connection Verification

- [ ] **Dhan Integration**
  - [ ] Connection with real credentials succeeds
  - [ ] All 10 verification checks pass
  - [ ] Status shows CONNECTED
  - [ ] Real funds displayed
  - [ ] Real holdings displayed
  - [ ] Real positions displayed
  - [ ] Real orders displayed
  - [ ] Real trades displayed
  - [ ] Data refresh works
  - [ ] Session expiry detected
  - [ ] Reconnection works

- [ ] **Angel One Integration**
  - [ ] Connection with TOTP succeeds
  - [ ] All 10 verification checks pass
  - [ ] Status shows CONNECTED
  - [ ] JWT token obtained
  - [ ] Real data displayed
  - [ ] Refresh token works
  - [ ] Session management works

### Multi-Broker Verification

- [ ] **Broker Management**
  - [ ] Can connect multiple brokers per user
  - [ ] Only one active broker at a time per user
  - [ ] Active broker shown with badge/banner
  - [ ] Switching active broker works
  - [ ] Data updates when switching
  - [ ] Different users can have same broker (different accounts)

- [ ] **UI Components**
  - [ ] MultiBrokerManager displays all brokers
  - [ ] Status badges accurate
  - [ ] Quick actions work (Set Active, Refresh, Verify, Reconnect)
  - [ ] BrokerSwitcher dropdown shows brokers
  - [ ] Switching via dropdown works
  - [ ] Loading states display correctly
  - [ ] Error messages display correctly

### Order Execution Verification

- [ ] **Authorization Flow**
  - [ ] Orders require authenticated user
  - [ ] Orders require active broker
  - [ ] Orders require CONNECTED status
  - [ ] Risk checks enforced
  - [ ] Orders created with correct user_id
  - [ ] Orders submitted via correct user's broker

- [ ] **Order Tracking**
  - [ ] Order created in database
  - [ ] Broker order ID received
  - [ ] Status updates work
  - [ ] Postback updates work
  - [ ] Order visible in Dhan/Angel One
  - [ ] P&L calculated correctly

### Data Verification

- [ ] **Real Data Only**
  - [ ] No mock data
  - [ ] No demo balances
  - [ ] No fake orders
  - [ ] No hardcoded values
  - [ ] No paper trading mode
  - [ ] No sandbox fallback

- [ ] **Data Synchronization**
  - [ ] Manual refresh works
  - [ ] Automatic refresh works (if implemented)
  - [ ] Timestamps update correctly
  - [ ] Data matches broker platform

### Error Handling Verification

- [ ] **Connection Errors**
  - [ ] Invalid credentials show clear error
  - [ ] Network errors handled gracefully
  - [ ] Status updates to appropriate error state
  - [ ] User prompted to retry/reconnect

- [ ] **Session Errors**
  - [ ] Expired session detected
  - [ ] Status updates to SESSION_EXPIRED
  - [ ] Algo execution stops
  - [ ] Clear reconnection workflow

- [ ] **Order Errors**
  - [ ] Insufficient margin detected
  - [ ] Risk limit breaches rejected
  - [ ] Broker API errors displayed
  - [ ] Order status reflects error

### Audit & Monitoring Verification

- [ ] **Activity Logs**
  - [ ] All broker operations logged
  - [ ] User-specific logs isolated
  - [ ] No sensitive data in logs
  - [ ] Timestamps accurate

- [ ] **Verification History**
  - [ ] All verification runs stored
  - [ ] History accessible per user
  - [ ] Details include all checks
  - [ ] User isolation enforced

## Test Results Documentation

### Test Environment
- **Date:** ___________
- **Backend Version:** ___________
- **Frontend Version:** ___________
- **Database:** PostgreSQL version ___________
- **Node.js:** version ___________

### Dhan Testing
- **Tester:** ___________
- **Dhan Account:** ___________ (Client ID)
- **Connection Result:** ✅ / ❌
- **Verification Score:** _____/100
- **Issues Found:** ___________

### Angel One Testing
- **Tester:** ___________
- **Angel One Account:** ___________ (Client Code)
- **Connection Result:** ✅ / ❌
- **Verification Score:** _____/100
- **Issues Found:** ___________

### User Isolation Testing
- **Test Users:** User 1: ___________, User 2: ___________
- **Isolation Verified:** ✅ / ❌
- **Issues Found:** ___________

### Security Testing
- **Security Test Suite Result:** ✅ PASSED / ❌ FAILED
- **Issues Found:** ___________

### Order Execution Testing
- **Test Orders Submitted:** _____
- **Successful Executions:** _____
- **Failed Executions:** _____
- **Issues Found:** ___________

## Production Readiness Decision

Based on the test results above, the KEPWE Quant broker connection system is:

- [ ] **READY FOR PRODUCTION** - All tests passed, no critical issues
- [ ] **READY WITH MINOR ISSUES** - Non-critical issues documented, acceptable for production
- [ ] **NOT READY** - Critical issues found, must be resolved before production

**Decision Maker:** ___________  
**Date:** ___________  
**Signature:** ___________

## Next Steps

### If Ready for Production:
1. Deploy migration to production database
2. Configure production environment variables
3. Set up monitoring and alerts
4. Document production broker connection procedures
5. Train support team on broker connection issues
6. Enable for beta users
7. Monitor audit logs closely for first week
8. Prepare incident response plan

### If Not Ready:
1. Document all issues found
2. Prioritize issues by severity
3. Create fix tasks
4. Re-test after fixes
5. Repeat production verification

## Support & Troubleshooting

### Common Issues

**Issue:** "Verification failed - authentication error"  
**Solution:** Check that credentials are current and correct

**Issue:** "Session expired"  
**Solution:** Dhan tokens expire every 24 hours, get new access token

**Issue:** "No data displayed"  
**Solution:** Check broker connection status, verify RLS policies enabled

**Issue:** "Orders not appearing"  
**Solution:** Check that user_id matches, verify broker_order_id received

### Debug Commands

Check broker connection:
```sql
SELECT id, user_id, broker, client_id, status, is_active_broker, last_verified_at
FROM broker_accounts
WHERE user_id = '<user_id>';
```

Check recent verifications:
```sql
SELECT broker, status, overall_score, checks_passed, checks_total, created_at
FROM broker_verification_history
WHERE user_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 5;
```

Check recent orders:
```sql
SELECT id, instrument, side, quantity, status, broker_order_id, created_at
FROM algo_orders
WHERE user_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 10;
```

### Contact

For issues or questions during testing:
- Documentation: backend/docs/BROKER_CONNECTION_GUIDE.md
- Security: backend/docs/SECURITY_AUDIT.md
- Support: help@kepwe.in
