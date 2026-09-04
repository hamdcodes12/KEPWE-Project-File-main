import React, { useState } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getSafeReturnPath } from '../lib/auth-redirect';
import { 
  TrendingUp, 
  User, 
  Mail, 
  Phone,
  Lock, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight 
} from 'lucide-react';
import './SignupPage.css';

const SignupPage = () => {
  const { requestEmailOtp, verifyEmailOtp } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const selectedPlan = searchParams.get('plan')?.trim() || '';
  const selectedProduct = (searchParams.get('product') || '').trim().toLowerCase();
  const preservedAuthQuery = location.search || '';
  const redirectPath = getSafeReturnPath(searchParams.get('returnTo'), '/onboarding');

  const [form, setForm] = useState({ name: '', email: '', mobile: '', otp: '', termsAccepted: false, challengeId: '' });
  const [otpStep, setOtpStep] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  React.useEffect(() => {
    if (!resendIn) return undefined;
    const timer = window.setInterval(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Enter your full name (min 2 characters).';
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address.';
    if (!/^\+?[0-9\s-]{10,15}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid 10–15 digit mobile number.';
    if (otpStep && !/^\d{6}$/.test(form.otp)) e.otp = 'Enter the 6-digit verification code.';
    if (!form.termsAccepted) e.terms = 'You must accept the Terms of Use and Privacy Policy.';
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
        ? await verifyEmailOtp({ email: form.email, purpose: 'signup', challengeId: form.challengeId, otp: form.otp })
        : await requestEmailOtp({ email: form.email, purpose: 'signup', name: form.name.trim(), mobile: form.mobile.trim() });
      if (result.success) {
        if (!otpStep) {
          setForm((current) => ({ ...current, otp: '', challengeId: result.challengeId }));
          setResendIn(result.resendAvailableInSeconds || 30);
          setOtpStep(true);
          setIsLoading(false);
          return;
        }
        if (selectedProduct === 'business' && selectedPlan) {
          navigate(`/pricing?product=business&checkout=${encodeURIComponent(selectedPlan)}`, { replace: true });
          return;
        }
        setSuccess(true);
        setTimeout(() => navigate(redirectPath, { replace: true }), 900);
      } else {
        setErrors({ form: result.error || 'Unable to send or verify the email code.' });
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
      const result = await requestEmailOtp({ email: form.email, purpose: 'signup', name: form.name.trim(), mobile: form.mobile.trim() });
      if (result.success) {
        setForm((current) => ({ ...current, otp: '', challengeId: result.challengeId }));
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
    <div className="signup-root">
      <div className="signup-container">
        
        {/* Brand Header */}
        <div className="signup-brand-header">
          <div className="signup-brand-icon">
            <TrendingUp size={24} strokeWidth={2.2} />
          </div>
          <h1 className="signup-brand-title">IndexPilot</h1>
          <p className="signup-brand-sub">BY KEPWE</p>
          <p className="signup-brand-trial">Start your 14-day free trial — no credit card required.</p>
        </div>

        {/* Main Signup Card */}
        <div className="signup-card">
          <h2 className="signup-card-heading">
            {success ? '✓ Account Created!' : 'Create your account'}
          </h2>

          {success && (
            <div className="signup-success-view">
              <CheckCircle2 size={52} color="#214ECF" style={{ margin: '0 auto' }} />
              <p className="signup-success-title">Setting up your risk profile...</p>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} noValidate>
              {errors.form && (
                <div className="signup-error-msg" style={{ marginBottom: '16px', background: 'rgba(239,68,68,0.08)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <AlertCircle size={13} /> {errors.form}
                </div>
              )}

              {/* Full Name */}
              <div className="signup-form-group">
                <label htmlFor="signup-name" className="signup-label">Full Name</label>
                <div className="signup-input-wrap">
                  <span className="signup-input-icon-left">
                    <User size={18} strokeWidth={2} />
                  </span>
                  <input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Your name"
                    className={`signup-input ${errors.name ? 'input-error' : ''}`}
                  />
                </div>
                {errors.name && (
                  <div className="signup-error-msg">
                    <AlertCircle size={12} /> {errors.name}
                  </div>
                )}
              </div>

              {/* Email Address */}
              <div className="signup-form-group">
                <label htmlFor="signup-email" className="signup-label">Email Address</label>
                <div className="signup-input-wrap">
                  <span className="signup-input-icon-left">
                    <Mail size={18} strokeWidth={2} />
                  </span>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="naviXXXX@gmail.com"
                    className={`signup-input ${errors.email ? 'input-error' : ''}`}
                  />
                </div>
                {errors.email && (
                  <div className="signup-error-msg">
                    <AlertCircle size={12} /> {errors.email}
                  </div>
                )}
              </div>

              {/* Mobile Number */}
              <div className="signup-form-group">
                    <label htmlFor="signup-mobile" className="signup-label">Mobile Number</label>
                <div className="signup-input-wrap">
                  <span className="signup-input-icon-left">
                    <Phone size={18} strokeWidth={2} />
                  </span>
                  <input
                    id="signup-mobile"
                    type="tel"
                    autoComplete="tel"
                    value={form.mobile}
                    onChange={(e) => setForm(p => ({ ...p, mobile: e.target.value }))}
                    placeholder="933477XXXX"
                    className="signup-input"
                  />
                </div>
                {errors.mobile && (
                  <div className="signup-error-msg">
                    <AlertCircle size={12} /> {errors.mobile}
                  </div>
                )}
              </div>

              {otpStep && <div className="signup-form-group">
                <label htmlFor="signup-otp" className="signup-label">Email verification code</label>
                <div className="signup-input-wrap">
                  <span className="signup-input-icon-left"><Mail size={18} strokeWidth={2} /></span>
                  <input
                    id="signup-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={form.otp}
                    onChange={(e) => setForm((p) => ({ ...p, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="Enter 6-digit code"
                    className={`signup-input ${errors.otp ? 'input-error' : ''}`}
                  />
                </div>
                {errors.otp && <div className="signup-error-msg"><AlertCircle size={12} /> {errors.otp}</div>}
                <p className="signup-card-subheading" style={{ marginTop: '8px' }}>We sent a code to your email. It expires in 10 minutes.</p>
                <button type="button" onClick={handleResend} disabled={isLoading || resendIn > 0} className="signup-signin-link" style={{ marginTop: '8px', background: 'none', border: 0, padding: 0, cursor: resendIn > 0 ? 'default' : 'pointer' }}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </button>
              </div>}

              {/* Terms Checkbox */}
              <div className="signup-terms-row" onClick={() => setForm(p => ({ ...p, termsAccepted: !p.termsAccepted }))}>
                <div className={`signup-checkbox ${form.termsAccepted ? 'checked' : ''}`}>
                  {form.termsAccepted && <Check size={13} color="#FFFFFF" strokeWidth={3.5} />}
                </div>
                <label htmlFor="terms-accept" className="signup-terms-label" onClick={(e) => e.stopPropagation()}>
                  I agree to the{' '}
                  <Link to="/legal/terms" className="signup-terms-link">Terms of Use</Link>
                  {' '}and{' '}
                  <Link to="/legal/privacy" className="signup-terms-link">Privacy Policy</Link>
                  . I understand IndexPilot is a decision support tool and not SEBI-registered investment advice.
                </label>
              </div>
              {errors.terms && (
                <div className="signup-error-msg" style={{ marginTop: '-14px', marginBottom: '16px' }}>
                  <AlertCircle size={12} /> {errors.terms}
                </div>
              )}

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="signup-submit-btn"
              >
                <span>{isLoading ? (otpStep ? 'Verifying code...' : 'Sending code...') : (otpStep ? 'Verify Email & Create Account' : 'Email me a signup code')}</span>
                {!isLoading && (
                  <span className="btn-arrow-icon">
                    <ArrowRight size={18} strokeWidth={2.2} />
                  </span>
                )}
              </button>

              {/* Bottom Sign-In Link */}
              <div className="signup-signin-prompt">
                Already have an account?{' '}
                <Link to={`/login${preservedAuthQuery}`} className="signup-signin-link">
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};

export default SignupPage;
