import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Landmark,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Plus,
  Lock,
  ArrowRight,
  Receipt
} from 'lucide-react';
import { fetchLedgerDataImportHistory } from '../../api/ledgerClient';

export default function BringYourFinancialDataView({ onOpenUploadModal }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchLedgerDataImportHistory();
      if (res.ok) {
        setHistory(res.data?.imports || []);
      } else {
        setError(res.data?.error || 'Failed to fetch statement import history.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with ledger services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Banner Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #214ECF 100%)',
          borderRadius: '16px',
          padding: '28px',
          color: '#FFFFFF',
          marginBottom: '24px',
          boxShadow: '0 10px 30px -5px rgba(33, 78, 207, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ maxWidth: '580px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            <ShieldCheck size={14} /> Zero Bank API · 100% Client-Owned
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            Bring Your Financial Data
          </h2>
          <p style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: 1.5, margin: 0 }}>
            Kepwe Ledger never asks for internet banking credentials, OTPs, or Account Aggregator linkages. Upload your bank statements (PDF, CSV, Excel), UPI exports, card statements, or screenshots to power your AI Personal CFO dashboard.
          </p>
        </div>

        <button
          onClick={onOpenUploadModal}
          className="btn-primary"
          style={{
            background: '#FFFFFF',
            color: '#1E3A8A',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.88rem',
            padding: '12px 22px',
            borderRadius: '12px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <UploadCloud size={18} />
          <span>Add Financial Data</span>
        </button>
      </div>

      {/* Security & Supported Inputs Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div className="prod-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={16} />
            </div>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>Privacy & Security Guarantee</h4>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: 1.45, margin: 0 }}>
            No bank passwords, UPI PINs, or direct banking access required. All data is normalized with user isolation and persisted directly in your private PostgreSQL ledger.
          </p>
        </div>

        <div className="prod-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} />
            </div>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>Supported Statements</h4>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: 1.45, margin: 0 }}>
            HDFC, SBI, ICICI, Axis, Kotak, PhonePe, Google Pay, Paytm, credit card bills, and payment screenshots with auto-table detection and duplicate warnings.
          </p>
        </div>
      </div>

      {/* Statement Import History Section */}
      <div className="prod-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
              Statement Import History
            </h3>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
              Audit trail of all financial files and records processed by Kepwe Ledger
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={loadHistory}
              disabled={loading}
              className="btn-secondary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onOpenUploadModal}
              className="btn-primary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>Import New Statement</span>
            </button>
          </div>
        </div>

        {error && <div className="prod-alert-banner danger">{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px', color: '#94A3B8', fontSize: '0.82rem' }}>
            Loading statement import history...
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
            <Receipt size={36} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px 0', color: '#0F172A', fontWeight: 800, fontSize: '0.95rem' }}>
              No Statements Imported Yet
            </h4>
            <p style={{ fontSize: '0.8rem', maxWidth: '380px', margin: '0 auto 16px' }}>
              Upload your first bank statement, CSV, or UPI export to begin populating your personal CFO dashboard.
            </p>
            <button onClick={onOpenUploadModal} className="btn-primary small">
              <UploadCloud size={14} style={{ marginRight: 6 }} /> Add Financial Data
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-data-table">
              <thead>
                <tr>
                  <th>Import Date</th>
                  <th>Statement File</th>
                  <th>Source / Type</th>
                  <th>Institution / Bank</th>
                  <th>Associated Account</th>
                  <th>Transactions</th>
                  <th>Duplicates</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="font-mono text-muted" style={{ fontSize: '0.78rem' }}>
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={15} color="#214ECF" />
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>
                          {item.fileName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#334155' }}>
                        {item.sourceType || item.fileType}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>
                        {item.institution}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        {item.accountName}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono font-bold text-green" style={{ fontSize: '0.85rem' }}>
                        +{item.importedCount}
                      </span>
                    </td>
                    <td>
                      {item.duplicateCount > 0 ? (
                        <span className="font-mono font-bold" style={{ color: '#D97706', fontSize: '0.85rem' }}>
                          {item.duplicateCount} skipped
                        </span>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>0</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: item.status === 'COMPLETED' ? '#DCFCE7' : '#FEE2E2',
                          color: item.status === 'COMPLETED' ? '#16A34A' : '#DC2626',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
