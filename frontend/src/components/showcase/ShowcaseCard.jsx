/**
 * One hand-built business page as a Mobbin-style tile: a soft grey tile with
 * a small looping preview of the page in it, the business's logo, name and
 * one line under it (Tzvi, 9 Oct 2026). Used by /showcase and by the strip at
 * the top of /businesses. The list is /showcase/showcase.json, each clip and
 * still is /showcase/<slug>.mp4 / .webp (scripts/showcase-preview.mjs).
 *
 * The tile is a plain link, a full load: the server answers /business/<slug>
 * with the hand-built page straight away.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function useShowcase() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/showcase/showcase.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => { if (!cancelled) setItems(Array.isArray(l) ? l : []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);
  return items;
}

// Small clips (~120 KB, 640 px), each fetched and started when its tile comes
// near the screen, so a tile is moving when it is seen, not a still (Tzvi, 9 Oct
// 2026), and a list of 100 pages never downloads 100 clips at once (18 Oct). Paused while off screen; never plays for reduced motion. v busts the
// year-long static cache when a clip is remade.
// Reduced motion is read before the first paint, so a clip never starts
// for a frame and then stops (UI audit, 10 Oct 2026).
const STILL = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Preview({ slug, v }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (STILL) return undefined;
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.play().catch(() => {}); else el.pause();
    }, { rootMargin: '200px 400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const q = v ? `?v=${v}` : '';
  return (
    <video ref={ref} className="sc-frame" src={`/showcase/${slug}.mp4${q}`} poster={`/showcase/${slug}.webp${q}`}
      muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
  );
}

function Mark({ item }) {
  if (item.logo) return <img className="sc-logo" src={`/showcase/${item.logo}`} alt="" width="48" height="48" loading="lazy" />;
  return (
    <span className="sc-logo sc-mark" style={{ background: item.markColor || 'var(--ink)', color: item.markInk || 'var(--surface)' }} aria-hidden="true">
      {item.mark || item.name.slice(0, 1)}
    </span>
  );
}

export default function ShowcaseCard({ item }) {
  const { i18n } = useTranslation();
  const he = (i18n.language || '').startsWith('he');
  return (
    // Named by its visible name and line, so screen readers and voice
    // control hear what is shown (UI audit, 10 Oct 2026).
    <a className="sc-card" href={`/business/${item.slug}`}>
      <div className="sc-tile"><Preview slug={item.slug} v={item.v} /></div>
      <div className="sc-meta">
        <Mark item={item} />
        <div className="sc-text">
          <span className="sc-name">{item.name}</span>
          <span className="sc-line">{(he && item.line_he) || item.line}</span>
        </div>
      </div>
    </a>
  );
}

export const SHOWCASE_CARD_CSS = `
.sc-card { display: block; color: inherit; text-decoration: none; border-radius: 28px; }
.sc-card:focus-visible { outline: 3px solid var(--gold); outline-offset: 4px; }
/* the soft tile, with the page sitting small inside it, as on Mobbin */
.sc-tile { background: var(--surface-muted); box-shadow: inset 0 0 0 1px var(--brand-border); border-radius: 28px; aspect-ratio: 4 / 3.3; display: grid; place-items: center; padding: 9%; transition: background 200ms ease-out; }
.sc-frame { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: top; border-radius: 8px; display: block; background: var(--surface);
  box-shadow: 0 1px 2px rgb(17 24 39 / .06), 0 12px 28px -12px rgb(17 24 39 / .22); transition: transform 300ms cubic-bezier(.2,.7,.2,1); }
@media (hover: hover) {
  .sc-card:hover .sc-tile { background: var(--surface); }
  .sc-card:hover .sc-frame { transform: translateY(-4px); }
}
.sc-meta { display: flex; align-items: center; gap: 14px; margin-top: 16px; }
.sc-logo { width: 48px; height: 48px; border-radius: 12px; flex: none; object-fit: cover; border: 1px solid var(--brand-border); }
.sc-mark { display: grid; place-items: center; font-weight: 800; font-size: 1rem; letter-spacing: .02em; border: 0; }
.sc-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sc-name { font-weight: 700; font-size: 1.05rem; color: var(--ink); }
.sc-line { font-size: .95rem; color: var(--brand-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 640px) { .sc-tile { border-radius: 22px; } }
`;
