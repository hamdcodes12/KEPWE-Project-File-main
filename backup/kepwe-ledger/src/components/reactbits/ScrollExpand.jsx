import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import heroSmilingMan from '../../assets/hero-smiling-man.png';
import './ScrollExpand.css';

const ScrollExpand = ({
  imageSrc = heroSmilingMan,
  eyebrow = 'ONE CONNECTED PLATFORM',
  heading = 'Financial technology should feel connected.',
  subheading = 'From everyday financial needs to business decisions and long-term growth, KEPWE brings the right tools together in one connected ecosystem.',
}) => {
  const navigate = useNavigate();

  const handleExploreProducts = () => {
    const el = document.getElementById('products-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/solutions/accounting');
    }
  };

  const handleGetStarted = () => {
    navigate('/signup');
  };

  return (
    <section className="scroll-expand-section-root" aria-label="KEPWE Financial Ecosystem Hero">
      {/* Full-bleed background image & dark cinematic scrim */}
      <div className="scroll-expand-asset-box">
        <img
          src={imageSrc}
          alt="KEPWE Financial Ecosystem Experience"
          className="scroll-expand-hero-img"
          loading="eager"
        />
        <div className="scroll-expand-scrim-layer" />
      </div>

      {/* Centered Full-Screen Hero Content */}
      <div className="scroll-expand-center-container">
        <div className="expanded-eyebrow-badge">
          <span className="expand-pulse-dot" />
          <span>{eyebrow}</span>
        </div>
        
        <h1 className="expanded-big-title">{heading}</h1>

        <p className="expanded-sub-copy">{subheading}</p>

        {/* Action Buttons */}
        <div className="expanded-btn-row">
          <button 
            onClick={handleExploreProducts} 
            className="btn-expand-primary"
            aria-label="Explore Products"
          >
            <span>Explore Products</span>
            <ArrowRight size={17} />
          </button>

          <button 
            onClick={handleGetStarted} 
            className="btn-expand-secondary"
            aria-label="Get Started"
          >
            <span>Get Started</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Small Benefit Points */}
        <div className="scroll-expand-benefits">
          <span>Smart Financial Tools</span>
          <span className="b-dot">•</span>
          <span>Connected Experiences</span>
          <span className="b-dot">•</span>
          <span>Built Around You</span>
        </div>
      </div>
    </section>
  );
};

export default ScrollExpand;


