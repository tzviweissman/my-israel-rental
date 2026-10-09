/**
 * Business pages: the hand-built pages, shown the way Mobbin shows sites
 * (Tzvi, 9 Oct 2026, from a recording of mobbin.com/discover/sites): a grid
 * of soft tiles, each holding a small live preview of the page, playing on a
 * loop, with the business's logo, name and one line under it. A tile opens
 * the page itself.
 *
 * The list is /showcase/showcase.json, next to each page's preview clip
 * (<slug>.mp4) and still (<slug>.webp); scripts/showcase-preview.mjs makes
 * both. Only real pages of real businesses on the site are listed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageMeta from '../components/PageMeta';

function Preview({ slug, name }) {
  const ref = useRef(null);
  // Plays only while on screen, and never for reduced motion (the still shows).
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (!('IntersectionObserver' in window)) { v.play().catch(() => {}); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      className="sc-frame"
      src={`/showcase/${slug}.mp4`}
      poster={`/showcase/${slug}.webp`}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={name}
    />
  );
}

function Mark({ item }) {
  if (item.logo) return <img className="sc-logo" src={`/showcase/${item.logo}`} alt="" width="48" height="48" loading="lazy" />;
  return (
    <span className="sc-logo sc-mark" style={{ background: item.markColor || 'var(--ink)', color: item.markInk || '#fff' }} aria-hidden="true">
      {item.mark || item.name.slice(0, 1)}
    </span>
  );
}

export default function Showcase() {
  const { t, i18n } = useTranslation();
  const he = (i18n.language || '').startsWith('he');
  const [items, setItems] = useState(null);

  useEffect(() => {
    fetch('/showcase/showcase.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => setItems(Array.isArray(l) ? l : []))
      .catch(() => setItems([]));
  }, []);

  return (
    <main className="sc-page">
      <PageMeta
        title={t('showcase.metaTitle', 'Business pages | MyIsraelRental')}
        description={t('showcase.intro', 'Pages built for businesses listed on MyIsraelRental. Open one to see it the way their customers do.')}
        path="/showcase"
      />
      <style>{CSS}</style>
      <header className="sc-head">
        <h1 style={{ fontFamily: 'var(--font-head)' }}>{t('showcase.title', 'Business pages')}</h1>
        <p>{t('showcase.intro', 'Pages built for businesses listed on MyIsraelRental. Open one to see it the way their customers do.')}</p>
      </header>

      <ul className="sc-grid">
        {(items || []).map((item) => (
          <li key={item.slug}>
            <a className="sc-card" href={`/business/${item.slug}`} aria-label={t('showcase.open', 'Open the page of {{name}}', { name: item.name })}>
              <div className="sc-tile"><Preview slug={item.slug} name={item.name} /></div>
              <div className="sc-meta">
                <Mark item={item} />
                <div className="sc-text">
                  <span className="sc-name">{item.name}</span>
                  <span className="sc-line">{(he && item.line_he) || item.line}</span>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>

      <section className="sc-cta">
        <h2 style={{ fontFamily: 'var(--font-head)' }}>{t('showcase.ctaTitle', 'Want a page like these for your business?')}</h2>
        <Link to="/join" className="sc-btn">
          {t('showcase.ctaButton', 'Add your business, free')}
          <ArrowRight size={18} className="sc-arrow" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}

const CSS = `
.sc-page { max-width: 1280px; margin: 0 auto; padding: calc(var(--nav-h, 68px) + 40px) 24px 24px; }
.sc-head { max-width: 640px; margin-bottom: 36px; }
.sc-head h1 { font-size: clamp(2.2rem, 1.4rem + 2.6vw, 3.4rem); line-height: 1.12; letter-spacing: -0.02em; color: var(--ink); margin: 0; }
.sc-head p { margin: 12px 0 0; font-size: 1.05rem; line-height: 1.6; color: var(--brand-muted); }
.sc-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px 24px; }
.sc-card { display: block; color: inherit; text-decoration: none; border-radius: 28px; }
.sc-card:focus-visible { outline: 3px solid var(--gold); outline-offset: 4px; }
/* the soft tile, with the page sitting small inside it, as on Mobbin */
.sc-tile { background: #F3F4F6; border-radius: 28px; aspect-ratio: 4 / 3.3; display: grid; place-items: center; padding: 9%; transition: background 200ms ease-out; }
.sc-frame { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: top; border-radius: 8px; display: block; background: #fff;
  box-shadow: 0 1px 2px rgb(17 24 39 / .06), 0 12px 28px -12px rgb(17 24 39 / .22); transition: transform 300ms cubic-bezier(.2,.7,.2,1); }
@media (hover: hover) {
  .sc-card:hover .sc-tile { background: #ECEDF0; }
  .sc-card:hover .sc-frame { transform: translateY(-4px); }
}
.sc-meta { display: flex; align-items: center; gap: 14px; margin-top: 16px; }
.sc-logo { width: 48px; height: 48px; border-radius: 12px; flex: none; object-fit: cover; border: 1px solid #E3E3E3; }
.sc-mark { display: grid; place-items: center; font-weight: 800; font-size: 1rem; letter-spacing: .02em; border: 0; }
.sc-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sc-name { font-weight: 700; font-size: 1.05rem; color: var(--ink); }
.sc-line { font-size: .95rem; color: var(--brand-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-cta { margin: 72px 0 24px; padding-top: 40px; border-top: 1px solid #E3E3E3; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; }
.sc-cta h2 { margin: 0; font-size: clamp(1.5rem, 1.1rem + 1.2vw, 2.1rem); color: var(--ink); }
.sc-btn { display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 12px 24px; border-radius: 999px; background: #000; color: #fff; font-weight: 600; text-decoration: none; transition: transform 200ms ease-out; }
.sc-btn:hover { transform: translateY(-1px); }
.sc-btn:active { transform: translateY(1px); }
.sc-btn:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
[dir="rtl"] .sc-arrow { transform: scaleX(-1); }
@media (max-width: 1024px) { .sc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) {
  .sc-page { padding-inline: 16px; }
  .sc-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .sc-tile { border-radius: 22px; }
}
`;
