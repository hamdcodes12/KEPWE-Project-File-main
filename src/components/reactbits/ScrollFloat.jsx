import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './ScrollFloat.css';

gsap.registerPlugin(ScrollTrigger);

const ScrollFloat = ({
  children,
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart = 'center bottom+=25%',
  scrollEnd = 'bottom bottom-=35%',
  stagger = 0.025,
  className = '',
  as: Component = 'h2',
}) => {
  const containerRef = useRef(null);

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';
    if (!text) return null;
    return text.split(' ').map((word, wordIndex) => ({
      word,
      letters: Array.from(word),
      wordIndex,
    }));
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const charElements = el.querySelectorAll('.scroll-float-char');
    if (!charElements.length) return;

    const ctx = gsap.context(() => {
      gsap.from(charElements, {
        y: '80%',
        opacity: 0,
        scale: 0.9,
        duration: animationDuration,
        ease: ease,
        stagger: stagger,
        scrollTrigger: {
          trigger: el,
          start: scrollStart,
          end: scrollEnd,
          scrub: true,
        },
      });
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [animationDuration, ease, scrollStart, scrollEnd, stagger, splitText]);

  if (!splitText) {
    return <Component className={`scroll-float-container ${className}`}>{children}</Component>;
  }

  return (
    <Component ref={containerRef} className={`scroll-float-container ${className}`}>
      {splitText.map(({ word, letters, wordIndex }) => (
        <span key={`word-${wordIndex}`} className="scroll-float-word">
          {letters.map((char, charIndex) => (
            <span key={`char-${wordIndex}-${charIndex}`} className="scroll-float-char">
              {char}
            </span>
          ))}
          <span className="scroll-float-space">&nbsp;</span>
        </span>
      ))}
    </Component>
  );
};

export default ScrollFloat;
