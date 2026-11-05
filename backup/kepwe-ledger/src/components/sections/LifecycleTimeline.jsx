import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, CheckCircle2, ArrowRight, TrendingUp, FileText, Layers, Award, BarChart3, Building } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './LifecycleTimeline.css';

const LifecycleTimeline = () => {
  const [activeStage, setActiveStage] = useState(2); // Comply default
  const [isVisible, setIsVisible] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const sectionRef = useRef(null);

  const stages = [
    {
      id: 0,
      phase: '01',
      name: 'Incorporate',
      tagline: 'Business Setup',
      desc: 'Pvt Ltd, LLP, OPC, or Partnership incorporation with MOA/AOA, DIN, DSC, and Digital Incorporation Certificate.',
      deliverables: ['Certificate of Incorporation', 'Company PAN & TAN', 'Digital Signature Certificates (DSC)'],
      icon: Building
    },
    {
      id: 1,
      phase: '02',
      name: 'Register',
      tagline: 'Statutory IDs',
      desc: 'Obtain all required operating licenses: GSTIN registration, MSME Udyam, Import-Export Code (IEC), and Professional Tax.',
      deliverables: ['GSTIN Certificate', 'MSME Udyam Registration', 'Current Bank Account Opening Support'],
      icon: Layers
    },
    {
      id: 2,
      phase: '03',
      name: 'Comply',
      tagline: 'Monthly Filings',
      desc: 'Never worry about tax deadlines. Complete management of monthly GSTR-1/3B, TDS quarterly returns, and MCA ROC filings.',
      deliverables: ['Zero-Delay Filing Guarantee', 'Input Tax Credit (ITC) Reconciliation', 'ROC Annual Return Filings'],
      icon: ShieldCheck
    },
    {
      id: 3,
      phase: '04',
      name: 'Account',
      tagline: 'Books & Ledger',
      desc: 'Professional double-entry bookkeeping, monthly profit & loss reports, balance sheet finalization, and audit assistance.',
      deliverables: ['Monthly MIS Reports', 'Bank Account Reconciliation', 'Audited Annual Financials'],
      icon: FileText
    },
    {
      id: 4,
      phase: '05',
      name: 'Grow',
      tagline: 'Virtual CFO',
      desc: 'Strategic financial oversight: cash flow forecasting, unit economics analysis, budgeting, and board deck presentation.',
      deliverables: ['Weekly Cash Flow Runway', 'Unit Economics & Margin Audit', 'Board & Investor Deck Preparation'],
      icon: TrendingUp
    },
    {
      id: 5,
      phase: '06',
      name: 'Finance',
      tagline: 'Capital Access',
      desc: 'Unlock business loans, working capital lines of credit, and invoice discounting with CFO-prepared dossiers.',
      deliverables: ['Bank Credit Dossier', 'Working Capital Advisory', 'Equipment & Term Loans'],
      icon: BarChart3
    },
    {
      id: 6,
      phase: '07',
      name: 'Scale',
      tagline: 'Enterprise Ops',
      desc: 'Multi-entity consolidation, ESOP structuring, internal compliance audits, and preparation for fundraising or M&A.',
      deliverables: ['Group Financial Consolidation', 'ESOP Compliance Scheme', 'Due Diligence Readiness'],
      icon: Award
    }
  ];

  // Step-by-step progressive line journey animation upon scroll entry
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    // Step 1: Start at Node 01 (0%), after 300ms move to Node 02 (16.66%)
    const t1 = setTimeout(() => {
      setActiveStage(1);
      setProgressWidth((1 / (stages.length - 1)) * 100);
    }, 400);

    // Step 2: Move from Node 02 to Node 03 (33.33%) after 1100ms
    const t2 = setTimeout(() => {
      setActiveStage(2);
      setProgressWidth((2 / (stages.length - 1)) * 100);
    }, 1300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isVisible, stages.length]);

  return (
    <section className="lifecycle-section" ref={sectionRef}>
      <ScrollReveal animation="fade-up" duration={800} className="lifecycle-container">
        {/* Header */}
        <div className="lifecycle-header">
          <div className="lifecycle-badge">BUSINESS LIFECYCLE ENGINE</div>
          <h2 className="lifecycle-title">One financial & compliance partner <span className="title-accent">for every stage</span></h2>
          <p className="lifecycle-subtitle">
            From Day 1 incorporation to enterprise scale — KEPWE manages your complete financial backbone.
          </p>
        </div>

        {/* Horizontal Progress Track with Progressive Animated Draw Line */}
        <div className="lifecycle-track-wrapper">
          <div className="lifecycle-track-line">
            <div
              className="lifecycle-progress-fill"
              style={{
                width: `${progressWidth}%`,
                transition: 'width 1400ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />
          </div>

          <div className="lifecycle-nodes">
            {stages.map((stage) => {
              const isActive = activeStage === stage.id;
              const isPast = activeStage > stage.id;
              const IconComp = stage.icon;

              return (
                <button
                  key={stage.id}
                  className={`lifecycle-node ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                  onClick={() => {
                    setActiveStage(stage.id);
                    setProgressWidth((stage.id / (stages.length - 1)) * 100);
                  }}
                  aria-label={`Select stage ${stage.name}`}
                >
                  <div className="node-circle">
                    {isPast ? <CheckCircle2 size={18} /> : <IconComp size={18} />}
                  </div>
                  <span className="node-phase">{stage.phase}</span>
                  <span className="node-name">{stage.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Stage Detailed Card */}
        <div className="lifecycle-detail-card">
          <div className="detail-meta-side">
            <div className="detail-phase-tag">STAGE {stages[activeStage].phase} OF 07</div>
            <h3 className="detail-stage-name">{stages[activeStage].name}</h3>
            <span className="detail-tagline">{stages[activeStage].tagline}</span>
            <p className="detail-desc">{stages[activeStage].desc}</p>
          </div>

          <div className="detail-deliverables-side">
            <h4 className="deliverables-title">Key Deliverables Managed By KEPWE:</h4>
            <div className="deliverables-grid">
              {stages[activeStage].deliverables.map((item, i) => (
                <div key={i} className="deliverable-chip">
                  <CheckCircle2 size={16} className="chip-icon" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default LifecycleTimeline;
