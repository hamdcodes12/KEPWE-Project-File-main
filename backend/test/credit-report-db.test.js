import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import { PDFParse } from 'pdf-parse';
import app from '../src/app.js';
import { closeEmbeddedDatabase, pool, withRLSContext } from '../src/config/db.js';
import { grantProductMembership } from '../src/services/product-membership.service.js';
import { signAccessToken } from '../src/middleware/auth.js';

const userA = crypto.randomUUID();
const userB = crypto.randomUUID();
const userC = crypto.randomUUID();
const users = [userA, userB, userC].map((id, index) => ({
  id,
  email: `credit-report-${index}-${crypto.randomUUID()}@test.local`,
}));
let server;

function createPdf(text, fontSize = 12) {
  const document = new PDFDocument();
  const chunks = [];
  const complete = new Promise((resolve, reject) => {
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', resolve);
    document.on('error', reject);
  });
  document.fontSize(fontSize).text(text);
  document.end();
  return complete.then(() => Buffer.concat(chunks));
}

async function createScannedPdf(text) {
  const sourceParser = new PDFParse({ data: await createPdf(text, 22) });
  let renderedPage;
  try {
    renderedPage = (await sourceParser.getScreenshot({ scale: 2, imageDataUrl: false })).pages[0].data;
  } finally {
    await sourceParser.destroy();
  }
  const document = new PDFDocument({ size: 'A4' });
  const chunks = [];
  const complete = new Promise((resolve, reject) => {
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', resolve);
    document.on('error', reject);
  });
  document.image(renderedPage, 36, 36, { width: 522 });
  document.end();
  await complete;
  return Buffer.concat(chunks);
}

async function api(path, token, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`http://127.0.0.1:${server.address().port}/api/credit${path}`, { ...options, headers });
}

async function upload(token, fileName, text, scanned = false) {
  const form = new FormData();
  const pdf = scanned ? await createScannedPdf(text) : await createPdf(text);
  form.append('report', new Blob([pdf], { type: 'application/pdf' }), fileName);
  const response = await api('/report', token, { method: 'POST', body: form });
  return { response, data: await response.json() };
}

try {
  for (const [index, user] of users.entries()) {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, full_name)
       VALUES ($1, $2, 'test-hash', 'customer', $3)`,
      [user.id, user.email, `Credit Report User ${index}`]
    );
  }
  await grantProductMembership(userA, 'credit');
  await grantProductMembership(userB, 'credit');

  const tokens = users.map((user) => signAccessToken({ id: user.id, email: user.email, role: 'customer' }, 'credit'));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const unauthenticated = await api('/report');
  assert.equal(unauthenticated.status, 401);
  const noMembership = await api('/report', tokens[2]);
  assert.equal(noMembership.status, 403);

  const firstReportText = [
    'Credit report and account details',
    'HDFC Bank Credit Card',
    'Account Status: Active',
    'DPD: 000 030 000',
    'Personal Loan',
    'Account Status: Settled',
    'Outstanding Balance: 0',
    'Total enquiries: 5',
    'Date opened: 01/2020',
    'Review this report for current payment history and account information.',
  ].join('\n');
  const first = await upload(tokens[0], 'credit-report-first.pdf', firstReportText);
  assert.equal(first.response.status, 201);
  assert.equal(first.data.report.score.name, 'Kepwe Credit Health Score');
  assert.ok(first.data.report.score.value >= 300 && first.data.report.score.value <= 900);
  assert.ok(first.data.report.score.factors.some((factor) => factor.key === 'paymentHistory'));
  assert.ok(first.data.report.score.factors.some((factor) => factor.key === 'accountStatus'));
  assert.ok(first.data.report.score.factors.some((factor) => factor.key === 'enquiries'));
  assert.ok(first.data.report.warnings.some((warning) => warning.includes('utilisation')));
  assert.ok(first.data.report.recommendations.some((item) => item.includes('overdue')));
  assert.ok(first.data.report.recommendations.some((item) => item.includes('settled')));
  assert.ok(first.data.report.recommendations.some((item) => item.includes('utilisation')));

  const scanned = await upload(tokens[0], 'credit-report-scan.pdf', [
    'Credit report',
    'Credit Card',
    'DPD: 000 030',
    'Total enquiries: 1',
    'Account details from uploaded report',
  ].join('\n'), true);
  assert.equal(scanned.response.status, 201);
  assert.equal(scanned.data.report.extractionMethod, 'OCR');
  assert.equal(scanned.data.report.normalizedData.enquiryCount, 1);
  assert.ok(scanned.data.report.warnings.some((warning) => warning.includes('OCR')));

  const userBEmpty = await (await api('/report', tokens[1])).json();
  assert.equal(userBEmpty.report, null);

  const secondReportText = [
    'Credit report and account details',
    'ICICI Bank Credit Card',
    'Account Status: Active',
    'Credit Limit: 50000',
    'Outstanding Balance: 10000',
    'DPD: 000 000',
    'Total enquiries: 1',
    'Date opened: 03/2021',
    'Current account summary for this uploaded credit report.',
  ].join('\n');
  const replacement = await upload(tokens[0], 'credit-report-replacement.pdf', secondReportText);
  assert.equal(replacement.response.status, 201);
  assert.equal(replacement.data.report.id, first.data.report.id);
  assert.equal(replacement.data.report.fileName, 'credit-report-replacement.pdf');
  assert.equal(replacement.data.report.normalizedData.creditUtilisationPercent, 20);

  await api('/report', tokens[1], { method: 'DELETE' });
  const stillOwnedByA = await (await api('/report', tokens[0])).json();
  assert.equal(stillOwnedByA.report.fileName, 'credit-report-replacement.pdf');

  const stored = await withRLSContext(userA, (client) => client.query(
    `SELECT original_filename, octet_length(report_pdf) AS pdf_bytes, normalized_data
     FROM credit_report_analyses WHERE user_id = $1`,
    [userA]
  ));
  assert.equal(stored.rows.length, 1);
  assert.equal(stored.rows[0].original_filename, 'credit-report-replacement.pdf');
  assert.ok(stored.rows[0].pdf_bytes > 0);
  assert.equal(stored.rows[0].normalized_data.creditUtilisationPercent, 20);

  const deleted = await api('/report', tokens[0], { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  const afterDelete = await (await api('/report', tokens[0])).json();
  assert.equal(afterDelete.report, null);
  console.log('Credit report authenticated HTTP flow, scoring, replacement, deletion, and user-isolation checks passed.');
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeEmbeddedDatabase();
}