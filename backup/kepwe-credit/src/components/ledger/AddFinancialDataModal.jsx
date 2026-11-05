import React, { useState, useRef } from 'react';
import './AddFinancialDataModal.css';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Landmark,
  Wallet,
  Smartphone,
  Image as ImageIcon,
  PlusCircle,
  TrendingUp,
  Repeat,
  ArrowRight,
  ArrowLeft,
  Trash2,
  ShieldCheck,
  Check,
  Filter,
  DollarSign
} from 'lucide-react';
import {
  parseLedgerData,
  commitLedgerImport,
  recordLedgerMonthlyIncome,
  recordLedgerRecurringExpense,
  createLedgerTransaction
} from '../../api/ledgerClient';

const SOURCES = [
  { id: 'BANK_STATEMENT_PDF', name: 'Bank Statement (PDF)', category: 'STATEMENT', icon: Landmark, color: 'blue', desc: 'Official monthly account statement from HDFC, SBI, ICICI, Axis, etc.', badge: 'PDF' },
  { id: 'BANK_STATEMENT_CSV', name: 'Bank Statement (CSV / Excel)', category: 'STATEMENT', icon: FileText, color: 'green', desc: 'Transaction export in .csv or .xlsx spreadsheet format.', badge: 'CSV / XLSX' },
  { id: 'UPI_STATEMENT', name: 'UPI Statement', category: 'STATEMENT', icon: Smartphone, color: 'purple', desc: 'Google Pay, PhonePe, Paytm, or BHIM transaction export.', badge: 'UPI' },
  { id: 'CREDIT_CARD', name: 'Credit Card Statement', category: 'STATEMENT', icon: CreditCard, color: 'amber', desc: 'Monthly card bill statement with purchases, charges, and refunds.', badge: 'Card' },
  { id: 'DEBIT_CARD', name: 'Debit Card Statement', category: 'STATEMENT', icon: CreditCard, color: 'blue', desc: 'Direct POS and debit card account ledger transactions.', badge: 'Debit' },
  { id: 'WALLET', name: 'Wallet Statement', category: 'STATEMENT', icon: Wallet, color: 'green', desc: 'Paytm, PhonePe, Amazon Pay wallet statement.', badge: 'Wallet' },
  { id: 'SCREENSHOT', name: 'Screenshot / Receipt Image', category: 'OCR', icon: ImageIcon, color: 'rose', desc: 'Payment receipt image parsed via real OCR recognition.', badge: 'OCR Image' },
  { id: 'MANUAL', name: 'Manual Transaction Entry', category: 'MANUAL', icon: PlusCircle, color: 'blue', desc: 'Record a single custom income, expense, or investment entry.', badge: 'Direct' },
  { id: 'MONTHLY_INCOME', name: 'Monthly Income Stream', category: 'INCOME', icon: TrendingUp, color: 'green', desc: 'Set up recurring monthly salary, business, or freelance income.', badge: 'Income' },
  { id: 'RECURRING_EXPENSE', name: 'Committed Recurring Expense', category: 'EXPENSE', icon: Repeat, color: 'amber', desc: 'Record rent, loan EMI, insurance, or subscription obligations.', badge: 'Recurring' },
];

const PRD_CATEGORIES = [
  'Groceries',
  'Dining & Food Delivery',
  'Housing & Rent',
  'Utilities',
  'Travel & Commute',
  'Shopping',
  'Entertainment & Subscriptions',
  'Healthcare & Medical',
  'Investments',
  'Credit Card Payment',
  'Loan EMI',
  'Insurance',
  'Salary',
  'Freelance Income',
  'Business Income',
  'Investment Returns',
  'Taxes',
  'General & Administrative',
  'Other Income',
  'Uncategorized Expense'
];

export default function AddFinancialDataModal({ isOpen, onClose, accounts = [], onSuccess }) {
  if (!isOpen) return null;

  // Workflow Steps: 'SOURCE' -> 'INPUT' -> 'PROCESSING' -> 'REVIEW' -> 'SUCCESS'
  const [step, setStep] = useState('SOURCE');
  const [selectedSource, setSelectedSource] = useState(SOURCES[0]);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [institution, setInstitution] = useState('HDFC Bank');

  // File Upload State
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Processing State
  const [processingStatus, setProcessingStatus] = useState('Uploading and validating statement...');
  const [errorMsg, setErrorMsg] = useState('');
  const [successSummary, setSuccessSummary] = useState(null);

  // Review State (Crucial PRD Step 6)
  const [parsedTransactions, setParsedTransactions] = useState([]);
  const [reviewFilter, setReviewFilter] = useState('ALL'); // 'ALL' | 'DUPLICATES' | 'NEEDS_REVIEW'
  const [isSubmittingCommit, setIsSubmittingCommit] = useState(false);

  // Direct Entry Forms
  const [manualForm, setManualForm] = useState({
    amount: '',
    type: 'expense',
    category: 'Groceries',
    merchant: '',
    counterparty: '',
    classification: 'Essential',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'UPI',
    referenceNumber: '',
    isRecurring: false,
    description: '',
  });

  const [incomeForm, setIncomeForm] = useState({
    sourceType: 'salary',
    amount: '',
    employerOrClient: '',
    depositDate: new Date().toISOString().slice(0, 10),
    isRecurring: true,
    notes: '',
  });

  const [recurringForm, setRecurringForm] = useState({
    expenseType: 'Rent',
    amount: '',
    payee: '',
    dueDate: new Date().toISOString().slice(0, 10),
    frequency: 'monthly',
    classification: 'Essential',
    notes: '',
  });

  // Handle Drag & Drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (selectedFile) => {
    setErrorMsg('');
    if (!selectedFile) return;

    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 15MB limit. Please upload a smaller statement file.');
      return;
    }
    if (selectedFile.size === 0) {
      setErrorMsg('The selected file is empty. Please select a valid financial statement.');
      return;
    }

    setFile(selectedFile);
  };

  // Step 3 & 4: Process File & Move to Review
  const handleProcessFile = async () => {
    if (!file) {
      setErrorMsg('Please select a financial statement file to upload.');
      return;
    }

    setErrorMsg('');
    setStep('PROCESSING');
    setProcessingStatus('Uploading and validating financial statement...');

    try {
      // Read as Base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          resolve(typeof res === 'string' ? res.split(',')[1] : '');
        };
        reader.onerror = () => reject(new Error('Failed to read file from filesystem.'));
        reader.readAsDataURL(file);
      });

      setProcessingStatus('Extracting financial tables and transactions...');

      const response = await parseLedgerData({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
        sourceType: selectedSource.id.startsWith('BANK') ? 'BANK_STATEMENT' : selectedSource.id,
        institution,
        accountId: selectedAccountId || null,
      });

      if (!response.ok) {
        throw new Error(response.data?.error || 'Failed to process statement file.');
      }

      setProcessingStatus('Analyzing duplicate records and PRD classifications...');

      const txs = (response.data?.transactions || []).map((t, idx) => ({
        ...t,
        tempId: `staged_${idx}_${Date.now()}`,
        included: !t.isDuplicate, // default exclude exact duplicates to protect user
      }));

      if (txs.length === 0) {
        throw new Error('No transactions could be extracted from this statement.');
      }

      setParsedTransactions(txs);
      setStep('REVIEW');
    } catch (err) {
      setErrorMsg(err.message || 'Error occurred during statement parsing.');
      setStep('INPUT');
    }
  };

  // Step 4 Actions: Row Editing in Review Screen
  const handleToggleInclude = (tempId) => {
    setParsedTransactions((prev) =>
      prev.map((t) => (t.tempId === tempId ? { ...t, included: !t.included } : t))
    );
  };

  const handleUpdateRowField = (tempId, field, value) => {
    setParsedTransactions((prev) =>
      prev.map((t) => (t.tempId === tempId ? { ...t, [field]: value } : t))
    );
  };

  const handleSelectAll = (includedVal) => {
    setParsedTransactions((prev) => prev.map((t) => ({ ...t, included: includedVal })));
  };

  // Step 5: Final Commit to PostgreSQL Database
  const handleCommitReview = async () => {
    const confirmed = parsedTransactions.filter((t) => t.included);
    if (confirmed.length === 0) {
      setErrorMsg('Please select at least one transaction to import into the Ledger.');
      return;
    }

    setIsSubmittingCommit(true);
    setErrorMsg('');

    try {
      const response = await commitLedgerImport({
        fileName: file?.name || `${selectedSource.name} Import`,
        fileType: file?.name?.toLowerCase().endsWith('.pdf') ? 'PDF' : file?.name?.toLowerCase().endsWith('.xlsx') ? 'XLSX' : 'CSV',
        sourceType: selectedSource.id,
        institution,
        accountId: selectedAccountId || null,
        duplicateCount: parsedTransactions.filter((t) => t.isDuplicate).length,
        originalCount: parsedTransactions.length,
        transactions: confirmed.map((t) => ({
          date: t.date,
          amount: Number(t.amount),
          type: t.type,
          category: t.category,
          subcategory: t.subcategory || null,
          merchant: t.merchant || null,
          counterparty: t.counterparty || t.merchant || null,
          classification: t.classification || 'Essential',
          isRecurring: Boolean(t.isRecurring),
          isEssential: t.classification === 'Essential',
          confidence: Number(t.confidence) || 1.0,
          paymentMethod: t.paymentMethod || 'UPI',
          referenceNumber: t.referenceNumber || null,
          description: t.description || null,
          balance: t.balance !== null && t.balance !== undefined ? Number(t.balance) : null,
        })),
      });

      if (!response.ok) {
        throw new Error(response.data?.error || 'Database persistence failed.');
      }

      setSuccessSummary({
        type: 'STATEMENT',
        importedCount: confirmed.length,
        institution,
        fileName: file?.name || selectedSource.name,
      });

      setStep('SUCCESS');
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save confirmed transactions.');
    } finally {
      setIsSubmittingCommit(false);
    }
  };

  // Direct Forms Submissions (Sources 8, 9, 10)
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.amount || Number(manualForm.amount) <= 0) {
      setErrorMsg('Please enter a valid amount greater than zero.');
      return;
    }

    setIsSubmittingCommit(true);
    setErrorMsg('');

    try {
      const res = await createLedgerTransaction({
        type: manualForm.type,
        amount: Number(manualForm.amount),
        transactionDate: manualForm.date,
        category: manualForm.category,
        merchant: manualForm.merchant || manualForm.counterparty || null,
        counterparty: manualForm.counterparty || manualForm.merchant || null,
        classification: manualForm.classification,
        isRecurring: Boolean(manualForm.isRecurring),
        isEssential: manualForm.classification === 'Essential',
        paymentMethod: manualForm.paymentMethod,
        referenceNumber: manualForm.referenceNumber || null,
        description: manualForm.description || null,
        accountId: selectedAccountId || null,
      });

      if (!res.ok) throw new Error(res.data?.error || 'Failed to record manual transaction.');

      setSuccessSummary({
        type: 'MANUAL',
        amount: manualForm.amount,
        merchant: manualForm.merchant || manualForm.category,
      });

      setStep('SUCCESS');
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmittingCommit(false);
    }
  };

  const handleIncomeSubmit = async (e) => {
    e.preventDefault();
    if (!incomeForm.amount || Number(incomeForm.amount) <= 0) {
      setErrorMsg('Please enter a valid income amount.');
      return;
    }

    setIsSubmittingCommit(true);
    setErrorMsg('');

    try {
      const res = await recordLedgerMonthlyIncome({
        sourceType: incomeForm.sourceType,
        amount: Number(incomeForm.amount),
        employerOrClient: incomeForm.employerOrClient || null,
        depositDate: incomeForm.depositDate,
        accountId: selectedAccountId || null,
        isRecurring: incomeForm.isRecurring,
        notes: incomeForm.notes || null,
      });

      if (!res.ok) throw new Error(res.data?.error || 'Failed to record monthly income.');

      setSuccessSummary({
        type: 'MONTHLY_INCOME',
        amount: incomeForm.amount,
        sourceType: incomeForm.sourceType,
      });

      setStep('SUCCESS');
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmittingCommit(false);
    }
  };

  const handleRecurringSubmit = async (e) => {
    e.preventDefault();
    if (!recurringForm.amount || Number(recurringForm.amount) <= 0) {
      setErrorMsg('Please enter a valid expense amount.');
      return;
    }
    if (!recurringForm.payee.trim()) {
      setErrorMsg('Please enter the payee or service provider name (e.g. Landlord, BESCOM, HDFC Bank).');
      return;
    }

    setIsSubmittingCommit(true);
    setErrorMsg('');

    try {
      const res = await recordLedgerRecurringExpense({
        expenseType: recurringForm.expenseType,
        amount: Number(recurringForm.amount),
        payee: recurringForm.payee.trim(),
        dueDate: recurringForm.dueDate,
        frequency: recurringForm.frequency,
        classification: recurringForm.classification,
        accountId: selectedAccountId || null,
        notes: recurringForm.notes || null,
      });

      if (!res.ok) throw new Error(res.data?.error || 'Failed to record recurring expense.');

      setSuccessSummary({
        type: 'RECURRING_EXPENSE',
        amount: recurringForm.amount,
        payee: recurringForm.payee,
        expenseType: recurringForm.expenseType,
      });

      setStep('SUCCESS');
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmittingCommit(false);
    }
  };

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  // Review filtering
  const visibleTransactions = parsedTransactions.filter((t) => {
    if (reviewFilter === 'DUPLICATES') return t.isDuplicate;
    if (reviewFilter === 'NEEDS_REVIEW') return t.needsReview;
    return true;
  });

  const dupCount = parsedTransactions.filter((t) => t.isDuplicate).length;
  const reviewCount = parsedTransactions.filter((t) => t.needsReview).length;
  const confirmedCount = parsedTransactions.filter((t) => t.included).length;

  return (
    <div className="p6-modal-overlay">
      <div className="p6-modal-card">
        {/* Header */}
        <div className="p6-modal-header">
          <div className="p6-header-left">
            <div className="p6-header-icon">
              <UploadCloud size={22} />
            </div>
            <div>
              <h2 className="p6-title">Add Financial Data</h2>
              <div className="p6-subtitle">
                Bring your financial records securely — zero bank API or banking credentials required.
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p6-close-btn" title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Stepper */}
        <div className="p6-stepper">
          <div className={`p6-step-item ${step === 'SOURCE' ? 'active' : step !== 'SOURCE' ? 'completed' : ''}`}>
            <div className="p6-step-circle">{step !== 'SOURCE' ? <Check size={12} /> : '1'}</div>
            <span>Select Source</span>
          </div>
          <div className="p6-step-sep" />
          <div className={`p6-step-item ${step === 'INPUT' ? 'active' : ['PROCESSING', 'REVIEW', 'SUCCESS'].includes(step) ? 'completed' : ''}`}>
            <div className="p6-step-circle">{['PROCESSING', 'REVIEW', 'SUCCESS'].includes(step) ? <Check size={12} /> : '2'}</div>
            <span>Upload or Enter</span>
          </div>
          <div className="p6-step-sep" />
          <div className={`p6-step-item ${step === 'REVIEW' ? 'active' : step === 'SUCCESS' ? 'completed' : ''}`}>
            <div className="p6-step-circle">{step === 'SUCCESS' ? <Check size={12} /> : '3'}</div>
            <span>Review & Classify</span>
          </div>
          <div className="p6-step-sep" />
          <div className={`p6-step-item ${step === 'SUCCESS' ? 'active' : ''}`}>
            <div className="p6-step-circle">4</div>
            <span>Confirmed to Ledger</span>
          </div>
        </div>

        {/* Body */}
        <div className="p6-modal-body">
          {errorMsg && (
            <div className="p6-alert danger">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: CHOOSE DATA SOURCE */}
          {step === 'SOURCE' && (
            <div>
              <span className="p6-form-label">Step 1: Choose Financial Data Source</span>
              <div className="p6-source-grid">
                {SOURCES.map((s) => {
                  const Icon = s.icon;
                  const isSelected = selectedSource.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSource(s)}
                      className={`p6-source-card ${isSelected ? 'selected' : ''}`}
                    >
                      <div className={`p6-src-icon ${s.color}`}>
                        <Icon size={20} />
                      </div>
                      <div className="p6-src-title">{s.name}</div>
                      <div className="p6-src-desc">{s.desc}</div>
                      <div className="p6-src-badge">{s.badge}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: UPLOAD OR ENTER FORM */}
          {step === 'INPUT' && (
            <div>
              {/* If File Upload Source (1 to 7) */}
              {['STATEMENT', 'OCR'].includes(selectedSource.category) && (
                <div className="p6-upload-container">
                  <div className="p6-config-grid">
                    <div className="p6-form-group">
                      <label className="p6-form-label">Institution / Platform</label>
                      <select
                        className="p6-form-select"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                      >
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="State Bank of India">State Bank of India (SBI)</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="Axis Bank">Axis Bank</option>
                        <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                        <option value="PhonePe">PhonePe UPI</option>
                        <option value="Google Pay">Google Pay UPI</option>
                        <option value="Paytm">Paytm Payments / Wallet</option>
                        <option value="CRED">CRED Club</option>
                        <option value="Direct Statement">Other / Direct Bank</option>
                      </select>
                    </div>

                    <div className="p6-form-group">
                      <label className="p6-form-label">Associate to Financial Account</label>
                      <select
                        className="p6-form-select"
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                      >
                        <option value="">Auto / Default Ledger Account</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.type}) — Bal: {fmtCurrency(acc.currentBalance)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    className={`p6-dropzone ${dragActive ? 'drag-active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      accept={
                        selectedSource.id === 'BANK_STATEMENT_PDF'
                          ? '.pdf'
                          : selectedSource.id === 'SCREENSHOT'
                          ? '.png,.jpg,.jpeg,.webp'
                          : '.csv,.xlsx,.xls,.pdf'
                      }
                      onChange={(e) => handleFileSelected(e.target.files[0])}
                    />
                    <div className="p6-dropzone-icon">
                      <UploadCloud size={28} />
                    </div>
                    <div className="p6-dropzone-title">
                      {file ? file.name : `Select or drag & drop ${selectedSource.name}`}
                    </div>
                    <div className="p6-dropzone-sub">
                      {selectedSource.id === 'SCREENSHOT'
                        ? 'Supports PNG, JPG, or WEBP payment receipt images (Max 15MB)'
                        : selectedSource.id === 'BANK_STATEMENT_PDF'
                        ? 'Supports standard Indian Bank Statement PDFs (Max 15MB)'
                        : 'Supports standard CSV or Excel spreadsheets (.xlsx, .xls) (Max 15MB)'}
                    </div>

                    {file && (
                      <div className="p6-selected-file-badge">
                        <CheckCircle2 size={16} />
                        <span>Ready to analyze: {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Source 8: Manual Transaction Entry */}
              {selectedSource.id === 'MANUAL' && (
                <form onSubmit={handleManualSubmit} className="p6-config-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                  <div className="p6-form-group">
                    <label className="p6-form-label">Type</label>
                    <select
                      className="p6-form-select"
                      value={manualForm.type}
                      onChange={(e) => setManualForm({ ...manualForm, type: e.target.value })}
                    >
                      <option value="expense">Expense (Outflow)</option>
                      <option value="income">Income (Inflow)</option>
                      <option value="investment">Investment (Wealth)</option>
                    </select>
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 850"
                      className="p6-form-input font-mono"
                      value={manualForm.amount}
                      onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Date</label>
                    <input
                      type="date"
                      className="p6-form-input"
                      value={manualForm.date}
                      onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Category</label>
                    <select
                      className="p6-form-select"
                      value={manualForm.category}
                      onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                    >
                      {PRD_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Merchant / Recipient</label>
                    <input
                      type="text"
                      placeholder="e.g. Swiggy, Uber, D-Mart"
                      className="p6-form-input"
                      value={manualForm.merchant}
                      onChange={(e) => setManualForm({ ...manualForm, merchant: e.target.value })}
                    />
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Classification</label>
                    <select
                      className="p6-form-select"
                      value={manualForm.classification}
                      onChange={(e) => setManualForm({ ...manualForm, classification: e.target.value })}
                    >
                      <option value="Essential">Essential (Committed Needs)</option>
                      <option value="Lifestyle">Lifestyle (Discretionary Wants)</option>
                      <option value="Financial">Financial (Savings / Debt / Inv)</option>
                      <option value="Other">Other (Taxes / Fees)</option>
                    </select>
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Payment Method</label>
                    <select
                      className="p6-form-select"
                      value={manualForm.paymentMethod}
                      onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })}
                    >
                      <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Net Banking">Net Banking</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Associate to Account</label>
                    <select
                      className="p6-form-select"
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                    >
                      <option value="">Default Account</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                      ))}
                    </select>
                  </div>
                </form>
              )}

              {/* Source 9: Monthly Income Stream Entry */}
              {selectedSource.id === 'MONTHLY_INCOME' && (
                <form onSubmit={handleIncomeSubmit} className="p6-config-grid">
                  <div className="p6-form-group">
                    <label className="p6-form-label">Income Stream Type</label>
                    <select
                      className="p6-form-select"
                      value={incomeForm.sourceType}
                      onChange={(e) => setIncomeForm({ ...incomeForm, sourceType: e.target.value })}
                    >
                      <option value="salary">Regular Salary (Primary Employment)</option>
                      <option value="business">Business Income / Operational Revenue</option>
                      <option value="freelance">Freelance / Consulting Retainer</option>
                      <option value="rental">Rental Income from Property</option>
                      <option value="other">Other Regular Cash Inflow</option>
                    </select>
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Monthly Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="e.g. 100000"
                      className="p6-form-input font-mono"
                      value={incomeForm.amount}
                      onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Employer / Payer Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Infosys, Acme Corp, Client Studio"
                      className="p6-form-input"
                      value={incomeForm.employerOrClient}
                      onChange={(e) => setIncomeForm({ ...incomeForm, employerOrClient: e.target.value })}
                    />
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Deposit Date</label>
                    <input
                      type="date"
                      className="p6-form-input"
                      value={incomeForm.depositDate}
                      onChange={(e) => setIncomeForm({ ...incomeForm, depositDate: e.target.value })}
                    />
                  </div>
                </form>
              )}

              {/* Source 10: Committed Recurring Expense */}
              {selectedSource.id === 'RECURRING_EXPENSE' && (
                <form onSubmit={handleRecurringSubmit} className="p6-config-grid">
                  <div className="p6-form-group">
                    <label className="p6-form-label">Obligation Type</label>
                    <select
                      className="p6-form-select"
                      value={recurringForm.expenseType}
                      onChange={(e) => setRecurringForm({ ...recurringForm, expenseType: e.target.value })}
                    >
                      <option value="Rent">House Rent / Society Maintenance</option>
                      <option value="EMI">Loan EMI (Home / Auto / Personal)</option>
                      <option value="Insurance">Insurance Premium (Life / Health)</option>
                      <option value="Utility">Electricity / Gas / Water</option>
                      <option value="Internet">Broadband / Telecom Bill</option>
                      <option value="Subscription">Digital Subscriptions (OTT / Software)</option>
                    </select>
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="e.g. 25000"
                      className="p6-form-input font-mono"
                      value={recurringForm.amount}
                      onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Payee / Provider</label>
                    <input
                      type="text"
                      placeholder="e.g. Landlord, HDFC Bank, BESCOM, Netflix"
                      className="p6-form-input"
                      value={recurringForm.payee}
                      onChange={(e) => setRecurringForm({ ...recurringForm, payee: e.target.value })}
                      required
                    />
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Due Date of Month</label>
                    <input
                      type="date"
                      className="p6-form-input"
                      value={recurringForm.dueDate}
                      onChange={(e) => setRecurringForm({ ...recurringForm, dueDate: e.target.value })}
                    />
                  </div>

                  <div className="p6-form-group">
                    <label className="p6-form-label">Billing Frequency</label>
                    <select
                      className="p6-form-select"
                      value={recurringForm.frequency}
                      onChange={(e) => setRecurringForm({ ...recurringForm, frequency: e.target.value })}
                    >
                      <option value="monthly">Monthly Recurring</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* STEP 3: PROCESSING STATE */}
          {step === 'PROCESSING' && (
            <div className="p6-processing-box">
              <div className="p6-spinner" />
              <div className="p6-processing-status">{processingStatus}</div>
              <div className="p6-processing-sub">
                Processing statement intelligence, extracting merchants, detecting duplicates, and normalizing records according to the PRD framework.
              </div>
            </div>
          )}

          {/* STEP 4: PRD TRANSACTION REVIEW SCREEN (CRUCIAL PRD STEP 6!) */}
          {step === 'REVIEW' && (
            <div>
              {/* Summary stat cards */}
              <div className="p6-review-stats">
                <div className="p6-stat-pill highlight">
                  <span className="p6-stat-label">Total Extracted</span>
                  <span className="p6-stat-val font-mono">{parsedTransactions.length}</span>
                </div>
                <div className="p6-stat-pill">
                  <span className="p6-stat-label">Ready to Confirm</span>
                  <span className="p6-stat-val font-mono text-green">{confirmedCount}</span>
                </div>
                {dupCount > 0 && (
                  <div className="p6-stat-pill warning">
                    <span className="p6-stat-label">Potential Duplicates</span>
                    <span className="p6-stat-val font-mono" style={{ color: '#D97706' }}>{dupCount}</span>
                  </div>
                )}
                {reviewCount > 0 && (
                  <div className="p6-stat-pill">
                    <span className="p6-stat-label">Needs Review</span>
                    <span className="p6-stat-val font-mono" style={{ color: '#E11D48' }}>{reviewCount}</span>
                  </div>
                )}
              </div>

              {/* Review Filter Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`btn-secondary small ${reviewFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setReviewFilter('ALL')}
                  >
                    All ({parsedTransactions.length})
                  </button>
                  {dupCount > 0 && (
                    <button
                      type="button"
                      className={`btn-secondary small ${reviewFilter === 'DUPLICATES' ? 'active' : ''}`}
                      onClick={() => setReviewFilter('DUPLICATES')}
                      style={{ color: '#D97706', borderColor: '#FDE68A' }}
                    >
                      Duplicates ({dupCount})
                    </button>
                  )}
                  {reviewCount > 0 && (
                    <button
                      type="button"
                      className={`btn-secondary small ${reviewFilter === 'NEEDS_REVIEW' ? 'active' : ''}`}
                      onClick={() => setReviewFilter('NEEDS_REVIEW')}
                      style={{ color: '#E11D48', borderColor: '#FECACA' }}
                    >
                      Needs Review ({reviewCount})
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-secondary small" onClick={() => handleSelectAll(true)}>
                    Select All
                  </button>
                  <button type="button" className="btn-secondary small" onClick={() => handleSelectAll(false)}>
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Interactive Review Table */}
              <div className="p6-table-wrap">
                <table className="p6-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>Include</th>
                      <th>Date</th>
                      <th>Merchant / Narration</th>
                      <th>Category</th>
                      <th>Classification</th>
                      <th>Type</th>
                      <th>Amount (₹)</th>
                      <th>Status / Duplicate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTransactions.map((tx) => (
                      <tr
                        key={tx.tempId}
                        className={`${tx.isDuplicate ? 'is-dup' : ''} ${!tx.included ? 'is-excluded' : ''}`}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={tx.included}
                            onChange={() => handleToggleInclude(tx.tempId)}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className="p6-form-input font-mono"
                            style={{ padding: '4px 6px', fontSize: '0.75rem', width: 120 }}
                            value={tx.date}
                            onChange={(e) => handleUpdateRowField(tx.tempId, 'date', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="p6-form-input"
                            style={{ padding: '4px 6px', fontSize: '0.75rem', width: '100%', minWidth: 140 }}
                            value={tx.merchant || ''}
                            onChange={(e) => handleUpdateRowField(tx.tempId, 'merchant', e.target.value)}
                          />
                          <div style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: 2 }}>{tx.description}</div>
                        </td>
                        <td>
                          <select
                            className="p6-form-select"
                            style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                            value={tx.category}
                            onChange={(e) => handleUpdateRowField(tx.tempId, 'category', e.target.value)}
                          >
                            {PRD_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="p6-form-select"
                            style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                            value={tx.classification}
                            onChange={(e) => handleUpdateRowField(tx.tempId, 'classification', e.target.value)}
                          >
                            <option value="Essential">Essential</option>
                            <option value="Lifestyle">Lifestyle</option>
                            <option value="Financial">Financial</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>
                        <td>
                          <span className={`p6-type-pill ${tx.type}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono font-bold" style={{ fontSize: '0.85rem' }}>
                            {fmtCurrency(tx.amount)}
                          </span>
                        </td>
                        <td>
                          {tx.isDuplicate ? (
                            <span className="p6-badge-dup" title={tx.duplicateReason}>
                              ⚠️ Duplicate Detected
                            </span>
                          ) : tx.needsReview ? (
                            <span className="p6-badge-rev">
                              Review Classification
                            </span>
                          ) : (
                            <span style={{ color: '#10B981', fontSize: '0.7rem', fontWeight: 700 }}>
                              ✓ Confirmed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESS CONFIRMATION */}
          {step === 'SUCCESS' && (
            <div style={{ textAlign: 'center', padding: '36px 20px' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
                Financial Data Added to Ledger!
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: 440, margin: '0 auto 20px' }}>
                {successSummary?.type === 'STATEMENT'
                  ? `Successfully imported ${successSummary.importedCount} confirmed transaction records from ${successSummary.institution} (${successSummary.fileName}).`
                  : successSummary?.type === 'MONTHLY_INCOME'
                  ? `Recorded monthly income of ₹${Number(successSummary.amount).toLocaleString('en-IN')} and updated your financial profile.`
                  : successSummary?.type === 'RECURRING_EXPENSE'
                  ? `Recorded recurring obligation for ${successSummary.payee} (${successSummary.expenseType}) of ₹${Number(successSummary.amount).toLocaleString('en-IN')}.`
                  : `Successfully recorded manual financial entry for ₹${Number(successSummary?.amount || 0).toLocaleString('en-IN')}.`}
              </p>
              <div className="p6-alert info" style={{ maxWidth: 440, margin: '0 auto' }}>
                <ShieldCheck size={16} />
                <span>Your CFO Command Centre dashboard and financial health score have been updated in real-time.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p6-modal-footer">
          {step === 'SOURCE' && (
            <>
              <button type="button" onClick={onClose} className="p6-btn-sec">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('INPUT')}
                className="p6-btn-pri"
              >
                <span>Continue</span>
                <ArrowRight size={15} />
              </button>
            </>
          )}

          {step === 'INPUT' && (
            <>
              <button type="button" onClick={() => setStep('SOURCE')} className="p6-btn-sec">
                <ArrowLeft size={15} style={{ marginRight: 6 }} /> Back
              </button>
              {['STATEMENT', 'OCR'].includes(selectedSource.category) ? (
                <button
                  type="button"
                  onClick={handleProcessFile}
                  disabled={!file}
                  className="p6-btn-pri"
                >
                  <span>Process Statement</span>
                  <ArrowRight size={15} />
                </button>
              ) : selectedSource.id === 'MANUAL' ? (
                <button
                  type="button"
                  onClick={handleManualSubmit}
                  disabled={isSubmittingCommit}
                  className="p6-btn-pri"
                >
                  <span>{isSubmittingCommit ? 'Saving...' : 'Record Transaction'}</span>
                </button>
              ) : selectedSource.id === 'MONTHLY_INCOME' ? (
                <button
                  type="button"
                  onClick={handleIncomeSubmit}
                  disabled={isSubmittingCommit}
                  className="p6-btn-pri"
                >
                  <span>{isSubmittingCommit ? 'Saving...' : 'Save Monthly Income'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRecurringSubmit}
                  disabled={isSubmittingCommit}
                  className="p6-btn-pri"
                >
                  <span>{isSubmittingCommit ? 'Saving...' : 'Save Recurring Obligation'}</span>
                </button>
              )}
            </>
          )}

          {step === 'REVIEW' && (
            <>
              <button type="button" onClick={() => setStep('INPUT')} className="p6-btn-sec">
                <ArrowLeft size={15} style={{ marginRight: 6 }} /> Back to Upload
              </button>
              <button
                type="button"
                onClick={handleCommitReview}
                disabled={isSubmittingCommit || confirmedCount === 0}
                className="p6-btn-pri"
              >
                <CheckCircle2 size={16} />
                <span>
                  {isSubmittingCommit ? 'Persisting to Ledger...' : `Confirm & Import ${confirmedCount} Transactions`}
                </span>
              </button>
            </>
          )}

          {step === 'SUCCESS' && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                className="p6-btn-pri"
              >
                <span>Return to Dashboard</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
