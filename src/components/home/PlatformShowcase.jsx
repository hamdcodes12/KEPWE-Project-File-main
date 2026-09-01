import React, { useState } from 'react';
import { 
  Building2, 
  TrendingUp, 
  CreditCard, 
  ShieldCheck, 
  ArrowUpRight, 
  CheckCircle2, 
  Activity, 
  Lock 
} from 'lucide-react';
import './PlatformShowcase.css';

const PlatformShowcase = () => {
  const [activeTab, setActiveTab] = useState('ledger');

  const tabs = [
    { id: 'ledger', label: 'Business & Ledger', icon: Building2 },
    { id: 'market', label: 'Market Telemetry', icon: TrendingUp },
    { id: 'credit', label: 'Credit & Capital', icon: CreditCard },
    { id: 'compliance', label: 'Statutory Compliance', icon: ShieldCheck },
  ];

  return (
    <section className="platform-showcase-section" aria-label="KEPWE Unified Financial Workspace">
      <div className="container">
        
        {/* Section Header */}
        <div className="platform-header text-center">
          <div className="platform-eyebrow">
            <span className="platform-eyebrow-dot" />
            <span>UNIFIED PLATFORM ARCHITECTURE</span>
          </div>
          <h2 className="platform-title">Everything important. Connected in one place.</h2>
          <p className="platform-subtitle">
            Bring the information that matters into one place—from business performance and financial workflows to market signals and operational insights.
          </p>

          {/* Interactive Feature Tabs */}
          <div className="platform-tab-buttons" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`platform-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Workspace Display */}
        <div className="platform-workspace-card">
          
          {/* Card Header Bar */}
          <div className="workspace-header-bar">
            <div className="workspace-window-controls">
              <span className="ctrl-dot red" />
              <span className="ctrl-dot yellow" />
              <span className="ctrl-dot green" />
              <span className="workspace-title-text">KEPWE OS — Unified Financial Workspace</span>
            </div>
            <div className="workspace-status-badge">
              <span className="status-live-dot" />
              <span>LIVE TELEMETRY</span>
            </div>
          </div>

          {/* Workspace Body depending on Active Tab */}
          <div className="workspace-content-body">
            
            {activeTab === 'ledger' && (
              <div className="workspace-view-grid animate-fade">
                <div className="view-metric-box">
                  <span className="view-metric-label">Monthly Gross Revenue</span>
                  <span className="view-metric-val">₹24,85,000</span>
                  <span className="view-metric-growth text-success"><ArrowUpRight size={14} /> +18.4% vs last month</span>
                </div>
                <div className="view-metric-box">
                  <span className="view-metric-label">GST Liability (GSTR-3B)</span>
                  <span className="view-metric-val">₹2,14,320</span>
                  <span className="view-metric-sub text-blue">Filing Status: Auto-Reconciled</span>
                </div>
                <div className="view-metric-box">
                  <span className="view-metric-label">Net Operating Cash Flow</span>
                  <span className="view-metric-val">₹14,30,500</span>
                  <span className="view-metric-growth text-success"><CheckCircle2 size={14} /> Positive Run-rate</span>
                </div>

                <div className="view-main-panel span-3">
                  <div className="panel-top-row">
                    <span className="panel-title">Revenue vs Operating Expenditure (FY 2025-26)</span>
                    <span className="panel-tag">Automated Reconciliation</span>
                  </div>
                  <div className="bar-chart-simulation">
                    <div className="chart-bar-group">
                      <div className="bar-pair">
                        <div className="bar income-bar" style={{ height: '65%' }} title="Revenue: ₹18.5L" />
                        <div className="bar expense-bar" style={{ height: '35%' }} title="Expense: ₹10.2L" />
                      </div>
                      <span className="bar-label">Q1</span>
                    </div>
                    <div className="chart-bar-group">
                      <div className="bar-pair">
                        <div className="bar income-bar" style={{ height: '78%' }} title="Revenue: ₹21.2L" />
                        <div className="bar expense-bar" style={{ height: '42%' }} title="Expense: ₹11.8L" />
                      </div>
                      <span className="bar-label">Q2</span>
                    </div>
                    <div className="chart-bar-group">
                      <div className="bar-pair">
                        <div className="bar income-bar" style={{ height: '88%' }} title="Revenue: ₹24.8L" />
                        <div className="bar expense-bar" style={{ height: '48%' }} title="Expense: ₹13.4L" />
                      </div>
                      <span className="bar-label">Q3</span>
                    </div>
                    <div className="chart-bar-group">
                      <div className="bar-pair">
                        <div className="bar income-bar projected" style={{ height: '96%' }} title="Projected: ₹28.0L" />
                        <div className="bar expense-bar projected" style={{ height: '52%' }} title="Projected: ₹14.5L" />
                      </div>
                      <span className="bar-label">Q4 (EST)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'market' && (
              <div className="workspace-view-grid animate-fade">
                <div className="view-metric-box">
                  <span className="view-metric-label">NIFTY Options Regime</span>
                  <span className="view-metric-val text-blue">BULLISH EXPANSION</span>
                  <span className="view-metric-sub">PCR: 1.24 • IV Rank: 22.4</span>
                </div>
                <div className="view-metric-box">
                  <span className="view-metric-label">Risk Engine Exposure</span>
                  <span className="view-metric-val">LOW (0.35Δ)</span>
                  <span className="view-metric-growth text-success"><ShieldCheck size={14} /> Shield Active</span>
                </div>
                <div className="view-metric-box">
                  <span className="view-metric-label">Signal Conviction Score</span>
                  <span className="view-metric-val">87 / 100</span>
                  <span className="view-metric-growth text-success"><Activity size={14} /> High Telemetry Edge</span>
                </div>

                <div className="view-main-panel span-3">
                  <div className="panel-top-row">
                    <span className="panel-title">Algorithmic Payoff Simulation & Telemetry Stream</span>
                    <span className="panel-tag">Sub-second Latency</span>
                  </div>
                  <div className="market-preview-rows">
                    <div className="market-row-item">
                      <span className="market-asset">NIFTY 24,500 CE</span>
                      <span className="market-type">Index Option</span>
                      <span className="market-delta">Delta: +0.52</span>
                      <span className="market-badge buy">BULLISH ACCUMULATION</span>
                    </div>
                    <div className="market-row-item">
                      <span className="market-asset">BANKNIFTY 52,000 PE</span>
                      <span className="market-type">Index Option</span>
                      <span className="market-delta">Delta: -0.28</span>
                      <span className="market-badge neutral">THETA DECAY ZONE</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'credit' && (
              <div className="workspace-view-grid animate-fade">
                <div className="view-metric-box">
                  <span className="view-metric-label">Instant Pre-Approved Limit</span>
                  <span className="view-metric-val">₹15,00,000</span>
                  <span className="view-metric-growth text-success"><CheckCircle2 size={14} /> Zero Collateral</span>
                </div>
                <div className="view-metric-box">
                  <span className="view-metric-label">Indicative Interest Rate</span>
                  <span className="view-metric-val">10.5% p.a.</span>
                  <span className="view-metric-sub">Transparent EMI Calculations</span>
                </div>
                <div className="view-metric-box">
                  <span className="view-metric-label">Decision Processing Time</span>
                  <span className="view-metric-val">&lt; 3 Minutes</span>
                  <span className="view-metric-sub text-blue">100% Digital Document Flow</span>
                </div>

                <div className="view-main-panel span-3">
                  <div className="panel-top-row">
                    <span className="panel-title">Digital Credit Lifecycle Tracker</span>
                    <span className="panel-tag">LSP Disclosure Compliant</span>
                  </div>
                  <div className="credit-tracker-steps">
                    <div className="credit-step-item completed">
                      <div className="step-num-circle">1</div>
                      <span className="step-name">Eligibility Assessment</span>
                      <span className="step-status">Instant Verification</span>
                    </div>
                    <div className="credit-step-item completed">
                      <div className="step-num-circle">2</div>
                      <span className="step-name">Lender Matching</span>
                      <span className="step-status">RBI Regulated NBFC/Banks</span>
                    </div>
                    <div className="credit-step-item active">
                      <div className="step-num-circle">3</div>
                      <span className="step-name">Instant Disbursal</span>
                      <span className="step-status">Direct Bank Transfer</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'compliance' && (
              <div className="workspace-view-grid animate-fade">
                <div className="view-metric-box">
                  <span className="view-metric-label">Corporate Health Index</span>
                  <span className="view-metric-val text-success">100% HEALTHY</span>
                  <span className="view-metric-sub">All MCA Filings Up to Date</span>
                </div>
                <div className="view-metric-box">
                  <span className="view-metric-label">Upcoming Filing Deadline</span>
                  <span className="view-metric-val">20th Next Month</span>
                  <span className="view-metric-sub text-blue">GSTR-3B Auto-Queued</span>
                </div>
                <div className="view-metric-box">
                  <span className="view-metric-label">Statutory Audit Readiness</span>
                  <span className="view-metric-val">READY</span>
                  <span className="view-metric-growth text-success"><ShieldCheck size={14} /> Full Audit Trail</span>
                </div>

                <div className="view-main-panel span-3">
                  <div className="panel-top-row">
                    <span className="panel-title">Statutory Compliance Calendar & Gateway Sync</span>
                    <span className="panel-tag">MCA / GSTN Direct API</span>
                  </div>
                  <div className="compliance-checklist">
                    <div className="compliance-check-item done">
                      <CheckCircle2 size={16} color="#12B76A" />
                      <span>Form AOC-4 Financial Statement MCA Filing</span>
                      <span className="status-tag success">Filed on MCA V3</span>
                    </div>
                    <div className="compliance-check-item done">
                      <CheckCircle2 size={16} color="#12B76A" />
                      <span>Form MGT-7 Annual Return Reconciliation</span>
                      <span className="status-tag success">Filed on MCA V3</span>
                    </div>
                    <div className="compliance-check-item pending">
                      <Activity size={16} color="#214ECF" />
                      <span>Quarterly Advance Tax Computation & Challan</span>
                      <span className="status-tag queued">Auto-Calculated</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </section>
  );
};

export default PlatformShowcase;
