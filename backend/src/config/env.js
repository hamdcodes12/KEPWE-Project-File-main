const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'RESEND_API_KEY',
  'DHAN_API_KEY',
  'DHAN_API_SECRET',
  'BROKER_TOKEN_ENCRYPTION_KEY',
];

export function validateRuntimeEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter((name) => !process.env[name]?.trim());
  if (!process.env.JWT_SECRET?.trim() && !process.env.SESSION_SECRET?.trim()) missing.push('JWT_SECRET or SESSION_SECRET');
  if (missing.length > 0) {
    // Deliberately log variable names only. Values may be secrets or connection strings.
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET must be at least 32 characters in production');
  }

  if (!/^[0-9a-fA-F]{64}$/.test(process.env.BROKER_TOKEN_ENCRYPTION_KEY)) {
    throw new Error('BROKER_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal key in production');
  }
  const redirectUrl = process.env.DHAN_REDIRECT_URL;
  if (redirectUrl && !/^https:\/\//i.test(redirectUrl)) {
    throw new Error('DHAN_REDIRECT_URL must use HTTPS in production');
  }
}
