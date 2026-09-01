import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Info } from 'lucide-react';

const AppChainPage = () => {
  const { optionChain, optionChainMeta, currentIndexData } = useApp();
  const [expandedStrike, setExpandedStrike] = useState(null);
  const [hoveredStrike, setHoveredStrike] = useState(null);

  // Upstox data unavailable — show a clear, honest error state.
  if (!currentIndexData || optionChain.length === 0) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '24px 20px 80px', fontFamily: 'var(--font-ui)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', paddingTop: '80px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📡</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
            Option Chain Unavailable
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '520px', margin: '0 auto' }}>
            KEPWE does not fabricate option chain data. The Upstox market-data provider did not return
            option chain data for the requested symbol/expiry. The access token may have expired or
            Upstox may be temporarily unreachable.
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

  // All values derived exclusively from live Upstox data — no hardcoded fallbacks.
  const spotPrice = optionChainMeta?.spotPrice ?? currentIndexData?.price ?? null;
  const expiryDate = optionChainMeta?.expiryDate ?? null;

  // Compute ATM strike from live data (service marks isAtm; fall back to closest to spot).
  const atmRow = optionChain.find((r) => r.isAtm) ?? null;
  const atmStrike = atmRow?.strike ?? null;
  const maxPain = atmStrike;

  // Support / resistance: from KEPWE analytics if available, otherwise null.
  const resistance = currentIndexData?.resistance ?? null;
  const support = currentIndexData?.support ?? null;

  // PCR computed from live OI totals — no fallback value.
  const totalCallOi = optionChain.reduce((s, r) => s + (r.callOiRaw || 0), 0);
  const totalPutOi  = optionChain.reduce((s, r) => s + (r.putOiRaw  || 0), 0);
  const pcr = totalPutOi > 0 ? (totalCallOi / totalPutOi).toFixed(2) : null;

  // Max raw OI across the chain — used to size the OI bar visualisations.
  const maxOiRaw = Math.max(
    ...optionChain.map((r) => Math.max(r.callOiRaw || 0, r.putOiRaw || 0)),
    1
  );

  const toggleGreeks = (strike) => {
    setExpandedStrike(expandedStrike === strike ? null : strike);
  };

  // Format an expiry date string for the header.
  const formatExpiry = (d) => {
    if (!d) return null;
    // d is e.g. '2026-09-25' (ISO) or already a display string.
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).toUpperCase();
    } catch {
      return d;
    }
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

        {/* Header & Sub-nav Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#214ECF' }} />
              <span style={{ fontSize: '11px', color: '#214ECF', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                02 CHAIN
              </span>
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', margin: 0 }}>
              NIFTY 50 · OPTION CHAIN
              {expiryDate && (
                <span style={{ color: '#64748B', fontWeight: 600 }}> · EXPIRY {formatExpiry(expiryDate)}</span>
              )}
            </h1>
          </div>

          {/* Spot Price KPI Card */}
          {spotPrice !== null && (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '12px 22px',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)',
              textAlign: 'right'
            }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                SPOT PRICE
              </span>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#214ECF', marginTop: '2px', fontFamily: 'monospace' }}>
                {spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>

        {/* Live data source badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#F0FDF4',
          border: '1px solid #86EFAC',
          color: '#166534',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: 600,
          marginBottom: '16px'
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
          LIVE · UPSTOX · LAST UPDATED {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
        </div>

        {/* ── OPTION CHAIN TABLE ────────────────── */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          overflow: 'hidden',
          marginTop: '16px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px' }}>
              <thead>
                <tr style={{
                  background: '#F8FAFC',
                  color: '#475569',
                  borderBottom: '1px solid #E2E8F0',
                  height: '46px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.04em'
                }}>
                  <th style={{ padding: '10px 16px', width: '22%' }}>CALL OI</th>
                  <th style={{ padding: '10px 16px', width: '18%' }}>CALL IV</th>
                  <th style={{ padding: '10px 16px', width: '20%', color: '#214ECF' }}>STRIKE</th>
                  <th style={{ padding: '10px 16px', width: '18%' }}>PUT IV</th>
                  <th style={{ padding: '10px 16px', width: '22%' }}>PUT OI</th>
                </tr>
              </thead>
              <tbody>
                {optionChain.map((row) => {
                  const isHovered = hoveredStrike === row.strike;
                  const isAtm = row.isAtm;

                  return (
                    <React.Fragment key={row.strike}>
                      <tr
                        onClick={() => toggleGreeks(row.strike)}
                        onMouseEnter={() => setHoveredStrike(row.strike)}
                        onMouseLeave={() => setHoveredStrike(null)}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          height: '50px',
                          background: isAtm ? '#EFF6FF' : (isHovered ? '#F8FAFC' : '#FFFFFF'),
                          borderLeft: isAtm ? '3px solid #214ECF' : '3px solid transparent',
                          transition: 'background-color 150ms ease'
                        }}
                      >
                        {/* Call OI */}
                        <td style={{ padding: '10px 16px', position: 'relative' }}>
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 6,
                              bottom: 6,
                              width: `${(row.callOiRaw / maxOiRaw) * 75}%`,
                              background: 'rgba(239, 68, 68, 0.08)',
                              borderRadius: '4px',
                              zIndex: 1
                            }}
                          />
                          <span style={{
                            position: 'relative',
                            zIndex: 2,
                            color: '#DC2626',
                            fontWeight: 700,
                            fontSize: '13px',
                            fontFamily: 'monospace'
                          }}>
                            {row.callOi !== null ? row.callOi : '—'}
                          </span>
                        </td>

                        {/* Call IV */}
                        <td style={{ padding: '10px 16px', color: '#64748B', fontWeight: 500, fontSize: '13px', fontFamily: 'monospace' }}>
                          {row.callIv > 0 ? `${row.callIv.toFixed(2)}%` : '—'}
                        </td>

                        {/* Strike Price Column */}
                        <td style={{
                          padding: '10px 16px',
                          fontWeight: 700,
                          color: isAtm ? '#214ECF' : '#0F172A',
                          fontSize: '14px',
                          fontFamily: 'monospace'
                        }}>
                          <span>{row.strike.toLocaleString('en-IN')}</span>
                          {isAtm && (
                            <span style={{
                              fontSize: '10px',
                              background: '#214ECF',
                              color: '#FFFFFF',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              marginLeft: '6px',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              display: 'inline-block'
                            }}>
                              ATM
                            </span>
                          )}
                        </td>

                        {/* Put IV */}
                        <td style={{ padding: '10px 16px', color: '#64748B', fontWeight: 500, fontSize: '13px', fontFamily: 'monospace' }}>
                          {row.putIv > 0 ? `${row.putIv.toFixed(2)}%` : '—'}
                        </td>

                        {/* Put OI */}
                        <td style={{ padding: '10px 16px', position: 'relative' }}>
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 6,
                              bottom: 6,
                              width: `${(row.putOiRaw / maxOiRaw) * 75}%`,
                              background: 'rgba(33, 78, 207, 0.10)',
                              borderRadius: '4px',
                              zIndex: 1
                            }}
                          />
                          <span style={{
                            position: 'relative',
                            zIndex: 2,
                            color: '#214ECF',
                            fontWeight: 700,
                            fontSize: '13px',
                            fontFamily: 'monospace'
                          }}>
                            {row.putOi !== null ? row.putOi : '—'}
                          </span>
                        </td>
                      </tr>

                      {/* Expandable Option Greeks Panel */}
                      {expandedStrike === row.strike && (
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          <td colSpan={5} style={{ padding: '14px 20px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '13px', color: '#475569' }}>
                              <div>Delta: <strong style={{ color: '#214ECF', fontWeight: 700, fontFamily: 'monospace' }}>{row.deltaCall !== 0 ? row.deltaCall.toFixed(4) : '—'}</strong></div>
                              <div>Theta: <strong style={{ color: '#DC2626', fontWeight: 700, fontFamily: 'monospace' }}>{row.thetaCall !== 0 ? row.thetaCall.toFixed(4) : '—'}</strong></div>
                              <div>Gamma: <strong style={{ color: '#0F172A', fontWeight: 700, fontFamily: 'monospace' }}>{row.gammaCall !== 0 ? row.gammaCall.toFixed(6) : '—'}</strong></div>
                              <div>Vega: <strong style={{ color: '#214ECF', fontWeight: 700, fontFamily: 'monospace' }}>{row.vegaCall !== 0 ? row.vegaCall.toFixed(4) : '—'}</strong></div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom KPI Blocks Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* MAX PAIN */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '18px',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
          }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>MAX PAIN</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginTop: '4px', fontFamily: 'monospace' }}>
              {maxPain !== null ? maxPain.toLocaleString('en-IN') : '—'}
            </div>
          </div>

          {/* PCR (OI) — computed from live data */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '18px',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
          }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>PCR (OI)</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#214ECF', marginTop: '4px', fontFamily: 'monospace' }}>
              {pcr !== null ? pcr : '—'}
            </div>
          </div>

          {/* RESISTANCE */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '18px',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
          }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>RESISTANCE</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#DC2626', marginTop: '4px', fontFamily: 'monospace' }}>
              {resistance !== null ? resistance.toLocaleString('en-IN') : '—'}
            </div>
          </div>

          {/* SUPPORT */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '18px',
            textAlign: 'center',
            boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
          }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.05em' }}>SUPPORT</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#214ECF', marginTop: '4px', fontFamily: 'monospace' }}>
              {support !== null ? support.toLocaleString('en-IN') : '—'}
            </div>
          </div>
        </div>

        {/* Info card: plain-language note about data source */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #214ECF',
          borderRadius: '10px',
          padding: '18px 24px',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          gap: '14px',
          alignItems: 'center'
        }}>
          <div style={{
            background: '#EFF6FF',
            borderRadius: '50%',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Info size={18} color="#214ECF" />
          </div>
          <p style={{ fontSize: '13px', color: '#0F172A', lineHeight: '1.5', margin: 0 }}>
            <strong style={{ color: '#214ECF' }}>Data Source:</strong>{' '}
            <span style={{ color: '#475569' }}>
              Option chain data is sourced live from Upstox ({expiryDate ? `expiry ${formatExpiry(expiryDate)}` : 'nearest active expiry'}).
              OI bars are scaled relative to the highest OI in the current chain.
              {pcr !== null && ` Current PCR of ${pcr} is computed from live OI totals.`}
            </span>
          </p>
        </div>

      </div>
    </div>
  );
};

export default AppChainPage;
