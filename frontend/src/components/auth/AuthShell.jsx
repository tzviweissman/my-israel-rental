/**
 * The frame every sign-in page shares (sign up and log in): one plain white
 * card in the middle of a light grey page, over a tilted wall of real
 * business sites built on MyIsraelRental (Tzvi, 16 Nov 2026: "i like wix the
 * best", then chose the tilted wall of four Wix-like backgrounds). The wall
 * shows shops, never places, so it stays right when the site opens in
 * America; change SITES below for other businesses.
 *
 * The wall fades out around the card so the middle stays calm, drifts very
 * slowly, and stands still for anyone who asked for reduced motion. It is
 * decoration only: aria-hidden, no pointer events, lazy pictures.
 *
 * The card centres with auto margins, not justify-center: a flex column
 * centred that way clips its top out of reach once it overflows, and step 2
 * of sign-up is a long form that simply scrolls the page.
 */
import React, { useEffect, useRef, useState } from 'react';
import './authWall.css';

// Each tile is that business's showcase picture, the same clip and still as its
// card on /businesses (made by scripts/showcase-preview.mjs; its `still_at` picks
// the best moment of the opening). `v` matches showcase.json so a remade clip
// reaches the wall too. Tzvi, 16 Nov 2026: "show the best part of the wow moment
// or have the business tiles move like our business page".
const SITES = [
  ['the-brown-box', 16], ['blazin-boards', 16], ['m-and-n-jewelry', 3], ['ls-fruit-platter', 17],
  ['gremier-coffee', 4], ['the-gift-boutique', 17], ['american-crust', 12], ['michal-balloons', 12],
  ['bake-away', 8], ['gifted-israel', 5], ['chicken-munch', 27], ['finest-cut', 4],
];
const WALL = Array.from({ length: 20 }, (_, i) => SITES[i % SITES.length]);
// Six tiles in the outer columns, where the fade leaves them seen, six different
// businesses. Only these ever play, and only on a laptop: about 1.5 MB in all.
const MOVING = new Set([4, 7, 8, 11, 12, 15]);

/** Plays the six clips after the page has loaded, one by one, so the sign-up
 *  card always paints first. A phone, reduced motion or data saver: stills only,
 *  no video element at all, so no clip is ever fetched. */
function useWallMotion() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const ok = window.matchMedia?.('(min-width: 1024px) and (prefers-reduced-motion: no-preference)').matches
      && !navigator.connection?.saveData;
    if (!ok) return undefined;
    const go = () => setOn(true);
    if (document.readyState === 'complete') { const t = setTimeout(go, 300); return () => clearTimeout(t); }
    window.addEventListener('load', go, { once: true });
    return () => window.removeEventListener('load', go);
  }, []);
  return on;
}

function WallClip({ slug, v, delay }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const t = setTimeout(() => el?.play().catch(() => {}), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <video ref={ref} src={`/showcase/${slug}.mp4?v=${v}`} poster={`/showcase/${slug}.webp?v=${v}`}
      muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
  );
}

// `below`: a second white card under the form, the same width (sign-up puts the work stream there; Tzvi, 16 Nov 2026).
export default function AuthShell({ children, testId, below = null }) {
  const moving = useWallMotion();
  let n = 0;
  return (
    <div
      className="auth-wall min-h-screen relative [overflow-x:clip] flex flex-col"
      style={{ background: '#F3F4F6' }}
      data-testid={testId}
    >
      <div className="auth-wall-layer" aria-hidden="true">
        <div className="auth-wall-grid">
          {WALL.map(([slug, v], i) => (moving && MOVING.has(i)
            ? <WallClip key={i} slug={slug} v={v} delay={(n++) * 400} />
            : <img key={i} src={`/showcase/${slug}.webp?v=${v}`} alt="" decoding="async" />))}
        </div>
      </div>
      <div className="relative flex flex-1 px-4 pb-6" style={{ paddingTop: 'calc(var(--nav-h, 68px) + 24px)' }}>
        <div className="w-full max-w-[26rem] m-auto">
          <div
            className="bg-white rounded-md px-6 py-7 sm:px-8 sm:py-8"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}
            data-testid="auth-card"
          >
            {children}
          </div>
          {below && (
            <div className="mt-4 bg-white rounded-md p-4 sm:p-5" style={{ boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
              {below}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// The fields and the action, shared so the pages cannot drift apart.
export const authInput = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20';
export const authLabel = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5';
export const authButton = 'w-full inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-bold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed';
// The theme's black action with a white label.
export const authButtonStyle = { background: 'var(--action, #000)', color: 'var(--action-ink, #fff)' };
