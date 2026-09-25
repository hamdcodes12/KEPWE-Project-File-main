import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../api/client';
import { startRazorpayCheckout } from '../../lib/razorpay-checkout';
import './PricingSection.css';

const PricingSection = () => {
  const navigate = useNavigate();
  const { authState } = useApp();
  const [billingCycle, setBillingCycle] = useState('annual');
  const [payingPlan, setPayingPlan] = useState(null);   // which plan is loading
  const [errorMsg, setErrorMsg]   = useState('');

  const handleSelectPlan = async (plan) => {
    // Must be logged in to purchase
    if (!authState?.isLoggedIn) {
      navigate(`/signup?product=business&plan=${encodeURIComponent(plan.name)}&price=${plan.price}`);
      return;
    }

    setErrorMsg('');
    setPayingPlan(plan.name);
    try {
      const result = await startRazorpayCheckout({
        planName: plan.name,
        user: authState.user,
        apiFetch,
      });
      if (result.success) {
        navigate('/portal');   // go to customer portal after purchase
      } else if (!result.cancelled) {
        setErrorMsg(result.error || 'Payment could not be completed. Please try again.');
        setTimeout(() => setErrorMsg(''), 6000);
      }
    } finally {
      setPayingPlan(null);
    }
  };

  const plans = [
    {
      name: 'Launch',
      priceMonthly: 1899,
      priceAnnual: 1499,
      tagline: 'Ideal for early-stage startups & new registrations.',
      txLimit: 'Up to 50 transactions / month',
      popular: false,
      features: [
        'GST Registration & Monthly GSTR-1/3B',
        'Basic Double-Entry Bookkeeping',
        'Quarterly TDS Computation',
        'Standard Email & Chat Support'
      ]
    },
    {
      name: 'Essential',
      priceMonthly: 3699,
      priceAnnual: 2999,
      tagline: 'For growing businesses needing total filing peace of mind.',
      txLimit: 'Up to 150 transactions / month',
      popular: true,
      badgeText: 'MOST POPULAR FOR SMES',
      features: [
        'All Launch Plan Features',
        '2B vs Purchase Automated ITC Reconciliation',
        'MCA ROC Annual Filings (AOC-4 & MGT-7)',
        'Monthly Payroll for up to 15 Staff (PF/ESI)',
        'Dedicated Account Manager (CA Support)'
      ]
    },
    {
      name: 'Growth',
      priceMonthly: 7299,
      priceAnnual: 5999,
      tagline: 'For scaling companies needing strategic financial insights.',
      txLimit: 'Up to 400 transactions / month',
      popular: false,
      features: [
        'All Essential Plan Features',
        'Monthly Executive MIS & P&L Statement',
        'Payroll for up to 50 Staff',
        'Quarterly Virtual CFO Strategy Call',
        'Priority Phone & WhatsApp Support'
      ]
    },
    {
      name: 'Scale',
      priceMonthly: 11999,
      priceAnnual: 9999,
      tagline: 'Enterprise-grade full stack financial & compliance ops.',
      txLimit: 'Up to 1,000 transactions / month',
      popular: false,
      features: [
        'All Growth Plan Features',
        'Dedicated Full-Time Senior Virtual CFO',
        'Multi-Entity Group Book Consolidation',
        'Bank Credit & Loan Dossier Preparation',
        'Custom Board Presentation Reports'
      ]
    }
  ];

  return (
    <section className="pricing-section">
      <div className="pricing-container">
        {/* Header */}
        <ScrollReveal animation="fade-up" duration={400}>
          <div className="pricing-header">
            <div className="pricing-eyebrow">
              <Sparkles size={14} />
              <span>TRANSPARENT PRICING</span>
            </div>
            <h2 className="pricing-title">Simple plans for <span className="title-accent">every stage of growth</span></h2>
            <p className="pricing-subtitle">
              No hidden charges. No year-end audit surprises. Cancel or upgrade anytime.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="billing-toggle-container">
              <button
                className={`toggle-btn ${billingCycle === 'annual' ? 'active' : ''}`}
                onClick={() => setBillingCycle('annual')}
              >
                Annual Billing <span className="discount-pill">Save 20%</span>
              </button>
              <button
                className={`toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly Billing
              </button>
            </div>
          </div>
        </ScrollReveal>

        {/* Pricing Cards Grid */}
        <div className="pricing-cards-grid">
          {errorMsg && (
            <div style={{ gridColumn: '1/-1', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px 16px', color: '#DC2626', fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
              ⚠️ {errorMsg}
            </div>
          )}
          {plans.map((plan, idx) => {
            const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;
            const themeClass = `plan-theme-${plan.name.toLowerCase()}`;

            return (
              <ScrollReveal key={plan.name} animation="fade-up" duration={400} delay={idx * 80}>
                <div
                  className={`pricing-card ${themeClass} ${plan.popular ? 'popular-card' : ''}`}
                >
                  {plan.popular && (
                    <div className="popular-top-badge">
                      <Sparkles size={13} /> {plan.badgeText}
                    </div>
                  )}

                  <div className="card-head">
                    <h3 className="plan-name" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0F172A', marginBottom: '6px' }}>{plan.name}</h3>
                    <p className="plan-tagline">{plan.tagline}</p>
                  </div>

                  <div className="price-box" style={{ margin: '16px 0 12px 0', display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'wrap' }}>
                    <span className="currency" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>₹</span>
                    <span className="amount font-mono" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#2563EB', lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {price.toLocaleString('en-IN')}
                    </span>
                    <span className="period" style={{ fontSize: '0.92rem', color: '#64748B', fontWeight: 700, marginLeft: '2px' }}>/ month</span>
                  </div>

                  <div className="tx-limit-tag">{plan.txLimit}</div>

                  <ul className="plan-features-list">
                    {plan.features.map((feat, i) => (
                      <li key={i}>
                        <CheckCircle2 size={16} className="feature-check" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="card-footer-cta">
                    <button
                      type="button"
                      disabled={payingPlan === plan.name}
                      onClick={() => handleSelectPlan({ name: plan.name, price })}
                      className={`plan-cta-btn ${plan.popular ? 'popular-btn' : ''}`}
                      style={{ opacity: payingPlan === plan.name ? 0.7 : 1, cursor: payingPlan === plan.name ? 'wait' : 'pointer' }}
                    >
                      {payingPlan === plan.name ? 'Opening payment…' : <>Select {plan.name} Plan <ArrowRight size={16} /></>}
                    </button>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
