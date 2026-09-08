import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight, Calendar, Calculator, FileText, Sparkles } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './ResourcesSection.css';

const ResourcesSection = () => {
  const guides = [
    {
      title: 'Complete FY 2026–27 Statutory Compliance Calendar for Indian Pvt Ltd & LLPs',
      category: 'Compliance Guide',
      readTime: '6 min read',
      desc: 'Never miss an MCA or GST deadline. Detailed breakdown of AOC-4, MGT-7, DIR-3 KYC, and GSTR due dates.',
      link: '/resources/calendar',
      featured: true
    },
    {
      title: 'GST Input Tax Credit (ITC) 2B Reconciliation Masterclass',
      category: 'GST & Taxation',
      readTime: '4 min read',
      desc: 'How to recover up to 15% missed ITC lost due to non-filing suppliers.',
      link: '/resources/gst-guides',
      featured: false
    },
    {
      title: 'Startup Valuation & 80-IAC Angel Tax Exemption Playbook',
      category: 'Founder Advisory',
      readTime: '8 min read',
      desc: 'Step-by-step guide for early-stage founders applying for DPIIT startup recognition.',
      link: '/resources/business-guides',
      featured: false
    },
    {
      title: 'Free Indian Business Calculators: GST, Advance Tax & Payroll',
      category: 'Calculators',
      readTime: 'Interactive Tool',
      desc: 'Calculate exact GST liability, quarterly advance tax, and employee CTC to in-hand salary breakdown.',
      link: '/resources/calculators',
      featured: false
    }
  ];

  return (
    <section className="resources-editorial-section">
      <ScrollReveal animation="fade-up" duration={850} className="resources-container">
        <div className="resources-header">
          <div className="resources-eyebrow">
            <BookOpen size={14} />
            <span>KNOWLEDGE HUB & TOOLS</span>
          </div>
          <h2 className="resources-title">KEPWE Financial <span className="title-accent">Intelligence Hub</span></h2>
          <p className="resources-subtitle">
            Curated guides, statutory compliance calendars, and free calculators written by Chartered Accountants.
          </p>
        </div>

        <div className="resources-grid">
          {guides.map((item, idx) => (
            <div key={idx} className={`resource-card ${item.featured ? 'featured-resource' : ''}`}>
              <div className="resource-meta">
                <span className="category-chip">{item.category}</span>
                <span className="read-time">{item.readTime}</span>
              </div>

              <h3 className="resource-title">{item.title}</h3>
              <p className="resource-desc">{item.desc}</p>

              <Link to={item.link} className="resource-link">
                Read Guide <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
};

export default ResourcesSection;
