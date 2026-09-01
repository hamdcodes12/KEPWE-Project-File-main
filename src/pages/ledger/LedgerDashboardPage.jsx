import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import './LedgerDashboardPage.css';
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  Settings,
  Bell,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  LogOut,
  Building2,
  ShieldCheck,
  FolderLock,
  Headphones,
  Menu,
  X,
  CreditCard,
  ChevronRight,
  Landmark,
  PiggyBank,
  QrCode,
  Sparkles,
  Calendar
} from 'lucide-react';
import {
  fetchLedgerDashboard,
  fetchLedgerAccounts,
  fetchLedgerCategories,
  createLedgerTransaction
} from '../../api/ledgerClient';

// Sub Views
import TransactionsView from '../../components/ledger/TransactionsView';
import IncomeView from '../../components/ledger/IncomeView';
import ExpensesView from '../../components/ledger/ExpensesView';
import ReceivablesView from '../../components/ledger/ReceivablesView';
import PayablesView from '../../components/ledger/PayablesView';
import AccountsView from '../../components/ledger/AccountsView';
import ReportsView from '../../components/ledger/ReportsView';
import SettingsView from '../../components/ledger/SettingsView';

export default function LedgerDashboardPage() {
  const { authState, logout, portalProfile } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Global filters
  const [datePreset, setDatePreset] = useState('this_month');
  const [chartInterval, setChartInterval] = useState('monthly');

  // Live Data State
  const [dashboardData, setDashboardData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Quick Add Universal Modal
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState('income');
  const [quickAddForm, setQuickAddForm] = useState({
    amount: '',
    category: 'Sales Revenue',
    counterparty: '',
    description: '',
    accountId: '',
    paymentMethod: 'UPI',
    referenceNumber: '',
  });
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  // Notification center state
  const [notifOpen, setNotifOpen] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, accRes, catRes] = await Promise.all([
        fetchLedgerDashboard({ datePreset, chartInterval }),
        fetchLedgerAccounts(),
        fetchLedgerCategories(),
      ]);

      if (dashRes.ok) {
        setDashboardData(dashRes.data);
      } else {
        setError(dashRes.data?.error || 'Unable to load ledger dashboard.');
      }

      if (accRes.ok && Array.isArray(accRes.data?.accounts)) {
        setAccounts(accRes.data.accounts);
      }

      if (catRes.ok && Array.isArray(catRes.data?.categories)) {
        setCategories(catRes.data.categories);
      }
    } catch (err) {
      setError(err.message || 'Error communicating with ledger services.');
    } finally {
      setLoading(false);
    }
  }, [datePreset, chartInterval]);

  useEffect(() => {
    if (authState.isLoggedIn) {
      loadAllData();
    }
  }, [authState.isLoggedIn, loadAllData]);

  // Quick Add Handler
  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!quickAddForm.amount || Number(quickAddForm.amount) <= 0) {
      setQuickAddError('Please enter a valid amount.');
      return;
    }
    setQuickAddSaving(true);
    setQuickAddError('');

    try {
      const res = await createLedgerTransaction({
        type: quickAddType,
        amount: Number(quickAddForm.amount),
        category: quickAddForm.category,
        counterparty: quickAddForm.counterparty || null,
        description: quickAddForm.description || null,
        accountId: quickAddForm.accountId || accounts[0]?.id || null,
        paymentMethod: quickAddForm.paymentMethod || 'UPI',
        referenceNumber: quickAddForm.referenceNumber || null,
      });

      if (res.ok) {
        setQuickAddOpen(false);
        setQuickAddForm({
          amount: '',
          category: 'Sales Revenue',
          counterparty: '',
          description: '',
          accountId: accounts[0]?.id || '',
          paymentMethod: 'UPI',
          referenceNumber: '',
        });
        loadAllData();
      } else {
        setQuickAddError(res.data?.error || 'Failed to save transaction.');
      }
    } catch (err) {
      setQuickAddError(err.message || 'Error recording transaction.');
    } finally {
      setQuickAddSaving(false);
    }
  };

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val || 0);

  const greetingName = authState.user?.name?.split(' ')[0] || 'User';
  const companyName = portalProfile?.company?.name || 'My Business Workspace';
  const overdueAlertCount = (dashboardData?.metrics?.overdueReceivablesCount || 0) + (dashboardData?.metrics?.overduePayablesCount || 0);

  return (
    <div className="ledger-layout">
      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
      <aside className={`ledger-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="ledger-sidebar-brand">
          <div className="brand-icon-box">
            <Receipt size={20} />
          </div>
          <div>
            <div className="brand-title">KEPWE LEDGER</div>
            <div className="brand-subtitle">FINANCIAL COMMAND</div>
          </div>
        </div>

        <nav className="ledger-sidebar-nav">
          <div className="nav-section-label">Core Ledger</div>

          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'transactions', label: 'Transactions', icon: Receipt, count: dashboardData?.recentTransactions?.length },
            { id: 'income', label: 'Income', icon: TrendingUp },
            { id: 'expenses', label: 'Expenses', icon: TrendingDown },
            { id: 'receivables', label: 'Receivables', icon: ArrowDownRight, alertCount: dashboardData?.metrics?.overdueReceivablesCount },
            { id: 'payables', label: 'Payables', icon: ArrowUpRight, alertCount: dashboardData?.metrics?.overduePayablesCount },
            { id: 'accounts', label: 'Accounts', icon: Wallet, count: accounts.length },
            { id: 'reports', label: 'Reports', icon: FileText },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              >
                <div className="nav-item-content">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                {item.alertCount > 0 ? (
                  <span className="nav-badge alert">{item.alertCount}</span>
                ) : item.count !== undefined && item.count > 0 ? (
                  <span className="nav-badge">{item.count}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="ledger-sidebar-footer">
          <div className="user-profile-widget">
            <div className="avatar-circle">
              {greetingName.charAt(0).toUpperCase()}
            </div>
            <div className="user-info-text">
              <div className="user-display-name">{authState.user?.name || 'Authorized User'}</div>
              <div className="user-plan-tag">{companyName}</div>
            </div>
            <button
              onClick={() => logout()}
              className="btn-icon small"
              title="Sign Out"
              style={{ color: '#EF4444', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
      <div className="ledger-main-wrapper">
        {/* Topbar */}
        <header className="ledger-topbar">
          <div className="topbar-left">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mobile-menu-toggle"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <div className="topbar-page-title">
                {activeTab === 'dashboard' && 'Financial Overview'}
                {activeTab === 'transactions' && 'All Transactions'}
                {activeTab === 'income' && 'Income Streams'}
                {activeTab === 'expenses' && 'Business Expenses'}
                {activeTab === 'receivables' && 'Customer Invoices & Receivables'}
                {activeTab === 'payables' && 'Vendor Bills & Payables'}
                {activeTab === 'accounts' && 'Financial Accounts'}
                {activeTab === 'reports' && 'Financial Statements & Reports'}
                {activeTab === 'settings' && 'Ledger Settings'}
              </div>
            </div>
          </div>

          <div className="topbar-right">
            {activeTab === 'dashboard' && (
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="date-preset-select"
              >
                <option value="this_month">This Month</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="last_month">Last Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Fiscal Year</option>
                <option value="all">All Records</option>
              </select>
            )}

            <button
              onClick={() => { setQuickAddType('income'); setQuickAddOpen(true); }}
              className="quick-add-btn"
            >
              <Plus size={15} /> Quick Add
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="notif-bell-btn"
                title="Notifications"
              >
                <Bell size={18} />
                {overdueAlertCount > 0 && (
                  <span className="notif-badge">{overdueAlertCount}</span>
                )}
              </button>

              {notifOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '320px',
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid var(--ledger-border)',
                    boxShadow: '0 10px 30px rgba(15,23,42,0.15)',
                    padding: '16px',
                    zIndex: 200,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>Ledger Alerts</span>
                    <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  </div>
                  {overdueAlertCount === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: '#64748B', fontSize: '0.82rem' }}>
                      <CheckCircle2 size={24} color="#10B981" style={{ margin: '0 auto 6px', display: 'block' }} />
                      All invoices and vendor payouts are on schedule.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {dashboardData?.metrics?.overdueReceivablesCount > 0 && (
                        <div
                          onClick={() => { setActiveTab('receivables'); setNotifOpen(false); }}
                          style={{
                            padding: '10px',
                            background: 'var(--ledger-red-light)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: '#DC2626',
                            fontWeight: 600,
                          }}
                        >
                          ⚠️ {dashboardData.metrics.overdueReceivablesCount} customer invoice(s) are overdue. Click to follow up.
                        </div>
                      )}
                      {dashboardData?.metrics?.overduePayablesCount > 0 && (
                        <div
                          onClick={() => { setActiveTab('payables'); setNotifOpen(false); }}
                          style={{
                            padding: '10px',
                            background: 'var(--ledger-amber-light)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: '#D97706',
                            fontWeight: 600,
                          }}
                        >
                          ⏳ {dashboardData.metrics.overduePayablesCount} vendor bill(s) are due for payment. Click to disburse.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="ledger-content-body">
          {/* TAB 1: MAIN DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div>
              {loading ? (
                <div className="ledger-loading-state">
                  <div className="spinner" />
                  <span>Calculating live ledger totals from database...</span>
                </div>
              ) : error ? (
                <div className="ledger-error-state">
                  <AlertCircle size={32} color="#EF4444" />
                  <span>{error}</span>
                  <button onClick={loadAllData} className="btn-secondary" style={{ marginTop: '10px' }}>
                    Reload Data
                  </button>
                </div>
              ) : (
                <>
                  {/* 5 KPI Cards Grid (Direct DB Calculations) */}
                  <div className="overview-cards-grid">
                    {/* 1. Total Income */}
                    <div className="overview-card">
                      <div className="card-top-row">
                        <span className="card-title-text">TOTAL INCOME</span>
                        <div className="card-icon-pill green">
                          <TrendingUp size={16} />
                        </div>
                      </div>
                      <div className="card-number text-green font-mono">
                        {fmtCurrency(dashboardData?.metrics?.totalIncome || 0)}
                      </div>
                      <div className="card-footer-sub">
                        <span>Actual Inflows</span>
                        <span className="trend-badge">
                          <CheckCircle2 size={12} /> Live
                        </span>
                      </div>
                    </div>

                    {/* 2. Total Expenses */}
                    <div className="overview-card">
                      <div className="card-top-row">
                        <span className="card-title-text">TOTAL EXPENSES</span>
                        <div className="card-icon-pill red">
                          <TrendingDown size={16} />
                        </div>
                      </div>
                      <div className="card-number font-mono">
                        {fmtCurrency(dashboardData?.metrics?.totalExpenses || 0)}
                      </div>
                      <div className="card-footer-sub">
                        <span>Actual Outflows</span>
                        <span>Operating Costs</span>
                      </div>
                    </div>

                    {/* 3. Net Position */}
                    <div className="overview-card highlight">
                      <div className="card-top-row">
                        <span className="card-title-text">NET POSITION</span>
                        <div className="card-icon-pill blue">
                          <Wallet size={16} />
                        </div>
                      </div>
                      <div className={`card-number font-mono ${(dashboardData?.metrics?.netPosition || 0) >= 0 ? 'text-blue' : 'text-red'}`}>
                        {(dashboardData?.metrics?.netPosition || 0) >= 0 ? '+' : ''}{fmtCurrency(dashboardData?.metrics?.netPosition || 0)}
                      </div>
                      <div className="card-footer-sub">
                        <span>Income − Expenses</span>
                        <span style={{ fontWeight: 700, color: '#214ECF' }}>Runway Ready</span>
                      </div>
                    </div>

                    {/* 4. Receivables */}
                    <div className="overview-card">
                      <div className="card-top-row">
                        <span className="card-title-text">RECEIVABLES</span>
                        <div className="card-icon-pill blue">
                          <ArrowDownRight size={16} />
                        </div>
                      </div>
                      <div className="card-number font-mono">
                        {fmtCurrency(dashboardData?.metrics?.totalReceivables || 0)}
                      </div>
                      <div className="card-footer-sub">
                        <span>Pending Invoices</span>
                        {dashboardData?.metrics?.overdueReceivablesCount > 0 ? (
                          <span style={{ color: '#DC2626', fontWeight: 700 }}>
                            {dashboardData.metrics.overdueReceivablesCount} Overdue
                          </span>
                        ) : (
                          <span style={{ color: '#059669', fontWeight: 600 }}>0 Overdue</span>
                        )}
                      </div>
                    </div>

                    {/* 5. Payables */}
                    <div className="overview-card">
                      <div className="card-top-row">
                        <span className="card-title-text">PAYABLES</span>
                        <div className="card-icon-pill amber">
                          <ArrowUpRight size={16} />
                        </div>
                      </div>
                      <div className="card-number font-mono">
                        {fmtCurrency(dashboardData?.metrics?.totalPayables || 0)}
                      </div>
                      <div className="card-footer-sub">
                        <span>Vendor Obligations</span>
                        {dashboardData?.metrics?.overduePayablesCount > 0 ? (
                          <span style={{ color: '#DC2626', fontWeight: 700 }}>
                            {dashboardData.metrics.overduePayablesCount} Due
                          </span>
                        ) : (
                          <span style={{ color: '#059669', fontWeight: 600 }}>On Track</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Grid: Cash Flow Overview + Accounts Quick Snapshot */}
                  <div className="dashboard-middle-grid">
                    {/* Cash Flow Overview Card */}
                    <div className="chart-card">
                      <div className="chart-header">
                        <div>
                          <div className="chart-title">Cash Flow Overview</div>
                          <div className="chart-sub">Inflow vs Outflow over time ({dashboardData?.datePreset?.replace('_', ' ')})</div>
                        </div>
                        <div className="chart-controls">
                          <button
                            onClick={() => setChartInterval('weekly')}
                            className={`interval-btn ${chartInterval === 'weekly' ? 'active' : ''}`}
                          >
                            Weekly
                          </button>
                          <button
                            onClick={() => setChartInterval('monthly')}
                            className={`interval-btn ${chartInterval === 'monthly' ? 'active' : ''}`}
                          >
                            Monthly
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Bar/Line Chart Visualization */}
                      <div className="chart-visual-box">
                        {(!dashboardData?.cashFlow?.series || dashboardData.cashFlow.series.length === 0) ? (
                          <div style={{ width: '100%', textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem', paddingBottom: '30px' }}>
                            No cash flow transactions recorded in this period.
                          </div>
                        ) : (
                          <div className="chart-bars-wrap">
                            {dashboardData.cashFlow.series.map((bucket, idx) => {
                              const maxVal = Math.max(
                                ...dashboardData.cashFlow.series.map((s) => Math.max(s.income, s.expense)),
                                1000
                              );
                              const incHeight = Math.max(8, (bucket.income / maxVal) * 120);
                              const expHeight = Math.max(8, (bucket.expense / maxVal) * 120);

                              return (
                                <div key={bucket.label || idx} className="chart-bar-group">
                                  <div className="bars-pair">
                                    <div
                                      className="bar-pill income"
                                      style={{ height: `${incHeight}px` }}
                                      title={`Income: ${fmtCurrency(bucket.income)}`}
                                    />
                                    <div
                                      className="bar-pill expense"
                                      style={{ height: `${expHeight}px` }}
                                      title={`Expense: ${fmtCurrency(bucket.expense)}`}
                                    />
                                  </div>
                                  <span className="bar-label">{bucket.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="chart-legend-row">
                        <span><span className="legend-dot blue" /> Income (Inflow)</span>
                        <span><span className="legend-dot gray" /> Expenses (Outflow)</span>
                      </div>
                    </div>

                    {/* Financial Accounts Quick Snapshot */}
                    <div className="accounts-widget-card">
                      <div className="widget-header">
                        <span className="widget-title">Accounts Balance</span>
                        <button onClick={() => setActiveTab('accounts')} className="btn-secondary small">
                          View All
                        </button>
                      </div>

                      <div className="accounts-mini-list">
                        {accounts.slice(0, 4).map((acc) => (
                          <div key={acc.id} className="account-mini-item">
                            <div className="acc-mini-left">
                              <Wallet size={16} color="#214ECF" />
                              <div>
                                <div className="acc-mini-name">{acc.name}</div>
                                <div className="acc-mini-type">{acc.type}</div>
                              </div>
                            </div>
                            <div className="acc-mini-bal font-mono">{fmtCurrency(acc.currentBalance)}</div>
                          </div>
                        ))}

                        {accounts.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '0.82rem' }}>
                            No accounts linked yet. Click to add.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions List */}
                  <div className="ledger-table-card">
                    <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--ledger-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>Recent Real Transactions</h3>
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Latest financial entries recorded in your ledger</span>
                      </div>
                      <button onClick={() => setActiveTab('transactions')} className="btn-secondary small">
                        View All Transactions →
                      </button>
                    </div>

                    {(!dashboardData?.recentTransactions || dashboardData.recentTransactions.length === 0) ? (
                      <div className="ledger-empty-state" style={{ padding: '36px 20px' }}>
                        <Receipt size={36} className="empty-icon" />
                        <h3>No transactions recorded yet</h3>
                        <p>Record your first transaction or invoice payment to begin tracking live cash flows.</p>
                        <button onClick={() => { setQuickAddType('income'); setQuickAddOpen(true); }} className="btn-primary">
                          <Plus size={16} /> Add First Entry
                        </button>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="ledger-data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Category</th>
                              <th>Counterparty / Party</th>
                              <th>Account</th>
                              <th>Amount</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardData.recentTransactions.map((tx) => (
                              <tr key={tx.id}>
                                <td><span className="font-mono text-muted">{tx.transactionDate}</span></td>
                                <td>
                                  <span className={`tx-type-pill ${tx.type}`}>
                                    {tx.type === 'income' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                                    {tx.type.toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <span className="tx-cat-badge">{tx.category}</span>
                                  {tx.description && <div className="tx-sub-desc">{tx.description}</div>}
                                </td>
                                <td>
                                  <span className="tx-party-name">{tx.counterparty || '—'}</span>
                                </td>
                                <td>
                                  <div className="tx-acc-cell">
                                    <Wallet size={12} className="cell-icon" />
                                    <span>{tx.accountName}</span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`font-mono font-bold ${tx.type === 'income' ? 'text-green' : 'text-navy'}`}>
                                    {tx.type === 'income' ? '+' : '-'}{fmtCurrency(tx.amount)}
                                  </span>
                                </td>
                                <td><span className="status-pill paid">{tx.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <TransactionsView
              accounts={accounts}
              categories={categories}
              onMutationSuccess={loadAllData}
            />
          )}

          {/* TAB: INCOME */}
          {activeTab === 'income' && (
            <IncomeView
              accounts={accounts}
              categories={categories}
              onMutationSuccess={loadAllData}
            />
          )}

          {/* TAB: EXPENSES */}
          {activeTab === 'expenses' && (
            <ExpensesView
              accounts={accounts}
              categories={categories}
              onMutationSuccess={loadAllData}
            />
          )}

          {/* TAB: RECEIVABLES */}
          {activeTab === 'receivables' && (
            <ReceivablesView
              accounts={accounts}
              onMutationSuccess={loadAllData}
            />
          )}

          {/* TAB: PAYABLES */}
          {activeTab === 'payables' && (
            <PayablesView
              accounts={accounts}
              onMutationSuccess={loadAllData}
            />
          )}

          {/* TAB: ACCOUNTS */}
          {activeTab === 'accounts' && (
            <AccountsView
              accounts={accounts}
              onMutationSuccess={loadAllData}
            />
          )}

          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <ReportsView />
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <SettingsView
              accounts={accounts}
              onMutationSuccess={loadAllData}
            />
          )}
        </main>
      </div>

      {/* ── QUICK ADD MODAL ───────────────────────────────────────────── */}
      {quickAddOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card">
            <div className="modal-header">
              <h3>Quick Record Entry</h3>
              <button onClick={() => setQuickAddOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="modal-form">
              {quickAddError && <div className="modal-alert error">{quickAddError}</div>}

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Type</label>
                  <select
                    value={quickAddType}
                    onChange={(e) => {
                      const t = e.target.value;
                      setQuickAddType(t);
                      setQuickAddForm((prev) => ({
                        ...prev,
                        category: t === 'income' ? 'Sales Revenue' : 'Office Rent & Utilities',
                      }));
                    }}
                    className="form-input"
                  >
                    <option value="income">Income (+ Inflow)</option>
                    <option value="expense">Expense (- Outflow)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 10000"
                    value={quickAddForm.amount}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, amount: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Category</label>
                  <select
                    value={quickAddForm.category}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, category: e.target.value })}
                    className="form-input"
                  >
                    {categories
                      .filter((c) => c.type === quickAddType)
                      .map((c) => (
                        <option key={c.id || c.name} value={c.name}>{c.name}</option>
                      ))}
                    {categories.length === 0 && <option value="General">General</option>}
                  </select>
                </div>
                <div>
                  <label className="form-label">Account</label>
                  <select
                    value={quickAddForm.accountId}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, accountId: e.target.value })}
                    className="form-input"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({fmtCurrency(a.currentBalance)})</option>
                    ))}
                    {accounts.length === 0 && <option value="">Direct / Cash</option>}
                  </select>
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Customer / Vendor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Media or AWS"
                    value={quickAddForm.counterparty}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, counterparty: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Payment Method</label>
                  <select
                    value={quickAddForm.paymentMethod}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, paymentMethod: e.target.value })}
                    className="form-input"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Payment for monthly retainer"
                  value={quickAddForm.description}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, description: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setQuickAddOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={quickAddSaving} className="btn-primary">
                  {quickAddSaving ? 'Saving…' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
