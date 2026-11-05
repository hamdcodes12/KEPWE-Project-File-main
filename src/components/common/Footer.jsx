import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="kepwe-footer-dark">
      <div className="kepwe-footer-container">
        
        {/* Main Footer Layout: Brand Left + Navigation Columns Right */}
        <div className="kepwe-footer-main">
          
          {/* Left Brand Column */}
          <div className="kepwe-footer-brand-block">
            <Link to="/" className="footer-logo-link quant-footer-brand" title="KEPWE QUANT Home">
              <span className="quant-brand-mark" aria-hidden="true">K</span>
              <span>KEPWE <strong>QUANT</strong></span>
            </Link>
            <p className="footer-brand-tagline">
              Algorithmic trading software for strategy research, automation, broker connectivity, and risk management.
            </p>
          </div>

          {/* 4 Column Navigation Grid */}
          <div className="kepwe-footer-grid">
            
            {/* Column 1: PRODUCTS */}
            <div className="kepwe-footer-col">
              <h5 className="footer-col-heading">PRODUCTS</h5>
              <ul className="footer-col-list">
                <li><Link to="/quant" className="footer-link-item">KEPWE Quant</Link></li>
              </ul>
            </div>

            {/* Column 2: COMPANY */}
            <div className="kepwe-footer-col">
              <h5 className="footer-col-heading">COMPANY</h5>
              <ul className="footer-col-list">
                <li><Link to="/about" className="footer-link-item">About Us</Link></li>
                <li><Link to="/about" className="footer-link-item">Careers</Link></li>
                <li><Link to="/contact" className="footer-link-item">Contact</Link></li>
              </ul>
            </div>

            {/* Column 3: RESOURCES */}
            <div className="kepwe-footer-col">
              <h5 className="footer-col-heading">RESOURCES</h5>
              <ul className="footer-col-list">
                <li><Link to="/learn" className="footer-link-item">Kepwe Learn</Link></li>
                <li><Link to="/resources/calendar" className="footer-link-item">Compliance Calendar</Link></li>
                <li><Link to="/resources/calculators" className="footer-link-item">Calculators</Link></li>
                <li><Link to="/resources/gst-guides" className="footer-link-item">Tax Filing Hub</Link></li>
              </ul>
            </div>

            {/* Column 4: LEGAL */}
            <div className="kepwe-footer-col">
              <h5 className="footer-col-heading">LEGAL & TRUST</h5>
              <ul className="footer-col-list">
                <li><Link to="/legal/privacy" className="footer-link-item">Privacy Policy</Link></li>
                <li><Link to="/legal/terms" className="footer-link-item">Terms of Service</Link></li>
                <li><Link to="/legal/risk-disclosure" className="footer-link-item">Risk Disclosures</Link></li>
              </ul>
            </div>

          </div>
        </div>

        {/* Bottom Copyright Strip */}
        <div className="kepwe-footer-bottom">
          <p>© 2026 KEPWE QUANT. All rights reserved.</p>
          <div className="footer-bottom-links">
            <Link to="/legal/privacy">Privacy Policy</Link>
            <span>•</span>
            <Link to="/legal/terms">Terms of Service</Link>
            <span>•</span>
            <Link to="/contact">Support</Link>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
