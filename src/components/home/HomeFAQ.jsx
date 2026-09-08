import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './HomeFAQ.css';

const faqs = [
  {
    q: 'What is the KEPWE Financial Ecosystem?',
    a: 'KEPWE is an integrated financial technology platform that unites business finance (Kepwe Ledger & GST compliance), quantitative market intelligence (IndexPilot AI & Kepwe Quant), and direct digital credit access (Kepwe Credit) in one cohesive workspace.',
  },
  {
    q: 'How does KEPWE Ledger simplify business tax & accounting?',
    a: 'KEPWE Ledger provides automated double-entry bookkeeping, direct GSTN portal integration, automated GSTR-2B vs 3B invoice reconciliation, and dedicated CA advisory so your business maintains 100% statutory compliance without manual friction.',
  },
  {
    q: 'What tools does IndexPilot AI provide for market traders?',
    a: 'IndexPilot AI delivers real-time options chain telemetry, volatility skew models, algorithmic strategy scanners, risk calculators, and systematic execution setups designed for index and options participants.',
  },
  {
    q: 'How does digital credit eligibility work on KEPWE Credit?',
    a: 'KEPWE Credit offers an instant digital assessment that checks your eligibility across verified RBI-regulated lending partners without impacting your credit score, with transparent interest rates and zero paperwork.',
  },
  {
    q: 'Can I use specific KEPWE products independently?',
    a: 'Yes. You can use KEPWE Ledger for business compliance, IndexPilot AI for market intelligence, or KEPWE Credit for borrowing individually, or leverage the connected ecosystem for unified visibility across all financial operations.',
  },
  {
    q: 'How is my sensitive financial and corporate data protected?',
    a: 'KEPWE utilizes 256-bit TLS encryption, strict role-based access permissions, non-disclosure confidentiality agreements, and audit logging to ensure your corporate, tax, and personal data is secure at all times.',
  },
];

const HomeFAQ = () => {
  const [openIdx, setOpenIdx] = useState(0);

  const toggleFaq = (idx) => {
    setOpenIdx((prev) => (prev === idx ? -1 : idx));
  };

  return (
    <section className="home-faq-section" aria-label="Frequently Asked Questions">
      <div className="container">
        
        {/* Section Header */}
        <div className="faq-header text-center">
          <div className="faq-eyebrow">
            <span className="faq-dot" />
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="faq-title">Questions & Answers</h2>
          <p className="faq-subtitle">
            Everything you need to know about the KEPWE platform, products, and workflows.
          </p>
        </div>

        {/* Accordion List */}
        <div className="faq-accordion-container">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={idx} className={`faq-accordion-item ${isOpen ? 'active' : ''}`}>
                <button
                  type="button"
                  className="faq-accordion-trigger"
                  onClick={() => toggleFaq(idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  id={`faq-question-${idx}`}
                >
                  <span className="faq-question-text">{faq.q}</span>
                  <div className={`faq-chevron-circle ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown size={18} color="#214ECF" />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    aria-labelledby={`faq-question-${idx}`}
                    className="faq-accordion-panel"
                  >
                    <p className="faq-answer-text">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default HomeFAQ;
