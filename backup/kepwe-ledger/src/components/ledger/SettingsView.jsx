import React, { useState, useEffect } from 'react';
import './ProductionLedgerViews.css';
import {
  Settings,
  Building,
  Tag,
  ShieldCheck,
  Plus,
  CheckCircle2,
  AlertCircle,
  Save,
  Landmark,
  Users,
  FileCheck,
  Lock,
  RefreshCw
} from 'lucide-react';
import {
  fetchCompanyProfile,
  updateCompanyProfile,
  fetchLedgerCategories,
  createLedgerCategory
} from '../../api/ledgerClient';

export default function SettingsView({ accounts = [], onMutationSuccess }) {
  const [activeTab, setActiveTab] = useState('company');
  const [profile, setProfile] = useState({
    legalName: '',
    tradeName: '',
    pan: '',
    tan: '',
    gstin: '',
    cin: '',
    entityType: 'Private Limited',
    state: 'Maharashtra',
    stateCode: '27',
    registeredAddress: '',
    pincode: '',
    gstRegistrationType: 'Regular',
    gstFilingFrequency: 'Monthly',
    financialYearStart: '04-01',
    financialYearEnd: '03-31',
    bookBeginDate: '2026-04-01',
    lockDate: '',
    bankAccounts: [],
    directors: [],
    employeesCount: 0,
    accountingSettings: { inventoryValuation: 'FIFO', cashBasis: false }
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCat, setNewCat] = useState({ type: 'expense', name: '', color: '#214ECF' });
  const [catSaving, setCatSaving] = useState(false);

  // Bank Modal
  const [newBank, setNewBank] = useState({ bankName: '', accountNumber: '', ifsc: '', branch: '', isDefault: false });
  const [bankModalOpen, setBankModalOpen] = useState(false);

  // Director Modal
  const [newDir, setNewDir] = useState({ name: '', din: '', pan: '' });
  const [dirModalOpen, setDirModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [profRes, catRes] = await Promise.all([
        fetchCompanyProfile(),
        fetchLedgerCategories()
      ]);
      if (profRes.ok && profRes.data?.profile) {
        setProfile((prev) => ({ ...prev, ...profRes.data.profile }));
      }
      if (catRes.ok && Array.isArray(catRes.data?.categories)) {
        setCategories(catRes.data.categories);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load company profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await updateCompanyProfile(profile);
      if (res.ok) {
        setSuccessMsg('Company accounting profile updated successfully.');
        setTimeout(() => setSuccessMsg(''), 4000);
        if (onMutationSuccess) onMutationSuccess();
      } else {
        setErrorMsg(res.data?.error || 'Failed to update company settings.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBank = () => {
    if (!newBank.bankName || !newBank.accountNumber) return;
    setProfile({
      ...profile,
      bankAccounts: [...(profile.bankAccounts || []), newBank]
    });
    setNewBank({ bankName: '', accountNumber: '', ifsc: '', branch: '', isDefault: false });
    setBankModalOpen(false);
  };

  const handleAddDirector = () => {
    if (!newDir.name) return;
    setProfile({
      ...profile,
      directors: [...(profile.directors || []), newDir]
    });
    setNewDir({ name: '', din: '', pan: '' });
    setDirModalOpen(false);
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    setCatSaving(true);
    try {
      const res = await createLedgerCategory(newCat);
      if (res.ok) {
        setCategories([...categories, res.data.category]);
        setCatModalOpen(false);
        setNewCat({ type: 'expense', name: '', color: '#214ECF' });
      }
    } finally {
      setCatSaving(false);
    }
  };

  return (
    <div className="prod-view-container">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="prod-view-header">
        <div className="prod-view-title-group">
          <h2>Company Onboarding & Ledger Configuration</h2>
          <p>Statutory identity, GST registration parameters, bank mandates, and period locking controls.</p>
        </div>
        <div className="prod-view-actions">
          <button onClick={loadData} className="btn-secondary" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleSaveProfile} className="btn-primary" disabled={saving}>
            <Save size={14} /> {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="prod-alert-banner success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="prod-alert-banner danger">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── TABS BAR ─────────────────────────────────────────────────────── */}
      <div className="prod-tabs-bar">
        <button
          onClick={() => setActiveTab('company')}
          className={`prod-tab-btn ${activeTab === 'company' ? 'active' : ''}`}
        >
          <Building size={15} /> Company Profile & PAN/GSTIN
        </button>
        <button
          onClick={() => setActiveTab('taxation')}
          className={`prod-tab-btn ${activeTab === 'taxation' ? 'active' : ''}`}
        >
          <FileCheck size={15} /> Taxation & Statutory Defaults
        </button>
        <button
          onClick={() => setActiveTab('banking')}
          className={`prod-tab-btn ${activeTab === 'banking' ? 'active' : ''}`}
        >
          <Landmark size={15} /> Bank Accounts & Governance
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`prod-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
        >
          <Tag size={15} /> Categories & Preferences
        </button>
      </div>

      {/* ── TAB 1: COMPANY PROFILE ───────────────────────────────────────── */}
      {activeTab === 'company' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">Legal Identity & Statutory Registrations</div>
          </div>
          <form onSubmit={handleSaveProfile} className="prod-form-grid">
            <div className="prod-form-group">
              <label>Legal Name (As per PAN)</label>
              <input
                type="text"
                value={profile.legalName || ''}
                onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
                className="prod-input"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Trade / Brand Name</label>
              <input
                type="text"
                value={profile.tradeName || ''}
                onChange={(e) => setProfile({ ...profile, tradeName: e.target.value })}
                className="prod-input"
              />
            </div>

            <div className="prod-form-group">
              <label>Entity Type</label>
              <select
                value={profile.entityType || 'Private Limited'}
                onChange={(e) => setProfile({ ...profile, entityType: e.target.value })}
                className="prod-select"
              >
                <option value="Private Limited">Private Limited Company</option>
                <option value="Public Limited">Public Limited Company</option>
                <option value="LLP">Limited Liability Partnership (LLP)</option>
                <option value="Partnership">Partnership Firm</option>
                <option value="Sole Proprietorship">Sole Proprietorship</option>
              </select>
            </div>

            <div className="prod-form-group">
              <label>Permanent Account Number (PAN)</label>
              <input
                type="text"
                value={profile.pan || ''}
                onChange={(e) => setProfile({ ...profile, pan: e.target.value.toUpperCase() })}
                className="prod-input font-mono"
                required
              />
            </div>

            <div className="prod-form-group">
              <label>Tax Deduction Account Number (TAN)</label>
              <input
                type="text"
                value={profile.tan || ''}
                onChange={(e) => setProfile({ ...profile, tan: e.target.value.toUpperCase() })}
                className="prod-input font-mono"
              />
            </div>

            <div className="prod-form-group">
              <label>Goods & Services Tax Identification Number (GSTIN)</label>
              <input
                type="text"
                value={profile.gstin || ''}
                onChange={(e) => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })}
                className="prod-input font-mono"
              />
            </div>

            <div className="prod-form-group">
              <label>Corporate Identity Number (CIN)</label>
              <input
                type="text"
                value={profile.cin || ''}
                onChange={(e) => setProfile({ ...profile, cin: e.target.value.toUpperCase() })}
                className="prod-input font-mono"
              />
            </div>

            <div className="prod-form-group">
              <label>Principal State</label>
              <input
                type="text"
                value={profile.state || ''}
                onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                className="prod-input"
              />
            </div>

            <div className="prod-form-group">
              <label>2-Digit GST State Code</label>
              <input
                type="text"
                value={profile.stateCode || ''}
                onChange={(e) => setProfile({ ...profile, stateCode: e.target.value })}
                className="prod-input font-mono"
                maxLength={2}
              />
            </div>

            <div className="prod-form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Registered Office Address</label>
              <input
                type="text"
                value={profile.registeredAddress || ''}
                onChange={(e) => setProfile({ ...profile, registeredAddress: e.target.value })}
                className="prod-input"
              />
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 2: STATUTORY DEFAULTS ────────────────────────────────────── */}
      {activeTab === 'taxation' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">Filing Frequencies & Fiscal Periods</div>
          </div>
          <form onSubmit={handleSaveProfile} className="prod-form-grid">
            <div className="prod-form-group">
              <label>GST Registration Type</label>
              <select
                value={profile.gstRegistrationType || 'Regular'}
                onChange={(e) => setProfile({ ...profile, gstRegistrationType: e.target.value })}
                className="prod-select"
              >
                <option value="Regular">Regular Taxpayer</option>
                <option value="Composition">Composition Scheme</option>
                <option value="SEZ">Special Economic Zone (SEZ)</option>
              </select>
            </div>

            <div className="prod-form-group">
              <label>GSTR-1 & 3B Filing Frequency</label>
              <select
                value={profile.gstFilingFrequency || 'Monthly'}
                onChange={(e) => setProfile({ ...profile, gstFilingFrequency: e.target.value })}
                className="prod-select"
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly (QRMP Scheme)</option>
              </select>
            </div>

            <div className="prod-form-group">
              <label>Books Beginning Date</label>
              <input
                type="date"
                value={profile.bookBeginDate || '2026-04-01'}
                onChange={(e) => setProfile({ ...profile, bookBeginDate: e.target.value })}
                className="prod-input font-mono"
              />
            </div>

            <div className="prod-form-group">
              <label>Accounting Period Lock Date</label>
              <input
                type="date"
                value={profile.lockDate || ''}
                onChange={(e) => setProfile({ ...profile, lockDate: e.target.value })}
                className="prod-input font-mono"
              />
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                Prevents back-dated entries before this date.
              </span>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 3: BANK ACCOUNTS & DIRECTORS ─────────────────────────────── */}
      {activeTab === 'banking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Bank Accounts */}
          <div className="prod-card">
            <div className="prod-card-header">
              <div className="prod-card-title">
                <Landmark size={16} /> Bank Accounts ({(profile.bankAccounts || []).length})
              </div>
              <button onClick={() => setBankModalOpen(true)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                <Plus size={12} /> Add Bank
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>Bank Name</th>
                    <th>Account Number</th>
                    <th>IFSC Code</th>
                    <th>Branch</th>
                    <th>Default Mandate</th>
                  </tr>
                </thead>
                <tbody>
                  {(profile.bankAccounts || []).length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20, color: '#64748B' }}>No bank accounts added.</td></tr>
                  ) : (
                    profile.bankAccounts.map((b, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{b.bankName}</td>
                        <td className="font-mono">{b.accountNumber}</td>
                        <td className="font-mono">{b.ifsc}</td>
                        <td>{b.branch}</td>
                        <td>
                          {b.isDefault ? (
                            <span className="compliance-badge completed">PRIMARY</span>
                          ) : (
                            <span style={{ color: '#64748B', fontSize: '0.75rem' }}>Secondary</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Directors / Key Management */}
          <div className="prod-card">
            <div className="prod-card-header">
              <div className="prod-card-title">
                <Users size={16} /> Directors / Partners / Proprietor ({(profile.directors || []).length})
              </div>
              <button onClick={() => setDirModalOpen(true)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                <Plus size={12} /> Add Person
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>Full Legal Name</th>
                    <th>DIN / DPIN</th>
                    <th>PAN</th>
                  </tr>
                </thead>
                <tbody>
                  {(profile.directors || []).length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: 20, color: '#64748B' }}>No directors/partners listed.</td></tr>
                  ) : (
                    profile.directors.map((d, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{d.name}</td>
                        <td className="font-mono">{d.din || '—'}</td>
                        <td className="font-mono">{d.pan || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: CATEGORIES & PREFERENCES ──────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="prod-card">
          <div className="prod-card-header">
            <div className="prod-card-title">
              <Tag size={16} /> Custom Transaction Categories ({categories.length})
            </div>
            <button onClick={() => setCatModalOpen(true)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              <Plus size={12} /> Add Category
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Classification</th>
                  <th>Badge Color</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan="3" style={{ textAlign: 'center', padding: 20, color: '#64748B' }}>No custom categories configured.</td></tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>
                        <span className={`compliance-badge ${c.type === 'income' ? 'completed' : 'upcoming'}`}>
                          {c.type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: c.color }} />
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.color}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ADD BANK MODAL ──────────────────────────────────────────────── */}
      {bankModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>Add Bank Account</div>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="prod-form-group">
                <label>Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank"
                  value={newBank.bankName}
                  onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                  className="prod-input"
                />
              </div>
              <div className="prod-form-group">
                <label>Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 50200099887766"
                  value={newBank.accountNumber}
                  onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                  className="prod-input font-mono"
                />
              </div>
              <div className="prod-form-group">
                <label>IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  value={newBank.ifsc}
                  onChange={(e) => setNewBank({ ...newBank, ifsc: e.target.value.toUpperCase() })}
                  className="prod-input font-mono"
                />
              </div>
              <div className="prod-form-group">
                <label>Branch</label>
                <input
                  type="text"
                  placeholder="e.g. BKC Mumbai"
                  value={newBank.branch}
                  onChange={(e) => setNewBank({ ...newBank, branch: e.target.value })}
                  className="prod-input"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button onClick={() => setBankModalOpen(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleAddBank} className="btn-primary">Add Account</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD DIRECTOR MODAL ──────────────────────────────────────────── */}
      {dirModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>Add Director / Key Person</div>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="prod-form-group">
                <label>Full Legal Name</label>
                <input
                  type="text"
                  value={newDir.name}
                  onChange={(e) => setNewDir({ ...newDir, name: e.target.value })}
                  className="prod-input"
                />
              </div>
              <div className="prod-form-group">
                <label>DIN (Director Identification Number)</label>
                <input
                  type="text"
                  value={newDir.din}
                  onChange={(e) => setNewDir({ ...newDir, din: e.target.value })}
                  className="prod-input font-mono"
                />
              </div>
              <div className="prod-form-group">
                <label>PAN Number</label>
                <input
                  type="text"
                  value={newDir.pan}
                  onChange={(e) => setNewDir({ ...newDir, pan: e.target.value.toUpperCase() })}
                  className="prod-input font-mono"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button onClick={() => setDirModalOpen(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleAddDirector} className="btn-primary">Add Person</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD CATEGORY MODAL ──────────────────────────────────────────── */}
      {catModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>Add Category</div>
            </div>
            <form onSubmit={handleCreateCategory} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="prod-form-group">
                <label>Category Type</label>
                <select
                  value={newCat.type}
                  onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}
                  className="prod-select"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div className="prod-form-group">
                <label>Category Name</label>
                <input
                  type="text"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  className="prod-input"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setCatModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={catSaving}>
                  {catSaving ? 'Saving...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
