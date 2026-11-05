import React, { useState, useEffect, useCallback } from 'react';
import './ProductionLedgerViews.css';
import {
  Layers,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Server,
  Activity,
  Terminal,
  FileCode
} from 'lucide-react';
import {
  fetchIntegrationsStatus,
  testIntegration
} from '../../api/ledgerClient';

export default function IntegrationsView() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [testingKey, setTestingKey] = useState(null);
  const [error, setError] = useState('');

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchIntegrationsStatus();
      if (res.ok) {
        setProviders(res.data.providers || []);
      } else {
        setError(res.data?.error || 'Failed to load integrations status.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleTestConnection = async (key) => {
    setTestingKey(key);
    try {
      const res = await testIntegration(key);
      setTestResults((prev) => ({
        ...prev,
        [key]: res.data
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [key]: { success: false, status: 'ERROR', message: err.message }
      }));
    } finally {
      setTestingKey(null);
    }
  };

  return (
    <div className="prod-view-container">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="prod-view-header">
        <div className="prod-view-title-group">
          <h2>Authorized External Integrations & Gateways</h2>
          <p>Government APIs (NIC E-Invoice, E-Way Bill, GSTN, NSDL TDS) & Financial Infrastructure adapters.</p>
        </div>
        <div className="prod-view-actions">
          <button onClick={loadProviders} className="btn-secondary" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── SYSTEM INTEGRITY NOTICE ───────────────────────────────────────── */}
      <div className="prod-alert-banner info">
        <Server size={20} />
        <div>
          <strong style={{ fontSize: '0.9rem' }}>Production Adapter Architecture Active</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem' }}>
            All external integrations are architected via modular adapters (retries, timeouts, credentials gating). In accordance with enterprise specifications, providers report <code>CREDENTIALS_REQUIRED</code> cleanly rather than returning dummy/simulated responses. Once real government credentials are provided in <code>.env</code>, integrations activate automatically.
          </p>
        </div>
      </div>

      {error && (
        <div className="prod-alert-banner danger">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── PROVIDER CARDS GRID ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {providers.map((p) => {
          const test = testResults[p.key];
          const isTesting = testingKey === p.key;

          return (
            <div key={p.key} className="prod-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="prod-card-header" style={{ background: '#F8FAFC' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>ADAPTER: {p.key}</div>
                </div>
                <span className={`compliance-badge ${p.status === 'CONFIGURED' ? 'configured' : 'credentials_required'}`}>
                  {p.status}
                </span>
              </div>

              <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                  {p.description}
                </p>

                <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#64748B' }}>Environment:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{p.environment}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#64748B' }}>Schema Version:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{p.schemaVersion}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Authentication Type:</span>
                    <strong>{p.authType}</strong>
                  </div>
                </div>

                {test && (
                  <div style={{
                    padding: 10,
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    background: test.status === 'CONFIGURED' ? '#ECFDF5' : '#FFF7ED',
                    border: `1px solid ${test.status === 'CONFIGURED' ? '#A7F3D0' : '#FFEDD5'}`,
                    color: test.status === 'CONFIGURED' ? '#065F46' : '#C2410C'
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>
                      STATUS: {test.status} ({test.latencyMs ? `${test.latencyMs}ms` : 'Immediate'})
                    </div>
                    <div>{test.message}</div>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                    Doc: <code>INTEGRATION_SETUP.md</code>
                  </span>
                  <button
                    onClick={() => handleTestConnection(p.key)}
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                    disabled={isTesting}
                  >
                    <Activity size={12} className={isTesting ? 'animate-spin' : ''} />
                    {isTesting ? 'Testing Adapter...' : 'Test Connection'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
