import React from 'react';
import { Sparkles, Cpu, Layers, ShieldCheck, Zap } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './WhyKepweSection.css';

const WHY_ITEMS = [
  {
    icon: Sparkles,
    title: 'Simple',
    desc: 'Clean interfaces, intuitive design, and zero learning curve.'
  },
  {
    icon: Cpu,
    title: 'Intelligent',
    desc: 'Automated insights, real-time sync, and smart risk engines.'
  },
  {
    icon: Layers,
    title: 'Connected',
    desc: 'Unified platform for business finance, markets, and credit.'
  },
  {
    icon: Zap,
    title: 'Scalable',
    desc: 'Built to support solopreneurs up to multi-state enterprises.'
  },
  {
    icon: ShieldCheck,
    title: 'Secure',
    desc: 'SOC-2 Type II, ISO 27001, and enterprise bank-grade encryption.'
  }
];

const WhyKepweSection = () => {
  return (
    <section className="why-kepwe-section" aria-label="Why Kepwe">
      <div className="container">
        
        {/* Section Header */}
        <ScrollReveal animation="fade-up" duration={400}>
          <div className="why-header text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>THE KEPWE ADVANTAGE</span>
            </div>
            <h2 className="why-title">Why Kepwe?</h2>
            <p className="why-subtitle">
              Designed for Real Financial Decisions
            </p>
          </div>
        </ScrollReveal>

        {/* 5 Cards Grid */}
        <div className="why-cards-grid">
          {WHY_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <ScrollReveal key={idx} animation="fade-up" duration={400} delay={idx * 60}>
                <div className="why-card">
                  <div className="why-card-icon">
                    <Icon size={22} color="#214ECF" />
                  </div>
                  <h3 className="why-card-heading">{item.title}</h3>
                  <p className="why-card-desc">{item.desc}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default WhyKepweSection;
