import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, FileText, ShieldCheck, UploadCloud } from 'lucide-react';
import { apiFetch } from '../../api/client';
import './CreditApplicationPage.css';

const DOCUMENT_LIMIT = 25 * 1024 * 1024;
const CreditApplicationPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ loanType: 'working_capital', requestedAmount: '', purpose: '', businessName: '', annualTurnover: '' });
  const [documents, setDocuments] = useState([]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const chooseDocuments = (event) => {
    const files = Array.from(event.target.files || []);
    setError('');
    if (files.length > 5) {
      setDocuments([]);
      setError('Upload no more than five documents.');
    } else if (files.some((file) => !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))) {
      setDocuments([]);
      setError('Documents must be PDF, JPG, or PNG files.');
    } else if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setDocuments([]);
      setError('Each document must be 10 MB or smaller.');
    } else if (files.reduce((total, file) => total + file.size, 0) > DOCUMENT_LIMIT) {
      setDocuments([]);
      setError('Combined document size must be 25 MB or less.');
    } else {
      setDocuments(files);
    }
    event.target.value = '';
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!consent) {
      setError('Confirm the application review and document handling notice before submitting.');
      return;
    }
    setSubmitting(true);
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    documents.forEach((file) => body.append('documents', file));
    try {
      const response = await apiFetch('/credit/applications', { method: 'POST', body });
      if (!response.ok) throw new Error(response.data?.error || 'Could not submit your application.');
      navigate(`/credit/application/status/${response.data.application.id}`, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Could not submit your application. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="credit-application-page">
      <div className="credit-application-shell">
        <nav className="credit-application-nav" aria-label="Credit application navigation">
          <Link to="/credit/workspace"><ArrowLeft size={16} /> Credit workspace</Link>
          <span><ShieldCheck size={15} /> Secure application submission</span>
        </nav>
        <header className="credit-application-heading">
          <span className="credit-application-eyebrow">KEPWE CREDIT</span>
          <h1>Submit a loan application</h1>
          <p>Your request will be recorded for KEPWE application review. No lender is connected, and submitting does not mean approval, an offer, or loan sanction.</p>
        </header>

        <form className="credit-application-form" onSubmit={submit}>
          {error && <p className="credit-application-error" role="alert"><AlertCircle size={17} /> {error}</p>}
          <div className="credit-application-field-grid">
            <label>Loan purpose
              <select name="loanType" value={form.loanType} onChange={change} required>
                <option value="working_capital">Working capital</option>
                <option value="term_loan">Term loan</option>
                <option value="invoice_discounting">Invoice discounting</option>
                <option value="equipment_finance">Equipment finance</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>Requested amount (₹)
              <input name="requestedAmount" type="number" min="1" max="100000000" step="1" value={form.requestedAmount} onChange={change} required />
            </label>
            <label className="credit-application-full-width">How will the funds be used?
              <textarea name="purpose" rows="4" minLength="10" maxLength="2000" value={form.purpose} onChange={change} required />
            </label>
            <label>Business name <span>(optional)</span>
              <input name="businessName" maxLength="255" value={form.businessName} onChange={change} />
            </label>
            <label>Annual business turnover (₹) <span>(optional)</span>
              <input name="annualTurnover" type="number" min="0" max="1000000000000" step="1" value={form.annualTurnover} onChange={change} />
            </label>
          </div>

          <label className="credit-application-document-picker">
            <UploadCloud size={22} />
            <span><strong>Supporting documents (optional)</strong><small>PDF, JPG, or PNG · up to 5 files · 10 MB each · 25 MB total</small></span>
            <input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" multiple onChange={chooseDocuments} />
          </label>
          {documents.length > 0 && <ul className="credit-application-document-list">{documents.map((file) => <li key={`${file.name}-${file.lastModified}`}><FileText size={15} /> {file.name}</li>)}</ul>}

          <label className="credit-application-consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>I authorize KEPWE to store and review the application details and documents I submit for this request. I understand this is an internal application review and is not a lender decision or loan offer.</span>
          </label>
          <div className="credit-application-actions">
            <Link to="/credit/workspace">Cancel</Link>
            <button type="submit" disabled={submitting || !consent}>{submitting ? 'Submitting…' : 'Submit application'} <ArrowRight size={17} /></button>
          </div>
          <p className="credit-application-privacy"><ShieldCheck size={14} /> Application details and files are stored securely and visible only to you and authorized KEPWE administrators.</p>
        </form>
      </div>
    </main>
  );
};

export default CreditApplicationPage;
