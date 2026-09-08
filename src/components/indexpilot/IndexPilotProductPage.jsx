import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  TrendingUp, 
  ArrowRight, 
  BarChart2, 
  Activity, 
  ShieldAlert, 
  Layers, 
  Zap, 
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Sliders,
  Eye,
  LineChart
} from 'lucide-react';
import Button from '../ui/Button';
import VerdictDial from '../common/VerdictDial';
import IndexPilotPricingCards from './IndexPilotPricingCards';
import './IndexPilotProductPage.css';

const INDEX_CARDS = [
  { symbol: 'NIFTY 50', value: '24,850.40', change: '+1.2%', points: '+294.10', type: 'up', high: '24,890', low: '24,610' },
  { symbol: 'BANK NIFTY', value: '52,340.15', change: '+0.8%', points: '+415.80', type: 'up', high: '52,480', low: '51,920' },
  { symbol: 'SENSEX', value: '81,500.80', change: '+0.8%', points: '+640.25', type: 'up', high: '81,620', low: '80,950' },
  { symbol: 'INDIA VIX', value: '13.45', change: '-4.2%', points: '-0.58', type: 'down', high: '14.10', low: '13.20' }
];

const ANALYTICS_DATA = [
  { symbol: 'NIFTY 24800 CE', type: 'Call Option', oi: '42.8L', iv: '13.2%', signal: 'Bullish Build-up', risk: 'Defined Risk' },
  { symbol: 'NIFTY 24700 PE', type: 'Put Option', oi: '58.4L', iv: '14.1%', signal: 'Strong Support', risk: 'Defined Risk' },
  { symbol: 'BANKNIFTY 52000 PE', type: 'Put Option', oi: '31.2L', iv: '15.6%', signal: 'Put Writing', risk: 'Defined Risk' },
  { symbol: 'NIFTY 25000 CE', type: 'Call Option', oi: '64.1L', iv: '12.8%', signal: 'Major Resistance', risk: 'Cap Defined' },
  { symbol: 'FINNIFTY 23200 CE', type: 'Call Option', oi: '18.9L', iv: '14.5%', signal: 'Consolidation', risk: 'Low Vol' }
];

const FEATURE_CARDS = [
  {
    icon: BarChart2,
    title: 'Market Data',
    desc: 'Real-time index telemetry, price action, and sector breadth analytics.'
  },
  {
    icon: Layers,
    title: 'Indices',
    desc: 'Comprehensive coverage of NIFTY, BANK NIFTY, and SENSEX markets.'
  },
  {
    icon: Activity,
    title: 'Analytics',
    desc: 'Systematic risk profiling, option chain open interest, and volatility tracking.'
  },
  {
    icon: Zap,
    title: 'Signals',
    desc: 'Rule-based market regime and statistical trend identification.'
  },
  {
    icon: Sliders,
    title: 'Technical Tools',
    desc: 'Integrated risk calculators, position sizers, and spread builders.'
  },
  {
    icon: Compass,
    title: 'Market Insights',
    desc: 'Daily market context, qualitative breakdowns, and NO TRADE risk alerts.'
  }
];

const IndexPilotProductPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (window.location.hash === '#pricing' || window.location.hash === '#ip-pricing') {
      setTimeout(() => {
        const el = document.getElementById('pricing') || document.getElementById('ip-pricing');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="indexpilot-product-page">
      
      {/* ── 01. HERO SECTION ─────────────────────────────────────────── */}
      <section className="ip-hero-section">
        <div className="container">
          <div className="ip-hero-grid">
            
            {/* Left Hero Text */}
            <div className="ip-hero-text">
              <div className="ip-badge">
                <TrendingUp size={14} color="#214ECF" />
                <span>KEPWE INDEXPILOT</span>
              </div>

              <h1 className="ip-hero-headline">
                See the market <br />
                <span className="headline-accent">differently.</span>
              </h1>

              <p className="ip-hero-sub">
                Market data, indices, analytics, signals, and intelligent tools designed to help traders understand market movements.
              </p>

              <div className="ip-hero-actions">
                <Button variant="primary" size="lg" onClick={() => scrollToSection('ip-analytics')}>
                  Explore IndexPilot <ArrowRight size={18} />
                </Button>
                <Button variant="secondary" size="lg" onClick={() => navigate('/onboarding')}>
                  Get Started
                </Button>
              </div>

              <div className="ip-hero-trust-list">
                <div className="trust-item">
                  <CheckCircle2 size={16} color="#214ECF" />
                  <span>Defined-Risk Strategies Only (No Naked Options)</span>
                </div>
                <div className="trust-item">
                  <CheckCircle2 size={16} color="#12B76A" />
                  <span>Rule-Based Kepwe IQ Market Quality Score</span>
                </div>
              </div>
            </div>

            {/* Right Abstract Market Intelligence Window */}
            <div className="ip-hero-visual">
              <div className="ip-visual-window">
                <div className="visual-top-strip">
                  <span className="live-indicator">
                    <span className="live-pulse" /> LIVE TELEMETRY
                  </span>
                  <span className="visual-tag">NIFTY 50 REGIME: BULLISH</span>
                </div>

                {/* Conceptual Market Summary Cards */}
                <div className="ip-visual-cards-grid">
                  {INDEX_CARDS.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="ip-mini-data-card">
                      <span className="card-sym">{item.symbol}</span>
                      <span className="card-val">{item.value}</span>
                      <span className={`card-change ${item.type === 'up' ? 'text-green' : 'text-red'}`}>
                        {item.type === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {item.change} ({item.points})
                      </span>
                    </div>
                  ))}
                </div>

                {/* Minimal Chart Visual (Kepwe Blue Stroke, Clean Grid) */}
                <div className="ip-chart-preview-box">
                  <div className="chart-title-row">
                    <span className="c-title">Index Trend Telemetry</span>
                    <span className="c-sub">24,850 Support Level</span>
                  </div>

                  <svg className="ip-clean-chart-svg" viewBox="0 0 380 90" preserveAspectRatio="none">
                    <line x1="0" y1="20" x2="380" y2="20" stroke="#E4E7EC" strokeDasharray="3 3" />
                    <line x1="0" y1="55" x2="380" y2="55" stroke="#E4E7EC" strokeDasharray="3 3" />
                    <path 
                      d="M0,70 Q60,50 120,62 T240,35 T320,40 T380,15" 
                      fill="none" 
                      stroke="#214ECF" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                    />
                    <circle cx="380" cy="15" r="4" fill="#214ECF" />
                  </svg>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ── 02. MARKET OVERVIEW SECTION ─────────────────────────────── */}
      <section className="ip-overview-section">
        <div className="container">
          
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>MARKET OVERVIEW</span>
            </div>
            <h2 className="section-title">Major Indices & Volatility Radar</h2>
            <p className="section-sub">
              Track core benchmark indices with clean, un-crowded data displays.
            </p>
          </div>

          <div className="ip-indices-grid">
            {INDEX_CARDS.map((card, idx) => (
              <div key={idx} className="ip-index-card">
                <div className="index-card-head">
                  <span className="index-sym-name">{card.symbol}</span>
                  <span className={`index-change-pill ${card.type === 'up' ? 'pill-green' : 'pill-red'}`}>
                    {card.change}
                  </span>
                </div>
                <div className="index-val-num">{card.value}</div>
                <div className="index-card-range">
                  <span>H: {card.high}</span>
                  <span>L: {card.low}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>


      {/* ── 03. ANALYTICS SECTION (Turn market data into insight) ───── */}
      <section id="ip-analytics" className="ip-analytics-section">
        <div className="container">
          
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>ANALYTICS & INDICATORS</span>
            </div>
            <h2 className="section-title">Turn market data into insight.</h2>
            <p className="section-sub">
              Analyze market trend structures, option chain open interest, and key technical signals with clarity.
            </p>
          </div>

          {/* Main Chart + Supporting Indicators Grid */}
          <div className="ip-analytics-grid">
            
            {/* Left Primary Chart */}
            <div className="ip-primary-chart-card">
              <div className="chart-card-header">
                <div>
                  <h3 className="chart-box-title">NIFTY 50 Intraday Structure & Regimes</h3>
                  <span className="chart-box-sub">5-Minute Intervals · Kepwe Blue Telemetry</span>
                </div>
                <div className="chart-pills-group">
                  <span className="c-pill active">Intraday</span>
                  <span className="c-pill">Daily</span>
                  <span className="c-pill">Weekly</span>
                </div>
              </div>

              <svg className="ip-large-chart-svg" viewBox="0 0 650 180" preserveAspectRatio="none">
                <line x1="0" y1="40" x2="650" y2="40" stroke="#E4E7EC" strokeDasharray="4 4" />
                <line x1="0" y1="95" x2="650" y2="95" stroke="#E4E7EC" strokeDasharray="4 4" />
                <line x1="0" y1="140" x2="650" y2="140" stroke="#E4E7EC" strokeDasharray="4 4" />

                {/* Area Fill */}
                <path d="M0,150 Q110,80 220,110 T440,55 T650,25 L650,180 L0,180 Z" fill="rgba(33, 78, 207, 0.06)" />
                
                {/* Main Stroke */}
                <path d="M0,150 Q110,80 220,110 T440,55 T650,25" fill="none" stroke="#214ECF" strokeWidth="3" />
              </svg>
            </div>

            {/* Right Key Technical Indicators */}
            <div className="ip-indicators-column">
              <div className="indicator-card">
                <span className="ind-label">Market Trend</span>
                <span className="ind-val text-blue">Bullish Continuation</span>
                <span className="ind-sub">Above 20-EMA & 50-EMA</span>
              </div>

              <div className="indicator-card">
                <span className="ind-label">Volume & Breadth</span>
                <span className="ind-val text-green">Positive (1.85 Ratio)</span>
                <span className="ind-sub">Advances Outpacing Declines</span>
              </div>

              <div className="indicator-card">
                <span className="ind-label">Key Support / Resistance</span>
                <span className="ind-val">24,750 / 25,000</span>
                <span className="ind-sub">High Open Interest Concentration</span>
              </div>

              <div className="indicator-card">
                <span className="ind-label">Technical Signal</span>
                <span className="ind-val text-blue">Defined Risk Long</span>
                <span className="ind-sub">Bull Call Spread Recommended</span>
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* ── 04. DATA TABLE SECTION ───────────────────────────────────── */}
      <section className="ip-table-section">
        <div className="container">
          
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>MARKET DATA TABLE</span>
            </div>
            <h2 className="section-title">Option Chain & Derivative Analytics</h2>
            <p className="section-sub">
              Clean financial tables with structured rows and responsive container scrolling.
            </p>
          </div>

          <div className="ip-table-wrapper">
            <table className="ip-analytics-table">
              <thead>
                <tr>
                  <th>Symbol / Contract</th>
                  <th>Contract Type</th>
                  <th>Open Interest</th>
                  <th>Implied Volatility</th>
                  <th>Regime / Signal</th>
                  <th>Risk Profile</th>
                </tr>
              </thead>
              <tbody>
                {ANALYTICS_DATA.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-bold">{row.symbol}</td>
                    <td><span className="type-pill">{row.type}</span></td>
                    <td className="font-mono">{row.oi}</td>
                    <td className="font-mono">{row.iv}</td>
                    <td><span className="signal-pill">{row.signal}</span></td>
                    <td>
                      <span className="risk-status-tag">
                        <CheckCircle2 size={12} color="#12B76A" /> {row.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </section>


      {/* ── 05. MARKET INSIGHT VISUAL (Understand market movements) ─── */}
      <section className="ip-insight-section">
        <div className="container">
          <div className="ip-insight-box">
            
            <div className="section-eyebrow text-center" style={{ justifyContent: 'center' }}>
              <span className="eyebrow-blue-dot" />
              <span>DECISION SUPPORT</span>
            </div>
            <h2 className="section-title text-center">Understand market movements.</h2>
            <p className="section-sub text-center" style={{ maxWidth: '650px' }}>
              IndexPilot translates raw market feeds into a single glanceable reading — helping traders decide when to act and when to stay out.
            </p>

            {/* Included VerdictDial Component */}
            <div style={{ maxWidth: '780px', margin: '0 auto' }}>
              <VerdictDial
                verdict="TRADE"
                score={78}
                confidence={72}
                title="Bullish continuation bias above 24,750"
                reason="Breadth positive · OI build-up in favor of upside · IV cooling. Conditions currently support a directional view."
              />
            </div>

          </div>
        </div>
      </section>


      {/* ── 06. FEATURE CARDS (Built for Market Understanding) ───────── */}
      <section className="ip-features-section">
        <div className="container">
          
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>CAPABILITIES</span>
            </div>
            <h2 className="section-title">Built for Market Understanding</h2>
            <p className="section-sub">
              Systematic market tools designed for disciplined index traders.
            </p>
          </div>

          <div className="ip-features-grid">
            {FEATURE_CARDS.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={idx} className="ip-feature-card">
                  <div className="ip-feature-icon">
                    <Icon size={22} color="#214ECF" />
                  </div>
                  <h3 className="ip-feature-title">{card.title}</h3>
                  <p className="ip-feature-desc">{card.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>


      {/* ── 07. PRODUCT FLOW (DATA -> ANALYZE -> UNDERSTAND -> DECIDE) ── */}
      <section className="ip-flow-section">
        <div className="container">
          
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>THE INDEX INTELLIGENCE WORKFLOW</span>
            </div>
            <h2 className="section-title">From Data to Decision</h2>
          </div>

          <div className="ip-flow-grid">
            <div className="flow-step">
              <div className="flow-num">01</div>
              <h3 className="flow-title">DATA</h3>
              <p className="flow-desc">Collect live index telemetry, IV, and open interest.</p>
            </div>

            <div className="flow-arrow">↓</div>

            <div className="flow-step">
              <div className="flow-num">02</div>
              <h3 className="flow-title">ANALYZE</h3>
              <p className="flow-desc">Compute 8-factor composite Kepwe IQ quality score.</p>
            </div>

            <div className="flow-arrow">↓</div>

            <div className="flow-step">
              <div className="flow-num">03</div>
              <h3 className="flow-title">UNDERSTAND</h3>
              <p className="flow-desc">Identify market regime and defined-risk structures.</p>
            </div>

            <div className="flow-arrow">↓</div>

            <div className="flow-step">
              <div className="flow-num">04</div>
              <h3 className="flow-title">DECIDE</h3>
              <p className="flow-desc">Execute risk-defined trade or respect NO TRADE signal.</p>
            </div>
          </div>

        </div>
      </section>


      {/* ── 08. PRICING SECTION ─────────────────────────────────────── */}
      <section id="pricing" className="ip-pricing-section-container" style={{ padding: '80px 0', backgroundColor: '#F8FAFC', scrollMarginTop: '70px' }}>
        <div id="ip-pricing" className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <IndexPilotPricingCards
            showHeader={true}
            isModal={false}
          />
        </div>
      </section>


      {/* ── 09. CTA SECTION ─────────────────────────────────────────── */}
      <section className="ip-cta-section">
        <div className="container">
          <div className="ip-cta-box text-center">
            <h2 className="ip-cta-title">Understand the market with more clarity.</h2>
            <p className="ip-cta-sub">
              Bring market data and analytics into one intelligent experience.
            </p>
            <div className="ip-cta-actions">
              <Button variant="primary" size="lg" onClick={() => scrollToSection('ip-analytics')}>
                Explore IndexPilot <ArrowRight size={18} />
              </Button>
              <Button variant="secondary" size="lg" onClick={() => navigate('/onboarding')}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default IndexPilotProductPage;
