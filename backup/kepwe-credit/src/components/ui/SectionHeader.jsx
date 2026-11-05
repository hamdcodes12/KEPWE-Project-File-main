import React from 'react';
import './SectionHeader.css';

const SectionHeader = ({ headline, supportingText, centered = false, dark = false, className = '' }) => {
  return (
    <div className={`section-header ${centered ? 'text-center' : ''} ${dark ? 'dark' : ''} ${className} animate-slide-up`}>
      <h2 className="heading-lg">{headline}</h2>
      {supportingText && <p className="text-lg text-muted mt-3">{supportingText}</p>}
    </div>
  );
};

export default SectionHeader;
