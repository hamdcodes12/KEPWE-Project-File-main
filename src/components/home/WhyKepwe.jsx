import React from 'react';
import { Eye, Network, Cpu, Compass } from 'lucide-react';
import './WhyKepwe.css';

const pillars = [
  {
    icon: Eye,
    title: 'Clarity',
    shortDesc: 'Make important financial information easier to understand.',
    detail: 'Eliminate confusion with real-time visual dashboards and straightforward insights.',
  },
  {
    icon: Network,
    title: 'Connection',
    shortDesc: 'Bring financial experiences together.',
    detail: 'Link business bookkeeping, market intelligence, and credit workflows seamlessly.',
  },
  {
    icon: Cpu,
    title: 'Intelligence',
    shortDesc: 'Turn information into useful insight.',
    detail: 'Actionable options signals, automated reconciliation, and predictive cashflow models.',
  },
  {
    icon: Compass,
    title: 'Accessibility',
    shortDesc: 'Make financial technology easier to navigate.',
    detail: 'Intuitive modern interfaces built for enterprise founders and retail participants alike.',
  },
];

const WhyKepwe = () => {
  return (
    <section className="why-kepwe-section" aria-label="Why Choose KEPWE">
      <div className="container">
        
        {/* Section Header */}
        <div className="why-kepwe-header text-center">
          <div className="why-kepwe-eyebrow">
            <span className="why-kepwe-dot" />
            <span>WHY KEPWE?</span>
          </div>
          <h2 className="why-kepwe-title">Built around the way financial decisions happen.</h2>
          <p className="why-kepwe-subtitle">
            Engineered to remove friction and replace fragmented tools with cohesive financial technology.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="why-kepwe-grid">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div key={idx} className="why-pillar-card">
                <div className="why-icon-wrap">
                  <Icon size={24} strokeWidth={1.8} color="#214ECF" />
                </div>
                <h3 className="why-pillar-title">{pillar.title}</h3>
                <p className="why-pillar-short">{pillar.shortDesc}</p>
                <p className="why-pillar-detail">{pillar.detail}</p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default WhyKepwe;
