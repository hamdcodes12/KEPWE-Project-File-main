// Deprecated: All administrative state is now persisted in PostgreSQL.
export const mockAdminDb = {
  users: [],
  plans: [],
  subscriptions: [],
  payments: [],
  crmLeads: [],
  auditLogs: [],
  notifications: []
};

export function getMockAdminDashboard() {
  return {
    totalUsers: 0,
    newAccounts: 0,
    activeUsers: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    revenueChange: 0,
    recentRegistrations: [],
    recentPayments: []
  };
}

export function getMockRevenueAnalytics() {
  return {
    daily: [],
    weekly: [],
    monthly: [],
    activeSubscriptions: 0,
    trialToPaidConversion: 0
  };
}
