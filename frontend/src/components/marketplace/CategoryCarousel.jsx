/**
 * CategoryCarousel — Fiverr-style tall-card horizontal scroller.
 *
 * Renders each marketplace category as a rounded card with a dark
 * colored top-half (category label in white) and a pastel bottom-half
 * with a representative photo. Cards snap-scroll horizontally.
 *
 * Left/right chevron buttons appear on desktop for pointer users;
 * touch users can just swipe. Buttons hide themselves at the ends
 * of the scroll range to avoid dead clicks.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
// The per-category icons moved to categoryTheme.js, which now resolves
// name -> component for every consumer.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { themeForCategory, iconForCategory } from './categoryTheme';
import useIsRtl from '../../hooks/useIsRtl';


const CategoryCard = ({ category, active, onClick }) => {
  const theme = themeForCategory(category.slug);
  const IconEl = iconForCategory(category.slug);
  return (
    <button
      onClick={onClick}
      className={`
        group relative shrink-0 snap-start overflow-hidden rounded-2xl text-left
        transition-all duration-300 ease-out will-change-transform
        w-[168px] h-[280px] sm:w-[196px] sm:h-[320px] md:w-[212px] md:h-[352px]
        ${active ? 'ring-4 ring-[var(--gold)] scale-[0.98]' : 'hover:-translate-y-0.5'}
      `}
      // Light-gold hover treatment matching the "How it works" cards
      // above:
      //   • resting: soft 1px gold hairline (rgba 15%) so cards feel
      //     framed even when idle;
      //   • hover:  border jumps to 45% gold + a low-spread gold glow
      //     (24 px, 12 % alpha) that reads as a warm halo, not a
      //     shadow. The whole thing composes cleanly on top of the
      //     existing dark header colour.
      // Active cards keep the solid gold ring so selection state
      // still dominates over hover state visually.
      style={{
        backgroundColor: theme.header,
        border: active ? undefined : '1px solid rgba(201, 162, 39,0.15)',
        boxShadow: active ? undefined : '0 6px 20px -14px rgba(15,58,58,0.25)',
      }}
      onMouseEnter={(e) => {
        if (active) return;
        e.currentTarget.style.border = '1px solid rgba(201, 162, 39,0.45)';
        e.currentTarget.style.boxShadow =
          '0 12px 28px -14px rgba(201, 162, 39,0.35), 0 0 0 3px rgba(201, 162, 39,0.08)';
      }}
      onMouseLeave={(e) => {
        if (active) return;
        e.currentTarget.style.border = '1px solid rgba(201, 162, 39,0.15)';
        e.currentTarget.style.boxShadow = '0 6px 20px -14px rgba(15,58,58,0.25)';
      }}
      data-testid={`services-category-${category.slug}`}
      data-active={active ? '1' : '0'}
    >
      {/* Header — dark slab with the category name */}
      <div className="relative h-[38%] px-4 pt-4 pb-2 flex items-start">
        <span
          className="text-white leading-tight text-base sm:text-lg md:text-xl tracking-tight"
          style={{
            // The design system's body face, not a literal. Inter is not in
            // this product's type stack at all, and a hardcoded family also
            // skips the RTL swap in design-tokens.css — the same trap that
            // silently falls Hebrew headings back to a system serif.
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            letterSpacing: '-0.015em',
          }}
        >
          {category.label}
        </span>
      </div>
      {/* Body — pastel background with either a photo or a large icon */}
      <div
        className="relative h-[62%] w-full flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: theme.body }}
      >
        {IconEl ? (
          <div className="w-[70%] aspect-square bg-white/70 rounded-2xl shadow-lg flex items-center justify-center -mt-4">
            <IconEl size={72} strokeWidth={1.5} color={theme.iconColor || theme.header} />
          </div>
        ) : (
          <img
            src={theme.image}
            alt={category.label}
            loading="lazy"
            className="w-[78%] h-[80%] object-cover rounded-xl shadow-lg -mt-4"
            draggable={false}
            onError={(e) => { e.currentTarget.style.opacity = '0'; }}
          />
        )}
      </div>
    </button>
  );
};

const CategoryCarousel = ({ categories, selectedCat, onSelect }) => {
  const scrollerRef = useRef(null);
  const isRtl = useIsRtl();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // In RTL, browsers report scrollLeft as 0..-maxScroll (CSSOM View spec)
    // rather than LTR's 0..+maxScroll — normalize before comparing, same
    // fix as AreaRow.jsx's carousel.
    const maxScroll = el.scrollWidth - el.clientWidth;
    const scrolledFromStart = isRtl ? -el.scrollLeft : el.scrollLeft;
    setCanScrollLeft(scrolledFromStart > 4);
    setCanScrollRight(scrolledFromStart < maxScroll - 4);
  }, [isRtl]);

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
    };
  }, [updateEdges, categories.length]);

  const scrollBy = (delta) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: isRtl ? -delta : delta, behavior: 'smooth' });
  };

  return (
    <div className="relative" data-testid="services-category-carousel">
      {/* Left chevron */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-320)}
          className="hidden md:flex absolute start-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
          aria-label="Scroll categories left"
          data-testid="services-carousel-prev"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {/* Right chevron */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy(320)}
          className="hidden md:flex absolute end-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md border border-gray-200 items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
          aria-label="Scroll categories right"
          data-testid="services-carousel-next"
        >
          <ChevronRight size={18} />
        </button>
      )}

      <div
        ref={scrollerRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-3 px-1 -mx-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {categories.map((c) => (
          <CategoryCard
            key={c.slug}
            category={c}
            active={selectedCat === c.slug}
            onClick={() => onSelect(c.slug === selectedCat ? '' : c.slug)}
          />
        ))}
      </div>
    </div>
  );
};

export default CategoryCarousel;
