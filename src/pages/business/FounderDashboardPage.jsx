import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TrendingUp, Users, DollarSign, Award, Target, ArrowRight, ShieldCheck, CheckCircle2, ChevronRight, Layers, Sparkles } from 'lucide-react';
import './FounderDashboardPage.css';

const FounderDashboardPage = () => {
  const { founderDashboard, founderDashboardAccessDenied, refreshFounderDashboard } = useApp();
  const [barsAnimated, setBarsAnimated] = useState(false);

  useEffect(() => {
    refreshFounderDashboard();
    // Trigger data-driven progress bar animation on mount
    const timer = setTimeout(() => {
      setBarsAnimated(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [refreshFounderDashboard]);

  if (founderDashboardAccessDenied) {
    return (
      <div className="fd-page-wrapper">
        <div className="fd-container">
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748B', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <ShieldCheck size={40} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#172033' }}>Staff access required</h2>
            <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>Sign in with an admin or sales agent account to view the founder dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  const journeyStages = founderDashboard?.journeyStages || [];
  const funnel = founderDashboard?.funnel || { leads: 0, calls: 0, connected: 0, interested: 0, customers: 0 };
  const salesTeam = founderDashboard?.salesTeam || [];
  const productMix = founderDashboard?.productMix || [];

  return (
    <div className="fd-page-wrapper">
      {/* Background Gradients & Technical Grid */}
      <div className="fd-bg-glow fd-bg-glow-blue" aria-hidden="true" />
      <div className="fd-bg-glow fd-bg-glow-cyan" aria-hidden="true" />
      <div className="fd-bg-glow fd-bg-glow-lavender" aria-hidden="true" />
      <div className="fd-bg-grid" aria-hidden="true" />

      <div className="fd-container">
        {/* Header */}
        <div className="fd-header-block">
          <span className="fd-eyebrow">FOUNDER EXECUTIVE DASHBOARD</span>
          <h1 className="fd-main-title">Business Performance & Customer Journey</h1>
        </div>

        {/* LIVE Data Banner */}
        <div className="fd-demo-badge">
          <Sparkles size={15} />
          <span>LIVE DATA · COMPUTED FROM POSTGRESQL</span>
        </div>

        {/* Executive Core Metric Banner (Top Blue Business Message Card) */}
        <div className="fd-blue-card">
          <h3 className="fd-blue-card-title">
            "Don't sell GST. Sell the back office."
          </h3>
          <p className="fd-blue-card-desc">
            We manage your business's financial and compliance back office. GST is the door through which the customer is acquired. The incorporation database becomes the acquisition moat; monthly packages create MRR; accounting data unlocks CFO, payroll, loans and insurance.
          </p>
        </div>

        {/* CUSTOMER JOURNEY MAP — WHITE PREMIUM FLOATING CARD */}
        <div className="fd-journey-panel">
          <div className="fd-journey-header">
            <div>
              <span className="fd-journey-eyebrow">ACQUISITION & EXPANSION LIFECYCLE</span>
              <h2 className="fd-journey-title">End-to-End Customer Journey Map</h2>
            </div>
            <span className="fd-journey-badge">
              {journeyStages.length} Journey Stages · Real-time Pipeline Track
            </span>
          </div>

          {/* Stepper Grid Container */}
          <div className="fd-journey-grid">
            {journeyStages.map((step, idx) => {
              const stageNum = idx + 1;
              const stageClass = `stage-card-${stageNum}`;
              const staggerDelay = idx * 60;

              return (
                <div
                  key={step.stage}
                  className={`fd-stage-card ${stageClass}`}
                  style={{ animationDelay: `${staggerDelay}ms` }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      {/* Numbered Badge (1 to N) */}
                      <div className="fd-num-badge">
                        {stageNum}
                      </div>
                      {/* Conversion Badge */}
                      <span className="fd-conv-badge">
                        {step.conv} Conv.
                      </span>
                    </div>

                    <h4 className="fd-stage-title">
                      {step.stage}
                    </h4>
                    <div className="fd-stage-status-label">
                      Status: <span className="fd-stage-status-val">{step.status}</span>
                    </div>
                  </div>

                  <div className="fd-stage-footer">
                    <span className="fd-volume-label">VOLUME</span>
                    <span className="fd-volume-val">{Number(step.count).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acquisition Today Funnel */}
        <h3 className="fd-section-title">Acquisition Funnel Today</h3>
        <div className="fd-funnel-grid">
          <div className="fd-funnel-card" style={{ animationDelay: '80ms' }}>
            <div className="fd-funnel-val fn-blue">{Number(funnel.leads).toLocaleString('en-IN')}</div>
            <span className="fd-funnel-label">LEADS</span>
          </div>

          <div className="fd-funnel-card" style={{ animationDelay: '160ms' }}>
            <div className="fd-funnel-val fn-amber">{Number(funnel.calls).toLocaleString('en-IN')}</div>
            <span className="fd-funnel-label">CALLS</span>
          </div>

          <div className="fd-funnel-card" style={{ animationDelay: '240ms' }}>
            <div className="fd-funnel-val fn-purple">{Number(funnel.connected).toLocaleString('en-IN')}</div>
            <span className="fd-funnel-label">CONNECTED</span>
          </div>

          <div className="fd-funnel-card" style={{ animationDelay: '320ms' }}>
            <div className="fd-funnel-val fn-emerald">{Number(funnel.interested).toLocaleString('en-IN')}</div>
            <span className="fd-funnel-label">INTERESTED</span>
          </div>

          <div className="fd-funnel-card" style={{ animationDelay: '400ms' }}>
            <div className="fd-funnel-val fn-teal">{Number(funnel.customers).toLocaleString('en-IN')}</div>
            <span className="fd-funnel-label">CUSTOMERS</span>
          </div>
        </div>

        {/* Sales Team Performance & Product Mix */}
        <div className="fd-analytics-grid">
          {/* Sales Team Performance Table */}
          <div className="fd-table-card">
            <h3 className="fd-card-title">Sales Team Performance</h3>
            <div className="chain-table-wrapper">
              <table className="fd-table">
                <thead>
                  <tr>
                    <th>AGENT</th>
                    <th>CALLS</th>
                    <th>CONNECTED</th>
                    <th>CONVERTED</th>
                  </tr>
                </thead>
                <tbody>
                  {salesTeam.map((row) => (
                    <tr key={row.name}>
                      <td className="td-agent">{row.name}</td>
                      <td style={{ color: '#475569', fontWeight: 600 }}>{Number(row.calls).toLocaleString('en-IN')}</td>
                      <td className="td-connected">{Number(row.connected).toLocaleString('en-IN')}</td>
                      <td className="td-converted">{Number(row.converted).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Product Mix Breakdown (Data-Driven Animated Progress Bars) */}
          <div className="fd-mix-card">
            <h3 className="fd-card-title">Product Mix & Revenue Contribution</h3>
            <div className="fd-mix-list">
              {productMix.map((p, idx) => (
                <div key={p.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                    <span style={{ color: '#172033' }}>{p.name}</span>
                    <strong style={{ color: '#14B8A6', fontWeight: 800 }}>{p.pct}%</strong>
                  </div>
                  <div className="fd-progress-track">
                    <div 
                      className="fd-progress-fill fill-launch" 
                      style={{ 
                        width: barsAnimated ? `${p.pct}%` : '0%',
                        transitionDelay: `${idx * 120}ms`
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FounderDashboardPage;