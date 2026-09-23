/**
 * The size ladder: one listing's products drawn to scale, smallest to
 * largest, beside a 10 cm ruler, each with its own price.
 * docs/page-generation-rules.md §9, from the Blazin' Boards practice page,
 * where "it showed me how big each board actually is" was the moment that
 * sold the page.
 *
 * Honest by construction:
 *   - only products the owner measured (`width_cm`) are drawn; a scale
 *     nobody measured would be an invented number;
 *   - one pixels-per-centimetre ratio for all of them, so the sizes are
 *     comparable, and the ruler is drawn at that same ratio;
 *   - nothing with fewer than three measured products (a ladder of one is
 *     a photo, and the page's other sections already show photos).
 *
 * Motion: while the section is on screen, scrolling steps through the
 * sizes (the product performs, not the camera). With reduced motion the
 * same thing is a still: every size outlined at once, the list beside it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { money } from '../../utils/currency';
import { productPhotos } from '../../utils/productPhotos';

const MIN_ITEMS = 3;
const RULER_CM = 10;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export default function SizeLadderBlock({ block, ctx }) {
  const { t, i18n } = useTranslation();
  const { business } = ctx;
  const p = block.props || {};
  const listing = (business.listings || []).find((g) => g && g.id === p.listing);
  const items = useMemo(() => ((listing && listing.products) || [])
    .filter((x) => x && Number(x.width_cm) > 0)
    .map((x) => ({ ...x, w: Number(x.width_cm), l: Number(x.length_cm) || Number(x.width_cm) }))
    .sort((a, b) => a.w * a.l - b.w * b.l), [listing]);

  const reduced = useReducedMotion();
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const [active, setActive] = useState(0);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  // The stage's size decides the one scale everything is drawn at.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll through the section, one size per step.
  useEffect(() => {
    if (reduced || items.length < MIN_ITEMS) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = trackRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const room = r.height - window.innerHeight;
        const progress = room > 0 ? Math.min(1, Math.max(0, -r.top / room)) : 0;
        setActive(Math.min(items.length - 1, Math.floor(progress * items.length)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduced, items.length]);

  if (!listing || items.length < MIN_ITEMS) return null;

  const shown = reduced ? items.length - 1 : active;
  const maxW = Math.max(...items.map((x) => x.w), RULER_CM);
  const maxL = Math.max(...items.map((x) => x.l));
  const rulerRoom = 36;
  const pxPerCm = stage.w && stage.h ? Math.min(stage.w / maxW, (stage.h - rulerRoom) / maxL) : 0;
  const cur = items[shown];
  const photo = productPhotos(cur)[0];
  // The numbers are one left-to-right run and the unit sits after them in
  // reading order, so Hebrew reads "15 × 20 ס״מ" rather than a reversed jumble.
  const dims = (x) => (
    <>
      <span dir="ltr">{x.w} × {x.l}</span> {t('sizeLadder.cm', 'cm')}
    </>
  );
  const nameOf = (x) => ((i18n.language || '').startsWith('he') && x.name_he) || x.name;
  const orderHref = listing.gig_type === 'store' ? `/order/${listing.id}` : `/services/gig/${listing.id}`;

  return (
    <section
      ref={trackRef}
      className="relative"
      style={{ height: reduced ? 'auto' : `${items.length * 70 + 40}vh` }}
      aria-label={t('sizeLadder.label', 'Sizes, drawn to scale')}
      data-testid={`pg-sizes-${block.id}`}
      data-active={shown}
    >
      <div className={`${reduced ? '' : 'sticky top-16'} py-6 md:py-10`} style={{ minHeight: reduced ? undefined : 'calc(100vh - 4rem)' }}>
        {(p.heading || '').trim() && (
          <h2 className="text-2xl md:text-3xl mb-4" dir="auto"
            style={{ fontFamily: 'var(--pg-head-font)', fontWeight: 'var(--pg-head-weight)', color: 'var(--ink)' }}>
            {p.heading}
          </h2>
        )}
        <div className="grid md:grid-cols-[1fr_18rem] gap-6 items-end">
          {/* The drawing: every size outlined, the current one filled with its photo. */}
          <div ref={stageRef} className="relative h-[34vh] md:h-[62vh]" data-testid="pg-sizes-stage">
            {pxPerCm > 0 && (
              <>
                {items.map((x, i) => (
                  <div key={x.id || i} aria-hidden="true"
                    className="absolute bottom-9 end-0 rounded-md border"
                    style={{
                      width: x.w * pxPerCm, height: x.l * pxPerCm,
                      borderColor: i === shown ? 'var(--pg-accent)' : 'var(--pg-rule)',
                      borderWidth: i === shown ? 2 : 1,
                      opacity: i <= shown ? 1 : 0.35,
                    }}
                  />
                ))}
                <div aria-hidden="true" className="absolute bottom-9 end-0 overflow-hidden rounded-md"
                  style={{ width: cur.w * pxPerCm, height: cur.l * pxPerCm, transition: reduced ? 'none' : 'width var(--pg-motion), height var(--pg-motion)' }}>
                  {photo && <img src={photo} alt="" className="w-full h-full object-cover" />}
                </div>
                {/* The ruler, at the same scale as the drawing. */}
                <div className="absolute bottom-0 end-0 flex flex-col items-end" style={{ width: RULER_CM * pxPerCm }} data-testid="pg-sizes-ruler">
                  <div className="w-full h-2 border-x border-b" style={{ borderColor: 'var(--ink)' }} />
                  <span className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>
                    <span dir="ltr">{RULER_CM}</span> {t('sizeLadder.cm', 'cm')}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* On a phone, the current size alone: the whole list under the
              drawing would push the button behind the page's own sticky bar. */}
          <div className="md:hidden rounded-lg px-3 py-2 flex items-baseline justify-between gap-3"
            style={{ background: 'var(--pg-accent)', color: 'var(--pg-accent-on)' }} aria-live="polite" data-testid="pg-sizes-current">
            <span className="min-w-0">
              <span className="block font-semibold text-sm truncate" dir="auto">{nameOf(cur)}</span>
              <span className="block text-xs opacity-80">{dims(cur)}</span>
            </span>
            <span className="font-bold text-sm">{money(cur.price, cur.currency)}</span>
          </div>

          {/* The list: every size with its own price; the current one leads. */}
          <div>
            <ol className="hidden md:block space-y-1.5">
              {items.map((x, i) => (
                <li key={x.id || i} aria-current={i === shown ? 'true' : undefined}
                  className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2"
                  style={i === shown ? { background: 'var(--pg-accent)', color: 'var(--pg-accent-on)' } : { color: 'var(--ink)' }}
                  data-testid="pg-sizes-item">
                  <span className="min-w-0">
                    <span className="block font-semibold text-sm truncate" dir="auto">{nameOf(x)}</span>
                    <span className="block text-xs opacity-80">{dims(x)}</span>
                  </span>
                  <span className="font-bold text-sm" style={{ fontSize: 'calc(0.875rem * var(--pg-price-scale))' }}>{money(x.price, x.currency)}</span>
                </li>
              ))}
            </ol>
            <Link to={orderHref} className="md:mt-4 inline-flex items-center justify-center min-h-[44px] px-5 rounded-full text-sm font-bold"
              style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="pg-sizes-order">
              {listing.gig_type === 'store' ? t('upgrade.order', 'Order now') : t('upgrade.book', 'Book')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
