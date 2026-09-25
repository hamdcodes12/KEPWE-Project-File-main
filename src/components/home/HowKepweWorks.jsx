import React from 'react';
import { Layers, LineChart, CheckCircle2 } from 'lucide-react';
import './HowKepweWorks.css';

const steps = [
  {
    stepNum: '01',
    title: 'Connect',
    subtitle: 'Bring your financial experiences together.',
    description: 'Consolidate accounting ledgers, statutory filing dates, market feeds, and lending channels in one place.',
    icon: Layers,
  },
  {
    stepNum: '02',
    title: 'Understand',
    subtitle: 'See the information that matters.',
    description: 'Transform raw data into clear options signals, automated tax reconciliation, and actionable metrics.',
    icon: LineChart,
  },
  {
    stepNum: '03',
    title: 'Move Forward',
    subtitle: 'Take the next step with greater clarity.',
    description: 'Execute MCA filings, capture market movements, or disburse working capital with total confidence.',
    icon: CheckCircle2,
  },
];

const HowKepweWorks = () => {
  return (
    <section className="how-kepwe-works-section" aria-label="How KEPWE Works">
      <div className="container">
        
        {/* Section Header */}
        <div className="how-works-header text-center">
          <div className="how-works-eyebrow">
            <span className="how-works-dot" />
            <span>HOW IT WORKS</span>
          </div>
          <h2 className="how-works-title">From complexity to clarity.</h2>
          <p className="how-works-subtitle">
            A simple three-step journey designed around the way modern financial operations happen.
          </p>
        </div>

        {/* 3 Steps Container */}
        <div className="how-steps-wrapper">
          <div className="steps-connector-line" aria-hidden="true" />

          <div className="how-steps-grid">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="how-step-card">
                  <div className="step-badge-wrap">
                    <span className="step-num-badge">{step.stepNum}</span>
                    <div className="step-icon-bubble">
                      <Icon size={20} color="#214ECF" />
                    </div>
                  </div>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-subtitle">{step.subtitle}</p>
                  <p className="step-description">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};

export default HowKepweWorks;
