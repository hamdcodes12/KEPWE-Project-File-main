import React, { useState } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getSafeReturnPath } from '../lib/auth-redirect';
import { Mail, Lock, Eye, EyeOff, Check, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import kepweLogo from '../assets/kepwe-logo.png';
import './LoginPage.css';

export const PRODUCT_CONFIG = {
  ledger: {
    title: 'Kepwe Ledger Login',
    brand: 'Kepwe Ledger',
    sub: 'LEDGER WORKSPACE',
    tagline: 'Precision double-entry accounting, real-time GST reconciliation, and financial audit trails.',
    defaultPath: '/ledger/app',
    loginPath: '/ledger/login',
    signupPath: '/ledger/signup',
    productKey: 'ledger',
  },
  crm: {
    title: 'Sales CRM Login',
    brand: 'Sales CRM',
    sub: 'SALES & PIPELINE ACCELERATOR',
    tagline: 'Intelligent lead management, automated follow-ups, and unified deal tracking.',
    defaultPath: '/crm',
    loginPath: '/crm/login',
    signupPath: '/crm/signup',
    productKey: 'crm',
  },
  indexpilot: {
    title: 'IndexPilot Login',
    brand: 'IndexPilot',
    sub: 'INTELLIGENT TRADING TERMINAL',
    tagline: 'Real-time algorithm execution, portfolio analytics, and automated market strategies.',
    defaultPath: '/app/dashboard',
    loginPath: '/indexpilot/login',
    signupPath: '/indexpilot/signup',
    productKey: 'indexpilot',
  },
  'customer-portal': {
    title: 'Customer Portal Login',
    brand: 'Customer Portal',
    sub: 'CLIENT SELF-SERVICE WORKSPACE',
    tagline: 'Secure access to billing, active subscriptions, statements, and priority support.',
    defaultPath: '/customer-portal',
    loginPath: '/customer-portal/login',
    signupPath: '/customer-portal/signup',
    productKey: 'customer-portal',
  },
  portal: {
    title: 'Customer Portal Login',
    brand: 'Customer Portal',
    sub: 'CLIENT SELF-SERVICE WORKSPACE',
    tagline: 'Secure access to billing, active subscriptions, statements, and priority support.',
    defaultPath: '/customer-portal',
    loginPath: '/customer-portal/login',
    signupPath: '/customer-portal/signup',
    productKey: 'customer-portal',
  },
  credit: {
    title: 'Kepwe Credit Login',
    brand: 'Kepwe Credit',
    sub: 'WORKING CAPITAL & CREDIT ENGINE',
    tagline: 'Fast business credit lines, automated underwriting, and flexible repayment terms.',
    defaultPath: '/credit',
    loginPath: '/credit/login',
    signupPath: '/credit/signup',
    productKey: 'credit',
  },
  quant: {
    title: 'Kepwe Quant Login',
    brand: 'Kepwe Quant',
    sub: 'QUANTITATIVE RESEARCH WORKSPACE',
    tagline: 'Institutional-grade quantitative models, backtesting engines, and risk management.',
    defaultPath: '/quant/dashboard',
    loginPath: '/quant/login',
    signupPath: '/quant/signup',
    productKey: 'quant',
  },
};

const LoginPage = ({ product: propProduct }) => {
  const { requestEmailOtp, verifyEmailOtp } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Detect product from props, pathname, or query param
  const pathParts = location.pathname.toLowerCase().split('/').filter(Boolean);
  let pathProduct = '';
  if (pathParts[0] === 'ledger') pathProduct = 'ledger';
  else if (pathParts[0] === 'crm' || pathParts[0] === 'sales-crm') pathProduct = 'crm';
  else if (pathParts[0] === 'indexpilot') pathProduct = 'indexpilot';
  else if (pathParts[0] === 'customer-portal' || pathParts[0] === 'portal') pathProduct = 'customer-portal';
  else if (pathParts[0] === 'credit') pathProduct = 'credit';
  else if (pathParts[0] === 'quant') pathProduct = 'quant';

  const queryProduct = (searchParams.get('product') || '').trim().toLowerCase();
  const detectedProduct = (propProduct || pathProduct || queryProduct || '').trim().toLowerCase();
  const canonicalProduct = detectedProduct === 'portal' ? 'customer-portal' : detectedProduct;
  const productConfig = PRODUCT_CONFIG[canonicalProduct] || null;
  const activeProductKey = productConfig ? productConfig.productKey : null;

  const selectedPlan = searchParams.get('plan')?.trim() || '';
  const preservedAuthQuery = location.search || '';
  const defaultDest = productConfig ? productConfig.defaultPath : '/';
  const redirectPath = getSafeReturnPath(searchParams.get('returnTo'), defaultDest);

  const [form, setForm] = useState({ identifier: '', otp: '', otpEmail: '', rememberMe: false });
  const [otpStep, setOtpStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  React.useEffect(() => {
    if (!resendIn) return undefined;
    const timer = window.setInterval(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const validate = () => {
    const e = {};
    if (!form.identifier.trim()) e.identifier = 'Enter your email or mobile number.';
    if (!/^\S+@\S+\.\S+$/.test(form.identifier.trim()) && !/^\+?[0-9\s-]{10,15}$/.test(form.identifier.trim())) {
      e.identifier = 'Enter a valid email address or mobile number.';
    }
    if (otpStep && !/^\d{6}$/.test(form.otp)) e.otp = 'Enter the 6-digit verification code.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setIsLoading(true);
    try {
      const result = otpStep
        ? await verifyEmailOtp({
            email: form.otpEmail || form.identifier,
            purpose: 'login',
            challengeId: form.challengeId,
            otp: form.otp,
            rememberMe: form.rememberMe,
            product: activeProductKey,
          })
        : await requestEmailOtp({
            email: form.identifier,
            purpose: 'login',
            product: activeProductKey,
          });
      if (result.success) {
        if (!otpStep) {
              setForm((current) => ({ ...current, otp: '', otpEmail: result.email || current.identifier, challengeId: result.challengeId }));
          setResendIn(result.resendAvailableInSeconds || 30);
          setOtpStep(true);
          setIsLoading(false);
          return;
        }
        if (canonicalProduct === 'business' && selectedPlan) {
          navigate(`/pricing?product=business&checkout=${encodeURIComponent(selectedPlan)}`, { replace: true });
          return;
        }
        setLoginSuccess(true);
        setTimeout(() => navigate(redirectPath, { replace: true }), 800);
      } else {
        setErrors({
          form: result.error || 'Unable to send or verify the email code.',
          code: result.code,
          needsSignup: result.needsSignup,
        });
      }
    } catch (err) {
      setErrors({ form: 'Unable to reach server. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!otpStep || isLoading || resendIn > 0) return;
    setErrors({});
    setIsLoading(true);
    try {
      const result = await requestEmailOtp({
        email: form.otpEmail || form.identifier,
        purpose: 'login',
        product: activeProductKey,
      });
      if (result.success) {
        setForm((current) => ({ ...current, otp: '', otpEmail: result.email || current.otpEmail, challengeId: result.challengeId }));
        setResendIn(result.resendAvailableInSeconds || 30);
      } else {
        setResendIn(result.retryAfterSeconds || 0);
        setErrors({ form: result.error || 'Unable to resend the email code.' });
      }
    } catch {
      setErrors({ form: 'Unable to reach server. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="fintech-login-root">
      {/* Subtle Background Ambient Glows */}
      <div className="fintech-bg-glow-1"></div>
      <div className="fintech-bg-glow-2"></div>

      {/* Floating Particles & Accents */}
      <div className="fintech-particle fintech-particle-1"></div>
      <div className="fintech-particle fintech-particle-2"></div>
      <div className="fintech-particle fintech-particle-3"></div>
      <div className="fintech-ring-accent fintech-ring-1"></div>
      <div className="fintech-ring-accent fintech-ring-2"></div>

      {/* Financial Market Graphics Background (Left & Right) */}
      <svg className="fintech-bg-chart-left" viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 160 Q 60 120, 120 140 T 240 80 T 320 40" stroke="#214ECF" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
        <path d="M0 180 Q 80 140, 160 160 T 320 90" stroke="#3B82F6" strokeWidth="1" opacity="0.6" fill="none" />
        <circle cx="120" cy="140" r="3" fill="#214ECF" />
        <circle cx="240" cy="80" r="3" fill="#3B82F6" />
      </svg>
      <svg className="fintech-bg-chart-right" viewBox="0 0 340 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 180 Q 90 130, 170 110 T 340 30" stroke="#214ECF" strokeWidth="1.5" fill="none" />
        <path d="M0 140 Q 100 160, 200 90 T 340 70" stroke="#3B82F6" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" fill="none" />
        <circle cx="170" cy="110" r="3" fill="#214ECF" />
        <circle cx="340" cy="30" r="4" fill="#214ECF" />
      </svg>

      <div className="fintech-login-container">
        {/* Brand Header */}
        <div className="fintech-brand-header">
          <Link to="/" className="fintech-logo-icon-brand" aria-label="KEPWE Home">
            <img src={kepweLogo} alt="Kepwe Logo" className="kepwe-login-brand-logo" />
          </Link>

          <div className="fintech-brand-title-wrap">
            <span className="fintech-brand-title-kepwe">
              {productConfig ? productConfig.title : 'Kepwe'}
            </span>
          </div>

          <div className="fintech-brand-sub">
            {productConfig ? productConfig.sub : 'BUSINESS PLATFORM'}
          </div>

          <p className="fintech-brand-tagline">
            {productConfig ? productConfig.tagline : 'Everything your business needs — accounting, compliance, and capital.'}
          </p>
        </div>

        {/* Login Card (Clean White Theme) */}
        <div className="fintech-login-card">
          <div className="fintech-card-header">
            <div className="fintech-card-user-icon">
              <User size={22} strokeWidth={2.2} />
            </div>
            <h2 className="fintech-card-heading">
              {loginSuccess ? 'Signed in successfully' : 'Sign in to your account'}
            </h2>
            <p className="fintech-card-subheading">
              {loginSuccess ? 'Preparing your terminal...' : 'Welcome back! Please enter your details.'}
            </p>
          </div>

          {loginSuccess ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle2 size={52} color="#214ECF" style={{ margin: '0 auto' }} />
              <p style={{ color: '#214ECF', fontWeight: 700, marginTop: '14px', fontSize: '1.05rem' }}>
                Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {errors.form && (
                <div className="fintech-error-msg" style={{ marginBottom: '16px', background: 'rgba(239,68,68,0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div>{errors.form}</div>
                      {productConfig && (
                        <div style={{ marginTop: '8px' }}>
                          <Link to={productConfig.signupPath} className="fintech-signup-link" style={{ fontWeight: 700 }}>
                            Create {productConfig.brand} Account Now →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Email or Mobile Field */}
              <div className="fintech-form-group">
                <div className="fintech-label-row">
                  <label htmlFor="login-identifier" className="fintech-label">
                    Email or Mobile Number
                  </label>
                </div>
                <div className="fintech-input-wrapper">
                  <span className="fintech-input-icon-left">
                    <Mail size={18} />
                  </span>
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="username"
                    value={form.identifier}
                    onChange={(e) => setForm((p) => ({ ...p, identifier: e.target.value }))}
                    placeholder="naviXXXX@gmail.com or 933477XXXX"
                    className={`fintech-input ${errors.identifier ? 'fintech-input-error' : ''}`}
                  />
                </div>
                {errors.identifier && (
                  <div className="fintech-error-msg">
                    <AlertCircle size={13} /> {errors.identifier}
                  </div>
                )}
              </div>

              {otpStep && <div className="fintech-form-group">
                <div className="fintech-label-row">
                  <label htmlFor="login-otp" className="fintech-label">
                    Email verification code
                  </label>
                </div>
                <div className="fintech-input-wrapper">
                  <span className="fintech-input-icon-left">
                    <Mail size={18} />
                  </span>
                  <input
                    id="login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={form.otp}
                    onChange={(e) => setForm((p) => ({ ...p, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="Enter 6-digit code"
                    className={`fintech-input ${errors.otp ? 'fintech-input-error' : ''}`}
                  />
                </div>
                {errors.otp && (
                  <div className="fintech-error-msg">
                    <AlertCircle size={13} /> {errors.otp}
                  </div>
                )}
                <p className="fintech-card-subheading" style={{ marginTop: '8px' }}>We sent a code to your email. It expires in 10 minutes.</p>
                <button type="button" onClick={handleResend} disabled={isLoading || resendIn > 0} className="fintech-signup-link" style={{ marginTop: '8px', background: 'none', border: 0, padding: 0, cursor: resendIn > 0 ? 'default' : 'pointer' }}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </button>
              </div>}

              {/* Custom Remember Me Checkbox */}
              <div
                className="fintech-checkbox-row"
                onClick={() => setForm((p) => ({ ...p, rememberMe: !p.rememberMe }))}
              >
                <div className={`fintech-custom-checkbox ${form.rememberMe ? 'checked' : ''}`}>
                  {form.rememberMe && <Check size={13} color="#FFFFFF" strokeWidth={3.5} />}
                </div>
                <span className="fintech-checkbox-label">Remember me for 30 days</span>
              </div>

              {/* Submit CTA Button */}
              <button type="submit" disabled={isLoading} className="fintech-submit-btn">
                {isLoading ? (
                  'Signing in...'
                ) : (
                  <>
                    {otpStep ? 'Verify and sign in' : 'Email me a sign-in code'} <span style={{ fontSize: '1.1rem', marginLeft: '2px' }}>→</span>
                  </>
                )}
              </button>

              {/* Sign Up Link */}
              <div className="fintech-signup-prompt">
                {productConfig ? (
                  <>
                    Don't have a {productConfig.brand} account?{' '}
                    <Link to={productConfig.signupPath} className="fintech-signup-link">
                      Create one
                    </Link>
                  </>
                ) : (
                  <>
                    Don't have an account?{' '}
                    <Link to={`/signup${preservedAuthQuery}`} className="fintech-signup-link">
                      Sign up free
                    </Link>
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="fintech-divider">
                <div className="fintech-divider-line"></div>
                <div className="fintech-divider-text">OR</div>
                <div className="fintech-divider-line"></div>
              </div>

              {/* Back Link */}
              <div className="fintech-back-wrapper">
                <Link to="/" className="fintech-back-link">
                  ← Back to Kepwe Home
                </Link>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
