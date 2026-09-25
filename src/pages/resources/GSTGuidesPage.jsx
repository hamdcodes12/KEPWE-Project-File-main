import React from 'react';
import { BookOpen, ArrowRight, CheckCircle2 } from 'lucide-react';

const GSTGuidesPage = () => {
  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '60px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ background: '#E0E7FF', color: '#214ECF', fontSize: '0.85rem', fontWeight: 800, padding: '6px 14px', borderRadius: '9999px' }}>
            KNOWLEDGE BASE · GST GUIDES
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '12px' }}>
            GST Compliance & Filing Guides
          </h1>
          <p style={{ color: '#5B6478', fontSize: '1.1rem', marginTop: '8px' }}>
            Step-by-step guides for GST registration, GSTR-1, GSTR-3B, ITC reconciliation and LUT filing.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {[
            { title: 'Complete Guide to GSTR-1 & GSTR-3B Filing', desc: 'Understanding sales reporting, ITC claims and payment challan generation.' },
            { title: 'Input Tax Credit (ITC) Reconciliation Rule 36(4)', desc: 'How to match GSTR-2B with purchase register to avoid tax notices.' },
            { title: 'GST LUT Filing for Exporters (Zero Rated Supply)', desc: 'Export goods and services without paying IGST by renewing your annual LUT.' },
            { title: 'How to Handle GST Department Notices (ASMT-10)', desc: 'Step-by-step guide to replying to tax mismatch notices from GST officers.' },
          ].map((guide) => (
            <div key={guide.title} style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
              <BookOpen size={24} color="#214ECF" style={{ marginBottom: '12px' }} />
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

export default GSTGuidesPage;
