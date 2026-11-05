import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { SubscriptionProvider, useSubscription } from '../../context/SubscriptionContext';
import QuantDashboardPage from './QuantDashboardPage';
import './QuantTrialGate.css';

function TrialStateScreen({ title, description, children, icon: Icon = Clock3 }) {
  return <main className="quant-trial-state-page"><section className="quant-trial-state-card">
    <div className="quant-trial-state-icon"><Icon size={25} /></div>
    <span className="quant-trial-eyebrow">KEPWE QUANT · ACCOUNT ACCESS</span>
    <h1>{title}</h1><p>{description}</p>{children}
    <small><ShieldCheck size={14} /> Trial timing and access are verified by the KEPWE server.</small>
  </section></main>;
}

function QuantSubscriptionGate() {
  const { subscription, loading, error, isActive, isNotStarted, getCountdown, refreshSubscription } = useSubscription();
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [, setTick] = useState(0);
  const countdown = getCountdown();

  useEffect(() => {
    if (subscription?.status !== 'trial') return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [subscription?.status]);

  useEffect(() => {
    if (subscription?.status === 'trial' && countdown?.totalMs === 0) refreshSubscription();
  }, [subscription?.status, countdown?.totalMs, refreshSubscription]);

  const activate = useCallback(async () => {
    setActivating(true);
    setActivationError('');
    const result = await apiFetch('/subscription/trial/activate', { method: 'POST', body: {} });
    if (!result.ok) {
      setActivationError(result.data?.message || 'The demo could not be activated. Refresh the status and try again.');
      await refreshSubscription();
    } else {
      await refreshSubscription();
    }
    setActivating(false);
  }, [refreshSubscription]);

  if (loading) return <div className="quant-trial-loading" role="status"><span /> Checking your Quant access…</div>;
  if (subscription?.status === 'trial' && isActive && countdown?.totalMs > 0) return <QuantDashboardPage />;
  if (subscription?.status === 'active' && isActive) return <QuantDashboardPage />;
  if (subscription?.status === 'cancelled' && isActive) return <QuantDashboardPage />;

  if (isNotStarted) return <TrialStateScreen
    title="Your 24-Hour Free Demo Is Ready"
    description="Activate your one-time KEPWE Quant demo when you are ready. The 24-hour period starts only after you press the button."
    icon={LockKeyhole}
  >
    <button className="quant-trial-primary-button" onClick={activate} disabled={activating}>
      {activating ? 'Activating…' : 'Activate My Free Demo'} <ArrowRight size={17} />
    </button>
    {activationError && <div className="quant-trial-error" role="alert">{activationError}<button onClick={refreshSubscription} aria-label="Refresh trial status"><RefreshCw size={15} /></button></div>}
  </TrialStateScreen>;

  if (!subscription) return <TrialStateScreen
    title="We Couldn’t Verify Your Quant Access"
    description={error || 'Your subscription status is unavailable. Refresh to securely check your account.'}
    icon={ShieldCheck}
  >
    <button className="quant-trial-primary-button" onClick={refreshSubscription}>Retry status check <RefreshCw size={16} /></button>
  </TrialStateScreen>;

  const expiredTitle = subscription.status === 'expired' || subscription.status === 'trial'
    ? 'Your 24-Hour Free Trial Has Expired'
    : 'Your Quant Subscription Has Expired';
  return <TrialStateScreen
    title={expiredTitle}
    description="Your Quant workspace is protected while you are not on an active plan. Upgrade to restore access to your dashboard and strategies."
    icon={Clock3}
  >
    <Link className="quant-trial-primary-button" to="/pricing?product=quant">Upgrade to Continue <ArrowRight size={17} /></Link>
  </TrialStateScreen>;
}

export default function QuantTrialGate() {
  return <SubscriptionProvider><QuantSubscriptionGate /></SubscriptionProvider>;
}
