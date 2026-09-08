import React, { useState, useEffect, useRef } from 'react';
import VerdictBadge from './VerdictBadge';
import './VerdictDial.css';

const VerdictDial = ({ verdict = 'TRADE', score = 78, confidence = 72, title, reason }) => {
  const containerRef = useRef(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [isSettled, setIsSettled] = useState(false);

  // Angle computation: 0° = NO_TRADE (left, -60deg), 90° = CAUTION (middle, 0deg), 180° = TRADE (right, 60deg)
  let targetAngle = 150; // default TRADE angle
  if (verdict === 'NO_TRADE') targetAngle = 30;
  if (verdict === 'CAUTION') targetAngle = 90;

  const finalRotation = targetAngle - 90; // -60deg, 0deg, 60deg
  const overshootRotation = finalRotation + (finalRotation > -60 ? 1.5 : 0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldAnimate(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const handleAnimationEnd = () => {
    setIsSettled(true);
  };

  return (
    <div 
      ref={containerRef}
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '11px', letterSpacing: '0.06em', color: '#0F766E', textTransform: 'uppercase', fontWeight: 700 }}>
            TRADE ENVIRONMENT · CONFIDENCE {confidence}%
          </span>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '4px', margin: '4px 0 0' }}>
            {title || (verdict === 'TRADE' ? 'Conditions favor a directional long above 24,750' : 'Range-bound, conflicting signals')}
          </h2>
        </div>
        <VerdictBadge state={verdict} size="large" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center' }}>
        {/* Dial Visualization */}
        <div style={{ position: 'relative', width: '220px', height: '120px', margin: '0 auto' }}>
          <svg viewBox="0 0 200 110" style={{ width: '100%', height: '100%' }}>
            {/* Arc background segments */}
            {/* NO TRADE Arc */}
            <path d="M 20 100 A 80 80 0 0 1 60 30" fill="none" stroke="#EF4444" strokeWidth="14" strokeLinecap="round" />
            {/* CAUTION Arc */}
            <path d="M 65 26 A 80 80 0 0 1 135 26" fill="none" stroke="#F59E0B" strokeWidth="14" strokeLinecap="round" />
            {/* TRADE Arc */}
            <path d="M 140 30 A 80 80 0 0 1 180 100" fill="none" stroke="#10B981" strokeWidth="14" strokeLinecap="round" />

            {/* Pivot dot */}
            <circle cx="100" cy="100" r="7" fill="#0F766E" />
            
            {/* Precision Animated Needle */}
            <g 
              className={`verdict-needle-group ${shouldAnimate && !isSettled ? 'animate-needle' : ''} ${isSettled ? 'settled' : ''}`}
              onAnimationEnd={handleAnimationEnd}
              style={{
                '--target-rotation': `${finalRotation}deg`,
                '--overshoot-rotation': `${overshootRotation}deg`,
                transformOrigin: '100px 100px',
                transform: `rotate(${finalRotation}deg)`
              }}
            >
              <line x1="100" y1="100" x2="100" y2="30" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
              <polygon points="100,20 96,32 104,32" fill="#0F766E" />
            </g>
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginTop: '-12px' }}>
            <span style={{ color: '#DC2626' }}>NO TRADE</span>
            <span style={{ color: '#D97706' }}>CAUTION</span>
            <span style={{ color: '#059669' }}>TRADE</span>
          </div>
        </div>

        {/* Reason & Explanation */}
        <div style={{ background: '#F8FAFC', padding: '16px 20px', borderRadius: '8px', border: '1px solid #E2E8F0', borderLeft: `4px solid ${verdict === 'TRADE' ? '#10B981' : verdict === 'CAUTION' ? '#F59E0B' : '#EF4444'}` }}>
          <p style={{ fontSize: '13px', color: '#0F172A', lineHeight: '1.5', margin: 0, fontWeight: 500 }}>
            {reason || 'Breadth positive · OI build-up in favor of upside · IV cooling. Conditions currently support a directional view — no guaranteed outcome.'}
          </p>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748B' }}>
            💡 <strong>Why "No Trade" is a first-class state:</strong> IndexPilot treats "sit this one out" as an equally valid, equally prominent verdict because avoiding a bad trade protects capital.
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerdictDial;
