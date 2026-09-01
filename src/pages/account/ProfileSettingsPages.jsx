import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User, Mail, Shield, CheckCircle2, Save, Lock, Bell, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

// ────────────────────────────────────────────────────────────────
// PROFILE PAGE
// ────────────────────────────────────────────────────────────────
export const ProfilePage = () => {
  const { authState } = useApp();
  const user = authState?.user;

  const name = user?.name || 'User';
  const email = user?.email || '';
  const plan = user?.plan || 'Free Trial';
  const role = user?.role || 'user';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';

  return (
    <div style={{
      backgroundColor: '#F5F8FC',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.035), transparent 45%)',
      color: '#172033',
      minHeight: '100vh',
      padding: '32px 40px 60px',
      fontFamily: 'var(--font-ui)'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#14B8A6' }} />
            <span style={{ fontSize: '12px', color: '#0F9F8F', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ACCOUNT
            </span>
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: '1.15', color: '#172033', margin: 0 }}>
            Your Profile
          </h1>
        </div>

        {/* Identity Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)',
          padding: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
          marginBottom: '24px'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #214ECF, #14B8A6)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.6rem',
            letterSpacing: '0.02em',
            flexShrink: 0
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#172033' }}>{name}</div>
            <div style={{ fontSize: '0.9rem', color: '#64748B', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} /> {email}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.25)', color: '#0F9F8F', borderRadius: '6px', fontSize: '11px', fontWeight: 700, padding: '4px 10px' }}>
                {plan}
              </span>
              <span style={{ background: 'rgba(33, 78, 207, 0.08)', border: '1px solid rgba(33, 78, 207, 0.2)', color: '#214ECF', borderRadius: '6px', fontSize: '11px', fontWeight: 700, padding: '4px 10px', textTransform: 'capitalize' }}>
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)', padding: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F9F8F', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '16px' }}>
            ACCOUNT DETAILS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Full Name', value: name, icon: <User size={15} color="#64748B" /> },
              { label: 'Email Address', value: email, icon: <Mail size={15} color="#64748B" /> },
              { label: 'Plan', value: plan, icon: <Shield size={15} color="#64748B" /> },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', flexShrink: 0 }}>
                  {row.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>{row.label}</div>
                  <div style={{ fontSize: '14px', color: '#172033', fontWeight: 700 }}>{row.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ────────────────────────────────────────────────────────────────
export const SettingsPage = () => {
  const { authState, logout, alertsConfig, setAlertsConfig, saveAlertsConfig } = useApp();
  const navigate = useNavigate();
  const user = authState?.user;
  const name = user?.name || 'User';
  const email = user?.email || '';

  const [saved, setSaved] = useState(false);
  const [displayName, setDisplayName] = useState(name);

  const handleSave = async () => {
    const result = await saveAlertsConfig();
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleChannel = (ch) => setAlertsConfig((p) => ({ ...p, channels: { ...p.channels, [ch]: !p.channels[ch] } }));

  return (
    <div style={{
      backgroundColor: '#F5F8FC',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.035), transparent 45%)',
      color: '#172033',
      minHeight: '100vh',
      padding: '32px 40px 60px',
      fontFamily: 'var(--font-ui)'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#14B8A6' }} />
            <span style={{ fontSize: '12px', color: '#0F9F8F', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ACCOUNT
            </span>
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: '1.15', color: '#172033', margin: 0 }}>
            Settings
          </h1>
        </div>

        {saved && (
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10B981', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#10B981', fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#10B981" />
            Settings saved successfully.
          </div>
        )}

        {/* Profile Settings */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F9F8F', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={15} /> PROFILE
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                Display Name
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', color: '#172033', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                value={email}
                disabled
                style={{ width: '100%', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', color: '#94A3B8', fontSize: '13px', outline: 'none', boxSizing: 'border-box', cursor: 'not-allowed' }}
              />
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Email cannot be changed.</div>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F9F8F', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={15} /> NOTIFICATION CHANNELS
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { key: 'push', label: 'Push Notifications', desc: 'In-app and browser push alerts' },
              { key: 'email', label: 'Email Notifications', desc: 'Send alerts to your email address' },
              { key: 'sms', label: 'SMS Notifications', desc: 'Text message alerts (charges may apply)' },
            ].map((ch) => (
              <div key={ch.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#172033' }}>{ch.label}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{ch.desc}</div>
                </div>
                <button
                  onClick={() => toggleChannel(ch.key)}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: alertsConfig.channels[ch.key] ? '#14B8A6' : '#CBD5E1',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    flexShrink: 0
                  }}
                  aria-label={`Toggle ${ch.label}`}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: alertsConfig.channels[ch.key] ? '23px' : '3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '16px', padding: '10px 22px', borderRadius: '8px', background: '#14B8A6', color: '#062B27', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(20, 184, 166, 0.2)' }}
          >
            <Save size={15} /> Save Settings
          </button>
        </div>

        {/* Security / Session */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F9F8F', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={15} /> SECURITY & SESSION
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#172033' }}>Sign Out</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>End your current session and return to the login page.</div>
              </div>
              <button
                onClick={handleLogout}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#EF4444', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/profile" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#172033', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}>
            View Profile <ChevronRight size={14} />
          </Link>
          <Link to="/app/account" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#172033', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}>
            IndexPilot Account <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};