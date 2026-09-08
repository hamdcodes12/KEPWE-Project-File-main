import crypto from 'crypto';
import { pool } from '../config/db.js';
import * as accountingEngine from './accounting-engine.service.js';
import { formatDateOnly } from '../lib/date-utils.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function mapTaskRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    ruleCode: row.rule_code,
    title: row.title,
    act: row.act,
    period: row.period,
    dueDate: formatDateOnly(row.due_date),
    completionDate: row.completion_date ? formatDateOnly(row.completion_date) : null,
    status: row.status,
    filingReference: row.filing_reference || null,
    assignedTo: row.assigned_to || null,
    notes: row.notes || '',
    priority: row.priority || (row.status === 'OVERDUE' ? 'CRITICAL' : 'HIGH'),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function generateComplianceCalendar(companyId, userId, year = 2026) {
  const profile = await accountingEngine.getCompanyProfile(companyId, userId);
  const entityType = profile.entityType || 'Private Limited';
  const isPvtLtdOrLlp = ['Private Limited', 'Public Limited', 'LLP'].includes(entityType);

  // Check if tasks already exist in database
  const existingRes = await pool.query(
    `SELECT * FROM compliance_tasks WHERE company_id = $1`,
    [companyId]
  );

  if (existingRes.rows.length > 0) {
    const updated = updateTaskStatuses(existingRes.rows.map(mapTaskRow));
    for (const t of updated) {
      await pool.query(
        `UPDATE compliance_tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND status != 'COMPLETED'`,
        [t.status, t.id]
      );
    }
    return updated;
  }

  const tasksToInsert = [];

  // 1. Monthly Recurring Obligations: GSTR-1, GSTR-3B, TDS Challan 281, EPF, ESI
  const calendarMonths = [
    { period: `${year}-04`, dueMonth: `${year}-05`, name: 'April 2026' },
    { period: `${year}-05`, dueMonth: `${year}-06`, name: 'May 2026' },
    { period: `${year}-06`, dueMonth: `${year}-07`, name: 'June 2026' },
    { period: `${year}-07`, dueMonth: `${year}-08`, name: 'July 2026' },
    { period: `${year}-08`, dueMonth: `${year}-09`, name: 'August 2026' },
    { period: `${year}-09`, dueMonth: `${year}-10`, name: 'September 2026' },
    { period: `${year}-10`, dueMonth: `${year}-11`, name: 'October 2026' },
    { period: `${year}-11`, dueMonth: `${year}-12`, name: 'November 2026' },
    { period: `${year}-12`, dueMonth: `${year + 1}-01`, name: 'December 2026' },
    { period: `${year + 1}-01`, dueMonth: `${year + 1}-02`, name: 'January 2027' },
    { period: `${year + 1}-02`, dueMonth: `${year + 1}-03`, name: 'February 2027' },
    { period: `${year + 1}-03`, dueMonth: `${year + 1}-04`, name: 'March 2027' },
  ];

  for (const m of calendarMonths) {
    tasksToInsert.push({
      id: crypto.randomUUID(),
      companyId,
      act: 'INCOME_TAX',
      ruleCode: 'TDS_CHALLAN_281',
      title: `TDS Deposit (Challan 281) for ${m.name}`,
      period: m.period,
      dueDate: `${m.dueMonth}-07`,
      description: 'Monthly deposit of tax deducted at source under Sections 194C, 194J, 194I, etc.'
    });

    tasksToInsert.push({
      id: crypto.randomUUID(),
      companyId,
      act: 'GST',
      ruleCode: 'GST_GSTR1_M',
      title: `GSTR-1 Monthly Return for ${m.name}`,
      period: m.period,
      dueDate: `${m.dueMonth}-11`,
      description: 'Monthly return of outward taxable supplies, debit/credit notes and HSN summary.'
    });

    tasksToInsert.push({
      id: crypto.randomUUID(),
      companyId,
      act: 'EPF',
      ruleCode: 'EPF_ECR_DEPOSIT',
      title: `EPF ECR & ESI Deposit for ${m.name}`,
      period: m.period,
      dueDate: `${m.dueMonth}-15`,
      description: 'Statutory Provident Fund and Employee State Insurance monthly contribution.'
    });

    tasksToInsert.push({
      id: crypto.randomUUID(),
      companyId,
      act: 'GST',
      ruleCode: 'GST_GSTR3B_M',
      title: `GSTR-3B Monthly Tax Summary for ${m.name}`,
      period: m.period,
      dueDate: `${m.dueMonth}-20`,
      description: 'Summary tax liability, Input Tax Credit offset, and net cash GST payment.'
    });
  }

  // 2. Quarterly TDS Form 26Q Returns
  tasksToInsert.push(
    { id: crypto.randomUUID(), companyId, act: 'INCOME_TAX', ruleCode: 'TDS_RETURN_26Q', title: 'Form 26Q TDS Return (Q1 Apr-Jun)', period: 'Q1-2026', dueDate: `${year}-07-31`, description: 'Quarterly statement of tax deducted on payments other than salary.' },
    { id: crypto.randomUUID(), companyId, act: 'INCOME_TAX', ruleCode: 'TDS_RETURN_26Q', title: 'Form 26Q TDS Return (Q2 Jul-Sep)', period: 'Q2-2026', dueDate: `${year}-10-31`, description: 'Quarterly statement of tax deducted on payments other than salary.' },
    { id: crypto.randomUUID(), companyId, act: 'INCOME_TAX', ruleCode: 'TDS_RETURN_26Q', title: 'Form 26Q TDS Return (Q3 Oct-Dec)', period: 'Q3-2026', dueDate: `${year + 1}-01-31`, description: 'Quarterly statement of tax deducted on payments other than salary.' },
    { id: crypto.randomUUID(), companyId, act: 'INCOME_TAX', ruleCode: 'TDS_RETURN_26Q', title: 'Form 26Q TDS Return (Q4 Jan-Mar)', period: 'Q4-2026', dueDate: `${year + 1}-05-31`, description: 'Quarterly statement of tax deducted on payments other than salary.' }
  );

  // 3. Advance Tax Installments
  tasksToInsert.push(
    { id: crypto.randomUUID(), companyId, act: 'INCOME_TAX', ruleCode: 'ADVANCE_TAX_Q1', title: 'Advance Tax Installment 1 (15%)', period: 'FY-2026-27', dueDate: `${year}-06-15`, description: 'Payment of first installment of advance tax (15% of annual estimated tax).' },
    { id: crypto.randomUUID(), companyId, act: 'INCOME_TAX', ruleCode: 'ADVANCE_TAX_Q2', title: 'Advance Tax Installment 2 (45%)', period: 'FY-2026-27', dueDate: `${year}-09-15`, description: 'Payment of second installment of advance tax (cumulative 45%).' },
    { id: crypto.randomUUID(), companyId, act: 'INCOME_TAX', ruleCode: 'ADVANCE_TAX_Q3', title: 'Advance Tax Installment 3 (75%)', period: 'FY-2026-27', dueDate: `${year}-12-15`, description: 'Payment of third installment of advance tax (cumulative 75%).' },
    { id: crypto.randomUUID(), companyId, act: 'INCOME_TAX', ruleCode: 'ADVANCE_TAX_Q4', title: 'Advance Tax Installment 4 (100%)', period: 'FY-2026-27', dueDate: `${year + 1}-03-15`, description: 'Payment of fourth and final installment of advance tax (100%).' }
  );

  // 4. Corporate MCA Obligations (if Company or LLP)
  if (isPvtLtdOrLlp) {
    tasksToInsert.push(
      { id: crypto.randomUUID(), companyId, act: 'COMPANIES_ACT', ruleCode: 'MCA_DIR3_KYC', title: 'DIR-3 KYC Director Verification', period: 'FY-2026-27', dueDate: `${year}-09-30`, description: 'Annual KYC of DIN holders on MCA portal.' },
      { id: crypto.randomUUID(), companyId, act: 'COMPANIES_ACT', ruleCode: 'MCA_AOC4', title: 'AOC-4 Financial Statement Filing', period: 'FY-2026-27', dueDate: `${year}-10-30`, description: 'Filing of audited balance sheet and P&L with Registrar of Companies.' },
      { id: crypto.randomUUID(), companyId, act: 'COMPANIES_ACT', ruleCode: 'MCA_MGT7', title: 'MGT-7 Annual Return Filing', period: 'FY-2026-27', dueDate: `${year}-11-29`, description: 'Filing of annual company return with MCA.' }
    );
  }

  // Calculate real statuses without fake completed data
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const sevenDaysLater = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertedRows = [];
    for (const t of tasksToInsert) {
      let status = 'UPCOMING';
      if (t.dueDate < todayStr) {
        status = 'OVERDUE';
      } else if (t.dueDate <= sevenDaysLater) {
        status = 'DUE_SOON';
      }

      const res = await client.query(
        `INSERT INTO compliance_tasks
           (id, company_id, rule_code, title, act, period, due_date, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [t.id, companyId, t.ruleCode, t.title, t.act, t.period, t.dueDate, status, t.description]
      );
      insertedRows.push(mapTaskRow(res.rows[0]));
    }

    await client.query('COMMIT');
    return insertedRows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getComplianceTasks(companyId, filters = {}) {
  let res = await pool.query(
    `SELECT * FROM compliance_tasks WHERE company_id = $1 ORDER BY due_date ASC`,
    [companyId]
  );

  let tasks = res.rows.map(mapTaskRow);
  if (tasks.length === 0) {
    tasks = await generateComplianceCalendar(companyId, null);
  } else {
    tasks = updateTaskStatuses(tasks);
  }

  if (filters.act) tasks = tasks.filter((t) => t.act === filters.act);
  if (filters.status) tasks = tasks.filter((t) => t.status === filters.status);

  // Sorting: Overdue first, then Due Soon, then Upcoming, then Completed
  const statusOrder = { OVERDUE: 1, DUE_SOON: 2, REQUIRES_ACTION: 3, UPCOMING: 4, COMPLETED: 5 };
  tasks.sort((a, b) => {
    const orderDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  const summary = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    overdue: tasks.filter((t) => t.status === 'OVERDUE').length,
    dueSoon: tasks.filter((t) => t.status === 'DUE_SOON').length,
    upcoming: tasks.filter((t) => t.status === 'UPCOMING').length,
    requiresAction: tasks.filter((t) => t.status === 'REQUIRES_ACTION').length
  };

  return { summary, tasks };
}

export async function completeComplianceTask(companyId, taskId, data = {}) {
  const ref = data.filingReference || data.acknowledgementNumber || data.challanNumber || data.arn;
  if (!ref || !ref.trim()) {
    throw new Error('Valid filing reference, ARN, or Challan number is required to complete statutory task.');
  }

  const today = new Date().toISOString().split('T')[0];

  const res = await pool.query(
    `UPDATE compliance_tasks
     SET status = 'COMPLETED', completion_date = $1, filing_reference = $2, notes = COALESCE($3, notes), updated_at = NOW()
     WHERE id = $4 AND company_id = $5
     RETURNING *`,
    [today, ref.trim(), data.notes || null, taskId, companyId]
  );

  if (res.rows.length === 0) {
    throw new Error('Compliance task not found.');
  }

  return { success: true, task: mapTaskRow(res.rows[0]) };
}

function updateTaskStatuses(tasks) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const sevenDaysLater = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

  return tasks.map((t) => {
    if (t.status === 'COMPLETED') return t;

    if (t.dueDate < todayStr) {
      return { ...t, status: 'OVERDUE' };
    } else if (t.dueDate <= sevenDaysLater) {
      return { ...t, status: 'DUE_SOON' };
    } else {
      return { ...t, status: 'UPCOMING' };
    }
  });
}
