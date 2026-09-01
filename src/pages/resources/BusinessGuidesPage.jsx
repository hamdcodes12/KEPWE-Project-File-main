import React from 'react';
import { FileText, ArrowRight, ShieldCheck } from 'lucide-react';

const BusinessGuidesPage = () => {
  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '60px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ background: '#E0E7FF', color: '#214ECF', fontSize: '0.85rem', fontWeight: 800, padding: '6px 14px', borderRadius: '9999px' }}>
            KNOWLEDGE BASE · BUSINESS GUIDES
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '12px' }}>
            Company Setup & Financial Growth Guides
          </h1>
          <p style={{ color: '#5B6478', fontSize: '1.1rem', marginTop: '8px' }}>
            Guides on incorporation, MCA annual filings, payroll compliance, and virtual CFO advisory.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {[
            { title: '5 Things Newly Incorporated Companies Must Complete', desc: 'Bank account opening, PAN/TAN, Auditor appointment (ADT-1), and DIR-3 KYC.' },
            { title: 'Understanding MCA Annual Filings (AOC-4 & MGT-7)', desc: 'Statutory compliance requirements for Private Limited companies in India.' },
            { title: 'Payroll Setup: PF, ESI & Professional Tax Explained', desc: 'How to structure employee salaries and comply with state PT and EPF rules.' },
            { title: 'When Does Your Business Need a Virtual CFO?', desc: 'Unlocking cash flow forecasting, MIS reports, and strategic financial planning.' },
          ].map((guide) => (
            <div key={guide.title} style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
              <FileText size={24} color="#214ECF" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>{guide.title}</h3>
              <p style={{ fontSize: '0.85rem', color: '#5B6478', marginBottom: '16px', lineHeight: '1.5' }}>{guide.desc}</p>
              <a href="/free-compliance-check" style={{ marginTop: 'auto', color: '#214ECF', fontWeight: 700, textDecoration: 'none', fontSize: '0.85rem' }}>Read Guide →</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BusinessGuidesPage;
