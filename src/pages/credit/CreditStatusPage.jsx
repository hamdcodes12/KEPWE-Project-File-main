import React from 'react';
import { ArrowLeft, ArrowRight, Activity, Clock, FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import './CreditStatusPage.css';

const CreditStatusPage = () => (
  <main className="credit-status-wrapper credit-workspace-page">
    <nav className="credit-workspace-nav" aria-label="Credit workspace navigation">
      <Link to="/credit"><ArrowLeft size={16} /> KEPWE Credit</Link>
      <span><ShieldCheck size={15} /> Your private workspace</span>
    </nav>

    <div className="credit-workspace-content">
      <header className="credit-workspace-heading">
        <div className="credit-workspace-eyebrow"><Activity size={15} /> KEPWE CREDIT</div>
        <h1>Your Credit workspace</h1>
        <p>Credit Health is available now. Upload your own report for a private, factor-by-factor analysis. Loan eligibility and offers require verified lender integrations and are not available yet.</p>
      </header>

      <section className="credit-workspace-cards" aria-label="Credit product status">
        <article className="credit-workspace-card credit-workspace-health">
          <div className="credit-workspace-card-icon"><FileText size={22} /></div>
          <span className="credit-workspace-status">AVAILABLE</span>
          <h2>Credit Health</h2>
          <p>Upload a PDF credit report to see the KEPWE Credit Health Score, score factors, extraction warnings, and recommendations.</p>
          <Link className="credit-workspace-primary-action" to="/credit/consent">Open Credit Health <ArrowRight size={17} /></Link>
        </article>

        <article className="credit-workspace-card credit-workspace-lending">
          <div className="credit-workspace-card-icon"><Clock size={22} /></div>
          <span className="credit-workspace-status">INTEGRATION PENDING</span>
          <h2>Loan eligibility</h2>
          <p>Eligibility checks, applications, and offers will be available after verified RBI-regulated lender integrations are configured. No loan decision or offer is available now.</p>
          <Link className="credit-workspace-secondary-action" to="/credit#loan-integration-pending">Loan Eligibility — Coming Soon <ArrowRight size={17} /></Link>
        </article>
      </section>
    </div>
  </main>
);

export default CreditStatusPage;
