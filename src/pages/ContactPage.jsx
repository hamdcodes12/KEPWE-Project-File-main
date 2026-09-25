import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Phone, 
  Mail, 
  MapPin, 
  MessageSquare, 
  CheckCircle2, 
  ArrowRight, 
  AlertCircle, 
  ChevronDown, 
  Check, 
  User, 
  Building2, 
  Briefcase, 
  Headphones 
} from 'lucide-react';

const ContactPage = () => {
  const { submitContact } = useApp();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const requirementOptions = [
    { value: 'GST & Accounting', label: 'GST & Monthly Accounting' },
    { value: 'Company Registration', label: 'Company Incorporation / Registration' },
    { value: 'MCA ROC Filings', label: 'MCA Annual Filings & Secretarial' },
    { value: 'Payroll & HR', label: 'Payroll, PF & ESI Setup' },
    { value: 'Virtual CFO', label: 'Virtual CFO & Financial Advisory' },
    { value: 'Business Finance', label: 'Working Capital & Business Loans' }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    requirement: 'GST & Accounting',
  });

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Please enter your name.';
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) errs.email = 'Please enter a valid email.';
    if (!formData.phone || formData.phone.trim().length < 10) errs.phone = 'Please enter a 10-digit mobile number.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setSubmitting(true);
    // Persist the request to PostgreSQL via the real backend and create a
    // linked CRM lead server-side (see POST /api/contact).
    const result = await submitContact(formData);
    setSubmitting(false);

    if (result.success) {
      setSubmitted(true);
    } else {
      setErrors({ form: result.error || 'Could not submit your request. Please try again.' });
    }
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '60px 20px 100px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 48px' }}>
          <span style={{ background: '#E0E7FF', color: '#214ECF', fontSize: '0.85rem', fontWeight: 800, padding: '6px 16px', borderRadius: '9999px', letterSpacing: '0.05em' }}>
            GET IN TOUCH · SENIOR CA CONSULTATION
          </span>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.6rem)', fontWeight: 900, marginTop: '16px', marginBottom: '12px' }}>
            We'd Love to Help Your Business Grow
          </h1>
          <p style={{ color: '#5B6478', fontSize: '1.05rem', lineHeight: '1.6' }}>
            Talk to a Senior CA advisor or request assistance with your statutory filings and business setup.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '32px', alignItems: 'flex-start' }}>
          {/* Form Card */}
          <div style={{ background: '#FFFFFF', padding: '36px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Headphones size={22} color="#214ECF" strokeWidth={2} />
              <span>Request Free CA Callback</span>
            </h2>

            {errors.form && (
              <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', padding: '10px 14px', borderRadius: '8px' }}>
                {errors.form}
              </div>
            )}

            {submitted ? (
              <div style={{ padding: '32px 24px', background: 'rgba(27,158,90,0.12)', borderRadius: '16px', border: '1px solid #1B9E5A', color: '#1B9E5A', textAlign: 'center' }}>
                <CheckCircle2 size={40} style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Request Submitted Successfully!</h3>
                <p style={{ fontSize: '0.9rem', marginTop: '8px', color: '#1E293B', lineHeight: '1.5' }}>
                  A Senior Kepwe CA advisor has received your request and will call you back on <strong>{formData.phone}</strong> within 30 minutes.
                </p>
                <div style={{ marginTop: '16px', fontSize: '0.78rem', color: '#64748B' }}>
                  Lead automatically registered in Kepwe CRM pipeline.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* 1. Your Name */}
                <div>
                  <label htmlFor="contact-name" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Your Name *</label>
                  <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                    <User size={18} color="#214ECF" strokeWidth={2} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }} />
                    <input
                      id="contact-name"
                      type="text"
                      required
                      placeholder="e.g. Your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '8px', border: errors.name ? '1px solid #EF4444' : '1px solid #CBD5E1', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  {errors.name && <div style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: '4px' }}>{errors.name}</div>}
                </div>

                {/* 2. Company Name */}
                <div>
                  <label htmlFor="contact-company" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Company Name</label>
                  <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                    <Building2 size={18} color="#214ECF" strokeWidth={2} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }} />
                    <input
                      id="contact-company"
                      type="text"
                      placeholder="e.g. Apex Technologies Pvt Ltd"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* 3 & 4. Phone & Email */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '14px' }}>
                  <div>
                    <label htmlFor="contact-phone" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Mobile Phone *</label>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                      <Phone size={18} color="#214ECF" strokeWidth={2} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }} />
                      <input
                        id="contact-phone"
                        type="tel"
                        required
                        placeholder="933477XXXX"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '8px', border: errors.phone ? '1px solid #EF4444' : '1px solid #CBD5E1', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    {errors.phone && <div style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: '4px' }}>{errors.phone}</div>}
                  </div>

                  <div>
                    <label htmlFor="contact-email" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Business Email *</label>
                    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                      <Mail size={18} color="#214ECF" strokeWidth={2} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }} />
                      <input
                        id="contact-email"
                        type="email"
                        required
                        placeholder="naviXXXX@gmail.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: '8px', border: errors.email ? '1px solid #EF4444' : '1px solid #CBD5E1', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    {errors.email && <div style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: '4px' }}>{errors.email}</div>}
                  </div>
                </div>

                {/* 5. Primary Service Requirement */}
                <div style={{ position: 'relative' }} ref={dropdownRef}>
                  <label htmlFor="contact-requirement" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Primary Service Requirement</label>
                  
                  <div
                    id="contact-requirement"
                    tabIndex={0}
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDropdownOpen(!dropdownOpen);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: dropdownOpen ? '1.5px solid #214ECF' : '1px solid #CBD5E1',
                      boxShadow: dropdownOpen ? '0 0 0 3px rgba(33, 78, 207, 0.12)' : 'none',
                      fontSize: '0.95rem',
                      background: '#FFFFFF',
                      fontWeight: 600,
                      color: '#0F172A',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Briefcase size={18} color="#214ECF" strokeWidth={2} />
                      <span>{requirementOptions.find((opt) => opt.value === formData.requirement)?.label || 'Select Service'}</span>
                    </div>
                    <ChevronDown size={18} color="#64748B" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }} />
                  </div>

                  {dropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.12), 0 4px 8px -2px rgba(15, 23, 42, 0.04)',
                        zIndex: 50,
                        overflow: 'hidden',
                        padding: '4px 0'
                      }}
                    >
                      {requirementOptions.map((opt) => {
                        const isSelected = formData.requirement === opt.value;
                        return (
                          <div
                            key={opt.value}
                            onClick={() => {
                              setFormData({ ...formData, requirement: opt.value });
                              setDropdownOpen(false);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#214ECF';
                              e.currentTarget.style.color = '#FFFFFF';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = isSelected ? '#214ECF' : 'transparent';
                              e.currentTarget.style.color = isSelected ? '#FFFFFF' : '#0F172A';
                            }}
                            style={{
                              padding: '10px 14px',
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
                            <span>{opt.label}</span>
                            {isSelected && <Check size={16} strokeWidth={2.5} color="#FFFFFF" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 6. Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: submitting ? '#94A3B8' : '#214ECF', color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px', transition: 'background-color 0.2s ease, transform 0.15s ease' }}
                >
                  <span>{submitting ? 'Submitting...' : 'Request Free CA Callback'}</span>
                  {!submitting && <ArrowRight size={18} strokeWidth={2} />}
                </button>
              </form>
            )}
          </div>

          {/* Contact Information Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Phone Support */}
            <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <Phone size={24} color="#214ECF" strokeWidth={2} style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>Phone Support</h3>
              <p style={{ fontSize: '0.9rem', color: '#475569', margin: 0 }}>+91 (800) 123-4567 / +91 (11) 4567-8900</p>
              <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'block', marginTop: '4px' }}>Monday - Saturday: 9:00 AM to 8:00 PM IST</span>
            </div>

            {/* Email Support */}
            <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <Mail size={24} color="#214ECF" strokeWidth={2} style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>Email Support</h3>
              <p style={{ fontSize: '0.9rem', color: '#475569', margin: 0 }}>support@kepwe.com / ca@kepwe.com</p>
              <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'block', marginTop: '4px' }}>Response time: within 2 hours during business hours</span>
            </div>

            {/* Headquarters */}
            <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <MapPin size={24} color="#214ECF" strokeWidth={2} style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>Headquarters</h3>
              <p style={{ fontSize: '0.9rem', color: '#475569', margin: 0, lineHeight: '1.5' }}>
                KEPWE Tower, Cyber City Phase II, Gurugram, Haryana 122002
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
