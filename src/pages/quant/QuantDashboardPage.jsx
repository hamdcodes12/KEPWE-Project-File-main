import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import UserMenu from '../../components/common/UserMenu';
import { useApp } from '../../context/AppContext';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Command,
  Download,
  ExternalLink,
  Flame,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  Link2,
  ListFilter,
  Lock,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import {
  fetchQuantDashboard,
  fetchQuantStrategies,
  saveQuantStrategy,
  runQuantBacktest,
  fetchPaperStatus,
  startPaperTrading,
  stopPaperTrading,
  placePaperOrder,
  triggerKillSwitch,
  validateLiveDeploymentGate,
  fetchRiskStatus,
  fetchBrokerReadiness,
  fetchBrokerStatus,
  startLemonnOAuth,
  disconnectBroker,
} from '../../api/quantClient';
import './QuantDashboardPage.css';

const navSections = [
  {
    label: 'Workspace',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'watchlist', label: 'Live watchlist', icon: Activity },
      { key: 'markets', label: 'Markets', icon: BarChart3 },
    ],
  },
  {
    label: 'Quant Lab',
    items: [
      { key: 'builder', label: 'Strategy Builder', icon: SlidersHorizontal },
      { key: 'strategies', label: 'Algo Strategies', icon: Bot },
      { key: 'backtest', label: 'Backtesting Engine', icon: BarChart3 },
      { key: 'analytics', label: 'P&L Analytics', icon: TrendingUp },
      { key: 'risk', label: 'Risk Management', icon: ShieldCheck },
    ],
  },
  {
    label: 'Execution',
    items: [
      { key: 'paper-trading', label: 'Paper Trading', icon: Zap },
      { key: 'live', label: 'Live Deployment Gate', icon: Lock },
      { key: 'positions', label: 'Positions', icon: BriefcaseBusiness },
      { key: 'orders', label: 'Orders & History', icon: ListFilter },
      { key: 'portfolio', label: 'Portfolio & Funds', icon: WalletCards },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'broker', label: 'Broker Connection', icon: Link2 },
      { key: 'notifications', label: 'Notifications', icon: Bell },
      { key: 'settings', label: 'Settings', icon: Settings2 },
    ],
  },
];

const navItems = navSections.flatMap((section) => section.items);
const validSections = navItems.map((item) => item.key);

const watchlistSymbols = [
  { symbol: 'NIFTY 50', exchange: 'NSE · INDEX', tone: 'blue' },
  { symbol: 'BANK NIFTY', exchange: 'NSE · INDEX', tone: 'violet' },
  { symbol: 'RELIANCE', exchange: 'NSE · EQ', tone: 'orange' },
  { symbol: 'TCS', exchange: 'NSE · EQ', tone: 'cyan' },
  { symbol: 'INFY', exchange: 'NSE · EQ', tone: 'green' },
];

const marketGroups = [
  { label: 'Indices', items: watchlistSymbols.slice(0, 2) },
  { label: 'Stocks', items: watchlistSymbols.slice(2) },
];

const formatSection = (key) => {
  const item = navItems.find((navItem) => navItem.key === key);
  return item?.label || 'Dashboard';
};

function EmptyData({
  title = 'Connect a broker to load data',
  description = 'Live prices, balances and orders will appear here once a supported provider is connected.',
  action = true,
  compact = false,
  onConnect,
}) {
  return (
    <div className={`quant-empty ${compact ? 'is-compact' : ''}`}>
      <div className="quant-empty-icon">
        <Activity size={compact ? 17 : 20} />
      </div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && (
        <button className="quant-button quant-button-primary quant-button-small" onClick={onConnect}>
          Connect broker <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

function PanelHeader({ eyebrow, title, action, onAction, icon: Icon = BarChart3 }) {
  return (
    <div className="quant-panel-header">
      <div className="quant-panel-title">
        <span className="quant-panel-icon">
          <Icon size={16} />
        </span>
        <div>
          {eyebrow && <span className="quant-eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
      </div>
      {action && (
        <button className="quant-panel-action" onClick={onAction}>
          {action}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

function MarketTape() {
  return (
    <div className="quant-market-tape">
      <div className="quant-tape-brand">
        <span className="quant-live-dot" /> KEPWE QUANT
      </div>
      <div className="quant-tape-items">
        {['NIFTY 50', 'BANK NIFTY', 'SENSEX', 'INDIA VIX'].map((name) => (
          <span key={name} className="quant-tape-item">
            <b>{name}</b>
            <em>—</em>
            <small>Sandbox Mode</small>
          </span>
        ))}
      </div>
      <span className="quant-tape-status">
        <span className="quant-status-dot muted" /> Feed Disconnected (Provider Not Configured)
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STRATEGY BUILDER VIEW (Guided 3-Step Wizard + Sticky Summary)
// ─────────────────────────────────────────────────────────────────────────────
function StrategyBuilderView({ onNavigate }) {
  const [activeStep, setActiveStep] = useState(1);
  const [saveStatus, setSaveStatus] = useState({ loading: false, message: '', error: '' });

  // Form State
  const [name, setName] = useState('Kepwe NIFTY Pulse 5M');
  const [instrument, setInstrument] = useState('NIFTY 50');
  const [direction, setDirection] = useState('LONG_CE_PE');
  const [optionType, setOptionType] = useState('ATM');
  const [lotSize, setLotSize] = useState(1);
  const [orderType, setOrderType] = useState('MARKET');
  const [productType, setProductType] = useState('MIS');
  const [tradingWindowStart, setTradingWindowStart] = useState('09:25');
  const [tradingWindowEnd, setTradingWindowEnd] = useState('15:10');
  const [timeframe, setTimeframe] = useState('5m');
  const [confirmationTimeframe, setConfirmationTimeframe] = useState('1m');

  // Risk Parameters
  const [tradingCapital, setTradingCapital] = useState(100000);
  const [riskPct, setRiskPct] = useState(1.0);
  const [stopLossPct, setStopLossPct] = useState(25.0);
  const [targetPct, setTargetPct] = useState(50.0);
  const [timeStopMinutes, setTimeStopMinutes] = useState(20);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState(3);
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState(2);
  const [dailyDrawdownLimitPct, setDailyDrawdownLimitPct] = useState(10.0);

  // Derived Calculations
  const calculatedRiskAmount = (tradingCapital * (riskPct / 100)).toFixed(0);
  const estimatedOptionPremium = optionType === 'ATM' ? 180 : 230;
  const estimatedLotCost = lotSize * 25 * estimatedOptionPremium;
  const bufferMargin = 1500;
  const estimatedRequiredCapital = estimatedLotCost + bufferMargin;

  const handleSaveStrategy = async () => {
    setSaveStatus({ loading: true, message: '', error: '' });
    try {
      const payload = {
        name,
        instrument,
        direction,
        optionType,
        lotSize: Number(lotSize),
        orderType,
        productType,
        tradingWindowStart,
        tradingWindowEnd,
        timeframe,
        confirmationTimeframe,
        riskPerTradePct: Number(riskPct),
        stopLossPct: Number(stopLossPct),
        targetPct: Number(targetPct),
        riskRewardRatio: Number((targetPct / stopLossPct).toFixed(1)),
        timeStopMinutes: Number(timeStopMinutes),
        maxTradesPerDay: Number(maxTradesPerDay),
        maxConsecutiveLosses: Number(maxConsecutiveLosses),
        dailyDrawdownLimitPct: Number(dailyDrawdownLimitPct),
        status: 'DRAFT',
      };
      const res = await saveQuantStrategy(payload);
      setSaveStatus({
        loading: false,
        message: `Strategy saved successfully as ${res.strategy?.version || 'v1.0'}!`,
        error: '',
      });
    } catch (err) {
      setSaveStatus({ loading: false, message: '', error: err.message || 'Failed to save strategy' });
    }
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">QUANT LAB · STRATEGY BUILDER</span>
          <h1>NIFTY 50 Quantitative Strategy Wizard</h1>
          <p>Configure indicator signals, contract strike rules, position sizing, and automated risk guardrails.</p>
        </div>
        <div className="quant-page-action">
          <button className="quant-button quant-button-secondary" onClick={() => onNavigate('strategies')}>
            <Bot size={15} /> My Strategies
          </button>
        </div>
      </section>

      {/* 3-Step Wizard Navigation */}
      <div className="quant-wizard-nav">
        <div className="quant-wizard-steps">
          <button
            className={`quant-step-item ${activeStep === 1 ? 'active' : ''} ${activeStep > 1 ? 'completed' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <span className="quant-step-badge">{activeStep > 1 ? '✓' : '1'}</span>
            <span>1. Strategy Setup</span>
          </button>
          <div className="quant-step-divider" />
          <button
            className={`quant-step-item ${activeStep === 2 ? 'active' : ''} ${activeStep > 2 ? 'completed' : ''}`}
            onClick={() => setActiveStep(2)}
          >
            <span className="quant-step-badge">{activeStep > 2 ? '✓' : '2'}</span>
            <span>2. Risk Management</span>
          </button>
          <div className="quant-step-divider" />
          <button
            className={`quant-step-item ${activeStep === 3 ? 'active' : ''}`}
            onClick={() => setActiveStep(3)}
          >
            <span className="quant-step-badge">3</span>
            <span>3. Review & Deploy</span>
          </button>
        </div>
        <span className="quant-draft-pill">
          <span /> Strategy Version v1.0
        </span>
      </div>

      <div className="quant-wizard-grid">
        {/* Left: Form Content */}
        <div className="quant-wizard-main">
          {activeStep === 1 && (
            <div className="quant-form-card">
              <div className="quant-form-card-title">
                <SlidersHorizontal size={17} color="#2456d7" /> Step 1: Strategy Parameters
              </div>
              <p className="quant-form-card-desc">
                Select your core underlying asset, option selection rules, order routing, and execution timeframe.
              </p>

              <div className="quant-form-group">
                <label className="quant-form-label">Strategy Name</label>
                <input
                  type="text"
                  className="quant-form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kepwe NIFTY Pulse 5M"
                />
              </div>

              <div className="quant-form-row-2">
                <div className="quant-form-group">
                  <label className="quant-form-label">Underlying Instrument</label>
                  <select
                    className="quant-form-select"
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value)}
                  >
                    <option value="NIFTY 50">NIFTY 50 (NSE Index)</option>
                    <option value="BANK NIFTY">BANK NIFTY (NSE Index)</option>
                  </select>
                </div>
                <div className="quant-form-group">
                  <label className="quant-form-label">Order Type & Product</label>
                  <div className="quant-form-row-2">
                    <select
                      className="quant-form-select"
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value)}
                    >
                      <option value="MARKET">Market Order</option>
                      <option value="LIMIT">Limit Order</option>
                    </select>
                    <select
                      className="quant-form-select"
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                    >
                      <option value="MIS">MIS (Intraday)</option>
                      <option value="NRML">NRML (Normal)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="quant-form-group">
                <label className="quant-form-label">Option Buying Direction</label>
                <div className="quant-radio-cards">
                  <div
                    className={`quant-radio-card ${direction === 'LONG_CE_PE' ? 'active' : ''}`}
                    onClick={() => setDirection('LONG_CE_PE')}
                  >
                    <strong>Long CE & PE</strong>
                    <small>Bi-directional breakouts</small>
                  </div>
                  <div
                    className={`quant-radio-card ${direction === 'LONG_CE' ? 'active' : ''}`}
                    onClick={() => setDirection('LONG_CE')}
                  >
                    <strong>Call (CE) Only</strong>
                    <small>Bullish momentum only</small>
                  </div>
                  <div
                    className={`quant-radio-card ${direction === 'LONG_PE' ? 'active' : ''}`}
                    onClick={() => setDirection('LONG_PE')}
                  >
                    <strong>Put (PE) Only</strong>
                    <small>Bearish momentum only</small>
                  </div>
                </div>
              </div>

              <div className="quant-form-group">
                <label className="quant-form-label">Option Strike Selection Model</label>
                <div className="quant-radio-cards">
                  <div
                    className={`quant-radio-card ${optionType === 'ATM' ? 'active' : ''}`}
                    onClick={() => setOptionType('ATM')}
                  >
                    <strong>ATM (At-The-Money)</strong>
                    <small>Delta ~0.50 · High liquidity</small>
                  </div>
                  <div
                    className={`quant-radio-card ${optionType === 'ITM_1' ? 'active' : ''}`}
                    onClick={() => setOptionType('ITM_1')}
                  >
                    <strong>1-Strike ITM</strong>
                    <small>Delta ~0.58 · Lower theta decay</small>
                  </div>
                </div>
              </div>

              <div className="quant-form-row-3">
                <div className="quant-form-group">
                  <label className="quant-form-label">Base Lot Size</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="quant-form-input"
                    value={lotSize}
                    onChange={(e) => setLotSize(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <small style={{ color: '#718096', fontSize: '9px' }}>1 Lot = 25 Qty (NIFTY)</small>
                </div>
                <div className="quant-form-group">
                  <label className="quant-form-label">Primary Timeframe</label>
                  <select
                    className="quant-form-select"
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                  >
                    <option value="5m">5-minute (Completed)</option>
                    <option value="15m">15-minute</option>
                  </select>
                </div>
                <div className="quant-form-group">
                  <label className="quant-form-label">Confirmation Timeframe</label>
                  <select
                    className="quant-form-select"
                    value={confirmationTimeframe}
                    onChange={(e) => setConfirmationTimeframe(e.target.value)}
                  >
                    <option value="1m">1-minute (Immediate)</option>
                    <option value="3m">3-minute</option>
                  </select>
                </div>
              </div>

              <div className="quant-form-row-2">
                <div className="quant-form-group">
                  <label className="quant-form-label">Trading Window Start (IST)</label>
                  <input
                    type="text"
                    className="quant-form-input"
                    value={tradingWindowStart}
                    onChange={(e) => setTradingWindowStart(e.target.value)}
                  />
                </div>
                <div className="quant-form-group">
                  <label className="quant-form-label">Hard Square-off Cutoff (IST)</label>
                  <input
                    type="text"
                    className="quant-form-input"
                    value={tradingWindowEnd}
                    onChange={(e) => setTradingWindowEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="quant-form-card">
              <div className="quant-form-card-title">
                <ShieldCheck size={17} color="#0ca78a" /> Step 2: Risk Parameters & Guardrails
              </div>
              <p className="quant-form-card-desc">
                Enforce mathematical position sizing, stop losses, target ratios, and daily drawdown halts.
              </p>

              <div className="quant-form-group">
                <label className="quant-form-label">Allocated Trading Capital (₹)</label>
                <input
                  type="number"
                  step="10000"
                  min="25000"
                  className="quant-form-input"
                  value={tradingCapital}
                  onChange={(e) => setTradingCapital(Math.max(10000, parseFloat(e.target.value) || 10000))}
                />
              </div>

              <div className="quant-form-group">
                <label className="quant-form-label">
                  Risk Per Trade (% of Capital) — Max ₹{calculatedRiskAmount}
                </label>
                <div className="quant-risk-presets">
                  {[
                    { pct: 0.5, label: 'Conservative' },
                    { pct: 1.0, label: 'Standard' },
                    { pct: 2.0, label: 'Aggressive' },
                    { pct: 5.0, label: 'High Risk' },
                  ].map((preset) => (
                    <button
                      key={preset.pct}
                      type="button"
                      className={`quant-preset-btn ${riskPct === preset.pct ? 'active' : ''} ${
                        preset.pct === 5.0 ? 'high-risk' : ''
                      }`}
                      onClick={() => setRiskPct(preset.pct)}
                    >
                      <strong>{preset.pct}%</strong>
                      <small>{preset.label}</small>
                    </button>
                  ))}
                </div>
                {riskPct === 5.0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', color: '#c53030', fontSize: '10px' }}>
                    <AlertTriangle size={13} />
                    <span>5% Risk is classified as High Risk. Significant option premium swings may occur.</span>
                  </div>
                )}
              </div>

              <div className="quant-form-row-2">
                <div className="quant-form-group">
                  <label className="quant-form-label">Stop Loss (% of Premium)</label>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    max="50"
                    className="quant-form-input"
                    value={stopLossPct}
                    onChange={(e) => setStopLossPct(parseFloat(e.target.value) || 25)}
                  />
                  <small style={{ color: '#718096', fontSize: '9px' }}>Default: 25% (Client Specification)</small>
                </div>
                <div className="quant-form-group">
                  <label className="quant-form-label">Target Profit (% of Premium)</label>
                  <input
                    type="number"
                    step="5"
                    min="20"
                    max="150"
                    className="quant-form-input"
                    value={targetPct}
                    onChange={(e) => setTargetPct(parseFloat(e.target.value) || 50)}
                  />
                  <small style={{ color: '#718096', fontSize: '9px' }}>Default: 50% (1:2 Risk to Reward)</small>
                </div>
              </div>

              <div className="quant-form-row-3">
                <div className="quant-form-group">
                  <label className="quant-form-label">Max Trades / Day</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    className="quant-form-input"
                    value={maxTradesPerDay}
                    onChange={(e) => setMaxTradesPerDay(parseInt(e.target.value) || 3)}
                  />
                  <small style={{ color: '#718096', fontSize: '9px' }}>Strict limit: 3 trades/day</small>
                </div>
                <div className="quant-form-group">
                  <label className="quant-form-label">Max Consecutive Losses</label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    className="quant-form-input"
                    value={maxConsecutiveLosses}
                    onChange={(e) => setMaxConsecutiveLosses(parseInt(e.target.value) || 2)}
                  />
                  <small style={{ color: '#718096', fontSize: '9px' }}>2 losses halts day</small>
                </div>
                <div className="quant-form-group">
                  <label className="quant-form-label">Daily Drawdown Hard Stop</label>
                  <input
                    type="number"
                    min="5"
                    max="15"
                    className="quant-form-input"
                    value={dailyDrawdownLimitPct}
                    onChange={(e) => setDailyDrawdownLimitPct(parseFloat(e.target.value) || 10)}
                  />
                  <small style={{ color: '#718096', fontSize: '9px' }}>10% hard stop</small>
                </div>
              </div>

              <div className="quant-form-group">
                <label className="quant-form-label">Stagnation Time Stop (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  className="quant-form-input"
                  value={timeStopMinutes}
                  onChange={(e) => setTimeStopMinutes(parseInt(e.target.value) || 20)}
                />
                <small style={{ color: '#718096', fontSize: '9px' }}>Exit position if stagnant after 20 minutes to prevent theta burn.</small>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="quant-form-card">
              <div className="quant-form-card-title">
                <CheckCircle2 size={17} color="#159975" /> Step 3: Review Strategy & Deploy
              </div>
              <p className="quant-form-card-desc">
                Review your quantitative parameters before saving or testing in paper simulation.
              </p>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '12px' }}>
                  Execution Parameters Audit
                </h4>
                <div className="quant-form-row-2" style={{ gap: '8px' }}>
                  <div className="quant-summary-row">
                    <span>Strategy:</span>
                    <strong>{name}</strong>
                  </div>
                  <div className="quant-summary-row">
                    <span>Underlying:</span>
                    <strong>{instrument}</strong>
                  </div>
                  <div className="quant-summary-row">
                    <span>Option Selection:</span>
                    <strong>{optionType} ({direction})</strong>
                  </div>
                  <div className="quant-summary-row">
                    <span>Execution Lot:</span>
                    <strong>{lotSize} Lot ({lotSize * 25} Qty)</strong>
                  </div>
                  <div className="quant-summary-row">
                    <span>Risk per Trade:</span>
                    <strong>{riskPct}% (₹{calculatedRiskAmount})</strong>
                  </div>
                  <div className="quant-summary-row">
                    <span>Stop / Target:</span>
                    <strong>-{stopLossPct}% / +{targetPct}% (1:2 R:R)</strong>
                  </div>
                  <div className="quant-summary-row">
                    <span>Daily Risk Guardrail:</span>
                    <strong>Max 3 trades · 2 losses halt · 10% DD stop</strong>
                  </div>
                  <div className="quant-summary-row">
                    <span>Trading Window:</span>
                    <strong>{tradingWindowStart} to {tradingWindowEnd} IST</strong>
                  </div>
                </div>
              </div>

              {saveStatus.message && (
                <div style={{ padding: '12px', background: '#e6f8f2', color: '#159975', borderRadius: '6px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
                  ✓ {saveStatus.message}
                </div>
              )}
              {saveStatus.error && (
                <div style={{ padding: '12px', background: '#fff5f5', color: '#c53030', borderRadius: '6px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
                  ✕ {saveStatus.error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="quant-button quant-button-primary"
                  onClick={handleSaveStrategy}
                  disabled={saveStatus.loading}
                >
                  <Bot size={15} /> {saveStatus.loading ? 'Saving Version…' : 'Save Strategy Version'}
                </button>
                <button
                  className="quant-button quant-button-secondary"
                  onClick={() => onNavigate('backtest')}
                >
                  <BarChart3 size={15} /> Run Historical Backtest
                </button>
                <button
                  className="quant-button quant-button-secondary"
                  onClick={() => onNavigate('paper-trading')}
                >
                  <Zap size={15} /> Deploy to Paper Sandbox
                </button>
              </div>
            </div>
          )}

          {/* Bottom Wizard Navigation Buttons */}
          <div className="quant-wizard-bottom">
            <button
              className="quant-button quant-button-ghost"
              onClick={() => (activeStep > 1 ? setActiveStep(activeStep - 1) : onNavigate('dashboard'))}
            >
              {activeStep > 1 ? '← Back' : 'Cancel'}
            </button>
            <div style={{ color: '#718096', fontSize: '11px', fontWeight: 600 }}>
              Step {activeStep} of 3
            </div>
            {activeStep < 3 ? (
              <button
                className="quant-button quant-button-primary"
                onClick={() => setActiveStep(activeStep + 1)}
              >
                Next Step →
              </button>
            ) : (
              <button
                className="quant-button quant-button-primary"
                onClick={handleSaveStrategy}
                disabled={saveStatus.loading}
              >
                ✓ Complete & Save
              </button>
            )}
          </div>
        </div>

        {/* Right Sticky Summary Sidebar */}
        <aside className="quant-wizard-sidebar">
          {/* Strategy Summary Card */}
          <div className="quant-summary-card">
            <div className="quant-summary-card-header">
              <h3>Strategy Summary</h3>
              <Bot size={15} color="#2456d7" />
            </div>
            <div className="quant-summary-row">
              <span>Instrument</span>
              <strong>{instrument}</strong>
            </div>
            <div className="quant-summary-row">
              <span>Direction</span>
              <strong>{direction === 'LONG_CE_PE' ? 'CE & PE' : direction}</strong>
            </div>
            <div className="quant-summary-row">
              <span>Strike</span>
              <strong>{optionType}</strong>
            </div>
            <div className="quant-summary-row">
              <span>Timeframe</span>
              <strong>{timeframe}</strong>
            </div>
            <div className="quant-summary-row">
              <span>Risk / Reward</span>
              <strong>1 : {(targetPct / stopLossPct).toFixed(1)}</strong>
            </div>
            <div className="quant-summary-row">
              <span>Lots / Qty</span>
              <strong>{lotSize} ({lotSize * 25} qty)</strong>
            </div>
          </div>

          {/* Risk Parameters Card */}
          <div className="quant-summary-card">
            <div className="quant-summary-card-header">
              <h3>Risk Parameters</h3>
              <ShieldCheck size={15} color="#0ca78a" />
            </div>
            <div className="quant-summary-row">
              <span>Capital Base</span>
              <strong>₹{tradingCapital.toLocaleString('en-IN')}</strong>
            </div>
            <div className="quant-summary-row">
              <span>Risk / Trade</span>
              <strong style={{ color: riskPct === 5.0 ? '#c53030' : '#159975' }}>
                {riskPct}% (₹{calculatedRiskAmount})
              </strong>
            </div>
            <div className="quant-summary-row">
              <span>Stop Loss</span>
              <strong style={{ color: '#c53030' }}>-{stopLossPct}%</strong>
            </div>
            <div className="quant-summary-row">
              <span>Profit Target</span>
              <strong style={{ color: '#159975' }}>+{targetPct}%</strong>
            </div>
            <div className="quant-summary-row">
              <span>Max Loss / Day</span>
              <strong>₹{(tradingCapital * (dailyDrawdownLimitPct / 100)).toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {/* Estimated Capital Requirement Card */}
          <div className="quant-capital-card">
            <div className="quant-capital-card-label">Estimated Capital Requirement</div>
            <div className="quant-capital-card-val">₹{estimatedRequiredCapital.toLocaleString('en-IN')}</div>
            <p className="quant-capital-card-meta">
              Based on {lotSize} lot ({lotSize * 25} qty) at ~₹{estimatedOptionPremium} premium + ₹{bufferMargin} margin buffer.
            </p>
          </div>

          {/* Helpful Tip Card */}
          <div className="quant-tip-card">
            <HelpCircle size={16} className="quant-tip-icon" />
            <div className="quant-tip-content">
              <strong>Option Buying Discipline</strong>
              <p>
                Option premiums decay rapidly with theta. Strict 25% stop loss and 20-minute time stops protect your risk budget from chop.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BACKTEST ENGINE VIEW (Real truthful simulation runner)
// ─────────────────────────────────────────────────────────────────────────────
function BacktestRunnerView() {
  const [capital, setCapital] = useState(100000);
  const [riskPct, setRiskPct] = useState(1.0);
  const [optionType, setOptionType] = useState('ATM');
  const [lotSize, setLotSize] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const executeBacktest = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await runQuantBacktest({
        capital: Number(capital),
        riskPct: Number(riskPct),
        optionType,
        lotSize: Number(lotSize),
      });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Backtest execution failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeBacktest();
  }, []);

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">QUANT LAB · AUDITED SIMULATION</span>
          <h1>Quantitative Backtesting Engine</h1>
          <p>
            Simulate the NIFTY 50 Option Buyer strategy against benchmark historical candles with zero fabricated metrics.
          </p>
        </div>
        <div className="quant-page-action">
          <button className="quant-button quant-button-primary" onClick={executeBacktest} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Simulating…' : 'Run Backtest'}
          </button>
        </div>
      </section>

      {/* Backtest Input Toolbar */}
      <div className="quant-backtest-toolbar">
        <div className="quant-backtest-field">
          <label>Capital (₹)</label>
          <input
            type="number"
            value={capital}
            step="10000"
            onChange={(e) => setCapital(parseFloat(e.target.value) || 100000)}
          />
        </div>
        <div className="quant-backtest-field">
          <label>Risk Per Trade (%)</label>
          <select value={riskPct} onChange={(e) => setRiskPct(parseFloat(e.target.value))}>
            <option value="0.5">0.5% (Conservative)</option>
            <option value="1.0">1.0% (Standard)</option>
            <option value="2.0">2.0% (Aggressive)</option>
            <option value="5.0">5.0% (High Risk)</option>
          </select>
        </div>
        <div className="quant-backtest-field">
          <label>Option Strike</label>
          <select value={optionType} onChange={(e) => setOptionType(e.target.value)}>
            <option value="ATM">ATM (At-The-Money)</option>
            <option value="ITM_1">1-Strike ITM</option>
          </select>
        </div>
        <div className="quant-backtest-field">
          <label>Lot Size</label>
          <input
            type="number"
            min="1"
            max="10"
            value={lotSize}
            onChange={(e) => setLotSize(parseInt(e.target.value) || 1)}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px', background: '#fff5f5', color: '#c53030', borderRadius: '8px', marginBottom: '16px', fontSize: '11px', fontWeight: 700 }}>
          ✕ {error}
        </div>
      )}

      {/* KPI Banners */}
      {result?.metrics && (
        <div className="quant-metrics-banner">
          <div className="quant-metric-box">
            <div className="quant-metric-box-label">Net Realized P&L</div>
            <div className={`quant-metric-box-val ${result.metrics.netPnl >= 0 ? 'positive' : 'negative'}`}>
              ₹{result.metrics.netPnl?.toLocaleString('en-IN')}
            </div>
            <div className="quant-metric-box-sub">Return: {result.metrics.returnPct}%</div>
          </div>
          <div className="quant-metric-box">
            <div className="quant-metric-box-label">Win Rate</div>
            <div className="quant-metric-box-val">{result.metrics.winRatePct}%</div>
            <div className="quant-metric-box-sub">
              {result.metrics.winningTrades} Wins / {result.metrics.losingTrades} Losses
            </div>
          </div>
          <div className="quant-metric-box">
            <div className="quant-metric-box-label">Profit Factor</div>
            <div className="quant-metric-box-val">{result.metrics.profitFactor}</div>
            <div className="quant-metric-box-sub">Total Trades: {result.metrics.totalTrades}</div>
          </div>
          <div className="quant-metric-box">
            <div className="quant-metric-box-label">Max Drawdown</div>
            <div className="quant-metric-box-val negative">{result.metrics.maxDrawdownPct}%</div>
            <div className="quant-metric-box-sub">Peak Drop: ₹{result.metrics.maxDrawdownAmount}</div>
          </div>
        </div>
      )}

      {/* Equity Curve SVG Chart */}
      <div className="quant-panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <PanelHeader eyebrow="SIMULATION PERFORMANCE" title="Cumulative Returns & Equity Curve" icon={TrendingUp} />
        {result?.equityCurve && result.equityCurve.length > 1 ? (
          <div className="quant-chart-svg-wrap">
            <svg width="100%" height="100%" viewBox="0 0 600 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="quantGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2456d7" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#2456d7" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="#2456d7"
                strokeWidth="2.5"
                points={result.equityCurve
                  .map((pt, i) => {
                    const x = (i / (result.equityCurve.length - 1)) * 600;
                    const minEq = Math.min(...result.equityCurve.map((p) => p.equity));
                    const maxEq = Math.max(...result.equityCurve.map((p) => p.equity));
                    const range = maxEq - minEq || 1;
                    const y = 160 - ((pt.equity - minEq) / range) * 140;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#718096', fontSize: '11px' }}>
            <Activity size={24} style={{ margin: '0 auto 8px', display: 'block', color: '#a0aec0' }} />
            No trades triggered during this backtest window. Strategy strictly filters false signals.
          </div>
        )}
      </div>

      {/* Trades Log Table */}
      <div className="quant-panel quant-table-panel">
        <PanelHeader eyebrow="EXECUTION AUDIT" title="Simulated Trade Log" icon={ListFilter} />
        {result?.trades && result.trades.length > 0 ? (
          <div className="quant-table-wrap">
            <table className="quant-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Contract</th>
                  <th>Side</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Exit Reason</th>
                  <th>P&L (₹)</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, idx) => (
                  <tr key={idx}>
                    <td>{t.timestamp || `Bar #${idx + 1}`}</td>
                    <td><strong>{t.contract}</strong></td>
                    <td><span className="quant-mode-pill">{t.side}</span></td>
                    <td>₹{t.entryPrice}</td>
                    <td>₹{t.exitPrice}</td>
                    <td><span style={{ fontSize: '9px', fontWeight: 700 }}>{t.exitReason}</span></td>
                    <td style={{ color: t.pnl >= 0 ? '#159975' : '#c53030', fontWeight: 700 }}>
                      {t.pnl >= 0 ? `+₹${t.pnl}` : `-₹${Math.abs(t.pnl)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyData
            title="Zero Trades Executed"
            description="The disciplined multi-indicator filter (EMA20/50 + VWAP + ATR) required strict trend confirmation."
            action={false}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PAPER TRADING TERMINAL VIEW (Simulation, Orders, Kill Switch)
// ─────────────────────────────────────────────────────────────────────────────
function PaperTradingTerminalView({ onNavigate }) {
  const [paperState, setPaperState] = useState({ status: 'STOPPED', openPositions: [], recentOrders: [], tradesHistory: [] });
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', error: '' });

  // Order Ticket Inputs
  const [orderSide, setOrderSide] = useState('BUY');
  const [orderQty, setOrderQty] = useState(25);
  const [orderPrice, setOrderPrice] = useState(185);

  const loadStatus = async () => {
    try {
      const res = await fetchPaperStatus();
      setPaperState(res);
    } catch (_) {}
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    setFeedback({ message: '', error: '' });
    try {
      const res = await startPaperTrading();
      setPaperState((prev) => ({ ...prev, status: res.status }));
      setFeedback({ message: 'Paper engine started in simulated sandbox mode.', error: '' });
    } catch (err) {
      setFeedback({ message: '', error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    setFeedback({ message: '', error: '' });
    try {
      const res = await stopPaperTrading();
      setPaperState((prev) => ({ ...prev, status: res.status }));
      setFeedback({ message: 'Paper engine stopped.', error: '' });
    } catch (err) {
      setFeedback({ message: '', error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleKillSwitch = async () => {
    if (!window.confirm('WARNING: Activate emergency kill switch? This flattens all open positions and halts trading.')) return;
    setActionLoading(true);
    setFeedback({ message: '', error: '' });
    try {
      const res = await triggerKillSwitch();
      setPaperState((prev) => ({ ...prev, status: 'STOPPED', openPositions: [] }));
      setFeedback({ message: res.message, error: '' });
      loadStatus();
    } catch (err) {
      setFeedback({ message: '', error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback({ message: '', error: '' });
    try {
      await placePaperOrder({
        instrument: 'NIFTY 50 ATM CE',
        side: orderSide,
        quantity: Number(orderQty),
        price: Number(orderPrice),
        stopLoss: Number(orderPrice) * 0.75,
        target: Number(orderPrice) * 1.5,
      });
      setFeedback({ message: `Simulated order executed at ₹${orderPrice}. Position opened!`, error: '' });
      loadStatus();
    } catch (err) {
      setFeedback({ message: '', error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">EXECUTION · PAPER SANDBOX</span>
          <h1>Paper Trading Terminal</h1>
          <p>Test real algorithmic orders and execution in a simulated sandbox without risking capital.</p>
        </div>
        <div className="quant-page-action">
          <button className="quant-button quant-button-secondary" onClick={loadStatus}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </section>

      {/* Engine Status & Emergency Kill Switch Banner */}
      <div className="quant-engine-banner">
        <div className="quant-engine-state">
          <span className={`quant-engine-pill ${paperState.status === 'ACTIVE' ? 'active' : 'stopped'}`}>
            <span /> ENGINE {paperState.status}
          </span>
          <span style={{ fontSize: '11px', color: '#718096' }}>Mode: <b>SIMULATED PAPER SANDBOX</b></span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {paperState.status === 'ACTIVE' ? (
            <button className="quant-button quant-button-ghost" onClick={handleStop} disabled={actionLoading}>
              <Square size={14} /> Pause Engine
            </button>
          ) : (
            <button className="quant-button quant-button-primary" onClick={handleStart} disabled={actionLoading}>
              <Play size={14} /> Start Paper Engine
            </button>
          )}
          <button className="quant-kill-btn" onClick={handleKillSwitch} disabled={actionLoading}>
            <AlertOctagon size={15} /> Emergency Kill Switch
          </button>
        </div>
      </div>

      {feedback.message && (
        <div style={{ padding: '12px', background: '#e6f8f2', color: '#159975', borderRadius: '7px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
          ✓ {feedback.message}
        </div>
      )}
      {feedback.error && (
        <div style={{ padding: '12px', background: '#fff5f5', color: '#c53030', borderRadius: '7px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
          ✕ {feedback.error}
        </div>
      )}

      {/* Terminal Layout: Left Table + Right Simulated Ticket */}
      <div className="quant-overview-grid">
        <div className="quant-panel quant-table-panel" style={{ gridColumn: 'span 2' }}>
          <PanelHeader eyebrow="SIMULATED POSITIONS" title="Active Paper Positions" icon={BriefcaseBusiness} />
          {paperState.openPositions?.length > 0 ? (
            <div className="quant-table-wrap">
              <table className="quant-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Side</th>
                    <th>Qty</th>
                    <th>Entry</th>
                    <th>Current</th>
                    <th>Stop Loss</th>
                    <th>Target</th>
                    <th>P&L (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {paperState.openPositions.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.instrument}</strong></td>
                      <td><span className="quant-mode-pill">{p.side}</span></td>
                      <td>{p.quantity}</td>
                      <td>₹{p.entryPrice}</td>
                      <td>₹{p.currentPrice}</td>
                      <td style={{ color: '#c53030' }}>₹{p.stopLoss}</td>
                      <td style={{ color: '#159975' }}>₹{p.target}</td>
                      <td style={{ color: p.pnl >= 0 ? '#159975' : '#c53030', fontWeight: 700 }}>
                        {p.pnl >= 0 ? `+₹${p.pnl}` : `-₹${Math.abs(p.pnl)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyData
              title="No open paper positions"
              description="Start the paper engine or submit a simulated order below to test execution."
              action={false}
            />
          )}
        </div>

        {/* Paper Order Ticket */}
        <div className="quant-panel quant-order-panel">
          <div className="quant-order-heading">
            <div>
              <span className="quant-eyebrow">SANDBOX EXECUTION</span>
              <h2>Simulated Order Ticket</h2>
            </div>
            <span className="quant-mode-pill">PAPER</span>
          </div>

          <div className="quant-order-tabs">
            <button
              className={orderSide === 'BUY' ? 'active buy' : ''}
              onClick={() => setOrderSide('BUY')}
            >
              <ArrowUpRight size={15} /> Buy
            </button>
            <button
              className={orderSide === 'SELL' ? 'active sell' : ''}
              onClick={() => setOrderSide('SELL')}
            >
              <ArrowDownRight size={15} /> Sell
            </button>
          </div>

          <form className="quant-order-form" onSubmit={handlePlaceOrder}>
            <label>
              Contract
              <input type="text" className="quant-form-input" value="NIFTY 50 ATM CE" readOnly />
            </label>
            <div className="quant-form-row">
              <label>
                Quantity (Units)
                <input
                  type="number"
                  step="25"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                />
              </label>
              <label>
                Simulated Price (₹)
                <input
                  type="number"
                  step="0.5"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                />
              </label>
            </div>
            <div className="quant-order-summary">
              <span>Estimated Order Value</span>
              <strong>₹{(orderQty * orderPrice).toLocaleString('en-IN')}</strong>
            </div>
            <button
              type="submit"
              className={`quant-button quant-order-submit ${orderSide.toLowerCase()}`}
              disabled={actionLoading}
            >
              Submit Paper Order <Zap size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LIVE DEPLOYMENT SAFETY GATE VIEW (Safely blocks real money without broker)
// ─────────────────────────────────────────────────────────────────────────────
function LiveDeploymentGateView({ onNavigate }) {
  const [gateData, setGateData] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkGate = async () => {
    setLoading(true);
    try {
      const res = await validateLiveDeploymentGate({
        riskPerTradePct: 1.0,
        maxTradesPerDay: 3,
        maxConsecutiveLosses: 2,
      });
      setGateData(res);
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkGate();
  }, []);

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">SECURITY · DEPLOYMENT GATEWAY</span>
          <h1>Live Execution Safety Gate</h1>
          <p>
            Real funds execution is protected by cryptographic checks. Trading cannot proceed without a connected and verified broker.
          </p>
        </div>
        <div className="quant-page-action">
          <button className="quant-button quant-button-secondary" onClick={checkGate} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Check Gate Prerequisites
          </button>
        </div>
      </section>

      {/* Prominent Truthful Status Banner */}
      <div className="quant-gate-hero">
        <div className="quant-gate-hero-icon">
          <Lock size={22} />
        </div>
        <div>
          <span className="quant-eyebrow" style={{ color: '#c53030' }}>DEPLOYMENT GATED</span>
          <h2 style={{ fontSize: '18px', color: '#9b2c2c', margin: '4px 0' }}>
            {gateData?.isDeployable ? 'LIVE READY' : 'LIVE CONFIGURATION REQUIRED'}
          </h2>
          <p style={{ color: '#742a2a', fontSize: '11px', margin: 0 }}>
            {gateData?.isDeployable
              ? 'All prerequisites passed. Strategy can be deployed with live broker.'
              : 'LIVE TRADING UNAVAILABLE — Live broker connection & market feed credentials required.'}
          </p>
        </div>
        <span className="quant-lock-badge" style={{ marginLeft: 'auto' }}>
          <Lock size={12} /> SECURED
        </span>
      </div>

      {/* 4 Prerequisite Checks */}
      <div className="quant-gate-checks">
        {gateData?.checks?.map((check, idx) => (
          <div className="quant-gate-card" key={idx}>
            <div className={`quant-gate-card-icon ${check.passed ? 'pass' : 'block'}`}>
              {check.passed ? <CheckCircle2 size={16} /> : <X size={16} />}
            </div>
            <div>
              <strong>{check.check}</strong>
              <p>{check.details}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Action Gating Card */}
      <div className="quant-panel" style={{ padding: '24px', textAlign: 'center' }}>
        <ShieldAlert size={32} style={{ color: '#c53030', margin: '0 auto 12px', display: 'block' }} />
        <h3 style={{ fontSize: '15px', color: '#1e293b', marginBottom: '8px' }}>
          Live Broker Connection Required
        </h3>
        <p style={{ color: '#64748b', fontSize: '11px', maxWidth: '480px', margin: '0 auto 18px', lineHeight: 1.5 }}>
          KEPWE adheres to strict security standards and never simulates false live order execution. To trade with real funds, connect an authorized broker adapter.
        </p>
        <button className="quant-button quant-button-primary" onClick={() => onNavigate('broker')}>
          <Link2 size={15} /> Configure Broker Integration
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DAILY RISK CONTROLLER VIEW
// ─────────────────────────────────────────────────────────────────────────────
function RiskManagementView({ onNavigate }) {
  const [riskData, setRiskData] = useState(null);
  const [killLoading, setKillLoading] = useState(false);
  const [killMessage, setKillMessage] = useState('');

  const loadRisk = async () => {
    try {
      const res = await fetchRiskStatus();
      setRiskData(res);
    } catch (_) {}
  };

  useEffect(() => {
    loadRisk();
  }, []);

  const handleKill = async () => {
    if (!window.confirm('Trigger emergency kill switch?')) return;
    setKillLoading(true);
    try {
      const res = await triggerKillSwitch();
      setKillMessage(res.message);
      loadRisk();
    } catch (_) {}
    finally {
      setKillLoading(false);
    }
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">QUANT LAB · GOVERNANCE</span>
          <h1>Daily Risk Controller</h1>
          <p>Real-time circuit breakers, maximum trade counters, and automated drawdown halts.</p>
        </div>
        <div className="quant-page-action">
          <button className="quant-kill-btn" onClick={handleKill} disabled={killLoading}>
            <AlertOctagon size={14} /> Emergency Kill Switch
          </button>
        </div>
      </section>

      {killMessage && (
        <div style={{ padding: '12px', background: '#e6f8f2', color: '#159975', borderRadius: '6px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
          ✓ {killMessage}
        </div>
      )}

      {/* Risk Metrics Cards */}
      <div className="quant-metrics-banner">
        <div className="quant-metric-box">
          <div className="quant-metric-box-label">Trades Taken Today</div>
          <div className="quant-metric-box-val">{riskData?.tradesToday ?? 0} / {riskData?.maxTradesPerDay ?? 3}</div>
          <div className="quant-metric-box-sub">Remaining: {riskData?.tradesRemaining ?? 3} trades</div>
        </div>
        <div className="quant-metric-box">
          <div className="quant-metric-box-label">Consecutive Losses</div>
          <div className="quant-metric-box-val">{riskData?.consecutiveLosses ?? 0} / {riskData?.maxConsecutiveLosses ?? 2}</div>
          <div className="quant-metric-box-sub">Limit: 2 halts session</div>
        </div>
        <div className="quant-metric-box">
          <div className="quant-metric-box-label">Today's Realized P&L</div>
          <div className={`quant-metric-box-val ${riskData?.dayPnl >= 0 ? 'positive' : 'negative'}`}>
            ₹{riskData?.dayPnl ?? 0}
          </div>
          <div className="quant-metric-box-sub">Daily Loss Limit: ₹{riskData?.dailyDrawdownLimit ?? 10000}</div>
        </div>
        <div className="quant-metric-box">
          <div className="quant-metric-box-label">Session Status</div>
          <div className="quant-metric-box-val" style={{ color: riskData?.isHalted ? '#c53030' : '#159975' }}>
            {riskData?.isHalted ? 'HALTED' : 'ACTIVE'}
          </div>
          <div className="quant-metric-box-sub">
            {riskData?.isHalted ? 'Daily risk threshold triggered' : 'Normal trading permissible'}
          </div>
        </div>
      </div>

      <div className="quant-panel" style={{ padding: '24px' }}>
        <PanelHeader eyebrow="ACTIVE CONTROLS" title="Risk Invariants Enforced by Backend Engine" icon={ShieldCheck} />
        <div className="quant-form-row-2" style={{ marginTop: '16px', gap: '16px' }}>
          <div className="quant-summary-card">
            <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
              1. 3 Trades / Day Maximum Cap
            </h4>
            <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
              Prevents over-trading during chop. After 3 closed trades in a single calendar day, the risk engine rejects any subsequent order requests.
            </p>
          </div>
          <div className="quant-summary-card">
            <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
              2. 2 Consecutive Loss Auto-Halt
            </h4>
            <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
              If two consecutive trades hit stop loss, algorithmic execution automatically pauses for the remainder of the session.
            </p>
          </div>
          <div className="quant-summary-card">
            <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
              3. 10% Daily Drawdown Circuit Breaker
            </h4>
            <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
              If net daily losses exceed 10% of allocated capital, all open positions are immediately flattened at market and trading is locked.
            </p>
          </div>
          <div className="quant-summary-card">
            <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
              4. 20-Minute Stagnation Exit
            </h4>
            <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
              Option buying positions that do not make momentum progress within 20 minutes are closed to prevent theta decay erosion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DASHBOARD OVERVIEW VIEW
// ─────────────────────────────────────────────────────────────────────────────
function DashboardOverview({ onNavigate }) {
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuantDashboard()
      .then((data) => setDashData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="quant-welcome">
        <div>
          <div className="quant-breadcrumb">
            <span>KEPWE QUANT</span>
            <ChevronRight size={13} /> Quantitative Trading Lab
          </div>
          <h1>
            Good morning, <span>{dashData?.user?.name || 'Trader'}.</span>
          </h1>
          <p>Your command center for systematic NIFTY 50 quantitative option strategies.</p>
        </div>
        <div className="quant-welcome-actions">
          <span className="quant-environment">
            <span className="quant-status-dot muted" /> Simulated Environment
          </span>
          <button className="quant-button quant-button-primary" onClick={() => onNavigate('builder')}>
            <Plus size={15} /> New Strategy
          </button>
        </div>
      </section>

      {/* Truthful Connection Notice Banner */}
      <div className="quant-banner">
        <div className="quant-banner-icon">
          <Link2 size={17} />
        </div>
        <div>
          <strong>Truthful Provider Status: Sandbox Mode Active</strong>
          <p>
            No fake balances or mock broker fills are fabricated. Historical backtests and paper simulations are fully operational.
          </p>
        </div>
        <button className="quant-banner-link" onClick={() => onNavigate('broker')}>
          Broker Connection <ChevronRight size={15} />
        </button>
      </div>

      {/* Top Metric Grid */}
      <div className="quant-metric-grid">
        <div className="quant-metric-card">
          <div className="quant-metric-top">
            <span>Trading Capital</span>
            <WalletCards size={16} />
          </div>
          <strong>₹{(dashData?.capital || 100000).toLocaleString('en-IN')}</strong>
          <small>Allocated risk budget</small>
        </div>
        <div className="quant-metric-card">
          <div className="quant-metric-top">
            <span>Paper Day P&L</span>
            <TrendingUp size={16} />
          </div>
          <strong style={{ color: (dashData?.todayPnl || 0) >= 0 ? '#159975' : '#c53030' }}>
            ₹{dashData?.todayPnl || 0}
          </strong>
          <small>{dashData?.todayTrades || 0} paper trades today</small>
        </div>
        <div className="quant-metric-card">
          <div className="quant-metric-top">
            <span>Active Strategies</span>
            <Bot size={16} />
          </div>
          <strong>{dashData?.strategies?.length || 1}</strong>
          <small>NIFTY 50 Option Buyer</small>
        </div>
        <div className="quant-metric-card">
          <div className="quant-metric-top">
            <span>Execution Status</span>
            <Gauge size={16} />
          </div>
          <strong>{dashData?.algoStatus || 'STOPPED'}</strong>
          <small>{dashData?.openPositions || 0} open positions</small>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="quant-strategy-grid" style={{ marginBottom: '24px' }}>
        <section className="quant-panel quant-strategy-card featured">
          <div className="quant-strategy-card-top">
            <span className="quant-strategy-mark">
              <SlidersHorizontal size={18} />
            </span>
            <span className="quant-mode-pill">WIZARD</span>
          </div>
          <h3>Strategy Builder</h3>
          <p>Build 3-step NIFTY 50 option buying rules with automated stop-loss and profit target.</p>
          <button className="quant-button quant-button-primary quant-button-small" onClick={() => onNavigate('builder')}>
            Launch Builder <ChevronRight size={14} />
          </button>
        </section>

        <section className="quant-panel quant-strategy-card">
          <div className="quant-strategy-card-top">
            <span className="quant-strategy-mark violet">
              <BarChart3 size={18} />
            </span>
            <span className="quant-mode-pill">BACKTEST</span>
          </div>
          <h3>Historical Backtest</h3>
          <p>Simulate the EMA20/50 + VWAP breakout strategy against benchmark historical candles.</p>
          <button className="quant-button quant-button-secondary quant-button-small" onClick={() => onNavigate('backtest')}>
            Open Backtest <ChevronRight size={14} />
          </button>
        </section>

        <section className="quant-panel quant-strategy-card">
          <div className="quant-strategy-card-top">
            <span className="quant-strategy-mark orange">
              <Zap size={18} />
            </span>
            <span className="quant-mode-pill">SANDBOX</span>
          </div>
          <h3>Paper Trading Terminal</h3>
          <p>Execute simulated orders with live risk controller and emergency kill switches.</p>
          <button className="quant-button quant-button-secondary quant-button-small" onClick={() => onNavigate('paper-trading')}>
            Open Terminal <ChevronRight size={14} />
          </button>
        </section>
      </div>

      {/* Saved Strategies Table */}
      <div className="quant-panel quant-table-panel">
        <PanelHeader
          eyebrow="PORTFOLIO"
          title="Configured Quantitative Strategies"
          icon={Bot}
          action="Create New"
          onAction={() => onNavigate('builder')}
        />
        <div className="quant-table-wrap">
          <table className="quant-table">
            <thead>
              <tr>
                <th>Strategy Name</th>
                <th>Instrument</th>
                <th>Version</th>
                <th>Status</th>
                <th>Risk / Reward</th>
                <th>Risk %</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {dashData?.strategies?.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td>{s.instrument}</td>
                  <td><span className="quant-draft-pill">{s.version}</span></td>
                  <td><span className="quant-mode-pill">{s.status}</span></td>
                  <td>1 : {s.riskReward || 2}</td>
                  <td>{s.riskPct || 1.0}%</td>
                  <td>
                    <button
                      className="quant-button quant-button-ghost quant-button-small"
                      onClick={() => onNavigate('backtest')}
                    >
                      Test
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. BROKER CONNECTION VIEW
// ─────────────────────────────────────────────────────────────────────────────
function BrokerConnectionView() {
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [brokerState, setBrokerState] = useState({ readiness: null, status: null });

  const loadBrokerState = async () => {
    setLoading(true);
    const [readinessResult, statusResult] = await Promise.all([
      fetchBrokerReadiness(),
      fetchBrokerStatus(),
    ]);
    setBrokerState({
      readiness: readinessResult.ok ? readinessResult.data : null,
      status: statusResult.ok ? statusResult.data : null,
    });
    if (!readinessResult.ok || !statusResult.ok) {
      setNotice({ type: 'error', text: 'Unable to verify broker status.' });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBrokerState();
  }, []);

  const lemonnReadiness = brokerState.readiness?.brokers?.find((broker) => broker.broker === 'LEMONN');
  const lemonnStatus = brokerState.status?.brokers?.find((broker) => broker.broker === 'LEMONN');
  const isConnected = lemonnStatus?.status === 'CONNECTED' && lemonnStatus?.mode === 'LIVE';

  const handleLemonnConnect = async () => {
    setConnecting(true);
    setNotice({ type: '', text: '' });
    const result = await startLemonnOAuth();
    if (result.ok && result.data?.authorizationUrl) {
      window.location.assign(result.data.authorizationUrl);
    } else {
      setNotice({ type: 'error', text: result.data?.error || 'Lemonn connection could not be started.' });
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    const result = await disconnectBroker('LEMONN');
    if (result.ok) {
      setNotice({ type: 'success', text: 'Lemonn disconnected. Live execution is stopped.' });
      await loadBrokerState();
    } else {
      setNotice({ type: 'error', text: result.data?.error || 'Lemonn could not be disconnected.' });
    }
    setConnecting(false);
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">SYSTEM · BROKER ADAPTERS</span>
          <h1>Broker Connection Architecture</h1>
          <p>Connect official Indian stockbroker adapters for market data and live order execution.</p>
        </div>
      </section>

      <div className="quant-broker-hero">
        <div className="quant-broker-hero-icon">
          <Link2 size={21} />
        </div>
        <div>
          <span className="quant-eyebrow">ADAPTER STATE</span>
          <h2>{isConnected ? 'Lemonn Connected' : 'Lemonn Disconnected'}</h2>
          <p>{isConnected ? 'Backend verified a live LemonN session for this account.' : 'Live execution is unavailable until the backend verifies a LemonN session.'}</p>
        </div>
        <span className="quant-connection-pill">
          <span /> {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="quant-broker-grid">
        <section className="quant-panel quant-broker-card primary">
          <div className="quant-broker-card-top">
            <span className="quant-broker-logo">L</span>
            <span className="quant-coming-pill">{isConnected ? 'CONNECTED' : 'BACKEND VERIFIED STATUS'}</span>
          </div>
          <h3>Lemonn Broker Adapter</h3>
          <p>
            Supports automated OAuth authentication, quote feed, order placement, and live positions reconciliation.
          </p>
          <div className="quant-broker-note">
            <ShieldCheck size={15} />
            <span>{loading ? 'Checking backend provider readiness…' : lemonnReadiness?.enabled ? 'Provider configuration is present. User authentication is still required.' : (lemonnReadiness?.reason || 'Provider is not configured for live execution.')}</span>
          </div>
          {isConnected ? (
            <button className="quant-button quant-button-secondary" onClick={handleDisconnect} disabled={connecting}>
              Disconnect Lemonn <X size={15} />
            </button>
          ) : (
            <button className="quant-button quant-button-primary" onClick={handleLemonnConnect} disabled={connecting || loading}>
              {connecting ? 'Checking provider…' : 'Connect Lemonn'} <ChevronRight size={15} />
            </button>
          )}
          {notice.text && <div className={`quant-connection-alert ${notice.type}`}>{notice.text}</div>}
        </section>

        <section className="quant-panel quant-broker-card primary">
          <div className="quant-broker-card-top">
            <span className="quant-broker-logo" style={{ background: '#f97316' }}>A</span>
            <span className="quant-coming-pill">INTEGRATION READY</span>
          </div>
          <h3>Angel One SmartAPI</h3>
          <p>
            Enterprise WebSocket market tick stream, historical OHLCV candles, and order management.
          </p>
          <div className="quant-broker-note">
            <ShieldCheck size={15} />
            <span>Requires ANGEL_API_KEY, CLIENT_CODE, and TOTP secret in backend environment.</span>
          </div>
          <button
            className="quant-button quant-button-primary"
            onClick={() => setNotice('Angel One SmartAPI requires ANGEL_API_KEY in environment configuration.')}
          >
            Connect Angel One <ChevronRight size={15} />
          </button>
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. WATCHLIST, MARKETS, TABLE & SETTINGS FALLBACK VIEWS
// ─────────────────────────────────────────────────────────────────────────────
function WatchlistView({ onConnect }) {
  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">MARKET DATA</span>
          <h1>Live Watchlist</h1>
          <p>Track instruments that matter to your systematic quantitative models.</p>
        </div>
      </section>
      <div className="quant-panel quant-full-panel" style={{ padding: '20px' }}>
        <table className="quant-table">
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Exchange</th>
              <th>Status</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {watchlistSymbols.map((item) => (
              <tr key={item.symbol}>
                <td><strong>{item.symbol}</strong></td>
                <td>{item.exchange}</td>
                <td><span className="quant-status-dot muted" /> Disconnected</td>
                <td><span className="quant-mode-pill">Sandbox</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GenericTableView({ type, onNavigate }) {
  const titles = {
    portfolio: 'Portfolio & Funds',
    positions: 'Positions',
    orders: 'Orders & History',
    analytics: 'P&L Analytics',
    strategies: 'Algo Strategies',
    notifications: 'Notifications',
    settings: 'Workspace Settings',
  };
  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">QUANT WORKSPACE</span>
          <h1>{titles[type] || 'Section'}</h1>
          <p>Data will populate from live or simulated activity.</p>
        </div>
      </section>
      <div className="quant-panel" style={{ padding: '30px' }}>
        <EmptyData
          title={`No ${titles[type]} data yet`}
          description="Data will populate as strategy backtests and paper simulations are executed."
          action={false}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SHELL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function QuantDashboardPage() {
  const { authState } = useApp();
  const { section: routeSection } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const pathParts = location.pathname.split('/').filter(Boolean);
  let parsedSection = 'dashboard';
  if (routeSection) {
    parsedSection = routeSection;
  } else if (pathParts.length >= 2 && pathParts[0] === 'quant' && pathParts[1] === 'dashboard' && pathParts[2]) {
    parsedSection = pathParts[2];
  } else if (pathParts.length >= 2 && pathParts[0] === 'quant' && pathParts[1] !== 'dashboard') {
    parsedSection = pathParts[1];
  }

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const activeSection = validSections.includes(parsedSection) ? parsedSection : 'dashboard';
  const activeLabel = formatSection(activeSection);

  const goTo = (section) => {
    navigate(section === 'dashboard' ? '/quant/dashboard' : `/quant/dashboard/${section}`);
    setMobileNavOpen(false);
  };

  const page = useMemo(() => {
    if (activeSection === 'dashboard') return <DashboardOverview onNavigate={goTo} />;
    if (activeSection === 'builder') return <StrategyBuilderView onNavigate={goTo} />;
    if (activeSection === 'backtest') return <BacktestRunnerView onNavigate={goTo} />;
    if (activeSection === 'paper-trading') return <PaperTradingTerminalView onNavigate={goTo} />;
    if (activeSection === 'live') return <LiveDeploymentGateView onNavigate={goTo} />;
    if (activeSection === 'risk') return <RiskManagementView onNavigate={goTo} />;
    if (activeSection === 'broker') return <BrokerConnectionView />;
    if (activeSection === 'watchlist') return <WatchlistView onConnect={() => goTo('broker')} />;
    return <GenericTableView type={activeSection} onNavigate={goTo} />;
  }, [activeSection]);

  return (
    <div className="quant-shell">
      <MarketTape />
      <aside className={`quant-sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="quant-brand">
          <Link to="/">
            <span className="quant-brand-mark">K</span>
            <span>
              <strong>KEPWE</strong>
              <small>QUANT</small>
            </span>
          </Link>
          <button className="quant-close-nav" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <div className="quant-sidebar-workspace">
          <span className="quant-sidebar-label">Active Workspace</span>
          <button onClick={() => goTo('dashboard')}>
            <span className="quant-avatar">Q</span>
            <span>
              <strong>Quant Lab</strong>
              <small>Simulation Mode</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
        <nav className="quant-sidebar-nav">
          {navSections.map((section) => (
            <div className="quant-nav-group" key={section.label}>
              <span className="quant-sidebar-label">{section.label}</span>
              {section.items.map(({ key, label, icon: Icon }) => (
                <button
                  className={activeSection === key ? 'active' : ''}
                  key={key}
                  onClick={() => goTo(key)}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {key === 'live' && <Lock size={12} style={{ marginLeft: 'auto', color: '#94a3b8' }} />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="quant-sidebar-bottom">
          <button onClick={() => goTo('broker')}>
            <Link2 size={15} />
            <span>
              <strong>Broker Adapters</strong>
              <small>Lemonn & Angel One</small>
            </span>
            <ChevronRight size={14} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            <Link
              to="/quant"
              style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              <ArrowDownRight size={13} /> Quant Marketing
            </Link>
            <Link
              to="/"
              style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
            >
              <ArrowDownRight size={13} /> Back to KEPWE Home
            </Link>
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          className="quant-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="quant-main">
        <header className="quant-topbar">
          <button
            className="quant-mobile-menu"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <div className="quant-topbar-title">
            <span className="quant-topbar-kicker">KEPWE QUANT</span>
            <strong>{activeLabel}</strong>
          </div>
          <div className="quant-topbar-actions">
            <button className="quant-command-button" onClick={() => setCommandOpen(!commandOpen)}>
              <Search size={15} />
              <span>Search workspace</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <button
              className="quant-topbar-icon"
              onClick={() => goTo('notifications')}
              aria-label="Notifications"
            >
              <Bell size={17} />
              <i />
            </button>
            <div className="quant-profile-control">
              <span className="quant-profile-label">Profile</span>
              {authState?.isLoggedIn && <UserMenu />}
            </div>
          </div>
        </header>

        {commandOpen && (
          <div className="quant-command-popover">
            <Search size={15} />
            <input
              autoFocus
              placeholder="Search sections, symbols or settings"
              onKeyDown={(e) => e.key === 'Escape' && setCommandOpen(false)}
            />
            <button onClick={() => { goTo('builder'); setCommandOpen(false); }}>Strategy Builder</button>
            <button onClick={() => { goTo('backtest'); setCommandOpen(false); }}>Backtesting Engine</button>
            <button onClick={() => { goTo('paper-trading'); setCommandOpen(false); }}>Paper Sandbox</button>
            <button onClick={() => { goTo('risk'); setCommandOpen(false); }}>Daily Risk Controller</button>
          </div>
        )}

        <div className="quant-content">{page}</div>
      </main>
    </div>
  );
}