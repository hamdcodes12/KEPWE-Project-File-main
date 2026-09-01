import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Building,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertCircle,
  QrCode,
  Landmark,
  PiggyBank
} from 'lucide-react';
import {
  createLedgerAccount,
  updateLedgerAccount,
  deleteLedgerAccount,
  fetchLedgerTransactions
} from '../../api/ledgerClient';

export default function AccountsView({ accounts = [], onMutationSuccess }) {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountTransactions, setAccountTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deleteConfirmAccount, setDeleteConfirmAccount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'Bank Account',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    upiId: '',
    openingBalance: '',
    isDefault: false,
    notes: '',
  });

  const totalLiquidity = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  useEffect(() => {
    if (selectedAccount) {
      loadAccountTransactions(selectedAccount.id);
    }
  }, [selectedAccount]);

  const loadAccountTransactions = async (accId) => {
    setLoadingTx(true);
    try {
      const res = await fetchLedgerTransactions({ accountId: accId, limit: 50 });
      if (res.ok) {
        setAccountTransactions(res.data.transactions || []);
      }
    } finally {
      setLoadingTx(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      type: 'Bank Account',
      accountNumber: '',
      bankName: '',
      ifscCode: '',
      upiId: '',
      openingBalance: '0',
      isDefault: accounts.length === 0,
      notes: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (acc) => {
    setEditingAccount(acc);
    setFormData({
      name: acc.name,
      type: acc.type,
      accountNumber: acc.accountNumber || '',
      bankName: acc.bankName || '',
      ifscCode: acc.ifscCode || '',
      upiId: acc.upiId || '',
      openingBalance: String(acc.openingBalance),
      isDefault: acc.isDefault,
      notes: acc.notes || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Account name is required.');
      return;
    }
    setSaving(true);
    setFormError('');

    try {
      const payload = {
        ...formData,
        openingBalance: Number(formData.openingBalance || 0),
      };
      let res;
      if (editingAccount) {
        res = await updateLedgerAccount(editingAccount.id, payload);
      } else {
        res = await createLedgerAccount(payload);
      }

      if (res.ok) {
        setModalOpen(false);
        if (onMutationSuccess) onMutationSuccess();
      } else {
        setFormError(res.data?.error || 'Failed to save account');
      }
    } catch (err) {
      setFormError(err.message || 'Error saving account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmAccount) return;
    setSaving(true);
    try {
      const res = await deleteLedgerAccount(deleteConfirmAccount.id);
      if (res.ok) {
        if (selectedAccount?.id === deleteConfirmAccount.id) setSelectedAccount(null);
        setDeleteConfirmAccount(null);
        if (onMutationSuccess) onMutationSuccess();
      }
    } finally {
      setSaving(false);
    }
  };

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val || 0);

  const getAccountIcon = (type) => {
    switch (type) {
      case 'Bank Account': return Landmark;
      case 'UPI': return QrCode;
      case 'Cash': return PiggyBank;
      default: return Wallet;
    }
  };

  return (
    <div className="ledger-view-container">
      {/* Header */}
      <div className="ledger-view-header">
        <div>
          <h2 className="ledger-view-title">Financial Accounts</h2>
          <p className="ledger-view-sub">Manage your bank accounts, UPI wallets, and cash reserves with live synchronized balances.</p>
        </div>
        <div className="ledger-view-actions">
          <button onClick={handleOpenAdd} className="btn-primary">
            <Plus size={16} /> Link / Add Account
          </button>
        </div>
      </div>

      {/* Liquidity Total Banner */}
      <div className="ledger-liquidity-banner">
        <div className="banner-left">
          <span className="banner-label">TOTAL OPERATING LIQUIDITY</span>
          <span className="banner-val font-mono text-green">{fmtCurrency(totalLiquidity)}</span>
          <span className="banner-sub">Combined live balance across {accounts.length} active financial accounts</span>
        </div>
        <div className="banner-badge">
          <CheckCircle2 size={16} color="#10B981" />
          <span>Real-Time Reconciled</span>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="accounts-cards-grid">
        {accounts.map((acc) => {
          const AccIcon = getAccountIcon(acc.type);
          const isSelected = selectedAccount?.id === acc.id;

          return (
            <div
              key={acc.id}
              className={`account-card ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedAccount(acc)}
            >
              <div className="acc-card-top">
                <div className="acc-icon-box">
                  <AccIcon size={20} className="text-blue" />
                </div>
                <div className="acc-badges">
                  {acc.isDefault && <span className="default-badge">PRIMARY</span>}
                  <span className="type-badge">{acc.type}</span>
                </div>
              </div>

              <div className="acc-card-name">{acc.name}</div>
              {acc.bankName && <div className="acc-card-bank">{acc.bankName} {acc.accountNumber ? `(•••• ${acc.accountNumber.slice(-4)})` : ''}</div>}
              {acc.upiId && <div className="acc-card-bank font-mono">{acc.upiId}</div>}

              <div className="acc-balance-block">
                <span className="balance-label">Current Balance</span>
                <div className="balance-num font-mono">{fmtCurrency(acc.currentBalance)}</div>
              </div>

              <div className="acc-card-footer" onClick={(e) => e.stopPropagation()}>
                <span className="click-hint">{isSelected ? 'Viewing statement below' : 'Click to view register'}</span>
                <div className="acc-card-actions">
                  <button onClick={() => handleOpenEdit(acc)} className="btn-icon small" title="Edit Account">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => setDeleteConfirmAccount(acc)} className="btn-icon small delete" title="Archive Account">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="account-empty-card" onClick={handleOpenAdd}>
            <Plus size={28} className="text-blue" />
            <div className="add-text">Add your first bank account or wallet</div>
            <span className="add-sub">Track balances and link payments</span>
          </div>
        )}
      </div>

      {/* Account Statement / Transaction Register Drilldown */}
      {selectedAccount && (
        <div className="ledger-table-card" style={{ marginTop: '24px' }}>
          <div className="statement-header">
            <div>
              <h3 className="statement-title">{selectedAccount.name} — Transaction Statement</h3>
              <span className="statement-sub">
                Live calculated balance: <strong>{fmtCurrency(selectedAccount.currentBalance)}</strong>
              </span>
            </div>
            <button onClick={() => setSelectedAccount(null)} className="btn-secondary small">Close Statement</button>
          </div>

          {loadingTx ? (
            <div className="ledger-loading-state">
              <div className="spinner" />
              <span>Loading account register...</span>
            </div>
          ) : accountTransactions.length === 0 ? (
            <div className="ledger-empty-state" style={{ padding: '30px' }}>
              <Wallet size={32} className="empty-icon" />
              <h4>No transactions on record for this account yet</h4>
              <p>When you record income, expenses, or invoice settlements into this account, entries will appear here.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="ledger-data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Party / Description</th>
                    <th>Method</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {accountTransactions.map((t) => (
                    <tr key={t.id}>
                      <td><span className="font-mono">{t.transactionDate}</span></td>
                      <td>
                        <span className={`tx-type-pill ${t.type}`}>
                          {t.type === 'income' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                          {t.type.toUpperCase()}
                        </span>
                      </td>
                      <td><span className="tx-cat-badge">{t.category}</span></td>
                      <td>
                        <div className="tx-party-name">{t.counterparty || t.description || '—'}</div>
                        {t.referenceNumber && <span className="tx-ref">Ref: {t.referenceNumber}</span>}
                      </td>
                      <td><span className="tx-method-pill">{t.paymentMethod}</span></td>
                      <td>
                        <span className={`font-mono font-bold ${t.type === 'income' ? 'text-green' : 'text-navy'}`}>
                          {t.type === 'income' ? '+' : '-'}{fmtCurrency(t.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {modalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card">
            <div className="modal-header">
              <h3>{editingAccount ? 'Edit Account' : 'Link / Add Financial Account'}</h3>
              <button onClick={() => setModalOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {formError && <div className="modal-alert error">{formError}</div>}

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Account Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HDFC Current A/C or Office Petty Cash"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Account Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="form-input"
                  >
                    <option value="Bank Account">Bank Account</option>
                    <option value="UPI">UPI Handle / ID</option>
                    <option value="Cash">Petty Cash Drawer</option>
                    <option value="Wallet">Digital Wallet</option>
                    <option value="Other">Other Reserve</option>
                  </select>
                </div>
              </div>

              {formData.type === 'Bank Account' && (
                <>
                  <div className="form-group-grid">
                    <div>
                      <label className="form-label">Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC Bank, ICICI, SBI"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Account Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 50200012345678"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        className="form-input font-mono"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC0001234"
                      value={formData.ifscCode}
                      onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                      className="form-input font-mono"
                    />
                  </div>
                </>
              )}

              {formData.type === 'UPI' && (
                <div className="form-group">
                  <label className="form-label">UPI ID / VPA</label>
                  <input
                    type="text"
                    placeholder="e.g. company@okhdfcbank"
                    value={formData.upiId}
                    onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              )}

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#344054' }}>
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    />
                    <span>Set as primary default account</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving Account…' : editingAccount ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmAccount && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card small">
            <div className="modal-header">
              <h3>Archive Account</h3>
              <button onClick={() => setDeleteConfirmAccount(null)} className="close-btn"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475467', lineHeight: 1.5 }}>
                Are you sure you want to archive <strong>{deleteConfirmAccount.name}</strong>?
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setDeleteConfirmAccount(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger">
                {saving ? 'Archiving…' : 'Archive Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
