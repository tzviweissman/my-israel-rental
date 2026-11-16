/**
 * The frame every sign-in page shares (sign up and log in): one plain white
 * card in the middle of a light grey page, over a tilted wall of real
 * business sites built on MyIsraelRental (Tzvi, 16 Nov 2026: "i like wix the
 * best", then chose the tilted wall of four Wix-like backgrounds). The wall
 * shows shops, never places, so it stays right when the site opens in
 * America; swap the pictures in /public/signup-wall/ for other businesses.
 *
 * The wall fades out around the card so the middle stays calm, drifts very
 * slowly, and stands still for anyone who asked for reduced motion. It is
 * decoration only: aria-hidden, no pointer events, lazy pictures.
 *
 * The card centres with auto margins, not justify-center: a flex column
 * centred that way clips its top out of reach once it overflows, and step 2
 * of sign-up is a long form that simply scrolls the page.
 */
import React from 'react';
import './authWall.css';

const WALL = Array.from({ length: 20 }, (_, i) => `/signup-wall/${(i % 12) + 1}.jpg`);

export default function AuthShell({ children, testId }) {
  return (
    <div
      className="auth-wall min-h-screen relative [overflow-x:clip] flex flex-col"
      style={{ background: '#F3F4F6' }}
      data-testid={testId}
    >
      <div className="auth-wall-layer" aria-hidden="true">
        <div className="auth-wall-grid">
          {WALL.map((src, i) => <img key={i} src={src} alt="" loading="lazy" decoding="async" />)}
        </div>
      </div>
      <div className="relative flex flex-1 px-4 pb-6" style={{ paddingTop: 'calc(var(--nav-h, 68px) + 24px)' }}>
        <div
          className="w-full max-w-[26rem] m-auto bg-white rounded-md px-6 py-7 sm:px-8 sm:py-8"
          style={{ boxShadow: '0 2px 24px rgba(17,24,39,.14)' }}
          data-testid="auth-card"
        >
          {children}
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
