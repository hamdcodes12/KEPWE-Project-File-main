import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  PieChart,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Landmark,
  CheckCircle2
} from 'lucide-react';
import {
  fetchLedgerReports,
  fetchTrialBalance,
  fetchBalanceSheetStatement
} from '../../api/ledgerClient';

export default function ReportsView() {
  const [reportType, setReportType] = useState('pnl');
  const [datePreset, setDatePreset] = useState('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportData, setReportData] = useState(null);
  const [trialData, setTrialData] = useState(null);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      if (reportType === 'trial_balance') {
        const res = await fetchTrialBalance();
        if (res.ok) {
          setTrialData(res.data);
        } else {
          setError(res.data?.error || 'Failed to generate Trial Balance.');
        }
      } else if (reportType === 'balance_sheet') {
        const res = await fetchBalanceSheetStatement();
        if (res.ok) {
          setBalanceSheetData(res.data);
        } else {
          setError(res.data?.error || 'Failed to generate Balance Sheet.');
        }
      } else {
        const res = await fetchLedgerReports({
          reportType,
          datePreset,
          dateFrom,
          dateTo,
        });
        if (res.ok) {
          setReportData(res.data);
        } else {
          setError(res.data?.error || 'Failed to generate financial report');
        }
      }
    } catch (err) {
      setError(err.message || 'Error generating report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, datePreset, dateFrom, dateTo]);

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="ledger-view-container print-area">
      {/* Header */}
      <div className="ledger-view-header">
        <div>
          <h2 className="ledger-view-title">Financial Statements & Accounting Reports</h2>
          <p className="ledger-view-sub">Authoritative statements derived strictly from double-entry general ledger journals.</p>
        </div>
        <div className="ledger-view-actions">
          <button onClick={handlePrint} className="btn-secondary">
            <Printer size={16} /> Print Statement
          </button>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="report-tabs-bar">
        {[
          { id: 'pnl', label: 'Profit & Loss (P&L)', icon: TrendingUp },
          { id: 'trial_balance', label: 'Trial Balance', icon: Scale },
          { id: 'balance_sheet', label: 'Balance Sheet', icon: Landmark },
          { id: 'cash_flow', label: 'Cash Flow', icon: DollarSign },
          { id: 'receivables_aging', label: 'Receivables Aging', icon: Clock },
          { id: 'payables_aging', label: 'Payables Aging', icon: AlertCircle },
          { id: 'account_summary', label: 'Account Balances', icon: PieChart },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = reportType === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setReportType(t.id)}
              className={`report-tab-btn ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date Filter Strip */}
      {!['trial_balance', 'balance_sheet'].includes(reportType) && (
        <div className="ledger-filter-card" style={{ marginBottom: '24px' }}>
          <div className="filter-controls-row" style={{ width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} className="text-blue" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#344054' }}>Reporting Period:</span>
              <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} className="filter-select">
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Fiscal Year</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {datePreset === 'custom' && (
              <div className="custom-date-inputs">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="date-input" />
                <span>to</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="date-input" />
              </div>
            )}

            {reportData && (
              <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                Showing: {reportData.dateRange?.start} → {reportData.dateRange?.end}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Report Content */}
      {loading ? (
        <div className="ledger-loading-state">
          <div className="spinner" />
          <span>Generating financial report from database...</span>
        </div>
      ) : error ? (
        <div className="ledger-error-state">
          <AlertCircle size={24} color="#EF4444" />
          <span>{error}</span>
        </div>
      ) : (
        <div>
          {/* ── TAB: TRIAL BALANCE ────────────────────────────────────────── */}
          {reportType === 'trial_balance' && trialData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: trialData.isBalanced ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${trialData.isBalanced ? '#A7F3D0' : '#FECACA'}`,
                padding: '12px 18px',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={18} color={trialData.isBalanced ? '#059669' : '#DC2626'} />
                  <strong style={{ color: trialData.isBalanced ? '#065F46' : '#991B1B' }}>
                    {trialData.isBalanced ? 'Trial Balance is Strictly In Balance' : 'Discrepancy Detected'}
                  </strong>
                </div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  Total Debits: {fmtCurrency(trialData.totalDebit)} | Total Credits: {fmtCurrency(trialData.totalCredit)}
                </div>
              </div>

              <div className="report-section-card">
                <div className="section-head blue">
                  <Scale size={18} />
                  <span>General Ledger Account Balances (As of {trialData.asOfDate})</span>
                </div>
                <div className="table-responsive">
                  <table className="ledger-data-table">
                    <thead>
                      <tr>
                        <th>Account Code</th>
                        <th>Account Name</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Total Debit</th>
                        <th style={{ textAlign: 'right' }}>Total Credit</th>
                        <th style={{ textAlign: 'right' }}>Net Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(trialData.rows || []).map((r) => (
                        <tr key={r.id}>
                          <td><span className="font-mono font-bold text-blue">{r.code}</span></td>
                          <td><span className="font-bold text-navy">{r.name}</span></td>
                          <td><span className="type-badge">{r.type}</span></td>
                          <td style={{ textAlign: 'right' }} className="font-mono">{fmtCurrency(r.totalDebit)}</td>
                          <td style={{ textAlign: 'right' }} className="font-mono">{fmtCurrency(r.totalCredit)}</td>
                          <td style={{ textAlign: 'right' }} className="font-mono font-bold">
                            {r.netDebit > 0 ? (
                              <span className="text-green">Dr {fmtCurrency(r.netDebit)}</span>
                            ) : r.netCredit > 0 ? (
                              <span className="text-navy">Cr {fmtCurrency(r.netCredit)}</span>
                            ) : '0.00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                        <td colSpan={3} style={{ padding: 12 }}>TOTAL TRIAL BALANCE</td>
                        <td style={{ textAlign: 'right', padding: 12 }} className="font-mono font-bold">{fmtCurrency(trialData.totalDebit)}</td>
                        <td style={{ textAlign: 'right', padding: 12 }} className="font-mono font-bold">{fmtCurrency(trialData.totalCredit)}</td>
                        <td style={{ textAlign: 'right', padding: 12 }} className="font-mono font-bold text-green">BALANCED</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: BALANCE SHEET ────────────────────────────────────────── */}
          {reportType === 'balance_sheet' && balanceSheetData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: balanceSheetData.isBalanced ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${balanceSheetData.isBalanced ? '#A7F3D0' : '#FECACA'}`,
                padding: '12px 18px',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Landmark size={18} color={balanceSheetData.isBalanced ? '#059669' : '#DC2626'} />
                  <strong style={{ color: balanceSheetData.isBalanced ? '#065F46' : '#991B1B' }}>
                    Fundamental Accounting Equation: Assets = Liabilities + Equity
                  </strong>
                </div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  Assets: {fmtCurrency(balanceSheetData.totalAssets)} | Liab + Equity: {fmtCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                </div>
              </div>

              <div className="report-columns-grid">
                {/* Assets Column */}
                <div className="report-section-card">
                  <div className="section-head blue">
                    <ArrowDownRight size={18} />
                    <span>ASSETS ({fmtCurrency(balanceSheetData.totalAssets)})</span>
                  </div>
                  <div className="report-line-items">
                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#64748B', padding: '6px 0' }}>CURRENT ASSETS:</div>
                    {(balanceSheetData.assets?.currentAssets?.items || []).map((a) => (
                      <div key={a.code} className="report-line-row">
                        <span>{a.code} - {a.name}</span>
                        <span className="font-mono">{fmtCurrency(a.amount)}</span>
                      </div>
                    ))}
                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#64748B', padding: '10px 0 6px 0' }}>FIXED ASSETS (NET OF DEPRECIATION):</div>
                    {(balanceSheetData.assets?.fixedAssets?.items || []).map((a) => (
                      <div key={a.code} className="report-line-row">
                        <span>{a.code} - {a.name}</span>
                        <span className="font-mono">{fmtCurrency(a.amount)}</span>
                      </div>
                    ))}
                    <div className="report-line-row" style={{ color: '#DC2626' }}>
                      <span>Less: Accumulated Depreciation</span>
                      <span className="font-mono">-{fmtCurrency(balanceSheetData.assets?.fixedAssets?.accumulatedDepreciation)}</span>
                    </div>
                    <div className="report-total-row">
                      <span>TOTAL ASSETS</span>
                      <span className="font-mono text-blue font-bold">{fmtCurrency(balanceSheetData.totalAssets)}</span>
                    </div>
                  </div>
                </div>

                {/* Liabilities & Equity Column */}
                <div className="report-section-card">
                  <div className="section-head red">
                    <ArrowUpRight size={18} />
                    <span>LIABILITIES & EQUITY ({fmtCurrency(balanceSheetData.totalLiabilitiesAndEquity)})</span>
                  </div>
                  <div className="report-line-items">
                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#64748B', padding: '6px 0' }}>CURRENT LIABILITIES:</div>
                    {(balanceSheetData.liabilities?.currentLiabilities?.items || []).map((l) => (
                      <div key={l.code} className="report-line-row">
                        <span>{l.code} - {l.name}</span>
                        <span className="font-mono">{fmtCurrency(l.amount)}</span>
                      </div>
                    ))}
                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#64748B', padding: '10px 0 6px 0' }}>EQUITY & RESERVES:</div>
                    {(balanceSheetData.equity?.baseEquity?.items || []).map((e) => (
                      <div key={e.code} className="report-line-row">
                        <span>{e.code} - {e.name}</span>
                        <span className="font-mono">{fmtCurrency(e.amount)}</span>
                      </div>
                    ))}
                    <div className="report-line-row">
                      <span>Current Period Net Profit / Loss</span>
                      <span className="font-mono font-bold" style={{ color: balanceSheetData.equity?.currentPeriodProfitLoss >= 0 ? '#059669' : '#DC2626' }}>
                        {fmtCurrency(balanceSheetData.equity?.currentPeriodProfitLoss)}
                      </span>
                    </div>
                    <div className="report-total-row">
                      <span>TOTAL LIABILITIES & EQUITY</span>
                      <span className="font-mono text-navy font-bold">{fmtCurrency(balanceSheetData.totalLiabilitiesAndEquity)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: PNL ──────────────────────────────────────────────────── */}
          {reportType === 'pnl' && reportData && (
            <div>
              <div className="ledger-metrics-strip" style={{ marginBottom: '24px' }}>
                <div className="metric-strip-card">
                  <span className="strip-label">TOTAL OPERATING REVENUE</span>
                  <span className="strip-val text-green font-mono">{fmtCurrency(reportData.summary?.totalIncome)}</span>
                </div>
                <div className="metric-strip-card">
                  <span className="strip-label">TOTAL OPERATING EXPENSES</span>
                  <span className="strip-val text-navy font-mono">{fmtCurrency(reportData.summary?.totalExpenses)}</span>
                </div>
                <div className="metric-strip-card highlight">
                  <span className="strip-label">NET PROFIT / CASH GAIN</span>
                  <span className="strip-val text-blue font-mono">{fmtCurrency(reportData.summary?.netProfit)}</span>
                </div>
                <div className="metric-strip-card">
                  <span className="strip-label">OPERATING MARGIN</span>
                  <span className="strip-val font-mono">{reportData.summary?.operatingMargin}%</span>
                </div>
              </div>

              <div className="report-columns-grid">
                <div className="report-section-card">
                  <div className="section-head green">
                    <ArrowDownRight size={18} />
                    <span>Operating Revenue Breakdown</span>
                  </div>
                  <div className="report-line-items">
                    {(reportData.pnl?.incomeBreakdown || []).map((item) => (
                      <div key={item.category} className="report-line-row">
                        <span className="item-name">{item.category}</span>
                        <span className="item-amt font-mono">{fmtCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="report-total-row">
                      <span>Total Operating Revenue</span>
                      <span className="font-mono text-green font-bold">{fmtCurrency(reportData.summary?.totalIncome)}</span>
                    </div>
                  </div>
                </div>

                <div className="report-section-card">
                  <div className="section-head red">
                    <ArrowUpRight size={18} />
                    <span>Operating Expenses Breakdown</span>
                  </div>
                  <div className="report-line-items">
                    {(reportData.pnl?.expenseBreakdown || []).map((item) => (
                      <div key={item.category} className="report-line-row">
                        <span className="item-name">{item.category}</span>
                        <span className="item-amt font-mono">{fmtCurrency(item.amount)}</span>
                      </div>
                    ))}
                    <div className="report-total-row">
                      <span>Total Operating Expenses</span>
                      <span className="font-mono text-navy font-bold">{fmtCurrency(reportData.summary?.totalExpenses)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: RECEIVABLES AGING ─────────────────────────────────────── */}
          {reportType === 'receivables_aging' && reportData && (
            <div className="report-section-card" style={{ marginBottom: '24px' }}>
              <div className="section-head blue">
                <Clock size={18} />
                <span>Receivables Aging Summary (Customer Dues)</span>
              </div>
              <div className="aging-buckets-grid">
                <div className="aging-bucket">
                  <span className="bucket-label">Current (&lt; 30 Days)</span>
                  <span className="bucket-val font-mono">{fmtCurrency(reportData.aging?.receivables?.current)}</span>
                  <span className="bucket-status good">Healthy</span>
                </div>
                <div className="aging-bucket">
                  <span className="bucket-label">1–30 Days Overdue</span>
                  <span className="bucket-val font-mono text-amber">{fmtCurrency(reportData.aging?.receivables?.overdue1_30)}</span>
                  <span className="bucket-status warning">Send 1st Reminder</span>
                </div>
                <div className="aging-bucket">
                  <span className="bucket-label">31–60 Days Overdue</span>
                  <span className="bucket-val font-mono text-red">{fmtCurrency(reportData.aging?.receivables?.overdue31_60)}</span>
                  <span className="bucket-status danger">Action Required</span>
                </div>
                <div className="aging-bucket">
                  <span className="bucket-label">60+ Days Overdue</span>
                  <span className="bucket-val font-mono text-red font-bold">{fmtCurrency(reportData.aging?.receivables?.overdue60Plus)}</span>
                  <span className="bucket-status critical">Escalate Recovery</span>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: PAYABLES AGING ────────────────────────────────────────── */}
          {reportType === 'payables_aging' && reportData && (
            <div className="report-section-card" style={{ marginBottom: '24px' }}>
              <div className="section-head red">
                <AlertCircle size={18} />
                <span>Payables Aging Summary (Supplier Obligations)</span>
              </div>
              <div className="aging-buckets-grid">
                <div className="aging-bucket">
                  <span className="bucket-label">Current Unpaid</span>
                  <span className="bucket-val font-mono">{fmtCurrency(reportData.aging?.payables?.current)}</span>
                  <span className="bucket-status good">Scheduled</span>
                </div>
                <div className="aging-bucket">
                  <span className="bucket-label">1–30 Days Overdue</span>
                  <span className="bucket-val font-mono text-amber">{fmtCurrency(reportData.aging?.payables?.overdue1_30)}</span>
                  <span className="bucket-status warning">Pending Payment</span>
                </div>
                <div className="aging-bucket">
                  <span className="bucket-label">31–60 Days Overdue</span>
                  <span className="bucket-val font-mono text-red">{fmtCurrency(reportData.aging?.payables?.overdue31_60)}</span>
                  <span className="bucket-status danger">Late Fee Risk</span>
                </div>
                <div className="aging-bucket">
                  <span className="bucket-label">60+ Days Overdue</span>
                  <span className="bucket-val font-mono text-red font-bold">{fmtCurrency(reportData.aging?.payables?.overdue60Plus)}</span>
                  <span className="bucket-status critical">Urgent Settlement</span>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: ACCOUNT SUMMARY ──────────────────────────────────────── */}
          {reportType === 'account_summary' && reportData && (
            <div className="report-section-card">
              <div className="section-head blue">
                <PieChart size={18} />
                <span>Account Balances & Reconciliations</span>
              </div>
              <div className="table-responsive">
                <table className="ledger-data-table">
                  <thead>
                    <tr>
                      <th>Account Name</th>
                      <th>Type</th>
                      <th>Account / UPI Identifier</th>
                      <th>Opening Balance</th>
                      <th>Current Live Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.accounts || []).map((a) => (
                      <tr key={a.id}>
                        <td><span className="font-bold text-navy">{a.name}</span></td>
                        <td><span className="type-badge">{a.type}</span></td>
                        <td><span className="font-mono text-muted">{a.accountNumber || a.upiId || '—'}</span></td>
                        <td><span className="font-mono">{fmtCurrency(a.openingBalance)}</span></td>
                        <td><span className="font-mono font-bold text-green">{fmtCurrency(a.currentBalance)}</span></td>
                        <td><span className="status-pill paid">Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
