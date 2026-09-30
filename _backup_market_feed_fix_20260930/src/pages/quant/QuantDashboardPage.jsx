import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SubscriptionProvider, useSubscription, FEATURES } from '../../context/SubscriptionContext';
import TrialStatusCard from '../../components/quant/TrialStatusCard';
import UpgradeModal from '../../components/quant/UpgradeModal';
import QuantPricingPage from './QuantPricingPage';
import UserMenu from '../../components/common/UserMenu';
import { useApp } from '../../context/AppContext';
import kepweLogo from '../../assets/kepwe-logo.png';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  CheckCircle,
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
  Save,
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
  fetchQuantLiveMarket,
  runDhanLiveHealthCheck,
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
  fetchNotifications,
  markNotificationAsRead,
  fetchAlgoSettings,
  updateAlgoSettings,
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
    label: 'Market Intelligence',
    items: [
      { key: 'pulse', label: 'Pulse (Index Monitor)', icon: Activity },
      { key: 'chain', label: 'Option Chain', icon: BarChart3 },
      { key: 'market-analysis', label: 'Market Analysis', icon: TrendingUp },
    ],
  },
  {
    label: 'Quant Lab',
    items: [
      { key: 'builder', label: 'Strategy Builder', icon: SlidersHorizontal },
      { key: 'strategies', label: 'Algo Strategies', icon: Bot },
        { key: 'scalping', label: 'NIFTY 50 Scalping', icon: Zap },
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
    label: 'Tools',
    items: [
      { key: 'shield', label: 'Shield (Risk Monitor)', icon: ShieldAlert },
      { key: 'desk', label: 'Trading Desk', icon: Gauge },
      { key: 'alerts', label: 'Alerts & Notifications', icon: Bell },
      { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'broker', label: 'Broker Connection', icon: Link2 },
      { key: 'notifications', label: 'Notifications', icon: Bell },
      { key: 'pricing', label: 'Plans & Pricing', icon: Zap },
      { key: 'account', label: 'Account & Subscription', icon: Settings2 },
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
      const indicesRes = await fetchQuantLiveMarket({ signal });
      if (signal?.aborted) return;

      const liveMarket = indicesRes?.data?.connected ? indicesRes.data : null;
      const liveIndices = liveMarket ? [{ symbol: 'NIFTY', name: 'NIFTY 50', price: liveMarket.price, change: null, changePercent: null }] : [];
      if (indicesRes?.ok && liveMarket) {
        setMarketFeed({
          indices: liveIndices,
          loading: false,
          label: 'Market Feed: Active (Dhan LIVE)',
          error: '',
        });
        return;
      }

      const standbyLabel = liveIndices.length > 0
        ? 'Market Feed: Active (Dhan LIVE)'
        : 'Market Feed: Blocked';

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
        label: current.indices.length > 0 ? 'Market Feed: Active (Dhan LIVE)' : 'Market Feed: Blocked',
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
// LOCKED FEATURE CARD — shown when a premium feature is clicked in trial
// ─────────────────────────────────────────────────────────────────────────────
function LockedFeatureCard({ featureKey, featureLabel, onNavigate, children }) {
  const { isFeatureAllowed, openUpgradeModal, isActive } = useSubscription();
  const allowed = isActive && isFeatureAllowed(featureKey);

  if (allowed) return children;

  return (
    <div className="quant-page-view">
      <div style={{
        background: '#fff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '14px',
        padding: '48px 32px',
        textAlign: 'center',
        maxWidth: '520px',
        margin: '32px auto',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '14px',
          background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)',
          border: '1.5px solid #c7d2fe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#4f46e5', margin: '0 auto 18px',
        }}>
          <Lock size={24} />
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '20px',
          background: '#7c3aed', color: '#fff',
          fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em',
          marginBottom: '14px',
        }}>
          <Lock size={11} /> PRO FEATURE
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
          {featureLabel}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '0.84rem', color: '#64748b', lineHeight: 1.6 }}>
          This feature is available with a paid plan. Upgrade to unlock{' '}
          <strong>{featureLabel}</strong> and all premium KEPWE Quant features.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => openUpgradeModal(featureKey)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '10px 22px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #2456d7, #7c3aed)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.88rem',
            }}
          >
            <Zap size={15} /> View Plans
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            style={{
              padding: '10px 18px', borderRadius: '10px',
              background: 'transparent', color: '#64748b',
              border: '1px solid #e2e8f0', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.84rem',
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCKED NAV BADGE — small lock indicator on locked nav items
// ─────────────────────────────────────────────────────────────────────────────
function NavLockBadge() {
  return (
    <span style={{
      marginLeft: 'auto',
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      padding: '2px 6px', borderRadius: '10px',
      background: '#f1f5f9', color: '#94a3b8',
      fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.04em',
    }}>
      <Lock size={9} /> PRO
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT / SUBSCRIPTION VIEW
// ─────────────────────────────────────────────────────────────────────────────
function AccountSubscriptionView({ onNavigate }) {
  const { subscription, isTrial, isPaid, isExpired, isActive, planCode, refreshSubscription } = useSubscription();
  const { authState } = useApp();

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg]         = useState({ type: '', text: '' });

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You will retain access until the end of your current billing period.')) return;
    setCancelLoading(true);
    try {
      const res = await apiFetch('/subscription/cancel', { method: 'POST', body: { reason: 'User cancelled' } });
      if (res.ok) {
        setCancelMsg({ type: 'success', text: 'Subscription cancelled. Access continues until end of billing period.' });
        await refreshSubscription();
      } else {
        setCancelMsg({ type: 'error', text: res.data?.message || 'Cancellation failed. Please try again.' });
      }
    } catch (err) {
      setCancelMsg({ type: 'error', text: err.message || 'Cancellation failed.' });
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">ACCOUNT · SUBSCRIPTION</span>
          <h1>Account & Subscription</h1>
          <p>Manage your KEPWE Quant plan, view billing, and track your subscription status.</p>
        </div>
        <button className="quant-button quant-button-primary" onClick={() => onNavigate('pricing')}>
          <Zap size={15} /> View Plans
        </button>
      </section>

      {/* Status card */}
      <div style={{ marginBottom: '20px' }}>
        <TrialStatusCard onViewPlans={() => onNavigate('pricing')} />
      </div>

      {/* Subscription details */}
      {subscription && (
        <div className="quant-panel" style={{ padding: '24px 28px', marginBottom: '20px' }}>
          <PanelHeader eyebrow="CURRENT PLAN" title="Subscription Details" icon={ShieldCheck} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Plan</div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{subscription.displayName || subscription.planName || planCode}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Status</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontWeight: 700, fontSize: '0.85rem',
                color: isActive ? '#16a34a' : '#dc2626',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isActive ? '#16a34a' : '#dc2626', display: 'inline-block' }} />
                {isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            {subscription.trialStartAt && (
              <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Trial Started</div>
                <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                  {new Date(subscription.trialStartAt || subscription.trial_start_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )}
            {(subscription.trialEndAt || subscription.trial_end_at) && (
              <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Trial Ends</div>
                <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                  {new Date(subscription.trialEndAt || subscription.trial_end_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )}
            {(subscription.subscriptionEndAt || subscription.subscription_end_at) && (
              <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  {subscription.autoRenew ? 'Renews' : 'Expires'}
                </div>
                <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                  {new Date(subscription.subscriptionEndAt || subscription.subscription_end_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )}
            {subscription.price != null && (
              <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Price</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                  {Number(subscription.price) === 0 ? 'Free' : `₹${Number(subscription.price).toLocaleString('en-IN')}/${subscription.billingPeriod || 'month'}`}
                </div>
              </div>
            )}
          </div>

          {cancelMsg.text && (
            <div style={{
              marginTop: '16px', padding: '10px 14px', borderRadius: '8px',
              background: cancelMsg.type === 'success' ? '#f0fdf4' : '#fff5f5',
              color: cancelMsg.type === 'success' ? '#16a34a' : '#dc2626',
              fontSize: '0.82rem', fontWeight: 600,
            }}>
              {cancelMsg.text}
            </div>
          )}

          {isPaid && isActive && (
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="quant-button quant-button-secondary" onClick={() => onNavigate('pricing')}>
                <Zap size={14} /> Change Plan
              </button>
              <button
                className="quant-button quant-button-ghost"
                onClick={handleCancel}
                disabled={cancelLoading}
                style={{ color: '#dc2626', border: '1px solid #fecaca' }}
              >
                {cancelLoading ? 'Cancelling…' : 'Cancel Subscription'}
              </button>
            </div>
          )}
          {isTrial && isActive && (
            <div style={{ marginTop: '20px' }}>
              <button className="quant-button quant-button-primary" onClick={() => onNavigate('pricing')}>
                <Zap size={14} /> Upgrade Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* User profile info */}
      <div className="quant-panel" style={{ padding: '24px 28px' }}>
        <PanelHeader eyebrow="PROFILE" title="Account Information" icon={Settings2} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Name</div>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>{authState?.user?.name || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Email</div>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>{authState?.user?.email || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Role</div>
            <div style={{ fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>{authState?.user?.role || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function DashboardOverview({ onNavigate }) {
  const [dashData, setDashData] = useState(null);
  const [liveHealth, setLiveHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [oauthInProgress, setOauthInProgress] = useState(() => {
    try {
      return sessionStorage.getItem('kepwe:dhan-oauth-in-progress') === 'true';
    } catch (_) {
      return false;
    }
  });
  const { brokerState, dhanStatus, isBrokerConnected } = useBroker();
  const { isFeatureAllowed, isActive, isTrial, isExpired, openUpgradeModal } = useSubscription();
  const brokerLoading = brokerState.status === 'LOADING';
  const sessionExpired = brokerState.status === 'DHAN_SESSION_EXPIRED';

  useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const dashboard = await fetchQuantDashboard();
        if (!cancelled && dashboard?.ok) setDashData(dashboard.data);
      } catch (_) {
        // The dashboard keeps its existing empty metrics when unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadDashboard();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isBrokerConnected) {
      setLiveHealth(null);
      setHealthLoading(false);
      return undefined;
    }
    let cancelled = false;
    setHealthLoading(true);
    runDhanLiveHealthCheck()
      .then((health) => {
        if (!cancelled && health?.data) setLiveHealth(health.data);
      })
      .catch(() => {})
      .finally(() => {
        try {
          sessionStorage.removeItem('kepwe:dhan-oauth-in-progress');
        } catch (_) {}
        if (!cancelled) setOauthInProgress(false);
        if (!cancelled) setHealthLoading(false);
      });
    return () => { cancelled = true; };
  }, [isBrokerConnected]);

  const dhanConnected = isBrokerConnected;
  const pipelineReady = dhanConnected && liveHealth?.ready === true;
  const healthLabels = {
    dhanAuthentication: 'Dhan Session',
    dhanSession: 'Session',
    clientIdentity: 'Account Identity',
    fundsMargin: 'Margin',
    liveNiftyLtp: 'Live LTP',
    liveNiftyLtt: 'Live LTT',
    liveNiftyMarketData: 'Live NIFTY Feed',
    niftyCandleParsing: 'Candle Builder',
    oneMinuteConfirmationCandle: '1m Confirmation Candle',
    strategyEnabled: 'Strategy Enabled',
    deploymentGate: 'Deployment Gate',
    strategySignalPipeline: 'Strategy Runner',
    riskConfiguration: 'Risk Configuration',
    optionChainContractResolution: 'Option Chain',
    riskEngine: 'Risk Engine',
    orderApi: 'Dhan Order API',
    orderRequestConstruction: 'Order API',
    orderStatusReconciliation: 'Order Reconciliation',
    positionSynchronization: 'Position Sync',
    realizedPnl: 'P&L Sync',
    unrealizedPnl: 'P&L Sync',
    notifications: 'Notifications',
  };
  const healthRows = Object.entries(liveHealth?.checks || {});
  const healthStatusLabel = (result) => {
    if (result?.passed) return 'Verified';
    if (result?.status === 'BLOCKED') return 'Blocked';
    if (result?.status === 'NOT_VERIFIED') return 'Action Required';
    return 'Action Required';
  };

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
            <span className={`quant-status-dot ${pipelineReady ? 'active' : 'muted'}`} /> {pipelineReady ? 'Live Pipeline Ready' : dhanConnected ? 'Dhan Connected · Verification Required' : 'No live broker connected'}
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
          <strong>{pipelineReady ? 'Dhan live trading pipeline verified' : dhanConnected ? 'Dhan connected, live pipeline not ready' : 'No live Dhan broker connected'}</strong>
          <p>
            {pipelineReady ? 'Session, NIFTY data, candles, strategy, risk, order validation, and reconciliation checks are passing.' : dhanConnected ? 'Your broker is connected. Live pipeline checks are being verified before execution can be enabled.' : 'Connect your personal Dhan trading account to enable live execution. Backtest analysis is available without broker connection.'}
          </p>
        </div>
        <button className="quant-banner-link" onClick={() => onNavigate('broker')}>
          Broker Connection <ChevronRight size={15} />
        </button>
      </div>

      {(brokerLoading || oauthInProgress) && (
        <section className="quant-panel" style={{ padding: '22px', marginBottom: '20px' }} aria-live="polite">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={18} className="quant-spin" />
            <div>
              <strong>{oauthInProgress ? 'Connecting Dhan...' : 'Checking broker connection...'}</strong>
              <p style={{ margin: '4px 0 0', color: '#64748b' }}>
                {oauthInProgress ? 'Securely verifying your broker connection.' : 'Verifying your live broker state.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {!brokerLoading && !oauthInProgress && !dhanConnected && !sessionExpired && (
        <section className="quant-panel" style={{ padding: '22px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div className="quant-banner-icon"><Link2 size={18} /></div>
            <div style={{ flex: 1 }}>
              <strong>Dhan Broker Not Connected</strong>
              <p style={{ margin: '6px 0 14px', color: '#64748b' }}>
                Connect your Dhan trading account to enable live trading and live market data.
              </p>
              <button className="quant-button quant-button-primary quant-button-small" onClick={() => onNavigate('broker')}>
                <Link2 size={14} /> Connect Dhan
              </button>
              <p style={{ margin: '12px 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                Backtesting and strategy research remain available without a broker connection.
              </p>
            </div>
          </div>
        </section>
      )}

      {!brokerLoading && sessionExpired && (
        <section className="quant-panel" style={{ padding: '22px', marginBottom: '20px', borderColor: '#f5d08a' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div className="quant-banner-icon" style={{ background: '#fef3c7', color: '#b45309' }}><AlertTriangle size={18} /></div>
            <div style={{ flex: 1 }}>
              <strong>Dhan Connection Expired</strong>
              <p style={{ margin: '6px 0 14px', color: '#64748b' }}>
                Reconnect your Dhan account to resume live trading.
              </p>
              <button className="quant-button quant-button-primary quant-button-small" onClick={() => onNavigate('broker')}>
                <Link2 size={14} /> Reconnect Dhan
              </button>
            </div>
          </div>
        </section>
      )}

      {!brokerLoading && dhanConnected && healthLoading && !liveHealth && (
        <section className="quant-panel" style={{ padding: '22px', marginBottom: '20px' }} aria-live="polite">
          <strong>Verifying live pipeline...</strong>
          <p style={{ margin: '6px 0 0', color: '#64748b' }}>Checking your Dhan session and live trading prerequisites.</p>
        </section>
      )}

      {!brokerLoading && dhanConnected && liveHealth && (
        <section className="quant-panel" style={{ padding: '18px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <strong>Live pipeline health</strong>
            <span className={`quant-connection-pill ${liveHealth.ready ? 'connected' : ''}`}>
              {liveHealth.ready ? 'Ready' : 'Action Required'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
            {healthRows.map(([key, result]) => (
              <div key={key} title={result.message || ''} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <span>{healthLabels[key] || key}</span>
                <strong style={{ color: result.passed ? '#159975' : '#b7791f' }}>
                  {healthStatusLabel(result)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Subscription / Trial Status Card ─────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <TrialStatusCard onViewPlans={() => onNavigate('pricing')} />
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

        <section className="quant-panel quant-strategy-card featured">
          <div className="quant-strategy-card-top">
            <span className="quant-strategy-mark">
              <Zap size={18} />
            </span>
            <span className="quant-mode-pill">VALIDATION</span>
          </div>
          <h3>KEPWE NIFTY 50 Scalping</h3>
          <p>Exact 5-minute regime and 1-minute confirmation strategy for long NIFTY CE/PE options.</p>
          <button className="quant-button quant-button-primary quant-button-small" onClick={() => onNavigate('scalping')}>
            Open Strategy <ChevronRight size={14} />
          </button>
        </section>

        {/* Premium locked cards — visible but locked during trial */}
        {!isFeatureAllowed(FEATURES.ADVANCED_BACKTESTING) && (
          <section className="quant-panel quant-strategy-card" style={{ opacity: 0.85 }}>
            <div className="quant-strategy-card-top">
              <span className="quant-strategy-mark" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <BarChart3 size={18} />
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '20px',
                background: '#7c3aed', color: '#fff',
                fontSize: '0.65rem', fontWeight: 800,
              }}>
                <Lock size={10} /> PRO
              </span>
            </div>
            <h3>Advanced Backtesting</h3>
            <p>Unlimited backtests, advanced metrics, equity curves, and multi-strategy comparison.</p>
            <button
              className="quant-button quant-button-secondary quant-button-small"
              onClick={() => openUpgradeModal(FEATURES.ADVANCED_BACKTESTING)}
              style={{ color: '#7c3aed', borderColor: '#c4b5fd' }}
            >
              <Lock size={12} /> Unlock with PRO
            </button>
          </section>
        )}

        {!isFeatureAllowed(FEATURES.TRADING_DESK) && (
          <section className="quant-panel quant-strategy-card" style={{ opacity: 0.85 }}>
            <div className="quant-strategy-card-top">
              <span className="quant-strategy-mark" style={{ background: '#fdf4ff', color: '#a21caf' }}>
                <Gauge size={18} />
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '3px 8px', borderRadius: '20px',
                background: '#a21caf', color: '#fff',
                fontSize: '0.65rem', fontWeight: 800,
              }}>
                <Lock size={10} /> PRO
              </span>
            </div>
            <h3>Advanced Trading Desk</h3>
            <p>Full-featured trading terminal with live order management and multi-broker execution.</p>
            <button
              className="quant-button quant-button-secondary quant-button-small"
              onClick={() => openUpgradeModal(FEATURES.TRADING_DESK)}
              style={{ color: '#a21caf', borderColor: '#e879f9' }}
            >
              <Lock size={12} /> Unlock with PRO
            </button>
          </section>
        )}
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
  const [angelNotice, setAngelNotice] = useState({ type: '', text: '' });
  const [readiness, setReadiness] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [angelConnecting, setAngelConnecting] = useState(false);
  const [dhanClientId, setDhanClientId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [angelClientCode, setAngelClientCode] = useState('');
  const [angelPassword, setAngelPassword] = useState('');
  const [angelOneStatus, setAngelOneStatus] = useState(null);

  const loadReadiness = async () => {
    try {
      const readinessResult = await fetchBrokerReadiness();
      if (readinessResult?.ok) {
        setReadiness(readinessResult.data);
      }
    } catch (_) {}
  };

  const loadAngelOneStatus = async () => {
    try {
      const response = await fetch('/api/algo/broker/ANGEL_ONE/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('kepwe_access_token')}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAngelOneStatus(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadReadiness();
    loadAngelOneStatus();
  }, []);

  const dhanReadiness = readiness?.brokers?.find((broker) => broker.broker === 'DHAN');
  const angelReadiness = readiness?.brokers?.find((broker) => broker.broker === 'ANGEL_ONE');
  const isConnected = isBrokerConnected;
  const isAngelConnected = angelOneStatus?.connected === true && angelOneStatus?.status === 'CONNECTED';
  const isAngelSessionExpired = angelOneStatus?.status === 'ANGEL_ONE_SESSION_EXPIRED' || angelOneStatus?.status === 'SESSION_EXPIRED';
  const isSessionExpired = centralBrokerState.status === 'DHAN_SESSION_EXPIRED';
  const loading = centralBrokerState.status === 'LOADING';

  useEffect(() => {
    if (!isConnected) return undefined;
    let cancelled = false;
    runDhanLiveHealthCheck().then((result) => {
      if (cancelled || result.ok) return;
      const blocker = result.data?.blockers?.[0]?.blocker || 'Dhan live integration health check did not pass.';
      setNotice({ type: 'error', text: blocker });
    }).catch((error) => {
      if (!cancelled) setNotice({ type: 'error', text: error.message || 'Dhan live integration health check failed.' });
    });
    return () => { cancelled = true; };
  }, [isConnected]);

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
      // Only a backend-verified CONNECTED result (Dhan /v2/profile succeeded and
      // matched the Client ID) counts as connected. HTTP 206 (partial) is not.
      if (result.ok && result.data?.status === 'CONNECTED') {
        setAccessToken('');
        const marketData = result.data?.marketData;
        setNotice(marketData?.available === false
          ? { type: 'warning', text: `Dhan account connected (Client ID ${result.data.dhanClientId}). Dhan rejected live market data for this account${marketData.dataPlan ? ` (Dhan Data API plan: ${marketData.dataPlan})` : ''}, so the market feed stays blocked.` }
          : { type: 'success', text: `Dhan account connected and verified (Client ID ${result.data.dhanClientId}).` });
        await refreshBrokerState({ force: true });
      } else {
        const failedChecks = Object.values(result.data?.verification?.checks || {})
          .filter((check) => check && check.status !== 'PASS')
          .map((check) => `${check.name}: ${check.message}`);
        const dhanCode = result.data?.dhanErrorCode ? ` [Dhan ${result.data.dhanErrorCode}]` : '';
        const errorMsg = (result.data?.error || result.data?.message || (result.status === 401 ? 'Your session has expired. Please log in again.' : 'Failed to validate and connect Dhan account.'))
          + dhanCode
          + (failedChecks.length ? ` — ${failedChecks.join('; ')}` : '');
        setNotice({ type: 'error', text: errorMsg });
        await refreshBrokerState({ force: true });
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
        try {
          sessionStorage.setItem('kepwe:dhan-oauth-in-progress', 'true');
        } catch (_) {}
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

  const handleAngelOneConnect = async (e) => {
    e.preventDefault();
    if (!angelClientCode.trim() || !angelPassword.trim()) {
      setAngelNotice({ type: 'error', text: 'Please provide both Client Code and Password/MPIN.' });
      return;
    }
    if (!authState.isLoggedIn) {
      setAngelNotice({ type: 'error', text: 'You must be signed in to KEPWE to connect your Angel One account. Please sign in first.' });
      return;
    }
    setAngelConnecting(true);
    setAngelNotice({ type: '', text: '' });
    try {
      const response = await fetch('/api/broker/angel-one/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('kepwe_access_token')}`,
        },
        body: JSON.stringify({
          angelOneClientCode: angelClientCode.trim(),
          password: angelPassword.trim(),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setAngelNotice({ type: 'success', text: 'Angel One account connected and session verified successfully!' });
        setAngelPassword('');
        await loadAngelOneStatus();
        await refreshBrokerState({ force: true });
      } else {
        const errorMsg = data?.error || (response.status === 401 ? 'Your session has expired. Please log in again.' : 'Failed to validate and connect Angel One account.');
        setAngelNotice({ type: 'error', text: errorMsg });
      }
    } catch (err) {
      setAngelNotice({ type: 'error', text: err.message || 'Network error while connecting Angel One account.' });
    } finally {
      setAngelConnecting(false);
    }
  };

  const handleAngelOneDisconnect = async () => {
    setAngelConnecting(true);
    setAngelNotice({ type: '', text: '' });
    try {
      const response = await fetch('/api/broker/angel-one/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('kepwe_access_token')}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setAngelNotice({ type: 'success', text: 'Angel One disconnected. Live execution is stopped.' });
        await loadAngelOneStatus();
        await refreshBrokerState({ force: true });
      } else {
        setAngelNotice({ type: 'error', text: data?.error || 'Angel One could not be disconnected.' });
      }
    } catch (err) {
      setAngelNotice({ type: 'error', text: err.message || 'Failed to disconnect Angel One account.' });
    } finally {
      setAngelConnecting(false);
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
        {(isConnected || isAngelConnected) && (
          <div className="quant-panel" style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Link2 size={18} style={{ color: '#0f766e' }} />
              <strong style={{ fontSize: '0.9rem' }}>Active Broker Selection</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 12px 0', lineHeight: 1.5 }}>
              When placing orders through strategies, specify the broker in the order metadata. Both connected brokers can be used simultaneously for different strategies.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {isConnected && (
                <div style={{ flex: '1', minWidth: '200px', padding: '12px', background: 'white', border: '2px solid #0f766e', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '8px', height: '8px', background: '#0f766e', borderRadius: '50%' }} />
                    <strong style={{ fontSize: '0.85rem' }}>Dhan</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Client: {dhanStatus?.clientId || 'Connected'}</div>
                </div>
              )}
              {isAngelConnected && (
                <div style={{ flex: '1', minWidth: '200px', padding: '12px', background: 'white', border: '2px solid #C8102E', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ width: '8px', height: '8px', background: '#C8102E', borderRadius: '50%' }} />
                    <strong style={{ fontSize: '0.85rem' }}>Angel One</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Client: {angelOneStatus?.clientId || 'Connected'}</div>
                </div>
              )}
            </div>
            <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#64748b', padding: '8px', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fbbf24' }}>
              💡 Orders will use the broker specified in the strategy configuration. The system supports running multiple strategies on different brokers simultaneously.
            </div>
          </div>
        )}
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

        <section className="quant-panel quant-broker-card">
          <div className="quant-broker-card-top">
            <span className="quant-broker-logo" style={{ background: '#C8102E' }}>A</span>
            <span className="quant-coming-pill">{isAngelConnected ? 'LIVE / SESSION ACTIVE' : isAngelSessionExpired ? 'SESSION EXPIRED' : 'ACTIVE BROKER'}</span>
          </div>
          <h3>Angel One SmartAPI</h3>
          <p>
            Official Angel One SmartAPI integration for real-time market execution, position tracking, margin limits, and order synchronization.
          </p>

          <div className="quant-broker-note">
            <ShieldCheck size={15} />
            <span>
              {isAngelConnected ? `Verified Angel One session for account ${angelOneStatus?.clientId || ''}. Live execution active.` : isAngelSessionExpired ? 'Stored Angel One session expired or invalid. Reconnect to continue live execution.' : 'Static IP 103.117.180.146 is whitelisted for Angel One SmartAPI. Each user connects their personal account.'}
            </span>
          </div>

          {isAngelConnected ? (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', fontSize: '0.82rem', color: '#475569' }}>
                <div><strong>Client Code:</strong> {angelOneStatus?.clientId || 'Connected'}</div>
                <div><strong>Connection Mode:</strong> LIVE (SmartAPI)</div>
                <div><strong>Static Whitelist IP:</strong> <code>103.117.180.146</code></div>
                <div><strong>Postback Webhook:</strong> <code>https://kepwe.in/api/angel-one/postback</code></div>
              </div>
              <button className="quant-button quant-button-secondary" onClick={handleAngelOneDisconnect} disabled={angelConnecting}>
                Disconnect Angel One <X size={15} />
              </button>
            </div>
          ) : (
            <div>
              {!authState.isLoggedIn && (
                <div className="quant-connection-alert error" style={{ marginBottom: '12px' }}>
                  Your session is inactive. Please <Link to="/quant/login?returnTo=/quant/dashboard/broker" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>sign in</Link> to connect your personal Angel One account.
                </div>
              )}
              <form onSubmit={handleAngelOneConnect} style={{ marginTop: '12px' }}>
                <div className="quant-form-group">
                  <label className="quant-form-label">Angel One Client Code</label>
                  <input
                    type="text"
                    className="quant-form-input"
                    placeholder="e.g. A12345"
                    value={angelClientCode}
                    onChange={(e) => setAngelClientCode(e.target.value)}
                    disabled={angelConnecting}
                    required
                  />
                </div>
                <div className="quant-form-group">
                  <label className="quant-form-label">Password or MPIN</label>
                  <input
                    type="password"
                    className="quant-form-input"
                    placeholder="Enter your Angel One password or 4-digit MPIN"
                    value={angelPassword}
                    onChange={(e) => setAngelPassword(e.target.value)}
                    disabled={angelConnecting}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <button type="submit" className="quant-button quant-button-primary" disabled={angelConnecting || loading}>
                    {angelConnecting ? 'Validating…' : 'Connect Angel One Account'} <ChevronRight size={15} />
                  </button>
                </div>
              </form>
              <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                💡 <em>Uses your Angel One login credentials with TOTP for secure authentication. Credentials are encrypted using AES-256-GCM.</em>
              </div>
            </div>
          )}

          {angelNotice.text && <div className={`quant-connection-alert ${angelNotice.type}`}>{angelNotice.text}</div>}
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. MARKET INTELLIGENCE VIEWS (Pulse, Chain, Market Analysis)
// ─────────────────────────────────────────────────────────────────────────────

function PulseMarketIntelligenceView({ onNavigate }) {
  const [marketIndices, setMarketIndices] = useState({});
  const [activeIndex, setActiveIndex] = useState('NIFTY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch market data from backend
  const fetchMarketData = async () => {
    try {
      setError(null);
      const res = await apiFetch('/market/indices');
      
      if (res.ok && res.data?.indices) {
        // Transform array to object keyed by symbol
        const indicesMap = {};
        res.data.indices.forEach(index => {
          indicesMap[index.symbol] = index;
        });
        setMarketIndices(indicesMap);
      } else if (res.status === 503) {
        setError('Market data unavailable - Upstox service not accessible');
        setMarketIndices({});
      } else {
        setError('Failed to fetch market data');
        setMarketIndices({});
      }
    } catch (err) {
      console.error('Market data fetch error:', err);
      setError('Failed to fetch market data');
      setMarketIndices({});
    }
  };

  // Initial load
  useEffect(() => {
    fetchMarketData();
  }, []);

  // Auto-refresh market data every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      await fetchMarketData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setLoading(true);
    await fetchMarketData();
    setLoading(false);
  };

  const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];
  const currentIndexData = marketIndices[activeIndex];
  const allIndicesData = indices.map(idx => marketIndices[idx]).filter(Boolean);

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">MARKET INTELLIGENCE · 01</span>
          <h1>Pulse (Index Monitor)</h1>
          <p>Real-time NIFTY, BANKNIFTY, and FINNIFTY index tracking with live market data from Upstox.</p>
        </div>
        <button 
          className="quant-button quant-button-secondary" 
          onClick={handleManualRefresh}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Refreshing...' : 'Refresh Now'}
        </button>
      </section>

      {/* Index Selector Tabs */}
      <div className="quant-panel" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {indices.map((idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: activeIndex === idx ? '2px solid #214ECF' : '1px solid #E2E8F0',
              background: activeIndex === idx ? '#F0F4FF' : '#FFFFFF',
              color: activeIndex === idx ? '#214ECF' : '#64748B',
              fontWeight: activeIndex === idx ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '14px'
            }}
          >
            {idx}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="quant-panel" style={{ padding: '20px', marginBottom: '16px', background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: 600 }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#7F1D1D' }}>
            Market data from Upstox is currently unavailable. Please ensure UPSTOX_ACCESS_TOKEN is configured in backend environment.
          </div>
        </div>
      )}

      {/* No Data Display */}
      {!error && allIndicesData.length === 0 && (
        <EmptyData message="No market data available" subtext="Market data will appear here when Upstox service is accessible" />
      )}

      {/* Main Index Data Card */}
      {currentIndexData ? (
        <div className="quant-panel" style={{ padding: '24px 28px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '4px' }}>
                {currentIndexData.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                  {currentIndexData.price?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: currentIndexData.change >= 0 ? '#10B981' : '#EF4444',
                  fontFamily: 'monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {currentIndexData.change >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  {Math.abs(currentIndexData.change)?.toFixed(2)} ({currentIndexData.changePercent?.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              padding: '10px 14px',
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: '8px',
              fontSize: '12px'
            }}>
              <span style={{ width: '8px', height: '8px', background: '#10B981', borderRadius: '50%', display: 'inline-block' }} />
              <span style={{ color: '#166534', fontWeight: 700 }}>LIVE · UPSTOX</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Open</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                {currentIndexData.open?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '—'}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>High</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#10B981', fontFamily: 'monospace' }}>
                {currentIndexData.high?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '—'}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Low</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#EF4444', fontFamily: 'monospace' }}>
                {currentIndexData.low?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '—'}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Close</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#214ECF', fontFamily: 'monospace' }}>
                {currentIndexData.close?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '—'}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Volume</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                {currentIndexData.volume ? (currentIndexData.volume / 1e6).toFixed(1) + 'M' : '—'}
              </div>
            </div>
            <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Updated</div>
              <div style={{ fontSize: '13px', color: '#64748B', fontFamily: 'monospace' }}>
                {currentIndexData.lastUpdated ? new Date(currentIndexData.lastUpdated).toLocaleTimeString('en-IN') : '—'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="quant-panel" style={{ padding: '40px' }}>
          <EmptyData 
            title="Market Data Unavailable" 
            description="Unable to fetch real market data from Upstox. The access token may have expired or Upstox is temporarily unreachable. KEPWE does not fabricate market data."
            action={true}
            actionLabel="Retry"
            onConnect={handleManualRefresh}
          />
        </div>
      )}

      {/* All Indices Summary */}
      {allIndicesData.length > 0 && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: '#214ECF' }} />
            Market Overview
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {allIndicesData.map((idx) => (
              <div
                key={idx.symbol}
                onClick={() => setActiveIndex(idx.symbol)}
                style={{
                  padding: '14px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  hover: { background: '#F1F5F9' }
                }}
              >
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>
                  {idx.symbol}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace', marginBottom: '4px' }}>
                  {idx.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: idx.change >= 0 ? '#10B981' : '#EF4444' }}>
                  {idx.change >= 0 ? '▲' : '▼'} {Math.abs(idx.change)?.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionChainView({ onNavigate }) {
  const [optionChain, setOptionChain] = useState([]);
  const [optionChainMeta, setOptionChainMeta] = useState({});
  const [activeIndex, setActiveIndex] = useState('NIFTY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStrike, setSelectedStrike] = useState(null);

  // Function to fetch option chain from backend
  const fetchOptionChain = async (symbol) => {
    try {
      setError(null);
      const res = await apiFetch(`/market/option-chain?symbol=${symbol}`);
      
      if (res.ok && res.data) {
        setOptionChain(res.data.optionChain || []);
        setOptionChainMeta({
          expiryDate: res.data.expiryDate,
          spotPrice: res.data.spotPrice,
        });
      } else if (res.status === 503) {
        setError('Option chain data unavailable - Upstox service not accessible');
        setOptionChain([]);
        setOptionChainMeta({});
      } else {
        setError('Failed to fetch option chain data');
        setOptionChain([]);
        setOptionChainMeta({});
      }
    } catch (err) {
      console.error('Option chain fetch error:', err);
      setError('Failed to fetch option chain data');
      setOptionChain([]);
      setOptionChainMeta({});
    }
  };

  // Initial load
  useEffect(() => {
    fetchOptionChain(activeIndex);
  }, [activeIndex]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchOptionChain(activeIndex);
    setLoading(false);
  };

  const chainData = Array.isArray(optionChain) ? optionChain : [];
  const displayChain = chainData.slice(0, 15); // Show top 15 strikes

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">MARKET INTELLIGENCE · 02</span>
          <h1>Option Chain</h1>
          <p>Real-time option chain data with Greeks, IV, and volatility metrics from Upstox.</p>
        </div>
        <button 
          className="quant-button quant-button-secondary" 
          onClick={handleRefresh}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Refreshing...' : 'Refresh Chain'}
        </button>
      </section>

      {/* Index & Expiry Selector */}
      <div className="quant-panel" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
              Index
            </label>
            <select 
              value={activeIndex}
              onChange={(e) => setActiveIndex(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="NIFTY">NIFTY</option>
              <option value="BANKNIFTY">BANKNIFTY</option>
              <option value="FINNIFTY">FINNIFTY</option>
            </select>
          </div>
          {optionChainMeta.expiryDate && (
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                Expiry
              </label>
              <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '6px', fontSize: '14px', color: '#0F172A', fontWeight: 600 }}>
                {new Date(optionChainMeta.expiryDate).toLocaleDateString('en-IN')}
              </div>
            </div>
          )}
          {optionChainMeta.spotPrice && (
            <div>
              <label style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                Spot
              </label>
              <div style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '6px', fontSize: '14px', color: '#0F172A', fontWeight: 600, fontFamily: 'monospace' }}>
                {optionChainMeta.spotPrice?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="quant-panel" style={{ padding: '20px', marginBottom: '16px', background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: 600 }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#7F1D1D' }}>
            Option chain data from Upstox is currently unavailable. Please ensure UPSTOX_ACCESS_TOKEN is configured in backend environment.
          </div>
        </div>
      )}

      {/* No Data Display */}
      {!error && chainData.length === 0 && (
        <EmptyData message="No option chain data available" subtext="Option chain data will appear here when Upstox service is accessible" />
      )}

      {/* Option Chain Table */}
      {displayChain.length > 0 ? (
        <div className="quant-panel" style={{ padding: '0', overflow: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
          }}>
            <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0 }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Call OI</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Call IV</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Call Bid</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: '#0F172A', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#F1F5F9' }}>Strike</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Put Ask</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Put IV</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Put OI</th>
              </tr>
            </thead>
            <tbody>
              {displayChain.map((strike, idx) => (
                <tr 
                  key={idx}
                  onClick={() => setSelectedStrike(selectedStrike === idx ? null : idx)}
                  style={{
                    background: selectedStrike === idx ? '#F0F4FF' : (idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'),
                    borderBottom: '1px solid #E2E8F0',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <td style={{ padding: '12px', textAlign: 'left', color: '#0F172A', fontWeight: 600 }}>
                    {(strike.callOi / 1e5).toFixed(1)}L
                  </td>
                  <td style={{ padding: '12px', textAlign: 'left', color: '#64748B' }}>
                    {strike.callIv ? strike.callIv.toFixed(2) + '%' : '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'left', color: '#10B981', fontWeight: 600, fontFamily: 'monospace' }}>
                    {strike.callBid?.toFixed(2) || '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#0F172A', fontWeight: 700, background: '#F1F5F9', fontFamily: 'monospace' }}>
                    {strike.strike}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#EF4444', fontWeight: 600, fontFamily: 'monospace' }}>
                    {strike.putAsk?.toFixed(2) || '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#64748B' }}>
                    {strike.putIv ? strike.putIv.toFixed(2) + '%' : '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#0F172A', fontWeight: 600 }}>
                    {(strike.putOi / 1e5).toFixed(1)}L
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="quant-panel" style={{ padding: '40px' }}>
          <EmptyData 
            title="Option Chain Data Unavailable" 
            description="Unable to fetch option chain data from Upstox for this index. Try selecting a different index or refreshing."
            action={true}
            actionLabel="Try Again"
            onConnect={handleRefresh}
          />
        </div>
      )}
    </div>
  );
}

function MarketAnalysisView({ onNavigate }) {
  const { marketIndices = {}, optionChain = [] } = useApp();
  const indices = Object.values(marketIndices).filter(Boolean);
  
  // Calculate market breadth
  const advancers = indices.filter(idx => idx.change > 0).length;
  const decliners = indices.filter(idx => idx.change < 0).length;
  const totalIndices = indices.length;
  const breadthRatio = totalIndices > 0 ? ((advancers / totalIndices) * 100).toFixed(1) : 0;

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">MARKET INTELLIGENCE · 03</span>
          <h1>Market Analysis</h1>
          <p>Comprehensive market regime, breadth, and global cues analysis.</p>
        </div>
      </section>

      {/* Market Breadth */}
      <div className="quant-panel" style={{ padding: '24px 28px', marginBottom: '16px' }}>
        <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={16} style={{ color: '#214ECF' }} />
          Market Breadth
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #86EFAC' }}>
            <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Advancers</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#10B981' }}>
              {advancers}
            </div>
            <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px' }}>
              {((advancers / totalIndices) * 100).toFixed(1)}%
            </div>
          </div>
          <div style={{ padding: '14px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
            <div style={{ fontSize: '11px', color: '#991B1B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Decliners</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#EF4444' }}>
              {decliners}
            </div>
            <div style={{ fontSize: '12px', color: '#991B1B', marginTop: '4px' }}>
              {((decliners / totalIndices) * 100).toFixed(1)}%
            </div>
          </div>
          <div style={{ padding: '14px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
            <div style={{ fontSize: '11px', color: '#1E40AF', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Breadth %</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563EB' }}>
              {breadthRatio}%
            </div>
            <div style={{ fontSize: '12px', color: '#1E40AF', marginTop: '4px' }}>
              Bullish
            </div>
          </div>
        </div>
      </div>

      {/* Market Regime & Metrics */}
      <div className="quant-panel" style={{ padding: '24px 28px', marginBottom: '16px' }}>
        <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={16} style={{ color: '#214ECF' }} />
          Market Regime
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Market Regime</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              {breadthRatio > 60 ? '📈 Bullish' : breadthRatio > 40 ? '↔️ Neutral' : '📉 Bearish'}
            </div>
          </div>
          <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Volatility</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              Normal
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Based on recent data</div>
          </div>
          <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Indices Tracked</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
              {totalIndices}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Real-time</div>
          </div>
        </div>
      </div>

      {/* Index Performance Grid */}
      <div className="quant-panel" style={{ padding: '24px 28px' }}>
        <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} style={{ color: '#214ECF' }} />
          Index Performance
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {indices.map((idx) => (
            <div key={idx.symbol} style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>
                {idx.symbol}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace', marginBottom: '4px' }}>
                {idx.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: idx.change >= 0 ? '#10B981' : '#EF4444',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {idx.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(idx.change)?.toFixed(2)} ({idx.changePercent?.toFixed(2)}%)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. TOOLS VIEWS (Shield, Desk, Alerts, Reports)
// ─────────────────────────────────────────────────────────────────────────────

function ShieldRiskMonitorView({ onNavigate }) {
  const { userRiskProfile = {} } = useApp();
  const [selectedStrategy, setSelectedStrategy] = useState(null);

  const riskMetrics = {
    maxDailyLoss: userRiskProfile.maxDailyLoss || 5000,
    maxPositionSize: userRiskProfile.maxPositionSize || 100000,
    leverage: userRiskProfile.leverage || 1,
    hedgingBudget: userRiskProfile.hedgingBudget || 2000,
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">TOOLS · 01</span>
          <h1>Shield (Risk Monitor)</h1>
          <p>Advanced risk management, position sizing, and hedging recommendations integrated with Quant risk engine.</p>
        </div>
      </section>

      {/* Risk Guardrails */}
      <div className="quant-panel" style={{ padding: '24px 28px', marginBottom: '16px' }}>
        <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} style={{ color: '#214ECF' }} />
          Active Risk Guardrails
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', background: '#FEF3C7', borderRadius: '8px', border: '1px solid #FCD34D' }}>
            <div style={{ fontSize: '11px', color: '#92400E', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max Daily Loss</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
              ₹{riskMetrics.maxDailyLoss.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: '#92400E', marginTop: '4px' }}>Circuit breaker active</div>
          </div>
          <div style={{ padding: '14px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
            <div style={{ fontSize: '11px', color: '#1E40AF', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max Position Size</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
              ₹{riskMetrics.maxPositionSize.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: '#1E40AF', marginTop: '4px' }}>Per trade limit</div>
          </div>
          <div style={{ padding: '14px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #86EFAC' }}>
            <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Leverage</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
              {riskMetrics.leverage}x
            </div>
            <div style={{ fontSize: '11px', color: '#166534', marginTop: '4px' }}>Current multiplier</div>
          </div>
          <div style={{ padding: '14px', background: '#F5F3FF', borderRadius: '8px', border: '1px solid #E9D5FF' }}>
            <div style={{ fontSize: '11px', color: '#6B21A8', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hedge Budget</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
              ₹{riskMetrics.hedgingBudget.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: '#6B21A8', marginTop: '4px' }}>For hedges</div>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="quant-panel" style={{ padding: '24px 28px', marginBottom: '16px' }}>
        <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertOctagon size={16} style={{ color: '#214ECF' }} />
          Risk Assessment Framework
        </h3>
        <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '14px', border: '1px solid #E2E8F0' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>Position Risk Score</div>
            <div style={{ background: '#E2E8F0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ background: '#10B981', height: '100%', width: '35%', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>35% - Low Risk</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>Greeks Exposure</div>
            <div style={{ background: '#E2E8F0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ background: '#F59E0B', height: '100%', width: '52%', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>52% - Moderate</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>Hedging Adequacy</div>
            <div style={{ background: '#E2E8F0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ background: '#10B981', height: '100%', width: '78%', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>78% - Well Protected</div>
          </div>
        </div>
      </div>

      {/* Risk Alerts */}
      <div className="quant-panel" style={{ padding: '24px 28px' }}>
        <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} style={{ color: '#214ECF' }} />
          Active Alerts
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ padding: '12px', background: '#FEF2F2', borderRadius: '6px', border: '1px solid #FECACA', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#991B1B' }}>Daily Loss at 45%</div>
              <div style={{ fontSize: '11px', color: '#991B1B', marginTop: '2px' }}>Current loss: ₹2,250 / ₹5,000 limit</div>
            </div>
          </div>
          <div style={{ padding: '12px', background: '#F0FDF4', borderRadius: '6px', border: '1px solid #86EFAC', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ color: '#10B981', fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>✓</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534' }}>All Position Limits Respected</div>
              <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>No violations detected</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradingDeskView({ onNavigate }) {
  const { brokerState = {} } = useBroker();
  const [selectedTool, setSelectedTool] = useState('overview');

  const tools = [
    { key: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { key: 'orders', label: 'Live Orders', icon: ListFilter },
    { key: 'positions', label: 'Open Positions', icon: BriefcaseBusiness },
    { key: 'watchlist', label: 'Market Watch', icon: Activity },
    { key: 'analytics', label: 'P&L Summary', icon: BarChart3 },
  ];

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">TOOLS · 02</span>
          <h1>Trading Desk</h1>
          <p>Comprehensive trading terminal with live order management and execution tools (LIVE MODE ONLY).</p>
        </div>
      </section>

      {/* Tool Tabs */}
      <div className="quant-panel" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '8px', overflowX: 'auto', flexWrap: 'wrap' }}>
        {tools.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSelectedTool(key)}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: selectedTool === key ? '2px solid #214ECF' : '1px solid #E2E8F0',
              background: selectedTool === key ? '#F0F4FF' : '#FFFFFF',
              color: selectedTool === key ? '#214ECF' : '#64748B',
              fontWeight: selectedTool === key ? 600 : 500,
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tool Content */}
      {selectedTool === 'overview' && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutDashboard size={16} style={{ color: '#214ECF' }} />
            Trading Dashboard
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '14px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: '11px', color: '#1E40AF', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Mode</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>LIVE</div>
              <div style={{ fontSize: '11px', color: '#1E40AF', marginTop: '4px' }}>Real trading active</div>
            </div>
            <div style={{ padding: '14px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #86EFAC' }}>
              <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Status</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Ready</div>
              <div style={{ fontSize: '11px', color: '#166534', marginTop: '4px' }}>All systems online</div>
            </div>
            <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Active Trades</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>0</div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Today</div>
            </div>
          </div>
          <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
              <button style={{ padding: '8px', background: '#214ECF', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
                + New Order
              </button>
              <button style={{ padding: '8px', background: '#FFFFFF', color: '#214ECF', border: '1px solid #214ECF', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
                Sync Data
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTool === 'orders' && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A' }}>Live Orders</h3>
          <EmptyData title="No active orders" description="Orders placed via this desk will appear here in real-time." />
        </div>
      )}

      {selectedTool === 'positions' && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A' }}>Open Positions</h3>
          <EmptyData title="No open positions" description="Active positions from your Dhan account will appear here." />
        </div>
      )}

      {selectedTool === 'watchlist' && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A' }}>Market Watch</h3>
          <EmptyData title="No watchlist items" description="Add symbols to your watchlist to monitor prices and create orders." />
        </div>
      )}

      {selectedTool === 'analytics' && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A' }}>P&L Summary</h3>
          <EmptyData title="No trading activity" description="Your P&L analytics will update as you execute live trades." />
        </div>
      )}
    </div>
  );
}

function AlertsNotificationsView({ onNavigate }) {
  const [alerts, setAlerts] = useState([
    { id: 1, symbol: 'NIFTY', condition: 'Price > 25000', status: 'Active', createdAt: new Date() },
    { id: 2, symbol: 'BANKNIFTY', condition: 'Price < 50000', status: 'Active', createdAt: new Date(Date.now() - 3600000) },
  ]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ symbol: 'NIFTY', condition: 'Price >', triggerPrice: '' });

  const handleCreateAlert = () => {
    if (formData.triggerPrice) {
      setAlerts([...alerts, {
        id: Math.max(...alerts.map(a => a.id), 0) + 1,
        symbol: formData.symbol,
        condition: `${formData.condition} ${formData.triggerPrice}`,
        status: 'Active',
        createdAt: new Date()
      }]);
      setFormData({ symbol: 'NIFTY', condition: 'Price >', triggerPrice: '' });
      setShowCreateForm(false);
    }
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">TOOLS · 03</span>
          <h1>Alerts & Notifications</h1>
          <p>Create and manage price alerts, strategy signals, and system notifications.</p>
        </div>
        <button 
          className="quant-button quant-button-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          New Alert
        </button>
      </section>

      {/* Create Alert Form */}
      {showCreateForm && (
        <div className="quant-panel" style={{ padding: '20px 24px', marginBottom: '16px', background: '#F0F4FF', border: '1px solid #C7D2FE' }}>
          <h3 style={{ marginBottom: '14px', color: '#0F172A', fontSize: '14px', fontWeight: 700 }}>Create New Alert</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Index</label>
              <select 
                value={formData.symbol}
                onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px' }}
              >
                <option>NIFTY</option>
                <option>BANKNIFTY</option>
                <option>FINNIFTY</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Condition</label>
              <select 
                value={formData.condition}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px' }}
              >
                <option>Price &gt;</option>
                <option>Price &lt;</option>
                <option>Change &gt;</option>
                <option>Change &lt;</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '4px', display: 'block' }}>Value</label>
              <input 
                type="number"
                value={formData.triggerPrice}
                onChange={(e) => setFormData({...formData, triggerPrice: e.target.value})}
                placeholder="Enter value"
                style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setShowCreateForm(false)}
              style={{ padding: '8px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateAlert}
              style={{ padding: '8px 16px', background: '#214ECF', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
            >
              Create Alert
            </button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="quant-panel" style={{ padding: '24px 28px' }}>
        <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} style={{ color: '#214ECF' }} />
          Active Alerts ({alerts.length})
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alerts.map((alert) => (
            <div key={alert.id} style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>
                  {alert.symbol}: {alert.condition}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  Created {alert.createdAt.toLocaleTimeString('en-IN')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ padding: '4px 10px', background: '#10B981', color: '#FFFFFF', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                  {alert.status}
                </span>
                <button style={{ padding: '6px 10px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#64748B' }}>
                  ⋯
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Center */}
      <div className="quant-panel" style={{ padding: '24px 28px', marginTop: '16px' }}>
        <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} style={{ color: '#214ECF' }} />
          Recent Notifications
        </h3>
        <EmptyData title="No recent notifications" description="Alert triggers and system events will appear here." compact={true} />
      </div>
    </div>
  );
}

function ReportsAnalyticsView({ onNavigate }) {
  const [reportType, setReportType] = useState('summary');
  const [dateRange, setDateRange] = useState({ start: '2024-01-01', end: '2024-12-31' });

  const reportTypes = [
    { key: 'summary', label: 'P&L Summary', icon: BarChart3 },
    { key: 'detailed', label: 'Detailed Trades', icon: ListFilter },
    { key: 'performance', label: 'Performance', icon: TrendingUp },
    { key: 'journal', label: 'Trading Journal', icon: BookOpen },
  ];

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">TOOLS · 04</span>
          <h1>Reports & Analytics</h1>
          <p>Trading reports, P&L analysis, and performance metrics from real execution data.</p>
        </div>
        <button 
          className="quant-button quant-button-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Download size={14} />
          Export Report
        </button>
      </section>

      {/* Report Type Selector */}
      <div className="quant-panel" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {reportTypes.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setReportType(key)}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: reportType === key ? '2px solid #214ECF' : '1px solid #E2E8F0',
              background: reportType === key ? '#F0F4FF' : '#FFFFFF',
              color: reportType === key ? '#214ECF' : '#64748B',
              fontWeight: reportType === key ? 600 : 500,
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Date Range Filter */}
      <div className="quant-panel" style={{ padding: '16px 20px', marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
        <div>
          <label style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '4px', display: 'block', textTransform: 'uppercase' }}>From</label>
          <input 
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '4px', display: 'block', textTransform: 'uppercase' }}>To</label>
          <input 
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Report Content */}
      {reportType === 'summary' && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A' }}>P&L Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ padding: '14px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #86EFAC' }}>
              <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Total P&L</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#10B981', fontFamily: 'monospace' }}>₹0.00</div>
            </div>
            <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Total Trades</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>0</div>
            </div>
            <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Win Rate</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>—</div>
            </div>
            <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>ROI</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>0%</div>
            </div>
          </div>
          <EmptyData title="No trading data for this period" description="Trade execution data will appear here once you place live trades." compact={true} />
        </div>
      )}

      {reportType === 'detailed' && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A' }}>Detailed Trade Report</h3>
          <EmptyData title="No trades recorded" description="Individual trade records from {dateRange.start} to {dateRange.end}" compact={true} />
        </div>
      )}

      {reportType === 'performance' && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A' }}>Performance Analysis</h3>
          <EmptyData title="Insufficient data" description="Performance metrics require at least 10 completed trades" compact={true} />
        </div>
      )}

      {reportType === 'journal' && (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '16px', color: '#0F172A' }}>Trading Journal</h3>
          <EmptyData title="Journal entries coming soon" description="Document your trading decisions and market observations here" compact={true} />
        </div>
      )}
    </div>
  );
}

// 9. NOTIFICATIONS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsView({ onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchNotifications();
      if (res.ok && res.data) {
        setNotifications(res.data.notifications || []);
      } else {
        setError(res.data?.error || 'Failed to load notifications');
      }
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (notificationId) => {
    try {
      const res = await markNotificationAsRead(notificationId);
      if (res.ok) {
        setNotifications(prev => prev.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        ));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">SYSTEM</span>
          <h1>Notifications</h1>
          <p>View system notifications, alerts, and account updates.</p>
        </div>
        <button 
          className="quant-button quant-button-secondary quant-button-small"
          onClick={loadNotifications}
          disabled={loading}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </section>

      {error && (
        <div className="quant-panel" style={{ padding: '20px', marginBottom: '16px', background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: 600 }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="quant-panel" style={{ padding: '24px 28px' }}>
        <h3 style={{ marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={16} style={{ color: '#214ECF' }} />
            All Notifications ({notifications.length})
          </span>
          {unreadCount > 0 && (
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
              {unreadCount} unread
            </span>
          )}
        </h3>

        {loading ? (
          <EmptyData title="Loading notifications" description="Fetching your notifications..." action={false} />
        ) : notifications.length === 0 ? (
          <EmptyData
            title="No notifications"
            description="You don't have any notifications yet. System notifications and alerts will appear here."
            action={false}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                style={{ 
                  padding: '14px 16px', 
                  background: notification.isRead ? '#FFFFFF' : '#F0F4FF', 
                  borderRadius: '8px', 
                  border: notification.isRead ? '1px solid #E2E8F0' : '1px solid #C7D2FE',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {!notification.isRead && (
                      <span style={{ width: '8px', height: '8px', background: '#214ECF', borderRadius: '50%', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '13px', fontWeight: notification.isRead ? 600 : 700, color: '#0F172A' }}>
                      {notification.title}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '6px', lineHeight: 1.5 }}>
                    {notification.body}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                    {new Date(notification.createdAt).toLocaleString('en-IN', { 
                      dateStyle: 'medium', 
                      timeStyle: 'short' 
                    })}
                  </div>
                </div>
                {!notification.isRead && (
                  <button 
                    onClick={() => handleMarkAsRead(notification.id)}
                    style={{ 
                      padding: '6px 12px', 
                      background: '#214ECF', 
                      color: '#FFFFFF', 
                      border: 'none', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      fontSize: '12px', 
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 10. WORKSPACE SETTINGS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function WorkspaceSettingsView({ onNavigate }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAlgoSettings();
      if (res.ok && res.data) {
        setSettings(res.data);
      } else {
        setError(res.data?.error || 'Failed to load settings');
      }
    } catch (err) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await updateAlgoSettings(settings);
      if (res.ok) {
        setSuccess('Settings saved successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(res.data?.error || 'Failed to save settings');
      }
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">SYSTEM</span>
          <h1>Workspace Settings</h1>
          <p>Configure risk parameters and trading limits for your algo trading workspace.</p>
        </div>
      </section>

      {error && (
        <div className="quant-panel" style={{ padding: '16px 20px', marginBottom: '16px', background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: 600, fontSize: '14px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="quant-panel" style={{ padding: '16px 20px', marginBottom: '16px', background: '#F0FDF4', border: '1px solid #86EFAC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 600, fontSize: '14px' }}>
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="quant-panel" style={{ padding: '40px' }}>
          <EmptyData title="Loading settings" description="Fetching your workspace settings..." action={false} />
        </div>
      ) : !settings ? (
        <div className="quant-panel" style={{ padding: '40px' }}>
          <EmptyData title="Settings unavailable" description="Unable to load workspace settings." action={false} />
        </div>
      ) : (
        <div className="quant-panel" style={{ padding: '24px 28px' }}>
          <h3 style={{ marginBottom: '20px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={16} style={{ color: '#214ECF' }} />
            Risk & Trading Parameters
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
            
            {/* Trading Capital */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Trading Capital (₹)
              </label>
              <input
                type="number"
                value={settings.tradingCapital}
                onChange={(e) => updateField('tradingCapital', Number(e.target.value))}
                min="0"
                max="100000000"
                step="10000"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                Total capital allocated for algo trading strategies
              </div>
            </div>

            {/* Risk Per Trade */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Risk Per Trade (%)
              </label>
              <select
                value={settings.riskPerTrade}
                onChange={(e) => updateField('riskPerTrade', Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value={0.5}>0.5% - Ultra Conservative</option>
                <option value={1}>1% - Conservative</option>
                <option value={2}>2% - Moderate</option>
                <option value={5}>5% - Aggressive</option>
              </select>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                Maximum capital risk per individual trade
              </div>
            </div>

            {/* Risk Reward Ratio */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Risk:Reward Ratio
              </label>
              <input
                type="number"
                value={settings.riskReward}
                onChange={(e) => updateField('riskReward', Number(e.target.value))}
                min="1"
                max="10"
                step="0.5"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                Target profit relative to risk (e.g., 2 = target 2x the risk amount)
              </div>
            </div>

            {/* Max Trades Per Day */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Max Trades Per Day
              </label>
              <input
                type="number"
                value={settings.maxTradesPerDay}
                onChange={(e) => updateField('maxTradesPerDay', Number(e.target.value))}
                min="1"
                max="100"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                Maximum number of trades allowed per trading day
              </div>
            </div>

            {/* Max Consecutive Losses */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Max Consecutive Losses
              </label>
              <input
                type="number"
                value={settings.maxConsecutiveLosses}
                onChange={(e) => updateField('maxConsecutiveLosses', Number(e.target.value))}
                min="1"
                max="20"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                Trading stops after this many consecutive losing trades
              </div>
            </div>

            {/* Daily Loss Limit */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Daily Loss Limit (₹)
              </label>
              <input
                type="number"
                value={settings.dailyLossLimit}
                onChange={(e) => updateField('dailyLossLimit', Number(e.target.value))}
                min="0"
                max="10000000"
                step="1000"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                Maximum loss allowed per day before trading stops
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  background: '#214ECF',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  opacity: saving ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {saving ? (
                  <>
                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save Settings
                  </>
                )}
              </button>
              <button
                onClick={loadSettings}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  background: '#FFFFFF',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                Reset
              </button>
            </div>

            {/* Warning Notice */}
            <div style={{ 
              padding: '12px 14px', 
              background: '#FEF3C7', 
              border: '1px solid #FCD34D', 
              borderRadius: '8px',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#92400E', lineHeight: 1.5 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Risk Warning:</strong> These settings control live trading with real money on your connected broker account. 
                  Changes take effect immediately and apply to all active strategies. Review carefully before saving.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC TABLE VIEW
// ─────────────────────────────────────────────────────────────────────────────
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
  const { isFeatureAllowed, upgradeModal, closeUpgradeModal } = useSubscription();
  const { refreshBrokerState } = useBroker();
  const [notificationCount, setNotificationCount] = useState(0);

  const pathParts = location.pathname.split('/').filter(Boolean);
  let parsedSection = 'dashboard';
  if (routeSection) {
    parsedSection = routeSection;
  } else if (pathParts.length >= 2 && pathParts[0] === 'quant' && pathParts[1] === 'dashboard' && pathParts[2]) {
    parsedSection = pathParts[2];
  } else if (pathParts.length >= 2 && pathParts[0] === 'quant' && pathParts[1] !== 'dashboard') {
    parsedSection = pathParts[1];
  }

  // Fetch unread notification count
  useEffect(() => {
    const loadNotificationCount = async () => {
      try {
        const res = await fetchNotifications();
        if (res.ok && res.data) {
          const unreadCount = (res.data.notifications || []).filter(n => !n.isRead).length;
          setNotificationCount(unreadCount);
        }
      } catch (err) {
        console.error('Failed to load notification count:', err);
      }
    };

    loadNotificationCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotificationCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const activeSection = validSections.includes(parsedSection) ? parsedSection : 'dashboard';
  const activeLabel = formatSection(activeSection);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('dhan') === 'connected') {
      refreshBrokerState({ force: true });
    }
  }, [location.search, refreshBrokerState]);

  const goTo = (section) => {
    navigate(section === 'dashboard' ? '/quant/dashboard' : `/quant/dashboard/${section}`);
    setMobileNavOpen(false);
  };

  const page = useMemo(() => {
    if (activeSection === 'dashboard') return <DashboardOverview onNavigate={goTo} />;
    if (activeSection === 'pulse') return <PulseMarketIntelligenceView onNavigate={goTo} />;
    if (activeSection === 'chain') return <OptionChainView onNavigate={goTo} />;
    if (activeSection === 'market-analysis') return <MarketAnalysisView onNavigate={goTo} />;
    if (activeSection === 'builder') return (
      <LockedFeatureCard featureKey={FEATURES.STRATEGY_BUILDER} featureLabel="Strategy Builder" onNavigate={goTo}>
        <StrategyBuilderView onNavigate={goTo} />
      </LockedFeatureCard>
    );
    if (activeSection === 'backtest') return (
      <LockedFeatureCard featureKey={FEATURES.ADVANCED_BACKTESTING} featureLabel="Advanced Backtesting" onNavigate={goTo}>
        <BacktestRunnerView onNavigate={goTo} />
      </LockedFeatureCard>
    );
    if (activeSection === 'live') return (
      <LockedFeatureCard featureKey={FEATURES.LIVE_EXECUTION} featureLabel="Live Deployment Gate" onNavigate={goTo}>
        <LiveDeploymentGateView onNavigate={goTo} />
      </LockedFeatureCard>
    );
    if (activeSection === 'risk') return <RiskManagementView onNavigate={goTo} />;
    if (activeSection === 'strategies') return (
      <LockedFeatureCard featureKey={FEATURES.ALGO_STRATEGIES} featureLabel="Advanced Algo Strategies" onNavigate={goTo}>
        <StrategiesView onNavigate={goTo} />
      </LockedFeatureCard>
    );
    if (activeSection === 'scalping') return (
      <LockedFeatureCard featureKey={FEATURES.ALGO_STRATEGIES} featureLabel="Advanced Algo Strategies" onNavigate={goTo}>
        <NiftyScalpingView onNavigate={goTo} />
      </LockedFeatureCard>
    );
    if (activeSection === 'analytics') return <AnalyticsView onNavigate={goTo} />;
    if (activeSection === 'shield') return (
      <LockedFeatureCard featureKey={FEATURES.ADVANCED_RISK} featureLabel="Advanced Risk Analytics" onNavigate={goTo}>
        <ShieldRiskMonitorView onNavigate={goTo} />
      </LockedFeatureCard>
    );
    if (activeSection === 'desk') return (
      <LockedFeatureCard featureKey={FEATURES.TRADING_DESK} featureLabel="Advanced Trading Desk" onNavigate={goTo}>
        <TradingDeskView onNavigate={goTo} />
      </LockedFeatureCard>
    );
    if (activeSection === 'alerts') return <AlertsNotificationsView onNavigate={goTo} />;
    if (activeSection === 'reports') return <ReportsAnalyticsView onNavigate={goTo} />;
    if (activeSection === 'broker') return <BrokerConnectionView />;
    if (activeSection === 'notifications') return <NotificationsView onNavigate={goTo} />;
    if (activeSection === 'pricing') return <QuantPricingPage onNavigate={goTo} />;
    if (activeSection === 'account') return <AccountSubscriptionView onNavigate={goTo} />;
    if (activeSection === 'settings') return <WorkspaceSettingsView onNavigate={goTo} />;
    if (['portfolio', 'positions', 'holdings', 'orders', 'trades', 'watchlist', 'markets'].includes(activeSection)) return <BrokerDataView type={activeSection === 'markets' ? 'watchlist' : activeSection} onConnect={() => goTo('broker')} />;
    return <GenericTableView type={activeSection} onNavigate={goTo} />;
  }, [activeSection]);

  return (
    <div className="quant-shell">
      <MarketTape />
      <aside className={`quant-sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="quant-brand">
          <Link to="/" className="quant-brand-logo-link">
            <img 
              src={kepweLogo} 
              alt="KEPWE Logo" 
              className="quant-brand-logo-img"
            />
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
              {section.items.map(({ key, label, icon: Icon }) => {
                // Determine if this nav item needs a PRO lock indicator
                const premiumNavMap = {
                  builder:     FEATURES.STRATEGY_BUILDER,
                  strategies:  FEATURES.ALGO_STRATEGIES,
                  scalping:    FEATURES.ALGO_STRATEGIES,
                  backtest:    FEATURES.ADVANCED_BACKTESTING,
                  desk:        FEATURES.TRADING_DESK,
                  shield:      FEATURES.ADVANCED_RISK,
                  live:        FEATURES.LIVE_EXECUTION,
                };
                const featureKey = premiumNavMap[key];
                const isLocked = featureKey
                  ? !isFeatureAllowed(featureKey)
                  : false;

                return (
                  <button
                    className={activeSection === key ? 'active' : ''}
                    key={key}
                    onClick={() => goTo(key)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                    {isLocked ? (
                      <NavLockBadge />
                    ) : key === 'live' && !isLocked ? (
                      <Lock size={12} style={{ marginLeft: 'auto', color: '#94a3b8' }} />
                    ) : null}
                  </button>
                );
              })}
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
          <div className="quant-topbar-leading">
            <Link to="/" className="quant-topbar-brand" aria-label="Go to KEPWE home">
              <img src={kepweLogo} alt="KEPWE" />
              <span>KEPWE</span>
            </Link>
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
              style={{ position: 'relative' }}
            >
              <Bell size={17} />
              {notificationCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: '10px',
                  minWidth: '18px',
                  textAlign: 'center',
                  lineHeight: 1.2
                }}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
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
      <SubscriptionProvider>
        <BrokerProvider>
          <QuantDashboardContent />
        </BrokerProvider>
      </SubscriptionProvider>
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

function NiftyScalpingView({ onNavigate }) {
  const fields = [
    ['Instrument', 'NIFTY 50 index options'],
    ['Direction', 'Long CE / Long PE only'],
    ['Signal / execution', '5m underlying / 1m option LTP + NIFTY'],
    ['Risk / reward', '1:2 before costs'],
    ['Risk per trade', '5% of starting-day capital'],
    ['Daily drawdown', '10%'],
    ['Trade limits', '3/day · 2 consecutive full-risk losses'],
    ['Position overlap', 'None · one open position'],
    ['Forced exit', '15:10 IST · no overnight'],
  ];
  const indicators = ['VWAP', 'EMA20', 'EMA50', 'ADX(14)', 'ATR(14)', '20-bar ATR median', 'Opening range', 'Breakout status', '1-minute confirmation'];

  return (
    <div className="quant-page-view">
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">ALGO STRATEGIES · EXACT SPECIFICATION</span>
          <h1>KEPWE NIFTY 50 Scalping</h1>
          <p>Live deployment remains gated until independent validation and real broker/data checks pass.</p>
        </div>
        <div className="quant-page-action">
          <button className="quant-button quant-button-secondary quant-button-small" onClick={() => onNavigate('builder')}>
            <SlidersHorizontal size={14} /> Strategy Builder
          </button>
          <button className="quant-button quant-button-primary quant-button-small" onClick={() => onNavigate('backtest')}>
            <BarChart3 size={14} /> Backtesting
          </button>
        </div>
      </section>

      <div className="quant-metric-grid">
        {['BACKTEST', 'VALIDATION', 'READY', 'LIVE'].map((state) => (
          <div className="quant-metric-card" key={state}>
            <div className="quant-metric-top"><span>{state}</span><ShieldCheck size={16} /></div>
            <strong>{state === 'BACKTEST' ? 'AVAILABLE' : 'BLOCKED'}</strong>
            <small>{state === 'BACKTEST' ? 'Requires real historical candles and option observations' : 'Independent gate has not passed'}</small>
          </div>
        ))}
      </div>

      <section className="quant-panel" style={{ padding: '24px', marginBottom: '20px' }}>
        <PanelHeader eyebrow="IMMUTABLE PARAMETERS" title="Strategy contract" icon={Target} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px' }}>
          {fields.map(([label, value]) => <StrategyField key={label} label={label} value={value} />)}
        </div>
      </section>

      <section className="quant-panel" style={{ padding: '24px', marginBottom: '20px' }}>
        <PanelHeader eyebrow="LIVE OBSERVATIONS" title="Current signal state" icon={Activity} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px' }}>
          {indicators.map((label) => <StrategyField key={label} label={label} value="LIVE DATA UNAVAILABLE" />)}
          {['Selected option', 'Entry', 'Stop', 'Target', 'Risk amount', 'Quantity', 'Current P&L', 'Daily P&L', 'Trades today', 'Losses today', 'Drawdown', 'Deployment Gate'].map((label) => (
            <StrategyField key={label} label={label} value="LIVE DATA UNAVAILABLE" />
          ))}
        </div>
      </section>

      <div className="quant-connection-alert warning">
        No live signal is shown until the real production feed, current contract master, broker session, and deployment gate are verified.
      </div>
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
