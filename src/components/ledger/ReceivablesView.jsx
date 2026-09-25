import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Download,
  Calendar,
  User,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  CreditCard,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import {
  fetchLedgerReceivables,
  createLedgerReceivable,
  recordReceivablePayment,
  deleteLedgerReceivable
} from '../../api/ledgerClient';

export default function ReceivablesView({ accounts = [], onMutationSuccess }) {
  const [receivables, setReceivables] = useState([]);
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
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [deleteConfirmInvoice, setDeleteConfirmInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Create Invoice Form State
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    customerGstin: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    subtotal: '',
    taxAmount: '0',
    totalAmount: '',
    status: 'Pending',
    notes: '',
    items: [{ description: 'Professional Services / Product Sale', quantity: 1, unitPrice: 0, amount: 0 }],
  });

  // Record Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    accountId: accounts[0]?.id || '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'UPI',
    referenceNumber: '',
    notes: '',
  });

  const loadReceivables = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchLedgerReceivables({
        search,
        status: statusFilter,
        dateFrom,
        dateTo,
        page,
        limit: 20,
      });
      if (res.ok) {
        setReceivables(res.data.receivables || []);
        setTotalCount(res.data.totalCount || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setError(res.data?.error || 'Failed to load invoices');
      }
    } catch (err) {
      setError(err.message || 'Error loading invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceivables();
  }, [search, statusFilter, dateFrom, dateTo, page]);

  // Aggregate Metrics for Top Banner
  const totalInvoiced = receivables.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalPaid = receivables.reduce((sum, r) => sum + r.paidAmount, 0);
  const totalOutstanding = receivables.reduce((sum, r) => sum + r.outstandingAmount, 0);
  const overdueCount = receivables.filter((r) => r.status === 'Overdue').length;

  const handleOpenCreate = () => {
    setInvoiceForm({
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerGstin: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      subtotal: '',
      taxAmount: '0',
      totalAmount: '',
      status: 'Pending',
      notes: '',
      items: [{ description: 'Main Project Services', quantity: 1, unitPrice: '', amount: 0 }],
    });
    setModalError('');
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!invoiceForm.customerName.trim()) {
      setModalError('Customer name is required.');
      return;
    }
    const tot = Number(invoiceForm.totalAmount || invoiceForm.subtotal);
    if (!tot || tot <= 0) {
      setModalError('Please enter a valid invoice amount.');
      return;
    }
    setSaving(true);
    setModalError('');

    try {
      const res = await createLedgerReceivable({
        ...invoiceForm,
        subtotal: Number(invoiceForm.subtotal || tot),
        taxAmount: Number(invoiceForm.taxAmount || 0),
        totalAmount: tot,
      });

      if (res.ok) {
        setCreateModalOpen(false);
        loadReceivables();
        if (onMutationSuccess) onMutationSuccess();
      } else {
        setModalError(res.data?.error || 'Failed to create invoice');
      }
    } catch (err) {
      setModalError(err.message || 'Error creating invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPayment = (inv) => {
    setSelectedInvoice(inv);
    setPaymentForm({
      amount: inv.outstandingAmount,
      accountId: accounts[0]?.id || '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'UPI',
      referenceNumber: '',
      notes: `Settlement for invoice #${inv.invoiceNumber}`,
    });
    setModalError('');
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const payAmt = Number(paymentForm.amount);
    if (!payAmt || payAmt <= 0) {
      setModalError('Please enter a valid payment amount.');
      return;
    }
    if (payAmt > selectedInvoice.outstandingAmount + 0.01) {
      setModalError(`Payment cannot exceed remaining dues of ₹${selectedInvoice.outstandingAmount}`);
      return;
    }
    setSaving(true);
    setModalError('');

    try {
      const res = await recordReceivablePayment(selectedInvoice.id, {
        ...paymentForm,
        amount: payAmt,
        accountId: paymentForm.accountId || null,
      });

      if (res.ok) {
        setPaymentModalOpen(false);
        setSelectedInvoice(null);
        loadReceivables();
        if (onMutationSuccess) onMutationSuccess();
      } else {
        setModalError(res.data?.error || 'Failed to record payment');
      }
    } catch (err) {
      setModalError(err.message || 'Error recording payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmInvoice) return;
    setSaving(true);
    try {
      const res = await deleteLedgerReceivable(deleteConfirmInvoice.id);
      if (res.ok) {
        setDeleteConfirmInvoice(null);
        loadReceivables();
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
          <h2 className="ledger-view-title">Receivables & Invoicing</h2>
          <p className="ledger-view-sub">Manage customer invoices, track upcoming and overdue payments, and record settlements.</p>
        </div>
        <div className="ledger-view-actions">
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus size={16} /> New Invoice
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="ledger-metrics-strip">
        <div className="metric-strip-card">
          <span className="strip-label">TOTAL INVOICED</span>
          <span className="strip-val font-mono">{fmtCurrency(totalInvoiced)}</span>
          <span className="strip-sub">Total billed to clients</span>
        </div>
        <div className="metric-strip-card">
          <span className="strip-label">COLLECTED AMOUNT</span>
          <span className="strip-val text-green font-mono">{fmtCurrency(totalPaid)}</span>
          <span className="strip-sub">Credited into accounts</span>
        </div>
        <div className="metric-strip-card highlight">
          <span className="strip-label">OUTSTANDING RECEIVABLES</span>
          <span className="strip-val text-blue font-mono">{fmtCurrency(totalOutstanding)}</span>
          <span className="strip-sub">Pending client collection</span>
        </div>
        <div className="metric-strip-card">
          <span className="strip-label">OVERDUE INVOICES</span>
          <span className={`strip-val font-mono ${overdueCount > 0 ? 'text-red' : ''}`}>{overdueCount}</span>
          <span className="strip-sub">{overdueCount > 0 ? 'Immediate follow-up needed' : 'All invoices on track'}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ledger-filter-card">
        <div className="filter-search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by customer name, invoice #..."
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
            <option value="Draft">Draft</option>
          </select>

          <div className="custom-date-inputs">
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="date-input" title="Due from date" />
            <span>to</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="date-input" title="Due to date" />
          </div>
        </div>
      </div>

      {/* Receivables Table */}
      <div className="ledger-table-card">
        {loading ? (
          <div className="ledger-loading-state">
            <div className="spinner" />
            <span>Loading receivables...</span>
          </div>
        ) : error ? (
          <div className="ledger-error-state">
            <AlertCircle size={24} color="#EF4444" />
            <span>{error}</span>
          </div>
        ) : receivables.length === 0 ? (
          <div className="ledger-empty-state">
            <Receipt size={42} className="empty-icon" />
            <h3>No receivables found</h3>
            <p>
              {search || statusFilter
                ? 'No invoices match your selected filters.'
                : 'Create your first invoice to track customer payments and automate receivables aging.'}
            </p>
            <button onClick={handleOpenCreate} className="btn-primary">
              <Plus size={16} /> Create First Invoice
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="ledger-data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <span className="font-mono font-bold text-navy">{inv.invoiceNumber}</span>
                    </td>
                    <td>
                      <div className="tx-party-name">{inv.customerName}</div>
                      {inv.customerEmail && <div className="tx-ref">{inv.customerEmail}</div>}
                    </td>
                    <td><span className="font-mono text-muted">{inv.issueDate}</span></td>
                    <td>
                      <div className="tx-date-cell">
                        <Calendar size={13} className="cell-icon" />
                        <span className={`font-mono ${inv.status === 'Overdue' ? 'text-red font-bold' : ''}`}>{inv.dueDate}</span>
                      </div>
                    </td>
                    <td><span className="font-mono font-bold">{fmtCurrency(inv.totalAmount)}</span></td>
                    <td><span className="font-mono text-green">{fmtCurrency(inv.paidAmount)}</span></td>
                    <td><span className="font-mono font-bold text-blue">{fmtCurrency(inv.outstandingAmount)}</span></td>
                    <td>
                      <span className={`status-pill ${inv.status.toLowerCase().replace(' ', '-')}`}>
                        {inv.status === 'Paid' && <CheckCircle2 size={12} />}
                        {inv.status === 'Overdue' && <AlertCircle size={12} />}
                        {inv.status === 'Pending' && <Clock size={12} />}
                        <span>{inv.status}</span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions">
                        {inv.status !== 'Paid' && (
                          <button
                            onClick={() => handleOpenPayment(inv)}
                            className="btn-action-primary"
                            title="Record Payment"
                          >
                            <CreditCard size={13} /> Record Payment
                          </button>
                        )}
                        <button onClick={() => setDeleteConfirmInvoice(inv)} className="btn-icon delete" title="Delete Invoice">
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
            <span className="pagination-info">Page {page} of {totalPages} ({totalCount} invoices)</span>
            <div className="pagination-controls">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-icon"><ChevronLeft size={16} /></button>
              <span className="current-page-num">{page}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-icon"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {createModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card large">
            <div className="modal-header">
              <h3>Create Customer Invoice</h3>
              <button onClick={() => setCreateModalOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form">
              {modalError && <div className="modal-alert error">{modalError}</div>}

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Digital Media Pvt Ltd"
                    value={invoiceForm.customerName}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customerName: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceForm.invoiceNumber}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Customer Email</label>
                  <input
                    type="email"
                    placeholder="billing@customer.com"
                    value={invoiceForm.customerEmail}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customerEmail: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Customer GSTIN</label>
                  <input
                    type="text"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                    value={invoiceForm.customerGstin}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customerGstin: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Issue Date</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.issueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Subtotal Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 50000"
                    value={invoiceForm.subtotal}
                    onChange={(e) => {
                      const sub = e.target.value;
                      const tax = invoiceForm.taxAmount || '0';
                      setInvoiceForm({
                        ...invoiceForm,
                        subtotal: sub,
                        totalAmount: String(Number(sub || 0) + Number(tax || 0)),
                      });
                    }}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="form-label">GST / Tax Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={invoiceForm.taxAmount}
                    onChange={(e) => {
                      const tax = e.target.value;
                      const sub = invoiceForm.subtotal || '0';
                      setInvoiceForm({
                        ...invoiceForm,
                        taxAmount: tax,
                        totalAmount: String(Number(sub || 0) + Number(tax || 0)),
                      });
                    }}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="invoice-total-preview">
                <span>Total Invoice Payable:</span>
                <span className="preview-val font-mono">
                  {fmtCurrency(invoiceForm.totalAmount || invoiceForm.subtotal || 0)}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Payment Instructions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please wire funds to our primary HDFC Current Account within 15 days."
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Creating Invoice…' : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalOpen && selectedInvoice && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card">
            <div className="modal-header">
              <h3>Record Invoice Payment</h3>
              <button onClick={() => setPaymentModalOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="modal-form">
              {modalError && <div className="modal-alert error">{modalError}</div>}

              <div className="payment-target-card">
                <div>
                  <div className="target-inv">Invoice #{selectedInvoice.invoiceNumber}</div>
                  <div className="target-cust">{selectedInvoice.customerName}</div>
                </div>
                <div className="target-due">
                  <div className="due-label">Outstanding Due:</div>
                  <div className="due-val font-mono">{fmtCurrency(selectedInvoice.outstandingAmount)}</div>
                </div>
              </div>

              <div className="form-group-grid">
                <div>
                  <label className="form-label">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedInvoice.outstandingAmount}
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label className="form-label">Deposit Into Account *</label>
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
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reference # / Transaction UTR</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-99882211"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setPaymentModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Processing Payment…' : `Record ${fmtCurrency(paymentForm.amount || 0)} Payment`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirmInvoice && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card small">
            <div className="modal-header">
              <h3>Delete Invoice</h3>
              <button onClick={() => setDeleteConfirmInvoice(null)} className="close-btn"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475467', lineHeight: 1.5 }}>
                Are you sure you want to delete invoice <strong>#{deleteConfirmInvoice.invoiceNumber}</strong> for{' '}
                <strong>{deleteConfirmInvoice.customerName}</strong> ({fmtCurrency(deleteConfirmInvoice.totalAmount)})?
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setDeleteConfirmInvoice(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger">
                {saving ? 'Deleting…' : 'Delete Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
