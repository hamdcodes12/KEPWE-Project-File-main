import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, Send, BookOpen } from 'lucide-react';
import '../../styles/modal-physics.css';

const AppDeskPage = () => {
  const { tradeJournal, paperTradeMode, setPaperTradeMode, simulatedCapital, marketStrategies } = useApp();
  const [brokerModalOpen, setBrokerModalOpen] = useState(false);
  const [isBrokerClosing, setIsBrokerClosing] = useState(false);
  const [brokerHandoffDone, setBrokerHandoffDone] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [hoveredCheckItem, setHoveredCheckItem] = useState(null);

  const closeBrokerModal = useCallback(() => {
    if (isBrokerClosing) return;
    setIsBrokerClosing(true);
    setTimeout(() => {
      setBrokerModalOpen(false);
      setIsBrokerClosing(false);
    }, 520);
  }, [isBrokerClosing]);

  useEffect(() => {
    if (!brokerModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeBrokerModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [brokerModalOpen, closeBrokerModal]);

  const activeStrategy = marketStrategies?.[0] || null;

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
                05 DESK
              </span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', color: '#0F172A', margin: 0 }}>
              Execution Support & Paper Desk
            </h1>
          </div>

          {/* Paper Trade Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              PAPER TRADE MODE:
            </span>
            <button
              onClick={() => setPaperTradeMode(!paperTradeMode)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: paperTradeMode ? '1px solid #BFDBFE' : '1px solid #CBD5E1',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                background: paperTradeMode ? '#EFF6FF' : '#F8FAFC',
                color: paperTradeMode ? '#214ECF' : '#64748B',
                transition: 'all 180ms ease'
              }}
            >
              {paperTradeMode ? 'PRACTICE ACTIVE (Simulated ₹1,00,000)' : 'LIVE MODE (Broker Handoff)'}
            </button>
          </div>
        </div>

        {brokerHandoffDone && (
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: 600, fontSize: '13px' }}>
            ✓ Order parameters handed off to broker app successfully.
          </div>
        )}

        {/* ── 3-COLUMN DESK TILES ────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '20px', marginBottom: '24px' }}>
          
          {/* Card 1: Pre-Trade Checklist */}
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
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
                PRE-TRADE CHECKLIST
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                
                <div
                  onMouseEnter={() => setHoveredCheckItem(1)}
                  onMouseLeave={() => setHoveredCheckItem(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#214ECF',
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: hoveredCheckItem === 1 ? '#EFF6FF' : 'transparent',
                    transition: 'all 180ms ease'
                  }}
                >
                  <CheckCircle2 size={16} color="#214ECF" />
                  <span>Within position size limit</span>
                </div>

                <div
                  onMouseEnter={() => setHoveredCheckItem(2)}
                  onMouseLeave={() => setHoveredCheckItem(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#214ECF',
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: hoveredCheckItem === 2 ? '#EFF6FF' : 'transparent',
                    transition: 'all 180ms ease'
                  }}
                >
                  <CheckCircle2 size={16} color="#214ECF" />
                  <span>Stop-loss level defined (24,720)</span>
                </div>

                <div
                  onMouseEnter={() => setHoveredCheckItem(3)}
                  onMouseLeave={() => setHoveredCheckItem(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#D97706',
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: hoveredCheckItem === 3 ? '#FFFBEB' : 'transparent',
                    transition: 'all 180ms ease'
                  }}
                >
                  <AlertTriangle size={16} color="#F59E0B" />
                  <span>Event risk: RBI policy in 2 days</span>
                </div>

                <div
                  onMouseEnter={() => setHoveredCheckItem(4)}
                  onMouseLeave={() => setHoveredCheckItem(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#214ECF',
                    fontWeight: 600,
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: hoveredCheckItem === 4 ? '#EFF6FF' : 'transparent',
                    transition: 'all 180ms ease'
                  }}
                >
                  <CheckCircle2 size={16} color="#214ECF" />
                  <span>Matches stated market view (Bullish)</span>
                </div>

              </div>
            </div>
          </div>

          {/* Card 2: Strategy / Order Summary Panel */}
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
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
                ORDER SUMMARY
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Strategy:</span>
                  <strong style={{ color: '#0F172A', fontWeight: 700 }}>{activeStrategy?.name || 'Bull Call Spread'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Buy Leg:</span>
                  <strong style={{ color: '#214ECF', fontWeight: 700, fontFamily: 'monospace' }}>{activeStrategy?.buyLeg || '24,800 CE x75'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                  <span style={{ color: '#64748B' }}>Sell Leg:</span>
                  <strong style={{ color: '#DC2626', fontWeight: 700, fontFamily: 'monospace' }}>{activeStrategy?.sellLeg || '25,000 CE x75'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
                  <span style={{ color: '#64748B' }}>Net Debit:</span>
                  <strong style={{ color: '#214ECF', fontSize: '16px', fontWeight: 800, fontFamily: 'monospace' }}>₹{activeStrategy?.maxLoss?.toLocaleString('en-IN') || '6,200'}</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => setBrokerModalOpen(true)}
              style={{
                width: '100%',
                background: '#214ECF',
                color: '#FFFFFF',
                fontWeight: 700,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13px',
                boxShadow: '0 4px 14px rgba(33, 78, 207, 0.25)',
                transition: 'all 180ms ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1A3EB4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#214ECF'; }}
            >
              <Send size={15} /> Send to Broker (Hand-off Order)
            </button>
          </div>

          {/* Card 3: Paper Trade Mode Summary */}
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
              <span style={{
                background: '#EFF6FF',
                color: '#214ECF',
                border: '1px solid #BFDBFE',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.04em'
              }}>
                PRACTICE
              </span>
              
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: '10px 0 6px' }}>
                Same engine, simulated capital
              </h3>
              
              <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', marginBottom: '16px' }}>
                New users default into paper trading for 15 sessions before live order hand-off unlocks — building trust in the verdict before risking real capital.
              </p>
            </div>

            <div style={{ fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
              <span style={{ color: '#214ECF', fontWeight: 700 }}>Simulated Capital:</span> <span style={{ color: '#0F172A', fontWeight: 800, fontFamily: 'monospace' }}>₹{simulatedCapital.toLocaleString('en-IN')}</span>
            </div>
          </div>

        </div>

        {/* ── TRADE JOURNAL & EXECUTION HISTORY TABLE ────────────────── */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <BookOpen size={18} color="#214ECF" />
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Trade Journal & Override Log
            </h3>
          </div>
          
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '18px', margin: 0 }}>
            Every executed or skipped trade — including ones you overrode against a "No Trade" verdict — is logged automatically for P&L and discipline tracking.
          </p>

          <div style={{ overflowX: 'auto', margin: '16px -24px -12px', borderTop: '1px solid #E2E8F0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#475569', height: '44px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 18px' }}>DATE</th>
                  <th style={{ padding: '10px 18px' }}>INDEX</th>
                  <th style={{ padding: '10px 18px' }}>STRATEGY</th>
                  <th style={{ padding: '10px 18px' }}>VERDICT</th>
                  <th style={{ padding: '10px 18px' }}>OVERRIDE?</th>
                  <th style={{ padding: '10px 18px' }}>STATUS</th>
                  <th style={{ padding: '10px 18px' }}>P&L</th>
                </tr>
              </thead>
              <tbody>
                {tradeJournal.map((j) => {
                  const isHovered = hoveredRowId === j.id;

                  return (
                    <tr
                      key={j.id}
                      onMouseEnter={() => setHoveredRowId(j.id)}
                      onMouseLeave={() => setHoveredRowId(null)}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        height: '50px',
                        background: isHovered ? '#F8FAFC' : '#FFFFFF',
                        transition: 'background 180ms ease'
                      }}
                    >
                      <td style={{ padding: '10px 18px', color: '#64748B' }}>{j.date}</td>
                      <td style={{ padding: '10px 18px', fontWeight: 700, color: '#0F172A' }}>{j.index}</td>
                      <td style={{ padding: '10px 18px', color: '#0F172A', fontWeight: 600 }}>{j.strategy}</td>
                      <td style={{ padding: '10px 18px' }}>
                        <span style={{ color: j.verdict === 'TRADE' ? '#214ECF' : '#DC2626', fontWeight: 700 }}>
                          {j.verdict}
                        </span>
                      </td>
                      <td style={{ padding: '10px 18px' }}>
                        {j.override ? (
                          <span style={{
                            color: '#DC2626',
                            fontWeight: 700,
                            fontSize: '10px',
                            background: '#FEF2F2',
                            border: '1px solid #FCA5A5',
                            padding: '3px 8px',
                            borderRadius: '4px'
                          }}>
                            YES (Overridden)
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>No</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 18px', color: '#64748B' }}>{j.status}</td>
                      <td style={{ padding: '10px 18px', fontWeight: 700, color: j.pnl >= 0 ? '#214ECF' : '#DC2626', fontFamily: 'monospace' }}>
                        {j.pnl ? `₹${j.pnl.toLocaleString('en-IN')}` : '₹0'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* BROKER HANDOFF MODAL with Physical Gravity Dismissal */}
        {brokerModalOpen && (
          <div
            className={`physics-modal-overlay ${isBrokerClosing ? 'is-closing' : ''}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeBrokerModal();
              }
            }}
          >
            <div
              className={`physics-modal-card ${isBrokerClosing ? 'is-closing' : ''}`}
              style={{ maxWidth: '480px' }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', margin: 0 }}>
                Hand-off Order to Broker
              </h3>
              <p style={{ color: '#64748B', fontSize: '13px', lineHeight: '1.5', marginTop: '6px', marginBottom: '18px' }}>
                IndexPilot does not place trades on your behalf. It prepares the order parameters and hands off to your linked broker app (Zerodha / Groww / AngelOne / Dhan).
              </p>
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#0F172A', fontWeight: 600, marginBottom: '20px', fontFamily: 'monospace' }}>
                Order Payload: NIFTY 28 AUG 24800 CE / 25000 CE Debit Spread x75 Qty
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeBrokerModal}
                  disabled={isBrokerClosing}
                  style={{ padding: '9px 16px', borderRadius: '6px', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', fontWeight: 600, fontSize: '13px', cursor: isBrokerClosing ? 'default' : 'pointer' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBrokerHandoffDone(true);
                    closeBrokerModal();
                  }}
                  disabled={isBrokerClosing}
                  style={{ padding: '9px 18px', borderRadius: '6px', background: '#214ECF', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '13px', cursor: isBrokerClosing ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(33, 78, 207, 0.25)' }}
                >
                  Open Broker App →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppDeskPage;
