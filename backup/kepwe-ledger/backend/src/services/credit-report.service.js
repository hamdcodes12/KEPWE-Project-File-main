import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';

const MAX_PDF_PAGES = 20;
const FACTOR_WEIGHTS = {
  paymentHistory: 35,
  creditUtilisation: 30,
  accountStatus: 20,
  accountAge: 10,
  enquiries: 5,
};
const ENGLISH_OCR_DATA = createRequire(import.meta.url)('@tesseract.js-data/eng');

const ACCOUNT_TYPES = [
  { type: 'CREDIT_CARD', pattern: /credit\s*card|charge\s*card/i },
  { type: 'PERSONAL_LOAN', pattern: /personal\s+loan/i },
  { type: 'HOME_LOAN', pattern: /home\s+loan|housing\s+loan|mortgage/i },
  { type: 'AUTO_LOAN', pattern: /auto\s+loan|car\s+loan|vehicle\s+loan|two[- ]wheeler\s+loan/i },
  { type: 'OTHER_LOAN', pattern: /loan|overdraft|consumer\s+durable/i },
];

const LENDERS = /\b(HDFC(?:\s+BANK)?|ICICI(?:\s+BANK)?|SBI|STATE\s+BANK\s+OF\s+INDIA|AXIS(?:\s+BANK)?|KOTAK(?:\s+MAHINDRA)?|IDFC(?:\s+FIRST)?|BAJAJ\s+FINANCE|INDUSIND(?:\s+BANK)?|YES\s+BANK|FEDERAL\s+BANK|TATA\s+CAPITAL|LIC\s+HOUSING)\b/i;

function parseAmount(text) {
  const match = text.match(/^\s*(?:₹\s*|Rs\.?\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)\s*$/i);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(amount) ? amount : null;
}

function amountAfterLabel(lines, pattern, start = 0, end = lines.length) {
  for (let index = start; index < end; index += 1) {
    if (!pattern.test(lines[index])) continue;
    const sameLine = parseAmount(lines[index].replace(pattern, ''));
    if (sameLine !== null) return sameLine;
    for (let next = index + 1; next < Math.min(end, index + 3); next += 1) {
      const amount = parseAmount(lines[next]);
      if (amount !== null) return amount;
    }
  }
  return null;
}

function accountTypeForLine(line) {
  return ACCOUNT_TYPES.find(({ pattern }) => pattern.test(line))?.type || null;
}

function findAccountSections(lines) {
  const candidates = [];
  lines.forEach((line, index) => {
    const type = accountTypeForLine(line);
    if (!type || /\b(?:number|no\.?|total|count|summary)\s+of\b/i.test(line)) return;
    if (/payment\s+history|days\s+past\s+due|enquir(?:y|ies)|utili[sz]ation/i.test(line)) return;
    candidates.push({ index, type });
  });

  const accounts = [];
  candidates.forEach((candidate, index) => {
    const nextCandidate = candidates[index + 1]?.index ?? Math.min(lines.length, candidate.index + 14);
    const blockEnd = Math.min(nextCandidate, candidate.index + 14);
    const block = lines.slice(candidate.index, blockEnd);
    const blockText = block.join(' ');
    const lender = blockText.match(LENDERS)?.[0]?.replace(/\s+/g, ' ').toUpperCase() || null;
    const labelledStatus = blockText.match(/(?:account\s+)?status\s*[:=\-]\s*(written[- ]?off|write[- ]?off|settled|closed|paid\s+off|active|open|current)\b/i)?.[1];
    const standaloneStatus = block.find((line) => /^(?:written[- ]?off|write[- ]?off|settled|closed|paid\s+off|active|open|current)$/i.test(line));
    const statusEvidence = `${labelledStatus || standaloneStatus || ''}`;
    const hasWriteOff = /written[- ]?off|write[- ]?off/i.test(statusEvidence)
      || (/(?:written[- ]?off|write[- ]?off)/i.test(blockText) && !/\b(?:no|not)\s+(?:currently\s+)?(?:written[- ]?off|write[- ]?off)\b/i.test(blockText));
    const hasSettled = /settled/i.test(statusEvidence)
      || (/settled/i.test(blockText) && !/\b(?:not|un)\s+settled\b/i.test(blockText));
    let status = null;
    if (hasWriteOff) status = 'WRITTEN_OFF';
    else if (hasSettled) status = 'SETTLED';
    else if (/closed|paid\s+off/i.test(statusEvidence)) status = 'CLOSED';
    else if (/active|open|current/i.test(statusEvidence)) status = 'ACTIVE';

    accounts.push({
      accountType: candidate.type,
      lender,
      status,
      outstandingBalance: amountAfterLabel(block, /(?:current\s+)?(?:outstanding\s+balance|balance\s+outstanding|amount\s+due|current\s+balance)\s*[:=\-]?/i),
      creditLimit: amountAfterLabel(block, /(?:credit\s+limit|sanctioned\s+limit)\s*[:=\-]?/i),
    });
  });
  return accounts;
}

function extractDpdHistory(lines) {
  const values = [];
  for (const line of lines) {
    if (!/\b(?:dpd|days\s+past\s+due|payment\s+history|payment\s+status)\b/i.test(line)) continue;
    const tokens = line.match(/\b(?:STD|XXX|SMA|SUB|DBT|LSS|\d{1,3})\b/gi) || [];
    for (const token of tokens) {
      const normalized = token.toUpperCase();
      if (normalized === 'XXX') continue;
      const days = ({ STD: 0, SMA: 30, SUB: 90, DBT: 180, LSS: 360 })[normalized] ?? Number(normalized);
      if (Number.isFinite(days) && days >= 0 && days <= 900) values.push(days);
    }
  }
  return values.length ? values : null;
}

function dateFromText(value) {
  const clean = value.trim();
  const parts = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (parts) return new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
  const monthYear = clean.match(/^(\d{1,2})[/-](\d{4})$/);
  if (monthYear) return new Date(Number(monthYear[2]), Number(monthYear[1]) - 1, 1);
  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractOldestAccountMonths(lines) {
  const dates = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/(?:date\s+opened|opened\s+on|account\s+opening\s+date|open\s+date)/i.test(lines[index])) continue;
    const dateMatch = lines[index].match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\b/)
      || lines[index + 1]?.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\b/);
    if (dateMatch) {
      const date = dateFromText(dateMatch[0]);
      if (date && date <= new Date()) dates.push(date);
    }
  }
  if (!dates.length) return null;
  const oldest = Math.min(...dates.map((date) => date.getTime()));
  const date = new Date(oldest);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth());
}

function extractEnquiryCount(lines) {
  const explicit = lines.join('\n').match(/(?:total|number\s+of)\s+(?:credit\s+)?enquir(?:y|ies)\s*[:=\-]?\s*(\d{1,3})/i);
  if (explicit) return Number(explicit[1]);
  const heading = lines.findIndex((line) => /^\s*(?:credit\s+)?enquir(?:y|ies)(?:\s+details)?\s*:?\s*$/i.test(line));
  if (heading < 0) return null;
  const section = lines.slice(heading + 1, heading + 16);
  const rows = section.filter((line) => /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(line) && /loan|card|credit|finance|bank/i.test(line));
  return rows.length ? rows.length : null;
}

export function normalizeCreditReportText(sourceText) {
  const text = String(sourceText || '').replace(/\r/g, '\n').replace(/[\t\u00a0]+/g, ' ');
  const lines = text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const accounts = findAccountSections(lines);
  const creditCards = accounts.filter((account) => account.accountType === 'CREDIT_CARD');
  const explicitUtilisation = text.match(/(?:credit\s+)?utili[sz]ation(?:\s+ratio)?\s*[:=\-]?\s*(\d{1,3}(?:\.\d+)?)\s*%/i);
  const cardBalance = creditCards.reduce((sum, account) => sum + (account.outstandingBalance ?? 0), 0);
  const cardLimit = creditCards.reduce((sum, account) => sum + (account.creditLimit ?? 0), 0);
  const hasCompleteCardBalances = creditCards.length > 0 && creditCards.every((account) => account.outstandingBalance !== null);
  const hasCompleteCardLimits = creditCards.length > 0 && creditCards.every((account) => account.creditLimit !== null);
  const utilisation = explicitUtilisation
    ? Number(explicitUtilisation[1])
    : (hasCompleteCardBalances && hasCompleteCardLimits && cardLimit > 0 ? Math.round((cardBalance / cardLimit) * 10000) / 100 : null);
  const dpdHistory = extractDpdHistory(lines);
  const settledCount = accounts.filter((account) => account.status === 'SETTLED').length;
  const writeOffCount = accounts.filter((account) => account.status === 'WRITTEN_OFF').length;
  const totalOutstanding = amountAfterLabel(lines, /total\s+(?:current\s+)?(?:outstanding\s+balance|balance\s+outstanding|amount\s+due)\s*[:=\-]?/i);
  const knownStatuses = accounts.filter((account) => account.status !== null);

  return {
    accountCount: accounts.length || null,
    accounts,
    accountTypes: [...new Set(accounts.map((account) => account.accountType))],
    dpdHistory,
    accountStatusCount: knownStatuses.length,
    settledAccountCount: knownStatuses.length ? settledCount : null,
    writeOffAccountCount: knownStatuses.length ? writeOffCount : null,
    creditUtilisationPercent: utilisation !== null && utilisation <= 1000 ? utilisation : null,
    enquiryCount: extractEnquiryCount(lines),
    oldestAccountAgeMonths: extractOldestAccountMonths(lines),
    totalOutstandingBalance: totalOutstanding,
  };
}

export function calculateKepweCreditHealthScore(data) {
  const observations = [];
  if (data.dpdHistory?.length) {
    const onTimeShare = data.dpdHistory.filter((days) => days === 0).length / data.dpdHistory.length;
    observations.push({ key: 'paymentHistory', value: onTimeShare, label: 'Payment history', weight: FACTOR_WEIGHTS.paymentHistory, detail: `${Math.round(onTimeShare * 100)}% of extracted payment markers show no days past due.` });
  }
  if (data.creditUtilisationPercent !== null && data.creditUtilisationPercent !== undefined) {
    const value = Math.max(0, 1 - data.creditUtilisationPercent / 100);
    observations.push({ key: 'creditUtilisation', value, label: 'Credit utilisation', weight: FACTOR_WEIGHTS.creditUtilisation, detail: `Lower utilisation scores better; extracted utilisation is ${data.creditUtilisationPercent}%.` });
  }
  const knownStatusCount = (data.accounts || []).filter((account) => account.status !== null).length;
  if (knownStatusCount > 0) {
    const negativeCount = (data.settledAccountCount || 0) + (data.writeOffAccountCount || 0);
    const value = Math.max(0, 1 - negativeCount / knownStatusCount);
    observations.push({ key: 'accountStatus', value, label: 'Account status', weight: FACTOR_WEIGHTS.accountStatus, detail: `${negativeCount} of ${knownStatusCount} accounts with readable status are settled or written off.` });
  }
  if (data.oldestAccountAgeMonths !== null && data.oldestAccountAgeMonths !== undefined) {
    const value = Math.min(1, data.oldestAccountAgeMonths / 120);
    observations.push({ key: 'accountAge', value, label: 'Account age', weight: FACTOR_WEIGHTS.accountAge, detail: `Older account history scores better, up to 10 years; oldest detected account is ${data.oldestAccountAgeMonths} months.` });
  }
  if (data.enquiryCount !== null && data.enquiryCount !== undefined) {
    const value = Math.max(0, 1 - data.enquiryCount / 10);
    observations.push({ key: 'enquiries', value, label: 'Credit enquiries', weight: FACTOR_WEIGHTS.enquiries, detail: `Fewer detected enquiries score better; ${data.enquiryCount} enquiries were extracted.` });
  }

  const observedWeight = observations.reduce((sum, factor) => sum + factor.weight, 0);
  if (!observedWeight) {
    return { name: 'Kepwe Credit Health Score', value: null, range: { min: 300, max: 900 }, band: 'Unavailable', observedWeight: 0, factors: [], method: 'Available factor values are weighted and mapped to a 300–900 range. Missing factors are excluded and the remaining weights are rebalanced; no report values are assumed.' };
  }

  const weightedValue = observations.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / observedWeight;
  const value = Math.round(300 + weightedValue * 600);
  const band = value < 550 ? 'Needs attention' : value < 650 ? 'Building' : value < 750 ? 'Healthy' : 'Strong';
  return {
    name: 'Kepwe Credit Health Score',
    value,
    range: { min: 300, max: 900 },
    band,
    observedWeight,
    factors: observations.map((factor) => ({ ...factor, scorePercent: Math.round(factor.value * 100), effectiveWeightPercent: Math.round((factor.weight / observedWeight) * 100) })),
    method: 'Score = round(300 + 600 × weighted factor average). Base weights: payment history 35%, utilisation 30%, account status 20%, account age 10%, enquiries 5%. Payment history is the share of extracted markers with zero DPD; utilisation is max(0, 1 − utilisation/100); account status is the share of readable account statuses not settled or written off; account age is min(oldest age in months/120, 1); enquiries is max(0, 1 − count/10). Only observed factors are included and their weights are rebalanced to 100%; missing values are not assumed.',
  };
}

function buildRecommendations(data, score) {
  const recommendations = [];
  if (data.dpdHistory?.some((days) => days > 0)) recommendations.push('Bring any overdue accounts current and set automatic payment reminders before each due date.');
  if (data.creditUtilisationPercent !== null && data.creditUtilisationPercent > 30) recommendations.push('If affordable, reduce revolving card balances; keeping reported utilisation below 30% may strengthen this factor.');
  if ((data.settledAccountCount || 0) > 0) recommendations.push('Review settled account entries on the source report and retain settlement letters; ask the lender to correct any inaccurate status.');
  if ((data.writeOffAccountCount || 0) > 0) recommendations.push('Contact the relevant lender about written-off accounts and check that the report reflects any agreed resolution accurately.');
  if (data.enquiryCount !== null && data.enquiryCount >= 4) recommendations.push('Limit new credit applications for now; compare eligibility before submitting formal applications.');
  if (data.creditUtilisationPercent === null) recommendations.push('Your report did not provide enough credit-limit and balance data to assess utilisation. Check that both appear on a current report.');
  if (data.dpdHistory === null) recommendations.push('Payment history was not readable in this report. Review the payment-history section directly and upload a clearer copy if needed.');
  if (!score.value) recommendations.push('Upload a report with readable account, payment, and balance details to calculate a score.');
  if (!recommendations.length) recommendations.push('Keep paying every account on time and review your report periodically for errors.');
  return recommendations;
}

export function buildCreditReportAnalysis(sourceText, extractionMethod) {
  const normalizedData = normalizeCreditReportText(sourceText);
  const score = calculateKepweCreditHealthScore(normalizedData);
  const warnings = [];
  if (!normalizedData.dpdHistory) warnings.push('Payment history was not available in readable text.');
  if (normalizedData.creditUtilisationPercent === null) warnings.push('Credit utilisation could not be calculated from the available balance and limit fields.');
  if (normalizedData.enquiryCount === null) warnings.push('Credit enquiry count was unavailable.');
  if (!normalizedData.accounts.length) warnings.push('No individual account rows could be confidently identified; detected values may be incomplete.');
  if (normalizedData.accounts.length && normalizedData.accountStatusCount < normalizedData.accounts.length) warnings.push('Some account statuses were unavailable and were excluded from account-status scoring.');
  if (extractionMethod === 'OCR') warnings.push('Values were read using OCR. Check the extracted account details against your original report.');
  return {
    extractionMethod,
    normalizedData,
    score,
    warnings,
    recommendations: buildRecommendations(normalizedData, score),
  };
}

export async function processCreditReportPdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    const error = new Error('The selected file is not a valid PDF.');
    error.status = 400;
    throw error;
  }

  const parser = new PDFParse({ data: buffer });
  let text = '';
  let extractionMethod = 'TEXT';
  try {
    const info = await parser.getInfo();
    if (!info.total || info.total > MAX_PDF_PAGES) {
      const error = new Error(`The PDF must contain between 1 and ${MAX_PDF_PAGES} pages.`);
      error.status = 400;
      throw error;
    }
    text = (await parser.getText()).text || '';
    if (text.trim().length < 80) {
      const worker = await createWorker('eng', undefined, {
        langPath: ENGLISH_OCR_DATA.langPath || dirname(createRequire(import.meta.url).resolve('@tesseract.js-data/eng')),
        cacheMethod: 'none',
      });
      try {
        const pages = [];
        for (let pageNumber = 1; pageNumber <= info.total; pageNumber += 1) {
          const rendered = await parser.getScreenshot({ partial: [pageNumber], scale: 1.5, imageDataUrl: false });
          pages.push((await worker.recognize(rendered.pages[0].data)).data.text || '');
        }
        const ocrText = pages.join('\n');
        if (ocrText.trim().length > text.trim().length) {
          text = ocrText;
          extractionMethod = 'OCR';
        }
      } finally {
        await worker.terminate();
      }
    }
  } finally {
    await parser.destroy();
  }

  if (!/credit\s+report|credit\s+information|account\s+details|payment\s+history|days\s+past\s+due|credit\s+card|personal\s+loan/i.test(text)) {
    const error = new Error('We could not identify credit-report content in this PDF. Upload a readable credit report.');
    error.status = 422;
    throw error;
  }

  return buildCreditReportAnalysis(text, extractionMethod);
}