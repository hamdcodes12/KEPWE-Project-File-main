import React from 'react';
import { Building2, TrendingUp, UserCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import ScrollReveal from '../common/ScrollReveal';
import './FinancialLifeSection.css';

const FinancialLifeSection = () => {
  return (
    <section className="financial-life-section" aria-label="Built Around Your Financial Life">
      <div className="container">
        
        {/* Section Header */}
        <ScrollReveal animation="fade-up" duration={400}>
          <div className="life-header text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>TAILORED FINANCIAL PATHWAYS</span>
            </div>
            <h2 className="life-title">Built Around Your Financial Life</h2>
            <p className="life-subtitle">
              Purpose-built workflows for businesses, index traders, and individuals.
            </p>
          </div>
        </ScrollReveal>

        {/* 3 Audience Cards */}
        <div className="life-grid">
          
          {/* Block 1: FOR BUSINESSES */}
          <ScrollReveal animation="fade-up" duration={400} delay={0}>
            <div className="life-card">
              <div className="life-card-tag">FOR BUSINESSES</div>
              <div className="life-card-icon blue">
                <Building2 size={22} color="#214ECF" />
              </div>
              <h3 className="life-card-heading">Know where your business stands.</h3>
              <p className="life-card-text">
                Real-time GST, accounting, payroll, and MCA compliance tracking in one unified dashboard.
              </p>
              <Link to="/portal" className="life-card-link">
                <span>View Business Dashboard</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Block 2: FOR TRADERS */}
          <ScrollReveal animation="fade-up" duration={400} delay={100}>
            <div className="life-card">
              <div className="life-card-tag">FOR TRADERS</div>
              <div className="life-card-icon blue">
                <TrendingUp size={22} color="#214ECF" />
              </div>
              <h3 className="life-card-heading">Turn market data into insight.</h3>
              <p className="life-card-text">
                Live index telemetry, option analytics, and disciplined AI execution signals for index traders.
              </p>
              <Link to="/indexpilot" className="life-card-link">
                <span>View Index Intelligence</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Block 3: FOR INDIVIDUALS */}
          <ScrollReveal animation="fade-up" duration={400} delay={200}>
            <div className="life-card">
              <div className="life-card-tag">FOR INDIVIDUALS</div>
              <div className="life-card-icon blue">
                <UserCheck size={22} color="#214ECF" />
              </div>
              <h3 className="life-card-heading">Make borrowing simpler.</h3>
              <p className="life-card-text">
                Discover personal credit options, transparent rates, and fast digital processing.
              </p>
              <Link to="/solutions/loans" className="life-card-link">
                <span>Check Credit Line</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </ScrollReveal>

        </div>

      </div>
    </section>
  );
};

export default FinancialLifeSection;
