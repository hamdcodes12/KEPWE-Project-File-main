import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PayoffCurve from '../../components/common/PayoffCurve';
import VerdictBadge from '../../components/common/VerdictBadge';
import { useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, AlertOctagon, ShieldCheck, TrendingUp, Calendar, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import '../../styles/modal-physics.css';

const StrategyDetailPage = () => {
  const { id } = useParams();
  const { userRiskProfile, addTradeJournal, marketStrategies } = useApp();
  const navigate = useNavigate();
  const [subscribed, setSubscribed] = useState(false);
  const [overrideConfirm, setOverrideConfirm] = useState(false);
  const [isOverrideClosing, setIsOverrideClosing] = useState(false);

  const closeOverrideModal = useCallback(() => {
    if (isOverrideClosing) return;
    setIsOverrideClosing(true);
    setTimeout(() => {
      setOverrideConfirm(false);
      setIsOverrideClosing(false);
    }, 520);
  }, [isOverrideClosing]);

  useEffect(() => {
    if (!overrideConfirm) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeOverrideModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [overrideConfirm, closeOverrideModal]);

  const strategy = marketStrategies.find((s) => s.id === id) || marketStrategies[0];
  if (!strategy) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', padding: '60px 20px', textAlign: 'center', color: '#64748B', fontFamily: 'var(--font-ui)' }}>
        <h2>Strategy not found</h2>
        <Link to="/app/setups" style={{ color: '#214ECF', fontWeight: 700 }}>Back to Setups</Link>
      </div>
    );
  }

  const isExceeded = strategy.maxLoss > (userRiskProfile.maxAcceptableLoss || 2500);

  const verdictColors = {
    TRADE: '#214ECF',
    CAUTION: '#D97706',
    NO_TRADE: '#DC2626',
  };

  const handleActivate = () => {
    if (isExceeded) { setOverrideConfirm(true); return; }
    addTradeJournal({
      id: `j-${Date.now()}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      index: 'NIFTY',
      strategy: strategy.name,
      verdict: 'TRADE',
      override: false,
      status: 'Activated',
      pnl: 0,
    });
    setSubscribed(true);
  };

  const handleOverride = () => {
    addTradeJournal({
      id: `j-${Date.now()}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      index: 'NIFTY',
      strategy: strategy.name,
      verdict: 'NO_TRADE',
      override: true,
      overrideReason: `User overrode risk limit of ₹${userRiskProfile.maxAcceptableLoss}`,
      status: 'Overridden',
      pnl: 0,
    });
    closeOverrideModal();
    setSubscribed(true);
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '24px 20px 100px', fontFamily: 'var(--font-ui)' }}>
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginBottom: '20px', padding: 0 }}>
          <ArrowLeft size={16} /> Back to Setups
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#475569', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', marginBottom: '16px' }}>
          LIVE MARKET DATA · VERIFIED SOURCE REQUIRED
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <span style={{ fontSize: '11px', background: '#EFF6FF', color: '#214ECF', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {strategy.type}
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 800, marginTop: '8px', marginBottom: '2px', color: '#0F172A' }}>{strategy.name}</h1>
            <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>Index: NIFTY 50 · Weekly Expiry</p>
          </div>
          <VerdictBadge state={isExceeded ? 'NO_TRADE' : (strategy.signalVerdict || 'TRADE')} size="large" />
        </div>

        {/* Risk metrics — MAX LOSS FIRST */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: '① MAX LOSS (RISK)', value: `₹${strategy.maxLoss.toLocaleString('en-IN')}`, color: '#DC2626', bg: '#FEF2F2' },
            { label: '② MAX PROFIT', value: `₹${strategy.maxProfit.toLocaleString('en-IN')}`, color: '#214ECF', bg: '#EFF6FF' },
            { label: 'BREAKEVEN', value: `₹${strategy.breakeven.toLocaleString('en-IN')}`, color: '#D97706', bg: '#FFFBEB' },
            { label: 'RISK : REWARD', value: `1 : ${(strategy.maxProfit / strategy.maxLoss).toFixed(1)}`, color: '#214ECF', bg: '#EFF6FF' },
          ].map((m) => (
            <div key={m.label} style={{ background: m.bg, border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{m.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: m.color, fontFamily: 'monospace' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Payoff Curve */}
        <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '24px', marginBottom: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)' }}>
          <h3 style={{ color: '#214ECF', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.04em' }}>PAYOFF DIAGRAM</h3>
          <PayoffCurve maxLoss={strategy.maxLoss} maxProfit={strategy.maxProfit} breakeven={strategy.breakeven} />
        </div>

        {/* Current Signal */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: `4px solid ${verdictColors[strategy.signalVerdict] || '#214ECF'}`, borderRadius: '10px', padding: '18px 24px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Zap size={16} color={verdictColors[strategy.signalVerdict] || '#214ECF'} />
            <span style={{ fontWeight: 700, color: verdictColors[strategy.signalVerdict] || '#214ECF', fontSize: '12px', textTransform: 'uppercase' }}>LIVE SIGNAL</span>
          </div>
          <p style={{ color: '#0F172A', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{strategy.currentSignal}</p>
        </div>

        {/* NO TRADE Gate */}
        {isExceeded && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 800, fontSize: '14px', marginBottom: '6px' }}>
              <AlertOctagon size={18} /> NO TRADE — POSITION EXCEEDS YOUR RISK LIMIT
            </div>
            <p style={{ color: '#64748B', fontSize: '13px', lineHeight: 1.45, marginBottom: '14px' }}>
              This strategy's max loss of <strong style={{ color: '#DC2626', fontFamily: 'monospace' }}>₹{strategy.maxLoss.toLocaleString('en-IN')}</strong> exceeds your stated risk limit of <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>₹{userRiskProfile.maxAcceptableLoss?.toLocaleString('en-IN')}</strong>. Options: reduce position size or consciously override and log in journal.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/app/shield')} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #214ECF', background: '#FFFFFF', color: '#214ECF', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                Reduce Size in Shield →
              </button>
              <button onClick={() => setOverrideConfirm(true)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #DC2626', background: '#FFFFFF', color: '#DC2626', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                Consciously Override
              </button>
            </div>
          </div>
        )}

        {/* Content sections */}
        {[
          { icon: <TrendingUp size={16} />, title: 'Overview', content: strategy.overview },
          { icon: <Calendar size={16} />, title: 'Market Regime Fit', content: strategy.regime },
        ].map((sec) => (
          <div key={sec.title} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px 24px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' }}>
            <h3 style={{ color: '#214ECF', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
              {sec.icon} {sec.title}
            </h3>
            <p style={{ color: '#475569', fontSize: '13px', lineHeight: 1.55, margin: 0 }}>{sec.content}</p>
          </div>
        ))}

        {/* Entry & Risk rules */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          {[
            { title: 'ENTRY RULES', rules: strategy.entryRules, color: '#214ECF', bg: '#EFF6FF' },
            { title: 'RISK RULES', rules: strategy.riskRules, color: '#DC2626', bg: '#FEF2F2' },
          ].map((sec) => (
            <div key={sec.title} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' }}>
              <h3 style={{ color: sec.color, fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px' }}>{sec.title}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sec.rules?.map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: '8px', color: '#475569', fontSize: '13px', lineHeight: 1.45 }}>
                    <span style={{ color: sec.color, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Historical note */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '20px 24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' }}>
          <h3 style={{ color: '#214ECF', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px' }}>HISTORICAL / BACKTEST NOTE</h3>
          <p style={{ color: '#64748B', fontSize: '13px', lineHeight: 1.55, margin: 0 }}>{strategy.historicalNote}</p>
        </div>

        {/* Activate / Subscribed */}
        {!subscribed ? (
          <button
            onClick={handleActivate}
            style={{ width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: isExceeded ? '#DC2626' : '#214ECF', color: '#FFFFFF', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(33, 78, 207, 0.25)', transition: 'background-color 180ms ease' }}
          >
            {isExceeded ? <AlertOctagon size={18} /> : <CheckCircle2 size={18} />}
            {isExceeded ? 'Override & Activate (Journal entry will be created)' : 'Activate Strategy & Pre-Fill Order'}
          </button>
        ) : (
          <div style={{ textAlign: 'center', padding: '18px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px' }}>
            <CheckCircle2 size={26} color="#214ECF" style={{ margin: '0 auto 6px' }} />
            <div style={{ color: '#1E40AF', fontWeight: 700, fontSize: '14px' }}>Strategy activated — logged in Trade Journal</div>
            <Link to="/app/desk" style={{ color: '#214ECF', fontSize: '13px', textDecoration: 'none', fontWeight: 700, marginTop: '6px', display: 'inline-block' }}>Go to Trading Desk →</Link>
          </div>
        )}

        {/* Override modal with Physical Gravity Dismissal */}
        {overrideConfirm && (
          <div
            className={`physics-modal-overlay ${isOverrideClosing ? 'is-closing' : ''}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeOverrideModal();
              }
            }}
          >
            <div
              className={`physics-modal-card ${isOverrideClosing ? 'is-closing' : ''}`}
              style={{ maxWidth: '440px' }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#DC2626', fontWeight: 800, fontSize: '16px', marginBottom: '10px' }}>
                <AlertOctagon size={22} /> Confirm Risk Override
              </div>
              <p style={{ color: '#0F172A', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                You are about to override your risk limit of <strong style={{ color: '#DC2626' }}>₹{userRiskProfile.maxAcceptableLoss?.toLocaleString('en-IN')}</strong> for <strong style={{ color: '#0F172A' }}>{strategy.name}</strong>. This override will be permanently logged in your Trade Journal for self-review.
              </p>
              <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#64748B', marginBottom: '18px', borderLeft: '3px solid #F59E0B' }}>
                ⚠️ Principle 05: Overrides create accountability. Review your journal monthly.
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeOverrideModal}
                  disabled={isOverrideClosing}
                  style={{ padding: '9px 16px', borderRadius: '6px', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', cursor: isOverrideClosing ? 'default' : 'pointer', fontWeight: 600, fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOverride}
                  disabled={isOverrideClosing}
                  style={{ padding: '9px 16px', borderRadius: '6px', background: '#DC2626', color: '#FFFFFF', border: 'none', cursor: isOverrideClosing ? 'default' : 'pointer', fontWeight: 700, fontSize: '13px' }}
                >
                  Confirm Override & Log
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyDetailPage;
