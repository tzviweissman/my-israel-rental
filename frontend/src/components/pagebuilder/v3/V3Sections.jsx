/**
 * Page builder v3, phase 4: the sections (docs/page-builder-design-rules.md,
 * parts 5 to 7). Each takes its data from the design brief and the business
 * record, and each returns nothing when that data is missing, so an empty
 * section never draws (rule 1: hide it, put it on the owner's checklist).
 *
 *   V3BigList   their occasions, as big type with accent dots   (quiet)
 *   V3Steps     their steps, numbered, only when they wrote them (set piece)
 *   V3Palate    one of their photos, full width, no text          (quiet)
 *   V3Offer     price, what's included, the button               (set piece)
 *   V3StickyBar the phone bar: after the hero button, before the offer
 *
 * Chat-only (Tzvi, 5 Oct 2026): the offer block's copyable line is the page's
 * own address, never a phone number or email. Everything sits in the brief's
 * custom properties (themeVars), logical properties only.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { themeVars } from './V3Hero';
import { fxFor, hasFx } from './effects';

const Section = ({ brief, kind, testid, children }) => (
  <section className={`pv3-section pv3-${kind}`} data-page-v3="" data-preset={brief.preset}
    data-caps={brief.type?.caps ? 'true' : 'false'} data-fx={fxFor(brief, kind)} style={themeVars(brief)}
    data-testid={testid}>
    <div className="pv3-section-inner">{children}</div>
  </section>
);

/** Rule 5: "an occasion list set as large display text separated by accent
 *  dots works better than small chips". Each item stays on one line. */
export function V3BigList({ brief, lang }) {
  const { t } = useTranslation();
  const items = ((brief && brief.occasions) || []).filter((x) => x.lang === lang);
  if (!brief || items.length < 3) return null;
  return (
    <Section brief={brief} kind="biglist" testid="pv3-biglist">
      <p className="pv3-label">{t('pageV3.occasions', 'For')}</p>
      <ul className="pv3-biglist-items">
        {items.map((x, i) => <li key={x.text} style={{ '--i': i }}>{x.text}</li>)}
      </ul>
    </Section>
  );
}

/** Numbered, because the order matters; only their own steps. */
export function V3Steps({ brief, lang }) {
  const { t } = useTranslation();
  const steps = ((brief && brief.steps) || []).filter((x) => x.lang === lang);
  if (!brief || steps.length < 2) return null;
  return (
    <Section brief={brief} kind="steps" testid="pv3-steps">
      <h2 className="pv3-h2">{t('pageV3.howItWorks', 'How it works')}</h2>
      <ol className="pv3-steps-list">
        {steps.map((s, i) => (
          <li key={s.text} style={{ '--i': i }}><span className="pv3-step-n pv3-num" dir="ltr">{String(i + 1).padStart(2, '0')}</span><span>{s.text}</span></li>
        ))}
      </ol>
    </Section>
  );
}

/** One full-width photo between two copy sections, no text (rule 5). */
export function V3Palate({ brief, url }) {
  if (!brief || !url) return null;
  return (
    <div className="pv3-palate" data-page-v3="" data-preset={brief.preset} data-fx={fxFor(brief, 'palate')}
      style={themeVars(brief)} aria-hidden="true" data-testid="pv3-palate">
      <img className="pv3-photo" src={url} alt="" loading="lazy" />
    </div>
  );
}

/** The price counting up to itself once it is seen (effect count-price).
 *  It shows the real price at rest and on every path that is not a clean
 *  count: no observer, reduced motion, a number it cannot read. It only
 *  drops to zero at the moment it is seen, and runs straight back up. */
function CountUp({ value, on }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    const target = Number(String(value).replace(/,/g, ''));
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!on || !el || !Number.isFinite(target) || target <= 0 || still || typeof IntersectionObserver === 'undefined') {
      setShown(value);
      return undefined;
    }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 1200);
        setShown(k < 1 ? Math.round(target * (1 - (1 - k) ** 3)).toLocaleString('en-US') : value);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [on, value]);
  return <span ref={ref}>{shown}</span>;
}

/** "Copy" turns to "Copied" for 1.5s; without the clipboard, the text is
 *  selected so it can be copied by hand (rule 6). */
function CopyRow({ label, value }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const r = document.createRange();
      r.selectNodeContents(ref.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };
  return (
    <div className="pv3-spec-row pv3-copy-row">
      <dt>{label}</dt>
      <dd>
        <span ref={ref} dir="ltr" className="pv3-copy-value">{value}</span>
        <button type="button" className="pv3-copy-btn" onClick={copy} data-testid="pv3-copy">
          {copied ? t('pageV3.copied', 'Copied') : t('pageV3.copy', 'Copy')}
        </button>
      </dd>
    </div>
  );
}

/** End on the offer (rule 5): price, what's included, supervision, where,
 *  the button. Every row is a field on the record; a missing one is left out. */
export function V3Offer({ brief, rows, priceText, priceIsFrom, title, label, onPrimary, pageUrl, listingLinks, offerRef }) {
  const { t } = useTranslation();
  if (!brief || (!priceText && !(rows && rows.length))) return null;
  return (
    <Section brief={brief} kind="offer" testid="pv3-offer">
      <div ref={offerRef} className="pv3-offer-grid">
        <div>
          <p className="pv3-label">{t('pageV3.theOffer', 'The offer')}</p>
          {title && <h2 className="pv3-h2">{title}</h2>}
          {priceText && (
            <p className="pv3-price">
              {priceIsFrom && <span className="pv3-price-unit">{t('pageV3.from', 'From')}</span>}
              {/* The currency sign smaller than the numerals, as menus set it. */}
              <span className="pv3-num" dir="ltr">
                {(/^(\D+)(.*)$/.exec(priceText) || [null, '', priceText]).slice(1).map((part, n) => (
                  // eslint-disable-next-line react/no-array-index-key
                  part ? (
                    <span key={n} className={n === 0 ? 'pv3-price-sym' : undefined}>
                      {n === 1 ? <CountUp value={part} on={hasFx(brief, 'count-price')} /> : part}
                    </span>
                  ) : null))}
              </span>
            </p>
          )}
          <button type="button" className="pv3-btn" onClick={onPrimary} data-testid="pv3-offer-primary">{label}</button>
        </div>
        <dl className="pv3-spec">
          {(rows || []).map((r) => (
            <div key={r.key} className="pv3-spec-row">
              <dt className={r.plain ? 'pv3-dt-plain' : undefined}>{r.label}</dt>
              <dd>{r.ltr ? <span dir="ltr" className="pv3-num">{r.value}</span> : r.value}</dd>
            </div>
          ))}
          {pageUrl && <CopyRow label={t('pageV3.pageAddress', 'This page')} value={pageUrl} />}
        </dl>
      </div>
      {listingLinks && listingLinks.length > 0 && (
        <p className="pv3-listing-links">
          {listingLinks.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
        </p>
      )}
    </Section>
  );
}

/**
 * The phone bar (rule 6): slides up once the hero button has scrolled away,
 * hides while the offer block is on screen. Phones only (CSS). Hidden is its
 * starting state, which is not content waiting on an observer: the same
 * button is in the hero above it.
 */
export function V3StickyBar({ brief, label, priceText, onPrimary, heroSelector, offerRef }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.querySelector(heroSelector);
    const offer = offerRef && offerRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return undefined;
    const state = { heroGone: false, offerOn: false };
    const update = () => setShow(state.heroGone && !state.offerOn);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.target === hero) state.heroGone = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === offer) state.offerOn = e.isIntersecting;
      });
      update();
    });
    io.observe(hero);
    if (offer) io.observe(offer);
    return () => io.disconnect();
  }, [heroSelector, offerRef]);
  if (!brief) return null;
  return (
    <div className={`pv3-sticky${show ? ' is-on' : ''}`} data-page-v3="" data-preset={brief.preset} data-fx={fxFor(brief, 'button')}
      style={themeVars(brief)} aria-hidden={show ? undefined : 'true'} data-testid="pv3-sticky">
      {priceText && <span className="pv3-sticky-price pv3-num" dir="ltr">{priceText}</span>}
      <button type="button" className="pv3-btn" onClick={onPrimary} tabIndex={show ? 0 : -1} data-testid="pv3-sticky-primary">{label}</button>
    </div>
  );
}
