import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import tradingDeskImg from '../../assets/Gemini_Generated_Image_6qhppq6qhppq6qhp.png';
import './MaskedHeading.css';

gsap.registerPlugin(ScrollTrigger);

const MaskedHeading = ({
  heading = 'Designed in the details.',
  subheading = 'Every workflow, calculation, and signal engineered for institutional precision and consumer simplicity.',
  imageSrc = tradingDeskImg,
  reveal = 'rise', // 'rise' | 'wipe'
}) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      // Parallax effect on the background image inside text
      gsap.to(textEl, {
        backgroundPositionY: '80%',
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
        },
      });

      if (reveal === 'rise') {
        gsap.from(textEl, {
          y: 60,
          opacity: 0.2,
          duration: 1.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: container,
            start: 'top 80%',
            end: 'top 40%',
            scrub: true,
          },
        });
      }
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [reveal]);

  return (
    <section ref={containerRef} className="masked-heading-section" aria-label="Editorial Showcase">
      <div className="container masked-heading-container">
        <div className="masked-heading-eyebrow">
          <span className="masked-dot" />
          <span>PRECISION ENGINEERING</span>
        </div>

        <h2
          ref={textRef}
          className={`masked-heading-text ${reveal === 'wipe' ? 'reveal-wipe' : 'reveal-rise'}`}
          style={{ backgroundImage: `url(${imageSrc})` }}
        >
          {heading}
        </h2>

        {subheading && (
          <p className="masked-heading-subheading">
            {subheading}
          </p>
        )}
      </div>
    </section>
  );
};

export default MaskedHeading;
