import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  TrendingUp, 
  CreditCard,
  Building2,
  Lock,
  Zap,
  CheckCircle2
} from 'lucide-react';
import gsap from 'gsap';
import heroSmilingMan from '../../assets/hero-smiling-man.png';
import './KepweHero.css';

const KepweHero = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const leftContentRef = useRef(null);
  const imageFrameRef = useRef(null);
  const floatingCardRef = useRef(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.hero-eyebrow-pill', { y: -16, opacity: 0, duration: 0.6 })
        .from('.hero-main-title', { y: 24, opacity: 0, duration: 0.7 }, '-=0.35')
        .from('.hero-supporting-text', { y: 18, opacity: 0, duration: 0.6 }, '-=0.4')
        .from('.hero-cta-buttons', { y: 16, opacity: 0, duration: 0.6 }, '-=0.4')
        .from('.hero-benefit-points', { y: 12, opacity: 0, duration: 0.5 }, '-=0.35')
        .from(imageFrameRef.current, { scale: 0.96, opacity: 0, duration: 0.85 }, '-=0.8')
        .from(floatingCardRef.current, { y: 24, opacity: 0, duration: 0.7, ease: 'back.out(1.5)' }, '-=0.4');
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const handleExploreProducts = () => {
    const el = document.getElementById('products-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/solutions/accounting');
    }
  };

  return (
    <section ref={heroRef} className="kepwe-hero-section" aria-label="KEPWE Financial Ecosystem Hero">
      {/* Ambient background lighting */}
      <div className="hero-bg-glow" aria-hidden="true" />

      <div className="container hero-container">
        
        {/* Left Content Column */}
        <div ref={leftContentRef} className="hero-left-block">
          
          {/* Eyebrow */}
          <div className="hero-eyebrow-pill">
            <span className="eyebrow-dot" />
            <span className="eyebrow-text">THE KEPWE FINANCIAL ECOSYSTEM</span>
          </div>

          {/* Main Headline */}
          <h1 className="hero-main-title">
            One platform.<br />
            <span className="hero-blue-accent">Every financial move.</span>
          </h1>

          {/* Supporting Copy */}
          <p className="hero-supporting-text">
            KEPWE brings financial products, intelligent tools and connected experiences together — helping you make clearer decisions and move forward with confidence.
          </p>

          {/* Two CTAs */}
          <div className="hero-cta-buttons">
            <button 
              onClick={handleExploreProducts} 
              className="btn-hero-primary"
              aria-label="Explore KEPWE Products"
            >
              <span>Explore Products</span>
              <ArrowRight size={18} />
            </button>

            <button 
              onClick={() => navigate('/login')} 
              className="btn-hero-secondary"
              aria-label="Get Started with KEPWE"
            >
              <span>Get Started</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* 3 Small Benefit Points */}
          <div className="hero-benefit-points">
            <div className="benefit-point-item">
              <span className="benefit-dot" />
              <span>Smart Financial Tools</span>
            </div>
            <div className="benefit-divider" />
            <div className="benefit-point-item">
              <span className="benefit-dot" />
              <span>Connected Experiences</span>
            </div>
            <div className="benefit-divider" />
            <div className="benefit-point-item">
              <span className="benefit-dot" />
              <span>Built Around You</span>
            </div>
          </div>

        </div>

        {/* Right Visual Column */}
        <div className="hero-right-block">
          <div ref={imageFrameRef} className="hero-image-wrapper">
            
            {/* Clean Hero Image Asset */}
            <img
              src={heroSmilingMan}
              alt="Young professional interacting with KEPWE financial platform on mobile"
              className="hero-person-img"
              loading="eager"
            />

            {/* Subtle Gradient overlay at bottom for smooth blending */}
            <div className="hero-img-blend-overlay" />

            {/* Floating Value & Product Card */}
            <div ref={floatingCardRef} className="hero-floating-products-card">
              <div className="floating-card-title-row">
                <span className="floating-card-tag">CONNECTED SUITE</span>
              </div>
              <div className="floating-products-row">
                <div className="floating-prod-pill">
                  <CreditCard size={14} color="#214ECF" />
                  <span>Personal Finance</span>
                </div>
                <div className="floating-prod-pill">
                  <Building2 size={14} color="#214ECF" />
                  <span>Business Finance</span>
                </div>
                <div className="floating-prod-pill">
                  <TrendingUp size={14} color="#214ECF" />
                  <span>Investments</span>
                </div>
                <div className="floating-prod-pill">
                  <ShieldCheck size={14} color="#214ECF" />
                  <span>Protection</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

export default KepweHero;
