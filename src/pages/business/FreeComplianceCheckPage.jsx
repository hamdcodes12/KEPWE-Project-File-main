import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, 
  ShieldCheck, 
  Receipt, 
  Briefcase, 
  Layers, 
  IndianRupee, 
  MapPin, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  ArrowLeft,
  FileCheck,
  User,
  Phone,
  Mail
} from 'lucide-react';
import './FreeComplianceCheckPage.css';

const FreeComplianceCheckPage = () => {
  const { submitComplianceCheck } = useApp();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [complianceResult, setComplianceResult] = useState(null);
  const [step1Submitting, setStep1Submitting] = useState(false);
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [leadCaptureError, setLeadCaptureError] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);
  const formWrapperRef = useRef(null);

  const businessTypeOptions = [
    'Private Limited',
    'LLP',
    'Partnership',
    'Proprietorship'
  ];

  const industryOptions = [
    'Technology / Software',
    'E-commerce',
    'Traders & Wholesale',
    'Manufacturing',
    'Services / Agency'
  ];

  const turnoverOptions = [
    'Pre-revenue',
    '<₹5L',
    '₹5–25L',
    '₹25–50L',
    '₹50L+'
  ];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (formWrapperRef.current && !formWrapperRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form State initialized empty for new assessment
  const [formData, setFormData] = useState({
    companyName: '',
    cin: '',
    gstin: '',
    businessType: '',
    industry: '',
    state: '',
    turnover: '',
    employees: '',
    name: '',
    mobile: '',
    email: ''
  });

  // Step 2 Score Animation State — driven by the real score computed server-
  // side in POST /api/compliance-check, never a fixed constant.
  const actualScore = complianceResult?.overallScore ?? 0;
  const [displayScore, setDisplayScore] = useState(0);
  const animationFrameRef = useRef(null);

  // Calculate completed Step 1 fields out of 7 total fields
  const getStep1FieldsCount = () => {
    const fields = [
      formData.companyName,
      formData.cin,
      formData.gstin,
      formData.businessType,
      formData.industry,
      formData.turnover,
      formData.state
    ];
    return fields.filter(val => val && val.trim() !== '').length;
  };

  const completedCount = getStep1FieldsCount();

  // Segment 1 (Step 1 -> Step 2): 0% to 100% based on 7 fields during Step 1, 100% thereafter
  const segment1Progress = step === 1 
    ? (completedCount / 7) * 100 
    : 100;

  // Segment 2 (Step 2 -> Step 3): 0% until Step 3, 100% on Step 3
  const segment2Progress = step >= 3 
    ? 100 
    : 0;

  // Score Count-Up Animation (Only runs when active step is 2)
  useEffect(() => {
    if (step === 2 && complianceResult) {
      setDisplayScore(0);
      const startTime = performance.now();
      const duration = 2000; // 2 seconds count-up duration

      const animateScore = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Smooth ease-out cubic curve
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentVal = Math.floor(easeOut * actualScore);

        setDisplayScore(currentVal);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animateScore);
        } else {
          setDisplayScore(actualScore);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animateScore);
    } else {
      setDisplayScore(0);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [step, complianceResult, actualScore]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Step 1 Submission — persists the company info + computes the real
  // compliance score server-side, then transitions to Step 2.
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!formData.companyName.trim()) return;

    setStep1Submitting(true);
    const result = await submitComplianceCheck({
      companyName: formData.companyName,
      cin: formData.cin || null,
      gstin: formData.gstin || null,
      businessType: formData.businessType || null,
      industry: formData.industry || null,
      state: formData.state || null,
      turnover: formData.turnover || null,
      employees: formData.employees || null,
    });
    if (result.success) {
      setComplianceResult(result.result);
    }
    setStep1Submitting(false);

    setIsTransitioning(true);
    setTimeout(() => {
      setStep(2);
      setIsTransitioning(false);
    }, 350);
  };

  // Step 2 Submission & Transition to Step 3
  const handleStep2Submit = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(3);
      setIsTransitioning(false);
    }, 350);
  };

  // Back to Step 2 (Compliance Score Dashboard)
  const handleBackToStep2 = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(2);
      setIsTransitioning(false);
    }, 350);
  };

  // Step 3 Lead Capture — persists the final report + contact info and
  // creates a real CRM lead server-side (see POST /api/compliance-check).
  const handleLeadCapture = async (e) => {
    e.preventDefault();
    setFinalSubmitting(true);
    setLeadCaptureError('');

    const result = await submitComplianceCheck({
      companyName: formData.companyName,
      cin: formData.cin || null,
      gstin: formData.gstin || null,
      businessType: formData.businessType || null,
      industry: formData.industry || null,
      state: formData.state || null,
      turnover: formData.turnover || null,
      employees: formData.employees || null,
      name: formData.name,
      mobile: formData.mobile,
      email: formData.email,
    });

    setFinalSubmitting(false);

    if (result.success) {
      setComplianceResult(result.result);
      setSubmitted(true);
    } else {
      setLeadCaptureError(result.error || 'Could not submit your details. Please try again.');
    }
  };

  return (
    <div className="wizard-page-container">
      <div className="wizard-content-wrapper">
        
        {/* STEPPER PROGRESS BAR */}
        <div className="wizard-stepper-container">
          {/* STEP 1 NODE */}
          <div className="wizard-step-item">
            <div className="step-circle-wrapper">
              <div className={`active-flow ${step === 1 ? 'visible' : ''}`}>
                <div className="flow-orbit-container">
                  <span className="flow-particle p1" />
                  <span className="flow-particle p2" />
                  <span className="flow-particle p3" />
                  <span className="flow-particle p4" />
                  <span className="flow-particle p5" />
                </div>
              </div>
              <div className={`wizard-step-circle ${step > 1 || (step === 1 && completedCount === 7) ? 'completed' : 'active'}`}>
                {step > 1 || (step === 1 && completedCount === 7) ? <Check size={18} strokeWidth={2.5} /> : '1'}
              </div>
            </div>
            <span className={`wizard-step-label ${step >= 1 ? 'active' : 'inactive'}`}>
              Business Details
            </span>
          </div>

          {/* SEGMENT 1 TRACK: Step 1 → Step 2 */}
          <div className="wizard-step-segment">
            <div className="wizard-segment-track" />
            <div 
              className="wizard-segment-progress" 
              style={{ width: `${segment1Progress}%` }}
            />
          </div>

          {/* STEP 2 NODE */}
          <div className="wizard-step-item">
            <div className="step-circle-wrapper">
              <div className={`active-flow ${step === 2 ? 'visible' : ''}`}>
                <div className="flow-orbit-container">
                  <span className="flow-particle p1" />
                  <span className="flow-particle p2" />
                  <span className="flow-particle p3" />
                  <span className="flow-particle p4" />
                  <span className="flow-particle p5" />
                </div>
              </div>
              <div className={`wizard-step-circle ${step >= 2 ? (step > 2 ? 'completed' : 'active') : (completedCount === 7 ? 'active' : 'inactive')}`}>
                {step > 2 || (step === 1 && completedCount === 7) ? <Check size={18} strokeWidth={2.5} /> : '2'}
              </div>
            </div>
            <span className={`wizard-step-label ${step >= 2 || completedCount === 7 ? 'active' : 'inactive'}`}>
              Compliance Health
            </span>
          </div>

          {/* SEGMENT 2 TRACK: Step 2 → Step 3 */}
          <div className="wizard-step-segment">
            <div className="wizard-segment-track" />
            <div 
              className="wizard-segment-progress" 
              style={{ width: `${segment2Progress}%` }}
            />
          </div>

          {/* STEP 3 NODE */}
          <div className="wizard-step-item">
            <div className="step-circle-wrapper">
              <div className={`active-flow ${step === 3 ? 'visible' : ''}`}>
                <div className="flow-orbit-container">
                  <span className="flow-particle p1" />
                  <span className="flow-particle p2" />
                  <span className="flow-particle p3" />
                  <span className="flow-particle p4" />
                  <span className="flow-particle p5" />
                </div>
              </div>
              <div className={`wizard-step-circle ${step >= 3 ? 'active' : 'inactive'}`}>
                3
              </div>
            </div>
            <span className={`wizard-step-label ${step >= 3 ? 'active' : 'inactive'}`}>
              Get Full Report
            </span>
          </div>
        </div>

        {/* STEP 1 — BUSINESS INFORMATION */}
        {step === 1 && (
          <div className={`wizard-main-panel ${isTransitioning ? 'wizard-step-exit' : 'wizard-step-enter'}`}>
            <div style={{ textAlign: 'center' }}>
              <span className="wizard-badge">STEP 1 OF 3</span>
              <h1 className="wizard-heading-step1">
                Know what your business needs <span className="highlight-blue" style={{ color: '#214ECF' }}>to comply with.</span>
              </h1>
              <p className="wizard-subtitle">
                Get a free compliance and business finance health check.
              </p>
            </div>

            <div className="wizard-form-wrapper" ref={formWrapperRef}>
              <form onSubmit={handleStep1Submit}>
                
                {/* Company Name (Required) */}
                <div className="wizard-form-group full-width">
                  <label className="wizard-label" htmlFor="companyName">Company Name *</label>
                  <div className="wizard-input-wrapper">
                    <span className="wizard-input-icon"><Building2 size={18} strokeWidth={1.8} /></span>
                    <input 
                      required 
                      type="text" 
                      id="companyName"
                      name="companyName" 
                      value={formData.companyName} 
                      onChange={handleChange} 
                      className="wizard-input" 
                      placeholder="e.g. Apex Innovators Pvt Ltd"
                      autoComplete="off"
                    />
                    {formData.companyName.trim() !== '' && (
                      <span className="wizard-input-check"><Check size={16} strokeWidth={2.5} /></span>
                    )}
                  </div>
                </div>

                {/* CIN & GSTIN */}
                <div className="wizard-form-grid">
                  <div className="wizard-form-group">
                    <label className="wizard-label" htmlFor="cin">CIN (Optional)</label>
                    <div className="wizard-input-wrapper">
                      <span className="wizard-input-icon"><FileCheck size={18} strokeWidth={1.8} /></span>
                      <input 
                        type="text" 
                        id="cin"
                        name="cin" 
                        value={formData.cin} 
                        onChange={handleChange} 
                        className="wizard-input" 
                        placeholder="21 digit CIN"
                        autoComplete="off"
                      />
                      {formData.cin.trim() !== '' && (
                        <span className="wizard-input-check"><Check size={16} strokeWidth={2.5} /></span>
                      )}
                    </div>
                  </div>

                  <div className="wizard-form-group">
                    <label className="wizard-label" htmlFor="gstin">GSTIN (Optional)</label>
                    <div className="wizard-input-wrapper">
                      <span className="wizard-input-icon"><Receipt size={18} strokeWidth={1.8} /></span>
                      <input 
                        type="text" 
                        id="gstin"
                        name="gstin" 
                        value={formData.gstin} 
                        onChange={handleChange} 
                        className="wizard-input" 
                        placeholder="15 digit GSTIN"
                        autoComplete="off"
                      />
                      {formData.gstin.trim() !== '' && (
                        <span className="wizard-input-check"><Check size={16} strokeWidth={2.5} /></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Business Type & Industry */}
                <div className="wizard-form-grid">
                  {/* Business Type Custom Dropdown */}
                  <div className="wizard-form-group" style={{ position: 'relative' }}>
                    <label className="wizard-label" htmlFor="businessType">Business Type</label>
                    <div className="wizard-input-wrapper">
                      <span className="wizard-input-icon"><Briefcase size={18} strokeWidth={1.8} /></span>
                      <div 
                        id="businessType"
                        tabIndex={0}
                        onClick={() => setOpenDropdown(openDropdown === 'businessType' ? null : 'businessType')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpenDropdown(openDropdown === 'businessType' ? null : 'businessType');
                          }
                        }}
                        className={`wizard-select custom-wizard-select ${openDropdown === 'businessType' ? 'open' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <span style={{ color: formData.businessType ? '#0F172A' : '#94A3B8', fontWeight: formData.businessType ? 600 : 500 }}>
                          {formData.businessType || 'Select Business Type'}
                        </span>
                      </div>
                      {formData.businessType.trim() !== '' && (
                        <span className="wizard-input-check" style={{ right: '36px' }}><Check size={16} strokeWidth={2.5} /></span>
                      )}
                    </div>

                    {openDropdown === 'businessType' && (
                      <div className="wizard-custom-select-menu">
                        {businessTypeOptions.map((opt) => {
                          const isSelected = formData.businessType === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => {
                                setFormData({ ...formData, businessType: opt });
                                setOpenDropdown(null);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#214ECF';
                                e.currentTarget.style.color = '#FFFFFF';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isSelected ? '#214ECF' : 'transparent';
                                e.currentTarget.style.color = isSelected ? '#FFFFFF' : '#0F172A';
                              }}
                              className={`wizard-custom-select-option ${isSelected ? 'selected' : ''}`}
                              style={{
                                padding: '10px 16px',
                                fontSize: '0.92rem',
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? '#FFFFFF' : '#0F172A',
                                backgroundColor: isSelected ? '#214ECF' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background-color 0.12s ease, color 0.12s ease'
                              }}
                            >
                              <span>{opt}</span>
                              {isSelected && <Check size={16} strokeWidth={2.5} color="#10B981" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Industry Custom Dropdown */}
                  <div className="wizard-form-group" style={{ position: 'relative' }}>
                    <label className="wizard-label" htmlFor="industry">Industry</label>
                    <div className="wizard-input-wrapper">
                      <span className="wizard-input-icon"><Layers size={18} strokeWidth={1.8} /></span>
                      <div 
                        id="industry"
                        tabIndex={0}
                        onClick={() => setOpenDropdown(openDropdown === 'industry' ? null : 'industry')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpenDropdown(openDropdown === 'industry' ? null : 'industry');
                          }
                        }}
                        className={`wizard-select custom-wizard-select ${openDropdown === 'industry' ? 'open' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <span style={{ color: formData.industry ? '#0F172A' : '#94A3B8', fontWeight: formData.industry ? 600 : 500 }}>
                          {formData.industry || 'Select Industry'}
                        </span>
                      </div>
                      {formData.industry.trim() !== '' && (
                        <span className="wizard-input-check" style={{ right: '36px' }}><Check size={16} strokeWidth={2.5} /></span>
                      )}
                    </div>

                    {openDropdown === 'industry' && (
                      <div className="wizard-custom-select-menu">
                        {industryOptions.map((opt) => {
                          const isSelected = formData.industry === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => {
                                setFormData({ ...formData, industry: opt });
                                setOpenDropdown(null);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#214ECF';
                                e.currentTarget.style.color = '#FFFFFF';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isSelected ? '#214ECF' : 'transparent';
                                e.currentTarget.style.color = isSelected ? '#FFFFFF' : '#0F172A';
                              }}
                              className={`wizard-custom-select-option ${isSelected ? 'selected' : ''}`}
                              style={{
                                padding: '10px 16px',
                                fontSize: '0.92rem',
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? '#FFFFFF' : '#0F172A',
                                backgroundColor: isSelected ? '#214ECF' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background-color 0.12s ease, color 0.12s ease'
                              }}
                            >
                              <span>{opt}</span>
                              {isSelected && <Check size={16} strokeWidth={2.5} color="#10B981" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Annual Turnover & State */}
                <div className="wizard-form-grid">
                  {/* Annual Turnover Custom Dropdown */}
                  <div className="wizard-form-group" style={{ position: 'relative' }}>
                    <label className="wizard-label" htmlFor="turnover">Annual Turnover</label>
                    <div className="wizard-input-wrapper">
                      <span className="wizard-input-icon"><IndianRupee size={18} strokeWidth={1.8} /></span>
                      <div 
                        id="turnover"
                        tabIndex={0}
                        onClick={() => setOpenDropdown(openDropdown === 'turnover' ? null : 'turnover')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpenDropdown(openDropdown === 'turnover' ? null : 'turnover');
                          }
                        }}
                        className={`wizard-select custom-wizard-select ${openDropdown === 'turnover' ? 'open' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <span style={{ color: formData.turnover ? '#0F172A' : '#94A3B8', fontWeight: formData.turnover ? 600 : 500 }}>
                          {formData.turnover || 'Select Annual Turnover'}
                        </span>
                      </div>
                      {formData.turnover.trim() !== '' && (
                        <span className="wizard-input-check" style={{ right: '36px' }}><Check size={16} strokeWidth={2.5} /></span>
                      )}
                    </div>

                    {openDropdown === 'turnover' && (
                      <div className="wizard-custom-select-menu">
                        {turnoverOptions.map((opt) => {
                          const isSelected = formData.turnover === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => {
                                setFormData({ ...formData, turnover: opt });
                                setOpenDropdown(null);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#214ECF';
                                e.currentTarget.style.color = '#FFFFFF';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isSelected ? '#214ECF' : 'transparent';
                                e.currentTarget.style.color = isSelected ? '#FFFFFF' : '#0F172A';
                              }}
                              className={`wizard-custom-select-option ${isSelected ? 'selected' : ''}`}
                              style={{
                                padding: '10px 16px',
                                fontSize: '0.92rem',
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? '#FFFFFF' : '#0F172A',
                                backgroundColor: isSelected ? '#214ECF' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background-color 0.12s ease, color 0.12s ease'
                              }}
                            >
                              <span>{opt}</span>
                              {isSelected && <Check size={16} strokeWidth={2.5} color="#10B981" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="wizard-form-group">
                    <label className="wizard-label" htmlFor="state">State</label>
                    <div className="wizard-input-wrapper">
                      <span className="wizard-input-icon"><MapPin size={18} strokeWidth={1.8} /></span>
                      <input 
                        type="text" 
                        id="state"
                        name="state" 
                        value={formData.state} 
                        onChange={handleChange} 
                        className="wizard-input" 
                        placeholder="Select State"
                        autoComplete="off"
                      />
                      {formData.state.trim() !== '' && (
                        <span className="wizard-input-check"><Check size={16} strokeWidth={2.5} /></span>
                      )}
                    </div>
                  </div>
                </div>

                <button type="submit" className="wizard-btn-primary">
                  Check My Business <ArrowRight size={18} className="wizard-btn-arrow" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* STEP 2 — COMPLIANCE HEALTH DASHBOARD */}
        {step === 2 && (
          <div className={`wizard-main-panel wizard-health-panel ${isTransitioning ? 'wizard-step-exit' : 'wizard-step-enter'}`}>
            <div className="wizard-step2-header">
              <span className="wizard-badge wizard-health-badge">STEP 2 OF 3 · PRELIMINARY SCORE</span>
              <h2 className="wizard-heading-step2">Your Business Compliance Health</h2>
              <p className="wizard-step2-sub">
                Preliminary assessment based on your business profile &amp; filings.
              </p>
            </div>

            {/* SCORE COUNT-UP CARD */}
            <div className="wizard-health-score-card">
              <div className="wizard-health-score-top">
                <span className="wizard-health-score-lbl">Compliance Health Score</span>
              </div>
              <div className="wizard-score-value">
                {displayScore} <span className="wizard-score-total">/ 100</span>
              </div>
              <p className="wizard-score-subtitle">
                {complianceResult
                  ? `We found ${complianceResult.issuesFound} area${complianceResult.issuesFound === 1 ? '' : 's'} that require attention.`
                  : 'Calculating your compliance health...'}
              </p>
            </div>

            {/* STATUS CARDS GRID */}
            <div className="wizard-cards-grid">
              {[
                { label: 'GST Filing', status: complianceResult?.gstStatus },
                { label: 'TDS Deductions', status: complianceResult?.tdsStatus },
                { label: 'MCA Filings', status: complianceResult?.mcaStatus },
                { label: 'Payroll Compliance', status: complianceResult?.payrollStatus },
              ].map((row) => {
                const isGood = row.status === 'Good';
                const isAttention = row.status === 'Attention';
                const isAction = row.status === 'Action Required';

                const cfg = isGood
                  ? { cls: 'good', Icon: CheckCircle2, text: 'Good' }
                  : isAttention
                  ? { cls: 'attention', Icon: AlertTriangle, text: 'Attention' }
                  : isAction
                  ? { cls: 'action', Icon: XCircle, text: 'Action Required' }
                  : { cls: 'calculating', Icon: CheckCircle2, text: 'In Progress' };

                return (
                  <div className="wizard-status-card" key={row.label}>
                    <div className="wizard-card-header-row">
                      <span className="wizard-card-label">{row.label}</span>
                      <cfg.Icon 
                        size={18} 
                        strokeWidth={2} 
                        className={`wizard-metric-icon ${cfg.cls}`} 
                      />
                    </div>
                    <div className={`wizard-card-status ${cfg.cls}`}>
                      <span className={`status-dot ${cfg.cls}`} />
                      <span>{cfg.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={handleStep2Submit} className="wizard-btn-primary wizard-btn-health-cta">
              Get My Full Compliance Plan <ArrowRight size={18} className="wizard-btn-arrow" />
            </button>
          </div>
        )}

        {/* STEP 3 — LEAD CAPTURE BEFORE DETAILED REPORT */}
        {step === 3 && (
          <div className={`wizard-main-panel ${isTransitioning ? 'wizard-step-exit' : 'wizard-step-enter'}`}>
            <button 
              type="button" 
              onClick={handleBackToStep2} 
              className="wizard-back-btn"
              aria-label="Back to Compliance Score"
            >
              <ArrowLeft size={17} strokeWidth={2} className="wizard-back-icon" />
              <span>Back to Score</span>
            </button>

            {!submitted ? (
              <>
                <div style={{ textAlign: 'center' }}>
                  <span className="wizard-badge">STEP 3 OF 3</span>
                  <h2 className="wizard-heading-step3">
                    Where should we send your <br className="hide-mobile" />
                    <span className="wizard-heading-highlight">detailed report?</span>
                  </h2>
                  <p className="wizard-subtitle">
                    A compliance specialist will review your file and provide personalized guidance.
                  </p>
                </div>

                <div className="wizard-form-wrapper">
                  <form onSubmit={handleLeadCapture}>
                    
                    {/* Full Name */}
                    <div className="wizard-form-group">
                      <label className="wizard-label" htmlFor="name">Full Name *</label>
                      <div className="wizard-input-wrapper">
                        <span className="wizard-input-icon"><User size={18} strokeWidth={1.8} /></span>
                        <input 
                          required 
                          type="text" 
                          id="name"
                          name="name" 
                          value={formData.name} 
                          onChange={handleChange} 
                          className="wizard-input" 
                          placeholder="Your name"
                        />
                        {formData.name.trim() !== '' && (
                          <span className="wizard-input-check"><Check size={16} strokeWidth={2.5} /></span>
                        )}
                      </div>
                    </div>

                    {/* Mobile Number */}
                    <div className="wizard-form-group">
                      <label className="wizard-label" htmlFor="mobile">Mobile Number *</label>
                      <div className="wizard-input-wrapper">
                        <span className="wizard-input-icon"><Phone size={18} strokeWidth={1.8} /></span>
                        <input 
                          required 
                          type="text" 
                          id="mobile"
                          name="mobile" 
                          value={formData.mobile} 
                          onChange={handleChange} 
                          className="wizard-input" 
                          placeholder="+91 98200 XXXXX"
                        />
                        {formData.mobile.trim() !== '' && (
                          <span className="wizard-input-check"><Check size={16} strokeWidth={2.5} /></span>
                        )}
                      </div>
                    </div>

                    {/* Email Address */}
                    <div className="wizard-form-group">
                      <label className="wizard-label" htmlFor="email">Email Address *</label>
                      <div className="wizard-input-wrapper">
                        <span className="wizard-input-icon"><Mail size={18} strokeWidth={1.8} /></span>
                        <input 
                          required 
                          type="email" 
                          id="email"
                          name="email" 
                          value={formData.email} 
                          onChange={handleChange} 
                          className="wizard-input" 
                          placeholder="naviXXXX@gmail.com"
                        />
                        {formData.email.trim() !== '' && (
                          <span className="wizard-input-check"><Check size={16} strokeWidth={2.5} /></span>
                        )}
                      </div>
                    </div>

                    {leadCaptureError && (
                      <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', padding: '10px 14px', borderRadius: '8px' }}>
                        {leadCaptureError}
                      </div>
                    )}

                    <button type="submit" className="wizard-btn-primary" disabled={finalSubmitting}>
                      {finalSubmitting ? 'Sending...' : 'Send My Report'}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="wizard-success-box">
                <FileCheck size={58} color="#059669" style={{ marginBottom: '12px' }} />
                <h2 className="wizard-success-title">Report Generated & Sent!</h2>
                <p style={{ color: '#475569', margin: '12px 0 24px', lineHeight: '1.6', fontSize: '1.02rem' }}>
                  A compliance specialist will contact you at <strong>{formData.mobile}</strong> to explain your report.
                </p>
                <div className="wizard-success-note">
                  ✓ Submission added to Sales CRM Lead Engine pipeline.
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default FreeComplianceCheckPage;
