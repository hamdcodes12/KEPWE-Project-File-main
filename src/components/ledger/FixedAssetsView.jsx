import React, { useState, useEffect, useCallback } from 'react';
import './ProductionLedgerViews.css';
import {
  Layers,
  Plus,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingDown,
  Monitor,
  Calendar
} from 'lucide-react';
import {
  fetchFixedAssets,
  createFixedAsset,
  executeDepreciationRun,
  fetchDepreciationRuns
} from '../../api/ledgerClient';

export default function FixedAssetsView() {
  const [activeTab, setActiveTab] = useState('register');
  const [assets, setAssets] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add Asset Modal
  const [addModal, setAddModal] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: '',
    category: 'Computers & IT',
    purchaseCost: 150000,
    salvageValue: 5000,
    usefulLifeYears: 3,
    depreciationMethod: 'SLM',
    depreciationRate: 33.33,
    recordPurchaseJournal: true
  });

  // Run Depreciation Modal
  const [deprPeriod, setDeprPeriod] = useState('FY-2026-27');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, rRes] = await Promise.all([
        fetchFixedAssets(),
        fetchDepreciationRuns()
      ]);
      if (aRes.ok) setAssets(aRes.data.assets || []);
      if (rRes.ok) setRuns(rRes.data.runs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddAsset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await createFixedAsset({
        ...assetForm,
        purchaseCost: Number(assetForm.purchaseCost),
        salvageValue: Number(assetForm.salvageValue),
        usefulLifeYears: Number(assetForm.usefulLifeYears)
      });
      if (res.ok) {
        setSuccessMsg(`Fixed Asset ${assetForm.name} registered and purchase journal posted.`);
        setAddModal(false);
        loadData();
      } else {
        setError(res.data?.error || 'Failed to add asset.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDepreciation = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await executeDepreciationRun({ period: deprPeriod });
      if (res.ok) {
        setSuccessMsg(`Depreciation run executed: ₹${res.data.run.totalDepreciation} posted to General Ledger (Entry: ${res.data.journalEntry.entryNumber}).`);
        loadData();
        setActiveTab('runs');
      } else {
        setError(res.data?.error || 'Depreciation run failed.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmtInr = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  const totalGrossValue = assets.reduce((acc, a) => acc + (a.purchaseCost || 0), 0);
  const totalAccumDepr = assets.reduce((acc, a) => acc + (a.accumulatedDepreciation || 0), 0);
  const totalNetBookValue = assets.reduce((acc, a) => acc + (a.netBookValue || 0), 0);

  return (
    <div className="prod-view-container">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="prod-view-header">
        <div className="prod-view-title-group">
          <h2>Fixed Assets Register & Depreciation Scheduler</h2>
          <p>Statutory asset lifecycle tracking supporting SLM & WDV methods with automated ledger posting.</p>
        </div>
        <div className="prod-view-actions">
          <button
            onClick={() => setAddModal(true)}
            className="btn-secondary"
          >
            <Plus size={14} /> Register Asset
          </button>
          <button
            onClick={handleRunDepreciation}
            className="btn-primary"
            disabled={loading}
          >
            <Play size={14} /> Execute Depreciation
          </button>
          <button onClick={loadData} className="btn-secondary" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="prod-alert-banner success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="prod-alert-banner danger">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── SUMMARY METRICS ──────────────────────────────────────────────── */}
      <div className="prod-metrics-grid">
        <div className="prod-metric-card">
          <div className="prod-metric-title">Gross Asset Value</div>
          <div className="prod-metric-value font-mono">{fmtInr(totalGrossValue)}</div>
          <div className="prod-metric-footer">Historical acquisition cost</div>
        </div>
        <div className="prod-metric-card">
          <div className="prod-metric-title">Accumulated Depreciation</div>
          <div className="prod-metric-value text-red font-mono">{fmtInr(totalAccumDepr)}</div>
          <div className="prod-metric-footer">Written off to P&L</div>
        </div>
        <div className="prod-metric-card highlight">
          <div className="prod-metric-title">Net Book Value (Balance Sheet)</div>
          <div className="prod-metric-value text-blue font-mono">{fmtInr(totalNetBookValue)}</div>
          <div className="prod-metric-footer">Carrying value of assets</div>
        </div>
      </div>

      {/* ── TABS BAR ─────────────────────────────────────────────────────── */}
      <div className="prod-tabs-bar">
        <button
          onClick={() => setActiveTab('register')}
          className={`prod-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
        >
          <Monitor size={15} /> Asset Register ({assets.length})
        </button>
        <button
          onClick={() => setActiveTab('runs')}
          className={`prod-tab-btn ${activeTab === 'runs' ? 'active' : ''}`}
        >
          <Calendar size={15} /> Depreciation History ({runs.length})
        </button>
      </div>

      {/* ── TAB 1: ASSET REGISTER ────────────────────────────────────────── */}
      {activeTab === 'register' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">Active Depreciable Assets</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Asset Code</th>
                  <th>Asset Name</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th>Useful Life</th>
                  <th>Purchase Cost</th>
                  <th>Accum. Depreciation</th>
                  <th>Net Book Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No fixed assets registered. Click "Register Asset" above.</td></tr>
                ) : (
                  assets.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#214ECF' }}>{a.assetCode}</td>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td>{a.category}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {a.depreciationMethod}
                        </span>
                      </td>
                      <td>{a.usefulLifeYears} years</td>
                      <td className="font-mono">{fmtInr(a.purchaseCost)}</td>
                      <td className="font-mono text-red">{fmtInr(a.accumulatedDepreciation)}</td>
                      <td className="font-mono font-bold text-green">{fmtInr(a.netBookValue)}</td>
                      <td>
                        <span className="compliance-badge completed">{a.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: RUNS ──────────────────────────────────────────────────── */}
      {activeTab === 'runs' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">Periodic Depreciation Runs</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Executed At</th>
                  <th>Total Depreciation Written Off</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No depreciation runs executed yet.</td></tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.period}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.executedAt?.slice(0, 10)}</td>
                      <td className="font-mono font-bold text-red">{fmtInr(r.totalDepreciation)}</td>
                      <td>
                        <span className="compliance-badge completed">{r.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REGISTER ASSET MODAL ─────────────────────────────────────────── */}
      {addModal && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Register New Fixed Asset
              </div>
            </div>

            <form onSubmit={handleAddAsset} className="prod-form-grid">
              <div className="prod-form-group">
                <label>Asset Name / Description</label>
                <input
                  type="text"
                  placeholder="e.g. MacBook Pro M3 Max"
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  className="prod-input"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Asset Category</label>
                <select
                  value={assetForm.category}
                  onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                  className="prod-select"
                >
                  <option value="Computers & IT">Computers & IT (3 Years)</option>
                  <option value="Office Equipment">Office Equipment (5 Years)</option>
                  <option value="Plant & Machinery">Plant & Machinery (8 Years)</option>
                  <option value="Vehicles">Vehicles (6 Years)</option>
                  <option value="Furniture & Fixtures">Furniture & Fixtures (10 Years)</option>
                </select>
              </div>

              <div className="prod-form-group">
                <label>Acquisition Cost (₹)</label>
                <input
                  type="number"
                  value={assetForm.purchaseCost}
                  onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: e.target.value })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Salvage / Scrap Value (₹)</label>
                <input
                  type="number"
                  value={assetForm.salvageValue}
                  onChange={(e) => setAssetForm({ ...assetForm, salvageValue: e.target.value })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Useful Life (Years)</label>
                <input
                  type="number"
                  value={assetForm.usefulLifeYears}
                  onChange={(e) => setAssetForm({ ...assetForm, usefulLifeYears: e.target.value })}
                  className="prod-input font-mono"
                  required
                />
              </div>

              <div className="prod-form-group">
                <label>Depreciation Method</label>
                <select
                  value={assetForm.depreciationMethod}
                  onChange={(e) => setAssetForm({ ...assetForm, depreciationMethod: e.target.value })}
                  className="prod-select"
                >
                  <option value="SLM">Straight Line Method (SLM)</option>
                  <option value="WDV">Written Down Value (WDV)</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="recJrn"
                  checked={assetForm.recordPurchaseJournal}
                  onChange={(e) => setAssetForm({ ...assetForm, recordPurchaseJournal: e.target.checked })}
                />
                <label htmlFor="recJrn" style={{ fontSize: '0.82rem', color: '#475569', cursor: 'pointer' }}>
                  Post capital acquisition double-entry journal (Debit 1061 Fixed Asset, Credit 1010 Bank)
                </label>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
