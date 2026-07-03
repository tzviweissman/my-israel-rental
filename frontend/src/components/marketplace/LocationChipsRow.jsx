/**
 * LocationChipsRow — horizontal scrollable pill chips for city filtering.
 *
 * Sits below the CategoryCarousel on the Services hub. Compact chips (not
 * tall cards) because location is a secondary filter — the visual weight
 * should sit with the category strip.
 *
 * Selected chip flips to a filled teal state. Cities with zero listings
 * still render, but with a muted "0" pill so providers see them as valid
 * targets.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

const LocationChipsRow = ({ locations, selectedLoc, onSelect }) => {
  const scrollerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

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
  }, [updateEdges, locations.length]);

  const scrollBy = (delta) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (!locations || locations.length === 0) return null;

  return (
    <div className="relative" data-testid="services-location-row">
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-260)}
          className="hidden md:flex absolute start-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow border border-gray-200 items-center justify-center hover:shadow-md transition"
          aria-label="Scroll locations left"
          data-testid="services-location-prev"
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scrollBy(260)}
          className="hidden md:flex absolute end-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow border border-gray-200 items-center justify-center hover:shadow-md transition"
          aria-label="Scroll locations right"
          data-testid="services-location-next"
        >
          <ChevronRight size={16} />
        </button>
      )}
      <div
        ref={scrollerRef}
        className="flex gap-2 overflow-x-auto scroll-smooth snap-x scrollbar-hide px-1 -mx-1 pb-1"
      >
        {locations.map((loc) => {
          const active = selectedLoc === loc.slug;
          return (
            <button
              key={loc.slug}
              onClick={() => onSelect(active ? '' : loc.slug)}
              className={`snap-start shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all ${
                active
                  ? 'bg-[#1E6A6A] text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-[#1E6A6A]/50'
              }`}
              data-testid={`services-location-${loc.slug}`}
              aria-pressed={active}
            >
              <MapPin size={13} className={active ? 'opacity-90' : 'text-[#1E6A6A]'} />
              <span>{loc.label}</span>
              {typeof loc.count === 'number' && loc.count > 0 && (
                <span className={`ms-0.5 text-[11px] font-normal ${active ? 'opacity-80' : 'text-gray-400'}`}>
                  · {loc.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LocationChipsRow;
