import {
  consumeLedgerAiInsight,
  getLedgerEntitlements,
  getLedgerHistoryStart,
} from '../services/ledger-subscription.service.js';

export function requireLedgerFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const plan = await getLedgerEntitlements(req.userId);
      if (plan.features?.[featureKey] !== true) {
        return res.status(403).json({
          error: 'This feature is not included in your current Ledger plan.',
          code: 'LEDGER_FEATURE_REQUIRES_UPGRADE',
          requiredFeature: featureKey,
          currentPlan: plan.plan_code,
          upgradeUrl: '/ledger/pricing',
        });
      }
      req.ledgerEntitlements = plan;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export async function requireLedgerAiInsight(req, res, next) {
  try {
    const usage = await consumeLedgerAiInsight(req.userId);
    if (!usage.allowed) {
      return res.status(429).json({
        error: 'You have reached the 50 AI insights included with Free this month.',
        code: 'LEDGER_AI_INSIGHT_LIMIT_REACHED',
        remaining: 0,
        upgradeUrl: '/ledger/pricing',
      });
    }
    res.setHeader('X-Ledger-AI-Insights-Remaining', String(usage.remaining));
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function trackLedgerDashboardInsight(req, res, next) {
  try {
    const usage = await consumeLedgerAiInsight(req.userId);
    req.includeLedgerAiInsight = usage.allowed;
    res.setHeader('X-Ledger-AI-Insights-Remaining', String(usage.remaining));
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function limitLedgerHistory(req, res, next) {
  try {
    const cutoffDate = await getLedgerHistoryStart(req.userId);
    req.ledgerHistoryCutoff = cutoffDate;
    if (!cutoffDate) return next();
    const requestedFrom = req.query.dateFrom || req.query.date_from;
    const requestedPreset = req.query.datePreset || req.query.date_preset;
    const today = new Date().toISOString().slice(0, 10);

    if (requestedFrom && /^\d{4}-\d{2}-\d{2}$/.test(String(requestedFrom)) && requestedFrom < cutoffDate) {
      req.query.dateFrom = cutoffDate;
      req.query.date_from = cutoffDate;
      if (!requestedPreset || requestedPreset === 'all' || requestedPreset === 'custom') req.query.datePreset = 'custom';
      if (!req.query.dateTo) req.query.dateTo = today;
    } else if (!requestedFrom && (!requestedPreset || requestedPreset === 'all')) {
      req.query.datePreset = 'custom';
      req.query.dateFrom = cutoffDate;
      req.query.date_from = cutoffDate;
      req.query.dateTo = today;
      req.query.date_to = today;
    }
    if (req.query.datePreset === 'custom' && !req.query.dateTo) req.query.dateTo = today;
    if (req.query.period === 'all' || req.query.period === 'all_time') {
      req.query.period = 'custom';
      req.query.dateFrom = cutoffDate;
      req.query.dateTo = today;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}