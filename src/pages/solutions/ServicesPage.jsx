import React from 'react';
import { Building2, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const ServicesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="solutions-page section-padding">
      <div className="container">
        <div className="solutions-hero text-center" style={{ maxWidth: '800px', margin: '0 auto 60px' }}>
          <div className="badge badge-blue" style={{ marginBottom: '16px' }}>
            <Building2 size={14} /> REGISTRATION & LEGAL SERVICES
          </div>
          <h1 className="heading-xl">
            Incorporate Your Business in <span className="text-gradient">3 Simple Steps</span>
          </h1>
          <p className="text-lg text-muted" style={{ marginTop: '16px' }}>
            Pvt Ltd Incorporation, LLP Registration, Trademark Filing, Startup India Recognition, and ISO Certifications.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
            <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
              Register Business Now <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServicesPage;
