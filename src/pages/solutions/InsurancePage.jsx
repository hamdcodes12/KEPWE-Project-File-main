import React from 'react';
import { ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const InsurancePage = () => {
  const navigate = useNavigate();

  return (
    <div className="solutions-page section-padding">
      <div className="container">
        <div className="solutions-hero text-center" style={{ maxWidth: '800px', margin: '0 auto 60px' }}>
          <div className="badge badge-blue" style={{ marginBottom: '16px' }}>
            <ShieldCheck size={14} /> BUSINESS & TEAM INSURANCE
          </div>
          <h1 className="heading-xl">
            Protect Your Business, Founders <span className="text-gradient">& Employees</span>
          </h1>
          <p className="text-lg text-muted" style={{ marginTop: '16px' }}>
            Group Health Insurance, Directors & Officers (D&O) Liability, Keyman Insurance, and Asset Cyber Protection.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
            <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
              Get Insurance Quote <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsurancePage;
