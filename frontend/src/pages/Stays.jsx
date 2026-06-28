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
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, SlidersHorizontal, MapPin, Calendar, X, ChevronRight, ChevronLeft, Loader2,
} from 'lucide-react';
import { getCoverImage } from '../utils/coverImage';
import DefaultImageBadge from '../components/property/DefaultImageBadge';
import VideoCoverBadge from '../components/property/VideoCoverBadge';

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
      if (where && p.area !== where) return false;
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

  const activeFilterCount =
    (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (bedrooms ? 1 : 0) +
    (subType ? 1 : 0) + amenities.length;

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

  return (
    <div className="min-h-screen bg-[#FAFAF7] pt-[200px] md:pt-[152px]" data-testid="stays-page">
      {/* Fixed top search bar — sits just below the global Navigation.
          The nav is 123px tall on mobile (logo row + Stays/Services tab
          strip) and 68px on md+ screens, so we use a responsive `top`. */}
      <div className="fixed top-[123px] md:top-[68px] left-0 right-0 z-30 bg-white border-b border-[#E5E5E5] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <StaysSearchBar
            where={where} setWhere={setWhere}
            checkin={checkin} setCheckin={setCheckin}
            checkout={checkout} setCheckout={setCheckout}
            areaOptions={areaOptions}
            onOpenFilters={() => setShowFilters(true)}
            filterCount={activeFilterCount}
            t={t}
          />
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
        <div className="max-w-7xl mx-auto px-4 py-6" data-testid="stays-results-grid">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <StaysCard
                key={p.id}
                property={p}
                fullWidth
                onClick={() => {
                  sessionStorage.setItem('previousPath', '/stays' + window.location.search);
                  navigate(`/property/${p.id}`);
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
          {grouped.map(([area, props]) => (
            <AreaRow
              key={area}
              area={area}
              properties={props}
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

const StaysSearchBar = ({ where, setWhere, checkin, setCheckin, checkout, setCheckout, areaOptions, onOpenFilters, filterCount, t }) => (
  <div className="flex items-stretch gap-2" data-testid="stays-search-bar">
    {/* 3-segment pill: Where | Check in | Check out — Airbnb-style.
        Date segments are hidden on mobile to keep the bar uncluttered;
        users access them from the Filters modal instead. */}
    <div className="flex-1 flex items-stretch bg-[#F5F5F0] rounded-full overflow-hidden border border-[#E5E5E5] hover:border-[#D4AF37] transition-colors">
      <SearchSegment label={t('stays.where', 'Where')} icon={MapPin} testid="stays-where">
        <select
          value={where}
          onChange={(e) => setWhere(e.target.value)}
          className="bg-transparent text-sm font-medium text-gray-800 outline-none w-full cursor-pointer"
          data-testid="stays-where-select"
        >
          <option value="">{t('stays.anywhere', 'Anywhere')}</option>
          {areaOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </SearchSegment>
      <div className="hidden sm:block w-px bg-[#E5E5E5] my-2" />
      <div className="hidden sm:flex flex-1">
        <SearchSegment label={t('stays.checkIn', 'Check in')} icon={Calendar} testid="stays-checkin">
          <input
            type="date"
            value={checkin}
            onChange={(e) => setCheckin(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-800 outline-none w-full cursor-pointer"
            data-testid="stays-checkin-input"
          />
        </SearchSegment>
      </div>
      <div className="hidden sm:block w-px bg-[#E5E5E5] my-2" />
      <div className="hidden sm:flex flex-1">
        <SearchSegment label={t('stays.checkOut', 'Check out')} icon={Calendar} testid="stays-checkout">
          <input
            type="date"
            value={checkout}
            min={checkin || undefined}
            onChange={(e) => setCheckout(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-800 outline-none w-full cursor-pointer"
            data-testid="stays-checkout-input"
          />
        </SearchSegment>
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

const AreaRow = ({ area, properties, onCardClick, onSeeAll, t }) => {
  const scrollRef = React.useRef(null);
  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };
  return (
    <section data-testid={`stays-area-section-${area}`}>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
            {t('stays.staysIn', 'Stays in')} {area}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {properties.length} {properties.length === 1 ? t('stays.listing', 'listing') : t('stays.listings', 'listings')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {properties.length > 3 && (
            <>
              <button onClick={() => scroll(-1)} className="hidden md:flex w-8 h-8 rounded-full border border-[#E5E5E5] items-center justify-center hover:border-[#D4AF37]" aria-label="Scroll left">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => scroll(1)} className="hidden md:flex w-8 h-8 rounded-full border border-[#E5E5E5] items-center justify-center hover:border-[#D4AF37]" aria-label="Scroll right">
                <ChevronRight size={14} />
              </button>
            </>
          )}
          <button onClick={onSeeAll} className="ml-1 text-xs font-semibold text-[#1E6A6A] hover:underline flex items-center gap-1" data-testid={`stays-see-all-${area}`}>
            {t('stays.seeAll', 'See all')} <ChevronRight size={12} />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-2 px-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {properties.slice(0, 12).map((p) => (
          <StaysCard key={p.id} property={p} onClick={() => onCardClick(p.id)} />
        ))}
      </div>
    </section>
  );
};

const StaysCard = ({ property, onClick, fullWidth = false }) => {
  const cover = getCoverImage(property.images, 400, '', property.videos, property.id);
  const sym = (property.currency || 'ILS') === 'ILS' ? '₪' : '$';
  const price = property.rental_type === 'vacation' ? property.nightly_price : property.monthly_price;
  const unit = property.rental_type === 'vacation' ? 'night' : 'month';
  const sizeClasses = fullWidth
    ? 'w-full'
    : 'snap-start shrink-0 w-[260px] sm:w-[280px]';
  return (
    <button
      onClick={onClick}
      className={`${sizeClasses} bg-white rounded-xl border border-[#E5E5E5] overflow-hidden hover:border-[#D4AF37] hover:shadow-md transition-all text-left`}
      data-testid={`stays-card-${property.id}`}
    >
      <div
        className="relative h-44 bg-gray-100"
        style={{ backgroundImage: `url(${cover.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {cover.isDefault && <DefaultImageBadge />}
        {cover.fromVideo && <VideoCoverBadge />}
      </div>
      <div className="p-3">
        <p className="font-bold text-sm truncate">{property.title}</p>
        <p className="text-xs text-gray-500 truncate">{property.area}</p>
        {price ? (
          <p className="text-sm mt-1">
            <span className="font-bold">{sym}{price.toLocaleString()}</span>
            <span className="text-xs text-gray-500"> / {unit}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-1">Price on request</p>
        )}
      </div>
    </button>
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
