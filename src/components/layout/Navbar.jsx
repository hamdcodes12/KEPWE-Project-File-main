import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronDown, 
  ShieldCheck, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  FileText, 
  Briefcase, 
  Calculator, 
  Building2, 
  Award,
  Zap,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  PhoneCall
} from 'lucide-react';
import Button from '../ui/Button';
import './Navbar.css';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMobileSection, setActiveMobileSection] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveMobileSection(null);
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleMobileSubmenu = (section) => {
    setActiveMobileSection(prev => prev === section ? null : section);
  };

  return (
    <>
      <header className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="container navbar-container">
          {/* Logo */}
          <Link to="/" className="navbar-brand">
            <div className="brand-icon">
              <ShieldCheck className="brand-svg" />
            </div>
            <div className="brand-text">
              <span className="brand-name">KEPWE</span>
              <span className="brand-tag">BUSINESS OS</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="navbar-desktop-links">
            <div className="nav-item group">
              <button className="nav-link-btn">
                Solutions <ChevronDown className="chevron-icon" />
              </button>
              <div className="mega-dropdown">
                <div className="dropdown-grid">
                  <Link to="/solutions/compliance" className="dropdown-item">
                    <div className="item-icon blue"><ShieldCheck size={18} /></div>
                    <div>
                      <div className="item-title">Business Compliance</div>
                      <div className="item-desc">MCA, Annual Filings & Secretarial</div>
                    </div>
                  </Link>

                  <Link to="/solutions/accounting" className="dropdown-item">
                    <div className="item-icon green"><FileText size={18} /></div>
                    <div>
                      <div className="item-title">Accounting & Bookkeeping</div>
                      <div className="item-desc">Automated invoicing & Tally sync</div>
                    </div>
                  </Link>

                  <Link to="/solutions/gst" className="dropdown-item">
                    <div className="item-icon purple"><Zap size={18} /></div>
                    <div>
                      <div className="item-title">GST & Tax Filing</div>
                      <div className="item-desc">GSTR-1, 3B & 100% ITC Reconciliation</div>
                    </div>
                  </Link>

                  <Link to="/solutions/payroll" className="dropdown-item">
                    <div className="item-icon orange"><Briefcase size={18} /></div>
                    <div>
                      <div className="item-title">Payroll & HR Management</div>
                      <div className="item-desc">Salary disbursal, PF & ESIC compliance</div>
                    </div>
                  </Link>

                  <Link to="/solutions/cfo" className="dropdown-item">
                    <div className="item-icon cyan"><TrendingUp size={18} /></div>
                    <div>
                      <div className="item-title">Virtual CFO Services</div>
                      <div className="item-desc">Strategic advice, MIS & cash flow</div>
                    </div>
                  </Link>

                  <Link to="/solutions/loans" className="dropdown-item">
                    <div className="item-icon teal"><CreditCard size={18} /></div>
                    <div>
                      <div className="item-title">Business Loans & Credit</div>
                      <div className="item-desc">Collateral-free working capital</div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            <div className="nav-item group">
              <button className="nav-link-btn">
                For Businesses <ChevronDown className="chevron-icon" />
              </button>
              <div className="dropdown simple-dropdown">
                <Link to="/industries/startups">⚡ Startups & Founders</Link>
                <Link to="/industries/small-business">🏢 Small Businesses</Link>
                <Link to="/industries/smes">🏬 SMEs & Enterprises</Link>
                <Link to="/industries/ecommerce">🛒 E-Commerce Sellers</Link>
                <Link to="/industries/traders">📦 Traders & Retailers</Link>
                <Link to="/industries/manufacturing">🏗️ Manufacturers</Link>
                <Link to="/industries/exporters">🌐 Exporters & Import/Export</Link>
              </div>
            </div>

            <Link to="/pricing" className={`nav-link ${location.pathname === '/pricing' ? 'active' : ''}`}>
              Pricing
            </Link>

            <div className="nav-item group">
              <button className="nav-link-btn">
                Resources <ChevronDown className="chevron-icon" />
              </button>
              <div className="dropdown simple-dropdown">
                <Link to="/resources/calendar">📅 Compliance Calendar</Link>
                <Link to="/resources/calculators">🧮 GST & Tax Calculators</Link>
                <Link to="/resources/gst-guides">📖 GST & Tax Guides</Link>
                <Link to="/resources/business-guides">🚀 Startup Growth Guides</Link>
                <Link to="/blog">📝 Industry Blog</Link>
              </div>
            </div>

            <Link to="/about" className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`}>
              About
            </Link>
            
            <Link to="/contact" className={`nav-link ${location.pathname === '/contact' ? 'active' : ''}`}>
              Contact
            </Link>
          </nav>

          {/* Desktop Right Actions */}
          <div className="navbar-actions">
            <button 
              className="theme-toggle" 
              onClick={toggleTheme} 
              aria-label="Toggle dark mode"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <Link to="/login" className="login-btn hide-mobile">
              Login
            </Link>

            <div className="desktop-ctas">
              <Button variant="secondary" onClick={() => navigate('/free-compliance-check')}>
                Free Audit
              </Button>
              <Button variant="primary" onClick={() => navigate('/login')}>
                Get Started
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="mobile-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      <div className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)} />
        <div className="mobile-drawer-content">
          <div className="mobile-drawer-header">
            <div className="brand-text">
              <span className="brand-name">KEPWE Navigation</span>
            </div>
            <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="mobile-nav-list">
            <Link to="/" className="mobile-nav-item">Home</Link>

            {/* Solutions Mobile Accordion */}
            <div className="mobile-accordion">
              <button 
                className="mobile-accordion-trigger"
                onClick={() => toggleMobileSubmenu('solutions')}
              >
                <span>Solutions</span>
                <ChevronDown className={`chevron-icon ${activeMobileSection === 'solutions' ? 'rotate' : ''}`} />
              </button>
              {activeMobileSection === 'solutions' && (
                <div className="mobile-accordion-content">
                  <Link to="/solutions/compliance">Business Compliance</Link>
                  <Link to="/solutions/accounting">Accounting & Bookkeeping</Link>
                  <Link to="/solutions/gst">GST & Tax Filing</Link>
                  <Link to="/solutions/payroll">Payroll & HR</Link>
                  <Link to="/solutions/cfo">Virtual CFO</Link>
                  <Link to="/solutions/loans">Business Loans</Link>
                </div>
              )}
            </div>

            {/* Industries Mobile Accordion */}
            <div className="mobile-accordion">
              <button 
                className="mobile-accordion-trigger"
                onClick={() => toggleMobileSubmenu('industries')}
              >
                <span>For Businesses</span>
                <ChevronDown className={`chevron-icon ${activeMobileSection === 'industries' ? 'rotate' : ''}`} />
              </button>
              {activeMobileSection === 'industries' && (
                <div className="mobile-accordion-content">
                  <Link to="/industries/startups">Startups & Founders</Link>
                  <Link to="/industries/small-business">Small Businesses</Link>
                  <Link to="/industries/smes">SMEs</Link>
                  <Link to="/industries/ecommerce">E-Commerce</Link>
                  <Link to="/industries/traders">Traders & Retailers</Link>
                </div>
              )}
            </div>

            <Link to="/pricing" className="mobile-nav-item">Pricing Plans</Link>

            {/* Resources Mobile Accordion */}
            <div className="mobile-accordion">
              <button 
                className="mobile-accordion-trigger"
                onClick={() => toggleMobileSubmenu('resources')}
              >
                <span>Resources & Tools</span>
                <ChevronDown className={`chevron-icon ${activeMobileSection === 'resources' ? 'rotate' : ''}`} />
              </button>
              {activeMobileSection === 'resources' && (
                <div className="mobile-accordion-content">
                  <Link to="/resources/calendar">Compliance Calendar</Link>
                  <Link to="/resources/calculators">GST & Tax Calculators</Link>
                  <Link to="/resources/gst-guides">GST Guides</Link>
                  <Link to="/blog">Blog Articles</Link>
                </div>
              )}
            </div>

            <Link to="/about" className="mobile-nav-item">About Us</Link>
            <Link to="/contact" className="mobile-nav-item">Contact & Support</Link>
          </div>

          <div className="mobile-drawer-footer">
            <Button variant="primary" style={{ width: '100%' }} onClick={() => navigate('/login')}>
              Get Started Now
            </Button>
            <Button variant="secondary" style={{ width: '100%', marginTop: '8px' }} onClick={() => navigate('/free-compliance-check')}>
              Free Business Compliance Audit
            </Button>
            <div className="mobile-login-link text-center mt-3">
              <Link to="/login">Already registered? Log In</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
