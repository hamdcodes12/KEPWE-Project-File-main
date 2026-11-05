import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Trash2,
  Edit2,
  Calendar,
  Wallet,
  Tag,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import {
  fetchLedgerTransactions,
  createLedgerTransaction,
  updateLedgerTransaction,
  deleteLedgerTransaction
} from '../../api/ledgerClient';

export default function TransactionsView({
  accounts = [],
  categories = [],
  onMutationSuccess,
  defaultType = '',
  title = 'Transactions',
  subtitle = 'Manage and audit all financial cash inflows, outflows, and journal entries.'
}) {
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(defaultType);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    type: defaultType || 'expense',
    amount: '',
    transactionDate: new Date().toISOString().split('T')[0],
    category: 'General & Administrative',
    counterparty: '',
    description: '',
    accountId: '',
    paymentMethod: 'UPI',
    referenceNumber: '',
    notes: '',
  });

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchLedgerTransactions({
        search,
        type: typeFilter,
        category: categoryFilter,
        accountId: accountFilter,
        datePreset,
        dateFrom,
        dateTo,
        page,
        limit: 20,
      });
      if (res.ok) {
        setTransactions(res.data.transactions || []);
        setTotalCount(res.data.totalCount || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setError(res.data?.error || 'Failed to load transactions');
      }
    } catch (err) {
      setError(err.message || 'Error loading transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [search, typeFilter, categoryFilter, accountFilter, datePreset, dateFrom, dateTo, page]);

  const handleOpenAdd = () => {
    setEditingTx(null);
    setFormData({
      type: defaultType || 'expense',
      amount: '',
      transactionDate: new Date().toISOString().split('T')[0],
      category: defaultType === 'income' ? 'Sales Revenue' : 'Office Rent & Utilities',
      counterparty: '',
      description: '',
      accountId: accounts[0]?.id || '',
      paymentMethod: 'UPI',
      referenceNumber: '',
      notes: '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (tx) => {
    setEditingTx(tx);
    setFormData({
      type: tx.type,
      amount: tx.amount,
      transactionDate: tx.transactionDate,
      category: tx.category,
      counterparty: tx.counterparty || '',
      description: tx.description || '',
      accountId: tx.accountId || '',
      paymentMethod: tx.paymentMethod || 'UPI',
      referenceNumber: tx.referenceNumber || '',
      notes: tx.notes || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      setFormError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!formData.category) {
      setFormError('Please select a category.');
      return;
    }
    setSaving(true);
    setFormError('');

    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        accountId: formData.accountId || null,
      };
      let res;
      if (editingTx) {
        res = await updateLedgerTransaction(editingTx.id, payload);
      } else {
        res = await createLedgerTransaction(payload);
      }

      if (res.ok) {
        setModalOpen(false);
        loadTransactions();
        if (onMutationSuccess) onMutationSuccess();
      } else {
        setFormError(res.data?.error || 'Failed to save transaction');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmTx) return;
    setSaving(true);
    try {
      const res = await deleteLedgerTransaction(deleteConfirmTx.id);
      if (res.ok) {
        setDeleteConfirmTx(null);
        loadTransactions();
        if (onMutationSuccess) onMutationSuccess();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Date', 'Type', 'Amount', 'Category', 'Counterparty', 'Account', 'Payment Method', 'Reference', 'Description'];
    const rows = transactions.map((t) => [
      t.transactionDate,
      t.type.toUpperCase(),
      t.amount,
      `"${t.category || ''}"`,
      `"${t.counterparty || ''}"`,
      `"${t.accountName || ''}"`,
      t.paymentMethod || '',
      `"${t.referenceNumber || ''}"`,
      `"${t.description || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledger_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="ledger-view-container">
      {/* Header */}
      <div className="ledger-view-header">
        <div>
          <h2 className="ledger-view-title">{title}</h2>
          <p className="ledger-view-sub">{subtitle}</p>
        </div>
        <div className="ledger-view-actions">
          <button onClick={handleExportCSV} className="btn-secondary" disabled={transactions.length === 0}>
            <Download size={16} /> Export CSV
          </button>
          <button onClick={handleOpenAdd} className="btn-primary">
            <Plus size={16} /> Add {defaultType === 'income' ? 'Income' : defaultType === 'expense' ? 'Expense' : 'Transaction'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ledger-filter-card">
        <div className="filter-search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search description, counterparty, reference #..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="filter-search-input"
          />
          {search && <button onClick={() => setSearch('')} className="clear-btn"><X size={14} /></button>}
        </div>

        <div className="filter-controls-row">
          {!defaultType && (
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="filter-select">
              <option value="">All Types</option>
              <option value="income">Income (+)</option>
              <option value="expense">Expense (-)</option>
            </select>
          )}

          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="filter-select">
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c.name} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setPage(1); }} className="filter-select">
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({fmtCurrency(a.currentBalance)})</option>
            ))}
          </select>

          <select value={datePreset} onChange={(e) => { setDatePreset(e.target.value); setPage(1); }} className="filter-select">
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>

          {datePreset === 'custom' && (
            <div className="custom-date-inputs">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="date-input" />
              <span>to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="date-input" />
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="ledger-table-card">
        {loading ? (
          <div className="ledger-loading-state">
            <div className="spinner" />
            <span>Loading transactions from database...</span>
          </div>
        ) : error ? (
          <div className="ledger-error-state">
            <AlertCircle size={24} color="#EF4444" />
            <span>{error}</span>
            <button onClick={loadTransactions} className="btn-secondary" style={{ marginTop: '10px' }}>Try Again</button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="ledger-empty-state">
            <FileText size={42} className="empty-icon" />
            <h3>No transactions found</h3>
            <p>
              {search || typeFilter || categoryFilter || datePreset !== 'all'
                ? 'No transactions match your filter criteria.'
                : 'Start recording your income and expenses to manage your live financial ledger.'}
            </p>
            <button onClick={handleOpenAdd} className="btn-primary">
              <Plus size={16} /> Record First Transaction
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Counterparty / Party</th>
                  <th>Account</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <div className="tx-date-cell">
                        <Calendar size={13} className="cell-icon" />
                        <span>{tx.transactionDate}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`tx-type-pill ${tx.type === 'income' ? 'income' : 'expense'}`}>
                        {tx.type === 'income' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                        {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="tx-cat-badge">{tx.category}</span>
                      {tx.description && <div className="tx-sub-desc">{tx.description}</div>}
                    </td>
                    <td>
                      <span className="tx-party-name">{tx.counterparty || '—'}</span>
                      {tx.referenceNumber && <span className="tx-ref">Ref: {tx.referenceNumber}</span>}
                    </td>
                    <td>
                      <div className="tx-acc-cell">
                        <Wallet size={13} className="cell-icon" />
                        <span>{tx.accountName}</span>
                      </div>
                    </td>
                    <td><span className="tx-method-pill">{tx.paymentMethod}</span></td>
                    <td>
                      <span className={`tx-amt-cell font-mono ${tx.type === 'income' ? 'text-green' : 'text-navy'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmtCurrency(tx.amount)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions">
                        <button onClick={() => handleOpenEdit(tx)} className="btn-icon" title="Edit Transaction">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => setDeleteConfirmTx(tx)} className="btn-icon delete" title="Delete Transaction">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="table-pagination">
            <span className="pagination-info">
              Showing page {page} of {totalPages} ({totalCount} total entries)
            </span>
            <div className="pagination-controls">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-icon">
                <ChevronLeft size={16} />
              </button>
              <span className="current-page-num">{page}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-icon">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      {modalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card">
            <div className="modal-header">
              <h3>{editingTx ? 'Edit Transaction' : 'Record New Transaction'}</h3>
              <button onClick={() => setModalOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {formError && <div className="modal-alert error">{formError}</div>}

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Transaction Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="form-input"
                    disabled={Boolean(defaultType)}
                  >
                    <option value="income">Income (+ Inflow)</option>
                    <option value="expense">Expense (- Outflow)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Amount (₹ INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 5000.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.transactionDate}
                    onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-input"
                  >
                    {categories
                      .filter((c) => !formData.type || c.type === formData.type)
                      .map((c) => (
                        <option key={c.id || c.name} value={c.name}>{c.name}</option>
                      ))}
                    {categories.length === 0 && <option value="General">General</option>}
                  </select>
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Account</label>
                  <select
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="form-input"
                  >
                    <option value="">Direct / Cash (No specific account)</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({fmtCurrency(a.currentBalance)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="form-input"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Customer / Vendor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Media or Amazon AWS"
                    value={formData.counterparty}
                    onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Reference # / UTR / Invoice #</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR12345678"
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly cloud server infrastructure retainer"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving to Ledger…' : editingTx ? 'Update Entry' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTx && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card small">
            <div className="modal-header">
              <h3>Delete Transaction</h3>
              <button onClick={() => setDeleteConfirmTx(null)} className="close-btn"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475467', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete this <strong>{deleteConfirmTx.type}</strong> entry of{' '}
                <strong>{fmtCurrency(deleteConfirmTx.amount)}</strong>?
              </p>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '8px' }}>
                All dashboard totals, reports, and linked account balances will automatically reverse.
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setDeleteConfirmTx(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger">
                {saving ? 'Deleting…' : 'Yes, Delete Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
