import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowLeft, Check, FileText, LoaderCircle, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../../api/client';
import './CreditHealthPage.css';

const FACTORS = [
  ['paymentHistory', 'Payment history', '35%'],
  ['creditUtilisation', 'Credit utilisation', '30%'],
  ['accountStatus', 'Account status', '20%'],
  ['accountAge', 'Account age', '10%'],
  ['enquiries', 'Credit enquiries', '5%'],
];

function formatMoney(amount) {
  if (amount === null || amount === undefined) return 'Unavailable';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}

function CreditHealthPage() {
  const [report, setReport] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/credit/report').then((response) => {
      if (!active) return;
      if (!response.ok) setError(response.data?.error || 'Could not load your saved report.');
      else setReport(response.data.report);
    }).catch(() => {
      if (active) setError('Could not load your saved report. Check your connection and try again.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a PDF credit report first.');
      return;
    }
    setError('');
    setNotice('');
    setProcessing(true);
    const formElement = event.currentTarget;
    const form = new FormData();
    form.append('report', file);
    try {
      const response = await apiFetch('/credit/report', { method: 'POST', body: form });
      if (!response.ok) throw new Error(response.data?.error || 'Report processing failed.');
      setReport(response.data.report);
      setFile(null);
      formElement.reset();
      setNotice('Your report has been processed and saved securely to your account.');
    } catch (uploadError) {
      setError(uploadError.message || 'Report processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete your uploaded report and its extracted analysis?')) return;
    setError('');
    setNotice('');
    try {
      const response = await apiFetch('/credit/report', { method: 'DELETE' });
      if (!response.ok) {
        setError(response.data?.error || 'Could not delete the saved report.');
        return;
      }
      setReport(null);
      setNotice('Your report and extracted analysis have been deleted.');
    } catch {
      setError('Could not delete the saved report. Check your connection and try again.');
    }
  };

  const score = report?.score;
  const scoreAngle = score?.value === null || score?.value === undefined ? 0 : ((score.value - 300) / 600) * 360;
  const accountData = report?.normalizedData;

  return (
    <main className="credit-health-page">
      <div className="credit-health-shell">
        <nav className="credit-health-nav" aria-label="Credit navigation">
          <Link to="/credit/workspace"><ArrowLeft size={16} /> Credit workspace</Link>
          <span><ShieldCheck size={15} /> Private report analysis</span>
        </nav>

        <header className="credit-health-heading">
          <div className="credit-health-eyebrow"><Activity size={15} /> KEPWE CREDIT</div>
          <h1>Understand your credit health.</h1>
          <p>Upload your credit report to see the accounts, payment signals, and factors behind your Kepwe Credit Health Score.</p>
        </header>

        <section className="credit-upload-section" aria-labelledby="upload-title">
          <div className="credit-upload-copy">
            <span className="credit-section-index">01</span>
            <div>
              <h2 id="upload-title">Upload a credit report</h2>
              <p>PDF only, up to 10 MB and 20 pages. Text is extracted first; scanned pages are read with on-server OCR.</p>
            </div>
          </div>
          <form className="credit-upload-form" onSubmit={handleUpload}>
            <label className="credit-file-picker">
              <FileText size={19} />
              <span>{file?.name || 'Choose PDF report'}</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  const chosen = event.target.files?.[0] || null;
                  setFile(chosen);
                  setError('');
                  if (chosen && chosen.size > 10 * 1024 * 1024) setError('Choose a PDF smaller than 10 MB.');
                  else if (chosen && chosen.type && chosen.type !== 'application/pdf') setError('Choose a PDF file.');
                }}
              />
            </label>
            <button className="credit-upload-button" type="submit" disabled={processing || !file || (file && file.size > 10 * 1024 * 1024)}>
              {processing ? <LoaderCircle className="credit-spin" size={17} /> : <Upload size={17} />}
              {processing ? 'Processing report' : report ? 'Replace report' : 'Analyse report'}
            </button>
          </form>
          <p className="credit-privacy-note"><ShieldCheck size={14} /> Your report is stored against your account, processed on Kepwe servers, and never sent to a credit bureau or external scoring API.</p>
        </section>

        {error && <p className="credit-message credit-error" role="alert"><AlertTriangle size={17} /> {error}</p>}
        {notice && <p className="credit-message credit-success" role="status"><Check size={17} /> {notice}</p>}
        {loading && <div className="credit-loading"><LoaderCircle className="credit-spin" size={20} /> Loading saved analysis</div>}

        {!loading && report && (
          <div className="credit-results" aria-live="polite">
            <section className="credit-score-section" aria-labelledby="score-title">
              <div className="credit-score-summary">
                <div className="credit-score-ring" style={{ '--score-angle': `${scoreAngle}deg` }}>
                  <div className="credit-score-ring-inner">
                    {score?.value === null || score?.value === undefined ? <span className="credit-score-na">Not available</span> : <><strong>{score.value}</strong><span>out of 900</span></>}
                  </div>
                </div>
                <div className="credit-score-copy">
                  <span className="credit-section-index">02</span>
                  <p className="credit-score-label">{score?.name || 'Kepwe Credit Health Score'}</p>
                  <h2 id="score-title">{score?.band || 'Unavailable'}</h2>
                  <p>{score?.value === null || score?.value === undefined ? 'This report did not contain readable values for a score.' : `Based on ${score.observedWeight}% of the published factor weights available in this report.`}</p>
                  <span className="credit-report-meta">{report.fileName} · {report.extractionMethod === 'OCR' ? 'OCR processed' : 'Text extracted'} · {formatDate(report.processedAt)}</span>
                </div>
              </div>
              <div className="credit-score-method"><strong>How this score works</strong><p>{score?.method}</p></div>
            </section>

            <section className="credit-section" aria-labelledby="factors-title">
              <div className="credit-section-heading"><div><span className="credit-section-index">03</span><h2 id="factors-title">Factors affecting your score</h2></div></div>
              <div className="credit-factor-list">
                {FACTORS.map(([key, label, baseWeight]) => {
                  const factor = score?.factors?.find((item) => item.key === key);
                  return (
                    <article className="credit-factor" key={key}>
                      <div className="credit-factor-top"><h3>{label}</h3><span>{factor ? `${factor.effectiveWeightPercent}% applied` : 'Unavailable'}</span></div>
                      {factor ? <><div className="credit-factor-track"><span style={{ width: `${factor.scorePercent}%` }} /></div><p>{factor.detail}</p><small>Base weight {baseWeight}</small></> : <p className="credit-unavailable">Not available in this report; this factor was not included in the score.</p>}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="credit-section" aria-labelledby="accounts-title">
              <div className="credit-section-heading"><div><span className="credit-section-index">04</span><h2 id="accounts-title">Detected accounts</h2></div><span>{accountData?.accountCount ?? 'Unavailable'} identified</span></div>
              {accountData?.accounts?.length ? (
                <div className="credit-accounts-table-wrap">
                  <table className="credit-accounts-table">
                    <thead><tr><th>Account type</th><th>Lender</th><th>Status</th><th>Credit limit</th><th>Outstanding</th></tr></thead>
                    <tbody>{accountData.accounts.map((account, index) => (
                      <tr key={`${account.accountType}-${account.lender || index}-${index}`}>
                        <td>{account.accountType.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</td>
                        <td>{account.lender || 'Unavailable'}</td>
                        <td>{account.status ? account.status.replaceAll('_', ' ') : 'Unavailable'}</td>
                        <td>{formatMoney(account.creditLimit)}</td>
                        <td>{formatMoney(account.outstandingBalance)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="credit-empty-value">No individual account rows could be confidently identified.</p>}
              <div className="credit-metric-strip">
                <div><span>Payment history markers</span><strong>{accountData?.dpdHistory?.length ?? 'Unavailable'}</strong></div>
                <div><span>Credit utilisation</span><strong>{accountData?.creditUtilisationPercent === null || accountData?.creditUtilisationPercent === undefined ? 'Unavailable' : `${accountData.creditUtilisationPercent}%`}</strong></div>
                <div><span>Credit enquiries</span><strong>{accountData?.enquiryCount ?? 'Unavailable'}</strong></div>
                <div><span>Oldest account</span><strong>{accountData?.oldestAccountAgeMonths === null || accountData?.oldestAccountAgeMonths === undefined ? 'Unavailable' : `${accountData.oldestAccountAgeMonths} months`}</strong></div>
                <div><span>Total outstanding</span><strong>{formatMoney(accountData?.totalOutstandingBalance)}</strong></div>
              </div>
            </section>

            <section className="credit-guidance-grid">
              <div className="credit-guidance-block credit-warnings">
                <h2><AlertTriangle size={17} /> Warnings</h2>
                {report.warnings?.length ? <ul>{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>No extraction warnings were found.</p>}
              </div>
              <div className="credit-guidance-block credit-recommendations">
                <h2><Check size={17} /> Recommended next steps</h2>
                <ul>{(report.recommendations || []).map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </section>

            <footer className="credit-report-footer">
              <p>This is Kepwe’s educational analysis of the information readable in your uploaded report. It is not a lender decision. Verify extracted values against the original PDF.</p>
              <button type="button" className="credit-delete-button" onClick={handleDelete}><Trash2 size={15} /> Delete report</button>
            </footer>
          </div>
        )}

        {!loading && !report && !error && <div className="credit-empty-state"><FileText size={22} /><h2>No report analysed yet</h2><p>Upload your own credit report PDF to see the values we can read and score.</p></div>}
      </div>
    </main>
  );
}

export default CreditHealthPage;