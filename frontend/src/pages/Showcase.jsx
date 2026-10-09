/**
 * Business pages: the hand-built pages, shown the way Mobbin shows sites
 * (Tzvi, 9 Oct 2026, from a recording of mobbin.com/discover/sites): a grid
 * of soft tiles, each holding a small live preview of the page, playing on a
 * loop, with the business's logo, name and one line under it. A tile opens
 * the page itself. The tile is components/showcase/ShowcaseCard.jsx, shared
 * with the strip at the top of /businesses.
 *
 * Only real pages of real businesses on the site are listed.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import ShowcaseCard, { useShowcase, SHOWCASE_CARD_CSS } from '../components/showcase/ShowcaseCard';

export default function Showcase() {
  const { t } = useTranslation();
  const items = useShowcase();

  return (
    <main className="sc-page">
      <PageMeta
        title={t('showcase.metaTitle', 'Business pages | MyIsraelRental')}
        description={t('showcase.intro', 'Pages built for businesses listed on MyIsraelRental. Open one to see it the way their customers do.')}
        path="/showcase"
      />
      <style>{SHOWCASE_CARD_CSS + CSS}</style>
      <header className="sc-head">
        <h1 style={{ fontFamily: 'var(--font-head)' }}>{t('showcase.title', 'Business pages')}</h1>
        <p>{t('showcase.intro', 'Pages built for businesses listed on MyIsraelRental. Open one to see it the way their customers do.')}</p>
      </header>

      <ul className="sc-grid">
        {(items || []).map((item) => <li key={item.slug}><ShowcaseCard item={item} /></li>)}
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
}
`;
