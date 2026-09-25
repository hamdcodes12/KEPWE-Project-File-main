import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Calendar, CheckCircle2, Clock, AlertTriangle, ArrowRight, Filter, Info, X, Layers, RefreshCw, ChevronDown, Check } from 'lucide-react';
import './ComplianceCalendarPage.css';

const STATUS_BADGES = {
  Completed: { bg: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: 'rgba(16, 185, 129, 0.25)' },
  'In Progress': { bg: 'rgba(217, 119, 6, 0.1)', color: '#D97706', border: 'rgba(217, 119, 6, 0.25)' },
  Upcoming: { bg: 'rgba(33, 78, 207, 0.08)', color: '#214ECF', border: 'rgba(33, 78, 207, 0.2)' },
  'Action Required': { bg: 'rgba(220, 38, 38, 0.1)', color: '#DC2626', border: 'rgba(220, 38, 38, 0.25)' },
};

const CustomSelect = ({ label, value, options, onChange, isOpen, onToggle, onClose }) => {
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div className="cal-select-group" ref={selectRef}>
      <span className="cal-select-label">{label}:</span>
      <div className="cal-select-wrapper">
        <button
          type="button"
          className={`cal-select-trigger ${isOpen ? 'is-open' : ''}`}
          onClick={onToggle}
          aria-expanded={isOpen}
        >
          <span className="cal-select-value">{value}</span>
          <ChevronDown size={15} className={`cal-select-chevron ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="cal-dropdown-menu" role="listbox">
            {options.map((opt) => (
              <div
                key={opt}
                role="option"
                aria-selected={opt === value}
                className={`cal-dropdown-option ${opt === value ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(opt);
                  onClose();
                }}
              >
                <span>{opt}</span>
                {opt === value && <Check size={14} className="cal-option-check" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ComplianceCalendarPage = () => {
  const { customerTasks, refreshPortal, authState } = useApp();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorState, setShowErrorState] = useState(false);

  useEffect(() => {
    if (authState.isLoggedIn) refreshPortal();
  }, [authState.isLoggedIn, refreshPortal]);

  const tasks = customerTasks;

  const categories = ['All', 'GST', 'TDS', 'MCA', 'Payroll'];
  const statuses = ['All', 'Upcoming', 'In Progress', 'Completed', 'Action Required'];

  const filteredTasks = tasks.filter((t) => {
    const catMatch = selectedCategory === 'All' || t.category === selectedCategory;
    const statMatch = selectedStatus === 'All' || t.status === selectedStatus;
    return catMatch && statMatch;
  });

  const handleSimulateRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 600);
  };

  return (
    <div className="cal-page-container">
      <div className="cal-content-wrapper">
        {/* Header */}
        <div className="cal-header-block">
          <span className="cal-badge">
            STATUTORY DEADLINES · AUGUST 2026
          </span>
          <h1 className="cal-main-title">
            Official Compliance & Tax Calendar
          </h1>
          <p className="cal-subtitle">
            Never miss a GST, TDS, MCA or Payroll deadline. Desktop grid and mobile responsive list.
          </p>
        </div>

        {/* Filters & State Controls Bar */}
        <div className="cal-filter-card">
          <div className="cal-filter-left">
            {/* Category Custom Select */}
            <CustomSelect
              label="Category"
              value={selectedCategory}
              options={categories}
              onChange={setSelectedCategory}
              isOpen={categoryOpen}
              onToggle={() => {
                setCategoryOpen(!categoryOpen);
                setStatusOpen(false);
              }}
              onClose={() => setCategoryOpen(false)}
            />

            {/* Status Custom Select */}
            <CustomSelect
              label="Status"
              value={selectedStatus}
              options={statuses}
              onChange={setSelectedStatus}
              isOpen={statusOpen}
              onToggle={() => {
                setStatusOpen(!statusOpen);
                setCategoryOpen(false);
              }}
              onClose={() => setStatusOpen(false)}
            />
          </div>

          {/* Controls for Refresh / Error simulation */}
          <div className="cal-filter-right">
            <button
              type="button"
              onClick={handleSimulateRefresh}
              className="cal-btn-secondary"
            >
              <RefreshCw size={14} color="#214ECF" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowErrorState(!showErrorState)}
              className={`cal-btn-utility ${showErrorState ? 'is-error-active' : ''}`}
            >
              {showErrorState ? 'Clear Error' : 'Test Error State'}
            </button>
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="cal-loading-card">
            <RefreshCw size={28} color="#214ECF" className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <div className="cal-loading-title">Updating statutory schedule...</div>
          </div>
        )}

        {/* ERROR STATE */}
        {showErrorState && (
          <div className="cal-error-card">
            <div className="cal-error-header">
              <AlertTriangle size={20} /> Unable to sync live GST portal schedule
            </div>
            <p className="cal-error-desc">
              The GSTN API portal is currently experiencing high latency. Displaying last cached statutory filing schedule.
            </p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isLoading && !showErrorState && filteredTasks.length === 0 && (
          <div className="cal-empty-card">
            <Info size={32} className="cal-empty-icon" />
            <h3 className="cal-empty-title">No compliance tasks found</h3>
            <p className="cal-empty-desc">Try resetting your category or status filter selections.</p>
          </div>
        )}

        {/* MAIN TASK CONTENT */}
        {!isLoading && !showErrorState && filteredTasks.length > 0 && (
          <div className="cal-tasks-container">
            <h2 className="cal-tasks-header">
              <Calendar size={22} color="#214ECF" /> August 2026 Statutory Compliance Schedule
            </h2>

            {/* Tasks List */}
            <div className="cal-tasks-list">
              {filteredTasks.map((task) => {
                const badge = STATUS_BADGES[task.status] || STATUS_BADGES.Upcoming;

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskDetail(task)}
                    className="cal-task-card"
                  >
                    <div className="cal-task-info">
                      <div className="cal-task-meta">
                        <span className="cal-category-badge">
                          {task.category}
                        </span>
                        <span className="cal-form-label">
                          Filing Form: <strong>{task.title.split(' ')[0]}</strong>
                        </span>
                      </div>
                      <h3 className="cal-task-title">
                        {task.title}
                      </h3>
                      <span className="cal-deadline-text">
                        Statutory Deadline: <strong style={{ color: '#0F172A' }}>{task.dueDate}</strong>
                      </span>
                    </div>

                    <div className="cal-task-right">
                      <span
                        className="cal-status-pill"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {task.status}
                      </span>
                      <span className="cal-view-link">
                        View Details →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TASK DETAIL MODAL */}
        {selectedTaskDetail && (
          <div className="cal-modal-backdrop" onClick={() => setSelectedTaskDetail(null)}>
            <div className="cal-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="cal-modal-top">
                <span className="cal-category-badge" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                  {selectedTaskDetail.category} COMPLIANCE
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTaskDetail(null)}
                  className="cal-modal-close-btn"
                  aria-label="Close details"
                >
                  <X size={18} />
                </button>
              </div>

              <h3 className="cal-modal-title">
                {selectedTaskDetail.title}
              </h3>

              <div className="cal-modal-info-grid">
                <div>
                  <span className="cal-modal-label">DUE DATE</span>
                  <div className="cal-modal-val">{selectedTaskDetail.dueDate}</div>
                </div>
                <div>
                  <span className="cal-modal-label">STATUS</span>
                  <div className="cal-modal-val" style={{ color: STATUS_BADGES[selectedTaskDetail.status]?.color || '#214ECF' }}>
                    {selectedTaskDetail.status}
                  </div>
                </div>
              </div>

              <p className="cal-modal-desc">
                Statutory requirement under Indian tax law. Timely submission prevents interest penalties under Section 50 and late fees under Section 47.
              </p>

              <div className="cal-modal-actions">
                <button
                  type="button"
                  onClick={() => setSelectedTaskDetail(null)}
                  className="cal-modal-btn-close"
                >
                  Close
                </button>
                <a
                  href="/free-compliance-check"
                  className="cal-modal-btn-primary"
                >
                  Assign to Kepwe CA →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Primary CTA Card */}
        <div className="cal-bottom-cta">
          <h3 className="cal-cta-title">Want us to manage all your monthly compliance?</h3>
          <p className="cal-cta-subtitle">Get dedicated GST & accounting support starting at ₹1,499/month.</p>
          <a href="/free-compliance-check" className="cal-cta-btn">
            <span>Get Free Compliance Check</span>
            <ArrowRight size={18} className="cal-cta-arrow" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default ComplianceCalendarPage;
