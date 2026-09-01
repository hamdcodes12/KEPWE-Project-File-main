import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Award, Users, Lock, CheckCircle2, ArrowRight, Building2, FileText, Zap } from 'lucide-react';

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '60px 20px 100px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', maxWidth: '850px', margin: '0 auto 60px' }}>
          <span style={{ background: '#E0E7FF', color: '#214ECF', fontSize: '0.85rem', fontWeight: 800, padding: '6px 16px', borderRadius: '9999px', letterSpacing: '0.05em' }}>
            ABOUT KEPWE TECHNOLOGIES
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, marginTop: '16px', marginBottom: '16px' }}>
            Reinventing Business Operations & Compliance for India
          </h1>
          <p style={{ color: '#5B6478', fontSize: '1.1rem', lineHeight: '1.6' }}>
            KEPWE combines expert Chartered Accountants, Company Secretaries, and intelligent software to manage your business's financial and compliance back office.
          </p>
        </div>

        {/* Company Story & Positioning Banner */}
        <div style={{ background: 'linear-gradient(135deg, #17348F 0%, #214ECF 100%)', color: '#FFFFFF', padding: '36px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(33,78,207,0.15)', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#17E7C0', marginBottom: '12px' }}>
            "Don’t sell GST. Sell the back office."
          </h2>
          <p style={{ color: '#E2E8F0', fontSize: '1.02rem', lineHeight: '1.7', marginBottom: '20px' }}>
            GST filing is just the doorway through which Indian businesses are onboarded. The real value lies in building a frictionless, automated financial back office that eliminates penalties, organizes messy books, and unlocks access to working capital, CFO advisory, and statutory growth.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/free-compliance-check')} style={{ background: '#17E7C0', color: '#0A0E17', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Free Compliance Check <ArrowRight size={16} />
            </button>
            <button onClick={() => navigate('/pricing')} style={{ background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.3)', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
              Explore Business Plans
            </button>
          </div>
        </div>

        {/* Core Pillars */}
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, textAlign: 'center', marginBottom: '32px' }}>Why 50,000+ Indian Businesses Trust Kepwe</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '60px' }}>
          <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <Award size={36} color="#214ECF" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Verified CA & CS Expertise</h3>
            <p style={{ color: '#5B6478', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Every GST return, TDS filing, and MCA ROC document is verified by experienced Chartered Accountants before submission to government portals.
            </p>
          </div>

          <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <Lock size={36} color="#1B9E5A" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Bank-Grade Security & Privacy</h3>
            <p style={{ color: '#5B6478', fontSize: '0.9rem', lineHeight: '1.6' }}>
              256-bit AES encryption and DPDP Act compliance ensure your sensitive financial registers, PAN, TAN, and bank statements remain strictly confidential.
            </p>
          </div>

          <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <Users size={36} color="#7C3AED" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>Nationwide Operations</h3>
            <p style={{ color: '#5B6478', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Serving startups, traders, manufacturers, e-commerce sellers, and exporters across 28 Indian states with 100% zero-penalty statutory guarantee.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
