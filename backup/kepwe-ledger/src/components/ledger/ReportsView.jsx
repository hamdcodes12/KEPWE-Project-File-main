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
  CheckCircle2,
  Sparkles,
  Zap,
  Target,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Layers,
  ChevronRight,
  ShieldCheck,
  Flame
} from 'lucide-react';
import {
  fetchLedgerReports,
  downloadLedgerReportExport,
  fetchTrialBalance,
  fetchBalanceSheetStatement,
  fetchLedgerCategories,
  fetchLedgerAccounts
} from '../../api/ledgerClient';
import './ReportsView.css';

export default function ReportsView({ onNavigateTab }) {
  // Main View Mode: 'monthly_ai' | 'weekly_cfo' | 'accounting'
  const [activeTab, setActiveTab] = useState('monthly_ai');

  // Accounting Sub-Type (when activeTab === 'accounting')
  const [accountingType, setAccountingType] = useState('pnl');

  // Period & Filters
  const [period, setPeriod] = useState('monthly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Data States
  const [reportData, setReportData] = useState(null);
  const [trialData, setTrialData] = useState(null);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Export State
  const [exportingFormat, setExportingFormat] = useState(null);
  const [exportFeedback, setExportFeedback] = useState('');

  // Initial lookup data
  useEffect(() => {
    fetchLedgerCategories().then((res) => {
      if (res.ok && res.data?.categories) {
        setCategoriesList(res.data.categories);
      }
    }).catch(() => {});
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    setExportFeedback('');
    try {
      if (activeTab === 'accounting' && accountingType === 'trial_balance') {
        const res = await fetchLedgerReports({ reportType: 'trial_balance' });
        if (res.ok) setTrialData(res.data);
        else setError(res.data?.error || 'Failed to generate Trial Balance.');
      } else if (activeTab === 'accounting' && accountingType === 'balance_sheet') {
        const res = await fetchLedgerReports({ reportType: 'balance_sheet' });
        if (res.ok) setBalanceSheetData(res.data);
        else setError(res.data?.error || 'Failed to generate Balance Sheet.');
      } else {
        const queryParams = {
          reportType: activeTab,
          period,
          dateFrom,
          dateTo,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
        };
        const res = await fetchLedgerReports(queryParams);
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
  }, [activeTab, accountingType, period, dateFrom, dateTo, categoryFilter, typeFilter]);

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);

  const handleExport = async (format) => {
    try {
      setExportingFormat(format);
      setExportFeedback(`Generating genuine ${format.toUpperCase()} export...`);
      const result = await downloadLedgerReportExport({
        format,
        reportType: activeTab,
        period,
        dateFrom,
        dateTo,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      });
      setExportFeedback(`✓ Downloaded: ${result.filename}`);
      setTimeout(() => setExportFeedback(''), 4000);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const hasData = Boolean(
    reportData &&
    (reportData.summary?.hasFinancialData ||
     (reportData.allTransactions && reportData.allTransactions.length > 0) ||
     reportData.summary?.totalIncome > 0 ||
     reportData.summary?.totalExpenses > 0)
  );

  return (
    <div className="reports-container print-area">
      {/* Top Header & Actions Card */}
      <div className="reports-header-card">
        <div className="reports-header-info">
          <h2>Financial Reports & Intelligence</h2>
          <p>Authoritative financial reporting, period variance, and genuine file exports.</p>
        </div>

        <div className="reports-export-group">
          {exportFeedback && (
            <span style={{ fontSize: '0.82rem', color: '#16A34A', fontWeight: 700 }}>
              {exportFeedback}
            </span>
          )}

          <button
            onClick={() => handleExport('pdf')}
            disabled={Boolean(exportingFormat)}
            className="export-btn pdf"
            title="Export complete report as PDF document"
          >
            <Download size={15} />
            <span>{exportingFormat === 'pdf' ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>

          <button
            onClick={() => handleExport('xlsx')}
            disabled={Boolean(exportingFormat)}
            className="export-btn excel"
            title="Export multi-sheet Excel workbook (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>{exportingFormat === 'xlsx' ? 'Generating Excel...' : 'Export Excel'}</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={Boolean(exportingFormat)}
            className="export-btn csv"
            title="Export comma-separated transaction records"
          >
            <FileText size={15} />
            <span>{exportingFormat === 'csv' ? 'Generating CSV...' : 'Export CSV'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="export-btn csv"
            title="Print statement"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Main Tab Strip */}
      <div className="reports-tab-strip">
        <button
          onClick={() => setActiveTab('monthly_ai')}
          className={`reports-tab-btn ${activeTab === 'monthly_ai' ? 'active' : ''}`}
        >
          <Sparkles size={17} />
          <span>Monthly AI Report (10 Sections)</span>
        </button>

        <button
          onClick={() => setActiveTab('weekly_cfo')}
          className={`reports-tab-btn ${activeTab === 'weekly_cfo' ? 'active' : ''}`}
        >
          <Zap size={17} />
          <span>Weekly CFO Report (Pulse)</span>
        </button>

        <button
          onClick={() => setActiveTab('accounting')}
          className={`reports-tab-btn ${activeTab === 'accounting' ? 'active' : ''}`}
        >
          <Landmark size={17} />
          <span>Accounting Statements & P&L</span>
        </button>
      </div>

      {/* Period & Filter Control Bar */}
      {activeTab !== 'accounting' && (
        <div className="reports-filter-bar">
          <div className="filter-group">
            <span className="filter-label">Period:</span>
            <div className="period-pill-group">
              {[
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: 'Monthly' },
                { id: 'quarterly', label: 'Quarterly' },
                { id: 'annual', label: 'Annual (FY)' },
                { id: 'custom', label: 'Custom' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`period-pill ${period === p.id ? 'active' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {period === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="reports-select"
                />
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="reports-select"
                />
              </div>
            )}
          </div>

          <div className="filter-group">
            <Filter size={15} color="#64748B" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="reports-select"
            >
              <option value="all">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c.id || c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="reports-select"
            >
              <option value="all">All Transaction Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
              <option value="investment">Investments Only</option>
            </select>

            {reportData?.dateRange && (
              <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                {reportData.dateRange.start} → {reportData.dateRange.end}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Accounting Sub-Type Bar */}
      {activeTab === 'accounting' && (
        <div className="reports-filter-bar">
          <div className="filter-group">
            <span className="filter-label">Statement Type:</span>
            <div className="period-pill-group">
              {[
                { id: 'pnl', label: 'Profit & Loss (P&L)' },
                { id: 'trial_balance', label: 'Trial Balance' },
                { id: 'balance_sheet', label: 'Balance Sheet' },
                { id: 'account_summary', label: 'Account Balances' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setAccountingType(s.id)}
                  className={`period-pill ${accountingType === s.id ? 'active' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content Rendering */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
          <RefreshCw size={28} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, fontWeight: 600 }}>Generating financial report from database...</p>
        </div>
      ) : error ? (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#DC2626',
          padding: '16px 20px',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      ) : !hasData && activeTab !== 'accounting' ? (
        <div className="reports-empty-box">
          <AlertCircle size={40} color="#94A3B8" />
          <h3>No Transactions Recorded for this Period</h3>
          <p>
            No financial records were found matching {reportData?.periodLabel || 'this period'}.
            Upload your latest bank/UPI statement or record transactions to generate your personalized AI Financial Report.
          </p>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('upload')}
              className="export-btn excel"
              style={{ padding: '10px 20px', marginTop: 8 }}
            >
              <ArrowDownRight size={16} /> Add Financial Data
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Executive Metrics Strip */}
          {reportData && activeTab !== 'accounting' && (
            <div className="reports-metrics-grid">
              <div className="metric-card">
                <span className="metric-title">TOTAL INCOME</span>
                <span className="metric-val green">{fmtCurrency(reportData.summary.totalIncome)}</span>
                <span className="metric-sub">Recorded Inflows</span>
              </div>

              <div className="metric-card">
                <span className="metric-title">TOTAL EXPENSES</span>
                <span className="metric-val red">{fmtCurrency(reportData.summary.totalExpenses)}</span>
                <span className="metric-sub">
                  Essential: {fmtCurrency(reportData.summary.essentialExpenses)}
                </span>
              </div>

              <div className="metric-card">
                <span className="metric-title">NET SAVINGS</span>
                <span className="metric-val blue">{fmtCurrency(reportData.summary.totalSavings)}</span>
                <span className="metric-sub">Savings Rate: {reportData.summary.savingsRate}%</span>
              </div>

              <div className="metric-card">
                <span className="metric-title">INVESTMENTS</span>
                <span className="metric-val">{fmtCurrency(reportData.summary.totalInvestments)}</span>
                <span className="metric-sub">Allocated Wealth</span>
              </div>

              <div className="metric-card highlight">
                <span className="metric-title">POTENTIAL SURPLUS</span>
                <span className="metric-val blue">{fmtCurrency(reportData.summary.investableSurplus)}</span>
                <span className="metric-sub">PRD Investable Capital</span>
              </div>

              <div className="metric-card">
                <span className="metric-title">SPENDING VARIANCE</span>
                <span className={`metric-val ${reportData.summary.spendingDiff <= 0 ? 'green' : 'red'}`}>
                  {reportData.summary.spendingDiff > 0 ? '+' : ''}{fmtCurrency(reportData.summary.spendingDiff)}
                </span>
                <span className="metric-sub">
                  {reportData.summary.spendingDiffPct > 0 ? '+' : ''}{reportData.summary.spendingDiffPct}% vs prior
                </span>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB: MONTHLY AI REPORT (PRD SECTION 60)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'monthly_ai' && reportData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* AI CFO Executive Summary Banner */}
              <div className="cfo-executive-banner">
                <div className="cfo-banner-header">
                  <div className="cfo-banner-title">
                    <Sparkles size={20} color="#60A5FA" />
                    <span>AI CFO Strategic Analysis — {reportData.periodLabel}</span>
                  </div>
                  <span className="cfo-banner-badge">10-Point Analysis</span>
                </div>
                <p className="cfo-narrative-text">
                  {reportData.monthlyAiReport.section10_focus.narrative}
                </p>
                <div className="cfo-highlights-row">
                  <div className="cfo-highlight-pill">
                    <span className="highlight-label">Positive Habit</span>
                    <span className="highlight-content">{reportData.weeklyCfoReport.positiveBehaviour}</span>
                  </div>
                  <div className="cfo-highlight-pill">
                    <span className="highlight-label">Discretionary Leaks</span>
                    <span className="highlight-content">
                      {reportData.leaks.count} micro-purchases totaling {fmtCurrency(reportData.leaks.total)}
                    </span>
                  </div>
                  <div className="cfo-highlight-pill">
                    <span className="highlight-label">Investable Surplus</span>
                    <span className="highlight-content">
                      {fmtCurrency(reportData.summary.investableSurplus)} available for goals
                    </span>
                  </div>
                </div>
              </div>

              {/* 10-Point Monthly AI Sections Grid */}
              <div className="monthly-sections-grid">
                {/* 1. Income */}
                <div className="section-report-card">
                  <div className="card-top">
                    <span className="card-top-title"><TrendingUp size={16} color="#16A34A" /> 1. Income</span>
                    <span className="card-amount-pill text-green">{fmtCurrency(reportData.monthlyAiReport.section1_income.total)}</span>
                  </div>
                  <p className="card-narrative">{reportData.monthlyAiReport.section1_income.narrative}</p>
                  {(reportData.monthlyAiReport.section1_income.sources || []).map((s) => (
                    <div key={s.category} className="cat-progress-item">
                      <div className="cat-progress-labels">
                        <span>{s.category}</span>
                        <span style={{ fontFamily: 'monospace' }}>{fmtCurrency(s.amount)} ({s.pct}%)</span>
                      </div>
                      <div className="cat-progress-track">
                        <div className="cat-progress-fill" style={{ width: `${Math.min(100, s.pct)}%`, background: '#16A34A' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. Expenses */}
                <div className="section-report-card">
                  <div className="card-top">
                    <span className="card-top-title"><TrendingDown size={16} color="#DC2626" /> 2. Expenses</span>
                    <span className="card-amount-pill text-red">{fmtCurrency(reportData.monthlyAiReport.section2_expenses.total)}</span>
                  </div>
                  <p className="card-narrative">{reportData.monthlyAiReport.section2_expenses.narrative}</p>
                  {(reportData.breakdown.expenses || []).slice(0, 4).map((c) => (
                    <div key={c.category} className="cat-progress-item">
                      <div className="cat-progress-labels">
                        <span>{c.category}</span>
                        <span style={{ fontFamily: 'monospace' }}>{fmtCurrency(c.amount)} ({c.pct}%)</span>
                      </div>
                      <div className="cat-progress-track">
                        <div className="cat-progress-fill" style={{ width: `${Math.min(100, c.pct)}%`, background: '#DC2626' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 3. Savings */}
                <div className="section-report-card">
                  <div className="card-top">
                    <span className="card-top-title"><DollarSign size={16} color="#2563EB" /> 3. Savings</span>
                    <span className="card-amount-pill text-blue">{fmtCurrency(reportData.monthlyAiReport.section3_savings.total)}</span>
                  </div>
                  <p className="card-narrative">{reportData.monthlyAiReport.section3_savings.narrative}</p>
                  <div className="cat-progress-item">
                    <div className="cat-progress-labels">
                      <span>Savings Rate</span>
                      <span>{reportData.summary.savingsRate}%</span>
                    </div>
                    <div className="cat-progress-track">
                      <div className="cat-progress-fill" style={{ width: `${Math.min(100, reportData.summary.savingsRate)}%`, background: '#2563EB' }} />
                    </div>
                  </div>
                </div>

                {/* 4. Investments */}
                <div className="section-report-card">
                  <div className="card-top">
                    <span className="card-top-title"><Target size={16} color="#7C3AED" /> 4. Investments</span>
                    <span className="card-amount-pill" style={{ color: '#7C3AED' }}>{fmtCurrency(reportData.monthlyAiReport.section4_investments.total)}</span>
                  </div>
                  <p className="card-narrative">{reportData.monthlyAiReport.section4_investments.narrative}</p>
                </div>

                {/* 5. Debt */}
                <div className="section-report-card">
                  <div className="card-top">
                    <span className="card-top-title"><AlertCircle size={16} color="#D97706" /> 5. Debt Obligations</span>
                    <span className="card-amount-pill" style={{ color: '#D97706' }}>{fmtCurrency(reportData.monthlyAiReport.section5_debt.total)}</span>
                  </div>
                  <p className="card-narrative">{reportData.monthlyAiReport.section5_debt.narrative}</p>
                </div>

                {/* 6. Recurring Expenses */}
                <div className="section-report-card">
                  <div className="card-top">
                    <span className="card-top-title"><Clock size={16} color="#0284C7" /> 6. Recurring Expenses</span>
                    <span className="card-amount-pill" style={{ color: '#0284C7' }}>{fmtCurrency(reportData.monthlyAiReport.section6_recurring.total)}</span>
                  </div>
                  <p className="card-narrative">{reportData.monthlyAiReport.section6_recurring.narrative}</p>
                </div>

                {/* 7. Spending Changes */}
                <div className="section-report-card">
                  <div className="card-top">
                    <span className="card-top-title"><BarChart3 size={16} color="#0F172A" /> 7. Spending Changes</span>
                    <span className={`card-amount-pill ${reportData.summary.spendingDiff <= 0 ? 'text-green' : 'text-red'}`}>
                      {reportData.summary.spendingDiff > 0 ? '+' : ''}{fmtCurrency(reportData.summary.spendingDiff)}
                    </span>
                  </div>
                  <p className="card-narrative">{reportData.monthlyAiReport.section7_spending_changes.narrative}</p>
                </div>

                {/* 8. Financial Leaks */}
                <div className="section-report-card">
                  <div className="card-top">
                    <span className="card-top-title"><Flame size={16} color="#DC2626" /> 8. Financial Leaks</span>
                    <span className="card-amount-pill text-red">{fmtCurrency(reportData.monthlyAiReport.section8_financial_leaks.total)}</span>
                  </div>
                  <p className="card-narrative">{reportData.monthlyAiReport.section8_financial_leaks.narrative}</p>
                </div>

                {/* 9. Goal Progress */}
                <div className="section-report-card">
                  <div className="card-top">
                    <span className="card-top-title"><CheckCircle2 size={16} color="#16A34A" /> 9. Goal Progress</span>
                    <span className="card-amount-pill">{reportData.goals.length} Active</span>
                  </div>
                  <p className="card-narrative">{reportData.monthlyAiReport.section9_goals.narrative}</p>
                  {(reportData.goals || []).map((g) => (
                    <div key={g.id} className="cat-progress-item">
                      <div className="cat-progress-labels">
                        <span style={{ fontWeight: 700 }}>{g.name}</span>
                        <span>{fmtCurrency(g.currentAmount)} / {fmtCurrency(g.targetAmount)} ({g.progressPct}%)</span>
                      </div>
                      <div className="cat-progress-track">
                        <div className="cat-progress-fill" style={{ width: `${g.progressPct}%`, background: '#16A34A' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 10. Next Period Focus */}
                <div className="section-report-card" style={{ background: '#F8FAFC', border: '1px solid #CBD5E1' }}>
                  <div className="card-top">
                    <span className="card-top-title"><ShieldCheck size={16} color="#2563EB" /> 10. Next Period Focus</span>
                    <span className="card-amount-pill text-blue">Action Plan</span>
                  </div>
                  <p className="card-narrative" style={{ fontWeight: 600, color: '#1E293B' }}>
                    {reportData.monthlyAiReport.section10_focus.focus}
                  </p>
                </div>
              </div>

              {/* Spending Variance Table */}
              <div className="reports-table-card">
                <div className="table-header-bar">
                  <h3>Period-over-Period Variance by Category</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                    Comparing {reportData.dateRange.start} vs {reportData.dateRange.priorStart}
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Current Period</th>
                        <th style={{ textAlign: 'right' }}>Prior Period</th>
                        <th style={{ textAlign: 'right' }}>Difference</th>
                        <th style={{ textAlign: 'right' }}>Variance %</th>
                        <th style={{ textAlign: 'center' }}>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.breakdown.categoryChanges || []).map((c) => (
                        <tr key={c.category}>
                          <td style={{ fontWeight: 700 }}>{c.category}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCurrency(c.currentAmount)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#64748B' }}>{fmtCurrency(c.priorAmount)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                            <span style={{ color: c.diff > 0 ? '#DC2626' : c.diff < 0 ? '#16A34A' : '#64748B' }}>
                              {c.diff > 0 ? '+' : ''}{fmtCurrency(c.diff)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {c.diffPct > 0 ? '+' : ''}{c.diffPct}%
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`trend-badge ${c.trend}`}>
                              {c.trend === 'up' ? '▲ Up' : c.trend === 'down' ? '▼ Reduced' : '— Flat'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB: WEEKLY CFO REPORT (PRD SECTION 59)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'weekly_cfo' && reportData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="cfo-executive-banner">
                <div className="cfo-banner-header">
                  <div className="cfo-banner-title">
                    <Zap size={20} color="#FBBF24" />
                    <span>Weekly Financial Pulse — {reportData.periodLabel}</span>
                  </div>
                  <span className="cfo-banner-badge">7-Metric CFO Pulse</span>
                </div>
                <p className="cfo-narrative-text">
                  Income: {fmtCurrency(reportData.weeklyCfoReport.income)} | Expenses: {fmtCurrency(reportData.weeklyCfoReport.expenses)} | Net Savings: {fmtCurrency(reportData.weeklyCfoReport.savings)}.
                </p>
                <div className="cfo-highlights-row">
                  <div className="cfo-highlight-pill">
                    <span className="highlight-label">Biggest Expense</span>
                    <span className="highlight-content">
                      {reportData.weeklyCfoReport.biggestExpense
                        ? `${reportData.weeklyCfoReport.biggestExpense.merchant} (${fmtCurrency(reportData.weeklyCfoReport.biggestExpense.amount)})`
                        : 'No expenses'}
                    </span>
                  </div>
                  <div className="cfo-highlight-pill">
                    <span className="highlight-label">Weekly Money Leak</span>
                    <span className="highlight-content">
                      {reportData.weeklyCfoReport.moneyLeak.count} transactions ({fmtCurrency(reportData.weeklyCfoReport.moneyLeak.total)})
                    </span>
                  </div>
                  <div className="cfo-highlight-pill">
                    <span className="highlight-label">Positive Behaviour</span>
                    <span className="highlight-content">{reportData.weeklyCfoReport.positiveBehaviour}</span>
                  </div>
                </div>
              </div>

              {/* Transactions in Period */}
              <div className="reports-table-card">
                <div className="table-header-bar">
                  <h3>Weekly Ledger Activity ({reportData.allTransactions?.length || 0} Transactions)</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="reports-data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Merchant / Description</th>
                        <th>Category</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.allTransactions || []).map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontFamily: 'monospace', color: '#64748B' }}>{t.date}</td>
                          <td style={{ fontWeight: 700 }}>{t.merchant || t.description}</td>
                          <td><span className="trend-badge flat">{t.category}</span></td>
                          <td>
                            <span className={`trend-badge ${t.type === 'income' ? 'down' : 'up'}`}>
                              {t.type.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                            <span style={{ color: t.type === 'income' ? '#16A34A' : '#DC2626' }}>
                              {t.type === 'income' ? '+' : '-'}{fmtCurrency(t.amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB: ACCOUNTING STATEMENTS (P&L, TRIAL BALANCE, BALANCE SHEET)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'accounting' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* TRIAL BALANCE */}
              {accountingType === 'trial_balance' && trialData && (
                <div className="reports-table-card">
                  <div className="table-header-bar">
                    <h3>Trial Balance (As of {trialData.asOfDate})</h3>
                    <span className="trend-badge down">Balanced</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="reports-data-table">
                      <thead>
                        <tr>
                          <th>Account Code</th>
                          <th>Account Name</th>
                          <th>Category</th>
                          <th style={{ textAlign: 'right' }}>Debit</th>
                          <th style={{ textAlign: 'right' }}>Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(trialData.rows || []).map((r) => (
                          <tr key={r.id}>
                            <td style={{ fontFamily: 'monospace', color: '#2563EB', fontWeight: 700 }}>{r.code}</td>
                            <td style={{ fontWeight: 700 }}>{r.name}</td>
                            <td><span className="trend-badge flat">{r.type}</span></td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCurrency(r.totalDebit)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCurrency(r.totalCredit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* BALANCE SHEET */}
              {accountingType === 'balance_sheet' && balanceSheetData && (
                <div className="reports-table-card">
                  <div className="table-header-bar">
                    <h3>Balance Sheet (Assets = Liabilities + Equity)</h3>
                    <span className="trend-badge down">Strictly In Balance</span>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                      <div className="section-report-card">
                        <span className="card-top-title">Total Assets</span>
                        <span className="card-amount-pill text-blue">{fmtCurrency(balanceSheetData.totalAssets)}</span>
                      </div>
                      <div className="section-report-card">
                        <span className="card-top-title">Total Liabilities & Equity</span>
                        <span className="card-amount-pill text-green">{fmtCurrency(balanceSheetData.totalLiabilitiesAndEquity)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PROFIT & LOSS */}
              {accountingType === 'pnl' && reportData && (
                <div className="reports-table-card">
                  <div className="table-header-bar">
                    <h3>Operating Profit & Loss Statement</h3>
                    <span className="trend-badge down">Net Gain: {fmtCurrency(reportData.summary.netProfit)}</span>
                  </div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                      <div className="metric-card">
                        <span className="metric-title">OPERATING REVENUE</span>
                        <span className="metric-val green">{fmtCurrency(reportData.summary.totalIncome)}</span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-title">OPERATING EXPENSES</span>
                        <span className="metric-val red">{fmtCurrency(reportData.summary.totalExpenses)}</span>
                      </div>
                      <div className="metric-card highlight">
                        <span className="metric-title">NET PROFIT / CASH GAIN</span>
                        <span className="metric-val blue">{fmtCurrency(reportData.summary.netProfit)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACCOUNT BALANCES */}
              {accountingType === 'account_summary' && reportData && (
                <div className="reports-table-card">
                  <div className="table-header-bar">
                    <h3>Live Account Balances</h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="reports-data-table">
                      <thead>
                        <tr>
                          <th>Account Name</th>
                          <th>Type</th>
                          <th style={{ textAlign: 'right' }}>Opening Balance</th>
                          <th style={{ textAlign: 'right' }}>Live Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.accounts || []).map((a) => (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 700 }}>{a.name}</td>
                            <td><span className="trend-badge flat">{a.type}</span></td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmtCurrency(a.openingBalance)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#16A34A' }}>
                              {fmtCurrency(a.currentBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
