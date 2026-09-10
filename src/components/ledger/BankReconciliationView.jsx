import React, { useState, useEffect, useCallback } from 'react';
import './ProductionLedgerViews.css';
import {
  Landmark,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Search,
  Link,
  ArrowDownLeft,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import {
  importBankStatement,
  importBankStatementFile,
  fetchBankStatements,
  fetchBankStatementLines,
  matchBankLine,
  fetchChartOfAccounts,
  fetchJournals
} from '../../api/ledgerClient';

export default function BankReconciliationView() {
  const [statements, setStatements] = useState([]);
  const [selectedStatementId, setSelectedStatementId] = useState(null);
  const [lines, setLines] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Statement upload state
  const [importModal, setImportModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementFile, setStatementFile] = useState(null);

  // Manual Matching Modal
  const [activeLine, setActiveLine] = useState(null);
  const [unmatchedJournals, setUnmatchedJournals] = useState([]);
  const [selectedJournalId, setSelectedJournalId] = useState('');

  const loadStatements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [stmtRes, accRes] = await Promise.all([
        fetchBankStatements(),
        fetchChartOfAccounts()
      ]);
      if (stmtRes.ok) {
        const stmtList = stmtRes.data.statements || [];
        setStatements(stmtList);
        if (stmtList.length > 0 && !selectedStatementId) {
          setSelectedStatementId(stmtList[0].id);
        }
      }
      if (accRes.ok) {
        const bankAccs = (accRes.data.accounts || []).filter((a) => a.subtype === 'BANK');
        setAccounts(bankAccs);
        if (bankAccs.length > 0 && !selectedAccountId) {
          setSelectedAccountId(bankAccs[0].id);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStatementId, selectedAccountId]);

  const loadStatementLines = useCallback(async (stmtId) => {
    if (!stmtId) return;
    try {
      const res = await fetchBankStatementLines(stmtId);
      if (res.ok) {
        setLines(res.data.lines || []);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadStatements();
  }, [loadStatements]);

  useEffect(() => {
    if (selectedStatementId) {
      loadStatementLines(selectedStatementId);
    }
  }, [selectedStatementId, loadStatementLines]);

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!statementFile) { setError('Select a CSV, XLSX, XLS, or PDF statement first.'); return; }
    setLoading(true);
    setError('');
    try {
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Unable to read statement file.'));
        reader.readAsDataURL(statementFile);
      });
      const res = await importBankStatementFile({
        accountId: selectedAccountId,
        fileName: statementFile.name,
        mimeType: statementFile.type || 'application/octet-stream',
        fileBase64,
      });

      if (res.ok) {
        setSuccessMsg(`Bank Statement imported: ${res.data.reconciliation.exactMatches} exact matches, ${res.data.reconciliation.unmatchedCount} unmatched.`);
        setImportModal(false);
        loadStatements();
        if (res.data.statement?.id) {
          setSelectedStatementId(res.data.statement.id);
        }
      } else {
        setError(res.data?.error || 'Import failed.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenManualMatch = async (line) => {
    setActiveLine(line);
    try {
      const res = await fetchJournals({ limit: 50 });
      if (res.ok) {
        setUnmatchedJournals(res.data.entries || []);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConfirmMatch = async () => {
    if (!activeLine || !selectedJournalId) return;
    setLoading(true);
    try {
      const res = await matchBankLine({
        statementId: selectedStatementId,
        lineId: activeLine.id,
        journalEntryId: selectedJournalId
      });
      if (res.ok) {
        setSuccessMsg('Statement line manually matched with Journal Entry.');
        setActiveLine(null);
        setSelectedJournalId('');
        loadStatementLines(selectedStatementId);
      } else {
        setError(res.data?.error || 'Match failed.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmtInr = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  return (
    <div className="prod-view-container">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="prod-view-header">
        <div className="prod-view-title-group">
          <h2>Bank Statement Reconciliation Engine</h2>
          <p>Multi-tier matching comparing imported bank feeds against double-entry ledger transactions.</p>
        </div>
        <div className="prod-view-actions">
          <button
            onClick={() => setImportModal(true)}
            className="btn-primary"
          >
            <Upload size={14} /> Import Bank Statement (CSV)
          </button>
          <button onClick={loadStatements} className="btn-secondary" title="Refresh">
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

      {/* ── STATEMENT SELECTOR ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Active Bank Statement:</span>
        <select
          value={selectedStatementId || ''}
          onChange={(e) => setSelectedStatementId(e.target.value)}
          className="prod-select"
          style={{ fontWeight: 600, minWidth: 260 }}
        >
          {statements.length === 0 ? (
            <option value="">No statements imported yet</option>
          ) : (
            statements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fileName} ({s.importedAt?.slice(0, 10)})
              </option>
            ))
          )}
        </select>
      </div>

      {/* ── LINES TABLE ─────────────────────────────────────────────────── */}
      <div className="prod-card">
        <div className="prod-card-header">
          <div className="prod-card-title">
            <Landmark size={16} /> Statement Transactions & Matching Queue ({lines.length} lines)
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="prod-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Narration / Bank Description</th>
                <th>Reference</th>
                <th>Withdrawal (Dr)</th>
                <th>Deposit (Cr)</th>
                <th>Match Status</th>
                <th>Matched Entry</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No statement lines available. Click "Import Bank Statement" to upload a CSV.</td></tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id}>
                    <td style={{ fontFamily: 'monospace' }}>{line.transactionDate}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{line.description}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {line.referenceNumber || '—'}
                      </span>
                    </td>
                    <td className="font-mono text-red">
                      {line.withdrawalAmount > 0 ? fmtInr(line.withdrawalAmount) : '—'}
                    </td>
                    <td className="font-mono text-green font-bold">
                      {line.depositAmount > 0 ? fmtInr(line.depositAmount) : '—'}
                    </td>
                    <td>
                      <span className={`compliance-badge ${line.matchStatus === 'RECONCILED' ? 'completed' : 'due_soon'}`}>
                        {line.matchStatus} ({line.matchType})
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#214ECF' }}>
                        {line.matchedJournalEntryId ? 'Matched' : 'Unpaired'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {line.matchStatus !== 'RECONCILED' && (
                        <button
                          onClick={() => handleOpenManualMatch(line)}
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          <Link size={12} /> Match Entry
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

      {/* ── IMPORT CSV MODAL ─────────────────────────────────────────────── */}
      {importModal && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Import Bank Statement
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                Automatic multi-tier matching runs immediately upon ingestion.
              </p>
            </div>

            <form onSubmit={handleImportSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="prod-form-group">
                <label>Select Chart of Accounts Bank Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="prod-select"
                  required
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="prod-form-group">
                <label>Statement file (CSV, XLSX, XLS, or PDF)</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => setStatementFile(e.target.files?.[0] || null)}
                  className="prod-input"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setImportModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Ingesting & Matching...' : 'Upload & Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MANUAL MATCH MODAL ──────────────────────────────────────────── */}
      {activeLine && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Manual Match Pairing
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                Pair bank statement line with an existing general ledger entry.
              </p>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>STATEMENT LINE:</div>
                <div style={{ fontWeight: 700 }}>{activeLine.description}</div>
                <div className="font-mono font-bold" style={{ color: activeLine.depositAmount > 0 ? '#059669' : '#DC2626' }}>
                  {activeLine.depositAmount > 0 ? `+${fmtInr(activeLine.depositAmount)}` : `-${fmtInr(activeLine.withdrawalAmount)}`}
                </div>
              </div>

              <div className="prod-form-group">
                <label>Select Matching Journal Entry</label>
                <select
                  value={selectedJournalId}
                  onChange={(e) => setSelectedJournalId(e.target.value)}
                  className="prod-select"
                >
                  <option value="">Select Journal Entry...</option>
                  {unmatchedJournals.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.entryNumber} - {j.entryDate} - {j.narration} ({fmtInr(j.totalDebit)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setActiveLine(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMatch}
                  className="btn-primary"
                  disabled={!selectedJournalId || loading}
                >
                  Confirm Match
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
