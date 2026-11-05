import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Shield, ArrowLeft, CheckCircle2, Clock, Upload, AlertCircle, FileCheck } from 'lucide-react';

const STATUS_CONFIG = {
  Pending: { bg: 'rgba(245,158,11,0.12)', color: '#D97706', border: '#F59E0B', label: 'Pending' },
  Uploaded: { bg: 'rgba(33,78,207,0.12)', color: '#214ECF', border: '#3B82F6', label: 'Uploaded' },
  Verified: { bg: 'rgba(27,158,90,0.12)', color: '#1B9E5A', border: '#10B981', label: 'Verified' },
  'Action Required': { bg: 'rgba(239,68,68,0.12)', color: '#DC2626', border: '#EF4444', label: 'Action Required' },
};

const CustomerOnboardingChecklistPage = () => {
  const { addChecklistDocument, onboardingChecklist, refreshChecklist } = useApp();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [feedbackToast, setFeedbackToast] = useState('');
  const [uploadModalItem, setUploadModalItem] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    refreshChecklist();
  }, [refreshChecklist]);

  const categories = ['All', 'Company Information', 'Accounting', 'Payroll'];

  const filteredItems = activeCategory === 'All'
    ? onboardingChecklist
    : onboardingChecklist.filter((item) => item.category === activeCategory);

  const totalCount = onboardingChecklist.length;
  const verifiedCount = onboardingChecklist.filter((i) => i.status === 'Verified').length;
  const uploadedCount = onboardingChecklist.filter((i) => i.status === 'Uploaded').length;
  const progressPercent = totalCount > 0
    ? Math.round(((verifiedCount + uploadedCount * 0.5) / totalCount) * 100)
    : 0;

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadModalItem || !selectedFile) return;
    if (selectedFile.size > 5 * 1024 * 1024) {
      setFeedbackToast('Files must be 5 MB or smaller.');
      return;
    }

    const fileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(selectedFile);
    });
    const result = await addChecklistDocument(uploadModalItem.id, {
      name: selectedFile.name,
      fileData,
      mimeType: selectedFile.type || 'application/octet-stream',
      fileSizeBytes: selectedFile.size,
    });
    if (!result.success) {
      setFeedbackToast(result.error || 'Could not update this checklist item.');
      return;
    }

    setFeedbackToast(`Document recorded for ${uploadModalItem.title}. Verification is pending.`);
    setUploadModalItem(null);
    setSelectedFile(null);
    setTimeout(() => setFeedbackToast(''), 4000);
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '40px 20px 80px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Navigation Return Button */}
        <Link
          to="/portal"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#214ECF',
            fontWeight: 700,
            fontSize: '0.9rem',
            textDecoration: 'none',
            marginBottom: '24px',
          }}
        >
          <ArrowLeft size={16} /> Return to Customer Portal
        </Link>

        {/* Header Hero */}
        <div style={{ background: 'linear-gradient(135deg, #17348F 0%, #214ECF 100%)', color: '#FFFFFF', padding: '36px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(33,78,207,0.15)', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <span style={{ background: 'rgba(255,255,255,0.15)', color: '#17E7C0', fontSize: '0.78rem', fontWeight: 800, padding: '4px 12px', borderRadius: '9999px', letterSpacing: '0.08em' }}>
                ONBOARDING CHECKLIST
              </span>
              <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 900, marginTop: '10px', marginBottom: '8px' }}>
                Let's get your business compliant.
              </h1>
              <p style={{ color: '#E2E8F0', fontSize: '1rem', maxWidth: '600px' }}>
                Upload your company documents, previous financial records, and payroll details to initiate statutory filing setup.
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'center', minWidth: '180px' }}>
              <div style={{ fontSize: '0.8rem', color: '#93C5FD', fontWeight: 700 }}>COMPLIANCE PROGRESS</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#17E7C0', margin: '4px 0' }}>{progressPercent}%</div>
              <div style={{ fontSize: '0.75rem', color: '#E2E8F0' }}>{verifiedCount} Verified · {totalCount} Items</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', marginTop: '24px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: '#17E7C0', borderRadius: '4px', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Feedback Toast */}
        {feedbackToast && (
          <div style={{ background: 'rgba(27,158,90,0.12)', border: '1px solid #1B9E5A', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', color: '#1B9E5A', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} /> {feedbackToast}
          </div>
        )}

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: activeCategory === cat ? '2px solid #214ECF' : '1px solid #CBD5E1',
                background: activeCategory === cat ? '#214ECF' : '#FFFFFF',
                color: activeCategory === cat ? '#FFFFFF' : '#475569',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Checklist Cards Container */}
        <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '28px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredItems.map((item) => {
              const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.Pending;

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#F8FAFC',
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0',
                    padding: '20px',
                    display: 'flex',
                    justify: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', background: '#E0E7FF', color: '#214ECF', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                        {item.category}
                      </span>
                      <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}40`, fontSize: '0.75rem', fontWeight: 800, padding: '2px 10px', borderRadius: '9999px' }}>
                        {cfg.label}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '4px', margin: 0 }}>
                      {item.note}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    {item.status !== 'Verified' && (
                      <button
                        onClick={() => setUploadModalItem(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#214ECF',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Upload size={14} /> Upload File
                      </button>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upload Modal */}
        {uploadModalItem && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '32px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#214ECF', marginBottom: '12px' }}>
                <Upload size={22} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Upload Document</h3>
              </div>

              <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
                Item: <strong>{uploadModalItem.title}</strong> ({uploadModalItem.category})
              </p>

              <form onSubmit={handleUpload}>
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="modal-filename-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Document File Name
                  </label>
                  <input
                    id="modal-filename-input"
                    required
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setUploadModalItem(null)}
                    style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#214ECF', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Submit Document →
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

export default CustomerOnboardingChecklistPage;
