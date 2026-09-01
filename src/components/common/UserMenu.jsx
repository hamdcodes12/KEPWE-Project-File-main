import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';

/**
 * Reusable authenticated user menu (avatar + dropdown).
 * Shows the user's initials as an avatar. Clicking opens a dropdown with
 * name/email, Profile, Settings, and Logout.
 *
 * Logout clears the session/tokens via AppContext.logout() and navigates
 * to /login. Used in both the marketing Header and the /app/* top nav.
 */
const UserMenu = ({ dark = false }) => {
  const { authState, logout } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const user = authState?.user;
  const name = user?.name || 'User';
  const email = user?.email || '';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  const baseText = dark ? '#E2E8F0' : '#111827';
  const subText = dark ? '#94A3B8' : '#64748B';
  const hoverBg = dark ? 'rgba(148, 163, 184, 0.12)' : '#F1F5F9';

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '10px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #214ECF, #14B8A6)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.85rem',
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}
        >
          {initials}
        </span>
        <ChevronDown
          size={15}
          color={subText}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            minWidth: '240px',
            background: dark ? '#0B111C' : '#FFFFFF',
            border: dark ? '1px solid #2A3350' : '1px solid #E4E7EC',
            borderRadius: '14px',
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.16)',
            padding: '8px',
            zIndex: 2000,
          }}
        >
          {/* User identity */}
          <div style={{ padding: '10px 12px', borderBottom: dark ? '1px solid #2A3350' : '1px solid #E4E7EC', marginBottom: '6px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: baseText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            <div style={{ fontSize: '0.78rem', color: subText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
              {email}
            </div>
          </div>

          {/* Menu items */}
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              color: baseText,
              fontSize: '0.86rem',
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <User size={16} color={subText} /> Profile
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              color: baseText,
              fontSize: '0.86rem',
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Settings size={16} color={subText} /> Settings
          </Link>

          <div style={{ borderTop: dark ? '1px solid #2A3350' : '1px solid #E4E7EC', margin: '6px 0' }} />

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'none',
              border: 'none',
              color: '#EF4444',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;