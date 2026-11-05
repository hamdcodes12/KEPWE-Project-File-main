import crypto from 'crypto';
import { pool, hasDb } from '../config/db.js';
import * as accountingEngine from './accounting-engine.service.js';
import * as tdsEngine from './tds-engine.service.js';
import { roundMoney } from './accounting-engine.service.js';
import { formatDateOnly } from '../lib/date-utils.js';



// ── 1. INVOICE ENGINE SERVICE ────────────────────────────────────────────────
export async function createGstInvoice(companyId, userId, data) {
  const customerName = data.customerName?.trim();
  if (!customerName) throw new Error('Customer name is required.');

  const items = data.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('An invoice must contain at least one line item.');
  }

  const profile = await accountingEngine.getCompanyProfile(companyId, userId);
  const supplierStateCode = profile.stateCode || '27';
  const customerPosCode = data.placeOfSupplyCode || supplierStateCode;
  const isIntraState = supplierStateCode === customerPosCode;

  // Process and compute line items
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalDiscount = 0;

  const processedItems = items.map((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const unitPrice = roundMoney(item.unitPrice || 0);
    const discPct = Number(item.discountPercent) || 0;
    const rawValue = roundMoney(qty * unitPrice);
    const lineDiscount = roundMoney((rawValue * discPct) / 100);
    const taxableValue = roundMoney(Math.max(0, rawValue - lineDiscount));
    const gstRate = Number(item.gstRate ?? 18);

    let cgstRate = 0, cgstAmount = 0;
    let sgstRate = 0, sgstAmount = 0;
    let igstRate = 0, igstAmount = 0;

    if (isIntraState) {
      cgstRate = roundMoney(gstRate / 2);
      sgstRate = roundMoney(gstRate / 2);
      cgstAmount = roundMoney((taxableValue * cgstRate) / 100);
      sgstAmount = roundMoney((taxableValue * sgstRate) / 100);
    } else {
      igstRate = gstRate;
      igstAmount = roundMoney((taxableValue * igstRate) / 100);
    }

    const itemTotal = roundMoney(taxableValue + cgstAmount + sgstAmount + igstAmount);

    subtotal = roundMoney(subtotal + taxableValue);
    totalCgst = roundMoney(totalCgst + cgstAmount);
    totalSgst = roundMoney(totalSgst + sgstAmount);
    totalIgst = roundMoney(totalIgst + igstAmount);
    totalDiscount = roundMoney(totalDiscount + lineDiscount);

    return {
      itemDescription: item.itemDescription || item.name || 'Service/Product',
      hsnSac: item.hsnSac || item.hsn || '998311',
      quantity: qty,
      unit: item.unit || 'NOS',
      unitPrice,
      discountPercent: discPct,
      discountAmount: lineDiscount,
      taxableValue,
      gstRate,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      totalItemAmount: itemTotal,
      sortOrder: idx
    };
  });

  const totalTax = roundMoney(totalCgst + totalSgst + totalIgst);
  const grandTotal = roundMoney(subtotal + totalTax);

  const invoiceId = crypto.randomUUID();
  const year = new Date().getFullYear();
  const invoiceNumber = data.invoiceNumber?.trim() || `INV-${year}-${Date.now().toString().slice(-5)}`;
  const invoiceDate = data.invoiceDate || new Date().toISOString().split('T')[0];
  const dueDate = data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // Idempotency check: prevent duplicate invoice numbers
  const existingInv = await pool.query(
    `SELECT id FROM gst_invoices WHERE company_id = $1 AND invoice_number = $2`,
    [companyId, invoiceNumber]
  );
  if (existingInv.rows.length > 0) {
    return await getInvoiceById(companyId, existingInv.rows[0].id);
  }

  // ── Automatically Create Double-Entry Accounting Journal ───────────────────
  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const arAccount = coa.find((a) => a.code === '1030') || coa.find((a) => a.subtype === 'ACCOUNTS_RECEIVABLE');
  const salesAccount = coa.find((a) => a.code === '4010') || coa.find((a) => a.subtype === 'SALES_REVENUE');
  const cgstAccount = coa.find((a) => a.code === '2020') || coa.find((a) => a.subtype === 'GST_PAYABLE');
  const sgstAccount = coa.find((a) => a.code === '2021') || coa.find((a) => a.subtype === 'GST_PAYABLE');
  const igstAccount = coa.find((a) => a.code === '2022') || coa.find((a) => a.subtype === 'GST_PAYABLE');

  if (!arAccount || !salesAccount) {
    throw new Error('Chart of Accounts missing required Accounts Receivable (1030) or Sales Revenue (4010) account.');
  }

  const journalLines = [
    { accountId: arAccount.id, debit: grandTotal, credit: 0, narration: `Receivable from ${customerName}` },
    { accountId: salesAccount.id, debit: 0, credit: subtotal, narration: `Sales Revenue on ${invoiceNumber}` }
  ];

  if (isIntraState) {
    if (totalCgst > 0 && cgstAccount) {
      journalLines.push({ accountId: cgstAccount.id, debit: 0, credit: totalCgst, narration: `Output CGST on ${invoiceNumber}` });
    }
    if (totalSgst > 0 && sgstAccount) {
      journalLines.push({ accountId: sgstAccount.id, debit: 0, credit: totalSgst, narration: `Output SGST on ${invoiceNumber}` });
    }
  } else {
    if (totalIgst > 0 && igstAccount) {
      journalLines.push({ accountId: igstAccount.id, debit: 0, credit: totalIgst, narration: `Output IGST on ${invoiceNumber}` });
    }
  }

  // Adjust any tiny 1-paisa rounding difference between grandTotal and lines
  const totalDebits = journalLines.reduce((acc, l) => acc + l.debit, 0);
  const totalCredits = roundMoney(journalLines.reduce((acc, l) => acc + l.credit, 0));
  if (Math.abs(totalDebits - totalCredits) > 0.001) {
    journalLines[0].debit = totalCredits; // sync debtor debit to exact sum of credits
  }

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: invoiceDate,
    narration: `Invoice #${invoiceNumber} to ${customerName}`,
    referenceType: 'INVOICE',
    referenceId: invoiceId,
    referenceNumber: invoiceNumber,
    lines: journalLines
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invRes = await client.query(
      `INSERT INTO gst_invoices
         (id, company_id, user_id, invoice_number, customer_name, customer_gstin, customer_pan, customer_email, customer_phone,
          billing_address, shipping_address, place_of_supply, place_of_supply_code, supply_type, invoice_date, due_date, payment_terms,
          reverse_charge, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax_amount, discount_amount, total_amount,
          paid_amount, outstanding_amount, status, journal_entry_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 0.00, $25, 'Pending', $26, $27)
       RETURNING *`,
      [
        invoiceId, companyId, userId, invoiceNumber, customerName, data.customerGstin || null, data.customerPan || null, data.customerEmail || null, data.customerPhone || null,
        data.billingAddress || null, data.shippingAddress || null, data.placeOfSupply || 'Maharashtra', customerPosCode, data.supplyType || (data.customerGstin ? 'B2B' : 'B2C_SMALL'),
        invoiceDate, dueDate, data.paymentTerms || 'Net 30', Boolean(data.reverseCharge), subtotal, totalCgst, totalSgst, totalIgst, totalTax, totalDiscount, grandTotal,
        journalEntry.id, data.notes || null
      ]
    );

    for (const item of processedItems) {
      await client.query(
        `INSERT INTO gst_invoice_items
           (invoice_id, item_description, hsn_sac, quantity, unit, unit_price, discount_percent, discount_amount, taxable_value, gst_rate,
            cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_item_amount, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          invoiceId, item.itemDescription, item.hsnSac, item.quantity, item.unit, item.unitPrice, item.discountPercent, item.discountAmount, item.taxableValue, item.gstRate,
          item.cgstRate, item.cgstAmount, item.sgstRate, item.sgstAmount, item.igstRate, item.igstAmount, item.totalItemAmount, item.sortOrder
        ]
      );
    }

    await client.query('COMMIT');
    return {
      ...mapInvoiceHeader(invRes.rows[0]),
      items: processedItems,
      journalEntry
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getGstInvoices(companyId, filters = {}) {
  const { status, search, dateFrom, dateTo, page = 1, limit = 50 } = filters;

  if (hasDb()) {
    const params = [companyId];
    const where = ['company_id = $1'];
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      where.push(`invoice_date >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      where.push(`invoice_date <= $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(customer_name ILIKE $${params.length} OR invoice_number ILIKE $${params.length} OR customer_gstin ILIKE $${params.length})`);
    }

    const whereClause = where.join(' AND ');
    const countRes = await pool.query(`SELECT COUNT(*) FROM gst_invoices WHERE ${whereClause}`, params);
    const totalCount = parseInt(countRes.rows[0].count, 10) || 0;

    const offset = (Math.max(1, page) - 1) * limit;
    params.push(limit);
    params.push(offset);

    const res = await pool.query(
      `SELECT * FROM gst_invoices WHERE ${whereClause} ORDER BY invoice_date DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const invoicesWithItems = await Promise.all(
      res.rows.map(async (row) => {
        const itemRes = await pool.query(
          `SELECT * FROM gst_invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC`,
          [row.id]
        );
        return {
          ...mapInvoiceHeader(row),
          items: itemRes.rows.map(mapInvoiceItem)
        };
      })
    );

    return {
      invoices: invoicesWithItems,
      totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / limit) || 1
    };
  }

  return {
    invoices: [],
    totalCount: 0,
    page: Number(page),
    limit: Number(limit),
    totalPages: 1
  };
}

export async function getInvoiceById(companyId, invoiceId) {
  const res = await pool.query(
    `SELECT * FROM gst_invoices WHERE id = $1 AND company_id = $2`,
    [invoiceId, companyId]
  );
  if (res.rows.length === 0) throw new Error('Invoice not found.');
  const itemRes = await pool.query(
    `SELECT * FROM gst_invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC`,
    [invoiceId]
  );
  return {
    ...mapInvoiceHeader(res.rows[0]),
    items: itemRes.rows.map(mapInvoiceItem)
  };
}

export async function recordInvoicePayment(companyId, invoiceId, userId, paymentData) {
  const payAmount = roundMoney(paymentData.amount);
  if (payAmount <= 0) throw new Error('Payment amount must be greater than zero.');

  const paymentDate = paymentData.paymentDate || new Date().toISOString().split('T')[0];
  const paymentMethod = paymentData.paymentMethod || 'Bank Transfer';
  const referenceNumber = paymentData.referenceNumber || null;

  const invoice = await getInvoiceById(companyId, invoiceId);

  const remaining = roundMoney(invoice.totalAmount - invoice.paidAmount);
  if (payAmount > remaining + 0.01) {
    throw new Error(`Payment amount (₹${payAmount}) exceeds outstanding balance (₹${remaining}).`);
  }

  const newPaid = roundMoney(invoice.paidAmount + payAmount);
  const newOutstanding = roundMoney(Math.max(0, invoice.totalAmount - newPaid));
  const newStatus = newOutstanding <= 0.01 ? 'Paid' : 'Partially Paid';

  // ── Post Balanced Customer Receipt Journal Entry ───────────────────────────
  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const bankAcc = paymentData.accountId
    ? coa.find((a) => a.id === paymentData.accountId)
    : coa.find((a) => a.code === '1010') || coa.find((a) => a.subtype === 'BANK');
  const arAccount = coa.find((a) => a.code === '1030') || coa.find((a) => a.subtype === 'ACCOUNTS_RECEIVABLE');

  if (!bankAcc || !arAccount) {
    throw new Error('Required Bank or Accounts Receivable accounts not found in Chart of Accounts.');
  }

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: paymentDate,
    narration: `Payment received for Invoice #${invoice.invoiceNumber} from ${invoice.customerName}`,
    referenceType: 'PAYMENT',
    referenceId: invoiceId,
    referenceNumber: referenceNumber || invoice.invoiceNumber,
    lines: [
      { accountId: bankAcc.id, debit: payAmount, credit: 0, narration: `Funds received in ${bankAcc.name}` },
      { accountId: arAccount.id, debit: 0, credit: payAmount, narration: `Receivable reduction on #${invoice.invoiceNumber}` }
    ]
  });

  if (hasDb()) {
    await pool.query(
      `UPDATE gst_invoices
       SET paid_amount = $1, outstanding_amount = $2, status = $3, updated_at = NOW()
       WHERE id = $4 AND company_id = $5`,
      [newPaid, newOutstanding, newStatus, invoiceId, companyId]
    );
  } else {
    invoice.paidAmount = newPaid;
    invoice.outstandingAmount = newOutstanding;
    invoice.status = newStatus;
    invoice.updatedAt = new Date().toISOString();
  }

  return {
    success: true,
    invoice: { ...invoice, paidAmount: newPaid, outstandingAmount: newOutstanding, status: newStatus },
    journalEntry
  };
}

// ── 2. PURCHASES / VENDOR BILLS ENGINE ───────────────────────────────────────
export async function createVendorBill(companyId, userId, data) {
  const vendorName = data.vendorName?.trim();
  if (!vendorName) throw new Error('Vendor name is required.');

  const subtotal = roundMoney(data.subtotal || data.taxableAmount || 0);
  const gstRate = Number(data.gstRate ?? 18);
  const profile = await accountingEngine.getCompanyProfile(companyId, userId);
  const supplierStateCode = profile.stateCode || '27';
  const vendorPosCode = data.placeOfSupplyCode || supplierStateCode;
  const isIntraState = supplierStateCode === vendorPosCode;

  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
  if (isIntraState) {
    cgstAmount = roundMoney((subtotal * (gstRate / 2)) / 100);
    sgstAmount = roundMoney((subtotal * (gstRate / 2)) / 100);
  } else {
    igstAmount = roundMoney((subtotal * gstRate) / 100);
  }
  const totalTax = roundMoney(cgstAmount + sgstAmount + igstAmount);
  const totalAmount = roundMoney(subtotal + totalTax);

  // TDS Deduction Check
  const tdsSection = data.tdsSection || null;
  let tdsAmount = 0;
  if (tdsSection && data.tdsAmount) {
    tdsAmount = roundMoney(data.tdsAmount);
  }

  const netPayable = roundMoney(totalAmount - tdsAmount);

  const billId = crypto.randomUUID();
  const year = new Date().getFullYear();
  const billNumber = data.billNumber?.trim() || `BILL-${year}-${Date.now().toString().slice(-5)}`;
  const billDate = data.billDate || new Date().toISOString().split('T')[0];
  const dueDate = data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // Idempotency check: prevent duplicate bill creation
  const existingBill = await pool.query(
    `SELECT id FROM ledger_payables WHERE (company_id = $1 OR user_id = $2) AND bill_number = $3`,
    [companyId, userId, billNumber]
  );
  if (existingBill.rows.length > 0) {
    return await getVendorBillById(companyId, existingBill.rows[0].id);
  }

  // ── Automatically Create Double-Entry Accounting Journal for Bill ───────────
  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const expenseAccount = data.expenseAccountId
    ? coa.find((a) => a.id === data.expenseAccountId)
    : coa.find((a) => a.code === '5010') || coa.find((a) => a.subtype === 'COGS') || coa.find((a) => a.type === 'EXPENSE');
  const apAccount = coa.find((a) => a.code === '2010') || coa.find((a) => a.subtype === 'ACCOUNTS_PAYABLE');
  const inputCgst = coa.find((a) => a.code === '1050') || coa.find((a) => a.subtype === 'TAX_INPUT');
  const inputSgst = coa.find((a) => a.code === '1051') || coa.find((a) => a.subtype === 'TAX_INPUT');
  const inputIgst = coa.find((a) => a.code === '1052') || coa.find((a) => a.subtype === 'TAX_INPUT');

  if (!expenseAccount || !apAccount) {
    throw new Error('Required Expense or Accounts Payable accounts not found in Chart of Accounts.');
  }

  const journalLines = [
    { accountId: expenseAccount.id, debit: subtotal, credit: 0, narration: `Expense/Purchase for Bill #${billNumber}` }
  ];

  if (isIntraState) {
    if (cgstAmount > 0 && inputCgst) journalLines.push({ accountId: inputCgst.id, debit: cgstAmount, credit: 0, narration: `Input CGST (ITC) on #${billNumber}` });
    if (sgstAmount > 0 && inputSgst) journalLines.push({ accountId: inputSgst.id, debit: sgstAmount, credit: 0, narration: `Input SGST (ITC) on #${billNumber}` });
  } else {
    if (igstAmount > 0 && inputIgst) journalLines.push({ accountId: inputIgst.id, debit: igstAmount, credit: 0, narration: `Input IGST (ITC) on #${billNumber}` });
  }

  if (tdsAmount > 0) {
    const tdsAccount = coa.find((a) => a.code === '2031') || coa.find((a) => a.subtype === 'TDS_PAYABLE');
    if (tdsAccount) {
      journalLines.push({ accountId: tdsAccount.id, debit: 0, credit: tdsAmount, narration: `TDS Payable under ${tdsSection} on #${billNumber}` });
    }
  }

  journalLines.push({ accountId: apAccount.id, debit: 0, credit: netPayable, narration: `Payable to ${vendorName} on #${billNumber}` });

  // Adjust any tiny 1-paisa rounding
  const debitsSum = roundMoney(journalLines.reduce((acc, l) => acc + l.debit, 0));
  const creditsSum = roundMoney(journalLines.reduce((acc, l) => acc + l.credit, 0));
  if (Math.abs(debitsSum - creditsSum) > 0.001) {
    journalLines[journalLines.length - 1].credit = debitsSum - roundMoney(journalLines.slice(0, -1).reduce((acc, l) => acc + l.credit, 0));
  }

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: billDate,
    narration: `Vendor Bill #${billNumber} from ${vendorName}`,
    referenceType: 'BILL',
    referenceId: billId,
    referenceNumber: billNumber,
    lines: journalLines
  });

  const billObj = {
    id: billId,
    companyId,
    userId,
    billNumber,
    vendorName,
    vendorGstin: data.vendorGstin || '',
    vendorPan: data.vendorPan || '',
    category: data.category || 'Purchases',
    expenseAccountId: expenseAccount.id,
    expenseAccountName: expenseAccount.name,
    billDate,
    dueDate,
    taxableAmount: subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTaxAmount: totalTax,
    totalAmount,
    tdsSection,
    tdsAmount,
    netPayable,
    paidAmount: 0.00,
    outstandingAmount: netPayable,
    status: 'Pending',
    journalEntryId: journalEntry.id,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await pool.query(
    `INSERT INTO ledger_payables
       (id, user_id, company_id, bill_number, vendor_name, vendor_gstin,
        bill_date, due_date, category, subtotal, tax_amount, total_amount, paid_amount, status, items, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0.00, 'Pending', $13::jsonb, $14)`,
    [
      billId, userId, companyId, billNumber, vendorName, data.vendorGstin || '',
      billDate, dueDate, data.category || 'Purchases', subtotal, totalTax, netPayable,
      JSON.stringify({
        taxableAmount: subtotal,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTaxAmount: totalTax,
        totalAmount,
        tdsSection,
        tdsAmount,
        netPayable,
        journalEntryId: journalEntry.id,
        vendorPan: data.vendorPan || ''
      }),
      data.notes || ''
    ]
  );

  if (tdsAmount > 0 && tdsSection) {
    try {
      await tdsEngine.recordTdsTransaction(companyId, userId, {
        vendorName,
        vendorPan: data.vendorPan || '',
        isCompany: Boolean(data.isCompany),
        sectionCode: tdsSection,
        grossAmount: subtotal,
        deductionDate: billDate,
        billId,
        billNumber
      });
    } catch (err) {
      console.warn('Auto TDS record warning:', err.message);
    }
  }

  return { ...billObj, journalEntry };
}

export async function getVendorBills(companyId, filters = {}) {
  const { status, search, dateFrom, dateTo, page = 1, limit = 50 } = filters;
  const params = [companyId];
  const conditions = ['(company_id = $1 OR user_id = $1)'];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`bill_date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`bill_date <= $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(vendor_name) LIKE $${params.length} OR LOWER(bill_number) LIKE $${params.length})`);
  }

  const where = conditions.join(' AND ');
  const countRes = await pool.query(`SELECT COUNT(*) AS total FROM ledger_payables WHERE ${where}`, params);
  const totalCount = Number(countRes.rows[0]?.total || 0);

  const offset = (Math.max(1, page) - 1) * limit;
  params.push(limit, offset);
  const listRes = await pool.query(
    `SELECT * FROM ledger_payables WHERE ${where} ORDER BY bill_date DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const bills = listRes.rows.map((row) => {
    let extra = {};
    try {
      extra = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || {});
    } catch (_) {}
    return {
      id: row.id,
      companyId: row.company_id,
      userId: row.user_id,
      billNumber: row.bill_number,
      vendorName: row.vendor_name,
      vendorGstin: row.vendor_gstin,
      vendorPan: extra.vendorPan || '',
      category: row.category,
      billDate: formatDateOnly(row.bill_date),
      dueDate: formatDateOnly(row.due_date),
      taxableAmount: Number(row.subtotal || 0),
      cgstAmount: Number(extra.cgstAmount || 0),
      sgstAmount: Number(extra.sgstAmount || 0),
      igstAmount: Number(extra.igstAmount || 0),
      totalTaxAmount: Number(row.tax_amount || 0),
      totalAmount: Number(extra.totalAmount || row.total_amount || 0),
      tdsSection: extra.tdsSection || null,
      tdsAmount: Number(extra.tdsAmount || 0),
      netPayable: Number(row.total_amount || 0),
      paidAmount: Number(row.paid_amount || 0),
      outstandingAmount: roundMoney(Number(row.total_amount || 0) - Number(row.paid_amount || 0)),
      status: row.status,
      journalEntryId: extra.journalEntryId || null,
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });

  return {
    bills,
    totalCount,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(totalCount / limit) || 1
  };
}

export async function getVendorBillById(companyId, billId) {
  const res = await pool.query(
    `SELECT * FROM ledger_payables WHERE id = $1 AND (company_id = $2 OR user_id = $2)`,
    [billId, companyId]
  );
  if (res.rows.length === 0) throw new Error('Vendor bill not found.');
  const row = res.rows[0];
  let extra = {};
  try {
    extra = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || {});
  } catch (_) {}
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    billNumber: row.bill_number,
    vendorName: row.vendor_name,
    vendorGstin: row.vendor_gstin,
    vendorPan: extra.vendorPan || '',
    category: row.category,
    billDate: formatDateOnly(row.bill_date),
    dueDate: formatDateOnly(row.due_date),
    taxableAmount: Number(row.subtotal || 0),
    cgstAmount: Number(extra.cgstAmount || 0),
    sgstAmount: Number(extra.sgstAmount || 0),
    igstAmount: Number(extra.igstAmount || 0),
    totalTaxAmount: Number(row.tax_amount || 0),
    totalAmount: Number(extra.totalAmount || row.total_amount || 0),
    tdsSection: extra.tdsSection || null,
    tdsAmount: Number(extra.tdsAmount || 0),
    netPayable: Number(row.total_amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    outstandingAmount: roundMoney(Number(row.total_amount || 0) - Number(row.paid_amount || 0)),
    status: row.status,
    journalEntryId: extra.journalEntryId || null,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function recordVendorBillPayment(companyId, billId, userId, paymentData) {
  const payAmount = roundMoney(paymentData.amount);
  if (payAmount <= 0) throw new Error('Payment amount must be positive.');

  const bill = await getVendorBillById(companyId, billId);
  const remaining = roundMoney(bill.netPayable - bill.paidAmount);
  if (payAmount > remaining + 0.01) {
    throw new Error(`Payment amount (₹${payAmount}) exceeds outstanding balance (₹${remaining}).`);
  }

  const paymentDate = paymentData.paymentDate || new Date().toISOString().split('T')[0];
  const newPaid = roundMoney(bill.paidAmount + payAmount);
  const newOutstanding = roundMoney(Math.max(0, bill.netPayable - newPaid));
  const newStatus = newOutstanding <= 0.01 ? 'Paid' : 'Partially Paid';

  // ── Post Balanced Vendor Payout Journal Entry ──────────────────────────────
  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const bankAcc = paymentData.accountId
    ? coa.find((a) => a.id === paymentData.accountId)
    : coa.find((a) => a.code === '1010') || coa.find((a) => a.subtype === 'BANK');
  const apAccount = coa.find((a) => a.code === '2010') || coa.find((a) => a.subtype === 'ACCOUNTS_PAYABLE');

  if (!bankAcc || !apAccount) {
    throw new Error('Required Bank or Accounts Payable accounts not found in Chart of Accounts.');
  }

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: paymentDate,
    narration: `Payment to ${bill.vendorName} for Bill #${bill.billNumber}`,
    referenceType: 'PAYMENT',
    referenceId: billId,
    referenceNumber: paymentData.referenceNumber || bill.billNumber,
    lines: [
      { accountId: apAccount.id, debit: payAmount, credit: 0, narration: `Payable cleared for Bill #${bill.billNumber}` },
      { accountId: bankAcc.id, debit: 0, credit: payAmount, narration: `Disbursed from ${bankAcc.name}` }
    ]
  });

  await pool.query(
    `UPDATE ledger_payables SET paid_amount = $1, status = $2, updated_at = NOW() WHERE id = $3`,
    [newPaid, newStatus, billId]
  );

  return {
    success: true,
    bill: { ...bill, paidAmount: newPaid, outstandingAmount: newOutstanding, status: newStatus, updatedAt: new Date().toISOString() },
    journalEntry
  };
}

// ── 3. CREDIT & DEBIT NOTES ──────────────────────────────────────────────────
export async function createCreditDebitNote(companyId, userId, data) {
  const noteType = data.noteType; // 'CREDIT_NOTE' or 'DEBIT_NOTE'
  if (!['CREDIT_NOTE', 'DEBIT_NOTE'].includes(noteType)) {
    throw new Error('noteType must be CREDIT_NOTE or DEBIT_NOTE.');
  }

  const partyName = data.partyName?.trim();
  if (!partyName) throw new Error('Party name is required.');

  const taxableAmount = roundMoney(data.taxableAmount || 0);
  const gstRate = Number(data.gstRate ?? 18);
  const profile = await accountingEngine.getCompanyProfile(companyId, userId);
  const supplierStateCode = profile.stateCode || '27';
  const partyPosCode = data.placeOfSupplyCode || supplierStateCode;
  const isIntraState = supplierStateCode === partyPosCode;

  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
  if (isIntraState) {
    cgstAmount = roundMoney((taxableAmount * (gstRate / 2)) / 100);
    sgstAmount = roundMoney((taxableAmount * (gstRate / 2)) / 100);
  } else {
    igstAmount = roundMoney((taxableAmount * gstRate) / 100);
  }
  const totalAmount = roundMoney(taxableAmount + cgstAmount + sgstAmount + igstAmount);

  const noteId = crypto.randomUUID();
  const year = new Date().getFullYear();
  const prefix = noteType === 'CREDIT_NOTE' ? 'CRN' : 'DBN';
  const noteNumber = data.noteNumber?.trim() || `${prefix}-${year}-${Date.now().toString().slice(-5)}`;
  const noteDate = data.noteDate || new Date().toISOString().split('T')[0];

  const coa = await accountingEngine.getChartOfAccounts(companyId);
  let journalLines = [];

  if (noteType === 'CREDIT_NOTE') {
    // Credit Note (Sales reduction / return):
    // Debit: Sales Revenue
    // Debit: Output CGST / SGST / IGST
    // Credit: Accounts Receivable
    const salesAccount = coa.find((a) => a.code === '4010') || coa.find((a) => a.subtype === 'SALES_REVENUE');
    const arAccount = coa.find((a) => a.code === '1030') || coa.find((a) => a.subtype === 'ACCOUNTS_RECEIVABLE');
    const cgstAcc = coa.find((a) => a.code === '2020') || coa.find((a) => a.subtype === 'GST_PAYABLE');
    const sgstAcc = coa.find((a) => a.code === '2021') || coa.find((a) => a.subtype === 'GST_PAYABLE');
    const igstAcc = coa.find((a) => a.code === '2022') || coa.find((a) => a.subtype === 'GST_PAYABLE');

    journalLines = [
      { accountId: salesAccount.id, debit: taxableAmount, credit: 0, narration: `Sales reduction on ${noteNumber}` }
    ];
    if (isIntraState) {
      if (cgstAmount > 0 && cgstAcc) journalLines.push({ accountId: cgstAcc.id, debit: cgstAmount, credit: 0, narration: `Output CGST reversal on ${noteNumber}` });
      if (sgstAmount > 0 && sgstAcc) journalLines.push({ accountId: sgstAcc.id, debit: sgstAmount, credit: 0, narration: `Output SGST reversal on ${noteNumber}` });
    } else {
      if (igstAmount > 0 && igstAcc) journalLines.push({ accountId: igstAcc.id, debit: igstAmount, credit: 0, narration: `Output IGST reversal on ${noteNumber}` });
    }
    journalLines.push({ accountId: arAccount.id, debit: 0, credit: totalAmount, narration: `Customer credit adjustment for ${partyName}` });
  } else {
    // Debit Note (Purchase reduction / vendor claim):
    // Debit: Accounts Payable
    // Credit: Purchases / Expense
    // Credit: Input CGST / SGST / IGST (reverses ITC)
    const expenseAccount = coa.find((a) => a.code === '5010') || coa.find((a) => a.subtype === 'COGS') || coa.find((a) => a.type === 'EXPENSE');
    const apAccount = coa.find((a) => a.code === '2010') || coa.find((a) => a.subtype === 'ACCOUNTS_PAYABLE');
    const inCgst = coa.find((a) => a.code === '1050') || coa.find((a) => a.subtype === 'TAX_INPUT');
    const inSgst = coa.find((a) => a.code === '1051') || coa.find((a) => a.subtype === 'TAX_INPUT');
    const inIgst = coa.find((a) => a.code === '1052') || coa.find((a) => a.subtype === 'TAX_INPUT');

    journalLines = [
      { accountId: apAccount.id, debit: totalAmount, credit: 0, narration: `Debit note reduction to ${partyName}` },
      { accountId: expenseAccount.id, debit: 0, credit: taxableAmount, narration: `Purchase return on ${noteNumber}` }
    ];
    if (isIntraState) {
      if (cgstAmount > 0 && inCgst) journalLines.push({ accountId: inCgst.id, debit: 0, credit: cgstAmount, narration: `ITC CGST reversal on ${noteNumber}` });
      if (sgstAmount > 0 && inSgst) journalLines.push({ accountId: inSgst.id, debit: 0, credit: sgstAmount, narration: `ITC SGST reversal on ${noteNumber}` });
    } else {
      if (igstAmount > 0 && inIgst) journalLines.push({ accountId: inIgst.id, debit: 0, credit: igstAmount, narration: `ITC IGST reversal on ${noteNumber}` });
    }
  }

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: noteDate,
    narration: `${noteType} #${noteNumber} for ${partyName}`,
    referenceType: noteType,
    referenceId: noteId,
    referenceNumber: noteNumber,
    lines: journalLines
  });

  const noteObj = {
    id: noteId,
    companyId,
    noteNumber,
    noteType,
    originalInvoiceId: data.originalInvoiceId || null,
    originalInvoiceNumber: data.originalInvoiceNumber || null,
    partyName,
    partyGstin: data.partyGstin || '',
    reasonCode: data.reasonCode || '01-Sales Return',
    noteDate,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
    journalEntryId: journalEntry.id,
    status: 'ACTIVE',
    notes: data.notes || '',
    createdAt: new Date().toISOString()
  };

  await pool.query(
    `INSERT INTO credit_debit_notes
       (id, company_id, note_number, note_type, original_invoice_id, original_invoice_number,
        party_name, party_gstin, reason_code, note_date, taxable_amount, cgst_amount,
        sgst_amount, igst_amount, total_amount, journal_entry_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'ACTIVE', $17)`,
    [
      noteId, companyId, noteNumber, noteType,
      data.originalInvoiceId || null, data.originalInvoiceNumber || null,
      partyName, data.partyGstin || '', data.reasonCode || '01-Sales Return',
      noteDate, taxableAmount, cgstAmount, sgstAmount, igstAmount, totalAmount,
      journalEntry.id, data.notes || ''
    ]
  );

  return { ...noteObj, journalEntry };
}

export async function getCreditDebitNotes(companyId) {
  const res = await pool.query(
    `SELECT * FROM credit_debit_notes WHERE company_id = $1 ORDER BY note_date DESC`,
    [companyId]
  );
  return res.rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    noteNumber: row.note_number,
    noteType: row.note_type,
    originalInvoiceId: row.original_invoice_id,
    originalInvoiceNumber: row.original_invoice_number,
    partyName: row.party_name,
    partyGstin: row.party_gstin,
    reasonCode: row.reason_code,
    noteDate: formatDateOnly(row.note_date),
    taxableAmount: Number(row.taxable_amount || 0),
    cgstAmount: Number(row.cgst_amount || 0),
    sgstAmount: Number(row.sgst_amount || 0),
    igstAmount: Number(row.igst_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    journalEntryId: row.journal_entry_id,
    status: row.status,
    notes: row.notes || '',
    createdAt: row.created_at
  }));
}

function mapInvoiceHeader(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name,
    customerGstin: row.customer_gstin || '',
    customerPan: row.customer_pan || '',
    customerEmail: row.customer_email || '',
    customerPhone: row.customer_phone || '',
    billingAddress: row.billing_address || '',
    shippingAddress: row.shipping_address || '',
    placeOfSupply: row.place_of_supply,
    placeOfSupplyCode: row.place_of_supply_code,
    supplyType: row.supply_type,
    invoiceDate: formatDateOnly(row.invoice_date),
    dueDate: formatDateOnly(row.due_date),
    paymentTerms: row.payment_terms,
    reverseCharge: row.reverse_charge,
    taxableAmount: roundMoney(row.taxable_amount),
    cgstAmount: roundMoney(row.cgst_amount),
    sgstAmount: roundMoney(row.sgst_amount),
    igstAmount: roundMoney(row.igst_amount),
    totalTaxAmount: roundMoney(row.total_tax_amount),
    discountAmount: roundMoney(row.discount_amount),
    totalAmount: roundMoney(row.total_amount),
    paidAmount: roundMoney(row.paid_amount),
    outstandingAmount: roundMoney(row.outstanding_amount),
    status: row.status,
    journalEntryId: row.journal_entry_id,
    irn: row.irn,
    irnStatus: row.irn_status || 'NOT_GENERATED',
    signedQrCode: row.signed_qr_code,
    ackNumber: row.ack_number,
    ackDate: row.ack_date,
    ewayBillNumber: row.eway_bill_number,
    ewayBillDate: row.eway_bill_date,
    notes: row.notes,
    termsConditions: row.terms_conditions,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInvoiceItem(row) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    itemDescription: row.item_description,
    hsnSac: row.hsn_sac,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPrice: roundMoney(row.unit_price),
    discountPercent: Number(row.discount_percent),
    discountAmount: roundMoney(row.discount_amount),
    taxableValue: roundMoney(row.taxable_value),
    gstRate: Number(row.gst_rate),
    cgstRate: Number(row.cgst_rate),
    cgstAmount: roundMoney(row.cgst_amount),
    sgstRate: Number(row.sgst_rate),
    sgstAmount: roundMoney(row.sgst_amount),
    igstRate: Number(row.igst_rate),
    igstAmount: roundMoney(row.igst_amount),
    totalItemAmount: roundMoney(row.total_item_amount),
    sortOrder: row.sort_order
  };
}
