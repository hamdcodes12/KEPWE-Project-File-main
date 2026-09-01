const base = 'http://localhost:3001/api';

async function test() {
  const email = `test${Date.now()}@kepwe.com`;
  const mobile = `98769${String(Date.now()).slice(-5)}`;
  console.log('=== AUTHENTICATION ===');
  
  // Register
  const reg = await fetch(base + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email, mobile, password: 'password123' }),
  });
  const regData = await reg.json();
  console.log('REGISTER:', reg.status, JSON.stringify(regData).slice(0, 200));

  // Login
  const login = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email, password: 'password123' }),
  });
  const loginData = await login.json();
  console.log('LOGIN:', login.status, JSON.stringify(loginData).slice(0, 200));
  const token = loginData.accessToken;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Me
  const me = await fetch(base + '/auth/me', { headers: authHeaders });
  const meData = await me.json();
  console.log('ME:', me.status, JSON.stringify(meData).slice(0, 200));

  console.log('\n=== USER-OWNED DATA ===');
  
  // Risk profile
  const risk = await fetch(base + '/risk-profile', { headers: authHeaders });
  const riskData = await risk.json();
  console.log('RISK:', risk.status, JSON.stringify(riskData).slice(0, 200));

  // Alerts config
  const alerts = await fetch(base + '/alerts/config', { headers: authHeaders });
  const alertsData = await alerts.json();
  console.log('ALERTS:', alerts.status, JSON.stringify(alertsData).slice(0, 200));

  // Paper trade
  const paper = await fetch(base + '/paper-trade', { headers: authHeaders });
  const paperData = await paper.json();
  console.log('PAPER:', paper.status, JSON.stringify(paperData).slice(0, 200));

  // Subscription
  const sub = await fetch(base + '/subscription', { headers: authHeaders });
  const subData = await sub.json();
  console.log('SUB:', sub.status, JSON.stringify(subData).slice(0, 200));

  // Reports
  const reports = await fetch(base + '/reports', { headers: authHeaders });
  const reportsData = await reports.json();
  console.log('REPORTS:', reports.status, JSON.stringify(reportsData).slice(0, 200));

  // Trade journal
  const journal = await fetch(base + '/trade-journal', { headers: authHeaders });
  const journalData = await journal.json();
  console.log('JOURNAL:', journal.status, JSON.stringify(journalData).slice(0, 200));

  // Companies
  const companies = await fetch(base + '/companies', { headers: authHeaders });
  const companiesData = await companies.json();
  console.log('COMPANIES:', companies.status, JSON.stringify(companiesData).slice(0, 200));

  // Checklist
  const checklist = await fetch(base + '/checklist', { headers: authHeaders });
  const checklistData = await checklist.json();
  console.log('CHECKLIST:', checklist.status, JSON.stringify(checklistData).slice(0, 200));

  // Portal profile
  const portal = await fetch(base + '/portal/profile', { headers: authHeaders });
  const portalData = await portal.json();
  console.log('PORTAL:', portal.status, JSON.stringify(portalData).slice(0, 200));

  // Leads (should be 403 for non-staff)
  const leads = await fetch(base + '/leads', { headers: authHeaders });
  const leadsData = await leads.json();
  console.log('LEADS (non-staff):', leads.status, JSON.stringify(leadsData).slice(0, 200));

  console.log('\n=== CRUD TESTS ===');
  
  // Create lead (public form)
  const createLead = await fetch(base + '/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: 'Test Company Pvt Ltd',
      contactName: 'Test Contact',
      mobile: '9876543210',
      email: 'test@company.com',
      industry: 'IT Services',
      state: 'Maharashtra',
      leadScore: 'WARM',
      leadSource: 'Manual',
    }),
  });
  const createLeadData = await createLead.json();
  console.log('CREATE LEAD:', createLead.status, JSON.stringify(createLeadData).slice(0, 200));

  // Contact submission
  const contact = await fetch(base + '/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Contact',
      company: 'Test Company',
      email: 'contact@test.com',
      phone: '9876543210',
      requirement: 'GST & Accounting',
    }),
  });
  const contactData = await contact.json();
  console.log('CONTACT:', contact.status, JSON.stringify(contactData).slice(0, 200));

  // Compliance check
  const compliance = await fetch(base + '/compliance-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: 'Test Compliance Pvt Ltd',
      cin: 'U72200MH2026PTC384920',
      gstin: '27AABCA1234H1Z5',
      businessType: 'Private Limited',
      industry: 'IT Services',
      state: 'Maharashtra',
      turnover: '₹5–25L',
      employees: '10',
      name: 'Test User',
      mobile: '9876543210',
      email: 'compliance@test.com',
    }),
  });
  const complianceData = await compliance.json();
  console.log('COMPLIANCE:', compliance.status, JSON.stringify(complianceData).slice(0, 200));

  console.log('\n=== MARKET DATA ===');
  
  // Market indices
  const indices = await fetch(base + '/market/indices');
  const indicesData = await indices.json();
  console.log('INDICES:', indices.status, 'count=' + (indicesData.indices || []).length);

  // Option chain
  const chain = await fetch(base + '/market/option-chain');
  const chainData = await chain.json();
  console.log('OPTION CHAIN:', chain.status, 'count=' + (chainData.optionChain || []).length);

  // Strategies
  const strategies = await fetch(base + '/market/strategies');
  const strategiesData = await strategies.json();
  console.log('STRATEGIES:', strategies.status, 'count=' + (strategiesData.strategies || []).length);

  console.log('\n=== USER ISOLATION ===');
  
  // Create second user
  const email2 = `test2${Date.now()}@kepwe.com`;
  const mobile2 = `98770${String(Date.now()).slice(-5)}`;
  const reg2 = await fetch(base + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User 2', email: email2, mobile: mobile2, password: 'password123' }),
  });
  const reg2Data = await reg2.json();
  console.log('REGISTER USER2:', reg2.status);

  const login2 = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: email2, password: 'password123' }),
  });
  const login2Data = await login2.json();
  const token2 = login2Data.accessToken;
  const authHeaders2 = { Authorization: `Bearer ${token2}` };

  // User 2 risk profile should be different from user 1
  const risk2 = await fetch(base + '/risk-profile', { headers: authHeaders2 });
  const risk2Data = await risk2.json();
  console.log('USER2 RISK:', risk2.status, JSON.stringify(risk2Data).slice(0, 200));

  // User 2 trade journal should be empty (different from user 1)
  const journal2 = await fetch(base + '/trade-journal', { headers: authHeaders2 });
  const journal2Data = await journal2.json();
  console.log('USER2 JOURNAL:', journal2.status, 'entries=' + (journal2Data.entries || []).length);

  // User 2 companies should be empty
  const companies2 = await fetch(base + '/companies', { headers: authHeaders2 });
  const companies2Data = await companies2.json();
  console.log('USER2 COMPANIES:', companies2.status, 'count=' + (companies2Data.companies || []).length);

  console.log('\n=== ALL TESTS COMPLETE ===');
}

test().catch((e) => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});