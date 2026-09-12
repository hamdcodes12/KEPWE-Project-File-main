import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { apiFetch } from '../../api/client';
import { BrokerProvider, useBroker } from '../../context/BrokerContext';
import {
  fetchQuantDashboard,
  fetchQuantStrategies,
  fetchQuantAnalytics,
  fetchAlgoBacktests,
  saveQuantStrategy,
  runQuantBacktest,
  validateLiveDeploymentGate,
  fetchRiskStatus,
  fetchBrokerReadiness,
  fetchBrokerStatus,
  connectDhanAccount,
  startDhanOAuth,
  disconnectBroker,
  fetchDhanFunds,
  fetchDhanPositions,
  fetchDhanHoldings,
  fetchDhanOrderBook,
  fetchDhanTradeBook,
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
      { key: 'live', label: 'Live Deployment Gate', icon: Lock },
      { key: 'positions', label: 'Positions', icon: BriefcaseBusiness },
      { key: 'holdings', label: 'Holdings', icon: WalletCards },
      { key: 'orders', label: 'Orders & History', icon: ListFilter },
      { key: 'trades', label: 'Trades', icon: ListFilter },
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

const formatCurrencyValue = (value, fallback = 'N/A') => {
  if (value === null || value === undefined || value === '') return fallback;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return `₹${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercentValue = (value, fallback = 'N/A') => {
  if (value === null || value === undefined || value === '') return fallback;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return `${numericValue.toFixed(2)}%`;
};

const formatCountValue = (value, fallback = 'N/A') => {
  if (value === null || value === undefined || value === '') return fallback;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return numericValue.toLocaleString('en-IN');
};

const formatDateTimeValue = (value, fallback = 'N/A') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-IN');
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const getApiErrorMessage = (response, fallback) => {
  if (!response) return fallback;
  if (response.data?.error) return response.data.error;
  if (response.data?.message) return response.data.message;

  switch (response.status) {
    case 204:
      return 'No analytics data available.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to access this data.';
    case 404:
      return 'Requested analytics data was not found.';
    case 429:
      return 'Too many requests. Please retry in a moment.';
    case 500:
    case 502:
    case 503:
      return 'The analytics service is temporarily unavailable.';
    default:
      return fallback;
  }
};

class QuantModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Quant module failed to load', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '24px' }}>
          <div className="quant-panel" style={{ maxWidth: '520px', width: '100%', textAlign: 'center', padding: '28px' }}>
            <div style={{ display: 'inline-grid', placeItems: 'center', width: '52px', height: '52px', borderRadius: '14px', background: '#fee2e2', color: '#b91c1c', marginBottom: '16px' }}>
              <AlertTriangle size={24} />
            </div>
            <h2 style={{ marginBottom: '8px', color: '#0f172a' }}>Quant module failed to load</h2>
            <p style={{ marginBottom: '18px', color: '#64748b', lineHeight: 1.6 }}>
              A runtime error interrupted the Quant dashboard. Reload the module to retry after the underlying issue is fixed.
            </p>
            <button className="quant-button quant-button-primary" onClick={this.handleRetry}>
              Retry <RefreshCw size={15} />
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function EmptyData({
  title = 'No records found',
  description = 'Data will appear here once orders or activities are executed.',
  action = false,
  actionLabel = 'Connect broker',
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
      {action && onConnect && (
        <button className="quant-button quant-button-primary quant-button-small" onClick={onConnect}>
          {actionLabel} <ChevronRight size={14} />
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
  const [marketFeed, setMarketFeed] = useState({
    indices: [],
    loading: true,
    label: 'Market Feed: Standby (NSE Closed)',
    error: '',
  });
  const { dhanStatus, isBrokerConnected, brokerState } = useBroker();

  const loadTape = useCallback(async (signal) => {
    try {
      const indicesRes = await apiFetch('/market/indices', { signal });
      if (signal?.aborted) return;

      const liveIndices = asArray(indicesRes?.data?.indices);
      if (indicesRes?.ok && liveIndices.length > 0) {
        setMarketFeed({
          indices: liveIndices,
          loading: false,
          label: 'Market Feed: Active (Upstox)',
          error: '',
        });
        return;
      }

      const standbyLabel = liveIndices.length > 0
        ? 'Market Feed: Active (Upstox)'
        : 'Market Feed: Standby (NSE Closed)';

      setMarketFeed({
        indices: liveIndices,
        loading: false,
        label: standbyLabel,
        error: getApiErrorMessage(indicesRes, 'Unable to load market data.'),
      });
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setMarketFeed((current) => ({
        indices: current.indices,
        loading: false,
        label: current.indices.length > 0 ? 'Market Feed: Active (Upstox)' : 'Market Feed: Standby (NSE Closed)',
        error: error?.message || 'Unable to load market data.',
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadTape(controller.signal);
    const interval = setInterval(() => {
      const refreshController = new AbortController();
      loadTape(refreshController.signal);
    }, 30000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [loadTape]);

  const defaultItems = [
    { name: 'NIFTY 50', symbol: 'NIFTY' },
    { name: 'BANK NIFTY', symbol: 'BANKNIFTY' },
    { name: 'FINNIFTY', symbol: 'FINNIFTY' },
    { name: 'INDIA VIX', symbol: 'INDIAVIX' },
  ];

  let dhanStatusText = 'Dhan: Checking...';
  let dhanDotClass = 'muted';
  if (brokerState.status === 'CONNECTED' && isBrokerConnected) {
    dhanStatusText = `Dhan: Connected (${dhanStatus?.clientId || 'Live'})`;
    dhanDotClass = '';
  } else if (brokerState.status === 'DHAN_SESSION_EXPIRED') {
    dhanStatusText = 'Dhan: Session Expired';
    dhanDotClass = 'warn';
  } else if (brokerState.status === 'DISCONNECTED') {
    dhanStatusText = 'Dhan: Disconnected';
    dhanDotClass = 'muted';
  }

  return (
    <div className="quant-market-tape">
      <div className="quant-tape-brand">
        <span className="quant-live-dot" /> KEPWE QUANT
      </div>
      <div className="quant-tape-items">
        {defaultItems.map((item) => {
          const live = marketFeed.indices.find((idx) => idx.symbol === item.symbol || idx.name === item.name);
          const changeVal = live?.change != null ? Number(live.change) : null;
          const changePct = live?.changePercent != null ? Number(live.changePercent) : null;
          const isUp = changeVal > 0;
          const isDown = changeVal < 0;

          return (
            <span key={item.name} className="quant-tape-item">
              <b>{item.name}</b>
              {live?.price != null ? (
                <>
                  <em>₹{Number(live.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</em>
                  <small style={{ color: isUp ? '#159975' : isDown ? '#c53030' : '#64748b' }}>
                    {isUp ? '+' : ''}{changeVal ? changeVal.toFixed(2) : '0.00'} ({isUp ? '+' : ''}{changePct ? changePct.toFixed(2) : '0.00'}%)
                  </small>
                </>
              ) : (
                <>
                  <em>—</em>
                  <small>Standby</small>
                </>
              )}
            </span>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', whiteSpace: 'nowrap' }}>
        <span className="quant-tape-status">
          <span className={`quant-status-dot ${marketFeed.indices.length > 0 ? '' : 'muted'}`} />
          {marketFeed.loading ? 'Loading market feed…' : marketFeed.label}
        </span>
        <span className="quant-tape-status" style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '12px' }}>
          <span className={`quant-status-dot ${dhanDotClass}`} />
          {dhanStatusText}
        </span>
      </div>
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
                Review your quantitative parameters before saving or deploying to live markets.
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
  const [marketRequest, setMarketRequest] = useState({ symbol: 'NIFTY 50', exchange: 'NSE', interval: '5m', start_time: '', end_time: '' });

  const executeBacktest = async () => {
    setLoading(true);
    setError('');
    try {
      if (!marketRequest.start_time || !marketRequest.end_time) {
        throw new Error('Historical data unavailable: enter a start and end time.');
      }
      const marketResult = await apiFetch('/broker/DHAN/market-data/historical-chart', {
        method: 'POST',
        body: marketRequest,
      });
      if (!marketResult.ok) throw new Error(marketResult.data?.error || 'Historical market data unavailable from broker.');
      const providerData = marketResult.data?.data?.data || marketResult.data?.data || {};
      const candles = providerData.candles || providerData.data || [];
      if (!Array.isArray(candles) || candles.length < 30) throw new Error('At least 30 historical candles are required for backtest.');
      const data = await runQuantBacktest({
        capital: Number(capital),
        riskPct: Number(riskPct),
        optionType,
        lotSize: Number(lotSize),
        candles,
      });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Backtest execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">QUANT LAB · AUDITED SIMULATION</span>
          <h1>Quantitative Backtesting Engine</h1>
          <p>
            Run the NIFTY 50 Option Buyer strategy only against supplied historical candles. No benchmark candles are fabricated.
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
          <label>Provider Symbol</label>
          <input type="text" value={marketRequest.symbol} onChange={(e) => setMarketRequest({ ...marketRequest, symbol: e.target.value })} />
        </div>
        <div className="quant-backtest-field">
          <label>Exchange</label>
          <input type="text" value={marketRequest.exchange} onChange={(e) => setMarketRequest({ ...marketRequest, exchange: e.target.value })} />
        </div>
        <div className="quant-backtest-field">
          <label>Start Time</label>
          <input type="datetime-local" value={marketRequest.start_time} onChange={(e) => setMarketRequest({ ...marketRequest, start_time: e.target.value })} />
        </div>
        <div className="quant-backtest-field">
          <label>End Time</label>
          <input type="datetime-local" value={marketRequest.end_time} onChange={(e) => setMarketRequest({ ...marketRequest, end_time: e.target.value })} />
        </div>
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
        <PanelHeader eyebrow="EXECUTION AUDIT" title="Backtest Trade Log" icon={ListFilter} />
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
// 3. LIVE DEPLOYMENT SAFETY GATE VIEW (Safely blocks real money without broker)
// ─────────────────────────────────────────────────────────────────────────────
function LiveDeploymentGateView({ onNavigate }) {
  // ✅ USE SHARED BROKER STATE FROM CONTEXT (NOT LOCAL/STALE)
  const { brokerState, isBrokerConnected, dhanStatus } = useBroker();

  const [gateData, setGateData] = useState(null);
  const [gateLoading, setGateLoading] = useState(false);

  // ✅ DETERMINE GATE STATUS BASED ON REAL BROKER STATE
  const isBrokerLoading = brokerState.status === 'LOADING';
  const isDhanConnected = isBrokerConnected && brokerState.status === 'CONNECTED';
  const isDhanExpired = brokerState.status === 'DHAN_SESSION_EXPIRED';
  const isDhanDisconnected = brokerState.status === 'DISCONNECTED';

  const checkGate = useCallback(async () => {
    // ✅ ONLY CHECK GATE IF BROKER IS CONNECTED
    if (!isDhanConnected) {
      setGateData(null);
      return;
    }

    setGateLoading(true);
    try {
      const res = await validateLiveDeploymentGate({
        riskPerTradePct: 1.0,
        maxTradesPerDay: 3,
        maxConsecutiveLosses: 2,
      });
      setGateData(res);
    } catch (err) {
      setGateData(null);
      console.error('[LiveGate] Validation error:', err.message);
    } finally {
      setGateLoading(false);
    }
  }, [isDhanConnected]);

  // ✅ CHECK GATE WHEN BROKER STATE CHANGES (REAL-TIME POLLING)
  useEffect(() => {
    checkGate();
  }, [checkGate]);

  // ✅ DETERMINE OVERALL GATE STATE
  const isGateReady = isDhanConnected && gateData?.isDeployable === true;
  const brokerError = isDhanExpired ? 'Dhan session expired' : isDhanDisconnected ? 'Broker not connected' : null;

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
          <button className="quant-button quant-button-secondary" onClick={checkGate} disabled={gateLoading || isBrokerLoading}>
            <RefreshCw size={14} /> {gateLoading ? 'Checking…' : 'Check Prerequisites'}
          </button>
        </div>
      </section>

      {/* ✅ BROKER STATUS INDICATOR */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Broker Session Status</div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px',
            borderRadius: '8px',
            background: isDhanConnected ? '#e6f8f2' : isDhanExpired ? '#fef3c7' : '#fee2e2',
            color: isDhanConnected ? '#159975' : isDhanExpired ? '#b45309' : '#c53030',
          }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isDhanConnected ? '#159975' : isDhanExpired ? '#b45309' : '#c53030',
            }} />
            {isBrokerLoading ? (
              <>Verifying broker connection…</>
            ) : isDhanConnected ? (
              <>Dhan Connected · Live Execution Ready</>
            ) : isDhanExpired ? (
              <>Dhan Session Expired · Reconnect Required</>
            ) : (
              <>Dhan Disconnected · Connection Required</>
            )}
          </div>
        </div>
      </div>

      {/* ✅ BROKER NOT CONNECTED - SHOW RECONNECT STATE */}
      {!isBrokerLoading && brokerError && (
        <div className="quant-panel" style={{ padding: '24px', textAlign: 'center', marginBottom: '18px' }}>
          <AlertTriangle size={32} style={{ color: '#b45309', margin: '0 auto 12px', display: 'block' }} />
          <h3 style={{ fontSize: '15px', color: '#1e293b', marginBottom: '8px' }}>
            {isDhanExpired ? 'Session Expired' : 'Broker Disconnected'}
          </h3>
          <p style={{ color: '#64748b', fontSize: '11px', maxWidth: '480px', margin: '0 auto 18px', lineHeight: 1.5 }}>
            {isDhanExpired
              ? 'Your Dhan session has expired. Reconnect your broker to resume live trading.'
              : 'Live trading requires a connected broker. Set up your Dhan account to enable live execution.'}
          </p>
          <button className="quant-button quant-button-primary" onClick={() => onNavigate('broker')}>
            <Link2 size={15} /> {isDhanExpired ? 'Reconnect' : 'Connect'} Broker
          </button>
        </div>
      )}

      {/* ✅ BROKER LOADING - SHOW LOADING STATE */}
      {isBrokerLoading && (
        <div className="quant-panel" style={{ padding: '28px', textAlign: 'center' }}>
          <EmptyData title="Verifying Broker Connection..." description="Checking Dhan session and market feed availability..." action={false} />
        </div>
      )}

      {/* ✅ BROKER CONNECTED - SHOW GATE CHECKS */}
      {!isBrokerLoading && isDhanConnected && (
        <>
          {/* Prominent Status Banner */}
          <div className="quant-gate-hero" style={{ marginBottom: '18px' }}>
            <div className="quant-gate-hero-icon">
              <Lock size={22} />
            </div>
            <div>
              <span className="quant-eyebrow" style={{ color: isGateReady ? '#159975' : '#c53030' }}>
                {isGateReady ? 'DEPLOYMENT READY' : 'GATE CHECK IN PROGRESS'}
              </span>
              <h2 style={{ fontSize: '18px', color: isGateReady ? '#15803d' : '#9b2c2c', margin: '4px 0' }}>
                {isGateReady ? '✓ LIVE READY' : gateLoading ? 'Checking Prerequisites…' : 'Prerequisites Review'}
              </h2>
              <p style={{ color: isGateReady ? '#16a34a' : '#742a2a', fontSize: '11px', margin: 0 }}>
                {isGateReady
                  ? 'All prerequisites passed. Strategy can be deployed with live Dhan broker.'
                  : gateLoading
                    ? 'Validating strategy parameters and broker readiness…'
                    : 'Review prerequisite checks below.'}
              </p>
            </div>
            <span className="quant-lock-badge" style={{ marginLeft: 'auto' }}>
              <Lock size={12} /> SECURED
            </span>
          </div>

          {/* Gate Check Cards */}
          {gateData?.checks && (
            <div className="quant-gate-checks" style={{ marginBottom: '18px' }}>
              {gateData.checks.map((check, idx) => (
                <div className="quant-panel" key={idx} style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: check.passed ? '#e6f8f2' : '#fee2e2',
                    color: check.passed ? '#159975' : '#c53030',
                    flexShrink: 0,
                  }}>
                    {check.passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a', fontSize: '13px' }}>{check.label}</strong>
                    <p style={{ color: '#64748b', fontSize: '11px', margin: '4px 0 0 0' }}>{check.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gate Ready OR Blocked Action */}
          {isGateReady ? (
            <div className="quant-panel" style={{ padding: '24px', textAlign: 'center', background: '#e6f8f2', borderLeft: '4px solid #159975' }}>
              <CheckCircle2 size={32} style={{ color: '#159975', margin: '0 auto 12px', display: 'block' }} />
              <h3 style={{ fontSize: '15px', color: '#15803d', marginBottom: '8px' }}>Live Deployment Unlocked</h3>
              <p style={{ color: '#166534', fontSize: '11px', maxWidth: '480px', margin: '0 auto 18px', lineHeight: 1.5 }}>
                Your strategy has passed all security prerequisites. You may now deploy with live Dhan broker for real funds execution.
              </p>
              <button className="quant-button quant-button-primary" onClick={() => onNavigate('strategies')}>
                <Zap size={15} /> Deploy Live Strategy
              </button>
            </div>
          ) : (
            !gateLoading && gateData && (
              <div className="quant-panel" style={{ padding: '24px', textAlign: 'center' }}>
                <ShieldAlert size={32} style={{ color: '#c53030', margin: '0 auto 12px', display: 'block' }} />
                <h3 style={{ fontSize: '15px', color: '#1e293b', marginBottom: '8px' }}>Prerequisites Not Met</h3>
                <p style={{ color: '#64748b', fontSize: '11px', maxWidth: '480px', margin: '0 auto 18px', lineHeight: 1.5 }}>
                  Address the failed prerequisite checks above before deploying live. All checks must pass for security compliance.
                </p>
              </div>
            )
          )}
        </>
      )}
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
      // TODO: Implement real Dhan kill switch endpoint
      // const res = await triggerKillSwitch();
      const res = { message: 'Kill switch implementation pending - endpoint not available' };
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
  const { dhanStatus, isBrokerConnected } = useBroker();

  useEffect(() => {
    fetchQuantDashboard()
      .then((dashboard) => {
        if (dashboard?.ok) setDashData(dashboard.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dhanConnected = isBrokerConnected;

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
            <span className={`quant-status-dot ${dhanConnected ? 'active' : 'muted'}`} /> {dhanConnected ? 'Dhan Connected' : 'No live broker connected'}
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
          <strong>{dhanConnected ? 'Dhan live session verified' : 'No live Dhan broker connected'}</strong>
          <p>
            {dhanConnected ? 'Live Dhan account data and order execution are active through your connected account.' : 'Connect your personal Dhan trading account to enable live execution. Backtest analysis is available without broker connection.'}
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
          <strong>{dashData?.capital == null ? 'No data' : `₹${Number(dashData.capital).toLocaleString('en-IN')}`}</strong>
          <small>Configured risk budget</small>
        </div>
        <div className="quant-metric-card">
          <div className="quant-metric-top">
            <span>Today's Live P&L</span>
            <TrendingUp size={16} />
          </div>
          <strong style={{ color: (dashData?.todayPnl || 0) >= 0 ? '#159975' : '#c53030' }}>
            ₹{dashData?.todayPnl || 0}
          </strong>
          <small>{dashData?.todayTrades || 0} live trades executed today</small>
        </div>
        <div className="quant-metric-card">
          <div className="quant-metric-top">
            <span>Active Strategies</span>
            <Bot size={16} />
          </div>
            <strong>{dashData?.strategies?.length ?? 'No data'}</strong>
            <small>Saved strategies</small>
        </div>
        <div className="quant-metric-card">
          <div className="quant-metric-top">
            <span>Execution Status</span>
            <Gauge size={16} />
          </div>
            <strong>{dashData?.algoStatus || 'No data'}</strong>
            <small>{dashData?.openPositions == null ? 'No position data' : `${dashData.openPositions} open positions`}</small>
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
          <p>Run backtests against 5+ years of historical market data to validate strategy performance before live deployment.</p>
          <button className="quant-button quant-button-secondary quant-button-small" onClick={() => onNavigate('backtest')}>
            Open Backtest <ChevronRight size={14} />
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
  const { authState } = useApp();
  const { brokerState: centralBrokerState, dhanStatus, isBrokerConnected, refreshBrokerState } = useBroker();
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [readiness, setReadiness] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [dhanClientId, setDhanClientId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const loadReadiness = async () => {
    try {
      const readinessResult = await fetchBrokerReadiness();
      if (readinessResult?.ok) {
        setReadiness(readinessResult.data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadReadiness();
  }, []);

  const dhanReadiness = readiness?.brokers?.find((broker) => broker.broker === 'DHAN');
  const isConnected = isBrokerConnected;
  const isSessionExpired = centralBrokerState.status === 'DHAN_SESSION_EXPIRED';
  const loading = centralBrokerState.status === 'LOADING';

  const handleDirectConnect = async (e) => {
    e.preventDefault();
    if (!dhanClientId.trim() || !accessToken.trim()) {
      setNotice({ type: 'error', text: 'Please provide both Dhan Client ID and Access Token.' });
      return;
    }
    if (!authState.isLoggedIn) {
      setNotice({ type: 'error', text: 'You must be signed in to KEPWE to connect your Dhan account. Please sign in first.' });
      return;
    }
    setConnecting(true);
    setNotice({ type: '', text: '' });
    try {
      const result = await connectDhanAccount({
        dhanClientId: dhanClientId.trim(),
        accessToken: accessToken.trim(),
      });
      if (result.ok) {
        setNotice({ type: 'success', text: 'Dhan account connected and session verified successfully!' });
        setAccessToken('');
        await refreshBrokerState({ force: true });
      } else {
        const errorMsg = result.data?.error || result.data?.message || (result.status === 401 ? 'Your session has expired. Please log in again.' : 'Failed to validate and connect Dhan account.');
        setNotice({ type: 'error', text: errorMsg });
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Network error while connecting Dhan account.' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDhanConsentConnect = async () => {
    if (!authState.isLoggedIn) {
      setNotice({ type: 'error', text: 'You must be signed in to KEPWE to connect your Dhan account. Please sign in first.' });
      return;
    }
    setConnecting(true);
    setNotice({ type: '', text: '' });
    try {
      const result = await startDhanOAuth();
      if (result.ok && result.data?.authorizationUrl) {
        window.location.assign(result.data.authorizationUrl);
      } else {
        setNotice({ type: 'error', text: result.data?.error || 'Dhan consent session could not be started.' });
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to start Dhan consent session.' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    setNotice({ type: '', text: '' });
    try {
      const result = await disconnectBroker('DHAN');
      if (result.ok) {
        setNotice({ type: 'success', text: 'Dhan disconnected. Live execution is stopped.' });
        await refreshBrokerState({ force: true });
      } else {
        setNotice({ type: 'error', text: result.data?.error || 'Dhan could not be disconnected.' });
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Failed to disconnect Dhan account.' });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">SYSTEM · BROKER ADAPTERS</span>
          <h1>Broker Connection Architecture</h1>
          <p>Connect official DhanHQ v2 adapter for live market data feeds and algorithmic order execution.</p>
        </div>
      </section>

      <div className="quant-broker-hero">
        <div className="quant-broker-hero-icon">
          <Link2 size={21} />
        </div>
        <div>
          <span className="quant-eyebrow">DHAN ADAPTER STATE</span>
          <h2>{isConnected ? 'Dhan Connected · Live Execution Active' : isSessionExpired ? 'Dhan Session Expired' : 'Dhan Disconnected'}</h2>
          <p>{isConnected ? `Backend verified live DhanHQ session for client ID ${dhanStatus?.clientId || ''}.` : isSessionExpired ? 'Dhan rejected the stored session. Please reconnect with fresh credentials.' : 'Live order routing is disabled until you connect your personal Dhan account.'}</p>
        </div>
        <span className={`quant-connection-pill ${isConnected ? 'connected' : ''}`}>
          <span /> {isConnected ? 'Connected / Live Active' : isSessionExpired ? 'Session Expired' : 'Disconnected'}
        </span>
      </div>

      <div className="quant-broker-grid">
        <section className="quant-panel quant-broker-card primary">
          <div className="quant-broker-card-top">
            <span className="quant-broker-logo" style={{ background: '#075056' }}>D</span>
            <span className="quant-coming-pill">{isConnected ? 'LIVE / SESSION ACTIVE' : isSessionExpired ? 'SESSION EXPIRED' : 'ACTIVE BROKER'}</span>
          </div>
          <h3>DhanHQ v2 Broker Adapter</h3>
          <p>
            Official DhanHQ API v2 integration for real-time market execution, position tracking, margin limits, and postback webhook synchronization.
          </p>

          <div className="quant-broker-note">
            <ShieldCheck size={15} />
            <span>
              {loading ? 'Checking backend Dhan readiness…' : isConnected ? `Verified Dhan session for account ${dhanStatus?.clientId || ''}. Live execution active.` : isSessionExpired ? 'Stored Dhan session expired or invalid. Reconnect to continue live execution.' : 'Static IP 103.117.180.146 is whitelisted for Dhan API. Each user connects their personal account.'}
            </span>
          </div>

          {isConnected ? (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', fontSize: '0.82rem', color: '#475569' }}>
                <div><strong>Client ID:</strong> {dhanStatus?.clientId || 'Connected'}</div>
                <div><strong>Connection Mode:</strong> LIVE (DhanHQ API v2)</div>
                <div><strong>Static Whitelist IP:</strong> <code>103.117.180.146</code></div>
                <div><strong>Postback Webhook:</strong> <code>https://kepwe.in/api/dhan/callback</code></div>
              </div>
              <button className="quant-button quant-button-secondary" onClick={handleDisconnect} disabled={connecting}>
                Disconnect Dhan <X size={15} />
              </button>
            </div>
          ) : (
            <div>
              {!authState.isLoggedIn && (
                <div className="quant-connection-alert error" style={{ marginBottom: '12px' }}>
                  Your session is inactive. Please <Link to="/quant/login?returnTo=/quant/dashboard/broker" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>sign in</Link> to connect your personal Dhan account.
                </div>
              )}
              <form onSubmit={handleDirectConnect} style={{ marginTop: '12px' }}>
                <div className="quant-form-group">
                  <label className="quant-form-label">Dhan Client ID</label>
                  <input
                    type="text"
                    className="quant-form-input"
                    placeholder="e.g. 1100345678"
                    value={dhanClientId}
                    onChange={(e) => setDhanClientId(e.target.value)}
                    disabled={connecting}
                    required
                  />
                </div>
                <div className="quant-form-group">
                  <label className="quant-form-label">Dhan 24h Access Token (JWT)</label>
                  <input
                    type="password"
                    className="quant-form-input"
                    placeholder="Paste 24-hour Access Token from web.dhan.co"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    disabled={connecting}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <button type="submit" className="quant-button quant-button-primary" disabled={connecting || loading}>
                    {connecting ? 'Validating…' : isSessionExpired ? 'Reconnect Dhan' : 'Connect Dhan Account'} <ChevronRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="quant-button quant-button-secondary"
                    onClick={handleDhanConsentConnect}
                    disabled={connecting || loading}
                    title="Authenticate using Dhan consent login popup"
                  >
                    Login with Dhan Consent <ExternalLink size={14} />
                  </button>
                </div>
              </form>
              <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                💡 <em>Generate your token at <strong>web.dhan.co &gt; My Profile &gt; Access DhanHQ APIs</strong>. Tokens are encrypted using AES-256-GCM.</em>
              </div>
            </div>
          )}

          {notice.text && <div className={`quant-connection-alert ${notice.type}`}>{notice.text}</div>}
        </section>

        <section className="quant-panel quant-broker-card muted">
          <div className="quant-broker-card-top">
            <span className="quant-broker-logo gray">A</span>
            <span className="quant-coming-pill">COMING SOON</span>
          </div>
          <h3>Angel One SmartAPI</h3>
          <p>
            Enterprise WebSocket market tick stream, historical OHLCV candles, and order routing. Currently disabled while Dhan integration is active.
          </p>
          <div className="quant-broker-note">
            <ShieldCheck size={15} />
            <span>Currently disabled. Dhan is the sole active broker for live algorithmic execution.</span>
          </div>
          <button className="quant-button quant-button-secondary" disabled>
            Coming Soon
          </button>
        </section>
      </div>
    </div>
  );
}

function BrokerDataView({ type, onConnect }) {
  const { brokerState, dhanStatus, isBrokerConnected, isDhanConnected, refreshBrokerState } = useBroker();
  const [liveData, setLiveData] = useState(null);
  const [liveError, setLiveError] = useState('');
  const [loading, setLoading] = useState(true);

  const loaders = {
    portfolio: fetchDhanFunds,
    positions: fetchDhanPositions,
    orders: fetchDhanOrderBook,
    holdings: fetchDhanHoldings,
    trades: fetchDhanTradeBook,
    analytics: fetchDhanFunds,
    watchlist: fetchDhanPositions,
  };

  const titles = {
    portfolio: 'Portfolio & Funds',
    positions: 'Positions',
    orders: 'Orders & History',
    holdings: 'Holdings',
    trades: 'Trades',
    analytics: 'P&L Analytics',
    watchlist: 'Watchlist',
  };

  const emptyDescriptions = {
    portfolio: 'No active funds data returned from your Dhan account.',
    positions: 'No open positions in your Dhan account.',
    holdings: 'No demat holdings found in your Dhan account.',
    orders: 'No orders placed today on Dhan.',
    trades: 'No trades executed today on Dhan.',
    watchlist: 'No instruments currently tracked in live watchlist.',
  };

  const loadAll = async () => {
    setLoading(true);
    setLiveError('');

    try {
      const loaderFn = loaders[type] || fetchDhanFunds;
      const liveRes = await loaderFn();

      if (liveRes?.ok) {
        setLiveData(liveRes.data);
      } else {
        if (liveRes?.data?.code === 'DHAN_SESSION_EXPIRED' || liveRes?.status === 401) {
          refreshBrokerState({ force: true });
        }
        setLiveError(liveRes?.data?.error || 'Live Dhan data is unavailable.');
      }
    } catch (err) {
      setLiveError(err?.message || 'Live Dhan data is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [type]);

  // Live Records parsing
  const providerPayload = liveData?.data?.data || liveData?.data || liveData;
  const providerArrays = providerPayload && typeof providerPayload === 'object'
    ? Object.values(providerPayload).filter(Array.isArray).flat()
    : [];
  const liveRecords = liveData?.realizedPnl !== undefined ? [liveData]
    : liveData?.funds ? [liveData.funds]
    : liveData?.positions || liveData?.holdings || liveData?.orderbook?.data?.orders || liveData?.orders || liveData?.trades || providerArrays;
  const liveColumns = [...new Set(liveRecords.flatMap((record) => Object.keys(record || {})))].slice(0, 10);
  const formatValue = (value) => value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'No data');

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">EXECUTION & PORTFOLIO</span>
          <h1>{titles[type] || 'Execution View'}</h1>
          <p>View live Dhan account data and real execution records.</p>
        </div>
        <div className="quant-page-action">
          <button className="quant-button quant-button-secondary quant-button-small" onClick={loadAll}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </section>

      {/* LIVE DHAN DATA ONLY - PRODUCTION MODE */}
      <div className="quant-panel quant-table-panel">
        <PanelHeader
          eyebrow="DHANHQ API V2"
          title={`Live Dhan ${titles[type]}`}
          icon={WalletCards}
        />
        {loading ? (
          <EmptyData title="Loading live provider data" description="The backend is querying your active Dhan session..." action={false} />
        ) : brokerState.status === 'LOADING' ? (
          <EmptyData title="Verifying broker connection" description="Checking your authenticated Dhan session with the backend..." action={false} />
        ) : brokerState.status === 'DHAN_SESSION_EXPIRED' ? (
          <EmptyData
            title="Dhan session expired"
            description="Your 24-hour Dhan access token has expired. Please reconnect your Dhan account."
            action={true}
            actionLabel="Reconnect Dhan"
            onConnect={onConnect}
          />
        ) : !isBrokerConnected ? (
          <EmptyData
            title="Dhan Live Broker Disconnected"
            description="Connect your Dhan account to view live positions, orders, and portfolio data."
            action={true}
            actionLabel="Connect broker"
            onConnect={onConnect}
          />
        ) : liveError ? (
          <EmptyData
            title="Unable to load Dhan data"
            description={liveError}
            action={true}
            actionLabel="Retry"
            onConnect={loadAll}
          />
        ) : type === 'portfolio' ? (
          <div style={{ padding: '24px' }}>
            <div className="quant-metric-grid" style={{ marginBottom: '16px' }}>
              <div className="quant-metric-card">
                <div className="quant-metric-top"><span>Available Margin</span><WalletCards size={16} /></div>
                <strong>₹{Number(liveData?.funds?.available ?? liveData?.available ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <small>Cash balance for orders</small>
              </div>
              <div className="quant-metric-card">
                <div className="quant-metric-top"><span>Utilized Margin</span><BriefcaseBusiness size={16} /></div>
                <strong>₹{Number(liveData?.funds?.utilized ?? liveData?.utilized ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <small>Margin in open positions</small>
              </div>
              <div className="quant-metric-card">
                <div className="quant-metric-top"><span>Collateral Amount</span><ShieldCheck size={16} /></div>
                <strong>₹{Number(liveData?.funds?.collateral ?? liveData?.collateral ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <small>Pledged securities</small>
              </div>
              <div className="quant-metric-card">
                <div className="quant-metric-top"><span>Withdrawable Balance</span><CircleDollarSign size={16} /></div>
                <strong>₹{Number(liveData?.funds?.withdrawable ?? liveData?.withdrawable ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <small>Available to withdraw</small>
              </div>
            </div>
          </div>
        ) : liveRecords.length === 0 ? (
          <EmptyData
            title="No records found"
            description={emptyDescriptions[type] || `No ${type} records found in your Dhan account.`}
            action={false}
          />
        ) : (
          <div className="quant-table-wrap">
            <table className="quant-table">
              <thead>
                <tr>{liveColumns.filter((c) => c !== 'raw').map((col) => <th key={col}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {liveRecords.map((record, index) => (
                  <tr key={record.id || record.orderId || record.orderID || record.tradeNo || index}>
                    {liveColumns.filter((c) => c !== 'raw').map((col) => (
                      <td key={col}>{formatValue(record[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                <td><span className="quant-mode-pill">Live</span></td>
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
          <p>Real execution data will populate as strategies are deployed and executed on Dhan.</p>
        </div>
      </section>
      <div className="quant-panel" style={{ padding: '30px' }}>
        <EmptyData
          title={`No ${titles[type]} data yet`}
          description="Real execution data will appear here as strategies execute on your live Dhan account."
          action={false}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SHELL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function QuantDashboardContent() {
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
    if (activeSection === 'live') return <LiveDeploymentGateView onNavigate={goTo} />;
    if (activeSection === 'risk') return <RiskManagementView onNavigate={goTo} />;
    if (activeSection === 'strategies') return <StrategiesView onNavigate={goTo} />;
    if (activeSection === 'analytics') return <AnalyticsView onNavigate={goTo} />;
    if (activeSection === 'broker') return <BrokerConnectionView />;
    if (['portfolio', 'positions', 'holdings', 'orders', 'trades', 'watchlist', 'markets'].includes(activeSection)) return <BrokerDataView type={activeSection === 'markets' ? 'watchlist' : activeSection} onConnect={() => goTo('broker')} />;
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
              <small>Dhan (HQ API v2)</small>
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
            <button onClick={() => { goTo('risk'); setCommandOpen(false); }}>Daily Risk Controller</button>
          </div>
        )}

        <div className="quant-content">{page}</div>
      </main>
    </div>
  );
}

export default function QuantDashboardPage() {
  return (
    <QuantModuleErrorBoundary>
      <BrokerProvider>
        <QuantDashboardContent />
      </BrokerProvider>
    </QuantModuleErrorBoundary>
  );
}

function StrategyField({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px', flex: '1 1 130px' }}>
      <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <strong style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>{value}</strong>
    </div>
  );
}

function StrategiesView({ onNavigate }) {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStrategies = useCallback(async (signal) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchQuantStrategies({ signal });
      if (signal?.aborted) return;

      if (!response?.ok) {
        setStrategies([]);
        setError(getApiErrorMessage(response, 'Unable to load strategies.'));
        return;
      }

      const items = asArray(response.data?.strategies);
      setStrategies(items);
      if (!Array.isArray(response.data?.strategies)) {
        setError('Malformed strategy response received from the server.');
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setStrategies([]);
      setError(err?.message || 'Unable to load strategies.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadStrategies(controller.signal);
    return () => controller.abort();
  }, [loadStrategies]);

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">STRATEGY INVENTORY</span>
          <h1>Algo Strategies</h1>
          <p>All saved Quant strategies for the authenticated user are listed here with their actual stored status and deployment state.</p>
        </div>
        <div className="quant-page-action">
          <button className="quant-button quant-button-secondary quant-button-small" onClick={() => loadStrategies()}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="quant-button quant-button-primary quant-button-small" onClick={() => onNavigate('builder')}>
            <Plus size={13} /> New Strategy
          </button>
        </div>
      </section>

      {loading ? (
        <div className="quant-panel" style={{ padding: '28px' }}>
          <EmptyData title="Loading strategies..." description="Fetching all saved strategy records from the backend..." action={false} />
        </div>
      ) : error && strategies.length === 0 ? (
        <div className="quant-panel" style={{ padding: '28px' }}>
          <EmptyData title="Unable to load strategies" description={error} action={true} actionLabel="Retry" onConnect={() => loadStrategies()} />
        </div>
      ) : strategies.length === 0 ? (
        <div className="quant-panel" style={{ padding: '28px' }}>
          <EmptyData
            title="No strategies found"
            description="No saved quantitative strategies exist for this account yet."
            action={true}
            actionLabel="Create strategy"
            onConnect={() => onNavigate('builder')}
          />
        </div>
      ) : (
        <>
          {error && (
            <div className="quant-connection-alert error" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}
          <div className="quant-strategy-grid">
            {strategies.map((strategy) => (
              <section className="quant-panel quant-strategy-card" key={strategy.id} style={{ padding: '22px' }}>
                <div className="quant-strategy-card-top" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <span className="quant-mode-pill">{strategy.status || 'N/A'}</span>
                    <h3 style={{ marginTop: '12px', marginBottom: '6px' }}>{strategy.name || 'N/A'}</h3>
                    <p style={{ marginBottom: 0, color: '#64748b', fontSize: '0.82rem' }}>
                      ID: <code>{strategy.id || 'N/A'}</code>
                    </p>
                  </div>
                  <span className="quant-coming-pill">{strategy.executionMode || 'N/A'}</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '18px' }}>
                  <StrategyField label="Instrument" value={strategy.instrument || 'N/A'} />
                  <StrategyField label="Strategy Type" value={strategy.strategyType || 'N/A'} />
                  <StrategyField label="Direction" value={strategy.cePeDirection || 'N/A'} />
                  <StrategyField label="Timeframe" value={strategy.timeframe || 'N/A'} />
                  <StrategyField label="Execution" value={strategy.executionMode || 'N/A'} />
                  <StrategyField label="Deployment" value={strategy.deploymentState || 'N/A'} />
                  <StrategyField label="Capital" value={formatCurrencyValue(strategy.capital)} />
                  <StrategyField label="Risk" value={formatPercentValue(strategy.risk)} />
                  <StrategyField label="Stop Loss" value={formatPercentValue(strategy.stopLoss)} />
                  <StrategyField label="Profit Target" value={formatPercentValue(strategy.profitTarget)} />
                  <StrategyField label="P&L" value={formatCurrencyValue(strategy.pnl)} />
                  <StrategyField label="Win Rate" value={formatPercentValue(strategy.winRate)} />
                  <StrategyField label="Total Trades" value={formatCountValue(strategy.totalTrades)} />
                  <StrategyField label="Open Positions" value={formatCountValue(strategy.openPositions)} />
                  <StrategyField label="Created" value={formatDateTimeValue(strategy.createdAt)} />
                  <StrategyField label="Updated" value={formatDateTimeValue(strategy.updatedAt)} />
                  <StrategyField label="Last Execution" value={formatDateTimeValue(strategy.lastExecution)} />
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AnalyticsView({ onNavigate }) {
  const [analytics, setAnalytics] = useState(null);
  const [backtests, setBacktests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async (signal) => {
    setLoading(true);
    setError('');

    try {
      const [analyticsResponse, backtestsResponse] = await Promise.all([
        fetchQuantAnalytics({ signal }),
        fetchAlgoBacktests({ signal }),
      ]);

      if (signal?.aborted) return;

      if (!analyticsResponse?.ok) {
        setAnalytics(null);
        setBacktests([]);
        setError(getApiErrorMessage(analyticsResponse, 'Unable to load analytics.'));
        return;
      }

      if (!analyticsResponse.data || typeof analyticsResponse.data !== 'object') {
        setAnalytics(null);
        setBacktests([]);
        setError('Malformed analytics response received from the server.');
        return;
      }

      setAnalytics(analyticsResponse.data);

      if (backtestsResponse?.ok) {
        setBacktests(asArray(backtestsResponse.data?.runs));
      } else {
        setBacktests(asArray(analyticsResponse.data?.recentBacktests));
        if (!error) {
          setError(getApiErrorMessage(backtestsResponse, 'Unable to load recent backtests.'));
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setAnalytics(null);
      setBacktests([]);
      setError(err?.message || 'Unable to load analytics.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [error]);

  useEffect(() => {
    const controller = new AbortController();
    loadAnalytics(controller.signal);
    return () => controller.abort();
  }, [loadAnalytics]);

  const summary = analytics?.summary || {};
  const trades = asArray(analytics?.trades);
  const openPositions = asArray(analytics?.openPositions);
  const recentBacktests = backtests.length > 0 ? backtests : asArray(analytics?.recentBacktests);
  const hasTradeData = summary?.hasTradingActivity || trades.length > 0 || openPositions.length > 0;
  const hasBacktests = recentBacktests.length > 0;

  const summaryCards = [
    { label: 'Total P&L', value: formatCurrencyValue(summary.totalPnl) },
    { label: "Today's P&L", value: formatCurrencyValue(summary.todayPnl) },
    { label: 'Realized P&L', value: formatCurrencyValue(summary.realizedPnl) },
    { label: 'Unrealized P&L', value: formatCurrencyValue(summary.unrealizedPnl) },
    { label: 'Total Trades', value: formatCountValue(summary.totalTrades) },
    { label: 'Winning Trades', value: formatCountValue(summary.winningTrades) },
    { label: 'Losing Trades', value: formatCountValue(summary.losingTrades) },
    { label: 'Win Rate', value: formatPercentValue(summary.winRate) },
    { label: 'Average Profit', value: formatCurrencyValue(summary.averageProfit) },
    { label: 'Average Loss', value: formatCurrencyValue(summary.averageLoss) },
    { label: 'Profit Factor', value: summary.profitFactor == null ? 'N/A' : Number(summary.profitFactor).toFixed(2) },
    { label: 'Max Drawdown', value: formatCurrencyValue(summary.maxDrawdown) },
  ];

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">STORED PERFORMANCE</span>
          <h1>P&amp;L Analytics</h1>
          <p>Analytics uses stored Quant records only. Loading this page does not place, modify, or cancel any live broker order.</p>
        </div>
        <div className="quant-page-action">
          <button className="quant-button quant-button-secondary quant-button-small" onClick={() => loadAnalytics()}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      </section>

      {loading ? (
        <div className="quant-panel" style={{ padding: '28px' }}>
          <EmptyData title="Loading Analytics..." description="Collecting stored trades, open positions, and backtest metrics..." action={false} />
        </div>
      ) : error && !analytics ? (
        <div className="quant-panel" style={{ padding: '28px' }}>
          <EmptyData title="Unable to load analytics" description={error} action={true} actionLabel="Retry" onConnect={() => loadAnalytics()} />
        </div>
      ) : !analytics ? (
        <div className="quant-panel" style={{ padding: '28px' }}>
          <EmptyData title="No analytics data available" description="No analytics payload was returned from the backend." action={true} actionLabel="Retry" onConnect={() => loadAnalytics()} />
        </div>
      ) : !hasTradeData && !hasBacktests ? (
        <div className="quant-panel" style={{ padding: '28px' }}>
          <EmptyData
            title="No analytics data available"
            description="No trading activity yet"
            action={true}
            actionLabel="Open Backtest"
            onConnect={() => onNavigate('backtest')}
          />
        </div>
      ) : (
        <>
          {error && (
            <div className="quant-connection-alert error" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {!hasTradeData && (
            <div className="quant-connection-alert" style={{ marginBottom: '16px' }}>
              No trading activity yet
            </div>
          )}

          <div className="quant-metric-grid" style={{ marginBottom: '18px' }}>
            {summaryCards.map((card) => (
              <div className="quant-metric-card" key={card.label}>
                <div className="quant-metric-top">
                  <span>{card.label}</span>
                  <TrendingUp size={16} />
                </div>
                <strong>{card.value}</strong>
                <small>
                  {card.label === 'Total P&L'
                    ? `Last execution: ${formatDateTimeValue(summary.lastExecution)}`
                    : 'Derived from stored backend records'}
                </small>
              </div>
            ))}
          </div>

          <div className="quant-panel quant-table-panel" style={{ marginBottom: '18px' }}>
            <PanelHeader eyebrow="LIVE ANALYTICS" title="Current Open Positions" icon={BriefcaseBusiness} />
            {openPositions.length === 0 ? (
              <EmptyData title="No analytics data available" description="No open positions are currently stored for analytics." action={false} compact={true} />
            ) : (
              <div className="quant-table-wrap">
                <table className="quant-table">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Side</th>
                      <th>Qty</th>
                      <th>Entry Price</th>
                      <th>Current Price</th>
                      <th>Unrealized P&amp;L</th>
                      <th>Opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openPositions.map((position) => (
                      <tr key={position.id}>
                        <td><strong>{position.instrument || 'N/A'}</strong></td>
                        <td>{position.side || 'N/A'}</td>
                        <td>{formatCountValue(position.quantity)}</td>
                        <td>{formatCurrencyValue(position.entryPrice)}</td>
                        <td>{formatCurrencyValue(position.currentPrice)}</td>
                        <td style={{ color: Number(position.pnl) >= 0 ? '#159975' : '#c53030', fontWeight: 700 }}>
                          {formatCurrencyValue(position.pnl)}
                        </td>
                        <td>{formatDateTimeValue(position.openedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="quant-panel quant-table-panel" style={{ marginBottom: '18px' }}>
            <PanelHeader eyebrow="TRADE HISTORY" title="Recent Stored Trades" icon={ListFilter} />
            {trades.length === 0 ? (
              <EmptyData title="No analytics data available" description="No trade history is available in stored analytics records." action={false} compact={true} />
            ) : (
              <div className="quant-table-wrap">
                <table className="quant-table">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Side</th>
                      <th>Qty</th>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>P&amp;L</th>
                      <th>Status</th>
                      <th>Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.slice(0, 20).map((trade) => (
                      <tr key={trade.id}>
                        <td><strong>{trade.instrument || 'N/A'}</strong></td>
                        <td>{trade.side || 'N/A'}</td>
                        <td>{formatCountValue(trade.quantity)}</td>
                        <td>{formatCurrencyValue(trade.entryPrice)}</td>
                        <td>{formatCurrencyValue(trade.exitPrice)}</td>
                        <td style={{ color: Number(trade.pnl) >= 0 ? '#159975' : '#c53030', fontWeight: 700 }}>
                          {formatCurrencyValue(trade.pnl)}
                        </td>
                        <td>{trade.status || 'N/A'}</td>
                        <td>{formatDateTimeValue(trade.closedAt || trade.openedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="quant-panel quant-table-panel">
            <PanelHeader eyebrow="BACKTEST ARCHIVE" title="Recent Backtest Results" icon={BarChart3} />
            {recentBacktests.length === 0 ? (
              <EmptyData title="No analytics data available" description="No stored backtest runs are available for this account." action={false} compact={true} />
            ) : (
              <div className="quant-table-wrap">
                <table className="quant-table">
                  <thead>
                    <tr>
                      <th>Strategy</th>
                      <th>Instrument</th>
                      <th>Timeframe</th>
                      <th>Total Trades</th>
                      <th>Win Rate</th>
                      <th>Net P&amp;L</th>
                      <th>Max Drawdown</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBacktests.map((run) => (
                      <tr key={run.id}>
                        <td><strong>{run.strategySlug || 'N/A'}</strong></td>
                        <td>{run.instrument || 'N/A'}</td>
                        <td>{run.timeframe || 'N/A'}</td>
                        <td>{formatCountValue(run.metrics?.totalTrades)}</td>
                        <td>{formatPercentValue(run.metrics?.winRate ?? run.metrics?.winRatePct)}</td>
                        <td>{formatCurrencyValue(run.metrics?.netPnl)}</td>
                        <td>{formatCurrencyValue(run.metrics?.maxDrawdown)}</td>
                        <td>{formatDateTimeValue(run.createdAt)}</td>
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
  );
}
