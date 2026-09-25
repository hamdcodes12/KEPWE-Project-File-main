import React, { useState, useEffect, useCallback } from 'react';
import './ProductionLedgerViews.css';
import {
  Users,
  Play,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Landmark,
  CreditCard,
  Briefcase
} from 'lucide-react';
import {
  fetchPayrollEmployees,
  createPayrollEmployee,
  executePayrollRun,
  fetchPayrollRuns,
  fetchPayslips,
  disburseSalaries
} from '../../api/ledgerClient';

export default function PayrollView() {
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRunPayslips, setSelectedRunPayslips] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add Employee State
  const [addEmpModal, setAddEmpModal] = useState(false);
  const [empForm, setEmpForm] = useState({
    name: '',
    designation: 'Senior Software Engineer',
    department: 'Engineering',
    pan: 'AABCP1234F',
    baseSalary: 60000,
    hra: 24000,
    specialAllowance: 16000,
    pfOptOut: false
  });

  // Execute Payroll Run Modal
  const [payPeriod, setPayPeriod] = useState('2026-09');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [empRes, runRes] = await Promise.all([
        fetchPayrollEmployees(),
        fetchPayrollRuns()
      ]);
      if (empRes.ok) setEmployees(empRes.data.employees || []);
      if (runRes.ok) setRuns(runRes.data.runs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await createPayrollEmployee({
        ...empForm,
        baseSalary: Number(empForm.baseSalary),
        hra: Number(empForm.hra),
        specialAllowance: Number(empForm.specialAllowance)
      });
      if (res.ok) {
        setSuccessMsg(`Employee ${empForm.name} added to payroll master.`);
        setAddEmpModal(false);
        loadData();
      } else {
        setError(res.data?.error || 'Failed to add employee.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRun = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await executePayrollRun({ payPeriod });
      if (res.ok) {
        setSuccessMsg(`Payroll run for ${payPeriod} executed with balanced journal (Total Gross: ₹${res.data.run.totalGross}, Net: ₹${res.data.run.totalNetSalary}).`);
        loadData();
        setActiveTab('runs');
      } else {
        setError(res.data?.error || 'Failed to execute payroll run.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPayslips = async (runId) => {
    setActiveRunId(runId);
    try {
      const res = await fetchPayslips(runId);
      if (res.ok) {
        setSelectedRunPayslips(res.data.payslips || []);
        setActiveTab('payslips');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDisburse = async (runId) => {
    setLoading(true);
    try {
      const res = await disburseSalaries(runId, {});
      if (res.ok) {
        setSuccessMsg('Salaries disbursed from bank account. Salaries Payable (2050) cleared.');
        loadData();
      } else {
        setError(res.data?.error || 'Disbursement failed.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmtInr = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  return (
    <div className="prod-view-container">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="prod-view-header">
        <div className="prod-view-title-group">
          <h2>Payroll & Statutory Deductions (EPF, ESI, PT)</h2>
          <p>Automated salary run engine posting balanced double-entry payroll journals and statutory withholdings.</p>
        </div>
        <div className="prod-view-actions">
          <button
            onClick={() => setAddEmpModal(true)}
            className="btn-secondary"
          >
            <Plus size={14} /> Add Employee
          </button>
          <button
            onClick={handleExecuteRun}
            className="btn-primary"
            disabled={loading}
          >
            <Play size={14} /> Run Payroll ({payPeriod})
          </button>
          <button onClick={loadData} className="btn-secondary" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="prod-alert-banner success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="prod-alert-banner danger">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── TABS BAR ─────────────────────────────────────────────────────── */}
      <div className="prod-tabs-bar">
        <button
          onClick={() => setActiveTab('employees')}
          className={`prod-tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
        >
          <Users size={15} /> Employee Master ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          className={`prod-tab-btn ${activeTab === 'runs' ? 'active' : ''}`}
        >
          <Play size={15} /> Payroll Runs ({runs.length})
        </button>
        <button
          onClick={() => setActiveTab('payslips')}
          className={`prod-tab-btn ${activeTab === 'payslips' ? 'active' : ''}`}
        >
          <FileText size={15} /> Payslip Viewer
        </button>
      </div>

      {/* ── TAB 1: EMPLOYEES ─────────────────────────────────────────────── */}
      {activeTab === 'employees' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">Employee Roster & CTC Structures</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Emp Code</th>
                  <th>Employee Name</th>
                  <th>Designation / Dept</th>
                  <th>PAN</th>
                  <th>Basic Salary</th>
                  <th>HRA</th>
                  <th>Allowances</th>
                  <th>Monthly Gross CTC</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No employees enrolled. Click "Add Employee" above.</td></tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{emp.employeeCode}</td>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td>
                        <div>{emp.designation}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{emp.department}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{emp.pan || '—'}</td>
                      <td className="font-mono">{fmtInr(emp.baseSalary)}</td>
                      <td className="font-mono">{fmtInr(emp.hra)}</td>
                      <td className="font-mono">{fmtInr(emp.specialAllowance)}</td>
                      <td className="font-mono font-bold">{fmtInr(emp.baseSalary + emp.hra + emp.specialAllowance)}</td>
                      <td>
                        <span className="compliance-badge completed">{emp.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: PAYROLL RUNS ──────────────────────────────────────────── */}
      {activeTab === 'runs' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">Historical Payroll Execution Runs</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Employees</th>
                  <th>Total Gross</th>
                  <th>Employee PF (12%)</th>
                  <th>Professional Tax</th>
                  <th>Net Disbursable</th>
                  <th>Disbursement</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No payroll runs executed yet. Click "Run Payroll" above.</td></tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.payPeriod}</td>
                      <td>{r.employeeCount} active</td>
                      <td className="font-mono">{fmtInr(r.totalGross)}</td>
                      <td className="font-mono text-red">{fmtInr(r.totalEmployeePf)}</td>
                      <td className="font-mono text-red">{fmtInr(r.totalPt)}</td>
                      <td className="font-mono font-bold text-green">{fmtInr(r.totalNetSalary)}</td>
                      <td>
                        <span className={`compliance-badge ${r.status === 'DISBURSED' ? 'completed' : 'due_soon'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleViewPayslips(r.id)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <FileText size={12} /> Payslips
                          </button>
                          {r.status !== 'DISBURSED' && (
                            <button
                              onClick={() => handleDisburse(r.id)}
                              className="btn-primary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              <Landmark size={12} /> Disburse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: PAYSLIP VIEWER ────────────────────────────────────────── */}
      {activeTab === 'payslips' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">Employee Payslips ({selectedRunPayslips.length} payslips)</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Basic + HRA + Allowances</th>
                  <th>Gross CTC</th>
                  <th>EPF (12%)</th>
                  <th>Prof Tax</th>
                  <th>TDS Sec 192</th>
                  <th>Net Take-Home</th>
                </tr>
              </thead>
              <tbody>
                {selectedRunPayslips.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Select a payroll run from the "Payroll Runs" tab to view individual payslips.</td></tr>
                ) : (
                  selectedRunPayslips.map((ps) => (
                    <tr key={ps.id}>
                      <td style={{ fontWeight: 600 }}>{ps.employeeName}</td>
                      <td className="font-mono" style={{ fontSize: '0.78rem' }}>
                        {fmtInr(ps.baseSalary)} + {fmtInr(ps.hra)} + {fmtInr(ps.specialAllowance)}
                      </td>
                      <td className="font-mono font-bold">{fmtInr(ps.grossSalary)}</td>
                      <td className="font-mono text-red">{fmtInr(ps.employeePf)}</td>
                      <td className="font-mono text-red">{fmtInr(ps.professionalTax)}</td>
                      <td className="font-mono text-red">{fmtInr(ps.tdsWithheld || 0)}</td>
                      <td className="font-mono font-bold text-green" style={{ fontSize: '0.95rem' }}>
                        {fmtInr(ps.netSalary)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ADD EMPLOYEE MODAL ───────────────────────────────────────────── */}
      {addEmpModal && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Enrol New Employee
              </div>
            </div>

            <form onSubmit={handleAddEmployee} className="prod-form-grid">
              <div className="prod-form-group">
                <label>Full Legal Name</label>
                <input
                  type="text"
                  value={empForm.name}
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                  className="prod-input"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Designation</label>
                <input
                  type="text"
                  value={empForm.designation}
                  onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                  className="prod-input"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>PAN Number</label>
                <input
                  type="text"
                  value={empForm.pan}
                  onChange={(e) => setEmpForm({ ...empForm, pan: e.target.value.toUpperCase() })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Basic Pay (₹ / month)</label>
                <input
                  type="number"
                  value={empForm.baseSalary}
                  onChange={(e) => setEmpForm({ ...empForm, baseSalary: e.target.value })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>HRA (₹ / month)</label>
                <input
                  type="number"
                  value={empForm.hra}
                  onChange={(e) => setEmpForm({ ...empForm, hra: e.target.value })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Special Allowance (₹)</label>
                <input
                  type="number"
                  value={empForm.specialAllowance}
                  onChange={(e) => setEmpForm({ ...empForm, specialAllowance: e.target.value })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setAddEmpModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save & Enrol Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
