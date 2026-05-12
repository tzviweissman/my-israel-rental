import React, { useEffect, useState } from 'react';

/**
 * Cross-fades between background images on a fixed cadence.
 *
 * Implementation:
 *   - Each image is rendered as its own absolutely-positioned <div> stacked
 *     in the same container; transition opacity to swap.
 *   - The "active" index advances on a setInterval. The previous image stays
 *     painted at opacity-0 so the cross-fade has something to fade _from_.
 *   - Browser-native lazy-decoding via a hidden <img preload> in <link rel=
 *     "preload"> would be overkill — instead we paint all slides at mount,
 *     letting the browser cache them. By slide 2 they're already decoded.
 */
const HeroSlideshow = ({
  images,
  holdMs = 6000,
  fadeMs = 1500,
  className = '',
  children,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!images || images.length < 2) return undefined;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % images.length);
    }, holdMs + fadeMs);
    return () => clearInterval(id);
  }, [images, holdMs, fadeMs]);

  if (!images || images.length === 0) return null;

  return (
    <div className={`relative overflow-hidden ${className}`} data-testid="hero-slideshow">
      {images.map((src, i) => (
        <div
          key={src}
          aria-hidden={i !== activeIdx}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${src})`,
            opacity: i === activeIdx ? 1 : 0,
            transition: `opacity ${fadeMs}ms ease-in-out`,
            // Subtle Ken-Burns: each slide drifts slowly. Avoids feeling like a static cross-fade.
            transform: i === activeIdx ? 'scale(1.04)' : 'scale(1)',
            transitionProperty: 'opacity, transform',
            transitionDuration: `${fadeMs}ms, ${holdMs + fadeMs}ms`,
            transitionTimingFunction: 'ease-in-out, linear',
          }}
          data-testid={`hero-slide-${i}`}
        />
      ))}
      <div className="absolute inset-0 bg-black/30" />
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  );
};

export default HeroSlideshow;
