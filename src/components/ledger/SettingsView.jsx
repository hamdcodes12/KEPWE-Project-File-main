import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Tag,
  Bell,
  Shield,
  Plus,
  CheckCircle2,
  AlertCircle,
  Save,
  X
} from 'lucide-react';
import {
  fetchLedgerSettings,
  updateLedgerSettings,
  fetchLedgerCategories,
  createLedgerCategory
} from '../../api/ledgerClient';

export default function SettingsView({ accounts = [], onMutationSuccess }) {
  const [settings, setSettings] = useState({
    businessName: '',
    gstin: '',
    pan: '',
    currency: 'INR',
    currencySymbol: '₹',
    fiscalYearStart: '04-01',
    defaultAccountId: '',
    notifyOverdue: true,
    notifyPayments: true,
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCat, setNewCat] = useState({ type: 'expense', name: '', color: '#214ECF' });
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [settRes, catRes] = await Promise.all([
        fetchLedgerSettings(),
        fetchLedgerCategories(),
      ]);
      if (settRes.ok && settRes.data?.settings) {
        setSettings((prev) => ({ ...prev, ...settRes.data.settings }));
      }
      if (catRes.ok && Array.isArray(catRes.data?.categories)) {
        setCategories(catRes.data.categories);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const res = await updateLedgerSettings(settings);
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        if (onMutationSuccess) onMutationSuccess();
      } else {
        setSaveError(res.data?.error || 'Failed to save settings');
      }
    } catch (err) {
      setSaveError(err.message || 'Error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCat.name.trim()) {
      setCatError('Category name is required.');
      return;
    }
    setCatSaving(true);
    setCatError('');

    try {
      const res = await createLedgerCategory(newCat);
      if (res.ok) {
        setCatModalOpen(false);
        setNewCat({ type: 'expense', name: '', color: '#214ECF' });
        loadData();
        if (onMutationSuccess) onMutationSuccess();
      } else {
        setCatError(res.data?.error || 'Failed to add category');
      }
    } catch (err) {
      setCatError(err.message || 'Error adding category');
    } finally {
      setCatSaving(false);
    }
  };

  return (
    <div className="ledger-view-container">
      {/* Header */}
      <div className="ledger-view-header">
        <div>
          <h2 className="ledger-view-title">Ledger Settings</h2>
          <p className="ledger-view-sub">Configure your business entity, custom tax categories, default accounts, and alerts.</p>
        </div>
      </div>

      {loading ? (
        <div className="ledger-loading-state">
          <div className="spinner" />
          <span>Loading configuration...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Business Information Card */}
          <div className="report-section-card">
            <div className="section-head blue">
              <Building size={18} />
              <span>Business Profile & Statutory Info</span>
            </div>

            <form onSubmit={handleSaveSettings} className="modal-form" style={{ marginTop: '16px' }}>
              {saveSuccess && (
                <div className="modal-alert success">
                  <CheckCircle2 size={16} />
                  <span>Settings updated successfully.</span>
                </div>
              )}
              {saveError && <div className="modal-alert error">{saveError}</div>}

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Registered Business / Operating Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Innovations Pvt Ltd"
                    value={settings.businessName || ''}
                    onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">GSTIN (Goods & Services Tax ID)</label>
                  <input
                    type="text"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={settings.gstin || ''}
                    onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Company PAN</label>
                  <input
                    type="text"
                    placeholder="e.g. ABCDE1234F"
                    value={settings.pan || ''}
                    onChange={(e) => setSettings({ ...settings, pan: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="form-label">Fiscal Year Start Date</label>
                  <select
                    value={settings.fiscalYearStart || '04-01'}
                    onChange={(e) => setSettings({ ...settings, fiscalYearStart: e.target.value })}
                    className="form-input"
                  >
                    <option value="04-01">April 1st (Indian Standard Fiscal Year)</option>
                    <option value="01-01">January 1st (Calendar Year)</option>
                  </select>
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Default Primary Account</label>
                  <select
                    value={settings.defaultAccountId || ''}
                    onChange={(e) => setSettings({ ...settings, defaultAccountId: e.target.value })}
                    className="form-input"
                  >
                    <option value="">None / Auto Select First</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Reporting Currency</label>
                  <input
                    type="text"
                    disabled
                    value="INR (₹ Indian Rupee)"
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ marginTop: '16px', borderTop: '1px solid #E4E7EC', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111827', marginBottom: '10px' }}>Automated Reminders & Alerts</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#344054' }}>
                    <input
                      type="checkbox"
                      checked={settings.notifyOverdue ?? true}
                      onChange={(e) => setSettings({ ...settings, notifyOverdue: e.target.checked })}
                    />
                    <span>Notify and flag upcoming and overdue receivables & vendor bills</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#344054' }}>
                    <input
                      type="checkbox"
                      checked={settings.notifyPayments ?? true}
                      onChange={(e) => setSettings({ ...settings, notifyPayments: e.target.checked })}
                    />
                    <span>Generate real-time in-app alerts whenever invoice payments or payouts are settled</span>
                  </label>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '20px' }}>
                <button type="submit" disabled={savingSettings} className="btn-primary">
                  <Save size={16} /> {savingSettings ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Categories Management Card */}
          <div className="report-section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div className="section-head green" style={{ margin: 0 }}>
                <Tag size={18} />
                <span>Financial Tagging Categories</span>
              </div>
              <button onClick={() => setCatModalOpen(true)} className="btn-secondary small">
                <Plus size={14} /> Add Custom Category
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {categories.map((c) => (
                <div key={c.id || c.name} className="cat-chip-card">
                  <div className="cat-dot" style={{ backgroundColor: c.type === 'income' ? '#10B981' : '#214ECF' }} />
                  <div style={{ flex: 1 }}>
                    <div className="cat-name">{c.name}</div>
                    <span className="cat-type">{c.type.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Category Modal */}
      {catModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card small">
            <div className="modal-header">
              <h3>Add Custom Category</h3>
              <button onClick={() => setCatModalOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateCategory} className="modal-form">
              {catError && <div className="modal-alert error">{catError}</div>}

              <div className="form-group">
                <label className="form-label">Category Type</label>
                <select
                  value={newCat.type}
                  onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}
                  className="form-input"
                >
                  <option value="expense">Expense Category</option>
                  <option value="income">Income Category</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Employee Wellness or Digital Advertising"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setCatModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={catSaving} className="btn-primary">
                  {catSaving ? 'Adding…' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
