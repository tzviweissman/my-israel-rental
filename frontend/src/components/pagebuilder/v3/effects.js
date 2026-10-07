/**
 * Page builder v3: the effects a generated page carries (Tzvi, 6 Oct 2026).
 *
 * The brief lists them (backend/utils/page_effects.py chooses; this file is
 * its mirror, and backend/tests/test_page_effects.py fails if the two sets
 * of ids ever disagree). Each section carries its own effects plus the
 * page-wide and button ones as a space-separated `data-fx`, and
 * styles/page-v3-motion.css does the rest by `[data-fx~="id"]`.
 *
 * Nothing here hides content by itself: a section is only held back for its
 * entrance once this module has marked the page `fx-ready` and is watching
 * it, so with no script, or reduced motion, everything is simply there.
 */
import { useEffect } from 'react';
import '../../../styles/page-v3-engine.css';

// id: [slot, engine]. Slots mirror page_effects.SLOTS.
export const EFFECTS = {
  'pin-hero-hold': ['hero', true],
  'pin-hero-pushin': ['hero', true],
  'scrub-film': ['hero', true],
  'rail-gallery': ['rail', true],
  'rail-occasions': ['biglist', true],
  'rail-steps': ['steps', true],
  'stack-steps': ['steps', true],
  'pin-offer-count': ['offer', true],
  'parallax-hero': ['hero', true],
  'parallax-palate': ['palate', true],
  'drift-ground': ['page', true],
  'progress-hairline': ['page', true],
  'load-sequence-hero': ['hero', false],
  'kinetic-words-headline': ['hero', false],
  'kinetic-words-tagline': ['hero', false],
  'kinetic-chars-wordmark': ['hero', false],
  'wipe-up-sections': ['page', false],
  'fade-rise-sections': ['page', false],
  'wipe-side-photos': ['palate', false],
  'iris-palate': ['palate', false],
  'stagger-biglist': ['biglist', false],
  'stagger-steps': ['steps', false],
  'count-price': ['offer', false],
  'hairline-draw': ['page', false],
  'logo-settle': ['hero', false],
  'btn-fill-wipe': ['button', false],
  'btn-arrow-nudge': ['button', false],
  'btn-invert': ['button', false],
  'btn-press': ['button', false],
  'btn-magnet': ['button', true],
  'link-underline-grow': ['page', false],
  'card-tilt-offer': ['offer', true],
  'spotlight-offer': ['offer', true],
  'photo-hover-zoom': ['palate', false],
  'rule-brighten': ['offer', false],
  'scrim-lead': ['hero', false],
  'scrim-band': ['hero', false],
  'scrim-vignette': ['hero', false],
  'ground-split-hero': ['hero', false],
  'hero-split': ['hero', false],
  'hero-split-narrow': ['hero', false],
  'hero-center-stack': ['hero', false],
  'subject-bleed': ['hero', false],
  'tagline-pullquote': ['hero', false],
  'oversize-numerals': ['page', false],
  'label-small-caps': ['page', false],
  'duotone-photos': ['page', false],
  'contrast-photos': ['page', false],
  'rules-double': ['page', false],
  'palate-offset': ['palate', false],
  'palate-mat': ['palate', false],
  'corners-sharp': ['page', false],
  'corners-soft': ['page', false],
};

const known = (brief) => ((brief && brief.effects) || []).filter((id) => EFFECTS[id]);

/** The brief's effects that a section of this kind carries: its own, plus
 *  the page-wide and button ones, which every section shares. */
export function fxFor(brief, slot) {
  return known(brief)
    .filter((id) => {
      const s = EFFECTS[id][0];
      return s === slot || s === 'page' || s === 'button';
    })
    .join(' ') || undefined;
}

export const hasFx = (brief, id) => known(brief).includes(id);

/** Whether this page needs the scroll engine at all. */
export const needsEngine = (brief) => known(brief).some((id) => EFFECTS[id][1]);

/** Marks the page ready for entrances and reveals each v3 block once it
 *  comes into view. Without IntersectionObserver nothing is marked, so
 *  nothing is ever held back. */
export function useFx(on) {
  useEffect(() => {
    if (!on || typeof IntersectionObserver === 'undefined') return undefined;
    const root = document.documentElement;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('[data-page-v3][data-fx]').forEach((el) => io.observe(el));
    root.classList.add('fx-ready');
    return () => {
      io.disconnect();
      root.classList.remove('fx-ready');
    };
  }, [on]);
}

/** The scroll engine, for the effects that need it (pins, rails, parallax,
 *  the scrubbed film, pointer touches). Fetched only when the page has one,
 *  and torn down with the page: the engine's listeners are on window, which
 *  outlives every page in a single-page app. */
export function useScrollcraft(on) {
  useEffect(() => {
    if (!on) return undefined;
    let api = null;
    let gone = false;
    import('../../../vendor/scrollcraft').then(() => {
      if (!gone && window.ScrollCraft) api = window.ScrollCraft.mount(document);
    });
    return () => {
      gone = true;
      if (api) api.destroy();
    };
  }, [on]);
}

/** Their words, kept whole: each word in its own span, numbered for the
 *  stagger, with the space between them kept as text so wrapping and
 *  copying behave as before. */
export function Words({ text, render = (w) => w }) {
  const parts = String(text || '').split(/(\s+)/);
  let n = 0;
  return parts.map((p, i) => (/^\s+$/.test(p) || !p
    ? p
    // eslint-disable-next-line react/no-array-index-key
    : <span key={i} className="pv3-w" style={{ '--i': n++ }}>{render(p)}</span>));
}
