/**
 * KEPWE Quant — SubscriptionContext
 *
 * Provides the authenticated user's subscription state to any component.
 * All entitlement decisions are made server-side; this context is a read
 * cache of the server's authoritative response.
 *
 * Usage:
 *   const { subscription, isFeatureAllowed, openUpgradeModal } = useSubscription();
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { apiFetch } from '../api/client';
import { useApp } from './AppContext';

// ── Feature key constants (must match feature-gate.js FEATURES map) ────────
export const FEATURES = {
  DASHBOARD:             'dashboard',
  MARKETS:               'markets',
  PULSE:                 'pulse',
  WATCHLISTS:            'watchlists',
  OPTION_CHAIN:          'option_chain',
  PNL_ANALYTICS:         'pnl_analytics',
  RISK_MANAGEMENT:       'risk_management',
  ALERTS:                'alerts',
  REPORTS:               'reports',
  BROKER_CONNECTIONS:    'broker_connections',
  ACCOUNT_SETTINGS:      'account_settings',
  STRATEGY_BUILDER:      'strategy_builder',
  BACKTESTING:           'backtesting',
  // --- Premium (locked in trial) ---
  ADVANCED_OPTION_CHAIN: 'advanced_option_chain',
  ALGO_STRATEGIES:       'algo_strategies',
  ADVANCED_BACKTESTING:  'advanced_backtesting',
  ADVANCED_RISK:         'advanced_risk',
  TRADING_DESK:          'trading_desk',
  ADVANCED_ALERTS:       'advanced_alerts',
  ADVANCED_REPORTS:      'advanced_reports',
  LIVE_EXECUTION:        'live_execution',
};

// Features that are available in the free trial
export const TRIAL_FEATURES = new Set([
  FEATURES.DASHBOARD,
  FEATURES.MARKETS,
  FEATURES.PULSE,
  FEATURES.WATCHLISTS,
  FEATURES.OPTION_CHAIN,
  FEATURES.PNL_ANALYTICS,
  FEATURES.RISK_MANAGEMENT,
  FEATURES.ALERTS,
  FEATURES.REPORTS,
  FEATURES.BROKER_CONNECTIONS,
  FEATURES.ACCOUNT_SETTINGS,
  FEATURES.STRATEGY_BUILDER,
  FEATURES.BACKTESTING,
]);

// Human-readable labels for features
export const FEATURE_LABELS = {
  [FEATURES.DASHBOARD]:             'Dashboard',
  [FEATURES.MARKETS]:               'Markets',
  [FEATURES.PULSE]:                 'Pulse (Index Monitor)',
  [FEATURES.WATCHLISTS]:            'Live Watchlists',
  [FEATURES.OPTION_CHAIN]:          'Option Chain',
  [FEATURES.PNL_ANALYTICS]:         'P&L Analytics',
  [FEATURES.RISK_MANAGEMENT]:       'Risk Management',
  [FEATURES.ALERTS]:                'Alerts',
  [FEATURES.REPORTS]:               'Reports',
  [FEATURES.BROKER_CONNECTIONS]:    'Broker Connections',
  [FEATURES.ACCOUNT_SETTINGS]:      'Account & Settings',
  [FEATURES.STRATEGY_BUILDER]:      'Strategy Builder',
  [FEATURES.BACKTESTING]:           'Backtesting Engine',
  [FEATURES.ADVANCED_OPTION_CHAIN]: 'Advanced Option Chain Analytics',
  [FEATURES.ALGO_STRATEGIES]:       'Advanced Algo Strategies',
  [FEATURES.ADVANCED_BACKTESTING]:  'Advanced Backtesting',
  [FEATURES.ADVANCED_RISK]:         'Advanced Risk Analytics',
  [FEATURES.TRADING_DESK]:          'Advanced Trading Desk',
  [FEATURES.ADVANCED_ALERTS]:       'Advanced Alerts & Automation',
  [FEATURES.ADVANCED_REPORTS]:      'Advanced Reports & Analytics',
  [FEATURES.LIVE_EXECUTION]:        'Live Execution & Algo Trading',
};

// Plans that require upgrade to access premium features
export const PLAN_BADGES = {
  TRIAL: { label: 'Free Trial', color: '#2456d7' },
  BASIC: { label: 'Basic',      color: '#0891b2' },
  PRO:   { label: 'Pro',        color: '#7c3aed' },
  ELITE: { label: 'Elite',      color: '#b45309' },
};

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { authState } = useApp();

  const [subscription, setSubscription]     = useState(null);
  const [features, setFeatures]             = useState({});
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  // Upgrade modal state
  const [upgradeModal, setUpgradeModal] = useState({
    open: false,
    featureKey: null,
    featureLabel: null,
  });

  const fetchedRef = useRef(false);

  // ── Load subscription from API ──────────────────────────────────────────
  const loadSubscription = useCallback(async () => {
    if (!authState.isLoggedIn) {
      setSubscription(null);
      setFeatures({});
      setLoading(false);
      return;
    }

    try {
      const [subRes, featRes] = await Promise.all([
        apiFetch('/subscription/status'),
        apiFetch('/subscription/features'),
      ]);

      if (subRes.ok && subRes.data?.subscription) {
        setSubscription(subRes.data.subscription);
      } else {
        setSubscription(null);
      }

      if (featRes.ok && featRes.data?.features) {
        setFeatures(featRes.data.features);
      } else {
        setFeatures({});
      }

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authState.isLoggedIn]);

  // Load on mount and whenever login state changes
  useEffect(() => {
    if (!authState.isLoading) {
      loadSubscription();
    }
  }, [authState.isLoading, authState.isLoggedIn, loadSubscription]);

  // ── Derived state ────────────────────────────────────────────────────────

  const planCode = subscription?.planCode || 'TRIAL';
  const isActive = subscription?.isActive === true;
  const isTrial  = subscription?.status === 'trial';
  const isPaid   = subscription?.status === 'active';
  const isExpired = !isActive && subscription != null;

  /**
   * Check if user is allowed to use a feature.
   * Uses the features map returned by the server — NOT computed client-side.
   */
  const isFeatureAllowed = useCallback(
    (featureKey) => {
      if (!isActive) return false;
      return features[featureKey] === true;
    },
    [features, isActive]
  );

  /**
   * Open the upgrade modal for a specific locked feature.
   */
  const openUpgradeModal = useCallback((featureKey) => {
    setUpgradeModal({
      open: true,
      featureKey,
      featureLabel: FEATURE_LABELS[featureKey] || featureKey,
    });
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradeModal({ open: false, featureKey: null, featureLabel: null });
  }, []);

  /**
   * Refresh subscription after payment or plan change.
   */
  const refreshSubscription = useCallback(() => {
    setLoading(true);
    return loadSubscription();
  }, [loadSubscription]);

  // ── Countdown helpers ────────────────────────────────────────────────────

  /**
   * Returns live { days, hours, minutes, seconds } countdown.
   * Returns null if no active trial/subscription end date.
   */
  const getCountdown = useCallback(() => {
    if (!subscription) return null;

    const endDate =
      subscription.status === 'trial'
        ? subscription.trialEndAt
        : subscription.subscriptionEndAt;

    if (!endDate) return null;

    const ms = Math.max(0, new Date(endDate).getTime() - Date.now());
    const days    = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours   = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, totalMs: ms };
  }, [subscription]);

  const value = {
    subscription,
    features,
    loading,
    error,
    planCode,
    isActive,
    isTrial,
    isPaid,
    isExpired,
    isFeatureAllowed,
    openUpgradeModal,
    closeUpgradeModal,
    upgradeModal,
    refreshSubscription,
    getCountdown,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  }
  return ctx;
}

export default SubscriptionContext;
