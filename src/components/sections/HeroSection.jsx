import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  TrendingUp, 
  Building2, 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  ArrowUpRight,
  Activity,
  Layers
} from 'lucide-react';
import Button from '../ui/Button';
import HeroDashboard from './HeroDashboard';
import './HeroSection.css';

const HeroSection = () => {
  const navigate = useNavigate();

  const scrollToEcosystem = () => {
    const el = document.getElementById('product-ecosystem');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/solutions/compliance');
    }
  };

  return (
    <section className="hero-section" aria-label="Hero Section">
      {/* Subtle Background Grid & Ambient Soft Blue Glow */}
      <div className="hero-bg-pattern" aria-hidden="true" />
      
      <div className="container hero-container">
        {/* Left / Top Text Block */}
        <div className="hero-content-block">
          
          {/* Eyebrow Pill */}
          <div className="hero-eyebrow-pill">
            <span className="eyebrow-dot" />
            <span className="eyebrow-text">KEPWE FINANCIAL ECOSYSTEM</span>
          </div>

          {/* Strong H1 Headline */}
          <h1 className="hero-title">
            One platform.<br />
            <span className="hero-title-accent">Every financial move.</span>
          </h1>

          {/* Concise Supporting Text */}
          <p className="hero-subtitle">
            Kepwe brings business finance, market intelligence, and personal credit together in one intelligent financial ecosystem.
          </p>
          
          <div className="hero-tagline-strip" style={{ fontSize: '0.98rem', fontWeight: 700, color: '#2563EB', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span>Manage your business.</span>
            <span style={{ color: '#CBD5E1' }}>•</span>
            <span>Understand the markets.</span>
            <span style={{ color: '#CBD5E1' }}>•</span>
            <span>Access credit.</span>
          </div>

          {/* Action Buttons */}
          <div className="hero-actions-row">
            <Button 
              variant="primary" 
              size="lg" 
              className="hero-primary-btn"
              onClick={scrollToEcosystem}
            >
              Explore Kepwe <ArrowRight size={18} />
            </Button>
            
            <Button 
              variant="secondary" 
              size="lg" 
              className="hero-secondary-btn"
              onClick={() => navigate('/free-compliance-check')}
            >
              Explore Products
            </Button>
          </div>

          {/* Subtle Trust Indicators */}
          <div className="hero-trust-bar">
            <div className="trust-item">
              <ShieldCheck size={16} color="#214ECF" />
              <span>GSTN ASP & MCA Filing Sync</span>
            </div>
            <div className="trust-item">
              <CheckCircle2 size={16} color="#12B76A" />
              <span>SOC-2 & ISO 27001 Certified</span>
            </div>
          </div>

        </div>

        {/* Right / Bottom Interactive Hero Dashboard Visual */}
        <div className="hero-visual-viewport">
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
