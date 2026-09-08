import React from 'react';
import { ShieldCheck, CheckCircle2, Clock, FileText, ArrowRight, Zap, Award, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const CompliancePage = () => {
  const navigate = useNavigate();

  return (
    <div className="solutions-page section-padding">
      <div className="container">
        
        {/* Header Hero */}
        <div className="solutions-hero text-center" style={{ maxWidth: '800px', margin: '0 auto 60px' }}>
          <div className="badge badge-blue" style={{ marginBottom: '16px' }}>
            <ShieldCheck size={14} /> MCA & ANNUAL COMPLIANCE PLATFORM
          </div>
          <h1 className="heading-xl">
            Never Miss a ROC Filing with <span className="text-gradient">Zero-Penalty Guarantee</span>
          </h1>
          <p className="text-lg text-muted" style={{ marginTop: '16px' }}>
            End-to-end secretarial compliance for Private Limited, LLP, OPC, and Public Companies. Managed by expert Company Secretaries (CS) & CAs.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
              Get Started <ArrowRight size={18} />
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/free-compliance-check')}>
              Free Audit Check
            </Button>
          </div>
        </div>

        {/* Feature Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '60px' }}>
          
          <div className="glass-card" style={{ padding: '30px' }}>
            <div className="item-icon blue" style={{ width: '44px', height: '44px', borderRadius: '12px', marginBottom: '16px' }}>
              <FileText size={22} />
            </div>
            <h3 className="heading-sm">Annual ROC Filings</h3>
            <p className="text-muted text-sm" style={{ marginTop: '8px' }}>
              Automated filing of AOC-4, MGT-7, ADT-1 and DIR-3 KYC with automated MCA portal sync.
            </p>
          </div>

          <div className="glass-card" style={{ padding: '30px' }}>
            <div className="item-icon green" style={{ width: '44px', height: '44px', borderRadius: '12px', marginBottom: '16px' }}>
              <Clock size={22} />
            </div>
            <h3 className="heading-sm">Board Meeting Minutes</h3>
            <p className="text-muted text-sm" style={{ marginTop: '8px' }}>
              Drafting & maintenance of statutory registers, board resolutions, and AGM notices.
            </p>
          </div>

          <div className="glass-card" style={{ padding: '30px' }}>
            <div className="item-icon purple" style={{ width: '44px', height: '44px', borderRadius: '12px', marginBottom: '16px' }}>
              <Award size={22} />
            </div>
            <h3 className="heading-sm">Director Compliance</h3>
            <p className="text-muted text-sm" style={{ marginTop: '8px' }}>
              DIR-3 KYC, Director Identification Number (DIN) updates, and annual disclosures.
            </p>
          </div>

        </div>

        {/* CTA Banner */}
        <div className="glass-card" style={{ padding: '40px', background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.08), rgba(0, 229, 255, 0.04))', textAlign: 'center', borderRadius: '24px' }}>
          <h2 className="heading-lg">Ready to automate your MCA filings?</h2>
          <p className="text-muted" style={{ margin: '12px 0 24px' }}>Join 50,000+ businesses using KEPWE for hassle-free compliance.</p>
          <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
            Schedule CA Consultation
          </Button>
        </div>

      </div>
    </div>
  );
};

export default CompliancePage;
