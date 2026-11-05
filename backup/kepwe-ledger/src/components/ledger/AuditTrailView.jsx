import React, { useState, useEffect, useCallback } from 'react';
import './ProductionLedgerViews.css';
import {
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  FileCode,
  Clock,
  User,
  Activity
} from 'lucide-react';
import { fetchAuditTrail } from '../../api/ledgerClient';

export default function AuditTrailView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterAction !== 'ALL') params.action = filterAction;
      const res = await fetchAuditTrail(params);
      if (res.ok) {
        setLogs(res.data.logs || []);
      } else {
        setError(res.data?.error || 'Failed to fetch audit trail.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterAction]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="prod-view-container">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="prod-view-header">
        <div className="prod-view-title-group">
          <h2>Immutable System Audit Trail & Event Logs</h2>
          <p>Cryptographically verifiable record of all ledger postings, reversals, approvals, and user actions.</p>
        </div>
        <div className="prod-view-actions">
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="prod-select"
            style={{ fontSize: '0.82rem' }}
          >
            <option value="ALL">All Actions</option>
            <option value="POST">POST</option>
            <option value="VOID">VOID</option>
            <option value="REVERSAL">REVERSAL</option>
            <option value="CREATE">CREATE</option>
            <option value="APPROVE">APPROVE</option>
          </select>
          <button onClick={loadLogs} className="btn-secondary" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="prod-alert-banner danger">
          <span>{error}</span>
        </div>
      )}

      {/* ── AUDIT LOGS TABLE ─────────────────────────────────────────────── */}
      <div className="prod-card">
        <div className="prod-card-header">
          <div className="prod-card-title">
            <ShieldCheck size={16} /> Audit Trail ({logs.length} events logged)
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="prod-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Actor / User</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No audit logs recorded yet.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {log.timestamp?.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0F172A' }}>
                        {log.userId || 'system'}
                      </span>
                    </td>
                    <td>
                      <span className={`compliance-badge ${log.action === 'VOID' ? 'overdue' : log.action === 'POST' ? 'completed' : 'upcoming'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#214ECF' }}>
                        {log.entityType}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748B' }}>
                        {log.entityId ? log.entityId.slice(0, 12) + '...' : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem' }}>{log.description}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {log.metadata && (
                        <button
                          onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        >
                          <FileCode size={12} /> {selectedLog?.id === log.id ? 'Hide' : 'Inspect'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── METADATA INSPECTOR MODAL ──────────────────────────────────────── */}
      {selectedLog && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Audit Log Metadata
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                Event: {selectedLog.action} {selectedLog.entityType} ({selectedLog.id})
              </p>
            </div>
            <div style={{ padding: 20 }}>
              <pre style={{
                background: '#0F172A',
                color: '#38BDF8',
                padding: 16,
                borderRadius: 8,
                fontSize: '0.78rem',
                overflowX: 'auto',
                margin: 0
              }}>
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
