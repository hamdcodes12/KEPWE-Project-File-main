import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shield, FileText, AlertTriangle, Lock } from 'lucide-react';

const LegalPages = () => {
  const { doc } = useParams();

  const docTitle = doc === 'terms' ? 'Terms & Conditions'
    : doc === 'risk-disclosure' ? 'Risk Disclosure Document'
    : doc === 'privacy' ? 'Privacy Policy'
    : doc === 'refunds' ? 'Refund & Cancellation Policy'
    : doc === 'grievance' ? 'Grievance Redressal'
    : doc === 'lending-disclosure' ? 'Lending & Credit Disclosure'
    : doc === 'partner-disclosure' ? 'Lender & LSP Partner Disclosure'
    : 'Legal Hub';

  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#0F172A', minHeight: '100vh', padding: '60px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ background: '#F0F4FE', color: '#214ECF', border: '1px solid #D0D5DD', padding: '6px 16px', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 800 }}>
            COMPLIANCE & LEGAL HUB
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '16px', marginBottom: '8px' }}>
            {docTitle}
          </h1>
          <p style={{ color: '#667085', fontSize: '0.95rem' }}>
            Kepwe Private Limited / Thinkatic Private Limited Governance & Policy Framework
          </p>
        </div>

        {/* Sub-nav Links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '40px' }}>
          {[
            { path: 'terms', label: 'Terms & Conditions' },
            { path: 'privacy', label: 'Privacy Policy' },
            { path: 'lending-disclosure', label: 'Lending Disclosure' },
            { path: 'partner-disclosure', label: 'Lender/LSP Partners' },
            { path: 'risk-disclosure', label: 'Risk Disclosure' },
            { path: 'refunds', label: 'Refund Policy' },
            { path: 'grievance', label: 'Grievance Redressal' },
          ].map((item) => (
            <Link
              key={item.path}
              to={`/legal/${item.path}`}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                background: doc === item.path ? '#214ECF' : '#F7F9FC',
                color: doc === item.path ? '#FFFFFF' : '#475467',
                border: '1px solid #E4E7EC'
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Content Box */}
        <div className="glass-card" style={{ padding: '36px', borderRadius: '16px', lineHeight: '1.7', color: '#CBD5E1', fontSize: '0.95rem' }}>
          {doc === 'risk-disclosure' && (
            <div>
              <h3 style={{ color: '#FB6B6B', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                SEBI Risk Disclosure on Derivatives Trading
              </h3>
              <p style={{ marginBottom: '16px' }}>
                9 out of 10 individual traders in equity options segment incurred net losses, with an average loss amount of ₹50,000 per trader per SEBI study. Over and above net trading losses, trading transactions incur 15% to 27% in transaction charges.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Kepwe / IndexPilot surfaces decision support tools, proprietary index scores, and defined-risk strategy filters. Content is strictly for educational and informational purposes and does not constitute individualized investment advice or recommendations.
              </p>
            </div>
          )}

          {doc === 'lending-disclosure' && (
            <div>
              <h3 style={{ color: '#111827', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Lending & Credit Discovery Disclosure
              </h3>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                Kepwe Credit acts strictly as a digital interface facilitating access to credit opportunities offered by regulated banks and Non-Banking Financial Companies (NBFCs). Kepwe is not a lender or banking entity.
              </p>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                All loan sanctioning, interest rate determination (Annual Percentage Rate), processing fees, loan agreements, repayment schedules, and loan recovery processes are governed strictly by the respective partner lending institutions in full compliance with Reserve Bank of India (RBI) Digital Lending Guidelines.
              </p>
            </div>
          )}

          {doc === 'partner-disclosure' && (
            <div>
              <h3 style={{ color: '#111827', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Lending Service Provider (LSP) & Partner Disclosures
              </h3>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                In accordance with RBI circulars on Digital Lending and Lending Service Providers (LSP):
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px', color: '#475467' }}>
                <li style={{ marginBottom: '8px' }}>Partner Lenders: Regulated Scheduled Commercial Banks and RBI-Registered NBFCs.</li>
                <li style={{ marginBottom: '8px' }}>Key Fact Statement (KFS): Provided directly to the borrower before loan agreement execution.</li>
                <li style={{ marginBottom: '8px' }}>Cooling-off / Look-up Period: Borrowers are entitled to exit loan contracts within the designated cooling-off window without penalty.</li>
                <li style={{ marginBottom: '8px' }}>Data Privacy: Storage of biometric and persistent contact data is prohibited; data accessed strictly with explicit borrower consent.</li>
              </ul>
            </div>
          )}

          {doc === 'terms' && (
            <div style={{ color: '#1F2937' }}>
              <h3 style={{ color: '#111827', fontSize: '1.45rem', fontWeight: 800, marginBottom: '8px' }}>
                KEPWE
              </h3>
              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '20px' }}>
                LEGAL POLICIES, TERMS &amp; REGULATORY DISCLOSURES
              </h4>

              <p style={{ marginBottom: '16px' }}>
                <strong>For Kepwe Ledger • Kepwe Credit • Kepwe Indexpilot • Kepwe Quant</strong>
              </p>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px 20px', marginBottom: '24px' }}>
                <p style={{ margin: '0 0 8px' }}><strong>Corporate Information</strong></p>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Legal entity: Kepwe Private Limited</li>
                  <li>CIN: U62099PN2025PTC245647</li>
                  <li>GSTIN: 27AAMCK1345D1ZO</li>
                  <li>Registered Office: 403, Span Residency, Magarpatta, Hadapsar, Pune, Maharashtra, 411028</li>
                  <li>SEBI Authorised Person No. provided: AP3127000311</li>
                  <li>Effective date: 1 September 2026</li>
                  <li>Document status: Website-ready master draft; subject to legal/regulatory review before publication</li>
                </ul>
              </div>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>
                IMPORTANT LEGAL NOTICE
              </h4>
              <p style={{ marginBottom: '16px' }}>
                This master document is drafted to establish a strong contractual, privacy, risk-allocation and disclosure framework for Kepwe Private Limited and its products. It is not a substitute for a legal opinion. Before publication, Kepwe should have Indian counsel and, where applicable, its relevant lender, stock broker, exchange and other regulated partners review the final text, product flows, consent screens, fee disclosures, grievance mechanisms and regulatory status.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Where a provision of applicable law, regulation, circular, exchange rule, lender policy, broker agreement or regulator direction conflicts with this document, the mandatory legal or regulatory requirement will prevail to the extent of the conflict.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>
                PART I — TERMS OF SERVICE
              </h4>

              <p style={{ marginBottom: '16px' }}>
                <strong>Version: 1.0 | Effective: 1 September 2026</strong>
              </p>
              <p style={{ marginBottom: '16px' }}>
                These Terms of Service (“Terms”) constitute a legally binding agreement between you and Kepwe Private Limited governing access to and use of the Kepwe website, applications, APIs, dashboards, software, content and services, including Kepwe Ledger, Kepwe Credit, Kepwe Indexpilot and Kepwe Quant (collectively, the “Services”).
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>1. Acceptance and eligibility</h5>
              <p style={{ marginBottom: '16px' }}>
                By accessing, registering for, clicking an acceptance button, signing an agreement, connecting an API, placing an order, subscribing to a plan, applying for a financial product, or otherwise using a Service, you acknowledge that you have read and accepted these Terms and the applicable product terms, privacy notice, risk disclosures and partner disclosures.
              </p>
              <p style={{ marginBottom: '16px' }}>
                You must have legal capacity to enter into a binding contract. Where the Service is used on behalf of a company, partnership, LLP, trust or other entity, you represent that you are authorised to bind that entity.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Kepwe may impose age, residency, KYC, jurisdictional, suitability, onboarding or other eligibility conditions for specific Services. A user may be refused or suspended where legally required or where the Company determines that onboarding cannot safely or lawfully be completed.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>2. Nature of Kepwe services</h5>
              <p style={{ marginBottom: '12px' }}>
                Kepwe provides technology, workflow, information, analytics, automation and/or marketplace facilitation services. The precise role of Kepwe differs by product and transaction.
              </p>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                <li>Kepwe Ledger is a business accounting, bookkeeping, compliance-workflow and financial-record technology platform. It does not by itself constitute a statutory audit, tax opinion, legal opinion, chartered accountant engagement or government filing guarantee.</li>
                <li>Kepwe Credit is a technology-enabled credit discovery/application/intermediation interface. Unless expressly stated in the applicable loan agreement, Kepwe is not the lender and does not independently approve, sanction, disburse, price, restructure or recover loans.</li>
                <li>Kepwe Indexpilot is a market-information, analytics, index/strategy research and/or decision-support technology product. It is not a promise of returns and must not be treated as a guaranteed-return product.</li>
                <li>Kepwe Quant is an algorithmic/automation technology product intended to assist users with strategy configuration, testing, execution workflows and/or connectivity to third-party brokers. Market orders and strategies remain subject to market conditions, exchange/broker systems, API permissions, risk controls and applicable law.</li>
              </ul>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>3. No guaranteed outcome</h5>
              <p style={{ marginBottom: '16px' }}>
                Kepwe makes no representation that any Service will increase revenue, reduce taxes, obtain credit, improve a credit score, generate trading profits, outperform an index, avoid losses, execute every instruction, remain continuously available, or achieve any particular financial result.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Past performance, simulated results, backtests, examples, projections, testimonials and hypothetical calculations are illustrative only. They do not establish a promise, warranty or expectation of future performance.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>4. Account registration and security</h5>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                <li>You must provide accurate, complete and current information and promptly update material changes.</li>
                <li>You are responsible for safeguarding credentials, API keys, passwords, OTPs, devices, access tokens and recovery mechanisms.</li>
                <li>You must not share credentials or API keys with unauthorised persons.</li>
                <li>You must immediately notify Kepwe of suspected unauthorised access, fraud, credential compromise or suspicious transactions.</li>
                <li>Kepwe may require identity verification, KYC, device verification, additional authentication or re-verification.</li>
                <li>Kepwe may suspend access where there is a reasonable security, fraud, regulatory, payment, compliance or operational concern.</li>
              </ul>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>5. Prohibited uses</h5>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                <li>Using the Services for unlawful, fraudulent, deceptive or abusive purposes.</li>
                <li>Attempting to bypass authentication, rate limits, subscription controls, KYC or technical safeguards.</li>
                <li>Introducing malware, malicious code, automated attacks or unauthorised scraping.</li>
                <li>Using another person's identity or financial information without lawful authority.</li>
                <li>Manipulating markets, engaging in insider trading, front-running, spoofing, layering, wash trades or other prohibited activity.</li>
                <li>Using algorithmic/trading tools in a manner that violates exchange, broker, SEBI, RBI or other applicable rules.</li>
                <li>Submitting false documents, fabricated income information, manipulated bank statements or inaccurate KYC information.</li>
                <li>Reverse engineering, copying, reselling or commercially exploiting proprietary software except as expressly authorised.</li>
              </ul>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>6. Third-party services and integrations</h5>
              <p style={{ marginBottom: '16px' }}>
                The Services may integrate with banks, NBFCs, lenders, payment gateways, stock brokers, exchanges, depositories, KYC providers, GST/accounting systems, cloud providers, data providers and other third parties. Third-party services are governed by their own terms and availability.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Kepwe is not responsible for failures, outages, delays, data errors, pricing errors, API changes, rejected transactions, broker downtime, lender decisions or other events caused by third parties, except to the extent liability cannot lawfully be excluded.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>7. Fees, subscriptions and taxes</h5>
              <p style={{ marginBottom: '16px' }}>
                Fees, brokerage, platform charges, lender charges, interest, processing fees, subscription charges, API charges, taxes and other amounts will be disclosed through the applicable checkout, agreement, order form, loan documents or partner disclosure. GST and other statutory taxes may apply.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Unless mandatory law provides otherwise, payments for consumed digital services are non-refundable. Any refund, cancellation or chargeback rights will be governed by the applicable plan and law.
              </p>
              <p style={{ marginBottom: '16px' }}>
                For credit products, the borrower must rely on the lender's Key Fact Statement, sanction letter and loan agreement for the legally operative financial terms.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>8. Intellectual property</h5>
              <p style={{ marginBottom: '16px' }}>
                All software, source code, design systems, logos, trademarks, workflows, databases, interfaces, documentation, content and proprietary technology supplied by Kepwe are owned by or licensed to Kepwe and are protected by applicable intellectual property law. No rights are transferred except the limited right to use the Service during the applicable subscription or contractual period.
              </p>
              <p style={{ marginBottom: '16px' }}>
                You retain ownership of data that you lawfully submit, subject to the licences and processing rights necessary to provide the Service.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>9. User content and licence</h5>
              <p style={{ marginBottom: '16px' }}>
                You grant Kepwe a limited, non-exclusive, worldwide, royalty-free licence to host, reproduce, process, transmit and technically modify submitted data only as reasonably necessary to provide, secure, maintain, improve and comply with law in relation to the Service. Kepwe will not treat this clause as a transfer of ownership of your underlying business or personal data.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>10. Suspension and termination</h5>
              <p style={{ marginBottom: '16px' }}>
                Kepwe may suspend or terminate access immediately where reasonably necessary for security, fraud prevention, regulatory compliance, non-payment, breach of Terms, misuse, legal process, partner instruction or operational risk. Where appropriate, Kepwe may provide notice and an opportunity to cure.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Termination does not automatically cancel obligations that by their nature survive termination, including payment obligations, intellectual property, confidentiality, indemnity, liability limitations, dispute provisions and legally required record retention.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>11. Availability and changes</h5>
              <p style={{ marginBottom: '16px' }}>
                Kepwe may modify, add, remove, discontinue or restrict features. Scheduled maintenance, emergency maintenance, third-party outages, cyber incidents, exchange interruptions, internet failures, force majeure and other events may affect availability. No Service is warranted to be uninterrupted or error-free.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>12. Disclaimer of warranties</h5>
              <p style={{ marginBottom: '16px' }}>
                To the maximum extent permitted by applicable law, the Services are provided on an “as available” and “as is” basis. Kepwe disclaims implied warranties, including merchantability, fitness for a particular purpose, non-infringement, uninterrupted availability and accuracy, except where a warranty cannot legally be excluded.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>13. Limitation of liability</h5>
              <p style={{ marginBottom: '16px' }}>
                To the maximum extent permitted by law, Kepwe will not be liable for indirect, incidental, special, consequential, exemplary or punitive damages; loss of profits; loss of opportunity; loss of expected savings; business interruption; market losses; loss caused by third-party systems; or loss arising from unauthorised access caused by the user's failure to secure credentials.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Subject to non-excludable liability under law, Kepwe's aggregate contractual liability arising from a paid Service will not exceed the fees actually paid by the affected user to Kepwe for that Service during the twelve months immediately preceding the event giving rise to the claim. For a free Service, the aggregate liability cap will be INR 1,000, subject to applicable law.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Nothing in these Terms excludes liability that cannot lawfully be excluded, including liability arising from fraud or other mandatory statutory protections.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>14. Indemnity</h5>
              <p style={{ marginBottom: '16px' }}>
                You agree to defend, indemnify and hold harmless Kepwe, its directors, officers, employees, affiliates, contractors and service providers against third-party claims, losses, penalties, costs and reasonable legal expenses arising from your unlawful use of the Services, breach of these Terms, infringement of third-party rights, misuse of financial systems, violation of securities/lending laws, submission of false information, or negligent/willful misconduct.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>15. Governing law and dispute resolution</h5>
              <p style={{ marginBottom: '16px' }}>
                These Terms are governed by the laws of India. Subject to any mandatory regulator, consumer forum or statutory grievance mechanism, disputes shall be subject to the courts having jurisdiction over Pune, Maharashtra. Kepwe may elect arbitration for commercial disputes where an applicable contract contains a valid arbitration clause.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Nothing prevents a consumer, borrower or investor from exercising a non-waivable statutory right before an authority or forum having jurisdiction.
              </p>

              <h5 style={{ color: '#111827', fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>16. Force majeure</h5>
              <p style={{ marginBottom: '24px' }}>
                Kepwe will not be responsible for delay or failure caused by events beyond reasonable control, including natural disasters, war, civil unrest, epidemics, government action, regulatory changes, exchange or banking outages, telecom/internet failure, cyberattacks, cloud infrastructure failure, labour disruption, power failure or third-party service interruption.
              </p>
            </div>
          )}

          {doc === 'privacy' && (
            <div style={{ color: '#1F2937' }}>
              <h3 style={{ color: '#111827', fontSize: '1.45rem', fontWeight: 800, marginBottom: '8px' }}>
                Privacy Policy
              </h3>
              <p style={{ marginBottom: '20px' }}>
                <strong>Version: 1.0 | Effective: 1 September 2026</strong>
              </p>

              <p style={{ marginBottom: '16px' }}>
                This Privacy Policy explains how Kepwe Private Limited collects, uses, stores, shares and protects personal information in connection with its websites, applications, products, APIs, customer support and partner workflows.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>1. Privacy principles</h4>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                <li>Purpose limitation: data is collected for identified and legitimate purposes.</li>
                <li>Data minimisation: Kepwe seeks to collect information reasonably necessary for the applicable purpose.</li>
                <li>Transparency: users should be able to understand why information is requested.</li>
                <li>Security: Kepwe applies reasonable technical and organisational safeguards appropriate to the nature of data and risk.</li>
                <li>Choice and control: where consent is the legal basis, withdrawal mechanisms will be made available subject to legal and contractual consequences.</li>
                <li>Accountability: Kepwe may maintain records, audit trails and compliance documentation as required by law.</li>
              </ul>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>2. Categories of information</h4>
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E2E8F0' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', border: '1px solid #E2E8F0' }}>Category</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', border: '1px solid #E2E8F0' }}>Examples</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', border: '1px solid #E2E8F0' }}>Typical purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Identity/KYC</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Name, DOB, PAN, Aadhaar-related verification output, address, photo, signatures</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Identity verification, onboarding, fraud prevention, regulatory compliance</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Contact</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Mobile, email, communication preferences</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Account, alerts, support</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Financial</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Income, bank details, statements, transaction information, credit/application information</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Credit intermediation, payments, accounting, risk/fraud checks where authorised</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Business/accounting</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Invoices, ledger entries, GST-related information, expenses, customer/vendor information</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Kepwe Ledger functionality</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Trading/investment</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Broker account identifiers, order/position data, strategy settings, holdings, API metadata</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Kepwe Indexpilot/Quant functionality and execution records</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Technical</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>IP address, device/browser data, logs, cookies, app version</td>
                      <td style={{ padding: '10px 12px', border: '1px solid #E2E8F0' }}>Security, diagnostics, analytics and service delivery</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>3. Sources</h4>
              <p style={{ marginBottom: '16px' }}>
                Information may come directly from you; from an authorised business administrator; from your connected bank, broker, lender, payment provider or other third party; from public or legally accessible sources; or automatically from your device/browser. Kepwe will not represent that third-party data is independently verified merely because it is received through an integration.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>4. Purposes of processing</h4>
              <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
                <li>Account creation, authentication and customer support.</li>
                <li>Provision and personalisation of the Services.</li>
                <li>Billing, payment processing and subscription management.</li>
                <li>KYC, AML/fraud prevention and compliance where applicable.</li>
                <li>Credit application routing, document collection and lender/partner workflows for Kepwe Credit.</li>
                <li>Accounting, reconciliation, GST workflow and reporting functions for Kepwe Ledger.</li>
                <li>Analytics, research, strategy configuration, testing and execution support for Indexpilot and Quant.</li>
                <li>Security monitoring, incident response, audit trails and abuse prevention.</li>
                <li>Legal claims, dispute resolution, regulatory requests and statutory recordkeeping.</li>
                <li>Product improvement, service analytics and communications subject to applicable law and consent requirements.</li>
              </ul>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>5. Legal bases and consent</h4>
              <p style={{ marginBottom: '16px' }}>
                Depending on the activity and applicable law, processing may be based on consent, performance of a contract, compliance with legal obligations, legitimate/authorised purposes or other lawful grounds. Where consent is relied upon, it will be presented in a manner designed to be clear and specific, and withdrawal will be facilitated subject to the applicable statutory framework.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>6. Cookies and similar technologies</h4>
              <p style={{ marginBottom: '16px' }}>
                Kepwe may use essential cookies, session technologies, analytics technologies and preference mechanisms. Users may control cookies through browser settings where available. Disabling essential technologies may impair authentication, security or core functionality.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>7. Sharing and disclosure</h4>
              <p style={{ marginBottom: '16px' }}>
                Kepwe may disclose information to the following categories where necessary and lawful: regulated lenders and their LSP ecosystem; stock brokers and exchange/depository-connected service providers; KYC and verification providers; payment processors; accounting/GST providers; cloud and infrastructure providers; customer support vendors; auditors and professional advisers; fraud/security providers; government/regulatory authorities; and successor entities in a merger, restructuring or asset transfer.
              </p>
              <p style={{ marginBottom: '16px' }}>
                Kepwe does not sell personal information as a general business model. Where a partner uses data for its own independent purposes, that partner's privacy notice may also apply.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>8. Credit data and consent</h4>
              <p style={{ marginBottom: '16px' }}>
                For Kepwe Credit, data may be collected only to the extent necessary for the relevant application and lawful purpose. Where a lender or regulated entity requires information, the applicable consent, lender disclosure, privacy notice and loan documentation govern.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>9. Security</h4>
              <p style={{ marginBottom: '16px' }}>
                Kepwe may use encryption in transit, access controls, authentication, logging, segregation, backups, monitoring, vulnerability management and vendor controls. No online system can be guaranteed completely secure. Users acknowledge that they are responsible for endpoint security, credential protection and promptly reporting suspected compromise.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>10. Retention</h4>
              <p style={{ marginBottom: '16px' }}>
                Kepwe retains information only for as long as reasonably necessary for the relevant purpose, contractual relationship, legal/regulatory requirements, dispute resolution, fraud prevention, accounting, tax, audit and enforcement. Different categories may have different retention periods. Deletion requests may be limited where retention is legally required or necessary for a lawful purpose.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>11. User rights and requests</h4>
              <p style={{ marginBottom: '16px' }}>
                Subject to applicable law, users may request access, correction, updating, deletion/erasure where legally available, withdrawal of consent where consent is the basis, and information regarding processing. Requests may require identity verification. A request should be sent to the privacy/grievance contact published by Kepwe on the website.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>12. Children's data</h4>
              <p style={{ marginBottom: '16px' }}>
                Kepwe's financial, lending and trading services are intended for persons legally eligible to use them. Kepwe does not knowingly solicit children's personal data for regulated financial services. Where law imposes special requirements for children's data, those requirements will apply.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>13. International transfers</h4>
              <p style={{ marginBottom: '16px' }}>
                Where data is processed or stored outside India through approved service providers, Kepwe will implement applicable legal, contractual and security requirements. Where a product is subject to an India-only storage requirement, the relevant regulated entity and service architecture will be configured accordingly.
              </p>

              <h4 style={{ color: '#111827', fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px' }}>14. Changes</h4>
              <p style={{ marginBottom: '0' }}>
                Kepwe may update this Privacy Policy to reflect changes in products, law, technology or processing. Material changes may be communicated through the website, app, email or other appropriate channel. Continued use after the effective date may constitute acceptance only to the extent legally permissible.
              </p>
            </div>
          )}

          {doc === 'refunds' && (
            <div>
              <h3 style={{ color: '#111827', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Refund & Cancellation Policy
              </h3>
              <p style={{ marginBottom: '16px', color: '#475467' }}>
                Subscriptions can be canceled anytime from Account & Billing. Cancellations take effect at the end of the current billing cycle. Full refunds are offered within 7 days of initial subscription signup if requested via support ticket.
              </p>
            </div>
          )}

          {doc === 'grievance' && (
            <div>
              <h3 style={{ color: '#FFFFFF', fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px' }}>
                Grievance Redressal Officer
              </h3>
              <p style={{ marginBottom: '16px' }}>
                In accordance with Indian Digital Services regulations, for any grievances or regulatory inquiries, contact our designated Grievance Officer:
              </p>
              <div style={{ background: '#1A2235', padding: '16px', borderRadius: '10px', color: '#17E7C0', fontWeight: 700 }}>
                Grievance Officer: Legal & Compliance Dept.<br />
                Email: grievance@kepwe.in | phone: +91 022 8899 0011<br />
                Entity: Kepwe Private Limited / Thinkatic Private Limited
              </div>
            </div>
          )}

          {!doc && (
            <div style={{ textAlign: 'center' }}>
              <p>Select a legal document from above to view complete terms, privacy policy, or risk disclosures.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegalPages;
