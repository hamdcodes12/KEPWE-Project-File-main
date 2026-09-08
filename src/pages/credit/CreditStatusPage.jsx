import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Search, 
  Phone, 
  Mail, 
  Building2, 
  Calendar, 
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';
import './CreditStatusPage.css';

const CreditStatusPage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialId = searchParams.get('id') || 'KC-849201';

  const [searchId, setSearchId] = useState(initialId);
  const [appData, setAppData] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('kepwe_active_loan_application');
      if (saved) {
        setAppData(JSON.parse(saved));
      } else {
        // Sample default data if direct visit
        setAppData({
          trackingId: initialId,
          submittedAt: '23 Aug 2026, 02:30 PM',
          loanAmount: 250000,
          purpose: 'Home Expenses',
          lender: 'Axis Finance Partner',
          tenure: 24,
          emi: 11590,
          interestRate: 10.49,
          applicantName: 'Your name',
          mobile: '933477XXXX',
          currentStage: 3,
          statusHistory: [
            { stage: 1, title: 'Application Received', timestamp: '23 Aug 2026, 02:30 PM', completed: true },
            { stage: 2, title: 'Digital KYC & Income Verification', timestamp: '23 Aug 2026, 02:32 PM', completed: true },
            { stage: 3, title: 'Lender Credit Assessment', timestamp: 'In Progress (Expected by 06:00 PM)', active: true },
            { stage: 4, title: 'Sanction Letter & e-Agreement', timestamp: 'Upcoming', pending: true },
            { stage: 5, title: 'Direct Bank Disbursal', timestamp: 'Upcoming', pending: true }
          ]
        });
      }
    } catch (e) {
      console.warn(e);
    }
  }, [initialId]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    // Keep or refresh data
  };

  return (
    <div className="credit-status-wrapper">
      
      {/* ── Sub Navigation ── */}
      <div className="status-subnav">
        <div className="container subnav-container">
          <Link to="/credit" className="subnav-back-link">
            <ArrowLeft size={16} />
            <span>Kepwe Credit Home</span>
          </Link>
          <div className="subnav-brand">
            <span className="brand-dot" />
            <span>Application Journey Tracker</span>
          </div>
          <div className="subnav-trust-badge">
            <Clock size={14} color="#214ECF" />
            <span>Live Status Updates</span>
          </div>
        </div>
      </div>

      <div className="container status-main-content">

        {/* ── Search Track Bar ── */}
        <div className="tracker-search-card">
          <div className="search-info">
            <h1 className="tracker-headline">Track Your Credit Journey</h1>
            <p className="tracker-subhead">
              Enter your Application Tracking ID to inspect real-time verification and lender review progress.
            </p>
          </div>

          <form onSubmit={handleSearch} className="tracker-search-form">
            <div className="track-input-wrap">
              <Search size={18} color="#214ECF" strokeWidth={2} />
              <input
                type="text"
                placeholder="e.g. KC-849201"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="track-id-input"
              />
            </div>
            <button type="submit" className="btn-track-submit">
              Track Application
            </button>
          </form>
        </div>

        {appData && (
          <div className="status-detail-grid animate-fadeIn">
            
            {/* Left: Journey Timeline */}
            <div className="timeline-card">
              <div className="timeline-head">
                <div className="t-badge">
                  <span className="live-indicator-dot" />
                  <span>ACTIVE JOURNEY</span>
                </div>
                <h3 className="t-title">Application Status</h3>
                <span className="t-sub">Reference ID: <strong>{appData.trackingId}</strong></span>
              </div>

              <div className="vertical-timeline">
                
                {/* Stage 1 */}
                <div className="timeline-node done">
                  <div className="node-marker">
                    <CheckCircle2 size={18} color="#FFFFFF" />
                  </div>
                  <div className="node-content">
                    <h4 className="node-title">01 · Application Received</h4>
                    <p className="node-desc">Digital submission received and recorded securely.</p>
                    <span className="node-time">Completed</span>
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="timeline-node done">
                  <div className="node-marker">
                    <CheckCircle2 size={18} color="#FFFFFF" />
                  </div>
                  <div className="node-content">
                    <h4 className="node-title">02 · Digital KYC & Verification</h4>
                    <p className="node-desc">Identity, PAN, and Aadhaar verification successfully processed.</p>
                    <span className="node-time">Completed</span>
                  </div>
                </div>

                {/* Stage 3 */}
                <div className="timeline-node active">
                  <div className="node-marker">
                    <span className="pulse-circle" />
                  </div>
                  <div className="node-content">
                    <h4 className="node-title">03 · Lender Credit Review</h4>
                    <p className="node-desc">
                      Underwriter and algorithm evaluating income profile with <strong>{appData.lender}</strong>.
                    </p>
                    <span className="node-time text-blue font-bold">In Progress · Expected today</span>
                  </div>
                </div>

                {/* Stage 4 */}
                <div className="timeline-node pending">
                  <div className="node-marker">
                    <span className="empty-dot" />
                  </div>
                  <div className="node-content">
                    <h4 className="node-title">04 · Sanction Decision & Terms</h4>
                    <p className="node-desc">Review your official sanction letter and complete digital agreement.</p>
                    <span className="node-time">Pending Stage 3</span>
                  </div>
                </div>

                {/* Stage 5 */}
                <div className="timeline-node pending">
                  <div className="node-marker">
                    <span className="empty-dot" />
                  </div>
                  <div className="node-content">
                    <h4 className="node-title">05 · Direct Disbursal</h4>
                    <p className="node-desc">Funds transferred directly into your registered bank account.</p>
                    <span className="node-time">Final Step</span>
                  </div>
                </div>

              </div>

              <div className="timeline-footer-help">
                <HelpCircle size={16} color="#667085" />
                <span>
                  Questions regarding your application? Contact our dedicated priority support desk.
                </span>
              </div>
            </div>

            {/* Right: Loan Application Summary */}
            <div className="app-summary-card">
              <div className="sum-head-row">
                <div>
                  <span className="sum-tag">LOAN DETAILS</span>
                  <h3 className="sum-title">₹{appData.loanAmount.toLocaleString('en-IN')}</h3>
                  <span className="sum-lender-name">{appData.lender}</span>
                </div>
                <div className="status-pill-green">Active Review</div>
              </div>

              <div className="sum-breakdown-list">
                <div className="b-item">
                  <span className="b-lbl">Applicant</span>
                  <span className="b-val">{appData.applicantName}</span>
                </div>
                <div className="b-item">
                  <span className="b-lbl">Tenure</span>
                  <span className="b-val">{appData.tenure} Months</span>
                </div>
                <div className="b-item">
                  <span className="b-lbl">Interest Rate</span>
                  <span className="b-val text-blue">{appData.interestRate}% p.a.</span>
                </div>
                <div className="b-item highlight">
                  <span className="b-lbl">Estimated Monthly EMI</span>
                  <span className="b-val text-blue">₹{appData.emi.toLocaleString('en-IN')}/mo</span>
                </div>
                <div className="b-item">
                  <span className="b-lbl">Loan Purpose</span>
                  <span className="b-val">{appData.purpose}</span>
                </div>
              </div>

              <div className="support-quick-box">
                <h4 className="sup-title">Need Immediate Help?</h4>
                <div className="sup-channels">
                  <a href="tel:+918001234567" className="sup-channel-btn">
                    <Phone size={15} /> Call Support
                  </a>
                  <Link to="/contact" className="sup-channel-btn">
                    <Mail size={15} /> Message Desk
                  </Link>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};

export default CreditStatusPage;
