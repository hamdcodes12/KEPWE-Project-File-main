/**
 * KEPWE Quant Subscription API Routes
 * Handles subscription management, plan selection, and payments
 */

import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  getUserSubscription,
  getAvailablePlans,
  getPlanByCode,
  cancelSubscription,
  reactivateSubscription,
  getUserFeatures,
  getUserLimits,
  getSubscriptionAuditLog
} from '../services/subscription.service.js';
import {
  createPaymentOrder,
  verifyPaymentAndActivate,
  getPaymentHistory
} from '../services/payment.service.js';
import { getFeatureLockStatus } from '../middleware/feature-gate.js';

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES (No auth required)
// ============================================================================

/**
 * GET /api/subscription/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await getAvailablePlans();
    
    res.json({
      success: true,
      plans: plans.map(plan => ({
        id: plan.id,
        code: plan.plan_code,
        name: plan.plan_name,
        displayName: plan.display_name,
        description: plan.description,
        price: parseFloat(plan.price_inr),
        billingPeriod: plan.billing_period,
        trialDays: plan.trial_days,
        features: plan.features,
        limits: plan.limits,
        displayOrder: plan.display_order
      }))
    });
  } catch (error) {
    console.error('[subscription] Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch subscription plans'
    });
  }
});

/**
 * GET /api/subscription/plans/:code
 * Get specific plan details by code
 */
router.get('/plans/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const plan = await getPlanByCode(code.toUpperCase());
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'PLAN_NOT_FOUND',
        message: 'Plan not found'
      });
    }
    
    res.json({
      success: true,
      plan: {
        id: plan.id,
        code: plan.plan_code,
        name: plan.plan_name,
        displayName: plan.display_name,
        description: plan.description,
        price: parseFloat(plan.price_inr),
        billingPeriod: plan.billing_period,
        trialDays: plan.trial_days,
        features: plan.features,
        limits: plan.limits
      }
    });
  } catch (error) {
    console.error('[subscription] Error fetching plan:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch plan details'
    });
  }
});

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

/**
 * GET /api/subscription/status
 * Get current user's subscription status
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return res.json({
        success: true,
        subscription: null,
        message: 'No subscription found'
      });
    }
    
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        planCode: subscription.plan_code,
        planName: subscription.plan_name,
        displayName: subscription.display_name,
        status: subscription.status,
        isActive: subscription.isActive,
        
        // Trial information
        trialStartAt: subscription.trial_start_at,
        trialEndAt: subscription.trial_end_at,
        isTrialUsed: subscription.is_trial_used,
        
        // Subscription dates
        subscriptionStartAt: subscription.subscription_start_at,
        subscriptionEndAt: subscription.subscription_end_at,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        
        // Time remaining
        daysRemaining: subscription.daysRemaining,
        timeRemaining: subscription.timeRemaining,
        
        // Billing
        price: parseFloat(subscription.price_inr),
        billingPeriod: subscription.billing_period,
        autoRenew: subscription.auto_renew,
        nextPaymentAt: subscription.next_payment_at,
        
        // Features and limits
        features: subscription.features,
        limits: subscription.limits
      }
    });
  } catch (error) {
    console.error('[subscription] Error fetching subscription status:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch subscription status'
    });
  }
});

/**
 * GET /api/subscription/features
 * Get user's feature entitlements
 */
router.get('/features', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const featureLockStatus = await getFeatureLockStatus(userId);
    
    res.json({
      success: true,
      features: featureLockStatus
    });
  } catch (error) {
    console.error('[subscription] Error fetching features:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch feature entitlements'
    });
  }
});

/**
 * GET /api/subscription/limits
 * Get user's plan limits
 */
router.get('/limits', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const limits = await getUserLimits(userId);
    
    res.json({
      success: true,
      limits
    });
  } catch (error) {
    console.error('[subscription] Error fetching limits:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch plan limits'
    });
  }
});

/**
 * POST /api/subscription/upgrade
 * Create payment order for plan upgrade
 */
const upgradeSchema = z.object({
  planCode: z.enum(['BASIC', 'PRO', 'ELITE']),
  billingPeriod: z.enum(['monthly', 'quarterly', 'yearly']).optional()
}).strict();

router.post('/upgrade', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const validation = upgradeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: validation.error.errors
      });
    }
    
    const { planCode } = validation.data;
    
    // Get plan details
    const plan = await getPlanByCode(planCode);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'PLAN_NOT_FOUND',
        message: 'Selected plan not found'
      });
    }
    
    // Create payment order
    const order = await createPaymentOrder(userId, plan.id);
    
    res.json({
      success: true,
      order: {
        orderId: order.razorpay_order_id,
        amount: order.amount_inr,
        currency: order.currency,
        planCode: planCode,
        planName: plan.display_name
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('[subscription] Error creating upgrade order:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message || 'Failed to create payment order'
    });
  }
});

/**
 * POST /api/subscription/verify-payment
 * Verify payment and activate subscription
 */
const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1)
}).strict();

router.post('/verify-payment', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const validation = verifyPaymentSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid payment data',
        details: validation.error.errors
      });
    }
    
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = validation.data;
    
    // Verify payment and activate subscription
    const result = await verifyPaymentAndActivate(
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    
    res.json({
      success: true,
      message: 'Payment verified and subscription activated',
      subscription: {
        planCode: result.planCode,
        planName: result.planName,
        status: result.status,
        validUntil: result.subscriptionEndAt
      }
    });
  } catch (error) {
    console.error('[subscription] Error verifying payment:', error);
    res.status(400).json({
      success: false,
      error: 'PAYMENT_VERIFICATION_FAILED',
      message: error.message || 'Payment verification failed'
    });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancel current subscription
 */
const cancelSchema = z.object({
  reason: z.string().max(500).optional()
}).strict();

router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const validation = cancelSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: validation.error.errors
      });
    }
    
    const { reason } = validation.data;
    
    const subscription = await cancelSubscription(userId, reason);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'SUBSCRIPTION_NOT_FOUND',
        message: 'No active subscription found'
      });
    }
    
    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription: {
        status: subscription.status,
        cancelledAt: subscription.cancelled_at
      }
    });
  } catch (error) {
    console.error('[subscription] Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to cancel subscription'
    });
  }
});

/**
 * POST /api/subscription/reactivate
 * Reactivate cancelled subscription
 */
router.post('/reactivate', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    
    const subscription = await reactivateSubscription(userId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'SUBSCRIPTION_NOT_FOUND',
        message: 'No subscription found to reactivate'
      });
    }
    
    res.json({
      success: true,
      message: 'Subscription reactivated successfully',
      subscription: {
        status: subscription.status,
        autoRenew: subscription.auto_renew
      }
    });
  } catch (error) {
    console.error('[subscription] Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to reactivate subscription'
    });
  }
});

/**
 * GET /api/subscription/payments
 * Get payment history
 */
router.get('/payments', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    
    const payments = await getPaymentHistory(userId, limit);
    
    res.json({
      success: true,
      payments: payments.map(payment => ({
        id: payment.id,
        amount: parseFloat(payment.amount_inr),
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.payment_method,
        razorpayPaymentId: payment.razorpay_payment_id,
        paidAt: payment.paid_at,
        createdAt: payment.created_at
      }))
    });
  } catch (error) {
    console.error('[subscription] Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch payment history'
    });
  }
});

/**
 * GET /api/subscription/audit-log
 * Get subscription audit log
 */
router.get('/audit-log', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    
    const logs = await getSubscriptionAuditLog(userId, limit);
    
    res.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        eventType: log.event_type,
        description: log.event_description,
        oldStatus: log.old_status,
        newStatus: log.new_status,
        oldPlan: log.old_plan_code,
        newPlan: log.new_plan_code,
        metadata: log.metadata,
        createdAt: log.created_at
      }))
    });
  } catch (error) {
    console.error('[subscription] Error fetching audit log:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch audit log'
    });
  }
});

export default router;
