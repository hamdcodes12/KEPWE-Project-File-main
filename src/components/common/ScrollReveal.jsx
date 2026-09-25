import React, { useEffect, useRef, useState } from 'react';
import './ScrollReveal.css';

const ScrollReveal = ({
  children,
  animation = 'fade-up',
  delay = 0,
  duration = 650,
  threshold = 0.05,
  once = true,
  className = '',
  style = {}
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once && elementRef.current) {
            observer.unobserve(elementRef.current);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    const currentRef = elementRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, once]);

  const animStyle = {
    ...style,
    transitionDuration: `${duration}ms`,
    transitionDelay: `${delay}ms`
  };

  return (
    <div
      ref={elementRef}
      className={`scroll-reveal reveal-${animation} ${isVisible ? 'is-visible' : ''} ${className}`}
      style={animStyle}
    >
      {children}
    </div>
  );
};

export default ScrollReveal;
