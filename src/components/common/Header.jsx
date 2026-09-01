import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { 
  Building2, 
  Activity, 
  TrendingUp, 
  BookOpen, 
  CreditCard, 
  Layers,
  Menu, 
  X, 
  ArrowRight, 
  ChevronDown, 
  ChevronRight, 
  MoreVertical
} from 'lucide-react';
import kepweLogo from '../../assets/kepwe-logo.png';
import UserMenu from './UserMenu';
import './Header.css';

const Header = () => {
  const { authState } = useApp();
  const isLoggedIn = authState?.isLoggedIn;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState(null);
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false);
  const [solutionsDropdownOpen, setSolutionsDropdownOpen] = useState(false);
  const [resourcesDropdownOpen, setResourcesDropdownOpen] = useState(false);
  const [portalsDropdownOpen, setPortalsDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isPastHero, setIsPastHero] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const headerRef = useRef(null);

  const toggleMobileSection = (sectionKey) => {
    setMobileExpandedSection((prev) => (prev === sectionKey ? null : sectionKey));
  };

  const closeAllDropdowns = () => {
    setProductsDropdownOpen(false);
    setSolutionsDropdownOpen(false);
    setResourcesDropdownOpen(false);
    setPortalsDropdownOpen(false);
  };

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        closeAllDropdowns();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAllDropdowns();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      setScrolled(scrollPos > 15);
      // Check if user has scrolled past the full-screen hero section
      if (isHomePage) {
        setIsPastHero(scrollPos > window.innerHeight * 0.85);
      } else {
        setIsPastHero(true);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  // Close mobile drawer and dropdowns on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileExpandedSection(null);
    closeAllDropdowns();
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setProductsDropdownOpen(false);
        setSolutionsDropdownOpen(false);
        setResourcesDropdownOpen(false);
        setPortalsDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isDarkHeader = isHomePage && !isPastHero;

  return (
    <header ref={headerRef} className={`site-header ${isDarkHeader ? 'dark-glass-header' : 'light-glass-header'} ${scrolled ? 'scrolled' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      
      {/* Main Navigation Bar */}
      <div className="main-header-bar">
        
        {/* Brand Logo Identity */}
        <Link to="/" className="brand-logo-link" aria-label="KEPWE Home">
          <img
            src={kepweLogo}
            alt="Kepwe Logo"
            className="kepwe-logo-img"
          />
          <span className="brand-name">Kepwe</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="desktop-nav-links" aria-label="Main Navigation">
          
          {/* Products Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setProductsDropdownOpen(!productsDropdownOpen);
                setSolutionsDropdownOpen(false);
                setResourcesDropdownOpen(false);
                setPortalsDropdownOpen(false);
              }}
              aria-expanded={productsDropdownOpen}
              className="nav-dropdown-btn"
            >
              <span>Products</span>
              <ChevronDown size={14} style={{ transform: productsDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {productsDropdownOpen && (
              <div className="header-dropdown-menu">
                <Link to="/credit" onClick={() => setProductsDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">
                    <span className="dropdown-item-dot" style={{ backgroundColor: '#214ECF' }} /> Kepwe Credit
                  </span>
                  <span className="dropdown-item-desc">Personal & business loan solutions</span>
                </Link>
                <Link to="/ledger" onClick={() => setProductsDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">
                    <span className="dropdown-item-dot" style={{ backgroundColor: '#2563EB' }} /> Kepwe Ledger
                  </span>
                  <span className="dropdown-item-desc">Business finance, GST & accounting</span>
                </Link>
                <Link to="/indexpilot" onClick={() => setProductsDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">
                    <span className="dropdown-item-dot" style={{ backgroundColor: '#0284C7' }} /> IndexPilot
                  </span>
                  <span className="dropdown-item-desc">Trading & market intelligence</span>
                </Link>
                <Link to="/quant" onClick={() => setProductsDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">
                    <span className="dropdown-item-dot" style={{ backgroundColor: '#0D9488' }} /> KEPWE QUANT
                  </span>
                  <span className="dropdown-item-desc">Systematic trading workspace</span>
                </Link>
              </div>
            )}
          </div>

          {/* Solutions Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setSolutionsDropdownOpen(!solutionsDropdownOpen);
                setProductsDropdownOpen(false);
                setResourcesDropdownOpen(false);
                setPortalsDropdownOpen(false);
              }}
              aria-expanded={solutionsDropdownOpen}
              className="nav-dropdown-btn"
            >
              <span>Solutions</span>
              <ChevronDown size={14} style={{ transform: solutionsDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {solutionsDropdownOpen && (
              <div className="header-dropdown-menu">
                <Link to="/gst" onClick={() => setSolutionsDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">GST & Tax Services</span>
                  <span className="dropdown-item-desc">Automated filing & reconciliation</span>
                </Link>
                <Link to="/virtual-cfo" onClick={() => setSolutionsDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">Virtual CFO Advisory</span>
                  <span className="dropdown-item-desc">Strategic planning & cash runway</span>
                </Link>
                <Link to="/new-company" onClick={() => setSolutionsDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">New Company Incorporation</span>
                  <span className="dropdown-item-desc">Fast-track MCA registration</span>
                </Link>
                <Link to="/solutions/accounting" onClick={() => setSolutionsDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">Accounting & Bookkeeping</span>
                  <span className="dropdown-item-desc">Double-entry ledgers & MIS</span>
                </Link>
              </div>
            )}
          </div>

          {/* Resources Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setResourcesDropdownOpen(!resourcesDropdownOpen);
                setProductsDropdownOpen(false);
                setSolutionsDropdownOpen(false);
                setPortalsDropdownOpen(false);
              }}
              aria-expanded={resourcesDropdownOpen}
              className="nav-dropdown-btn"
            >
              <span>Resources</span>
              <ChevronDown size={14} style={{ transform: resourcesDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {resourcesDropdownOpen && (
              <div className="header-dropdown-menu">
                <Link to="/resources/calendar" onClick={() => setResourcesDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">Compliance Calendar</span>
                  <span className="dropdown-item-desc">Statutory filing dates & cutoffs</span>
                </Link>
                <Link to="/resources/calculators" onClick={() => setResourcesDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">Financial Calculators</span>
                  <span className="dropdown-item-desc">EMI, GST, and tax estimators</span>
                </Link>
                <Link to="/resources/business-guides" onClick={() => setResourcesDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">Business Guides</span>
                  <span className="dropdown-item-desc">Startup compliance playbooks</span>
                </Link>
                <Link to="/resources/gst-guides" onClick={() => setResourcesDropdownOpen(false)} className="dropdown-item-link">
                  <span className="dropdown-item-title">GST & Tax Guides</span>
                  <span className="dropdown-item-desc">Filing instructions & FAQ</span>
                </Link>
              </div>
            )}
          </div>

          <Link to="/about" className="nav-link">About</Link>
        </nav>

        {/* Right Actions: Portals Dropdown, Login, Get Started */}
        <div className="header-actions-group">
          
          {/* Portals Dropdown (All Workspaces with direct access) */}
          <div style={{ position: 'relative' }} className="hide-mobile">
            <button
              onClick={() => {
                setPortalsDropdownOpen(!portalsDropdownOpen);
                setProductsDropdownOpen(false);
                setSolutionsDropdownOpen(false);
                setResourcesDropdownOpen(false);
              }}
              aria-expanded={portalsDropdownOpen}
              className="portals-btn"
            >
              <span>Portals</span>
              <ChevronDown size={13} style={{ transform: portalsDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {portalsDropdownOpen && (
              <div className="portals-dropdown-menu">
                <Link to="/portal" onClick={() => setPortalsDropdownOpen(false)} className="portals-dropdown-item" style={{ color: '#214ECF' }}>
                  <Building2 size={16} />
                  <span>Customer Portal</span>
                </Link>
                <Link to="/crm" onClick={() => setPortalsDropdownOpen(false)} className="portals-dropdown-item" style={{ color: '#059669' }}>
                  <Activity size={16} />
                  <span>Sales CRM</span>
                </Link>
                <Link to="/indexpilot" onClick={() => setPortalsDropdownOpen(false)} className="portals-dropdown-item" style={{ color: '#0284C7' }}>
                  <TrendingUp size={16} />
                  <span>IndexPilot</span>
                </Link>
                <Link to="/portal" onClick={() => setPortalsDropdownOpen(false)} className="portals-dropdown-item" style={{ color: '#2563EB' }}>
                  <BookOpen size={16} />
                  <span>Ledger Workspace</span>
                </Link>
                <Link to="/credit" onClick={() => setPortalsDropdownOpen(false)} className="portals-dropdown-item" style={{ color: '#4F46E5' }}>
                  <CreditCard size={16} />
                  <span>Kepwe Credit</span>
                </Link>
                <Link to="/quant/dashboard" onClick={() => setPortalsDropdownOpen(false)} className="portals-dropdown-item" style={{ color: '#0D9488' }}>
                  <Layers size={16} />
                  <span>Quant Workspace</span>
                </Link>
              </div>
            )}
          </div>

          {isLoggedIn ? (
            <UserMenu />
          ) : (
            <>
              <Link to="/login" className="nav-link desktop-only-action">
                Login
              </Link>
              <Link to="/signup" className="btn-primary-cta">
                <span>Get Started</span>
                <ArrowRight size={15} />
              </Link>
            </>
          )}

          {/* Mobile Menu Trigger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="mobile-menu-btn"
          >
            {mobileMenuOpen ? (
              <X size={26} />
            ) : (
              <Menu size={26} />
            )}
          </button>
        </div>

      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer" role="dialog" aria-label="Mobile menu">
          
          <div className="mobile-drawer-content">
            
            {/* Products Group */}
            <div className="mobile-drawer-group">
              <button
                type="button"
                className="mobile-group-trigger"
                onClick={() => toggleMobileSection('products')}
              >
                <span>Products</span>
                <ChevronDown size={18} className={`mobile-chevron ${mobileExpandedSection === 'products' ? 'rotate-180' : ''}`} />
              </button>
              {mobileExpandedSection === 'products' && (
                <div className="mobile-drawer-sublinks">
                  <Link to="/credit" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">
                    <span className="mobile-sub-dot" style={{ backgroundColor: '#214ECF' }} /> Kepwe Credit
                  </Link>
                  <Link to="/ledger" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">
                    <span className="mobile-sub-dot" style={{ backgroundColor: '#2563EB' }} /> Kepwe Ledger
                  </Link>
                  <Link to="/indexpilot" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">
                    <span className="mobile-sub-dot" style={{ backgroundColor: '#0284C7' }} /> IndexPilot
                  </Link>
                  <Link to="/quant" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">
                    <span className="mobile-sub-dot" style={{ backgroundColor: '#0D9488' }} /> KEPWE QUANT
                  </Link>
                </div>
              )}
            </div>

            {/* Solutions Group */}
            <div className="mobile-drawer-group">
              <button
                type="button"
                className="mobile-group-trigger"
                onClick={() => toggleMobileSection('solutions')}
              >
                <span>Solutions</span>
                <ChevronDown size={18} className={`mobile-chevron ${mobileExpandedSection === 'solutions' ? 'rotate-180' : ''}`} />
              </button>
              {mobileExpandedSection === 'solutions' && (
                <div className="mobile-drawer-sublinks">
                  <Link to="/gst" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">GST & Tax Services</Link>
                  <Link to="/virtual-cfo" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">Virtual CFO Advisory</Link>
                  <Link to="/new-company" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">New Company Incorporation</Link>
                  <Link to="/solutions/accounting" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">Accounting & Bookkeeping</Link>
                </div>
              )}
            </div>

            {/* Resources Group */}
            <div className="mobile-drawer-group">
              <button
                type="button"
                className="mobile-group-trigger"
                onClick={() => toggleMobileSection('resources')}
              >
                <span>Resources</span>
                <ChevronDown size={18} className={`mobile-chevron ${mobileExpandedSection === 'resources' ? 'rotate-180' : ''}`} />
              </button>
              {mobileExpandedSection === 'resources' && (
                <div className="mobile-drawer-sublinks">
                  <Link to="/resources/calendar" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">Compliance Calendar</Link>
                  <Link to="/resources/calculators" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">Financial Calculators</Link>
                  <Link to="/resources/business-guides" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">Startup Guides</Link>
                  <Link to="/resources/gst-guides" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link">GST Guides</Link>
                </div>
              )}
            </div>

            {/* Portals Group (All connected workspaces) */}
            <div className="mobile-drawer-group">
              <button
                type="button"
                className="mobile-group-trigger"
                onClick={() => toggleMobileSection('portals')}
              >
                <span>Portals & Workspaces</span>
                <ChevronDown size={18} className={`mobile-chevron ${mobileExpandedSection === 'portals' ? 'rotate-180' : ''}`} />
              </button>
              {mobileExpandedSection === 'portals' && (
                <div className="mobile-drawer-sublinks">
                  <Link to="/portal" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link" style={{ color: '#214ECF', fontWeight: 600 }}>
                    <Building2 size={16} style={{ display: 'inline', marginRight: '6px' }} /> Customer Portal
                  </Link>
                  <Link to="/crm" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link" style={{ color: '#059669', fontWeight: 600 }}>
                    <Activity size={16} style={{ display: 'inline', marginRight: '6px' }} /> Sales CRM
                  </Link>
                  <Link to="/indexpilot" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link" style={{ color: '#0284C7', fontWeight: 600 }}>
                    <TrendingUp size={16} style={{ display: 'inline', marginRight: '6px' }} /> IndexPilot
                  </Link>
                  <Link to="/portal" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link" style={{ color: '#2563EB', fontWeight: 600 }}>
                    <BookOpen size={16} style={{ display: 'inline', marginRight: '6px' }} /> Ledger Workspace
                  </Link>
                  <Link to="/credit" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link" style={{ color: '#4F46E5', fontWeight: 600 }}>
                    <CreditCard size={16} style={{ display: 'inline', marginRight: '6px' }} /> Kepwe Credit
                  </Link>
                  <Link to="/quant/dashboard" onClick={() => setMobileMenuOpen(false)} className="mobile-sub-link" style={{ color: '#0D9488', fontWeight: 600 }}>
                    <Layers size={16} style={{ display: 'inline', marginRight: '6px' }} /> Quant Workspace
                  </Link>
                </div>
              )}
            </div>

            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="mobile-single-link">About</Link>
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="mobile-single-link">Contact Us</Link>

            {/* Bottom Actions */}
            <div className="mobile-drawer-actions">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="mobile-login-btn">Login</Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="mobile-signup-btn">
                <span>Get Started</span>
                <ArrowRight size={16} />
              </Link>
            </div>

          </div>

        </div>
      )}

    </header>
  );
};

export default Header;
