import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import UserMenu from '../common/UserMenu';
import {
  LayoutDashboard, Link2, Settings2, Shield, BookOpen, Bell, FileText, User, LogOut, MoreVertical, X, Home
} from 'lucide-react';
import indexLogo from '../../assets/IndexMainLogo.png';
import './AppNav.css';

const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Pulse', icon: <LayoutDashboard size={16} /> },
  { to: '/app/chain', label: 'Chain', icon: <Link2 size={16} /> },
  { to: '/app/setups', label: 'Strategy', icon: <Settings2 size={16} /> },
  { to: '/app/shield', label: 'Shield', icon: <Shield size={16} /> },
  { to: '/app/desk', label: 'Desk', icon: <BookOpen size={16} /> },
];

const SECONDARY_ITEMS = [
  { to: '/app/alerts', label: 'Alerts', icon: <Bell size={15} /> },
  { to: '/app/reports', label: 'Reports', icon: <FileText size={15} /> },
  { to: '/app/account', label: 'Account', icon: <User size={15} /> },
];

/**
 * Desktop Left Rail Navigation for IndexPilot /app/* routes
 * Sticky, background: #0A0E17, Hover & Active: #17E7C0
 */
export const AppLeftRail = () => {
  const { authState, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="app-left-rail">
      {/* Brand Logo Only (Centered) */}
      <div className="app-left-rail-header">
        <NavLink to="/app/dashboard" className="app-left-rail-brand-box" title="IndexPilot">
          <img 
            src={indexLogo} 
            alt="IndexPilot Logo" 
            className="app-left-rail-brand-img"
          />
        </NavLink>
        {authState?.user && (
          <div className="app-left-rail-user">
            Signed in as <strong>{authState.user.name}</strong>
          </div>
        )}
      </div>

      {/* Primary Nav */}
      <div className="app-left-rail-links-container">
        <div className="app-left-rail-section-title">MARKET TOOLS</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `app-left-rail-link ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="app-left-rail-section-title" style={{ marginTop: '16px' }}>SETTINGS</div>
        {SECONDARY_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `app-left-rail-link ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Back to Home & Logout */}
      <div className="app-left-rail-footer">
        <Link
          to="/"
          className="app-left-rail-home-link"
          title="Back to KEPWE Home"
        >
          <Home size={14} /> Back to KEPWE
        </Link>
        <button
          onClick={handleLogout}
          className="app-left-rail-signout"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </nav>
  );
};

/**
 * Top Navigation Bar for IndexPilot /app/* routes
 * Sticky on top, background: #0A0E17, Hover & Active: #17E7C0
 */
export const AppTopNav = () => {
  const { authState, logout } = useApp();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="app-top-nav">
        {/* Premium Mobile Menu Trigger */}
        <button
          type="button"
          className="top-nav-mobile-toggle"
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          aria-label="Open Navigation Menu"
          title="Open Menu"
        >
          <span className="mobile-toggle-dots-cluster">
            <span className="cluster-dot dot-top" />
            <span className="cluster-dot dot-mid" />
            <span className="cluster-dot dot-bot" />
          </span>
          <span className="mobile-toggle-caption">MENU</span>
        </button>

        {/* Brand / Logo Area */}
        <div className="top-nav-brand">
          <div className="top-nav-logo">
            <span className="top-nav-brand-title">IndexPilot</span>
            <span className="top-nav-sublogo">BY KEPWE</span>
          </div>
        </div>

        {/* Primary Navigation Links */}
        <div className="top-nav-links-scroll">
          <nav className="top-nav-links">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `top-nav-item ${isActive ? 'active' : ''}`}
              >
                {({ isActive }) => (
                  <>
                    <span className="top-nav-icon">{item.icon}</span>
                    <span className="top-nav-label">{item.label}</span>
                    {isActive && <div className="top-nav-indicator" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Live Market Status & Secondary Controls */}
        <div className="top-nav-right">
          <div className="top-nav-status">
            <span className="status-dot" />
            <span className="status-text">LIVE FEED</span>
          </div>

          <div className="top-nav-secondary-links">
            {SECONDARY_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) => `top-nav-sec-item ${isActive ? 'active' : ''}`}
              >
                {item.icon}
              </NavLink>
            ))}

            {authState?.isLoggedIn && <UserMenu dark />}
          </div>
        </div>
      </header>

      {/* Mobile Sidebar / Drawer */}
      {mobileDrawerOpen && (
        <>
          <div
            className="app-mobile-overlay"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="app-mobile-drawer">
            <div className="app-mobile-drawer-header">
              <NavLink
                to="/app/dashboard"
                className="app-mobile-drawer-logo-box"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <img
                  src={indexLogo}
                  alt="IndexPilot Logo"
                  className="app-mobile-drawer-logo"
                />
              </NavLink>
              <button
                type="button"
                className="app-mobile-drawer-close"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close Menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="app-mobile-drawer-links">
              <div className="app-mobile-drawer-section">MARKET TOOLS</div>
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={({ isActive }) => `app-mobile-drawer-link ${isActive ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}

              <div className="app-mobile-drawer-section" style={{ marginTop: '18px' }}>SETTINGS</div>
              {SECONDARY_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={({ isActive }) => `app-mobile-drawer-link ${isActive ? 'active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="app-mobile-drawer-footer">
              <Link
                to="/"
                onClick={() => setMobileDrawerOpen(false)}
                className="app-mobile-drawer-home-link"
                title="Back to KEPWE Home"
              >
                <Home size={15} /> Back to KEPWE
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  handleLogout();
                }}
                className="app-mobile-drawer-signout"
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
};

/**
 * Deprecated AppBottomNav fallback.
 */
export const AppBottomNav = () => null;
