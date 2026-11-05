import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  HeartPulse,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Calculator,
  MessageSquare,
  ArrowRight,
  PiggyBank,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wallet,
  Receipt,
  UploadCloud,
  Settings,
  ChevronRight,
  Info
} from 'lucide-react';
import {
  fetchCfoInsights,
  evaluateCfoAffordability,
  askCfoQuestion
} from '../../api/ledgerClient';
import './AiCfoView.css';

export default function AiCfoView({ onOpenUploadModal, onOpenProfileModal }) {
  const [activeTab, setActiveTab] = useState('insights');
  const [insightsData, setInsightsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Affordability Simulator State
  const [simForm, setSimForm] = useState({
    purchaseAmount: '15000',
    category: 'Electronics',
    description: '',
    isEmi: false,
    tenureMonths: 6,
    annualInterestRate: 14,
  });
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState('');

  // Natural Language Chat State
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatResponse, setChatResponse] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchCfoInsights();
      if (res.ok && res.data?.insights) {
        setInsightsData(res.data.insights);
      } else {
        setError(res.data?.error || 'Unable to load AI CFO insights.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with CFO service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Run Affordability Simulation
  const handleSimulate = async (e) => {
    if (e) e.preventDefault();
    if (!simForm.purchaseAmount || Number(simForm.purchaseAmount) <= 0) {
      setSimError('Please enter a valid amount greater than 0.');
      return;
    }

    setSimLoading(true);
    setSimError('');
    try {
      const res = await evaluateCfoAffordability({
        purchaseAmount: Number(simForm.purchaseAmount),
        category: simForm.category,
        description: simForm.description,
        isEmi: Boolean(simForm.isEmi),
        tenureMonths: Number(simForm.tenureMonths),
        annualInterestRate: Number(simForm.annualInterestRate),
      });

      if (res.ok && res.data?.evaluation) {
        setSimResult(res.data.evaluation);
      } else {
        setSimError(res.data?.error || 'Failed to evaluate affordability.');
      }
    } catch (err) {
      setSimError(err.message || 'Error executing scenario simulation.');
    } finally {
      setSimLoading(false);
    }
  };

  // Run Natural Language Question
  const handleAsk = async (questionToAsk) => {
    const q = (questionToAsk || chatQuestion).trim();
    if (!q) return;

    setChatLoading(true);
    setChatError('');
    try {
      const res = await askCfoQuestion(q);
      if (res.ok && res.data?.response) {
        setChatResponse(res.data.response);
      } else {
        setChatError(res.data?.error || 'Unable to analyze question.');
      }
    } catch (err) {
      setChatError(err.message || 'Error querying conversational CFO.');
    } finally {
      setChatLoading(false);
    }
  };

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const hasData = Boolean(
    insightsData &&
    (insightsData.metrics?.monthlyIncome > 0 || insightsData.metrics?.recordedExpenses > 0 || insightsData.dataConfidence?.transactionCount > 0)
  );

  return (
    <div className="cfo-view-container">
      {/* ── 1. EXECUTIVE COMMAND HEADER ───────────────────────────────── */}
      <div className="cfo-header-card">
        <div className="cfo-header-info">
          <div className="cfo-pill-badge">
            <Sparkles size={13} />
            AI Personal CFO • Intelligence Engine
          </div>
          <h1 className="cfo-header-title">Financial Intelligence & Decision Engine</h1>
          <p className="cfo-header-desc">
            Autonomous financial analysis, expense reduction recommendations, surplus optimization, and real-time purchase affordability analysis.
          </p>
        </div>

        <div className="cfo-header-metrics">
          <div className="cfo-dial-box">
            <div className={`cfo-dial-val ${insightsData?.healthScore?.statusClass || 'moderate'}`}>
              {insightsData?.healthScore?.score !== undefined ? `${insightsData.healthScore.score}/100` : '—'}
            </div>
            <div className="cfo-dial-label">Financial Health</div>
          </div>

          <div className="cfo-dial-box">
            <div className="cfo-dial-val font-mono" style={{ color: '#059669', fontSize: '1.4rem' }}>
              {fmtCurrency(insightsData?.metrics?.potentialSurplus || 0)}
            </div>
            <div className="cfo-dial-label">Investable Surplus</div>
          </div>

          <div className="cfo-dial-box">
            <div className="cfo-dial-val font-mono" style={{ color: '#3B82F6', fontSize: '1.4rem' }}>
              {insightsData?.dataConfidence?.level || 'Review'}
            </div>
            <div className="cfo-dial-label">Data Confidence</div>
          </div>
        </div>
      </div>

      {/* ── 2. SUB-NAVIGATION TABS ───────────────────────────────────── */}
      <div className="cfo-nav-tabs">
        <button
          onClick={() => setActiveTab('insights')}
          className={`cfo-tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
        >
          <Sparkles size={16} /> CFO Insights & Reduction
        </button>

        <button
          onClick={() => {
            setActiveTab('affordability');
            if (!simResult) handleSimulate();
          }}
          className={`cfo-tab-btn ${activeTab === 'affordability' ? 'active' : ''}`}
        >
          <Calculator size={16} /> "Can I Afford This?" / Before You Buy
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`cfo-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
        >
          <MessageSquare size={16} /> Conversational AI CFO
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`cfo-tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
        >
          <AlertCircle size={16} /> Financial Alerts ({insightsData?.alerts?.length || 0})
        </button>
      </div>

      {/* ── LOADING / ERROR / HONEST EMPTY STATES ────────────────────── */}
      {loading ? (
        <div className="cfo-card" style={{ padding: '60px', textAlign: 'center' }}>
          <RefreshCw size={32} className="spin-animate" style={{ color: '#214ECF', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: 800 }}>Analyzing Financial Records…</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Evaluating cashflow velocity, subscriptions, and surplus capacity.</p>
        </div>
      ) : error ? (
        <div className="cfo-card" style={{ padding: '36px', textAlign: 'center', borderColor: '#FCA5A5' }}>
          <AlertCircle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#B91C1C', fontWeight: 800 }}>Unable to Load CFO Intelligence</h3>
          <p style={{ color: '#64748B', fontSize: '0.88rem', marginBottom: '16px' }}>{error}</p>
          <button onClick={loadInsights} className="btn-secondary small">Retry Analysis</button>
        </div>
      ) : !hasData ? (
        <div className="cfo-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#EFF6FF', color: '#214ECF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Sparkles size={28} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
            Awaiting Initial Financial Data
          </h2>
          <p style={{ maxWidth: '540px', margin: '0 auto 24px', fontSize: '0.9rem', color: '#64748B', lineHeight: 1.6 }}>
            Your AI Personal CFO requires real transaction or baseline profile records to activate mathematical health scoring, expense reduction scans, and surplus allocation roadmaps.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={onOpenUploadModal} className="btn-primary" style={{ padding: '10px 20px' }}>
              <UploadCloud size={16} /> Add Financial Data
            </button>
            <button onClick={onOpenProfileModal} className="btn-secondary" style={{ padding: '10px 20px' }}>
              <Settings size={16} /> Set Monthly Baseline Income
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ════ TAB 1: CFO INSIGHTS & EXPENSE REDUCTION ══════════════ */}
          {activeTab === 'insights' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Surplus Waterfall Banner */}
              <div className="cfo-card">
                <div className="cfo-card-header">
                  <h3 className="cfo-card-title">
                    <PiggyBank size={18} color="#059669" />
                    PRD Financial Surplus Engine
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Formula: Income − Essential Bills − Debt − Savings Target
                  </span>
                </div>

                <div className="surplus-waterfall">
                  <div className="waterfall-step">
                    <div className="waterfall-label">Monthly Income</div>
                    <div className="waterfall-val font-mono" style={{ color: '#0F172A' }}>
                      {fmtCurrency(insightsData.metrics.monthlyIncome)}
                    </div>
                  </div>

                  <div className="waterfall-op">−</div>

                  <div className="waterfall-step">
                    <div className="waterfall-label">Essential Bills</div>
                    <div className="waterfall-val font-mono" style={{ color: '#EF4444' }}>
                      {fmtCurrency(insightsData.metrics.essentialExpenses)}
                    </div>
                  </div>

                  <div className="waterfall-op">−</div>

                  <div className="waterfall-step">
                    <div className="waterfall-label">Debt Obligations</div>
                    <div className="waterfall-val font-mono" style={{ color: '#DC2626' }}>
                      {fmtCurrency(insightsData.surplusAllocation.debtObligations)}
                    </div>
                  </div>

                  <div className="waterfall-op">−</div>

                  <div className="waterfall-step">
                    <div className="waterfall-label">Savings Target</div>
                    <div className="waterfall-val font-mono" style={{ color: '#3B82F6' }}>
                      {fmtCurrency(insightsData.surplusAllocation.savingsTarget)}
                    </div>
                  </div>

                  <div className="waterfall-op">=</div>

                  <div className="waterfall-step surplus">
                    <div className="waterfall-label" style={{ color: '#059669', fontWeight: 800 }}>Investable Surplus</div>
                    <div className="waterfall-val font-mono">
                      {fmtCurrency(insightsData.surplusAllocation.potentialInvestableSurplus)}
                    </div>
                  </div>
                </div>

                {/* Allocation Roadmap */}
                {insightsData.surplusAllocation.recommendations.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '12px' }}>
                      Suggested Wealth Allocation Roadmap:
                    </h4>
                    <div className="allocation-list">
                      {insightsData.surplusAllocation.recommendations.map((rec, i) => (
                        <div key={i} className="allocation-item">
                          <div className="allocation-icon">
                            <Layers size={18} />
                          </div>
                          <div className="allocation-details">
                            <div className="allocation-top-row">
                              <span className="allocation-bucket">{rec.bucket} ({rec.pct}%)</span>
                              <span className="allocation-amount font-mono">{fmtCurrency(rec.amount)}</span>
                            </div>
                            <div className="allocation-rationale">{rec.rationale}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Expense Reduction Opportunities */}
              <div className="cfo-card">
                <div className="cfo-card-header">
                  <h3 className="cfo-card-title">
                    <TrendingDown size={18} color="#EF4444" />
                    Expense Reduction Engine
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Identifies duplicate subscriptions, spending leaks, and lifestyle trims
                  </span>
                </div>

                {(!insightsData.reductionOpportunities || insightsData.reductionOpportunities.length === 0) ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '0.88rem' }}>
                    <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 8px' }} />
                    <p>No critical spending leaks or duplicate subscriptions detected in current records.</p>
                  </div>
                ) : (
                  <div className="reduction-grid">
                    {insightsData.reductionOpportunities.map((op) => (
                      <div key={op.id} className={`reduction-card ${op.severity}`}>
                        <div>
                          <div className="reduction-top">
                            <h4 className="reduction-title">{op.title}</h4>
                            <span className="savings-tag">Save ~{fmtCurrency(op.potentialMonthlySavings)}/mo</span>
                          </div>
                          <div className="reduction-desc">{op.summary}</div>
                          {op.items && op.items.length > 0 && (
                            <div className="reduction-items">
                              {op.items.map((item, idx) => (
                                <div key={idx}>• {item}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="reduction-rec">
                          💡 <strong>CFO Advice:</strong> {op.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ TAB 2: "CAN I AFFORD THIS?" / BEFORE YOU BUY ═══════════ */}
          {activeTab === 'affordability' && (
            <div className="cfo-card">
              <div className="cfo-card-header">
                <div>
                  <h3 className="cfo-card-title">
                    <Calculator size={18} color="#214ECF" />
                    "Can I Afford This?" • Before You Buy Scenario Simulator
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Evaluates purchase viability against your actual cash reserves, monthly surplus, and 5-year opportunity cost.
                  </span>
                </div>
              </div>

              <div className="simulator-grid">
                {/* Input Form */}
                <form onSubmit={handleSimulate} className="simulator-form">
                  {simError && <div className="modal-alert error">{simError}</div>}

                  <div>
                    <label className="form-group-label">Purchase Amount (₹) *</label>
                    <input
                      type="number"
                      value={simForm.purchaseAmount}
                      onChange={(e) => setSimForm({ ...simForm, purchaseAmount: e.target.value })}
                      placeholder="e.g. 15000"
                      className="sim-input font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-group-label">Item / Description</label>
                    <input
                      type="text"
                      value={simForm.description}
                      onChange={(e) => setSimForm({ ...simForm, description: e.target.value })}
                      placeholder="e.g. Sony WH-1000XM5, iPhone, Goa Trip"
                      className="sim-input"
                    />
                  </div>

                  <div>
                    <label className="form-group-label">Category</label>
                    <select
                      value={simForm.category}
                      onChange={(e) => setSimForm({ ...simForm, category: e.target.value })}
                      className="sim-input"
                    >
                      <option value="Electronics">Electronics / Gadgets</option>
                      <option value="Travel">Travel / Vacation</option>
                      <option value="Appliances">Home Appliances</option>
                      <option value="Shopping">Clothing / Lifestyle</option>
                      <option value="Vehicle">Vehicle / Auto</option>
                      <option value="Other">Other Discretionary</option>
                    </select>
                  </div>

                  <div className="emi-toggle-box" onClick={() => setSimForm({ ...simForm, isEmi: !simForm.isEmi })}>
                    <input
                      type="checkbox"
                      checked={simForm.isEmi}
                      onChange={() => {}}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A' }}>
                        Pay via Monthly EMI
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        Spread cost over installments instead of one-time cash outlay
                      </div>
                    </div>
                  </div>

                  {simForm.isEmi && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="form-group-label">Tenure (Months)</label>
                        <select
                          value={simForm.tenureMonths}
                          onChange={(e) => setSimForm({ ...simForm, tenureMonths: e.target.value })}
                          className="sim-input"
                        >
                          <option value="3">3 Months</option>
                          <option value="6">6 Months</option>
                          <option value="9">9 Months</option>
                          <option value="12">12 Months</option>
                          <option value="24">24 Months</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-group-label">Annual Interest (%)</label>
                        <input
                          type="number"
                          value={simForm.annualInterestRate}
                          onChange={(e) => setSimForm({ ...simForm, annualInterestRate: e.target.value })}
                          className="sim-input font-mono"
                        />
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={simLoading} className="btn-primary" style={{ padding: '12px' }}>
                    {simLoading ? 'Evaluating Scenario…' : 'Run Scenario Analysis'}
                  </button>
                </form>

                {/* Verdict & Impact Result */}
                {simResult ? (
                  <div className="verdict-card">
                    <div className="verdict-header">
                      <span className={`verdict-badge ${simResult.verdict.statusClass}`}>
                        {simResult.verdict.statusClass === 'affordable' && <CheckCircle2 size={16} />}
                        {simResult.verdict.statusClass === 'caution' && <AlertTriangle size={16} />}
                        {simResult.verdict.statusClass === 'unaffordable' && <AlertCircle size={16} />}
                        {simResult.verdict.status}
                      </span>
                    </div>

                    <div className="verdict-reason">
                      {simResult.verdict.reason}
                    </div>

                    <div className="verdict-metrics-row">
                      <div className="verdict-metric-item">
                        <div className="verdict-metric-label">Monthly Impact</div>
                        <div className="verdict-metric-val font-mono" style={{ color: '#214ECF' }}>
                          {fmtCurrency(simResult.scenario.monthlyPayment)}
                        </div>
                      </div>

                      <div className="verdict-metric-item">
                        <div className="verdict-metric-label">Surplus Remaining</div>
                        <div className="verdict-metric-val font-mono" style={{ color: simResult.financialContext.isSurplusNegative ? '#EF4444' : '#059669' }}>
                          {fmtCurrency(simResult.financialContext.surplusAfterPayment)}
                        </div>
                      </div>
                    </div>

                    <div className="opportunityCost-banner">
                      📈 <strong>5-Year Wealth Opportunity Cost:</strong> {simResult.opportunityCost.explanation}
                    </div>

                    {simResult.verdict.recommendations.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#475569', background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <strong>CFO Advice:</strong> {simResult.verdict.recommendations.join(' ')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '0.9rem' }}>
                    Enter an amount to simulate purchase impact.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ TAB 3: CONVERSATIONAL AI CFO CHAT ════════════════════ */}
          {activeTab === 'chat' && (
            <div className="cfo-card">
              <div className="cfo-card-header">
                <div>
                  <h3 className="cfo-card-title">
                    <MessageSquare size={18} color="#214ECF" />
                    Conversational AI CFO
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Ask natural questions about where your money went, recurring commitments, or reduction opportunities.
                  </span>
                </div>
              </div>

              <div className="cfo-chat-wrapper">
                {/* Suggested Prompt Chips */}
                <div className="prompt-chips-row">
                  {[
                    'Where did my money go this month?',
                    'How much can I save every month?',
                    'What can I reduce to save money?',
                    'Show recurring expenses',
                    'What changed this month?',
                    'How much did I spend on Food Delivery?'
                  ].map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setChatQuestion(p);
                        handleAsk(p);
                      }}
                      className="prompt-chip"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Input Row */}
                <div className="chat-input-row">
                  <input
                    type="text"
                    value={chatQuestion}
                    onChange={(e) => setChatQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }}
                    placeholder="Ask your AI CFO anything about your recorded finances…"
                    className="chat-input"
                  />
                  <button
                    onClick={() => handleAsk()}
                    disabled={chatLoading || !chatQuestion.trim()}
                    className="btn-primary"
                    style={{ padding: '0 22px' }}
                  >
                    {chatLoading ? 'Analyzing…' : 'Ask CFO'}
                  </button>
                </div>

                {chatError && <div className="modal-alert error">{chatError}</div>}

                {/* Response Bubble */}
                {chatResponse && (
                  <div className="chat-response-card">
                    <div className="chat-question-label">
                      <strong>You asked:</strong> "{chatResponse.question}"
                    </div>
                    <h4 className="chat-headline">{chatResponse.headline}</h4>
                    <div className="chat-answer-body">
                      {chatResponse.answer}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ TAB 4: FINANCIAL ALERTS ══════════════════════════════ */}
          {activeTab === 'alerts' && (
            <div className="cfo-card">
              <div className="cfo-card-header">
                <div>
                  <h3 className="cfo-card-title">
                    <AlertCircle size={18} color="#214ECF" />
                    Proactive Financial Alerts
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Calculated from actual spending velocity, emergency coverage, and recurring trends
                  </span>
                </div>
              </div>

              {(!insightsData.alerts || insightsData.alerts.length === 0) ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                  <CheckCircle2 size={36} color="#10B981" style={{ margin: '0 auto 10px' }} />
                  <p>All financial metrics are operating within recommended safety boundaries.</p>
                </div>
              ) : (
                <div className="alerts-list">
                  {insightsData.alerts.map((alert) => (
                    <div key={alert.id} className={`alert-item ${alert.level}`}>
                      <div style={{ marginTop: '2px' }}>
                        {alert.level === 'warning' && <AlertTriangle size={18} color="#D97706" />}
                        {alert.level === 'info' && <Info size={18} color="#2563EB" />}
                        {alert.level === 'success' && <CheckCircle2 size={18} color="#059669" />}
                      </div>
                      <div className="alert-content">
                        <div className="alert-headline">{alert.headline}</div>
                        <div className="alert-message">{alert.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
