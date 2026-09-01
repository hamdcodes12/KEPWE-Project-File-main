import React from 'react';
import './Card.css';

const Card = ({ children, className = '', hover = true, ...props }) => {
  return (
    <div 
      className={`card ${hover ? 'hover-lift' : ''} ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
