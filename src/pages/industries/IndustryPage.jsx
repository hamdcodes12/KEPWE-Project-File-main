import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, ArrowRight, ShieldCheck, Zap, Users, TrendingUp, ShoppingCart, Globe, Factory } from 'lucide-react';
import Button from '../../components/ui/Button';

const INDUSTRY_DATA = {
  startups: {
    title: 'Operating OS for High-Growth Startups & Founders',
    subtitle: 'From Private Limited incorporation and ESOP structuring to cap-table management and monthly board MIS.',
    icon: Zap,
    badge: 'STARTUP & FOUNDERS SUITE',
    features: [
      'DPIIT Startup India Recognition & Tax Exemption under 80-IAC',
      'ESOP Scheme Drafting & Statutory Cap-table maintenance',
      'Investor Due-Diligence Readiness & Shareholder Agreements',
      'Monthly Investor MIS & Runway Burn Analytics'
    ]
  },
  'small-business': {
    title: 'Simplified Bookkeeping & Tax for Small Businesses',
    subtitle: 'Hassle-free GST, billing, and annual income tax filing designed for local businesses and agencies.',
    icon: Building2,
    badge: 'SMALL BUSINESS OPERATING OS',
    features: [
      'Automated GST Billing & E-way Bill Generation',
      'Income Tax Return (ITR-3 & ITR-4) filing for proprietors',
      'Dedicated CA Manager for daily accounting questions',
      'Zero-Penalty Compliance Calendar reminders'
    ]
  },
  smes: {
    title: 'Enterprise Grade Finance & Compliance for SMEs',
    subtitle: 'Scale operations smoothly with Virtual CFO guidance, automated payroll, and multi-branch GST filings.',
    icon: TrendingUp,
    badge: 'SME & MID-MARKET SUITE',
    features: [
      'Multi-state GST registration & state-wise reconciliation',
      'Statutory Audit & Tax Audit coordination',
      'Automated PF, ESIC & Professional Tax monthly returns',
      'Working Capital Loan facilitation up to ₹5 Crore'
    ]
  },
  ecommerce: {
    title: 'Automated Tax & Reconciliation for E-Commerce Sellers',
    subtitle: 'Seamless integration with Amazon, Flipkart, Shopify & Meesho. Auto-reconcile TCS, TDS & Sales GST.',
    icon: ShoppingCart,
    badge: 'E-COMMERCE SELLER PLATFORM',
    features: [
      'Automatic Amazon / Flipkart GSTR-8 TCS reconciliation',
      'E-invoicing & B2C payment gateway tax reporting',
      'Inventory accounting & COGS estimation',
      '100% ITC claim on platform commission & ad spends'
    ]
  },
  traders: {
    title: 'Complete Compliance for Traders & Wholesalers',
    subtitle: 'Manage stock accounting, purchase GST matching, and working capital credit seamlessly.',
    icon: Building2,
    badge: 'TRADERS & WHOLESALERS PLATFORM',
    features: [
      'GSTR-2B purchase reconciliation to prevent ITC loss',
      'E-Way bill creation & logistics compliance',
      'Collateral-free trade finance & bill discounting'
    ]
  },
  manufacturing: {
    title: 'Industrial & Manufacturing Enterprise OS',
    subtitle: 'Factory Act compliance, ESIC/PF worker management, and raw material job-work tax accounting.',
    icon: Factory,
    badge: 'MANUFACTURING INDUSTRY SUITE',
    features: [
      'Job work GST compliance (Form ITC-04)',
      'Factory Act returns & labor law registration',
      'Machinery depreciation & capital expenditure tax claims'
    ]
  },
  exporters: {
    title: 'Global Trade & Export Compliance System',
    subtitle: 'GST Refund processing under LUT, FEMA compliance, and FIRC documentation support.',
    icon: Globe,
    badge: 'EXPORTERS & GLOBAL TRADE',
    features: [
      'Instant GST Refund claim without payment of tax under LUT',
      'FEMA & RBI EDPMS / IDPMS clearance support',
      'Import Export Code (IEC) registration & annual renewal'
    ]
  }
};

const IndustryPage = () => {
  const { type = 'startups' } = useParams();
  const navigate = useNavigate();

  const data = INDUSTRY_DATA[type] || INDUSTRY_DATA.startups;
  const IconComponent = data.icon;

  return (
    <div className="industry-page section-padding">
      <div className="container">
        
        {/* Hero Header */}
        <div className="solutions-hero text-center" style={{ maxWidth: '800px', margin: '0 auto 60px' }}>
          <div className="badge badge-blue" style={{ marginBottom: '16px' }}>
            <IconComponent size={14} /> {data.badge}
          </div>
          <h1 className="heading-xl">
            {data.title}
          </h1>
          <p className="text-lg text-muted" style={{ marginTop: '16px' }}>
            {data.subtitle}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
            <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
              Get Started for {type.toUpperCase()} <ArrowRight size={18} />
            </Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/free-compliance-check')}>
              Free Audit Check
            </Button>
          </div>
        </div>

        {/* Industry Features List */}
        <div className="glass-card" style={{ maxWidth: '840px', margin: '0 auto 60px', padding: '40px' }}>
          <h2 className="heading-md text-gradient" style={{ marginBottom: '24px' }}>
            What KEPWE Delivers for Your Industry:
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {data.features.map((feat, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                <CheckCircle2 size={20} className="text-success" style={{ flexShrink: 0 }} />
                <span className="text-md" style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="glass-card text-center" style={{ padding: '40px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.08), rgba(0, 229, 255, 0.05))' }}>
          <h3 className="heading-lg">Tailored Operating OS for Your Business</h3>
          <p className="text-muted" style={{ margin: '12px 0 24px' }}>Get a custom compliance roadmap & CA consultation in less than 2 minutes.</p>
          <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
            Schedule CA Call
          </Button>
        </div>

      </div>
    </div>
  );
};

export default IndustryPage;
