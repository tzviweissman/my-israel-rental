/**
 * /businesses sorted (Tzvi, 20 Nov 2026: "i want it more organized"): a category bar, then on "All" one row
 * per group that opens on an intro tile of its own product photos ("Keep intros"), and inside a group its
 * subcategory chips, the business pages, then the listings. Groups and chips: lib/browseGroups.js.
 *
 * One film plays per row or grid: the first business page wholly on screen, or the one under the pointer; the
 * rest show their still. Rows scroll by swipe; on a laptop a frosted button sits on the row's edge only while
 * the pointer is over it, the edge with more fades out, and a thin line under the row shows where you are
 * (Tzvi: "i dont like the arrows ... make it look nice and more modern").
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, CakeSlice, Shirt, Home, Gift, HeartPulse, PartyPopper, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import ShowcaseCard, { SHOWCASE_CARD_CSS } from '../showcase/ShowcaseCard';
import { BROWSE_GROUPS, groupOf } from '../../lib/browseGroups';
import { getGigCover } from '../../utils/gigAvailability';

const ICONS = { all: LayoutGrid, food: CakeSlice, style: Shirt, home: Home, gifts: Gift, health: HeartPulse, events: PartyPopper, more: MoreHorizontal };
const ROW_MAX = 12;

/** Listings and business pages by group. Pages take their group from their own listing. */
export function sortIntoGroups(gigs, pages) {
  const byBiz = new Map(gigs.map((g) => [g.business_id, g]));
  const pageBiz = new Set((pages || []).map((p) => p.business_id));
  const out = Object.fromEntries(BROWSE_GROUPS.map((x) => [x.id, { pages: [], gigs: [] }]));
  (pages || []).forEach((p) => { const g = byBiz.get(p.business_id); if (g) out[groupOf(g)].pages.push({ ...p, gig: g }); });
  gigs.forEach((g) => { if (!pageBiz.has(g.business_id)) out[groupOf(g)].gigs.push(g); });
  return out;
}

const useLabels = () => {
  const { t } = useTranslation();
  return {
    group: (x) => t(`browse.groups.${x.id}`, x.label),
    line: (x) => t(`browse.lines.${x.id}`, x.line),
    chip: (c) => t(`browse.chips.${c.id}`, c.label),
    t,
  };
};

export function CategoryBar({ sorted, total, active, onSelect }) {
  const L = useLabels();
  const tabs = [{ id: '', icon: 'all', n: total, label: L.t('browse.all', 'All') },
    ...BROWSE_GROUPS.map((x) => ({ id: x.id, icon: x.icon, n: sorted[x.id].pages.length + sorted[x.id].gigs.length, label: L.group(x) }))
      .filter((x) => x.n)];
  return (
    <nav className="bw-cats" aria-label={L.t('browse.categories', 'Categories')} data-testid="browse-cats">
      <style>{CSS}</style>
      <div className="bw-cats-in" role="tablist">
        {tabs.map((x) => { const Icon = ICONS[x.icon];
          return (
            <button key={x.id || 'all'} type="button" role="tab" aria-selected={active === x.id} className="bw-cat"
              onClick={() => onSelect(x.id)} data-testid={`browse-cat-${x.id || 'all'}`}>
              <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              <span>{x.label}</span><small>{x.n}</small>
            </button>
          ); })}
      </div>
    </nav>
  );
}

// Which business page in this box plays: the hovered one, else the first wholly on screen.
function useOneFilm(boxRef) {
  const [active, setActive] = useState(null);
  const hover = useRef(null);
  const pick = useCallback(() => {
    const box = boxRef.current; if (!box) return;
    if (hover.current) { setActive(hover.current); return; }
    const vis = [...box.querySelectorAll('[data-slug]')].find((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= -4 && r.right <= window.innerWidth + 4 && r.top >= 0 && r.bottom <= window.innerHeight;
    });
    setActive(vis ? vis.dataset.slug : null);
  }, [boxRef]);
  useEffect(() => {
    let raf = 0; const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(pick); };
    const strip = boxRef.current?.querySelector('.bw-strip');
    window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    strip?.addEventListener('scroll', on, { passive: true });
    on();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); strip?.removeEventListener('scroll', on); };
  }, [pick, boxRef]);
  const onHover = useCallback((slug) => { hover.current = slug; pick(); }, [pick]);
  return [active, onHover];
}

function Intro({ group, items, onOpen }) {
  const L = useLabels();
  const pics = [...items.gigs.map(getGigCover), ...items.pages.map((p) => `/showcase/${p.slug}.webp${p.v ? `?v=${p.v}` : ''}`)].filter(Boolean);
  const four = pics.length ? [0, 1, 2, 3].map((i) => pics[i % pics.length]) : [];
  const n = items.pages.length + items.gigs.length;
  return (
    <button type="button" className="bw-intro" onClick={onOpen} data-testid={`browse-intro-${group.id}`}>
      <span className="bw-mosaic" aria-hidden="true">{four.map((src, i) => <img key={i} src={src} alt="" loading="lazy" />)}</span>
      <span className="bw-intro-txt">
        <b>{L.group(group)}</b>
        <span>{L.line(group)}</span>
        <i>{L.t('browse.count', { count: n, defaultValue: '{{count}} businesses' })} <span className="bw-arr" aria-hidden="true">→</span></i>
      </span>
    </button>
  );
}

function Row({ group, items, renderGig, onOpen }) {
  const L = useLabels();
  const box = useRef(null);
  const [active, onHover] = useOneFilm(box);
  const [edge, setEdge] = useState({ start: true, end: false, w: 1, f: 0 });
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  useEffect(() => {
    const s = box.current?.querySelector('.bw-strip'); if (!s) return undefined;
    const upd = () => { const max = s.scrollWidth - s.clientWidth; const x = Math.abs(s.scrollLeft);
      setEdge({ start: x < 4, end: x > max - 4, w: Math.min(1, s.clientWidth / s.scrollWidth), f: max > 0 ? x / max : 1 }); };
    upd(); s.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd);
    return () => { s.removeEventListener('scroll', upd); window.removeEventListener('resize', upd); };
  }, []);
  const go = (dir) => { const s = box.current.querySelector('.bw-strip'); s.scrollBy({ left: dir * (rtl ? -1 : 1) * s.clientWidth * 0.8, behavior: 'smooth' }); };
  const n = items.pages.length + items.gigs.length;
  return (
    <section className="bw-row" aria-label={L.group(group)} data-testid={`browse-row-${group.id}`}>
      <div className="bw-row-head"><button type="button" className="bw-seeall" onClick={onOpen}>{L.t('browse.seeAll', { count: n, defaultValue: 'See all {{count}}' })}</button></div>
      <div ref={box} className={`bw-rail${edge.start ? ' at-start' : ''}${edge.end ? ' at-end' : ''}`}>
        <div className="bw-strip">
          <Intro group={group} items={items} onOpen={onOpen} />
          {items.pages.slice(0, ROW_MAX).map((p) => <div key={p.slug} className="bw-cell"><ShowcaseCard item={p} active={active === p.slug} onHover={onHover} /></div>)}
          {items.gigs.slice(0, Math.max(0, ROW_MAX - items.pages.length)).map((g) => <div key={g.id} className="bw-cell">{renderGig(g)}</div>)}
        </div>
        <button type="button" className="bw-nav prev" onClick={() => go(-1)} aria-label={L.t('browse.back', 'Back')}>{rtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
        <button type="button" className="bw-nav next" onClick={() => go(1)} aria-label={L.t('browse.more', 'More')}>{rtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button>
        <div className="bw-progress" aria-hidden="true"><span style={{ width: `${edge.w * 100}%`, transform: `translateX(${(rtl ? -1 : 1) * (edge.f * (1 - edge.w) / edge.w) * 100}%)` }} /></div>
      </div>
    </section>
  );
}

export function AllRows({ sorted, renderGig, onOpen }) {
  return (
    <div className="bw-rows" data-testid="browse-rows">
      <style>{SHOWCASE_CARD_CSS + CSS}</style>
      {BROWSE_GROUPS.filter((x) => sorted[x.id].pages.length + sorted[x.id].gigs.length).map((x) => (
        <Row key={x.id} group={x} items={sorted[x.id]} renderGig={renderGig} onOpen={() => onOpen(x.id)} />
      ))}
    </div>
  );
}

export function GroupView({ groupId, chipId, sorted, renderGig, onChip }) {
  const L = useLabels();
  const group = BROWSE_GROUPS.find((x) => x.id === groupId);
  const items = sorted[groupId];
  const pagesBox = useRef(null);
  const [active, onHover] = useOneFilm(pagesBox);
  if (!group || !items) return null;
  const chip = group.chips.find((c) => c.id === chipId);
  const inChip = (g) => !chip || chip.test(g);
  const pages = items.pages.filter((p) => inChip(p.gig));
  const gigs = items.gigs.filter(inChip);
  const all = [...items.pages.map((p) => p.gig), ...items.gigs];
  const chips = group.chips.map((c) => ({ ...c, n: all.filter(c.test).length })).filter((c) => c.n);
  return (
    <div className="bw-group" data-testid={`browse-group-${groupId}`}>
      <style>{SHOWCASE_CARD_CSS + CSS}</style>
      <p className="bw-group-line">{L.line(group)}</p>
      {chips.length > 0 && (
        <div className="bw-chips" role="group" aria-label={L.group(group)}>
          <button type="button" className="bw-chip" aria-pressed={!chip} onClick={() => onChip('')}>{L.t('browse.all', 'All')}<span>{all.length}</span></button>
          {chips.map((c) => (
            <button key={c.id} type="button" className="bw-chip" aria-pressed={chip?.id === c.id} onClick={() => onChip(chip?.id === c.id ? '' : c.id)} data-testid={`browse-chip-${c.id}`}>
              {L.chip(c)}<span>{c.n}</span>
            </button>
          ))}
        </div>
      )}
      {pages.length > 0 && (
        <section ref={pagesBox}>
          <p className="bw-label">{L.t('showcase.title', 'Business pages')}</p>
          <ul className="bw-pages">{pages.map((p) => <li key={p.slug}><ShowcaseCard item={p} active={active === p.slug} onHover={onHover} /></li>)}</ul>
        </section>
      )}
      {gigs.length > 0 && (
        <section>
          {pages.length > 0 && <p className="bw-label">{L.t('browse.moreIn', { name: L.group(group), defaultValue: 'More in {{name}}' })}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-8">{gigs.map(renderGig)}</div>
        </section>
      )}
    </div>
  );
}

const CSS = `
.bw-cats { position: sticky; top: var(--nav-h, 68px); z-index: 20; background: var(--surface, #fff); border-bottom: 1px solid var(--brand-border); margin-bottom: 28px; }
.bw-cats-in { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; padding-top: 6px; }
.bw-cats-in::-webkit-scrollbar { display: none; }
.bw-cat { flex: none; display: grid; justify-items: center; gap: 3px; padding: 8px 14px 10px; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--brand-muted); font-size: .82rem; font-weight: 600; cursor: pointer; }
.bw-cat small { font-size: .72rem; font-weight: 500; }
.bw-cat:hover { color: var(--ink); }
.bw-cat[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--ink); }
.bw-rows { display: grid; gap: 40px; }
.bw-row-head { display: flex; justify-content: flex-end; margin-bottom: 10px; }
.bw-seeall { border: 1px solid var(--brand-border); border-radius: 999px; padding: 6px 14px; font-size: .82rem; font-weight: 700; color: var(--ink); background: none; cursor: pointer; }
.bw-seeall:hover { border-color: var(--ink); }
.bw-rail { position: relative; }
.bw-strip { display: grid; grid-auto-flow: column; grid-auto-columns: calc((100% - 3 * 18px) / 4.35); gap: 18px; align-items: start; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding-bottom: 4px;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 72px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 72px), transparent); }
.bw-strip::-webkit-scrollbar { display: none; }
.bw-strip > * { scroll-snap-align: start; min-width: 0; }
.bw-rail:not(.at-start) .bw-strip { -webkit-mask-image: linear-gradient(90deg, transparent, #000 72px, #000 calc(100% - 72px), transparent); mask-image: linear-gradient(90deg, transparent, #000 72px, #000 calc(100% - 72px), transparent); }
.bw-rail.at-end:not(.at-start) .bw-strip { -webkit-mask-image: linear-gradient(90deg, transparent, #000 72px); mask-image: linear-gradient(90deg, transparent, #000 72px); }
.bw-rail.at-start.at-end .bw-strip { -webkit-mask-image: none; mask-image: none; }
[dir="rtl"] .bw-strip { -webkit-mask-image: linear-gradient(270deg, #000 calc(100% - 72px), transparent); mask-image: linear-gradient(270deg, #000 calc(100% - 72px), transparent); }
[dir="rtl"] .bw-rail:not(.at-start) .bw-strip { -webkit-mask-image: linear-gradient(270deg, transparent, #000 72px, #000 calc(100% - 72px), transparent); mask-image: linear-gradient(270deg, transparent, #000 72px, #000 calc(100% - 72px), transparent); }
[dir="rtl"] .bw-rail.at-end:not(.at-start) .bw-strip { -webkit-mask-image: linear-gradient(270deg, transparent, #000 72px); mask-image: linear-gradient(270deg, transparent, #000 72px); }
[dir="rtl"] .bw-rail.at-start.at-end .bw-strip { -webkit-mask-image: none; mask-image: none; }
.bw-nav { position: absolute; top: calc(50% - 44px); width: 46px; height: 46px; border-radius: 50%; border: 1px solid rgb(255 255 255 / .6); background: rgb(255 255 255 / .72); -webkit-backdrop-filter: blur(12px) saturate(1.4); backdrop-filter: blur(12px) saturate(1.4); box-shadow: 0 6px 20px rgb(17 24 39 / .16); color: var(--ink); display: grid; place-items: center; cursor: pointer; opacity: 0; transform: scale(.9); transition: opacity .2s, transform .2s; z-index: 3; }
.bw-nav.prev { inset-inline-start: 10px; } .bw-nav.next { inset-inline-end: 10px; }
.bw-rail:hover .bw-nav, .bw-nav:focus-visible { opacity: 1; transform: none; }
.bw-nav:hover { background: #fff; }
.bw-rail.at-start .bw-nav.prev, .bw-rail.at-end .bw-nav.next { opacity: 0 !important; pointer-events: none; }
@media (hover: none) { .bw-nav { display: none; } }
.bw-progress { height: 2px; background: var(--brand-border); border-radius: 2px; margin-top: 14px; overflow: hidden; }
.bw-rail.at-start.at-end .bw-progress { visibility: hidden; }
.bw-progress span { display: block; height: 100%; background: var(--ink); border-radius: 2px; transition: transform .15s linear; }
.bw-intro { position: relative; display: block; width: 100%; aspect-ratio: 4 / 3.3; border-radius: 28px; overflow: hidden; border: 0; padding: 0; color: #fff; text-align: start; cursor: pointer; background: var(--ink); }
.bw-mosaic { position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.bw-mosaic img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bw-intro::after { content: ""; position: absolute; inset: 0; background: linear-gradient(160deg, rgb(17 24 39 / .15) 0%, rgb(17 24 39 / .82) 75%); }
.bw-intro-txt { position: absolute; inset-inline: 18px; bottom: 16px; z-index: 1; display: grid; gap: 4px; }
.bw-intro-txt b { font-family: var(--font-head); font-size: 1.55rem; line-height: 1.05; font-weight: 700; }
.bw-intro-txt span { font-size: .85rem; opacity: .92; }
.bw-intro-txt i { font-style: normal; font-size: .78rem; font-weight: 700; margin-top: 6px; }
/* the arrow points the way the row reads: left in Hebrew (UI audit 21 Nov 2026) */
.bw-arr { display: inline-block; }
[dir="rtl"] .bw-arr { transform: scaleX(-1); }
.bw-intro:focus-visible, .bw-cat:focus-visible, .bw-chip:focus-visible, .bw-seeall:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
.bw-cell .sc-tile { border-radius: 28px; }
.bw-group { display: grid; gap: 22px; }
.bw-group-line { margin: -12px 0 0; color: var(--brand-muted); }
.bw-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.bw-chip { font-size: .85rem; font-weight: 600; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--brand-border); background: var(--surface, #fff); color: var(--ink); cursor: pointer; }
.bw-chip span { color: var(--brand-muted); font-weight: 500; margin-inline-start: 5px; }
.bw-chip[aria-pressed="true"] { background: #000; border-color: #000; color: #fff; }
.bw-chip[aria-pressed="true"] span { color: inherit; opacity: .7; }
.bw-label { font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--brand-muted); margin: 0 0 12px; }
.bw-pages { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px 20px; }
@media (max-width: 1024px) { .bw-strip { grid-auto-columns: calc((100% - 2 * 18px) / 3.3); } .bw-pages { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 640px) {
  /* the phone's site bar is taller and floats; a sticky bar slid under it (checked 20 Nov 2026) */
  .bw-cats { position: static; }
  .bw-strip { grid-auto-columns: 72%; gap: 12px; }
  .bw-pages { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 12px; }
  .bw-chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-inline: -16px; padding-inline: 16px; }
  .bw-chips::-webkit-scrollbar { display: none; }
  .bw-chip { flex: none; }
  .bw-intro, .bw-cell .sc-tile { border-radius: 22px; }
  .bw-intro-txt b { font-size: 1.3rem; }
}
`;
