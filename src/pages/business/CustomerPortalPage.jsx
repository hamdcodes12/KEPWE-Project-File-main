import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import './CustomerPortalPage.css';
import {
  ShieldCheck,
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  PhoneCall,
  MessageSquare,
  Plus,
  Download,
  LayoutDashboard,
  Calculator,
  UsersRound,
  ChartNoAxesCombined,
  FolderLock,
  Headphones,
  FileCheck2,
  Receipt,
  Building2,
  WalletCards,
  CalendarCheck,
  Building,
  Send,
  Ticket,
  X,
  TrendingUp,
  Briefcase,
  UserCheck,
  IndianRupee,
  Paperclip,
  Filter
} from 'lucide-react';

// ── Helper for category icons & styles ─────────────────────────────
const getCategoryMeta = (category) => {
  switch (category) {
    case 'GST': return { icon: FileCheck2, class: 'cat-gst' };
    case 'TDS': return { icon: Receipt, class: 'cat-tds' };
    case 'MCA': return { icon: Building2, class: 'cat-mca' };
    case 'Payroll': return { icon: WalletCards, class: 'cat-payroll' };
    default: return { icon: FileText, class: 'cat-gst' };
  }
};

const CustomerPortalPage = () => {
  const {
    authState,
    portalProfile,
    portalSnapshot,
    customerTasks,
    customerDocuments,
    addCustomerDocument,
    downloadCustomerDocument,
    createCustomerCompany,
    refreshPortal,
    supportTickets,
    refreshSupportTickets,
    createSupportTicket,
    openSupportTicket,
    sendTicketMessage,
    updateSupportTicket,
  } = useApp();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('Company Documents');
  const [selectedFile, setSelectedFile] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [companyError, setCompanyError] = useState('');

  // Support ticket state
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'General', priority: 'Normal', description: '' });
  const [ticketError, setTicketError] = useState('');
  const [savingTicket, setSavingTicket] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('');

  useEffect(() => {
    if (authState.isLoggedIn) {
      refreshPortal();
      refreshSupportTickets();
    }
  }, [authState.isLoggedIn, refreshPortal, refreshSupportTickets]);

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Select a file before uploading.');
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadError('Files must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    setUploadError('');

    const fileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(selectedFile);
    });
    const result = await addCustomerDocument({
      name: selectedFile.name,
      category: uploadCategory,
      fileData,
      mimeType: selectedFile.type || 'application/octet-stream',
      fileSizeBytes: selectedFile.size,
    });

    setUploading(false);
    if (result.success) {
      setSelectedFile(null);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 4000);
    } else {
      setUploadError(result.error || 'Could not upload document.');
    }
  };

  const handleDownload = async (documentId) => {
    setDownloadingId(documentId);
    const result = await downloadCustomerDocument(documentId);
    setDownloadingId(null);
    if (!result.success) setUploadError(result.error);
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!companyNameInput.trim()) return;
    setCreatingCompany(true);
    setCompanyError('');
    const result = await createCustomerCompany(companyNameInput.trim());
    setCreatingCompany(false);
    if (result.success) {
      setCompanyNameInput('');
    } else {
      setCompanyError(result.error);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setTicketError('');
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      setTicketError('Subject and description are required.');
      return;
    }
    setSavingTicket(true);
    const result = await createSupportTicket(ticketForm);
    setSavingTicket(false);
    if (result.success) {
      setTicketModalOpen(false);
      setTicketForm({ subject: '', category: 'General', priority: 'Normal', description: '' });
    } else {
      setTicketError(result.error || 'Could not create ticket.');
    }
  };

  const handleOpenTicket = async (ticketId) => {
    setTicketLoading(true);
    const result = await openSupportTicket(ticketId);
    setTicketLoading(false);
    if (result.success) {
      setActiveTicket(result.data.ticket);
      setTicketMessages(result.data.messages || []);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeTicket) return;
    const result = await sendTicketMessage(activeTicket.id, newMessage);
    if (result.success) {
      setNewMessage('');
      handleOpenTicket(activeTicket.id);
    }
  };

  const handleUpdateTicketStatus = async (ticketId, status) => {
    const result = await updateSupportTicket(ticketId, { status });
    if (result.success && activeTicket?.id === ticketId) {
      setActiveTicket((prev) => prev ? { ...prev, status } : prev);
    }
  };

  const companyName = portalProfile?.company?.name || 'your company';
  const greetingName = authState.user?.name?.split(' ')[0] || 'there';

  const filteredTickets = supportTickets.filter(
    (t) => !ticketFilter || t.status === ticketFilter
  );

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  // Count tasks by status
  const completedTasks = customerTasks.filter((t) => t.status === 'Completed').length;
  const pendingTasks = customerTasks.filter((t) => t.status !== 'Completed').length;
  const openTickets = supportTickets.filter((t) => ['Open', 'In Progress'].includes(t.status)).length;

  return (
    <div className="cp-page-wrapper">
      <div className="cp-container">
        {/* Header Greeting & Company Badge */}
        <div className="cp-header-block">
          <div>
            <span className="cp-eyebrow">KEPWE BUSINESS CUSTOMER PORTAL</span>
            <h1 className="cp-main-title">Welcome back, {greetingName}</h1>
          </div>
          <div className="cp-company-badge">
            <Building size={16} color="#214ECF" />
            <span className="cp-company-label">Company:</span>
            <span className="cp-company-name">{companyName}</span>
          </div>
        </div>

        {!portalProfile?.company && (
          <div className="cp-upload-box" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <Building2 size={22} color="#214ECF" />
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 6px', color: '#0F172A', fontSize: '1.05rem' }}>Set up your company workspace</h3>
                <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: '0.86rem', lineHeight: 1.5 }}>
                  Add your company name to create the database-backed Ledger workspace and onboarding checklist.
                </p>
                <form onSubmit={handleCreateCompany} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    required
                    minLength={2}
                    value={companyNameInput}
                    onChange={(e) => setCompanyNameInput(e.target.value)}
                    placeholder="Registered company name"
                    className="cp-input-field"
                    style={{ flex: '1 1 260px' }}
                  />
                  <button type="submit" disabled={creatingCompany} className="cp-btn-upload">
                    <Building2 size={16} /> {creatingCompany ? 'Creating…' : 'Create workspace'}
                  </button>
                </form>
                {companyError && <div style={{ color: '#DC2626', marginTop: '10px', fontSize: '0.82rem', fontWeight: 600 }}>{companyError}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Upload Success Toast */}
        {uploadSuccess && (
          <div className="cp-toast-alert">
            <CheckCircle2 size={18} />
            <span>Document uploaded successfully and added to your company vault.</span>
          </div>
        )}

        {/* Business Health Snapshot */}
        <div className="cp-snapshot-panel">
          <div className="cp-snapshot-header">
            <h3 className="cp-snapshot-title">BUSINESS HEALTH SNAPSHOT</h3>
            <div className="cp-live-indicator">
              <span className="cp-live-dot" />
              <span>LIVE FEED</span>
            </div>
          </div>

          <div className="cp-snapshot-grid">
            {(portalSnapshot?.metrics || []).map((m) => {
              const valClass = m.status === 'On Track' ? 'val-green' : m.status === 'Pending' ? 'val-amber' : m.status === 'Action Required' ? 'val-red' : 'val-accounting';
              return (
                <div className="cp-metric-card" key={m.label}>
                  <span className="cp-metric-label">{m.label}</span>
                  <div className={`cp-metric-val ${valClass}`}>{m.status}</div>
                  <span className="cp-metric-subtext">{m.subtext}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="cp-tab-container">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'compliance', label: 'Compliance & Tax', icon: ShieldCheck },
            { id: 'accounting', label: 'Accounting', icon: Calculator },
            { id: 'payroll', label: 'Payroll & HR', icon: UsersRound },
            { id: 'finance', label: 'Business Finance', icon: ChartNoAxesCombined },
            { id: 'documents', label: 'Document Vault', icon: FolderLock },
            { id: 'support', label: 'Support & Tickets', icon: Headphones },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`cp-tab-btn ${isActive ? 'active' : ''}`}
              >
                <TabIcon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB: DASHBOARD (Overview) */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="cp-section-header">
              <LayoutDashboard size={22} className="cp-section-title-icon" />
              <h3 className="cp-section-title">Overview</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="cp-metric-card" style={{ textAlign: 'center' }}>
                <span className="cp-metric-label">COMPLIANCE TASKS</span>
                <div className="cp-metric-val val-accounting">{customerTasks.length}</div>
                <span className="cp-metric-subtext">{completedTasks} completed · {pendingTasks} pending</span>
              </div>
              <div className="cp-metric-card" style={{ textAlign: 'center' }}>
                <span className="cp-metric-label">DOCUMENTS</span>
                <div className="cp-metric-val val-green">{customerDocuments.length}</div>
                <span className="cp-metric-subtext">Uploaded to your vault</span>
              </div>
              <div className="cp-metric-card" style={{ textAlign: 'center' }}>
                <span className="cp-metric-label">OPEN TICKETS</span>
                <div className="cp-metric-val val-amber">{openTickets}</div>
                <span className="cp-metric-subtext">Support requests</span>
              </div>
              <div className="cp-metric-card" style={{ textAlign: 'center' }}>
                <span className="cp-metric-label">PORTAL STATUS</span>
                <div className="cp-metric-val val-accounting">{portalProfile?.company ? 'Configured' : 'Set up required'}</div>
                <span className="cp-metric-subtext">{portalProfile?.company ? 'Company workspace connected' : 'Complete business onboarding to begin'}</span>
              </div>
            </div>

            {/* Recent compliance tasks */}
            <div className="cp-section-header" style={{ marginTop: '8px' }}>
              <CalendarCheck size={22} className="cp-section-title-icon" />
              <h3 className="cp-section-title">Recent Compliance Tasks</h3>
            </div>
            <div className="cp-tasks-list">
              {customerTasks.slice(0, 5).map((t) => {
                const catMeta = getCategoryMeta(t.category);
                const CatIcon = catMeta.icon;
                const statusClass = t.status === 'Completed' ? 'status-completed' : t.status === 'In Progress' ? 'status-in-progress' : 'status-upcoming';
                return (
                  <div key={t.id} className="cp-task-card">
                    <div className="cp-task-left">
                      <div>
                        <span className={`cp-task-category-badge ${catMeta.class}`}>
                          <CatIcon size={13} />
                          <span>{t.category}</span>
                        </span>
                        <h4 className="cp-task-title">{t.title}</h4>
                        <div className="cp-task-date">
                          <Clock size={13} />
                          <span>Due: {t.dueDate}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className={`cp-status-pill ${statusClass}`}>
                        {t.status === 'Completed' && <CheckCircle2 size={13} />}
                        {t.status === 'In Progress' && <Clock size={13} />}
                        {t.status === 'Upcoming' && <AlertCircle size={13} />}
                        <span>{t.status}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
              {customerTasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '0.85rem' }}>
                  No compliance tasks yet. Complete business onboarding to generate your compliance calendar.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: COMPLIANCE & TAX */}
        {activeTab === 'compliance' && (
          <div>
            <div className="cp-section-header">
              <ShieldCheck size={22} className="cp-section-title-icon" />
              <h3 className="cp-section-title">Compliance Calendar & Tax Tasks</h3>
            </div>

            <div className="cp-tasks-list">
              {customerTasks.map((t) => {
                const catMeta = getCategoryMeta(t.category);
                const CatIcon = catMeta.icon;
                const statusClass = t.status === 'Completed' ? 'status-completed' : t.status === 'In Progress' ? 'status-in-progress' : 'status-upcoming';
                return (
                  <div key={t.id} className="cp-task-card">
                    <div className="cp-task-left">
                      <div>
                        <span className={`cp-task-category-badge ${catMeta.class}`}>
                          <CatIcon size={13} />
                          <span>{t.category}</span>
                        </span>
                        <h4 className="cp-task-title">{t.title}</h4>
                        <div className="cp-task-date">
                          <Clock size={13} />
                          <span>Due Date: {t.dueDate}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className={`cp-status-pill ${statusClass}`}>
                        {t.status === 'Completed' && <CheckCircle2 size={13} />}
                        {t.status === 'In Progress' && <Clock size={13} />}
                        {t.status === 'Upcoming' && <AlertCircle size={13} />}
                        <span>{t.status}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
              {customerTasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', background: '#F8FAFC', borderRadius: '12px', color: '#94A3B8' }}>
                  <ShieldCheck size={36} style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontWeight: 600 }}>No compliance tasks yet</div>
                  <div style={{ fontSize: '0.82rem', marginTop: '6px' }}>Complete your business onboarding to generate your compliance calendar.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: ACCOUNTING */}
        {activeTab === 'accounting' && (
          <div>
            <div className="cp-section-header">
              <Calculator size={22} className="cp-section-title-icon" />
              <h3 className="cp-section-title">Accounting & Bookkeeping</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="cp-metric-card">
                <span className="cp-metric-label">ACCOUNTING STATUS</span>
                <div className="cp-metric-val val-accounting">{portalSnapshot?.metrics?.find?.((m) => m.label === 'ACCOUNTING')?.status || '0%'}</div>
                <span className="cp-metric-subtext">{portalSnapshot?.metrics?.find?.((m) => m.label === 'ACCOUNTING')?.subtext || 'Not started'}</span>
              </div>
            </div>

            {/* Quick document upload for accounting */}
            <div className="cp-upload-box">
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="#214ECF" /> Upload Accounting Documents
              </h4>
              <form onSubmit={handleDocumentUpload} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Document Category</label>
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="cp-input-field">
                      <option>Sales</option>
                      <option>Purchases</option>
                      <option>Bank Statements</option>
                      <option>Tax</option>
                      <option>Company Documents</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Document Name</label>
                    <input required type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="cp-input-field" />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button type="submit" disabled={uploading} className="cp-btn-upload">
                    <Upload size={18} /> {uploading ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </form>
            </div>

            {/* Recent accounting documents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {customerDocuments.filter((d) => ['Sales', 'Purchases', 'Bank Statements', 'Tax'].includes(d.category)).map((doc) => (
                <div key={doc.id} className="cp-doc-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(33, 78, 207, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#214ECF' }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>{doc.name}</h4>
                      <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>{doc.category} · {doc.uploadDate}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.78rem', background: 'rgba(16,185,129,0.1)', color: '#059669', padding: '5px 12px', borderRadius: '999px', fontWeight: 700 }}>{doc.status}</span>
                </div>
              ))}
              {customerDocuments.filter((d) => ['Sales', 'Purchases', 'Bank Statements', 'Tax'].includes(d.category)).length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '0.85rem' }}>No accounting documents uploaded yet.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PAYROLL & HR */}
        {activeTab === 'payroll' && (
          <div>
            <div className="cp-section-header">
              <UsersRound size={22} className="cp-section-title-icon" />
              <h3 className="cp-section-title">Payroll & HR</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="cp-metric-card">
                <span className="cp-metric-label">EMPLOYEES</span>
                <div className="cp-metric-val val-accounting">
                  {portalSnapshot?.metrics?.find?.((m) => m.label === 'PAYROLL')?.status || '0 Emp'}
                </div>
                <span className="cp-metric-subtext">{portalSnapshot?.metrics?.find?.((m) => m.label === 'PAYROLL')?.subtext || 'No employees on record'}</span>
              </div>
            </div>

            {/* Payroll document upload */}
            <div className="cp-upload-box">
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="#214ECF" /> Upload Payroll Documents
              </h4>
              <form onSubmit={handleDocumentUpload} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Document Category</label>
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value === 'Payroll' ? 'Payroll' : 'Payroll')} className="cp-input-field">
                      <option value="Payroll">Payroll</option>
                      <option value="Company Documents">Company Documents</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Document Name</label>
                    <input required type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="cp-input-field" />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button type="submit" disabled={uploading} className="cp-btn-upload">
                    <Upload size={18} /> {uploading ? 'Uploading...' : 'Upload Payroll Document'}
                  </button>
                </div>
              </form>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {customerDocuments.filter((d) => d.category === 'Payroll').map((doc) => (
                <div key={doc.id} className="cp-doc-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(33, 78, 207, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#214ECF' }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>{doc.name}</h4>
                      <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>{doc.category} · {doc.uploadDate}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.78rem', background: 'rgba(16,185,129,0.1)', color: '#059669', padding: '5px 12px', borderRadius: '999px', fontWeight: 700 }}>{doc.status}</span>
                </div>
              ))}
              {customerDocuments.filter((d) => d.category === 'Payroll').length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '0.85rem' }}>No payroll documents uploaded yet.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB: BUSINESS FINANCE */}
        {activeTab === 'finance' && (
          <div>
            <div className="cp-section-header">
              <ChartNoAxesCombined size={22} className="cp-section-title-icon" />
              <h3 className="cp-section-title">Business Finance</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="cp-metric-card">
                <span className="cp-metric-label">FINANCE HEALTH</span>
                <div className="cp-metric-val val-accounting">{customerDocuments.length}</div>
                <span className="cp-metric-subtext">Financial documents in your vault</span>
              </div>
              <div className="cp-metric-card">
                <span className="cp-metric-label">DOCUMENTS</span>
                <div className="cp-metric-val val-accounting">{customerDocuments.length}</div>
                <span className="cp-metric-subtext">Total in your vault</span>
              </div>
            </div>

            {/* Finance upload */}
            <div className="cp-upload-box">
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="#214ECF" /> Upload Financial Documents
              </h4>
              <form onSubmit={handleDocumentUpload} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Document Category</label>
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="cp-input-field">
                      <option>Bank Statements</option>
                      <option>Tax</option>
                      <option>Sales</option>
                      <option>Purchases</option>
                      <option>Company Documents</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Document Name</label>
                    <input required type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="cp-input-field" />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button type="submit" disabled={uploading} className="cp-btn-upload">
                    <Upload size={18} /> {uploading ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB: DOCUMENTS VAULT */}
        {activeTab === 'documents' && (
          <div className="cp-vault-panel">
            <div className="cp-section-header">
              <FolderLock size={22} className="cp-section-title-icon" />
              <h3 className="cp-section-title">Document Upload & Vault</h3>
            </div>

            {/* Drag & Drop Upload Section */}
            <div className="cp-upload-box">
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="#214ECF" /> Upload Company & Financial Documents
              </h4>
              <form onSubmit={handleDocumentUpload} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Select Category</label>
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="cp-input-field">
                      <option>Company Documents</option>
                      <option>GST</option>
                      <option>Bank Statements</option>
                      <option>Sales</option>
                      <option>Purchases</option>
                      <option>Payroll</option>
                      <option>Tax</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Document Name / File</label>
                    <input required type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="cp-input-field" />
                  </div>
                </div>

                {uploadError && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600 }}>
                    {uploadError}
                  </div>
                )}

                <div style={{ textAlign: 'right' }}>
                  <button type="submit" disabled={uploading} className="cp-btn-upload">
                    <Upload size={18} /> {uploading ? 'Uploading File...' : 'Upload Document'}
                  </button>
                </div>
              </form>
            </div>

            {/* Document List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {customerDocuments.map((doc) => (
                <div key={doc.id} className="cp-doc-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(33, 78, 207, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#214ECF' }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>{doc.name}</h4>
                      <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>{doc.category} · {doc.uploadDate} · {doc.size}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', background: 'rgba(16,185,129,0.1)', color: '#059669', padding: '5px 12px', borderRadius: '999px', fontWeight: 700 }}>{doc.status}</span>
                    {doc.hasFile && (
                      <button type="button" onClick={() => handleDownload(doc.id)} disabled={downloadingId === doc.id} className="cp-btn-upload" style={{ padding: '7px 10px' }}>
                        <Download size={14} /> {downloadingId === doc.id ? 'Preparing…' : 'Download'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {customerDocuments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontSize: '0.85rem' }}>
                  <FolderLock size={36} style={{ margin: '0 auto 12px', display: 'block' }} />
                  No documents uploaded yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: SUPPORT & TICKETS */}
        {activeTab === 'support' && (
          <div className="cp-vault-panel">
            <div className="cp-section-header">
              <Headphones size={22} className="cp-section-title-icon" />
              <h3 className="cp-section-title">Support & Tickets</h3>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <p style={{ color: '#64748B', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>
                Create a support ticket and track the conversation here.
              </p>
              <button onClick={() => setTicketModalOpen(true)} className="cp-btn-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> New Ticket
              </button>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {['', 'Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
                <button
                  key={s || 'all'}
                  onClick={() => setTicketFilter(s)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid #E2E8F0',
                    background: ticketFilter === s ? '#214ECF' : '#FFFFFF',
                    color: ticketFilter === s ? '#FFFFFF' : '#64748B',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>

            {/* Ticket list */}
            {filteredTickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontSize: '0.85rem' }}>
                <Ticket size={36} style={{ margin: '0 auto 12px', display: 'block' }} />
                No support tickets yet. Create one to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredTickets.map((t) => (
                  <div key={t.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }} onClick={() => handleOpenTicket(t.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>{t.subject}</span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: t.status === 'Open' ? '#214ECF' : t.status === 'In Progress' ? '#D97706' : t.status === 'Resolved' ? '#059669' : '#64748B', background: 'rgba(33, 78, 207, 0.08)', padding: '3px 8px', borderRadius: '5px' }}>{t.status}</span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: '5px' }}>{t.priority}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '8px' }}>
                          {t.category} · Created {fmtDate(t.created_at)}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                        {t.updated_at && `Updated ${fmtDate(t.updated_at)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active ticket detail modal */}
            {activeTicket && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
                <div style={{ maxWidth: '660px', width: '100%', background: '#FFFFFF', borderRadius: '16px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(15,23,42,0.15)', border: '1px solid #E2E8F0' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{activeTicket.subject}</h3>
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px' }}>
                        {activeTicket.category} · {activeTicket.priority} · Created {fmtDateTime(activeTicket.created_at)}
                      </div>
                    </div>
                    <button onClick={() => setActiveTicket(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>

                  {/* Status update */}
                  <div style={{ padding: '16px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>Status:</label>
                    {['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleUpdateTicketStatus(activeTicket.id, s)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '16px',
                          border: '1px solid #E2E8F0',
                          background: activeTicket.status === s ? '#214ECF' : '#FFFFFF',
                          color: activeTicket.status === s ? '#FFFFFF' : '#64748B',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px', border: '1px solid #E2E8F0', fontSize: '0.88rem', color: '#475569', lineHeight: 1.6 }}>
                      {activeTicket.description}
                    </div>

                    {/* Messages */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                      {ticketMessages.map((m) => (
                        <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender_type === 'user' ? 'flex-end' : 'flex-start' }}>
                          <div style={{ background: m.sender_type === 'user' ? '#214ECF' : '#F1F5F9', color: m.sender_type === 'user' ? '#FFFFFF' : '#0F172A', borderRadius: '10px', padding: '10px 14px', fontSize: '0.85rem', maxWidth: '85%', lineHeight: 1.5 }}>
                            {m.message}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '4px' }}>
                            {m.sender_name} · {fmtDateTime(m.created_at)}
                          </div>
                        </div>
                      ))}
                      {ticketMessages.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '0.8rem' }}>No messages yet.</div>
                      )}
                    </div>

                    {/* Reply */}
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
                      <input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', outline: 'none', background: '#FFFFFF' }}
                      />
                      <button type="submit" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', background: '#214ECF', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                        <Send size={14} /> Send
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* NEW TICKET MODAL */}
        {ticketModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
            <div style={{ maxWidth: '520px', width: '100%', background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 20px 50px rgba(15,23,42,0.15)', border: '1px solid #E2E8F0' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>New Support Ticket</h3>
                <button onClick={() => setTicketModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateTicket} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {ticketError && (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600 }}>
                    {ticketError}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>Subject *</label>
                  <input
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Brief summary of your issue"
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>Category</label>
                    <select
                      value={ticketForm.category}
                      onChange={(e) => setTicketForm((p) => ({ ...p, category: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.85rem', outline: 'none' }}
                    >
                      <option value="General">General</option>
                      <option value="GST">GST</option>
                      <option value="Accounting">Accounting</option>
                      <option value="Payroll">Payroll</option>
                      <option value="Compliance">Compliance</option>
                      <option value="Technical">Technical</option>
                      <option value="Billing">Billing</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>Priority</label>
                    <select
                      value={ticketForm.priority}
                      onChange={(e) => setTicketForm((p) => ({ ...p, priority: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.85rem', outline: 'none' }}
                    >
                      <option value="Low">Low</option>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>Description *</label>
                  <textarea
                    value={ticketForm.description}
                    onChange={(e) => setTicketForm((p) => ({ ...p, description: e.target.value }))}
                    rows={4}
                    placeholder="Describe the issue in detail..."
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                  <button type="button" onClick={() => setTicketModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingTicket} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', background: '#214ECF', color: '#FFFFFF', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: savingTicket ? 'not-allowed' : 'pointer' }}>
                    <Plus size={14} /> {savingTicket ? 'Creating...' : 'Create Ticket'}
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

export default CustomerPortalPage;