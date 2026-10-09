/**
 * The business pages, as a row at the top of /businesses (Tzvi, 9 Oct 2026:
 * "add them at the top of the regular business page"). Three tiles across on
 * a laptop; on a phone a row you swipe, with the edge of the next tile
 * showing and arrow buttons beside the heading, mirrored in Hebrew (UI video
 * rules §3e, 17). "See all" opens /showcase. Renders nothing until the list
 * has loaded, and nothing if it is empty.
 */
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ShowcaseCard, { useShowcase, SHOWCASE_CARD_CSS } from './ShowcaseCard';

export default function ShowcaseStrip() {
  const { t } = useTranslation();
  const items = useShowcase();
  const row = useRef(null);
  if (!items || !items.length) return null;

  const move = (dir) => {
    const el = row.current;
    if (!el) return;
    const card = el.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const from = el.scrollLeft, by = dir * step * (rtl ? -1 : 1);
    el.scrollBy({ left: by, behavior: 'smooth' });
    // Where smooth scrolling never starts (a background tab, some webviews),
    // the arrow must still move the row.
    setTimeout(() => { if (el.scrollLeft === from) el.scrollBy({ left: by }); }, 450);
  };

  return (
    <section className="scs" aria-labelledby="scs-h">
      <style>{SHOWCASE_CARD_CSS + CSS}</style>
      <div className="section-rhead scs-head">
        <h2 id="scs-h" className="text-gray-900">{t('showcase.title', 'Business pages')}</h2>
        <div className="scs-tools">
          <Link to="/showcase" className="scs-all">{t('showcase.seeAll', 'See all')}</Link>
          <button type="button" className="scs-arrow" onClick={() => move(-1)} aria-label={t('showcase.prev', 'Previous')}>
            <ChevronLeft size={18} className="scs-ico" aria-hidden="true" />
          </button>
          <button type="button" className="scs-arrow" onClick={() => move(1)} aria-label={t('showcase.next', 'Next')}>
            <ChevronRight size={18} className="scs-ico" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul className="scs-row" ref={row}>
        {items.map((item) => <li key={item.slug}><ShowcaseCard item={item} /></li>)}
      </ul>
    </section>
  );
}

const CSS = `
.scs { margin-bottom: 40px; }
.scs-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.scs-tools { display: flex; align-items: center; gap: 8px; }
.scs-all { font-size: .9rem; font-weight: 600; color: var(--gold-text-on-light, #0F5E8F); margin-inline-end: 6px; }
.scs-all:hover { text-decoration: underline; }
.scs-arrow { width: 40px; height: 40px; border-radius: 999px; border: 1px solid #E3E3E3; background: #fff; color: var(--ink); display: grid; place-items: center; transition: background 200ms ease-out, transform 150ms ease-out; }
.scs-arrow:hover { background: #F9FAFB; }
.scs-arrow:active { transform: scale(.94); }
.scs-arrow:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
[dir="rtl"] .scs-ico { transform: scaleX(-1); }
.scs-row { list-style: none; margin: 0; padding: 0 0 6px; display: grid; grid-auto-flow: column; grid-auto-columns: calc((100% - 40px) / 3); gap: 20px;
  overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; }
.scs-row::-webkit-scrollbar { display: none; }
.scs-row > li { scroll-snap-align: start; min-width: 0; }
@media (max-width: 1024px) { .scs-row { grid-auto-columns: calc((100% - 20px) / 2.15); } }
@media (max-width: 640px) { .scs-row { grid-auto-columns: 84%; gap: 14px; } }
`;
