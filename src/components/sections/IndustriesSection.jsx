import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Building2, TrendingUp, Landmark, ArrowRight, CheckCircle2 } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './IndustriesSection.css';

const IndustriesSection = () => {
  const segments = [
    {
      title: 'Startups & Founders',
      tagline: 'Seed to Series A',
      desc: 'Fast-track DPIIT startup recognition, 80-IAC tax exemption, CapTable advisory, and investor-ready MIS dashboards.',
      highlights: ['CapTable & ESOP Structuring', 'DPIIT & 80-IAC Tax Exemption', 'Investor Due Diligence Dossier'],
      icon: Rocket,
      badge: 'For Founders'
    },
    {
      title: 'SMEs & Family Businesses',
      tagline: 'Established Operations',
      desc: 'Transition from traditional offline munimji accounting to digital double-entry bookkeeping with 100% filing accuracy.',
      highlights: ['Automated Bank Reconciliation', 'GST 2B ITC Maximization', 'ROC Annual Compliance Filings'],
      icon: Building2,
      badge: 'For SMEs'
    },
    {
      title: 'High-Growth Tech Companies',
      tagline: 'Scaling Operations',
      desc: 'Multi-entity ledger consolidation, international remittance (FIRC/15CA-CB), and Virtual CFO oversight.',
      highlights: ['FIRC & Cross-Border Remittances', 'Group Financial Consolidation', 'Virtual CFO Strategy Retainer'],
      icon: TrendingUp,
      badge: 'For Scaleups'
    },
    {
      title: 'Enterprises & Franchises',
      tagline: 'Multi-Location Ops',
      desc: 'Multi-state GST registration, state-wise PT filings, centralized payroll for 500+ employees, and custom audit trails.',
      highlights: ['Multi-State GST Compliance', 'Enterprise Payroll & Statutory PF', 'Custom Internal Controls Audit'],
      icon: Landmark,
      badge: 'For Enterprises'
    }
  ];

  return (
    <section className="industries-section">
      <div className="industries-container">
        <ScrollReveal animation="fade-up" duration={350} className="industries-header">
          <div className="industries-eyebrow">TAILORED FOR YOUR INDUSTRY</div>
          <h2 className="industries-title">Engineered for businesses <span className="title-accent">at every milestone</span></h2>
          <p className="industries-subtitle">
            Whether you're incorporating your first startup or managing a multi-state enterprise, KEPWE delivers tailored financial infrastructure.
          </p>
        </ScrollReveal>

        <div className="industries-grid">
          {segments.map((seg, idx) => {
            const IconComp = seg.icon;
            return (
              <ScrollReveal
                key={seg.title}
                animation="scale-up"
                duration={350}
                delay={idx * 60}
                className={`industry-tile tile-${idx + 1}`}
              >
                <div className="tile-top">
                  <div className="tile-icon-box">
                    <IconComp size={24} color="#2563EB" />
                  </div>
                  <span className="tile-badge">{seg.badge}</span>
                </div>

                <h3 className="tile-title">{seg.title}</h3>
                <span className="tile-tagline">{seg.tagline}</span>
                <p className="tile-desc">{seg.desc}</p>

                <div className="tile-highlights">
                  {seg.highlights.map((h, i) => (
                    <div key={i} className="highlight-row">
                      <CheckCircle2 size={15} color="#2563EB" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>

                <Link to="/free-compliance-check" className="tile-link">
                  Explore Solutions <ArrowRight size={16} />
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default IndustriesSection;
