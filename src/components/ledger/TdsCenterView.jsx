import React, { useState, useEffect, useCallback } from 'react';
import './ProductionLedgerViews.css';
import {
  FileText,
  Calculator,
  Receipt,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Building,
  CreditCard
} from 'lucide-react';
import {
  fetchTdsRules,
  calculateTds,
  fetchTdsTransactions,
  recordTdsChallan,
  fetchTdsChallans,
  fetchForm26q
} from '../../api/ledgerClient';

export default function TdsCenterView() {
  const [activeTab, setActiveTab] = useState('ledger');
  const [rules, setRules] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [challans, setChallans] = useState([]);
  const [form26qData, setForm26qData] = useState(null);
  const [quarter, setQuarter] = useState('Q2');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Interactive Calculator State
  const [calcForm, setCalcForm] = useState({
    invoiceAmount: 50000,
    sectionCode: '194J',
    vendorPan: 'AABCV1234D',
    isIndividualOrHuf: false
  });
  const [calcResult, setCalcResult] = useState(null);

  // Challan ITNS 281 Deposit Modal
  const [challanModalOpen, setChallanModalOpen] = useState(false);
  const [challanForm, setChallanForm] = useState({
    challanNumber: 'ITNS281-0099',
    bsrCode: '0210004',
    depositDate: new Date().toISOString().split('T')[0],
    amount: 5000.0,
    sectionCode: '194J',
    quarter: 'Q2',
    assessmentYear: '2027-28',
    bankAccountId: ''
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rRes, tRes, cRes] = await Promise.all([
        fetchTdsRules(),
        fetchTdsTransactions(),
        fetchTdsChallans()
      ]);
      if (rRes.ok) setRules(rRes.data.rules || []);
      if (tRes.ok) setTransactions(tRes.data.transactions || []);
      if (cRes.ok) setChallans(cRes.data.challans || []);

      if (activeTab === 'form26q') {
        const qRes = await fetchForm26q(quarter);
        if (qRes.ok) setForm26qData(qRes.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, quarter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRunCalculator = async (e) => {
    e.preventDefault();
    try {
      const res = await calculateTds(calcForm);
      if (res.ok) {
        setCalcResult(res.data);
      } else {
        setError(res.data?.error || 'Calculation failed.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDepositChallan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await recordTdsChallan({
        ...challanForm,
        amount: Number(challanForm.amount)
      });
      if (res.ok) {
        setSuccessMsg(`Challan ITNS 281 recorded and balanced journal posted (BSR: ${challanForm.bsrCode}).`);
        setChallanModalOpen(false);
        loadAll();
      } else {
        setError(res.data?.error || 'Failed to deposit TDS challan.');
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
          <h2>TDS Center & Statutory Withholding (Form 26Q)</h2>
          <p>Indian Income Tax Act withholding engine under Sections 194C, 194J, 194I, 194H, and 206AA.</p>
        </div>
        <div className="prod-view-actions">
          <button
            onClick={() => setChallanModalOpen(true)}
            className="btn-primary"
          >
            <Plus size={14} /> Deposit ITNS 281 Challan
          </button>
          <button onClick={loadAll} className="btn-secondary" title="Refresh">
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
          onClick={() => setActiveTab('ledger')}
          className={`prod-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
        >
          <Receipt size={15} /> TDS Deduction Ledger
        </button>
        <button
          onClick={() => setActiveTab('challans')}
          className={`prod-tab-btn ${activeTab === 'challans' ? 'active' : ''}`}
        >
          <CreditCard size={15} /> Challan ITNS 281 Deposits
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          className={`prod-tab-btn ${activeTab === 'calculator' ? 'active' : ''}`}
        >
          <Calculator size={15} /> TDS Calculator & Rules
        </button>
        <button
          onClick={() => setActiveTab('form26q')}
          className={`prod-tab-btn ${activeTab === 'form26q' ? 'active' : ''}`}
        >
          <FileText size={15} /> Quarterly Form 26Q Return
        </button>
      </div>

      {/* ── TAB 1: TDS TRANSACTIONS LEDGER ────────────────────────────────── */}
      {activeTab === 'ledger' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">
              TDS Withholding Records ({transactions.length} deductions)
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Deduction Date</th>
                  <th>Section</th>
                  <th>Deductee / Vendor</th>
                  <th>PAN</th>
                  <th>Gross Invoice</th>
                  <th>TDS Rate</th>
                  <th>TDS Deducted</th>
                  <th>Net Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No TDS transactions recorded yet.</td></tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontFamily: 'monospace' }}>{tx.deductionDate}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#214ECF' }}>
                          Sec {tx.sectionCode}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{tx.vendorName || 'Vendor'}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {tx.vendorPan || 'NO PAN (206AA)'}
                        </span>
                      </td>
                      <td className="font-mono">{fmtInr(tx.invoiceAmount)}</td>
                      <td className="font-mono font-bold">{tx.tdsRate}%</td>
                      <td className="font-mono font-bold text-red">{fmtInr(tx.tdsAmount)}</td>
                      <td className="font-mono">{fmtInr(tx.netAmount)}</td>
                      <td>
                        <span className={`compliance-badge ${tx.status === 'DEPOSITED' ? 'completed' : 'due_soon'}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: CHALLANS ──────────────────────────────────────────────── */}
      {activeTab === 'challans' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">
              Challan ITNS 281 Government Deposits ({challans.length} challans)
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Deposit Date</th>
                  <th>Challan No / CIN</th>
                  <th>BSR Code</th>
                  <th>Section</th>
                  <th>Quarter</th>
                  <th>Amount Deposited</th>
                  <th>Journal Entry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {challans.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No Challan ITNS 281 deposits recorded yet.</td></tr>
                ) : (
                  challans.map((ch) => (
                    <tr key={ch.id}>
                      <td style={{ fontFamily: 'monospace' }}>{ch.depositDate}</td>
                      <td style={{ fontWeight: 700 }}>{ch.challanNumber}</td>
                      <td style={{ fontFamily: 'monospace' }}>{ch.bsrCode}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>Sec {ch.sectionCode}</td>
                      <td>{ch.quarter}</td>
                      <td className="font-mono font-bold text-green">{fmtInr(ch.amount)}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#214ECF' }}>
                          Linked
                        </span>
                      </td>
                      <td>
                        <span className="compliance-badge completed">DEPOSITED</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: CALCULATOR & STATUTORY RULES ───────────────────────────── */}
      {activeTab === 'calculator' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Quick Calculator Card */}
          <div className="prod-card">
            <div className="prod-card-header">
              <div className="prod-card-title"><Calculator size={16} /> Instant TDS Deductor</div>
            </div>
            <form onSubmit={handleRunCalculator} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="prod-form-group">
                <label>Gross Invoice / Bill Amount (₹)</label>
                <input
                  type="number"
                  value={calcForm.invoiceAmount}
                  onChange={(e) => setCalcForm({ ...calcForm, invoiceAmount: Number(e.target.value) })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Section Code</label>
                <select
                  value={calcForm.sectionCode}
                  onChange={(e) => setCalcForm({ ...calcForm, sectionCode: e.target.value })}
                  className="prod-select"
                >
                  <option value="194J">194J: Professional / Technical Services</option>
                  <option value="194C">194C: Contractor & Sub-contractor</option>
                  <option value="194I">194I: Rent on Land/Building or Plant</option>
                  <option value="194H">194H: Commission & Brokerage</option>
                  <option value="194Q">194Q: Purchase of Goods</option>
                </select>
              </div>

              <div className="prod-form-group">
                <label>Vendor PAN Number (Empty triggers Sec 206AA 20%)</label>
                <input
                  type="text"
                  placeholder="e.g. AABCV1234D"
                  value={calcForm.vendorPan}
                  onChange={(e) => setCalcForm({ ...calcForm, vendorPan: e.target.value.toUpperCase() })}
                  className="prod-input font-mono"
                />
              </div>

              <button type="submit" className="btn-primary">
                Calculate Statutory Deduction
              </button>

              {calcResult && (
                <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 8, marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Applicable Section:</span>
                    <span style={{ fontWeight: 700 }}>Sec {calcResult.sectionCode}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Statutory TDS Rate:</span>
                    <span style={{ fontWeight: 700, color: '#DC2626' }}>{calcResult.tdsRate}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748B' }}>TDS to Deduct:</span>
                    <span style={{ fontWeight: 800, color: '#DC2626' }}>{fmtInr(calcResult.tdsAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Net Vendor Payable:</span>
                    <span style={{ fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>{fmtInr(calcResult.netPayable)}</span>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Statutory Rules Table */}
          <div className="prod-card">
            <div className="prod-card-header">
              <div className="prod-card-title">Statutory Rate Sheet (FY 2026-27)</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Nature of Payment</th>
                    <th>Base Rate</th>
                    <th>Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.sectionCode}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#214ECF' }}>
                        {rule.sectionCode}
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>{rule.description}</td>
                      <td className="font-mono font-bold">{rule.ratePercent}%</td>
                      <td className="font-mono">{fmtInr(rule.thresholdAmount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>206AA</td>
                    <td style={{ fontSize: '0.78rem', color: '#DC2626' }}>Mandatory Higher Rate (PAN Invalid/Missing)</td>
                    <td className="font-mono font-bold text-red">20.00%</td>
                    <td>No Threshold</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: FORM 26Q RETURN PREP ──────────────────────────────────── */}
      {activeTab === 'form26q' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Select Return Quarter:</span>
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className="prod-select"
                style={{ fontWeight: 700 }}
              >
                <option value="Q1">Q1 (Apr - Jun)</option>
                <option value="Q2">Q2 (Jul - Sep)</option>
                <option value="Q3">Q3 (Oct - Dec)</option>
                <option value="Q4">Q4 (Jan - Mar)</option>
              </select>
            </div>
          </div>

          <div className="prod-metrics-grid">
            <div className="prod-metric-card">
              <div className="prod-metric-title">Total Deductees</div>
              <div className="prod-metric-value">{form26qData?.summary?.totalDeductees || 0}</div>
            </div>
            <div className="prod-metric-card">
              <div className="prod-metric-title">Total TDS Deducted</div>
              <div className="prod-metric-value text-red font-mono">{fmtInr(form26qData?.summary?.totalTdsDeducted)}</div>
            </div>
            <div className="prod-metric-card highlight">
              <div className="prod-metric-title">Challan Deposited</div>
              <div className="prod-metric-value text-green font-mono">{fmtInr(form26qData?.summary?.totalTdsDeposited)}</div>
            </div>
          </div>

          <div className="prod-card">
            <div className="prod-card-header">
              <div className="prod-card-title">Annexure: Deductee-wise Details (Form 26Q)</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>Deductee Code</th>
                    <th>PAN</th>
                    <th>Name</th>
                    <th>Section</th>
                    <th>Amount Paid</th>
                    <th>TDS Deducted</th>
                    <th>Challan CIN</th>
                  </tr>
                </thead>
                <tbody>
                  {(!form26qData?.annexures || form26qData.annexures.length === 0) ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No deductees for quarter {quarter}.</td></tr>
                  ) : (
                    form26qData.annexures.map((ann, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>{ann.deducteeCode}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{ann.pan}</td>
                        <td style={{ fontWeight: 600 }}>{ann.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>Sec {ann.section}</td>
                        <td className="font-mono">{fmtInr(ann.amountPaid)}</td>
                        <td className="font-mono font-bold text-red">{fmtInr(ann.tdsDeducted)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{ann.challanCin || 'Pending'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CHALLAN DEPOSIT MODAL ───────────────────────────────────────── */}
      {challanModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Record ITNS 281 Challan Deposit
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                Posts double-entry journal (Debit 2030 TDS Payable, Credit 1010 Bank).
              </p>
            </div>

            <form onSubmit={handleDepositChallan} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="prod-form-group">
                <label>Deposit Amount (₹)</label>
                <input
                  type="number"
                  value={challanForm.amount}
                  onChange={(e) => setChallanForm({ ...challanForm, amount: e.target.value })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>7-Digit Bank BSR Code</label>
                <input
                  type="text"
                  value={challanForm.bsrCode}
                  onChange={(e) => setChallanForm({ ...challanForm, bsrCode: e.target.value })}
                  className="prod-input font-mono"
                  placeholder="e.g. 0210004"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Challan Serial Number</label>
                <input
                  type="text"
                  value={challanForm.challanNumber}
                  onChange={(e) => setChallanForm({ ...challanForm, challanNumber: e.target.value })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Deposit Date</label>
                <input
                  type="date"
                  value={challanForm.depositDate}
                  onChange={(e) => setChallanForm({ ...challanForm, depositDate: e.target.value })}
                  className="prod-input"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setChallanModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Recording...' : 'Record & Post Balanced Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
