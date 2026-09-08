import crypto from 'crypto';
import { pool } from '../config/db.js';
import * as accountingEngine from './accounting-engine.service.js';
import { roundMoney } from './accounting-engine.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function mapStatementRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    accountId: row.account_id,
    fileName: row.file_name,
    statementStart: row.statement_start ? String(row.statement_start).split('T')[0] : '',
    statementEnd: row.statement_end ? String(row.statement_end).split('T')[0] : '',
    openingBalance: Number(row.opening_balance || 0),
    closingBalance: Number(row.closing_balance || 0),
    totalLines: Number(row.total_lines || 0),
    reconciledLines: Number(row.reconciled_lines || 0),
    status: row.status || 'IN_PROGRESS',
    createdAt: row.created_at
  };
}

function mapLineRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    statementId: row.statement_id,
    companyId: row.company_id,
    transactionDate: row.transaction_date ? String(row.transaction_date).split('T')[0] : '',
    valueDate: row.value_date ? String(row.value_date).split('T')[0] : '',
    description: row.description,
    referenceNumber: row.reference_number || '',
    withdrawalAmount: Number(row.withdrawal_amount || 0),
    depositAmount: Number(row.deposit_amount || 0),
    runningBalance: Number(row.running_balance || 0),
    matchStatus: row.match_status || 'UNMATCHED',
    matchedJournalId: row.matched_journal_id,
    matchedAt: row.matched_at,
    notes: row.notes || ''
  };
}

export async function importBankStatement(companyId, userId, data) {
  const accountId = data.accountId;
  const fileName = data.fileName || 'bank_statement.csv';
  const rawCsvContent = data.csvContent;
  let parsedLines = data.lines || [];

  if (rawCsvContent && parsedLines.length === 0) {
    parsedLines = parseBankCsv(rawCsvContent);
  }

  // Zero mock/fake rule: require authentic parsed lines
  if (!Array.isArray(parsedLines) || parsedLines.length === 0) {
    throw new Error('No transaction lines found in statement. Please upload a valid CSV file.');
  }

  // Account validation
  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const targetAcc = accountId ? coa.find((a) => a.id === accountId) : coa.find((a) => a.subtype === 'BANK');
  const validAccountId = targetAcc ? targetAcc.id : coa[0]?.id;

  const statementId = crypto.randomUUID();
  const sortedDates = parsedLines.map((l) => l.transactionDate).filter(Boolean).sort();
  const statementStart = sortedDates[0] || new Date().toISOString().split('T')[0];
  const statementEnd = sortedDates[sortedDates.length - 1] || statementStart;

  const openingBalance = roundMoney(data.openingBalance || parsedLines[0]?.runningBalance || 0);
  const closingBalance = roundMoney(data.closingBalance || parsedLines[parsedLines.length - 1]?.runningBalance || 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const stmtRes = await client.query(
      `INSERT INTO bank_statements
         (id, company_id, account_id, file_name, statement_start, statement_end,
          opening_balance, closing_balance, total_lines, reconciled_lines, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'IN_PROGRESS')
       RETURNING *`,
      [
        statementId,
        companyId,
        validAccountId,
        fileName,
        statementStart,
        statementEnd,
        openingBalance,
        closingBalance,
        parsedLines.length
      ]
    );

    const storedLines = [];
    const seenFingerprints = new Set();
    for (const l of parsedLines) {
      const lineId = crypto.randomUUID();
      const txDate = l.transactionDate || statementStart;
      const valDate = l.valueDate || txDate;
      const desc = l.description || 'Bank Transaction';
      const ref = l.referenceNumber || '';
      const wAmt = roundMoney(l.withdrawalAmount || 0);
      const dAmt = roundMoney(l.depositAmount || 0);
      const rBal = roundMoney(l.runningBalance || 0);

      // Cryptographic transaction fingerprinting to detect duplicate lines
      const fp = crypto.createHash('sha256').update(
        `${companyId}|${validAccountId}|${txDate}|${wAmt}|${dAmt}|${ref.trim().toLowerCase()}|${desc.trim().toLowerCase()}`
      ).digest('hex');

      if (seenFingerprints.has(fp)) {
        continue; // duplicate within current statement import
      }
      seenFingerprints.add(fp);

      const lineRes = await client.query(
        `INSERT INTO bank_statement_lines
           (id, statement_id, company_id, transaction_date, value_date, description,
            reference_number, withdrawal_amount, deposit_amount, running_balance,
            match_status, matched_journal_id, matched_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'UNMATCHED', NULL, NULL, '')
         RETURNING *`,
        [lineId, statementId, companyId, txDate, valDate, desc, ref, wAmt, dAmt, rBal]
      );
      storedLines.push(mapLineRow(lineRes.rows[0]));
    }

    await client.query('COMMIT');

    // Automatically run matching engine
    const recResult = await runReconciliationEngine(companyId, statementId, userId);
    return { statement: mapStatementRow(stmtRes.rows[0]), lines: storedLines, reconciliation: recResult };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Multi-Tier Matching Engine ──────────────────────────────────────────────
export async function runReconciliationEngine(companyId, statementId, userId) {
  const linesRes = await pool.query(
    `SELECT * FROM bank_statement_lines WHERE statement_id = $1 ORDER BY transaction_date ASC`,
    [statementId]
  );
  const lines = linesRes.rows.map(mapLineRow);

  const journalsRes = await accountingEngine.getJournalEntries(companyId, { status: 'POSTED', limit: 50000 });
  const allJournals = journalsRes.entries;

  let exactMatches = 0;
  let autoMatches = 0;
  let unmatchedCount = 0;

  const usedJournalIds = new Set();
  const updatedLines = [];

  for (const line of lines) {
    if (line.matchStatus === 'EXACT_MATCHED' || line.matchStatus === 'MANUALLY_MATCHED') {
      usedJournalIds.add(line.matchedJournalId);
      if (line.matchStatus === 'EXACT_MATCHED') exactMatches++;
      updatedLines.push(line);
      continue;
    }

    const lineAmount = line.withdrawalAmount > 0 ? line.withdrawalAmount : line.depositAmount;

    // Normalize reference/UTR
    const lineRef = (line.referenceNumber || '').toLowerCase().trim();
    const lineDesc = (line.description || '').toLowerCase();

    // Tier 1: Exact Match (Amount + UTR/Ref + Date window ±3 days)
    const exactCandidate = allJournals.find((j) => {
      if (usedJournalIds.has(j.id)) return false;
      const jAmt = j.totalDebit;
      if (Math.abs(jAmt - lineAmount) > 0.01) return false;

      const dateDiff = Math.abs((new Date(j.entryDate) - new Date(line.transactionDate)) / 86400000);
      if (dateDiff > 3) return false;

      // Ref match
      if (lineRef && j.referenceNumber && j.referenceNumber.toLowerCase().includes(lineRef)) return true;
      if (lineRef && j.narration && j.narration.toLowerCase().includes(lineRef)) return true;
      if (j.referenceNumber && lineDesc.includes(j.referenceNumber.toLowerCase())) return true;
      return false;
    });

    if (exactCandidate) {
      line.matchStatus = 'EXACT_MATCHED';
      line.matchedJournalId = exactCandidate.id;
      line.matchedAt = new Date().toISOString();
      line.notes = `Exact match with ${exactCandidate.entryNumber} (${exactCandidate.narration})`;
      usedJournalIds.add(exactCandidate.id);
      exactMatches++;

      await pool.query(
        `UPDATE bank_statement_lines
         SET match_status = 'EXACT_MATCHED', matched_journal_id = $1, matched_at = NOW(), notes = $2
         WHERE id = $3`,
        [exactCandidate.id, line.notes, line.id]
      );
      updatedLines.push(line);
      continue;
    }

    // Tier 2: Amount & Close Date Match (Amount exact + Date within ±2 days)
    const dateCandidate = allJournals.find((j) => {
      if (usedJournalIds.has(j.id)) return false;
      const jAmt = j.totalDebit;
      if (Math.abs(jAmt - lineAmount) > 0.01) return false;

      const dateDiff = Math.abs((new Date(j.entryDate) - new Date(line.transactionDate)) / 86400000);
      return dateDiff <= 2;
    });

    if (dateCandidate) {
      line.matchStatus = 'AUTO_MATCHED';
      line.matchedJournalId = dateCandidate.id;
      line.matchedAt = new Date().toISOString();
      line.notes = `Amount & Date match with ${dateCandidate.entryNumber}`;
      usedJournalIds.add(dateCandidate.id);
      autoMatches++;

      await pool.query(
        `UPDATE bank_statement_lines
         SET match_status = 'AUTO_MATCHED', matched_journal_id = $1, matched_at = NOW(), notes = $2
         WHERE id = $3`,
        [dateCandidate.id, line.notes, line.id]
      );
      updatedLines.push(line);
      continue;
    }

    // Unmatched
    line.matchStatus = 'UNMATCHED';
    unmatchedCount++;
    updatedLines.push(line);
  }

  const reconciledLines = exactMatches + autoMatches;
  const status = reconciledLines === lines.length && lines.length > 0 ? 'RECONCILED' : 'IN_PROGRESS';

  await pool.query(
    `UPDATE bank_statements
     SET reconciled_lines = $1, status = $2
     WHERE id = $3`,
    [reconciledLines, status, statementId]
  );

  return {
    statementId,
    totalLines: lines.length,
    exactMatches,
    autoMatches,
    unmatchedCount,
    reconciliationPercentage: lines.length > 0 ? roundMoney((reconciledLines / lines.length) * 100) : 100,
    lines: updatedLines
  };
}

export async function manuallyMatchLine(companyId, statementId, lineId, journalEntryId, userId) {
  const lineRes = await pool.query(
    `SELECT * FROM bank_statement_lines WHERE id = $1 AND statement_id = $2`,
    [lineId, statementId]
  );
  if (lineRes.rows.length === 0) throw new Error('Statement line not found.');

  const journalsRes = await accountingEngine.getJournalEntries(companyId, { limit: 50000 });
  const journal = journalsRes.entries.find((j) => j.id === journalEntryId);
  if (!journal) throw new Error('Journal entry not found.');

  const notes = `Manually paired with ${journal.entryNumber}`;
  const updateRes = await pool.query(
    `UPDATE bank_statement_lines
     SET match_status = 'MANUALLY_MATCHED', matched_journal_id = $1, matched_at = NOW(), notes = $2
     WHERE id = $3
     RETURNING *`,
    [journalEntryId, notes, lineId]
  );

  // Recount reconciled lines
  const countRes = await pool.query(
    `SELECT COUNT(*) as count FROM bank_statement_lines
     WHERE statement_id = $1 AND match_status IN ('EXACT_MATCHED', 'AUTO_MATCHED', 'MANUALLY_MATCHED')`,
    [statementId]
  );
  const reconciledLines = Number(countRes.rows[0]?.count || 0);

  const stmtRes = await pool.query(`SELECT total_lines FROM bank_statements WHERE id = $1`, [statementId]);
  const totalLines = Number(stmtRes.rows[0]?.total_lines || 0);
  const status = reconciledLines >= totalLines ? 'RECONCILED' : 'IN_PROGRESS';

  await pool.query(
    `UPDATE bank_statements SET reconciled_lines = $1, status = $2 WHERE id = $3`,
    [reconciledLines, status, statementId]
  );

  return { success: true, line: mapLineRow(updateRes.rows[0]) };
}

export async function getBankStatements(companyId) {
  const res = await pool.query(
    `SELECT * FROM bank_statements WHERE company_id = $1 ORDER BY statement_start DESC, created_at DESC`,
    [companyId]
  );
  return res.rows.map(mapStatementRow);
}

export async function getStatementLines(statementId) {
  const res = await pool.query(
    `SELECT * FROM bank_statement_lines WHERE statement_id = $1 ORDER BY transaction_date ASC`,
    [statementId]
  );
  return res.rows.map(mapLineRow);
}

function parseBankCsv(csv) {
  const rows = csv.split('\n').map((r) => r.trim()).filter(Boolean);
  if (rows.length < 2) return [];

  const lines = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 3) continue;

    lines.push({
      transactionDate: cols[0],
      description: cols[1],
      referenceNumber: cols[2] || '',
      withdrawalAmount: Number(cols[3]) || 0,
      depositAmount: Number(cols[4]) || 0,
      runningBalance: Number(cols[5]) || 0
    });
  }
  return lines;
}

export async function getAccountingSuggestions(companyId, statementId) {
  const linesRes = await pool.query(
    `SELECT * FROM bank_statement_lines WHERE statement_id = $1 AND match_status = 'UNMATCHED'`,
    [statementId]
  );
  const coa = await accountingEngine.getChartOfAccounts(companyId);

  return linesRes.rows.map((row) => {
    const desc = (row.description || '').toLowerCase();
    let suggestedCode = row.withdrawal_amount > 0 ? '5090' : '4090';
    let suggestedCategory = row.withdrawal_amount > 0 ? 'Operating Expense' : 'Other Income';

    if (desc.includes('salary') || desc.includes('payroll') || desc.includes('wages')) {
      suggestedCode = '5030';
      suggestedCategory = 'Salaries & Wages';
    } else if (desc.includes('rent') || desc.includes('lease') || desc.includes('office')) {
      suggestedCode = '5040';
      suggestedCategory = 'Rent & Facilities';
    } else if (desc.includes('software') || desc.includes('aws') || desc.includes('cloud') || desc.includes('google') || desc.includes('github')) {
      suggestedCode = '5060';
      suggestedCategory = 'Software & Subscriptions';
    } else if (desc.includes('interest') || desc.includes('dividend')) {
      suggestedCode = '4030';
      suggestedCategory = 'Interest Income';
    } else if (desc.includes('inv') || desc.includes('customer') || desc.includes('client') || desc.includes('receipt')) {
      suggestedCode = '1030';
      suggestedCategory = 'Accounts Receivable';
    } else if (desc.includes('vendor') || desc.includes('bill') || desc.includes('supplier') || desc.includes('neft to')) {
      suggestedCode = '2010';
      suggestedCategory = 'Accounts Payable';
    } else if (desc.includes('tax') || desc.includes('gst') || desc.includes('tds') || desc.includes('challan')) {
      suggestedCode = '2020';
      suggestedCategory = 'GST / Statutory Liability';
    }

    const matchedAccount = coa.find((a) => a.code === suggestedCode) || coa[0];

    return {
      lineId: row.id,
      description: row.description,
      withdrawalAmount: Number(row.withdrawal_amount || 0),
      depositAmount: Number(row.deposit_amount || 0),
      suggestedCategory,
      suggestedAccountId: matchedAccount?.id,
      suggestedAccountName: matchedAccount?.name,
      suggestedAccountCode: matchedAccount?.code
    };
  });
}

export async function postJournalForBankLine(companyId, statementId, lineId, { targetAccountId, narration }, userId) {
  const lineRes = await pool.query(
    `SELECT * FROM bank_statement_lines WHERE id = $1 AND statement_id = $2`,
    [lineId, statementId]
  );
  if (lineRes.rows.length === 0) throw new Error('Statement line not found.');
  const line = lineRes.rows[0];

  const stmtRes = await pool.query(`SELECT account_id FROM bank_statements WHERE id = $1`, [statementId]);
  const bankAccountId = stmtRes.rows[0]?.account_id;
  if (!bankAccountId) throw new Error('Bank account not associated with statement.');

  const wAmt = Number(line.withdrawal_amount || 0);
  const dAmt = Number(line.deposit_amount || 0);
  const amount = wAmt > 0 ? wAmt : dAmt;

  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const destAccount = coa.find((a) => a.id === targetAccountId);
  if (!destAccount) throw new Error('Target account not found in Chart of Accounts.');

  const journalLines = [];
  if (wAmt > 0) {
    journalLines.push({ accountId: targetAccountId, debit: amount, credit: 0, narration: narration || line.description });
    journalLines.push({ accountId: bankAccountId, debit: 0, credit: amount, narration: `Bank payment: ${line.description}` });
  } else {
    journalLines.push({ accountId: bankAccountId, debit: amount, credit: 0, narration: `Bank receipt: ${line.description}` });
    journalLines.push({ accountId: targetAccountId, debit: 0, credit: amount, narration: narration || line.description });
  }

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: String(line.transaction_date).split('T')[0],
    narration: narration || `Auto-posted bank entry: ${line.description}`,
    referenceType: 'BANK_TRANSACTION',
    referenceId: line.id,
    referenceNumber: line.reference_number || 'BANK-TX',
    lines: journalLines
  });

  return await manuallyMatchLine(companyId, statementId, lineId, journalEntry.id, userId);
}
