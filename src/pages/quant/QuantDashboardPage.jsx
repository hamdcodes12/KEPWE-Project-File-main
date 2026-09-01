import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import UserMenu from '../../components/common/UserMenu';
import { useApp } from '../../context/AppContext';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Command,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  Link2,
  ListFilter,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
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
    label: 'Trading',
    items: [
      { key: 'portfolio', label: 'Portfolio & funds', icon: WalletCards },
      { key: 'positions', label: 'Positions', icon: BriefcaseBusiness },
      { key: 'orders', label: 'Orders & history', icon: ListFilter },
      { key: 'holdings', label: 'Holdings', icon: CircleDollarSign },
    ],
  },
  {
    label: 'Quant lab',
    items: [
      { key: 'analytics', label: 'P&L analytics', icon: TrendingUp },
      { key: 'strategies', label: 'Algo strategies', icon: Bot },
      { key: 'builder', label: 'Strategy builder', icon: SlidersHorizontal },
      { key: 'risk', label: 'Risk management', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'broker', label: 'Broker connection', icon: Link2 },
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

function EmptyData({ title = 'Connect a broker to load data', description = 'Live prices, balances and orders will appear here once a supported provider is connected.', action = true, compact = false, onConnect }) {
  return (
    <div className={`quant-empty ${compact ? 'is-compact' : ''}`}>
      <div className="quant-empty-icon"><Activity size={compact ? 17 : 20} /></div>
      <strong>{title}</strong>
      <p>{description}</p>
      {action && <button className="quant-button quant-button-primary quant-button-small" onClick={onConnect}>Connect broker <ChevronRight size={14} /></button>}
    </div>
  );
}

function PanelHeader({ eyebrow, title, action, onAction, icon: Icon = BarChart3 }) {
  return (
    <div className="quant-panel-header">
      <div className="quant-panel-title">
        <span className="quant-panel-icon"><Icon size={16} /></span>
        <div>
          {eyebrow && <span className="quant-eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
      </div>
      {action && <button className="quant-panel-action" onClick={onAction}>{action}<ChevronRight size={14} /></button>}
    </div>
  );
}

function MarketTape() {
  return (
    <div className="quant-market-tape">
      <div className="quant-tape-brand"><span className="quant-live-dot" /> KEPWE QUANT</div>
      <div className="quant-tape-items">
        {['NIFTY 50', 'BANK NIFTY', 'SENSEX', 'INDIA VIX'].map((name) => (
          <span key={name} className="quant-tape-item"><b>{name}</b><em>—</em><small>Not connected</small></span>
        ))}
      </div>
      <span className="quant-tape-status"><span className="quant-status-dot muted" /> Feed disconnected</span>
    </div>
  );
}

function ChartWorkspace({ symbol = 'NIFTY 50', timeframe, setTimeframe, onConnect }) {
  const timeframes = ['1D', '1W', '1M', '3M', '1Y'];
  return (
    <section className="quant-panel quant-chart-panel">
      <PanelHeader eyebrow="MARKET VIEW" title={`${symbol} chart`} icon={BarChart3} />
      <div className="quant-chart-toolbar">
        <div className="quant-chart-symbol">
          <span className="quant-symbol-mark blue">{symbol.slice(0, 1)}</span>
          <div><strong>{symbol}</strong><small>NSE · Equity index</small></div>
        </div>
        <div className="quant-chart-controls">
          <div className="quant-segmented">
            {timeframes.map((item) => <button key={item} className={timeframe === item ? 'active' : ''} onClick={() => setTimeframe(item)}>{item}</button>)}
          </div>
          <button className="quant-icon-button" aria-label="Chart settings"><SlidersHorizontal size={16} /></button>
          <button className="quant-icon-button" aria-label="Open chart in new window"><ExternalLink size={16} /></button>
        </div>
      </div>
      <div className="quant-chart-canvas">
        <div className="quant-chart-grid" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i />
        </div>
        <div className="quant-chart-empty">
          <div className="quant-chart-empty-mark"><Activity size={20} /></div>
          <strong>Waiting for market data</strong>
          <span>Connect a broker feed to unlock the TradingView-style workspace.</span>
          <button className="quant-button quant-button-secondary quant-button-small" onClick={onConnect}>Connect data feed <Link2 size={14} /></button>
        </div>
        <div className="quant-chart-axis quant-chart-axis-y"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
        <div className="quant-chart-axis quant-chart-axis-x"><span>09:15</span><span>11:00</span><span>12:45</span><span>14:30</span><span>15:30</span></div>
      </div>
      <div className="quant-chart-footer"><span><span className="quant-status-dot muted" /> No provider selected</span><span>OHLCV · Indicators · Drawing tools ready</span></div>
    </section>
  );
}

function OrderTicket({ onConnect }) {
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('Market');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('Connect a broker before placing an order.');
  };

  return (
    <section className="quant-panel quant-order-panel">
      <div className="quant-order-heading">
        <div><span className="quant-eyebrow">ORDER TICKET</span><h2>Place order</h2></div>
        <span className="quant-mode-pill">PAPER</span>
      </div>
      <div className="quant-order-tabs">
        <button className={side === 'buy' ? 'active buy' : ''} onClick={() => setSide('buy')}><ArrowUpRight size={15} /> Buy</button>
        <button className={side === 'sell' ? 'active sell' : ''} onClick={() => setSide('sell')}><ArrowDownRight size={15} /> Sell</button>
      </div>
      <form className="quant-order-form" onSubmit={handleSubmit}>
        <label>Instrument
          <button type="button" className="quant-field-select"><span><span className="quant-symbol-mark blue small">N</span> NIFTY 50</span><ChevronDown size={15} /></button>
        </label>
        <div className="quant-form-row">
          <label>Order type
            <select value={orderType} onChange={(event) => setOrderType(event.target.value)}><option>Market</option><option>Limit</option><option>Stop loss</option></select>
          </label>
          <label>Quantity
            <input type="number" min="1" placeholder="Enter qty" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
        </div>
        <div className="quant-order-summary"><span>Estimated value</span><strong>—</strong></div>
        {message && <div className="quant-inline-alert"><InfoIcon />{message}<button type="button" onClick={onConnect}>Connect</button></div>}
        <button className={`quant-button quant-order-submit ${side}`} type="submit">{side === 'buy' ? 'Buy' : 'Sell'} NIFTY 50 <ArrowUpRight size={15} /></button>
        <p className="quant-order-disclaimer"><ShieldCheck size={13} /> Orders are disabled until a broker is securely connected.</p>
      </form>
    </section>
  );
}

function InfoIcon() {
  return <span className="quant-alert-icon"><Link2 size={13} /></span>;
}

function Overview({ onConnect, setSection }) {
  const [timeframe, setTimeframe] = useState('1D');
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY 50');
  const [watchlist, setWatchlist] = useState(watchlistSymbols.slice(0, 4));
  const [search, setSearch] = useState('');
  const filteredWatchlist = watchlist.filter((item) => item.symbol.toLowerCase().includes(search.toLowerCase()));

  const removeSymbol = (symbol) => setWatchlist((items) => items.filter((item) => item.symbol !== symbol));

  return (
    <>
      <section className="quant-welcome">
        <div>
          <div className="quant-breadcrumb"><span>KEPWE QUANT</span><ChevronRight size={13} /> Workspace</div>
          <h1>Good morning, <span>trader.</span></h1>
          <p>Your command center for disciplined, data-led decisions.</p>
        </div>
        <div className="quant-welcome-actions"><span className="quant-environment"><span className="quant-status-dot muted" /> Paper workspace</span><button className="quant-button quant-button-primary" onClick={onConnect}><Link2 size={15} /> Connect broker</button></div>
      </section>

      <div className="quant-banner">
        <div className="quant-banner-icon"><Link2 size={17} /></div>
        <div><strong>Your trading workspace is ready.</strong><p>Connect Lemonn or another supported broker when you’re ready to load live market data. We never invent account or price data.</p></div>
        <button className="quant-banner-link" onClick={() => setSection('broker')}>View connection options <ChevronRight size={15} /></button>
      </div>

      <div className="quant-metric-grid">
        {[
          { label: 'Portfolio value', icon: WalletCards, note: 'Awaiting connection' },
          { label: 'Available margin', icon: Gauge, note: 'Awaiting connection' },
          { label: 'Day P&L', icon: TrendingUp, note: 'No trading session' },
          { label: 'Open positions', icon: BriefcaseBusiness, note: 'No positions yet' },
        ].map(({ label, icon: Icon, note }) => (
          <div className="quant-metric-card" key={label}><div className="quant-metric-top"><span>{label}</span><Icon size={16} /></div><strong>—</strong><small>{note}</small></div>
        ))}
      </div>

      <div className="quant-overview-grid">
        <div className="quant-panel quant-watchlist-panel">
          <PanelHeader eyebrow="MARKET PULSE" title="Live watchlist" icon={Activity} action="Manage" onAction={() => setSection('watchlist')} />
          <div className="quant-watchlist-tools"><label className="quant-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search symbol" /></label><button className="quant-icon-button" aria-label="Add symbol" onClick={() => setSection('watchlist')}><Plus size={16} /></button></div>
          <div className="quant-watchlist">
            {filteredWatchlist.map((item) => (
              <button className={`quant-watch-row ${selectedSymbol === item.symbol ? 'selected' : ''}`} key={item.symbol} onClick={() => setSelectedSymbol(item.symbol)}>
                <span className={`quant-symbol-mark ${item.tone}`}>{item.symbol.slice(0, 1)}</span><span className="quant-watch-name"><strong>{item.symbol}</strong><small>{item.exchange}</small></span><span className="quant-watch-price">—<small>Awaiting feed</small></span><span className="quant-watch-change">—</span><MoreHorizontal size={16} onClick={(event) => { event.stopPropagation(); removeSymbol(item.symbol); }} />
              </button>
            ))}
            {!filteredWatchlist.length && <EmptyData title="No symbols found" description="Try a different search or add an instrument to your watchlist." action={false} compact />}
          </div>
          <div className="quant-panel-footer"><button onClick={() => setSection('watchlist')}>Open full watchlist <ChevronRight size={14} /></button><span>0/0 providers connected</span></div>
        </div>
        <ChartWorkspace symbol={selectedSymbol} timeframe={timeframe} setTimeframe={setTimeframe} onConnect={onConnect} />
        <OrderTicket onConnect={onConnect} />
      </div>

      <div className="quant-lower-grid">
        <section className="quant-panel quant-table-panel">
          <PanelHeader eyebrow="TRADING" title="Open positions" icon={BriefcaseBusiness} action="View all" onAction={() => setSection('positions')} />
          <EmptyData title="No open positions" description="Your live positions will appear here after your first connected trade." onConnect={onConnect} />
        </section>
        <section className="quant-panel quant-table-panel">
          <PanelHeader eyebrow="ACTIVITY" title="Recent orders" icon={Clock3} action="Order history" onAction={() => setSection('orders')} />
          <EmptyData title="No orders yet" description="Order history will populate once a broker account is connected." onConnect={onConnect} />
        </section>
      </div>
    </>
  );
}

function WatchlistView({ onConnect }) {
  const [symbols, setSymbols] = useState(watchlistSymbols);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const visible = symbols.filter((item) => item.symbol.toLowerCase().includes(query.toLowerCase()));
  return <PageView eyebrow="MARKET DATA" title="Live watchlist" description="Track the instruments that matter to your trading plan." action={<button className="quant-button quant-button-primary" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> Add symbol</button>}>
    {showAdd && <div className="quant-add-symbol"><Search size={15} /><input autoFocus placeholder="Search NSE symbol to add" onChange={(event) => setQuery(event.target.value)} value={query} /><button onClick={() => setShowAdd(false)}><X size={16} /></button></div>}
    <div className="quant-panel quant-full-panel"><div className="quant-list-toolbar"><label className="quant-search wide"><Search size={14} /><input placeholder="Filter watchlist" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="quant-feed-note"><span className="quant-status-dot muted" /> Provider disconnected</span></div><div className="quant-table-wrap"><table className="quant-table"><thead><tr><th>Instrument</th><th>Last price</th><th>Change</th><th>Day range</th><th>Volume</th><th /></tr></thead><tbody>{visible.map((item) => <tr key={item.symbol}><td><span className={`quant-symbol-mark ${item.tone}`}>{item.symbol.slice(0, 1)}</span><span className="quant-table-name"><strong>{item.symbol}</strong><small>{item.exchange}</small></span></td><td>—</td><td className="quant-muted">—</td><td>—</td><td>—</td><td><button className="quant-icon-button" onClick={() => setSymbols(symbols.filter((entry) => entry.symbol !== item.symbol))}><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div>{!visible.length && <EmptyData title="Your watchlist is empty" description="Add instruments to start building your market view." action={false} />}</div>
    <div className="quant-source-note"><HelpCircle size={14} /> Live prices and quote statistics will be sourced only from a connected broker or approved market data provider.</div>
  </PageView>;
}

function MarketsView({ onConnect, setSection }) {
  return <PageView eyebrow="MARKET DATA" title="Markets" description="A focused view across Indian indices and equities." action={<button className="quant-button quant-button-secondary" onClick={onConnect}><RefreshCw size={15} /> Refresh feed</button>}>
    <div className="quant-market-tabs">{['NIFTY 50', 'BANK NIFTY', 'Stocks'].map((label, index) => <button key={label} className={index === 0 ? 'active' : ''} onClick={() => index === 2 ? setSection('watchlist') : null}>{label}</button>)}</div>
    <div className="quant-markets-grid">{marketGroups.map((group) => <section className="quant-panel quant-market-group" key={group.label}><PanelHeader eyebrow="NSE" title={group.label} icon={BarChart3} />{group.items.map((item) => <div className="quant-market-row" key={item.symbol}><span className={`quant-symbol-mark ${item.tone}`}>{item.symbol.slice(0, 1)}</span><span><strong>{item.symbol}</strong><small>{item.exchange}</small></span><b>—</b><em>—</em><button className="quant-icon-button" onClick={onConnect}><ExternalLink size={15} /></button></div>)}</section>)}</div>
    <ChartWorkspace symbol="NIFTY 50" timeframe="1D" setTimeframe={() => {}} onConnect={onConnect} />
  </PageView>;
}

function EmptyTableView({ type, onConnect }) {
  const config = {
    portfolio: ['Portfolio & funds', 'A single view of capital, margin and allocation.', WalletCards, 'Connect your broker to view portfolio value and funds.'],
    positions: ['Positions', 'Monitor open intraday and delivery positions.', BriefcaseBusiness, 'Open positions will be shown here when your account is connected.'],
    orders: ['Orders & history', 'Review submitted orders and execution history.', ListFilter, 'Orders will appear here after a provider connection is active.'],
    holdings: ['Holdings', 'Track delivery holdings, average price and allocation.', CircleDollarSign, 'Holdings will load securely from your connected broker.'],
  }[type];
  const InfoIconComponent = config[2];
  const [tab, setTab] = useState(type === 'orders' ? 'Open orders' : 'Overview');
  return <PageView eyebrow="TRADING" title={config[0]} description={config[1]} action={<button className="quant-button quant-button-primary" onClick={onConnect}><Link2 size={15} /> Connect broker</button>}>
    <div className="quant-section-tabs">{(type === 'orders' ? ['Open orders', 'Order history'] : ['Overview', 'Allocation', 'Transactions']).map((label) => <button className={tab === label ? 'active' : ''} key={label} onClick={() => setTab(label)}>{label}</button>)}</div>
    <div className="quant-panel quant-empty-state-panel"><EmptyData title={config[3]} description="KEPWE QUANT never fabricates financial data. Connect a provider to populate this workspace." onConnect={onConnect} /></div>
    <div className="quant-two-card-grid"><section className="quant-panel quant-mini-info"><div className="quant-info-icon"><InfoIconComponent size={18} /></div><div><strong>Secure provider sync</strong><p>Read-only account sync is designed to keep balances and positions aligned with your broker.</p></div></section><section className="quant-panel quant-mini-info"><div className="quant-info-icon teal"><ShieldCheck size={18} /></div><div><strong>Risk-first by default</strong><p>Trading controls stay locked until connection and risk preferences are explicitly configured.</p></div></section></div>
  </PageView>;
}

function AnalyticsView({ onConnect }) {
  return <PageView eyebrow="INSIGHTS" title="P&L analytics" description="Understand performance, risk and consistency over time." action={<button className="quant-button quant-button-secondary" onClick={onConnect}><Download size={15} /> Export report</button>}>
    <div className="quant-analytics-kpis">{['Net P&L', 'Win rate', 'Max drawdown', 'Sharpe ratio'].map((label) => <div className="quant-metric-card" key={label}><span>{label}</span><strong>—</strong><small>Not enough connected data</small></div>)}</div>
    <div className="quant-panel quant-analytics-chart"><PanelHeader eyebrow="PERFORMANCE" title="Cumulative returns" icon={TrendingUp} /><div className="quant-chart-canvas short"><div className="quant-chart-grid"><i /><i /><i /><i /><i /><i /></div><div className="quant-chart-empty"><div className="quant-chart-empty-mark"><TrendingUp size={20} /></div><strong>Analytics will appear after trading activity</strong><span>Connect a broker to calculate P&L from verified fills.</span><button className="quant-button quant-button-secondary quant-button-small" onClick={onConnect}>Connect broker <Link2 size={14} /></button></div></div></div>
    <div className="quant-two-card-grid"><section className="quant-panel quant-insight-card"><span className="quant-insight-accent blue" /><Sparkles size={17} /><strong>Built for honest performance review</strong><p>We distinguish unavailable data from zero performance, so your reports stay decision-ready.</p></section><section className="quant-panel quant-insight-card"><span className="quant-insight-accent green" /><Target size={17} /><strong>Measure process, not just outcome</strong><p>Strategy attribution and risk-adjusted measures are ready for your connected trade history.</p></section></div>
  </PageView>;
}

function StrategiesView({ onConnect, setSection }) {
  return <PageView eyebrow="QUANT LAB" title="Algo strategies" description="Create, monitor and govern systematic strategies from one workspace." action={<button className="quant-button quant-button-primary" onClick={() => setSection('builder')}><Plus size={15} /> New strategy</button>}>
    <div className="quant-strategy-grid"><section className="quant-panel quant-strategy-card featured"><div className="quant-strategy-card-top"><span className="quant-strategy-mark"><Bot size={18} /></span><span className="quant-mode-pill">TEMPLATE</span></div><h3>Start with a strategy canvas</h3><p>Define signals, sizing and risk rules before you connect execution.</p><button className="quant-button quant-button-secondary quant-button-small" onClick={() => setSection('builder')}>Open builder <ChevronRight size={14} /></button></section><section className="quant-panel quant-strategy-card"><div className="quant-strategy-card-top"><span className="quant-strategy-mark violet"><Zap size={18} /></span><span className="quant-mode-pill">READY</span></div><h3>Paper trading sandbox</h3><p>Validate strategies with a provider-approved paper environment.</p><button className="quant-button quant-button-ghost quant-button-small" onClick={onConnect}>Connect provider <Link2 size={14} /></button></section><section className="quant-panel quant-strategy-card"><div className="quant-strategy-card-top"><span className="quant-strategy-mark orange"><ShieldCheck size={18} /></span><span className="quant-mode-pill">GUARDED</span></div><h3>Risk guardrails</h3><p>Set daily loss, exposure and kill-switch rules before execution.</p><button className="quant-button quant-button-ghost quant-button-small" onClick={() => setSection('risk')}>Configure risk <ChevronRight size={14} /></button></section></div>
    <div className="quant-panel quant-empty-state-panel"><EmptyData title="No strategies connected" description="Strategy runs and lifecycle status will appear here after you create a strategy and connect a provider." onConnect={onConnect} /></div>
  </PageView>;
}

function BuilderView({ onConnect }) {
  const [step, setStep] = useState('signal');
  const [ran, setRan] = useState(false);
  const steps = [{ key: 'signal', label: 'Signal logic', icon: Zap }, { key: 'universe', label: 'Universe', icon: BarChart3 }, { key: 'sizing', label: 'Position sizing', icon: Target }, { key: 'risk', label: 'Risk rules', icon: ShieldCheck }];
  return <PageView eyebrow="QUANT LAB" title="Strategy builder" description="Design your strategy logic before it ever touches a live order." action={<button className="quant-button quant-button-primary" onClick={() => setRan(true)}><PlayIcon /> {ran ? 'Backtest queued' : 'Run backtest'}</button>}>
    <div className="quant-builder-layout"><div className="quant-panel quant-builder-steps"><span className="quant-eyebrow">WORKFLOW</span>{steps.map(({ key, label, icon: Icon }, index) => <button key={key} className={step === key ? 'active' : ''} onClick={() => setStep(key)}><span className="quant-step-number">{index + 1}</span><Icon size={16} /><span>{label}</span><ChevronRight size={14} /></button>)}</div><div className="quant-panel quant-builder-canvas"><div className="quant-builder-heading"><div><span className="quant-eyebrow">STEP {steps.findIndex((item) => item.key === step) + 1} OF 4</span><h2>{steps.find((item) => item.key === step)?.label}</h2></div><span className="quant-draft-pill"><span /> Unsaved draft</span></div><div className="quant-builder-fields">{step === 'signal' && <><Field label="Entry condition" placeholder="Select an indicator or expression" /><Field label="Exit condition" placeholder="Select an exit trigger" /><div className="quant-builder-note"><Sparkles size={16} /><span><strong>Keep it explainable.</strong> Build rules you can inspect and audit before execution.</span></div></>}{step === 'universe' && <><Field label="Market" placeholder="NSE equities" /><Field label="Instrument filter" placeholder="Add a universe rule" /><Field label="Rebalance frequency" placeholder="Daily" /></>}{step === 'sizing' && <><Field label="Sizing model" placeholder="Equal weight" /><Field label="Max position size" placeholder="Set a percentage" /><Field label="Capital allocation" placeholder="Use available capital" /></>}{step === 'risk' && <><Field label="Daily loss limit" placeholder="Set a rupee or percentage limit" /><Field label="Max open positions" placeholder="Set a maximum" /><Field label="Kill switch" placeholder="Require manual re-enable" /></>}</div><div className="quant-builder-footer"><span>{ran ? 'Backtest request is waiting for a connected data provider.' : 'Draft changes are local until you save the strategy.'}</span><button className="quant-button quant-button-secondary quant-button-small" onClick={onConnect}><Link2 size={14} /> Connect provider</button></div></div></div>
  </PageView>;
}

function Field({ label, placeholder }) {
  return <label className="quant-builder-field">{label}<button type="button"><span>{placeholder}</span><ChevronDown size={15} /></button></label>;
}

function PlayIcon() {
  return <span className="quant-play-icon">▶</span>;
}

function RiskView({ onConnect }) {
  const [armed, setArmed] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('');
  return <PageView eyebrow="QUANT LAB" title="Risk management" description="Make your guardrails explicit before enabling execution." action={<button className="quant-button quant-button-primary" onClick={onConnect}><Link2 size={15} /> Connect broker</button>}>
    <div className="quant-risk-layout"><section className="quant-panel quant-risk-score"><div className="quant-risk-ring"><ShieldCheck size={24} /><span>—</span></div><span className="quant-eyebrow">RISK STATUS</span><h2>Not configured</h2><p>Complete your risk profile and connect a provider to enable a live risk score.</p><button className={`quant-switch ${armed ? 'active' : ''}`} onClick={() => setArmed(!armed)}><span /><b>{armed ? 'Controls armed' : 'Controls not armed'}</b></button></section><section className="quant-panel quant-risk-controls"><PanelHeader eyebrow="GUARDRAILS" title="Trading limits" icon={SlidersHorizontal} /><label className="quant-control-row"><span><strong>Daily loss limit</strong><small>Stop new orders when this threshold is reached.</small></span><input placeholder="₹ —" value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} /></label><label className="quant-control-row"><span><strong>Max portfolio exposure</strong><small>Keep total deployed capital within a defined band.</small></span><button className="quant-control-select">Not set <ChevronDown size={14} /></button></label><label className="quant-control-row"><span><strong>Emergency kill switch</strong><small>Require confirmation before execution resumes.</small></span><button className="quant-switch active"><span /><b>On</b></button></label><div className="quant-risk-footer"><ShieldCheck size={14} /> Saved settings apply only after a broker connection is verified.</div></section></div>
  </PageView>;
}

function BrokerView() {
  const [connectionNotice, setConnectionNotice] = useState('');
  return <PageView eyebrow="SYSTEM" title="Broker connection" description="Securely connect a supported provider when you are ready to trade." action={<button className="quant-button quant-button-secondary" onClick={() => setConnectionNotice('No provider connection was attempted. The adapter is not configured yet.')}><RefreshCw size={15} /> Check status</button>}>
    <div className="quant-broker-hero"><div className="quant-broker-hero-icon"><Link2 size={21} /></div><div><span className="quant-eyebrow">CONNECTION STATUS</span><h2>No broker connected</h2><p>Your market and account workspace is intentionally paused until a provider is connected.</p></div><span className="quant-connection-pill"><span />Disconnected</span></div>
    <div className="quant-broker-grid"><section className="quant-panel quant-broker-card primary"><div className="quant-broker-card-top"><span className="quant-broker-logo">L</span><span className="quant-coming-pill">INTEGRATION READY</span></div><h3>Lemonn</h3><p>Prepare your Lemonn connection here when live API credentials and the approved integration flow are available.</p><div className="quant-broker-note"><ShieldCheck size={15} /><span>Credentials are handled through secure environment configuration. No API endpoint is assumed here.</span></div><button className="quant-button quant-button-primary" onClick={() => setConnectionNotice('Lemonn connection flow is pending secure adapter wiring. No connection was attempted.')}>Connect Lemonn <ChevronRight size={15} /></button>{connectionNotice && <div className="quant-connection-alert"><InfoIcon />{connectionNotice}</div>}</section><section className="quant-panel quant-broker-card muted"><div className="quant-broker-card-top"><span className="quant-broker-logo gray">+</span><span className="quant-coming-pill">COMING SOON</span></div><h3>More brokers</h3><p>Additional broker adapters can be added without changing your workspace or strategy definitions.</p><button className="quant-button quant-button-ghost" disabled>Request a provider <ArrowUpRight size={15} /></button></section></div>
    <div className="quant-source-note"><HelpCircle size={14} /> Connection UI is ready for a future Lemonn adapter. Live authentication, scopes and API routes will be added separately.</div>
  </PageView>;
}

function NotificationsView() {
  const [read, setRead] = useState(false);
  return <PageView eyebrow="SYSTEM" title="Notifications" description="Stay close to execution, risk and connection events." action={<button className="quant-button quant-button-secondary" onClick={() => setRead(true)}><Bell size={15} /> Mark all read</button>}><div className="quant-panel quant-notifications">{['Provider connection events', 'Risk guardrail alerts', 'Order and execution updates'].map((item, index) => <div className={`quant-notification-row ${read ? 'read' : ''}`} key={item}><span className="quant-notification-icon">{index === 0 ? <Link2 size={16} /> : index === 1 ? <ShieldCheck size={16} /> : <Activity size={16} />}</span><span><strong>{item}</strong><small>{read ? 'No new notifications' : 'Notifications will appear after your workspace is connected.'}</small></span><span className="quant-notification-state">{read ? 'Read' : 'Waiting'}</span></div>)}</div></PageView>;
}

function SettingsView() {
  const [saved, setSaved] = useState(false);
  return <PageView eyebrow="SYSTEM" title="Settings" description="Tune your workspace preferences and notification controls." action={<button className="quant-button quant-button-primary" onClick={() => setSaved(true)}><Settings2 size={15} /> {saved ? 'Saved' : 'Save changes'}</button>}><div className="quant-settings-layout"><section className="quant-panel quant-settings-nav"><button className="active">Workspace preferences<ChevronRight size={14} /></button><button>Notifications<ChevronRight size={14} /></button><button>Security & sessions<ChevronRight size={14} /></button><button>Data permissions<ChevronRight size={14} /></button></section><section className="quant-panel quant-settings-form"><PanelHeader eyebrow="PREFERENCES" title="Workspace preferences" icon={Settings2} /><label className="quant-control-row"><span><strong>Default landing page</strong><small>Choose the first screen when you enter KEPWE QUANT.</small></span><button className="quant-control-select">Dashboard <ChevronDown size={14} /></button></label><label className="quant-control-row"><span><strong>Price refresh preference</strong><small>Applied when a live market provider is connected.</small></span><button className="quant-control-select">Auto <ChevronDown size={14} /></button></label><label className="quant-control-row"><span><strong>Order confirmations</strong><small>Require confirmation before submitting an order.</small></span><button className="quant-switch active"><span /><b>On</b></button></label><div className="quant-settings-footnote"><ShieldCheck size={14} /> Sensitive account data is never stored in local UI state.</div></section></div></PageView>;
}

function PageView({ eyebrow, title, description, action, children }) {
  return <div className="quant-page-view"><section className="quant-page-intro"><div><span className="quant-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="quant-page-action">{action}</div>}</section>{children}</div>;
}

export default function QuantDashboardPage() {
  const { authState } = useApp();
  const { section: routeSection } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract requested section from params or pathname
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
  const [connected, setConnected] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const activeSection = validSections.includes(parsedSection) ? parsedSection : 'dashboard';
  const activeLabel = formatSection(activeSection);
  
  const goTo = (section) => {
    navigate(section === 'dashboard' ? '/quant/dashboard' : `/quant/dashboard/${section}`);
    setMobileNavOpen(false);
  };
  const sharedProps = { onConnect: () => goTo('broker'), setSection: goTo };

  const page = useMemo(() => {
    if (activeSection === 'dashboard') return <Overview {...sharedProps} />;
    if (activeSection === 'watchlist') return <WatchlistView {...sharedProps} />;
    if (activeSection === 'markets') return <MarketsView {...sharedProps} />;
    if (['portfolio', 'positions', 'orders', 'holdings'].includes(activeSection)) return <EmptyTableView type={activeSection} {...sharedProps} />;
    if (activeSection === 'analytics') return <AnalyticsView {...sharedProps} />;
    if (activeSection === 'strategies') return <StrategiesView {...sharedProps} />;
    if (activeSection === 'builder') return <BuilderView {...sharedProps} />;
    if (activeSection === 'risk') return <RiskView {...sharedProps} />;
    if (activeSection === 'broker') return <BrokerView connected={connected} setConnected={setConnected} />;
    if (activeSection === 'notifications') return <NotificationsView />;
    return <SettingsView />;
  }, [activeSection, connected]);

  return <div className="quant-shell">
    <MarketTape />
    <aside className={`quant-sidebar ${mobileNavOpen ? 'open' : ''}`}>
      <div className="quant-brand"><Link to="/"><span className="quant-brand-mark">K</span><span><strong>KEPWE</strong><small>QUANT</small></span></Link><button className="quant-close-nav" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="quant-sidebar-workspace"><span className="quant-sidebar-label">Workspace</span><button onClick={() => goTo('dashboard')}><span className="quant-avatar">Q</span><span><strong>Quant workspace</strong><small>Paper environment</small></span><ChevronDown size={14} /></button></div>
      <nav className="quant-sidebar-nav">{navSections.map((section) => <div className="quant-nav-group" key={section.label}><span className="quant-sidebar-label">{section.label}</span>{section.items.map(({ key, label, icon: Icon }) => <button className={activeSection === key ? 'active' : ''} key={key} onClick={() => goTo(key)}><Icon size={16} /><span>{label}</span>{key === 'notifications' && <i />}</button>)}</div>)}</nav>
      <div className="quant-sidebar-bottom">
        <button onClick={() => goTo('broker')}><Link2 size={15} /><span><strong>{connected ? 'Provider connected' : 'Connect a broker'}</strong><small>{connected ? 'Ready for sync' : 'Unlock live data'}</small></span><ChevronRight size={14} /></button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          <Link to="/quant" style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}><ArrowDownRight size={13} /> Quant Marketing</Link>
          <Link to="/" style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}><ArrowDownRight size={13} /> Back to KEPWE</Link>
        </div>
      </div>
    </aside>
    {mobileNavOpen && <button className="quant-mobile-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
     <main className="quant-main">
       <header className="quant-topbar"><button className="quant-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="quant-topbar-title"><span className="quant-topbar-kicker">KEPWE QUANT</span><strong>{activeLabel}</strong></div><div className="quant-topbar-actions"><button className="quant-command-button" onClick={() => setCommandOpen(!commandOpen)}><Search size={15} /><span>Search workspace</span><kbd><Command size={11} /> K</kbd></button><button className="quant-topbar-icon" onClick={() => goTo('notifications')} aria-label="Notifications"><Bell size={17} /><i /></button><div className="quant-profile-control"><span className="quant-profile-label">Profile</span>{authState?.isLoggedIn && <UserMenu />}</div></div></header>
      {commandOpen && <div className="quant-command-popover"><Search size={15} /><input autoFocus placeholder="Search sections, symbols or settings" onKeyDown={(event) => event.key === 'Escape' && setCommandOpen(false)} /><button onClick={() => { goTo('watchlist'); setCommandOpen(false); }}>Open watchlist</button><button onClick={() => { goTo('builder'); setCommandOpen(false); }}>Open strategy builder</button></div>}
      <div className="quant-content">{page}</div>
    </main>
  </div>;
}