import React, { useState } from 'react';
import { Zap, CheckCircle2, Calculator, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const GSTPage = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState(100); // Thousands
  const [gstRate, setGstRate] = useState(18);

  const calculatedTax = (sales * 1000 * gstRate) / 100;

  return (
    <div className="solutions-page section-padding">
      <div className="container">
        
        <div className="solutions-hero text-center" style={{ maxWidth: '800px', margin: '0 auto 60px' }}>
          <div className="badge badge-blue" style={{ marginBottom: '16px' }}>
            <Zap size={14} /> COMPLETE GST & TAX FILING
          </div>
          <h1 className="heading-xl">
            100% ITC Reconciliation & <span className="text-gradient">Automated GST Filings</span>
          </h1>
          <p className="text-lg text-muted" style={{ marginTop: '16px' }}>
            File GSTR-1, GSTR-3B, CMP-08, and GSTR-9. Claim 100% Input Tax Credit without mismatch risks.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
            <Button variant="primary" size="lg" onClick={() => navigate('/login')}>
              File GST Now <ArrowRight size={18} />
            </Button>
          </div>
        </div>

        {/* Live Interactive GST Calculator Snippet */}
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto 60px', padding: '24px 16px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Calculator size={20} className="text-blue" />
            <h3 className="heading-sm">Quick GST Tax Calculator</h3>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>
              Monthly Sales / Invoice Amount (₹): <strong>₹{(sales * 1000).toLocaleString('en-IN')}</strong>
            </label>
            <input 
              type="range" 
              min="10" 
              max="1000" 
              value={sales} 
              onChange={(e) => setSales(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-accent-blue)' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="text-sm font-semibold" style={{ display: 'block', marginBottom: '8px' }}>
              GST Rate (%):
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[5, 12, 18, 28].map((rate) => (
                <button 
                  key={rate} 
                  onClick={() => setGstRate(rate)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: gstRate === rate ? 'var(--color-accent-blue)' : 'var(--color-bg-secondary)',
                    color: gstRate === rate ? '#ffffff' : 'var(--color-text-primary)',
                    fontWeight: '600'
                  }}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '16px', background: 'var(--color-bg-secondary)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-sm text-muted">Estimated Tax Amount:</span>
            <span className="heading-sm text-gradient">₹{calculatedTax.toLocaleString('en-IN')}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GSTPage;
