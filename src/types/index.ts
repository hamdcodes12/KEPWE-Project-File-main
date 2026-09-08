export type Domain = 'business' | 'indexpilot';

// IndexPilot Types
export type VerdictState = 'TRADE' | 'CAUTION' | 'NO_TRADE';

export interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  vix: number;
  iqScore: number;
  iqStatus: string;
  verdict: VerdictState;
  verdictTitle: string;
  verdictReason: string;
  confidence: number;
  trend: 'Bullish' | 'Bearish' | 'Sideways';
  momentum: number;
  volatility: 'Low' | 'Medium' | 'High';
  regime: 'Trending' | 'Range-bound' | 'Volatile' | 'Uncertain';
  support: number;
  resistance: number;
  advanceDecline: number;
  sgxCues: number;
  ivPercentile: number;
  lastUpdated: string;
}

export interface OptionStrike {
  strike: number;
  callOi: string;
  callOiRaw: number;
  callIv: number;
  putIv: number;
  putOi: string;
  putOiRaw: number;
  isAtm?: boolean;
  deltaCall?: number;
  thetaCall?: number;
  gammaCall?: number;
  vegaCall?: number;
}

export interface StrategyCardData {
  id: string;
  name: string;
  type: string;
  description: string;
  regimeFit: string;
  buyLeg: string;
  sellLeg: string;
  maxLoss: number;
  maxProfit: number;
  breakeven: number;
  winProbability?: number;
  holdingPeriod: string;
  riskPercent: number; // e.g. 2.5% of capital
  exceedsRiskLimit?: boolean;
  verdict: VerdictState;
}

export interface UserRiskProfile {
  experience: 'New' | 'Intermediate' | 'Experienced';
  capitalRange: '<₹25k' | '₹25k–1L' | '₹1L–5L' | '₹5L+';
  capitalAmount: number;
  maxAcceptableLoss: number;
  indices: string[];
  riskCategory: 'Conservative' | 'Balanced' | 'Aggressive';
}

export interface TradeJournalEntry {
  id: string;
  date: string;
  index: string;
  strategy: string;
  verdict: VerdictState;
  override: boolean;
  overrideReason?: string;
  status: 'Executed' | 'Skipped' | 'Paper Trade' | 'Overridden';
  pnl?: number;
}

// Kepwe Business Platform Types
export interface ComplianceHealthScore {
  overallScore: number;
  gstStatus: 'Good' | 'Attention' | 'Action';
  tdsStatus: 'Good' | 'Attention' | 'Action';
  mcaStatus: 'Good' | 'Attention' | 'Action';
  payrollStatus: 'Good' | 'Attention' | 'Action';
  issuesFound: number;
  recommendations: string[];
}

export interface CRMLead {
  id: string;
  companyName: string;
  contactName: string;
  mobile: string;
  email: string;
  cin: string;
  gstin: string;
  incorporationDate: string;
  industry: string;
  state: string;
  gstStatus: 'Active' | 'Pending' | 'Inactive';
  leadScore: 'HOT' | 'WARM' | 'COLD';
  leadSource: string;
  salesActivity: string[];
  assignedExecutive: string;
  status: 'New' | 'Called' | 'Connected' | 'Interested' | 'Converted';
}

export interface FollowupCadence {
  day: string;
  channel: 'WhatsApp/SMS' | 'Email' | 'WhatsApp' | 'Offer' | 'Follow-up' | 'Campaign';
  message: string;
}

export interface CustomerTask {
  id: string;
  category: 'GST' | 'TDS' | 'MCA' | 'Payroll' | 'Income Tax';
  title: string;
  dueDate: string;
  status: 'Upcoming' | 'In Progress' | 'Completed' | 'Action Required';
}

export interface CustomerDocument {
  id: string;
  name: string;
  category: 'Company Documents' | 'GST' | 'Bank Statements' | 'Sales' | 'Purchases' | 'Payroll' | 'Tax' | 'Other';
  uploadDate: string;
  size: string;
  status: 'Uploaded' | 'Processing' | 'Verified';
}
