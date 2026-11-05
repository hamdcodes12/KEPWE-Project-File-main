import React, { useState, useEffect, useCallback } from 'react';
import './ProductionLedgerViews.css';
import {
  Receipt,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Scale,
  Trash2,
  Undo2
} from 'lucide-react';
import {
  fetchJournals,
  postJournalEntry,
  voidJournalEntry,
  fetchChartOfAccounts
} from '../../api/ledgerClient';

export default function JournalsView() {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState(null);

  // New Journal Modal State
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState([
    { accountId: '', debit: 0, credit: 0, narration: '' },
    { accountId: '', debit: 0, credit: 0, narration: '' }
  ]);

  // Void Modal State
  const [voidModalEntry, setVoidModalEntry] = useState(null);
  const [voidReason, setVoidReason] = useState('Accounting error correction');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [jRes, aRes] = await Promise.all([
        fetchJournals({ limit: 100 }),
        fetchChartOfAccounts()
      ]);
      if (jRes.ok) setEntries(jRes.data.entries || []);
      if (aRes.ok) setAccounts(aRes.data.accounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Line helpers for new journal
  const addLine = () => {
    setLines([...lines, { accountId: '', debit: 0, credit: 0, narration: '' }]);
  };

  const removeLine = (idx) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, value) => {
    const updated = [...lines];
    updated[idx][field] = value;
    if (field === 'debit' && Number(value) > 0) {
      updated[idx].credit = 0;
    } else if (field === 'credit' && Number(value) > 0) {
      updated[idx].debit = 0;
    }
    setLines(updated);
  };

  const totalDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference <= 0.001 && totalDebit > 0;

  const handleCreateJournal = async (e) => {
    e.preventDefault();
    if (!isBalanced) {
      setError(`Journal entry is unbalanced! Debit (${totalDebit}) !== Credit (${totalCredit}). Difference: ${difference}.`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await postJournalEntry({
        entryDate,
        narration: narration || 'General Journal Entry',
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          narration: l.narration || null
        }))
      });

      if (res.ok) {
        setSuccessMsg(`Journal ${res.data.entry.entryNumber} posted successfully.`);
        setNewModalOpen(false);
        setNarration('');
        setLines([
          { accountId: '', debit: 0, credit: 0, narration: '' },
          { accountId: '', debit: 0, credit: 0, narration: '' }
        ]);
        loadData();
      } else {
        setError(res.data?.error || 'Failed to post journal entry.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVoidSubmit = async (e) => {
    e.preventDefault();
    if (!voidModalEntry) return;
    setLoading(true);
    setError('');
    try {
      const res = await voidJournalEntry(voidModalEntry.id, voidReason);
      if (res.ok) {
        setSuccessMsg(`Entry ${voidModalEntry.entryNumber} VOIDED. Offsetting Reversal Entry ${res.data.reversalNumber} posted.`);
        setVoidModalEntry(null);
        loadData();
      } else {
        setError(res.data?.error || 'Failed to void journal entry.');
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
          <h2>Double-Entry General Journal</h2>
          <p>Strict double-entry accounting enforcing Debit === Credit with immutable audit trail and reversal workflows.</p>
        </div>
        <div className="prod-view-actions">
          <button
            onClick={() => setNewModalOpen(true)}
            className="btn-primary"
          >
            <Plus size={14} /> New Balanced Journal
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

      {/* ── JOURNAL ENTRIES LIST ─────────────────────────────────────────── */}
      <div className="prod-card">
        <div className="prod-card-header">
          <div className="prod-card-title">
            <Receipt size={16} /> Journal Entries ({entries.length} records)
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="prod-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Entry No</th>
                <th>Date</th>
                <th>Narration</th>
                <th>Reference</th>
                <th>Total Debit</th>
                <th>Total Credit</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>No journal entries found.</td></tr>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <tr style={{ background: isExpanded ? '#F8FAFC' : undefined }}>
                        <td>
                          <button
                            onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#214ECF' }}>
                          {entry.entryNumber}
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{entry.entryDate}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{entry.narration}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                            {entry.referenceType} {entry.referenceNumber ? `(${entry.referenceNumber})` : ''}
                          </span>
                        </td>
                        <td className="font-mono font-bold">{fmtInr(entry.totalDebit)}</td>
                        <td className="font-mono font-bold">{fmtInr(entry.totalCredit)}</td>
                        <td>
                          <span className={`compliance-badge ${entry.status === 'POSTED' ? 'completed' : 'overdue'}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {entry.status === 'POSTED' && entry.referenceType !== 'REVERSAL' && (
                            <button
                              onClick={() => setVoidModalEntry(entry)}
                              className="btn-danger"
                              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                              title="Void with offsetting reversal"
                            >
                              <Undo2 size={12} /> Void Entry
                            </button>
                          )}
                          {entry.status === 'VOIDED' && (
                            <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 600 }}>
                              Reversed
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Journal Lines */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="9" style={{ padding: '12px 24px', background: '#F8FAFC' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#64748B', marginBottom: 6 }}>
                              JOURNAL SPLIT LINES (DEBITS & CREDITS):
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                                  <th style={{ padding: '6px 8px' }}>Account Code</th>
                                  <th style={{ padding: '6px 8px' }}>Account Name</th>
                                  <th style={{ padding: '6px 8px' }}>Narration</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Debit (₹)</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Credit (₹)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.lines.map((l, lIdx) => (
                                  <tr key={lIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 700 }}>{l.accountCode}</td>
                                    <td style={{ padding: '6px 8px' }}>{l.accountName}</td>
                                    <td style={{ padding: '6px 8px', color: '#64748B' }}>{l.narration || '—'}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: l.debit > 0 ? 700 : 400 }}>
                                      {l.debit > 0 ? fmtInr(l.debit) : '—'}
                                    </td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: l.credit > 0 ? 700 : 400 }}>
                                      {l.credit > 0 ? fmtInr(l.credit) : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── NEW JOURNAL MODAL ────────────────────────────────────────────── */}
      {newModalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Create Double-Entry Balanced Journal
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                Zero-tolerance balancing: Total Debits must strictly equal Total Credits.
              </p>
            </div>

            <form onSubmit={handleCreateJournal} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div className="prod-form-group">
                  <label>Entry Date</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="prod-input"
                    required
                  />
                </div>
                <div className="prod-form-group">
                  <label>Narration / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Month-end Accrual / Adjustment"
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    className="prod-input"
                    required
                  />
                </div>
              </div>

              {/* Lines Table */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ background: '#F8FAFC' }}>
                    <tr>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Account</th>
                      <th style={{ padding: '8px 10px', width: 140 }}>Debit (₹)</th>
                      <th style={{ padding: '8px 10px', width: 140 }}>Credit (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Line Narration</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: 6 }}>
                          <select
                            value={l.accountId}
                            onChange={(e) => updateLine(idx, 'accountId', e.target.value)}
                            className="prod-select"
                            style={{ width: '100%' }}
                            required
                          >
                            <option value="">Select Account...</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name} ({a.type})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: 6 }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.debit || ''}
                            onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                            placeholder="0.00"
                            className="prod-input font-mono"
                          />
                        </td>
                        <td style={{ padding: 6 }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.credit || ''}
                            onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                            placeholder="0.00"
                            className="prod-input font-mono"
                          />
                        </td>
                        <td style={{ padding: 6 }}>
                          <input
                            type="text"
                            value={l.narration}
                            onChange={(e) => updateLine(idx, 'narration', e.target.value)}
                            placeholder="Optional note"
                            className="prod-input"
                          />
                        </td>
                        <td style={{ padding: 6, textAlign: 'center' }}>
                          {lines.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={addLine}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  <Plus size={12} /> Add Line
                </button>

                {/* Balancing Verification Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <span>Total Dr: </span><strong className="font-mono">{fmtInr(totalDebit)}</strong>
                    <span style={{ marginLeft: 12 }}>Total Cr: </span><strong className="font-mono">{fmtInr(totalCredit)}</strong>
                  </div>
                  <span className={`compliance-badge ${isBalanced ? 'completed' : 'overdue'}`}>
                    {isBalanced ? 'BALANCED' : `DIFF: ${fmtInr(difference)}`}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!isBalanced || loading}
                >
                  {loading ? 'Posting Journal...' : 'Post Balanced Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VOID MODAL ──────────────────────────────────────────────────── */}
      {voidModalEntry && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#DC2626' }}>
                Void Journal Entry ({voidModalEntry.entryNumber})
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                Under immutable accounting rules, this will create an offsetting Reversal Entry and record an audit log.
              </p>
            </div>

            <form onSubmit={handleVoidSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="prod-form-group">
                <label>Reason for Voiding (Mandatory Audit Trail)</label>
                <textarea
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="State why this entry is being voided..."
                  className="prod-input"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setVoidModalEntry(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={!voidReason.trim() || loading}
                >
                  {loading ? 'Reversing...' : 'Confirm Void & Post Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
