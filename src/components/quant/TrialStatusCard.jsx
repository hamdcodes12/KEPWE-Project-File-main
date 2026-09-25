/**
 * KEPWE Quant — TrialStatusCard
 *
 * Shows the user's current subscription/trial status on the Quant dashboard.
 * Includes a live countdown (updates every second during trial).
 * Never shows "active" status based on frontend state alone — driven by
 * the server-authoritative SubscriptionContext.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Zap, CheckCircle2, AlertTriangle, Crown, ArrowRight, Star } from 'lucide-react';
import { useSubscription, PLAN_BADGES } from '../../context/SubscriptionContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatEndDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatEndTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(endDateStr) {
  const calc = useCallback(() => {
    if (!endDateStr) return null;
    const ms = Math.max(0, new Date(endDateStr).getTime() - Date.now());
    return {
      days:    Math.floor(ms / (1000 * 60 * 60 * 24)),
      hours:   Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((ms % (1000 * 60)) / 1000),
      expired: ms === 0,
    };
  }, [endDateStr]);

  const [countdown, setCountdown] = useState(calc);

  useEffect(() => {
    if (!endDateStr) return;
    const timer = setInterval(() => setCountdown(calc()), 1000);
    return () => clearInterval(timer);
  }, [endDateStr, calc]);

  return countdown;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CountdownBlock({ value, label }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: '44px',
    }}>
      <span style={{
        fontSize: '1.5rem',
        fontWeight: 800,
        color: '#0f172a',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {pad(value)}
      </span>
      <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
    </div>
  );
}

function CountdownSeparator() {
  return (
    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#cbd5e1', alignSelf: 'flex-start', marginTop: '4px' }}>
      :
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TrialStatusCard({ onViewPlans, compact = false }) {
  const { subscription, isTrial, isPaid, isExpired, isActive, planCode, loading } = useSubscription();

  const trialEnd   = subscription?.trialEndAt   || subscription?.trial_end_at;
  const subEnd     = subscription?.subscriptionEndAt || subscription?.subscription_end_at;
  const trialStart = subscription?.trialStartAt || subscription?.trial_start_at;
  const activeEnd  = isTrial ? trialEnd : subEnd;

  const countdown = useCountdown(isActive ? activeEnd : null);

  if (loading) {
    return (
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: compact ? '14px 16px' : '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#94a3b8',
        fontSize: '0.82rem',
        fontWeight: 600,
      }}>
        <Clock size={16} />
        Loading subscription…
      </div>
    );
  }

  // ── ACTIVE TRIAL ──────────────────────────────────────────────────────────
  if (isTrial && isActive && countdown && !countdown.expired) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #eff6ff 0%, #f0f4ff 100%)',
        border: '1.5px solid #bfdbfe',
        borderRadius: '14px',
        padding: compact ? '14px 16px' : '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, #2456d7, #7c3aed)',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '3px 10px', borderRadius: '20px',
                background: '#2456d7', color: '#fff',
                fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#93c5fd', flexShrink: 0 }} />
                FREE TRIAL · ACTIVE
              </span>
            </div>

            <div style={{ fontSize: compact ? '0.9rem' : '1.05rem', fontWeight: 700, color: '#1e3a8a', marginBottom: '4px' }}>
              Your free trial is active
            </div>
            <div style={{ fontSize: '0.78rem', color: '#3b82f6', fontWeight: 600 }}>
              <span style={{ display: 'block' }}>Trial ends: {formatEndDate(trialEnd)}</span>
              <span style={{ display: 'block', marginTop: '2px' }}>{formatEndTime(trialEnd)}</span>
            </div>
          </div>

          {/* Countdown */}
          {!compact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CountdownBlock value={countdown.days} label="days" />
              <CountdownSeparator />
              <CountdownBlock value={countdown.hours} label="hrs" />
              <CountdownSeparator />
              <CountdownBlock value={countdown.minutes} label="min" />
              <CountdownSeparator />
              <CountdownBlock value={countdown.seconds} label="sec" />
            </div>
          )}

          {compact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2456d7', fontWeight: 700, fontSize: '0.9rem' }}>
              <Clock size={14} />
              {countdown.days}d {pad(countdown.hours)}h remaining
            </div>
          )}
        </div>

        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={onViewPlans}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', borderRadius: '8px',
              background: '#2456d7', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.82rem',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Zap size={14} /> View Plans
          </button>
          <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
            Upgrade anytime — takes effect immediately.
          </span>
        </div>
      </div>
    );
  }

  // ── EXPIRED TRIAL ─────────────────────────────────────────────────────────
  if ((isTrial || subscription?.status === 'expired') && !isActive) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #fff7ed 0%, #fef9f0 100%)',
        border: '1.5px solid #fed7aa',
        borderRadius: '14px',
        padding: compact ? '14px 16px' : '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, #f97316, #ef4444)',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px',
            background: '#ffedd5', color: '#ea580c',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: compact ? '0.9rem' : '1rem', fontWeight: 700, color: '#9a3412', marginBottom: '4px' }}>
              FREE TRIAL EXPIRED
            </div>
            <div style={{ fontSize: '0.78rem', color: '#c2410c', marginBottom: '14px', lineHeight: 1.5 }}>
              Your 7-day free trial has ended. Choose a plan to continue using KEPWE Quant.
              Your strategies, backtests, and account data are safely stored.
            </div>
            <button
              onClick={onViewPlans}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 18px', borderRadius: '8px',
                background: '#ea580c', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.82rem',
              }}
            >
              <ArrowRight size={14} /> Choose a Plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE PAID ───────────────────────────────────────────────────────────
  if (isPaid && isActive) {
    const badge = PLAN_BADGES[planCode] || PLAN_BADGES.PRO;
    return (
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #f7fffe 100%)',
        border: '1.5px solid #bbf7d0',
        borderRadius: '14px',
        padding: compact ? '14px 16px' : '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, #10b981, #059669)',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '3px 10px', borderRadius: '20px',
                background: badge.color, color: '#fff',
                fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em',
              }}>
                <Crown size={11} /> {badge.label.toUpperCase()} · ACTIVE
              </span>
            </div>
            <div style={{ fontSize: compact ? '0.9rem' : '1rem', fontWeight: 700, color: '#14532d', marginBottom: '4px' }}>
              {badge.label} Plan — Active
            </div>
            {subEnd && (
              <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
                Renews: {formatEndDate(subEnd)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>
            <CheckCircle2 size={16} />
            All Features Active
          </div>
        </div>

        {!compact && (
          <div style={{ marginTop: '14px' }}>
            <button
              onClick={onViewPlans}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 16px', borderRadius: '8px',
                background: 'transparent', color: '#16a34a',
                border: '1.5px solid #bbf7d0', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.78rem',
              }}
            >
              <Star size={13} /> Manage Subscription
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── NO SUBSCRIPTION / CANCELLED ──────────────────────────────────────────
  return (
    <div style={{
      background: '#f8fafc',
      border: '1.5px solid #e2e8f0',
      borderRadius: '14px',
      padding: compact ? '14px 16px' : '20px 24px',
    }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
        No Active Subscription
      </div>
      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '14px' }}>
        Your subscription has expired or been cancelled. Choose a plan to regain full access.
      </div>
      <button
        onClick={onViewPlans}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '8px 18px', borderRadius: '8px',
          background: '#2456d7', color: '#fff',
          border: 'none', cursor: 'pointer',
          fontWeight: 700, fontSize: '0.82rem',
        }}
      >
        <Zap size={14} /> View Plans
      </button>
    </div>
  );
}
