import React from 'react';
import ScrollExpand from '../../components/reactbits/ScrollExpand';
import EcosystemIntro from '../../components/home/EcosystemIntro';
import KepweProducts from '../../components/home/KepweProducts';
import PlatformShowcase from '../../components/home/PlatformShowcase';
import Capabilities from '../../components/home/Capabilities';
import WhyKepwe from '../../components/home/WhyKepwe';
import HowKepweWorks from '../../components/home/HowKepweWorks';
import MaskedHeading from '../../components/reactbits/MaskedHeading';
import ResponsibleTrust from '../../components/home/ResponsibleTrust';
import ResourcesHub from '../../components/home/ResourcesHub';
import HomeFAQ from '../../components/home/HomeFAQ';
import FinalCTASection from '../../components/home/FinalCTASection';

const HomePage = () => {
  return (
    <div className="kepwe-homepage-master" style={{ backgroundColor: '#FFFFFF', color: '#111827', minHeight: '100vh', overflowX: 'hidden' }}>
      
      {/* 01 SCROLL EXPAND GRAND OPENING SECTION (React Bits GSAP Window-Scroll Expansion with Hero CTAs) */}
      <ScrollExpand />

      {/* 02 KEPWE INTRO SECTION (with ScrollFloat) */}
      <EcosystemIntro />

      {/* 03 PRODUCT ECOSYSTEM (5 Real KEPWE Products) */}
      <KepweProducts />

      {/* 04 PLATFORM SHOWCASE (Connected Financial Workspace) */}
      <PlatformShowcase />

      {/* 05 BUSINESS OPERATING PILLARS (8 Capabilities) */}
      <Capabilities />

      {/* 06 WHY KEPWE (4 Core Value Pillars) */}
      <WhyKepwe />

      {/* 07 HOW IT WORKS (3-Step Timeline: Connect, Understand, Move Forward) */}
      <HowKepweWorks />

      {/* 08 MASKED HEADING EDITORIAL SECTION (React Bits Typography Mask) */}
      <MaskedHeading 
        heading="Designed in the details."
        subheading="Every calculation, telemetry stream, and statutory workflow engineered for institutional precision and consumer simplicity."
        reveal="rise"
      />

      {/* 09 RESPONSIBLE TECHNOLOGY & TRUST */}
      <ResponsibleTrust />

      {/* 10 RESOURCES & INSIGHTS HUB */}
      <ResourcesHub />

      {/* 11 FREQUENTLY ASKED QUESTIONS (Accessible Accordion) */}
      <HomeFAQ />

      {/* 12 FINAL CTA */}
      <FinalCTASection />

    </div>
  );
};

export default HomePage;
