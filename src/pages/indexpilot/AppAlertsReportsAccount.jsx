import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { Bell, FileText, User, Lock, Download, Trash2, CheckCircle2, ChevronDown, Save, Edit3, IndianRupee, Sparkles, Shield } from 'lucide-react';
import IndexPilotPricingCards from '../../components/indexpilot/IndexPilotPricingCards';
import '../../styles/modal-physics.css';

// ────────────────────────────────────────────────────────────────
// ALERTS PAGE
// ────────────────────────────────────────────────────────────────
export const AppAlertsPage = () => {
  const { alertsConfig, setAlertsConfig, saveAlertsConfig } = useApp();
  const [saved, setSaved] = useState(false);
  const [hoveredRuleKey, setHoveredRuleKey] = useState(null);

  const toggleRule = (key) => setAlertsConfig((p) => ({ ...p, [key]: !p[key] }));
  const toggleChannel = (ch) => setAlertsConfig((p) => ({ ...p, channels: { ...p.channels, [ch]: !p.channels[ch] } }));

  const handleSave = async () => {
    const result = await saveAlertsConfig();
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const RULES = [
    { key: 'verdictChanges', label: 'Verdict Changes', desc: 'Alert when NIFTY moves between Trade, Caution, and No Trade decision states' },
    { key: 'riskLimitBreach', label: 'Risk Limit Breach', desc: 'Alert when a strategy position sizing exceeds your saved risk cap' },
    { key: 'newMatchingSetup', label: 'New Matching Setup', desc: 'Notify when a new setup matches your indices and market view filters' },
    { key: 'eventRisk', label: 'Event / Earnings Risk', desc: 'Alert on RBI policy, Budget announcements, or high-IV spikes' },
    { key: 'volatilitySpike', label: 'India VIX Spike (>20)', desc: 'Immediate alert if India VIX crosses 20 — systemic risk signal' },
    { key: 'minuteByMinutePrice', label: 'Minute-by-Minute Price Ticks', desc: 'Off by default — prevents impulsive overtrading behaviour' },
  ];

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      color: '#0F172A',
      minHeight: '100vh',
      padding: '32px 40px 60px',
      fontFamily: 'var(--font-ui)'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#214ECF' }} />
            <span style={{ fontSize: '11px', color: '#214ECF', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              DECISION NOTIFICATIONS
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: '1.2', color: '#0F172A', margin: 0 }}>
            Alerts & Notification Rules
          </h1>
        </div>

        {saved && (
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#1E40AF', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#214ECF" />
            Alert preferences saved successfully.
          </div>
        )}

        {/* ── ALERT RULES & TRIGGERS CARD ────────────────── */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '24px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)'
        }}>
          <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
              ALERT RULES & TRIGGERS
            </h3>
          </div>

          <div>
            {RULES.map((rule, idx) => {
              const isEnabled = alertsConfig[rule.key];
              const isHovered = hoveredRuleKey === rule.key;

              return (
                <div
                  key={rule.key}
                  onMouseEnter={() => setHoveredRuleKey(rule.key)}
                  onMouseLeave={() => setHoveredRuleKey(null)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isHovered ? '#F8FAFC' : '#FFFFFF',
                    padding: '16px 24px',
                    borderBottom: idx < RULES.length - 1 ? '1px solid #F1F5F9' : 'none',
                    transition: 'background 180ms ease',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '14px' }}>
                      {rule.label}
                    </div>
                    <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 400, lineHeight: '1.4', display: 'block', marginTop: '2px' }}>
                      {rule.desc}
                    </span>
                  </div>

                  {/* Toggle Switch */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: isEnabled ? '#214ECF' : '#94A3B8' }}>
                      {isEnabled ? 'ON' : 'OFF'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      onClick={() => toggleRule(rule.key)}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        height: '24px',
                        width: '44px',
                        flexShrink: 0,
                        cursor: 'pointer',
                        borderRadius: '9999px',
                        border: '1px solid ' + (isEnabled ? '#214ECF' : '#CBD5E1'),
                        background: isEnabled ? '#214ECF' : '#E2E8F0',
                        transition: 'background-color 200ms ease',
                        outline: 'none',
                        padding: 0
                      }}
                    >
                      <span
                        style={{
                          pointerEvents: 'none',
                          display: 'inline-block',
                          height: '18px',
                          width: '18px',
                          borderRadius: '50%',
                          background: '#FFFFFF',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                          transform: isEnabled ? 'translate(22px, 2px)' : 'translate(2px, 2px)',
                          transition: 'transform 200ms ease'
                        }}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CHANNELS & QUIET HOURS GRID ────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          
          {/* Card 1: Notification Channels */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px' }}>
                DELIVERY CHANNELS
              </h3>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { key: 'push', label: 'Push' },
                  { key: 'email', label: 'Email' },
                  { key: 'sms', label: 'SMS' },
                ].map((ch) => {
                  const isSelected = alertsConfig.channels?.[ch.key];
                  return (
                    <button
                      key={ch.key}
                      type="button"
                      onClick={() => toggleChannel(ch.key)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid #214ECF' : '1px solid #CBD5E1',
                        background: isSelected ? '#EFF6FF' : '#FFFFFF',
                        color: isSelected ? '#214ECF' : '#64748B',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 180ms ease'
                      }}
                    >
                      {isSelected && '✓ '}{ch.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.45', marginTop: '16px', margin: 0 }}>
              SMS alerts require a verified Indian mobile number. Available on continuous access plans.
            </p>
          </div>

          {/* Card 2: Quiet Hours */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
                  QUIET HOURS
                </h3>

                <button
                  type="button"
                  onClick={() => setAlertsConfig(p => ({ ...p, quietHoursEnabled: !p.quietHoursEnabled }))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: alertsConfig.quietHoursEnabled ? '1px solid #86EFAC' : '1px solid #CBD5E1',
                    background: alertsConfig.quietHoursEnabled ? '#F0FDF4' : '#F1F5F9',
                    color: alertsConfig.quietHoursEnabled ? '#166534' : '#64748B',
                    fontWeight: 700,
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 180ms ease'
                  }}
                >
                  {alertsConfig.quietHoursEnabled ? '✓ Enabled' : 'Disabled'}
                </button>
              </div>

              {alertsConfig.quietHoursEnabled ? (
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                      FROM
                    </label>
                    <input
                      type="time"
                      value={alertsConfig.quietHoursStart || '22:00'}
                      onChange={(e) => setAlertsConfig(p => ({ ...p, quietHoursStart: e.target.value }))}
                      style={{
                        background: '#F8FAFC',
                        color: '#0F172A',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                      TO
                    </label>
                    <input
                      type="time"
                      value={alertsConfig.quietHoursEnd || '08:00'}
                      onChange={(e) => setAlertsConfig(p => ({ ...p, quietHoursEnd: e.target.value }))}
                      style={{
                        background: '#F8FAFC',
                        color: '#0F172A',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
                  Quiet hours are currently turned off.
                </p>
              )}
            </div>

            <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.45', marginTop: '16px', margin: 0 }}>
              No non-critical alerts will be sent during quiet hours.
            </p>
          </div>

        </div>

        {/* Save Preferences CTA */}
        <div>
          <button
            onClick={handleSave}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#214ECF',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(33, 78, 207, 0.25)',
              transition: 'background-color 180ms ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1A3EB4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#214ECF'; }}
          >
            <Save size={15} /> Save Preferences
          </button>
        </div>

      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// REPORTS PAGE
// ────────────────────────────────────────────────────────────────
export const AppReportsPage = () => {
  const { subscription, reports } = useApp();
  const isPremium = subscription?.plan === '1 YEAR' || subscription?.plan === '6 MONTHS' || subscription?.plan === '3 MONTHS';
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const REPORTS = reports || [];

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      color: '#0F172A',
      minHeight: '100vh',
      padding: '32px 40px 60px',
      fontFamily: 'var(--font-ui)'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#214ECF' }} />
            <span style={{ fontSize: '11px', color: '#214ECF', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              RESEARCH ARCHIVE
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: '1.2', color: '#0F172A', margin: 0 }}>
            Weekly & Monthly Strategy Reports
          </h1>
        </div>

        {/* Report Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {REPORTS.map((rep, idx) => {
            const isLocked = rep.status === 'Locked' && !isPremium;
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  background: isLocked ? '#F8FAFC' : '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderLeft: isLocked ? '4px solid #CBD5E1' : '4px solid #214ECF',
                  borderRadius: '10px',
                  boxShadow: isHovered ? '0 6px 20px rgba(15, 23, 42, 0.08)' : '0 2px 8px rgba(15, 23, 42, 0.03)',
                  transition: 'box-shadow 180ms ease, transform 180ms ease',
                  transform: isHovered ? 'translateY(-2px)' : 'none',
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                {/* Left Report Details */}
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    {isLocked ? (
                      <span style={{
                        background: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        color: '#64748B',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px'
                      }}>
                        {rep.plan} · 🔒 Locked
                      </span>
                    ) : (
                      <span style={{
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        color: '#214ECF',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px'
                      }}>
                        {rep.plan} · ✓ Unlocked
                      </span>
                    )}

                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                      {rep.date}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
                    {rep.title}
                  </h3>

                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: '1.45' }}>
                    {rep.summary}
                  </p>
                </div>

                {/* Right Download Action */}
                <div>
                  {isLocked ? (
                    <button
                      disabled
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        background: '#F1F5F9',
                        color: '#94A3B8',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Lock size={14} /> Upgrade to Access
                    </button>
                  ) : (
                    <button
                      onClick={() => alert(`Downloading: ${rep.title}`)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '6px',
                        background: '#214ECF',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(33, 78, 207, 0.25)',
                        transition: 'background-color 180ms ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#1A3EB4'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#214ECF'; }}
                    >
                      <Download size={14} /> Download PDF
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// ACCOUNT PAGE (SUBSCRIPTION & SETTINGS)
// ────────────────────────────────────────────────────────────────
export const AppAccountPage = () => {
  const { userRiskProfile, updateRiskProfile, subscription, upgradePlan, deletionRequested, setDeletionRequested } = useApp();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isUpgradeClosing, setIsUpgradeClosing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleteClosing, setIsDeleteClosing] = useState(false);
  const [editingRisk, setEditingRisk] = useState(false);
  const [riskDraft, setRiskDraft] = useState({ ...userRiskProfile });
  const [saveSuccess, setSaveSuccess] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Physical Gravity Dismissal Close Handlers
  const closeUpgradeModal = useCallback(() => {
    if (isUpgradeClosing) return;
    setIsUpgradeClosing(true);
    setTimeout(() => {
      setUpgradeModalOpen(false);
      setIsUpgradeClosing(false);
    }, 520);
  }, [isUpgradeClosing]);

  const closeDeleteModal = useCallback(() => {
    if (isDeleteClosing) return;
    setIsDeleteClosing(true);
    setTimeout(() => {
      setDeleteModalOpen(false);
      setIsDeleteClosing(false);
    }, 520);
  }, [isDeleteClosing]);

  // Global Escape key listener for open modals
  useEffect(() => {
    if (!upgradeModalOpen && !deleteModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (upgradeModalOpen) closeUpgradeModal();
        if (deleteModalOpen) closeDeleteModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [upgradeModalOpen, deleteModalOpen, closeUpgradeModal, closeDeleteModal]);

  const handleSaveRisk = () => {
    updateRiskProfile(riskDraft);
    setEditingRisk(false);
    setSaveSuccess('Risk profile updated successfully.');
    setTimeout(() => setSaveSuccess(''), 3000);
  };

  const handleUpgrade = async (plan, price) => {
    // Close the plan-picker modal immediately; the Razorpay overlay takes over.
    closeUpgradeModal();
    setPaymentError('');
    setPaymentLoading(true);

    try {
      const result = await upgradePlan(plan, price);

      if (result?.success) {
        const label = plan === '1 MONTH' ? '/month'
                    : plan === '3 MONTHS' ? '/3 months'
                    : plan === '6 MONTHS' ? '/6 months'
                    : plan === '1 YEAR'   ? '/year' : '';
        setSaveSuccess(
          `Payment successful! IndexPilot ${plan} activated — ₹${price.toLocaleString('en-IN')}${label}`
        );
        setTimeout(() => setSaveSuccess(''), 5000);
      } else if (result?.cancelled) {
        // User closed Razorpay modal — no error banner needed.
      } else {
        setPaymentError(result?.error || 'Payment could not be completed. Please try again.');
        setTimeout(() => setPaymentError(''), 6000);
      }
    } catch (err) {
      setPaymentError(err?.message || 'An unexpected error occurred. Please try again.');
      setTimeout(() => setPaymentError(''), 6000);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDeleteRequest = () => {
    setDeletionRequested(true);
    closeDeleteModal();
    setSaveSuccess('Data deletion request logged per DPDP Act. Our team will process this within 30 days.');
    setTimeout(() => setSaveSuccess(''), 5000);
  };

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      color: '#0F172A',
      minHeight: '100vh',
      padding: '32px 40px 60px',
      fontFamily: 'var(--font-ui)'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#214ECF' }} />
            <span style={{ fontSize: '11px', color: '#214ECF', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ACCOUNT & BILLING
            </span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: '1.2', color: '#0F172A', margin: 0 }}>
            Subscription & Settings
          </h1>
        </div>

        {saveSuccess && (
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', color: '#1E40AF', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#214ECF" /> {saveSuccess}
          </div>
        )}

        {paymentError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', color: '#DC2626', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span> {paymentError}
          </div>
        )}

        {paymentLoading && (
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', color: '#166534', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⏳</span> Opening payment gateway…
          </div>
        )}

        {/* ── ACTIVE SUBSCRIPTION SECTION ────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '12px' }}>
            ACTIVE SUBSCRIPTION
          </h3>

          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <span style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#214ECF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '6px',
                letterSpacing: '0.04em'
              }}>
                CURRENT PLAN
              </span>

              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: '10px 0 4px' }}>
                IndexPilot {subscription?.plan || '3 MONTHS'} (₹{subscription?.price?.toLocaleString('en-IN') || '2,499'}{subscription?.billingLabel || '/3 months'})
              </h2>

              <p style={{ fontSize: '13px', color: '#64748B', fontWeight: 400, margin: 0 }}>
                Effective Rate: <strong style={{ color: '#214ECF', fontFamily: 'monospace' }}>{subscription?.effectiveMonthly || '≈ ₹833/month'}</strong> · Renews on <strong style={{ color: '#0F172A' }}>{subscription?.renewsOn || '21 Nov 2026'}</strong> via {subscription?.paymentMethod || 'UPI / NetBanking (Auto-Pay)'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setUpgradeModalOpen(true)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#214ECF',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(33, 78, 207, 0.25)',
                  transition: 'all 180ms ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1A3EB4'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#214ECF'; }}
              >
                Upgrade Plan
              </button>

              <button
                onClick={() => setSaveSuccess('Downgrade request submitted. Active until end of billing period.')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: '#F8FAFC',
                  color: '#64748B',
                  border: '1px solid #CBD5E1',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 180ms ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B'; }}
              >
                Downgrade
              </button>
            </div>
          </div>
        </div>

        {/* ── BILLING HISTORY SECTION ────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '12px' }}>
            BILLING HISTORY
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {subscription?.billingHistory?.map((inv) => (
              <div
                key={inv.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>
                    Invoice #{inv.id} — {inv.plan}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    {inv.date}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '14px', fontFamily: 'monospace' }}>
                    ₹{inv.amount}
                  </span>

                  <span style={{
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    color: '#214ECF',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px'
                  }}>
                    {inv.status}
                  </span>

                  <button
                    onClick={() => alert(`Downloading invoice #${inv.id}`)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#214ECF',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '13px',
                      fontWeight: 700
                    }}
                  >
                    <Download size={14} /> PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PROFILE / RISK SETTINGS SECTION ────────────────── */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#214ECF', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>
              RISK PROFILE
            </h3>

            <button
              onClick={() => { setEditingRisk(!editingRisk); setRiskDraft({ ...userRiskProfile }); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#F8FAFC',
                color: '#214ECF',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              <Edit3 size={13} /> {editingRisk ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {editingRisk ? (
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                  Trading Experience
                </label>
                <select
                  value={riskDraft.experience}
                  onChange={(e) => setRiskDraft(p => ({ ...p, experience: e.target.value }))}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px 12px', color: '#0F172A', fontSize: '14px', outline: 'none' }}
                >
                  {['New', 'Intermediate', 'Experienced'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                  Capital Range
                </label>
                <select
                  value={riskDraft.capitalRange}
                  onChange={(e) => setRiskDraft(p => ({ ...p, capitalRange: e.target.value }))}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px 12px', color: '#0F172A', fontSize: '14px', outline: 'none' }}
                >
                  {['<₹25k', '₹25k–1L', '₹1L–5L', '₹5L+'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                  Max Acceptable Loss per Trade
                </label>
                <select
                  value={riskDraft.maxAcceptableLoss}
                  onChange={(e) => setRiskDraft(p => ({ ...p, maxAcceptableLoss: Number(e.target.value) }))}
                  style={{ width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px 12px', color: '#0F172A', fontSize: '14px', outline: 'none', fontFamily: 'monospace' }}
                >
                  {[500, 1000, 2500, 5000, 10000].map(o => <option key={o} value={o}>₹{o.toLocaleString('en-IN')}</option>)}
                </select>
              </div>

              <button
                onClick={handleSaveRisk}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', padding: '10px 20px', borderRadius: '6px', background: '#214ECF', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(33, 78, 207, 0.25)' }}
              >
                <Save size={15} /> Save Risk Profile
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              {[
                { label: 'Experience', value: userRiskProfile.experience },
                { label: 'Capital Range', value: userRiskProfile.capitalRange },
                { label: 'Max Loss Cap', value: `₹${userRiskProfile.maxAcceptableLoss?.toLocaleString('en-IN')}`, isRisk: true },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: '#0F172A', marginTop: '4px', fontFamily: m.isRisk ? 'monospace' : 'inherit' }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── PRIVACY & DATA DELETION ────────────────── */}
        {!deletionRequested ? (
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px 24px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
            marginTop: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div>
              <h4 style={{ color: '#0F172A', fontWeight: 700, fontSize: '14px', margin: 0 }}>
                Privacy & Data Deletion
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4', margin: '4px 0 0' }}>
                Per DPDP Act, you may request full account data deletion at any time.
              </p>
            </div>

            <button
              onClick={() => setDeleteModalOpen(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                color: '#64748B',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 180ms ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#DC2626'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            >
              Request Deletion
            </button>
          </div>
        ) : (
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px 20px', borderRadius: '8px', color: '#64748B', fontSize: '13px', fontWeight: 600, marginTop: '24px' }}>
            ✓ Deletion request received. Processing within 30 days per DPDP Act.
          </div>
        )}

        {/* Upgrade Modal with Physical Gravity Falling Dismissal */}
        {upgradeModalOpen && (
          <div
            className={`physics-modal-overlay ${isUpgradeClosing ? 'is-closing' : ''}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeUpgradeModal();
              }
            }}
          >
            <div className={`physics-modal-card ${isUpgradeClosing ? 'is-closing' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#214ECF' }} />
                    <span style={{ fontSize: '11px', color: '#214ECF', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      INDEXPILOT SUBSCRIPTION
                    </span>
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Upgrade Your IndexPilot Plan
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeUpgradeModal}
                  disabled={isUpgradeClosing}
                  style={{
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#64748B',
                    cursor: isUpgradeClosing ? 'default' : 'pointer',
                    transition: 'all 180ms ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}
                >
                  ✕ Close
                </button>
              </div>

              <IndexPilotPricingCards
                currentPlan={subscription?.plan}
                onSelectPlan={handleUpgrade}
                showHeader={false}
                isModal={true}
              />
            </div>
          </div>
        )}

        {/* Delete Confirm Modal with Physical Gravity Falling Dismissal */}
        {deleteModalOpen && (
          <div
            className={`physics-modal-overlay ${isDeleteClosing ? 'is-closing' : ''}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeDeleteModal();
              }
            }}
          >
            <div
              className={`physics-modal-card ${isDeleteClosing ? 'is-closing' : ''}`}
              style={{ maxWidth: '440px' }}
            >
              <h3 style={{ color: '#DC2626', fontWeight: 800, fontSize: '16px', marginBottom: '10px', margin: 0 }}>Confirm Data Deletion Request</h3>
              <p style={{ color: '#64748B', fontSize: '13px', lineHeight: '1.5', margin: '8px 0 20px' }}>
                This will permanently delete your account data. You will be logged out and your subscription will be cancelled at end of billing period. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={isDeleteClosing}
                  style={{ padding: '9px 16px', borderRadius: '6px', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', fontWeight: 600, fontSize: '12px', cursor: isDeleteClosing ? 'default' : 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRequest}
                  disabled={isDeleteClosing}
                  style={{ padding: '9px 16px', borderRadius: '6px', background: '#DC2626', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '12px', cursor: isDeleteClosing ? 'default' : 'pointer' }}
                >
                  Confirm Deletion
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
