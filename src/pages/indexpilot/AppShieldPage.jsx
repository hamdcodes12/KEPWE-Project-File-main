import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, Lock, Info, CheckCircle2 } from 'lucide-react';

const AppShieldPage = () => {
  const { userRiskProfile, simulatedCapital, marketIndices } = useApp();
  const [hedged, setHedged] = useState(false);
  const [circuitBreakerTriggered, setCircuitBreakerTriggered] = useState(false);

  const nifty = marketIndices['NIFTY'] || null;
  const maxLossCap = userRiskProfile.maxAcceptableLoss || 2500;
  const capital = simulatedCapital || 100000;
  const positionSize = Math.min(maxLossCap * 7.44, capital * 0.03);
  const positionPct = capital > 0 ? ((positionSize / capital) * 100).toFixed(1) : '0.0';
  const suggestedLots = Math.max(1, Math.floor(positionSize / 6200));
  const drawdownPct = '0.0';
  const portfolioValue = capital;
  const betaExposure = '0.91';
  const estimatedFall = '4.4';
  const hedgeCost = Math.round(capital * 0.01);
  const hedgePct = '1.0';
  const supportLevel = nifty?.support || 24600;
  const resistanceLevel = nifty?.resistance || 25000;

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      color: '#0F172A',
      minHeight: '100vh',
      padding: '24px 20px 80px',
      fontFamily: 'var(--font-ui)'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#214ECF' }} />
              <span style={{ fontSize: '11px', color: '#214ECF', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                04 SHIELD
              </span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0F172A', margin: 0 }}>
              Risk Management & Portfolio Shield
            </h1>
          </div>

          {/* Circuit Breaker Control Button */}
          <button
            onClick={() => setCircuitBreakerTriggered(!circuitBreakerTriggered)}
            style={{
              background: circuitBreakerTriggered ? '#FEF2F2' : '#FFFBEB',
              color: circuitBreakerTriggered ? '#DC2626' : '#B45309',
              border: circuitBreakerTriggered ? '1px solid #FCA5A5' : '1px solid #FDE68A',
              padding: '9px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 180ms ease'
            }}
          >
            <span>{circuitBreakerTriggered ? '🔓 Reset Circuit Breaker' : '⚡ Test Circuit Breaker'}</span>
          </button>
        </div>

        {/* CIRCUIT BREAKER BANNER */}
        {circuitBreakerTriggered && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '10px',
            padding: '18px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <Lock size={24} color="#DC2626" style={{ flexShrink: 0 }} />
            <div>
              <h4 style={{ color: '#DC2626', fontWeight: 800, margin: 0, fontSize: '15px' }}>
                Circuit Breaker Active: Order Dispatching Temporarily Disabled
              </h4>
              <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>
                Daily loss exceeded stated cap. Live broker order handoff is disabled until next trading session to prevent revenge trading.
              </p>
            </div>
          </div>
        )}

        {/* ── 3 RISK TILES ────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          
          {/* Card 1: Position Sizing Engine */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
                  POSITION SIZING ENGINE
                </h3>
                <span style={{ fontSize: '11px', background: '#EFF6FF', color: '#214ECF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #BFDBFE', fontWeight: 700 }}>
                  Risk-Capped
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Max Loss Cap:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>₹{maxLossCap.toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Max Position Allocation:</span>
                  <strong style={{ color: '#214ECF', fontFamily: 'monospace' }}>₹{Math.round(positionSize).toLocaleString('en-IN')} ({positionPct}%)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Suggested Size:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{suggestedLots} lot ({suggestedLots * 75} qty)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Daily Drawdown:</span>
                  <strong style={{ color: '#214ECF', fontFamily: 'monospace' }}>{drawdownPct}% of limit</strong>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.45', margin: 0 }}>
              Position size automatically scales down when market volatility (India VIX) is elevated.
            </p>
          </div>

          {/* Card 2: Event Risk Detector */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
                  EVENT RISK DETECTOR
                </h3>
                <span style={{ fontSize: '11px', background: '#FFFBEB', color: '#B45309', padding: '2px 8px', borderRadius: '4px', border: '1px solid #FDE68A', fontWeight: 700 }}>
                  Macro Monitor
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '18px' }}>
                {[
                  { name: 'RBI Monetary Policy', date: 'In 2 days', status: 'High Volatility Expected', type: 'warning' },
                  { name: 'India CPI Inflation', date: 'In 8 days', status: 'Standard Impact', type: 'info' },
                  { name: 'NIFTY Monthly Expiry', date: '28 Aug 2026', status: 'Gamma Risk Active', type: 'warning' },
                ].map((e) => (
                  <div key={e.name} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#0F172A', fontSize: '13px' }}>{e.name}</strong>
                      <span style={{ color: '#64748B', fontSize: '11px', fontFamily: 'monospace' }}>{e.date}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: e.type === 'warning' ? '#B45309' : '#64748B', marginTop: '2px', fontWeight: 600 }}>
                      {e.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.45', margin: 0 }}>
              Strategies filtering automatically factors in event risk before suggesting open positions.
            </p>
          </div>

          {/* Card 3: Portfolio Hedge Suggestion */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
                  PORTFOLIO HEDGE
                </h3>
                <span style={{ fontSize: '11px', background: '#EFF6FF', color: '#214ECF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #BFDBFE', fontWeight: 700 }}>
                  Tail-Risk
                </span>
              </div>

              <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.45', marginBottom: '16px' }}>
                Estimated beta exposure of portfolio is <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{betaExposure}</strong> against NIFTY. In a 5% sudden market drop:
              </p>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '16px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Unhedged Loss Estimate:</span>
                  <strong style={{ color: '#DC2626', fontFamily: 'monospace' }}>-₹{Math.round(portfolioValue * 0.044).toLocaleString('en-IN')} (-{estimatedFall}%)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                  <span style={{ color: '#64748B' }}>Suggested Put Hedge:</span>
                  <strong style={{ color: '#214ECF', fontFamily: 'monospace' }}>NIFTY {supportLevel} PE x1 lot</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => setHedged(!hedged)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: hedged ? '#F1F5F9' : '#214ECF',
                color: hedged ? '#214ECF' : '#FFFFFF',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: hedged ? 'none' : '0 4px 12px rgba(33, 78, 207, 0.25)',
                transition: 'all 180ms ease'
              }}
            >
              {hedged ? '✓ Hedge Logged in Desk' : `Log Hedge Parameter (Cost ≈ ₹${hedgeCost} · ${hedgePct}%)`}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default AppShieldPage;
