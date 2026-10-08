// Critical environment variables required for the app to start
const ALWAYS_REQUIRED_IN_PRODUCTION = [
  'RESEND_API_KEY',
];

// Angel One SmartAPI is the only supported broker.
//
// Required for any broker feature:
//   BROKER_TOKEN_ENCRYPTION_KEY   32-byte hex key; encrypts stored session tokens / API keys
// Required before live orders are allowed:
//   ANGEL_ONE_STATIC_IP           server static IP registered against the SmartAPI key
//   ANGEL_ONE_NIFTY_FREEZE_QTY    current NSE quantity freeze for NIFTY options
// Optional:
//   ANGEL_ONE_API_KEY             shared SmartAPI key (otherwise each user supplies their own)
//   ANGEL_ONE_REDIRECT_URL        SmartAPI publisher-login redirect URL
//   ANGEL_ONE_WEBHOOK_TOKEN       shared secret for the order postback URL
//   ANGEL_ONE_CLIENT_CODE / ANGEL_ONE_MPIN / ANGEL_ONE_TOTP_SECRET
//                                 operator account auto re-login after daily session expiry
const BROKER_REQUIRED_ENV_VARS = [
  'BROKER_TOKEN_ENCRYPTION_KEY',
];
const BROKER_LIVE_ORDER_ENV_VARS = [
  'ANGEL_ONE_STATIC_IP',
  'ANGEL_ONE_NIFTY_FREEZE_QTY',
];

export function validateRuntimeEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;

  // Check critical variables that are always required
  const missing = ALWAYS_REQUIRED_IN_PRODUCTION.filter((name) => !process.env[name]?.trim());
  if (!process.env.SUPABASE_DB_URL?.trim()) {
    missing.push('SUPABASE_DB_URL');
  }

  // Check JWT secret (required for authentication)
  if (!process.env.JWT_SECRET?.trim() && !process.env.SESSION_SECRET?.trim()) {
    missing.push('JWT_SECRET or SESSION_SECRET');
  }

  if (missing.length > 0) {
    // Deliberately log variable names only. Values may be secrets or connection strings.
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT secret strength
  const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET must be at least 32 characters in production');
  }

  // Warn about missing broker configuration but don't block startup
  const missingBroker = BROKER_REQUIRED_ENV_VARS.filter((name) => !process.env[name]?.trim());
  if (missingBroker.length > 0) {
    console.warn('⚠️  Angel One broker features are unavailable: broker configuration is incomplete.');
    console.warn(`   Missing: ${missingBroker.join(', ')}`);
  } else if (!/^[0-9a-fA-F]{64}$/.test(process.env.BROKER_TOKEN_ENCRYPTION_KEY)) {
    throw new Error('BROKER_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal key in production');
  }
  const missingLiveOrder = BROKER_LIVE_ORDER_ENV_VARS.filter((name) => !process.env[name]?.trim());
  if (missingLiveOrder.length > 0) {
    console.warn(`⚠️  Angel One live order execution stays blocked until these are set: ${missingLiveOrder.join(', ')}`);
  }
  if (!process.env.ANGEL_ONE_API_KEY?.trim()) {
    console.warn('ℹ️  ANGEL_ONE_API_KEY is not set: each user must supply their own SmartAPI key when connecting Angel One.');
  }

  // Validate HTTPS for the publisher-login redirect URL if set
  const redirectUrl = process.env.ANGEL_ONE_REDIRECT_URL;
  if (redirectUrl && !/^https:\/\//i.test(redirectUrl)) {
    throw new Error('ANGEL_ONE_REDIRECT_URL must use HTTPS in production');
  }
}

/**
 * Broker (Angel One) features need the token-encryption key: without it no
 * session can be stored. Development mode stays permissive so the UI loads.
 */
export function areBrokerFeaturesEnabled() {
  if (process.env.NODE_ENV !== 'production') return true;
  return /^[0-9a-fA-F]{64}$/.test(String(process.env.BROKER_TOKEN_ENCRYPTION_KEY || '').trim());
}

/** Angel One SmartAPI is the only broker. */
export function isBrokerConfigured(broker) {
  return broker === 'ANGEL_ONE' && areBrokerFeaturesEnabled();
}
