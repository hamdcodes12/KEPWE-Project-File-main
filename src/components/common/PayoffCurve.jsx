import React, { useState } from 'react';

const PayoffCurve = ({ maxLoss = 6200, maxProfit = 9500, breakeven = 24862 }) => {
  const [hoverPos, setHoverPos] = useState(null);

  return (
    <div style={{
      background: '#1A2231',
      padding: '16px',
      borderRadius: '11px',
      border: '1px solid rgba(148, 163, 184, 0.10)',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94A3B8', marginBottom: '8px', fontWeight: 600 }}>
        <span>PAYOFF AT EXPIRY</span>
        <span>BREAKEVEN: <strong className="font-mono" style={{ color: '#CBD5E1' }}>{breakeven}</strong></span>
      </div>

      <div style={{ position: 'relative' }} onMouseLeave={() => setHoverPos(null)}>
        <svg
          viewBox="0 0 300 120"
          style={{ width: '100%', height: '95px', cursor: 'crosshair' }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const relativeX = Math.max(10, Math.min(290, (x / rect.width) * 300));
            setHoverPos(relativeX);
          }}
        >
          {/* Zero P&L Baseline */}
          <line x1="10" y1="60" x2="290" y2="60" stroke="rgba(148, 163, 184, 0.22)" strokeDasharray="4 4" strokeWidth="1.5" />
          
          {/* Payoff Curve Line in Brand Teal */}
          <path d="M 10 95 L 100 95 L 200 25 L 290 25" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" />
          
          {/* Max Loss Dot */}
          <circle cx="100" cy="95" r="4.5" fill="#EF6B73" />
          <text x="100" y="114" fill="#94A3B8" fontSize="9.5" fontWeight="600" textAnchor="middle" className="font-mono">
            Max Loss: ₹{maxLoss.toLocaleString('en-IN')}
          </text>

          {/* Max Profit Dot */}
          <circle cx="200" cy="25" r="4.5" fill="#34D399" />
          <text x="200" y="16" fill="#CBD5E1" fontSize="9.5" fontWeight="600" textAnchor="middle" className="font-mono">
            Max Profit: ₹{maxProfit.toLocaleString('en-IN')}
          </text>

          {/* Hover Vertical Guide Line */}
          {hoverPos !== null && (
            <line x1={hoverPos} y1="10" x2={hoverPos} y2="105" stroke="rgba(20, 184, 166, 0.4)" strokeWidth="1" strokeDasharray="2 2" />
          )}
        </svg>

        {/* Hover Tooltip */}
        {hoverPos !== null && (
          <div style={{
            position: 'absolute',
            top: '15px',
            left: `${(hoverPos / 300) * 100}%`,
            transform: 'translateX(-50%)',
            background: '#172033',
            color: '#F8FAFC',
            border: '1px solid rgba(20, 184, 166, 0.25)',
            borderRadius: '7px',
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)',
            padding: '4px 8px',
            fontSize: '0.72rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            Payoff: {hoverPos > 150 ? `+₹${Math.round(maxProfit * (hoverPos - 150) / 100).toLocaleString('en-IN')}` : `-₹${Math.round(maxLoss * (150 - hoverPos) / 100).toLocaleString('en-IN')}`}
          </div>
        )}
      </div>
    </div>
  );
};

export default PayoffCurve;

