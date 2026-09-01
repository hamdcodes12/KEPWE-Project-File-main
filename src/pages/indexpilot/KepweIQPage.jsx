import React, { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import './KepweIQPage.css';

const KepweIQPage = () => {
  const [displayScore, setDisplayScore] = useState(0);
  const scoreCardRef = useRef(null);
  const hasAnimatedScore = useRef(false);

  // Score counter animation trigger when 25% visible
  useEffect(() => {
    const el = scoreCardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimatedScore.current) {
            hasAnimatedScore.current = true;
            
            const targetScore = 78;
            const duration = 1900; // 1.9s duration
            const startTime = performance.now();

            const animate = (now) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // Ease-out cubic formula for fast start, smooth slow finish
              const eased = 1 - Math.pow(1 - progress, 3);
              const currentVal = Math.floor(eased * targetScore);

              setDisplayScore(currentVal);

              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setDisplayScore(targetScore);
              }
            };

            requestAnimationFrame(animate);
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

  // General scroll reveal observer
  useEffect(() => {
    const observerOptions = {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const elements = document.querySelectorAll('.kiq-reveal, .kiq-factor-card, .kiq-table-row');
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <div className="kiq-page-container">
      <div className="kiq-content-wrapper">
        {/* HEADER HERO */}
        <div className="kiq-header kiq-reveal">
          <span className="kiq-eyebrow">
            PROPRIETARY METRIC · /kepwe-iq
          </span>
          <h1 className="kiq-title">
            One number for what the market is really doing.
          </h1>
          <p className="kiq-subtitle">
            A single 0–100 composite score per index that reads trend, momentum, volatility, breadth, options positioning, volume, price structure, and global cues — so you don't have to.
          </p>
        </div>

        {/* LARGE SCORE GAUGE DISPLAY CARD */}
        <div ref={scoreCardRef} className="kiq-score-card kiq-reveal">
          <div className="kiq-score-label">
            CURRENT READ · NIFTY 50 IQ SCORE
          </div>
          
          <div className="kiq-score-number">
            <span>{displayScore}</span>
            <span className="kiq-score-total">/ 100</span>
          </div>

          <div 
            className="kiq-status-pill"
            style={{ opacity: displayScore > 0 ? 1 : 0 }}
          >
            Favourable Market Quality (High Conviction)
          </div>

          <p className="kiq-score-summary">
            Trend: Bullish · Volatility: Low · Breadth: Strong (A/D 1.9) · Options positioning: Bullish (PCR 1.18) · Overall: High Quality setup detected.
          </p>
        </div>

        {/* 8-FACTOR BREAKDOWN GRID */}
        <div className="kiq-reveal">
          <h2 className="kiq-section-title">
            What goes into the score? (8 Weighted Factors)
          </h2>

          <div className="kiq-factors-grid">
            {[
              { title: '1. Trend Strength', desc: 'Moving average alignment across 15m, 1h, and daily charts.' },
              { title: '2. Momentum', desc: 'RSI, MACD, and rate of change velocity metrics.' },
              { title: '3. Volatility Regime', desc: 'India VIX level, IV percentile, and volatility contraction bands.' },
              { title: '4. Market Breadth', desc: 'Advance/Decline ratio across constituent stocks.' },
              { title: '5. Options Positioning', desc: 'Put-Call Ratio (PCR) and Open Interest (OI) buildup shifts.' },
              { title: '6. Volume Profile', desc: 'Institutional volume distribution and point of control (POC).' },
              { title: '7. Price Structure', desc: 'Support/Resistance levels, swing highs, and pivot structures.' },
              { title: '8. Global Cues', desc: 'SGX Nifty, US futures, and overnight global market sentiment.' },
            ].map((f) => (
              <div key={f.title} className="kiq-factor-card">
                <h3 className="kiq-factor-title">{f.title}</h3>
                <p className="kiq-factor-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SCORE BANDS TABLE */}
        <div className="kiq-reveal">
          <h2 className="kiq-section-title">
            How to read the Kepwe IQ score
          </h2>

          <div className="kiq-table-container">
            <div className="kiq-table-scroll">
              <table className="kiq-table">
                <thead>
                  <tr>
                    <th>SCORE BAND</th>
                    <th>INTERPRETATION</th>
                    <th>RECOMMENDED ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="kiq-table-row">
                    <td style={{ fontWeight: 800, color: '#34D399' }}>80 – 100</td>
                    <td style={{ fontWeight: 700 }}>High Conviction</td>
                    <td style={{ color: '#94A3B8' }}>Favourable conditions; full defined-risk position sizing.</td>
                  </tr>
                  <tr className="kiq-table-row is-current-score-band">
                    <td style={{ fontWeight: 800, color: '#38BDF8' }}>60 – 79</td>
                    <td style={{ fontWeight: 700 }}>Favourable</td>
                    <td style={{ color: '#94A3B8' }}>Good directional edge; debit spreads recommended.</td>
                  </tr>
                  <tr className="kiq-table-row">
                    <td style={{ fontWeight: 800, color: '#FBBF24' }}>40 – 59</td>
                    <td style={{ fontWeight: 700 }}>Mixed / Neutral</td>
                    <td style={{ color: '#94A3B8' }}>Range-bound market; neutral strategies or wait.</td>
                  </tr>
                  <tr className="kiq-table-row">
                    <td style={{ fontWeight: 800, color: '#FB6B6B' }}>20 – 39</td>
                    <td style={{ fontWeight: 700 }}>Caution</td>
                    <td style={{ color: '#94A3B8' }}>High uncertainty; reduced position size only.</td>
                  </tr>
                  <tr className="kiq-table-row">
                    <td style={{ fontWeight: 800, color: '#EF4444' }}>0 – 19</td>
                    <td style={{ fontWeight: 700 }}>High Risk / Avoid</td>
                    <td style={{ color: '#EF4444', fontWeight: 700 }}>NO TRADE signal active; sit out.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* METHODOLOGY TRANSPARENCY NOTE */}
        <div className="kiq-methodology-box kiq-reveal">
          <Info size={24} className="kiq-methodology-icon" />
          <div>
            <h4 className="kiq-methodology-title">Methodology Transparency Note</h4>
            <p className="kiq-methodology-text">
              Kepwe IQ is calculated automatically every 15 seconds during NSE trading hours (9:15 AM – 3:30 PM IST). Publishing methodology transparency reduces regulatory ambiguity and ensures systematic objectivity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KepweIQPage;

