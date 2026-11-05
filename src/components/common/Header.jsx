import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import UserMenu from './UserMenu';
import './Header.css';

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Platform', to: '/#how-it-works' },
  { label: 'Brokers', to: '/#brokers' },
  { label: 'Kepwe Learn', to: '/learn' },
  { label: 'Pricing', to: '/#pricing' },
];

export default function Header() {
  const { authState } = useApp();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 8);
  const mobileMenuButtonRef = useRef(null);
  const mobileDrawerRef = useRef(null);
  const demoLink = '/signup?product=quant&demo=24h';

  useEffect(() => setMobileMenuOpen(false), [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const updateScrolledState = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', updateScrolledState, { passive: true });
    updateScrolledState();
    return () => window.removeEventListener('scroll', updateScrolledState);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const getFocusableItems = () => mobileDrawerRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || [];

    getFocusableItems()[0]?.focus({ preventScroll: true });

    const handleMenuKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusableItems = getFocusableItems();
      if (!focusableItems.length) return;

      const firstItem = focusableItems[0];
      const lastItem = focusableItems[focusableItems.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', handleMenuKeyDown);
    return () => {
      document.removeEventListener('keydown', handleMenuKeyDown);
      mobileMenuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [mobileMenuOpen]);

  const isNavItemActive = (item) => {
    if (item.to === '/') return location.pathname === '/' && !location.hash;
    if (item.to === '/learn') return location.pathname === '/learn' || location.pathname.startsWith('/learn/');
    return location.pathname === '/' && location.hash === item.to.slice(1);
  };

  return (
    <header className={`site-header light-glass-header ${scrolled ? 'scrolled' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="main-header-bar">
        <Link to="/" className="brand-logo-link quant-brand" aria-label="KEPWE QUANT Home">
          <span className="quant-brand-mark" aria-hidden="true">K</span>
          <span className="brand-name">KEPWE <strong>QUANT</strong></span>
        </Link>

        <nav className="desktop-nav-links quant-main-nav" aria-label="Main Navigation">
          {navItems.map((item) => {
            const active = isNavItemActive(item);
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`nav-link ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="header-actions-group quant-header-actions">
          {authState?.isLoggedIn ? <UserMenu /> : <>
            <Link to="/login?product=quant" className="nav-link desktop-only-action">Login</Link>
            <Link to={demoLink} className="btn-primary-cta quant-demo-cta"><span>Start Free Demo</span><ArrowRight size={15} /></Link>
          </>}
          <button ref={mobileMenuButtonRef} type="button" className="mobile-menu-btn" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} aria-controls="quant-mobile-navigation">
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && <>
        <button type="button" className="mobile-nav-backdrop" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} />
        <div id="quant-mobile-navigation" ref={mobileDrawerRef} className="mobile-nav-drawer" role="dialog" aria-modal="true" aria-label="Mobile menu">
          <nav className="mobile-drawer-content" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const active = isNavItemActive(item);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`mobile-single-link ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link to="/login?product=quant" className="mobile-login-btn">Login</Link>
            <Link to={demoLink} className="mobile-signup-btn">Start Free Demo <ArrowRight size={16} /></Link>
          </nav>
        </div>
      </>}
    </header>
  );
}
