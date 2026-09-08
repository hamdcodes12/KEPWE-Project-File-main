import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, TrendingUp, Briefcase } from 'lucide-react';
import IndexPilotPricingCards from '../components/indexpilot/IndexPilotPricingCards';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../api/client';
import { startRazorpayCheckout } from '../lib/razorpay-checkout';

const BIZ_PLANS = [
  {
    name: 'Launch',
    price: 1499,
    tagline: 'For newly registered sole proprietorships & micro businesses',
    color: '#214ECF',
    features: [
      'GSTR-1 & GSTR-3B Monthly Filings',
      'Annual Income Tax Return (ITR-3/4)',
      'Dedicated CA Support via Chat',
      'Statutory Compliance Deadlines Alert',
    ],
  },
  {
    name: 'Essential',
    price: 2999,
    tagline: 'For early-stage Private Limiteds & LLPs',
    color: '#1B9E5A',
    features: [
      'Everything in Launch',
      'MCA ROC Filings (AOC-4 & MGT-7)',
      '100% ITC Purchase Reconciliation',
      'Payroll Processing (up to 10 Employees)',
      'Zero-Penalty Guarantee',
    ],
  },
  {
    name: 'Growth',
    price: 5999,
    popular: true,
    tagline: 'For scaling companies needing complete financial back office',
    color: '#7C3AED',
    features: [
      'Everything in Essential',
      'Quarterly Board MIS & P&L Statement',
      'Unlimited Payroll, PF & ESI Returns',
      'TDS Returns Filing (24Q & 26Q)',
      'Annual Tax Audit Assistance',
    ],
  },
  {
    name: 'Scale',
    price: 9999,
    tagline: 'For established SMEs & funded startups',
    color: '#D97706',
    features: [
      'Everything in Growth',
      'Dedicated Senior CA & CS Account Manager',
      'Cash Flow Forecasting & Runway Modeling',
      'Multi-GSTIN Branch Management',
      'Custom Internal Controls & Audit',
    ],
  },
  {
    name: 'Scale + CFO',
    price: 14999,
    tagline: 'Virtual CFO strategic leadership for high-growth enterprises',
    color: '#DB2777',
    features: [
      'Everything in Scale',
      'Virtual CFO Strategic Financial Partner',
      'Investor Pitch Deck & MIS Presentation',
      'Working Capital & Loan Financing Handoff',
      '24/7 Priority Phone & WhatsApp Line',
    ],
  },
];

const PricingPage = () => {
  const navigate = useNavigate();
  const { authState } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('product') === 'business' ? 'business' : 'indexpilot';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [payingPlan, setPayingPlan] = useState(null);
  const [bizError, setBizError] = useState('');
  const autoCheckoutKeyRef = useRef('');

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSearchParams({ product: tab });
  };

  const handleBizPlanClick = async (plan) => {
    if (!authState?.isLoggedIn) {
      navigate(`/signup?product=business&plan=${encodeURIComponent(plan.name)}&price=${plan.price}`);
      return;
    }
    setBizError('');
    setPayingPlan(plan.name);
    try {
      const result = await startRazorpayCheckout({
        planName: plan.name,
        user: authState.user,
        apiFetch,
      });
      if (result.success) {
        navigate('/business-onboarding');
      } else if (!result.cancelled) {
        setBizError(result.error || 'Payment could not be completed. Please try again.');
        setTimeout(() => setBizError(''), 6000);
      }
    } finally {
      setPayingPlan(null);
    }
  };

  useEffect(() => {
    const pendingCheckoutPlan = searchParams.get('checkout');
    const product = searchParams.get('product');

    if (!pendingCheckoutPlan || product !== 'business' || activeTab !== 'business' || !authState?.isLoggedIn) {
      return;
    }

    const matchedPlan = BIZ_PLANS.find(
      (plan) => plan.name.toLowerCase() === pendingCheckoutPlan.toLowerCase()
    );
    if (!matchedPlan) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('checkout');
      setSearchParams(nextParams, { replace: true });
      return;
    }

    const checkoutKey = `${product}:${matchedPlan.name}`;
    if (autoCheckoutKeyRef.current === checkoutKey) return;
    autoCheckoutKeyRef.current = checkoutKey;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('checkout');
    setSearchParams(nextParams, { replace: true });
    void handleBizPlanClick(matchedPlan);
  }, [activeTab, authState?.isLoggedIn, searchParams, setSearchParams]);

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '50px 20px 100px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Product Domain Switcher */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: '5px', borderRadius: '14px', border: '1px solid #CBD5E1', gap: '4px' }}>
            <button
              onClick={() => handleTabSwitch('indexpilot')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'indexpilot' ? '#0D9488' : 'transparent',
                color: activeTab === 'indexpilot' ? '#FFFFFF' : '#475569',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'indexpilot' ? '0 4px 12px rgba(13, 148, 136, 0.25)' : 'none',
              }}
            >
              <TrendingUp size={16} /> IndexPilot Intelligence
            </button>
            <button
              onClick={() => handleTabSwitch('business')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'business' ? '#214ECF' : 'transparent',
                color: activeTab === 'business' ? '#FFFFFF' : '#475569',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'business' ? '0 4px 12px rgba(33, 78, 207, 0.25)' : 'none',
              }}
            >
              <Briefcase size={16} /> Kepwe Business Platform
            </button>
          </div>
        </div>

        {activeTab === 'indexpilot' ? (
          <div>
            <IndexPilotPricingCards
              showHeader={true}
              isModal={false}
            />
          </div>
        ) : (
          <div>
            {/* Business Hero */}
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 48px' }}>
              <span style={{ background: '#E0E7FF', color: '#214ECF', fontSize: '0.85rem', fontWeight: 800, padding: '6px 16px', borderRadius: '9999px', letterSpacing: '0.05em' }}>
                BUSINESS COMPLIANCE & FINANCIAL OPS
              </span>
              <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, marginTop: '16px', marginBottom: '12px' }}>
                Everything Your Business Needs to Start, Comply & Grow
              </h1>
              <p style={{ color: '#5B6478', fontSize: '1.1rem', lineHeight: '1.6' }}>
                Don't just buy GST filings — get a complete financial back office. 100% zero-penalty statutory guarantee.
              </p>
            </div>

            {/* Business Pricing Cards Grid */}
            {bizError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px 16px', color: '#DC2626', fontWeight: 600, fontSize: '13px', marginBottom: '16px' }}>
                ⚠️ {bizError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '20px', marginBottom: '60px' }}>
              {BIZ_PLANS.map((plan) => (
                <div
                  key={plan.name}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '20px',
                    border: plan.popular ? `2px solid ${plan.color}` : '1px solid #E2E8F0',
                    padding: '28px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    position: 'relative',
                    boxShadow: plan.popular ? '0 15px 35px rgba(124,58,237,0.12)' : '0 4px 15px rgba(0,0,0,0.03)',
                  }}
                >
                  {plan.popular && (
                    <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 900, padding: '3px 14px', borderRadius: '9999px', letterSpacing: '0.06em' }}>
                      MOST POPULAR
                    </div>
                  )}

                  <div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0F172A', marginBottom: '4px' }}>{plan.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: '1.4', minHeight: '36px', marginBottom: '16px' }}>{plan.tagline}</p>

                    <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>₹</span>
                      <span style={{ fontSize: '1.8rem', fontWeight: 900, color: plan.color, fontFamily: 'monospace', letterSpacing: '-0.03em', lineHeight: 1 }}>{plan.price.toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#64748B', marginLeft: '2px' }}>/ month</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                      {plan.features.map((feat) => (
                        <div key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.84rem', color: '#334155', lineHeight: '1.4' }}>
                          <CheckCircle2 size={16} color={plan.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={payingPlan === plan.name}
                    onClick={() => handleBizPlanClick(plan)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: plan.color,
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      cursor: payingPlan === plan.name ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      opacity: payingPlan === plan.name ? 0.7 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {payingPlan === plan.name
                      ? 'Opening payment…'
                      : <>{`Start ${plan.name}`} <ArrowRight size={16} /></>
                    }
                  </button>
                </div>
              ))}
            </div>

            {/* Free Compliance Check Banner CTA */}
            <div style={{ background: 'linear-gradient(135deg, #17348F 0%, #214ECF 100%)', color: '#FFFFFF', borderRadius: '20px', padding: '36px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Unsure which plan fits your business structure?</h3>
              <p style={{ color: '#E2E8F0', marginBottom: '24px', fontSize: '1rem' }}>Run a free compliance check and receive a personalized recommendation in 2 minutes.</p>
              <button onClick={() => navigate('/free-compliance-check')} style={{ background: '#17E7C0', color: '#0A0E17', border: 'none', padding: '14px 28px', borderRadius: '10px', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                Run Free Compliance Check <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PricingPage;
