// Critical environment variables required for the app to start
const ALWAYS_REQUIRED_IN_PRODUCTION = [
  'RESEND_API_KEY',
];

// Broker-related environment variables (optional - only required when using broker features)
const BROKER_ENV_VARS = [
  'DHAN_API_KEY',
  'DHAN_API_SECRET',
  'ANGEL_ONE_API_KEY',
  'ANGEL_ONE_CLIENT_CODE',
  'ANGEL_ONE_TOTP_SECRET',
  'DHAN_WEBHOOK_TOKEN',
  'ANGEL_ONE_WEBHOOK_TOKEN',
  'BROKER_TOKEN_ENCRYPTION_KEY',
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

  // Warn about missing broker credentials but don't block startup
  const missingBroker = BROKER_ENV_VARS.filter((name) => !process.env[name]?.trim());
  if (!process.env.ANGEL_ONE_PASSWORD?.trim() && !process.env.ANGEL_ONE_MPIN?.trim()) {
    missingBroker.push('ANGEL_ONE_PASSWORD or ANGEL_ONE_MPIN');
  }
  
  if (missingBroker.length > 0) {
    console.warn('⚠️  Broker credentials not configured. Live broker features will be unavailable.');
    console.warn(`   Missing: ${missingBroker.join(', ')}`);
  } else {
    // Only validate broker token encryption key if broker vars are present
    if (process.env.BROKER_TOKEN_ENCRYPTION_KEY && !/^[0-9a-fA-F]{64}$/.test(process.env.BROKER_TOKEN_ENCRYPTION_KEY)) {
      throw new Error('BROKER_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal key in production');
    }
  }
  
  // Validate HTTPS for redirect URLs if set
  const redirectUrl = process.env.DHAN_REDIRECT_URL;
  if (redirectUrl && !/^https:\/\//i.test(redirectUrl)) {
    throw new Error('DHAN_REDIRECT_URL must use HTTPS in production');
  }
}

/**
 * Check if broker features are available (at least one broker is configured)
 */
export function areBrokerFeaturesEnabled() {
  if (process.env.NODE_ENV !== 'production') return true; // Allow in dev
  
  const hasEncryptionKey = process.env.BROKER_TOKEN_ENCRYPTION_KEY?.trim();
  if (!hasEncryptionKey) return false; // Encryption key is mandatory
  
  const hasDhan = process.env.DHAN_API_KEY?.trim() && 
                  process.env.DHAN_API_SECRET?.trim();
                  
  const hasAngelOne = process.env.ANGEL_ONE_API_KEY?.trim() && 
                      process.env.ANGEL_ONE_CLIENT_CODE?.trim() &&
                      process.env.ANGEL_ONE_TOTP_SECRET?.trim() &&
                      (process.env.ANGEL_ONE_PASSWORD?.trim() || process.env.ANGEL_ONE_MPIN?.trim());
  
  // Return true if at least ONE broker is configured
  return hasDhan || hasAngelOne;
}

/**
 * Check if a specific broker is configured
 */
export function isBrokerConfigured(broker) {
  if (process.env.NODE_ENV !== 'production') return true;
  
  const hasEncryptionKey = process.env.BROKER_TOKEN_ENCRYPTION_KEY?.trim();
  if (!hasEncryptionKey) return false;
  
  if (broker === 'DHAN') {
    return Boolean(
      process.env.DHAN_API_KEY?.trim() && 
      process.env.DHAN_API_SECRET?.trim()
    );
  }
  
  if (broker === 'ANGEL_ONE') {
    return Boolean(
      process.env.ANGEL_ONE_API_KEY?.trim() && 
      process.env.ANGEL_ONE_CLIENT_CODE?.trim() &&
      process.env.ANGEL_ONE_TOTP_SECRET?.trim() &&
      (process.env.ANGEL_ONE_PASSWORD?.trim() || process.env.ANGEL_ONE_MPIN?.trim())
    );
  }
  
  return false;
}
