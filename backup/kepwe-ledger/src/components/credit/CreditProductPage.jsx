import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  FileText,
  ShieldCheck,
  Lock,
  Eye,
  Smartphone,
  AlertCircle,
  ChevronDown,
  Building2,
  Sparkles,
  Check,
  Upload,
  BarChart2,
  BookOpen,
  AlertTriangle,
  CreditCard,
  Layers,
  TrendingUp,
  UserCheck,
  Scale,
} from 'lucide-react';
import './CreditProductPage.css';

/* ─── Static data ─────────────────────────────────────────────────────────── */

const HOW_IT_WORKS_STEPS = [
  {
    num: '01',
    icon: Upload,
    title: 'Upload your credit report',
    desc: 'Download your credit report PDF from CIBIL, Experian, CRIF, or Equifax and upload it here. Text is extracted first; scanned pages are read with on-server OCR.',
  },
  {
    num: '02',
    icon: FileText,
    title: 'Account & data extraction',
    desc: 'The Kepwe engine identifies every loan and card account, reads DPD markers, credit limits, outstanding balances, enquiries, and account-opening dates from the report.',
  },
  {
    num: '03',
    icon: Layers,
    title: 'Data normalisation',
    desc: 'Raw extracted values are cleaned, classified, and structured — resolving lender names, account types, and payment history codes into a consistent format.',
  },
  {
    num: '04',
    icon: Activity,
    title: 'KEPWE Credit Engine',
    desc: 'Five weighted factors (payment history, credit utilisation, account status, account age, and enquiries) are scored and combined into a single 300–900 health score.',
  },
  {
    num: '05',
    icon: BarChart2,
    title: 'Factors, warnings & recommendations',
    desc: 'See exactly which factors helped or hurt your score, any extraction warnings, and specific actions you can take to strengthen your credit profile.',
  },
];

const SCORE_FACTORS = [
  {
    key: 'paymentHistory',
    label: 'Payment History',
    weight: '35%',
    desc: 'The share of payment markers with zero days past due. The most important factor — consistent on-time payments drive this up.',
  },
  {
    key: 'creditUtilisation',
    label: 'Credit Utilisation',
    weight: '30%',
    desc: 'How much of your available revolving credit (cards) you are using. Keeping this below 30% is generally favourable.',
  },
  {
    key: 'accountStatus',
    label: 'Account Status',
    weight: '20%',
    desc: 'The proportion of your accounts with no negative status. Settled or written-off accounts reduce this factor.',
  },
  {
    key: 'accountAge',
    label: 'Account Age',
    weight: '10%',
    desc: 'The age of your oldest account. Longer credit history (up to 10 years) scores better.',
  },
  {
    key: 'enquiries',
    label: 'Credit Enquiries',
    weight: '5%',
    desc: 'Fewer recent hard enquiries score better. Multiple applications in a short period can signal credit stress.',
  },
];

const SCORE_BANDS = [
  {
    range: '750 – 900',
    label: 'Strong',
    color: '#12B76A',
    bg: 'rgba(18,183,106,0.08)',
    desc: 'Excellent repayment history and well-managed credit profile.',
  },
  {
    range: '650 – 749',
    label: 'Healthy',
    color: '#214ECF',
    bg: 'rgba(33,78,207,0.08)',
    desc: 'Good credit habits with minor areas to improve.',
  },
  {
    range: '550 – 649',
    label: 'Building',
    color: '#F79009',
    bg: 'rgba(247,144,9,0.08)',
    desc: 'Some risk signals present. Consistent payments will help.',
  },
  {
    range: '300 – 549',
    label: 'Needs attention',
    color: '#F04438',
    bg: 'rgba(240,68,56,0.08)',
    desc: 'Significant negative factors identified. Review recommendations.',
  },
];

const PRIVACY_PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Private by design',
    desc: 'Your report is processed on Kepwe servers and stored against your account only. It is never sent to a credit bureau or external scoring API.',
  },
  {
    icon: Lock,
    title: 'Bank-grade security',
    desc: '128-bit encrypted connections, secure API endpoints, and restricted server-side access to your uploaded data.',
  },
  {
    icon: Eye,
    title: 'Full transparency',
    desc: 'Every extracted value, factor weight, and score calculation is shown to you in plain language — no black-box outputs.',
  },
  {
    icon: UserCheck,
    title: 'Your data, your control',
    desc: 'Delete your uploaded report and its analysis from your account at any time with a single click.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'Where do I get my credit report?',
    a: 'You can download a free PDF copy of your credit report from CIBIL (TransUnion), Experian, CRIF High Mark, or Equifax India. Each bureau allows at least one free report per year.',
  },
  {
    q: 'What format should the report be in?',
    a: 'Upload a PDF file up to 10 MB and 20 pages. Both text-based and scanned PDF reports are supported — scanned pages are processed with on-server OCR.',
  },
  {
    q: 'Is this the same as my official CIBIL score?',
    a: 'No. The Kepwe Credit Health Score is our own educational analysis based on values we can extract from your report PDF. It is not a bureau score, and lenders will use their own bureau checks for credit decisions.',
  },
  {
    q: 'Does uploading my report affect my credit score?',
    a: 'No. Kepwe analyses your report locally — we do not query any credit bureau on your behalf. There is no hard inquiry and no impact on your bureau score.',
  },
  {
    q: 'What if some values are unavailable in my report?',
    a: 'Missing factors are excluded from the calculation and the remaining weights are rebalanced to 100%. The score and each factor card will clearly indicate when a value was not available in the uploaded report.',
  },
  {
    q: 'What happens to my uploaded report?',
    a: 'The report and its extracted analysis are stored securely against your account. You can delete them at any time from the Credit Health page. The original PDF is not shared with any third party.',
  },
];

/* ─── Component ───────────────────────────────────────────────────────────── */

const CreditProductPage = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="credit-product-page">

      {/* ── 01. HERO ─────────────────────────────────────────────────────── */}
      <section className="credit-hero-section">
        <div className="container">
          <div className="credit-hero-grid">

            {/* Left: headline + CTA */}
            <div className="credit-hero-text">
              <div className="credit-badge">
                <Activity size={14} color="#214ECF" />
                <span>KEPWE CREDIT HEALTH</span>
              </div>

              <h1 className="credit-hero-headline">
                Understand your<br />
                <span className="headline-accent">credit health.</span>
              </h1>

              <p className="credit-hero-sub">
                Upload your credit report and get the Kepwe Credit Health Score — a clear,
                factor-by-factor breakdown of your payment history, utilisation, account status,
                and more. No guesswork. No fake offers. Just your actual data.
              </p>

              <div className="credit-hero-actions">
                <button
                  type="button"
                  onClick={() => navigate('/credit/consent')}
                  className="btn-credit-primary btn-lg"
                  aria-label="Check your Credit Health Score"
                >
                  Check Your Credit Health <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('how-it-works');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="btn-credit-secondary btn-lg"
                >
                  How It Works
                </button>
              </div>

              <div className="credit-trust-strip-hero">
                <span className="trust-dot-icon" />
                <span className="trust-strip-text">
                  Free · Private · No bureau impact · Delete anytime
                </span>
              </div>
            </div>

            {/* Right: static score ring preview */}
            <div className="credit-hero-visual">
              <div className="hero-ui-mockup-card">
                <div className="mockup-header">
                  <div className="mockup-brand-title">
                    <Activity size={18} color="#214ECF" />
                    <span>Kepwe Credit Health Score</span>
                  </div>
                  <span className="mockup-tag">Illustrative example</span>
                </div>

                <div className="mockup-content">
                  {/* Static score ring illustration */}
                  <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                    <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
                      <circle cx="70" cy="70" r="58" fill="none" stroke="#E4E7EC" strokeWidth="12" />
                      <circle
                        cx="70" cy="70" r="58"
                        fill="none"
                        stroke="#214ECF"
                        strokeWidth="12"
                        strokeDasharray="364.4"
                        strokeDashoffset="109"
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)"
                      />
                      <text x="70" y="65" textAnchor="middle" fontSize="26" fontWeight="800" fill="#0F172A">742</text>
                      <text x="70" y="84" textAnchor="middle" fontSize="11" fill="#667085">out of 900</text>
                    </svg>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#214ECF', marginTop: '4px' }}>
                      Healthy
                    </div>
                  </div>

                  {/* Mini factor bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 4px' }}>
                    {[
                      { label: 'Payment history', pct: 88, weight: '35%' },
                      { label: 'Credit utilisation', pct: 72, weight: '30%' },
                      { label: 'Account status', pct: 95, weight: '20%' },
                    ].map(({ label, pct, weight }) => (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#475569', marginBottom: '3px' }}>
                          <span>{label}</span><span style={{ color: '#214ECF', fontWeight: 600 }}>{weight}</span>
                        </div>
                        <div style={{ height: '6px', background: '#E4E7EC', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#214ECF', borderRadius: '99px' }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '16px', fontSize: '0.78rem', color: '#64748B', textAlign: 'center', fontStyle: 'italic' }}>
                    Illustrative preview only — your score is calculated from your uploaded report
                  </div>
                </div>

                <div className="mockup-footer-note">
                  <Lock size={12} color="#667085" />
                  <span>Processed on Kepwe servers · Never shared externally</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ── 02. TRUST STRIP ──────────────────────────────────────────────── */}
      <section className="credit-trust-strip-section">
        <div className="container">
          <div className="trust-strip-header text-center">
            <h3 className="trust-strip-title">What makes Kepwe Credit Health different</h3>
          </div>
          <div className="trust-strip-grid">
            {[
              { title: 'Your own data', desc: 'We read your credit report — no assumptions, no indicative figures.' },
              { title: 'Every factor explained', desc: 'See exactly what drove your score, not just the number.' },
              { title: 'No bureau hit', desc: 'We analyse the PDF you upload. Zero hard enquiries.' },
              { title: 'Full transparency', desc: 'Every calculation weight and method is shown in plain language.' },
            ].map((item, idx) => (
              <div key={idx} className="trust-strip-card">
                <div className="ts-indicator-dot" />
                <h4 className="ts-title">{item.title}</h4>
                <p className="ts-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── 03. HOW IT WORKS (5 STEPS) ───────────────────────────────────── */}
      <section id="how-it-works" className="credit-how-it-works-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>THE PROCESS</span>
            </div>
            <h2 className="section-title">From PDF to Credit Health Score</h2>
            <p className="section-sub">
              Five steps, all automated, running on Kepwe servers.
            </p>
          </div>

          <div className="steps-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {HOW_IT_WORKS_STEPS.map(({ num, icon: Icon, title, desc }) => (
              <div key={num} className="step-feature-card">
                <div className="step-num-tag">STEP {num}</div>
                <div className="step-icon-wrap">
                  <Icon size={22} color="#214ECF" />
                </div>
                <h3 className="step-card-title">{title}</h3>
                <p className="step-card-desc">{desc}</p>
              </div>
            ))}
          </div>

          <div className="how-it-works-cta-wrap text-center">
            <button
              type="button"
              onClick={() => navigate('/credit/consent')}
              className="btn-credit-primary btn-lg"
            >
              Upload Your Credit Report <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>


      {/* ── 04. SCORE FACTORS ────────────────────────────────────────────── */}
      <section className="credit-eligibility-factors-section">
        <div className="container">
          <div className="eligibility-box-card">
            <div className="section-head text-center" style={{ marginBottom: '32px' }}>
              <div className="section-eyebrow" style={{ justifyContent: 'center' }}>
                <span className="eyebrow-blue-dot" />
                <span>SCORING MODEL</span>
              </div>
              <h2 className="section-title">Five factors. One score.</h2>
              <p className="section-sub" style={{ maxWidth: '640px' }}>
                The Kepwe Credit Health Score is built from five weighted factors extracted
                directly from your credit report. Missing factors are excluded and weights rebalanced — nothing is assumed.
              </p>
            </div>

            <div className="factors-pills-list">
              {SCORE_FACTORS.map(({ key, label, weight, desc }) => (
                <div key={key} className="factor-pill-item">
                  <div className="factor-bullet">
                    <Check size={14} color="#214ECF" />
                  </div>
                  <div className="factor-texts">
                    <strong className="factor-name">{label} <span style={{ color: '#214ECF', fontWeight: 700 }}>({weight})</span>:</strong>
                    <span className="factor-desc">{desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="eligibility-cta-box text-center">
              <button
                type="button"
                onClick={() => navigate('/credit/consent')}
                className="btn-credit-primary btn-lg"
              >
                See My Factors <ArrowRight size={18} />
              </button>
              <span className="eligibility-hint">
                Upload once · Results immediately · Delete anytime
              </span>
            </div>
          </div>
        </div>
      </section>


      {/* ── 05. SCORE BANDS ──────────────────────────────────────────────── */}
      <section className="credit-why-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>SCORE RANGE</span>
            </div>
            <h2 className="section-title">What does your score mean?</h2>
            <p className="section-sub">
              The Kepwe Credit Health Score runs from 300 to 900. Each band reflects the overall
              strength of your credit profile based on the factors we can read from your report.
            </p>
          </div>

          <div className="why-cards-grid">
            {SCORE_BANDS.map(({ range, label, color, bg, desc }) => (
              <div key={label} className="why-card" style={{ borderTop: `3px solid ${color}` }}>
                <div className="why-icon-box" style={{ background: bg }}>
                  <TrendingUp size={22} color={color} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                  <h3 className="why-card-title" style={{ color, margin: 0 }}>{label}</h3>
                  <span style={{ fontSize: '0.82rem', color: '#667085', fontWeight: 600 }}>{range}</span>
                </div>
                <p className="why-card-desc">{desc}</p>
              </div>
            ))}
          </div>

          <div className="how-it-works-cta-wrap text-center" style={{ marginTop: '40px' }}>
            <button
              type="button"
              onClick={() => navigate('/credit/consent')}
              className="btn-credit-primary btn-lg"
            >
              Check Your Credit Health <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>


      {/* ── 06. PRIVACY & SECURITY ───────────────────────────────────────── */}
      <section className="credit-security-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>DATA PROTECTION</span>
            </div>
            <h2 className="section-title">Your financial information matters.</h2>
            <p className="section-sub">
              Your uploaded report is processed entirely on Kepwe servers and never shared with
              any bureau, lender, or third-party API.
            </p>
          </div>

          <div className="security-cards-grid">
            {PRIVACY_PILLARS.map(({ icon: Icon, title, desc }, idx) => (
              <div key={idx} className="security-card">
                <div className="sec-icon-wrap">
                  <Icon size={22} color="#214ECF" />
                </div>
                <h3 className="sec-card-title">{title}</h3>
                <p className="sec-card-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── 07. FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq-section" className="credit-faq-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>CLEAR ANSWERS</span>
            </div>
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-sub">
              Everything you need to know about uploading your report and understanding your score.
            </p>
          </div>

          <div className="faq-accordion-container">
            {FAQ_ITEMS.map((faq, idx) => (
              <div
                key={idx}
                className={`faq-accordion-item ${openFaq === idx ? 'open' : ''}`}
                onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
              >
                <div className="faq-q-row">
                  <span className="faq-question">{faq.q}</span>
                  <span className="faq-chevron">
                    <ChevronDown size={18} />
                  </span>
                </div>
                {openFaq === idx && (
                  <div className="faq-a-body animate-fadeIn">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── 08. LOAN DISCOVERY — INTEGRATION PENDING ─────────────────────── */}
      <section id="loan-integration-pending" className="credit-ecosystem-section">
        <div className="container">
          <div className="ecosystem-card">
            <div className="eco-header text-center">
              <div className="section-eyebrow" style={{ justifyContent: 'center' }}>
                <span className="eyebrow-blue-dot" />
                <span>INTEGRATION PENDING</span>
              </div>
              <h2 className="section-title">Automated loan eligibility and offers — integration pending.</h2>
              <p className="section-sub" style={{ maxWidth: '680px' }}>
                Automated eligibility checks and lender offers require verified RBI-regulated bank
                and NBFC integrations, which are pending. KEPWE accepts application requests for
                internal review from the Credit workspace; an internal review is not a lender
                decision, sanction, or offer.
              </p>
            </div>

            <div className="eco-badges-row">
              <div className="eco-badge-card" style={{ opacity: 0.6 }}>
                <Building2 size={24} color="#94A3B8" />
                <span className="eco-badge-title" style={{ color: '#94A3B8' }}>Lender Connections</span>
                <span className="eco-badge-sub">Integration pending</span>
              </div>
              <div className="eco-badge-card" style={{ opacity: 0.6 }}>
                <CreditCard size={24} color="#94A3B8" />
                <span className="eco-badge-title" style={{ color: '#94A3B8' }}>Loan Offers</span>
                <span className="eco-badge-sub">Not yet available</span>
              </div>
            </div>

            <div className="eco-legal-disclaimer-box">
              <AlertCircle size={20} color="#B45309" />
              <p>
                <strong>Notice:</strong> No loan offers, approval amounts, or indicative EMI figures are currently available through Kepwe Credit. Kepwe is not a lender. When partner integrations go live, all rates and terms will be sourced directly from the relevant RBI-registered institution.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ── 09. FINAL CTA ────────────────────────────────────────────────── */}
      <section className="credit-final-cta-section">
        <div className="container">
          <div className="final-blue-cta-box text-center">
            <h2 className="final-cta-headline">Ready to understand your credit health?</h2>
            <p className="final-cta-subhead">
              Upload your credit report PDF and get a full factor-by-factor breakdown in seconds.
            </p>

            <div className="final-cta-btn-wrap">
              <button
                type="button"
                onClick={() => navigate('/credit/consent')}
                className="btn-white-hero-cta"
              >
                Check My Credit Health <ArrowRight size={18} />
              </button>
            </div>

            <p className="final-legal-disclaimer">
              Educational analysis of your uploaded report only. Not a lender decision. Kepwe Credit Health Score is not a bureau score.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};

export default CreditProductPage;
