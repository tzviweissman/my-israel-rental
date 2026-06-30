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
import { format } from 'date-fns';
import {
  Search, SlidersHorizontal, MapPin, Calendar, X, ChevronRight, ChevronLeft, Loader2, Heart,
} from 'lucide-react';
import { getCoverImage } from '../utils/coverImage';
import DefaultImageBadge from '../components/property/DefaultImageBadge';
import VideoCoverBadge from '../components/property/VideoCoverBadge';
import WhenPicker, { flexLabel } from '../components/search/WhenPicker';
import WherePicker from '../components/search/WherePicker';
import StayTypePicker from '../components/search/StayTypePicker';
import QuickChips from '../components/search/QuickChips';
import PageMeta from '../components/PageMeta';
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
  // Flexible-mode window — Airbnb-style "A week in October". Persists
  // to the URL as `?flex=week:2026-10`. When set, `checkin`/`checkout`
  // are blanked; the filter widens to any N-night sub-window of the
  // chosen month.
  const [flexible, setFlexible] = useState(() => {
    const raw = searchParams.get('flex');
    if (!raw) return null;
    const [stayLength, monthIso] = raw.split(':');
    if (!stayLength || !monthIso) return null;
    return { stayLength, monthIso };
  });
  const [priceMin, setPriceMin] = useState(searchParams.get('priceMin') || '');
  const [priceMax, setPriceMax] = useState(searchParams.get('priceMax') || '');
  // Currency the price-range numbers are typed in. Defaults to ILS
  // since most listings on the platform are Israeli. URL-persisted as
  // `?cur=USD` when the renter flips to dollars so the conversion is
  // reproducible across shares.
  const [priceCurrency, setPriceCurrency] = useState(searchParams.get('cur') === 'USD' ? 'USD' : 'ILS');
  const [bedrooms, setBedrooms] = useState(searchParams.get('bedrooms') || '');
  const [bathrooms, setBathrooms] = useState(searchParams.get('bathrooms') || '');
  const [porches, setPorches] = useState(searchParams.get('porches') || '');
  const [condition, setCondition] = useState(searchParams.get('condition') || '');
  const [furnished, setFurnished] = useState(searchParams.get('furnished') === '1');
  const [hasElevator, setHasElevator] = useState(searchParams.get('elevator') === '1');
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
    if (flexible) {
      next.set('flex', `${flexible.stayLength}:${flexible.monthIso}`);
    } else {
      if (checkin) next.set('checkin', checkin);
      if (checkout) next.set('checkout', checkout);
    }
    if (priceMin) next.set('priceMin', priceMin);
    if (priceMax) next.set('priceMax', priceMax);
    // Only write `cur` when it diverges from the ILS default so URLs
    // stay clean for the typical Israeli renter.
    if (priceCurrency === 'USD') next.set('cur', 'USD');
    if (bedrooms) next.set('bedrooms', bedrooms);
    if (bathrooms) next.set('bathrooms', bathrooms);
    if (porches) next.set('porches', porches);
    if (condition) next.set('condition', condition);
    if (furnished) next.set('furnished', '1');
    if (hasElevator) next.set('elevator', '1');
    if (subType) next.set('subType', subType);
    if (amenities.length) next.set('amenities', amenities.join(','));
    setSearchParams(next, { replace: true });
  }, [where, checkin, checkout, flexible, priceMin, priceMax, priceCurrency, bedrooms, bathrooms, porches, condition, furnished, hasElevator, subType, amenities, setSearchParams]);

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
    // Pre-compute the flexible window's edges so we don't recompute
    // them per property. A flexible "week in October" matches any
    // property whose `available_from` allows at least one N-night
    // sub-window within that month, AND whose `available_to` (if
    // set) extends past at least one such window. We use a simple
    // overlap test that holds for any contiguous N-night stay.
    let flexBounds = null;
    if (flexible) {
      const [y, m] = flexible.monthIso.split('-').map(Number);
      if (y && m) {
        const N = flexible.stayLength === 'weekend' ? 2 : flexible.stayLength === 'month' ? 28 : 7;
        const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        // For an N-night stay to fit somewhere in the month, the
        // property must be available by `monthEnd - N + 1` and stay
        // available past `monthStart + N - 1`.
        const latestPossibleCheckin = new Date(y, m - 1, lastDay - N + 1);
        const earliestPossibleCheckout = new Date(y, m - 1, N);
        flexBounds = {
          monthStart,
          monthEnd,
          latestPossibleCheckin: format(latestPossibleCheckin, 'yyyy-MM-dd'),
          earliestPossibleCheckout: format(earliestPossibleCheckout, 'yyyy-MM-dd'),
        };
      }
    }
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
      // Bathrooms / porches use min-N semantics so "1+" matches any.
      if (bathrooms) {
        const n = parseInt(bathrooms, 10);
        if ((p.bathrooms || 0) < n) return false;
      }
      if (porches) {
        const n = parseInt(porches, 10);
        if ((p.porches || 0) < n) return false;
      }
      if (condition && p.condition !== condition) return false;
      if (furnished && !p.furnished) return false;
      if (hasElevator && !p.has_elevator) return false;
      const price = p.rental_type === 'vacation' ? p.nightly_price : p.monthly_price;
      // Convert the listing's price into the renter's chosen filter
      // currency before comparing. FX rate matches the constant used by
      // Properties.js / backend fallback so all conversions stay in
      // sync. Properties with no `currency` field default to ILS.
      let priceInFilterCurrency = price || 0;
      if (price && (p.currency || 'ILS') !== priceCurrency) {
        const FX_USD_TO_ILS = 3.65;
        const propCur = p.currency || 'ILS';
        if (priceCurrency === 'USD' && propCur === 'ILS') {
          priceInFilterCurrency = price / FX_USD_TO_ILS;
        } else if (priceCurrency === 'ILS' && propCur === 'USD') {
          priceInFilterCurrency = price * FX_USD_TO_ILS;
        }
      }
      if (priceMin && priceInFilterCurrency < parseFloat(priceMin)) return false;
      if (priceMax && priceInFilterCurrency > parseFloat(priceMax)) return false;
      if (amenities.length && !amenities.every((a) => (p.amenities || []).includes(a))) return false;
      // Flexible-mode availability — property must allow at least one
      // N-night sub-window anywhere in the chosen month.
      if (flexBounds) {
        if (p.available_from && p.available_from > flexBounds.latestPossibleCheckin) return false;
        if (p.available_to && p.available_to < flexBounds.earliestPossibleCheckout) return false;
      } else {
        // Precise-dates availability — checkin must be on/after the
        // listing's available_from, checkout on/before available_to.
        if (checkin && p.available_from && checkin < p.available_from) return false;
        if (checkout && p.available_to && checkout > p.available_to) return false;
        // Sanity: checkout without a check-in shouldn't undercut
        // available_from either.
        if (checkout && !checkin && p.available_from && checkout < p.available_from) return false;
      }
      return true;
    });
  }, [allProperties, where, subType, bedrooms, bathrooms, porches, condition, furnished, hasElevator, priceMin, priceMax, priceCurrency, amenities, checkin, checkout, flexible]);

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
    (bathrooms ? 1 : 0) + (porches ? 1 : 0) + (condition ? 1 : 0) +
    (furnished ? 1 : 0) + (hasElevator ? 1 : 0) +
    amenities.length;

  // Any active search OR filter collapses the per-area rows into a single
  // flat results grid — that mirrors Airbnb's behavior once a user starts
  // narrowing down what they want.
  const isSearchActive = Boolean(
    where || checkin || checkout || flexible || priceMin || priceMax || bedrooms ||
    bathrooms || porches || condition || furnished || hasElevator || subType || amenities.length,
  );

  const clearAllFilters = () => {
    setWhere(''); setCheckin(''); setCheckout(''); setFlexible(null);
    setSubType(''); setBedrooms(''); setBathrooms(''); setPorches('');
    setCondition(''); setFurnished(false); setHasElevator(false);
    setPriceMin(''); setPriceMax(''); setAmenities([]);
  };

  // Shared favorites state — drives the interactive heart on every card.
  const { likedIds, toggleLike } = useFavorites();

  return (
    <div
      className="min-h-screen bg-[#FAFAF7]"
      style={{
        // Only the global nav stays fixed — the search bar scrolls
        // away with the page so the cards have the full viewport.
        paddingTop: 'var(--nav-h, 68px)',
        // Leave room at the bottom so the floating WhatsApp + a11y FABs
        // (~64px tall + their 24px safe-area offset) never cover the
        // last row of property cards on mobile.
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)',
      }}
      data-testid="stays-page"
    >
      <PageMeta
        title="Stays in Israel — Long-term, short-term & vacation rentals | MyIsraelRental"
        description="Discover stays across Israel — vacation apartments, short-term lets and long-term rentals in Jerusalem, Tel Aviv, Haifa and beyond. Filter by area, dates, price and amenities."
        path="/stays"
      />
      {/* Inline (non-sticky) search bar — sits flush below the global
          nav at the top of the page and scrolls away with the rest of
          the content as the user explores. Previously this was
          `position: fixed`; user asked for it not to follow on scroll. */}
      <div
        className="bg-white border-b border-[#E5E5E5]"
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <StaysSearchBar
            where={where} setWhere={setWhere}
            checkin={checkin} setCheckin={setCheckin}
            checkout={checkout} setCheckout={setCheckout}
            flexible={flexible} setFlexible={setFlexible}
            subType={subType} setSubType={setSubType}
            areaOptions={areaOptions}
            onOpenFilters={() => setShowFilters(true)}
            filterCount={activeFilterCount}
            t={t}
          />
          {/* Mobile-only one-tap date presets — sit inside the fixed
              bar so they're always reachable while scrolling. Setting
              a preset date range implicitly clears Flexible mode. */}
          <div className="mt-2">
            <QuickChips
              variant="light"
              onPick={({ checkin: ci, checkout: co }) => {
                setCheckin(ci); setCheckout(co); setFlexible(null);
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
              {flexible ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  {flexLabel(flexible, t)}
                </p>
              ) : (checkin || checkout) && (
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
                displayCurrency={priceCurrency}
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
              displayCurrency={priceCurrency}
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
          priceCurrency={priceCurrency} setPriceCurrency={setPriceCurrency}
          bedrooms={bedrooms} setBedrooms={setBedrooms}
          bathrooms={bathrooms} setBathrooms={setBathrooms}
          porches={porches} setPorches={setPorches}
          condition={condition} setCondition={setCondition}
          furnished={furnished} setFurnished={setFurnished}
          hasElevator={hasElevator} setHasElevator={setHasElevator}
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

const StaysSearchBar = ({ where, setWhere, checkin, setCheckin, checkout, setCheckout, flexible, setFlexible, subType, setSubType, areaOptions, onOpenFilters, filterCount, t }) => (
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
          flexible={flexible}
          onChange={({ checkin: ci, checkout: co, flexible: fx }) => {
            setCheckin(ci || '');
            setCheckout(co || '');
            setFlexible(fx || null);
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

const AreaRow = ({ area, properties, onCardClick, onSeeAll, likedIds, onToggleLike, displayCurrency, t }) => {
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
            displayCurrency={displayCurrency}
            onClick={() => onCardClick(p.id)}
          />
        ))}
      </div>
    </section>
  );
};

const StaysCard = ({ property, onClick, fullWidth = false, liked = false, onToggleLike, displayCurrency = null }) => {
  const cover = getCoverImage(property.images, 400, '', property.videos, property.id);
  const propCur = property.currency || 'ILS';
  const sym = propCur === 'ILS' ? '₪' : '$';
  const price = property.rental_type === 'vacation' ? property.nightly_price : property.monthly_price;
  const unit = property.rental_type === 'vacation' ? 'night' : 'month';
  // When the renter has flipped the search bar's currency toggle to
  // something different from the listing's native currency, show a
  // small "≈ $X" hint underneath the headline price so they can
  // mentally compare against their own budget without doing FX math.
  // Uses the same constant the filter chain uses (3.65 ILS per USD).
  let convertedHint = null;
  if (price && displayCurrency && displayCurrency !== propCur) {
    const FX_USD_TO_ILS = 3.65;
    let converted = price;
    if (displayCurrency === 'USD' && propCur === 'ILS') converted = price / FX_USD_TO_ILS;
    else if (displayCurrency === 'ILS' && propCur === 'USD') converted = price * FX_USD_TO_ILS;
    const convSym = displayCurrency === 'ILS' ? '₪' : '$';
    convertedHint = `≈ ${convSym}${Math.round(converted).toLocaleString()}`;
  }
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
          <>
            <p className="text-xs mt-0.5 text-gray-900">
              <span className="font-semibold">{sym}{price.toLocaleString()}</span>
              <span className="text-gray-500"> / {unit}</span>
            </p>
            {convertedHint && (
              <p className="text-[11px] text-gray-400" data-testid={`stays-card-fx-${property.id}`}>
                {convertedHint} / {unit}
              </p>
            )}
          </>
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

// Amenities the renter can multi-select. `Elevator` + `Balcony` were
// removed from this list because they now live as first-class chips
// in the Features / Porches sections of the modal (where they filter
// against typed property fields rather than the loose amenities[]
// string array — avoiding two competing filters for the same concept).
const ALL_AMENITIES = [
  'WiFi', 'Pool', 'AC', 'Kitchen', 'Parking', 'Washer', 'Dryer', 'TV',
  'Workspace', 'Pet-friendly', 'Sea view', 'Gym',
];

// Small chip-row helper used inside FiltersModal — renders a row of
// pill chips for a min-N or value-match style filter. Hoisted out of
// the modal so React doesn't unmount its subtree on every parent render.
const ChipRow = ({ value, onChange, options, testidPrefix }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => (
      <button
        key={o.v || 'any'}
        type="button"
        onClick={() => onChange(o.v)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          value === o.v ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
        }`}
        data-testid={`${testidPrefix}-${o.v || 'any'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const FiltersModal = ({
  onClose,
  priceMin, setPriceMin, priceMax, setPriceMax,
  priceCurrency, setPriceCurrency,
  bedrooms, setBedrooms,
  bathrooms, setBathrooms,
  porches, setPorches,
  condition, setCondition,
  furnished, setFurnished,
  hasElevator, setHasElevator,
  subType, setSubType,
  amenities, setAmenities,
  checkin, setCheckin, checkout, setCheckout,
  totalCount, t,
}) => {
  const toggleAmenity = (a) => {
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };
  const clearAll = () => {
    setPriceMin(''); setPriceMax(''); setBedrooms(''); setBathrooms('');
    setPorches(''); setCondition(''); setFurnished(false); setHasElevator(false);
    setSubType(''); setAmenities([]);
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
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">{t('stays.priceRange', 'Price range')}</h3>
              {/* Currency segmented control — flipping it does NOT
                  reconvert the typed numbers (renters usually retype to
                  a "round" budget in the new currency anyway). It only
                  changes how listings are converted before the
                  comparison. */}
              <div
                className="flex bg-gray-100 rounded-full p-0.5 text-[11px] font-bold"
                data-testid="stays-filter-currency"
              >
                <button
                  type="button"
                  onClick={() => setPriceCurrency('ILS')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    priceCurrency === 'ILS' ? 'bg-black text-[#D4AF37]' : 'text-gray-600'
                  }`}
                  data-testid="stays-filter-currency-ils"
                >
                  ₪ ILS
                </button>
                <button
                  type="button"
                  onClick={() => setPriceCurrency('USD')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    priceCurrency === 'USD' ? 'bg-black text-[#D4AF37]' : 'text-gray-600'
                  }`}
                  data-testid="stays-filter-currency-usd"
                >
                  $ USD
                </button>
              </div>
            </div>
            <div className="flex gap-3 items-stretch">
              <div className="flex-1 flex items-center rounded-lg border border-gray-200 focus-within:border-[#D4AF37] overflow-hidden">
                <span className="ps-3 text-gray-500 text-sm select-none">
                  {priceCurrency === 'ILS' ? '₪' : '$'}
                </span>
                <input
                  type="number" placeholder={t('stays.min', 'Min')}
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="flex-1 px-2 py-2 text-sm focus:outline-none bg-transparent"
                  data-testid="stays-filter-price-min"
                />
              </div>
              <div className="flex-1 flex items-center rounded-lg border border-gray-200 focus-within:border-[#D4AF37] overflow-hidden">
                <span className="ps-3 text-gray-500 text-sm select-none">
                  {priceCurrency === 'ILS' ? '₪' : '$'}
                </span>
                <input
                  type="number" placeholder={t('stays.max', 'Max')}
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="flex-1 px-2 py-2 text-sm focus:outline-none bg-transparent"
                  data-testid="stays-filter-price-max"
                />
              </div>
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
          {/* Bathrooms — min-N semantics. "2+" matches 2, 3, 4. */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.bathrooms', 'Bathrooms')}</h3>
            <ChipRow
              value={bathrooms}
              onChange={setBathrooms}
              testidPrefix="stays-filter-bathrooms"
              options={[
                { v: '', label: t('stays.any', 'Any') },
                { v: '1', label: '1+' },
                { v: '2', label: '2+' },
                { v: '3', label: '3+' },
              ]}
            />
          </div>
          {/* Porches / balconies — counts as "outdoor space" filter. */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.porches', 'Porches / Balcony')}</h3>
            <ChipRow
              value={porches}
              onChange={setPorches}
              testidPrefix="stays-filter-porches"
              options={[
                { v: '', label: t('stays.any', 'Any') },
                { v: '1', label: '1+' },
                { v: '2', label: '2+' },
              ]}
            />
          </div>
          {/* Property condition */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.condition', 'Property condition')}</h3>
            <ChipRow
              value={condition}
              onChange={setCondition}
              testidPrefix="stays-filter-condition"
              options={[
                { v: '', label: t('stays.any', 'Any') },
                { v: 'renovated', label: t('property.renovated', 'Renovated') },
                { v: 'partially_renovated', label: t('property.partiallyRenovated', 'Partially renovated') },
                { v: 'good', label: t('property.goodCondition', 'Good condition') },
              ]}
            />
          </div>
          {/* Features — furnished + elevator render as on/off toggle pills
              instead of a separate switch widget, matching the rest of
              the modal's chip vocabulary. */}
          <div>
            <h3 className="text-sm font-bold mb-2">{t('stays.features', 'Features')}</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFurnished((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  furnished ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                }`}
                data-testid="stays-filter-furnished"
              >
                {t('property.furnished', 'Furnished')}
              </button>
              <button
                type="button"
                onClick={() => setHasElevator((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  hasElevator ? 'bg-black text-[#D4AF37] border-black' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D4AF37]'
                }`}
                data-testid="stays-filter-elevator"
              >
                {t('property.elevator', 'Elevator')}
              </button>
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
