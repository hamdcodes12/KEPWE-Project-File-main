import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  Upload, 
  FileText, 
  Building2, 
  CreditCard, 
  Sparkles,
  AlertCircle,
  Calendar,
  Check,
  Briefcase
} from 'lucide-react';
import './CreditApplicationPage.css';

const CreditApplicationPage = () => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Application Step (1: Identity & KYC, 2: Employment & Bank Details, 3: Verification & Docs)
  const [appStep, setAppStep] = useState(1);

  // Field input refs for focus on failed validation
  const panInputRef = React.useRef(null);
  const dobInputRef = React.useRef(null);
  const aadhaarInputRef = React.useRef(null);

  // Form Fields
  const [formData, setFormData] = useState({
    panNumber: '',
    aadhaarLast4: '',
    dob: '',
    companyName: '',
    workEmail: '',
    salaryBank: 'HDFC Bank',
    accountNumber: '',
    ifscCode: '',
    uploadedPan: true,
    uploadedStatement: true
  });

  // Track field interactions for non-aggressive inline errors
  const [touched, setTouched] = useState({
    panNumber: false,
    dob: false,
    aadhaarLast4: false
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kepwe_credit_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        setDraft(parsed);
        if (parsed?.personalDetails?.panNumber) {
          setFormData((prev) => ({
            ...prev,
            panNumber: parsed.personalDetails.panNumber
          }));
          setTouched((prev) => ({ ...prev, panNumber: true }));
        }
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // ── Step 1 Validation Calculations ──
  const isPanValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.trim().toUpperCase());

  const isDobValid = (() => {
    if (!formData.dob) return false;
    const d = new Date(formData.dob);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const minDate = new Date(1920, 0, 1);
    return d <= now && d >= minDate;
  })();

  const isAadhaarValid = /^[0-9]{4}$/.test(formData.aadhaarLast4.trim());

  const isStep1Valid = isPanValid && isDobValid && isAadhaarValid;

  const handleProceedToStep2 = (e) => {
    if (e) e.preventDefault();
    setTouched({ panNumber: true, dob: true, aadhaarLast4: true });

    if (!isPanValid) {
      if (panInputRef.current) {
        panInputRef.current.focus();
        panInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!isDobValid) {
      if (dobInputRef.current) {
        dobInputRef.current.focus();
        dobInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!isAadhaarValid) {
      if (aadhaarInputRef.current) {
        aadhaarInputRef.current.focus();
        aadhaarInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setAppStep(2);
  };

  const handleSubmitApplication = (e) => {
    e.preventDefault();
    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      // Generate a unique application reference number
      const trackingId = 'KC-' + Math.floor(100000 + Math.random() * 900000);
      const applicationRecord = {
        trackingId,
        submittedAt: new Date().toISOString(),
        loanAmount: draft?.loanAmount || 200000,
        purpose: draft?.purpose || 'Home Expenses',
        lender: draft?.selectedOption?.lenderName || 'Axis Finance Partner',
        tenure: draft?.selectedOption?.tenure || 24,
        emi: draft?.selectedOption?.emi || 11590,
        interestRate: draft?.selectedOption?.interestRate || 10.49,
        applicantName: draft?.personalDetails?.fullName || 'Your name',
        mobile: draft?.personalDetails?.mobile || '93347XXXXX',
        email: draft?.personalDetails?.email || 'NaviXXXX@gmail.com',
        currentStage: 3, // Stage 3: Lender Review
        statusHistory: [
          { stage: 1, title: 'Application Received', timestamp: 'Just now', completed: true },
          { stage: 2, title: 'Digital KYC & Verification', timestamp: 'Verified via OTP', completed: true },
          { stage: 3, title: 'Lender Assessment', timestamp: 'In Progress (Expected 4-6 hrs)', active: true },
          { stage: 4, title: 'Credit Decision & Sanction', timestamp: 'Pending', pending: true },
          { stage: 5, title: 'Direct Account Disbursement', timestamp: 'Pending', pending: true }
        ]
      };

      try {
        localStorage.setItem('kepwe_active_loan_application', JSON.stringify(applicationRecord));
      } catch (err) {
        console.warn(err);
      }

      navigate(`/credit/application/status?id=${trackingId}`);
    }, 1800);
  };

  return (
    <div className="credit-application-wrapper">
      
      {/* ── Sub Navigation Header ── */}
      <div className="application-subnav">
        <div className="container subnav-container">
          <Link to="/credit/eligibility" className="subnav-back-link">
            <ArrowLeft size={16} />
            <span>Change Loan Option</span>
          </Link>
          <div className="subnav-brand">
            <span className="brand-dot" />
            <span>Digital Loan Application</span>
          </div>
          <div className="subnav-trust-badge">
            <ShieldCheck size={15} color="#12B76A" />
            <span>128-bit Encrypted Bank Grade Security</span>
          </div>
        </div>
      </div>

      <div className="container app-content-container">

        <div className="app-layout-grid">
          
          {/* Left Form Column */}
          <div className="app-form-column">
            
            {/* ── Top 3-Step Progress Stepper ── */}
            <div className="app-stepper-container">
              <div className="app-stepper-track">
                <div 
                  className="app-stepper-fill" 
                  style={{ width: appStep === 1 ? '0%' : appStep === 2 ? '50%' : '100%' }} 
                />
              </div>

              <div 
                className={`app-stepper-node ${appStep === 1 ? 'active' : ''} ${appStep > 1 ? 'done' : ''}`} 
                onClick={() => setAppStep(1)}
              >
                <div className="step-circle">
                  {appStep > 1 ? <Check size={14} strokeWidth={3} /> : <span>1</span>}
                </div>
                <div className="step-label-group">
                  <span className="step-stage-num">STEP 1</span>
                  <span className="step-text">KYC & Identity</span>
                </div>
              </div>

              <div 
                className={`app-stepper-node ${appStep === 2 ? 'active' : ''} ${appStep > 2 ? 'done' : ''} ${!isStep1Valid ? 'disabled' : ''}`} 
                onClick={() => {
                  if (appStep === 1) {
                    handleProceedToStep2();
                  } else if (appStep > 1) {
                    setAppStep(2);
                  }
                }}
              >
                <div className="step-circle">
                  {appStep > 2 ? <Check size={14} strokeWidth={3} /> : <span>2</span>}
                </div>
                <div className="step-label-group">
                  <span className="step-stage-num">STEP 2</span>
                  <span className="step-text">Banking & Income</span>
                </div>
              </div>

              <div 
                className={`app-stepper-node ${appStep === 3 ? 'active' : ''} ${appStep < 3 ? 'disabled' : ''}`} 
                onClick={() => {
                  if (appStep === 1) {
                    handleProceedToStep2();
                  } else if (appStep === 2 && formData.companyName && formData.accountNumber) {
                    setAppStep(3);
                  }
                }}
              >
                <div className="step-circle">
                  <span>3</span>
                </div>
                <div className="step-label-group">
                  <span className="step-stage-num">STEP 3</span>
                  <span className="step-text">Verification & Submit</span>
                </div>
              </div>
            </div>

            <div className="app-card-panel">
              
              {/* STEP 1 */}
              {appStep === 1 && (
                <div className="form-section-block animate-fadeIn">
                  <div className="panel-header-wrap">
                    <h2 className="panel-title">Identity & Government KYC</h2>
                    <p className="panel-sub">
                      Enter your permanent identity numbers for instant paperless e-KYC.
                    </p>
                  </div>

                  <div className="inputs-grid">
                    {/* 1. PAN Card Number */}
                    <div className="input-field-group">
                      <div className="field-label-row">
                        <label className="field-label">PAN Card Number *</label>
                        {touched.panNumber && isPanValid && (
                          <span className="field-valid-badge">
                            <Check size={12} strokeWidth={3} /> Valid PAN
                          </span>
                        )}
                      </div>
                      <div className="field-input-wrap">
                        <CreditCard size={17} strokeWidth={2} className={`field-prefix-icon ${touched.panNumber && !isPanValid ? 'icon-invalid' : ''}`} />
                        <input
                          ref={panInputRef}
                          type="text"
                          placeholder="ABCDE1234F"
                          maxLength={10}
                          style={{ textTransform: 'uppercase' }}
                          value={formData.panNumber}
                          onBlur={() => setTouched((prev) => ({ ...prev, panNumber: true }))}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                            setFormData({ ...formData, panNumber: val });
                          }}
                          className={`field-control has-icon ${touched.panNumber && !isPanValid ? 'is-invalid' : ''} ${touched.panNumber && isPanValid ? 'is-valid' : ''}`}
                          required
                        />
                      </div>
                      {touched.panNumber && !isPanValid && (
                        <span className="field-error-msg">
                          <AlertCircle size={13} /> Enter a valid PAN number.
                        </span>
                      )}
                    </div>

                    {/* 2. Date of Birth */}
                    <div className="input-field-group">
                      <div className="field-label-row">
                        <label className="field-label">Date of Birth (as per PAN) *</label>
                        {touched.dob && isDobValid && (
                          <span className="field-valid-badge">
                            <Check size={12} strokeWidth={3} /> Valid DOB
                          </span>
                        )}
                      </div>
                      <div className="field-input-wrap">
                        <Calendar size={17} strokeWidth={2} className={`field-prefix-icon ${touched.dob && !isDobValid ? 'icon-invalid' : ''}`} />
                        <input
                          ref={dobInputRef}
                          type="date"
                          value={formData.dob}
                          max={new Date().toISOString().split('T')[0]}
                          onBlur={() => setTouched((prev) => ({ ...prev, dob: true }))}
                          onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                          className={`field-control has-icon field-date-input ${touched.dob && !isDobValid ? 'is-invalid' : ''} ${touched.dob && isDobValid ? 'is-valid' : ''}`}
                          required
                        />
                      </div>
                      {touched.dob && !isDobValid && (
                        <span className="field-error-msg">
                          <AlertCircle size={13} /> Enter a valid date of birth.
                        </span>
                      )}
                    </div>

                    {/* 3. Aadhaar Last 4 Digits */}
                    <div className="input-field-group full-width-col">
                      <div className="field-label-row">
                        <label className="field-label">Aadhaar Last 4 Digits (for Instant e-Sign) *</label>
                        {touched.aadhaarLast4 && isAadhaarValid && (
                          <span className="field-valid-badge">
                            <Check size={12} strokeWidth={3} /> Valid Aadhaar
                          </span>
                        )}
                      </div>
                      <div className="field-input-wrap">
                        <ShieldCheck size={17} strokeWidth={2} className={`field-prefix-icon ${touched.aadhaarLast4 && !isAadhaarValid ? 'icon-invalid' : ''}`} />
                        <input
                          ref={aadhaarInputRef}
                          type="text"
                          placeholder="•••• 1234"
                          maxLength={4}
                          inputMode="numeric"
                          value={formData.aadhaarLast4}
                          onBlur={() => setTouched((prev) => ({ ...prev, aadhaarLast4: true }))}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            setFormData({ ...formData, aadhaarLast4: val });
                          }}
                          className={`field-control has-icon ${touched.aadhaarLast4 && !isAadhaarValid ? 'is-invalid' : ''} ${touched.aadhaarLast4 && isAadhaarValid ? 'is-valid' : ''}`}
                          required
                        />
                      </div>
                      {touched.aadhaarLast4 && !isAadhaarValid ? (
                        <span className="field-error-msg">
                          <AlertCircle size={13} /> Enter the last 4 digits of your Aadhaar.
                        </span>
                      ) : (
                        <span className="field-hint-text">
                          <Lock size={12} /> Only last 4 digits required for verification. 128-bit UIDAI encrypted.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="action-row">
                    <button 
                      type="button" 
                      onClick={handleProceedToStep2} 
                      className="btn-app-primary"
                      disabled={!isStep1Valid}
                    >
                      <span>Next: Banking Details</span>
                      <ArrowRight size={16} className="btn-arrow-icon" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {appStep === 2 && (
                <div className="form-section-block animate-fadeIn">
                  <div className="panel-header-wrap">
                    <h2 className="panel-title">Employment & Salary Account</h2>
                    <p className="panel-sub">
                      Specify the bank account where your monthly salary / business receipts are credited.
                    </p>
                  </div>

                  <div className="inputs-grid">
                    <div className="input-field-group full-width-col">
                      <label className="field-label">Employer / Enterprise Name *</label>
                      <div className="field-input-wrap">
                        <Briefcase size={17} strokeWidth={2} className="field-prefix-icon" />
                        <input
                          type="text"
                          placeholder="e.g. Infosys Ltd / ABC Technologies"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          className="field-control has-icon"
                          required
                        />
                      </div>
                    </div>

                    <div className="input-field-group">
                      <label className="field-label">Salary / Primary Bank *</label>
                      <div className="field-input-wrap">
                        <Building2 size={17} strokeWidth={2} className="field-prefix-icon" />
                        <select
                          value={formData.salaryBank}
                          onChange={(e) => setFormData({ ...formData, salaryBank: e.target.value })}
                          className="field-control has-icon field-select"
                        >
                          <option>HDFC Bank</option>
                          <option>ICICI Bank</option>
                          <option>State Bank of India (SBI)</option>
                          <option>Axis Bank</option>
                          <option>Kotak Mahindra Bank</option>
                          <option>Other Scheduled Bank</option>
                        </select>
                      </div>
                    </div>

                    <div className="input-field-group">
                      <label className="field-label">Bank IFSC Code *</label>
                      <div className="field-input-wrap">
                        <CreditCard size={17} strokeWidth={2} className="field-prefix-icon" />
                        <input
                          type="text"
                          placeholder="e.g. HDFC0001234"
                          style={{ textTransform: 'uppercase' }}
                          value={formData.ifscCode}
                          onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                          className="field-control has-icon"
                          required
                        />
                      </div>
                    </div>

                    <div className="input-field-group full-width-col">
                      <label className="field-label">Bank Account Number *</label>
                      <div className="field-input-wrap">
                        <FileText size={17} strokeWidth={2} className="field-prefix-icon" />
                        <input
                          type="text"
                          placeholder="Enter account number for loan disbursal"
                          value={formData.accountNumber}
                          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                          className="field-control has-icon"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="action-row space-between">
                    <button type="button" onClick={() => setAppStep(1)} className="btn-app-secondary">
                      <ArrowLeft size={16} /> <span>Back</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setAppStep(3)} 
                      className="btn-app-primary"
                      disabled={!formData.companyName || !formData.accountNumber}
                    >
                      <span>Next: Verify & Submit</span>
                      <ArrowRight size={16} className="btn-arrow-icon" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {appStep === 3 && (
                <div className="form-section-block animate-fadeIn">
                  <div className="panel-header-wrap">
                    <h2 className="panel-title">Digital Verification & Final Consent</h2>
                    <p className="panel-sub">
                      Review and confirm your digital application packet for final partner submission.
                    </p>
                  </div>

                  <div className="verification-cards-list">
                    <div className="doc-item-row">
                      <div className="doc-icon">
                        <FileText size={20} color="#214ECF" />
                      </div>
                      <div className="doc-details">
                        <span className="doc-name">PAN & Identity Verification</span>
                        <span className="doc-status text-green">✓ Validated via NSDL Database</span>
                      </div>
                    </div>

                    <div className="doc-item-row">
                      <div className="doc-icon">
                        <Building2 size={20} color="#214ECF" />
                      </div>
                      <div className="doc-details">
                        <span className="doc-name">Salary Account Verification</span>
                        <span className="doc-status text-green">✓ Penny Drop Account Validation Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="consent-alert-box">
                    <AlertCircle size={20} color="#214ECF" />
                    <p>
                      By submitting, you agree to permit Kepwe Credit and the designated lending partner to process your loan application and access bureau records strictly for loan sanctioning.
                    </p>
                  </div>

                  <div className="action-row space-between">
                    <button type="button" onClick={() => setAppStep(2)} className="btn-app-secondary">
                      <ArrowLeft size={16} /> <span>Back</span>
                    </button>
                    <button 
                      type="button" 
                      onClick={handleSubmitApplication} 
                      className="btn-app-primary"
                      disabled={submitting}
                    >
                      <span>{submitting ? 'Submitting Application...' : 'Submit Application Now'}</span>
                      <ArrowRight size={16} className="btn-arrow-icon" />
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Right Selected Loan Summary Column */}
          <div className="app-summary-column">
            <div className="summary-sticky-card">
              <div className="sum-head">
                <span className="sum-label-tag">SELECTED OFFER</span>
                <h3 className="sum-lender">{draft?.selectedOption?.lenderName || 'Axis Finance Partner'}</h3>
                <span className="sum-plan">{draft?.selectedOption?.planName || 'Flexi Personal Credit'}</span>
              </div>

              <div className="sum-metrics-box">
                <div className="s-metric">
                  <span className="lbl">Loan Amount</span>
                  <div className="val money-display">
                    <span className="money-curr">₹</span>
                    <span className="money-val">{(draft?.loanAmount || 200000).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="s-metric">
                  <span className="lbl">Tenure</span>
                  <div className="val money-display">
                    <span className="money-val">{draft?.selectedOption?.tenure || 24}</span>
                    <span className="money-unit">Months</span>
                  </div>
                </div>
                <div className="s-metric">
                  <span className="lbl">Interest Rate</span>
                  <div className="val text-blue money-display">
                    <span className="money-val">{draft?.selectedOption?.interestRate || 10.49}%</span>
                    <span className="money-unit">p.a.</span>
                  </div>
                </div>
                
                <div className="sum-metric-divider" />

                <div className="s-metric highlight">
                  <span className="lbl">Monthly EMI</span>
                  <div className="val text-blue money-display">
                    <span className="money-curr">₹</span>
                    <span className="money-val">{(draft?.selectedOption?.emi || 11590).toLocaleString('en-IN')}</span>
                    <span className="money-unit">/mo</span>
                  </div>
                </div>
              </div>

              <div className="sum-security-note">
                <Lock size={15} className="lock-icon" />
                <span>Zero upfront fees. Processing charges deducted only on disbursal.</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default CreditApplicationPage;
