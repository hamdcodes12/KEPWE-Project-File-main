# Secrets Rotation Required

**REASON**: Local .env production credentials were reportedly exposed.

**DATE**: 2026-09-19

## Critical Secrets Requiring Immediate Rotation

### Database Credentials
- [ ] **SOURCE_DB_CONNECTION** - Legacy PostgreSQL database connection string
  - Action: Rotate password on Railway PostgreSQL instance
  - Priority: HIGH (contains password for legacy production database)

- [ ] **SUPABASE_DB_URL** - Supabase PostgreSQL connection string  
  - Action: Reset database password in Supabase dashboard
  - Priority: CRITICAL (current production database)
  - Note: Must update in Render environment variables after rotation

### Payment Gateway Credentials
- [ ] **RAZORPAY_KEY_ID** - Razorpay API key ID
  - Action: Regenerate in Razorpay dashboard
  - Priority: CRITICAL (payment processing)

- [ ] **RAZORPAY_KEY_SECRET** - Razorpay API secret
  - Action: Regenerate in Razorpay dashboard  
  - Priority: CRITICAL (payment processing)

### Email Service Credentials
- [ ] **RESEND_API_KEY** - Resend API key for transactional emails
  - Action: Regenerate in Resend dashboard
  - Priority: HIGH (email delivery)

### Broker API Credentials

#### Upstox
- [ ] **UPSTOX_ACCESS_TOKEN** - Upstox broker access token
  - Action: Revoke and regenerate in Upstox API portal
  - Priority: CRITICAL (trading access)

#### Dhan
- [ ] **DHAN_API_KEY** - Dhan broker API key
  - Action: Regenerate in Dhan API portal
  - Priority: CRITICAL (trading access)

- [ ] **DHAN_API_SECRET** - Dhan broker API secret
  - Action: Regenerate in Dhan API portal
  - Priority: CRITICAL (trading access)

- [ ] **DHAN_WEBHOOK_TOKEN** - Dhan webhook authentication token
  - Action: Regenerate custom webhook token
  - Priority: HIGH (webhook security)

#### Angel One
- [ ] **ANGEL_ONE_API_KEY** - Angel One broker API key
  - Action: Regenerate in Angel One API portal
  - Priority: CRITICAL (trading access)

- [ ] **ANGEL_ONE_CLIENT_CODE** - Angel One client code
  - Action: Note exposure, consider regenerating if possible
  - Priority: HIGH

- [ ] **ANGEL_ONE_TOTP_SECRET** - Angel One TOTP secret
  - Action: Regenerate TOTP secret in Angel One account
  - Priority: CRITICAL (2FA bypass risk)

- [ ] **ANGEL_ONE_WEBHOOK_TOKEN** - Angel One webhook authentication token
  - Action: Regenerate custom webhook token
  - Priority: HIGH (webhook security)

### Encryption Keys
- [ ] **BROKER_TOKEN_ENCRYPTION_KEY** - Key for encrypting broker tokens at rest
  - Action: Generate new 256-bit key, re-encrypt all stored broker tokens
  - Priority: CRITICAL (protects all stored broker credentials)
  - Note: Requires data migration to re-encrypt existing tokens

### Supabase Public Credentials
- [ ] **NEXT_PUBLIC_SUPABASE_URL** - Supabase project URL
  - Action: None required (public URL)
  - Priority: N/A

- [ ] **NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY** - Supabase anon/public key
  - Action: Consider rotating if concerned about RLS bypass attempts
  - Priority: LOW (designed to be public, protected by RLS)

## Non-Sensitive Configuration (No Rotation Required)
- **OTP_FROM_EMAIL** - Email sender address (not a credential)
- **DHAN_REDIRECT_URL** - OAuth redirect URL (not a credential)
- **DHAN_STATIC_IP** - Static IP address (not a credential)

## Rotation Checklist

### Step 1: Database Credentials (Do First)
1. Rotate Supabase database password
2. Update SUPABASE_DB_URL in:
   - Local .env (for development)
   - Render environment variables (for production)
3. Test connection before proceeding

### Step 2: Broker Credentials (Critical for Trading)
1. Revoke all exposed broker API keys/tokens
2. Generate new credentials in each broker portal
3. Update .env file
4. Update Render environment variables
5. Test each broker connection

### Step 3: Payment Gateway
1. Regenerate Razorpay keys in dashboard
2. Update .env and Render
3. Test payment flow in sandbox mode first

### Step 4: Encryption Key Rotation (Requires Migration)
1. Generate new BROKER_TOKEN_ENCRYPTION_KEY
2. Run encryption key migration script to re-encrypt all stored tokens
3. Update .env and Render
4. Verify all broker accounts still work

### Step 5: Email Service
1. Regenerate Resend API key
2. Update .env and Render
3. Test email delivery

### Step 6: Webhook Tokens
1. Generate new random tokens for DHAN_WEBHOOK_TOKEN and ANGEL_ONE_WEBHOOK_TOKEN
2. Update .env and Render
3. Update webhook configurations in broker portals if applicable

## Post-Rotation Verification
- [ ] All Render environment variables updated
- [ ] Backend health check passes
- [ ] Database connection successful
- [ ] Broker connections verified
- [ ] Payment processing tested
- [ ] Email delivery tested
- [ ] Webhook endpoints tested

## Security Recommendations
1. Never commit .env files to version control (already in .gitignore)
2. Use Render's environment variable sync for secrets (sync: false)
3. Enable Render secret scanning if available
4. Rotate BROKER_TOKEN_ENCRYPTION_KEY periodically (every 90 days)
5. Monitor broker API usage for unauthorized access
6. Enable 2FA on all third-party service accounts
7. Consider using a secrets management service (AWS Secrets Manager, HashiCorp Vault)

## Impact Assessment
- **User Impact**: Minimal if rotation performed during low-traffic window
- **Downtime Required**: ~5-10 minutes for environment variable updates
- **Data Migration Required**: Yes, for BROKER_TOKEN_ENCRYPTION_KEY rotation
- **Testing Required**: All broker integrations and payment flows

---

**IMPORTANT**: Do NOT include actual credential values in this document or any other file committed to version control.
