import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Shield, FileText, Users, Calculator, Briefcase, Landmark, ShieldCheck, Sparkles } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './ServicesGrid.css';

// Reusable Animated Pillar Label Component (Masked Number Reveal + Delayed Text + Left-to-Right Accent Line Draw)
const AnimatedPillarLabel = ({ num, text }) => {
  const [isVisible, setIsVisible] = useState(false);
  const labelRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );
    if (labelRef.current) observer.observe(labelRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={labelRef} className={`animated-pillar-label ${isVisible ? 'is-visible' : ''}`}>
      <div className="pillar-num-wrapper">
        <span className="pillar-number">{num}</span>
      </div>
      <span className="pillar-dash">—</span>
      <span className="pillar-text">{text}</span>
      <div className="pillar-accent-line" />
    </div>
  );
};

const ServicesGrid = () => {
  return (
    <section className="services-showcase-section">
      <ScrollReveal animation="fade-up" duration={850} className="services-container">
        {/* Section Header */}
        <div className="services-header">
          <div className="services-eyebrow">
            <Sparkles size={14} />
            <span>FULL-STACK OPERATING PILLARS</span>
          </div>
          <h2 className="services-main-title">8 Comprehensive <span className="title-accent">Service Pillars</span></h2>
          <p className="services-subtitle">
            Replaces disconnected local accountants with one enterprise-grade platform.
          </p>
        </div>

        {/* Asymmetric Bento Grid Layout with Controlled Multi-Color Palette */}
        <div className="services-bento-grid">
          {/* FEATURED CARD 1: GST & TAXATION (LARGE 2-COLUMN SPAN - BLUE THEME) */}
          <div className="service-card featured-card card-theme-blue">
            <div className="card-badge-row">
              <AnimatedPillarLabel num="01" text="FEATURED PILLAR" />
              <span className="live-status-chip">High Demand</span>
            </div>
            
            <h3 className="featured-title">GST, Taxation & Tax Planning</h3>
            <p className="featured-desc">
              Complete end-to-end GST management. From fresh GSTIN registration to monthly GSTR-1, 3B returns, automated Input Tax Credit (ITC) matching, TDS filings, and Income Tax returns.
            </p>

            <div className="featured-capabilities">
              <div className="capability-item"><CheckCircle2 size={16} color="#38BDF8" /> <span>GST Registration & Monthly GSTR-1 / 3B Filings</span></div>
              <div className="capability-item"><CheckCircle2 size={16} color="#38BDF8" /> <span>2B vs Purchase Register Automated ITC Matching</span></div>
              <div className="capability-item"><CheckCircle2 size={16} color="#38BDF8" /> <span>TDS Quarterly Filings & Form 16/16A Issuance</span></div>
              <div className="capability-item"><CheckCircle2 size={16} color="#38BDF8" /> <span>Corporate Income Tax Returns & Advance Tax Planning</span></div>
            </div>

            <div className="card-action-bar">
              <Link to="/gst" className="featured-cta-btn">
                Explore GST & Tax Services <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {/* CARD 2: ACCOUNTING & BOOKS (BLUE THEME) */}
          <div className="service-card standard-card card-theme-blue">
            <AnimatedPillarLabel num="02" text="PILLAR" />
            <h3 className="card-title">Accounting & Books</h3>
            <p className="card-desc">Audit-ready bookkeeping, bank entry reconciliation, and monthly profit & loss reports.</p>
            <ul className="card-checklist">
              <li><CheckCircle2 size={15} color="#2563EB" /> Daily Transaction Ledgering</li>
              <li><CheckCircle2 size={15} color="#2563EB" /> Monthly Financial Statements</li>
            </ul>
            <Link to="/solutions/accounting" className="card-link">Explore Accounting →</Link>
          </div>

          {/* CARD 3: CORPORATE COMPLIANCE (INDIGO THEME) */}
          <div className="service-card standard-card card-theme-indigo">
            <AnimatedPillarLabel num="03" text="PILLAR" />
            <h3 className="card-title">Corporate Compliance</h3>
            <p className="card-desc">MCA / ROC annual filings, AOC-4, MGT-7, and Director DIR-3 KYC compliance.</p>
            <ul className="card-checklist">
              <li><CheckCircle2 size={15} color="#4F46E5" /> ROC Annual Compliance</li>
              <li><CheckCircle2 size={15} color="#4F46E5" /> Board Resolutions & Minutes</li>
            </ul>
            <Link to="/solutions/compliance" className="card-link">Explore MCA Compliance →</Link>
          </div>

          {/* CARD 4: PAYROLL & HR (TEAL THEME) */}
          <div className="service-card standard-card card-theme-teal">
            <AnimatedPillarLabel num="04" text="PILLAR" />
            <h3 className="card-title">Payroll & HR</h3>
            <p className="card-desc">Automated payroll run, PF/ESI filing, Professional Tax, and digital payslips.</p>
            <ul className="card-checklist">
              <li><CheckCircle2 size={15} color="#0F9F8A" /> 1-Click Monthly Payroll</li>
              <li><CheckCircle2 size={15} color="#0F9F8A" /> PF & ESI Challan Deposits</li>
            </ul>
            <Link to="/solutions/payroll" className="card-link">Explore Payroll →</Link>
          </div>

          {/* CARD 5: VIRTUAL CFO (HIGH-VALUE CARD - INDIGO/VIOLET TINT) */}
          <div className="service-card card-theme-highvalue">
            <AnimatedPillarLabel num="05" text="HIGH VALUE" />
            <h3 className="card-title">Virtual CFO Advisory</h3>
            <p className="card-desc">Senior CFO advisory for cash flow management, budgeting, unit economics, and board reporting.</p>
            <ul className="card-checklist">
              <li><CheckCircle2 size={15} color="#4F46E5" /> Weekly Cashflow Runway Tracking</li>
              <li><CheckCircle2 size={15} color="#4F46E5" /> Investor Financial Deck Prep</li>
            </ul>
            <Link to="/virtual-cfo" className="card-link">Explore Virtual CFO →</Link>
          </div>

          {/* CARD 6: BUSINESS REGISTRATIONS (VIOLET THEME) */}
          <div className="service-card standard-card card-theme-violet">
            <AnimatedPillarLabel num="06" text="PILLAR" />
            <h3 className="card-title">Business Registrations</h3>
            <p className="card-desc">MSME Udyam, Import-Export Code (IEC), FSSAI, Shops & Establishment, and Trade License.</p>
            <ul className="card-checklist">
              <li><CheckCircle2 size={15} color="#7C3AED" /> Fast-Track License Setup</li>
              <li><CheckCircle2 size={15} color="#7C3AED" /> Startup India Recognition</li>
            </ul>
            <Link to="/new-company" className="card-link">Explore Setup →</Link>
          </div>

          {/* CARD 7: BUSINESS FINANCE (AMBER THEME) */}
          <div className="service-card standard-card card-theme-amber">
            <AnimatedPillarLabel num="07" text="CAPITAL" />
            <h3 className="card-title">Business Finance</h3>
            <p className="card-desc">Working capital loans, collateral-free business loans, and invoice discounting.</p>
            <ul className="card-checklist">
              <li><CheckCircle2 size={15} color="#D97706" /> Bank Credit Dossier Prep</li>
              <li><CheckCircle2 size={15} color="#D97706" /> Working Capital Assistance</li>
            </ul>
            <Link to="/solutions/loans" className="card-link">Explore Finance →</Link>
          </div>

          {/* CARD 8: INSURANCE (SLATE THEME) */}
          <div className="service-card standard-card card-theme-slate">
            <AnimatedPillarLabel num="08" text="PROTECTION" />
            <h3 className="card-title">Corporate Insurance</h3>
            <p className="card-desc">Group health insurance for employees, Directors & Officers (D&O) liability, and Cyber insurance.</p>
            <ul className="card-checklist">
              <li><CheckCircle2 size={15} color="#475569" /> Group Health Policies</li>
              <li><CheckCircle2 size={15} color="#475569" /> Professional Liability</li>
            </ul>
            <Link to="/solutions/insurance" className="card-link">Explore Protection →</Link>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default ServicesGrid;
