import crypto from 'crypto';
import { pool } from '../config/db.js';
import * as accountingEngine from './accounting-engine.service.js';
import { roundMoney } from './accounting-engine.service.js';
import { formatDateOnly } from '../lib/date-utils.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function mapTransactionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    vendorPan: row.vendor_pan || '',
    hasValidPan: Boolean(row.has_valid_pan),
    billId: row.bill_id,
    billNumber: row.bill_number,
    sectionCode: row.section_code,
    grossAmount: Number(row.gross_amount || 0),
    tdsRate: Number(row.tds_rate || 0),
    tdsAmount: Number(row.tds_amount || 0),
    netPayable: Number(row.net_payable || 0),
    deductionDate: formatDateOnly(row.deduction_date),
    challanId: row.challan_id,
    isDeposited: Boolean(row.is_deposited),
    returnQuarter: row.return_quarter,
    createdAt: row.created_at
  };
}

function mapChallanRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    challanNumber: row.challan_number,
    bsrCode: row.bsr_code,
    challanDate: formatDateOnly(row.challan_date),
    challanSerial: row.challan_serial,
    minorHead: row.minor_head,
    sectionCode: row.section_code,
    taxAmount: Number(row.tax_amount || 0),
    interest: Number(row.interest || 0),
    feePenalty: Number(row.fee_penalty || 0),
    totalPaid: Number(row.total_paid || 0),
    status: 'DEPOSITED',
    bankAccountId: row.bank_account_id,
    journalEntryId: row.journal_entry_id,
    notes: row.notes || '',
    createdAt: row.created_at
  };
}

export async function getTdsRules() {
  const res = await pool.query(`SELECT * FROM tds_rules WHERE is_active = TRUE ORDER BY section_code ASC`);
  if (res.rows.length > 0) {
    return res.rows.map((r) => ({
      id: r.id,
      sectionCode: r.section_code,
      sectionName: r.section_name,
      description: r.description,
      rateIndividual: Number(r.rate_individual),
      rateCompany: Number(r.rate_company),
      thresholdSingle: Number(r.threshold_single),
      thresholdAnnual: Number(r.threshold_annual)
    }));
  }
  return [];
}

export async function calculateTds({ vendorPan, isCompany = false, sectionCode, invoiceAmount, yearToDateAmount = 0 }) {
  const rules = await getTdsRules();
  const rule = rules.find((r) => r.sectionCode === sectionCode);
  if (!rule) throw new Error(`Unknown TDS section code: ${sectionCode}`);

  const gross = roundMoney(invoiceAmount);
  const totalYtd = roundMoney(yearToDateAmount + gross);

  // Check valid PAN (4th letter determines entity type in Indian PAN format: C=Company, P=Person, H=HUF, F=Firm)
  const hasPan = Boolean(vendorPan && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(vendorPan.toUpperCase().trim()));

  if (!hasPan) {
    // Section 206AA: Higher rate of 20%
    const tdsRate = 20.0;
    const tdsAmount = roundMoney((gross * tdsRate) / 100);
    return {
      sectionCode: '206AA',
      sectionName: 'Higher Deduction under Section 206AA (No Valid PAN)',
      hasValidPan: false,
      grossAmount: gross,
      tdsRate,
      tdsAmount,
      netPayable: roundMoney(gross - tdsAmount),
      thresholdApplied: 'None (Mandatory 20%)',
      isApplicable: true
    };
  }

  const isPanCompany = isCompany || (vendorPan && vendorPan.toUpperCase().charAt(3) === 'C');
  const applicableRate = Number(isPanCompany ? rule.rateCompany : rule.rateIndividual);
  const singleThreshold = Number(rule.thresholdSingle || 0);
  const annualThreshold = Number(rule.thresholdAnnual || 0);

  let isApplicable = false;
  if (singleThreshold > 0 && gross >= singleThreshold) {
    isApplicable = true;
  } else if (annualThreshold > 0 && totalYtd >= annualThreshold) {
    isApplicable = true;
  }

  const tdsAmount = isApplicable ? roundMoney((gross * applicableRate) / 100) : 0;
  const netPayable = roundMoney(gross - tdsAmount);

  return {
    sectionCode,
    sectionName: rule.sectionName,
    hasValidPan: true,
    grossAmount: gross,
    tdsRate: isApplicable ? applicableRate : 0,
    tdsAmount,
    netPayable,
    thresholdSingle: singleThreshold,
    thresholdAnnual: annualThreshold,
    isApplicable
  };
}

export async function recordTdsTransaction(companyId, userId, data) {
  const calculation = await calculateTds({
    vendorPan: data.vendorPan,
    isCompany: data.isCompany,
    sectionCode: data.sectionCode,
    invoiceAmount: data.grossAmount,
    yearToDateAmount: data.yearToDateAmount || 0
  });

  const txId = crypto.randomUUID();
  const deductionDate = data.deductionDate || new Date().toISOString().split('T')[0];
  const quarter = getQuarterFromDate(deductionDate);

  const insertRes = await pool.query(
    `INSERT INTO tds_transactions
       (id, company_id, vendor_id, vendor_name, vendor_pan, has_valid_pan,
        bill_id, bill_number, section_code, gross_amount, tds_rate, tds_amount,
        net_payable, deduction_date, challan_id, is_deposited, return_quarter)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, FALSE, $15)
     RETURNING *`,
    [
      txId,
      companyId,
      data.vendorId || null,
      data.vendorName || 'Vendor',
      data.vendorPan || '',
      calculation.hasValidPan,
      data.billId || null,
      data.billNumber || null,
      calculation.sectionCode,
      calculation.grossAmount,
      calculation.tdsRate,
      calculation.tdsAmount,
      calculation.netPayable,
      deductionDate,
      quarter
    ]
  );

  return mapTransactionRow(insertRes.rows[0]);
}

export async function getTdsTransactions(companyId, filters = {}) {
  let query = `SELECT * FROM tds_transactions WHERE company_id = $1`;
  const params = [companyId];
  let pIndex = 2;

  if (filters.sectionCode) {
    query += ` AND section_code = $${pIndex++}`;
    params.push(filters.sectionCode);
  }
  if (filters.isDeposited !== undefined) {
    query += ` AND is_deposited = $${pIndex++}`;
    params.push(Boolean(filters.isDeposited));
  }
  if (filters.quarter) {
    query += ` AND (return_quarter = $${pIndex} OR return_quarter LIKE $${pIndex} || '-%')`;
    params.push(filters.quarter);
    pIndex++;
  }

  query += ` ORDER BY deduction_date DESC, created_at DESC`;

  const res = await pool.query(query, params);
  const transactions = res.rows.map(mapTransactionRow);

  const totalGross = roundMoney(transactions.reduce((acc, t) => acc + t.grossAmount, 0));
  const totalTdsDeducted = roundMoney(transactions.reduce((acc, t) => acc + t.tdsAmount, 0));
  const pendingDeposit = roundMoney(transactions.filter((t) => !t.isDeposited).reduce((acc, t) => acc + t.tdsAmount, 0));

  return {
    summary: { totalGross, totalTdsDeducted, pendingDeposit, count: transactions.length },
    transactions
  };
}

// ── Record ITNS 281 Challan Deposit ──────────────────────────────────────────
export async function recordTdsChallanDeposit(companyId, userId, challanData) {
  const bsrCode = challanData.bsrCode?.trim();
  const challanSerial = (challanData.challanSerial || challanData.challanNumber)?.trim();
  const taxAmount = roundMoney(challanData.taxAmount ?? challanData.amount ?? 0);
  if (!bsrCode || !challanSerial || taxAmount <= 0) {
    throw new Error('Valid BSR Code, Challan Serial Number, and Tax Amount are required.');
  }

  const challanId = crypto.randomUUID();
  const challanDate = challanData.challanDate || new Date().toISOString().split('T')[0];
  const sectionCode = challanData.sectionCode || '194J';
  const interest = roundMoney(challanData.interest || 0);
  const feePenalty = roundMoney(challanData.feePenalty || 0);
  const totalPaid = roundMoney(taxAmount + interest + feePenalty);

  // Post balanced double-entry journal for TDS payment:
  // Debit: TDS Payable (reduces tax liability)
  // Credit: Bank Account
  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const tdsAcc = coa.find((a) => a.code === '2031') || coa.find((a) => a.subtype === 'TDS_PAYABLE');
  const bankAcc = challanData.bankAccountId
    ? coa.find((a) => a.id === challanData.bankAccountId)
    : coa.find((a) => a.code === '1010') || coa.find((a) => a.subtype === 'BANK');

  if (!tdsAcc || !bankAcc) {
    throw new Error('Required TDS Payable or Bank accounts not found in Chart of Accounts.');
  }

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: challanDate,
    narration: `TDS Challan 281 Deposit (BSR: ${bsrCode}, S/N: ${challanSerial}, Sec: ${sectionCode})`,
    referenceType: 'PAYMENT',
    referenceId: challanId,
    referenceNumber: `CHALLAN-281-${challanSerial}`,
    lines: [
      { accountId: tdsAcc.id, debit: totalPaid, credit: 0, narration: `TDS Deposit under Sec ${sectionCode}` },
      { accountId: bankAcc.id, debit: 0, credit: totalPaid, narration: `Paid via ${bankAcc.name}` }
    ]
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const challanRes = await client.query(
      `INSERT INTO tds_challans
         (id, company_id, challan_number, bsr_code, challan_date, challan_serial,
          minor_head, section_code, tax_amount, interest, fee_penalty, total_paid,
          bank_account_id, journal_entry_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        challanId,
        companyId,
        `ITNS-281-${challanSerial}`,
        bsrCode,
        challanDate,
        challanSerial,
        challanData.minorHead || '200',
        sectionCode,
        taxAmount,
        interest,
        feePenalty,
        totalPaid,
        bankAcc.id,
        journalEntry.id,
        challanData.notes || ''
      ]
    );

    // Mark matching pending TDS transactions as deposited
    await client.query(
      `UPDATE tds_transactions
       SET is_deposited = TRUE, challan_id = $1
       WHERE company_id = $2 AND section_code = $3 AND is_deposited = FALSE`,
      [challanId, companyId, sectionCode]
    );

    await client.query('COMMIT');
    return { challan: mapChallanRow(challanRes.rows[0]), journalEntry };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getTdsChallans(companyId) {
  const res = await pool.query(
    `SELECT * FROM tds_challans WHERE company_id = $1 ORDER BY challan_date DESC, created_at DESC`,
    [companyId]
  );
  return res.rows.map(mapChallanRow);
}

// ── 4. FORM 26Q RETURN PREPARATION ──────────────────────────────────────────
export async function prepareForm26q(companyId, quarter) {
  const profile = await accountingEngine.getCompanyProfile(companyId);
  const txsRes = await getTdsTransactions(companyId, { quarter });
  const challansRes = await getTdsChallans(companyId);

  const quarterTxs = txsRes.transactions;
  const compChallans = challansRes;

  const sectionBreakdown = {};
  quarterTxs.forEach((t) => {
    if (!sectionBreakdown[t.sectionCode]) {
      sectionBreakdown[t.sectionCode] = { sectionCode: t.sectionCode, totalGross: 0, totalTds: 0, deducteeCount: 0 };
    }
    sectionBreakdown[t.sectionCode].totalGross = roundMoney(sectionBreakdown[t.sectionCode].totalGross + t.grossAmount);
    sectionBreakdown[t.sectionCode].totalTds = roundMoney(sectionBreakdown[t.sectionCode].totalTds + t.tdsAmount);
    sectionBreakdown[t.sectionCode].deducteeCount++;
  });

  const totalDeductions = roundMoney(quarterTxs.reduce((acc, t) => acc + t.tdsAmount, 0));
  const totalChallansPaid = roundMoney(compChallans.reduce((acc, c) => acc + c.totalPaid, 0));

  const deducteeRecords = quarterTxs.map((t, idx) => ({
    serialNo: idx + 1,
    deducteeName: t.vendorName,
    pan: t.vendorPan,
    section: t.sectionCode,
    paymentDate: t.deductionDate,
    grossAmount: t.grossAmount,
    tdsRate: t.tdsRate,
    tdsAmount: t.tdsAmount,
    status: t.isDeposited ? 'DEPOSITED' : 'PENDING_DEPOSIT',
    challanId: t.challanId
  }));

  return {
    quarter: quarter || 'Q2-2026',
    tan: profile.tan,
    pan: profile.pan,
    companyName: profile.legalName,
    summary: {
      totalDeductees: quarterTxs.length,
      totalGrossPayments: roundMoney(quarterTxs.reduce((acc, t) => acc + t.grossAmount, 0)),
      totalTdsDeducted: totalDeductions,
      totalTdsDeposited: totalChallansPaid,
      balancePayable: roundMoney(Math.max(0, totalDeductions - totalChallansPaid))
    },
    sectionSummary: Object.values(sectionBreakdown),
    deducteeRecords,
    annexures: deducteeRecords,
    challans: compChallans,
    preparedAt: new Date().toISOString()
  };
}

function getQuarterFromDate(dateStr) {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month >= 4 && month <= 6) return `Q1-${year}`;
  if (month >= 7 && month <= 9) return `Q2-${year}`;
  if (month >= 10 && month <= 12) return `Q3-${year}`;
  return `Q4-${year}`;
}
