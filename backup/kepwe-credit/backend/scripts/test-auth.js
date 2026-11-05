const BASE = 'http://localhost:3001/api';
const EMAIL = `testuser_${Date.now()}@kepwe.com`;
const MOBILE = `98765${String(Date.now()).slice(-5)}`;
const PASS = 'Password123';

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function check(cond, label) {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + label);
  if (!cond) process.exitCode = 1;
}

async function main() {
  console.log('===== AUTH TESTS =====');

  let r = await api('/auth/register', { method: 'POST', body: { name: 'Test User', email: EMAIL, mobile: MOBILE, password: PASS } });
  check(r.status === 201, 'valid signup -> 201');
  check(r.data.user && r.data.user.email === EMAIL, 'signup returns user');
  check(!JSON.stringify(r.data).includes('password_hash'), 'no password hash exposed');
  check(!!r.data.accessToken && !!r.data.refreshToken, 'tokens returned');
  const t1 = r.data.accessToken;
  const rt1 = r.data.refreshToken;

  r = await api('/auth/register', { method: 'POST', body: { name: 'Duplicate User', email: EMAIL, mobile: MOBILE, password: PASS } });
  check(r.status === 409, 'duplicate signup -> 409');

  r = await api('/auth/login', { method: 'POST', body: { identifier: EMAIL.toUpperCase(), password: PASS, rememberMe: true } });
  check(r.status === 200, 'valid login -> 200');
  check(!!r.data.accessToken, 'login returns token');
  const t2 = r.data.accessToken;

  r = await api('/auth/login', { method: 'POST', body: { identifier: EMAIL, password: 'WrongPassword999' } });
  check(r.status === 401, 'invalid password -> 401');

  r = await api('/auth/login', { method: 'POST', body: { identifier: 'nobody@kepwe.com', password: PASS } });
  check(r.status === 401, 'invalid email -> 401');

  r = await api('/auth/me');
  check(r.status === 401, 'protected route no auth -> 401');

  r = await api('/auth/me', { token: 'bad.token.here' });
  check(r.status === 401, 'protected route bad token -> 401');

  r = await api('/auth/me', { token: t2 });
  check(r.status === 200, 'protected route valid token -> 200');
  check(r.data.user && r.data.user.email === EMAIL, 'me returns user');
  check(r.data.user.subscription && r.data.user.subscription.plan === 'Free Trial', 'me returns subscription');

  r = await api('/auth/refresh', { method: 'POST', body: { refreshToken: rt1 } });
  check(r.status === 200, 'refresh -> 200');
  check(!!r.data.accessToken && !!r.data.refreshToken, 'refresh returns new pair');

  r = await api('/auth/refresh', { method: 'POST', body: { refreshToken: rt1 } });
  check(r.status === 401, 'reused rotated refresh -> 401');

  r = await api('/auth/login', { method: 'POST', body: { identifier: EMAIL, password: PASS } });
  const rtLogout = r.data.refreshToken;
  r = await api('/auth/logout', { method: 'POST', body: { refreshToken: rtLogout } });
  check(r.status === 200, 'logout -> 200');

  r = await api('/auth/refresh', { method: 'POST', body: { refreshToken: rtLogout } });
  check(r.status === 401, 'refresh after logout -> 401');

  const meBody = JSON.stringify((await api('/auth/me', { token: t2 })).data);
  check(!meBody.includes('password_hash') && !meBody.includes('$2b$'), 'profile never leaks hash');

  console.log('===== DONE =====');
  if (process.exitCode) console.log('SOME TESTS FAILED');
  else console.log('ALL TESTS PASSED');
}

main().catch((e) => {
  console.error('CRASH:', e.message);
  process.exit(1);
});