import React from 'react';
import { Sparkles, Eye, Layers, ShieldCheck, Cpu } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './OurVisionSection.css';

const OurVisionSection = () => {
  return (
    <section className="our-vision-section" aria-label="Our Vision">
      <div className="vision-ambient-glow" aria-hidden="true" />
      
      <div className="container vision-container">
        <ScrollReveal animation="fade-up" duration={500}>
          <div className="vision-card">
            <div className="vision-bg-pattern" aria-hidden="true" />

            <div className="vision-eyebrow">
              <Sparkles size={14} />
              <span>THE FUTURE OF FINANCIAL TECH</span>
            </div>

            <h2 className="vision-heading">Our Vision</h2>

            <div className="vision-quote-box">
              <p className="vision-highlight-text">
                "To make financial technology more intelligent, accessible, and connected."
              </p>
              
              <p className="vision-detailed-desc">
                Kepwe is building a new generation of financial products where technology doesn't just process financial information — it helps people understand it.
              </p>
            </div>

            <div className="vision-badges-strip">
              <div className="vision-badge-item">
                <Cpu size={16} color="#2563EB" />
                <span>Intelligent Processing</span>
              </div>
              <div className="vision-badge-item">
                <Eye size={16} color="#2563EB" />
                <span>Total Transparency</span>
              </div>
              <div className="vision-badge-item">
                <Layers size={16} color="#2563EB" />
                <span>Unified Ecosystem</span>
              </div>
              <div className="vision-badge-item">
                <ShieldCheck size={16} color="#10B981" />
                <span>Responsible Technology</span>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default OurVisionSection;
