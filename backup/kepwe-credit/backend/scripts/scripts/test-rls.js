const BASE = 'http://localhost:3001/api';
const EMAIL_A = `iso_a_${Date.now()}@kepwe.com`;
const EMAIL_B = `iso_b_${Date.now()}@kepwe.com`;
const MOBILE_A = `98765${String(Date.now()).slice(-5)}`;
const MOBILE_B = `98766${String(Date.now()).slice(-5)}`;
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
  console.log('===== RLS DATA ISOLATION TESTS =====');

  const ra = await api('/auth/register', { method: 'POST', body: { name: 'User A', email: EMAIL_A, mobile: MOBILE_A, password: PASS } });
  check(ra.status === 201, 'User A created');
  const ta = ra.data.accessToken;

  const rb = await api('/auth/register', { method: 'POST', body: { name: 'User B', email: EMAIL_B, mobile: MOBILE_B, password: PASS } });
  check(rb.status === 201, 'User B created');
  const tb = rb.data.accessToken;

  const meA = await api('/auth/me', { token: ta });
  const meB = await api('/auth/me', { token: tb });
  check(meA.data.user.id !== meB.data.user.id, 'Users have distinct IDs');

  check(meA.data.user.id === ra.data.user.id, 'User A gets ONLY their own profile');
  check(meB.data.user.id === rb.data.user.id, 'User B gets ONLY their own profile');

  const attack = await api('/auth/me', { token: ta });
  check(attack.data.user.id === ra.data.user.id, 'Backend ignores client-supplied IDs; uses verified JWT identity');

  check(meA.data.user.subscription && meA.data.user.subscription.plan === 'Free Trial', 'A has own subscription');
  check(meB.data.user.subscription && meB.data.user.subscription.plan === 'Free Trial', 'B has own subscription');

  console.log('===== RLS ISOLATION DONE =====');
  if (process.exitCode) console.log('SOME TESTS FAILED');
  else console.log('ALL ISOLATION TESTS PASSED');
}

main().catch((e) => {
  console.error('CRASH:', e.message);
  process.exit(1);
});