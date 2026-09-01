import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Shield, TrendingUp, CheckCircle2, ArrowRight } from 'lucide-react';
import indexLogo from '../../assets/IndexMainLogo.png';

const AppOnboardingPage = () => {
  const { updateRiskProfile } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [onboardingData, setOnboardingData] = useState({
    experience: 'Intermediate',
    capitalRange: '₹1L–5L',
    capitalAmount: 150000,
    maxAcceptableLoss: 2500,
    indices: ['NIFTY', 'BANKNIFTY']
  });

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      // Save risk profile and route to /app/dashboard
      updateRiskProfile({
        ...onboardingData,
        riskCategory: onboardingData.maxAcceptableLoss > 5000 ? 'Aggressive' : onboardingData.maxAcceptableLoss >= 2500 ? 'Balanced' : 'Conservative',
        onboardingComplete: true
      });
      navigate('/app/dashboard');
    }
  };

  const getStepCategory = () => {
    switch (step) {
      case 1: return 'WELCOME';
      case 2: return 'EXPERIENCE';
      case 3: return 'CAPITAL RANGE';
      case 4: return 'MAX LOSS LIMIT';
      case 5: return 'INDICES';
      default: return '';
    }
  };

  return (
    <div className="onboarding-page-bg">
      <div className="onboarding-main-card">
        {/* Step Indicator & Progress Bar */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748B', fontWeight: 800, letterSpacing: '0.08em' }}>
            <span>STEP {step} OF 5</span>
            <span style={{ color: '#214ECF' }}>{getStepCategory()}</span>
          </div>
          <div className="onboarding-progress-bar">
            <div className="onboarding-progress-fill" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
        </div>

        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div className="onboarding-logo-wrap">
              <img
                src={indexLogo}
                alt="IndexPilot Logo"
                className="onboarding-logo-img"
              />
            </div>
            <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: '12px', lineHeight: 1.25 }}>
              Know the Index. Know the Risk.
            </h1>
            <p style={{ color: '#475569', fontSize: '0.98rem', lineHeight: '1.6', marginBottom: '32px' }}>
              IndexPilot does not promise returns. It calibrates to your risk profile and tells you when there is — and isn't — a trade.
            </p>
            <button onClick={handleNext} className="onboarding-cta-btn">
              <span>Continue</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 2: EXPERIENCE LEVEL */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: '8px', lineHeight: 1.25 }}>
              What is your trading experience?
            </h2>
            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '28px' }}>
              This tailors the explanation depth on your dashboard.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {['New', 'Intermediate', 'Experienced'].map((exp) => {
                const isSelected = onboardingData.experience === exp;
                return (
                  <button
                    key={exp}
                    onClick={() => setOnboardingData({ ...onboardingData, experience: exp })}
                    className={`onboarding-option-card ${isSelected ? 'selected' : ''}`}
                  >
                    <span>{exp}</span>
                    {isSelected && <CheckCircle2 size={20} color="#214ECF" />}
                  </button>
                );
              })}
            </div>
            <button onClick={handleNext} className="onboarding-cta-btn">
              <span>Next Step</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 3: CAPITAL RANGE */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: '8px', lineHeight: 1.25 }}>
              Select your trading capital range
            </h2>
            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '28px' }}>
              We never request exact bank or broker balances.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
              {[
                { range: '<₹25k', amt: 20000 },
                { range: '₹25k–1L', amt: 50000 },
                { range: '₹1L–5L', amt: 150000 },
                { range: '₹5L+', amt: 500000 }
              ].map((c) => {
                const isSelected = onboardingData.capitalRange === c.range;
                return (
                  <button
                    key={c.range}
                    onClick={() => setOnboardingData({ ...onboardingData, capitalRange: c.range, capitalAmount: c.amt })}
                    className={`onboarding-option-card ${isSelected ? 'selected' : ''}`}
                    style={{ justifyContent: 'center', textAlign: 'center' }}
                  >
                    <span style={{ fontSize: '1.05rem' }}>{c.range}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={handleNext} className="onboarding-cta-btn">
              <span>Next Step</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 4: MAX ACCEPTABLE LOSS */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: '8px', lineHeight: 1.25 }}>
              Maximum acceptable loss per trade
            </h2>
            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '28px' }}>
              IndexPilot hides any strategy whose max loss exceeds this limit.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
              {[500, 1000, 2500, 5000, 10000].map((amt) => {
                const isSelected = onboardingData.maxAcceptableLoss === amt;
                return (
                  <button
                    key={amt}
                    onClick={() => setOnboardingData({ ...onboardingData, maxAcceptableLoss: amt })}
                    className={`onboarding-option-card ${isSelected ? 'selected' : ''} font-mono`}
                    style={{ justifyContent: 'center', textAlign: 'center', fontSize: '1.1rem' }}
                  >
                    <span>₹{amt.toLocaleString('en-IN')}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={handleNext} className="onboarding-cta-btn">
              <span>Next Step</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 5: INDICES OF INTEREST */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: '8px', lineHeight: 1.25 }}>
              Indices of interest
            </h2>
            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '28px' }}>
              Select indices to feature on your daily pulse dashboard.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {['NIFTY 50', 'BANK NIFTY', 'FINNIFTY'].map((idx) => (
                <div key={idx} className="onboarding-option-card selected" style={{ cursor: 'default' }}>
                  <span style={{ fontWeight: 800, color: '#0F172A' }}>{idx}</span>
                  <CheckCircle2 size={20} color="#214ECF" />
                </div>
              ))}
            </div>
            <button onClick={handleNext} className="onboarding-cta-btn">
              <span>Complete Setup & Enter Pulse</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppOnboardingPage;

