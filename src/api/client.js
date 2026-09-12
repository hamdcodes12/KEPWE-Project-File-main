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

export async function requestEmailOtp(data) {
  return apiFetch('/auth/email-otp/request', { method: 'POST', body: data, auth: false });
}

export async function verifyEmailOtp(data) {
  return apiFetch('/auth/email-otp/verify', { method: 'POST', body: data, auth: false });
}

export async function uploadAvatarApi(fileData, mimeType) {
  return apiFetch('/auth/profile/avatar', {
    method: 'POST',
    body: { fileData, mimeType },
    auth: true,
  });
}

export async function deleteAvatarApi() {
  return apiFetch('/auth/profile/avatar', {
    method: 'DELETE',
    auth: true,
  });
}

export async function downloadAuthenticatedFile(path) {
  let response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    credentials: 'include',
  });

  if (response.status === 401 && await tryRefresh()) {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      credentials: 'include',
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

let activeRefreshPromise = null;

/**
 * Core API request helper.
 * Attaches Bearer token when present.
 * Automatically attempts one refresh when a request returns 401,
 * then retries the original request once.
 * Differentiates USER_AUTH_EXPIRED from DHAN_SESSION_EXPIRED.
 */
export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, headers = {}, auth = true, signal } = options;

  const h = { 'Content-Type': 'application/json', ...headers };
  if (auth) {
    const token = getAccessToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
    signal,
  });

  // Parse response body helper
  const parseBody = async (response) => {
    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }
    if (data === null) {
      data = {
        error: response.ok
          ? 'Unexpected response from server.'
          : `Request failed (${response.status}). Please try again.`,
      };
    }
    return data;
  };

  if (res.status === 401 && auth) {
    let data = await parseBody(res);

    // If this is a broker-specific 401 (e.g. Dhan 24h token expired on DhanHQ),
    // do NOT treat it as a user app login failure and do NOT refresh or clear user tokens.
    if (data?.code === 'DHAN_SESSION_EXPIRED' || data?.broker === 'DHAN') {
      return { status: res.status, ok: false, data };
    }

    // Otherwise, this is a user application authentication expiration
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getAccessToken();
      h.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: h,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
        signal,
      });
      return { status: res.status, ok: res.ok, data: await parseBody(res) };
    }

    return { status: res.status, ok: false, data };
  }

  return { status: res.status, ok: res.ok, data: await parseBody(res) };
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Uses a singleton inflight promise to eliminate concurrent refresh stampedes.
 */
export async function tryRefresh() {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          clearTokens();
        }
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
      return false;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}
