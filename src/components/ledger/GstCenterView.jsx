import React, { useState, useEffect, useCallback } from 'react';
import './ProductionLedgerViews.css';
import {
  FileSpreadsheet,
  Layers,
  ArrowDownUp,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import {
  fetchGstr1,
  fetchGstr3b,
  runGstReconciliation,
  fetchGstReconciliationRecords,
  createFilingDraft,
  approveFiling,
  submitFiling
} from '../../api/ledgerClient';

export default function GstCenterView() {
  const [activeTab, setActiveTab] = useState('gstr1');
  const [taxPeriod, setTaxPeriod] = useState('2026-09');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data states
  const [gstr1Data, setGstr1Data] = useState(null);
  const [gstr3bData, setGstr3bData] = useState(null);
  const [recData, setRecData] = useState(null);

  // CA Approval & Filing Workflow
  const [activeFilingId, setActiveFilingId] = useState(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [caNotes, setCaNotes] = useState('');
  const [caSubmitting, setCaSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'gstr1') {
        const res = await fetchGstr1(taxPeriod);
        if (res.ok) setGstr1Data(res.data);
        else setError(res.data?.error || 'Failed to prepare GSTR-1 data.');
      } else if (activeTab === 'gstr3b') {
        const res = await fetchGstr3b(taxPeriod);
        if (res.ok) setGstr3bData(res.data);
        else setError(res.data?.error || 'Failed to calculate GSTR-3B tax offset.');
      } else if (activeTab === 'reconciliation') {
        const res = await fetchGstReconciliationRecords();
        if (res.ok) setRecData(res.data?.records || []);
        else setError(res.data?.error || 'Failed to load GST reconciliation records.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with GST engine.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, taxPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunReconciliation = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await runGstReconciliation({ taxPeriod });
      if (res.ok) {
        setSuccessMsg(`GST Reconciliation executed: ${res.data.summary.matchedCount} matched, ${res.data.summary.missingInReturnsCount} missing in returns.`);
        loadData();
      } else {
        setError(res.data?.error || 'Failed to run GST reconciliation.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async (returnType) => {
    try {
      const res = await createFilingDraft({ returnType, taxPeriod });
      if (res.ok) {
        setActiveFilingId(res.data.filing.id);
        setSuccessMsg(`Draft ${returnType} filing generated and validated. Ready for CA Review.`);
        setApprovalModalOpen(true);
      } else {
        setError(res.data?.error || 'Failed to generate filing draft.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCaApprove = async () => {
    if (!activeFilingId) return;
    setCaSubmitting(true);
    try {
      const res = await approveFiling(activeFilingId, {
        approvedByRole: 'CA',
        notes: caNotes || 'Audited against sales register and purchase books.'
      });
      if (res.ok) {
        setSuccessMsg('Filing approved by CA. Attempting authorized GST Portal transmission...');
        setApprovalModalOpen(false);

        // Attempt submission to provider
        const submitRes = await submitFiling(activeFilingId);
        setSubmissionStatus(submitRes.data);
      } else {
        setError(res.data?.error || 'CA approval failed.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCaSubmitting(false);
    }
  };

  const fmtInr = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  return (
    <div className="prod-view-container">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="prod-view-header">
        <div className="prod-view-title-group">
          <h2>GST Center & Statutory Returns (GSTR-1 / 3B)</h2>
          <p>Indian GST engine generating B2B/B2C tables, Rule 88A credit offset, and Books vs GSTR-2B reconciliation.</p>
        </div>
        <div className="prod-view-actions">
          <select
            value={taxPeriod}
            onChange={(e) => setTaxPeriod(e.target.value)}
            className="prod-select"
            style={{ fontWeight: 700 }}
          >
            <option value="2026-09">September 2026</option>
            <option value="2026-08">August 2026</option>
            <option value="2026-07">July 2026</option>
          </select>
          <button onClick={loadData} className="btn-secondary" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
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

      {submissionStatus && submissionStatus.status === 'CREDENTIALS_REQUIRED' && (
        <div className="prod-alert-banner warning">
          <AlertCircle size={18} />
          <div>
            <strong>GST Portal Direct Submission: Credentials Required</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              {submissionStatus.message} Real filings require registered GSP/ASP credentials configured in your environment. Instructions available in <code>INTEGRATION_SETUP.md</code>.
            </p>
          </div>
        </div>
      )}

      {/* ── TABS BAR ─────────────────────────────────────────────────────── */}
      <div className="prod-tabs-bar">
        <button
          onClick={() => setActiveTab('gstr1')}
          className={`prod-tab-btn ${activeTab === 'gstr1' ? 'active' : ''}`}
        >
          <FileSpreadsheet size={15} /> GSTR-1 Outward Supplies
        </button>
        <button
          onClick={() => setActiveTab('gstr3b')}
          className={`prod-tab-btn ${activeTab === 'gstr3b' ? 'active' : ''}`}
        >
          <Layers size={15} /> GSTR-3B Tax Offset (Rule 88A)
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`prod-tab-btn ${activeTab === 'reconciliation' ? 'active' : ''}`}
        >
          <ArrowDownUp size={15} /> GST Reconciliation (Books vs 2B)
        </button>
      </div>

      {/* ── TAB 1: GSTR-1 VIEW ────────────────────────────────────────────── */}
      {activeTab === 'gstr1' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Cards */}
          <div className="prod-metrics-grid">
            <div className="prod-metric-card">
              <div className="prod-metric-title">Total Invoices</div>
              <div className="prod-metric-value">{gstr1Data?.summary?.totalInvoices || 0}</div>
              <div className="prod-metric-footer">B2B + B2C Supplies</div>
            </div>
            <div className="prod-metric-card">
              <div className="prod-metric-title">Taxable Turnover</div>
              <div className="prod-metric-value font-mono">{fmtInr(gstr1Data?.summary?.totalTaxable)}</div>
              <div className="prod-metric-footer">Eligible outward supplies</div>
            </div>
            <div className="prod-metric-card highlight">
              <div className="prod-metric-title">Total Output Tax</div>
              <div className="prod-metric-value text-blue">{fmtInr(gstr1Data?.summary?.totalTax)}</div>
              <div className="prod-metric-footer font-mono">
                CGST: {fmtInr(gstr1Data?.summary?.totalCgst)} | SGST: {fmtInr(gstr1Data?.summary?.totalSgst)} | IGST: {fmtInr(gstr1Data?.summary?.totalIgst)}
              </div>
            </div>
          </div>

          {/* Table 4 B2B Invoices */}
          <div className="prod-card">
            <div className="prod-card-header">
              <div className="prod-card-title">
                Table 4: Taxable Outward B2B Supplies ({gstr1Data?.table4_b2b?.length || 0} parties)
              </div>
              <button
                onClick={() => handleCreateDraft('GSTR-1')}
                className="btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <FileCheck size={14} /> CA Approval & Filing Workflow
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>Customer GSTIN</th>
                    <th>Invoice No</th>
                    <th>Invoice Date</th>
                    <th>POS</th>
                    <th>Taxable Value</th>
                    <th>IGST</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(!gstr1Data?.table4_b2b || gstr1Data.table4_b2b.length === 0) ? (
                    <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No B2B invoices recorded for this period.</td></tr>
                  ) : (
                    gstr1Data.table4_b2b.flatMap((party) =>
                      party.inv.map((inv) => (
                        <tr key={inv.inum}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{party.ctin}</td>
                          <td style={{ fontWeight: 600 }}>{inv.inum}</td>
                          <td>{inv.idt}</td>
                          <td>{inv.pos}</td>
                          <td className="font-mono">{fmtInr(inv.taxableValue)}</td>
                          <td className="font-mono">{fmtInr(inv.igst)}</td>
                          <td className="font-mono">{fmtInr(inv.cgst)}</td>
                          <td className="font-mono">{fmtInr(inv.sgst)}</td>
                          <td className="font-mono font-bold">{fmtInr(inv.val)}</td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 12 HSN Summary */}
          <div className="prod-card">
            <div className="prod-card-header">
              <div className="prod-card-title">Table 12: HSN/SAC Summary of Outward Supplies</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>HSN / SAC</th>
                    <th>Description</th>
                    <th>UQC / Unit</th>
                    <th>Total Qty</th>
                    <th>Total Taxable</th>
                    <th>IGST</th>
                    <th>CGST</th>
                    <th>SGST</th>
                  </tr>
                </thead>
                <tbody>
                  {(!gstr1Data?.table12_hsn || gstr1Data.table12_hsn.length === 0) ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No HSN items recorded.</td></tr>
                  ) : (
                    gstr1Data.table12_hsn.map((hsn, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#214ECF' }}>{hsn.hsn_sc}</td>
                        <td>{hsn.desc}</td>
                        <td>{hsn.uqc}</td>
                        <td>{hsn.qty}</td>
                        <td className="font-mono">{fmtInr(hsn.txval)}</td>
                        <td className="font-mono">{fmtInr(hsn.iamt)}</td>
                        <td className="font-mono">{fmtInr(hsn.camt)}</td>
                        <td className="font-mono">{fmtInr(hsn.samt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: GSTR-3B STATUTORY TAX OFFSET (RULE 88A) ───────────────── */}
      {activeTab === 'gstr3b' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="prod-alert-banner info">
            <HelpCircle size={16} />
            <div>
              <strong>Statutory Tax Offset Order (Rule 88A & Circular No. 98/17/2019-GST)</strong>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem' }}>
                Integrated Tax (IGST) credit must be completely exhausted first against IGST, then CGST/SGST in any proportion, before CGST or SGST credit can be utilized.
              </p>
            </div>
          </div>

          {/* Table 3.1 & Table 4 Summary */}
          <div className="prod-metrics-grid">
            <div className="prod-metric-card">
              <div className="prod-metric-title">Outward Tax Liability (3.1)</div>
              <div className="prod-metric-value text-red font-mono">
                {fmtInr(gstr3bData?.table31_outwardSupplies?.outwardTaxable?.totalTax)}
              </div>
              <div className="prod-metric-footer">Total GST payable on sales</div>
            </div>
            <div className="prod-metric-card">
              <div className="prod-metric-title">Eligible Input Tax Credit (4)</div>
              <div className="prod-metric-value text-green font-mono">
                {fmtInr(gstr3bData?.table4_eligibleItc?.netItc?.total)}
              </div>
              <div className="prod-metric-footer">ITC from vendor bills & imports</div>
            </div>
            <div className="prod-metric-card highlight">
              <div className="prod-metric-title">Net Tax Payable in Cash (6.1)</div>
              <div className="prod-metric-value text-blue font-mono">
                {fmtInr(gstr3bData?.table61_paymentOfTax?.netPayableCash?.total)}
              </div>
              <div className="prod-metric-footer">After applying Rule 88A offset</div>
            </div>
          </div>

          {/* Table 6.1 Tax Offset Breakdown */}
          <div className="prod-card">
            <div className="prod-card-header">
              <div className="prod-card-title">
                Table 6.1: Payment of Tax & Statutory Credit Offset Ledger
              </div>
              <button
                onClick={() => handleCreateDraft('GSTR-3B')}
                className="btn-primary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <FileCheck size={14} /> CA Approval & Filing Workflow
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>Tax Head</th>
                    <th>Total Liability</th>
                    <th>Paid via IGST Credit</th>
                    <th>Paid via CGST Credit</th>
                    <th>Paid via SGST Credit</th>
                    <th>Net Cash Payable (Challan)</th>
                  </tr>
                </thead>
                <tbody>
                  {gstr3bData?.table61_paymentOfTax ? (
                    <>
                      <tr>
                        <td style={{ fontWeight: 700, color: '#214ECF' }}>Integrated Tax (IGST)</td>
                        <td className="font-mono">{fmtInr(gstr3bData.table61_paymentOfTax.totalLiability.igst)}</td>
                        <td className="font-mono">{fmtInr(gstr3bData.table61_paymentOfTax.creditUtilized.igst_against_igst)}</td>
                        <td className="font-mono">—</td>
                        <td className="font-mono">—</td>
                        <td className="font-mono font-bold">{fmtInr(gstr3bData.table61_paymentOfTax.netPayableCash.igst)}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 700, color: '#214ECF' }}>Central Tax (CGST)</td>
                        <td className="font-mono">{fmtInr(gstr3bData.table61_paymentOfTax.totalLiability.cgst)}</td>
                        <td className="font-mono">{fmtInr(gstr3bData.table61_paymentOfTax.creditUtilized.igst_against_cgst)}</td>
                        <td className="font-mono">{fmtInr(gstr3bData.table61_paymentOfTax.creditUtilized.cgst_against_cgst)}</td>
                        <td className="font-mono">—</td>
                        <td className="font-mono font-bold">{fmtInr(gstr3bData.table61_paymentOfTax.netPayableCash.cgst)}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 700, color: '#214ECF' }}>State Tax (SGST)</td>
                        <td className="font-mono">{fmtInr(gstr3bData.table61_paymentOfTax.totalLiability.sgst)}</td>
                        <td className="font-mono">{fmtInr(gstr3bData.table61_paymentOfTax.creditUtilized.igst_against_sgst)}</td>
                        <td className="font-mono">—</td>
                        <td className="font-mono">{fmtInr(gstr3bData.table61_paymentOfTax.creditUtilized.sgst_against_sgst)}</td>
                        <td className="font-mono font-bold">{fmtInr(gstr3bData.table61_paymentOfTax.netPayableCash.sgst)}</td>
                      </tr>
                    </>
                  ) : (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>Loading GSTR-3B offset calculation...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: GST RECONCILIATION ─────────────────────────────────────── */}
      {activeTab === 'reconciliation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 800 }}>Purchase Books vs GSTR-2B Auto-Reconciliation</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                Detects ITC mismatch, missing vendor invoices, and tax discrepancies before filing GSTR-3B.
              </p>
            </div>
            <button
              onClick={handleRunReconciliation}
              className="btn-primary"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Run Auto-Reconciliation
            </button>
          </div>

          <div className="prod-card">
            <div className="prod-card-header">
              <div className="prod-card-title">Reconciliation Records ({recData?.length || 0})</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>Vendor Name / GSTIN</th>
                    <th>Invoice No</th>
                    <th>Invoice Date</th>
                    <th>Books Tax Value</th>
                    <th>GSTR-2B Tax Value</th>
                    <th>Variance</th>
                    <th>Match Status</th>
                    <th>Action Required</th>
                  </tr>
                </thead>
                <tbody>
                  {(!recData || recData.length === 0) ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No reconciliation records found. Click "Run Auto-Reconciliation" above.</td></tr>
                  ) : (
                    recData.map((rec) => (
                      <tr key={rec.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{rec.vendorName}</div>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748B' }}>{rec.vendorGstin}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{rec.invoiceNumber}</td>
                        <td>{rec.invoiceDate}</td>
                        <td className="font-mono">{fmtInr(rec.taxAmountBooks)}</td>
                        <td className="font-mono">{fmtInr(rec.taxAmount2b)}</td>
                        <td className={`font-mono font-bold ${rec.taxDifference > 0 ? 'text-red' : 'text-green'}`}>
                          {fmtInr(rec.taxDifference)}
                        </td>
                        <td>
                          <span className={`compliance-badge ${rec.matchStatus === 'MATCHED' ? 'completed' : rec.matchStatus === 'TAX_MISMATCH' ? 'overdue' : 'due_soon'}`}>
                            {rec.matchStatus.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#475569' }}>
                          {rec.actionRequired}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CA APPROVAL MODAL ────────────────────────────────────────────── */}
      {approvalModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Chartered Accountant (CA) Verification & Approval
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                Statutory audit gate required prior to GSTN Portal API submission.
              </p>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="prod-alert-banner success">
                <CheckCircle2 size={16} />
                <span>Return validation passed with zero arithmetic errors.</span>
              </div>

              <div className="prod-form-group">
                <label>CA Audit & Review Notes</label>
                <textarea
                  rows={3}
                  value={caNotes}
                  onChange={(e) => setCaNotes(e.target.value)}
                  placeholder="e.g. Audited against sales register and physical tax invoices. Reconciliation verified."
                  className="prod-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setApprovalModalOpen(false)}
                  className="btn-secondary"
                  disabled={caSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCaApprove}
                  className="btn-primary"
                  disabled={caSubmitting}
                >
                  {caSubmitting ? 'Auditing & Approving...' : 'Sign & Approve Filing'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
