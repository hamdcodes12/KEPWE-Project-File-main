import React from 'react';
import { Link } from 'react-router-dom';
import '../common/Footer.css';

const Footer = () => {
  return (
    <footer className="kepwe-footer-dark">
      <div className="kepwe-footer-container">
        
        {/* Top Brand Logo */}
        <div className="kepwe-footer-logo">
          <Link to="/" className="footer-brand-title">Kepwe</Link>
        </div>

        {/* 4 Column Navigation Grid */}
        <div className="kepwe-footer-grid">
          
          {/* Column 1: PRODUCTS */}
          <div className="kepwe-footer-col">
            <h5 className="footer-col-heading">PRODUCTS</h5>
            <ul className="footer-col-list">
              <li><Link to="/ledger" className="footer-link-item">Kepwe Ledger</Link></li>
              <li><Link to="/indexpilot" className="footer-link-item">Kepwe IndexPilot</Link></li>
              <li><Link to="/credit" className="footer-link-item">Kepwe Credit</Link></li>
            </ul>
          </div>

          {/* Column 2: COMPANY */}
          <div className="kepwe-footer-col">
            <h5 className="footer-col-heading">COMPANY</h5>
            <ul className="footer-col-list">
              <li><Link to="/about" className="footer-link-item">About</Link></li>
              <li><Link to="/about" className="footer-link-item">Careers</Link></li>
              <li><Link to="/contact" className="footer-link-item">Contact</Link></li>
            </ul>
          </div>

          {/* Column 3: RESOURCES */}
          <div className="kepwe-footer-col">
            <h5 className="footer-col-heading">RESOURCES</h5>
            <ul className="footer-col-list">
              <li><Link to="/resources/business-guides" className="footer-link-item">Blog</Link></li>
              <li><Link to="/contact" className="footer-link-item">Help Center</Link></li>
              <li><Link to="/resources/gst-guides" className="footer-link-item">Financial Guides</Link></li>
            </ul>
          </div>

          {/* Column 4: LEGAL */}
          <div className="kepwe-footer-col">
            <h5 className="footer-col-heading">LEGAL</h5>
            <ul className="footer-col-list">
              <li><Link to="/legal/privacy" className="footer-link-item">Privacy Policy</Link></li>
              <li><Link to="/legal/terms" className="footer-link-item">Terms</Link></li>
              <li><Link to="/legal/risk-disclosure" className="footer-link-item">Disclosures</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom Copyright Strip */}
        <div className="kepwe-footer-bottom">
          <p>© 2026 Kepwe. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
