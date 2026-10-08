import { getAvailablePlans, getUserFeatures, getUserSubscription } from './subscription.service.js';

const FALLBACK_MESSAGE = "I don't have enough information to answer that accurately. Please check the relevant section of KEPWE or contact support.";

const FEATURE_LABELS = {
  dashboard: 'Dashboard',
  markets: 'Markets',
  pulse: 'Pulse / Index Monitor',
  watchlists: 'Live Watchlists',
  option_chain: 'Basic Option Chain',
  pnl_analytics: 'Basic P&L Analytics',
  risk_management: 'Risk Management',
  alerts: 'Basic Alerts',
  reports: 'Basic Reports',
  broker_connections: 'Broker Connections',
  account_settings: 'Account and Settings',
  strategy_builder: 'Strategy Builder',
  backtesting: 'Backtesting',
  advanced_option_chain: 'Advanced Option Chain Analytics',
  algo_strategies: 'Advanced Algo Strategies',
  advanced_backtesting: 'Advanced Backtesting',
  advanced_risk: 'Advanced Risk Analytics',
  trading_desk: 'Advanced Trading Desk',
  advanced_alerts: 'Advanced Alerts and Automation',
  advanced_reports: 'Advanced Reports and Analytics',
  live_execution: 'Live Execution',
};

const TOPIC_RESPONSES = [
  {
    terms: ['angel one', 'angelone', 'smartapi'],
    answer: 'KEPWE Quant supports Angel One SmartAPI. Open Broker Connections from the workspace and connect with your Angel One client code, MPIN and the current TOTP from your authenticator app. Your MPIN and TOTP are never stored, and live execution remains subject to the risk controls, OMS and deployment gates.',
    suggestions: ['What is Broker Connections?', 'What is the Trading Desk?'],
  },
  {
    terms: ['trial', 'free trial', '7 day', '7-day'],
    answer: 'Every eligible new account receives a server-managed 7-day free trial. Your exact trial status, remaining time, and end deadline are shown on the dashboard. Selected advanced features remain locked until a paid plan is active.',
    suggestions: ['What can I use in my trial?', 'What is locked in the trial?'],
  },
  {
    terms: ['locked', 'lock', 'premium feature', 'upgrade'],
    answer: 'Locked features remain visible with a lock indicator. Selecting one opens the upgrade flow. Access is enforced by the KEPWE backend, so the frontend cannot unlock a feature by changing browser state.',
    suggestions: ['What can I use in my trial?', 'Show my current plan'],
  },
  {
    terms: ['market analysis', 'analysis'],
    answer: 'Market Analysis is the workspace area for reviewing available market information and analysis views. It is separate from Pulse, which focuses on index monitoring.',
    suggestions: ['What is Pulse?', 'What is the option chain?'],
  },
  {
    terms: ['pulse', 'index monitor'],
    answer: 'Pulse is the index-monitoring view for the available live market feed. It helps you review index prices, changes, and the current feed state.',
    suggestions: ['What is Market Analysis?', 'What is the option chain?'],
  },
  {
    terms: ['option chain', 'options'],
    answer: 'Option Chain provides the available basic option-chain view. Advanced option-chain analytics are controlled by your plan entitlement.',
    suggestions: ['What is locked in the trial?', 'What is Pulse?'],
  },
  {
    terms: ['strategy', 'strategy builder', 'algo'],
    answer: 'Strategy Builder is used to configure strategies. Advanced Algo Strategies and execution capabilities are separate entitlements and may require a paid plan.',
    suggestions: ['What is backtesting?', 'What is Live Execution?'],
  },
  {
    terms: ['backtest', 'backtesting'],
    answer: 'Backtesting lets you evaluate strategy behavior against available historical inputs. Advanced backtesting is a separately controlled premium entitlement.',
    suggestions: ['What is Strategy Builder?', 'What is Risk Management?'],
  },
  {
    terms: ['p&l', 'pnl', 'profit and loss'],
    answer: 'The P&L area shows available account and trading performance information. The data shown is scoped to your authenticated account.',
    suggestions: ['What is Risk Management?', 'Show my current plan'],
  },
  {
    terms: ['risk', 'risk management'],
    answer: 'Risk Management and the existing deployment controls help keep execution workflows subject to configured risk rules. KEPWE does not bypass the Risk Engine, OMS, or live deployment gates.',
    suggestions: ['What is the Trading Desk?', 'What is Live Execution?'],
  },
  {
    terms: ['trading desk', 'desk'],
    answer: 'Trading Desk is an advanced workspace for trading workflows. Availability is controlled by your current server-side plan entitlement.',
    suggestions: ['What is Live Execution?', 'What is locked in the trial?'],
  },
  {
    terms: ['alert', 'alerts', 'automation'],
    answer: 'Alerts are available according to your plan configuration. Advanced alerts and automation are separate plan-controlled features.',
    suggestions: ['What are Reports?', 'What is locked in the trial?'],
  },
  {
    terms: ['report', 'reports', 'analytics'],
    answer: 'Reports and analytics are available from the relevant workspace areas. Advanced reports and analytics are controlled by your server-side plan entitlement.',
    suggestions: ['What is P&L?', 'Show my current plan'],
  },
  {
    terms: ['payment', 'payments', 'billing', 'razorpay', 'price', 'pricing', 'plan'],
    answer: 'Plans and pricing are loaded from the KEPWE server configuration. A paid plan is activated only after the payment gateway confirms the payment server-side; frontend payment claims alone do not unlock features.',
    suggestions: ['Show available plans', 'Show my current plan'],
  },
  {
    terms: ['account', 'settings', 'profile'],
    answer: 'Use Account, Profile, or Settings from the authenticated workspace navigation to manage your KEPWE account and preferences. Your session is shared across the KEPWE dashboards.',
    suggestions: ['Show my current plan', 'How do I use the platform?'],
  },
  {
    terms: ['how do i use', 'how to use', 'navigation', 'navigate', 'dashboard'],
    answer: 'Use the main navigation to move between the KEPWE workspaces. Within Quant, the workspace navigation includes Dashboard, Markets, Pulse, Option Chain, Strategy Builder, Backtesting, Risk Management, Trading Desk, Alerts, Reports, Broker Connections, Account, and Settings where available to your plan.',
    suggestions: ['What can I use in my trial?', 'Show my current plan'],
  },
];

function normalizeMessage(message) {
  return message.toLowerCase().replace(/[^a-z0-9&+\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatPlan(plan) {
  const price = Number(plan.price_inr).toLocaleString('en-IN');
  const period = plan.billing_period === 'trial' ? 'free' : `per ${plan.billing_period}`;
  return `${plan.display_name}: ₹${price} ${period}`;
}

async function getUserContext(userId) {
  const [subscription, features] = await Promise.all([
    getUserSubscription(userId),
    getUserFeatures(userId),
  ]);
  return { subscription, features };
}

export async function answerChatMessage(userId, message) {
  const normalized = normalizeMessage(message);
  const context = await getUserContext(userId);

  if (!normalized) {
    return { message: 'Tell me what you would like to know about KEPWE.', suggestions: ['What can I use in my trial?', 'Show my current plan'] };
  }

  if (normalized.includes('current plan') || normalized.includes('my plan') || normalized.includes('subscription status')) {
    const subscription = context.subscription;
    if (!subscription) return { message: 'No subscription record is available for your account. Please contact support.', suggestions: ['Show available plans'] };
    const status = subscription.status === 'trial' && subscription.isActive ? 'active free trial' : subscription.status;
    const deadline = subscription.trial_end_at || subscription.subscription_end_at;
    const deadlineText = deadline ? new Date(deadline).toLocaleString('en-IN') : 'no end date recorded';
    return { message: `Your current plan is ${subscription.display_name}. Status: ${status}. Valid until: ${deadlineText}.`, suggestions: ['What can I use in my trial?', 'Show available plans'] };
  }

  if (normalized.includes('what can i use') || normalized.includes('trial features') || normalized.includes('included in my trial')) {
    const included = Object.entries(context.features)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => FEATURE_LABELS[key] || key)
      .slice(0, 12);
    return { message: included.length ? `Your server-authorized available features include: ${included.join(', ')}. Advanced features may remain locked until you activate a paid plan.` : 'Your account has no active trial entitlements at the moment. Check your subscription status or choose a plan.', suggestions: ['What is locked in the trial?', 'Show my current plan'] };
  }

  if (normalized.includes('available plans') || normalized === 'plans' || normalized.includes('show plans')) {
    const plans = await getAvailablePlans();
    return { message: plans.map(formatPlan).join(' | '), suggestions: ['Show my current plan', 'How do payments work?'] };
  }

  const topic = TOPIC_RESPONSES.find(({ terms }) => terms.some((term) => normalized.includes(term)));
  return topic
    ? { message: topic.answer, suggestions: topic.suggestions }
    : { message: FALLBACK_MESSAGE, suggestions: ['What can I use in my trial?', 'Show available plans'] };
}
