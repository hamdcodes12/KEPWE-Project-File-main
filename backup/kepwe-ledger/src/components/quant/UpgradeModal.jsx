/**
 * KEPWE Quant — UpgradeModal
 *
 * Shown when a user clicks a locked premium feature.
 * Presents the available plans and routes to the pricing page.
 * Does NOT unlock features — that only happens after server-verified payment.
 */

import React, { useEffect, useRef } from 'react';
import { X, Lock, Zap, Crown, Star, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';
import { apiFetch } from '../../api/client';

// Plan highlights shown in modal (brief version of full pricing)
const PLAN_HIGHLIGHTS = [
  {
    code: 'BASIC',
    name: 'Basic',
    color: '#0891b2',
    tagline: 'For individual traders',
    highlights: ['Algo Strategies', 'Live Execution', 'Extended Backtesting', '3 Strategies'],
  },
  {
    code: 'PRO',
    name: 'Pro',
    color: '#7c3aed',
    tagline: 'Most popular',
    popular: true,
    highlights: ['Everything in Basic', 'Advanced Backtesting', 'Advanced Risk Analytics', 'Trading Desk', 'Advanced Reports', 'Unlimited Backtests'],
  },
  {
    code: 'ELITE',
    name: 'Elite',
    color: '#b45309',
    tagline: 'For professionals',
    highlights: ['Everything in Pro', 'Unlimited Strategies', 'Priority Support', 'Multi-Broker', 'Unlimited Alerts'],
  },
];

export default function UpgradeModal({ onClose, onViewPlans, featureLabel }) {
  const { upgradeModal, closeUpgradeModal, subscription, planCode } = useSubscription();
  const [plans, setPlans] = React.useState([]);

  const isOpen        = upgradeModal.open;
  const activeFeature = featureLabel || upgradeModal.featureLabel;
  const overlayRef    = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    apiFetch('/subscription/plans')
      .then((response) => {
        if (response.ok) setPlans(response.data?.plans || []);
      })
      .catch(() => {});
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') (onClose || closeUpgradeModal)(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, closeUpgradeModal]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = onClose || closeUpgradeModal;
  const handleViewPlans = () => {
    handleClose();
    if (onViewPlans) onViewPlans();
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        background: 'rgba(15,23,42,0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'quantFadeIn 0.18s ease',
      }}
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div style={{
        background: '#fff',
        borderRadius: '18px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(15,23,42,0.22)',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
        }}>
          <div style={{
            width: 44, height: 44,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)',
            border: '1.5px solid #c7d2fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            color: '#4f46e5',
          }}>
            <Lock size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 id="upgrade-modal-title" style={{
              margin: 0,
              fontSize: '1.1rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}>
              {activeFeature
                ? `${activeFeature} is a Premium Feature`
                : 'Upgrade to Unlock This Feature'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: '#64748b', lineHeight: 1.5 }}>
              {subscription?.status === 'trial'
                ? 'This feature is available with a paid plan. Upgrade to access it immediately.'
                : 'Choose a plan to unlock premium KEPWE Quant features.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            style={{
              flexShrink: 0, width: 32, height: 32,
              borderRadius: '8px', border: '1px solid #e2e8f0',
              background: '#f8fafc', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Plan cards */}
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {PLAN_HIGHLIGHTS.map((plan) => (
            <div
              key={plan.code}
              style={{
                border: plan.popular ? `2px solid ${plan.color}` : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 18px',
                background: plan.popular ? '#faf7ff' : '#fff',
                position: 'relative',
                transition: 'box-shadow 0.15s',
              }}
            >
              {plan.popular && (
                <span style={{
                  position: 'absolute', top: -11, left: 16,
                  background: plan.color,
                  color: '#fff',
                  padding: '2px 12px',
                  borderRadius: '20px',
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                }}>
                  MOST POPULAR
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '9px',
                    background: plan.color + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: plan.color,
                  }}>
                    <Crown size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{plan.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>{plan.tagline}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    {(() => {
                      const configuredPlan = plans.find((item) => item.code === plan.code);
                      return configuredPlan ? (
                        <>
                          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                            ₹{Number(configuredPlan.price).toLocaleString('en-IN')}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>/{configuredPlan.billingPeriod}</span>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Configured pricing</span>
                      );
                    })()}
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {plan.highlights.map((item) => (
                  <span key={item} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '3px 9px',
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: '20px',
                    fontSize: '0.7rem', fontWeight: 600, color: '#334155',
                  }}>
                    <CheckCircle2 size={11} color={plan.color} />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 24px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={handleViewPlans}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '10px 22px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2456d7, #7c3aed)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.88rem',
              letterSpacing: '-0.01em',
            }}
          >
            <Zap size={15} /> View Full Plans & Pricing
            <ArrowRight size={14} />
          </button>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'transparent',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.84rem',
            }}
          >
            Continue with Trial
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#94a3b8' }}>
            No credit card required to try
          </span>
        </div>
      </div>
    </div>
  );
}
