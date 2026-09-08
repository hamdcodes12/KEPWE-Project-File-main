import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  TrendingUp, 
  CreditCard, 
  Activity, 
  ArrowUpRight 
} from 'lucide-react';
import './HeroDashboard.css';

const HeroDashboard = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [revenueVal, setRevenueVal] = useState(0);
  const [niftyVal, setNiftyVal] = useState(0);
  const [creditVal, setCreditVal] = useState(0);

  // Phase 2 Score State
  const [ledgerScore, setLedgerScore] = useState(0);
  const [marketScore, setMarketScore] = useState(0);
  const [creditScoreVal, setCreditScoreVal] = useState(0);

  // Real-time continuous wave animation phase (60 FPS loop)
  const [wavePhase, setWavePhase] = useState(0);

  // Hover state for Main Graph Tooltip
  const [hoverData, setHoverData] = useState(null);
  const graphRef = useRef(null);
  const containerRef = useRef(null);

  // Check Intersection Observer for Entrance Animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Continuous 60fps wave loop for infinite live telemetry motion
  useEffect(() => {
    if (!isVisible) return;
    let animId;
    const startTime = performance.now();

    const loop = (now) => {
      const elapsed = (now - startTime) / 1000;
      setWavePhase(elapsed);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isVisible]);

  // Staggered Number Counter Animations when visible
  useEffect(() => {
    if (!isVisible) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setRevenueVal(12.4);
      setNiftyVal(24850);
      setCreditVal(250000);
      setLedgerScore(92);
      setMarketScore(88);
      setCreditScoreVal(785);
      return;
    }

    const globalStartTime = performance.now();

    // Helper for eased counter
    const runCounter = (delay, duration, updateFn) => {
      const step = (now) => {
        const elapsed = now - (globalStartTime + delay);
        if (elapsed < 0) {
          requestAnimationFrame(step);
          return;
        }
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        updateFn(easeProgress);

        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    };

    // 1. Business Revenue (0ms delay, 1000ms duration)
    runCounter(0, 1000, (p) => setRevenueVal(parseFloat((p * 12.4).toFixed(1))));

    // 2. NIFTY 50 Index (100ms delay, 800ms duration: 0 -> 24850)
    runCounter(100, 800, (p) => setNiftyVal(Math.round(p * 24850)));

    // 3. Credit Available (200ms delay, 1000ms duration: 0 -> 250000)
    runCounter(200, 1000, (p) => setCreditVal(Math.round(p * 250000)));

    // 4. Ledger Health Score (300ms delay, 800ms duration: 0 -> 92)
    runCounter(300, 800, (p) => setLedgerScore(Math.round(p * 92)));

    // 5. Market IQ Score (400ms delay, 800ms duration: 0 -> 88)
    runCounter(400, 800, (p) => setMarketScore(Math.round(p * 88)));

    // 6. Credit Score (500ms delay, 800ms duration: 0 -> 785)
    runCounter(500, 800, (p) => setCreditScoreVal(Math.round(p * 785)));

  }, [isVisible]);

  // Dynamic continuous wave calculation for 100% sync
  const busWave1 = Math.sin(wavePhase * 2.4) * 3.0;
  const busWave2 = Math.cos(wavePhase * 1.8) * 3.5;
  const busWaveEnd = Math.sin(wavePhase * 2.4 + 2) * 3.0;

  const busSparkPath = `M0,${28 + busWave1} Q30,${12 - busWave2} 60,${20 + busWave1} T120,${8 + busWave2} T180,${18 - busWave1} T240,${4 + busWaveEnd}`;
  const busSparkPath3D = `M0,${29.5 + busWave1} Q30,${13.5 - busWave2} 60,${21.5 + busWave1} T120,${9.5 + busWave2} T180,${19.5 - busWave1} T240,${5.5 + busWaveEnd}`;
  const busSparkFill = `M0,${28 + busWave1} Q30,${12 - busWave2} 60,${20 + busWave1} T120,${8 + busWave2} T180,${18 - busWave1} T240,${4 + busWaveEnd} L240,36 L0,36 Z`;
  const busEndY = 4 + busWaveEnd;

  const tMrkt = wavePhase * 1.5 + 1.2;
  const mrktWave1 = Math.sin(tMrkt * 2.4) * 3.0;
  const mrktWave2 = Math.cos(tMrkt * 1.8) * 3.5;
  const mrktWaveEnd = Math.sin(tMrkt * 2.4 + 2) * 3.0;

  const niftySparkPath = `M0,${24 + mrktWave1} Q30,${10 - mrktWave2} 60,${18 + mrktWave1} T120,${6 + mrktWave2} T180,${14 - mrktWave1} T240,${2 + mrktWaveEnd}`;
  const niftySparkPath3D = `M0,${25.5 + mrktWave1} Q30,${11.5 - mrktWave2} 60,${19.5 + mrktWave1} T120,${7.5 + mrktWave2} T180,${15.5 - mrktWave1} T240,${3.5 + mrktWaveEnd}`;
  const niftySparkFill = `M0,${24 + mrktWave1} Q30,${10 - mrktWave2} 60,${18 + mrktWave1} T120,${6 + mrktWave2} T180,${14 - mrktWave1} T240,${2 + mrktWaveEnd} L240,36 L0,36 Z`;
  const niftyEndY = 2 + mrktWaveEnd;

  const tCrdt = wavePhase * 1.0 + 2.4;
  const crdtWave1 = Math.sin(tCrdt * 2.4) * 3.0;
  const crdtWave2 = Math.cos(tCrdt * 1.8) * 3.5;
  const crdtWaveEnd = Math.sin(tCrdt * 2.4 + 2) * 3.0;

  const creditSparkPath = `M0,${26 + crdtWave1} Q30,${16 - crdtWave2} 60,${22 + crdtWave1} T120,${10 + crdtWave2} T180,${15 - crdtWave1} T240,${6 + crdtWaveEnd}`;
  const creditSparkPath3D = `M0,${27.5 + crdtWave1} Q30,${17.5 - crdtWave2} 60,${23.5 + crdtWave1} T120,${11.5 + crdtWave2} T180,${16.5 - crdtWave1} T240,${7.5 + crdtWaveEnd}`;
  const creditSparkFill = `M0,${26 + crdtWave1} Q30,${16 - crdtWave2} 60,${22 + crdtWave1} T120,${10 + crdtWave2} T180,${15 - crdtWave1} T240,${6 + crdtWaveEnd} L240,36 L0,36 Z`;
  const creditEndY = 6 + crdtWaveEnd;

  // Ecosystem Capital Flow Paths (Synced 100% with top 3 cards & Centered Vertically!)
  const busEcoPath = `M0,${68 + busWave1 * 1.6} Q75,${50 - busWave2 * 1.6} 150,${64 + busWave1 * 1.6} T300,${52 + busWave2 * 1.6} T425,${66 - busWave1 * 1.6} T500,${54 + busWaveEnd * 1.6}`;
  const busEcoPath3D = `M0,${69.5 + busWave1 * 1.6} Q75,${51.5 - busWave2 * 1.6} 150,${65.5 + busWave1 * 1.6} T300,${53.5 + busWave2 * 1.6} T425,${67.5 - busWave1 * 1.6} T500,${55.5 + busWaveEnd * 1.6}`;
  const busEcoFill = `M0,${68 + busWave1 * 1.6} Q75,${50 - busWave2 * 1.6} 150,${64 + busWave1 * 1.6} T300,${52 + busWave2 * 1.6} T425,${66 - busWave1 * 1.6} T500,${54 + busWaveEnd * 1.6} L500,130 L0,130 Z`;
  const busEcoEndY = 54 + busWaveEnd * 1.6;

  const mrktEcoPath = `M0,${76 + mrktWave1 * 1.6} Q75,${58 - mrktWave2 * 1.6} 150,${72 + mrktWave1 * 1.6} T300,${60 + mrktWave2 * 1.6} T425,${74 - mrktWave1 * 1.6} T500,${62 + mrktWaveEnd * 1.6}`;
  const mrktEcoPath3D = `M0,${77.5 + mrktWave1 * 1.6} Q75,${59.5 - mrktWave2 * 1.6} 150,${73.5 + mrktWave1 * 1.6} T300,${61.5 + mrktWave2 * 1.6} T425,${75.5 - mrktWave1 * 1.6} T500,${63.5 + mrktWaveEnd * 1.6}`;
  const mrktEcoFill = `M0,${76 + mrktWave1 * 1.6} Q75,${58 - mrktWave2 * 1.6} 150,${72 + mrktWave1 * 1.6} T300,${60 + mrktWave2 * 1.6} T425,${74 - mrktWave1 * 1.6} T500,${62 + mrktWaveEnd * 1.6} L500,130 L0,130 Z`;
  const mrktEcoEndY = 62 + mrktWaveEnd * 1.6;

  const crdtEcoPath = `M0,${60 + crdtWave1 * 1.6} Q75,${74 - crdtWave2 * 1.6} 150,${56 + crdtWave1 * 1.6} T300,${70 + crdtWave2 * 1.6} T425,${54 - crdtWave1 * 1.6} T500,${66 + crdtWaveEnd * 1.6}`;
  const crdtEcoPath3D = `M0,${61.5 + crdtWave1 * 1.6} Q75,${75.5 - crdtWave2 * 1.6} 150,${57.5 + crdtWave1 * 1.6} T300,${71.5 + crdtWave2 * 1.6} T425,${55.5 - crdtWave1 * 1.6} T500,${67.5 + crdtWaveEnd * 1.6}`;
  const crdtEcoFill = `M0,${60 + crdtWave1 * 1.6} Q75,${74 - crdtWave2 * 1.6} 150,${56 + crdtWave1 * 1.6} T300,${70 + crdtWave2 * 1.6} T425,${54 - crdtWave1 * 1.6} T500,${66 + crdtWaveEnd * 1.6} L500,130 L0,130 Z`;
  const crdtEcoEndY = 66 + crdtWaveEnd * 1.6;

  // Graph Tooltip Hover Handler
  const handleGraphMouseMove = (e) => {
    if (!graphRef.current) return;
    const rect = graphRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const pct = Math.max(0, Math.min(1, x / width));

    const points = [
      { bus: '₹8.2L', mrkt: '23,900', crdt: '₹1.50L', xPct: 5, label: 'Q1' },
      { bus: '₹9.6L', mrkt: '24,150', crdt: '₹1.80L', xPct: 28, label: 'Q2' },
      { bus: '₹10.8L', mrkt: '24,400', crdt: '₹2.10L', xPct: 52, label: 'Q3' },
      { bus: '₹11.9L', mrkt: '24,620', crdt: '₹2.35L', xPct: 76, label: 'Q4' },
      { bus: '₹12.4L', mrkt: '24,850', crdt: '₹2.50L', xPct: 98, label: 'Live' }
    ];

    let closest = points[0];
    let minDiff = Math.abs(pct * 100 - points[0].xPct);
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(pct * 100 - points[i].xPct);
      if (diff < minDiff) {
        minDiff = diff;
        closest = points[i];
      }
    }

    setHoverData({
      xPx: (closest.xPct / 100) * width,
      pct: closest.xPct,
      ...closest
    });
  };

  const handleGraphMouseLeave = () => {
    setHoverData(null);
  };

  return (
    <div className="hero-dashboard-container" ref={containerRef}>
      <div className="abstract-ui-card">
        
        {/* Visual Header */}
        <div className="abstract-card-header">
          <div className="window-controls">
            <span className="control-dot red" />
            <span className="control-dot yellow" />
            <span className="control-dot green" />
          </div>
          <div className="abstract-status-badge">
            <Activity size={12} color="#12B76A" />
            <span>CONNECTED ECOSYSTEM</span>
          </div>
        </div>

        {/* Phase 1: Top Three Metric Cards */}
        <div className={`abstract-panels-grid ${isVisible ? 'is-visible' : ''}`}>
          
          {/* Card 1: Business Revenue */}
          <div className="dashboard-metric-card card-revenue" tabIndex={0}>
            <div className="metric-card-top">
              <div className="panel-icon-wrap blue">
                <Building2 size={16} />
              </div>
              <span className="panel-label">Business Revenue</span>
            </div>
            
            <div className="panel-value-row">
              <span className="panel-val">₹{revenueVal}L</span>
              <span className="panel-trend positive">
                <ArrowUpRight size={14} /> 18.4%
              </span>
            </div>

            <div className="sparkline-wrapper">
              <svg className="mini-sparkline" viewBox="0 0 240 36" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#214ECF" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#214ECF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path 
                  d={busSparkFill} 
                  fill="url(#revGrad)" 
                  className={`chart-area-fill ${isVisible ? 'fade-fill' : ''}`}
                />
                {/* 3D Extrusion Layer */}
                <path 
                  d={busSparkPath3D} 
                  fill="none" 
                  stroke="#143599" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  opacity="0.5"
                />
                {/* Glowing Primary Top Line */}
                <path 
                  d={busSparkPath} 
                  fill="none" 
                  stroke="#214ECF" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  className="glow-blue-line"
                />
                {/* Glowing Endpoint Node */}
                <g className={`sparkline-node-group ${isVisible ? 'node-active' : ''}`}>
                  <circle cx="240" cy={busEndY} r="4" fill="#214ECF" className="glowing-tip-dot" color="#214ECF" />
                  <circle cx="240" cy={busEndY} r="1.5" fill="#FFFFFF" />
                </g>
              </svg>
            </div>

            <span className="panel-sub">GST auto-reconciled</span>
          </div>

          {/* Card 2: NIFTY 50 Index */}
          <div className="dashboard-metric-card card-nifty" tabIndex={0}>
            <div className="metric-card-top">
              <div className="panel-icon-wrap green">
                <TrendingUp size={16} />
              </div>
              <span className="panel-label">NIFTY 50 Index</span>
            </div>
            
            <div className="panel-value-row">
              <span className="panel-val">{niftyVal.toLocaleString('en-IN')}</span>
              <span className="panel-trend positive-green">
                <ArrowUpRight size={14} /> 1.2%
              </span>
            </div>

            <div className="sparkline-wrapper">
              <svg className="mini-sparkline" viewBox="0 0 240 36" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="niftyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#12B76A" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#12B76A" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path 
                  d={niftySparkFill} 
                  fill="url(#niftyGrad)" 
                  className={`chart-area-fill ${isVisible ? 'fade-fill' : ''}`}
                />
                {/* 3D Extrusion Layer */}
                <path 
                  d={niftySparkPath3D} 
                  fill="none" 
                  stroke="#0B7B45" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  opacity="0.5"
                />
                {/* Glowing Primary Top Line */}
                <path 
                  d={niftySparkPath} 
                  fill="none" 
                  stroke="#12B76A" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  className="glow-green-line"
                />
                {/* Glowing Endpoint Node */}
                <g className={`sparkline-node-group ${isVisible ? 'node-active' : ''}`}>
                  <circle cx="240" cy={niftyEndY} r="4" fill="#12B76A" className="glowing-tip-dot" color="#12B76A" />
                  <circle cx="240" cy={niftyEndY} r="1.5" fill="#FFFFFF" />
                </g>
              </svg>
            </div>

            <span className="panel-sub">IndexPilot AI Signal</span>
          </div>

          {/* Card 3: Credit Available */}
          <div className="dashboard-metric-card card-credit" tabIndex={0}>
            <div className="metric-card-top">
              <div className="panel-icon-wrap purple">
                <CreditCard size={16} />
              </div>
              <span className="panel-label">Credit Available</span>
            </div>
            
            <div className="panel-value-row">
              <span className="panel-val">₹{creditVal.toLocaleString('en-IN')}</span>
              <span className="panel-status-tag purple">Active</span>
            </div>

            <div className="sparkline-wrapper">
              <svg className="mini-sparkline" viewBox="0 0 240 36" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5B800" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#F5B800" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path 
                  d={creditSparkFill} 
                  fill="url(#creditGrad)" 
                  className={`chart-area-fill ${isVisible ? 'fade-fill' : ''}`}
                />
                {/* Line 1: 3D Extrusion Layer */}
                <path 
                  d={creditSparkPath3D} 
                  fill="none" 
                  stroke="#D99E00" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  opacity="0.45"
                />
                {/* Line 2: Secondary Harmonic Stream Line */}
                <path 
                  d={`M0,${24 + crdtWave1 * 0.8} Q30,${14 - crdtWave2 * 0.8} 60,${20 + crdtWave1 * 0.8} T120,${8 + crdtWave2 * 0.8} T180,${13 - crdtWave1 * 0.8} T240,${5 + crdtWaveEnd * 0.8}`} 
                  fill="none" 
                  stroke="#F5B800" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeDasharray="4 3"
                  opacity="0.65"
                />
                {/* Line 3: Glowing Primary Top Line */}
                <path 
                  d={creditSparkPath} 
                  fill="none" 
                  stroke="#F5B800" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  className="glow-yellow-line"
                />
                {/* Glowing Endpoint Node */}
                <g className={`sparkline-node-group ${isVisible ? 'node-active' : ''}`}>
                  <circle cx="240" cy={creditEndY} r="4" fill="#F5B800" className="glowing-tip-dot" color="#F5B800" />
                  <circle cx="240" cy={creditEndY} r="1.5" fill="#FFFFFF" />
                </g>
              </svg>
            </div>

            <span className="panel-sub">Instant pre-approved line</span>
          </div>

        </div>

        {/* Ecosystem Capital Flow Main Graph (100% Synced in Real-Time!) */}
        <div className={`abstract-chart-area ${isVisible ? 'is-visible' : ''}`}>
          <div className="chart-header-line">
            <span className="chart-title">Ecosystem Capital Flow</span>
            
            {/* Legend for 3 Data Lines */}
            <div className="chart-legend-row">
              <span className="legend-item blue">
                <span className="legend-dot blue" /> Business
              </span>
              <span className="legend-item green">
                <span className="legend-dot green" /> Market
              </span>
              <span className="legend-item yellow" style={{ color: '#F5B800' }}>
                <span className="legend-dot yellow" style={{ backgroundColor: '#F5B800' }} /> Credit
              </span>
            </div>
          </div>

          <div 
            className="chart-svg-interactive-wrap"
            ref={graphRef}
            onMouseMove={handleGraphMouseMove}
            onMouseLeave={handleGraphMouseLeave}
          >
            <svg className="abstract-sparkline-svg" viewBox="0 0 500 130" preserveAspectRatio="none">
              <defs>
                <linearGradient id="busGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#214ECF" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#214ECF" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="mrktGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#12B76A" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#12B76A" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="crdtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5B800" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#F5B800" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="#E4E7EC" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="0" y1="65" x2="500" y2="65" stroke="#E4E7EC" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="#E4E7EC" strokeDasharray="3 3" strokeWidth="1" />

              {/* Line 1: Business (Blue - Synced with Business Revenue Card) */}
              <path 
                d={busEcoFill} 
                fill="url(#busGrad)" 
                className={`chart-area-fill ${isVisible ? 'fade-fill' : ''}`}
              />
              <path 
                d={busEcoPath3D} 
                fill="none" 
                stroke="#143599" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                opacity="0.5"
              />
              <path 
                d={busEcoPath} 
                fill="none" 
                stroke="#214ECF" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                className="glow-blue-line"
              />
              <g className={`sparkline-node-group ${isVisible ? 'node-active' : ''}`}>
                <circle cx="500" cy={busEcoEndY} r="5" fill="#214ECF" className="glowing-tip-dot" color="#214ECF" />
                <circle cx="500" cy={busEcoEndY} r="2" fill="#FFFFFF" />
              </g>

              {/* Line 2: Market (Green - Synced with NIFTY 50 Card) */}
              <path 
                d={mrktEcoFill} 
                fill="url(#mrktGrad)" 
                className={`chart-area-fill ${isVisible ? 'fade-fill' : ''}`}
              />
              <path 
                d={mrktEcoPath3D} 
                fill="none" 
                stroke="#0B7B45" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                opacity="0.5"
              />
              <path 
                d={mrktEcoPath} 
                fill="none" 
                stroke="#12B76A" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                className="glow-green-line"
              />
              <g className={`sparkline-node-group ${isVisible ? 'node-active' : ''}`}>
                <circle cx="500" cy={mrktEcoEndY} r="5" fill="#12B76A" className="glowing-tip-dot" color="#12B76A" />
                <circle cx="500" cy={mrktEcoEndY} r="2" fill="#FFFFFF" />
              </g>

              {/* Line 3: Credit (Yellow #F5B800 - Synced with Credit Available Card) */}
              <path 
                d={crdtEcoFill} 
                fill="url(#crdtGrad)" 
                className={`chart-area-fill ${isVisible ? 'fade-fill' : ''}`}
              />
              <path 
                d={crdtEcoPath3D} 
                fill="none" 
                stroke="#D99E00" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                opacity="0.45"
              />
              <path 
                d={crdtEcoPath} 
                fill="none" 
                stroke="#F5B800" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                className="glow-yellow-line"
              />
              <g className={`sparkline-node-group ${isVisible ? 'node-active' : ''}`}>
                <circle cx="500" cy={crdtEcoEndY} r="5" fill="#F5B800" className="glowing-tip-dot" color="#F5B800" />
                <circle cx="500" cy={crdtEcoEndY} r="2" fill="#FFFFFF" />
              </g>

              {/* Hover Guide Line */}
              {hoverData && (
                <g className="hover-guide-group">
                  <line 
                    x1={(hoverData.pct / 100) * 500} 
                    y1="10" 
                    x2={(hoverData.pct / 100) * 500} 
                    y2="120" 
                    stroke="#214ECF" 
                    strokeDasharray="3 3" 
                    strokeWidth="1.5"
                    opacity="0.6" 
                  />
                </g>
              )}
            </svg>

            {/* Hover Tooltip */}
            {hoverData && (
              <div 
                className="graph-hover-tooltip"
                style={{
                  left: `${Math.min(Math.max(15, hoverData.pct), 70)}%`
                }}
              >
                <div className="tooltip-title">{hoverData.label} Telemetry</div>
                <div className="tooltip-row blue">
                  <span>Business:</span> <strong>{hoverData.bus}</strong>
                </div>
                <div className="tooltip-row green">
                  <span>Market:</span> <strong>{hoverData.mrkt}</strong>
                </div>
                <div className="tooltip-row yellow">
                  <span>Credit:</span> <strong>{hoverData.crdt}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phase 2: Bottom Three Analytics Score Cards */}
        <div className={`analytics-cards-grid ${isVisible ? 'is-visible' : ''}`}>

          {/* Card 1: Ledger Health Score */}
          <div className="analytics-score-card card-ledger-health" tabIndex={0} style={{ animationDelay: '0ms' }}>
            <div className="score-card-header">
              <span className="score-card-title">Ledger Health Score</span>
              <span className="score-badge blue">Excellent</span>
            </div>

            <div className="score-main-row">
              <div className="score-val-wrap">
                <div className="score-num-line">
                  <span className="score-number blue">{ledgerScore}</span>
                  <span className="score-denom">/100</span>
                </div>
                <span className="score-change positive-blue">
                  <ArrowUpRight size={13} /> 8 pts
                </span>
              </div>

              {/* Circular Gauge Ring */}
              <div className="gauge-wrap">
                <svg width="44" height="44" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="17" fill="none" stroke="#E4E7EC" strokeWidth="4" />
                  <circle 
                    cx="22" 
                    cy="22" 
                    r="17" 
                    fill="none" 
                    stroke="#214ECF" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    strokeDasharray="106.81"
                    strokeDashoffset={isVisible ? (106.81 * (1 - 0.92)) : 106.81}
                    className="gauge-circle-fill"
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1) 150ms' }}
                  />
                </svg>
              </div>
            </div>

            {/* Mini Trend Sparkline (100% inside card bounds) */}
            <div className="score-sparkline-wrap">
              <svg className="score-sparkline" viewBox="0 0 160 24" preserveAspectRatio="none">
                <path 
                  d={`M0,${19.5 + busWave1 * 0.7} Q40,${9.5 - busWave2 * 0.7} 80,${15.5 + busWave1 * 0.7} T160,${5.5 + busWaveEnd * 0.7}`} 
                  fill="none" 
                  stroke="#143599" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  opacity="0.5"
                />
                <path 
                  d={`M0,${18 + busWave1 * 0.7} Q40,${8 - busWave2 * 0.7} 80,${14 + busWave1 * 0.7} T160,${4 + busWaveEnd * 0.7}`} 
                  fill="none" 
                  stroke="#214ECF" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  className="glow-blue-line"
                />
                <circle cx="160" cy={4 + busWaveEnd * 0.7} r="3" fill="#214ECF" className="glowing-tip-dot" color="#214ECF" />
              </svg>
            </div>
          </div>

          {/* Card 2: Market IQ Score */}
          <div className="analytics-score-card card-market-iq" tabIndex={0} style={{ animationDelay: '100ms' }}>
            <div className="score-card-header">
              <span className="score-card-title">Market IQ Score</span>
              <span className="score-badge green">Strong</span>
            </div>

            <div className="score-main-row">
              <div className="score-val-wrap">
                <div className="score-num-line">
                  <span className="score-number green">{marketScore}</span>
                  <span className="score-denom">/100</span>
                </div>
                <span className="score-change positive-green">
                  <ArrowUpRight size={13} /> 6 pts
                </span>
              </div>

              {/* Circular Gauge Ring */}
              <div className="gauge-wrap">
                <svg width="44" height="44" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="17" fill="none" stroke="#E4E7EC" strokeWidth="4" />
                  <circle 
                    cx="22" 
                    cy="22" 
                    r="17" 
                    fill="none" 
                    stroke="#12B76A" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    strokeDasharray="106.81"
                    strokeDashoffset={isVisible ? (106.81 * (1 - 0.88)) : 106.81}
                    className="gauge-circle-fill"
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1) 250ms' }}
                  />
                </svg>
              </div>
            </div>

            {/* Mini Trend Sparkline (100% inside card bounds) */}
            <div className="score-sparkline-wrap">
              <svg className="score-sparkline" viewBox="0 0 160 24" preserveAspectRatio="none">
                <path 
                  d={`M0,${21.5 + mrktWave1 * 0.7} Q40,${11.5 - mrktWave2 * 0.7} 80,${17.5 + mrktWave1 * 0.7} T160,${7.5 + mrktWaveEnd * 0.7}`} 
                  fill="none" 
                  stroke="#0B7B45" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  opacity="0.5"
                />
                <path 
                  d={`M0,${20 + mrktWave1 * 0.7} Q40,${10 - mrktWave2 * 0.7} 80,${16 + mrktWave1 * 0.7} T160,${6 + mrktWaveEnd * 0.7}`} 
                  fill="none" 
                  stroke="#12B76A" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  className="glow-green-line"
                />
                <circle cx="160" cy={6 + mrktWaveEnd * 0.7} r="3" fill="#12B76A" className="glowing-tip-dot" color="#12B76A" />
              </svg>
            </div>
          </div>

          {/* Card 3: Credit Score */}
          <div className="analytics-score-card card-credit-score" tabIndex={0} style={{ animationDelay: '200ms' }}>
            <div className="score-card-header">
              <span className="score-card-title">Credit Score</span>
              <span className="score-badge yellow">Good</span>
            </div>

            <div className="score-main-row">
              <div className="score-val-wrap">
                <div className="score-num-line">
                  <span className="score-number yellow">{creditScoreVal}</span>
                  <span className="score-denom">/900</span>
                </div>
                <span className="score-change positive-yellow">
                  <ArrowUpRight size={13} /> 15 pts
                </span>
              </div>

              {/* Circular Gauge Ring */}
              <div className="gauge-wrap">
                <svg width="44" height="44" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="17" fill="none" stroke="#E4E7EC" strokeWidth="4" />
                  <circle 
                    cx="22" 
                    cy="22" 
                    r="17" 
                    fill="none" 
                    stroke="#F5B800" 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    strokeDasharray="106.81"
                    strokeDashoffset={isVisible ? (106.81 * (1 - (785 / 900))) : 106.81}
                    className="gauge-circle-fill"
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1) 350ms' }}
                  />
                </svg>
              </div>
            </div>

            {/* Mini Trend Sparkline (100% inside card bounds) */}
            <div className="score-sparkline-wrap">
              <svg className="score-sparkline" viewBox="0 0 160 24" preserveAspectRatio="none">
                <path 
                  d={`M0,${17.5 + crdtWave1 * 0.7} Q40,${7.5 - crdtWave2 * 0.7} 80,${13.5 + crdtWave1 * 0.7} T160,${6.5 + crdtWaveEnd * 0.7}`} 
                  fill="none" 
                  stroke="#D99E00" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  opacity="0.45"
                />
                <path 
                  d={`M0,${16 + crdtWave1 * 0.7} Q40,${6 - crdtWave2 * 0.7} 80,${12 + crdtWave1 * 0.7} T160,${5 + crdtWaveEnd * 0.7}`} 
                  fill="none" 
                  stroke="#F5B800" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  className="glow-yellow-line"
                />
                <circle cx="160" cy={5 + crdtWaveEnd * 0.7} r="3" fill="#F5B800" className="glowing-tip-dot" color="#F5B800" />
              </svg>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default HeroDashboard;
