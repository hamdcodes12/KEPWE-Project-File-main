import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { useApp } from '../../context/AppContext';
import './LedgerPricingSection.css';

const FEATURE_LABELS = [
  ['manual_upi', 'UPI: manual entry'],
  ['basic_ai_expense_analysis', 'Basic AI expense analysis'],
  ['monthly_budget', 'Monthly budget'],
  ['income_expense_tracking', 'Income/expense tracking'],
  ['basic_net_worth', 'Basic net worth'],
  ['monthly_dashboard', 'Monthly dashboard'],
  ['spending_trends', 'Spending trends'],
  ['savings_rate', 'Savings rate'],
  ['unnecessary_expense_identification', 'Basic unnecessary-expense identification'],
  ['basic_alerts', 'Basic alerts'],
  ['ai_personal_cfo', 'AI Personal CFO'],
  ['personalized_recommendations', 'Personalized recommendations and financial plans'],
  ['affordability_analysis', '"Can I afford this?" analysis'],
  ['cash_flow_forecasting', 'Cash-flow forecasting'],
  ['expense_forecasting', 'Expense forecasting'],
  ['savings_forecasting', 'Savings forecasting'],
  ['recurring_expense_detection', 'Recurring expense/subscription detection'],
  ['spending_spike_alerts', 'Spending spike alerts'],
  ['budget_breach_alerts', 'Budget breach alerts'],
  ['low_balance_alerts', 'Low-balance alerts'],
  ['unusual_transaction_alerts', 'Unusual-transaction alerts'],
  ['emergency_fund_planning', 'Emergency fund planning'],
  ['debt_repayment_planning', 'Debt repayment planning'],
  ['financial_planning', 'Financial planning'],
  ['advanced_reports', 'Advanced reports'],
  ['report_export', 'Export reports'],
  ['advanced_ai_cfo', 'Advanced AI CFO'],
  ['personalized_financial_strategy', 'Personalized financial strategy'],
  ['monthly_cfo_reviews', 'Monthly CFO reviews'],
  ['quarterly_cfo_reviews', 'Quarterly CFO reviews'],
  ['ai_financial_roadmap', 'AI financial roadmap'],
  ['scenario_planning', 'What-if/scenario planning'],
  ['advanced_wealth_dashboard', 'Advanced wealth dashboard'],
  ['asset_tracking', 'Assets tracking'],
  ['liability_tracking', 'Liabilities tracking'],
  ['investment_tracking', 'Investments tracking'],
  ['insurance_tracking', 'Insurance tracking'],
  ['loan_tracking', 'Loans tracking'],
  ['retirement_planning', 'Retirement planning'],
  ['home_planning', 'Home planning'],
  ['education_planning', 'Education planning'],
  ['travel_planning', 'Travel planning'],
  ['fire_planning', 'FIRE planning'],
  ['custom_dashboards', 'Custom dashboards'],
  ['priority_support', 'Priority support'],
];

function formatLimit(value, noun) {
  return Number(value) === -1 ? 'Unlimited' : `${value} ${noun}`;
}

function PlanDetails({ plan, expanded = false }) {
  const features = FEATURE_LABELS.filter(([key]) => plan.features?.[key]).map(([, label]) => label);
  const limits = plan.limits || {};

  return (
    <div className="ledger-plan-details">
      <dl className="ledger-plan-limits">
        <div><dt>Bank accounts</dt><dd>{formatLimit(limits.bank_accounts, 'accounts')}</dd></div>
        <div><dt>Savings goals</dt><dd>{formatLimit(limits.savings_goals, 'goals')}</dd></div>
        <div><dt>AI insights</dt><dd>{limits.ai_insights_monthly === -1 ? 'Unlimited' : `${limits.ai_insights_monthly}/month`}</dd></div>
        <div><dt>History</dt><dd>{limits.history_months === -1 ? 'Unlimited' : `${limits.history_months} months`}</dd></div>
      </dl>
      <details className="ledger-plan-feature-list" open={expanded || undefined}>
        <summary>{expanded ? 'Included features' : `View all ${features.length} included features`}</summary>
        <ul>{features.map((label) => <li key={label}><Check size={14} aria-hidden="true" />{label}</li>)}</ul>
      </details>
    </div>
  );
}

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  const existingScript = document.querySelector('script[data-ledger-razorpay]');
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.ledgerRazorpay = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Razorpay Checkout could not be loaded.'));
    document.head.appendChild(script);
  });
}

export default function LedgerPricingSection({ compact = false }) {
  const { authState } = useApp();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingPlan, setPendingPlan] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const [plansResponse, subscriptionResponse] = await Promise.all([
        apiFetch('/ledger/plans', { auth: false }),
        authState.isLoggedIn ? apiFetch('/ledger/subscription') : Promise.resolve(null),
      ]);
      if (!active) return;
      if (plansResponse.ok && Array.isArray(plansResponse.data?.plans)) {
        setPlans(plansResponse.data.plans);
      } else {
        setError(plansResponse.data?.error || 'Ledger plans could not be loaded.');
      }
      if (subscriptionResponse?.ok) setSubscription(subscriptionResponse.data?.subscription || null);
      setLoading(false);
    };
    load().catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Ledger plans could not be loaded.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [authState.isLoggedIn]);

  const planFor = (code) => plans.find((plan) =>
    plan.plan_code === code && plan.billing_period === (code === 'FREE' ? 'monthly' : billingPeriod)
  );

  const startCheckout = async () => {
    if (!pendingPlan) return;
    if (!authState.isLoggedIn) {
      const returnTo = `/ledger/pricing?plan=${pendingPlan.plan_code}&billingPeriod=${billingPeriod}`;
      navigate(`/signup?product=ledger&returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    setProcessing(true);
    setError('');
    setNotice('');
    try {
      const orderResponse = await apiFetch('/ledger/subscription/orders', {
        method: 'POST',
        body: { planCode: pendingPlan.plan_code, billingPeriod },
      });
      if (!orderResponse.ok) throw new Error(orderResponse.data?.error || 'Could not create a Razorpay order.');
      await loadRazorpayScript();

      const { order, razorpayKeyId } = orderResponse.data;
      const checkout = new window.Razorpay({
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: 'KEPWE Ledger',
        description: `${order.planName} (${order.billingPeriod})`,
        order_id: order.orderId,
        prefill: { name: authState.user?.name || '', email: authState.user?.email || '' },
        theme: { color: '#176b55' },
        handler: async (payment) => {
          try {
            const verification = await apiFetch('/ledger/subscription/verify', {
              method: 'POST',
              body: {
                razorpay_order_id: payment.razorpay_order_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                razorpay_signature: payment.razorpay_signature,
              },
            });
            if (!verification.ok || !verification.data?.success) {
              throw new Error(verification.data?.error || 'Razorpay payment verification failed.');
            }
            const current = await apiFetch('/ledger/subscription');
            if (current.ok) setSubscription(current.data?.subscription || null);
            window.dispatchEvent(new CustomEvent('ledger-subscription-updated'));
            setNotice(`${order.planName} is active. Payment verified by Razorpay.`);
            setPendingPlan(null);
          } catch (verificationError) {
            setError(`${verificationError.message} Your plan stays unchanged until the payment is verified.`);
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: async () => {
            await apiFetch('/ledger/subscription/failure', {
              method: 'POST',
              body: { orderId: order.orderId, reason: 'Checkout dismissed before payment' },
            }).catch(() => {});
            setProcessing(false);
          },
        },
      });

      checkout.on('payment.failed', async (event) => {
        await apiFetch('/ledger/subscription/failure', {
          method: 'POST',
          body: { orderId: order.orderId, reason: event?.error?.description || 'Payment failed' },
        }).catch(() => {});
        setError(event?.error?.description || 'Razorpay reported that the payment failed. No plan was activated.');
        setProcessing(false);
      });
      checkout.open();
    } catch (checkoutError) {
      setError(checkoutError.message || 'Razorpay checkout could not be started.');
      setProcessing(false);
    }
  };

  const planCodes = ['FREE', 'PRO', 'PRO_PLUS'];

  return (
    <section className={`ledger-pricing-section${compact ? ' compact' : ''}`} id="ledger-pricing">
      <div className="ledger-pricing-heading">
        <div>
          <p className="ledger-pricing-eyebrow">KEPWE LEDGER PLANS</p>
          <h2>Clear plans. No surprises.</h2>
          <p>Choose the Ledger tools and limits that match how you manage your money.</p>
        </div>
        <div className="ledger-billing-switch" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={billingPeriod === 'monthly'} onClick={() => setBillingPeriod('monthly')}>Monthly</button>
          <button type="button" aria-pressed={billingPeriod === 'yearly'} onClick={() => setBillingPeriod('yearly')}>Yearly</button>
        </div>
      </div>

      {loading && <p className="ledger-pricing-status" role="status">Loading plans…</p>}
      {error && <p className="ledger-pricing-alert" role="alert">{error}</p>}
      {notice && <p className="ledger-pricing-success" role="status">{notice}</p>}

      {!loading && !error && (
        <div className="ledger-plan-grid">
          {planCodes.map((code) => {
            const plan = planFor(code);
            if (!plan) return null;
            const active = subscription?.plan_code === code && subscription?.status === 'active';
            const price = Number(plan.price_inr);
            return (
              <article className={`ledger-plan-card ${code === 'PRO' ? 'featured' : ''}`} key={code}>
                <div className="ledger-plan-card-top">
                  <div>
                    <p className="ledger-plan-kicker">{code === 'FREE' ? 'START HERE' : code === 'PRO' ? 'FOR EVERYDAY CONTROL' : 'FOR A FULLER FINANCIAL PICTURE'}</p>
                    <h3>{plan.display_name}</h3>
                  </div>
                  {active && <span className="ledger-current-plan">Current plan</span>}
                </div>
                <div className="ledger-plan-price">
                  <strong>₹{price.toLocaleString('en-IN')}</strong>
                  <span>/{code === 'FREE' ? 'month' : billingPeriod === 'yearly' ? 'year' : 'month'}</span>
                </div>
                <PlanDetails plan={plan} />
                {active ? (
                  <button className="ledger-plan-action current" type="button" disabled>Active plan</button>
                ) : code === 'FREE' ? (
                  <button className="ledger-plan-action secondary" type="button" onClick={() => {
                    if (!authState.isLoggedIn) navigate('/signup?product=ledger');
                    else setNotice('Free is included automatically with every Ledger account.');
                  }}>Start free</button>
                ) : (
                  <button className="ledger-plan-action" type="button" onClick={() => setPendingPlan(plan)}>
                    {authState.isLoggedIn ? `Choose ${plan.display_name}` : `Get ${plan.display_name}`}<ArrowRight size={16} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="ledger-pricing-footnote"><ShieldCheck size={15} /> Secure checkout by Razorpay. A paid plan activates only after server-side payment verification.</p>

      {pendingPlan && (
        <div className="ledger-checkout-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !processing) setPendingPlan(null);
        }}>
          <section className="ledger-checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="ledger-checkout-title">
            <button className="ledger-checkout-close" type="button" aria-label="Close checkout review" onClick={() => !processing && setPendingPlan(null)}><X size={18} /></button>
            <p className="ledger-pricing-eyebrow">CHECKOUT REVIEW</p>
            <h2 id="ledger-checkout-title">{pendingPlan.display_name} · {billingPeriod}</h2>
            <div className="ledger-checkout-amount">₹{Number(pendingPlan.price_inr).toLocaleString('en-IN')} <span>/{billingPeriod === 'yearly' ? 'year' : 'month'}</span></div>
            <PlanDetails plan={pendingPlan} expanded />
            <button className="ledger-plan-action" type="button" disabled={processing} onClick={startCheckout}>
              {processing ? 'Connecting to Razorpay…' : authState.isLoggedIn ? 'Continue to secure payment' : 'Sign up to continue'}
              <ArrowRight size={16} />
            </button>
            <p className="ledger-checkout-note">Your plan changes only after Razorpay confirms a captured payment.</p>
          </section>
        </div>
      )}
    </section>
  );
}