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
  ArrowDownRight
} from 'lucide-react';
import { fetchLedgerReports } from '../../api/ledgerClient';

export default function ReportsView() {
  const [reportType, setReportType] = useState('pnl');
  const [datePreset, setDatePreset] = useState('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
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

  const handleExportCSV = () => {
    if (!reportData) return;
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'pnl') {
      csvContent += 'PROFIT & LOSS STATEMENT\n';
      csvContent += `Period: ${reportData.dateRange.start} to ${reportData.dateRange.end}\n\n`;
      csvContent += 'INCOME CATEGORY,AMOUNT\n';
      (reportData.pnl?.incomeBreakdown || []).forEach((i) => {
        csvContent += `"${i.category}",${i.amount}\n`;
      });
      csvContent += `TOTAL REVENUE,${reportData.summary.totalIncome}\n\n`;
      csvContent += 'EXPENSE CATEGORY,AMOUNT\n';
      (reportData.pnl?.expenseBreakdown || []).forEach((e) => {
        csvContent += `"${e.category}",${e.amount}\n`;
      });
      csvContent += `TOTAL EXPENSES,${reportData.summary.totalExpenses}\n\n`;
      csvContent += `NET PROFIT,${reportData.summary.netProfit}\n`;
    } else {
      csvContent += `FINANCIAL REPORT (${reportType.toUpperCase()})\n`;
      csvContent += `Period: ${reportData.dateRange.start} to ${reportData.dateRange.end}\n\n`;
      csvContent += `TOTAL REVENUE,${reportData.summary.totalIncome}\n`;
      csvContent += `TOTAL EXPENSES,${reportData.summary.totalExpenses}\n`;
      csvContent += `NET POSITION,${reportData.summary.netProfit}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `KEPWE_Financial_Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="ledger-view-container print-area">
      {/* Header */}
      <div className="ledger-view-header">
        <div>
          <h2 className="ledger-view-title">Financial Statements & Reports</h2>
          <p className="ledger-view-sub">Real-time P&L statements, cash flow reconciliation, receivables aging, and audit reports.</p>
        </div>
        <div className="ledger-view-actions">
          <button onClick={handlePrint} className="btn-secondary">
            <Printer size={16} /> Print Statement
          </button>
          <button onClick={handleExportCSV} className="btn-primary" disabled={!reportData}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="report-tabs-bar">
        {[
          { id: 'pnl', label: 'Profit & Loss (P&L)', icon: TrendingUp },
          { id: 'income_vs_expense', label: 'Income vs Expense', icon: BarChart3 },
          { id: 'cash_flow', label: 'Cash Flow Breakdown', icon: DollarSign },
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
              Showing: {reportData.dateRange.start} → {reportData.dateRange.end}
            </span>
          )}
        </div>
      </div>

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
      ) : !reportData ? null : (
        <div>
          {/* Executive Summary Metrics */}
          <div className="ledger-metrics-strip" style={{ marginBottom: '24px' }}>
            <div className="metric-strip-card">
              <span className="strip-label">TOTAL OPERATING REVENUE</span>
              <span className="strip-val text-green font-mono">{fmtCurrency(reportData.summary.totalIncome)}</span>
            </div>
            <div className="metric-strip-card">
              <span className="strip-label">TOTAL OPERATING EXPENSES</span>
              <span className="strip-val text-navy font-mono">{fmtCurrency(reportData.summary.totalExpenses)}</span>
            </div>
            <div className="metric-strip-card highlight">
              <span className="strip-label">NET PROFIT / CASH GAIN</span>
              <span className="strip-val text-blue font-mono">{fmtCurrency(reportData.summary.netProfit)}</span>
            </div>
            <div className="metric-strip-card">
              <span className="strip-label">OPERATING MARGIN</span>
              <span className="strip-val font-mono">{reportData.summary.operatingMargin}%</span>
            </div>
          </div>

          {/* TAB 1: PROFIT & LOSS */}
          {(reportType === 'pnl' || reportType === 'income_vs_expense') && (
            <div className="report-grid-two">
              {/* Income Column */}
              <div className="report-section-card">
                <div className="section-head green">
                  <ArrowDownRight size={18} />
                  <span>Revenue & Income Streams</span>
                </div>
                <div className="report-line-items">
                  {(reportData.pnl?.incomeBreakdown || []).map((item) => (
                    <div key={item.category} className="report-line-row">
                      <span className="item-name">{item.category}</span>
                      <span className="item-amt font-mono text-green">{fmtCurrency(item.amount)}</span>
                    </div>
                  ))}
                  {(!reportData.pnl?.incomeBreakdown || reportData.pnl.incomeBreakdown.length === 0) && (
                    <div className="report-empty-sub">No income recorded for this period.</div>
                  )}
                  <div className="report-total-row">
                    <span>Total Operating Revenue</span>
                    <span className="font-mono text-green font-bold">{fmtCurrency(reportData.summary.totalIncome)}</span>
                  </div>
                </div>
              </div>

              {/* Expenses Column */}
              <div className="report-section-card">
                <div className="section-head red">
                  <ArrowUpRight size={18} />
                  <span>Operating Expenses</span>
                </div>
                <div className="report-line-items">
                  {(reportData.pnl?.expenseBreakdown || []).map((item) => (
                    <div key={item.category} className="report-line-row">
                      <span className="item-name">{item.category}</span>
                      <span className="item-amt font-mono">{fmtCurrency(item.amount)}</span>
                    </div>
                  ))}
                  {(!reportData.pnl?.expenseBreakdown || reportData.pnl.expenseBreakdown.length === 0) && (
                    <div className="report-empty-sub">No expenses recorded for this period.</div>
                  )}
                  <div className="report-total-row">
                    <span>Total Operating Expenses</span>
                    <span className="font-mono text-navy font-bold">{fmtCurrency(reportData.summary.totalExpenses)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: RECEIVABLES AGING */}
          {reportType === 'receivables_aging' && (
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

          {/* TAB: PAYABLES AGING */}
          {reportType === 'payables_aging' && (
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

          {/* TAB: ACCOUNT SUMMARY */}
          {reportType === 'account_summary' && (
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
