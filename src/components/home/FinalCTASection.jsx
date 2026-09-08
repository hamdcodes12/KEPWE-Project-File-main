import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import './FinalCTASection.css';

const FinalCTASection = () => {
  const navigate = useNavigate();

  const handleExplore = () => {
    const el = document.getElementById('products-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/solutions/accounting');
    }
  };

  return (
    <section className="final-cta-section" aria-label="Get Started with KEPWE">
      <div className="container">
        
        <div className="final-cta-card">
          <div className="final-cta-ambient" aria-hidden="true" />
          
          <div className="final-cta-content">
            <span className="final-cta-eyebrow">GET STARTED</span>
            <h2 className="final-cta-heading">Your financial ecosystem starts here.</h2>
            <p className="final-cta-subtext">
              Explore KEPWE and discover connected tools designed to make your financial journey simpler.
            </p>

            <div className="final-cta-buttons-row">
              <button 
                onClick={handleExplore} 
                className="btn-final-primary"
                aria-label="Explore KEPWE Products"
              >
                <span>Explore Products</span>
                <ArrowRight size={18} />
              </button>

              <button 
                onClick={() => navigate('/login')} 
                className="btn-final-secondary"
                aria-label="Get Started with KEPWE"
              >
                <span>Get Started</span>
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="final-cta-trust-items">
              <div className="trust-point">
                <CheckCircle2 size={15} color="#12B76A" />
                <span>Instant Digital Setup</span>
              </div>
              <div className="trust-point">
                <ShieldCheck size={15} color="#214ECF" />
                <span>Enterprise Grade Security</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default FinalCTASection;
