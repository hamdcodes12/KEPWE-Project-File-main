import React from 'react';
import { ShieldCheck, Lock, Eye, CheckCircle2 } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './TrustSection.css';

const TRUST_PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Security',
    desc: 'Designed with security-conscious technology and user protection in mind.'
  },
  {
    icon: Lock,
    title: 'Privacy',
    desc: 'Respecting user information and maintaining responsible data practices.'
  },
  {
    icon: Eye,
    title: 'Transparency',
    desc: 'Important financial information presented clearly.'
  },
  {
    icon: CheckCircle2,
    title: 'Responsible Financial Technology',
    desc: 'Designed to help users understand financial information and make informed decisions.'
  }
];

const TrustSection = () => {
  return (
    <section className="trust-pillars-section" aria-label="Built with Trust at the Core">
      <div className="container">
        
        {/* Section Header */}
        <ScrollReveal animation="fade-up" duration={400}>
          <div className="trust-header text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>RESPONSIBLE TECHNOLOGY</span>
            </div>
            <h2 className="trust-title">Built with trust at the core.</h2>
            <p className="trust-subtitle">
              Financial technology should be simple, transparent, and responsible.
            </p>
          </div>
        </ScrollReveal>

        {/* 4 Trust Cards Grid */}
        <div className="trust-cards-grid">
          {TRUST_PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <ScrollReveal key={idx} animation="fade-up" duration={400} delay={idx * 80}>
                <div className="trust-pillar-card">
                  <div className="trust-pillar-icon">
                    <Icon size={22} color="#214ECF" />
                  </div>
                  <h3 className="trust-pillar-heading">{pillar.title}</h3>
                  <p className="trust-pillar-desc">{pillar.desc}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default TrustSection;
