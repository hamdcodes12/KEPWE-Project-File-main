import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import CustomCursor from './components/common/CustomCursor';
import Announcements from './components/common/Announcements';
import { AppLeftRail, AppTopNav } from './components/layout/AppNav';

// Styling
import './styles/design-tokens.css';

// Business Pages
import HomePage from './pages/business/HomePage';
import FreeComplianceCheckPage from './pages/business/FreeComplianceCheckPage';
import CustomerPortalPage from './pages/business/CustomerPortalPage';
import SalesCRMPage from './pages/business/SalesCRMPage';
import { NewCompanyPage, GSTLandingPage, VirtualCFOPage } from './pages/business/BusinessLandingPages';
import AccountingPage from './pages/solutions/AccountingPage';
import LoansPage from './pages/solutions/LoansPage';
import CreditEligibilityPage from './pages/credit/CreditEligibilityPage';
import CreditApplicationPage from './pages/credit/CreditApplicationPage';
import CreditStatusPage from './pages/credit/CreditStatusPage';
import IndustryPages from './pages/business/IndustryPages';
import BusinessOnboardingPage from './pages/business/BusinessOnboardingPage';
import ComplianceCalendarPage from './pages/resources/ComplianceCalendarPage';
import CalculatorsPage from './pages/resources/CalculatorsPage';
import GSTGuidesPage from './pages/resources/GSTGuidesPage';
import BusinessGuidesPage from './pages/resources/BusinessGuidesPage';

// Business Core & Resource Pages
import PricingPage from './pages/PricingPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import CustomerOnboardingChecklistPage from './pages/business/CustomerOnboardingChecklistPage';

// Auth & Utility Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import NotFoundPage from './pages/NotFoundPage';
import LegalPages from './pages/LegalPages';
import { ProfilePage, SettingsPage } from './pages/account/ProfileSettingsPages';

// Admin Panel Pages
import {
  AdminLoginPage,
  AdminLayout,
  AdminDashboard,
  AdminUsersPage,
  AdminWebsitePage,
  AdminAnnouncementsPage,
} from './pages/admin/AdminPages';
import {
  AdminSubscriptionsPage,
  AdminPlansPage,
  AdminPaymentsPage,
  AdminCrmPage,
  AdminReportsPage,
  AdminAuditLogsPage,
  AdminNotificationsPage,
  AdminRevenueAnalyticsPage,
} from './pages/admin/AdminOperationsPages';

// IndexPilot Public Pages
import MarketingHomePage from './pages/indexpilot/MarketingHomePage';
import KepweIQPage from './pages/indexpilot/KepweIQPage';
import RiskCalculatorPage from './pages/indexpilot/RiskCalculatorPage';
import AppOnboardingPage from './pages/indexpilot/AppOnboardingPage';

// IndexPilot App Pages
import AppDashboardPage from './pages/indexpilot/AppDashboardPage';
import AppChainPage from './pages/indexpilot/AppChainPage';
import AppSetupsPage from './pages/indexpilot/AppSetupsPage';
import AppShieldPage from './pages/indexpilot/AppShieldPage';
import AppDeskPage from './pages/indexpilot/AppDeskPage';
import { AppAlertsPage, AppReportsPage, AppAccountPage } from './pages/indexpilot/AppAlertsReportsAccount';
import StrategyDetailPage from './pages/indexpilot/StrategyDetailPage';
// Marketing & Product Landing Pages
import QuantMarketingPage from './pages/quant/QuantMarketingPage';
import LedgerMarketingPage from './pages/ledger/LedgerMarketingPage';
import QuantDashboardPage from './pages/quant/QuantDashboardPage';
import LedgerDashboardPage from './pages/ledger/LedgerDashboardPage';

// ─── Scroll To Top (with hash anchor support) ───────────────────────────────
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    } else {
      setTimeout(() => {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [pathname, hash]);
  return null;
};

// ─── Main Layout (Business + IndexPilot Marketing) ───────────────────────────
const MainLayout = () => (
  <div className="app-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <Header />
    <main style={{ flex: 1 }}>
      <Outlet />
    </main>
    <Footer />
  </div>
);

const PublicLayout = MainLayout;

// ─── Clean Layout (Login / Signup / Onboarding — no header/footer) ───────────
const CleanLayout = () => (
  <div style={{ minHeight: '100vh' }}>
    <Outlet />
  </div>
);

// ─── App Layout (IndexPilot /app/*  — fixed left rail + sticky top nav + content) ───
const AppLayout = () => (
  <div className="app-layout-container">
    {/* Fixed Desktop left rail */}
    <AppLeftRail />
    {/* Page content wrapper with sticky top nav */}
    <div className="app-content-wrapper">
      <AppTopNav />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  </div>
);

const ProtectedAlgoRoute = () => <AlgoDashboardPage />;

const ProtectedLedgerRoute = ({ children }) => {
  const { authState } = useApp();
  const location = useLocation();

  if (authState.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F7F9FC', color: '#52647E', fontFamily: 'system-ui, sans-serif' }}>
        Checking your KEPWE LEDGE session…
      </div>
    );
  }

  if (!authState.isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return children;
};

const ProtectedQuantRoute = () => {
  const { authState } = useApp();
  const location = useLocation();

  if (authState.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F4F7FB', color: '#52647E', fontFamily: 'system-ui, sans-serif' }}>
        Checking your KEPWE QUANT session…
      </div>
    );
  }

  if (!authState.isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <QuantDashboardPage />;
};

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <AppProvider>
      <CustomCursor />
      <Announcements />
      <Router>
        <ScrollToTop />
        <Routes>
          {/* ── Clean Routes (no header/footer) ──────────────── */}
          <Route element={<CleanLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/onboarding" element={<AppOnboardingPage />} />
            <Route path="/business-onboarding" element={<BusinessOnboardingPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            {/* Admin login — separate from customer login */}
            <Route path="/admin-login" element={<AdminLoginPage />} />
            {/* IndexPilot login alias */}
            <Route path="/indexpilot/login" element={<LoginPage />} />
            <Route path="/indexpilot/signup" element={<SignupPage />} />
          </Route>

          {/* ── IndexPilot Algo protected workspace ─────────────── */}
          <Route path="/indexpilot-algo" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/dashboard" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/strategies" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/backtest" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/paper-trading" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/trades" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/positions" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/settings" element={<ProtectedAlgoRoute />} />

          {/* ── KEPWE QUANT workspace (Authenticated) ─────────────── */}
          <Route path="/quant/dashboard" element={<ProtectedQuantRoute />} />
          <Route path="/quant/dashboard/:section" element={<ProtectedQuantRoute />} />

          {/* ── KEPWE LEDGER workspace (Authenticated) ─────────────── */}
          <Route path="/dashboard" element={<ProtectedLedgerRoute><LedgerDashboardPage /></ProtectedLedgerRoute>} />
          <Route path="/portal" element={<ProtectedLedgerRoute><LedgerDashboardPage /></ProtectedLedgerRoute>} />
          <Route path="/portal/:tab" element={<ProtectedLedgerRoute><LedgerDashboardPage /></ProtectedLedgerRoute>} />
          <Route path="/ledger/app" element={<ProtectedLedgerRoute><LedgerDashboardPage /></ProtectedLedgerRoute>} />
          <Route path="/solutions/accounting" element={<ProtectedLedgerRoute><LedgerDashboardPage /></ProtectedLedgerRoute>} />

          {/* ── Admin Panel Routes (protected) ───────────────── */}
          <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
          <Route path="/admin/users" element={<AdminLayout><AdminUsersPage /></AdminLayout>} />
          <Route path="/admin/subscriptions" element={<AdminLayout><AdminSubscriptionsPage /></AdminLayout>} />
          <Route path="/admin/plans" element={<AdminLayout><AdminPlansPage /></AdminLayout>} />
          <Route path="/admin/payments" element={<AdminLayout><AdminPaymentsPage /></AdminLayout>} />
          <Route path="/admin/crm" element={<AdminLayout><AdminCrmPage /></AdminLayout>} />
          <Route path="/admin/website" element={<AdminLayout><AdminWebsitePage /></AdminLayout>} />
          <Route path="/admin/announcements" element={<AdminLayout><AdminAnnouncementsPage /></AdminLayout>} />
          <Route path="/admin/reports" element={<AdminLayout><AdminReportsPage /></AdminLayout>} />
          <Route path="/admin/revenue" element={<AdminLayout><AdminRevenueAnalyticsPage /></AdminLayout>} />
          <Route path="/admin/audit-logs" element={<AdminLayout><AdminAuditLogsPage /></AdminLayout>} />
          <Route path="/admin/notifications" element={<AdminLayout><AdminNotificationsPage /></AdminLayout>} />

          {/* ── IndexPilot App Routes (left rail + bottom nav) ── */}
          <Route element={<AppLayout />}>
            <Route path="/app/dashboard" element={<AppDashboardPage />} />
            <Route path="/app/chain" element={<AppChainPage />} />
            <Route path="/app/setups" element={<AppSetupsPage />} />
            <Route path="/app/strategies/:id" element={<StrategyDetailPage />} />
            <Route path="/app/shield" element={<AppShieldPage />} />
            <Route path="/app/desk" element={<AppDeskPage />} />
            <Route path="/app/alerts" element={<AppAlertsPage />} />
            <Route path="/app/reports" element={<AppReportsPage />} />
            <Route path="/app/account" element={<AppAccountPage />} />
          </Route>

          {/* ── Public Website Routes (Header + Footer) ────────── */}
          <Route element={<PublicLayout />}>
            {/* Kepwe Business Platform */}
            <Route path="/" element={<HomePage />} />
            <Route path="/quant" element={<QuantMarketingPage />} />
            <Route path="/ledger" element={<LedgerMarketingPage />} />
            <Route path="/free-compliance-check" element={<FreeComplianceCheckPage />} />
            <Route path="/portal/compliance-portal" element={<ProtectedLedgerRoute><CustomerPortalPage /></ProtectedLedgerRoute>} />
            <Route path="/portal/onboarding-checklist" element={<ProtectedLedgerRoute><CustomerOnboardingChecklistPage /></ProtectedLedgerRoute>} />
            <Route path="/credit" element={<LoansPage />} />
            <Route path="/credit/eligibility" element={<CreditEligibilityPage />} />
            <Route path="/credit/results" element={<CreditEligibilityPage />} />
            <Route path="/credit/apply" element={<CreditApplicationPage />} />
            <Route path="/credit/status" element={<CreditStatusPage />} />
            <Route path="/credit/application/status" element={<CreditStatusPage />} />
            <Route path="/solutions/loans" element={<LoansPage />} />
            <Route path="/solutions/:type" element={<HomePage />} />
            <Route path="/industries/:type" element={<IndustryPages />} />
            <Route path="/resources/calendar" element={<ComplianceCalendarPage />} />
            <Route path="/resources/calculators" element={<CalculatorsPage />} />
            <Route path="/resources/gst-guides" element={<GSTGuidesPage />} />
            <Route path="/resources/business-guides" element={<BusinessGuidesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />

            {/* Legal Hub */}
            <Route path="/legal" element={<LegalPages />} />
            <Route path="/legal/:doc" element={<LegalPages />} />

            {/* IndexPilot Public Marketing Routes */}
            <Route path="/indexpilot" element={<MarketingHomePage />} />
            <Route path="/indexpilot/how-it-works" element={<MarketingHomePage />} />
            <Route path="/indexpilot/kepwe-iq" element={<KepweIQPage />} />
            <Route path="/indexpilot/tools/risk-calculator" element={<RiskCalculatorPage />} />
            <Route path="/indexpilot/features" element={<MarketingHomePage />} />
            <Route path="/indexpilot/strategies" element={<MarketingHomePage />} />
            <Route path="/indexpilot/pricing" element={<MarketingHomePage />} />
            <Route path="/indexpilot/learn" element={<MarketingHomePage />} />
            <Route path="/indexpilot/about" element={<MarketingHomePage />} />
            <Route path="/indexpilot/faq" element={<MarketingHomePage />} />
            <Route path="/indexpilot/contact" element={<MarketingHomePage />} />

            {/* Alias PDF routes to existing pages */}
            <Route path="/how-it-works" element={<Navigate to="/indexpilot/how-it-works" replace />} />
            <Route path="/kepwe-iq" element={<Navigate to="/indexpilot/kepwe-iq" replace />} />
            <Route path="/tools/risk-calculator" element={<Navigate to="/indexpilot/tools/risk-calculator" replace />} />

            {/* Account — Profile & Settings */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* 404 Fallback */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;
