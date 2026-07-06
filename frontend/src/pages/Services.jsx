/**
 * Services Marketplace hub — Phase 2 (Trust & Discovery UI).
 *
 * All filtering is now server-side: category, location, free-text query,
 * min/max price, min rating, response time, languages, booking mode, and
 * sort order are pushed straight to `/api/marketplace/gigs` so the
 * backend applies the same logic that powers server-side sort ties,
 * top-rated boosts, and rating-count floors.
 *
 * URL state persists every filter so a screenshot-worthy filtered view
 * is always deep-linkable (e.g. shareable /services?category=photography&min_rating=4&sort=rating).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Search, ArrowRight, Loader2, SlidersHorizontal, Award, Zap, MapPin } from 'lucide-react';
import { API } from '../App';
import PageMeta from '../components/PageMeta';
import StarRating from '../components/marketplace/StarRating';
import CategoryCarousel from '../components/marketplace/CategoryCarousel';
import LocationChipsRow from '../components/marketplace/LocationChipsRow';
import ServicesFiltersModal from '../components/marketplace/ServicesFiltersModal';
import { localizedTitle } from '../utils/gigLocale';

const TEAL = '#1E6A6A';
const GOLD = '#D4AF37';

// Sort options the dropdown surfaces — keys map 1:1 to the backend
// `sort` query param (see `list_gigs` in routes/marketplace.py).
const SORT_OPTIONS = [
  { value: 'match',     labelKey: 'services.sort.match',     fallback: 'Best match' },
  { value: 'rating',    labelKey: 'services.sort.rating',    fallback: 'Highest rated' },
  { value: 'reviews',   labelKey: 'services.sort.reviews',   fallback: 'Most reviewed' },
  { value: 'newest',    labelKey: 'services.sort.newest',    fallback: 'Newest first' },
  { value: 'price_asc', labelKey: 'services.sort.priceAsc',  fallback: 'Price: low to high' },
  { value: 'distance',  labelKey: 'services.sort.distance',  fallback: 'Nearest to me', requiresCoords: true },
];

const GigCard = ({ gig, onClick, i18n, t }) => {
  const cover = gig.gallery?.[0];
  const cheapest = gig.cheapest_price;
  const currency = gig.tiers?.[0]?.currency || 'ILS';
  const sym = currency === 'ILS' ? '₪' : '$';
  const bucket = gig.provider?.response_bucket;
  return (
    <button
      onClick={onClick}
      className="text-left group"
      data-testid={`services-gig-${gig.id}`}
    >
      <div
        className="relative aspect-square w-full bg-gray-100 rounded-xl overflow-hidden mb-2"
        style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {!cover && (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            No image
          </div>
        )}
        {/* Top-Rated overlay pill */}
        {gig.is_top_rated && (
          <span
            className="absolute top-2 start-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow"
            style={{ background: GOLD, color: '#1E6A6A' }}
            data-testid={`gig-top-rated-${gig.id}`}
          >
            <Award size={10} />
            {t('services.topRated', 'Top rated')}
          </span>
        )}
        {/* Response-time chip */}
        {bucket && (
          <span
            className="absolute bottom-2 end-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/95 text-emerald-700 shadow"
            data-testid={`gig-response-${gig.id}`}
          >
            <Zap size={10} />
            {bucket === '1h'
              ? t('services.replies1h', 'Replies in 1h')
              : t('services.replies24h', 'Replies in 24h')}
          </span>
        )}
      </div>
      <p className="font-semibold text-sm text-gray-900 truncate">
        {localizedTitle(gig, i18n)}
      </p>
      <p className="text-xs text-gray-500 truncate">
        {gig.provider?.name}{gig.area ? ` · ${gig.area}` : ''}
        {typeof gig.distance_km === 'number' && (
          <span className="ms-1 inline-flex items-center gap-0.5 text-[10px] text-[#1E6A6A] font-semibold">
            · {gig.distance_km < 1
              ? `${Math.round(gig.distance_km * 1000)} m`
              : `${gig.distance_km.toFixed(gig.distance_km < 10 ? 1 : 0)} km`}
          </span>
        )}
      </p>
      {(gig.rating_count > 0) && (
        <div className="mt-0.5">
          <StarRating value={gig.rating_avg || 0} count={gig.rating_count} size={12} testidPrefix={`gig-stars-${gig.id}`} />
        </div>
      )}
      {cheapest != null && (
        <p className="text-xs mt-0.5 text-gray-900">
          <span className="text-gray-500">{t('services.from', 'from')} </span>
          <span className="font-semibold">{sym}{cheapest.toLocaleString()}</span>
        </p>
      )}
    </button>
  );
};

// Convert the URL params snapshot into the same shape the FiltersModal
// consumes. Kept at module scope so the identity is stable.
const readFilters = (params) => ({
  selectedCat: params.get('category') || '',
  selectedLoc: params.get('location') || '',
  q: params.get('q') || '',
  minRating: params.get('min_rating') || '',
  minPrice: params.get('min_price') || '',
  maxPrice: params.get('max_price') || '',
  responseTime: params.get('response_time') || '',
  languages: (params.get('languages') || '').split(',').filter(Boolean),
  bookingMode: params.get('booking_mode') || '',
  sort: params.get('sort') || 'match',
  // Nearby-mode: only active when both lat/lng are present. Coords aren't
  // persisted to the URL so a shared /services link never leaks anyone's
  // location — nearby always requires a fresh geolocation opt-in.
  nearby: params.get('nearby') === '1',
});

const Services = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [languagesList, setLanguagesList] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Nearby-mode local state — coords live in memory only, never on the
  // URL, so shared links can't leak location. Cleared on tab close.
  const [coords, setCoords] = useState(null);
  const [geoBusy, setGeoBusy] = useState(false);

  const state = readFilters(searchParams);
  const {
    selectedCat, selectedLoc, q,
    minRating, minPrice, maxPrice, responseTime, languages, bookingMode, sort, nearby,
  } = state;

  // One-shot fetches — categories/locations/languages don't change.
  useEffect(() => {
    Promise.all([
      axios.get(`${API}/marketplace/categories`).then((r) => setCategories(r.data)),
      axios.get(`${API}/marketplace/locations`).then((r) => setLocations(r.data)),
      axios.get(`${API}/marketplace/languages`).then((r) => setLanguagesList(r.data)),
    ]).catch((e) => {
      console.error(e);
      toast.error(t('services.loadError', 'Failed to load marketplace'));
    });
  }, []);

  // Re-fetch gigs whenever any server-side filter changes. Backend does
  // all the heavy lifting so the client is a thin cache.
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCat)   params.set('category', selectedCat);
    if (selectedLoc)   params.set('location', selectedLoc);
    if (q)             params.set('q', q);
    if (minRating)     params.set('min_rating', minRating);
    if (minPrice)      params.set('min_price', minPrice);
    if (maxPrice)      params.set('max_price', maxPrice);
    if (responseTime)  params.set('response_time', responseTime);
    if (languages.length) params.set('languages', languages.join(','));
    if (bookingMode)   params.set('booking_mode', bookingMode);
    if (sort && sort !== 'match') params.set('sort', sort);
    // Nearby-mode: only send lat/lng when both the toggle is on AND
    // coords are available. The backend will silently degrade sort to
    // `match` if coords are absent when sort=distance was requested.
    if (nearby && coords) {
      params.set('lat', coords.lat.toFixed(4));
      params.set('lng', coords.lng.toFixed(4));
    }
    setLoading(true);
    axios.get(`${API}/marketplace/gigs?${params.toString()}`)
      .then((r) => setGigs(r.data))
      .catch((e) => { console.error(e); toast.error(t('services.loadError', 'Failed to load')); })
      .finally(() => setLoading(false));
  }, [
    selectedCat, selectedLoc, q,
    minRating, minPrice, maxPrice, responseTime,
    // Joined to a primitive so the effect doesn't fire on identity change alone.
    languages.join(','), bookingMode, sort, t,
    nearby, coords?.lat, coords?.lng,
  ]);

  // Centralised URL sync — every setter goes through this so the URL is
  // always the single source of truth and back/forward buttons work.
  const patchUrl = useCallback((next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      Object.entries(next).forEach(([k, v]) => {
        if (v === '' || v == null || (Array.isArray(v) && v.length === 0)) {
          params.delete(k);
        } else if (Array.isArray(v)) {
          params.set(k, v.join(','));
        } else {
          params.set(k, String(v));
        }
      });
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Nearby toggle — asks the browser for the current position on first
  // click, wires the coords into memory, and flips `nearby=1` in the URL
  // + swaps sort to `distance`. Turning it off clears both nearby and
  // the distance sort so shared links go back to a coords-free state.
  const toggleNearby = () => {
    if (nearby) {
      setCoords(null);
      patchUrl({ nearby: '', sort: sort === 'distance' ? '' : sort });
      return;
    }
    if (!navigator?.geolocation) {
      toast.error(t('services.geoUnavailable', 'Geolocation is not supported by your browser'));
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoBusy(false);
        // sort=distance implicitly when nearby turns on so results
        // immediately re-order by proximity. Users can still switch back
        // to any other sort while keeping nearby active — the distance
        // chip stays on the card either way.
        patchUrl({ nearby: '1', sort: 'distance' });
        toast.success(t('services.nearbyOn', 'Showing services near you'));
      },
      (err) => {
        setGeoBusy(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(t('services.geoDenied', 'Location permission denied. You can re-enable it in your browser settings.'));
        } else {
          toast.error(t('services.geoFailed', 'Could not fetch your location — please try again.'));
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  };

  const applyFilters = (draft) => {
    patchUrl({
      min_rating:    draft.minRating,
      min_price:     draft.minPrice,
      max_price:     draft.maxPrice,
      response_time: draft.responseTime,
      languages:     draft.languages,
      booking_mode:  draft.bookingMode,
    });
  };

  const clearAdvancedFilters = () => {
    patchUrl({
      min_rating: '', min_price: '', max_price: '',
      response_time: '', languages: [], booking_mode: '',
    });
  };

  // How many "More filters" chips are active — drives the badge on
  // the Filters button so users can see filters are on at a glance.
  const advCount =
    (minRating ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (responseTime ? 1 : 0) +
    (languages.length ? 1 : 0) +
    (bookingMode ? 1 : 0);

  const seo = useMemo(() => {
    const catLbl = categories.find((c) => c.slug === selectedCat)?.label;
    const locLbl = locations.find((l) => l.slug === selectedLoc)?.label;
    let title = 'Services Marketplace in Israel — Cleaners, Movers, Plumbers & more | MyIsraelRental';
    let description = 'Book trusted local services in Israel — cleaning, movers, plumbers, electricians, photographers, barbers, tour guides and more. Zero booking fees, direct chat, WhatsApp-ready.';
    if (catLbl && locLbl) {
      title = `${catLbl} in ${locLbl} — Services Marketplace | MyIsraelRental`;
      description = `Find and book trusted ${catLbl.toLowerCase()} providers in ${locLbl}. Direct chat, WhatsApp booking, zero renter fees.`;
    } else if (catLbl) {
      title = `${catLbl} in Israel — Services Marketplace | MyIsraelRental`;
      description = `Book trusted ${catLbl.toLowerCase()} providers across Israel — direct chat, WhatsApp-ready, no booking fees.`;
    } else if (locLbl) {
      title = `Local Services in ${locLbl} — Services Marketplace | MyIsraelRental`;
      description = `Discover trusted local service providers in ${locLbl} — cleaning, home repair, tours, and more.`;
    }
    const qs = [
      selectedCat ? `category=${selectedCat}` : null,
      selectedLoc ? `location=${selectedLoc}` : null,
    ].filter(Boolean).join('&');
    const path = qs ? `/services?${qs}` : '/services';
    return { title, description, path };
  }, [categories, locations, selectedCat, selectedLoc]);

  return (
    <div
      className="min-h-screen bg-[#FAFAF7]"
      style={{ paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="services-page"
    >
      <PageMeta title={seo.title} description={seo.description} path={seo.path} />

      {/* Hero + search */}
      <div className="relative bg-gradient-to-br from-[#1E6A6A] to-[#0F3A3A] text-white py-14 md:py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>
            {t('services.heroTitle', 'Find & book trusted local services')}
          </h1>
          <p className="text-white/80 max-w-2xl mx-auto mb-8">
            {t('services.heroSubtitle', 'From apartment cleaners to plumbers, movers to interior designers — everything you need for living and hosting in Israel, in one place.')}
          </p>
          <div className="flex bg-white rounded-full overflow-hidden shadow-lg max-w-xl mx-auto" data-testid="services-search-bar">
            <div className="flex items-center flex-1 ps-4">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                value={q}
                onChange={(e) => patchUrl({ q: e.target.value })}
                placeholder={t('services.searchPlaceholder', 'Search cleaners, movers, plumbers…')}
                className="flex-1 px-3 py-3 text-sm text-gray-800 focus:outline-none"
                data-testid="services-search-input"
              />
            </div>
            <button
              onClick={() => navigate('/dashboard?tab=my-gigs')}
              className="px-5 py-3 bg-[#D4AF37] text-white text-sm font-semibold hover:bg-[#c19f2c] transition-colors"
              data-testid="services-become-provider"
            >
              {t('services.becomeProvider', 'Become a provider')}
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display' }}>
            {t('services.browse', 'Browse by category')}
          </h2>
          {selectedCat && (
            <button
              onClick={() => patchUrl({ category: '' })}
              className="text-xs font-semibold text-[#1E6A6A] hover:underline"
              data-testid="services-category-clear"
            >
              {t('services.showAll', 'Show all')} ×
            </button>
          )}
        </div>
        <CategoryCarousel
          categories={categories}
          selectedCat={selectedCat}
          onSelect={(v) => patchUrl({ category: v })}
        />

        {/* Locations */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm md:text-base font-bold text-gray-900" style={{ fontFamily: 'Playfair Display' }}>
              {t('services.byLocation', 'Browse by location')}
            </h3>
            {selectedLoc && (
              <button
                onClick={() => patchUrl({ location: '' })}
                className="text-xs font-semibold text-[#1E6A6A] hover:underline"
                data-testid="services-location-clear"
              >
                {t('services.clearLocation', 'Clear location')} ×
              </button>
            )}
          </div>
          <LocationChipsRow
            locations={locations}
            selectedLoc={selectedLoc}
            onSelect={(v) => patchUrl({ location: v })}
          />
        </div>
      </div>

      {/* Results header — Sort + Filters button + count */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-gray-900">
            {selectedCat
              ? categories.find((c) => c.slug === selectedCat)?.label
              : t('services.allServices', 'All services')}
            <span className="text-sm text-gray-500 font-normal ms-2" data-testid="services-count">
              ({gigs.length})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {/* Nearby toggle — opts into browser geolocation. Coords live
                in memory only (never in the URL) so shared links can't
                leak location. */}
            <button
              type="button"
              onClick={toggleNearby}
              disabled={geoBusy}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm border font-semibold transition-colors ${
                nearby && coords
                  ? 'bg-[#1E6A6A] text-white border-[#1E6A6A]'
                  : 'bg-white text-gray-800 border-gray-200 hover:border-gray-400'
              } disabled:opacity-60`}
              data-testid="services-nearby-btn"
              aria-pressed={nearby && !!coords}
            >
              {geoBusy
                ? <Loader2 size={14} className="animate-spin" />
                : <MapPin size={14} />}
              {nearby && coords
                ? t('services.nearbyOn', 'Nearby you')
                : t('services.showNearby', 'Show nearby')}
            </button>
            {/* Sort dropdown */}
            <label className="text-xs text-gray-500 me-1 hidden sm:inline">
              {t('services.sortBy', 'Sort by')}
            </label>
            <select
              value={sort}
              onChange={(e) => patchUrl({ sort: e.target.value === 'match' ? '' : e.target.value })}
              className="text-xs sm:text-sm px-3 py-2 rounded-full border border-gray-200 bg-white hover:border-gray-400 focus:outline-none focus:border-[#1E6A6A] font-semibold"
              data-testid="services-sort-select"
            >
              {SORT_OPTIONS.filter((o) => !o.requiresCoords || (nearby && coords)).map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey, o.fallback)}
                </option>
              ))}
            </select>
            {/* Filters button */}
            <button
              onClick={() => setFiltersOpen(true)}
              className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm border border-gray-200 bg-white hover:border-gray-400 font-semibold text-gray-800"
              data-testid="services-filters-btn"
            >
              <SlidersHorizontal size={14} />
              {t('services.filters', 'Filters')}
              {advCount > 0 && (
                <span
                  className="ms-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white"
                  style={{ background: TEAL }}
                  data-testid="services-filters-badge"
                >
                  {advCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Chip strip showing active advanced filters — one-tap remove. */}
        {advCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 text-xs" data-testid="services-active-filters">
            {minRating && (
              <button
                onClick={() => patchUrl({ min_rating: '' })}
                className="px-2.5 py-1 rounded-full bg-[#1E6A6A] text-white font-semibold"
                data-testid="active-filter-rating"
              >
                ★ {minRating}+ ×
              </button>
            )}
            {(minPrice || maxPrice) && (
              <button
                onClick={() => patchUrl({ min_price: '', max_price: '' })}
                className="px-2.5 py-1 rounded-full bg-[#1E6A6A] text-white font-semibold"
                data-testid="active-filter-price"
              >
                ₪{minPrice || 0}–{maxPrice || '∞'} ×
              </button>
            )}
            {responseTime && (
              <button
                onClick={() => patchUrl({ response_time: '' })}
                className="px-2.5 py-1 rounded-full bg-[#1E6A6A] text-white font-semibold"
                data-testid="active-filter-response"
              >
                {responseTime === '1h'
                  ? t('services.replies1h', 'Replies in 1h')
                  : t('services.replies24h', 'Replies in 24h')} ×
              </button>
            )}
            {languages.map((lang) => (
              <button
                key={lang}
                onClick={() => patchUrl({ languages: languages.filter((l) => l !== lang) })}
                className="px-2.5 py-1 rounded-full bg-[#1E6A6A] text-white font-semibold"
                data-testid={`active-filter-lang-${lang.toLowerCase()}`}
              >
                {lang} ×
              </button>
            ))}
            {bookingMode && (
              <button
                onClick={() => patchUrl({ booking_mode: '' })}
                className="px-2.5 py-1 rounded-full bg-[#1E6A6A] text-white font-semibold"
                data-testid="active-filter-booking"
              >
                {bookingMode === 'in_platform'
                  ? t('services.bookOnPlatform', 'On-platform')
                  : t('services.bookWhatsApp', 'WhatsApp')} ×
              </button>
            )}
            <button
              onClick={clearAdvancedFilters}
              className="text-[#1E6A6A] font-semibold underline"
              data-testid="services-clear-adv"
            >
              {t('common.clearAll', 'Clear all')}
            </button>
          </div>
        )}
      </div>

      {/* Gigs grid */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-[#1E6A6A]" size={28} />
          </div>
        ) : gigs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-gray-700 font-semibold mb-2">
              {t('services.emptyTitle', 'No services match your filters')}
            </p>
            <p className="text-gray-500 text-sm mb-5">
              {advCount > 0
                ? t('services.emptyBodyFiltered', 'Try loosening the filters, or clear them all to see everything.')
                : t('services.emptyBody', 'Be the first to list your service in this category — free 30-day trial.')}
            </p>
            {advCount > 0 ? (
              <button
                onClick={clearAdvancedFilters}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A]"
                data-testid="services-empty-clear"
              >
                {t('common.clearAll', 'Clear all filters')}
              </button>
            ) : (
              <button
                onClick={() => navigate('/services/create-gig')}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A]"
                data-testid="services-empty-cta"
              >
                {t('services.listYourService', 'List your service')} <ArrowRight size={14} className="inline-block ms-1" />
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8">
            {gigs.map((gig) => (
              <GigCard
                key={gig.id}
                gig={gig}
                onClick={() => navigate(`/services/gig/${gig.id}`)}
                i18n={i18n}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      <ServicesFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        initial={{ minRating, minPrice, maxPrice, responseTime, languages, bookingMode }}
        languages={languagesList}
        onApply={applyFilters}
        onClearAll={clearAdvancedFilters}
      />
    </div>
  );
};

export default Services;
