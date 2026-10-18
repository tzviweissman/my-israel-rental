/**
 * The business pages, at the top of /businesses (Tzvi, 9 Oct 2026: "add them
 * at the top of the regular business page"). Two rows you swipe through
 * sideways (Tzvi, 18 Oct 2026: "the business pages should have more rows
 * because if we eventually have 100 business pages ... each one would take
 * too long"): eight tiles in view on a laptop, four on a phone, with the edge of
 * the next column showing and arrow buttons beside the heading that move a
 * whole screen, mirrored in Hebrew (UI video rules §3e, 17). "See all" opens
 * /showcase. Renders nothing until the list has loaded, or if it is empty.
 *
 * A fast swipe glitched (Tzvi, 18 Oct 2026): the browser's mandatory snap,
 * a forced stop at every card and a script gliding to the nearest card all
 * fought each other. Now only the browser snaps, to a column, and a flick
 * may pass several columns.
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

  // The arrows go a whole screen of columns, landing on a column's own
  // position, never by a distance: a relative scroll that ran twice on iOS
  // Safari left a card half off the screen (Tzvi, 16 Oct 2026).
  const move = (dir) => {
    const el = row.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === 'rtl';
    const edge = (c) => (rtl ? box.right - c.getBoundingClientRect().right : c.getBoundingClientRect().left - box.left);
    // one card per column: the first card of each column (the top row)
    const cols = [...el.querySelectorAll('li')].filter((c, i, all) => i === 0 || Math.abs(edge(c) - edge(all[i - 1])) > 4)
      .filter((c, i, all) => all.findIndex((d) => Math.abs(edge(d) - edge(c)) < 4) === i);
    if (!cols.length) return;
    const w = cols[0].getBoundingClientRect().width;
    const perScreen = Math.max(1, Math.floor((box.width + 8) / (w + 8)));
    const now = cols.reduce((best, c, i) => (Math.abs(edge(c)) < Math.abs(edge(cols[best])) ? i : best), 0);
    const next = cols[Math.max(0, Math.min(cols.length - 1, now + dir * perScreen))];
    if (!next) return;
    const target = el.scrollLeft + (rtl ? -1 : 1) * edge(next);
    el.scrollTo({ left: target, behavior: 'smooth' });
    setTimeout(() => { if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target }); }, 600);
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
      <ul className={`scs-row${items.length <= 3 ? ' scs-one' : ''}`} ref={row}>
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
.scs-arrow { width: 44px; height: 44px; flex: none; border-radius: 999px; border: 1px solid var(--brand-border); background: var(--surface); color: var(--ink); display: grid; place-items: center; transition: background 200ms ease-out, transform 150ms ease-out; }
.scs-arrow:hover { background: var(--surface-muted); }
.scs-arrow:active { transform: scale(.94); }
.scs-arrow:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
[dir="rtl"] .scs-ico { transform: scaleX(-1); }
/* two rows, filled column by column, swiped sideways; only the browser snaps,
   to a column, and a fast flick can pass several (no forced stop per card) */
.scs-row { list-style: none; margin: 0; padding: 0 0 6px; display: grid; grid-auto-flow: column; grid-template-rows: repeat(2, auto);
  grid-auto-columns: calc((100% - 60px) / 4.15); gap: 24px 20px;
  overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
.scs-row.scs-one { grid-template-rows: auto; }
.scs-row::-webkit-scrollbar { display: none; }
.scs-row > li { scroll-snap-align: start; min-width: 0; }
@media (max-width: 1024px) { .scs-row { grid-auto-columns: calc((100% - 40px) / 3.15); } }
.scs .sc-meta { margin-top: 12px; gap: 10px; }
.scs .sc-logo { width: 40px; height: 40px; border-radius: 10px; }
.scs .sc-name { font-size: 1rem; }
.scs .sc-line { font-size: .88rem; }
/* phones: two smaller tiles across and the edge of the next column, so four
   pages are in view at once; the line under the name wraps to two lines */
@media (max-width: 640px) {
  .scs-row { grid-auto-columns: calc((100% - 12px) / 2.12); gap: 20px 12px; }
  .scs .sc-tile { padding: 7%; border-radius: 18px; }
  .scs .sc-meta { gap: 8px; margin-top: 10px; align-items: flex-start; }
  .scs .sc-logo { width: 32px; height: 32px; border-radius: 9px; font-size: .8rem; }
  .scs .sc-name { font-size: .92rem; line-height: 1.2; }
  .scs .sc-line { font-size: .8rem; line-height: 1.3; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
}
`;
