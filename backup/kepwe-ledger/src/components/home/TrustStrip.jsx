import React from 'react';
import { 
  Building2, 
  TrendingUp, 
  CreditCard, 
  BarChart3, 
  ShieldCheck, 
  Zap 
} from 'lucide-react';
import './TrustStrip.css';

const trustItems = [
  {
    icon: Building2,
    title: 'Business Finance',
    subtitle: 'GST, MCA & Books',
  },
  {
    icon: TrendingUp,
    title: 'Market Intelligence',
    subtitle: 'NIFTY & Options Telemetry',
  },
  {
    icon: CreditCard,
    title: 'Credit & Lending',
    subtitle: 'Instant Digital Approvals',
  },
  {
    icon: BarChart3,
    title: 'Financial Insights',
    subtitle: 'Automated MIS & Cashflow',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance First',
    subtitle: 'Statutory Filing Standards',
  },
];

const TrustStrip = () => {
  return (
    <section className="kepwe-trust-strip" aria-label="KEPWE Value Pillars">
      <div className="container">
        <div className="trust-strip-grid">
          {trustItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="trust-strip-item">
                <div className="trust-icon-box">
                  <Icon size={18} strokeWidth={2} color="#214ECF" />
                </div>
                <div className="trust-text-block">
                  <span className="trust-item-title">{item.title}</span>
                  <span className="trust-item-subtitle">{item.subtitle}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustStrip;
