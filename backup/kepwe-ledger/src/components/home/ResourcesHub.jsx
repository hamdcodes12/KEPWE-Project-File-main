import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calculator, Calendar, ArrowRight } from 'lucide-react';
import './ResourcesHub.css';

const resourceCategories = [
  {
    icon: BookOpen,
    category: 'BUSINESS',
    title: 'Business & Startup Guides',
    description: 'Practical playbooks on MCA compliance, company incorporation, and operational financial hygiene.',
    route: '/resources/business-guides',
    linkText: 'Explore Business Guides',
  },
  {
    icon: Calculator,
    category: 'FINANCIAL INSIGHTS',
    title: 'Financial Tools & Calculators',
    description: 'Calculate loan EMIs, GST tax liability, depreciation schedules, and payroll withholdings with precision.',
    route: '/resources/calculators',
    linkText: 'Use Financial Calculators',
  },
  {
    icon: Calendar,
    category: 'MARKET INTELLIGENCE',
    title: 'Statutory Calendar & GST Hub',
    description: 'Stay ahead of upcoming GSTR-1, GSTR-3B, TDS quarterly returns, and MCA annual filing cutoffs.',
    route: '/resources/calendar',
    linkText: 'View Compliance Calendar',
  },
];

const ResourcesHub = () => {
  return (
    <section className="resources-hub-section" aria-label="KEPWE Insights Hub">
      <div className="container">
        
        {/* Section Header */}
        <div className="resources-header text-center">
          <div className="resources-eyebrow">
            <span className="resources-dot" />
            <span>KEPWE INSIGHTS</span>
          </div>
          <h2 className="resources-title">Learn. Understand. Move smarter.</h2>
          <p className="resources-subtitle">
            Essential reference materials, computational tools, and statutory calendars built for financial clarity.
          </p>
        </div>

        {/* 3 Resource Cards */}
        <div className="resources-cards-grid">
          {resourceCategories.map((res, idx) => {
            const Icon = res.icon;
            return (
              <div key={idx} className="resource-hub-card">
                <div className="resource-card-icon-wrap">
                  <Icon size={22} color="#214ECF" />
                </div>
                <span className="resource-cat-tag">{res.category}</span>
                <h3 className="resource-card-title">{res.title}</h3>
                <p className="resource-card-desc">{res.description}</p>
                <Link to={res.route} className="resource-card-link">
                  <span>{res.linkText}</span>
                  <ArrowRight size={16} className="resource-arrow" />
                </Link>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default ResourcesHub;
