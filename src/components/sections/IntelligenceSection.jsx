import React from 'react';
import { Cpu, Layers, RefreshCw, CheckCircle2, Zap } from 'lucide-react';
import ScrollReveal from '../common/ScrollReveal';
import './IntelligenceSection.css';

const IntelligenceSection = () => {
  return (
    <section className="intelligence-section" aria-label="Intelligence Behind Every Decision">
      <div className="container">
        
        <div className="intelligence-grid">
          
          {/* Left Text Column */}
          <ScrollReveal animation="fade-up" duration={650} delay={0} className="intelligence-text-col">
            <div>
              <div className="section-eyebrow">
                <span className="eyebrow-blue-dot" />
                <span>CORE ARCHITECTURE</span>
              </div>
              <h2 className="intelligence-title">Intelligence Behind Every Decision</h2>
              <p className="intelligence-subtitle">
                Financial information can be complicated. Kepwe is designed to turn complex financial data into information that's easier to understand, act on, and manage.
              </p>

              <div className="intelligence-pillars-list">
                
                <div className="pillar-item">
                  <div className="pillar-icon">
                    <Layers size={20} color="#214ECF" />
                  </div>
                  <div>
                    <h3 className="pillar-heading">Simple Interfaces</h3>
                    <p className="pillar-desc">
                      Clean, uncluttered dashboards designed for clarity and rapid decision-making.
                    </p>
                  </div>
                </div>

                <div className="pillar-item">
                  <div className="pillar-icon">
                    <Cpu size={20} color="#214ECF" />
                  </div>
                  <div>
                    <h3 className="pillar-heading">Intelligent Technology</h3>
                    <p className="pillar-desc">
                      Automated GST input matching, MCA compliance checks, and index risk engines.
                    </p>
                  </div>
                </div>

                <div className="pillar-item">
                  <div className="pillar-icon">
                    <RefreshCw size={20} color="#214ECF" />
                  </div>
                  <div>
                    <h3 className="pillar-heading">Connected Financial Experiences</h3>
                    <p className="pillar-desc">
                      Synchronized data between your books, market portfolios, and credit profile.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </ScrollReveal>

          {/* Right Minimal Abstract Data Visualization */}
          <ScrollReveal animation="fade-up" duration={650} delay={150} className="intelligence-visual-col">
            <div className="intel-visual-card">
              
              <div className="intel-card-head">
                <div className="intel-live-pill">
                  <Zap size={12} color="#12B76A" />
                  <span>LIVE INTELLIGENCE STREAM</span>
                </div>
                <span className="intel-latency">0.2ms latency</span>
              </div>

              {/* Conceptual Node Graph Visualization */}
              <div className="node-graph-container">
                <div className="node central-node">
                  <span className="central-dot" />
                  <span className="node-label">KEPWE CORE</span>
                </div>

                <div className="node-sat satellite-1">
                  <span className="sat-icon">GSTN</span>
                  <span className="sat-text">99.8% Sync</span>
                </div>

                <div className="node-sat satellite-2">
                  <span className="sat-icon">SEBI</span>
                  <span className="sat-text">Live Feeds</span>
                </div>

                <div className="node-sat satellite-3">
                  <span className="sat-icon">MCA</span>
                  <span className="sat-text">ROC Verified</span>
                </div>

                <svg className="node-lines-svg" viewBox="0 0 320 220">
                  <line x1="160" y1="110" x2="60" y2="40" stroke="#E4E7EC" strokeWidth="1.5" strokeDasharray="4 4" />
                  <line x1="160" y1="110" x2="260" y2="40" stroke="#E4E7EC" strokeWidth="1.5" strokeDasharray="4 4" />
                  <line x1="160" y1="110" x2="160" y2="180" stroke="#E4E7EC" strokeWidth="1.5" strokeDasharray="4 4" />
                </svg>
              </div>

              {/* Bottom Metric Bar */}
              <div className="intel-metrics-footer">
                <div className="footer-metric">
                  <CheckCircle2 size={14} color="#12B76A" />
                  <span>Zero Data Silos</span>
                </div>
                <div className="footer-metric">
                  <CheckCircle2 size={14} color="#12B76A" />
                  <span>Real-Time Audit</span>
                </div>
              </div>

            </div>
          </ScrollReveal>

        </div>

      </div>
    </section>
  );
};

export default IntelligenceSection;
