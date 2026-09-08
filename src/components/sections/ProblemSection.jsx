import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './ProblemSection.css';

// Observer-based Animated Count-Up Number
const AnimatedNumber = ({ value, suffix = '', duration = 1400 }) => {
  const [displayVal, setDisplayVal] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let start = null;
    let frameId;
    const endVal = typeof value === 'number' ? value : parseFloat(value) || 100;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayVal(Math.round(endVal * easeOut));
      if (progress < 1) frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => { if (frameId) cancelAnimationFrame(frameId); };
  }, [value, duration, isVisible]);

  return <span ref={ref}>{displayVal}{suffix}</span>;
};

const ProblemSection = () => {
  const [activeProblem, setActiveProblem] = useState(0);

  const problems = [
    {
      id: '01',
      title: 'GST & Taxation',
      desc: 'Missed monthly filings, un-reconciled ITC claims, delayed GST 3B/1 returns, and sudden penalty notices.',
      solution: 'Automated ITC reconciliation, guaranteed 100% timely filings, and direct liaison for GST notices.',
      tag: 'Critical Compliance'
    },
    {
      id: '02',
      title: 'Accounting & Books',
      desc: 'Messy bank entries, untracked cash flow, lack of monthly P&L statements, and audit-time chaos.',
      solution: 'Dedicated bookkeeper, automated ledger sync, monthly audit-ready P&L & Balance Sheets.',
      tag: 'Financial Clarity'
    },
    {
      id: '03',
      title: 'Income Tax & Filings',
      desc: 'Advance tax calculation errors, TDS deduction mistakes, delayed ITR filings, and unexpected tax liabilities.',
      solution: 'Proactive quarterly tax estimation, automated TDS filings, and maximum legitimate tax savings.',
      tag: 'Tax Strategy'
    },
    {
      id: '04',
      title: 'Payroll, PF & ESI',
      desc: 'Manual salary calculations, delayed Provident Fund/ESI deposits, PT non-compliance, and employee disputes.',
      solution: 'Automated 1-click payroll processing, direct PF/ESI filing receipts, and digital payslips.',
      tag: 'People Operations'
    },
    {
      id: '05',
      title: 'MCA & Corporate Filings',
      desc: 'Missed DIR-3 KYC deadlines, delayed AOC-4 / MGT-7 filings, heavy daily ROC penalties, and director disqualification.',
      solution: 'Dedicated Company Secretary (CS) tracking all ROC annual & event-based corporate compliances.',
      tag: 'Corporate Governance'
    },
    {
      id: '06',
      title: 'Working Capital & Finance',
      desc: 'Rejected business loan applications due to poor financial documentation or un-audited statements.',
      solution: 'CFO-backed loan dossier preparation, bank credit enhancement, and working capital advisory.',
      tag: 'Growth Capital'
    }
  ];

  return (
    <section className="problem-editorial-section">
      <ScrollReveal animation="fade-up" duration={800} className="problem-container">
        {/* Left Column: Editorial Headline */}
        <div className="problem-left-col">
          <div className="problem-eyebrow">
            <AlertTriangle size={15} className="eyebrow-icon" />
            <span>OPERATIONAL BOTTLENECKS</span>
          </div>

          <h2 className="problem-main-title">
            Running a business is hard enough. <br />
            <span className="title-accent">Compliance shouldn't stop you.</span>
          </h2>

          <p className="problem-description">
            Indian businesses lose hundreds of hours every year coordinating between separate accountants, tax advocates, and payroll software. KEPWE unifies everything into one seamless operating platform.
          </p>

          <div className="problem-left-cta-box">
            <div className="cta-stat">
              <span className="stat-number">
                <AnimatedNumber value={99} suffix="%" />
              </span>
              <span className="stat-label">On-time filing guarantee</span>
            </div>
            <Link to="/free-compliance-check" className="problem-primary-btn">
              Eliminate Filing Friction <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* Right Column: Interactive Accordion List with Staggered Entrance */}
        <div className="problem-right-col">
          <div className="problem-interactive-list">
            {problems.map((prob, idx) => {
              const isActive = activeProblem === idx;
              return (
                <div
                  key={prob.id}
                  className={`problem-item ${isActive ? 'active' : ''}`}
                  style={{
                    animationDelay: `${idx * 80}ms`,
                    transitionDelay: `${idx * 40}ms`
                  }}
                  onClick={() => setActiveProblem(idx)}
                  onMouseEnter={() => setActiveProblem(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveProblem(idx); }}
                >
                  <div className="problem-item-header">
                    <div className="problem-num-badge">{prob.id}</div>
                    <h3 className="problem-item-title">{prob.title}</h3>
                    <span className="problem-tag">{prob.tag}</span>
                    <ChevronRight className="accordion-chevron" size={18} />
                  </div>

                  {isActive && (
                    <div className="problem-item-body">
                      <div className="pain-box">
                        <strong>The Friction:</strong> {prob.desc}
                      </div>
                      <div className="solution-box">
                        <CheckCircle2 size={16} className="solution-icon" />
                        <span><strong>KEPWE Resolution:</strong> {prob.solution}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default ProblemSection;
