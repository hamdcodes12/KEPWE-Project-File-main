import crypto from 'crypto';
import { pool } from '../config/db.js';
import * as accountingEngine from './accounting-engine.service.js';
import { roundMoney } from './accounting-engine.service.js';
import { formatDateOnly } from '../lib/date-utils.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function mapEmployeeRow(row, salaryStructure = null) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    employeeCode: row.employee_code,
    name: row.name,
    email: row.email || '',
    phone: row.phone || '',
    pan: row.pan || '',
    aadhaar: row.aadhaar || '',
    uan: row.uan || '',
    esiIpNumber: row.esi_ip_number || '',
    designation: row.designation || 'Team Member',
    department: row.department || 'Operations',
    joiningDate: formatDateOnly(row.joining_date),
    bankName: row.bank_name || 'HDFC Bank',
    bankAccountNum: row.bank_account_num || '',
    bankIfsc: row.bank_ifsc || '',
    isPfEligible: Boolean(row.is_pf_eligible),
    isEsiEligible: Boolean(row.is_esi_eligible),
    isPtEligible: Boolean(row.is_pt_eligible),
    status: row.status || 'ACTIVE',
    salaryStructure,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapStructureRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    monthlyBasic: Number(row.monthly_basic || 0),
    monthlyHra: Number(row.monthly_hra || 0),
    monthlySpecial: Number(row.monthly_special || 0),
    monthlyConveyance: Number(row.monthly_conveyance || 0),
    monthlyGross: Number(row.monthly_gross || 0),
    effectiveFrom: formatDateOnly(row.effective_from),
    isCurrent: Boolean(row.is_current),
    createdAt: row.created_at
  };
}

function mapRunRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    payPeriod: row.pay_period,
    runDate: formatDateOnly(row.run_date),
    totalEmployees: Number(row.total_employees || 0),
    totalGross: Number(row.total_gross || 0),
    totalEmployeePf: Number(row.total_employee_pf || 0),
    totalEmployerPf: Number(row.total_employer_pf || 0),
    totalEmployeeEsi: Number(row.total_employee_esi || 0),
    totalEmployerEsi: Number(row.total_employer_esi || 0),
    totalPt: Number(row.total_pt || 0),
    totalTds: Number(row.total_tds || 0),
    totalNetSalary: Number(row.total_net_salary || 0),
    status: row.status || 'DRAFT',
    journalEntryId: row.journal_entry_id,
    createdAt: row.created_at
  };
}

// ── 1. EMPLOYEE MASTER SERVICE ──────────────────────────────────────────────
export async function createEmployee(companyId, userId, data) {
  const name = data.name?.trim();
  if (!name) throw new Error('Employee name is required.');

  const empId = crypto.randomUUID();

  // Count existing to generate code if missing
  const countRes = await pool.query(
    `SELECT COUNT(*) as count FROM payroll_employees WHERE company_id = $1`,
    [companyId]
  );
  const nextNum = String(Number(countRes.rows[0]?.count || 0) + 1).padStart(3, '0');
  const employeeCode = data.employeeCode?.trim() || `EMP-${nextNum}`;

  const joiningDate = data.joiningDate || new Date().toISOString().split('T')[0];

  const insertRes = await pool.query(
    `INSERT INTO payroll_employees
       (id, company_id, employee_code, name, email, phone, pan, aadhaar, uan, esi_ip_number,
        designation, department, joining_date, bank_name, bank_account_num, bank_ifsc,
        is_pf_eligible, is_esi_eligible, is_pt_eligible, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'ACTIVE')
     RETURNING *`,
    [
      empId,
      companyId,
      employeeCode,
      name,
      data.email || '',
      data.phone || '',
      data.pan || '',
      data.aadhaar || '',
      data.uan || '',
      data.esiIpNumber || '',
      data.designation || 'Team Member',
      data.department || 'Operations',
      joiningDate,
      data.bankName || 'HDFC Bank',
      data.bankAccountNum || '',
      data.bankIfsc || '',
      data.isPfEligible ?? true,
      data.isEsiEligible ?? false,
      data.isPtEligible ?? true
    ]
  );

  let structObj = null;
  if (data.monthlyGross) {
    structObj = await setSalaryStructure(empId, {
      monthlyGross: data.monthlyGross,
      monthlyBasic: data.monthlyBasic,
      monthlyHra: data.monthlyHra,
      monthlySpecial: data.monthlySpecial
    });
  }

  return mapEmployeeRow(insertRes.rows[0], structObj);
}

export async function getEmployees(companyId) {
  const empsRes = await pool.query(
    `SELECT * FROM payroll_employees WHERE company_id = $1 ORDER BY employee_code ASC`,
    [companyId]
  );

  if (empsRes.rows.length === 0) {
    return [];
  }

  // Get current salary structures
  const empIds = empsRes.rows.map((r) => r.id);
  const structsRes = await pool.query(
    `SELECT * FROM payroll_salary_structures WHERE employee_id = ANY($1::uuid[]) AND is_current = TRUE`,
    [empIds]
  );

  const structMap = new Map();
  for (const row of structsRes.rows) {
    structMap.set(row.employee_id, mapStructureRow(row));
  }

  return empsRes.rows.map((row) => mapEmployeeRow(row, structMap.get(row.id) || null));
}

export async function setSalaryStructure(employeeId, data) {
  const gross = roundMoney(data.monthlyGross || 0);
  if (gross <= 0) {
    throw new Error('Monthly gross salary must be greater than zero.');
  }
  const basic = roundMoney(data.monthlyBasic || gross * 0.5); // Default 50% Basic
  const hra = roundMoney(data.monthlyHra || basic * 0.5);     // Default 50% of Basic
  const special = roundMoney(Math.max(0, gross - (basic + hra)));

  // Deactivate prior current structure
  await pool.query(
    `UPDATE payroll_salary_structures SET is_current = FALSE WHERE employee_id = $1`,
    [employeeId]
  );

  const structId = crypto.randomUUID();
  const insertRes = await pool.query(
    `INSERT INTO payroll_salary_structures
       (id, employee_id, monthly_basic, monthly_hra, monthly_special, monthly_conveyance, monthly_gross, effective_from, is_current)
     VALUES ($1, $2, $3, $4, $5, 1600.00, $6, CURRENT_DATE, TRUE)
     RETURNING *`,
    [structId, employeeId, basic, hra, special, gross]
  );

  return mapStructureRow(insertRes.rows[0]);
}

// ── 2. STATUTORY DEDUCTION CALCULATORS ───────────────────────────────────────
export function calculateStatutoryDeductions({ gross, basic, isPfEligible = true, isEsiEligible = false, isPtEligible = true, state = 'Maharashtra', month = 9 }) {
  // 1. EPF (Employee Provident Fund)
  // Employee: 12% of basic (statutory cap on ₹15,000 wage ceiling = ₹1,800, or actual basic)
  let employeePf = 0;
  let employerPf = 0;
  if (isPfEligible) {
    const pfBase = Math.min(basic, 15000); // Standard statutory ceiling
    employeePf = roundMoney((pfBase * 12) / 100);
    // Employer: 12% total (3.67% EPF + 8.33% EPS up to cap + 0.5% Admin)
    employerPf = roundMoney((pfBase * 12) / 100);
  }

  // 2. ESI (Employee State Insurance)
  // Applicable only if monthly gross <= ₹21,000
  let employeeEsi = 0;
  let employerEsi = 0;
  if (isEsiEligible || gross <= 21000) {
    employeeEsi = roundMoney((gross * 0.75) / 100);
    employerEsi = roundMoney((gross * 3.25) / 100);
  }

  // 3. Professional Tax (PT) Slabs (State-specific)
  let professionalTax = 0;
  if (isPtEligible) {
    if (state.toLowerCase().includes('maharashtra')) {
      if (gross > 10000) {
        professionalTax = month === 2 ? 300 : 200; // ₹300 in February, ₹200 other months
      } else if (gross > 7500) {
        professionalTax = 175;
      }
    } else if (state.toLowerCase().includes('karnataka')) {
      if (gross >= 15000) professionalTax = 200;
    } else {
      if (gross > 15000) professionalTax = 200;
    }
  }

  return { employeePf, employerPf, employeeEsi, employerEsi, professionalTax };
}

// ── 3. MONTHLY PAYROLL RUN & JOURNAL POSTING ────────────────────────────────
export async function executePayrollRun(companyId, userId, { payPeriod = '2026-09', attendanceMap = {} }) {
  const employees = await getEmployees(companyId);
  const activeEmps = employees.filter((e) => e.status === 'ACTIVE');

  if (activeEmps.length === 0) {
    throw new Error('No active employees found in the company roster.');
  }

  // Strictly enforce that all employees have a configured salary structure
  for (const emp of activeEmps) {
    if (!emp.salaryStructure || !emp.salaryStructure.monthlyGross) {
      throw new Error(`Employee ${emp.name} (${emp.employeeCode}) has no configured salary structure. Set salary before running payroll.`);
    }
  }

  const runId = crypto.randomUUID();
  const runDate = new Date().toISOString().split('T')[0];
  const profile = await accountingEngine.getCompanyProfile(companyId, userId);
  const state = profile.state || 'Maharashtra';
  const monthNumber = Number(payPeriod.split('-')[1]) || 9;

  let totalGross = 0;
  let totalEmployeePf = 0;
  let totalEmployerPf = 0;
  let totalEmployeeEsi = 0;
  let totalEmployerEsi = 0;
  let totalPt = 0;
  let totalTds = 0;
  let totalNetSalary = 0;

  const generatedPayslips = [];

  for (const emp of activeEmps) {
    const struct = emp.salaryStructure;

    const workingDays = 30;
    const presentDays = attendanceMap[emp.id]?.presentDays ?? 30;
    const leaveDays = workingDays - presentDays;
    const prorationRatio = presentDays / workingDays;

    const earnedBasic = roundMoney(struct.monthlyBasic * prorationRatio);
    const earnedHra = roundMoney(struct.monthlyHra * prorationRatio);
    const earnedSpecial = roundMoney(struct.monthlySpecial * prorationRatio);
    const earnedGross = roundMoney(earnedBasic + earnedHra + earnedSpecial);

    const deductions = calculateStatutoryDeductions({
      gross: earnedGross,
      basic: earnedBasic,
      isPfEligible: emp.isPfEligible,
      isEsiEligible: emp.isEsiEligible,
      isPtEligible: emp.isPtEligible,
      state,
      month: monthNumber
    });

    const tds = earnedGross > 75000 ? roundMoney((earnedGross - 75000) * 0.1) : 0;
    const totalDeduction = roundMoney(deductions.employeePf + deductions.employeeEsi + deductions.professionalTax + tds);
    const netSalary = roundMoney(earnedGross - totalDeduction);

    totalGross = roundMoney(totalGross + earnedGross);
    totalEmployeePf = roundMoney(totalEmployeePf + deductions.employeePf);
    totalEmployerPf = roundMoney(totalEmployerPf + deductions.employerPf);
    totalEmployeeEsi = roundMoney(totalEmployeeEsi + deductions.employeeEsi);
    totalEmployerEsi = roundMoney(totalEmployerEsi + deductions.employerEsi);
    totalPt = roundMoney(totalPt + deductions.professionalTax);
    totalTds = roundMoney(totalTds + tds);
    totalNetSalary = roundMoney(totalNetSalary + netSalary);

    const slip = {
      id: crypto.randomUUID(),
      payrollRunId: runId,
      employeeId: emp.id,
      companyId,
      employeeCode: emp.employeeCode,
      employeeName: emp.name,
      designation: emp.designation,
      department: emp.department,
      bankAccountNum: emp.bankAccountNum,
      bankIfsc: emp.bankIfsc,
      payPeriod,
      workingDays,
      presentDays,
      leaveDays,
      basicEarned: earnedBasic,
      hraEarned: earnedHra,
      allowancesEarned: earnedSpecial,
      grossEarnings: earnedGross,
      employeePf: deductions.employeePf,
      employerPf: deductions.employerPf,
      employeeEsi: deductions.employeeEsi,
      employerEsi: deductions.employerEsi,
      professionalTax: deductions.professionalTax,
      tdsDeducted: tds,
      totalDeductions: totalDeduction,
      netSalary,
      paymentStatus: 'UNPAID'
    };
    generatedPayslips.push(slip);
  }

  // ── Automatically Create Balanced Double-Entry Payroll Journal Entry ────────
  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const salaryExp = coa.find((a) => a.code === '5020') || coa.find((a) => a.subtype === 'PAYROLL_EXPENSE');
  const epfExp = coa.find((a) => a.code === '5021') || coa.find((a) => a.subtype === 'PAYROLL_EXPENSE');
  const esiExp = coa.find((a) => a.code === '5022') || coa.find((a) => a.subtype === 'PAYROLL_EXPENSE');

  const epfPayable = coa.find((a) => a.code === '2040') || coa.find((a) => a.subtype === 'PAYROLL_STATUTORY');
  const esiPayable = coa.find((a) => a.code === '2041') || coa.find((a) => a.subtype === 'PAYROLL_STATUTORY');
  const ptPayable = coa.find((a) => a.code === '2042') || coa.find((a) => a.subtype === 'PAYROLL_STATUTORY');
  const tds192Payable = coa.find((a) => a.code === '2034') || coa.find((a) => a.subtype === 'TDS_PAYABLE');
  const netSalariesPayable = coa.find((a) => a.code === '2050') || coa.find((a) => a.subtype === 'SALARIES_PAYABLE');

  if (!salaryExp || !netSalariesPayable) {
    throw new Error('Required Salaries Expense or Salaries Payable accounts not found in Chart of Accounts.');
  }

  const combinedEpf = roundMoney(totalEmployeePf + totalEmployerPf);
  const combinedEsi = roundMoney(totalEmployeeEsi + totalEmployerEsi);

  const journalLines = [
    { accountId: salaryExp.id, debit: totalGross, credit: 0, narration: `Gross Employee Salaries for ${payPeriod}` }
  ];

  if (totalEmployerPf > 0 && epfExp) {
    journalLines.push({ accountId: epfExp.id, debit: totalEmployerPf, credit: 0, narration: `Employer EPF Contribution for ${payPeriod}` });
  }
  if (totalEmployerEsi > 0 && esiExp) {
    journalLines.push({ accountId: esiExp.id, debit: totalEmployerEsi, credit: 0, narration: `Employer ESI Contribution for ${payPeriod}` });
  }

  if (combinedEpf > 0 && epfPayable) {
    journalLines.push({ accountId: epfPayable.id, debit: 0, credit: combinedEpf, narration: `EPF Dues (Employee + Employer) for ${payPeriod}` });
  }
  if (combinedEsi > 0 && esiPayable) {
    journalLines.push({ accountId: esiPayable.id, debit: 0, credit: combinedEsi, narration: `ESI Dues (Employee + Employer) for ${payPeriod}` });
  }
  if (totalPt > 0 && ptPayable) {
    journalLines.push({ accountId: ptPayable.id, debit: 0, credit: totalPt, narration: `Professional Tax Payable for ${payPeriod}` });
  }
  if (totalTds > 0 && tds192Payable) {
    journalLines.push({ accountId: tds192Payable.id, debit: 0, credit: totalTds, narration: `TDS under Section 192 for ${payPeriod}` });
  }

  journalLines.push({ accountId: netSalariesPayable.id, debit: 0, credit: totalNetSalary, narration: `Net Salaries Payable for ${payPeriod}` });

  // Eliminate 1-paisa rounding
  const debitsSum = roundMoney(journalLines.reduce((acc, l) => acc + l.debit, 0));
  const creditsSum = roundMoney(journalLines.reduce((acc, l) => acc + l.credit, 0));
  if (Math.abs(debitsSum - creditsSum) > 0.001) {
    journalLines[journalLines.length - 1].credit = debitsSum - roundMoney(journalLines.slice(0, -1).reduce((acc, l) => acc + l.credit, 0));
  }

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: runDate,
    narration: `Monthly Payroll Run for ${payPeriod} (${activeEmps.length} employees)`,
    referenceType: 'PAYROLL',
    referenceId: runId,
    referenceNumber: `PAY-${payPeriod}`,
    lines: journalLines
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const runRes = await client.query(
      `INSERT INTO payroll_runs
         (id, company_id, pay_period, run_date, total_employees, total_gross,
          total_employee_pf, total_employer_pf, total_employee_esi, total_employer_esi,
          total_pt, total_tds, total_net_salary, status, journal_entry_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'CONFIRMED', $14)
       RETURNING *`,
      [
        runId,
        companyId,
        payPeriod,
        runDate,
        activeEmps.length,
        totalGross,
        totalEmployeePf,
        totalEmployerPf,
        totalEmployeeEsi,
        totalEmployerEsi,
        totalPt,
        totalTds,
        totalNetSalary,
        journalEntry.id
      ]
    );

    for (const slip of generatedPayslips) {
      await client.query(
        `INSERT INTO payroll_payslips
           (id, payroll_run_id, employee_id, company_id, working_days, present_days, leave_days,
            gross_earnings, basic_earned, hra_earned, allowances_earned,
            employee_pf, employer_pf, employee_esi, employer_esi, professional_tax,
            tds_deducted, total_deductions, net_salary, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'UNPAID')`,
        [
          slip.id,
          runId,
          slip.employeeId,
          companyId,
          slip.workingDays,
          slip.presentDays,
          slip.leaveDays,
          slip.grossEarnings,
          slip.basicEarned,
          slip.hraEarned,
          slip.allowancesEarned,
          slip.employeePf,
          slip.employerPf,
          slip.employeeEsi,
          slip.employerEsi,
          slip.professionalTax,
          slip.tdsDeducted,
          slip.totalDeductions,
          slip.netSalary
        ]
      );
    }

    await client.query('COMMIT');

    const formattedSlips = generatedPayslips.map((s) => ({
      id: s.id,
      payrollRunId: s.payrollRunId,
      employeeId: s.employeeId,
      employeeCode: s.employeeCode,
      employeeName: s.employeeName,
      designation: s.designation,
      department: s.department,
      bankAccountNum: s.bankAccountNum,
      bankIfsc: s.bankIfsc,
      payPeriod: s.payPeriod,
      workingDays: s.workingDays,
      presentDays: s.presentDays,
      leaveDays: s.leaveDays,
      earnings: {
        basic: s.basicEarned,
        hra: s.hraEarned,
        allowances: s.allowancesEarned,
        gross: s.grossEarnings
      },
      deductions: {
        employeePf: s.employeePf,
        employerPf: s.employerPf,
        employeeEsi: s.employeeEsi,
        employerEsi: s.employerEsi,
        professionalTax: s.professionalTax,
        tds: s.tdsDeducted,
        total: s.totalDeductions
      },
      netSalary: s.netSalary,
      paymentStatus: s.paymentStatus
    }));

    return {
      run: mapRunRow(runRes.rows[0]),
      payslips: formattedSlips,
      journalEntry
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function disburseSalaries(companyId, runId, userId, bankAccountId) {
  const runRes = await pool.query(
    `SELECT * FROM payroll_runs WHERE id = $1 AND company_id = $2`,
    [runId, companyId]
  );
  const run = runRes.rows[0];
  if (!run) throw new Error('Payroll run not found.');

  const coa = await accountingEngine.getChartOfAccounts(companyId);
  const netSalariesPayable = coa.find((a) => a.code === '2050') || coa.find((a) => a.subtype === 'SALARIES_PAYABLE');
  const bankAcc = bankAccountId
    ? coa.find((a) => a.id === bankAccountId)
    : coa.find((a) => a.code === '1010') || coa.find((a) => a.subtype === 'BANK');

  if (!netSalariesPayable || !bankAcc) {
    throw new Error('Required Salaries Payable or Bank account not found in Chart of Accounts.');
  }

  const { entry: journalEntry } = await accountingEngine.postJournalEntry(companyId, userId, {
    entryDate: new Date().toISOString().split('T')[0],
    narration: `Salary Payout for ${run.pay_period} from ${bankAcc.name}`,
    referenceType: 'PAYMENT',
    referenceId: runId,
    referenceNumber: `DISB-${run.pay_period}`,
    lines: [
      { accountId: netSalariesPayable.id, debit: Number(run.total_net_salary), credit: 0, narration: `Salaries Payable cleared for ${run.pay_period}` },
      { accountId: bankAcc.id, debit: 0, credit: Number(run.total_net_salary), narration: `Net payroll disbursed from ${bankAcc.name}` }
    ]
  });

  await pool.query(
    `UPDATE payroll_runs SET status = 'PAID' WHERE id = $1 AND company_id = $2`,
    [runId, companyId]
  );
  await pool.query(
    `UPDATE payroll_payslips SET payment_status = 'PAID' WHERE payroll_run_id = $1`,
    [runId]
  );

  return { success: true, run: { ...mapRunRow(run), status: 'PAID' }, journalEntry };
}

export async function getPayrollRuns(companyId) {
  const res = await pool.query(
    `SELECT * FROM payroll_runs WHERE company_id = $1 ORDER BY run_date DESC, created_at DESC`,
    [companyId]
  );
  return res.rows.map(mapRunRow);
}

export async function getPayslips(runId) {
  const res = await pool.query(
    `SELECT p.*, e.employee_code, e.name as employee_name, e.designation, e.department, e.bank_account_num, e.bank_ifsc
     FROM payroll_payslips p
     JOIN payroll_employees e ON p.employee_id = e.id
     WHERE p.payroll_run_id = $1`,
    [runId]
  );

  return res.rows.map((row) => ({
    id: row.id,
    payrollRunId: row.payroll_run_id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    designation: row.designation,
    department: row.department,
    bankAccountNum: row.bank_account_num,
    bankIfsc: row.bank_ifsc,
    workingDays: Number(row.working_days || 0),
    presentDays: Number(row.present_days || 0),
    leaveDays: Number(row.leave_days || 0),
    earnings: {
      basic: Number(row.basic_earned || 0),
      hra: Number(row.hra_earned || 0),
      allowances: Number(row.allowances_earned || 0),
      gross: Number(row.gross_earnings || 0)
    },
    deductions: {
      employeePf: Number(row.employee_pf || 0),
      employerPf: Number(row.employer_pf || 0),
      employeeEsi: Number(row.employee_esi || 0),
      employerEsi: Number(row.employer_esi || 0),
      professionalTax: Number(row.professional_tax || 0),
      tds: Number(row.tds_deducted || 0),
      total: Number(row.total_deductions || 0)
    },
    netSalary: Number(row.net_salary || 0),
    paymentStatus: row.payment_status || 'UNPAID'
  }));
}
