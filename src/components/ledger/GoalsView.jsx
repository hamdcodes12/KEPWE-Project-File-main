import React, { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Plus,
  TrendingUp,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Edit2,
  Trash2,
  DollarSign,
  ArrowUpRight,
  Shield,
  Home,
  Car,
  Plane,
  GraduationCap,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';
import {
  fetchLedgerGoals,
  createLedgerGoal,
  updateLedgerGoal,
  deleteLedgerGoal,
  contributeToLedgerGoal
} from '../../api/ledgerClient';
import './GoalsView.css';

const GOAL_TYPES = [
  { id: 'Emergency Fund', icon: Shield, defaultColor: '#10B981' },
  { id: 'House Down Payment', icon: Home, defaultColor: '#6366F1' },
  { id: 'New Car', icon: Car, defaultColor: '#F59E0B' },
  { id: 'Vacation', icon: Plane, defaultColor: '#06B6D4' },
  { id: 'Education', icon: GraduationCap, defaultColor: '#8B5CF6' },
  { id: 'Wealth Creation', icon: TrendingUp, defaultColor: '#2563EB' },
  { id: 'Retirement', icon: Target, defaultColor: '#059669' },
  { id: 'Other', icon: Target, defaultColor: '#64748B' },
];

export default function GoalsView({ onOpenUploadModal }) {
  const [goalsData, setGoalsData] = useState({ goals: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal State for Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [form, setForm] = useState({
    name: '',
    type: 'Emergency Fund',
    targetAmount: '',
    currentAmount: '',
    targetDate: '',
    monthlyContribution: '',
    priority: 'medium',
    notes: '',
  });

  // Modal State for Quick Add Contribution
  const [contributeOpen, setContributeOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribSaving, setContribSaving] = useState(false);
  const [contribError, setContribError] = useState('');

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchLedgerGoals();
      if (res.ok) {
        setGoalsData({
          goals: res.data.goals || [],
          metrics: res.data.metrics || {}
        });
      } else {
        setError(res.data?.error || 'Unable to load savings goals.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with goals service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleOpenCreateModal = () => {
    setEditingGoal(null);
    setForm({
      name: '',
      type: 'Emergency Fund',
      targetAmount: '',
      currentAmount: '',
      targetDate: '',
      monthlyContribution: '',
      priority: 'medium',
      notes: '',
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (goal) => {
    setEditingGoal(goal);
    setForm({
      name: goal.name,
      type: goal.type,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      targetDate: goal.targetDate || '',
      monthlyContribution: String(goal.monthlyContribution || ''),
      priority: goal.priority || 'medium',
      notes: goal.notes || '',
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError('Please enter a goal name.');
      return;
    }
    if (!form.targetAmount || Number(form.targetAmount) <= 0) {
      setModalError('Target amount must be a positive number greater than 0.');
      return;
    }

    setSaving(true);
    setModalError('');

    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount || 0),
        targetDate: form.targetDate || null,
        monthlyContribution: Number(form.monthlyContribution || 0),
        priority: form.priority,
        notes: form.notes,
      };

      let res;
      if (editingGoal) {
        res = await updateLedgerGoal(editingGoal.id, payload);
      } else {
        res = await createLedgerGoal(payload);
      }

      if (res.ok) {
        setModalOpen(false);
        loadGoals();
      } else {
        setModalError(res.data?.error || 'Failed to save goal.');
      }
    } catch (err) {
      setModalError(err.message || 'Network error saving goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId, goalName) => {
    if (!window.confirm(`Are you sure you want to delete "${goalName}"?`)) {
      return;
    }

    try {
      const res = await deleteLedgerGoal(goalId);
      if (res.ok) {
        loadGoals();
      } else {
        alert(res.data?.error || 'Failed to delete goal.');
      }
    } catch (err) {
      alert(err.message || 'Error deleting goal.');
    }
  };

  const handleOpenContribute = (goal) => {
    setSelectedGoal(goal);
    setContribAmount('');
    setContribError('');
    setContributeOpen(true);
  };

  const handleContributeSubmit = async (e) => {
    e.preventDefault();
    if (!contribAmount || Number(contribAmount) <= 0) {
      setContribError('Please enter a valid contribution amount.');
      return;
    }

    setContribSaving(true);
    setContribError('');

    try {
      const res = await contributeToLedgerGoal(selectedGoal.id, Number(contribAmount));
      if (res.ok) {
        setContributeOpen(false);
        loadGoals();
      } else {
        setContribError(res.data?.error || 'Failed to record contribution.');
      }
    } catch (err) {
      setContribError(err.message || 'Error recording contribution.');
    } finally {
      setContribSaving(false);
    }
  };

  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const goals = goalsData.goals || [];
  const metrics = goalsData.metrics || {};

  return (
    <div className="goals-view-container">
      {/* ── 1. ACTION HEADER ───────────────────────────────────────────── */}
      <div className="goals-action-header">
        <div className="goals-title-group">
          <h2>Savings Goal Engine</h2>
          <p>Plan, track, and systematically fund your life milestones and emergency reserves.</p>
        </div>

        <button onClick={handleOpenCreateModal} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Create New Goal
        </button>
      </div>

      {/* ── 2. METRICS OVERVIEW ────────────────────────────────────────── */}
      <div className="goals-metrics-grid">
        <div className="goals-metric-card">
          <div className="goals-metric-top">
            <span className="goals-metric-label">Active Goals</span>
            <Target size={16} color="#214ECF" />
          </div>
          <div className="goals-metric-val font-mono blue">{metrics.activeGoalsCount || 0}</div>
          <div className="goals-metric-sub">{metrics.completedGoalsCount || 0} completed</div>
        </div>

        <div className="goals-metric-card">
          <div className="goals-metric-top">
            <span className="goals-metric-label">Total Saved</span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <div className="goals-metric-val font-mono green">{fmtCurrency(metrics.totalCurrentAmount)}</div>
          <div className="goals-metric-sub">Across all milestones</div>
        </div>

        <div className="goals-metric-card">
          <div className="goals-metric-top">
            <span className="goals-metric-label">Total Target</span>
            <DollarSign size={16} color="#64748B" />
          </div>
          <div className="goals-metric-val font-mono">{fmtCurrency(metrics.totalTargetAmount)}</div>
          <div className="goals-metric-sub">Shortfall: {fmtCurrency(metrics.totalShortfall)}</div>
        </div>

        <div className="goals-metric-card">
          <div className="goals-metric-top">
            <span className="goals-metric-label">Overall Progress</span>
            <TrendingUp size={16} color="#8B5CF6" />
          </div>
          <div className="goals-metric-val font-mono" style={{ color: '#8B5CF6' }}>
            {metrics.overallProgressPct || 0}%
          </div>
          <div className="goals-metric-sub">Monthly need: {fmtCurrency(metrics.totalMonthlyCommitment)}</div>
        </div>
      </div>

      {/* ── 3. GOALS CARDS GRID ───────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <RefreshCw size={32} className="spin-animate" style={{ color: '#214ECF', margin: '0 auto 12px' }} />
          <h3 style={{ color: '#0F172A' }}>Loading Savings Goals…</h3>
        </div>
      ) : error ? (
        <div style={{ padding: '36px', textAlign: 'center', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FCA5A5' }}>
          <AlertCircle size={32} color="#EF4444" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ color: '#B91C1C' }}>Error Loading Goals</h3>
          <p style={{ color: '#64748B', marginBottom: '16px' }}>{error}</p>
          <button onClick={loadGoals} className="btn-secondary small">Retry</button>
        </div>
      ) : goals.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#EFF6FF', color: '#214ECF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Target size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
            No Savings Goals Created Yet
          </h3>
          <p style={{ maxWidth: '480px', margin: '0 auto 24px', fontSize: '0.9rem', color: '#64748B', lineHeight: 1.6 }}>
            Set clear financial targets for your Emergency Fund, Down Payment, Vehicle, or Wealth goals. Track your progress with automated contribution pacing.
          </p>
          <button onClick={handleOpenCreateModal} className="btn-primary">
            <Plus size={16} /> Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="goals-cards-grid">
          {goals.map((g) => (
            <div key={g.id} className={`goal-card ${g.status}`}>
              <div>
                <div className="goal-card-top">
                  <span className="goal-type-badge">{g.type}</span>
                  <span className={`goal-status-badge ${g.status}`}>
                    {g.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                </div>

                <h3 className="goal-name">{g.name}</h3>

                <div className="goal-amounts-row">
                  <span className="goal-current-amount font-mono">{fmtCurrency(g.currentAmount)}</span>
                  <span className="goal-target-amount font-mono">of {fmtCurrency(g.targetAmount)}</span>
                </div>

                {/* Progress Bar */}
                <div className="goal-progress-wrap">
                  <div className="goal-progress-track">
                    <div
                      className="goal-progress-fill"
                      style={{
                        width: `${g.progressPct}%`,
                        background: g.progressPct >= 100 ? '#10B981' : g.progressPct >= 50 ? '#214ECF' : '#F59E0B'
                      }}
                    />
                  </div>
                  <div className="goal-progress-meta font-mono">
                    <span>{g.progressPct}% Completed</span>
                    <span>Shortfall: {fmtCurrency(g.shortfall)}</span>
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="goal-details-box">
                  {g.targetDate && (
                    <div className="goal-detail-row">
                      <span className="goal-detail-label">Target Date:</span>
                      <span className="goal-detail-val font-mono">{g.targetDate} ({g.remainingMonths} mo remaining)</span>
                    </div>
                  )}

                  <div className="goal-detail-row">
                    <span className="goal-detail-label">Monthly Allocation:</span>
                    <span className="goal-detail-val font-mono" style={{ color: '#214ECF' }}>
                      {fmtCurrency(g.monthlyContribution)}/mo
                    </span>
                  </div>

                  {g.requiredMonthlyContribution > 0 && (
                    <div className="goal-detail-row">
                      <span className="goal-detail-label">Required Pacing:</span>
                      <span className="goal-detail-val font-mono" style={{ color: g.isOnTrack ? '#059669' : '#DC2626' }}>
                        {fmtCurrency(g.requiredMonthlyContribution)}/mo {g.isOnTrack ? '✓' : '(Behind Pace)'}
                      </span>
                    </div>
                  )}

                  <div className="goal-detail-row">
                    <span className="goal-detail-label">Priority:</span>
                    <span className="goal-detail-val" style={{ textTransform: 'capitalize' }}>{g.priority}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="goal-card-actions">
                {g.status !== 'completed' && (
                  <button
                    onClick={() => handleOpenContribute(g)}
                    className="btn-primary small"
                    title="Add funds toward this goal"
                  >
                    + Add Funds
                  </button>
                )}
                <button
                  onClick={() => handleOpenEditModal(g)}
                  className="btn-secondary small"
                  title="Edit goal parameters"
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button
                  onClick={() => handleDeleteGoal(g.id, g.name)}
                  className="btn-icon small"
                  style={{ color: '#EF4444', borderColor: '#FCA5A5' }}
                  title="Delete goal"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CREATE / EDIT GOAL MODAL ───────────────────────────────────── */}
      {modalOpen && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3>{editingGoal ? 'Edit Savings Goal' : 'Create Savings Goal'}</h3>
              <button onClick={() => setModalOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveGoal} className="modal-form">
              {modalError && <div className="modal-alert error">{modalError}</div>}

              <div className="form-group">
                <label className="form-label">Goal Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency Fund, New Car, Goa Vacation"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div className="goal-form-grid">
                <div>
                  <label className="form-label">Goal Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="form-select"
                  >
                    {GOAL_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="form-select"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="goal-form-grid" style={{ marginTop: '12px' }}>
                <div>
                  <label className="form-label">Target Amount (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 300000"
                    value={form.targetAmount}
                    onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                    className="form-input font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Current Saved Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.currentAmount}
                    onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="goal-form-grid" style={{ marginTop: '12px' }}>
                <div>
                  <label className="form-label">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Monthly Allocation (₹)</label>
                  <input
                    type="number"
                    placeholder="Auto-calculated if date set"
                    value={form.monthlyContribution}
                    onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })}
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Details, bank account earmarked, or timeline notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving Goal…' : editingGoal ? 'Update Goal' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── QUICK ADD CONTRIBUTION MODAL ───────────────────────────────── */}
      {contributeOpen && selectedGoal && (
        <div className="ledger-modal-overlay">
          <div className="ledger-modal-card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Add Funds to Goal</h3>
              <button onClick={() => setContributeOpen(false)} className="close-btn"><X size={18} /></button>
            </div>

            <form onSubmit={handleContributeSubmit} className="modal-form">
              {contribError && <div className="modal-alert error">{contribError}</div>}

              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Targeting Goal:</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                  {selectedGoal.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>
                  Current: {fmtCurrency(selectedGoal.currentAmount)} / Target: {fmtCurrency(selectedGoal.targetAmount)}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Contribution Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="form-input font-mono"
                  required
                  autoFocus
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" onClick={() => setContributeOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={contribSaving} className="btn-primary">
                  {contribSaving ? 'Adding…' : 'Add Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
