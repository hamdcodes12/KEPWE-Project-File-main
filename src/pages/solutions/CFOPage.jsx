import React from 'react';
import { TrendingUp, PieChart, ShieldCheck, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const CFOPage = () => {
  const navigate = useNavigate();

  return (
    <div className="solutions-page section-padding">
      <div className="container">
        <div className="solutions-hero text-center" style={{ maxWidth: '800px', margin: '0 auto 60px' }}>
          <div className="badge badge-blue" style={{ marginBottom: '16px' }}>
            <TrendingUp size={14} /> VIRTUAL CFO & STRATEGIC ADVISORY
          </div>
          <h1 className="heading-xl">
            Strategic Financial Leadership <span className="text-gradient">at 1/5th the Cost</span>
          </h1>
          <p className="text-lg text-muted" style={{ marginTop: '16px' }}>
            Get a senior Chartered Accountant to lead your cash flow forecasting, unit economics, fundraising deck, and board MIS.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
            <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
              Book CFO Consultation <ArrowRight size={18} />
            </Button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div className="glass-card" style={{ padding: '30px' }}>
            <PieChart size={32} className="text-blue" style={{ marginBottom: '16px' }} />
            <h3 className="heading-sm">Board MIS & Reporting</h3>
            <p className="text-muted text-sm" style={{ marginTop: '8px' }}>Executive financial dashboards tailored for investors and founders.</p>
          </div>
          <div className="glass-card" style={{ padding: '30px' }}>
            <TrendingUp size={32} className="text-success" style={{ marginBottom: '16px' }} />
            <h3 className="heading-sm">Cash Flow & Runway Modeling</h3>
            <p className="text-muted text-sm" style={{ marginTop: '8px' }}>Prevent cash crunch with 12-month predictive runway analysis.</p>
          </div>
          <div className="glass-card" style={{ padding: '30px' }}>
            <ShieldCheck size={32} className="text-purple" style={{ marginBottom: '16px' }} />
            <h3 className="heading-sm">Tax Planning & Optimization</h3>
            <p className="text-muted text-sm" style={{ marginTop: '8px' }}>Maximize tax savings and legal R&D exemptions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CFOPage;
