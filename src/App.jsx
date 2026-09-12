import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, Navigate, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
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

// ─── Product Access Required Screen ─────────────────────────────────────────
const ProductAccessRequired = ({ product, productName, isDark = false }) => {
  const { authState } = useApp();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: isDark ? 'radial-gradient(ellipse at top, #1E293B 0%, #0F172A 100%)' : 'linear-gradient(145deg, #F8FAFC 0%, #EFF6FF 100%)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: isDark ? '#1E293B' : '#FFFFFF',
        borderRadius: '16px',
        boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '0 20px 40px -15px rgba(33, 78, 207, 0.08), 0 0 1px 1px rgba(0, 0, 0, 0.05)',
        border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
        padding: '36px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          background: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(33, 78, 207, 0.08)',
          color: isDark ? '#60A5FA' : '#214ECF',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 20px',
        }}>
          <ShieldAlert size={28} />
        </div>

        <h2 style={{
          fontSize: '1.4rem',
          fontWeight: 800,
          color: isDark ? '#F8FAFC' : '#0F172A',
          marginBottom: '8px',
          letterSpacing: '-0.02em',
        }}>
          {productName} Access Required
        </h2>

        <p style={{
          fontSize: '0.94rem',
          color: isDark ? '#94A3B8' : '#64748B',
          lineHeight: 1.55,
          marginBottom: '24px',
        }}>
          You are signed in as <strong>{authState.user?.email || 'User'}</strong>, but this account does not have an active membership for the <strong>{productName}</strong> workspace.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            to={`/${product}/signup`}
            style={{
              display: 'block',
              padding: '12px 18px',
              borderRadius: '10px',
              background: '#214ECF',
              color: '#FFFFFF',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.95rem',
            }}
          >
            Create {productName} Account
          </Link>

          <Link
            to={`/${product}/login`}
            style={{
              display: 'block',
              padding: '11px 18px',
              borderRadius: '10px',
              background: isDark ? '#334155' : '#F1F5F9',
              color: isDark ? '#F1F5F9' : '#334155',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            Sign In with a Different Account
          </Link>

          <Link
            to="/"
            style={{
              marginTop: '8px',
              color: isDark ? '#94A3B8' : '#64748B',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ← Return to Kepwe Home
          </Link>
        </div>
      </div>
    </div>
  );
};

const ProtectedCustomerPortalRoute = ({ children }) => {
  const { authState, hasProductAccess } = useApp();
  const location = useLocation();

  if (authState.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8FAFC', color: '#52647E', fontFamily: 'system-ui, sans-serif' }}>
        Checking your Customer Portal session…
      </div>
    );
  }

  if (!authState.isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/customer-portal/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!hasProductAccess('customer-portal')) {
    return <ProductAccessRequired product="customer-portal" productName="Customer Portal" />;
  }

  return children;
};

const ProtectedLedgerRoute = ({ children }) => {
  const { authState, hasProductAccess } = useApp();
  const location = useLocation();

  if (authState.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F7F9FC', color: '#52647E', fontFamily: 'system-ui, sans-serif' }}>
        Checking your Kepwe Ledger session…
      </div>
    );
  }

  if (!authState.isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/ledger/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!hasProductAccess('ledger')) {
    return <ProductAccessRequired product="ledger" productName="Kepwe Ledger" />;
  }

  return children;
};

const ProtectedCrmRoute = ({ children }) => {
  const { authState, hasProductAccess } = useApp();
  const location = useLocation();

  if (authState.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8FAFC', color: '#64748B', fontFamily: 'system-ui, sans-serif' }}>
        Checking your Sales CRM session…
      </div>
    );
  }

  if (!authState.isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/crm/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!hasProductAccess('crm')) {
    return <ProductAccessRequired product="crm" productName="Sales CRM" />;
  }

  return children;
};

const ProtectedAppRoute = ({ children }) => {
  const { authState, hasProductAccess } = useApp();
  const location = useLocation();

  if (authState.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0F172A', color: '#94A3B8', fontFamily: 'system-ui, sans-serif' }}>
        Checking your IndexPilot session…
      </div>
    );
  }

  if (!authState.isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/indexpilot/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!hasProductAccess('indexpilot')) {
    return <ProductAccessRequired product="indexpilot" productName="IndexPilot" isDark={true} />;
  }

  return children;
};

const ProtectedQuantRoute = () => {
  const { authState, hasProductAccess } = useApp();
  const location = useLocation();

  if (authState.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F4F7FB', color: '#52647E', fontFamily: 'system-ui, sans-serif' }}>
        Checking your Kepwe Quant session…
      </div>
    );
  }

  if (!authState.isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/quant/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!hasProductAccess('quant')) {
    return <ProductAccessRequired product="quant" productName="Kepwe Quant" />;
  }

  return <QuantDashboardPage />;
};

const ProtectedCreditRoute = ({ children }) => {
  const { authState, hasProductAccess } = useApp();
  const location = useLocation();

  if (authState.isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8FAFC', color: '#52647E', fontFamily: 'system-ui, sans-serif' }}>
        Checking your Kepwe Credit session…
      </div>
    );
  }

  if (!authState.isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/credit/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!hasProductAccess('credit')) {
    return <ProductAccessRequired product="credit" productName="Kepwe Credit" />;
  }

  return children;
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
            {/* Common / Main KEPWE Login */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Dedicated Product Authentication Entries */}
            <Route path="/customer-portal/login" element={<LoginPage product="customer-portal" />} />
            <Route path="/customer-portal/signup" element={<SignupPage product="customer-portal" />} />

            <Route path="/crm/login" element={<LoginPage product="crm" />} />
            <Route path="/crm/signup" element={<SignupPage product="crm" />} />

            <Route path="/indexpilot/login" element={<LoginPage product="indexpilot" />} />
            <Route path="/indexpilot/signup" element={<SignupPage product="indexpilot" />} />

            <Route path="/ledger/login" element={<LoginPage product="ledger" />} />
            <Route path="/ledger/signup" element={<SignupPage product="ledger" />} />

            <Route path="/credit/login" element={<LoginPage product="credit" />} />
            <Route path="/credit/signup" element={<SignupPage product="credit" />} />

            <Route path="/quant/login" element={<LoginPage product="quant" />} />
            <Route path="/quant/signup" element={<SignupPage product="quant" />} />

            <Route path="/onboarding" element={<AppOnboardingPage />} />
            <Route path="/business-onboarding" element={<BusinessOnboardingPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="/admin-login" element={<AdminLoginPage />} />
          </Route>


          {/* ── IndexPilot Algo protected workspace ─────────────── */}
          <Route path="/indexpilot-algo" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/dashboard" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/strategies" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/backtest" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/trades" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/positions" element={<ProtectedAlgoRoute />} />
          <Route path="/indexpilot-algo/settings" element={<ProtectedAlgoRoute />} />

          {/* ── KEPWE QUANT workspace (Authenticated) ─────────────── */}
          <Route path="/quant/dashboard" element={<ProtectedQuantRoute />} />
          <Route path="/quant/dashboard/:section" element={<ProtectedQuantRoute />} />

          {/* ── KEPWE LEDGER workspace (Authenticated) ─────────────── */}
          <Route path="/ledger/app" element={<ProtectedLedgerRoute><LedgerDashboardPage /></ProtectedLedgerRoute>} />
          <Route path="/ledger/workspace" element={<Navigate to="/ledger/app" replace />} />
          <Route path="/ledger-workspace" element={<Navigate to="/ledger/app" replace />} />
          <Route path="/dashboard" element={<Navigate to="/ledger/app" replace />} />
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
          <Route element={<ProtectedAppRoute><AppLayout /></ProtectedAppRoute>}>
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
            <Route path="/products" element={<HomePage />} />
            <Route path="/crm" element={<ProtectedCrmRoute><SalesCRMPage /></ProtectedCrmRoute>} />
            <Route path="/sales-crm" element={<Navigate to="/crm" replace />} />
            <Route path="/quant" element={<QuantMarketingPage />} />
            <Route path="/ledger" element={<LedgerMarketingPage />} />
            <Route path="/free-compliance-check" element={<FreeComplianceCheckPage />} />
            <Route path="/customer-portal" element={<ProtectedCustomerPortalRoute><CustomerPortalPage /></ProtectedCustomerPortalRoute>} />
            <Route path="/portal" element={<Navigate to="/customer-portal" replace />} />
            <Route path="/portal/customer" element={<Navigate to="/customer-portal" replace />} />
            <Route path="/portal/compliance-portal" element={<Navigate to="/customer-portal" replace />} />
            <Route path="/portal/onboarding-checklist" element={<ProtectedCustomerPortalRoute><CustomerOnboardingChecklistPage /></ProtectedCustomerPortalRoute>} />
            <Route path="/credit" element={<LoansPage />} />
            <Route path="/credit/workspace" element={<ProtectedCreditRoute><CreditStatusPage /></ProtectedCreditRoute>} />
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
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/account/profile" element={<Navigate to="/profile" replace />} />
            <Route path="/account/settings" element={<Navigate to="/settings" replace />} />

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
