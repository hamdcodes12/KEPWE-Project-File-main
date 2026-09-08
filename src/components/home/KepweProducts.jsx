import React from 'react';
import { Link } from 'react-router-dom';
import { 
  CreditCard, 
  BookOpen, 
  TrendingUp, 
  Activity, 
  Building2, 
  ArrowRight 
} from 'lucide-react';
import './KepweProducts.css';

const productsList = [
  {
    id: 'credit',
    name: 'Personal Finance & Credit',
    tag: 'DIGITAL LENDING',
    description: 'Instant credit assessments, transparent personal loan options, and digital disbursals through regulated lending partners.',
    route: '/credit',
    icon: CreditCard,
    accentColor: '#214ECF',
    iconBg: '#EFF4FF',
  },
  {
    id: 'ledger',
    name: 'Business Finance & Ledger',
    tag: 'ACCOUNTING & GST',
    description: 'Automated double-entry bookkeeping, direct GSTN portal reconciliation, and real-time cashflow intelligence for enterprises.',
    route: '/ledger',
    icon: BookOpen,
    accentColor: '#2563EB',
    iconBg: '#EFF6FF',
  },
  {
    id: 'indexpilot',
    name: 'IndexPilot',
    tag: 'MARKET TELEMETRY',
    description: 'Real-time options chain analytics, volatility skew tracking, and algorithmic decision tools engineered for derivatives traders.',
    route: '/indexpilot',
    icon: TrendingUp,
    accentColor: '#0284C7',
    iconBg: '#F0F9FF',
  },
  {
    id: 'quant',
    name: 'KEPWE Quant Workstation',
    tag: 'SYSTEMATIC TRADING',
    description: 'Advanced quantitative models, backtesting engines, and algorithmic strategy execution with sub-second telemetry.',
    route: '/quant',
    icon: Activity,
    accentColor: '#0D9488',
    iconBg: '#ECFDF8',
  },
  {
    id: 'portal',
    name: 'Enterprise Client Workspace',
    tag: 'OPERATING PORTAL',
    description: 'Centralized financial management, statutory compliance calendars, and direct chartered accountant advisory.',
    route: '/portal',
    icon: Building2,
    accentColor: '#4F46E5',
    iconBg: '#EEF2FF',
  },
];

const KepweProducts = () => {
  return (
    <section id="products-section" className="kepwe-products-section" aria-label="KEPWE Product Ecosystem">
      <div className="container">
        
        {/* Section Header */}
        <div className="products-section-header text-center">
          <div className="products-eyebrow">
            <span className="products-eyebrow-dot" />
            <span>THE KEPWE ECOSYSTEM</span>
          </div>
          <h2 className="products-main-heading">One ecosystem. Different financial needs.</h2>
          <p className="products-subheading">
            Purpose-built financial products connected through one intelligent platform.
          </p>
        </div>

        {/* Product Cards Grid */}
        <div className="products-cards-grid">
          {productsList.map((prod) => {
            const Icon = prod.icon;
            return (
              <div key={prod.id} className="product-ecosystem-card">
                
                {/* Category Pill & Icon */}
                <div className="product-card-top">
                  <div 
                    className="product-card-icon-wrap"
                    style={{ backgroundColor: prod.iconBg, color: prod.accentColor }}
                  >
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                  <span 
                    className="product-category-label"
                    style={{ color: prod.accentColor, backgroundColor: prod.iconBg }}
                  >
                    {prod.tag}
                  </span>
                </div>

                {/* Title */}
                <h3 className="product-card-name">{prod.name}</h3>

                {/* Description */}
                <p className="product-card-desc">{prod.description}</p>

                {/* CTA Link */}
                <Link to={prod.route} className="product-card-cta-link">
                  <span>Learn More</span>
                  <ArrowRight size={16} className="product-cta-arrow" />
                </Link>

              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default KepweProducts;
