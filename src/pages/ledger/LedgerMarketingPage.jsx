import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Layers,
  Lock,
  MessageSquare,
  PieChart,
  Receipt,
  RotateCcw,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import './LedgerMarketingPage.css';

// ─── 04. Core Features Pillars ───────────────────────────────────────────────
const CORE_FEATURES = [
  {
    title: 'Smart Command Dashboard',
    desc: 'Real-time bird’s-eye view of your complete net worth, liquidity, incoming receivables, and outgoing payables in one unified interface.',
    icon: BarChart3,
    badge: 'Real-Time Insights',
  },
  {
    title: 'Income & Expense Tracking',
    desc: 'Record cash, UPI, bank transfers, and card transactions in under 30 seconds with automatic category tagging and recurring expense detection.',
    icon: Wallet,
    badge: 'Automated Tagging',
  },
  {
    title: 'Receivables Management',
    desc: 'Generate professional GST-compliant invoices, track overdue client payments, and send 1-click automated payment links with aging analytics.',
    icon: TrendingUp,
    badge: 'Faster Collections',
  },
  {
    title: 'Payables & Vendor Ledger',
    desc: 'Schedule supplier invoices, prevent duplicate payments, track vendor dues, and plan your cash outflows without late fee penalties.',
    icon: TrendingDown,
    badge: 'Vendor Control',
  },
  {
    title: 'Instant Financial Reports',
    desc: 'Generate Profit & Loss, Balance Sheets, Cash Flow statements, and GST-ready GSTR-1/3B summaries with a single export click.',
    icon: FileText,
    badge: '1-Click Export',
  },
  {
    title: 'Smart Payment Reminders',
    desc: 'Automate polite payment reminders via WhatsApp, SMS, and Email to recover receivables up to 40% faster without awkward manual follow-ups.',
    icon: Bell,
    badge: 'Zero Awkwardness',
  },
  {
    title: 'Secure Document Vault',
    desc: 'Store tax invoices, purchase receipts, utility bills, and bank statements in an organized, searchable cloud vault backed by 256-bit AES encryption.',
    icon: Lock,
    badge: 'Audit-Ready',
  },
];

// ─── 05. The 4-Stage Financial Loop ──────────────────────────────────────────
const LOOP_STAGES = [
  {
    stage: '01',
    name: 'Record',
    sub: 'Frictionless Logging',
    desc: 'Log receipts, customer sales, vendor bills, and daily payouts in seconds. Import statements or scan bills directly.',
    icon: Receipt,
  },
  {
    stage: '02',
    name: 'Track',
    sub: 'Real-Time Visibility',
    desc: 'Observe live cash positions, track unpaid invoices, monitor budget burn rates, and review customer balances continuously.',
    icon: Clock3,
  },
  {
    stage: '03',
    name: 'Analyse',
    sub: 'Actionable Intelligence',
    desc: 'Understand profit margins, top expense drivers, seasonal revenue trends, and working capital requirements automatically.',
    icon: PieChart,
  },
  {
    stage: '04',
    name: 'Act',
    sub: 'Strategic Execution',
    desc: 'Automate collection follow-ups, schedule supplier payouts, optimize taxes, and access instant credit when expansion calls.',
    icon: Zap,
  },
];

// ─── 12. FAQs ────────────────────────────────────────────────────────────────
const LEDGER_FAQS = [
  {
    q: 'How is KEPWE Ledger different from traditional accounting software?',
    a: 'Traditional accounting tools are built with complex double-entry debit/credit jargon meant for accountants. KEPWE Ledger is a complete Financial Command Center built for founders, business owners, professionals, and individuals. It automates categorization, provides real-time cash flow intelligence, sends automated WhatsApp payment reminders, and connects directly with KEPWE Credit for instant working capital.',
  },
  {
    q: 'Can I use KEPWE Ledger for both personal finances and business accounting?',
    a: 'Yes. KEPWE Ledger features dedicated workspace modes for Individuals (tracking salary, freelance income, household expenses, EMIs, and personal cash flow) and Businesses (customer invoicing, vendor ledgers, receivables aging, GST reconciliation, and P&L statements).',
  },
  {
    q: 'How do I import existing data from Excel or Tally?',
    a: 'You can seamlessly import your transaction history, vendor lists, customer records, and item catalogs via standard CSV/Excel templates. Our team and automated onboarding wizards help you migrate without losing historical records.',
  },
  {
    q: 'Is my financial data safe and private?',
    a: 'Absolutely. KEPWE enforces bank-grade 256-bit AES encryption at rest and TLS 1.3 in transit. We never sell, share, or monetize your financial data. Your records are private, organized, and backed up with automated daily cloud redundancy.',
  },
  {
    q: 'Can my Chartered Accountant or accountant access my books?',
    a: 'Yes. You can invite your CA or finance team with customizable role-based permissions (Viewer, Accountant, or Admin). They can review reports, reconcile GST entries, and export audit-ready statements in real time without passing spreadsheets back and forth.',
  },
  {
    q: 'How does KEPWE Ledger connect with KEPWE Credit?',
    a: 'When your business needs working capital or inventory financing, your verified KEPWE Ledger transaction history allows our regulated lending partners to assess creditworthiness instantly with zero physical paperwork.',
  },
];

export default function LedgerMarketingPage() {
  const navigate = useNavigate();
  const { authState } = useApp();

  // Interactive State
  const [dashboardMode, setDashboardMode] = useState('business');
  const [activeLoopStage, setActiveLoopStage] = useState('01');
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleExploreLedger = () => {
    if (authState.isLoggedIn) {
      navigate('/dashboard');
      return;
    }

    navigate('/login?returnTo=%2Fdashboard');
  };

  return (
    <div className="ledger-marketing-root">
      
      {/* ─── 01. HERO SECTION ───────────────────────────────────────────────── */}
      <section className="ledger-hero-section">
        <div className="ledger-hero-mesh" aria-hidden="true" />

        <div className="ledger-container">
          <div className="ledger-hero-grid">
            
            {/* Left Content */}
            <div className="ledger-hero-content">
              <div className="ledger-eyebrow">
                <span className="eyebrow-dot" />
                <span>YOUR FINANCIAL COMMAND CENTER</span>
              </div>

              <h1 className="ledger-hero-title">
                Know Your Money. <br />
                <span className="ledger-gradient-text">Control Your Business.</span>
              </h1>

              <p className="ledger-hero-subhead">
                Kepwe Ledger brings your income, expenses, receivables, payables, and financial records into one simple, powerful platform. Built for individuals, professionals, small businesses, and growing enterprises.
              </p>

              <div className="ledger-hero-actions">
                <Link to="/signup" className="ledger-btn-primary">
                  <span>Start Free</span>
                  <ArrowRight size={17} />
                </Link>
                <button type="button" onClick={handleExploreLedger} className="ledger-btn-secondary">
                  <span>Explore Kepwe Ledger</span>
                  <ChevronDown size={16} />
                </button>
              </div>

              <div className="ledger-hero-trust-row">
                <div className="trust-item">
                  <CheckCircle2 size={16} className="trust-icon" />
                  <span>No Credit Card Required</span>
                </div>
                <div className="trust-item">
                  <CheckCircle2 size={16} className="trust-icon" />
                  <span>Bank-Grade 256-Bit Security</span>
                </div>
                <div className="trust-item">
                  <CheckCircle2 size={16} className="trust-icon" />
                  <span>GST & Tax Ready</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Command Center Preview */}
            <div className="ledger-hero-visual-col" id="command-center">
              <div className="ledger-command-card">
                
                {/* Mode Selector Topbar */}
                <div className="command-card-topbar">
                  <div className="command-title-group">
                    <BookOpen size={16} className="text-blue" />
                    <span>KEPWE LEDGER · COMMAND CENTER</span>
                  </div>
                  <div className="command-mode-toggle">
                    <button
                      className={`mode-btn ${dashboardMode === 'business' ? 'active' : ''}`}
                      onClick={() => setDashboardMode('business')}
                    >
                      Business Mode
                    </button>
                    <button
                      className={`mode-btn ${dashboardMode === 'individual' ? 'active' : ''}`}
                      onClick={() => setDashboardMode('individual')}
                    >
                      Personal Mode
                    </button>
                  </div>
                </div>

                {/* Dashboard Metrics Grid */}
                <div className="command-body">
                  
                  {dashboardMode === 'business' ? (
                    <>
                      {/* 4 Key KPI Boxes */}
                      <div className="command-kpi-grid">
                        <div className="c-kpi-box">
                          <span className="kpi-label">TOTAL REVENUE (MTD)</span>
                          <span className="kpi-val text-green font-mono">₹14,82,500</span>
                          <span className="kpi-trend positive"><TrendingUp size={12} /> +18.4% vs last month</span>
                        </div>
                        <div className="c-kpi-box">
                          <span className="kpi-label">TOTAL EXPENSES</span>
                          <span className="kpi-val font-mono">₹8,34,200</span>
                          <span className="kpi-sub">56.2% Operating Margin</span>
                        </div>
                        <div className="c-kpi-box highlight">
                          <span className="kpi-label">NET CASH POSITION</span>
                          <span className="kpi-val text-blue font-mono">+₹6,48,300</span>
                          <span className="kpi-trend positive">Healthy Runway</span>
                        </div>
                        <div className="c-kpi-box">
                          <span className="kpi-label">PENDING RECEIVABLES</span>
                          <span className="kpi-val font-mono">₹3,20,000</span>
                          <span className="kpi-sub">4 Invoices Due (Aging &lt; 15d)</span>
                        </div>
                      </div>

                      {/* Cashflow Graphic Preview */}
                      <div className="command-chart-box">
                        <div className="chart-meta-row">
                          <span className="chart-heading">Cash Inflow vs Outflow (Last 6 Months)</span>
                          <span className="chart-badge">Automated Reconciliation</span>
                        </div>
                        <svg className="command-chart-svg" viewBox="0 0 460 70" preserveAspectRatio="none">
                          <polyline
                            fill="none"
                            stroke="#E2E8F0"
                            strokeWidth="2"
                            points="0,60 80,50 160,55 240,45 320,40 400,35 460,30"
                          />
                          <polyline
                            fill="none"
                            stroke="#214ECF"
                            strokeWidth="3"
                            points="0,50 80,42 160,35 240,28 320,20 400,15 460,8"
                          />
                        </svg>
                      </div>

                      {/* Recent Transaction Log Preview */}
                      <div className="command-transactions">
                        <div className="tx-header">Recent Business Activity</div>
                        <div className="tx-row">
                          <span className="tx-cat-badge blue">RECEIVABLE</span>
                          <span className="tx-desc">Invoice #INV-2026-88 · Apex Digital Media</span>
                          <span className="tx-amt text-green font-mono">+₹1,45,000</span>
                          <span className="tx-badge verified">RECEIVED</span>
                        </div>
                        <div className="tx-row">
                          <span className="tx-cat-badge gray">EXPENSE</span>
                          <span className="tx-desc">AWS Cloud Infrastructure & Hosting</span>
                          <span className="tx-amt font-mono">-₹24,800</span>
                          <span className="tx-badge auto">AUTO-PAID</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Individual / Personal Mode */}
                      <div className="command-kpi-grid">
                        <div className="c-kpi-box">
                          <span className="kpi-label">TOTAL MONTHLY INCOME</span>
                          <span className="kpi-val text-green font-mono">₹2,85,000</span>
                          <span className="kpi-sub">Salary + Consulting</span>
                        </div>
                        <div className="c-kpi-box">
                          <span className="kpi-label">LIVING & DAILY EXPENSES</span>
                          <span className="kpi-val font-mono">₹92,400</span>
                          <span className="kpi-trend positive">Within Budget (68%)</span>
                        </div>
                        <div className="c-kpi-box highlight">
                          <span className="kpi-label">NET MONTHLY SAVINGS</span>
                          <span className="kpi-val text-blue font-mono">+₹1,92,600</span>
                          <span className="kpi-trend positive">67.5% Savings Rate</span>
                        </div>
                        <div className="c-kpi-box">
                          <span className="kpi-label">EMIS & UPCOMING DUES</span>
                          <span className="kpi-val font-mono">₹38,500</span>
                          <span className="kpi-sub">Due on 5th Sep (Auto Scheduled)</span>
                        </div>
                      </div>

                      <div className="command-chart-box">
                        <div className="chart-meta-row">
                          <span className="chart-heading">Personal Savings & Investment Growth</span>
                          <span className="chart-badge">Disciplined Wealth</span>
                        </div>
                        <svg className="command-chart-svg" viewBox="0 0 460 70" preserveAspectRatio="none">
                          <polyline
                            fill="none"
                            stroke="#214ECF"
                            strokeWidth="3"
                            points="0,55 80,48 160,40 240,32 320,22 400,14 460,5"
                          />
                        </svg>
                      </div>

                      <div className="command-transactions">
                        <div className="tx-header">Recent Personal Activity</div>
                        <div className="tx-row">
                          <span className="tx-cat-badge blue">INCOME</span>
                          <span className="tx-desc">Design Consulting Advisory Retainer</span>
                          <span className="tx-amt text-green font-mono">+₹75,000</span>
                          <span className="tx-badge verified">CREDITED</span>
                        </div>
                        <div className="tx-row">
                          <span className="tx-cat-badge gray">SAVINGS</span>
                          <span className="tx-desc">Mutual Fund Index SIP Recurring</span>
                          <span className="tx-amt font-mono">-₹25,000</span>
                          <span className="tx-badge auto">INVESTED</span>
                        </div>
                      </div>
                    </>
                  )}

                </div>

                {/* Card Footer */}
                <div className="command-footer">
                  <span className="demo-label">
                    <Sparkles size={13} className="text-blue" />
                    <span>Interactive Product Preview · Demo Ledger State</span>
                  </span>
                  <Link to="/portal" className="command-cta-link">
                    <span>Enter Authenticated Portal</span>
                    <ArrowUpRight size={13} />
                  </Link>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── 02. TRUST & VALUE STRIP ────────────────────────────────────────── */}
      <section className="ledger-trust-strip">
        <div className="ledger-container">
          <div className="trust-strip-inner">
            <div className="trust-strip-label">CONNECTED FINANCIAL REPOSITORIES:</div>
            <div className="trust-strip-items">
              <span className="strip-item">Income</span>
              <span className="strip-sep">·</span>
              <span className="strip-item">Expenses</span>
              <span className="strip-sep">·</span>
              <span className="strip-item">Receivables</span>
              <span className="strip-sep">·</span>
              <span className="strip-item">Payables</span>
              <span className="strip-sep">·</span>
              <span className="strip-item">Cash Flow</span>
              <span className="strip-sep">·</span>
              <span className="strip-item">Tax Reports</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 03. PROBLEM SECTION ────────────────────────────────────────────── */}
      <section className="ledger-problem-section">
        <div className="ledger-container">
          
          <div className="ledger-section-head text-center">
            <div className="ledger-eyebrow">
              <span className="eyebrow-dot" />
              <span>THE FINANCIAL SCATTER TRAP</span>
            </div>
            <h2 className="ledger-section-title">Your money shouldn’t be scattered everywhere.</h2>
            <p className="ledger-section-sub">
              Managing finances shouldn’t feel like an investigative scavenger hunt across disconnected apps, spreadsheets, and paper receipts.
            </p>
          </div>

          <div className="problem-vs-solution-grid">
            
            {/* The Old Painful Way */}
            <div className="problem-card old-way">
              <div className="card-badge red">BEFORE KEPWE LEDGER</div>
              <h3 className="card-title">The Fragmented Mess</h3>
              
              <ul className="problem-list">
                <li>
                  <span className="p-cross">✕</span>
                  <span><strong>Outdated Spreadsheets:</strong> Formula errors, forgotten entries, and zero real-time sync.</span>
                </li>
                <li>
                  <span className="p-cross">✕</span>
                  <span><strong>Lost WhatsApp Bills:</strong> Payment screenshots and vendor receipts buried in chat threads.</span>
                </li>
                <li>
                  <span className="p-cross">✕</span>
                  <span><strong>Overdue Receivables:</strong> Forgetting who owes you money and missing collection follow-ups.</span>
                </li>
                <li>
                  <span className="p-cross">✕</span>
                  <span><strong>End-of-Year Panic:</strong> Scrambling for invoices when GST and Income Tax filing deadlines arrive.</span>
                </li>
              </ul>
            </div>

            {/* The Kepwe Ledger Way */}
            <div className="problem-card new-way">
              <div className="card-badge green">WITH KEPWE LEDGER</div>
              <h3 className="card-title">One Unified Command Center</h3>
              
              <ul className="solution-list">
                <li>
                  <Check size={18} className="p-check" />
                  <span><strong>One Central Ledger:</strong> Every rupee earned, spent, owed, and invested visible in real time.</span>
                </li>
                <li>
                  <Check size={18} className="p-check" />
                  <span><strong>Automated Invoicing & Reminders:</strong> Collect receivables up to 40% faster on WhatsApp & SMS.</span>
                </li>
                <li>
                  <Check size={18} className="p-check" />
                  <span><strong>Zero Accounting Jargon:</strong> Clean, intuitive design built for founders and smart individuals.</span>
                </li>
                <li>
                  <Check size={18} className="p-check" />
                  <span><strong>Audit-Ready Compliance:</strong> 1-click P&L, Balance Sheet, and GST reconciliation reports.</span>
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 04. CORE FEATURES (7 PILLARS) ──────────────────────────────────── */}
      <section className="ledger-features-section" id="features">
        <div className="ledger-container">
          
          <div className="ledger-section-head text-center">
            <div className="ledger-eyebrow">
              <span className="eyebrow-dot" />
              <span>COMPREHENSIVE CAPABILITIES</span>
            </div>
            <h2 className="ledger-section-title">Built For Complete Financial Control</h2>
            <p className="ledger-section-sub">
              Everything required to run your personal wealth or business operations with clarity, speed, and institutional precision.
            </p>
          </div>

          <div className="features-card-grid">
            {CORE_FEATURES.map((feat) => {
              const IconComp = feat.icon;
              return (
                <div key={feat.title} className="feat-card">
                  <div className="feat-top">
                    <div className="feat-icon-box">
                      <IconComp size={22} className="text-blue" />
                    </div>
                    <span className="feat-badge">{feat.badge}</span>
                  </div>
                  <h3 className="feat-title">{feat.title}</h3>
                  <p className="feat-desc">{feat.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ─── 05. PRODUCT DIFFERENTIATOR (4-STAGE LOOP) ──────────────────────── */}
      <section className="ledger-differentiator-section">
        <div className="ledger-container">
          
          <div className="ledger-section-head text-center">
            <div className="ledger-eyebrow">
              <span className="eyebrow-dot" />
              <span>BEYOND TRADITIONAL BOOKKEEPING</span>
            </div>
            <h2 className="ledger-section-title">A Ledger That Thinks Forward</h2>
            <p className="ledger-section-sub">
              Traditional ledgers only record what happened in the past. Kepwe Ledger turns historical entries into forward-looking decisions.
            </p>
          </div>

          {/* 4 Interactive Loop Stages */}
          <div className="loop-grid">
            {LOOP_STAGES.map((st) => {
              const IconComp = st.icon;
              return (
                <div
                  key={st.stage}
                  className={`loop-card ${activeLoopStage === st.stage ? 'active' : ''}`}
                  onClick={() => setActiveLoopStage(st.stage)}
                >
                  <div className="loop-card-header">
                    <span className="loop-number">{st.stage}</span>
                    <div className="loop-icon-wrap">
                      <IconComp size={20} />
                    </div>
                  </div>
                  <h3 className="loop-name">{st.name}</h3>
                  <span className="loop-sub">{st.sub}</span>
                  <p className="loop-desc">{st.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="loop-summary-box text-center">
            <span className="summary-flow">Record → Track → Analyse → Act</span>
            <p className="summary-desc">
              Your financial records automatically feed actionable intelligence, collection follow-ups, and growth capital.
            </p>
          </div>

        </div>
      </section>

      {/* ─── 06 & 07. FOR INDIVIDUALS & BUSINESSES ───────────────────────────── */}
      <section className="ledger-personas-section">
        <div className="ledger-container">
          
          <div className="personas-grid">
            
            {/* For Individuals */}
            <div className="persona-card">
              <div className="persona-header">
                <div className="persona-icon-wrap user">
                  <User size={24} />
                </div>
                <div>
                  <span className="persona-kicker">PERSONAL WEALTH</span>
                  <h3 className="persona-title">For Individuals & Professionals</h3>
                </div>
              </div>

              <p className="persona-desc">
                Gain clarity over your personal cash flow, stop money leaks, track recurring EMIs, and build disciplined long-term wealth.
              </p>

              <div className="persona-bullet-list">
                <div className="p-bullet">
                  <Check size={16} className="text-green" />
                  <span><strong>Multi-Source Income:</strong> Salary, consulting, dividends, and rental returns.</span>
                </div>
                <div className="p-bullet">
                  <Check size={16} className="text-green" />
                  <span><strong>Smart Categorization:</strong> Daily living expenses, food, travel, and shopping.</span>
                </div>
                <div className="p-bullet">
                  <Check size={16} className="text-green" />
                  <span><strong>Loans & EMIs:</strong> Home loans, car loans, and personal dues schedule.</span>
                </div>
                <div className="p-bullet">
                  <Check size={16} className="text-green" />
                  <span><strong>Subscription Audits:</strong> Track auto-debits and cancel unused services.</span>
                </div>
                <div className="p-bullet">
                  <Check size={16} className="text-green" />
                  <span><strong>Personal Cash Flow:</strong> Monthly savings rate and investment runway.</span>
                </div>
              </div>

              <div className="persona-action">
                <Link to="/signup" className="persona-btn">
                  <span>Manage My Money Free</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            {/* For Businesses */}
            <div className="persona-card business">
              <div className="persona-header">
                <div className="persona-icon-wrap biz">
                  <Building2 size={24} />
                </div>
                <div>
                  <span className="persona-kicker">COMMERCIAL ENTERPRISE</span>
                  <h3 className="persona-title">For Businesses & Founders</h3>
                </div>
              </div>

              <p className="persona-desc">
                Streamline receivables, automate vendor payouts, maintain double-entry accuracy, and access verified growth capital.
              </p>

              <div className="persona-bullet-list">
                <div className="p-bullet">
                  <Check size={16} className="text-blue" />
                  <span><strong>Customer Credit Ledgers:</strong> Invoicing, credit limits, and automated WhatsApp follow-ups.</span>
                </div>
                <div className="p-bullet">
                  <Check size={16} className="text-blue" />
                  <span><strong>Vendor Payables:</strong> Purchase bills, PO tracking, and payment scheduling.</span>
                </div>
                <div className="p-bullet">
                  <Check size={16} className="text-blue" />
                  <span><strong>Multi-Account Sync:</strong> Current accounts, payment gateways, and petty cash.</span>
                </div>
                <div className="p-bullet">
                  <Check size={16} className="text-blue" />
                  <span><strong>Profitability Insights:</strong> Gross vs net margins, burn rate, and runway.</span>
                </div>
                <div className="p-bullet">
                  <Check size={16} className="text-blue" />
                  <span><strong>Statutory Compliance:</strong> GSTR-1, GSTR-3B, TDS, and Audit-ready reports.</span>
                </div>
              </div>

              <div className="persona-action">
                <Link to="/portal" className="persona-btn biz">
                  <span>Manage My Business</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 09. SIMPLICITY & SPEED ─────────────────────────────────────────── */}
      <section className="ledger-simplicity-section">
        <div className="ledger-container">
          
          <div className="simplicity-box">
            <div className="simplicity-grid">
              
              <div className="simplicity-left">
                <div className="ledger-eyebrow">
                  <span className="eyebrow-dot" />
                  <span>DESIGNED FOR SPEED</span>
                </div>
                <h2 className="simplicity-title">Zero Accounting Jargon. Lightning Fast.</h2>
                <p className="simplicity-sub">
                  You shouldn’t need a commerce degree to understand your own money. Kepwe Ledger eliminates confusing terminology in favor of intuitive, crystal-clear financial operations.
                </p>

                <div className="simplicity-metrics">
                  <div className="s-metric">
                    <span className="s-num font-mono">30s</span>
                    <span className="s-lbl">Average time to log a transaction</span>
                  </div>
                  <div className="s-metric">
                    <span className="s-num font-mono">1-Click</span>
                    <span className="s-lbl">GST & P&L report generation</span>
                  </div>
                  <div className="s-metric">
                    <span className="s-num font-mono">100%</span>
                    <span className="s-lbl">Audit-ready double-entry ledger</span>
                  </div>
                </div>
              </div>

              <div className="simplicity-right">
                <div className="simple-card-preview">
                  <div className="preview-row">
                    <span className="p-label">Customer</span>
                    <span className="p-val font-bold">Horizon Logistics Pvt Ltd</span>
                  </div>
                  <div className="preview-row">
                    <span className="p-label">Amount</span>
                    <span className="p-val text-green font-mono font-bold">₹85,000.00</span>
                  </div>
                  <div className="preview-row">
                    <span className="p-label">Category</span>
                    <span className="p-val badge">Commercial Transport Services</span>
                  </div>
                  <div className="preview-row">
                    <span className="p-label">Status</span>
                    <span className="p-val text-blue font-bold">✓ Recorded & Auto-Reconciled</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ─── 10. SECURITY & PRIVACY ─────────────────────────────────────────── */}
      <section className="ledger-security-section">
        <div className="ledger-container">
          
          <div className="ledger-section-head text-center">
            <div className="ledger-eyebrow">
              <span className="eyebrow-dot" />
              <span>SECURITY FIRST</span>
            </div>
            <h2 className="ledger-section-title">Your financial data deserves serious protection.</h2>
            <p className="ledger-section-sub">
              Engineered with bank-grade encryption, strict role-based access, and zero data monetization.
            </p>
          </div>

          <div className="security-pillars-grid">
            <div className="sec-pillar-card">
              <div className="sec-icon"><Lock size={22} /></div>
              <h3>Bank-Grade Encryption</h3>
              <p>256-bit AES encryption at rest and TLS 1.3 in transit ensure your data is always unreadable to unauthorized parties.</p>
            </div>
            <div className="sec-pillar-card">
              <div className="sec-icon"><ShieldCheck size={22} /></div>
              <h3>Private & Confidential</h3>
              <p>We strictly never sell, share, or monetize your financial transaction records. Your data belongs exclusively to you.</p>
            </div>
            <div className="sec-pillar-card">
              <div className="sec-icon"><RotateCcw size={22} /></div>
              <h3>Automated Cloud Backups</h3>
              <p>Daily automated redundancy and multi-region failover prevent accidental data loss or hardware failures.</p>
            </div>
            <div className="sec-pillar-card">
              <div className="sec-icon"><Users size={22} /></div>
              <h3>Granular Team Controls</h3>
              <p>Assign specific permissions for staff, accountants, and auditors. Restrict access to sensitive financial statements.</p>
            </div>
          </div>

        </div>
      </section>

      {/* ─── 11. KEPWE ECOSYSTEM INTEGRATION ────────────────────────────────── */}
      <section className="ledger-ecosystem-section">
        <div className="ledger-container">
          
          <div className="ecosystem-card">
            <div className="eco-header text-center">
              <div className="ledger-eyebrow">
                <span className="eyebrow-dot" />
                <span>CONNECTED FINANCIAL ECOSYSTEM</span>
              </div>
              <h2 className="eco-title">Manage. Understand. Access Capital. Grow.</h2>
              <p className="eco-sub">
                Kepwe Ledger seamlessly connects with our lending and trading intelligence platforms to unlock financial growth.
              </p>
            </div>

            <div className="eco-flow-grid">
              
              <div className="eco-step">
                <div className="step-num">STEP 01</div>
                <BookOpen size={28} className="text-blue" />
                <h4>KEPWE Ledger</h4>
                <p>Record transactions, manage receivables, and organize clean, audit-ready financial books.</p>
              </div>

              <div className="eco-arrow">→</div>

              <div className="eco-step">
                <div className="step-num">STEP 02</div>
                <CreditCard size={28} className="text-blue" />
                <h4>KEPWE Credit</h4>
                <p>Unlock instant working capital, invoice discounting, and business loans based on verified ledger health.</p>
                <Link to="/credit" className="step-link">Explore Credit →</Link>
              </div>

              <div className="eco-arrow">→</div>

              <div className="eco-step">
                <div className="step-num">STEP 03</div>
                <BarChart3 size={28} className="text-blue" />
                <h4>KEPWE Quant</h4>
                <p>Deploy algorithmic risk-managed strategies and treasury automation to protect and compound capital.</p>
                <Link to="/quant" className="step-link">Explore Quant →</Link>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ─── 12. FAQ SECTION ────────────────────────────────────────────────── */}
      <section className="ledger-faq-section" id="faq">
        <div className="ledger-container">
          
          <div className="ledger-section-head text-center">
            <div className="ledger-eyebrow">
              <span className="eyebrow-dot" />
              <span>FREQUENTLY ASKED QUESTIONS</span>
            </div>
            <h2 className="ledger-section-title">Common Questions About Kepwe Ledger</h2>
            <p className="ledger-section-sub">
              Everything you need to know about getting started, migrating records, and team permissions.
            </p>
          </div>

          <div className="ledger-faq-accordion">
            {LEDGER_FAQS.map((faq, index) => (
              <div key={index} className={`ledger-faq-item ${openFaq === index ? 'open' : ''}`}>
                <button
                  type="button"
                  className="faq-btn"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={openFaq === index}
                >
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className="faq-chevron" />
                </button>
                {openFaq === index && (
                  <div className="faq-panel">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── 13. FINAL CTA ──────────────────────────────────────────────────── */}
      <section className="ledger-final-cta-section">
        <div className="ledger-container">
          <div className="ledger-final-box">
            <div className="cta-inner text-center">
              <div className="ledger-eyebrow">
                <span className="eyebrow-dot" />
                <span>FINANCIAL CLARITY STARTS TODAY</span>
              </div>
              <h2 className="final-title">Take Complete Control of Your Financial Destiny</h2>
              <p className="final-sub">
                Join ambitious businesses and individuals streamlining their income, expenses, receivables, and growth records on Kepwe Ledger.
              </p>

              <div className="final-btn-group">
                <Link to="/signup" className="ledger-btn-primary">
                  <span>Start Free</span>
                  <ArrowRight size={16} />
                </Link>
                <Link to="/portal" className="ledger-btn-secondary">
                  <span>Explore Customer Portal</span>
                  <ArrowUpRight size={15} />
                </Link>
              </div>

              <div className="final-perks">
                <span>✓ Free Setup</span>
                <span>✓ No Credit Card Required</span>
                <span>✓ Bank-Grade Encryption</span>
                <span>✓ Instant Data Import</span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
