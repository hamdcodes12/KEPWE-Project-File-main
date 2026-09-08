import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  CreditCard, 
  ArrowRight, 
  Search, 
  SlidersHorizontal, 
  FileText, 
  Activity, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  Eye, 
  Smartphone, 
  Layers,
  HeartPulse,
  GraduationCap,
  Home,
  Plane,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Building2,
  Sparkles,
  Scale,
  Compass,
  Check,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import './CreditProductPage.css';

const TRUST_STRIP_ITEMS = [
  {
    title: 'Digital-first',
    desc: 'Start your journey online with minimal friction.'
  },
  {
    title: 'Clear information',
    desc: 'Understand applicable terms before proceeding.'
  },
  {
    title: 'Secure experience',
    desc: 'Your information deserves responsible handling.'
  },
  {
    title: 'Flexible discovery',
    desc: 'Explore options based on eligibility criteria.'
  }
];

const USE_CASES = [
  { 
    icon: HeartPulse, 
    title: 'Emergency Expenses', 
    desc: 'Manage unexpected financial requirements and emergency healthcare needs.' 
  },
  { 
    icon: GraduationCap, 
    title: 'Education', 
    desc: 'Support education-related expenses, tuition, courses, and certifications.' 
  },
  { 
    icon: Home, 
    title: 'Home Expenses', 
    desc: 'Handle planned or essential home repairs, upgrades, and renovation.' 
  },
  { 
    icon: ShoppingBag, 
    title: 'Major Purchases', 
    desc: 'Spread the cost of significant purchases, appliances, or equipment.' 
  },
  { 
    icon: Plane, 
    title: 'Travel', 
    desc: 'Finance eligible travel-related requirements and essential trips.' 
  },
  { 
    icon: RefreshCw, 
    title: 'Debt Consolidation', 
    desc: 'Explore options for consolidating multiple eligible debts into one payment.' 
  }
];

const WHY_KEPWE_CARDS = [
  {
    icon: Eye,
    title: 'Simple',
    desc: 'A streamlined digital journey designed to remove tedious paperwork and unnecessary friction.'
  },
  {
    icon: ShieldCheck,
    title: 'Transparent',
    desc: 'Important terms and conditions, interest rates, and fee structures presented with complete clarity.'
  },
  {
    icon: Smartphone,
    title: 'Digital',
    desc: 'Complete all applicable steps online — from soft eligibility check to digital document upload.'
  },
  {
    icon: Scale,
    title: 'Responsible',
    desc: 'Designed around informed borrowing rather than encouraging impulsive or unnecessary debt.'
  }
];

const ELIGIBILITY_FACTORS = [
  { factor: 'Age', desc: 'Typically between 21 and 58 years of age.' },
  { factor: 'Income', desc: 'Regular verifiable monthly salary or business turnover.' },
  { factor: 'Employment Profile', desc: 'Salaried, self-employed professionals, or business owners.' },
  { factor: 'Credit History', desc: 'Clean repayment track record with responsible credit utilization.' },
  { factor: 'Existing Obligations', desc: 'Manageable fixed obligation to income ratio (FOIR).' },
  { factor: 'Loan Requirement', desc: 'Alignment between requested loan amount and debt capacity.' },
  { factor: 'Lender Criteria', desc: 'Specific underwriting guidelines defined by partner institutions.' }
];

const TRUST_SECURITY_CARDS = [
  {
    icon: Lock,
    title: 'Privacy',
    desc: 'Your personal information should always be handled responsibly with strict confidentiality.'
  },
  {
    icon: ShieldCheck,
    title: 'Security',
    desc: 'Designed with security-conscious digital practices, 128-bit encryption, and secure APIs.'
  },
  {
    icon: Eye,
    title: 'Transparency',
    desc: 'Important loan information and representative terms should be easy to read and understand.'
  },
  {
    icon: UserCheck,
    title: 'Responsible Credit',
    desc: 'Borrow based on your genuine requirements, repayment capacity, and financial goals.'
  }
];

const FAQ_ITEMS = [
  {
    q: 'Is loan approval guaranteed?',
    a: 'No. Approval depends entirely on the relevant lending partner\'s eligibility criteria, underwriting policies, credit score assessment, and income verification.'
  },
  {
    q: 'What documents may be required?',
    a: 'Documents vary by lender and applicant profile and typically include identity proof (PAN card), address proof (Aadhaar), income proof (latest salary slips or ITR), and 3-6 months bank statements.'
  },
  {
    q: 'What interest rate will I receive?',
    a: 'Interest rates and loan terms are determined by the relevant lender based on your credit score, income profile, employer category, and applicable RBI/partner lending guidelines.'
  },
  {
    q: 'How much can I borrow?',
    a: 'Available loan amounts depend on your net monthly income, existing debt obligations (FOIR), repayment history, and the maximum credit limit permitted by the partner lender (typically ₹50,000 to ₹25,00,000).'
  },
  {
    q: 'Does checking eligibility affect my credit score?',
    a: 'Checking your preliminary eligibility on Kepwe Credit performs a soft inquiry, which does NOT impact your credit score. If you proceed with a formal application with a partner bank/NBFC, they may conduct a standard bureau inquiry.'
  },
  {
    q: 'How long does the process take?',
    a: 'Digital pre-qualification takes less than 2 minutes. Once submitted, lender verification and disbursement typically range from 24 hours to 2 business days depending on document completeness.'
  }
];

const CreditProductPage = () => {
  const navigate = useNavigate();

  // Interactive Mockup State in Hero Visual
  const [heroAmount, setHeroAmount] = useState(200000);
  const [heroTenure, setHeroTenure] = useState(24);

  // Live Calculator State
  const [amount, setAmount] = useState(250000);
  const [tenure, setTenure] = useState(24);
  const [rate, setRate] = useState(10.5); // Indicative interest rate %

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(0);

  // EMI Math: P * r * (1+r)^n / ((1+r)^n - 1)
  const monthlyRate = rate / 12 / 100;
  const emi = Math.round(
    (amount * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
    (Math.pow(1 + monthlyRate, tenure) - 1)
  );
  const totalPayable = emi * tenure;
  const totalInterest = totalPayable - amount;

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="credit-product-page">
      {/* ── 01. HERO SECTION ─────────────────────────────────────────── */}
      <section className="credit-hero-section">
        <div className="container">
          <div className="credit-hero-grid">
            
            {/* Left Hero Text */}
            <div className="credit-hero-text">
              <div className="credit-badge">
                <Sparkles size={14} color="#214ECF" />
                <span>KEPWE CREDIT ECOSYSTEM</span>
              </div>

              <h1 className="credit-hero-headline">
                Credit, without the <br />
                <span className="headline-accent">confusion.</span>
              </h1>

              <p className="credit-hero-sub">
                Explore personal loan options through a simple, transparent digital experience. Compare terms, evaluate repayments, and apply with clarity.
              </p>

              <div className="credit-hero-actions">
                <button 
                  type="button" 
                  onClick={() => navigate('/credit/eligibility')} 
                  className="btn-credit-primary btn-lg"
                >
                  Check Your Eligibility <ArrowRight size={18} />
                </button>
                <button 
                  type="button" 
                  onClick={() => scrollToSection('how-it-works')} 
                  className="btn-credit-secondary btn-lg"
                >
                  How It Works
                </button>
              </div>

              <div className="credit-trust-strip-hero">
                <span className="trust-dot-icon" />
                <span className="trust-strip-text">
                  Simple Application · Transparent Information · Digital Journey
                </span>
              </div>
            </div>

            {/* Right Hero Visual (Interactive UI Mockup) */}
            <div className="credit-hero-visual">
              <div className="hero-ui-mockup-card">
                <div className="mockup-header">
                  <div className="mockup-brand-title">
                    <CreditCard size={18} color="#214ECF" />
                    <span>Kepwe Credit</span>
                  </div>
                  <span className="mockup-tag">Interactive Preview</span>
                </div>

                <div className="mockup-content">
                  <div className="mockup-field-box">
                    <span className="m-field-label">How much do you need?</span>
                    <div className="m-amount-display">
                      ₹ {heroAmount.toLocaleString('en-IN')}
                    </div>
                    <input 
                      type="range"
                      min="50000"
                      max="1000000"
                      step="25000"
                      value={heroAmount}
                      onChange={(e) => setHeroAmount(Number(e.target.value))}
                      className="mockup-slider"
                    />
                    <div className="mockup-slider-bounds">
                      <span>₹50,000</span>
                      <span>₹10,00,000</span>
                    </div>
                  </div>

                  <div className="mockup-field-box">
                    <div className="m-tenure-row">
                      <span className="m-field-label">Preferred tenure</span>
                      <span className="m-tenure-val">{heroTenure} months</span>
                    </div>
                    <div className="m-tenure-pills">
                      {[12, 24, 36, 48].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setHeroTenure(t)}
                          className={`m-pill-btn ${heroTenure === t ? 'active' : ''}`}
                        >
                          {t} mo
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mockup-emi-summary">
                    <span className="m-emi-lbl">Indicative Monthly EMI</span>
                    <span className="m-emi-val">
                      ₹ {Math.round((heroAmount * (10.5/12/100) * Math.pow(1 + 10.5/12/100, heroTenure)) / (Math.pow(1 + 10.5/12/100, heroTenure) - 1)).toLocaleString('en-IN')}/mo
                    </span>
                  </div>

                  <button 
                    type="button" 
                    onClick={() => navigate('/credit/eligibility')} 
                    className="btn-credit-primary mockup-cta-btn"
                  >
                    Explore your options <ArrowRight size={16} />
                  </button>
                </div>

                <div className="mockup-footer-note">
                  <Lock size={12} color="#667085" />
                  <span>Soft check only · No impact on credit bureau score</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ── 03. TRUST STRIP (Immediately Below Hero) ──────────────────── */}
      <section className="credit-trust-strip-section">
        <div className="container">
          <div className="trust-strip-header text-center">
            <h3 className="trust-strip-title">A simpler way to explore credit</h3>
          </div>
          <div className="trust-strip-grid">
            {TRUST_STRIP_ITEMS.map((item, idx) => (
              <div key={idx} className="trust-strip-card">
                <div className="ts-indicator-dot" />
                <h4 className="ts-title">{item.title}</h4>
                <p className="ts-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── 04. PROBLEM → SOLUTION ────────────────────────────────────── */}
      <section className="credit-problem-solution-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>THE DIGITAL ADVANTAGE</span>
            </div>
            <h2 className="section-title">Getting credit shouldn't feel complicated.</h2>
            <p className="section-sub">
              Compare the traditional borrowing ordeal with the seamless Kepwe Credit digital path.
            </p>
          </div>

          <div className="problem-solution-grid">
            {/* Traditional Column */}
            <div className="comp-col traditional-col">
              <div className="col-badge traditional-badge">
                <ShieldAlert size={15} color="#B42318" />
                <span>TRADITIONAL BORROWING</span>
              </div>
              <h3 className="col-heading">Fragmented & Confusing</h3>
              <ul className="comp-points-list">
                <li className="comp-point-item negative">
                  <span className="cross-dot">✕</span>
                  <span>Multiple physical applications across different branches</span>
                </li>
                <li className="comp-point-item negative">
                  <span className="cross-dot">✕</span>
                  <span>Repeated document submissions and physical verification</span>
                </li>
                <li className="comp-point-item negative">
                  <span className="cross-dot">✕</span>
                  <span>Unclear terms, hidden penalty fees, and fine-print clauses</span>
                </li>
                <li className="comp-point-item negative">
                  <span className="cross-dot">✕</span>
                  <span>Long, opaque journeys with zero tracking visibility</span>
                </li>
              </ul>
            </div>

            {/* Kepwe Credit Column */}
            <div className="comp-col kepwe-col">
              <div className="col-badge kepwe-badge">
                <CheckCircle2 size={15} color="#214ECF" />
                <span>KEPWE CREDIT JOURNEY</span>
              </div>
              <h3 className="col-heading">Discover → Compare → Apply → Track</h3>
              <ul className="comp-points-list">
                <li className="comp-point-item positive">
                  <span className="check-dot">✓</span>
                  <span>One straightforward digital pre-qualification check</span>
                </li>
                <li className="comp-point-item positive">
                  <span className="check-dot">✓</span>
                  <span>100% paperless digital verification without repeat paperwork</span>
                </li>
                <li className="comp-point-item positive">
                  <span className="check-dot">✓</span>
                  <span>Clear, transparent rates, APR, processing fees, and terms</span>
                </li>
                <li className="comp-point-item positive">
                  <span className="check-dot">✓</span>
                  <span>Real-time journey tracking from application to direct disbursal</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>


      {/* ── 05. HOW IT WORKS (4 SIMPLE STEPS) ─────────────────────────── */}
      <section id="how-it-works" className="credit-how-it-works-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>THE PROCESS</span>
            </div>
            <h2 className="section-title">Four simple steps</h2>
            <p className="section-sub">
              From requirement to account disbursal — clear, straightforward, and digital.
            </p>
          </div>

          <div className="steps-cards-grid">
            
            {/* Step 1 */}
            <div className="step-feature-card">
              <div className="step-num-tag">STEP 01</div>
              <div className="step-icon-wrap">
                <FileText size={22} color="#214ECF" />
              </div>
              <h3 className="step-card-title">Tell us what you need</h3>
              <p className="step-card-desc">
                Enter your basic information, monthly profile, and loan requirement in under 2 minutes.
              </p>
            </div>

            {/* Step 2 */}
            <div className="step-feature-card">
              <div className="step-num-tag">STEP 02</div>
              <div className="step-icon-wrap">
                <SlidersHorizontal size={22} color="#214ECF" />
              </div>
              <h3 className="step-card-title">Check your options</h3>
              <p className="step-card-desc">
                Explore available pre-qualified options from verified lending partners based on your eligibility.
              </p>
            </div>

            {/* Step 3 */}
            <div className="step-feature-card">
              <div className="step-num-tag">STEP 03</div>
              <div className="step-icon-wrap">
                <CheckCircle2 size={22} color="#214ECF" />
              </div>
              <h3 className="step-card-title">Choose and apply</h3>
              <p className="step-card-desc">
                Review applicable terms and continue with the relevant lender application digitally.
              </p>
            </div>

            {/* Step 4 */}
            <div className="step-feature-card">
              <div className="step-num-tag">STEP 04</div>
              <div className="step-icon-wrap">
                <Activity size={22} color="#214ECF" />
              </div>
              <h3 className="step-card-title">Track your journey</h3>
              <p className="step-card-desc">
                Stay informed with live stage-by-stage tracking updates until direct bank disbursal.
              </p>
            </div>

          </div>

          <div className="how-it-works-cta-wrap text-center">
            <button 
              type="button" 
              onClick={() => navigate('/credit/eligibility')} 
              className="btn-credit-primary btn-lg"
            >
              Check My Eligibility <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>


      {/* ── 06. LOAN USE CASES (2x3 GRID) ─────────────────────────────── */}
      <section id="loan-options" className="credit-usecases-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>LOAN PURPOSES</span>
            </div>
            <h2 className="section-title">Credit for life's important moments.</h2>
            <p className="section-sub">
              Responsible financing structured around your genuine financial goals.
            </p>
          </div>

          <div className="usecases-2x3-grid">
            {USE_CASES.map((uc, idx) => {
              const Icon = uc.icon;
              return (
                <div key={idx} className="usecase-item-card">
                  <div className="uc-icon-wrap">
                    <Icon size={22} color="#214ECF" />
                  </div>
                  <h3 className="uc-card-title">{uc.title}</h3>
                  <p className="uc-card-desc">{uc.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="usecase-disclaimer-wrap text-center">
            <p className="usecase-disclaimer">
              *Loan availability, permitted use, and sanctioned limits may vary by partner lending institution and applicable underwriting terms.
            </p>
          </div>
        </div>
      </section>


      {/* ── 07. WHY KEPWE CREDIT (4 PILLARS) ──────────────────────────── */}
      <section className="credit-why-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>CORE PHILOSOPHY</span>
            </div>
            <h2 className="section-title">Built around clarity, not complexity.</h2>
            <p className="section-sub">
              Our principles are focused on transparent information and responsible borrowing.
            </p>
          </div>

          <div className="why-cards-grid">
            {WHY_KEPWE_CARDS.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={idx} className="why-card">
                  <div className="why-icon-box">
                    <Icon size={24} color="#214ECF" />
                  </div>
                  <h3 className="why-card-title">{card.title}</h3>
                  <p className="why-card-desc">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      {/* ── 08. ELIGIBILITY SECTION ──────────────────────────────────── */}
      <section id="eligibility-section" className="credit-eligibility-factors-section">
        <div className="container">
          <div className="eligibility-box-card">
            <div className="section-head text-center" style={{ marginBottom: '32px' }}>
              <div className="section-eyebrow" style={{ justifyContent: 'center' }}>
                <span className="eyebrow-blue-dot" />
                <span>ASSESSMENT CRITERIA</span>
              </div>
              <h2 className="section-title">Could you be eligible?</h2>
              <p className="section-sub" style={{ maxWidth: '640px' }}>
                Lenders evaluate your credit profile using standard underwriting parameters to determine loan amounts, rates, and sanction limits.
              </p>
            </div>

            <div className="factors-pills-list">
              {ELIGIBILITY_FACTORS.map((item, idx) => (
                <div key={idx} className="factor-pill-item">
                  <div className="factor-bullet">
                    <Check size={14} color="#214ECF" />
                  </div>
                  <div className="factor-texts">
                    <strong className="factor-name">{item.factor}:</strong>
                    <span className="factor-desc">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="eligibility-cta-box text-center">
              <button 
                type="button" 
                onClick={() => navigate('/credit/eligibility')} 
                className="btn-credit-primary btn-lg"
              >
                Check Eligibility <ArrowRight size={18} />
              </button>
              <span className="eligibility-hint">
                Takes 2 minutes · No hidden fees · Soft bureau check
              </span>
            </div>
          </div>
        </div>
      </section>


      {/* ── 09. LOAN CALCULATOR ───────────────────────────────────────── */}
      <section id="credit-calculator" className="credit-calc-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>REPAYMENT ESTIMATOR</span>
            </div>
            <h2 className="section-title">Understand your potential repayment</h2>
            <p className="section-sub">
              Adjust your desired loan amount and tenure to calculate illustrative monthly installments.
            </p>
          </div>

          <div className="calc-master-card">
            <div className="calc-layout-grid">
              
              {/* Sliders Area */}
              <div className="calc-sliders-col">
                
                {/* Loan Amount */}
                <div className="calc-slider-group">
                  <div className="c-slider-head">
                    <span className="c-head-label">Loan Amount</span>
                    <span className="c-head-val">₹{amount.toLocaleString('en-IN')}</span>
                  </div>
                  <input 
                    type="range"
                    min="50000"
                    max="1000000"
                    step="10000"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="calc-range-slider"
                  />
                  <div className="c-slider-bounds">
                    <span>₹50,000</span>
                    <span>₹10,00,000+</span>
                  </div>
                </div>

                {/* Tenure */}
                <div className="calc-slider-group" style={{ marginTop: '32px' }}>
                  <div className="c-slider-head">
                    <span className="c-head-label">Tenure (Months)</span>
                    <span className="c-head-val">{tenure} Months</span>
                  </div>
                  <input 
                    type="range"
                    min="6"
                    max="60"
                    step="6"
                    value={tenure}
                    onChange={(e) => setTenure(Number(e.target.value))}
                    className="calc-range-slider"
                  />
                  <div className="c-slider-bounds">
                    <span>6 Months</span>
                    <span>60 Months</span>
                  </div>
                </div>

                {/* Indicative Rate Info */}
                <div className="calc-rate-info-strip">
                  <span className="rate-lbl">Indicative Interest Rate:</span>
                  <span className="rate-val">{rate}% p.a.</span>
                  <span className="rate-sub">(Based on applicable lender terms)</span>
                </div>

              </div>

              {/* Result Summary Box */}
              <div className="calc-results-col">
                <span className="res-card-label">ESTIMATED REPAYMENT</span>
                
                <div className="res-emi-display">
                  <span className="res-emi-num">₹{emi.toLocaleString('en-IN')}</span>
                  <span className="res-emi-sub">/ month</span>
                </div>

                <div className="res-breakdown-table">
                  <div className="res-row">
                    <span>Principal Loan:</span>
                    <strong>₹{amount.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="res-row">
                    <span>Estimated Total Interest:</span>
                    <strong>₹{totalInterest.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="res-row highlight">
                    <span>Total Repayment:</span>
                    <strong>₹{totalPayable.toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={() => navigate('/credit/eligibility')} 
                  className="btn-credit-primary calc-cta-btn"
                >
                  Check Your Options <ArrowRight size={16} />
                </button>

                <p className="res-legal-note">
                  *Calculations are illustrative estimates for planning purposes only and do not constitute a binding offer or guarantee. Final terms are determined by the relevant lending institution.
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>


      {/* ── 10. TRUST / SECURITY (4 ICONS) ────────────────────────────── */}
      <section className="credit-security-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>DATA PROTECTION</span>
            </div>
            <h2 className="section-title">Your financial information matters.</h2>
            <p className="section-sub">
              Built with bank-grade security protocols, encryption, and responsible privacy standards.
            </p>
          </div>

          <div className="security-cards-grid">
            {TRUST_SECURITY_CARDS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="security-card">
                  <div className="sec-icon-wrap">
                    <Icon size={22} color="#214ECF" />
                  </div>
                  <h3 className="sec-card-title">{item.title}</h3>
                  <p className="sec-card-desc">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      {/* ── 11. LENDER / PARTNER ECOSYSTEM ─────────────────────────────── */}
      <section className="credit-ecosystem-section">
        <div className="container">
          <div className="ecosystem-card">
            <div className="eco-header text-center">
              <div className="section-eyebrow" style={{ justifyContent: 'center' }}>
                <span className="eyebrow-blue-dot" />
                <span>LENDING NETWORK</span>
              </div>
              <h2 className="section-title">Connecting you with the right credit ecosystem.</h2>
              <p className="section-sub" style={{ maxWidth: '680px' }}>
                Kepwe Credit operates as a digital credit discovery platform, presenting eligible personal loan opportunities through authorized and regulated lending partners.
              </p>
            </div>

            <div className="eco-badges-row">
              <div className="eco-badge-card">
                <Building2 size={24} color="#214ECF" />
                <span className="eco-badge-title">RBI-Regulated Lenders</span>
                <span className="eco-badge-sub">Scheduled Commercial Banks & NBFCs</span>
              </div>
              <div className="eco-badge-card">
                <ShieldCheck size={24} color="#214ECF" />
                <span className="eco-badge-title">Transparent Terms</span>
                <span className="eco-badge-sub">No unannounced fee schedules</span>
              </div>
              <div className="eco-badge-card">
                <Sparkles size={24} color="#214ECF" />
                <span className="eco-badge-title">Digital Verification</span>
                <span className="eco-badge-sub">Paperless e-KYC & fast approvals</span>
              </div>
            </div>

            <div className="eco-legal-disclaimer-box">
              <AlertCircle size={20} color="#B45309" />
              <p>
                <strong>Regulatory & Partner Notice:</strong> Kepwe Credit is not a lender or banking institution. Credit lines, loan approvals, interest rates, and disbursals are executed solely by applicable RBI-registered lending institutions subject to their respective terms and regulatory guidelines.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ── 12. FAQ SECTION (6 ITEMS ACCORDION) ────────────────────────── */}
      <section id="faq-section" className="credit-faq-section">
        <div className="container">
          <div className="section-head text-center">
            <div className="section-eyebrow">
              <span className="eyebrow-blue-dot" />
              <span>CLEAR ANSWERS</span>
            </div>
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-sub">
              Everything you need to know about checking eligibility, rates, and applying for credit.
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


      {/* ── 13. FINAL HIGH-CONVERSION BLUE SECTION ─────────────────────── */}
      <section className="credit-final-cta-section">
        <div className="container">
          <div className="final-blue-cta-box text-center">
            <h2 className="final-cta-headline">Ready to explore your options?</h2>
            <p className="final-cta-subhead">
              Start with your eligibility and discover the next step in under 2 minutes.
            </p>
            
            <div className="final-cta-btn-wrap">
              <button 
                type="button" 
                onClick={() => navigate('/credit/eligibility')} 
                className="btn-white-hero-cta"
              >
                Check My Eligibility <ArrowRight size={18} />
              </button>
            </div>

            <p className="final-legal-disclaimer">
              No guarantee of approval. Terms, rates, and eligibility are determined by the applicable lender(s).
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};

export default CreditProductPage;
