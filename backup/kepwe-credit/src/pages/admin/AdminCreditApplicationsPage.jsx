import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Download, Eye, FileText, LoaderCircle, Mail, Phone, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import { adminFetch, adminTryRefresh, getAdminAccessToken } from '../../api/adminClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const card = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 4px 12px rgba(15,23,42,.03)' };
const button = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 12px', border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer' };
const field = { width: '100%', boxSizing: 'border-box', border: '1px solid #CBD5E1', borderRadius: 8, padding: 10, font: 'inherit' };
const statusLabel = { pending: 'Application Under Review', approved: 'Application Approved', rejected: 'Application Rejected' };
const date = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const money = (value) => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));

export default function AdminCreditApplicationsPage() {
  const [data, setData] = useState({ applications: [], pagination: null });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page, pageSize: 25 });
      if (status) query.set('status', status);
      if (search.trim()) query.set('search', search.trim());
      const response = await adminFetch(`/admin/credit-applications?${query}`);
      if (response.ok) {
        setData(response.data);
        setError('');
      } else setError(response.data?.error || 'Could not load Credit applications.');
    } catch {
      setError('Could not load Credit applications. Check your connection and try again.');
    } finally { setLoading(false); }
  }, [page, status, search]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    setError('');
    try {
      const response = await adminFetch(`/admin/credit-applications/${id}`);
      if (!response.ok) return setError(response.data?.error || 'Could not load application details.');
      setDetail(response.data);
      setRemarks(response.data.application.decisionRemarks || '');
      setNotice('');
    } catch { setError('Could not load application details. Check your connection and try again.'); }
  };

  const decide = async (decision) => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const response = await adminFetch(`/admin/credit-applications/${detail.application.id}/status`, {
        method: 'PATCH', body: { status: decision, remarks },
      });
      if (!response.ok) {
        setError(response.data?.error || `Could not ${decision} this application.`);
        return;
      }
      setNotice(`${statusLabel[decision]} saved.`);
      await Promise.all([load(), openDetail(detail.application.id)]);
    } catch { setError(`Could not ${decision} this application. Check your connection and try again.`); }
    finally { setBusy(false); }
  };

  const downloadDocument = async (document) => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const path = `${API_BASE}/admin/credit-applications/${detail.application.id}/documents/${document.id}`;
      const request = () => fetch(path, { headers: { Authorization: `Bearer ${getAdminAccessToken() || ''}` }, credentials: 'include' });
      let response = await request();
      if (response.status === 401 && await adminTryRefresh()) response = await request();
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Document download failed.');
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = document.original_filename || 'application-document';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(downloadError.message || 'Document download failed.');
    } finally { setBusy(false); }
  };

  const previewDocument = async (document) => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const path = `${API_BASE}/admin/credit-applications/${detail.application.id}/documents/${document.id}?preview=true`;
      const request = () => fetch(path, { headers: { Authorization: `Bearer ${getAdminAccessToken() || ''}` }, credentials: 'include' });
      let response = await request();
      if (response.status === 401 && await adminTryRefresh()) response = await request();
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Document preview failed.');
      }
      const url = URL.createObjectURL(await response.blob());
      setPreview({ document, url });
    } catch (previewError) {
      setError(previewError.message || 'Document preview failed.');
    } finally { setBusy(false); }
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const statusColor = (value) => value === 'approved' ? '#047857' : value === 'rejected' ? '#B91C1C' : '#B45309';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <div><h1 style={{ margin: '0 0 6px', fontSize: '1.45rem', color: '#0F172A' }}>Credit applications</h1><p style={{ margin: 0, color: '#64748B', fontSize: '.86rem' }}>Review applicant submissions and make an internal status decision. This is not a lender sanction.</p></div>
        <button style={button} onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {(error || notice) && <div role={error ? 'alert' : 'status'} style={{ ...card, padding: 12, marginBottom: 14, color: error ? '#B91C1C' : '#047857' }}>{error || notice}</div>}
      <div style={{ ...card, padding: 12, marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220 }}><Search size={16} color="#64748B" /><input style={field} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search applicant or application ID" /></label>
        <select style={{ ...field, width: 'auto', minWidth: 180 }} value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}><option value="">All statuses</option><option value="pending">Application Under Review</option><option value="approved">Application Approved</option><option value="rejected">Application Rejected</option></select>
      </div>

      <div style={{ ...card, overflowX: 'auto' }}>
        {loading ? <div style={{ padding: 32, color: '#64748B' }}><LoaderCircle size={16} /> Loading applications…</div> : (
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead><tr>{['Application ID', 'Applicant', 'Requested amount', 'Submitted', 'Status', 'Documents', ''].map((label) => <th key={label} style={{ padding: 12, background: '#F8FAFC', textAlign: 'left', color: '#64748B', fontSize: '.72rem' }}>{label}</th>)}</tr></thead>
            <tbody>{data.applications.length ? data.applications.map((application) => <tr key={application.id} style={{ borderTop: '1px solid #EEF2F6' }}>
              <td style={{ padding: 12, fontWeight: 800 }}>{application.applicationId}</td><td style={{ padding: 12 }}>{application.applicantName}<small style={{ display: 'block', color: '#64748B' }}>{application.applicantEmail}</small></td><td style={{ padding: 12 }}>{money(application.requestedAmount)}</td><td style={{ padding: 12 }}>{date(application.submittedAt)}</td><td style={{ padding: 12, color: statusColor(application.status), fontWeight: 800 }}>{statusLabel[application.status]}</td><td style={{ padding: 12 }}>{application.documentCount}</td><td style={{ padding: 12 }}><button style={button} onClick={() => openDetail(application.id)}>Review</button></td>
            </tr>) : <tr><td colSpan={7} style={{ padding: 36, textAlign: 'center', color: '#94A3B8' }}>No applications found.</td></tr>}</tbody>
          </table>
        )}
      </div>
      {data.pagination?.totalPages > 1 && <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12 }}><span style={{ color: '#64748B', fontSize: '.82rem' }}>Page {page} of {data.pagination.totalPages}</span><button style={button} disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button style={button} disabled={page >= data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}

      {detail && <div role="presentation" onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15,23,42,.55)' }}>
        <section role="dialog" aria-modal="true" aria-labelledby="credit-application-detail-title" onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 820px)', maxHeight: '90vh', overflow: 'auto', padding: 24, background: '#fff', borderRadius: 16, boxShadow: '0 25px 80px rgba(0,0,0,.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}><div><h2 id="credit-application-detail-title" style={{ margin: '0 0 5px', fontSize: '1.2rem' }}>Application {detail.application.applicationId}</h2><p style={{ margin: 0, color: '#64748B', fontSize: '.82rem' }}>Submitted {date(detail.application.submittedAt)}</p></div><button style={button} onClick={() => setDetail(null)}>Close</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginTop: 18 }}>
            {[
            ['Applicant', detail.application.applicantName], ['Email', detail.application.applicantEmail], ['Mobile', detail.application.applicantMobile || 'Not provided'],
              ['Application type', String(detail.application.loanType).replaceAll('_', ' ')], ['Requested amount', money(detail.application.requestedAmount)],
              ['Business', detail.application.businessName || 'Not provided'], ['Annual turnover', money(detail.application.annualTurnover)],
              ['Current status', statusLabel[detail.application.status]], ['Decision timestamp', date(detail.application.reviewedAt)],
              ['Reviewed by', detail.application.reviewerName || 'Not reviewed'], ['Purpose', detail.application.purpose],
          ].map(([label, value]) => <div key={label} style={{ ...card, padding: 12 }}><small style={{ display: 'block', marginBottom: 5, color: '#64748B' }}>{label}</small><strong style={{ fontSize: '.86rem', overflowWrap: 'anywhere', textTransform: label === 'Application type' ? 'capitalize' : undefined }}>{value || '—'}</strong></div>)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {detail.application.applicantEmail && <a href={`mailto:${detail.application.applicantEmail}`} style={{ ...button, textDecoration: 'none' }}><Mail size={15} /> Email applicant</a>}
            {detail.application.applicantMobile && <a href={`tel:${detail.application.applicantMobile}`} style={{ ...button, textDecoration: 'none' }}><Phone size={15} /> Call applicant</a>}
          </div>
          <div style={{ marginTop: 18 }}><h3 style={{ fontSize: '.98rem' }}>Eligibility details</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
            {[
              ['Loan requirement', money(detail.application.applicationDetails?.requirement?.amount)],
              ['Selected purpose', detail.application.applicationDetails?.purpose],
              ['Employment type', detail.application.applicationDetails?.employment?.type],
              ['Monthly income', money(detail.application.applicationDetails?.employment?.monthlyIncome)],
              ['PAN', detail.application.applicationDetails?.personal?.panNumber],
              ['State / city', [detail.application.applicationDetails?.personal?.state, detail.application.applicationDetails?.personal?.city].filter(Boolean).join(' / ')],
              ['PIN code', detail.application.applicationDetails?.personal?.pincode],
              ['KYC status', detail.application.applicationDetails?.kyc?.verified ? 'Aadhaar e-KYC verified' : 'Not provided'],
              ['Masked Aadhaar', detail.application.applicationDetails?.kyc?.maskedAadhaar],
              ['Verified name', detail.application.applicationDetails?.kyc?.verifiedName],
              ['Verified date of birth', detail.application.applicationDetails?.kyc?.verifiedDob],
              ['KYC verified at', date(detail.application.applicationDetails?.kyc?.verifiedAt)],
            ].filter(([, value]) => value != null && value !== '').map(([label, value]) => <div key={label} style={{ ...card, padding: 12 }}><small style={{ display: 'block', marginBottom: 5, color: '#64748B' }}>{label}</small><strong style={{ fontSize: '.86rem', overflowWrap: 'anywhere', textTransform: label === 'Employment type' ? 'capitalize' : undefined }}>{value}</strong></div>)}
          </div></div>
          <div style={{ marginTop: 20 }}><h3 style={{ fontSize: '.98rem' }}>Application timeline</h3>{detail.events.map((event, index) => <div key={`${event.created_at}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 0', borderTop: '1px solid #EEF2F6' }}><Clock size={15} color={statusColor(event.to_status)} /><div><strong style={{ fontSize: '.84rem' }}>{statusLabel[event.to_status]}</strong><small style={{ display: 'block', marginTop: 3, color: '#64748B' }}>{date(event.created_at)}{event.admin_actor ? ` · ${event.admin_actor}` : event.user_actor ? ` · ${event.user_actor}` : ''}{event.remarks ? ` · ${event.remarks}` : ''}</small></div></div>)}</div>
          <div style={{ marginTop: 20 }}><h3 style={{ fontSize: '.98rem' }}>Submitted documents</h3>{detail.documents.length ? <div style={{ display: 'grid', gap: 8 }}>{detail.documents.map((document) => <div key={document.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 11 }}><span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflowWrap: 'anywhere' }}><FileText size={17} /> {document.original_filename} <small style={{ color: '#64748B' }}>({Math.ceil(document.file_size_bytes / 1024)} KB)</small></span><span style={{ display: 'flex', gap: 6 }}><button style={button} disabled={busy} onClick={() => previewDocument(document)}><Eye size={15} /> Preview</button><button style={button} disabled={busy} onClick={() => downloadDocument(document)}><Download size={15} /> Download</button></span></div>)}</div> : <p style={{ color: '#64748B', fontSize: '.84rem' }}>No documents were submitted.</p>}</div>
          <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: '#F8FAFC' }}>
            <label style={{ display: 'grid', gap: 7, color: '#334155', fontSize: '.84rem', fontWeight: 700 }}>Decision remarks<textarea style={{ ...field, minHeight: 84, resize: 'vertical' }} maxLength={2000} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add review remarks" /></label>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: '.78rem', lineHeight: 1.45 }}><ShieldCheck size={15} /> The decision, timestamp, and remarks are stored server-side and audited. This is an internal review, not a lender sanction.</p>
            {detail.application.status === 'pending' ? <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button style={{ ...button, borderColor: '#FCA5A5', color: '#B91C1C' }} disabled={busy} onClick={() => decide('rejected')}><XCircle size={15} /> Reject</button><button style={{ ...button, borderColor: '#6EE7B7', background: '#059669', color: '#fff' }} disabled={busy} onClick={() => decide('approved')}><CheckCircle2 size={15} /> Approve</button></div> : <strong style={{ color: statusColor(detail.application.status) }}>This application has already been {detail.application.status}.</strong>}
          </div>
        </section>
      </div>}
      {preview && <div role="presentation" onClick={closePreview} style={{ position: 'fixed', inset: 0, zIndex: 3100, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15,23,42,.72)' }}>
        <section role="dialog" aria-modal="true" aria-label={`Preview ${preview.document.original_filename}`} onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 1000px)', height: 'min(90vh, 760px)', background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 12, borderBottom: '1px solid #E2E8F0' }}><strong style={{ overflowWrap: 'anywhere' }}>{preview.document.original_filename}</strong><button style={button} onClick={closePreview}>Close preview</button></div>
          {preview.document.mime_type === 'application/pdf' ? <iframe title={`Preview ${preview.document.original_filename}`} src={preview.url} style={{ width: '100%', flex: 1, border: 0 }} /> : <div style={{ flex: 1, display: 'grid', placeItems: 'center', overflow: 'auto', background: '#0F172A' }}><img src={preview.url} alt={preview.document.original_filename} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>}
        </section>
      </div>}
    </div>
  );
}
