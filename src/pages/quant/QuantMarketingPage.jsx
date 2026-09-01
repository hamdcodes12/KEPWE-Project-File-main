import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  Download,
  ExternalLink,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  Link2,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Target,
  Terminal,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import './QuantMarketingPage.css';

// ─── 03. Strategy Marketplace Data ──────────────────────────────────────────
const MARKETPLACE_STRATEGIES = [
  {
    id: 'nifty-momentum-pulse',
    name: 'NIFTY Momentum Trend 5M',
    category: 'Trend Following',
    instrument: 'NIFTY 50 (F&O)',
    timeframe: '5 Min',
    riskLevel: 'Moderate',
    riskColor: '#F79009',
    historicalReturn: '+42.8%',
    period: '3Y Backtested',
    maxDrawdown: '-6.4%',
    winRate: '64.2%',
    profitFactor: '2.18',
    tradesCount: '1,280',
    description: 'Multi-timeframe EMA + Supertrend trend-following breakout model with dynamic trailing stop loss.',
    popular: true,
  },
  {
    id: 'banknifty-scalp-alpha',
    name: 'BANKNIFTY Scalper Pro',
    category: 'Scalping',
    instrument: 'BANK NIFTY (Options)',
    timeframe: '1 Min',
    riskLevel: 'High',
    riskColor: '#F04438',
    historicalReturn: '+58.4%',
    period: '2Y Backtested',
    maxDrawdown: '-8.9%',
    winRate: '68.5%',
    profitFactor: '2.42',
    tradesCount: '2,450',
    description: 'High-frequency opening range breakout (ORB) and VWAP mean-reversion with strict daily loss cap.',
    popular: false,
  },
  {
    id: 'finnifty-iron-condor',
    name: 'Delta Neutral Theta Harvester',
    category: 'Options Selling',
    instrument: 'FINNIFTY / NIFTY',
    timeframe: '15 Min',
    riskLevel: 'Low',
    riskColor: '#12B76A',
    historicalReturn: '+26.2%',
    period: '3Y Backtested',
    maxDrawdown: '-3.8%',
    winRate: '78.4%',
    profitFactor: '1.95',
    tradesCount: '620',
    description: 'Automated delta-neutral straddle/strangle adjustment engine designed for expiry day theta decay.',
    popular: false,
  },
  {
    id: 'alpha-equities-swing',
    name: 'Nifty Top 50 Momentum Swing',
    category: 'Cash Equities',
    instrument: 'NSE Top 50 Stocks',
    timeframe: 'Daily (EOD)',
    riskLevel: 'Moderate',
    riskColor: '#F79009',
    historicalReturn: '+34.6%',
    period: '5Y Backtested',
    maxDrawdown: '-5.2%',
    winRate: '61.8%',
    profitFactor: '2.05',
    tradesCount: '840',
    description: 'Relative strength index and ADX trend exhaustion filter across large-cap blue-chip equities.',
    popular: false,
  },
  {
    id: 'vwap-mean-revert',
    name: 'Intraday VWAP Band Reversion',
    category: 'Mean Reversion',
    instrument: 'NIFTY / BANKNIFTY',
    timeframe: '3 Min',
    riskLevel: 'Moderate',
    riskColor: '#F79009',
    historicalReturn: '+31.4%',
    period: '2Y Backtested',
    maxDrawdown: '-4.6%',
    winRate: '66.1%',
    profitFactor: '1.88',
    tradesCount: '1,560',
    description: 'Standard deviation band rejection strategy with rapid profit taking and zero overnight exposure.',
    popular: false,
  },
  {
    id: 'volatility-breakout-gamma',
    name: 'Gamma Surge Volatility Rider',
    category: 'Options Buying',
    instrument: 'Index Weekly Options',
    timeframe: '5 Min',
    riskLevel: 'High',
    riskColor: '#F04438',
    historicalReturn: '+62.1%',
    period: '2Y Backtested',
    maxDrawdown: '-9.4%',
    winRate: '54.7%',
    profitFactor: '2.65',
    tradesCount: '980',
    description: 'Captures explosive IV expansion and breakout surges near critical support/resistance pivots.',
    popular: true,
  },
];

// ─── 02. How It Works Steps ──────────────────────────────────────────────────
const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Discover',
    tagline: 'Strategy Architecture & Logic',
    description: 'Select proven algorithmic templates or define your custom quantitative logic with technical indicators, volume profiles, and multi-asset price triggers.',
    features: ['Pre-built alpha strategies', 'Visual rule builder', 'Python & Webhook inputs', 'Custom indicator equations'],
    icon: Sparkles,
  },
  {
    step: '02',
    title: 'Backtest',
    tagline: '5+ Years Tick-Level Validation',
    description: 'Stress-test your system against historical market regimes with realistic slippage modeling, brokerage fees, STT, and stamp duties before risking capital.',
    features: ['Tick-by-tick historical playback', 'Slippage & brokerage deductions', 'Sharpe & Sortino ratios', 'Max drawdown heatmaps'],
    icon: BarChart3,
  },
  {
    step: '03',
    title: 'Paper Trade',
    tagline: 'Real-Time Market Simulation',
    description: 'Deploy algorithms to our low-latency paper trading sandbox. Experience live market conditions, order queues, and fills with zero financial risk.',
    features: ['Simulated capital presets', '7/15/30-day testing cycles', 'Real-time orderbook simulation', 'Zero capital risk'],
    icon: Bot,
  },
  {
    step: '04',
    title: 'Automate',
    tagline: 'Guarded Broker Deployment',
    description: 'Connect Lemonn, Angel One, or supported brokers via direct OAuth. Every trade passes pre-execution risk checks, max loss caps, and kill-switch guards.',
    features: ['Sub-second order routing', 'Multi-broker connectivity', 'Automated token refresh', 'Pre-trade safety gate'],
    icon: Zap,
  },
  {
    step: '05',
    title: 'Monitor',
    tagline: 'Unified Command & Telemetry',
    description: 'Observe real-time telemetry, open positions, live P&L, execution latency, and automated risk thresholds from one institutional workspace.',
    features: ['Live execution stream', '1-click emergency kill switch', 'Mobile & webhook alerts', 'Post-trade audit journal'],
    icon: Gauge,
  },
];

// ─── 09. Broker Connections ──────────────────────────────────────────────────
const BROKER_LIST = [
  {
    name: 'Lemonn',
    category: 'Modern Discount Broker',
    status: 'Integration Ready',
    statusType: 'ready',
    logoLetter: 'L',
    logoColor: '#214ECF',
    description: 'Direct REST & WebSocket bridge prepared for automated order placement and live portfolio synchronization.',
  },
  {
    name: 'Angel One (SmartAPI)',
    category: 'Full-Service Tech Broker',
    status: 'Integration Ready',
    statusType: 'ready',
    logoLetter: 'A',
    logoColor: '#EA580C',
    description: 'Multi-asset trading engine adapter supporting equities, index F&O, and commodities with tokenized auth.',
  },
  {
    name: 'Zerodha (Kite Connect)',
    category: 'Discount Broker',
    status: 'Coming Soon',
    statusType: 'pending',
    logoLetter: 'Z',
    logoColor: '#059669',
    description: 'Adapter pipeline currently in development for standard Kite Connect API protocol.',
  },
  {
    name: 'Upstox',
    category: 'Algorithmic Trading Broker',
    status: 'Coming Soon',
    statusType: 'pending',
    logoLetter: 'U',
    logoColor: '#7C3AED',
    description: 'High-throughput order routing adapter in testing for HFT and intraday systematic setups.',
  },
  {
    name: 'Dhan (HQ API)',
    category: 'Superfast Trading Platform',
    status: 'Connection Pending',
    statusType: 'pending',
    logoLetter: 'D',
    logoColor: '#0284C7',
    description: 'Direct webhook and REST execution gateway planned for lightning-fast options automation.',
  },
  {
    name: 'Fyers',
    category: 'API-First Trading Broker',
    status: 'Connection Pending',
    statusType: 'pending',
    logoLetter: 'F',
    logoColor: '#D97706',
    description: 'Multi-leg option order execution module scheduled for Q4 deployment.',
  },
];

// ─── 11. Pricing Plans ───────────────────────────────────────────────────────
const PRICING_PLANS = [
  {
    name: 'Paper Sandbox',
    tagline: 'For learning & validating algorithms',
    price: '₹0',
    frequency: 'Free Forever',
    cta: 'Start Paper Trading',
    ctaRoute: '/quant/dashboard',
    highlighted: false,
    features: [
      'Unlimited Historical Backtesting (5 Yrs)',
      'Full Strategy Builder Canvas',
      'Paper Trading Sandbox with ₹10L simulated funds',
      'Standard Technical Indicators & Presets',
      'Daily Performance Summary Reports',
      'Community Support & Strategy Templates',
    ],
  },
  {
    name: 'Pro Trader',
    tagline: 'For active systematic & algo traders',
    price: '₹1,999',
    frequency: '/month (or ₹4,999/quarter)',
    badge: 'MOST POPULAR',
    cta: 'Start Pro Free Trial',
    ctaRoute: '/quant/dashboard',
    highlighted: true,
    features: [
      'Everything in Paper Sandbox',
      'Live Broker Automation (Lemonn & Angel One)',
      'Sub-Second Order Routing & Execution',
      'Institutional Risk Management & Kill Switch',
      'Custom Python & TradingView Webhooks',
      'Multi-Leg Option Strategy Execution',
      'Real-Time Telemetry & SMS/WhatsApp Alerts',
      'Priority Support & Dedicated Onboarding',
    ],
  },
  {
    name: 'Quant Enterprise',
    tagline: 'For prop desks & institutional funds',
    price: 'Custom',
    frequency: 'Annual Institutional Plan',
    cta: 'Talk to Quant Specialists',
    ctaRoute: '/contact',
    highlighted: false,
    features: [
      'Dedicated Low-Latency Cloud VPS Instance',
      'Direct FIX Protocol & Broker Gateway',
      'Custom Alpha Strategy Engineering',
      'Multi-Account Fund Management & Allocation',
      'Custom Risk Compliance Engine',
      '99.99% Execution SLA & 24/7 Phone Support',
      'Custom Database & Historical Tick Storage',
    ],
  },
];

// ─── 12. FAQs ────────────────────────────────────────────────────────────────
const QUANT_FAQS = [
  {
    q: 'What is KEPWE QUANT and how does it work?',
    a: 'KEPWE QUANT is a systematic, rule-based quantitative trading platform designed for Indian financial markets (NSE/BSE). It allows traders to build, backtest against 5+ years of historical market data, validate in a zero-risk paper trading environment, and automate execution through supported SEBI-registered brokers with strict institutional risk controls.',
  },
  {
    q: 'Do I need coding knowledge to build algorithms on KEPWE QUANT?',
    a: 'No. KEPWE QUANT offers a visual no-code Strategy Builder with intuitive dropdowns for signal logic, indicators (EMA, RSI, Supertrend, VWAP), position sizing, and risk parameters. For advanced quant engineers, we also support Python code scripts and TradingView Webhook triggers.',
  },
  {
    q: 'How does KEPWE QUANT protect against runaway losses?',
    a: 'Risk management is our highest priority. The platform enforces maximum loss per trade, hard stop losses, daily risk loss limits, maximum daily trades, consecutive-loss auto-pause, and a 1-click Emergency Kill Switch that immediately cancels pending orders and squares off open positions.',
  },
  {
    q: 'Are historical backtest returns guaranteed in live trading?',
    a: 'Never. In accordance with strict SEBI and financial best practices, KEPWE QUANT never claims guaranteed returns. Historical backtests reflect past performance under specific historical regimes. Live market conditions involve real-time slippage, volatility, and execution factors.',
  },
  {
    q: 'Does KEPWE QUANT hold my trading funds or broker passwords?',
    a: 'No. KEPWE is a technology platform, not a broker or custodian. Your funds and securities always remain in your own SEBI-registered broker account. We connect securely through official broker OAuth APIs with 256-bit encrypted credentials and never store your trading password or PIN.',
  },
  {
    q: 'Can I test my strategy without risking real money first?',
    a: 'Yes. Every user gets free, unlimited access to our Paper Trading Sandbox with simulated virtual capital. You can run algorithms for 7, 15, or 30 days in live market hours to observe order fills, drawdown, and strategy behavior before deploying any live capital.',
  },
];

export default function QuantMarketingPage() {
  const navigate = useNavigate();

  // Interactive State
  const [activeTab, setActiveTab] = useState('01');
  const [strategyCategory, setStrategyCategory] = useState('All');
  const [backtestCapital, setBacktestCapital] = useState(1000000);
  const [paperCapital, setPaperCapital] = useState(500000);
  const [paperDays, setPaperDays] = useState(15);
  const [openFaq, setOpenFaq] = useState(null);
  const [terminalTab, setTerminalTab] = useState('chart');

  const filteredStrategies = strategyCategory === 'All'
    ? MARKETPLACE_STRATEGIES
    : MARKETPLACE_STRATEGIES.filter((s) => s.category.toLowerCase().includes(strategyCategory.toLowerCase()) || s.instrument.toLowerCase().includes(strategyCategory.toLowerCase()));

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="quant-marketing-root">
      
      {/* ─── 01. HERO SECTION ───────────────────────────────────────────────── */}
      <section className="quant-hero-section">
        <div className="quant-hero-glow-mesh" aria-hidden="true" />
        
        <div className="quant-container">
          <div className="quant-hero-grid">
            
            {/* Left Hero Content */}
            <div className="quant-hero-content">
              
              <div className="quant-hero-badge">
                <span className="quant-badge-pulse" />
                <span>SYSTEMATIC ALGORITHMIC TRADING</span>
              </div>

              <h1 className="quant-hero-headline">
                Build. Backtest. <br />
                <span className="quant-gradient-text">Automate. Trade.</span>
              </h1>

              <p className="quant-hero-subhead">
                Turn your trading strategy into an automated, rule-based system. Stress-test against 5+ years of tick data, paper-trade in live market conditions, and deploy with institutional risk guardrails.
              </p>

              <div className="quant-hero-actions">
                <Link to="/quant/dashboard" className="quant-btn-primary">
                  <span>Start Trading Free</span>
                  <ArrowRight size={17} />
                </Link>
                <a href="#marketplace" className="quant-btn-secondary">
                  <span>Explore Strategies</span>
                  <ChevronDown size={16} />
                </a>
              </div>

              <div className="quant-hero-trust-strip">
                <div className="trust-item">
                  <CheckCircle2 size={16} className="trust-icon" />
                  <span>Sub-Second Execution</span>
                </div>
                <div className="trust-item">
                  <CheckCircle2 size={16} className="trust-icon" />
                  <span>Multi-Broker OAuth</span>
                </div>
                <div className="trust-item">
                  <CheckCircle2 size={16} className="trust-icon" />
                  <span>Zero Password Storage</span>
                </div>
                <div className="trust-item">
                  <CheckCircle2 size={16} className="trust-icon" />
                  <span>Hard Risk Guardrails</span>
                </div>
              </div>

            </div>

            {/* Right Hero Interactive Visual */}
            <div className="quant-hero-visual-col">
              <div className="quant-terminal-window">
                
                {/* Window Topbar */}
                <div className="terminal-topbar">
                  <div className="terminal-dots">
                    <span className="terminal-dot dot-red" />
                    <span className="terminal-dot dot-yellow" />
                    <span className="terminal-dot dot-green" />
                  </div>
                  <div className="terminal-title">
                    <Activity size={14} className="terminal-pulse-icon" />
                    <span>KEPWE QUANT WORKSPACE · NIFTY 50 LIVE TICKER</span>
                  </div>
                  <div className="terminal-tabs">
                    <button
                      className={`terminal-tab-btn ${terminalTab === 'chart' ? 'active' : ''}`}
                      onClick={() => setTerminalTab('chart')}
                    >
                      Chart & Signals
                    </button>
                    <button
                      className={`terminal-tab-btn ${terminalTab === 'rules' ? 'active' : ''}`}
                      onClick={() => setTerminalTab('rules')}
                    >
                      Rule Builder
                    </button>
                    <button
                      className={`terminal-tab-btn ${terminalTab === 'telemetry' ? 'active' : ''}`}
                      onClick={() => setTerminalTab('telemetry')}
                    >
                      Telemetry
                    </button>
                  </div>
                </div>

                {/* Window Main Content */}
                <div className="terminal-body">
                  
                  {terminalTab === 'chart' && (
                    <div className="terminal-view-chart">
                      {/* Metric Ribbon */}
                      <div className="terminal-metric-ribbon">
                        <div className="ribbon-item">
                          <span className="ribbon-label">INSTRUMENT</span>
                          <span className="ribbon-val">NIFTY 50 FUT</span>
                        </div>
                        <div className="ribbon-item">
                          <span className="ribbon-label">SPOT SIMULATION</span>
                          <span className="ribbon-val font-mono">24,845.20</span>
                        </div>
                        <div className="ribbon-item">
                          <span className="ribbon-label">ALGO STATE</span>
                          <span className="ribbon-badge-active">ACTIVE · SCANNING</span>
                        </div>
                        <div className="ribbon-item">
                          <span className="ribbon-label">GUARDRAIL</span>
                          <span className="ribbon-badge-safe">RISK ARMED</span>
                        </div>
                      </div>

                      {/* Mock Interactive Candlestick / Area Chart */}
                      <div className="terminal-chart-box">
                        <svg className="terminal-chart-svg" viewBox="0 0 500 180" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#214ECF" stopOpacity="0.35" />
                              <stop offset="100%" stopColor="#214ECF" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          {/* Grid Lines */}
                          <line x1="0" y1="40" x2="500" y2="40" stroke="#E4E7EC" strokeDasharray="3 3" />
                          <line x1="0" y1="90" x2="500" y2="90" stroke="#E4E7EC" strokeDasharray="3 3" />
                          <line x1="0" y1="140" x2="500" y2="140" stroke="#E4E7EC" strokeDasharray="3 3" />
                          
                          {/* Area Fill */}
                          <polygon
                            fill="url(#chartGrad)"
                            points="0,150 40,140 80,110 130,130 180,90 230,105 280,60 330,75 380,45 440,55 500,25 500,180 0,180"
                          />
                          {/* Main Line */}
                          <polyline
                            fill="none"
                            stroke="#214ECF"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points="0,150 40,140 80,110 130,130 180,90 230,105 280,60 330,75 380,45 440,55 500,25"
                          />
                          {/* Signal Trigger Point */}
                          <circle cx="280" cy="60" r="5" fill="#12B76A" />
                          <circle cx="280" cy="60" r="10" fill="#12B76A" opacity="0.3" />
                          <text x="285" y="50" fill="#12B76A" fontSize="11" fontWeight="700">BUY TRIGGER @ 24,780</text>
                        </svg>
                      </div>

                      {/* Live Execution Mini Logs */}
                      <div className="terminal-live-logs">
                        <div className="log-line success">
                          <span className="log-time">09:35:12</span>
                          <span className="log-msg">[SIGNAL] Supertrend(10,3) & RSI(14) Bullish Crossover detected on NIFTY 5M.</span>
                        </div>
                        <div className="log-line info">
                          <span className="log-time">09:35:13</span>
                          <span className="log-msg">[PRE-TRADE] Max Daily Loss cap (₹5,000) verified. Order routed via broker API.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {terminalTab === 'rules' && (
                    <div className="terminal-view-rules">
                      <div className="rule-card">
                        <div className="rule-badge">ENTRY CONDITION</div>
                        <div className="rule-statement">
                          <code>IF EMA(9) &gt; EMA(21) AND RSI(14) &gt; 58.00 AND Close &gt; VWAP</code>
                        </div>
                      </div>
                      <div className="rule-card">
                        <div className="rule-badge target">POSITION SIZING</div>
                        <div className="rule-statement">
                          <code>ALLOCATE 1.5% of Total Margin · Max 2 Lots · Trailing SL 25 Pts</code>
                        </div>
                      </div>
                      <div className="rule-card">
                        <div className="rule-badge risk">GUARDRAIL KILL SWITCH</div>
                        <div className="rule-statement">
                          <code>AUTO-HALT TRADING IF Day Loss &gt; ₹5,000 OR 3 Consecutive Losses</code>
                        </div>
                      </div>
                    </div>
                  )}

                  {terminalTab === 'telemetry' && (
                    <div className="terminal-view-telemetry">
                      <div className="telemetry-grid">
                        <div className="telemetry-box">
                          <span className="t-label">API Latency</span>
                          <span className="t-val text-green font-mono">18ms</span>
                          <span className="t-sub">Sub-second direct routing</span>
                        </div>
                        <div className="telemetry-box">
                          <span className="t-label">Slippage Tolerance</span>
                          <span className="t-val font-mono">0.05%</span>
                          <span className="t-sub">Smart limit execution</span>
                        </div>
                        <div className="telemetry-box">
                          <span className="t-label">OAuth Auth State</span>
                          <span className="t-val text-blue font-mono">Valid · Encrypted</span>
                          <span className="t-sub">AES-256 Session Key</span>
                        </div>
                        <div className="telemetry-box">
                          <span className="t-label">Auto Square-Off</span>
                          <span className="t-val font-mono">15:15 IST</span>
                          <span className="t-sub">Intraday safety rule</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Window Footer */}
                <div className="terminal-footer">
                  <div className="footer-status">
                    <span className="footer-status-dot" />
                    <span>ENGINE OPERATIONAL · SIMULATED DEMO FEED</span>
                  </div>
                  <Link to="/quant/dashboard" className="footer-explore-btn">
                    <span>Open Full Quant Workspace</span>
                    <ArrowUpRight size={13} />
                  </Link>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── 02. HOW KEPWE QUANT WORKS (5-STEP JOURNEY) ──────────────────────── */}
      <section className="quant-how-section" id="how-it-works">
        <div className="quant-container">
          
          <div className="quant-section-head text-center">
            <div className="quant-eyebrow">
              <span className="eyebrow-dot" />
              <span>THE QUANTITATIVE JOURNEY</span>
            </div>
            <h2 className="quant-section-title">How Kepwe Quant Works</h2>
            <p className="quant-section-sub">
              From discovering statistical edge to deploying safe, automated execution in 5 disciplined stages.
            </p>
          </div>

          {/* Step Selector Buttons */}
          <div className="quant-step-selector-row">
            {HOW_IT_WORKS_STEPS.map((st) => (
              <button
                key={st.step}
                className={`quant-step-pill ${activeTab === st.step ? 'active' : ''}`}
                onClick={() => setActiveTab(st.step)}
              >
                <span className="step-num">{st.step}</span>
                <span className="step-label">{st.title}</span>
              </button>
            ))}
          </div>

          {/* Active Step Detailed Card */}
          {HOW_IT_WORKS_STEPS.filter((s) => s.step === activeTab).map((st) => {
            const IconComponent = st.icon;
            return (
              <div key={st.step} className="quant-step-display-card">
                <div className="step-card-grid">
                  
                  <div className="step-card-left">
                    <div className="step-indicator-row">
                      <span className="step-big-number">{st.step}</span>
                      <span className="step-tagline">{st.tagline}</span>
                    </div>
                    <h3 className="step-card-title">{st.title} Your Quantitative Edge</h3>
                    <p className="step-card-desc">{st.description}</p>
                    
                    <div className="step-features-list">
                      {st.features.map((feat, idx) => (
                        <div key={idx} className="step-feature-item">
                          <Check size={16} className="feature-check" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    <div className="step-action-row">
                      <Link to="/quant/dashboard" className="quant-btn-primary quant-btn-compact">
                        <span>Experience Step {st.step} in Sandbox</span>
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>

                  <div className="step-card-right">
                    <div className="step-visual-box">
                      <div className="step-visual-icon-wrap">
                        <IconComponent size={44} className="step-visual-icon" />
                      </div>
                      <h4 className="step-visual-heading">{st.title} Architecture</h4>
                      <p className="step-visual-text">
                        Engineered with institutional safety checks and sub-second deterministic routing.
                      </p>
                      <div className="step-visual-badges">
                        <span className="step-badge">Deterministic</span>
                        <span className="step-badge">Audited Logic</span>
                        <span className="step-badge">Risk Guarded</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}

        </div>
      </section>

      {/* ─── 03. STRATEGY MARKETPLACE ───────────────────────────────────────── */}
      <section className="quant-marketplace-section" id="marketplace">
        <div className="quant-container">
          
          <div className="quant-section-head text-center">
            <div className="quant-eyebrow">
              <span className="eyebrow-dot" />
              <span>ALGORITHMIC ALPHA REPOSITORY</span>
            </div>
            <h2 className="quant-section-title">Strategy Marketplace</h2>
            <p className="quant-section-sub">
              Explore battle-tested quantitative strategies with verified historical backtests, transparent drawdowns, and complete logic explainability.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="quant-filter-row">
            {['All', 'Trend', 'Scalping', 'Options', 'Equities', 'Mean Reversion'].map((cat) => (
              <button
                key={cat}
                className={`quant-filter-pill ${strategyCategory === cat ? 'active' : ''}`}
                onClick={() => setStrategyCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Strategy Cards Grid */}
          <div className="quant-strategy-grid">
            {filteredStrategies.map((strat) => (
              <div key={strat.id} className={`quant-strategy-card ${strat.popular ? 'featured-card' : ''}`}>
                
                {/* Card Top */}
                <div className="strat-card-header">
                  <div>
                    <span className="strat-category-tag">{strat.category}</span>
                    <h3 className="strat-name">{strat.name}</h3>
                  </div>
                  {strat.popular && <span className="strat-popular-badge"><Flame size={12} /> POPULAR</span>}
                </div>

                <div className="strat-meta-row">
                  <span className="meta-pill">Instrument: <strong>{strat.instrument}</strong></span>
                  <span className="meta-pill">Timeframe: <strong>{strat.timeframe}</strong></span>
                  <span className="meta-pill" style={{ color: strat.riskColor, borderColor: strat.riskColor }}>
                    Risk: <strong>{strat.riskLevel}</strong>
                  </span>
                </div>

                <p className="strat-desc">{strat.description}</p>

                {/* Strategy Backtest Metrics */}
                <div className="strat-metrics-grid">
                  <div className="metric-box">
                    <span className="m-label">Historical CAGR</span>
                    <span className="m-val text-green font-mono">{strat.historicalReturn}</span>
                    <span className="m-sub">{strat.period}</span>
                  </div>
                  <div className="metric-box">
                    <span className="m-label">Max Drawdown</span>
                    <span className="m-val text-red font-mono">{strat.maxDrawdown}</span>
                    <span className="m-sub">Peak to trough</span>
                  </div>
                  <div className="metric-box">
                    <span className="m-label">Win Rate</span>
                    <span className="m-val font-mono">{strat.winRate}</span>
                    <span className="m-sub">Hit ratio</span>
                  </div>
                  <div className="metric-box">
                    <span className="m-label">Profit Factor</span>
                    <span className="m-val font-mono">{strat.profitFactor}</span>
                    <span className="m-sub">{strat.tradesCount} Trades</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="strat-card-footer">
                  <Link to="/quant/dashboard" className="strat-cta-btn">
                    <span>Backtest / Paper Trade</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>

              </div>
            ))}
          </div>

          {/* Important Regulatory Disclaimer */}
          <div className="quant-disclaimer-box">
            <ShieldAlert size={18} className="disclaimer-icon" />
            <div>
              <strong>Verified Historical Data Notice:</strong>
              <p>
                Performance statistics displayed above are generated from historical tick backtests and simulated modeling. They do not constitute investment advice or guarantee future returns. KEPWE QUANT never fabricates live financial returns. Live trading requires explicit broker authorization and client risk acknowledgement.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ─── 04. BACKTESTING ENGINE ─────────────────────────────────────────── */}
      <section className="quant-backtest-section" id="backtesting">
        <div className="quant-container">
          
          <div className="quant-section-head text-center">
            <div className="quant-eyebrow">
              <span className="eyebrow-dot" />
              <span>INSTITUTIONAL SIMULATION ENGINE</span>
            </div>
            <h2 className="quant-section-title">Deep Backtesting Engine</h2>
            <p className="quant-section-sub">
              Simulate your strategy across 5+ years of Indian market history with realistic slippage, brokerage, STT, exchange turnover fees, and stamp duties.
            </p>
          </div>

          <div className="quant-backtest-layout">
            
            {/* Left Controls */}
            <div className="backtest-controls-panel">
              <h3 className="panel-title">
                <SlidersHorizontal size={18} />
                <span>Simulation Parameters</span>
              </h3>

              <div className="control-group">
                <label>Historical Period</label>
                <div className="control-segmented">
                  <button className="active">3 Years (2023–2026)</button>
                  <button>5 Years (2021–2026)</button>
                </div>
              </div>

              <div className="control-group">
                <div className="control-label-row">
                  <label>Simulated Starting Capital</label>
                  <span className="font-mono font-bold">₹{(backtestCapital).toLocaleString('en-IN')}</span>
                </div>
                <input
                  type="range"
                  min="200000"
                  max="5000000"
                  step="100000"
                  value={backtestCapital}
                  onChange={(e) => setBacktestCapital(Number(e.target.value))}
                  className="quant-slider"
                />
              </div>

              <div className="control-group">
                <label>Brokerage & Friction Modeling</label>
                <div className="friction-checklist">
                  <div className="friction-item">
                    <Check size={14} className="text-green" />
                    <span>₹20/Order Exchange Brokerage</span>
                  </div>
                  <div className="friction-item">
                    <Check size={14} className="text-green" />
                    <span>0.0125% Securities Transaction Tax (STT)</span>
                  </div>
                  <div className="friction-item">
                    <Check size={14} className="text-green" />
                    <span>0.05% Bid-Ask Slippage Model</span>
                  </div>
                  <div className="friction-item">
                    <Check size={14} className="text-green" />
                    <span>GST (18%) & Stamp Duty Charges</span>
                  </div>
                </div>
              </div>

              <Link to="/quant/dashboard" className="quant-btn-primary full-width">
                <Play size={15} />
                <span>Run Full Backtest in Workspace</span>
              </Link>
            </div>

            {/* Right Backtest Results Showcase */}
            <div className="backtest-results-panel">
              <div className="results-header">
                <div>
                  <span className="results-eyebrow">BACKTEST REPORT SAMPLE · NIFTY 50 5M</span>
                  <h4 className="results-title">Net Cumulative Returns (Post-Friction)</h4>
                </div>
                <span className="results-status-tag">AUDITED MODEL</span>
              </div>

              {/* KPI Grid */}
              <div className="backtest-kpi-grid">
                <div className="kpi-card">
                  <span className="kpi-label">Net Profit (P&L)</span>
                  <span className="kpi-val text-green font-mono">+₹{Math.round(backtestCapital * 0.428).toLocaleString('en-IN')}</span>
                  <span className="kpi-sub">+42.8% Total Return</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Sharpe Ratio</span>
                  <span className="kpi-val font-mono">1.94</span>
                  <span className="kpi-sub">Risk-adjusted return</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Max Drawdown</span>
                  <span className="kpi-val text-red font-mono">-6.4%</span>
                  <span className="kpi-sub">Max peak drop</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Win Rate</span>
                  <span className="kpi-val font-mono">64.2%</span>
                  <span className="kpi-sub">822/1,280 Trades</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Profit Factor</span>
                  <span className="kpi-val font-mono">2.18</span>
                  <span className="kpi-sub">Gross Win / Gross Loss</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Avg Trade Win/Loss</span>
                  <span className="kpi-val font-mono">₹1,840 / -₹920</span>
                  <span className="kpi-sub">1:2.0 Risk-Reward</span>
                </div>
              </div>

              <div className="backtest-chart-preview">
                <div className="chart-preview-legend">
                  <span><span className="dot blue" /> Strategy Cumulative Return</span>
                  <span><span className="dot gray" /> NIFTY 50 Buy & Hold</span>
                </div>
                <svg className="preview-chart-svg" viewBox="0 0 450 110" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="#98A2B3"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    points="0,85 80,80 160,75 240,65 320,60 400,50 450,45"
                  />
                  <polyline
                    fill="none"
                    stroke="#214ECF"
                    strokeWidth="2.5"
                    points="0,95 60,90 120,70 180,75 240,45 300,50 360,25 450,15"
                  />
                </svg>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ─── 05. PAPER TRADING ──────────────────────────────────────────────── */}
      <section className="quant-paper-section" id="paper-trading">
        <div className="quant-container">
          
          <div className="quant-paper-box">
            <div className="paper-grid">
              
              <div className="paper-left">
                <div className="paper-badge">
                  <Bot size={15} />
                  <span>ZERO RISK SIMULATION</span>
                </div>
                <h2 className="paper-heading">Test your strategy without risking real money.</h2>
                <p className="paper-sub">
                  Validate your algorithm in live market hours with simulated virtual funds. Test fill rates, slippage behavior, and psychological comfort before connecting real capital.
                </p>

                <div className="paper-slider-box">
                  <div className="slider-header">
                    <span>Simulated Capital Preset</span>
                    <span className="capital-val font-mono">₹{paperCapital.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="paper-preset-btns">
                    {[100000, 250000, 500000, 1000000].map((amt) => (
                      <button
                        key={amt}
                        className={`preset-btn ${paperCapital === amt ? 'active' : ''}`}
                        onClick={() => setPaperCapital(amt)}
                      >
                        ₹{(amt / 100000)} Lakh
                      </button>
                    ))}
                  </div>
                </div>

                <div className="paper-duration-row">
                  <span>Validation Cycle:</span>
                  {[7, 15, 30].map((d) => (
                    <button
                      key={d}
                      className={`duration-pill ${paperDays === d ? 'active' : ''}`}
                      onClick={() => setPaperDays(d)}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>

                <div className="paper-cta-row">
                  <Link to="/quant/dashboard" className="quant-btn-primary">
                    <span>Launch Paper Trading Sandbox</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="paper-right">
                <div className="paper-sim-card">
                  <div className="sim-header">
                    <div className="sim-status">
                      <span className="status-live-dot" />
                      <span>PAPER RUN · {paperDays}-DAY CYCLE</span>
                    </div>
                    <span className="sim-badge">REAL-TIME FEED</span>
                  </div>

                  <div className="sim-metric-row">
                    <div className="sim-box">
                      <span className="s-label">Simulated P&L</span>
                      <span className="s-val text-green font-mono">+₹{Math.round(paperCapital * 0.084).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="sim-box">
                      <span className="s-label">Win Rate</span>
                      <span className="s-val font-mono">68.2%</span>
                    </div>
                  </div>

                  <div className="sim-order-stream">
                    <div className="stream-header">Simulated Order Fills (Recent)</div>
                    <div className="order-item">
                      <span className="order-side buy">BUY</span>
                      <span className="order-info">NIFTY 24800 CE · 2 Lots</span>
                      <span className="order-price font-mono">@ ₹142.50</span>
                      <span className="order-state">FILLED</span>
                    </div>
                    <div className="order-item">
                      <span className="order-side sell">SELL</span>
                      <span className="order-info">NIFTY 24800 CE · Target Hit</span>
                      <span className="order-price font-mono">@ ₹176.00</span>
                      <span className="order-state profit">+₹1,675</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ─── 06. LIVE AUTOMATION & EXECUTION ENGINE ─────────────────────────── */}
      <section className="quant-automation-section">
        <div className="quant-container">
          
          <div className="quant-section-head text-center">
            <div className="quant-eyebrow">
              <span className="eyebrow-dot" />
              <span>HIGH-PERFORMANCE EXECUTION</span>
            </div>
            <h2 className="quant-section-title">Live Automated Execution Pipeline</h2>
            <p className="quant-section-sub">
              Sub-second trade routing designed with determinism, strict pre-trade safety gates, and direct broker integration.
            </p>
          </div>

          <div className="pipeline-grid">
            <div className="pipeline-step-card">
              <div className="p-num">01</div>
              <h3 className="p-title">Signal Ingestion</h3>
              <p className="p-desc">
                Engine evaluates technical indicators, multi-timeframe candle close, or external Webhooks in sub-20ms.
              </p>
            </div>
            <div className="pipeline-step-card">
              <div className="p-num">02</div>
              <h3 className="p-title">Pre-Trade Safety Gate</h3>
              <p className="p-desc">
                Checks max loss limits, daily trade count, consecutive losses, and current margin before placing order.
              </p>
            </div>
            <div className="pipeline-step-card">
              <div className="p-num">03</div>
              <h3 className="p-title">Smart Order Routing</h3>
              <p className="p-desc">
                Dispatches limit / market order with automated bracket SL & target triggers to connected broker API.
              </p>
            </div>
            <div className="pipeline-step-card">
              <div className="p-num">04</div>
              <h3 className="p-title">Real-Time Telemetry</h3>
              <p className="p-desc">
                Fills are instantly confirmed, trailing stop loss is managed, and trade journal is updated in real time.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ─── 07. RISK MANAGEMENT ────────────────────────────────────────────── */}
      <section className="quant-risk-section" id="risk-management">
        <div className="quant-container">
          
          <div className="quant-risk-grid">
            
            <div className="risk-text-col">
              <div className="quant-eyebrow">
                <span className="eyebrow-dot" />
                <span>INSTITUTIONAL RISK PROTOCOLS</span>
              </div>
              <h2 className="risk-heading">Discipline is hardcoded. Not optional.</h2>
              <p className="risk-desc">
                The best algorithmic strategy fails without ironclad risk management. KEPWE QUANT puts protective guardrails between your capital and market volatility.
              </p>

              <div className="risk-features-list">
                <div className="risk-feature-card">
                  <ShieldCheck size={20} className="risk-icon" />
                  <div>
                    <h4>Maximum Loss Per Trade</h4>
                    <p>Hard stop-loss automatically sent with every order. Never hold a losing position hoping it recovers.</p>
                  </div>
                </div>
                <div className="risk-feature-card">
                  <ShieldCheck size={20} className="risk-icon" />
                  <div>
                    <h4>Daily Max Loss Threshold</h4>
                    <p>Automated circuit breaker halts all new order generation when daily loss limit is touched.</p>
                  </div>
                </div>
                <div className="risk-feature-card">
                  <ShieldCheck size={20} className="risk-icon" />
                  <div>
                    <h4>Consecutive-Loss Auto-Pause</h4>
                    <p>Protects capital against non-trending market chop by pausing strategy after 3 consecutive stop-outs.</p>
                  </div>
                </div>
                <div className="risk-feature-card">
                  <ShieldCheck size={20} className="risk-icon" />
                  <div>
                    <h4>1-Click Emergency Kill Switch</h4>
                    <p>Instantly cancel all pending orders and square off all open positions with a single click.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="risk-visual-col">
              <div className="risk-control-box">
                <div className="risk-box-header">
                  <Shield size={18} className="text-blue" />
                  <span>RISK PARAMETER CONFIGURATION</span>
                </div>

                <div className="risk-control-item">
                  <div className="item-meta">
                    <span className="name">Max Loss Per Trade</span>
                    <span className="badge">Configured</span>
                  </div>
                  <div className="item-val font-mono">₹1,500 / Trade (1.5%)</div>
                </div>

                <div className="risk-control-item">
                  <div className="item-meta">
                    <span className="name">Daily Loss Limit</span>
                    <span className="badge">Hard Cap</span>
                  </div>
                  <div className="item-val font-mono">₹5,000 / Day</div>
                </div>

                <div className="risk-control-item">
                  <div className="item-meta">
                    <span className="name">Max Trades Per Session</span>
                    <span className="badge">Intraday</span>
                  </div>
                  <div className="item-val font-mono">4 Trades Maximum</div>
                </div>

                <div className="risk-control-item">
                  <div className="item-meta">
                    <span className="name">Consecutive Loss Lockout</span>
                    <span className="badge">Safety Shield</span>
                  </div>
                  <div className="item-val font-mono">Pause after 3 Stop-Outs</div>
                </div>

                {/* Kill Switch Mock */}
                <div className="kill-switch-box">
                  <div className="ks-info">
                    <strong>EMERGENCY KILL SWITCH</strong>
                    <span>Cancels pending orders & squares off all live positions immediately</span>
                  </div>
                  <button className="kill-switch-btn" onClick={() => alert('Kill switch is ready in authenticated workspace.')}>
                    ARMED · READY
                  </button>
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 08. SUPPORTED INSTRUMENTS ──────────────────────────────────────── */}
      <section className="quant-instruments-section">
        <div className="quant-container">
          
          <div className="quant-section-head text-center">
            <div className="quant-eyebrow">
              <span className="eyebrow-dot" />
              <span>MULTI-ASSET COVERAGE</span>
            </div>
            <h2 className="quant-section-title">Supported Trading Instruments</h2>
            <p className="quant-section-sub">
              Execute systematic quantitative strategies across all major Indian market segments.
            </p>
          </div>

          <div className="instruments-grid">
            <div className="instrument-card">
              <div className="inst-icon-wrap"><Activity size={24} /></div>
              <h3>Index Futures & Options</h3>
              <p>NIFTY 50, BANK NIFTY, FINNIFTY, and MIDCPNIFTY weekly and monthly contracts with Greeks calculation.</p>
              <span className="inst-badge">Active Market</span>
            </div>
            <div className="instrument-card">
              <div className="inst-icon-wrap"><TrendingUp size={24} /></div>
              <h3>NSE Cash Equities</h3>
              <p>Liquid Nifty 50, Nifty Next 50, and Midcap 100 shares for momentum and trend-following swing models.</p>
              <span className="inst-badge">Active Market</span>
            </div>
            <div className="instrument-card">
              <div className="inst-icon-wrap"><Cpu size={24} /></div>
              <h3>Stock Futures & Options</h3>
              <p>High-beta single-stock derivatives for breakout, volatility expansion, and earnings straddle models.</p>
              <span className="inst-badge">Active Market</span>
            </div>
            <div className="instrument-card">
              <div className="inst-icon-wrap"><Layers size={24} /></div>
              <h3>Commodities & Currencies</h3>
              <p>Gold, Silver, Crude Oil, and Natural Gas on MCX (Architecture ready for upcoming broker rollout).</p>
              <span className="inst-badge ready">Integration Ready</span>
            </div>
          </div>

        </div>
      </section>

      {/* ─── 09. BROKER & API INTEGRATIONS ──────────────────────────────────── */}
      <section className="quant-brokers-section" id="brokers">
        <div className="quant-container">
          
          <div className="quant-section-head text-center">
            <div className="quant-eyebrow">
              <span className="eyebrow-dot" />
              <span>BROKER CONNECTIVITY</span>
            </div>
            <h2 className="quant-section-title">Seamless Broker Integrations</h2>
            <p className="quant-section-sub">
              Connect your preferred SEBI-registered broker account with bank-grade 256-bit AES encryption and OAuth security.
            </p>
          </div>

          <div className="brokers-grid">
            {BROKER_LIST.map((b) => (
              <div key={b.name} className="broker-card">
                <div className="broker-card-top">
                  <span className="broker-logo-avatar" style={{ backgroundColor: b.logoColor }}>
                    {b.logoLetter}
                  </span>
                  <span className={`broker-status-tag ${b.statusType}`}>
                    {b.status}
                  </span>
                </div>
                <h3 className="broker-name">{b.name}</h3>
                <span className="broker-cat">{b.category}</span>
                <p className="broker-desc">{b.description}</p>
                <div className="broker-card-foot">
                  <ShieldCheck size={14} className="text-blue" />
                  <span>Encrypted OAuth Flow</span>
                </div>
              </div>
            ))}
          </div>

          <div className="quant-source-note text-center">
            <HelpCircle size={15} />
            <span>
              KEPWE QUANT never fakes broker connections. Unconfigured providers are transparently labeled as "Integration Ready" or "Coming Soon". Live credentials are never assumed or fabricated.
            </span>
          </div>

        </div>
      </section>

      {/* ─── 10. PERFORMANCE DASHBOARD SHOWCASE ─────────────────────────────── */}
      <section className="quant-showcase-section">
        <div className="quant-container">
          
          <div className="quant-showcase-box">
            <div className="showcase-content">
              <div className="quant-eyebrow">
                <span className="eyebrow-dot" />
                <span>UNIFIED WORKSPACE</span>
              </div>
              <h2 className="showcase-title">Your Quantitative Command Center</h2>
              <p className="showcase-desc">
                Everything you need to monitor execution, manage open positions, review P&L analytics, and build strategies in one focused desktop workspace.
              </p>

              <div className="showcase-features-grid">
                <div className="s-feat">
                  <Activity size={18} className="text-blue" />
                  <span>Real-Time Watchlist & Market Pulse</span>
                </div>
                <div className="s-feat">
                  <Bot size={18} className="text-blue" />
                  <span>Visual 4-Step Strategy Canvas</span>
                </div>
                <div className="s-feat">
                  <ShieldCheck size={18} className="text-blue" />
                  <span>Live Risk Status & Loss Limit Guards</span>
                </div>
                <div className="s-feat">
                  <BarChart3 size={18} className="text-blue" />
                  <span>P&L Attribution & Trade Journal</span>
                </div>
              </div>

              <div className="showcase-actions">
                <Link to="/quant/dashboard" className="quant-btn-primary">
                  <span>Enter Quant Workspace</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── 11. PRICING PLANS ──────────────────────────────────────────────── */}
      <section className="quant-pricing-section" id="pricing">
        <div className="quant-container">
          
          <div className="quant-section-head text-center">
            <div className="quant-eyebrow">
              <span className="eyebrow-dot" />
              <span>TRANSPARENT PRICING</span>
            </div>
            <h2 className="quant-section-title">Plans Designed For Every Quantitative Stage</h2>
            <p className="quant-section-sub">
              Start with paper trading for free, upgrade when you’re ready to deploy live algorithms to your broker.
            </p>
          </div>

          <div className="quant-pricing-grid">
            {PRICING_PLANS.map((plan) => (
              <div key={plan.name} className={`quant-pricing-card ${plan.highlighted ? 'highlighted' : ''}`}>
                {plan.badge && <span className="pricing-badge">{plan.badge}</span>}
                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-tagline">{plan.tagline}</p>
                
                <div className="plan-price-row">
                  <span className="price-num">{plan.price}</span>
                  <span className="price-freq">{plan.frequency}</span>
                </div>

                <Link to={plan.ctaRoute} className={`plan-cta-btn ${plan.highlighted ? 'primary' : 'secondary'}`}>
                  <span>{plan.cta}</span>
                  <ArrowRight size={15} />
                </Link>

                <div className="plan-features-list">
                  <span className="features-heading">WHAT'S INCLUDED:</span>
                  {plan.features.map((f, idx) => (
                    <div key={idx} className="feature-item">
                      <Check size={16} className="text-green" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── 12. FAQ SECTION ────────────────────────────────────────────────── */}
      <section className="quant-faq-section" id="faq">
        <div className="quant-container">
          
          <div className="quant-section-head text-center">
            <div className="quant-eyebrow">
              <span className="eyebrow-dot" />
              <span>FREQUENTLY ASKED QUESTIONS</span>
            </div>
            <h2 className="quant-section-title">Answers to Common Questions</h2>
            <p className="quant-section-sub">
              Everything you need to know about KEPWE QUANT, safety guardrails, and broker connectivity.
            </p>
          </div>

          <div className="quant-faq-accordion-list">
            {QUANT_FAQS.map((faq, index) => (
              <div key={index} className={`quant-faq-item ${openFaq === index ? 'open' : ''}`}>
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={openFaq === index}
                >
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className="faq-chevron" />
                </button>
                {openFaq === index && (
                  <div className="faq-answer-panel">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── 13. FINAL CTA ──────────────────────────────────────────────────── */}
      <section className="quant-final-cta-section">
        <div className="quant-container">
          <div className="quant-final-cta-card">
            <div className="cta-content text-center">
              <div className="quant-eyebrow">
                <span className="eyebrow-dot" />
                <span>START YOUR QUANTITATIVE JOURNEY</span>
              </div>
              <h2 className="cta-headline">Ready to turn your trading strategy into an automated system?</h2>
              <p className="cta-sub">
                Join thousands of disciplined traders building, backtesting, and automating algorithmic models on KEPWE QUANT.
              </p>
              
              <div className="cta-btn-group">
                <Link to="/quant/dashboard" className="quant-btn-primary">
                  <span>Start Trading Free</span>
                  <ArrowRight size={16} />
                </Link>
                <Link to="/contact" className="quant-btn-secondary">
                  <span>Talk to a Quant Specialist</span>
                  <ExternalLink size={15} />
                </Link>
              </div>

              <div className="cta-points">
                <span>Free Paper Trading Sandbox</span>
                <span className="dot">•</span>
                <span>No Credit Card Required</span>
                <span className="dot">•</span>
                <span>Direct Broker OAuth</span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
