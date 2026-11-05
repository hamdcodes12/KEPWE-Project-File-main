import crypto from 'crypto';
import { pool } from '../config/db.js';

// ── Currency Helpers ────────────────────────────────────────────────────────
export function roundMoney(val) {
  const num = Number(val) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}


// ── Standard Indian Chart of Accounts Definition ─────────────────────────────
export const STANDARD_COA = [
  // ASSETS (Normal Balance: DEBIT)
  { code: '1010', name: 'Bank Current Account', type: 'ASSET', subtype: 'BANK', normalBalance: 'DEBIT', description: 'Primary business operating bank account' },
  { code: '1020', name: 'Petty Cash', type: 'ASSET', subtype: 'CASH', normalBalance: 'DEBIT', description: 'Cash in hand for daily expenses' },
  { code: '1030', name: 'Accounts Receivable (Sundry Debtors)', type: 'ASSET', subtype: 'ACCOUNTS_RECEIVABLE', normalBalance: 'DEBIT', description: 'Customer receivables control account' },
  { code: '1040', name: 'Inventory Asset', type: 'ASSET', subtype: 'INVENTORY', normalBalance: 'DEBIT', description: 'Stock in hand' },
  { code: '1050', name: 'Input CGST (ITC)', type: 'ASSET', subtype: 'TAX_INPUT', normalBalance: 'DEBIT', description: 'Input Tax Credit - Central GST' },
  { code: '1051', name: 'Input SGST (ITC)', type: 'ASSET', subtype: 'TAX_INPUT', normalBalance: 'DEBIT', description: 'Input Tax Credit - State GST' },
  { code: '1052', name: 'Input IGST (ITC)', type: 'ASSET', subtype: 'TAX_INPUT', normalBalance: 'DEBIT', description: 'Input Tax Credit - Integrated GST' },
  { code: '1060', name: 'Fixed Assets - Plant & Equipment', type: 'ASSET', subtype: 'FIXED_ASSET', normalBalance: 'DEBIT', description: 'Machinery and equipment' },
  { code: '1061', name: 'Fixed Assets - Computers & IT', type: 'ASSET', subtype: 'FIXED_ASSET', normalBalance: 'DEBIT', description: 'Computers, servers, and hardware' },
  { code: '1062', name: 'Fixed Assets - Furniture & Fixtures', type: 'ASSET', subtype: 'FIXED_ASSET', normalBalance: 'DEBIT', description: 'Office furniture' },
  { code: '1090', name: 'Accumulated Depreciation', type: 'ASSET', subtype: 'ACCUM_DEPRECIATION', normalBalance: 'CREDIT', description: 'Contra-asset: cumulative depreciation' },

  // LIABILITIES (Normal Balance: CREDIT)
  { code: '2010', name: 'Accounts Payable (Sundry Creditors)', type: 'LIABILITY', subtype: 'ACCOUNTS_PAYABLE', normalBalance: 'CREDIT', description: 'Vendor bills payable control account' },
  { code: '2020', name: 'Output CGST Payable', type: 'LIABILITY', subtype: 'GST_PAYABLE', normalBalance: 'CREDIT', description: 'Central GST collected on sales' },
  { code: '2021', name: 'Output SGST Payable', type: 'LIABILITY', subtype: 'GST_PAYABLE', normalBalance: 'CREDIT', description: 'State GST collected on sales' },
  { code: '2022', name: 'Output IGST Payable', type: 'LIABILITY', subtype: 'GST_PAYABLE', normalBalance: 'CREDIT', description: 'Integrated GST collected on inter-state sales' },
  { code: '2030', name: 'TDS Payable - Sec 194C', type: 'LIABILITY', subtype: 'TDS_PAYABLE', normalBalance: 'CREDIT', description: 'TDS on contractor payments' },
  { code: '2031', name: 'TDS Payable - Sec 194J', type: 'LIABILITY', subtype: 'TDS_PAYABLE', normalBalance: 'CREDIT', description: 'TDS on professional/technical fees' },
  { code: '2032', name: 'TDS Payable - Sec 194I', type: 'LIABILITY', subtype: 'TDS_PAYABLE', normalBalance: 'CREDIT', description: 'TDS on rent' },
  { code: '2033', name: 'TDS Payable - Sec 194H', type: 'LIABILITY', subtype: 'TDS_PAYABLE', normalBalance: 'CREDIT', description: 'TDS on commission/brokerage' },
  { code: '2034', name: 'TDS Payable - Sec 192 (Salaries)', type: 'LIABILITY', subtype: 'TDS_PAYABLE', normalBalance: 'CREDIT', description: 'TDS deducted from employee salaries' },
  { code: '2040', name: 'EPF Payable', type: 'LIABILITY', subtype: 'PAYROLL_STATUTORY', normalBalance: 'CREDIT', description: 'Employee and employer PF dues' },
  { code: '2041', name: 'ESI Payable', type: 'LIABILITY', subtype: 'PAYROLL_STATUTORY', normalBalance: 'CREDIT', description: 'Employee and employer ESI dues' },
  { code: '2042', name: 'Professional Tax Payable', type: 'LIABILITY', subtype: 'PAYROLL_STATUTORY', normalBalance: 'CREDIT', description: 'State professional tax deducted' },
  { code: '2050', name: 'Salaries Payable', type: 'LIABILITY', subtype: 'SALARIES_PAYABLE', normalBalance: 'CREDIT', description: 'Net unpaid employee salaries' },
  { code: '2060', name: 'Bank Loans & Borrowings', type: 'LIABILITY', subtype: 'LOAN', normalBalance: 'CREDIT', description: 'Long term and short term debt' },

  // EQUITY (Normal Balance: CREDIT)
  { code: '3010', name: 'Owner / Shareholder Capital', type: 'EQUITY', subtype: 'EQUITY', normalBalance: 'CREDIT', description: 'Contributed equity capital' },
  { code: '3020', name: 'Retained Earnings', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', normalBalance: 'CREDIT', description: 'Accumulated profits/losses' },

  // INCOME (Normal Balance: CREDIT)
  { code: '4010', name: 'Sales Revenue (Goods)', type: 'INCOME', subtype: 'SALES_REVENUE', normalBalance: 'CREDIT', description: 'Revenue from sales of products' },
  { code: '4020', name: 'Consulting & Professional Services Revenue', type: 'INCOME', subtype: 'SALES_REVENUE', normalBalance: 'CREDIT', description: 'Revenue from consulting and services' },
  { code: '4030', name: 'Interest & Investment Income', type: 'INCOME', subtype: 'OTHER_INCOME', normalBalance: 'CREDIT', description: 'Bank interest and return on capital' },
  { code: '4040', name: 'Other Operating Income', type: 'INCOME', subtype: 'OTHER_INCOME', normalBalance: 'CREDIT', description: 'Miscellaneous business income' },

  // EXPENSES (Normal Balance: DEBIT)
  { code: '5010', name: 'Cost of Goods Sold / Raw Materials', type: 'EXPENSE', subtype: 'COGS', normalBalance: 'DEBIT', description: 'Direct materials and procurement' },
  { code: '5020', name: 'Salaries & Contractor Wages', type: 'EXPENSE', subtype: 'PAYROLL_EXPENSE', normalBalance: 'DEBIT', description: 'Gross employee compensation' },
  { code: '5021', name: 'Employer EPF Contribution', type: 'EXPENSE', subtype: 'PAYROLL_EXPENSE', normalBalance: 'DEBIT', description: 'Statutory employer PF contribution' },
  { code: '5022', name: 'Employer ESI Contribution', type: 'EXPENSE', subtype: 'PAYROLL_EXPENSE', normalBalance: 'DEBIT', description: 'Statutory employer ESI contribution' },
  { code: '5030', name: 'Office Rent & Utilities', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Rent, electricity, water, internet' },
  { code: '5040', name: 'Software & Cloud Infrastructure', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'SaaS tools, AWS/Cloud hosting' },
  { code: '5050', name: 'Marketing & Advertising', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Google ads, promotions, branding' },
  { code: '5060', name: 'Travel & Conveyance', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Business travel and local transit' },
  { code: '5070', name: 'Legal & Professional Fees', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'CA, auditor, and legal consultation fees' },
  { code: '5080', name: 'Depreciation Expense', type: 'EXPENSE', subtype: 'DEPRECIATION_EXPENSE', normalBalance: 'DEBIT', description: 'Periodic depreciation on fixed assets' },
  { code: '5090', name: 'Bank Charges & Gateway Fees', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Processing and transaction charges' },
  { code: '5100', name: 'General & Administrative', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', normalBalance: 'DEBIT', description: 'Miscellaneous office supplies and admin' },
];

// ── 1. COMPANY ACCOUNTING PROFILE SERVICE ───────────────────────────────────
export async function getCompanyProfile(companyId, userId) {
  const res = await pool.query(
    `SELECT * FROM company_accounting_profiles WHERE company_id = $1`,
    [companyId]
  );
  if (res.rows.length > 0) return mapCompanyProfile(res.rows[0]);

  // If no profile exists yet, retrieve company details or default cleanly
  let companyName = 'KEPWE Company';
  try {
    const compRes = await pool.query(`SELECT name FROM companies WHERE id = $1`, [companyId]);
    if (compRes.rows.length > 0 && compRes.rows[0].name) {
      companyName = compRes.rows[0].name;
    }
  } catch (err) {
    // ignore
  }

  const checkAgain = await pool.query(
    `SELECT * FROM company_accounting_profiles WHERE company_id = $1`,
    [companyId]
  );
  if (checkAgain.rows.length > 0) return mapCompanyProfile(checkAgain.rows[0]);

  const insertRes = await pool.query(
    `INSERT INTO company_accounting_profiles
       (company_id, legal_name, trade_name, financial_year_start, financial_year_end, gst_registration_type, book_begin_date, bank_accounts, directors, employees_count, accounting_settings, unique_company_id)
     VALUES ($1, $2, $2, '04-01', '03-31', 'Regular', CURRENT_DATE, '[]'::jsonb, '[]'::jsonb, 0, '{"inventoryValuation": "FIFO", "cashBasis": false}'::jsonb, $3)
     RETURNING *`,
    [companyId, companyName, `KEP-${companyId?.slice(0, 8) || 'MAIN'}`]
  );
  return mapCompanyProfile(insertRes.rows[0]);
}

export async function updateCompanyProfile(companyId, userId, data) {
  const existing = await pool.query(`SELECT id FROM company_accounting_profiles WHERE company_id = $1`, [companyId]);
  if (existing.rows.length > 0) {
    const res = await pool.query(
      `UPDATE company_accounting_profiles
       SET legal_name = COALESCE($2, legal_name),
           trade_name = COALESCE($3, trade_name),
           pan = COALESCE($4, pan),
           tan = COALESCE($5, tan),
           gstin = COALESCE($6, gstin),
           cin = COALESCE($7, cin),
           entity_type = COALESCE($8, entity_type),
           registered_address = COALESCE($9, registered_address),
           state = COALESCE($10, state),
           state_code = COALESCE($11, state_code),
           pincode = COALESCE($12, pincode),
           financial_year_start = COALESCE($13, financial_year_start),
           financial_year_end = COALESCE($14, financial_year_end),
           gst_registration_type = COALESCE($15, gst_registration_type),
           book_begin_date = COALESCE($16, book_begin_date),
           lock_date = COALESCE($17, lock_date),
           bank_accounts = COALESCE($18, bank_accounts),
           directors = COALESCE($19, directors),
           employees_count = COALESCE($20, employees_count),
           accounting_settings = COALESCE($21, accounting_settings),
           updated_at = NOW()
       WHERE company_id = $1
       RETURNING *`,
      [
        companyId,
        data.legalName,
        data.tradeName,
        data.pan,
        data.tan,
        data.gstin,
        data.cin,
        data.entityType,
        data.registeredAddress,
        data.state,
        data.stateCode,
        data.pincode,
        data.financialYearStart,
        data.financialYearEnd,
        data.gstRegistrationType,
        data.bookBeginDate,
        data.lockDate,
        data.bankAccounts ? JSON.stringify(data.bankAccounts) : null,
        data.directors ? JSON.stringify(data.directors) : null,
        data.employeesCount,
        data.accountingSettings ? JSON.stringify(data.accountingSettings) : null
      ]
    );
    await logAudit(companyId, userId, 'UPDATE', 'SETTINGS', res.rows[0].id, 'Profile updated', null, data);
    return mapCompanyProfile(res.rows[0]);
  } else {
    const res = await pool.query(
      `INSERT INTO company_accounting_profiles
         (company_id, legal_name, trade_name, pan, tan, gstin, cin, entity_type, registered_address, state, state_code, pincode, financial_year_start, financial_year_end, gst_registration_type, book_begin_date, lock_date, bank_accounts, directors, employees_count, accounting_settings, unique_company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [
        companyId,
        data.legalName || 'KEPWE Enterprises',
        data.tradeName || null,
        data.pan || null,
        data.tan || null,
        data.gstin || null,
        data.cin || null,
        data.entityType || 'Private Limited',
        data.registeredAddress || null,
        data.state || 'Maharashtra',
        data.stateCode || '27',
        data.pincode || null,
        data.financialYearStart || '04-01',
        data.financialYearEnd || '03-31',
        data.gstRegistrationType || 'Regular',
        data.bookBeginDate || new Date().toISOString().split('T')[0],
        data.lockDate || null,
        JSON.stringify(data.bankAccounts || []),
        JSON.stringify(data.directors || []),
        data.employeesCount || 0,
        JSON.stringify(data.accountingSettings || {}),
        `KEP-${companyId?.slice(0, 8) || 'MAIN'}`
      ]
    );
    await logAudit(companyId, userId, 'CREATE', 'SETTINGS', res.rows[0].id, 'Profile created', null, data);
    return mapCompanyProfile(res.rows[0]);
  }
}

function mapCompanyProfile(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    pan: row.pan,
    tan: row.tan,
    gstin: row.gstin,
    cin: row.cin,
    entityType: row.entity_type,
    registeredAddress: row.registered_address,
    state: row.state,
    stateCode: row.state_code,
    pincode: row.pincode,
    financialYearStart: row.financial_year_start,
    financialYearEnd: row.financial_year_end,
    gstRegistrationType: row.gst_registration_type,
    bookBeginDate: row.book_begin_date,
    lockDate: row.lock_date,
    bankAccounts: typeof row.bank_accounts === 'string' ? JSON.parse(row.bank_accounts) : row.bank_accounts || [],
    directors: typeof row.directors === 'string' ? JSON.parse(row.directors) : row.directors || [],
    employeesCount: row.employees_count,
    accountingSettings: typeof row.accounting_settings === 'string' ? JSON.parse(row.accounting_settings) : row.accounting_settings || {},
    uniqueCompanyId: row.unique_company_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ── 2. CHART OF ACCOUNTS SERVICE ─────────────────────────────────────────────
export async function initDefaultChartOfAccounts(companyId) {
  for (const item of STANDARD_COA) {
    await pool.query(
      `INSERT INTO chart_of_accounts (company_id, code, name, type, subtype, normal_balance, description, is_system, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE)
       ON CONFLICT (company_id, code) DO NOTHING`,
      [companyId, item.code, item.name, item.type, item.subtype, item.normalBalance, item.description]
    );
  }
  return getChartOfAccounts(companyId);
}

export async function getChartOfAccounts(companyId) {
  const res = await pool.query(
    `SELECT * FROM chart_of_accounts WHERE company_id = $1 ORDER BY code ASC`,
    [companyId]
  );
  if (res.rows.length === 0) {
    return initDefaultChartOfAccounts(companyId);
  }
  return res.rows.map(mapAccountRow);
}

export async function getAccountByCode(companyId, code) {
  const accounts = await getChartOfAccounts(companyId);
  return accounts.find((a) => a.code === code) || null;
}

export async function getAccountById(companyId, accountId) {
  const accounts = await getChartOfAccounts(companyId);
  return accounts.find((a) => a.id === accountId) || null;
}

export async function createCustomAccount(companyId, data) {
  const code = data.code?.trim();
  const name = data.name?.trim();
  if (!code || !name) throw new Error('Account code and name are required.');

  const normalBalance = data.normalBalance || (['ASSET', 'EXPENSE'].includes(data.type) ? 'DEBIT' : 'CREDIT');
  const accountId = crypto.randomUUID();

  const res = await pool.query(
    `INSERT INTO chart_of_accounts (id, company_id, code, name, type, subtype, normal_balance, description, is_system, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, TRUE)
     RETURNING *`,
    [accountId, companyId, code, name, data.type, data.subtype || 'OTHER', normalBalance, data.description || null]
  );
  return mapAccountRow(res.rows[0]);
}

function mapAccountRow(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    type: row.type,
    subtype: row.subtype,
    normalBalance: row.normal_balance,
    description: row.description,
    isSystem: row.is_system,
    isActive: row.is_active,
    currentBalance: roundMoney(row.current_balance),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ── 3. DOUBLE-ENTRY JOURNAL ENGINE ───────────────────────────────────────────
export class UnbalancedJournalError extends Error {
  constructor(totalDebit, totalCredit) {
    super(`Unbalanced journal entry rejected! Debit (₹${totalDebit}) must strictly equal Credit (₹${totalCredit}). Difference: ₹${roundMoney(Math.abs(totalDebit - totalCredit))}`);
    this.name = 'UnbalancedJournalError';
    this.totalDebit = totalDebit;
    this.totalCredit = totalCredit;
    this.statusCode = 400;
  }
}

export async function postJournalEntry(companyId, userId, entryData) {
  const lines = entryData.lines || [];
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('A journal entry must contain at least 2 lines (at least one debit and one credit).');
  }

  // 1. Calculate & verify debit === credit with 0.001 precision
  let totalDebit = 0;
  let totalCredit = 0;
  const processedLines = [];

  for (const line of lines) {
    const debit = roundMoney(line.debit || 0);
    const credit = roundMoney(line.credit || 0);

    if (debit < 0 || credit < 0) {
      throw new Error('Debit and credit amounts cannot be negative.');
    }
    if (debit === 0 && credit === 0) {
      throw new Error('Each line in a journal entry must have either a positive debit or positive credit.');
    }
    if (debit > 0 && credit > 0) {
      throw new Error('A single line cannot have both debit and credit. Split into separate lines.');
    }

    totalDebit = roundMoney(totalDebit + debit);
    totalCredit = roundMoney(totalCredit + credit);

    processedLines.push({
      accountId: line.accountId,
      debit,
      credit,
      narration: line.narration || null
    });
  }

  // Strict zero-balance invariant check
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new UnbalancedJournalError(totalDebit, totalCredit);
  }

  const entryId = crypto.randomUUID();
  const entryDate = entryData.entryDate || new Date().toISOString().split('T')[0];
  const narration = entryData.narration || 'Journal Entry';
  const referenceType = entryData.referenceType || 'MANUAL';
  const referenceId = entryData.referenceId || null;
  const referenceNumber = entryData.referenceNumber || null;

  // Check accounting lock date
  const profile = await getCompanyProfile(companyId, userId);
  if (profile.lockDate && new Date(entryDate) <= new Date(profile.lockDate)) {
    throw new Error(`Accounting period closed on or before ${profile.lockDate}. Modifications locked by company policy.`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Sequence generator for journal number
    const seqRes = await client.query(
      `SELECT COUNT(*) + 1 AS next_seq FROM journal_entries WHERE company_id = $1`,
      [companyId]
    );
    const nextSeq = String(seqRes.rows[0]?.next_seq || 1).padStart(5, '0');
    const year = new Date(entryDate).getFullYear();
    const entryNumber = entryData.entryNumber || `JRN-${year}-${nextSeq}`;

    // Insert Journal Entry Header
    const headerRes = await client.query(
      `INSERT INTO journal_entries
         (id, company_id, user_id, entry_number, entry_date, narration, reference_type, reference_id, reference_number, status, total_debit, total_credit, is_balanced)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'POSTED', $10, $11, TRUE)
       RETURNING *`,
      [entryId, companyId, userId, entryNumber, entryDate, narration, referenceType, referenceId, referenceNumber, totalDebit, totalCredit]
    );

    const insertedLines = [];
    for (const line of processedLines) {
      const lineId = crypto.randomUUID();
      const lineRes = await client.query(
        `INSERT INTO journal_lines (id, journal_entry_id, company_id, account_id, debit, credit, narration)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [lineId, entryId, companyId, line.accountId, line.debit, line.credit, line.narration]
      );
      insertedLines.push(lineRes.rows[0]);

      // Adjust running balance based on normal balance convention:
      // Asset/Expense: Debit increases, Credit decreases
      // Liability/Equity/Income: Credit increases, Debit decreases
      await client.query(
        `UPDATE chart_of_accounts
         SET current_balance = current_balance + (
           CASE WHEN normal_balance = 'DEBIT' THEN ($1::NUMERIC - $2::NUMERIC)
                ELSE ($2::NUMERIC - $1::NUMERIC) END
         ),
         updated_at = NOW()
         WHERE id = $3 AND company_id = $4`,
        [line.debit, line.credit, line.accountId, companyId]
      );
    }

    await client.query('COMMIT');

    await logAudit(companyId, userId, 'POST', 'JOURNAL_ENTRY', entryId, `Posted Journal ${entryNumber}`, null, {
      entryNumber,
      totalDebit,
      totalCredit,
      linesCount: insertedLines.length
    });

    return {
      entry: mapJournalHeaderRow(headerRes.rows[0]),
      lines: insertedLines.map(mapJournalLineRow)
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Immutability Workflow: VOID -> REVERSE -> AUDIT LOG ─────────────────────
export async function voidJournalEntry(companyId, entryId, userId, reason = 'Voided by user request') {
  if (!reason) throw new Error('A void reason is required for compliance audit trails.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const entryRes = await client.query(
      `SELECT * FROM journal_entries WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [entryId, companyId]
    );
    if (entryRes.rows.length === 0) throw new Error('Journal entry not found.');
    const oldEntry = entryRes.rows[0];

    if (oldEntry.status !== 'POSTED') {
      throw new Error(`Cannot void entry with status: ${oldEntry.status}. Only POSTED entries can be voided.`);
    }

    // Fetch original lines
    const linesRes = await client.query(
      `SELECT * FROM journal_lines WHERE journal_entry_id = $1`,
      [entryId]
    );
    const originalLines = linesRes.rows;

    // 1. Create offsetting Reversal Journal Entry (swapping debits and credits)
    const revId = crypto.randomUUID();
    const revNumber = `REV-${oldEntry.entry_number}`;
    const revDate = new Date().toISOString().split('T')[0];

    await client.query(
      `INSERT INTO journal_entries
         (id, company_id, user_id, entry_number, entry_date, narration, reference_type, reference_id, reference_number, status, total_debit, total_credit, is_balanced)
       VALUES ($1, $2, $3, $4, $5, $6, 'REVERSAL', $7, $8, 'POSTED', $9, $10, TRUE)`,
      [
        revId,
        companyId,
        userId,
        revNumber,
        revDate,
        `Reversal of ${oldEntry.entry_number}: ${reason}`,
        entryId,
        oldEntry.entry_number,
        oldEntry.total_credit, // swapped
        oldEntry.total_debit   // swapped
      ]
    );

    // Insert swapped reversal lines and roll back account balances
    for (const line of originalLines) {
      const revLineId = crypto.randomUUID();
      await client.query(
        `INSERT INTO journal_lines (id, journal_entry_id, company_id, account_id, debit, credit, narration)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [revLineId, revId, companyId, line.account_id, line.credit, line.debit, `Reversal of line from ${oldEntry.entry_number}`]
      );

      // Adjust balances back
      await client.query(
        `UPDATE chart_of_accounts
         SET current_balance = current_balance + (
           CASE WHEN normal_balance = 'DEBIT' THEN ($1::NUMERIC - $2::NUMERIC)
                ELSE ($2::NUMERIC - $1::NUMERIC) END
         ),
         updated_at = NOW()
         WHERE id = $3 AND company_id = $4`,
        [line.credit, line.debit, line.account_id, companyId]
      );
    }

    // 2. Mark original entry as VOIDED with link to reversal entry
    await client.query(
      `UPDATE journal_entries
       SET status = 'VOIDED',
           voided_at = NOW(),
           voided_by = $1,
           void_reason = $2,
           reversal_entry_id = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [userId, reason, revId, entryId]
    );

    await client.query('COMMIT');

    await logAudit(companyId, userId, 'VOID', 'JOURNAL_ENTRY', entryId, `Voided ${oldEntry.entry_number} with Reversal ${revNumber}`, oldEntry, {
      reversalEntryId: revId,
      reversalNumber: revNumber,
      reason
    });

    return { success: true, voidedEntryId: entryId, reversalEntryId: revId, reversalNumber: revNumber };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getJournalEntries(companyId, filters = {}) {
  const { status, referenceType, dateFrom, dateTo, search, limit = 50, page = 1 } = filters;

  const params = [companyId];
  const where = ['company_id = $1'];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (referenceType) {
    params.push(referenceType);
    where.push(`reference_type = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    where.push(`entry_date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    where.push(`entry_date <= $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(entry_number ILIKE $${params.length} OR narration ILIKE $${params.length} OR reference_number ILIKE $${params.length})`);
  }

  const whereClause = where.join(' AND ');
  const countRes = await pool.query(`SELECT COUNT(*) FROM journal_entries WHERE ${whereClause}`, params);
  const totalCount = parseInt(countRes.rows[0].count, 10) || 0;

  const offset = (Math.max(1, page) - 1) * limit;
  params.push(limit);
  params.push(offset);

  const res = await pool.query(
    `SELECT * FROM journal_entries WHERE ${whereClause} ORDER BY entry_date DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const entriesWithLines = await Promise.all(
    res.rows.map(async (row) => {
      const linesRes = await pool.query(
        `SELECT jl.*, a.code AS account_code, a.name AS account_name, a.type AS account_type
         FROM journal_lines jl
         JOIN chart_of_accounts a ON a.id = jl.account_id
         WHERE jl.journal_entry_id = $1`,
        [row.id]
      );
      return {
        ...mapJournalHeaderRow(row),
        lines: linesRes.rows.map(mapJournalLineRow)
      };
    })
  );

  return {
    entries: entriesWithLines,
    totalCount,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(totalCount / limit) || 1
  };
}

function mapJournalHeaderRow(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    entryNumber: row.entry_number,
    entryDate: row.entry_date instanceof Date ? row.entry_date.toISOString().split('T')[0] : String(row.entry_date).split('T')[0],
    narration: row.narration,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    referenceNumber: row.reference_number,
    status: row.status,
    totalDebit: roundMoney(row.total_debit),
    totalCredit: roundMoney(row.total_credit),
    isBalanced: row.is_balanced,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    reversalEntryId: row.reversal_entry_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapJournalLineRow(row) {
  return {
    id: row.id,
    journalEntryId: row.journal_entry_id,
    companyId: row.company_id,
    accountId: row.account_id,
    accountCode: row.account_code,
    accountName: row.account_name,
    accountType: row.account_type,
    debit: roundMoney(row.debit),
    credit: roundMoney(row.credit),
    narration: row.narration,
    createdAt: row.created_at
  };
}

// ── 4. FINANCIAL REPORTS (DERIVED STRICTLY FROM DOUBLE-ENTRY JOURNALS) ───────
export async function getGeneralLedger(companyId, accountId, dateFrom, dateTo) {
  const accounts = await getChartOfAccounts(companyId);
  const targetAcc = accounts.find((a) => a.id === accountId);
  if (!targetAcc) throw new Error('Account not found in Chart of Accounts.');

  const journalsRes = await getJournalEntries(companyId, { dateFrom, dateTo, limit: 10000 });
  const entries = journalsRes.entries;

  let runningBalance = 0;
  const ledgerLines = [];

  for (const entry of entries) {
    const matchingLines = entry.lines.filter((l) => l.accountId === accountId);
    for (const line of matchingLines) {
      const netDelta = targetAcc.normalBalance === 'DEBIT' ? (line.debit - line.credit) : (line.credit - line.debit);
      runningBalance = roundMoney(runningBalance + netDelta);
      ledgerLines.push({
        entryDate: entry.entryDate,
        entryNumber: entry.entryNumber,
        referenceType: entry.referenceType,
        referenceNumber: entry.referenceNumber,
        narration: line.narration || entry.narration,
        debit: line.debit,
        credit: line.credit,
        runningBalance
      });
    }
  }

  return {
    account: targetAcc,
    dateRange: { dateFrom, dateTo },
    lines: ledgerLines,
    closingBalance: runningBalance
  };
}

export async function getTrialBalance(companyId, asOfDate = new Date().toISOString().split('T')[0]) {
  const accounts = await getChartOfAccounts(companyId);
  const journalsRes = await getJournalEntries(companyId, { dateTo: asOfDate, limit: 50000 });
  const entries = journalsRes.entries;

  // Compute debit/credit sums per account from all posted journal lines
  const accountBalances = new Map();
  accounts.forEach((a) => {
    accountBalances.set(a.id, {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      normalBalance: a.normalBalance,
      totalDebit: 0.0,
      totalCredit: 0.0,
      netDebit: 0.0,
      netCredit: 0.0
    });
  });

  for (const entry of entries) {
    for (const line of entry.lines) {
      const item = accountBalances.get(line.accountId);
      if (item) {
        item.totalDebit = roundMoney(item.totalDebit + line.debit);
        item.totalCredit = roundMoney(item.totalCredit + line.credit);
      }
    }
  }

  let totalTrialDebit = 0;
  let totalTrialCredit = 0;
  const rows = [];

  for (const item of accountBalances.values()) {
    const rawDiff = roundMoney(item.totalDebit - item.totalCredit);
    if (rawDiff > 0) {
      item.netDebit = rawDiff;
      item.netCredit = 0;
      totalTrialDebit = roundMoney(totalTrialDebit + rawDiff);
    } else if (rawDiff < 0) {
      item.netDebit = 0;
      item.netCredit = Math.abs(rawDiff);
      totalTrialCredit = roundMoney(totalTrialCredit + Math.abs(rawDiff));
    }
    rows.push(item);
  }

  rows.sort((a, b) => a.code.localeCompare(b.code));

  return {
    asOfDate,
    rows: rows.filter((r) => r.totalDebit > 0 || r.totalCredit > 0 || r.netDebit > 0 || r.netCredit > 0),
    totalDebit: totalTrialDebit,
    totalCredit: totalTrialCredit,
    isBalanced: Math.abs(totalTrialDebit - totalTrialCredit) <= 0.01,
    discrepancy: roundMoney(Math.abs(totalTrialDebit - totalTrialCredit))
  };
}

export async function getProfitAndLoss(companyId, dateFrom = '2026-04-01', dateTo = new Date().toISOString().split('T')[0]) {
  const trial = await getTrialBalance(companyId, dateTo);
  const rows = trial.rows;

  const incomeItems = rows.filter((r) => r.type === 'INCOME');
  const expenseItems = rows.filter((r) => r.type === 'EXPENSE');

  const totalRevenue = roundMoney(incomeItems.reduce((acc, r) => acc + r.netCredit, 0));
  const cogsItems = expenseItems.filter((r) => r.subtype === 'COGS');
  const costOfGoodsSold = roundMoney(cogsItems.reduce((acc, r) => acc + r.netDebit, 0));
  const grossProfit = roundMoney(totalRevenue - costOfGoodsSold);

  const opexItems = expenseItems.filter((r) => r.subtype !== 'COGS');
  const totalOperatingExpenses = roundMoney(opexItems.reduce((acc, r) => acc + r.netDebit, 0));
  const netProfit = roundMoney(grossProfit - totalOperatingExpenses);
  const operatingMargin = totalRevenue > 0 ? roundMoney((netProfit / totalRevenue) * 100) : 0;

  return {
    dateRange: { dateFrom, dateTo },
    revenue: {
      items: incomeItems.map((i) => ({ code: i.code, name: i.name, amount: i.netCredit })),
      total: totalRevenue
    },
    costOfGoodsSold: {
      items: cogsItems.map((i) => ({ code: i.code, name: i.name, amount: i.netDebit })),
      total: costOfGoodsSold
    },
    grossProfit,
    expenses: {
      items: opexItems.map((i) => ({ code: i.code, name: i.name, subtype: i.subtype, amount: i.netDebit })),
      total: totalOperatingExpenses
    },
    netProfit,
    operatingMargin
  };
}

export async function getBalanceSheet(companyId, asOfDate = new Date().toISOString().split('T')[0]) {
  const trial = await getTrialBalance(companyId, asOfDate);
  const pnl = await getProfitAndLoss(companyId, '2026-04-01', asOfDate);
  const rows = trial.rows;

  const assetItems = rows.filter((r) => r.type === 'ASSET');
  const liabilityItems = rows.filter((r) => r.type === 'LIABILITY');
  const equityItems = rows.filter((r) => r.type === 'EQUITY');

  // Asset net values
  const currentAssets = assetItems.filter((a) => !['FIXED_ASSET', 'ACCUM_DEPRECIATION'].includes(a.subtype));
  const fixedAssets = assetItems.filter((a) => a.subtype === 'FIXED_ASSET');
  const accumDepr = assetItems.filter((a) => a.subtype === 'ACCUM_DEPRECIATION');

  const totalCurrentAssets = roundMoney(currentAssets.reduce((acc, a) => acc + (a.netDebit - a.netCredit), 0));
  const totalFixedAssetsGross = roundMoney(fixedAssets.reduce((acc, a) => acc + (a.netDebit - a.netCredit), 0));
  const totalAccumDepr = roundMoney(accumDepr.reduce((acc, a) => acc + (a.netCredit - a.netDebit), 0));
  const netFixedAssets = roundMoney(Math.max(0, totalFixedAssetsGross - totalAccumDepr));
  const totalAssets = roundMoney(totalCurrentAssets + netFixedAssets);

  // Liabilities
  const currentLiabilities = liabilityItems.filter((l) => l.subtype !== 'LOAN');
  const longTermLiabilities = liabilityItems.filter((l) => l.subtype === 'LOAN');
  const totalCurrentLiabilities = roundMoney(currentLiabilities.reduce((acc, l) => acc + (l.netCredit - l.netDebit), 0));
  const totalLongTermLiabilities = roundMoney(longTermLiabilities.reduce((acc, l) => acc + (l.netCredit - l.netDebit), 0));
  const totalLiabilities = roundMoney(totalCurrentLiabilities + totalLongTermLiabilities);

  // Equity (including retained earnings & period net profit)
  const baseEquity = roundMoney(equityItems.reduce((acc, e) => acc + (e.netCredit - e.netDebit), 0));
  const retainedProfit = roundMoney(pnl.netProfit);
  const totalEquity = roundMoney(baseEquity + retainedProfit);

  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquity);
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) <= 0.05;

  return {
    asOfDate,
    totalAssets,
    totalLiabilities,
    totalEquity,
    assets: {
      currentAssets: {
        items: currentAssets.map((a) => ({ code: a.code, name: a.name, amount: roundMoney(a.netDebit - a.netCredit) })),
        total: totalCurrentAssets
      },
      fixedAssets: {
        gross: totalFixedAssetsGross,
        accumulatedDepreciation: totalAccumDepr,
        net: netFixedAssets,
        items: fixedAssets.map((a) => ({ code: a.code, name: a.name, amount: roundMoney(a.netDebit - a.netCredit) }))
      },
      totalAssets
    },
    liabilities: {
      currentLiabilities: {
        items: currentLiabilities.map((l) => ({ code: l.code, name: l.name, amount: roundMoney(l.netCredit - l.netDebit) })),
        total: totalCurrentLiabilities
      },
      longTermLiabilities: {
        items: longTermLiabilities.map((l) => ({ code: l.code, name: l.name, amount: roundMoney(l.netCredit - l.netDebit) })),
        total: totalLongTermLiabilities
      },
      totalLiabilities
    },
    equity: {
      baseEquity: {
        items: equityItems.map((e) => ({ code: e.code, name: e.name, amount: roundMoney(e.netCredit - e.netDebit) })),
        total: baseEquity
      },
      currentPeriodProfitLoss: retainedProfit,
      totalEquity
    },
    totalLiabilitiesAndEquity,
    isBalanced,
    discrepancy: roundMoney(Math.abs(totalAssets - totalLiabilitiesAndEquity))
  };
}

export async function getCashFlowStatement(companyId, dateFrom = '2026-04-01', dateTo = new Date().toISOString().split('T')[0]) {
  const pnl = await getProfitAndLoss(companyId, dateFrom, dateTo);
  const journalsRes = await getJournalEntries(companyId, { dateFrom, dateTo, limit: 10000 });
  const entries = journalsRes.entries;

  const accounts = await getChartOfAccounts(companyId);
  const bankAndCashAccounts = new Set(accounts.filter((a) => ['BANK', 'CASH'].includes(a.subtype)).map((a) => a.id));

  let operatingCashInflow = 0;
  let operatingCashOutflow = 0;
  let investingCashOutflow = 0;
  let financingCashInflow = 0;

  for (const entry of entries) {
    const hasCashImpact = entry.lines.some((l) => bankAndCashAccounts.has(l.accountId));
    if (!hasCashImpact) continue;

    const cashDebit = entry.lines.filter((l) => bankAndCashAccounts.has(l.accountId)).reduce((acc, l) => acc + l.debit, 0);
    const cashCredit = entry.lines.filter((l) => bankAndCashAccounts.has(l.accountId)).reduce((acc, l) => acc + l.credit, 0);

    if (['INVOICE', 'PAYMENT', 'RECEIPT'].includes(entry.referenceType)) {
      operatingCashInflow = roundMoney(operatingCashInflow + cashDebit);
      operatingCashOutflow = roundMoney(operatingCashOutflow + cashCredit);
    } else if (entry.referenceType === 'PAYROLL') {
      operatingCashOutflow = roundMoney(operatingCashOutflow + cashCredit);
    } else if (entry.referenceType === 'DEPRECIATION') {
      // Non-cash - no cash movement
    } else {
      // General or investing/financing
      if (entry.narration.toLowerCase().includes('asset') || entry.narration.toLowerCase().includes('equipment')) {
        investingCashOutflow = roundMoney(investingCashOutflow + cashCredit);
      } else if (entry.narration.toLowerCase().includes('capital') || entry.narration.toLowerCase().includes('loan')) {
        financingCashInflow = roundMoney(financingCashInflow + cashDebit);
      } else {
        operatingCashInflow = roundMoney(operatingCashInflow + cashDebit);
        operatingCashOutflow = roundMoney(operatingCashOutflow + cashCredit);
      }
    }
  }

  const netOperatingCash = roundMoney(operatingCashInflow - operatingCashOutflow);
  const netInvestingCash = roundMoney(-investingCashOutflow);
  const netFinancingCash = roundMoney(financingCashInflow);
  const netCashChange = roundMoney(netOperatingCash + netInvestingCash + netFinancingCash);

  // Bank & Cash accounts summary
  const cashAccounts = accounts.filter((a) => ['BANK', 'CASH'].includes(a.subtype));
  const totalCashEquivalents = roundMoney(cashAccounts.reduce((acc, a) => acc + a.currentBalance, 0));

  return {
    dateRange: { dateFrom, dateTo },
    netIncome: pnl.netProfit,
    operatingActivities: {
      cashInflow: operatingCashInflow,
      cashOutflow: operatingCashOutflow,
      netCash: netOperatingCash,
      netOperatingCash
    },
    investingActivities: {
      capitalExpenditures: investingCashOutflow,
      netCash: netInvestingCash
    },
    financingActivities: {
      capitalInflow: financingCashInflow,
      netCash: netFinancingCash
    },
    netCashChange,
    summary: {
      netCashChange,
      closingCashBalance: totalCashEquivalents
    },
    closingCashBalance: totalCashEquivalents,
    accounts: cashAccounts.map((a) => ({ id: a.id, name: a.name, type: a.subtype, balance: a.currentBalance }))
  };
}

// ── 5. AUDIT TRAIL LOGGING ───────────────────────────────────────────────────
export async function logAudit(companyId, userId, action, entityType, entityId, narration, beforeState = null, afterState = null) {
  const auditId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    await pool.query(
      `INSERT INTO ledger_audit_trail (id, company_id, user_id, action, entity_type, entity_id, entity_number, before_state, after_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        auditId,
        companyId,
        userId || null,
        action,
        entityType,
        entityId,
        narration,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null
      ]
    );
  } catch (err) {
    console.warn('[accounting:audit] Failed to write DB audit log:', err.message);
  }
}

export async function getAuditTrail(companyId, filters = {}) {
  const { entityType, limit = 50, page = 1 } = filters;

  const params = [companyId];
  const where = ['company_id = $1'];
  if (entityType) {
    params.push(entityType);
    where.push(`entity_type = $${params.length}`);
  }
  const whereClause = where.join(' AND ');
  const countRes = await pool.query(`SELECT COUNT(*) FROM ledger_audit_trail WHERE ${whereClause}`, params);
  const totalCount = parseInt(countRes.rows[0].count, 10) || 0;

  const offset = (Math.max(1, page) - 1) * limit;
  params.push(limit);
  params.push(offset);

  const res = await pool.query(
    `SELECT * FROM ledger_audit_trail WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    logs: res.rows.map((row) => ({
      id: row.id,
      companyId: row.company_id,
      userId: row.user_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityNumber: row.entity_number,
      beforeState: typeof row.before_state === 'string' ? JSON.parse(row.before_state) : row.before_state,
      afterState: typeof row.after_state === 'string' ? JSON.parse(row.after_state) : row.after_state,
      createdAt: row.created_at
    })),
    totalCount,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(totalCount / limit) || 1
  };
}
