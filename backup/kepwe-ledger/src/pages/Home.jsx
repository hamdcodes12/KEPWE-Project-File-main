import React from 'react';
import HeroSection from '../components/sections/HeroSection';
import TrustStrip from '../components/sections/TrustStrip';
import ProblemSection from '../components/sections/ProblemSection';
import LifecycleTimeline from '../components/sections/LifecycleTimeline';
import ServicesGrid from '../components/sections/ServicesGrid';
import HowItWorks from '../components/sections/HowItWorks';
import FreeComplianceCheck from '../components/sections/FreeComplianceCheck';
import PricingSection from '../components/sections/PricingSection';
import IndustriesSection from '../components/sections/IndustriesSection';
import ResourcesSection from '../components/sections/ResourcesSection';
import FAQSection from '../components/sections/FAQSection';
import FinalCTA from '../components/sections/FinalCTA';

const Home = () => {
  return (
    <div className="home-page">
      <HeroSection />
      <TrustStrip />
      <ProblemSection />
      <LifecycleTimeline />
      <ServicesGrid />
      <HowItWorks />
      <FreeComplianceCheck />
      <PricingSection />
      <IndustriesSection />
      <ResourcesSection />
      <FAQSection />
      <FinalCTA />
    </div>
  );
};

export default Home;
