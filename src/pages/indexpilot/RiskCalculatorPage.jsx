import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import PayoffCurve from '../../components/common/PayoffCurve';
import { Calculator, ArrowRight, Info } from 'lucide-react';

const RiskCalculatorPage = () => {
  const { updateRiskProfile } = useApp();
  const navigate = useNavigate();

  const [capital, setCapital] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(2.5);
  const [marketView, setMarketView] = useState('Bullish');

  const maxLossAmount = Math.round(capital * (riskPercent / 100));
  const suggestedLots = Math.max(1, Math.floor(maxLossAmount / 6200));

  const handleApplyToApp = () => {
    updateRiskProfile({
      capitalAmount: capital,
      maxAcceptableLoss: maxLossAmount,
      experience: 'Intermediate',
      capitalRange: capital >= 500000 ? '₹5L+' : capital >= 100000 ? '₹1L–5L' : '₹25k–1L',
      indices: ['NIFTY', 'BANKNIFTY'],
      riskCategory: riskPercent > 3 ? 'Aggressive' : riskPercent >= 2 ? 'Balanced' : 'Conservative'
    });
    navigate('/app/setups');
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '48px 20px 80px', fontFamily: 'var(--font-ui)' }}>
      <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ background: '#EFF6FF', color: '#214ECF', border: '1px solid #BFDBFE', padding: '4px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            FREE STANDALONE TOOL · /tools/risk-calculator
          </span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginTop: '16px', marginBottom: '8px', color: '#0F172A' }}>
            Risk-First Position Sizing Calculator
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '640px', margin: '0 auto', lineHeight: '1.5' }}>
            Define how much you are willing to lose before looking at returns.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* CALCULATOR INPUTS */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#214ECF', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Calculator size={16} /> Calculator Inputs
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>
                  Total Trading Capital (₹)
                </label>
                <input
                  type="number"
                  value={capital}
                  onChange={(e) => setCapital(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: '#F8FAFC', border: '1px solid #CBD5E1', color: '#0F172A', fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Max Acceptable Loss per Trade</span>
                  <span style={{ color: '#DC2626', fontFamily: 'monospace', fontWeight: 700 }}>{riskPercent}% (₹{maxLossAmount.toLocaleString('en-IN')})</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.5"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#DC2626' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  <span>0.5% (Conservative)</span>
                  <span>2.5% (Recommended)</span>
                  <span>5.0% (Aggressive)</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>
                  Current Market View
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {['Bullish', 'Bearish', 'Neutral'].map((view) => (
                    <button
                      key={view}
                      onClick={() => setMarketView(view)}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: marketView === view ? '1px solid #214ECF' : '1px solid #CBD5E1',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        background: marketView === view ? '#EFF6FF' : '#FFFFFF',
                        color: marketView === view ? '#214ECF' : '#64748B',
                        transition: 'all 180ms ease'
                      }}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CALCULATOR OUTPUT & POSITION GUIDANCE */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '16px', letterSpacing: '0.02em' }}>
              Position Sizing Guidance
            </h2>

            <div style={{ background: '#FEF2F2', padding: '16px', borderRadius: '8px', marginBottom: '14px', borderLeft: '4px solid #DC2626' }}>
              <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>MAX LOSS CAP</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', margin: '2px 0', fontFamily: 'monospace' }}>
                ₹{maxLossAmount.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Never enter a trade where max loss exceeds this figure.</span>
            </div>

            <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>RECOMMENDED POSITION SIZE</span>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#214ECF', marginTop: '4px' }}>
                {suggestedLots} Lot NIFTY {marketView === 'Bullish' ? 'Bull Call Spread' : marketView === 'Bearish' ? 'Bear Put Spread' : 'Iron Condor'}
              </div>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Defined debit spread protecting against gap-down risk.</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <PayoffCurve maxLoss={maxLossAmount} maxProfit={Math.round(maxLossAmount * 1.5)} breakeven={24862} />
            </div>

            <button
              onClick={handleApplyToApp}
              style={{
                marginTop: 'auto',
                padding: '12px 18px',
                borderRadius: '8px',
                background: '#214ECF',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(33, 78, 207, 0.25)',
                transition: 'all 180ms ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1A3EB4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#214ECF'; }}
            >
              <span>See Matching Strategies in App</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* EDUCATIONAL FOOTER */}
        <div style={{ background: '#FFFFFF', padding: '18px 24px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)', marginTop: '24px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <Info size={20} color="#214ECF" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ color: '#0F172A', fontWeight: 700, fontSize: '14px', margin: '0 0 2px 0' }}>Why define your risk before you define your trade?</h4>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.45', margin: 0 }}>
              Most retail option traders size positions based on how much they hope to make, rather than how much they can afford to lose. Defining your risk cap upfront guarantees capital preservation through unexpected volatility events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskCalculatorPage;
