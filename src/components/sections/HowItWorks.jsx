import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, UserCheck, Shield, Sparkles, Building2, Layers } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './HowItWorks.css';

const HowItWorks = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      num: '01',
      title: 'Tell Us About Your Business',
      desc: 'Share your entity type (Pvt Ltd, LLP, Prop), GST status, monthly invoice volume, and current compliance setup in 2 minutes.',
      badge: 'Step 1'
    },
    {
      num: '02',
      title: 'Free Compliance Audit',
      desc: 'Our senior CA & CS team audits your past GST filings, MCA records, and books to uncover hidden penalty risks or missed ITC.',
      badge: 'Step 2'
    },
    {
      num: '03',
      title: 'Dedicated Team Onboarding',
      desc: 'Get matched with a dedicated CA, CS, and bookkeeper who set up your digitized document portal and filing calendar.',
      badge: 'Step 3'
    },
    {
      num: '04',
      title: 'KEPWE Manages Recurring Work',
      desc: 'We handle your monthly GSTR-1, 3B, TDS, Payroll, and Annual ROC filings automatically with 100% on-time guarantee.',
      badge: 'Step 4'
    },
    {
      num: '05',
      title: 'You Focus 100% On Scaling',
      desc: 'Access live financial metrics on your dashboard, receive instant notice alerts, and expand your business with confidence.',
      badge: 'Step 5'
    }
  ];

  return (
    <section className="how-it-works-section" ref={sectionRef}>
      <ScrollReveal animation="fade-up" duration={800} className="how-container">
        {/* Header */}
        <div className="how-header">
          <div className="how-eyebrow">
            <Sparkles size={14} />
            <span>SEAMLESS ONBOARDING FLOW</span>
          </div>
          <h2 className="how-title">How KEPWE <span className="title-accent">Powers Your Business</span></h2>
          <p className="how-subtitle">
            Transitioning from chaotic local compliance to enterprise financial order takes less than 24 hours.
          </p>
        </div>

        {/* 5-Step Connected Process Flow with Progressive Line Animation */}
        <div className="how-process-wrapper">
          <div
            className="how-connecting-line"
            style={{
              width: isVisible ? 'calc(100% - 80px)' : '0%',
              transition: 'width 1500ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          />

          <div className="how-steps-grid">
            {steps.map((step, idx) => (
              <div
                key={step.num}
                className={`how-step-card ${isVisible ? 'step-visible' : ''}`}
                style={{
                  transitionDelay: `${idx * 140}ms`
                }}
              >
                <div className="step-num-node">
                  <span>{step.num}</span>
                </div>
                <div className="step-card-inner">
                  <span className="step-badge">{step.badge}</span>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Bar */}
        <div className="how-cta-strip">
          <div className="cta-strip-text">
            <h4>Ready to automate your business accounting & compliance?</h4>
            <p>Join thousands of Indian founders who trust KEPWE for zero-friction operations.</p>
          </div>
          <Link to="/free-compliance-check" className="how-cta-btn">
            Get Free Compliance Audit <ArrowRight size={18} />
          </Link>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default HowItWorks;
