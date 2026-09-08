import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import PayoffCurve from '../../components/common/PayoffCurve';
import VerdictBadge from '../../components/common/VerdictBadge';
import { useNavigate, Link } from 'react-router-dom';
import { AlertOctagon, ShieldAlert, ArrowRight, ExternalLink } from 'lucide-react';
import '../../styles/modal-physics.css';

const AppSetupsPage = () => {
  const { userRiskProfile, addTradeJournal, marketStrategies } = useApp();
  const navigate = useNavigate();
  const [selectedView, setSelectedView] = useState('Bullish');
  const [selectedRiskLimit, setSelectedRiskLimit] = useState(userRiskProfile.maxAcceptableLoss || 2500);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [isOverrideClosing, setIsOverrideClosing] = useState(false);
  const [targetStrategy, setTargetStrategy] = useState(null);
  const [overrideSuccess, setOverrideSuccess] = useState(false);

  const closeOverrideModal = useCallback(() => {
    if (isOverrideClosing) return;
    setIsOverrideClosing(true);
    setTimeout(() => {
      setOverrideModalOpen(false);
      setIsOverrideClosing(false);
    }, 520);
  }, [isOverrideClosing]);

  useEffect(() => {
    if (!overrideModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeOverrideModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [overrideModalOpen, closeOverrideModal]);

  // Strategies come from the database. Show an unavailable state if the DB query failed.
  if (marketStrategies.length === 0) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '24px 20px 80px', fontFamily: 'var(--font-ui)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', paddingTop: '80px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📡</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
            Strategy Setups Unavailable
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '520px', margin: '0 auto' }}>
            KEPWE does not fabricate strategy data. No active strategies were found in the database.
            Please try again — if the issue persists, contact support.
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

  const handleOverrideConfirm = () => {
    if (!targetStrategy) return;
    addTradeJournal({
      id: `j-${Date.now()}`,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      index: 'NIFTY',
      strategy: targetStrategy.name,
      verdict: 'NO_TRADE',
      override: true,
      overrideReason: `User overridden risk limit cap of ₹${selectedRiskLimit}`,
      status: 'Overridden',
      pnl: 0
    });
    closeOverrideModal();
    setOverrideSuccess(targetStrategy.name);
    setTimeout(() => setOverrideSuccess(false), 3000);
  };

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
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#214ECF' }} />
            <span style={{ fontSize: '11px', color: '#214ECF', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              03 STRATEGY
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0F172A', margin: 0 }}>
            Risk-First Setup Finder
          </h1>
        </div>

        {/* DEMO Data Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          color: '#B45309',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 600,
          marginBottom: '20px'
        }}>
          <span>📡</span> DEMO DATA · COMPUTED AT {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {overrideSuccess && (
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: 600, fontSize: '13px' }}>
            ✓ Override logged in Trade Journal — {overrideSuccess}
          </div>
        )}

        {/* ── SETUP FINDER FILTER CONTROL PANEL ────────────────── */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)'
        }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
            SETUP FINDER FILTERS
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
            {/* View Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748B', fontWeight: 600, marginBottom: '8px' }}>
                Market View
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {['Bullish', 'Bearish', 'Neutral'].map((v) => {
                  const isSelected = selectedView === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setSelectedView(v)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #214ECF' : '1px solid #CBD5E1',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        background: isSelected ? '#EFF6FF' : '#FFFFFF',
                        color: isSelected ? '#214ECF' : '#64748B',
                        transition: 'all 180ms ease'
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Risk Filter Chips */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#64748B', fontWeight: 600, marginBottom: '8px' }}>
                How much are you willing to lose? (Max Loss Cap)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[500, 1000, 2500, 5000, 10000].map((chip) => {
                  const isSelected = selectedRiskLimit === chip;
                  return (
                    <button
                      key={chip}
                      onClick={() => setSelectedRiskLimit(chip)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #DC2626' : '1px solid #CBD5E1',
                        background: isSelected ? '#FEF2F2' : '#FFFFFF',
                        color: isSelected ? '#DC2626' : '#0F172A',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 180ms ease',
                        fontFamily: 'monospace'
                      }}
                    >
                      ₹{chip.toLocaleString('en-IN')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── STRATEGY CARDS GRID ────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '20px' }}>
          {marketStrategies.map((strat) => {
            const isExceeded = strat.maxLoss > selectedRiskLimit;
            const isHovered = hoveredCardId === strat.id;

            return (
              <div
                key={strat.id}
                onMouseEnter={() => setHoveredCardId(strat.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{
                  background: '#FFFFFF',
                  border: isExceeded ? '1px solid #FCA5A5' : (isHovered ? '1px solid #214ECF' : '1px solid #E2E8F0'),
                  borderRadius: '12px',
                  boxShadow: isHovered ? '0 10px 25px rgba(15, 23, 42, 0.08)' : '0 4px 14px rgba(15, 23, 42, 0.03)',
                  transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                  transform: isHovered ? 'translateY(-2px)' : 'none',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  boxSizing: 'border-box'
                }}
              >
                {/* Top Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <span style={{
                        background: '#EFF6FF',
                        color: '#214ECF',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        {strat.type}
                      </span>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '6px', marginBottom: 0 }}>
                        {strat.name}
                      </h3>
                    </div>

                    {isExceeded ? (
                      <span style={{
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FCA5A5',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap'
                      }}>
                        NO TRADE
                      </span>
                    ) : (
                      <VerdictBadge state="TRADE" size="small" />
                    )}
                  </div>

                  <p style={{ color: '#64748B', fontSize: '13px', lineHeight: '1.45', margin: '0 0 16px 0' }}>
                    {strat.description}
                  </p>

                  {/* RISK / PROFIT SUMMARY PANEL */}
                  <div style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '16px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '14px'
                  }}>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        1. MAX LOSS (RISK)
                      </span>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#DC2626', marginTop: '2px', fontFamily: 'monospace' }}>
                        ₹{strat.maxLoss.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        2. MAX PROFIT
                      </span>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#214ECF', marginTop: '2px', fontFamily: 'monospace' }}>
                        ₹{strat.maxProfit.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Payoff Diagram */}
                  <div style={{ marginBottom: '16px' }}>
                    <PayoffCurve maxLoss={strat.maxLoss} maxProfit={strat.maxProfit} breakeven={strat.breakeven} />
                  </div>
                </div>

                {/* Bottom Action / Risk Warning Section */}
                <div>
                  {isExceeded ? (
                    <div style={{
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '8px',
                      padding: '14px'
                    }}>
                      <div style={{ color: '#DC2626', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertOctagon size={15} color="#DC2626" /> NO TRADE — EXCEEDS YOUR RISK LIMIT
                      </div>
                      <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', marginBottom: 0 }}>
                        This strategy's max loss of ₹{strat.maxLoss.toLocaleString('en-IN')} exceeds your selected limit of ₹{selectedRiskLimit.toLocaleString('en-IN')}.
                      </p>
                      <button
                        onClick={() => { setTargetStrategy(strat); setOverrideModalOpen(true); }}
                        style={{
                          marginTop: '10px',
                          background: '#FFFFFF',
                          color: '#DC2626',
                          border: '1px solid #DC2626',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '6px 12px',
                          cursor: 'pointer',
                          transition: 'all 180ms ease'
                        }}
                      >
                        Consciously Override & Log
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <button
                        onClick={() => navigate(`/app/strategies/${strat.id}`)}
                        style={{
                          flex: 1,
                          background: '#214ECF',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '10px 16px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(33, 78, 207, 0.25)',
                          transition: 'all 180ms ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#1A3EB4'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#214ECF'; }}
                      >
                        <span>Select Strategy</span>
                        <ArrowRight size={15} />
                      </button>
                      <Link
                        to={`/app/strategies/${strat.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          background: '#F8FAFC',
                          color: '#64748B',
                          textDecoration: 'none',
                          fontSize: '13px',
                          fontWeight: 600
                        }}
                      >
                        <ExternalLink size={14} /> Detail
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* OVERRIDE CONFIRMATION MODAL with Physical Gravity Dismissal */}
        {overrideModalOpen && (
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
              style={{ maxWidth: '460px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontWeight: 800, fontSize: '16px', marginBottom: '12px' }}>
                <ShieldAlert size={22} color="#DC2626" /> Confirm Risk Limit Override
              </div>
              <p style={{ color: '#0F172A', fontSize: '13px', lineHeight: '1.5', marginBottom: '16px' }}>
                You are about to override your stated max loss cap of <strong style={{ color: '#DC2626' }}>₹{selectedRiskLimit}</strong> for strategy <strong style={{ color: '#0F172A' }}>{targetStrategy?.name}</strong>.
              </p>
              <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', color: '#64748B', marginBottom: '20px' }}>
                ⚠️ Principle 05: Overrides are logged in your trade journal for later self-review and performance tracking.
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeOverrideModal}
                  disabled={isOverrideClosing}
                  style={{ padding: '9px 16px', borderRadius: '6px', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', fontWeight: 600, fontSize: '13px', cursor: isOverrideClosing ? 'default' : 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOverrideConfirm}
                  disabled={isOverrideClosing}
                  style={{ padding: '9px 16px', borderRadius: '6px', background: '#DC2626', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '13px', cursor: isOverrideClosing ? 'default' : 'pointer' }}
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

export default AppSetupsPage;
