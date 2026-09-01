import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shield, FileText, AlertTriangle, Lock } from 'lucide-react';

const LegalPages = () => {
  const { doc } = useParams();

  const docTitle = doc === 'terms' ? 'Terms of Use'
    : doc === 'risk-disclosure' ? 'Risk Disclosure Document'
    : doc === 'privacy' ? 'Privacy Policy'
    : doc === 'refunds' ? 'Refund & Cancellation Policy'
    : doc === 'grievance' ? 'Grievance Redressal'
    : doc === 'lending-disclosure' ? 'Lending & Credit Disclosure'
    : doc === 'partner-disclosure' ? 'Lender & LSP Partner Disclosure'
    : 'Legal Hub';

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '60px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ background: '#F0F4FE', color: '#214ECF', border: '1px solid #D0D5DD', padding: '6px 16px', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 800 }}>
            COMPLIANCE & LEGAL HUB
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '16px', marginBottom: '8px' }}>
            {docTitle}
          </h1>
          <p style={{ color: '#667085', fontSize: '0.95rem' }}>
            Kepwe Private Limited / Thinkatic Private Limited Governance & Policy Framework
          </p>
        </div>

        {/* Sub-nav Links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '40px' }}>
          {[
            { path: 'terms', label: 'Terms of Use' },
            { path: 'privacy', label: 'Privacy Policy' },
            { path: 'lending-disclosure', label: 'Lending Disclosure' },
            { path: 'partner-disclosure', label: 'Lender/LSP Partners' },
            { path: 'risk-disclosure', label: 'Risk Disclosure' },
            { path: 'refunds', label: 'Refund Policy' },
            { path: 'grievance', label: 'Grievance Redressal' },
          ].map((item) => (
            <Link
              key={item.path}
              to={`/legal/${item.path}`}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                background: doc === item.path ? '#214ECF' : '#F7F9FC',
                color: doc === item.path ? '#FFFFFF' : '#475467',
                border: '1px solid #E4E7EC'
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Content Box */}
        <div className="glass-card" style={{ padding: '36px', borderRadius: '16px', lineHeight: '1.7', color: '#CBD5E1', fontSize: '0.95rem' }}>
          {doc === 'risk-disclosure' && (
            <div>
              <h3 style={{ color: '#FB6B6B', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                SEBI Risk Disclosure on Derivatives Trading
              </h3>
              <p style={{ marginBottom: '16px' }}>
                9 out of 10 individual traders in equity options segment incurred net losses, with an average loss amount of ₹50,000 per trader per SEBI study. Over and above net trading losses, trading transactions incur 15% to 27% in transaction charges.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Kepwe / IndexPilot surfaces decision support tools, proprietary index scores, and defined-risk strategy filters. Content is strictly for educational and informational purposes and does not constitute individualized investment advice or recommendations.
              </p>
            </div>
          )}

          {doc === 'lending-disclosure' && (
            <div>
              <h3 style={{ color: '#111827', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Lending & Credit Discovery Disclosure
              </h3>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                Kepwe Credit acts strictly as a digital interface facilitating access to credit opportunities offered by regulated banks and Non-Banking Financial Companies (NBFCs). Kepwe is not a lender or banking entity.
              </p>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                All loan sanctioning, interest rate determination (Annual Percentage Rate), processing fees, loan agreements, repayment schedules, and loan recovery processes are governed strictly by the respective partner lending institutions in full compliance with Reserve Bank of India (RBI) Digital Lending Guidelines.
              </p>
            </div>
          )}

          {doc === 'partner-disclosure' && (
            <div>
              <h3 style={{ color: '#111827', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Lending Service Provider (LSP) & Partner Disclosures
              </h3>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                In accordance with RBI circulars on Digital Lending and Lending Service Providers (LSP):
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', color: '#475467' }}>
                <li style={{ marginBottom: '8px' }}>Partner Lenders: Regulated Scheduled Commercial Banks and RBI-Registered NBFCs.</li>
                <li style={{ marginBottom: '8px' }}>Key Fact Statement (KFS): Provided directly to the borrower before loan agreement execution.</li>
                <li style={{ marginBottom: '8px' }}>Cooling-off / Look-up Period: Borrowers are entitled to exit loan contracts within the designated cooling-off window without penalty.</li>
                <li style={{ marginBottom: '8px' }}>Data Privacy: Storage of biometric and persistent contact data is prohibited; data accessed strictly with explicit borrower consent.</li>
              </ul>
            </div>
          )}

          {doc === 'terms' && (
            <div>
              <h3 style={{ color: '#111827', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Terms of Use & Subscription Contract
              </h3>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                By accessing or using Kepwe Business Platform, Kepwe Credit, or IndexPilot Market Intelligence services, you agree to be bound by these Terms of Use. Subscription plans auto-renew monthly or annually unless canceled prior to the renewal date via Account settings.
              </p>
            </div>
          )}

          {doc === 'privacy' && (
            <div>
              <h3 style={{ color: '#111827', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Privacy Policy & Digital Personal Data Protection (DPDP) Compliance
              </h3>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                Kepwe collects only data necessary for user risk profiling, business compliance services, and digital loan pre-qualification. We never store raw payment cards or request broker bank credentials. Users maintain full rights to request data deletion at any time.
              </p>
            </div>
          )}

          {doc === 'refunds' && (
            <div>
              <h3 style={{ color: '#111827', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Refund & Cancellation Policy
              </h3>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                Subscriptions can be canceled anytime from Account & Billing. Cancellations take effect at the end of the current billing cycle. Full refunds are offered within 7 days of initial subscription signup if requested via support ticket.
              </p>
            </div>
          )}

          {doc === 'grievance' && (
            <div>
              <h3 style={{ color: '#FFFFFF', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Grievance Redressal Officer
              </h3>
              <p style={{ marginBottom: '16px' }}>
                In accordance with Indian Digital Services regulations, for any grievances or regulatory inquiries, contact our designated Grievance Officer:
              </p>
              <div style={{ background: '#1A2235', padding: '16px', borderRadius: '10px', color: '#17E7C0', fontWeight: 700 }}>
                Grievance Officer: Legal & Compliance Dept.<br />
                Email: grievance@kepwe.in | phone: +91 022 8899 0011<br />
                Entity: Kepwe Private Limited / Thinkatic Private Limited
              </div>
            </div>
          )}

          {!doc && (
            <div style={{ textAlign: 'center' }}>
              <p>Select a legal document from above to view complete terms, privacy policy, or risk disclosures.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegalPages;
