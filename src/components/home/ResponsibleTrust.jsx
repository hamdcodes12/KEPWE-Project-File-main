import React from 'react';
import { Eye, Shield, Layers, HeartHandshake } from 'lucide-react';
import './ResponsibleTrust.css';

const trustCards = [
  {
    icon: Eye,
    title: 'Transparent',
    description: 'Clear experiences and understandable journeys designed to eliminate ambiguity and hidden friction.',
  },
  {
    icon: Shield,
    title: 'Secure',
    description: 'Responsible engineering for financial experiences, with strict encryption standards and data protection.',
  },
  {
    icon: Layers,
    title: 'Connected',
    description: 'Designed to work across the KEPWE ecosystem, bridging personal, business, and market tools smoothly.',
  },
  {
    icon: HeartHandshake,
    title: 'Human',
    description: 'Technology that keeps the experience simple, supported by professional assistance when you need guidance.',
  },
];

const ResponsibleTrust = () => {
  return (
    <section className="responsible-trust-section" aria-label="Responsible Technology and Trust">
      <div className="container">
        
        {/* Section Header */}
        <div className="trust-header text-center">
          <div className="trust-eyebrow">
            <span className="trust-dot" />
            <span>RESPONSIBLE TECHNOLOGY</span>
          </div>
          <h2 className="trust-title">Built with trust at the core.</h2>
          <p className="trust-subtitle">
            Engineered with privacy, data integrity, and ethical financial technology standards.
          </p>
        </div>

        {/* 4 Trust Cards Grid */}
        <div className="trust-cards-grid">
          {trustCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div key={idx} className="trust-card">
                <div className="trust-card-icon-wrap">
                  <Icon size={22} color="#214ECF" />
                </div>
                <h3 className="trust-card-title">{card.title}</h3>
                <p className="trust-card-desc">{card.description}</p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default ResponsibleTrust;
