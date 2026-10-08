import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { closeEmbeddedDatabase, pool, withRLSContext } from '../src/config/db.js';
import { getJwtSecret, signAccessToken } from '../src/middleware/auth.js';
import { grantProductMembership } from '../src/services/product-membership.service.js';

const users = [0, 1, 2].map((index) => ({
  id: crypto.randomUUID(), email: `credit-applicant-${index}-${crypto.randomUUID()}@test.local`,
  fullName: `Credit Applicant ${index}`,
}));
const adminId = crypto.randomUUID();
let server;

async function api(path, token, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { ...options, headers });
}

async function submit(token, request = {}) {
  const form = new FormData();
  form.append('loanType', request.loanType || 'working_capital');
  form.append('requestedAmount', request.requestedAmount || '125000');
  form.append('purpose', request.purpose || 'Purchase inventory for the next operating cycle.');
  form.append('businessName', request.businessName || 'Applicant Trading');
  form.append('annualTurnover', request.annualTurnover || '1200000');
  if (request.document !== false) {
    const pdfBytes = Buffer.from('%PDF-1.4\nKEPWE Credit application support document\n%%EOF');
    form.append('documents', new Blob([pdfBytes], { type: 'application/pdf' }), 'supporting-record.pdf');
  }
  const response = await api('/credit/applications', token, { method: 'POST', body: form });
  return { response, data: await response.json() };
}

try {
  for (const [index, user] of users.entries()) {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, full_name, mobile, is_active)
       VALUES ($1,$2,'test-hash','customer',$3,$4,TRUE)`,
      [user.id, user.email, user.fullName, `98765000${index}0`]
    );
  }
  await grantProductMembership(users[0].id, 'credit');
  await grantProductMembership(users[1].id, 'credit');
  await pool.query(
    `INSERT INTO admin_users (id, username, password_hash, display_name, role, is_active)
     VALUES ($1, $2, 'test-hash', 'Credit Reviewer', 'admin', TRUE)`,
    [adminId, `credit-reviewer-${adminId.slice(0, 8)}`]
  );

  const userTokens = users.map((user) => signAccessToken({ id: user.id, email: user.email, role: 'customer' }, 'credit'));
  const adminToken = jwt.sign({ sub: adminId, kind: 'admin' }, getJwtSecret(), { expiresIn: '15m' });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const unauthenticated = await api('/credit/applications');
  assert.equal(unauthenticated.status, 401);
  const noMembership = await api('/credit/applications', userTokens[2]);
  assert.equal(noMembership.status, 403);
  const nonAdminReview = await api('/admin/credit-applications', userTokens[0]);
  assert.equal(nonAdminReview.status, 403);
  const noAdminSession = await api('/admin/credit-applications');
  assert.equal(noAdminSession.status, 401);

  const first = await submit(userTokens[0]);
  assert.equal(first.response.status, 201);
  assert.match(first.data.application.applicationId, /^KCA-\d{8}-[A-F0-9]{8}$/);
  assert.equal(first.data.application.status, 'pending');
  assert.equal(first.data.documentCount, 1);
  const applicationId = first.data.application.id;

  const userList = await (await api('/credit/applications', userTokens[0])).json();
  assert.equal(userList.applications.length, 1);
  assert.equal(userList.applications[0].id, applicationId);
  assert.equal((await (await api(`/credit/applications/${applicationId}`, userTokens[1])).json()).error, 'Application not found.');

  const adminList = await (await api('/admin/credit-applications', adminToken)).json();
  assert.equal(adminList.applications.length, 1);
  assert.equal(adminList.applications[0].documentCount, 1);
  const adminDetailResponse = await api(`/admin/credit-applications/${applicationId}`, adminToken);
  assert.equal(adminDetailResponse.status, 200);
  const adminDetail = await adminDetailResponse.json();
  assert.equal(adminDetail.application.applicantEmail, users[0].email);
  assert.equal(adminDetail.documents.length, 1);
  assert.equal('file_content' in adminDetail.documents[0], false);

  const documentId = adminDetail.documents[0].id;
  const deniedDocument = await api(`/admin/credit-applications/${applicationId}/documents/${documentId}`, userTokens[0]);
  assert.equal(deniedDocument.status, 403);
  const downloaded = await api(`/admin/credit-applications/${applicationId}/documents/${documentId}`, adminToken);
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers.get('content-disposition'), /attachment/);
  assert.equal((await downloaded.arrayBuffer()).byteLength, Buffer.byteLength('%PDF-1.4\nKEPWE Credit application support document\n%%EOF'));

  const approve = await api(`/admin/credit-applications/${applicationId}/status`, adminToken, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'approved', remarks: 'Reviewed and approved for internal processing.' }),
  });
  assert.equal(approve.status, 200);
  const approved = await approve.json();
  assert.equal(approved.application.status, 'approved');
  assert.ok(approved.application.reviewedAt);
  assert.equal(approved.application.reviewedBy, adminId);

  const userDetailAfterApprove = await (await api(`/credit/applications/${applicationId}`, userTokens[0])).json();
  assert.equal(userDetailAfterApprove.application.status, 'approved');
  assert.equal(userDetailAfterApprove.events.at(-1).to_status, 'approved');
  assert.ok(userDetailAfterApprove.events.at(-1).created_at);
  const duplicateDecision = await api(`/admin/credit-applications/${applicationId}/status`, adminToken, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rejected' }),
  });
  assert.equal(duplicateDecision.status, 409);

  const storedDecision = await withRLSContext(users[0].id, (client) => client.query(
    `SELECT status, reviewed_by, reviewed_at, decision_remarks
     FROM credit_loan_applications WHERE id = $1`, [applicationId]
  ));
  assert.equal(storedDecision.rows[0].status, 'approved');
  assert.equal(storedDecision.rows[0].reviewed_by, adminId);
  assert.equal(storedDecision.rows[0].decision_remarks, 'Reviewed and approved for internal processing.');
  const audit = await pool.query(
    `SELECT action, entity_id FROM admin_audit_logs WHERE entity_type = 'credit_application' AND entity_id = $1`, [applicationId]
  );
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].action, 'credit.application.approved');

  const second = await submit(userTokens[1], { document: false, requestedAmount: '80000', purpose: 'Replace essential production equipment.' });
  assert.equal(second.response.status, 201);
  const rejected = await api(`/admin/credit-applications/${second.data.application.id}/status`, adminToken, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rejected', remarks: 'Unable to proceed at this time.' }),
  });
  assert.equal(rejected.status, 200);
  assert.equal((await (await api(`/credit/applications/${second.data.application.id}`, userTokens[1])).json()).application.status, 'rejected');

  const invalidDocumentForm = new FormData();
  invalidDocumentForm.append('loanType', 'working_capital');
  invalidDocumentForm.append('requestedAmount', '10000');
  invalidDocumentForm.append('purpose', 'Purchase seasonal stock for business.');
  invalidDocumentForm.append('documents', new Blob(['not a pdf'], { type: 'application/pdf' }), 'fake.pdf');
  const invalidDocument = await api('/credit/applications', userTokens[0], { method: 'POST', body: invalidDocumentForm });
  assert.equal(invalidDocument.status, 400);
  assert.equal((await (await api('/credit/applications', userTokens[0])).json()).applications.length, 1);

  console.log('Credit applications authenticated submission, secure documents, owner isolation, decisions, timeline, audit, and rejection checks passed.');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeEmbeddedDatabase();
}
