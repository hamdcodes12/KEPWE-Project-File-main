import React from 'react';
import { 
  BookOpen, 
  Receipt, 
  ShieldCheck, 
  Users, 
  LineChart, 
  PieChart, 
  CreditCard, 
  HeadphonesIcon 
} from 'lucide-react';
import './Capabilities.css';

const capabilitiesList = [
  {
    icon: BookOpen,
    title: 'Accounting & Books',
    description: 'Double-entry ledgers, automated bank reconciliation, and real-time P&L visibility.',
  },
  {
    icon: Receipt,
    title: 'GST & Taxation',
    description: 'Direct GSTN auto-sync, GSTR-1 & 3B computations, and error-free tax filing workflows.',
  },
  {
    icon: ShieldCheck,
    title: 'Corporate Compliance',
    description: 'MCA V3 annual filings, director disclosures, board resolutions, and secretarial records.',
  },
  {
    icon: Users,
    title: 'Payroll & HR',
    description: 'Automated salary disbursals, PF & ESI compliance, and digital TDS Form 16 issuance.',
  },
  {
    icon: LineChart,
    title: 'Financial Planning',
    description: 'Virtual CFO advisory, strategic budgeting, and cash runway projections.',
  },
  {
    icon: PieChart,
    title: 'Business Insights',
    description: 'Automated MIS reporting, margin analysis, and customer unit economics telemetry.',
  },
  {
    icon: CreditCard,
    title: 'Credit & Financial Access',
    description: 'Collateral-free working capital lines and structured business loans via partner lenders.',
  },
  {
    icon: HeadphonesIcon,
    title: 'Professional Support',
    description: 'Dedicated financial managers, chartered accountants, and compliance experts on demand.',
  },
];

const Capabilities = () => {
  return (
    <section className="capabilities-section" aria-label="Business Operating Pillars">
      <div className="container">
        
        {/* Section Header */}
        <div className="capabilities-header text-center">
          <div className="capabilities-eyebrow">
            <span className="capabilities-eyebrow-dot" />
            <span>BUSINESS OPERATING PILLARS</span>
          </div>
          <h2 className="capabilities-title">Everything your business needs to keep moving.</h2>
          <p className="capabilities-subtitle">
            Engineered to streamline back-office friction so leadership can focus on execution and growth.
          </p>
        </div>

        {/* 8 Pillar Cards Grid */}
        <div className="capabilities-grid">
          {capabilitiesList.map((cap, idx) => {
            const Icon = cap.icon;
            return (
              <div key={idx} className="capability-card">
                <div className="capability-icon-wrap">
                  <Icon size={22} strokeWidth={1.8} color="#214ECF" />
                </div>
                <h3 className="capability-card-title">{cap.title}</h3>
                <p className="capability-card-desc">{cap.description}</p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default Capabilities;
