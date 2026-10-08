# KEPWE Render Deployment - Environment Variables Setup

## Issue
Deployment fails with: `Missing required production environment variables: BROKER_TOKEN_ENCRYPTION_KEY`

## Solution: Add Environment Variables to Render

### Step 1: Generate Required Secrets

Open your terminal and generate the encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This will output something like:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

Also generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Step 2: Add Environment Variables to Render

### In Render Dashboard:

1. **Go to your service**: https://dashboard.render.com → Select "KEPWE" service
2. **Click "Environment"** (left sidebar)
3. **Add each variable below** (click "Add Environment Variable")

### Required Variables for Production

#### 🔐 CRITICAL (Must Have)

| Key | Value | Notes |
|-----|-------|-------|
| `BROKER_TOKEN_ENCRYPTION_KEY` | `<32-byte hex from above>` | **REQUIRED** - Generate with command above |
| `JWT_SECRET` | `<48-byte hex from above>` | **REQUIRED** - Generate with command above |
| `SUPABASE_DB_URL` | Existing Supabase Postgres connection string | Add as a secret in Render; do not use the old database URL |

#### 🔧 Core Configuration

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | **Must be "production"** |
| `PORT` | (Render auto-injects) | Leave empty - Render handles this |
| `VITE_API_BASE_URL` | `/api` | Frontend API endpoint (same-origin) |
| `VITE_APP_NAME` | `KEPWE - Everything Your Business Needs` | App title |
| `VITE_APP_ENV` | `production` | Frontend environment |

#### 📧 Email (Needed for OTP Auth)

| Key | Value | Notes |
|-----|-------|-------|
| `RESEND_API_KEY` | Your Resend API key | Get from https://resend.com → API Keys |
| `OTP_FROM_EMAIL` | `KEPWE <help@kepwe.in>` | Must match Resend verified domain |

#### 🤝 Optional: Razorpay (For Payments)

| Key | Value | Notes |
|-----|-------|-------|
| `RAZORPAY_KEY_ID` | `rzp_live_XXXX...` | Production key from Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | `XXXXXXXX...` | **Backend-only** - never expose |
| `VITE_RAZORPAY_KEY_ID` | `rzp_live_XXXX...` | Public key for frontend (same as KEY_ID) |

#### 📈 Optional: Angel One SmartAPI (KEPWE Quant broker)

| Key | Value | Notes |
|-----|-------|-------|
| `BROKER_TOKEN_ENCRYPTION_KEY` | 64 hex characters | Required before any Angel One session can be stored |
| `ANGEL_ONE_API_KEY` | From smartapi.angelone.in | Optional shared SmartAPI key; otherwise each user enters their own |
| `ANGEL_ONE_STATIC_IP` | Your server's static outbound IP | Must be registered for the SmartAPI key; required for live orders |
| `ANGEL_ONE_NIFTY_FREEZE_QTY` | Current NSE freeze quantity for NIFTY options | Required for order sizing |
| `ANGEL_ONE_REDIRECT_URL` | `https://your-domain.onrender.com/api/angel-one/callback` | Only for the redirect login |
| `ANGEL_ONE_WEBHOOK_TOKEN` | Random secret | For the order postback URL |

See `backend/docs/ANGEL_ONE_INTEGRATION.md` for the full setup.

#### 📊 Optional: Upstox Market Data

| Key | Value | Notes |
|-----|-------|-------|
| `UPSTOX_API_KEY` | From Upstox | For live indices |
| `UPSTOX_API_SECRET` | From Upstox | For API calls |

#### 👤 Optional: Admin Bootstrap (One-time setup)

| Key | Value | Notes |
|-----|-------|-------|
| `ADMIN_BOOTSTRAP_ENABLED` | `false` | Set to `true` ONLY first time to create admin user |
| `ADMIN_USERNAME` | `admin` | Default admin username |
| `ADMIN_PASSWORD` | Generate secure password | Generate a strong password here |
| `ADMIN_BOOTSTRAP_RESET_PASSWORD` | `false` | Set to `true` if resetting existing admin password |

---

## Step 3: Verify Setup

After adding all variables:

1. **Click "Save"** in Render
2. **Render will redeploy** automatically
3. **Check deployment logs** for success:
   ```
   [migrate] Migration completed successfully.
   [server] Listening on port 3000
   ```

---

## Minimum Viable Setup (To Get Started)

If you just want to deploy quickly without all integrations, set these minimum variables:

```
BROKER_TOKEN_ENCRYPTION_KEY=<32-byte hex>
JWT_SECRET=<48-byte hex>
SUPABASE_DB_URL=<Supabase Postgres connection string>
NODE_ENV=production
VITE_API_BASE_URL=/api
RESEND_API_KEY=<your resend key>
```

Then deploy. All other integrations (Razorpay, Angel One, GST, etc.) are optional and can be added later.

---

## Step 4: Access Your Deployed App

Once deployment succeeds:

```
https://your-kepwe-service.onrender.com
```

Backend API:
```
https://your-kepwe-service.onrender.com/api
```

---

## Troubleshooting

### ❌ Build Failed
- Check for syntax errors (the adminClient.js fix was already applied)
- Run locally: `npm run build`

### ❌ Server Failed to Start
- Check if `BROKER_TOKEN_ENCRYPTION_KEY` is set in Render Environment
- Check if `JWT_SECRET` is set
- Check Render logs for specific error

### ❌ Database Connection Error
- Verify `SUPABASE_DB_URL` is set to the Supabase Postgres connection string
- Check PostgreSQL instance is running
- Verify network access is allowed

### ❌ Email OTP Not Working
- Verify `RESEND_API_KEY` is set
- Verify domain is verified in Resend
- Check `OTP_FROM_EMAIL` matches Resend verified email

---

## Security Best Practices

1. **Never commit `.env`** - Already in .gitignore ✓
2. **Use Render's "Secrets"** for sensitive values (not plain text)
3. **Rotate keys periodically** in production
4. **Use different secrets for dev/prod**

---

## References

- [Render Environment Variables Docs](https://render.com/docs/environment-variables)
- [Resend Email Setup](https://resend.com/docs)
- [Razorpay Dashboard](https://dashboard.razorpay.com)
- [Angel One SmartAPI Documentation](https://smartapi.angelone.in/docs)

---

## Next: Deploy Again

1. Save all environment variables in Render
2. Render auto-redeploys
3. Check deployment succeeded in Render logs
4. Visit your deployed app: `https://your-kepwe-service.onrender.com`

✅ You're done!
