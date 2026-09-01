import React from 'react';
import { Shield, Sparkles, CheckCircle2, Lock } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './TrustStrip.css';

const TrustStrip = () => {
  const categories = [
    'GST & Tax Compliance',
    'Double-Entry Accounting',
    'MCA Corporate Filings',
    'Payroll, PF & ESI',
    'Virtual CFO Advisory',
    'Business Registrations',
    'Working Capital Finance'
  ];

  return (
    <section className="trust-credibility-band">
      <ScrollReveal animation="fade-up" duration={850} className="trust-container">
        <div className="trust-left-statement">
          <div className="trust-eyebrow">
            <Shield size={14} color="#17E7C0" />
            <span>ENTERPRISE TRUSTED PLATFORM</span>
          </div>
          <h3 className="trust-statement-title">
            One platform. One dedicated team. <br />
            <span className="statement-highlight">Complete business financial clarity.</span>
          </h3>
        </div>

        <div className="trust-right-chips">
          <div className="chips-label">CORE COVERAGE DOMAINS:</div>
          <div className="chips-wrapper">
            {categories.map((cat) => (
              <span key={cat} className="trust-chip">
                <CheckCircle2 size={13} className="chip-check" />
                {cat}
              </span>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default TrustStrip;
