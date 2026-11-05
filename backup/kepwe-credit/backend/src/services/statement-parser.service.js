import crypto from 'crypto';
import XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { pool } from '../config/db.js';

// ── Indian Merchant & Classification Rules ──────────────────────────────────
const MERCHANT_RULES = [
  // Groceries & Daily Needs (Essential)
  { pattern: /blinkit|grofers/i, name: 'Blinkit', category: 'Groceries', classification: 'Essential', subcategory: 'Quick Commerce' },
  { pattern: /zepto/i, name: 'Zepto', category: 'Groceries', classification: 'Essential', subcategory: 'Quick Commerce' },
  { pattern: /instamart/i, name: 'Swiggy Instamart', category: 'Groceries', classification: 'Essential', subcategory: 'Quick Commerce' },
  { pattern: /bigbasket|bbdaily/i, name: 'BigBasket', category: 'Groceries', classification: 'Essential', subcategory: 'Online Groceries' },
  { pattern: /dmart|d-mart|avenue supermarts/i, name: 'D-Mart', category: 'Groceries', classification: 'Essential', subcategory: 'Supermarket' },
  { pattern: /reliance fresh|reliance smart/i, name: 'Reliance Smart', category: 'Groceries', classification: 'Essential', subcategory: 'Supermarket' },
  { pattern: /more retail|more supermarket/i, name: 'More Supermarket', category: 'Groceries', classification: 'Essential', subcategory: 'Supermarket' },
  { pattern: /country delight/i, name: 'Country Delight', category: 'Groceries', classification: 'Essential', subcategory: 'Dairy' },
  { pattern: /milkbasket/i, name: 'Milkbasket', category: 'Groceries', classification: 'Essential', subcategory: 'Dairy' },
  { pattern: /nature'?s basket/i, name: "Nature's Basket", category: 'Groceries', classification: 'Essential', subcategory: 'Supermarket' },
  { pattern: /supermarket|kirana|provision|vegetable|fruit/i, name: 'Local Groceries', category: 'Groceries', classification: 'Essential', subcategory: 'Daily Needs' },

  // Food Delivery & Dining (Lifestyle)
  { pattern: /swiggy/i, name: 'Swiggy', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Food Delivery' },
  { pattern: /zomato/i, name: 'Zomato', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Food Delivery' },
  { pattern: /starbucks/i, name: 'Starbucks', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Cafe' },
  { pattern: /chaayos/i, name: 'Chaayos', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Cafe' },
  { pattern: /chai point/i, name: 'Chai Point', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Cafe' },
  { pattern: /mcdonald|mc donald/i, name: "McDonald's", category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Fast Food' },
  { pattern: /domino'?s/i, name: "Domino's Pizza", category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Fast Food' },
  { pattern: /pizza hut/i, name: 'Pizza Hut', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Fast Food' },
  { pattern: /subway/i, name: 'Subway', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Fast Food' },
  { pattern: /kfc/i, name: 'KFC', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Fast Food' },
  { pattern: /burger king/i, name: 'Burger King', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Fast Food' },
  { pattern: /haldiram/i, name: 'Haldiram', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Dining' },
  { pattern: /barbeque nation/i, name: 'Barbeque Nation', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Dining' },
  { pattern: /restaurant|cafe|bakery|dhaba|bistro|pub|bar\b/i, name: 'Restaurant / Cafe', category: 'Dining & Food Delivery', classification: 'Lifestyle', subcategory: 'Dining' },

  // Commute & Transport (Essential / Lifestyle)
  { pattern: /uber/i, name: 'Uber', category: 'Travel & Commute', classification: 'Lifestyle', subcategory: 'Cab' },
  { pattern: /ola cabs|ola/i, name: 'Ola', category: 'Travel & Commute', classification: 'Lifestyle', subcategory: 'Cab' },
  { pattern: /rapido/i, name: 'Rapido', category: 'Travel & Commute', classification: 'Essential', subcategory: 'Bike Taxi' },
  { pattern: /irctc/i, name: 'IRCTC', category: 'Travel & Commute', classification: 'Essential', subcategory: 'Railways' },
  { pattern: /metro rail|dmrc|bmrc|mmrc/i, name: 'Metro Transit', category: 'Travel & Commute', classification: 'Essential', subcategory: 'Public Transport' },
  { pattern: /makemytrip|mmt/i, name: 'MakeMyTrip', category: 'Travel & Commute', classification: 'Lifestyle', subcategory: 'Travel Booking' },
  { pattern: /goibibo/i, name: 'Goibibo', category: 'Travel & Commute', classification: 'Lifestyle', subcategory: 'Travel Booking' },
  { pattern: /indigo|interglobe/i, name: 'IndiGo', category: 'Travel & Commute', classification: 'Lifestyle', subcategory: 'Airlines' },
  { pattern: /air india/i, name: 'Air India', category: 'Travel & Commute', classification: 'Lifestyle', subcategory: 'Airlines' },
  { pattern: /fuel|petrol|diesel|iocl|indian oil|hpcl|hindustan petroleum|bpcl|bharat petroleum|shell/i, name: 'Fuel Station', category: 'Travel & Commute', classification: 'Essential', subcategory: 'Fuel' },

  // Utilities & Bills (Essential)
  { pattern: /bescom|tata power|adani electricity|bses|cesc|electricity bill|mseb/i, name: 'Electricity Utility', category: 'Utilities', classification: 'Essential', subcategory: 'Electricity', isRecurring: true },
  { pattern: /airtel/i, name: 'Airtel', category: 'Utilities', classification: 'Essential', subcategory: 'Telecom', isRecurring: true },
  { pattern: /jio\b|reliance jio/i, name: 'Jio', category: 'Utilities', classification: 'Essential', subcategory: 'Telecom', isRecurring: true },
  { pattern: /vodafone|vi post/i, name: 'Vi (Vodafone Idea)', category: 'Utilities', classification: 'Essential', subcategory: 'Telecom', isRecurring: true },
  { pattern: /act fibernet|act broadband/i, name: 'ACT Fibernet', category: 'Utilities', classification: 'Essential', subcategory: 'Internet', isRecurring: true },
  { pattern: /hathway/i, name: 'Hathway', category: 'Utilities', classification: 'Essential', subcategory: 'Internet', isRecurring: true },
  { pattern: /water supply|water board|jal board/i, name: 'Water Board', category: 'Utilities', classification: 'Essential', subcategory: 'Water', isRecurring: true },
  { pattern: /igl|mgl|indane|bharat gas|hp gas/i, name: 'Cooking Gas Utility', category: 'Utilities', classification: 'Essential', subcategory: 'Gas', isRecurring: true },

  // Rent & Housing (Essential)
  { pattern: /rent\b|house rent|flat rent|landlord/i, name: 'House Rent', category: 'Housing & Rent', classification: 'Essential', subcategory: 'Rent', isRecurring: true },
  { pattern: /maintenance|society charges|rwa/i, name: 'Society Maintenance', category: 'Housing & Rent', classification: 'Essential', subcategory: 'Maintenance', isRecurring: true },

  // Healthcare & Medicine (Essential)
  { pattern: /apollo pharmacy|apollo/i, name: 'Apollo Pharmacy', category: 'Healthcare & Medical', classification: 'Essential', subcategory: 'Pharmacy' },
  { pattern: /netmeds/i, name: 'Netmeds', category: 'Healthcare & Medical', classification: 'Essential', subcategory: 'Pharmacy' },
  { pattern: /1mg|tata 1mg/i, name: 'Tata 1mg', category: 'Healthcare & Medical', classification: 'Essential', subcategory: 'Pharmacy' },
  { pattern: /pharmeasy/i, name: 'PharmEasy', category: 'Healthcare & Medical', classification: 'Essential', subcategory: 'Pharmacy' },
  { pattern: /medplus/i, name: 'MedPlus', category: 'Healthcare & Medical', classification: 'Essential', subcategory: 'Pharmacy' },
  { pattern: /hospital|clinic|doctor|pharmacy|diagnostic|pathology|dental/i, name: 'Healthcare Provider', category: 'Healthcare & Medical', classification: 'Essential', subcategory: 'Medical Services' },

  // Shopping & E-Commerce (Lifestyle)
  { pattern: /amazon/i, name: 'Amazon', category: 'Shopping', classification: 'Lifestyle', subcategory: 'E-Commerce' },
  { pattern: /flipkart/i, name: 'Flipkart', category: 'Shopping', classification: 'Lifestyle', subcategory: 'E-Commerce' },
  { pattern: /myntra/i, name: 'Myntra', category: 'Shopping', classification: 'Lifestyle', subcategory: 'Fashion' },
  { pattern: /ajio/i, name: 'Ajio', category: 'Shopping', classification: 'Lifestyle', subcategory: 'Fashion' },
  { pattern: /nykaa/i, name: 'Nykaa', category: 'Shopping', classification: 'Lifestyle', subcategory: 'Beauty' },
  { pattern: /tata cliq/i, name: 'Tata CLiQ', category: 'Shopping', classification: 'Lifestyle', subcategory: 'E-Commerce' },
  { pattern: /zara/i, name: 'Zara', category: 'Shopping', classification: 'Lifestyle', subcategory: 'Apparel' },
  { pattern: /h&m|h and m/i, name: 'H&M', category: 'Shopping', classification: 'Lifestyle', subcategory: 'Apparel' },
  { pattern: /croma/i, name: 'Croma Electronics', category: 'Shopping', classification: 'Lifestyle', subcategory: 'Electronics' },
  { pattern: /reliance digital/i, name: 'Reliance Digital', category: 'Shopping', classification: 'Lifestyle', subcategory: 'Electronics' },
  { pattern: /decathlon/i, name: 'Decathlon', category: 'Shopping', classification: 'Lifestyle', subcategory: 'Sports & Outdoors' },

  // Entertainment & Subscriptions (Lifestyle)
  { pattern: /netflix/i, name: 'Netflix', category: 'Entertainment & Subscriptions', classification: 'Lifestyle', subcategory: 'Streaming', isRecurring: true },
  { pattern: /spotify/i, name: 'Spotify', category: 'Entertainment & Subscriptions', classification: 'Lifestyle', subcategory: 'Music', isRecurring: true },
  { pattern: /prime video|amazon prime/i, name: 'Amazon Prime', category: 'Entertainment & Subscriptions', classification: 'Lifestyle', subcategory: 'Streaming', isRecurring: true },
  { pattern: /hotstar|disney\+ hotstar/i, name: 'Disney+ Hotstar', category: 'Entertainment & Subscriptions', classification: 'Lifestyle', subcategory: 'Streaming', isRecurring: true },
  { pattern: /youtube premium|google youtube/i, name: 'YouTube Premium', category: 'Entertainment & Subscriptions', classification: 'Lifestyle', subcategory: 'Streaming', isRecurring: true },
  { pattern: /bookmyshow|bms/i, name: 'BookMyShow', category: 'Entertainment & Subscriptions', classification: 'Lifestyle', subcategory: 'Movies' },
  { pattern: /pvr|inox/i, name: 'PVR INOX Cinemas', category: 'Entertainment & Subscriptions', classification: 'Lifestyle', subcategory: 'Movies' },
  { pattern: /apple\.com|apple services/i, name: 'Apple Services', category: 'Entertainment & Subscriptions', classification: 'Lifestyle', subcategory: 'Subscriptions', isRecurring: true },

  // Investments & Wealth (Financial)
  { pattern: /zerodha/i, name: 'Zerodha Broking', category: 'Investments', classification: 'Financial', subcategory: 'Brokerage', isInvestment: true },
  { pattern: /groww/i, name: 'Groww', category: 'Investments', classification: 'Financial', subcategory: 'Mutual Funds / Stocks', isInvestment: true },
  { pattern: /angel one|angel broking/i, name: 'Angel One', category: 'Investments', classification: 'Financial', subcategory: 'Brokerage', isInvestment: true },
  { pattern: /upstox/i, name: 'Upstox', category: 'Investments', classification: 'Financial', subcategory: 'Brokerage', isInvestment: true },
  { pattern: /kuvera/i, name: 'Kuvera', category: 'Investments', classification: 'Financial', subcategory: 'Mutual Funds', isInvestment: true },
  { pattern: /smallcase/i, name: 'Smallcase', category: 'Investments', classification: 'Financial', subcategory: 'Equities', isInvestment: true },
  { pattern: /mutual fund|cams\b|karvy|kfintech|nippon mf|hdfc mf|sbi mf|icici pru mf/i, name: 'Mutual Fund Investment', category: 'Investments', classification: 'Financial', subcategory: 'Mutual Funds', isInvestment: true },

  // Banking, EMI & Debt Obligations (Financial / Essential)
  { pattern: /cred\b|cred\.club/i, name: 'CRED Club', category: 'Credit Card Payment', classification: 'Financial', subcategory: 'Card Bill Pay' },
  { pattern: /cc payment|credit card bill|card payment|hdfc cc|sbi card|icici card/i, name: 'Credit Card Bill Payment', category: 'Credit Card Payment', classification: 'Financial', subcategory: 'Card Bill Pay' },
  { pattern: /emi\b|loan emi|home loan|car loan|personal loan|bajaj finance/i, name: 'Loan EMI', category: 'Loan EMI', classification: 'Essential', subcategory: 'Debt Repayment', isRecurring: true },
  { pattern: /insurance|lic of india|hdfc life|icici lombard|max life|star health/i, name: 'Insurance Premium', category: 'Insurance', classification: 'Essential', subcategory: 'Insurance', isRecurring: true },

  // Income Sources
  { pattern: /salary|payroll|wages|sal cr|monthly pay/i, name: 'Employer Salary', category: 'Salary', classification: 'Essential', isIncome: true, isRecurring: true },
  { pattern: /dividend/i, name: 'Dividend Income', category: 'Investment Returns', classification: 'Financial', isIncome: true },
  { pattern: /interest cr|interest paid/i, name: 'Savings Interest', category: 'Investment Returns', classification: 'Financial', isIncome: true },
];

// Helper: parse numbers safely
export function parseNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val).replace(/[₹,\s]/g, '').replace(/INR|Rs\.?/gi, '').trim();
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

// Helper: normalize Indian dates into YYYY-MM-DD
export function normalizeDate(rawDate) {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    return rawDate.toISOString().slice(0, 10);
  }
  const str = String(rawDate).trim();
  
  // ISO standard: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Indian standard: DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
  const inMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (inMatch) {
    const [, d, m, y] = inMatch;
    const fullYear = y.length === 2 ? `20${y}` : y;
    return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Text month: 12-Sep-2026 or 12 Sep 2026
  const monthNames = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const textMonthMatch = str.match(/^(\d{1,2})[-/\s]+([A-Za-z]{3})[-/\s]+(\d{2,4})/);
  if (textMonthMatch) {
    const [, d, mon, y] = textMonthMatch;
    const m = monthNames[mon.toLowerCase()] || '01';
    const fullYear = y.length === 2 ? `20${y}` : y;
    return `${fullYear}-${m}-${d.padStart(2, '0')}`;
  }

  // Fallback to Date parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

// Clean UPI narration
export function cleanUpiNarration(description) {
  let text = String(description || '').trim();
  let merchant = null;
  let counterparty = null;
  let paymentMethod = 'Bank Transfer';
  let reference = null;

  // General UPI indicator
  if (/^UPI\b/i.test(text) || /\bUPI\b/i.test(text) || /\bUPI\//i.test(text) || /\bUPI-/i.test(text)) {
    paymentMethod = 'UPI';
  }

  // Pattern: UPI/anything...
  const upiSlashParts = text.split('/');
  if (upiSlashParts.length >= 3 && /^UPI$/i.test(upiSlashParts[0])) {
    reference = upiSlashParts[1].match(/^\d+$/) ? upiSlashParts[1] : null;
    counterparty = upiSlashParts[reference ? 2 : 1].trim();
    paymentMethod = 'UPI';
  }

  // Pattern: UPI-SWIGGY-12345
  const upiHyphenMatch = text.match(/UPI-([A-Za-z0-9\s]+)-(\d+)/i);
  if (upiHyphenMatch) {
    counterparty = upiHyphenMatch[1].trim();
    reference = upiHyphenMatch[2];
    paymentMethod = 'UPI';
  }

  // Pattern: UPI/merchant@handle
  const upiHandleMatch = text.match(/UPI\/([A-Za-z0-9._-]+)@([a-zA-Z]+)/i);
  if (upiHandleMatch) {
    counterparty = upiHandleMatch[1].replace(/[._-]/g, ' ').trim();
    paymentMethod = 'UPI';
  }

  // Pattern: NEFT/IMPS/RTGS
  if (/NEFT/i.test(text)) paymentMethod = 'NEFT';
  else if (/IMPS/i.test(text)) paymentMethod = 'IMPS';
  else if (/RTGS/i.test(text)) paymentMethod = 'RTGS';
  else if (/POS|CARD/i.test(text)) paymentMethod = 'Debit Card';

  // Pattern: Paid to X or Received from Y
  const paidToMatch = text.match(/Paid to\s+([^,\n\r]+)/i);
  if (paidToMatch) counterparty = paidToMatch[1].trim();

  const recFromMatch = text.match(/Received from\s+([^,\n\r]+)/i);
  if (recFromMatch) counterparty = recFromMatch[1].trim();

  return { counterparty, paymentMethod, reference };
}

// Classify transaction based on narration and amount
export function classifyTransaction(description, rawDebit, rawCredit, customType = null) {
  const text = String(description || '').trim();
  const debit = parseNumber(rawDebit);
  const credit = parseNumber(rawCredit);

  let type = customType || (credit > 0 && debit === 0 ? 'income' : 'expense');
  let amount = debit > 0 ? debit : credit;
  let category = type === 'income' ? 'Other Income' : 'Uncategorized Expense';
  let classification = type === 'income' ? 'Essential' : 'Other';
  let subcategory = null;
  let merchant = null;
  let isRecurring = false;
  let confidence = 0.50;

  // Clean UPI details
  const upiInfo = cleanUpiNarration(text);
  if (upiInfo.counterparty) {
    merchant = upiInfo.counterparty;
  }

  // Match against Indian merchant rules
  for (const rule of MERCHANT_RULES) {
    if (rule.pattern.test(text)) {
      merchant = rule.name;
      category = rule.category;
      classification = rule.classification;
      subcategory = rule.subcategory || null;
      confidence = 0.95;

      if (rule.isRecurring) isRecurring = true;
      if (rule.isInvestment) type = 'investment';
      if (rule.isIncome) type = 'income';
      break;
    }
  }

  // Fallback heuristic rules if no merchant matched
  if (confidence === 0.50) {
    if (/salary|wages|stipend|consulting fee/i.test(text)) {
      type = 'income';
      category = 'Salary';
      classification = 'Essential';
      confidence = 0.85;
      isRecurring = true;
    } else if (/rent|society/i.test(text)) {
      category = 'Housing & Rent';
      classification = 'Essential';
      confidence = 0.80;
      isRecurring = true;
    } else if (/electricity|water|gas|wifi|broadband|recharge/i.test(text)) {
      category = 'Utilities';
      classification = 'Essential';
      confidence = 0.80;
      isRecurring = true;
    } else if (/hospital|clinic|pharma|medical|medicine/i.test(text)) {
      category = 'Healthcare & Medical';
      classification = 'Essential';
      confidence = 0.80;
    } else if (/food|hotel|restaurant|sweets|bakery|snacks/i.test(text)) {
      category = 'Dining & Food Delivery';
      classification = 'Lifestyle';
      confidence = 0.75;
    } else if (/cloth|fashion|mall|retail|mart\b/i.test(text)) {
      category = 'Shopping';
      classification = 'Lifestyle';
      confidence = 0.75;
    } else if (/petrol|fuel|toll|parking|auto|cab\b/i.test(text)) {
      category = 'Travel & Commute';
      classification = 'Essential';
      confidence = 0.75;
    } else if (/tax|gst|tds|challan/i.test(text)) {
      category = 'Taxes';
      classification = 'Other';
      confidence = 0.80;
    } else if (/interest/i.test(text) && credit > 0) {
      category = 'Investment Returns';
      classification = 'Financial';
      confidence = 0.80;
    }
  }

  if (!merchant && upiInfo.counterparty) {
    merchant = upiInfo.counterparty;
  }
  if (!merchant) {
    merchant = text.slice(0, 40).replace(/[^A-Za-z0-9\s]/g, ' ').trim() || 'General Transaction';
  }

  return {
    merchant,
    category,
    subcategory,
    classification,
    type,
    amount,
    isRecurring,
    confidence,
    paymentMethod: upiInfo.paymentMethod || 'UPI',
    referenceNumber: upiInfo.reference || null,
  };
}

// ── 1. CSV & Excel Parser ───────────────────────────────────────────────────
export function parseExcelOrCsv(buffer, fileName = 'statement.csv') {
  const lower = fileName.toLowerCase();
  let rawRows = [];

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  } else {
    // Robust CSV parser
    const text = buffer.toString('utf-8');
    const workbook = XLSX.read(text, { type: 'string', raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error('No readable data rows found in the uploaded CSV/Excel spreadsheet.');
  }

  // Find column mapping dynamically
  const normalizedTransactions = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const keys = Object.keys(row);
    if (keys.length === 0) continue;

    // Helper to find key by variants (exact match first, then specific prefixes/substrings)
    const findVal = (variants) => {
      // First pass: exact match
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (variants.some((v) => cleanK === v)) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
        }
      }
      // Second pass: longer prefix or substring match (length >= 4 to avoid 'cr' matching 'description')
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (variants.some((v) => v.length >= 4 && (cleanK.startsWith(v) || cleanK.includes(v)))) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
        }
      }
      return '';
    };

    const dateStr = findVal(['txndate', 'transactiondate', 'valuedate', 'postdate', 'date', 'trandate', 'time']);
    const descStr = findVal(['narration', 'description', 'particulars', 'remarks', 'details', 'transactiondetails', 'payee', 'merchant']);
    const debitStr = findVal(['debit', 'withdrawal', 'dr', 'debitamount', 'withdrawalamount', 'spent', 'paidout']);
    const creditStr = findVal(['credit', 'deposit', 'cr', 'creditamount', 'depositamount', 'received', 'paidin']);
    const amountStr = findVal(['amount', 'txnamount', 'netamount']);
    const balanceStr = findVal(['balance', 'runningbalance', 'closingbalance', 'availbalance']);
    const refStr = findVal(['reference', 'refno', 'referencenumber', 'utr', 'rrn', 'chequeno', 'chqno', 'txnid']);
    const typeIndicator = findVal(['type', 'trantype', 'drcr', 'crdr']).toLowerCase();

    let debit = parseNumber(debitStr);
    let credit = parseNumber(creditStr);
    const amount = parseNumber(amountStr);

    if (debit === 0 && credit === 0 && amount > 0) {
      if (typeIndicator.includes('cr') || typeIndicator.includes('deposit') || typeIndicator.includes('credit')) {
        credit = amount;
      } else {
        debit = amount;
      }
    }

    // Skip rows without valid amounts or dates
    if (debit === 0 && credit === 0) continue;
    const normalizedDate = normalizeDate(dateStr);

    const classified = classifyTransaction(descStr, debit, credit);

    normalizedTransactions.push({
      date: normalizedDate,
      description: descStr || `${classified.type.toUpperCase()} - ${classified.merchant}`,
      merchant: classified.merchant,
      amount: classified.amount,
      type: classified.type,
      category: classified.category,
      subcategory: classified.subcategory,
      classification: classified.classification,
      paymentMethod: classified.paymentMethod,
      referenceNumber: refStr || classified.referenceNumber,
      balance: parseNumber(balanceStr) || null,
      isRecurring: classified.isRecurring,
      confidence: classified.confidence,
      sourceRow: idx + 1,
    });
  }

  if (normalizedTransactions.length === 0) {
    throw new Error('Could not identify any valid financial transaction rows. Ensure the spreadsheet contains Date, Description, and Debit/Credit columns.');
  }

  return normalizedTransactions;
}

// ── 2. Bank Statement PDF Parser ────────────────────────────────────────────
export async function parsePdfStatement(buffer) {
  let parsed;
  try {
    const parser = new PDFParse({ data: buffer });
    parsed = await parser.getText();
  } catch (err) {
    throw new Error(`Failed to read PDF file: ${err.message}. If this is a password-protected PDF, please remove the password.`);
  }

  const text = parsed?.text || '';
  if (!text || text.trim().length === 0) {
    throw new Error('PDF contains no readable text. If this is a scanned document, please use the Screenshot/Image OCR option.');
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const transactions = [];

  // Regex patterns for Indian bank statement rows
  // Example: 12/09/2026 UPI/SWIGGY/12345/BLR 450.00 0.00 12,450.00
  // or: 12-Sep-2026 SALARY CREDIT ACME CORP 85000.00 97,450.00
  const dateRegex = /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{2,4})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateRegex);
    if (!dateMatch) continue;

    const rawDate = dateMatch[1];
    const rest = line.slice(dateMatch[0].length).trim();

    // Extract all numbers with decimals at the end of the line (Debit, Credit, Balance)
    const amountMatches = rest.match(/([\d,]+\.\d{2})/g);
    if (!amountMatches || amountMatches.length === 0) continue;

    // The text between the date and the numbers is the narration
    const firstAmountIndex = rest.indexOf(amountMatches[0]);
    const narration = rest.slice(0, firstAmountIndex).trim();

    let debit = 0;
    let credit = 0;
    let balance = null;

    if (amountMatches.length >= 3) {
      debit = parseNumber(amountMatches[0]);
      credit = parseNumber(amountMatches[1]);
      balance = parseNumber(amountMatches[2]);
    } else if (amountMatches.length === 2) {
      const amt1 = parseNumber(amountMatches[0]);
      const amt2 = parseNumber(amountMatches[1]);
      if (/dr|debit|withdrawal/i.test(line)) {
        debit = amt1;
        balance = amt2;
      } else if (/cr|credit|deposit/i.test(line)) {
        credit = amt1;
        balance = amt2;
      } else {
        // Look at narration keywords
        if (/salary|refund|deposit|interest/i.test(narration)) {
          credit = amt1;
        } else {
          debit = amt1;
        }
        balance = amt2;
      }
    } else if (amountMatches.length === 1) {
      const amt = parseNumber(amountMatches[0]);
      if (/cr|credit|deposit|salary|refund/i.test(line)) {
        credit = amt;
      } else {
        debit = amt;
      }
    }

    if (debit === 0 && credit === 0) continue;

    const classified = classifyTransaction(narration, debit, credit);

    transactions.push({
      date: normalizeDate(rawDate),
      description: narration || `${classified.type.toUpperCase()} transaction`,
      merchant: classified.merchant,
      amount: classified.amount,
      type: classified.type,
      category: classified.category,
      subcategory: classified.subcategory,
      classification: classified.classification,
      paymentMethod: classified.paymentMethod,
      referenceNumber: classified.referenceNumber,
      balance,
      isRecurring: classified.isRecurring,
      confidence: classified.confidence,
      sourceRow: i + 1,
    });
  }

  if (transactions.length === 0) {
    throw new Error('No structured bank transactions could be extracted from this PDF. Please verify this is a valid Indian bank statement or try exporting to CSV.');
  }

  return transactions;
}

// ── 3. Image / Screenshot OCR Parser (tesseract.js) ─────────────────────────
export async function parseImageOcr(buffer, mimeType = 'image/png') {
  let Tesseract;
  try {
    Tesseract = await import('tesseract.js');
  } catch (err) {
    throw new Error('OCR engine is not available on this server.');
  }

  let text = '';
  try {
    const worker = await Tesseract.createWorker('eng');
    const ret = await worker.recognize(buffer);
    text = ret.data.text || '';
    await worker.terminate();
  } catch (err) {
    throw new Error(`OCR processing failed: ${err.message}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error('No legible text could be extracted from this image. Please upload a clear, higher-resolution screenshot.');
  }

  // Extract financial attributes from OCR text
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Extract Amount: matches ₹1,200.00 or Rs. 500 or 1200.00
  let detectedAmount = 0;
  for (const line of lines) {
    const amtMatch = line.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i) ||
                     line.match(/([\d,]+\.\d{2})/);
    if (amtMatch) {
      const val = parseNumber(amtMatch[1]);
      if (val > 0 && (detectedAmount === 0 || val > detectedAmount)) {
        detectedAmount = val;
      }
    }
  }

  if (detectedAmount === 0) {
    // Attempt bare integer amount if large
    for (const line of lines) {
      const bareMatch = line.match(/^(\d{2,6})$/);
      if (bareMatch) {
        detectedAmount = parseNumber(bareMatch[1]);
        break;
      }
    }
  }

  if (detectedAmount === 0) {
    throw new Error('Could not identify a valid transaction amount in the uploaded screenshot. Please check the image clarity or enter manually.');
  }

  // Determine Direction
  const fullText = text.toLowerCase();
  const isIncoming = /received from|credit|deposited to|refund/i.test(fullText) && !/paid to|sent to/i.test(fullText);
  const type = isIncoming ? 'income' : 'expense';

  // Extract Merchant / Recipient
  let merchant = 'Payment via Screenshot';
  let counterparty = null;

  for (const line of lines) {
    const toMatch = line.match(/(?:To|Paid to|Transferred to)\s*[:\-]?\s*([A-Za-z0-9\s&'.]+)/i);
    if (toMatch && toMatch[1].trim().length > 2) {
      counterparty = toMatch[1].trim();
      break;
    }
    const fromMatch = line.match(/(?:From|Received from)\s*[:\-]?\s*([A-Za-z0-9\s&'.]+)/i);
    if (fromMatch && fromMatch[1].trim().length > 2) {
      counterparty = fromMatch[1].trim();
      break;
    }
  }

  // Extract Reference / UTR / UPI ID
  let reference = null;
  const refMatch = text.match(/(?:UPI Ref|Ref No|UTR|Transaction ID|Txn ID)\s*[:\-]?\s*([A-Za-z0-9]+)/i);
  if (refMatch) {
    reference = refMatch[1].trim();
  }

  // Extract Date
  let date = new Date().toISOString().slice(0, 10);
  const dateMatch = text.match(/(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/);
  if (dateMatch) {
    date = normalizeDate(dateMatch[1]);
  }

  const narration = counterparty || text.slice(0, 80).replace(/\n/g, ' ');
  const classified = classifyTransaction(narration, type === 'expense' ? detectedAmount : 0, type === 'income' ? detectedAmount : 0, type);

  return [{
    date,
    description: `OCR Screenshot: ${narration}`,
    merchant: classified.merchant,
    amount: detectedAmount,
    type: classified.type,
    category: classified.category,
    subcategory: classified.subcategory,
    classification: classified.classification,
    paymentMethod: 'UPI',
    referenceNumber: reference,
    balance: null,
    isRecurring: classified.isRecurring,
    confidence: Math.max(0.65, classified.confidence - 0.15), // Lower confidence for OCR review
    needsReview: true,
    sourceRow: 1,
  }];
}

// ── 4. Duplicate Detection Engine ───────────────────────────────────────────
export async function detectDuplicates(userId, stagedTransactions) {
  if (!stagedTransactions || stagedTransactions.length === 0) return stagedTransactions;

  // Determine date bounds of the batch
  const dates = stagedTransactions.map((t) => t.date).filter(Boolean);
  let minDate = dates.reduce((a, b) => (a < b ? a : b), new Date().toISOString().slice(0, 10));
  let maxDate = dates.reduce((a, b) => (a > b ? a : b), new Date().toISOString().slice(0, 10));

  // Expand bounds by 3 days for fuzzy date matching
  const minD = new Date(minDate); minD.setDate(minD.getDate() - 3);
  const maxD = new Date(maxDate); maxD.setDate(maxD.getDate() + 3);
  const startStr = minD.toISOString().slice(0, 10);
  const endStr = maxD.toISOString().slice(0, 10);

  // Fetch existing user transactions in this window
  const existingRes = await pool.query(
    `SELECT id, to_char(transaction_date, 'YYYY-MM-DD') AS transaction_date, amount, type, merchant, description, reference_number, category
     FROM ledger_transactions
     WHERE user_id = $1 AND transaction_date >= $2::date AND transaction_date <= $3::date`,
    [userId, startStr, endStr]
  );
  const existingList = existingRes.rows;

  // Track duplicates within the batch as well
  const seenBatchKeys = new Map();

  return stagedTransactions.map((tx) => {
    let isDuplicate = false;
    let matchConfidence = 0;
    let matchReason = '';
    let matchedTx = null;

    // 1. Check against PostgreSQL database records
    for (const ex of existingList) {
      const sameAmount = Math.abs(Number(ex.amount) - Number(tx.amount)) < 0.01;
      const sameType = ex.type === tx.type;

      if (sameAmount && sameType) {
        const exDateStr = normalizeDate(ex.transaction_date);
        const exactDate = exDateStr === tx.date;
        const sameRef = tx.referenceNumber && ex.reference_number && tx.referenceNumber === ex.reference_number;
        const sameMerchant = tx.merchant && ex.merchant && tx.merchant.toLowerCase() === ex.merchant.toLowerCase();

        if (sameRef) {
          isDuplicate = true;
          matchConfidence = 1.0;
          matchReason = `Identical Reference / UTR (${tx.referenceNumber}) already recorded in Ledger`;
          matchedTx = { id: ex.id, date: exDateStr, amount: ex.amount, merchant: ex.merchant };
          break;
        }

        if (exactDate && sameMerchant) {
          isDuplicate = true;
          matchConfidence = 0.95;
          matchReason = `Identical Date (${tx.date}), Amount (₹${tx.amount}), and Merchant (${tx.merchant})`;
          matchedTx = { id: ex.id, date: exDateStr, amount: ex.amount, merchant: ex.merchant };
          break;
        }

        if (exactDate) {
          isDuplicate = true;
          matchConfidence = 0.85;
          matchReason = `Matching Date (${tx.date}) and Amount (₹${tx.amount}) with existing record '${ex.merchant || ex.description}'`;
          matchedTx = { id: ex.id, date: exDateStr, amount: ex.amount, merchant: ex.merchant };
          break;
        }

        // Fuzzy match: within 2 days with same merchant
        const d1 = new Date(tx.date);
        const d2 = new Date(exDateStr);
        const dayDiff = Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
        if (dayDiff <= 2 && sameMerchant) {
          isDuplicate = true;
          matchConfidence = 0.75;
          matchReason = `Likely duplicate: ₹${tx.amount} to ${tx.merchant} on ${exDateStr} (within 2 days)`;
          matchedTx = { id: ex.id, date: exDateStr, amount: ex.amount, merchant: ex.merchant };
          break;
        }
      }
    }

    // 2. Check for duplicate within the current batch
    const batchKey = `${tx.date}|${tx.amount}|${tx.type}|${tx.referenceNumber || tx.merchant}`;
    if (!isDuplicate && seenBatchKeys.has(batchKey)) {
      isDuplicate = true;
      matchConfidence = 0.90;
      matchReason = 'Repeated identical transaction within this statement';
    } else {
      seenBatchKeys.set(batchKey, true);
    }

    return {
      ...tx,
      isDuplicate,
      duplicateConfidence: matchConfidence,
      duplicateReason: matchReason,
      matchedExistingTx: matchedTx,
      needsReview: isDuplicate || (tx.confidence !== undefined && tx.confidence < 0.75),
    };
  });
}
