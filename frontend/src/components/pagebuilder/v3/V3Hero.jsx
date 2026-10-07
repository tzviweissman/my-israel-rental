/**
 * Page builder v3, phase 1: the hero, drawn from the business's design brief.
 *
 * docs/page-builder-design-rules.md (v3). The brief is built by rules from
 * the business's own record (backend/utils/design_brief.py) and arrives in
 * the page payload only when PAGE_BUILDER_V3_ENABLED is on AND an admin
 * switched this business on. Tier 1 is their best real photo (phase 2's
 * flyer check: a flyer is never a hero, rule 4), tier 2 their brand film,
 * tier 3 the typographic brand panel: the wordmark at hero scale on the
 * brand ground, with the preset's texture.
 *
 * Everything in it is the business's own: the name, one of their sentences
 * word for word, their real lowest price, their certificate, their areas.
 * The button opens the chat (chat-only, Tzvi 5 Oct 2026).
 *
 * Colour and type arrive as CSS custom properties scoped to this section
 * (styles/page-v3.css), so nothing here hardcodes a colour or a face, and
 * the section does not inherit the platform's theme.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play } from 'lucide-react';

import ProofLine from '../../marketplace/ProofLine';
import '../../../styles/page-v3.css';
// After page-v3.css: the effects build on its rules.
import '../../../styles/page-v3-motion.css';
import { Words, engineAttrs, fxFor, hasFx, parallaxAttrs } from './effects';

// Mirrors FONT_ALLOWLIST in backend/utils/design_brief.py. A face that is
// not here is never requested, whatever a stored brief says.
const ALLOWED = new Set([
  'Oswald', 'Pinyon Script', 'Figtree', 'Bricolage Grotesque', 'DM Sans',
  'Cormorant Garamond', 'Manrope', 'Archivo', 'Anton', 'Work Sans',
  'Barlow Condensed', 'Barlow',
]);

/** One Google Fonts request for exactly the brief's faces, display=swap. */
export function fontsHref(type) {
  const fam = [];
  const add = (face, weights) => {
    if (face && ALLOWED.has(face)) fam.push(`family=${face.replace(/ /g, '+')}${weights ? `:wght@${weights}` : ''}`);
  };
  add(type.display, [...new Set([type.display_weight || 400, 400])].sort((a, b) => a - b).join(';'));
  if (type.body !== type.display) add(type.body, '400;600');
  if (type.accent) add(type.accent, null);
  return fam.length ? `https://fonts.googleapis.com/css2?${fam.join('&')}&display=swap` : null;
}

function useFonts(href) {
  useEffect(() => {
    if (!href || document.querySelector(`link[data-pv3-fonts="${href}"]`)) return undefined;
    const pre = document.createElement('link');
    pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com'; pre.crossOrigin = 'anonymous';
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.dataset.pv3Fonts = href;
    document.head.append(pre, link);
    return undefined;
  }, [href]);
}

/** The brief's palette and faces as the section's custom properties. */
export function themeVars(brief) {
  const p = brief.palette || {};
  const ty = brief.type || {};
  // Each stack ends in the Hebrew face, so Hebrew letters (which none of the
  // preset faces have) fall back to Frank Ruhl Libre / Assistant per glyph.
  const stack = (face, he, generic) => `${face ? `"${face}", ` : ''}${he}, ${generic}`;
  return {
    '--ground': p.ground, '--text': p.text, '--muted': p.muted, '--accent': p.accent,
    '--surface': p.surface, '--rule': p.rule, '--on-accent': p.on_accent,
    '--display': stack(ty.display, "'Frank Ruhl Libre'", 'serif'),
    '--body': stack(ty.body, "'Assistant'", 'system-ui, sans-serif'),
    '--script': stack(ty.accent, "'Frank Ruhl Libre'", 'cursive'),
    '--display-weight': ty.display_weight || 400,
    '--display-tracking': ty.tracking || '0em',
  };
}

/** "L.A. Cholent by Rabbi Samuels" -> wordmark "L.A. Cholent", script
 *  "by Rabbi Samuels". Their own words, only split. */
export function splitName(name) {
  const m = /^(.{2,}?)\s+(by\s+.+)$/i.exec(name || '');
  return m ? { wordmark: m[1], script: m[2] } : { wordmark: name || '', script: null };
}

/** The primary action's words, the same in the hero, the offer and the
 *  phone bar (rule 5b.2: one wording per purpose). Verb and object. */
export function primaryLabel(brief, t) {
  const kind = brief?.primary_action?.kind || 'message';
  const food = brief?.category === 'food' || brief?.category === 'restaurants';
  if (kind === 'order') return t('pageV3.ctaOrder', 'Place an order');
  if (kind === 'book') return t('pageV3.ctaBook', 'Book a time');
  return food ? t('pageV3.ctaMessageOrder', 'Message to order') : t('pageV3.ctaMessage', 'Send a message');
}

/** Tier 2 (rules, part 4): their brand film, muted, looping, with a poster
 *  and a pause button. The browser's own autoplay starts it (a play() call
 *  from an effect gets aborted by the first load); reduced motion leaves it
 *  on the poster. The button follows the video's real state. */
function Film({ film, scrub = false }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const still = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = () => {
    const v = ref.current;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  // Effect scrub-film: scroll drives the film instead of time. The engine
  // fetches it, so it has no src of its own; the poster is a picture of its
  // own that stays up until a real frame has painted, and for good with
  // reduced motion, when the film is never fetched at all.
  if (scrub) {
    return (
      <div className="pv3-film-box">
        {film.poster_url && <img className="pv3-film sc-stage__poster" src={film.poster_url} alt="" aria-hidden="true" />}
        <video className="pv3-film" data-sc-scrub="" data-sc-src={film.url} muted playsInline preload="none"
          aria-hidden="true" data-testid="pv3-film" />
        <div className="pv3-scrim" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="pv3-film-box">
      <video ref={ref} className="pv3-film" src={film.url} poster={film.poster_url || undefined}
        muted loop playsInline autoPlay={!still} preload="auto" aria-hidden="true" data-testid="pv3-film"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <div className="pv3-scrim" aria-hidden="true" />
      <button type="button" className="pv3-film-toggle" onClick={toggle} data-testid="pv3-film-toggle"
        aria-label={playing ? t('pageV3.pauseFilm', 'Pause the film') : t('pageV3.playFilm', 'Play the film')}>
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Dots in the wordmark take the accent (rules appendix: "gold dots").
 *  With the letters effect each letter is its own numbered span; spaces
 *  stay plain text so the name still wraps and copies as before. */
const Wordmark = ({ text, letters = false }) => {
  let n = 0;
  return (
    <>
      {Array.from(text).map((ch, i) => {
        if (letters && ch.trim()) {
          // eslint-disable-next-line react/no-array-index-key
          return <span key={i} className={ch === '.' ? 'pv3-c pv3-dot' : 'pv3-c'} style={{ '--i': n++ }}>{ch}</span>;
        }
        // eslint-disable-next-line react/no-array-index-key
        return ch === '.' ? <span key={i} className="pv3-dot">.</span> : ch;
      })}
    </>
  );
};

export default function V3Hero({ brief, name, logoUrl, photoUrl, film, priceText, areaText, kosherBody, proof, onPrimary, children }) {
  const { t, i18n } = useTranslation();
  const he = (i18n.language || '').startsWith('he');
  useFonts(fontsHref((brief && brief.type) || {}));
  if (!brief || !brief.palette) return null;

  // A Hebrew name is shown whole; a Latin one splits the same in both languages.
  const { wordmark, script } = /[֐-׿]/.test(name || '') ? { wordmark: name, script: null } : splitName(name);
  const tagline = (brief.taglines || []).find((x) => x.lang === (he ? 'he' : 'en'));
  const label = primaryLabel(brief, t);

  // At most three facts, and each only if the record has it (rule 1).
  const facts = [
    priceText && { key: 'price', label: t('pageV3.from', 'From'), text: priceText, ltr: true },
    kosherBody && { key: 'kosher', text: t('pageV3.kosher', { defaultValue: 'Kosher · {{body}}', body: kosherBody }) },
    areaText && { key: 'area', text: areaText },
  ].filter(Boolean).slice(0, 3);

  // Tier 1 only with a picture the flyer check passed as a photo (the API
  // refuses a brief that names anything else), tier 2 with their brand film;
  // otherwise the typographic panel.
  const tier = (brief.hero?.tier === 1 && photoUrl && 1) || (brief.hero?.tier === 2 && film?.url && 2) || 3;
  // A pinned hero (pin-hero-hold, pin-hero-pushin, scrub-film): the hero is
  // the stage of an act around it, so it holds while the act scrolls by.
  const pin = (hasFx(brief, 'pin-hero-hold') && 'hold')
    || (tier === 1 && hasFx(brief, 'pin-hero-pushin') && 'pushin')
    || (tier === 2 && hasFx(brief, 'scrub-film') && 'film') || null;

  const hero = (
    <section
      className="pv3-hero"
      data-page-v3=""
      data-preset={brief.preset}
      data-texture={brief.texture}
      data-tier={tier}
      data-caps={brief.type?.caps ? 'true' : 'false'}
      data-fx={fxFor(brief, 'hero')}
      style={themeVars(brief)}
      data-testid="pv3-hero"
      {...(pin ? { 'data-sc-stage': '' } : engineAttrs(brief, 'hero'))}
    >
      {tier === 1 && (
        <>
          {/* Their photo, graded to the page (rule 4: one grade for every
              photo on the page), with a scrim behind the copy only. */}
          <img className="pv3-photo" src={photoUrl} alt="" aria-hidden="true" data-testid="pv3-photo" {...parallaxAttrs(brief, 'parallax-hero')} />
          <div className="pv3-scrim" aria-hidden="true" />
        </>
      )}
      {tier === 2 && <Film film={film} scrub={pin === 'film'} />}
      <div className="pv3-texture" aria-hidden="true" />
      <div className="pv3-hero-inner">
        {logoUrl && <img className="pv3-logo" src={logoUrl} alt="" aria-hidden="true" />}
        {script && <p className="pv3-script" data-testid="pv3-script">{script}</p>}
        <h1 className="pv3-wordmark" data-testid="pv3-wordmark">
          {hasFx(brief, 'kinetic-words-headline')
            ? <Words text={wordmark} render={(w) => <Wordmark text={w} />} />
            : <Wordmark text={wordmark} letters={hasFx(brief, 'kinetic-chars-wordmark')} />}
        </h1>
        {tagline && (
          <p className="pv3-tagline" data-testid="pv3-tagline">
            {hasFx(brief, 'kinetic-words-tagline') ? <Words text={tagline.text} /> : tagline.text}
          </p>
        )}
        <div className="pv3-actions">
          {/* The magnet is on this one button only: the page's primary action. */}
          <button type="button" className="pv3-btn" onClick={onPrimary} data-testid="pv3-primary"
            data-sc-magnet={hasFx(brief, 'btn-magnet') ? '0.25' : undefined}>{label}</button>
          {/* The proof beside the button (ruling 5). Kosher is in the fact
              strip just below, so it is not said twice above the fold. */}
          <ProofLine {...proof} kosher={null} className="pv3-proof" testid="pv3-proof" />
        </div>
        {facts.length > 0 && (
          <ul className="pv3-facts" data-testid="pv3-facts">
            {facts.map((f) => (
              // Prices stay left-to-right inside Hebrew (rule 1.6).
              <li key={f.key}>{f.label ? <span>{f.label}</span> : null}{f.ltr ? <span dir="ltr" className="pv3-num">{f.text}</span> : f.text}</li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </section>
  );
  if (!pin) return hero;
  return (
    <div className="pv3-hero-pin" data-page-v3="" data-pin={pin} {...engineAttrs(brief, 'hero')}
      data-sc-act="pin" data-sc-span={pin === 'film' ? '2.6' : '1.6'}>
      {hero}
    </div>
  );
}
