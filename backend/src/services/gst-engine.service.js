import crypto from 'crypto';
import { pool, hasDb } from '../config/db.js';
import * as accountingEngine from './accounting-engine.service.js';
import * as invoiceEngine from './invoice-engine.service.js';
import { roundMoney } from './accounting-engine.service.js';
import { formatDateOnly } from '../lib/date-utils.js';


// ── Indian State Code Master ────────────────────────────────────────────────
export const INDIAN_STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
};

// ── 1. DETERMINISTIC GST CALCULATION HELPER ──────────────────────────────────
export function calculateGstBreakdown({ supplierStateCode, placeOfSupplyCode, taxableAmount, gstRate, isReverseCharge = false }) {
  const taxable = roundMoney(taxableAmount);
  const rate = Number(gstRate) || 0;
  const isIntraState = String(supplierStateCode) === String(placeOfSupplyCode);

  let cgstRate = 0, cgstAmount = 0;
  let sgstRate = 0, sgstAmount = 0;
  let igstRate = 0, igstAmount = 0;

  if (isIntraState) {
    cgstRate = roundMoney(rate / 2);
    sgstRate = roundMoney(rate / 2);
    cgstAmount = roundMoney((taxable * cgstRate) / 100);
    sgstAmount = roundMoney((taxable * sgstRate) / 100);
  } else {
    igstRate = rate;
    igstAmount = roundMoney((taxable * igstRate) / 100);
  }

  const totalTax = roundMoney(cgstAmount + sgstAmount + igstAmount);
  const totalAmount = roundMoney(taxable + totalTax);

  return {
    isIntraState,
    taxableAmount: taxable,
    gstRate: rate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalTaxAmount: totalTax,
    totalAmount,
    isReverseCharge: Boolean(isReverseCharge)
  };
}

// ── 2. GSTR-1 RETURN PREPARATION ────────────────────────────────────────────
export async function prepareGstr1Data(companyId, taxPeriod) {
  // Format: taxPeriod is YYYY-MM (e.g. 2026-09)
  const profile = await accountingEngine.getCompanyProfile(companyId);
  const invoicesRes = await invoiceEngine.getGstInvoices(companyId, { limit: 10000 });
  const allInvoices = invoicesRes.invoices.filter((i) => i.status !== 'Cancelled');
  const creditDebitNotes = await invoiceEngine.getCreditDebitNotes(companyId);

  // Filter for the requested tax period
  const invoices = allInvoices.filter((i) => i.invoiceDate.startsWith(taxPeriod));
  const cdNotes = creditDebitNotes.filter((n) => n.noteDate.startsWith(taxPeriod));

  // Table 4: B2B Invoices (Supplies to registered persons)
  const b2bInvoices = invoices
    .filter((i) => i.customerGstin && i.customerGstin.length === 15)
    .map((i) => ({
      invoiceNumber: i.invoiceNumber,
      invoiceDate: i.invoiceDate,
      customerName: i.customerName,
      customerGstin: i.customerGstin,
      placeOfSupply: i.placeOfSupplyCode,
      reverseCharge: i.reverseCharge ? 'Y' : 'N',
      invoiceType: 'Regular',
      taxableValue: i.taxableAmount,
      totalTax: i.totalTaxAmount,
      cgst: i.cgstAmount,
      sgst: i.sgstAmount,
      igst: i.igstAmount,
      totalInvoiceValue: i.totalAmount
    }));

  // Table 5: B2C Large (Inter-state invoice value > ₹2.5 Lakhs to unregistered persons)
  const b2cLarge = invoices
    .filter((i) => (!i.customerGstin || i.customerGstin.length !== 15) && i.placeOfSupplyCode !== profile.stateCode && i.totalAmount > 250000)
    .map((i) => ({
      invoiceNumber: i.invoiceNumber,
      invoiceDate: i.invoiceDate,
      placeOfSupply: i.placeOfSupplyCode,
      taxableValue: i.taxableAmount,
      igst: i.igstAmount,
      totalInvoiceValue: i.totalAmount
    }));

  // Table 7: B2C Small (Other unregistered supplies)
  const b2cSmallList = invoices.filter(
    (i) => (!i.customerGstin || i.customerGstin.length !== 15) && !(i.placeOfSupplyCode !== profile.stateCode && i.totalAmount > 250000)
  );

  const b2cSmallGrouped = {};
  b2cSmallList.forEach((i) => {
    const key = `${i.placeOfSupplyCode}_${i.igstAmount > 0 ? 'INTER' : 'INTRA'}`;
    if (!b2cSmallGrouped[key]) {
      b2cSmallGrouped[key] = { placeOfSupply: i.placeOfSupplyCode, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
    }
    b2cSmallGrouped[key].taxableValue = roundMoney(b2cSmallGrouped[key].taxableValue + i.taxableAmount);
    b2cSmallGrouped[key].cgst = roundMoney(b2cSmallGrouped[key].cgst + i.cgstAmount);
    b2cSmallGrouped[key].sgst = roundMoney(b2cSmallGrouped[key].sgst + i.sgstAmount);
    b2cSmallGrouped[key].igst = roundMoney(b2cSmallGrouped[key].igst + i.igstAmount);
    b2cSmallGrouped[key].totalTax = roundMoney(b2cSmallGrouped[key].totalTax + i.totalTaxAmount);
  });

  // Table 9B: Credit/Debit Notes
  const cdnList = cdNotes.map((n) => ({
    noteNumber: n.noteNumber,
    noteType: n.noteType === 'CREDIT_NOTE' ? 'C' : 'D',
    noteDate: n.noteDate,
    originalInvoiceNumber: n.originalInvoiceNumber,
    partyName: n.partyName,
    partyGstin: n.partyGstin,
    reasonCode: n.reasonCode,
    taxableValue: n.taxableAmount,
    cgst: n.cgstAmount,
    sgst: n.sgstAmount,
    igst: n.igstAmount,
    totalValue: n.totalAmount
  }));

  // Table 12: HSN Summary of Outward Supplies
  const hsnMap = new Map();
  invoices.forEach((inv) => {
    (inv.items || []).forEach((item) => {
      const hsn = item.hsnSac || '998311';
      if (!hsnMap.has(hsn)) {
        hsnMap.set(hsn, {
          hsnCode: hsn,
          description: item.itemDescription,
          uqc: item.unit || 'NOS',
          totalQuantity: 0,
          totalTaxableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0
        });
      }
      const entry = hsnMap.get(hsn);
      entry.totalQuantity += item.quantity;
      entry.totalTaxableValue = roundMoney(entry.totalTaxableValue + item.taxableValue);
      entry.cgst = roundMoney(entry.cgst + item.cgstAmount);
      entry.sgst = roundMoney(entry.sgst + item.sgstAmount);
      entry.igst = roundMoney(entry.igst + item.igstAmount);
      entry.totalTax = roundMoney(entry.totalTax + item.cgstAmount + item.sgstAmount + item.igstAmount);
    });
  });

  // Table 13: Document Summary
  const docSummary = {
    invoices: {
      totalCount: invoices.length,
      firstNumber: invoices[invoices.length - 1]?.invoiceNumber || 'N/A',
      lastNumber: invoices[0]?.invoiceNumber || 'N/A',
      cancelledCount: allInvoices.filter((i) => i.invoiceDate.startsWith(taxPeriod) && i.status === 'Cancelled').length
    },
    creditNotes: {
      totalCount: cdNotes.filter((n) => n.noteType === 'CREDIT_NOTE').length
    },
    debitNotes: {
      totalCount: cdNotes.filter((n) => n.noteType === 'DEBIT_NOTE').length
    }
  };

  const totalTaxable = roundMoney(invoices.reduce((acc, i) => acc + i.taxableAmount, 0));
  const totalCgst = roundMoney(invoices.reduce((acc, i) => acc + i.cgstAmount, 0));
  const totalSgst = roundMoney(invoices.reduce((acc, i) => acc + i.sgstAmount, 0));
  const totalIgst = roundMoney(invoices.reduce((acc, i) => acc + i.igstAmount, 0));
  const totalTax = roundMoney(totalCgst + totalSgst + totalIgst);
  const totalInvoiceValue = roundMoney(invoices.reduce((acc, i) => acc + i.totalAmount, 0));

  return {
    taxPeriod,
    gstin: profile.gstin,
    legalName: profile.legalName,
    summary: {
      totalInvoices: invoices.length,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      totalInvoiceValue
    },
    table4_b2b: b2bInvoices,
    table5_b2cLarge: b2cLarge,
    table7_b2cSmall: Object.values(b2cSmallGrouped),
    table9b_cdn: cdnList,
    table12_hsn: Array.from(hsnMap.values()),
    table13_documents: docSummary,
    preparedAt: new Date().toISOString()
  };
}

// ── 3. GSTR-3B PREPARATION & STATUTORY TAX OFFSET RULES ─────────────────────
export async function calculateGstr3b(companyId, taxPeriod) {
  const gstr1 = await prepareGstr1Data(companyId, taxPeriod);
  const billsRes = await invoiceEngine.getVendorBills(companyId, { limit: 10000 });
  const bills = billsRes.bills.filter((b) => b.billDate.startsWith(taxPeriod) && b.status !== 'Cancelled');

  // 1. Table 3.1: Outward Supplies Liability
  const table31 = {
    outwardTaxable: {
      taxableValue: gstr1.summary.totalTaxable,
      igst: gstr1.summary.totalIgst,
      cgst: gstr1.summary.totalCgst,
      sgst: gstr1.summary.totalSgst,
      totalTax: roundMoney(gstr1.summary.totalCgst + gstr1.summary.totalSgst + gstr1.summary.totalIgst),
      cess: 0.0
    },
    outwardZeroRated: { taxableValue: 0, igst: 0, cess: 0 },
    otherOutwardExempt: { taxableValue: 0 },
    inwardReverseCharge: { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    nonGstSupplies: { taxableValue: 0 }
  };

  // 2. Table 4: Eligible Input Tax Credit (ITC) from Purchases
  const itcAvailable = {
    importOfGoods: { igst: 0, cess: 0 },
    importOfServices: { igst: 0, cess: 0 },
    inwardRCM: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    inwardISD: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    allOtherItc: {
      igst: roundMoney(bills.reduce((acc, b) => acc + (b.igstAmount || 0), 0)),
      cgst: roundMoney(bills.reduce((acc, b) => acc + (b.cgstAmount || 0), 0)),
      sgst: roundMoney(bills.reduce((acc, b) => acc + (b.sgstAmount || 0), 0)),
      cess: 0.0
    }
  };

  const netItcAvailable = {
    igst: itcAvailable.allOtherItc.igst,
    cgst: itcAvailable.allOtherItc.cgst,
    sgst: itcAvailable.allOtherItc.sgst,
    total: roundMoney(itcAvailable.allOtherItc.igst + itcAvailable.allOtherItc.cgst + itcAvailable.allOtherItc.sgst)
  };

  // 3. Table 6.1: Statutory ITC Offset Computation (Section 49 / Rule 88A)
  // Step 1: Output Liabilities
  let liabilityIgst = table31.outwardTaxable.igst;
  let liabilityCgst = table31.outwardTaxable.cgst;
  let liabilitySgst = table31.outwardTaxable.sgst;

  let balanceItcIgst = netItcAvailable.igst;
  let balanceItcCgst = netItcAvailable.cgst;
  let balanceItcSgst = netItcAvailable.sgst;

  let paidByItc = {
    igstPaidWithIgst: 0,
    cgstPaidWithIgst: 0,
    sgstPaidWithIgst: 0,
    cgstPaidWithCgst: 0,
    igstPaidWithCgst: 0,
    sgstPaidWithSgst: 0,
    igstPaidWithSgst: 0
  };

  // Rule 88A: IGST credit MUST be completely exhausted first!
  // First against Output IGST
  if (balanceItcIgst > 0 && liabilityIgst > 0) {
    const offset = Math.min(balanceItcIgst, liabilityIgst);
    paidByItc.igstPaidWithIgst = roundMoney(offset);
    balanceItcIgst = roundMoney(balanceItcIgst - offset);
    liabilityIgst = roundMoney(liabilityIgst - offset);
  }

  // Remaining IGST credit can be utilized for CGST then SGST
  if (balanceItcIgst > 0 && liabilityCgst > 0) {
    const offset = Math.min(balanceItcIgst, liabilityCgst);
    paidByItc.cgstPaidWithIgst = roundMoney(offset);
    balanceItcIgst = roundMoney(balanceItcIgst - offset);
    liabilityCgst = roundMoney(liabilityCgst - offset);
  }

  if (balanceItcIgst > 0 && liabilitySgst > 0) {
    const offset = Math.min(balanceItcIgst, liabilitySgst);
    paidByItc.sgstPaidWithIgst = roundMoney(offset);
    balanceItcIgst = roundMoney(balanceItcIgst - offset);
    liabilitySgst = roundMoney(liabilitySgst - offset);
  }

  // Step 2: CGST credit against CGST liability (never SGST)
  if (balanceItcCgst > 0 && liabilityCgst > 0) {
    const offset = Math.min(balanceItcCgst, liabilityCgst);
    paidByItc.cgstPaidWithCgst = roundMoney(offset);
    balanceItcCgst = roundMoney(balanceItcCgst - offset);
    liabilityCgst = roundMoney(liabilityCgst - offset);
  }
  // Balance CGST credit against remaining IGST liability
  if (balanceItcCgst > 0 && liabilityIgst > 0) {
    const offset = Math.min(balanceItcCgst, liabilityIgst);
    paidByItc.igstPaidWithCgst = roundMoney(offset);
    balanceItcCgst = roundMoney(balanceItcCgst - offset);
    liabilityIgst = roundMoney(liabilityIgst - offset);
  }

  // Step 3: SGST credit against SGST liability (never CGST)
  if (balanceItcSgst > 0 && liabilitySgst > 0) {
    const offset = Math.min(balanceItcSgst, liabilitySgst);
    paidByItc.sgstPaidWithSgst = roundMoney(offset);
    balanceItcSgst = roundMoney(balanceItcSgst - offset);
    liabilitySgst = roundMoney(liabilitySgst - offset);
  }
  // Balance SGST credit against remaining IGST liability
  if (balanceItcSgst > 0 && liabilityIgst > 0) {
    const offset = Math.min(balanceItcSgst, liabilityIgst);
    paidByItc.igstPaidWithSgst = roundMoney(offset);
    balanceItcSgst = roundMoney(balanceItcSgst - offset);
    liabilityIgst = roundMoney(liabilityIgst - offset);
  }

  // Step 4: Remaining Net Cash Tax Payable
  const cashPayable = {
    igst: liabilityIgst,
    cgst: liabilityCgst,
    sgst: liabilitySgst,
    total: roundMoney(liabilityIgst + liabilityCgst + liabilitySgst)
  };

  const closingItcBalance = {
    igst: balanceItcIgst,
    cgst: balanceItcCgst,
    sgst: balanceItcSgst,
    total: roundMoney(balanceItcIgst + balanceItcCgst + balanceItcSgst)
  };

  return {
    taxPeriod,
    table31_outwardSupplies: table31,
    table4_eligibleItc: {
      available: itcAvailable,
      netItc: netItcAvailable
    },
    table61_paymentOfTax: {
      totalLiability: {
        igst: table31.outwardTaxable.igst,
        cgst: table31.outwardTaxable.cgst,
        sgst: table31.outwardTaxable.sgst,
        total: roundMoney(table31.outwardTaxable.igst + table31.outwardTaxable.cgst + table31.outwardTaxable.sgst)
      },
      paidByItc,
      creditUtilized: {
        igst_against_igst: paidByItc.igstPaidWithIgst,
        igst_against_cgst: paidByItc.cgstPaidWithIgst,
        igst_against_sgst: paidByItc.sgstPaidWithIgst,
        cgst_against_cgst: paidByItc.cgstPaidWithCgst,
        cgst_against_igst: paidByItc.igstPaidWithCgst,
        sgst_against_sgst: paidByItc.sgstPaidWithSgst,
        sgst_against_igst: paidByItc.igstPaidWithSgst
      },
      cashPayable,
      netPayableCash: cashPayable,
      closingItcBalance
    },
    isPeriodLocked: await isTaxPeriodLocked(companyId, taxPeriod),
    calculatedAt: new Date().toISOString()
  };
}

// ── 4. GST RECONCILIATION ENGINE ─────────────────────────────────────────────
export async function runGstReconciliation(companyId, taxPeriod, external2bFeed = null) {
  const billsRes = await invoiceEngine.getVendorBills(companyId, { limit: 10000 });
  const booksBills = billsRes.bills.filter((b) => b.billDate.startsWith(taxPeriod));

  // GSTR-2B portal records: use passed feed or stored imported 2B records
  const storedFeed = await getGstr2bFeed(companyId, taxPeriod);
  const portalFeed = external2bFeed || storedFeed;

  const matched = [];
  const mismatched = [];
  const missingInBooks = [];
  const missingInReturns = [];

  const matchedPortalIds = new Set();
  const matchedBookIds = new Set();

  // Normalize document number: strip special chars and lower case
  const normDoc = (str) => String(str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // Step 1: Match Book Bills against Portal Feed
  for (const bill of booksBills) {
    const bookDocNorm = normDoc(bill.billNumber);
    const bookGstin = (bill.vendorGstin || '').toUpperCase().trim();

    // Find candidate in portal feed
    const portalCandidate = portalFeed.find((p) => {
      const pDocNorm = normDoc(p.documentNumber);
      const pGstin = (p.counterpartyGstin || '').toUpperCase().trim();
      return pGstin === bookGstin && (pDocNorm === bookDocNorm || pDocNorm.endsWith(bookDocNorm) || bookDocNorm.endsWith(pDocNorm));
    });

    if (portalCandidate) {
      matchedPortalIds.add(portalCandidate.id || portalCandidate.documentNumber);
      matchedBookIds.add(bill.id);

      const diffTaxable = roundMoney(Math.abs(bill.taxableAmount - portalCandidate.taxableValue));
      const diffTax = roundMoney(Math.abs(bill.totalTaxAmount - portalCandidate.taxAmount));

      if (diffTaxable <= 2.0 && diffTax <= 2.0) {
        matched.push({
          id: crypto.randomUUID(),
          companyId,
          taxPeriod,
          documentNumber: bill.billNumber,
          counterpartyName: bill.vendorName,
          counterpartyGstin: bill.vendorGstin,
          documentDate: bill.billDate,
          bookTaxable: bill.taxableAmount,
          bookTax: bill.totalTaxAmount,
          bookTotal: bill.totalAmount,
          portalTaxable: portalCandidate.taxableValue,
          portalTax: portalCandidate.taxAmount,
          portalTotal: portalCandidate.totalAmount,
          matchStatus: 'MATCHED',
          diffAmount: 0.0,
          reason: 'Exact match between Purchase Register and GSTR-2B.',
          recommendedAction: 'Claim 100% Eligible ITC in GSTR-3B.'
        });
      } else {
        mismatched.push({
          id: crypto.randomUUID(),
          companyId,
          taxPeriod,
          documentNumber: bill.billNumber,
          counterpartyName: bill.vendorName,
          counterpartyGstin: bill.vendorGstin,
          documentDate: bill.billDate,
          bookTaxable: bill.taxableAmount,
          bookTax: bill.totalTaxAmount,
          bookTotal: bill.totalAmount,
          portalTaxable: portalCandidate.taxableValue,
          portalTax: portalCandidate.taxAmount,
          portalTotal: portalCandidate.totalAmount,
          matchStatus: 'MISMATCHED',
          diffAmount: roundMoney(diffTaxable + diffTax),
          reason: `Value mismatch: Taxable Diff ₹${diffTaxable}, Tax Diff ₹${diffTax}`,
          recommendedAction: 'Verify vendor bill invoice image; reconcile with vendor before filing.'
        });
      }
    } else {
      missingInReturns.push({
        id: crypto.randomUUID(),
        companyId,
        taxPeriod,
        documentNumber: bill.billNumber,
        counterpartyName: bill.vendorName,
        counterpartyGstin: bill.vendorGstin,
        documentDate: bill.billDate,
        bookTaxable: bill.taxableAmount,
        bookTax: bill.totalTaxAmount,
        bookTotal: bill.totalAmount,
        portalTaxable: 0.0,
        portalTax: 0.0,
        portalTotal: 0.0,
        matchStatus: 'MISSING_IN_RETURNS',
        diffAmount: bill.totalTaxAmount,
        reason: 'Invoice booked in Purchase Register but NOT filed by vendor in GSTR-1.',
        recommendedAction: 'Hold ITC claim; notify vendor to file in current period.'
      });
    }
  }

  // Step 2: Identify GSTR-2B records missing in books
  for (const portalItem of portalFeed) {
    if (!matchedPortalIds.has(portalItem.id || portalItem.documentNumber)) {
      missingInBooks.push({
        id: crypto.randomUUID(),
        companyId,
        taxPeriod,
        documentNumber: portalItem.documentNumber,
        counterpartyName: portalItem.counterpartyName,
        counterpartyGstin: portalItem.counterpartyGstin,
        documentDate: portalItem.documentDate,
        bookTaxable: 0.0,
        bookTax: 0.0,
        bookTotal: 0.0,
        portalTaxable: portalItem.taxableValue,
        portalTax: portalItem.taxAmount,
        portalTotal: portalItem.totalAmount,
        matchStatus: 'MISSING_IN_BOOKS',
        diffAmount: portalItem.taxAmount,
        reason: 'Appears in GSTR-2B but missing from Purchase Register.',
        recommendedAction: 'Create purchase bill in Books to claim eligible ITC.'
      });
    }
  }

  const allRecords = [...matched, ...mismatched, ...missingInReturns, ...missingInBooks];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM gst_reconciliation_records WHERE company_id = $1 AND tax_period = $2 AND return_type = 'GSTR-2B'`,
      [companyId, taxPeriod]
    );

    for (const r of allRecords) {
      const docDate = r.documentDate || new Date().toISOString().split('T')[0];
      await client.query(
        `INSERT INTO gst_reconciliation_records
           (id, company_id, tax_period, return_type, counterparty_gstin, counterparty_name,
            document_number, document_date, document_type, book_taxable, book_tax, book_total,
            portal_taxable, portal_tax, portal_total, match_status, diff_amount, reason, recommended_action)
         VALUES ($1, $2, $3, 'GSTR-2B', $4, $5, $6, $7, 'INV', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          r.id,
          companyId,
          taxPeriod,
          r.counterpartyGstin || '',
          r.counterpartyName || 'Vendor',
          r.documentNumber || '',
          docDate,
          r.bookTaxable || 0,
          r.bookTax || 0,
          r.bookTotal || 0,
          r.portalTaxable || 0,
          r.portalTax || 0,
          r.portalTotal || 0,
          r.matchStatus,
          r.diffAmount || 0,
          r.reason || '',
          r.recommendedAction || ''
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[gst-engine] Error persisting reconciliation records:', err.message);
  } finally {
    client.release();
  }

  const summary = {
    taxPeriod,
    totalRecords: allRecords.length,
    matchedCount: matched.length,
    mismatchedCount: mismatched.length,
    missingInBooksCount: missingInBooks.length,
    missingInReturnsCount: missingInReturns.length,
    itcEligibleClaim: roundMoney(matched.reduce((acc, r) => acc + r.bookTax, 0)),
    itcAtRisk: roundMoney(missingInReturns.reduce((acc, r) => acc + r.diffAmount, 0) + mismatched.reduce((acc, r) => acc + r.diffAmount, 0))
  };

  return { summary, records: allRecords };
}

export async function importGstr2bFeed(companyId, taxPeriod, rawFeed = []) {
  if (!Array.isArray(rawFeed)) throw new Error('GSTR-2B feed must be an array of records.');
  const normalized = rawFeed.map((r) => ({
    id: r.id || crypto.randomUUID(),
    documentNumber: String(r.documentNumber || r.inum || r.invoiceNumber || '').trim(),
    documentDate: r.documentDate || r.dt || r.invoiceDate || new Date().toISOString().split('T')[0],
    counterpartyName: r.counterpartyName || r.tradeName || r.supplierName || 'Vendor',
    counterpartyGstin: String(r.counterpartyGstin || r.ctin || r.supplierGstin || '').toUpperCase().trim(),
    taxableValue: roundMoney(r.taxableValue ?? r.txval ?? 0),
    taxAmount: roundMoney(r.taxAmount ?? ((r.cgst || 0) + (r.sgst || 0) + (r.igst || 0)) ?? 0),
    totalAmount: roundMoney(r.totalAmount ?? r.val ?? ((r.taxableValue || 0) + (r.taxAmount || 0)))
  }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM gst_reconciliation_records WHERE company_id = $1 AND tax_period = $2 AND return_type = 'GSTR-2B_FEED'`,
      [companyId, taxPeriod]
    );
    for (const r of normalized) {
      await client.query(
        `INSERT INTO gst_reconciliation_records
           (id, company_id, tax_period, return_type, counterparty_gstin, counterparty_name,
            document_number, document_date, document_type, book_taxable, book_tax, book_total,
            portal_taxable, portal_tax, portal_total, match_status, diff_amount, reason, recommended_action)
         VALUES ($1, $2, $3, 'GSTR-2B_FEED', $4, $5, $6, $7, 'INV', 0, 0, 0, $8, $9, $10, 'FEED_IMPORTED', 0, 'Imported from GSTR-2B Portal', 'Awaiting matching run')`,
        [r.id, companyId, taxPeriod, r.counterpartyGstin, r.counterpartyName, r.documentNumber, r.documentDate, r.taxableValue, r.taxAmount, r.totalAmount]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { success: true, count: normalized.length, taxPeriod };
}

export async function getGstr2bFeed(companyId, taxPeriod) {
  const res = await pool.query(
    `SELECT * FROM gst_reconciliation_records WHERE company_id = $1 AND tax_period = $2 AND return_type = 'GSTR-2B_FEED' ORDER BY document_date ASC`,
    [companyId, taxPeriod]
  );
  return res.rows.map((r) => ({
    id: r.id,
    documentNumber: r.document_number,
    documentDate: formatDateOnly(r.document_date),
    counterpartyName: r.counterparty_name,
    counterpartyGstin: r.counterparty_gstin,
    taxableValue: Number(r.portal_taxable || 0),
    taxAmount: Number(r.portal_tax || 0),
    totalAmount: Number(r.portal_total || 0)
  }));
}

export async function getGstReconciliationRecords(companyId) {
  const dbRes = await pool.query(
    `SELECT * FROM gst_reconciliation_records WHERE company_id = $1 AND return_type = 'GSTR-2B' ORDER BY created_at DESC`,
    [companyId]
  );
  return dbRes.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    taxPeriod: row.tax_period,
    documentNumber: row.document_number,
    counterpartyName: row.counterparty_name,
    counterpartyGstin: row.counterparty_gstin,
    documentDate: formatDateOnly(row.document_date),
    bookTaxable: Number(row.book_taxable || 0),
    bookTax: Number(row.book_tax || 0),
    bookTotal: Number(row.book_total || 0),
    portalTaxable: Number(row.portal_taxable || 0),
    portalTax: Number(row.portal_tax || 0),
    portalTotal: Number(row.portal_total || 0),
    matchStatus: row.match_status,
    diffAmount: Number(row.diff_amount || 0),
    reason: row.reason,
    recommendedAction: row.recommended_action
  }));
}

// ── 5. TAX PERIOD LOCKING (PostgreSQL Persistent) ───────────────────────────
export async function lockTaxPeriod(companyId, taxPeriod, userId = null, reason = 'Statutory Return Filed') {
  const lockId = crypto.randomUUID();
  const res = await pool.query(
    `INSERT INTO gst_tax_period_locks (id, company_id, tax_period, locked_at, locked_by, reason)
     VALUES ($1, $2, $3, NOW(), $4, $5)
     ON CONFLICT (company_id, tax_period)
     DO UPDATE SET locked_at = NOW(), locked_by = EXCLUDED.locked_by, reason = EXCLUDED.reason
     RETURNING *`,
    [lockId, companyId, taxPeriod, userId, reason]
  );
  return {
    success: true,
    companyId,
    lockedPeriod: taxPeriod,
    lockedAt: res.rows[0].locked_at,
    reason: res.rows[0].reason
  };
}

export async function isTaxPeriodLocked(companyId, taxPeriod) {
  const res = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM gst_tax_period_locks
       WHERE company_id = $1 AND tax_period = $2
     ) AS is_locked`,
    [companyId, taxPeriod]
  );
  return Boolean(res.rows[0]?.is_locked);
}

export async function getLockedTaxPeriods(companyId) {
  const res = await pool.query(
    `SELECT tax_period, locked_at, locked_by, reason
     FROM gst_tax_period_locks
     WHERE company_id = $1
     ORDER BY tax_period DESC`,
    [companyId]
  );
  return res.rows.map((r) => ({
    taxPeriod: r.tax_period,
    lockedAt: r.locked_at,
    lockedBy: r.locked_by,
    reason: r.reason
  }));
}

