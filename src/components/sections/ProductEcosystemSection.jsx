import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, TrendingUp, CreditCard } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './ProductEcosystemSection.css';

const ProductEcosystemSection = () => {
  return (
    <section id="product-ecosystem" className="product-ecosystem-section" aria-label="Product Ecosystem">
      <div className="container">
        
        {/* Section Header */}
        <ScrollReveal animation="fade-up" duration={400}>
          <div className="ecosystem-header text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>CONNECTED PRODUCT SUITE</span>
            </div>
            <h2 className="ecosystem-title">The Kepwe Ecosystem</h2>
            <p className="ecosystem-subtitle">
              Finance is connected. Your tools should be too. Whether you're running a business, trading the markets, or looking for personal credit, Kepwe gives you purpose-built technology to make smarter financial decisions.
            </p>
          </div>
        </ScrollReveal>

        {/* 3 Unified Brand Cards */}
        <div className="product-cards-grid">
          
          {/* Card 1: Kepwe Ledger */}
          <ScrollReveal animation="fade-up" duration={400} delay={0}>
            <div className="product-ecosystem-card">
              <div className="card-top-indicator">
                <span className="blue-indicator-dot" />
                <span className="product-tag">BUSINESS OS</span>
              </div>
              
              <div className="product-card-icon-box">
                <Building2 size={24} strokeWidth={1.75} color="#214ECF" />
              </div>

              <h3 className="product-card-title">Kepwe Ledger</h3>
              <div className="product-card-sub">Business finances, simplified.</div>
              <p className="product-card-desc">
                GST, accounting, bookkeeping, financial insights, and business management — organized in one powerful platform.
              </p>

              <Link to="/portal" className="product-card-cta">
                <span>Explore Ledger →</span>
                <ArrowRight size={16} className="cta-arrow" />
              </Link>
            </div>
          </ScrollReveal>

          {/* Card 2: Kepwe IndexPilot */}
          <ScrollReveal animation="fade-up" duration={400} delay={100}>
            <div className="product-ecosystem-card">
              <div className="card-top-indicator">
                <span className="blue-indicator-dot" />
                <span className="product-tag">MARKET AI</span>
              </div>

              <div className="product-card-icon-box">
                <TrendingUp size={24} strokeWidth={1.75} color="#214ECF" />
              </div>

              <h3 className="product-card-title">Kepwe IndexPilot</h3>
              <div className="product-card-sub">See the market differently.</div>
              <p className="product-card-desc">
                Market data, indices, analytics, signals, and intelligent tools designed to help traders understand market movements.
              </p>

              <Link to="/indexpilot" className="product-card-cta">
                <span>Explore IndexPilot →</span>
                <ArrowRight size={16} className="cta-arrow" />
              </Link>
            </div>
          </ScrollReveal>

          {/* Card 3: Kepwe Credit */}
          <ScrollReveal animation="fade-up" duration={400} delay={200}>
            <div className="product-ecosystem-card">
              <div className="card-top-indicator">
                <span className="blue-indicator-dot" />
                <span className="product-tag">CREDIT ENGINE</span>
              </div>

              <div className="product-card-icon-box">
                <CreditCard size={24} strokeWidth={1.75} color="#214ECF" />
              </div>

              <h3 className="product-card-title">Kepwe Credit</h3>
              <div className="product-card-sub">Credit when you need it.</div>
              <p className="product-card-desc">
                Discover personal loan options through a simple digital experience designed around transparency, speed, and convenience.
              </p>

              <Link to="/solutions/loans" className="product-card-cta">
                <span>Explore Credit →</span>
                <ArrowRight size={16} className="cta-arrow" />
              </Link>
            </div>
          </ScrollReveal>

        </div>

        {/* Ecosystem Comparison Strip: One Ecosystem. Three Financial Experiences. */}
        <ScrollReveal animation="fade-up" duration={400} delay={250}>
          <div className="ecosystem-strip-box" style={{ marginTop: '48px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '32px 24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', marginBottom: '20px' }}>
              One Ecosystem. Three Financial Experiences.
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563EB', marginBottom: '4px' }}>BUSINESS → LEDGER</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B' }}>Run and understand your finances.</div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563EB', marginBottom: '4px' }}>MARKETS → INDEXPILOT</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B' }}>Analyze and understand the markets.</div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563EB', marginBottom: '4px' }}>CREDIT → CREDIT</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B' }}>Access and manage personal borrowing.</div>
              </div>
            </div>
          </div>
        </ScrollReveal>

      </div>
    </section>
  );
};

export default ProductEcosystemSection;
