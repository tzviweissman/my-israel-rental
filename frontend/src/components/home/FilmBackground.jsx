import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * The film behind the preview page's hero: a generated loop of glass
 * blocks that build, burst and resolve into a skyline of gold glass.
 *
 * Two renders, landscape and portrait, chosen by the viewport's shape on
 * mount (and again if it changes), because a landscape clip cropped to a
 * phone would put the build off the sides. `key` on the orientation makes
 * React remount the <video> so the browser actually loads the other file:
 * changing a <source> under a playing video does nothing.
 *
 * Reduced motion gets the poster and no playback. The poster is the loop's
 * first frame, so there is no jump when the clip paints over it.
 *
 * The files live in public/videos/preview-hero/. They are muted, have no
 * audio track at all, and carry `playsInline`, which together are what iOS
 * needs before it will autoplay anything.
 */
const SOURCES = {
  landscape: { src: '/videos/preview-hero/hero-16x9.mp4', poster: '/videos/preview-hero/hero-16x9.jpg' },
  portrait: { src: '/videos/preview-hero/hero-9x16.mp4', poster: '/videos/preview-hero/hero-9x16.jpg' },
};

function orientationNow() {
  if (typeof window === 'undefined') return 'landscape';
  return window.matchMedia('(max-aspect-ratio: 4/5)').matches ? 'portrait' : 'landscape';
}

export default function FilmBackground({ className = 'hv2-film' }) {
  const [orientation, setOrientation] = useState(orientationNow);
  const [still, setStill] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  const ref = useRef(null);

  useEffect(() => {
    const shape = window.matchMedia('(max-aspect-ratio: 4/5)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onShape = () => setOrientation(shape.matches ? 'portrait' : 'landscape');
    const onMotion = () => setStill(motion.matches);
    shape.addEventListener('change', onShape);
    motion.addEventListener('change', onMotion);
    return () => { shape.removeEventListener('change', onShape); motion.removeEventListener('change', onMotion); };
  }, []);

  // Autoplay can be refused (Low Power Mode, data saver). The poster is
  // already showing, so a refusal is silent; nothing to catch but the
  // promise itself.
  useEffect(() => {
    const el = ref.current;
    if (!el || still) return;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [orientation, still]);

  const source = useMemo(() => SOURCES[orientation], [orientation]);

  if (still) {
    return <img className={className} src={source.poster} alt="" aria-hidden="true" data-testid="home-preview-film-still" />;
  }
  return (
    <video
      key={orientation}
      ref={ref}
      className={className}
      src={source.src}
      poster={source.poster}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      aria-hidden="true"
      data-testid="home-preview-film"
    />
  );
}
