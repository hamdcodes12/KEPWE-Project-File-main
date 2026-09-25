/**
 * KEPWE Quant Feature Gate Middleware
 * Server-side enforcement of subscription features
 */

import { hasFeatureAccess, getUserFeatures, getUserSubscription } from '../services/subscription.service.js';

/**
 * Feature keys for entitlement checking
 */
export const FEATURES = {
  // Core features (usually available in trial)
  DASHBOARD: 'dashboard',
  MARKETS: 'markets',
  PULSE: 'pulse',
  WATCHLISTS: 'watchlists',
  OPTION_CHAIN: 'option_chain',
  PNL_ANALYTICS: 'pnl_analytics',
  RISK_MANAGEMENT: 'risk_management',
  ALERTS: 'alerts',
  REPORTS: 'reports',
  BROKER_CONNECTIONS: 'broker_connections',
  ACCOUNT_SETTINGS: 'account_settings',
  STRATEGY_BUILDER: 'strategy_builder',
  BACKTESTING: 'backtesting',
  
  // Premium features (locked in trial, unlocked in paid plans)
  ADVANCED_OPTION_CHAIN: 'advanced_option_chain',
  ALGO_STRATEGIES: 'algo_strategies',
  ADVANCED_BACKTESTING: 'advanced_backtesting',
  ADVANCED_RISK: 'advanced_risk',
  TRADING_DESK: 'trading_desk',
  ADVANCED_ALERTS: 'advanced_alerts',
  ADVANCED_REPORTS: 'advanced_reports',
  LIVE_EXECUTION: 'live_execution'
};

/**
 * Middleware: Check if user has access to a specific feature
 * Usage: router.get('/endpoint', requireAuth, requireFeature(FEATURES.ADVANCED_BACKTESTING), handler)
 */
export function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }
      
      // Check feature access
      const hasAccess = await hasFeatureAccess(userId, featureKey);
      
      if (!hasAccess) {
        // Get subscription info for better error message
        const subscription = await getUserSubscription(userId);
        
        return res.status(403).json({
          error: 'FEATURE_LOCKED',
          feature: featureKey,
          message: 'Upgrade your plan to access this feature',
          currentPlan: subscription?.plan_code || 'NONE',
          subscriptionStatus: subscription?.status || 'none'
        });
      }
      
      // User has access, continue
      next();
    } catch (error) {
      console.error('[feature-gate] Error checking feature access:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify feature access'
      });
    }
  };
}

/**
 * Middleware: Check if user has any active subscription (trial or paid)
 */
export async function requireActiveSubscription(req, res, next) {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return res.status(403).json({
        error: 'NO_SUBSCRIPTION',
        message: 'No subscription found'
      });
    }
    
    if (!subscription.isActive) {
      return res.status(403).json({
        error: 'SUBSCRIPTION_EXPIRED',
        message: subscription.status === 'trial' 
          ? 'Your free trial has expired. Upgrade to continue using KEPWE Quant.'
          : 'Your subscription has expired. Renew to continue.',
        subscriptionStatus: subscription.status,
        expiredAt: subscription.status === 'trial' ? subscription.trial_end_at : subscription.subscription_end_at
      });
    }
    
    // Attach subscription to request for downstream use
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('[feature-gate] Error checking subscription:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to verify subscription'
    });
  }
}

/**
 * Helper: Check feature access without middleware (for service layer)
 */
export async function checkFeatureAccess(userId, featureKey) {
  try {
    const hasAccess = await hasFeatureAccess(userId, featureKey);
    
    if (!hasAccess) {
      const subscription = await getUserSubscription(userId);
      
      return {
        allowed: false,
        error: 'FEATURE_LOCKED',
        feature: featureKey,
        message: 'Upgrade your plan to access this feature',
        currentPlan: subscription?.plan_code || 'NONE',
        subscriptionStatus: subscription?.status || 'none'
      };
    }
    
    return {
      allowed: true
    };
  } catch (error) {
    console.error('[feature-gate] Error checking feature access:', error);
    return {
      allowed: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to verify feature access'
    };
  }
}

/**
 * Helper: Get feature lock status for multiple features
 * Returns object with feature keys and their lock status
 */
export async function getFeatureLockStatus(userId) {
  try {
    // Use the same DB function as requireFeature so expired trials and
    // subscriptions cannot remain visually unlocked after their end date.
    const features = await getUserFeatures(userId);

    return Object.keys(FEATURES).reduce((result, key) => {
      result[FEATURES[key]] = features[FEATURES[key]] === true;
      return result;
    }, {});
  } catch (error) {
    console.error('[feature-gate] Error getting feature lock status:', error);
    return Object.keys(FEATURES).reduce((result, key) => {
      result[FEATURES[key]] = false;
      return result;
    }, {});
  }
}
