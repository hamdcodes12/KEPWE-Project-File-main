import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, CheckCircle2, Sparkles, Zap, Award } from 'lucide-react';
import { INDEXPILOT_SUBSCRIPTION_PLANS } from '../../data/mockData';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../api/client';
import { startRazorpayCheckout } from '../../lib/razorpay-checkout';
import './IndexPilotPricingCards.css';

const IndexPilotPricingCards = ({
  currentPlan = '',
  onSelectPlan,
  showHeader = false,
  isModal = false,
}) => {
  const navigate = useNavigate();
  const { authState, setSubscription } = useApp();
  const [hoveredPlanId, setHoveredPlanId] = useState(null);
  const [payingPlanId, setPayingPlanId] = useState(null);
  const [payError, setPayError] = useState('');

  const handlePlanClick = async (plan) => {
    // If a parent modal supplied onSelectPlan (e.g. upgrade modal), delegate to it.
    if (onSelectPlan) {
      onSelectPlan(plan.name, plan.price);
      return;
    }

    // Not logged in → go to signup with plan pre-selected.
    if (!authState?.isLoggedIn) {
      navigate(`/signup?plan=${encodeURIComponent(plan.name)}&price=${plan.price}`);
      return;
    }

    // Logged in → open Razorpay directly.
    setPayError('');
    setPayingPlanId(plan.id);
    try {
      const result = await startRazorpayCheckout({
        planName: plan.name,
        user: authState.user,
        apiFetch,
      });
      if (result.success && result.subscription) {
        setSubscription(result.subscription);
        // Navigate to account to show the activated subscription.
        navigate('/app/account');
      } else if (!result.cancelled) {
        setPayError(result.error || 'Payment could not be completed. Please try again.');
        setTimeout(() => setPayError(''), 6000);
      }
    } finally {
      setPayingPlanId(null);
    }
  };

  return (
    <div className={`ip-pricing-wrapper ${isModal ? 'ip-pricing-modal-view' : ''}`}>
      {showHeader && (
        <div className="ip-pricing-header">
          <div className="ip-pricing-eyebrow">
            <Sparkles size={14} />
            <span>TRANSPARENT SUBSCRIPTION PRICING</span>
          </div>
          <h2 className="ip-pricing-title">
            Simple plans for <span className="ip-title-accent">every index trader</span>
          </h2>
          <p className="ip-pricing-subtitle">
            Continuous access to live index verdicts, Kepwe IQ scoring, defined-risk strategy setups and risk management tools.
          </p>
        </div>
      )}

      {/* 4-Card Subscription Grid */}
      <div className={`ip-pricing-grid ${hoveredPlanId ? 'has-hovered-child' : ''}`}>
        {INDEXPILOT_SUBSCRIPTION_PLANS.map((plan, idx) => {
          const isCurrent = currentPlan && currentPlan.toUpperCase() === plan.name.toUpperCase();
          const isBestValue = plan.name === '3 MONTHS';
          const isPremium = plan.name === '1 YEAR';
          const isSixMonths = plan.name === '6 MONTHS';
          const isHovered = hoveredPlanId === plan.id;

          let cardClass = 'ip-pricing-card';
          if (isBestValue) cardClass += ' popular-card ip-theme-best-value';
          else if (isPremium) cardClass += ' ip-theme-premium';
          else if (isSixMonths) cardClass += ' ip-theme-six-months';
          else cardClass += ' ip-theme-standard';

          if (isCurrent) cardClass += ' is-active-plan-card';
          if (isHovered) cardClass += ' is-card-hovered';

          return (
            <div
              key={plan.id}
              className={cardClass}
              onMouseEnter={() => setHoveredPlanId(plan.id)}
              onMouseLeave={() => setHoveredPlanId(null)}
              style={{
                animationDelay: `${idx * 80}ms`
              }}
            >
              {/* Floating Top Badges */}
              {isBestValue && (
                <div className="ip-popular-top-badge">
                  <Sparkles size={13} /> BEST VALUE · RECOMMENDED
                </div>
              )}
              {isPremium && (
                <div className="ip-premium-top-badge">
                  <Award size={13} /> LONG-TERM VALUE · SAVE MAX
                </div>
              )}

              <div className="ip-card-head">
                {isCurrent && (
                  <div className="ip-active-status-pill">
                    <CheckCircle2 size={12} /> ACTIVE PLAN
                  </div>
                )}
                
                <h3 className="ip-plan-name">
                  {plan.name}
                </h3>
                <p className="ip-plan-tagline">{plan.shortDescription}</p>
              </div>

              {/* Price Box */}
              <div className="ip-price-box">
                <span className="ip-currency">₹</span>
                <span className="ip-amount">{plan.price.toLocaleString('en-IN')}</span>
                <span className="ip-period">{plan.billingLabel}</span>
              </div>

              {/* Effective Monthly Pill */}
              <div className="ip-effective-pill">
                <Zap size={12} />
                <span>{plan.effectiveMonthly}</span>
              </div>

              {/* Features List */}
              <ul className="ip-plan-features-list">
                {plan.features.map((feat, i) => (
                  <li key={i} className="ip-feature-item">
                    <CheckCircle2 size={16} className="ip-feature-check" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {/* Action Button */}
              <button
                type="button"
                disabled={isCurrent}
                onClick={() => handlePlanClick(plan)}
                className={`ip-plan-btn ${isBestValue ? 'ip-btn-best' : isPremium ? 'ip-btn-premium' : 'ip-btn-default'} ${isCurrent ? 'ip-btn-active' : ''}`}
              >
                {isCurrent ? (
                  <>
                    <CheckCircle2 size={15} /> Active Subscription
                  </>
                ) : (
                  <>
                    <span>{plan.ctaText}</span>
                    <ArrowRight size={15} className="ip-btn-arrow" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Regulatory & Risk Disclosure */}
      <div className="ip-compliance-disclosure">
        <ShieldCheck size={18} className="ip-compliance-icon" />
        <p>
          <strong>Regulatory Disclosure:</strong> IndexPilot is a market intelligence and decision-support tool. It does not guarantee profits, does not manage funds, and is not a substitute for independent judgment or, where appropriate, advice from a SEBI-registered investment adviser.
        </p>
      </div>
    </div>
  );
};

export default IndexPilotPricingCards;
