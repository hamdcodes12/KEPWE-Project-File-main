import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, ArrowRight, Lock, Sparkles, Building2, User, Phone, Briefcase, BarChart3, ChevronDown, Check } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './FreeComplianceCheck.css';

const entityTypeOptions = [
  'Private Limited (Pvt Ltd)',
  'Limited Liability Partnership (LLP)',
  'Sole Proprietorship',
  'Partnership Firm',
  'One Person Company (OPC)'
];

const turnoverOptions = [
  'Pre-Revenue / New Setup',
  '₹20 Lakhs – ₹1 Crore',
  '₹1 Crore – ₹5 Crore',
  '₹5 Crore +'
];

const FreeComplianceCheck = () => {
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    entityType: 'Private Limited (Pvt Ltd)',
    turnover: '₹20 Lakhs – ₹1 Crore',
    complianceNeeds: []
  });

  const [openDropdown, setOpenDropdown] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <section className="compliance-check-section" id="compliance-check-section">
      <ScrollReveal animation="fade-up" duration={800} className="compliance-container">
        {/* Split Layout Container */}
        <div className="compliance-split-grid">
          {/* Left Column: Value Proposition */}
          <div className="compliance-left-info">
            <div className="compliance-pill">
              <ShieldCheck size={15} color="#214ECF" />
              <span>ZERO-COST AUDIT OFFER</span>
            </div>

            <h2 className="compliance-title">
              Detect Hidden Tax & Compliance Risks <br />
              <span className="title-cyan">Before Notices Arrive.</span>
            </h2>

            <p className="compliance-subtext">
              Our expert Chartered Accountants analyze your MCA filings, GST returns, and ITC records to produce a comprehensive Risk & Health Audit Report — 100% free of cost.
            </p>

            <div className="audit-points-list">
              <div className="audit-point-item">
                <CheckCircle2 size={20} className="audit-icon" color="#214ECF" />
                <div>
                  <strong>GST 2B vs 3B ITC Reconciliation Audit</strong>
                  <p>Identify un-claimed input tax credit and supplier filing gaps.</p>
                </div>
              </div>

              <div className="audit-point-item">
                <CheckCircle2 size={20} className="audit-icon" color="#214ECF" />
                <div>
                  <strong>MCA & ROC Compliance Status Check</strong>
                  <p>Check DIR-3 KYC, AOC-4, MGT-7 deadlines to prevent daily fines.</p>
                </div>
              </div>

              <div className="audit-point-item">
                <CheckCircle2 size={20} className="audit-icon" color="#214ECF" />
                <div>
                  <strong>Tax Liability & TDS Health Diagnostic</strong>
                  <p>Verify quarterly advance tax estimations and Form 26AS matching.</p>
                </div>
              </div>
            </div>

            <div className="security-guarantee-strip">
              <Lock size={18} color="#214ECF" />
              <span>100% Confidential & Non-Disclosure Protected</span>
            </div>
          </div>

          {/* Right Column: Interactive Assessment Form */}
          <div className="compliance-right-form-panel">
            {!isSubmitted ? (
              <form ref={formRef} onSubmit={handleSubmit} className="assessment-form">
                <div className="form-head">
                  <h3>Get Your Free Compliance Audit</h3>
                  <p>Takes less than 60 seconds. Confidential report delivered to your inbox.</p>
                </div>

                <div className="form-group">
                  <label htmlFor="businessName">Company / Business Name *</label>
                  <div className="compliance-input-wrap">
                    <span className="compliance-input-icon">
                      <Building2 size={17} strokeWidth={1.8} color="#214ECF" />
                    </span>
                    <input
                      id="businessName"
                      type="text"
                      className="compliance-form-input"
                      required
                      placeholder="e.g. Acme Technologies Pvt Ltd"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="contactName">Your Name *</label>
                    <div className="compliance-input-wrap">
                      <span className="compliance-input-icon">
                        <User size={17} strokeWidth={1.8} color="#214ECF" />
                      </span>
                      <input
                        id="contactName"
                        type="text"
                        className="compliance-form-input"
                        required
                        placeholder="Your name"
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Phone / WhatsApp *</label>
                    <div className="compliance-input-wrap">
                      <span className="compliance-input-icon">
                        <Phone size={17} strokeWidth={1.8} color="#214ECF" />
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        className="compliance-form-input"
                        required
                        placeholder="+91 933477XXXX"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label htmlFor="entityType">Business Entity</label>
                    <div className="compliance-input-wrap">
                      <span className="compliance-input-icon">
                        <Briefcase size={17} strokeWidth={1.8} color="#214ECF" />
                      </span>
                      <div 
                        id="entityType"
                        tabIndex={0}
                        onClick={() => setOpenDropdown(openDropdown === 'entityType' ? null : 'entityType')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setOpenDropdown(openDropdown === 'entityType' ? null : 'entityType');
                          }
                        }}
                        className={`compliance-select-trigger ${openDropdown === 'entityType' ? 'open' : ''}`}
                      >
                        <span>{formData.entityType || 'Select Business Entity'}</span>
                        <ChevronDown size={16} color="#214ECF" className={`compliance-chevron ${openDropdown === 'entityType' ? 'rotated' : ''}`} />
                      </div>
                    </div>

                    {openDropdown === 'entityType' && (
                      <div className="compliance-custom-select-menu">
                        {entityTypeOptions.map((opt) => {
                          const isSelected = formData.entityType === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => {
                                setFormData({ ...formData, entityType: opt });
                                setOpenDropdown(null);
                              }}
                              className={`compliance-custom-select-option ${isSelected ? 'selected' : ''}`}
                            >
                              <span>{opt}</span>
                              {isSelected && <Check size={16} strokeWidth={2.5} color="#10B981" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ position: 'relative' }}>
                    <label htmlFor="turnover">Annual Turnover</label>
                    <div className="compliance-input-wrap">
                      <span className="compliance-input-icon">
                        <BarChart3 size={17} strokeWidth={1.8} color="#214ECF" />
                      </span>
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
                        className={`compliance-select-trigger ${openDropdown === 'turnover' ? 'open' : ''}`}
                      >
                        <span>{formData.turnover || 'Select Turnover'}</span>
                        <ChevronDown size={16} color="#214ECF" className={`compliance-chevron ${openDropdown === 'turnover' ? 'rotated' : ''}`} />
                      </div>
                    </div>

                    {openDropdown === 'turnover' && (
                      <div className="compliance-custom-select-menu">
                        {turnoverOptions.map((opt) => {
                          const isSelected = formData.turnover === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => {
                                setFormData({ ...formData, turnover: opt });
                                setOpenDropdown(null);
                              }}
                              className={`compliance-custom-select-option ${isSelected ? 'selected' : ''}`}
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

                <button type="submit" className="submit-audit-btn">
                  Generate Free Audit Report <ArrowRight size={18} />
                </button>

                <div className="form-footer-note">
                  ⚡ <strong>Fast Response:</strong> Assigned CA calls within 15 mins during working hours.
                </div>
              </form>
            ) : (
              <div className="submission-success-box">
                <CheckCircle2 size={56} color="#214ECF" />
                <h3>Audit Request Received!</h3>
                <p>
                  Thank you, <strong>{formData.contactName}</strong>. Our senior compliance specialist is analyzing <strong>{formData.businessName}</strong>. You will receive your audit deck via Email & WhatsApp shortly.
                </p>
                <button onClick={() => setIsSubmitted(false)} className="reset-form-btn">
                  Submit Another Company Check
                </button>
              </div>
            )}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
};

export default FreeComplianceCheck;
