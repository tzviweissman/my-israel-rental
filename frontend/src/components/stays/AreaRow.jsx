/**
 * AreaRow — one horizontally-scrollable strip of StaysCards per area
 * ("Stays in Jerusalem", "Stays in Tel Aviv", …).
 *
 * Header is a clickable title + inline forward chevron that jumps to
 * the /stays?area=… search page (same unified filter UI). Carousel
 * chevrons on the right (desktop only) scroll ~3 cards at a time, and
 * we flip the direction sign in RTL because browser scrollLeft is
 * reversed under `dir="rtl"`.
 */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useIsRtl from '../../hooks/useIsRtl';
import StaysCard from './StaysCard';

const AreaRow = ({
  area,
  properties,
  onCardClick,
  onSeeAll,
  likedIds,
  onToggleLike,
  displayCurrency,
  t,
}) => {
  const scrollRef = React.useRef(null);
  const isRtl = useIsRtl();
  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const sign = isRtl ? -1 : 1;
    scrollRef.current.scrollBy({ left: dir * sign * 320, behavior: 'smooth' });
  };
  const ForwardChevron = isRtl ? ChevronLeft : ChevronRight;

  return (
    <section data-testid={`stays-area-section-${area}`}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onSeeAll}
          className="group flex items-center gap-1.5 text-left"
          data-testid={`stays-see-all-${area}`}
        >
          <h2 className="text-base md:text-lg font-semibold text-gray-900 group-hover:underline">
            {t('stays.staysIn', 'Stays in')} {area}
          </h2>
          <ForwardChevron size={16} className="text-gray-900" />
        </button>
        {properties.length > 3 && (
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => scroll(-1)}
              className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-gray-900 transition-colors"
              aria-label={t('stays.scrollBack', 'Scroll back')}
            >
              {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
            <button
              onClick={() => scroll(1)}
              className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-gray-900 transition-colors"
              aria-label={t('stays.scrollForward', 'Scroll forward')}
            >
              {isRtl ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-2 px-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {properties.slice(0, 12).map((p) => (
          <StaysCard
            key={p.id}
            property={p}
            liked={likedIds?.has(p.id)}
            onToggleLike={(e) => onToggleLike?.(p.id, e)}
            displayCurrency={displayCurrency}
            onClick={() => onCardClick(p.id)}
          />
        ))}
      </div>
    </section>
  );
};

export default AreaRow;
