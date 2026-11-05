import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import { buildCreditReportAnalysis, processCreditReportPdf } from '../src/services/credit-report.service.js';

const reportText = [
  'Credit report',
  'Credit Card',
  'HDFC Bank',
  'Account Status: Active',
  'Credit Limit: 100000',
  'Outstanding Balance: 20000',
  'DPD: 000 030 000',
  'Personal Loan',
  'Account Status: Settled',
  'Outstanding Balance: 0',
  'Credit Card',
  'Account Status: Active',
  'Credit Limit: 50000',
  'Outstanding Balance: 10000',
  'Total enquiries: 2',
  'Date opened: 01/2020',
].join('\n');

const analysis = buildCreditReportAnalysis(reportText, 'TEXT');
assert.equal(analysis.score.name, 'Kepwe Credit Health Score');
assert.equal(analysis.normalizedData.accountCount, 3);
assert.deepEqual(analysis.normalizedData.accountTypes, ['CREDIT_CARD', 'PERSONAL_LOAN']);
assert.equal(analysis.normalizedData.creditUtilisationPercent, 20);
assert.equal(analysis.normalizedData.settledAccountCount, 1);
assert.equal(analysis.normalizedData.totalOutstandingBalance, null);
assert.equal(analysis.normalizedData.accountStatusCount, 3);
assert.equal(analysis.normalizedData.enquiryCount, 2);
assert.equal(analysis.normalizedData.dpdHistory.length, 3);
assert.ok(analysis.score.value >= 300 && analysis.score.value <= 900);
assert.ok(analysis.score.factors.some((factor) => factor.key === 'creditUtilisation'));

const incomplete = buildCreditReportAnalysis('Credit report', 'TEXT');
assert.equal(incomplete.score.value, null);
assert.equal(incomplete.normalizedData.creditUtilisationPercent, null);
assert.equal(incomplete.normalizedData.enquiryCount, null);
assert.ok(incomplete.warnings.length > 0);

const partialCards = buildCreditReportAnalysis([
  'Credit report',
  'Credit Card',
  'Credit Limit: 50000',
  'Outstanding Balance: 10000',
  'Credit Card',
  'Credit Limit: 100000',
].join('\n'), 'TEXT');
assert.equal(partialCards.normalizedData.accountCount, 2);
assert.equal(partialCards.normalizedData.creditUtilisationPercent, null);
assert.equal(partialCards.score.value, null);

const unreadableStatus = buildCreditReportAnalysis([
  'Credit report',
  'Credit Card',
  'Current Balance: 2500',
].join('\n'), 'TEXT');
assert.equal(unreadableStatus.normalizedData.accounts[0].status, null);
assert.equal(unreadableStatus.normalizedData.accountStatusCount, 0);

const pdfDocument = new PDFDocument();
const pdfChunks = [];
const pdfComplete = new Promise((resolve, reject) => {
  pdfDocument.on('data', (chunk) => pdfChunks.push(chunk));
  pdfDocument.on('end', resolve);
  pdfDocument.on('error', reject);
});
pdfDocument.fontSize(12).text('Credit report for a customer. Credit Card account. Payment history and DPD: 000 030. Total enquiries: 1. Review account details and outstanding balances.');
pdfDocument.end();
await pdfComplete;
const extractedPdf = await processCreditReportPdf(Buffer.concat(pdfChunks));
assert.equal(extractedPdf.extractionMethod, 'TEXT');
assert.equal(extractedPdf.normalizedData.enquiryCount, 1);

console.log('Credit report parsing, PDF extraction, and scoring checks passed.');