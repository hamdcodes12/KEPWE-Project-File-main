const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const ADMIN_TOKEN_KEY = 'kepwe_admin_access_token';
const ADMIN_REFRESH_KEY = 'kepwe_admin_refresh_token';

export function getAdminAccessToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAdminRefreshToken() {
  return localStorage.getItem(ADMIN_REFRESH_KEY);
}

export function setAdminTokens(accessToken, refreshToken) {
  localStorage.setItem(ADMIN_TOKEN_KEY, accessToken);
  localStorage.setItem(ADMIN_REFRESH_KEY, refreshToken);
}

export function clearAdminTokens() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_REFRESH_KEY);
}

/**
 * Admin API request helper. Fully separate from the customer apiFetch —
 * uses its own token storage keys and never touches customer auth state.
 */
export async function adminFetch(path, options = {}) {
  const { method = 'GET', body, headers = {}, auth = true } = options;

  const h = { 'Content-Type': 'application/json', ...headers };
  if (auth) {
    const token = getAdminAccessToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    const refreshed = await adminTryRefresh();
    if (refreshed) {
      const newToken = getAdminAccessToken();
      h.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: h,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (data === null) {
    data = {
      error: res.ok
        ? 'Unexpected response from the server.'
        : `Request failed (${res.status}). Please try again.`,
    };
  }

  return { status: res.status, ok: res.ok, data };
}

/**
 * Attempt to refresh the admin access token using the stored admin refresh token.
 */
export async function adminTryRefresh() {
  const refreshToken = getAdminRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearAdminTokens();
      return false;
    }

    const data = await res.json();
    if (data.accessToken && data.refreshToken) {
      setAdminTokens(data.accessToken, data.refreshToken);
      return true;
    }
    clearAdminTokens();
    return false;
  } catch {
    clearAdminTokens();
    return false;
  }
}