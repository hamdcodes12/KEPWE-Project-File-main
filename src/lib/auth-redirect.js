/**
 * Validates return paths to prevent open redirects, protocol smuggling,
 * or circular redirect loops back to auth pages.
 */
export function getSafeReturnPath(value, fallback = '/') {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\') ||
    value.includes('\r') ||
    value.includes('\n')
  ) {
    return fallback;
  }

  // Prevent redirect loops back to login/signup
  const normalized = value.split('?')[0].split('#')[0].toLowerCase();
  if (['/login', '/signup', '/admin-login', '/404'].includes(normalized)) {
    return fallback;
  }

  return value;
}