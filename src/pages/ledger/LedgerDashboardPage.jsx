import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import kepweLogo from '../../assets/kepwe-logo.png';
import './LedgerDashboardPage.css';
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
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
  Sparkles,
  Scale,
  Users,
  Server,
  Monitor,
  HeartPulse,
  Activity,
  Shield,
  Layers,
  Info,
  Calendar,
  DollarSign,
  PieChart,
  Target,
  Edit3,
  ArrowRight,
  UploadCloud
} from 'lucide-react';
import {
  fetchLedgerDashboard,
  fetchLedgerAccounts,
  fetchLedgerCategories,
  createLedgerTransaction,
  fetchLedgerProfile,
  updateLedgerProfile
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

// Phase 6: Add / Upload Financial Data
import AddFinancialDataModal from '../../components/ledger/AddFinancialDataModal';
import BringYourFinancialDataView from '../../components/ledger/BringYourFinancialDataView';

// Phase 7: AI CFO & Financial Intelligence
import AiCfoView from '../../components/ledger/AiCfoView';

// Phase 8: Savings Goal Engine
import GoalsView from '../../components/ledger/GoalsView';

// Production Accounting & Compliance Views
import ComplianceCalendarView from '../../components/ledger/ComplianceCalendarView';
import GstCenterView from '../../components/ledger/GstCenterView';
import EInvoiceEWayBillView from '../../components/ledger/EInvoiceEWayBillView';
import TdsCenterView from '../../components/ledger/TdsCenterView';
import PayrollView from '../../components/ledger/PayrollView';
import BankReconciliationView from '../../components/ledger/BankReconciliationView';
import FixedAssetsView from '../../components/ledger/FixedAssetsView';
import JournalsView from '../../components/ledger/JournalsView';
import IntegrationsView from '../../components/ledger/IntegrationsView';
import LedgerConnectionsView from '../../components/ledger/LedgerConnectionsView';
import AuditTrailView from '../../components/ledger/AuditTrailView';

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
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Phase 6: Add Financial Data Modal State
  const [addDataModalOpen, setAddDataModalOpen] = useState(false);

  // Quick Add Universal Modal
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState('expense');
  const [quickAddForm, setQuickAddForm] = useState({
    amount: '',
    category: 'Groceries',
    merchant: '',
    counterparty: '',
    classification: 'Essential',
    isRecurring: false,
    description: '',
    accountId: '',
    paymentMethod: 'UPI',
    referenceNumber: '',
  });
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  // Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState({
    monthlySalary: '',
    freelanceIncome: '',
    businessIncome: '',
    otherIncome: '',
    emergencySavings: '',
    monthlyDebtObligations: '',
    monthlySavingsTarget: '',
    occupation: '',
    city: '',
  });

  // Notification center state
  const [notifOpen, setNotifOpen] = useState(false);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, accRes, catRes, profRes] = await Promise.all([
        fetchLedgerDashboard({ datePreset, chartInterval }),
        fetchLedgerAccounts(),
        fetchLedgerCategories(),
        fetchLedgerProfile(),
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

      if (profRes.ok && profRes.data?.profile) {
        setProfile(profRes.data.profile);
        setProfileForm({
          monthlySalary: profRes.data.profile.monthlySalary || '',
          freelanceIncome: profRes.data.profile.freelanceIncome || '',
          businessIncome: profRes.data.profile.businessIncome || '',
          otherIncome: profRes.data.profile.otherIncome || '',
          emergencySavings: profRes.data.profile.emergencySavings || '',
          monthlyDebtObligations: profRes.data.profile.monthlyDebtObligations || '',
          monthlySavingsTarget: profRes.data.profile.monthlySavingsTarget || '',
          occupation: profRes.data.profile.occupation || '',
          city: profRes.data.profile.city || '',
        });
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
        merchant: quickAddForm.merchant || quickAddForm.counterparty || null,
        counterparty: quickAddForm.counterparty || quickAddForm.merchant || null,
        classification: quickAddForm.classification || 'Essential',
        isRecurring: Boolean(quickAddForm.isRecurring),
        isEssential: quickAddForm.classification === 'Essential',
        description: quickAddForm.description || null,
        accountId: quickAddForm.accountId || accounts[0]?.id || null,
        paymentMethod: quickAddForm.paymentMethod || 'UPI',
        referenceNumber: quickAddForm.referenceNumber || null,
      });

      if (res.ok) {
        setQuickAddOpen(false);
        setQuickAddForm({
          amount: '',
          category: quickAddType === 'income' ? 'Salary' : quickAddType === 'investment' ? 'Mutual Funds' : 'Groceries',
          merchant: '',
          counterparty: '',
          classification: quickAddType === 'income' ? 'Essential' : quickAddType === 'investment' ? 'Financial' : 'Essential',
          isRecurring: false,
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

  // Financial Profile Handler
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    try {
      const res = await updateLedgerProfile({
        monthlySalary: Number(profileForm.monthlySalary) || 0,
        salaryIncome: Number(profileForm.monthlySalary) || 0,
        monthlyIncome: Number(profileForm.monthlySalary) || 0,
        freelanceIncome: Number(profileForm.freelanceIncome) || 0,
        businessIncome: Number(profileForm.businessIncome) || 0,
        otherIncome: Number(profileForm.otherIncome) || 0,
        emergencySavings: Number(profileForm.emergencySavings) || 0,
        monthlyDebtObligations: Number(profileForm.monthlyDebtObligations) || 0,
        monthlySavingsTarget: Number(profileForm.monthlySavingsTarget) || 0,
        occupation: profileForm.occupation || '',
        city: profileForm.city || '',
      });

      if (res.ok) {
        setProfile(res.data.profile);
        setProfileModalOpen(false);
        loadAllData();
      } else {
        setProfileError(res.data?.error || 'Failed to update financial profile.');
      }
    } catch (err) {
      setProfileError(err.message || 'Error updating financial profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const greetingName = authState.user?.name?.split(' ')[0] || 'User';
  const companyName = portalProfile?.company?.name || 'Personal Ledger';
  const overdueAlertCount = (dashboardData?.metrics?.overdueReceivablesCount || 0) + (dashboardData?.metrics?.overduePayablesCount || 0);
  
  // Real Data Check: Never show fake numbers or fake graphs
  const hasFinancialData = Boolean(
    dashboardData?.recentTransactions?.length ||
    accounts.length ||
    (dashboardData?.metrics?.income > 0) ||
    (dashboardData?.metrics?.expenses > 0) ||
    (dashboardData?.metrics?.investments > 0) ||
    (dashboardData?.metrics?.totalIncome > 0) ||
    (dashboardData?.metrics?.totalExpenses > 0)
  );

  return (
    <div className="ledger-layout">
      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
      <aside className={`ledger-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="ledger-sidebar-brand">
          <Link to="/" className="sidebar-logo-link">
            <img 
              src={kepweLogo} 
              alt="KEPWE Logo" 
              className="sidebar-kepwe-logo"
            />
          </Link>
          <div>
            <div className="brand-title">KEPWE LEDGER</div>
            <div className="brand-subtitle">AI PERSONAL CFO</div>
          </div>
        </div>

        {/* Back to Kepwe Main Website */}
        <div className="ledger-back-home-container">
          <Link to="/" className="ledger-back-home-link" title="Return to KEPWE Main Website">
            <ArrowLeft size={15} />
            <span>Back to Kepwe</span>
          </Link>
        </div>

        <nav className="ledger-sidebar-nav">
          <div className="nav-section-label">Personal CFO</div>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'cfo', label: 'AI CFO & Insights', icon: Sparkles },
            { id: 'goals', label: 'Savings Goals', icon: Target },
            { id: 'transactions', label: 'Transactions', icon: Receipt, count: dashboardData?.recentTransactions?.length },
            { id: 'income', label: 'Income', icon: TrendingUp },
            { id: 'expenses', label: 'Expenses', icon: TrendingDown },
            { id: 'accounts', label: 'Accounts', icon: Wallet, count: accounts.length },
            { id: 'reports', label: 'Reports', icon: FileText },
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

          <div className="nav-section-label">Extended Ledger</div>
          {[
            { id: 'receivables', label: 'Receivables & Dues', icon: ArrowDownRight, alertCount: dashboardData?.metrics?.overdueReceivablesCount },
            { id: 'payables', label: 'Payables & EMIs', icon: ArrowUpRight, alertCount: dashboardData?.metrics?.overduePayablesCount },
            { id: 'journals', label: 'General Journals', icon: Scale },
            { id: 'bank_rec', label: 'Statement Reconciliation', icon: Landmark },
            { id: 'connections', label: 'Data Sources (No API)', icon: CreditCard },
            { id: 'audit_trail', label: 'Audit Trail', icon: ShieldCheck },
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
              </button>
            );
          })}
        </nav>

        <div className="ledger-sidebar-footer">
          <div className="user-profile-widget">
            <div className="avatar-circle">
              {authState.user?.avatarUrl ? (
                <img
                  key={authState.user.avatarUrl}
                  src={authState.user.avatarUrl}
                  alt={greetingName}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                greetingName.charAt(0).toUpperCase()
              )}
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
      {sidebarOpen && (
        <button
          type="button"
          className="ledger-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close Ledger navigation"
        />
      )}

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
      <div className="ledger-main-wrapper">
        {/* Topbar */}
        <header className="ledger-topbar">
          <div className="topbar-left">
            <Link to="/" className="ledger-topbar-brand" aria-label="Go to KEPWE home">
              <img src={kepweLogo} alt="KEPWE" />
              <span>KEPWE</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="mobile-menu-toggle"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link to="/" className="ledger-topbar-back-link" title="Return to KEPWE Main Website">
              <ArrowLeft size={14} />
              <span>Back to Kepwe</span>
            </Link>
            <div>
              <div className="topbar-page-title">
                {activeTab === 'dashboard' && 'CFO Command Centre'}
                {activeTab === 'cfo' && 'AI CFO Command & Insights'}
                {activeTab === 'goals' && 'Savings Goals & Wealth Milestones'}
                {activeTab === 'transactions' && 'All Transactions'}
                {activeTab === 'income' && 'Income Streams'}
                {activeTab === 'expenses' && 'Expenses & Outflows'}
                {activeTab === 'receivables' && 'Receivables & Money Owed'}
                {activeTab === 'payables' && 'Bills, EMIs & Payables'}
                {activeTab === 'accounts' && 'Financial Accounts'}
                {activeTab === 'reports' && 'CFO Financial Reports'}
                {activeTab === 'journals' && 'General Ledger Journal'}
                {activeTab === 'bank_rec' && 'Bank Statement Processing'}
                {activeTab === 'connections' && 'Bring Your Financial Data'}
                {activeTab === 'audit_trail' && 'System Audit Trail'}
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
              onClick={() => setProfileModalOpen(true)}
              className="btn-secondary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Set or update your financial profile"
            >
              <Settings size={14} /> Profile
            </button>

            <button
              id="topbar-add-data-btn"
              onClick={() => setAddDataModalOpen(true)}
              className="btn-primary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Bring your financial data: statements, receipts, manual entry"
            >
              <UploadCloud size={15} /> Add Financial Data
            </button>

            <button
              onClick={() => { setQuickAddType('expense'); setQuickAddOpen(true); }}
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
                      All recorded dues and bills are on track.
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
                          ⚠️ {dashboardData.metrics.overdueReceivablesCount} receivable item(s) are overdue.
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
                          ⏳ {dashboardData.metrics.overduePayablesCount} bill/EMI payment(s) are due.
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
                  <span>Computing live financial indicators from database...</span>
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
                  {/* ── 1. DATA FRESHNESS & NO-BANK-API BANNER (PRD SECTION 7, 9, 45) ── */}
                  <div className="data-freshness-banner">
                    <div className="freshness-left">
                      <span className="freshness-badge">
                        <Shield size={13} />
                        No Bank Login Required
                      </span>
                      <span className="freshness-text">
                        Financial data last updated: <strong>{dashboardData?.dataFreshness?.lastUpdatedFormatted || 'Never'}</strong>
                      </span>
                      <span className="freshness-subtext">
                        ({dashboardData?.dataFreshness?.daysSinceLastUpdate !== null 
                          ? `${dashboardData.dataFreshness.daysSinceLastUpdate} days ago` 
                          : 'Awaiting initial records'})
                      </span>
                    </div>
                    <div className="freshness-right">
                      <button
                        id="freshness-add-data-btn"
                        onClick={() => setAddDataModalOpen(true)}
                        className="freshness-btn primary"
                        style={{ background: '#214ECF', color: '#FFFFFF', borderColor: '#214ECF' }}
                        title="Bring your financial data: statements, receipts, manual entry"
                      >
                        <UploadCloud size={14} /> Add Financial Data
                      </button>
                      <button
                        onClick={() => { setQuickAddType('expense'); setQuickAddOpen(true); }}
                        className="freshness-btn"
                        title="Add manual transaction or statement entry"
                      >
                        <Plus size={14} /> Quick Add
                      </button>
                      <button
                        onClick={() => setProfileModalOpen(true)}
                        className="freshness-btn"
                        title="Set or update your monthly financial profile"
                      >
                        <Settings size={14} /> Financial Profile
                      </button>
                    </div>
                  </div>

                  {/* ── 2. COMMAND HEADER & GREETING (PRD SECTION 52) ── */}
                  <div className="cfo-command-header">
                    <div>
                      <h1 className="cfo-greeting-title">Good day, {greetingName}</h1>
                      <p className="cfo-greeting-subtitle">Your Personal CFO Command Centre • India Edition</p>
                    </div>
                    <div className="period-context-badge">
                      <Calendar size={14} color="#214ECF" />
                      <span>Period: {dashboardData?.datePreset?.replace('_', ' ').toUpperCase() || 'THIS MONTH'}</span>
                    </div>
                  </div>

                  {/* ── HONEST NEW USER EMPTY STATE (PRD SECTION 11, 71) ── */}
                  {!hasFinancialData ? (
                    <div className="analysis-card" style={{ padding: '48px 24px', textAlign: 'center', marginBottom: '24px' }}>
                      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(33, 78, 207, 0.1)', color: '#214ECF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                          <Sparkles size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
                          Meet Your AI Personal CFO
                        </h2>
                        <p style={{ fontSize: '0.92rem', color: '#64748B', lineHeight: 1.6, marginBottom: '24px' }}>
                          Kepwe Ledger turns your financial records into actionable decisions that reduce unnecessary expenses and increase savings. 
                          <strong> No bank login, UPI PIN, or direct bank connection is required.</strong> Simply record your income and expenses to unlock your financial health score, spending breakdown, and CFO insights.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <button
                            id="empty-state-add-data-btn"
                            onClick={() => setAddDataModalOpen(true)}
                            className="btn-primary"
                            style={{ padding: '10px 22px' }}
                          >
                            <UploadCloud size={16} /> Add Financial Data
                          </button>
                          <button
                            onClick={() => { setQuickAddType('income'); setQuickAddOpen(true); }}
                            className="btn-secondary"
                            style={{ padding: '10px 22px' }}
                          >
                            <Plus size={16} /> Quick Record Entry
                          </button>
                          <button
                            onClick={() => setProfileModalOpen(true)}
                            className="btn-secondary"
                            style={{ padding: '10px 22px' }}
                          >
                            <Settings size={16} /> Set Monthly Baseline Income
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* ── 3. FINANCIAL HEALTH INDICATOR (PRD SECTION 2, 12, 38) ── */}
                      <div className="financial-health-card">
                        <div className="health-card-header">
                          <div className="health-title-wrap">
                            <HeartPulse size={20} color="#214ECF" />
                            <h3>Financial Health</h3>
                            <span className="product-indicator-pill">Product-Generated Indicator</span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                            Calculated from recorded transactions & profile
                          </span>
                        </div>

                        <div className="health-main-row">
                          {/* Overall Score Dial */}
                          <div className="health-score-dial">
                            {dashboardData?.financialHealth?.score !== null ? (
                              <>
                                <div className="score-number-large font-mono">
                                  {dashboardData.financialHealth.score}
                                  <span className="score-max-text">/100</span>
                                </div>
                                <span className={`score-status-badge ${dashboardData.financialHealth.statusClass}`}>
                                  {dashboardData.financialHealth.status}
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="score-number-large font-mono" style={{ color: '#94A3B8' }}>
                                  —<span className="score-max-text">/100</span>
                                </div>
                                <span className="score-status-badge insufficient">
                                  Awaiting Data
                                </span>
                              </>
                            )}
                          </div>

                          {/* 6 Breakdown Indicators */}
                          <div className="health-breakdown-grid">
                            {/* Savings */}
                            <div className="health-metric-box">
                              <div className="metric-box-top">
                                <span className="metric-box-title">Savings Rate</span>
                                <span className="metric-box-score font-mono">
                                  {dashboardData?.financialHealth?.breakdown?.savings?.score !== null
                                    ? dashboardData.financialHealth.breakdown.savings.score
                                    : '—'}
                                </span>
                              </div>
                              <div className="metric-box-status">
                                {dashboardData?.financialHealth?.breakdown?.savings?.status || 'Awaiting Data'}
                              </div>
                              <div className="metric-box-desc">
                                {dashboardData?.financialHealth?.breakdown?.savings?.desc || 'Recorded savings vs income'}
                              </div>
                            </div>

                            {/* Spending */}
                            <div className="health-metric-box">
                              <div className="metric-box-top">
                                <span className="metric-box-title">Spending Growth</span>
                                <span className="metric-box-score font-mono">
                                  {dashboardData?.financialHealth?.breakdown?.spending?.score !== null
                                    ? dashboardData.financialHealth.breakdown.spending.score
                                    : '—'}
                                </span>
                              </div>
                              <div className="metric-box-status">
                                {dashboardData?.financialHealth?.breakdown?.spending?.status || 'Awaiting Data'}
                              </div>
                              <div className="metric-box-desc">
                                {dashboardData?.financialHealth?.breakdown?.spending?.desc || 'Comparison vs prior period'}
                              </div>
                            </div>

                            {/* Debt */}
                            <div className="health-metric-box">
                              <div className="metric-box-top">
                                <span className="metric-box-title">Debt Burden</span>
                                <span className="metric-box-score font-mono">
                                  {dashboardData?.financialHealth?.breakdown?.debt?.score !== null
                                    ? dashboardData.financialHealth.breakdown.debt.score
                                    : '—'}
                                </span>
                              </div>
                              <div className="metric-box-status">
                                {dashboardData?.financialHealth?.breakdown?.debt?.status || 'Awaiting Data'}
                              </div>
                              <div className="metric-box-desc">
                                {dashboardData?.financialHealth?.breakdown?.debt?.desc || 'EMI/debt vs income'}
                              </div>
                            </div>

                            {/* Emergency */}
                            <div className="health-metric-box">
                              <div className="metric-box-top">
                                <span className="metric-box-title">Emergency Coverage</span>
                                <span className="metric-box-score font-mono">
                                  {dashboardData?.financialHealth?.breakdown?.emergency?.score !== null
                                    ? dashboardData.financialHealth.breakdown.emergency.score
                                    : '—'}
                                </span>
                              </div>
                              <div className="metric-box-status">
                                {dashboardData?.financialHealth?.breakdown?.emergency?.status || 'Awaiting Data'}
                              </div>
                              <div className="metric-box-desc">
                                {dashboardData?.financialHealth?.breakdown?.emergency?.desc || 'Months of essentials covered'}
                              </div>
                            </div>

                            {/* Investing */}
                            <div className="health-metric-box">
                              <div className="metric-box-top">
                                <span className="metric-box-title">Investing Rate</span>
                                <span className="metric-box-score font-mono">
                                  {dashboardData?.financialHealth?.breakdown?.investing?.score !== null
                                    ? dashboardData.financialHealth.breakdown.investing.score
                                    : '—'}
                                </span>
                              </div>
                              <div className="metric-box-status">
                                {dashboardData?.financialHealth?.breakdown?.investing?.status || 'Awaiting Data'}
                              </div>
                              <div className="metric-box-desc">
                                {dashboardData?.financialHealth?.breakdown?.investing?.desc || 'Investment contribution rate'}
                              </div>
                            </div>

                            {/* Consistency */}
                            <div className="health-metric-box">
                              <div className="metric-box-top">
                                <span className="metric-box-title">Consistency</span>
                                <span className="metric-box-score font-mono">
                                  {dashboardData?.financialHealth?.breakdown?.consistency?.score !== null
                                    ? dashboardData.financialHealth.breakdown.consistency.score
                                    : '—'}
                                </span>
                              </div>
                              <div className="metric-box-status">
                                {dashboardData?.financialHealth?.breakdown?.consistency?.status || 'Awaiting Data'}
                              </div>
                              <div className="metric-box-desc">
                                {dashboardData?.financialHealth?.breakdown?.consistency?.desc || 'Regularity of financial records'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Transparency Disclaimer Footnote */}
                        <div className="health-transparency-note">
                          <Info size={14} style={{ flexShrink: 0 }} />
                          <span>
                            {dashboardData?.financialHealth?.explanation ||
                              'Product-generated financial indicator calculated directly from your recorded transactions and profile — not a universal credit or financial standard.'}
                          </span>
                        </div>
                      </div>

                      {/* ── 4. MONTHLY CFO SNAPSHOT: 6-CARD GRID (PRD SECTION 3, 4, 13) ── */}
                      <div className="monthly-cfo-grid">
                        {/* 1. Income */}
                        <div className="cfo-snapshot-card">
                          <div className="cfo-card-top">
                            <span className="cfo-card-label">Income</span>
                            <div className="cfo-card-icon green">
                              <TrendingUp size={16} />
                            </div>
                          </div>
                          <div className="cfo-card-value font-mono green">
                            {fmtCurrency(dashboardData?.metrics?.income)}
                          </div>
                          <div className="cfo-card-footer">
                            <span>Recorded Inflows</span>
                            <span style={{ color: '#059669', fontWeight: 700 }}>Inflows</span>
                          </div>
                        </div>

                        {/* 2. Expenses */}
                        <div className="cfo-snapshot-card">
                          <div className="cfo-card-top">
                            <span className="cfo-card-label">Spent / Outflows</span>
                            <div className="cfo-card-icon red">
                              <TrendingDown size={16} />
                            </div>
                          </div>
                          <div className="cfo-card-value font-mono">
                            {fmtCurrency(dashboardData?.metrics?.expenses)}
                          </div>
                          <div className="cfo-card-footer">
                            <span>Recorded Outflows</span>
                            <span>Spending</span>
                          </div>
                        </div>

                        {/* 3. Savings */}
                        <div className="cfo-snapshot-card primary-highlight">
                          <div className="cfo-card-top">
                            <span className="cfo-card-label">Savings</span>
                            <div className="cfo-card-icon blue">
                              <PiggyBank size={16} />
                            </div>
                          </div>
                          <div className={`cfo-card-value font-mono ${(dashboardData?.metrics?.savings || 0) >= 0 ? 'blue' : 'text-red'}`}>
                            {fmtCurrency(dashboardData?.metrics?.savings)}
                          </div>
                          <div className="cfo-card-footer">
                            <span>Income − Expenses</span>
                            <span style={{ color: '#214ECF', fontWeight: 700 }}>Retained Cash</span>
                          </div>
                        </div>

                        {/* 4. Savings Rate */}
                        <div className="cfo-snapshot-card">
                          <div className="cfo-card-top">
                            <span className="cfo-card-label">Savings Rate</span>
                            <div className="cfo-card-icon purple">
                              <HeartPulse size={16} />
                            </div>
                          </div>
                          <div className="cfo-card-value font-mono">
                            {dashboardData?.metrics?.savingsRate !== null
                              ? `${dashboardData.metrics.savingsRate}%`
                              : '—'}
                          </div>
                          <div className="rate-progress-bar">
                            <div
                              className="rate-progress-fill"
                              style={{ width: `${Math.min(100, Math.max(0, dashboardData?.metrics?.savingsRate || 0))}%` }}
                            />
                          </div>
                          <div className="cfo-card-footer">
                            <span>Target: 20%+</span>
                            <span>{dashboardData?.metrics?.savingsRate >= 20 ? 'Optimal' : 'Needs Focus'}</span>
                          </div>
                        </div>

                        {/* 5. Investments */}
                        <div className="cfo-snapshot-card">
                          <div className="cfo-card-top">
                            <span className="cfo-card-label">Investments</span>
                            <div className="cfo-card-icon amber">
                              <Layers size={16} />
                            </div>
                          </div>
                          <div className="cfo-card-value font-mono">
                            {fmtCurrency(dashboardData?.metrics?.investments)}
                          </div>
                          <div className="cfo-card-footer">
                            <span>Wealth Building</span>
                            <span>{dashboardData?.metrics?.investmentRate ? `${dashboardData.metrics.investmentRate}% of income` : 'Systematic'}</span>
                          </div>
                        </div>

                        {/* 6. Available Surplus */}
                        <div className="cfo-snapshot-card">
                          <div className="cfo-card-top">
                            <span className="cfo-card-label">Available Surplus</span>
                            <div className="cfo-card-icon teal">
                              <Wallet size={16} />
                            </div>
                          </div>
                          <div className={`cfo-card-value font-mono ${(dashboardData?.metrics?.available || 0) >= 0 ? '' : 'text-red'}`}>
                            {fmtCurrency(dashboardData?.metrics?.available)}
                          </div>
                          <div className="cfo-card-footer">
                            <span>Unallocated Cash</span>
                            <span style={{ color: '#0D9488', fontWeight: 700 }}>Surplus</span>
                          </div>
                        </div>
                      </div>

                      {/* ── 5. AI CFO INSIGHT AREA (PRD SECTION 6, 13, 18, 49) ── */}
                      {dashboardData?.cfoInsight && (
                        <div className="ai-cfo-insight-panel">
                          <div className="cfo-insight-header">
                            <span className="cfo-insight-badge">
                              <Sparkles size={14} />
                              AI Personal CFO Insight
                            </span>
                            <span className="cfo-data-backed-tag">
                              <CheckCircle2 size={13} />
                              Data-Backed Analysis
                            </span>
                          </div>

                          <h3 className="cfo-insight-headline">{dashboardData.cfoInsight.headline}</h3>
                          <p className="cfo-insight-message">{dashboardData.cfoInsight.message}</p>

                          {dashboardData.cfoInsight.findings && dashboardData.cfoInsight.findings.length > 0 && (
                            <div className="cfo-findings-list">
                              {dashboardData.cfoInsight.findings.map((f, i) => (
                                <div key={i} className="cfo-finding-pill">
                                  <span>•</span>
                                  <span>{f}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {dashboardData.cfoInsight.action && (
                            <button
                              onClick={() => {
                                const actionObj = typeof dashboardData.cfoInsight.action === 'object' ? dashboardData.cfoInsight.action : {};
                                const targetTab = actionObj.tab || 'expenses';
                                const label = actionObj.label || String(dashboardData.cfoInsight.action || '');
                                if (targetTab === 'upload' || label.toLowerCase().includes('upload') || label.toLowerCase().includes('data')) {
                                  setAddDataModalOpen(true);
                                } else {
                                  setActiveTab(targetTab === 'upload' ? 'transactions' : targetTab);
                                }
                              }}
                              className="cfo-action-btn"
                            >
                              <span>
                                {typeof dashboardData.cfoInsight.action === 'object'
                                  ? dashboardData.cfoInsight.action.label
                                  : dashboardData.cfoInsight.action}
                              </span>
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* ── 6. TWO-COLUMN ANALYSIS: SPENDING & FIXED VS VARIABLE (PRD SECTION 14, 28) ── */}
                      <div className="dashboard-analysis-grid">
                        {/* Column 1: Spending Overview (4 Classifications & Top Categories) */}
                        <div className="analysis-card">
                          <div>
                            <div className="analysis-card-header">
                              <div>
                                <h3 className="analysis-title">Spending Breakdown</h3>
                                <span className="analysis-subtitle">
                                  4-Way Classification (Total: {fmtCurrency(dashboardData?.spendingOverview?.total)})
                                </span>
                              </div>
                              <PieChart size={18} color="#214ECF" />
                            </div>

                            {/* 4 Classification Boxes */}
                            <div className="classification-grid">
                              {/* Essential */}
                              <div className="classification-box essential">
                                <div className="class-box-header">
                                  <span className="class-box-name">Essential</span>
                                  <span className="class-box-pct">
                                    {dashboardData?.spendingOverview?.classifications?.essential?.pct || 0}%
                                  </span>
                                </div>
                                <div className="class-box-amount font-mono">
                                  {fmtCurrency(dashboardData?.spendingOverview?.classifications?.essential?.amount)}
                                </div>
                                <div className="class-box-count">
                                  {dashboardData?.spendingOverview?.classifications?.essential?.count || 0} transaction(s)
                                </div>
                              </div>

                              {/* Lifestyle */}
                              <div className="classification-box lifestyle">
                                <div className="class-box-header">
                                  <span className="class-box-name">Lifestyle</span>
                                  <span className="class-box-pct">
                                    {dashboardData?.spendingOverview?.classifications?.lifestyle?.pct || 0}%
                                  </span>
                                </div>
                                <div className="class-box-amount font-mono">
                                  {fmtCurrency(dashboardData?.spendingOverview?.classifications?.lifestyle?.amount)}
                                </div>
                                <div className="class-box-count">
                                  {dashboardData?.spendingOverview?.classifications?.lifestyle?.count || 0} transaction(s)
                                </div>
                              </div>

                              {/* Financial */}
                              <div className="classification-box financial">
                                <div className="class-box-header">
                                  <span className="class-box-name">Financial</span>
                                  <span className="class-box-pct">
                                    {dashboardData?.spendingOverview?.classifications?.financial?.pct || 0}%
                                  </span>
                                </div>
                                <div className="class-box-amount font-mono">
                                  {fmtCurrency(dashboardData?.spendingOverview?.classifications?.financial?.amount)}
                                </div>
                                <div className="class-box-count">
                                  {dashboardData?.spendingOverview?.classifications?.financial?.count || 0} transaction(s)
                                </div>
                              </div>

                              {/* Other */}
                              <div className="classification-box other">
                                <div className="class-box-header">
                                  <span className="class-box-name">Other</span>
                                  <span className="class-box-pct">
                                    {dashboardData?.spendingOverview?.classifications?.other?.pct || 0}%
                                  </span>
                                </div>
                                <div className="class-box-amount font-mono">
                                  {fmtCurrency(dashboardData?.spendingOverview?.classifications?.other?.amount)}
                                </div>
                                <div className="class-box-count">
                                  {dashboardData?.spendingOverview?.classifications?.other?.count || 0} transaction(s)
                                </div>
                              </div>
                            </div>

                            {/* Top 5 Categories Progress Bars */}
                            <div className="top-cats-list">
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Top Expense Categories
                              </span>
                              {dashboardData?.spendingOverview?.topCategories?.length > 0 ? (
                                dashboardData.spendingOverview.topCategories.map((c, i) => (
                                  <div key={i} className="cat-progress-item">
                                    <div className="cat-progress-row">
                                      <div className="cat-name-badge">
                                        <span>{c.name}</span>
                                        <span className="cat-class-tag">{c.classification}</span>
                                      </div>
                                      <span className="font-mono font-bold" style={{ fontSize: '0.8rem' }}>
                                        {fmtCurrency(c.amount)} ({c.pct}%)
                                      </span>
                                    </div>
                                    <div className="cat-progress-track">
                                      <div className="cat-progress-bar" style={{ width: `${Math.min(100, c.pct)}%` }} />
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div style={{ fontSize: '0.8rem', color: '#94A3B8', padding: '8px 0' }}>
                                  No categorized expenses in this period.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Column 2: Fixed vs Variable Financial View */}
                        <div className="analysis-card">
                          <div>
                            <div className="analysis-card-header">
                              <div>
                                <h3 className="analysis-title">Fixed vs Variable View</h3>
                                <span className="analysis-subtitle">
                                  Committed obligations vs controllable discretionary funds
                                </span>
                              </div>
                              <Target size={18} color="#214ECF" />
                            </div>

                            {/* Stacked Proportional Bar */}
                            <div className="fixed-var-visual-bar">
                              <div
                                className="stacked-segment fixed"
                                style={{ width: `${dashboardData?.fixedVsVariable?.fixed?.pct || 0}%` }}
                                title={`Fixed: ${dashboardData?.fixedVsVariable?.fixed?.pct}%`}
                              />
                              <div
                                className="stacked-segment variable"
                                style={{ width: `${dashboardData?.fixedVsVariable?.variable?.pct || 0}%` }}
                                title={`Variable: ${dashboardData?.fixedVsVariable?.variable?.pct}%`}
                              />
                              <div
                                className="stacked-segment savings"
                                style={{ width: `${dashboardData?.fixedVsVariable?.savings?.pct || 0}%` }}
                                title={`Savings: ${dashboardData?.fixedVsVariable?.savings?.pct}%`}
                              />
                              <div
                                className="stacked-segment investments"
                                style={{ width: `${dashboardData?.fixedVsVariable?.investments?.pct || 0}%` }}
                                title={`Investments: ${dashboardData?.fixedVsVariable?.investments?.pct}%`}
                              />
                            </div>

                            {/* 4 Legend / Amount Cards */}
                            <div className="fixed-var-legend">
                              <div className="legend-card-item">
                                <div className="legend-square fixed" />
                                <div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>FIXED COMMITMENTS</div>
                                  <div className="font-mono font-bold" style={{ fontSize: '0.95rem' }}>
                                    {fmtCurrency(dashboardData?.fixedVsVariable?.fixed?.amount)}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                                    {dashboardData?.fixedVsVariable?.fixed?.pct}% of recorded total
                                  </div>
                                </div>
                              </div>

                              <div className="legend-card-item">
                                <div className="legend-square variable" />
                                <div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>VARIABLE / LIFESTYLE</div>
                                  <div className="font-mono font-bold" style={{ fontSize: '0.95rem' }}>
                                    {fmtCurrency(dashboardData?.fixedVsVariable?.variable?.amount)}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                                    {dashboardData?.fixedVsVariable?.variable?.pct}% of recorded total
                                  </div>
                                </div>
                              </div>

                              <div className="legend-card-item">
                                <div className="legend-square savings" />
                                <div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>SAVINGS SURPLUS</div>
                                  <div className="font-mono font-bold" style={{ fontSize: '0.95rem', color: '#059669' }}>
                                    {fmtCurrency(dashboardData?.fixedVsVariable?.savings?.amount)}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                                    {dashboardData?.fixedVsVariable?.savings?.pct}% retained
                                  </div>
                                </div>
                              </div>

                              <div className="legend-card-item">
                                <div className="legend-square investments" />
                                <div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>INVESTMENTS</div>
                                  <div className="font-mono font-bold" style={{ fontSize: '0.95rem', color: '#2563EB' }}>
                                    {fmtCurrency(dashboardData?.fixedVsVariable?.investments?.amount)}
                                  </div>
                                  <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                                    {dashboardData?.fixedVsVariable?.investments?.pct}% wealth building
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: '16px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.75rem', color: '#64748B' }}>
                            💡 <strong>CFO Rule:</strong> Fixed expenses cannot easily be reduced mid-month. To increase savings, concentrate on controllable Variable (Lifestyle) spending.
                          </div>
                        </div>
                      </div>

                      {/* ── 7. RECENT REAL TRANSACTIONS & FINANCIAL ACCOUNTS (PRD SECTION 9, 41, 43) ── */}
                      <div className="ledger-table-card" style={{ marginBottom: '24px' }}>
                        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--ledger-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>Recent Real Transactions</h3>
                            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Latest financial entries recorded in your personal ledger</span>
                          </div>
                          <button onClick={() => setActiveTab('transactions')} className="btn-secondary small">
                            View All Transactions →
                          </button>
                        </div>

                        {(!dashboardData?.recentTransactions || dashboardData.recentTransactions.length === 0) ? (
                          <div className="ledger-empty-state" style={{ padding: '36px 20px' }}>
                            <Receipt size={36} className="empty-icon" />
                            <h3>No transactions recorded yet</h3>
                            <p>Record your first transaction or statement upload to begin tracking live cash flows.</p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
                              <button onClick={() => setAddDataModalOpen(true)} className="btn-primary">
                                <UploadCloud size={16} /> Add Financial Data
                              </button>
                              <button onClick={() => { setQuickAddType('expense'); setQuickAddOpen(true); }} className="btn-secondary">
                                <Plus size={16} /> Quick Add
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <table className="ledger-data-table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Type</th>
                                  <th>Merchant / Description</th>
                                  <th>Category</th>
                                  <th>Classification</th>
                                  <th>Account / Method</th>
                                  <th>Amount</th>
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
                                      <span className="tx-party-name">{tx.merchant || tx.counterparty || '—'}</span>
                                      {tx.description && <div className="tx-sub-desc">{tx.description}</div>}
                                    </td>
                                    <td>
                                      <span className="tx-cat-badge">{tx.category}</span>
                                    </td>
                                    <td>
                                      <span className={`cat-class-tag ${tx.classification?.toLowerCase()}`}>
                                        {tx.classification || 'Essential'}
                                      </span>
                                      {tx.isRecurring && (
                                        <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#2563EB', fontWeight: 700 }}>
                                          ↻ Recurring
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <div className="tx-acc-cell">
                                        <Wallet size={12} className="cell-icon" />
                                        <span>{tx.accountName || tx.paymentMethod || 'Manual'}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <span className={`font-mono font-bold ${tx.type === 'income' ? 'text-green' : tx.type === 'investment' ? 'text-blue' : 'text-navy'}`}>
                                        {tx.type === 'income' ? '+' : '-'}{fmtCurrency(tx.amount)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Financial Accounts Quick Snapshot */}
                      <div className="accounts-widget-card" style={{ marginBottom: '24px' }}>
                        <div className="widget-header">
                          <div>
                            <span className="widget-title">Financial Accounts & Liquid Funds</span>
                            <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Real recorded bank and wallet balances</div>
                          </div>
                          <button onClick={() => setActiveTab('accounts')} className="btn-secondary small">
                            Manage Accounts
                          </button>
                        </div>

                        <div className="accounts-mini-list">
                          {accounts.slice(0, 4).map((acc) => (
                            <div key={acc.id} className="account-mini-item">
                              <div className="acc-mini-left">
                                <Wallet size={16} color="#214ECF" />
                                <div>
                                  <div className="acc-mini-name">{acc.name}</div>
                                  <div className="acc-mini-type">{acc.type} • {acc.institution || 'Direct'}</div>
                                </div>
                              </div>
                              <div className="acc-mini-bal font-mono">{fmtCurrency(acc.currentBalance)}</div>
                            </div>
                          ))}

                          {accounts.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '0.82rem' }}>
                              No accounts recorded yet. Click to add your bank/wallet balances.
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB: AI CFO & INSIGHTS (PHASE 7) */}
          {activeTab === 'cfo' && (
            <AiCfoView
              onOpenUploadModal={() => setAddDataModalOpen(true)}
              onOpenProfileModal={() => setProfileModalOpen(true)}
            />
          )}

          {/* TAB: GOALS (PHASE 8) */}
          {activeTab === 'goals' && (
            <GoalsView onOpenUploadModal={() => setAddDataModalOpen(true)} />
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
            <ReportsView
              onNavigateTab={(tab) => {
                if (tab === 'upload') setAddDataModalOpen(true);
                else setActiveTab(tab);
              }}
            />
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <SettingsView
              accounts={accounts}
              onMutationSuccess={loadAllData}
            />
          )}

          {/* TAB: COMPLIANCE */}
          {activeTab === 'compliance' && (
            <ComplianceCalendarView />
          )}

          {/* TAB: GST CENTER */}
          {activeTab === 'gst_center' && (
            <GstCenterView />
          )}

          {/* TAB: E-INVOICE & E-WAY BILL */}
          {activeTab === 'einvoice_ewb' && (
            <EInvoiceEWayBillView />
          )}

          {/* TAB: TDS CENTER */}
          {activeTab === 'tds_center' && (
            <TdsCenterView />
          )}

          {/* TAB: JOURNALS */}
          {activeTab === 'journals' && (
            <JournalsView />
          )}

          {/* TAB: PAYROLL */}
          {activeTab === 'payroll' && (
            <PayrollView />
          )}

          {/* TAB: BANK RECONCILIATION */}
          {activeTab === 'bank_rec' && (
            <BankReconciliationView />
          )}

          {/* TAB: FIXED ASSETS */}
          {activeTab === 'fixed_assets' && (
            <FixedAssetsView />
          )}

          {/* TAB: INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <IntegrationsView />
          )}
          {activeTab === 'connections' && (
            <BringYourFinancialDataView onOpenUploadModal={() => setAddDataModalOpen(true)} />
          )}

          {/* TAB: AUDIT TRAIL */}
          {activeTab === 'audit_trail' && (
            <AuditTrailView />
          )}
        </main>
      </div>

      {/* ── QUICK ADD TRANSACTION MODAL ───────────────────────────────────── */}
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
                        category: t === 'income' ? 'Salary' : t === 'investment' ? 'Mutual Funds' : 'Groceries',
                        classification: t === 'income' ? 'Essential' : t === 'investment' ? 'Financial' : 'Essential',
                      }));
                    }}
                    className="form-input"
                  >
                    <option value="income">Income (+ Inflow)</option>
                    <option value="expense">Expense (- Outflow)</option>
                    <option value="investment">Investment (Systematic)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 5000"
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
                    onChange={(e) => {
                      const catName = e.target.value;
                      // Auto-sync classification for lifestyle/essential
                      let cls = quickAddForm.classification;
                      if (['Food Delivery', 'Restaurants', 'Shopping', 'Entertainment', 'OTT Subscriptions', 'Travel'].includes(catName)) {
                        cls = 'Lifestyle';
                      } else if (['Groceries', 'Rent', 'Electricity', 'Water', 'Medical', 'Education', 'Salary'].includes(catName)) {
                        cls = 'Essential';
                      } else if (['EMI', 'Loan Repayment', 'Mutual Funds', 'Stocks & SIP', 'Insurance'].includes(catName)) {
                        cls = 'Financial';
                      }
                      setQuickAddForm({ ...quickAddForm, category: catName, classification: cls });
                    }}
                    className="form-input"
                  >
                    {categories
                      .filter((c) => c.type === (quickAddType === 'investment' ? 'expense' : quickAddType) || c.type === quickAddType)
                      .map((c) => (
                        <option key={c.id || c.name} value={c.name}>{c.name}</option>
                      ))}
                    {categories.length === 0 && <option value="General">General</option>}
                  </select>
                </div>
                <div>
                  <label className="form-label">Classification (PRD)</label>
                  <select
                    value={quickAddForm.classification}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, classification: e.target.value })}
                    className="form-input"
                  >
                    <option value="Essential">Essential (Need)</option>
                    <option value="Lifestyle">Lifestyle (Discretionary / Want)</option>
                    <option value="Financial">Financial (Debt / Investment)</option>
                    <option value="Other">Other (Transfers / Misc)</option>
                  </select>
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Merchant / Payee Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Swiggy, Amazon, Reliance Fresh, Salary"
                    value={quickAddForm.merchant}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, merchant: e.target.value, counterparty: e.target.value })}
                    className="form-input"
                  />
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
                  <label className="form-label">Payment Method</label>
                  <select
                    value={quickAddForm.paymentMethod}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, paymentMethod: e.target.value })}
                    className="form-input"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={quickAddForm.isRecurring}
                      onChange={(e) => setQuickAddForm({ ...quickAddForm, isRecurring: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: '#214ECF' }}
                    />
                    <span>Recurring monthly commitment (Fixed)</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly grocery run or weekend dinner"
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

      {/* ── FINANCIAL PROFILE MODAL (PRD SECTION 11, 38) ─────────────────── */}
      {profileModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Financial Profile & Objectives</h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Used by your AI CFO to calculate debt burden, emergency coverage, and savings targets
                </span>
              </div>
              <button onClick={() => setProfileModalOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleProfileSubmit} className="modal-form">
              {profileError && <div className="modal-alert error">{profileError}</div>}

              <div className="profile-modal-grid">
                <div>
                  <label className="form-label">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 80000"
                    value={profileForm.monthlySalary}
                    onChange={(e) => setProfileForm({ ...profileForm, monthlySalary: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="form-label">Freelance / Other Income (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 20000"
                    value={profileForm.otherIncome}
                    onChange={(e) => setProfileForm({ ...profileForm, otherIncome: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="profile-modal-grid">
                <div>
                  <label className="form-label">Total Emergency Savings (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 150000"
                    value={profileForm.emergencySavings}
                    onChange={(e) => setProfileForm({ ...profileForm, emergencySavings: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="form-label">Monthly Debt Obligations / EMIs (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 15000"
                    value={profileForm.monthlyDebtObligations}
                    onChange={(e) => setProfileForm({ ...profileForm, monthlyDebtObligations: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="profile-modal-grid">
                <div>
                  <label className="form-label">Monthly Savings Target (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 25000"
                    value={profileForm.monthlySavingsTarget}
                    onChange={(e) => setProfileForm({ ...profileForm, monthlySavingsTarget: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Bengaluru, Mumbai"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Occupation</label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer, Designer, Business Owner"
                  value={profileForm.occupation}
                  onChange={(e) => setProfileForm({ ...profileForm, occupation: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setProfileModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={profileSaving} className="btn-primary">
                  {profileSaving ? 'Saving Profile…' : 'Save Financial Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PHASE 6: ADD / UPLOAD FINANCIAL DATA MODAL ─────────────────────── */}
      <AddFinancialDataModal
        isOpen={addDataModalOpen}
        onClose={() => setAddDataModalOpen(false)}
        accounts={accounts}
        onSuccess={loadAllData}
      />
    </div>
  );
}
