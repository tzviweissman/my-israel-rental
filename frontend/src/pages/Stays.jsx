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
 *      `/stays?area=...` search page (which uses the same unified
 *      filter UI as the parent page — no more jumping into the legacy
 *      Properties layout).
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
import { X, Loader2, Bell, LayoutGrid, Map as MapIcon, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import StaysCard from '../components/stays/StaysCard';
import AreaRow from '../components/stays/AreaRow';
import StaysSearchBar from '../components/stays/StaysSearchBar';
import FiltersModal, { AMENITY_PRESETS } from '../components/stays/FiltersModal';
import StaysMapView from '../components/stays/StaysMapView';
import AddressAutocomplete from '../components/common/AddressAutocomplete';
import PeekableResultsSheet from '../components/common/PeekableResultsSheet';
import NearbyDensityBar from '../components/common/NearbyDensityBar';
import RenterTrustBanner from '../components/common/RenterTrustBanner';
import { flexLabel } from '../components/search/WhenPicker';
import QuickChips from '../components/search/QuickChips';
import NotifyMeCard from '../components/NotifyMeCard';
import PageMeta from '../components/PageMeta';
import useFavorites from '../hooks/useFavorites';
import useExchangeRate from '../hooks/useExchangeRate';
import { saveReturnPath } from '../hooks/useBackNavigation';
import { areaLabel, areaGroupKey, canonicalArea, UNGROUPED_AREA } from '../utils/areaNames';
import { byPrice, priceIn } from '../utils/listingPrice';
import SortSelect, {
  SORT_NEWEST, SORT_PRICE_ASC, SORT_PRICE_DESC, SORT_NEAREST, parseSort,
} from '../components/search/SortSelect';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Stays = everything that's not storage. Storage was retired this session.
const STAY_RENTAL_TYPES = ['vacation', 'short-term', 'long-term'];

/**
 * Newest first. Listings with no `created_at` sink to the bottom rather than
 * being treated as epoch-old and burying the genuinely new ones.
 */
const byNewest = (a, b) => {
  const ta = Date.parse(a?.created_at || '');
  const tb = Date.parse(b?.created_at || '');
  const va = Number.isNaN(ta) ? null : ta;
  const vb = Number.isNaN(tb) ? null : tb;
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return vb - va;
};

const Stays = ({ landing = null }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Live USD->ILS. Feeds the price filter AND the price sort, so both agree
  // with what the cards display. Was a hardcoded 3.65 against a real rate
  // near 3.06 — see hooks/useExchangeRate.
  const { rate: fxRate } = useExchangeRate();

  const [allProperties, setAllProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  // Toggles the inline "Notify me" card the renter can summon from
  // the header even when there are matches. Reset on every filter
  // change so the card doesn't linger after the search changes.
  const [showNotifyCard, setShowNotifyCard] = useState(false);

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
  // Resolve initial amenities by merging three inputs (highest wins):
  //   1. `?amenities=` explicit URL param
  //   2. `?preset=<id>` URL param — expanded from AMENITY_PRESETS
  //   3. `landing.defaultAmenities` — hard-coded on SEO landing routes
  // The preset param is consumed (removed from URL) after expansion so
  // subsequent chip toggles don't fight the preset every render.
  const [amenities, setAmenities] = useState(() => {
    const fromParam = (searchParams.get('amenities') || '').split(',').filter(Boolean);
    if (fromParam.length) return fromParam;
    const presetId = searchParams.get('preset');
    const preset = presetId ? AMENITY_PRESETS.find((p) => p.id === presetId) : null;
    if (preset) return [...preset.items];
    if (landing?.defaultAmenities?.length) return [...landing.defaultAmenities];
    return [];
  });

  // View mode toggle — 'list' (default grid) vs 'map' (Voyager tiles).
  // Persisted to the URL so a shared "come look at these on the map"
  // link deep-links straight to the map.
  const viewMode = searchParams.get('view') === 'map' ? 'map' : 'list';

  // Sort is URL-synced like every other filter so a shared link reproduces
  // the same ordering. An unknown value from a hand-edited or stale URL
  // resolves to '' — the contextual default — rather than throwing.
  const [sort, setSort] = useState(() => parseSort(searchParams.get('sort') || ''));

  // "Near this address" state — coords live in memory only, never on
  // the URL, so shared links don't leak someone else's search location.
  // Cleared on tab close. The query text IS persisted (as `?near=...`)
  // so a refresh preserves the visible input value.
  const [nearQuery, setNearQuery] = useState(searchParams.get('near') || '');
  const [nearCoords, setNearCoords] = useState(null);
  const [nearBusy, setNearBusy] = useState(false);
  const [nearInput, setNearInput] = useState(searchParams.get('near') || '');

  // Cross-highlight between the map and the peek strip / list. When
  // a pin is tapped we bounce the id up here so the card can scroll
  // itself into view and paint a subtle ring. Clears after 4s so a
  // stale focus doesn't linger while the user browses elsewhere.
  const [activeMapId, setActiveMapId] = useState(null);
  useEffect(() => {
    if (!activeMapId) return undefined;
    const clr = setTimeout(() => setActiveMapId(null), 4000);
    return () => clearTimeout(clr);
  }, [activeMapId]);

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
    if (priceCurrency === 'USD') next.set('cur', 'USD');
    if (bedrooms) next.set('bedrooms', bedrooms);
    if (bathrooms) next.set('bathrooms', bathrooms);
    if (porches) next.set('porches', porches);
    if (condition) next.set('condition', condition);
    if (furnished) next.set('furnished', '1');
    if (hasElevator) next.set('elevator', '1');
    if (subType) next.set('subType', subType);
    if (amenities.length) next.set('amenities', amenities.join(','));
    if (viewMode === 'map') next.set('view', 'map');
    if (sort) next.set('sort', sort);
    if (nearQuery) next.set('near', nearQuery);
    setSearchParams(next, { replace: true });
  }, [where, checkin, checkout, flexible, priceMin, priceMax, priceCurrency, bedrooms, bathrooms, porches, condition, furnished, hasElevator, subType, amenities, viewMode, sort, nearQuery, setSearchParams]);

  useEffect(() => { syncUrl(); }, [syncUrl]);

  // Build the list of areas for the Where dropdown — pulled from actual
  // properties so we never show an empty area chip.
  //
  // Collapsed to canonical group keys (utils/areaNames) so the three stored
  // spellings of "Ramat Eshkol" show up as ONE suggestion. The option value
  // stays an English canonical/stored string — never the Hebrew label — so
  // everything downstream that consumes `where` (the `?area=` URL param and
  // the saved-search alert posted to the backend, which regex-matches
  // against stored English values) keeps working. Only the visible label is
  // localised, via `areaLabel` below.
  const areaOptions = useMemo(() => {
    const set = new Set();
    allProperties.forEach((p) => {
      const key = areaGroupKey(p.area);
      if (key) set.add(key);
    });
    return Array.from(set).sort((a, b) => areaLabel(a, t).localeCompare(areaLabel(b, t)));
  }, [allProperties, t]);

  // Master filter chain — runs in-memory across every active criterion.
  const filtered = useMemo(() => {
    // Resolved once per filter pass — `where` may be a canonical group key
    // (picked from the Where suggestions / an area row's "see all") or free
    // text the renter typed.
    const whereCanonical = canonicalArea(where);
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
        // Two-tier area match, all client-side (this page filters in
        // memory; the backend regex in utils/area_filter.py is untouched):
        //   * When `where` resolves to a canonical neighbourhood — i.e. the
        //     renter picked a suggestion, or typed an exact name — match on
        //     the canonical key so every stored spelling of it is included
        //     ("Jerusalem - Shaare Hesed" for "Shaarei Chessed") while
        //     genuinely different neighbourhoods stay apart ("Sanhedria"
        //     does NOT swallow "Sanhedria Murchevet").
        //   * Otherwise fall back to the old case-insensitive substring
        //     match so partial typing ("tel", "jeru") still works.
        if (whereCanonical) {
          if (canonicalArea(p.area) !== whereCanonical) return false;
        } else {
          const needle = where.toLowerCase().trim();
          if (!(p.area || '').toLowerCase().includes(needle)) return false;
        }
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
      // Convert the listing's price into the renter's chosen filter currency
      // before comparing. Shared with the price sort below (utils/listingPrice)
      // so the two can't disagree about what a listing costs.
      const priceInFilterCurrency = priceIn(p, priceCurrency, fxRate);
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
  }, [allProperties, where, subType, bedrooms, bathrooms, porches, condition, furnished, hasElevator, priceMin, priceMax, priceCurrency, amenities, checkin, checkout, flexible, fxRate]);

  // Group filtered properties by area for the per-area row layout.
  // Keyed by canonical group key so the same neighbourhood stored under
  // several spellings renders as ONE row ("Ramat Eshkol" x3 used to be
  // three separate headings). Unmapped areas group under themselves.
  const grouped = useMemo(() => {
    const m = new Map();
    filtered.forEach((p) => {
      const key = areaGroupKey(p.area) || UNGROUPED_AREA;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(p);
    });
    // Stable sort by area name, but push areas with fewer than 3 listings
    // to the bottom so the top of the page always shows full rows. Sorting
    // on the localised label keeps Hebrew mode alphabetical in Hebrew.
    return Array.from(m.entries())
      .sort((a, b) => {
        const aBig = a[1].length >= 3 ? 0 : 1;
        const bBig = b[1].length >= 3 ? 0 : 1;
        if (aBig !== bBig) return aBig - bBig;
        return areaLabel(a[0], t).localeCompare(areaLabel(b[0], t));
      });
  }, [filtered, t]);

  // Great-circle distance (haversine) — used when the renter has typed
  // an address so we can sort results by proximity + annotate each card
  // with a "3.2 km away" chip. Returns kilometers.
  const haversineKm = (a, b) => {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  // When an address is set, decorate each property with `distance_km`
  // and re-order the filtered list by proximity. Properties missing
  // coords sink to the bottom (still visible, just not distance-ranked).
  const withDistance = useMemo(() => {
    if (!nearCoords) return filtered;
    return [...filtered]
      .map((p) => {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') {
          return { ...p, distance_km: null };
        }
        return {
          ...p,
          distance_km: haversineKm(nearCoords, { lat: p.lat, lng: p.lng }),
        };
      })
      .sort((a, b) => {
        if (a.distance_km == null && b.distance_km == null) return 0;
        if (a.distance_km == null) return 1;
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      });
  }, [filtered, nearCoords]);

  // Which sort actually applies. Proximity is the implicit default once an
  // address search is active — that was the behaviour before this control
  // existed and it stays the default so an address search still leads with
  // the closest places. A stale `?sort=nearest` link opened without an
  // address falls back to newest rather than silently doing nothing.
  const effectiveSort = useMemo(() => {
    if (sort === SORT_NEAREST && !nearCoords) return SORT_NEWEST;
    if (!sort) return nearCoords ? SORT_NEAREST : SORT_NEWEST;
    return sort;
  }, [sort, nearCoords]);

  const filteredWithDistance = useMemo(() => {
    switch (effectiveSort) {
      case SORT_PRICE_ASC:
        return [...withDistance].sort(byPrice(priceCurrency, 'asc', fxRate));
      case SORT_PRICE_DESC:
        return [...withDistance].sort(byPrice(priceCurrency, 'desc', fxRate));
      case SORT_NEAREST:
        // `withDistance` is already proximity-ordered.
        return withDistance;
      case SORT_NEWEST:
      default:
        // The backend returns created_at desc, so the unsorted list is
        // already newest-first — but only while no address is set, since
        // `withDistance` re-orders by proximity. Re-sort explicitly in that
        // case so picking "Newest" during an address search actually does
        // something.
        return nearCoords ? [...withDistance].sort(byNewest) : withDistance;
    }
  }, [withDistance, effectiveSort, nearCoords, priceCurrency, fxRate]);

  // Address input → Nominatim (via our /api/geocode/search proxy which
  // handles the 1 rps cap + caching). On success we set coords in memory
  // and stamp the query on the URL so a refresh preserves the visible
  // input value.
  const runAddressSearch = async (raw) => {
    const q = (raw || '').trim();
    if (!q) {
      setNearCoords(null); setNearQuery(''); return;
    }
    setNearBusy(true);
    try {
      const r = await axios.get(`${API}/geocode/search`, { params: { q } });
      if (typeof r.data?.lat === 'number' && typeof r.data?.lng === 'number') {
        setNearCoords({ lat: r.data.lat, lng: r.data.lng });
        setNearQuery(q);
        toast.success(t('stays.nearShownFrom', 'Showing stays near "{{addr}}"', { addr: q }));
      } else {
        toast.error(t('stays.nearNotFound', "We couldn't find that address — try a specific street or landmark."));
      }
    } catch (e) {
      toast.error(t('stays.nearFailed', 'Address lookup failed — please try again.'));
    } finally {
      setNearBusy(false);
    }
  };

  const clearAddressSearch = () => {
    setNearCoords(null); setNearQuery(''); setNearInput('');
  };

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
    bathrooms || porches || condition || furnished || hasElevator || subType || amenities.length ||
    nearCoords,
  );

  const clearAllFilters = () => {
    setWhere(''); setCheckin(''); setCheckout(''); setFlexible(null);
    setSubType(''); setBedrooms(''); setBathrooms(''); setPorches('');
    setCondition(''); setFurnished(false); setHasElevator(false);
    setPriceMin(''); setPriceMax(''); setPriceCurrency('ILS'); setAmenities([]);
    clearAddressSearch();
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
        title={landing?.title || 'Stays in Israel — Long-term, short-term & vacation rentals | MyIsraelRental'}
        description={landing?.description || 'Discover stays across Israel — vacation apartments, short-term lets and long-term rentals in Jerusalem, Tel Aviv, Haifa and beyond. Filter by area, dates, price and amenities.'}
        path={landing?.path || '/stays'}
      />
      {/* SEO landing hero — rendered only on dedicated landing routes
          (e.g. /kosher-stays-in-israel). Gives Google a crawlable H1 +
          intro paragraph so the URL indexes for its target long-tail. */}
      {landing?.heroTitle && (
        <div className="bg-[#F5F1E8] border-b border-[#E5E5E5]">
          <div className="max-w-7xl mx-auto px-4 py-8 sm:py-10">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1E6A6A]"
              style={{ fontFamily: 'Playfair Display' }}
              data-testid="stays-landing-h1"
            >
              {landing.heroTitle}
            </h1>
            {landing.heroLede && (
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-gray-700" data-testid="stays-landing-lede">
                {landing.heroLede}
              </p>
            )}
          </div>
        </div>
      )}
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
            areaLabelFor={(a) => areaLabel(a, t)}
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

          {/* Address search + List/Map view toggle row — new discovery
              tools that let a renter (a) enter a specific address like
              "20 Rothschild Blvd, Tel Aviv" to sort listings by proximity
              and (b) flip the whole result set into a Leaflet map so
              they can pattern-match neighborhoods visually. Renters
              rarely think "I want Tel Aviv" — they think "I want to be
              near my synagogue / office / kid's school." This closes
              that gap. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AddressAutocomplete
              value={nearInput}
              onChange={setNearInput}
              hasSelection={Boolean(nearCoords)}
              onSelect={({ label, lat, lng }) => {
                // Direct pick from the dropdown — no re-geocode needed.
                setNearInput(label);
                setNearQuery(label);
                setNearCoords({ lat, lng });
                toast.success(t('stays.nearShownFrom', 'Showing stays near "{{addr}}"', { addr: label }));
              }}
              onSubmit={runAddressSearch}
              onClear={clearAddressSearch}
              placeholder={t('stays.nearPlaceholder', 'Show stays near an address — e.g. Rothschild Blvd, Tel Aviv')}
              testId="stays-near"
            />
            <div
              className="hidden sm:inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5 shrink-0"
              role="tablist"
              aria-label={t('stays.viewToggle', 'View mode')}
              data-testid="stays-view-toggle"
            >
              <button
                type="button"
                onClick={() => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('view'); return n; }, { replace: true })}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  viewMode === 'list' ? 'bg-[#1E6A6A] text-white' : 'text-gray-700 hover:text-gray-900'
                }`}
                aria-pressed={viewMode === 'list'}
                data-testid="stays-view-list"
              >
                <LayoutGrid size={13} />
                {t('stays.viewList', 'List')}
              </button>
              <button
                type="button"
                onClick={() => setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('view', 'map'); return n; }, { replace: true })}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  viewMode === 'map' ? 'bg-[#1E6A6A] text-white' : 'text-gray-700 hover:text-gray-900'
                }`}
                aria-pressed={viewMode === 'map'}
                data-testid="stays-view-map"
              >
                <MapIcon size={13} />
                {t('stays.viewMap', 'Map')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-[#1E6A6A]" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="max-w-3xl mx-auto px-6 py-12 text-center">
          {/* Notify-me card is hoisted to the top of the empty-state so
              users see the alert CTA before the "try again" copy — this
              is the highest-intent moment for converting a fruitless
              search into a subscribed renter. */}
          <NotifyMeCard
            filters={{
              rental_type: subType,
              area: where,
              min_bedrooms: bedrooms,
              max_price: priceMax,
              date_from: checkin,
              date_to: checkout,
            }}
            dateRange={
              checkin && checkout
                ? { from: new Date(checkin), to: new Date(checkout) }
                : null
            }
          />
          <p className="text-2xl font-bold text-gray-800 mt-12 mb-2">{t('stays.noResultsTitle', 'No stays match those filters')}</p>
          <p className="text-gray-500 mb-6">{t('stays.noResultsBody', 'Try widening your search or clearing a filter — or have us notify you when something matches.')}</p>
          <button
            onClick={clearAllFilters}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid="stays-clear-filters"
          >
            {t('stays.clearAll', 'Clear all filters')}
          </button>
        </div>
      ) : viewMode === 'map' ? (
        // Map view — full-width Leaflet render with price-pin markers.
        // Renderable both with and without an active search so a renter
        // can just flip to "show me everything on a map" from the
        // default view too. When an address is set, we center on it and
        // show a "you searched here" pin.
        <div className="max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-10 py-6" data-testid="stays-map-container">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                {filteredWithDistance.length} {filteredWithDistance.length === 1 ? t('stays.stay', 'stay') : t('stays.staysLabel', 'stays')}
                {nearCoords ? ` ${t('stays.nearAddress', 'near this address')}` : ''}
              </h2>
              {nearCoords && nearQuery && (
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md" data-testid="stays-near-label">
                  {t('stays.centeredOn', 'Centered on')} {nearQuery}
                </p>
              )}
            </div>
            {isSearchActive && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-semibold text-[#1E6A6A] hover:underline"
                data-testid="stays-map-clear"
              >
                {t('stays.clearAll', 'Clear all')}
              </button>
            )}
          </div>
          <div className="relative">
            <StaysMapView
              properties={filteredWithDistance}
              userCoords={nearCoords}
              focusOnUser={Boolean(nearCoords)}
              displayCurrency={priceCurrency} fxRate={fxRate}
              activeId={activeMapId}
              onPinClick={setActiveMapId}
            />
            {/* Density strip — only when the renter has picked an
                address. Floats over the top-left of the map so users
                get an instant "is this a dense area?" read without
                counting pins. Higher z than the map so it clears the
                pin layer but below the zoom control so it never
                collides with the +/- buttons in the top-right. */}
            {nearCoords && (
              <div className="absolute top-3 start-3 z-10 pointer-events-none">
                <NearbyDensityBar
                  items={filteredWithDistance}
                  testId="stays-density-bar"
                />
              </div>
            )}
          </div>

          {/* Mobile-only peekable bottom sheet — lets renters glance at
              results without leaving the map. Full sheet expands to a
              vertical list of standard StaysCards; the peek strip is a
              horizontal-scrollable rail of thumbnails so users see
              which listings sit under the current viewport. */}
          <PeekableResultsSheet
            count={filteredWithDistance.length}
            countLabel={filteredWithDistance.length === 1
              ? t('stays.stay', 'stay')
              : t('stays.staysLabel', 'stays')}
            peekContent={(
              <div
                className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-3"
                data-testid="stays-peek-strip"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {filteredWithDistance.slice(0, 12).map((p) => {
                  const cover = (p.images && p.images[0]) || '';
                  const cur = (p.currency || 'ILS').toUpperCase();
                  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : '₪';
                  const isLT = p.rental_type === 'long-term';
                  const price = isLT
                    ? (p.monthly_price ? `${sym}${Math.round(p.monthly_price / 1000)}k/mo` : `${sym}—`)
                    : (p.nightly_price ? `${sym}${Math.round(p.nightly_price)}/nt` : `${sym}—`);
                  const isActive = p.id === activeMapId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      // Scroll the highlighted card into view when the
                      // user taps a map pin. `ref` callback fires after
                      // the DOM mounts / re-renders, so we always find
                      // the freshest element even after filter changes.
                      ref={(el) => {
                        if (isActive && el) {
                          el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                        }
                      }}
                      onClick={() => {
                        setActiveMapId(p.id);
                        // On second tap, navigate through — matches
                        // native map-app behaviour ("tap to preview,
                        // tap again to open").
                        if (activeMapId === p.id) {
                          saveReturnPath();
                          navigate(`/property/${p.id}`);
                        }
                      }}
                      className={`shrink-0 w-[168px] rounded-xl overflow-hidden bg-white text-start active:scale-95 transition-all ${
                        isActive
                          ? 'ring-2 ring-[#1E6A6A] shadow-[0_10px_20px_-8px_rgba(30,106,106,0.5)] scale-[1.03]'
                          : 'ring-1 ring-black/5'
                      }`}
                      data-testid={`stays-peek-card-${p.id}`}
                    >
                      <div
                        className="h-[76px] bg-gray-100"
                        style={cover ? { background: `url(${cover}) center/cover no-repeat` } : undefined}
                      />
                      <div className="px-2 py-1.5">
                        <div className="text-[11px] font-semibold text-gray-900 truncate">{p.title || t('stays.untitledProperty', 'Property')}</div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {price}
                          {typeof p.distance_km === 'number' && (
                            <span className="ms-1 text-[#1E6A6A] font-semibold">
                              · {p.distance_km < 1
                                ? `${Math.round(p.distance_km * 1000)} m`
                                : `${p.distance_km.toFixed(p.distance_km < 10 ? 1 : 0)} km`}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            fullContent={(
              <div className="grid grid-cols-1 gap-4 px-4 py-3 pb-24">
                {filteredWithDistance.map((p) => (
                  <StaysCard
                    key={p.id}
                    property={p}
                    fullWidth
                    liked={likedIds.has(p.id)}
                    onToggleLike={(e) => toggleLike(p.id, e)}
                    displayCurrency={priceCurrency} fxRate={fxRate}
                    onClick={() => {
                      saveReturnPath();
                      navigate(`/property/${p.id}`);
                    }}
                  />
                ))}
              </div>
            )}
            testId="stays-peek"
          />
        </div>
      ) : isSearchActive ? (
        // Flat results grid — Airbnb-style, shown once any search/filter is active
        <div className="max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-10 py-6" data-testid="stays-results-grid">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                {filteredWithDistance.length} {filteredWithDistance.length === 1 ? t('stays.stay', 'stay') : t('stays.staysLabel', 'stays')}
                {where ? ` ${t('stays.in', 'in')} ${areaLabel(where, t)}` : ''}
                {nearCoords && !where ? ` ${t('stays.nearAddress', 'near this address')}` : ''}
              </h2>
              {/* One-line version of the Home positioning strip — the full
                  three-column block here would push the actual listings
                  below the fold. Same rule: nothing about agent or broker
                  fees. */}
              <RenterTrustBanner variant="compact" className="mt-0.5" />
              {nearCoords && nearQuery && (
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md" data-testid="stays-near-label-grid">
                  {t('stays.nearestFirst', 'Nearest first — from')} {nearQuery}
                </p>
              )}
              {nearCoords && (
                <div className="mt-2">
                  <NearbyDensityBar
                    items={filteredWithDistance}
                    testId="stays-density-bar-list"
                  />
                </div>
              )}
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
            <div className="flex items-center gap-3">
              <SortSelect
                value={effectiveSort}
                onChange={setSort}
                allowNearest={Boolean(nearCoords)}
                t={t}
                testid="stays-sort-select"
              />
              {/* Quick "save this search" CTA always available when the
                  renter is narrowing — high-intent moment for converting
                  them into a logged-in user with an alert subscription. */}
              <button
                onClick={() => setShowNotifyCard(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#D4AF37] bg-white text-[#1E6A6A] hover:bg-[#D4AF37] hover:text-white transition-colors"
                data-testid="stays-create-alert-btn"
              >
                <Bell size={12} />
                {t('stays.createAlert', 'Create alert')}
              </button>
              <button
                onClick={clearAllFilters}
                className="text-xs font-semibold text-[#1E6A6A] hover:underline"
                data-testid="stays-grid-clear"
              >
                {t('stays.clearAll', 'Clear all')}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8">
            {filteredWithDistance.map((p) => (
              <StaysCard
                key={p.id}
                property={p}
                fullWidth
                liked={likedIds.has(p.id)}
                onToggleLike={(e) => toggleLike(p.id, e)}
                displayCurrency={priceCurrency} fxRate={fxRate}
                onClick={() => {
                  saveReturnPath();
                  navigate(`/property/${p.id}`);
                }}
              />
            ))}
          </div>
          {/* Inline alert card the user can summon from the header CTA
              when results > 0 — sits below the grid. */}
          {showNotifyCard && (
            <div className="mt-10">
              <NotifyMeCard
                filters={{
                  rental_type: subType,
                  area: where,
                  min_bedrooms: bedrooms,
                  max_price: priceMax,
                  date_from: checkin,
                  date_to: checkout,
                }}
                dateRange={
                  checkin && checkout
                    ? { from: new Date(checkin), to: new Date(checkout) }
                    : null
                }
              />
            </div>
          )}
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
              displayCurrency={priceCurrency} fxRate={fxRate}
              onCardClick={(id) => {
                saveReturnPath();
                navigate(`/property/${id}`);
              }}
              onSeeAll={() => {
                // Just set the area state — Stays is already the page
                // we're on, so navigating to /stays?area=X hits the
                // same route and React Router doesn't remount, leaving
                // state empty and letting syncUrl wipe the query. Set
                // state directly instead; syncUrl will write ?area=X
                // for us and the grouped view collapses to the flat
                // filtered grid.
                setWhere(area);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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

      {/* Mobile-only floating view toggle — Airbnb-style bottom-center
          pill that flips between list and map. The inline `sm:inline-flex`
          toggle inside the search bar row is hidden below the `sm`
          breakpoint precisely because this element takes over on mobile,
          giving the address input a full clean row of its own.

          Only renders in LIST view — in map view the peekable bottom
          sheet already exposes a "swipe up for details" affordance, so
          adding a second toggle would clutter the screen and overlap
          the sheet handle. */}
      {!loading && filtered.length > 0 && viewMode !== 'map' && (
        <button
          type="button"
          onClick={() => setSearchParams((prev) => {
            const n = new URLSearchParams(prev);
            n.set('view', 'map');
            return n;
          }, { replace: true })}
          className="sm:hidden fixed start-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold shadow-[0_10px_25px_-5px_rgba(0,0,0,0.35)] hover:bg-gray-800 active:scale-95 transition-transform"
          style={{
            // Match AccessibilityButton / WhatsAppButton positioning:
            // clear the iOS home-indicator + any mobile bottom nav +
            // a comfortable thumb-reach margin. Users who tap the FAB
            // never accidentally hit the nav bar behind it.
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-h, 0px) + 1.5rem)',
          }}
          data-testid="stays-view-fab"
          aria-label={t('stays.viewMap', 'Show map')}
        >
          <MapIcon size={14} />
          {t('stays.viewMap', 'Map')}
        </button>
      )}
    </div>
  );
};


export default Stays;
