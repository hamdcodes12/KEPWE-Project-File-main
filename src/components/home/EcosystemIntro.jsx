import React from 'react';
import ScrollFloat from '../reactbits/ScrollFloat';
import './EcosystemIntro.css';

const EcosystemIntro = () => {
  return (
    <section className="ecosystem-intro-section" aria-label="KEPWE Ecosystem Introduction">
      <div className="container ecosystem-intro-container">
        
        {/* Eyebrow */}
        <div className="intro-eyebrow">
          <span className="intro-dot" />
          <span>ONE CONNECTED ECOSYSTEM</span>
        </div>

        {/* ScrollFloat Headline */}
        <ScrollFloat
          animationDuration={1}
          ease="back.inOut(2)"
          scrollStart="center bottom+=25%"
          scrollEnd="bottom bottom-=35%"
          stagger={0.025}
          className="intro-main-heading"
        >
          Your financial world shouldn't live in silos.
        </ScrollFloat>

        {/* Paragraph */}
        <p className="intro-body-copy">
          KEPWE connects financial products, business tools, market intelligence and digital experiences into one ecosystem, making important financial journeys simpler to navigate.
        </p>

      </div>
    </section>
  );
};

export default EcosystemIntro;
