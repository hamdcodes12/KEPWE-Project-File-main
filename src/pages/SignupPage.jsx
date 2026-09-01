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
  const { signup } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const selectedPlan = searchParams.get('plan')?.trim() || '';
  const selectedProduct = (searchParams.get('product') || '').trim().toLowerCase();
  const preservedAuthQuery = location.search || '';
  const redirectPath = getSafeReturnPath(searchParams.get('returnTo'), '/onboarding');

  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', confirmPassword: '', termsAccepted: false });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Enter your full name (min 2 characters).';
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address.';
    if (!/^\+?[0-9\s-]{10,15}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid 10–15 digit mobile number.';
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
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
      // Await the real backend signup result (POST /api/auth/register)
      const result = await signup(form.name.trim(), form.email, form.password, form.mobile.trim() || null);
      if (result.success) {
        if (selectedProduct === 'business' && selectedPlan) {
          navigate(`/pricing?product=business&checkout=${encodeURIComponent(selectedPlan)}`, { replace: true });
          return;
        }
        setSuccess(true);
        setTimeout(() => navigate(redirectPath, { replace: true }), 900);
      } else {
        setErrors({ form: result.error || 'Registration failed. Please try again.' });
      }
    } catch (err) {
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

              {/* Password */}
              <div className="signup-form-group">
                <label htmlFor="signup-password" className="signup-label">Password</label>
                <div className="signup-input-wrap">
                  <span className="signup-input-icon-left">
                    <Lock size={18} strokeWidth={2} />
                  </span>
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min 8 characters"
                    className={`signup-input has-right-icon ${errors.password ? 'input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="signup-input-icon-right"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <div className="signup-error-msg">
                    <AlertCircle size={12} /> {errors.password}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="signup-form-group">
                <label htmlFor="signup-confirm" className="signup-label">Confirm Password</label>
                <div className="signup-input-wrap">
                  <span className="signup-input-icon-left">
                    <ShieldCheck size={18} strokeWidth={2} />
                  </span>
                  <input
                    id="signup-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="Repeat your password"
                    className={`signup-input has-right-icon ${errors.confirmPassword ? 'input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(p => !p)}
                    className="signup-input-icon-right"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <div className="signup-error-msg">
                    <AlertCircle size={12} /> {errors.confirmPassword}
                  </div>
                )}
              </div>

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
                <span>{isLoading ? 'Creating account...' : 'Create Account & Continue'}</span>
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
