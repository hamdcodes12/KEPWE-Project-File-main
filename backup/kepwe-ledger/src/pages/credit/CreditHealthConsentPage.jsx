import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, FileText, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const CREDIT_HEALTH_CONSENT_KEY = 'kepwe_credit_health_consent';

export function hasCreditHealthConsent(userId) {
  if (!userId || typeof window === 'undefined') return false;
  try {
    const consent = JSON.parse(window.localStorage.getItem(CREDIT_HEALTH_CONSENT_KEY) || 'null');
    return consent?.userId === userId && consent?.accepted === true;
  } catch {
    return false;
  }
}

export function CreditHealthConsentGate({ children }) {
  const { authState } = useApp();
  if (authState.isLoading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Checking your KEPWE session...</div>;
  if (!authState.isLoggedIn) return <Navigate to="/credit/consent" replace />;
  if (!hasCreditHealthConsent(authState.user?.id)) return <Navigate to="/credit/consent" replace />;
  return children;
}

export default function CreditHealthConsentPage() {
  const { authState } = useApp();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  if (!authState.isLoading && !authState.isLoggedIn) {
    return <Navigate to={`/credit/login?returnTo=${encodeURIComponent('/credit/consent')}`} replace />;
  }

  const continueToHealth = (event) => {
    event.preventDefault();
    if (!accepted || !authState.user?.id) return;
    window.localStorage.setItem(CREDIT_HEALTH_CONSENT_KEY, JSON.stringify({
      userId: authState.user.id,
      accepted: true,
      acceptedAt: new Date().toISOString(),
      purpose: 'credit-health-report-analysis',
    }));
    navigate('/credit/health', { replace: true });
  };

  return (
    <main style={{ minHeight: '100vh', background: '#F6F8FC', padding: '48px 20px', display: 'grid', placeItems: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ width: 'min(100%, 640px)', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 20, padding: 'clamp(24px, 5vw, 44px)', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#214ECF', fontSize: 13, fontWeight: 800, letterSpacing: '.08em' }}><Activity size={17} /> KEPWE CREDIT HEALTH</div>
        <h1 style={{ margin: '18px 0 10px', color: '#0F172A', fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', lineHeight: 1.12 }}>Before you upload your report</h1>
        <p style={{ margin: '0 0 26px', color: '#475569', lineHeight: 1.65 }}>Please review how your credit report will be used for your Credit Health analysis.</p>

        <div style={{ display: 'grid', gap: 18, marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 13 }}><FileText size={20} color="#214ECF" /><p style={{ margin: 0, color: '#334155', lineHeight: 1.55 }}>You choose and upload your own PDF. KEPWE processes its text and scanned pages (OCR) on KEPWE servers to extract report details and calculate an educational Credit Health Score.</p></div>
          <div style={{ display: 'flex', gap: 13 }}><LockKeyhole size={20} color="#214ECF" /><p style={{ margin: 0, color: '#334155', lineHeight: 1.55 }}>Your PDF and analysis are stored against your account. They are not sent to a bureau, lender, or external scoring API. You can delete them from the Credit Health page.</p></div>
          <div style={{ display: 'flex', gap: 13 }}><ShieldCheck size={20} color="#214ECF" /><p style={{ margin: 0, color: '#334155', lineHeight: 1.55 }}>The score is KEPWE’s educational analysis of readable report data. It is not a bureau score, loan approval, or lender decision.</p></div>
        </div>

        <form onSubmit={continueToHealth}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: 16, border: '1px solid #CBD5E1', borderRadius: 12, color: '#334155', lineHeight: 1.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} style={{ marginTop: 4, accentColor: '#214ECF' }} />
            <span>I have read and agree to KEPWE processing and storing the credit report PDF I choose to upload for this Credit Health analysis. I understand I can delete it from my account.</span>
          </label>
          <p style={{ margin: '12px 0 22px', color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>See our <Link to="/legal/privacy" style={{ color: '#214ECF', fontWeight: 700 }}>Privacy Policy</Link> for details about data handling.</p>
          <button type="submit" disabled={!accepted || authState.isLoading} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '15px 18px', border: 0, borderRadius: 11, background: accepted ? '#214ECF' : '#94A3B8', color: '#fff', fontSize: 16, fontWeight: 800, cursor: accepted ? 'pointer' : 'not-allowed' }}>
            Continue to Credit Health <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}
