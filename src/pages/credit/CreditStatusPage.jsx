import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Activity, Clock, FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import './CreditStatusPage.css';

const APPLICATION_STATUS = { pending: 'Application Under Review', approved: 'Application Approved', rejected: 'Application Rejected' };
const formatSubmittedDate = (date) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(date));

const CreditStatusPage = () => {
  const [applications, setApplications] = useState([]);
  const [applicationError, setApplicationError] = useState('');
  const loadApplications = useCallback(async () => {
    try {
      const response = await apiFetch('/credit/applications');
      if (!response.ok) {
        setApplicationError(response.data?.error || 'Could not load applications.');
        return;
      }
      setApplications(response.data.applications || []);
      setApplicationError('');
    } catch {
      setApplicationError('Could not load applications. Check your connection and try again.');
    }
  }, []);

  useEffect(() => {
    loadApplications();
    const timer = window.setInterval(loadApplications, 5000);
    return () => window.clearInterval(timer);
  }, [loadApplications]);

  return (
  <main className="credit-status-wrapper credit-workspace-page">
    <nav className="credit-workspace-nav" aria-label="Credit workspace navigation">
      <Link to="/credit"><ArrowLeft size={16} /> KEPWE Credit</Link>
      <span><ShieldCheck size={15} /> Your private workspace</span>
    </nav>

    <div className="credit-workspace-content">
      <header className="credit-workspace-heading">
        <div className="credit-workspace-eyebrow"><Activity size={15} /> KEPWE CREDIT</div>
        <h1>Your Credit workspace</h1>
        <p>Credit Health is available now. Upload your own report for a private, factor-by-factor analysis. Loan eligibility and offers require verified lender integrations and are not available yet.</p>
      </header>

      <section className="credit-workspace-cards" aria-label="Credit product status">
        <article className="credit-workspace-card credit-workspace-health">
          <div className="credit-workspace-card-icon"><FileText size={22} /></div>
          <span className="credit-workspace-status">AVAILABLE</span>
          <h2>Credit Health</h2>
          <p>Upload a PDF credit report to see the KEPWE Credit Health Score, score factors, extraction warnings, and recommendations.</p>
          <Link className="credit-workspace-primary-action" to="/credit/consent">Open Credit Health <ArrowRight size={17} /></Link>
        </article>

        <article className="credit-workspace-card credit-workspace-lending">
          <div className="credit-workspace-card-icon"><Clock size={22} /></div>
          <span className="credit-workspace-status">INTEGRATION PENDING</span>
          <h2>Loan eligibility</h2>
          <p>Automated eligibility checks and lender offers require verified RBI-regulated lender integrations. You can submit an application for internal KEPWE review now; it is not a lender decision or offer.</p>
          <Link className="credit-workspace-secondary-action" to="/credit/apply">Submit application for review <ArrowRight size={17} /></Link>
          <Link className="credit-workspace-pending-link" to="/credit#loan-integration-pending">View lending integration status</Link>
        </article>
      </section>

      <section className="credit-workspace-applications" aria-labelledby="credit-workspace-applications-title">
        <div className="credit-workspace-applications-heading"><div><span className="credit-workspace-eyebrow">YOUR RECORDS</span><h2 id="credit-workspace-applications-title">Loan applications</h2></div><Link to="/credit/apply">New application <ArrowRight size={16} /></Link></div>
        {applicationError && <p className="credit-workspace-applications-error" role="alert">{applicationError}</p>}
        {applications.length ? <div className="credit-workspace-application-list">{applications.map((application) => (
          <Link className="credit-workspace-application-row" key={application.id} to={`/credit/application/status/${application.id}`}>
            <span><strong>{application.applicationId}</strong><small>Submitted {formatSubmittedDate(application.submittedAt)}</small></span>
            <span className={`credit-workspace-application-status status-${application.status}`}>{APPLICATION_STATUS[application.status]}</span>
            <ArrowRight size={17} />
          </Link>
        ))}</div> : !applicationError && <p className="credit-workspace-no-applications">You have not submitted an application yet.</p>}
      </section>
    </div>
  </main>
  );
};

export default CreditStatusPage;
