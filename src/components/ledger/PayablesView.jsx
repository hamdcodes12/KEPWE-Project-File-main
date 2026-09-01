import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Calendar,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  CreditCard,
  Building2,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  FileSpreadsheet
} from 'lucide-react';
import {
  fetchLedgerPayables,
  createLedgerPayable,
  recordPayablePayment,
  deleteLedgerPayable
} from '../../api/ledgerClient';

export default function PayablesView({ accounts = [], onMutationSuccess }) {
  const [payables, setPayables] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [deleteConfirmBill, setDeleteConfirmBill] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Create Bill Form State
  const [billForm, setBillForm] = useState({
    billNumber: '',
    vendorName: '',
    vendorEmail: '',
    vendorPhone: '',
    vendorGstin: '',
    category: 'Software & Cloud Tools',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    subtotal: '',
    taxAmount: '0',
    totalAmount: '',
    status: 'Pending',
    notes: '',
  });

  // Record Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    accountId: accounts[0]?.id || '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Bank Transfer',
    referenceNumber: '',
    notes: '',
  });

  const loadPayables = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchLedgerPayables({
        search,
        status: statusFilter,
        dateFrom,
        dateTo,
        page,
        limit: 20,
      });
      if (res.ok) {
        setPayables(res.data.payables || []);
        setTotalCount(res.data.totalCount || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setError(res.data?.error || 'Failed to load bills');
      }
    } catch (err) {
      setError(err.message || 'Error loading bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayables();
  }, [search, statusFilter, dateFrom, dateTo, page]);

  // Aggregate Metrics for Top Banner
  const totalBilled = payables.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalPaid = payables.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalOutstanding = payables.reduce((sum, p) => sum + p.outstandingAmount, 0);
  const overdueCount = payables.filter((p) => p.status === 'Overdue').length;

  const handleOpenCreate = () => {
    setBillForm({
      billNumber: `BILL-${Date.now().toString().slice(-6)}`,
      vendorName: '',
      vendorEmail: '',
      vendorPhone: '',
      vendorGstin: '',
      category: 'Software & Cloud Tools',
      billDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      subtotal: '',
      taxAmount: '0',
      totalAmount: '',
      status: 'Pending',
      notes: '',
    });
    setModalError('');
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!billForm.vendorName.trim()) {
      setModalError('Vendor name is required.');
      return;
    }
    const tot = Number(billForm.totalAmount || billForm.subtotal);
    if (!tot || tot <= 0) {
      setModalError('Please enter a valid bill amount.');
      return;
    }
    setSaving(true);
    setModalError('');

    try {
      const res = await createLedgerPayable({
        ...billForm,
        subtotal: Number(billForm.subtotal || tot),
        taxAmount: Number(billForm.taxAmount || 0),
        totalAmount: tot,
      });

      if (res.ok) {
        setCreateModalOpen(false);
        loadPayables();
        if (onMutationSuccess) onMutationSuccess();
      } else {
        setModalError(res.data?.error || 'Failed to create bill');
      }
    } catch (err) {
      setModalError(err.message || 'Error creating bill');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPayment = (bill) => {
    setSelectedBill(bill);
    setPaymentForm({
      amount: bill.outstandingAmount,
      accountId: accounts[0]?.id || '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Bank Transfer',
      referenceNumber: '',
      notes: `Payout for bill #${bill.billNumber}`,
    });
    setModalError('');
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBill) return;
    const payAmt = Number(paymentForm.amount);
    if (!payAmt || payAmt <= 0) {
      setModalError('Please enter a valid payment amount.');
      return;
    }
    if (payAmt > selectedBill.outstandingAmount + 0.01) {
      setModalError(`Payment cannot exceed remaining dues of ₹${selectedBill.outstandingAmount}`);
      return;
    }
    setSaving(true);
    setModalError('');

    try {
      const res = await recordPayablePayment(selectedBill.id, {
        ...paymentForm,
        amount: payAmt,
        accountId: paymentForm.accountId || null,
      });

      if (res.ok) {
        setPaymentModalOpen(false);
        setSelectedBill(null);
        loadPayables();
        if (onMutationSuccess) onMutationSuccess();
      } else {
        setModalError(res.data?.error || 'Failed to record bill payment');
      }
    } catch (err) {
      setModalError(err.message || 'Error recording payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmBill) return;
    setSaving(true);
    try {
      const res = await deleteLedgerPayable(deleteConfirmBill.id);
      if (res.ok) {
        setDeleteConfirmBill(null);
        loadPayables();
        if (onMutationSuccess) onMutationSuccess();
      }
    } finally {
      setSaving(false);
    }
  };

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="ledger-view-container">
      {/* Header */}
      <div className="ledger-view-header">
        <div>
          <h2 className="ledger-view-title">Payables & Vendor Bills</h2>
          <p className="ledger-view-sub">Manage supplier invoices, schedule vendor payouts, and prevent late penalty fees.</p>
        </div>
        <div className="ledger-view-actions">
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus size={16} /> New Vendor Bill
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="ledger-metrics-strip">
        <div className="metric-strip-card">
          <span className="strip-label">TOTAL BILLED</span>
          <span className="strip-val font-mono">{fmtCurrency(totalBilled)}</span>
          <span className="strip-sub">Vendor invoices on record</span>
        </div>
        <div className="metric-strip-card">
          <span className="strip-label">TOTAL PAID OUT</span>
          <span className="strip-val text-green font-mono">{fmtCurrency(totalPaid)}</span>
          <span className="strip-sub">Debited from accounts</span>
        </div>
        <div className="metric-strip-card highlight">
          <span className="strip-label">OUTSTANDING PAYABLES</span>
          <span className="strip-val text-navy font-mono">{fmtCurrency(totalOutstanding)}</span>
          <span className="strip-sub">Pending vendor obligations</span>
        </div>
        <div className="metric-strip-card">
          <span className="strip-label">OVERDUE BILLS</span>
          <span className={`strip-val font-mono ${overdueCount > 0 ? 'text-red' : ''}`}>{overdueCount}</span>
          <span className="strip-sub">{overdueCount > 0 ? 'Requires immediate disbursement' : 'All payouts on schedule'}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ledger-filter-card">
        <div className="filter-search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by vendor name, bill #..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="filter-search-input"
          />
          {search && <button onClick={() => setSearch('')} className="clear-btn"><X size={14} /></button>}
        </div>

        <div className="filter-controls-row">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="filter-select">
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>

          <div className="custom-date-inputs">
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="date-input" title="Due from date" />
            <span>to</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="date-input" title="Due to date" />
          </div>
        </div>
      </div>

      {/* Payables Table */}
      <div className="ledger-table-card">
        {loading ? (
          <div className="ledger-loading-state">
            <div className="spinner" />
            <span>Loading vendor bills...</span>
          </div>
        ) : error ? (
          <div className="ledger-error-state">
            <AlertCircle size={24} color="#EF4444" />
            <span>{error}</span>
          </div>
        ) : payables.length === 0 ? (
          <div className="ledger-empty-state">
            <FileSpreadsheet size={42} className="empty-icon" />
            <h3>No payables found</h3>
            <p>
              {search || statusFilter
                ? 'No vendor bills match your selected filters.'
                : 'Log supplier bills and vendor invoices to keep cash outflows organized.'}
            </p>
            <button onClick={handleOpenCreate} className="btn-primary">
              <Plus size={16} /> Log First Vendor Bill
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payables.map((bill) => (
                  <tr key={bill.id}>
                    <td>
                      <span className="font-mono font-bold text-navy">{bill.billNumber}</span>
                    </td>
                    <td>
                      <div className="tx-party-name">{bill.vendorName}</div>
                      {bill.vendorEmail && <div className="tx-ref">{bill.vendorEmail}</div>}
                    </td>
                    <td><span className="tx-cat-badge">{bill.category}</span></td>
                    <td>
                      <div className="tx-date-cell">
                        <Calendar size={13} className="cell-icon" />
                        <span className={`font-mono ${bill.status === 'Overdue' ? 'text-red font-bold' : ''}`}>{bill.dueDate}</span>
                      </div>
                    </td>
                    <td><span className="font-mono font-bold">{fmtCurrency(bill.totalAmount)}</span></td>
                    <td><span className="font-mono text-green">{fmtCurrency(bill.paidAmount)}</span></td>
                    <td><span className="font-mono font-bold text-navy">{fmtCurrency(bill.outstandingAmount)}</span></td>
                    <td>
                      <span className={`status-pill ${bill.status.toLowerCase().replace(' ', '-')}`}>
                        {bill.status === 'Paid' && <CheckCircle2 size={12} />}
                        {bill.status === 'Overdue' && <AlertCircle size={12} />}
                        {bill.status === 'Pending' && <Clock size={12} />}
                        <span>{bill.status}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions">
                        {bill.status !== 'Paid' && (
                          <button
                            onClick={() => handleOpenPayment(bill)}
                            className="btn-action-primary"
                            title="Record Payout"
                          >
                            <CreditCard size={13} /> Pay Bill
                          </button>
                        )}
                        <button onClick={() => setDeleteConfirmBill(bill)} className="btn-icon delete" title="Delete Bill">
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
            <span className="pagination-info">Page {page} of {totalPages} ({totalCount} bills)</span>
            <div className="pagination-controls">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-icon"><ChevronLeft size={16} /></button>
              <span className="current-page-num">{page}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-icon"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Create Bill Modal */}
      {createModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card large">
            <div className="modal-header">
              <h3>Log Vendor Bill</h3>
              <button onClick={() => setCreateModalOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form">
              {modalError && <div className="modal-alert error">{modalError}</div>}

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Vendor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amazon Web Services Inc"
                    value={billForm.vendorName}
                    onChange={(e) => setBillForm({ ...billForm, vendorName: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Bill / Invoice Reference #</label>
                  <input
                    type="text"
                    value={billForm.billNumber}
                    onChange={(e) => setBillForm({ ...billForm, billNumber: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Expense Category</label>
                  <select
                    value={billForm.category}
                    onChange={(e) => setBillForm({ ...billForm, category: e.target.value })}
                    className="form-input"
                  >
                    <option value="Software & Cloud Tools">Software & Cloud Tools</option>
                    <option value="Office Rent & Utilities">Office Rent & Utilities</option>
                    <option value="Salaries & Contractor Fees">Salaries & Contractor Fees</option>
                    <option value="Marketing & Advertising">Marketing & Advertising</option>
                    <option value="Inventory & Supplies">Inventory & Supplies</option>
                    <option value="Legal & Professional Fees">Legal & Professional Fees</option>
                    <option value="Purchases">Purchases / Raw Material</option>
                    <option value="General & Administrative">General & Administrative</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Vendor GSTIN</label>
                  <input
                    type="text"
                    placeholder="e.g. 07AAAAA0000A1Z5"
                    value={billForm.vendorGstin}
                    onChange={(e) => setBillForm({ ...billForm, vendorGstin: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Bill Date</label>
                  <input
                    type="date"
                    required
                    value={billForm.billDate}
                    onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={billForm.dueDate}
                    onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Subtotal (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 24800"
                    value={billForm.subtotal}
                    onChange={(e) => {
                      const sub = e.target.value;
                      const tax = billForm.taxAmount || '0';
                      setBillForm({
                        ...billForm,
                        subtotal: sub,
                        totalAmount: String(Number(sub || 0) + Number(tax || 0)),
                      });
                    }}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="form-label">Tax / GST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={billForm.taxAmount}
                    onChange={(e) => {
                      const tax = e.target.value;
                      const sub = billForm.subtotal || '0';
                      setBillForm({
                        ...billForm,
                        taxAmount: tax,
                        totalAmount: String(Number(sub || 0) + Number(tax || 0)),
                      });
                    }}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="invoice-total-preview">
                <span>Total Bill Amount:</span>
                <span className="preview-val font-mono">
                  {fmtCurrency(billForm.totalAmount || billForm.subtotal || 0)}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. EC2 server instances & database cluster hosting"
                  value={billForm.notes}
                  onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Logging Bill…' : 'Record Vendor Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalOpen && selectedBill && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card">
            <div className="modal-header">
              <h3>Record Vendor Payout</h3>
              <button onClick={() => setPaymentModalOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="modal-form">
              {modalError && <div className="modal-alert error">{modalError}</div>}

              <div className="payment-target-card">
                <div>
                  <div className="target-inv">Bill #{selectedBill.billNumber}</div>
                  <div className="target-cust">{selectedBill.vendorName}</div>
                </div>
                <div className="target-due">
                  <div className="due-label">Outstanding Due:</div>
                  <div className="due-val font-mono">{fmtCurrency(selectedBill.outstandingAmount)}</div>
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Payout Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedBill.outstandingAmount}
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="form-label">Paid From Account *</label>
                  <select
                    value={paymentForm.accountId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, accountId: e.target.value })}
                    className="form-input"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({fmtCurrency(a.currentBalance)})</option>
                    ))}
                    {accounts.length === 0 && <option value="">Direct / Cash</option>}
                  </select>
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="form-input"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Corporate Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference # / Bank UTR #</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-55443322"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setPaymentModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Disbursing Payout…' : `Record ${fmtCurrency(paymentForm.amount || 0)} Payout`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmBill && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card small">
            <div className="modal-header">
              <h3>Delete Vendor Bill</h3>
              <button onClick={() => setDeleteConfirmBill(null)} className="close-btn"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475467', lineHeight: 1.5 }}>
                Are you sure you want to delete bill <strong>#{deleteConfirmBill.billNumber}</strong> from{' '}
                <strong>{deleteConfirmBill.vendorName}</strong> ({fmtCurrency(deleteConfirmBill.totalAmount)})?
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setDeleteConfirmBill(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger">
                {saving ? 'Deleting…' : 'Delete Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
