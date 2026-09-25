import React from 'react';
import { Link } from 'react-router-dom';
import './GSTLandingPage.css';
import './VirtualCFOHero.css';
import './NewCompanyHero.css';
import { 
  ShieldCheck, 
  CheckCircle, 
  ArrowRight, 
  Award, 
  FileText, 
  FileCheck, 
  FileSpreadsheet, 
  RefreshCw, 
  Layers, 
  Bell, 
  XCircle, 
  Search, 
  Zap, 
  Lock, 
  Headphones,
  BriefcaseBusiness,
  TrendingUp,
  MessageCircle,
  BadgeCheck,
  Calculator,
  Landmark,
  UsersRound,
  FileCheck2,
  Building2,
  ChartNoAxesCombined
} from 'lucide-react';

export const NewCompanyPage = () => {
  const services = [
    {
      name: 'GST Registration',
      icon: BadgeCheck,
      color: '#214ECF',
      bg: 'rgba(33, 78, 207, 0.07)',
      border: 'rgba(33, 78, 207, 0.14)'
    },
    {
      name: 'Accounting Setup',
      icon: Calculator,
      color: '#14B8A6',
      bg: 'rgba(20, 184, 166, 0.07)',
      border: 'rgba(20, 184, 166, 0.14)'
    },
    {
      name: 'Corporate Tax',
      icon: Landmark,
      color: '#7C3AED',
      bg: 'rgba(124, 58, 237, 0.07)',
      border: 'rgba(124, 58, 237, 0.14)'
    },
    {
      name: 'Payroll & HR',
      icon: UsersRound,
      color: '#06B6D4',
      bg: 'rgba(6, 182, 212, 0.07)',
      border: 'rgba(6, 182, 212, 0.14)'
    },
    {
      name: 'MCA Annual Compliance',
      icon: FileCheck2,
      color: '#214ECF',
      bg: 'rgba(33, 78, 207, 0.07)',
      border: 'rgba(33, 78, 207, 0.14)'
    },
    {
      name: 'Business Banking',
      icon: Building2,
      color: '#14B8A6',
      bg: 'rgba(20, 184, 166, 0.07)',
      border: 'rgba(20, 184, 166, 0.14)'
    },
    {
      name: 'Financial Planning',
      icon: ChartNoAxesCombined,
      color: '#7C3AED',
      bg: 'rgba(124, 58, 237, 0.07)',
      border: 'rgba(124, 58, 237, 0.14)'
    }
  ];

  return (
    <div className="nc-hero-wrapper">
      {/* Background Gradients & Technical Grid */}
      <div className="nc-bg-glow nc-bg-glow-blue" aria-hidden="true" />
      <div className="nc-bg-glow nc-bg-glow-cyan" aria-hidden="true" />
      <div className="nc-bg-glow nc-bg-glow-lavender" aria-hidden="true" />
      <div className="nc-bg-grid" aria-hidden="true" />

      {/* Floating Decorative Elements */}
      <div className="nc-float-dot-1" aria-hidden="true" />
      <div className="nc-float-dot-2" aria-hidden="true" />
      <div className="nc-float-circle-1" aria-hidden="true" />
      <div className="nc-float-circle-2" aria-hidden="true" />

      <div className="nc-hero-container">
        {/* /new-company Badge */}
        <div className="nc-badge-pill">
          <Building2 size={15} className="nc-badge-icon" />
          <span className="nc-badge-text">/new-company</span>
        </div>

        {/* Main Heading (Exact text preserved with blue accent on "company") */}
        <h1 className="nc-hero-heading">
          Just incorporated your <span className="nc-accent-blue">company?</span>
        </h1>

        {/* Subtitle (Exact text preserved) */}
        <p className="nc-hero-subtitle">
          Congratulations. Now let’s take care of everything else.
        </p>

        {/* 3-Column Service Grid with Unique Meaningful Outline Icons */}
        <div className="nc-service-grid">
          {services.map((item, idx) => {
            const IconComp = item.icon;
            return (
              <div 
                key={item.name} 
                className="nc-service-card"
                style={{ animationDelay: `${(idx + 1) * 80}ms` }}
              >
                <div 
                  className="nc-icon-container" 
                  style={{ background: item.bg, border: `1px solid ${item.border}` }}
                >
                  <IconComp size={21} color={item.color} strokeWidth={2} />
                </div>
                <span className="nc-service-title">{item.name}</span>
              </div>
            );
          })}
        </div>

        {/* Primary CTA (Exact text "Set Up My Business" & link "/free-compliance-check" preserved) */}
        <div className="nc-cta-wrap">
          <Link to="/free-compliance-check" className="nc-btn-primary">
            <span>Set Up My Business</span>
            <ArrowRight size={18} className="nc-btn-arrow" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export const GSTLandingPage = () => {
  const serviceItems = [
    { label: 'GST Registration', icon: FileCheck, color: '#14B8A6' },
    { label: 'Return filing', icon: FileSpreadsheet, color: '#214ECF' },
    { label: 'Reconciliation', icon: RefreshCw, color: '#06B6D4' },
    { label: 'ITC management', icon: Layers, color: '#214ECF' },
    { label: 'GST notices', icon: Bell, color: '#14B8A6' },
    { label: 'LUT', icon: FileText, color: '#06B6D4' },
    { label: 'GST cancellation', icon: XCircle, color: '#214ECF' }
  ];

  return (
    <div className="gst-hero-wrapper">
      {/* Background Gradients & Technical Grid */}
      <div className="gst-bg-glow gst-bg-glow-blue" aria-hidden="true" />
      <div className="gst-bg-glow gst-bg-glow-lavender" aria-hidden="true" />
      <div className="gst-bg-glow gst-bg-glow-cyan" aria-hidden="true" />
      <div className="gst-bg-grid" aria-hidden="true" />

      {/* Floating Decorative Elements */}
      <div className="gst-float-dot-1" aria-hidden="true" />
      <div className="gst-float-dot-2" aria-hidden="true" />
      <div className="gst-float-circle-1" aria-hidden="true" />
      <div className="gst-float-circle-2" aria-hidden="true" />

      <div className="gst-hero-container">
        {/* 2. /GST Badge */}
        <div className="gst-badge-pill">
          <FileText size={16} className="gst-badge-icon" />
          <span className="gst-badge-text">/gst</span>
        </div>

        {/* 3. Main Hero Heading (Exact wording preserved) */}
        <h1 className="gst-hero-heading">
          <span className="gst-text-dark">GST compliance</span>{' '}
          <span className="gst-text-blue">without the headache</span>
          <span className="gst-text-dot">.</span>
        </h1>

        {/* 5. Service Description */}
        <p className="gst-service-desc">
          GST Registration · Return filing · Reconciliation · ITC management · GST notices · LUT · GST cancellation
        </p>

        {/* 6. Service Icon Row */}
        <div className="gst-services-row">
          {serviceItems.map((item) => {
            const IconComp = item.icon;
            return (
              <div key={item.label} className="gst-service-chip">
                <span className="gst-chip-icon" style={{ color: item.color }}>
                  <IconComp size={15} />
                </span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* 7, 8 & 9. Primary & Secondary CTAs */}
        <div className="gst-cta-group">
          <Link to="/free-compliance-check" className="gst-btn-primary">
            <span>Get GST Assistance</span>
            <ArrowRight size={18} className="gst-btn-arrow" />
          </Link>

          <Link to="/free-compliance-check" className="gst-btn-secondary">
            <Search size={17} />
            <span>Check GST Compliance</span>
            <ArrowRight size={18} className="gst-btn-arrow" />
          </Link>
        </div>

        {/* 10, 11 & 12. Trust / Feature Glass Strip */}
        <div className="gst-trust-strip">
          <div className="gst-trust-grid">
            <div className="gst-trust-item">
              <div className="gst-trust-icon-box icon-bg-teal">
                <ShieldCheck size={24} />
              </div>
              <div className="gst-trust-content">
                <div className="gst-trust-title">100% Compliant</div>
                <div className="gst-trust-desc">Zero penalty guarantee & automated error checks</div>
              </div>
            </div>

            <div className="gst-trust-item">
              <div className="gst-trust-icon-box icon-bg-blue">
                <Zap size={24} />
              </div>
              <div className="gst-trust-content">
                <div className="gst-trust-title">Save Time</div>
                <div className="gst-trust-desc">10x faster filing with automated reconciliation</div>
              </div>
            </div>

            <div className="gst-trust-item">
              <div className="gst-trust-icon-box icon-bg-purple">
                <Lock size={24} />
              </div>
              <div className="gst-trust-content">
                <div className="gst-trust-title">Secure & Reliable</div>
                <div className="gst-trust-desc">Bank-grade encryption & 100% GSTN uptime</div>
              </div>
            </div>

            <div className="gst-trust-item">
              <div className="gst-trust-icon-box icon-bg-cyan">
                <Headphones size={24} />
              </div>
              <div className="gst-trust-content">
                <div className="gst-trust-title">Expert Support</div>
                <div className="gst-trust-desc">Dedicated CA & GST practitioner assistance</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VirtualCFOPage = () => {
  const steps = [
    'Financial Planning',
    'Cash Flow',
    'MIS',
    'Forecasting',
    'Profitability',
    'Strategic Decisions'
  ];

  return (
    <div className="vcfo-hero-wrapper">
      {/* Background Gradients & Technical Grid */}
      <div className="vcfo-bg-glow vcfo-bg-glow-blue" aria-hidden="true" />
      <div className="vcfo-bg-glow vcfo-bg-glow-cyan" aria-hidden="true" />
      <div className="vcfo-bg-glow vcfo-bg-glow-lavender" aria-hidden="true" />
      <div className="vcfo-bg-grid" aria-hidden="true" />

      {/* Floating Decorative Elements */}
      <div className="vcfo-float-dot-1" aria-hidden="true" />
      <div className="vcfo-float-dot-2" aria-hidden="true" />
      <div className="vcfo-float-circle-1" aria-hidden="true" />
      <div className="vcfo-float-circle-2" aria-hidden="true" />

      <div className="vcfo-hero-container">
        {/* 3. /virtual-cfo Badge */}
        <div className="vcfo-badge-pill">
          <BriefcaseBusiness size={15} className="vcfo-badge-icon" />
          <span className="vcfo-badge-text">/virtual-cfo</span>
        </div>

        {/* 4 & 5. Main Hero Heading */}
        <h1 className="vcfo-hero-heading">
          Get a CFO without hiring one <span className="vcfo-accent-blue">full-time.</span>
        </h1>

        {/* 7, 8, 9, 10, 11 & 12. Floating Glass Value Ladder Card */}
        <div className="vcfo-ladder-card">
          <div className="vcfo-ladder-header">
            <TrendingUp size={16} className="vcfo-ladder-header-icon" />
            <h3 className="vcfo-ladder-title">VIRTUAL CFO VALUE LADDER</h3>
          </div>

          <div className="vcfo-ladder-flow">
            {steps.map((step, idx) => {
              const isFinal = idx === steps.length - 1;
              return (
                <React.Fragment key={step}>
                  <div 
                    className={`vcfo-step-pill ${isFinal ? 'vcfo-step-final' : ''}`}
                    style={{ animationDelay: `${(idx + 1) * 90}ms` }}
                  >
                    <span>{step}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <span className="vcfo-arrow" aria-hidden="true">→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* 14, 15 & 16. Primary CTA Button */}
        <div className="vcfo-cta-wrap">
          <Link to="/contact" className="vcfo-btn-primary">
            <BriefcaseBusiness size={17} />
            <span>Talk to a CFO</span>
            <ArrowRight size={18} className="vcfo-btn-arrow" />
          </Link>
        </div>
      </div>
    </div>
  );
};
