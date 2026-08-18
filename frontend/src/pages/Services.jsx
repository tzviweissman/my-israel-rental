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
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2, SlidersHorizontal, Award, Zap, MapPin, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import StarRating from '../components/marketplace/StarRating';
import CategoryCarousel from '../components/marketplace/CategoryCarousel';
import LocationChipsRow from '../components/marketplace/LocationChipsRow';
import ServicesFiltersModal from '../components/marketplace/ServicesFiltersModal';
import ServicesMapView from '../components/marketplace/ServicesMapView';
import PeekableResultsSheet from '../components/common/PeekableResultsSheet';
import NearbyDensityBar from '../components/common/NearbyDensityBar';
import { localizedTitle } from '../utils/gigLocale';
import { isAvailableNow, getGigCover } from '../utils/gigAvailability';
import ServicesHeroSearch from '../components/marketplace/ServicesHeroSearch';
import { saveReturnPath } from '../hooks/useBackNavigation';
import { SUBCATEGORIES } from '../lib/categories';
// ServicesHeroTitle (the shimmer-on-white H1) is no longer rendered — the
// headline now lives in the photo band. The component file is left in
// place rather than deleted until 2c is approved.
import ServicesHero from '../components/marketplace/ServicesHero';
import FeaturedProviders from '../components/marketplace/FeaturedProviders';

const TEAL = 'var(--brand-primary)';
const GOLD = 'var(--gold)';

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
  const cover = getGigCover(gig);
  const cheapest = gig.cheapest_price;
  const currency = gig.tiers?.[0]?.currency || 'ILS';
  const sym = currency === 'ILS' ? '₪' : '$';
  const bucket = gig.provider?.response_bucket;
  const availableNow = isAvailableNow(gig);
  return (
    <button
      onClick={onClick}
      // `w-full` is load-bearing: a <button> is inline-block, so when it
      // is not itself the grid item (the admin featuring toggle wraps it
      // in a positioned div) it shrinks to its content and the cards
      // overlap. Harmless when it IS the grid item.
      className="text-left group w-full"
      data-testid={`services-gig-${gig.id}`}
    >
      <div
        className="relative aspect-square w-full rounded-xl overflow-hidden mb-2"
        // Limestone-tinted rather than bg-gray-100. The "No image" label
        // used to be gray-300 on gray-100, which measures 1.34:1 and is
        // effectively invisible. Matches .svc-row-ph elsewhere.
        style={{
          background: '#EDE7DA',
          ...(cover
            ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : {}),
        }}
      >
        {!cover && (
          <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--brand-muted)' }}>
            {t('services.noImage', 'No image')}
          </div>
        )}
        {/* Top-Rated overlay pill */}
        {gig.is_top_rated && (
          <span
            className="absolute top-2 start-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow"
            style={{ background: GOLD, color: 'var(--brand-primary)' }}
            data-testid={`gig-top-rated-${gig.id}`}
          >
            <Award size={10} />
            {t('services.topRated', 'Top rated')}
          </span>
        )}
        {/* Available-now chip — only for appointment gigs whose weekly
            hours include the current wall-clock. Positioned top-right so
            it never collides with the top-rated pill (top-left) or the
            response-time chip (bottom-right). */}
        {availableNow && (
          <span
            className="absolute top-2 end-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shadow bg-emerald-500 text-white"
            data-testid={`gig-available-now-${gig.id}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {t('services.availableNow', 'Available now')}
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
      <p className="text-xs text-[var(--brand-muted)] truncate">
        {gig.provider?.name}{gig.area ? ` · ${gig.area}` : ''}
        {typeof gig.distance_km === 'number' && (
          <span className="ms-1 inline-flex items-center gap-0.5 text-[10px] text-[var(--brand-primary)] font-semibold">
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
          <span className="text-[var(--brand-muted)]">{t('services.from', 'from')} </span>
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
  // Optional sub-bucket, only respected when selectedCat is set. Blank
  // string means "no sub-filter" — matches every gig in the category.
  selectedSubcategory: params.get('subcategory') || '',
  selectedLoc: params.get('location') || '',
  q: params.get('q') || '',
  minRating: params.get('min_rating') || '',
  minPrice: params.get('min_price') || '',
  maxPrice: params.get('max_price') || '',
  responseTime: params.get('response_time') || '',
  languages: (params.get('languages') || '').split(',').filter(Boolean),
  bookingMode: params.get('booking_mode') || '',
  sort: params.get('sort') || 'match',
  // Distance ceiling — only respected when nearby coords are also present.
  maxDistance: params.get('max_distance_km') || '',
  // Date filter — YYYY-MM-DD string picked in the hero's "When" segment.
  // Blank string means "Anytime" (server-side filter is skipped).
  availableOn: params.get('available_on') || '',
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
  // Editorially featured gigs — a separate, unfiltered fetch. Deliberately
  // NOT derived from `gigs`: the featured row is a fixed editorial slot,
  // so it must not empty out the moment a visitor picks a category or a
  // price ceiling. It is hidden entirely when nothing is flagged.
  const [featuredGigs, setFeaturedGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Nearby-mode local state — coords live in memory only, never on the
  // URL, so shared links can't leak location. Cleared on tab close.
  const [coords, setCoords] = useState(null);
  const [geoBusy, setGeoBusy] = useState(false);

  // Admin-only inline featuring. The control lives on the cards rather
  // than in a new admin tab because there is no marketplace-gig admin
  // surface at all today (admin/ServicesTab.jsx manages document-services,
  // a different thing) — and featuring is a judgement about a listing you
  // are looking at, so the decision belongs where the listing is.
  //
  // This only hides the BUTTON. The endpoint does its own role check, so a
  // non-admin who forges the request still gets a 403.
  const { user, token } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  const toggleFeatured = async (gig) => {
    const next = !gig.featured;
    try {
      await axios.patch(
        `${API}/marketplace/gigs/${gig.id}/featured`,
        { featured: next },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Patch the row in place rather than refetching the whole grid —
      // a refetch would re-apply filters and could make the card the
      // admin just clicked jump or disappear mid-interaction.
      setGigs((prev) => prev.map((g) => (g.id === gig.id ? { ...g, featured: next } : g)));
      const fresh = await axios.get(`${API}/marketplace/gigs`, {
        params: { featured: true, limit: 6 },
      });
      setFeaturedGigs(fresh.data || []);
      toast.success(
        next
          ? t('services.featuredOn', 'Featured on the services page')
          : t('services.featuredOff', 'Removed from featured'),
      );
    } catch (e) {
      toast.error(t('services.featuredError', 'Could not change featured status'));
    }
  };

  // Cross-highlight state, same pattern as Stays — pin click → this id,
  // peek strip watches for it, scrolls the matching card into view.
  const [activeMapId, setActiveMapId] = useState(null);
  useEffect(() => {
    if (!activeMapId) return undefined;
    const clr = setTimeout(() => setActiveMapId(null), 4000);
    return () => clearTimeout(clr);
  }, [activeMapId]);
  // Permission-denied recovery modal — surfaced when the browser blocks
  // the geolocation prompt (typically because the user hit "Never allow"
  // earlier). Shows OS-specific instructions to unblock + a retry button.
  const [geoBlocked, setGeoBlocked] = useState(false);
  // View mode toggle — 'list' (default grid) vs 'map' (OSM pins). Held
  // in the URL so a shared "come see these gigs on the map" link works.
  const viewMode = searchParams.get('view') === 'map' ? 'map' : 'list';

  const state = readFilters(searchParams);
  const {
    selectedCat, selectedSubcategory, selectedLoc, q,
    minRating, minPrice, maxPrice, responseTime, languages, bookingMode, sort, nearby, maxDistance,
    availableOn,
  } = state;

  // Client-side toggle — filters the fetched gig list down to just
  // appointment gigs whose weekly hours include the current wall-clock.
  // Kept in the URL so shoppers can bookmark / share the "who's open
  // right now" view.
  const availableNowOnly = searchParams.get('available_now') === '1';
  const displayGigs = useMemo(
    () => (availableNowOnly ? gigs.filter((g) => isAvailableNow(g)) : gigs),
    [gigs, availableNowOnly],
  );
  const toggleAvailableNow = () => {
    const next = new URLSearchParams(searchParams);
    if (availableNowOnly) next.delete('available_now');
    else next.set('available_now', '1');
    setSearchParams(next, { replace: true });
  };

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
    // Featured row. Failure is swallowed on purpose — this is an
    // editorial extra, and the section simply doesn't render. Toasting a
    // second error for it would double-report one bad network moment.
    axios
      .get(`${API}/marketplace/gigs`, { params: { featured: true, limit: 6 } })
      .then((r) => setFeaturedGigs(r.data || []))
      .catch(() => setFeaturedGigs([]));
  }, []);

  // Re-fetch gigs whenever any server-side filter changes. Backend does
  // all the heavy lifting so the client is a thin cache.
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCat)   params.set('category', selectedCat);
    // Only send subcategory when a top-level category is also selected
    // — matches the backend's contract and avoids leaking useless
    // query params.
    if (selectedCat && selectedSubcategory) params.set('subcategory', selectedSubcategory);
    if (selectedLoc)   params.set('location', selectedLoc);
    if (q)             params.set('q', q);
    if (minRating)     params.set('min_rating', minRating);
    if (minPrice)      params.set('min_price', minPrice);
    if (maxPrice)      params.set('max_price', maxPrice);
    if (responseTime)  params.set('response_time', responseTime);
    if (languages.length) params.set('languages', languages.join(','));
    if (bookingMode)   params.set('booking_mode', bookingMode);
    if (availableOn)   params.set('available_on', availableOn);
    if (sort && sort !== 'match') params.set('sort', sort);
    // Nearby-mode: only send lat/lng when both the toggle is on AND
    // coords are available. The backend will silently degrade sort to
    // `match` if coords are absent when sort=distance was requested.
    if (nearby && coords) {
      params.set('lat', coords.lat.toFixed(4));
      params.set('lng', coords.lng.toFixed(4));
      if (maxDistance) params.set('max_distance_km', maxDistance);
    }
    setLoading(true);
    axios.get(`${API}/marketplace/gigs?${params.toString()}`)
      .then((r) => setGigs(r.data))
      .catch((e) => { console.error(e); toast.error(t('services.loadError', 'Failed to load')); })
      .finally(() => setLoading(false));
  }, [
    selectedCat, selectedSubcategory, selectedLoc, q,
    minRating, minPrice, maxPrice, responseTime,
    // Joined to a primitive so the effect doesn't fire on identity change alone.
    languages.join(','), bookingMode, sort, t, availableOn,
    nearby, coords?.lat, coords?.lng, maxDistance,
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
      async (pos) => {
        const nextCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(nextCoords);
        setGeoBusy(false);
        // Zero-click discovery boost: if the renter hasn't yet chosen a
        // location chip, resolve their coords to the closest supported
        // city and pre-select it. Fully silent on failure — worst case
        // we just leave the chip empty.
        let nearestSlug = '';
        if (!selectedLoc) {
          try {
            const r = await axios.get(`${API}/marketplace/nearest-city`, {
              params: { lat: nextCoords.lat, lng: nextCoords.lng },
            });
            if (r.data?.slug) nearestSlug = r.data.slug;
          } catch (e) {
            // Non-fatal — don't block the nearby flow if the city lookup
            // hiccups. The distance sort + chips already carry the value.
            console.warn('nearest-city lookup failed', e);
          }
        }
        // sort=distance implicitly when nearby turns on so results
        // immediately re-order by proximity. Users can still switch back
        // to any other sort while keeping nearby active — the distance
        // chip stays on the card either way.
        patchUrl({
          nearby: '1',
          sort: 'distance',
          ...(nearestSlug ? { location: nearestSlug } : {}),
        });
        toast.success(
          nearestSlug
            ? t('services.nearbyOnCity', 'Showing services near you')
            : t('services.nearbyOnToast', 'Showing services near you'),
        );
      },
      (err) => {
        setGeoBusy(false);
        if (err.code === err.PERMISSION_DENIED) {
          // Show the recovery modal — the toast alone doesn't tell users
          // where to click to unblock in their browser settings.
          setGeoBlocked(true);
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
      max_distance_km: draft.maxDistance,
    });
  };

  const clearAdvancedFilters = () => {
    patchUrl({
      min_rating: '', min_price: '', max_price: '',
      response_time: '', languages: [], booking_mode: '',
      max_distance_km: '',
    });
  };

  // How many "More filters" chips are active — drives the badge on
  // the Filters button so users can see filters are on at a glance.
  const advCount =
    (minRating ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (responseTime ? 1 : 0) +
    (languages.length ? 1 : 0) +
    (bookingMode ? 1 : 0) +
    (maxDistance ? 1 : 0);

  const seo = useMemo(() => {
    const catLbl = categories.find((c) => c.slug === selectedCat)?.label;
    const locLbl = locations.find((l) => l.slug === selectedLoc)?.label;
    let title = 'Hire Proven Local Talent in Israel — Cleaners, Movers, Plumbers & more | MyIsraelRental';
    let description = 'Hire proven talent who deliver — post a job, get bids immediately, see verified work history, reviews and certifications. Cleaning, movers, plumbers, electricians, photographers, barbers, tour guides and more. Zero booking fees.';
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
      className="min-h-screen bg-[var(--bg)]"
      // No paddingTop: the photo band starts at y=0 and the fixed glass
      // nav floats over it. `.hero-band-head` carries `--nav-h` instead.
      // See components/common/HeroBand.jsx.
      data-testid="services-page"
    >
      <PageMeta title={seo.title} description={seo.description} path={seo.path} />

      {/* Photo band + floating search panel, matching /stays and the
          preview. This replaces the old white hero: its gold paper-grain
          texture and shimmer H1 were solving "make a white page feel
          designed", a problem the band doesn't have. The glass nav also
          all but disappeared against that white — grey-on-white bubbles.

          The "Browse jobs / Post a job" utility strip that used to sit
          above the hero is gone from here; both actions now live in the
          dual CTA band at the foot of the page, where the preview puts
          them and where they don't compete with the headline. */}
      <ServicesHero t={t} />

      <div className="hero-panel-float">
        <div className="hero-panel">
          <ServicesHeroSearch
            categories={categories}
            selectedCat={selectedCat}
            minPrice={minPrice}
            maxPrice={maxPrice}
            availableOn={availableOn}
            onPatch={patchUrl}
            onOpenFilters={() => setFiltersOpen(true)}
            locale={i18n.language === 'he' ? 'he-IL' : 'en-US'}
          />
        </div>
      </div>

      {/* Locations + Categories */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        {/* Section headings drop their hardcoded Inter/tracking styles for
            the shared `.section-rhead` rule — the preview's editorial
            Playfair, and the same type as the Stays results header. The
            inline font-family also pinned Latin Inter in Hebrew, defeating
            the RTL font swap in design-tokens.css. */}
        <div className="section-rhead flex items-center justify-between mb-3">
          <h2 className="text-gray-900">
            {t('services.byLocation', 'Browse by location')}
          </h2>
          {selectedLoc && (
            <button
              onClick={() => patchUrl({ location: '' })}
              className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
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

        {/* Categories */}
        <div className="mt-8">
          <div className="section-rhead flex items-center justify-between mb-5">
            <h2 className="text-gray-900">
              {t('services.browse', 'Browse by category')}
            </h2>
            {selectedCat && (
              <button
                onClick={() => patchUrl({ category: '', subcategory: '' })}
                className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                data-testid="services-category-clear"
              >
                {t('services.showAll', 'Show all')} ×
              </button>
            )}
          </div>
          <CategoryCarousel
            categories={categories}
            selectedCat={selectedCat}
            onSelect={(v) => patchUrl({ category: v, subcategory: '' })}
          />

          {/* Subcategory chip row — only shown when the current top-level
              category has sub-buckets defined (the 4 merged buckets:
              home-services-repair, travel-tourism, creative-design,
              business-financial). Clicking a chip narrows the gig list
              to that specific sub-bucket; clicking it again clears the
              filter. URL-persisted so `/services?category=X&subcategory=Y`
              is shareable. */}
          {selectedCat && SUBCATEGORIES[selectedCat] && (
            <div
              className="flex flex-wrap gap-2 mt-3"
              data-testid="services-subcategory-row"
            >
              {SUBCATEGORIES[selectedCat].map((s) => {
                const active = selectedSubcategory === s.slug;
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => patchUrl({ subcategory: active ? '' : s.slug })}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-[var(--brand-primary)]'
                    }`}
                    data-testid={`services-sub-${s.slug}`}
                    aria-pressed={active}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Featured row — sits between browse-by-category and the results,
          matching the preview's order. Renders nothing when no gig is
          flagged, which is the expected state until an admin features
          something. */}
      <FeaturedProviders
        gigs={featuredGigs}
        coords={coords}
        onOpen={(id) => { saveReturnPath(); navigate(`/services/gig/${id}`); }}
        t={t}
        i18n={i18n}
      />

      {/* Results header — Sort + Filters button + count */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="section-rhead flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-gray-900">
            {selectedCat
              ? categories.find((c) => c.slug === selectedCat)?.label
              : t('services.allServices', 'All services')}
            <span className="text-sm text-[var(--brand-muted)] font-normal ms-2" data-testid="services-count">
              ({displayGigs.length})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {/* List / Map view toggle — segmented pill. Held in URL as
                `?view=map` so shared links can deep-link directly to
                the map view. */}
            <div
              className="hidden sm:inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5"
              data-testid="services-view-toggle"
              role="tablist"
              aria-label={t('services.viewToggle', 'View mode')}
            >
              <button
                type="button"
                onClick={() => patchUrl({ view: '' })}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  viewMode === 'list' ? 'bg-[var(--brand-primary)] text-white' : 'text-gray-700 hover:text-gray-900'
                }`}
                aria-pressed={viewMode === 'list'}
                data-testid="services-view-list"
              >
                <LayoutGrid size={13} />
                {t('services.viewList', 'List')}
              </button>
              <button
                type="button"
                onClick={() => patchUrl({ view: 'map' })}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  viewMode === 'map' ? 'bg-[var(--brand-primary)] text-white' : 'text-gray-700 hover:text-gray-900'
                }`}
                aria-pressed={viewMode === 'map'}
                data-testid="services-view-map"
              >
                <MapIcon size={13} />
                {t('services.viewMap', 'Map')}
              </button>
            </div>

            {/* Nearby toggle — opts into browser geolocation. Coords live
                in memory only (never in the URL) so shared links can't
                leak location. */}
            <button
              type="button"
              onClick={toggleNearby}
              disabled={geoBusy}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm border font-semibold whitespace-nowrap shrink-0 transition-colors ${
                nearby && coords
                  ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)]'
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
            {/* Available-now toggle — client-side filter that keeps only
                appointment gigs whose weekly hours include right-now. */}
            <button
              type="button"
              onClick={toggleAvailableNow}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs sm:text-sm border font-semibold whitespace-nowrap shrink-0 transition-colors ${
                availableNowOnly
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-gray-800 border-gray-200 hover:border-gray-400'
              }`}
              data-testid="services-available-now-btn"
              aria-pressed={availableNowOnly}
              title={t('services.availableNowTooltip', 'Show only appointment services open right now')}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${availableNowOnly ? 'bg-white animate-pulse' : 'bg-emerald-500'}`} />
              {t('services.availableNow', 'Available now')}
            </button>
            {/* Sort dropdown */}
            <label className="text-xs text-[var(--brand-muted)] me-1 hidden sm:inline">
              {t('services.sortBy', 'Sort by')}
            </label>
            <select
              value={sort}
              onChange={(e) => patchUrl({ sort: e.target.value === 'match' ? '' : e.target.value })}
              className="text-xs sm:text-sm px-3 py-2 rounded-full border border-gray-200 bg-white hover:border-gray-400 focus:outline-none focus:border-[var(--brand-primary)] font-semibold"
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
                className="px-2.5 py-1 rounded-full bg-[var(--brand-primary)] text-white font-semibold"
                data-testid="active-filter-rating"
              >
                ★ {minRating}+ ×
              </button>
            )}
            {(minPrice || maxPrice) && (
              <button
                onClick={() => patchUrl({ min_price: '', max_price: '' })}
                className="px-2.5 py-1 rounded-full bg-[var(--brand-primary)] text-white font-semibold"
                data-testid="active-filter-price"
              >
                ₪{minPrice || 0}–{maxPrice || '∞'} ×
              </button>
            )}
            {responseTime && (
              <button
                onClick={() => patchUrl({ response_time: '' })}
                className="px-2.5 py-1 rounded-full bg-[var(--brand-primary)] text-white font-semibold"
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
                className="px-2.5 py-1 rounded-full bg-[var(--brand-primary)] text-white font-semibold"
                data-testid={`active-filter-lang-${lang.toLowerCase()}`}
              >
                {lang} ×
              </button>
            ))}
            {bookingMode && (
              <button
                onClick={() => patchUrl({ booking_mode: '' })}
                className="px-2.5 py-1 rounded-full bg-[var(--brand-primary)] text-white font-semibold"
                data-testid="active-filter-booking"
              >
                {bookingMode === 'in_platform'
                  ? t('services.bookOnPlatform', 'On-platform')
                  : t('services.bookWhatsApp', 'WhatsApp')} ×
              </button>
            )}
            {maxDistance && (
              <button
                onClick={() => patchUrl({ max_distance_km: '' })}
                className="px-2.5 py-1 rounded-full bg-[var(--brand-primary)] text-white font-semibold"
                data-testid="active-filter-distance"
              >
                ≤ {maxDistance} km ×
              </button>
            )}
            <button
              onClick={clearAdvancedFilters}
              className="text-[var(--brand-primary)] font-semibold underline"
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
            <Loader2 className="animate-spin text-[var(--brand-primary)]" size={28} />
          </div>
        ) : displayGigs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-gray-700 font-semibold mb-2">
              {availableNowOnly
                ? t('services.noServicesOpenTitle', 'No services open right now')
                : t('services.emptyTitle', 'No services match your filters')}
            </p>
            <p className="text-[var(--brand-muted)] text-sm mb-5">
              {availableNowOnly
                ? t('services.noServicesOpenBody', 'Nobody with appointment hours listed is inside their open window right now. Try turning the filter off to see everyone.')
                : (advCount > 0
                    ? t('services.emptyBodyFiltered', 'Try loosening the filters, or clear them all to see everything.')
                    : t('services.emptyBody', 'Be the first to list your service in this category — free, no commission.'))}
            </p>
            {availableNowOnly ? (
              <button
                onClick={toggleAvailableNow}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[#0F3A3A]"
                data-testid="services-empty-available-off"
              >
                {t('services.showEveryone', 'Show everyone')}
              </button>
            ) : advCount > 0 ? (
              <button
                onClick={clearAdvancedFilters}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[#0F3A3A]"
                data-testid="services-empty-clear"
              >
                {t('common.clearAll', 'Clear all filters')}
              </button>
            ) : (
              /* Routed via the value page rather than straight into the
                 wizard: a provider who hasn't been told what they're buying
                 shouldn't land on a pricing choice. */
              <button
                onClick={() => navigate('/why-list')}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[#0F3A3A]"
                data-testid="services-empty-cta"
              >
                {t('services.listYourService', 'List your service')} <ArrowRight size={14} className="inline-block ms-1" />
              </button>
            )}
            {/* Same escape hatch as /stays: nobody matched the search, so
                let them describe the job and have pros come to them. */}
            <p className="mt-6 text-sm" style={{ color: 'var(--brand-muted)' }}>
              {t('services.cantFindIt', "Can't find the right pro?")}{' '}
              <button
                type="button"
                onClick={() => { saveReturnPath(); navigate('/requests/post'); }}
                className="font-semibold hover:underline"
                style={{ color: 'var(--brand-primary)' }}
                data-testid="services-post-request-link"
              >
                {t('services.postWhatYouNeed', 'Post what you need')} →
              </button>
            </p>
          </div>
        ) : viewMode === 'map' ? (
          <>
            <div className="relative">
              <ServicesMapView
                gigs={displayGigs}
                userCoords={nearby && coords ? coords : null}
                maxDistanceKm={nearby && coords ? maxDistance : ''}
                activeId={activeMapId}
                onPinClick={setActiveMapId}
              />
              {nearby && coords && (
                <div className="absolute top-3 start-3 z-10 pointer-events-none">
                  <NearbyDensityBar
                    items={displayGigs}
                    testId="services-density-bar"
                  />
                </div>
              )}
            </div>
            {/* Mobile-only peekable sheet — mirrors the Stays pattern
                so renters can glance at gig cards without leaving the
                map. Reuses the shared GigCard component in the full
                list; the peek strip is a lighter mini-card format
                tuned for horizontal scroll. */}
            <PeekableResultsSheet
              count={displayGigs.length}
              countLabel={displayGigs.length === 1
                ? t('services.gigLabel', 'service')
                : t('services.gigsLabel', 'services')}
              peekContent={(
                <div
                  className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-3"
                  data-testid="services-peek-strip"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {displayGigs.slice(0, 12).map((gig) => {
                    const cover = getGigCover(gig) || (gig.images && gig.images[0]) || '';
                    const title = gig.title || t('services.serviceFallbackTitle', 'Service');
                    const price = gig.tiers?.[0]?.price
                      ? `₪${Math.round(gig.tiers[0].price)}`
                      : '';
                    const isActive = gig.id === activeMapId;
                    return (
                      <button
                        key={gig.id}
                        type="button"
                        ref={(el) => {
                          if (isActive && el) {
                            el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                          }
                        }}
                        onClick={() => {
                          setActiveMapId(gig.id);
                          if (activeMapId === gig.id) {
                            saveReturnPath();
                            navigate(`/services/gig/${gig.id}`);
                          }
                        }}
                        className={`shrink-0 w-[168px] rounded-xl overflow-hidden bg-white text-start active:scale-95 transition-all ${
                          isActive
                            ? 'ring-2 ring-[var(--brand-primary)] shadow-[0_10px_20px_-8px_rgba(30, 95, 140,0.5)] scale-[1.03]'
                            : 'ring-1 ring-black/5'
                        }`}
                        data-testid={`services-peek-card-${gig.id}`}
                      >
                        <div
                          className="h-[76px] bg-gray-100"
                          style={cover ? { background: `url(${cover}) center/cover no-repeat` } : undefined}
                        />
                        <div className="px-2 py-1.5">
                          <div className="text-[11px] font-semibold text-gray-900 truncate">{title}</div>
                          <div className="text-[10px] text-[var(--brand-muted)] truncate">{price}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              fullContent={(
                <div className="grid grid-cols-1 gap-4 px-4 py-3 pb-24">
                  {displayGigs.map((gig) => (
                    <GigCard
                      key={gig.id}
                      gig={gig}
                      onClick={() => { saveReturnPath(); navigate(`/services/gig/${gig.id}`); }}
                      i18n={i18n}
                      t={t}
                    />
                  ))}
                </div>
              )}
              testId="services-peek"
            />
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8">
            {displayGigs.map((gig) => (
              /* The admin feature-toggle is a SIBLING of the card, not a
                 child: GigCard renders a <button>, and a button inside a
                 button is invalid HTML that browsers reflow unpredictably
                 (and whose clicks fight each other). */
              <div key={gig.id} className="relative">
                <GigCard
                  gig={gig}
                  onClick={() => { saveReturnPath(); navigate(`/services/gig/${gig.id}`); }}
                  i18n={i18n}
                  t={t}
                />
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => toggleFeatured(gig)}
                    className={`absolute top-2 end-2 z-10 px-2 py-1 rounded-full text-[10px] font-bold shadow transition-colors ${
                      gig.featured
                        ? 'bg-[var(--gold)] text-white'
                        : 'bg-white/95 text-gray-700 hover:bg-white'
                    }`}
                    data-testid={`services-feature-toggle-${gig.id}`}
                    aria-pressed={Boolean(gig.featured)}
                  >
                    {gig.featured
                      ? t('services.featured', 'Featured')
                      : t('services.feature', 'Feature')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dual CTA band, from the preview's `.ctaband`. Deliberately the
          last thing on the page: it addresses the visitor who did NOT
          find what they came for by scrolling the whole marketplace, and
          it is where the "Browse jobs / Post a job" strip that used to sit
          above the hero now lives.

          Two panels, opposite weights — one speaks to someone who needs
          work done, the other to someone selling their labour. Both
          audiences land on /services and the page previously only spoke
          to the first. */}
      <div
        className="max-w-6xl mx-auto px-4 pb-20 grid gap-[18px] md:grid-cols-2"
        data-testid="services-cta-band"
      >
        <div className="svc-cta svc-cta-need">
          <div>
            <h4>{t('services.ctaNeedTitle', 'Need something done?')}</h4>
            <small>{t('services.ctaNeedBody', 'Describe the job and let pros come to you — free, and they reply through the site.')}</small>
          </div>
          <button
            type="button"
            onClick={() => navigate('/services/post-job')}
            className="btn-gold-solid"
            data-testid="services-post-job"
          >
            {t('services.postJob', 'Post a job request')}
          </button>
        </div>
        <div className="svc-cta svc-cta-offer">
          <div>
            <h4>{t('services.ctaOfferTitle', 'Offer your services')}</h4>
            <small>{t('services.ctaOfferBody', 'One free listing reaches everyone on the platform — renters, owners and property managers alike.')}</small>
          </div>
          <button
            type="button"
            onClick={() => navigate('/why-list')}
            className="btn-blue-solid"
            data-testid="services-list-free"
          >
            {t('services.listForFree', 'List for free')}
          </button>
        </div>
      </div>

      {/* Browsing open jobs is a third, narrower intent (providers looking
          for work) — kept as a quiet text link under the band rather than
          a third panel competing with the two above. It used to be a
          button in the strip above the hero. */}
      <div className="max-w-6xl mx-auto px-4 pb-16 -mt-12 text-center">
        <button
          type="button"
          onClick={() => navigate('/services/jobs')}
          className="text-sm font-semibold text-[var(--brand-primary)] hover:underline"
          data-testid="services-browse-jobs"
        >
          {t('services.browseJobs', 'Browse jobs')} →
        </button>
      </div>

      <ServicesFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        initial={{ minRating, minPrice, maxPrice, responseTime, languages, bookingMode, maxDistance }}
        languages={languagesList}
        onApply={applyFilters}
        onClearAll={clearAdvancedFilters}
        nearbyActive={nearby && !!coords}
      />

      {/* Geolocation permission-denied recovery — surfaced when the
          browser rejects the prompt (typically because the user hit
          "Never allow" earlier or has location disabled OS-wide). We
          can't re-open the prompt from JS once it's blocked; the user
          has to unblock it in their settings, so we tell them exactly
          where to click. */}
      {geoBlocked && (
        <div
          className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          data-testid="geo-blocked-modal"
          onClick={(e) => { if (e.target === e.currentTarget) setGeoBlocked(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-full bg-amber-100">
                <MapPin size={22} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", letterSpacing: '-0.02em' }}>
                {t('services.geoBlockedTitle', 'Location access is blocked')}
              </h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {t('services.geoBlockedBody', 'Your browser is blocking location for this site — we need it to sort services by distance from you. It only takes a second to re-enable:')}
            </p>
            <ol className="text-sm text-gray-700 space-y-1.5 mb-5 ps-4 list-decimal marker:text-[var(--brand-primary)] marker:font-bold">
              <li>{t('services.geoStep1', 'Click the lock (or info) icon in your browser\'s address bar.')}</li>
              <li>{t('services.geoStep2', 'Find "Location" in the site permissions list.')}</li>
              <li>{t('services.geoStep3', 'Switch it to Allow.')}</li>
              <li>{t('services.geoStep4', 'Come back here and tap "Try again" below.')}</li>
            </ol>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setGeoBlocked(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100"
                data-testid="geo-blocked-dismiss"
              >
                {t('common.dismiss', 'Dismiss')}
              </button>
              <button
                type="button"
                onClick={() => { setGeoBlocked(false); toggleNearby(); }}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--brand-primary)] hover:bg-[#0F3A3A]"
                data-testid="geo-blocked-retry"
              >
                {t('services.geoRetry', 'Try again')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-only floating view toggle — Airbnb-style bottom-center
          pill. Only shown in LIST view; on the map, the peekable bottom
          sheet handles browsing results without leaving the map. */}
      {!loading && displayGigs.length > 0 && viewMode !== 'map' && (
        <button
          type="button"
          onClick={() => patchUrl({ view: 'map' })}
          className="sm:hidden fixed start-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold shadow-[0_10px_25px_-5px_rgba(0,0,0,0.35)] hover:bg-gray-800 active:scale-95 transition-transform"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-h, 0px) + 1.5rem)',
          }}
          data-testid="services-view-fab"
          aria-label={t('services.viewMapAria', 'Show map')}
        >
          <MapIcon size={14} />
          {t('services.viewMap', 'Map')}
        </button>
      )}
    </div>
  );
};

export default Services;
