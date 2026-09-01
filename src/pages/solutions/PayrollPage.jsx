import React from 'react';
import { Briefcase, CheckCircle2, Users, CreditCard, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const PayrollPage = () => {
  const navigate = useNavigate();

  return (
    <div className="solutions-page section-padding">
      <div className="container">
        <div className="solutions-hero text-center" style={{ maxWidth: '800px', margin: '0 auto 60px' }}>
          <div className="badge badge-blue" style={{ marginBottom: '16px' }}>
            <Briefcase size={14} /> PAYROLL & HR COMPLIANCE
          </div>
          <h1 className="heading-xl">
            Automated Salary Disbursal & <span className="text-gradient">PF/ESIC/PT Compliance</span>
          </h1>
          <p className="text-lg text-muted" style={{ marginTop: '16px' }}>
            Process monthly payroll in 1-click. Auto-calculate TDS on salary, Provident Fund, ESIC, and Professional Tax.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
            <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
              Automate Payroll <ArrowRight size={18} />
            </Button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <div className="glass-card" style={{ padding: '30px' }}>
            <Users size={32} className="text-blue" style={{ marginBottom: '16px' }} />
            <h3 className="heading-sm">Employee Self-Service</h3>
            <p className="text-muted text-sm" style={{ marginTop: '8px' }}>Payslips, Form 16, leave requests, and tax declarations in one portal.</p>
          </div>
          <div className="glass-card" style={{ padding: '30px' }}>
            <CreditCard size={32} className="text-success" style={{ marginBottom: '16px' }} />
            <h3 className="heading-sm">1-Click Salary Disbursal</h3>
            <p className="text-muted text-sm" style={{ marginTop: '8px' }}>Direct salary transfers to any Indian bank account via ICICI/HDFC bank integration.</p>
          </div>
          <div className="glass-card" style={{ padding: '30px' }}>
            <CheckCircle2 size={32} className="text-purple" style={{ marginBottom: '16px' }} />
            <h3 className="heading-sm">Statutory PF & ESIC Returns</h3>
            <p className="text-muted text-sm" style={{ marginTop: '8px' }}>Auto-generated ECR files for monthly PF portal upload.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollPage;
