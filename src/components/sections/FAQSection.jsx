import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './FAQSection.css';

const FAQSection = () => {
  const [openIdx, setOpenIdx] = useState(0);

  const faqs = [
    {
      q: 'How is KEPWE different from hiring a local Chartered Accountant or advocate?',
      a: 'Local CAs often rely on manual spreadsheets, offline visits, and reactive filing right on the due date. KEPWE provides a dedicated CA team backed by a real-time digital workspace, automated ITC matching, zero-delay filing guarantees, and proactive tax planning.'
    },
    {
      q: 'Will I be assigned a dedicated point of contact?',
      a: 'Yes. Every KEPWE client gets an assigned Account Manager (Chartered Accountant / Company Secretary) accessible via WhatsApp, Phone, and Customer Portal.'
    },
    {
      q: 'What if my past GST filings or books are messy or have notices?',
      a: 'Our team specializes in historical reconciliation. During onboarding, we conduct a free compliance audit, reconcile past GSTR-2B vs 3B gaps, respond to GST/MCA notices, and get your books 100% audit-ready.'
    },
    {
      q: 'How fast can KEPWE take over my business accounting & tax?',
      a: 'Onboarding takes less than 24 hours. We securely import your Tally/Zoho/QuickBooks data or bank statements and set up your active filing calendar immediately.'
    },
    {
      q: 'Is my financial data secure with KEPWE?',
      a: 'Absolutely. All data is encrypted using 256-bit SSL banking standards with automated backups. Your documents are NDA-protected and strictly accessible only to your assigned compliance team.'
    }
  ];

  return (
    <section className="faq-editorial-section">
      <div className="faq-container">
        <ScrollReveal animation="fade-up" duration={650}>
          <div className="faq-header">
            <div className="faq-eyebrow">FREQUENTLY ASKED QUESTIONS</div>
            <h2 className="faq-title">Everything you need to know about KEPWE</h2>
          </div>
        </ScrollReveal>

        <div className="faq-accordion-list">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <ScrollReveal key={idx} animation="fade-up" duration={650} delay={idx * 60}>
                <div className={`faq-accordion-item ${isOpen ? 'open' : ''}`}>
                  <button
                    className="faq-question-btn"
                    onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                    aria-expanded={isOpen}
                  >
                    <span className="faq-question-text">{faq.q}</span>
                    <ChevronDown className="faq-icon" size={20} />
                  </button>
                  {isOpen && (
                    <div className="faq-answer-panel">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
