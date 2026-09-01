import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, Zap, Building2, Calculator } from 'lucide-react';
import Button from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

const FreeComplianceCheckPage = () => {
  const [step, setStep] = useState(1);
  const [bizType, setBizType] = useState('Pvt Ltd');
  const [hasGst, setHasGst] = useState('Yes');
  const [employees, setEmployees] = useState('1-10');
  const [audited, setAudited] = useState(false);
  const navigate = useNavigate();

  const handleAudit = (e) => {
    e.preventDefault();
    setAudited(true);
  };

  return (
    <div className="audit-page section-padding">
      <div className="container">
        
        <div className="solutions-hero text-center" style={{ maxWidth: '800px', margin: '0 auto 40px' }}>
          <div className="badge badge-blue" style={{ marginBottom: '16px' }}>
            <ShieldCheck size={14} /> FREE 60-SECOND AUDIT WIZARD
          </div>
          <h1 className="heading-xl">
            Get Your Instant Business <span className="text-gradient">Compliance Health Score</span>
          </h1>
          <p className="text-lg text-muted" style={{ marginTop: '16px' }}>
            Identify pending ROC filings, GST mismatch penalties, and unclaimed tax savings in under 1 minute.
          </p>
        </div>

        <div className="glass-card" style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px', boxSizing: 'border-box' }}>
          {audited ? (
            <div className="text-center">
              <div style={{ width: '90px', height: '90px', borderRadius: '50%', border: '6px solid var(--color-accent-blue)', margin: '0 auto 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span className="heading-lg text-gradient" style={{ lineHeight: 1 }}>92</span>
                <span style={{ fontSize: '0.625rem', fontWeight: '700', color: 'var(--color-text-tertiary)' }}>SCORE</span>
              </div>
              <h2 className="heading-md">Audit Report Ready!</h2>
              <p className="text-sm text-muted" style={{ marginTop: '8px', marginBottom: '24px' }}>
                We found <strong>2 tax optimization opportunities</strong> (worth ~₹1.2 Lakhs ITC) and 1 upcoming MCA deadline for your {bizType}.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
                  Download Full CA Audit PDF
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAudit}>
              <div style={{ marginBottom: '24px' }}>
                <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '10px' }}>
                  1. Business Constitution Type:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                  {['Pvt Ltd', 'LLP', 'Proprietorship', 'OPC'].map(type => (
                    <button 
                      key={type}
                      type="button"
                      onClick={() => setBizType(type)}
                      style={{
                        padding: '12px 8px',
                        borderRadius: '10px',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        border: '1px solid var(--color-border)',
                        background: bizType === type ? 'var(--color-accent-blue)' : 'var(--color-bg-secondary)',
                        color: bizType === type ? '#ffffff' : 'var(--color-text-primary)'
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '10px' }}>
                  2. Is your business GST registered?
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {['Yes', 'No'].map(ans => (
                    <button 
                      key={ans}
                      type="button"
                      onClick={() => setHasGst(ans)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '10px',
                        fontWeight: '600',
                        border: '1px solid var(--color-border)',
                        background: hasGst === ans ? 'var(--color-accent-blue)' : 'var(--color-bg-secondary)',
                        color: hasGst === ans ? '#ffffff' : 'var(--color-text-primary)'
                      }}
                    >
                      {ans}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '10px' }}>
                  3. Total Employee Count:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(65px, 1fr))', gap: '8px' }}>
                  {['1-5', '6-20', '21-50', '50+'].map(emp => (
                    <button 
                      key={emp}
                      type="button"
                      onClick={() => setEmployees(emp)}
                      style={{
                        padding: '10px 4px',
                        borderRadius: '10px',
                        fontWeight: '600',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--color-border)',
                        background: employees === emp ? 'var(--color-accent-blue)' : 'var(--color-bg-secondary)',
                        color: employees === emp ? '#ffffff' : 'var(--color-text-primary)'
                      }}
                    >
                      {emp}
                    </button>
                  ))}
                </div>
              </div>

              <Button variant="primary" size="lg" type="submit" style={{ width: '100%' }}>
                Generate My Business Health Report <ArrowRight size={18} />
              </Button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};

export default FreeComplianceCheckPage;
