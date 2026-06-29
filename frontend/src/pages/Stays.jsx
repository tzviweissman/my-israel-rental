/**
 * Stays page — Airbnb-style landing for all rental inventory.
 *
 * Three building blocks stacked from the top:
 *   1. **SearchBar** — single horizontal pill with Where (area dropdown),
 *      When (date range), and a Filters button on the right that opens
 *      the full filters modal. Mirrors the screenshot the user shared.
 *   2. **Area-grouped sections** — one horizontally-scrollable row per
 *      area, capped at ~12 cards per row. "See all 47 in Tel Aviv-Yafo"
 *      link at the right header of each row jumps to the legacy
 *      `/properties/all?area=...` listing.
 *   3. **Filters modal** — price range, bedrooms, rental sub-type
 *      (vacation / short-term / long-term), and amenities. Applies
 *      client-side because we already have all properties in memory.
 *
 * The page deliberately excludes storage rentals (per product spec —
 * storage was retired from the platform). Long-term / short-term /
 * vacation all live under the same "Stays" umbrella.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, SlidersHorizontal, MapPin, Calendar, X, ChevronRight, ChevronLeft, Loader2, Heart,
} from 'lucide-react';
import { getCoverImage } from '../utils/coverImage';
import DefaultImageBadge from '../components/property/DefaultImageBadge';
import VideoCoverBadge from '../components/property/VideoCoverBadge';
import WhenPicker from '../components/search/WhenPicker';
import WherePicker from '../components/search/WherePicker';
import StayTypePicker from '../components/search/StayTypePicker';
import QuickChips from '../components/search/QuickChips';
import useElementHeight from '../hooks/useElementHeight';
import useIsRtl from '../hooks/useIsRtl';
import useFavorites from '../hooks/useFavorites';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Stays = everything that's not storage. Storage was retired this session.
const STAY_RENTAL_TYPES = ['vacation', 'short-term', 'long-term'];

const Stays = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [allProperties, setAllProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Hydrate filters from URL so a shared link preserves state
  const [where, setWhere] = useState(searchParams.get('area') || '');
  const [checkin, setCheckin] = useState(searchParams.get('checkin') || '');
  const [checkout, setCheckout] = useState(searchParams.get('checkout') || '');
  const [priceMin, setPriceMin] = useState(searchParams.get('priceMin') || '');
  const [priceMax, setPriceMax] = useState(searchParams.get('priceMax') || '');
  const [bedrooms, setBedrooms] = useState(searchParams.get('bedrooms') || '');
  const [subType, setSubType] = useState(searchParams.get('subType') || '');
  const [amenities, setAmenities] = useState((searchParams.get('amenities') || '').split(',').filter(Boolean));

  // Load every non-storage property once. Volume is in the low thousands
  // so a single fetch + client-side filter beats round-tripping each query.
  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/properties`, { params: { limit: 1000 } })
      .then((r) => {
        const list = (r.data || []).filter((p) =>
          STAY_RENTAL_TYPES.includes(p.rental_type),
        );
        setAllProperties(list);
      })
      .catch(() => setAllProperties([]))
      .finally(() => setLoading(false));
  }, []);

  // Persist active filters to the URL so refresh + sharing keep state.
  // Only writes the keys that actually have values to keep the URL clean.
  const syncUrl = useCallback(() => {
    const next = new URLSearchParams();
    if (where) next.set('area', where);
    if (checkin) next.set('checkin', checkin);
    if (checkout) next.set('checkout', checkout);
    if (priceMin) next.set('priceMin', priceMin);
    if (priceMax) next.set('priceMax', priceMax);
    if (bedrooms) next.set('bedrooms', bedrooms);
    if (subType) next.set('subType', subType);
    if (amenities.length) next.set('amenities', amenities.join(','));
    setSearchParams(next, { replace: true });
  }, [where, checkin, checkout, priceMin, priceMax, bedrooms, subType, amenities, setSearchParams]);

  useEffect(() => { syncUrl(); }, [syncUrl]);

  // Build the list of areas for the Where dropdown — pulled from actual
  // properties so we never show an empty area chip.
  const areaOptions = useMemo(() => {
    const set = new Set();
    allProperties.forEach((p) => { if (p.area) set.add(p.area); });
    return Array.from(set).sort();
  }, [allProperties]);

  // Master filter chain — runs in-memory across every active criterion.
  const filtered = useMemo(() => {
    return allProperties.filter((p) => {
      if (where) {
        // Case-insensitive substring match so partial names ("tel",
        // "jeru") return the right listings.
        const needle = where.toLowerCase().trim();
        if (!(p.area || '').toLowerCase().includes(needle)) return false;
      }
      if (subType && p.rental_type !== subType) return false;
      if (bedrooms) {
        const b = parseInt(bedrooms, 10);
        if (b === 4) { if (!p.bedrooms || p.bedrooms < 4) return false; }
        else if ((p.bedrooms || 0) !== b) return false;
      }
      const price = p.rental_type === 'vacation' ? p.nightly_price : p.monthly_price;
      if (priceMin && (price || 0) < parseFloat(priceMin)) return false;
      if (priceMax && (price || 0) > parseFloat(priceMax)) return false;
      if (amenities.length && !amenities.every((a) => (p.amenities || []).includes(a))) return false;
      // Availability window — checkin must be on/after the listing's
      // available_from, and checkout must be on/before its available_to
      // (if set). Listings with no window are treated as always available.
      if (checkin && p.available_from && checkin < p.available_from) return false;
      if (checkout && p.available_to && checkout > p.available_to) return false;
      // Sanity: if a checkout is provided without a check-in, ensure the
      // listing's available_from doesn't already overshoot the checkout.
      if (checkout && !checkin && p.available_from && checkout < p.available_from) return false;
      return true;
    });
  }, [allProperties, where, subType, bedrooms, priceMin, priceMax, amenities, checkin, checkout]);

  // Group filtered properties by area for the per-area row layout.
  const grouped = useMemo(() => {
    const m = new Map();
    filtered.forEach((p) => {
      const key = p.area || 'Other';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(p);
    });
    // Stable sort by area name, but push areas with fewer than 3 listings
    // to the bottom so the top of the page always shows full rows.
    return Array.from(m.entries())
      .sort((a, b) => {
        const aBig = a[1].length >= 3 ? 0 : 1;
        const bBig = b[1].length >= 3 ? 0 : 1;
        if (aBig !== bBig) return aBig - bBig;
        return a[0].localeCompare(b[0]);
      });
  }, [filtered]);

  // Filter count badge — counts only the filters that live in the
  // modal (price, bedrooms, amenities). Where / Stay type / When are
  // already visible in the search bar itself so showing them as a
  // "filter pill count" would be redundant.
  const activeFilterCount =
    (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (bedrooms ? 1 : 0) +
    amenities.length;

  // Any active search OR filter collapses the per-area rows into a single
  // flat results grid — that mirrors Airbnb's behavior once a user starts
  // narrowing down what they want.
  const isSearchActive = Boolean(
    where || checkin || checkout || priceMin || priceMax || bedrooms || subType || amenities.length,
  );

  const clearAllFilters = () => {
    setWhere(''); setCheckin(''); setCheckout('');
    setSubType(''); setBedrooms(''); setPriceMin(''); setPriceMax(''); setAmenities([]);
  };

  // Live-measure the fixed search-bar container so the page wrapper's
  // padding-top always matches its actual height, even as the bar's
  // contents grow/shrink (e.g. QuickChips loading async holiday data).
  // Combined with the global `--nav-h` CSS variable published by
  // Navigation, this kills every "magic-number top padding" we used to
  // hard-code per breakpoint.
  const barRef = useRef(null);
  const barHeight = useElementHeight(barRef);

  // Shared favorites state — drives the interactive heart on every card.
  const { likedIds, toggleLike } = useFavorites();

  return (
    <div
      className="min-h-screen bg-[#FAFAF7]"
      style={{
        paddingTop: `calc(var(--nav-h, 68px) + ${barHeight}px)`,
        // Leave room at the bottom so the floating WhatsApp + a11y FABs
        // (~64px tall + their 24px safe-area offset) never cover the
        // last row of property cards on mobile.
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)',
      }}
      data-testid="stays-page"
    >
      {/* Fixed top search bar — uses the live `--nav-h` CSS var (published
          by <Navigation> via ResizeObserver) so the bar is always flush
          against the bottom of the nav, regardless of breakpoint or
          mobileScrolled state. */}
      <div
        ref={barRef}
        className="fixed left-0 right-0 z-30 bg-white border-b border-[#E5E5E5] shadow-sm"
        style={{ top: 'var(--nav-h, 68px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <StaysSearchBar
            where={where} setWhere={setWhere}
            checkin={checkin} setCheckin={setCheckin}
            checkout={checkout} setCheckout={setCheckout}
            subType={subType} setSubType={setSubType}
            areaOptions={areaOptions}
            onOpenFilters={() => setShowFilters(true)}
            filterCount={activeFilterCount}
            t={t}
          />
          {/* Mobile-only one-tap date presets — sit inside the fixed
              bar so they're always reachable while scrolling. */}
          <div className="mt-2">
            <QuickChips
              variant="light"
              onPick={({ checkin: ci, checkout: co }) => {
                setCheckin(ci); setCheckout(co);
              }}
              testidPrefix="stays-quick-chips"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-[#1E6A6A]" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <p className="text-2xl font-bold text-gray-800 mb-2">{t('stays.noResultsTitle', 'No stays match those filters')}</p>
          <p className="text-gray-500 mb-6">{t('stays.noResultsBody', 'Try widening your search or clearing a filter.')}</p>
          <button
            onClick={clearAllFilters}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid="stays-clear-filters"
          >
            {t('stays.clearAll', 'Clear all filters')}
          </button>
        </div>
      ) : isSearchActive ? (
        // Flat results grid — Airbnb-style, shown once any search/filter is active
        <div className="max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-10 py-6" data-testid="stays-results-grid">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                {filtered.length} {filtered.length === 1 ? t('stays.stay', 'stay') : t('stays.staysLabel', 'stays')}
                {where ? ` ${t('stays.in', 'in')} ${where}` : ''}
              </h2>
              {(checkin || checkout) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {checkin || '—'} → {checkout || '—'}
                </p>
              )}
            </div>
            <button
              onClick={clearAllFilters}
              className="text-xs font-semibold text-[#1E6A6A] hover:underline"
              data-testid="stays-grid-clear"
            >
              {t('stays.clearAll', 'Clear all')}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8">
            {filtered.map((p) => (
              <StaysCard
                key={p.id}
                property={p}
                fullWidth
                liked={likedIds.has(p.id)}
                onToggleLike={(e) => toggleLike(p.id, e)}
                onClick={() => {
                  sessionStorage.setItem('previousPath', '/stays' + window.location.search);
                  navigate(`/property/${p.id}`);
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-8">
          {grouped.map(([area, props]) => (
            <AreaRow
              key={area}
              area={area}
              properties={props}
              likedIds={likedIds}
              onToggleLike={toggleLike}
              onCardClick={(id) => {
                sessionStorage.setItem('previousPath', '/stays' + window.location.search);
                navigate(`/property/${id}`);
              }}
              onSeeAll={() => navigate(`/properties/all?area=${encodeURIComponent(area)}`)}
              t={t}
            />
          ))}
        </div>
      )}

      {showFilters && (
        <FiltersModal
          onClose={() => setShowFilters(false)}
          priceMin={priceMin} setPriceMin={setPriceMin}
          priceMax={priceMax} setPriceMax={setPriceMax}
          bedrooms={bedrooms} setBedrooms={setBedrooms}
          subType={subType} setSubType={setSubType}
          amenities={amenities} setAmenities={setAmenities}
          checkin={checkin} setCheckin={setCheckin}
          checkout={checkout} setCheckout={setCheckout}
          totalCount={filtered.length}
          t={t}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StaysSearchBar = ({ where, setWhere, checkin, setCheckin, checkout, setCheckout, subType, setSubType, areaOptions, onOpenFilters, filterCount, t }) => (
  <div className="flex items-stretch gap-2" data-testid="stays-search-bar">
    {/* 3-segment pill: Where | Stay type | When. The Filters button on
        the far end keeps the more-granular controls (price, bedrooms,
        amenities) inside the modal. We deliberately omit
        `overflow-hidden` on the pill wrapper so each segment's popover
        (Where suggestions, StayType menu, When calendar) can extend
        beyond the pill boundary. */}
    <div className="flex-1 flex items-stretch bg-[#F5F5F0] rounded-full border border-[#E5E5E5] hover:border-[#D4AF37] transition-colors">
      <div className="flex-1 min-w-0 rounded-l-full">
        <WherePicker
          value={where}
          onChange={setWhere}
          options={areaOptions}
          testidPrefix="stays-where"
        />
      </div>
      <div className="w-px bg-[#E5E5E5] my-2" />
      {/* Stay type — Vacation / Short-term / Long-term. Storage retired. */}
      <div className="flex-1 min-w-0">
        <StayTypePicker
          value={subType}
          onChange={setSubType}
          testidPrefix="stays-type"
        />
      </div>
      <div className="w-px bg-[#E5E5E5] my-2" />
      <div className="flex-1 min-w-0">
        {/* When — single segment opening a range calendar popover that
            sets both check-in and check-out. */}
        <WhenPicker
          checkin={checkin}
          checkout={checkout}
          onChange={({ checkin: ci, checkout: co }) => {
            setCheckin(ci);
            setCheckout(co);
          }}
          testidPrefix="stays-when"
        />
      </div>
    </div>
    {/* Filters button (with badge count when active) — opens the modal */}
    <button
      onClick={onOpenFilters}
      className="flex items-center gap-2 px-3 sm:px-4 rounded-full border border-[#E5E5E5] hover:border-[#D4AF37] bg-white font-semibold text-sm text-gray-800 relative transition-colors shrink-0"
      data-testid="stays-filters-btn"
    >
      <SlidersHorizontal size={16} />
      <span className="hidden sm:inline">{t('stays.filters', 'Filters')}</span>
      {filterCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#D4AF37] text-white text-[10px] font-bold flex items-center justify-center">
          {filterCount}
        </span>
      )}
    </button>
  </div>
);

const SearchSegment = ({ label, icon: Icon, children, testid }) => (
  <div className="flex-1 px-4 py-2 flex items-center gap-2 min-w-0" data-testid={testid}>
    <Icon size={14} className="text-gray-400 shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      {children}
    </div>
  </div>
);

const AreaRow = ({ area, properties, onCardClick, onSeeAll, likedIds, onToggleLike, t }) => {
  const scrollRef = React.useRef(null);
  const isRtl = useIsRtl();
  // In RTL the container's scrollLeft is reversed by the browser, so
  // we flip the direction parameter — clicking the LEFT chevron still
  // moves the visual flow "back" one card regardless of locale.
  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const sign = isRtl ? -1 : 1;
    scrollRef.current.scrollBy({ left: dir * sign * 320, behavior: 'smooth' });
  };
  // Pick a chevron that visually points "forward" in the current
  // reading direction — RTL "next/see-more" is on the LEFT.
  const ForwardChevron = isRtl ? ChevronLeft : ChevronRight;
  return (
    <section data-testid={`stays-area-section-${area}`}>
      {/* Compact Airbnb-style header: single-line title with inline arrow,
          carousel chevrons sit on the far end. */}
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
              aria-label="Scroll back"
            >
              {isRtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
            <button
              onClick={() => scroll(1)}
              className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:border-gray-900 transition-colors"
              aria-label="Scroll forward"
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
            onClick={() => onCardClick(p.id)}
          />
        ))}
      </div>
    </section>
  );
};

const StaysCard = ({ property, onClick, fullWidth = false, liked = false, onToggleLike }) => {
  const cover = getCoverImage(property.images, 400, '', property.videos, property.id);
  const sym = (property.currency || 'ILS') === 'ILS' ? '₪' : '$';
  const price = property.rental_type === 'vacation' ? property.nightly_price : property.monthly_price;
  const unit = property.rental_type === 'vacation' ? 'night' : 'month';
  // Compact carousel card sizing — smaller on mobile so ~2 are visible
  // at a glance, bumping up on tablet/desktop. Mirrors Airbnb's density.
  const sizeClasses = fullWidth
    ? 'w-full'
    : 'snap-start shrink-0 w-[180px] sm:w-[200px] lg:w-[220px]';
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }}
      className={`${sizeClasses} bg-transparent text-left group cursor-pointer`}
      data-testid={`stays-card-${property.id}`}
    >
      {/* Flat, borderless image with rounded corners + favorite heart.
          Square aspect matches Airbnb's grid density better than the
          previous 16:11 cards. */}
      <div
        className="relative aspect-square w-full bg-gray-100 rounded-xl overflow-hidden"
        style={{ backgroundImage: `url(${cover.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {cover.isDefault && <DefaultImageBadge />}
        {cover.fromVideo && <VideoCoverBadge />}
        {/* Interactive favorite heart — fills red when liked. */}
        <button
          type="button"
          onClick={(e) => onToggleLike?.(e)}
          className="absolute top-2 end-2 p-1.5 rounded-full hover:scale-110 active:scale-95 transition-transform"
          aria-label={liked ? 'Remove from favorites' : 'Save to favorites'}
          aria-pressed={liked}
          data-testid={`stays-card-like-${property.id}`}
        >
          <Heart
            size={22}
            strokeWidth={2}
            className={liked ? 'text-[#FF385C]' : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]'}
            fill={liked ? '#FF385C' : 'rgba(0,0,0,0.35)'}
          />
        </button>
      </div>
      <div className="pt-2 px-0.5">
        <p className="font-semibold text-sm text-gray-900 truncate">{property.title}</p>
        <p className="text-xs text-gray-500 truncate">{property.area}</p>
        {price ? (
          <p className="text-xs mt-0.5 text-gray-900">
            <span className="font-semibold">{sym}{price.toLocaleString()}</span>
            <span className="text-gray-500"> / {unit}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">Price on request</p>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Filters modal
// ---------------------------------------------------------------------------

const ALL_AMENITIES = [
  'WiFi', 'Pool', 'AC', 'Kitchen', 'Parking', 'Washer', 'Dryer', 'TV',
  'Workspace', 'Pet-friendly', 'Sea view', 'Balcony', 'Elevator', 'Gym',
];

const FiltersModal = ({ onClose, priceMin, setPriceMin, priceMax, setPriceMax, bedrooms, setBedrooms, subType, setSubType, amenities, setAmenities, checkin, setCheckin, checkout, setCheckout, totalCount, t }) => {
  const toggleAmenity = (a) => {
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };
  const clearAll = () => {
    setPriceMin(''); setPriceMax(''); setBedrooms(''); setSubType(''); setAmenities([]);
    setCheckin(''); setCheckout('');
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose} data-testid="stays-filters-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('stays.filters', 'Filters')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" data-testid="stays-filters-close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Dates — surfaced inside the modal so mobile users (where the
              search bar's date segments are hidden) can still set them. */}
          <div className="sm:hidden">
            <h3 className="text-sm font-bold mb-2">{t('stays.dates', 'Dates')}</h3>
            <div className="flex gap-3">
              <input
                type="date"
                value={checkin}
                onChange={(e) => setCheckin(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                data-testid="stays-filter-checkin"
              />
              <input
                type="date"
                value={checkout}
                min={checkin || undefined}
                onChange={(e) => setCheckout(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                data-testid="stays-filter-checkout"
              />
            </div>
          </div>
          {/* Sub-type — vacation / short-term / long-term */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.stayType', 'Stay type')}</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { v: '', label: t('stays.any', 'Any') },
                { v: 'vacation', label: t('property.vacationType', 'Vacation') },
                { v: 'short-term', label: t('property.shortTerm', 'Short-term') },
                { v: 'long-term', label: t('property.longTerm', 'Long-term') },
              ].map((o) => (
                <button
                  key={o.v || 'any'}
                  onClick={() => setSubType(o.v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    subType === o.v ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                  }`}
                  data-testid={`stays-filter-subtype-${o.v || 'any'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {/* Price range */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.priceRange', 'Price range')}</h3>
            <div className="flex gap-3">
              <input
                type="number" placeholder={t('stays.min', 'Min')}
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                data-testid="stays-filter-price-min"
              />
              <input
                type="number" placeholder={t('stays.max', 'Max')}
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                data-testid="stays-filter-price-max"
              />
            </div>
          </div>
          {/* Bedrooms */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.bedrooms', 'Bedrooms')}</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { v: '', label: t('stays.any', 'Any') },
                { v: '1', label: '1' },
                { v: '2', label: '2' },
                { v: '3', label: '3' },
                { v: '4', label: '4+' },
              ].map((o) => (
                <button
                  key={o.v || 'any'}
                  onClick={() => setBedrooms(o.v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    bedrooms === o.v ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                  }`}
                  data-testid={`stays-filter-bedrooms-${o.v || 'any'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {/* Amenities */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.amenities', 'Amenities')}</h3>
            <div className="flex flex-wrap gap-2">
              {ALL_AMENITIES.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAmenity(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    amenities.includes(a) ? 'bg-[#D4AF37] text-white border-[#D4AF37]' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                  }`}
                  data-testid={`stays-filter-amenity-${a.replace(/\s/g, '-')}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button onClick={clearAll} className="text-sm font-semibold text-gray-600 hover:text-gray-900 underline" data-testid="stays-filters-clear">
            {t('stays.clearAll', 'Clear all')}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid="stays-filters-apply"
          >
            {t('stays.showCount', { count: totalCount, defaultValue: `Show ${totalCount} stays` })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Stays;
