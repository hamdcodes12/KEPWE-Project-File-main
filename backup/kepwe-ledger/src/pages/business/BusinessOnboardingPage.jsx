import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, ArrowRight, Building2, Clock, BarChart3, Layers, TrendingUp } from 'lucide-react';

const steps = [
  { id: 1, title: 'Business Type', subtitle: 'What structure is your business registered as?' },
  { id: 2, title: 'Business Age', subtitle: 'How long has your business been operating?' },
  { id: 3, title: 'Monthly Turnover', subtitle: 'What is your approximate monthly revenue?' },
  { id: 4, title: 'What Do You Need?', subtitle: 'Select all services you need help with.' },
  { id: 5, title: 'Your Recommended Plan', subtitle: 'Based on your inputs, here is the best fit.' },
];

const BusinessOnboardingPage = () => {
  const navigate = useNavigate();
  const { submitBusinessOnboarding, authState } = useApp();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({
    businessType: '',
    businessAge: '',
    turnover: '',
    needs: [],
  });
  const [recommended, setRecommended] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setField = (field, value) => setAnswers((p) => ({ ...p, [field]: value }));
  const toggleNeed = (need) => {
    setAnswers((p) => ({
      ...p,
      needs: p.needs.includes(need) ? p.needs.filter((n) => n !== need) : [...p.needs, need],
    }));
  };

  const handleSeePlan = async () => {
    if (!authState.isLoggedIn) {
      setError('Please sign in to save your onboarding plan and see your recommendation.');
      return;
    }
    setSubmitting(true);
    setError('');
    const result = await submitBusinessOnboarding({
      businessType: answers.businessType,
      businessAge: answers.businessAge,
      turnover: answers.turnover,
      needs: answers.needs,
    });
    setSubmitting(false);
    if (result.success) {
      setRecommended(result.recommendedPlan);
      setStep(5);
    } else {
      setError(result.error || 'Could not save your onboarding answers.');
    }
  };

  const chipStyle = (selected) => ({
    padding: '13px 20px',
    borderRadius: '10px',
    border: selected ? '2px solid #214ECF' : '1px solid #CBD5E1',
    background: selected ? '#EEF2FF' : '#FFFFFF',
    color: selected ? '#214ECF' : '#334155',
    fontWeight: selected ? 800 : 600,
    fontSize: '0.92rem',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.18s',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        {/* Progress */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {steps.map((s) => (
              <div key={s.id} style={{ flex: 1, height: '4px', borderRadius: '2px', background: s.id <= step ? '#214ECF' : '#E2E8F0', transition: 'all 0.3s' }} />
            ))}
          </div>
          <span style={{ color: '#64748B', fontSize: '0.82rem' }}>Step {step} of {steps.length}</span>
        </div>

        {/* Card */}
        <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '36px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)' }}>
          {/* Kepwe brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#214ECF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 900, fontSize: '1.1rem' }}>K</div>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0F172A' }}>Kepwe Business Onboarding</span>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>{steps[step - 1].title}</h2>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '28px' }}>{steps[step - 1].subtitle}</p>

          {/* STEP 1 — Business Type */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Private Limited', 'LLP', 'Partnership', 'Proprietorship', 'Other'].map((bt) => (
                <button key={bt} style={chipStyle(answers.businessType === bt)} onClick={() => setField('businessType', bt)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Building2 size={18} color={answers.businessType === bt ? '#214ECF' : '#94A3B8'} />
                    {bt}
                    {answers.businessType === bt && <CheckCircle2 size={18} color="#214ECF" style={{ marginLeft: 'auto' }} />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* STEP 2 — Business Age */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['< 3 months', '3–12 months', '1–3 years', '3+ years'].map((age) => (
                <button key={age} style={chipStyle(answers.businessAge === age)} onClick={() => setField('businessAge', age)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Clock size={18} color={answers.businessAge === age ? '#214ECF' : '#94A3B8'} />
                    {age}
                    {answers.businessAge === age && <CheckCircle2 size={18} color="#214ECF" style={{ marginLeft: 'auto' }} />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* STEP 3 — Monthly Turnover */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Pre-revenue', '< ₹5L', '₹5–25L', '₹25–50L', '₹50L+'].map((t) => (
                <button key={t} style={chipStyle(answers.turnover === t)} onClick={() => setField('turnover', t)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <BarChart3 size={18} color={answers.turnover === t ? '#214ECF' : '#94A3B8'} />
                    {t}
                    {answers.turnover === t && <CheckCircle2 size={18} color="#214ECF" style={{ marginLeft: 'auto' }} />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* STEP 4 — Needs (multi-select) */}
          {step === 4 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {['GST & Tax', 'Accounting', 'Payroll & HR', 'MCA Compliance', 'Virtual CFO', 'Business Finance', 'Company Registration', 'Insurance', 'Other'].map((need) => (
                <button
                  key={need}
                  onClick={() => toggleNeed(need)}
                  style={{
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: answers.needs.includes(need) ? '2px solid #214ECF' : '1px solid #CBD5E1',
                    background: answers.needs.includes(need) ? '#EEF2FF' : '#FFFFFF',
                    color: answers.needs.includes(need) ? '#214ECF' : '#334155',
                    fontWeight: answers.needs.includes(need) ? 800 : 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {answers.needs.includes(need) ? <CheckCircle2 size={15} color="#214ECF" /> : <Layers size={15} color="#94A3B8" />}
                  {need}
                </button>
              ))}
            </div>
          )}

          {/* STEP 5 — Recommended Package */}
          {step === 5 && recommended && (
            <div>
              <div style={{ textAlign: 'center', padding: '12px 0 24px' }}>
                <p style={{ color: '#64748B', fontSize: '0.92rem', marginBottom: '20px' }}>
                  Based on your inputs ({answers.businessType}, {answers.turnover}), we recommend:
                </p>
                <div style={{ background: '#EEF2FF', border: '2px solid #214ECF', borderRadius: '16px', padding: '28px', marginBottom: '24px' }}>
                  <span style={{ background: '#214ECF', color: '#FFF', fontSize: '0.7rem', fontWeight: 800, padding: '3px 10px', borderRadius: '4px', letterSpacing: '0.08em' }}>RECOMMENDED</span>
                  <h3 style={{ fontSize: '2rem', fontWeight: 900, color: '#214ECF', margin: '12px 0 4px' }}>{recommended.name}</h3>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0F172A' }}>₹{recommended.price.toLocaleString('en-IN')}<span style={{ fontSize: '1rem', fontWeight: 600, color: '#64748B' }}>/month</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px', textAlign: 'left' }}>
                    {answers.needs.slice(0, 4).map((n) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#334155' }}>
                        <CheckCircle2 size={16} color="#214ECF" /> {n}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/portal')}
                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', background: '#214ECF', color: '#FFF', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Start {recommended.name} — ₹{recommended.price.toLocaleString('en-IN')}/mo <ArrowRight size={18} />
              </button>
              <button onClick={() => navigate('/pricing')} style={{ width: '100%', marginTop: '10px', padding: '13px', borderRadius: '10px', border: '1px solid #CBD5E1', background: 'transparent', color: '#214ECF', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
                Compare all plans
              </button>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 5 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
              {step > 1 ? (
                <button onClick={() => setStep(s => s - 1)} style={{ padding: '11px 22px', borderRadius: '8px', border: '1px solid #CBD5E1', background: 'transparent', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
                  ← Back
                </button>
              ) : <div />}
              <button
                onClick={() => {
                  if (step === 4) {
                    handleSeePlan();
                    return;
                  }
                  const canProceed = (step === 1 && answers.businessType) || (step === 2 && answers.businessAge) || (step === 3 && answers.turnover);
                  if (canProceed) setStep(s => s + 1);
                }}
                style={{
                  padding: '11px 26px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#214ECF',
                  color: '#FFF',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {step === 4 ? 'See My Plan' : 'Continue'} <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem', marginTop: '20px' }}>
          Your data is confidential and used only to recommend the right plan.
        </p>
      </div>
    </div>
  );
};

export default BusinessOnboardingPage;
