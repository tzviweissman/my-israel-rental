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
import { X, Loader2 } from 'lucide-react';
import StaysCard from '../components/stays/StaysCard';
import AreaRow from '../components/stays/AreaRow';
import StaysSearchBar from '../components/stays/StaysSearchBar';
import FiltersModal from '../components/stays/FiltersModal';
import { flexLabel } from '../components/search/WhenPicker';
import QuickChips from '../components/search/QuickChips';
import PageMeta from '../components/PageMeta';
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
    setPriceMin(''); setPriceMax(''); setPriceCurrency('ILS'); setAmenities([]);
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


export default Stays;
