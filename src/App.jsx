import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, Navigate, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import CustomCursor from './components/common/CustomCursor';
import Announcements from './components/common/Announcements';
import NativeChatbot from './components/common/NativeChatbot';

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
import CreditHealthPage from './pages/credit/CreditHealthPage';
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
  AdminQuantSubscriptionsPage,
} from './pages/admin/AdminOperationsPages';

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

// ─── Main Layout (Business Marketing) ───────────────────────────
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

const ProtectedRoute = ({ children, product = null, productName = 'This workspace' }) => {
  const { authState, hasProductAccess } = useApp();
  const location = useLocation();

  if (authState.isLoading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Checking your KEPWE session...</div>;
  }

  if (!authState.isLoggedIn) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (product && !hasProductAccess(product)) {
    return <ProductAccessRequired product={product} productName={productName} />;
  }

  return children;
};

const ProtectedAlgoRoute = () => <ProtectedRoute product="indexpilot" productName="KEPWE Quant"><AlgoDashboardPage /></ProtectedRoute>;

function QuantAuthRedirect({ signup = false }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('product', 'quant');
  if (!params.get('returnTo')) params.set('returnTo', '/quant/dashboard');
  return <Navigate to={`${signup ? '/signup' : '/login'}?${params.toString()}`} replace />;
}

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
            to="/signup"
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
            Create Account
          </Link>

          <Link
            to="/login"
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

const ProtectedCustomerPortalRoute = ({ children }) => <ProtectedRoute product="customer-portal" productName="Customer Portal">{children}</ProtectedRoute>;
const ProtectedLedgerRoute = ({ children }) => <ProtectedRoute product="ledger" productName="Kepwe Ledger">{children}</ProtectedRoute>;
const ProtectedCrmRoute = ({ children }) => <ProtectedRoute product="crm" productName="Sales CRM">{children}</ProtectedRoute>;
const ProtectedQuantRoute = () => <ProtectedRoute product="quant" productName="Kepwe Quant"><QuantDashboardPage /></ProtectedRoute>;
const ProtectedCreditRoute = ({ children }) => <ProtectedRoute product="credit" productName="Kepwe Credit">{children}</ProtectedRoute>;

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <AppProvider>
      <CustomCursor />
      <Announcements />
      <Router>
        <ScrollToTop />
        <NativeChatbot />
        <Routes>
          {/* ── Clean Routes (no header/footer) ──────────────── */}
          <Route element={<CleanLayout />}>
            {/* Common / Main KEPWE Login */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Legacy product auth URLs resolve to the single global auth pages. */}
            <Route path="/customer-portal/login" element={<Navigate to="/login" replace />} />
            <Route path="/customer-portal/signup" element={<Navigate to="/signup" replace />} />
            <Route path="/crm/login" element={<Navigate to="/login" replace />} />
            <Route path="/crm/signup" element={<Navigate to="/signup" replace />} />
            <Route path="/ledger/login" element={<Navigate to="/login?product=ledger&returnTo=%2Fledger%2Fapp" replace />} />
            <Route path="/ledger/signup" element={<Navigate to="/signup?product=ledger&returnTo=%2Fledger%2Fapp" replace />} />
            <Route path="/credit/login" element={<Navigate to="/login" replace />} />
            <Route path="/credit/signup" element={<Navigate to="/signup" replace />} />
            <Route path="/quant/login" element={<QuantAuthRedirect />} />
            <Route path="/quant/signup" element={<QuantAuthRedirect signup />} />

            <Route path="/business-onboarding" element={<BusinessOnboardingPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="/admin-login" element={<AdminLoginPage />} />
          </Route>


          {/* ── KEPWE QUANT workspace (Authenticated) ─────────────── */}
          <Route path="/quant/dashboard" element={<ProtectedQuantRoute />} />
          <Route path="/quant/dashboard/:section" element={<ProtectedQuantRoute />} />

          {/* ── KEPWE LEDGER workspace (Authenticated) ─────────────── */}
          <Route path="/ledger/app" element={<ProtectedLedgerRoute><LedgerDashboardPage /></ProtectedLedgerRoute>} />
          <Route path="/ledger/pricing" element={<ProtectedLedgerRoute><LedgerDashboardPage /></ProtectedLedgerRoute>} />
          <Route path="/ledger/workspace" element={<Navigate to="/ledger/app" replace />} />
          <Route path="/ledger-workspace" element={<Navigate to="/ledger/app" replace />} />
          <Route path="/dashboard" element={<Navigate to="/ledger/app" replace />} />
          <Route path="/solutions/accounting" element={<ProtectedLedgerRoute><LedgerDashboardPage /></ProtectedLedgerRoute>} />

          {/* ── Admin Panel Routes (protected) ───────────────── */}
          <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
          <Route path="/admin/users" element={<AdminLayout><AdminUsersPage /></AdminLayout>} />
          <Route path="/admin/subscriptions" element={<AdminLayout><AdminSubscriptionsPage /></AdminLayout>} />
          <Route path="/admin/quant-subscriptions" element={<AdminLayout><AdminQuantSubscriptionsPage /></AdminLayout>} />
          <Route path="/admin/plans" element={<AdminLayout><AdminPlansPage /></AdminLayout>} />
          <Route path="/admin/payments" element={<AdminLayout><AdminPaymentsPage /></AdminLayout>} />
          <Route path="/admin/crm" element={<AdminLayout><AdminCrmPage /></AdminLayout>} />
          <Route path="/admin/website" element={<AdminLayout><AdminWebsitePage /></AdminLayout>} />
          <Route path="/admin/announcements" element={<AdminLayout><AdminAnnouncementsPage /></AdminLayout>} />
          <Route path="/admin/reports" element={<AdminLayout><AdminReportsPage /></AdminLayout>} />
          <Route path="/admin/revenue" element={<AdminLayout><AdminRevenueAnalyticsPage /></AdminLayout>} />
          <Route path="/admin/audit-logs" element={<AdminLayout><AdminAuditLogsPage /></AdminLayout>} />
          <Route path="/admin/notifications" element={<AdminLayout><AdminNotificationsPage /></AdminLayout>} />

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
            <Route path="/credit/health" element={<ProtectedCreditRoute><CreditHealthPage /></ProtectedCreditRoute>} />
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
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/account/profile" element={<Navigate to="/profile" replace />} />
            <Route path="/account/settings" element={<Navigate to="/settings" replace />} />

            {/* Legal Hub */}
            <Route path="/legal" element={<LegalPages />} />
            <Route path="/legal/:doc" element={<LegalPages />} />

            {/* Account — Profile & Settings */}

            {/* 404 Fallback */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;
