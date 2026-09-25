import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import './SalesCRMPage.css';
import { 
  Users, 
  PhoneCall, 
  UserCheck, 
  Flame, 
  Sun, 
  Snowflake, 
  ArrowRight, 
  Clock, 
  Filter, 
  Plus, 
  Play, 
  Settings, 
  CheckCircle2, 
  MessageSquare, 
  Mail, 
  Zap, 
  X,
  TrendingUp,
  ShieldCheck,
  Building2,
  FileCheck2
} from 'lucide-react';

const SalesCRMPage = () => {
  const {
    crmLeads,
    updateLeadStatus,
    addCRMLead,
    leadsKpis,
    leadsAccessDenied,
    refreshLeads,
    cadenceSteps,
    refreshCadence,
    testCadenceStep,
    saveCadenceStep,
  } = useApp();
  const [filterScore, setFilterScore] = useState('ALL');
  const [workflowEnabled, setWorkflowEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline' | 'workflow'
  const [editingStep, setEditingStep] = useState(null);
  const [testResultToast, setTestResultToast] = useState('');
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [addLeadForm, setAddLeadForm] = useState({ companyName: '', contactName: '', mobile: '', email: '', industry: '', state: '' });
  const [addLeadError, setAddLeadError] = useState('');

  useEffect(() => {
    refreshLeads();
    refreshCadence();
  }, [refreshLeads, refreshCadence]);

  const filteredLeads = crmLeads.filter(
    (l) => filterScore === 'ALL' || l.leadScore === filterScore
  );

  const handleTestWorkflowStep = async (step) => {
    const result = await testCadenceStep(step);
    setTestResultToast(result.success ? `✓ ${result.message}` : result.error);
    setTimeout(() => setTestResultToast(''), 4000);
  };

  const handleSaveStep = async (e) => {
    e.preventDefault();
    if (!editingStep) return;
    const result = await saveCadenceStep(editingStep);
    setTestResultToast(result.success ? `Updated workflow step for ${editingStep.day}.` : result.error);
    setEditingStep(null);
    setTimeout(() => setTestResultToast(''), 3000);
  };

  const handleAddLead = async (e) => {
    e.preventDefault();
    setAddLeadError('');
    const result = await addCRMLead({
      companyName: addLeadForm.companyName,
      contactName: addLeadForm.contactName,
      mobile: addLeadForm.mobile,
      email: addLeadForm.email,
      industry: addLeadForm.industry,
      state: addLeadForm.state,
      leadScore: 'WARM',
      leadSource: 'Manual',
    });
    if (result.success) {
      setAddLeadOpen(false);
      setAddLeadForm({ companyName: '', contactName: '', mobile: '', email: '', industry: '', state: '' });
    } else {
      setAddLeadError(result.error || 'Could not add lead.');
    }
  };

  return (
    <div className="crm-page-wrapper">
      {/* Background Gradients & Light Grid */}
      <div className="crm-bg-glow crm-bg-glow-blue" aria-hidden="true" />
      <div className="crm-bg-glow crm-bg-glow-cyan" aria-hidden="true" />
      <div className="crm-bg-grid" aria-hidden="true" />

      {/* Floating Ornaments */}
      <div className="crm-float-dot" aria-hidden="true" />
      <div className="crm-float-circle" aria-hidden="true" />

      <div className="crm-container">
        {/* Header */}
        <div className="crm-header-block">
          <div>
            <span className="crm-eyebrow">INTERNAL SALES CRM · LEAD ENGINE</span>
            <h1 className="crm-main-title">Inbound & MCA Lead Pipeline</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setActiveTab(activeTab === 'pipeline' ? 'workflow' : 'pipeline')}
              className="crm-btn-toggle"
            >
              {activeTab === 'pipeline' ? '⚡ View Cadence Workflow' : '📊 View Lead Pipeline'}
            </button>
            <button className="crm-btn-add" onClick={() => setAddLeadOpen(true)}>
              <Plus size={16} /> Add Lead
            </button>
          </div>
        </div>

        {/* KPI Cards — real counts from PostgreSQL (GET /api/leads) */}
        <div className="crm-kpi-grid">
          <div className="crm-kpi-card" style={{ animationDelay: '80ms' }}>
            <div className="crm-kpi-val kpi-blue">{(leadsKpis?.new ?? 0).toLocaleString('en-IN')}</div>
            <span className="crm-kpi-label">NEW LEADS</span>
          </div>

          <div className="crm-kpi-card" style={{ animationDelay: '140ms' }}>
            <div className="crm-kpi-val kpi-amber">{(leadsKpis?.called ?? 0).toLocaleString('en-IN')}</div>
            <span className="crm-kpi-label">CALLED</span>
          </div>

          <div className="crm-kpi-card" style={{ animationDelay: '200ms' }}>
            <div className="crm-kpi-val kpi-purple">{(leadsKpis?.connected ?? 0).toLocaleString('en-IN')}</div>
            <span className="crm-kpi-label">CONNECTED</span>
          </div>

          <div className="crm-kpi-card" style={{ animationDelay: '260ms' }}>
            <div className="crm-kpi-val kpi-emerald">{(leadsKpis?.interested ?? 0).toLocaleString('en-IN')}</div>
            <span className="crm-kpi-label">INTERESTED</span>
          </div>

          <div className="crm-kpi-card" style={{ animationDelay: '320ms' }}>
            <div className="crm-kpi-val kpi-teal">{(leadsKpis?.converted ?? 0).toLocaleString('en-IN')}</div>
            <span className="crm-kpi-label">CONVERTED</span>
          </div>
        </div>

        {/* Feedback Toast */}
        {testResultToast && (
          <div className="crm-toast-msg">
            {testResultToast}
          </div>
        )}

        {/* TAB 1: LEAD PIPELINE */}
        {activeTab === 'pipeline' && leadsAccessDenied && (
          <div className="crm-table-card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
            Staff access required to view the lead pipeline.
          </div>
        )}
        {activeTab === 'pipeline' && !leadsAccessDenied && (
          <>
            <div className="crm-filter-bar">
              <div className="crm-filter-group">
                <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 700 }}>Filter Score:</span>
                {['ALL', 'HOT', 'WARM', 'COLD'].map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setFilterScore(sc)}
                    className={`crm-filter-btn ${filterScore === sc ? 'active' : 'inactive'}`}
                  >
                    {sc}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Showing {filteredLeads.length} leads</span>
            </div>

            {/* Light Premium Leads Table Card */}
            <div className="crm-table-card">
              <div className="chain-table-wrapper">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>COMPANY / CONTACT</th>
                      <th>SCORE</th>
                      <th>CIN / GSTIN</th>
                      <th>INDUSTRY & STATE</th>
                      <th>LAST ACTIVITY</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <div className="crm-company-title">{lead.companyName}</div>
                          <div className="crm-company-sub">{lead.contactName} ({lead.mobile})</div>
                        </td>
                        <td>
                          <span
                            className={`score-badge ${lead.leadScore === 'HOT' ? 'score-hot' : lead.leadScore === 'WARM' ? 'score-warm' : 'score-cold'}`}
                          >
                            {lead.leadScore === 'HOT' && <Flame size={12} />}
                            {lead.leadScore === 'WARM' && <Sun size={12} />}
                            {lead.leadScore === 'COLD' && <Snowflake size={12} />}
                            <span>{lead.leadScore}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#475569' }}>CIN: {lead.cin}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>GST: {lead.gstin}</div>
                        </td>
                        <td>
                          <div style={{ color: '#172033', fontWeight: 600 }}>{lead.industry}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>{lead.state}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                            {lead.salesActivity[lead.salesActivity.length - 1] || 'No activity yet'}
                          </div>
                          <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Executive: {lead.assignedExecutive}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => updateLeadStatus(lead.id, 'Interested', 'HOT')}
                            className="btn-advance-lead"
                          >
                            <span>Advance Lead</span>
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2 / VISUAL SECTION: AUTOMATED FOLLOW-UP CADENCE WORKFLOW */}
        <div className="crm-workflow-panel">
          <div className="crm-workflow-header">
            <div>
              <span className="crm-workflow-badge">AUTOMATED WORKFLOW ENGINE</span>
              <h2 className="crm-workflow-title">Lead Nurturing & Reactivation Sequence</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 700 }}>STATUS:</span>
              <button
                onClick={() => setWorkflowEnabled(!workflowEnabled)}
                className={workflowEnabled ? 'crm-status-active-badge' : 'crm-status-paused-badge'}
              >
                {workflowEnabled ? '✓ ACTIVE' : 'PAUSED'}
              </button>
            </div>
          </div>

          {/* Workflow Stepper Diagram — Light Inner Area */}
          <div className="crm-workflow-stepper-bg">
            <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sequential Touchpoint Journey (Day 0 → Day 30)
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
              {cadenceSteps.map((step, idx) => {
                const dayNumber = step.day.replace(/\D/g, '');
                const dayClass = `day-card-${dayNumber}`;
                const staggerDelay = idx * 70;

                return (
                  <React.Fragment key={step.day}>
                    <div 
                      className={`crm-workflow-step-card ${dayClass}`}
                      style={{ animationDelay: `${staggerDelay}ms` }}
                    >
                      <div className="crm-step-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span className="crm-step-day">{step.day}</span>
                          <span className="crm-step-channel">
                            {step.channel}
                          </span>
                        </div>

                        <p className="crm-step-msg">
                          "{step.message}"
                        </p>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleTestWorkflowStep(step)}
                            className="crm-btn-test"
                          >
                            <Play size={10} /> Test
                          </button>
                          <button
                            onClick={() => setEditingStep(step)}
                            className="crm-btn-edit"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>

                    {idx < cadenceSteps.length - 1 && (
                      <ArrowRight size={18} color="#94A3B8" style={{ flexShrink: 0, display: 'none' }} className="desktop-arrow" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* EDIT STEP MODAL */}
        {editingStep && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', border: '1px solid #E2E8F0', boxShadow: '0 20px 48px rgba(15,23,42,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#172033', margin: 0 }}>
                  Edit Cadence Step ({editingStep.day})
                </h3>
                <button onClick={() => setEditingStep(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveStep}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748B', marginBottom: '6px', fontWeight: 600 }}>Channel</label>
                  <select
                    value={editingStep.channel}
                    onChange={(e) => setEditingStep({ ...editingStep, channel: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#172033', fontSize: '0.9rem' }}
                  >
                    <option value="WhatsApp/SMS">WhatsApp/SMS</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Offer / SMS">Offer / SMS</option>
                    <option value="Follow-up Call">Follow-up Call</option>
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748B', marginBottom: '6px', fontWeight: 600 }}>Message Template</label>
                  <textarea
                    rows={3}
                    value={editingStep.message}
                    onChange={(e) => setEditingStep({ ...editingStep, message: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#172033', fontSize: '0.88rem', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setEditingStep(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', cursor: 'pointer', fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#214ECF', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                    Save Step
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ADD LEAD MODAL */}
        {addLeadOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%', border: '1px solid #E2E8F0', boxShadow: '0 20px 48px rgba(15,23,42,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#172033', margin: 0 }}>Add Lead</h3>
                <button onClick={() => setAddLeadOpen(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              {addLeadError && (
                <div style={{ color: '#EF4444', fontSize: '0.82rem', marginBottom: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                  {addLeadError}
                </div>
              )}

              <form onSubmit={handleAddLead} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input required placeholder="Company Name" value={addLeadForm.companyName} onChange={(e) => setAddLeadForm({ ...addLeadForm, companyName: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                <input required placeholder="Contact Name" value={addLeadForm.contactName} onChange={(e) => setAddLeadForm({ ...addLeadForm, contactName: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                <input required placeholder="Mobile" value={addLeadForm.mobile} onChange={(e) => setAddLeadForm({ ...addLeadForm, mobile: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                <input type="email" placeholder="Email" value={addLeadForm.email} onChange={(e) => setAddLeadForm({ ...addLeadForm, email: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                <input placeholder="Industry" value={addLeadForm.industry} onChange={(e) => setAddLeadForm({ ...addLeadForm, industry: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                <input placeholder="State" value={addLeadForm.state} onChange={(e) => setAddLeadForm({ ...addLeadForm, state: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', boxSizing: 'border-box' }} />

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" onClick={() => setAddLeadOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', cursor: 'pointer', fontWeight: 600 }}>
                    Cancel
                  </button>
                  <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#214ECF', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                    Add Lead
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesCRMPage;
