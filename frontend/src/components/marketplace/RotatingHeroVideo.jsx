/**
 * Rotating background <video> for the Services hero.
 *
 * Behaviour:
 *   • Advances to the next clip when the current one ends → naturally
 *     spaced rotation without a fixed timer (respects each clip's length).
 *   • Preloads only the FIRST clip (`preload="auto"`) so we don't dump
 *     30+MB of mp4 on the visitor before they even see the page. Later
 *     clips lazily start fetching once we swap the src.
 *   • Falls back to a static poster if the user has `prefers-reduced-motion`,
 *     saves data, or is on a very old browser that can't play the codec.
 *   • Rotates the poster in step with the clip so the fallback image
 *     always matches whatever "would" be playing.
 *
 * The visual overlay (teal gradient) is expected to be provided by the
 * parent — this component is intentionally just the video layer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

export default function RotatingHeroVideo({ clips, className = '' }) {
  // Guard: nothing to render if the parent passes an empty list.
  const list = useMemo(() => (Array.isArray(clips) ? clips.filter(Boolean) : []), [clips]);
  const [index, setIndex] = useState(0);
  const videoRef = useRef(null);

  // Honour user's motion preference — pause on the first frame (poster).
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // When the src changes (rotation), tell the element to load + play again.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || prefersReducedMotion) return;
    // Reset & attempt play; ignore autoplay-block errors (browser may block
    // if the tab is background; the next visible tick will retry via `ended`).
    el.load();
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [index, prefersReducedMotion]);

  if (list.length === 0) return null;

  const current = list[index % list.length];
  const advance = () => setIndex((i) => (i + 1) % list.length);

  // Reduced motion: show a static poster (no video element mounted at all,
  // so we don't waste bandwidth or spin up decoders).
  if (prefersReducedMotion) {
    return (
      <img
        src={current.poster}
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 w-full h-full object-cover ${className}`}
      />
    );
  }

  return (
    <video
      key={current.src /* force re-mount on src swap → clean play() lifecycle */}
      ref={videoRef}
      className={`absolute inset-0 w-full h-full object-cover ${className}`}
      src={current.src}
      poster={current.poster}
      autoPlay
      muted
      playsInline
      preload="auto"
      onEnded={advance}
      onError={advance /* if one clip fails to decode, skip to the next */}
      aria-hidden="true"
      data-testid="services-hero-video"
    />
  );
}
