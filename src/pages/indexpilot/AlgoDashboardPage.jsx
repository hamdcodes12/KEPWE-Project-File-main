import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, Bot, CheckCircle2, ChevronRight,
  CircleStop, Clock3, Link2, LogOut, Menu, Play, Save, Settings2, ShieldCheck,
  SlidersHorizontal, TrendingDown, TrendingUp, UserRound, Wallet, X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiFetch, API_BASE, getAccessToken } from '../../api/client';
import './AlgoDashboardPage.css';

const routes = [
  { path: '/indexpilot-algo', label: 'Overview', icon: <BarChart3 size={17} /> },
  { path: '/indexpilot-algo/dashboard', label: 'Dashboard', icon: <Wallet size={17} /> },
  { path: '/indexpilot-algo/strategies', label: 'Strategies', icon: <TrendingUp size={17} /> },
  { path: '/indexpilot-algo/backtest', label: 'Backtest', icon: <Activity size={17} /> },
  { path: '/indexpilot-algo/paper-trading', label: 'Paper Trading', icon: <Bot size={17} /> },
  { path: '/indexpilot-algo/trades', label: 'Trade history', icon: <Clock3 size={17} /> },
  { path: '/indexpilot-algo/positions', label: 'Positions', icon: <ArrowUpRight size={17} /> },
  { path: '/indexpilot-algo/settings', label: 'Algo settings', icon: <Settings2 size={17} /> },
];

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const defaultSettings = {
  tradingCapital: 0, riskPerTrade: 1, riskReward: 2, maxTradesPerDay: 3,
  maxConsecutiveLosses: 3, dailyLossLimit: 0,
};

function MetricCard({ label, value, icon, accent = 'blue', detail }) {
  return (
    <article className={`algo-metric-card accent-${accent}`}>
      <div className="algo-metric-head"><span>{label}</span><span className="algo-metric-icon">{icon}</span></div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function EmptyState({ title, description }) {
  return <div className="algo-empty"><div className="algo-empty-icon"><Activity size={20} /></div><strong>{title}</strong><p>{description}</p></div>;
}

function ProtectedAlgo({ children }) {
  const { authState } = useApp();
  if (authState.isLoading) return <div className="algo-loading-screen"><div className="algo-spinner" />Loading your Algo workspace…</div>;
  if (!authState.isLoggedIn) return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  return children;
}

export default function AlgoDashboardPage() {
  const { authState, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [activity, setActivity] = useState([]);
  const [riskEvents, setRiskEvents] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);

  const currentPath = location.pathname === '/indexpilot-algo' ? '/indexpilot-algo' : location.pathname;
  const currentLabel = routes.find((item) => item.path === currentPath)?.label || 'Overview';

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    const responses = await Promise.all([
      apiFetch('/algo/dashboard'),
      apiFetch('/algo/strategies'),
      apiFetch('/algo/positions'),
      apiFetch('/algo/orders'),
      apiFetch('/algo/trades'),
      apiFetch('/algo/activity'),
      apiFetch('/algo/risk-events'),
      apiFetch('/algo/metrics'),
    ]);
    const [dashboardRes, strategiesRes, positionsRes, ordersRes, tradesRes, activityRes, riskEventsRes, metricsRes] = responses;
    if (dashboardRes.ok) {
      setDashboard(dashboardRes.data);
      setSettings(dashboardRes.data.settings || defaultSettings);
    } else {
      setNotice({ type: 'error', text: dashboardRes.data?.error || 'Could not load your Algo workspace.' });
    }
    if (strategiesRes.ok) setStrategies(strategiesRes.data.strategies || []);
    if (positionsRes.ok) setPositions(positionsRes.data.positions || []);
    if (ordersRes.ok) setOrders(ordersRes.data.orders || []);
    if (tradesRes.ok) setTrades(tradesRes.data.trades || []);
    if (activityRes.ok) setActivity(activityRes.data.activity || []);
    if (riskEventsRes.ok) setRiskEvents(riskEventsRes.data.events || []);
    if (metricsRes.ok) setMetrics(metricsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authState.isLoggedIn && !authState.isLoading) loadWorkspace();
  }, [authState.isLoggedIn, authState.isLoading, loadWorkspace]);

  useEffect(() => {
    if (!authState.isLoggedIn || authState.isLoading || !getAccessToken()) return undefined;
    const controller = new AbortController();
    let buffer = '';
    fetch(`${API_BASE}/algo/stream`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        events.forEach((event) => {
          const line = event.split('\n').find((item) => item.startsWith('data: '));
          if (!line) return;
          try {
            const snapshot = JSON.parse(line.slice(6));
             setDashboard((current) => ({
               ...(current || {}),
               algoStatus: snapshot.algoStatus,
               todayPnl: snapshot.todayPnl,
               openPositions: snapshot.positions?.length ?? 0,
             }));
             if (Array.isArray(snapshot.positions)) {
               setPositions(snapshot.positions.map((position) => ({
                 symbol: position.instrument || position.symbol,
                 side: position.side,
                 quantity: Number(position.quantity),
                 entry: Number(position.entry_price ?? position.entry),
                 current: Number(position.current_price ?? position.current),
                 stopLoss: position.stop_loss == null ? null : Number(position.stop_loss),
                 target: position.target == null ? null : Number(position.target),
                 pnl: Number(position.pnl || 0),
                 status: position.status,
               })));
             }
              if (Array.isArray(snapshot.activity)) {
                setActivity(snapshot.activity.map((item) => ({
                  type: item.event_type,
                  message: item.message,
                  createdAt: item.created_at,
                })));
              }
              if (Array.isArray(snapshot.orders)) setOrders(snapshot.orders);
              if (snapshot.metrics) {
                const totalTrades = Number(snapshot.metrics.totalTrades || 0);
                const winningTrades = Number(snapshot.metrics.winningTrades || 0);
                setMetrics((current) => ({
                  ...(current || {}),
                  ...snapshot.metrics,
                  winRate: totalTrades ? Number(((winningTrades / totalTrades) * 100).toFixed(2)) : 0,
                }));
              }
          } catch {
            // Ignore incomplete frames; the next frame contains a full snapshot.
          }
        });
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [authState.isLoggedIn, authState.isLoading]);

  const updateStatus = async (nextStatus, confirmRisk = false) => {
    const result = await apiFetch(`/algo/${nextStatus === 'ACTIVE' ? 'start' : 'stop'}`, { method: 'POST', body: { confirmRisk } });
    if (result.ok) {
      setDashboard((current) => current ? { ...current, algoStatus: result.data.status } : current);
      setNotice({ type: 'success', text: result.data.status === 'ACTIVE' ? 'Algo started in the configured execution mode.' : 'Algo stopped.' });
      const activityResult = await apiFetch('/algo/activity');
      if (activityResult.ok) setActivity(activityResult.data.activity || []);
      const riskResult = await apiFetch('/algo/risk-events');
      if (riskResult.ok) setRiskEvents(riskResult.data.events || []);
    } else setNotice({ type: 'error', text: result.data?.error || 'Could not update Algo status.' });
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    const result = await apiFetch('/algo/settings', { method: 'PUT', body: settings });
    if (result.ok) {
      setSettings(result.data);
      setDashboard((current) => current ? { ...current, settings: result.data, balance: result.data.tradingCapital } : current);
      setNotice({ type: 'success', text: 'Algo settings saved to your account.' });
    } else setNotice({ type: 'error', text: result.data?.error || 'Could not save settings.' });
  };

  const connectSandbox = async (broker) => {
    const result = await apiFetch('/broker/connect', { method: 'POST', body: { broker } });
    if (result.ok) {
      setNotice({ type: 'success', text: `${broker === 'ANGEL_ONE' ? 'Angel One' : 'Lemonn'} sandbox connected. No live orders can be placed.` });
      loadWorkspace();
    } else setNotice({ type: 'error', text: result.data?.error || 'Could not connect sandbox.' });
  };

  const onLogout = async () => { await logout(); navigate('/login', { replace: true }); };
  const connectedBrokers = useMemo(() => new Map((dashboard?.brokers || []).map((item) => [item.broker, item])), [dashboard]);

  return (
    <ProtectedAlgo>
      <div className="algo-shell">
        <aside className={`algo-sidebar ${mobileNav ? 'is-open' : ''}`}>
          <div className="algo-brand"><div className="algo-brand-mark">K</div><div><strong>KEPWE</strong><span>INDEXPILOT ALGO</span></div><button className="algo-mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={19} /></button></div>
          <div className="algo-account"><div className="algo-avatar">{(authState.user?.name || 'U').slice(0, 1).toUpperCase()}</div><div><strong>{authState.user?.name || 'Trader'}</strong><span>{authState.user?.email}</span></div></div>
          <div className="algo-nav-label">WORKSPACE</div>
          <nav className="algo-sidebar-nav">
            {routes.map((item) => <NavLink key={item.path} to={item.path} end={item.path === '/indexpilot-algo'} onClick={() => setMobileNav(false)} className={({ isActive }) => isActive ? 'active' : ''}>{item.icon}<span>{item.label}</span></NavLink>)}
          </nav>
          <div className="algo-sidebar-bottom"><Link to="/indexpilot"><ChevronRight size={15} />Back to IndexPilot</Link><button onClick={onLogout}><LogOut size={15} />Sign out</button></div>
        </aside>
        {mobileNav && <button className="algo-mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
        <main className="algo-main">
          <header className="algo-topbar">
            <button className="algo-menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <div><p className="algo-eyebrow">Kepwe IndexPilot Algo</p><h1>{currentLabel}</h1></div>
            <div className="algo-topbar-actions"><span className="algo-environment"><span />SANDBOX MODE</span><button onClick={onLogout} className="algo-top-logout"><LogOut size={16} />Sign out</button></div>
          </header>
          <div className="algo-content">
            {notice && <div className={`algo-notice ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}
            {loading && !dashboard ? <div className="algo-loading-inline"><div className="algo-spinner" />Loading workspace data…</div> : (
              <>
                {currentPath === '/indexpilot-algo' || currentPath === '/indexpilot-algo/dashboard' ? <Overview dashboard={dashboard} strategies={strategies} updateStatus={updateStatus} connectedBrokers={connectedBrokers} connectSandbox={connectSandbox} metrics={metrics} riskEvents={riskEvents} /> : null}
                {currentPath === '/indexpilot-algo/strategies' && <Strategies strategies={strategies} navigate={navigate} />}
                {currentPath === '/indexpilot-algo/backtest' && <BacktestLab />}
                {currentPath === '/indexpilot-algo/paper-trading' && <PaperTrading dashboard={dashboard} settings={settings} strategies={strategies} updateStatus={updateStatus} orders={orders} setOrders={setOrders} />}
                {currentPath === '/indexpilot-algo/trades' && <TradeHistory trades={trades} />}
                {currentPath === '/indexpilot-algo/positions' && <Positions positions={positions} />}
                {currentPath === '/indexpilot-algo/settings' && <Settings settings={settings} setSettings={setSettings} saveSettings={saveSettings} />}
              </>
            )}
          </div>
        </main>
      </div>
    </ProtectedAlgo>
  );
}

function Overview({ dashboard, strategies, updateStatus, connectedBrokers, connectSandbox, metrics, riskEvents }) {
  const strategy = strategies[0];
  const status = dashboard?.algoStatus || 'STOPPED';
  const start = () => {
    if (window.confirm('I understand the configured capital, risk, daily limits, and paper-only execution mode. Start the algo?')) {
      updateStatus('ACTIVE', true);
    }
  };
  return <div className="algo-page-stack">
    <section className="algo-hero"><div><span className="algo-kicker"><span className="algo-live-dot" />ACCOUNT SNAPSHOT</span><h2>Trade with a plan,<br /><em>not a prediction.</em></h2><p>Your capital guardrails and execution status, in one calm view.</p></div><div className={`algo-status-pill ${status.toLowerCase()}`}><span />ALGO {status}</div></section>
    <section className="algo-metrics-grid">
      <MetricCard label="Available balance" value={money(dashboard?.balance)} icon={<Wallet size={18} />} detail="Configured trading capital" />
      <MetricCard label="Today's P&L" value={money(dashboard?.todayPnl)} icon={Number(dashboard?.todayPnl) >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} accent={Number(dashboard?.todayPnl) >= 0 ? 'green' : 'red'} detail="Settled trades only" />
      <MetricCard label="Open positions" value={dashboard?.openPositions || 0} icon={<ArrowUpRight size={18} />} accent="violet" detail="Real or paper positions" />
      <MetricCard label="Today's trades" value={dashboard?.todayTrades || 0} icon={<Activity size={18} />} accent="amber" detail="Execution count" />
    </section>
    <section className="algo-panel algo-control-panel"><div><div className="algo-panel-title"><ShieldCheck size={19} />Execution controls</div><p>Activation requires explicit risk confirmation. Orders remain paper-only while live adapters are disabled.</p></div><div className="algo-control-actions"><span className={`algo-mini-status ${status.toLowerCase()}`}><span />{status}</span><button className="algo-button primary" onClick={start} disabled={status === 'ACTIVE'}><Play size={15} />Start paper algo</button><button className="algo-button dark" onClick={() => updateStatus('STOPPED')} disabled={status === 'STOPPED'}><CircleStop size={15} />Stop algo</button></div></section>
    <div className="algo-two-column"><StrategyPreview strategy={strategy} /><BrokerPanel connectedBrokers={connectedBrokers} connectSandbox={connectSandbox} /></div>
    <div className="algo-two-column"><MetricsPanel metrics={metrics} /><RiskEventsPanel events={riskEvents} /></div>
  </div>;
}

function MetricsPanel({ metrics }) {
  return <section className="algo-panel"><div className="algo-panel-heading"><div><span className="algo-section-kicker">PAPER PERFORMANCE</span><h3>Actual recorded results</h3></div><span className="algo-data-badge">PAPER ONLY</span></div><div className="algo-performance-grid"><div><span>Win rate</span><strong>{metrics?.winRate ?? 0}%</strong></div><div><span>Net P&amp;L</span><strong className={Number(metrics?.netPnl) >= 0 ? 'positive' : 'negative'}>{money(metrics?.netPnl)}</strong></div><div><span>Trades</span><strong>{metrics?.totalTrades ?? 0}</strong></div><div><span>Average win</span><strong>{money(metrics?.averageWin || 0)}</strong></div></div></section>;
}

function RiskEventsPanel({ events = [] }) {
  return <section className="algo-panel"><div className="algo-panel-heading"><div><span className="algo-section-kicker">SAFETY LOG</span><h3>Risk events</h3></div><ShieldCheck size={17} className="algo-heading-icon" /></div>{events.length ? <div className="algo-risk-list">{events.slice(0, 4).map((event, index) => <div className="algo-risk-item" key={`${event.createdAt}-${index}`}><span className={`algo-risk-severity ${event.severity?.toLowerCase()}`}>{event.severity}</span><div><strong>{event.reason}</strong><small>{dateTime(event.createdAt)}</small></div></div>)}</div> : <p className="algo-muted-copy">No risk events recorded. Blocked orders and kill-switch activity will appear here.</p>}</section>;
}

function StrategyPreview({ strategy }) {
  return <section className="algo-panel"><div className="algo-panel-heading"><div><span className="algo-section-kicker">ACTIVE STRATEGY</span><h3>{strategy?.name || 'Kepwe NIFTY Pulse 5M'}</h3></div><Link to="/indexpilot-algo/strategies">View all <ChevronRight size={15} /></Link></div><div className="algo-strategy-grid"><div><span>Instrument</span><strong>{strategy?.instrument || 'NIFTY 50'}</strong></div><div><span>Style</span><strong>{strategy?.style || 'Intraday Scalping'}</strong></div><div><span>Timeframe</span><strong>{strategy?.timeframe || '5 Minute'}</strong></div><div><span>Risk / reward</span><strong>{strategy?.riskReward || '1:2'}</strong></div></div><p className="algo-muted-copy">{strategy?.description || 'A rules-based setup with defined risk and limited frequency.'}</p></section>;
}

function BrokerPanel({ connectedBrokers, connectSandbox }) {
  return <section className="algo-panel"><div className="algo-panel-heading"><div><span className="algo-section-kicker">BROKER ADAPTERS</span><h3>Connect your broker</h3></div><Link2 size={17} className="algo-heading-icon" /></div><p className="algo-muted-copy">Sandbox adapters are available for wiring. Kepwe never collects broker passwords or PINs.</p><div className="algo-broker-list">{[['ANGEL_ONE', 'Angel One'], ['LEMONN', 'Lemonn']].map(([key, name]) => { const broker = connectedBrokers.get(key); return <div className="algo-broker-row" key={key}><div className="algo-broker-logo">{name.slice(0, 1)}</div><div><strong>{name}</strong><span>{broker?.status === 'SANDBOX_CONNECTED' ? 'Sandbox connected' : 'Not connected'}</span></div><div className="algo-broker-actions"><a href={key === 'ANGEL_ONE' ? 'https://www.angelone.in/open-account' : 'https://lemonn.co.in/'} target="_blank" rel="noreferrer">Open account</a><button onClick={() => connectSandbox(key)} disabled={broker?.status === 'SANDBOX_CONNECTED'}>{broker?.status === 'SANDBOX_CONNECTED' ? 'Connected' : 'Connect sandbox'}</button></div></div>; })}</div></section>;
}

function Strategies({ strategies, navigate }) {
  return <div className="algo-page-stack"><div className="algo-page-intro"><span className="algo-section-kicker">RULES-BASED PLAYBOOK</span><h2>Strategies built for discipline.</h2><p>Review the active strategy definitions before enabling execution.</p></div><div className="algo-strategy-list">{strategies.map((strategy) => <article className="algo-strategy-card" key={strategy.id}><div className="algo-strategy-card-top"><span className="algo-strategy-tag">ACTIVE</span><span className="algo-strategy-code">{strategy.timeframe}</span></div><h3>{strategy.name}</h3><p>{strategy.description}</p><div className="algo-strategy-grid"><div><span>Instrument</span><strong>{strategy.instrument}</strong></div><div><span>Style</span><strong>{strategy.style}</strong></div><div><span>Risk / reward</span><strong>{strategy.riskReward}</strong></div><div><span>Max trades / day</span><strong>{strategy.maxTradesPerDay}</strong></div></div><button className="algo-button primary" onClick={() => navigate('/indexpilot-algo/paper-trading')}>Use in paper trading <ArrowUpRight size={15} /></button></article>)}</div>{!strategies.length && <EmptyState title="No strategies available" description="Strategy definitions will appear once the backend reference data is available." />}</div>;
}

function PaperTrading({ dashboard, settings, strategies, updateStatus, orders = [], setOrders }) {
  const [candles, setCandles] = useState('');
  const [signal, setSignal] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loadingSignal, setLoadingSignal] = useState(false);
  const [quantity, setQuantity] = useState('');
  const strategy = strategies[0];

  const evaluate = async () => {
    setError('');
    setResult(null);
    setLoadingSignal(true);
    try {
      const response = await apiFetch('/algo/signal', {
        method: 'POST',
        body: { candles: JSON.parse(candles), riskReward: settings.riskReward },
      });
      if (!response.ok) throw new Error(response.data?.error || 'Signal evaluation failed');
      setSignal(response.data.signal);
      setQuantity(response.data.signal?.sizing?.quantity ? String(response.data.signal.sizing.quantity) : '');
    } catch (err) {
      setError(err.message || 'Paste a valid JSON candle array with OHLCV fields.');
    } finally {
      setLoadingSignal(false);
    }
  };

  const placeOrder = async () => {
    if (!signal || signal.signal === 'NO_TRADE') return;
    const response = await apiFetch('/algo/paper/orders', {
      method: 'POST',
      body: {
        strategyId: strategy?.id || null,
        instrument: 'NIFTY 50',
        side: signal.signal,
        quantity: Number(quantity),
        price: signal.price,
        stopLoss: signal.stopLoss,
        target: signal.target,
      },
    });
    if (response.ok) {
      const status = response.data?.order?.status;
      setResult({
        type: 'success',
        text: status === 'SUBMITTED' || status === 'PARTIALLY_FILLED'
          ? 'Paper order submitted and waiting for execution.'
          : 'Paper order filled and recorded separately from live trades.',
      });
      if (response.data?.order && setOrders) {
        setOrders((current) => [response.data.order, ...current.filter((item) => item.id !== response.data.order.id)]);
      }
    } else {
      setResult({ type: 'error', text: response.data?.error || 'Risk engine blocked this paper order.' });
    }
  };

  const start = () => {
    if (window.confirm('I understand this activates the configured paper strategy with its displayed risk limits. Continue?')) {
      updateStatus('ACTIVE', true);
    }
  };

  return <div className="algo-page-stack">
    <div className="algo-page-intro"><span className="algo-section-kicker">SAFE EXECUTION</span><h2>Paper trading</h2><p>Run the same confirmation, sizing, slippage, charges, and safety gates without sending a live broker order.</p></div>
    <section className="algo-panel algo-paper-banner"><Bot size={28} /><div><h3>Paper execution only</h3><p>Paper trades are stored in their own ledger and never presented as live performance.</p></div><span className={`algo-status-pill ${dashboard?.algoStatus?.toLowerCase()}`}><span />{dashboard?.algoStatus || 'STOPPED'}</span></section>
    <section className="algo-panel">
      <div className="algo-panel-heading"><div><span className="algo-section-kicker">SIGNAL WORKBENCH</span><h3>Evaluate verified candle data</h3></div><span className="algo-data-badge">NIFTY 50 · 5M</span></div>
      <p className="algo-muted-copy">Paste an OHLCV JSON array exported from your market-data source. The engine needs at least 30 candles and never invents missing data.</p>
      <textarea className="algo-candle-input" value={candles} onChange={(event) => setCandles(event.target.value)} placeholder='[{"timestamp":"2026-08-28T04:00:00Z","open":24800,"high":24820,"low":24790,"close":24810,"volume":120000}]' />
      <div className="algo-form-footer"><span className="algo-muted-copy">Strategy: {strategy?.name || 'Kepwe NIFTY Pulse 5M'}</span><button className="algo-button primary" onClick={evaluate} disabled={loadingSignal}>{loadingSignal ? 'Evaluating…' : 'Evaluate latest candle'}</button></div>
      {error && <div className="algo-notice error"><AlertTriangle size={16} />{error}</div>}
      {signal && <div className={`algo-signal-result ${signal.signal === 'NO_TRADE' ? 'no-trade' : signal.signal === 'BUY' ? 'buy' : 'sell'}`}><div><span className="algo-section-kicker">ENGINE OUTPUT</span><h3>{signal.signal === 'NO_TRADE' ? 'NO TRADE' : `${signal.signal} candidate`}</h3><p>{signal.reason || 'All configured strategy conditions passed.'}</p></div>{signal.signal !== 'NO_TRADE' && <div className="algo-signal-fields"><span>Entry <strong>{money(signal.price)}</strong></span><span>Stop <strong>{money(signal.stopLoss)}</strong></span><span>Target <strong>{money(signal.target)}</strong></span><label>Qty<input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><button className="algo-button primary" onClick={placeOrder}>Place paper order</button></div>}</div>}
    </section>
    <PaperOrderLifecycle orders={orders} setOrders={setOrders} />
    <section className="algo-panel"><div className="algo-panel-title"><SlidersHorizontal size={18} />Activation summary</div><div className="algo-activation-grid"><div><span>Strategy</span><strong>{strategy?.name || 'Kepwe NIFTY Pulse 5M'}</strong></div><div><span>Capital</span><strong>{money(settings.tradingCapital)}</strong></div><div><span>Risk / trade</span><strong>{settings.riskPerTrade}%{settings.riskPerTrade === 5 ? ' · High Risk' : ''}</strong></div><div><span>Risk / reward</span><strong>1:{settings.riskReward}</strong></div><div><span>Max trades</span><strong>{settings.maxTradesPerDay}/day</strong></div><div><span>Window</span><strong>09:30–11:30 IST</strong></div></div>{result && <div className={`algo-notice ${result.type}`}>{result.text}</div>}<button className="algo-button primary" onClick={start} disabled={dashboard?.algoStatus === 'ACTIVE'}><Play size={15} />Start paper algo</button></section>
  </div>;
}

function PaperOrderLifecycle({ orders = [], setOrders }) {
  const [busyId, setBusyId] = useState(null);
  const pending = orders.filter((order) => ['CREATED', 'SUBMITTED', 'PARTIALLY_FILLED'].includes(order.status));

  const transition = async (order, action, body = {}) => {
    setBusyId(`${order.id}:${action}`);
    const response = await apiFetch(`/algo/orders/${order.id}/${action}`, { method: 'POST', body });
    if (response.ok && response.data?.order && setOrders) {
      setOrders((current) => current.map((item) => item.id === order.id ? response.data.order : item));
    }
    setBusyId(null);
  };

  const modify = async (order) => {
    const price = Number(window.prompt('New limit price', order.price));
    const stopLoss = Number(window.prompt('New stop-loss', order.stopLoss));
    const target = Number(window.prompt('New target', order.target));
    if (![price, stopLoss, target].every((value) => Number.isFinite(value) && value > 0)) return;
    setBusyId(`${order.id}:modify`);
    const response = await apiFetch(`/algo/orders/${order.id}`, {
      method: 'PATCH',
      body: { price, stopLoss, target },
    });
    if (response.ok && response.data?.order && setOrders) {
      setOrders((current) => current.map((item) => item.id === order.id ? response.data.order : item));
    }
    setBusyId(null);
  };

  return <section className="algo-panel">
    <div className="algo-panel-heading"><div><span className="algo-section-kicker">ORDER LIFECYCLE</span><h3>Pending paper orders</h3></div><span className="algo-data-badge">{pending.length} PENDING</span></div>
    {pending.length === 0
      ? <p className="algo-muted-copy">No pending paper orders. Submitted orders can be modified, filled, rejected, or cancelled here.</p>
      : <div className="algo-order-list">{pending.map((order) => <div className="algo-order-row" key={order.id}><div><strong>{order.side} {order.instrument}</strong><span>{order.status} · {order.filledQuantity || 0}/{order.quantity} filled · {money(order.price)}</span></div><div className="algo-order-actions"><button className="algo-button subtle" disabled={busyId} onClick={() => modify(order)}>Modify</button><button className="algo-button primary" disabled={busyId} onClick={() => transition(order, 'fill', { fillPrice: order.price })}>Fill</button><button className="algo-button subtle" disabled={busyId} onClick={() => transition(order, 'reject', { reason: 'Rejected from paper order lifecycle' })}>Reject</button><button className="algo-button dark" disabled={busyId} onClick={() => transition(order, 'cancel')}>Cancel</button></div></div>)}</div>}
  </section>;
}

function BacktestLab() {
  const [candles, setCandles] = useState('');
  const [capital, setCapital] = useState('100000');
  const [riskPerTrade, setRiskPerTrade] = useState('1');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const response = await apiFetch('/algo/backtest', {
        method: 'POST',
        body: { candles: JSON.parse(candles), capital: Number(capital), riskPerTrade: Number(riskPerTrade), riskReward: 2, timeframe: '5m' },
      });
      if (!response.ok) throw new Error(response.data?.error || 'Backtest failed');
      setResult(response.data);
    } catch (err) {
      setError(err.message || 'Paste a valid JSON candle array.');
    } finally {
      setLoading(false);
    }
  };

  const metrics = result?.metrics;
  return <div className="algo-page-stack"><div className="algo-page-intro"><span className="algo-section-kicker">RESEARCH LAB</span><h2>Backtest the strategy.</h2><p>Run deterministic historical tests with explicit costs and slippage. Results are simulated research, never live performance.</p></div><form className="algo-panel algo-backtest-form" onSubmit={run}><div className="algo-form-grid"><label>Capital<input type="number" min="1" value={capital} onChange={(event) => setCapital(event.target.value)} /></label><label>Risk per trade<select value={riskPerTrade} onChange={(event) => setRiskPerTrade(event.target.value)}><option value="0.5">0.5%</option><option value="1">1%</option><option value="2">2%</option><option value="5">5% — High Risk</option></select></label></div><label className="algo-candle-label">Historical OHLCV JSON<textarea className="algo-candle-input" value={candles} onChange={(event) => setCandles(event.target.value)} placeholder="Paste at least 30 chronological 5-minute candles here." /></label>{error && <div className="algo-notice error"><AlertTriangle size={16} />{error}</div>}<div className="algo-form-footer"><span className="algo-muted-copy">No results are hardcoded or tuned to a target win rate.</span><button className="algo-button primary" type="submit" disabled={loading}>{loading ? 'Running…' : 'Run backtest'}</button></div></form>{metrics && <section className="algo-panel"><div className="algo-panel-heading"><div><span className="algo-section-kicker">SIMULATED RESULT</span><h3>Actual historical output</h3></div><span className="algo-data-badge">NOT LIVE</span></div><div className="algo-performance-grid">{[['Total trades', metrics.totalTrades], ['Win rate', `${metrics.winRate}%`], ['Net P&L', money(metrics.netPnl)], ['Charges', money(metrics.charges)], ['Slippage', money(metrics.slippage)], ['Profit factor', metrics.profitFactor ?? '—'], ['Max drawdown', money(metrics.maximumDrawdown)], ['Expectancy', money(metrics.expectancy)], ['R-multiple', metrics.rMultiple]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p className="algo-muted-copy">This run is stored with its inputs. Validate out-of-sample, walk-forward, paper, and failure-recovery behavior before considering any live deployment.</p></section>}</div>;
}

function Settings({ settings, setSettings, saveSettings }) {
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: key === 'riskPerTrade' ? Number(value) : key === 'maxTradesPerDay' || key === 'maxConsecutiveLosses' ? Number(value) : Number(value) }));
  return <div className="algo-page-stack"><div className="algo-page-intro"><span className="algo-section-kicker">RISK GUARDRAILS</span><h2>Algo settings</h2><p>These limits are stored per user and are used before any execution adapter can act.</p></div><form className="algo-panel algo-settings-form" onSubmit={saveSettings}><div className="algo-form-grid"><label>Trading capital<input type="number" min="0" step="100" value={settings.tradingCapital} onChange={(e) => update('tradingCapital', e.target.value)} /><small>₹ amount reserved for the strategy</small></label><label>Risk per trade<select value={settings.riskPerTrade} onChange={(e) => update('riskPerTrade', e.target.value)}><option value="0.5">0.5%</option><option value="1">1%</option><option value="2">2%</option><option value="5">5% — High Risk</option></select></label><label>Risk / reward<input type="number" min="0.1" max="100" step="0.1" value={settings.riskReward} onChange={(e) => update('riskReward', e.target.value)} /></label><label>Maximum trades / day<input type="number" min="0" max="100" value={settings.maxTradesPerDay} onChange={(e) => update('maxTradesPerDay', e.target.value)} /></label><label>Maximum consecutive losses<input type="number" min="0" max="100" value={settings.maxConsecutiveLosses} onChange={(e) => update('maxConsecutiveLosses', e.target.value)} /></label><label>Daily loss limit<input type="number" min="0" step="100" value={settings.dailyLossLimit} onChange={(e) => update('dailyLossLimit', e.target.value)} /><small>₹0 means no configured limit yet</small></label></div><div className="algo-form-footer"><p><ShieldCheck size={17} />Guardrails are saved to your account, not your browser.</p><button className="algo-button primary" type="submit"><Save size={15} />Save settings</button></div></form></div>;
}

function Positions({ positions }) {
  return <div className="algo-page-stack"><div className="algo-page-intro"><span className="algo-section-kicker">LIVE VIEW</span><h2>Open positions</h2><p>Only positions recorded for your account are shown here.</p></div><section className="algo-panel algo-table-panel">{positions.length ? <div className="algo-table-scroll"><table><thead><tr>{['Symbol', 'Side', 'Quantity', 'Entry', 'Current', 'SL', 'Target', 'P&L', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{positions.map((position, index) => <tr key={`${position.symbol}-${index}`}><td><strong>{position.symbol}</strong></td><td><span className={`algo-side ${position.side.toLowerCase()}`}>{position.side}</span></td><td>{position.quantity}</td><td>{money(position.entry)}</td><td>{money(position.current)}</td><td>{position.stopLoss == null ? '—' : money(position.stopLoss)}</td><td>{position.target == null ? '—' : money(position.target)}</td><td className={position.pnl >= 0 ? 'positive' : 'negative'}>{money(position.pnl)}</td><td>{position.status}</td></tr>)}</tbody></table></div> : <EmptyState title="No open positions" description="Positions will appear here after a verified paper or live execution is recorded." />}</section></div>;
}

function TradeHistory({ trades }) {
  const [filter, setFilter] = useState('ALL');
  const filtered = filter === 'ALL' ? trades : trades.filter((trade) => filter === 'PROFIT' ? trade.pnl > 0 : trade.pnl < 0);
  return <div className="algo-page-stack"><div className="algo-page-intro"><span className="algo-section-kicker">EXECUTION JOURNAL</span><h2>Trade history</h2><p>Historical executions are read from your account record. No placeholder trades are displayed.</p></div><section className="algo-panel algo-table-panel"><div className="algo-filter-row"><span>Showing {filtered.length} trades</span><div><button className={filter === 'ALL' ? 'selected' : ''} onClick={() => setFilter('ALL')}>All</button><button className={filter === 'PROFIT' ? 'selected' : ''} onClick={() => setFilter('PROFIT')}>Profit</button><button className={filter === 'LOSS' ? 'selected' : ''} onClick={() => setFilter('LOSS')}>Loss</button></div></div>{filtered.length ? <div className="algo-table-scroll"><table><thead><tr>{['Date / time', 'Symbol', 'Strategy', 'Side', 'Entry', 'Exit', 'Qty', 'P&L', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{filtered.map((trade, index) => <tr key={`${trade.date}-${index}`}><td>{dateTime(trade.date)}</td><td><strong>{trade.symbol}</strong></td><td>{trade.strategy}</td><td><span className={`algo-side ${trade.side.toLowerCase()}`}>{trade.side}</span></td><td>{trade.entry == null ? '—' : money(trade.entry)}</td><td>{trade.exit == null ? '—' : money(trade.exit)}</td><td>{trade.quantity}</td><td className={trade.pnl >= 0 ? 'positive' : 'negative'}>{money(trade.pnl)}</td><td>{trade.status}</td></tr>)}</tbody></table></div> : <EmptyState title="No trades yet" description="Your trade history will populate from verified paper or live execution events." />}</section></div>;
}

function ComingSoon({ title, description }) {
  return <div className="algo-page-stack"><div className="algo-page-intro"><span className="algo-section-kicker">IN DEVELOPMENT</span><h2>{title}</h2><p>{description}</p></div><section className="algo-panel algo-coming-soon"><div className="algo-empty-icon"><Activity size={22} /></div><h3>Data integrity comes first</h3><p>This route is ready for the next backend adapter. It will remain empty rather than presenting fabricated market results.</p></section></div>;
}