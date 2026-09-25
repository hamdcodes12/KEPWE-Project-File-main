/**
 * KEPWE Quant — Pricing & Plans Page
 *
 * Displays all 4 subscription tiers with features, limits, and CTAs.
 * Handles payment flow: creates Razorpay order → verifies server-side → activates.
 * Pricing data is loaded from the server — never hardcoded on this page alone.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, X, Crown, Zap, Star, ArrowRight,
  ShieldCheck, Clock, AlertTriangle, RefreshCw, Lock,
} from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useSubscription, PLAN_BADGES } from '../../context/SubscriptionContext';
import { useApp } from '../../context/AppContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price) {
  return `₹${Number(price).toLocaleString('en-IN')}`;
}

function formatPeriod(period) {
  const map = { monthly: '/month', quarterly: '/quarter', yearly: '/year', trial: 'Free' };
  return map[period] || `/${period}`;
}

// Feature display config for the pricing table
const FEATURE_ROWS = [
  { key: 'dashboard',             label: 'Dashboard & Workspace' },
  { key: 'markets',               label: 'Markets & Live Watchlist' },
  { key: 'pulse',                 label: 'Pulse (Index Monitor)' },
  { key: 'option_chain',          label: 'Option Chain (Basic)' },
  { key: 'pnl_analytics',         label: 'P&L Analytics (Basic)' },
  { key: 'broker_connections',    label: 'Broker Connections' },
  { key: 'strategy_builder',      label: 'Strategy Builder' },
  { key: 'backtesting',           label: 'Backtesting Engine (Basic)' },
  { key: 'alerts',                label: 'Alerts & Notifications (Basic)' },
  { key: 'reports',               label: 'Reports (Basic)' },
  { key: 'algo_strategies',       label: 'Algo Strategies' },
  { key: 'live_execution',        label: 'Live Execution' },
  { key: 'advanced_option_chain', label: 'Advanced Option Chain Analytics' },
  { key: 'advanced_backtesting',  label: 'Advanced Backtesting (Unlimited)' },
  { key: 'advanced_risk',         label: 'Advanced Risk Analytics' },
  { key: 'trading_desk',          label: 'Advanced Trading Desk' },
  { key: 'advanced_alerts',       label: 'Advanced Alerts & Automation' },
  { key: 'advanced_reports',      label: 'Advanced Reports & Analytics' },
];

const PLAN_ORDER = ['TRIAL', 'BASIC', 'PRO', 'ELITE'];

// ── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrent,
  onUpgrade,
  isProcessing,
}) {
  const isTrialPlan = plan.code === 'TRIAL';
  const badge = PLAN_BADGES[plan.code] || { color: '#2456d7', label: plan.name };

  return (
    <div style={{
      border: isCurrent ? `2px solid ${badge.color}` : '1.5px solid #e2e8f0',
      borderRadius: '16px',
      background: isCurrent ? badge.color + '06' : '#fff',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 200px',
      minWidth: '200px',
      maxWidth: '280px',
      position: 'relative',
      transition: 'box-shadow 0.2s, transform 0.2s',
      boxShadow: isCurrent ? `0 0 0 3px ${badge.color}22` : '0 1px 4px rgba(15,23,42,0.06)',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = isCurrent ? `0 0 0 3px ${badge.color}22` : '0 1px 4px rgba(15,23,42,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Popular badge */}
      {plan.code === 'PRO' && (
        <div style={{
          background: 'linear-gradient(90deg, #7c3aed, #4f46e5)',
          color: '#fff',
          textAlign: 'center',
          padding: '5px',
          fontSize: '0.68rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
        }}>
          ⭐ MOST POPULAR
        </div>
      )}

      {/* Current plan indicator */}
      {isCurrent && (
        <div style={{
          background: badge.color,
          color: '#fff',
          textAlign: 'center',
          padding: '5px',
          fontSize: '0.68rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
        }}>
          ✓ YOUR CURRENT PLAN
        </div>
      )}

      <div style={{ padding: '24px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Plan name + price */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '8px',
              background: badge.color + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: badge.color,
            }}>
              <Crown size={15} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{plan.name}</span>
          </div>

          {isTrialPlan ? (
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>FREE</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>7 days · No card required</div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                  {formatPrice(plan.price)}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                  {formatPeriod(plan.billingPeriod)}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                Billed {plan.billingPeriod}
              </div>
            </div>
          )}
        </div>

        {/* Feature list */}
        <div style={{ flex: 1, marginBottom: '20px' }}>
          {FEATURE_ROWS.filter(row => plan.features?.[row.key] === true).slice(0, 8).map(row => (
            <div key={row.key} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 0',
              fontSize: '0.78rem', color: '#334155',
            }}>
              <CheckCircle2 size={13} color={badge.color} style={{ flexShrink: 0 }} />
              {row.label}
            </div>
          ))}
          {FEATURE_ROWS.filter(row => plan.features?.[row.key] === true).length > 8 && (
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', fontStyle: 'italic' }}>
              + {FEATURE_ROWS.filter(r => plan.features?.[r.key] === true).length - 8} more features
            </div>
          )}
          {/* Locked features */}
          {FEATURE_ROWS.filter(row => plan.features?.[row.key] === false).slice(0, 3).map(row => (
            <div key={row.key} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 0',
              fontSize: '0.78rem', color: '#94a3b8',
            }}>
              <Lock size={11} style={{ flexShrink: 0, color: '#cbd5e1' }} />
              <span style={{ textDecoration: 'line-through' }}>{row.label}</span>
            </div>
          ))}
        </div>

        {/* Limits */}
        {plan.limits && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '16px',
          }}>
            {plan.limits.strategies !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '2px 0' }}>
                <span style={{ color: '#64748b' }}>Strategies</span>
                <strong style={{ color: '#0f172a' }}>
                  {plan.limits.strategies === -1 ? 'Unlimited' : plan.limits.strategies}
                </strong>
              </div>
            )}
            {plan.limits.alerts !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '2px 0' }}>
                <span style={{ color: '#64748b' }}>Alerts</span>
                <strong style={{ color: '#0f172a' }}>
                  {plan.limits.alerts === -1 ? 'Unlimited' : plan.limits.alerts}
                </strong>
              </div>
            )}
            {plan.limits.brokers !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '2px 0' }}>
                <span style={{ color: '#64748b' }}>Broker Accounts</span>
                <strong style={{ color: '#0f172a' }}>{plan.limits.brokers}</strong>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {isTrialPlan ? (
          <button disabled style={{
            padding: '11px', borderRadius: '10px',
            background: '#f1f5f9', color: '#94a3b8',
            border: '1px solid #e2e8f0', fontWeight: 700,
            fontSize: '0.84rem', cursor: 'not-allowed',
          }}>
            {isCurrent ? 'Current Plan' : 'Free (Auto-assigned)'}
          </button>
        ) : isCurrent ? (
          <button disabled style={{
            padding: '11px', borderRadius: '10px',
            background: badge.color + '18', color: badge.color,
            border: `1.5px solid ${badge.color}55`, fontWeight: 700,
            fontSize: '0.84rem', cursor: 'default',
          }}>
            <CheckCircle2 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Active Plan
          </button>
        ) : (
          <button
            onClick={() => onUpgrade(plan.code)}
            disabled={isProcessing}
            style={{
              padding: '11px', borderRadius: '10px',
              background: isProcessing ? '#94a3b8' : `linear-gradient(135deg, ${badge.color}, ${badge.color}dd)`,
              color: '#fff',
              border: 'none', cursor: isProcessing ? 'wait' : 'pointer',
              fontWeight: 700, fontSize: '0.84rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'opacity 0.15s',
            }}
          >
            {isProcessing ? (
              <><RefreshCw size={14} className="spin" /> Processing…</>
            ) : (
              <><Zap size={14} /> Upgrade to {plan.name}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function QuantPricingPage({ onNavigate }) {
  const { authState } = useApp();
  const { subscription, planCode, refreshSubscription } = useSubscription();

  const [plans, setPlans]           = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError]   = useState('');
  const [processing, setProcessing]   = useState(null); // plan code being processed
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  // Load plans from server
  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError('');
    try {
      const res = await apiFetch('/subscription/plans');
      if (res.ok && Array.isArray(res.data?.plans)) {
        setPlans(res.data.plans);
      } else {
        setPlansError('Failed to load plans. Please refresh.');
      }
    } catch (err) {
      setPlansError(err.message || 'Failed to load plans.');
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  // ── Razorpay checkout flow ─────────────────────────────────────────────────
  const handleUpgrade = useCallback(async (targetPlanCode) => {
    if (!authState.isLoggedIn) {
      setPaymentError('Please sign in to upgrade your plan.');
      return;
    }
    setProcessing(targetPlanCode);
    setPaymentError('');
    setPaymentSuccess('');

    try {
      // Step 1: Create order on server
      const orderRes = await apiFetch('/subscription/upgrade', {
        method: 'POST',
        body: { planCode: targetPlanCode },
      });

      if (!orderRes.ok) {
        throw new Error(orderRes.data?.message || 'Failed to create payment order');
      }

      const { order, razorpayKeyId } = orderRes.data;

      // Step 2: Load Razorpay checkout script
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load payment gateway'));
          document.head.appendChild(script);
        });
      }

      // Step 3: Open Razorpay checkout
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: razorpayKeyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: order.amount * 100, // paise
          currency: order.currency || 'INR',
          name: 'KEPWE Quant',
          description: `${order.planName} Subscription`,
          order_id: order.orderId,
          prefill: {
            name: authState.user?.name || '',
            email: authState.user?.email || '',
          },
          theme: { color: '#2456d7' },
          handler: async (response) => {
            try {
              // Step 4: Verify payment server-side
              const verifyRes = await apiFetch('/subscription/verify-payment', {
                method: 'POST',
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
              });

              if (verifyRes.ok) {
                setPaymentSuccess(
                  `🎉 Payment verified! Your ${verifyRes.data?.subscription?.planName || targetPlanCode} plan is now active.`
                );
                await refreshSubscription();
                resolve();
              } else {
                reject(new Error(verifyRes.data?.message || 'Payment verification failed'));
              }
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        });
        rzp.open();
      });

    } catch (err) {
      if (err.message !== 'Payment cancelled') {
        setPaymentError(err.message || 'Payment could not be completed. Please try again.');
      }
    } finally {
      setProcessing(null);
    }
  }, [authState, refreshSubscription]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const displayedPlans = plansLoading
    ? []
    : plans.filter(p => PLAN_ORDER.includes(p.code)).sort(
        (a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code)
      );

  return (
    <div className="quant-page-view">
      {/* Intro */}
      <section className="quant-page-intro">
        <div>
          <span className="quant-eyebrow">KEPWE QUANT · SUBSCRIPTION</span>
          <h1>Plans & Pricing</h1>
          <p>
            Choose a plan that matches your trading goals. Upgrade instantly — features activate the moment your payment is verified.
          </p>
        </div>
        {onNavigate && (
          <button className="quant-button quant-button-secondary" onClick={() => onNavigate('dashboard')}>
            ← Back to Dashboard
          </button>
        )}
      </section>

      {/* Current status strip */}
      {subscription && (
        <div style={{
          padding: '12px 20px',
          background: subscription.isActive ? '#f0fdf4' : '#fff7ed',
          border: `1px solid ${subscription.isActive ? '#bbf7d0' : '#fed7aa'}`,
          borderRadius: '10px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          fontSize: '0.83rem',
        }}>
          <ShieldCheck size={15} color={subscription.isActive ? '#16a34a' : '#ea580c'} />
          <span style={{ fontWeight: 600, color: subscription.isActive ? '#14532d' : '#9a3412' }}>
            {subscription.isActive
              ? `Current plan: ${subscription.displayName || subscription.planName}`
              : 'No active plan — subscribe to unlock features'}
          </span>
          {subscription.status === 'trial' && subscription.trialEndAt && (
            <span style={{ color: '#64748b' }}>
              · Trial ends {new Date(subscription.trialEndAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      )}

      {/* Alerts */}
      {paymentSuccess && (
        <div style={{
          padding: '14px 18px', background: '#f0fdf4', border: '1.5px solid #bbf7d0',
          borderRadius: '10px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '0.84rem', fontWeight: 600, color: '#14532d',
        }}>
          <CheckCircle2 size={16} color="#16a34a" />
          {paymentSuccess}
        </div>
      )}
      {paymentError && (
        <div style={{
          padding: '14px 18px', background: '#fff5f5', border: '1.5px solid #fecaca',
          borderRadius: '10px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '0.84rem', fontWeight: 600, color: '#991b1b',
        }}>
          <AlertTriangle size={16} color="#ef4444" />
          {paymentError}
          <button
            onClick={() => setPaymentError('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Plan grid */}
      {plansLoading ? (
        <div className="quant-panel" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={20} style={{ margin: '0 auto 10px', display: 'block', animation: 'spin 1s linear infinite' }} />
          Loading plans…
        </div>
      ) : plansError ? (
        <div className="quant-panel" style={{ padding: '28px', textAlign: 'center', color: '#ef4444' }}>
          <AlertTriangle size={24} style={{ marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
          {plansError}
          <button className="quant-button quant-button-secondary" style={{ marginTop: '14px' }} onClick={loadPlans}>
            Retry
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          marginBottom: '32px',
        }}>
          {displayedPlans.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              isCurrent={planCode === plan.code && subscription?.isActive}
              onUpgrade={handleUpgrade}
              isProcessing={processing === plan.code}
            />
          ))}
        </div>
      )}

      {/* Feature comparison table */}
      {!plansLoading && displayedPlans.length > 0 && (
        <div className="quant-panel" style={{ overflow: 'auto', marginBottom: '32px' }}>
          <div style={{ padding: '20px 24px 12px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              Full Feature Comparison
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              See exactly what's included in each plan.
            </p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
                  Feature
                </th>
                {displayedPlans.map(plan => (
                  <th key={plan.code} style={{
                    padding: '10px 16px', textAlign: 'center',
                    fontWeight: 800, color: PLAN_BADGES[plan.code]?.color || '#0f172a',
                    whiteSpace: 'nowrap',
                  }}>
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={row.key} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '9px 20px', color: '#334155', fontWeight: 500 }}>{row.label}</td>
                  {displayedPlans.map(plan => (
                    <td key={plan.code} style={{ padding: '9px 16px', textAlign: 'center' }}>
                      {plan.features?.[row.key] === true
                        ? <CheckCircle2 size={16} color={PLAN_BADGES[plan.code]?.color || '#10b981'} style={{ display: 'inline-block' }} />
                        : <X size={14} color="#e2e8f0" style={{ display: 'inline-block' }} />
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Security note */}
      <div className="quant-panel" style={{ padding: '20px 24px', background: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <ShieldCheck size={20} color="#2456d7" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '4px' }}>
              Secure Payment — Server-Side Verified
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6 }}>
              Payments are processed by Razorpay with HMAC-SHA256 signature verification on our servers.
              Your plan is activated only after the payment gateway confirms the transaction — never based on
              frontend state alone. All transactions are logged for full auditability.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
