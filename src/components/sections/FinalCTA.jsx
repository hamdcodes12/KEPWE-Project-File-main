import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import ScrollReveal from '../common/ScrollReveal';
import './FinalCTA.css';

const FinalCTA = () => {
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
    <section className="final-cta-section" aria-label="Final Call to Action">
      <div className="container">
        <ScrollReveal animation="fade-up" duration={400}>
          <div className="final-cta-card">
            {/* Subtle Abstract Financial Line Network */}
            <div className="cta-bg-network" aria-hidden="true">
              <svg viewBox="0 0 800 120" preserveAspectRatio="none" style={{ width: '100%', height: '80px', opacity: 0.25 }}>
                <path d="M0,80 Q200,30 400,60 T800,20" fill="none" stroke="#214ECF" strokeWidth="1.5" strokeDasharray="4 4" />
                <circle cx="200" cy="55" r="3" fill="#214ECF" />
                <circle cx="400" cy="60" r="3" fill="#214ECF" />
                <circle cx="600" cy="35" r="3" fill="#214ECF" />
              </svg>
            </div>

            <div className="cta-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>JOIN THE KEPWE PLATFORM</span>
            </div>

            <h2 className="cta-headline">
              Your finances.<br />
              Your markets.<br />
              <span className="cta-headline-blue">Your future.</span>
            </h2>

            <p className="cta-subtext">
              Discover the Kepwe ecosystem. Unified business finance, market intelligence, and credit.
            </p>

            <div className="cta-buttons-row">
              <Button 
                variant="primary" 
                size="lg" 
                className="cta-btn-main"
                onClick={() => navigate('/free-compliance-check')}
              >
                Get Started <ArrowRight size={18} />
              </Button>

              <Button 
                variant="secondary" 
                size="lg" 
                className="cta-btn-sec"
                onClick={scrollToEcosystem}
              >
                Explore Kepwe
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default FinalCTA;
