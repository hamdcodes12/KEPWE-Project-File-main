import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  ShieldCheck, 
  FileText, 
  TrendingUp, 
  CheckCircle2, 
  DollarSign, 
  Users, 
  Activity, 
  ArrowUpRight,
  Sparkles,
  PieChart,
  Calendar
} from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './PlatformShowcase.css';

// Observer-based Animated Count-Up Component
const AnimatedStatNumber = ({ endValue, prefix = '', suffix = '', decimals = 0, duration = 1800 }) => {
  const [displayVal, setDisplayVal] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let start = null;
    let frameId;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = endValue * easeOut;
      setDisplayVal(decimals > 0 ? current.toFixed(decimals) : Math.round(current));
      if (progress < 1) frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => { if (frameId) cancelAnimationFrame(frameId); };
  }, [endValue, decimals, duration, isVisible]);

  return <span ref={ref}>{prefix}{displayVal.toLocaleString('en-IN')}{suffix}</span>;
};

const PlatformShowcase = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [chartVisible, setChartVisible] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setChartVisible(true);
      },
      { threshold: 0.2 }
    );
    if (chartRef.current) observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);

  const barData = [
    { label: 'MAY', income: '70%', expense: '40%' },
    { label: 'JUN', income: '85%', expense: '48%' },
    { label: 'JUL', income: '65%', expense: '35%' },
    { label: 'AUG (EST)', income: '95%', expense: '52%' }
  ];

  return (
    <section className="platform-showcase-section">
      <div className="platform-container">
        {/* Section Header */}
        <ScrollReveal animation="fade-up" duration={700} className="platform-header">
          <div className="platform-eyebrow">
            <Sparkles size={14} />
            <span>ENTERPRISE OPERATING PLATFORM</span>
          </div>
          <h2 className="platform-title">One workspace. <span className="title-accent">Complete business visibility.</span></h2>
          <p className="platform-subtitle">
            Say goodbye to fragmented spreadsheets and opaque local accounting. Experience real-time financial control, automated compliance tracking, and direct CFO oversight.
          </p>

          {/* Interactive Feature Tabs */}
          <div className="platform-tabs">
            <button
              className={`platform-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Executive Cockpit
            </button>
            <button
              className={`platform-tab ${activeTab === 'gst' ? 'active' : ''}`}
              onClick={() => setActiveTab('gst')}
            >
              GST & Tax Radar
            </button>
            <button
              className={`platform-tab ${activeTab === 'payroll' ? 'active' : ''}`}
              onClick={() => setActiveTab('payroll')}
            >
              Payroll & Staff
            </button>
            <button
              className={`platform-tab ${activeTab === 'compliance' ? 'active' : ''}`}
              onClick={() => setActiveTab('compliance')}
            >
              ROC & Compliance
            </button>
          </div>
        </ScrollReveal>

        {/* Dashboard Visual Frame */}
        <ScrollReveal animation="reveal-3d-lift" duration={900} delay={150} className="platform-dashboard-frame">
          {/* Top Bar of Mock Application */}
          <div className="app-window-header">
            <div className="window-dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <div className="window-address-bar">
              <ShieldCheck size={14} color="#17E7C0" />
              <span>https://app.kepwe.com/business-workspace/live</span>
            </div>
            <div className="window-live-badge">
              <span className="pulse-dot"></span> LIVE DATA
            </div>
          </div>

          {/* Main Workspace Display */}
          <div className="app-workspace-body">
            {/* Top Stat Row */}
            <div className="workspace-stats-grid">
              <div className="workspace-stat-card">
                <div className="stat-meta">
                  <span className="stat-title">Monthly Cash Run-rate</span>
                  <ArrowUpRight size={16} color="#34D399" />
                </div>
                <div className="stat-val font-mono">
                  <AnimatedStatNumber endValue={4285000} prefix="₹" />
                </div>
                <div className="stat-sub text-positive">+14.2% vs previous month</div>
              </div>

              <div className="workspace-stat-card">
                <div className="stat-meta">
                  <span className="stat-title">GST ITC Reconciliation</span>
                  <CheckCircle2 size={16} color="#17E7C0" />
                </div>
                <div className="stat-val font-mono">
                  <AnimatedStatNumber endValue={99.8} suffix="% Matched" decimals={1} />
                </div>
                <div className="stat-sub">2B vs GSTR-3B verified</div>
              </div>

              <div className="workspace-stat-card">
                <div className="stat-meta">
                  <span className="stat-title">Compliance Health Index</span>
                  <ShieldCheck size={16} color="#17E7C0" />
                </div>
                <div className="stat-val font-mono" style={{ color: '#17E7C0' }}>
                  <AnimatedStatNumber endValue={98} suffix=" / 100" />
                </div>
                <div className="stat-sub">Zero pending penalty notices</div>
              </div>

              <div className="workspace-stat-card">
                <div className="stat-meta">
                  <span className="stat-title">Payroll Status</span>
                  <Users size={16} color="#60A5FA" />
                </div>
                <div className="stat-val font-mono">Completed</div>
                <div className="stat-sub">PF/ESI Challan Generated</div>
              </div>
            </div>

            {/* Middle Section: Financial Chart & Compliance Radar */}
            <div className="workspace-mid-grid">
              {/* Financial Performance Chart Box */}
              <div className="workspace-panel flex-2" ref={chartRef}>
                <div className="panel-header">
                  <div className="panel-title-group">
                    <BarChart3 size={18} color="#60A5FA" />
                    <h4>Financial Cashflow & Tax Liabilities (Q3 FY26)</h4>
                  </div>
                  <span className="panel-pill">REALTIME SYNC</span>
                </div>
                
                <div className="chart-preview-box">
                  {barData.map((b, i) => (
                    <div key={b.label} className="chart-bar-group">
                      <div className="bar-wrapper">
                        <div
                          className="bar income"
                          style={{
                            height: chartVisible ? b.income : '0%',
                            transition: `height 1600ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 500 + 200}ms`
                          }}
                        />
                        <div
                          className="bar expense"
                          style={{
                            height: chartVisible ? b.expense : '0%',
                            transition: `height 1600ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 500 + 450}ms`
                          }}
                        />
                      </div>
                      <span className="bar-label">{b.label}</span>
                    </div>
                  ))}
                </div>
                <div className="chart-legend">
                  <span><span className="legend-dot green"></span> Gross Revenue</span>
                  <span><span className="legend-dot blue"></span> Operating Expense</span>
                  <span><span className="legend-dot cyan"></span> Net Profit Margin (31.4%)</span>
                </div>
              </div>

              {/* Live Compliance Checklist Panel */}
              <div className="workspace-panel flex-1">
                <div className="panel-header">
                  <div className="panel-title-group">
                    <Calendar size={18} color="#17E7C0" />
                    <h4>Filing Schedule</h4>
                  </div>
                  <span className="panel-pill-success">ALL FILED</span>
                </div>

                <div className="compliance-checklist-mini">
                  <div className="checklist-row verified">
                    <CheckCircle2 size={16} className="check-icon" />
                    <div className="check-info">
                      <span className="check-title">GSTR-3B Monthly Return</span>
                      <span className="check-date">Filed on 18th • ARN: AA27082601</span>
                    </div>
                  </div>
                  <div className="checklist-row verified">
                    <CheckCircle2 size={16} className="check-icon" />
                    <div className="check-info">
                      <span className="check-title">PF / ESI Deposit Challan</span>
                      <span className="check-date">Cleared on 15th • Receipts Uploaded</span>
                    </div>
                  </div>
                  <div className="checklist-row verified">
                    <CheckCircle2 size={16} className="check-icon" />
                    <div className="check-info">
                      <span className="check-title">TDS Quarterly Deposit</span>
                      <span className="check-date">Challan 280 Verified</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default PlatformShowcase;
