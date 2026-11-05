import React, { useState, useEffect, useCallback } from 'react';
import './ProductionLedgerViews.css';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Building,
  DollarSign
} from 'lucide-react';
import {
  fetchComplianceTasks,
  completeComplianceTask,
  createFilingDraft
} from '../../api/ledgerClient';

export default function ComplianceCalendarView() {
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({ total: 0, completed: 0, overdue: 0, dueSoon: 0, upcoming: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Complete task modal state
  const [activeTask, setActiveTask] = useState(null);
  const [challanNumber, setChallanNumber] = useState('');
  const [acknowledgementNumber, setAcknowledgementNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedCategory !== 'ALL') params.category = selectedCategory;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;

      const res = await fetchComplianceTasks(params);
      if (res.ok && res.data) {
        setTasks(res.data.tasks || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      } else {
        setError(res.data?.error || 'Failed to load statutory compliance tasks.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with compliance service.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedStatus]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!activeTask) return;
    setSubmitting(true);
    try {
      const res = await completeComplianceTask(activeTask.id, {
        challanNumber,
        acknowledgementNumber
      });
      if (res.ok) {
        setActionSuccess(`Statutory task "${activeTask.taskName}" marked as COMPLETED.`);
        setActiveTask(null);
        setChallanNumber('');
        setAcknowledgementNumber('');
        loadTasks();
      } else {
        setError(res.data?.error || 'Failed to complete statutory task.');
      }
    } catch (err) {
      setError(err.message || 'Error completing task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartFiling = async (task) => {
    try {
      let returnType = 'GSTR-1';
      if (task.ruleCode.includes('GSTR3B')) returnType = 'GSTR-3B';
      if (task.ruleCode.includes('26Q')) returnType = 'FORM-26Q';

      const res = await createFilingDraft({
        returnType,
        taxPeriod: task.taxPeriod || '2026-09'
      });
      if (res.ok) {
        setActionSuccess(`Draft ${returnType} filing generated for period ${task.taxPeriod}.`);
        loadTasks();
      } else {
        setError(res.data?.error || 'Failed to create filing draft.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="prod-view-container">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="prod-view-header">
        <div className="prod-view-title-group">
          <h2>Statutory Compliance Calendar & Due Dates</h2>
          <p>Indian regulatory calendar tracking GST, TDS, MCA, EPF, and Advance Tax deadlines with real statutory rules.</p>
        </div>
        <div className="prod-view-actions">
          <button onClick={loadTasks} className="btn-secondary" title="Refresh Calendar">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="prod-alert-banner success">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="prod-alert-banner danger">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── METRIC CARDS ─────────────────────────────────────────────────── */}
      <div className="prod-metrics-grid">
        <div className="prod-metric-card">
          <div className="prod-metric-title">
            <span>Total Obligations</span>
            <Calendar size={15} color="#214ECF" />
          </div>
          <div className="prod-metric-value">{summary.total}</div>
          <div className="prod-metric-footer">Statutory deadlines in calendar</div>
        </div>

        <div className="prod-metric-card">
          <div className="prod-metric-title">
            <span>Due Soon (7 Days)</span>
            <Clock size={15} color="#D97706" />
          </div>
          <div className="prod-metric-value text-amber" style={{ color: '#D97706' }}>{summary.dueSoon}</div>
          <div className="prod-metric-footer">Urgent action required</div>
        </div>

        <div className="prod-metric-card">
          <div className="prod-metric-title">
            <span>Overdue Obligations</span>
            <ShieldAlert size={15} color="#DC2626" />
          </div>
          <div className="prod-metric-value text-red" style={{ color: '#DC2626' }}>{summary.overdue}</div>
          <div className="prod-metric-footer">Statutory interest/penalties apply</div>
        </div>

        <div className="prod-metric-card highlight">
          <div className="prod-metric-title">
            <span>Completed Filings</span>
            <CheckCircle2 size={15} color="#059669" />
          </div>
          <div className="prod-metric-value text-green" style={{ color: '#059669' }}>{summary.completed}</div>
          <div className="prod-metric-footer">Verified with challans/acknowledgements</div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="prod-tabs-bar">
          {['ALL', 'GST', 'TDS', 'CORPORATE_MCA', 'PAYROLL', 'ADVANCE_TAX'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`prod-tab-btn ${selectedCategory === cat ? 'active' : ''}`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color="#64748B" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="prod-select"
            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="DUE_SOON">Due Soon</option>
            <option value="OVERDUE">Overdue</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* ── TASKS TABLE ─────────────────────────────────────────────────── */}
      <div className="prod-card">
        <div className="prod-card-header">
          <div className="prod-card-title">
            <Calendar size={16} /> Statutory Deadlines ({tasks.length} items)
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="prod-table">
            <thead>
              <tr>
                <th>Rule Code</th>
                <th>Task / Obligation</th>
                <th>Authority</th>
                <th>Period</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Penalty / Consequence</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                    {loading ? 'Loading compliance calendar...' : 'No statutory tasks match the selected filters.'}
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#214ECF' }}>
                        {task.ruleCode}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{task.taskName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{task.description}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                        {task.statutoryAuthority}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {task.taxPeriod}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                        {task.dueDate}
                      </div>
                      {task.daysRemaining !== null && (
                        <div style={{ fontSize: '0.7rem', color: task.daysRemaining < 0 ? '#DC2626' : task.daysRemaining <= 7 ? '#D97706' : '#64748B' }}>
                          {task.daysRemaining < 0 ? `${Math.abs(task.daysRemaining)} days overdue` : `${task.daysRemaining} days left`}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`compliance-badge ${task.status.toLowerCase()}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.72rem', color: '#991B1B' }}>
                        {task.penaltyRule || 'Late fee applies'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {task.status === 'COMPLETED' ? (
                        <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                          Ack: {task.acknowledgementNumber || 'Recorded'}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {['GST_GSTR1_M', 'GST_GSTR3B_M', 'TDS_26Q_Q'].includes(task.ruleCode) && (
                            <button
                              onClick={() => handleStartFiling(task)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              title="Generate Return Draft"
                            >
                              <FileCheck size={12} /> Prep Return
                            </button>
                          )}
                          <button
                            onClick={() => setActiveTask(task)}
                            className="btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            Mark Completed
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── COMPLETE TASK MODAL ───────────────────────────────────────────── */}
      {activeTask && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0F172A' }}>
                Complete Compliance Obligation
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                {activeTask.taskName} ({activeTask.ruleCode}) - Due: {activeTask.dueDate}
              </p>
            </div>

            <form onSubmit={handleCompleteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
              <div className="prod-form-group">
                <label>Challan / Payment Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. ITNS281-CIN-998877 or GST-PMT-06"
                  value={challanNumber}
                  onChange={(e) => setChallanNumber(e.target.value)}
                  className="prod-input"
                />
              </div>

              <div className="prod-form-group">
                <label>Government Acknowledgement / ARN</label>
                <input
                  type="text"
                  placeholder="e.g. ARN-AA2709260012345 or MCA SRN"
                  value={acknowledgementNumber}
                  onChange={(e) => setAcknowledgementNumber(e.target.value)}
                  className="prod-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setActiveTask(null)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Record Completion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
