import { IndexData, OptionStrike, StrategyCardData, CRMLead, FollowupCadence, CustomerTask, CustomerDocument } from '../types';

export const MOCK_INDICES: Record<string, IndexData> = {
  NIFTY: {
    symbol: 'NIFTY',
    name: 'NIFTY 50 LIVE',
    price: 24812.35,
    change: 118.20,
    changePercent: 0.48,
    vix: 13.42,
    iqScore: 78,
    iqStatus: 'High Conviction',
    verdict: 'TRADE',
    verdictTitle: 'Bullish continuation bias above 24,750',
    verdictReason: 'Breadth positive · OI build-up in favor of upside · IV cooling. Conditions currently support a directional view.',
    confidence: 72,
    trend: 'Bullish',
    momentum: 74,
    volatility: 'Low',
    regime: 'Trending',
    support: 24600,
    resistance: 25000,
    advanceDecline: 1.9,
    sgxCues: 0.2,
    ivPercentile: 31,
    lastUpdated: '10 Aug 2026, 15:29:45 IST',
  },
  BANKNIFTY: {
    symbol: 'BANKNIFTY',
    name: 'BANK NIFTY LIVE',
    price: 51204.10,
    change: -108.50,
    changePercent: -0.21,
    vix: 14.10,
    iqScore: 42,
    iqStatus: 'Caution',
    verdict: 'NO_TRADE',
    verdictTitle: 'Range-bound, conflicting OI signals',
    verdictReason: 'PCR and price are diverging; probability edge is unclear. IndexPilot recommends waiting.',
    confidence: 38,
    trend: 'Sideways',
    momentum: 45,
    volatility: 'Medium',
    regime: 'Range-bound',
    support: 50800,
    resistance: 51800,
    advanceDecline: 0.85,
    sgxCues: -0.1,
    ivPercentile: 58,
    lastUpdated: '10 Aug 2026, 15:29:45 IST',
  },
  FINNIFTY: {
    symbol: 'FINNIFTY',
    name: 'FINNIFTY LIVE',
    price: 23904.80,
    change: 28.60,
    changePercent: 0.12,
    vix: 13.80,
    iqScore: 61,
    iqStatus: 'Favourable',
    verdict: 'CAUTION',
    verdictTitle: 'Mixed signals, event risk ahead',
    verdictReason: 'RBI policy decision tomorrow. Reduced position sizing recommended.',
    confidence: 58,
    trend: 'Bullish',
    momentum: 62,
    volatility: 'Medium',
    regime: 'Volatile',
    support: 23700,
    resistance: 24200,
    advanceDecline: 1.2,
    sgxCues: 0.1,
    ivPercentile: 45,
    lastUpdated: '10 Aug 2026, 15:29:45 IST',
  }
};

export const MOCK_OPTION_CHAIN: OptionStrike[] = [
  { strike: 24600, callOi: '18.2L', callOiRaw: 1820000, callIv: 14.1, putIv: 15.0, putOi: '9.4L', putOiRaw: 940000, deltaCall: 0.82, thetaCall: -14.2, gammaCall: 0.0008, vegaCall: 11.2 },
  { strike: 24700, callOi: '22.6L', callOiRaw: 2260000, callIv: 13.8, putIv: 14.6, putOi: '12.1L', putOiRaw: 1210000, deltaCall: 0.68, thetaCall: -16.5, gammaCall: 0.0012, vegaCall: 14.5 },
  { strike: 24800, callOi: '31.4L', callOiRaw: 3140000, callIv: 13.2, putIv: 13.9, putOi: '27.8L', putOiRaw: 2780000, isAtm: true, deltaCall: 0.51, thetaCall: -19.1, gammaCall: 0.0015, vegaCall: 16.8 },
  { strike: 24900, callOi: '40.9L', callOiRaw: 4090000, callIv: 12.9, putIv: 13.3, putOi: '15.6L', putOiRaw: 1560000, deltaCall: 0.34, thetaCall: -15.8, gammaCall: 0.0011, vegaCall: 13.4 },
  { strike: 25000, callOi: '52.3L', callOiRaw: 5230000, callIv: 12.6, putIv: 13.0, putOi: '11.2L', putOiRaw: 1120000, deltaCall: 0.18, thetaCall: -11.3, gammaCall: 0.0007, vegaCall: 9.1 },
];

export const MOCK_STRATEGIES: StrategyCardData[] = [
  {
    id: 'strat-1',
    name: 'Bull Call Spread',
    type: 'Bullish Debit Spread',
    description: 'Defined-risk bullish structure capitalizing on trending momentum above 24,750.',
    regimeFit: 'Trending Bullish',
    buyLeg: 'Buy 24,800 CE x75 (1 Lot)',
    sellLeg: 'Sell 25,000 CE x75 (1 Lot)',
    maxLoss: 6200,
    maxProfit: 9500,
    breakeven: 24862,
    holdingPeriod: '1–3 Days',
    riskPercent: 2.4,
    exceedsRiskLimit: false,
    verdict: 'TRADE'
  },
  {
    id: 'strat-2',
    name: 'Iron Condor Neutral',
    type: 'Defined-Risk Neutral',
    description: 'Sell OTM options and buy wings for range-bound sideways market regimes.',
    regimeFit: 'Range-bound Sideways',
    buyLeg: 'Buy 24,500 PE & Buy 25,100 CE',
    sellLeg: 'Sell 24,600 PE & Sell 25,000 CE',
    maxLoss: 3800,
    maxProfit: 6200,
    breakeven: 24638,
    holdingPeriod: '3–5 Days',
    riskPercent: 1.5,
    exceedsRiskLimit: false,
    verdict: 'TRADE'
  },
  {
    id: 'strat-3',
    name: 'Aggressive Call Ratio Spread',
    type: 'High Beta Trend',
    description: 'Uncapped upward potential with multi-lot leg exposure exceeding default loss limit.',
    regimeFit: 'Strong Breakout',
    buyLeg: 'Buy 24,800 CE x150 (2 Lots)',
    sellLeg: 'Sell 25,200 CE x300 (4 Lots)',
    maxLoss: 12500,
    maxProfit: 22000,
    breakeven: 24925,
    holdingPeriod: 'Intraday',
    riskPercent: 5.0,
    exceedsRiskLimit: true,
    verdict: 'NO_TRADE'
  }
];

export const MOCK_CRM_LEADS: CRMLead[] = [
  {
    id: 'lead-101',
    companyName: 'ABC Technologies Pvt Ltd',
    contactName: 'Your name',
    mobile: '+91 933477XXXX',
    email: 'naviXXXX@gmail.com',
    cin: 'U72200MH2026PTC384920',
    gstin: '27AABCA1234H1Z5',
    incorporationDate: '05 Aug 2026',
    industry: 'IT Services',
    state: 'Maharashtra',
    gstStatus: 'Active',
    leadScore: 'HOT',
    leadSource: 'New Incorporation Database',
    salesActivity: ['Call 1 — No Answer', 'Call 2 — Interested', 'Call 3 — Demo Scheduled'],
    assignedExecutive: 'Agent 1 (Vikram)',
    status: 'Interested'
  },
  {
    id: 'lead-102',
    companyName: 'Apex Global Logistics LLP',
    contactName: 'Your name',
    mobile: '+91 98111 XXXXX',
    email: 'naviXXXX@gmail.com',
    cin: 'AAB-9821',
    gstin: '07AAFFA9988G1Z2',
    incorporationDate: '01 Aug 2026',
    industry: 'Exporters / Freight',
    state: 'Delhi',
    gstStatus: 'Active',
    leadScore: 'HOT',
    leadSource: 'GST Filing Portal Inbound',
    salesActivity: ['Call 1 — Connected', 'Compliance Check Sent'],
    assignedExecutive: 'Agent 3 (Ananya)',
    status: 'Connected'
  },
  {
    id: 'lead-103',
    companyName: 'Zenith Retail & E-Commerce',
    contactName: 'Your name',
    mobile: '+91 99000 XXXXX',
    email: 'naviXXXX@gmail.com',
    cin: 'U52100GJ2026PTC443102',
    gstin: '24AAACZ4321J1Z9',
    incorporationDate: '28 Jul 2026',
    industry: 'E-commerce',
    state: 'Gujarat',
    gstStatus: 'Active',
    leadScore: 'WARM',
    leadSource: 'Free Compliance Check Form',
    salesActivity: ['Call 1 — Interested in GST & Payroll'],
    assignedExecutive: 'Agent 2 (Rohan)',
    status: 'Called'
  },
  {
    id: 'lead-104',
    companyName: 'Sunrise Food & Spices',
    contactName: 'Your name',
    mobile: '+91 97777 XXXXX',
    email: 'naviXXXX@gmail.com',
    cin: 'U15100KA2026PTC112233',
    gstin: 'Pending Registration',
    incorporationDate: '10 Aug 2026',
    industry: 'Restaurants & Food',
    state: 'Karnataka',
    gstStatus: 'Pending',
    leadScore: 'COLD',
    leadSource: 'MCA Incorporation Feed',
    salesActivity: ['Lead Imported'],
    assignedExecutive: 'Unassigned',
    status: 'New'
  }
];

export const MOCK_FOLLOWUPS: FollowupCadence[] = [
  { day: 'Day 0', channel: 'WhatsApp/SMS', message: 'Your free compliance assessment is ready.' },
  { day: 'Day 1', channel: 'Email', message: '5 things your newly incorporated company should complete.' },
  { day: 'Day 3', channel: 'WhatsApp', message: 'Would you like us to handle your monthly GST and accounting?' },
  { day: 'Day 7', channel: 'Offer', message: 'Start your compliance plan this month with 10% onboarding discount.' },
  { day: 'Day 15', channel: 'Follow-up', message: 'Standard re-engagement touch for MCA annual filing deadlines.' },
  { day: 'Day 30', channel: 'Campaign', message: 'Reactivation campaign: Virtual CFO & payroll audit offer.' }
];

export const MOCK_CUSTOMER_TASKS: CustomerTask[] = [
  { id: 'task-1', category: 'GST', title: 'GSTR-1 Sales Return Filing', dueDate: '12 Aug 2026', status: 'Upcoming' },
  { id: 'task-2', category: 'GST', title: 'GSTR-3B Summary Return Filing', dueDate: '20 Aug 2026', status: 'Upcoming' },
  { id: 'task-3', category: 'TDS', title: 'Monthly TDS Payment Challan', dueDate: '07 Aug 2026', status: 'Completed' },
  { id: 'task-4', category: 'MCA', title: 'DIR-3 KYC Director Annual Verification', dueDate: '30 Sep 2026', status: 'In Progress' },
  { id: 'task-5', category: 'Payroll', title: 'Monthly Salary & PF/ESI Processing', dueDate: '31 Aug 2026', status: 'Completed' },
];

export const MOCK_CUSTOMER_DOCUMENTS: CustomerDocument[] = [
  { id: 'doc-1', name: 'Certificate_of_Incorporation.pdf', category: 'Company Documents', uploadDate: '06 Aug 2026', size: '1.2 MB', status: 'Verified' },
  { id: 'doc-2', name: 'Company_PAN_TAN.pdf', category: 'Company Documents', uploadDate: '06 Aug 2026', size: '680 KB', status: 'Verified' },
  { id: 'doc-3', name: 'July_2026_Bank_Statement.pdf', category: 'Bank Statements', uploadDate: '08 Aug 2026', size: '3.4 MB', status: 'Processing' },
  { id: 'doc-4', name: 'July_Sales_Invoices.zip', category: 'Sales', uploadDate: '09 Aug 2026', size: '5.1 MB', status: 'Uploaded' },
];

export interface IndexPilotPlan {
  id: string;
  name: string;
  duration: string;
  price: number;
  billingLabel: string;
  effectiveMonthly: string;
  shortDescription: string;
  badge?: string;
  popular?: boolean;
  isIndexpilot: boolean;
  ctaText: string;
  features: string[];
}

export const INDEXPILOT_SUBSCRIPTION_PLANS: IndexPilotPlan[] = [
  {
    id: 'plan-1m',
    name: '1 MONTH',
    duration: '1 Month',
    price: 999,
    billingLabel: '/month',
    effectiveMonthly: '₹999/month',
    shortDescription: 'Full IndexPilot intelligence for 1 month.',
    isIndexpilot: true,
    ctaText: 'Start 1 Month',
    features: [
      'Live Index Dashboard',
      'Kepwe IQ',
      'Should I Trade? verdict',
      'Risk-first strategy filtering',
      'Defined-risk setups',
      'Risk Calculator',
      'Market Alerts'
    ]
  },
  {
    id: 'plan-3m',
    name: '3 MONTHS',
    duration: '3 Months',
    price: 2499,
    billingLabel: '/3 months',
    effectiveMonthly: '≈ ₹833/month',
    shortDescription: 'Full IndexPilot intelligence with 3 months of access.',
    badge: 'BEST VALUE',
    popular: true,
    isIndexpilot: true,
    ctaText: 'Choose 3 Months',
    features: [
      'Everything in 1 Month',
      '3 months continuous access',
      'Live Index Dashboard',
      'Kepwe IQ',
      'Strategy Engine',
      'Risk-first setups',
      'Risk Calculator',
      'Alerts & notifications'
    ]
  },
  {
    id: 'plan-6m',
    name: '6 MONTHS',
    duration: '6 Months',
    price: 4999,
    billingLabel: '/6 months',
    effectiveMonthly: '≈ ₹833/month',
    shortDescription: 'Extended access for traders who want a longer decision-support cycle.',
    isIndexpilot: true,
    ctaText: 'Choose 6 Months',
    features: [
      'Everything in 3 Months',
      '6 months continuous access',
      'Live market intelligence',
      'Kepwe IQ',
      'Should I Trade?',
      'Risk-filtered strategy setups',
      'Option-chain intelligence',
      'Risk tools',
      'Alerts & notifications'
    ]
  },
  {
    id: 'plan-1y',
    name: '1 YEAR',
    duration: '1 Year',
    price: 9999,
    billingLabel: '/year',
    effectiveMonthly: '≈ ₹833/month',
    shortDescription: 'Complete 12-month access to the IndexPilot intelligence platform.',
    badge: 'LONG-TERM VALUE',
    isIndexpilot: true,
    ctaText: 'Choose 1 Year',
    features: [
      'Everything in 6 Months',
      '12 months continuous access',
      'Live Index Dashboard',
      'Kepwe IQ',
      'Strategy Engine',
      'Risk-first filtering',
      'Defined-risk setups',
      'Option-chain intelligence',
      'Risk Calculator',
      'Alerts & notifications'
    ]
  }
];

export const INDEXPILOT_FREE_TIER: IndexPilotPlan = {
  id: 'plan-free',
  name: 'Free Tier',
  duration: 'Ongoing',
  price: 0,
  billingLabel: 'Free',
  effectiveMonthly: '₹0',
  shortDescription: 'Delayed & basic market signals.',
  isIndexpilot: true,
  ctaText: 'Get Started Free',
  features: [
    'Delayed/basic Index Dashboard',
    'Basic market signals',
    'Market education content',
    'Daily market view'
  ]
};

