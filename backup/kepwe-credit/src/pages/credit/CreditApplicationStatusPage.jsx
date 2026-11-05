import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, AlertCircle, ArrowLeft, CheckCircle2, Clock, FileText, LoaderCircle, ShieldCheck, XCircle } from 'lucide-react';
import { apiFetch } from '../../api/client';
import './CreditApplicationStatusPage.css';

const STATUS_LABEL = {
  pending: 'Application Under Review',
  approved: 'Application Approved',
  rejected: 'Application Rejected',
};
const formatDate = (date) => date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : '—';
const formatAmount = (amount) => amount == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(amount));

export default function CreditApplicationStatusPage() {
  const { applicationId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(`/credit/applications/${encodeURIComponent(applicationId)}`);
      if (!response.ok) {
        setError(response.data?.error || 'Could not load this application.');
        return;
      }
      setData(response.data);
      setError('');
    } catch {
      setError('Could not load this application. Check your connection and try again.');
    }
  }, [applicationId]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (active) await load();
      if (active) setLoading(false);
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [load]);

  if (loading) return <main className="credit-application-status-page"><div className="credit-application-status-shell"><div className="credit-application-status-loading"><LoaderCircle className="credit-status-spin" /> Loading application status…</div></div></main>;
  if (error && !data) return <main className="credit-application-status-page"><div className="credit-application-status-shell"><div className="credit-application-status-error"><AlertCircle /> <p>{error}</p></div><Link to="/credit/workspace">Back to Credit workspace</Link></div></main>;

  const application = data?.application;
  const currentStatus = application?.status || 'pending';
  const StatusIcon = currentStatus === 'approved' ? CheckCircle2 : currentStatus === 'rejected' ? XCircle : Clock;
  const submittedEvent = data?.events?.[0];

  return (
    <main className="credit-application-status-page">
      <div className="credit-application-status-shell">
        <nav className="credit-application-status-nav" aria-label="Application navigation">
          <Link to="/credit/workspace"><ArrowLeft size={16} /> Credit workspace</Link>
          <span><ShieldCheck size={15} /> Private application status</span>
        </nav>
        <header className="credit-application-status-heading">
          <span className="credit-application-status-eyebrow"><Activity size={15} /> KEPWE CREDIT</span>
          <h1>Application status</h1>
          <p>Your application record and review timeline.</p>
        </header>

        <section className={`credit-application-status-card status-${currentStatus}`} aria-live="polite">
          <div className="credit-application-status-icon"><StatusIcon size={26} /></div>
          <div><span className="credit-application-status-kicker">CURRENT STATUS</span><h2>{STATUS_LABEL[currentStatus] || STATUS_LABEL.pending}</h2></div>
          <div className="credit-application-status-id"><span>Application ID</span><strong>{application.applicationId}</strong></div>
        </section>
        {error && <p className="credit-application-status-refresh-error" role="status">{error} Showing the last saved status.</p>}

        <section className="credit-application-status-details">
          <div><span>Submitted</span><strong>{formatDate(application.submittedAt)}</strong></div>
          <div><span>Requested amount</span><strong>{formatAmount(application.requestedAmount)}</strong></div>
          <div><span>Application type</span><strong>{String(application.loanType).replaceAll('_', ' ')}</strong></div>
          <div><span>Business</span><strong>{application.businessName || 'Not provided'}</strong></div>
        </section>

        <section className="credit-application-timeline-card">
          <h2>Application timeline</h2>
          <ol className="credit-application-timeline">
            {(data?.events || []).map((event, index) => (
              <li key={`${event.created_at}-${index}`} className={`credit-application-timeline-event ${index === data.events.length - 1 ? 'is-current' : ''}`}>
                <span className="credit-application-timeline-dot">{event.to_status === 'approved' ? <CheckCircle2 size={15} /> : event.to_status === 'rejected' ? <XCircle size={15} /> : <Clock size={15} />}</span>
                <div><strong>{index === 0 ? 'Submitted' : STATUS_LABEL[event.to_status] || 'Application submitted'}</strong><time>{formatDate(event.created_at)}</time></div>
              </li>
            ))}
            {!submittedEvent && <li className="credit-application-timeline-empty">No timeline events are available.</li>}
          </ol>
          <p className="credit-application-review-disclosure">This is KEPWE’s application review status. It is not a lender sanction, loan offer, or guarantee of funding. Lending integrations remain pending.</p>
        </section>

        {!!data?.documents?.length && <section className="credit-application-documents-card"><h2>Submitted documents</h2><ul>{data.documents.map((document) => <li key={document.id}><FileText size={16} /><span>{document.original_filename}</span><small>{Math.ceil(document.file_size_bytes / 1024)} KB</small></li>)}</ul></section>}
      </div>
    </main>
  );
}
