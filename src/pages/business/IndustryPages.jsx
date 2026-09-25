import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Shield, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react';

const INDUSTRY_DATA = {
  startups: {
    title: 'Compliance & Accounting for Startups',
    problems: ['ESOP taxation & cap-table compliance', 'Valuation certificates & MCA filings', 'R&D expenses & GST input tax credit'],
    compliance: ['Private Limited MCA Filings', 'GSTR-1 & GSTR-3B', 'TDS on Founder Salaries', 'PF & ESI Compliance'],
    recommendedPackage: 'Growth Plan (₹5,999/mo)'
  },
  traders: {
    title: 'GST & Accounting for Traders & Wholesalers',
    problems: ['High transaction volume reconciliation', 'E-Way bill requirements & inventory tracking', 'State-wise GST filing complexities'],
    compliance: ['Monthly GSTR-1 & 3B', 'GSTR-9 Annual Return', 'Bank Statement Reconciliation', 'Income Tax Advance Filing'],
    recommendedPackage: 'Essential Plan (₹2,999/mo)'
  },
  ecommerce: {
    title: 'TCS & GST Accounting for E-Commerce Sellers',
    problems: ['Amazon/Flipkart TCS deduction mapping', 'Multi-state GST registration (PPOB / APOB)', 'Payment gateway reconciliation'],
    compliance: ['GSTR-8 TCS Filing', 'Monthly Sales Reconciliation', 'Inventory P&L Statement', 'TDS Return Filing'],
    recommendedPackage: 'Growth Plan (₹5,999/mo)'
  },
  exporters: {
    title: 'GST Refunds & LUT Filing for Exporters',
    problems: ['Delayed GST refund claims on exports', 'LUT (Letter of Undertaking) annual renewals', 'FIRC & Forex inward remittance proof'],
    compliance: ['Export GST Refund Application', 'LUT Renewal Filing', 'IEC Code Updates', 'RCMC Registration'],
    recommendedPackage: 'Scale Plan (₹9,999/mo)'
  }
};

const IndustryPages = () => {
  const { type } = useParams();
  const currentIndustry = INDUSTRY_DATA[type] || {
    title: `Compliance & Accounting for ${type ? type.toUpperCase() : 'Businesses'}`,
    problems: ['Complex GST return filings', 'Messy accounting & bank reconciliation', 'ROC & MCA annual statutory deadlines'],
    compliance: ['Monthly GST Filings', 'TDS Quarterly Returns', 'Annual Tax Filings', 'Director KYC Verification'],
    recommendedPackage: 'Essential Plan (₹2,999/mo)'
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', padding: '60px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ background: '#E0E7FF', color: '#214ECF', fontSize: '0.85rem', fontWeight: 800, padding: '6px 14px', borderRadius: '9999px' }}>
            INDUSTRY SOLUTIONS · /industries/{type || 'all'}
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0F172A', marginTop: '12px' }}>
            {currentIndustry.title}
          </h1>
          <p style={{ color: '#5B6478', fontSize: '1.1rem', marginTop: '8px' }}>
            Your Industry → Common Problems → Required Compliance → Recommended Package
          </p>
        </div>

        {/* Industry Nav Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '40px' }}>
          {['startups', 'traders', 'ecommerce', 'exporters', 'manufacturing', 'agencies', 'technology'].map((ind) => (
            <Link
              key={ind}
              to={`/industries/${ind}`}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                background: type === ind ? '#214ECF' : '#FFFFFF',
                color: type === ind ? '#FFFFFF' : '#475569',
                border: '1px solid #CBD5E1'
              }}
            >
              {ind.toUpperCase()}
            </Link>
          ))}
        </div>

        {/* 3 Step Framework Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Step 1: Common Problems */}
          <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#EF4444', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={20} /> 1. COMMON INDUSTRY PROBLEMS
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentIndustry.problems.map((p) => (
                <li key={p} style={{ fontSize: '0.95rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ❌ {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Step 2: Required Compliance */}
          <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#214ECF', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={20} /> 2. REQUIRED COMPLIANCE
            </h3>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentIndustry.compliance.map((c) => (
                <li key={c} style={{ fontSize: '0.95rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✓ {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Step 3: Recommended Package */}
          <div style={{ background: '#F0F7FF', padding: '28px', borderRadius: '14px', border: '2px solid #214ECF', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#214ECF', textTransform: 'uppercase' }}>3. RECOMMENDED PACKAGE</h3>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0F172A', margin: '8px 0 16px' }}>
              {currentIndustry.recommendedPackage}
            </div>
            <Link
              to="/free-compliance-check"
              style={{
                background: '#214ecfff',
                color: '#FFF',
                padding: '14px 28px',
                borderRadius: '8px',
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              Get Free Industry Assessment <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndustryPages;
