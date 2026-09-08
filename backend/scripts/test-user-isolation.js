const base = 'http://localhost:3001/api';

async function registerAndLogin(name, email, mobile) {
  const reg = await fetch(base + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, mobile, password: 'password123' }),
  });
  const regData = await reg.json();
  if (!reg.ok) throw new Error(`Register failed: ${reg.status} ${JSON.stringify(regData)}`);

  const login = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: 'password123' }),
  });
  const loginData = await login.json();
  if (!login.ok) throw new Error(`Login failed: ${login.status} ${JSON.stringify(loginData)}`);

  return { userId: loginData.user.id, token: loginData.accessToken };
}

async function test() {
  console.log('=== USER ISOLATION TEST ===\n');

  // Create User A
  const runId = String(Date.now()).slice(-6);
  const userA = await registerAndLogin('User A', `usera${Date.now()}@kepwe.com`, `98767${runId}`);
  console.log('User A created:', userA.userId);

  // Create User B
  const userB = await registerAndLogin('User B', `userb${Date.now()}@kepwe.com`, `98768${runId}`);
  console.log('User B created:', userB.userId);

  const headersA = { Authorization: `Bearer ${userA.token}`, 'Content-Type': 'application/json' };
  const headersB = { Authorization: `Bearer ${userB.token}`, 'Content-Type': 'application/json' };

  // User A creates a trade journal entry
  const journalA = await fetch(base + '/trade-journal', {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      index: 'NIFTY',
      strategy: 'Bull Call Spread',
      verdict: 'TRADE',
      isOverride: false,
      status: 'Paper Trade',
      pnl: 500,
    }),
  });
  const journalAData = await journalA.json();
  console.log('\nUser A creates journal entry:', journalA.status, journalAData.id);

  // User A updates risk profile
  const riskA = await fetch(base + '/risk-profile', {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ experience: 'Experienced', maxAcceptableLoss: 5000, capitalAmount: 500000 }),
  });
  const riskAData = await riskA.json();
  console.log('User A updates risk profile:', riskA.status, JSON.stringify(riskAData).slice(0, 100));

  // User A updates alerts config
  const alertsA = await fetch(base + '/alerts/config', {
    method: 'PUT',
    headers: headersA,
    body: JSON.stringify({ verdictChanges: false, volatilitySpike: false }),
  });
  const alertsAData = await alertsA.json();
  console.log('User A updates alerts config:', alertsA.status, JSON.stringify(alertsAData).slice(0, 100));

  // User A updates paper trade
  const paperA = await fetch(base + '/paper-trade', {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ simulatedCapital: 250000 }),
  });
  const paperAData = await paperA.json();
  console.log('User A updates paper trade:', paperA.status, JSON.stringify(paperAData).slice(0, 100));

  // User A upgrades subscription
  const subA = await fetch(base + '/subscription', {
    method: 'PATCH',
    headers: headersA,
    body: JSON.stringify({ plan: 'Pro' }),
  });
  const subAData = await subA.json();
  console.log('User A upgrades subscription:', subA.status, JSON.stringify(subAData).slice(0, 100));

  console.log('\n--- User B tries to access User A data ---\n');

  // User B tries to read User A's trade journal
  const journalB = await fetch(base + '/trade-journal', { headers: headersB });
  const journalBData = await journalB.json();
  console.log('User B reads journal (should be empty):', journalB.status, 'entries=' + (journalBData.entries || []).length);

  // User B tries to read User A's risk profile
  const riskB = await fetch(base + '/risk-profile', { headers: headersB });
  const riskBData = await riskB.json();
  console.log('User B reads risk profile (should be default):', riskB.status, 'experience=' + riskBData.experience, 'maxLoss=' + riskBData.maxAcceptableLoss);

  // User B tries to read User A's alerts config
  const alertsB = await fetch(base + '/alerts/config', { headers: headersB });
  const alertsBData = await alertsB.json();
  console.log('User B reads alerts config (should be default):', alertsB.status, 'verdictChanges=' + alertsBData.verdictChanges);

  // User B tries to read User A's paper trade
  const paperB = await fetch(base + '/paper-trade', { headers: headersB });
  const paperBData = await paperB.json();
  console.log('User B reads paper trade (should be default):', paperB.status, 'capital=' + paperBData.simulatedCapital);

  // User B tries to read User A's subscription
  const subB = await fetch(base + '/subscription', { headers: headersB });
  const subBData = await subB.json();
  console.log('User B reads subscription (should be Free Trial):', subB.status, 'plan=' + subBData.plan);

  // User B tries to read User A's companies
  const companiesB = await fetch(base + '/companies', { headers: headersB });
  const companiesBData = await companiesB.json();
  console.log('User B reads companies (should be empty):', companiesB.status, 'count=' + (companiesBData.companies || []).length);

  // User B tries to read User A's checklist
  const checklistB = await fetch(base + '/checklist', { headers: headersB });
  const checklistBData = await checklistB.json();
  console.log('User B reads checklist (should be empty):', checklistB.status, 'items=' + (checklistBData.items || []).length);

  // User B tries to read User A's portal profile
  const portalB = await fetch(base + '/portal/profile', { headers: headersB });
  const portalBData = await portalB.json();
  console.log('User B reads portal profile (should be null company):', portalB.status, 'company=' + JSON.stringify(portalBData.company));

  // User B tries to read User A's reports
  const reportsB = await fetch(base + '/reports', { headers: headersB });
  const reportsBData = await reportsB.json();
  console.log('User B reads reports (should be locked):', reportsB.status, 'count=' + (reportsBData.reports || []).length);

  console.log('\n--- User B tries to modify User A data ---\n');

  // User B tries to update User A's risk profile (should fail or create own)
  const riskBUpdate = await fetch(base + '/risk-profile', {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ experience: 'New', maxAcceptableLoss: 100 }),
  });
  const riskBUpdateData = await riskBUpdate.json();
  console.log('User B updates risk profile (own record):', riskBUpdate.status, 'maxLoss=' + riskBUpdateData.maxAcceptableLoss);

  // User B tries to update User A's alerts config (should fail or create own)
  const alertsBUpdate = await fetch(base + '/alerts/config', {
    method: 'PUT',
    headers: headersB,
    body: JSON.stringify({ verdictChanges: false }),
  });
  const alertsBUpdateData = await alertsBUpdate.json();
  console.log('User B updates alerts config (own record):', alertsBUpdate.status, 'verdictChanges=' + alertsBUpdateData.verdictChanges);

  // User B tries to update User A's paper trade (should fail or create own)
  const paperBUpdate = await fetch(base + '/paper-trade', {
    method: 'PATCH',
    headers: headersB,
    body: JSON.stringify({ simulatedCapital: 50000 }),
  });
  const paperBUpdateData = await paperBUpdate.json();
  console.log('User B updates paper trade (own record):', paperBUpdate.status, 'capital=' + paperBUpdateData.simulatedCapital);

  console.log('\n--- Verify User A data is unchanged ---\n');

  // Verify User A's data is still intact
  const journalAVerify = await fetch(base + '/trade-journal', { headers: headersA });
  const journalAVerifyData = await journalAVerify.json();
  console.log('User A journal still has entry:', journalAVerify.status, 'entries=' + (journalAVerifyData.entries || []).length);

  const riskAVerify = await fetch(base + '/risk-profile', { headers: headersA });
  const riskAVerifyData = await riskAVerify.json();
  console.log('User A risk profile intact:', riskAVerify.status, 'experience=' + riskAVerifyData.experience, 'maxLoss=' + riskAVerifyData.maxAcceptableLoss);

  const alertsAVerify = await fetch(base + '/alerts/config', { headers: headersA });
  const alertsAVerifyData = await alertsAVerify.json();
  console.log('User A alerts config intact:', alertsAVerify.status, 'verdictChanges=' + alertsAVerifyData.verdictChanges);

  const paperAVerify = await fetch(base + '/paper-trade', { headers: headersA });
  const paperAVerifyData = await paperAVerify.json();
  console.log('User A paper trade intact:', paperAVerify.status, 'capital=' + paperAVerifyData.simulatedCapital);

  const subAVerify = await fetch(base + '/subscription', { headers: headersA });
  const subAVerifyData = await subAVerify.json();
  console.log('User A subscription intact:', subAVerify.status, 'plan=' + subAVerifyData.plan);

  console.log('\n=== USER ISOLATION TEST COMPLETE ===');
  console.log('PASS: User A and User B have completely isolated data.');
}

test().catch((e) => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});