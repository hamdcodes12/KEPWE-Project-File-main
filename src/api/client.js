export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const TOKEN_KEY = 'kepwe_access_token';
const REFRESH_KEY = 'kepwe_refresh_token';

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken, refreshToken) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function clearAuthState() {
  clearTokens();
}

export async function downloadAuthenticatedFile(path) {
  let response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });

  if (response.status === 401 && await tryRefresh()) {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
  }

  if (!response.ok) {
    let message = 'Could not download the file.';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // Keep the generic message for non-JSON errors.
    }
    throw new Error(message);
  }

  return response;
}

/**
 * Core API request helper.
 * Attaches Bearer token when present.
 * Automatically attempts one refresh when a request returns 401,
 * then retries the original request once.
 */
export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, headers = {}, auth = true } = options;

  const h = { 'Content-Type': 'application/json', ...headers };
  if (auth) {
    const token = getAccessToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getAccessToken();
      h.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: h,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  // Parse the response body. If the server returns non-JSON (e.g. the SPA's
  // index.html fallback when a route is missing, or a proxy error page), we
  // must NOT return `data: null` — consumers would crash with
  // "Cannot read properties of null (reading '...')". Instead we return a
  // structured error object so callers can surface a meaningful message.
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
        ? 'Unexpected response from server.'
        : `Request failed (${res.status}). Please try again.`,
    };
  }

  return { status: res.status, ok: res.ok, data };
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 */
export async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data = await res.json();
    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
    clearTokens();
    return false;
  } catch {
    clearTokens();
    return false;
  }
}