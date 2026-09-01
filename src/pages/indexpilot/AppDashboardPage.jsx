import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import VerdictDial from '../../components/common/VerdictDial';
import VerdictBadge from '../../components/common/VerdictBadge';
import { ArrowRight } from 'lucide-react';

// Helper: display a numeric value or '—' when null/undefined.
const fmt = (v, suffix = '') => (v !== null && v !== undefined) ? `${v}${suffix}` : '—';

const AppDashboardPage = () => {
  const { activeIndex, setActiveIndex, currentIndexData, userRiskProfile, marketIndices } = useApp();
  const indexList = Object.values(marketIndices || {});

  // Upstox data unavailable — show a clear, honest error state.
  if (!currentIndexData) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '24px 20px 80px', fontFamily: "var(--font-ui)" }}>
        <div style={{ maxWidth: '1250px', margin: '0 auto', textAlign: 'center', paddingTop: '80px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📡</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
            Market Data Unavailable
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '520px', margin: '0 auto' }}>
            KEPWE does not fabricate market data. The Upstox market-data provider did not return
            index data. The access token may have expired or Upstox may be temporarily unreachable.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '24px',
              background: '#214ECF',
              color: '#FFFFFF',
              border: 'none',
              padding: '11px 28px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.925rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(33, 78, 207, 0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Upstox does not provide KEPWE analytics (iqScore, verdict, trend, etc.).
  // These are null from the live feed. Render them with graceful fallbacks.
  const hasAnalytics = currentIndexData.iqScore !== null;

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '24px 20px 80px', fontFamily: "var(--font-ui)" }}>
      <div style={{ maxWidth: '1250px', margin: '0 auto' }}>

        {/* App Top Bar / Sub-Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#214ECF', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              01 PULSE
            </span>

            {/* Live data source badge */}
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              color: '#166534',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
              LIVE · UPSTOX
            </div>

            {/* Index Selector Tabs */}
            <div style={{ background: '#F1F5F9', padding: '3px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', gap: '4px' }}>
              {['NIFTY', 'BANKNIFTY', 'FINNIFTY'].map((idx) => {
                const isSelected = activeIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveIndex(idx)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      background: isSelected ? '#214ECF' : 'transparent',
                      color: isSelected ? '#FFFFFF' : '#64748B',
                      boxShadow: isSelected ? '0 2px 8px rgba(33, 78, 207, 0.25)' : 'none',
                      transition: 'all 180ms ease'
                    }}
                  >
                    {idx}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#64748B' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }}></span>
              LIVE FEED
            </span>
            <span style={{ color: '#94A3B8', fontFamily: 'monospace' }}>UPDATED: {currentIndexData.lastUpdated}</span>
          </div>
        </div>

        {/* Index Price & Snapshot Header Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '24px 28px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 700 }}>{currentIndexData.name}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '4px' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                {currentIndexData.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: currentIndexData.change >= 0 ? '#214ECF' : '#DC2626', fontFamily: 'monospace' }}>
                {currentIndexData.change >= 0 ? '▲' : '▼'} {Math.abs(currentIndexData.change).toFixed(2)} ({Math.abs(currentIndexData.changePercent).toFixed(2)}%)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            {/* VIX: not provided by Upstox index quotes endpoint */}
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '2px' }}>INDIA VIX</span>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#D97706', fontFamily: 'monospace' }}>
                {fmt(currentIndexData.vix)}
              </div>
            </div>

            {/* IQ Score: KEPWE analytics, not from Upstox */}
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '2px' }}>KEPWE IQ SCORE</span>
              <div style={{ fontSize: '20px', fontWeight: 800, color: hasAnalytics ? '#214ECF' : '#94A3B8', fontFamily: 'monospace' }}>
                {currentIndexData.iqScore !== null ? `${currentIndexData.iqScore}/100` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* VERDICT DIAL — only render when analytics are available */}
        {hasAnalytics ? (
          <div style={{ marginBottom: '24px' }}>
            <VerdictDial
              verdict={currentIndexData.verdict}
              score={currentIndexData.iqScore}
              confidence={currentIndexData.confidence}
              title={currentIndexData.verdictTitle}
              reason={currentIndexData.verdictReason}
            />
          </div>
        ) : (
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}>
            <div style={{ fontSize: '1.4rem' }}>🧠</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                KEPWE IQ Analytics Not Available
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
                Verdict, IQ Score, trend, and regime analytics are computed by the KEPWE Intelligence Engine and are not supplied by the Upstox price feed.
              </div>
            </div>
          </div>
        )}

        {/* 3-COLUMN METRIC GRID & WATCHLIST */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>

          {/* Index Technical Indicators */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)'
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
              INDEX REGIME & METRICS
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                <span style={{ color: '#64748B' }}>Trend</span>
                <span style={{ fontWeight: 700, color: currentIndexData.trend === 'Bullish' ? '#214ECF' : currentIndexData.trend === null ? '#94A3B8' : '#DC2626' }}>
                  {fmt(currentIndexData.trend)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                <span style={{ color: '#64748B' }}>Momentum Score</span>
                <span style={{ fontWeight: 700, color: currentIndexData.momentum !== null ? '#0F172A' : '#94A3B8', fontFamily: 'monospace' }}>
                  {currentIndexData.momentum !== null ? `${currentIndexData.momentum}/100` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                <span style={{ color: '#64748B' }}>Volatility Regime</span>
                <span style={{ fontWeight: 700, color: currentIndexData.volatility !== null ? '#D97706' : '#94A3B8' }}>
                  {fmt(currentIndexData.volatility)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                <span style={{ color: '#64748B' }}>Support / Resistance</span>
                <span style={{ fontWeight: 700, color: currentIndexData.support !== null ? '#214ECF' : '#94A3B8', fontFamily: 'monospace' }}>
                  {currentIndexData.support !== null
                    ? `${currentIndexData.support.toLocaleString('en-IN')} / ${currentIndexData.resistance?.toLocaleString('en-IN')}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Market Breadth & Cues */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)'
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
              BREADTH & GLOBAL CUES
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Market Breadth (A/D Ratio)</span>
                  <strong style={{ color: currentIndexData.advanceDecline !== null ? '#214ECF' : '#94A3B8', fontWeight: 700, fontFamily: 'monospace' }}>
                    {fmt(currentIndexData.advanceDecline)}
                  </strong>
                </div>
                <div style={{ background: '#F1F5F9', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '65%', height: '100%', background: '#214ECF', borderRadius: '3px' }}></div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748B' }}>Global Cues (SGX Nifty)</span>
                  <strong style={{ color: currentIndexData.sgxCues !== null ? '#214ECF' : '#94A3B8', fontWeight: 700, fontFamily: 'monospace' }}>
                    {currentIndexData.sgxCues !== null ? `+${currentIndexData.sgxCues}%` : '—'}
                  </strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748B' }}>IV Percentile</span>
                  <strong style={{ color: currentIndexData.ivPercentile !== null ? '#D97706' : '#94A3B8', fontWeight: 700, fontFamily: 'monospace' }}>
                    {currentIndexData.ivPercentile !== null ? `${currentIndexData.ivPercentile}th percentile` : '—'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Watchlist Summary Drawer */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)'
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
              INDEX WATCHLIST
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {indexList.map((idx) => {
                const isSelected = activeIndex === idx.symbol;
                return (
                  <div
                    key={idx.symbol}
                    onClick={() => setActiveIndex(idx.symbol)}
                    style={{
                      background: isSelected ? '#EFF6FF' : '#F8FAFC',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #214ECF' : '1px solid #E2E8F0',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 180ms ease'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{idx.symbol}</div>
                      <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                        {idx.price != null ? idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                      </span>
                    </div>
                    {/* verdict is null from live Upstox feed — VerdictBadge falls through to NO_TRADE.
                        Only render if verdict is known to avoid misleading "NO TRADE" on a live index. */}
                    {idx.verdict !== null && <VerdictBadge state={idx.verdict} size="small" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Today's Setups CTA Banner */}
        <div style={{
          background: '#0F172A',
          borderRadius: '12px',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 8px 25px rgba(15, 23, 42, 0.12)'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              View Today's Risk-Filtered Trade Setups
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '13px', margin: 0 }}>
              Filtered for your max loss tolerance: <strong style={{ color: '#214ECF', fontWeight: 700, fontFamily: 'monospace' }}>₹{userRiskProfile.maxAcceptableLoss.toLocaleString('en-IN')}</strong>
            </p>
          </div>
          <Link
            to="/app/setups"
            style={{
              background: '#214ECF',
              color: '#FFFFFF',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(33, 78, 207, 0.3)',
              transition: 'background-color 180ms ease'
            }}
          >
            <span>Open Strategy Engine</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AppDashboardPage;
